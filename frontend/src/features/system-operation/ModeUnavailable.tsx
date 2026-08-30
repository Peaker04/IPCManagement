import { ShieldAlert, ArrowLeft } from 'lucide-react'
import { Link } from 'react-router-dom'
import { ROUTES } from '@/lib/routeConfig'
import { typography } from '@/lib/typography'

export function ModeUnavailable() {
  return (
    <section className="ipc-operational-frame flex flex-col items-center justify-center p-12 text-center" role="status" aria-label="Chức năng không khả dụng">
      <div className="rounded-full bg-amber-50 p-4 text-amber-600 ring-8 ring-amber-50/50 mb-4">
        <ShieldAlert size={32} />
      </div>
      <h2 className={`${typography.pageTitle} font-semibold text-slate-900 mb-2`}>
        Chức năng không khả dụng
      </h2>
      <p className={`${typography.body} text-slate-600 max-w-md mb-6`}>
        Chức năng này tạm thời không sử dụng khi hệ thống đang ở chế độ <strong>Đối chiếu nguyên liệu</strong>.
      </p>
      <Link
        to={ROUTES.DASHBOARD}
        className="ipc-button ipc-button-primary inline-flex items-center gap-2"
      >
        <ArrowLeft size={16} />
        <span>Về bàn điều hành</span>
      </Link>
    </section>
  )
}
