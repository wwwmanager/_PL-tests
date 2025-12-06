import { Request, Response, NextFunction } from 'express';
import * as settingsService from '../services/settingsService';

export async function getAppSettings(req: Request, res: Response, next: NextFunction) {
    try {
        const settings = await settingsService.getAppSettings();
        res.json({ success: true, data: settings });
    } catch (err) {
        next(err);
    }
}

export async function saveAppSettings(req: Request, res: Response, next: NextFunction) {
    try {
        const settings = await settingsService.saveAppSettings(req.body);
        res.json({ success: true, data: settings });
    } catch (err) {
        next(err);
    }
}

export async function getSeasonSettings(req: Request, res: Response, next: NextFunction) {
    try {
        const settings = await settingsService.getSeasonSettings();
        res.json({ success: true, data: settings });
    } catch (err) {
        next(err);
    }
}

export async function saveSeasonSettings(req: Request, res: Response, next: NextFunction) {
    try {
        const settings = await settingsService.saveSeasonSettings(req.body);
        res.json({ success: true, data: settings });
    } catch (err) {
        next(err);
    }
}
