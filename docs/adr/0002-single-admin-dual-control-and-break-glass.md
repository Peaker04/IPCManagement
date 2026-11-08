# ADR-0002: Admin duy nhất vận hành toàn quyền, Manager hậu kiểm quyết định trọng yếu

- Status: Proposed
- Date: 2026-08-07

## Bối cảnh

IPCManagement là web nội bộ. Khách hàng là thực thể được phục vụ, hiện không có
tài khoản đăng nhập; hệ thống chỉ có thông tin nhận diện/phục vụ của khách hàng.
Tại thời điểm quyết định này chỉ có một tài khoản **Admin**. Admin phải có thể
thao tác toàn bộ quy trình để không làm gián đoạn việc cung cấp suất ăn và là bên
cấp/thu hồi quyền cho các role nghiệp vụ.

Điều phối chịu trách nhiệm kế hoạch; Thu mua chịu trách nhiệm nhà cung cấp và
mua hàng; Kho chịu trách nhiệm movement; Bếp chịu trách nhiệm xác nhận vật lý và
phục vụ thực tế. Manager là lớp kiểm soát nghiệp vụ xuyên luồng. Do chỉ có một
Admin, không thể áp dụng separation of duties kiểu “hai Admin phải duyệt trước”
cho mọi thao tác khẩn cấp.

## Quyết định

### 1. Vai trò và quyền thao tác

- Admin được thao tác mọi bước vận hành, bao gồm thao tác thay các role nghiệp
  vụ, mở khóa/reassign work object và xử lý sự cố.
- Role nghiệp vụ vẫn là **owner mặc định** của chứng từ. Khi Admin thao tác thay,
  audit phải ghi `Actor = Admin`, `ActingRole`, và `OriginalOwnerRole`; không
  được ghi sai là role nghiệp vụ đã tự thực hiện.
- Admin cấp/thu hồi quyền theo phạm vi. Quyền thay thế tạm thời phải có lý do,
  phạm vi và thời điểm hết hạn; không dùng tài khoản dùng chung.
- Quyền thao tác toàn phần của Admin không bao gồm quyền xóa audit, rewrite
  snapshot, hoặc sửa trực tiếp lịch sử movement bằng giao diện vận hành.

### 2. Khách hàng không có account

- Không tạo role hoặc account đại diện khách hàng.
- Mỗi đối tượng phục vụ cần định danh nội bộ ổn định: `CustomerCode`, tên hiển
  thị, `ServiceSite` và tham chiếu hợp đồng khi có. Tên/địa điểm/hợp đồng được
  snapshot vào menu, ca phục vụ và chứng từ liên quan để giữ lịch sử khi master
  data đổi.
- Tên/chức danh/liên hệ của đầu mối khách hàng chỉ là dữ liệu tham chiếu hoặc
  evidence; chúng không tạo quyền đăng nhập và không được diễn giải thành
  “khách hàng đã phê duyệt” nếu không có chứng cứ ngoài hệ thống.
- Xác nhận cuối ca dùng **Biên bản xác nhận cung cấp suất ăn nội bộ**: Bếp xác
  nhận thực tế; biên bản có thể kèm tên đầu mối, ảnh/chữ ký/tham chiếu bên ngoài
  khi có. Đây không phải cổng khách hàng.

### 3. Duyệt kép và snapshot

Mọi quyết định trọng yếu đi qua Admin và Manager, nhưng cần phân biệt approval
với quyền thao tác:

| Trường hợp | Hiệu lực và review |
| --- | --- |
| Role nghiệp vụ tạo yêu cầu thông thường | `SUBMITTED` chờ Admin và Manager duyệt độc lập; đủ hai duyệt mới có hiệu lực cuối. |
| Admin xử lý yêu cầu hoặc thực hiện thay role | Admin được thực hiện ngay; bản ghi chuyển `ADMIN_EXECUTED_PENDING_MANAGER_REVIEW`. Manager là kiểm soát thứ hai. |
| Ngoại lệ khẩn | Admin thực hiện ngay theo luồng break-glass; Manager hậu kiểm bắt buộc. |

Một approval/review luôn dựa trên snapshot bất biến, gồm: object/version,
source-line ID, số lượng/đơn vị, giá trị tiền khi có, baseline/thực tế, lý do,
người tạo, actor, thời điểm và hash/version của payload. Thay đổi dữ liệu trọng
yếu sau khi gửi làm request cũ `SUPERSEDED`; không được duyệt trên dữ liệu đã đổi.

Người tạo request không được tạo một approval giả cho chính mình. Khi Admin là
người tạo/thực hiện, hành động được ghi là `executed`, không bị trình bày như một
approval độc lập; Manager hậu kiểm là quyết định kiểm soát còn thiếu.

### 4. Menu tuần và kích hoạt phục vụ

- Import menu chỉ tạo/cập nhật phiên bản menu ở trạng thái nháp; Admin có thể
  import, sửa lỗi và hoàn tác phiên bản theo quyền vận hành.
- Snapshot import phải giữ file/hash, lỗi parse/validation, customer/service
  site/contract reference, tuần áp dụng, món, tier, BOM result và actor.
