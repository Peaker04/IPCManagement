import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Boxes } from 'lucide-react';
import { type MrxMaterialInspection, type MrxPlanInspection } from '../../api/mrxApi';
import { WorkspaceHeader } from '../../components/workbench/WorkspaceHeader';
import { StateBoundary } from '../../components/workbench/StateBoundary';
import { DataGrid, type ColumnDef } from '../../components/workbench/DataGrid';
import { PaginationBar } from '../../components/workbench/PaginationBar';
import { SplitView } from '../../components/workbench/SplitView';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Select } from '../../components/ui/select';
import { VietnameseDateInput } from '../../components/ui/vietnamese-date-input';
import { IdentifierText } from '../../components/ui/identifier-text';
import { Num } from '../../components/ui/num';
import { InlineBanner } from '../../components/ui/inline-banner';
import { getMrxShiftLabel, getMrxDishSlotLabel } from '../../constants/mrxConstants';
import type { SkeletonGeometry } from '../../components/workbench/WorkbenchSkeleton';
import { isWeekStartDate, toVietnameseDate } from '../../utils/dates';
import { useMrxQuantityInspection } from './hooks/useMrxQuantityInspection';
import { MrxShiftDishesModal } from './MrxShiftDishesModal';
import type { PlanSummaryItem } from './mrxBatchPreviewTypes';

function materialKey(row: MrxMaterialInspection) { return `${row.ingredientId}:${row.canonicalUnitId}`; }

function MaterialsTable({ rows }: { rows: readonly MrxMaterialInspection[] }) {
  const [selectedKey, setSelectedKey] = useState('');
  const selected = rows.find(row => materialKey(row) === selectedKey);
  const columns: ColumnDef<MrxMaterialInspection>[] = [
    { id: 'name', header: 'Nguyên liệu', width: '55%', cell: row => <div><span className="whitespace-normal break-words">{row.ingredientName}</span><div><IdentifierText value={row.ingredientCode} /></div></div> },
    { id: 'unit', header: 'ĐVT', width: '15%', cell: row => row.canonicalUnitName || 'Chưa rõ đơn vị' },
    { id: 'required', header: 'Lượng cần', width: '30%', align: 'right', cell: row => <Num value={row.requiredQuantity} format="plain" decimals={6} /> },
  ];
  type Contribution = MrxMaterialInspection['contributions'][number];
  const details: ColumnDef<Contribution>[] = [
    { id: 'date', header: 'Ngày / ca', width: '140px', cell: row => <>{toVietnameseDate(row.serviceDate)}<div className="text-xs">{getMrxShiftLabel(row.shift)}</div></> },
    { id: 'dish', header: 'Món', width: '200px', cell: row => <span className="whitespace-normal">{row.dishName}<span className="block text-xs text-slate-500">{getMrxDishSlotLabel(row.dishSlot)}</span></span> },
    { id: 'servings', header: 'Suất món', width: '120px', align: 'right', cell: row => <Num value={row.finalServings} /> },
    { id: 'rate', header: 'Định mức / suất', width: '170px', align: 'right', cell: row => <Num value={row.material.grossQuantityPerServing} format="rate" suffix={` ${row.material.sourceUnitName || 'Chưa rõ đơn vị'}`} /> },
    { id: 'quantity', header: 'Lượng cần', width: '160px', align: 'right', cell: row => <Num value={row.material.requiredQuantity} format="plain" decimals={6} suffix={` ${row.material.canonicalUnitName || 'Chưa rõ đơn vị'}`} /> },
  ];
  return <SplitView
    masterWidthClass="w-full lg:w-5/12"
    hasActiveDetail={Boolean(selected)} onBackToMaster={() => setSelectedKey('')}
    master={<DataGrid data={rows} columns={columns} keyExtractor={materialKey} onRowClick={row => setSelectedKey(materialKey(row))} selectedKey={selectedKey} minWidth="min-w-[400px]" emptyMessage="Không có nguyên liệu phù hợp" />}
    detail={<div className="flex-1 min-h-0 flex flex-col"><h2 className="h-10 px-4 py-2 text-sm font-semibold border-b border-slate-200 bg-slate-50 flex items-center shrink-0">{selected ? `Nguồn tính · ${selected.ingredientName}` : 'Nguồn tính chi tiết'}</h2>{selected ? <DataGrid data={selected.contributions} columns={details} keyExtractor={(row, index) => `${row.quantityPlanLineId}:${row.material.dishBomId}:${index}`} minWidth="min-w-[790px]" /> : <div className="flex-1 min-h-0 flex flex-col items-center justify-center p-8 text-center"><div aria-hidden="true" className="w-12 h-12 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center mb-3 text-slate-400"><Boxes size={22} strokeWidth={1.75} /></div><p className="text-sm text-slate-500">Chọn nguyên liệu để xem từng ngày, món và định mức nguồn.</p></div>}</div>}
  />;
}

