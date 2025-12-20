import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { router as apiRouter } from './routes';
import { errorMiddleware } from './middleware/errorMiddleware';
import { loggerMiddleware, correlationIdMiddleware } from './middleware/loggerMiddleware';
import { requestIdMiddleware } from './middleware/requestId';

export const createApp = () => {
    const app = express();

    // CORS configuration - support multiple frontend origins
    const allowedOrigins = [
        'http://localhost:5173', // Vite default
        'http://localhost:3000', // Alternative port
        process.env.CORS_ORIGIN, // Custom via env var
    ].filter(Boolean) as string[];

    const corsOptions: cors.CorsOptions = {
        origin: (origin, callback) => {
            // Allow non-browser clients (curl, postman) without Origin header
            if (!origin) {
                return callback(null, true);
            }
            if (allowedOrigins.includes(origin)) {
                return callback(null, true);
            }
            console.warn(`[CORS] Blocked origin: ${origin}`);
            return callback(new Error(`CORS blocked origin: ${origin}`));
        },
        credentials: true, // Required for HttpOnly refresh token cookie
        methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-Id'],
    };

    // Handle preflight OPTIONS requests
    app.options('*', cors(corsOptions));
    app.use(cors(corsOptions));

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
