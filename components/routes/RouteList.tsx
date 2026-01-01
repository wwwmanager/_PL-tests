import React, { useState, useEffect } from 'react';
import { getRoutes, createRoute, updateRoute, deleteRoute, Route } from '../../services/api/routeApi';
import { PencilIcon, TrashIcon, PlusIcon, GlobeAltIcon } from '../Icons';
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

            <div>
                <div className="flex justify-between items-center mb-4">
                    <div className="flex items-center gap-3">
                        <GlobeAltIcon className="h-6 w-6 text-gray-600 dark:text-gray-400" />
                        <h3 className="text-xl font-semibold text-gray-800 dark:text-white">Справочник: Маршруты</h3>
                    </div>
                    <button onClick={handleAddNew} className="flex items-center gap-2 bg-blue-600 text-white font-semibold py-2 px-4 rounded-lg shadow-md hover:bg-blue-700 transition-colors">
                        <PlusIcon className="h-5 w-5" />
                        Добавить маршрут
                    </button>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left text-gray-500 dark:text-gray-400">
                        <thead className="text-xs text-gray-700 uppercase bg-gray-50 dark:bg-gray-700 dark:text-gray-400">
                            <tr>
                                <th scope="col" className="px-6 py-3">Название</th>
                                <th scope="col" className="px-6 py-3">Начало</th>
                                <th scope="col" className="px-6 py-3">Конец</th>
                                <th scope="col" className="px-6 py-3">Расстояние, км</th>
                                <th scope="col" className="px-6 py-3">Время, мин</th>
                                <th scope="col" className="px-6 py-3 text-center">Действия</th>
                            </tr>
                        </thead>
                        <tbody>
                            {isLoading ? (
                                <tr><td colSpan={6} className="text-center p-4">Загрузка...</td></tr>
                            ) : routes.length === 0 ? (
                                <tr><td colSpan={6} className="text-center p-4">Нет данных</td></tr>
                            ) : routes.map(route => (
                                <tr key={route.id} className="bg-white dark:bg-gray-800 border-b dark:border-gray-700">
                                    <td className="px-6 py-4 font-medium text-gray-900 dark:text-white">{route.name}</td>
                                    <td className="px-6 py-4">{route.startPoint || '—'}</td>
                                    <td className="px-6 py-4">{route.endPoint || '—'}</td>
                                    <td className="px-6 py-4">{route.distance?.toFixed(1) || '—'}</td>
                                    <td className="px-6 py-4">{route.estimatedTime || '—'}</td>
                                    <td className="px-6 py-4 text-center">
                                        <button onClick={() => handleEdit(route)} className="p-2 text-blue-500 transition-all duration-200 transform hover:scale-110">
                                            <PencilIcon className="h-5 w-5" />
                                        </button>
                                        <button onClick={() => handleRequestDelete(route)} className="p-2 text-red-500 transition-all duration-200 transform hover:scale-110">
                                            <TrashIcon className="h-5 w-5" />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </>
    );
};

export default RouteList;
