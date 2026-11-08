# Live Web Runtime Conformance Audit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Execute a live browser inspection and automated Playwright E2E audit against the actively running Frontend (`http://127.0.0.1:5173`) and Backend (`http://127.0.0.1:5262`) to rigorously evaluate whether the recreated Frontend followed the canonical 5-layer governance process or is merely a cosmetic patch ("chắp vá").

**Architecture:** The audit exercises real HTTP handshakes between Vite and the Kestrel ASP.NET Core API server, authenticates real user credentials against MySQL, traverses all 14 routes to measure physical pixel heights of the 3-Zone Workbench layout ($56px \pm 1px$ and $44px \pm 1px$), verifies live mode switching under `DOM-MODE-1`, audits primary work objects vs in-page filter tabs, and tests dirty draft popstate traps.

**Tech Stack:** TypeScript 5, Playwright 1.60, Chromium, ASP.NET Core 9, MySQL 8, Vite, React 18, Tailwind CSS.

**Spec:** `docs/superpowers/specs/2026-10-18-live-web-conformance-audit-design.md`

---

## 1. Architectural Alignment & Governance Matrix

### 5-Layer Governance Architecture & Rules Traceability

- **Layer 1 — Requirements (`FR`, `NFR`, `UXR`)**:
  - `FR-AUTH` through `FR-SYS`: Live evaluation of all 14 routes.
  - `DOM-MODE-1`: Live verification that `DEFAULT != MATERIAL_RECONCILIATION`.
  - `NFR-UI-01`: Table Scalability & Viewport.
  - `NFR-UI-02`: Triple-Layer RBAC Defense (Route $\rightarrow$ Navigation $\rightarrow$ Action).
  - `NFR-UI-03`: Strict Formatting Primitives (`<Num>`, `<IdentifierText>`, `dd/MM/yyyy`).
  - `NFR-UI-04`: Accessibility WCAG 2.2 AA (Zoom 200%, contrast $\ge 4.5:1$).
  - `NFR-UI-05`: Motion & Zero CLS (Transitions $\le 150ms$, CLS $\le 0.1$).
  - `UXR-01` (3-Zone Workbench Layout).
  - `UXR-04` (Vietnamese Domain Microcopy - `DOM-LANG-1`).
  - `UXR-05` (Destructive & Terminal Guards).
- **Layer 2 — UX Architecture (`IA · Navigation · UI State Matrix`)**:
  - Live inspection of Sidebar v2 (`Rule N6`) vs in-page sub-tabs.
  - Live verification of `DirtyNavigation.tsx` popstate interception.
- **Layer 3 — UI Design & Taste Floor (Impeccable `Operate` Mode · `D1–D9` · `T1–T16` · `M1–M3`)**:
  - 100% existing UI Kit primitives from `docs/UI-KIT.md`.
  - Pixel measurement of `WorkspaceHeader` (56px) and `TelemetrySubbar` (44px).
  - Mật độ dòng compact 36–40px (`T8`), header cố định (`T7`).
- **Layer 4 — FE Implementation (`Component Architecture · API · RBAC`)**:
  - Real network communication over `http://localhost:5173/api` $\rightarrow$ `http://localhost:5262`.
  - Zero mock fallbacks in `src/api/*.ts`.
- **Layer 5 — Quality & Validation (`Contract Tests · Anti-Tautology · Lint · Build · Browser`)**:
  - Playwright live end-to-end execution on Chromium.

---

## 2. Scoped Pre-Code UI Gate Block

```markdown
### Scoped Pre-Code UI Gate Block — Live Conformance Audit
- Route: All 14 Canonical Routes (/login, /, /admin-data, /settings/approval-rules, /settings/advanced, /weekly-menu, /meal-orders, /chef, /approvals, /purchasing, /warehouse, /reconciliation, /reports, /forbidden)
- Single Primary Work Object: OperationalFrame & SplitWorkbench across routes
- Server Mode: Live DEFAULT and MATERIAL_RECONCILIATION modes tested
- RBAC Guards: Live authentication with admin and non-admin credentials
- 6 UI States: loading, empty, error, permission-denied, partial, write-reconciliation
- Primitives & Composites: 100% existing components from docs/UI-KIT.md
- Compliance Pledges: D6 (>=12px), D7 (1 primary per zone), T7 (frozen header), T8 (36-40px density), M1.2 (1 blocking modal), N6 (URL-leaf views)
```

---

## 3. Global Constraints

- **Live Server Non-Destructive Invariant**: Thao tác kiểm tra trên web thật không được xóa sạch dữ liệu sản xuất, không chạy lệnh migration phá hủy, không bypass authentication.
- **100% Existing UI Kit Reuse**: Tuyệt đối không tự chế ra component mới.
- **Rule TA-1 (Backend-Grounded Fixtures Only)**: Dữ liệu kiểm tra bám sát 100% C# schema thật.
- **Rule TA-5 (Zero Fake API Data)**: Tuyệt đối không có fallback data trong `src/api/*.ts`.

---

## 4. Review Focus (5 Edge Cases & Verification Invariants)

