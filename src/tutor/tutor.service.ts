import { Injectable, UnauthorizedException } from '@nestjs/common';
import { AiService } from '../ai/ai.service';
import { PrismaService } from '../prisma/prisma.service';
import { LevelingService } from '../gamification/leveling.service';
import { Prisma } from '@prisma/client';
import { Observable, Subject } from 'rxjs';

interface SubjectConfig {
  name: string;
  systemPrompt: string;
  difficulty: string;
  concepts: string[];
}

interface MessageAnalysis {
  messageType: 'question' | 'answer' | 'explanation' | 'hint' | 'encouragement';
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  concepts: string[];
  needsGuidance: boolean;
  suggestedResponse?: string;
}

@Injectable()
export class TutorService {
  private subjects: Map<string, SubjectConfig> = new Map();

  constructor(
    private readonly aiService: AiService,
    private readonly prisma: PrismaService,
    private readonly levelingService: LevelingService,
  ) { }

  async onModuleInit() {
    await this.loadSubjects();
  }

  async loadSubjects() {
    try {
      const subjects = await this.prisma.subject.findMany({
        where: { isActive: true }
      });

      this.subjects.clear();
      subjects.forEach(subject => {
        this.subjects.set(subject.id, {
          name: subject.name,
          systemPrompt: subject.systemPrompt,
          difficulty: subject.difficulty,
          concepts: subject.concepts
        });
      });
      console.log(`Loaded ${this.subjects.size} subjects from database`);
    } catch (error) {
      console.error('Failed to load subjects from database:', error);
    }
  }

  async updateSubject(id: string, data: Partial<SubjectConfig> & { isActive?: boolean }) {
    try {
      // 1. Update in Database
      const updatedSubject = await this.prisma.subject.update({
        where: { id },
        data: {
          ...data,
          updatedAt: new Date()
        }
      });

      // 2. Update in-memory cache
      if (updatedSubject.isActive) {
        this.subjects.set(updatedSubject.id, {
          name: updatedSubject.name,
          systemPrompt: updatedSubject.systemPrompt,
          difficulty: updatedSubject.difficulty,
          concepts: updatedSubject.concepts
        });
      } else {
        this.subjects.delete(updatedSubject.id);
      }

      return updatedSubject;
    } catch (error) {
      console.error(`Failed to update subject ${id}:`, error);
      throw error;
    }
  }

  // Crear sesión de chat con contexto de materia
  async createChatSession(userId: string, subject?: string) {
    const sessionData: any = {
      userId,
      isActive: true,
      duration: 0 // Inicializar duración en 0 segundos
    };

    if (subject) {
      sessionData.subject = subject;
      if (this.subjects.has(subject)) {
        const config = this.subjects.get(subject);
        sessionData.difficulty = config.difficulty;
      }
    }

    const session = await this.prisma.chatSession.create({
      data: sessionData,
    });

    // Crear o actualizar progreso de la materia
    if (subject) {
      await this.updateSubjectProgress(userId, subject, [], { newSession: true });
    }

    return session;
  }

