# IPC Material Design System v1 — Desktop Consistency Audit

Ngày audit: 23/07/2026  
Phạm vi: desktop `1365 × 900`, device scale 1  
Baseline: `frontend/.artifacts/ui-audit/desktop-comprehensive-20260723/audit-comprehensive.json`

## 1. Mục tiêu

Tài liệu này là contract thống nhất giao diện IPC cho hệ thống vận hành bếp ăn. Đây không phải bản sao Google Material Design 3 và không tạo thêm UI kit thứ hai. Hệ thống tiếp tục dùng IPC light theme, Base UI wrappers, Tailwind 4, Lucide và các primitive hiện có.

Mục tiêu chính:

- Mọi route có cùng nhịp bố cục, typography, control và trạng thái.
- Button không cắt chữ, tràn chữ hoặc bẻ từng ký tự tiếng Việt.
- Bảng dữ liệu sở hữu scroll; document không tràn ngang.
- Modal, tab, badge và form có cùng interaction contract.
- Màu thể hiện mức độ nghiệp vụ, không dùng để trang trí.

## 2. Bằng chứng audit

Baseline bao gồm:

- 10 route nghiệp vụ chính.
- 61 trạng thái route/tab/popover/modal có thể truy cập an toàn.
- 114 screenshot đúng `1365 × 900`.
- 11 modal thực tế.
- Không có ảnh trắng, missing screenshot hoặc Vite error overlay.
- Không có page-level horizontal overflow trong 15 route gốc.

Các trạng thái mutation, tải file hoặc bị server khóa được ghi trong `exclusions` của manifest và không bị kích hoạt để bảo vệ dữ liệu.

## 3. Kết luận chính

### DS-01 — Hai hệ button đang cạnh tranh

Ứng dụng dùng đồng thời:

1. `components/ui/Button`: Base UI + CVA, font 14px, chiều cao cố định `24/28/32/36px`, `whitespace-normal` rồi chuyển thành `nowrap` từ breakpoint `sm`.
2. `.ipc-button`: font 13px, `min-height: 32px`, padding `7px 10px`, `overflow-wrap: anywhere`.

Hậu quả:

- Cùng một loại hành động nhưng khác chiều cao, font, padding và focus treatment.
- `overflow-wrap:anywhere` cho phép tiếng Việt xuống dòng tại bất kỳ ký tự nào.
- Button Base UI có chiều cao cố định nhưng có thể nhận nội dung nhiều dòng ở viewport hẹp, dẫn đến cắt chữ theo chiều dọc.
- `min-width:0`, `max-width:100%`, `shrink-0`, `nowrap` và parent `overflow-hidden` tạo các quy tắc co giãn đối nghịch.

### DS-02 — Layout đang sửa lỗi chữ ở cấp trang

Nhiều route thêm `whitespace-nowrap`, `min-w-*`, `max-w-*` hoặc override `.ipc-button` riêng. Đây là dấu hiệu button chưa có contract ổn định. Lỗi chữ sau đó tái xuất hiện khi grid/table thay đổi.

### DS-03 — Action label bị ép vào cột quá hẹp

Các vùng dễ lỗi nhất:

- Sáu bước Thu mua.
- Action queue Dashboard.
- Metadata/chứng từ ở Nhu cầu KHSX.
- Row actions trong bảng Báo cáo, Quản trị dữ liệu và Kho.
- Card Duyệt vận hành.

Không nên sửa bằng `overflow-wrap:anywhere`. Parent phải wrap action group hoặc table phải scroll cục bộ.

### DS-04 — Component language nhìn chung đã thống nhất

Sidebar, page header, semantic colors, panel và table đã có nền tảng tốt. Không cần redesign toàn bộ. Cần hợp nhất token/component contract rồi migration theo mức độ ảnh hưởng.

## 4. Token architecture

IPC dùng ba lớp token. Component không được tham chiếu raw hex nếu semantic token đã tồn tại.

```text
Primitive → Semantic → Component
```

### 4.1 Primitive

Giữ các giá trị nền hiện có:

- Slate 50–900.
- Primary blue.
- Success teal.
- Warning amber.
- Danger red.
- Spacing theo bội số 4.
- Radius nhỏ 2–6px.
- Motion 120–200ms.

