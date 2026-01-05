import React from 'react';
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    DragEndEvent
} from '@dnd-kit/core';
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    horizontalListSortingStrategy,
    useSortable
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { restrictToHorizontalAxis } from '@dnd-kit/modifiers';

interface Tab {
    id: string;
    label: string;
    icon?: React.FC<React.SVGProps<SVGSVGElement>>;
}

interface TabsNavigationProps {
    tabs: Tab[];
    activeTab: string;
    onTabChange: (id: string) => void;
    onReorder?: (tabs: Tab[]) => void;
    className?: string; // Allow custom classes
}

interface SortableTabProps {
    tab: Tab;
    isActive: boolean;
    onTabChange: (id: string) => void;
}

const SortableTab: React.FC<SortableTabProps> = ({ tab, isActive, onTabChange }) => {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging
    } = useSortable({ id: tab.id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        cursor: isDragging ? 'grabbing' : 'grab',
        zIndex: isDragging ? 10 : 'auto',
        opacity: isDragging ? 0.5 : 1,
        touchAction: 'none'
    };

    const Icon = tab.icon;

    return (
        <button
            ref={setNodeRef}
            style={style}
            {...attributes}
            {...listeners}
            onClick={() => onTabChange(tab.id)}
            className={`
                whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors flex items-center gap-2 select-none outline-none focus:outline-none
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
};

export const TabsNavigation: React.FC<TabsNavigationProps> = ({ tabs, activeTab, onTabChange, onReorder, className = '' }) => {
    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 8,
            },
        }),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;

        if (over && active.id !== over.id && onReorder) {
            const oldIndex = tabs.findIndex((t) => t.id === active.id);
            const newIndex = tabs.findIndex((t) => t.id === over.id);
            onReorder(arrayMove(tabs, oldIndex, newIndex));
        }
    };

    if (onReorder) {
        return (
            <div className={`border-b border-gray-200 dark:border-gray-700 ${className}`}>
                <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragEnd={handleDragEnd}
                    modifiers={[restrictToHorizontalAxis]}
                >
                    <nav className="-mb-px flex space-x-8 overflow-x-auto scrollbar-hide" aria-label="Tabs">
                        <SortableContext
                            items={tabs.map(t => t.id)}
                            strategy={horizontalListSortingStrategy}
                        >
                            {tabs.map((tab) => (
                                <SortableTab
                                    key={tab.id}
                                    tab={tab}
                                    isActive={activeTab === tab.id}
                                    onTabChange={onTabChange}
                                />
                            ))}
                        </SortableContext>
                    </nav>
                </DndContext>
            </div>
        );
    }

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
