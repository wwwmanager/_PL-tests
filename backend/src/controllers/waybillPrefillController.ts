
import { Request, Response, NextFunction } from 'express';
import { getWaybillPrefillData } from '../services/waybillService';
import { BadRequestError } from '../utils/errors';

export async function getWaybillPrefill(req: Request, res: Response, next: NextFunction) {
    try {
        const user = req.user as { organizationId: string; id: string; role: string; employeeId: string | null; departmentId: string | null };
        const { vehicleId } = req.params;
        const { date } = req.query;

        if (!vehicleId) {
            throw new BadRequestError('Vehicle ID is required');
        }

        const prefillDate = date ? new Date(String(date)) : new Date();
        if (Number.isNaN(prefillDate.getTime())) {
            throw new BadRequestError('Invalid date format');
        }

        const prefillData = await getWaybillPrefillData(user, vehicleId, prefillDate);

        res.json(prefillData);
    } catch (error) {
        next(error);
    }
}
