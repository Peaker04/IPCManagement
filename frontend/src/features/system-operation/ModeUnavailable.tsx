import { ArrowLeft, ShieldAlert } from 'lucide-react'
import { Link } from 'react-router-dom'
import { ROUTES } from '@/lib/routeConfig'
import { typography } from '@/lib/typography'

export function ModeUnavailable() {
  return (
    <section
      className="ipc-operational-frame flex flex-col items-center justify-center p-12 text-center"
      role="status"
      aria-label="Chức năng không khả dụng"
    >
      <div className="mb-4 rounded-full bg-amber-50 p-4 text-amber-600 ring-8 ring-amber-50/50" aria-hidden="true">
        <ShieldAlert size={32} />
      </div>
      <h2 className={`${typography.pageTitle} mb-2 text-slate-900`}>
        Chức năng không khả dụng
      </h2>
      <p className={`${typography.body} mb-6 max-w-md text-slate-600`}>
        Chức năng này tạm thời không sử dụng khi hệ thống đang ở chế độ{' '}
        <strong>Đối chiếu nguyên liệu</strong>.
      </p>
      <Link to={ROUTES.DASHBOARD} className="ipc-button ipc-button-primary inline-flex items-center gap-2">
        <ArrowLeft size={16} aria-hidden="true" />
        <span>Về bàn điều hành</span>
      </Link>
    </section>
  )
}
