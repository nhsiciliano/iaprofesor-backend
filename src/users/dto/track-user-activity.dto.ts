import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsObject, IsOptional, IsString, MaxLength } from 'class-validator';

export class TrackUserActivityDto {
  @ApiProperty({ description: 'Tipo de actividad', example: 'dashboard_view' })
  @IsString()
  @MaxLength(100)
  activityType: string;

  @ApiPropertyOptional({
    description: 'Contexto adicional de la actividad',
    example: { source: 'dashboard', section: 'progress' },
  })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}
