import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import AdvancedDisplaySettingsPage from './AdvancedDisplaySettingsPage';

vi.mock('../components/SystemOperationModeSettings', () => ({ SystemOperationModeSettings: () => <section>Mode owner</section> }));
vi.mock('../components/AdvancedDisplaySettings', () => ({ AdvancedDisplaySettings: () => <section>Display owner</section> }));

describe('Advanced settings composition', () => {
  it('separates global operation mode from browser-local display preferences via ?view=', () => {
    const { unmount } = render(
      <MemoryRouter initialEntries={['/admin/advanced-settings?view=display']}>
        <AdvancedDisplaySettingsPage />
      </MemoryRouter>,
    );

    expect(screen.getByText('Display owner')).toBeInTheDocument();
    expect(screen.queryByText('Mode owner')).not.toBeInTheDocument();
    unmount();

    render(
      <MemoryRouter initialEntries={['/admin/advanced-settings']}>
        <AdvancedDisplaySettingsPage />
      </MemoryRouter>,
    );
    expect(screen.getByText('Mode owner')).toBeInTheDocument();
    expect(screen.queryByText('Display owner')).not.toBeInTheDocument();
  });
});
