import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ApprovalQueue } from './ApprovalQueue';
import { DocumentRail } from './DocumentRail';
import { RoleInbox } from './RoleInbox';
import { StockMovementTable } from './StockMovementTable';
import { ToastProvider } from './ToastProvider';
import type { ApprovalRecord, RoleInboxItem, StockMovement, WorkflowDocument } from '@/features/workflow';

const roleInboxItems: RoleInboxItem[] = Array.from({ length: 5 }, (_, index) => ({
  id: `task-${index + 1}`,
  laneId: 'warehouse',
  owner: index === 4 ? 'Thủ kho trang 2' : 'Thủ kho',
  title: `Việc ${index + 1}`,
  description: `Mô tả ${index + 1}`,
  due: `Hôm nay ${index + 1}`,
  nextAction: 'PENDING',
  tone: index === 1 ? 'warning' : 'neutral',
  route: '/warehouse',
}));

const buildApproval = (id: string, title: string, slaDeadline?: string): ApprovalRecord => ({
  id,
  type: 'purchase',
  title,
  source: 'PR-001',
  owner: 'Quản lý',
  submittedBy: 'Thu mua',
  deadline: 'Hôm nay',
  status: 'PENDING',
  reason: 'Vượt ngưỡng',
  nextAction: 'Duyệt',
  tone: 'warning',
  slaDeadline,
  materials: [{ name: 'Gạo', quantity: 12.5, unit: 'kilogram' }],
});

const movements: StockMovement[] = [
  {
    id: 'm1',
    type: 'receipt',
    documentNo: 'inventoryreceipt-20260710-001',
    material: 'Gạo tẻ',
    quantity: 50,
    beforeQty: 10,
    afterQty: 60,
    unit: 'kilogram',
    owner: 'Thủ kho',
    status: 'RECEIVED',
    nextAction: 'PENDING',
    tone: 'success',
  },
  {
    id: 'm2',
    type: 'issue',
    documentNo: 'inventoryissue-20260710-001',
    material: 'Thịt gà',
    quantity: 20,
    unit: 'kg',
    owner: 'Thủ kho',
    status: 'Đã xuất',
    nextAction: 'Bếp nhận',
    tone: 'neutral',
  },
];

const documents: WorkflowDocument[] = [{
  id: 'KHSX-20260710-001',
  type: 'KHSX',
  title: 'Kế hoạch sản xuất',
  status: 'PENDING',
  owner: 'Bếp trưởng',
  summary: 'Đang chờ xác nhận',
  route: '/chef-dashboard',
  lines: [{ label: 'Số suất', value: '100' }],
  tone: 'warning',
}];

describe('RoleInbox', () => {
  it('renders configured empty state', () => {
    render(<RoleInbox items={[]} emptyText="Không có việc" />);

    expect(screen.getByText('Không có việc')).toBeInTheDocument();
  });

  it('paginates role work and renders action cells only when configured', async () => {
    render(
      <RoleInbox
        items={roleInboxItems}
        pageSize={4}
        actionForItem={(item) => <button type="button">{item.nextAction}</button>}
      />,
    );

    expect(screen.getByText('Việc 1')).toBeInTheDocument();
    expect(screen.getAllByText('Đang chờ xử lý')).toHaveLength(4);
    expect(screen.queryByText('Việc 5')).not.toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Đang chờ xử lý' })).toHaveLength(4);

    await userEvent.click(screen.getByRole('button', { name: /Trang sau/i }));

    expect(screen.getByText('Việc 5')).toBeInTheDocument();
    expect(screen.queryByText('Việc 1')).not.toBeInTheDocument();
  });
});

