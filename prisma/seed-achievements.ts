import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const achievements = [
        {
            title: 'Primera sesión',
            description: 'Completa tu primera sesión de tutoría',
            icon: 'IconTrophy',
            type: 'milestone',
            category: 'engagement',
            rarity: 'common',
            requirements: { sessions_count: 1 },
            points: 10,
        },
        {
            title: 'Racha de 7 días',
            description: 'Estudia durante 7 días consecutivos',
            icon: 'IconFlame',
            type: 'streak',
            category: 'consistency',
            rarity: 'rare',
            requirements: { streak_days: 7 },
            points: 50,
        },
        {
            title: '100 preguntas',
            description: 'Realiza 100 preguntas al tutor',
            icon: 'IconMessage',
            type: 'milestone',
            category: 'learning',
            rarity: 'uncommon',
            requirements: { messages_count: 100 },
            points: 30,
        },
    ];

    console.log('Seeding achievements...');

    for (const achievement of achievements) {
        // Check if duplicate exists to avoid double seeding if run multiple times
        const existing = await prisma.achievement.findFirst({
            where: { title: achievement.title }
        });

        if (!existing) {
            const result = await prisma.achievement.create({
                data: achievement,
            });
            console.log(`Created achievement: ${result.title}`);
        } else {
            console.log(`Achievement already exists: ${achievement.title}`);
        }
    }

    console.log('Seeding completed.');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
