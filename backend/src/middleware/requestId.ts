import type { Request, Response, NextFunction } from "express";
import crypto from "crypto";

/**
 * RequestId Middleware
 * Assigns a unique requestId to each request for tracing/debugging.
 * Uses incoming x-request-id header if present, otherwise generates UUID.
 */
export function requestIdMiddleware(req: Request, res: Response, next: NextFunction) {
    const incoming = req.header("x-request-id");
    const requestId = incoming && incoming.trim().length > 0 ? incoming : crypto.randomUUID();
    req.requestId = requestId;

    res.setHeader("X-Request-Id", requestId);
    next();
}

// TypeScript declaration to extend Express Request
declare module "express-serve-static-core" {
    interface Request {
        requestId?: string;
    }
}
