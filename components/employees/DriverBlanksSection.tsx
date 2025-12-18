// components/employees/DriverBlanksSection.tsx
import React, { useEffect, useState } from 'react';
import { getDriverBlankSummary, DriverBlankSummary, DriverBlankRange } from '../../services/blankApi';

interface Props {
    driverId: string;
}

const DriverBlanksSection: React.FC<Props> = ({ driverId }) => {
    const [summary, setSummary] = useState<DriverBlankSummary | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!driverId) return;

        let cancelled = false;
        setLoading(true);
        setError(null);

        getDriverBlankSummary(driverId)
            .then((res) => {
                if (!cancelled) {
                    setSummary(res);
                }
            })
            .catch((e) => {
                if (!cancelled) {
                    setError(
                        e instanceof Error
                            ? e.message
                            : 'Ошибка при загрузке бланков водителя',
                    );
                }
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });

        return () => {
            cancelled = true;
        };
    }, [driverId]);

    function renderRangeTable(
        title: string,
        ranges: DriverBlankRange[] | undefined,
    ) {
        const hasData = ranges && ranges.length > 0;

        return (
            <section className="mb-4">
                <h3 className="text-sm font-semibold mb-2 text-gray-700 dark:text-gray-300">{title}</h3>

                {!hasData && (
                    <p className="text-xs text-gray-500 dark:text-gray-400">Нет данных.</p>
                )}

                {hasData && (
                    <div className="overflow-x-auto">
                        <table className="min-w-full text-xs border divide-y divide-gray-200 dark:divide-gray-700 dark:border-gray-700">
                            <thead className="bg-gray-50 dark:bg-gray-700">
                                <tr>
                                    <th className="px-2 py-1 text-left font-medium text-gray-700 dark:text-gray-300">
                                        Серия
                                    </th>
                                    <th className="px-2 py-1 text-right font-medium text-gray-700 dark:text-gray-300">
                                        Номер начала
                                    </th>
                                    <th className="px-2 py-1 text-right font-medium text-gray-700 dark:text-gray-300">
                                        Номер конца
                                    </th>
                                    <th className="px-2 py-1 text-right font-medium text-gray-700 dark:text-gray-300">
                                        Кол-во
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-100 dark:divide-gray-700">
                                {ranges!.map((r, idx) => (
                                    <tr key={idx}>
                                        <td className="px-2 py-1 text-gray-900 dark:text-gray-100">{r.series}</td>
                                        <td className="px-2 py-1 text-right text-gray-900 dark:text-gray-100">
                                            {String(r.numberStart).padStart(6, '0')}
                                        </td>
                                        <td className="px-2 py-1 text-right text-gray-900 dark:text-gray-100">
                                            {String(r.numberEnd).padStart(6, '0')}
                                        </td>
                                        <td className="px-2 py-1 text-right text-gray-900 dark:text-gray-100">
                                            {r.count}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </section>
        );
    }

    return (
        <div className="mt-4">
            <h2 className="text-lg font-semibold mb-3 text-gray-800 dark:text-white">
                Бланки путевых листов (по водителю)
            </h2>

            {loading && (
                <p className="text-sm text-gray-500 dark:text-gray-400">Загрузка бланков…</p>
            )}

            {error && (
                <p className="text-sm text-red-600 mb-2">
                    Ошибка: {error}
                </p>
            )}

            {summary && !loading && (
                <>
                    {renderRangeTable('На руках (выданные / в работе)', summary.active)}
                    {renderRangeTable('Использованы', summary.used)}
                    {renderRangeTable('Испорчены', summary.spoiled)}
                </>
            )}

            {!summary && !loading && !error && (
                <p className="text-xs text-gray-500 dark:text-gray-400">
                    Для этого водителя нет связанных бланков.
                </p>
            )}
        </div>
    );
};

export default DriverBlanksSection;
