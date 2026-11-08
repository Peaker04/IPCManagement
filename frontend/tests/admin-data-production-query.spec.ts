import {
  expect,
  test,
  type Locator,
  type Page,
  type Route,
} from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import {
  UI_AUDIT_FIXTURE_VERSION,
  UI_AUDIT_SCHEMA_VERSION,
  routeMeasuredFinding,
  validateUiAuditRecord,
  type UiAuditFinding,
  type UiAuditRecord,
} from "./uiAuditContract";
import { isLedgerRequest } from "./uiAuditEvidence";
import {
  identityKey,
  REGION_INVENTORY,
  UI_AUDIT_VIEWPORTS,
} from "./uiAuditInventory";
import { UI_AUDIT_RULE_IDS } from "./uiAuditOracleRegistry";
import {
  ADMIN_DATA_QUERY_DISPOSITION_REASONS,
  expandProductionQueryIdentities,
  registerAdminDataQueryIdentity,
} from "./uiAuditProductionQueryAdapter";

type CreatedState =
  "initial-loading" | "populated" | "truly-empty" | "error-no-data";
type Region = (typeof REGION_INVENTORY)["/admin-data"][number];

const profile = {
  userId: "admin-phase28",
  username: "admin-phase28",
  fullName: "Quản trị Phase 28",
  role: "admin",
  roleCode: "ADMIN",
  roleName: "Quản trị viên",
  isAdminFullAccess: true,
  permissions: ["*"],
};
const owners: Record<
  Region,
  { endpoint: string; view: string; ownership: string }
> = {
  "admin-entities": {
    endpoint: "/api/dishes/catalog",
    view: "bom-import",
    ownership: "bom-active-first",
  },
  "admin-imports": {
    endpoint: "/api/ingredients",
    view: "bom-import",
    ownership: "bom-active-first-co-owned",
  },
  "admin-data-quality": {
    endpoint: "/api/workflow-reports/data-quality/page",
    view: "cleanup",
    ownership: "cleanup-active-first",
  },
  "admin-cleanup": {
    endpoint: "/api/workflow-reports/audit-changes/page",
    view: "audit",
    ownership: "audit-active-first",
  },
};
const pageData = (items: unknown[]) => ({
  items,
  totalCount: items.length,
  pageNumber: 1,
  pageSize: 8,
  totalPages: items.length ? 1 : 0,
  hasPrev: false,
  hasNext: false,
});
const dish = {
  dishId: "dish-phase28",
  dishCode: "MON-P28",
  dishName: "Món Phase 28",
  isActive: true,
  menuSlots: [],
  bomLines: [],
};
const ingredient = {
  ingredientId: "ingredient-phase28",
  ingredientCode: "NL-P28",
  ingredientName: "Gạo Phase 28",
  isActive: true,
  unitId: "unit-kg",
  unitName: "kg",
};
const quality = {
  generatedAt: "2026-08-23T01:00:00Z",
  totalIssues: 1,
  isTruncated: false,
  errorCount: 1,
  warningCount: 0,
  resolvedIssueCount: 0,
  reopenedIssueCount: 0,
  urgentIssueCount: 1,
  missingBomCount: 1,
  invalidUnitCount: 0,
  missingConversionCount: 0,
  negativeStockCount: 0,
  orphanDocumentCount: 0,
  page: pageData([
    {
      issueId: "quality-phase28",
      category: "missing_bom",
      severity: "error",
      message: "Món Phase 28 chưa có BOM",
      remediationStatus: "open",
      slaLabel: "Gấp",
      priorityRank: 1,
      owner: "ADMIN",
      entityId: "dish-phase28",
      entityCode: "MON-P28",
      entityName: "Dish",
      entityLabel: "Món Phase 28",
      suggestedAction: "Bổ sung BOM Phase 28",
      route: "/admin-data?view=bom-import",
    },
  ]),
};
const audit = {
  auditId: "audit-phase28",
  changedAt: "2026-08-23T01:00:00Z",
  changedBy: "admin-phase28",
  changedByName: "Quản trị Phase 28",
  businessArea: "Quản trị dữ liệu",
  entityName: "Dish",
  entityId: "dish-phase28",
  fieldName: "BOM",
  oldValue: "0",
  newValue: "1",
  reason: "Đối soát Phase 28",
};
const identities = expandProductionQueryIdentities()
  .filter(({ route }) => route === "/admin-data")
  .map(registerAdminDataQueryIdentity);
