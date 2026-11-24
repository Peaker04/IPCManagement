# Kế hoạch đưa IPCManagement sang Figma

**Mục tiêu.** Dựng Design System IPC và các màn hình MRX có thể chỉnh sửa, tái sử dụng và kiểm thử trong Figma qua Reqwise. Sau khi duyệt MRX, dùng cùng bộ component để thiết kế DEFAULT. Mỗi thiết kế màn hình phải mô tả được vai trò, phạm vi dữ liệu, phản hồi bất đồng bộ và hành vi theo chiều rộng.

**Phạm vi hiện tại.** Tài liệu này là kế hoạch đề xuất từ khảo sát source và kết nối Reqwise. Phần triển khai Figma và phần sửa giao diện web có nghiệm thu riêng. Quy trình nghiệp vụ theo [DOMAIN](../../DOMAIN.md) và [hợp đồng MRX](../../domain/material-reconciliation.md). Quy tắc trình bày theo [DESIGN](../../DESIGN.md), [UI Kit](../../UI-KIT.md), [table contracts](../../table-contracts.json) và [CSS hiện hành](../../../frontend/src/styles/index.css).

## Hiện trạng và phương án

- File `IPC`, `Page 1` đã kết nối. Lúc đọc, file có một page trống và chưa có collection variables. Reqwise chạy `op: "plan"` ở chế độ chỉ đọc để kiểm tra khả năng học Design System. Bộ đọc không nhận diện trường cấu hình nào trong `docs/DESIGN.md`. Với màu hiện hành `--primary-navy: #0f172a` đưa vào brief, bản lập thử đề xuất màu nút `#536180`, sinh 189 variables và 20 text styles. Con số ước tính 10 giây chỉ dành cho lần tạo foundations theo bản lập thử, với 0 component và 0 variant. Motion nằm ngoài nhóm đề xuất mặc định. Bản lập thử còn câu hỏi về theme, kiểu giao diện, nền tảng và nhóm variables. Nếu chọn lại hướng generator, trả lời các câu hỏi và xem lại findings trước khi sinh kit.
- Repo đã có hướng thiết kế Quiet Operational, màu ngữ nghĩa, Inter và kiến trúc workbench ba vùng. Chủ sở hữu render hiện tại gồm `AppShell`, `WorkspaceHeader`, `TelemetrySubbar`, `DataGrid`, `SplitView`, `StateBoundary` và `WorkbenchSkeleton`. `useWorkbenchQuery` và `serverStateCache` là các owner cần kiểm tra khi truy vết nháy do đọc bất đồng bộ. `RouteWorkbenchLoadingFallback` xử lý lớp chờ riêng khi tải module route. [Kiến trúc hiện hành](../../ARCHITECTURE.md)
- Có sai lệch cần chốt trong bảng đối chiếu. `T8` quy định dòng thường 36–40px và dòng nhập 44px, còn `[data-density="compact"]` trong CSS đang khai báo token dòng 34px. Dựng target theo `T8`, sau đó đo nơi token có tác dụng và ghi sai lệch vào danh sách bàn giao. `frontend/PRODUCT.md` ghi desktop/tablet, chưa có phạm vi vận hành trên điện thoại. [T8](../../DESIGN.md), [thiết bị mục tiêu](../../../frontend/PRODUCT.md)
- Role được xác nhận ở cả route, leaf, action và API trước khi vẽ CTA. Ví dụ hợp đồng MRX giới hạn Quản lý ở trạm đối soát, còn `WAREHOUSE_ROLES` trong registry có `Manager` và `Quản lý`. Kiểm tra guard thực tế trước khi đánh dấu điểm này là lỗi runtime. Target của prototype bám quyền nghiệp vụ được xác nhận. [Hợp đồng MRX](../../domain/material-reconciliation.md), [route registry](../../../frontend/src/routes/routeRegistry.ts), [lọc điều hướng](../../../frontend/src/routes/navigationEligibility.ts)

