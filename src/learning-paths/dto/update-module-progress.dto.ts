import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsNumber, IsOptional, Max, Min } from 'class-validator';

export class UpdateModuleProgressDto {
  @ApiProperty({ description: 'Porcentaje de progreso del modulo', minimum: 0, maximum: 100 })
  @IsNumber()
  @Min(0)
  @Max(100)
  progress: number;

  @ApiPropertyOptional({ description: 'Tiempo invertido en segundos para este intento', minimum: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  timeSpent?: number;

  @ApiPropertyOptional({ description: 'Puntaje obtenido (0-100)', minimum: 0, maximum: 100 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  score?: number;
}
