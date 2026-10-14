# UI Kit & Component Catalog — IPC Management

> Tài liệu chuẩn hóa kiến trúc UI Kit của dự án.
> Authority chain: `docs/DESIGN.md` (Presentation Contract) → file này (Component Catalog & Blueprints) → `frontend/src/styles/index.css` (Design Tokens).
> Tiêu chuẩn kiểm thử và browser verification: tham chiếu [ENGINEERING](ENGINEERING.md).

---

## 1. Semantic Token Mapping & Styling Governance

Tất cả giá trị thô (raw CSS values) được định nghĩa duy nhất tại `frontend/src/styles/index.css` (Single Source of Truth). Component và view TUYỆT ĐỐI KHÔNG dùng mã màu hex hoặc pixel inline; chỉ sử dụng semantic CSS variables.

| Semantic Category | Token Prefix / Name | Mục đích sử dụng | Single Source File |
|---|---|---|---|
| **Surface** | `--ipc-color-surface`, `--ipc-color-surface-subtle`, `--ipc-color-surface-accent`, `--ipc-color-surface-selected` | Nền trang, thẻ panel, thanh trạng thái, nền dòng được chọn | `frontend/src/styles/index.css` |
| **Text** | `--ipc-slate-900` (heading), `--ipc-slate-800` (primary body), `--ipc-slate-500` (secondary/muted), `--ipc-slate-400` (icon/disabled) | Cấp bậc văn bản, nhãn metadata, màu biểu tượng | `frontend/src/styles/index.css` |
| **Border** | `--ipc-color-border-subtle`, `--ipc-color-border-muted`, `--ipc-color-border-strong`, `--ipc-color-border-table-header` | Đường kẻ hairline 1px, viền bảng, viền thẻ | `frontend/src/styles/index.css` |
| **Brand / Primary** | `--ipc-primary`, `--ipc-primary-hover`, `--ipc-primary-soft`, `--ipc-primary-600` | Nút hành động chính, liên kết, trạng thái focus, accent tint | `frontend/src/styles/index.css` |
| **Status (Semantic)** | `--ipc-success`, `--ipc-warning`, `--ipc-danger`, `--ipc-info` (kèm các biến `-soft`) | Chỉ thị trạng thái thành công, cảnh báo, lỗi, thông tin | `frontend/src/styles/index.css` |
| **Spacing / Sizing** | `--ipc-space-1` (4px) đến `--ipc-space-8` (32px), lưới cơ sở 4px | Padding, margin, gap giữa các thành phần giao diện | `frontend/src/styles/index.css` |

### Lệnh cấm sử dụng (Deprecated / Banned CSS):
- **BANNED**: `frontend/src/styles/redesign/*` (`fiori.css`, `demand.css`, `dashboard.css`, `responsive.css`) và `frontend/src/styles/ui-redesign.css` — đã bị loại bỏ hoàn toàn khỏi kiến trúc vận hành.
- **SANDBOX ONLY (Banned in Production)**: `frontend/src/styles/planning-demand-preview-tokens.css` chỉ dùng riêng cho file HTML prototype trong `frontend/preview/`. Nghiêm cấm import vào code ứng dụng production.

---

## 2. UI Primitives (`frontend/src/components/ui/`)

13 primitives cơ bản dạng headless/shadcn, chịu trách nhiệm tương tác và khả năng tiếp cận (A11y).

