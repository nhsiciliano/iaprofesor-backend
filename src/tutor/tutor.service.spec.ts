import { Test, TestingModule } from '@nestjs/testing';
import { TutorService } from './tutor.service';
import { PrismaService } from '../prisma/prisma.service';
import { AiService } from '../ai/ai.service';
import { UnauthorizedException } from '@nestjs/common';

// Mock data and services
const mockPrismaService = {
  chatSession: {
    create: jest.fn(),
    findUnique: jest.fn(),
  },
  chatMessage: {
    create: jest.fn(),
    findMany: jest.fn(),
  },
};

const mockAiService = {
  getTutorResponse: jest.fn(),
};

describe('TutorService', () => {
  let service: TutorService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TutorService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: AiService,
          useValue: mockAiService,
        },
      ],
    }).compile();

    service = module.get<TutorService>(TutorService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createChatSession', () => {
    it('should create a new chat session for a user', async () => {
      const userId = 'user-123';
      const session = { id: 'session-123', userId, createdAt: new Date() };
      mockPrismaService.chatSession.create.mockResolvedValue(session);

      const result = await service.createChatSession(userId);

      expect(mockPrismaService.chatSession.create).toHaveBeenCalledWith({ data: { userId } });
      expect(result).toEqual(session);
    });
  });

  describe('getMessages', () => {
    it('should return messages for an authorized user', async () => {
      const sessionId = 'session-123';
      const userId = 'user-123';
      const session = { id: sessionId, userId };
      const messages = [{ id: 'msg-1', content: 'Hello' }];

      mockPrismaService.chatSession.findUnique.mockResolvedValue(session);
      mockPrismaService.chatMessage.findMany.mockResolvedValue(messages);

      const result = await service.getMessages(sessionId, userId);

      expect(mockPrismaService.chatSession.findUnique).toHaveBeenCalledWith({ where: { id: sessionId } });
      expect(mockPrismaService.chatMessage.findMany).toHaveBeenCalledWith({ where: { sessionId }, orderBy: { createdAt: 'asc' } });
      expect(result).toEqual(messages);
    });

    it('should throw UnauthorizedException for a non-existent session', async () => {
      mockPrismaService.chatSession.findUnique.mockResolvedValue(null);
      await expect(service.getMessages('session-123', 'user-123')).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException if user does not own the session', async () => {
      const session = { id: 'session-123', userId: 'another-user' };
      mockPrismaService.chatSession.findUnique.mockResolvedValue(session);
      await expect(service.getMessages('session-123', 'user-123')).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('addMessage', () => {
    it('should save user message, get and save AI response, and return it', async () => {
      const sessionId = 'session-123';
      const userId = 'user-123';
      const content = 'What is NestJS?';
      const session = { id: sessionId, userId };
      const aiResponseContent = 'It is a framework for building efficient, scalable Node.js server-side applications.';
      const aiMessage = { id: 'msg-2', content: aiResponseContent, isUserMessage: false };

      mockPrismaService.chatSession.findUnique.mockResolvedValue(session);
      mockAiService.getTutorResponse.mockResolvedValue(aiResponseContent);
      mockPrismaService.chatMessage.create.mockResolvedValueOnce({ id: 'msg-1', content, isUserMessage: true }); // User message
      mockPrismaService.chatMessage.create.mockResolvedValueOnce(aiMessage); // AI message

      const result = await service.addMessage(sessionId, userId, content);

      expect(mockPrismaService.chatMessage.create).toHaveBeenCalledTimes(2);
      expect(mockAiService.getTutorResponse).toHaveBeenCalledWith(content, expect.any(String));
      expect(result).toEqual(aiMessage);
    });

    it('should throw UnauthorizedException if user does not own the session', async () => {
        const session = { id: 'session-123', userId: 'another-user' };
        mockPrismaService.chatSession.findUnique.mockResolvedValue(session);
        await expect(service.addMessage('session-123', 'user-123', 'test')).rejects.toThrow(UnauthorizedException);
      });
  });
});
