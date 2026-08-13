import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { Input } from './input'

describe('Vietnamese shared date input', () => {
  it('shows Vietnamese date text while preserving ISO change values', () => {
    const onChange = vi.fn()
    render(<Input type="date" value="2026-08-10" onChange={onChange} aria-label="Tuần bắt đầu" />)

    const input = screen.getByRole('textbox', { name: 'Tuần bắt đầu' })
    expect(input).toHaveValue('10/08/2026')
    expect(input).toHaveAttribute('data-date-locale', 'vi-VN')
    fireEvent.change(input, { target: { value: '17/08/2026' } })
    fireEvent.blur(input)
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ target: { value: '2026-08-17' } }))
  })

  it('uses Vietnamese calendar labels', async () => {
    render(<Input type="date" value="2026-08-10" onChange={vi.fn()} aria-label="Tuần bắt đầu" />)
    fireEvent.click(screen.getByRole('button', { name: 'Mở lịch chọn ngày' }))

    expect(await screen.findByRole('dialog', { name: 'Lịch chọn ngày' })).toHaveTextContent('Tháng 8 năm 2026')
    expect(screen.getByRole('button', { name: 'Hôm nay' })).toBeInTheDocument()
    expect(screen.getByText('CN')).toBeInTheDocument()
  })

  it('normalizes a Sunday to the following Monday for week-start fields', () => {
    const onChange = vi.fn()
    render(<Input type="date" weekStartOnly value="2026-08-10" onChange={onChange} aria-label="Tuần bắt đầu" />)

    const input = screen.getByRole('textbox', { name: 'Tuần bắt đầu' })
    fireEvent.change(input, { target: { value: '09/08/2026' } })
    fireEvent.blur(input)

    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ target: { value: '2026-08-10' } }))
  })
})
