import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { TableViewport } from '@/components/common/TableViewport';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './table';

describe('operational table overflow ownership', () => {
  it('leaves horizontal scrolling to the canonical TableViewport', () => {
    const { container } = render(
      <TableViewport ariaLabel="Bảng kiểm thử">
        <Table aria-label="Dữ liệu kiểm thử">
          <TableHeader><TableRow><TableHead>Cột</TableHead></TableRow></TableHeader>
          <TableBody><TableRow><TableCell>Giá trị</TableCell></TableRow></TableBody>
        </Table>
      </TableViewport>,
    );

    const viewport = screen.getByRole('region', { name: 'Bảng kiểm thử' });
    const table = screen.getByRole('table', { name: 'Dữ liệu kiểm thử' });
    expect(viewport).toContainElement(table);
    expect(container.querySelectorAll('[data-table-viewport="true"]')).toHaveLength(1);
    expect(container.querySelector('[data-slot="table-container"]')).toBeNull();
  });
});
