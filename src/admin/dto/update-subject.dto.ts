
import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateSubjectDto {
    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    @MaxLength(120)
    name?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    systemPrompt?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    difficulty?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsBoolean()
    isActive?: boolean;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsArray()
    @IsString({ each: true })
    concepts?: string[];
}
