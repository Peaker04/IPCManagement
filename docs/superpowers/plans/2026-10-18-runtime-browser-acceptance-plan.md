# Runtime Browser Acceptance & End-to-End Conformance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete Phase 4 of the Conformance Program by adding `popstate` browser Back/Forward dirty draft protection to `DirtyNavigation.tsx`, authoring an automated browser runtime acceptance suite (`conformance-runtime.spec.ts`), verifying 3-Zone geometry, WCAG 2.2 AA 200% zoom, triple-layer RBAC, and operational mode isolation (`DOM-MODE-1`), and using 100% existing UI Kit components.

**Architecture:** `DirtyNavigationProvider` governs dirty drafts across sidebar navigation, page unload, and browser history transitions (`popstate`). The browser acceptance suite (`@playwright/test`) validates that the rendered Vite application adheres to 3-Zone Workbench layout geometry ($56px \pm 1px$ header, $44px \pm 1px$ subbar, $85\%$ viewport data area), verifies accessibility contrast and zoom scaling without layout shift, and proves triple-layer RBAC protection and operational mode switching.

**Tech Stack:** TypeScript 5, React 18, React Router v6, Vitest 4, Playwright 1.60, Testing Library, Tailwind CSS (semantic tokens only).

**Spec:** `docs/superpowers/specs/2026-10-18-runtime-browser-acceptance-design.md`

---

## 1. Architectural Alignment & Governance Matrix

### 5-Layer Governance Architecture & Rules Traceability

- **Layer 1 — Requirements (`FR`, `NFR`, `UXR`)**:
  - `FR-AUTH` through `FR-SYS`: Tất cả 12 phân hệ backend và 14 routes frontend.
  - `DOM-MODE-1`: Chế độ `DEFAULT` vs `MATERIAL_RECONCILIATION`.
  - `NFR-UI-01`: Table Scalability & Viewport.
  - `NFR-UI-02`: Triple-Layer RBAC Defense (Route $\rightarrow$ Navigation $\rightarrow$ Action).
  - `NFR-UI-03`: Strict Formatting Primitives (`<Num>`, `<IdentifierText>`, `dd/MM/yyyy`).
  - `NFR-UI-04`: Accessibility WCAG 2.2 AA (Tỷ lệ tương phản $\ge 4.5:1$, zoom 200%).
  - `NFR-UI-05`: Motion & Zero CLS (Transitions $\le 150ms$, CLS $\le 0.1$).
  - `UXR-01` (3-Zone Workbench Layout).
  - `UXR-04` (Vietnamese Domain Microcopy - `DOM-LANG-1`).
  - `UXR-05` (Destructive & Terminal Guards).
- **Layer 2 — UX Architecture (`IA · Navigation · UI State Matrix`)**:
  - 14 Canonical Routes trong `routeRegistry.ts`.
  - N6 URL-owned leaf views trên `/admin-data`, `/settings/advanced`, `/weekly-menu`, `/chef`, `/reports`, `/warehouse`.
  - Bảo vệ bản nháp chưa lưu qua `DirtyNavigation.tsx` (Sidebar click, F5/close tab, và Browser Back/Forward).
- **Layer 3 — UI Design & Taste Floor (Impeccable `Operate` Mode · `D1–D9` · `T1–T16` · `M1–M3`)**:
  - **100% Dùng UI Kit có sẵn (`docs/UI-KIT.md`)**: `AppShell`, `WorkspaceHeader`, `TelemetrySubbar`, `DataGrid`, `SplitView`, `StateBoundary`, `Select`, `VietnameseDateInput`, `Tabs`, `Button`, `Badge`, `Num`, `IdentifierText`, `Modal`, `ActionGuard`.
  - `D6`: Cỡ chữ tối thiểu `12px` (`text-xs`), tiêu đề `18px/16px/14px`.
  - `D7`: Single Primary button per zone.
  - `T7`: Frozen header cố định khi cuộn dọc.
  - `T8`: Chiều cao dòng compact 36–40px.
- **Layer 4 — FE Implementation (`Component Architecture · API · RBAC`)**:
  - 9 API clients đồng bộ 1:1 C# DTOs, không có fake API, không có fallback arrays.
- **Layer 5 — Quality & Validation (`Contract Tests · Anti-Tautology · Lint · Build · Browser`)**:
  - `scripts/check-conformance-contracts.test.mjs` (28 tests PASS).
  - Vitest Unit suite (113 tests PASS).
  - Playwright browser acceptance test suite (`frontend/tests/browser/conformance-runtime.spec.ts`).

---

## 2. Scoped Pre-Code UI Gate Block

