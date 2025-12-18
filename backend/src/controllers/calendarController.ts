import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';

const prisma = new PrismaClient();

export const getCalendarEvents = async (req: Request, res: Response) => {
    try {
        const { start, end, year } = req.query;

        const where: any = {};

        if (year) {
            where.date = { startsWith: String(year) };
        } else if (start && end) {
            where.date = {
                gte: String(start),
                lte: String(end)
            };
        }

        const events = await prisma.calendarEvent.findMany({
            where,
            orderBy: { date: 'asc' }
        });

        res.json(events);
    } catch (error) {
        logger.error({ error, query: req.query }, 'Error fetching calendar events');
        res.status(500).json({ error: 'Failed to fetch calendar events' });
    }
};

export const createCalendarEvents = async (req: Request, res: Response) => {
    try {
        const { events } = req.body; // Expecting array of { date, type, note }

        if (!Array.isArray(events)) {
            res.status(400).json({ error: 'Events must be an array' });
            return;
        }

        const created = await prisma.$transaction(
            events.map((evt: any) =>
                prisma.calendarEvent.upsert({
                    where: { date: evt.date },
                    update: { type: evt.type, note: evt.note },
                    create: { date: evt.date, type: evt.type, note: evt.note }
                })
            )
        );

        res.json(created);
    } catch (error) {
        logger.error({ error }, 'Error creating calendar events');
        res.status(500).json({ error: 'Failed to create calendar events' });
    }
};
