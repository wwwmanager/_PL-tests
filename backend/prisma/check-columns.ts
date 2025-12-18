import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkColumns() {
    try {
        // Check employees table columns
        const employeeCols = await prisma.$queryRaw`
      SELECT column_name FROM information_schema.columns 
      WHERE table_name = 'employees' 
      ORDER BY ordinal_position
    `;
        console.log('Employees columns:', employeeCols);

        // Check users table columns  
        const userCols = await prisma.$queryRaw`
      SELECT column_name FROM information_schema.columns 
      WHERE table_name = 'users' 
      ORDER BY ordinal_position
    `;
        console.log('\nUsers columns:', userCols);

        // Check drivers table columns
        const driverCols = await prisma.$queryRaw`
      SELECT column_name FROM information_schema.columns 
      WHERE table_name = 'drivers' 
      ORDER BY ordinal_position
    `;
        console.log('\nDrivers columns:', driverCols);

    } catch (err) {
        console.error('Error:', err);
    }
}

checkColumns().finally(() => prisma.$disconnect());
