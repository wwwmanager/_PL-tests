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
            <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                    <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg">
                        <CubeIcon className="w-6 h-6 text-blue-600 dark:text-blue-300" />
                    </div>
                    <h1 className="text-2xl font-bold text-gray-800 dark:text-white">Склад</h1>
                </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden">
                <div className="border-b dark:border-gray-700">
                    <nav className="flex -mb-px overflow-x-auto">
                        <button
                            data-testid="tab-nomenclature"
                            onClick={() => setActiveTab('nomenclature')}
                            className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${activeTab === 'nomenclature'
                                ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                                : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                                }`}
                        >
                            Номенклатура
                        </button>
                        <button
                            data-testid="tab-balances"
                            onClick={() => setActiveTab('balances')}
                            className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${activeTab === 'balances'
                                ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                                : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                                }`}
                        >
                            Остатки топлива
                        </button>
                        <button
                            data-testid="tab-movements"
                            onClick={() => setActiveTab('movements')}
                            className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${activeTab === 'movements'
                                ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                                : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                                }`}
                        >
                            Журнал движений
                        </button>
                        <button
                            data-testid="tab-fuel-cards"
                            onClick={() => setActiveTab('fuel-cards')}
                            className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${activeTab === 'fuel-cards'
                                ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                                : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                                }`}
                        >
                            💳 Топливные карты
                        </button>
                        <button
                            data-testid="tab-rules"
                            onClick={() => setActiveTab('rules')}
                            className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${activeTab === 'rules'
                                ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                                : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                                }`}
                        >
                            ⚙️ Правила
                        </button>
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

