import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { WeeklyMenuPricingContext } from './WeeklyMenuPricingContext'

describe('WeeklyMenuPricingContext normal-status presentation', () => {
  it('keeps the applied tier and source without repeating a normal status badge', () => {
    const { rerender } = render(<WeeklyMenuPricingContext menuPrice={30000} menuPriceSource="Lịch menu" />)

    expect(screen.getByText('30k')).toBeInTheDocument()
    expect(screen.getByText('Lịch menu')).toBeInTheDocument()
    expect(screen.queryByText('Đang dùng')).not.toBeInTheDocument()

    rerender(<WeeklyMenuPricingContext menuPrice={0} menuPriceSource="Mặc định" />)
    expect(screen.getByText('Chưa cấu hình')).toBeInTheDocument()
  })
})
