// AuditLogViewer Component - View audit logs in Admin panel
import React, { useState, useEffect } from 'react';
import { httpClient } from '../../services/httpClient';
import './AuditLogViewer.css';

interface AuditLog {
    id: string;
    userId: string;
    action: string;
    entityType: string;
    entityId?: string;
    changes?: Record<string, any>;
    ipAddress?: string;
    userAgent?: string;
    createdAt: string;
    user?: {
        id: string;
        email: string;
        fullName: string;
    };
}

interface AuditLogsResponse {
    logs: AuditLog[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
}

export const AuditLogViewer: React.FC = () => {
    const [logs, setLogs] = useState<AuditLog[]>([]);
    const [loading, setLoading] = useState(true);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [limit] = useState(50);

    // Filters
    const [actionFilter, setActionFilter] = useState('');
    const [entityTypeFilter, setEntityTypeFilter] = useState('');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);

    useEffect(() => {
        loadLogs();
    }, [page, actionFilter, entityTypeFilter, startDate, endDate]);

    const loadLogs = async () => {
        try {
            setLoading(true);
            const params = new URLSearchParams({
                page: page.toString(),
                limit: limit.toString(),
            });

            if (actionFilter) params.append('action', actionFilter);
            if (entityTypeFilter) params.append('entityType', entityTypeFilter);
            if (startDate) params.append('startDate', startDate);
            if (endDate) params.append('endDate', endDate);

            const response = await httpClient.get<{ success: boolean; data: AuditLogsResponse }>(
                `/audit/logs?${params.toString()}`
            );

            if (response.data.success) {
                setLogs(response.data.data.logs);
                setTotal(response.data.data.total);
            }
        } catch (error) {
            console.error('Failed to load audit logs:', error);
        } finally {
            setLoading(false);
        }
    };

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleString('ru-RU');
    };

    const getActionBadgeClass = (action: string) => {
        switch (action) {
            case 'CREATE': return 'badge-success';
            case 'UPDATE': return 'badge-warning';
            case 'DELETE': return 'badge-danger';
            case 'STATUS_CHANGE': return 'badge-info';
            default: return 'badge-secondary';
        }
    };

    return (
        <div className="audit-log-viewer">
            <h2>Журнал аудита</h2>

            {/* Filters */}
            <div className="audit-filters">
                <div className="filter-group">
                    <label>Действие:</label>
                    <select
                        value={actionFilter}
                        onChange={(e) => { setActionFilter(e.target.value); setPage(1); }}
                    >
                        <option value="">Все</option>
                        <option value="CREATE">Создание</option>
                        <option value="UPDATE">Изменение</option>
                        <option value="DELETE">Удаление</option>
                        <option value="STATUS_CHANGE">Смена статуса</option>
                        <option value="LOGIN">Вход</option>
                        <option value="LOGOUT">Выход</option>
                    </select>
                </div>

                <div className="filter-group">
                    <label>Тип сущности:</label>
                    <select
                        value={entityTypeFilter}
                        onChange={(e) => { setEntityTypeFilter(e.target.value); setPage(1); }}
                    >
                        <option value="">Все</option>
                        <option value="waybill">Путевой лист</option>
                        <option value="vehicle">ТС</option>
                        <option value="driver">Водитель</option>
                        <option value="employee">Сотрудник</option>
                    </select>
                </div>

                <div className="filter-group">
                    <label>Дата от:</label>
                    <input
                        type="date"
                        value={startDate}
                        onChange={(e) => { setStartDate(e.target.value); setPage(1); }}
                    />
                </div>

                <div className="filter-group">
                    <label>Дата до:</label>
                    <input
                        type="date"
                        value={endDate}
                        onChange={(e) => { setEndDate(e.target.value); setPage(1); }}
                    />
                </div>

                <button onClick={() => { setActionFilter(''); setEntityTypeFilter(''); setStartDate(''); setEndDate(''); setPage(1); }}>
                    Сбросить
                </button>
            </div>

            {/* Table */}
            {loading ? (
                <div className="loading">Загрузка...</div>
            ) : (
                <>
                    <div className="audit-stats">
                        Всего записей: {total}
                    </div>

                    <table className="audit-table">
                        <thead>
                            <tr>
                                <th>Дата и время</th>
                                <th>Пользователь</th>
                                <th>Действие</th>
                                <th>Тип</th>
                                <th>ID объекта</th>
                                <th>IP</th>
                                <th></th>
                            </tr>
                        </thead>
                        <tbody>
                            {logs.map((log) => (
                                <tr key={log.id}>
                                    <td>{formatDate(log.createdAt)}</td>
                                    <td>{log.user?.fullName || log.user?.email || 'Неизвестно'}</td>
                                    <td>
                                        <span className={`badge ${getActionBadgeClass(log.action)}`}>
                                            {log.action}
                                        </span>
                                    </td>
                                    <td>{log.entityType}</td>
                                    <td>{log.entityId?.substring(0, 8)}...</td>
                                    <td>{log.ipAddress || '-'}</td>
                                    <td>
                                        <button onClick={() => setSelectedLog(log)}>
                                            Детали
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>

                    {/* Pagination */}
                    <div className="pagination">
                        <button
                            disabled={page === 1}
                            onClick={() => setPage(page - 1)}
                        >
                            Назад
                        </button>
                        <span>Страница {page} из {Math.ceil(total / limit)}</span>
                        <button
                            disabled={page >= Math.ceil(total / limit)}
                            onClick={() => setPage(page + 1)}
                        >
                            Вперёд
                        </button>
                    </div>
                </>
            )}

            {/* Detail Modal */}
            {selectedLog && (
                <div className="modal-backdrop" onClick={() => setSelectedLog(null)}>
                    <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                        <h3>Детали записи аудита</h3>
                        <div className="audit-detail">
                            <p><strong>ID:</strong> {selectedLog.id}</p>
                            <p><strong>Пользователь:</strong> {selectedLog.user?.fullName} ({selectedLog.user?.email})</p>
                            <p><strong>Действие:</strong> {selectedLog.action}</p>
                            <p><strong>Тип сущности:</strong> {selectedLog.entityType}</p>
                            <p><strong>ID сущности:</strong> {selectedLog.entityId}</p>
                            <p><strong>IP адрес:</strong> {selectedLog.ipAddress}</p>
                            <p><strong>User Agent:</strong> {selectedLog.userAgent}</p>
                            <p><strong>Дата:</strong> {formatDate(selectedLog.createdAt)}</p>

                            {selectedLog.changes && (
                                <>
                                    <h4>Изменения:</h4>
                                    <pre>{JSON.stringify(selectedLog.changes, null, 2)}</pre>
                                </>
                            )}
                        </div>
                        <button onClick={() => setSelectedLog(null)}>Закрыть</button>
                    </div>
                </div>
            )}
        </div>
    );
};
