import { Injectable, UnauthorizedException } from '@nestjs/common';
import { AiService } from '../ai/ai.service';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';

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
  private readonly subjectConfigs: Record<string, SubjectConfig> = {
    mathematics: {
      name: 'Matemáticas',
      systemPrompt: `Eres 'IA Profesor', un tutor socrático especializado en matemáticas. 
      
Tu metodología:
      - NUNCA des la respuesta directa o final
      - Haz preguntas guía que lleven al estudiante a descubrir la solución
      - Usa analogías y ejemplos concretos
      - Descompón problemas complejos en pasos más simples
      - Celebra los aciertos y reorienta suavemente los errores
      - Adapta el nivel de dificultad según las respuestas del estudiante
      
      Áreas que dominas: álgebra, geometría, cálculo, estadística, trigonometría.
      
      Si el estudiante se frustra, ofrece pistas más directas pero manteniendo el enfoque socrático.`,
      difficulty: 'intermediate',
      concepts: ['álgebra', 'geometría', 'cálculo', 'estadística', 'ecuaciones', 'funciones']
    },
    history: {
      name: 'Historia',
      systemPrompt: `Eres 'IA Profesor', un tutor socrático especializado en historia.
      
      Tu metodología:
      - Conecta eventos históricos con el presente
      - Haz preguntas que promuevan el pensamiento crítico
      - Ayuda a analizar causas y consecuencias
      - Fomenta la comprensión de diferentes perspectivas históricas
      - Usa relatos y anécdotas para hacer la historia más vívida
      
      Nunca des información como simple memorización, siempre busca la comprensión profunda.`,
      difficulty: 'intermediate',
      concepts: ['civilizaciones', 'guerras', 'política', 'cultura', 'economía', 'sociedades']
    },
    grammar: {
      name: 'Gramática',
      systemPrompt: `Eres 'IA Profesor', un tutor socrático especializado en gramática y lenguaje.
      
      Tu metodología:
      - Enseña reglas gramaticales a través de ejemplos prácticos
      - Corrige errores explicando el "por qué"
      - Fomenta la escritura creativa aplicando las reglas
      - Haz que el estudiante identifique patrones en el lenguaje
      - Conecta la gramática con la comunicación efectiva
      
      Haz que el aprendizaje del lenguaje sea dinámico y aplicable.`,
      difficulty: 'intermediate',
      concepts: ['sintaxis', 'morfología', 'semántica', 'ortografía', 'puntuación', 'estilo']
    }
  };

  constructor(
    private readonly aiService: AiService,
    private readonly prisma: PrismaService,
  ) {}

  // Crear sesión de chat con contexto de materia
  async createChatSession(userId: string, subject?: string) {
    const sessionData: any = { 
      userId,
      isActive: true,
      duration: 0 // Inicializar duración en 0 segundos
    };

    if (subject && this.subjectConfigs[subject]) {
      sessionData.subject = subject;
      sessionData.difficulty = this.subjectConfigs[subject].difficulty;
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
  async addMessage(sessionId: string, userId: string, content: string) {
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
        aiAnalysis: messageAnalysis as any
      },
    });

    // Construir contexto para la IA
    const context = this.buildConversationContext(session);
    const systemPrompt = this.getSystemPrompt(session.subject, messageAnalysis);

    // Obtener respuesta de la IA
    const aiResponse = await this.aiService.getTutorResponse(
      content,
      systemPrompt + "\n\nContexto de la conversación:\n" + context,
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

    return {
      userMessage,
      assistantMessage: aiMessage
    };
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
    if (subject && this.subjectConfigs[subject]) {
      const subjectConcepts = this.subjectConfigs[subject].concepts;
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
      `${msg.isUserMessage ? 'Estudiante' : 'Tutor'}: ${msg.content}`
    ).join('\n');
  }

  private getSystemPrompt(subject?: string, analysis?: MessageAnalysis): string {
    if (subject && this.subjectConfigs[subject]) {
      const config = this.subjectConfigs[subject];
      let prompt = config.systemPrompt;
      
      if (analysis?.needsGuidance) {
        prompt += "\n\nEl estudiante parece necesitar más orientación. Sé más específico en tus preguntas guía.";
      }
      
      return prompt;
    }
    
    return `Eres 'IA Profesor', un tutor socrático. Haz preguntas guía para ayudar al estudiante a descubrir las respuestas por sí mismo.`;
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
  async getUserSessions(userId: string, subject?: string) {
    const where: any = { userId, isActive: true };
    if (subject) where.subject = subject;

    return this.prisma.chatSession.findMany({
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
    return Object.keys(this.subjectConfigs).map(key => ({
      id: key,
      name: this.subjectConfigs[key].name,
      difficulty: this.subjectConfigs[key].difficulty,
      concepts: this.subjectConfigs[key].concepts
    }));
  }
}