1. **Real Login & JWT Handshake:** Người dùng nhập `admin` / `Admin@123456`, form submit POST `/api/auth/login` thật xuống port 5262, nhận JWT token thật và lưu vào localStorage.
2. **True 3-Zone Geometry:** Đo đạc kích thước thực tế trên màn hình: Header phải là 56px ($h-14$), Telemetry bar phải là 44px ($h-11$), bảng dữ liệu `DataGrid` phải chiếm 85% chiều cao khung nhìn với `thead.sticky` cố định.
3. **Live 2-Mode Switching (`DOM-MODE-1`):** Thực hiện chuyển đổi chế độ trên trang `/settings/advanced?view=mode` thật $\rightarrow$ kiểm tra API PUT `/api/system-operation-mode` gửi đúng version $\rightarrow$ kiểm tra trang `/reconciliation` mở khóa nút hoàn tất lô khi ở `MATERIAL_RECONCILIATION` và khóa lại khi ở `DEFAULT`.
4. **Primary Work Objects vs Sub-Tabs Isolation:** Kiểm tra 14 liên kết lá trên Sidebar v2; kiểm tra các tab lọc trạng thái hoặc ca phục vụ nằm gọn trong Zone 2 và không bị lấn ra ngoài Sidebar.
5. **Axe WCAG 2.2 AA & Zoom 200% Scalability:** Co giãn viewport sang Zoom 200%, kiểm tra không bị vỡ giao diện, không bị mất chữ tiếng Việt.

---

## 5. Implementation Tasks

### Task 1: Verify Live Server Health and Real JWT Auth Handshake

**Files:**
- Execute: Terminal probe scripts via `curl` and Playwright auth check.

**Interfaces:**
- Consumes: `http://localhost:5262/api/auth/login`, `http://localhost:5173/login`.
- Produces: Xác nhận kết nối sống giữa Frontend, Backend và MySQL database.

- [ ] **Step 1: Test live backend login endpoint via curl**

Gửi request đăng nhập thật với tài khoản `admin` / `Admin@123456`, kiểm tra response `success: true` và có JWT `accessToken`.

- [ ] **Step 2: Test live frontend proxy routing via curl**

Gửi request qua port 5173 (`http://localhost:5173/api/auth/login`), kiểm tra proxy chuyển tiếp thành công xuống 5262.

- [ ] **Step 3: Document live handshake baseline in work log**

---

### Task 2: Implement Comprehensive Live End-to-End Audit Suite

**Files:**
- Create: `frontend/tests/browser/live-conformance-audit.spec.ts`

**Interfaces:**
- Consumes: Running web application at `http://localhost:5173`.
- Produces: 5 bài kiểm thử E2E trực tiếp trên web thật:
  1. `Live Login Flow`: Đăng nhập thật qua form UI `/login`, kiểm tra chuyển hướng vào `/`.
  2. `Live Geometry Audit`: Đo chiều cao thật của `WorkspaceHeader` và `TelemetrySubbar`.
  3. `Live Mode Switching (DOM-MODE-1)`: Chuyển đổi chế độ vận hành qua UI thật và kiểm chứng ActionGuard trên `/reconciliation`.
  4. `Live Popstate Interception`: Thử lùi trang khi form dirty và kiểm tra modal cảnh báo.
  5. `Live Primary vs Sub-Tab Navigation`: Kiểm tra các liên kết lá trên Sidebar v2.

- [ ] **Step 1: Write `frontend/tests/browser/live-conformance-audit.spec.ts`**
- [ ] **Step 2: Verify test syntax and lint**

Chạy: `npm run lint:fe`  
Kỳ vọng: PASS.

- [ ] **Step 3: Commit**

```bash
git add frontend/tests/browser/live-conformance-audit.spec.ts
git commit -m "test(browser): author live web runtime conformance audit suite"
```

---

### Task 3: Execute Live Browser Audit on Real Chromium and Capture Evidence

**Files:**
- Execute: Playwright on Chromium connecting to live web server.

- [ ] **Step 1: Run the live audit suite**

Chạy: `cd frontend && npx playwright test tests/browser/live-conformance-audit.spec.ts --project=chromium`

- [ ] **Step 2: Capture screenshots and metric timings**

Ghi nhận kết quả thực thi thực tế từ trình duyệt Chromium.

---

### Task 4: Compile Forensic Audit Verdict Report (Genuine vs Patching) & SSOT Closure

**Files:**
- Modify: `.planning/WORK.md`

- [ ] **Step 1: Analyze audit findings across 5 dimensions**

Đánh giá trung thực: Phần nào là kiến trúc chuẩn mực, phần nào còn chắp vá hoặc thiếu sót.

- [ ] **Step 2: Apply Mandatory Review Gates**

1. `ipc-test-audit`: Đánh giá chất lượng kiểm thử E2E thật.
2. `ipc-ui-review`: Đánh giá độ chuẩn mực của layout 3-Zone và WCAG 2.2 AA.
3. `ipc-code-review`: Đánh giá tính sạch sẽ của mã nguồn và độ bền vững kiến trúc.

- [ ] **Step 3: Update `.planning/WORK.md` and commit**

Ghi nhận mục `GF-R41 — Live web runtime conformance audit and architectural evaluation report`.
Chuyển trạng thái vòng đời về `IDLE`.

- [ ] **Step 4: Commit**

```bash
git add .planning/WORK.md
git commit -m "docs(work): record live web runtime conformance audit verdict and return to idle"
```
