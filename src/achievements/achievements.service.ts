import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Achievement, Prisma, UserAchievement } from '@prisma/client';

type AchievementStatus = 'completed' | 'in_progress' | 'locked';

@Injectable()
export class AchievementsService {
  constructor(private readonly prisma: PrismaService) {}

  async getCatalog(filters?: { category?: string; rarity?: string }): Promise<Achievement[]> {
    const where: Prisma.AchievementWhereInput = {};
    if (filters?.category) {
      where.category = filters.category;
    }
    if (filters?.rarity) {
      where.rarity = filters.rarity;
    }

    return this.prisma.achievement.findMany({
      where,
      orderBy: { createdAt: 'asc' },
    });
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
          ...userAchievement,
          status: this.resolveStatus(userAchievement),
        };
      }

      return {
        id: `virtual-${achievement.id}`,
        userId,
        achievementId: achievement.id,
        achievement,
        isCompleted: false,
        progress: 0,
        unlockedAt: null,
        completedAt: null,
        status: 'locked' as AchievementStatus,
      };
    });

    return status ? records.filter((record) => record.status === status) : records;
  }

  async getRecentAchievements(userId: string, limit = 5) {
    return this.prisma.userAchievement.findMany({
      where: { userId, isCompleted: true },
      include: { achievement: true },
      orderBy: { completedAt: 'desc' },
      take: limit,
    });
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

    // Placeholder: persistencia futura para estado de notificación
    return { success: true, notifiedAt: new Date().toISOString() };
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
