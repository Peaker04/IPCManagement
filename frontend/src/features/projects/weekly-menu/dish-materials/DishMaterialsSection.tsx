import { Scale } from 'lucide-react'
import { ContextStrip, InlineAlert, SectionPanel, TableViewport } from '@/components/common'
import { formatCurrency } from '@/lib/formatters'
import type { DishMaterialsWorkflow } from './useDishMaterials'

const tableHeadClass = 'text-center'
const tableCellClass = 'text-center'

const DishMaterialsSection = ({ workflow }: { workflow: DishMaterialsWorkflow }) => {
  const { actions, presentation } = workflow
  const { analyzedDish, foodCostPercent, ingredients, totalTrayCost, grossProfit } = presentation
  return <>
    {foodCostPercent > 85 && <InlineAlert title="Cảnh báo: Tỷ lệ giá vốn (Food Cost %) vượt ngưỡng quy định!" variant="danger" className="mb-4">
      Tỉ lệ giá vốn hiện tại đạt <b>{foodCostPercent.toFixed(1)}%</b>, vượt ngưỡng an toàn tối đa (85%). Kiểm tra lại BOM theo tier, giá nguyên liệu hoặc đơn giá bán suất ăn của ca này.
    </InlineAlert>}
    <SectionPanel
      title="Nguyên liệu món phân tích"
      icon={<Scale size={18} color="var(--ipc-slate-600)" />}
      badge={<div className="flex items-center gap-2">
        <span className="text-[13px] font-medium text-slate-600 whitespace-nowrap">Món phân tích:</span>
        <select value={analyzedDish?.id ?? ''} onChange={(event) => actions.selectDish(event.target.value)} className="ipc-select w-[280px] text-[13.5px]" disabled={presentation.isCatalogEmpty}>
          <optgroup label="Ca Sáng">{presentation.dishesByShift.morning.map((dish, index) => <option key={`morning-${dish.id}-${index}`} value={dish.id}>{dish.name}{presentation.weeklyPlanCatalogDishIds.has(dish.id) ? ' - trong KH tuần' : ''}</option>)}</optgroup>
          <optgroup label="Ca Chiều">{presentation.dishesByShift.afternoon.map((dish, index) => <option key={`afternoon-${dish.id}-${index}`} value={dish.id}>{dish.name}{presentation.weeklyPlanCatalogDishIds.has(dish.id) ? ' - trong KH tuần' : ''}</option>)}</optgroup>
          {presentation.isCatalogEmpty && <option value="">Chưa có catalog</option>}
        </select>
      </div>}
    >
      <div className="mb-6 mt-4"><ContextStrip items={[
        { label: 'Nguồn tính', value: presentation.sourceLabel, tone: 'neutral' },
        { label: 'Món trong kế hoạch', value: analyzedDish?.name ?? 'Chưa chọn', tone: analyzedDish ? 'info' : 'neutral' },
        { label: 'Đơn giá bán/suất', value: formatCurrency(presentation.menuPrice), tone: 'neutral' },
        { label: 'Giá vốn nguyên liệu / khay', value: formatCurrency(Math.round(totalTrayCost)), tone: 'info' },
        { label: 'Tỷ lệ giá vốn (Food Cost %)', value: `${foodCostPercent.toFixed(1)}%`, tone: foodCostPercent > 85 ? 'danger' : foodCostPercent > 70 ? 'warning' : 'success' },
        { label: 'Lợi nhuận gộp / khay (Dự kiến)', value: formatCurrency(Math.round(grossProfit)), tone: grossProfit >= 0 ? 'success' : 'danger' },
      ]} /></div>
      <TableViewport caption="Giá vốn nguyên liệu cho một khay" className="ipc-cost-table-shell h-[560px] max-h-[560px]" ariaLabel="Bảng giá vốn nguyên liệu một khay">
        <table className="ipc-data-table ipc-cost-table">
          <thead><tr>{['Nguyên liệu', 'ĐV', 'LT / suất', 'TT / suất', 'Món trong kế hoạch', 'Đơn giá', 'Thành tiền / khay'].map((label) => <th key={label} className={`${tableHeadClass} sticky top-0 z-10 bg-slate-100 ${label === 'Nguyên liệu' || label === 'Món trong kế hoạch' ? 'text-left' : ''}`}>{label}</th>)}</tr></thead>
          <tbody>
            {ingredients.map((ingredient) => <tr key={ingredient.name} className="table-row">
              <td className={`${tableCellClass} text-left font-bold`}>{ingredient.name}</td><td className={tableCellClass}>{ingredient.unit}</td><td className={tableCellClass}>{ingredient.theoryQty.toFixed(3)}</td>
              <td className={`${tableCellClass} font-bold text-blue-600`}>{ingredient.actualQty.toFixed(3)}</td><td className={`${tableCellClass} text-left font-medium text-slate-800`}>{analyzedDish?.name ?? 'Chưa chọn'}</td>
              <td className={tableCellClass}>{formatCurrency(ingredient.supplierPrice)}</td><td className={`${tableCellClass} font-bold text-slate-950`}>{formatCurrency(Math.round(ingredient.cost))}</td>
            </tr>)}
            {ingredients.length === 0 && <tr><td className="p-4 text-center text-sm text-slate-500" colSpan={7}>Chưa có nguyên liệu cho món đang chọn.</td></tr>}
          </tbody>
        </table>
      </TableViewport>
    </SectionPanel>
  </>
}

export default DishMaterialsSection
