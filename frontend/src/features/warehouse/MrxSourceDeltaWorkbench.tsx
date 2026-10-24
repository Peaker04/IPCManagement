import { useCallback, useEffect, useMemo, useState } from 'react';
import { mrxApi, type MrxSourceDelta } from '../../api/mrxApi';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Num } from '../../components/ui/num';
import { IdentifierText } from '../../components/ui/identifier-text';
import { Input } from '../../components/ui/input';
import { Modal } from '../../components/ui/modal';
import { StateBoundary } from '../../components/workbench/StateBoundary';
import { WorkspaceHeader } from '../../components/workbench/WorkspaceHeader';
import { TelemetrySubbar } from '../../components/workbench/TelemetrySubbar';
import { DataGrid, type ColumnDef } from '../../components/workbench/DataGrid';
import { toVietnameseDate } from '../../utils/dates';

export function MrxSourceDeltaWorkbench() {
  const [items, setItems] = useState<readonly MrxSourceDelta[]>([]);
  const [error, setError] = useState<Error | null>(null);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [selectedDelta, setSelectedDelta] = useState<MrxSourceDelta | null>(null);
  const [actualQuantity, setActualQuantity] = useState<string>('');
  const [varianceReason, setVarianceReason] = useState<string>('');
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    await Promise.resolve();
    setError(null);
    try {
      setItems((await mrxApi.getSourceDeltas()).items);
    } catch (cause) {
      setError(cause instanceof Error ? cause : new Error('Không thể tải hàng đợi thay đổi nguồn.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const request = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(request);
  }, [load]);

  const openProcessModal = (delta: MrxSourceDelta) => {
    setSelectedDelta(delta);
    setActualQuantity(String(Math.abs(delta.deltaQuantity)));
    setVarianceReason('');
  };

  const hasDiscrepancy = selectedDelta !== null && Number(actualQuantity) !== Math.abs(selectedDelta.deltaQuantity);
  const canConfirm = !hasDiscrepancy || varianceReason.trim().length > 0;

  const handleExecute = async (delta: MrxSourceDelta) => {
    setProcessingId(delta.sourceDeltaId);
    setError(null);
    const qty = Number(actualQuantity) || Math.abs(delta.deltaQuantity);
    const reasonText = varianceReason.trim();
    try {
      if (delta.workKind === 'SUPPLEMENTAL_ISSUE') {
        const daily = await mrxApi.getWarehouseDaily(delta.batchId);
        const line = daily.dates.flatMap((day) => day.lines).find((item) => item.dailyLineId === delta.dailyLineId);
        if (!line) throw new Error('Không tìm thấy dòng định lượng theo ngày của delta.');
        await mrxApi.createIssue({
          commandId: crypto.randomUUID(), expectedVersion: daily.sourceVersion,
          issueDate: delta.serviceDate, reconciliationBatchId: delta.batchId,
          reconciliationSourceDeltaId: delta.sourceDeltaId, expectedSourceDeltaVersion: delta.version,
          isSupplemental: true,
          lines: [{ reconciliationBatchLineId: line.batchLineId, reconciliationBatchDailyLineId: line.dailyLineId, ingredientId: delta.ingredientId, unitId: delta.canonicalUnitId, requestedQty: delta.deltaQuantity, issuedQty: qty, varianceReason: reasonText || 'Xuất bổ sung theo thay đổi nguồn đã duyệt' }],
        });
      } else {
        const issuePage = await mrxApi.getIssues(delta.batchId);
        const source = issuePage.items.flatMap((issue) => issue.lines.map((line) => ({ issue, line })))
          .find(({ line }) => line.reconciliationBatchDailyLineId === delta.dailyLineId && line.ingredientId === delta.ingredientId && line.unitId === delta.canonicalUnitId);
        if (!source) throw new Error('Chưa tìm thấy phiếu xuất gốc có lineage phù hợp để hoàn trả.');
        const created = await mrxApi.createReturn({
          commandId: crypto.randomUUID(), returnDate: delta.serviceDate, returnType: 'RETURN',
          issueId: source.issue.issueId, reconciliationSourceDeltaId: delta.sourceDeltaId,
          expectedSourceDeltaVersion: delta.version, reason: reasonText || 'Hoàn trả vật lý theo thay đổi nguồn đã duyệt',
          lines: [{ sourceIssueLineId: source.line.issueLineId, ingredientId: delta.ingredientId, unitId: delta.canonicalUnitId, quantity: qty }],
        });
        await mrxApi.confirmReturn(created.returnId, { commandId: crypto.randomUUID(), expectedVersion: 0, hasDiscrepancy, adjustedLines: [] });
      }
      setSelectedDelta(null);
      setSuccessMessage(`Đã xử lý thành công ${delta.workKind === 'SUPPLEMENTAL_ISSUE' ? 'xuất bổ sung' : 'hoàn trả vật lý'} cho ${delta.ingredientName || delta.ingredientCode || 'nguyên liệu'}.`);
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause : new Error('Không thể xử lý thay đổi nguồn.'));
    } finally {
      setProcessingId(null);
    }
  };

  const supplementalCount = useMemo(() => items.filter((d) => d.workKind === 'SUPPLEMENTAL_ISSUE').length, [items]);
  const returnCount = useMemo(() => items.filter((d) => d.workKind !== 'SUPPLEMENTAL_ISSUE').length, [items]);

  const columns = useMemo<ColumnDef<MrxSourceDelta>[]>(() => [
    {
      id: 'ingredient',
      header: 'Nguyên liệu',
      width: '32%',
      cell: (delta) => {
        const name = delta.ingredientName ?? delta.ingredientCode ?? delta.ingredientId;
        return (
          <div className="flex items-center gap-2 truncate">
            <span className="font-semibold text-slate-900 text-sm truncate">{name}</span>
            {delta.ingredientCode && <IdentifierText value={delta.ingredientCode} />}
          </div>
        );
      },
    },
    {
      id: 'date',
      header: 'Ngày',
      width: '16%',
      cell: (delta) => <span className="font-mono text-xs">{toVietnameseDate(delta.serviceDate)}</span>,
    },
    {
      id: 'delta',
      header: 'Chênh lệch',
      width: '18%',
      align: 'right',
      cell: (delta) => (
        <Num
          value={delta.deltaQuantity}
          format="quantity"
          prefix={delta.deltaQuantity > 0 ? '+' : ''}
          suffix={delta.canonicalUnitName ? ` ${delta.canonicalUnitName}` : ''}
          className={delta.deltaQuantity > 0 ? 'text-amber-700 font-semibold' : 'text-blue-700 font-semibold'}
        />
      ),
    },
    {
      id: 'workKind',
      header: 'Công việc',
      width: '18%',
      cell: (delta) => (
        <Badge variant={delta.workKind === 'SUPPLEMENTAL_ISSUE' ? 'warning' : 'info'} size="sm">
          {delta.workKind === 'SUPPLEMENTAL_ISSUE' ? 'Xuất bổ sung' : 'Hoàn trả vật lý'}
        </Badge>
      ),
    },
    {
      id: 'action',
      header: 'Thao tác',
      width: '16%',
      align: 'right',
      cell: (delta) => {
        const name = delta.ingredientName ?? delta.ingredientCode ?? delta.ingredientId;
        return (
          <Button
            size="sm"
            disabled={processingId !== null}
            onClick={() => openProcessModal(delta)}
            aria-label={`${delta.workKind === 'SUPPLEMENTAL_ISSUE' ? 'Xử lý xuất bổ sung' : 'Xử lý hoàn trả'} ${name}`}
          >
            {processingId === delta.sourceDeltaId ? 'Đang xử lý…' : 'Xử lý'}
          </Button>
        );
      },
    },
  ], [processingId]);

  return (
    <div className="flex-1 min-h-0 flex flex-col h-full bg-white select-text">
      <WorkspaceHeader
        title="Thay đổi nguồn chờ Kho xử lý"
        breadcrumb="Đối soát MRX · Trạm Kho nguyên liệu"
        actions={<Button variant="outline" size="sm" onClick={() => void load()}>Làm mới</Button>}
      />

      <TelemetrySubbar
        leftControls={
          <span className="text-xs font-semibold text-slate-700">Hàng đợi thay đổi nguồn cần kho xử lý</span>
        }
        telemetryPills={
          <>
            <span className="inline-flex items-center gap-1">
              <span className="text-slate-500">Xuất bổ sung:</span>
              <strong className="text-amber-700 font-mono">{supplementalCount}</strong>
            </span>
            <span className="text-slate-300">·</span>
            <span className="inline-flex items-center gap-1">
              <span className="text-slate-500">Hoàn trả:</span>
              <strong className="text-blue-700 font-mono">{returnCount}</strong>
            </span>
          </>
        }
      />

      {successMessage && (
        <div role="status" className="px-4 py-2 text-xs font-semibold border-b border-emerald-200 bg-emerald-50 text-emerald-800 flex items-center justify-between shrink-0">
          <span>{successMessage}</span>
          <button type="button" onClick={() => setSuccessMessage(null)} className="underline cursor-pointer">Đóng</button>
        </div>
      )}

      <StateBoundary
        isLoading={loading}
        error={error}
        onRetry={() => void load()}
        hasExistingData={items.length > 0}
        isEmpty={!loading && !error && items.length === 0}
        emptyTitle="Không có thay đổi nguồn đang chờ"
        emptyDescription="Các thay đổi đã xử lý vẫn được giữ trong lịch sử phiếu xuất, phiếu trả và stock movement."
      >
        <DataGrid data={items} columns={columns} keyExtractor={(delta) => delta.sourceDeltaId} />
      </StateBoundary>

      <Modal
        isOpen={Boolean(selectedDelta)}
        onClose={() => setSelectedDelta(null)}
        title="Xác nhận xử lý thay đổi nguồn"
        description={selectedDelta ? `${selectedDelta.workKind === 'SUPPLEMENTAL_ISSUE' ? 'Xuất bổ sung' : 'Hoàn trả vật lý'} cho ${selectedDelta.ingredientName ?? selectedDelta.ingredientCode ?? selectedDelta.ingredientId}` : ''}
        footer={
          <div className="flex items-center justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setSelectedDelta(null)}>Quay lại</Button>
            <Button
              size="sm"
              disabled={processingId !== null || !canConfirm || Number(actualQuantity) <= 0}
              onClick={() => {
                if (selectedDelta) void handleExecute(selectedDelta);
              }}
            >
              {processingId ? 'Đang xử lý...' : 'Xác nhận xử lý'}
            </Button>
          </div>
        }
      >
        {selectedDelta && (
          <div className="space-y-4 py-2">
            <div>
              <label htmlFor="actual-quantity-input" className="block text-xs font-semibold text-slate-700 mb-1">
                Số lượng thực tế ({selectedDelta.canonicalUnitName ?? 'ĐVT'})
              </label>
              <Input
                id="actual-quantity-input"
                type="number"
                step="any"
                aria-label="Số lượng thực tế"
                value={actualQuantity}
                onChange={(e) => setActualQuantity(e.target.value)}
              />
            </div>
            {hasDiscrepancy && (
              <div>
                <label htmlFor="variance-reason-input" className="block text-xs font-semibold text-slate-700 mb-1">
                  Lý do chênh lệch thực tế <span className="text-rose-600">*</span>
                </label>
                <Input
                  id="variance-reason-input"
                  type="text"
                  aria-label="Lý do chênh lệch thực tế"
                  placeholder="Nêu lý do thực xuất/thực nhận lệch số lượng delta..."
                  value={varianceReason}
                  onChange={(e) => setVarianceReason(e.target.value)}
                />
                <div className="mt-2 flex flex-wrap gap-1.5" aria-label="Gợi ý lý do chênh lệch cửa kho">
                  {[
                    'Hao hụt rã đông/rơi vãi',
                    'Bếp giữ lại dùng ca sau',
                    'Sai lệch bao bì cân đong',
                    'Giao thiếu so với phiếu',
                  ].map((preset) => (
                    <Button
                      key={preset}
                      type="button"
                      variant="outline"
                      size="xs"
                      onClick={() => setVarianceReason(preset)}
                    >
                      {preset}
                    </Button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
