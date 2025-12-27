import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { getStockMovements, getStockItems, getStockLocations, deleteStockMovement } from '../../services/api/stockApi';
import { getOrganizations } from '../../services/organizationApi';
import { StockMovementV2, GarageStockItem, StockLocation, Organization } from '../../types';
import { useToast } from '../../hooks/useToast';
import { PlusIcon, TrashIcon } from '../Icons';
import { RequireCapability } from '../../services/auth';
import MovementCreateModal from './MovementCreateModal';
import ConfirmationModal from '../shared/ConfirmationModal';
import DataTable from '../shared/DataTable';

const getTypeLabel = (type: string) => {
    switch (type) {
        case 'INCOME': return { label: 'Приход', color: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' };
        case 'EXPENSE': return { label: 'Расход', color: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' };
        case 'TRANSFER': return { label: 'Перемещение', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' };
        case 'ADJUSTMENT': return { label: 'Коррект.', color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' };
        default: return { label: type, color: 'bg-gray-100 text-gray-800' };
    }
};

const FuelMovements: React.FC = () => {
    const [movements, setMovements] = useState<StockMovementV2[]>([]);
    const [items, setItems] = useState<GarageStockItem[]>([]);
    const [locations, setLocations] = useState<StockLocation[]>([]);
    const [organizations, setOrganizations] = useState<Organization[]>([]);
    const [loading, setLoading] = useState(false);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [movementToDelete, setMovementToDelete] = useState<StockMovementV2 | null>(null);
    const [editMovement, setEditMovement] = useState<StockMovementV2 | null>(null);
    const limit = 20;

    const enrichedMovements = useMemo(() => {
        return movements.map(m => {
            const typeInfo = getTypeLabel(m.movementType);

            let fromLabel = '-';
            let toLabel = '-';

            if (m.movementType === 'TRANSFER') {
                fromLabel = m.fromStockLocationName || 'Не указано';
                toLabel = m.toStockLocationName || 'Не указано';
            } else if (m.movementType === 'INCOME') {
                // For INCOME, documentId stores the supplier organization ID
                const supplier = organizations.find(o => o.id === m.documentId);
                fromLabel = supplier ? (supplier.shortName || supplier.fullName) : (m.documentId ? `Поставщик ID: ${m.documentId.slice(0, 8)}` : '-');
                toLabel = m.stockLocationName || 'Не указано';
            } else if (m.movementType === 'EXPENSE') {
                fromLabel = m.stockLocationName || 'Не указано';
                // For EXPENSE, documentId can store the recipient organization ID
                const recipient = organizations.find(o => o.id === m.documentId);
                toLabel = recipient ? (recipient.shortName || recipient.fullName) : (m.documentId ? `Получатель ID: ${m.documentId.slice(0, 8)}` : '-');
            } else if (m.movementType === 'ADJUSTMENT') {
                if (Number(m.quantity) > 0) {
                    // Income adjustment
                    const source = organizations.find(o => o.id === m.documentId);
                    fromLabel = source ? (source.shortName || source.fullName) : '-';
                    toLabel = m.stockLocationName || 'Не указано';
                } else {
                    // Expense adjustment
                    fromLabel = m.stockLocationName || 'Не указано';
                    const recipient = organizations.find(o => o.id === m.documentId);
                    toLabel = recipient ? (recipient.shortName || recipient.fullName) : '-';
                }
            }

            let documentDisplay = '';
            if (m.documentType === 'STORNO') {
                documentDisplay = `Сторно: ${m.comment || 'Корректировка'}`;
            } else if (m.comment) {
                documentDisplay = m.comment;
            } else if (m.documentType) {
                documentDisplay = `${m.documentType}: ${m.documentId || ''}`;
            }

            return {
                ...m,
                translatedType: typeInfo.label,
                fromLabel,
                toLabel,
                documentDisplay
            };
        });
    }, [movements, organizations]);

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
            const [movementsRes, itemsData, locationsData, orgsData] = await Promise.all([
                getStockMovements({ ...filters, page, limit }),
                getStockItems(true),
                getStockLocations(),
                getOrganizations(),
            ]);
            setMovements(movementsRes.data);
            setTotal(movementsRes.meta.total);
            setItems(itemsData);
            setLocations(locationsData);
            setOrganizations(orgsData);
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



    const columns = [
        {
            key: 'occurredAt',
            label: 'Дата',
            sortable: true,
            render: (row: StockMovementV2) => new Date(row.occurredAt).toLocaleString('ru-RU', { dateStyle: 'short', timeStyle: 'short' })
        },
        {
            key: 'translatedType',
            label: 'Тип',
            sortable: true,
            render: (row: any) => {
                const type = getTypeLabel(row.movementType);
                return (
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${type.color}`}>
                        {row.translatedType}
                    </span>
                );
            }
        },
        {
            key: 'stockItemName',
            label: 'Товар',
            sortable: true,
            render: (row: StockMovementV2) => <span className="font-medium text-gray-900 dark:text-white">{row.stockItemName}</span>
        },
        {
            key: 'quantity',
            label: 'Кол-во',
            sortable: true,
            render: (row: StockMovementV2) => (
                <span className="font-semibold text-gray-700 dark:text-gray-200">
                    {row.quantity.toLocaleString('ru-RU', { minimumFractionDigits: 2 })}
                </span>
            )
        },
        {
            key: 'fromLabel',
            label: 'Поставщик / Откуда',
            sortable: true,
            render: (row: any) => <span className="text-gray-600 dark:text-gray-400">{row.fromLabel}</span>
        },
        {
            key: 'toLabel',
            label: 'Получатель / Куда',
            sortable: true,
            render: (row: any) => <span className="text-gray-600 dark:text-gray-400">{row.toLabel}</span>
        },
        {
            key: 'documentDisplay',
            label: 'Документ',
            sortable: true,
            render: (row: any) => (
                <div className="flex flex-col text-sm text-gray-500 dark:text-gray-400">
                    <span className="font-medium text-gray-600 dark:text-gray-300">{row.documentDisplay}</span>
                    {row.externalRef && <span className="text-[10px] text-gray-400">ID: {row.externalRef}</span>}
                </div>
            )
        },
        {
            key: 'actions',
            label: 'Действия',
            render: (row: StockMovementV2) => (
                <div className="flex justify-center space-x-2">
                    <RequireCapability cap="stock.manage">
                        <button
                            onClick={() => {
                                setEditMovement(row);
                                setIsCreateModalOpen(true);
                            }}
                            className="p-1 text-blue-500 hover:text-blue-700 transition-colors"
                            title="Редактировать"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                        </button>
                        <button
                            onClick={() => setMovementToDelete(row)}
                            className="p-1 text-red-500 hover:text-red-700 transition-colors"
                            title="Удалить операцию"
                        >
                            <TrashIcon className="w-4 h-4" />
                        </button>
                    </RequireCapability>
                </div>
            )
        }
    ];

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
            <div className="bg-white dark:bg-gray-800 border dark:border-gray-700 rounded-lg shadow-sm">
                {loading ? (
                    <div className="p-12 text-center text-gray-500">Загрузка...</div>
                ) : (
                    <DataTable
                        columns={columns}
                        data={enrichedMovements}
                        keyField="id"
                        emptyMessage={Object.values(filters).some(v => v !== '') ? 'По вашему запросу ничего не найдено' : 'Движений еще нет'}
                        searchable={true}
                    />
                )}
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
                onClose={(refresh) => {
                    handleCloseCreateModal(refresh);
                    setEditMovement(null);
                }}
                initialData={editMovement}
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
