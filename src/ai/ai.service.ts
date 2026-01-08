import { Injectable, Logger, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import * as crypto from 'crypto';

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private genAI: GoogleGenerativeAI;
  private model: any;
  private modelName: string;

  constructor(
    private configService: ConfigService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {
    const apiKey = this.configService.get<string>('AI_API_KEY');

    if (!apiKey) {
      throw new Error('AI_API_KEY is not configured');
    }

    this.genAI = new GoogleGenerativeAI(apiKey);
    // Use gemini-2.0-flash (latest stable model)
    this.modelName = this.configService.get<string>('AI_MODEL') || 'gemini-2.0-flash';
    this.model = this.genAI.getGenerativeModel({ model: this.modelName });

    this.logger.log(`Google Gemini AI initialized successfully (Model: ${this.modelName})`);
  }

  private generateCacheKey(message: string, systemPrompt: string): string {
    const normalizedMessage = message.trim();
    const normalizedPrompt = systemPrompt.trim();
    const hash = crypto
      .createHash('sha256')
      .update(`${this.modelName}::${normalizedPrompt}::${normalizedMessage}`)
      .digest('hex');

    return `ai_response:${hash}`;
  }

  async getTutorResponse(
    message: string,
    systemPrompt: string,
    attachments: any[] = [],
  ): Promise<string> {
    try {
      const cacheKey = this.generateCacheKey(message, systemPrompt);

      if (attachments.length === 0) {
        const cachedResponse = await this.cacheManager.get<string>(cacheKey);
        if (cachedResponse) {
          this.logger.debug(`Cache hit for message: "${message.substring(0, 30)}..."`);
          return cachedResponse;
        }
      }

      this.logger.debug(`Generating AI response for message: "${message.substring(0, 50)}..." with ${attachments.length} attachments`);

      const fullPrompt = `${systemPrompt}

--- MENSAJE DEL ESTUDIANTE ---
${message}

--- RESPUESTA DEL TUTOR ---
Como tutor especializado, responde siguiendo la metodología socrática:`;

      const parts: any[] = [fullPrompt];

      if (attachments && attachments.length > 0) {
        attachments.forEach(att => {
          if (att.base64 && att.mimeType) {
            parts.push({
              inlineData: {
                data: att.base64,
                mimeType: att.mimeType
              }
            });
          }
        });
      }

      const result = await this.model.generateContent(parts);
      const response = await result.response;
      const text = response.text();

      if (!text || text.trim().length === 0) {
        throw new Error('Empty response from AI');
      }

      const finalResponse = text.trim();

      if (attachments.length === 0) {
        await this.cacheManager.set(cacheKey, finalResponse);
      }

      this.logger.debug(`AI response generated successfully (${text.length} characters)`);
      return finalResponse;

    } catch (error) {
      this.logger.error(`Error generating AI response: ${error.message}`);
      return this.getFallbackResponse(message, systemPrompt);
    }
  }

  async *getTutorResponseStream(
    message: string,
    systemPrompt: string,
    attachments: any[] = [],
  ): AsyncGenerator<{ type: 'chunk' | 'done' | 'error'; content: string }> {
    try {
      const cacheKey = this.generateCacheKey(message, systemPrompt);

      if (attachments.length === 0) {
        const cachedResponse = await this.cacheManager.get<string>(cacheKey);

        if (cachedResponse) {
          this.logger.debug(`Cache hit for streaming message: "${message.substring(0, 30)}..."`);

          const chunkSize = 20;
          for (let i = 0; i < cachedResponse.length; i += chunkSize) {
            const chunk = cachedResponse.substring(i, i + chunkSize);
            yield { type: 'chunk', content: chunk };
            await new Promise(resolve => setTimeout(resolve, 10));
          }

          yield { type: 'done', content: cachedResponse };
          return;
        }
      }

      this.logger.debug(`Generating streaming AI response for message: "${message.substring(0, 50)}..." with ${attachments.length} attachments`);

      const fullPrompt = `${systemPrompt}

--- MENSAJE DEL ESTUDIANTE ---
${message}

--- RESPUESTA DEL TUTOR ---
Como tutor especializado, responde siguiendo la metodología socrática:`;

      const parts: any[] = [fullPrompt];

      if (attachments && attachments.length > 0) {
        attachments.forEach(att => {
          if (att.base64 && att.mimeType) {
            parts.push({
              inlineData: {
                data: att.base64,
                mimeType: att.mimeType
              }
            });
          }
        });
      }

      const result = await this.model.generateContentStream(parts);

      let fullText = '';

      for await (const chunk of result.stream) {
        const chunkText = chunk.text();
        if (chunkText) {
          fullText += chunkText;
          yield { type: 'chunk', content: chunkText };
        }
      }

      if (!fullText || fullText.trim().length === 0) {
        throw new Error('Empty response from AI');
      }

      await this.cacheManager.set(cacheKey, fullText.trim());

      this.logger.debug(`Streaming completed (${fullText.length} characters)`);
      yield { type: 'done', content: fullText.trim() };

    } catch (error) {
      this.logger.error(`Error generating streaming AI response: ${error.message}`);
      const fallbackResponse = this.getFallbackResponse(message, systemPrompt);
      yield { type: 'error', content: fallbackResponse };
    }
  }

  private getFallbackResponse(_message: string, systemPrompt: string): string {
    let subject = 'general';
    if (systemPrompt.includes('matemáticas')) subject = 'matemáticas';
    else if (systemPrompt.includes('historia')) subject = 'historia';
    else if (systemPrompt.includes('gramática')) subject = 'gramática';

    const fallbackResponses = {
      matemáticas: `Interesante pregunta sobre matemáticas. Antes de darte una respuesta directa, me gustaría entender mejor tu nivel de conocimiento. ¿Podrías decirme qué sabes ya sobre este tema? Esto me ayudará a guiarte mejor hacia la solución.`,
      historia: `Esa es una excelente pregunta histórica. Para ayudarte a entender mejor este tema, ¿podrías contarme qué contexto histórico conoces relacionado con tu pregunta? Así podremos explorar el tema paso a paso.`,
      gramática: `Muy buena pregunta sobre gramática. Para ayudarte a descubrir la respuesta por ti mismo, ¿podrías darme algunos ejemplos de palabras que crees que podrían estar relacionadas con tu pregunta? Esto nos ayudará a analizar el patrón juntos.`,
      general: `Interesante pregunta. Como tu tutor, prefiero guiarte hacia la respuesta en lugar de dártela directamente. ¿Podrías contarme qué es lo que ya sabes sobre este tema? Así podremos construir el conocimiento juntos.`
    };

    return fallbackResponses[subject] || fallbackResponses.general;
  }
}

