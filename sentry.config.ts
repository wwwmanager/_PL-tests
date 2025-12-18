import * as Sentry from '@sentry/react';

/**
 * Initialize Sentry for frontend error monitoring.
 * Only active in production mode with valid DSN.
 */
export function initSentry() {
    const dsn = import.meta.env.VITE_SENTRY_DSN;

    if (import.meta.env.PROD && dsn) {
        Sentry.init({
            dsn,
            environment: import.meta.env.MODE,
            integrations: [
                Sentry.browserTracingIntegration(),
                Sentry.replayIntegration({
                    maskAllText: false,
                    blockAllMedia: false,
                }),
            ],
            // Performance monitoring
            tracesSampleRate: 0.1, // 10% of transactions
            // Session replay
            replaysSessionSampleRate: 0.1, // 10% of sessions
            replaysOnErrorSampleRate: 1.0, // 100% on error
        });

        console.log('Sentry initialized');
    } else if (import.meta.env.DEV) {
        console.log('Sentry disabled in development mode');
    }
}

// Re-export Sentry for use in components
export { Sentry };
