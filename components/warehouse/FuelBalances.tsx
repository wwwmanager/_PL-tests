import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { getStockBalances, getStockItems } from '../../services/api/stockApi';
import { LocationBalance, GarageStockItem } from '../../types';
import { useToast } from '../../hooks/useToast';

const FuelBalances: React.FC = () => {
    const [balances, setBalances] = useState<LocationBalance[]>([]);
    const [items, setItems] = useState<GarageStockItem[]>([]);
    const [loading, setLoading] = useState(false);
    const [asOf, setAsOf] = useState(new Date().toISOString().slice(0, 16));

    const [filters, setFilters] = useState({
        stockItemId: '',
        locationType: '',
    });

    const { showToast } = useToast();

    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            // First load items if not loaded yet
            let currentItems = items;
            if (items.length === 0) {
                currentItems = await getStockItems(true);
                setItems(currentItems);
            }

            // Set default stockItemId if not set
            let effectiveStockItemId = filters.stockItemId;
            if (!effectiveStockItemId && currentItems.length > 0) {
                effectiveStockItemId = currentItems[0].id;
                setFilters(prev => ({ ...prev, stockItemId: effectiveStockItemId }));
            }

            // Only fetch balances if we have a stockItemId
            if (effectiveStockItemId) {
                const balancesData = await getStockBalances(effectiveStockItemId, new Date(asOf));
                setBalances(balancesData);
            }
        } catch (err: any) {
            showToast('Ошибка загрузки данных: ' + err.message, 'error');
        } finally {
            setLoading(false);
        }
    }, [asOf, filters.stockItemId, showToast, items.length]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const filteredBalances = useMemo(() => {
        return balances.filter(b => {
            const matchItem = !filters.stockItemId || b.stockItemId === filters.stockItemId;
            const matchType = !filters.locationType || b.locationType === filters.locationType;
            return matchItem && matchType;
        });
    }, [balances, filters]);

    const handleFilterChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFilters(prev => ({ ...prev, [name]: value }));
    };

    const getLocationTypeLabel = (type: string) => {
        switch (type) {
            case 'WAREHOUSE': return '🏭 Склад';
            case 'FUEL_CARD': return '💳 Карта';
            case 'VEHICLE_TANK': return '🚛 Бак ТС';
            default: return type;
        }
    };

    return (
        <div className="p-4 space-y-4">
            {/* Filters */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
                <div>
                    <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">На дату/время</label>
                    <input
                        type="datetime-local"
                        value={asOf}
                        onChange={(e) => setAsOf(e.target.value)}
                        className="w-full text-sm bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 dark:text-white"
                    />
                </div>
                <div>
                    <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Товар</label>
                    <select
                        name="stockItemId"
                        value={filters.stockItemId}
                        onChange={handleFilterChange}
                        className="w-full text-sm bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 dark:text-white"
                    >
                        <option value="">Все товары</option>
                        {items.map(item => (
                            <option key={item.id} value={item.id}>{item.name}</option>
                        ))}
                    </select>
                </div>
                <div>
                    <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Тип локации</label>
                    <select
                        name="locationType"
                        value={filters.locationType}
                        onChange={handleFilterChange}
                        className="w-full text-sm bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 dark:text-white"
                    >
                        <option value="">Все типы</option>
                        <option value="WAREHOUSE">Склады</option>
                        <option value="FUEL_CARD">Топливные карты</option>
                        <option value="VEHICLE_TANK">Баки ТС</option>
                    </select>
                </div>
                <div className="flex items-end">
                    <button
                        onClick={loadData}
                        disabled={loading}
                        className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors w-full md:w-auto"
                    >
                        Обновить
                    </button>
                </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto border dark:border-gray-700 rounded-lg shadow-sm">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                    <thead className="bg-gray-50 dark:bg-gray-800">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Локация</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Тип</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Товар</th>
                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Остаток</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Ед. изм.</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-800">
                        {loading ? (
                            <tr>
                                <td colSpan={5} className="px-6 py-12 text-center text-gray-500">Загрузка...</td>
                            </tr>
                        ) : filteredBalances.length === 0 ? (
                            <tr>
                                <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                                    Нет данных об остатках на выбранную дату
                                </td>
                            </tr>
                        ) : (
                            filteredBalances.map((b, idx) => (
                                <tr key={`${b.locationId}-${b.stockItemId || idx}`} className="hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                                        {b.locationName}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-300">
                                        {getLocationTypeLabel(b.locationType)}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-300">
                                        {b.stockItemName}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right">
                                        <span className={`font-bold ${b.balance < 0 ? 'text-red-600' : 'text-green-600'}`}>
                                            {b.balance.toLocaleString('ru-RU', { minimumFractionDigits: 2 })}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                                        {b.unit}
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default FuelBalances;
