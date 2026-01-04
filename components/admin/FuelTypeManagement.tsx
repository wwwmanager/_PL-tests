import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { FuelType } from '../../types';
import { getFuelTypes, createFuelType, updateFuelType, deleteFuelType } from '../../services/api/fuelTypeApi';
import { PencilIcon, TrashIcon, PlusIcon, EyeIcon, FireIcon } from '../Icons';
import DataTable, { Column } from '../shared/DataTable';
import { Badge } from '../shared/Badge';
import { Button } from '../shared/Button';
import Modal from '../shared/Modal';
import ConfirmationModal from '../shared/ConfirmationModal';
import { useToast } from '../../hooks/useToast';
import { useAuth } from '../../services/auth';  // RLS-FUEL-FE-010

const FormField: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div>
    <label className="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-1">{label}</label>
    {children}
  </div>
);

const FormInput = (props: React.InputHTMLAttributes<HTMLInputElement>) => (
  <input
    {...props}
    onWheel={(e) => props.type === 'number' ? e.currentTarget.blur() : props.onWheel?.(e)}
    className="w-full bg-white dark:bg-gray-600 border border-gray-300 dark:border-gray-500 rounded-md p-2 focus:ring-blue-500 focus:border-blue-500 text-gray-700 dark:text-gray-200"
  />
);

