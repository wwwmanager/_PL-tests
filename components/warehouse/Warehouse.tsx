import React, { useState } from 'react';
import {
    WarehouseIcon,
    NomenclatureIcon,
    BalancesIcon,
    MovementsIcon,
    FuelCardIcon,
    RulesIcon
} from '../Icons';
import { TabsNavigation } from '../shared/TabsNavigation';
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
                        <WarehouseIcon className="w-8 h-8 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">Склад</h1>
                        <p className="text-sm text-gray-500 dark:text-gray-400">Управление номенклатурой и складскими операциями</p>
                    </div>
                </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
                <div className="px-4">
                    <TabsNavigation
                        tabs={[
                            { id: 'nomenclature', label: 'Номенклатура', icon: NomenclatureIcon },
                            { id: 'balances', label: 'Остатки', icon: BalancesIcon },
                            { id: 'movements', label: 'Движения', icon: MovementsIcon },
                            { id: 'fuel-cards', label: 'Топливные карты', icon: FuelCardIcon },
                            { id: 'rules', label: 'Правила', icon: RulesIcon },
                        ]}
                        activeTab={activeTab}
                        onTabChange={(id) => setActiveTab(id as Tab)}
                        className="border-none"
                    />
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

