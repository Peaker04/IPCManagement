using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace IPCManagement.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddMenuAmendments : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "menuamendments",
                columns: table => new
                {
                    menuAmendmentId = table.Column<byte[]>(type: "binary(16)", fixedLength: true, maxLength: 16, nullable: false),
                    customerId = table.Column<byte[]>(type: "binary(16)", fixedLength: true, maxLength: 16, nullable: false),
                    weekStartDate = table.Column<DateOnly>(type: "date", nullable: false),
                    baseMenuVersionId = table.Column<byte[]>(type: "binary(16)", fixedLength: true, maxLength: 16, nullable: true),
                    status = table.Column<string>(type: "varchar(40)", maxLength: 40, nullable: false, collation: "utf8mb4_unicode_ci")
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    reason = table.Column<string>(type: "text", nullable: false, collation: "utf8mb4_unicode_ci")
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    impactSnapshotJson = table.Column<string>(type: "longtext", nullable: false, collation: "utf8mb4_unicode_ci")
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    createdBy = table.Column<byte[]>(type: "binary(16)", fixedLength: true, maxLength: 16, nullable: false),
                    createdAt = table.Column<DateTime>(type: "datetime", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PRIMARY", x => x.menuAmendmentId);
                    table.ForeignKey(
                        name: "FK_menuamendments_customers_customerId",
                        column: x => x.customerId,
                        principalTable: "customers",
                        principalColumn: "customerId",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_menuamendments_menuversions_baseMenuVersionId",
                        column: x => x.baseMenuVersionId,
                        principalTable: "menuversions",
                        principalColumn: "menuVersionId",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_menuamendments_users_createdBy",
                        column: x => x.createdBy,
                        principalTable: "users",
                        principalColumn: "userId",
                        onDelete: ReferentialAction.Restrict);
                })
                .Annotation("MySql:CharSet", "utf8mb4")
                .Annotation("Relational:Collation", "utf8mb4_unicode_ci");

            migrationBuilder.CreateTable(
                name: "menuamendmentlines",
                columns: table => new
                {
                    menuAmendmentLineId = table.Column<byte[]>(type: "binary(16)", fixedLength: true, maxLength: 16, nullable: false),
                    menuAmendmentId = table.Column<byte[]>(type: "binary(16)", fixedLength: true, maxLength: 16, nullable: false),
                    serviceDate = table.Column<DateOnly>(type: "date", nullable: false),
                    shiftName = table.Column<string>(type: "varchar(20)", maxLength: 20, nullable: false, collation: "utf8mb4_unicode_ci")
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    dishSlot = table.Column<string>(type: "varchar(40)", maxLength: 40, nullable: false, collation: "utf8mb4_unicode_ci")
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    oldDishId = table.Column<byte[]>(type: "binary(16)", fixedLength: true, maxLength: 16, nullable: true),
                    newDishId = table.Column<byte[]>(type: "binary(16)", fixedLength: true, maxLength: 16, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PRIMARY", x => x.menuAmendmentLineId);
                    table.ForeignKey(
                        name: "FK_menuamendmentlines_dishes_newDishId",
                        column: x => x.newDishId,
                        principalTable: "dishes",
                        principalColumn: "dishId",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_menuamendmentlines_dishes_oldDishId",
                        column: x => x.oldDishId,
                        principalTable: "dishes",
                        principalColumn: "dishId",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_menuamendmentlines_menuamendments_menuAmendmentId",
                        column: x => x.menuAmendmentId,
                        principalTable: "menuamendments",
                        principalColumn: "menuAmendmentId",
                        onDelete: ReferentialAction.Cascade);
                })
                .Annotation("MySql:CharSet", "utf8mb4")
                .Annotation("Relational:Collation", "utf8mb4_unicode_ci");

            migrationBuilder.CreateIndex(
                name: "IX_menuamendmentlines_newDishId",
                table: "menuamendmentlines",
                column: "newDishId");

            migrationBuilder.CreateIndex(
                name: "IX_menuamendmentlines_oldDishId",
                table: "menuamendmentlines",
                column: "oldDishId");

            migrationBuilder.CreateIndex(
                name: "uqMenuAmendmentLinesScope",
                table: "menuamendmentlines",
                columns: new[] { "menuAmendmentId", "serviceDate", "shiftName", "dishSlot" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_menuamendments_baseMenuVersionId",
                table: "menuamendments",
                column: "baseMenuVersionId");

            migrationBuilder.CreateIndex(
                name: "IX_menuamendments_createdBy",
                table: "menuamendments",
                column: "createdBy");

            migrationBuilder.CreateIndex(
                name: "ixMenuAmendmentsScopeStatus",
                table: "menuamendments",
                columns: new[] { "customerId", "weekStartDate", "status" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "menuamendmentlines");

            migrationBuilder.DropTable(
                name: "menuamendments");
        }
    }
}
