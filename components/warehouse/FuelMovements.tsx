import React, { useState, useEffect, useCallback } from 'react';
import { getStockMovements, getStockItems, getStockLocations, deleteStockMovement } from '../../services/api/stockApi';
import { StockMovementV2, GarageStockItem, StockLocation } from '../../types';
import { useToast } from '../../hooks/useToast';
import { PlusIcon, TrashIcon } from '../Icons';
import { RequireCapability } from '../../services/auth';
import MovementCreateModal from './MovementCreateModal';
import ConfirmationModal from '../shared/ConfirmationModal';

const FuelMovements: React.FC = () => {
    const [movements, setMovements] = useState<StockMovementV2[]>([]);
    const [items, setItems] = useState<GarageStockItem[]>([]);
    const [locations, setLocations] = useState<StockLocation[]>([]);
    const [loading, setLoading] = useState(false);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [movementToDelete, setMovementToDelete] = useState<StockMovementV2 | null>(null);
    const limit = 20;

    const [filters, setFilters] = useState({
        from: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        to: new Date().toISOString().split('T')[0],
        movementType: '',
        locationId: '',
        stockItemId: '',
        search: '',
    });

    const { showToast } = useToast();

    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            const [movementsRes, itemsData, locationsData] = await Promise.all([
                getStockMovements({ ...filters, page, limit }),
                getStockItems(true),
                getStockLocations(),
            ]);
            setMovements(movementsRes.data);
            setTotal(movementsRes.meta.total);
            setItems(itemsData);
            setLocations(locationsData);
        } catch (err: any) {
            showToast('Ошибка загрузки данных: ' + err.message, 'error');
        } finally {
            setLoading(false);
        }
    }, [filters, page, showToast]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const handleFilterChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFilters((prev) => ({ ...prev, [name]: value }));
        setPage(1); // Reset to first page on filter change
    };

    const handleCloseCreateModal = (refresh?: boolean) => {
        setIsCreateModalOpen(false);
        if (refresh === true) {
            loadData();
        }
    };

    const handleDeleteConfirm = async () => {
        if (!movementToDelete) return;
        try {
            await deleteStockMovement(movementToDelete.id);
            showToast('Операция удалена', 'success');
            loadData();
        } catch (err: any) {
            showToast('Ошибка удаления: ' + err.message, 'error');
        } finally {
            setMovementToDelete(null);
        }
    };

    const getTypeLabel = (type: string) => {
        switch (type) {
            case 'INCOME': return { label: 'Приход', color: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' };
            case 'EXPENSE': return { label: 'Расход', color: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' };
            case 'TRANSFER': return { label: 'Перемещение', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' };
            case 'ADJUSTMENT': return { label: 'Коррект.', color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' };
            default: return { label: type, color: 'bg-gray-100 text-gray-800' };
        }
    };

    const totalPages = Math.ceil(total / limit);

    return (
        <div className="p-4 space-y-4">
            {/* Filters */}
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4 bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
                <div>
                    <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">С</label>
                    <input
                        type="date"
                        name="from"
                        value={filters.from}
                        onChange={handleFilterChange}
                        className="w-full text-sm bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 dark:text-white"
                    />
                </div>
                <div>
                    <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">По</label>
                    <input
                        type="date"
                        name="to"
                        value={filters.to}
                        onChange={handleFilterChange}
                        className="w-full text-sm bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 dark:text-white"
                    />
                </div>
                <div>
                    <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Тип</label>
                    <select
                        name="movementType"
                        value={filters.movementType}
                        onChange={handleFilterChange}
                        className="w-full text-sm bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 dark:text-white"
                    >
                        <option value="">Все типы</option>
                        <option value="INCOME">Приход</option>
                        <option value="EXPENSE">Расход</option>
                        <option value="TRANSFER">Перемещение</option>
                        <option value="ADJUSTMENT">Корректировка</option>
                    </select>
                </div>
                <div>
                    <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Локация</label>
                    <select
                        name="locationId"
                        value={filters.locationId}
                        onChange={handleFilterChange}
                        className="w-full text-sm bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 dark:text-white"
                    >
                        <option value="">Все локации</option>
                        {locations.map(loc => (
                            <option key={loc.id} value={loc.id}>{loc.name}</option>
                        ))}
                    </select>
                </div>
                <div>
                    <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Товар</label>
                    <select
                        name="stockItemId"
                        value={filters.stockItemId}
                        onChange={handleFilterChange}
                        className="w-full text-sm bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 dark:text-white"
                    >
                        <option value="">Все товары</option>
                        {items.map(item => (
                            <option key={item.id} value={item.id}>{item.name}</option>
                        ))}
                    </select>
                </div>
                <div className="flex items-end">
                    <input
                        type="text"
                        name="search"
                        value={filters.search}
                        onChange={handleFilterChange}
                        placeholder="Поиск по коммент./док..."
                        className="w-full text-sm bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 dark:text-white"
                    />
                </div>
            </div>

            {/* Actions */}
            <div className="flex justify-between items-center">
                <div className="text-sm text-gray-500 dark:text-gray-400">
                    Найдено записей: <span className="font-semibold text-gray-800 dark:text-white">{total}</span>
                </div>
                <RequireCapability cap="stock.manage">
                    <button
                        data-testid="btn-create-movement"
                        onClick={() => setIsCreateModalOpen(true)}
                        className="flex items-center space-x-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors shadow-md"
                    >
                        <PlusIcon className="w-5 h-5" />
                        <span>Создать операцию</span>
                    </button>
                </RequireCapability>
            </div>

            {/* Table */}
            <div className="overflow-x-auto border dark:border-gray-700 rounded-lg shadow-sm">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                    <thead className="bg-gray-50 dark:bg-gray-800">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Дата</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Тип</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Товар</th>
                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Кол-во</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Локация</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Основание / Коммент.</th>
                            <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Действия</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-800">
                        {loading ? (
                            <tr>
                                <td colSpan={6} className="px-6 py-12 text-center text-gray-500">Загрузка...</td>
                            </tr>
                        ) : movements.length === 0 ? (
                            <tr>
                                <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                                    {Object.values(filters).some(v => v !== '') ? 'По вашему запросу ничего не найдено' : 'Движений еще нет'}
                                </td>
                            </tr>
                        ) : (
                            movements.map((m) => {
                                const type = getTypeLabel(m.movementType);
                                return (
                                    <tr key={m.id} className="hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-300">
                                            {new Date(m.occurredAt).toLocaleString('ru-RU', { dateStyle: 'short', timeStyle: 'short' })}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${type.color}`}>
                                                {type.label}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                                            {m.stockItemName}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-semibold text-gray-700 dark:text-gray-200">
                                            {m.quantity.toLocaleString('ru-RU', { minimumFractionDigits: 2 })}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-300">
                                            {m.movementType === 'TRANSFER' ? (
                                                <div className="flex flex-col">
                                                    <span className="text-xs text-gray-400 italic font-normal">из:</span>
                                                    <span>{m.fromStockLocationName}</span>
                                                    <span className="text-xs text-gray-400 italic font-normal">в:</span>
                                                    <span>{m.toStockLocationName}</span>
                                                </div>
                                            ) : (
                                                m.stockLocationName
                                            )}
                                        </td>
                                        <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                                            <div className="flex flex-col">
                                                {m.documentType && <span className="font-medium text-gray-600 dark:text-gray-300">{m.documentType}: {m.documentId}</span>}
                                                {m.comment && <span className="italic">"{m.comment}"</span>}
                                                {m.externalRef && <span className="text-[10px] text-gray-400">ID: {m.externalRef}</span>}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <RequireCapability cap="stock.manage">
                                                <button
                                                    onClick={() => setMovementToDelete(m)}
                                                    className="p-1 text-red-500 hover:text-red-700 transition-colors"
                                                    title="Удалить операцию"
                                                >
                                                    <TrashIcon className="w-4 h-4" />
                                                </button>
                                            </RequireCapability>
                                        </td>
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
                <div className="flex justify-center space-x-2 mt-4">
                    <button
                        onClick={() => setPage(p => Math.max(1, p - 1))}
                        disabled={page === 1 || loading}
                        className="px-3 py-1 border rounded-md disabled:opacity-50 dark:border-gray-600 dark:text-white"
                    >
                        Назад
                    </button>
                    <span className="px-3 py-1 dark:text-white">
                        Страница {page} из {totalPages}
                    </span>
                    <button
                        onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                        disabled={page === totalPages || loading}
                        className="px-3 py-1 border rounded-md disabled:opacity-50 dark:border-gray-600 dark:text-white"
                    >
                        Вперед
                    </button>
                </div>
            )}

            <MovementCreateModal
                isOpen={isCreateModalOpen}
                onClose={handleCloseCreateModal}
            />

            <ConfirmationModal
                isOpen={!!movementToDelete}
                onClose={() => setMovementToDelete(null)}
                onConfirm={handleDeleteConfirm}
                title="Удалить операцию?"
                message={`Вы уверены, что хотите удалить операцию от ${movementToDelete ? new Date(movementToDelete.occurredAt).toLocaleString('ru-RU') : ''}? Это повлияет на балансы.`}
                confirmText="Удалить"
                confirmButtonClass="bg-red-600 hover:bg-red-700"
            />
        </div>
    );
};

export default FuelMovements;
