/* eslint-disable @typescript-eslint/no-unused-vars */
import { expect, type Locator, type Page, type Route } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { seriousViolationsWithBrowserPlaceholderEvidence } from '../uiAuditAxe';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { UI_AUDIT_FIXTURE_VERSION, UI_AUDIT_SCHEMA_VERSION, routeMeasuredFinding, validateUiAuditRecord, type UiAuditFinding, type UiAuditRecord } from '../uiAuditContract';
import { UI_AUDIT_RULE_IDS } from '../uiAuditOracleRegistry';
import { identityKey, REGION_INVENTORY, UI_AUDIT_VIEWPORTS } from '../uiAuditInventory';
import { WEEKLY_MENU_QUERY_DISPOSITION_REASONS, expandProductionQueryIdentities, registerWeeklyMenuQueryIdentity } from '../uiAuditProductionQueryAdapter';
import { isLedgerRequest } from '../uiAuditEvidence';

export type CreatedState = 'initial-loading' | 'populated' | 'truly-empty' | 'no-results' | 'error-no-data';
export type Region = (typeof REGION_INVENTORY)['/weekly-menu'][number];
export type MeasuredRegion = Exclude<Region, 'weekly-cost' | 'weekly-dish-materials'>;
export const profile = { userId:'phase28-coordinator', username:'phase28-coordinator', fullName:'Điều phối Phase 28', role:'dieuphoi', roleCode:'COORDINATOR', roleName:'Điều phối', isAdminFullAccess:false, permissions:['coordination.read','report.read','purchase.read','demand.generate','coordination.order.lock'] };
export const customer = { customerId:'customer-phase28', customerCode:'P28', customerName:'Khách hàng Phase 28' };
export const committedRows = [{ serviceDate:'2026-08-24', dayKey:'t2', sourceRowNumber:2, sourceColumn:'B', sourceSection:'Mặn', sourceShift:'Ca sáng', dbShiftName:'MORNING', variant:'savory', slot:'main', slotLabel:'Món chính', dishId:'dish-phase28', dishName:'Cơm Phase 28', servings:100, rowSpan:1, isMergedContinuation:false, existingDish:true }];
export const committedMenu = { committed:true, fileName:'phase28.xlsx', customerId:customer.customerId, customerCode:customer.customerCode, customerName:customer.customerName, weekStartDate:'2026-08-24', weekEndDate:'2026-08-29', detectedLayout:{sheetName:'Menu',labelColumn:'A',dayColumns:[],sections:[],rowsScanned:1,rowsImported:1,rowsSkipped:0}, warnings:[], validation:{isValid:true,hasCriticalErrors:false,errorCount:0,warningCount:0,issues:[]}, rows:committedRows, previewDiff:{addedSlots:0,changedSlots:0,removedSlots:0,unchangedSlots:1,rows:[]}, importedWeeklyMenu:{} };
export const dish = { dishId:'dish-phase28', dishCode:'D-P28', dishName:'Cơm Phase 28', dishType:'MAIN', dishGroup:'MORNING', isActive:true, menuSlots:['main'], bomLines:[{ bomId:'bom-phase28', ingredientId:'ingredient-phase28', ingredientCode:'GAO-P28', unitId:'unit-kg', ingredientName:'Gạo Phase 28', unitCode:'KG', unitName:'kg', grossQtyPerServing:0.1, wasteRatePercent:0, bomStatus:'ACTIVE', bomStatusLabel:'Đang áp dụng', referencePrice:18000, priceTierAmount:25000, bomScope:'GLOBAL', effectiveFrom:'2026-01-01' }] };
export const demandLine = { requestLineId:'line-phase28', materialRequestId:'request-phase28', materialRequestCode:'MR-P28', requestDate:'2026-08-24', serviceDate:'2026-08-24', ingredientId:'ingredient-phase28', ingredientName:'Gạo Phase 28', unitId:'unit-kg', unitName:'kg', totalRequiredQty:10, currentStockQty:8, suggestedPurchaseQty:2, status:'PENDING', dishName:'Cơm Phase 28' };
export const regions: Array<{id:MeasuredRegion; tab:string; panel:string; endpoint:string; table:string}> = [
  {id:'weekly-schedule',tab:'Kế hoạch tuần',panel:'#schedule-panel',endpoint:'/api/coordination/weekly-menu',table:'#schedule-panel table'},
  {id:'weekly-demand',tab:'Nhu cầu',panel:'#demand-panel',endpoint:'/api/workflow-reports/ingredient-demand',table:'#demand-panel table'},
  {id:'weekly-purchase-summary',tab:'Tổng hợp mua',panel:'#purchase-summary-panel',endpoint:'/api/workflow-reports/ingredient-demand/aggregate/page',table:'#purchase-summary-panel table'},
];
export async function json(route:Route,data:unknown){await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({success:true,message:'OK',data})});}
export const pageData=(items:unknown[])=>({items,totalCount:items.length,pageNumber:1,pageSize:10,totalPages:items.length?1:0,hasPrev:false,hasNext:false,shortageCount:items.length});
export async function installApi(page:Page,region:MeasuredRegion,state:CreatedState){
  let release!:()=>void;const deferred=new Promise<void>(resolve=>{release=resolve;});
  const owned = (pathname:string) => region==='weekly-schedule' ? pathname==='/api/coordination/weekly-menu' : region==='weekly-demand' ? ['/api/workflow-reports/ingredient-demand','/api/workflow-reports/workflow-documents','/api/workflow-reports/ingredient-demand/aggregate/page'].includes(pathname) : pathname==='/api/workflow-reports/ingredient-demand/aggregate/page';
  const answer=async(route:Route,data:unknown)=>{const path=new URL(route.request().url()).pathname;if(owned(path)&&state==='initial-loading')await deferred;if(owned(path)&&state==='error-no-data')return route.fulfill({status:500,contentType:'application/json',body:JSON.stringify({success:false,message:'weekly menu Phase 28 failure'})});return json(route,data);};
  await page.route('**/api/auth/profile',route=>json(route,profile));
  await page.route('**/api/system-operation-mode',route=>json(route,{mode:'DEFAULT',label:'Mặc định',version:7,updatedAt:'2026-09-02T00:00:00Z',reasonRequired:true,capabilities:{navigation:['dashboard','weekly-menu','coordination','approvals','purchasing','warehouse','chef','reports','admin-data','approval-rules','advanced-settings'],pageTabs:{'weekly-menu':['schedule','demand','production-plan','purchase-summary','cost','dish-materials']}}}));
  await page.route('**/api/dishes/catalog',route=>answer(route,[dish]));
  await page.route('**/api/coordination/customers',route=>answer(route,[customer]));
  await page.route('**/api/coordination/customer-contracts',route=>answer(route,[{contractId:'contract-phase28',...customer,isActive:true,contractStatus:'ACTIVE',menuScheduleCount:1,activeWeekDays:['MONDAY'],shiftNames:['MORNING'],defaultMenuPrice:25000,defaultBomRatePercent:100}]));
  await page.route('**/api/coordination/weekly-menu**',route=>{const path=new URL(route.request().url()).pathname;if(path.endsWith('/import-history')||path.endsWith('/amendments'))return answer(route,[]);return answer(route,state==='truly-empty'&&region==='weekly-schedule'?null:committedMenu);});
  await page.route('**/api/coordination/menu-schedules**',route=>answer(route,[]));
  await page.route('**/api/coordination/meal-quantity-plans**',route=>answer(route,[]));
  await page.route('**/api/workflow-reports/ingredient-demand/aggregate/page**',route=>{const filtered=new URL(route.request().url()).searchParams.has('searchKeyword');const empty=state==='truly-empty'||state==='no-results'&&filtered;return answer(route,pageData(empty?[]:[demandLine]));});
  await page.route('**/api/workflow-reports/ingredient-demand**',route=>answer(route,state==='truly-empty'?[]:[demandLine]));
  await page.route('**/api/workflow-reports/workflow-documents**',route=>answer(route,[]));
  await page.route('**/api/material-demand/staleness**',route=>answer(route,{hasExistingPlan:false,isStale:false,canRegenerate:true,reasons:[]}));
  await page.route('**/api/approval-history/material-demand/**',route=>answer(route,[]));
  return release;
}
export async function login(page:Page){await page.addInitScript(({user,customerId})=>{localStorage.clear();sessionStorage.clear();sessionStorage.setItem('token','dev-login-fallback-token-phase28-weekly-menu');localStorage.setItem('user',JSON.stringify({...user,id:user.userId}));localStorage.setItem('ipc.weeklyMenu.lastCustomerId',customerId);localStorage.setItem('ipc.weeklyMenu.lastWeekStartDate','2026-08-24');}, {user:profile,customerId:customer.customerId});await page.goto('/weekly-menu');await expect(page).toHaveURL(/\/weekly-menu/);await expect(page.locator('.ipc-app-shell')).toBeVisible();}
export function target(page:Page,region:MeasuredRegion,state:CreatedState):Locator{const owner=page.locator(regions.find(item=>item.id===region)!.panel);if(state==='initial-loading')return region==='weekly-schedule'?owner:owner.getByRole('status').filter({hasText:/Đang tải|Đang cập nhật/}).first();if(state==='error-no-data')return region==='weekly-schedule'?page.getByRole('alert').first():owner.getByText(/Không tải được/).first();return owner;}
export function dispositionFindings(row:ReturnType<typeof registerWeeklyMenuQueryIdentity>):UiAuditFinding[]{const identity=identityKey(row);if(row.disposition.kind==='measure')throw new Error(`measured identity passed to disposition writer: ${identity}`);const verdict=row.disposition.kind==='not-applicable'?'NOT_APPLICABLE' as const:'NEEDS_EVIDENCE' as const;return UI_AUDIT_RULE_IDS.map(ruleId=>({ruleId,identity,verdict,measured:{productionRouteMeasured:false,reason:row.disposition.reason}}));}
