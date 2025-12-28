import React, { useState, useEffect } from 'react';
import Modal from '../shared/Modal';
import { Vehicle, Employee, Organization, CalendarEvent, SeasonSettings, WaybillStatus } from '../../types';
import { WaybillCalculationMethod } from '../../services/waybillCalculations';
import { BatchPreviewItem, generateBatchPreview, saveBatchWaybills, BatchConfig, GroupingDuration } from '../../services/batchWaybillService';
import { getVehicles } from '../../services/api/vehicleApi';
import { getEmployees } from '../../services/api/employeeApi';
import { listDrivers, DriverListItem } from '../../services/driverApi';
import { getWaybills } from '../../services/api/waybillApi';
import { calendarApi } from '../../services/productionCalendarService';
import { getSeasonSettings } from '../../services/settingsApi';
import { useToast } from '../../hooks/useToast';
import { useAuth } from '../../services/auth';
import { DocumentArrowUpIcon } from '../Icons';

interface BatchGeneratorModalProps {
    onClose: () => void;
    onSuccess: () => void;
}

const BatchGeneratorModal: React.FC<BatchGeneratorModalProps> = ({ onClose, onSuccess }) => {
    const [step, setStep] = useState<'config' | 'preview' | 'processing'>('config');
    const [file, setFile] = useState<File | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [progress, setProgress] = useState({ current: 0, total: 0 });

    // Data
    const [vehicles, setVehicles] = useState<Vehicle[]>([]);
    const [drivers, setDrivers] = useState<DriverListItem[]>([]);
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([]);
    const [seasonSettings, setSeasonSettings] = useState<SeasonSettings | undefined>(undefined);

    // Config
    const [selectedVehicleId, setSelectedVehicleId] = useState('');
    const [selectedDriverId, setSelectedDriverId] = useState('');
    const [periodStart, setPeriodStart] = useState('');
    const [periodEnd, setPeriodEnd] = useState('');
    const [createEmpty, setCreateEmpty] = useState(false);
    const [grouping, setGrouping] = useState<GroupingDuration>('week');
    const [calculationMethod, setCalculationMethod] = useState<WaybillCalculationMethod>('by_total');

    // Responsible persons
    const [selectedDispatcherId, setSelectedDispatcherId] = useState('');
    const [selectedControllerId, setSelectedControllerId] = useState('');

    // Preview Data
    const [previewItems, setPreviewItems] = useState<BatchPreviewItem[]>([]);

    const { showToast } = useToast();
    const { currentUser } = useAuth();

    useEffect(() => {
        const loadData = async () => {
            try {
                const [v, d, e, s] = await Promise.all([
                    getVehicles(),
                    listDrivers(),
                    getEmployees({ limit: 1000 }),
                    getSeasonSettings()
                ]);
                setVehicles(v.filter(veh => veh.status === 'Active'));
                setDrivers(d); // WB-FIX: Don't filter drivers by isActive, we might need them for historical data or if they were recently archived
                setEmployees(e); // WB-FIX: Don't filter employees by status for the same reason
                setSeasonSettings(s);

                // Load calendar events
                const year = new Date().getFullYear();
                const events = await calendarApi.getEvents(year);
                setCalendarEvents(events);
            } catch (err) {
                console.error('Failed to load data:', err);
            }
        };
        loadData();
    }, []);

    // Auto-fill driver, dispatcher, controller when vehicle is selected
    useEffect(() => {
        if (selectedVehicleId && vehicles.length > 0 && drivers.length > 0) {
            const v = vehicles.find(x => x.id === selectedVehicleId);

            if (v?.assignedDriverId) {
                // v.assignedDriverId is Employee.id (see schema.prisma/Vehicle)
                // We need to find the driver record linked to this employee
                const driver = drivers.find(d => d.employeeId === v.assignedDriverId);

                if (driver) {
                    setSelectedDriverId(driver.id);

                    // Find employee to get assigned dispatcher/controller
                    const emp = employees.find(e => e.id === driver.employeeId);

                    if (emp) {
                        // Use driver's assigned dispatcher if exists
                        if (emp.dispatcherId) {
                            setSelectedDispatcherId(emp.dispatcherId);
                        } else {
                            // Fallback: find first dispatcher
                            const defaultDisp = employees.find(e => e.employeeType === 'dispatcher');
                            if (defaultDisp) setSelectedDispatcherId(defaultDisp.id);
                        }

                        // Use driver's assigned controller if exists
                        if (emp.controllerId) {
                            setSelectedControllerId(emp.controllerId);
                        } else {
                            // Fallback: find first mechanic/controller
                            const defaultContr = employees.find(e => e.employeeType === 'mechanic' || e.employeeType === 'controller');
                            if (defaultContr) setSelectedControllerId(defaultContr.id);
                        }
                    }
                }
            }
        }
    }, [selectedVehicleId, vehicles, drivers, employees]);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setFile(e.target.files[0]);
        }
    };

    const handleGeneratePreview = async () => {
        if (!file || !selectedVehicleId || !selectedDriverId) {
            showToast('Заполните все обязательные поля и выберите файл', 'error');
            return;
        }

        const currentYear = new Date().getFullYear();
        const hasCalendar = calendarEvents.some(e => e.date.startsWith(`${currentYear}-`));
        if (!hasCalendar) {
            showToast(`Внимание: Производственный календарь на ${currentYear} год не заполнен. Используются стандартные праздники РФ.`, 'info');
        }

        setIsLoading(true);
        try {
            const items = await generateBatchPreview(file, periodStart, periodEnd, calendarEvents);
            setPreviewItems(items);
            setStep('preview');
        } catch (e: any) {
            showToast('Ошибка генерации: ' + e.message, 'error');
        } finally {
            setIsLoading(false);
        }
    };

    const handleToggleWorkDay = (index: number) => {
        setPreviewItems(prev => {
            const next = [...prev];
            next[index].isWorking = !next[index].isWorking;
            return next;
        });
    };

    const handleFuelChange = (index: number, value: string) => {
        setPreviewItems(prev => {
            const next = [...prev];
            const val = parseFloat(value);
            next[index].fuelFilled = isNaN(val) ? 0 : val;
            return next;
        });
    };

    const handleSave = async () => {
        if (!selectedDispatcherId || !selectedControllerId) {
            showToast('Выберите диспетчера и механика/контролера', 'error');
            return;
        }

        setIsLoading(true);

        try {
            // Check for duplicate dates
            const existingWaybills = await getWaybills({ limit: 1000 });
            const vehicleWaybills = existingWaybills.waybills.filter(w => w.vehicleId === selectedVehicleId && w.status !== WaybillStatus.CANCELLED);

            const selectedDates = previewItems.filter(i => i.isWorking).map(i => i.dateStr);
            const existingDates = new Set(vehicleWaybills.map(w => w.date.split('T')[0]));

            const conflicts = selectedDates.filter(d => existingDates.has(d));

            if (conflicts.length > 0) {
                const conflictList = conflicts.slice(0, 3).map(d => new Date(d).toLocaleDateString('ru-RU')).join(', ');
                const moreCount = conflicts.length > 3 ? ` и еще ${conflicts.length - 3}` : '';

                showToast(`Ошибка: На следующие даты уже существуют путевые листы: ${conflictList}${moreCount}.`, 'error');
                setIsLoading(false);
                return;
            }

            setStep('processing');
            const driver = drivers.find(d => d.id === selectedDriverId)!;
            const vehicle = vehicles.find(v => v.id === selectedVehicleId)!;
            const orgId = vehicle.organizationId || '';

            const config: BatchConfig = {
                driverId: selectedDriverId,
                vehicleId: selectedVehicleId,
                organizationId: orgId,
                dispatcherId: selectedDispatcherId,
                controllerId: selectedControllerId,
                createEmptyDays: createEmpty,
                groupingDuration: grouping,
                calculationMethod: calculationMethod
            };

            await saveBatchWaybills(
                previewItems,
                config,
                vehicle,
                driver as any,
                (curr, tot) => {
                    setProgress({ current: curr, total: tot });
                },
                currentUser?.id,
                calendarEvents,
                seasonSettings
            );
            showToast('Пакетная генерация успешно завершена', 'success');
            onSuccess();
        } catch (e: any) {
            showToast('Ошибка сохранения: ' + e.message, 'error');
            setStep('preview');
        } finally {
            setIsLoading(false);
        }
    };

    const renderConfigStep = () => (
        <div className="space-y-4">
            <div className="p-4 bg-blue-50 dark:bg-blue-900/30 rounded-lg border border-blue-200 dark:border-blue-800 text-sm">
                <p><b>Как это работает:</b></p>
                <ul className="list-disc list-inside mt-1 space-y-1">
                    <li>Загрузите HTML отчет о поездках из системы мониторинга.</li>
                    <li>Система автоматически разделит поездки по дням.</li>
                    <li>Будет применен производственный календарь.</li>
                    <li>Вы сможете вручную исключить дни перед сохранением.</li>
                </ul>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label className="block text-sm font-medium mb-1 dark:text-gray-200">Транспортное средство *</label>
                    <select className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200" value={selectedVehicleId} onChange={e => setSelectedVehicleId(e.target.value)}>
                        <option value="">Выберите ТС</option>
                        {vehicles.map(v => <option key={v.id} value={v.id}>{v.registrationNumber} ({v.brand})</option>)}
                    </select>
                </div>
                <div>
                    <label className="block text-sm font-medium mb-1 dark:text-gray-200">Водитель *</label>
                    <select className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200" value={selectedDriverId} onChange={e => setSelectedDriverId(e.target.value)}>
                        <option value="">Выберите водителя</option>
                        {drivers.map(d => <option key={d.id} value={d.id}>{d.fullName}</option>)}
                    </select>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label className="block text-sm font-medium mb-1 dark:text-gray-200">Диспетчер</label>
                    <select className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200" value={selectedDispatcherId} onChange={e => setSelectedDispatcherId(e.target.value)}>
                        <option value="">Выберите диспетчера</option>
                        {employees.map(d => <option key={d.id} value={d.id}>{d.fullName}</option>)}
                    </select>
                </div>
                <div>
                    <label className="block text-sm font-medium mb-1 dark:text-gray-200">Контролер/Механик</label>
                    <select className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200" value={selectedControllerId} onChange={e => setSelectedControllerId(e.target.value)}>
                        <option value="">Выберите контролера</option>
                        {employees.map(d => <option key={d.id} value={d.id}>{d.fullName}</option>)}
                    </select>
                </div>
            </div>

            <div>
                <label className="block text-sm font-medium mb-1 dark:text-gray-200">Файл отчета (.html) *</label>
                <input type="file" accept=".html,.htm" onChange={handleFileChange} className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100" />
                {file && <p className="mt-1 text-xs text-gray-500">{file.name}</p>}
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="block text-sm font-medium mb-1 dark:text-gray-200">Период С (необязательно)</label>
                    <input type="date" className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200" value={periodStart} onChange={e => setPeriodStart(e.target.value)} />
                </div>
                <div>
                    <label className="block text-sm font-medium mb-1 dark:text-gray-200">Период ПО (необязательно)</label>
                    <input type="date" className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200" value={periodEnd} onChange={e => setPeriodEnd(e.target.value)} />
                </div>
            </div>

            <div className="grid grid-cols-2 gap-4 items-center">
                <div className="flex items-center">
                    <input id="createEmpty" type="checkbox" checked={createEmpty} onChange={e => setCreateEmpty(e.target.checked)} className="h-4 w-4 text-blue-600 rounded" />
                    <label htmlFor="createEmpty" className="ml-2 block text-sm text-gray-900 dark:text-gray-300">
                        Создавать пустые ПЛ (без поездок)
                    </label>
                </div>
                <div>
                    <label className="block text-sm font-medium mb-1 dark:text-gray-200">Срок действия ПЛ</label>
                    <select className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200" value={grouping} onChange={e => setGrouping(e.target.value as GroupingDuration)}>
                        <option value="day">1 день</option>
                        <option value="2days">2 дня (если подряд)</option>
                        <option value="week">Неделя (пн-вс)</option>
                        <option value="month">Месяц</option>
                    </select>
                </div>
            </div>

            <div className="p-4 bg-gray-50 dark:bg-gray-700/30 border border-gray-200 dark:border-gray-600 rounded-lg">
                <label className="block text-sm font-medium mb-2 dark:text-gray-200">Метод расчета расхода топлива</label>
                <div className="flex gap-6">
                    <label className="flex items-center cursor-pointer">
                        <input
                            type="radio"
                            name="calcMethod"
                            value="by_total"
                            checked={calculationMethod === 'by_total'}
                            onChange={() => setCalculationMethod('by_total')}
                            className="h-4 w-4 text-blue-600"
                        />
                        <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">По общему пробегу</span>
                    </label>
                    <label className="flex items-center cursor-pointer">
                        <input
                            type="radio"
                            name="calcMethod"
                            value="by_segment"
                            checked={calculationMethod === 'by_segment'}
                            onChange={() => setCalculationMethod('by_segment')}
                            className="h-4 w-4 text-blue-600"
                        />
                        <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">По отрезкам</span>
                    </label>
                </div>
            </div>
        </div>
    );

    const renderPreviewStep = () => {
        const totalDocs = previewItems.filter(i => i.isWorking && (i.routes.length > 0 || createEmpty)).length;
        const totalKm = previewItems.filter(i => i.isWorking).reduce((sum, i) => sum + i.totalDistance, 0);

        return (
            <div className="flex flex-col h-full overflow-hidden">
                <div className="flex justify-between items-center mb-2 px-1">
                    <div className="text-sm text-gray-600 dark:text-gray-300">
                        Дней обработано: <b>{totalDocs}</b>. Общий пробег: <b>{Math.round(totalKm)} км</b>.
                        <span className="ml-2 text-xs text-gray-500">(Итоговое кол-во ПЛ может быть меньше из-за группировки)</span>
                    </div>
                </div>
                <div className="flex-grow overflow-y-auto border rounded dark:border-gray-700">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-gray-100 dark:bg-gray-700 sticky top-0 z-10">
                            <tr className="text-gray-700 dark:text-gray-200">
                                <th className="p-2">Дата</th>
                                <th className="p-2">День</th>
                                <th className="p-2 text-center">Рабочий?</th>
                                <th className="p-2 text-right">Поездок</th>
                                <th className="p-2 text-right">Км</th>
                                <th className="p-2 text-right" style={{ width: '100px' }}>Заправка (л)</th>
                                <th className="p-2">Инфо</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                            {previewItems.map((item, idx) => {
                                const isWeekend = item.dayOfWeek === 'сб' || item.dayOfWeek === 'вс';
                                return (
                                    <tr key={item.dateStr} className={`hover:bg-gray-50 dark:hover:bg-gray-800 ${!item.isWorking ? 'opacity-60 bg-gray-50 dark:bg-gray-900' : ''}`}>
                                        <td className="p-2 dark:text-gray-300">{new Date(item.dateStr).toLocaleDateString('ru-RU')}</td>
                                        <td className={`p-2 font-medium ${isWeekend ? 'text-red-500' : 'dark:text-gray-300'}`}>{item.dayOfWeek}</td>
                                        <td className="p-2 text-center">
                                            <input
                                                type="checkbox"
                                                checked={item.isWorking}
                                                onChange={() => handleToggleWorkDay(idx)}
                                                className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                                            />
                                        </td>
                                        <td className="p-2 text-right dark:text-gray-300">{item.routes.length}</td>
                                        <td className="p-2 text-right font-mono dark:text-gray-300">{item.totalDistance > 0 ? item.totalDistance.toFixed(1) : '-'}</td>
                                        <td className="p-2 text-right">
                                            <input
                                                type="number"
                                                step="0.1"
                                                min="0"
                                                disabled={!item.isWorking}
                                                value={item.fuelFilled || ''}
                                                onChange={(e) => handleFuelChange(idx, e.target.value)}
                                                className="w-full p-1 border rounded text-right text-sm dark:bg-gray-600 dark:border-gray-500 dark:text-gray-100 disabled:opacity-50"
                                                placeholder="0"
                                            />
                                        </td>
                                        <td className="p-2 text-xs text-gray-500 dark:text-gray-400">
                                            {item.holidayName && <span className="text-purple-600 dark:text-purple-400 font-semibold">{item.holidayName}</span>}
                                            {item.warnings.length > 0 && <span className="text-orange-500 ml-1">{item.warnings.join(', ')}</span>}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
        );
    };

    const renderProcessingStep = () => (
        <div className="flex flex-col items-center justify-center h-64 space-y-4">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            <p className="text-lg font-medium text-gray-700 dark:text-gray-200">Генерация путевых листов...</p>
            <p className="text-sm text-gray-500">Обработано {progress.current} из {progress.total}</p>
        </div>
    );

    return (
        <Modal
            isOpen={true}
            onClose={onClose}
            title="Пакетная генерация ПЛ"
            footer={
                <>
                    <button onClick={step === 'config' ? onClose : () => setStep('config')} disabled={step === 'processing'} className="px-4 py-2 rounded-lg bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors text-gray-800 dark:text-white">
                        {step === 'config' ? 'Отмена' : 'Назад'}
                    </button>
                    {step === 'config' && (
                        <button onClick={handleGeneratePreview} disabled={isLoading} className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors disabled:opacity-50">
                            {isLoading ? 'Анализ...' : 'Далее'}
                        </button>
                    )}
                    {step === 'preview' && (
                        <button onClick={handleSave} className="px-4 py-2 rounded-lg bg-green-600 text-white hover:bg-green-700 transition-colors">
                            Сгенерировать
                        </button>
                    )}
                </>
            }
        >
            <div className="min-h-[450px] max-h-[600px] flex flex-col">
                {step === 'config' && renderConfigStep()}
                {step === 'preview' && renderPreviewStep()}
                {step === 'processing' && renderProcessingStep()}
            </div>
        </Modal>
    );
};

export default BatchGeneratorModal;
