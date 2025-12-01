// App.tsx
import React, { Suspense, lazy } from 'react';
import { AuthProvider, useAuth } from './services/auth';
import { ToastProvider } from './contexts/ToastContext';
import LoadingSpinner from './components/common/LoadingSpinner';
import Login from './components/auth/Login';

const Dashboard = lazy(() => import('./components/dashboard/Dashboard'));
const WaybillList = lazy(() => import('./components/waybills/WaybillList'));
const WaybillDetail = lazy(() => import('./components/waybills/WaybillDetail'));
const VehicleList = lazy(() => import('./components/vehicles/VehicleList'));
const EmployeeList = lazy(() => import('./components/employees/EmployeeList'));
const Reports = lazy(() => import('./components/reports/Reports'));
const Admin = lazy(() => import('./components/admin/Admin'));

type Page =
  | 'dashboard'
  | 'waybills'
  | 'waybill-detail'
  | 'vehicles'
  | 'employees'
  | 'reports'
  | 'admin';

const AppContent: React.FC = () => {
  const { currentUser, logout, appSettings } = useAuth();
  const [currentPage, setCurrentPage] = React.useState<Page>('dashboard');
  const [selectedWaybillId, setSelectedWaybillId] = React.useState<string | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = React.useState(true);

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
      case 'vehicles':
        return <VehicleList />;
      case 'employees':
        return <EmployeeList />;
      case 'reports':
        return <Reports />;
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
            <li><button onClick={() => setCurrentPage('dashboard')} className={`w-full text-left px-6 py-3 hover:bg-gray-100 dark:hover:bg-gray-700 ${currentPage === 'dashboard' ? 'bg-blue-50 dark:bg-blue-900 border-r-4 border-blue-500' : ''}`}>Панель управления</button></li>
            <li><button onClick={() => setCurrentPage('waybills')} className={`w-full text-left px-6 py-3 hover:bg-gray-100 dark:hover:bg-gray-700 ${currentPage === 'waybills' ? 'bg-blue-50 dark:bg-blue-900 border-r-4 border-blue-500' : ''}`}>Путевые листы</button></li>
            <li><button onClick={() => setCurrentPage('vehicles')} className={`w-full text-left px-6 py-3 hover:bg-gray-100 dark:hover:bg-gray-700 ${currentPage === 'vehicles' ? 'bg-blue-50 dark:bg-blue-900 border-r-4 border-blue-500' : ''}`}>Транспорт</button></li>
            <li><button onClick={() => setCurrentPage('employees')} className={`w-full text-left px-6 py-3 hover:bg-gray-100 dark:hover:bg-gray-700 ${currentPage === 'employees' ? 'bg-blue-50 dark:bg-blue-900 border-r-4 border-blue-500' : ''}`}>Сотрудники</button></li>
            <li><button onClick={() => setCurrentPage('reports')} className={`w-full text-left px-6 py-3 hover:bg-gray-100 dark:hover:bg-gray-700 ${currentPage === 'reports' ? 'bg-blue-50 dark:bg-blue-900 border-r-4 border-blue-500' : ''}`}>Отчеты</button></li>
            <li><button onClick={() => setCurrentPage('admin')} className={`w-full text-left px-6 py-3 hover:bg-gray-100 dark:hover:bg-gray-700 ${currentPage === 'admin' ? 'bg-blue-50 dark:bg-blue-900 border-r-4 border-blue-500' : ''}`}>Настройки</button></li>
          </ul>
        </nav>
        <div className="p-4 border-t dark:border-gray-700">
          <button onClick={logout} className="w-full px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600">Выйти</button>
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
        <main className="flex-1 overflow-x-hidden overflow-y-auto bg-gray-100 dark:bg-gray-900 p-4 sm:p-6 lg:p-8">
          <Suspense fallback={<LoadingSpinner />}>
            {renderPage()}
          </Suspense>
        </main>
      </div>
    </div>
  );
};

const App: React.FC = () => {
  return (
    <ToastProvider>
      <AuthProvider>
        <Suspense fallback={<LoadingSpinner />}>
          <AppContent />
        </Suspense>
      </AuthProvider>
    </ToastProvider>
  );
};

export default App; 