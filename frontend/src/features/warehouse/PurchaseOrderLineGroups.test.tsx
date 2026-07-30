import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { PurchaseOrderLineDto } from '@/api/workflowApi';
import { PurchaseOrderLineGroups } from './PurchaseOrderLineGroups';

const line = (id: string, orderedQty: number, receivedQty: number): PurchaseOrderLineDto => ({
  purchaseOrderLineId: id,
  purchaseRequestLineId: `request-${id}`,
  ingredientId: 'ingredient-1',
  ingredientName: 'Bún tươi',
  unitId: 'unit-1',
  unitName: 'kg',
  orderedQty,
  receivedQty,
  unitPrice: 9_500,
  lotNumberRequired: false,
  manufactureDateRequired: false,
  expiryDateRequired: false,
});

describe('PurchaseOrderLineGroups', () => {
  it('shows one ingredient group while retaining receipt actions for each source line', () => {
    const onReceive = vi.fn();
    render(<PurchaseOrderLineGroups lines={[line('line-1', 10, 2), line('line-2', 5, 0)]} canReceive onReceive={onReceive} />);

    expect(screen.getAllByText('Bún tươi')).toHaveLength(1);
    expect(screen.getByText('2/15 kg')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Xem 2 nguồn' }));
    expect(screen.getByText('line-1')).toBeInTheDocument();
    expect(screen.getByText('line-2')).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole('button', { name: 'Ghi nhận dòng này' })[1]);
    expect(onReceive).toHaveBeenCalledWith(expect.objectContaining({ purchaseOrderLineId: 'line-2' }));
  });
});
