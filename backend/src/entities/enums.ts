// TypeORM Enums - mapped from Prisma schema
// These match the frontend types.ts enums

export enum WaybillStatus {
    DRAFT = 'DRAFT',
    SUBMITTED = 'SUBMITTED',
    POSTED = 'POSTED',
    CANCELLED = 'CANCELLED',
}

export enum BlankStatus {
    AVAILABLE = 'AVAILABLE',
    ISSUED = 'ISSUED',
    RESERVED = 'RESERVED',
    USED = 'USED',
    RETURNED = 'RETURNED',
    SPOILED = 'SPOILED',
}

export enum StockMovementType {
    INCOME = 'INCOME',
    EXPENSE = 'EXPENSE',
    ADJUSTMENT = 'ADJUSTMENT',
}

export enum AuditActionType {
    CREATE = 'CREATE',
    UPDATE = 'UPDATE',
    DELETE = 'DELETE',
    STATUS_CHANGE = 'STATUS_CHANGE',
    LOGIN = 'LOGIN',
    LOGOUT = 'LOGOUT',
}
