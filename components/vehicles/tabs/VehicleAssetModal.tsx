import React, { useState } from 'react';
import Modal from '../../shared/Modal';
import { CreateVehicleAssetInput, AssetKind, WearMode } from '../../../services/vehicleAssetApi';
import { Button } from '../../shared/Button';

interface VehicleAssetModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (data: any) => Promise<void>; // using any temporarily to match input shape adjust
    vehicleId: string;
}

export const VehicleAssetModal: React.FC<VehicleAssetModalProps> = ({ isOpen, onClose, onSubmit, vehicleId }) => {
    const [kind, setKind] = useState<AssetKind>('BATTERY');
    const [serialNo, setSerialNo] = useState('');
    const [installedAt, setInstalledAt] = useState(new Date().toISOString().split('T')[0]);
    const [wearMode, setWearMode] = useState<WearMode>('BY_MONTHS');
    const [serviceLifeMonths, setServiceLifeMonths] = useState(24);
    const [wearPctPer1000km, setWearPctPer1000km] = useState(0.5);
    const [initialWearPct, setInitialWearPct] = useState(0);
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setLoading(true);
        try {
            await onSubmit({
                vehicleId,
                kind,
                serialNo,
                installedAt: new Date(installedAt).toISOString(),
                wearMode,
                serviceLifeMonths: wearMode === 'BY_MONTHS' ? serviceLifeMonths : undefined,
                wearPctPer1000km: wearMode === 'BY_MILEAGE' ? wearPctPer1000km : undefined,
                initialWearPct,
                // stockItemId? - optionally select from warehouse later
            });
            onClose();
        } finally {
            setLoading(false);
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Добавить актив">
            <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                    <label className="block text-sm font-medium text-gray-700">Тип</label>
                    <select
                        value={kind}
                        onChange={e => setKind(e.target.value as AssetKind)}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm border p-2"
                    >
                        <option value="BATTERY">АКБ</option>
                        <option value="AGGREGATE">Агрегат</option>
                    </select>
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700">Серийный номер</label>
                    <input
                        type="text"
                        value={serialNo}
                        onChange={e => setSerialNo(e.target.value)}
                        required
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm border p-2"
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700">Дата установки</label>
                    <input
                        type="date"
                        value={installedAt}
                        onChange={e => setInstalledAt(e.target.value)}
                        required
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm border p-2"
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700">Режим износа</label>
                    <select
                        value={wearMode}
                        onChange={e => setWearMode(e.target.value as WearMode)}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm border p-2"
                    >
                        <option value="BY_MONTHS">По времени (мес)</option>
                        <option value="BY_MILEAGE">По пробегу (км)</option>
                    </select>
                </div>

                {wearMode === 'BY_MONTHS' ? (
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Срок службы (мес)</label>
                        <input
                            type="number"
                            min="1"
                            value={serviceLifeMonths}
                            onChange={e => setServiceLifeMonths(Number(e.target.value))}
                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm border p-2"
                        />
                    </div>
                ) : (
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Износ на 1000 км (%)</label>
                        <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={wearPctPer1000km}
                            onChange={e => setWearPctPer1000km(Number(e.target.value))}
                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm border p-2"
                        />
                    </div>
                )}

                <div>
                    <label className="block text-sm font-medium text-gray-700">Начальный износ (%)</label>
                    <input
                        type="number"
                        min="0"
                        max="100"
                        value={initialWearPct}
                        onChange={e => setInitialWearPct(Number(e.target.value))}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm border p-2"
                    />
                </div>

                <div className="flex justify-end gap-2 pt-4">
                    <Button variant="secondary" onClick={onClose} type="button">Отмена</Button>
                    <Button type="submit" isLoading={loading}>Создать</Button>
                </div>
            </form>
        </Modal>
    );
};
