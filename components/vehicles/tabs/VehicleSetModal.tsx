import React, { useState } from 'react';
import Modal from '../../shared/Modal';
import { CreateSetInput, SetKind, SeasonType } from '../../../services/vehicleSetApi';
import { Button } from '../../shared/Button';

interface VehicleSetModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (data: CreateSetInput) => Promise<void>;
    vehicleId: string;
}

export const VehicleSetModal: React.FC<VehicleSetModalProps> = ({ isOpen, onClose, onSubmit, vehicleId }) => {
    const [kind, setKind] = useState<SetKind>('TIRE');
    const [season, setSeason] = useState<SeasonType>('SUMMER');
    const [spec, setSpec] = useState('');
    const [wearPct, setWearPct] = useState(0);
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setLoading(true);
        try {
            await onSubmit({
                vehicleId,
                kind,
                season,
                spec,
                wearPct
            });
            onClose();
        } finally {
            setLoading(false);
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Добавить комплект">
            <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                    <label className="block text-sm font-medium text-gray-700">Тип</label>
                    <select
                        value={kind}
                        onChange={e => setKind(e.target.value as SetKind)}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm border p-2"
                    >
                        <option value="TIRE">Шины</option>
                        <option value="WHEEL">Диски</option>
                    </select>
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700">Сезонность</label>
                    <select
                        value={season}
                        onChange={e => setSeason(e.target.value as SeasonType)}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm border p-2"
                    >
                        <option value="SUMMER">Лето</option>
                        <option value="WINTER">Зима</option>
                        {/* option value="ALL_SEASON"? Backend only lists Summer/Winter in enum currently, relying on that. */}
                    </select>
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700">Характеристика (Размер)</label>
                    <input
                        type="text"
                        value={spec}
                        onChange={e => setSpec(e.target.value)}
                        placeholder="205/55 R16"
                        required
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm border p-2"
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700">Начальный износ (%)</label>
                    <input
                        type="number"
                        min="0"
                        max="100"
                        value={wearPct}
                        onChange={e => setWearPct(Number(e.target.value))}
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
