import { describe, expect, it } from 'vitest';
import pageSource from './ReportsPage.tsx?raw';

describe('reports demand status/action geometry', () => {
  it('uses shared search anatomy and stable semantic status/action controls', () => {
    expect(pageSource).toContain('label="Tìm nguyên liệu trong khoảng ngày"');
    expect(pageSource).toContain('ipc-demand-status-control');
    expect(pageSource).toContain('ipc-demand-action-control');
    expect(pageSource).not.toContain('ipc-button-bounded" to={row.actionHref}');
  });
});