describe('ApprovalQueue', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders empty state when no approval records exist', () => {
    render(<ApprovalQueue records={[]} />);

    expect(screen.getByText('Chưa có dữ liệu để hiển thị')).toBeInTheDocument();
  });

  it('renders SLA overdue and upcoming branches', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-10T08:00:00+07:00'));

    render(
      <ApprovalQueue
        records={[
          buildApproval('a1', 'Đơn mua quá hạn', '2026-07-10T07:00:00+07:00'),
          buildApproval('a2', 'Đơn mua sắp hạn', '2026-07-10T10:30:00+07:00'),
        ]}
        pageSize={2}
        actionForRecord={(record) => <button type="button">Duyệt {record.title}</button>}
      />,
    );

    expect(screen.getByText('Đơn mua quá hạn')).toBeInTheDocument();
    expect(screen.getByText('Thời hạn xử lý: Quá hạn')).toBeInTheDocument();
    expect(screen.getByText('Thời hạn xử lý: 2g 30p')).toBeInTheDocument();
    expect(screen.getAllByText('Đang chờ xử lý')).toHaveLength(2);
    expect(screen.getByRole('button', { name: 'Duyệt Đơn mua quá hạn' })).toBeInTheDocument();
  });

  it('translates technical next-action values before rendering them', () => {
    render(
      <ApprovalQueue
        records={[{ ...buildApproval('a3', 'Đơn mua cần xử lý'), nextAction: 'PENDING' }]}
        pageSize={1}
      />,
    );

    const nextAction = document.querySelector('.ipc-approval-record-action');
    expect(nextAction).toHaveTextContent('Đang chờ xử lý');
    expect(nextAction).not.toHaveTextContent('PENDING');
    expect(screen.queryByText('PENDING')).not.toBeInTheDocument();
  });
});

describe('DocumentRail', () => {
  it('renders owner metadata with valid description-list semantics', () => {
    render(
      <ToastProvider>
        <DocumentRail documents={documents} />
      </ToastProvider>,
    );

    const ownerTerm = screen.getByText('Người phụ trách');
    expect(ownerTerm.closest('dl')).toHaveClass('ipc-document-zone-owner');
    expect(ownerTerm.tagName).toBe('DT');
    const ownerDefinition = screen.getByText('Bếp trưởng');
    expect(ownerDefinition.tagName).toBe('DD');
    expect(ownerDefinition.closest('dl')).toHaveClass('ipc-document-zone-owner');
  });
});

describe('StockMovementTable', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders empty state without rows', () => {
    render(
      <ToastProvider>
        <StockMovementTable movements={[]} />
      </ToastProvider>,
    );

    expect(screen.getByText('Chưa có dữ liệu để hiển thị')).toBeInTheDocument();
  });

  it('shortens known document numbers, paginates rows, and copies full document number', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });

    render(
      <ToastProvider>
        <StockMovementTable movements={movements} pageSize={1} />
      </ToastProvider>,
    );

    expect(screen.getByText('IR-20260710-001')).toBeInTheDocument();
    expect(screen.getByText('Gạo tẻ')).toBeInTheDocument();
    expect(screen.getByText('Đã nhận đủ')).toBeInTheDocument();
    expect(screen.getByText('Đang chờ xử lý')).toBeInTheDocument();
    expect(screen.queryByText('Thịt gà')).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /Sao chép mã chứng từ inventoryreceipt-20260710-001/i }));
    expect(writeText).toHaveBeenCalledWith('inventoryreceipt-20260710-001');
    expect(screen.getByText('Đã sao chép mã chứng từ')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Sao chép mã chứng từ inventoryreceipt-20260710-001/i })).toBeInTheDocument();
    });

    await userEvent.click(screen.getByRole('button', { name: /Trang sau/i }));

    expect(screen.getByText('II-20260710-001')).toBeInTheDocument();
    expect(screen.getByText('Thịt gà')).toBeInTheDocument();
  });

  it('shows contextual feedback when clipboard access fails', async () => {
    const writeText = vi.fn().mockRejectedValue(new Error('clipboard denied'));
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });

    render(
      <ToastProvider>
        <StockMovementTable movements={movements.slice(0, 1)} />
      </ToastProvider>,
    );

    await userEvent.click(screen.getByRole('button', { name: /Sao chép mã chứng từ inventoryreceipt-20260710-001/i }));

    expect(screen.getByText('Không thể sao chép mã chứng từ')).toBeInTheDocument();
  });

  it('supports a server cursor controller without adding local pagination', async () => {
    const onNext = vi.fn();
    const onPrevious = vi.fn();

    render(
      <ToastProvider>
        <StockMovementTable
          movements={movements.slice(0, 1)}
          cursorPagination={{ page: 2, hasNext: true, onNext, onPrevious }}
        />
      </ToastProvider>,
    );

    expect(screen.getByText('Trang 2, tải theo cursor')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Trang sau/i })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /Trang sau/i }));
    await userEvent.click(screen.getByRole('button', { name: /Trang trước/i }));
    expect(onNext).toHaveBeenCalledOnce();
    expect(onPrevious).toHaveBeenCalledOnce();
  });
});
