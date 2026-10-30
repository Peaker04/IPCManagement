import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { WorkspaceFrame } from '../components/workbench/WorkspaceFrame';
import { LocalizedBoundary } from '../components/workbench/LocalizedBoundary';

describe('WorkspaceFrame and LocalizedBoundary', () => {
  it('renders frame header and body independently', () => {
    render(
      <WorkspaceFrame.Root>
        <WorkspaceFrame.Header>
          <h1>Test Workspace Title</h1>
          <div>Context Selectors</div>
        </WorkspaceFrame.Header>
        <WorkspaceFrame.Body>
          <div data-testid="body-content">Canvas Content</div>
        </WorkspaceFrame.Body>
      </WorkspaceFrame.Root>
    );

    expect(screen.getByText('Test Workspace Title')).toBeInTheDocument();
    expect(screen.getByText('Context Selectors')).toBeInTheDocument();
    expect(screen.getByTestId('body-content')).toBeInTheDocument();
  });

  it('localized boundary renders skeleton in body without unmounting header', async () => {
    render(
      <WorkspaceFrame.Root>
        <WorkspaceFrame.Header>
          <h1>Permanent Header</h1>
        </WorkspaceFrame.Header>
        <WorkspaceFrame.Body>
          <LocalizedBoundary isLoading={true}>
            <div data-testid="actual-table">Table Data</div>
          </LocalizedBoundary>
        </WorkspaceFrame.Body>
      </WorkspaceFrame.Root>
    );

    // Header must remain visible and interactive
    expect(screen.getByText('Permanent Header')).toBeInTheDocument();
    // Actual table should not be shown while loading
    expect(screen.queryByTestId('actual-table')).not.toBeInTheDocument();
    // Localized skeleton must appear after latency threshold
    expect(await screen.findByTestId('localized-skeleton')).toBeInTheDocument();
  });

  it('localized boundary renders error retry without affecting header', () => {
    const handleRetry = vi.fn();

    render(
      <WorkspaceFrame.Root>
        <WorkspaceFrame.Header>
          <h1>Permanent Header</h1>
        </WorkspaceFrame.Header>
        <WorkspaceFrame.Body>
          <LocalizedBoundary
            error={new Error('Network error on table fetch')}
            onRetry={handleRetry}
          >
            <div data-testid="actual-table">Table Data</div>
          </LocalizedBoundary>
        </WorkspaceFrame.Body>
      </WorkspaceFrame.Root>
    );

    expect(screen.getByText('Permanent Header')).toBeInTheDocument();
    expect(screen.getByText(/Network error on table fetch/i)).toBeInTheDocument();
    const retryBtn = screen.getByRole('button', { name: /thử lại/i });
    retryBtn.click();
    expect(handleRetry).toHaveBeenCalledOnce();
  });

  it('localized boundary renders content when healthy', () => {
    render(
      <LocalizedBoundary isLoading={false} error={null}>
        <div data-testid="healthy-table">Healthy Rows</div>
      </LocalizedBoundary>
    );

    expect(screen.getByTestId('healthy-table')).toBeInTheDocument();
  });
});
