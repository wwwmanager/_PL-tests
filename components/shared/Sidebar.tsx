import React, { useState } from 'react';
import {
    TruckIcon,
    DashboardIcon,
    DocumentTextIcon,
    BookOpenIcon,
    ChartBarIcon,
    CogIcon,
    QuestionMarkCircleIcon,
    ArchiveBoxIcon,
    XIcon,
    ArrowDownIcon,
    ArrowUpIcon,
    InformationCircleIcon,
    CodeBracketIcon,
    BeakerIcon
} from '../Icons';

type Page = 'dashboard' | 'waybills' | 'dictionaries' | 'reports' | 'warehouse' | 'admin';

interface SidebarProps {
    isOpen: boolean;
    onClose: () => void;
    currentPage: Page;
    onNavigate: (page: Page) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ isOpen, onClose, currentPage, onNavigate }) => {
    const [isHelpOpen, setIsHelpOpen] = useState(false);

    const navItems: { id: Page; label: string; icon: React.FC<React.SVGProps<SVGSVGElement>> }[] = [
        { id: 'dashboard', label: 'Панель управления', icon: DashboardIcon },
        { id: 'waybills', label: 'Путевые листы', icon: DocumentTextIcon },
        { id: 'dictionaries', label: 'Справочники', icon: BookOpenIcon },
        { id: 'warehouse', label: 'Склад', icon: ArchiveBoxIcon },
        { id: 'reports', label: 'Отчеты', icon: ChartBarIcon },
        { id: 'admin', label: 'Настройки', icon: CogIcon },
    ];

    return (
        <aside
            className={`
        fixed inset-y-0 left-0 z-30 w-64 bg-white dark:bg-gray-800 shadow-xl transform transition-transform duration-300 ease-in-out flex flex-col
        ${isOpen ? 'translate-x-0' : '-translate-x-full'}
      `}
        >
            {/* Header */}
            <div className="flex items-center justify-center h-20 border-b dark:border-gray-700 p-4 relative">
                <div className="flex items-center gap-2 text-gray-800 dark:text-white">
                    <TruckIcon className="h-8 w-8 text-blue-500" />
                    <span className="text-xl font-bold whitespace-nowrap">Путевые листы</span>
                </div>
                <button
                    onClick={onClose}
                    className="absolute right-4 p-1 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 lg:hidden"
                >
                    <XIcon className="h-6 w-6" />
                </button>
            </div>

            {/* Navigation */}
            <nav className="flex-1 overflow-y-auto py-4 px-4 space-y-1">
                {navItems.map((item) => {
                    const isActive = currentPage === item.id;
                    return (
                        <button
                            key={item.id}
                            onClick={() => onNavigate(item.id)}
                            className={`
                                w-full flex items-center p-3 rounded-lg text-left transition-colors font-medium
                                ${isActive
                                    ? 'bg-blue-600 text-white shadow-lg'
                                    : 'text-gray-600 dark:text-gray-300 hover:bg-blue-100 dark:hover:bg-gray-700'
                                }
                            `}
                        >
                            <span className="w-6 h-6"><item.icon /></span>
                            <span className="ml-4">{item.label}</span>
                        </button>
                    );
                })}

                {/* Separator / Bottom section spacing */}
                <div className="mt-8"></div>

                {/* Help Section */}
                <div>
                    <button
                        onClick={() => setIsHelpOpen(!isHelpOpen)}
                        className="w-full flex items-center justify-between p-3 rounded-lg text-left text-gray-600 dark:text-gray-300 hover:bg-blue-100 dark:hover:bg-gray-700 font-medium transition-colors"
                    >
                        <div className="flex items-center">
                            <span className="w-6 h-6"><QuestionMarkCircleIcon /></span>
                            <span className="ml-4">Справка</span>
                        </div>
                        {isHelpOpen ? <ArrowUpIcon className="h-4 w-4" /> : <ArrowDownIcon className="h-4 w-4" />}
                    </button>

                    {isHelpOpen && (
                        <div className="pl-8 transition-all duration-300 ease-in-out space-y-1 mt-1">
                            <button className="w-full flex items-center p-2 rounded-lg text-sm text-gray-600 dark:text-gray-300 hover:bg-blue-50 dark:hover:bg-gray-700 transition-colors">
                                <span className="w-5 h-5 mr-3"><BookOpenIcon /></span>
                                Руководство
                            </button>
                            <button className="w-full flex items-center p-2 rounded-lg text-sm text-gray-600 dark:text-gray-300 hover:bg-blue-50 dark:hover:bg-gray-700 transition-colors">
                                <span className="w-5 h-5 mr-3"><CogIcon /></span>
                                Администратору
                            </button>
                            <button className="w-full flex items-center p-2 rounded-lg text-sm text-gray-600 dark:text-gray-300 hover:bg-blue-50 dark:hover:bg-gray-700 transition-colors">
                                <span className="w-5 h-5 mr-3"><CodeBracketIcon /></span>
                                Разработчику
                            </button>
                            <button className="w-full flex items-center p-2 rounded-lg text-sm text-gray-600 dark:text-gray-300 hover:bg-blue-50 dark:hover:bg-gray-700 transition-colors">
                                <span className="w-5 h-5 mr-3"><BeakerIcon /></span>
                                Тестировщику
                            </button>
                            <button className="w-full flex items-center p-2 rounded-lg text-sm text-gray-600 dark:text-gray-300 hover:bg-blue-50 dark:hover:bg-gray-700 transition-colors">
                                <span className="w-5 h-5 mr-3"><InformationCircleIcon /></span>
                                О программе
                            </button>
                        </div>
                    )}
                </div>

            </nav>

            {/* Footer / Branding if needed */}
            <div className="p-4 border-t dark:border-gray-700 text-center">
                <p className="text-xs text-gray-400">v1.0.0</p>
            </div>
        </aside>
    );
};
