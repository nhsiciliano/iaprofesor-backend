import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';
import { GoalStatus } from './create-goal.dto';

export class UpdateGoalStatusDto {
  @ApiProperty({
    description: 'Nuevo estado del objetivo',
    enum: GoalStatus,
    example: GoalStatus.ACTIVE,
  })
  @IsEnum(GoalStatus)
  status: GoalStatus;
}
