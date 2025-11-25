/// <reference types="vitest" />

import {
    BLANK_TRANSITIONS,
    canBlankTransition,
    formatBlankTransitionError,
} from './blankStatusMachine';
import type { BlankStatus } from '../types';

const ALL_STATUSES: BlankStatus[] = [
    'available',
    'issued',
    'reserved',
    'used',
    'returned',
    'spoiled',
];

describe('blankStatusMachine', () => {
    it('allows no-op transitions (from === to)', () => {
        for (const status of ALL_STATUSES) {
            expect(canBlankTransition(status, status)).toBe(true);
        }
    });

    it('defines expected lifecycle transitions (exact map)', () => {
        expect(BLANK_TRANSITIONS.available).toEqual(['issued', 'spoiled']);
        expect(BLANK_TRANSITIONS.issued).toEqual(['reserved', 'spoiled', 'available']);
        expect(BLANK_TRANSITIONS.reserved).toEqual(['used', 'issued', 'spoiled']);
        expect(BLANK_TRANSITIONS.used).toEqual(['issued', 'spoiled']);
        expect(BLANK_TRANSITIONS.returned).toEqual(['reserved', 'spoiled', 'available']);
        expect(BLANK_TRANSITIONS.spoiled).toEqual([]);
    });

    it('allows transitions used in waybill flows', () => {
        // Выдача бланка водителю: available -> issued
        expect(canBlankTransition('available', 'issued')).toBe(true);

        // Создание черновика ПЛ: issued -> reserved
        expect(canBlankTransition('issued', 'reserved')).toBe(true);

        // Постинг ПЛ: reserved -> used
        expect(canBlankTransition('reserved', 'used')).toBe(true);

        // Отмена/удаление черновика ПЛ: reserved -> issued
        expect(canBlankTransition('reserved', 'issued')).toBe(true);

        // Корректировка POSTED -> DRAFT: used -> issued
        expect(canBlankTransition('used', 'issued')).toBe(true);

        // Возврат чистого бланка на склад: issued -> available
        expect(canBlankTransition('issued', 'available')).toBe(true);

        // Legacy: returned -> available / reserved / spoiled
        expect(canBlankTransition('returned', 'available')).toBe(true);
        expect(canBlankTransition('returned', 'reserved')).toBe(true);
        expect(canBlankTransition('returned', 'spoiled')).toBe(true);
    });

    it('prevents clearly invalid transitions', () => {
        // Нельзя "оживить" испорченный бланк
        expect(canBlankTransition('spoiled', 'available')).toBe(false);
        expect(canBlankTransition('spoiled', 'issued')).toBe(false);
        expect(canBlankTransition('spoiled', 'reserved')).toBe(false);
        expect(canBlankTransition('spoiled', 'used')).toBe(false);
        expect(canBlankTransition('spoiled', 'returned')).toBe(false);

        // Нельзя перескакивать мимо ожидаемых стадий
        expect(canBlankTransition('available', 'reserved')).toBe(false);
        expect(canBlankTransition('available', 'used')).toBe(false);
        expect(canBlankTransition('available', 'returned')).toBe(false);

        // Нет прямого возврата из reserved/used в available
        expect(canBlankTransition('reserved', 'available')).toBe(false);
        expect(canBlankTransition('used', 'available')).toBe(false);

        // returned ведёт себя почти как issued, но нельзя сразу в used
        expect(canBlankTransition('returned', 'used')).toBe(false);
        // и нельзя в issued напрямую (через available/выдачу)
        expect(canBlankTransition('returned', 'issued')).toBe(false);
    });

    it('formats transition error message correctly', () => {
        const msg = formatBlankTransitionError('used', 'available');
        expect(msg).toBe('Недопустимый переход статуса: used → available');
    });
});
