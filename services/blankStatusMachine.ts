// services/blankStatusMachine.ts
import type { BlankStatus } from '../types';

/**
 * Допустимые переходы статусов бланка.
 *
 * available -> issued    (выдача на руки водителю)
 * available -> spoiled   (порча на складе)
 *
 * issued    -> reserved  (привязка к черновику ПЛ)
 * issued    -> spoiled   (порча у водителя)
 * issued    -> available (возврат на склад как "чистый")
 *
 * reserved  -> used      (ПЛ проведён)
 * reserved  -> issued    (черновик ПЛ отменён/удалён)
 * reserved  -> spoiled   (админский оверрайд)
 *
 * used      -> issued    (корректировка: POSTED -> DRAFT)
 * used      -> spoiled   (админский оверрайд, крайне редко)
 *
 * returned  -> reserved  (исторический статус, ведём себя почти как issued)
 * returned  -> spoiled
 * returned  -> available
 *
 * spoiled   -> []        (терминальное состояние)
 */
export const BLANK_TRANSITIONS: Record<BlankStatus, BlankStatus[]> = {
    available: [
        'issued',   // When issuing to driver
        'spoiled',  // Warehouse spoilage
    ],
    issued: [
        'reserved',  // When creating draft waybill
        'spoiled',   // Driver spoilage
        'available', // Return to warehouse (rare, but allowed)
    ],
    reserved: [
        'used',    // When posting waybill
        'issued',  // When canceling/deleting draft waybill
        'spoiled', // Administrative override
    ],
    used: [
        'issued',  // When correcting posted waybill back to draft
        'spoiled', // Administrative override (very rare)
    ],
    returned: [
        // Legacy status, treat as 'issued'
        'reserved',
        'spoiled',
        'available',
    ],
    spoiled: [
        // Terminal status, no exits
    ],
};

/**
 * Проверка, разрешён ли переход статуса бланка.
 * Разрешаем no-op (from === to), чтобы повторная установка не падала.
 */
export function canBlankTransition(from: BlankStatus, to: BlankStatus): boolean {
    if (from === to) return true;

    const allowed = BLANK_TRANSITIONS[from];
    return allowed ? allowed.includes(to) : false;
}

/**
 * Формирование человекочитаемого сообщения об ошибке перехода.
 */
export function formatBlankTransitionError(from: BlankStatus, to: BlankStatus): string {
    return `Недопустимый переход статуса: ${from} → ${to}`;
}

/**
 * Get human-readable description of blank status
 */
export const BLANK_STATUS_DESCRIPTIONS: Record<BlankStatus, string> = {
    available: 'Доступен на складе',
    issued: 'Выдан водителю',
    reserved: 'Зарезервирован для ПЛ',
    used: 'Использован в проведённом ПЛ',
    returned: 'Возвращён (устаревший статус)',
    spoiled: 'Испорчен',
};
