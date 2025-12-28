import React, { useState, useEffect } from 'react';
import { CalendarEvent } from '../../types';
import { calendarApi } from '../../services/productionCalendarService';
import { useToast } from '../../hooks/useToast';
import { ArrowUpIcon, ArrowDownIcon, DownloadIcon } from '../Icons';
import Modal from '../shared/Modal';

const MONTH_NAMES = [
    'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
    'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'
];

const WEEK_DAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

const toLocalISO = (date: Date): string => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
};

interface ProductionCalendarSettingsProps {
    readOnly?: boolean;
}

const ProductionCalendarSettings: React.FC<ProductionCalendarSettingsProps> = ({ readOnly = false }) => {
    const [year, setYear] = useState(new Date().getFullYear());
    const [events, setEvents] = useState<CalendarEvent[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isManualModalOpen, setIsManualModalOpen] = useState(false);
    const [manualJson, setManualJson] = useState('');
    const { showToast } = useToast();

    useEffect(() => {
        loadEvents();
    }, [year]);

    const loadEvents = async () => {
        setIsLoading(true);
        try {
            const data = await calendarApi.getEvents(year);
            setEvents(data);
        } catch (e) {
            console.error('Failed to load calendar events:', e);
        } finally {
            setIsLoading(false);
        }
    };

    const handleManualImport = async () => {
        if (!manualJson.trim()) {
            showToast('Вставьте JSON код.', 'error');
            return;
        }

        setIsLoading(true);
        try {
            const data = JSON.parse(manualJson);
            const eventsToImport = parseCalendarJson(data, year);

            if (eventsToImport.length > 0) {
                await calendarApi.createEvents(eventsToImport);
                showToast(`Успешно импортировано ${eventsToImport.length} событий.`, 'success');
                setManualJson('');
                setIsManualModalOpen(false);
                await loadEvents();
            } else {
                showToast('Не удалось найти события в JSON. Проверьте формат.', 'error');
            }
        } catch (e) {
            console.error(e);
            showToast('Ошибка при разборе JSON. Проверьте формат.', 'error');
        } finally {
            setIsLoading(false);
        }
    };

    const parseCalendarJson = (data: any, yearInput: number): Partial<CalendarEvent>[] => {
        const events: Partial<CalendarEvent>[] = [];
        const year = data?.year || yearInput;

        // Format 1: { months: [{ month: 1, days: "1,2,3+,4*" }] }
        if (data && Array.isArray(data.months)) {
            data.months.forEach((m: any) => {
                const month = Number(m.month);
                const daysStr = m.days;

                if (typeof daysStr === 'string' && daysStr.trim()) {
                    daysStr.split(',').forEach((dStr: string) => {
                        if (!dStr) return;

                        let type: CalendarEvent['type'] = 'holiday';
                        let dayVal = dStr;

                        if (dStr.endsWith('*')) {
                            type = 'short';
                            dayVal = dStr.slice(0, -1);
                        } else if (dStr.endsWith('+')) {
                            type = 'holiday';
                            dayVal = dStr.slice(0, -1);
                        }

                        const day = Number(dayVal);
                        if (!isNaN(day) && !isNaN(month)) {
                            events.push({
                                date: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
                                type,
                            });
                        }
                    });
                }
            });
        }
        // Format 2: { days: [{ d: "01.01", t: 1 }] }
        else {
            const daysArray = Array.isArray(data) ? data : data?.days || [];
            daysArray.forEach((d: any) => {
                if (!d) return;
                const rawDate = d.date || d.d;
                if (!rawDate) return;

                const parts = rawDate.split('.');
                if (parts.length < 2) return;

                const [day, month] = parts;
                const t = Number(d.type !== undefined ? d.type : d.t);

                let type: CalendarEvent['type'] | null = null;
                if (t === 1) type = 'holiday';
                else if (t === 2) type = 'short';
                else if (t === 3) type = 'workday';

                if (type) {
                    events.push({
                        date: `${year}-${month}-${day}`,
                        type,
                        note: d.note || d.n || d.holiday,
                    });
                }
            });
        }

        return events;
    };

    const toggleDay = async (date: Date) => {
        if (readOnly) return;

        const dateStr = toLocalISO(date);
        const existing = events.find(e => e.date === dateStr);
        const dayOfWeek = date.getDay();
        const isStandardWeekend = dayOfWeek === 0 || dayOfWeek === 6;

        let newType: CalendarEvent['type'] = 'workday';

        if (existing) {
            if (existing.type === 'holiday') newType = 'workday';
            else if (existing.type === 'workday') newType = 'short';
            else if (existing.type === 'short') newType = 'holiday';
        } else {
            newType = isStandardWeekend ? 'workday' : 'holiday';
        }

        try {
            await calendarApi.createEvents([{ date: dateStr, type: newType, note: 'Ручное изменение' }]);
            const otherEvents = events.filter(e => e.date !== dateStr);
            setEvents([...otherEvents, { id: '', date: dateStr, type: newType }]);
        } catch (e) {
            showToast('Ошибка сохранения.', 'error');
        }
    };

    const renderMonth = (monthIndex: number) => {
        const firstDay = new Date(year, monthIndex, 1);
        const lastDay = new Date(year, monthIndex + 1, 0);
        const daysInMonth = lastDay.getDate();

        let startDayOfWeek = firstDay.getDay() - 1;
        if (startDayOfWeek === -1) startDayOfWeek = 6;

        const days = [];
        for (let i = 0; i < startDayOfWeek; i++) {
            days.push(<div key={`empty-${i}`} className="p-2"></div>);
        }

        for (let d = 1; d <= daysInMonth; d++) {
            const date = new Date(year, monthIndex, d);
            const dateStr = toLocalISO(date);
            const event = events.find(e => e.date === dateStr);
            const dayOfWeek = date.getDay();
            const isStandardWeekend = dayOfWeek === 0 || dayOfWeek === 6;

            let bgClass = '';
            let textClass = 'text-gray-700 dark:text-gray-300';
            let type = isStandardWeekend ? 'holiday' : 'workday';
            if (event) type = event.type;

            if (type === 'holiday') {
                bgClass = 'bg-red-100 dark:bg-red-900/50';
                textClass = 'text-red-800 dark:text-red-200 font-bold';
            } else if (type === 'workday' && isStandardWeekend) {
                bgClass = 'bg-gray-200 dark:bg-gray-600';
                textClass = 'text-gray-900 dark:text-white font-bold';
            } else if (type === 'short') {
                bgClass = 'bg-yellow-100 dark:bg-yellow-900/50';
                textClass = 'text-yellow-800 dark:text-yellow-200';
            }

            days.push(
                <button
                    key={d}
                    onClick={() => toggleDay(date)}
                    disabled={readOnly}
                    className={`p-1 text-center rounded text-sm transition-opacity ${bgClass} ${textClass} ${!readOnly ? 'hover:opacity-80 cursor-pointer' : 'cursor-default'}`}
                    title={event?.note || (type === 'holiday' ? 'Выходной' : 'Рабочий')}
                >
                    {d}
                </button>
            );
        }

        return (
            <div key={monthIndex} className="border dark:border-gray-700 rounded-lg p-3 bg-white dark:bg-gray-800">
                <h4 className="text-center font-bold mb-2 text-gray-800 dark:text-white">{MONTH_NAMES[monthIndex]}</h4>
                <div className="grid grid-cols-7 gap-1">
                    {WEEK_DAYS.map(day => (
                        <div key={day} className="text-center text-xs text-gray-500 font-medium">{day}</div>
                    ))}
                    {days}
                </div>
            </div>
        );
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4 bg-white dark:bg-gray-800 p-4 rounded-lg shadow">
                <div className="flex items-center gap-4">
                    <button onClick={() => setYear(year - 1)} className="p-2 bg-gray-100 dark:bg-gray-700 rounded-full hover:bg-gray-200">
                        <ArrowUpIcon className="h-5 w-5 transform -rotate-90" />
                    </button>
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white">{year}</h2>
                    <button onClick={() => setYear(year + 1)} className="p-2 bg-gray-100 dark:bg-gray-700 rounded-full hover:bg-gray-200">
                        <ArrowDownIcon className="h-5 w-5 transform -rotate-90" />
                    </button>
                </div>

                <div className="flex gap-4">
                    <div className="flex items-center gap-2 text-sm">
                        <span className="w-3 h-3 bg-red-100 dark:bg-red-900/50 rounded-sm border border-red-200"></span> Выходной
                        <span className="w-3 h-3 bg-yellow-100 dark:bg-yellow-900/50 rounded-sm border border-yellow-200"></span> Сокр.
                        <span className="w-3 h-3 bg-gray-200 dark:bg-gray-600 rounded-sm"></span> Рабочий
                    </div>
                    {!readOnly && (
                        <button
                            onClick={() => setIsManualModalOpen(true)}
                            disabled={isLoading}
                            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50"
                            title="Загрузить календарь из JSON"
                        >
                            <DownloadIcon className="h-5 w-5" />
                            {isLoading ? '...' : 'Импорт'}
                        </button>
                    )}
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {Array.from({ length: 12 }, (_, i) => renderMonth(i))}
            </div>

            <Modal
                isOpen={isManualModalOpen}
                onClose={() => setIsManualModalOpen(false)}
                title={`Импорт календаря на ${year} год`}
                footer={
                    <div className="flex justify-end gap-2">
                        <button onClick={() => setIsManualModalOpen(false)} className="px-4 py-2 rounded-md bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-white">Отмена</button>
                        <button onClick={handleManualImport} disabled={isLoading} className="px-4 py-2 rounded-md bg-blue-600 text-white font-semibold">Импортировать</button>
                    </div>
                }
            >
                <div className="space-y-4">
                    <p className="text-sm text-gray-600 dark:text-gray-300">
                        Скачайте JSON с официального источника и вставьте его сюда:
                    </p>
                    <ol className="list-decimal list-inside text-sm text-gray-700 dark:text-gray-200 space-y-2 bg-gray-50 dark:bg-gray-900/50 p-4 rounded-md border dark:border-gray-700">
                        <li>
                            Откройте ссылку в новой вкладке: <br />
                            <a
                                href={`https://xmlcalendar.ru/data/ru/${year}/calendar.json`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-600 underline font-mono break-all"
                            >
                                https://xmlcalendar.ru/data/ru/{year}/calendar.json
                            </a>
                        </li>
                        <li>Скопируйте весь текст со страницы (Ctrl+A, Ctrl+C).</li>
                        <li>Вставьте текст в поле ниже.</li>
                    </ol>
                    <textarea
                        value={manualJson}
                        onChange={e => setManualJson(e.target.value)}
                        placeholder='Вставьте JSON здесь'
                        className="w-full h-48 p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white font-mono text-xs"
                    />
                </div>
            </Modal>
        </div>
    );
};

export default ProductionCalendarSettings;
