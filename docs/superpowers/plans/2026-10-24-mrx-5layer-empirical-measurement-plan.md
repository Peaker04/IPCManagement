# Kế Hoạch Thực Thi: Đo Kiểm Định Lượng 5 Tầng Toàn Bộ 7 Route Phân Hệ MRX (5-Layer Empirical Measurement Plan)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Xây dựng bộ công cụ đo kiểm định lượng 5 tầng tự động hóa trên trình duyệt Chromium thật và thực thi đo kiểm chi tiết lần lượt toàn bộ 7 Route của chế độ MRX, xuất trình đầy đủ Hồ sơ Đo Kiểm (Dossier) gồm kích thước pixel thực tế, chỉ số tương phản Axe-Core, chỉ số CLS, quét text hygiene và bộ ảnh chụp Retina 2x cho từng màn hình.

**Architecture:** Tạo script Node.js/Playwright chuyên biệt (`scripts/measure-route-5layers.mjs`) tích hợp đo `getBoundingClientRect()`, chạy `@axe-core/playwright`, đo `LayoutShift`, quét regex text và tiêm 6 trạng thái UI. Thực thi tuần tự từng route một; bất kỳ vi phạm nào về kích thước, tương phản, ngõ cụt hay text thô đều phải sửa tận gốc trước khi chuyển route.

**Tech Stack:** Playwright Chromium, Axe-Core (`@axe-core/playwright`), Node.js 20+, React 19, ASP.NET Core 9, MySQL.

**Spec:** `docs/superpowers/specs/2026-10-24-mrx-5layer-empirical-measurement-design.md`

## Global Constraints

- **No Output Trust**: Không coi output text/log trên terminal là bằng chứng; bằng chứng bắt buộc là số liệu đo đạc pixel thật và ảnh chụp độ nét cao lưu trên đĩa.
- **Strict 5-Layer Criteria**:
  - Zone 1 Header: $48\text{px} \le h \le 56\text{px}$
  - Zone 2 Subbar: $40\text{px} \le h \le 44\text{px}$
  - Zone 3 Data Row: $36\text{px} \le h \le 40\text{px}$ (`Rule T8`)
  - CLS: $\le 0.05$
  - WCAG Contrast: $\ge 4.5:1$
  - Text Hygiene: 0 UUID thô, 0 ngày ISO thô, 0 enum tiếng Anh chưa dịch.
- **Zero Dead-Ends**: 100% các màn hình ở mọi trạng thái bắt buộc phải có lối thoát an toàn và nút hành động tiếp theo.

## Review Focus

1. **Đo đạc Bounding Box thực tế**: Header, Subbar và Row data có thực sự đạt chuẩn pixel không hay bị phình to do padding/font?
2. **Độ tương phản chữ/nền**: Có văn bản nào màu xám nhạt bị vi phạm WCAG AA (< 4.5:1) không?
3. **Độ sạch ngôn từ**: Có chuỗi UUID hay enum kỹ thuật nào bị lộ trên giao diện người dùng không?
4. **Độ ổn định layout**: Skeleton có khớp hoàn hảo với bảng thật không khi dữ liệu tải về?
5. **Đồng bộ URL F5**: Reload lại trang có giữ nguyên 100% lô và ngày đang thao tác không?

---

### Task 1: Xây Dựng Bộ Công Cụ Đo Kiểm Định Lượng 5 Tầng (`scripts/measure-route-5layers.mjs`)

**Files:**
- Create: `scripts/measure-route-5layers.mjs`

**Interfaces:**
- CLI: `node scripts/measure-route-5layers.mjs --route <route-id> [--headed|--headless]`
- Methods:
  - `measureGeometry(page)`: Đo chiều cao Zone 1, Zone 2, Zone 3 rows bằng `getBoundingClientRect()`.
  - `measureContrast(page)`: Chạy Axe-Core quét toàn bộ vi phạm WCAG AA.
  - `scanTextHygiene(page)`: Quét regex UUID, ISO date, unmapped enums trên text content.
  - `measureCls(page)`: Đo Cumulative Layout Shift.
  - `capture6States(page, config)`: Ép và chụp 6 ảnh Retina 2x.
- Output: Thư mục `.artifacts/5layer-audits/<route-id>/` chứa bảng số liệu và ảnh.

