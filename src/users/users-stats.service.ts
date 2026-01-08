import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';

export interface UserStats {
  sessionsCompleted: number;
  messagesSent: number;
  studyTimeMinutes: number;
  currentStreak: number;
  totalSubjects: number;
  averageSessionDuration: number;
  conceptsLearned: number;
  lastActivity: string | null;
}

@Injectable()
export class UsersStatsService {
  constructor(private prisma: PrismaService) {}

  async getUserStats(userId: string): Promise<UserStats> {
    try {
      const [
        sessionsCompleted,
        messagesSent,
        durationAgg,
        lastSession,
        subjectProgress,
        currentStreak,
      ] = await Promise.all([
        this.prisma.chatSession.count({
          where: { userId, isActive: true },
        }),
        this.prisma.chatMessage.count({
          where: {
            isUserMessage: true,
            session: {
              userId,
              isActive: true,
            },
          },
        }),
        this.prisma.chatSession.aggregate({
          where: { userId, isActive: true },
          _sum: { duration: true },
        }),
        this.prisma.chatSession.findFirst({
          where: { userId, isActive: true },
          orderBy: { updatedAt: 'desc' },
          select: { updatedAt: true },
        }),
        this.prisma.subjectProgress.findMany({
          where: { userId },
          select: { subject: true, conceptsLearned: true },
        }),
        this.calculateCurrentStreak(userId),
      ]);

      const studyTimeMinutes = (durationAgg._sum.duration ?? 0) / 60;
      const totalSubjects = subjectProgress.length;
      const averageSessionDuration = sessionsCompleted > 0
        ? Math.round(studyTimeMinutes / sessionsCompleted)
        : 0;

      const allConcepts = subjectProgress.reduce<string[]>(
        (acc, entry) => acc.concat(entry.conceptsLearned ?? []),
        [],
      );
      const conceptsLearned = new Set(allConcepts).size;
      const lastActivity = lastSession?.updatedAt.toISOString() ?? null;

      return {
        sessionsCompleted,
        messagesSent,
        studyTimeMinutes: Math.round(studyTimeMinutes),
        currentStreak,
        totalSubjects,
        averageSessionDuration,
        conceptsLearned,
        lastActivity
      };
    } catch (error) {
      console.error('Error calculating user stats:', error);
      return {
        sessionsCompleted: 0,
        messagesSent: 0,
        studyTimeMinutes: 0,
        currentStreak: 0,
        totalSubjects: 0,
        averageSessionDuration: 0,
        conceptsLearned: 0,
        lastActivity: null
      };
    }
  }

  async getRecentSessions(userId: string, limit = 10, subject?: string) {
    const sessions = await this.prisma.chatSession.findMany({
      where: {
        userId,
        isActive: true,
        ...(subject ? { subject } : {}),
      },
      select: {
        id: true,
        subject: true,
        duration: true,
        conceptsLearned: true,
        createdAt: true,
        updatedAt: true,
        lastMessageAt: true,
        _count: { select: { messages: true } },
      },
      orderBy: { updatedAt: 'desc' },
      take: limit,
    });

    return sessions.map((session) => ({
      id: session.id,
      subject: session.subject ?? undefined,
      messageCount: session._count.messages,
      duration: session.duration ? Math.round(session.duration / 60) : 0,
      conceptsLearned: session.conceptsLearned ?? [],
      createdAt: session.createdAt.toISOString(),
      lastMessageAt: session.lastMessageAt?.toISOString() ?? session.updatedAt.toISOString(),
    }));
  }

