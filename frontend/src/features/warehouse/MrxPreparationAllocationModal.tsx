import { Button } from '../../components/ui/button';
import { Modal } from '../../components/ui/modal';
import { Num } from '../../components/ui/num';
import { IdentifierText } from '../../components/ui/identifier-text';
import { toVietnameseDate } from '../../utils/dates';
import type { MrxFilteredPreparationLine } from './branches/MrxPrepAllocationsBranch';

export function MrxPreparationAllocationModal({ line, serviceDate, wholeWeek, onClose }: {
  line: MrxFilteredPreparationLine | null; serviceDate: string; wholeWeek: boolean; onClose: () => void;
}) {
  const grouped = new Map<string, { batchId: string; customerName: string; customerCode: string; quantity: number }>();
  for (const allocation of line?.allocations ?? []) {
    const existing = grouped.get(allocation.batchId);
    if (existing) existing.quantity += allocation.requiredQuantity;
    else grouped.set(allocation.batchId, { batchId: allocation.batchId, customerName: allocation.customerName || 'Chưa xác định khách hàng', customerCode: allocation.customerCode || '', quantity: allocation.requiredQuantity });
  }
  const end = new Date(`${serviceDate}T00:00:00Z`);
  end.setUTCDate(end.getUTCDate() + 5);
  const scope = wholeWeek ? `${toVietnameseDate(serviceDate)} – ${toVietnameseDate(end.toISOString().slice(0, 10))}` : toVietnameseDate(serviceDate);
  return <Modal isOpen={Boolean(line)} onClose={onClose} title={`Phân bổ nguyên liệu · ${line?.ingredientName ?? ''}`} description={scope} maxWidth="max-w-3xl" footer={<Button variant="outline" onClick={onClose}>Đóng</Button>}>
    {line && <div className="mrx-prep-detail">
      <p>Tổng cần chuẩn bị: <Num value={line.filteredRequired} decimals={6} /> {line.canonicalUnitName}</p>
      <table className="mrx-prep-allocations" aria-label="Phân bổ theo khách hàng và lô">
        <thead><tr><th>Khách hàng</th><th>Lô nguồn</th><th>Cần chuẩn bị ({line.canonicalUnitName || 'ĐVT'})</th></tr></thead>
        <tbody>{[...grouped.values()].filter(row => row.quantity > 0).map(row => <tr key={row.batchId}>
          <th scope="row">{row.customerCode && `${row.customerCode} · `}{row.customerName}</th>
          <td data-label="Lô nguồn"><IdentifierText value={row.batchId} displayValue={row.batchId.length > 20 ? `${row.batchId.slice(0, 8)}…${row.batchId.slice(-8)}` : row.batchId} /></td>
          <td data-label={`Cần chuẩn bị (${line.canonicalUnitName || 'ĐVT'})`}><Num value={row.quantity} decimals={6} /></td>
        </tr>)}</tbody>
      </table>
    </div>}
  </Modal>;
}
