import { Module } from '@nestjs/common';
import { TutorService } from './tutor.service';
import { TutorController } from './tutor.controller';
import { AiModule } from '../ai/ai.module';
import { PrismaModule } from '../prisma/prisma.module';
import { PassportModule } from '@nestjs/passport';

@Module({
  imports: [AiModule, PrismaModule, PassportModule.register({ defaultStrategy: 'jwt' })],
  providers: [TutorService],
  controllers: [TutorController],
})
export class TutorModule {}