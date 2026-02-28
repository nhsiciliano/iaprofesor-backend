import { ApiProperty } from '@nestjs/swagger';
import { IsInt, Min } from 'class-validator';

export class UpdateSessionDurationDto {
  @ApiProperty({
    description: 'Duracion total de la sesion en segundos',
    example: 420,
    minimum: 0,
  })
  @IsInt()
  @Min(0)
  durationSeconds: number;
}