- Khi import do role khác chuẩn bị, Admin xác nhận tính hợp lệ dữ liệu. Khi
  Admin tự import, snapshot import vẫn được tạo và không giả lập approval thứ hai.
- Menu chỉ được `PUBLISHED/ACTIVE` để vận hành sau review Manager về phạm vi
  phục vụ, hợp đồng, số suất/budget và ngoại lệ BOM. Đây là duyệt kép thực tế
  cho bước có tác động nghiệp vụ, không cần customer account.

### 5. Break-glass của Admin

Break-glass là **chế độ xử lý khẩn cấp có audit**, không phải nút bypass vô hình.
Nó được dùng khi chờ luồng thường sẽ chặn bàn giao/vận hành bắt buộc, như sát giờ
phục vụ, workflow bị kẹt, thiếu/thay nguyên liệu khẩn, hoặc cần điều chỉnh chứng
từ đã có ảnh hưởng thực tế.

```text
BREAK_GLASS_EXECUTED
  -> PENDING_MANAGER_REVIEW
  -> RATIFIED | CORRECTION_REQUIRED | RECONCILIATION_REQUIRED
```

Admin có thể bắt đầu và thực hiện break-glass một mình. Mỗi action bắt buộc có:

- loại action, đối tượng và source-line bị ảnh hưởng;
- lý do chuẩn hoá, diễn giải chi tiết và mã incident khi có;
- snapshot trước/sau, actor, thời điểm và thời hạn hiệu lực;
- notification delivery tới Manager và kết quả hậu kiểm;
- evidence hoặc kế hoạch bổ sung evidence khi evidence chưa thể có ngay.

UI, báo cáo và audit phải hiển thị rõ **“Ngoại lệ khẩn — chờ Manager hậu kiểm”**
cho tới khi được xử lý. Không có thao tác xóa, overwrite hay backdate lịch sử.
Nếu thực tế vật lý không thể đảo ngược, Manager không “reject để xóa”; họ chọn
`CORRECTION_REQUIRED` hoặc `RECONCILIATION_REQUIRED` và hệ thống tạo chứng từ
điều chỉnh/đối soát append-only.

### 6. Quá hạn hậu kiểm và chốt kỳ

Nếu Manager chưa hậu kiểm đúng SLA, ngoại lệ chuyển
`OVERDUE_MANAGER_REVIEW`; không tự trở thành hợp lệ cuối cùng.

- Vận hành thực tế vẫn tiếp tục để không gián đoạn phục vụ.
- Kỳ/ca, chi phí, chênh lệch và quyết toán có liên quan không được chốt cuối
  chỉ vì hết hạn; chúng tiếp tục hiển thị trong exception inbox của Manager.
- Chỉ Manager hậu kiểm hoặc chứng từ điều chỉnh/đối soát hoàn tất mới gỡ trạng
  thái quá hạn khỏi đối tượng trọng yếu.

Mặc định an toàn cho SLA là **trước khi chốt kỳ phục vụ hoặc 24 giờ kể từ thao
tác, lấy mốc đến trước**. Giá trị cấu hình chính thức phải được quyết định theo
ca làm việc và lịch phục vụ thực tế.

### 7. Phạm vi review Manager mặc định

Cho đến khi có ngưỡng cấu hình chính thức, mọi ngoại lệ ngoài quy trình chuẩn
phải vào Manager review. Đặc biệt gồm:

- kích hoạt menu/phiên bản tuần và thay thế món hoặc BOM;
- thay đổi nhà cung cấp, giá, đơn mua hoặc mua khẩn;
- chênh lệch tồn, nhập/xuất/nhận/trả/hao hụt cần điều chỉnh;
- chênh lệch suất, miễn xác nhận giao suất và đóng Ca phục vụ có ngoại lệ;
- mở khóa, đổi owner hoặc khôi phục approval route có ảnh hưởng chứng từ.

Ngưỡng tiền, phần trăm biến động giá, chênh lệch suất và giá trị hao hụt sau này
chỉ được dùng để nới bớt review đối với trường hợp tiêu chuẩn; không được làm mất
audit snapshot hoặc khả năng Manager xem hậu kiểm.

## Hệ quả

- Admin vẫn vận hành được khi chỉ có một tài khoản, nhưng hệ thống thừa nhận rõ
  giới hạn separation of duties thay vì tạo approval hình thức.
- Manager có một inbox hậu kiểm rõ ràng, có SLA và không thể bỏ sót ngoại lệ
  bằng cách để nó tự chốt.
- Customer không có account vẫn được truy vết đầy đủ theo customer/site/contract
  snapshot và biên bản nội bộ.
- Các implementation sau ADR này phải đồng bộ backend state/action/audit,
  migration, API contract, badge FE, inbox/reports và E2E FE -> API -> DB -> FE.

## Cần quyết trước khi chuyển sang triển khai

1. Ngưỡng giá trị/phần trăm nào được xem là ngoại lệ trọng yếu.
2. SLA chính thức theo từng ca và người/escalation thay Manager khi vắng mặt.
3. Evidence bắt buộc cho Biên bản xác nhận cung cấp suất ăn: mọi ca hay chỉ
   chênh lệch, waiver và sự cố.
4. Phạm vi thao tác Admin được phép thực hiện sau khi Service Run đã đóng, ngoài
   correction append-only đang có.
