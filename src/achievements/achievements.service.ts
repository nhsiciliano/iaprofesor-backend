import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Achievement, Prisma, UserAchievement } from '@prisma/client';

type AchievementStatus = 'completed' | 'in_progress' | 'locked';

@Injectable()
export class AchievementsService {
  constructor(private readonly prisma: PrismaService) {}

  async getCatalog(filters?: { category?: string; rarity?: string }) {
    const where: Prisma.AchievementWhereInput = {};
    if (filters?.category) {
      where.category = filters.category;
    }
    if (filters?.rarity) {
      where.rarity = filters.rarity;
    }

    const [achievements, unlockCounts] = await Promise.all([
      this.prisma.achievement.findMany({
        where,
        orderBy: { createdAt: 'asc' },
      }),
      this.prisma.userAchievement.groupBy({
        by: ['achievementId'],
        where: { isCompleted: true },
        _count: { _all: true },
      }),
    ]);

    const unlockMap = new Map<string, number>();
    unlockCounts.forEach((entry) => unlockMap.set(entry.achievementId, entry._count._all));

    return achievements.map((achievement) =>
      this.mapAchievement(achievement, unlockMap.get(achievement.id) ?? 0),
    );
  }

  async getUserAchievements(userId: string, status?: AchievementStatus) {
    const [catalog, userEntries] = await Promise.all([
      this.getCatalog(),
      this.prisma.userAchievement.findMany({
        where: { userId },
        include: { achievement: true },
        orderBy: { unlockedAt: 'desc' },
      }),
    ]);

    const userMap = new Map<string, UserAchievement & { achievement: Achievement }>();
    userEntries.forEach((entry) => userMap.set(entry.achievementId, entry));

    const records = catalog.map((achievement) => {
      const userAchievement = userMap.get(achievement.id);

      if (userAchievement) {
        return {
          id: userAchievement.id,
          userId: userAchievement.userId,
          achievementId: userAchievement.achievementId,
          unlockedAt: userAchievement.unlockedAt.toISOString(),
          progress: userAchievement.progress,
          isCompleted: userAchievement.isCompleted,
          completedAt: userAchievement.completedAt?.toISOString(),
          currentValues: userAchievement.currentValues ?? {},
          notificationSent: userAchievement.notificationSent ?? false,
          achievement: this.mapAchievement(userAchievement.achievement, achievement.unlockedCount),
          status: this.resolveStatus(userAchievement),
        };
      }

      return {
        id: `virtual-${achievement.id}`,
        userId,
        achievementId: achievement.id,
        unlockedAt: null,
        progress: 0,
        isCompleted: false,
        completedAt: null,
        currentValues: {},
        notificationSent: false,
        achievement,
        status: 'locked' as AchievementStatus,
      };
    });

    return status ? records.filter((record) => record.status === status) : records;
  }

  async getRecentAchievements(userId: string, limit = 5) {
    const recent = await this.prisma.userAchievement.findMany({
      where: { userId, isCompleted: true },
      include: { achievement: true },
      orderBy: { completedAt: 'desc' },
      take: limit,
    });

    return recent.map((entry) => ({
      id: entry.id,
      userId: entry.userId,
      achievementId: entry.achievementId,
      unlockedAt: entry.unlockedAt.toISOString(),
      progress: entry.progress,
      isCompleted: entry.isCompleted,
      completedAt: entry.completedAt?.toISOString(),
      currentValues: entry.currentValues ?? {},
      notificationSent: entry.notificationSent ?? false,
      achievement: this.mapAchievement(entry.achievement, 0),
      status: this.resolveStatus(entry),
    }));
  }

  async markAchievementNotified(userId: string, achievementId: string) {
    const record = await this.prisma.userAchievement.findUnique({
      where: {
        userId_achievementId: {
          userId,
          achievementId,
        },
      },
    });

    if (!record) {
      throw new NotFoundException('Achievement not found for user');
    }

    await this.prisma.userAchievement.update({
      where: { id: record.id },
      data: { notificationSent: true },
    });

    return { success: true, notifiedAt: new Date().toISOString() };
  }

  private mapAchievement(achievement: Achievement, unlockedCount: number) {
    return {
      id: achievement.id,
      title: achievement.title,
      description: achievement.description,
      type: achievement.type as any,
      category: achievement.category as any,
      rarity: achievement.rarity as any,
      icon: achievement.icon,
      badgeUrl: undefined,
      requirements: this.normalizeArray(achievement.requirements),
      rewards: this.normalizeArray(achievement.rewards),
      isSecret: achievement.isSecret,
      points: achievement.points,
      unlockedCount,
      createdAt: achievement.createdAt.toISOString(),
    };
  }

  private normalizeArray(value: Prisma.JsonValue | null | undefined) {
    if (!value) {
      return [];
    }

    if (Array.isArray(value)) {
      return value;
    }

    if (typeof value === 'object' && value !== null) {
      return [value];
    }

    return [];
  }

  private resolveStatus(entry: UserAchievement): AchievementStatus {
    if (entry.isCompleted) {
      return 'completed';
    }

    if (entry.progress && entry.progress > 0) {
      return 'in_progress';
    }

    return 'locked';
  }
}