const records: UiAuditRecord[] = [];
const completedRegions = new Set<Region>();
const output = resolve(
  process.env.UI_AUDIT_OUTPUT_ROOT ?? resolve(process.cwd(), "test-results"),
  "ui-audit-phase28-admin-data-query-states.json",
);

async function json(route: Route, data: unknown) {
  await route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ success: true, message: "OK", data }),
  });
}
function dataFor(path: string, populated: boolean) {
  if (path === "/api/dishes/catalog") return populated ? [dish] : [];
  if (path === "/api/ingredients")
    return pageData(populated ? [ingredient] : []);
  if (
    path === "/api/coordination/customer-contracts" ||
    path === "/api/coordination/customers"
  )
    return [];
  if (path === "/api/coordination/orders") return pageData([]);
  if (path === "/api/coordination/weekly-menu/import-history") return [];
  if (path === "/api/purchase-workflow/workbench")
    return { stageCounts: {}, serviceDates: [], totalItems: 0, items: [] };
  if (path === "/api/workflow-reports/data-quality/page")
    return populated
      ? quality
      : {
          ...quality,
          totalIssues: 0,
          errorCount: 0,
          urgentIssueCount: 0,
          missingBomCount: 0,
          page: pageData([]),
        };
  if (path === "/api/workflow-reports/audit-changes/page")
    return {
      items: populated ? [audit] : [],
      limit: 8,
      hasNext: false,
      nextCursorOffset: 0,
    };
  throw new Error(`unstubbed Admin Data production GET dependency: ${path}`);
}
async function installApi(page: Page, region: Region, state: CreatedState) {
  let release!: () => void;
  const deferred = new Promise<void>((resolveRelease) => {
    release = resolveRelease;
  });
  const owned = owners[region].endpoint;
  await page.route("**/api/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (!path.startsWith("/api/")) return route.continue();
    if (path === "/api/auth/profile") return json(route, profile);
    if (path === owned && state === "initial-loading") await deferred;
    if (path === owned && state === "error-no-data")
      return route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({
          success: false,
          message: `${region} Phase 28 failure`,
        }),
      });
    return json(route, dataFor(path, path === owned && state === "populated"));
  });
  return release;
}
async function login(page: Page, region: Region) {
  await page.addInitScript((user) => {
    localStorage.clear();
    sessionStorage.clear();
    sessionStorage.setItem(
      "token",
      "dev-login-fallback-token-phase28-admin-data",
    );
    localStorage.setItem("user", JSON.stringify({ ...user, id: user.userId }));
  }, profile);
  await page.goto(`/admin-data?view=${owners[region].view}`, {
    waitUntil: "domcontentloaded",
  });
  await expect(page).toHaveURL(/\/admin-data/);
  await expect(page.locator(".ipc-app-shell")).toBeVisible();
  await page.addStyleTag({
    content:
      'nav[aria-label="Điều hướng chính"]{pointer-events:none!important}',
  });
}
async function seam(
  page: Page,
  region: Region,
  state: CreatedState,
): Promise<Locator> {
  if (state === "initial-loading")
    return page.getByText(
      new RegExp(
        `Đang tải ${region === "admin-entities" ? "danh mục món và BOM" : region === "admin-imports" ? "danh mục nguyên liệu" : region === "admin-data-quality" ? "chất lượng dữ liệu" : "nhật ký thay đổi"}`,
      ),
    );
  if (state === "error-no-data")
    return page.getByRole("heading", {
      name: new RegExp(
        `Không tải được ${region === "admin-entities" ? "danh mục món và BOM" : region === "admin-imports" ? "danh mục nguyên liệu" : region === "admin-data-quality" ? "chất lượng dữ liệu" : "nhật ký thay đổi"}`,
      ),
    });
  if (region === "admin-entities") {
    if (state !== "populated")
      return page.locator(".ipc-bom-current-table tbody tr").first();
    await page
      .getByRole("button", { name: "Thêm dòng" })
      .evaluate((button) => (button as HTMLButtonElement).click());
    await page
      .locator("#manual-bom-dish")
      .evaluate((control) => (control as HTMLElement).click());
    return page.getByRole("option", { name: /MON-P28 - Món Phase 28/ });
  }
  if (region === "admin-imports") {
    await page
      .getByRole("button", { name: "Thêm dòng" })
      .evaluate((button) => (button as HTMLButtonElement).click());
    if (state === "populated") {
      await page
        .locator("#manual-bom-ingredient")
        .evaluate((control) => (control as HTMLElement).click());
      return page.getByRole("option", { name: /NL-P28 - Gạo Phase 28/ });
    }
    return page.getByRole("dialog", { name: "Thêm dòng BOM" });
  }
  if (region === "admin-data-quality")
    return state === "populated"
      ? page.getByText("Món Phase 28 chưa có BOM")
      : page.locator(".ipc-admin-quality-table tbody tr").first();
  return state === "populated"
    ? page.getByText("Đối soát Phase 28")
    : page.locator(".ipc-admin-audit-table");
}
function dispositionFindings(
  row: ReturnType<typeof registerAdminDataQueryIdentity>,
): UiAuditFinding[] {
  if (row.disposition.kind === "measure")
    throw new Error(
      `measured identity passed to disposition writer: ${identityKey(row)}`,
    );
  const identity = identityKey(row);
  return UI_AUDIT_RULE_IDS.map((ruleId) => ({
    ruleId,
    identity,
    verdict:
      row.disposition.kind === "not-applicable"
        ? "NOT_APPLICABLE"
        : "NEEDS_EVIDENCE",
    measured: {
      productionRouteMeasured: false,
      reason: row.disposition.reason,
    },
  }));
}

