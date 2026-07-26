using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace IPCManagement.Api.Migrations
{
    /// <summary>
    /// Migration KHÔNG đổi schema — chỉ để đồng bộ lại model snapshot.
    ///
    /// Bảng `unitnormalizationreviews` đã được tạo bởi migration
    /// 20260723081500_AddUnitNormalizationReviews. Migration đó viết tay bằng
    /// migrationBuilder.Sql(...) và KHÔNG có file .Designer.cs đi kèm, nên
    /// IpcManagementContextModelSnapshot.cs chưa bao giờ được cập nhật theo nó.
    /// Hậu quả: `dotnet ef migrations has-pending-model-changes` — đúng lệnh CI chạy ở
    /// step "Check EF migration snapshot" — luôn báo còn thay đổi chưa migrate và làm đỏ CI.
    ///
    /// File .Designer.cs sinh kèm migration này mang snapshot đã có đủ entity, nên chốt
    /// lại được lệch đó. Up()/Down() cố tình để rỗng vì bảng đã tồn tại trên mọi đường:
    ///   - Database đang chạy: 20260723081500 đã applied.
    ///   - Cài mới từ trắng: baseline IPCmanagement.sql -> Init_EF_History_For_Old_DB.sql
    ///     -> replay migration, và 20260723081500 tạo bảng ở đó.
    /// Nếu Up() tạo bảng lần nữa thì cả hai đường đều vỡ.
    ///
    /// Lưu ý cho migration viết tay về sau: luôn kèm .Designer.cs (hoặc tạo migration bằng
    /// `dotnet ef migrations add` rồi thay phần thân), nếu không snapshot sẽ lệch tiếp.
    /// KHÔNG chạy `dotnet ef migrations remove` khi migration cuối thiếu .Designer.cs —
    /// EF không có snapshot để lùi về và sẽ reset snapshot gần như rỗng.
    /// </summary>
    /// <inheritdoc />
    public partial class SyncUnitNormalizationReviewsSnapshot : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
        }
    }
}
