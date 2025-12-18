import React, { useState, useEffect } from 'react';
import { getWaybills } from '../../services/api/waybillApi';
import { getVehicles } from '../../services/api/vehicleApi';
import { getEmployees } from '../../services/api/employeeApi';
import { Waybill, WaybillStatus, Employee, Vehicle } from '../../types';
import { useToast } from '../../hooks/useToast';

// Utility: Each completed waybill represents 1 pre-trip medical exam
const getMedicalExamsCount = (waybill: Waybill): number => 1;


interface InspectionRow {
    driverId: string;
    driverName: string;
    vehicleId: string;
    vehiclePlate: string;
    inspectionDate: string;
    waybillNumber: string;
    waybillId: string;
}

interface InspectionSummary {
    driverId: string;
    driverName: string;
    totalInspections: number;
    inspectionDates: string[];
    vehiclesUsed: string[];
}

const PreTripInspectionReport: React.FC = () => {
    const [filters, setFilters] = useState({
        dateFrom: '',
        dateTo: '',
        driverId: '',
        vehicleId: '',
        organizationId: ''
    });

    const [drivers, setDrivers] = useState<Employee[]>([]);
    const [vehicles, setVehicles] = useState<Vehicle[]>([]);
    const [reportData, setReportData] = useState<InspectionRow[] | null>(null);
    const [summaryData, setSummaryData] = useState<InspectionSummary[] | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [viewMode, setViewMode] = useState<'detailed' | 'summary'>('summary');
    const { showToast } = useToast();

    useEffect(() => {
        const loadData = async () => {
            const driversData = await getEmployees(); // TODO: filter by employeeType=driver
            const vehiclesData = await getVehicles();
            setDrivers(driversData.filter(e => e.employeeType === 'driver'));
            setVehicles(vehiclesData);
        };
        loadData();
    }, []);

    const handleFilterChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        setFilters(prev => ({ ...prev, [e.target.name]: e.target.value }));
    };

    const handleGenerateReport = async () => {
        if (!filters.dateFrom || !filters.dateTo) {
            setError('Пожалуйста, укажите период дат.');
            setReportData(null);
            setSummaryData(null);
            return;
        }

        setIsLoading(true);
        setError(null);
        setReportData(null);
        setSummaryData(null);

        try {
            const { waybills: allWaybills } = await getWaybills();

            // Фильтруем путевые листы
            let filteredWaybills = allWaybills.filter(w =>
                w.date >= filters.dateFrom &&
                w.date <= filters.dateTo &&
                (w.status === WaybillStatus.POSTED || w.status === WaybillStatus.SUBMITTED)
            );

            if (filters.driverId) {
                filteredWaybills = filteredWaybills.filter(w => w.driverId === filters.driverId);
            }

            if (filters.vehicleId) {
                filteredWaybills = filteredWaybills.filter(w => w.vehicleId === filters.vehicleId);
            }

            if (filteredWaybills.length === 0) {
                setError('По данному периоду не найдено путевых листов.');
                setIsLoading(false);
                return;
            }

            // Создаем детальный отчет
            const detailedData: InspectionRow[] = [];
            const driverInspectionMap = new Map<string, InspectionSummary>();

            filteredWaybills.forEach(w => {
                const driver = drivers.find(d => d.id === w.driverId);
                const vehicle = vehicles.find(v => v.id === w.vehicleId);
                const inspectionCount = getMedicalExamsCount(w);

                if (!driver || !vehicle) return;

                // Получаем уникальные даты из маршрутов
                const uniqueDates = new Set<string>();
                if (w.routes && w.routes.length > 0) {
                    w.routes.forEach(r => {
                        const d = r.date ? r.date : w.date;
                        if (d) uniqueDates.add(d);
                    });
                } else if (w.date) {
                    uniqueDates.add(w.date);
                }

                // Добавляем каждую дату как отдельный осмотр
                uniqueDates.forEach(date => {
                    detailedData.push({
                        driverId: w.driverId,
                        driverName: driver.shortName,
                        vehicleId: w.vehicleId,
                        vehiclePlate: vehicle.registrationNumber,
                        inspectionDate: date,
                        waybillNumber: w.number,
                        waybillId: w.id
                    });

                    // Обновляем сводные данные
                    if (!driverInspectionMap.has(w.driverId)) {
                        driverInspectionMap.set(w.driverId, {
                            driverId: w.driverId,
                            driverName: driver.shortName,
                            totalInspections: 0,
                            inspectionDates: [],
                            vehiclesUsed: []
                        });
                    }

                    const summary = driverInspectionMap.get(w.driverId)!;
                    summary.totalInspections++;
                    if (!summary.inspectionDates.includes(date)) {
                        summary.inspectionDates.push(date);
                    }
                    if (!summary.vehiclesUsed.includes(vehicle.registrationNumber)) {
                        summary.vehiclesUsed.push(vehicle.registrationNumber);
                    }
                });
            });

            // Сортируем данные
            detailedData.sort((a, b) => {
                const dateCompare = b.inspectionDate.localeCompare(a.inspectionDate);
                if (dateCompare !== 0) return dateCompare;
                return a.driverName.localeCompare(b.driverName);
            });

            const summaryArray = Array.from(driverInspectionMap.values())
                .sort((a, b) => b.totalInspections - a.totalInspections);

            setReportData(detailedData);
            setSummaryData(summaryArray);
            setIsLoading(false);
        } catch (err) {
            setError('Ошибка при формировании отчета: ' + (err as Error).message);
            setIsLoading(false);
        }
    };

    const handleExport = () => {
        if (!reportData || !summaryData) {
            showToast('Сначала сформируйте отчёт.', 'error');
            return;
        }

        const data = viewMode === 'summary' ? summaryData : reportData;

        let csvContent: string;
        if (viewMode === 'summary') {
            csvContent = [
                ['Водитель', 'Всего осмотров', 'Уникальных дат', 'Транспортные средства'].join('\t'),
                ...summaryData.map(row => [
                    row.driverName,
                    row.totalInspections,
                    row.inspectionDates.length,
                    row.vehiclesUsed.join(', ')
                ].join('\t'))
            ].join('\n');
        } else {
            csvContent = [
                ['Дата осмотра', 'Водитель', 'Транспортное средство', 'Номер путевого листа'].join('\t'),
                ...reportData.map(row => [
                    row.inspectionDate,
                    row.driverName,
                    row.vehiclePlate,
                    row.waybillNumber
                ].join('\t'))
            ].join('\n');
        }

        const blob = new Blob(["\ufeff", csvContent], { type: 'text/tab-separated-values;charset=utf-8;' });
        const link = document.createElement("a");
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        link.setAttribute("download", `pretrip_inspections_${filters.dateFrom}_${filters.dateTo}.xlsx`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        showToast('Файл экспортирован.', 'success');
    };

    const formatDate = (dateStr: string) => {
        const date = new Date(dateStr);
        return date.toLocaleDateString('ru-RU', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        });
    };

    return (
        <div>
            {/* Фильтры */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-6 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <input
                    type="date"
                    name="dateFrom"
                    value={filters.dateFrom}
                    onChange={handleFilterChange}
                    placeholder="Дата от"
                    className="bg-white dark:bg-gray-600 border border-gray-300 dark:border-gray-500 rounded-md p-2"
                />
                <input
                    type="date"
                    name="dateTo"
                    value={filters.dateTo}
                    onChange={handleFilterChange}
                    placeholder="Дата до"
                    className="bg-white dark:bg-gray-600 border border-gray-300 dark:border-gray-500 rounded-md p-2"
                />
                <select
                    name="driverId"
                    value={filters.driverId}
                    onChange={handleFilterChange}
                    className="bg-white dark:bg-gray-600 border border-gray-300 dark:border-gray-500 rounded-md p-2"
                >
                    <option value="">Все водители</option>
                    {drivers.filter(d => d.employeeType === 'driver').map(d => (
                        <option key={d.id} value={d.id}>{d.shortName}</option>
                    ))}
                </select>
                <select
                    name="vehicleId"
                    value={filters.vehicleId}
                    onChange={handleFilterChange}
                    className="bg-white dark:bg-gray-600 border border-gray-300 dark:border-gray-500 rounded-md p-2"
                >
                    <option value="">Все ТС</option>
                    {vehicles.map(v => (
                        <option key={v.id} value={v.id}>{v.registrationNumber} - {v.brand}</option>
                    ))}
                </select>
                <button
                    onClick={handleGenerateReport}
                    disabled={isLoading}
                    className="bg-blue-600 text-white font-semibold py-2 px-4 rounded-lg shadow-md hover:bg-blue-700 transition-colors disabled:bg-blue-400"
                >
                    {isLoading ? 'Загрузка...' : 'Сформировать'}
                </button>
            </div>

            {error && <p className="text-center p-4 text-red-500">{error}</p>}

            {(reportData || summaryData) && (
                <>
                    {/* Переключатель режимов и экспорт */}
                    <div className="flex justify-between items-center mb-4">
                        <div className="flex gap-2">
                            <button
                                onClick={() => setViewMode('summary')}
                                className={`px-4 py-2 rounded-lg font-semibold transition-colors ${viewMode === 'summary'
                                    ? 'bg-blue-600 text-white'
                                    : 'bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-500'
                                    }`}
                            >
                                Сводный отчет
                            </button>
                            <button
                                onClick={() => setViewMode('detailed')}
                                className={`px-4 py-2 rounded-lg font-semibold transition-colors ${viewMode === 'detailed'
                                    ? 'bg-blue-600 text-white'
                                    : 'bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-500'
                                    }`}
                            >
                                Детальный отчет
                            </button>
                        </div>
                        <button
                            onClick={handleExport}
                            className="bg-green-600 text-white font-semibold py-2 px-4 rounded-lg shadow-md hover:bg-green-700 transition-colors"
                        >
                            Экспорт в Excel
                        </button>
                    </div>

                    {/* Сводная таблица */}
                    {viewMode === 'summary' && summaryData && (
                        <div className="overflow-x-auto shadow-md rounded-lg">
                            <table className="w-full text-sm text-left text-gray-500 dark:text-gray-400">
                                <thead className="text-xs text-gray-700 uppercase bg-gray-50 dark:bg-gray-700 dark:text-gray-400">
                                    <tr>
                                        <th scope="col" className="px-6 py-3">№</th>
                                        <th scope="col" className="px-6 py-3">Водитель</th>
                                        <th scope="col" className="px-6 py-3">Всего осмотров</th>
                                        <th scope="col" className="px-6 py-3">Уникальных дат</th>
                                        <th scope="col" className="px-6 py-3">Транспортные средства</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {summaryData.map((row, index) => (
                                        <tr
                                            key={row.driverId}
                                            className="bg-white dark:bg-gray-800 border-b dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700"
                                        >
                                            <td className="px-6 py-4">{index + 1}</td>
                                            <td className="px-6 py-4 font-medium text-gray-900 dark:text-white">
                                                {row.driverName}
                                            </td>
                                            <td className="px-6 py-4 text-right">{row.totalInspections}</td>
                                            <td className="px-6 py-4 text-right">{row.inspectionDates.length}</td>
                                            <td className="px-6 py-4">{row.vehiclesUsed.join(', ')}</td>
                                        </tr>
                                    ))}
                                    {summaryData.length === 0 && (
                                        <tr>
                                            <td colSpan={5} className="px-6 py-4 text-center text-gray-500">
                                                Нет данных для отображения
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {/* Детальная таблица */}
                    {viewMode === 'detailed' && reportData && (
                        <div className="overflow-x-auto shadow-md rounded-lg">
                            <table className="w-full text-sm text-left text-gray-500 dark:text-gray-400">
                                <thead className="text-xs text-gray-700 uppercase bg-gray-50 dark:bg-gray-700 dark:text-gray-400">
                                    <tr>
                                        <th scope="col" className="px-6 py-3">№</th>
                                        <th scope="col" className="px-6 py-3">Дата осмотра</th>
                                        <th scope="col" className="px-6 py-3">Водитель</th>
                                        <th scope="col" className="px-6 py-3">Транспортное средство</th>
                                        <th scope="col" className="px-6 py-3">Номер путевого листа</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {reportData.map((row, index) => (
                                        <tr
                                            key={`${row.waybillId}-${row.inspectionDate}`}
                                            className="bg-white dark:bg-gray-800 border-b dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700"
                                        >
                                            <td className="px-6 py-4">{index + 1}</td>
                                            <td className="px-6 py-4">{formatDate(row.inspectionDate)}</td>
                                            <td className="px-6 py-4 font-medium text-gray-900 dark:text-white">
                                                {row.driverName}
                                            </td>
                                            <td className="px-6 py-4">{row.vehiclePlate}</td>
                                            <td className="px-6 py-4">{row.waybillNumber}</td>
                                        </tr>
                                    ))}
                                    {reportData.length === 0 && (
                                        <tr>
                                            <td colSpan={5} className="px-6 py-4 text-center text-gray-500">
                                                Нет данных для отображения
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {/* Статистика */}
                    <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
                            <div className="text-sm text-blue-600 dark:text-blue-400 font-semibold">
                                Всего осмотров
                            </div>
                            <div className="text-2xl font-bold text-blue-900 dark:text-blue-200 mt-1">
                                {reportData?.length || 0}
                            </div>
                        </div>
                        <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg">
                            <div className="text-sm text-green-600 dark:text-green-400 font-semibold">
                                Водителей
                            </div>
                            <div className="text-2xl font-bold text-green-900 dark:text-green-200 mt-1">
                                {summaryData?.length || 0}
                            </div>
                        </div>
                        <div className="bg-purple-50 dark:bg-purple-900/20 p-4 rounded-lg">
                            <div className="text-sm text-purple-600 dark:text-purple-400 font-semibold">
                                Среднее на водителя
                            </div>
                            <div className="text-2xl font-bold text-purple-900 dark:text-purple-200 mt-1">
                                {summaryData && summaryData.length > 0
                                    ? (reportData!.length / summaryData.length).toFixed(1)
                                    : '0'}
                            </div>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
};

export default PreTripInspectionReport;
