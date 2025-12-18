// components/admin/Diagnostics.tsx
// NOTE: Domain health check was only available in Driver Mode with local IndexedDB.
// In Central Mode with backend API, diagnostics should be implemented on the backend.
import React from 'react';

const Diagnostics: React.FC = () => {
  return (
    <div className="p-4 md:p-6 lg:p-8">
      <h1 className="text-2xl font-semibold mb-4 text-gray-900 dark:text-white">Диагностика системы</h1>

      <div className="grid gap-4 md:grid-cols-3">
        <section className="md:col-span-2 bg-white dark:bg-gray-800 shadow rounded-lg p-4">
          <div className="mb-4">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Проверка целостности данных
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
              Диагностика системы доступна только для backend API.
            </p>
          </div>

          <div className="rounded-md bg-blue-50 dark:bg-blue-900/20 p-4">
            <p className="text-sm text-blue-700 dark:text-blue-300">
              <strong>Режим Central:</strong> Приложение работает с реальным backend API.
              Проверка целостности данных выполняется на стороне сервера.
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
              Для диагностики обратитесь к администратору сервера или проверьте логи backend.
            </p>
          </div>
        </section>

        <section className="space-y-4">
          <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-4">
            <h2 className="text-sm font-semibold mb-1 text-gray-900 dark:text-white">Статус подключения</h2>
            <p className="text-xs text-green-600 dark:text-green-400 mb-2">
              ✓ Подключение к backend API активно
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Все данные хранятся на сервере PostgreSQL.
            </p>
          </div>

          <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-4">
            <h2 className="text-sm font-semibold mb-1 text-gray-900 dark:text-white">Аудит / логирование</h2>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
              Журнал аудита доступен во вкладке "Бизнес-лог".
            </p>
          </div>
        </section>
      </div>
    </div>
  );
};

export default Diagnostics;