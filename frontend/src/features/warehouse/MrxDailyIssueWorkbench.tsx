import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Check } from 'lucide-react';
import { mrxApi, type MrxWarehouseDaily, type MrxIssuePage, type MrxBatchSummary } from '../../api/mrxApi';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Select } from '../../components/ui/select';
import { Badge } from '../../components/ui/badge';
import { Num } from '../../components/ui/num';
import { IdentifierText } from '../../components/ui/identifier-text';
import { VietnameseDateInput } from '../../components/ui/vietnamese-date-input';
import { StateBoundary } from '../../components/workbench/StateBoundary';
import { WorkspaceHeader } from '../../components/workbench/WorkspaceHeader';
import { TelemetrySubbar } from '../../components/workbench/TelemetrySubbar';
import { DataGrid, type ColumnDef } from '../../components/workbench/DataGrid';
import { todayInBusinessTimezone, toVietnameseDate } from '../../utils/dates';
import { MrxSupplementalIssueModal } from './MrxSupplementalIssueModal';
import { ReconciliationIssueDetailModal } from '../../components/workbench/ReconciliationIssueDetailModal';

interface MrxDailyIssueWorkbenchProps {
  batchId?: string;
  serviceDate?: string;
}

export function MrxDailyIssueWorkbench({
  batchId: propBatchId = '',
  serviceDate: propServiceDate = '',
}: MrxDailyIssueWorkbenchProps) {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [batches, setBatches] = useState<MrxBatchSummary[]>([]);
  const [activeBatchId, setActiveBatchId] = useState(() => propBatchId || searchParams.get('batchId') || '');
  const [activeDate, setActiveDate] = useState(() => propServiceDate || searchParams.get('date') || todayInBusinessTimezone());
  const [daily, setDaily] = useState<MrxWarehouseDaily | null>(null);
  const [history, setHistory] = useState<MrxIssuePage | null>(null);
  const [quantities, setQuantities] = useState<Record<string, string>>({});
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [error, setError] = useState<Error | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Supplemental issue state (RULE-MRX-03)
  const [isSupplementalOpen, setIsSupplementalOpen] = useState(false);
  const [suppMaterialId, setSuppMaterialId] = useState('');
  const [suppQuantity, setSuppQuantity] = useState('');
  const [suppReason, setSuppReason] = useState('');
  const [isSubmittingSupp, setIsSubmittingSupp] = useState(false);
  const [suppError, setSuppError] = useState<string | null>(null);
  const [inspectedIssueId, setInspectedIssueId] = useState<string | null>(null);

  // Load available batches for selector
  useEffect(() => {
    let ignore = false;
    mrxApi.getBatchPage({ pageSize: 50 })
      .then((page) => {
        if (ignore) return;
        const items = page?.items ?? [];
        setBatches(items);
        if (items.length > 0) {
          const urlBatch = propBatchId || searchParams.get('batchId');
          const matchedBatch = urlBatch && items.find((b) => b.batchId === urlBatch);
          if (matchedBatch) {
            setActiveBatchId(matchedBatch.batchId);
          } else if (!activeBatchId) {
            const preferred = items.find((b) => b.status === 'TRANSFERRED' || b.status === 'IN_PROGRESS') || items[0];
            setActiveBatchId(preferred.batchId);
            setSearchParams((curr) => {
              const next = new URLSearchParams(curr);
              next.set('batchId', preferred.batchId);
              return next;
            }, { replace: true });
          }
        }
      })
      .catch(() => {});
    return () => { ignore = true; };
  }, [activeBatchId, propBatchId, searchParams, setSearchParams]);

  const load = useCallback(async (targetBatchId = activeBatchId, targetDate = activeDate) => {
    if (!targetBatchId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [nextDaily, nextHistory] = await Promise.all([
        mrxApi.getWarehouseDaily(targetBatchId),
        mrxApi.getIssues(targetBatchId),
      ]);
      setDaily(nextDaily);
      setHistory(nextHistory);
      const selected = nextDaily.dates.find((d) => d.serviceDate === targetDate);
      setQuantities((current) => Object.keys(current).length > 0 ? current : Object.fromEntries(
        (selected?.lines ?? []).map((l) => [l.dailyLineId, String(l.requiredQuantity)]),
      ));
    } catch (cause) {
      setError(cause instanceof Error ? cause : new Error('Không thể tải định lượng xuất kho theo ngày.'));
    } finally {
      setLoading(false);
    }
  }, [activeBatchId, activeDate]);

  useEffect(() => {
    if (activeBatchId) {
      const request = window.setTimeout(() => { void load(activeBatchId, activeDate); }, 0);
      return () => window.clearTimeout(request);
    }
  }, [activeBatchId, activeDate, load]);

  const day = daily?.dates.find((item) => item.serviceDate === activeDate);
  const lines = useMemo(() => day?.lines.filter((l) => l.requiredQuantity > 0) ?? [], [day]);
  const hasInitialIssue = lines.some((l) => (l.issuedQuantity ?? 0) > 0);
  const isWeeklyAll = activeDate === 'ALL';

  const weeklyAggregateLines = useMemo(() => {
    if (!daily?.dates) return [];
    const map = new Map<string, {
      id: string;
      ingredientCode: string;
      ingredientName: string;
      unitName: string;
      requiredQuantity: number;
      issuedQuantity: number;
      remainingQuantity: number;
    }>();

    for (const d of daily.dates) {
      for (const l of d.lines) {
        const key = l.ingredientCode || l.ingredientId;
        const existing = map.get(key);
        if (existing) {
          existing.requiredQuantity += l.requiredQuantity;
          existing.issuedQuantity += (l.issuedQuantity ?? 0);
          existing.remainingQuantity += (l.remainingQuantity ?? 0);
        } else {
          map.set(key, {
            id: key,
            ingredientCode: l.ingredientCode || l.ingredientId || '',
            ingredientName: l.ingredientName || '—',
            unitName: l.canonicalUnitName || 'kg',
            requiredQuantity: l.requiredQuantity,
            issuedQuantity: l.issuedQuantity ?? 0,
            remainingQuantity: l.remainingQuantity ?? 0,
          });
        }
      }
    }
    return Array.from(map.values()).sort((a, b) => b.requiredQuantity - a.requiredQuantity);
  }, [daily]);

  const weeklyColumns = useMemo<ColumnDef<typeof weeklyAggregateLines[number]>[]>(() => [
    {
      id: 'ingredient',
      header: 'Nguyên liệu thực phẩm',
      width: '32%',
      cell: (line) => (
        <div className="flex items-center gap-2 truncate">
          <span className="font-semibold text-slate-900 text-sm truncate">{line.ingredientName}</span>
          {line.ingredientCode && <IdentifierText value={line.ingredientCode} />}
        </div>
      ),
    },
    {
      id: 'unit',
      header: 'ĐVT',
      width: '12%',
      align: 'center',
      cell: (line) => <span className="font-mono text-xs text-slate-700">{line.unitName}</span>,
    },
    {
      id: 'required',
      header: 'Tổng nhu cầu tuần',
      width: '18%',
      align: 'right',
      cell: (line) => <Num value={line.requiredQuantity} format="quantity" suffix={` ${line.unitName}`} className="font-bold text-slate-900 text-sm" />,
    },
    {
      id: 'issued',
      header: 'Tổng đã xuất thực tế',
      width: '18%',
      align: 'right',
      cell: (line) => <Num value={line.issuedQuantity} format="quantity" suffix={` ${line.unitName}`} className="font-mono text-sm" />,
    },
    {
      id: 'remaining',
      header: 'Còn lại phải xuất',
      width: '20%',
      align: 'right',
      cell: (line) => (
        <Num
          value={line.remainingQuantity}
          format="quantity"
          suffix={` ${line.unitName}`}
          className={line.remainingQuantity > 0 ? 'text-amber-700 font-bold font-mono text-sm' : 'text-slate-600 font-mono text-sm'}
        />
      ),
    },
  ], []);

  const handleFillAll = () => {
    setQuantities(Object.fromEntries(lines.map((l) => [l.dailyLineId, String(l.requiredQuantity)])));
  };

  const canSubmit = Boolean(day?.isApplicable && lines.length > 0 && !hasInitialIssue && !saving && !isWeeklyAll &&
    lines.every((l) => {
      const issued = Number(quantities[l.dailyLineId]);
      return issued > 0 && (issued <= l.requiredQuantity || reasons[l.dailyLineId]?.trim());
    }));

  const submit = async () => {
    if (!daily || !day || !canSubmit || !activeBatchId) return;
    setSaving(true);
    setError(null);
    try {
      await mrxApi.createIssue({
        commandId: crypto.randomUUID(),
        expectedVersion: daily.sourceVersion,
        issueDate: activeDate,
        reconciliationBatchId: activeBatchId,
        isSupplemental: false,
        lines: lines.map((l) => ({
          reconciliationBatchLineId: l.batchLineId, reconciliationBatchDailyLineId: l.dailyLineId,
          ingredientId: l.ingredientId, unitId: l.canonicalUnitId,
          requestedQty: l.requiredQuantity, issuedQty: Number(quantities[l.dailyLineId]),
          varianceReason: reasons[l.dailyLineId]?.trim() || undefined,
        })),
      });
      setQuantities({});
      await load(activeBatchId, activeDate);
    } catch (cause) {
      setError(cause instanceof Error ? cause : new Error('Không thể xác nhận xuất kho.'));
    } finally {
      setSaving(false);
    }
  };

  const handleSupplementalSubmit = async () => {
    if (!daily || !activeBatchId || !suppMaterialId || Number(suppQuantity) <= 0 || !suppReason.trim()) return;
    const targetLine = lines.find((l) => l.dailyLineId === suppMaterialId);
    if (!targetLine) return;
    setIsSubmittingSupp(true);
    setSuppError(null);
    try {
      await mrxApi.createIssue({
        commandId: crypto.randomUUID(),
        expectedVersion: daily.sourceVersion,
        issueDate: activeDate,
        reconciliationBatchId: activeBatchId,
        isSupplemental: true,
        lines: [{
          reconciliationBatchLineId: targetLine.batchLineId, reconciliationBatchDailyLineId: targetLine.dailyLineId,
          ingredientId: targetLine.ingredientId, unitId: targetLine.canonicalUnitId,
          requestedQty: Number(suppQuantity), issuedQty: Number(suppQuantity),
          varianceReason: suppReason.trim(),
        }],
      });
      setIsSupplementalOpen(false);
      setSuppQuantity('');
      setSuppReason('');
      await load(activeBatchId, activeDate);
    } catch (cause) {
      setSuppError(cause instanceof Error ? cause.message : 'Không thể thực hiện xuất bổ sung.');
    } finally {
      setIsSubmittingSupp(false);
    }
  };

  const batchOptions = batches.map((b) => ({
    value: b.batchId,
    label: `${b.customerCode || b.customerName || 'Lô'} · ${b.status} · ${b.batchId.slice(0, 8)}`,
  }));

  const columns = useMemo<ColumnDef<typeof lines[number]>[]>(() => [
    {
      id: 'ingredient',
      header: 'Nguyên liệu thực phẩm',
      width: '28%',
      cell: (line) => (
        <div className="flex items-center gap-2 truncate">
          <span className="font-semibold text-slate-900 text-sm truncate">{line.ingredientName}</span>
          {line.ingredientCode && <IdentifierText value={line.ingredientCode} />}
        </div>
      ),
    },
    {
      id: 'required',
      header: 'Nhu cầu ca',
      width: '16%',
      align: 'right',
      cell: (line) => (
        <Num value={line.requiredQuantity} format="quantity" suffix={line.canonicalUnitName ? ` ${line.canonicalUnitName}` : ''} />
      ),
    },
    {
      id: 'issued',
      header: 'Thực xuất cửa kho',
      width: '20%',
      cell: (line) => (
        <Input
          type="number"
          min="0.000001"
          step="any"
          aria-label={`Số lượng thực xuất ${line.ingredientName ?? line.ingredientCode ?? line.ingredientId}`}
          value={quantities[line.dailyLineId] ?? ''}
          disabled={hasInitialIssue}
          onChange={(e) => setQuantities((current) => ({ ...current, [line.dailyLineId]: e.target.value }))}
          className="h-8 font-mono text-sm"
        />
      ),
    },
    {
      id: 'reason',
      header: 'Lý do chênh lệch (nếu vượt)',
      width: '24%',
      cell: (line) => {
        const issued = Number(quantities[line.dailyLineId]);
        const isOver = issued > line.requiredQuantity;
        return (
          <Input
            aria-label={`Lý do chênh lệch ${line.ingredientName ?? line.ingredientCode ?? line.ingredientId}`}
            placeholder={isOver ? 'Bắt buộc nhập lý do xuất vượt...' : 'Ghi chú (nếu có)...'}
            value={reasons[line.dailyLineId] ?? ''}
            disabled={hasInitialIssue}
            onChange={(e) => setReasons((current) => ({ ...current, [line.dailyLineId]: e.target.value }))}
            className={`h-8 text-xs ${isOver && !reasons[line.dailyLineId]?.trim() ? 'border-amber-400 bg-amber-50/40' : ''}`}
          />
        );
      },
    },
    {
      id: 'status',
      header: 'Trạng thái nghiệp vụ',
      width: '14%',
      align: 'center',
      cell: (line) => {
        if (hasInitialIssue) {
          const issued = line.issuedQuantity ?? 0, req = line.requiredQuantity;
          if (issued === req) return <Badge variant="success" size="sm">Đã xuất đủ</Badge>;
          return <Badge variant={issued < req ? 'warning' : 'info'} size="sm">{issued < req ? 'Đã xuất thiếu' : 'Đã xuất vượt'}</Badge>;
        }
        const val = quantities[line.dailyLineId];
        if (val === undefined || val === '') return <Badge variant="neutral" size="sm">Chưa nhập</Badge>;
        const numVal = Number(val), req = line.requiredQuantity;
        if (numVal === req) return <Badge variant="success" size="sm">Dự kiến xuất đủ</Badge>;
        return <Badge variant={numVal < req ? 'warning' : 'info'} size="sm">{numVal < req ? 'Dự kiến xuất thiếu' : 'Dự kiến xuất vượt'}</Badge>;
      },
    },
  ], [hasInitialIssue, quantities, reasons]);

  return (
    <div className="flex-1 min-h-0 flex flex-col h-full bg-white select-text">
      <WorkspaceHeader
        title="Xuất kho nguyên liệu theo ngày"
        breadcrumb="Đối soát MRX · Trạm Kho nguyên liệu"
        contextSelectors={
          <>
            {batches.length > 0 && (
              <Select
                aria-label="Chọn lô đối soát xuất kho"
                options={batchOptions}
                value={activeBatchId}
                onChange={(e) => {
                  const newId = e.target.value;
                  setActiveBatchId(newId);
                  setSearchParams((curr) => {
                    const next = new URLSearchParams(curr);
                    next.set('batchId', newId);
                    return next;
                  }, { replace: true });
                }}
                className="h-9 w-72 font-medium text-sm"
              />
            )}
            <VietnameseDateInput
              aria-label="Ngày xuất kho"
              value={activeDate}
              onChange={(newDate) => {
                setActiveDate(newDate);
                setSearchParams((curr) => {
                  const next = new URLSearchParams(curr);
                  next.set('date', newDate);
                  return next;
                }, { replace: true });
              }}
              className="h-9 w-40 font-mono text-sm"
            />
          </>
        }
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="default"
              onClick={() => navigate(`/warehouse?view=mrx-preparation&date=${activeDate}`)}
            >
              Chuẩn bị phối hợp
            </Button>
            {isWeeklyAll ? (
              <Badge variant="neutral" size="default" className="h-9 px-3 text-xs flex items-center">
                Xem tổng hợp tuần (Chỉ đọc)
              </Badge>
            ) : hasInitialIssue ? (
              <Button
                variant="default"
                size="default"
                onClick={() => {
                  setSuppMaterialId(lines[0]?.dailyLineId || '');
                  setSuppQuantity('');
                  setSuppReason('');
                  setSuppError(null);
                  setIsSupplementalOpen(true);
                }}
              >
                Xuất bổ sung ca
              </Button>
            ) : (
              <>
                <Button
                  variant="outline"
                  size="default"
                  onClick={handleFillAll}
                  disabled={lines.length === 0}
                >
                  Điền đủ toàn bộ
                </Button>
                <Button
                  variant="default"
                  size="default"
                  onClick={() => void submit()}
                  disabled={!canSubmit}
                >
                  {saving ? 'Đang ghi…' : 'Xác nhận xuất kho'}
                </Button>
              </>
            )}
          </div>
        }
      />

      <TelemetrySubbar
        leftControls={
          <div className="flex items-center gap-1 overflow-x-auto py-1">
            <span className="text-xs font-semibold text-slate-700 whitespace-nowrap mr-1">Lịch xuất ca:</span>
            <button
              type="button"
              onClick={() => {
                setActiveDate('ALL');
                setSearchParams((curr) => { const next = new URLSearchParams(curr); next.set('date', 'ALL'); return next; }, { replace: true });
              }}
              className={`text-xs px-2.5 py-1 rounded font-medium transition-colors cursor-pointer whitespace-nowrap ${
                isWeeklyAll
                  ? 'bg-slate-900 text-white font-bold shadow-2xs'
                  : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
              }`}
            >
              Cả tuần (Tổng hợp)
            </button>
            {daily?.dates.map((d) => (
              <button
                key={d.serviceDate}
                type="button"
                onClick={() => {
                  setActiveDate(d.serviceDate);
                  setSearchParams((curr) => { const next = new URLSearchParams(curr); next.set('date', d.serviceDate); return next; }, { replace: true });
                }}
                className={`text-xs px-2.5 py-1 rounded font-medium transition-colors cursor-pointer whitespace-nowrap ${
                  d.serviceDate === activeDate
                    ? 'bg-slate-900 text-white font-bold shadow-2xs'
                    : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
                }`}
              >
                {(() => {
                  try {
                    const dayNum = new Date(`${d.serviceDate}T00:00:00Z`).getUTCDay();
                    const names = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
                    return names[dayNum] || 'Ngày';
                  } catch {
                    return 'Ngày';
                  }
                })()} ({toVietnameseDate(d.serviceDate).slice(0, 5)})
                {d.lines.some((l) => (l.issuedQuantity ?? 0) > 0) && (
                  <Check className="size-3 text-emerald-600 inline ml-1" aria-hidden="true" />
                )}
              </button>
            ))}
          </div>
        }
        telemetryPills={
          isWeeklyAll ? (
            <div className="flex items-center gap-2 text-xs">
              <Badge variant="neutral" size="sm">Chế độ xem tổng hợp tuần (Chỉ đọc)</Badge>
              <span className="text-slate-500 hidden md:inline">· Chọn từng ngày (T2–T7) để xuất kho</span>
            </div>
          ) : (
            day ? (
              <div className="flex items-center gap-2 text-xs">
                <span className="text-slate-500">Mặt hàng:</span>
                <strong className="font-mono text-slate-900">{lines.length}</strong>
                <span className="text-slate-300">·</span>
                <Badge variant={hasInitialIssue ? 'success' : 'warning'} size="sm">
                  {hasInitialIssue ? 'Đã xuất kho' : 'Chưa xuất'}
                </Badge>
                <span className="text-slate-500 hidden lg:inline">· {hasInitialIssue ? 'Có thể xuất bổ sung trong ca' : 'Bấm "Điền đủ toàn bộ" nếu xuất đúng định mức'}</span>
              </div>
            ) : null
          )
        }
      />

      <StateBoundary
        isLoading={loading}
        isFetching={loading}
        hasExistingData={Boolean(day || (daily && daily.dates.some((d) => d.lines.length > 0)))}
        error={error}
        onRetry={() => void load()}
        isPartial={Boolean(daily && (!daily.compatibility.canRead || !daily.compatibility.canIssueByDate))}
        partialMessage={daily?.compatibility.reasonCode ?? undefined}
        isEmpty={!loading && !error && !day}
        emptyScenario="filter-empty"
        emptyTitle="Không có định lượng cho ngày đã chọn"
        emptyDescription="Kiểm tra lại ngày phục vụ hoặc chuyển sang màn hình Chuẩn bị phối hợp để xem toàn bộ các lô."
      >
        <div className="flex-1 min-h-0 flex flex-col h-full bg-white">
          {isWeeklyAll ? (
            <div className="flex-1 min-h-0 flex flex-col">
              <div className="p-3 bg-blue-50/60 border-b border-blue-200 text-blue-900 text-xs flex items-center justify-between shrink-0">
                <span>Bảng tổng hợp nhu cầu nguyên liệu cả tuần theo lô đã đóng băng. Chọn từng ngày cụ thể phía trên để xuất kho ca.</span>
                <span className="font-mono font-semibold">{weeklyAggregateLines.length} mặt hàng</span>
              </div>
              <DataGrid data={weeklyAggregateLines} columns={weeklyColumns} keyExtractor={(line) => line.id} emptyMessage="Chưa có dữ liệu tổng hợp nguyên liệu cả tuần." />
            </div>
          ) : (
            <>
              {hasInitialIssue && (
                <div role="status" className="px-4 py-2 text-xs font-medium border-b border-blue-200 bg-blue-50 text-blue-800 flex items-center justify-between shrink-0">
                  <span>Ngày này đã có phiếu xuất ban đầu. Có thể xuất bổ sung phát sinh hoặc theo dõi chênh lệch tại Hàng đợi thay đổi nguồn.</span>
                  <Button
                    variant="outline"
                    size="xs"
                    onClick={() => navigate('/warehouse?view=mrx-issues')}
                  >
                    Mở hàng đợi thay đổi nguồn
                  </Button>
                </div>
              )}

              <DataGrid data={lines} columns={columns} keyExtractor={(l) => l.dailyLineId} emptyMessage="Ngày này không có nguyên liệu nào cần xuất kho." />

              {history && history.items.length > 0 && (
                <section className="p-3 border-t border-slate-200 bg-slate-50/60 shrink-0" aria-label="Lịch sử phiếu xuất">
                  <h2 className="text-xs font-bold text-slate-700 mb-1">Phiếu xuất đã tạo cho lô:</h2>
                  <div className="flex flex-wrap gap-2 text-xs">
                    {history.items.map((issue) => (
                      <button
                        key={issue.issueId}
                        type="button"
                        onClick={() => setInspectedIssueId(issue.issueId)}
                        className="inline-flex items-center gap-1 bg-white border border-slate-200 rounded px-2 py-0.5 font-mono text-slate-800 hover:border-blue-400 hover:text-blue-700 cursor-pointer text-xs"
                        title="Bấm để xem chi tiết các dòng nguyên liệu trong phiếu xuất"
                      >
                        <IdentifierText value={issue.issueCode} /> · <span>{toVietnameseDate(issue.issueDate)}</span>
                      </button>
                    ))}
                  </div>
                </section>
              )}
            </>
          )}
        </div>
      </StateBoundary>

      <MrxSupplementalIssueModal
        isOpen={isSupplementalOpen}
        onClose={() => setIsSupplementalOpen(false)}
        activeBatchId={activeBatchId}
        activeDate={activeDate}
        lines={lines}
        suppMaterialId={suppMaterialId}
        onSuppMaterialIdChange={setSuppMaterialId}
        suppQuantity={suppQuantity}
        onSuppQuantityChange={setSuppQuantity}
        suppReason={suppReason}
        onSuppReasonChange={setSuppReason}
        suppError={suppError}
        isSubmittingSupp={isSubmittingSupp}
        onSubmit={() => void handleSupplementalSubmit()}
      />

      <ReconciliationIssueDetailModal
        isOpen={Boolean(inspectedIssueId)}
        onClose={() => setInspectedIssueId(null)}
        issueId={inspectedIssueId}
      />
    </div>
  );
}
