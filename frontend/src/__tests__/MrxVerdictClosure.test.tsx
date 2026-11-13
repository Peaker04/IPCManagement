import { act, render, renderHook, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, it, vi } from 'vitest';
import { IdentifierText } from '../components/ui/identifier-text';
import { useWorkbenchQuery } from '../hooks/useWorkbenchQuery';
import { serverStateCache } from '../store/serverStateCache';
import { StateBoundary } from '../components/workbench/StateBoundary';
import { useState } from 'react';
import { MrxQuantityInput } from '../features/warehouse/MrxQuantityInput';

afterEach(() => { vi.restoreAllMocks(); serverStateCache.clearAll(); });

it('renders non-copyable identifiers as plain text', () => {
  render(<IdentifierText value="ING-003" copyable={false} />);
  expect(screen.getByText('ING-003')).toBeVisible();
  expect(screen.queryByRole('button')).not.toBeInTheDocument();
});

it('replaces local text on external restore without resurrecting an older incomplete edit', async () => {
  const user = userEvent.setup();
  function Editor() {
    const [value, setValue] = useState('1');
    return <><MrxQuantityInput label="Thực xuất" value={value} onChange={setValue} disabled={false} /><button onClick={() => setValue('2.75')}>Restore</button><button onClick={() => setValue('')}>Reset</button></>;
  }
  render(<Editor />);
  const input = screen.getByRole('textbox');
  await user.type(input, ',');
  expect(input).toHaveValue('1,');
  await user.click(screen.getByText('Restore'));
  expect(input).toHaveValue('2,75');
  await user.click(screen.getByText('Reset'));
  expect(input).toHaveValue('');
});

it('localizes restored quantities and invalidates the canonical value during incomplete edits', async () => {
  function Editor() {
    const [value, setValue] = useState('79.773');
    return <><MrxQuantityInput label="Thực xuất" value={value} onChange={setValue} disabled={false} /><output aria-label="canonical">{value}</output><button disabled={!value}>Gửi</button></>;
  }
  const user = userEvent.setup();
  render(<Editor />);
  const input = screen.getByRole('textbox', { name: 'Thực xuất' });
  expect(input).toHaveValue('79,773');
  await user.clear(input);
  await user.type(input, '2048,');
  expect(screen.getByRole('button', { name: 'Gửi' })).toBeDisabled();
  expect(input).toHaveValue('2048,');
  await user.type(input, '92');
  expect(screen.getByLabelText('canonical')).toHaveTextContent('2048.92');
  await user.clear(input);
  await user.type(input, '0.000001');
  await user.tab();
  expect(input).toHaveValue('0,000001');
  expect(screen.getByLabelText('canonical')).toHaveTextContent('0.000001');
});

it('copies an identifier by keyboard without activating its row', async () => {
  const user = userEvent.setup();
  const write = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue();
  const row = vi.fn();
  render(<div onClick={row}><IdentifierText value="ING-001" /></div>);
  await user.tab();
  expect(screen.getByRole('button', { name: 'Sao chép ING-001' })).toHaveFocus();
  await user.keyboard('{Enter}');
  expect(write).toHaveBeenCalledWith('ING-001');
  expect(row).not.toHaveBeenCalled();
  expect(screen.getByRole('status')).toHaveTextContent('Đã sao chép');
  await user.keyboard(' ');
  expect(write).toHaveBeenCalledTimes(2);
});

it('does not claim a rejected clipboard write succeeded', async () => {
  const user = userEvent.setup();
  vi.spyOn(navigator.clipboard, 'writeText').mockRejectedValue(new Error('denied'));
  render(<IdentifierText value="ING-002" />);
  await user.click(screen.getByRole('button', { name: 'Sao chép ING-002' }));
  expect(screen.getByRole('status')).toHaveTextContent('Không thể sao chép');
});

it('keeps failed-refresh feedback while retry is pending and clears it only on success', async () => {
  serverStateCache.set('mrx_retry_verdict', { id: 'ready' });
  let resolve!: (value: { id: string }) => void;
  const query = vi.fn().mockRejectedValueOnce(new Error('offline'))
    .mockImplementationOnce(() => new Promise(done => { resolve = done; }));
  const { result } = renderHook(() => useWorkbenchQuery<{ id: string }>({ scopeKey: 'retry-verdict', cacheKey: 'mrx_retry_verdict', queryFn: query }));
  await act(async () => { await result.current.refetch(true); });
  expect(result.current.stateProps.error?.message).toBe('offline');
  let pending!: Promise<void>;
  act(() => { pending = result.current.refetch(true); });
  expect(result.current.stateProps.error?.message).toBe('offline');
  expect(result.current.data?.id).toBe('ready');
  await act(async () => { resolve({ id: 'fresh' }); await pending; });
  await waitFor(() => expect(result.current.stateProps.error).toBeNull());
});

it('keeps the same alert mounted and disables retry during refresh', () => {
  const retry = vi.fn();
  const { rerender } = render(<StateBoundary hasExistingData error={new Error('offline')} onRetry={retry}><div>existing rows</div></StateBoundary>);
  const alert = screen.getByRole('alert');
  rerender(<StateBoundary hasExistingData isFetching error={new Error('offline')} onRetry={retry}><div>existing rows</div></StateBoundary>);
  expect(screen.getByRole('alert')).toBe(alert);
  expect(screen.getByRole('button', { name: 'Đang thử lại…' })).toBeDisabled();
  expect(screen.getByText('existing rows')).toBeVisible();
  rerender(<StateBoundary hasExistingData error={new Error('still offline')} onRetry={retry}><div>existing rows</div></StateBoundary>);
  expect(screen.getByRole('alert')).toBe(alert);
  expect(screen.getByRole('button', { name: 'Thử lại' })).toBeEnabled();
  rerender(<StateBoundary hasExistingData isForbidden error={new Error('forbidden')}><div>existing rows</div></StateBoundary>);
  expect(screen.queryByText('existing rows')).not.toBeInTheDocument();
});
