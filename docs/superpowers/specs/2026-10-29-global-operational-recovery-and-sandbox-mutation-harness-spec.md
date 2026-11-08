# Đặc Tả Kiến Trúc: Khung Phục Hồi Vận Hành Toàn Diện (Global Operational Recovery) & Harness Kiểm Thử Mutation Cô Lập Worst-Case Trên 14 Routes

## 1. Bối cảnh, Mục đích & Lý do (Intent & The Why)
- **Bối cảnh**:
  Hệ thống IPCManagement vận hành 12 phân hệ backend và 14 routes frontend với 2 chế độ vận hành độc lập (`DEFAULT` và `MATERIAL_RECONCILIATION` theo bất biến `DOM-MODE-1`).
  Trước đây, các đợt refactor và chuẩn hóa tập trung sâu vào phân hệ MRX (Đối soát nguyên liệu), trong khi các tuyến vận hành `DEFAULT` (`/meal-orders`, `/approvals`, `/purchasing`, `/warehouse`, `/chef`, `/reports`, `/admin-data`, `/weekly-menu`) vẫn còn tồn tại các khiếm khuyết mang tính hệ thống:
  1. **Ngõ cụt vận hành (Operational Dead-Ends & UX Traps)**: Khi bộ lọc không có dữ liệu, khi thiếu dữ liệu tiên quyết (chưa có khách hàng, chưa có thực đơn, chưa nhập kho), hoặc khi API trả về lỗi 400/403/404/409, giao diện thường chỉ hiển thị thông báo lỗi đơn thuần hoặc icon rác `Inbox` cũ mà không có nút thoát hiểm dẫn đường (Actionable Escape Hatches: Thử lại, Xóa bộ lọc, Điều hướng tới bước khởi tạo tiên quyết).
  2. **Mất dữ liệu biểu mẫu khi thao tác lỗi (Form Mutation State Loss)**: Khi người dùng thực hiện thao tác ghi (mutation) nhưng gặp lỗi (mạng chập chờn, xung đột khóa 409, vi phạm ràng buộc nghiệp vụ), modal hoặc form thường tự đóng hoặc bị xóa trắng dữ liệu đang nhập dở, buộc người dùng phải gõ lại từ đầu.
  3. **Thiếu bộ kiểm thử bao phủ các kịch bản xấu nhất (Worst-Case Coverage) kèm dọn dẹp sạch sẽ (Auto-Cleanup)**: Chưa có một Harness kiểm thử thống nhất chạy xuyên suốt 14 routes để kiểm chứng hành vi của hệ thống khi gặp các tình huống xấu nhất (lỗi mạng, số liệu âm, xung đột phiên bản, thiếu danh mục) mà vẫn đảm bảo cách ly 100% trên Sandbox Database (`ipc_mrx_e2e_sandbox`), tự dọn dẹp không để lại bất kỳ bản ghi rác nào.

- **Mục đích**:
  Xây dựng **Bộ khung Framework dùng chung (Global Operational Recovery & Sandbox Mutation Harness)** áp dụng nhất quán trên toàn bộ 14 routes, triệt tiêu mọi ngõ cụt thao tác, bảo toàn dữ liệu form khi mutation lỗi, chuẩn hóa 100% StateBoundary và cung cấp bộ test suite worst-case có teardown assertion sạch sẽ tuyệt đối.

---

## 2. Mục Tiêu, Phi Mục Tiêu & Mục Tiêu Chống (Goals, Non-Goals, Anti-Goals)

### A. Goals (Mục tiêu đạt được)
1. **Zero Dead-Ends trên toàn bộ 14 Routes**:
   - 100% các màn hình khi ở trạng thái rỗng (`filter-empty`, `empty-first-use`, `prerequisite-blocked`) đều có nút hành động (CTA) giải cứu rõ ràng (`onResetFilters`, `onCreatePrerequisite`, `onRetry`).
   - 100% các màn hình lỗi (400, 403, 404, 409, 500, Offline) đều hiển thị thông điệp tiếng Việt thân thiện con người và nút phục hồi tương ứng.
