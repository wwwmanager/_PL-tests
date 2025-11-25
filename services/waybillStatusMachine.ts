
import { WaybillStatus, AppMode } from '../types';

export const WAYBILL_TRANSITIONS: Record<WaybillStatus, WaybillStatus[]> = {
  [WaybillStatus.DRAFT]: [
    WaybillStatus.SUBMITTED,
    WaybillStatus.POSTED,
    WaybillStatus.CANCELLED,
  ],
  [WaybillStatus.SUBMITTED]: [
    WaybillStatus.POSTED,
    WaybillStatus.DRAFT, // Возврат на доработку
    WaybillStatus.CANCELLED, // Разрешено для Central mode
  ],
  [WaybillStatus.POSTED]: [
    WaybillStatus.DRAFT, // Корректировка
  ],
  [WaybillStatus.CANCELLED]: [
    // Терминальный статус, выходов нет
  ],
  // Для обратной совместимости, если статус COMPLETED где-то используется как POSTED
  // Но в enum WaybillStatus COMPLETED и POSTED — это разные ключи с одинаковым значением 'Posted'.
  // Здесь используем ключи enum.
};

/**
 * Check if a waybill status transition is allowed
 * @param from - Current status
 * @param to - Target status
 * @param context - Additional context (appMode, reason)
 */
export function canTransition(
  from: WaybillStatus,
  to: WaybillStatus,
  context?: { appMode?: AppMode; reason?: string }
): boolean {
  const allowed = WAYBILL_TRANSITIONS[from] ?? [];
  if (!allowed.includes(to)) {
    return false;
  }

  // Mode-specific rules
  const mode = context?.appMode ?? 'driver';

  // SUBMITTED → CANCELLED only allowed in central mode
  if (from === WaybillStatus.SUBMITTED && to === WaybillStatus.CANCELLED) {
    return mode === 'central';
  }

  return true;
}

export function formatTransitionError(
  from: WaybillStatus,
  to: WaybillStatus,
): string {
  return `Недопустимый переход статуса: ${from} → ${to}`;
}
