
import { httpClient } from './services/httpClient';

// Mock browser environment
global.localStorage = {
    getItem: () => 'valid-token', // We can't easily mock the token here without login
    setItem: () => { },
    removeItem: () => { },
} as any;

// Actually, it's better to just run the backend code directly via a script that imports the service
// because replicating the full HTTP stack with auth in a script is hard.
// But the service logging will tell us the DB query.

import { PrismaClient } from '@prisma/client';
import * as employeeService from './backend/src/services/employeeService';

const prisma = new PrismaClient();

async function main() {
    console.log('--- Simulating Service Call ---');
    const orgId = '9f8f0970-34fa-49d9-a507-b4177f2bab0b'; // Минсельхоз ЧО

    // Call service directly
    const result = await employeeService.getEmployees({
        organizationId: orgId,
        isActive: true
    });

    console.log('Result count:', result.employees.length);
    result.employees.forEach(e => console.log(` - ${e.fullName} (${e.organizationId})`));
}

main().catch(console.error).finally(() => prisma.$disconnect());
