import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { PrismaModule } from './prisma/prisma.module';
import { TutorModule } from './tutor/tutor.module';
import { AiModule } from './ai/ai.module';
import { AchievementsModule } from './achievements/achievements.module';
import { LearningPathsModule } from './learning-paths/learning-paths.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    AuthModule,
    UsersModule,
    PrismaModule,
    TutorModule,
    AiModule,
    AchievementsModule,
    LearningPathsModule,
  ],
})
export class AppModule {}