test.describe("Phase 28 Admin Data production-route query-state adapters", () => {
  test.describe.configure({ mode: "serial" });

  test.beforeAll(() => {
    records.length = 0;
    completedRegions.clear();
    rmSync(output, { force: true });
  });

  for (const region of REGION_INVENTORY["/admin-data"])
    test(`records the 28 measured ${region} identities`, async ({
      browser,
    }) => {
      test.setTimeout(480_000);
      const regionRecords: UiAuditRecord[] = [];
      for (const viewport of UI_AUDIT_VIEWPORTS)
        for (const state of [
          "initial-loading",
          "populated",
          "truly-empty",
          "error-no-data",
        ] as const) {
          const observed: UiAuditRecord["network"] = [];
          const context = await browser.newContext({
            viewport: { width: viewport.width, height: viewport.height },
            baseURL: "http://127.0.0.1:5173",
          });
          const page = await context.newPage();
          page.on("request", (request) => {
            if (
              isLedgerRequest(
                request.url(),
                request.method(),
                request.resourceType(),
                "http://127.0.0.1:5173",
              )
            )
              observed.push({
                method: request.method(),
                url: request.url(),
                resourceType: request.resourceType(),
                classification: request.url().includes("/api/")
                  ? "api"
                  : "non-static",
              });
          });
          await page.route("**/*", (route) =>
            !["GET", "HEAD"].includes(route.request().method())
              ? route.abort()
              : route.continue(),
          );
          const release = await installApi(page, region, state);
          await login(page, region);
          const zoom =
            "textZoomPercent" in viewport ? viewport.textZoomPercent : 100;
          const style =
            zoom === 100
              ? undefined
              : await page.addStyleTag({
                  content: `html{font-size:${zoom}%!important}`,
                });
          const target = await seam(page, region, state);
          await expect(target).toBeVisible({ timeout: 8_000 });
          const row = identities.find(
            (item) =>
              item.viewport === viewport.id &&
              item.state === state &&
              item.regionId === region,
          )!;
          const identity = identityKey(row);
          const axe = await new AxeBuilder({ page })
            .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
            .analyze();
          const metrics = await page.evaluate(() => {
            const visible = [
              ...document.querySelectorAll<HTMLElement>(
                "input,select,textarea,button,a[href]",
              ),
            ].filter((element) => {
              const rect = element.getBoundingClientRect();
              return rect.width > 0 && rect.height > 0;
            });
            const tables = [
              ...document.querySelectorAll<HTMLTableElement>("table"),
            ].filter((element) => element.offsetParent !== null);
            return {
              h1Count: [...document.querySelectorAll("h1")].filter(
                (element) => (element as HTMLElement).offsetParent !== null,
              ).length,
              mainCount: [...document.querySelectorAll("main")].filter(
                (element) => (element as HTMLElement).offsetParent !== null,
              ).length,
              unnamed: visible.filter(
                (element) =>
                  !(
                    element.getAttribute("aria-label") ||
                    element.getAttribute("aria-labelledby") ||
                    element.textContent?.trim() ||
                    element.getAttribute("title")
                  ),
              ).length,
              overflowPx: Math.max(
                0,
                document.documentElement.scrollWidth - innerWidth,
              ),
              tableCount: tables.length,
              theadCount: tables.reduce(
                (count, table) =>
                  count + table.querySelectorAll("thead").length,
                0,
              ),
            };
          });
          const serious = axe.violations.filter(
            (violation) =>
              violation.impact === "serious" || violation.impact === "critical",
          );
          const finding = (
            ruleId: string,
            passed: boolean,
            value: Record<string, unknown>,
            expected: string,
          ) =>
            routeMeasuredFinding({
              ruleId,
              identity,
              productionRouteMeasured: true,
              passed,
              measured: {
                ...value,
                state,
                endpoint: owners[region].endpoint,
                visitOrder: owners[region].ownership,
              },
              expected,
              actual: JSON.stringify(value),
              lowestOwner: "AdminDataPage",
            });
          const findings: UiAuditFinding[] = [
            finding(
              "HIER-01",
              metrics.h1Count === 1 && metrics.mainCount >= 1,
              { h1Count: metrics.h1Count, mainCount: metrics.mainCount },
              "one visible h1 and production main",
            ),
            finding(
              "HIER-02",
              metrics.unnamed === 0,
              { unnamed: metrics.unnamed },
              "zero unnamed controls",
            ),
            finding(
              "A11Y-01",
              serious.length === 0 && metrics.unnamed === 0,
              {
                seriousCount: serious.length,
                ids: serious.map(({ id }) => id),
                unnamed: metrics.unnamed,
              },
              "zero serious/critical violations and unnamed controls",
            ),
            finding(
              "RESP-01",
              metrics.overflowPx <= 2,
              { overflowPx: metrics.overflowPx },
              "at most 2px document overflow",
            ),
            finding(
              "RESP-02",
              metrics.overflowPx <= 2,
              { overflowPx: metrics.overflowPx, textZoomPercent: zoom },
              "no audited-zoom clipping",
            ),
            finding(
              "QUERY-01",
              (await target.count()) >= 1,
              {
                state,
                seamCount: await target.count(),
                endpoint: owners[region].endpoint,
              },
              "owned endpoint renders a state-specific production DOM seam",
            ),
            finding(
              "TABLE-01",
              metrics.theadCount === metrics.tableCount,
              {
                tableCount: metrics.tableCount,
                theadCount: metrics.theadCount,
              },
              "visible production tables have one header each",
            ),
          ];
          const used = new Set(findings.map(({ ruleId }) => ruleId));
          findings.push(
            ...UI_AUDIT_RULE_IDS.filter((ruleId) => !used.has(ruleId)).map(
              (ruleId) => ({
                ruleId,
                identity,
                verdict: "NEEDS_EVIDENCE" as const,
                measured: {
                  productionRouteMeasured: false,
                  reason:
                    "rule is outside Admin Data query-state adapter scope",
                },
              }),
            ),
          );
          const record = {
            schemaVersion: UI_AUDIT_SCHEMA_VERSION,
            fixtureVersion: UI_AUDIT_FIXTURE_VERSION,
            identity,
            fixtureKey: identity,
            findings,
            network: observed,
          };
          validateUiAuditRecord(record);
          regionRecords.push(record);
          if (style) await style.evaluate((node) => node.remove());
          release();
          await context.close();
        }
      expect(regionRecords).toHaveLength(28);
      expect(new Set(regionRecords.map(({ identity }) => identity)).size).toBe(
        28,
      );
      expect(
        regionRecords.every(({ identity }) => identity.includes(`|${region}|`)),
      ).toBe(true);
      records.push(...regionRecords);
      completedRegions.add(region);
    });

  test.afterAll(() => {
    expect([...completedRegions].sort()).toEqual(
      [...REGION_INVENTORY["/admin-data"]].sort(),
    );
    expect(records).toHaveLength(112);
    for (const row of identities.filter(
      ({ disposition }) => disposition.kind !== "measure",
    )) {
      const identity = identityKey(row);
      const record = {
        schemaVersion: UI_AUDIT_SCHEMA_VERSION,
        fixtureVersion: UI_AUDIT_FIXTURE_VERSION,
        identity,
        fixtureKey: identity,
        findings: dispositionFindings(row),
        network: [],
      };
      validateUiAuditRecord(record);
      records.push(record);
    }
    expect(records).toHaveLength(196);
    expect(new Set(records.map(({ identity }) => identity)).size).toBe(196);
    expect(records.map(({ identity }) => identity).sort()).toEqual(
      identities.map(identityKey).sort(),
    );
    expect(
      records.every(
        ({ findings }) => findings.length === UI_AUDIT_RULE_IDS.length,
      ),
    ).toBe(true);
    expect(
      records
        .flatMap(({ network }) => network)
        .filter(({ method }) => !["GET", "HEAD"].includes(method)),
    ).toEqual([]);
    expect(
      records.filter(
        (record) => record.findings[0].verdict === "NOT_APPLICABLE",
      ),
    ).toHaveLength(28);
    expect(
      records.filter(
        (record) => record.findings[0].verdict === "NEEDS_EVIDENCE",
      ),
    ).toHaveLength(56);
    const verdictTotals = records
      .flatMap(({ findings }) => findings)
      .reduce<Record<string, number>>(
        (totals, finding) => (
          (totals[finding.verdict] = (totals[finding.verdict] ?? 0) + 1),
          totals
        ),
        {},
      );
    expect(
      Object.values(verdictTotals).reduce((sum, count) => sum + count, 0),
    ).toBe(196 * UI_AUDIT_RULE_IDS.length);
    const perRule = UI_AUDIT_RULE_IDS.reduce<
      Record<string, Record<string, number>>
    >(
      (totals, ruleId) => (
        (totals[ruleId] = records
          .flatMap(({ findings }) => findings)
          .filter((finding) => finding.ruleId === ruleId)
          .reduce<Record<string, number>>(
            (counts, finding) => (
              (counts[finding.verdict] = (counts[finding.verdict] ?? 0) + 1),
              counts
            ),
            {},
          )),
        totals
      ),
      {},
    );
    expect(
      Object.values(perRule).every(
        (counts) =>
          Object.values(counts).reduce((sum, count) => sum + count, 0) === 196,
      ),
    ).toBe(true);
    mkdirSync(dirname(output), { recursive: true });
    writeFileSync(
      output,
      `${JSON.stringify({ schemaVersion: UI_AUDIT_SCHEMA_VERSION, identityCount: 196, measuredIdentityCount: 112, notApplicableIdentityCount: 28, needsEvidenceIdentityCount: 56, reasons: ADMIN_DATA_QUERY_DISPOSITION_REASONS, verdictTotals, perRule, records }, null, 2)}\n`,
    );
  });
});
