// components/admin/BlankManagement.tsx
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useForm, SubmitHandler } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { WaybillBlank, WaybillBlankBatch, BlankStatus, Organization, Employee } from '../../types';
import { getOrganizations } from '../../services/organizationApi';
import { getEmployees } from '../../services/api/employeeApi';
import {
    getBlankBatches, createBlankBatch, materializeBatch,
    issueBlanksToDriver,
    searchBlanks, spoilBlank, bulkSpoilBlanks, countBlanksByFilter,
    getBlanks
} from '../../services/blankApi';
import { useToast } from '../../hooks/useToast';
import useTable from '../../hooks/useTable';
import Modal from '../shared/Modal';
import ConfirmationModal from '../shared/ConfirmationModal';
import { PlusIcon, TrashIcon } from '../Icons';
import { useAuth } from '../../services/auth';
import { BlankFiltersSchema } from '../../services/schemas';
import { BLANK_STATUS_TRANSLATIONS, BLANK_STATUS_COLORS, SPOIL_REASON_TRANSLATIONS } from '../../constants';

const FormField: React.FC<{ label: string; children: React.ReactNode; error?: string }> = ({ label, children, error }) => (
    <div><label className="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-1">{label}</label>{children}{error && <p className="text-xs text-red-500 mt-1">{error}</p>}</div>
);
const FormInput = (props: React.InputHTMLAttributes<HTMLInputElement>) => <input {...props} className="w-full bg-white dark:bg-gray-600 border border-gray-300 dark:border-gray-500 rounded-md p-2" />;
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
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [currentBatch, setCurrentBatch] = useState<Partial<WaybillBlankBatch> | null>(null);
    const [issueModalBatch, setIssueModalBatch] = useState<WaybillBlankBatch | null>(null);
    const [driverToIssue, setDriverToIssue] = useState<string>('');
    const [issueRange, setIssueRange] = useState({ start: 0, end: 0 });
    const { showToast } = useToast();
    const { register, handleSubmit, reset, formState: { errors, isDirty } } = useForm<BatchFormData>({ resolver: zodResolver(batchSchema) });
    const { currentUser } = useAuth();

    const fetchData = useCallback(async () => {
        // Use allSettled so partial failures don't block other data
        const results = await Promise.allSettled([
            getBlankBatches(),
            getOrganizations(),
            getEmployees(),
            getBlanks()
        ]);

        const batchData = results[0].status === 'fulfilled' ? results[0].value : [];
        const orgData = results[1].status === 'fulfilled' ? results[1].value : [];
        const empData = results[2].status === 'fulfilled' ? results[2].value : [];
        const blankData = results[3].status === 'fulfilled' ? results[3].value : [];

        // Log each result for debugging
        console.log('📋 [BlankManagement] fetchData results:', {
            batches: batchData?.length,
            orgs: orgData?.length,
            employees: empData?.length,
            blanks: blankData?.length,
            batchError: results[0].status === 'rejected' ? (results[0] as PromiseRejectedResult).reason?.message : null,
            orgError: results[1].status === 'rejected' ? (results[1] as PromiseRejectedResult).reason?.message : null,
            empError: results[2].status === 'rejected' ? (results[2] as PromiseRejectedResult).reason?.message : null,
            blankError: results[3].status === 'rejected' ? (results[3] as PromiseRejectedResult).reason?.message : null,
        });

        // Log full employee data to debug filtering
        if (empData.length > 0) {
            console.log('📋 [BlankManagement] Raw employees:', empData.map(e => ({ id: e.id, name: e.shortName, type: e.employeeType })));
        }

        setBatches(batchData.sort((a, b) => b.series.localeCompare(a.series) || b.startNumber - a.startNumber));
        setOrganizations(orgData);
        // Filter for drivers - be case-insensitive and accept null/undefined as default driver
        // Also log all employee types for debugging
        const allTypes = new Set(empData.map(e => e.employeeType));
        console.log('📋 [BlankManagement] All employee types:', [...allTypes]);
        const drivers = empData.filter(e =>
            !e.employeeType || // null/undefined - treat as driver (default)
            e.employeeType.toLowerCase() === 'driver' ||
            e.employeeType.toLowerCase() === 'водитель'
        );
        console.log('📋 [BlankManagement] Filtered drivers:', drivers.length, drivers.map(d => d.shortName));
        setEmployees(drivers);
        setAllBlanks(blankData);
    }, []);

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
            // Сузим тип от RHF через Zod (гарантия обязательных полей)
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
        if (!currentUser) {
            showToast('Не удалось определить пользователя.', 'error');
            return;
        }
        try {
            const params = {
                batchId: issueModalBatch.id,
                ownerEmployeeId: driverToIssue,
                ranges: [{ from: issueRange.start, to: issueRange.end }]
            };
            const ctx = {
                actorId: currentUser.id,
                deviceId: 'webapp-issue'
            };
            await issueBlanksToDriver(params, ctx);
            showToast('Бланки выданы водителю', 'success');
            setIssueModalBatch(null);
            setDriverToIssue('');
            fetchData();
            refreshBlanks();
        } catch (e) { showToast((e as Error).message, 'error'); }
    };


    return (
        <div>
            <button onClick={handleAddNew} className="flex items-center gap-2 bg-blue-600 text-white font-semibold py-2 px-4 rounded-lg shadow-md mb-4"><PlusIcon className="h-5 w-5" /> Добавить пачку</button>
            <div className="overflow-x-auto">
                <table className="w-full text-sm">
                    <thead className="text-xs text-gray-700 uppercase bg-gray-50 dark:bg-gray-700 dark:text-gray-400">
                        <tr className="text-left">{['Организация', 'Серия', 'Диапазон номеров', 'Выдано/Всего', 'Статус', 'Действия'].map(h => <th key={h} className="p-2">{h}</th>)}</tr>
                    </thead>
                    <tbody>
                        {enrichedBatches.map(b => (
                            <tr key={b.id} className="border-t dark:border-gray-700">
                                <td>{organizations.find(o => o.id === b.organizationId)?.shortName}</td>
                                <td>{b.series}</td>
                                <td>{String(b.startNumber).padStart(6, '0')} - {String(b.endNumber).padStart(6, '0')}</td>
                                <td>{b.issuedCount} / {b.totalCount}</td>
                                <td>{b.status}</td>
                                <td className="space-x-2 whitespace-nowrap">
                                    <button onClick={() => handleMaterialize(b.id)} disabled={b.isMaterialized} className="text-blue-600 disabled:text-gray-400 disabled:cursor-not-allowed">Материализовать</button>
                                    <button onClick={() => openIssueModal(b)} disabled={!b.isMaterialized} className="text-green-600 disabled:text-gray-400 disabled:cursor-not-allowed">Выдать</button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <Modal isOpen={!!currentBatch} onClose={handleCancel} isDirty={isDirty} title="Новая пачка бланков" footer={<><button onClick={handleCancel}>Отмена</button><button onClick={handleSubmit(onSubmit)}>Создать</button></>}>
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                    <FormField label="Организация" error={errors.organizationId?.message}><FormSelect {...register("organizationId")}><option value="">-</option>{organizations.map(o => <option key={o.id} value={o.id}>{o.shortName}</option>)}</FormSelect></FormField>
                    <div className="grid grid-cols-3 gap-4">
                        <FormField label="Серия" error={errors.series?.message}><FormInput {...register("series")} /></FormField>
                        <FormField label="Начальный №" error={errors.startNumber?.message}><FormInput type="number" {...register("startNumber", { valueAsNumber: true })} /></FormField>
                        <FormField label="Конечный №" error={errors.endNumber?.message}><FormInput type="number" {...register("endNumber", { valueAsNumber: true })} /></FormField>
                    </div>
                </form>
            </Modal>

            <Modal isOpen={!!issueModalBatch} onClose={() => setIssueModalBatch(null)} title={`Выдать пачку ${issueModalBatch?.series}`} footer={<><button onClick={() => setIssueModalBatch(null)}>Отмена</button><button onClick={handleIssue}>Выдать</button></>}>
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
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [spoilModalData, setSpoilModalData] = useState<{ blank: { id: string, organizationId: string, series: string, number: number }, reason: string } | null>(null);
    const { showToast } = useToast();
    const { currentUser, can, rolePolicies } = useAuth();
    const [pagination, setPagination] = useState({ page: 1, pageSize: 50, total: 0 });
    const [isSpoilModalOpen, setIsSpoilModalOpen] = useState(false);

    const [selection, setSelection] = useState<SelectionState>({ mode: 'none', selectedIds: new Set(), excludedIds: new Set() });

    const fetchData = useCallback(async (filters: Record<string, string>, page: number, pageSize: number) => {
        const query = {
            series: filters.series || undefined,
            number: filters.number ? parseInt(filters.number, 10) : undefined,
            status: filters.status ? [filters.status as BlankStatus] : undefined,
            ownerEmployeeId: filters.ownerName ? employees.find(e => e.shortName.toLowerCase().includes(filters.ownerName!.toLowerCase()))?.id : undefined,
        };
        const { items, total } = await searchBlanks({ ...query, page, pageSize });
        setBlanks(items);
        setPagination(p => ({ ...p, total }));
    }, [employees]);

    useEffect(() => { getEmployees().then(setEmployees); }, []);

    const employeeMap = useMemo(() => new Map(employees.map(e => [e.id, e.shortName])), [employees]);

    const enrichedBlanks = useMemo(() => blanks.map(b => ({
        ...b,
        number: String(b.number).padStart(6, '0'),
        // Use ownerName from backend if available, otherwise fallback to employeeMap lookup
        ownerName: (b as any).ownerName || (b.ownerEmployeeId ? employeeMap.get(b.ownerEmployeeId) : '') || '-'
    })), [blanks, employeeMap]);

    type EnrichedBlank = (typeof enrichedBlanks)[0];

    const columns: { key: keyof EnrichedBlank; label: string }[] = useMemo(() => [
        { key: 'series', label: 'Серия' },
        { key: 'number', label: 'Номер' },
        { key: 'status', label: 'Статус' },
        { key: 'ownerName', label: 'Владелец' },
        { key: 'usedInWaybillId', label: 'ПЛ' },
    ], []);

    const { filters, handleFilterChange } = useTable(enrichedBlanks, columns as any);

    useEffect(() => {
        fetchData(filters, pagination.page, pagination.pageSize);
    }, [fetchData, filters, pagination.page, pagination.pageSize]);

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
            const actorEmployee = employees.find(e => e.email === currentUser.email);

            const ctx = {
                abilities: allAbilities,
                actorId: currentUser.id,
                actorEmployeeId: actorEmployee?.id ?? null,
                deviceId: 'webapp-spoil'
            };
            await spoilBlank(params, ctx);
            showToast('Бланк списан.', 'success');
            setSpoilModalData(null);
            fetchData(filters, pagination.page, pagination.pageSize);
        } catch (e) { showToast((e as Error).message, 'error'); }
    };

    const canBeSpoiled = (status: BlankStatus) => status === 'available' || status === 'issued';
    const isSpoilAllowed = can('blanks.spoil.self') || can('blanks.spoil.warehouse') || can('blanks.spoil.override');

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
        if (!selection.filterSnapshot) return;
        const M = await countBlanksByFilter(selection.filterSnapshot);
        const K = Math.min(M, 2000);
        setSelection({
            mode: 'filter',
            filterSnapshot: selection.filterSnapshot,
            excludedIds: new Set(),
            totalByFilter: M,
            cappedCount: K,
            selectedIds: new Set(),
        });
    };

    const selectionCount = useMemo(() => {
        if (selection.mode === 'page') return selection.selectedIds.size;
        if (selection.mode === 'filter') return (selection.cappedCount || 0) - selection.excludedIds.size;
        return 0;
    }, [selection]);

    const isAllOnPageSelected = useMemo(() => {
        return enrichedBlanks.length > 0 && enrichedBlanks.every(b => selection.selectedIds.has(b.id));
    }, [enrichedBlanks, selection.selectedIds]);

    const onBulkSpoilDone = () => {
        fetchData(filters, pagination.page, pagination.pageSize);
        setSelection({ mode: 'none', selectedIds: new Set(), excludedIds: new Set() });
    }

    return (
        <div>
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-4 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg items-center">
                <FormInput placeholder="Серия" value={filters.series || ''} onChange={e => handleFilterChange('series', e.target.value)} />
                <FormInput placeholder="Номер" value={filters.number || ''} onChange={e => handleFilterChange('number', e.target.value)} />
                <FormSelect value={filters.status || ''} onChange={e => handleFilterChange('status', e.target.value)}>
                    <option value="">Все статусы</option>
                    {(Object.keys(BLANK_STATUS_TRANSLATIONS) as BlankStatus[]).map(s => <option key={s} value={s}>{BLANK_STATUS_TRANSLATIONS[s]}</option>)}
                </FormSelect>
                <FormSelect value={filters.ownerName || ''} onChange={e => handleFilterChange('ownerName', e.target.value)}>
                    <option value="">Все владельцы</option>
                    {employees.map(e => <option key={e.id} value={e.shortName}>{e.shortName}</option>)}
                </FormSelect>
                <FormInput placeholder="Номер ПЛ" value={filters.usedInWaybillId || ''} onChange={e => handleFilterChange('usedInWaybillId', e.target.value)} />
                <div className="md:col-span-5 flex justify-end">
                    <button disabled={selection.mode === 'none' || !isSpoilAllowed} onClick={() => setIsSpoilModalOpen(true)} className="bg-yellow-600 text-white font-semibold py-2 px-4 rounded-lg shadow-md hover:bg-yellow-700 disabled:opacity-50 disabled:cursor-not-allowed">Списать выбранные ({selectionCount})</button>
                </div>
            </div>

            {selection.mode === 'page' && selection.selectedIds.size > 0 && (
                <div className="p-2 mb-4 bg-blue-100 text-blue-800 rounded-md text-sm text-center">
                    Выбрано {selection.selectedIds.size} на странице. <button onClick={onSelectAllByFilter} className="font-semibold underline hover:text-blue-600">Выбрать все по фильтру?</button>
                </div>
            )}
            {selection.mode === 'filter' && (
                <div className="p-2 mb-4 bg-blue-100 text-blue-800 rounded-md text-sm text-center">
                    Выбрано {selectionCount} по фильтру. {selection.totalByFilter && selection.totalByFilter > 2000 && <span className="font-bold text-orange-600">Применен лимит в 2000 записей.</span>}
                    <button onClick={() => setSelection({ mode: 'none', selectedIds: new Set(), excludedIds: new Set() })} className="ml-4 font-semibold underline hover:text-blue-600">Сбросить выбор</button>
                </div>
            )}

            <div className="overflow-x-auto">
                <table className="w-full text-sm">
                    <thead className="text-xs text-gray-700 uppercase bg-gray-50 dark:bg-gray-700 dark:text-gray-400">
                        <tr>
                            <th className="p-2 w-4"><input type="checkbox" onChange={e => onSelectPage(e.target.checked)} checked={isAllOnPageSelected} /></th>
                            {columns.map(col => (<th key={col.key as string} className="p-2 cursor-pointer" onClick={() => { }}>{col.label}</th>))}
                            <th className="p-2">Действия</th>
                        </tr>
                    </thead>
                    <tbody>
                        {enrichedBlanks.map(b => (
                            <tr key={b.id} className="border-t dark:border-gray-700">
                                <td className="p-2"><input type="checkbox" checked={selection.mode === 'filter' ? !selection.excludedIds.has(b.id) : selection.selectedIds.has(b.id)} onChange={e => onToggleRow(b.id, e.target.checked)} /></td>
                                <td>{b.series}</td>
                                <td>{b.number}</td>
                                <td><span className={`px-2 py-1 text-xs font-semibold rounded-full ${BLANK_STATUS_COLORS[b.status]}`}>{BLANK_STATUS_TRANSLATIONS[b.status]}</span></td>
                                <td>{b.ownerName}</td>
                                <td>{b.usedInWaybillId || '-'}</td>
                                <td>
                                    {isSpoilAllowed && canBeSpoiled(b.status) && (
                                        <button onClick={() => setSpoilModalData({ blank: { id: b.id, series: b.series, number: parseInt(b.number, 10), organizationId: b.organizationId }, reason: '' })} className="p-1" title="Испортить/списать бланк">
                                            <TrashIcon className="h-5 w-5 text-yellow-600" />
                                        </button>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
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