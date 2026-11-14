import { useCallback, useEffect, useRef, useState } from 'react';
import { weeklyMenuApi, type WeeklyMenuImportHistoryItem, type WeeklyMenuImportResult } from '../../../api/weeklyMenuApi';
import { isWeekStartDate } from '../../../utils/dates';

interface ImportScope {
  customerId: string;
  weekStartDate: string;
  priceTierAmount: number | null;
}

interface ImportItem extends ImportScope {
  id: string;
  file: File | null;
  revision: number;
  dateError: string | null;
  preview: WeeklyMenuImportResult | null;
  isPreviewing: boolean;
  error: string | null;
  weekMode: 'auto' | 'saved' | 'manual' | 'entry' | 'current';
  draftPage: number;
  draftMatch: { status: 'loading' | 'matched' | 'ambiguous' | 'none' | 'error'; items: WeeklyMenuImportHistoryItem[]; totalCount: number; error?: string } | null;
}

export function useWeeklyMenuImportItems(initial: Omit<ImportScope, 'priceTierAmount'> & { scopeIntent?: 'current-week' | 'new-week' }, tiers: number[], blockedScope?: Omit<ImportScope, 'priceTierAmount'>) {
  const newItem = (file: File | null = null, initialScope = initial): ImportItem => ({
    ...initialScope, id: crypto.randomUUID(), file, priceTierAmount: null, revision: 0,
    dateError: null, preview: null, isPreviewing: false, error: null,
    weekMode: initialScope.weekStartDate ? initial.scopeIntent === 'current-week' ? 'current' : 'manual' : 'auto', draftMatch: null, draftPage: 1,
  });
  const [items, setItems] = useState<ImportItem[]>(() => [newItem()]);
  const current = useRef(items);
  const alive = useRef(true);
  const busy = useRef(false);
  const acceptedCommit = useRef(false);
  const previewCount = useRef(0);
  const [pendingPreviews, setPendingPreviews] = useState(0);
  const [isCommitting, setIsCommitting] = useState(false);
  const [results, setResults] = useState<WeeklyMenuImportResult[]>([]);
  const [publicationWarning, setPublicationWarning] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [unknownOutcome, setUnknownOutcome] = useState(false);

  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const replace = useCallback((next: ImportItem[]) => { current.current = next; setItems(next); }, []);
  const blockedCustomerId = blockedScope?.customerId;
  const blockedWeekStartDate = blockedScope?.weekStartDate;
  useEffect(() => {
    if (!blockedCustomerId || !blockedWeekStartDate) return;
    if (!current.current.some(item => item.weekMode === 'current' && item.customerId === blockedCustomerId
      && item.weekStartDate === blockedWeekStartDate)) return;
    replace(current.current.map(item => item.weekMode === 'current' && item.customerId === blockedCustomerId
      && item.weekStartDate === blockedWeekStartDate
      ? { ...item, weekMode: 'manual', weekStartDate: '', revision: item.revision + 1, preview: null,
        error: 'Lô tuần đang xem đã chốt. Hãy chọn tuần khác hoặc đóng cửa sổ để chỉnh sửa món.' }
      : item));
  }, [blockedCustomerId, blockedWeekStartDate, replace]);
  useEffect(() => {
    for (const candidate of current.current) {
      if (candidate.weekMode !== 'auto' || candidate.draftMatch || !candidate.file || !candidate.customerId
        || candidate.priceTierAmount === null || !tiers.includes(candidate.priceTierAmount)) continue;
      const { id, revision, file, customerId, priceTierAmount, draftPage } = candidate;
      const isCurrent = () => alive.current && current.current.some(item => item.id === id && item.revision === revision && item.weekMode === 'auto');
      replace(current.current.map(item => item.id === id ? { ...item, draftMatch: { status: 'loading', items: [], totalCount: 0 } } : item));
      void (async () => {
        try {
          const digest = await crypto.subtle.digest('SHA-256', await file.arrayBuffer());
          const sourceChecksum = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('').toUpperCase();
          if (!isCurrent()) return;
          const matches = await weeklyMenuApi.getImportHistory(customerId, draftPage, 10, { sourceChecksum, priceTierAmount });
          if (!isCurrent()) return;
          if (matches.items.some(item => item.customerId !== customerId || item.status !== 'DRAFT' || !isWeekStartDate(item.weekStartDate)))
            throw new Error('Bản nháp trả về không khớp phạm vi đã chọn.');
          const single = matches.totalCount === 1 && matches.items.length === 1 ? matches.items[0] : null;
          replace(current.current.map(item => item.id === id ? { ...item, revision: item.revision + 1,
            weekStartDate: single?.weekStartDate ?? '', weekMode: single ? 'saved' : matches.totalCount ? 'auto' : 'entry',
            draftMatch: { status: single ? 'matched' : matches.totalCount ? 'ambiguous' : 'none', ...matches },
          } : item));
        } catch (cause) {
          if (isCurrent()) replace(current.current.map(item => item.id === id ? { ...item, draftMatch: {
            status: 'error', items: [], totalCount: 0, error: cause instanceof Error ? cause.message : 'Không thể kiểm tra bản nháp.',
          } } : item));
        }
      })();
    }
  }, [items, tiers, replace]);
  const enableWeekChange = (id: string) => {
    if (!canEdit()) return;
    replace(current.current.map(item => item.id === id ? { ...item, weekMode: 'manual', draftMatch: null, revision: item.revision + 1, preview: null } : item));
  };
  const chooseDraft = (id: string, versionId: string) => {
    if (!canEdit()) return;
    replace(current.current.map(item => {
      const match = item.id === id ? item.draftMatch?.items.find(draft => draft.menuVersionId === versionId) : null;
      return match ? { ...item, weekMode: 'saved', weekStartDate: match.weekStartDate, dateError: null, revision: item.revision + 1, preview: null,
        draftMatch: { status: 'matched', items: [match], totalCount: 1 } } : item;
    }));
  };
  const setScopeIntent = (id: string, intent: 'current-week' | 'new-week', scope: Omit<ImportScope, 'priceTierAmount'>) => {
    if (!canEdit() || (intent === 'current-week' && (!scope.customerId || !isWeekStartDate(scope.weekStartDate)
      || (scope.customerId === blockedScope?.customerId && scope.weekStartDate === blockedScope.weekStartDate)))) return;
    replace(current.current.map(item => item.id === id ? { ...item,
      customerId: intent === 'current-week' ? scope.customerId : item.customerId,
      weekStartDate: intent === 'current-week' ? scope.weekStartDate : '',
      weekMode: intent === 'current-week' ? 'current' : item.file ? 'auto' : 'manual', dateError: null, draftMatch: null, draftPage: 1,
      revision: item.revision + 1, preview: null, isPreviewing: false, error: null,
    } : item));
    setError(null);
  };
  const loadDraftPage = (id: string, page = 1) => {
    if (!canEdit()) return;
    replace(current.current.map(item => item.id === id ? { ...item, weekMode: 'auto', weekStartDate: '', draftMatch: null, draftPage: page, revision: item.revision + 1, preview: null } : item));
  };
  const canEdit = () => !busy.current && !acceptedCommit.current;
  const validScope = (item: ImportItem) => Boolean(item.file?.name.toLowerCase().endsWith('.xlsx') && item.customerId && !item.dateError
    && item.weekMode !== 'auto' && isWeekStartDate(item.weekStartDate) && item.priceTierAmount !== null && tiers.includes(item.priceTierAmount)
    && !(item.customerId === blockedScope?.customerId && item.weekStartDate === blockedScope.weekStartDate));
  const validPreview = (item: ImportItem) => validScope(item) && Boolean(item.preview?.previewToken)
    && Boolean(item.preview?.previewExpiresAt && Date.parse(item.preview.previewExpiresAt) > Date.now())
    && !item.preview?.validation.hasCriticalErrors && item.preview?.validation.isValid === true
    && !item.preview.validation.issues.some(issue => issue.severity.toLowerCase() === 'error')
    && !item.preview.mrxDayOutcomes?.some(day => day.outcome === 'LOCKED_CONFLICT');
  const hasDuplicateScope = (list: ImportItem[]) => new Set(list.map(item => `${item.customerId}|${item.weekStartDate}`)).size !== list.length;

  const updateItem = (id: string, patch: Partial<ImportScope> & { file?: File; dateError?: string | null }) => {
    if (!canEdit()) return;
    replace(current.current.map(item => {
      if (item.id !== id) return item;
      const scopeChanged = patch.file !== undefined || patch.customerId !== undefined || patch.priceTierAmount !== undefined;
      const autoReset = scopeChanged && item.weekMode !== 'manual' && item.weekMode !== 'current';
      return { ...item, ...patch, ...(autoReset ? { weekMode: 'auto' as const, weekStartDate: '', dateError: null } : {}),
        ...(patch.weekStartDate !== undefined ? { weekMode: 'manual' as const } : {}),
        ...(scopeChanged ? { draftMatch: null, draftPage: 1 } : {}), revision: item.revision + 1, preview: null, isPreviewing: false, error: null };
    }));
    setError(null);
  };
  const addFiles = (files: File[]) => {
    if (!canEdit() || !files.length) return;
    const existing = current.current.filter(item => item.file);
    if (existing.length + files.length > 10) { setError('Chỉ được nhập tối đa 10 file mỗi nhóm.'); return; }
    if (files.some(file => !file.name.toLowerCase().endsWith('.xlsx'))) { setError('Vui lòng chọn file .xlsx.'); return; }
    const blank = current.current.find(item => !item.file);
    const added = files.map((file, index) => index === 0 && blank
      ? { ...blank, file, revision: blank.revision + 1, preview: null }
      : newItem(file, { customerId: '', weekStartDate: '' }));
    replace([...existing, ...added]);
    setError(null);
  };
  const removeItem = (id: string) => {
    if (!canEdit()) return;
    const next = current.current.filter(item => item.id !== id);
    replace(next.length ? next : [newItem()]);
    setError(null);
  };
  const previewItem = async (id: string) => {
    const item = current.current.find(candidate => candidate.id === id);
    if (!canEdit() || !item || item.isPreviewing || !validScope(item)) return;
    const revision = item.revision;
    replace(current.current.map(candidate => candidate.id === id ? { ...candidate, isPreviewing: true, preview: null, error: null } : candidate));
    setError(null);
    setPendingPreviews(++previewCount.current);
    try {
      const body = new FormData();
      body.append('file', item.file!);
      body.append('customerId', item.customerId);
      body.append('weekStartDate', item.weekStartDate);
      body.append('priceTierAmount', String(item.priceTierAmount));
      const preview = await weeklyMenuApi.previewWeeklyMenuImport(body);
      if (!alive.current) return;
      if (preview.customerId !== item.customerId || preview.weekStartDate !== item.weekStartDate)
        throw new Error('Phạm vi xem trước không khớp khách hàng và tuần đã chọn.');
      replace(current.current.map(candidate => candidate.id === id && candidate.revision === revision ? { ...candidate, preview, isPreviewing: false } : candidate));
    } catch (cause) {
      if (alive.current) replace(current.current.map(candidate => candidate.id === id && candidate.revision === revision
        ? { ...candidate, isPreviewing: false, error: cause instanceof Error ? cause.message : 'Không thể phân tích file thực đơn.' } : candidate));
    } finally {
      previewCount.current--;
      if (alive.current) setPendingPreviews(previewCount.current);
    }
  };
  const commitItems = async (autoPublish: boolean): Promise<WeeklyMenuImportResult[] | null> => {
    const snapshot = current.current;
    if (!canEdit() || unknownOutcome || previewCount.current > 0) return null;
    if (hasDuplicateScope(snapshot)) { setError('Mỗi khách hàng và tuần chỉ được có một file trong nhóm.'); return null; }
    if (snapshot.length > 1 && snapshot.some(item => item.preview?.mrxDayOutcomes?.length)) {
      setError('Phạm vi đã có lô MRX phải import lại từng file, không nhập nhóm.'); return null;
    }
    if (!snapshot.every(validPreview)) { setError('Vui lòng xem trước lại mọi file với ngày, mốc giá hợp lệ và phiên chưa hết hạn.'); return null; }
    busy.current = true;
    setIsCommitting(true);
    setError(null);
    try {
      const group = snapshot.length > 1;
      const body = new FormData();
      for (const item of snapshot) {
        body.append(group ? 'files' : 'file', item.file!);
        body.append(group ? 'customerIds' : 'customerId', item.customerId);
        body.append(group ? 'weekStartDates' : 'weekStartDate', item.weekStartDate);
        body.append(group ? 'priceTierAmounts' : 'priceTierAmount', String(item.priceTierAmount));
        body.append(group ? 'previewTokens' : 'previewToken', item.preview!.previewToken!);
      }
      const accepted = group ? await weeklyMenuApi.commitWeeklyMenuImportBatch(body) : [await weeklyMenuApi.commitWeeklyMenuImport(body)];
      if (!alive.current) return null;
      if (accepted.length !== snapshot.length || accepted.some((result, index) => result.customerId !== snapshot[index].customerId
        || result.weekStartDate !== snapshot[index].weekStartDate || (!result.committed && (group || result.mrxSourceChange?.status !== 'PENDING_REVIEW')))) {
        setUnknownOutcome(true);
        throw new Error('Phản hồi lưu không xác nhận đầy đủ phạm vi. Hãy kiểm tra lịch sử trước khi nhập lại.');
      }
      acceptedCommit.current = true;
      setResults(accepted);
      if (!group && autoPublish && !snapshot[0].preview?.mrxDayOutcomes?.length) {
        try {
          const schedules = await weeklyMenuApi.getMenuSchedules(snapshot[0].customerId, snapshot[0].weekStartDate);
          if (!schedules.length) throw new Error('Chưa tìm thấy lịch thực đơn vừa nhập.');
          await weeklyMenuApi.publishMenuSchedule(schedules[0].menuScheduleId, 'Tự động xuất bản sau khi nhập');
        } catch (cause) {
          if (alive.current) setPublicationWarning(`Đã nhập, chưa công bố. ${cause instanceof Error ? cause.message : 'Không thể công bố thực đơn.'}`);
        }
      }
      return accepted;
    } catch (cause) {
      if (alive.current) {
        if (cause instanceof TypeError) {
          setUnknownOutcome(true);
          setError('Chưa xác nhận được kết quả lưu. Hãy kiểm tra lịch sử trước khi nhập lại.');
        } else setError(cause instanceof Error ? cause.message : 'Không thể lưu thực đơn tuần.');
      }
      return null;
    } finally {
      busy.current = false;
      if (alive.current) setIsCommitting(false);
    }
  };

  return {
    items, results, publicationWarning, error, isCommitting, pendingPreviews,
    addFiles, updateItem, removeItem, previewItem, commitItems, validScope, setScopeIntent, enableWeekChange, chooseDraft, loadDraftPage,
    hasAllPreviews: items.every(item => item.preview !== null),
    canCommit: !isCommitting && !pendingPreviews && !unknownOutcome && !results.length && !(items.length > 1 && items.some(item => item.preview?.mrxDayOutcomes?.length)) && !hasDuplicateScope(items) && items.every(validPreview),
    duplicateScope: hasDuplicateScope(items),
  };
}
