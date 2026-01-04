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
import { useAuth } from '../../services/auth';  // RLS-STOCK-FE-010
import { PlusIcon, PencilIcon, TrashIcon, ArchiveBoxIcon, EyeIcon, NomenclatureIcon } from '../Icons';
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
    FUEL: 'Топливо',
    MATERIAL: 'Материалы',
    SPARE_PART: 'Запчасти',
    SERVICE: 'Услуги',
    OTHER: 'Прочее',
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


    const { showToast } = useToast();
    const { currentUser } = useAuth();  // RLS-STOCK-FE-010
    const isDriver = currentUser?.role === 'driver';  // RLS-STOCK-FE-010

    // ... (rest of the state and handlers remain same until return)

    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            const data = await getStockItems({});
            setItems(data);
        } catch (err: any) {
            showToast('Ошибка загрузки: ' + err.message, 'error');
        } finally {
            setLoading(false);
        }
    }, [showToast]);

    useEffect(() => {
        loadData();
    }, [loadData]);


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
            align: 'center' as const,
            render: (row: StockItem) => <span className="font-mono">{row.code || '—'}</span>
        },
        {
            key: 'name',
            label: 'Название',
            sortable: true,
            align: 'center' as const,
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
            align: 'center' as const,
            render: (row: StockItem) => row.categoryEnum ? CATEGORY_LABELS[row.categoryEnum] : row.category || '—'
        },
        { key: 'unit', label: 'Ед. изм.', sortable: true, align: 'center' as const },
        {
            key: 'balance',
            label: 'Остаток',
            sortable: true,
            align: 'center' as const,
            render: (row: StockItem) => (
                <span className={`font-bold ${Number(row.balance) < 0 ? 'text-red-600' : 'text-green-600'}`}>
                    {Number(row.balance).toLocaleString('ru-RU', { minimumFractionDigits: 2 })}
                </span>
            )
        },
    ], []);

    return (
        <div className="p-0 space-y-6">
            <div className="flex justify-between items-center mb-6">
                <div className="flex items-center gap-3">
                    <NomenclatureIcon className="h-6 w-6 text-gray-600 dark:text-gray-400" />
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white tracking-tight">Номенклатура</h2>
                    <span className="px-2.5 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 text-xs font-semibold">
                        {items.length}
                    </span>
                </div>
                {/* RLS-STOCK-FE-010: Hide Add button for drivers */}
                {!isDriver && (
                    <Button
                        onClick={openCreateModal}
                        variant="primary"
                        leftIcon={<PlusIcon className="w-5 h-5" />}
                    >
                        Добавить номенклатуру
                    </Button>
                )}
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
                            className: "text-blue-600 hover:text-blue-800",
                            show: (row: any) => row._canEdit !== false  // RLS-STOCK-FE-010
                        },
                        {
                            icon: <EyeIcon className="w-4 h-4" />,
                            onClick: (row) => openEditModal(row),
                            title: "Просмотр",
                            className: "text-gray-400 hover:text-gray-600",
                            show: (row: any) => row._canEdit === false  // RLS-STOCK-FE-010: View-only for drivers
                        },
                        {
                            icon: <ArchiveBoxIcon className="w-4 h-4" />,
                            onClick: (row) => handleDelete(row),
                            title: "Архивировать",
                            className: "text-red-600 hover:text-red-800",
                            show: (row: any) => row.isActive && row._canEdit !== false  // RLS-STOCK-FE-010
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
                                            onWheel={(e) => e.currentTarget.blur()}
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