### 4.2 Semantic

Contract bắt buộc:

```css
--surface-page;
--surface-panel;
--surface-muted;
--text-primary;
--text-secondary;
--text-disabled;
--border-default;
--border-strong;
--action-primary;
--action-primary-hover;
--status-success;
--status-warning;
--status-danger;
--focus-ring;
```

### 4.3 Component

Button, input, tab, badge, table và dialog chỉ dùng component token:

```css
--button-height-sm;
--button-height-default;
--button-padding-inline;
--button-font-size;
--button-font-weight;
--button-radius;
--button-gap;
--button-focus-ring;
```

## 5. Canonical Button contract

### 5.1 Kích thước

| Size | Height | Font | Padding ngang | Dùng cho |
| --- | ---: | ---: | ---: | --- |
| `xs` | 32px | 12px | 8px | Table utility/action rất ngắn |
| `sm` | 36px | 14px | 12px | Compact operational toolbar |
| `default` | 40px | 14px | 16px | Form/modal/page action |
| `lg` | 44px | 14px | 20px | Primary action cần nhấn mạnh |
| `icon` | 36×36px | — | 0 | Icon-only có `aria-label` |

`sm` là kích thước mặc định cho màn desktop dày dữ liệu. `xs` không dùng cho primary/destructive action.

### 5.2 Variants

| Variant | Vai trò |
| --- | --- |
| `primary` | Một hành động chính trên surface |
| `outline` | Hành động phụ |
| `ghost` | Navigation, filter, utility |
| `success` | Hành động tạo kết quả đã chấp nhận |
| `warning` | Hành động cần thận trọng nhưng không destructive |
| `destructive` | Xóa, từ chối hoặc hủy có hậu quả |
| `link` | Điều hướng trong nội dung |

Không dùng màu success/danger chỉ vì trạng thái của record; màu button mô tả hậu quả của hành động.

### 5.3 Chính sách chữ

Button chuẩn là một dòng và không được tự bẻ chữ:

```css
.ipc-button,
[data-slot='button'] {
  flex: none;
  min-width: max-content;
  max-width: 100%;
  white-space: nowrap;
  overflow-wrap: normal;
  word-break: keep-all;
}
```

Nếu parent không đủ rộng:

1. Action group wrap sang dòng mới.
2. Table tăng `min-width` và scroll trong `TableViewport`.
3. Toolbar chuyển button xuống hàng.
4. Không ép label xuống từng ký tự và không dùng ellipsis cho hành động nghiệp vụ.

Button nhiều dòng chỉ được dùng qua variant rõ ràng:

```css
.ipc-button.is-wrapping {
  min-width: 0;
  height: auto;
  min-height: var(--button-height-sm);
  white-space: normal;
  overflow-wrap: normal;
  word-break: normal;
}
```

Variant này dành cho card CTA có không gian cố định, không dùng trong table cell hoặc toolbar.

### 5.4 Anatomy

- Icon 16px, `shrink: 0`, `aria-hidden=true` khi label đã mô tả hành động.
- Label không có `line-clamp` hoặc ellipsis.
- Spinner thay icon đầu, giữ nguyên chiều rộng button khi loading.
- Loading dùng `aria-busy=true`; disabled dùng native `disabled`.
- Focus ring 2px, offset 2px, contrast tối thiểu 3:1.

### 5.5 Container contract

```css
.ipc-action-group {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 8px;
  min-width: 0;
}
```

Không đặt `overflow:hidden` trực tiếp quanh action group nếu không có lý do nghiệp vụ. Trong bảng, action cell dùng `white-space:nowrap` và table chịu trách nhiệm về min-width/scroll.

## 6. Shared component contract

### Tabs

- Cao 36px, font 14px/600.
- Một tab label không bẻ từng ký tự.
- Tablist được wrap hoặc scroll cục bộ khi không đủ chỗ.
- Có `role=tablist/tab/tabpanel`, `aria-selected` và linkage đầy đủ.
- Không dùng màu fill mạnh cho cả tablist; chỉ active tab dùng primary-soft + border.

### Badge

- Cao 20 hoặc 24px.
- Luôn có text; màu chỉ bổ trợ.
- Không dùng badge như button.
- Label dài phải được rút gọn bằng copy nghiệp vụ, không ép nhiều dòng trong table.

