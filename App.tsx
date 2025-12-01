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
    <div className="min-h-screen bg-gray-50">
      {/* Navigation */}
      <nav className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex">
              <div className="flex-shrink-0 flex items-center">
                <h1 className="text-xl font-bold text-gray-900">
                  Waybill Management
                  {isDriverMode && <span className="ml-2 text-sm text-gray-500">(Driver Mode)</span>}
                  {!isDriverMode && <span className="ml-2 text-sm text-blue-600">(Central Mode)</span>}
                </h1>
              </div>
              <div className="hidden sm:ml-6 sm:flex sm:space-x-8">
                <button
                  onClick={() => setCurrentPage('dashboard')}
                  className={`inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium ${currentPage === 'dashboard'
                    ? 'border-blue-500 text-gray-900'
                    : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                    }`}
                >
                  Панель управления
                </button>
                <button
                  onClick={() => setCurrentPage('waybills')}
                  className={`inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium ${currentPage === 'waybills' || currentPage === 'waybill-detail'
                    ? 'border-blue-500 text-gray-900'
                    : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                    }`}
                >
                  Путевые листы
                </button>
                <button
                  onClick={() => setCurrentPage('vehicles')}
                  className={`inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium ${currentPage === 'vehicles'
                    ? 'border-blue-500 text-gray-900'
                    : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                    }`}
                >
                  Транспорт
                </button>
                <button
                  onClick={() => setCurrentPage('employees')}
                  className={`inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium ${currentPage === 'employees'
                    ? 'border-blue-500 text-gray-900'
                    : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                    }`}
                >
                  Сотрудники
                </button>
                <button
                  onClick={() => setCurrentPage('reports')}
                  className={`inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium ${currentPage === 'reports'
                    ? 'border-blue-500 text-gray-900'
                    : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                    }`}
                >
                  Отчёты
                </button>
                <button
                  onClick={() => setCurrentPage('admin')}
                  className={`inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium ${currentPage === 'admin'
                    ? 'border-blue-500 text-gray-900'
                    : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                    }`}
                >
                  Настройки
                </button>
              </div>
            </div>
            <div className="flex items-center">
              <span className="text-sm text-gray-700 mr-4">
                {currentUser.displayName} ({currentUser.role})
              </span>
              <button
                onClick={logout}
                className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                Выйти
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <Suspense fallback={<LoadingSpinner />}>
          {renderPage()}
        </Suspense>
      </main>
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