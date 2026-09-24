import { describe, expect, it } from 'vitest';
import source from './action-toolbar.tsx?raw';

describe('Coordination send-to-kitchen ownership', () => {
  it('sends the selected service date and API shift from an upstream confirmation', () => {
    expect(source).toContain("openConfirmationDialog('send')");
    expect(source).toContain('serviceDate: currentServiceDate');
    expect(source).toContain('shiftName: toApiShiftName(currentShift)');
    expect(source).toContain("allowedRoles={['quanly', 'dieuphoi']}");
    expect(source).toContain('Gửi kế hoạch cho Bếp');
  });
});
