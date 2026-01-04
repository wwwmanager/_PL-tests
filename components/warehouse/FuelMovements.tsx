import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { getStockMovements, getStockItems, getStockLocations, deleteStockMovement } from '../../services/api/stockApi';
import { getOrganizations } from '../../services/organizationApi';
import { StockMovementV2, GarageStockItem, StockLocation, Organization } from '../../types';
import { useToast } from '../../hooks/useToast';
import { PlusIcon, TrashIcon, PencilIcon, FunnelIcon, MovementsIcon } from '../Icons';
import { useAuth } from '../../services/auth';
import MovementCreateModal from './MovementCreateModal';
import ConfirmationModal from '../shared/ConfirmationModal';
import DataTable from '../shared/DataTable';
import { Button } from '../shared/Button';
import { Badge } from '../shared/Badge';

type MovementBadgeVariant = 'success' | 'danger' | 'info' | 'warning' | 'neutral';

const getTypeLabel = (type: string): { label: string; variant: MovementBadgeVariant } => {
    switch (type) {
        case 'INCOME': return { label: 'Приход', variant: 'success' };
        case 'EXPENSE': return { label: 'Расход', variant: 'danger' };
        case 'TRANSFER': return { label: 'Перемещение', variant: 'info' };
        case 'ADJUSTMENT': return { label: 'Коррект.', variant: 'warning' };
        default: return { label: type, variant: 'neutral' };
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
        includeVoided: false,  // SHOW-VOID: Toggle for showing voided movements
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



    const { can } = useAuth();

    const columns = useMemo(() => [
        {
            key: 'occurredAt',
            label: 'Дата',
            sortable: true,
            align: 'center' as const,
            render: (row: StockMovementV2) => new Date(row.occurredAt).toLocaleString('ru-RU', { dateStyle: 'short', timeStyle: 'short' })
        },
        {
            key: 'translatedType',
            label: 'Тип',
            sortable: true,
            align: 'center' as const,
            render: (row: any) => {
                const type = getTypeLabel(row.movementType);
                return <Badge variant={type.variant}>{row.translatedType}</Badge>;
            }
        },
        {
            key: 'stockItemName',
            label: 'Товар',
            sortable: true,
            align: 'center' as const,
            render: (row: StockMovementV2) => <span className="font-medium text-gray-900 dark:text-white">{row.stockItemName}</span>
        },
        {
            key: 'quantity',
            label: 'Кол-во',
            sortable: true,
            align: 'right' as const,
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
    ], []);

    const totalPages = Math.ceil(total / limit);

    return (
        <div className="p-0 space-y-6">
            <div className="flex items-center gap-3 mb-2">
                <MovementsIcon className="h-6 w-6 text-gray-600 dark:text-gray-400" />
                <h3 className="text-xl font-semibold text-gray-800 dark:text-white">Журнал операций</h3>
            </div>
            {/* Filters */}
            <div className="flex flex-wrap gap-4 items-end bg-gray-50 dark:bg-gray-800/50 p-4 rounded-xl border border-gray-100 dark:border-gray-700">
                <div className="flex items-center gap-2 text-gray-500 text-sm font-medium mr-2 self-center">
                    <FunnelIcon className="h-4 w-4" /> Фильтры:
                </div>
                <div className="min-w-[120px]">
                    <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">С</label>
                    <input
                        type="date"
                        name="from"
                        value={filters.from}
                        onChange={handleFilterChange}
                        className="w-full text-sm bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500 dark:text-white"
                    />
                </div>
                <div className="min-w-[120px]">
                    <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">По</label>
                    <input
                        type="date"
                        name="to"
                        value={filters.to}
                        onChange={handleFilterChange}
                        className="w-full text-sm bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500 dark:text-white"
                    />
                </div>
                <div className="min-w-[140px]">
                    <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Тип</label>
                    <select
                        name="movementType"
                        value={filters.movementType}
                        onChange={handleFilterChange}
                        className="w-full text-sm bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500 dark:text-white"
                    >
                        <option value="">Все типы</option>
                        <option value="INCOME">Приход</option>
                        <option value="EXPENSE">Расход</option>
                        <option value="TRANSFER">Перемещение</option>
                        <option value="ADJUSTMENT">Корректировка</option>
                    </select>
                </div>
                <div className="min-w-[160px]">
                    <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Локация</label>
                    <select
                        name="locationId"
                        value={filters.locationId}
                        onChange={handleFilterChange}
                        className="w-full text-sm bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500 dark:text-white"
                    >
                        <option value="">Все локации</option>
                        {locations.map(loc => (
                            <option key={loc.id} value={loc.id}>{loc.name}</option>
                        ))}
                    </select>
                </div>
                <div className="min-w-[160px]">
                    <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Товар</label>
                    <select
                        name="stockItemId"
                        value={filters.stockItemId}
                        onChange={handleFilterChange}
                        className="w-full text-sm bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500 dark:text-white"
                    >
                        <option value="">Все товары</option>
                        {items.map(item => (
                            <option key={item.id} value={item.id}>{item.name}</option>
                        ))}
                    </select>
                </div>
                <div className="flex-1 min-w-[200px]">
                    <input
                        type="text"
                        name="search"
                        value={filters.search}
                        onChange={handleFilterChange}
                        placeholder="Поиск по коммент./док..."
                        className="w-full text-sm bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500 dark:text-white"
                    />
                </div>
            </div>

            {/* Actions & Stats */}
            <div className="flex justify-between items-center">
                <div className="flex items-center gap-3">
                    <span className="px-3 py-1 bg-gray-100 dark:bg-gray-700 rounded-full text-sm text-gray-600 dark:text-gray-300 font-semibold transition-all">
                        Найдено записей: {total}
                    </span>
                    {/* SHOW-VOID: Toggle for showing voided movements */}
                    <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={filters.includeVoided}
                            onChange={(e) => setFilters(prev => ({ ...prev, includeVoided: e.target.checked }))}
                            className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        Показать все операции
                    </label>
                </div>
                {can('stock.create') && (
                    <Button
                        data-testid="btn-create-movement"
                        onClick={() => setIsCreateModalOpen(true)}
                        variant="primary"
                        size="sm"
                        leftIcon={<PlusIcon className="w-4 h-4" />}
                    >
                        Создать операцию
                    </Button>
                )}
            </div>

            {/* Table */}
            <div className="bg-white dark:bg-gray-800 rounded-xl overflow-hidden shadow-sm border border-gray-100 dark:border-gray-700">
                <DataTable
                    tableId="fuel-movements"
                    columns={columns}
                    data={enrichedMovements}
                    keyField="id"
                    isLoading={loading}
                    emptyMessage={Object.values(filters).some(v => v !== '') ? 'По вашему запросу ничего не найдено' : 'Движений еще нет'}
                    searchable={true}
                    actions={[
                        {
                            icon: <PencilIcon className="w-4 h-4" />,
                            onClick: (row) => {
                                setEditMovement(row);
                                setIsCreateModalOpen(true);
                            },
                            title: "Редактировать",
                            className: "text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20",
                            show: () => can('stock.update')
                        },
                        {
                            icon: <TrashIcon className="h-4 w-4" />,
                            onClick: (row) => setMovementToDelete(row),
                            title: "Удалить",
                            className: "text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20",
                            show: () => can('stock.delete') || can('stock.manage')
                        }
                    ]}
                />
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
                <div className="flex justify-center items-center space-x-2 mt-4">
                    <button
                        onClick={() => setPage(p => Math.max(1, p - 1))}
                        disabled={page === 1 || loading}
                        className="px-3 py-1.5 border rounded-lg disabled:opacity-50 dark:border-gray-600 dark:text-white hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                    >
                        Назад
                    </button>
                    <span className="px-3 py-1.5 text-sm text-gray-600 dark:text-gray-300">
                        Страница <span className="font-semibold">{page}</span> из <span className="font-semibold">{totalPages}</span>
                    </span>
                    <button
                        onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                        disabled={page === totalPages || loading}
                        className="px-3 py-1.5 border rounded-lg disabled:opacity-50 dark:border-gray-600 dark:text-white hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
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
