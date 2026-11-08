# Kế Hoạch Thực Thi: Kiến Trúc Phân Tầng Trạng Thái 4 Cấp Độ & Triệt Tiêu Nháy Giật Layout Shift (Zero-CLS Plan)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Triệt tiêu hoàn toàn hiện tượng nháy giật skeleton và layout shift trên toàn bộ các route bằng cách triển khai Kiến Trúc Phân Tầng Trạng Thái 4 Cấp Độ (4-Tier State & Feedback Architecture), loại bỏ các lệnh `setData(null)` xóa trắng dữ liệu, nâng cấp `StateBoundary.tsx` tự động làm mờ khi refetch/phân trang, và đo kiểm định lượng 5 tầng trên trình duyệt thật.

**Architecture:** Cập nhật `StateBoundary.tsx` để hỗ trợ mượt mà trạng thái `isFetching && hasExistingData` với lớp mờ `opacity-60` và thanh tiến trình `h-0.5`, loại bỏ toàn bộ `setData(null)` trước khi fetch trong `ChefDashboardPage.tsx` và `MrxDailyIssueWorkbench.tsx`, và khóa cứng 4 quy tắc `RULE-FEEDBACK-01..04` trong tài liệu thiết kế chuẩn.

**Tech Stack:** React 19, TypeScript, Tailwind CSS, Playwright, Vitest.

**Spec:** `docs/superpowers/specs/2026-10-24-4tier-state-architecture-and-zero-cls-design.md`

## Global Constraints

- **Zero Full Skeleton on Pagination**: Cấm tuyệt đối hiển thị `WorkbenchSkeleton` khi người dùng bấm phân trang hoặc đổi bộ lọc ngày trong cùng trang.
- **Strict CLS Threshold**: Chỉ số dịch chuyển bố cục Cumulative Layout Shift (CLS) phải $\le 0.05$.
- **No Data Nulling Before Fetch**: Tuyệt đối không được gọi `setData(null)` hoặc gán mảng rỗng trước khi request API trả về.
- **Rule TA-1 đến TA-5**: Tuân thủ nghiêm ngặt ranh giới kiểm thử không fake data.

## Review Focus

1. **Phân trang trong Chef issues**: Bấm Trang sau/Trang trước phải giữ nguyên bảng, chỉ mờ nhẹ `opacity-60` và đổi số dòng sau khi API trả về, không được nháy skeleton.
2. **Đổi ngày trong Chef / MrxDailyIssue**: Đổi ô ngày phải giữ nguyên dữ liệu ngày cũ trong lúc fetch ngày mới, không được giật trắng màn hình.
3. **Skeleton lần đầu vào trang**: Chỉ render đúng 1 lần duy nhất khi `isLoading && !hasExistingData`.
4. **StateBoundary khi gặp lỗi trong lúc đã có dữ liệu**: Phải render inline error banner trên đầu bảng mà không làm biến mất bảng dữ liệu đã có.
5. **Mutation button busy state**: Khi đang submit xuất kho, nút đổi sang "Đang ghi…", form giữ nguyên, không biến cả trang thành loading.

---

### Task 1: Nâng Cấp `StateBoundary.tsx` Triệt Tiêu Nháy Giật (Zero-CLS Infrastructure)

**Files:**
- Modify: `frontend/src/components/workbench/StateBoundary.tsx`
- Test: `frontend/src/__tests__/Primitives.test.tsx`

**Interfaces:**
- Produces: `StateBoundary` container with `opacity-60 transition-opacity duration-150 relative pointer-events-none` when `isFetching && hasExistingData`.
- Produces: Top hairline progress bar `h-0.5 bg-blue-600/80 animate-pulse absolute top-0 left-0 right-0 z-30`.

- [ ] **Step 1: Write failing test in `Primitives.test.tsx` for smooth refetch dimming**

```tsx
it('StateBoundary: dims existing content with opacity-60 and renders progress bar during background refetch without unmounting children', () => {
  // test asserting children remain in DOM and have opacity-60 when isFetching && hasExistingData
  // test asserting skeleton is NOT rendered
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm --prefix frontend run test:unit -- src/__tests__/Primitives.test.tsx`
Expected: FAIL on missing dimming class or behavior

- [ ] **Step 3: Implement smooth dimming in `StateBoundary.tsx`**

