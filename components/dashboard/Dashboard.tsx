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
    Gauge
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

// Keys for persistence
const STORAGE_DATE_FROM = 'dashboard_dateFrom';
const STORAGE_DATE_TO = 'dashboard_dateTo';

const Dashboard: React.FC = () => {
    // State
    const [data, setData] = useState<DashboardData | null>(null);
    const [loading, setLoading] = useState(false);
    const [vehicles, setVehicles] = useState<Vehicle[]>([]);

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
            className={`bg-white rounded-xl p-6 shadow-sm border border-gray-100 flex items-center justify-between ${onClick ? 'cursor-pointer hover:shadow-md transition-shadow' : ''}`}
        >
            <div>
                <p className="text-sm font-medium text-gray-500 mb-1">{title}</p>
                <h3 className={`text-2xl font-bold ${color}`}>{value}</h3>
            </div>
            <div className={`p-3 rounded-full ${color.replace('text-', 'bg-').replace('600', '50').replace('500', '50')}`}>
                <Icon className={`w-6 h-6 ${color}`} />
            </div>
        </div>
    );

    const KpiCard = ({ title, value, unit, icon: Icon, color }: any) => (
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between mb-4">
                <p className="text-sm font-medium text-gray-500">{title}</p>
                <Icon className={`w-5 h-5 ${color}`} />
            </div>
            <div className="flex items-end items-baseline">
                <h3 className="text-2xl font-bold text-gray-900 mr-2">{value}</h3>
                <span className="text-sm text-gray-500 font-medium">{unit}</span>
            </div>
        </div>
    );

    return (
        <div className="space-y-6">
            {/* Header & Filters */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-4 rounded-xl shadow-sm border border-gray-100">
                <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                    <LayoutDashboard className="w-8 h-8 text-blue-600" />
                    Панель управления
                </h1>

                <div className="flex flex-wrap items-center gap-3">
                    <select
                        value={selectedVehicleId}
                        onChange={(e) => setSelectedVehicleId(e.target.value)}
                        className="px-3 py-2 border rounded-lg text-sm min-w-[200px] outline-none focus:ring-2 focus:ring-blue-500"
                    >
                        <option value="">Все ТС</option>
                        {vehicles.map(v => (
                            <option key={v.id} value={v.id}>{v.registrationNumber} ({v.brand})</option>
                        ))}
                    </select>

                    <input
                        type="date"
                        value={dateFrom}
                        onChange={(e) => setDateFrom(e.target.value)}
                        className="px-3 py-2 border rounded-lg text-sm"
                    />
                    <span className="text-gray-400">-</span>
                    <input
                        type="date"
                        value={dateTo}
                        onChange={(e) => setDateTo(e.target.value)}
                        className="px-3 py-2 border rounded-lg text-sm"
                    />

                    <button
                        onClick={fetchData}
                        disabled={loading}
                        className="p-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors"
                        title="Обновить"
                    >
                        <Activity className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
                    </button>
                </div>
            </div>

            {/* Row 1: Status Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
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
                <StatusCard
                    title="Проблемы"
                    value={kpi.issues}
                    icon={AlertTriangle}
                    color={kpi.issues > 0 ? "text-red-600" : "text-gray-400"}
                    onClick={() => setShowIssuesModal(true)}
                />
            </div>

            {/* Row 2: KPI Cards */}
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

            {/* Row 3: Dynamics Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Fuel Dynamics */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                    <h3 className="text-sm font-bold text-gray-900 mb-6 flex items-center gap-2">
                        Динамика расхода топлива за выбранный период
                        {(dateFrom || dateTo) && (
                            <span className="text-gray-500 font-normal">
                                {dateFrom && new Date(dateFrom).toLocaleDateString('ru-RU')}
                                {dateFrom && dateTo && ' - '}
                                {dateTo && new Date(dateTo).toLocaleDateString('ru-RU')}
                            </span>
                        )}
                    </h3>
                    <div className="h-80">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={data.fuelConsumptionByMonth} barCategoryGap="20%">
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                                <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: '#6B7280', fontSize: 12 }} dy={10} />
                                <YAxis
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fill: '#6B7280', fontSize: 12 }}
                                    tickCount={6}
                                    domain={[0, 'auto']}
                                    allowDataOverflow={false}
                                />
                                <Tooltip
                                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                    cursor={{ fill: '#F3F4F6' }}
                                    formatter={(value: any) => [`${value} л`, 'Факт']}
                                />
                                <Legend />
                                <Bar dataKey="value" fill="#82ca9d" radius={[4, 4, 0, 0]} name="Факт (л)">
                                    <LabelList dataKey="value" position="top" style={{ fontSize: 12, fill: '#666' }} />
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Medical Exams Dynamics */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                    <h3 className="text-sm font-bold text-gray-900 mb-6 flex items-center gap-2">
                        Динамика мед. осмотров за выбранный период
                        {(dateFrom || dateTo) && (
                            <span className="text-gray-500 font-normal">
                                {dateFrom && new Date(dateFrom).toLocaleDateString('ru-RU')}
                                {dateFrom && dateTo && ' - '}
                                {dateTo && new Date(dateTo).toLocaleDateString('ru-RU')}
                            </span>
                        )}
                    </h3>
                    <div className="h-80">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={data.medicalExamsByMonth} barCategoryGap="20%">
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                                <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: '#6B7280', fontSize: 12 }} dy={10} />
                                <YAxis
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fill: '#6B7280', fontSize: 12 }}
                                    tickCount={6}
                                    domain={[0, 'auto']}
                                    allowDataOverflow={false}
                                />
                                <Tooltip
                                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                    cursor={{ fill: '#F3F4F6' }}
                                />
                                <Legend />
                                <Bar dataKey="value" fill="#8884d8" radius={[4, 4, 0, 0]} name="Осмотров">
                                    <LabelList dataKey="value" position="top" style={{ fontSize: 12, fill: '#666' }} />
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>

            {/* Row 4: Top Lists (Charts) - Always show ALL vehicles/drivers regardless of filter */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Top 10 Fuel Consumers */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                    <h3 className="text-sm font-bold text-gray-900 mb-6 flex items-center gap-2">
                        Сравнение расхода по ТС (топ) за выбранный период
                        {(dateFrom || dateTo) && (
                            <span className="text-gray-500 font-normal">
                                {dateFrom && new Date(dateFrom).toLocaleDateString('ru-RU')}
                                {dateFrom && dateTo && ' - '}
                                {dateTo && new Date(dateTo).toLocaleDateString('ru-RU')}
                            </span>
                        )}
                    </h3>
                    <div className="h-96">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={data.topFuelVehicles} barCategoryGap="20%">
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#6B7280', fontSize: 11 }} dy={10} interval={0} angle={-45} textAnchor="end" height={100} />
                                <YAxis
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fill: '#6B7280', fontSize: 12 }}
                                    tickCount={6}
                                    domain={[0, 'auto']}
                                />
                                <Tooltip
                                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                    cursor={{ fill: '#F3F4F6' }}
                                />
                                <Legend />
                                <Bar dataKey="value" fill="#3b82f6" radius={[4, 4, 0, 0]} name="Расход (л)">
                                    <LabelList dataKey="value" position="top" style={{ fontSize: 12, fill: '#666' }} />
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Driver Exams Stats */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                    <h3 className="text-sm font-bold text-gray-900 mb-6 flex items-center gap-2">
                        Количество осмотров по водителям за выбранный период
                        {(dateFrom || dateTo) && (
                            <span className="text-gray-500 font-normal">
                                {dateFrom && new Date(dateFrom).toLocaleDateString('ru-RU')}
                                {dateFrom && dateTo && ' - '}
                                {dateTo && new Date(dateTo).toLocaleDateString('ru-RU')}
                            </span>
                        )}
                    </h3>
                    <div className="h-96">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={data.driverExams} barCategoryGap="20%">
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#6B7280', fontSize: 11 }} dy={10} interval={0} angle={-45} textAnchor="end" height={100} />
                                <YAxis
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fill: '#6B7280', fontSize: 12 }}
                                    tickCount={6}
                                    domain={[0, 'auto']}
                                />
                                <Tooltip
                                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                    cursor={{ fill: '#F3F4F6' }}
                                />
                                <Legend />
                                <Bar dataKey="value" fill="#00C49F" radius={[4, 4, 0, 0]} name="Осмотров">
                                    <LabelList dataKey="value" position="top" style={{ fontSize: 12, fill: '#666' }} />
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>

            {/* Row 5: Lists (Maintenance & Birthdays) */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Maintenance List */}
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

                {/* Birthdays */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                    <h3 className="text-lg font-bold text-gray-900 mb-6 flex items-center gap-2">
                        <Users className="w-5 h-5 text-pink-500" />
                        Именинники (Месяц)
                    </h3>
                    <div className="space-y-3">
                        {data.birthdays.map(b => (
                            <div key={b.id} className={`flex items-center p-3 rounded-lg border ${b.isToday ? 'bg-pink-50 border-pink-200 shadow-sm' : 'bg-white border-gray-100'}`}>
                                <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm mr-3 ${b.isToday ? 'bg-pink-100 text-pink-600' : 'bg-gray-100 text-gray-500'}`}>
                                    {b.date.split('.')[0]}
                                </div>
                                <div>
                                    <p className="font-medium text-gray-900">{b.name}</p>
                                    {b.isToday && <p className="text-xs text-pink-600 font-bold">🎉 Сегодня день рождения!</p>}
                                </div>
                            </div>
                        ))}
                        {data.birthdays.length === 0 && <p className="text-gray-400 text-sm">Нет именинников в этом месяце</p>}
                    </div>
                </div>
            </div>

            {/* Issues Modal */}
            <Modal
                isOpen={showIssuesModal}
                onClose={() => setShowIssuesModal(false)}
                title="Проблемы и предупреждения"
            >
                <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
                    {data.issuesList.sort((a, b) => (a.severity === 'critical' ? -1 : 1)).map(issue => (
                        <div key={issue.id} className={`p-4 rounded-lg border-l-4 shadow-sm ${issue.severity === 'critical' ? 'bg-red-50 border-red-500' : 'bg-yellow-50 border-yellow-500'
                            }`}>
                            <div className="flex justify-between items-start">
                                <div>
                                    <h4 className={`font-bold ${issue.severity === 'critical' ? 'text-red-900' : 'text-yellow-900'}`}>
                                        {issue.title}
                                    </h4>
                                    <p className={`text-sm mt-1 ${issue.severity === 'critical' ? 'text-red-700' : 'text-yellow-800'}`}>
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
                    ))}
                    {data.issuesList.length === 0 && (
                        <p className="text-center text-gray-500 py-8">Проблем не обнаружено. Всё отлично!</p>
                    )}
                </div>
            </Modal>
        </div>
    );
};

export default Dashboard;
