import { SideRail } from '@/components/common'
import type { ExcessMaterial } from '@/lib/types'

type Props = { returns: ExcessMaterial[] }

export function ShiftJournal({ returns }: Props) {
  return (
    <SideRail title="Nhật ký hoạt động ca" description="Các phiếu trả và hao hụt đã ghi nhận trong ngày, ca đang chọn.">
      {returns.length === 0 ? (
        <div className="rounded-md border border-dashed border-slate-300 bg-slate-50 p-3 text-sm text-slate-500">
          Chưa có ngoại lệ nào được ghi nhận trong ca này.
        </div>
      ) : returns.map((item, index) => (
        <div key={`${item.ingredientId}-${item.returnedAt ?? index}`} className="rounded-md border border-slate-200 bg-white p-3 text-sm text-slate-700">
          <div className="font-bold text-slate-900">Ghi nhận nguyên liệu thừa</div>
          <div className="mt-1 text-slate-600">{item.ingredientName}: {item.returnedQty} {item.unit}</div>
        </div>
      ))}
    </SideRail>
  )
}
