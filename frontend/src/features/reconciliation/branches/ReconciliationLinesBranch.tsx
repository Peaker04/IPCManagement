import { useState, useMemo, type ReactNode } from 'react';
import { StateBoundary, type StateBoundaryProps } from '../../../components/workbench/StateBoundary';
import { DataGrid } from '../../../components/workbench/DataGrid';
import { ReconciliationLinesFilterToolbar, type LineStatusFilter } from '../ReconciliationLinesFilterToolbar';
import { ReconciliationDispositionModal } from '../ReconciliationDispositionModal';
import { ReconciliationLineDetailModal } from '../../../components/workbench/ReconciliationLineDetailModal';
import { useReconciliationColumns } from '../reconciliationColumns';
import type { ReconciliationLineItem } from '../../../api/mrxApi';
import { normalizeSearchText } from '../../../utils/search';

export interface ReconciliationLinesBranchProps {
  resolvedBatchId?: string;
  bodyState: Omit<StateBoundaryProps, 'children'>;
  hasBatch: boolean;
  dayNavigation: ReactNode;
  lines: ReconciliationLineItem[];
  statusLabels: Record<string, string>;
  isCompleted?: boolean;
  onReloadData: () => void | Promise<void>;
  statusFilter: LineStatusFilter;
  onStatusFilterChange: (status: LineStatusFilter) => void;
}

export function ReconciliationLinesBranch({
  resolvedBatchId,
  bodyState,
  hasBatch,
  dayNavigation,
  lines,
  statusLabels,
  isCompleted = false,
  onReloadData,
  statusFilter,
  onStatusFilterChange,
}: ReconciliationLinesBranchProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [localBatchId, setLocalBatchId] = useState(resolvedBatchId);
  const [selectedDispositionLine, setSelectedDispositionLine] = useState<ReconciliationLineItem | null>(null);
  const [bulkLines, setBulkLines] = useState<ReconciliationLineItem[] | null>(null);
  const [inspectedDetailLine, setInspectedDetailLine] = useState<ReconciliationLineItem | null>(null);
  if (resolvedBatchId !== undefined && resolvedBatchId !== localBatchId) {
    setLocalBatchId(resolvedBatchId);
    if (localBatchId !== undefined) {
      setSearchTerm('');
      setIsSearchOpen(false);
      setSelectedDispositionLine(null);
      setBulkLines(null);
      setInspectedDetailLine(null);
    }
  }

  const needsReviewCount = useMemo(
    () => lines.filter((l) => (l.issuedRequiredDifference ?? 0) > 0 && !l.disposition).length,
    [lines]
  );
  const disposedCount = useMemo(
    () => lines.filter((l) => Boolean(l.disposition)).length,
    [lines]
  );
  const matchedCount = useMemo(
    () => lines.filter((l) => l.issuedRequiredDifference === 0).length,
    [lines]
  );

  const filteredLines = useMemo(() => {
    return lines.filter((line) => {
      if (statusFilter === 'NEEDS_REVIEW' && ((line.issuedRequiredDifference ?? 0) <= 0 || Boolean(line.disposition))) {
        return false;
      }
      if (statusFilter === 'DISPOSED' && !line.disposition) return false;
      if (statusFilter === 'MATCHED' && line.issuedRequiredDifference !== 0) return false;
      if (searchTerm.trim()) {
        const query = normalizeSearchText(searchTerm);
        if (
          !normalizeSearchText(line.materialName).includes(query) &&
          !normalizeSearchText(line.materialCode).includes(query)
        ) {
          return false;
        }
      }
      return true;
    });
  }, [lines, statusFilter, searchTerm]);

  const columns = useReconciliationColumns({
    statusLabels,
    isCompleted,
    onSelectDispositionLine: (line) => {
      setBulkLines(null);
      setSelectedDispositionLine(line);
    },
    onSelectDetailLine: (line) => setInspectedDetailLine(line),
  });

  const isBlocked = Boolean(bodyState.isForbidden || bodyState.isModeConflict || bodyState.isConflict);
  const isPending = Boolean(bodyState.isPreviousData || bodyState.isLoading);

  return (
    <div className="flex-1 min-h-0 flex flex-col h-full bg-white">
      {hasBatch && !isBlocked && <ReconciliationLinesFilterToolbar
        isSearchOpen={isSearchOpen}
        onSearchOpenChange={setIsSearchOpen}
        isPending={isPending}
        dayNavigation={dayNavigation}
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        statusFilter={statusFilter}
        onStatusFilterChange={onStatusFilterChange}
        totalCount={lines.length}
        visibleCount={filteredLines.length}
        onClear={() => { setSearchTerm(''); onStatusFilterChange('ALL'); }}
        needsReviewCount={needsReviewCount}
        disposedCount={disposedCount}
        matchedCount={matchedCount}
        onBulkDisposition={
          needsReviewCount > 1 && !isPending
            ? () => {
                const unresolved = lines.filter(
                  (l) => (l.issuedRequiredDifference ?? 0) > 0 && !l.disposition
                );
                if (unresolved.length > 0) {
                  setBulkLines(unresolved);
                  setSelectedDispositionLine(unresolved[0]);
                }
              }
            : undefined
        }
      />}
      <StateBoundary {...bodyState}>
      <DataGrid
        data={filteredLines}
        columns={columns}
        keyExtractor={(row) => row.id || row.materialCode}
        minWidth="min-w-[1140px]"
        emptyMessage="Không có dòng đối soát nào phù hợp với bộ lọc."
      />
      </StateBoundary>

      <ReconciliationDispositionModal
        key={selectedDispositionLine?.materialCode ?? (bulkLines ? 'bulk' : 'empty')}
        selectedLine={selectedDispositionLine}
        selectedLines={bulkLines ?? undefined}
        isOpen={hasBatch && !isBlocked && !isPending && Boolean(selectedDispositionLine || bulkLines)}
        onClose={() => {
          setSelectedDispositionLine(null);
          setBulkLines(null);
        }}
        onSaved={async () => {
          await onReloadData();
        }}
        isCompleted={isCompleted}
      />

      <ReconciliationLineDetailModal
        isOpen={hasBatch && !isBlocked && !isPending && Boolean(inspectedDetailLine)}
        onClose={() => setInspectedDetailLine(null)}
        line={inspectedDetailLine}
        isCompleted={isCompleted}
        statusLabels={statusLabels}
        onOpenDisposition={(line) => {
          setBulkLines(null);
          setSelectedDispositionLine(line);
        }}
      />
    </div>
  );
}
