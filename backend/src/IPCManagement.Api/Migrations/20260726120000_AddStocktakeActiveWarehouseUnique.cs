using IPCManagement.Api.Data;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace IPCManagement.Api.Migrations;

/// <summary>
/// Chốt chặn ở tầng database cho bất biến "mỗi kho chỉ có tối đa một phiên kiểm kê đang mở".
///
/// StocktakeService.CreateAsync kiểm tra bằng câu SELECT rồi mới INSERT (check-then-write) nên hai
/// request song song đều thấy "chưa có phiên nào" và cùng tạo được phiếu. MySQL không có partial
/// index nên bất biến này được diễn đạt bằng một cột sinh (generated column): cột chỉ mang giá trị
/// warehouseId khi phiếu còn ở DRAFT/REVIEWING, ngược lại là NULL. Unique index trên cột đó cho phép
/// vô số dòng NULL (phiếu đã APPROVED/REJECTED) nhưng chặn dòng thứ hai còn mở của cùng một kho.
///
/// Cột dùng VIRTUAL nên không tốn thêm dung lượng dữ liệu, chỉ phát sinh một secondary index.
/// </summary>
[DbContext(typeof(IpcManagementContext))]
[Migration("20260726120000_AddStocktakeActiveWarehouseUnique")]
public partial class AddStocktakeActiveWarehouseUnique : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql("""
ALTER TABLE `stocktakes`
  ADD COLUMN `activeWarehouseKey` binary(16)
  GENERATED ALWAYS AS (CASE WHEN `status` IN ('DRAFT','REVIEWING') THEN `warehouseId` END) VIRTUAL;
""");

        migrationBuilder.Sql("""
CREATE UNIQUE INDEX `uxStocktakeActiveWarehouse` ON `stocktakes` (`activeWarehouseKey`);
""");
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql("DROP INDEX `uxStocktakeActiveWarehouse` ON `stocktakes`;");
        migrationBuilder.Sql("ALTER TABLE `stocktakes` DROP COLUMN `activeWarehouseKey`;");
    }
}
