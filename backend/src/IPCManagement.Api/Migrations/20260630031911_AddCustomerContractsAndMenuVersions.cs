using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace IPCManagement.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddCustomerContractsAndMenuVersions : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // migrationBuilder.RenameIndex(
            //     name: "customerId1",
            //     table: "productionplanlines",
            //     newName: "customerId3");

            // migrationBuilder.RenameIndex(
            //     name: "customerId",
            //     table: "mealquantityplanlines",
            //     newName: "customerId1");


            migrationBuilder.AlterColumn<string>(
                name: "status",
                table: "menuschedules",
                type: "varchar(20)",
                maxLength: 20,
                nullable: false,
                defaultValueSql: "'DRAFT'",
                collation: "utf8mb4_unicode_ci",
                oldClrType: typeof(string),
                oldType: "enum('DRAFT','CONFIRMED','CANCELLED')",
                oldDefaultValueSql: "'DRAFT'")
                .Annotation("MySql:CharSet", "utf8mb4")
                .OldAnnotation("MySql:CharSet", "utf8mb4")
                .OldAnnotation("Relational:Collation", "utf8mb4_unicode_ci");

            migrationBuilder.CreateTable(
                name: "approvalhistories",
                columns: table => new
                {
                    approvalHistoryId = table.Column<byte[]>(type: "binary(16)", fixedLength: true, maxLength: 16, nullable: false),
                    targetType = table.Column<string>(type: "varchar(50)", maxLength: 50, nullable: false, collation: "utf8mb4_unicode_ci")
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    targetId = table.Column<byte[]>(type: "binary(16)", fixedLength: true, maxLength: 16, nullable: false),
                    decision = table.Column<string>(type: "varchar(20)", maxLength: 20, nullable: false, collation: "utf8mb4_unicode_ci")
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    oldStatus = table.Column<string>(type: "varchar(50)", maxLength: 50, nullable: true, collation: "utf8mb4_unicode_ci")
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    newStatus = table.Column<string>(type: "varchar(50)", maxLength: 50, nullable: true, collation: "utf8mb4_unicode_ci")
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    reason = table.Column<string>(type: "text", nullable: true, collation: "utf8mb4_unicode_ci")
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    actionBy = table.Column<byte[]>(type: "binary(16)", fixedLength: true, maxLength: 16, nullable: false),
                    actionAt = table.Column<DateTime>(type: "datetime", nullable: false, defaultValueSql: "CURRENT_TIMESTAMP")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PRIMARY", x => x.approvalHistoryId);
                    table.ForeignKey(
                        name: "approvalhistories_ibfk_1",
                        column: x => x.actionBy,
                        principalTable: "users",
                        principalColumn: "userId");
                })
                .Annotation("MySql:CharSet", "utf8mb4")
                .Annotation("Relational:Collation", "utf8mb4_unicode_ci");

            migrationBuilder.CreateTable(
                name: "customercontracts",
                columns: table => new
                {
                    contractId = table.Column<byte[]>(type: "binary(16)", fixedLength: true, maxLength: 16, nullable: false),
                    customerId = table.Column<byte[]>(type: "binary(16)", fixedLength: true, maxLength: 16, nullable: false),
                    effectiveFrom = table.Column<DateOnly>(type: "date", nullable: false),
                    effectiveTo = table.Column<DateOnly>(type: "date", nullable: true),
                    activeWeekDays = table.Column<string>(type: "varchar(100)", maxLength: 100, nullable: false, collation: "utf8mb4_unicode_ci")
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    shiftNames = table.Column<string>(type: "varchar(100)", maxLength: 100, nullable: false, collation: "utf8mb4_unicode_ci")
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    defaultMenuPrice = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    defaultBomRatePercent = table.Column<decimal>(type: "decimal(5,2)", precision: 5, scale: 2, nullable: false, defaultValueSql: "'100.00'"),
                    status = table.Column<string>(type: "varchar(20)", maxLength: 20, nullable: false, defaultValueSql: "'ACTIVE'", collation: "utf8mb4_unicode_ci")
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    createdAt = table.Column<DateTime>(type: "datetime", nullable: false, defaultValueSql: "CURRENT_TIMESTAMP"),
                    updatedAt = table.Column<DateTime>(type: "datetime", nullable: false, defaultValueSql: "CURRENT_TIMESTAMP")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PRIMARY", x => x.contractId);
                    table.ForeignKey(
                        name: "customercontracts_ibfk_1",
                        column: x => x.customerId,
                        principalTable: "customers",
                        principalColumn: "customerId");
                })
                .Annotation("MySql:CharSet", "utf8mb4")
                .Annotation("Relational:Collation", "utf8mb4_unicode_ci");

            migrationBuilder.CreateTable(
                name: "menuversions",
                columns: table => new
                {
                    menuVersionId = table.Column<byte[]>(type: "binary(16)", fixedLength: true, maxLength: 16, nullable: false),
                    customerId = table.Column<byte[]>(type: "binary(16)", fixedLength: true, maxLength: 16, nullable: false),
                    weekStartDate = table.Column<DateOnly>(type: "date", nullable: false),
                    versionNo = table.Column<int>(type: "int", nullable: false),
                    status = table.Column<string>(type: "varchar(20)", maxLength: 20, nullable: false, defaultValueSql: "'DRAFT'", collation: "utf8mb4_unicode_ci")
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    sourceFileName = table.Column<string>(type: "varchar(255)", maxLength: 255, nullable: true, collation: "utf8mb4_unicode_ci")
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    sourceChecksum = table.Column<string>(type: "varchar(128)", maxLength: 128, nullable: true, collation: "utf8mb4_unicode_ci")
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    sourceImportBatch = table.Column<string>(type: "varchar(80)", maxLength: 80, nullable: true, collation: "utf8mb4_unicode_ci")
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    createdBy = table.Column<byte[]>(type: "binary(16)", fixedLength: true, maxLength: 16, nullable: true),
                    createdAt = table.Column<DateTime>(type: "datetime", nullable: false, defaultValueSql: "CURRENT_TIMESTAMP"),
                    publishedBy = table.Column<byte[]>(type: "binary(16)", fixedLength: true, maxLength: 16, nullable: true),
                    publishedAt = table.Column<DateTime>(type: "datetime", nullable: true),
                    updatedAt = table.Column<DateTime>(type: "datetime", nullable: false, defaultValueSql: "CURRENT_TIMESTAMP")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PRIMARY", x => x.menuVersionId);
                    table.ForeignKey(
                        name: "menuversions_ibfk_1",
                        column: x => x.customerId,
                        principalTable: "customers",
                        principalColumn: "customerId");
                })
                .Annotation("MySql:CharSet", "utf8mb4")
                .Annotation("Relational:Collation", "utf8mb4_unicode_ci");

            migrationBuilder.CreateIndex(
                name: "IX_approvalhistories_actionBy",
                table: "approvalhistories",
                column: "actionBy");

            migrationBuilder.CreateIndex(
                name: "ixApprovalHistoriesTarget",
                table: "approvalhistories",
                columns: new[] { "targetType", "targetId", "actionAt" });

            migrationBuilder.CreateIndex(
                name: "customerId",
                table: "customercontracts",
                column: "customerId");

            migrationBuilder.CreateIndex(
                name: "ixCustomerContractsEffective",
                table: "customercontracts",
                columns: new[] { "customerId", "effectiveFrom", "effectiveTo" });

            migrationBuilder.CreateIndex(
                name: "customerId2",
                table: "menuversions",
                column: "customerId");

            migrationBuilder.CreateIndex(
                name: "ixMenuVersionsCustomerWeekStatus",
                table: "menuversions",
                columns: new[] { "customerId", "weekStartDate", "status" });

            migrationBuilder.CreateIndex(
                name: "uqMenuVersionsCustomerWeekVersion",
                table: "menuversions",
                columns: new[] { "customerId", "weekStartDate", "versionNo" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "approvalhistories");

            migrationBuilder.DropTable(
                name: "customercontracts");

            migrationBuilder.DropTable(
                name: "menuversions");

            // migrationBuilder.RenameIndex(
            //     name: "customerId3",
            //     table: "productionplanlines",
            //     newName: "customerId1");

            // migrationBuilder.RenameIndex(
            //     name: "customerId1",
            //     table: "mealquantityplanlines",
            //     newName: "customerId");


            migrationBuilder.AlterColumn<string>(
                name: "status",
                table: "menuschedules",
                type: "enum('DRAFT','CONFIRMED','CANCELLED')",
                nullable: false,
                defaultValueSql: "'DRAFT'",
                collation: "utf8mb4_unicode_ci",
                oldClrType: typeof(string),
                oldType: "varchar(20)",
                oldMaxLength: 20,
                oldDefaultValueSql: "'DRAFT'")
                .Annotation("MySql:CharSet", "utf8mb4")
                .OldAnnotation("MySql:CharSet", "utf8mb4")
                .OldAnnotation("Relational:Collation", "utf8mb4_unicode_ci");
        }
    }
}
