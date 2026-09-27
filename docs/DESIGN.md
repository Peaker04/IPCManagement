---
title: IPCManagement UI Architecture and Visual Composition Contract
status: adopted-contract
scope: frontend
owner: IPCManagement
last_reviewed: 2026-08-29
---

# UI architecture and visual composition contract

Đây là **điểm vào authority duy nhất cho quyết định thiết kế frontend** của IPCManagement. File này định nghĩa
product character, hierarchy, composition, token/component semantics và governance; nó liên kết tới owner chuyên
biệt thay vì chép lại toàn bộ rule. `DASHBOARD-UI-RULES.md` giữ mã rule và mức MUST/SHOULD/MAY;
`UI-PHILOSOPHY.md` là index áp dụng; execution/evidence vẫn thuộc harness và measurement protocol.

Mục tiêu là để developer hoặc AI bắt đầu từ business authority → file này → semantic token/component hiện có,
không cần dùng Fiori, shadcn, Flighty, Refero, screenshot hoặc generic design skill làm nguồn quyết định sản phẩm.

## 1. Thứ tự authority

Khi xây hoặc sửa UI, quyết định theo thứ tự:

1. **Business authority:** work object, grain, state, permission, mutation owner.
2. **Design authority:** product character, hierarchy, composition và semantic contract trong file này.
3. **Normative rule:** ID và mức bắt buộc trong `DASHBOARD-UI-RULES.md`.
4. **Shared implementation:** route metadata, primitive, formatter/query/action seam và semantic token hiện có.
5. **Feature composition:** domain component và page orchestration.
6. **Page-local class:** chỉ dùng khi năm tầng trên không sở hữu vấn đề.

`UI-PHILOSOPHY.md`, skill, external checklist, thư viện UI, CSS legacy, screenshot và historical artifact không
được tạo quyết định cạnh tranh. Chúng lần lượt là index, implementation support, quality adapter hoặc evidence.
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
| Repeated work section | `SectionPanel` | Heading/content adjacency; route-primary mặc định `h2` dưới shell `h1`; nested/detail phải khai `h3`/`h4` tường minh; không tạo khoảng trắng vô nghĩa |
| Data comparison | table primitives | Chỉ mount khi có selected work object hoặc purposeful empty state |
| Dialog/detail | canonical Dialog/Drawer | Dialog chặn luồng và trap focus; positioning layer không scroll; luồng dài dùng một `DialogBody` primary vertical scroll owner với header/footer cố định. Nested vertical collection phải độc lập và có accessible region. Drawer master–detail chỉ đọc dùng portal/side geometry nhưng không backdrop chặn, không trap focus hoặc khóa nền |

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

## 7. Definition of Ready — thiết kế theo tác vụ và vai trò

Áp dụng trước mọi thay đổi **tạo, sửa hoặc loại bỏ UI**, kể cả nhận UI từ branch khác. Thiết kế phải truy vết
được từ vấn đề/người dùng đến luồng công việc, authority, dữ liệu, composition và oracle; không bắt đầu bằng
việc chọn màu/component rồi mới tìm mục đích. Đây là đầu vào của [UI execution harness](UI-UX-EXECUTION-HARNESS.md),
không phải một workflow hoặc bộ checklist song song.

### 7.1. Design brief bắt buộc

Ghi brief trong plan/ledger GSD đang sở hữu mục tiêu. Với thay đổi nhỏ, ghi delta và link contract không đổi;
không điền lại toàn hệ thống, không tạo file cho mỗi control. Mục không áp dụng cần lý do, không để trống.

```text
Problem/outcome: ai gặp vấn đề gì; hoàn thành công việc hoặc ra quyết định nào?
Change: tạo UI | sửa UI | bỏ UI; phạm vi và ngoài phạm vi.
Context: operation mode/capability; work object, grain, đơn vị và data scope.
Actors: người khởi tạo, người xem, người quyết định, người nhận việc tiếp; separation of duties.
Authority: domain decision; BE policy/claims/scope/state guard; FE route/query/action owner.
Journey: đầu vào/entry point -> tác vụ hiện tại -> đầu ra/next owner; Back/deep-link/return context.
Actions: precondition -> navigation hoặc command -> postcondition -> destination/handoff.
Visibility: route/tab/row/field/action theo actor; lý do hidden/disabled/read-only/forbidden.
States/recovery: query state + entity state + draft/pending; lỗi, conflict/stale, retry/cancel/recovery.
Data safety: tác động tạo/sửa/xóa; draft chưa lưu, dependent records, immutable history, audit, undo hợp lệ.
Composition: floorplan, scope controls, primary action, one-state/one-surface mapping;
             geometry role của từng async boundary, owner thấp nhất, primitive/token dùng lại.
Coherence: cùng object/state ở màn upstream/downstream có cùng nhãn, thông tin bắt buộc và action hợp lệ.
Acceptance: rule IDs, scenario, expected result, red-capable oracle, evidence/viewport scope.
Open decisions: điều chưa rõ về outcome/quyền/dữ liệu/phạm vi cần owner quyết định.
```

