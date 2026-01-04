import React, { useState, lazy, Suspense } from 'react';
import { TabsNavigation } from '../shared/TabsNavigation';
import { useAuth } from '../../services/auth';
import LoadingSpinner from '../common/LoadingSpinner';

const WaybillList = lazy(() => import('./WaybillList'));
const BlankManagement = lazy(() => import('../admin/BlankManagement'));

type WaybillsTab = 'journal' | 'blanks';

interface WaybillsPageProps {
    onSelectWaybill: (id: string) => void;
}

export const WaybillsPage: React.FC<WaybillsPageProps> = ({ onSelectWaybill }) => {
    const [activeTab, setActiveTab] = useState<WaybillsTab>('journal');
    const { can, currentUser, appSettings } = useAuth();

    const tabs = [
        { id: 'journal', label: 'Журнал' },
    ];

    const canManageBlanks = can('admin.panel') || (currentUser?.role === 'driver' && appSettings?.blanks?.driverCanAddBatches);

    if (canManageBlanks) {
        tabs.push({ id: 'blanks', label: 'Бланки ПЛ' });
    }

    return (
        <div className="space-y-6">
            <TabsNavigation
                tabs={tabs}
                activeTab={activeTab}
                onTabChange={(id) => setActiveTab(id as WaybillsTab)}
                className="mb-6"
            />

            <Suspense fallback={<LoadingSpinner />}>
                {activeTab === 'journal' && (
                    <WaybillList
                        waybillToOpen={null}
                        onWaybillOpened={() => { }}
                    // We intercept the selection to potentially handle navigation if needed, 
                    // but WaybillList usually handles opening detail view internally via state.
                    // The onSelectWaybill prop in App.tsx switches page to 'waybill-detail'.
                    />
                )}
                {activeTab === 'blanks' && (
                    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-6">
                        <BlankManagement />
                    </div>
                )}
            </Suspense>
        </div>
    );
};

export default WaybillsPage;
