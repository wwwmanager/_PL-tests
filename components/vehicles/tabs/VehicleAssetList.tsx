import React, { useState } from 'react';
import { VehicleAsset, createVehicleAsset, AssetKind, decommissionVehicleAsset, WearMode } from '../../../services/vehicleAssetApi';
import { useToast } from '../../../hooks/useToast';
import { Button } from '../../shared/Button';
import { PlusIcon } from '../../Icons';
import { Badge } from '../../shared/Badge';

interface VehicleAssetListProps {
    vehicleId: string;
    assets: VehicleAsset[];
    onRefresh: () => void;
}

export const VehicleAssetList: React.FC<VehicleAssetListProps> = ({ vehicleId, assets, onRefresh }) => {
    const { showToast } = useToast();
    const [loading, setLoading] = useState(false);

    const handleCreate = async () => {
        // Placeholder for create logic
        const dummyAsset = {
            vehicleId,
            kind: 'BATTERY' as AssetKind,
            serialNo: 'SN-' + Date.now(),
            installedAt: new Date().toISOString(),
            wearMode: 'BY_MONTHS' as WearMode,
            serviceLifeMonths: 24,
            initialWearPct: 0
        };
        try {
            setLoading(true);
            await createVehicleAsset(dummyAsset);
            showToast('Актив добавлен', 'success');
            onRefresh();
        } catch (e: any) {
            showToast(e.message, 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleDecommission = async (id: string) => {
        if (!confirm('Списать актив?')) return;
        try {
            await decommissionVehicleAsset(id, 'Decommissioned by user');
            showToast('Актив списан', 'success');
            onRefresh();
        } catch (e: any) {
            showToast(e.message, 'error');
        }
    };

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center">
                <h3 className="text-lg font-medium text-gray-900 dark:text-white">Активы (АКБ, Агрегаты)</h3>
                <Button size="sm" onClick={handleCreate} leftIcon={<PlusIcon className="w-4 h-4" />}>
                    Добавить актив
                </Button>
            </div>

            <div className="space-y-2">
                {assets.length === 0 && <p className="text-gray-500 text-sm">Нет активов</p>}
                {assets.map(asset => (
                    <div key={asset.id} className="border dark:border-gray-700 rounded-lg p-3 flex justify-between items-center bg-gray-50 dark:bg-gray-800">
                        <div>
                            <div className="flex items-center gap-2">
                                <span className="font-semibold text-gray-900 dark:text-white">
                                    {asset.kind === 'BATTERY' ? '🔋 АКБ' : '⚙️ Агрегат'}
                                </span>
                                <span className="text-sm text-gray-600 dark:text-gray-400">#{asset.serialNo || 'Без номера'}</span>
                                <Badge variant={asset.status === 'IN_USE' ? 'success' : 'neutral'}>
                                    {asset.status === 'IN_USE' ? 'В работе' : 'Списан'}
                                </Badge>
                            </div>
                            <div className="text-xs text-gray-500 mt-1">
                                Износ: {(Number(asset.wearPct) || 0).toFixed(1)}% ({asset.wearMode === 'BY_MILEAGE' ? 'по пробегу' : 'по времени'})
                            </div>
                        </div>
                        <div>
                            {asset.status === 'IN_USE' && (
                                <Button size="sm" variant="ghost" className="text-red-600 hover:text-red-700 hover:bg-red-50" onClick={() => handleDecommission(asset.id)}>
                                    Списать
                                </Button>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};
