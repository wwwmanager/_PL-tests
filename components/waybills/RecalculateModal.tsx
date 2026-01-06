import React, { useState } from 'react';
import { XIcon, CalculatorIcon } from '../Icons';
import { Vehicle } from '../../types';
import { useToast } from '../../hooks/useToast';
import { recalculateWaybills } from '../../services/api/waybillApi';

interface RecalculateModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    onSuccess: () => void;
    vehicles: Vehicle[];
    onOpenWaybill?: (id: string) => void;
}

export const RecalculateModal: React.FC<RecalculateModalProps> = ({
    isOpen,
    onClose,
    onSuccess,
    vehicles,
    onOpenWaybill
}) => {
    const { showToast } = useToast();
    const [isLoading, setIsLoading] = useState(false);
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');

    const [vehicleId, setVehicleId] = useState('');
    const [result, setResult] = useState<{ updated: number; total: number } | null>(null);
    const [errorData, setErrorData] = useState<{ message: string; waybillId?: string } | null>(null);

    const handleRecalculate = async () => {
        if (!dateFrom || !dateTo) {
            showToast('Укажите период для пересчёта', 'error');
            return;
        }

        setIsLoading(true);
        setResult(null);
        setErrorData(null);

        try {
            const response = await recalculateWaybills({
                dateFrom,
                dateTo,
                vehicleId: vehicleId || undefined
            });

            setResult({ updated: response.updated, total: response.total });
            showToast(`Пересчитано: ${response.updated} из ${response.total} ПЛ`, 'success');
            onSuccess();
        } catch (error) {
            console.error('Recalculation error:', error);
            const msg = (error as Error).message || 'Неизвестная ошибка';
            const idMatch = msg.match(/\[ID:([a-fA-F0-9-]+)\]/);
            const cleanMsg = msg.replace(/\[ID:[a-fA-F0-9-]+\]/, '').trim();

            setErrorData({
                message: cleanMsg,
                waybillId: idMatch ? idMatch[1] : undefined
            });
            // Don't show toast if we show inline error, or show generic
            if (!idMatch) {
                showToast('Ошибка пересчёта: ' + msg, 'error');
            }
        } finally {
            setIsLoading(false);
        }
    };

    const handleClose = () => {
        setResult(null);
        setDateFrom('');
        setDateTo('');
        setVehicleId('');
        setErrorData(null);
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 overflow-y-auto">
            <div className="flex min-h-full items-center justify-center p-4">
                {/* Backdrop */}
                <div className="fixed inset-0 bg-black/50 transition-opacity" onClick={handleClose} />

                {/* Modal */}
                <div className="relative bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-md p-6 transform transition-all">
                    {/* Header */}
                    <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                                <CalculatorIcon className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                            </div>
                            <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                                Пересчёт расхода топлива
                            </h3>
                        </div>
                        <button
                            onClick={handleClose}
                            className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                        >
                            <XIcon className="h-6 w-6 text-gray-500" />
                        </button>
                    </div>

                    {/* Form */}
                    <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                    Дата с *
                                </label>
                                <input
                                    type="date"
                                    value={dateFrom}
                                    onChange={(e) => setDateFrom(e.target.value)}
                                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                    Дата по *
                                </label>
                                <input
                                    type="date"
                                    value={dateTo}
                                    onChange={(e) => setDateTo(e.target.value)}
                                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                Транспортное средство
                            </label>
                            <select
                                value={vehicleId}
                                onChange={(e) => setVehicleId(e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            >
                                <option value="">Все ТС</option>
                                {vehicles.map(v => (
                                    <option key={v.id} value={v.id}>
                                        {v.brand} {v.registrationNumber}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* Result */}
                        {result && (
                            <div className="p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                                <p className="text-green-800 dark:text-green-300 font-medium">
                                    ✅ Пересчитано: {result.updated} из {result.total} путевых листов
                                </p>
                            </div>
                        )}

                        {errorData && (
                            <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                                <p className="text-red-800 dark:text-red-300 font-medium mb-2">
                                    ❌ {errorData.message}
                                </p>
                                {errorData.waybillId && onOpenWaybill && (
                                    <button
                                        onClick={() => {
                                            if (errorData.waybillId && onOpenWaybill) {
                                                onOpenWaybill(errorData.waybillId);
                                                // Optional: don't close modal to allow returning? 
                                                // usually modal overlays detail, so we might need to close or handle stack.
                                                // For now, let's keep it open or close it? 
                                                // Better to close Recalculate modal so Waybill Detail can be seen if it opens in a modal too or checks focus.
                                                // But usually Detail is a slider or modal. Let's close this one.
                                                onClose();
                                            }
                                        }}
                                        className="text-sm bg-red-100 hover:bg-red-200 text-red-800 px-3 py-1 rounded-md font-semibold transition-colors border border-red-300"
                                    >
                                        Открыть путевой лист
                                    </button>
                                )}
                            </div>
                        )}

                        {/* Hint */}
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                            Будут пересчитаны значения "Расход план" и "Расход факт" для всех ПЛ за указанный период
                            с использованием актуальных норм расхода и сезонных настроек.
                        </p>
                    </div>

                    {/* Footer */}
                    <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
                        <button
                            onClick={handleClose}
                            className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg font-medium transition-colors"
                        >
                            Закрыть
                        </button>
                        <button
                            onClick={handleRecalculate}
                            disabled={isLoading || !dateFrom || !dateTo}
                            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-lg font-medium transition-colors flex items-center gap-2"
                        >
                            {isLoading ? (
                                <>
                                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                    </svg>
                                    Пересчёт...
                                </>
                            ) : (
                                <>
                                    <CalculatorIcon className="h-4 w-4" />
                                    Пересчитать
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
