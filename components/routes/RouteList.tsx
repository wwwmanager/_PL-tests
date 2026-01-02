import React, { useState, useEffect } from 'react';
import { getRoutes, createRoute, updateRoute, deleteRoute, Route } from '../../services/api/routeApi';
import { PencilIcon, TrashIcon, PlusIcon, GlobeAltIcon } from '../Icons';
import DataTable, { Column } from '../shared/DataTable';
import { Button } from '../shared/Button';
import Modal from '../shared/Modal';
import ConfirmationModal from '../shared/ConfirmationModal';
import { useToast } from '../../hooks/useToast';
import { FormField, FormInput } from '../shared/FormComponents';

const RouteList: React.FC = () => {
    const [routes, setRoutes] = useState<Route[]>([]);
    const [currentItem, setCurrentItem] = useState<Partial<Route> | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [routeToDelete, setRouteToDelete] = useState<Route | null>(null);
    const { showToast } = useToast();

    const columns: Column<Route>[] = React.useMemo(() => [
        { key: 'name', label: 'Название', sortable: true },
        { key: 'startPoint', label: 'Начало', sortable: true, render: (r) => r.startPoint || '—' },
        { key: 'endPoint', label: 'Конец', sortable: true, render: (r) => r.endPoint || '—' },
        { key: 'distance', label: 'Расстояние, км', sortable: true, align: 'center', render: (r) => r.distance?.toFixed(1) || '—' },
        { key: 'estimatedTime', label: 'Время, мин', sortable: true, align: 'center', render: (r) => r.estimatedTime?.toString() || '—' },
    ], []);

    const fetchData = async () => {
        try {
            setIsLoading(true);
            const data = await getRoutes();
            setRoutes(data);
        } catch (e) {
            console.error('Ошибка загрузки маршрутов:', e);
            showToast('Не удалось загрузить маршруты', 'error');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const handleEdit = (route: Route) => {
        setCurrentItem({ ...route });
    };

    const handleAddNew = () => {
        setCurrentItem({
            name: '',
            startPoint: '',
            endPoint: '',
            distance: null,
            estimatedTime: null,
        });
    };

    const handleCancel = () => {
        setCurrentItem(null);
    };

    const handleSave = async () => {
        if (!currentItem?.name?.trim()) {
            showToast('Название маршрута обязательно', 'error');
            return;
        }

        try {
            if (currentItem.id) {
                await updateRoute(currentItem.id, currentItem);
            } else {
                await createRoute(currentItem as Omit<Route, 'id'>);
            }
            showToast('Изменения сохранены');
            setCurrentItem(null);
            fetchData();
        } catch (error) {
            showToast('Не удалось сохранить изменения', 'error');
        }
    };

    const handleRequestDelete = (route: Route) => {
        setRouteToDelete(route);
        setIsDeleteModalOpen(true);
    };

    const handleConfirmDelete = async () => {
        if (!routeToDelete) return;
        try {
            await deleteRoute(routeToDelete.id);
            showToast(`Маршрут "${routeToDelete.name}" удален`, 'info');
            fetchData();
        } catch (error) {
            showToast('Не удалось удалить маршрут', 'error');
        } finally {
            setIsDeleteModalOpen(false);
            setRouteToDelete(null);
        }
    };

    const handleFormChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value, type } = e.target;
        setCurrentItem(prev => prev ? {
            ...prev,
            [name]: type === 'number' ? (value === '' ? null : parseFloat(value)) : value
        } : null);
    };

    return (
        <>
            <ConfirmationModal
                isOpen={isDeleteModalOpen}
                onClose={() => setIsDeleteModalOpen(false)}
                onConfirm={handleConfirmDelete}
                title="Подтвердить удаление"
                message={`Удалить маршрут "${routeToDelete?.name}"?`}
                confirmText="Удалить"
                confirmButtonClass="bg-red-600 hover:bg-red-700"
            />
            <Modal
                isOpen={!!currentItem}
                onClose={handleCancel}
                title={currentItem?.id ? `Редактирование: ${currentItem.name}` : 'Добавить маршрут'}
                footer={
                    <>
                        <button onClick={handleCancel} className="bg-gray-200 dark:bg-gray-600 text-gray-800 dark:text-white font-semibold py-2 px-6 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-500">Отмена</button>
                        <button onClick={handleSave} className="bg-blue-600 text-white font-semibold py-2 px-6 rounded-lg hover:bg-blue-700">Сохранить</button>
                    </>
                }
            >
                {currentItem && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <FormField label="Название маршрута" required>
                            <FormInput name="name" value={currentItem.name || ''} onChange={handleFormChange} />
                        </FormField>
                        <FormField label="Расстояние, км">
                            <FormInput type="number" step="0.1" name="distance" value={currentItem.distance ?? ''} onChange={handleFormChange} />
                        </FormField>
                        <FormField label="Начальная точка">
                            <FormInput name="startPoint" value={currentItem.startPoint || ''} onChange={handleFormChange} />
                        </FormField>
                        <FormField label="Конечная точка">
                            <FormInput name="endPoint" value={currentItem.endPoint || ''} onChange={handleFormChange} />
                        </FormField>
                        <FormField label="Время в пути, мин">
                            <FormInput type="number" name="estimatedTime" value={currentItem.estimatedTime ?? ''} onChange={handleFormChange} />
                        </FormField>
                    </div>
                )}
            </Modal>

            <div className="space-y-6">
                <div className="flex justify-between items-center mb-6">
                    <div className="flex items-center gap-3">
                        <GlobeAltIcon className="h-6 w-6 text-gray-600 dark:text-gray-400" />
                        <h2 className="text-xl font-bold text-gray-900 dark:text-white tracking-tight">Маршруты</h2>
                        <span className="px-2.5 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 text-xs font-semibold">
                            {routes.length}
                        </span>
                    </div>
                    <Button onClick={handleAddNew} variant="primary" leftIcon={<PlusIcon className="h-5 w-5" />}>
                        Добавить маршрут
                    </Button>
                </div>

                <DataTable
                    tableId="route-list"
                    columns={columns}
                    data={routes}
                    keyField="id"
                    searchable={true}
                    isLoading={isLoading}
                    actions={[
                        {
                            icon: <PencilIcon className="h-4 w-4" />,
                            onClick: (route) => handleEdit(route),
                            title: "Редактировать",
                            className: "text-blue-600 hover:text-blue-800"
                        },
                        {
                            icon: <TrashIcon className="h-4 w-4" />,
                            onClick: (route) => handleRequestDelete(route),
                            title: "Удалить",
                            className: "text-red-600 hover:text-red-800"
                        }
                    ]}
                />
            </div>
        </>
    );
};

export default RouteList;
