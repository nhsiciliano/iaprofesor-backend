import { Module } from '@nestjs/common';
import { LearningPathsController, UserLearningPathsController } from './learning-paths.controller';
import { LearningPathsService } from './learning-paths.service';
import { PassportModule } from '@nestjs/passport';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule, PassportModule.register({ defaultStrategy: 'jwt' })],
  controllers: [LearningPathsController, UserLearningPathsController],
  providers: [LearningPathsService],
})
export class LearningPathsModule {}
