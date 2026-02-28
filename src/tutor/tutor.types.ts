import type { ChatMessage, SubjectProgress } from '@prisma/client';
import type { XpAwardResult } from '../gamification/leveling.service';

export interface SubjectConfig {
  name: string;
  systemPrompt: string;
  difficulty: string;
  concepts: string[];
}

export interface MessageAnalysis {
  messageType: 'question' | 'answer' | 'explanation' | 'hint' | 'encouragement';
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  concepts: string[];
  needsGuidance: boolean;
  suggestedResponse?: string;
}

export interface AddMessageResult {
  userMessage: ChatMessage;
  assistantMessage: ChatMessage;
  xpAwarded: XpAwardResult | null;
}

export interface CreateUserMessageResult {
  userMessage: ChatMessage;
}

export interface SessionDurationUpdateResult {
  success: true;
}

export interface SubjectProgressFallback {
  subject: string;
  progress: number;
  totalSessions: number;
  totalMessages: number;
  conceptsLearned: string[];
  lastActivity: null;
}

export type SubjectProgressBySubjectResult = SubjectProgress | SubjectProgressFallback;
