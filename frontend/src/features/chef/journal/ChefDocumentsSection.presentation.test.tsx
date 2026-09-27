import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ToastProvider } from '@/components/common/ToastProvider'
import { ChefDocumentsSection } from './ChefDocumentsSection'

describe('Chef document movement presentation', () => {
  it('names the kitchen shift movement grain without changing document identity', () => {
    render(<ToastProvider><ChefDocumentsSection documents={[]} movements={[{
      id: 'movement-1', type: 'issue', documentNo: 'inventoryissue-001', material: 'Gạo', quantity: 2,
      unit: 'kg', owner: 'Bếp', status: 'Đã xuất', nextAction: 'Đối chiếu', tone: 'success',
    }]} /></ToastProvider>)
    const region = screen.getByRole('region', { name: 'Luân chuyển kho của bếp trong ca' })
    expect(region).toHaveAccessibleDescription('Bút toán nhập, xuất và trả kho theo chứng từ và nguyên liệu của ca bếp')
    expect(screen.getByRole('button', { name: /Sao chép mã chứng từ inventoryissue-001/ })).toBeInTheDocument()
    expect(screen.getAllByRole('columnheader').every((header) => header.getAttribute('scope') === 'col')).toBe(true)
  })
})
