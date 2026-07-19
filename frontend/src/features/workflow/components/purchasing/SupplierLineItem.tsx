import { useState } from 'react'
import { useToast } from '@/components/common'
import {
  useGetSupplierQuotationsByIngredientQuery,
  useUpdatePurchaseRequestLineSupplierMutation,
  type DemandLine,
  type SupplierDto,
} from '@/features/workflow'

interface SupplierLineItemProps {
  line: DemandLine
  suppliers: SupplierDto[]
  onUpdate: ReturnType<typeof useUpdatePurchaseRequestLineSupplierMutation>[0]
}

export function SupplierLineItem({ line, suppliers, onUpdate }: SupplierLineItemProps) {
  const { toast } = useToast()
  const [selectedSupplierId, setSelectedSupplierId] = useState(line.supplierId ?? '')
  const [estimatedPrice, setEstimatedPrice] = useState<number>(line.estimatedUnitPrice ?? 0)
  const [expectedDeliveryDate, setExpectedDeliveryDate] = useState(line.expectedDeliveryDate ?? '')
  const [note, setNote] = useState(line.note ?? '')
  const [isUpdating, setIsUpdating] = useState(false)
  const { data: quotations = [] } = useGetSupplierQuotationsByIngredientQuery(line.ingredientId ?? '', { skip: !line.ingredientId })
  const bestQuotation = quotations.find((quotation) => quotation.isBestPrice)

  const handleSupplierChange = (supplierId: string) => {
    setSelectedSupplierId(supplierId)
    const matched = quotations.find((quotation) => quotation.supplierId === supplierId && quotation.isActive)
    if (matched) setEstimatedPrice(matched.unitPrice)
  }

  const handleSave = async () => {
    if (!line.purchaseRequestId || !line.purchaseRequestLineId || !selectedSupplierId) {
      toast({ title: 'Thiếu nhà cung cấp', description: 'Vui lòng chọn nhà cung cấp cho dòng mua này.', variant: 'warning' })
      return
    }
    if (!estimatedPrice || estimatedPrice <= 0) {
      toast({ title: 'Giá dự kiến chưa hợp lệ', description: 'Vui lòng nhập giá lớn hơn 0.', variant: 'warning' })
      return
    }

    setIsUpdating(true)
    try {
      await onUpdate({
        purchaseRequestId: line.purchaseRequestId,
        purchaseRequestLineId: line.purchaseRequestLineId,
        data: {
          supplierId: selectedSupplierId,
          estimatedUnitPrice: estimatedPrice,
          expectedDeliveryDate: expectedDeliveryDate || null,
          note: note.trim() || null,
        },
      }).unwrap()
      toast({ title: 'Đã cập nhật nhà cung cấp', variant: 'success' })
    } catch (error) {
      const message = (error as { data?: { message?: string }; message?: string })?.data?.message
        ?? (error as { message?: string })?.message
        ?? 'Đã xảy ra lỗi không xác định.'
      toast({ title: 'Chưa thể cập nhật nhà cung cấp', description: message, variant: 'danger', durationMs: 0 })
    } finally {
      setIsUpdating(false)
    }
  }

  return (
    <tr>
      <td className="text-slate-500 font-mono text-sm">{line.sourceDocumentCode}</td>
      <td className="font-medium text-slate-800">{line.material}</td>
      <td className="text-right">{line.reserved} <span className="text-slate-500">{line.unit}</span></td>
      <td>
        <select className="ipc-input w-full" aria-label={`Nhà cung cấp cho ${line.material}`} aria-required="true" value={selectedSupplierId} onChange={(event) => handleSupplierChange(event.target.value)}>
          <option value="">Chọn nhà cung cấp</option>
          {suppliers.map((supplier) => <option key={supplier.supplierId} value={supplier.supplierId}>{supplier.supplierName}</option>)}
        </select>
        {bestQuotation && bestQuotation.supplierId !== selectedSupplierId && (
          <div className="text-xs text-emerald-600 mt-1" role="status" aria-live="polite">
            Giá tham khảo tốt nhất: {bestQuotation.supplierName}, {bestQuotation.unitPrice.toLocaleString('vi-VN')} đồng
          </div>
        )}
      </td>
      <td><input type="number" className="ipc-input w-full" aria-label={`Giá dự kiến cho ${line.material}`} placeholder="Ví dụ: 150000" min="0" step="1000" inputMode="decimal" value={estimatedPrice || ''} onChange={(event) => setEstimatedPrice(Number(event.target.value))} /></td>
      <td><input type="date" className="ipc-input w-full" aria-label={`Ngày giao dự kiến cho ${line.material}`} value={expectedDeliveryDate} onChange={(event) => setExpectedDeliveryDate(event.target.value)} /></td>
      <td><input className="ipc-input w-full" aria-label={`Ghi chú cho ${line.material}`} placeholder="Ghi chú thêm (không bắt buộc)" value={note} onChange={(event) => setNote(event.target.value)} /></td>
      <td><button className="ipc-button ipc-button-primary" onClick={handleSave} disabled={isUpdating}>{isUpdating ? 'Đang lưu...' : 'Lưu nhà cung cấp'}</button></td>
    </tr>
  )
}
