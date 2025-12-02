import 'dotenv/config';

function requireEnv(name: string): string {
    const value = process.env[name];
    if (!value) throw new Error(`Missing env var: ${name}`);
    return value;
}

export const env = {
    NODE_ENV: process.env.NODE_ENV ?? 'development',
    PORT: parseInt(process.env.PORT ?? '3000', 10),
    DATABASE_URL: requireEnv('DATABASE_URL'),
    JWT_SECRET: requireEnv('JWT_SECRET'),
    JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN ?? '4h' // Increased for dev/verification
};