2. **Bảo tồn dữ liệu Form khi Mutation thất bại (Form Mutation Preservation)**:
   - Khi submit form hoặc modal thất bại, form KHÔNG BAO GIỜ bị đóng hoặc reset trắng; các giá trị người dùng đã điền được giữ nguyên trên giao diện kèm thông báo lỗi cụ thể để người dùng sửa và gửi lại.
   - Hỗ trợ cơ chế giải quyết xung đột khóa lạc quan (Optimistic Concurrency 409): Tải lại bản mới nhất mà vẫn cho phép người dùng đối chiếu thay đổi trước khi ghi đè.
3. **Thanh lọc 100% Di chứng Biểu tượng & Trình bày (Presentation Hygiene)**:
   - Xóa bỏ triệt để mọi lượt import và sử dụng icon `Inbox` từ `lucide-react` trên các trang `/approvals`, `/purchasing`, `/reports`... Thay thế bằng các icon nghiệp vụ sống động (`Scale`, `CheckCircle2`, `Truck`, `FileSpreadsheet`, `AlertTriangle`).
   - Đảm bảo Rule D6 ($\ge 12$px), Rule D7 (tối đa 1 primary button trên WorkspaceHeader), Rule T7 (sticky headers), Rule T8 (compact density 36–40px) trên toàn bộ 14 routes.
4. **Harness Kiểm Thử Mutation Cô Lập Worst-Case với Tự Động Cleanup (Sandbox Harness)**:
   - Xây dựng script `scripts/run-universal-worst-case-lifecycle-harness.mjs` chạy tự động trên cổng Sandbox 5263 (`ipc_mrx_e2e_sandbox`).
   - Bao phủ các tình huống vận hành ngặt nghèo nhất:
     - TC-W1: Xung đột khóa đồng thời (Optimistic Concurrency 409).
     - TC-W2: Số lượng âm / vượt định mức / vi phạm ràng buộc DTO.
     - TC-W3: Mất kết nối mạng giữa chừng (Offline mutation queue retry).
     - TC-W4: Cơ sở dữ liệu rỗng (Không có khách hàng, không có BOM, không có đơn hàng) $\rightarrow$ Kiểm chứng đường dẫn tạo dữ liệu tiên quyết không bị crash.
     - TC-W5: Teardown & Auto-cleanup verification: Sau khi chạy xong toàn bộ các bước mutation, tự động xóa sạch các bản ghi test và assert rằng số lượng bản ghi dư thừa trong sandbox database là `0`.

### B. Non-Goals (Không thuộc phạm vi)
- Không viết lại toàn bộ kiến trúc router hay thay đổi các URL canonical routes trong `routeRegistry.ts`.
- Không thay đổi nghiệp vụ lõi (business logic) của backend .NET 9 ngoài việc đảm bảo xử lý lỗi và trả về mã lỗi chuẩn.
- Không can thiệp hoặc trộn lẫn luồng giữa `DEFAULT` và `MATERIAL_RECONCILIATION`.

### C. Anti-Goals (Điều cấm & Bẫy cần tránh)
- **Cấm vá lẻ từng trang**: Không viết các khối `try/catch` hay `useState` rải rác một cách tùy tiện mà phải qua hook dùng chung và component chuẩn hóa.
- **Cấm vi phạm `DOM-MODE-1`**: Tuyệt đối không để dữ liệu hay quy trình của MRX lấn sang DEFAULT và ngược lại.
- **Cấm rò rỉ dữ liệu test sang CSDL chính `ipcmanagement`**: Toàn bộ kiểm thử mutation worst-case chỉ được phép chạy trên `ipc_mrx_e2e_sandbox`.
- **Cấm mock API trong production test paths (Rule TA-1 đến TA-5)**: Kiểm thử phải tương tác với backend C# thật trên Sandbox.
- **Cấm phình to kích thước tệp**: Không tệp nào vượt quá 600 dòng; các sub-tree branch và modal phải $\le 350$ dòng.

