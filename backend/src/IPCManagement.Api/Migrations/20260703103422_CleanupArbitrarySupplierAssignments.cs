using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace IPCManagement.Api.Migrations
{
    /// <inheritdoc />
    public partial class CleanupArbitrarySupplierAssignments : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Xoá supplierId đã bị gán bừa (bug cũ: khi nguyên liệu chưa có báo giá lẫn lịch sử nhập kho,
            // code cũ chọn đại NCC đầu tiên theo bảng chữ cái, không liên quan tới nguyên liệu).
            // Chỉ dọn các dòng CHƯA tạo đơn mua hàng (purchaseorderlines) — dòng đã có PO thì giữ nguyên
            // để không tạo mâu thuẫn giữa PR line và PO đã tồn tại.
            migrationBuilder.Sql(@"
                UPDATE purchaserequestlines prl
                LEFT JOIN purchaseorderlines pol ON pol.purchaseRequestLineId = prl.purchaseRequestLineId
                SET prl.supplierId = NULL
                WHERE prl.supplierId IS NOT NULL
                  AND pol.purchaseOrderLineId IS NULL
                  AND NOT EXISTS (
                    SELECT 1 FROM supplierquotations sq
                    WHERE sq.ingredientId = prl.ingredientId AND sq.supplierId = prl.supplierId
                  )
                  AND NOT EXISTS (
                    SELECT 1 FROM inventoryreceiptlines irl
                    JOIN inventoryreceipts ir ON ir.receiptId = irl.receiptId
                    WHERE irl.ingredientId = prl.ingredientId AND ir.supplierId = prl.supplierId
                  );
            ");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // Không thể hoàn tác — đã xoá supplierId bị gán sai, không có cách khôi phục lại giá trị cũ.
        }
    }
}
