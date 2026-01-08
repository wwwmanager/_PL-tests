import React, { useEffect, useState } from 'react';

// DASH-SETTINGS-001: Dashboard widget visibility settings

export interface DashboardWidgetSettings {
    showKpiCards: boolean;
    showWaybillStats: boolean;
    showFuelChart: boolean;
    showMedicalChart: boolean;
    showTopFuelVehicles: boolean;
    showDriverExams: boolean;
    showFuelExpense: boolean;
    showOtherExpense: boolean;
    showMileage: boolean;
    showBirthdays: boolean;
    showIssues: boolean;
}

const STORAGE_KEY = 'dashboardWidgetSettings';

const defaultSettings: DashboardWidgetSettings = {
    showKpiCards: true,
    showWaybillStats: true,
    showFuelChart: true,
    showMedicalChart: true,
    showTopFuelVehicles: true,
    showDriverExams: true,
    showFuelExpense: true,
    showOtherExpense: true,
    showMileage: true,
    showBirthdays: true,
    showIssues: true,
};

export function loadDashboardSettings(): DashboardWidgetSettings {
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
            return { ...defaultSettings, ...JSON.parse(stored) };
        }
    } catch (e) {
        console.warn('Failed to load dashboard settings', e);
    }
    return defaultSettings;
}

export function saveDashboardSettings(settings: DashboardWidgetSettings): void {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch (e) {
        console.warn('Failed to save dashboard settings', e);
    }
}

interface WidgetToggleProps {
    label: string;
    description?: string;
    checked: boolean;
    onChange: (checked: boolean) => void;
}

const WidgetToggle: React.FC<WidgetToggleProps> = ({ label, description, checked, onChange }) => (
    <label className="flex items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-gray-700/50 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors cursor-pointer">
        <div>
            <div className="font-medium text-gray-800 dark:text-white">{label}</div>
            {description && <p className="text-sm text-gray-500 dark:text-gray-400">{description}</p>}
        </div>
        <div className="relative inline-flex items-center cursor-pointer ml-4">
            <input
                type="checkbox"
                checked={checked}
                onChange={(e) => onChange(e.target.checked)}
                className="sr-only peer"
            />
            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-600 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-500 peer-checked:bg-blue-600"></div>
        </div>
    </label>
);

const DashboardSettings: React.FC = () => {
    const [settings, setSettings] = useState<DashboardWidgetSettings>(defaultSettings);

    useEffect(() => {
        setSettings(loadDashboardSettings());
    }, []);

    const handleChange = (key: keyof DashboardWidgetSettings, value: boolean) => {
        const newSettings = { ...settings, [key]: value };
        setSettings(newSettings);
        saveDashboardSettings(newSettings);
    };

    const widgets: { key: keyof DashboardWidgetSettings; label: string; description?: string }[] = [
        { key: 'showKpiCards', label: 'KPI карточки', description: 'Пробег и расход топлива (месяц/квартал/год)' },
        { key: 'showWaybillStats', label: 'Статусы путевых листов', description: 'Черновики, на проверке, проведённые' },
        { key: 'showFuelChart', label: 'Динамика расхода топлива', description: 'График расхода по месяцам' },
        { key: 'showMedicalChart', label: 'Динамика медосмотров', description: 'График осмотров по месяцам' },
        { key: 'showTopFuelVehicles', label: 'Топ ТС по расходу', description: 'Сравнение расхода топлива по ТС' },
        { key: 'showDriverExams', label: 'Осмотры по водителям', description: 'Количество осмотров по водителям' },
        { key: 'showFuelExpense', label: 'Топ ТС по тратам на топливо', description: 'Расходы на топливо в рублях' },
        { key: 'showOtherExpense', label: 'Топ ТС по тратам (без топлива)', description: 'Прочие расходы на ТС' },
        { key: 'showMileage', label: 'Топ ТС по пробегу', description: 'Пробег по ТС в км' },
        { key: 'showBirthdays', label: 'Дни рождения', description: 'Дни рождения сотрудников в текущем месяце' },
        { key: 'showIssues', label: 'Проблемы', description: 'Список проблем по ТС' },
    ];

    return (
        <section className="border rounded-lg p-4 dark:border-gray-700 max-w-2xl space-y-4">
            <h3 className="font-semibold text-lg mb-4 text-gray-800 dark:text-white">Панель управления</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                Выберите, какие виджеты отображать на главной панели (Dashboard).
            </p>
            <div className="space-y-2">
                {widgets.map(w => (
                    <WidgetToggle
                        key={w.key}
                        label={w.label}
                        description={w.description}
                        checked={settings[w.key]}
                        onChange={(checked) => handleChange(w.key, checked)}
                    />
                ))}
            </div>
        </section>
    );
};

export default DashboardSettings;
