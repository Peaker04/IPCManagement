using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace IPCManagement.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddInventoryAllocationDispositions : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "inventoryallocationdispositions",
                columns: table => new
                {
                    allocationDispositionId = table.Column<byte[]>(type: "binary(16)", fixedLength: true, maxLength: 16, nullable: false),
                    sourceIssueLineId = table.Column<byte[]>(type: "binary(16)", fixedLength: true, maxLength: 16, nullable: false),
                    destinationIssueLineId = table.Column<byte[]>(type: "binary(16)", fixedLength: true, maxLength: 16, nullable: false),
                    quantity = table.Column<decimal>(type: "decimal(18,6)", precision: 18, scale: 6, nullable: false),
                    reason = table.Column<string>(type: "varchar(1000)", maxLength: 1000, nullable: false),
                    createdBy = table.Column<byte[]>(type: "binary(16)", fixedLength: true, maxLength: 16, nullable: false),
                    createdAt = table.Column<DateTime>(type: "datetime", nullable: false),
                    version = table.Column<long>(type: "bigint", nullable: false, defaultValue: 0L),
                    correlationId = table.Column<string>(type: "varchar(128)", maxLength: 128, nullable: true),
                    causationId = table.Column<string>(type: "varchar(128)", maxLength: 128, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PRIMARY", x => x.allocationDispositionId);
                    table.ForeignKey(name: "inventoryallocationdispositions_ibfk_2", column: x => x.destinationIssueLineId, principalTable: "inventoryissuelines", principalColumn: "issueLineId", onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(name: "inventoryallocationdispositions_ibfk_1", column: x => x.sourceIssueLineId, principalTable: "inventoryissuelines", principalColumn: "issueLineId", onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(name: "inventoryallocationdispositions_ibfk_3", column: x => x.createdBy, principalTable: "users", principalColumn: "userId", onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(name: "ixInventoryAllocationDispositionsDestination", table: "inventoryallocationdispositions", column: "destinationIssueLineId");
            migrationBuilder.CreateIndex(name: "ixInventoryAllocationDispositionsSource", table: "inventoryallocationdispositions", column: "sourceIssueLineId");
            migrationBuilder.CreateIndex(name: "IX_inventoryallocationdispositions_createdBy", table: "inventoryallocationdispositions", column: "createdBy");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(name: "inventoryallocationdispositions");
        }
    }
}
