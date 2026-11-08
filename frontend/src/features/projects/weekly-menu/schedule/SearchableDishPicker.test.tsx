import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { SearchableDishPicker } from './SearchableDishPicker'

const dishes = [
  { id: '1', name: 'Đậu hũ kho nấm', code: 'MON-001', bomReady: true },
  { id: '2', name: 'Bún bò Huế', code: 'MON-002', bomReady: false },
]

describe('SearchableDishPicker', () => {
  it('searches accent-insensitively while presenting only dish names', () => {
    const onChange = vi.fn()
    render(<SearchableDishPicker value="1" options={dishes} label="Tìm món thứ Hai" onChange={onChange} />)
    const input = screen.getByRole('combobox', { name: 'Tìm món thứ Hai' })
    fireEvent.focus(input)
    fireEvent.change(input, { target: { value: 'dau hu' } })
    expect(screen.getByRole('option', { name: 'Đậu hũ kho nấm' })).toBeInTheDocument()
    expect(screen.queryByText('MON-001')).not.toBeInTheDocument()
    expect(screen.queryByText('Đủ BOM')).not.toBeInTheDocument()
    expect(screen.queryByText('Bún bò Huế')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('option'))
    expect(onChange).toHaveBeenCalledWith('1')
  })

  it('selects the sole result with Enter and reports no results', () => {
    const onChange = vi.fn()
    render(<SearchableDishPicker value="" options={dishes} label="Tìm món" onChange={onChange} />)
    const input = screen.getByRole('combobox', { name: 'Tìm món' })
    fireEvent.focus(input)
    fireEvent.change(input, { target: { value: 'MON-002' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(onChange).toHaveBeenCalledWith('2')
    fireEvent.focus(input)
    fireEvent.change(input, { target: { value: 'không tồn tại' } })
    expect(screen.getByText('Không tìm thấy món phù hợp')).toBeInTheDocument()
  })

  it('shows a bounded task-first suggestion set instead of dumping the catalog', () => {
    const manyDishes = Array.from({ length: 30 }, (_, index) => ({ id: String(index), name: `Món ${index}`, code: `MON-${index}`, bomReady: index % 2 === 0 }))
    render(<SearchableDishPicker value="1" options={manyDishes} label="Tìm món" onChange={vi.fn()} />)
    fireEvent.focus(screen.getByRole('combobox', { name: 'Tìm món' }))
    expect(screen.getAllByRole('option')).toHaveLength(6)
    expect(screen.getByRole('listbox')).toHaveClass('fixed')
    expect(screen.getByText('Chọn món ăn')).toBeInTheDocument()
  })

  it('supports arrow navigation and Enter across multiple results', () => {
    const onChange = vi.fn()
    render(<SearchableDishPicker value="" options={dishes} label="Tìm món" onChange={onChange} />)
    const input = screen.getByRole('combobox', { name: 'Tìm món' })
    fireEvent.focus(input)
    fireEvent.change(input, { target: { value: 'MON' } })
    fireEvent.keyDown(input, { key: 'ArrowDown' })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(onChange).toHaveBeenCalledWith('2')
  })

  it('closes on Escape without mutation', () => {
    const onChange = vi.fn()
    render(<SearchableDishPicker value="1" options={dishes} label="Tìm món" onChange={onChange} />)
    const input = screen.getByRole('combobox', { name: 'Tìm món' })
    fireEvent.focus(input)
    fireEvent.change(input, { target: { value: 'bún' } })
    fireEvent.keyDown(input, { key: 'Escape' })
    expect(input).toHaveAttribute('aria-expanded', 'false')
    expect(onChange).not.toHaveBeenCalled()
  })
})
