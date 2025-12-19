import { Request, Response, NextFunction } from 'express';
import { ZodTypeAny, ZodError } from 'zod';
import { logger } from '../utils/logger';

/**
 * Middleware to validate request body against a Zod schema
 * @param schema Zod schema to validate against
 */
export const validateDto = (schema: ZodTypeAny) => {
    return async (req: Request, res: Response, next: NextFunction) => {
        try {
            // Validate body
            const validatedData = await schema.parseAsync(req.body);

            // Replace body with validated/transformed data
            req.body = validatedData;

            next();
        } catch (error) {
            if (error instanceof ZodError) {
                logger.warn({
                    path: req.path,
                    method: req.method,
                    errors: error.issues
                }, 'DTO Validation failed');

                return res.status(400).json({
                    success: false,
                    message: 'Validation failed',
                    errors: error.issues.map((err: any) => ({
                        field: err.path.join('.'),
                        message: err.message
                    }))
                });
            }

            next(error);
        }
    };
};
