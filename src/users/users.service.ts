import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Goal, Prisma, User } from '@prisma/client';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { UpdateUserDto } from './dto/update-user.dto';
import { CreateGoalDto, GoalStatus } from './dto/create-goal.dto';
import { UpdateGoalDto } from './dto/update-goal.dto';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async getMe(userId: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { id: userId },
    });
  }

  async updateMe(userId: string, data: UpdateUserDto): Promise<User> {
    return this.prisma.user.update({
      where: { id: userId },
      data,
    });
  }

  async getGoals(userId: string, status?: string, limit?: number): Promise<Goal[]> {
    const where: Prisma.GoalWhereInput = { userId };
    if (status) {
      where.status = status;
    }

    return this.prisma.goal.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit ? Number(limit) : undefined,
    });
  }

  async createGoal(userId: string, payload: CreateGoalDto): Promise<Goal> {
    const {
      status = GoalStatus.ACTIVE,
      priority = 'medium',
      title,
      description,
      type,
      targetValue,
      subject,
      deadline,
    } = payload;

    return this.prisma.goal.create({
      data: {
        userId,
        status,
        priority,
        currentValue: 0,
        title,
        description,
        type,
        targetValue,
        subject,
        deadline,
      },
    });
  }

  async updateGoal(userId: string, goalId: string, updates: UpdateGoalDto): Promise<Goal> {
    await this.ensureGoalOwnership(userId, goalId);
    const data: Prisma.GoalUpdateInput = {};

    if (updates.title !== undefined) data.title = updates.title;
    if (updates.description !== undefined) data.description = updates.description;
    if (updates.priority !== undefined) data.priority = updates.priority;
    if (updates.deadline !== undefined) data.deadline = updates.deadline;
    if (updates.targetValue !== undefined) data.targetValue = updates.targetValue;
    if (updates.subject !== undefined) data.subject = updates.subject;
    if (updates.status !== undefined) data.status = updates.status;
    if (updates.type !== undefined) data.type = updates.type;
    return this.prisma.goal.update({
      where: { id: goalId },
      data,
    });
  }

  async completeGoal(userId: string, goalId: string): Promise<Goal> {
    const goal = await this.ensureGoalOwnership(userId, goalId);

    return this.prisma.goal.update({
      where: { id: goalId },
      data: {
        status: GoalStatus.COMPLETED,
        completedAt: new Date(),
        currentValue: goal.targetValue,
      },
    });
  }

  async toggleGoalStatus(userId: string, goalId: string, status: GoalStatus): Promise<Goal> {
    await this.ensureGoalOwnership(userId, goalId);

    if (![GoalStatus.ACTIVE, GoalStatus.PAUSED].includes(status)) {
      throw new BadRequestException('Sólo se puede cambiar entre estados active y paused');
    }

    return this.prisma.goal.update({
      where: { id: goalId },
      data: { status },
    });
  }

  async deleteGoal(userId: string, goalId: string): Promise<void> {
    await this.ensureGoalOwnership(userId, goalId);
    await this.prisma.goal.delete({
      where: { id: goalId },
    });
  }

  private async ensureGoalOwnership(userId: string, goalId: string) {
    const goal = await this.prisma.goal.findUnique({ where: { id: goalId } });

    if (!goal || goal.userId !== userId) {
      throw new NotFoundException('Goal not found');
    }

    return goal;
  }
}
