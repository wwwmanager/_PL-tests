import { Request, Response, NextFunction } from 'express';
import * as stockService from '../services/stockService';
import * as stockLocationService from '../services/stockLocationService';
import { BadRequestError } from '../utils/errors';

/**
 * REL-102: Stock Balance Controller
 * API для запроса остатков топлива на локациях
 */

/**
 * GET /stock/balances?stockItemId=...&asOf=...
 * Получить балансы всех локаций организации на дату
 */
export async function getBalances(
    req: Request,
    res: Response,
    next: NextFunction
) {
    try {
        const user = req.user as { organizationId: string };

        const { stockItemId, asOf } = req.query;

        if (!stockItemId) {
            throw new BadRequestError('stockItemId обязателен');
        }

        const asOfDate = asOf ? new Date(String(asOf)) : new Date();

        const balances = await stockService.getBalancesAt(
            user.organizationId,
            String(stockItemId),
            asOfDate
        );

        res.json({
            asOf: asOfDate.toISOString(),
            stockItemId,
            locations: balances,
        });
    } catch (error) {
        next(error);
    }
}

/**
 * GET /stock/balance?locationId=...&stockItemId=...&asOf=...
 * Получить баланс одной локации на дату
 */
export async function getBalance(
    req: Request,
    res: Response,
    next: NextFunction
) {
    try {
        const { locationId, stockItemId, asOf } = req.query;

        if (!locationId) {
            throw new BadRequestError('locationId обязателен');
        }
        if (!stockItemId) {
            throw new BadRequestError('stockItemId обязателен');
        }

        const asOfDate = asOf ? new Date(String(asOf)) : new Date();

        const balance = await stockService.getBalanceAt(
            String(locationId),
            String(stockItemId),
            asOfDate
        );

        res.json({
            locationId,
            stockItemId,
            asOf: asOfDate.toISOString(),
            balance,
        });
    } catch (error) {
        next(error);
    }
}

/**
 * POST /stock/movements
 * Создать движение (INCOME, EXPENSE, ADJUSTMENT, TRANSFER)
 */
export async function createMovement(
    req: Request,
    res: Response,
    next: NextFunction
) {
    try {
        const user = req.user as { organizationId: string; id: string };

        const {
            movementType,
            stockItemId,
            quantity,
            stockLocationId,
            fromLocationId,
            toLocationId,
            occurredAt,
            occurredSeq,
            documentType,
            documentId,
            externalRef,
            comment,
        } = req.body;

        if (!movementType) {
            throw new BadRequestError('movementType обязателен (INCOME, EXPENSE, ADJUSTMENT, TRANSFER)');
        }
        if (!stockItemId) {
            throw new BadRequestError('stockItemId обязателен');
        }
        if (quantity === undefined || quantity <= 0) {
            throw new BadRequestError('quantity должен быть положительным числом');
        }

        let result;
        const occurredAtDate = occurredAt ? new Date(occurredAt) : new Date();

        switch (movementType) {
            case 'TRANSFER':
                if (!fromLocationId || !toLocationId) {
                    throw new BadRequestError('Для TRANSFER требуются fromLocationId и toLocationId');
                }
                result = await stockService.createTransfer({
                    organizationId: user.organizationId,
                    stockItemId,
                    quantity,
                    fromLocationId,
                    toLocationId,
                    occurredAt: occurredAtDate,
                    occurredSeq,
                    documentType,
                    documentId,
                    externalRef,
                    comment,
                    userId: user.id,
                });
                break;

            case 'INCOME':
                result = await stockService.createIncomeMovement(
                    user.organizationId,
                    stockItemId,
                    quantity,
                    documentType,
                    documentId,
                    user.id,
                    null,  // warehouseId deprecated
                    comment,
                    stockLocationId,
                    occurredAtDate
                );
                break;

            case 'EXPENSE':
                result = await stockService.createExpenseMovement(
                    user.organizationId,
                    stockItemId,
                    quantity,
                    documentType,
                    documentId,
                    user.id,
                    null,  // warehouseId deprecated
                    comment,
                    stockLocationId,
                    occurredAtDate
                );
                break;

            case 'ADJUSTMENT':
                // TODO: implement createAdjustment
                throw new BadRequestError('ADJUSTMENT пока не реализован');

            default:
                throw new BadRequestError(`Неизвестный movementType: ${movementType}`);
        }

        res.status(201).json(result);
    } catch (error) {
        next(error);
    }
}
