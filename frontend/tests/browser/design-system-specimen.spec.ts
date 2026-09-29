import { expect, test } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const artifactsDir = path.resolve(import.meta.dirname, '../../../.artifacts/design-system-specimen');

test.beforeAll(() => {
  if (!fs.existsSync(artifactsDir)) {
    fs.mkdirSync(artifactsDir, { recursive: true });
  }
});

const viewports = [
  { name: '1920-desktop', width: 1920, height: 1080 },
  { name: '1440-standard', width: 1440, height: 900 },
  { name: '1366-laptop', width: 1366, height: 768 },
  { name: '1024-tablet', width: 1024, height: 768 },
  { name: '768-tablet-portrait', width: 768, height: 1024 },
  { name: '390-mobile-iphone', width: 390, height: 844 },
];

test.describe('Design System Specimen Harness Validation', () => {
  test('mounts specimen harness, verifies all sections, and captures visual evidence', async ({ page }) => {
    // 1. Full Specimen Overview / Composed Workspace at 1440x900
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/tests/fixtures/specimen.html');

    const harnessRoot = page.getByTestId('design-system-specimen-harness-root');
    await expect(harnessRoot).toBeVisible();

    // Verify default active section is composed
    const activeSpecimen = page.getByTestId('gallery-active-specimen');
    await expect(activeSpecimen).toHaveAttribute('data-active-section', 'composed');
    await expect(page.getByTestId('material-demand-workspace')).toBeVisible();

    await page.screenshot({ path: path.join(artifactsDir, '01-specimen-overview.png'), fullPage: false });

    // 2. Section: Typography & Vietnamese Diacritics
    await page.getByTestId('gallery-nav-typography').click();
    await expect(activeSpecimen).toHaveAttribute('data-active-section', 'typography');
    const typoRoot = page.getByTestId('typography-specimen-root');
    await expect(typoRoot).toBeVisible();

    // Check diacritic probes
    await expect(page.getByText('✓ 0 Cắt dấu (No Clipping)')).toBeVisible();
    await expect(page.getByText('✓ Tabular Nums Chuẩn')).toBeVisible();

    await page.screenshot({ path: path.join(artifactsDir, '02-typography-vietnamese.png'), fullPage: false });

    // 3. Section: Colors & Surfaces
    await page.getByTestId('gallery-nav-colors').click();
    await expect(activeSpecimen).toHaveAttribute('data-active-section', 'colors');
    const colorRoot = page.getByTestId('color-surface-specimen-root');
    await expect(colorRoot).toBeVisible();

    // Verify Navy vs Info Blue section
    await page.getByRole('button', { name: 'Navy vs Info Blue' }).click();
    await expect(page.getByText('Mã đơn: PO-2026-0812')).toBeVisible();
    await page.screenshot({ path: path.join(artifactsDir, '03-navy-vs-info-blue.png'), fullPage: false });

    // Verify Form border on white vs canvas
    await page.getByRole('button', { name: 'Viền Form (#64748b)' }).click();
    await expect(page.getByText('Trên Thẻ Trắng (#ffffff)')).toBeVisible();
    await expect(page.getByText('Trên Nền Canvas Slate (#f1f5f9)')).toBeVisible();
    await page.screenshot({ path: path.join(artifactsDir, '04-form-border-contrast.png'), fullPage: false });

    // Verify Mathematical Contrast table
    await page.getByRole('button', { name: 'Tương phản Toán học' }).click();
    await expect(page.getByText('Văn bản chính trên thẻ trắng (Primary Text on White)')).toBeVisible();
    await page.screenshot({ path: path.join(artifactsDir, '05-contrast-matrix.png'), fullPage: false });

    // 4. Section: Two-Tier Iconography Architecture
    await page.getByTestId('gallery-nav-icons').click();
    await expect(activeSpecimen).toHaveAttribute('data-active-section', 'icons');
    await expect(page.getByText(/Hệ thống Biểu tượng Hai tầng/i)).toBeVisible();
    await expect(page.getByText(/Giải quyết Va chạm Thương hiệu ChefHat/i)).toBeVisible();
    await page.screenshot({ path: path.join(artifactsDir, '15-two-tier-iconography.png'), fullPage: false });

    // 5. Section: Data-Dense Operational Tables
    await page.getByTestId('gallery-nav-tables').click();
    await expect(activeSpecimen).toHaveAttribute('data-active-section', 'tables');
    const tableRoot = page.getByTestId('operational-table-specimen-root');
    await expect(tableRoot).toBeVisible();

    // Compact Tier 32px
    await page.screenshot({ path: path.join(artifactsDir, '09-table-compact-32px.png'), fullPage: false });

    // Switch to Standard Tier 36px/40px
    await page.getByRole('button', { name: 'Standard' }).click();
    await page.screenshot({ path: path.join(artifactsDir, '10-table-standard-36px.png'), fullPage: false });

    // 6. Section: Sidebar Navigation
    await page.getByTestId('gallery-nav-navigation').click();
    await expect(activeSpecimen).toHaveAttribute('data-active-section', 'navigation');
    const navRoot = page.getByTestId('sidebar-navigation-specimen-root');
    await expect(navRoot).toBeVisible();

    // Verify Expanded Mode (~272px)
    await expect(page.getByText('Bàn điều hành hôm nay')).toBeVisible();
    await expect(page.getByText('Kế hoạch & Điều phối')).toBeVisible();
    await page.screenshot({ path: path.join(artifactsDir, '06-sidebar-expanded.png'), fullPage: false });

    // Verify Compact Icon Rail Mode
    await page.getByRole('button', { name: 'Icon Rail (~60px)' }).click();
    await expect(page.getByLabel('Icon Rail')).toBeVisible();
    await page.screenshot({ path: path.join(artifactsDir, '07-sidebar-compact-rail.png'), fullPage: false });

    // Open Rail Flyout
    await page.getByTestId('toggle-rail-flyout').click();
    await expect(page.getByText('Kế hoạch & Điều phối')).toBeVisible();
    await page.screenshot({ path: path.join(artifactsDir, '07b-sidebar-rail-flyout-open.png'), fullPage: false });
    await page.keyboard.press('Escape');

    // Switch back to Expanded and open Mobile Drawer
    await page.getByRole('button', { name: 'Drawer (Mobile)' }).click();
    await expect(page.getByRole('dialog', { name: 'IPC System Drawer' })).toBeVisible();
    await page.screenshot({ path: path.join(artifactsDir, '08-sidebar-mobile-drawer.png'), fullPage: false });
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog', { name: 'IPC System Drawer' })).not.toBeVisible();

    // 7. Section: Accessibility & Stress Tests
    await page.getByTestId('gallery-nav-accessibility').click();
    await expect(activeSpecimen).toHaveAttribute('data-active-section', 'accessibility');
    const a11yRoot = page.getByTestId('accessibility-stress-specimen-root');
    await expect(a11yRoot).toBeVisible();

    // Open Modal A
    await page.getByRole('button', { name: /Mở Modality A: Modal Dialog/i }).click();
    const modalA = page.getByRole('dialog', { name: /Modality A: Hộp thoại Modal Dialog/i });
    await expect(modalA).toBeVisible();
    await page.screenshot({ path: path.join(artifactsDir, '11-modal-dialog-modality-a.png'), fullPage: false });
    await page.keyboard.press('Escape');
    await expect(modalA).not.toBeVisible();

    // Open Modal B (Drawer)
    await page.getByRole('button', { name: /Mở Modality B: Modal Drawer/i }).click();
    const drawerB = page.getByRole('dialog', { name: /Modality B: Drawer Trượt Cạnh Phải/i });
    await expect(drawerB).toBeVisible();
    await page.screenshot({ path: path.join(artifactsDir, '12-modal-drawer-modality-b.png'), fullPage: false });
    await page.keyboard.press('Escape');
    await expect(drawerB).not.toBeVisible();

    // 200% Zoom Reflow simulation check
    await page.getByRole('button', { name: /200%/i }).click();
    await page.screenshot({ path: path.join(artifactsDir, '13-zoom-200-reflow.png'), fullPage: false });

    // 8. Section: Motion System Lab
    await page.getByTestId('gallery-nav-motion').click();
    await expect(activeSpecimen).toHaveAttribute('data-active-section', 'motion');
    const motionRoot = page.getByTestId('motion-specimen-root');
    await expect(motionRoot).toBeVisible();
    await expect(page.getByText(/Hệ thống Chuyển động Vận hành/i)).toBeVisible();
    await page.screenshot({ path: path.join(artifactsDir, '16-motion-system-lab.png'), fullPage: false });

    // 9. Switch to Surface 2: Technical Evidence Laboratory
    await page.getByTestId('toggle-surface-lab').click();
    const labRoot = page.getByTestId('evidence-laboratory-root');
    await expect(labRoot).toBeVisible();
    await expect(page.getByText('Phòng Thí nghiệm Đo lường Kỹ thuật')).toBeVisible();
    const telemetryPre = page.locator('#specimen-telemetry-output');
    await expect(telemetryPre).toBeVisible();
    await page.screenshot({ path: path.join(artifactsDir, '17-evidence-laboratory-surface2.png'), fullPage: false });
  });

  // Multi-viewport responsive validation
  for (const vp of viewports) {
    test(`verifies specimen layout stability at ${vp.name} (${vp.width}x${vp.height})`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto('/tests/fixtures/specimen.html');

      const harnessRoot = page.getByTestId('design-system-specimen-harness-root');
      await expect(harnessRoot).toBeVisible();

      // Check document overflow does not exceed viewport width
      const overflow = await page.evaluate(() => Math.max(0, document.documentElement.scrollWidth - innerWidth));
      expect(overflow).toBe(0);

      // Capture screenshot per viewport
      await page.screenshot({
        path: path.join(artifactsDir, `viewport-${vp.name}.png`),
        fullPage: false,
      });
    });
  }
});