  // Obtener mensajes de una sesión
  async getMessages(sessionId: string, userId: string) {
    const session = await this.prisma.chatSession.findUnique({
      where: { id: sessionId },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' }
        }
      }
    });

    if (!session || session.userId !== userId) {
      throw new UnauthorizedException('Access to this chat session is denied.');
    }

    return session.messages;
  }

  // Añadir mensaje con análisis inteligente
  async addMessage(sessionId: string, userId: string, content: string, attachments: any[] = []) {
    const session = await this.prisma.chatSession.findUnique({
      where: { id: sessionId },
      include: {
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 10 // Últimos 10 mensajes para contexto
        }
      }
    });

    if (!session || session.userId !== userId) {
      throw new UnauthorizedException('Access to this chat session is denied.');
    }

    // Analizar el mensaje del usuario
    const messageAnalysis = await this.analyzeUserMessage(content, session.subject);

    // Guardar mensaje del usuario
    const userMessage = await this.prisma.chatMessage.create({
      data: {
        sessionId: sessionId,
        content: content,
        isUserMessage: true,
        messageType: messageAnalysis.messageType,
        difficulty: messageAnalysis.difficulty,
        concepts: messageAnalysis.concepts,
        aiAnalysis: messageAnalysis as any,
        attachments: attachments ?? [],
      },
    });

    // Construir contexto para la IA
    const context = this.buildConversationContext(session);
    const systemPrompt = this.getSystemPrompt(session.subject, messageAnalysis);

    // Obtener respuesta de la IA
    const aiResponse = await this.aiService.getTutorResponse(
      content,
      systemPrompt + "\n\nContexto de la conversación:\n" + context,
      attachments
    );

    // Analizar respuesta de la IA
    const aiAnalysis = await this.analyzeAIResponse(aiResponse, messageAnalysis);

    // Guardar mensaje de la IA
    const aiMessage = await this.prisma.chatMessage.create({
      data: {
        sessionId: sessionId,
        content: aiResponse,
        isUserMessage: false,
        messageType: aiAnalysis.messageType,
        difficulty: aiAnalysis.difficulty,
        concepts: aiAnalysis.concepts,
        aiAnalysis: aiAnalysis as any
      },
    });

    // Actualizar sesión
    await this.updateSessionMetrics(sessionId, messageAnalysis.concepts);

    // Actualizar progreso del usuario
    if (session.subject) {
      await this.updateSubjectProgress(userId, session.subject, messageAnalysis.concepts, { newMessages: 1 });
    }

    // Award XP for sending a message
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
    attachments: any[] = [],
  ) {
    const session = await this.prisma.chatSession.findUnique({
      where: { id: sessionId },
      select: { id: true, userId: true, subject: true },
    });

    if (!session || session.userId !== userId) {
      throw new UnauthorizedException('Access to this chat session is denied.');
    }

    const messageAnalysis = await this.analyzeUserMessage(content, session.subject);

    const userMessage = await this.prisma.chatMessage.create({
      data: {
        sessionId,
        content,
        isUserMessage: true,
        messageType: messageAnalysis.messageType,
        difficulty: messageAnalysis.difficulty,
        concepts: messageAnalysis.concepts,
        aiAnalysis: messageAnalysis as any,
        attachments: attachments ?? [],
      },
    });

    await this.updateSessionMetrics(sessionId, messageAnalysis.concepts);

    if (session.subject) {
      await this.updateSubjectProgress(userId, session.subject, messageAnalysis.concepts, { newMessages: 1 });
    }

    return { userMessage };
  }

  // Streaming version of addMessage for SSE
  addMessageStream(
    sessionId: string,
    userId: string,
    content: string,
    attachments: any[] = [],
  ): Observable<{ event: string; data: string }> {
    const subject$ = new Subject<{ event: string; data: string }>();

    // Process in background
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
          subject$.next({
            event: 'error',
            data: JSON.stringify({ message: 'Access denied' }),
          });
          subject$.complete();
          return;
        }

        // Analyze user message
        const messageAnalysis = await this.analyzeUserMessage(content, session.subject);

        // Save user message
        const userMessage = await this.prisma.chatMessage.create({
          data: {
            sessionId,
            content,
            isUserMessage: true,
            messageType: messageAnalysis.messageType,
            difficulty: messageAnalysis.difficulty,
            concepts: messageAnalysis.concepts,
            aiAnalysis: messageAnalysis as any,
            attachments: attachments ?? [],
          },
        });

        // Send user message saved event
        subject$.next({
          event: 'user_message',
          data: JSON.stringify(userMessage),
        });

        // Build context for AI
        const context = this.buildConversationContext(session);
        const systemPrompt = this.getSystemPrompt(session.subject, messageAnalysis);
        const fullPrompt = systemPrompt + '\n\nContexto de la conversación:\n' + context;

        // Stream AI response
        let fullResponse = '';
        const stream = this.aiService.getTutorResponseStream(content, fullPrompt, attachments);

        for await (const chunk of stream) {
          if (chunk.type === 'chunk') {
            fullResponse += chunk.content;
            subject$.next({
              event: 'chunk',
              data: JSON.stringify({ content: chunk.content }),
            });
          } else if (chunk.type === 'done') {
            fullResponse = chunk.content;
          } else if (chunk.type === 'error') {
            fullResponse = chunk.content;
          }
        }

        // Analyze AI response
        const aiAnalysis = await this.analyzeAIResponse(fullResponse, messageAnalysis);

        // Save AI message
        const aiMessage = await this.prisma.chatMessage.create({
          data: {
            sessionId,
            content: fullResponse,
            isUserMessage: false,
            messageType: aiAnalysis.messageType,
            difficulty: aiAnalysis.difficulty,
            concepts: aiAnalysis.concepts,
            aiAnalysis: aiAnalysis as any,
          },
        });

        // Update session metrics
        await this.updateSessionMetrics(sessionId, messageAnalysis.concepts);

        // Update user progress
        if (session.subject) {
          await this.updateSubjectProgress(
            userId,
            session.subject,
            messageAnalysis.concepts,
            { newMessages: 1 },
          );
        }

        // Send completion event
        subject$.next({
          event: 'done',
          data: JSON.stringify({
            userMessage,
            assistantMessage: aiMessage,
          }),
        });

        subject$.complete();
      } catch (error) {
        subject$.next({
          event: 'error',
          data: JSON.stringify({ message: error.message || 'Unknown error' }),
        });
        subject$.complete();
      }
    })();

    return subject$.asObservable();
  }

  // Streaming for a previously created user message
  addMessageStreamFromMessage(
    sessionId: string,
    userId: string,
    messageId: string,
  ): Observable<{ event: string; data: string }> {
    const subject$ = new Subject<{ event: string; data: string }>();

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
          subject$.next({
            event: 'error',
            data: JSON.stringify({ message: 'Access denied' }),
          });
          subject$.complete();
          return;
        }

        const userMessage = await this.prisma.chatMessage.findUnique({
          where: { id: messageId },
        });

        if (!userMessage || userMessage.sessionId !== sessionId || !userMessage.isUserMessage) {
          subject$.next({
            event: 'error',
            data: JSON.stringify({ message: 'User message not found' }),
          });
          subject$.complete();
          return;
        }

        const messageAnalysis =
          (userMessage.aiAnalysis as unknown as MessageAnalysis) ??
          (await this.analyzeUserMessage(userMessage.content, session.subject));

        subject$.next({
          event: 'user_message',
          data: JSON.stringify(userMessage),
        });

        const context = this.buildConversationContext(session);
        const systemPrompt = this.getSystemPrompt(session.subject, messageAnalysis);
        const fullPrompt = systemPrompt + '\n\nContexto de la conversación:\n' + context;

        let fullResponse = '';
        const stream = this.aiService.getTutorResponseStream(
          userMessage.content,
          fullPrompt,
          (userMessage.attachments as any[]) ?? [],
        );

        for await (const chunk of stream) {
          if (chunk.type === 'chunk') {
            fullResponse += chunk.content;
            subject$.next({
              event: 'chunk',
              data: JSON.stringify({ content: chunk.content }),
            });
          } else if (chunk.type === 'done') {
            fullResponse = chunk.content;
          } else if (chunk.type === 'error') {
            fullResponse = chunk.content;
          }
        }

        const aiAnalysis = await this.analyzeAIResponse(fullResponse, messageAnalysis);

        const aiMessage = await this.prisma.chatMessage.create({
          data: {
            sessionId,
            content: fullResponse,
            isUserMessage: false,
            messageType: aiAnalysis.messageType,
            difficulty: aiAnalysis.difficulty,
            concepts: aiAnalysis.concepts,
            aiAnalysis: aiAnalysis as any,
          },
        });

        await this.updateSessionMetrics(sessionId, []);

        let xpResult = null;
        if (session.subject) {
          xpResult = await this.levelingService.awardXp(userId, session.subject, 10);
        }

        subject$.next({
          event: 'done',
          data: JSON.stringify({
            userMessage,
            assistantMessage: aiMessage,
            xpAwarded: xpResult,
          }),
        });

        subject$.complete();
      } catch (error) {
        subject$.next({
          event: 'error',
          data: JSON.stringify({ message: error.message || 'Unknown error' }),
        });
        subject$.complete();
      }
    })();

    return subject$.asObservable();
  }

  // Métodos auxiliares
  private async analyzeUserMessage(content: string, subject?: string): Promise<MessageAnalysis> {
    // Análisis básico del mensaje (en producción usar IA más sofisticada)
    const lowerContent = content.toLowerCase();

    let messageType: MessageAnalysis['messageType'] = 'question';
    if (lowerContent.includes('?')) messageType = 'question';
    else if (lowerContent.includes('creo que') || lowerContent.includes('pienso que')) messageType = 'answer';

    let difficulty: MessageAnalysis['difficulty'] = 'beginner';
    if (content.length > 100 || lowerContent.includes('complejo') || lowerContent.includes('avanzado')) {
      difficulty = 'advanced';
    } else if (content.length > 50) {
      difficulty = 'intermediate';
    }

    const concepts: string[] = [];
    if (subject && this.subjects.has(subject)) {
      const subjectConcepts = this.subjects.get(subject).concepts;
      concepts.push(...subjectConcepts.filter(concept =>
        lowerContent.includes(concept.toLowerCase())
      ));
    }

    return {
      messageType,
      difficulty,
      concepts,
      needsGuidance: messageType === 'question' || lowerContent.includes('ayuda') || lowerContent.includes('no entiendo')
    };
  }

  private async analyzeAIResponse(response: string, userAnalysis: MessageAnalysis): Promise<MessageAnalysis> {
    const lowerResponse = response.toLowerCase();

    let messageType: MessageAnalysis['messageType'] = 'explanation';
    if (lowerResponse.includes('?')) messageType = 'question';
    else if (lowerResponse.includes('excelente') || lowerResponse.includes('bien hecho')) messageType = 'encouragement';
    else if (lowerResponse.includes('pista') || lowerResponse.includes('intenta')) messageType = 'hint';

    return {
      messageType,
      difficulty: userAnalysis.difficulty,
      concepts: userAnalysis.concepts,
      needsGuidance: false
    };
  }

  private buildConversationContext(session: any): string {
    if (!session.messages || session.messages.length === 0) return "Esta es una nueva conversación.";

    const recentMessages = session.messages.slice(-6); // Últimos 6 mensajes
    return recentMessages.map(msg =>
      `${msg.isUserMessage ? 'Estudiante' : 'Tutor'}: ${msg.content} `
    ).join('\n');
  }

  private getSystemPrompt(subject?: string, analysis?: MessageAnalysis): string {
    if (subject && this.subjects.has(subject)) {
      const config = this.subjects.get(subject);
      let prompt = config.systemPrompt;

      if (analysis?.needsGuidance) {
        prompt += "\n\nEl estudiante parece necesitar más orientación. Sé más específico en tus preguntas guía.";
      }

      return prompt;
    }

    return `Eres 'IA Profesor', un tutor socrático.Haz preguntas guía para ayudar al estudiante a descubrir las respuestas por sí mismo.`;
  }

  private async updateSessionMetrics(sessionId: string, concepts: string[]) {
    const updates: any = {
      lastMessageAt: new Date(),
      updatedAt: new Date()
    };

    if (concepts.length > 0) {
      // Añadir conceptos únicos a la sesión
      const session = await this.prisma.chatSession.findUnique({
        where: { id: sessionId },
        select: { conceptsLearned: true }
      });

      if (session) {
        const existingConcepts = session.conceptsLearned || [];
        const newConcepts = [...new Set([...existingConcepts, ...concepts])];
        updates.conceptsLearned = newConcepts;
      }
    }

    await this.prisma.chatSession.update({
      where: { id: sessionId },
      data: updates
    });
  }

  private async updateSubjectProgress(
    userId: string,
    subject: string,
    newConcepts: string[] = [],
    options: { newSession?: boolean; newMessages?: number } = {},
  ) {
    const existingProgress = await this.prisma.subjectProgress.findUnique({
      where: {
        userId_subject: {
          userId,
          subject
        }
      }
    });

    if (existingProgress) {
      // Actualizar progreso existente
      const updatedConcepts = newConcepts.length > 0
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
    } else {
      // Crear nuevo progreso
      await this.prisma.subjectProgress.create({
        data: {
          userId,
          subject,
          totalSessions: options.newSession ? 1 : 0,
          totalMessages: options.newMessages ?? 0,
          conceptsLearned: newConcepts,
          lastActivity: new Date(),
          progress: Math.min(100, (newConcepts.length / 20) * 100)
        }
      });
    }
  }

  // Métodos para obtener estadísticas y sesiones
  async getUserSessions(userId: string, subject?: string, search?: string) {
    const where: any = { userId, isActive: true };
    if (subject) where.subject = subject;

    if (search) {
      where.OR = [
        { subject: { contains: search, mode: 'insensitive' } },
        {
          messages: {
            some: {
              content: { contains: search, mode: 'insensitive' }
            }
          }
        }
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
            createdAt: true
          },
          take: 1,
          orderBy: { createdAt: 'desc' }
        }
      },
      orderBy: { updatedAt: 'desc' }
    });

    return sessions.map((session) => ({
      ...session,
      subject: session.subject ?? 'general',
    }));
  }

  async getSubjectProgress(userId: string) {
    return this.prisma.subjectProgress.findMany({
      where: { userId },
      orderBy: { lastActivity: 'desc' }
    });
  }

  async getSubjectProgressBySubject(userId: string, subject: string) {
    const progress = await this.prisma.subjectProgress.findUnique({
      where: {
        userId_subject: {
          userId,
          subject
        }
      }
    });

    if (!progress) {
      // Si no existe progreso, devolver valores por defecto
      return {
        subject,
        progress: 0,
        totalSessions: 0,
        totalMessages: 0,
        conceptsLearned: [],
        lastActivity: null
      };
    }

    return progress;
  }

  async updateSessionDuration(sessionId: string, userId: string, durationSeconds: number) {
    try {
      const session = await this.prisma.chatSession.findUnique({
        where: { id: sessionId }
      });

      if (!session || session.userId !== userId) {
        throw new Error('Session not found or unauthorized');
      }

      const previousDuration = session.duration ?? 0;
      const normalizedDuration = Math.max(durationSeconds, previousDuration);

      await this.prisma.chatSession.update({
        where: { id: sessionId },
        data: {
          duration: normalizedDuration,
          updatedAt: new Date()
        }
      });

      // Actualizar el tiempo total de estudio en el progreso de la materia
      if (session.subject) {
        await this.updateSubjectProgressTime(userId, session.subject, normalizedDuration, previousDuration);
      }

      return { success: true };
    } catch (error) {
      console.error('Error updating session duration:', error);
      throw error;
    }
  }

  private async updateSubjectProgressTime(
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
          subject
        }
      }
    });

    if (existingProgress) {
      await this.prisma.subjectProgress.update({
        where: { id: existingProgress.id },
        data: {
          totalTimeSpent: existingProgress.totalTimeSpent + additionalSeconds,
          lastActivity: new Date(),
          updatedAt: new Date()
        }
      });
    }
  }

  async getAvailableSubjects() {
    return Array.from(this.subjects.entries()).map(([id, config]) => ({
      id,
      name: config.name,
      difficulty: config.difficulty,
      concepts: config.concepts
    }));
  }

  async getAllSubjectsForAdmin() {
    return this.prisma.subject.findMany({
      orderBy: { name: 'asc' }
    });
  }
}
