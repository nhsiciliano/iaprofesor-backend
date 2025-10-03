import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsEnum, IsInt, IsNotEmpty, IsOptional, IsPositive, IsString, MaxLength } from 'class-validator';

export enum GoalPriority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

export enum GoalStatus {
  ACTIVE = 'active',
  PAUSED = 'paused',
  COMPLETED = 'completed',
  EXPIRED = 'expired',
  CANCELLED = 'cancelled',
}

export enum GoalType {
  DAILY_SESSIONS = 'daily_sessions',
  WEEKLY_SESSIONS = 'weekly_sessions',
  MONTHLY_SESSIONS = 'monthly_sessions',
  TOTAL_MESSAGES = 'total_messages',
  CONCEPTS_LEARNED = 'concepts_learned',
  STUDY_TIME = 'study_time',
  STREAK_DAYS = 'streak_days',
  SKILL_LEVEL = 'skill_level',
  SUBJECT_MASTERY = 'subject_mastery',
  CUSTOM = 'custom',
}

export class CreateGoalDto {
  @ApiProperty({ description: 'Título del objetivo', example: 'Completar 5 sesiones esta semana' })
  @IsString()
  @MaxLength(120)
  @IsNotEmpty()
  title: string;

  @ApiProperty({ description: 'Descripción del objetivo', example: 'Mantener una rutina de estudio constante' })
  @IsString()
  @MaxLength(500)
  @IsNotEmpty()
  description: string;

  @ApiProperty({
    description: 'Tipo de objetivo',
    example: GoalType.WEEKLY_SESSIONS,
    enum: GoalType,
    default: GoalType.CUSTOM,
  })
  @IsEnum(GoalType)
  type: GoalType;

  @ApiProperty({ description: 'Valor objetivo numérico', example: 5 })
  @IsInt()
  @IsPositive()
  targetValue: number;

  @ApiPropertyOptional({ description: 'Materia asociada', example: 'mathematics' })
  @IsOptional()
  @IsString()
  subject?: string;

  @ApiPropertyOptional({
    description: 'Prioridad del objetivo',
    enum: GoalPriority,
    default: GoalPriority.MEDIUM,
  })
  @IsOptional()
  @IsEnum(GoalPriority)
  priority?: GoalPriority;

  @ApiPropertyOptional({ description: 'Fecha límite en formato ISO', example: '2024-12-31T23:59:59.000Z' })
  @IsOptional()
  @IsDateString()
  deadline?: string;

  @ApiPropertyOptional({
    description: 'Estado inicial del objetivo',
    enum: GoalStatus,
    default: GoalStatus.ACTIVE,
  })
  @IsOptional()
  @IsEnum(GoalStatus)
  status?: GoalStatus;
}
