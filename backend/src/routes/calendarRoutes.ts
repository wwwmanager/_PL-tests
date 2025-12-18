import { Router } from 'express';
import { getCalendarEvents, createCalendarEvents } from '../controllers/calendarController';
import { authMiddleware } from '../middleware/authMiddleware';
import { checkPermission } from '../middleware/checkPermission';

const router = Router();

// Public read or Authenticated read? Let's make it authenticated.
router.get('/', authMiddleware, getCalendarEvents);

// Admin only write (requires 'calendar.manage' permission, or admin role)
router.post('/', authMiddleware, checkPermission('calendar.manage'), createCalendarEvents);

export { router as calendarRouter };
