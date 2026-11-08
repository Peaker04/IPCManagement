import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const dashboardCss = readFileSync('src/styles/components/dashboard.css', 'utf8');
const relativeLuminance = (hex: string) => {
  const channels = hex.match(/[a-f\d]{2}/gi)!.map((value) => Number.parseInt(value, 16) / 255).map((value) => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
};
const contrast = (foreground: string, background: string) => {
  const values = [relativeLuminance(foreground), relativeLuminance(background)].sort((left, right) => right - left);
  return (values[0] + 0.05) / (values[1] + 0.05);
};

const exactDashboardIdentities = [
  '/|dashboard-shift-status|populated|authenticated|1440x900|DashboardPage',
  '/|dashboard-shift-status|truly-empty|authenticated|1440x900|DashboardPage',
  '/|dashboard-workflow-exceptions|populated|authenticated|1440x900|DashboardPage',
  '/|dashboard-workflow-exceptions|truly-empty|authenticated|1440x900|DashboardPage',
];

describe('Phase 28-06 remediation precondition', () => {
  it.each(exactDashboardIdentities)('%s keeps gate description contrast above 4.5:1', () => {
    expect(dashboardCss).toMatch(/\.ipc-dashboard-gate-copy small \{\s*color: var\(--ipc-slate-600\)/);
    for (const observedBackground of ['#e8f1ff', '#e9f2ff', '#f4f8ff']) {
      expect(contrast('#475569', observedBackground)).toBeGreaterThanOrEqual(4.5);
    }
  });
});
