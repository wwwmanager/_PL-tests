/**
 * Toast — UI-DESIGN-002
 * Toast notification component with slide-in animation
 */
import React, { useEffect, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { CheckCircleIcon, ExclamationCircleIcon, XIcon } from '../Icons';

type ToastVariant = 'success' | 'error' | 'warning' | 'info';

interface ToastProps {
    /** Toast message */
    message: string;
    /** Toast variant */
    variant?: ToastVariant;
    /** Auto-dismiss duration in ms (0 = no auto-dismiss) */
    duration?: number;
    /** Called when toast is dismissed */
    onClose: () => void;
    /** Whether toast is visible */
    isVisible: boolean;
}

interface ToastItem {
    id: string;
    message: string;
    variant: ToastVariant;
    duration: number;
}

const variantConfig: Record<ToastVariant, { bg: string; icon: React.ReactNode }> = {
    success: {
        bg: 'bg-teal-600 dark:bg-teal-500',
        icon: <CheckCircleIcon className="h-5 w-5 text-white" />,
    },
    error: {
        bg: 'bg-red-600 dark:bg-red-500',
        icon: <ExclamationCircleIcon className="h-5 w-5 text-white" />,
    },
    warning: {
        bg: 'bg-amber-500 dark:bg-amber-400',
        icon: <ExclamationCircleIcon className="h-5 w-5 text-white" />,
    },
    info: {
        bg: 'bg-blue-600 dark:bg-blue-500',
        icon: <ExclamationCircleIcon className="h-5 w-5 text-white" />,
    },
};

export const Toast: React.FC<ToastProps> = ({
    message,
    variant = 'info',
    duration = 3000,
    onClose,
    isVisible,
}) => {
    const [isExiting, setIsExiting] = useState(false);
    const config = variantConfig[variant];

    const handleClose = useCallback(() => {
        setIsExiting(true);
        setTimeout(onClose, 300); // Wait for exit animation
    }, [onClose]);

    useEffect(() => {
        if (isVisible && duration > 0) {
            const timer = setTimeout(handleClose, duration);
            return () => clearTimeout(timer);
        }
    }, [isVisible, duration, handleClose]);

    if (!isVisible && !isExiting) return null;

    return createPortal(
        <div
            className={`fixed top-4 right-4 z-[60] flex items-center gap-3 px-4 py-3 rounded-lg shadow-xl text-white font-medium max-w-sm
        ${config.bg}
        ${isExiting ? 'animate-slide-out-right' : 'animate-slide-in-right'}
      `}
        >
            {config.icon}
            <span className="flex-1">{message}</span>
            <button
                onClick={handleClose}
                className="text-white/80 hover:text-white transition-colors"
                aria-label="Закрыть"
            >
                <XIcon className="h-4 w-4" />
            </button>
            <style>{`
        @keyframes slide-in-right {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
        @keyframes slide-out-right {
          from { transform: translateX(0); opacity: 1; }
          to { transform: translateX(100%); opacity: 0; }
        }
        .animate-slide-in-right { animation: slide-in-right 0.3s ease-out forwards; }
        .animate-slide-out-right { animation: slide-out-right 0.3s ease-in forwards; }
      `}</style>
        </div>,
        document.body
    );
};

// Toast manager for multiple toasts
let toastIdCounter = 0;
const toastListeners: ((toasts: ToastItem[]) => void)[] = [];
let toasts: ToastItem[] = [];

const notifyListeners = () => {
    toastListeners.forEach(listener => listener([...toasts]));
};

export const toast = {
    success: (message: string, duration = 3000) => {
        const id = `toast-${++toastIdCounter}`;
        toasts = [...toasts, { id, message, variant: 'success', duration }];
        notifyListeners();
        return id;
    },
    error: (message: string, duration = 5000) => {
        const id = `toast-${++toastIdCounter}`;
        toasts = [...toasts, { id, message, variant: 'error', duration }];
        notifyListeners();
        return id;
    },
    warning: (message: string, duration = 4000) => {
        const id = `toast-${++toastIdCounter}`;
        toasts = [...toasts, { id, message, variant: 'warning', duration }];
        notifyListeners();
        return id;
    },
    info: (message: string, duration = 3000) => {
        const id = `toast-${++toastIdCounter}`;
        toasts = [...toasts, { id, message, variant: 'info', duration }];
        notifyListeners();
        return id;
    },
    dismiss: (id: string) => {
        toasts = toasts.filter(t => t.id !== id);
        notifyListeners();
    },
    dismissAll: () => {
        toasts = [];
        notifyListeners();
    },
    subscribe: (listener: (toasts: ToastItem[]) => void) => {
        toastListeners.push(listener);
        return () => {
            const index = toastListeners.indexOf(listener);
            if (index > -1) toastListeners.splice(index, 1);
        };
    },
};

// Toast container component
export const ToastContainer: React.FC = () => {
    const [items, setItems] = useState<ToastItem[]>([]);

    useEffect(() => {
        return toast.subscribe(setItems);
    }, []);

    return (
        <>
            {items.map((item, index) => (
                <Toast
                    key={item.id}
                    message={item.message}
                    variant={item.variant}
                    duration={item.duration}
                    isVisible={true}
                    onClose={() => toast.dismiss(item.id)}
                />
            ))}
        </>
    );
};

export default Toast;
