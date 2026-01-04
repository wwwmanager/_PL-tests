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
    const [activeTab, setActiveTab] = useState<Tab>('balances');

    return (
        <div className="space-y-6">


            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
                <div className="px-4">
                    <TabsNavigation
                        tabs={[
                            { id: 'balances', label: 'Остатки', icon: BalancesIcon },
                            { id: 'movements', label: 'Операции', icon: MovementsIcon },
                            { id: 'fuel-cards', label: 'Топливные карты', icon: FuelCardIcon },
                            { id: 'rules', label: 'Правила', icon: RulesIcon },
                        ]}
                        activeTab={activeTab}
                        onTabChange={(id) => setActiveTab(id as Tab)}
                        className="border-none"
                    />
                </div>

                <div className="p-4">
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