---

## 3. Ràng Buộc Kỹ Thuật (Constraints)
- **Single Styling Authority**: Mọi class styling phải dùng semantic tokens trong `frontend/src/styles/index.css`. Cấm màu ad-hoc, cấm inline style.
- **UI Kit Primitives**: Tận dụng triệt để `StateBoundary`, `WorkspaceHeader`, `TelemetrySubbar`, `DataGrid`, `SearchableCombobox`, `Button`, `Badge`, `Modal`, `InlineBanner`.
- **Pre-commit Verification Gate**: Đảm bảo 100% vượt qua 5 Gate (Gate A–E) trong `npm run precommit:verify`.
- **Vitest & Playwright Compliance**: Không được làm gãy bất kỳ test case nào trong 244 unit tests và 63 browser tests hiện có.

---

## 4. Các Hướng Tiếp Cận Đã Đánh Giá & Lý Do Chọn

### Hướng tiếp cận 1: Khung Declarative HOC / Shell Đóng Gói Toàn Bộ Route (`OperationalWorkbenchFrame`)
- *Ý tưởng*: Tạo HOC/Shell bao bọc toàn bộ page, nhận declarative schema rồi tự động dựng giao diện và xử lý lỗi.
- *Đánh đổi*: Quá cứng nhắc, làm biến dạng cấu trúc của các trang phức tạp (`MrxBatchWorkbench`, `WeeklyMenuPage`), nguy cơ tạo file monolithic khó bảo trì.
- *Kết luận*: Loại bỏ.

### Hướng tiếp cận 2: Khung Hook-Driven Resilience Protocol (`useOperationalRecovery`) + Mở Rộng `StateBoundary` + E2E Sandbox Lifecycle Harness *(Được chọn)*
- *Ý tưởng*:
  - Giữ nguyên kiến trúc 3-Zone Flat Workbench hiện hành.
  - Cung cấp hook chuẩn `useOperationalRecovery` và helper `executeSafeMutation` để quản lý trạng thái, bảo toàn form draft, bắt lỗi chuẩn hóa và phát hiện xung đột 409.
  - Chuẩn hóa toàn bộ 14 routes sử dụng `StateBoundary` với đầy đủ các Action giải cứu (`onResetFilters`, `onCreatePrerequisite`, `onRetry`) và thay thế triệt để icon `Inbox`.
  - Xây dựng runner kịch bản xấu nhất độc lập `run-universal-worst-case-lifecycle-harness.mjs` với cơ chế auto-cleanup bảo vệ toàn vẹn dữ liệu.
- *Lý do chọn*: Đáp ứng hoàn hảo tiêu chí "không vá lẻ", giữ kiến trúc cây phẳng, code nhỏ gọn dễ kiểm soát ($\le 350$ dòng/tệp), tương thích tự nhiên với `serverStateCache` và bảo toàn 100% các test hiện có.

---

## 5. Thiết Kế Kiến Trúc Chi Tiết

### 5.1. Hook Phục Hồi Vận Hành: `useOperationalRecovery.ts`
- **Vị trí**: `frontend/src/hooks/useOperationalRecovery.ts` ($\le 250$ dòng)
- **Chức năng**:
  ```typescript
  export interface OperationalRecoveryOptions<TData, TFilter> {
    queryKey: string;
    fetcher: (filters: TFilter) => Promise<TData>;
    initialFilters: TFilter;
    defaultFilters: TFilter;
    onResetFilters?: () => void;
    prerequisiteRoute?: string;
    prerequisiteLabel?: string;
  }

  export interface SafeMutationOptions<TPayload, TResult> {
    mutationFn: (payload: TPayload) => Promise<TResult>;
    successMessage?: string;
    onSuccess?: (result: TResult) => void;
    onConflict?: (error: ApiError) => void;
  }
  ```
