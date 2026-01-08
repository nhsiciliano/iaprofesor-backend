
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const email = process.argv[2];
    if (!email) {
        console.error('Please provide an email address as an argument.');
        process.exit(1);
    }

    try {
        const user = await prisma.user.update({
            where: { email },
            data: { role: 'admin' },
        });
        console.log(`User ${email} promoted to admin successfully.`);
        console.log(user);
    } catch (error) {
        console.error(`Failed to promote user ${email}:`, error);
    } finally {
        await prisma.$disconnect();
    }
}

main();
