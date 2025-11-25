// services/domain/blankInvariants.ts
import type { WaybillBlank, Waybill, Employee } from '../../types';
import { WaybillStatus } from '../../types';
import type { BlankStatus } from '../../types';

interface BlankInvariantContext {
    blanks: WaybillBlank[];
    waybills: Waybill[];
    employees: Employee[];
}

/**
 * Человекочитаемое обозначение бланка:
 * - серия и номер (например, "Бланк серии ЧБ №000001")
 * - или ID в fallback-случае
 */
function formatBlankLabel(blank: WaybillBlank): string {
    if (blank.series && blank.number != null) {
        return `Бланк серии ${blank.series} №${String(blank.number).padStart(6, '0')}`;
    }
    return `Бланк (ID: ${blank.id})`;
}

/**
 * Человекочитаемое название статуса бланка
 */
function formatBlankStatus(status: BlankStatus): string {
    const statusMap: Record<BlankStatus, string> = {
        'available': 'Доступен',
        'issued': 'Выдан',
        'reserved': 'Зарезервирован',
        'used': 'Использован',
        'spoiled': 'Испорчен',
        'returned': 'Возвращён'
    };
    return statusMap[status] || status;
}

/**
 * Форматирование номера ПЛ для сообщений об ошибках
 */
function formatWaybillRef(waybill: Waybill): string {
    const numberPart =
        waybill.number && waybill.number !== 'БЛАНКОВ НЕТ'
            ? waybill.number
            : waybill.blankSeries && waybill.blankNumber != null
                ? `${waybill.blankSeries} ${String(waybill.blankNumber).padStart(6, '0')}`
                : `ID: ${waybill.id}`;

    const datePart = waybill.date
        ? new Date(waybill.date).toLocaleDateString('ru-RU')
        : undefined;

    return datePart ? `${numberPart} от ${datePart}` : numberPart;
}

export function assertBlankInvariants(ctx: BlankInvariantContext): void {
    const { blanks, waybills, employees } = ctx;
    const errors: string[] = [];

    const findWaybillById = (id: string | undefined) =>
        id ? waybills.find((w) => w.id === id) : undefined;

    const hasEmployee = (id: string | undefined) =>
        id ? employees.some((e) => e.id === id) : false;

    const findEmployee = (id: string | undefined) =>
        id ? employees.find((e) => e.id === id) : undefined;

    for (const blank of blanks) {
        const status = blank.status as BlankStatus;
        const label = formatBlankLabel(blank);
        const statusLabel = formatBlankStatus(status);

        // 1. Статусы, требующие водителя
        if (
            status === 'issued' ||
            status === 'reserved' ||
            status === 'used' ||
            status === 'returned'
        ) {
            if (!blank.ownerEmployeeId) {
                errors.push(
                    `${label}: статус "${statusLabel}", но не указан владелец (водитель).`,
                );
            } else if (!hasEmployee(blank.ownerEmployeeId)) {
                const emp = findEmployee(blank.ownerEmployeeId);
                const empName = emp?.fullName || blank.ownerEmployeeId;
                errors.push(
                    `${label}: указан владелец ${empName}, но такой сотрудник не найден.`,
                );
            }
        }

        // 2. reserved → reservedByWaybillId и ссылка на ПЛ
        if (status === 'reserved') {
            if (!blank.reservedByWaybillId) {
                errors.push(
                    `${label}: статус "${statusLabel}", но не указан путевой лист, для которого зарезервирован бланк.`,
                );
            } else {
                const wb = findWaybillById(blank.reservedByWaybillId);
                if (!wb) {
                    errors.push(
                        `${label}: зарезервирован для путевого листа, но такой ПЛ не найден.`,
                    );
                } else {
                    if (wb.blankId !== blank.id) {
                        errors.push(
                            `${label}: зарезервирован для ПЛ ${formatWaybillRef(wb)}, но в этом ПЛ указан другой бланк.`,
                        );
                    }
                    if (wb.status === WaybillStatus.CANCELLED) {
                        errors.push(
                            `${label}: статус "${statusLabel}", но связанный путевой лист ${formatWaybillRef(wb)} отменён.`,
                        );
                    }
                }
            }
        }

        // 3. used → usedInWaybillId и ПЛ в статусе POSTED
        if (status === 'used') {
            if (!blank.usedInWaybillId) {
                errors.push(
                    `${label}: статус "${statusLabel}", но не указан путевой лист, в котором он использован.`,
                );
            } else {
                const wb = findWaybillById(blank.usedInWaybillId);
                if (!wb) {
                    errors.push(
                        `${label}: использован в путевом листе, но такой ПЛ не найден.`,
                    );
                } else {
                    if (wb.blankId !== blank.id) {
                        errors.push(
                            `${label}: использован в ПЛ ${formatWaybillRef(wb)}, но в этом ПЛ указан другой бланк.`,
                        );
                    }
                    if (wb.status !== WaybillStatus.POSTED) {
                        errors.push(
                            `${label}: статус "${statusLabel}", но связанный путевой лист ${formatWaybillRef(wb)} не проведён.`,
                        );
                    }
                }
            }
        }
    }

    if (errors.length) {
        throw new Error(
            'Нарушение инвариантов бланков:\n' + errors.join('\n'),
        );
    }
}
