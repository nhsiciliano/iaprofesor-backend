import {
  Controller,
  Post,
  Body,
  UseGuards,
  Req,
  Get,
  Param,
  Query,
} from '@nestjs/common';
import { TutorService } from './tutor.service';
import { AuthGuard } from '@nestjs/passport';
import { CreateMessageDto } from './dto/create-message.dto';
import { CreateSessionDto } from './dto/create-session.dto';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse, ApiParam, ApiQuery } from '@nestjs/swagger';

@ApiTags('tutor')
@ApiBearerAuth()
@Controller('tutor')
@UseGuards(AuthGuard())
export class TutorController {
  constructor(private readonly tutorService: TutorService) {}

  @Post('sessions')
  @ApiOperation({ summary: 'Create a new chat session with optional subject' })
  @ApiResponse({ status: 201, description: 'Chat session created successfully.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  async createChatSession(@Req() req, @Body() createSessionDto?: CreateSessionDto) {
    const userId = req.user.sub;
    const subject = createSessionDto?.subject;
    return this.tutorService.createChatSession(userId, subject);
  }

  @Get('subjects')
  @ApiOperation({ summary: 'Get available subjects for tutoring' })
  @ApiResponse({ status: 200, description: 'Return available subjects.' })
  async getAvailableSubjects() {
    return this.tutorService.getAvailableSubjects();
  }

  @Get('sessions')
  @ApiOperation({ summary: 'Get user chat sessions' })
  @ApiQuery({ name: 'subject', required: false, description: 'Filter by subject' })
  @ApiResponse({ status: 200, description: 'Return user sessions.' })
  async getUserSessions(@Req() req, @Query('subject') subject?: string) {
    const userId = req.user.sub;
    return this.tutorService.getUserSessions(userId, subject);
  }

  @Get('progress/:subject')
  @ApiOperation({ summary: 'Get user progress by subject' })
  @ApiParam({ name: 'subject', description: 'Subject name' })
  @ApiResponse({ status: 200, description: 'Return user progress data.' })
  async getSubjectProgress(@Req() req, @Param('subject') subject: string) {
    const userId = req.user.sub;
    return this.tutorService.getSubjectProgressBySubject(userId, subject);
  }

  @Get('sessions/:id/messages')
  @ApiOperation({ summary: 'Get all messages from a chat session' })
  @ApiParam({ name: 'id', description: 'The ID of the chat session' })
  @ApiResponse({ status: 200, description: 'Return all messages.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 404, description: 'Chat session not found.' })
  async getMessages(@Param('id') sessionId: string, @Req() req) {
    const userId = req.user.sub;
    return this.tutorService.getMessages(sessionId, userId);
  }

  @Post('sessions/:id/messages')
  @ApiOperation({ summary: 'Add a message to a chat session' })
  @ApiParam({ name: 'id', description: 'The ID of the chat session' })
  @ApiResponse({ 
    status: 201, 
    description: 'Message added successfully with AI response.',
    schema: {
      type: 'object',
      properties: {
        userMessage: {
          type: 'object',
          description: 'The user message that was saved'
        },
        assistantMessage: {
          type: 'object', 
          description: 'The AI tutor response'
        }
      }
    }
  })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 404, description: 'Chat session not found.' })
  async addMessage(
    @Param('id') sessionId: string,
    @Req() req,
    @Body() createMessageDto: CreateMessageDto,
  ) {
    const userId = req.user.sub;
    const { content } = createMessageDto;
    return this.tutorService.addMessage(sessionId, userId, content);
  }

  @Post('sessions/:id/duration')
  @ApiOperation({ summary: 'Update session duration for time tracking' })
  @ApiParam({ name: 'id', description: 'The ID of the chat session' })
  @ApiResponse({ status: 200, description: 'Session duration updated successfully.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 404, description: 'Chat session not found.' })
  async updateSessionDuration(
    @Param('id') sessionId: string,
    @Req() req,
    @Body() durationDto: { durationSeconds: number },
  ) {
    const userId = req.user.sub;
    return this.tutorService.updateSessionDuration(sessionId, userId, durationDto.durationSeconds);
  }
}
