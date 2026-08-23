import { expect, test, type Page, type Route } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { UI_AUDIT_FIXTURE_VERSION, UI_AUDIT_SCHEMA_VERSION, routeMeasuredFinding, validateUiAuditRecord, type UiAuditFinding, type UiAuditRecord } from './uiAuditContract';
import { UI_AUDIT_RULE_IDS } from './uiAuditOracleRegistry';
import { identityKey, UI_AUDIT_VIEWPORTS } from './uiAuditInventory';
import { DASHBOARD_QUERY_DISPOSITION_REASONS, expandProductionQueryIdentities, registerDashboardQueryIdentity } from './uiAuditProductionQueryAdapter';
import { isLedgerRequest } from './uiAuditEvidence';

type CreatedState = 'initial-loading' | 'populated' | 'truly-empty' | 'no-results' | 'error-no-data';
const queryPaths = new Set([
  '/api/workflow-reports/operational-kpis', '/api/workflow-reports/workflow-documents',
  '/api/workflow-reports/ingredient-demand', '/api/workflow-reports/receipt-price-variance', '/api/workflow-reports/stock-movements',
]);
const profile = { userId:'phase28-dashboard', username:'phase28-dashboard', fullName:'Dashboard Phase 28', role:'authenticated', roleCode:'AUTHENTICATED', roleName:'Authenticated', isAdminFullAccess:false, permissions:[] };
const emptyKpis = { shortageCount:0, lowStockCount:0, overduePurchaseRequestCount:0, lateReceiptCount:0, pendingKitchenConfirmationCount:0, failedWorkflowCount:0, criticalDataQualityCount:0, overdueApprovalCount:0, generatedAt:'2026-08-23T00:00:00Z' };

async function json(route: Route, data: unknown) { await route.fulfill({ status:200, contentType:'application/json', body:JSON.stringify({ success:true, message:'OK', data }) }); }
async function installApi(page: Page, state: CreatedState) {
  let release!: () => void;
  const deferred = new Promise<void>((resolve) => { release = resolve; });
  await page.route('**/api/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (!path.startsWith('/api/')) return route.continue();
    if (path === '/api/auth/profile') return json(route, profile);
    if (queryPaths.has(path)) {
      if (state === 'initial-loading') await deferred;
      if (state === 'error-no-data') return route.fulfill({ status:500, contentType:'application/json', body:JSON.stringify({ success:false, message:'dashboard audit failure' }) });
      if (path === '/api/workflow-reports/operational-kpis') return json(route, state === 'populated' || state === 'no-results' ? { ...emptyKpis, shortageCount:2 } : emptyKpis);
      return json(route, []);
    }
    return json(route, []);
  });
  return release;
}
async function login(page: Page) {
  await page.addInitScript((user) => { localStorage.clear(); sessionStorage.clear(); sessionStorage.setItem('token','dev-login-fallback-token-phase28-dashboard'); localStorage.setItem('user',JSON.stringify({ ...user, id:user.userId })); }, profile);
  await page.goto('/'); await expect(page).toHaveURL('/'); await expect(page.locator('.ipc-app-shell')).toBeVisible();
}

const seam = (page:Page, region:string, state:CreatedState) => {
  if (state === 'error-no-data') return page.getByRole('alert');
  if (region === 'dashboard-shift-status') return page.locator('section[aria-labelledby="dashboard-shift-status"]');
  if (state === 'initial-loading') return page.locator('.ipc-dashboard-queue-panel .ipc-dashboard-task-skeleton').first();
  if (state === 'truly-empty' || state === 'no-results') return page.locator('.ipc-dashboard-queue-panel').getByText('Không có việc cần xử lý trong ca này.');
  return page.locator('.ipc-dashboard-queue-panel').getByText('Thiếu hoặc tồn thấp nguyên liệu');
};

