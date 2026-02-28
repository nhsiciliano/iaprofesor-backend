import { Injectable, UnauthorizedException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { TutorProgressService } from './tutor-progress.service';
import { TutorSubjectsService } from './tutor-subjects.service';
import { SessionDurationUpdateResult } from './tutor.types';

@Injectable()
export class TutorSessionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tutorProgressService: TutorProgressService,
    private readonly tutorSubjectsService: TutorSubjectsService,
  ) {}

  async createChatSession(userId: string, subject?: string) {
    const sessionData: Prisma.ChatSessionUncheckedCreateInput = {
      userId,
      isActive: true,
      duration: 0,
    };

    if (subject) {
      sessionData.subject = subject;

      const difficulty = this.tutorSubjectsService.getSubjectDifficulty(subject);
      if (difficulty) {
        sessionData.difficulty = difficulty;
      }
    }

    const session = await this.prisma.chatSession.create({
      data: sessionData,
    });

    if (subject) {
      await this.tutorProgressService.updateSubjectProgress(userId, subject, [], { newSession: true });
    }

    return session;
  }

  async getMessages(sessionId: string, userId: string) {
    const session = await this.prisma.chatSession.findUnique({
      where: { id: sessionId },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!session || session.userId !== userId) {
      throw new UnauthorizedException('Access to this chat session is denied.');
    }

    return session.messages;
  }

  async getUserSessions(userId: string, subject?: string, search?: string) {
    const where: Prisma.ChatSessionWhereInput = { userId, isActive: true };
    if (subject) {
      where.subject = subject;
    }

    if (search) {
      where.OR = [
        { subject: { contains: search, mode: 'insensitive' } },
        {
          messages: {
            some: {
              content: { contains: search, mode: 'insensitive' },
            },
          },
        },
      ];
    }

    const sessions = await this.prisma.chatSession.findMany({
      where,
      include: {
        messages: {
          select: {
            id: true,
            content: true,
            isUserMessage: true,
            createdAt: true,
          },
          take: 1,
          orderBy: { createdAt: 'desc' },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });

    return sessions.map((session) => ({
      ...session,
      subject: session.subject ?? 'general',
    }));
  }

  async updateSessionDuration(
    sessionId: string,
    userId: string,
    durationSeconds: number,
  ): Promise<SessionDurationUpdateResult> {
    const session = await this.prisma.chatSession.findUnique({
      where: { id: sessionId },
    });

    if (!session || session.userId !== userId) {
      throw new UnauthorizedException('Session not found or unauthorized');
    }

    const previousDuration = session.duration ?? 0;
    const normalizedDuration = Math.max(durationSeconds, previousDuration);

    await this.prisma.chatSession.update({
      where: { id: sessionId },
      data: {
        duration: normalizedDuration,
        updatedAt: new Date(),
      },
    });

    if (session.subject) {
      await this.tutorProgressService.updateSubjectProgressTime(
        userId,
        session.subject,
        normalizedDuration,
        previousDuration,
      );
    }

    return { success: true };
  }
}
