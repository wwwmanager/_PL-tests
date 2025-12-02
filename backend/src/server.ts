// Backend server - Prisma only
import { createApp } from './app';
import { env } from './config/env';
// import { AppDataSource } from './db/data-source'; // DISABLED: Using Prisma instead

async function bootstrap() {
    try {
        // TypeORM DISABLED - Using Prisma for database access
        // await AppDataSource.initialize();
        console.log('✅ Database: Prisma');
        console.log(`📊 Database URL: ${env.DATABASE_URL.split('@')[1]?.split('/')[0] || 'PostgreSQL'}`);

        const app = createApp();

        // Graceful shutdown
        process.on('SIGINT', async () => {
            console.log('Shutting down gracefully...');
            // await AppDataSource.destroy(); // DISABLED
            process.exit(0);
        });

        process.on('SIGTERM', async () => {
            console.log('Shutting down gracefully...');
            // await AppDataSource.destroy(); // DISABLED
            process.exit(0);
        });

        app.listen(env.PORT, () => {
            console.log(`🚀 Backend running on http://localhost:${env.PORT}`);
            console.log(`📊 Environment: ${env.NODE_ENV}`);
            console.log(`🔗 API endpoints available at http://localhost:${env.PORT}/api`);
            console.log(`❤️  Health check: http://localhost:${env.PORT}/api/health`);
        });
    } catch (error) {
        console.error('❌ Failed to start server:', error);
        process.exit(1);
    }
}

bootstrap();