test.describe('Phase 28 Dashboard production-route query-state adapter', () => {
  test('records 98 honest six-part identities from endpoint-specific GET interception', async ({ page }) => {
    test.setTimeout(420_000);
    const identities = expandProductionQueryIdentities().filter(({ route }) => route === '/').map(registerDashboardQueryIdentity);
    const records:UiAuditRecord[]=[]; const observed:UiAuditRecord['network']=[];
    page.on('request', request => { if (isLedgerRequest(request.url(),request.method(),request.resourceType(),'http://127.0.0.1:5173')) observed.push({ method:request.method(), url:request.url(), resourceType:request.resourceType(), classification:request.url().includes('/api/')?'api':'non-static' }); });
    await page.route('**/*', async route => { if (!['GET','HEAD'].includes(route.request().method())) await route.abort(); else await route.continue(); });
    for (const viewport of UI_AUDIT_VIEWPORTS) for (const state of ['initial-loading','populated','truly-empty','no-results','error-no-data'] as const) {
      const ledgerStart=observed.length; await page.setViewportSize({ width:viewport.width, height:viewport.height }); await page.unroute('**/api/**');
      const release=await installApi(page,state); await login(page);
      if (state === 'no-results') await page.getByRole('button',{name:/Dữ liệu/}).click();
      const zoom='textZoomPercent' in viewport?viewport.textZoomPercent:100; const style=zoom===100?undefined:await page.addStyleTag({content:`html{font-size:${zoom}%!important}`});
      for (const regionId of ['dashboard-shift-status','dashboard-workflow-exceptions']) {
        const row=identities.find(item=>item.viewport===viewport.id&&item.state===state&&item.regionId===regionId)!;
        if (row.disposition.kind === 'needs-evidence') continue;
        const identity=identityKey(row); const target=seam(page,regionId,state); await expect(target).toBeVisible();
        const axe=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21a','wcag21aa','wcag22aa']).analyze();
        const metrics=await page.evaluate((selector) => { const owner=document.querySelector<HTMLElement>(selector); const rect=owner?.getBoundingClientRect(); const visible=[...document.querySelectorAll<HTMLElement>('input,select,textarea,button,a[href]')].filter(e=>{const r=e.getBoundingClientRect();return r.width>0&&r.height>0}); return { h1Count:[...document.querySelectorAll('h1')].filter(e=>(e as HTMLElement).offsetParent!==null).length, mainCount:[...document.querySelectorAll('main')].filter(e=>(e as HTMLElement).offsetParent!==null).length, unnamed:visible.filter(e=>!(e.getAttribute('aria-label')||e.getAttribute('aria-labelledby')||e.textContent?.trim()||e.getAttribute('title'))).length, overflowPx:Math.max(0,document.documentElement.scrollWidth-innerWidth), ownerVisible:Boolean(rect&&rect.width>0&&rect.height>0) }; }, state==='error-no-data'?'[role="alert"]':regionId==='dashboard-shift-status'?'section[aria-labelledby="dashboard-shift-status"]':'.ipc-dashboard-queue-panel');
        const serious=axe.violations.filter(v=>v.impact==='serious'||v.impact==='critical'); const finding=(ruleId:string,pass:boolean,value:Record<string,unknown>,expected:string)=>routeMeasuredFinding({ruleId,identity,productionRouteMeasured:true,passed:pass,measured:{...value,state,endpointInterception:true},expected,actual:JSON.stringify(value),lowestOwner:'DashboardPage'});
        const findings:UiAuditFinding[]=[finding('HIER-01',metrics.h1Count===1&&metrics.mainCount===1,{h1Count:metrics.h1Count,mainCount:metrics.mainCount},'one visible h1 and main'),finding('HIER-02',metrics.unnamed===0,{unnamed:metrics.unnamed},'zero unnamed controls'),finding('A11Y-01',serious.length===0&&metrics.unnamed===0,{seriousCount:serious.length,ids:serious.map(v=>v.id),unnamed:metrics.unnamed},'zero serious/critical violations and unnamed controls'),finding('RESP-01',metrics.overflowPx<=2&&metrics.ownerVisible,{overflowPx:metrics.overflowPx,ownerVisible:metrics.ownerVisible},'at most 2px overflow and visible owner'),finding('RESP-02',metrics.overflowPx<=2,{overflowPx:metrics.overflowPx,textZoomPercent:zoom},'no clipping'),finding('QUERY-01',true,{state,seamCount:await target.count(),endpointInterception:true},'state-specific production DOM seam from endpoint GET interception')];
        const used=new Set(findings.map(f=>f.ruleId)); findings.push(...UI_AUDIT_RULE_IDS.filter(id=>!used.has(id)).map(ruleId=>({ruleId,identity,verdict:'NEEDS_EVIDENCE' as const,measured:{productionRouteMeasured:false,reason:'rule is outside Dashboard query-state adapter scope'}})));
        const record={schemaVersion:UI_AUDIT_SCHEMA_VERSION,fixtureVersion:UI_AUDIT_FIXTURE_VERSION,identity,fixtureKey:identity,findings,network:observed.slice(ledgerStart)}; validateUiAuditRecord(record); records.push(record);
      }
      if(style) await style.evaluate(node=>node.remove()); release();
    }
    for (const row of identities.filter(({ disposition })=>disposition.kind==='needs-evidence')) {
      const identity=identityKey(row); const reason=row.disposition.kind==='needs-evidence'?row.disposition.reason:''; const verdict=reason.startsWith('NOT_APPLICABLE:')?'NOT_APPLICABLE' as const:'NEEDS_EVIDENCE' as const;
      const findings=UI_AUDIT_RULE_IDS.map(ruleId=>({ruleId,identity,verdict,measured:{productionRouteMeasured:false,reason}})); const record={schemaVersion:UI_AUDIT_SCHEMA_VERSION,fixtureVersion:UI_AUDIT_FIXTURE_VERSION,identity,fixtureKey:identity,findings,network:[]}; validateUiAuditRecord(record); records.push(record);
    }
    expect(records).toHaveLength(98); expect(new Set(records.map(r=>r.identity)).size).toBe(98); expect(records.flatMap(r=>r.network).filter(r=>!['GET','HEAD'].includes(r.method))).toEqual([]);
    expect(records.filter(r=>r.findings[0].verdict==='NOT_APPLICABLE')).toHaveLength(7); expect(records.filter(r=>r.findings[0].verdict==='NEEDS_EVIDENCE')).toHaveLength(28);
    const verdictTotals=records.flatMap(r=>r.findings).reduce<Record<string,number>>((a,f)=>(a[f.verdict]=(a[f.verdict]??0)+1,a),{}); const output=resolve(process.cwd(),'test-results','ui-audit-phase28-dashboard-query-states.json'); mkdirSync(dirname(output),{recursive:true}); writeFileSync(output,`${JSON.stringify({schemaVersion:UI_AUDIT_SCHEMA_VERSION,identityCount:98,measuredIdentityCount:63,notApplicableIdentityCount:7,needsEvidenceIdentityCount:28,reasons:DASHBOARD_QUERY_DISPOSITION_REASONS,verdictTotals,records},null,2)}\n`);
  });
});
