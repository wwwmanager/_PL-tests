import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
    LayoutDashboard,
    AlertTriangle,
    CheckCircle,
    FileText,
    Activity,
    Calendar,
    Wrench,
    Users,
    Droplet,
    CreditCard,
    Gauge,
    Search
} from 'lucide-react';
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    AreaChart,
    Area,
    LabelList,
    Legend
} from 'recharts';
import { getDashboardData, DashboardData, DashboardFilters, IssueItem } from '../../services/api/dashboardApi';
import { getVehicles } from '../../services/api/vehicleApi';
import { Vehicle } from '../../types';
import Modal from '../shared/Modal';
import { loadDashboardSettings, DashboardWidgetSettings } from '../admin/DashboardSettings'; // DASH-SETTINGS-001

// Keys for persistence
const STORAGE_DATE_FROM = 'dashboard_dateFrom';
const STORAGE_DATE_TO = 'dashboard_dateTo';

const Dashboard: React.FC = () => {
    // State
    const [data, setData] = useState<DashboardData | null>(null);
    const [loading, setLoading] = useState(false);
    const [vehicles, setVehicles] = useState<Vehicle[]>([]);
    const [widgetSettings, setWidgetSettings] = useState<DashboardWidgetSettings>(loadDashboardSettings()); // DASH-SETTINGS-001

    // Filters State
    const [dateFrom, setDateFrom] = useState(() => localStorage.getItem(STORAGE_DATE_FROM) || '');
    const [dateTo, setDateTo] = useState(() => localStorage.getItem(STORAGE_DATE_TO) || '');
    const [selectedVehicleId, setSelectedVehicleId] = useState<string>('');

    // Modal State
    const [showIssuesModal, setShowIssuesModal] = useState(false);

    // Initial Load - Vehicles
    useEffect(() => {
        getVehicles().then(v => setVehicles(v));
    }, []);

    // Persistence Effect
    useEffect(() => {
        if (dateFrom) localStorage.setItem(STORAGE_DATE_FROM, dateFrom);
        else localStorage.removeItem(STORAGE_DATE_FROM);

        if (dateTo) localStorage.setItem(STORAGE_DATE_TO, dateTo);
        else localStorage.removeItem(STORAGE_DATE_TO);
    }, [dateFrom, dateTo]);

    // Fetch Data
    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const filters: DashboardFilters = {
                vehicleId: selectedVehicleId || undefined,
                dateFrom: dateFrom || undefined,
                dateTo: dateTo || undefined
            };
            const result = await getDashboardData(filters);
            setData(result);
        } catch (error) {
            console.error('Failed to load dashboard data:', error);
        } finally {
            setLoading(false);
        }
    }, [selectedVehicleId, dateFrom, dateTo]);

    // Trigger Fetch on Mount and Filter Change
    useEffect(() => {
        fetchData();
    }, [fetchData]);

    if (!data && loading) return <div className="p-8 text-center">Загрузка данных...</div>;
    if (!data) return <div className="p-8 text-center text-red-500">Ошибка загрузки данных</div>;

    const { kpi } = data;

    // --- Components ---

    const StatusCard = ({ title, value, icon: Icon, color, onClick }: any) => (
        <div
            onClick={onClick}
            className={`bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-100 dark:border-gray-700 flex items-center justify-between ${onClick ? 'cursor-pointer hover:shadow-md transition-shadow' : ''}`}
        >
            <div>
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">{title}</p>
                <h3 className={`text-2xl font-bold ${color}`}>{value}</h3>
            </div>
            <div className={`p-3 rounded-full ${color.replace('text-', 'bg-').replace('600', '50').replace('500', '50')} dark:bg-opacity-20`}>
                <Icon className={`w-6 h-6 ${color}`} />
            </div>
        </div>
    );

    const KpiCard = ({ title, value, unit, icon: Icon, color }: any) => (
        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-100 dark:border-gray-700">
            <div className="flex items-center justify-between mb-4">
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{title}</p>
                <Icon className={`w-5 h-5 ${color}`} />
            </div>
            <div className="flex items-end items-baseline">
                <h3 className="text-2xl font-bold text-gray-900 dark:text-white mr-2">{value}</h3>
                <span className="text-sm text-gray-500 dark:text-gray-400 font-medium">{unit}</span>
            </div>
        </div>
    );

    return (
        <div className="space-y-6">
            {/* Filters */}
            <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 flex flex-col md:flex-row gap-4 items-center justify-between">
                <div className="flex items-center gap-2">
                    <LayoutDashboard className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white tracking-tight">Панель управления</h2>
                </div>

                <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
                    <div className="relative flex-1 md:w-64">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <Search className="h-4 w-4 text-gray-400" />
                        </div>
                        <select
                            value={selectedVehicleId}
                            onChange={(e) => setSelectedVehicleId(e.target.value)}
                            className="block w-full pl-10 pr-10 py-2 text-sm border-gray-300 dark:border-gray-600 focus:ring-blue-500 focus:border-blue-500 rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white appearance-none"
                        >
                            <option value="">Все ТС</option>
                            {vehicles.map(v => (
                                <option key={v.id} value={v.id}>{v.registrationNumber} ({v.brand})</option>
                            ))}
                        </select>
                    </div>
                    <div className="flex items-center gap-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2">
                        <Calendar className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                        <input
                            type="date"
                            value={dateFrom}
                            onChange={(e) => setDateFrom(e.target.value)}
                            className="text-sm border-none p-0 focus:ring-0 text-gray-700 dark:text-gray-200 bg-transparent w-28"
                        />
                        <span className="text-gray-400">-</span>
                        <input
                            type="date"
                            value={dateTo}
                            onChange={(e) => setDateTo(e.target.value)}
                            className="text-sm border-none p-0 focus:ring-0 text-gray-700 dark:text-gray-200 bg-transparent w-28"
                        />
                    </div>
                    <button
                        onClick={fetchData}
                        disabled={loading}
                        className="p-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors dark:bg-blue-900 dark:text-blue-300 dark:hover:bg-blue-800"
                        title="Обновить"
                    >
                        <Activity className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
                    </button>
                </div>
            </div>

            {/* Row 1: Status Cards */}
            {(widgetSettings.showWaybillStats || widgetSettings.showIssues) && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    {widgetSettings.showWaybillStats && (
                        <>
                            <StatusCard
                                title="Черновики"
                                value={kpi.waybillStats.draft}
                                icon={FileText}
                                color="text-gray-500"
                            />
                            <StatusCard
                                title="На проверке"
                                value={kpi.waybillStats.review}
                                icon={Activity}
                                color="text-orange-500"
                            />
                            <StatusCard
                                title="Проведены"
                                value={kpi.waybillStats.posted}
                                icon={CheckCircle}
                                color="text-green-600"
                            />
                        </>
                    )}
                    {widgetSettings.showIssues && (
                        <StatusCard
                            title="Проблемы"
                            value={kpi.issues}
                            icon={AlertTriangle}
                            color={kpi.issues > 0 ? "text-red-600" : "text-gray-400"}
                            onClick={() => setShowIssuesModal(true)}
                        />
                    )}
                </div>
            )}

            {/* Row 2: KPI Cards */}
            {widgetSettings.showKpiCards && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    <KpiCard
                        title="Одометр"
                        value={kpi.totalOdometer !== null ? kpi.totalOdometer.toLocaleString() : '---'}
                        unit={kpi.totalOdometer !== null ? 'км' : ''}
                        icon={Gauge}
                        color="text-blue-600"
                    />
                    <KpiCard
                        title="Остаток в баках"
                        value={kpi.totalFuelBalance.toLocaleString()}
                        unit="л"
                        icon={Droplet}
                        color="text-cyan-600"
                    />
                    <KpiCard
                        title="Баланс ТК"
                        value={kpi.totalCardBalance.toLocaleString()}
                        unit="л"
                        icon={CreditCard}
                        color="text-purple-600"
                    />
                    <KpiCard
                        title="Расход за период"
                        value={kpi.fuelPeriod.toLocaleString()}
                        unit="л"
                        icon={Activity}
                        color="text-indigo-600"
                    />
                </div>
            )}

            {/* Row 3: Dynamics Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Fuel Dynamics */}
                {widgetSettings.showFuelChart && (
                    <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
                        <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-6 flex items-center gap-2">
                            Динамика расхода топлива за выбранный период
                            {(dateFrom || dateTo) && (
                                <span className="text-gray-500 dark:text-gray-400 font-normal">
                                    {dateFrom && new Date(dateFrom).toLocaleDateString('ru-RU')}
                                    {dateFrom && dateTo && ' - '}
                                    {dateTo && new Date(dateTo).toLocaleDateString('ru-RU')}
                                </span>
                            )}
                        </h3>
                        <div className="h-80">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={data.fuelConsumptionByMonth} barCategoryGap="20%">
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#374151" strokeOpacity={0.2} />
                                    <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: '#9CA3AF', fontSize: 12, fontWeight: 600 }} dy={10} />
                                    <YAxis
                                        axisLine={false}
                                        tickLine={false}
                                        tick={{ fill: '#9CA3AF', fontSize: 12, fontWeight: 600 }}
                                        tickCount={6}
                                        domain={[0, (max: number) => Math.ceil(max * 1.2)]}
                                        allowDataOverflow={false}
                                    />
                                    <Tooltip
                                        contentStyle={{ backgroundColor: 'rgb(31, 41, 55)', color: '#F9FAFB', borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                        cursor={{ fill: 'rgba(255, 255, 255, 0.05)' }}
                                        formatter={(value: any) => [`${value} л`, 'Факт']}
                                    />
                                    <Legend />
                                    <Bar dataKey="value" fill="#086dccff" fillOpacity={0.5} radius={[4, 4, 0, 0]} name="Факт (л)">
                                        <LabelList dataKey="value" position="top" style={{ fontSize: 12, fill: '#9CA3AF', fontWeight: 'bold' }} />
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                )}

                {/* Medical Exams Dynamics */}
                {widgetSettings.showMedicalChart && (
                    <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
                        <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-6 flex items-center gap-2">
                            Динамика мед. осмотров за выбранный период
                            {(dateFrom || dateTo) && (
                                <span className="text-gray-500 dark:text-gray-400 font-normal">
                                    {dateFrom && new Date(dateFrom).toLocaleDateString('ru-RU')}
                                    {dateFrom && dateTo && ' - '}
                                    {dateTo && new Date(dateTo).toLocaleDateString('ru-RU')}
                                </span>
                            )}
                        </h3>
                        <div className="h-80">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={data.medicalExamsByMonth} barCategoryGap="20%">
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#374151" strokeOpacity={0.2} />
                                    <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: '#9CA3AF', fontSize: 12, fontWeight: 600 }} dy={10} />
                                    <YAxis
                                        axisLine={false}
                                        tickLine={false}
                                        tick={{ fill: '#9CA3AF', fontSize: 12, fontWeight: 600 }}
                                        tickCount={6}
                                        domain={[0, (max: number) => Math.ceil(max * 1.2)]}
                                        allowDataOverflow={false}
                                    />
                                    <Tooltip
                                        contentStyle={{ backgroundColor: 'rgb(31, 41, 55)', color: '#F9FAFB', borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                        cursor={{ fill: 'rgba(255, 255, 255, 0.05)' }}
                                    />
                                    <Legend />
                                    <Bar dataKey="value" fill="#086dccff" fillOpacity={0.5} radius={[4, 4, 0, 0]} name="Осмотров">
                                        <LabelList dataKey="value" position="top" style={{ fontSize: 12, fill: '#9CA3AF', fontWeight: 'bold' }} />
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                )}
            </div>

            {/* Row 4: Top Lists (Charts) */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Top 10 Fuel Consumers */}
                {widgetSettings.showTopFuelVehicles && (
                    <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
                        <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-6">
                            Топ ТС по расходу
                        </h3>
                        <div className="h-80">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={data.topFuelVehicles} barCategoryGap="20%">
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#374151" strokeOpacity={0.2} />
                                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#9CA3AF', fontSize: 11, fontWeight: 600 }} dy={10} interval={0} angle={-45} textAnchor="end" height={100} />
                                    <YAxis
                                        axisLine={false}
                                        tickLine={false}
                                        tick={{ fill: '#9CA3AF', fontSize: 12, fontWeight: 600 }}
                                        tickCount={6}
                                        domain={[0, 'auto']}
                                    />
                                    <Tooltip
                                        contentStyle={{ backgroundColor: 'rgb(31, 41, 55)', color: '#F9FAFB', borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                        cursor={{ fill: 'rgba(255, 255, 255, 0.05)' }}
                                    />
                                    <Legend />
                                    <Bar dataKey="value" fill="#086dccff" fillOpacity={0.5} radius={[4, 4, 0, 0]} name="Расход (л)">
                                        <LabelList dataKey="value" position="top" style={{ fontSize: 12, fill: '#9CA3AF', fontWeight: 'bold' }} />
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                )}

                {/* Driver Exams Stats */}
                {widgetSettings.showDriverExams && (
                    <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
                        <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-6">
                            Количество осмотров по водителям за выбранный период
                            {(dateFrom || dateTo) && (
                                <span className="text-gray-500 dark:text-gray-400 font-normal ml-2">
                                    {dateFrom && new Date(dateFrom).toLocaleDateString('ru-RU')}
                                    {dateFrom && dateTo && ' - '}
                                    {dateTo && new Date(dateTo).toLocaleDateString('ru-RU')}
                                </span>
                            )}
                        </h3>
                        <div className="h-80">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={data.driverExams} barCategoryGap="20%">
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#374151" strokeOpacity={0.2} />
                                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#9CA3AF', fontSize: 11, fontWeight: 600 }} dy={10} interval={0} angle={-45} textAnchor="end" height={100} />
                                    <YAxis
                                        axisLine={false}
                                        tickLine={false}
                                        tick={{ fill: '#9CA3AF', fontSize: 12, fontWeight: 600 }}
                                        tickCount={6}
                                        domain={[0, 'auto']}
                                    />
                                    <Tooltip
                                        contentStyle={{ backgroundColor: 'rgb(31, 41, 55)', color: '#F9FAFB', borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                        cursor={{ fill: 'rgba(255, 255, 255, 0.05)' }}
                                    />
                                    <Legend />
                                    <Bar dataKey="value" fill="#086dccff" fillOpacity={0.5} radius={[4, 4, 0, 0]} name="Осмотров">
                                        <LabelList dataKey="value" position="top" style={{ fontSize: 12, fill: '#9CA3AF', fontWeight: 'bold' }} />
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                )}
            </div>

            {/* Row 5: DASH-EXP-001: Top Vehicles by Expense/Mileage */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Top Vehicles by Fuel Expense (руб) */}
                {widgetSettings.showFuelExpense && (
                    <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
                        <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-6">
                            Сравнение ТС по тратам на топливо
                        </h3>
                        <div className="h-80">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={data.topFuelExpense} layout="vertical" barCategoryGap="15%">
                                    <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#374151" strokeOpacity={0.2} />
                                    <XAxis type="number" domain={[0, (max: number) => Math.ceil(max * 1.2)]} axisLine={false} tickLine={false} tick={{ fill: '#9CA3AF', fontSize: 11, fontWeight: 600 }} tickFormatter={(val) => val.toLocaleString()} />
                                    <YAxis type="category" dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#9CA3AF', fontSize: 11, fontWeight: 600 }} width={100} />
                                    <Tooltip
                                        contentStyle={{ backgroundColor: 'rgb(31, 41, 55)', color: '#F9FAFB', borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                        formatter={(value: any) => [`${value.toLocaleString()} ₽`, 'Расходы']}
                                    />
                                    <Bar dataKey="value" fill="#086dccff" fillOpacity={0.5} radius={[0, 4, 4, 0]}>
                                        <LabelList dataKey="value" position="right" style={{ fontSize: 11, fill: '#9CA3AF', fontWeight: 'bold' }} formatter={(val: number) => val.toLocaleString()} />
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                )}

                {/* Top Vehicles by Other Expenses (без топлива) */}
                {widgetSettings.showOtherExpense && (
                    <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
                        <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-6">
                            Сравнение ТС по тратам (без учета топлива)
                        </h3>
                        <div className="h-80">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={data.topOtherExpense} layout="vertical" barCategoryGap="15%">
                                    <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#374151" strokeOpacity={0.2} />
                                    <XAxis type="number" domain={[0, (max: number) => Math.ceil(max * 1.2)]} axisLine={false} tickLine={false} tick={{ fill: '#9CA3AF', fontSize: 11, fontWeight: 600 }} tickFormatter={(val) => val.toLocaleString()} />
                                    <YAxis type="category" dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#9CA3AF', fontSize: 11, fontWeight: 600 }} width={100} />
                                    <Tooltip
                                        contentStyle={{ backgroundColor: 'rgb(31, 41, 55)', color: '#F9FAFB', borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                        formatter={(value: any) => [`${value.toLocaleString()} ₽`, 'Расходы']}
                                    />
                                    <Bar dataKey="value" fill="#086dccff" fillOpacity={0.5} radius={[0, 4, 4, 0]}>
                                        <LabelList dataKey="value" position="right" style={{ fontSize: 11, fill: '#9CA3AF', fontWeight: 'bold' }} formatter={(val: number) => val.toLocaleString()} />
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                )}

                {/* Top Vehicles by Mileage (км) */}
                {widgetSettings.showMileage && (
                    <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
                        <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-6">
                            Сравнение ТС по пробегу за выбранный период
                        </h3>
                        <div className="h-80">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={data.topMileage} layout="vertical" barCategoryGap="15%">
                                    <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#374151" strokeOpacity={0.2} />
                                    <XAxis type="number" domain={[0, (max: number) => Math.ceil(max * 1.2)]} axisLine={false} tickLine={false} tick={{ fill: '#9CA3AF', fontSize: 11, fontWeight: 600 }} tickFormatter={(val) => val.toLocaleString()} />
                                    <YAxis type="category" dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#9CA3AF', fontSize: 11, fontWeight: 600 }} width={100} />
                                    <Tooltip
                                        contentStyle={{ backgroundColor: 'rgb(31, 41, 55)', color: '#F9FAFB', borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                        formatter={(value: any) => [`${value.toLocaleString()} км`, 'Пробег']}
                                    />
                                    <Bar dataKey="value" fill="#086dccff" fillOpacity={0.5} radius={[0, 4, 4, 0]}>
                                        <LabelList dataKey="value" position="right" style={{ fontSize: 11, fill: '#9CA3AF', fontWeight: 'bold' }} formatter={(val: number) => val.toLocaleString()} />
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                )}
            </div>

            {/* Row 6: Lists (Maintenance & Birthdays) */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* TEMPORARILY HIDDEN: Maintenance List - will be moved to separate module
                <div className="lg:col-span-2 bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                    <h3 className="text-lg font-bold text-gray-900 mb-6 flex items-center gap-2">
                        <Wrench className="w-5 h-5 text-gray-600" />
                        Ближайшие ТО ({data.upcomingMaintenance.length})
                    </h3>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-gray-50 text-gray-500">
                                <tr>
                                    <th className="px-4 py-3 rounded-l-lg">Автомобиль</th>
                                    <th className="px-4 py-3">Остаток (км)</th>
                                    <th className="px-4 py-3 rounded-r-lg">Статус</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {data.upcomingMaintenance.map(m => (
                                    <tr key={m.id} className="hover:bg-gray-50">
                                        <td className="px-4 py-3 font-medium text-gray-900">{m.vehicle}</td>
                                        <td className="px-4 py-3">{m.remainingKm} км</td>
                                        <td className="px-4 py-3">
                                            <span className={`px-2 py-1 rounded text-xs font-medium ${m.status === 'critical' ? 'bg-red-100 text-red-700' :
                                                m.status === 'warning' ? 'bg-orange-100 text-orange-700' :
                                                    'bg-yellow-100 text-yellow-700'
                                                }`}>
                                                {m.status === 'critical' ? 'Критично' : m.status === 'warning' ? 'Внимание' : 'Скоро'}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                                {data.upcomingMaintenance.length === 0 && (
                                    <tr><td colSpan={3} className="px-4 py-4 text-center text-gray-400">Нет ближайших ТО</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
                */}

                {/* Birthdays */}
                {widgetSettings.showBirthdays && (
                    <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
                        <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-6 flex items-center gap-2">
                            <Users className="w-5 h-5 text-pink-500" />
                            Именинники месяца
                        </h3>
                        <div className="space-y-3">
                            {data.birthdays.map((b, index) => (
                                <div key={index} className={`flex items-start gap-4 p-4 rounded-lg border shadow-sm transition-colors ${b.isToday
                                    ? 'bg-pink-50 dark:bg-pink-900/20 border-pink-200 dark:border-pink-900/30'
                                    : 'bg-white dark:bg-gray-700/50 border-gray-100 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'
                                    }`}>
                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold shadow-sm ${b.isToday
                                        ? 'bg-white dark:bg-gray-800 text-pink-500'
                                        : 'bg-gray-100 dark:bg-gray-600 text-gray-500 dark:text-gray-300'
                                        }`}>
                                        {index + 1}
                                    </div>
                                    <div className="flex-1">
                                        <div className="flex items-center">
                                            <div className={`font-medium w-[240px] shrink-0 truncate ${b.isToday ? 'text-gray-900 dark:text-white' : 'text-gray-700 dark:text-gray-200'}`}>
                                                {b.name}
                                            </div>
                                            <div className={`font-normal whitespace-nowrap ${b.isToday ? 'text-green-600 dark:text-green-400' : 'text-gray-500 dark:text-gray-400'}`}>
                                                – {b.fullDate}, {b.age} лет
                                            </div>
                                        </div>
                                        {b.isToday && <p className="text-xs text-pink-600 dark:text-pink-400 font-bold mt-1">🎉 Сегодня день рождения!</p>}
                                    </div>
                                </div>
                            ))}
                            {data.birthdays.length === 0 && <p className="text-gray-400 dark:text-gray-500 text-sm">Нет именинников в этом месяце</p>}
                        </div>
                    </div>
                )}
            </div>

            {/* Issues Modal */}
            <Modal
                isOpen={showIssuesModal}
                onClose={() => setShowIssuesModal(false)}
                title="Проблемы и предупреждения"
            >
                <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
                    {data.issuesList.sort((a, b) => (a.severity === 'critical' ? -1 : 1)).map(issue => <div key={issue.id} className={`p-4 rounded-lg border-l-4 shadow-sm ${issue.severity === 'critical' ? 'bg-red-50 dark:bg-red-900/10 border-red-500' : 'bg-yellow-50 dark:bg-yellow-900/10 border-yellow-500'
                        }`}>
                        <div className="flex justify-between items-start">
                            <div>
                                <h4 className={`font-bold ${issue.severity === 'critical' ? 'text-red-900 dark:text-red-200' : 'text-yellow-900 dark:text-yellow-200'}`}>
                                    {issue.title}
                                </h4>
                                <p className={`text-sm mt-1 ${issue.severity === 'critical' ? 'text-red-700 dark:text-red-300' : 'text-yellow-800 dark:text-yellow-300'}`}>
                                    {issue.description}
                                </p>
                            </div>
                            {issue.severity === 'critical' ? (
                                <AlertTriangle className="w-5 h-5 text-red-500" />
                            ) : (
                                <AlertTriangle className="w-5 h-5 text-orange-500" />
                            )}
                        </div>
                    </div>
                    )}
                    {data.issuesList.length === 0 && (
                        <p className="text-center text-gray-500 py-8">Проблем не обнаружено. Всё отлично!</p>
                    )}
                </div>
            </Modal>
        </div>
    );
};

export default Dashboard;
