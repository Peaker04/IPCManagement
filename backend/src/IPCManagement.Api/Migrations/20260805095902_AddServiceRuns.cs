using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace IPCManagement.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddServiceRuns : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "serviceruns",
                columns: table => new
                {
                    serviceRunId = table.Column<byte[]>(type: "binary(16)", fixedLength: true, maxLength: 16, nullable: false),
                    planId = table.Column<byte[]>(type: "binary(16)", fixedLength: true, maxLength: 16, nullable: false),
                    shiftName = table.Column<string>(type: "enum('MORNING','AFTERNOON')", nullable: false, collation: "utf8mb4_unicode_ci")
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    status = table.Column<string>(type: "varchar(40)", maxLength: 40, nullable: false, defaultValue: "PLANNED", collation: "utf8mb4_unicode_ci")
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    actualServings = table.Column<int>(type: "int", nullable: true),
                    actualServingsRecordedAt = table.Column<DateTime>(type: "datetime", nullable: true),
                    actualServingsRecordedBy = table.Column<byte[]>(type: "binary(16)", fixedLength: true, maxLength: 16, nullable: true),
                    serviceConfirmationPolicy = table.Column<string>(type: "varchar(20)", maxLength: 20, nullable: false, defaultValue: "WAIVABLE", collation: "utf8mb4_unicode_ci")
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    serviceConfirmedAt = table.Column<DateTime>(type: "datetime", nullable: true),
                    serviceConfirmedBy = table.Column<byte[]>(type: "binary(16)", fixedLength: true, maxLength: 16, nullable: true),
                    serviceConfirmationWaivedAt = table.Column<DateTime>(type: "datetime", nullable: true),
                    serviceConfirmationWaivedBy = table.Column<byte[]>(type: "binary(16)", fixedLength: true, maxLength: 16, nullable: true),
                    serviceConfirmationWaiverReason = table.Column<string>(type: "text", nullable: true, collation: "utf8mb4_unicode_ci")
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    closedAt = table.Column<DateTime>(type: "datetime", nullable: true),
                    closedBy = table.Column<byte[]>(type: "binary(16)", fixedLength: true, maxLength: 16, nullable: true),
                    closeSnapshotJson = table.Column<string>(type: "longtext", nullable: true, collation: "utf8mb4_unicode_ci")
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    openedBy = table.Column<byte[]>(type: "binary(16)", fixedLength: true, maxLength: 16, nullable: false),
                    createdAt = table.Column<DateTime>(type: "datetime", nullable: false),
                    updatedAt = table.Column<DateTime>(type: "datetime", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PRIMARY", x => x.serviceRunId);
                    table.ForeignKey(
                        name: "fkServiceRunsActualServingsRecordedBy",
                        column: x => x.actualServingsRecordedBy,
                        principalTable: "users",
                        principalColumn: "userId",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "fkServiceRunsClosedBy",
                        column: x => x.closedBy,
                        principalTable: "users",
                        principalColumn: "userId",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "fkServiceRunsConfirmationWaivedBy",
                        column: x => x.serviceConfirmationWaivedBy,
                        principalTable: "users",
                        principalColumn: "userId",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "fkServiceRunsOpenedBy",
                        column: x => x.openedBy,
                        principalTable: "users",
                        principalColumn: "userId",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "fkServiceRunsPlan",
                        column: x => x.planId,
                        principalTable: "productionplans",
                        principalColumn: "planId",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "fkServiceRunsServiceConfirmedBy",
                        column: x => x.serviceConfirmedBy,
                        principalTable: "users",
                        principalColumn: "userId",
                        onDelete: ReferentialAction.Restrict);
                })
                .Annotation("MySql:CharSet", "utf8mb4")
                .Annotation("Relational:Collation", "utf8mb4_unicode_ci");

            migrationBuilder.CreateIndex(
                name: "IX_serviceruns_actualServingsRecordedBy",
                table: "serviceruns",
                column: "actualServingsRecordedBy");

            migrationBuilder.CreateIndex(
                name: "IX_serviceruns_closedBy",
                table: "serviceruns",
                column: "closedBy");

            migrationBuilder.CreateIndex(
                name: "IX_serviceruns_openedBy",
                table: "serviceruns",
                column: "openedBy");

            migrationBuilder.CreateIndex(
                name: "IX_serviceruns_serviceConfirmationWaivedBy",
                table: "serviceruns",
                column: "serviceConfirmationWaivedBy");

            migrationBuilder.CreateIndex(
                name: "IX_serviceruns_serviceConfirmedBy",
                table: "serviceruns",
                column: "serviceConfirmedBy");

            migrationBuilder.CreateIndex(
                name: "ixServiceRunsStatusUpdatedAt",
                table: "serviceruns",
                columns: new[] { "status", "updatedAt" });

            migrationBuilder.CreateIndex(
                name: "uqServiceRunsPlanShift",
                table: "serviceruns",
                columns: new[] { "planId", "shiftName" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "serviceruns");
        }
    }
}
