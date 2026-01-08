import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString } from 'class-validator';

export class CreateUserProfileDto {
  @ApiProperty({ description: 'User ID from Supabase' })
  @IsString()
  @IsNotEmpty()
  userId: string;

  @ApiProperty({ description: 'User email' })
  @IsEmail()
  email: string;

  @ApiProperty({ description: 'User full name' })
  @IsString()
  @IsNotEmpty()
  fullName: string;
}
