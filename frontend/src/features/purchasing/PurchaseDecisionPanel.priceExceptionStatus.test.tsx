import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { PurchaseWorkbenchServiceDate } from '@/api/workflowApiTypes';
import { PriceExceptionStatus } from './PurchaseDecisionPanel';

const serviceDate = (blockingExceptionCount: number): PurchaseWorkbenchServiceDate => ({
  serviceDate: '2026-07-20',
  scope: 'FULLDAY',
  currentStage: 'exception',
  approvedDemandCount: 1,
  shortageLineCount: 1,
  supplierReadyLineCount: 1,
  blockingExceptionCount,
  orderCount: 0,
  receivingLineCount: 0,
  fullyReceivedLineCount: 0,
  approvedDemands: [],
  purchaseLines: [],
});

describe('PriceExceptionStatus', () => {
  it('keeps the service-date zero-blocker fact without a duplicate normal-success badge', () => {
    render(<PriceExceptionStatus serviceDate={serviceDate(0)} />);

    expect(screen.getByText('Không còn ngoại lệ giá chặn ngày phục vụ này.')).toBeInTheDocument();
    expect(screen.queryByText('Đủ căn cứ')).not.toBeInTheDocument();
  });

  it('keeps the blocking count and action-needed status when exceptions remain', () => {
    render(<PriceExceptionStatus serviceDate={serviceDate(2)} />);

    expect(screen.getByText('2 ngoại lệ đang chặn đề xuất mua.')).toBeInTheDocument();
    expect(screen.getByText('Cần xử lý')).toBeInTheDocument();
  });
});
