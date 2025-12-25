/**
 * P0-6: BSO-RETURN-006 - Cancel POSTED waybill
 * Voids stock movements, returns blank to pool, updates status to CANCELLED
 */
export async function cancelWaybill(
    userInfo: UserInfo,
    id: string,
    reason?: string
): Promise<any> {
    const organizationId = userInfo.organizationId;

    const waybill = await prisma.waybill.findFirst({
        where: { id, organizationId },
        include: {
            blank: true,
            fuelLines: true,
            vehicle: true,
            driver: { include: { employee: true } }
        }
    });

    if (!waybill) throw new NotFoundError('Путевой лист не найден');

    if (waybill.status !== WaybillStatus.POSTED) {
        throw new BadRequestError('Только проведённые ПЛ можно отменить');
    }

    return await prisma.$transaction(async (tx) => {
        // Void fuel card top-up movements
        for (const fuelLine of waybill.fuelLines) {
            if (fuelLine.sourceType === 'FUEL_CARD' && fuelLine.fuelReceived && Number(fuelLine.fuelReceived) > 0) {
                const originalMovement = await tx.stockMovement.findFirst({
                    where: {
                        documentType: 'WAYBILL',
                        documentId: waybill.id,
                        movementType: 'EXPENSE',
                        stockItemId: fuelLine.stockItemId || undefined
                    }
                });

                if (originalMovement) {
                    await tx.stockMovement.create({
                        data: {
                            organizationId,
                            occurredAt: new Date(),
                            movementType: 'INCOME',
                            documentType: 'WAYBILL_VOID',
                            documentId: waybill.id,
                            externalRef: `VOID:${waybill.number}`,
                            stockItemId: originalMovement.stockItemId,
                            stockLocationId: originalMovement.stockLocationId,
                            quantity: Math.abs(originalMovement.quantity),
                            comment: reason || `Отмена ПЛ №${waybill.number}`,
                            isVoid: true,
                            createdById: userInfo.userId
                        }
                    });
                }
            }
        }

        // Return blank to pool
        if (waybill.blankId && waybill.blank) {
            await tx.blank.update({
                where: { id: waybill.blankId },
                data: { status: BlankStatus.ISSUED }
            });
        }

        // Update waybill status
        const cancelledWaybill = await tx.waybill.update({
            where: { id: waybill.id },
            data: {
                status: WaybillStatus.CANCELLED,
                reviewerComment: reason || 'Проводка отменена',
                updatedAt: new Date()
            },
            include: {
                vehicle: true,
                driver: { include: { employee: true } },
                blank: true,
                fuelLines: true,
                routes: true,
                dispatcherEmployee: true,
                controllerEmployee: true
            }
        });

        console.log(`[P0-6] Cancelled waybill ${waybill.number}`, {
            userId: userInfo.userId,
            reason,
            blankId: waybill.blankId,
            fuelMovementsVoided: waybill.fuelLines.length
        });

        // Return with flattened fuel (same format as getWaybillById)
        let fuelAgg = null;
        if (cancelledWaybill.fuelLines && cancelledWaybill.fuelLines.length > 0) {
            const sorted = [...cancelledWaybill.fuelLines].sort((a, b) => {
                const timeA = a.refueledAt ? a.refueledAt.getTime() : 0;
                const timeB = b.refueledAt ? b.refueledAt.getTime() : 0;
                if (timeA !== timeB) return timeB - timeA;
                return b.id.localeCompare(a.id);
            });
            fuelAgg = sorted[0];
        }

        return {
            ...cancelledWaybill,
            fuel: {
                stockItemId: fuelAgg?.stockItemId || null,
                fuelStart: fuelAgg?.fuelStart || null,
                fuelReceived: fuelAgg?.fuelReceived || null,
                fuelConsumed: fuelAgg?.fuelConsumed || null,
                fuelEnd: fuelAgg?.fuelEnd || null,
                fuelPlanned: fuelAgg?.fuelPlanned || null,
                refueledAt: fuelAgg?.refueledAt ? fuelAgg.refueledAt.toISOString() : null,
                sourceType: fuelAgg?.sourceType || null,
                comment: fuelAgg?.comment || null,
            }
        };
    });
}
