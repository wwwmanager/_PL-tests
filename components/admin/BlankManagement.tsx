// components/admin/BlankManagement.tsx
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useForm, SubmitHandler } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { WaybillBlank, WaybillBlankBatch, BlankStatus, Organization, Employee } from '../../types';
import { getOrganizations } from '../../services/organizationApi';
import { getEmployees } from '../../services/api/employeeApi';
import { listDrivers, DriverListItem } from '../../services/driverApi';
import {
    getBlankBatches, createBlankBatch, materializeBatch,
    issueBlanksToDriver,
    searchBlanks, spoilBlank, bulkSpoilBlanks, countBlanksByFilter,
    getBlanks, releaseBlank
} from '../../services/blankApi';
import { useToast } from '../../hooks/useToast';
import useTable from '../../hooks/useTable';
import DataTable, { Column } from '../shared/DataTable';
import { Badge } from '../shared/Badge';
import { Button } from '../shared/Button';
import Modal from '../shared/Modal';
import ConfirmationModal from '../shared/ConfirmationModal';
import { PlusIcon, TrashIcon, DocumentTextIcon, SparklesIcon, ArrowUpTrayIcon, ArrowUturnLeftIcon } from '../Icons';
import { useAuth } from '../../services/auth';
import { BlankFiltersSchema } from '../../services/schemas';
import { BLANK_STATUS_TRANSLATIONS, BLANK_STATUS_COLORS, SPOIL_REASON_TRANSLATIONS } from '../../constants';
import { EmptyState, getEmptyStateFromError } from '../common/EmptyState';

const FormField: React.FC<{ label: string; children: React.ReactNode; error?: string }> = ({ label, children, error }) => (
    <div><label className="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-1">{label}</label>{children}{error && <p className="text-xs text-red-500 mt-1">{error}</p>}</div>
);
const FormInput = (props: React.InputHTMLAttributes<HTMLInputElement>) => (
    <input
        {...props}
        onWheel={(e) => props.type === 'number' ? e.currentTarget.blur() : props.onWheel?.(e)}
        className="w-full bg-white dark:bg-gray-600 border border-gray-300 dark:border-gray-500 rounded-md p-2"
    />
);
const FormSelect = (props: React.SelectHTMLAttributes<HTMLSelectElement>) => <select {...props} className="w-full bg-white dark:bg-gray-600 border border-gray-300 dark:border-gray-500 rounded-md p-2" />;

// --- Batch Management ---

const batchSchema = z.object({
    organizationId: z.string().min(1, "Организация обязательна"),
    series: z.string().min(1, "Серия обязательна").max(10),
    startNumber: z.number().int().positive("Начальный номер должен быть > 0"),
    endNumber: z.number().int().positive("Конечный номер должен быть > 0"),
    notes: z.string().optional(),
}).refine(data => data.endNumber >= data.startNumber, {
    message: "Конечный номер должен быть >= начального",
    path: ["endNumber"],
});
type BatchFormData = z.infer<typeof batchSchema>;
type CreateBlankBatchInput = Omit<WaybillBlankBatch, 'id' | 'status'>;

