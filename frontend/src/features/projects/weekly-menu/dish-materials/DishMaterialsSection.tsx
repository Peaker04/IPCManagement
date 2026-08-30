import { useMemo, useState } from 'react'
import { Search, Scale, Utensils } from 'lucide-react'
import { ContextStrip, InlineAlert, SectionPanel, TableViewport } from '@/components/common'
import { formatCurrency, formatDateOnly, formatPercent, formatQuantity } from '@/lib/formatters'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { DishMaterialsWorkflow } from './useDishMaterials'

const EMPTY_DISH_VALUE = '__empty-dish__'

const normalizeDishSearch = (value: string) => value
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/đ/g, 'd')
  .replace(/Đ/g, 'D')
  .toLocaleLowerCase('vi-VN')
  .trim()

const DishMaterialsSection = ({ workflow }: { workflow: DishMaterialsWorkflow }) => {
  const [dishSearch, setDishSearch] = useState('')
  const { actions, presentation } = workflow
  const { analyzedDish, foodCostPercent, ingredients, totalTrayCost, grossProfit } = presentation
  const analyzedDishLabel = analyzedDish
    ? `${analyzedDish.name}${presentation.weeklyPlanCatalogDishIds.has(analyzedDish.id) ? ' - trong KH tuần' : ''}`
    : presentation.isCatalogEmpty ? 'Chưa có catalog' : 'Chọn món'
  const filteredDishesByShift = useMemo(() => {
    const needle = normalizeDishSearch(dishSearch)
    if (!needle) return presentation.dishesByShift
    const matches = (dish: { name: string }) => normalizeDishSearch(dish.name).includes(needle)
    return {
      morning: presentation.dishesByShift.morning.filter(matches),
      afternoon: presentation.dishesByShift.afternoon.filter(matches),
    }
  }, [dishSearch, presentation.dishesByShift])
  const hasSearchResults = filteredDishesByShift.morning.length + filteredDishesByShift.afternoon.length > 0
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
        <div className="ipc-fiori-command-actions">
          <label className="ipc-fiori-field is-wide">
            <span>Chọn món</span>
            <Select
              value={analyzedDish?.id ?? EMPTY_DISH_VALUE}
              onValueChange={(value) => actions.selectDish(value === EMPTY_DISH_VALUE || value === null ? '' : value)}
              disabled={presentation.isCatalogEmpty}
            >
              <SelectTrigger className="w-full"><SelectValue>{analyzedDishLabel}</SelectValue></SelectTrigger>
              <SelectContent>
                {filteredDishesByShift.morning.length > 0 && <SelectGroup>
                  <SelectLabel>Ca Sáng</SelectLabel>
                  {filteredDishesByShift.morning.map((dish, index) => <SelectItem key={`morning-${dish.id}-${index}`} value={dish.id}>{dish.name}{presentation.weeklyPlanCatalogDishIds.has(dish.id) ? ' - trong KH tuần' : ''}</SelectItem>)}
                </SelectGroup>}
                {filteredDishesByShift.afternoon.length > 0 && <SelectGroup>
                  <SelectLabel>Ca Chiều</SelectLabel>
                  {filteredDishesByShift.afternoon.map((dish, index) => <SelectItem key={`afternoon-${dish.id}-${index}`} value={dish.id}>{dish.name}{presentation.weeklyPlanCatalogDishIds.has(dish.id) ? ' - trong KH tuần' : ''}</SelectItem>)}
                </SelectGroup>}
                {!presentation.isCatalogEmpty && !hasSearchResults && <SelectItem value="__no-search-result__" disabled>Không tìm thấy món phù hợp</SelectItem>}
                {presentation.isCatalogEmpty && <SelectItem value={EMPTY_DISH_VALUE}>Chưa có ngân hàng món ăn</SelectItem>}
              </SelectContent>
            </Select>
          </label>
          <label className="ipc-fiori-field">
            <span>Tìm món ăn</span>
            <span className="relative block">
              <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 z-10 size-4 -translate-y-1/2 text-slate-400" />
              <Input value={dishSearch} onChange={(event) => setDishSearch(event.target.value)} placeholder="Nhập tên món" aria-label="Tìm món ăn" className="pl-9" disabled={presentation.isCatalogEmpty} />
            </span>
          </label>
        </div>
      </section>
      <ContextStrip items={[
        { label: 'Nguồn tính', value: presentation.sourceLabel, tone: 'neutral' },
        { label: 'Đơn giá bán/suất', value: formatCurrency(presentation.menuPrice), tone: 'neutral' },
        { label: 'Giá vốn / khay', value: formatCurrency(Math.round(totalTrayCost)), tone: 'info' },
        { label: 'Tỷ lệ giá vốn (Food Cost %)', value: formatPercent(foodCostPercent, 1), tone: foodCostPercent > 85 ? 'danger' : foodCostPercent > 70 ? 'warning' : 'neutral' },
        { label: 'Lợi nhuận gộp dự kiến', value: formatCurrency(Math.round(grossProfit)), tone: grossProfit >= 0 ? 'neutral' : 'danger' },
      ]} />
      <TableViewport caption="Giá vốn nguyên liệu cho một khay" size="weekly" className="ipc-cost-table-shell" ariaLabel="Bảng giá vốn nguyên liệu một khay">
        <table className="ipc-erp-grid-table w-full">
          <thead><tr>
            <th style={{ width: '28%' }} className="sticky top-0 z-10 text-left whitespace-nowrap">Nguyên liệu</th>
            <th style={{ width: '16%' }} className="sticky top-0 z-10 text-center whitespace-nowrap">Đơn vị</th>
            <th style={{ width: '18%' }} className="sticky top-0 z-10 text-right whitespace-nowrap">Định lượng / suất</th>
            <th style={{ width: '18%' }} className="sticky top-0 z-10 text-right whitespace-nowrap">Đơn giá</th>
            <th style={{ width: '20%' }} className="sticky top-0 z-10 text-right whitespace-nowrap">Thành tiền / khay</th>
          </tr></thead>
          <tbody>
            {ingredients.map((ingredient) => (
              <tr key={ingredient.key}>
                <td className="text-left font-medium text-slate-900">{ingredient.name}</td>
                <td className="text-center text-slate-600">{ingredient.unit}</td>
                <td className="text-right tabular-nums">{formatQuantity(ingredient.actualQty, { maximumFractionDigits: 3 })}</td>
                <td className="text-right tabular-nums">{formatCurrency(ingredient.supplierPrice)}</td>
                <td className="text-right tabular-nums font-semibold text-slate-900">{formatCurrency(Math.round(ingredient.cost))}</td>
              </tr>
            ))}
            {ingredients.length === 0 && <tr><td className="p-4 text-center text-sm text-slate-500" colSpan={5}>Chưa có BOM phù hợp khách hàng, định mức và ngày áp dụng cho món đang chọn.</td></tr>}
          </tbody>
        </table>
      </TableViewport>
      </div>
    </SectionPanel>
  </>
}

export default DishMaterialsSection
