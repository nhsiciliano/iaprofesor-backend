import { Module } from '@nestjs/common';
import { LevelingService } from './leveling.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
    imports: [PrismaModule],
    providers: [LevelingService],
    exports: [LevelingService],
})
export class GamificationModule { }