Agent tự đọc authority và source để trả lời phần đã có; chỉ hỏi Kỳ quyết định chưa có hoặc đang mâu thuẫn.
Source mô tả observed behavior, không tự hợp pháp hóa behavior trái domain contract. Không suy permission từ tên
role, không giả định Admin được bỏ qua separation of duties; mode không cấp quyền.

### 7.2. Ma trận actor–action–transition

Với action, visibility hoặc workflow bị ảnh hưởng, mỗi hàng đại diện một scenario/action có ý nghĩa:

```text
Actor | Mode/capability | Object/data scope | Entity state | Action |
BE permission/guard | FE visibility/eligibility | Block reason |
Destination/transition | Next owner | Rule/oracle/evidence
```

- Actor đủ quyền và actor bị từ chối phải được disposition; không chỉ mô tả happy path của Admin.
- Truy cả quyền xem dữ liệu (row/field scope) và quyền hành động, không chỉ menu/button. Backend phải chặn
  request trái phép dù gọi trực tiếp; không fetch dữ liệu nhạy cảm rồi chỉ che bằng CSS.
- Query state, entity state và local draft/pending là các chiều khác nhau. Ma trận dùng scenario hợp lệ,
  không sinh mọi tích Descartes hoặc một permission registry production mới.
- Hàng bàn giao phải chỉ rõ người nhận nhìn thấy object/state gì và làm bước tiếp theo ở đâu. Next action chỉ
  hiện cho actor đủ quyền; actor khác thấy người chịu trách nhiệm/hướng dẫn phù hợp, không được tự nâng quyền.
- Với sửa token/copy thuần túy không đổi action, link ma trận/contract liên quan và ghi `unchanged` có căn cứ.
  Điều chưa xác minh vẫn là `NEEDS_EVIDENCE`, không ghi quyền phỏng đoán.

Decision table visibility/disablement có owner tại
[chuẩn FE–BE–DB §4.3](UI-UX-FE-BE-DATABASE-STANDARDIZATION.md); không sao chép logic sang từng trang.

### 7.3. Gate sẵn sàng và review luồng trước code

Trước JSX, walkthrough ít nhất luồng chính và nhánh từ chối/khôi phục liên quan: entry → hành động → feedback →
trạng thái sau lưu/reload → người nhận bước tiếp. Có thể dùng sơ đồ text/floorplan ngắn; không bắt buộc mockup
hoặc Figma khi contract hiện có đủ quyết định. Không dùng screenshot đẹp thay kiểm tra tính liên kết nghiệp vụ.

- `PASS`: brief đủ cho phạm vi, authority không mâu thuẫn, acceptance quan sát được, oracle xác định rõ.
- `BLOCKED`: thiếu quyết định nghiệp vụ/quyền/data safety; chỉ dừng phần phụ thuộc, không đoán để code tiếp.
- `NEEDS_EVIDENCE`: chưa có source/oracle cần để khóa quyết định; chưa sẵn sàng implement phần đó.
- Regression fix phải có red loop đã chạy theo Lean delivery. UI mới phải có red-capable acceptance scenario
  trước implementation; không yêu cầu một bug tái hiện trên màn hình chưa tồn tại.

Outcome phải mô tả việc người dùng hoàn thành, không chỉ “không overflow/đúng màu”. Usability với người dùng thật
và performance là claim riêng, cần scenario/baseline/phép đo được duyệt; walkthrough/test kỹ thuật không chứng minh
người dùng hoàn thành nhanh hơn. Không tự đặt time target hoặc số lượng người tham gia mới.

Bỏ một control/route phải disposition entry links, deep-link, query/action owner, người còn cần tác vụ và đường
thay thế; bỏ UI không cho phép xóa business record. Delete, cancel, deactivate và compensating transaction là
các semantics khác nhau; undo chỉ được cung cấp khi domain cho phép, không rewrite immutable history.

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

