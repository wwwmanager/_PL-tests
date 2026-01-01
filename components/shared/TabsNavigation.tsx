import React from 'react';

interface Tab {
    id: string;
    label: string;
    icon?: React.FC<React.SVGProps<SVGSVGElement>>;
}

interface TabsNavigationProps {
    tabs: Tab[];
    activeTab: string;
    onTabChange: (id: string) => void;
    className?: string; // Allow custom classes
}

export const TabsNavigation: React.FC<TabsNavigationProps> = ({ tabs, activeTab, onTabChange, className = '' }) => {
    return (
        <div className={`border-b border-gray-200 dark:border-gray-700 ${className}`}>
            <nav className="-mb-px flex space-x-8 overflow-x-auto" aria-label="Tabs">
                {tabs.map((tab) => {
                    const isActive = activeTab === tab.id;
                    const Icon = tab.icon;
                    return (
                        <button
                            key={tab.id}
                            onClick={() => onTabChange(tab.id)}
                            className={`
                                whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors flex items-center gap-2
                                ${isActive
                                    ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
                                }
                            `}
                            aria-current={isActive ? 'page' : undefined}
                        >
                            {Icon && <Icon className={`h-5 w-5 ${isActive ? 'text-blue-500 dark:text-blue-400' : 'text-gray-400'}`} />}
                            {tab.label}
                        </button>
                    );
                })}
            </nav>
        </div>
    );
};