function PlansTable({ rows }: { rows: readonly MrxPlanInspection[] }) {
  const [selected, setSelected] = useState<PlanSummaryItem | null>(null);
  const openPlan = (row: MrxPlanInspection) => setSelected({
    id: row.line.quantityPlanLineId, planCode: row.planCode, serviceDate: row.serviceDate,
    shift: getMrxShiftLabel(row.line.shift), menuName: row.line.menuName, servings: row.line.finalServings,
    dishes: row.line.dishes.map(dish => dish.dishName),
    dishesDetails: row.line.dishes.map(dish => ({ ...dish, materials: dish.materials.map(material => ({
      ...material, canonicalUnitName: material.canonicalUnitName || 'Chưa rõ đơn vị',
    })) })),
    materialsCount: row.line.dishes.reduce((sum, dish) => sum + dish.materials.length, 0),
  });
  const columns: ColumnDef<MrxPlanInspection>[] = [
    { id: 'date', header: 'Ngày phục vụ', width: '20%', cell: row => toVietnameseDate(row.serviceDate) },
    { id: 'shift', header: 'Ca', width: '12%', cell: row => getMrxShiftLabel(row.line.shift) },
    { id: 'plan', header: 'Kế hoạch / thực đơn', width: '42%', cell: row => <span className="whitespace-normal break-words">{row.line.menuName}</span> },
    { id: 'servings', header: 'Số suất ca', width: '14%', align: 'right', cell: row => <Num value={row.line.finalServings} suffix=" suất" /> },
    { id: 'dishes', header: 'Chi tiết', width: '12%', cell: row => <Button variant="outline" size="sm" aria-label={`Xem món ngày ${toVietnameseDate(row.serviceDate)} · ${getMrxShiftLabel(row.line.shift)}`} onClick={() => openPlan(row)}>Xem</Button> },
  ];
  return <><DataGrid data={rows} columns={columns} keyExtractor={row => row.line.quantityPlanLineId} minWidth="min-w-[680px]" emptyMessage="Không có kế hoạch theo ca phù hợp" />
    <MrxShiftDishesModal isOpen={Boolean(selected)} onClose={() => setSelected(null)} plan={selected} /></>;
}

