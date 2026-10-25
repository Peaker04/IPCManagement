import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { mrxApi, type MrxKitchenCooking, type MrxBatchSummary } from '../../api/mrxApi';
import { WorkspaceHeader } from '../../components/workbench/WorkspaceHeader';
import { TelemetrySubbar } from '../../components/workbench/TelemetrySubbar';
import { StateBoundary } from '../../components/workbench/StateBoundary';
import { Select } from '../../components/ui/select';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Num } from '../../components/ui/num';
import { IdentifierText } from '../../components/ui/identifier-text';
import { ApiError } from '../../api/client';
import { toVietnameseDate } from '../../utils/dates';
import { downloadAuthenticatedFile } from '../../utils/fileDownload';

interface DishGroup {
  key: string;
  serviceDate: string;
  weekday: string;
  shiftName: string;
  dishCode: string;
  dishName: string;
  servings: number;
  rows: Array<MrxKitchenCooking['rows'][number]>;
}

export function MrxCookingWorkbench() {
  const [searchParams, setSearchParams] = useSearchParams();
  const urlBatchId = searchParams.get('batchId') || '';

  const [batches, setBatches] = useState<MrxBatchSummary[]>([]);
  const [batchId, setBatchId] = useState(urlBatchId);
  const [selectedShift, setSelectedShift] = useState<'ALL' | 'MORNING' | 'AFTERNOON'>('ALL');
  const [data, setData] = useState<MrxKitchenCooking | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let ignore = false;
    mrxApi.getBatchPage({ pageSize: 50 })
      .then((page) => {
        if (ignore) return;
        const items = page?.items ?? [];
        setBatches(items);
        if (!urlBatchId && items.length > 0) {
          const preferred =
            items.find((b) => b.status === 'READY') ||
            items.find((b) => b.status === 'IN_PROGRESS') ||
            items[0];
          const first = preferred.batchId;
          setBatchId(first);
          setSearchParams((curr) => {
            const next = new URLSearchParams(curr);
            next.set('batchId', first);
            return next;
          }, { replace: true });
        }
      })
      .catch(() => {});
    return () => { ignore = true; };
  }, [urlBatchId, setSearchParams]);

  const loadCookingData = useCallback(async (id: string) => {
    if (!id) {
      setData(null);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const result = await mrxApi.getKitchenCooking(id);
      setData(result);
    } catch (cause: unknown) {
      setData(null);
      setError(cause instanceof Error ? cause : new Error('Không thể tải phiếu nấu theo lô.'));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (batchId) {
      const request = window.setTimeout(() => { void loadCookingData(batchId); }, 0);
      return () => window.clearTimeout(request);
    }
  }, [batchId, loadCookingData]);

  const batchOptions = (batches ?? []).map((b) => {
    const statusLabel =
      b.status === 'IN_PROGRESS' ? 'Đang thực hiện' :
      b.status === 'READY' ? 'Sẵn sàng' :
      b.status === 'COMPLETED' ? 'Hoàn tất' :
      b.status === 'INITIALIZED' ? 'Khởi tạo' : b.status;
    return {
      value: b.batchId,
      label: `${b.customerCode ?? b.customerName ?? 'Lô'} · ${statusLabel} · ${b.batchId.slice(0, 8)}`,
    };
  });

  const errorMessage = error?.message || '';
  const isLegacyLineageMissing = (error instanceof ApiError && error.status === 409) ||
    errorMessage.includes('LEGACY_DAILY_LINEAGE_MISSING') ||
    errorMessage.includes('KITCHEN_FROZEN_LINEAGE_MISSING');

  const displayedError = isLegacyLineageMissing ? null : error;

  const dishGroups = useMemo<DishGroup[]>(() => {
    if (!data?.rows) return [];
    const map = new Map<string, DishGroup>();

    for (const row of data.rows) {
      const groupKey = `${row.serviceDate}-${row.shiftName}-${row.dishCode}`;
      const existing = map.get(groupKey);
      if (existing) {
        existing.rows.push(row);
      } else {
        map.set(groupKey, {
          key: groupKey,
          serviceDate: row.serviceDate,
          weekday: row.weekday,
          shiftName: row.shiftName,
          dishCode: row.dishCode,
          dishName: row.dishName,
          servings: row.servings,
          rows: [row],
        });
      }
    }
    return Array.from(map.values());
  }, [data]);

  const filteredDishGroups = useMemo(() => {
    if (selectedShift === 'ALL') return dishGroups;
    return dishGroups.filter((g) => {
      const shiftUpper = g.shiftName.toUpperCase();
      if (selectedShift === 'MORNING') return shiftUpper.includes('MORNING') || shiftUpper.includes('SÁNG') || shiftUpper.includes('CA 1');
      if (selectedShift === 'AFTERNOON') return shiftUpper.includes('AFTERNOON') || shiftUpper.includes('CHIỀU') || shiftUpper.includes('CA 2');
      return true;
    });
  }, [dishGroups, selectedShift]);

  const totalFilteredServings = useMemo(() => {
    return filteredDishGroups.reduce((acc, g) => acc + g.servings, 0);
  }, [filteredDishGroups]);

  const csvUrl = batchId ? `/api/reconciliation/batches/${encodeURIComponent(batchId)}/kitchen-cooking/csv` : '';
  const xlsxUrl = batchId ? `/api/reconciliation/batches/${encodeURIComponent(batchId)}/kitchen-cooking/xlsx` : '';

  return (
    <div className="flex-1 min-h-0 flex flex-col h-full bg-white select-text">
      <WorkspaceHeader
        title="Phiếu nấu theo lô"
        breadcrumb="Đối soát MRX · Trạm Bếp trưởng"
        contextSelectors={
          <>
            {batches.length > 0 && (
              <Select
                aria-label="Chọn lô đối soát nấu"
                options={batchOptions}
                value={batchId}
                onChange={(e) => {
                  const newId = e.target.value;
                  setBatchId(newId);
                  setSearchParams((curr) => {
                    const next = new URLSearchParams(curr);
                    next.set('batchId', newId);
                    return next;
                  }, { replace: true });
                }}
                className="h-9 w-72 font-medium text-sm"
              />
            )}
            {data && (
              <>
                <Select
                  aria-label="Lọc theo ca nấu"
                  value={selectedShift}
                  onChange={(e) => setSelectedShift(e.target.value as 'ALL' | 'MORNING' | 'AFTERNOON')}
                  options={[
                    { value: 'ALL', label: 'Tất cả các ca' },
                    { value: 'MORNING', label: 'Ca 1 (Sáng)' },
                    { value: 'AFTERNOON', label: 'Ca 2 (Chiều)' },
                  ]}
                  className="h-9 w-40 font-medium text-sm"
                />
                <Badge variant="neutral" size="default" className="h-9 px-3 text-xs font-mono flex items-center">
                  Phiên bản: v{data.sourceVersion}
                </Badge>
              </>
            )}
          </>
        }
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={!data || data.rows.length === 0}
              onClick={() => {
                if (csvUrl) void downloadAuthenticatedFile(csvUrl, `phieu-nau-${batchId.slice(0, 8)}.csv`);
              }}
            >
              Tải CSV
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={!data || data.rows.length === 0}
              onClick={() => {
                if (xlsxUrl) void downloadAuthenticatedFile(xlsxUrl, `phieu-nau-${batchId.slice(0, 8)}.xlsx`);
              }}
            >
              Tải Excel
            </Button>
            <Button
              variant="default"
              size="sm"
              disabled={!data || data.rows.length === 0}
              onClick={() => window.print()}
            >
              In phiếu nấu
            </Button>
          </div>
        }
      />

      <TelemetrySubbar
        leftControls={
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-700">Phiếu nấu theo từng món ăn trong ca</span>
            <span className="text-[11px] text-slate-500 hidden md:inline">· Định mức đóng băng, kiểm duyệt an toàn không lộ giá</span>
          </div>
        }
        telemetryPills={data ? (
          <>
            <span className="inline-flex items-center gap-1">
              <span className="text-slate-500">Số món:</span>
              <strong className="text-slate-900 font-mono">{filteredDishGroups.length}</strong>
            </span>
            <span className="text-slate-300">·</span>
            <span className="inline-flex items-center gap-1">
              <span className="text-slate-500">Tổng suất:</span>
              <strong className="text-slate-900 font-mono">{totalFilteredServings} suất</strong>
            </span>
            <span className="text-slate-300">·</span>
            <span className="inline-flex items-center gap-1">
              <span className="text-slate-500">Dòng nguyên liệu:</span>
              <strong className="text-slate-900 font-mono">
                {filteredDishGroups.reduce((sum, g) => sum + g.rows.length, 0)}
              </strong>
            </span>
          </>
        ) : null}
      />

      <StateBoundary
        isLoading={isLoading}
        error={displayedError}
        onRetry={() => { if (batchId) void loadCookingData(batchId); }}
        hasExistingData={Boolean(data && data.rows.length > 0)}
        isEmpty={!isLoading && !displayedError && (!data || data.rows.length === 0)}
        emptyScenario="filter-empty"
        emptyTitle={isLegacyLineageMissing ? "Lô đối soát chưa có phân rã phiếu nấu theo ca" : "Không có dòng phiếu nấu cho lô đã chọn"}
        emptyDescription={isLegacyLineageMissing ? "Lô này chưa phân rã phiếu nấu theo ngày hoặc được tạo từ phiên bản trước (KITCHEN_FROZEN_LINEAGE_MISSING). Vui lòng chọn lô đối soát khác trong danh sách phía trên." : "Lô đối soát cần có lịch món, số suất và BOM định mức đã đóng băng."}
      >
        <div className="flex-1 min-h-0 overflow-auto p-4 space-y-4 bg-slate-50/50">
          {filteredDishGroups.map((group) => (
            <section
              key={group.key}
              aria-label={`Món ${group.dishName}`}
              className="rounded-lg border border-slate-200 bg-white overflow-hidden shadow-2xs"
            >
              {/* Dish Header */}
              <div className="px-4 py-2.5 bg-slate-100/80 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-slate-900">{group.dishName}</h3>
                    <span className="text-xs font-mono text-slate-500">({group.dishCode})</span>
                  </div>
                  <p className="text-xs text-slate-600 mt-0.5">
                    {group.weekday} · {toVietnameseDate(group.serviceDate)} · {group.shiftName}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-500 font-medium">Số suất:</span>
                  <strong className="text-sm font-bold font-mono text-slate-900 tabular-nums">{group.servings}</strong>
                  <Badge variant="info" size="sm">suất</Badge>
                </div>
              </div>

              {/* Ingredients Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse table-fixed">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600">
                      <th className="h-8 px-3 text-left w-[35%]">Nguyên liệu</th>
                      <th className="h-8 px-3 text-center w-[12%]">ĐVT</th>
                      <th className="h-8 px-3 text-right w-[18%]">Định mức / suất</th>
                      <th className="h-8 px-3 text-right w-[15%]">Hao hụt (%)</th>
                      <th className="h-8 px-3 text-right w-[20%]">Tổng lượng cần</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {group.rows.map((row, idx) => (
                      <tr key={`${row.ingredientCode}-${idx}`} className="h-9 hover:bg-slate-50/60 transition-colors">
                        <td className="px-3 text-sm text-slate-900 truncate">
                          <span className="font-medium">{row.ingredientName}</span>
                          <span className="ml-1.5 text-xs font-mono text-slate-400">
                            <IdentifierText value={row.ingredientCode} />
                          </span>
                        </td>
                        <td className="px-3 text-center font-mono text-xs text-slate-600">{row.unitName}</td>
                        <td className="px-3 text-right font-mono text-xs text-slate-700">
                          <Num value={row.bomQuantityPerServing} format="quantity" />
                        </td>
                        <td className="px-3 text-right font-mono text-xs text-slate-600">
                          {row.wasteRatePercent != null ? `${row.wasteRatePercent}%` : '—'}
                        </td>
                        <td className="px-3 text-right font-mono text-sm font-bold text-slate-900">
                          <Num value={row.totalRequiredQuantity} format="quantity" />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ))}
        </div>
      </StateBoundary>
    </div>
  );
}
