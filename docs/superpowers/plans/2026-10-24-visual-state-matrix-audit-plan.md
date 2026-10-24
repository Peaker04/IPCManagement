# Kế Hoạch Thực Thi: Đồng Bộ Kiến Trúc & Kiểm Chứng Thị Giác 6 Trạng Thái Màn Hình (Visual State Matrix Plan)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Đồng bộ hóa chính thức kiến trúc component (giải quyết triệt để vấn đề 5 nhóm trong `components/common/`), xây dựng công cụ Playwright Visual State Matrix Runner tự động ép và chụp ảnh 6 trạng thái UI thật trên Chromium, và thực thi kiểm chứng thực tế cho Route 2 (`/weekly-menu?view=mrx-batch`).

**Architecture:** Bảng ánh xạ hợp nhất xác nhận kiến trúc 3-Zone Flat Workbench (`components/workbench/` + 10 primitives trong `components/ui/` + domain features) thay thế cho 45 file cũ của `common/`. Xây dựng kịch bản Node.js/Playwright (`scripts/audit-route-states.mjs`) sử dụng `page.route()` để chặn bắt mạng, ép component hiển thị lần lượt 6 trạng thái (`loading`, `empty`, `error 500`, `403`, `409`, `active`), và lưu ảnh Retina 2x vào `.artifacts/visual-state-audits/`.

**Tech Stack:** Playwright Chromium, Node.js 20+, React 19, TypeScript, Vite, ASP.NET Core 9, Vitest.

**Spec:** `docs/superpowers/specs/2026-10-24-visual-state-matrix-audit-design.md`

## Global Constraints

- **No Console Trust**: Không coi output text/log trên terminal là bằng chứng; bằng chứng bắt buộc là ảnh chụp thực tế từ trình duyệt Chromium lưu trên ổ cứng.
- **Strict 6-State Coverage**: Mỗi màn hình được kiểm toán bắt buộc phải sinh ra đủ 6 tệp ảnh ứng với 6 trạng thái, không bỏ qua bất kỳ trạng thái nào.
- **Retina 2x Resolution**: Ảnh chụp màn hình kích thước chuẩn 2560x1600 (deviceScaleFactor: 2) để kiểm tra độ sắc nét của typography, viền hairline 1px và alignment bảng.

## Review Focus

1. **Khung Skeleton khi Loading**: Có giữ đúng hình học của bảng thật không, hay làm nhảy kích thước (CLS > 0.05).
2. **Giao diện Empty**: Có thông điệp tiếng Việt lịch sự và nút CTA dẫn đường không, hay là ngõ cụt màn hình trắng.
3. **Giao diện Error 500**: Có nút `[Thử lại]` để gọi lại API không.
4. **Giao diện 403 Forbidden**: Có thông báo từ chối quyền rõ ràng không.
5. **Giao diện 409 Conflict**: Có alert ghi đối soát và nút `[Tải lại dữ liệu mới nhất]` không.

---

### Task 1: Đồng Bộ Hóa Tài Liệu Kiến Trúc & Hợp Nhất 5 Nhóm Component

**Files:**
- Modify: `docs/UI-KIT.md`
- Modify: `docs/DESIGN.md`
- Mirror: `C:\Users\Administrator\Desktop\spec_and_plan (1)\spec.md`
- Mirror: `C:\Users\Administrator\Desktop\spec_and_plan (1)\plan.md`

- [ ] **Step 1: Update `docs/UI-KIT.md` with Canonical 5-Group Mapping Table**

Add Section 1.1 "Bảng Ánh Xạ Hợp Nhất 5 Nhóm Component Cũ Sang 3-Zone Workbench" explaining the transition from the old 45 files in `components/common/` to `components/workbench/` + `components/ui/` + `features/*`.

- [ ] **Step 2: Update `docs/DESIGN.md` and mirror files in Desktop `spec_and_plan (1)`**

Sync the architectural clarification into `spec.md` and `plan.md` on Desktop, confirming that 3-Zone Flat Workbench is the sole authoritative standard.

- [ ] **Step 3: Commit documentation synchronization**

```bash
git add docs/UI-KIT.md docs/DESIGN.md
git commit -m "docs(architecture): clarify 5-group common component consolidation into 3-zone flat workbench"
```

---

### Task 2: Xây Dựng Công Cụ Kiểm Chứng Thị Giác 6 Trạng Thái (`audit-route-states.mjs`)

**Files:**
- Create: `scripts/audit-route-states.mjs`

**Interfaces:**
- CLI usage: `node scripts/audit-route-states.mjs --route <route-id> [--headless]`
- Produces: 6 PNG files and 1 `AUDIT-REPORT.md` inside `.artifacts/visual-state-audits/<route-id>/`.
- Network mock: Uses Playwright `page.route()` to systematically inject:
  - Delay 1500ms for Loading
  - Empty JSON for Empty
  - HTTP 500 for Error
  - HTTP 403 for Forbidden
  - HTTP 409 for Conflict
  - Pass-through live API for Active

- [ ] **Step 1: Write `scripts/audit-route-states.mjs`**

Implement the automated state injector and screenshot capturer with full error handling and visual report generator.

- [ ] **Step 2: Verify runner script with `--help` or dry run**

Run: `node scripts/audit-route-states.mjs --help`
Expected: Output showing available routes and options.

- [ ] **Step 3: Commit runner script**

```bash
git add scripts/audit-route-states.mjs
git commit -m "feat(audit-tool): build automated visual state matrix screenshot runner"
```

---

### Task 3: Thực Thi Kiểm Chứng Thị Giác Thực Tế Cho Route 2 (`/weekly-menu?view=mrx-batch`)

**Files:**
- Output directory: `.artifacts/visual-state-audits/route2-weekly-menu-mrx-batch/`
  - `01-loading-skeleton.png`
  - `02-empty-state.png`
  - `03-error-retry.png`
  - `04-permission-denied.png`
  - `05-conflict-reload.png`
  - `06-active-workbench.png`
  - `AUDIT-REPORT.md`

- [ ] **Step 1: Run Visual State Matrix Runner for Route 2**

Run: `node scripts/audit-route-states.mjs --route weekly-menu-mrx-batch`
Expected: 6 Retina screenshots captured successfully into `.artifacts/visual-state-audits/route2-weekly-menu-mrx-batch/`.

- [ ] **Step 2: Inspect and verify each screenshot artifact**

Verify file sizes, dimensions (2560x1600), and inspect DOM content of each state.

- [ ] **Step 3: Commit visual audit artifacts**

```bash
git add .artifacts/visual-state-audits/
git commit -m "test(visual-audit): capture ground truth 6-state visual matrix for route2 mrx batch"
```

---

### Task 4: Kiểm Định Toàn Diện & Đồng Bộ Remote

**Files:**
- Execute: `npm run verify`
- Execute: `node scripts/run-mrx-e2e-mutation-test.mjs`
- Update: `.planning/WORK.md` and `docs/handoff/HANDOFF.md`

- [ ] **Step 1: Run full verification suite**

Run: `npm run verify`
Expected: ALL 12 gates PASS

- [ ] **Step 2: Commit and push all work to GitHub**

```bash
git add .planning/WORK.md docs/handoff/HANDOFF.md
git commit -m "chore(release): complete visual state matrix audit and architectural consolidation"
git push origin feature/greenfield-fe-3zone-workbench
```
