import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { router as apiRouter } from './routes';
import { errorMiddleware } from './middleware/errorMiddleware';
import { loggerMiddleware, correlationIdMiddleware } from './middleware/loggerMiddleware';
import { requestIdMiddleware } from './middleware/requestId';

export const createApp = () => {
    const app = express();

    // CORS configuration
    app.use(cors({
        origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
        credentials: true  // Required for cookies
    }));

    // Cookie parsing (required for refresh token in HttpOnly cookie)
    app.use(cookieParser());

    // REL-001: RequestId for tracing/debugging
    app.use(requestIdMiddleware);

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
