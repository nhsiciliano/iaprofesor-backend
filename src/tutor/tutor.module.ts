import { Module } from '@nestjs/common';
import { TutorService } from './tutor.service';
import { TutorController } from './tutor.controller';
import { AiModule } from '../ai/ai.module';
import { PrismaModule } from '../prisma/prisma.module';
import { PassportModule } from '@nestjs/passport';
import { GamificationModule } from '../gamification/gamification.module';

@Module({
  imports: [AiModule, PrismaModule, PassportModule.register({ defaultStrategy: 'jwt' }), GamificationModule],
  providers: [TutorService],
  controllers: [TutorController],
  exports: [TutorService],
})
export class TutorModule { }