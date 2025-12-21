import React, { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import Modal from '../shared/Modal';
import { getStockItems, getStockLocations, createStockMovement } from '../../services/api/stockApi';
import { GarageStockItem, StockLocation } from '../../types';
import { useToast } from '../../hooks/useToast';

const movementSchema = z.object({
    occurredAt: z.string().min(1, 'Укажите дату и время'),
    movementType: z.enum(['INCOME', 'TRANSFER']),
    stockItemId: z.string().min(1, 'Выберите товар'),
    quantity: z.preprocess((val) => Number(val), z.number().positive('Количество должно быть больше 0')),
    fromStockLocationId: z.string().optional(),
    toStockLocationId: z.string().min(1, 'Укажите назначение'),
    comment: z.string().optional(),
    externalRef: z.string().optional(),
}).refine(data => {
    if (data.movementType === 'TRANSFER' && !data.fromStockLocationId) return false;
    return true;
}, { message: 'Укажите источник', path: ['fromStockLocationId'] });

type MovementFormData = z.infer<typeof movementSchema>;

interface Props {
    isOpen: boolean;
    onClose: (refresh?: boolean) => void;
}

const MovementCreateModal: React.FC<Props> = ({ isOpen, onClose }) => {
    const [items, setItems] = useState<GarageStockItem[]>([]);
    const [locations, setLocations] = useState<StockLocation[]>([]);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const { showToast } = useToast();

    const {
        register,
        handleSubmit,
        watch,
        reset,
        formState: { errors },
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
            Promise.all([getStockItems(true), getStockLocations()])
                .then(([itemsData, locationsData]) => {
                    setItems(itemsData);
                    setLocations(locationsData);
                })
                .catch(err => showToast('Ошибка загрузки данных: ' + err.message, 'error'));
        }
    }, [isOpen, showToast]);

    const onSubmit = async (data: MovementFormData) => {
        setIsSubmitting(true);
        try {
            const payload: any = {
                ...data,
                occurredAt: new Date(data.occurredAt).toISOString(),
            };

            if (data.movementType === 'INCOME') {
                payload.stockLocationId = data.toStockLocationId;
                payload.fromStockLocationId = undefined;
                payload.toStockLocationId = undefined;
            } else if (data.movementType === 'TRANSFER') {
                payload.stockLocationId = undefined;
                // fromStockLocationId and toStockLocationId are already in data
            }

            await createStockMovement(payload);
            showToast('Операция успешно создана', 'success');
            reset();
            onClose(true);
        } catch (err: any) {
            showToast('Ошибка создания операции: ' + err.message, 'error');
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
                {isSubmitting ? 'Сохранение...' : 'Создать'}
            </button>
        </div>
    );

    return (
        <Modal isOpen={isOpen} onClose={() => onClose()} title="Новая операция" footer={footer}>
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
                    {movementType === 'TRANSFER' && (
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Откуда (Источник)</label>
                            <select
                                {...register('fromStockLocationId')}
                                className={`w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white ${errors.fromStockLocationId ? 'border-red-500' : 'border-gray-300'}`}
                            >
                                <option value="">Выберите источник...</option>
                                {locations.filter(l => l.type !== 'VEHICLE_TANK').map(loc => (
                                    <option key={loc.id} value={loc.id}>{loc.name} ({loc.type})</option>
                                ))}
                            </select>
                            {errors.fromStockLocationId && <p className="mt-1 text-xs text-red-500">{errors.fromStockLocationId.message}</p>}
                        </div>
                    )}

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
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Внешний номер (Ref)</label>
                        <input
                            type="text"
                            {...register('externalRef')}
                            placeholder="Напр. номер накладной"
                            className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white"
                        />
                    </div>
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
