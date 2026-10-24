import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { mrxApi, type MrxPreparation } from '../../api/mrxApi';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Badge } from '../../components/ui/badge';
import { VietnameseDateInput } from '../../components/ui/vietnamese-date-input';
import { StateBoundary } from '../../components/workbench/StateBoundary';
import { WorkspaceHeader } from '../../components/workbench/WorkspaceHeader';
import { TelemetrySubbar } from '../../components/workbench/TelemetrySubbar';
import { toVietnameseDate, todayInBusinessTimezone } from '../../utils/dates';
import { DataGrid, type ColumnDef } from '../../components/workbench/DataGrid';
import { Num } from '../../components/ui/num';
import { IdentifierText } from '../../components/ui/identifier-text';

interface MrxMultiCustomerPreparationWorkbenchProps {
  serviceDate: string;
}

export function MrxMultiCustomerPreparationWorkbench({ serviceDate }: MrxMultiCustomerPreparationWorkbenchProps) {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const urlDate = searchParams.get('date');
  const [activeDate, setActiveDate] = useState(() => serviceDate || urlDate || todayInBusinessTimezone());
  const [data, setData] = useState<MrxPreparation | null>(null);
  const [selectedBatchIds, setSelectedBatchIds] = useState<string[]>([]);
  const [supplierFilter, setSupplierFilter] = useState('');
  const [error, setError] = useState<Error | null>(null);
  const [loading, setLoading] = useState(true);
  const [issuing, setIssuing] = useState(false);
  const [successGroupId, setSuccessGroupId] = useState<string | null>(null);

  const load = useCallback(async (dateToLoad = activeDate) => {
    if (!dateToLoad) return;
    setLoading(true);
    setError(null);
    try {
      const result = await mrxApi.getPreparation(dateToLoad);
      setData(result);
      setSelectedBatchIds((curr) =>
        curr.length > 0
          ? curr
          : result.batches.filter((b) => b.isApplicable && !b.hasExistingIssue).map((b) => b.batchId)
      );
    } catch (cause) {
      setError(cause instanceof Error ? cause : new Error('Không thể tải dữ liệu chuẩn bị nguyên liệu phối hợp.'));
    } finally {
      setLoading(false);
    }
  }, [activeDate]);

  useEffect(() => {
    const request = window.setTimeout(() => { void load(activeDate); }, 0);
    return () => window.clearTimeout(request);
  }, [load, activeDate]);

  const activeBatches = useMemo(
    () => data?.batches.filter((b) => selectedBatchIds.includes(b.batchId)) ?? [],
    [data, selectedBatchIds]
  );

  const filteredAggregatedLines = useMemo(() => {
    if (!data || !data.aggregatedLines) return [];
    return data.aggregatedLines
      .map((line) => {
        const filteredAllocs = line.allocations.filter((a) => selectedBatchIds.includes(a.batchId));
        return {
          ...line,
          allocations: filteredAllocs,
          filteredRequired: filteredAllocs.reduce((sum, a) => sum + a.requiredQuantity, 0),
          filteredRemaining: filteredAllocs.reduce((sum, a) => sum + a.remainingQuantity, 0),
        };
      })
      .filter((line) => line.filteredRequired > 0);
  }, [data, selectedBatchIds]);

  const canSubmit = activeBatches.length > 0 && !issuing && activeBatches.every((b) => b.isApplicable && !b.hasExistingIssue);

  const prepColumns = useMemo<ColumnDef<typeof filteredAggregatedLines[number]>[]>(() => [
    {
      id: 'ingredient',
      header: 'Nguyên liệu',
      width: '28%',
      cell: (line) => {
        const name = line.ingredientName ?? line.ingredientCode ?? line.ingredientId;
        return (
          <div className="flex items-center gap-2 truncate">
            <span className="font-semibold text-slate-900 text-sm truncate">{name}</span>
            {line.ingredientCode && <IdentifierText value={line.ingredientCode} />}
          </div>
        );
      },
    },
    {
      id: 'required',
      header: 'Tổng cần chuẩn bị',
      width: '20%',
      align: 'right',
      cell: (line) => (
        <Num value={line.filteredRequired} format="quantity" suffix={line.canonicalUnitName ? ` ${line.canonicalUnitName}` : ''} className="font-bold text-slate-900" />
      ),
    },
    {
      id: 'allocations',
      header: 'Phân bổ theo khách hàng',
      width: '52%',
      cell: (line) => (
        <div className="flex flex-wrap gap-1.5 py-1">
          {line.allocations.map((alloc) => (
            <span
              key={alloc.dailyLineId}
              className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs bg-slate-100 text-slate-700 border border-slate-200 font-mono"
            >
              <span className="font-sans font-medium text-slate-900">{alloc.customerName ?? alloc.customerCode ?? 'Khách'}:</span>
              <span>{alloc.requiredQuantity} {line.canonicalUnitName ?? ''}</span>
            </span>
          ))}
        </div>
      ),
    },
  ], []);

  const submitCoordinatedIssue = async () => {
    if (!data || !canSubmit) return;
    setIssuing(true);
    setError(null);
    setSuccessGroupId(null);
    try {
      const batchesRequest = activeBatches.map((b) => {
        const batchLines = data.aggregatedLines
          .flatMap((l) => l.allocations)
          .filter((a) => a.batchId === b.batchId);
        return {
          reconciliationBatchId: b.batchId,
          expectedVersion: b.batchVersion,
          lines: batchLines.map((a) => {
            const parentLine = data.aggregatedLines.find((l) => l.allocations.some((al) => al.dailyLineId === a.dailyLineId))!;
            return {
              reconciliationBatchLineId: a.batchLineId,
              reconciliationBatchDailyLineId: a.dailyLineId,
              ingredientId: parentLine.ingredientId,
              unitId: parentLine.canonicalUnitId,
              requestedQty: a.requiredQuantity,
              issuedQty: a.requiredQuantity,
            };
          }),
        };
      });

      const result = await mrxApi.issueCoordinated({
        commandId: crypto.randomUUID(),
        serviceDate: activeDate,
        batches: batchesRequest,
      });

      setSuccessGroupId(result.preparationGroupId);
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause : new Error('Không thể thực hiện xuất kho phối hợp.'));
    } finally {
      setIssuing(false);
    }
  };

  const toggleBatch = (batchId: string) => {
    setSelectedBatchIds((curr) =>
      curr.includes(batchId) ? curr.filter((id) => id !== batchId) : [...curr, batchId]
    );
  };

  return (
    <div className="flex-1 min-h-0 flex flex-col h-full bg-white">
      <WorkspaceHeader
        title="Chuẩn bị nguyên liệu phối hợp đa khách hàng"
        breadcrumb="Đối soát MRX · Trạm Kho nguyên liệu"
        contextSelectors={
          <div className="flex items-center gap-2">
            <VietnameseDateInput
              aria-label="Ngày chuẩn bị"
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
          </div>
        }
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const url = mrxApi.getPreparationWorkbookExportUrl({
                  serviceDate: activeDate,
                  batchIds: selectedBatchIds,
                  supplierName: supplierFilter.trim() || undefined,
                });
                window.open(url, '_blank');
              }}
            >
              Xuất Excel chuẩn bị
            </Button>
            <Button
              variant={canSubmit ? 'default' : 'outline'}
              onClick={() => void submitCoordinatedIssue()}
              disabled={!canSubmit}
            >
              {issuing ? 'Đang xuất…' : `Xác nhận xuất phối hợp (${activeBatches.length} lô)`}
            </Button>
          </div>
        }
      />

      <TelemetrySubbar
        leftControls={
          <span className="text-xs font-semibold text-slate-700">Tổng hợp nguyên liệu ngày {toVietnameseDate(activeDate)}</span>
        }
        telemetryPills={data ? (
          <>
            <span className="inline-flex items-center gap-1">
              <span className="text-slate-500">Lô chọn:</span>
              <strong className="text-slate-900 font-mono">{activeBatches.length}/{data.batches.length}</strong>
            </span>
            <span className="text-slate-300">·</span>
            <span className="inline-flex items-center gap-1">
              <span className="text-slate-500">Nguyên liệu tổng:</span>
              <strong className="text-slate-900 font-mono">{filteredAggregatedLines.length}</strong>
            </span>
          </>
        ) : null}
      />
      <StateBoundary
        isLoading={loading}
        error={error}
        onRetry={() => void load()}
        hasExistingData={Boolean(data && data.batches.length > 0)}
        isEmpty={!loading && !error && (!data || data.batches.length === 0)}
        emptyScenario="filter-empty"
        emptyTitle="Không có lô đối soát cho ngày đã chọn"
        emptyDescription="Các lô đối soát cần được Điều phối chuyển sang Kho ở trạng thái Sẵn sàng xuất kho."
      >
        <div className="flex-1 min-h-0 overflow-auto flex flex-col">
          {successGroupId && (
            <div role="status" className="px-4 py-2.5 text-sm bg-emerald-50 text-emerald-800 border-b border-emerald-200 flex items-center justify-between">
              <span>Đã xuất kho phối hợp thành công. Mã nhóm chuẩn bị: <strong className="font-mono">{successGroupId}</strong></span>
              <div className="flex items-center gap-2">
                <Button
                  size="xs"
                  variant="default"
                  onClick={() => navigate(`/warehouse?view=mrx-daily&date=${activeDate}`)}
                >
                  Xem phiếu xuất theo ngày →
                </Button>
                <Button size="xs" variant="outline" onClick={() => setSuccessGroupId(null)}>Đóng</Button>
              </div>
            </div>
          )}

          {/* Batches selector and supplier filter bar */}
          <section aria-label="Bộ lọc chuẩn bị nguyên liệu" className="p-4 border-b border-slate-200 bg-slate-50 shrink-0 space-y-3">
            <div>
              <h2 className="text-xs font-semibold uppercase text-slate-500 tracking-wider mb-2">
                Các khách hàng có lịch ngày {toVietnameseDate(activeDate)}
              </h2>
              <div className="flex flex-wrap gap-3">
                {data?.batches.map((b) => (
                  <label
                    key={b.batchId}
                    className={`inline-flex items-center gap-2 p-2.5 rounded border text-sm cursor-pointer transition-colors ${
                      selectedBatchIds.includes(b.batchId)
                        ? 'border-indigo-600 bg-indigo-50/50 text-indigo-900 font-medium'
                        : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                    }`}
                  >
                    <input
                      type="checkbox"
                      className="rounded text-indigo-600 focus:ring-indigo-500"
                      checked={selectedBatchIds.includes(b.batchId)}
                      onChange={() => toggleBatch(b.batchId)}
                      disabled={!b.isApplicable || b.hasExistingIssue}
                    />
                    <span>{b.customerName ?? b.customerCode ?? b.customerId}</span>
                    <Badge variant={b.hasExistingIssue ? 'success' : b.isApplicable ? 'neutral' : 'warning'} size="sm">
                      {b.hasExistingIssue ? 'Đã xuất' : b.isApplicable ? `${b.requiredQuantity} đl` : b.batchStatus}
                    </Badge>
                  </label>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-2 max-w-sm">
              <label htmlFor="supplier-filter" className="text-xs font-medium text-slate-600 whitespace-nowrap">Lọc nhà cung cấp:</label>
              <Input
                id="supplier-filter"
                aria-label="Lọc theo tên nhà cung cấp"
                placeholder="Tất cả hoặc tên NCC..."
                value={supplierFilter}
                onChange={(e) => setSupplierFilter(e.target.value)}
                className="h-8 text-xs"
              />
            </div>
          </section>

          {/* Aggregated materials table */}
          <div className="flex-1 min-h-0 flex flex-col">
            <DataGrid data={filteredAggregatedLines} columns={prepColumns} keyExtractor={(line) => line.ingredientId} />
          </div>
        </div>
      </StateBoundary>
    </div>
  );
}
