/**
 * Seed script for blank permissions
 * 
 * Adds permissions: blank.read, blank.create, blank.update, blank.delete, blank.issue
 * Assigns them to admin and dispatcher roles
 * 
 * Run: npx ts-node scripts/seed-blank-permissions.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const BLANK_PERMISSIONS = [
    { code: 'blank.read', description: 'Просмотр бланков и пачек' },
    { code: 'blank.create', description: 'Создание пачек бланков' },
    { code: 'blank.update', description: 'Редактирование бланков' },
    { code: 'blank.delete', description: 'Удаление бланков' },
    { code: 'blank.issue', description: 'Выдача бланков водителям' },
    { code: 'blank.materialize', description: 'Создание бланков из пачки' },
];

// Roles that should have blank permissions
const ROLE_PERMISSIONS: Record<string, string[]> = {
    'admin': ['blank.read', 'blank.create', 'blank.update', 'blank.delete', 'blank.issue', 'blank.materialize'],
    'dispatcher': ['blank.read', 'blank.create', 'blank.issue', 'blank.materialize'],
    'accountant': ['blank.read'],
    'driver': ['blank.read'],
};

async function seed() {
    console.log('Seeding blank permissions...\n');

    // 1. Create permissions if they don't exist
    for (const perm of BLANK_PERMISSIONS) {
        const existing = await prisma.permission.findUnique({
            where: { code: perm.code }
        });

        if (existing) {
            console.log(`  ✓ Permission ${perm.code} already exists`);
        } else {
            await prisma.permission.create({
                data: perm
            });
            console.log(`  + Created permission: ${perm.code}`);
        }
    }

    console.log('');

    // 2. Get all roles
    const roles = await prisma.role.findMany();

    // 3. Assign permissions to roles
    for (const role of roles) {
        const permsForRole = ROLE_PERMISSIONS[role.code] || [];

        if (permsForRole.length === 0) {
            console.log(`  ⊘ No blank permissions for role: ${role.code}`);
            continue;
        }

        for (const permCode of permsForRole) {
            const permission = await prisma.permission.findUnique({
                where: { code: permCode }
            });

            if (!permission) {
                console.log(`  ⚠ Permission ${permCode} not found`);
                continue;
            }

            // Check if already assigned
            const existing = await prisma.rolePermission.findUnique({
                where: {
                    roleId_permissionId: {
                        roleId: role.id,
                        permissionId: permission.id
                    }
                }
            });

            if (existing) {
                console.log(`  ✓ ${role.code} already has ${permCode}`);
            } else {
                await prisma.rolePermission.create({
                    data: {
                        roleId: role.id,
                        permissionId: permission.id
                    }
                });
                console.log(`  + Assigned ${permCode} to ${role.code}`);
            }
        }
    }

    console.log('\n═══════════════════════════════════════════');
    console.log('Blank permission seeding completed ✅');
    console.log('═══════════════════════════════════════════');
}

seed()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
