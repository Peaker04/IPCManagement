using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace IPCManagement.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddReconciliationSourceRevisions : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddUniqueConstraint(
                name: "AK_reconciliationbatchdailylines_DailyLineId_BatchId_Ingredient~",
                table: "reconciliationbatchdailylines",
                columns: new[] { "DailyLineId", "BatchId", "IngredientId", "CanonicalUnitId" });

            migrationBuilder.CreateTable(
                name: "reconciliationsourcerevisions",
                columns: table => new
                {
                    SourceRevisionId = table.Column<byte[]>(type: "binary(16)", fixedLength: true, maxLength: 16, nullable: false),
                    MenuAmendmentId = table.Column<byte[]>(type: "binary(16)", fixedLength: true, maxLength: 16, nullable: false),
                    BatchId = table.Column<byte[]>(type: "binary(16)", fixedLength: true, maxLength: 16, nullable: false),
                    PreviousMenuVersionId = table.Column<byte[]>(type: "binary(16)", fixedLength: true, maxLength: 16, nullable: false),
                    AppliedMenuVersionId = table.Column<byte[]>(type: "binary(16)", fixedLength: true, maxLength: 16, nullable: false),
                    RevisionNumber = table.Column<long>(type: "bigint", nullable: false),
                    Status = table.Column<string>(type: "varchar(32)", maxLength: 32, nullable: false, collation: "utf8mb4_unicode_ci")
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    Reason = table.Column<string>(type: "varchar(1000)", maxLength: 1000, nullable: false, collation: "utf8mb4_unicode_ci")
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    AppliedBy = table.Column<byte[]>(type: "binary(16)", fixedLength: true, maxLength: 16, nullable: false),
                    AppliedAt = table.Column<DateTime>(type: "datetime", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_reconciliationsourcerevisions", x => x.SourceRevisionId);
                    table.ForeignKey(
                        name: "FK_reconciliationsourcerevisions_menuversions_AppliedMenuVersio~",
                        column: x => x.AppliedMenuVersionId,
                        principalTable: "menuversions",
                        principalColumn: "menuVersionId",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_reconciliationsourcerevisions_menuversions_PreviousMenuVersi~",
                        column: x => x.PreviousMenuVersionId,
                        principalTable: "menuversions",
                        principalColumn: "menuVersionId",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_reconciliationsourcerevisions_reconciliationbatches_BatchId",
                        column: x => x.BatchId,
                        principalTable: "reconciliationbatches",
                        principalColumn: "BatchId",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_reconciliationsourcerevisions_users_AppliedBy",
                        column: x => x.AppliedBy,
                        principalTable: "users",
                        principalColumn: "userId",
                        onDelete: ReferentialAction.Restrict);
                })
                .Annotation("MySql:CharSet", "utf8mb4")
                .Annotation("Relational:Collation", "utf8mb4_unicode_ci");

            migrationBuilder.CreateTable(
                name: "reconciliationsourcedeltas",
                columns: table => new
                {
                    SourceDeltaId = table.Column<byte[]>(type: "binary(16)", fixedLength: true, maxLength: 16, nullable: false),
                    SourceRevisionId = table.Column<byte[]>(type: "binary(16)", fixedLength: true, maxLength: 16, nullable: false),
                    BatchId = table.Column<byte[]>(type: "binary(16)", fixedLength: true, maxLength: 16, nullable: false),
                    DailyLineId = table.Column<byte[]>(type: "binary(16)", fixedLength: true, maxLength: 16, nullable: false),
                    IngredientId = table.Column<byte[]>(type: "binary(16)", fixedLength: true, maxLength: 16, nullable: false),
                    CanonicalUnitId = table.Column<byte[]>(type: "binary(16)", fixedLength: true, maxLength: 16, nullable: false),
                    PreviousRequiredQuantity = table.Column<decimal>(type: "decimal(18,6)", precision: 18, scale: 6, nullable: false),
                    NewRequiredQuantity = table.Column<decimal>(type: "decimal(18,6)", precision: 18, scale: 6, nullable: false),
                    DeltaQuantity = table.Column<decimal>(type: "decimal(18,6)", precision: 18, scale: 6, nullable: false),
                    WorkKind = table.Column<string>(type: "varchar(32)", maxLength: 32, nullable: false, collation: "utf8mb4_unicode_ci")
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    Status = table.Column<string>(type: "varchar(20)", maxLength: 20, nullable: false, collation: "utf8mb4_unicode_ci")
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    Version = table.Column<long>(type: "bigint", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime", nullable: false),
                    ResolvedAt = table.Column<DateTime>(type: "datetime", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_reconciliationsourcedeltas", x => x.SourceDeltaId);
                    table.CheckConstraint("ckReconciliationSourceDeltaNonZero", "`deltaQuantity` <> 0");
                    table.CheckConstraint("ckReconciliationSourceDeltaStatus", "`status` IN ('PENDING','RESOLVED','CANCELLED')");
                    table.CheckConstraint("ckReconciliationSourceDeltaWorkKind", "`workKind` IN ('SUPPLEMENTAL_ISSUE','RETURN_REQUIRED')");
                    table.ForeignKey(
                        name: "FK_reconciliationsourcedeltas_reconciliationbatchdailylines_Dai~",
                        columns: x => new { x.DailyLineId, x.BatchId, x.IngredientId, x.CanonicalUnitId },
                        principalTable: "reconciliationbatchdailylines",
                        principalColumns: new[] { "DailyLineId", "BatchId", "IngredientId", "CanonicalUnitId" },
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_reconciliationsourcedeltas_reconciliationsourcerevisions_Sou~",
                        column: x => x.SourceRevisionId,
                        principalTable: "reconciliationsourcerevisions",
                        principalColumn: "SourceRevisionId",
                        onDelete: ReferentialAction.Restrict);
                })
                .Annotation("MySql:CharSet", "utf8mb4")
                .Annotation("Relational:Collation", "utf8mb4_unicode_ci");

            migrationBuilder.CreateIndex(
                name: "IX_reconciliationsourcedeltas_DailyLineId_BatchId_IngredientId_~",
                table: "reconciliationsourcedeltas",
                columns: new[] { "DailyLineId", "BatchId", "IngredientId", "CanonicalUnitId" });

            migrationBuilder.CreateIndex(
                name: "IX_reconciliationsourcedeltas_SourceRevisionId_DailyLineId_Ingr~",
                table: "reconciliationsourcedeltas",
                columns: new[] { "SourceRevisionId", "DailyLineId", "IngredientId", "CanonicalUnitId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_reconciliationsourcerevisions_AppliedBy",
                table: "reconciliationsourcerevisions",
                column: "AppliedBy");

            migrationBuilder.CreateIndex(
                name: "IX_reconciliationsourcerevisions_AppliedMenuVersionId",
                table: "reconciliationsourcerevisions",
                column: "AppliedMenuVersionId");

            migrationBuilder.CreateIndex(
                name: "IX_reconciliationsourcerevisions_BatchId_RevisionNumber",
                table: "reconciliationsourcerevisions",
                columns: new[] { "BatchId", "RevisionNumber" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_reconciliationsourcerevisions_MenuAmendmentId_BatchId",
                table: "reconciliationsourcerevisions",
                columns: new[] { "MenuAmendmentId", "BatchId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_reconciliationsourcerevisions_PreviousMenuVersionId",
                table: "reconciliationsourcerevisions",
                column: "PreviousMenuVersionId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "reconciliationsourcedeltas");

            migrationBuilder.DropTable(
                name: "reconciliationsourcerevisions");

            migrationBuilder.DropUniqueConstraint(
                name: "AK_reconciliationbatchdailylines_DailyLineId_BatchId_Ingredient~",
                table: "reconciliationbatchdailylines");
        }
    }
}
