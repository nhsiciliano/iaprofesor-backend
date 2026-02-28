import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { SubjectProgressBySubjectResult } from './tutor.types';

@Injectable()
export class TutorProgressService {
  constructor(private readonly prisma: PrismaService) {}

  async updateSessionMetrics(sessionId: string, concepts: string[]) {
    const updates: Prisma.ChatSessionUpdateInput = {
      lastMessageAt: new Date(),
      updatedAt: new Date(),
    };

    if (concepts.length > 0) {
      const session = await this.prisma.chatSession.findUnique({
        where: { id: sessionId },
        select: { conceptsLearned: true },
      });

      if (session) {
        const existingConcepts = session.conceptsLearned || [];
        const newConcepts = [...new Set([...existingConcepts, ...concepts])];
        updates.conceptsLearned = newConcepts;
      }
    }

    await this.prisma.chatSession.update({
      where: { id: sessionId },
      data: updates,
    });
  }

  async updateSubjectProgress(
    userId: string,
    subject: string,
    newConcepts: string[] = [],
    options: { newSession?: boolean; newMessages?: number } = {},
  ) {
    const existingProgress = await this.prisma.subjectProgress.findUnique({
      where: {
        userId_subject: {
          userId,
          subject,
        },
      },
    });

    if (existingProgress) {
      const updatedConcepts =
        newConcepts.length > 0
          ? [...new Set([...existingProgress.conceptsLearned, ...newConcepts])]
          : existingProgress.conceptsLearned;

      const data: Prisma.SubjectProgressUpdateInput = {
        conceptsLearned: updatedConcepts,
        lastActivity: new Date(),
        progress: Math.min(100, (updatedConcepts.length / 20) * 100),
      };

      if (options.newSession) {
        data.totalSessions = { increment: 1 };
      }

      if (options.newMessages && options.newMessages > 0) {
        data.totalMessages = { increment: options.newMessages };
      }

      await this.prisma.subjectProgress.update({
        where: { id: existingProgress.id },
        data,
      });

      return;
    }

    await this.prisma.subjectProgress.create({
      data: {
        userId,
        subject,
        totalSessions: options.newSession ? 1 : 0,
        totalMessages: options.newMessages ?? 0,
        conceptsLearned: newConcepts,
        lastActivity: new Date(),
        progress: Math.min(100, (newConcepts.length / 20) * 100),
      },
    });
  }

  async updateSubjectProgressTime(
    userId: string,
    subject: string,
    newTotalSeconds: number,
    previousTotalSeconds: number,
  ) {
    const additionalSeconds = Math.max(0, newTotalSeconds - previousTotalSeconds);
    if (additionalSeconds === 0) {
      return;
    }

    const existingProgress = await this.prisma.subjectProgress.findUnique({
      where: {
        userId_subject: {
          userId,
          subject,
        },
      },
    });

    if (!existingProgress) {
      return;
    }

    await this.prisma.subjectProgress.update({
      where: { id: existingProgress.id },
      data: {
        totalTimeSpent: existingProgress.totalTimeSpent + additionalSeconds,
        lastActivity: new Date(),
        updatedAt: new Date(),
      },
    });
  }

  async getSubjectProgress(userId: string) {
    return this.prisma.subjectProgress.findMany({
      where: { userId },
      orderBy: { lastActivity: 'desc' },
    });
  }

  async getSubjectProgressBySubject(
    userId: string,
    subject: string,
  ): Promise<SubjectProgressBySubjectResult> {
    const progress = await this.prisma.subjectProgress.findUnique({
      where: {
        userId_subject: {
          userId,
          subject,
        },
      },
    });

    if (!progress) {
      return {
        subject,
        progress: 0,
        totalSessions: 0,
        totalMessages: 0,
        conceptsLearned: [],
        lastActivity: null,
      };
    }

    return progress;
  }
}
