import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, it, vi } from 'vitest'
import { WeeklyScheduleCommandBar } from './WeeklyScheduleCommandBar'

it('owns the Schedule import, edit, and guarded publish commands', async () => {
  const user = userEvent.setup()
  const onImport = vi.fn()
  const onEdit = vi.fn()
  const onPublish = vi.fn()
  render(<WeeklyScheduleCommandBar
    customers={[]}
    selectedCustomerId=""
    weekStartDate="2026-08-03"
    isCustomerLoading={false}
    isImporting={false}
    canPublish
    isPublishing={false}
    onImport={onImport}
    onEdit={onEdit}
    onPublish={onPublish}
    onCustomerChange={vi.fn()}
    onWeekChange={vi.fn()}
  />)

  await user.click(screen.getByRole('button', { name: 'Nhập Excel' }))
  await user.click(screen.getByRole('button', { name: 'Chỉnh sửa lịch tuần' }))
  await user.click(screen.getByRole('button', { name: 'Xuất bản tuần' }))

  expect(onImport).toHaveBeenCalledOnce()
  expect(onEdit).toHaveBeenCalledOnce()
  expect(onPublish).toHaveBeenCalledOnce()
  expect(screen.queryByRole('button', { name: 'Xuất báo cáo gửi kho' })).not.toBeInTheDocument()
})
