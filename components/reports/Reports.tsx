import React, { useState } from 'react';
import PreTripInspectionReport from './PreTripInspectionReport';
import VehicleSummaryReport from './VehicleSummaryReport';
import { TabsNavigation } from '../shared/TabsNavigation';
import { ChartBarIcon, ClipboardCheckIcon } from '../Icons';

const Reports: React.FC = () => {
    const [activeReport, setActiveReport] = useState('vehicle-summary');

    const reports = [
        { id: 'vehicle-summary', label: 'Сводный отчёт по ТС', icon: ChartBarIcon },
        { id: 'pre-trip-inspection', label: 'Предрейсовые осмотры', icon: ClipboardCheckIcon },
    ];

    return (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm min-h-[calc(100vh-8rem)]">
            <div className="px-6 pt-4">
                <TabsNavigation
                    tabs={reports}
                    activeTab={activeReport}
                    onTabChange={setActiveReport}
                />
            </div>

            <div className="p-6">
                {activeReport === 'vehicle-summary' && <VehicleSummaryReport />}
                {activeReport === 'pre-trip-inspection' && <PreTripInspectionReport />}
            </div>
        </div>
    );
};

export default Reports;