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
      // Obtener todas las sesiones del usuario
      const sessions = await this.prisma.chatSession.findMany({
        where: {
          userId,
          isActive: true
        },
        include: {
          messages: {
            where: {
              isUserMessage: true
            }
          }
        },
        orderBy: {
          createdAt: 'desc'
        }
      });

      // Calcular estadísticas básicas
      const sessionsCompleted = sessions.length;
      const messagesSent = sessions.reduce((total, session) => total + session.messages.length, 0);
      
      // Calcular tiempo de estudio total (en minutos)
      const studyTimeMinutes = sessions.reduce((total, session) => {
        return total + (session.duration || 0);
      }, 0) / 60; // Convertir de segundos a minutos

      // Obtener materias únicas
      const uniqueSubjects = new Set(sessions.map(s => s.subject).filter(Boolean));
      const totalSubjects = uniqueSubjects.size;

      // Calcular duración promedio de sesión
      const averageSessionDuration = sessionsCompleted > 0 
        ? Math.round(studyTimeMinutes / sessionsCompleted) 
        : 0;

      // Calcular conceptos aprendidos únicos
      const allConcepts: string[] = [];
      sessions.forEach(s => {
        if (s.conceptsLearned) {
          allConcepts.push(...s.conceptsLearned);
        }
      });
      const conceptsLearned = new Set(allConcepts).size;

      // Calcular racha actual
      const currentStreak = await this.calculateCurrentStreak(userId);

      // Última actividad
      const lastActivity = sessions.length > 0 
        ? sessions[0].updatedAt.toISOString() 
        : null;

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
      include: {
        messages: true,
      },
      orderBy: { updatedAt: 'desc' },
      take: limit,
    });

    return sessions.map((session) => ({
      id: session.id,
      subject: session.subject ?? undefined,
      messageCount: session.messages.length,
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
      include: { messages: true },
      orderBy: { createdAt: 'asc' },
    });

    const stats = await this.getUserStats(userId);
    const detailed = await this.getDetailedProgress(userId);

    const totalSessions = sessions.length;
    const totalMessages = sessions.reduce((sum, session) => sum + session.messages.length, 0);
    const totalStudyTime = sessions.reduce((sum, session) => sum + (session.duration || 0), 0) / 60;
    const uniqueConcepts = new Set<string>();
    sessions.forEach((session) => {
      (session.conceptsLearned ?? []).forEach((concept) => uniqueConcepts.add(concept));
    });

    const subjectBreakdown = (detailed.subjectProgress || [])
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
        include: {
          messages: {
            where: {
              isUserMessage: true
            }
          }
        },
        orderBy: {
          createdAt: 'desc'
        }
      });

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
        acc[date].messages += session.messages.length;
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

  private buildActivityData(sessions: any[]) {
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
      map[date].messages += session.messages.length;
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