- **Hành vi cốt lõi**:
  1. **SWR State Management**: Tự động lấy cache từ `serverStateCache` khi khởi tạo để hiển thị ngay trong 0ms, sau đó revalidate ngầm.
  2. **Zero Dead-End State Mapper**:
     - Nếu `data` rỗng và filters khác default: tự động tính `emptyScenario = 'filter-empty'` và cung cấp `handleResetFilters`.
     - Nếu `data` rỗng do chưa có dữ liệu hệ thống: tính `emptyScenario = 'empty-first-use'` hoặc `'prerequisite-blocked'` kèm `handleNavigatePrerequisite`.
     - Nếu gặp lỗi: bắt mã lỗi HTTP (400, 403, 404, 409, 500, network error) qua `formatters.ts` để hiển thị tiếng Việt và kích hoạt cờ `onRetry`.
  3. **Preserved Form Mutation (`executeSafeMutation`)**:
     - Nhận vào dữ liệu payload của form.
     - Nếu thất bại: lưu giữ nguyên vẹn giá trị form (không reset), kích hoạt `mutationError` và trả về `false` để modal không đóng.
     - Nếu gặp 409 Concurrency: thông báo rõ ràng "Dữ liệu đã bị thay đổi bởi người dùng khác. Vui lòng kiểm tra lại", giữ lại dữ liệu form của người dùng và cho phép bấm "Nạp lại & Thử lại".

### 5.2. Chuẩn Hóa & Mở Rộng `StateBoundary.tsx`
- **Cập nhật**: `frontend/src/components/workbench/StateBoundary.tsx`
  - Đảm bảo mọi trạng thái rỗng và lỗi đều có CTA:
    - `filter-empty`: Nút `[Xóa bộ lọc (Reset Filters)]` gọi hàm đặt lại bộ lọc về mặc định.
    - `prerequisite-blocked`: Nút `[Đi đến bước thiết lập: {prerequisiteLabel}]` điều hướng bằng React Router tới trang cần thiết (ví dụ: sang `/admin-data?view=customers` để tạo khách hàng, hoặc sang `/weekly-menu` để lập thực đơn).
    - `empty-first-use`: Nút `[Tạo mới {entityName}]` mở modal tạo mới.
    - `error`: Nút `[Thử lại kết nối]` gọi hàm re-fetch dữ liệu.
  - **Contextual Icons**: Bổ sung icon chuẩn hóa theo phân hệ, cấm tuyệt đối sử dụng icon `Inbox` rác:
    - Quản lý duyệt (`/approvals`): `FileCheck` hoặc `CheckCircle2`.
    - Thu mua & PO (`/purchasing`): `Truck` hoặc `ShoppingCart`.
    - Báo cáo vận hành (`/reports`): `FileSpreadsheet` hoặc `TrendingUp`.
    - Điều phối đơn (`/meal-orders`): `UtensilsCrossed` hoặc `CalendarClock`.

### 5.3. Rà Soát & Chuyển Đổi Trên Toàn Bộ 14 Routes (14 Routes Transformation Matrix)