- [ ] **Step 1: Write `scripts/measure-route-5layers.mjs`**

Implement the full measurement engine with Playwright and Axe-Core.

- [ ] **Step 2: Verify runner script with dry run**

Run: `node scripts/measure-route-5layers.mjs --help`
Expected: Output displaying available routes and options.

- [ ] **Step 3: Commit measurement tool**

```bash
git add scripts/measure-route-5layers.mjs
git commit -m "feat(audit-engine): build 5-layer empirical measurement runner with geometry, a11y and text hygiene"
```

---

### Task 2: Đo Kiểm Định Lượng 5 Tầng Cho Route 1 (`/login` & Landing)

**Files:**
- Output: `.artifacts/5layer-audits/route1-login/`
  - `5LAYER-AUDIT-DOSSIER.md`
  - `01-login-screen.png`
  - `02-login-error.png`
  - `03-landing-coordinator.png`
  - `04-landing-warehouse.png`
  - `05-landing-chef.png`
  - `06-landing-manager.png`

- [ ] **Step 1: Run 5-Layer Measurement on Route 1**

Run: `node scripts/measure-route-5layers.mjs --route login`
Expected: Đo đạc hình học form, đo tương phản nút bấm, đo chính xác landing URL cho cả 4 vai trò.

- [ ] **Step 2: Fix any geometry, contrast, or navigation issues found on Route 1**

Remediate any measured defect directly in source code.

- [ ] **Step 3: Commit Route 1 dossier and fixes**

```bash
git add .artifacts/5layer-audits/route1-login/
git commit -m "audit(route1): complete 5-layer empirical measurement for login and landing resolution"
```

---

### Task 3: Đo Kiểm Định Lượng 5 Tầng Cho Route 2 (`/weekly-menu?view=mrx-batch`)

**Files:**
- Output: `.artifacts/5layer-audits/route2-mrx-batch/`
  - `5LAYER-AUDIT-DOSSIER.md`
  - 6 ảnh Retina 2x ứng với 6 trạng thái UI

- [ ] **Step 1: Run 5-Layer Measurement on Route 2**

Run: `node scripts/measure-route-5layers.mjs --route mrx-batch`
Expected: Đo đạc Zone 1 (56px), Zone 2 (44px), DataGrid rows (36-40px), CLS <= 0.05, 0 raw UUID.

- [ ] **Step 2: Fix any measured defects in `MrxBatchWorkbench.tsx`**

Remediate any geometry, contrast, or state defect.

- [ ] **Step 3: Commit Route 2 dossier and fixes**

```bash
git add .artifacts/5layer-audits/route2-mrx-batch/
git commit -m "audit(route2): complete 5-layer empirical measurement for mrx batch workbench"
```

---

### Task 4: Đo Kiểm Định Lượng 5 Tầng Cho Route 3 (`/warehouse?view=mrx-daily`)

**Files:**
- Output: `.artifacts/5layer-audits/route3-warehouse-daily/`
  - `5LAYER-AUDIT-DOSSIER.md`
  - 6 ảnh Retina 2x ứng với 6 trạng thái UI

- [ ] **Step 1: Run 5-Layer Measurement on Route 3**

Run: `node scripts/measure-route-5layers.mjs --route warehouse-daily`
Expected: Đo đạc hàng bảng xuất kho (36-40px), modal xuất bổ sung, F5 URL persistence.

- [ ] **Step 2: Fix any measured defects in `MrxDailyIssueWorkbench.tsx`**

Remediate any geometry, contrast, or state defect.

- [ ] **Step 3: Commit Route 3 dossier and fixes**

```bash
git add .artifacts/5layer-audits/route3-warehouse-daily/
git commit -m "audit(route3): complete 5-layer empirical measurement for warehouse daily issue"
```

---

### Task 5: Đo Kiểm Định Lượng 5 Tầng Cho Route 4 & 5 (`/warehouse?view=mrx-preparation` & `mrx-issues`)

**Files:**
- Output: `.artifacts/5layer-audits/route4-warehouse-preparation/` & `route5-warehouse-issues/`
  - `5LAYER-AUDIT-DOSSIER.md`
  - Bộ ảnh Retina 2x ứng với các trạng thái UI

