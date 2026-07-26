using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace IPCManagement.Api.Migrations
{
    /// <summary>
    /// Migration KHÔNG đổi schema — chỉ để làm mới model snapshot sau khi đổi tên 43 entity
    /// từ dạng <c>Approvalassignment</c> sang <c>ApprovalAssignment</c> (bước 4 của Phần K
    /// trong docs/ARCHITECTURE-REDESIGN-2026-07-26.md).
    ///
    /// Vì sao Up()/Down() rỗng: mọi lệnh <c>ToTable()</c> giữ nguyên tên bảng chữ thường, nên
    /// đổi tên class C# KHÔNG đụng gì tới database. Bộ so sánh của EF làm việc trên metadata
    /// quan hệ (bảng/cột/khoá) chứ không trên tên class, nên nó thấy hai model tương đương —
    /// <c>has-pending-model-changes</c> vẫn sạch cả trước lẫn sau khi đổi tên.
    ///
    /// Vậy tại sao vẫn cần migration này: file
    /// <c>IpcManagementContextModelSnapshot.cs</c> lưu tên class dưới dạng CHUỖI
    /// (<c>modelBuilder.Entity("IPCManagement.Api.Models.Entities.Approvalassignment", ...)</c>).
    /// Sau khi đổi tên, snapshot trỏ tới những kiểu không còn tồn tại — không làm vỡ build vì
    /// đó chỉ là chuỗi, nhưng snapshot lệch với code là đúng cái đã gây ra sự cố
    /// <c>has-pending-model-changes</c> đỏ hôm 27/07. Chạy <c>migrations add</c> để EF tự sinh
    /// lại snapshot theo tên mới; phần thân migration cố tình để trống.
    ///
    /// Các file Designer.cs của migration CŨ vẫn giữ tên class cũ — đó là ảnh chụp model tại
    /// thời điểm migration đó, KHÔNG được sửa.
    /// </summary>
    /// <inheritdoc />
    public partial class RenameEntitiesToPascalCase : Migration
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
