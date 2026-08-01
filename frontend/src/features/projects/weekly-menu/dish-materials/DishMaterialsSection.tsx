import { Scale, Utensils } from 'lucide-react'
import { ContextStrip, InlineAlert, SectionPanel, TableViewport } from '@/components/common'
import { formatCurrency, formatDateOnly, formatPercent, formatQuantity } from '@/lib/formatters'
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { DishMaterialsWorkflow } from './useDishMaterials'

const tableHeadClass = 'text-center'
const tableCellClass = 'text-center'
const EMPTY_DISH_VALUE = '__empty-dish__'

const DishMaterialsSection = ({ workflow }: { workflow: DishMaterialsWorkflow }) => {
  const { actions, presentation } = workflow
  const { analyzedDish, foodCostPercent, ingredients, totalTrayCost, grossProfit } = presentation
  const analyzedDishLabel = analyzedDish
    ? `${analyzedDish.name}${presentation.weeklyPlanCatalogDishIds.has(analyzedDish.id) ? ' - trong KH tuần' : ''}`
    : presentation.isCatalogEmpty ? 'Chưa có catalog' : 'Chọn món'
  return <>
    {foodCostPercent > 85 && <InlineAlert title="Cảnh báo: Tỷ lệ giá vốn (Food Cost %) vượt ngưỡng quy định!" variant="danger" className="mb-4">
      Tỉ lệ giá vốn hiện tại đạt <b>{formatPercent(foodCostPercent, 1)}</b>, vượt ngưỡng an toàn tối đa (85%). Kiểm tra lại BOM theo tier, giá nguyên liệu hoặc đơn giá bán suất ăn của ca này.
    </InlineAlert>}
    <SectionPanel title="Phân tích nguyên liệu món" headingLevel={2} icon={<Scale size={18} color="var(--ipc-slate-600)" />}>
      <div className="flex flex-col gap-3">
      <section className="ipc-fiori-command" aria-label="Món đang phân tích">
        <div className="ipc-fiori-object">
          <Utensils size={18} aria-hidden="true" />
          <div>
            <span>Món phân tích</span>
            <strong>{analyzedDish?.name ?? 'Chưa chọn món'}</strong>
            <small>Áp dụng BOM ngày {formatDateOnly(presentation.serviceDate)} · {ingredients.length} nguyên liệu</small>
          </div>
        </div>
        <label className="ipc-fiori-field is-wide">
          <span>Chọn món</span>
          <Select
            value={analyzedDish?.id ?? EMPTY_DISH_VALUE}
            onValueChange={(value) => actions.selectDish(value === EMPTY_DISH_VALUE || value === null ? '' : value)}
            disabled={presentation.isCatalogEmpty}
          >
            <SelectTrigger className="w-full"><SelectValue>{analyzedDishLabel}</SelectValue></SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectLabel>Ca Sáng</SelectLabel>
                {presentation.dishesByShift.morning.map((dish, index) => <SelectItem key={`morning-${dish.id}-${index}`} value={dish.id}>{dish.name}{presentation.weeklyPlanCatalogDishIds.has(dish.id) ? ' - trong KH tuần' : ''}</SelectItem>)}
              </SelectGroup>
              <SelectGroup>
                <SelectLabel>Ca Chiều</SelectLabel>
                {presentation.dishesByShift.afternoon.map((dish, index) => <SelectItem key={`afternoon-${dish.id}-${index}`} value={dish.id}>{dish.name}{presentation.weeklyPlanCatalogDishIds.has(dish.id) ? ' - trong KH tuần' : ''}</SelectItem>)}
              </SelectGroup>
              {presentation.isCatalogEmpty && <SelectItem value={EMPTY_DISH_VALUE}>Chưa có catalog</SelectItem>}
            </SelectContent>
          </Select>
        </label>
      </section>
      <ContextStrip items={[
        { label: 'Nguồn tính', value: presentation.sourceLabel, tone: 'neutral' },
        { label: 'Đơn giá bán/suất', value: formatCurrency(presentation.menuPrice), tone: 'neutral' },
        { label: 'Giá vốn / khay', value: formatCurrency(Math.round(totalTrayCost)), tone: 'info' },
        { label: 'Tỷ lệ giá vốn (Food Cost %)', value: formatPercent(foodCostPercent, 1), tone: foodCostPercent > 85 ? 'danger' : foodCostPercent > 70 ? 'warning' : 'neutral' },
        { label: 'Lợi nhuận gộp dự kiến', value: formatCurrency(Math.round(grossProfit)), tone: grossProfit >= 0 ? 'neutral' : 'danger' },
      ]} />
      <TableViewport caption="Giá vốn nguyên liệu cho một khay" size="weekly" className="ipc-cost-table-shell" ariaLabel="Bảng giá vốn nguyên liệu một khay">
        <table className="ipc-data-table ipc-cost-table table-fixed w-full">
          <thead><tr>
            <th style={{ width: '28%' }} className={`${tableHeadClass} sticky top-0 z-10 bg-slate-100 text-left`}>Nguyên liệu</th>
            <th style={{ width: '16%' }} className={`${tableHeadClass} sticky top-0 z-10 bg-slate-100`}>Đơn vị</th>
            <th style={{ width: '18%' }} className={`${tableHeadClass} sticky top-0 z-10 bg-slate-100`}>Định lượng / suất</th>
            <th style={{ width: '18%' }} className={`${tableHeadClass} sticky top-0 z-10 bg-slate-100`}>Đơn giá</th>
            <th style={{ width: '20%' }} className={`${tableHeadClass} sticky top-0 z-10 bg-slate-100`}>Thành tiền / khay</th>
          </tr></thead>
          <tbody>
            {ingredients.map((ingredient) => <tr key={ingredient.key} className="table-row">
              <td className={`${tableCellClass} text-left font-bold`}>{ingredient.name}</td><td className={tableCellClass}>{ingredient.unit}</td>
              <td className={`${tableCellClass} font-semibold text-[var(--ipc-primary-600)]`}>{formatQuantity(ingredient.actualQty, { maximumFractionDigits: 3 })}</td>
              <td className={tableCellClass}>{formatCurrency(ingredient.supplierPrice)}</td><td className={`${tableCellClass} font-bold text-slate-950`}>{formatCurrency(Math.round(ingredient.cost))}</td>
            </tr>)}
            {ingredients.length === 0 && <tr><td className="p-4 text-center text-sm text-slate-500" colSpan={5}>Chưa có BOM phù hợp khách hàng, định mức và ngày áp dụng cho món đang chọn.</td></tr>}
          </tbody>
        </table>
      </TableViewport>
      </div>
    </SectionPanel>
  </>
}

export default DishMaterialsSection
