// App.tsx
import React, { Suspense, lazy } from 'react';
import * as Sentry from '@sentry/react';
import { AuthProvider, useAuth } from './services/auth';
import { ToastProvider } from './contexts/ToastContext';
import { MeProvider } from './contexts/MeContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { NavigationGuardProvider, useNavigationGuard } from './contexts/NavigationGuardContext';
import LoadingSpinner from './components/common/LoadingSpinner';
import { ContextBar } from './components/common/ContextBar';
import { ThemeToggle } from './components/shared/ThemeToggle';
import Login from './components/auth/Login';
import { Sidebar } from './components/shared/Sidebar';
import { MenuIcon } from './components/Icons';


const Dashboard = lazy(() => import('./components/dashboard/Dashboard'));
const WaybillList = lazy(() => import('./components/waybills/WaybillList'));
const WaybillDetail = lazy(() => import('./components/waybills/WaybillDetail'));
const VehicleList = lazy(() => import('./components/vehicles/VehicleList'));
const EmployeeList = lazy(() => import('./components/employees/EmployeeList'));
const Dictionaries = lazy(() => import('./components/dictionaries/Dictionaries'));
const Reports = lazy(() => import('./components/reports/Reports'));
const Admin = lazy(() => import('./components/admin/Admin'));
const Warehouse = lazy(() => import('./components/warehouse/Warehouse'));

type Page =
  | 'dashboard'
  | 'waybills'
  | 'waybill-detail'
  | 'vehicles'
  | 'employees'
  | 'dictionaries'
  | 'reports'
  | 'warehouse'
  | 'admin';

const AppContent: React.FC = () => {
  const { currentUser, logout, logoutAll, appSettings } = useAuth();
  const { requestNavigation } = useNavigationGuard();
  const [currentPage, setCurrentPage] = React.useState<Page>('dashboard');
  const [selectedWaybillId, setSelectedWaybillId] = React.useState<string | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = React.useState(true);

  // UX-DOC-GUARD-004: Safe navigation wrapper that checks for unsaved changes
  const navigateTo = React.useCallback((page: Page) => {
    requestNavigation(() => {
      setCurrentPage(page);
      // On mobile, close sidebar after navigation
      if (window.innerWidth < 1024) {
        setIsSidebarOpen(false);
      }
    });
  }, [requestNavigation]);

  // UX-NUMBER-SCROLL-FE-010: Disable numeric input value change on scroll
  React.useEffect(() => {
    const onWheel = (e: WheelEvent) => {
      const el = document.activeElement as HTMLElement | null;
      if (!el) return;
      if (el instanceof HTMLInputElement && el.type === 'number') {
        el.blur();
      }
    };

    window.addEventListener('wheel', onWheel, { passive: true });
    return () => window.removeEventListener('wheel', onWheel);
  }, []);

  // Если нет пользователя - показываем Login
  if (!currentUser) {
    return <Login />;
  }

  const isDriverMode = appSettings?.appMode === 'driver' || !appSettings?.appMode;

  const renderPage = () => {
    switch (currentPage) {
      case 'dashboard':
        return <Dashboard />;
      case 'waybills':
        return (
          <WaybillList
            onSelectWaybill={(id) => {
              setSelectedWaybillId(id);
              setCurrentPage('waybill-detail');
            }}
          />
        );
      case 'waybill-detail':
        return (
          <WaybillDetail
            waybillId={selectedWaybillId}
            onBack={() => setCurrentPage('waybills')}
          />
        );
      case 'dictionaries':
        return <Dictionaries />;
      case 'reports':
        return <Reports />;
      case 'warehouse':
        return <Warehouse />;
      case 'admin':
        return <Admin />;
      default:
        return <Dashboard />;
    }
  };

  return (
    <div className="flex h-screen bg-gray-100 dark:bg-gray-900 font-sans">
      {/* Sidebar */}
      <Sidebar
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        currentPage={currentPage === 'waybill-detail' ? 'waybills' : currentPage} // Highlight waybills when details open
        onNavigate={(page) => navigateTo(page as Page)}
      />

      {/* Overlay for mobile */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-20 lg:hidden"
          onClick={() => setIsSidebarOpen(false)}
        ></div>
      )}

      {/* Main Content */}
      <div className={`flex-1 flex flex-col overflow-hidden transition-all duration-300 ${isSidebarOpen ? 'lg:ml-64' : ''}`}>
        <header className="flex items-center justify-between p-4 bg-white dark:bg-gray-800 border-b dark:border-gray-700 shadow-sm z-10 sticky top-0">
          <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="text-gray-600 dark:text-gray-300 focus:outline-none p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-700">
            <MenuIcon className="h-6 w-6" />
          </button>
          <div className="flex items-center gap-4">
            <h1 className="text-xl font-semibold text-gray-800 dark:text-white hidden sm:block">
              Waybill Management {!isDriverMode && <span className="ml-2 text-sm text-blue-600 font-normal">(Central Mode)</span>}
            </h1>
          </div>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <div className="flex flex-col items-end">
              <span className="text-sm font-medium text-gray-800 dark:text-white">
                {currentUser.displayName}
              </span>
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {currentUser.role}
              </span>
            </div>
            <button onClick={logout} className="text-sm text-red-500 hover:text-red-700 ml-2">Выйти</button>
          </div>
        </header>
        {/* REL-001: Context Bar showing organization, department, role */}
        <ContextBar />
        <main className="flex-1 overflow-x-hidden overflow-y-auto bg-gray-50 dark:bg-gray-900 p-4 sm:p-6 lg:p-8">

          <Suspense fallback={<LoadingSpinner />}>
            {renderPage()}
          </Suspense>
        </main>

      </div>
    </div>
  );
};

// Error fallback component for Sentry
const ErrorFallback: React.FC = () => (
  <div className="flex items-center justify-center h-screen bg-gray-100">
    <div className="text-center p-8 bg-white rounded-lg shadow-xl">
      <h1 className="text-2xl font-bold text-red-600 mb-4">Произошла ошибка</h1>
      <p className="text-gray-600 mb-4">Приложение столкнулось с непредвиденной ошибкой.</p>
      <button
        onClick={() => window.location.reload()}
        className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
      >
        Перезагрузить страницу
      </button>
    </div>
  </div>
);

const App: React.FC = () => {
  return (
    <Sentry.ErrorBoundary fallback={<ErrorFallback />}>
      <ThemeProvider>
        <ToastProvider>
          <AuthProvider>
            <MeProvider>
              <NavigationGuardProvider>
                <Suspense fallback={<LoadingSpinner />}>
                  <AppContent />
                </Suspense>
              </NavigationGuardProvider>
            </MeProvider>
          </AuthProvider>
        </ToastProvider>
      </ThemeProvider>
    </Sentry.ErrorBoundary>
  );
};


export default App;