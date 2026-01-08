import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { PrismaModule } from './prisma/prisma.module';
import { TutorModule } from './tutor/tutor.module';
import { AiModule } from './ai/ai.module';
import { AchievementsModule } from './achievements/achievements.module';
import { LearningPathsModule } from './learning-paths/learning-paths.module';
import { AdminModule } from './admin/admin.module';
import { NotesModule } from './notes/notes.module';
import { GamificationModule } from './gamification/gamification.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    // Rate limiting: 100 requests per 60 seconds globally
    ThrottlerModule.forRoot([
      {
        name: 'default',
        ttl: 60000, // 60 seconds in milliseconds
        limit: 100,
      },
    ]),
    AuthModule,
    UsersModule,
    PrismaModule,
    TutorModule,
    AiModule,
    AchievementsModule,
    LearningPathsModule,
    AdminModule,
    NotesModule,
    GamificationModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule { }

