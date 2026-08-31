---
title: IPCManagement UI Architecture and Visual Composition Contract
status: adopted-contract
scope: frontend
owner: IPCManagement
last_reviewed: 2026-08-29
---

# UI architecture and visual composition contract

Đây là contract kiến trúc nền tảng cho cách một màn hình IPCManagement được **cấu tạo, phân vùng và thay đổi
hình học theo state**. File này trả lời “surface nào sở hữu nội dung nào và chúng phải đứng cạnh nhau ra sao”.
Rule chi tiết và mức MUST/SHOULD nằm ở [`DASHBOARD-UI-RULES.md`](DASHBOARD-UI-RULES.md); quy trình sửa và
bằng chứng nằm ở [`UI-UX-EXECUTION-HARNESS.md`](UI-UX-EXECUTION-HARNESS.md).

## 1. Thứ tự authority

Khi xây hoặc sửa UI, quyết định theo thứ tự:

1. **Business authority:** work object, grain, state, permission, mutation owner.
2. **Page composition:** primary task, scope control, work surface, prerequisite/empty/error state.
3. **Shared primitive:** `OperationalFrame`, `CommandBar`, `SectionPanel`, `QueryViewBoundary`, `EmptyState`,
   table/dialog primitives.
4. **Design token:** spacing, type, color, radius, control height và density.
5. **Page-local class:** chỉ dùng khi bốn tầng trên không sở hữu vấn đề.

Không được dùng CSS page-local để bù cho primitive có geometry sai, hoặc dùng primitive generic khi semantic
role của vùng không phù hợp.

## 2. Floorplan chuẩn của trang vận hành

Mỗi route chỉ có một primary work object và tối đa năm vùng theo thứ tự:

```text
Route identity
→ Scope / command controls
→ Context or prerequisite state
→ Primary work surface
→ Secondary detail / rail
```

Các vùng không có dữ liệu phải được bỏ hoặc thay bằng một empty/prerequisite surface có chủ đích; không giữ
một panel trắng chỉ để bảo toàn chiều cao desktop.

### 2.1 Route identity

- Chứa breadcrumb/eyebrow, tên công việc và mô tả ngắn khi cần.
- Không lặp lại tiêu đề đó ở một panel ngay bên dưới nếu panel không tạo thêm ngữ cảnh.

### 2.2 Scope controls

- Filter/select/date chỉ chiếm đúng chiều cao nội dung, thường nằm trong `CommandBar` hoặc header của work surface.
- Label, control và dữ liệu mà control chi phối phải ở cùng một cụm thị giác.
- Async boundary bọc control MUST dùng geometry compact; không được thừa hưởng placeholder dành cho bảng/panel.

### 2.3 Prerequisite và empty

- Một state chỉ có **một** surface diễn giải chính.
- Surface trả lời: vùng này là gì, vì sao chưa dùng được, bước tiếp theo hợp lệ.
- Nếu action là chọn scope, control scope phải nằm trong cùng surface hoặc action phải đưa focus thẳng tới control.
- Không render một work panel rỗng rồi thêm một alert khác bên dưới để giải thích panel đó.

### 2.4 Primary work surface

- Chỉ render khi prerequisite đã đủ hoặc khi skeleton thực sự đại diện cho hình học nội dung sắp xuất hiện.
- Table/card/detail phải bắt đầu gần heading và control liên quan; không có khoảng trắng vô nghĩa ngăn cách chúng.
- Surface không được dùng `flex-grow`, `min-height` hoặc viewport height chỉ để lấp phần còn lại nếu không có
  workflow cần vùng canvas cố định.

## 3. Geometry contract

Mọi shared boundary/panel phải khai một geometry role:

| Role | Dùng cho | Hình học |
|---|---|---|
| `compact` | select, filter, action group, metadata | chiều cao theo nội dung; không min-height lớn |
| `section` | form/summary/list ngắn | min-height chỉ khi skeleton đã biết kích thước |
| `table` | bảng async có header/rows | placeholder khớp số hàng acceptance |
| `workspace` | editor/matrix/canvas thật sự | có thể grow, nhưng phải có content hoặc purposeful empty state |

Default generic không được âm thầm áp geometry `workspace` cho mọi children.

## 4. Visual coherence invariants

Một page composition hợp lệ phải giữ các invariant sau:

1. **Adjacency:** heading, description, control và content cùng work object phải nằm trong cùng visual group.
2. **No orphan control:** control không đứng một mình ở góc của một surface trắng lớn.
3. **No orphan heading:** heading không bị đẩy xuống đáy hoặc cách content đầu tiên quá một section gap.
4. **One-state/one-surface:** không lặp cùng prerequisite/empty/error thành panel trắng + alert hoặc hai alert.
5. **Bounded whitespace:** khoảng trắng phải thể hiện hierarchy, không phải hậu quả của `min-height` generic.
6. **Action proximity:** next action nằm trong state surface hoặc ngay cạnh work object nó tác động.
7. **State honesty:** loading, ready-empty, prerequisite, forbidden và error có geometry/semantics khác nhau.
8. **Responsive continuity:** khi viewport đổi, quan hệ heading → control → state → content không bị đảo hoặc tách rời.

## 5. Primitive ownership

| Concern | Owner | Contract |
|---|---|---|
| Route structure | `OperationalFrame` | Chỉ tạo floorplan; không ép children thành canvas cao |
| Scope/action row | `CommandBar` | Compact, wrap có chủ đích, một primary action |
| Async query state | `QueryViewBoundary` | State semantics + geometry role; placeholder phải phù hợp child |
| Empty/prerequisite | `EmptyState` hoặc shared prerequisite primitive | Một state surface, title/reason/action |
| Repeated work section | `SectionPanel` | Heading/content adjacency; không tạo khoảng trắng vô nghĩa |
| Data comparison | table primitives | Chỉ mount khi có selected work object hoặc purposeful empty state |
| Dialog/detail | canonical Dialog/Drawer | Focus, portal, bounded dimensions |

Nếu một screenshot cho thấy lỗi bố cục, phải xác định primitive/owner trong bảng này trước khi sửa class ở page.

## 6. Screenshot-to-oracle protocol

Screenshot không tự chứng minh root cause, nhưng **là một tín hiệu audit hợp lệ và không được bỏ qua**.
Agent phải:

1. Mô tả candidate defects theo quan hệ thị giác, không theo cảm giác “xấu”.
2. Map mỗi candidate tới invariant/rule ID.
3. Dùng DOM/source để đo geometry và xác định owner.
4. Viết red assertion bắt đúng quan hệ sai.
5. Sửa owner thấp nhất và chạy lại cùng viewport/state.

Ví dụ oracle cho lỗi bố cục:

- chiều cao boundary compact không vượt quá chiều cao control + padding contract;
- khoảng cách heading đến control/content nằm trong token section gap;
- prerequisite page có đúng một visible state surface;
- không có surface trắng lớn mà phần content hữu ích chiếm tỷ lệ quá thấp;
- action của prerequisite đưa focus tới control hợp lệ.

Ngưỡng số cụ thể phải lấy từ token/DOM baseline của component, không suy từ pixel của một ảnh duy nhất.

## 7. Definition of ready cho UI implementation

Trước khi viết JSX phải khóa:

```text
Primary task
Work object và grain
Scope controls
State matrix
One-state/one-surface mapping
Geometry role của từng async boundary
Primary action
Owner thấp nhất
Red oracle
```

Thiếu bất kỳ mục nào thì implementation chưa sẵn sàng. Không dùng browser audit cuối để khám phá lại kiến trúc
mà lẽ ra phải được khóa trước khi code.

## 8. Contract áp dụng khi hợp nhất hoặc chuẩn hóa UI

Các thay đổi presentation từ một branch khác chỉ được nhận sau khi đối chiếu với business authority và phase
contract hiện hành. Không dùng tiêu chí “giao diện mới hơn” để thay thế route, query, mutation hoặc state owner đã
được khóa.

### 8.1 State và operation-mode visibility

- Preference trong browser chỉ được điều chỉnh presentation không mang quyết định. Nó **không được ẩn** operation
  mode, permission/forbidden state, readiness/prerequisite, blocker, error, stale-data warning hoặc next action đang
  được actor sử dụng để ra quyết định.
- Không tạo “streamlined mode” dùng `localStorage` để tắt hàng loạt state surface. Nếu một vùng thật sự dư thừa,
  phải chứng minh bằng owner inventory và sửa/xóa tại owner thấp nhất cho mọi người dùng phù hợp.
- Capability từ server và permission vẫn là authority cho route, tab, query và action. CSS, local preference hoặc
  điều kiện presentation không được mount query owner đã bị mode loại trừ.
- Với `MATERIAL_RECONCILIATION`, composition phải giữ đúng closed loop hiện hành: Weekly Menu → Warehouse issue
  → Reconciliation; Purchasing và Reports không được trở thành reconciliation owner phụ.

### 8.2 Loading, empty và informational copy

- Skeleton phải mô phỏng geometry của nội dung sắp xuất hiện; table dùng row/column skeleton, split workbench dùng
  split skeleton, control compact không dùng placeholder cao như workspace.
- Empty state chỉ xuất hiện sau khi query đã resolve `ready-empty`; không thay loading, error, forbidden hoặc
  prerequisite bằng cùng một câu “chưa có dữ liệu”.
- `InfoNote` chỉ dùng cho giải thích bổ sung không quyết định. Không dùng nó thay alert, blocker, permission,
  readiness, validation diagnostic hoặc audit state.
- Mỗi region giữ một state message và tối đa một next action hợp lệ; không thêm description nếu nó chỉ lặp heading
  hoặc dữ liệu đã hiện trong bảng.

### 8.3 Search và table presentation

- Search của một bảng có thể đặt trong `SectionPanel.actions` khi nó trực tiếp chi phối bảng đó, giữ geometry
  `compact`, có accessible name và vẫn nằm cùng visual group với heading/content. Search phạm vi trang hoặc nhiều
  work object phải ở `CommandBar`, không nhét vào header của một bảng bất kỳ.
- Cột text/name căn trái; quantity/currency căn phải với `tabular-nums`; date/status/action căn theo contract bảng
  đã khóa. Main table ưu tiên 5–7 decision fields, provenance kỹ thuật chuyển vào detail/drawer.
- Ingredient/business name là primary, code là secondary. UUID ẩn mặc định nhưng full identity phải còn khả năng
  inspect/copy/search khi contract yêu cầu; presentation không được thay đổi API/export/audit lineage.
- Status phải đi qua vocabulary/formatter dùng chung; không render raw enum chỉ vì branch presentation có badge mới.

### 8.4 Merge verification

Trước khi chấp nhận một UI merge phải tối thiểu có: source-ownership check cho mode-sensitive pages, focused
behavior tests ở public seam, lint, production build và `git diff --check`. Test được mang từ branch khác nhưng dùng
API/import/owner đã bị phase sau thay thế phải bị loại bỏ hoặc viết lại theo contract hiện hành; không sửa production
để làm xanh một test stale.
