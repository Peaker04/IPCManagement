import { chromium } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
const stage = process.argv[2];
const actors = {
  quality: ["thukho", "IPC_LANE7_WAREHOUSE_PASSWORD"],
  approve: ["quanly", "IPC_LANE7_MANAGER_PASSWORD"],
  post: ["admin", "IPC_LANE7_ADMIN_PASSWORD"],
};
if (!actors[stage]) throw new Error("stage must be quality, approve or post");
const [username, passwordKey] = actors[stage];
const output = path.resolve(
  `.artifacts/shipyard-live/phase-05-multi-customer-lifecycle/golden/receipt-${stage}`,
);
const mysql = "C:/Program Files/MySQL/MySQL Server 9.5/bin/mysql.exe";
const mq = (sql) =>
  execFileSync(
    mysql,
    [
      "--host=localhost",
      "--port=3306",
      "--user=root",
      "--database=ipc_lane7",
      "--batch",
      "--raw",
      `--execute=${sql}`,
    ],
    {
      encoding: "utf8",
      env: { ...process.env, MYSQL_PWD: process.env.IPC_LANE7_MYSQL_PASSWORD },
    },
  );
const result = {
  verdict: "RUNNING",
  stage,
  lane: "ipc_lane7",
  protectedLaneConnectionAttempts: 0,
  actions: [],
  requests: [],
  consoleErrors: [],
  pageErrors: [],
  requestFailures: [],
  physicalInput: {
    pointerTrusted: false,
    keyboardTrusted: false,
    workaroundAccepted: false,
  },
  uiEvidence: null,
};
let browser, context;
await mkdir(output, { recursive: true });
try {
  const where =
    stage === "quality"
      ? "ir.status='DRAFT'"
      : stage === "approve"
        ? "ir.status='PENDING_APPROVAL'"
        : "ir.status='APPROVED'";
  const pending = mq(
    `SELECT ir.receiptCode FROM inventoryreceipts ir JOIN purchaseorders po ON po.purchaseOrderId=ir.purchaseOrderId JOIN purchaserequests pr ON pr.purchaseRequestId=po.purchaseRequestId WHERE pr.purchaseForDate BETWEEN '2026-08-10' AND '2026-08-15' AND ${where} ORDER BY pr.purchaseForDate;`,
  )
    .trim()
    .split(/\r?\n/)
    .slice(1)
    .filter(Boolean);
  browser = await chromium.launch({
    channel: "chrome",
    headless: false,
    args: ["--window-size=1365,900"],
  });
  context = await browser.newContext({
    viewport: { width: 1365, height: 900 },
  });
  await context.exposeBinding(
    "__p05rl",
    (_s, k) => (result.physicalInput[`${k}Trusted`] = true),
  );
  await context.addInitScript(() => {
    addEventListener(
      "pointerdown",
      (e) => {
        if (e.isTrusted) void globalThis.__p05rl("pointer");
      },
      true,
    );
    addEventListener(
      "keydown",
      (e) => {
        if (e.isTrusted) void globalThis.__p05rl("keyboard");
      },
      true,
    );
  });
  const page = await context.newPage();
  page.on("console", (m) => {
    if (m.type() === "error" && !m.text().includes("status of 403"))
      result.consoleErrors.push(m.text());
  });
  page.on("pageerror", (e) => result.pageErrors.push(e.message));
  page.on("requestfailed", (r) => {
    if (r.failure()?.errorText !== "net::ERR_ABORTED")
      result.requestFailures.push({
        path: new URL(r.url()).pathname,
        failure: r.failure()?.errorText,
      });
  });
  page.on("response", (r) => {
    const p = new URL(r.url()).pathname;
    if (p.startsWith("/api/") && r.request().method() !== "GET")
      result.requests.push({
        method: r.request().method(),
        path: p,
        status: r.status(),
      });
  });
  await page.goto("http://127.0.0.1:3030/login", {
    waitUntil: "domcontentloaded",
  });
  await page.locator("#username").click();
  await page.keyboard.type(username);
  await page.locator("#password").click();
  await page.keyboard.type(process.env[passwordKey]);
  await Promise.all([
    page.waitForURL((u) => !u.pathname.endsWith("/login")),
    page.getByRole("button", { name: "Đăng nhập", exact: true }).click(),
  ]);
  if (stage === "approve") {
    await page.goto("http://127.0.0.1:3030/approvals", {
      waitUntil: "domcontentloaded",
    });
    await page
      .waitForLoadState("networkidle", { timeout: 20000 })
      .catch(() => {});
    const search = page.locator("#approval-inbox-search");
    for (const code of pending) {
      await search.click();
      await page.keyboard.press("Control+A");
      await page.keyboard.type(code);
      const rows = page.locator("article.ipc-approval-record");
      await rows.first().waitFor({ state: "visible" });
      await page.waitForTimeout(350);
      if ((await rows.count()) !== 1)
        throw new Error(
          `${code} search returned ${await rows.count()} records`,
        );
      const row = rows.first();
      if (!result.uiEvidence) {
        const viewport = page.getByTestId("approval-queue-viewport");
        const toggle = row.getByRole("button", {
          name: /Xem thêm \d+ nguyên liệu/,
        });
        const collapsedHeight = await viewport.evaluate(
          (element) => element.getBoundingClientRect().height,
        );
        const toggleLabel = await toggle.textContent();
        const remainingCount = Number(toggleLabel?.match(/\d+/)?.[0] ?? 0);
        await toggle.focus();
        await page.keyboard.press("Enter");
        await row
          .getByRole("button", { name: "Thu gọn danh sách nguyên liệu" })
          .waitFor();
        const expandedItems = await row
          .locator(".ipc-approval-zone-materials li")
          .count();
        await page.screenshot({
          path: path.join(output, "approval-materials-expanded.png"),
          fullPage: true,
        });
        result.uiEvidence = {
          collapsedViewportHeight: collapsedHeight,
          fixedLoadingHeight: 512,
          toggleLabel,
          remainingCount,
          expandedItems,
          keyboardExpanded: true,
          technicalFallbackVisible: await row
            .getByText(/Và \d+ nguyên liệu khác/)
            .count(),
        };
        if (collapsedHeight >= 512 || expandedItems !== remainingCount + 4)
          throw new Error(
            "Approval queue layout/material disclosure gate failed",
          );
      }
      await row
        .getByRole("button", { name: "Duyệt chứng từ", exact: true })
        .click();
      const dialog = page.getByRole("dialog");
      const rp = page.waitForResponse(
        (r) =>
          r.request().method() === "POST" &&
          new URL(r.url()).pathname.includes(
            "/api/approvals/inventory-receipt/",
          ),
      );
      await dialog
        .getByRole("button", { name: "Duyệt chứng từ", exact: true })
        .click();
      const resp = await rp;
      if (resp.status() !== 200)
        throw new Error(`${code} approval ${resp.status()}`);
      await dialog.waitFor({ state: "detached" });
      result.actions.push(code);
    }
  } else {
    await page.goto("http://127.0.0.1:3030/warehouse?week=2026-08-10", {
      waitUntil: "domcontentloaded",
    });
    await page
      .waitForLoadState("networkidle", { timeout: 20000 })
      .catch(() => {});
    for (const code of pending) {
      const row = page.getByRole("row").filter({ hasText: code }).first();
      await row.getByRole("button", { name: "Xem trạng thái" }).click();
      const detail = page.getByTestId("receipt-lifecycle-detail");
      await detail.getByText(code, { exact: false }).waitFor();
      const actionName =
        stage === "quality" ? "Kiểm tra chất lượng" : "Ghi sổ kho";
      await detail.getByRole("button", { name: actionName }).click();
      const dialog = page.getByRole("dialog");
      const endpoint = stage === "quality" ? "/quality" : "/post";
      const rp = page.waitForResponse(
        (r) =>
          r.request().method() === "POST" &&
          new URL(r.url()).pathname.endsWith(endpoint),
      );
      await dialog
        .getByRole("button", {
          name: stage === "quality" ? "Lưu kết quả" : "Xác nhận ghi sổ kho",
        })
        .click();
      const resp = await rp;
      if (resp.status() !== 200)
        throw new Error(
          `${code} ${stage} ${resp.status()}: ${JSON.stringify(await resp.json().catch(() => null))}`,
        );
      await dialog.waitFor({ state: "detached" });
      result.actions.push(code);
      await page.waitForTimeout(250);
    }
  }
  const expected =
    stage === "quality"
      ? "PENDING_APPROVAL"
      : stage === "approve"
        ? "APPROVED"
        : "POSTED";
  result.dbPostflight = mq(
    `SELECT ir.status,COUNT(DISTINCT ir.receiptId) receiptCount,COUNT(irl.receiptLineId) lineCount FROM inventoryreceipts ir JOIN inventoryreceiptlines irl ON irl.receiptId=ir.receiptId JOIN purchaseorders po ON po.purchaseOrderId=ir.purchaseOrderId JOIN purchaserequests pr ON pr.purchaseRequestId=po.purchaseRequestId WHERE pr.purchaseForDate BETWEEN '2026-08-10' AND '2026-08-15' GROUP BY ir.status;`,
  ).trim();
  if (!result.dbPostflight.includes(`${expected}\t6\t584`))
    throw new Error(`${stage} postflight failed`);
  if (
    !result.physicalInput.pointerTrusted ||
    !result.physicalInput.keyboardTrusted ||
    result.consoleErrors.length ||
    result.pageErrors.length ||
    result.requestFailures.length
  )
    throw new Error("Physical/browser gate failed");
  result.verdict = "PASS";
} catch (e) {
  result.verdict = "FAIL";
  result.failure = String(e?.stack ?? e);
} finally {
  if (context) await context.close().catch(() => {});
  if (browser) await browser.close().catch(() => {});
  result.finishedAtUtc = new Date().toISOString();
  const s = JSON.stringify(result);
  if (
    s.includes(process.env[passwordKey]) ||
    s.includes(process.env.IPC_LANE7_MYSQL_PASSWORD) ||
    /Bearer\s+|"password"\s*:/i.test(s)
  )
    throw new Error("secret");
  await writeFile(
    path.join(output, "result.json"),
    `${JSON.stringify(result, null, 2)}\n`,
  );
}
if (result.verdict !== "PASS") process.exitCode = 1;
