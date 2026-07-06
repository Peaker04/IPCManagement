import { Link } from 'react-router-dom'
import { ArrowLeft, ShieldAlert } from 'lucide-react'
import { SectionPanel } from '@/components/common'
import { ROUTES } from '../../../routes/routeConfig'

const ForbiddenPage = () => {
  return (
    <SectionPanel className="mx-auto max-w-2xl border-slate-200 bg-white">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
        <div className="flex size-12 shrink-0 items-center justify-center rounded-md border border-rose-100 bg-rose-50 text-rose-700">
          <ShieldAlert className="size-6" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-rose-700">403</p>
          <h1 className="mt-1 text-xl font-semibold text-slate-900">Không đủ quyền truy cập</h1>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Tài khoản hiện tại chưa được cấp quyền vào phân hệ này. Vui lòng quay về màn tổng quan hoặc liên hệ quản trị nếu cần mở quyền.
          </p>
          <Link to={ROUTES.DASHBOARD} className="ipc-button ipc-button-primary mt-5 inline-flex w-fit items-center gap-2">
            <ArrowLeft className="size-4" />
            Về tổng quan
          </Link>
        </div>
      </div>
    </SectionPanel>
  )
}

export default ForbiddenPage