### 8.5 Operation-mode coverage trước shared rollout

Mọi migration shared component, table hoặc search family phải khai báo coverage trước khi sửa production:

```text
shared seam / family
→ DEFAULT consumers
→ MATERIAL_RECONCILIATION consumers
→ BOTH / DEFAULT_ONLY / MRX_ONLY
→ browser evidence cho từng mode áp dụng
```

`BOTH` nghĩa là có consumer hoặc composition thật trong cả hai mode, không có nghĩa một browser run ở DEFAULT đại
diện cho MRX. `DEFAULT_ONLY`/`MRX_ONLY` phải dựa trên `systemOperationEligibility` và capability/tab contract hiện
hành; mode còn lại ghi `NOT_APPLICABLE`, không ghi PASS. Shared seam được dùng bởi cả hai mode phải giữ behavior
test chung và có browser evidence riêng cho mỗi composition áp dụng trước khi rollout family được đóng. Natural
state không có thì ghi `NEEDS_EVIDENCE`; không seed, switch mode hoặc mutate dữ liệu chỉ để lấp ô. Ma trận rollout
hiện hành và denominator Wave 4 nằm trong
`.planning/notes/FE-DESIGN-SYSTEM-RECONSTRUCTION-WAVE1.md` §17.

## 9. Product UI character

IPCManagement là giao diện vận hành bếp ăn công nghiệp cho Điều phối, Thu mua, Kho, Bếp, Manager và Admin.
Thiết kế mặc định phải **đậm thông tin, yên tĩnh ở trạng thái bình thường và nổi bật khi cần quyết định**:

- work object, customer/week/date/mode, grain, owner và next action đứng trước decoration;
- bảng ưu tiên trường ra quyết định; provenance kỹ thuật đi vào detail nhưng vẫn inspect/copy được;
- normal state dùng neutral; màu semantic dành cho info, warning, danger hoặc completion có ý nghĩa;
- whitespace tạo hierarchy, không tạo cảm giác landing page hoặc canvas trống;
- thao tác lặp lại phải keyboard/focus-friendly và giữ continuity khi Back, deep-link, refresh hoặc refetch;
- surface, status, action và feedback phải phản ánh cùng vocabulary/domain state ở upstream và downstream.

Các từ `clean`, `modern`, `premium`, `beautiful` hoặc `minimal` không phải requirement nếu không nêu hậu quả
triển khai và tác vụ người dùng được cải thiện.

## 10. Information hierarchy và spatial composition

Thứ tự nhấn mạnh mặc định:

```text
primary task / exception
→ current scope and workflow state
→ valid next action
→ decision data
→ supporting context
→ provenance / technical detail
```

Grouping ưu tiên proximity, alignment, typography và whitespace; border hoặc tonal surface chỉ thêm khi cần
ranh giới tương tác/scroll/state. `Card` không phải primitive nhóm mặc định. Một panel chỉ hợp lệ khi nó sở hữu
một work object, state, scroll region hoặc action boundary độc lập.

## 11. Semantic foundation contract

### 11.1 Typography

Các role canonical là `page-title`, `section-title`, `body`, `label`, `caption/metadata`, `table`,
`table-header`, `numeric` và `code` khi thực sự cần. Mỗi role giữ purpose trước size; feature không tự tạo type
scale mới. Numeric dùng tabular figures. Technical code không được trở thành primary label.

### 11.2 Token architecture

```text
primitive value
  → semantic role
  → component token only when semantic role is insufficient
  → feature composition
```

Primitive gồm neutral/chromatic scales, spacing, type, radius, size và motion. Semantic gồm surface, text,
border, action, feedback/status, focus và overlay. Feature code không được đặt tên token theo raw color hoặc
business enum. Compatibility alias chỉ tồn tại trong migration có consumer và điều kiện xóa rõ.

### 11.3 Spacing và geometry

Spacing phải phân biệt: inside component → related elements → group → section → region/page. Control height,
row density, radius và elevation dùng vocabulary hữu hạn. Giá trị số mới phải map vào purpose; không tạo token
chỉ để hợp thức hóa một pixel page-local.

### 11.4 Surface và elevation

Surface model mặc định: `canvas`, `base`, `subtle`, `overlay`. Border tạo ranh giới; tonal difference tạo phân
nhóm nhẹ; shadow chủ yếu dành cho overlay hoặc affordance cần depth. Nested rounded cards và arbitrary shadow là
anti-pattern. Overlay phải có z-index/focus/scroll owner rõ.

