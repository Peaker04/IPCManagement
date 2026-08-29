import { Link } from 'react-router-dom'
import { ArrowRight, CheckCircle2 } from 'lucide-react'
import { CommandBar, OperationalFrame, StatusBadge } from '@/components/common'
import { ROUTES } from '@/lib/routeConfig'

const steps = [
  { order: '01', title: 'Kế hoạch tuần', description: 'Chọn khách hàng và tuần thực đơn.', route: ROUTES.WEEKLY_MENU },
  { order: '02', title: 'Định lượng xuất kho', description: 'Kiểm tra định lượng và chuyển danh sách đã chốt sang Kho.', route: `${ROUTES.WEEKLY_MENU}?view=demand` },
  { order: '03', title: 'Kho xuất thực tế', description: 'Lập phiếu xuất từ đúng lô đã chuyển và ghi nhận bút toán tồn kho.', route: ROUTES.WAREHOUSE },
  { order: '04', title: 'Đối chiếu', description: 'So sánh số cần xuất với số Kho đã xuất và xử lý sai lệch.', route: ROUTES.RECONCILIATION },
] as const

export function ReconciliationDashboardPage() {
  return (
    <OperationalFrame
      className="ipc-dashboard-frame"
      command={
        <CommandBar
          className="ipc-dashboard-command-bar"
          actions={<Link to={ROUTES.WEEKLY_MENU} className="ipc-button ipc-button-primary">Bắt đầu từ Thực đơn tuần</Link>}
        >
          <div className="ipc-dashboard-command-main"><span>Quy trình đối chiếu nguyên liệu khép kín</span></div>
        </CommandBar>
      }
    >
      <section className="rounded-md border border-slate-200 bg-white p-4" aria-labelledby="reconciliation-workflow-title">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 pb-3">
          <div>
            <h2 id="reconciliation-workflow-title" className="text-base font-bold text-slate-900">Quy trình 4 bước</h2>
            <p className="mt-1 text-sm text-slate-600">Đi theo một chiều từ kế hoạch đến xử lý sai lệch.</p>
          </div>
          <StatusBadge variant="success"><CheckCircle2 size={14} /> Chế độ đối chiếu</StatusBadge>
        </div>
        <ol className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-4" aria-label="Các bước đối chiếu nguyên liệu">
          {steps.map((step) => (
            <li key={step.order} className="min-w-0">
              <Link to={step.route} className="group flex h-full min-h-28 flex-col rounded-md border border-slate-200 bg-slate-50 p-3 text-left no-underline transition-colors hover:border-blue-300 hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">
                <span className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold text-blue-700">BƯỚC {step.order}</span>
                  <ArrowRight size={16} className="text-slate-400 transition-transform group-hover:translate-x-0.5 group-hover:text-blue-700" aria-hidden="true" />
                </span>
                <strong className="mt-2 text-sm font-bold text-slate-900">{step.title}</strong>
                <span className="mt-1 text-xs leading-5 text-slate-600">{step.description}</span>
              </Link>
            </li>
          ))}
        </ol>
      </section>

    </OperationalFrame>
  )
}
