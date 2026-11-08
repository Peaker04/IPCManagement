import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import AdvancedDisplaySettingsPage from './AdvancedDisplaySettingsPage';

vi.mock('../components/SystemOperationModeSettings', () => ({ SystemOperationModeSettings: () => <section>Mode owner</section> }));
vi.mock('../components/AdvancedDisplaySettings', () => ({ AdvancedDisplaySettings: () => <section>Display owner</section> }));

describe('Advanced settings composition', () => {
  it('separates global operation mode from browser-local display preferences', () => {
    render(<MemoryRouter initialEntries={['/admin/advanced-settings?view=display']}><AdvancedDisplaySettingsPage /></MemoryRouter>);

    expect(screen.getByRole('tablist', { name: 'Chọn tác vụ thiết lập nâng cao' })).toBeInTheDocument();
    expect(screen.getByText('Display owner')).toBeInTheDocument();
    expect(screen.queryByText('Mode owner')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('tab', { name: 'Chế độ vận hành' }));
    expect(screen.getByText('Mode owner')).toBeInTheDocument();
    expect(screen.queryByText('Display owner')).not.toBeInTheDocument();
  });
});
