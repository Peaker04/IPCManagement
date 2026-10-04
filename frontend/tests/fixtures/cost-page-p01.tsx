import { createRoot } from 'react-dom/client';
import '@/styles/index.css';
import '@/styles/components/operations.css';
import '@/styles/components/tables.css';
import { OperationalFrame } from '@/components/common/OperationalFrame';
import { CommandBar } from '@/components/common/CommandBar';
import { FieldRow } from '@/components/common/FieldRow';
import { ContextStrip } from '@/components/common/ContextStrip';
import { TableViewport } from '@/components/common/TableViewport';
import { Num } from '@/components/common/Num';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { buttonVariants } from '@/components/ui/button';
import { ChevronRight } from 'lucide-react';
import { typography } from '@/lib/typography';
import { SEMANTIC_ROLE_DEFINITIONS } from './specimens/TypographySpecimen';

// Specimen fixture data only: fixed presentation values, not source records or price authority.
const rows = [
  { id: 'a', dish: 'Thịt kho trứng — món mẫu A', slot: 'Món chính · phương án 1', shift: 'Trưa', portions: 500, unitCost: 7500, lineTotal: 3750000 },
  { id: 'b', dish: 'Đậu phụ sốt cà chua — món mẫu B', slot: 'Món phụ', shift: 'Trưa', portions: 500, unitCost: 2700, lineTotal: 1350000 },
  { id: 'c', dish: 'Rau cải xào — món mẫu C', slot: 'Rau', shift: 'Trưa', portions: 500, unitCost: 1000, lineTotal: 500000 },
  { id: 'd', dish: 'Canh bí xanh — món mẫu D', slot: 'Canh', shift: 'Trưa', portions: 500, unitCost: 800, lineTotal: 400000 },
  { id: 'e', dish: 'Chuối — món mẫu E', slot: 'Tráng miệng', shift: 'Trưa', portions: 500, unitCost: 500, lineTotal: 250000 },
  { id: 'f', dish: 'Cá sốt cà chua — món mẫu F', slot: 'Món chính · phương án 1', shift: 'Tối', portions: 120, unitCost: 7500, lineTotal: 900000 },
  { id: 'g', dish: 'Đậu phụ hấp — món mẫu G', slot: 'Món phụ', shift: 'Tối', portions: 200, unitCost: 2500, lineTotal: 500000 },
  { id: 'h', dish: 'Canh rau củ — món mẫu H', slot: 'Canh', shift: 'Tối', portions: 200, unitCost: 1800, lineTotal: 360000 },
];
const ingredients = [
  { name: 'Thịt heo — nguyên liệu mẫu', unit: 'kg', quantity: 45.625, sources: 'Món mẫu A' },
  { name: 'Đậu phụ — nguyên liệu mẫu', unit: 'kg', quantity: 42.125, sources: 'Món mẫu B, món mẫu G' },
  { name: 'Rau củ — nguyên liệu mẫu', unit: 'kg', quantity: 30.123456, sources: 'Món mẫu C, món mẫu D, món mẫu H' },
];

