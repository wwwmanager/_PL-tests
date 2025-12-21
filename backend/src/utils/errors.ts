export class AppError extends Error {
    statusCode: number;
    code?: string;

    constructor(message: string, statusCode = 500, code?: string) {
        super(message);
        this.statusCode = statusCode;
        this.code = code;
    }
}

export class UnauthorizedError extends AppError {
    constructor(message = 'Unauthorized') {
        super(message, 401, 'UNAUTHORIZED');
    }
}

export class BadRequestError extends AppError {
    constructor(message = 'Bad request', code = 'BAD_REQUEST') {
        super(message, 400, code);
    }
}

export class NotFoundError extends AppError {
    constructor(message = 'Not found') {
        super(message, 404, 'NOT_FOUND');
    }
}

export class ForbiddenError extends AppError {
    constructor(message = 'Forbidden') {
        super(message, 403, 'FORBIDDEN');
    }
}

/**
 * BE-004: 409 Conflict - for unique constraint violations and state conflicts
 */
export class ConflictError extends AppError {
    constructor(message = 'Conflict', code = 'CONFLICT') {
        super(message, 409, code);
    }
}

