import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, IsIn } from 'class-validator';

export class CreateSessionDto {
  @ApiProperty({
    description: 'The subject for the tutoring session',
    example: 'mathematics',
    enum: [
      'mathematics',
      'history',
      'grammar',
      'science',
      'physics',
      'chemistry',
      'biology',
      'philosophy',
      'literature',
      'geography',
      'programming',
      'accounting',
      'finance'
    ],
    required: false,
  })
  @IsOptional()
  @IsString()
  @IsIn([
    'mathematics',
    'history',
    'grammar',
    'science',
    'physics',
    'chemistry',
    'biology',
    'philosophy',
    'literature',
    'geography',
    'programming',
    'accounting',
    'finance'
  ])
  subject?: string;

  @ApiProperty({
    description: 'Optional title for the session',
    example: 'Algebra session',
    required: false,
  })
  @IsOptional()
  @IsString()
  title?: string;
}