Update the return statement of `StateBoundary.tsx` to wrap `children` with:
```tsx
<div className={clsx('flex-1 min-h-0 w-full flex flex-col relative', className)}>
  {isFetching && hasExistingData && (
    <div
      aria-hidden="true"
      className="h-0.5 w-full bg-blue-600/80 animate-pulse shrink-0 absolute top-0 left-0 right-0 z-30"
    />
  )}
  <div className={clsx('flex-1 min-h-0 w-full flex flex-col', isFetching && hasExistingData && 'opacity-60 transition-opacity duration-150 pointer-events-none')}>
    {children}
  </div>
</div>
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm --prefix frontend run test:unit -- src/__tests__/Primitives.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/workbench/StateBoundary.tsx frontend/src/__tests__/Primitives.test.tsx
git commit -m "feat(ux): implement zero-flicker background refetch dimming in state boundary"
```

---

### Task 2: Xóa Bỏ Anti-Pattern `setData(null)` Trong Các Trang Feature

**Files:**
- Modify: `frontend/src/features/chef/ChefDashboardPage.tsx`
- Modify: `frontend/src/features/warehouse/MrxDailyIssueWorkbench.tsx`
- Test: `frontend/src/__tests__/Chef.test.tsx`
- Test: `frontend/src/__tests__/Warehouse.test.tsx`

**Interfaces:**
- Eliminates: `setData(null)` in `ChefDashboardPage.tsx` line 143, 144, 180.
- Preserves: `data` during pagination and scope change.

- [ ] **Step 1: Write failing test in `Chef.test.tsx` asserting table remains mounted during pagination**

```tsx
it('Chef: preserves existing issues table in DOM with dimming during pagination without flashing skeleton', async () => {
  // test asserting table remains in DOM while issuePageNumber increments
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm --prefix frontend run test:unit -- src/__tests__/Chef.test.tsx`
Expected: FAIL if table is unmounted by `setData(null)`

- [ ] **Step 3: Remove `setData(null)` in `ChefDashboardPage.tsx`**

Remove `setData(null)` from `onChange` handlers of date, shift, and pagination buttons. Pass `hasExistingData={Boolean(data)}` to `StateBoundary`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm --prefix frontend run test:unit -- src/__tests__/Chef.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/chef/ChefDashboardPage.tsx frontend/src/__tests__/Chef.test.tsx
git commit -m "fix(chef): eliminate data nulling and preserve table during pagination and date change"
```

---

### Task 3: Cập Nhật Rào Chắn Thiết Kế Trong `docs/DESIGN.md` & `docs/UI-KIT.md`

**Files:**
- Modify: `docs/DESIGN.md`
- Modify: `docs/UI-KIT.md`
- Mirror: `C:\Users\Administrator\Desktop\spec_and_plan (1)\spec.md`
- Mirror: `C:\Users\Administrator\Desktop\spec_and_plan (1)\plan.md`

- [ ] **Step 1: Add 4-Tier State & Feedback Architecture Rules to `docs/DESIGN.md`**

Add `RULE-FEEDBACK-01..04` and explicit bans against full skeleton on pagination.

- [ ] **Step 2: Update `docs/UI-KIT.md` Section on Feedback & Loading**

Document the exact CSS classes and behavior for Tier 1, Tier 2, Tier 3, Tier 4.

- [ ] **Step 3: Mirror into Desktop `spec.md` and `plan.md`**

Keep both Desktop files in 100% parity.

- [ ] **Step 4: Commit documentation changes**

```bash
git add docs/DESIGN.md docs/UI-KIT.md
git commit -m "docs(design): lock 4-tier state feedback architecture and anti-flicker rules"
```

---

### Task 4: Kiểm Định Toàn Diện & Đo Kiểm Trình Duyệt

**Files:**
- Execute: `npm run verify`
- Execute: `cd frontend && npx playwright test tests/browser/conformance-runtime.spec.ts`
- Execute: `node scripts/run-mrx-e2e-mutation-test.mjs`
- Update: `.planning/WORK.md` and `docs/handoff/HANDOFF.md`

- [ ] **Step 1: Run full verification suite**

Run: `npm run verify`
Expected: ALL 12 gates PASS

- [ ] **Step 2: Run Playwright Conformance Runtime Suite**

Run: `cd frontend && npx playwright test tests/browser/conformance-runtime.spec.ts`
Expected: 10/10 PASS on live Chromium

- [ ] **Step 3: Run Headed E2E Mutation Sandbox Runner**

Run: `node scripts/run-mrx-e2e-mutation-test.mjs`
Expected: 8/8 stages PASS in under 40 seconds

- [ ] **Step 4: Update ledger and commit & push**

```bash
git add .planning/WORK.md docs/handoff/HANDOFF.md
git commit -m "chore(release): complete 4-tier state feedback architecture and zero-cls implementation"
git push origin feature/greenfield-fe-3zone-workbench
```
