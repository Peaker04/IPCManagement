/* eslint-disable @typescript-eslint/no-unused-vars */
import { expect, type Locator, type Page, type Route } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { seriousViolationsWithBrowserPlaceholderEvidence } from '../uiAuditAxe';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { UI_AUDIT_FIXTURE_VERSION, UI_AUDIT_SCHEMA_VERSION, routeMeasuredFinding, validateUiAuditRecord, type UiAuditFinding, type UiAuditRecord } from '../uiAuditContract';
import { UI_AUDIT_RULE_IDS } from '../uiAuditOracleRegistry';
import { identityKey, REGION_INVENTORY, UI_AUDIT_VIEWPORTS } from '../uiAuditInventory';
import { CHEF_DASHBOARD_QUERY_DISPOSITION_REASONS, expandProductionQueryIdentities, registerChefDashboardQueryIdentity } from '../uiAuditProductionQueryAdapter';
import { isLedgerRequest } from '../uiAuditEvidence';

export type CreatedState = 'initial-loading' | 'populated' | 'truly-empty' | 'error-no-data';
export type Region = (typeof REGION_INVENTORY)['/chef-dashboard'][number];
export const profile={userId:'phase28-chef',username:'phase28-chef',fullName:'Bếp trưởng Phase 28',role:'beptruong',roleCode:'CHEF',roleName:'Bếp trưởng',isAdminFullAccess:false,permissions:['production.read']};
export const owners:Record<Region,{endpoint:string;tab?:string}>={
  'chef-production':{endpoint:'/api/production-plans/daily'},
  'chef-material-checklist':{endpoint:'/api/workflow-reports/kitchen-issues/page'},
  'chef-documents':{endpoint:'/api/workflow-reports/workflow-documents',tab:'Chứng từ bếp'},
};
export const pageData=(items:unknown[])=>({items,totalCount:items.length,pageNumber:1,pageSize:20,totalPages:items.length?1:0,hasPrev:false,hasNext:false});
export async function json(route:Route,data:unknown){await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({success:true,message:'OK',data})});}
export function populated(path:string,url:URL){
  const serviceDate=url.searchParams.get('serviceDate')||url.searchParams.get('dateFrom')||new Date().toISOString().slice(0,10);
  if(path==='/api/dishes/catalog')return [];
  if(path==='/api/production-plans/daily')return {serviceDate,shiftName:'MORNING',totalPlans:1,sentPlans:1,totalServings:100,warnings:[],plans:[{planId:'plan-p28',planCode:'PLAN-P28',customerId:'customer-p28',customerCode:'P28',customerName:'Khách Phase 28',status:'SENT_TO_KITCHEN',sentToKitchenAt:`${serviceDate}T01:00:00Z`,lines:[{planLineId:'plan-line-p28',dishId:'dish-p28',dishName:'Món Phase 28',shiftName:'MORNING',totalServings:100,suggestedPurchaseQty:2,priceTierAmount:25000,bomScope:'GLOBAL'}]}]};
  if(path==='/api/workflow-reports/kitchen-issues/page')return pageData([{id:'issue-line-p28',issueId:'issue-p28',issueCode:'ISS-P28',issueDate:serviceDate,sourceShiftName:'MORNING',shiftName:'MORNING',ingredientId:'ingredient-p28',ingredientName:'Gạo Phase 28',unitId:'unit-p28',unitName:'kg',issuedQty:10,isReceivedByKitchen:false,warehouseId:'warehouse-p28'}]);
  if(path==='/api/workflow-reports/kitchen-issues')return [{id:'issue-line-p28',issueId:'issue-p28',issueCode:'ISS-P28',issueDate:serviceDate,sourceShiftName:'MORNING',shiftName:'MORNING',ingredientId:'ingredient-p28',ingredientName:'Gạo Phase 28',unitId:'unit-p28',unitName:'kg',issuedQty:10,isReceivedByKitchen:false,warehouseId:'warehouse-p28'}];
  if(path==='/api/inventory-returns')return pageData([]);
  if(path==='/api/workflow-reports/workflow-documents')return [{documentId:'document-p28',documentCode:'RET-P28',documentType:'Phiếu hoàn kho',documentDate:serviceDate,status:'DRAFT',ownerLane:'Bếp',summary:'Phiếu trả Phase 28',route:'/chef-dashboard',shiftName:'MORNING'}];
  if(path==='/api/workflow-reports/stock-movements')return [{movementId:'movement-p28',movementDate:`${serviceDate}T02:00:00Z`,movementType:'RETURN',documentCode:'RET-P28',ingredientName:'Gạo Phase 28',quantity:1,unitName:'kg',warehouseName:'Kho Phase 28'}];
  if(path.startsWith('/api/service-runs/'))return null;
  return [];
}
export function empty(path:string){return path==='/api/workflow-reports/kitchen-issues/page'||path==='/api/inventory-returns'?pageData([]):path==='/api/production-plans/daily'?{totalPlans:0,sentPlans:0,totalServings:0,warnings:[],plans:[]}:[];}
export const apiPatterns=['**/api/auth/profile','**/api/dishes/catalog','**/api/production-plans/daily**','**/api/workflow-reports/kitchen-issues/page**','**/api/workflow-reports/kitchen-issues**','**/api/inventory-returns**','**/api/workflow-reports/workflow-documents**','**/api/workflow-reports/stock-movements**','**/api/service-runs/by-plan**','**/api/service-runs/scope**'];
export async function installApi(page:Page,region:Region,state:CreatedState){let release!:()=>void;const deferred=new Promise<void>(resolve=>{release=resolve;});const owned=owners[region].endpoint;const handler=async(route:Route)=>{const url=new URL(route.request().url());const path=url.pathname;if(path==='/api/auth/profile')return json(route,profile);if(path===owned&&state==='initial-loading')await deferred;if(path===owned&&state==='error-no-data')return route.fulfill({status:500,contentType:'application/json',body:JSON.stringify({success:false,message:`${region} Phase 28 failure`})});return json(route,state==='truly-empty'&&path===owned?empty(path):populated(path,url));};for(const pattern of apiPatterns)await page.route(pattern,handler);return release;}
export async function login(page:Page){await page.addInitScript(user=>{localStorage.clear();sessionStorage.clear();sessionStorage.setItem('token','dev-login-fallback-token-phase28-chef');localStorage.setItem('user',JSON.stringify({...user,id:user.userId}));},profile);await page.goto('/chef-dashboard');await expect(page).toHaveURL(/\/chef-dashboard/);await expect(page.locator('.ipc-app-shell')).toBeVisible();}
export function seam(page:Page,region:Region,state:CreatedState):Locator{if(state==='initial-loading')return page.getByText(`Đang tải ${region==='chef-production'?'kế hoạch sản xuất trong ngày':region==='chef-material-checklist'?'phiếu xuất kho bàn giao cho bếp':'chứng từ bếp'}`);if(state==='error-no-data')return page.getByRole('heading',{name:`Không tải được ${region==='chef-production'?'kế hoạch sản xuất trong ngày':region==='chef-material-checklist'?'phiếu xuất kho bàn giao cho bếp':'chứng từ bếp'}`,exact:true});if(region==='chef-production')return page.getByRole('region',{name:'Kế hoạch điều phối trong ngày'});if(region==='chef-material-checklist')return page.locator('.ipc-chef-checklist-panel:visible');return page.locator('.ipc-chef-documents-panel:visible');}
export function dispositionFindings(row:ReturnType<typeof registerChefDashboardQueryIdentity>):UiAuditFinding[]{if(row.disposition.kind==='measure')throw new Error(`measured identity passed to disposition writer: ${identityKey(row)}`);const identity=identityKey(row);return UI_AUDIT_RULE_IDS.map(ruleId=>({ruleId,identity,verdict:row.disposition.kind==='not-applicable'?'NOT_APPLICABLE':'NEEDS_EVIDENCE',measured:{productionRouteMeasured:false,reason:row.disposition.reason}}));}
