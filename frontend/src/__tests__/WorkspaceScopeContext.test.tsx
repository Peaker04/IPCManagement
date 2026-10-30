import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { MemoryRouter, useSearchParams } from 'react-router-dom';
import { WorkspaceScopeProvider, useWorkspaceScope } from '../store/workspaceScopeContext';

function TestConsumer() {
  const { scope, setScope, snapToMonday } = useWorkspaceScope();
  const [searchParams] = useSearchParams();

  return (
    <div>
      <div data-testid="scope-customer">{scope.customerId}</div>
      <div data-testid="scope-batch">{scope.batchId}</div>
      <div data-testid="scope-date">{scope.serviceDate}</div>
      <div data-testid="scope-week">{scope.weekStartDate}</div>
      <div data-testid="url-customer">{searchParams.get('customerId') || ''}</div>
      <div data-testid="url-date">{searchParams.get('date') || ''}</div>
      <button
        onClick={() => setScope({ customerId: 'CUST-NEW', serviceDate: '2026-09-15' })}
        data-testid="btn-update-scope"
      >
        Update Scope
      </button>
      <button
        onClick={() => setScope({ serviceDate: snapToMonday('2026-09-15') })}
        data-testid="btn-snap-monday"
      >
        Snap Monday
      </button>
    </div>
  );
}

describe('WorkspaceScopeContext', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  afterEach(() => {
    sessionStorage.clear();
  });

  it('hydrates scope directly from URL search parameters', () => {
    render(
      <MemoryRouter initialEntries={['/reconciliation?customerId=CUST-1&batchId=B-01&date=2026-09-14']}>
        <WorkspaceScopeProvider>
          <TestConsumer />
        </WorkspaceScopeProvider>
      </MemoryRouter>
    );

    expect(screen.getByTestId('scope-customer').textContent).toBe('CUST-1');
    expect(screen.getByTestId('scope-batch').textContent).toBe('B-01');
    expect(screen.getByTestId('scope-date').textContent).toBe('2026-09-14');
    expect(screen.getByTestId('scope-week').textContent).toBe('2026-09-14');
  });

  it('falls back to sessionStorage when URL parameters are not set', () => {
    sessionStorage.setItem(
      'ipc_mrx_workspace_session_scope',
      JSON.stringify({
        customerId: 'CUST-SESSION',
        batchId: 'B-SESSION',
        serviceDate: '2026-09-21',
        weekStartDate: '2026-09-21',
      })
    );

    render(
      <MemoryRouter initialEntries={['/reconciliation']}>
        <WorkspaceScopeProvider>
          <TestConsumer />
        </WorkspaceScopeProvider>
      </MemoryRouter>
    );

    expect(screen.getByTestId('scope-customer').textContent).toBe('CUST-SESSION');
    expect(screen.getByTestId('scope-batch').textContent).toBe('B-SESSION');
    expect(screen.getByTestId('scope-date').textContent).toBe('2026-09-21');
  });

  it('automatically snaps mid-week date to Monday and updates URL search params', () => {
    render(
      <MemoryRouter initialEntries={['/reconciliation']}>
        <WorkspaceScopeProvider>
          <TestConsumer />
        </WorkspaceScopeProvider>
      </MemoryRouter>
    );

    act(() => {
      screen.getByTestId('btn-snap-monday').click();
    });

    // 2026-09-15 is Tuesday -> Monday is 2026-09-14
    expect(screen.getByTestId('scope-date').textContent).toBe('2026-09-14');
    expect(screen.getByTestId('scope-week').textContent).toBe('2026-09-14');
  });

  it('synchronizes scope updates into URL search params and sessionStorage', () => {
    render(
      <MemoryRouter initialEntries={['/reconciliation?customerId=OLD']}>
        <WorkspaceScopeProvider>
          <TestConsumer />
        </WorkspaceScopeProvider>
      </MemoryRouter>
    );

    act(() => {
      screen.getByTestId('btn-update-scope').click();
    });

    expect(screen.getByTestId('scope-customer').textContent).toBe('CUST-NEW');
    expect(screen.getByTestId('url-customer').textContent).toBe('CUST-NEW');
    expect(screen.getByTestId('url-date').textContent).toBe('2026-09-15');

    const raw = sessionStorage.getItem('ipc_mrx_workspace_session_scope');
    expect(raw).toBeTruthy();
    const parsed = JSON.parse(raw!);
    expect(parsed.customerId).toBe('CUST-NEW');
  });
});
