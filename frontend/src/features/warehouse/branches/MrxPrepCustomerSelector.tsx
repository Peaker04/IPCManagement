import { useRef, useState } from 'react';
import { Popover } from '@base-ui/react/popover';
import { ChevronDown } from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { Checkbox } from '../../../components/ui/checkbox';
import { Input } from '../../../components/ui/input';
import { Badge } from '../../../components/ui/badge';
import { Num } from '../../../components/ui/num';
import { normalizeSearchText } from '../../../utils/search';
import type { MrxPreparation } from '../../../api/mrxApi';

interface MrxPrepCustomerSelectorProps {
  batches: MrxPreparation['batches'];
  selectedBatchIds: string[];
  scopeLocked: boolean;
  onToggleBatch: (batchId: string) => void;
}

export function MrxPrepCustomerSelector({ batches, selectedBatchIds, scopeLocked, onToggleBatch }: MrxPrepCustomerSelectorProps) {
  const searchRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const selected = batches.filter(batch => selectedBatchIds.includes(batch.batchId));
  const summary = selected.length === 1 ? selected[0].customerName || selected[0].customerCode || 'Khách hàng đã chọn'
    : selected.length ? `${selected.length} lô đã chọn` : 'Chọn khách hàng';
  const query = normalizeSearchText(search);
  const visible = batches.filter(batch => normalizeSearchText(`${batch.customerName ?? ''} ${batch.customerCode ?? ''}`).includes(query));
  return <Popover.Root modal={false} open={open} onOpenChange={next => { setOpen(next); if (!next) setSearch(''); }}>
    <Popover.Trigger disabled={scopeLocked} render={<Button variant="outline" className="h-9 w-64 max-w-full justify-start gap-2 sm:w-72" />} aria-label={`Khách hàng: ${summary}`}>
      <span className="shrink-0">Khách hàng</span>
      <span className="min-w-0 flex-1 truncate text-left">{summary}</span>
      <span className="shrink-0 text-xs"><Num value={selected.length} />/<Num value={batches.length} /></span>
      <ChevronDown size={16} aria-hidden="true" className="shrink-0" />
    </Popover.Trigger>
    <Popover.Portal>
      <Popover.Positioner sideOffset={4} align="start" className="z-50">
        <Popover.Popup initialFocus={searchRef} className="w-96 max-w-[calc(100vw-2rem)] rounded border border-slate-200 bg-white text-slate-900">
          <div className="p-3 border-b border-slate-200 space-y-2">
            <Popover.Title className="text-sm font-semibold">Chọn khách hàng / lô chuẩn bị</Popover.Title>
            <Input ref={searchRef} type="search" aria-label="Tìm khách hàng hoặc mã" placeholder="Tìm tên hoặc mã khách hàng…" value={search} onChange={event => setSearch(event.target.value)} />
          </div>
          <fieldset className="max-h-72 overflow-y-auto p-2">
            <legend className="sr-only">Các lô trong phạm vi chuẩn bị</legend>
            {visible.map(batch => <label key={batch.batchId} className="flex min-h-10 items-center gap-2 rounded px-2 py-1 text-xs hover:bg-slate-50">
              <Checkbox checked={selectedBatchIds.includes(batch.batchId)} onChange={() => onToggleBatch(batch.batchId)} disabled={scopeLocked} />
              <span className="min-w-0 flex-1 break-words">{batch.customerName || batch.customerCode || 'Khách hàng chưa có tên'}
                {batches.filter(other => other.customerId === batch.customerId).length > 1 && <span className="block text-slate-500">Lô <Num value={batches.indexOf(batch) + 1} /></span>}
              </span>
              <Badge size="sm" variant={batch.hasExistingIssue ? 'success' : batch.isApplicable ? 'neutral' : 'warning'}>{batch.hasExistingIssue ? 'Đã xuất' : batch.isApplicable ? 'Đã chuyển kho' : batch.batchStatus === 'COMPLETED' ? 'Đã hoàn tất' : 'Chưa chuyển kho'}</Badge>
            </label>)}
            {!visible.length && <p role="status" className="p-3 text-xs text-slate-600">Không có khách hàng phù hợp.</p>}
          </fieldset>
        </Popover.Popup>
      </Popover.Positioner>
    </Popover.Portal>
  </Popover.Root>;
}
