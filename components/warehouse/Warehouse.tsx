import React, { useState } from 'react';
import { CubeIcon } from '../Icons';
import FuelBalances from './FuelBalances';
import FuelMovements from './FuelMovements';
import StockItemList from './StockItemList';
import FuelCards from './FuelCards';
import FuelRules from './FuelRules';
import { RequireCapability } from '../../services/auth';

type Tab = 'nomenclature' | 'balances' | 'movements' | 'fuel-cards' | 'rules';

const Warehouse: React.FC = () => {
    const [activeTab, setActiveTab] = useState<Tab>('nomenclature');

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between bg-white dark:bg-gray-800 p-5 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
                <div className="flex items-center space-x-4">
                    <div className="p-3 bg-blue-50 dark:bg-blue-900/40 rounded-xl transition-all duration-300">
                        <CubeIcon className="w-8 h-8 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">Склад</h1>
                        <p className="text-sm text-gray-500 dark:text-gray-400">Управление номенклатурой и складскими операциями</p>
                    </div>
                </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
                <div className="border-b border-gray-100 dark:border-gray-700">
                    <nav className="flex px-4 -mb-px overflow-x-auto">
                        {[
                            { id: 'nomenclature', label: '📖 Номенклатура' },
                            { id: 'balances', label: '📊 Остатки' },
                            { id: 'movements', label: '📝 Движения' },
                            { id: 'fuel-cards', label: '💳 Топливные карты' },
                            { id: 'rules', label: '⚙️ Правила' },
                        ].map((tab) => (
                            <button
                                key={tab.id}
                                data-testid={`tab-${tab.id}`}
                                onClick={() => setActiveTab(tab.id as Tab)}
                                className={`px-5 py-4 text-sm font-semibold border-b-2 transition-all duration-200 whitespace-nowrap ${activeTab === tab.id
                                    ? 'border-blue-600 text-blue-600 dark:text-blue-400 bg-blue-50/50 dark:bg-blue-900/20'
                                    : 'border-transparent text-gray-500 hover:text-gray-900 dark:hover:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700/50'
                                    }`}
                            >
                                {tab.label}
                            </button>
                        ))}
                    </nav>
                </div>

                <div className="p-4">
                    {activeTab === 'nomenclature' && (
                        <RequireCapability cap="stock.read" fallback={
                            <div className="p-8 text-center text-gray-500">
                                У вас нет прав для просмотра номенклатуры.
                            </div>
                        }>
                            <StockItemList />
                        </RequireCapability>
                    )}
                    {activeTab === 'balances' && (
                        <RequireCapability cap="stock.read" fallback={
                            <div className="p-8 text-center text-gray-500">
                                У вас нет прав для просмотра остатков на складе.
                            </div>
                        }>
                            <FuelBalances />
                        </RequireCapability>
                    )}
                    {activeTab === 'movements' && (
                        <RequireCapability cap="stock.read" fallback={
                            <div className="p-8 text-center text-gray-500">
                                У вас нет прав для просмотра журнала движений.
                            </div>
                        }>
                            <FuelMovements />
                        </RequireCapability>
                    )}
                    {activeTab === 'fuel-cards' && (
                        <RequireCapability cap="stock.read" fallback={
                            <div className="p-8 text-center text-gray-500">
                                У вас нет прав для управления топливными картами.
                            </div>
                        }>
                            <FuelCards />
                        </RequireCapability>
                    )}
                    {activeTab === 'rules' && (
                        <RequireCapability cap="stock.manage" fallback={
                            <div className="p-8 text-center text-gray-500">
                                У вас нет прав для управления правилами.
                            </div>
                        }>
                            <FuelRules />
                        </RequireCapability>
                    )}
                </div>
            </div>
        </div>
    );
};

export default Warehouse;

