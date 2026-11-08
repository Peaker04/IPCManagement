# Bài học không được quên

File này ngắn, không gắn ngày và không xóa bài học cũ. Khi một bài học cần mở rộng, trỏ sang runbook thay vì chép log sự cố vào đây.

## Ba bẫy migration

- Migration viết tay phải có `.Designer.cs` hoặc `[Migration]` inline; thiếu cả hai thì EF không phát hiện file.
- Không chạy `dotnet ef migrations remove` khi migration cuối thiếu designer; snapshot có thể bị lùi về gần rỗng và migration kế tiếp sẽ cố tạo lại schema.
- Trước khi đánh dấu migration là đã có trong baseline, phải đối chiếu từng thay đổi schema; khai thừa ID làm EF bỏ qua thay đổi thật.

## Hai lỗi đo browser

- Không trộn cold compile, warm navigation và application work vào cùng một số. Phải tách cold/warm, ghi shift-source/long-task source và chỉ so cùng điều kiện.
- Không coi artifact `*-error.*`, request bị navigation hủy hay tab Chrome không attach là kết quả run hiện tại. Kiểm tra timestamp, URL headed thật, context Chrome được điều khiển và file authoritative trong evidence index.

## Database và restore

- Mốc base PITR là thời điểm nội dung của dump, không phải giờ tạo file hay `CREATE DATABASE`. Khoảng lặng binlog không chứng minh nội dung thuộc mốc đó; phải có oracle bảng/dòng không bị sự cố chạm tới.
- `USE` bên trong file `.sql` ghi đè database đích trên CLI. Mọi SQL mutation phải được soi destructive statement, có precondition fail-closed và backup/rollback đã kiểm tra.
- Temporary table dùng collation mặc định có thể không join được với schema hiện hành. Data migration phải khai charset/collation tường minh và rerun idempotent.
- Sau direct restore, `DishCatalogService` có thể giữ cache trong ba mươi phút. Phải restart/clear application cache, invalidate client cache và buộc refetch trước khi đối chiếu catalog/BOM.