| Component | File Path | Variants / Props được phép | Quy tắc ràng buộc | Test Hợp đồng |
|---|---|---|---|---|
| `Button` | `components/ui/button.tsx` | variant: `primary`, `secondary`, `outline`, `destructive`, `ghost`; size: `sm`, `default`, `lg` | `D7` (tối đa 1 primary/vùng), `M2.2` | `button.contract.test.tsx` |
| `Input` | `components/ui/input.tsx` | type: `text`, `number`, `email`, v.v.; size: `sm`, `default`; error: boolean | `I1–I4`, `D6` (font >=12px) | `input.contract.test.tsx` |
| `VietnameseDateInput` | `components/ui/VietnameseDateInput.tsx` | value: `string` (dd/MM/yyyy); min/max date; error: boolean | `NFR-UI-03`, `I5` | `vietnameseDateInput.contract.test.tsx` |
| `Select` | `components/ui/select.tsx` | size: `sm`, `default`; options list; searchable: boolean | `I1–I4`, `M2.16` | `select.contract.test.tsx` |
| `Checkbox` | `components/ui/checkbox.tsx` | checked: boolean / `indeterminate`; disabled: boolean | `A2` (hỗ trợ phím Space) | `checkbox.contract.test.tsx` |
| `Textarea` | `components/ui/textarea.tsx` | rows: number; maxLength: number; resize: `none`, `vertical` | `I1`, `D6` | `textarea.contract.test.tsx` |
| `Badge` | `components/ui/badge.tsx` | variant: `default`, `secondary`, `outline`, `destructive` | `S0`, `S1.8` | `badge.contract.test.tsx` |
| `Card` | `components/ui/card.tsx` | Card, CardHeader, CardTitle, CardContent, CardFooter | `D1–D4`, `D8` (viền hairline, không shadow) | `card.contract.test.tsx` |
| `Dialog` | `components/ui/dialog.tsx` | Dialog, DialogTrigger, DialogContent, DialogHeader, DialogFooter | `M1.1–M2.14` (1 vùng cuộn, portal cleanup) | `dialog.contract.test.tsx` |
| `Drawer` | `components/ui/drawer.tsx` | Drawer, DrawerTrigger, DrawerContent; side: `left`, `right` | `M1.1`, `M2.1` | `drawer.contract.test.tsx` |
| `Table` | `components/ui/table.tsx` | Table, TableHeader, TableBody, TableRow, TableHead, TableCell | `T1–T8` (compact density 36-40px, tabular-nums) | `table.contract.test.tsx` |
| `Separator` | `components/ui/separator.tsx` | orientation: `horizontal`, `vertical` | `D1`, `T5` (viền mảnh slate-200) | `separator.contract.test.tsx` |
| `Toggle` / `ToggleGroup` | `components/ui/toggle.tsx`, `toggle-group.tsx` | type: `single`, `multiple`; variant: `default`, `outline` | `N6`, `C10` (chuyển view/bộ lọc) | `toggle.contract.test.tsx` |

---

## 3. Shared Operational Composites (`frontend/src/components/common/`)

Các composite cấp ứng dụng chia thành 4 họ chức năng phục vụ luồng vận hành công nghiệp:

### Family A (`C-LAYOUT` — Shell & Page Framing)
- `OperationalFrame`: Khung bao ngoài chuẩn mực của trang vận hành, quản lý header, breadcrumb, toolbar và trạng thái tải.
- `SplitWorkbench`: Khung chia đôi màn hình Master-Detail (danh sách bên trái, chi tiết/chỉnh sửa bên phải).
- `CommandBar`: Thanh lệnh chứa bộ lọc, nút bấm hành động chính/phụ và công cụ tìm kiếm.
- `ContextStrip`: Dải thông tin ngữ cảnh hiển thị nhanh mã đối tượng, trạng thái, người phụ trách và KPI ca.
- `SectionPanel`: Khung khối nội dung có tiêu đề, đường phân cách và padding chuẩn.
- `SideRail` & `DocumentRail`: Thanh tiện ích phụ bên sườn phục vụ tra cứu tài liệu tham chiếu.
- `PageBanner`: Thông báo quan trọng cấp trang (cảnh báo hệ thống, chuyển đổi chế độ vận hành).
- `PageStepper`: Thanh hiển thị tiến trình nhiều bước của quy trình chứng từ.
- `ViewSwitcher` & `KeepAliveTabPanel`: Điều phối hiển thị các view con và lưu giữ trạng thái form.