export function CostPageReference() {
  return (
    <main className="min-h-screen space-y-4 p-6" aria-label="COST-PAGE-P01 — visual reference">
      <header data-cost-zone="1" className="space-y-1">
        <h1 className={SEMANTIC_ROLE_DEFINITIONS.find((role) => role.tag === 'h1')!.cssClass}>Giá vốn tuần</h1>
        <p className={typography.caption}>Kế hoạch & Điều phối · Dự kiến theo BOM và giá tham chiếu; không phải chi phí thực tế.</p>
      </header>
      <OperationalFrame
        command={
          <div data-cost-zone="2">
            <CommandBar>
              <FieldRow label="Khách hàng" htmlFor="cost-reference-customer">
                <Select value="fixture-customer" items={[{ value: 'fixture-customer', label: 'Khách hàng mẫu — specimen' }]}>
                  <SelectTrigger id="cost-reference-customer"><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="fixture-customer">Khách hàng mẫu — specimen</SelectItem></SelectContent>
                </Select>
              </FieldRow>
              <FieldRow label="Tuần bắt đầu" htmlFor="cost-reference-week">
                <Input id="cost-reference-week" type="date" value="2026-09-28" readOnly />
              </FieldRow>
              <FieldRow label="Ngày xem" htmlFor="cost-reference-day">
                <Select value="2026-09-29" items={[{ value: '2026-09-29', label: 'Thứ Ba, 29/09/2026 — mẫu' }]}>
                  <SelectTrigger id="cost-reference-day"><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="2026-09-29">Thứ Ba, 29/09/2026 — mẫu</SelectItem></SelectContent>
                </Select>
              </FieldRow>
              <FieldRow label="Tier đã xác định" htmlFor="cost-reference-tier">
                <output id="cost-reference-tier" aria-label="Tier đã xác định" className={typography.body}>Tier nguồn — fixture</output>
              </FieldRow>
            </CommandBar>
          </div>
        }
        context={
          <div data-cost-zone="3">
            <ContextStrip items={[{ label: 'Giá vốn dự kiến ngày 29/09/2026', value: <Num value={8010000} type="currency" />, emphasis: 'quiet' }]} />
          </div>
        }
      >
        <section data-cost-zone="4" aria-label="Các dòng món của ngày đang xem">
          <TableViewport ariaLabel="Giá vốn theo dòng món — fixture" caption="Ngày 29/09/2026; số liệu dự kiến mẫu, không phải thực tế." size="default" density="compact">
            <table className="ipc-data-table">
              <caption className="sr-only">Giá vốn dự kiến theo dòng món — specimen fixture data</caption>
              <colgroup><col className="w-1/3" /><col /><col /><col /><col /><col /></colgroup>
              <thead><tr>
                <th scope="col">Món / vị trí</th>
                <th scope="col">Ca</th>
                <th scope="col">BOM</th>
                <th scope="col" data-cell-role="numeric">Suất</th>
                <th scope="col" data-cell-role="numeric">VND / suất</th>
                <th scope="col" data-cell-role="numeric">Thành tiền</th>
              </tr></thead>
              <tbody>{rows.map((row) => (
                <tr key={row.id}>
                  <td><strong>{row.dish}</strong><div className={typography.caption}>{row.slot}</div></td>
                  <td>{row.shift}</td>
                  <td>Có BOM</td>
                  <td data-cell-role="numeric"><Num value={row.portions} /></td>
                  <td data-cell-role="numeric"><Num value={row.unitCost} type="currency" /></td>
                  <td data-cell-role="numeric"><Num value={row.lineTotal} type="currency" /></td>
                </tr>
              ))}</tbody>
            </table>
          </TableViewport>
        </section>
        <details data-cost-zone="5" className="group mt-4">
          <summary className={buttonVariants({ variant: 'ghost', size: 'xs' })}>
            <ChevronRight className="size-4 group-open:rotate-90" aria-hidden="true" />
            Nguyên liệu dự kiến ngày 29/09/2026 — xem chi tiết
          </summary>
          <p className={typography.caption}>Lượng nguyên liệu dự kiến theo BOM; dữ liệu mẫu độc lập, không khẳng định bằng tổng dòng món.</p>
          <TableViewport ariaLabel="Nguyên liệu dự kiến — fixture" size="default" density="compact">
            <table className="ipc-data-table">
              <caption className="sr-only">Nguyên liệu dự kiến — specimen fixture data</caption>
              <thead><tr>
                <th scope="col">Nguyên liệu</th><th scope="col">Đơn vị</th>
                <th scope="col" data-cell-role="numeric">Lượng BOM dự kiến</th><th scope="col">Món nguồn</th>
              </tr></thead>
              <tbody>{ingredients.map((ingredient) => (
                <tr key={ingredient.name}>
                  <td>{ingredient.name}</td><td>{ingredient.unit}</td>
                  <td data-cell-role="numeric"><Num value={ingredient.quantity} type="quantity" maximumFractionDigits={6} /></td>
                  <td>{ingredient.sources}</td>
                </tr>
              ))}</tbody>
            </table>
          </TableViewport>
        </details>
      </OperationalFrame>
      <footer className={typography.caption} role="note">
        COST-PAGE-P01 · PROPOSED · Specimen fixture data — tên, ngày, tier và số liệu là dữ liệu mẫu, không phải dữ liệu nghiệp vụ.
      </footer>
    </main>
  );
}

createRoot(document.getElementById('root')!).render(<CostPageReference />);
