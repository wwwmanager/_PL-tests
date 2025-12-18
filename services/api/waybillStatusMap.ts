/**
 * Status mapping between frontend (lowercase) and backend (UPPERCASE)
 */

export type FrontWaybillStatus = 'draft' | 'submitted' | 'posted' | 'cancelled';
export type BackendWaybillStatus = 'DRAFT' | 'SUBMITTED' | 'POSTED' | 'CANCELLED';

/**
 * Convert frontend status to backend status
 */
export function toBackendStatus(s: FrontWaybillStatus): BackendWaybillStatus {
    return s.toUpperCase() as BackendWaybillStatus;
}

/**
 * Convert backend status to frontend status
 */
export function fromBackendStatus(s: BackendWaybillStatus): FrontWaybillStatus {
    return s.toLowerCase() as FrontWaybillStatus;
}
