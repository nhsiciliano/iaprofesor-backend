import { Injectable, UnauthorizedException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AiService } from '../ai/ai.service';
import { AiAttachment } from '../ai/ai.types';
import { LevelingService } from '../gamification/leveling.service';
import { PrismaService } from '../prisma/prisma.service';
import { TutorAnalysisService } from './tutor-analysis.service';
import { TutorProgressService } from './tutor-progress.service';
import { TutorSubjectsService } from './tutor-subjects.service';
import { AddMessageResult, CreateUserMessageResult } from './tutor.types';

@Injectable()
export class TutorMessageService {
  constructor(
    private readonly aiService: AiService,
    private readonly prisma: PrismaService,
    private readonly levelingService: LevelingService,
    private readonly tutorAnalysisService: TutorAnalysisService,
    private readonly tutorProgressService: TutorProgressService,
    private readonly tutorSubjectsService: TutorSubjectsService,
  ) {}

  async addMessage(
    sessionId: string,
    userId: string,
    content: string,
    attachments: AiAttachment[] = [],
  ): Promise<AddMessageResult> {
    const session = await this.prisma.chatSession.findUnique({
      where: { id: sessionId },
      include: {
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
      },
    });

    if (!session || session.userId !== userId) {
      throw new UnauthorizedException('Access to this chat session is denied.');
    }

    const messageAnalysis = await this.tutorAnalysisService.analyzeUserMessage(content, session.subject ?? undefined);

    const userMessage = await this.prisma.chatMessage.create({
      data: {
        sessionId,
        content,
        isUserMessage: true,
        messageType: messageAnalysis.messageType,
        difficulty: messageAnalysis.difficulty,
        concepts: messageAnalysis.concepts,
        aiAnalysis: messageAnalysis as unknown as Prisma.InputJsonValue,
        attachments: (attachments ?? []) as unknown as Prisma.InputJsonValue,
      },
    });

    const context = this.buildConversationContext(session);
    const systemPrompt = this.tutorSubjectsService.getSystemPrompt(
      session.subject ?? undefined,
      messageAnalysis.needsGuidance,
    );

    const aiResponse = await this.aiService.getTutorResponse(
      content,
      `${systemPrompt}\n\nContexto de la conversacion:\n${context}`,
      attachments,
    );

    const aiAnalysis = await this.tutorAnalysisService.analyzeAIResponse(aiResponse, messageAnalysis);

    const aiMessage = await this.prisma.chatMessage.create({
      data: {
        sessionId,
        content: aiResponse,
        isUserMessage: false,
        messageType: aiAnalysis.messageType,
        difficulty: aiAnalysis.difficulty,
        concepts: aiAnalysis.concepts,
        aiAnalysis: aiAnalysis as unknown as Prisma.InputJsonValue,
      },
    });

    await this.tutorProgressService.updateSessionMetrics(sessionId, messageAnalysis.concepts);

    if (session.subject) {
      await this.tutorProgressService.updateSubjectProgress(userId, session.subject, messageAnalysis.concepts, {
        newMessages: 1,
      });
    }

    let xpResult = null;
    if (session.subject) {
      xpResult = await this.levelingService.awardXp(userId, session.subject, 10);
    }

    return {
      userMessage,
      assistantMessage: aiMessage,
      xpAwarded: xpResult,
    };
  }

  async createUserMessage(
    sessionId: string,
    userId: string,
    content: string,
    attachments: AiAttachment[] = [],
  ): Promise<CreateUserMessageResult> {
    const session = await this.prisma.chatSession.findUnique({
      where: { id: sessionId },
      select: { id: true, userId: true, subject: true },
    });

    if (!session || session.userId !== userId) {
      throw new UnauthorizedException('Access to this chat session is denied.');
    }

    const messageAnalysis = await this.tutorAnalysisService.analyzeUserMessage(content, session.subject ?? undefined);

    const userMessage = await this.prisma.chatMessage.create({
      data: {
        sessionId,
        content,
        isUserMessage: true,
        messageType: messageAnalysis.messageType,
        difficulty: messageAnalysis.difficulty,
        concepts: messageAnalysis.concepts,
        aiAnalysis: messageAnalysis as unknown as Prisma.InputJsonValue,
        attachments: (attachments ?? []) as unknown as Prisma.InputJsonValue,
      },
    });

    await this.tutorProgressService.updateSessionMetrics(sessionId, messageAnalysis.concepts);

    if (session.subject) {
      await this.tutorProgressService.updateSubjectProgress(userId, session.subject, messageAnalysis.concepts, {
        newMessages: 1,
      });
    }

    return { userMessage };
  }

  buildConversationContext(
    session: Prisma.ChatSessionGetPayload<{ include: { messages: true } }>,
  ): string {
    if (!session.messages || session.messages.length === 0) {
      return 'Esta es una nueva conversacion.';
    }

    const recentMessages = session.messages.slice(-6);
    return recentMessages
      .map((message) => `${message.isUserMessage ? 'Estudiante' : 'Tutor'}: ${message.content} `)
      .join('\n');
  }
}
