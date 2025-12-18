import pino from 'pino';

export const logger = pino({
    level: process.env.LOG_LEVEL || 'info',
    formatters: {
        level: (label) => ({ level: label }),
    },
    transport: process.env.NODE_ENV !== 'production'
        ? { target: 'pino-pretty', options: { colorize: true } }
        : undefined,
    base: { pid: process.pid, service: 'waybills-backend' },
    serializers: {
        err: pino.stdSerializers.err,
    },
});

// Child logger factory for specific modules
export function createModuleLogger(moduleName: string) {
    return logger.child({ module: moduleName });
}
