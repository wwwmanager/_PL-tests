

import React, { useState, useEffect, lazy, Suspense } from 'react';
import FuelTypeManagement from '../admin/FuelTypeManagement';
import OrganizationManagement from '../admin/OrganizationManagement';
// FIX: Changed import to named import as VehicleList is not a default export.
import { VehicleList } from '../vehicles/VehicleList';
import EmployeeList from '../employees/EmployeeList';
import RouteList from '../routes/RouteList';
import { DictionaryType } from '../../types';
import { TabsNavigation } from '../shared/TabsNavigation';
import {
    TruckIcon,
    UserGroupIcon,
    BuildingOffice2Icon,
    FireIcon,
    HomeModernIcon,
    GlobeAltIcon,
    NomenclatureIcon,
    CalendarDaysIcon
} from '../Icons';

import StockItemList from '../warehouse/StockItemList';

const GarageManagement = lazy(() => import('./GarageManagement'));
const StorageManagement = lazy(() => import('./StorageManagement'));
const ProductionCalendarSettings = lazy(() => import('../admin/ProductionCalendarSettings'));

interface DictionariesProps {
    subViewToOpen?: DictionaryType | null;
}

const Dictionaries: React.FC<DictionariesProps> = ({ subViewToOpen }) => {

    const allDicts: { id: DictionaryType; label: string; icon: React.FC<React.SVGProps<SVGSVGElement>>; }[] = [
        { id: 'nomenclature', label: 'Номенклатура', icon: NomenclatureIcon },
        { id: 'vehicles', label: 'Транспорт', icon: TruckIcon },
        { id: 'employees', label: 'Сотрудники', icon: UserGroupIcon },
        { id: 'organizations', label: 'Организации', icon: BuildingOffice2Icon },
        { id: 'fuelTypes', label: 'Топливо', icon: FireIcon },
        { id: 'storageLocations', label: 'Места хранения', icon: HomeModernIcon },
        { id: 'calendar', label: 'Календарь', icon: CalendarDaysIcon },
        { id: 'routes', label: 'Маршруты', icon: GlobeAltIcon },
    ];
    // Calendar is missing in original list but present in design, keeping existing for now or adding placeholder?
    // Design has: Transport, Employees, Organizations, Fuel, Stock, Routes, Calendar.
    // I will stick to existing functionality map but update labels.

    const [activeDictionary, setActiveDictionary] = useState<DictionaryType>(allDicts[0]?.id || 'vehicles');

    useEffect(() => {
        const handleNavigate = (event: CustomEvent) => {
            const { view, subView } = event.detail;
            if (view === 'DICTIONARIES' && subView) {
                setActiveDictionary(subView);
            }
        };

        document.addEventListener('navigateTo', handleNavigate as EventListener);

        if (subViewToOpen) {
            setActiveDictionary(subViewToOpen);
        }

        return () => {
            document.removeEventListener('navigateTo', handleNavigate as EventListener);
        };
    }, [subViewToOpen]);

    const renderActiveDictionary = () => {
        switch (activeDictionary) {
            case 'nomenclature': return <StockItemList />;
            case 'fuelTypes': return <FuelTypeManagement />;
            case 'organizations': return <OrganizationManagement />;
            case 'vehicles': return <VehicleList />;
            case 'employees': return <EmployeeList />;
            case 'storageLocations': return <Suspense fallback={<div>Загрузка...</div>}><StorageManagement /></Suspense>;
            case 'calendar': return <Suspense fallback={<div>Загрузка...</div>}><ProductionCalendarSettings /></Suspense>;
            case 'routes': return <RouteList />;
            default: return <div className="p-4 text-gray-500">Выберите справочник.</div>;
        }
    }

    return (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm min-h-[calc(100vh-8rem)]">
            <div className="px-6 pt-4">
                <TabsNavigation
                    tabs={allDicts}
                    activeTab={activeDictionary}
                    onTabChange={(id) => setActiveDictionary(id as DictionaryType)}
                />
            </div>

            <div className="p-6">
                {renderActiveDictionary()}
            </div>
        </div>
    );
};

export default Dictionaries;