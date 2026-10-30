import { useState, useMemo } from 'react';
import { DataGrid } from '../../../components/workbench/DataGrid';
import { ReconciliationLinesFilterToolbar, type LineStatusFilter } from '../ReconciliationLinesFilterToolbar';
import { ReconciliationBlockerStrip } from '../ReconciliationBlockerStrip';
import { ReconciliationDispositionModal } from '../ReconciliationDispositionModal';
import { ReconciliationLineDetailModal } from '../../../components/workbench/ReconciliationLineDetailModal';
import { useReconciliationColumns } from '../reconciliationColumns';
import type { ReconciliationLineItem } from '../../../api/mrxApi';

export interface ReconciliationLinesBranchProps {
  lines: ReconciliationLineItem[];
  statusLabels: Record<string, string>;
  isCompleted?: boolean;
  onReloadData: () => void | Promise<void>;
  statusFilter: LineStatusFilter;
  onStatusFilterChange: (status: LineStatusFilter) => void;
  showBlocker?: boolean;
  onNavigateWarehouse?: () => void;
}

export function ReconciliationLinesBranch({
  lines,
  statusLabels,
  isCompleted = false,
  onReloadData,
  statusFilter,
  onStatusFilterChange,
  showBlocker = false,
  onNavigateWarehouse,
}: ReconciliationLinesBranchProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDispositionLine, setSelectedDispositionLine] = useState<ReconciliationLineItem | null>(null);
  const [bulkLines, setBulkLines] = useState<ReconciliationLineItem[] | null>(null);
  const [inspectedDetailLine, setInspectedDetailLine] = useState<ReconciliationLineItem | null>(null);

  const needsReviewCount = useMemo(
    () => lines.filter((l) => (l.issuedRequiredDifference ?? 0) !== 0 && !l.disposition).length,
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
      if (statusFilter === 'NEEDS_REVIEW' && ((line.issuedRequiredDifference ?? 0) === 0 || Boolean(line.disposition))) {
        return false;
      }
      if (statusFilter === 'DISPOSED' && !line.disposition) return false;
      if (statusFilter === 'MATCHED' && line.issuedRequiredDifference !== 0) return false;
      if (searchTerm.trim()) {
        const query = searchTerm.trim().toLowerCase();
        if (
          !line.materialName?.toLowerCase().includes(query) &&
          !line.materialCode?.toLowerCase().includes(query)
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

  return (
    <div className="flex-1 min-h-0 flex flex-col h-full bg-white animate-in fade-in duration-150 ease-out">
      {showBlocker && (
        <ReconciliationBlockerStrip
          needsReviewCount={needsReviewCount}
          onFilterNeedsReview={() => onStatusFilterChange('NEEDS_REVIEW')}
          onNavigateWarehouse={onNavigateWarehouse}
        />
      )}
      <ReconciliationLinesFilterToolbar
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        statusFilter={statusFilter}
        onStatusFilterChange={onStatusFilterChange}
        totalCount={lines.length}
        needsReviewCount={needsReviewCount}
        disposedCount={disposedCount}
        matchedCount={matchedCount}
        onBulkDisposition={
          needsReviewCount > 1
            ? () => {
                const unresolved = lines.filter(
                  (l) => (l.issuedRequiredDifference ?? 0) !== 0 && !l.disposition
                );
                if (unresolved.length > 0) {
                  setBulkLines(unresolved);
                  setSelectedDispositionLine(unresolved[0]);
                }
              }
            : undefined
        }
      />
      <DataGrid
        data={filteredLines}
        columns={columns}
        keyExtractor={(row) => row.id || row.materialCode}
        minWidth="min-w-[1140px]"
        emptyMessage="Không có dòng đối soát nào phù hợp với bộ lọc."
      />

      <ReconciliationDispositionModal
        key={selectedDispositionLine?.materialCode ?? (bulkLines ? 'bulk' : 'empty')}
        selectedLine={selectedDispositionLine}
        selectedLines={bulkLines ?? undefined}
        isOpen={Boolean(selectedDispositionLine || bulkLines)}
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
        isOpen={Boolean(inspectedDetailLine)}
        onClose={() => setInspectedDetailLine(null)}
        line={inspectedDetailLine}
      />
    </div>
  );
}