  async getAnalyticsData(
    userId: string,
    period: 'week' | 'month' | 'year' | 'all',
    subjects?: string[],
  ) {
    const now = new Date();
    const start = this.getPeriodStart(now, period);

    const where: Prisma.ChatSessionWhereInput = {
      userId,
      isActive: true,
    };

    if (period !== 'all') {
      where.createdAt = { gte: start };
    }

    if (subjects?.length) {
      where.subject = { in: subjects };
    }

    const sessions = await this.prisma.chatSession.findMany({
      where,
      select: {
        createdAt: true,
        duration: true,
        conceptsLearned: true,
        subject: true,
        _count: { select: { messages: true } },
      },
      orderBy: { createdAt: 'asc' },
    });

    const stats = await this.getUserStats(userId);
    const detailed = await this.getDetailedProgress(userId);

    const totalSessions = sessions.length;
    const totalMessages = sessions.reduce((sum, session) => sum + session._count.messages, 0);
    const totalStudyTime = sessions.reduce((sum, session) => sum + (session.duration || 0), 0) / 60;
    const uniqueConcepts = new Set<string>();
    sessions.forEach((session) => {
      (session.conceptsLearned ?? []).forEach((concept) => uniqueConcepts.add(concept));
    });

    const subjectBreakdownFromProgress = (detailed.subjectProgress || [])
      .filter((progress: any) =>
        !subjects?.length || (progress.subject && subjects.includes(progress.subject)),
      )
      .map((progress: any) => ({
        subject: progress.subject,
        sessions: progress.totalSessions,
        messages: progress.totalMessages,
        conceptsLearned: progress.conceptsLearned.length,
        timeSpent: Math.round((progress.totalTimeSpent || 0) / 60),
        averageSessionDuration:
          progress.totalSessions > 0
            ? Math.round((progress.totalTimeSpent || 0) / 60 / progress.totalSessions)
            : 0,
        lastActivity: progress.lastActivity ?? stats.lastActivity,
        skillLevel: (progress.skillLevel as 'beginner' | 'intermediate' | 'advanced' | 'expert') ?? 'beginner',
        progress: progress.progress ?? 0,
        trending: 'stable' as const,
      }));

    const sessionSubjects = sessions.reduce((acc, session) => {
      if (!session.subject) {
        return acc;
      }
      const existing = acc.get(session.subject) ?? {
        subject: session.subject,
        sessions: 0,
        messages: 0,
        conceptsLearned: new Set<string>(),
        timeSpent: 0,
        lastActivity: session.createdAt,
      };

      existing.sessions += 1;
      existing.messages += session._count.messages;
      existing.timeSpent += session.duration ?? 0;
      (session.conceptsLearned ?? []).forEach((concept) => existing.conceptsLearned.add(concept));
      if (session.createdAt > existing.lastActivity) {
        existing.lastActivity = session.createdAt;
      }

      acc.set(session.subject, existing);
      return acc;
    }, new Map<string, {
      subject: string;
      sessions: number;
      messages: number;
      conceptsLearned: Set<string>;
      timeSpent: number;
      lastActivity: Date;
    }>());

    const subjectBreakdownFallback = Array.from(sessionSubjects.values()).map((entry) => ({
      subject: entry.subject,
      sessions: entry.sessions,
      messages: entry.messages,
      conceptsLearned: entry.conceptsLearned.size,
      timeSpent: Math.round(entry.timeSpent / 60),
      averageSessionDuration: entry.sessions > 0 ? Math.round((entry.timeSpent / 60) / entry.sessions) : 0,
      lastActivity: entry.lastActivity.toISOString(),
      skillLevel: 'beginner' as const,
      progress: Math.min(100, Math.round((entry.conceptsLearned.size / 20) * 100)),
      trending: 'stable' as const,
    }));

    const subjectMap = new Map<string, any>();
    subjectBreakdownFromProgress.forEach((entry) => subjectMap.set(entry.subject, entry));
    subjectBreakdownFallback.forEach((entry) => {
      if (!subjectMap.has(entry.subject)) {
        subjectMap.set(entry.subject, entry);
      }
    });

    const subjectBreakdown = Array.from(subjectMap.values());

    const activityData = this.buildActivityData(sessions);

    return {
      userId,
      period,
      dateRange: {
        start: period === 'all' && sessions[0] ? sessions[0].createdAt.toISOString() : start.toISOString(),
        end: now.toISOString(),
      },
      summary: {
        totalSessions,
        totalMessages,
        totalStudyTime: Math.round(totalStudyTime),
        averageSessionDuration:
          totalSessions > 0 ? Math.round(totalStudyTime / totalSessions) : 0,
        conceptsLearned: uniqueConcepts.size,
        currentStreak: stats.currentStreak,
        longestStreak: stats.currentStreak,
      },
      trends: {
        sessionsGrowth: 0,
        messagesGrowth: 0,
        studyTimeGrowth: 0,
        engagementScore: Math.min(100, Math.round(totalSessions * 8 + uniqueConcepts.size * 4)),
      },
      subjectBreakdown,
      activityData,
      generatedAt: new Date().toISOString(),
    };
  }

  async getChartData(
    userId: string,
    chartType: 'sessions' | 'messages' | 'study_time' | 'subjects',
    period: 'week' | 'month' | 'year' | 'all',
  ) {
    const analytics = await this.getAnalyticsData(userId, period);

    return analytics.activityData.map((day) => {
      let value = 0;
      switch (chartType) {
        case 'sessions':
          value = day.sessions;
          break;
        case 'messages':
          value = day.messages;
          break;
        case 'study_time':
          value = day.studyTime;
          break;
        case 'subjects':
          value = day.subjects.length;
          break;
      }

      return {
        label: day.date,
        value,
        date: day.date,
      };
    });
  }

