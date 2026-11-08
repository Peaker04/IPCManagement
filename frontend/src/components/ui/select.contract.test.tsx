import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
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

  it('requires mounted callsites to project a label instead of relying on a raw selected value', () => {
    const offenders = Object.entries(productionSelectSources)
      .filter(([path]) => !path.endsWith('/components/ui/select.tsx'))
      .filter(([, source]) => /<SelectValue(?:\s+placeholder=[^>]*)?\s*\/>/.test(source))
      .map(([path]) => path);

    expect(offenders).toEqual([]);
  });
});
