import React from 'react';
import {
    WAYBILL_STATUS_TRANSLATIONS,
    ORGANIZATION_STATUS_TRANSLATIONS,
    VEHICLE_STATUS_TRANSLATIONS,
    STOCK_TRANSACTION_TYPE_TRANSLATIONS,
    STOCK_EXPENSE_REASON_TRANSLATIONS,
    STORAGE_TYPE_TRANSLATIONS,
    BLANK_STATUS_TRANSLATIONS,
    SPOIL_REASON_TRANSLATIONS,
    ROLE_TRANSLATIONS,
} from '../../constants';
import { EMPLOYEE_TYPE_TRANSLATIONS } from '../../types';
import { BookOpenIcon } from '../Icons';

const SystemDictionariesGuide: React.FC = () => {
    const renderTable = (title: string, data: Record<string, string>) => (
        <div className="mb-8">
            <h3 className="text-xl font-bold text-gray-800 dark:text-white mb-4">{title}</h3>
            <div className="overflow-x-auto border rounded-lg dark:border-gray-700">
                <table className="w-full text-sm text-left text-gray-500 dark:text-gray-400">
                    <thead className="text-xs text-gray-700 uppercase bg-gray-50 dark:bg-gray-700 dark:text-gray-400">
                        <tr>
                            <th scope="col" className="px-6 py-3 w-1/3">Ключ (Code)</th>
                            <th scope="col" className="px-6 py-3">Значение</th>
                        </tr>
                    </thead>
                    <tbody>
                        {Object.entries(data).map(([key, value]) => (
                            <tr key={key} className="bg-white dark:bg-gray-800 border-b dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600">
                                <td className="px-6 py-4 font-mono text-gray-900 dark:text-white">{key}</td>
                                <td className="px-6 py-4">{value}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );

    return (
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6 md:p-8 max-w-4xl mx-auto">
            <header className="text-center mb-10">
                <BookOpenIcon className="h-16 w-16 text-blue-500 mx-auto mb-4" />
                <h1 className="text-4xl font-extrabold text-gray-900 dark:text-white">Системные справочники</h1>
                <p className="mt-2 text-lg text-gray-500 dark:text-gray-400">Описание системных констант, статусов и типов данных.</p>
            </header>

            {renderTable('Статусы путевых листов', WAYBILL_STATUS_TRANSLATIONS)}
            {renderTable('Статусы организаций', ORGANIZATION_STATUS_TRANSLATIONS)}
            {renderTable('Статусы транспортных средств', VEHICLE_STATUS_TRANSLATIONS)}
            {renderTable('Типы складских операций', STOCK_TRANSACTION_TYPE_TRANSLATIONS)}
            {renderTable('Причины списания со склада', STOCK_EXPENSE_REASON_TRANSLATIONS)}
            {renderTable('Типы мест хранения', STORAGE_TYPE_TRANSLATIONS)}
            {renderTable('Статусы бланков строгой отчетности', BLANK_STATUS_TRANSLATIONS)}
            {renderTable('Причины порчи бланков', SPOIL_REASON_TRANSLATIONS)}
            {renderTable('Роли пользователей', ROLE_TRANSLATIONS)}
            {renderTable('Типы сотрудников', EMPLOYEE_TYPE_TRANSLATIONS)}
        </div>
    );
};

export default SystemDictionariesGuide;
