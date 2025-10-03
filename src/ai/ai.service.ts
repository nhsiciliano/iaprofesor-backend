import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenerativeAI } from '@google/generative-ai';

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private genAI: GoogleGenerativeAI;
  private model: any;

  constructor(private configService: ConfigService) {
    const apiKey = this.configService.get<string>('AI_API_KEY');
    
    if (!apiKey) {
      throw new Error('AI_API_KEY is not configured');
    }

    this.genAI = new GoogleGenerativeAI(apiKey);
    this.model = this.genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    
    this.logger.log('Google Gemini AI initialized successfully');
  }

  async getTutorResponse(
    message: string,
    systemPrompt: string,
  ): Promise<string> {
    try {
      this.logger.debug(`Generating AI response for message: "${message.substring(0, 50)}..."`);
      
      // Construir el prompt completo combinando el system prompt con el mensaje del usuario
      const fullPrompt = `${systemPrompt}

--- MENSAJE DEL ESTUDIANTE ---
${message}

--- RESPUESTA DEL TUTOR ---
Como tutor especializado, responde siguiendo la metodología socrática:`;
      
      // Llamar a Gemini
      const result = await this.model.generateContent(fullPrompt);
      const response = await result.response;
      const text = response.text();
      
      if (!text || text.trim().length === 0) {
        throw new Error('Empty response from AI');
      }
      
      this.logger.debug(`AI response generated successfully (${text.length} characters)`);
      return text.trim();
      
    } catch (error) {
      this.logger.error(`Error generating AI response: ${error.message}`);
      
      // Respuesta de fallback en caso de error
      return this.getFallbackResponse(message, systemPrompt);
    }
  }

  private getFallbackResponse(_message: string, systemPrompt: string): string {
    // Detectar materia basándose en el system prompt
    let subject = 'general';
    if (systemPrompt.includes('matemáticas')) subject = 'matemáticas';
    else if (systemPrompt.includes('historia')) subject = 'historia';
    else if (systemPrompt.includes('gramática')) subject = 'gramática';

    // Respuestas de fallback específicas por materia usando metodología socrática
    const fallbackResponses = {
      matemáticas: `Interesante pregunta sobre matemáticas. Antes de darte una respuesta directa, me gustaría entender mejor tu nivel de conocimiento. ¿Podrías decirme qué sabes ya sobre este tema? Esto me ayudará a guiarte mejor hacia la solución.`,
      
      historia: `Esa es una excelente pregunta histórica. Para ayudarte a entender mejor este tema, ¿podrías contarme qué contexto histórico conoces relacionado con tu pregunta? Así podremos explorar el tema paso a paso.`,
      
      gramática: `Muy buena pregunta sobre gramática. Para ayudarte a descubrir la respuesta por ti mismo, ¿podrías darme algunos ejemplos de palabras que crees que podrían estar relacionadas con tu pregunta? Esto nos ayudará a analizar el patrón juntos.`,
      
      general: `Interesante pregunta. Como tu tutor, prefiero guiarte hacia la respuesta en lugar de dártela directamente. ¿Podrías contarme qué es lo que ya sabes sobre este tema? Así podremos construir el conocimiento juntos.`
    };

    return fallbackResponses[subject] || fallbackResponses.general;
  }
}
