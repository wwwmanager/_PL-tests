import React, { useState, useEffect, useMemo } from 'react';
import { getVehicles } from '../../services/vehicleApiFacade';
import { getWaybills } from '../../services/waybillApi';
import { getSeasonSettings } from '../../services/settingsApi';
import { calculatePlannedFuelByMethod, calculateOdometerEnd, FuelCalculationMethod, mapLegacyMethod } from '../../services/fuelCalculationService';
import { Vehicle, Waybill } from '../../types';
import { XIcon, CheckCircleIcon, ExclamationCircleIcon, FunnelIcon } from '../Icons';

type EnrichedWaybill = Awaited<ReturnType<typeof getWaybills>>['waybills'][0];
type EnrichedVehicle = Awaited<ReturnType<typeof getVehicles>>[0];

interface WaybillCheckModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenWaybill: (waybillId: string) => void;
}

type CheckResult = {
  waybill: EnrichedWaybill;
  errors: string[];
  summary: {
    distance: number;
    consumption: number;
    fuelEnd: number;
    rate: number;
    startFuel: number;
    fuelFilled: number;
  };
}

const WaybillCheckModal: React.FC<WaybillCheckModalProps> = ({ isOpen, onClose, onOpenWaybill }) => {
  const [selectedVehicleId, setSelectedVehicleId] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [showOnlyErrors, setShowOnlyErrors] = useState(true);
  const [calculationMethod, setCalculationMethod] = useState<'BOILER' | 'SEGMENTS' | 'MIXED'>('BOILER');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<CheckResult[]>([]);
  const [checkPerformed, setCheckPerformed] = useState(false);

  // Data state
  const [vehicles, setVehicles] = useState<EnrichedVehicle[]>([]);
  const [availableVehicleIds, setAvailableVehicleIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (isOpen) {
      // Load data for dropdown
      Promise.all([getVehicles(), getWaybills()]).then(([vehs, wbsResponse]) => {
        setVehicles(vehs);
        const wbs = wbsResponse.waybills;
        // Collect vehicle IDs that actually have waybills
        const ids = new Set<string>(wbs.map(w => w.vehicleId));
        setAvailableVehicleIds(ids);
      }).catch(err => {
        console.error('Error loading vehicles/waybills:', err);
        // Still show vehicles even if waybills fail
        getVehicles().then(vehs => setVehicles(vehs));
      });

      setSelectedVehicleId('');
      // Default to current year
      const now = new Date();
      setDateFrom(`${now.getFullYear()}-01-01`);
      setDateTo(`${now.getFullYear()}-12-31`);

      setError(null);
      setResults([]);
      setCheckPerformed(false);
      setIsLoading(false);
    }
  }, [isOpen]);

  // Show all vehicles (not just those with waybills)
  const vehiclesWithWaybills = useMemo(() => {
    return vehicles;
  }, [vehicles]);

  const handleCheck = async () => {
    if (!selectedVehicleId || !dateFrom || !dateTo) {
      setError('Пожалуйста, выберите ТС и период.');
      return;
    }

    setIsLoading(true);
    setError(null);
    setResults([]);
    setCheckPerformed(false);

    try {
      // Fetch ALL waybills (limit=10000 to bypass pagination for validation)
      const wbsResponse = await getWaybills({ limit: 10000 });
      const allWaybills = wbsResponse.waybills;
      const seasonSettings = await getSeasonSettings();

      const vehicle = vehicles.find(v => v.id === selectedVehicleId);
      if (!vehicle) throw new Error(`ТС с ID ${selectedVehicleId} не найдено.`);

      // Filter and sort waybills
      const filteredWaybills = allWaybills
        .filter(w => w.vehicleId === vehicle.id && w.date >= dateFrom && w.date <= dateTo)
        .sort((a, b) => {
          const timeDiff = new Date(a.date).getTime() - new Date(b.date).getTime();
          if (timeDiff === 0) {
            return (a.number > b.number) ? 1 : -1;
          }
          return timeDiff;
        });

      if (filteredWaybills.length === 0) {
        setError('Путевые листы для данного ТС и периода не найдены.');
        return;
      }

      const checkResults: CheckResult[] = [];
      let previousWaybill: EnrichedWaybill | null = null;

      for (const currentWaybill of filteredWaybills) {
        const errors: string[] = [];

        // Get consumption rates from vehicle
        const rates = vehicle.fuelConsumptionRates as any || { summerRate: 10, winterRate: 12 };

        // Calculate odometer values
        const odometerStart = Number(currentWaybill.odometerStart) || 0;
        const odometerEnd = Number(currentWaybill.odometerEnd) || 0;
        const odometerDistance = odometerEnd - odometerStart;

        // Check if waybill has routes
        const hasRoutes = currentWaybill.routes && currentWaybill.routes.length > 0;

        // Calculate fuel from fuelLines if available (new structure)
        const fuelStart = Number((currentWaybill as any).fuelLines?.[0]?.fuelStart ?? currentWaybill.fuelAtStart ?? 0);
        const fuelEnd = Number((currentWaybill as any).fuelLines?.[0]?.fuelEnd ?? currentWaybill.fuelAtEnd ?? 0);
        const fuelReceived = Number((currentWaybill as any).fuelLines?.[0]?.fuelReceived ?? currentWaybill.fuelFilled ?? 0);
        const fuelConsumed = Number((currentWaybill as any).fuelLines?.[0]?.fuelConsumed ?? currentWaybill.fuelPlanned ?? 0);

        // WB-CHECK-006: Use unified fuelCalculationService for all calculations
        // Determine the method from the waybill or fallback to dropdown
        const rawMethod = (currentWaybill as any).fuelCalculationMethod || calculationMethod;
        const waybillMethod = mapLegacyMethod(rawMethod) as FuelCalculationMethod;

        // Calculate using unified service
        const calcResult = calculatePlannedFuelByMethod({
          method: waybillMethod,
          routes: currentWaybill.routes || [],
          vehicleRates: rates,
          seasonSettings,
          odometerDistanceKm: odometerDistance,
          baseDate: currentWaybill.date,
          dayMode: 'multi',
        });

        const { totalDistance, plannedFuel: consumption, baseRateUsed } = calcResult;
        const baseRate = baseRateUsed || rates.summerRate || 10;  // Use actual used rate or fallback

        // --- BLOCK 1: Internal Document Consistency ---

        // Check: Odometer (Start + Routes = End) - ONLY if routes are filled
        // WB-CHECK-005: Use unified calculateOdometerEnd from fuelCalculationService
        if (hasRoutes) {
          const calcOdometerEnd = calculateOdometerEnd(odometerStart, currentWaybill.routes || []);
          if (odometerEnd > 0 && odometerEnd !== calcOdometerEnd) {
            errors.push(`Не сходится пробег внутри ПЛ. Расчет: ${calcOdometerEnd}, В документе: ${odometerEnd}. Разница: ${(odometerEnd - calcOdometerEnd)} км.`);
          }
        }

        // Check: Fuel arithmetic (Start + Filled - Consumed = End)
        const calculatedFuelEnd = fuelStart + fuelReceived - fuelConsumed;
        const fuelEndRounded = Math.round(fuelEnd * 100) / 100;
        const calculatedFuelEndRounded = Math.round(calculatedFuelEnd * 100) / 100;

        if (fuelEnd !== 0 && fuelEndRounded !== calculatedFuelEndRounded) {
          errors.push(`Ошибка арифметики топлива. Должно быть: ${calculatedFuelEndRounded.toFixed(2)}, Записано: ${fuelEndRounded.toFixed(2)}.`);
        }

        // Check: Planned/consumed consumption vs norm
        // Calculate -> round to hundredths -> compare exactly
        const consumptionRounded = Math.round(consumption * 100) / 100;
        const fuelConsumedRounded = Math.round(fuelConsumed * 100) / 100;
        if (consumption > 0 && fuelConsumed > 0 && consumptionRounded !== fuelConsumedRounded) {
          errors.push(`Нормативный расход не совпадает. По норме: ${consumptionRounded.toFixed(2)}, В документе: ${fuelConsumedRounded.toFixed(2)}.`);
        }

        // Check: Negative fuel
        if (fuelEnd < 0) {
          errors.push(`Отрицательный остаток топлива: ${fuelEnd.toFixed(2)} л.`);
        }

        // --- BLOCK 2: Chain Continuity ---

        if (previousWaybill) {
          const prevEndOdo = previousWaybill.odometerEnd ?? 0;
          const currStartOdo = currentWaybill.odometerStart;
          const prevFuelEnd = Number((previousWaybill as any).fuelLines?.[0]?.fuelEnd ?? previousWaybill.fuelAtEnd ?? 0);

          // 1. Odometer chain
          if (currStartOdo < prevEndOdo) {
            errors.push(`Скручивание пробега! Начало: ${currStartOdo}, конец пред.: ${prevEndOdo}.`);
          } else if ((currStartOdo - prevEndOdo) > 1) {
            errors.push(`Разрыв в пробеге (пропущенный ПЛ?). Начало: ${currStartOdo}, конец пред.: ${prevEndOdo}. Разница: ${currStartOdo - prevEndOdo} км.`);
          }

          // 2. Fuel chain
          if (Math.abs(fuelStart - prevFuelEnd) > 0.1) {
            errors.push(`Разрыв в топливе. Начало: ${fuelStart.toFixed(2)}, конец пред.: ${prevFuelEnd.toFixed(2)}.`);
          }
        }

        checkResults.push({
          waybill: currentWaybill,
          errors,
          summary: {
            distance: totalDistance,
            consumption,
            fuelEnd: fuelEnd,
            rate: baseRate,
            startFuel: fuelStart,
            fuelFilled: fuelReceived
          }
        });

        previousWaybill = currentWaybill;
      }

      setResults(checkResults);
      setCheckPerformed(true);

    } catch (e: any) {
      setError(e.message || 'Произошла ошибка при проверке.');
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  const filteredResults = useMemo(() => {
    if (showOnlyErrors) {
      return results.filter(r => r.errors.length > 0);
    }
    return results;
  }, [results, showOnlyErrors]);

  const hasResultsButAllGood = checkPerformed && results.length > 0 && filteredResults.length === 0 && showOnlyErrors;
  const errorsCount = results.filter(r => r.errors.length > 0).length;

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-60 z-50 flex justify-center items-center p-4 transition-opacity duration-300"
      aria-labelledby="modal-title" role="dialog" aria-modal="true"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col transform transition-all duration-300"
        onClick={e => e.stopPropagation()}
      >
        <header className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
          <h3 id="modal-title" className="text-xl font-bold text-gray-900 dark:text-white">Проверка путевых листов</h3>
          <button onClick={onClose} className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300" aria-label="Закрыть">
            <XIcon className="h-6 w-6" />
          </button>
        </header>

        <main className="p-6 space-y-4 overflow-y-auto">
          {/* Filters */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end bg-gray-50 dark:bg-gray-700/30 p-4 rounded-lg border dark:border-gray-700">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Автомобиль</label>
              <select
                value={selectedVehicleId}
                onChange={e => setSelectedVehicleId(e.target.value)}
                className="w-full bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-500 rounded-md p-2 focus:ring-blue-500 focus:border-blue-500 text-gray-700 dark:text-gray-200"
              >
                <option value="">Выберите ТС</option>
                {vehiclesWithWaybills.map(v => (
                  <option key={v.id} value={v.id}>{v.registrationNumber} ({v.brand})</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">С даты</label>
              <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="w-full bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-500 rounded-md p-2 focus:ring-blue-500 focus:border-blue-500 text-gray-700 dark:text-gray-200" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">По дату</label>
              <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="w-full bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-500 rounded-md p-2 focus:ring-blue-500 focus:border-blue-500 text-gray-700 dark:text-gray-200" />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Метод расчёта топлива</label>
              <select
                value={calculationMethod}
                onChange={e => setCalculationMethod(e.target.value as 'BOILER' | 'SEGMENTS' | 'MIXED')}
                className="w-full bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-500 rounded-md p-2 focus:ring-blue-500 focus:border-blue-500 text-gray-700 dark:text-gray-200"
              >
                <option value="BOILER">По котлу (BOILER) — только база, без модификаторов</option>
                <option value="SEGMENTS">По отрезкам (SEGMENTS) — с учётом города/прогрева</option>
                <option value="MIXED">Смешанный (MIXED) — усреднённая норма</option>
              </select>
            </div>
            <div className="md:col-span-2 flex items-center pt-2">
              <label className="flex items-center gap-2 cursor-pointer bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 px-3 py-2 rounded-md shadow-sm hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors w-full md:w-auto">
                <input
                  type="checkbox"
                  checked={showOnlyErrors}
                  onChange={(e) => setShowOnlyErrors(e.target.checked)}
                  className="h-4 w-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                />
                <span className="text-sm font-medium text-gray-700 dark:text-gray-200 flex items-center gap-1">
                  <FunnelIcon className="h-4 w-4" /> Показывать только ошибки
                </span>
              </label>
            </div>

            <div className="md:col-span-2 flex justify-end">
              <button
                onClick={handleCheck}
                disabled={isLoading}
                className="bg-blue-600 text-white font-semibold py-2 px-6 rounded-lg shadow-md hover:bg-blue-700 transition-colors disabled:bg-blue-400 w-full md:w-auto"
              >
                {isLoading ? 'Проверка...' : 'Запустить проверку'}
              </button>
            </div>
          </div>

          {/* Results */}
          <div className="space-y-4">
            {error && <p className="text-center text-red-500 bg-red-100 dark:bg-red-900 p-3 rounded-md border border-red-200 dark:border-red-800">{error}</p>}

            {/* Summary bar */}
            {checkPerformed && results.length > 0 && (
              <div className={`p-3 rounded-lg flex items-center justify-between ${errorsCount > 0 ? 'bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-300 dark:border-yellow-700' : 'bg-green-50 dark:bg-green-900/20 border border-green-300 dark:border-green-700'}`}>
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Проверено: <strong>{results.length}</strong> ПЛ.
                  {errorsCount > 0 ? (
                    <span className="text-red-600 dark:text-red-400"> С ошибками: <strong>{errorsCount}</strong></span>
                  ) : (
                    <span className="text-green-600 dark:text-green-400"> Ошибок не найдено!</span>
                  )}
                </span>
              </div>
            )}

            {hasResultsButAllGood && (
              <div className="text-center p-8 bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-800 rounded-lg">
                <CheckCircleIcon className="h-16 w-16 text-green-500 mx-auto mb-4" />
                <h4 className="text-xl font-bold text-green-700 dark:text-green-300">Проверка завершена успешно!</h4>
                <p className="text-gray-600 dark:text-gray-400 mt-2">
                  Ошибок в выбранном диапазоне не найдено.
                </p>
                <button
                  onClick={() => setShowOnlyErrors(false)}
                  className="mt-4 text-blue-600 hover:text-blue-800 underline text-sm"
                >
                  Показать все {results.length} проверенных ПЛ
                </button>
              </div>
            )}

            {filteredResults.length > 0 && (
              <div className="space-y-4">
                {filteredResults.map(({ waybill, errors, summary }) => {
                  const isSuccess = errors.length === 0;
                  const containerClass = isSuccess
                    ? 'bg-green-50 dark:bg-green-900/10 border-green-200 dark:border-green-800/30'
                    : 'bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-800/30';

                  const headerClass = isSuccess
                    ? 'text-green-700 dark:text-green-400'
                    : 'text-red-700 dark:text-red-400';

                  // Calculation details
                  const rawCalc = (summary.distance * summary.rate) / 100;
                  const formulaString = `(Пробег: ${Math.round(summary.distance)} км × Норма ${summary.rate.toFixed(2)})/100`;
                  const fuelBalanceFormula = `= ${summary.startFuel.toFixed(2)} ${summary.fuelFilled > 0 ? `+ ${summary.fuelFilled.toFixed(2)}` : ''} - ${summary.consumption.toFixed(2)}`;

                  return (
                    <div key={waybill.id} className={`rounded-lg border p-4 ${containerClass}`}>
                      {/* HEADER */}
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex items-center gap-3">
                          <h4 className="font-bold text-gray-800 dark:text-gray-100 text-base">
                            ПЛ №{waybill.number} от {new Date(waybill.date).toLocaleDateString('ru-RU')}
                          </h4>
                          <span className={`font-bold ${headerClass}`}>
                            {isSuccess ? 'Проверка пройдена' : `Ошибок: ${errors.length}`}
                          </span>
                        </div>
                        {!isSuccess && (
                          <button
                            onClick={() => onOpenWaybill(waybill.id)}
                            className="bg-yellow-500 hover:bg-yellow-600 text-white font-semibold text-xs py-1 px-3 rounded shadow-sm transition-colors"
                          >
                            Исправить
                          </button>
                        )}
                      </div>

                      {/* DATA LINES */}
                      <div className="text-xs sm:text-sm space-y-1 font-mono text-gray-700 dark:text-gray-300">
                        <div className="border-b border-gray-200 dark:border-gray-700/50 pb-1 mb-1">
                          <span className="font-bold mr-2">Данные ПЛ:</span>
                          Од. выезд: <span className="font-semibold">{waybill.odometerStart} км</span>;
                          {' '}Од. возвращение: <span className="font-semibold">{waybill.odometerEnd} км</span>;
                          {' '}Пробег: <span className="font-semibold">{Math.round(summary.distance)} км</span>;
                          {' '}Расход~<span className="font-semibold">{summary.consumption.toFixed(2)} л</span>;
                          {' '}Ост = <span className="font-semibold">{summary.fuelEnd.toFixed(2)} л</span>;
                        </div>

                        <div>
                          <span className="font-bold mr-2">Проверка:</span>
                          {formulaString} = Расход: {rawCalc.toFixed(3)} ~ <span className="font-semibold">{summary.consumption.toFixed(2)} л</span>;
                          {' '}Ост: {fuelBalanceFormula} = <span className="font-semibold">{summary.fuelEnd.toFixed(2)} л</span>;
                        </div>
                      </div>

                      {/* Errors List */}
                      {errors.length > 0 && (
                        <div className="mt-2 pt-2 border-t border-red-200 dark:border-red-800/30">
                          <ul className="space-y-1">
                            {errors.map((err, index) => (
                              <li key={index} className="flex items-start gap-2 text-red-700 dark:text-red-300 text-sm">
                                <ExclamationCircleIcon className="h-4 w-4 mt-0.5 flex-shrink-0" />
                                <span>{err}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
};

export default WaybillCheckModal;
