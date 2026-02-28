import { Module } from '@nestjs/common';
import { TutorService } from './tutor.service';
import { TutorController } from './tutor.controller';
import { AiModule } from '../ai/ai.module';
import { PrismaModule } from '../prisma/prisma.module';
import { PassportModule } from '@nestjs/passport';
import { GamificationModule } from '../gamification/gamification.module';
import { TutorAnalysisService } from './tutor-analysis.service';
import { TutorMessageService } from './tutor-message.service';
import { TutorProgressService } from './tutor-progress.service';
import { TutorSessionService } from './tutor-session.service';
import { TutorStreamingService } from './tutor-streaming.service';
import { TutorSubjectsService } from './tutor-subjects.service';
import { TutorStreamEventMapper } from './tutor-stream-event.mapper';

@Module({
  imports: [AiModule, PrismaModule, PassportModule.register({ defaultStrategy: 'jwt' }), GamificationModule],
  providers: [
    TutorService,
    TutorAnalysisService,
    TutorMessageService,
    TutorProgressService,
    TutorSessionService,
    TutorStreamingService,
    TutorStreamEventMapper,
    TutorSubjectsService,
  ],
  controllers: [TutorController],
  exports: [TutorService],
})
export class TutorModule {}
