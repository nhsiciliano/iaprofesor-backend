
import { ApiProperty } from '@nestjs/swagger';

export class UpdateSubjectDto {
    @ApiProperty({ required: false })
    name?: string;

    @ApiProperty({ required: false })
    systemPrompt?: string;

    @ApiProperty({ required: false })
    difficulty?: string;

    @ApiProperty({ required: false })
    isActive?: boolean;

    @ApiProperty({ required: false })
    concepts?: string[];
}
