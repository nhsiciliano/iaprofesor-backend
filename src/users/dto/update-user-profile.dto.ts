import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsObject } from 'class-validator';

export class UpdateUserProfileDto {
  @ApiPropertyOptional({ description: 'Display name for the user profile' })
  @IsOptional()
  @IsString()
  displayName?: string;

  @ApiPropertyOptional({ description: 'Short bio or description' })
  @IsOptional()
  @IsString()
  bio?: string;

  @ApiPropertyOptional({ description: 'Avatar URL' })
  @IsOptional()
  @IsString()
  avatar?: string;

  @ApiPropertyOptional({ description: 'User preferences payload (JSON object)' })
  @IsOptional()
  @IsObject()
  preferences?: Record<string, unknown>;
}
