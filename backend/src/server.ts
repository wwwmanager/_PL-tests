// Backend server - Prisma only
import { createApp } from './app';
import { env } from './config/env';
import { logger } from './utils/logger';
import { ensureAdminExists } from './services/authService';
import { startSchedulers, stopSchedulers } from './jobs/scheduler';

async function bootstrap() {
    try {
        logger.info({ database: 'Prisma' }, 'Database initialized');
        logger.info({ url: env.DATABASE_URL.split('@')[1]?.split('/')[0] || 'PostgreSQL' }, 'Database connection');

        // Ensure system admin exists (auto-restore if deleted)
        await ensureAdminExists();

        const app = createApp();

        // Graceful shutdown
        process.on('SIGINT', async () => {
            logger.info('Shutting down gracefully (SIGINT)...');
            stopSchedulers();
            process.exit(0);
        });

        process.on('SIGTERM', async () => {
            logger.info('Shutting down gracefully (SIGTERM)...');
            stopSchedulers();
            process.exit(0);
        });

        const server = app.listen(env.PORT, () => {
            logger.info({ port: env.PORT, env: env.NODE_ENV }, '🚀 Backend server started');
            logger.info({ healthCheck: `http://localhost:${env.PORT}/api/health` }, 'Endpoints available');

            // Start background job schedulers
            startSchedulers();
        });

        // Handle port already in use
        server.on('error', (err: NodeJS.ErrnoException) => {
            if (err.code === 'EADDRINUSE') {
                logger.fatal({ port: env.PORT }, `❌ Port ${env.PORT} is already in use. Please check for zombie Node processes: taskkill /F /IM node.exe`);
                process.exit(1);
            } else {
                logger.fatal({ err }, '❌ Server error');
                process.exit(1);
            }
        });
    } catch (error) {
        logger.fatal({ err: error }, '❌ Failed to start server');
        process.exit(1);
    }
}

bootstrap();

