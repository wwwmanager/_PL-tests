import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
    const email = 'admin@waybills.local';
    const newPassword = '123';

    console.log(`🔍 Checking for user: ${email}...`);

    const user = await prisma.user.findUnique({ where: { email } });

    if (!user) {
        console.error(`❌ User ${email} NOT FOUND!`);
        // We could try to recreate it, but let's confirm first.
        return;
    }

    console.log(`✅ User found (ID: ${user.id}). Resetting password...`);

    const passwordHash = await bcrypt.hash(newPassword, 10);

    await prisma.user.update({
        where: { id: user.id },
        data: {
            passwordHash,
            isActive: true // Ensure active
        }
    });

    console.log(`✅ Password for ${email} has been reset to: ${newPassword}`);
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