### Family B (`C-TABLE` — Table, Viewport & Pagination)
- `TableViewport`: Vùng cuộn bảng dữ liệu đạt chuẩn `T7` (sticky header, cố định cột đầu tiên khi cuộn ngang).
- `PaginatedTableFrame`: Khung kết hợp giữa bảng dữ liệu, thanh điều khiển mật độ và phân trang.
- `PaginationBar` & `CursorPaginationBar`: Thanh điều hướng phân trang số trang và phân trang con trỏ (cursor).
- `TablePreferencesControl`: Hộp công cụ cho phép người dùng tùy chọn ẩn hiện cột và chuyển đổi mật độ hiển thị (`T8`).
- `TableSkeleton` & `SkeletonTableRow`: Khung tải giả lập hình học khớp chính xác kích thước bảng thật (`C1`).
- `TableEmptyState`: Trạng thái rỗng chuyên dụng cho bảng dữ liệu khi không có bản ghi hoặc bộ lọc không khớp (`E2`).

### Family C (`C-STATE` — 6-State Boundary & Feedback)
- `QueryViewBoundary`: Biên kiểm soát hiển thị 6 trạng thái UI (`loading`, `empty`, `error`, `denied`, `partial`, `ready`).
- `QueryErrorAlert`: Khung cảnh báo lỗi truy vấn kèm mã lỗi, nguyên nhân và nút thử lại (`E7`).
- `EmptyState`: Khung thông báo không có dữ liệu kèm nút hành động khởi tạo đầu tiên (`E2`).
- `ServiceRunBlockerPanel`: Bảng hiển thị danh sách các điểm tắc khiến quy trình không thể tiếp tục (`UXR-02`).
- `ConfirmDialog`: Hộp thoại xác nhận an toàn trước các thao tác phá hủy hoặc chốt sổ bất biến (`UXR-05`).
- `InlineAlert` & `InfoNote`: Khối thông tin ghi chú ngữ cảnh nhỏ bên trong form/bảng.
- `ToastProvider`: Bộ cung cấp thông báo nổi không cản trở thao tác (`M3.15`).
- `RefreshStatus` & `DiagnosticPanel`: Chỉ báo làm mới dữ liệu và bảng chẩn đoán lỗi hệ thống.

### Family D (`C-GUARD` — Formatting, Form Row & RBAC Guards)
- `Num`: Định dạng số lượng, tiền tệ, tỷ lệ % bắt buộc dùng font `tabular-nums` và căn phải (`T1`, `T3`).
- `IdentifierText`: Hiển thị mã chứng từ, mã vật tư kèm nút bấm sao chép nhanh (`L1`, `L7`).
- `StatusBadge` & `NotificationBadge`: Huy hiệu trạng thái nghiệp vụ chuẩn hóa màu sắc theo `DOM-STATUS-1` (`S1.1`).
- `FieldRow` & `FieldError`: Dòng bố cục ô nhập liệu kèm hiển thị nhãn và thông báo lỗi hợp lệ (`I1`, `I9`).
- `SearchField`: Ô nhập tìm kiếm tích hợp debounce 250–300ms và nút xóa nhanh (`F5`).
- `ActionGuard` & `ActionAvailability`: Kiểm soát hiển thị hoặc làm mờ nút bấm dựa trên quyền hạn token (`NFR-UI-02`).

---

## 3.5. Kế hoạch di dời Domain Components ra khỏi `common/`

Thành phần trong `components/common/` TUYỆT ĐỐI KHÔNG chứa logic nghiệp vụ đặc thù của từng phân hệ. 5 component sau đây được đánh dấu di dời về đúng thư mục feature ở pha tái cấu trúc tiếp theo:

1. `StockMovementTable.tsx` → di dời về `frontend/src/features/warehouse/components/`
2. `DemandSummary.tsx` → di dời về `frontend/src/features/planning/components/`
3. `ApprovalQueue.tsx` → di dời về `frontend/src/features/approvals/components/`
4. `RoleInbox.tsx` → di dời về `frontend/src/features/dashboard/components/`
5. `ExceptionLane.tsx` → di dời về `frontend/src/features/reconciliation/components/`

---

## 4. Bốn Khuôn Mẫu Trang Chuẩn (Canonical Page Blueprints)