const BatchList: React.FC<{ refreshBlanks: () => void }> = ({ refreshBlanks }) => {
    const [batches, setBatches] = useState<WaybillBlankBatch[]>([]);
    const [allBlanks, setAllBlanks] = useState<WaybillBlank[]>([]);
    const [organizations, setOrganizations] = useState<Organization[]>([]);
    const [employees, setEmployees] = useState<DriverListItem[]>([]);
    const [currentBatch, setCurrentBatch] = useState<Partial<WaybillBlankBatch> | null>(null);
    const [issueModalBatch, setIssueModalBatch] = useState<WaybillBlankBatch | null>(null);
    const [driverToIssue, setDriverToIssue] = useState<string>('');
    const [issueRange, setIssueRange] = useState({ start: 0, end: 0 });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<any>(null);
    const { showToast } = useToast();
    const { register, handleSubmit, reset, formState: { errors, isDirty } } = useForm<BatchFormData>({ resolver: zodResolver(batchSchema) });
    const { currentUser } = useAuth();

    const fetchData = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const results = await Promise.allSettled([
                getBlankBatches(),
                getOrganizations(),
                listDrivers(),
                getBlanks()
            ]);

            const batchData = results[0].status === 'fulfilled' ? results[0].value : [];
            const orgData = results[1].status === 'fulfilled' ? results[1].value : [];
            const driversData = results[2].status === 'fulfilled' ? results[2].value : [];
            const blankData = results[3].status === 'fulfilled' ? results[3].value : [];

            if (results[0].status === 'rejected') throw results[0].reason;

            setBatches(batchData.sort((a, b) => b.series.localeCompare(a.series) || b.startNumber - a.startNumber));
            setOrganizations(orgData);
            setEmployees(driversData);
            setAllBlanks(blankData);
        } catch (err: any) {
            console.error('Failed to fetch batches:', err);
            setError(err);
        } finally {
            setLoading(false);
        }
    }, [refreshBlanks]);

    useEffect(() => { fetchData(); }, [fetchData]);

    const enrichedBatches = useMemo(() => {
        return batches.map(b => {
            const blanksInBatch = allBlanks.filter(bl => bl.batchId === b.id);
            const issuedCount = blanksInBatch.filter(bl => bl.status === 'issued' || bl.status === 'used' || bl.status === 'spoiled').length;
            return { ...b, totalCount: b.endNumber - b.startNumber + 1, issuedCount, isMaterialized: blanksInBatch.length > 0 };
        });
    }, [batches, allBlanks]);

    const handleAddNew = () => { reset({ organizationId: organizations[0]?.id || '', series: 'ЧБ', startNumber: 1, endNumber: 100 }); setCurrentBatch({}); };
    const handleCancel = () => setCurrentBatch(null);

    const onSubmit: SubmitHandler<BatchFormData> = async (formData) => {
        try {
            const data = batchSchema.parse(formData);
            const payload: CreateBlankBatchInput = {
                organizationId: data.organizationId,
                series: data.series.trim(),
                startNumber: data.startNumber,
                endNumber: data.endNumber,
                ...(data.notes ? { notes: data.notes.trim() } : {}),
            };
            await createBlankBatch(payload);
            showToast('Пачка бланков создана');
            handleCancel();
            fetchData();
        } catch (e) { showToast((e as Error).message, 'error'); }
    };

    const handleMaterialize = async (batchId: string) => {
        try {
            const res = await materializeBatch(batchId);
            showToast(`Материализовано ${res.created} новых бланков.`, 'success');
            fetchData();
            refreshBlanks();
        } catch (e) { showToast((e as Error).message, 'error'); }
    }

    const openIssueModal = (batch: WaybillBlankBatch) => {
        setIssueModalBatch(batch);
        const availableBlanks = allBlanks.filter(b => b.batchId === batch.id && b.status === 'available').sort((a, b) => a.number - b.number);
        const start = availableBlanks[0]?.number ?? batch.startNumber;
        const end = availableBlanks[availableBlanks.length - 1]?.number ?? batch.endNumber;
        setIssueRange({ start, end });
        setDriverToIssue('');
    };

    const handleIssue = async () => {
        if (!issueModalBatch || !driverToIssue) {
            showToast('Выберите водителя', 'error');
            return;
        }
        if (!currentUser) return;
        try {
            const params = {
                batchId: issueModalBatch.id,
                ownerEmployeeId: driverToIssue,
                ranges: [{ from: issueRange.start, to: issueRange.end }]
            };
            const ctx = { actorId: currentUser.id, deviceId: 'webapp-issue' };
            await issueBlanksToDriver(params, ctx);
            showToast('Бланки выданы водителю', 'success');
            setIssueModalBatch(null);
            setDriverToIssue('');
            fetchData();
            refreshBlanks();
        } catch (e) { showToast((e as Error).message, 'error'); }
    };

    const columns: Column<typeof enrichedBatches[0]>[] = useMemo(() => [
        {
            key: 'organizationId',
            label: 'Организация',
            sortable: true,
            align: 'center',
            render: (b) => organizations.find(o => o.id === b.organizationId)?.shortName
        },
        { key: 'series', label: 'Серия', sortable: true, align: 'center' },
        {
            key: 'startNumber', // Using arbitrary key but rendering range
            label: 'Диапазон номеров',
            sortable: true,
            align: 'center',
            render: (b) => `${String(b.startNumber).padStart(6, '0')} - ${String(b.endNumber).padStart(6, '0')}`
        },
        {
            key: 'issuedCount',
            label: 'Выдано / Всего',
            sortable: false,
            align: 'center',
            render: (b) => <span className="font-medium">{b.issuedCount} <span className="text-gray-400">/</span> {b.totalCount}</span>
        },
        {
            key: 'status',
            label: 'Статус',
            sortable: true,
            align: 'center',
            render: (b) => (
                <Badge variant={b.isMaterialized ? 'success' : 'warning'}>
                    {b.isMaterialized ? 'Материализована' : 'Новая'}
                </Badge>
            )
        }
    ], [organizations]);

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center mb-6">
                <div className="flex items-center gap-3">
                    <DocumentTextIcon className="h-6 w-6 text-gray-600 dark:text-gray-400" />
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white tracking-tight">Пачки бланков</h2>
                    <span className="px-2.5 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 text-xs font-semibold">
                        {enrichedBatches.length}
                    </span>
                </div>
                <Button onClick={handleAddNew} variant="primary" size="sm" leftIcon={<PlusIcon className="h-4 w-4" />}>
                    Добавить
                </Button>
            </div>

            <DataTable
                tableId="batch-list"
                columns={columns}
                data={enrichedBatches}
                keyField="id"
                searchable={true}
                isLoading={loading}
                error={error}
                onRetry={fetchData}
                actions={[
                    {
                        icon: <SparklesIcon className="h-4 w-4" />,
                        onClick: (b) => handleMaterialize(b.id),
                        title: "Материализовать (Создать бланки)",
                        className: "text-blue-600 hover:text-blue-800",
                        show: (b) => !b.isMaterialized
                    },
                    {
                        icon: <ArrowUpTrayIcon className="h-4 w-4" />,
                        onClick: (b) => openIssueModal(b),
                        title: "Выдать водителю",
                        className: "text-green-600 hover:text-green-800",
                        show: (b) => b.isMaterialized
                    }
                ]}
            />

            <Modal isOpen={!!currentBatch} onClose={handleCancel} isDirty={isDirty} title="Новая пачка бланков" footer={<><button onClick={handleCancel} className="bg-gray-200 dark:bg-gray-600 text-gray-800 dark:text-white font-semibold py-2 px-4 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-500">Отмена</button><button onClick={handleSubmit(onSubmit)} className="bg-blue-600 text-white font-semibold py-2 px-4 rounded-lg hover:bg-blue-700">Создать</button></>}>
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                    <FormField label="Организация" error={errors.organizationId?.message}><FormSelect {...register("organizationId")}><option value="">-</option>{organizations.map(o => <option key={o.id} value={o.id}>{o.shortName}</option>)}</FormSelect></FormField>
                    <div className="grid grid-cols-3 gap-4">
                        <FormField label="Серия" error={errors.series?.message}><FormInput {...register("series")} /></FormField>
                        <FormField label="Начальный №" error={errors.startNumber?.message}><FormInput type="number" {...register("startNumber", { valueAsNumber: true })} /></FormField>
                        <FormField label="Конечный №" error={errors.endNumber?.message}><FormInput type="number" {...register("endNumber", { valueAsNumber: true })} /></FormField>
                    </div>
                </form>
            </Modal>

            <Modal isOpen={!!issueModalBatch} onClose={() => setIssueModalBatch(null)} title={`Выдать пачку ${issueModalBatch?.series}`} footer={<><button onClick={() => setIssueModalBatch(null)} className="bg-gray-200 dark:bg-gray-600 text-gray-800 dark:text-white font-semibold py-2 px-4 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-500">Отмена</button><button onClick={handleIssue} className="bg-green-600 text-white font-semibold py-2 px-4 rounded-lg hover:bg-green-700">Выдать</button></>}>
                <div className="space-y-4">
                    <FormField label="Водитель">
                        <FormSelect value={driverToIssue} onChange={e => setDriverToIssue(e.target.value)}>
                            <option value="">Выберите водителя</option>
                            {employees.map(e => <option key={e.id} value={e.id}>{e.shortName}</option>)}
                        </FormSelect>
                    </FormField>
                    <div className="grid grid-cols-2 gap-4">
                        <FormField label="С номера">
                            <FormInput type="number" value={issueRange.start} onChange={e => setIssueRange(r => ({ ...r, start: parseInt(e.target.value, 10) || 0 }))} min={issueModalBatch?.startNumber} max={issueModalBatch?.endNumber} />
                        </FormField>
                        <FormField label="По номер">
                            <FormInput type="number" value={issueRange.end} onChange={e => setIssueRange(r => ({ ...r, end: parseInt(e.target.value, 10) || 0 }))} min={issueModalBatch?.startNumber} max={issueModalBatch?.endNumber} />
                        </FormField>
                    </div>
                </div>
            </Modal>
        </div>
    );
};

