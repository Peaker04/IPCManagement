import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { OrderStatusBanner } from './order-status-banner'

describe('OrderStatusBanner', () => {
  it.each([
    ['syncing', 'Đang đồng bộ trạng thái đơn'],
    ['empty', 'Chưa có kế hoạch suất ăn'],
    ['MIXED', 'Trạng thái kế hoạch chưa đồng nhất'],
    ['CONFIRMED', 'Ca này đã khóa'],
    ['locked', 'Ca này đã khóa'],
    ['ADJUSTED', 'Ca này đã khóa và có điều chỉnh'],
    ['COMPLETED', 'Ca này đã hoàn tất'],
    ['ARCHIVED', 'Dữ liệu đã lưu trữ'],
    ['CANCELLED', 'Kế hoạch đã hủy'],
    ['DRAFT', 'Dữ liệu đang ở trạng thái nháp'],
    ['FORECASTED', 'Dữ liệu đang ở trạng thái nháp'],
  ])('renders the correct message for %s', (status, title) => {
    render(<OrderStatusBanner status={status} />)
    expect(screen.getByText(title, { exact: true })).toBeVisible()
  })
})
