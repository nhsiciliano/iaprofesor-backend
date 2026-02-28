import type { ChatMessage } from '@prisma/client';
import type { XpAwardResult } from '../gamification/leveling.service';

export type TutorStreamErrorCode =
  | 'ACCESS_DENIED'
  | 'USER_MESSAGE_NOT_FOUND'
  | 'STREAM_FAILED'
  | 'INVALID_STREAM_INPUT';

export interface TutorStreamErrorPayload {
  code: TutorStreamErrorCode;
  message: string;
  details?: Record<string, unknown>;
}

export interface TutorStreamUserMessagePayload {
  message: ChatMessage;
}

export interface TutorStreamChunkPayload {
  content: string;
}

export interface TutorStreamDonePayload {
  userMessage: ChatMessage;
  assistantMessage: ChatMessage;
  xpAwarded?: XpAwardResult | null;
}

export type TutorStreamEvent =
  | { event: 'user_message'; data: TutorStreamUserMessagePayload }
  | { event: 'chunk'; data: TutorStreamChunkPayload }
  | { event: 'done'; data: TutorStreamDonePayload }
  | { event: 'error'; data: TutorStreamErrorPayload };

export interface SerializedTutorStreamEvent {
  event: TutorStreamEvent['event'];
  data: string;
}
