import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma, User } from '@prisma/client';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { UpdateUserDto } from './dto/update-user.dto';
import { UpdateUserProfileDto } from './dto/update-user-profile.dto';
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
    const updateData: Prisma.UserUpdateInput = {};
    if (data.displayName !== undefined) updateData.fullName = data.displayName;
    if (data.fullName !== undefined) updateData.fullName = data.fullName;

    if (Object.keys(updateData).length === 0) {
      return this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    }

    return this.prisma.user.update({
      where: { id: userId },
      data: updateData,
    });
  }

  async getUserById(requestingUserId: string, userId: string, role?: string): Promise<User | null> {
    if (requestingUserId !== userId && role !== 'admin') {
      throw new NotFoundException('User not found');
    }

    return this.prisma.user.findUnique({
      where: { id: userId },
    });
  }

  async updateUserById(
    requestingUserId: string,
    userId: string,
    role: string | undefined,
    data: UpdateUserDto,
  ): Promise<User> {
    if (requestingUserId !== userId && role !== 'admin') {
      throw new NotFoundException('User not found');
    }

    const updateData: Prisma.UserUpdateInput = {};
    if (data.displayName !== undefined) updateData.fullName = data.displayName;
    if (data.fullName !== undefined) updateData.fullName = data.fullName;

    if (Object.keys(updateData).length === 0) {
      return this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    }

    return this.prisma.user.update({
      where: { id: userId },
      data: updateData,
    });
  }

  async getGoals(userId: string, status?: string, limit?: number) {
    const where: Prisma.GoalWhereInput = { userId };
    if (status) {
      where.status = status;
    }

    return this.prisma.goal.findMany({
      where,
      include: { milestones: { orderBy: { order: 'asc' } } },
      orderBy: { createdAt: 'desc' },
      take: limit ? Number(limit) : undefined,
    });
  }

  async createGoal(userId: string, payload: CreateGoalDto) {
    const {
      status = GoalStatus.ACTIVE,
      priority = 'medium',
      category = 'learning',
      title,
      description,
      type,
      targetValue,
      subject,
      deadline,
      milestones,
    } = payload;

    return this.prisma.goal.create({
      data: {
        userId,
        status,
        priority,
        category,
        currentValue: 0,
        title,
        description,
        type,
        targetValue,
        subject,
        deadline,
        milestones: milestones && milestones.length > 0
          ? {
            create: milestones.map((milestone, index) => ({
              title: milestone.title,
              description: milestone.description,
              targetValue: milestone.targetValue,
              order: milestone.order ?? index + 1,
            })),
          }
          : undefined,
      },
      include: { milestones: { orderBy: { order: 'asc' } } },
    });
  }

  async updateGoal(userId: string, goalId: string, updates: UpdateGoalDto) {
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
    if (updates.category !== undefined) data.category = updates.category;

    if (updates.milestones) {
      data.milestones = {
        deleteMany: {},
        create: updates.milestones.map((milestone, index) => ({
          title: milestone.title,
          description: milestone.description,
          targetValue: milestone.targetValue,
          order: milestone.order ?? index + 1,
        })),
      };
    }

    return this.prisma.goal.update({
      where: { id: goalId },
      data,
      include: { milestones: { orderBy: { order: 'asc' } } },
    });
  }

  async completeGoal(userId: string, goalId: string) {
    const goal = await this.ensureGoalOwnership(userId, goalId);

    return this.prisma.goal.update({
      where: { id: goalId },
      data: {
        status: GoalStatus.COMPLETED,
        completedAt: new Date(),
        currentValue: goal.targetValue,
      },
      include: { milestones: { orderBy: { order: 'asc' } } },
    });
  }

  async toggleGoalStatus(userId: string, goalId: string, status: GoalStatus) {
    await this.ensureGoalOwnership(userId, goalId);

    if (![GoalStatus.ACTIVE, GoalStatus.PAUSED].includes(status)) {
      throw new BadRequestException('Sólo se puede cambiar entre estados active y paused');
    }

    return this.prisma.goal.update({
      where: { id: goalId },
      data: { status },
      include: { milestones: { orderBy: { order: 'asc' } } },
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

  async getUserProfile(userId: string) {
    return this.prisma.userProfile.findUnique({
      where: { userId },
    });
  }

  async upsertUserProfile(userId: string, payload: UpdateUserProfileDto) {
    return this.prisma.userProfile.upsert({
      where: { userId },
      create: {
        userId,
        displayName: payload.displayName,
        bio: payload.bio,
        avatar: payload.avatar,
        preferences: (payload.preferences ?? {}) as Prisma.JsonValue,
      },
      update: {
        displayName: payload.displayName,
        bio: payload.bio,
        avatar: payload.avatar,
        preferences: (payload.preferences ?? {}) as Prisma.JsonValue,
      },
    });
  }
}
