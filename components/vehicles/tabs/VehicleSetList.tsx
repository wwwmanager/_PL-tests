import React, { useState } from 'react';
import { VehicleSet, createVehicleSet, SetKind, SetStatus, SeasonType, equipVehicleSet, unequipVehicleSet } from '../../../services/vehicleSetApi';
import { useToast } from '../../../hooks/useToast';
import { Button } from '../../shared/Button';
import { PlusIcon } from '../../Icons';
import { Badge } from '../../shared/Badge';

interface VehicleSetListProps {
    vehicleId: string;
    sets: VehicleSet[];
    onRefresh: () => void;
}

export const VehicleSetList: React.FC<VehicleSetListProps> = ({ vehicleId, sets, onRefresh }) => {
    const { showToast } = useToast();
    const [loading, setLoading] = useState(false);

    // TODO: Add Create Modal implementation
    const handleCreate = async () => {
        // Placeholder for create logic
        const dummySet = {
            vehicleId,
            kind: 'TIRE' as SetKind,
            season: 'SUMMER' as SeasonType,
            spec: '205/55 R16',
            initialStatus: 'STORED' as SetStatus,
            wearPct: 0
        };
        try {
            setLoading(true);
            await createVehicleSet(dummySet);
            showToast('Комплект создан', 'success');
            onRefresh();
        } catch (e: any) {
            showToast(e.message, 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleEquip = async (setId: string) => {
        const odometer = Number(prompt('Текущий пробег для установки:', '0'));
        if (isNaN(odometer)) return;
        try {
            await equipVehicleSet(setId, odometer);
            showToast('Комплект установлен', 'success');
            onRefresh();
        } catch (e: any) {
            showToast(e.message, 'error');
        }
    };

    const handleUnequip = async (setId: string) => {
        const odometer = Number(prompt('Текущий пробег для снятия:', '0'));
        if (isNaN(odometer)) return;
        const locationId = prompt('ID склада для хранения (Enter to skip):', '') || ''; // Improve UI later
        try {
            await unequipVehicleSet(setId, odometer, locationId || 'warehouse-1'); // FIX: Use real location selection
            showToast('Комплект снят', 'success');
            onRefresh();
        } catch (e: any) {
            showToast(e.message, 'error');
        }
    };

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center">
                <h3 className="text-lg font-medium text-gray-900 dark:text-white">Комплекты шин/дисков</h3>
                <Button size="sm" onClick={handleCreate} leftIcon={<PlusIcon className="w-4 h-4" />}>
                    Добавить комплект
                </Button>
            </div>

            <div className="space-y-2">
                {sets.length === 0 && <p className="text-gray-500 text-sm">Нет комплектов</p>}
                {sets.map(set => (
                    <div key={set.id} className="border dark:border-gray-700 rounded-lg p-3 flex justify-between items-center bg-gray-50 dark:bg-gray-800">
                        <div>
                            <div className="flex items-center gap-2">
                                <span className="font-semibold text-gray-900 dark:text-white">
                                    {set.season === 'SUMMER' ? '☀️ Летние' : set.season === 'WINTER' ? '❄️ Зимние' : '🌤 Всесезон'}
                                </span>
                                <span className="text-sm text-gray-600 dark:text-gray-400">({set.spec})</span>
                                <Badge variant={set.status === 'IN_USE' ? 'success' : 'neutral'}>
                                    {set.status === 'IN_USE' ? 'Установлен' : set.status === 'STORED' ? 'На складе' : 'Списан'}
                                </Badge>
                            </div>
                            <div className="text-xs text-gray-500 mt-1">
                                Износ: {set.wearPct}%
                            </div>
                        </div>
                        <div className="flex gap-2">
                            {set.status === 'STORED' && (
                                <Button size="sm" variant="secondary" onClick={() => handleEquip(set.id)}>
                                    Установить
                                </Button>
                            )}
                            {set.status === 'IN_USE' && (
                                <Button size="sm" variant="secondary" onClick={() => handleUnequip(set.id)}>
                                    Снять
                                </Button>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};