| Route Path | Phân hệ | Hiện trạng ngõ cụt & Khiếm khuyết | Giải pháp chuẩn hóa Framework |
|---|---|---|---|
| `/` | `FR-DASH` | Dashboard đã có KPI nhưng khi không có lô nào chưa có nút CTA rõ ràng | Bổ sung CTA "Chuyển đến Chuẩn bị Lô" khi dashboard rỗng |
| `/weekly-menu` | `FR-MENU` | Đã chuẩn hóa MRX; cành `DEFAULT` khi chưa có thực đơn thiếu CTA nhập | Nút CTA `[Nhập thực đơn Excel]` hoặc `[Lập kế hoạch tuần]` |
| `/meal-orders` | `FR-COORD` | Khi chưa có đơn ca hoặc chưa có khách hàng, hiển thị DataGrid rỗng | Tích hợp `useOperationalRecovery`: `filter-empty` reset ca, `prerequisite-blocked` dẫn sang tạo khách |
| `/approvals` | `FR-APPR` | Dùng icon `Inbox` rác; khi từ chối mà lỗi thì mất form lý do | Thay bằng `FileCheck`; `executeSafeMutation` giữ nguyên lý do từ chối khi submit lỗi |
| `/purchasing` | `FR-PUR` | Dùng icon `Inbox` rác; khi hủy PO gặp lỗi thì kẹt modal | Thay bằng `Truck`; `executeSafeMutation` giữ modal và báo lỗi cụ thể |
| `/warehouse` | `FR-WH` | Tab DEFAULT (issues, receipts, stock) khi lọc rỗng chưa có reset | Chuẩn hóa `emptyScenario="filter-empty"` với CTA Reset bộ lọc |
| `/chef` | `FR-CHEF` | Tab DEFAULT (plans, issues) khi ngày không có món thì rỗng trơn | Chuẩn hóa CTA chuyển ngày hoặc chuyển sang Kế hoạch sản xuất |
| `/reconciliation` | `FR-RECON` | Đã chuẩn hóa; bổ sung recovery khi giải trình chênh lệch 409 | `executeSafeMutation` trong `ReconciliationDispositionModal` |
| `/reports` | `FR-REP` | Lọc nguyên liệu rỗng không có nút reset | Tích hợp `useOperationalRecovery` với nút "Xóa điều kiện lọc" |
| `/admin-data` | `FR-CAT` | Tab nguyên liệu/món ăn khi tìm kiếm không ra kết quả chưa có reset | Tích hợp `onResetFilters` trên cả 4 tab: ingredients, dishes, bom, customers |
| `/settings/approval-rules` | `FR-ADMIN` | Chưa có nút tạo quy tắc khi danh sách rỗng | CTA `[Thiết lập quy tắc phê duyệt đầu tiên]` |
| `/settings/advanced` | `FR-SYS` | Chuyển chế độ vận hành cần xác nhận an toàn | Thông báo cảnh báo bất biến `DOM-MODE-1` rõ ràng |
| `/login` | `FR-AUTH` | Đã ổn định | Giữ nguyên, bảo vệ chuyển hướng đúng vai trò |
| `/forbidden` | `FR-AUTH` | 403 page | Bổ sung nút `[Đăng xuất]` và `[Quay lại trang chủ]` |

