import React, { useState } from 'react';
import { ArrowDownIcon, ArrowUpIcon } from '../Icons';

interface CollapsibleSectionProps {
  title: string;
  children: React.ReactNode;
  // Controlled mode
  isCollapsed?: boolean;
  onToggle?: () => void;
  // Uncontrolled mode
  defaultOpen?: boolean;
}

const CollapsibleSection: React.FC<CollapsibleSectionProps> = ({
  title,
  isCollapsed: controlledIsCollapsed,
  onToggle,
  children,
  defaultOpen = false,
}) => {
  const [internalCollapsed, setInternalCollapsed] = useState(!defaultOpen);

  // Use controlled mode if isCollapsed is provided, otherwise use internal state
  const isControlled = controlledIsCollapsed !== undefined;
  const isCollapsed = isControlled ? controlledIsCollapsed : internalCollapsed;

  const handleToggle = () => {
    if (isControlled && onToggle) {
      onToggle();
    } else {
      setInternalCollapsed(!internalCollapsed);
    }
  };

  return (
    <div className="bg-white dark:bg-gray-700/50 rounded-lg shadow-sm overflow-hidden transition-all duration-300 border border-gray-200 dark:border-gray-600">
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          handleToggle();
        }}
        className="w-full flex justify-between items-center p-4 text-left bg-gray-50 dark:bg-gray-800/50 hover:bg-gray-100 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
        aria-expanded={!isCollapsed}
      >
        <h3 className="text-lg font-semibold text-gray-800 dark:text-white">{title}</h3>
        {isCollapsed ? <ArrowDownIcon className="h-6 w-6 text-gray-500 dark:text-gray-400" /> : <ArrowUpIcon className="h-6 w-6 text-gray-500 dark:text-gray-400" />}
      </button>
      {!isCollapsed && (
        <div className="p-6 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-600">
          {children}
        </div>
      )}
    </div>
  );
};

export default CollapsibleSection;
