import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { getStockBalances, getStockItems, getStockLocations } from '../../services/api/stockApi';
import { getVehicles } from '../../services/api/vehicleApi';
import { LocationBalance, GarageStockItem, StockLocation, Vehicle } from '../../types';
import { useToast } from '../../hooks/useToast';
import DataTable from '../shared/DataTable';

const FuelBalances: React.FC = () => {
    // ... (state declarations remain same)
    const [balances, setBalances] = useState<LocationBalance[]>([]);

    const [items, setItems] = useState<GarageStockItem[]>([]);
    const [vehicles, setVehicles] = useState<Vehicle[]>([]);
    const [locations, setLocations] = useState<StockLocation[]>([]);
    const [loading, setLoading] = useState(false);
    const [asOf, setAsOf] = useState(new Date().toISOString().slice(0, 16));

    const [filters, setFilters] = useState({
        stockItemId: '',
        locationType: '',
    });

    const { showToast } = useToast();

    // ... (loadData remains same)

    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            // First load items if not loaded yet
            let currentItems = items;
            if (items.length === 0) {
                currentItems = await getStockItems(true);
                setItems(currentItems);
            }

            // Load metadata (vehicles, locations) if not loaded
            if (vehicles.length === 0) {
                const [vData, lData] = await Promise.all([
                    getVehicles({}),
                    getStockLocations()
                ]);
                setVehicles(vData);
                setLocations(lData);
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
    }, [asOf, filters.stockItemId, showToast, items.length, vehicles.length]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const getDriverForLocation = useCallback((locationId: string, type: string) => {
        if (type !== 'VEHICLE_TANK') return null;

        const loc = locations.find(l => l.id === locationId);
        if (!loc || !loc.vehicleId) return null;

        const vehicle = vehicles.find(v => v.id === loc.vehicleId);
        if (!vehicle || !vehicle.assignedDriver) return null;

        return vehicle.assignedDriver.fullName;
    }, [locations, vehicles]);

    const filteredBalances = useMemo(() => {
        return balances.filter(b => {
            const matchItem = !filters.stockItemId || b.stockItemId === filters.stockItemId;
            const matchType = !filters.locationType || b.locationType === filters.locationType;
            return matchItem && matchType;
        }).map(b => {
            // Enrich with driver name for DataTable filtering/sorting
            const driverName = getDriverForLocation(b.locationId, b.locationType);
            return {
                ...b,
                driver: driverName || ''
            };
        });
    }, [balances, filters, getDriverForLocation]);

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

    const columns = [
        {
            key: 'locationName',
            label: 'Локация',
            sortable: true,
            render: (row: LocationBalance) => <span className="text-sm font-medium text-gray-900 dark:text-white">{row.locationName}</span>
        },
        {
            key: 'locationType',
            label: 'Тип',
            sortable: true,
            render: (row: LocationBalance) => (
                <span className="text-sm text-gray-600 dark:text-gray-300">
                    {getLocationTypeLabel(row.locationType)}
                </span>
            )
        },
        {
            key: 'stockItemName',
            label: 'Товар',
            sortable: true,
            render: (row: LocationBalance) => <span className="text-sm text-gray-600 dark:text-gray-300">{row.stockItemName}</span>
        },
        {
            key: 'balance',
            label: 'Остаток',
            sortable: true,
            render: (row: LocationBalance) => (
                <span className={`font-bold ${row.balance < 0 ? 'text-red-600' : 'text-green-600'}`}>
                    {row.balance.toLocaleString('ru-RU', { minimumFractionDigits: 2 })}
                </span>
            )
        },
        {
            key: 'unit',
            label: 'Ед. изм.',
            sortable: true,
            render: (row: LocationBalance) => <span className="text-sm text-gray-500 dark:text-gray-400">{row.unit}</span>
        },
        {
            key: 'driver',
            label: 'Водитель / Ответственный',
            sortable: false,
            render: (row: LocationBalance) => {
                // Driver name is already enriched in filteredBalances
                return <span className="text-sm font-medium text-gray-800 dark:text-gray-200">{(row as any).driver || '-'}</span>;
            }
        },

    ];

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
            <div className="bg-white dark:bg-gray-800 border dark:border-gray-700 rounded-lg shadow-sm">
                {loading ? (
                    <div className="p-12 text-center text-gray-500">Загрузка...</div>
                ) : (
                    <DataTable
                        columns={columns}
                        data={filteredBalances}
                        keyField="locationId" // Assuming unique by locationId here since filtered by single stockItem usually
                        emptyMessage="Нет данных об остатках на выбранную дату"
                        searchable={true}
                    />
                )}
            </div>
        </div>
    );
};

export default FuelBalances;
