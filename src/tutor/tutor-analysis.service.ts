import { Injectable } from '@nestjs/common';
import { TutorSubjectsService } from './tutor-subjects.service';
import { MessageAnalysis } from './tutor.types';

@Injectable()
export class TutorAnalysisService {
  constructor(private readonly tutorSubjectsService: TutorSubjectsService) {}

  async analyzeUserMessage(content: string, subject?: string): Promise<MessageAnalysis> {
    const lowerContent = content.toLowerCase();

    let messageType: MessageAnalysis['messageType'] = 'question';
    if (lowerContent.includes('?')) {
      messageType = 'question';
    } else if (lowerContent.includes('creo que') || lowerContent.includes('pienso que')) {
      messageType = 'answer';
    }

    let difficulty: MessageAnalysis['difficulty'] = 'beginner';
    if (content.length > 100 || lowerContent.includes('complejo') || lowerContent.includes('avanzado')) {
      difficulty = 'advanced';
    } else if (content.length > 50) {
      difficulty = 'intermediate';
    }

    const concepts = this.tutorSubjectsService.findConcepts(subject, lowerContent);

    return {
      messageType,
      difficulty,
      concepts,
      needsGuidance:
        messageType === 'question' || lowerContent.includes('ayuda') || lowerContent.includes('no entiendo'),
    };
  }

  async analyzeAIResponse(response: string, userAnalysis: MessageAnalysis): Promise<MessageAnalysis> {
    const lowerResponse = response.toLowerCase();

    let messageType: MessageAnalysis['messageType'] = 'explanation';
    if (lowerResponse.includes('?')) {
      messageType = 'question';
    } else if (lowerResponse.includes('excelente') || lowerResponse.includes('bien hecho')) {
      messageType = 'encouragement';
    } else if (lowerResponse.includes('pista') || lowerResponse.includes('intenta')) {
      messageType = 'hint';
    }

    return {
      messageType,
      difficulty: userAnalysis.difficulty,
      concepts: userAnalysis.concepts,
      needsGuidance: false,
    };
  }
}
