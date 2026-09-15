import { render, waitFor } from '@testing-library/react'
import { MemoryRouter, Navigate, Route, Routes, useNavigate } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { ROUTES } from '@/lib/routeConfig'
import { RouteDocumentTitle } from './RouteDocumentTitle'
import { documentTitleForPath } from './routeTitles'

const expectedTitles = new Map<string, string>([
  [ROUTES.LOGIN, 'Đăng nhập · IPC Management'],
  [ROUTES.FORBIDDEN, 'Không đủ quyền truy cập · IPC Management'],
  [ROUTES.DASHBOARD, 'Bàn điều hành hôm nay · IPC Management'],
  [ROUTES.WEEKLY_MENU, 'Thực đơn tuần · IPC Management'],
  [ROUTES.REPORTS, 'Báo cáo vận hành · IPC Management'],
  [ROUTES.MEAL_ORDERS, 'Điều phối suất ăn · IPC Management'],
  [ROUTES.CHEF_DASHBOARD, 'Bếp sản xuất · IPC Management'],
  [ROUTES.APPROVALS, 'Duyệt vận hành · IPC Management'],
  [ROUTES.PURCHASING, 'Thu mua · IPC Management'],
  [ROUTES.WAREHOUSE, 'Kho nguyên liệu · IPC Management'],
  [ROUTES.RECONCILIATION, 'Đối chiếu nguyên liệu · IPC Management'],
  [ROUTES.ADMIN_DATA, 'Quản trị dữ liệu · IPC Management'],
  [ROUTES.APPROVAL_RULES, 'Thiết lập quy trình duyệt · IPC Management'],
  [ROUTES.ADVANCED_SETTINGS, 'Thiết lập nâng cao · IPC Management'],
])

function NavigateToReports() {
  const navigate = useNavigate()
  return <button onClick={() => navigate(ROUTES.REPORTS)}>Mở báo cáo</button>
}

describe('route document titles', () => {
  it('owns the exact title for every configured route and trailing-slash equivalent', () => {
    expect(expectedTitles.size).toBe(Object.values(ROUTES).length)
    for (const [path, title] of expectedTitles) {
      expect(documentTitleForPath(path)).toBe(title)
      if (path !== '/') expect(documentTitleForPath(`${path}/`)).toBe(title)
    }
  })

  it('updates the title when client-side navigation changes route', async () => {
    const { getByRole } = render(
      <MemoryRouter initialEntries={[ROUTES.WEEKLY_MENU]}>
        <RouteDocumentTitle />
        <NavigateToReports />
      </MemoryRouter>,
    )

    await waitFor(() => expect(document.title).toBe('Thực đơn tuần · IPC Management'))
    getByRole('button', { name: 'Mở báo cáo' }).click()
    await waitFor(() => expect(document.title).toBe('Báo cáo vận hành · IPC Management'))
  })

  it('finishes an unknown-route redirect with the dashboard title', async () => {
    render(
      <MemoryRouter initialEntries={['/missing']}>
        <RouteDocumentTitle />
        <Routes>
          <Route path={ROUTES.DASHBOARD} element={<p>Tổng quan</p>} />
          <Route path="*" element={<Navigate to={ROUTES.DASHBOARD} replace />} />
        </Routes>
      </MemoryRouter>,
    )

    await waitFor(() => expect(document.title).toBe('Bàn điều hành hôm nay · IPC Management'))
  })
})