### Blueprint 1: Trang danh sách / Bảng vận hành chuẩn
```tsx
<OperationalFrame title="Quản lý nhập kho" subtitle="Theo dõi và duyệt phiếu nhập vật tư">
  <CommandBar search={<SearchField value={search} onChange={setSearch} />} actions={<Button variant="primary">Tạo phiếu</Button>} />
  <QueryViewBoundary state={queryState} error={error} onRetry={refetch}>
    <TableViewport maxHeight="calc(100vh - 280px)">
      <Table>
        <TableHeader><TableRow><TableHead>Mã phiếu</TableHead><TableHead className="text-right">Tổng tiền</TableHead></TableRow></TableHeader>
        <TableBody>{data.map(row => (<TableRow key={row.id}><TableCell><IdentifierText value={row.code} /></TableCell><TableCell className="text-right"><Num value={row.total} /></TableCell></TableRow>))}</TableBody>
      </Table>
    </TableViewport>
    <PaginationBar page={page} totalPages={totalPages} onPageChange={setPage} />
  </QueryViewBoundary>
</OperationalFrame>
```

### Blueprint 2: Trang Split Workbench (Master - Detail)
```tsx
<OperationalFrame title="Định mức BOM & Giá vốn">
  <SplitWorkbench
    leftPane={<TableViewport><Table><TableBody>{dishes.map(d => (<TableRow key={d.id} selected={d.id === activeId} onClick={() => setActiveId(d.id)}><TableCell>{d.name}</TableCell></TableRow>))}</TableBody></Table></TableViewport>}
    rightPane={<SectionPanel title="Chi tiết nguyên liệu"><Table><TableHeader><TableRow><TableHead>Tên nguyên liệu</TableHead><TableHead className="text-right">Định lượng</TableHead></TableRow></TableHeader><TableBody>{ingredients.map(i => (<TableRow key={i.id}><TableCell>{i.name}</TableCell><TableCell className="text-right"><Num value={i.qty} unit={i.unit} /></TableCell></TableRow>))}</TableBody></Table></SectionPanel>}
  />
</OperationalFrame>
```

### Blueprint 3: Luồng đối soát ca MRX (`MATERIAL_RECONCILIATION`)
```tsx
<OperationalFrame title="Đối chiếu nguyên liệu ca" isReconciliationMode>
  <ContextStrip badge={<StatusBadge status={batchStatus} />} metrics={[{ label: 'Lệch thừa', value: surplusCount }, { label: 'Lệch thiếu', value: shortageCount }]} />
  <SectionPanel title="Danh sách sai lệch cần giải trình">
    <TableViewport><Table><TableHeader><TableRow><TableHead>Nguyên liệu</TableHead><TableHead className="text-right">Sổ sách</TableHead><TableHead className="text-right">Thực tế</TableHead><TableHead className="text-right">Lệch</TableHead></TableRow></TableHeader>
      <TableBody>{items.map(it => (<TableRow key={it.id}><TableCell>{it.name}</TableCell><TableCell className="text-right"><Num value={it.expected} /></TableCell><TableCell className="text-right"><Num value={it.actual} /></TableCell><TableCell className="text-right"><Num value={it.diff} highlightDiff /></TableCell></TableRow>))}</TableBody>
    </Table></TableViewport>
  </SectionPanel>
</OperationalFrame>
```

### Blueprint 4: Hộp thoại Form có bảo vệ dữ liệu chưa lưu
```tsx
<Dialog open={isOpen} onOpenChange={handleCloseWithDirtyCheck}>
  <DialogContent size="md">
    <DialogHeader title="Cập nhật số suất ăn" />
    <DialogBody>
      <FieldRow label="Số suất chốt" error={errors.servings} required><Input type="number" value={servings} onChange={e => setServings(e.target.value)} /></FieldRow>
    </DialogBody>
    <DialogFooter actions={<><Button variant="outline" onClick={handleCancel}>Hủy</Button><Button variant="primary" onClick={handleSave}>Lưu thay đổi</Button></>} />
  </DialogContent>
  <ConfirmDialog open={showDirtyConfirm} title="Hủy thay đổi?" description="Dữ liệu chưa lưu sẽ bị mất." onConfirm={forceClose} onCancel={() => setShowDirtyConfirm(false)} />
</Dialog>
```
