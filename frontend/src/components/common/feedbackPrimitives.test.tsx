import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ActionAvailability, DisabledReason } from './ActionAvailability';
import { PageBanner } from './PageBanner';
import { DiagnosticPanel } from './DiagnosticPanel';
import { MetricCard } from './MetricCard';

describe('feedback & status primitives', () => {
  describe('ActionAvailability', () => {
    it('renders disabled reason peacefully without error alerts', () => {
      render(<ActionAvailability reason="Chưa có nhu cầu đủ điều kiện để tạo phiếu xuất kho." />);
      const note = screen.getByRole('note');
      expect(note).toHaveTextContent('Chưa có nhu cầu đủ điều kiện để tạo phiếu xuất kho.');
    });

    it('supports DisabledReason alias', () => {
      render(<DisabledReason reason="Tài khoản chưa được kích hoạt" />);
      expect(screen.getByText('Tài khoản chưa được kích hoạt')).toBeInTheDocument();
    });

    it('returns null when reason is empty', () => {
      const { container } = render(<ActionAvailability reason={null} />);
      expect(container.firstChild).toBeNull();
    });
  });

  describe('PageBanner', () => {
    it('renders full-width status banner with accessible role', () => {
      render(<PageBanner title="Ca này đã khóa" detail="Điều chỉnh sau chốt cần ghi lý do." tone="info" />);
      const banner = screen.getByRole('status');
      expect(banner).toHaveTextContent('Ca này đã khóa');
      expect(banner).toHaveTextContent('Điều chỉnh sau chốt cần ghi lý do.');
    });

    it('switches to alert role when tone is danger', () => {
      render(<PageBanner title="Hệ thống đang bảo trì" tone="danger" />);
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });
  });

  describe('DiagnosticPanel', () => {
    it('renders expandable diagnostic section for technical details', () => {
      render(<DiagnosticPanel technicalCode="ERR_DB_LOCK" details="Deadlock detected in transaction" />);
      expect(screen.getByText('ERR_DB_LOCK')).toBeInTheDocument();
      expect(screen.getByText('Deadlock detected in transaction')).toBeInTheDocument();
    });

    it('returns null when no technical details exist', () => {
      const { container } = render(<DiagnosticPanel details="" />);
      expect(container.firstChild).toBeNull();
    });
  });

  describe('MetricCard', () => {
    it('renders KPI metric clearly without using status badges', () => {
      render(<MetricCard label="Tổng suất ăn" value={150} helper="Theo kế hoạch ca" tone="info" />);
      expect(screen.getByText('Tổng suất ăn')).toBeInTheDocument();
      expect(screen.getByText('150')).toBeInTheDocument();
      expect(screen.getByText('Theo kế hoạch ca')).toBeInTheDocument();
    });
  });
});
