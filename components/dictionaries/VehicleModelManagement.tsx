import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
    getVehicleModels,
    createVehicleModel,
    updateVehicleModel,
    deleteVehicleModel,
    VehicleModel
} from '../../services/api/vehicleModelApi';
import { getStockItems, StockItem } from '../../services/stockItemApi';
import { useToast } from '../../hooks/useToast';
import { useAuth } from '../../services/auth';
import { PlusIcon, PencilIcon, TrashIcon, EyeIcon, TruckIcon } from '../Icons';
import { Button } from '../shared/Button';
import DataTable from '../shared/DataTable';
import Modal from '../shared/Modal';
import CollapsibleSection from '../shared/CollapsibleSection';
import { FormField, FormInput, FormSelect } from '../shared/FormComponents';

const VehicleModelManagement: React.FC = () => {
    const [models, setModels] = useState<VehicleModel[]>([]);
    const [fuelItems, setFuelItems] = useState<StockItem[]>([]);
    const [loading, setLoading] = useState(false);
    const [showModal, setShowModal] = useState(false);
    const [editingItem, setEditingItem] = useState<VehicleModel | null>(null);

    // Form State
    const [formData, setFormData] = useState<Partial<VehicleModel>>({});
    const [isSaving, setIsSaving] = useState(false);

    // Collapsible sections state
    const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({
        basic: false,
        fuel: false
    });

    const { showToast } = useToast();
    const { currentUser } = useAuth();
    const isDriver = currentUser?.role === 'driver';

    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            const [modelsData, fuelData] = await Promise.all([
                getVehicleModels(),
                getStockItems({ categoryEnum: 'FUEL', isActive: true })
            ]);
            setModels(modelsData);
            setFuelItems(fuelData);
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
            name: '',
            brand: '',
            model: '',
            type: '',
            fuelStockItemId: '',
            tankCapacity: undefined,
            summerRate: undefined,
            winterRate: undefined,
            tireSize: '',
            rimSize: '',
            manufactureYearFrom: undefined,
            manufactureYearTo: undefined
        });
        setCollapsedSections({ basic: false, fuel: false });
        setShowModal(true);
    };

    const openEditModal = (item: VehicleModel) => {
        setEditingItem(item);
        setFormData({
            ...item,
            fuelStockItemId: item.fuelStockItemId || '',
            tankCapacity: item.tankCapacity || undefined,
            summerRate: item.summerRate || undefined,
            winterRate: item.winterRate || undefined,
        });
        setCollapsedSections({ basic: false, fuel: false });
        setShowModal(true);
    };

    const handleFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value, type } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: type === 'number' ? (value ? parseFloat(value) : undefined) : value,
        }));
    };

    const toggleSection = (section: string) => {
        setCollapsedSections(prev => ({ ...prev, [section]: !prev[section] }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.name?.trim()) {
            showToast('Название конфигурации обязательно', 'error');
            return;
        }

        setIsSaving(true);
        try {
            if (editingItem) {
                await updateVehicleModel(editingItem.id, formData);
                showToast('Марка ТС обновлена', 'success');
            } else {
                await createVehicleModel(formData);
                showToast('Марка ТС создана', 'success');
            }
            setShowModal(false);
            loadData();
        } catch (err: any) {
            showToast('Ошибка: ' + err.message, 'error');
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async (item: VehicleModel) => {
        if (!confirm(`Удалить марку "${item.name}"?`)) return;
        try {
            await deleteVehicleModel(item.id);
            showToast('Марка ТС удалена', 'success');
            loadData();
        } catch (err: any) {
            showToast('Ошибка: ' + err.message, 'error');
        }
    };

    const columns = useMemo(() => [
        {
            key: 'name',
            label: 'Конфигурация',
            sortable: true,
            render: (row: VehicleModel) => (
                <div>
                    <div className="font-medium text-gray-900 dark:text-white">{row.name}</div>
                    <div className="text-xs text-gray-500">{row.brand} {row.model}</div>
                </div>
            )
        },
        {
            key: 'type',
            label: 'Тип',
            sortable: true,
            align: 'center' as const,
        },
        {
            key: 'rates',
            label: 'Нормы (Л/З)',
            align: 'center' as const,
            render: (row: VehicleModel) => (
                <span className="text-sm">
                    {row.summerRate || '-'} / {row.winterRate || '-'}
                </span>
            )
        },
        {
            key: 'tank',
            label: 'Бак',
            align: 'center' as const,
            render: (row: VehicleModel) => row.tankCapacity ? `${row.tankCapacity} л` : '-'
        },
        {
            key: 'years',
            label: 'Годы',
            align: 'center' as const,
            render: (row: VehicleModel) => (
                <span>
                    {row.manufactureYearFrom && row.manufactureYearTo
                        ? `${row.manufactureYearFrom} - ${row.manufactureYearTo}`
                        : (row.manufactureYearFrom || row.manufactureYearTo || '-')
                    }
                </span>
            )
        }
    ], []);

    // Check if form is valid (basic validation)
    const isFormValid = !!formData.name;

    return (
        <div className="p-0 space-y-6">
            <div className="flex justify-between items-center mb-6">
                <div className="flex items-center gap-3">
                    <TruckIcon className="h-6 w-6 text-gray-600 dark:text-gray-400" />
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white tracking-tight">Марки ТС</h2>
                    <span className="px-2.5 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 text-xs font-semibold">
                        {models.length}
                    </span>
                </div>
                {!isDriver && (
                    <Button
                        onClick={openCreateModal}
                        variant="primary"
                        size="sm"
                        leftIcon={<PlusIcon className="w-4 h-4" />}
                    >
                        Добавить
                    </Button>
                )}
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-xl overflow-hidden shadow-sm border border-gray-100 dark:border-gray-700">
                <DataTable
                    tableId="vehicle-model-list"
                    columns={columns}
                    data={models}
                    keyField="id"
                    emptyMessage="Марки ТС не найдены"
                    searchable={true}
                    isLoading={loading}
                    actions={[
                        {
                            icon: <PencilIcon className="w-4 h-4" />,
                            onClick: (row) => openEditModal(row),
                            title: "Редактировать",
                            className: "text-blue-600 hover:text-blue-800",
                            show: () => !isDriver
                        },
                        {
                            icon: <EyeIcon className="w-4 h-4" />,
                            onClick: (row) => openEditModal(row),
                            title: "Просмотр",
                            className: "text-gray-400 hover:text-gray-600",
                            show: () => isDriver
                        },
                        {
                            icon: <TrashIcon className="w-4 h-4" />,
                            onClick: (row) => handleDelete(row),
                            title: "Удалить",
                            className: "text-red-600 hover:text-red-800",
                            show: () => !isDriver
                        }
                    ]}
                />
            </div>

            <Modal
                isOpen={showModal}
                onClose={() => setShowModal(false)}
                isDirty={isFormValid} // Using validity as proxy or specific logic
                title={editingItem ? `Редактирование: ${formData.name}` : 'Создание марки ТС'}
                footer={
                    <>
                        <button
                            onClick={() => setShowModal(false)}
                            className="bg-gray-200 dark:bg-gray-600 text-gray-800 dark:text-white font-semibold py-2 px-4 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-500"
                        >
                            Отмена
                        </button>
                        <button
                            onClick={handleSubmit}
                            disabled={!isFormValid || isSaving}
                            className="bg-blue-600 text-white font-semibold py-2 px-4 rounded-lg hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed"
                        >
                            {isSaving ? 'Сохранение...' : 'Сохранить'}
                        </button>
                    </>
                }
            >
                <div className="space-y-6">
                    <CollapsibleSection
                        title="Основная информация"
                        isCollapsed={collapsedSections.basic}
                        onToggle={() => toggleSection('basic')}
                    >
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="md:col-span-2">
                                <FormField label="Название конфигурации" required>
                                    <FormInput
                                        name="name"
                                        value={formData.name || ''}
                                        onChange={handleFormChange}
                                        placeholder="Например: KAMAZ 5490 (Зима 2024)"
                                    />
                                </FormField>
                            </div>
                            <FormField label="Марка">
                                <FormInput
                                    name="brand"
                                    value={formData.brand || ''}
                                    onChange={handleFormChange}
                                />
                            </FormField>
                            <FormField label="Модель">
                                <FormInput
                                    name="model"
                                    value={formData.model || ''}
                                    onChange={handleFormChange}
                                />
                            </FormField>
                            <FormField label="Тип ТС">
                                <FormSelect
                                    name="type"
                                    value={formData.type || ''}
                                    onChange={handleFormChange}
                                >
                                    <option value="">Не выбрано</option>
                                    <option value="Легковой">Легковой</option>
                                    <option value="Грузовой">Грузовой</option>
                                    <option value="Тягач">Тягач</option>
                                    <option value="Прицеп">Прицеп</option>
                                    <option value="Автобус">Автобус</option>
                                    <option value="Спецтехника">Спецтехника</option>
                                </FormSelect>
                            </FormField>
                            <div className="grid grid-cols-2 gap-4">
                                <FormField label="Год с">
                                    <FormInput
                                        type="number"
                                        name="manufactureYearFrom"
                                        value={formData.manufactureYearFrom || ''}
                                        onChange={handleFormChange}
                                        placeholder="2020"
                                    />
                                </FormField>
                                <FormField label="Год по">
                                    <FormInput
                                        type="number"
                                        name="manufactureYearTo"
                                        value={formData.manufactureYearTo || ''}
                                        onChange={handleFormChange}
                                        placeholder="2022"
                                    />
                                </FormField>
                            </div>
                        </div>
                    </CollapsibleSection>

                    <CollapsibleSection
                        title="Топливо и настройки"
                        isCollapsed={collapsedSections.fuel}
                        onToggle={() => toggleSection('fuel')}
                    >
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="md:col-span-2">
                                <FormField label="Основное топливо">
                                    <FormSelect
                                        name="fuelStockItemId"
                                        value={formData.fuelStockItemId || ''}
                                        onChange={handleFormChange}
                                    >
                                        <option value="">Не выбрано</option>
                                        {fuelItems.map(f => (
                                            <option key={f.id} value={f.id}>{f.name}</option>
                                        ))}
                                    </FormSelect>
                                </FormField>
                            </div>
                            <FormField label="Объем бака (л)">
                                <FormInput
                                    type="number"
                                    name="tankCapacity"
                                    value={formData.tankCapacity || ''}
                                    onChange={handleFormChange}
                                />
                            </FormField>
                            <FormField label="Размер шин">
                                <FormInput
                                    name="tireSize"
                                    value={formData.tireSize || ''}
                                    onChange={handleFormChange}
                                />
                            </FormField>
                            <FormField label="Летняя норма (л/100км)">
                                <FormInput
                                    type="number"
                                    step="0.01"
                                    name="summerRate"
                                    value={formData.summerRate || ''}
                                    onChange={handleFormChange}
                                />
                            </FormField>
                            <FormField label="Зимняя норма (л/100км)">
                                <FormInput
                                    type="number"
                                    step="0.01"
                                    name="winterRate"
                                    value={formData.winterRate || ''}
                                    onChange={handleFormChange}
                                />
                            </FormField>
                            <FormField label="Размер дисков">
                                <FormInput
                                    name="rimSize"
                                    value={formData.rimSize || ''}
                                    onChange={handleFormChange}
                                />
                            </FormField>
                        </div>
                    </CollapsibleSection>
                </div>
            </Modal>
        </div>
    );
};

export default VehicleModelManagement;
