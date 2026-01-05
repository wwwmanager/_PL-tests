
import React, { createContext, useState, useCallback, ReactNode, useRef } from 'react';
import { XIcon } from '../components/Icons';

interface ToastMessage {
  id: number;
  message: string;
  type: 'success' | 'error' | 'info';
}

interface ToastContextType {
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
}

export const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const ToastProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  // Track last message to prevent duplicate toasts
  const lastMessageRef = useRef<string>('');
  const lastMessageTimeRef = useRef<number>(0);
  // Counter to ensure unique IDs even when Date.now() returns same value
  const idCounterRef = useRef<number>(0);

  // Use useCallback for removeToast to ensure stable reference
  const removeToast = useCallback((id: number) => {
    setToasts(prevToasts => prevToasts.filter(toast => toast.id !== id));
  }, []);

  const showToast = useCallback((message: string, type: 'success' | 'error' | 'info' = 'success') => {
    // Prevent duplicate toasts (same message within 2 seconds)
    const now = Date.now();
    if (message === lastMessageRef.current && now - lastMessageTimeRef.current < 2000) {
      console.warn('[Toast] Ignoring duplicate toast:', message);
      return;
    }
    lastMessageRef.current = message;
    lastMessageTimeRef.current = now;

    // Generate unique ID using timestamp + counter
    idCounterRef.current += 1;
    const id = now * 1000 + (idCounterRef.current % 1000);
    setToasts(prevToasts => [...prevToasts, { id, message, type }]);

    // Auto-dismiss after 5 seconds
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 5000);
  }, []);

  const getToastClasses = (type: 'success' | 'error' | 'info') => {
    switch (type) {
      case 'success':
        return 'bg-green-500 border-green-600';
      case 'error':
        return 'bg-red-500 border-red-600';
      case 'info':
      default:
        return 'bg-blue-500 border-blue-600';
    }
  };

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-3">
        {toasts.map(toast => (
          <div
            key={toast.id}
            className={`flex items-center justify-between max-w-sm w-full p-4 text-white rounded-lg shadow-lg border-l-4 ${getToastClasses(toast.type)} animate-fade-in-right`}
          >
            <span>{toast.message}</span>
            <button
              onClick={() => removeToast(toast.id)}
              className="ml-4 p-1 rounded-full hover:bg-white/20 cursor-pointer"
              type="button"
            >
              <XIcon className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>
      <style>{`
        @keyframes fade-in-right {
            from {
                opacity: 0;
                transform: translateX(100%);
            }
            to {
                opacity: 1;
                transform: translateX(0);
            }
        }
        .animate-fade-in-right {
            animation: fade-in-right 0.3s ease-out forwards;
        }
       `}</style>
    </ToastContext.Provider>
  );
};