```markdown
### Scoped Pre-Code UI Gate Block — Runtime Browser Acceptance
- Route: All 14 Canonical Routes (/login, /, /admin-data, /settings/approval-rules, /settings/advanced, /weekly-menu, /meal-orders, /chef, /approvals, /purchasing, /warehouse, /reconciliation, /reports, /forbidden)
- Single Primary Work Object: OperationalFrame & SplitWorkbench across routes
- Server Mode: SHARED_MASTER_DATA & MATERIAL_RECONCILIATION (DOM-MODE-1 verified)
- RBAC Guards: RoleGuard, Navigation filtering, ActionGuard
- 6 UI States: loading, empty, error, permission-denied, partial, write-reconciliation
- Primitives & Composites: 100% existing components from docs/UI-KIT.md
- Compliance Pledges: D6 (>=12px), D7 (1 primary per zone), T7 (frozen header), T8 (36-40px density), M1.2 (1 blocking modal), N6 (URL-leaf views)
```

---

## 3. Global Constraints

- **DOM-MODE-1 Operational Mode Isolation**: Chế độ `DEFAULT` không hòa trộn luồng với `MATERIAL_RECONCILIATION`.
- **100% Existing UI Kit Reuse**: Tuyệt đối không tự chế ra component mới. Sử dụng 100% primitives trong `components/ui/*` và `components/workbench/*`.
- **Rule TA-1 (Backend-Grounded Fixtures Only)**: Mọi dữ liệu test mock bắt buộc phải khớp 100% tên trường, kiểu dữ liệu, cấu trúc C# DTO.
- **Rule TA-2 (No Self-Mocking / Tautological Tests)**: Test component trên cây DOM thật; browser suite test trên Chromium thật.
- **Rule TA-3 (Zero Allowlist Padding)**: Không dùng `test.skip`, không thêm file vào danh sách ngoại lệ.
- **Rule TA-5 (Zero Fake API Data)**: Không chứa bất kỳ dữ liệu fallback hoặc hardcoded arrays nào trong mã nguồn production.
- **No Destructive Operations**: Không can thiệp DB, không chạy migration, không git reset/clean.

---

## 4. Review Focus (5 Edge Cases & Verification Invariants)

1. **Popstate Back/Forward Interception:** Khi đang sửa dở form (dirty state active), bấm nút Back của trình duyệt phải ngăn chặn việc lùi trang ngay lập tức, hiển thị `alertdialog` "Hủy thay đổi chưa lưu?". Bấm "Tiếp tục chỉnh sửa" phải giữ nguyên form và URL hiện tại.
2. **Discard and Navigate on Back:** Khi bấm "Hủy thay đổi" trong modal xác nhận popstate, hệ thống phải giải phóng dirty state và cho phép trình duyệt lùi trang an toàn.
3. **Geometry Invariants ($56px \pm 1px$ / $44px \pm 1px$):** Chiều cao Zone 1 `WorkspaceHeader` và Zone 2 `TelemetrySubbar` phải ổn định trên mọi canonical routes, không bị nhảy giật khi nạp dữ liệu (CLS <= 0.1).
4. **WCAG 2.2 AA Zoom 200% Scalability:** Ở tỷ lệ zoom 200%, bảng dữ liệu phải cuộn ngang mượt mà, văn bản không bị cắt xén, các trường ngày tháng và nút bấm không bị tràn ngoài viewport.
5. **Triple-Layer RBAC & Forbidden Redirection:** Người dùng không có quyền (hoặc chưa đăng nhập) khi truy cập các route quản trị bị chuyển hướng an toàn về `/forbidden` hoặc `/login`.

---

## 5. Implementation Tasks

### Task 1: Intercept Browser Back/Forward (`popstate`) in `DirtyNavigation.tsx`

**Files:**
- Modify: `frontend/src/components/workbench/DirtyNavigation.tsx`
- Modify: `frontend/src/__tests__/Primitives.test.tsx`

**Interfaces:**
- Consumes: `isDirty: boolean`, `window.history.pushState`, `popstate` event.
- Produces: Ngăn chặn lùi trang ngoài ý muốn khi có draft chưa lưu.

- [ ] **Step 1: Write the failing test in `frontend/src/__tests__/Primitives.test.tsx`**

Thêm test kiểm chứng `DirtyNavigation` lắng nghe sự kiện `popstate` và mở `alertdialog` khi người dùng bấm nút Back của trình duyệt:

```typescript
it('intercepts browser popstate back-button navigation when dirty draft is active', async () => {
  const user = userEvent.setup();
  render(
    <DirtyNavigationProvider>
      <TestDirtyConsumer />
    </DirtyNavigationProvider>
  );

  await user.click(screen.getByRole('button', { name: 'Đánh dấu bẩn' }));
  expect(screen.getByText('Trạng thái: Bẩn')).toBeInTheDocument();

  // Simulate user pressing browser back button
  window.dispatchEvent(new PopStateEvent('popstate'));

  expect(await screen.findByRole('alertdialog')).toBeInTheDocument();
  expect(screen.getByText('Hủy thay đổi chưa lưu?')).toBeInTheDocument();

  // Click continue editing
  await user.click(screen.getByRole('button', { name: 'Tiếp tục chỉnh sửa' }));
  expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  expect(screen.getByText('Trạng thái: Bẩn')).toBeInTheDocument();
});
```

