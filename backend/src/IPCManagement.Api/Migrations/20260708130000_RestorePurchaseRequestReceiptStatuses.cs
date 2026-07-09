using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace IPCManagement.Api.Migrations
{
    /// <inheritdoc />
    /// <remarks>
    /// CR-01 fix: The previous migration (20260702165732_FixPurchaseRequestStatusEnum) removed
    /// PARTIALRECEIVED and RECEIVED from the purchaserequests enum. However,
    /// InventoryReceiptService.ResolvePurchaseReceiptStatus still writes these values when recording
    /// partial or full receipts from a purchase request. This migration restores those two values to
    /// prevent MySQL enum rejection at runtime.
    ///
    /// Decision: keep PARTIALRECEIVED/RECEIVED in purchaserequests.status (rather than removing the
    /// service logic) because the receipt-progress tracking on the purchase request is the canonical
    /// indicator that warehouse can see when checking whether a purchase is fully received.
    /// </remarks>
    public partial class RestorePurchaseRequestReceiptStatuses : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AlterColumn<string>(
                name: "status",
                table: "purchaserequests",
                type: "enum('DRAFT','SENTTOSUPPLIER','APPROVED','REJECTED','SENTTOWAREHOUSE','PARTIALRECEIVED','RECEIVED','CANCELLED')",
                nullable: false,
                defaultValueSql: "'DRAFT'",
                oldClrType: typeof(string),
                oldType: "enum('DRAFT','SENTTOSUPPLIER','APPROVED','REJECTED','SENTTOWAREHOUSE','CANCELLED')",
                oldDefaultValueSql: "'DRAFT'")
                .Annotation("MySql:CharSet", "utf8mb4")
                .Annotation("Relational:Collation", "utf8mb4_unicode_ci")
                .OldAnnotation("MySql:CharSet", "utf8mb4")
                .OldAnnotation("Relational:Collation", "utf8mb4_unicode_ci");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AlterColumn<string>(
                name: "status",
                table: "purchaserequests",
                type: "enum('DRAFT','SENTTOSUPPLIER','APPROVED','REJECTED','SENTTOWAREHOUSE','CANCELLED')",
                nullable: false,
                defaultValueSql: "'DRAFT'",
                oldClrType: typeof(string),
                oldType: "enum('DRAFT','SENTTOSUPPLIER','APPROVED','REJECTED','SENTTOWAREHOUSE','PARTIALRECEIVED','RECEIVED','CANCELLED')",
                oldDefaultValueSql: "'DRAFT'")
                .Annotation("MySql:CharSet", "utf8mb4")
                .Annotation("Relational:Collation", "utf8mb4_unicode_ci")
                .OldAnnotation("MySql:CharSet", "utf8mb4")
                .OldAnnotation("Relational:Collation", "utf8mb4_unicode_ci");
        }
    }
}