| Phương án | Đầu ra và chi phí |
| --- | --- |
| Đưa ảnh chụp các màn đang chạy vào Figma | Nhanh để lưu hiện trạng. Việc thay đổi bố cục, kiểm tra trạng thái và bảo trì kit vẫn cần tạo các component có thể chỉnh sửa. |
| Sinh kit theo preset Reqwise rồi thích nghi | Có variables và styles nhanh. Cần kiểm lại các giá trị suy ra, bao gồm palette, mật độ, typography và timing. |
| **Đề xuất: ánh xạ CSS và UI Kit hiện hành sang component Figma, rồi dựng MRX** | Tốn công lập bảng ánh xạ ban đầu. Mỗi token và component có owner rõ ràng, sát giao diện đang chạy và dùng tiếp được cho DEFAULT. Ảnh chụp đã ẩn dữ liệu nhạy cảm dùng để đối chiếu khi có bằng chứng phù hợp. |

## Nghiên cứu thiết kế web chuyên nghiệp và áp dụng cho IPC

| Việc cần làm | Áp dụng vào IPC |
| --- | --- |
| Khảo sát người dùng, nhiệm vụ và luồng | Duyệt tác vụ với Điều phối, Thủ kho, Bếp trưởng và Quản lý. Ghi điểm vào, dữ liệu cần để ra quyết định, hành động chính, đường quay lại và điểm bàn giao. Phân biệt hành trình thao tác với lifecycle lô. Đánh giá phản hồi khi chờ theo mức gián đoạn của công việc. [Jakob Nielsen, NN/g](https://www.nngroup.com/articles/response-times-3-important-limits/) |
| Phân rã component và thử bằng màn hình thật | Đi từ primitive đến component ghép, layout và màn hình. Thử bằng tiếng Việt có dấu, tên dài, giá trị định lượng, bảng nhiều cột và các trạng thái khác nhau. Dùng instance có properties và variant đủ cho các tổ hợp xuất hiện trong IPC. [Brad Frost, Atomic Design](https://atomicdesign.bradfrost.com/chapter-2/), [Figma Components](https://help.figma.com/hc/en-us/articles/39636737843735-Components-collection-Variants-and-component-set-fundamentals) |
| Thiết kế bố cục co giãn và bảng dày dữ liệu | Dùng Auto Layout lồng nhau, Fill/Hug, min/max và wrap. Chốt hành vi của từng vùng khi thu hẹp, thứ tự cột, lọc, phân trang, vùng cuộn và thao tác hàng. Hai mode dùng chung ngữ pháp trình bày. [Figma Auto Layout](https://help.figma.com/hc/en-us/articles/360040451373-Guide-to-auto-layout-in-Figma), [IBM Carbon Data table](https://www.carbondesignsystem.com/building-blocks/core/components/data-table/guidelines) |
| Thiết kế motion, trạng thái và khả năng tiếp cận | Motion ngắn cho thao tác có chủ đích. Phản hồi tải, hoàn tất và lỗi cần nhận biết được bằng chữ và công nghệ hỗ trợ. Mô tả focus, bàn phím, reflow và reduced motion trong bàn giao. [IBM Carbon Motion](https://www.carbondesignsystem.com/building-blocks/foundations/motion/overview), [W3C Status Messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html), [W3C Reflow](https://www.w3.org/WAI/WCAG22/Understanding/reflow.html), [WAI-ARIA Dialog](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/) |
| Prototype, thử theo nhiệm vụ và bàn giao | Dùng prototype để kiểm tra người dùng đọc scope, nhận ra nhiệm vụ đang chờ, hiểu quyền và thoát được khỏi lỗi. Bàn giao kèm mapping Figma → component/token React, quy tắc trạng thái và kích thước. Đo giật bố cục bằng trace, kèm kiểm tra nháy từng frame vì nội dung có thể chớp dù tọa độ giữ nguyên. [Figma Component Properties](https://developers.figma.com/docs/plugins/working-with-component-properties/), [Addy Osmani và Barry Pollard, web.dev](https://web.dev/articles/optimize-cls) |

## 1. Chốt baseline và phạm vi thiết kế

- [ ] Lập ma trận `FR → route/leaf → mode → vai trò/quyền → đối tượng làm việc → hành động → trạng thái → owner trong source`. Nguồn route là `routeRegistry.ts` và `navigationEligibility.ts`. Nguồn quyền ghi là guard và hợp đồng tương ứng. `DEFAULT` và `MATERIAL_RECONCILIATION` chỉ chia sẻ nền tảng trình bày và các bề mặt `SHARED` theo registry. Phân luồng, dữ liệu, chứng từ, hành động và audit tuân thủ `DOM-MODE-1`.
- [ ] Ghi baseline render bằng Chrome riêng, trên URL/build đã xác nhận và với role/mode phù hợp. Với mỗi vấn đề, lưu kích thước viewport lẫn vùng làm việc, thao tác, trạng thái trước/sau, video hoặc filmstrip và trace nếu cần. Chụp các đường cold, warm, phân trang, đổi scope và sau ghi ở màn pilot. Dùng bản đã ẩn dữ liệu nhạy cảm khi đưa bằng chứng lên canvas. Nếu thiếu phiên đủ quyền hoặc dữ liệu phù hợp, ghi `NEEDS_EVIDENCE` cho dòng tương ứng.
- [ ] Đọc lại luồng theo từng vai trò. Điều phối chuẩn bị nguồn, preview/commit, READY và bàn giao. Thủ kho xử lý xuất theo ngày. Bếp trưởng xem/tải phiếu nấu theo phạm vi cho phép. Quản lý xử lý chênh lệch và chốt đối soát. Nhánh phiếu nấu theo quyền và điều kiện nguồn của chính nó. Chốt cả lối ra khi hủy, lỗi, hết quyền, dữ liệu cũ và xung đột. Duyệt wireflow sau khi hoàn tất nền tảng dùng chung và trước khi mở rộng các màn hình nghiệp vụ.

## 2. Dựng IPC Design System trong Figma

- [ ] Đặt trang `Design System` đầu file `IPC` với foundations, primitives, workbench components và hợp đồng tích hợp. Trang `MRX · Pilot` tham chiếu các main component trên trang đó. Mở trang DEFAULT sau khi duyệt bộ dùng chung và MRX. Giả định đề xuất là web desktop/tablet, light, giữ Quiet Operational hiện tại.
- [ ] Lập mapping theo ba tầng `primitive → semantic → component`. Ghi tên CSS, tên biến Figma, giá trị/alias, mục đích, nơi dùng và tình trạng đối chiếu. Ánh xạ canvas/surface/text/border/focus/primary, các tone success/warning/danger/info, readonly/disabled, spacing, radius, elevation, typography, kích thước điều khiển, mật độ và motion. Giữ navy cho primary và xanh dương cho thông tin/focus theo vai trò token hiện có. Dùng các Figma styles cho typography/elevation. Mô tả duration/easing bằng variables và bảng đặc tả, kiểm tra các transition trên prototype. `DEFAULT` và `MRX` xuất hiện ở cấp luồng/màn hình. Variable modes chỉ phục vụ thuộc tính trình bày có phạm vi đã duyệt.
- [ ] Dùng Reqwise `setupTokens` và binding theo tên, rồi tạo component sets theo variant/property của owner React. Ưu tiên Button, Input/Select/date, Status/Badge, Dialog, banner/trạng thái, pagination, sau đó AppShell/sidebar, WorkspaceHeader, TelemetrySubbar, DataGrid, SplitView và WorkbenchSkeleton. Tách hover, focus, selected, disabled, read-only, pending và validation theo những tổ hợp có nghĩa. Dùng instance cho hàng, ô và controls lặp lại. Mỗi component có một ví dụ sử dụng cùng link về owner React.
- [ ] Đối chiếu trên canvas các biến, alias, typography tiếng Việt, styles và instance. Kiểm toàn bộ thuộc tính cần bind trong kit đã dựng qua `get_variables`, `get_components` và audit. Ghi token/variant còn lệch, ảnh hưởng và quyết định trước khi nhân rộng. Giá trị `1.00` trong hướng dẫn Reqwise là tiêu chí của subtree do generator tạo. Kit nhập theo mapping cần kiểm cả độ khớp source, giá trị và ý nghĩa sử dụng.

### Ánh xạ thành phần và helper dùng chung

| Thành phần Figma | Owner React và hợp đồng |
| --- | --- |
| `AppShell / Sidebar specimen` và `AppShell / Navigation group` | [AppShell](../../../frontend/src/components/workbench/AppShell.tsx) và [navigationEligibility](../../../frontend/src/routes/navigationEligibility.ts) cung cấp khung ổn định và leaf theo role/mode. Giữ sidebar mở 240px, thu gọn 64px theo source. |
| `WorkspaceFrame / Table specimen`, `WorkspaceHeader`, `TelemetrySubbar` | [WorkspaceFrame](../../../frontend/src/components/workbench/WorkspaceFrame.tsx) sở hữu Root, Header và Body. [WorkspaceHeader](../../../frontend/src/components/workbench/WorkspaceHeader.tsx) nhận title, contextSelectors và actions. [TelemetrySubbar](../../../frontend/src/components/workbench/TelemetrySubbar.tsx) nhận điều khiển và trạng thái theo caller. |
| `DataGrid / Five-column row`, `PaginationBar`, `SplitView` | [DataGrid](../../../frontend/src/components/workbench/DataGrid.tsx) nhận `ColumnDef<T>` và lưu định danh hàng. Mẫu Figma năm cột phục vụ pilot. [PaginationBar](../../../frontend/src/components/workbench/PaginationBar.tsx) giữ phản hồi tại control khi pending. [SplitView](../../../frontend/src/components/workbench/SplitView.tsx) thu về danh sách hoặc chi tiết dưới `lg`. Dùng [Num](../../../frontend/src/components/ui/num.tsx) và [IdentifierText](../../../frontend/src/components/ui/identifier-text.tsx) cho giá trị và định danh. |
| `StateBoundary / Message` và mẫu `WorkbenchSkeleton` | [StateBoundary](../../../frontend/src/components/workbench/StateBoundary.tsx) nhận trạng thái được phân giải. [WorkbenchSkeleton](../../../frontend/src/components/workbench/WorkbenchSkeleton.tsx) giữ hình học theo từng loại; [useDeferredSkeleton](../../../frontend/src/hooks/useDeferredSkeleton.ts) sở hữu mốc chờ 150ms. [useWorkbenchQuery](../../../frontend/src/hooks/useWorkbenchQuery.ts) và [serverStateCache](../../../frontend/src/store/serverStateCache.ts) sở hữu cache và chuyển phạm vi. |
| `Modal / Confirmation` và controls | [Modal](../../../frontend/src/components/ui/modal.tsx) sở hữu mở/đóng, focus và cuộn. [button-state](../../../frontend/src/components/ui/button-state.ts) xác định trạng thái control. [VietnameseDateInput](../../../frontend/src/components/ui/vietnamese-date-input.tsx) quản lý cách nhập ngày. |
| Hợp đồng tích hợp trên trang Design System | [useUrlWorkbenchState](../../../frontend/src/hooks/useUrlWorkbenchState.ts) sở hữu phạm vi URL; [DirtyNavigationProvider](../../../frontend/src/components/workbench/DirtyNavigation.tsx) bảo vệ bản nháp; [RoleGuard](../../../frontend/src/routes/RoleGuard.tsx) và [ActionGuard](../../../frontend/src/components/ui/action-guard.tsx) áp điều kiện theo bề mặt. Figma trình bày các trạng thái kết quả để bàn giao; React và backend thi hành điều kiện. |

Trong pilot, đặt các vùng dùng chung dưới dạng instance. Expose các props cần chỉnh như title, scope, action, badge và giá trị cột. DataGrid năm cột là mẫu cụ thể; workspace theo route vẫn sở hữu kiểu cột, dữ liệu và lệnh nghiệp vụ. Mẫu motion giữ trigger gốc đã nối prototype trong hai frame mở hộp thoại. Các frame nghiệp vụ thường cùng tham chiếu `WorkspaceHeader` từ trang Design System.

## 3. Pilot hai màn hình MRX rồi mở rộng

| Thứ tự | Screen / đối tượng làm việc | Bố cục từ trên xuống và trạng thái cần ưu tiên |
| --- | --- | --- |
| Pilot · `FR-MENU` | `/weekly-menu?view=mrx-batch` · chuẩn bị nguồn và lô | Tiêu đề, scope khách/tuần/mức giá, hành động theo quyền, trạng thái lô, vùng dữ liệu hoặc preview. Ưu tiên cold load, đổi scope nhanh, thiếu BOM, preview lỗi, commit pending/409, READY và bàn giao. |
| Pilot · `FR-WH` | `/warehouse?view=mrx-daily` · định lượng và phiếu xuất ngày | Tiêu đề, scope lô/ngày, lifecycle/hành động, bảng định lượng, modal chi tiết hoặc ghi. Ưu tiên ngày chưa có phiếu, ngày đã có phiếu, xuất bổ sung theo điều kiện, projection đang cập nhật và mất quyền. |
| Mở rộng · `FR-MENU` | `mrx-materials`, `mrx-plans` · tra cứu định lượng và kế hoạch ca | Header/scope, thông tin phạm vi, bảng tương ứng. Có dữ liệu, không có dữ liệu, lỗi và read-only. |
| Mở rộng · `FR-WH` | `mrx-preparation`, `mrx-issues` · chuẩn bị Excel và lịch sử thay đổi nguồn | Header/scope, bảng theo view, lựa chọn xuất hoặc mở chi tiết. Thử scope ngày/tuần, nhiều khách, lịch sử không có lineage và lỗi xuất. |
| Mở rộng · `FR-CHEF` | `/chef?view=mrx-cooking` · phiếu nấu theo lô và ca | Header/scope, readiness, danh sách phiếu và hành động xem/tải được phép. Thử thiếu phạm vi, lỗi tải và từ chối quyền. |
| Mở rộng · `FR-RECON` | `/reconciliation` và `variances`, `transactions`, `audit`, `completed` | Header/scope, bảng hoặc chi tiết đúng vai trò, bằng chứng sai lệch/hoàn tất. Thử sai lệch cần xử lý, xung đột, hoàn tất read-only và lọc lịch sử. |
| Đối chiếu · `FR-DASH`, `FR-CAT`, `FR-SYS`, `FR-AUTH` | `/`, `/admin-data?view=bom`, `/settings/advanced?view=mode`, `/forbidden` | Ghi nhận các điểm vào và bề mặt dùng chung có liên quan đến MRX. BOM là điểm phục hồi thiếu định mức. Chuyển mode là quyền Admin theo hệ thống. Duyệt phạm vi vẽ chi tiết theo ma trận role/route. |

- [ ] Dựng wireframe của pilot để chốt thứ tự thông tin, work object chính, hành động của vai trò và cách bọc khi hẹp. Cấu trúc chung là sidebar → tiêu đề/scope/lệnh → phản hồi trạng thái → bảng hoặc master/detail. Dùng một primary trong ngữ cảnh và một lớp modal chặn. Mỗi frame ghi route/leaf và vai trò trong phần bàn giao cạnh màn hình.
- [ ] Dựng artboard bằng instance của kit. Bám `arrangeScreens` của file `IPC` cho group 1440/1536/1920 và state chính tại 1440. Bổ sung frame kiểm tra 1366×768 và tablet theo ma trận responsive. Với các màn mở rộng, tham chiếu variant hoặc màn trạng thái dùng chung khi cách xử lý giống nhau. Tạo frame riêng cho trường hợp thay đổi hành động, nội dung hoặc hình học.
- [ ] Thử prototype theo nhiệm vụ trước khi mở rộng. Điều phối tìm cách phục hồi thiếu BOM rồi bàn giao. Thủ kho chọn đúng ngày, nhận ra dữ liệu đang cập nhật và thấy cách xử lý khi xung đột. Bếp trưởng và Quản lý xác nhận bề mặt mở rộng của vai trò mình. Ghi nhầm thao tác, điểm không tìm thấy và phản hồi bị bỏ lỡ, rồi sửa lại ở component/layout sở hữu hành vi.

## 4. Hợp đồng trạng thái và motion

Các màn hình có ma trận `trigger → dữ liệu/phạm vi được phép hiển thị → UI và focus → hành động hợp lệ → trạng thái kết thúc`. Mỗi màn đối chiếu đủ sáu trạng thái bắt buộc và `ready`. Bề mặt chỉ đọc ghi rõ các trạng thái ghi không áp dụng và lý do. Lifecycle `DRAFT → READY → TRANSFERRED → IN_PROGRESS → COMPLETED`, trạng thái đọc của ngày và kết quả kiểm tra quyền có điều kiện riêng. Sau READY, hợp đồng còn phân biệt ngày đã có phiếu và ngày vẫn sửa được.

| Trường hợp | UI và hành vi bàn giao |
| --- | --- |
| Loading lần đầu và lazy route | Giữ hình học title, toolbar, bảng và scroll ngay từ frame đầu. Theo `DESIGN §8`, nét skeleton chỉ xuất hiện khi vẫn tải sau 150ms. Dữ liệu sẵn sàng thì lên ngay, không pulse/shimmer. |
| Phân trang, đổi scope, cache hit và refetch | Giữ hình học, focus bộ lọc và bản nháp hợp lệ. Cùng mode/quyền có thể giữ nội dung cũ theo policy, với scope của nội dung hiển thị rõ và khóa thao tác dùng dữ liệu cũ. Chỉ chuyển sang dữ liệu trả về đúng scope. Ra khỏi mode hoặc mất quyền thì bỏ nội dung không còn quyền xem. |
| Empty, error, permission-denied, partial | Empty chỉ sau khi phạm vi đã phân giải và thực sự rỗng. Lỗi có hướng khôi phục. Từ chối quyền hiển thị bề mặt phù hợp và ẩn thao tác vượt quyền. Partial nêu phần còn thiếu, phần còn dùng được và hành động bị chặn. Legacy không có lineage dùng thông tin trung tính và đường tới lịch sử. |
| Ready, pending ghi, thành công và write-reconciliation | Ready hiển thị đúng scope. Khi ghi, giữ form và kích thước nút, đổi nhãn và trạng thái pending tại chỗ. Thành công cập nhật sau kết quả xác nhận. `409` giữ bản nháp và giải thích xung đột trong vùng hoặc modal đang thao tác. Chặn gửi lặp trong lúc chờ. |

| Motion | Trigger và phương án reduced motion |
| --- | --- |
| Press/focus và lựa chọn | Phản hồi tại control, giữ kích thước. Dùng `120ms ease-out` của `.ui-control-motion` làm mẫu đối chiếu. Giữ focus ring và dấu hiệu đã chọn khi giảm chuyển động. |
| Dropdown/modal xác nhận | Dùng recipe Reqwise phù hợp (`dropdown`, `modal`). Lấy `120ms ease-out` của `.ui-popup-enter` làm mốc prototype, với trần 150ms theo `NFR-UI-05`. Reduced motion hiện/ẩn tức thời và giữ quy tắc focus. |
| Pending/hoàn tất | `button-progress` hoặc trạng thái tĩnh tương ứng để diễn đạt đổi nhãn. Reduced motion dùng tín hiệu tĩnh và nhãn trạng thái đọc được. |
| Phân trang, đổi scope và refetch | Thay dữ liệu đúng scope trong cùng khung. Tránh crossfade cả workbench, đổi chiều cao header, pulse hoặc chuyển động dòng theo phản hồi mạng. |

- [ ] Dùng `motionRecipes` và `addMotion`, xem warnings, chạy `prototype_audit` và kiểm lại thời lượng trong Present. Giá trị 150ms tối đa cho transition và mốc chờ 150ms trước khi vẽ skeleton là hai quy tắc độc lập. Ghi trigger, kết quả, duration, easing và biến thể reduced motion cạnh prototype. Nếu recipe không biểu diễn đúng luồng bất đồng bộ, bàn giao bằng chuỗi frame trước/chờ/sau và xác minh trên web.

## 5. Responsive cho desktop và tablet

| Mốc đề xuất | Cần kiểm |
| --- | --- |
| 1920×1080, 1536×864, 1440×900 | Giữ bảng dễ quét, secondary action nằm đúng cụm, không kéo giãn vô ích. Nhóm artboard chuẩn của Reqwise dùng 1440/1536/1920 × 1024, còn Chrome chạy theo kích thước thật nêu ở đây. |
| **1366×768**, 1280×800 | Ưu tiên pilot. Kiểm title, scope, badge, primary và modal. Khi thiếu chỗ, dời nhóm scope xuống hàng riêng, giữ nhóm ngày/tháng/năm nguyên cụm, đưa hành động phụ vào menu đủ nhãn. Bảng cuộn ngang trong vùng riêng, sticky header và cột định danh. |
| 1024×768, 834×1194 | Kiểm tablet ngang/dọc, sidebar thu gọn theo bố cục, thao tác chạm và focus. Nếu split pane không đủ rộng, thử chuyển chi tiết sang vùng riêng hoặc panel theo work object và duyệt đường quay lại. |
| Zoom 200% và reflow 320 CSS px | Kiểm chữ/nút và hộp thoại khi zoom. Kiểm reflow 320 CSS px cho vùng thông thường theo WCAG 2.2 AA. Bảng cần bố cục hai chiều có thể cuộn trong phạm vi của bảng. Đây là kiểm khả năng tiếp cận, phạm vi thiết bị sản phẩm vẫn là desktop/tablet. |

- [ ] Đo theo **chiều rộng container workbench**, có và không có sidebar, ở hai phía các ngưỡng CSS đang dùng. MRX header hiện có container queries quanh 850, 900, 1200 và 1500px cùng fallback 520px cho source history. Các số này là điểm thử lấy từ source. Quyết định bố cục dựa vào chỗ chứa thực của control, tên tiếng Việt dài, số có đơn vị và cột bắt buộc. [CSS](../../../frontend/src/styles/index.css)
- [ ] Chạy `responsive_audit`, `text_growth_audit`, `layout_audit`, `a11y_audit` và `names_audit` trên canvas. Kiểm không tràn viewport, không đè action, không cắt thông tin thiết yếu, focus không bị sticky bars che hết, modal cuộn trong chính nó và giữ D6/T7/T8. Thử bàn phím, zoom, ngữ nghĩa và cuộn trên Chrome trong đợt xác nhận runtime. Tổng hợp màn chỉnh sửa bằng `screenReport` sau các audit.

## 6. Bàn giao, xác nhận web và triển khai DEFAULT

- [ ] Bàn giao link frame/instance, mapping token/prop/React owner, acceptance criteria cho từng nhánh, thông số layout và chuyển trạng thái. Ghi định danh hoặc fingerprint của library đã duyệt vào bản snapshot bàn giao nếu dùng. [Repo presentation contract](../../DESIGN.md) và [CSS](../../../frontend/src/styles/index.css) là owner của production. Đề xuất thay đổi giá trị token được duyệt và cập nhật tại owner tương ứng.
- [ ] Chuẩn bị Phiếu Pre-Code UI cho mỗi nhóm màn sẽ sửa, với route, work object, mode, guards, sáu trạng thái và component dùng lại. Sửa lỗi liên tục ở đúng owner đã truy ra. Giữ các bài kiểm hiện có cho cold/warm cache và header, sau đó thêm ca tái hiện có bằng chứng nếu thiếu. Bộ tham chiếu gồm [browser loading continuity](../../../frontend/tests/browser/loading-continuity-components.spec.ts), [ZeroJitterHeaderGeometry](../../../frontend/src/__tests__/ZeroJitterHeaderGeometry.test.tsx) và [Render1CacheHitVerification](../../../frontend/src/__tests__/Render1CacheHitVerification.test.tsx). Nếu có thay đổi code, chạy build, lint, contract/unit tests phù hợp và xác nhận Chrome theo [ENGINEERING](../../ENGINEERING.md).
- [ ] Nghiệm thu Chrome trên cùng build/role/mode/viewport đã ghi, gồm cold start, cache hit, phân trang, đổi A → B → A với thứ tự response đảo, mất quyền hoặc đổi mode và xử lý xung đột ghi. Truy vết loại nháy theo filmstrip, geometry và request để phân biệt tải route chunk, skeleton, remount, cache/refetch, font/CSS và paint-only. Kiểm đúng dữ liệu và hành động ở mỗi scope, không blank frame khi warm, không nháy do skeleton hoặc header, cold CLS ≤ 0.05 và ngưỡng chung ≤ 0.1 theo từng điều kiện đo của dự án. Audit Figma xác nhận đặc tả thiết kế. Trace/DOM/bàn phím xác nhận hành vi web. Bằng chứng thử prototype hoặc fixture không chứng minh giao dịch nghiệp vụ persisted.
- [ ] Sau khi duyệt Kit và MRX, thử reuse trên hai leaf DEFAULT đề xuất là `/weekly-menu` và `/warehouse?view=issues`. Dùng role, lệnh, trạng thái và chứng từ DEFAULT theo registry. Mở rộng tới Điều phối đơn, Duyệt, Thu mua, Bếp, Báo cáo và các leaf DEFAULT còn lại. Ghi `weekly.cost` hiện `BLOCKED` theo registry và xác nhận điều kiện nghiệp vụ trước khi thiết kế như bề mặt khả dụng.

## Tiêu chí nghiệm thu theo đợt

| Đợt | Đủ để duyệt khi |
| --- | --- |
| Design System | Token, kiểu chữ và variant được ánh xạ đến owner cụ thể, navy được đối chiếu, component lặp dùng instance, motion có phiên bản reduced, các sai lệch CSS/spec có quyết định. |
| MRX pilot | Hai màn pilot có route/role/scope rõ; có sáu trạng thái cùng đường quay lại phù hợp; userflow dẫn đến đúng hành động; 1366×768 và tablet qua kiểm layout; audit canvas có kết quả. |
| MRX đầy đủ | Mười hai leaf MRX có mapping, kit và state coverage. Bốn vai trò nghiệp vụ duyệt bề mặt có liên quan. Các entry/shared đã được đối chiếu với registry. |
| Web | Trace và hồi quy xác nhận loại nháy đã được xử lý trong trường hợp tái hiện, scope và RBAC đúng, responsive/keyboard/reduced motion qua kiểm trong trình duyệt. |
| DEFAULT | Hai màn đầu xác nhận reuse kit và cách xử lý trạng thái. Những leaf còn lại được đưa sang theo ma trận riêng của DEFAULT. |
