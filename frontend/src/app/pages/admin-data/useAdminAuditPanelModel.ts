import { useDeferredValue, useMemo, useRef, useState } from 'react';
import { useAppSelector } from '@/app/hooks';
import { useGetAuditChangePageQuery } from '@/features/reports/reportsApi';
import type { ReportCursor } from '@/api/workflowApiTypes';
import { getTodayInputValue, type AdminView } from './adminDataPageTypes';
import { toAdminView } from './adminDataPageModelShared';

export function useAdminAuditPanelModel(activeView: AdminView) {
  const [auditCursors, setAuditCursors] = useState<ReportCursor[]>([]);
  const [auditActor, setAuditActor] = useState('');
  const [auditArea, setAuditArea] = useState('');
  const [auditEntity, setAuditEntity] = useState('');
  const [auditField, setAuditField] = useState('');
  const [exportError, setExportError] = useState<string | null>(null);
  const [isExportingAudit, setIsExportingAudit] = useState(false);
  const exportInFlight = useRef(false);
  const authToken = useAppSelector((state) => state.auth.token);
  const deferredAuditActor = useDeferredValue(auditActor);
  const deferredAuditArea = useDeferredValue(auditArea);
  const deferredAuditEntity = useDeferredValue(auditEntity);
  const deferredAuditField = useDeferredValue(auditField);
  const auditQuery = useMemo(
    () => ({
      limit: 100,
      actor: deferredAuditActor.trim() || undefined,
      businessArea: deferredAuditArea.trim() || undefined,
      entityName: deferredAuditEntity.trim() || undefined,
      fieldName: deferredAuditField.trim() || undefined,
    }),
    [deferredAuditActor, deferredAuditArea, deferredAuditEntity, deferredAuditField],
  );
  const auditCursor = auditCursors.at(-1);
  const auditResult = useGetAuditChangePageQuery({
    ...auditQuery,
    cursorDate: auditCursor?.cursorDate,
    cursorId: auditCursor?.cursorId,
    cursorOffset: auditCursor?.cursorOffset,
    limit: 8,
    sortDirection: 'desc',
  }, { skip: activeView !== 'audit' });
  const auditView = toAdminView(auditResult, 'nhật ký audit');

  const handleExportAuditCsv = async () => {
    if (exportInFlight.current) return;

    exportInFlight.current = true;
    setIsExportingAudit(true);
    setExportError(null);
    const params = new URLSearchParams();
    if (auditActor) params.append('actor', auditActor.trim());
    if (auditArea) params.append('businessArea', auditArea.trim());
    if (auditEntity) params.append('entityName', auditEntity.trim());
    if (auditField) params.append('fieldName', auditField.trim());

    try {
      const response = await fetch(`/api/workflow-reports/audit-changes/csv?${params.toString()}`, {
        headers: authToken ? { Authorization: `Bearer ${authToken}` } : {},
      });
      if (!response.ok) throw new Error('Không thể xuất CSV');

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `audit-log-${getTodayInputValue()}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setExportError(String(err));
    } finally {
      exportInFlight.current = false;
      setIsExportingAudit(false);
    }
  };

  return {
    queryView: auditView,
    auditActor,
    auditArea,
    auditCursors,
    auditEntity,
    auditField,
    auditResult,
    displayLogs: auditView.phase === 'ready' ? auditView.data.items : [],
    exportError,
    handleExportAuditCsv,
    isExportingAudit,
    setAuditActor,
    setAuditArea,
    setAuditCursors,
    setAuditEntity,
    setAuditField,
  };
}
