import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { mrxApi, type MrxWarehouseDaily, type MrxIssuePage, type MrxBatchSummary } from '../../api/mrxApi';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Select } from '../../components/ui/select';
import { Badge } from '../../components/ui/badge';
import { Num } from '../../components/ui/num';
import { IdentifierText } from '../../components/ui/identifier-text';
import { VietnameseDateInput } from '../../components/ui/vietnamese-date-input';
import { Modal } from '../../components/ui/modal';
import { StateBoundary } from '../../components/workbench/StateBoundary';
import { WorkspaceHeader } from '../../components/workbench/WorkspaceHeader';
import { TelemetrySubbar } from '../../components/workbench/TelemetrySubbar';
import { DataGrid, type ColumnDef } from '../../components/workbench/DataGrid';
import { todayInBusinessTimezone, toVietnameseDate } from '../../utils/dates';

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
  const canSubmit = Boolean(day?.isApplicable && lines.length > 0 && !hasInitialIssue && !saving &&
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
          reconciliationBatchLineId: l.batchLineId,
          reconciliationBatchDailyLineId: l.dailyLineId,
          ingredientId: l.ingredientId,
          unitId: l.canonicalUnitId,
          requestedQty: l.requiredQuantity,
          issuedQty: Number(quantities[l.dailyLineId]),
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
          reconciliationBatchLineId: targetLine.batchLineId,
          reconciliationBatchDailyLineId: targetLine.dailyLineId,
          ingredientId: targetLine.ingredientId,
          unitId: targetLine.canonicalUnitId,
          requestedQty: Number(suppQuantity),
          issuedQty: Number(suppQuantity),
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
      header: 'Trạng thái',
      width: '12%',
      align: 'center',
      cell: (line) => (
        <Badge variant={line.quantityStatus === 'EXACT' ? 'success' : line.quantityStatus === 'OVER_ISSUED' ? 'warning' : 'neutral'} size="sm">
          {line.quantityStatus === 'EXACT' ? 'Khớp' : line.quantityStatus === 'OVER_ISSUED' ? 'Xuất thừa' : line.quantityStatus === 'UNDER_ISSUED' ? 'Thiếu' : line.quantityStatus}
        </Badge>
      ),
    },
  ], [hasInitialIssue, quantities, reasons]);

  return (
    <div className="flex-1 min-h-0 flex flex-col h-full bg-white select-text">
      <WorkspaceHeader
        title="Xuất kho nguyên liệu theo ngày"
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
            {hasInitialIssue ? (
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
              <Button
                variant="default"
                size="default"
                onClick={() => void submit()}
                disabled={!canSubmit}
              >
                {saving ? 'Đang ghi…' : 'Xác nhận xuất kho'}
              </Button>
            )}
          </div>
        }
      />

      <TelemetrySubbar
        leftControls={
          <div className="flex items-center gap-2 overflow-x-auto">
            <span className="text-xs font-semibold text-slate-700 whitespace-nowrap">Tiến độ tuần:</span>
            {daily?.dates.map((d) => (
              <span
                key={d.serviceDate}
                className={`text-[11px] rounded px-2 py-0.5 border font-mono whitespace-nowrap ${
                  d.serviceDate === activeDate
                    ? 'bg-blue-100 text-blue-900 border-blue-300 font-bold'
                    : 'bg-slate-100 text-slate-700 border-slate-200'
                }`}
              >
                {toVietnameseDate(d.serviceDate)}: {d.status}
              </span>
            ))}
          </div>
        }
        telemetryPills={
          <>
            <span className="inline-flex items-center gap-1">
              <span className="text-slate-500">Số dòng ca:</span>
              <strong className="text-slate-900 font-mono">{lines.length}</strong>
            </span>
          </>
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

          <DataGrid data={lines} columns={columns} keyExtractor={(l) => l.dailyLineId} />

          {history && history.items.length > 0 && (
            <section className="p-3 border-t border-slate-200 bg-slate-50/60 shrink-0" aria-label="Lịch sử phiếu xuất">
              <h2 className="text-xs font-bold text-slate-700 mb-1">Phiếu xuất đã tạo cho lô:</h2>
              <div className="flex flex-wrap gap-2 text-xs">
                {history.items.map((issue) => (
                  <span key={issue.issueId} className="inline-flex items-center gap-1 bg-white border border-slate-200 rounded px-2 py-0.5 font-mono text-slate-800">
                    <IdentifierText value={issue.issueCode} /> · <span>{toVietnameseDate(issue.issueDate)}</span>
                  </span>
                ))}
              </div>
            </section>
          )}
        </div>
      </StateBoundary>

      {/* Supplemental Issue Modal (RULE-MRX-03) */}
      <Modal
        isOpen={isSupplementalOpen}
        onClose={() => { if (!isSubmittingSupp) setIsSupplementalOpen(false); }}
        title="Xuất kho bổ sung trong ca"
        description={`Lô: ${activeBatchId.slice(0, 8)} · Ngày phục vụ: ${toVietnameseDate(activeDate)}`}
        footer={
          <>
            <Button variant="outline" size="sm" disabled={isSubmittingSupp} onClick={() => setIsSupplementalOpen(false)}>
              Hủy bỏ
            </Button>
            <Button
              variant="default"
              size="sm"
              disabled={isSubmittingSupp || !suppMaterialId || Number(suppQuantity) <= 0 || !suppReason.trim()}
              onClick={() => void handleSupplementalSubmit()}
            >
              {isSubmittingSupp ? 'Đang xử lý...' : 'Xác nhận xuất bổ sung'}
            </Button>
          </>
        }
      >
        <div className="space-y-3 text-sm text-slate-700">
          {suppError && (
            <div role="alert" className="p-2.5 rounded bg-rose-50 text-rose-800 border border-rose-200 text-xs">
              {suppError}
            </div>
          )}
          <div>
            <label htmlFor="supp-ingredient" className="text-xs font-semibold text-slate-700 block mb-1">
              Chọn nguyên liệu bổ sung:
            </label>
            <select
              id="supp-ingredient"
              aria-label="Chọn nguyên liệu bổ sung"
              value={suppMaterialId}
              onChange={(e) => setSuppMaterialId(e.target.value)}
              className="w-full h-9 rounded border border-slate-300 bg-white px-3 text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-400"
            >
              {lines.map((l) => (
                <option key={l.dailyLineId} value={l.dailyLineId}>
                  {l.ingredientName} (Đã xuất: {l.issuedQuantity ?? 0} {l.canonicalUnitName})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="supp-qty" className="text-xs font-semibold text-slate-700 block mb-1">
              Số lượng xuất thêm ({lines.find((l) => l.dailyLineId === suppMaterialId)?.canonicalUnitName || 'đơn vị'}):
            </label>
            <Input
              id="supp-qty"
              aria-label="Số lượng xuất thêm"
              type="number"
              step="any"
              min="0.001"
              value={suppQuantity}
              onChange={(e) => setSuppQuantity(e.target.value)}
              placeholder="Nhập số lượng xuất bổ sung dương..."
              className="h-9 text-sm font-mono"
            />
          </div>

          <div>
            <label htmlFor="supp-reason" className="text-xs font-semibold text-slate-700 block mb-1">
              Lý do xuất bổ sung (bắt buộc):
            </label>
            <Input
              id="supp-reason"
              aria-label="Lý do xuất bổ sung"
              value={suppReason}
              onChange={(e) => setSuppReason(e.target.value)}
              placeholder="Nhập lý do xuất bổ sung..."
              className="h-9 text-sm"
            />
            <div className="mt-2 flex flex-wrap gap-1.5">
              {[
                'Phát sinh suất ăn đột xuất',
                'Bếp làm hỏng/cháy trong lúc chế biến',
                'Hao hụt rã đông cao hơn thực tế',
                'Bổ sung gia vị theo khẩu vị khách',
              ].map((preset) => (
                <Button
                  key={preset}
                  type="button"
                  variant="outline"
                  size="xs"
                  onClick={() => setSuppReason(preset)}
                >
                  {preset}
                </Button>
              ))}
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}
