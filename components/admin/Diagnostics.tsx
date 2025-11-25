// components/admin/Diagnostics.tsx
import React, { useState } from 'react';
import { runDomainHealthCheck } from '../../services/mockApi';
import type { DomainHealthResult } from '../../services/mockApi';
import { useToast } from '../../hooks/useToast';

const Diagnostics: React.FC = () => {
  const [isRunning, setIsRunning] = useState(false);
  const [result, setResult] = useState<DomainHealthResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { showToast } = useToast?.() ?? { showToast: () => { } };

  async function handleRunDiagnostics() {
    setIsRunning(true);
    setError(null);

    try {
      const res = await runDomainHealthCheck();
      setResult(res);

      if (res.ok) {
        showToast?.('Проверка целостности данных завершена успешно.', 'success');
      } else {
        showToast?.('Обнаружены проблемы с данными. См. детали ниже.', 'error');
      }
    } catch (e) {
      const message =
        e instanceof Error ? e.message : 'Неизвестная ошибка при проверке домена';
      setError(message);
      showToast?.(message, 'error');
    } finally {
      setIsRunning(false);
    }
  }

  return (
    <div className="p-4 md:p-6 lg:p-8">
      <h1 className="text-2xl font-semibold mb-4">Диагностика системы</h1>

      <div className="grid gap-4 md:grid-cols-3">
        {/* Блок доменных инвариантов */}
        <section className="md:col-span-2 bg-white shadow rounded-lg p-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-semibold">
                Проверка целостности данных
              </h2>
              <p className="text-sm text-gray-500">
                Проверяются путевые листы, бланки, складские остатки и балансы топливных карт.
              </p>
            </div>
            <button
              type="button"
              onClick={handleRunDiagnostics}
              disabled={isRunning}
              className={`inline-flex items-center px-4 py-2 rounded-md text-sm font-medium
                ${isRunning
                  ? 'bg-gray-300 text-gray-700 cursor-not-allowed'
                  : 'bg-blue-600 text-white hover:bg-blue-700'
                }`}
            >
              {isRunning ? 'Проверка…' : 'Запустить проверку'}
            </button>
          </div>

          {/* Статус / результат */}
          {error && (
            <div className="mb-4 rounded-md bg-red-50 p-3 text-sm text-red-700">
              <p className="font-semibold">Ошибка запуска проверки</p>
              <p>{error}</p>
            </div>
          )}

          {result && (
            <div className="space-y-4">
              {/* Итоговый статус */}
              <div>
                <span
                  className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium
                    ${result.ok
                      ? 'bg-green-100 text-green-800'
                      : 'bg-red-100 text-red-800'
                    }`}
                >
                  {result.ok
                    ? 'Проблем не обнаружено'
                    : 'Обнаружены проблемы с данными'}
                </span>
                <span className="ml-2 text-xs text-gray-500">
                  {result.checkedAt &&
                    `Проверка от ${new Date(result.checkedAt).toLocaleString()}`}
                </span>
              </div>

              {/* Краткая статистика */}
              {result.stats && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                  <div className="bg-gray-50 rounded p-2">
                    <div className="text-gray-500">Путевые листы</div>
                    <div className="font-semibold">
                      {result.stats.waybillsCount}
                    </div>
                  </div>
                  <div className="bg-gray-50 rounded p-2">
                    <div className="text-gray-500">Бланки</div>
                    <div className="font-semibold">
                      {result.stats.blanksCount}
                    </div>
                  </div>
                  <div className="bg-gray-50 rounded p-2">
                    <div className="text-gray-500">Складские позиции</div>
                    <div className="font-semibold">
                      {result.stats.stockItemsCount}
                    </div>
                  </div>
                  <div className="bg-gray-50 rounded p-2">
                    <div className="text-gray-500">Склад. операции</div>
                    <div className="font-semibold">
                      {result.stats.stockTransactionsCount}
                    </div>
                  </div>
                </div>
              )}

              {/* Список ошибок, если есть */}
              {!result.ok && result.errors && result.errors.length > 0 && (
                <div>
                  <p className="text-sm font-semibold mb-2">
                    Детали нарушений:
                  </p>
                  <div className="max-h-64 overflow-auto text-xs font-mono bg-gray-900 text-gray-100 rounded-md p-3">
                    {result.errors.map((line, idx) => (
                      <div key={idx}>{line}</div>
                    ))}
                  </div>
                </div>
              )}

              {/* Если всё ок, но хочется увидеть лог */}
              {result.ok && (!result.errors || result.errors.length === 0) && (
                <p className="text-xs text-gray-500">
                  Нарушений не обнаружено. Если инварианты будут расширяться,
                  здесь появятся подробные сообщения.
                </p>
              )}
            </div>
          )}

          {!result && !error && (
            <p className="text-sm text-gray-500">
              Нажмите «Запустить проверку», чтобы выполнить полную проверку
              целостности данных (путевые листы, бланки, складской учёт, топливные карты).
            </p>
          )}
        </section>

        {/* Правая колонка под дополнительные проверки (шаблон) */}
        <section className="space-y-4">
          <div className="bg-white shadow rounded-lg p-4">
            <h2 className="text-sm font-semibold mb-1">Хранилище</h2>
            <p className="text-xs text-gray-500 mb-2">
              Сюда можно добавить проверки LocalForage, размера базы, резервных
              копий и т.п.
            </p>
            <p className="text-xs text-gray-400 italic">
              TODO: добавить проверку размера IndexedDB, количества записей в
              ключевых таблицах и т.д.
            </p>
          </div>

          <div className="bg-white shadow rounded-lg p-4">
            <h2 className="text-sm font-semibold mb-1">Аудит / логирование</h2>
            <p className="text-xs text-gray-500 mb-2">
              Можно запускать самотесты auditLog / auditBusiness, проверять
              читаемость чанков и целостность индексов.
            </p>
            <p className="text-xs text-gray-400 italic">
              TODO: добавить кнопку «Прогнать самотесты аудита» и вывести
              статистику.
            </p>
          </div>
        </section>
      </div>
    </div>
  );
};

export default Diagnostics;