const FuelTypeManagement = () => {
  const [fuelTypes, setFuelTypes] = useState<FuelType[]>([]);
  const [currentItem, setCurrentItem] = useState<Partial<FuelType> | null>(null);
  const [initialItem, setInitialItem] = useState<Partial<FuelType> | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [fuelTypeToDelete, setFuelTypeToDelete] = useState<FuelType | null>(null);
  const { showToast } = useToast();
  const { currentUser } = useAuth();  // RLS-FUEL-FE-010
  const isDriver = currentUser?.role === 'driver';  // RLS-FUEL-FE-010

  const isDirty = useMemo(() => {
    if (!currentItem || !initialItem) return false;
    return JSON.stringify(currentItem) !== JSON.stringify(initialItem);
  }, [currentItem, initialItem]);

  const columns: Column<FuelType>[] = useMemo(() => [
    { key: 'name', label: 'Название', sortable: true, align: 'center' as const },
    { key: 'code', label: 'Код', sortable: true, align: 'center' as const },
    {
      key: 'density',
      label: 'Плотность',
      sortable: true,
      align: 'center' as const,
      render: (ft) => typeof ft.density === 'number' ? ft.density.toFixed(3) : ''
    },
  ], []);

  const fetchFuelTypes = useCallback(async () => {
    try {
      setIsLoading(true);
      const data = await getFuelTypes();
      setFuelTypes(data);
      setError('');
    } catch {
      setError('Не удалось загрузить справочник.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFuelTypes();
  }, [fetchFuelTypes]);

  const handleEdit = (fuelType: FuelType) => {
    const copy = { ...fuelType };
    setCurrentItem(copy);
    setInitialItem(JSON.parse(JSON.stringify(copy)));
  };

  const handleAddNew = () => {
    const newItem: Partial<FuelType> = { name: '', code: '', density: undefined };
    setCurrentItem(newItem);
    setInitialItem(JSON.parse(JSON.stringify(newItem)));
  };

  const handleCancel = useCallback(() => {
    setCurrentItem(null);
    setInitialItem(null);
  }, []);

  const handleRequestDelete = (item: FuelType) => {
    setFuelTypeToDelete(item);
    setIsDeleteModalOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (fuelTypeToDelete === null) return;
    try {
      await deleteFuelType(fuelTypeToDelete.id);
      showToast(`Тип топлива "${fuelTypeToDelete.name}" удален.`, 'info');
      fetchFuelTypes();
    } catch {
      showToast('Не удалось удалить элемент.', 'error');
    } finally {
      setIsDeleteModalOpen(false);
      setFuelTypeToDelete(null);
    }
  };

  const hasId = (item: Partial<FuelType>): item is FuelType => typeof (item as any).id === 'string';

  const handleSave = async () => {
    if (!currentItem) return;

    const name = currentItem.name?.trim() ?? '';
    const code = currentItem.code?.trim() ?? '';

    if (!name || !code) {
      showToast('Пожалуйста, заполните все поля.', 'error');
      return;
    }

    if (
      currentItem.density === undefined ||
      Number.isNaN(currentItem.density) ||
      (typeof currentItem.density === 'number' && currentItem.density <= 0)
    ) {
      showToast('Плотность должна быть числом больше 0.', 'error');
      return;
    }

    // Уникальность кода
    const codeLower = code.toLowerCase();
    const duplicate = fuelTypes.some(ft => ft.code.toLowerCase() === codeLower && ft.id !== (currentItem as any).id);
    if (duplicate) {
      showToast('Код должен быть уникальным.', 'error');
      return;
    }

    setIsSaving(true);
    try {
      if ('id' in currentItem && currentItem.id) {
        await updateFuelType(currentItem.id, { ...currentItem, name, code } as FuelType);
      } else {
        await createFuelType({ name, code, density: currentItem.density! });
      }
      showToast('Изменения сохранены', 'success');
      handleCancel();
      fetchFuelTypes();
    } catch {
      showToast('Не удалось сохранить изменения.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleFormChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type } = e.target;

    if (type === 'number') {
      setCurrentItem(prev =>
        prev ? { ...prev, [name]: value === '' ? undefined : parseFloat(value) } : null
      );
      return;
    }

    setCurrentItem(prev => (prev ? { ...prev, [name]: value } : null));
  }, []);

  return (
    <>
      <ConfirmationModal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={handleConfirmDelete}
        title="Подтвердить удаление"
        message={`Вы уверены, что хотите удалить тип топлива "${fuelTypeToDelete?.name}" ? Это действие нельзя будет отменить.`}
        confirmText="Удалить"
        confirmButtonClass="bg-red-600 hover:bg-red-700 focus:ring-red-500"
      />

      <Modal
        isOpen={!!currentItem}
        onClose={handleCancel}
        isDirty={isDirty}
        title={currentItem?.id ? `Редактирование: ${initialItem?.name} ` : 'Добавить новый тип топлива'}
        footer={
          <>
            <button
              onClick={handleCancel}
              className="bg-gray-200 dark:bg-gray-600 text-gray-800 dark:text-white font-semibold py-2 px-4 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-500"
            >
              Отмена
            </button>
            <button
              onClick={handleSave}
              disabled={!isDirty || isSaving}
              className="bg-blue-600 text-white font-semibold py-2 px-4 rounded-lg hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isSaving ? 'Сохранение...' : 'Сохранить'}
            </button>
          </>
        }
      >
        {currentItem && (
          <div className="space-y-4">
            <FormField label="Название">
              <FormInput name="name" value={currentItem.name ?? ''} onChange={handleFormChange} />
            </FormField>
            <FormField label="Код">
              <FormInput name="code" value={currentItem.code ?? ''} onChange={handleFormChange} />
            </FormField>
            <FormField label="Плотность">
              <FormInput
                name="density"
                type="number"
                step="0.001"
                min="0"
                value={currentItem.density ?? ''}
                onChange={handleFormChange}
              />
            </FormField>
          </div>
        )}
      </Modal>

      <div className="space-y-6">
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-3">
            <FireIcon className="h-6 w-6 text-gray-600 dark:text-gray-400" />
            <h2 className="text-xl font-bold text-gray-900 dark:text-white tracking-tight">Типы топлива</h2>
            <span className="px-2.5 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 text-xs font-semibold">
              {fuelTypes.length}
            </span>
          </div>
          {/* RLS-FUEL-FE-010: Hide Add button for drivers */}
          {!isDriver && (
            <Button onClick={handleAddNew} variant="primary" size="sm" leftIcon={<PlusIcon className="h-4 w-4" />}>
              Добавить
            </Button>
          )}
        </div>

        <DataTable
          tableId="fuel-type-list"
          columns={columns}
          data={fuelTypes}
          keyField="id"
          searchable={true}
          isLoading={isLoading}
          error={error ? { type: 'error', message: error } : undefined}
          onRetry={fetchFuelTypes}
          actions={[
            {
              icon: <EyeIcon className="h-4 w-4" />,
              onClick: (ft) => handleEdit(ft),
              title: "Просмотр (только чтение)",
              className: "text-gray-600 hover:text-gray-800",
              show: () => isDriver
            },
            {
              icon: <PencilIcon className="h-4 w-4" />,
              onClick: (ft) => handleEdit(ft),
              title: "Редактировать",
              className: "text-blue-600 hover:text-blue-800",
              show: () => !isDriver
            },
            {
              icon: <TrashIcon className="h-4 w-4" />,
              onClick: (ft) => handleRequestDelete(ft),
              title: "Удалить",
              className: "text-red-600 hover:text-red-800",
              show: () => !isDriver
            }
          ]}
        />
      </div>
    </>
  );
};

export default FuelTypeManagement;