export function MrxQuantityInspectionPage({ view }: { view: 'materials' | 'plans' }) {
  const loadingGeometry: SkeletonGeometry = view === 'materials'
    ? { kind: 'split', columns: 3, rows: 8, splitRatio: '40/60', toolbar: true }
    : { kind: 'table', columns: 5, rows: 8, toolbar: true };
  const [params, setParams] = useSearchParams();
  const customerId = params.get('customerId') ?? '';
  const weekStartDate = params.get('weekStartDate') ?? '';
  const pageNumber = Math.max(1, Math.trunc(Number(params.get('page')) || 1));
  const pageSize = Math.min(100, Math.max(1, Math.trunc(Number(params.get('pageSize')) || 50)));
  const searchKeyword = params.get('q') ?? '';
  const [searchDraft, setSearchDraft] = useState<{ base: string; value: string }>({ base: searchKeyword, value: searchKeyword });
  const searchInput = searchDraft.base === searchKeyword ? searchDraft.value : searchKeyword;
  const workspace = useMrxQuantityInspection({ customerId, weekStartDate, view, pageNumber, pageSize, searchKeyword });
  const [revisionNotice, setRevisionNotice] = useState(false);
  const fingerprint = useRef<{ scope: string; value: string } | null>(null);
  const result = workspace.result;
  const scopeKey = `${customerId}:${weekStartDate}`;
  const update = useCallback((values: Record<string, string>, replace = false) => setParams(current => {
    const next = new URLSearchParams(current);
    next.delete('action'); next.delete('batchId');
    next.set('page', '1');
    for (const [key, value] of Object.entries(values)) { if (value) next.set(key, value); else next.delete(key); }
    return next;
  }, { replace }), [setParams]);
  useEffect(() => {
    if (searchInput === searchKeyword) return;
    const timer = setTimeout(() => {
      update({ q: searchInput }, true);
    }, 250);
    return () => clearTimeout(timer);
  }, [searchInput, searchKeyword, update]);
  useEffect(() => {
    if (!result || workspace.stateProps.isPreviousData) return;
    const prev = fingerprint.current;
    const changed = prev !== null && prev.scope === scopeKey && prev.value !== result.data.contentFingerprint;
    if (prev !== null && prev.scope !== scopeKey) {
      setRevisionNotice(false);
    }
    fingerprint.current = { scope: scopeKey, value: result.data.contentFingerprint };
    if (changed) {
      setRevisionNotice(true);
      if (pageNumber !== 1) setParams(current => { const next = new URLSearchParams(current); next.set('page', '1'); return next; }, { replace: true });
    }
  }, [pageNumber, result, scopeKey, setParams, workspace.stateProps.isPreviousData]);
  const preparationParams = new URLSearchParams({ view: 'mrx-batch' });
  if (customerId) preparationParams.set('customerId', customerId);
  if (weekStartDate) preparationParams.set('weekStartDate', weekStartDate);
  const title = view === 'materials' ? 'Định lượng nguyên liệu' : 'Kế hoạch theo ca';
  return <div className="flex-1 min-h-0 flex flex-col bg-white">
    <WorkspaceHeader title={title} breadcrumb="Thực đơn tuần · MRX" responsive
      contextSelectors={<><div className="w-full sm:w-72 shrink-0"><Select aria-label="Chọn khách hàng MRX" value={customerId} onChange={event => update({ customerId: event.target.value })} options={[{ value: '', label: 'Chọn khách hàng' }, ...(workspace.customers.data ?? []).map(customer => ({ value: customer.customerId, label: `${customer.customerCode} - ${customer.customerName}` }))]} /></div>
        <VietnameseDateInput className="w-40" aria-label="Tuần MRX bắt đầu" value={weekStartDate} onChange={value => update({ weekStartDate: value })} isDateAllowed={isWeekStartDate} validationMessage="Ngày bắt đầu tuần phải là Thứ Hai." /></>}
      actions={<Button variant="outline" onClick={() => void workspace.refresh()} disabled={workspace.stateProps.isFetching}>Làm mới</Button>} />
    <div className="min-h-11 flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-1.5 border-b border-slate-200 bg-slate-50/80 text-xs shrink-0">
      <dl aria-label="Nguồn định lượng" className="flex flex-wrap items-center gap-x-4 gap-y-1">
        <div className="flex items-baseline gap-1"><dt className="text-slate-500">Nguồn:</dt><dd className="font-medium text-slate-900">{workspace.stateProps.isPreviousData ? 'Phạm vi trước · đang tải' : 'Hiện hành'}</dd></div>
        <div className="flex items-baseline gap-1"><dt className="text-slate-500">Tính chất:</dt><dd className="font-medium text-slate-900">Dự kiến</dd></div>
        <div className="flex items-baseline gap-1"><dt className="text-slate-500">Phiên bản:</dt><dd className="font-medium text-slate-900 min-w-[2ch] font-mono tabular-nums">{workspace.source ? <Num value={workspace.source.menuVersionNo} /> : '—'}</dd></div>
      </dl>
      <Link className="inline-flex h-8 items-center rounded border border-slate-300 px-3 font-medium text-slate-700 underline-offset-2 hover:bg-slate-50 hover:underline focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-400" to={`/weekly-menu?${preparationParams}`}>Chuẩn bị lô đối soát</Link>
      <Input aria-label={view === 'materials' ? 'Tìm nguyên liệu' : 'Tìm kế hoạch, thực đơn hoặc món'} placeholder={view === 'materials' ? 'Tìm tên, mã nguyên liệu…' : 'Tìm kế hoạch, thực đơn hoặc món…'} value={searchInput} onChange={event => setSearchDraft({ base: searchKeyword, value: event.target.value })} className="w-full sm:w-72 sm:ml-auto" />
    </div>
    {revisionNotice && <InlineBanner variant="info" title="Nguồn đã thay đổi. Danh sách được nạp lại từ phiên bản hiện hành." />}
    <StateBoundary {...workspace.stateProps} notFoundAsEmpty={false} loadingGeometry={loadingGeometry} error={workspace.customers.stateProps.error ?? workspace.stateProps.error}
      onRetry={() => void (workspace.customers.stateProps.error ? workspace.customers.refetch(true) : workspace.retry())}>
      {result && <div className="flex-1 min-h-0 flex flex-col">
        {result.view === 'materials' ? <MaterialsTable rows={result.data.page.items} /> : <PlansTable rows={result.data.page.items} />}
      </div>}
    </StateBoundary>
    <PaginationBar label={title} page={pageNumber} pageSize={pageSize} totalCount={result?.data.page.totalCount} totalPages={result?.data.page.totalPages}
      hasPrev={Boolean(result?.data.page.hasPrev)} hasNext={Boolean(result?.data.page.hasNext)} pending={workspace.stateProps.isLoading || workspace.stateProps.isFetching}
      onPageChange={page => update({ page: String(page) })} onPageSizeChange={size => update({ pageSize: String(size) })} />
  </div>;
}