### 5.4. Harness Kiểm Thử Mutation Cô Lập Worst-Case (`scripts/run-universal-worst-case-lifecycle-harness.mjs`)
- **Tệp mới**: `scripts/run-universal-worst-case-lifecycle-harness.mjs`
- **Môi trường thực thi**: Cổng backend Sandbox `5263` (`ipc_mrx_e2e_sandbox`), tuyệt đối không đụng vào `5262` (`ipcmanagement`).
- **Quy trình thực thi**:
  1. **Pre-flight Check**: Xác nhận cổng `5263` đang hoạt động, xác nhận CSDL sandbox được cô lập.
  2. **Phase 1: Zero Data & Missing Prerequisite Tolerance (Worst Case 1)**:
     - Khởi tạo sandbox rỗng.
     - Gọi API các route `/meal-orders`, `/warehouse`, `/approvals`, `/reports` $\rightarrow$ Khẳng định trả về HTTP 200 (mảng rỗng) chứ không ném 500 Unhandled Exception.
     - Kiểm chứng frontend render đúng `emptyScenario = 'empty-first-use'` hoặc `'prerequisite-blocked'` với nút CTA dẫn đường.
  3. **Phase 2: Negative Numbers & Boundary Constraint Violations (Worst Case 2)**:
     - Gửi payload số lượng âm (`-15.5 kg`), đơn giá âm, số suất âm vào các endpoint điều phối, kho và BOM.
     - Khẳng định Backend C# chặn đúng mã 400 Bad Request kèm thông điệp validation rõ ràng.
     - Khẳng định Frontend giữ nguyên form và hiển thị cảnh báo đỏ thân thiện, không bị nổ JavaScript.
  4. **Phase 3: Optimistic Concurrency 409 Lock (Worst Case 3)**:
     - Giả lập 2 phiên cùng sửa một đối tượng (ví dụ: cùng duyệt 1 hồ sơ hoặc cùng cập nhật dòng BOM).
     - Phiên thứ 2 nhận 409 Conflict $\rightarrow$ Khẳng định Frontend kích hoạt trạng thái xung đột, không ghi đè mất dữ liệu và cho phép nạp lại bản mới nhất.
  5. **Phase 4: Network Timeout & Interruption Recovery (Worst Case 4)**:
     - Giả lập ngắt mạng khi đang submit mutation.
     - Khẳng định form giữ nguyên 100% dữ liệu đã nhập, không làm mất công sức của người dùng, hiển thị nút `[Thử lại ngay]`.
  6. **Phase 5: Automated Teardown & Clean State Verification**:
     - Thực hiện hàm dọn dẹp (cleanup/purge) tất cả các bản ghi test được sinh ra trong quá trình chạy.
     - Chạy truy vấn SQL trực tiếp trên database `ipc_mrx_e2e_sandbox` kiểm tra các bảng: `orders`, `dish_boms`, `customers`, `warehouse_issues`...
     - Khẳng định: **Số lượng bản ghi rác còn tồn đọng = 0**.

---

## 6. Đánh Giá Khả Thi & Kiểm Tra Của Người Xây Dựng (Builder Check)
Đóng vai trò là một kỹ sư xây dựng độc lập đánh giá đặc tả:
1. *Liệu hook `useOperationalRecovery` có gây re-render liên tục không?*
   - Giải pháp: Sử dụng `useCallback` cho các handler (`onResetFilters`, `onRetry`, `executeSafeMutation`) và `useRef` lưu trữ cờ sequence để bỏ qua các phản hồi mạng lỗi thời (out-of-order responses).
2. *Liệu việc thay thế icon `Inbox` có làm hỏng các test Playwright/Vitest hiện có không?*
   - Kiểm tra: Các test hiện có tìm kiếm text (nhãn, tiêu đề, mã món) hoặc `role="alert"`, không assert theo tên class của icon `Inbox`. Việc thay thế bằng `lucide-react` icons chuyên biệt là hoàn toàn an toàn và gia tăng điểm UX.
3. *Liệu script harness worst-case có làm đầy dung lượng ổ cứng không?*
   - Giải pháp: Chỉ lưu trữ tối đa 1 báo cáo JSON và các ảnh chụp khi xảy ra lỗi (`on-failure`) vào thư mục `.artifacts/worst-case-harness/`. Phase 5 tự động purge bản ghi database.

---

## 7. Các Quyết Định Kỹ Thuật Đã Chốt (Decisions Made)
- **DEC-REC-01**: Giữ nguyên toàn bộ 14 URL canonical routes trong `routeRegistry.ts`, chỉ can thiệp vào tầng quản lý state, error recovery và presentation bên trong component view của từng route.
- **DEC-REC-02**: Mọi thông báo lỗi từ backend (C# Exception, Error DTO) bắt buộc đi qua bộ lọc `formatters.ts` để hiển thị tiếng Việt tự nhiên, không bao giờ để lộ stack trace hay tên class exception (e.g. `InvalidOperationException`).
- **DEC-REC-03**: Form mutation luôn bảo toàn dữ liệu (`preserved form state`) trên mọi modal của 14 routes. Modal chỉ được đóng khi API trả về kết quả thành công (`HTTP 200/201/204`).
- **DEC-REC-04**: Toàn bộ kiểm thử worst-case chạy độc quyền trên cổng Sandbox 5263. Database chính `ipcmanagement` được bảo vệ bất khả xâm phạm.
