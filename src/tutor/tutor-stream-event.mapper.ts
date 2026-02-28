import { Injectable } from '@nestjs/common';
import type { ChatMessage } from '@prisma/client';
import type { XpAwardResult } from '../gamification/leveling.service';
import {
  SerializedTutorStreamEvent,
  TutorStreamErrorCode,
  TutorStreamEvent,
} from './tutor-stream.types';

@Injectable()
export class TutorStreamEventMapper {
  userMessage(message: ChatMessage): TutorStreamEvent {
    return {
      event: 'user_message',
      data: { message },
    };
  }

  chunk(content: string): TutorStreamEvent {
    return {
      event: 'chunk',
      data: { content },
    };
  }

  done(
    userMessage: ChatMessage,
    assistantMessage: ChatMessage,
    xpAwarded?: XpAwardResult | null,
  ): TutorStreamEvent {
    return {
      event: 'done',
      data: { userMessage, assistantMessage, xpAwarded },
    };
  }

  error(
    code: TutorStreamErrorCode,
    message: string,
    details?: Record<string, unknown>,
  ): TutorStreamEvent {
    return {
      event: 'error',
      data: { code, message, details },
    };
  }

  serialize(event: TutorStreamEvent): SerializedTutorStreamEvent {
    return {
      event: event.event,
      data: JSON.stringify(event.data),
    };
  }
}
