import { Test, TestingModule } from '@nestjs/testing';
import { TutorMessageService } from './tutor-message.service';
import { TutorProgressService } from './tutor-progress.service';
import { TutorService } from './tutor.service';
import { TutorSessionService } from './tutor-session.service';
import { TutorStreamingService } from './tutor-streaming.service';
import { TutorSubjectsService } from './tutor-subjects.service';

const mockTutorSubjectsService = {
  loadSubjects: jest.fn(),
  updateSubject: jest.fn(),
  getAvailableSubjects: jest.fn(),
  getAllSubjectsForAdmin: jest.fn(),
};

const mockTutorSessionService = {
  createChatSession: jest.fn(),
  getMessages: jest.fn(),
  getUserSessions: jest.fn(),
  updateSessionDuration: jest.fn(),
};

const mockTutorMessageService = {
  addMessage: jest.fn(),
  createUserMessage: jest.fn(),
};

const mockTutorStreamingService = {
  addMessageStream: jest.fn(),
  addMessageStreamFromMessage: jest.fn(),
};

const mockTutorProgressService = {
  getSubjectProgress: jest.fn(),
  getSubjectProgressBySubject: jest.fn(),
};

describe('TutorService', () => {
  let service: TutorService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TutorService,
        { provide: TutorSubjectsService, useValue: mockTutorSubjectsService },
        { provide: TutorSessionService, useValue: mockTutorSessionService },
        { provide: TutorMessageService, useValue: mockTutorMessageService },
        { provide: TutorStreamingService, useValue: mockTutorStreamingService },
        { provide: TutorProgressService, useValue: mockTutorProgressService },
      ],
    }).compile();

    service = module.get<TutorService>(TutorService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('delegates createChatSession to TutorSessionService', async () => {
    const mockSession = { id: 'session-1', userId: 'user-1' };
    mockTutorSessionService.createChatSession.mockResolvedValue(mockSession);

    const result = await service.createChatSession('user-1', 'mathematics');

    expect(mockTutorSessionService.createChatSession).toHaveBeenCalledWith('user-1', 'mathematics');
    expect(result).toEqual(mockSession);
  });

  it('delegates addMessage to TutorMessageService', async () => {
    const mockResponse = { userMessage: { id: 'u-1' }, assistantMessage: { id: 'a-1' } };
    mockTutorMessageService.addMessage.mockResolvedValue(mockResponse);

    const result = await service.addMessage('session-1', 'user-1', 'hola');

    expect(mockTutorMessageService.addMessage).toHaveBeenCalledWith('session-1', 'user-1', 'hola', []);
    expect(result).toEqual(mockResponse);
  });
});
