import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { SectionPanel } from '@/components/common';
import { WarehouseIssueCreationBlocker } from './WarehousePage';

describe('WarehousePage heading composition', () => {
  it('keeps the issue blocker visible as route-primary context before movement work surfaces', () => {
    const { container } = render(
      <>
        <WarehouseIssueCreationBlocker reason="Chưa có nhu cầu đã duyệt để xuất kho." />
        <SectionPanel title="Tồn kho hiện tại"><div /></SectionPanel>
        <SectionPanel title="Luân chuyển kho"><div /></SectionPanel>
      </>,
    );

    expect(screen.getByRole('heading', { level: 2, name: 'Không thể tạo phiếu xuất kho mới' })).toBeInTheDocument();
    expect(screen.getByText('Chưa có nhu cầu đã duyệt để xuất kho.')).toHaveAttribute('id', 'warehouse-issue-action-guidance');
    expect(Array.from(container.querySelectorAll('h2, h3, h4')).map((heading) => heading.tagName)).toEqual(['H2', 'H2', 'H2']);
  });
});
