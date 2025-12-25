import React, { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import Modal from '../shared/Modal';
import { getStockItems, getStockLocations, createStockMovement, updateStockMovementV2 } from '../../services/api/stockApi';
import { getOrganizations } from '../../services/organizationApi';
import { GarageStockItem, StockLocation, StockMovementV2, Organization } from '../../types';
import { useToast } from '../../hooks/useToast';

const movementSchema = z.object({
    occurredAt: z.string().min(1, 'Укажите дату и время'),
    movementType: z.enum(['INCOME', 'TRANSFER', 'EXPENSE', 'ADJUSTMENT']),
    stockItemId: z.string().min(1, 'Выберите товар'),
    quantity: z.preprocess((val) => Number(val), z.number()),
    fromStockLocationId: z.string().optional(),
    toStockLocationId: z.string().optional(),
    supplierOrgId: z.string().optional(), // INCOME: организация-поставщик
    comment: z.string().optional(),
    externalRef: z.string().optional(),
}).refine(data => {
    if (data.movementType === 'TRANSFER' && !data.fromStockLocationId) return false;
    if (data.movementType === 'INCOME' && !data.toStockLocationId) return false;
    // For EXPENSE, typically we need a source location (stockLocationId in DB)
    // Our UI maps 'toStockLocationId' to stockLocationId for INCOME.
    // We should probably have a single 'locationId' field for simple moves.
    // Let's stick to current UI logic:
    // INCOME: toStockLocationId -> stockLocationId
    // TRANSFER: from -> from, to -> to
    // EXPENSE/ADJUSTMENT: fromStockLocationId -> stockLocationId (source)
    if ((data.movementType === 'EXPENSE' || data.movementType === 'ADJUSTMENT') && !data.fromStockLocationId) return false;

    return true;
}, { message: 'Укажите локацию', path: ['fromStockLocationId'] }); // General error path

type MovementFormData = z.infer<typeof movementSchema>;

interface Props {
    isOpen: boolean;
    onClose: (refresh?: boolean) => void;
    initialData?: StockMovementV2 | null;
}

const MovementCreateModal: React.FC<Props> = ({ isOpen, onClose, initialData }) => {
    const [items, setItems] = useState<GarageStockItem[]>([]);
    const [locations, setLocations] = useState<StockLocation[]>([]);
    const [organizations, setOrganizations] = useState<Organization[]>([]);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [loading, setLoading] = useState(false);
    const { showToast } = useToast();

    const {
        register,
        handleSubmit,
        watch,
        reset,
        formState: { errors },
        setValue
    } = useForm<MovementFormData>({
        resolver: zodResolver(movementSchema),
        defaultValues: {
            occurredAt: new Date().toISOString().slice(0, 16),
            movementType: 'INCOME',
            quantity: 0,
        },
    });

    const movementType = watch('movementType');

    useEffect(() => {
        if (isOpen) {
            setLoading(true);
            const loadData = async () => {
                try {
                    const [itemsData, locationsData, orgsData] = await Promise.allSettled([
                        getStockItems(),
                        getStockLocations(),
                        getOrganizations()
                    ]);

                    if (itemsData.status === 'fulfilled') {
                        setItems(itemsData.value);
                    } else {
                        console.error('Failed to load items', itemsData.reason);
                        showToast('Не удалось загрузить товары', 'error');
                    }

                    if (locationsData.status === 'fulfilled') {
                        setLocations(locationsData.value);
                    } else {
                        console.error('Failed to load locations', locationsData.reason);
                        showToast('Не удалось загрузить локации', 'error');
                    }

                    if (orgsData.status === 'fulfilled') {
                        setOrganizations(orgsData.value);
                    } else {
                        console.error('Failed to load organizations', orgsData.reason);
                    }
                } catch (err: any) {
                    console.error('Error loading modal data', err);
                } finally {
                    setLoading(false);
                }
            };
            loadData();
        }
    }, [isOpen, showToast]);

    useEffect(() => {
        if (isOpen && initialData) {
            console.log('Initializing form with:', initialData);
            // Format date for datetime-local input (local timezone, not UTC)
            const d = new Date(initialData.occurredAt);
            const localDateTime = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}T${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

            // Pre-fill form
            reset({
                occurredAt: localDateTime,
                movementType: initialData.movementType as any,
                stockItemId: initialData.stockItemId || (initialData as any).stockItem?.id || '',
                quantity: initialData.quantity,
                externalRef: initialData.documentId || initialData.externalRef || '',
                comment: initialData.comment || '',
                // For INCOME, documentId stores the supplier organization ID
                supplierOrgId: initialData.movementType === 'INCOME' ? (initialData.documentId || '') : '',
                // Map locations (try scalar first, then relation)
                fromStockLocationId: (initialData.movementType === 'TRANSFER'
                    ? (initialData.fromStockLocationId || (initialData as any).fromStockLocation?.id)
                    : initialData.movementType === 'INCOME' ? undefined : (initialData.stockLocationId || (initialData as any).stockLocation?.id)) || '',
                toStockLocationId: (initialData.movementType === 'TRANSFER'
                    ? (initialData.toStockLocationId || (initialData as any).toStockLocation?.id)
                    : initialData.movementType === 'INCOME' ? (initialData.stockLocationId || (initialData as any).stockLocation?.id) : undefined) || '',
            });
        } else if (isOpen && !initialData) {
            const now = new Date();
            const localNow = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}T${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
            reset({
                occurredAt: localNow,
                movementType: 'INCOME',
                quantity: 0,
                fromStockLocationId: '',
                toStockLocationId: '',
                stockItemId: '',
                comment: '',
                externalRef: '',
                supplierOrgId: ''
            });
        }
    }, [isOpen, initialData, reset]);

    const onSubmit = async (data: MovementFormData) => {
        setIsSubmitting(true);
        try {
            // Mapping for Create
            // INCOME: stockLocationId = to
            // TRANSFER: from, to
            // EXPENSE/ADJ: stockLocationId = from

            const payload: any = {
                ...data,
                occurredAt: new Date(data.occurredAt).toISOString(),
            };

            if (data.movementType === 'INCOME') {
                payload.stockLocationId = data.toStockLocationId;
                payload.fromStockLocationId = undefined;
                payload.toStockLocationId = undefined;
                // Store supplier org ID in documentId
                if (data.supplierOrgId) {
                    payload.documentId = data.supplierOrgId;
                    payload.documentType = 'INCOME';
                }
            } else if (data.movementType === 'TRANSFER') {
                payload.stockLocationId = undefined;
                // fromStockLocationId and toStockLocationId are already in data
            } else {
                // EXPENSE / ADJ
                payload.stockLocationId = data.fromStockLocationId;
                payload.fromStockLocationId = undefined;
                payload.toStockLocationId = undefined;
            }

            if (initialData) {
                await updateStockMovementV2(initialData.id, payload);
                showToast('Операция обновлена', 'success');
            } else {
                await createStockMovement(payload);
                showToast('Операция успешно создана', 'success');
            }

            reset();
            onClose(true);
        } catch (err: any) {
            showToast('Ошибка сохранения: ' + err.message, 'error');
        } finally {
            setIsSubmitting(false);
        }
    };

    const footer = (
        <div className="flex space-x-3">
            <button
                type="button"
                onClick={() => onClose()}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
                Отмена
            </button>
            <button
                type="button"
                onClick={handleSubmit(onSubmit)}
                disabled={isSubmitting}
                className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 transition-colors"
            >
                {isSubmitting ? 'Сохранение...' : (initialData ? 'Сохранить' : 'Создать')}
            </button>
        </div>
    );

    return (
        <Modal isOpen={isOpen} onClose={() => onClose()} title={initialData ? "Редактирование операции" : "Новая операция"} footer={footer}>
            <form className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Дата и время</label>
                        <input
                            type="datetime-local"
                            {...register('occurredAt')}
                            className={`w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white ${errors.occurredAt ? 'border-red-500' : 'border-gray-300'}`}
                        />
                        {errors.occurredAt && <p className="mt-1 text-xs text-red-500">{errors.occurredAt.message}</p>}
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Тип операции</label>
                        <select
                            {...register('movementType')}
                            className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white"
                        >
                            <option value="INCOME">Поступление (INCOME)</option>
                            <option value="TRANSFER">Перемещение (TRANSFER)</option>
                            <option value="EXPENSE">Расход (EXPENSE)</option>
                            <option value="ADJUSTMENT">Корректировка (ADJUSTMENT)</option>
                        </select>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Товар</label>
                        <select
                            {...register('stockItemId')}
                            className={`w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white ${errors.stockItemId ? 'border-red-500' : 'border-gray-300'}`}
                        >
                            <option value="">Выберите товар...</option>
                            {items.map(item => (
                                <option key={item.id} value={item.id}>{item.name} ({item.unit})</option>
                            ))}
                        </select>
                        {errors.stockItemId && <p className="mt-1 text-xs text-red-500">{errors.stockItemId.message}</p>}
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Количество</label>
                        <input
                            type="number"
                            step="0.01"
                            {...register('quantity')}
                            className={`w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white ${errors.quantity ? 'border-red-500' : 'border-gray-300'}`}
                        />
                        {errors.quantity && <p className="mt-1 text-xs text-red-500">{errors.quantity.message}</p>}
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {(movementType === 'TRANSFER' || movementType === 'EXPENSE' || movementType === 'ADJUSTMENT') && (
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Откуда (Источник)</label>
                            <select
                                {...register('fromStockLocationId')}
                                className={`w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white ${errors.fromStockLocationId ? 'border-red-500' : 'border-gray-300'}`}
                            >
                                <option value="">Выберите источник...</option>
                                {locations.map(loc => (
                                    <option key={loc.id} value={loc.id}>{loc.name} ({loc.type})</option>
                                ))}
                            </select>
                            {errors.fromStockLocationId && <p className="mt-1 text-xs text-red-500">{errors.fromStockLocationId.message}</p>}
                        </div>
                    )}

                    {(movementType === 'INCOME' || movementType === 'TRANSFER') && (
                        <div className={movementType === 'INCOME' ? 'md:col-span-2' : ''}>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                Куда (Назначение)
                            </label>
                            <select
                                {...register('toStockLocationId')}
                                className={`w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white ${errors.toStockLocationId ? 'border-red-500' : 'border-gray-300'}`}
                            >
                                <option value="">Выберите назначение...</option>
                                {locations.map(loc => (
                                    <option key={loc.id} value={loc.id}>{loc.name} ({loc.type})</option>
                                ))}
                            </select>
                            {errors.toStockLocationId && <p className="mt-1 text-xs text-red-500">{errors.toStockLocationId.message}</p>}
                        </div>
                    )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {movementType === 'INCOME' ? (
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                Поставщик (организация)
                            </label>
                            <select
                                {...register('supplierOrgId')}
                                className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white"
                            >
                                <option value="">Выберите поставщика...</option>
                                {organizations.map(org => (
                                    <option key={org.id} value={org.id}>{org.shortName || org.fullName}</option>
                                ))}
                            </select>
                        </div>
                    ) : (
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                Внешний номер (Ref)
                            </label>
                            <input
                                type="text"
                                {...register('externalRef')}
                                placeholder="Напр. номер накладной"
                                className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white"
                            />
                        </div>
                    )}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Комментарий</label>
                        <input
                            type="text"
                            {...register('comment')}
                            className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white"
                        />
                    </div>
                </div>
            </form>
        </Modal>
    );
};

export default MovementCreateModal;
