import { Link } from 'react-router-dom'
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
      <section className="ipc-dashboard-incident" aria-labelledby="reconciliation-dashboard-title">
        <div className="ipc-dashboard-incident-main">
          <div className="ipc-dashboard-incident-copy">
            <h2 id="reconciliation-dashboard-title">Luồng vận hành hiện tại</h2>
            <p>Mỗi bước sử dụng cùng một lô định lượng; chỉ Kho được ghi nhận số đã xuất và biến động tồn kho.</p>
          </div>
          <StatusBadge variant="success">Chế độ đối chiếu</StatusBadge>
        </div>
      </section>

      <section className="ipc-dashboard-section" aria-labelledby="reconciliation-workflow-title">
        <div className="ipc-dashboard-section-heading">
          <div><h2 id="reconciliation-workflow-title">Các bước cần thực hiện</h2><p>Thực hiện lần lượt để tránh dùng sai nguồn dữ liệu.</p></div>
        </div>
        <div className="ipc-dashboard-gates">
          {steps.map((step) => (
            <Link key={step.order} to={step.route} className="ipc-dashboard-gate">
              <span className="ipc-dashboard-gate-order">{step.order}</span>
              <span className="ipc-dashboard-gate-copy"><strong>{step.title}</strong><small>{step.description}</small></span>
              <span className="ipc-dashboard-gate-next">Mở bước</span>
            </Link>
          ))}
        </div>
      </section>

    </OperationalFrame>
  )
}
