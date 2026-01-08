import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class UpdateUserDto {
  @ApiProperty({
    description: "The user's display name",
    example: 'John Doe',
    required: false,
  })
  @IsOptional()
  @IsString()
  readonly displayName?: string;

  @ApiProperty({
    description: "The user's full name",
    example: 'John Doe',
    required: false,
  })
  @IsOptional()
  @IsString()
  readonly fullName?: string;
}
