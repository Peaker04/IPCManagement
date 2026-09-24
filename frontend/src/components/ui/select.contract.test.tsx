import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { Dialog, DialogContent, DialogTitle } from './dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './select';

const longLabel = 'Nhà máy An Bình · Ca chiều · Mức định lượng 34.000 đồng';
const productionSelectSources = import.meta.glob(['/src/**/*.tsx'], { eager: true, query: '?raw', import: 'default' }) as Record<string, string>;

function Fixture() {
  return <Select value="scope-1">
    <SelectTrigger className="w-40" aria-label="Chọn phạm vi">
      <SelectValue>{longLabel}</SelectValue>
    </SelectTrigger>
    <SelectContent><SelectItem value="scope-1">{longLabel}</SelectItem></SelectContent>
  </Select>;
}

function RapidSwitchFixture() {
  return <div>
    <Select defaultValue="a"><SelectTrigger aria-label="Khách hàng"><SelectValue>A</SelectValue></SelectTrigger><SelectContent><SelectItem value="a">A</SelectItem><SelectItem value="b">B</SelectItem></SelectContent></Select>
    <Select defaultValue="w1"><SelectTrigger aria-label="Tuần"><SelectValue>Tuần 1</SelectValue></SelectTrigger><SelectContent><SelectItem value="w1">Tuần 1</SelectItem><SelectItem value="w2">Tuần 2</SelectItem></SelectContent></Select>
  </div>
}

describe('shared select closed-value contract', () => {
  it('keeps the full selected label available when its visual projection is clamped', async () => {
    const user = userEvent.setup();
    render(<Fixture />);
    const trigger = screen.getByRole('combobox', { name: 'Chọn phạm vi' });

    expect(trigger).toHaveTextContent(longLabel);
    expect(trigger).toHaveAttribute('title', longLabel);

    await user.click(trigger);
    expect(screen.getByRole('option', { name: longLabel })).toBeInTheDocument();
  });

  it('keeps rapid switching between adjacent selectors non-modal and immediately interactive', async () => {
    const user = userEvent.setup()
    render(<RapidSwitchFixture />)
    await user.click(screen.getByRole('combobox', { name: 'Khách hàng' }))
    expect(document.body.style.overflow).not.toBe('hidden')
    await user.click(await screen.findByRole('option', { name: 'B' }))
    await user.click(screen.getByRole('combobox', { name: 'Tuần' }))
    expect(await screen.findByRole('option', { name: 'Tuần 2' })).toBeInTheDocument()
    expect(screen.queryByRole('option', { name: 'A' })).not.toBeInTheDocument()
  })

  it('closes an open select when a modal surface opens', async () => {
    const user = userEvent.setup()
    const fixture = (dialogOpen: boolean) => <>
      <Fixture />
      <Dialog open={dialogOpen} onOpenChange={() => undefined}>
        <DialogContent aria-label="Chi tiết"><DialogTitle>Chi tiết</DialogTitle></DialogContent>
      </Dialog>
    </>
    const { rerender } = render(fixture(false))
    await user.click(screen.getByRole('combobox', { name: 'Chọn phạm vi' }))
    expect(await screen.findByRole('listbox')).toBeInTheDocument()

    rerender(fixture(true))
    await waitFor(() => expect(screen.queryByRole('listbox')).not.toBeInTheDocument())
  })

  it('requires mounted callsites to project a label instead of relying on a raw selected value', () => {
    const offenders = Object.entries(productionSelectSources)
      .filter(([path]) => !path.endsWith('/components/ui/select.tsx'))
      .filter(([, source]) => /<SelectValue(?:\s+placeholder=[^>]*)?\s*\/>/.test(source))
      .map(([path]) => path);

    expect(offenders).toEqual([]);
  });
});
