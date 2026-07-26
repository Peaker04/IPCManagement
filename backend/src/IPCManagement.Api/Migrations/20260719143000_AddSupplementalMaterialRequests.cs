using IPCManagement.Api.Data;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace IPCManagement.Api.Migrations;

[DbContext(typeof(IpcManagementContext))]
[Migration("20260719143000_AddSupplementalMaterialRequests")]
public partial class AddSupplementalMaterialRequests : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.CreateTable(
            name: "supplementalmaterialrequests",
            columns: table => new
            {
                requestId = table.Column<byte[]>(type: "binary(16)", fixedLength: true, maxLength: 16, nullable: false),
                requestCode = table.Column<string>(type: "varchar(50)", maxLength: 50, nullable: false),
                issueId = table.Column<byte[]>(type: "binary(16)", fixedLength: true, maxLength: 16, nullable: false),
                issueLineId = table.Column<byte[]>(type: "binary(16)", fixedLength: true, maxLength: 16, nullable: false),
                warehouseId = table.Column<byte[]>(type: "binary(16)", fixedLength: true, maxLength: 16, nullable: false),
                ingredientId = table.Column<byte[]>(type: "binary(16)", fixedLength: true, maxLength: 16, nullable: false),
                unitId = table.Column<byte[]>(type: "binary(16)", fixedLength: true, maxLength: 16, nullable: false),
                requestedQty = table.Column<decimal>(type: "decimal(18,6)", precision: 18, scale: 6, nullable: false),
                reason = table.Column<string>(type: "varchar(1000)", maxLength: 1000, nullable: true),
                status = table.Column<string>(type: "varchar(24)", maxLength: 24, nullable: false),
                requestedBy = table.Column<byte[]>(type: "binary(16)", fixedLength: true, maxLength: 16, nullable: false),
                requestedAt = table.Column<DateTime>(type: "datetime", nullable: false)
            },
            constraints: table =>
            {
                table.PrimaryKey("PRIMARY", x => x.requestId);
                table.ForeignKey("FK_supplemental_ingredient", x => x.ingredientId, "ingredients", "ingredientId", onDelete: ReferentialAction.Restrict);
                table.ForeignKey("FK_supplemental_issue", x => x.issueId, "inventoryissues", "issueId", onDelete: ReferentialAction.Restrict);
                table.ForeignKey("FK_supplemental_issue_line", x => x.issueLineId, "inventoryissuelines", "issueLineId", onDelete: ReferentialAction.Restrict);
                table.ForeignKey("FK_supplemental_requested_by", x => x.requestedBy, "users", "userId", onDelete: ReferentialAction.Restrict);
                table.ForeignKey("FK_supplemental_unit", x => x.unitId, "units", "unitId", onDelete: ReferentialAction.Restrict);
                table.ForeignKey("FK_supplemental_warehouse", x => x.warehouseId, "warehouses", "warehouseId", onDelete: ReferentialAction.Restrict);
            })
            .Annotation("MySql:CharSet", "utf8mb4")
            .Annotation("Relational:Collation", "utf8mb4_unicode_ci");

        migrationBuilder.CreateIndex("IX_supplementalmaterialrequests_requestCode", "supplementalmaterialrequests", "requestCode", unique: true);
        migrationBuilder.CreateIndex("IX_supplementalmaterialrequests_issueId", "supplementalmaterialrequests", "issueId");
        migrationBuilder.CreateIndex("IX_supplementalmaterialrequests_issueLineId", "supplementalmaterialrequests", "issueLineId");
        migrationBuilder.CreateIndex("IX_supplementalmaterialrequests_ingredientId", "supplementalmaterialrequests", "ingredientId");
        migrationBuilder.CreateIndex("IX_supplementalmaterialrequests_requestedBy", "supplementalmaterialrequests", "requestedBy");
        migrationBuilder.CreateIndex("IX_supplementalmaterialrequests_unitId", "supplementalmaterialrequests", "unitId");
        migrationBuilder.CreateIndex("IX_supplementalmaterialrequests_warehouseId_status_requestedAt", "supplementalmaterialrequests", new[] { "warehouseId", "status", "requestedAt" });
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropTable(name: "supplementalmaterialrequests");
    }
}