  private async calculateCurrentStreak(userId: string): Promise<number> {
    try {
      // Obtener las fechas de actividad únicas del usuario (solo fechas, sin hora)
      const sessions = await this.prisma.chatSession.findMany({
        where: {
          userId,
          isActive: true
        },
        select: {
          createdAt: true
        },
        orderBy: {
          createdAt: 'desc'
        }
      });

      if (sessions.length === 0) return 0;

      // Convertir a fechas únicas (sin hora)
      const activityDates = sessions.map(session => {
        const date = new Date(session.createdAt);
        return date.toISOString().split('T')[0]; // Solo la fecha YYYY-MM-DD
      });

      // Eliminar duplicados y mantener orden descendente
      const uniqueDates = [...new Set(activityDates)].sort((a, b) => b.localeCompare(a));

      if (uniqueDates.length === 0) return 0;

      // Verificar si la actividad más reciente es de hoy o ayer
      const today = new Date().toISOString().split('T')[0];
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      
      const mostRecentDate = uniqueDates[0];
      
      // Si la actividad más reciente no es de hoy ni de ayer, la racha se rompió
      if (mostRecentDate !== today && mostRecentDate !== yesterday) {
        return 0;
      }

      // Contar días consecutivos
      let streak = 0;
      let currentDate = new Date();

      for (const dateStr of uniqueDates) {
        const expectedDate = new Date(currentDate);
        expectedDate.setDate(expectedDate.getDate() - streak);
        
        const expectedDateStr = expectedDate.toISOString().split('T')[0];
        
        if (dateStr === expectedDateStr) {
          streak++;
        } else {
          break;
        }
      }

      return streak;
    } catch (error) {
      console.error('Error calculating streak:', error);
      return 0;
    }
  }

  async getDetailedProgress(userId: string) {
    try {
      // Obtener progreso por materia
      const subjectProgress = await this.prisma.subjectProgress.findMany({
        where: { userId },
        orderBy: { lastActivity: 'desc' }
      });

      // Obtener actividad reciente (últimos 30 días)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const recentActivity = await this.prisma.chatSession.findMany({
        where: {
          userId,
          createdAt: {
            gte: thirtyDaysAgo
          }
        },
        select: {
          id: true,
          createdAt: true,
          duration: true,
          conceptsLearned: true,
          subject: true,
        },
        orderBy: {
          createdAt: 'desc'
        }
      });

      const recentSessionIds = recentActivity.map((session) => session.id);
      const messageCounts = recentSessionIds.length > 0
        ? await this.prisma.chatMessage.groupBy({
          by: ['sessionId'],
          where: { sessionId: { in: recentSessionIds }, isUserMessage: true },
          _count: { _all: true },
        })
        : [];

      const messageCountMap = new Map<string, number>();
      messageCounts.forEach((entry) => messageCountMap.set(entry.sessionId, entry._count._all));

      // Agrupar actividad por día
      const dailyActivity = recentActivity.reduce((acc, session) => {
        const date = session.createdAt.toISOString().split('T')[0];
        if (!acc[date]) {
          acc[date] = {
            date,
            sessions: 0,
            messages: 0,
            studyTime: 0,
            concepts: 0,
            subjects: new Set<string>()
          };
        }
        acc[date].sessions++;
        acc[date].messages += messageCountMap.get(session.id) ?? 0;
        acc[date].studyTime += session.duration ? Math.round(session.duration / 60) : 0;
        acc[date].concepts += session.conceptsLearned ? session.conceptsLearned.length : 0;
        if (session.subject) {
          acc[date].subjects.add(session.subject);
        }
        return acc;
      }, {} as Record<string, any>);

      // Convertir a array y agregar el tamaño del Set de subjects
      const dailyActivityArray = Object.values(dailyActivity).map((day: any) => ({
        date: day.date,
        sessions: day.sessions,
        messages: day.messages,
        studyTime: day.studyTime,
        concepts: day.concepts,
        subjects: Array.from(day.subjects as Set<string>),
      }));

      return {
        subjectProgress,
        dailyActivity: dailyActivityArray
      };
    } catch (error) {
      console.error('Error getting detailed progress:', error);
      return {
        subjectProgress: [],
        dailyActivity: []
      };
    }
  }

  private getPeriodStart(now: Date, period: 'week' | 'month' | 'year' | 'all') {
    const start = new Date(now);
    switch (period) {
      case 'week':
        start.setDate(start.getDate() - 7);
        break;
      case 'month':
        start.setMonth(start.getMonth() - 1);
        break;
      case 'year':
        start.setFullYear(start.getFullYear() - 1);
        break;
      case 'all':
      default:
        start.setFullYear(start.getFullYear() - 10);
        break;
    }

    return start;
  }

  private buildActivityData(
    sessions: Array<{
      createdAt: Date;
      duration: number | null;
      conceptsLearned: string[] | null;
      subject: string | null;
      _count: { messages: number };
    }>
  ) {
    const acc = sessions.reduce((map, session) => {
      const date = session.createdAt.toISOString().split('T')[0];
      if (!map[date]) {
        map[date] = {
          date,
          sessions: 0,
          messages: 0,
          studyTime: 0,
          conceptsLearned: 0,
          subjects: new Set<string>(),
        };
      }

      map[date].sessions += 1;
      map[date].messages += session._count.messages;
      map[date].studyTime += session.duration ? Math.round(session.duration / 60) : 0;
      map[date].conceptsLearned += session.conceptsLearned ? session.conceptsLearned.length : 0;
      if (session.subject) {
        map[date].subjects.add(session.subject);
      }

      return map;
    }, {} as Record<string, any>);

    return Object.values(acc).map((day: any) => ({
      date: day.date,
      sessions: day.sessions,
      messages: day.messages,
      studyTime: day.studyTime,
      conceptsLearned: day.conceptsLearned,
      subjects: Array.from(day.subjects as Set<string>),
    }));
  }
}
