import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBase64,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';

export class MessageAttachmentDto {
  @ApiProperty({ description: 'File mime type', example: 'image/png' })
  @IsString()
  @IsNotEmpty()
  @IsIn(['image/png', 'image/jpeg', 'image/webp', 'application/pdf'])
  mimeType: string;

  @ApiProperty({ description: 'Base64 file content' })
  @IsString()
  @IsBase64()
  @MaxLength(8_000_000)
  base64: string;

  @ApiProperty({ description: 'Optional file name', required: false, example: 'exercise.png' })
  @IsOptional()
  @IsString()
  fileName?: string;
}

export class CreateMessageDto {
  @ApiProperty({
    description: 'The content of the message',
    example: 'Hello, how can I help you?',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(4000)
  content: string;

  @ApiProperty({
    description: 'Optional array of attachments (images/files)',
    required: false,
    type: [MessageAttachmentDto],
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(5)
  @ValidateNested({ each: true })
  @Type(() => MessageAttachmentDto)
  attachments?: MessageAttachmentDto[];
}
