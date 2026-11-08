// scripts/capture-all-canonical-routes.mjs
import { chromium } from '@playwright/test';
import path from 'node:path';
import fs from 'node:fs';

const BASE_URL = 'http://127.0.0.1:5173';
const API_URL = 'http://127.0.0.1:5262';
const OUTPUT_DIR = path.resolve('.artifacts/audit-screenshots/canonical-14routes');
fs.mkdirSync(OUTPUT_DIR, { recursive: true });

async function switchBackendMode(token, targetMode) {
  const getRes = await fetch(`${API_URL}/api/system-operation-mode`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const current = await getRes.json();
  if (current.data?.mode === targetMode) return;

  await fetch(`${API_URL}/api/system-operation-mode`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      mode: targetMode,
      expectedVersion: current.data.version,
      confirmed: true,
      reason: `Automated audit switch to ${targetMode}`
    })
  });
  console.log(`[MODE] Switched backend mode to: ${targetMode}`);
}

const DEFAULT_SCREENS = [
  { id: '01', path: '/', name: '01-dashboard' },
  { id: '02', path: '/weekly-menu', name: '02-weekly-schedule' },
  { id: '03', path: '/weekly-menu?view=demand', name: '03-weekly-demand' },
  { id: '04', path: '/weekly-menu?view=production-plan', name: '04-weekly-production' },
  { id: '05', path: '/weekly-menu?view=cost', name: '05-weekly-cost' },
  { id: '06', path: '/meal-orders', name: '06-meal-orders' },
  { id: '07', path: '/approvals', name: '07-approvals-inbox' },
  { id: '08', path: '/purchasing', name: '08-purchasing-orders' },
  { id: '09', path: '/warehouse?view=issues', name: '09-warehouse-issues' },
  { id: '10', path: '/warehouse?view=receipts', name: '10-warehouse-receipts' },
  { id: '11', path: '/warehouse?view=stock', name: '11-warehouse-stock' },
  { id: '12', path: '/chef?view=plans', name: '12-chef-plans' },
  { id: '13', path: '/chef?view=issues', name: '13-chef-issues' },
  { id: '14', path: '/reports?view=demand', name: '14-reports-demand' },
  { id: '15', path: '/reports?view=prices', name: '15-reports-prices' },
  { id: '16', path: '/reports?view=stock', name: '16-reports-stock' },
  { id: '17', path: '/settings/approval-rules', name: '17-approval-rules' },
  { id: '18', path: '/admin-data?view=ingredients', name: '18-admin-ingredients' },
  { id: '19', path: '/admin-data?view=dishes', name: '19-admin-dishes' },
  { id: '20', path: '/settings/advanced?view=mode', name: '20-advanced-mode' },
  { id: '21', path: '/login', name: '21-auth-login' },
  { id: '22', path: '/forbidden', name: '22-auth-forbidden' },
];

const MRX_SCREENS = [
  { id: '23', path: '/weekly-menu?view=mrx-batch', name: '23-mrx-batch-workbench' },
  { id: '24', path: '/warehouse?view=mrx-daily', name: '24-mrx-daily-workbench' },
  { id: '25', path: '/warehouse?view=mrx-preparation', name: '25-mrx-prep-workbench' },
  { id: '26', path: '/warehouse?view=mrx-issues', name: '26-mrx-issues-deltas' },
  { id: '27', path: '/chef?view=mrx-cooking', name: '27-mrx-chef-cooking' },
  { id: '28', path: '/reconciliation', name: '28-mrx-reconciliation-lines' },
  { id: '29', path: '/reconciliation?view=variances', name: '29-mrx-reconciliation-variances' },
  { id: '30', path: '/reconciliation?view=transactions', name: '30-mrx-reconciliation-transactions' },
  { id: '31', path: '/reconciliation?view=audit', name: '31-mrx-reconciliation-audit' },
  { id: '32', path: '/reconciliation?view=completed', name: '32-mrx-reconciliation-completed' },
];

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2,
  });
  const page = await context.newPage();

  console.log('Authenticating with real Admin credentials...');
  const loginRes = await fetch(`${API_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'Admin@123456' }),
  });
  const loginJson = await loginRes.json();
  const token = loginJson.data.accessToken;

  await page.goto(`${BASE_URL}/login`);
  await page.fill('input[type="text"]', 'admin');
  await page.fill('input[type="password"]', 'Admin@123456');
  await page.click('button[type="submit"]');
  await page.waitForTimeout(1000);

  // Phase 1: Capture DEFAULT Mode Screens
  console.log('\n--- PHASE 1: CAPTURING DEFAULT MODE SCREENS ---');
  await switchBackendMode(token, 'DEFAULT');
  await page.evaluate(() => localStorage.setItem('ipc_v3_mode', 'DEFAULT'));
  await page.reload();
  await page.waitForTimeout(1000);

  for (const screen of DEFAULT_SCREENS) {
    await page.goto(`${BASE_URL}${screen.path}`);
    await page.waitForLoadState('networkidle').catch(() => {});
    await page.waitForTimeout(600);
    const filePath = path.join(OUTPUT_DIR, `${screen.name}-1440p.png`);
    await page.screenshot({ path: filePath });
    console.log(`[DEFAULT] Captured: ${screen.name}-1440p.png`);
  }

  // Phase 2: Capture MRX Mode Screens
  console.log('\n--- PHASE 2: CAPTURING MRX MODE SCREENS ---');
  await switchBackendMode(token, 'MATERIAL_RECONCILIATION');
  await page.evaluate(() => localStorage.setItem('ipc_v3_mode', 'MATERIAL_RECONCILIATION'));
  await page.reload();
  await page.waitForTimeout(1000);

  for (const screen of MRX_SCREENS) {
    await page.goto(`${BASE_URL}${screen.path}`);
    await page.waitForLoadState('networkidle').catch(() => {});
    await page.waitForTimeout(600);
    const filePath = path.join(OUTPUT_DIR, `${screen.name}-1440p.png`);
    await page.screenshot({ path: filePath });
    console.log(`[MRX] Captured: ${screen.name}-1440p.png`);
  }

  // Phase 3: Responsive Viewports Audit
  console.log('\n--- PHASE 3: CAPTURING RESPONSIVE VIEWPORTS AUDIT ---');
  const VIEWPORTS = [
    { name: '1280p', width: 1280, height: 800 },
    { name: '1024p', width: 1024, height: 768 },
    { name: '390p', width: 390, height: 844 },
  ];

  for (const vp of VIEWPORTS) {
    await page.setViewportSize({ width: vp.width, height: vp.height });
    // MRX Reconciliation at viewport
    await page.goto(`${BASE_URL}/reconciliation`);
    await page.waitForLoadState('networkidle').catch(() => {});
    await page.waitForTimeout(400);
    await page.screenshot({ path: path.join(OUTPUT_DIR, `resp-reconciliation-${vp.name}.png`) });
    console.log(`[RESPONSIVE] Captured: resp-reconciliation-${vp.name}.png`);
  }

  // Restore to DEFAULT for general use
  await switchBackendMode(token, 'DEFAULT');

  await browser.close();
  console.log(`\nAll 35 canonical route screenshots captured cleanly into: ${OUTPUT_DIR}`);
}

main().catch(console.error);