// --- Blank Management ---
type SelectionMode = 'none' | 'page' | 'filter';
type SelectionState = {
    mode: SelectionMode;
    selectedIds: Set<string>;
    filterSnapshot?: z.infer<typeof BlankFiltersSchema>;
    excludedIds: Set<string>;
    totalByFilter?: number;
    cappedCount?: number;
};

const BlankList: React.FC<{ key: number }> = () => {
    const [blanks, setBlanks] = useState<WaybillBlank[]>([]);
    const [employees, setEmployees] = useState<DriverListItem[]>([]);
    const [spoilModalData, setSpoilModalData] = useState<{ blank: { id: string, organizationId: string, series: string, number: number }, reason: string } | null>(null);
    const { showToast } = useToast();
    const { currentUser, can, rolePolicies } = useAuth();
    const [pagination, setPagination] = useState({ page: 1, pageSize: 50, total: 0 });
    const [isSpoilModalOpen, setIsSpoilModalOpen] = useState(false);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<any>(null);

    const [selection, setSelection] = useState<SelectionState>({ mode: 'none', selectedIds: new Set(), excludedIds: new Set() });

    const fetchData = useCallback(async (filters: Record<string, string>, page: number, pageSize: number) => {
        setLoading(true);
        setError(null);
        try {
            const query = {
                series: filters.series || undefined,
                number: filters.number ? parseInt(filters.number, 10) : undefined,
                status: filters.status ? [filters.status as BlankStatus] : undefined,
                ownerEmployeeId: filters.ownerEmployeeId || undefined,
                usedInWaybillId: filters.usedInWaybillId || undefined
            };
            const { items, total } = await searchBlanks({ ...query, page, pageSize });
            setBlanks(items);
            setPagination(p => ({ ...p, total }));
        } catch (err: any) {
            console.error('Failed to fetch blanks:', err);
            setError(err);
        } finally {
            setLoading(false);
        }
    }, [employees]);

    useEffect(() => { listDrivers().then(setEmployees); }, []);

    const employeeMap = useMemo(() => new Map(employees.map(e => [e.id, e.shortName])), [employees]);

    const enrichedBlanks = useMemo(() => blanks.map(b => ({
        ...b,
        number: String(b.number).padStart(6, '0'),
        ownerName: (b as any).ownerName || (b.ownerEmployeeId ? employeeMap.get(b.ownerEmployeeId) : '') || '-'
    })), [blanks, employeeMap]);

    type EnrichedBlank = (typeof enrichedBlanks)[0];

    // Define columns for display
    const columns: { key: keyof EnrichedBlank; label: string; width?: string; align?: 'left' | 'center' | 'right' }[] = useMemo(() => [
        { key: 'series', label: 'Серия', align: 'center' },
        { key: 'number', label: 'Номер', align: 'center' },
        { key: 'status', label: 'Статус', align: 'center' },
        { key: 'ownerName', label: 'Владелец', align: 'center' },
        { key: 'usedInWaybillId', label: 'Номер ПЛ', align: 'center' },
    ], []);

    // Filter management
    const [filters, setFilters] = useState<Record<string, string>>({});

    // Debounce filter changes
    const handleFilterChange = (key: string, value: string) => {
        setFilters(prev => ({ ...prev, [key]: value }));
        // Reset to page 1 on filter change
        setPagination(prev => ({ ...prev, page: 1 }));
    };

    // Effect for fetching data when filters or pagination change
    useEffect(() => {
        // Simple debounce could be added here if needed, but for now direct call
        const timer = setTimeout(() => {
            fetchData(filters, pagination.page, pagination.pageSize);
        }, 300);
        return () => clearTimeout(timer);
    }, [filters, pagination.page, pagination.pageSize, fetchData]);


    const handleSpoilConfirm = async () => {
        if (!spoilModalData || !currentUser) return;
        try {
            const params = {
                blankId: spoilModalData.blank.id,
                reasonCode: 'other' as const,
                note: spoilModalData.reason,
            };
            const userPolicies = currentUser.role ? rolePolicies[currentUser.role] : [];
            const allAbilities = new Set([...userPolicies, ...(currentUser.extraCaps || [])]);

            const ctx = {
                abilities: allAbilities,
                actorId: currentUser.id,
                actorEmployeeId: null,
                deviceId: 'webapp-spoil'
            };
            await spoilBlank(params, ctx);
            showToast('Бланк списан.', 'success');
            setSpoilModalData(null);
            fetchData(filters, pagination.page, pagination.pageSize);
        } catch (e) { showToast((e as Error).message, 'error'); }
    };

    const canBeSpoiled = (status: BlankStatus) => status === 'available' || status === 'issued';
    const canBeReleased = (status: BlankStatus) => status === 'reserved';
    const canBeReturned = (status: BlankStatus) => status === 'used';
    const canBeRestored = (status: BlankStatus) => status === 'spoiled';
    const isSpoilAllowed = can('blanks.spoil.self') || can('blanks.spoil.warehouse') || can('blanks.spoil.override');

    // Selection Logic
    const onSelectPage = (checked: boolean) => {
        if (!checked) {
            setSelection({ mode: 'none', selectedIds: new Set(), excludedIds: new Set() });
        } else {
            setSelection({ mode: 'page', selectedIds: new Set(enrichedBlanks.map(b => b.id)), excludedIds: new Set(), filterSnapshot: filters });
        }
    };

    const onToggleRow = (id: string, checked: boolean) => {
        setSelection(prev => {
            const next = { ...prev };
            if (prev.mode === 'filter') {
                const excluded = new Set(prev.excludedIds);
                if (checked) excluded.delete(id); else excluded.add(id);
                next.excludedIds = excluded;
            } else {
                const selected = new Set(prev.selectedIds);
                if (checked) selected.add(id); else selected.delete(id);
                next.selectedIds = selected;
                next.mode = selected.size > 0 ? 'page' : 'none';
            }
            return next;
        });
    };

    const onSelectAllByFilter = async () => {
        setSelection({
            mode: 'filter',
            filterSnapshot: filters, // Use current filters
            excludedIds: new Set(),
            selectedIds: new Set(),
        });
        showToast('Выбраны все записи по фильтру', 'info');
    };

    const selectionCount = useMemo(() => {
        if (selection.mode === 'page') return selection.selectedIds.size;
        // Approximation for UI if we don't have total count readily available without query
        if (selection.mode === 'filter') return pagination.total - selection.excludedIds.size;
        return 0;
    }, [selection, pagination.total]);

    const isAllOnPageSelected = useMemo(() => {
        return enrichedBlanks.length > 0 && enrichedBlanks.every(b => selection.selectedIds.has(b.id) || (selection.mode === 'filter' && !selection.excludedIds.has(b.id)));
    }, [enrichedBlanks, selection]);

    const onBulkSpoilDone = () => {
        fetchData(filters, pagination.page, pagination.pageSize);
        setSelection({ mode: 'none', selectedIds: new Set(), excludedIds: new Set() });
    }

    const handleReleaseBlank = async (blankId: string) => {
        try {
            await releaseBlank(blankId);
            showToast('Резерв бланка снят, возвращён водителю', 'success');
            fetchData(filters, pagination.page, pagination.pageSize);
        } catch (e) {
            showToast('Ошибка снятия резерва: ' + (e as Error).message, 'error');
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center mb-6">
                <div className="flex items-center gap-3">
                    <DocumentTextIcon className="h-6 w-6 text-gray-600 dark:text-gray-400" />
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white tracking-tight">Все бланки</h2>
                    <span className="px-2.5 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 text-xs font-semibold">
                        {pagination.total}
                    </span>
                </div>
                {selectionCount > 0 && isSpoilAllowed && (
                    <Button
                        onClick={() => setIsSpoilModalOpen(true)}
                        variant="warning"
                        size="sm"
                        leftIcon={<TrashIcon className="h-4 w-4" />}
                    >
                        Списать выбранные ({selectionCount})
                    </Button>
                )}
            </div>

            <div className="overflow-x-auto bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                    <thead className="bg-gray-50 dark:bg-gray-800">
                        <tr>
                            <th className="px-6 py-4 w-4 text-center">
                                <input
                                    type="checkbox"
                                    className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 dark:border-gray-600"
                                    onChange={e => onSelectPage(e.target.checked)}
                                    checked={isAllOnPageSelected}
                                />
                            </th>
                            {columns.map(col => (
                                <th key={col.key} className="px-6 py-4 text-center font-bold tracking-tight text-xs text-gray-700 uppercase">
                                    {col.label}
                                </th>
                            ))}
                            <th className="px-6 py-4 text-center font-bold tracking-tight text-xs text-gray-700 uppercase">Действия</th>
                        </tr>
                        {/* Search Row */}
                        <tr>
                            <th className="px-6 py-2 bg-gray-50 dark:bg-gray-700"></th>
                            {columns.map(col => (
                                <th key={`${col.key}-filter`} className="px-6 py-2 bg-gray-50 dark:bg-gray-700">
                                    {col.key === 'status' ? (
                                        <select
                                            value={filters.status || ''}
                                            onChange={(e) => handleFilterChange('status', e.target.value)}
                                            className="w-full text-xs px-3 py-1.5 border rounded-lg border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all font-normal text-center"
                                        >
                                            <option value="">Все статусы</option>
                                            {(Object.keys(BLANK_STATUS_TRANSLATIONS) as BlankStatus[]).map(s => <option key={s} value={s}>{BLANK_STATUS_TRANSLATIONS[s]}</option>)}
                                        </select>
                                    ) : col.key === 'ownerName' ? (
                                        <select
                                            value={filters.ownerEmployeeId || ''}
                                            onChange={(e) => handleFilterChange('ownerEmployeeId', e.target.value)}
                                            className="w-full text-xs px-3 py-1.5 border rounded-lg border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all font-normal text-center"
                                        >
                                            <option value="">Все владельцы</option>
                                            {employees.map(e => <option key={e.id} value={e.id}>{e.shortName}</option>)}
                                        </select>
                                    ) : (
                                        <input
                                            type="text"
                                            placeholder={col.label}
                                            value={filters[col.key] || ''}
                                            onChange={(e) => handleFilterChange(col.key, e.target.value)}
                                            className="w-full text-xs px-3 py-1.5 border rounded-lg border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all font-normal text-center"
                                        />
                                    )}
                                </th>
                            ))}
                            <th className="px-6 py-2 bg-gray-50 dark:bg-gray-700"></th>
                        </tr>
                    </thead>
                    <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                        {loading ? (
                            <tr>
                                <td colSpan={columns.length + 2} className="px-6 py-12 text-center text-gray-500 dark:text-gray-400">
                                    <EmptyState reason={{ type: 'loading' }} />
                                </td>
                            </tr>
                        ) : error || enrichedBlanks.length === 0 ? (
                            <tr>
                                <td colSpan={columns.length + 2} className="px-6 py-12 text-center text-gray-500 dark:text-gray-400">
                                    <EmptyState reason={error ? getEmptyStateFromError(error) : { type: 'empty', entityName: 'бланки' }} onRetry={() => fetchData(filters, pagination.page, pagination.pageSize)} />
                                </td>
                            </tr>
                        ) : (
                            enrichedBlanks.map(b => (
                                <tr key={b.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                                    <td className="px-6 py-4 text-center">
                                        <input
                                            type="checkbox"
                                            checked={selection.mode === 'filter' ? !selection.excludedIds.has(b.id) : selection.selectedIds.has(b.id)}
                                            onChange={e => onToggleRow(b.id, e.target.checked)}
                                            className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 dark:border-gray-600"
                                        />
                                    </td>
                                    {columns.map(col => (
                                        <td key={col.key} className="px-6 py-4 text-sm text-gray-700 dark:text-gray-300 text-center">
                                            {col.key === 'status' ? (
                                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${BLANK_STATUS_COLORS[b.status]}`}>
                                                    {BLANK_STATUS_TRANSLATIONS[b.status]}
                                                </span>
                                            ) : (
                                                (b as any)[col.key] || '-'
                                            )}
                                        </td>
                                    ))}
                                    <td className="px-6 py-4 text-center">
                                        <div className="flex justify-center gap-2">
                                            {isSpoilAllowed && canBeSpoiled(b.status) && (
                                                <button onClick={() => setSpoilModalData({ blank: { id: b.id, series: b.series, number: parseInt(b.number, 10), organizationId: b.organizationId }, reason: '' })} className="text-yellow-600 hover:text-yellow-800 p-1" title="Испортить/списать бланк">
                                                    <TrashIcon className="h-4 w-4" />
                                                </button>
                                            )}
                                            {canBeReleased(b.status) && (
                                                <button onClick={() => handleReleaseBlank(b.id)} className="text-blue-600 hover:text-blue-800 p-1" title="Снять резерв">
                                                    <span className="text-lg">↩️</span>
                                                </button>
                                            )}
                                            {canBeReturned(b.status) && (
                                                <button onClick={() => handleReleaseBlank(b.id)} className="text-green-600 hover:text-green-800 p-1" title="Вернуть в статус Выдан">
                                                    <span className="text-lg">🔄</span>
                                                </button>
                                            )}
                                            {canBeRestored(b.status) && (
                                                <button onClick={() => handleReleaseBlank(b.id)} className="text-blue-600 hover:text-blue-800 p-1" title="Восстановить бланк">
                                                    <ArrowUturnLeftIcon className="h-4 w-4" />
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* Pagination & Selection Footer */}
            <div className="flex items-center justify-between mt-4 px-4 py-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <div className="text-sm text-gray-600 dark:text-gray-300 flex items-center gap-4">
                    <span>
                        Показано {Math.min((pagination.page - 1) * pagination.pageSize + 1, pagination.total)} - {Math.min(pagination.page * pagination.pageSize, pagination.total)} из {pagination.total}
                    </span>
                    {selectionCount > 0 && (
                        <span className="text-blue-600 font-medium bg-blue-50 px-2 py-1 rounded">
                            Выбрано: {selectionCount}
                            {selection.mode === 'page' && pagination.total > selectionCount && (
                                <button onClick={onSelectAllByFilter} className="ml-2 underline hover:text-blue-800">
                                    Выбрать все ({pagination.total})?
                                </button>
                            )}
                        </span>
                    )}
                </div>

                <div className="flex items-center gap-4">
                    <div className="flex gap-2">
                        <button
                            onClick={() => setPagination(p => ({ ...p, page: p.page - 1 }))}
                            disabled={pagination.page <= 1}
                            className="px-3 py-1 bg-white dark:bg-gray-600 border border-gray-300 dark:border-gray-500 rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100 dark:hover:bg-gray-500"
                        >
                            ←
                        </button>
                        <span className="px-3 py-1 text-sm bg-white dark:bg-gray-600 border border-gray-300 dark:border-gray-500 rounded">
                            {pagination.page}
                        </span>
                        <button
                            onClick={() => setPagination(p => ({ ...p, page: p.page + 1 }))}
                            disabled={pagination.page >= Math.ceil(pagination.total / pagination.pageSize)}
                            className="px-3 py-1 bg-white dark:bg-gray-600 border border-gray-300 dark:border-gray-500 rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100 dark:hover:bg-gray-500"
                        >
                            →
                        </button>
                    </div>
                </div>
            </div>

            <ConfirmationModal
                isOpen={!!spoilModalData}
                onClose={() => setSpoilModalData(null)}
                onConfirm={handleSpoilConfirm}
                title={`Испортить бланк ${spoilModalData?.blank.series} ${String(spoilModalData?.blank.number || '').padStart(6, '0')}?`}
                confirmText="Испортить"
                confirmButtonClass="bg-yellow-600 hover:bg-yellow-700"
            >
                <FormField label="Причина списания (необязательно)">
                    <FormInput
                        value={spoilModalData?.reason || ''}
                        onChange={(e) => setSpoilModalData(prev => prev ? { ...prev, reason: e.target.value } : null)}
                    />
                </FormField>
            </ConfirmationModal>

            {isSpoilModalOpen && <BulkSpoilModal isOpen={isSpoilModalOpen} onClose={() => setIsSpoilModalOpen(false)} selection={selection} onDone={onBulkSpoilDone} />}
        </div>
    );
};

type BulkSpoilResult = Awaited<ReturnType<typeof bulkSpoilBlanks>>;

function downloadCSV(data: BulkSpoilResult['skipped'], filename: string) {
    const headers = ['ID бланка', 'Серия', 'Номер', 'Причина пропуска'];
    const rows = data.map(item => [item.blankId, item.series, item.number, item.reason]);
    const csvContent = [headers.join(';'), ...rows.map(row => row.join(';'))].join('\r\n');
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    if (link.download !== undefined) {
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        link.setAttribute("download", filename);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
}

const BulkSpoilModal = ({ isOpen, onClose, selection, onDone }: { isOpen: boolean, onClose: () => void, selection: SelectionState, onDone: () => void }) => {
    const [step, setStep] = useState<'reason' | 'dryRun' | 'result'>('reason');
    const [reason, setReason] = useState({ reasonCode: 'other' as 'damaged' | 'misprint' | 'lost' | 'other', note: '' });
    const [dryRunResult, setDryRunResult] = useState<BulkSpoilResult | null>(null);
    const [finalResult, setFinalResult] = useState<BulkSpoilResult | null>(null);
    const [isWorking, setIsWorking] = useState(false);
    const { currentUser } = useAuth();
    const { showToast } = useToast();

    const handleNext = async () => {
        if (!currentUser) {
            showToast('Не удалось определить пользователя.', 'error');
            return;
        }
        setIsWorking(true);
        try {
            const params = selection.mode === 'page'
                ? { kind: 'ids' as const, blankIds: Array.from(selection.selectedIds), ...reason, dryRun: true }
                : { kind: 'filter' as const, filter: selection.filterSnapshot!, excludedIds: Array.from(selection.excludedIds), ...reason, dryRun: true };
            const result = await bulkSpoilBlanks(params, { abilities: new Set(), actorId: currentUser.id, deviceId: 'webapp' });
            setDryRunResult(result);
            setStep('dryRun');
        } catch (e) { showToast((e as Error).message, 'error'); } finally { setIsWorking(false); }
    };

    const handleConfirm = async () => {
        if (!currentUser) {
            showToast('Не удалось определить пользователя.', 'error');
            return;
        }
        setIsWorking(true);
        try {
            const params = selection.mode === 'page'
                ? { kind: 'ids' as const, blankIds: Array.from(selection.selectedIds), ...reason, dryRun: false }
                : { kind: 'filter' as const, filter: selection.filterSnapshot!, excludedIds: Array.from(selection.excludedIds), ...reason, dryRun: false };
            const result = await bulkSpoilBlanks(params, { abilities: new Set(), actorId: currentUser.id, deviceId: 'webapp' });
            setFinalResult(result);
            setStep('result');
        } catch (e) { showToast((e as Error).message, 'error'); } finally { setIsWorking(false); }
    };

    const handleClose = () => { if (step === 'result') onDone(); onClose(); }

    const renderContent = () => {
        switch (step) {
            case 'reason': return (
                <div className="space-y-4">
                    <FormField label="Причина списания">
                        <FormSelect value={reason.reasonCode} onChange={e => setReason(r => ({ ...r, reasonCode: e.target.value as any }))}>
                            {Object.entries(SPOIL_REASON_TRANSLATIONS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
                        </FormSelect>
                    </FormField>
                    <FormField label="Примечание"><FormInput value={reason.note} onChange={e => setReason(r => ({ ...r, note: e.target.value }))} /></FormField>
                </div>
            );
            case 'dryRun': return (
                <div>
                    <p>К списанию: <b>{dryRunResult?.spoiled.length ?? 0}</b></p>
                    <p>Будет пропущено: <b>{dryRunResult?.skipped.length ?? 0}</b></p>
                    {dryRunResult && dryRunResult.skipped.length > 0 && <button onClick={() => downloadCSV(dryRunResult.skipped, 'skipped_dry_run.csv')} className="text-blue-600 underline text-sm mt-2">Скачать CSV пропущенных</button>}
                </div>
            );
            case 'result': return (
                <div>
                    <p>Успешно списано: <b>{finalResult?.spoiled.length ?? 0}</b></p>
                    <p>Пропущено: <b>{finalResult?.skipped.length ?? 0}</b></p>
                    {finalResult && finalResult.skipped.length > 0 && <button onClick={() => downloadCSV(finalResult.skipped, 'skipped_final.csv')} className="text-blue-600 underline text-sm mt-2">Скачать CSV пропущенных</button>}
                </div>
            );
        }
    };

    const footer = () => {
        switch (step) {
            case 'reason': return <><button onClick={handleClose}>Отмена</button><button onClick={handleNext} disabled={isWorking}>{isWorking ? 'Проверка...' : 'Далее'}</button></>;
            case 'dryRun': return <><button onClick={() => setStep('reason')}>Назад</button><button onClick={handleConfirm} disabled={isWorking} className="bg-yellow-600 text-white">{isWorking ? 'Списание...' : 'Списать'}</button></>;
            case 'result': return <><button onClick={handleClose}>Закрыть</button></>;
        }
    };

    return <Modal isOpen={isOpen} onClose={handleClose} title="Массовое списание бланков" footer={footer()}>{renderContent()}</Modal>
}


// --- Main Component ---
const BlankManagement: React.FC = () => {
    const [activeTab, setActiveTab] = useState<'batches' | 'blanks'>('batches');
    const [refreshCounter, setRefreshCounter] = useState(0);

    const TabButton: React.FC<{ tab: 'batches' | 'blanks'; label: string }> = ({ tab, label }) => (
        <button
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-medium rounded-t-lg border-b-2 ${activeTab === tab ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:border-gray-300'
                }`}
        >{label}</button>
    );

    const handleRefreshBlanks = () => setRefreshCounter(c => c + 1);

    return (
        <div>
            <div className="flex border-b dark:border-gray-700 mb-4">
                <TabButton tab="batches" label="Пачки бланков" />
                <TabButton tab="blanks" label="Все бланки" />
            </div>
            <div>
                {activeTab === 'batches' && <BatchList refreshBlanks={handleRefreshBlanks} />}
                {activeTab === 'blanks' && <BlankList key={refreshCounter} />}
            </div>
        </div>
    );
};

export default BlankManagement;