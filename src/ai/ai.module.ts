import { Module } from '@nestjs/common';
import { AiService } from './ai.service';
import { ConfigModule } from '@nestjs/config';
import { CacheModule } from '@nestjs/cache-manager';

@Module({
  imports: [
    ConfigModule,
    CacheModule.register({
      ttl: 43200000, // 12 hours in milliseconds
      max: 100, // maximum number of items in cache
    }),
  ],
  providers: [AiService],
  exports: [AiService],
})
export class AiModule { }