// Quick database creation script
import { Client } from 'pg';

async function createDatabase() {
    const client = new Client({
        host: 'localhost',
        port: 5432,
        user: 'postgres',
        password: 'postgres',
        database: 'postgres' // Connect to default postgres database
    });

    try {
        await client.connect();
        console.log('✅ Connected to PostgreSQL');

        // Check if database exists
        const result = await client.query(
            "SELECT 1 FROM pg_database WHERE datname = 'waybills'"
        );

        if (result.rows.length === 0) {
            await client.query('CREATE DATABASE waybills');
            console.log('✅ Database "waybills" created successfully');
        } else {
            console.log('✅ Database "waybills" already exists');
        }

        await client.end();
        process.exit(0);
    } catch (error: any) {
        console.error('❌ Error:', error.message);
        await client.end();
        process.exit(1);
    }
}

createDatabase();
