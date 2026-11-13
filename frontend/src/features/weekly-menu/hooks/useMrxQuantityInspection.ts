import { useEffect, useState } from 'react';
import { workspaceSessionStore } from '../../../store/workspaceSessionStore';
import { mrxApi, type MrxInspectionQuery, type MrxMaterialInspectionPage, type MrxPlanInspectionPage, type MrxWeeklySource } from '../../../api/mrxApi';
import { ApiError } from '../../../api/client';
import { weeklyMenuApi } from '../../../api/weeklyMenuApi';
import { useWorkbenchQuery } from '../../../hooks/useWorkbenchQuery';
import type { CustomerOption } from '../../../types';
import { isWeekStartDate } from '../../../utils/dates';

type InspectionResult = { view: 'materials'; data: MrxMaterialInspectionPage } | { view: 'plans'; data: MrxPlanInspectionPage };

export function useMrxQuantityInspection({ customerId, weekStartDate, view, ...query }: MrxInspectionQuery & {
  customerId: string; weekStartDate: string; view: 'materials' | 'plans';
}) {
  const customers = useWorkbenchQuery<CustomerOption[]>({
    scopeKey: 'mrx_inspection_customers', cacheKey: 'catalog_customers',
    queryFn: () => weeklyMenuApi.getCustomers(),
  });
  const scope = `${customerId}_${weekStartDate}`;
  const validScope = Boolean(customerId && isWeekStartDate(weekStartDate));
  const sourceQuery = useWorkbenchQuery<MrxWeeklySource | null>({
    scopeKey: 'mrx_inspection_source', cacheKey: `mrx_inspection_source_${scope}`,
    snapshotKey: `snapshot:mrx_inspection_source_${scope}`, scopeId: validScope ? customerId : '', enabled: validScope,
    queryFn: async () => {
      try { return await mrxApi.getWeeklySource(customerId, weekStartDate); }
      catch (cause) { if (cause instanceof ApiError && cause.status === 404) return null; throw cause; }
    },
    isDatasetEmpty: data => !data,
    emptyTitle: 'Chưa có nguồn thực đơn cho tuần này',
    emptyDescription: 'Hoàn thiện nguồn thực đơn và số suất tại Chuẩn bị lô đối soát.', emptyScenario: 'prerequisite-blocked',
  });
  const exactSource = sourceQuery.data?.customerId === customerId && sourceQuery.data.weekStartDate === weekStartDate ? sourceQuery.data : null;
  const isSourceTransitioning = validScope && !exactSource && (sourceQuery.stateProps.isLoading || sourceQuery.stateProps.isFetching) && !sourceQuery.stateProps.error && Boolean(sourceQuery.data);
  const activeSource = exactSource ?? (isSourceTransitioning ? sourceQuery.data : null);
  useEffect(() => {
    if (exactSource?.menuVersionId) workspaceSessionStore.setScope({ weeklyMenuScope: { customerId, weekStartDate } });
  }, [customerId, exactSource, weekStartDate]);
  const menuVersionId = exactSource?.menuVersionId ?? '';
  const published = activeSource?.menuVersionStatus === 'PUBLISHED' || activeSource?.menuVersionStatus === 'ACTIVE';
  const key = `mrx_inspection_${scope}_${menuVersionId}_${view}_${query.pageNumber}_${query.pageSize}_${query.searchKeyword}`;
  const inspection = useWorkbenchQuery<InspectionResult>({
    scopeKey: 'mrx_inspection', cacheKey: key, snapshotKey: `snapshot:${key}`,
    scopeId: menuVersionId, enabled: published && Boolean(exactSource),
    queryFn: async () => view === 'materials'
      ? { view, data: await mrxApi.getMaterialInspection(menuVersionId, query) }
      : { view, data: await mrxApi.getPlanInspection(menuVersionId, query) },
    isDatasetEmpty: result => result.data.page.totalCount === 0,
    emptyTitle: view === 'materials' ? 'Không có nguyên liệu phù hợp' : 'Không có kế hoạch theo ca phù hợp',
    emptyDescription: 'Kiểm tra phạm vi tuần hoặc thay đổi từ khóa tìm kiếm.',
  });
  const exactResult = !isSourceTransitioning && inspection.data?.view === view
    && inspection.data.data.menuVersionId === menuVersionId ? inspection.data : null;
  const isInspectionTransitioning = Boolean(
    !exactResult && inspection.data && (
      isSourceTransitioning ||
      inspection.stateProps.isLoading ||
      inspection.stateProps.isFetching ||
      (published && (inspection.data.view !== view || inspection.data.data.menuVersionId !== menuVersionId))
    ) && !inspection.stateProps.error && !sourceQuery.stateProps.error
  );
  const result = exactResult ?? (isInspectionTransitioning && inspection.data?.view === view ? inspection.data : null);
  const [retainedSource, setRetainedSource] = useState<MrxWeeklySource | null>(() => activeSource);
  if (!isInspectionTransitioning && activeSource && retainedSource !== activeSource) {
    setRetainedSource(activeSource);
  }
  const source = isInspectionTransitioning && retainedSource ? retainedSource : activeSource;
  const hasSearchKeyword = Boolean(query.searchKeyword?.trim());
  const stateProps = sourceQuery.stateProps.error || !source
    ? { ...sourceQuery.stateProps, isEmpty: !validScope || (!source && !sourceQuery.stateProps.isLoading && !sourceQuery.stateProps.isFetching && !sourceQuery.stateProps.error),
        emptyTitle: validScope ? sourceQuery.stateProps.emptyTitle : 'Chọn khách hàng và tuần bắt đầu',
        emptyDescription: validScope ? sourceQuery.stateProps.emptyDescription : 'Chọn đúng khách hàng và ngày Thứ Hai để xem nguồn dự kiến.', emptyScenario: 'prerequisite-blocked' as const }
    : !published
      ? { ...sourceQuery.stateProps, isEmpty: true, emptyTitle: 'Thực đơn chưa được phát hành', emptyDescription: 'Hoàn thiện nguồn tại Chuẩn bị lô đối soát.', emptyScenario: 'prerequisite-blocked' as const }
      : { ...inspection.stateProps, isEmpty: inspection.stateProps.isEmpty && !hasSearchKeyword, isFetching: Boolean(inspection.stateProps.isFetching || isSourceTransitioning), hasExistingData: Boolean(result), isPreviousData: Boolean(result && (inspection.stateProps.isPreviousData || isInspectionTransitioning)), isLoading: !result && !inspection.stateProps.error,
          isPartial: Boolean(result?.data.diagnostics.length), partialMessage: result?.data.diagnostics.join(' · ') };
  return { customers, source, result, stateProps,
    retry: () => sourceQuery.stateProps.error || !source ? sourceQuery.refetch(true) : inspection.refetch(true),
    refresh: () => Promise.all([customers.refetch(true), sourceQuery.refetch(true), inspection.refetch(true)]),
  };
}
