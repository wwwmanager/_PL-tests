import express from 'express';
import cors from 'cors';
import { router as apiRouter } from './routes';
import { errorMiddleware } from './middleware/errorMiddleware';
import { loggerMiddleware, correlationIdMiddleware } from './middleware/loggerMiddleware';

export const createApp = () => {
    const app = express();

    // CORS configuration
    app.use(cors({
        origin: process.env.CORS_ORIGIN || '*',
        credentials: true
    }));

    // Correlation ID (must be before logger)
    app.use(correlationIdMiddleware);

    // Request logging
    app.use(loggerMiddleware);

    // Body parsing
    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));

    // API routes
    app.use('/api', apiRouter);

    // Error handling (must be last)
    app.use(errorMiddleware);

    return app;
};