## 12. Status, feedback và content

Projection bắt buộc:

```text
business state → user meaning → severity → semantic token → presentation
```

Không map enum trực tiếp sang màu. Status cần chữ hoặc semantic shape/icon, không truyền tin chỉ bằng màu.
Normal status xuất hiện gần như mọi hàng nên được bỏ, chuyển thành fact/filter hoặc dùng neutral thay vì badge
màu. Error/empty/forbidden/loading/refreshing/prerequisite là state khác nhau và có recovery khác nhau.

Nhãn route, action, status, empty state và error dùng vocabulary trong `GLOSSARY.md`/domain owner. Copy phải nói
điều gì xảy ra và người dùng làm gì tiếp; mã kỹ thuật chỉ ở detail có khả năng sao chép khi cần truy vết.

## 13. Canonical component contract

Design document sở hữu `purpose, anatomy, semantic variants, states, content, responsive and accessibility`;
source component sở hữu API và mechanics. Canonical concepts hiện gồm:

- mechanics: Button, Input, Select, Checkbox, Radio/Toggle, Tabs, Dialog, Drawer, Table;
- operational primitives: `OperationalFrame`, `CommandBar`, `SectionPanel`, `QueryViewBoundary`, `EmptyState`,
  `InlineAlert`, `StatusBadge`, `TableViewport`, pagination, SearchField/FieldRow;
- domain composition thuộc feature; không đưa business concept vào `shared/ui` để tái sử dụng giả tạo.

Không tạo `V2`, `New`, `Custom` hoặc parallel primitive. Nếu component chung thiếu semantic contract, mở rộng owner
hiện có bằng regression; nếu chỉ một feature cần composition, giữ local.

## 14. Navigation and route metadata

Path, document title, shell title, navigation label/icon, permission/mode constraints, preference key và UI
ownership metadata có một owner typed tại `frontend/src/routes/routeRegistry.ts`. Router vẫn được phép explicit
để guard tree dễ đọc; registry không được biến thành generic route engine. Permission backend vẫn là authority
cuối cùng và không được suy từ navigation metadata.

URL sở hữu tab/filter/page/modal quan trọng khi contract yêu cầu deep-link. Back/Forward phải phục hồi cùng work
object và scope; browser preference chỉ điều chỉnh presentation không mang quyết định.

## 15. Responsive, motion và accessibility

Responsive là hành vi, không chỉ breakpoint: xác định phần nào wrap, stack, scroll, collapse hoặc chuyển overflow
mà vẫn giữ hierarchy và next action. Bảng rộng có scroll owner cục bộ; cấm che document overflow bằng
`overflow-x: hidden`. Desktop matrix, 200% reflow và mobile/tablet claim tuân theo execution harness; chưa đo thì
`NEEDS_EVIDENCE`.

Motion chỉ phục vụ orientation, disclosure, continuity hoặc state feedback; dùng transform/opacity và tôn trọng
`prefers-reduced-motion`. Không motion decoration cho normal workflow.

Accessibility là design input: contrast, visible focus, keyboard equivalence, target size, semantic heading/table,
form error association, status not color-only, dialog focus/return, reduced motion và zoom/reflow. External
checklist mở rộng coverage nhưng không sở hữu contract.

## 16. AI implementation and governance

Mọi implementation đi theo:

```text
requirement → domain/actor/grain → DESIGN + rule IDs → existing owner?
→ red-capable acceptance → smallest implementation → focused verification
```

Generic design skills và external references chỉ được đưa option cho quyết định còn mở; không tự chọn visual
identity. Không tạo redesign stylesheet, token hoặc component trước khi xác định owner/consumer. Thay đổi contract
phải cập nhật file này hoặc linked canonical owner trong cùng task. Runtime CSS không được dùng làm lý do hợp pháp
hóa behavior trái contract.

Migration design system theo shared root cause và consumer dependency, không theo screenshot/page ngẫu nhiên.
`frontend/src/styles/components/tables.css` là owner duy nhất cho base geometry/presentation của `.ipc-data-table`;
`styles/index.css` chỉ giữ token/global foundation và các owner không phải shared data table. Legacy CSS chỉ xóa sau khi
selector/import inventory chứng minh không còn consumer; không mass rename token hoặc blind find-and-replace.
