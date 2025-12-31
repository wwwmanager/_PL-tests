/**
 * REL-203: Stock Item List (Номенклатура)
 * CRUD component for unified stock items catalog
 */
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
    getStockItems,
    createStockItem,
    updateStockItem,
    deleteStockItem,
    StockItem,
    StockItemCategory,
    StockItemCreateInput,
    StockItemUpdateInput
} from '../../services/stockItemApi';
import { useToast } from '../../hooks/useToast';
import { PlusIcon, PencilIcon, ArchiveBoxIcon, FunnelIcon } from '../Icons';
import { Button } from '../shared/Button';
import DataTable from '../shared/DataTable';

interface StockItemFormData {
    code: string;
    name: string;
    unit: string;
    categoryEnum: StockItemCategory | '';
    isFuel: boolean;
    density: string;
}

const CATEGORY_LABELS: Record<StockItemCategory, string> = {
    FUEL: '⛽ Топливо',
    MATERIAL: '📦 Материалы',
    SPARE_PART: '🔧 Запчасти',
    SERVICE: '🛠️ Услуги',
    OTHER: '📋 Прочее',
};


const StockItemList: React.FC = () => {
    const [items, setItems] = useState<StockItem[]>([]);
    const [loading, setLoading] = useState(false);
    const [showModal, setShowModal] = useState(false);
    const [editingItem, setEditingItem] = useState<StockItem | null>(null);
    const [formData, setFormData] = useState<StockItemFormData>({
        code: '',
        name: '',
        unit: 'л',
        categoryEnum: 'FUEL',
        isFuel: true,
        density: '',
    });

    // Keeping filters for server-side filtering as well
    const [filters, setFilters] = useState({
        categoryEnum: '' as StockItemCategory | '',
        isActive: 'true',
        search: '',
    });

    const { showToast } = useToast();

    // ... (rest of the state and handlers remain same until return)

    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            const filter: any = {};
            if (filters.categoryEnum) filter.categoryEnum = filters.categoryEnum;
            if (filters.isActive) filter.isActive = filters.isActive === 'true';
            if (filters.search) filter.search = filters.search;

            const data = await getStockItems(filter);
            setItems(data);
        } catch (err: any) {
            showToast('Ошибка загрузки: ' + err.message, 'error');
        } finally {
            setLoading(false);
        }
    }, [filters, showToast]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const handleFilterChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFilters(prev => ({ ...prev, [name]: value }));
    };

    const openCreateModal = () => {
        setEditingItem(null);
        setFormData({
            code: '',
            name: '',
            unit: 'л',
            categoryEnum: 'FUEL',
            isFuel: true,
            density: '',
        });
        setShowModal(true);
    };

    const openEditModal = (item: StockItem) => {
        setEditingItem(item);
        setFormData({
            code: item.code || '',
            name: item.name,
            unit: item.unit,
            categoryEnum: item.categoryEnum || 'OTHER',
            isFuel: item.isFuel,
            density: item.density?.toString() || '',
        });
        setShowModal(true);
    };

    const handleFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value, type } = e.target;
        const isCheckbox = type === 'checkbox';
        setFormData(prev => ({
            ...prev,
            [name]: isCheckbox ? (e.target as HTMLInputElement).checked : value,
            // Auto-update isFuel when category changes
            ...(name === 'categoryEnum' && { isFuel: value === 'FUEL' }),
            ...(name === 'categoryEnum' && value === 'FUEL' && { unit: 'л' }),
        }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.name.trim()) {
            showToast('Название обязательно', 'error');
            return;
        }

        try {
            if (editingItem) {
                const updateData: StockItemUpdateInput = {
                    code: formData.code || undefined,
                    name: formData.name,
                    unit: formData.unit,
                    categoryEnum: formData.categoryEnum as StockItemCategory || undefined,
                    isFuel: formData.isFuel,
                    density: formData.density ? parseFloat(formData.density) : undefined,
                };
                await updateStockItem(editingItem.id, updateData);
                showToast('Номенклатура обновлена', 'success');
            } else {
                const createData: StockItemCreateInput = {
                    code: formData.code || undefined,
                    name: formData.name,
                    unit: formData.unit,
                    categoryEnum: formData.categoryEnum as StockItemCategory || undefined,
                    isFuel: formData.isFuel,
                    density: formData.density ? parseFloat(formData.density) : undefined,
                };
                await createStockItem(createData);
                showToast('Номенклатура создана', 'success');
            }
            setShowModal(false);
            loadData();
        } catch (err: any) {
            showToast('Ошибка: ' + err.message, 'error');
        }
    };

    const handleDelete = async (item: StockItem) => {
        if (!confirm(`Архивировать "${item.name}"?`)) return;
        try {
            await deleteStockItem(item.id);
            showToast('Номенклатура архивирована', 'success');
            loadData();
        } catch (err: any) {
            showToast('Ошибка: ' + err.message, 'error');
        }
    };

    // Define columns for DataTable
    const columns = useMemo(() => [
        {
            key: 'code',
            label: 'Код',
            sortable: true,
            render: (row: StockItem) => <span className="font-mono">{row.code || '—'}</span>
        },
        {
            key: 'name',
            label: 'Название',
            sortable: true,
            render: (row: StockItem) => (
                <div className="font-medium text-gray-900 dark:text-white">
                    {row.name}
                    {row.isFuel && row.density && (
                        <span className="ml-2 text-xs text-gray-400">ρ={row.density}</span>
                    )}
                </div>
            )
        },
        {
            key: 'categoryEnum',
            label: 'Категория',
            sortable: true,
            render: (row: StockItem) => row.categoryEnum ? CATEGORY_LABELS[row.categoryEnum] : row.category || '—'
        },
        { key: 'unit', label: 'Ед. изм.', sortable: true },
        {
            key: 'balance',
            label: 'Остаток',
            sortable: true,
            render: (row: StockItem) => (
                <span className={`font-bold ${Number(row.balance) < 0 ? 'text-red-600' : 'text-green-600'}`}>
                    {Number(row.balance).toLocaleString('ru-RU', { minimumFractionDigits: 2 })}
                </span>
            )
        },
    ], []);

    return (
        <div className="p-0 space-y-6">
            {/* Filters */}
            <div className="flex flex-wrap gap-4 items-center bg-gray-50 dark:bg-gray-800/50 p-4 rounded-xl border border-gray-100 dark:border-gray-700">
                <div className="flex items-center gap-2 text-gray-500 text-sm font-medium mr-2">
                    <FunnelIcon className="h-4 w-4" /> Фильтры:
                </div>
                <div className="min-w-[150px]">
                    <select
                        name="categoryEnum"
                        value={filters.categoryEnum}
                        onChange={handleFilterChange}
                        className="w-full p-2 text-sm border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                    >
                        <option value="">Все категории</option>
                        {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
                            <option key={key} value={key}>{label}</option>
                        ))}
                    </select>
                </div>
                <div className="min-w-[150px]">
                    <select
                        name="isActive"
                        value={filters.isActive}
                        onChange={handleFilterChange}
                        className="w-full p-2 text-sm border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                    >
                        <option value="true">Активные</option>
                        <option value="false">Архивные</option>
                        <option value="">Все статусы</option>
                    </select>
                </div>
                <div className="flex-1 min-w-[200px]">
                    <input
                        type="text"
                        name="search"
                        value={filters.search}
                        onChange={handleFilterChange}
                        placeholder="Поиск по названию или коду..."
                        className="w-full p-2 text-sm border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                    />
                </div>
                <div className="flex items-center gap-2">
                    <Button
                        onClick={loadData}
                        disabled={loading}
                        variant="ghost"
                        size="sm"
                    >
                        Обновить
                    </Button>
                    <Button
                        onClick={openCreateModal}
                        variant="primary"
                        size="sm"
                        leftIcon={<PlusIcon className="w-4 h-4" />}
                    >
                        Добавить
                    </Button>
                </div>
            </div>

            {/* Table */}
            <div className="bg-white dark:bg-gray-800 rounded-xl overflow-hidden shadow-sm border border-gray-100 dark:border-gray-700">
                <DataTable
                    tableId="stock-item-list"
                    columns={columns}
                    data={items}
                    keyField="id"
                    emptyMessage="Номенклатура не найдена"
                    searchable={true}
                    isLoading={loading}
                    actions={[
                        {
                            icon: <PencilIcon className="w-4 h-4" />,
                            onClick: (row) => openEditModal(row),
                            title: "Редактировать",
                            className: "text-blue-600 hover:text-blue-800"
                        },
                        {
                            icon: <ArchiveBoxIcon className="w-4 h-4" />,
                            onClick: (row) => handleDelete(row),
                            title: "Архивировать",
                            className: "text-red-600 hover:text-red-800",
                            show: (row) => row.isActive
                        }
                    ]}
                />
            </div>

            {/* Create/Edit Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md p-6">
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                            {editingItem ? 'Редактировать номенклатуру' : 'Новая номенклатура'}
                        </h3>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                    Категория *
                                </label>
                                <select
                                    name="categoryEnum"
                                    value={formData.categoryEnum}
                                    onChange={handleFormChange}
                                    className="w-full border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md shadow-sm"
                                    required
                                >
                                    {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
                                        <option key={key} value={key}>{label}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                    Код (артикул)
                                </label>
                                <input
                                    type="text"
                                    name="code"
                                    value={formData.code}
                                    onChange={handleFormChange}
                                    className="w-full border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md shadow-sm"
                                    placeholder="АИ-92"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                    Название *
                                </label>
                                <input
                                    type="text"
                                    name="name"
                                    value={formData.name}
                                    onChange={handleFormChange}
                                    className="w-full border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md shadow-sm"
                                    placeholder="Бензин АИ-92"
                                    required
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                        Ед. изм.
                                    </label>
                                    <input
                                        type="text"
                                        name="unit"
                                        value={formData.unit}
                                        onChange={handleFormChange}
                                        className="w-full border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md shadow-sm"
                                    />
                                </div>
                                {formData.categoryEnum === 'FUEL' && (
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                            Плотность (кг/л)
                                        </label>
                                        <input
                                            type="number"
                                            name="density"
                                            value={formData.density}
                                            onChange={handleFormChange}
                                            step="0.001"
                                            className="w-full border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md shadow-sm"
                                            placeholder="0.735"
                                        />
                                    </div>
                                )}
                            </div>
                            <div className="flex justify-end gap-3 pt-4">
                                <button
                                    type="button"
                                    onClick={() => setShowModal(false)}
                                    className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md"
                                >
                                    Отмена
                                </button>
                                <button
                                    type="submit"
                                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                                >
                                    {editingItem ? 'Сохранить' : 'Создать'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default StockItemList;
