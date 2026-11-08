import { EmptyState } from '@/components/common'
import type { ExcessMaterial } from '@/lib/types'

type Props = { returns: ExcessMaterial[] }

export function ShiftJournal({ returns }: Props) {
  return (
    <section aria-labelledby="chef-shift-journal-title" className="space-y-3">
      <div>
        <h3 id="chef-shift-journal-title" className="text-sm font-semibold text-slate-900">Nhật ký hoạt động ca</h3>
        <p className="mt-1 text-xs text-slate-600">Các phiếu trả và hao hụt trong ngày, ca đang chọn.</p>
      </div>
      {returns.length === 0 ? (
        <EmptyState
          title="Chưa có ngoại lệ trong ca này."
          className="!min-h-0 !items-stretch !justify-start !p-3 !text-left rounded-md border border-dashed border-slate-300 bg-slate-50"
        />
      ) : returns.map((item, index) => (
        <div key={`${item.ingredientId}-${item.returnedAt ?? index}`} className="rounded-md border border-slate-200 bg-white p-3 text-sm text-slate-700">
          <div className="font-bold text-slate-900">Ghi nhận nguyên liệu thừa</div>
          <div className="mt-1 text-slate-600">{item.ingredientName}: {item.returnedQty} {item.unit}</div>
        </div>
      ))}
    </section>
  )
}