- [ ] **Step 1: Run 5-Layer Measurement on Route 4 & 5**

Run: `node scripts/measure-route-5layers.mjs --route warehouse-prep-and-issues`
Expected: Đo đạc bảng gom nhóm nguyên liệu, banner PreparationGroupId, delta queue modal.

- [ ] **Step 2: Fix any measured defects in `MrxMultiCustomerPreparationWorkbench.tsx` & `MrxSourceDeltaWorkbench.tsx`**

Remediate any defect directly.

- [ ] **Step 3: Commit Route 4 & 5 dossiers and fixes**

```bash
git add .artifacts/5layer-audits/route4-warehouse-preparation/ .artifacts/5layer-audits/route5-warehouse-issues/
git commit -m "audit(route4-5): complete 5-layer empirical measurement for preparation and delta workbenches"
```

---

### Task 6: Đo Kiểm Định Lượng 5 Tầng Cho Route 6 (`/chef?view=mrx-cooking`)

**Files:**
- Output: `.artifacts/5layer-audits/route6-chef-cooking/`
  - `5LAYER-AUDIT-DOSSIER.md`
  - Bộ ảnh Retina 2x ứng với các trạng thái UI

- [ ] **Step 1: Run 5-Layer Measurement on Route 6**

Run: `node scripts/measure-route-5layers.mjs --route chef-cooking`
Expected: Đo đạc thẻ nấu món ăn, quét DOM xác nhận 0 nút mutation, kiểm chứng in A4 @media print.

- [ ] **Step 2: Fix any measured defects in `MrxCookingWorkbench.tsx`**

Remediate any defect directly.

- [ ] **Step 3: Commit Route 6 dossier and fixes**

```bash
git add .artifacts/5layer-audits/route6-chef-cooking/
git commit -m "audit(route6): complete 5-layer empirical measurement for chef mrx cooking workbench"
```

---

### Task 7: Đo Kiểm Định Lượng 5 Tầng Cho Route 7 (`/reconciliation`)

**Files:**
- Output: `.artifacts/5layer-audits/route7-reconciliation/`
  - `5LAYER-AUDIT-DOSSIER.md`
  - 6 ảnh Retina 2x ứng với 6 trạng thái UI

- [ ] **Step 1: Run 5-Layer Measurement on Route 7**

Run: `node scripts/measure-route-5layers.mjs --route reconciliation`
Expected: Đo đạc 5 queue cards, dòng chênh lệch 2 chiều, Blocker Resolution Strip, modal chốt tuần.

- [ ] **Step 2: Fix any measured defects in `ReconciliationPage.tsx` & `ReconciliationBlockerStrip.tsx`**

Remediate any defect directly.

- [ ] **Step 3: Commit Route 7 dossier and fixes**

```bash
git add .artifacts/5layer-audits/route7-reconciliation/
git commit -m "audit(route7): complete 5-layer empirical measurement for reconciliation control tower"
```

---

### Task 8: Tổng Hợp Hồ Sơ Nghiệm Thu 5 Tầng Toàn Dự Án & Regression Sign-off

**Files:**
- Output: `.artifacts/5layer-audits/MASTER-5LAYER-AUDIT-SUMMARY.md`
- Execute: `npm run verify`
- Execute: `node scripts/run-mrx-e2e-mutation-test.mjs`
- Update: `.planning/WORK.md` và `docs/handoff/HANDOFF.md`

- [ ] **Step 1: Run full verification suite across all 12 gates**

Run: `npm run verify`
Expected: ALL 12 gates PASS

- [ ] **Step 2: Run Headed E2E Mutation Sandbox Runner**

Run: `node scripts/run-mrx-e2e-mutation-test.mjs`
Expected: 8/8 stages PASS in under 40 seconds

- [ ] **Step 3: Generate Master 5-Layer Summary Dossier**

Assemble all 7 route measurement results into `MASTER-5LAYER-AUDIT-SUMMARY.md`.

- [ ] **Step 4: Commit & Push to GitHub**

```bash
git add .planning/WORK.md docs/handoff/HANDOFF.md .artifacts/5layer-audits/
git commit -m "chore(release): complete master 5-layer empirical measurement program across all mrx routes"
git push origin feature/greenfield-fe-3zone-workbench
```
