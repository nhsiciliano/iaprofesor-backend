import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Observable, Subject } from 'rxjs';
import { AiService } from '../ai/ai.service';
import { AiAttachment } from '../ai/ai.types';
import { LevelingService } from '../gamification/leveling.service';
import { PrismaService } from '../prisma/prisma.service';
import { TutorAnalysisService } from './tutor-analysis.service';
import { TutorMessageService } from './tutor-message.service';
import { TutorProgressService } from './tutor-progress.service';
import { TutorStreamEventMapper } from './tutor-stream-event.mapper';
import { SerializedTutorStreamEvent } from './tutor-stream.types';
import { TutorSubjectsService } from './tutor-subjects.service';
import { MessageAnalysis } from './tutor.types';

@Injectable()
export class TutorStreamingService {
  constructor(
    private readonly aiService: AiService,
    private readonly prisma: PrismaService,
    private readonly levelingService: LevelingService,
    private readonly tutorAnalysisService: TutorAnalysisService,
    private readonly tutorMessageService: TutorMessageService,
    private readonly tutorProgressService: TutorProgressService,
    private readonly tutorStreamEventMapper: TutorStreamEventMapper,
    private readonly tutorSubjectsService: TutorSubjectsService,
  ) {}

  addMessageStream(
    sessionId: string,
    userId: string,
    content: string,
    attachments: AiAttachment[] = [],
  ): Observable<SerializedTutorStreamEvent> {
    const subject$ = new Subject<SerializedTutorStreamEvent>();

    (async () => {
      try {
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
          subject$.next(
            this.tutorStreamEventMapper.serialize(
              this.tutorStreamEventMapper.error('ACCESS_DENIED', 'Access denied'),
            ),
          );
          subject$.complete();
          return;
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

        subject$.next(
          this.tutorStreamEventMapper.serialize(
            this.tutorStreamEventMapper.userMessage(userMessage),
          ),
        );

        const context = this.tutorMessageService.buildConversationContext(session);
        const systemPrompt = this.tutorSubjectsService.getSystemPrompt(
          session.subject ?? undefined,
          messageAnalysis.needsGuidance,
        );
        const fullPrompt = `${systemPrompt}\n\nContexto de la conversacion:\n${context}`;

        let fullResponse = '';
        const stream = this.aiService.getTutorResponseStream(content, fullPrompt, attachments);

        for await (const chunk of stream) {
          if (chunk.type === 'chunk') {
            fullResponse += chunk.content;
            subject$.next(
              this.tutorStreamEventMapper.serialize(this.tutorStreamEventMapper.chunk(chunk.content)),
            );
          } else if (chunk.type === 'done') {
            fullResponse = chunk.content;
          } else if (chunk.type === 'error') {
            fullResponse = chunk.content;
          }
        }

        const aiAnalysis = await this.tutorAnalysisService.analyzeAIResponse(fullResponse, messageAnalysis);

        const aiMessage = await this.prisma.chatMessage.create({
          data: {
            sessionId,
            content: fullResponse,
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

        subject$.next(
          this.tutorStreamEventMapper.serialize(
            this.tutorStreamEventMapper.done(userMessage, aiMessage),
          ),
        );

        subject$.complete();
      } catch (error) {
        subject$.next(
          this.tutorStreamEventMapper.serialize(
            this.tutorStreamEventMapper.error(
              'STREAM_FAILED',
              error instanceof Error ? error.message : 'Unknown error',
            ),
          ),
        );
        subject$.complete();
      }
    })();

    return subject$.asObservable();
  }

  addMessageStreamFromMessage(
    sessionId: string,
    userId: string,
    messageId: string,
  ): Observable<SerializedTutorStreamEvent> {
    const subject$ = new Subject<SerializedTutorStreamEvent>();

    (async () => {
      try {
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
          subject$.next(
            this.tutorStreamEventMapper.serialize(
              this.tutorStreamEventMapper.error('ACCESS_DENIED', 'Access denied'),
            ),
          );
          subject$.complete();
          return;
        }

        const userMessage = await this.prisma.chatMessage.findUnique({
          where: { id: messageId },
        });

        if (!userMessage || userMessage.sessionId !== sessionId || !userMessage.isUserMessage) {
          subject$.next(
            this.tutorStreamEventMapper.serialize(
              this.tutorStreamEventMapper.error('USER_MESSAGE_NOT_FOUND', 'User message not found'),
            ),
          );
          subject$.complete();
          return;
        }

        const messageAnalysis =
          (userMessage.aiAnalysis as unknown as MessageAnalysis) ??
          (await this.tutorAnalysisService.analyzeUserMessage(userMessage.content, session.subject ?? undefined));

        subject$.next(
          this.tutorStreamEventMapper.serialize(
            this.tutorStreamEventMapper.userMessage(userMessage),
          ),
        );

        const context = this.tutorMessageService.buildConversationContext(session);
        const systemPrompt = this.tutorSubjectsService.getSystemPrompt(
          session.subject ?? undefined,
          messageAnalysis.needsGuidance,
        );
        const fullPrompt = `${systemPrompt}\n\nContexto de la conversacion:\n${context}`;

        let fullResponse = '';
        const stream = this.aiService.getTutorResponseStream(
          userMessage.content,
          fullPrompt,
          ((userMessage.attachments as unknown as AiAttachment[] | null) ?? []),
        );

        for await (const chunk of stream) {
          if (chunk.type === 'chunk') {
            fullResponse += chunk.content;
            subject$.next(
              this.tutorStreamEventMapper.serialize(this.tutorStreamEventMapper.chunk(chunk.content)),
            );
          } else if (chunk.type === 'done') {
            fullResponse = chunk.content;
          } else if (chunk.type === 'error') {
            fullResponse = chunk.content;
          }
        }

        const aiAnalysis = await this.tutorAnalysisService.analyzeAIResponse(fullResponse, messageAnalysis);

        const aiMessage = await this.prisma.chatMessage.create({
          data: {
            sessionId,
            content: fullResponse,
            isUserMessage: false,
            messageType: aiAnalysis.messageType,
            difficulty: aiAnalysis.difficulty,
            concepts: aiAnalysis.concepts,
            aiAnalysis: aiAnalysis as unknown as Prisma.InputJsonValue,
          },
        });

        await this.tutorProgressService.updateSessionMetrics(sessionId, []);

        let xpResult = null;
        if (session.subject) {
          xpResult = await this.levelingService.awardXp(userId, session.subject, 10);
        }

        subject$.next(
          this.tutorStreamEventMapper.serialize(
            this.tutorStreamEventMapper.done(userMessage, aiMessage, xpResult),
          ),
        );

        subject$.complete();
      } catch (error) {
        subject$.next(
          this.tutorStreamEventMapper.serialize(
            this.tutorStreamEventMapper.error(
              'STREAM_FAILED',
              error instanceof Error ? error.message : 'Unknown error',
            ),
          ),
        );
        subject$.complete();
      }
    })();

    return subject$.asObservable();
  }
}
