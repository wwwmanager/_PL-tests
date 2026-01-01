import { Request, Response, NextFunction } from 'express';
import * as routeService from '../services/routeService';

/**
 * List all routes
 */
export async function listRoutes(req: Request, res: Response, next: NextFunction) {
    try {
        const user = req.user;
        const routes = await routeService.listRoutes();

        // RLS-ROUTE-010: Drivers get read-only access to route directory
        const isDriver = user?.role === 'driver';
        const routesWithAccess = routes.map((route: any) => ({
            ...route,
            _canEdit: !isDriver  // Drivers cannot edit global routes
        }));

        res.json({ data: routesWithAccess });
    } catch (err) {
        next(err);
    }
}

/**
 * Get route by ID
 */
export async function getRouteById(req: Request, res: Response, next: NextFunction) {
    try {
        const { id } = req.params;

        const route = await routeService.getRouteById(id);

        if (!route) {
            return res.status(404).json({ error: 'Route not found' });
        }

        res.json({ data: route });
    } catch (err) {
        next(err);
    }
}

/**
 * Create new route
 */
export async function createRoute(req: Request, res: Response, next: NextFunction) {
    try {
        const { name, startPoint, endPoint, distance, estimatedTime } = req.body;

        const route = await routeService.createRoute({
            name,
            startPoint,
            endPoint,
            distance: distance != null ? parseFloat(distance) : null,
            estimatedTime: estimatedTime != null ? parseInt(estimatedTime, 10) : null
        });

        res.status(201).json({ data: route });
    } catch (err) {
        next(err);
    }
}

/**
 * Update route
 */
export async function updateRoute(req: Request, res: Response, next: NextFunction) {
    try {
        const { id } = req.params;
        const { name, startPoint, endPoint, distance, estimatedTime } = req.body;

        const route = await routeService.updateRoute(id, {
            name,
            startPoint,
            endPoint,
            distance: distance != null ? parseFloat(distance) : null,
            estimatedTime: estimatedTime != null ? parseInt(estimatedTime, 10) : null
        });

        res.json({ data: route });
    } catch (err) {
        next(err);
    }
}

/**
 * Delete route
 */
export async function deleteRoute(req: Request, res: Response, next: NextFunction) {
    try {
        const { id } = req.params;

        await routeService.deleteRoute(id);

        res.json({ message: 'Route deleted successfully' });
    } catch (err) {
        next(err);
    }
}
