import { Injectable } from '@nestjs/common';
import { Observable } from 'rxjs';
import type { ChatSession } from '@prisma/client';
import { AiAttachment } from '../ai/ai.types';
import type { SerializedTutorStreamEvent } from './tutor-stream.types';
import { TutorMessageService } from './tutor-message.service';
import { TutorProgressService } from './tutor-progress.service';
import { TutorSessionService } from './tutor-session.service';
import { TutorStreamingService } from './tutor-streaming.service';
import { TutorSubjectsService } from './tutor-subjects.service';
import {
  AddMessageResult,
  CreateUserMessageResult,
  SessionDurationUpdateResult,
  SubjectConfig,
  SubjectProgressBySubjectResult,
} from './tutor.types';

@Injectable()
export class TutorService {
  constructor(
    private readonly tutorSubjectsService: TutorSubjectsService,
    private readonly tutorSessionService: TutorSessionService,
    private readonly tutorMessageService: TutorMessageService,
    private readonly tutorStreamingService: TutorStreamingService,
    private readonly tutorProgressService: TutorProgressService,
  ) {}

  async loadSubjects(): Promise<void> {
    return this.tutorSubjectsService.loadSubjects();
  }

  async updateSubject(
    id: string,
    data: Partial<SubjectConfig> & { isActive?: boolean },
  ) {
    return this.tutorSubjectsService.updateSubject(id, data);
  }

  async createChatSession(userId: string, subject?: string): Promise<ChatSession> {
    return this.tutorSessionService.createChatSession(userId, subject);
  }

  async getMessages(sessionId: string, userId: string) {
    return this.tutorSessionService.getMessages(sessionId, userId);
  }

  async addMessage(
    sessionId: string,
    userId: string,
    content: string,
    attachments: AiAttachment[] = [],
  ): Promise<AddMessageResult> {
    return this.tutorMessageService.addMessage(sessionId, userId, content, attachments);
  }

  async createUserMessage(
    sessionId: string,
    userId: string,
    content: string,
    attachments: AiAttachment[] = [],
  ): Promise<CreateUserMessageResult> {
    return this.tutorMessageService.createUserMessage(sessionId, userId, content, attachments);
  }

  addMessageStream(
    sessionId: string,
    userId: string,
    content: string,
    attachments: AiAttachment[] = [],
  ): Observable<SerializedTutorStreamEvent> {
    return this.tutorStreamingService.addMessageStream(sessionId, userId, content, attachments);
  }

  addMessageStreamFromMessage(
    sessionId: string,
    userId: string,
    messageId: string,
  ): Observable<SerializedTutorStreamEvent> {
    return this.tutorStreamingService.addMessageStreamFromMessage(sessionId, userId, messageId);
  }

  async getUserSessions(userId: string, subject?: string, search?: string) {
    return this.tutorSessionService.getUserSessions(userId, subject, search);
  }

  async getSubjectProgress(userId: string) {
    return this.tutorProgressService.getSubjectProgress(userId);
  }

  async getSubjectProgressBySubject(
    userId: string,
    subject: string,
  ): Promise<SubjectProgressBySubjectResult> {
    return this.tutorProgressService.getSubjectProgressBySubject(userId, subject);
  }

  async updateSessionDuration(
    sessionId: string,
    userId: string,
    durationSeconds: number,
  ): Promise<SessionDurationUpdateResult> {
    return this.tutorSessionService.updateSessionDuration(sessionId, userId, durationSeconds);
  }

  async getAvailableSubjects() {
    return this.tutorSubjectsService.getAvailableSubjects();
  }

  async getAllSubjectsForAdmin() {
    return this.tutorSubjectsService.getAllSubjectsForAdmin();
  }
}
