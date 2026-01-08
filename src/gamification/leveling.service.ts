import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface XpAwardResult {
    previousXp: number;
    currentXp: number;
    previousLevel: number;
    currentLevel: number;
    leveledUp: boolean;
}

@Injectable()
export class LevelingService {
    constructor(private prisma: PrismaService) { }

    /**
     * Calculates the level based on total XP using the formula:
     * Level = floor((XP / 100) ^ (1/1.5))
     * Or conversely XP(level) = 100 * level^1.5
     */
    calculateLevel(xp: number): number {
        // Base level 1 requires 0 XP
        // Level 2 requires 100 XP (approx)
        // Formula: level = (xp / 100)^(1/1.5)
        // We assume level starts at 1
        if (xp < 0) return 1;
        let level = Math.floor(Math.pow(xp / 100, 1 / 1.5));
        return Math.max(1, level);
    }

    /**
     * Calculates XP required to reach specific level
     */
    xpForLevel(level: number): number {
        if (level <= 1) {
            return 0;
        }
        return Math.floor(100 * Math.pow(level, 1.5));
    }

    /**
     * Awards XP to a user for a specific subject
     */
    async awardXp(userId: string, subjectId: string, amount: number): Promise<XpAwardResult> {
        // 1. Get current progress
        const progress = await this.prisma.subjectProgress.findUnique({
            where: {
                userId_subject: {
                    userId,
                    subject: subjectId,
                },
            },
        });

        if (!progress) {
            // Create new progress if not exists (should usually exist by this point in flow, but safety check)
            const newProgress = await this.prisma.subjectProgress.create({
                data: {
                    userId,
                    subject: subjectId,
                    xp: amount,
                    level: this.calculateLevel(amount),
                },
            });

            return {
                previousXp: 0,
                currentXp: newProgress.xp,
                previousLevel: 1,
                currentLevel: newProgress.level,
                leveledUp: newProgress.level > 1,
            };
        }

        const previousXp = progress.xp;
        const previousLevel = progress.level;
        const currentXp = previousXp + amount;

        // Calculate new level
        // We calculate "potential" level from formula, but typically games explicitly check 
        // if currentXP >= requiredForNextLevel to prevent skipping or handle milestones
        // Simplified approach: Calculate level from total XP using the formula
        const calculatedLevel = this.calculateLevel(currentXp);

        // Check if new level is higher than stored level (prevents level down if formula changes, generally good practice)
        const currentLevel = Math.max(calculatedLevel, previousLevel);
        const leveledUp = currentLevel > previousLevel;

        // 2. Update DB
        await this.prisma.subjectProgress.update({
            where: { id: progress.id },
            data: {
                xp: currentXp,
                level: currentLevel,
            },
        });

        return {
            previousXp,
            currentXp,
            previousLevel,
            currentLevel,
            leveledUp,
        };
    }
}