### Input và Select

- Compact 36px; form/modal mặc định 40px.
- Label luôn hiển thị hoặc có accessible name rõ ràng.
- Date hiển thị thống nhất `DD/MM/YYYY`; không để `mm/dd/yyyy` xen lẫn giao diện Việt.
- Error nằm sát field và được nối bằng `aria-describedby`.

### Table

- `TableViewport` sở hữu horizontal/vertical scroll.
- Header opaque và sticky.
- Text trái, số phải, status giữa, action phải.
- Row compact 40px hoặc default 48px.
- Action cell không bẻ label; tăng table min-width nếu cần.
- Bảng trên 100 dòng phải có search/filter và pagination/cursor rõ ràng.

### Dialog

- Confirmation: 384–512px.
- Form: 640–768px.
- Data-heavy: tối đa viewport trừ 32px.
- Header/footer sticky; content là vùng scroll duy nhất.
- Safe action đứng trước, primary/destructive action đứng cuối.
- Escape đóng modal trước mutation và trả focus về trigger.

## 7. Page composition contract

Mỗi route có đúng:

1. Page header.
2. Một command/filter row.
3. Một context strip.
4. Một primary action group.
5. Các section panel.
6. Một feedback region.

Không lặp cùng một trạng thái ở header, KPI, alert và table nếu không thêm thông tin mới.

## 8. Ưu tiên migration

### P0 — Button foundation

- Hợp nhất `Button` và `.ipc-button` về cùng token/size/text contract.
- Loại `overflow-wrap:anywhere` khỏi button/action control.
- Thêm `ActionGroup` hoặc canonical class cho wrapping parent.
- Thêm visual regression fixture cho label tiếng Việt dài.

### P1 — Các surface đang gây lỗi chữ

1. `PurchaseWorkflowGuide`.
2. Dashboard action queue.
3. KHSX document/output cards.
4. Approval record actions.
5. Admin/report table action cells.

### P2 — Shared controls

- ViewSwitcher/tab dimensions.
- Input/select/date formatting.
- Badge sizes và semantic variants.
- Dialog header/content/footer geometry.

### P3 — Route alignment

- Dashboard, Weekly Menu, Coordination, Approvals.
- Purchasing, Warehouse, Chef.
- Reports, Admin Data, Approval Rules.

## 9. Verification gates

Mỗi batch refactor phải đạt:

- Screenshot before/after tại `1365 × 900`.
- Không body horizontal overflow.
- Không button có `scrollWidth > clientWidth + 1`.
- Không button label cao hơn content box.
- Không action label dùng `overflow-wrap:anywhere`.
- Tab, modal và dropdown dùng được bằng keyboard.
- Focus visible.
- Console không có duplicate React key.
- Build, lint và focused tests pass.

Fixture button tối thiểu:

- `Xác nhận nhà cung cấp`.
- `Tạo phiếu xuất kho`.
- `Gửi duyệt ngoại lệ giá`.
- `Ghi nhận nhập kho từ đơn mua`.
- `Hoàn tất nhu cầu nguyên liệu`.
- `Quay lại chọn nhà cung cấp`.

Kiểm tra ở container 96, 128, 160, 240 và 320px để đảm bảo parent wrap đúng thay vì phá chữ.

## 10. Không được làm

- Không cài/khởi tạo shadcn CLI mới trong repo hiện tại.
- Không thêm UI kit, font hoặc icon family thứ hai.
- Không sửa lỗi bằng `word-break: break-all` hoặc `overflow-wrap:anywhere` trên button.
- Không dùng ellipsis cho hành động có hậu quả nghiệp vụ.
- Không biến mọi button thành full-width trên desktop.
- Không dùng bo tròn lớn, gradient, glass hoặc marketing card.
- Không refactor workflow/API khi chỉ sửa visual contract.

## 11. Definition of done

Material Design System v1 hoàn thành khi:

- Button chỉ còn một contract thị giác và interaction.
- Shared token/component layer là nguồn duy nhất cho size, color, focus và typography.
- 61 baseline states có bộ ảnh after tương ứng.
- Không còn lỗi chữ button trong toàn bộ baseline desktop.
- Các route giữ nguyên hành vi nghiệp vụ và authorization.
