// App.tsx
import React, { Suspense, lazy } from 'react';
import * as Sentry from '@sentry/react';
import { AuthProvider, useAuth } from './services/auth';
import { ToastProvider } from './contexts/ToastContext';
import { MeProvider } from './contexts/MeContext';
import { NavigationGuardProvider, useNavigationGuard } from './contexts/NavigationGuardContext';
import LoadingSpinner from './components/common/LoadingSpinner';
import { ContextBar } from './components/common/ContextBar';
import Login from './components/auth/Login';


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
    requestNavigation(() => setCurrentPage(page));
  }, [requestNavigation]);

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
      <aside className={`bg-white dark:bg-gray-800 text-gray-800 dark:text-white transition-all duration-300 ease-in-out shadow-xl z-20 ${isSidebarOpen ? 'w-64' : 'w-0'} overflow-hidden`}>
        <div className="flex items-center justify-center h-20 border-b dark:border-gray-700">
          <h1 className="text-xl font-bold">Путевые листы</h1>
        </div>
        <nav className="mt-4">
          <ul>
            <li><button onClick={() => navigateTo('dashboard')} className={`w-full text-left px-6 py-3 hover:bg-gray-100 dark:hover:bg-gray-700 ${currentPage === 'dashboard' ? 'bg-blue-50 dark:bg-blue-900 border-r-4 border-blue-500' : ''}`}>Панель управления</button></li>
            <li><button onClick={() => navigateTo('waybills')} className={`w-full text-left px-6 py-3 hover:bg-gray-100 dark:hover:bg-gray-700 ${currentPage === 'waybills' ? 'bg-blue-50 dark:bg-blue-900 border-r-4 border-blue-500' : ''}`}>Путевые листы</button></li>
            <li><button onClick={() => navigateTo('dictionaries')} className={`w-full text-left px-6 py-3 hover:bg-gray-100 dark:hover:bg-gray-700 ${currentPage === 'dictionaries' ? 'bg-blue-50 dark:bg-blue-900 border-r-4 border-blue-500' : ''}`}>Справочники</button></li>
            <li><button data-testid="nav-reports" onClick={() => navigateTo('reports')} className={`w-full text-left px-6 py-3 hover:bg-gray-100 dark:hover:bg-gray-700 ${currentPage === 'reports' ? 'bg-blue-50 dark:bg-blue-900 border-r-4 border-blue-500' : ''}`}>Отчеты</button></li>
            <li><button data-testid="nav-warehouse" onClick={() => navigateTo('warehouse')} className={`w-full text-left px-6 py-3 hover:bg-gray-100 dark:hover:bg-gray-700 ${currentPage === 'warehouse' ? 'bg-blue-50 dark:bg-blue-900 border-r-4 border-blue-500' : ''}`}>Склад</button></li>
            <li><button data-testid="nav-admin" onClick={() => navigateTo('admin')} className={`w-full text-left px-6 py-3 hover:bg-gray-100 dark:hover:bg-gray-700 ${currentPage === 'admin' ? 'bg-blue-50 dark:bg-blue-900 border-r-4 border-blue-500' : ''}`}>Настройки</button></li>
          </ul>
        </nav>
        <div className="p-4 border-t dark:border-gray-700 space-y-2">
          <button onClick={logout} className="w-full px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600">Выйти</button>
          <button
            onClick={() => {
              if (window.confirm('Это завершит все ваши активные сессии на других устройствах. Текущее устройство тоже будет разлогинено. Продолжить?')) {
                logoutAll();
              }
            }}
            className="w-full px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 text-xs"
          >
            Выйти со всех устройств
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="flex items-center justify-between p-4 bg-white dark:bg-gray-800 border-b dark:border-gray-700 shadow-md">
          <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="text-gray-600 dark:text-gray-300 focus:outline-none">
            {isSidebarOpen ? '✕' : '☰'}
          </button>
          <h1 className="text-xl font-semibold text-gray-800 dark:text-white">
            Waybill Management {!isDriverMode && <span className="ml-2 text-sm text-blue-600">(Central Mode)</span>}
          </h1>
          <div className="text-sm text-gray-600">
            {currentUser.displayName} ({currentUser.role})
          </div>
        </header>
        {/* REL-001: Context Bar showing organization, department, role */}
        <ContextBar />
        <main className="flex-1 overflow-x-hidden overflow-y-auto bg-gray-100 dark:bg-gray-900 p-4 sm:p-6 lg:p-8">

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
    </Sentry.ErrorBoundary>
  );
};


export default App;