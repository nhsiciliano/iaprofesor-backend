import { IsString, IsArray, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateNoteDto {
    @ApiProperty({ example: 'Recordar estudiar integrales por partes' })
    @IsString()
    content: string;

    @ApiPropertyOptional({ example: ['matemática', 'integrales'], type: [String] })
    @IsOptional()
    @IsArray()
    @IsString({ each: true })
    tags?: string[];

    @ApiPropertyOptional({ example: 'subject-uuid' })
    @IsOptional()
    @IsString()
    subjectId?: string;

    @ApiPropertyOptional({ example: 'session-uuid' })
    @IsOptional()
    @IsString()
    sessionId?: string;
}
