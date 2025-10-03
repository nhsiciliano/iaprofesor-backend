import { Module } from '@nestjs/common';
import { UsersService } from './users.service';
import { UsersStatsService } from './users-stats.service';
import { UsersController } from './users.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { PassportModule } from '@nestjs/passport';

@Module({
  imports: [PrismaModule, PassportModule.register({ defaultStrategy: 'jwt' })],
  controllers: [UsersController],
  providers: [UsersService, UsersStatsService],
})
export class UsersModule {}