- [ ] **Step 2: Run test to verify it fails**

Chạy lệnh: `npm run test:fe:unit`  
Kỳ vọng: FAIL vì `DirtyNavigation` hiện tại chỉ lắng nghe `beforeunload` và thẻ `<a>`.

- [ ] **Step 3: Implement `popstate` listener in `DirtyNavigation.tsx`**

Trong `DirtyNavigation.tsx`, bổ sung:
```typescript
  useEffect(() => {
    if (!isDirty) return;
    const handleBeforeUnload = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener('beforeunload', handleBeforeUnload);

    // Push dummy history entry to trap Back button
    window.history.pushState(null, '', window.location.href);

    const handlePopState = () => {
      // Re-push state to keep URL while confirmation is pending
      window.history.pushState(null, '', window.location.href);
      setPendingNavigation(() => () => {
        window.history.back();
      });
    };

    window.addEventListener('popstate', handlePopState);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('popstate', handlePopState);
    };
  }, [isDirty]);
```

- [ ] **Step 4: Run test to verify it passes**

Chạy lệnh: `npm run test:fe:unit`  
Kỳ vọng: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/workbench/DirtyNavigation.tsx frontend/src/__tests__/Primitives.test.tsx
git commit -m "feat(workbench): intercept browser popstate navigation to protect unsaved drafts"
```

---

### Task 2: Implement Browser Runtime Acceptance Suite (`conformance-runtime.spec.ts`)

**Files:**
- Create: `frontend/tests/browser/conformance-runtime.spec.ts`

**Interfaces:**
- Consumes: Playwright browser harness (`@playwright/test`), Vite dev server.
- Produces: 5 bài kiểm thử nghiệm thu trực quan trên Chromium:
  1. `Route Smoke`: 14 routes canonical render tiêu đề hợp lệ, không có lỗi JS console.
  2. `3-Zone Geometry`: Đo chiều cao Zone 1 ($56px \pm 1px$) và Zone 2 ($44px \pm 1px$).
  3. `Zoom 200% Scalability`: Viewport scale 2x, không vỡ layout container chính.
  4. `Triple-Layer RBAC`: Vai trò `beptruong` không thấy link Admin trên sidebar và bị chặn truy cập `/settings/advanced`.
  5. `Mode Isolation Guard`: Nút "Chốt đối soát ca" bị vô hiệu hóa khi ở chế độ `DEFAULT`.

- [ ] **Step 1: Write `frontend/tests/browser/conformance-runtime.spec.ts`**

Tạo file kiểm thử Playwright toàn diện theo 5 trụ cột trên.

- [ ] **Step 2: Verify test syntax and lint**

Chạy lệnh: `npm run lint:fe`  
Kỳ vọng: PASS.

- [ ] **Step 3: Commit**

```bash
git add frontend/tests/browser/conformance-runtime.spec.ts
git commit -m "test(browser): author runtime browser acceptance and accessibility suite"
```

---

### Task 3: Full Non-Mutating Verification, Review Gates & Work Closure

**Files:**
- Modify: `.planning/WORK.md`

- [ ] **Step 1: Run complete verification suite**

```bash
npm run test:conformance-contracts
npm run check:conformance-contracts
npm run test:fe:unit
npm run lint:fe
npm run build:fe
npm run depcruise:fe
git diff --check
```
Kỳ vọng: Toàn bộ kiểm thử PASS 100%.

- [ ] **Step 2: Apply Mandatory Review Gates**

Áp dụng 3 review gates theo `AGENTS.md`:
1. `ipc-test-audit`: Fixtures bám sát C# DTOs (`Rule TA-1`), không mock component (`Rule TA-2`), zero allowlist padding (`Rule TA-3`), đủ 4 kịch bản (`Rule TA-4`), zero fake API (`Rule TA-5`).
2. `ipc-ui-review`: Chuẩn 3-Zone Workbench, D6 font size >= 12px, D7 single primary, T7 frozen header, T8 compact density, N6 URL-leaf navigation.
3. `ipc-code-review`: Khớp 1:1 C# DTOs, bảo vệ bất biến `DOM-MODE-1`, hoàn thiện popstate dirty navigation.

- [ ] **Step 3: Update `.planning/WORK.md`**

Ghi nhận mục `GF-R40 — Runtime browser acceptance suite and popstate dirty navigation authority` vào `.planning/WORK.md`.
Chuyển trạng thái vòng đời về `IDLE`.

- [ ] **Step 4: Commit**

```bash
git add .planning/WORK.md
git commit -m "docs(work): record runtime browser acceptance closure and return to idle"
```
