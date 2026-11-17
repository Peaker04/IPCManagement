using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace IPCManagement.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddMrxSupplementalDemandAndIssueAllocations : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "reconciliationsupplementaldemands",
                columns: table => new
                {
                    DemandId = table.Column<byte[]>(type: "binary(16)", fixedLength: true, maxLength: 16, nullable: false),
                    BatchId = table.Column<byte[]>(type: "binary(16)", fixedLength: true, maxLength: 16, nullable: false),
                    ServiceDate = table.Column<DateOnly>(type: "date", nullable: false),
                    Status = table.Column<string>(type: "varchar(20)", maxLength: 20, nullable: false, collation: "utf8mb4_unicode_ci")
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    Reason = table.Column<string>(type: "varchar(2000)", maxLength: 2000, nullable: false, collation: "utf8mb4_unicode_ci")
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    Version = table.Column<long>(type: "bigint", nullable: false),
                    SnapshotBatchVersion = table.Column<long>(type: "bigint", nullable: false),
                    SnapshotFingerprint = table.Column<string>(type: "varchar(64)", maxLength: 64, nullable: false, collation: "utf8mb4_unicode_ci")
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    CreatedBy = table.Column<byte[]>(type: "binary(16)", fixedLength: true, maxLength: 16, nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime(6)", nullable: false),
                    SubmittedAt = table.Column<DateTime>(type: "datetime(6)", nullable: true),
                    DecidedBy = table.Column<byte[]>(type: "binary(16)", fixedLength: true, maxLength: 16, nullable: true),
                    DecidedAt = table.Column<DateTime>(type: "datetime(6)", nullable: true),
                    DecisionReason = table.Column<string>(type: "varchar(2000)", maxLength: 2000, nullable: true, collation: "utf8mb4_unicode_ci")
                        .Annotation("MySql:CharSet", "utf8mb4")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_reconciliationsupplementaldemands", x => x.DemandId);
                    table.UniqueConstraint("AK_reconciliationsupplementaldemands_DemandId_BatchId", x => new { x.DemandId, x.BatchId });
                    table.CheckConstraint("ckMrxSupplementalDemandStatus", "`Status` IN ('DRAFT','PENDING','APPROVED','REJECTED','CANCELLED')");
                    table.ForeignKey(
                        name: "FK_reconciliationsupplementaldemands_reconciliationbatches_Batc~",
                        column: x => x.BatchId,
                        principalTable: "reconciliationbatches",
                        principalColumn: "BatchId",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_reconciliationsupplementaldemands_users_CreatedBy",
                        column: x => x.CreatedBy,
                        principalTable: "users",
                        principalColumn: "userId",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_reconciliationsupplementaldemands_users_DecidedBy",
                        column: x => x.DecidedBy,
                        principalTable: "users",
                        principalColumn: "userId",
                        onDelete: ReferentialAction.Restrict);
                })
                .Annotation("MySql:CharSet", "utf8mb4")
                .Annotation("Relational:Collation", "utf8mb4_unicode_ci");

            migrationBuilder.CreateTable(
                name: "reconciliationsupplementaldemanddishes",
                columns: table => new
                {
                    DemandDishId = table.Column<byte[]>(type: "binary(16)", fixedLength: true, maxLength: 16, nullable: false),
                    DemandId = table.Column<byte[]>(type: "binary(16)", fixedLength: true, maxLength: 16, nullable: false),
                    DishId = table.Column<byte[]>(type: "binary(16)", fixedLength: true, maxLength: 16, nullable: false),
                    ShiftName = table.Column<string>(type: "varchar(60)", maxLength: 60, nullable: false, collation: "utf8mb4_unicode_ci")
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    MenuVariant = table.Column<string>(type: "varchar(30)", maxLength: 30, nullable: false, collation: "utf8mb4_unicode_ci")
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    FrozenDishCode = table.Column<string>(type: "varchar(80)", maxLength: 80, nullable: false, collation: "utf8mb4_unicode_ci")
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    FrozenDishName = table.Column<string>(type: "varchar(255)", maxLength: 255, nullable: false, collation: "utf8mb4_unicode_ci")
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    ExtraServings = table.Column<int>(type: "int", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_reconciliationsupplementaldemanddishes", x => x.DemandDishId);
                    table.CheckConstraint("ckMrxExtraServingsPositive", "`ExtraServings` > 0");
                    table.ForeignKey(
                        name: "FK_reconciliationsupplementaldemanddishes_dishes_DishId",
                        column: x => x.DishId,
                        principalTable: "dishes",
                        principalColumn: "dishId",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_reconciliationsupplementaldemanddishes_reconciliationsupplem~",
                        column: x => x.DemandId,
                        principalTable: "reconciliationsupplementaldemands",
                        principalColumn: "DemandId",
                        onDelete: ReferentialAction.Restrict);
                })
                .Annotation("MySql:CharSet", "utf8mb4")
                .Annotation("Relational:Collation", "utf8mb4_unicode_ci");

            migrationBuilder.CreateTable(
                name: "reconciliationsupplementaldemandmaterials",
                columns: table => new
                {
                    DemandMaterialId = table.Column<byte[]>(type: "binary(16)", fixedLength: true, maxLength: 16, nullable: false),
                    DemandId = table.Column<byte[]>(type: "binary(16)", fixedLength: true, maxLength: 16, nullable: false),
                    BatchId = table.Column<byte[]>(type: "binary(16)", fixedLength: true, maxLength: 16, nullable: false),
                    DailyLineId = table.Column<byte[]>(type: "binary(16)", fixedLength: true, maxLength: 16, nullable: false),
                    IngredientId = table.Column<byte[]>(type: "binary(16)", fixedLength: true, maxLength: 16, nullable: false),
                    CanonicalUnitId = table.Column<byte[]>(type: "binary(16)", fixedLength: true, maxLength: 16, nullable: false),
                    RequiredQuantity = table.Column<decimal>(type: "decimal(18,6)", precision: 18, scale: 6, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_reconciliationsupplementaldemandmaterials", x => x.DemandMaterialId);
                    table.CheckConstraint("ckMrxExtraRequiredPositive", "`RequiredQuantity` > 0");
                    table.ForeignKey(
                        name: "FK_reconciliationsupplementaldemandmaterials_reconciliationbatc~",
                        columns: x => new { x.DailyLineId, x.BatchId, x.IngredientId, x.CanonicalUnitId },
                        principalTable: "reconciliationbatchdailylines",
                        principalColumns: new[] { "DailyLineId", "BatchId", "IngredientId", "CanonicalUnitId" },
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_reconciliationsupplementaldemandmaterials_reconciliationsupp~",
                        columns: x => new { x.DemandId, x.BatchId },
                        principalTable: "reconciliationsupplementaldemands",
                        principalColumns: new[] { "DemandId", "BatchId" },
                        onDelete: ReferentialAction.Restrict);
                })
                .Annotation("MySql:CharSet", "utf8mb4")
                .Annotation("Relational:Collation", "utf8mb4_unicode_ci");

            migrationBuilder.CreateTable(
                name: "reconciliationissueallocations",
                columns: table => new
                {
                    AllocationId = table.Column<byte[]>(type: "binary(16)", fixedLength: true, maxLength: 16, nullable: false),
                    IssueLineId = table.Column<byte[]>(type: "binary(16)", fixedLength: true, maxLength: 16, nullable: false),
                    DailyLineId = table.Column<byte[]>(type: "binary(16)", fixedLength: true, maxLength: 16, nullable: false),
                    DemandMaterialId = table.Column<byte[]>(type: "binary(16)", fixedLength: true, maxLength: 16, nullable: true),
                    Purpose = table.Column<string>(type: "varchar(30)", maxLength: 30, nullable: false, collation: "utf8mb4_unicode_ci")
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    Quantity = table.Column<decimal>(type: "decimal(18,6)", precision: 18, scale: 6, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_reconciliationissueallocations", x => x.AllocationId);
                    table.CheckConstraint("ckMrxIssueAllocationPurpose", "(`Purpose` = 'APPROVED_EXTRA_DEMAND' AND `DemandMaterialId` IS NOT NULL) OR (`Purpose` IN ('BASELINE_SHORTAGE','UNPLANNED_EXTRA') AND `DemandMaterialId` IS NULL)");
                    table.CheckConstraint("ckMrxIssueAllocationQuantity", "`Quantity` > 0");
                    table.ForeignKey(
                        name: "FK_reconciliationissueallocations_inventoryissuelines_IssueLine~",
                        column: x => x.IssueLineId,
                        principalTable: "inventoryissuelines",
                        principalColumn: "issueLineId",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_reconciliationissueallocations_reconciliationbatchdailylines~",
                        column: x => x.DailyLineId,
                        principalTable: "reconciliationbatchdailylines",
                        principalColumn: "DailyLineId",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_reconciliationissueallocations_reconciliationsupplementaldem~",
                        column: x => x.DemandMaterialId,
                        principalTable: "reconciliationsupplementaldemandmaterials",
                        principalColumn: "DemandMaterialId",
                        onDelete: ReferentialAction.Restrict);
                })
                .Annotation("MySql:CharSet", "utf8mb4")
                .Annotation("Relational:Collation", "utf8mb4_unicode_ci");

            migrationBuilder.CreateTable(
                name: "reconciliationsupplementaldemandcontributions",
                columns: table => new
                {
                    DemandContributionId = table.Column<byte[]>(type: "binary(16)", fixedLength: true, maxLength: 16, nullable: false),
                    DemandDishId = table.Column<byte[]>(type: "binary(16)", fixedLength: true, maxLength: 16, nullable: false),
                    DemandMaterialId = table.Column<byte[]>(type: "binary(16)", fixedLength: true, maxLength: 16, nullable: false),
                    FrozenContributorId = table.Column<byte[]>(type: "binary(16)", fixedLength: true, maxLength: 16, nullable: false),
                    CanonicalQuantityPerServing = table.Column<decimal>(type: "decimal(38,24)", precision: 38, scale: 24, nullable: false),
                    FrozenBomQuantityPerServing = table.Column<decimal>(type: "decimal(18,6)", precision: 18, scale: 6, nullable: false),
                    FrozenBomUnitToBaseRate = table.Column<decimal>(type: "decimal(18,6)", precision: 18, scale: 6, nullable: false),
                    FrozenCanonicalUnitToBaseRate = table.Column<decimal>(type: "decimal(18,6)", precision: 18, scale: 6, nullable: false),
                    WasteRatePercent = table.Column<decimal>(type: "decimal(18,6)", precision: 18, scale: 6, nullable: false),
                    RequiredQuantity = table.Column<decimal>(type: "decimal(38,24)", precision: 38, scale: 24, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_reconciliationsupplementaldemandcontributions", x => x.DemandContributionId);
                    table.ForeignKey(
                        name: "FK_reconciliationsupplementaldemandcontributions_reconciliation~",
                        column: x => x.DemandDishId,
                        principalTable: "reconciliationsupplementaldemanddishes",
                        principalColumn: "DemandDishId",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_reconciliationsupplementaldemandcontributions_reconciliatio~1",
                        column: x => x.DemandMaterialId,
                        principalTable: "reconciliationsupplementaldemandmaterials",
                        principalColumn: "DemandMaterialId",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_reconciliationsupplementaldemandcontributions_reconciliatio~2",
                        column: x => x.FrozenContributorId,
                        principalTable: "reconciliationbatchcontributors",
                        principalColumn: "ContributorId",
                        onDelete: ReferentialAction.Restrict);
                })
                .Annotation("MySql:CharSet", "utf8mb4")
                .Annotation("Relational:Collation", "utf8mb4_unicode_ci");

            migrationBuilder.CreateIndex(
                name: "IX_reconciliationissueallocations_DailyLineId",
                table: "reconciliationissueallocations",
                column: "DailyLineId");

            migrationBuilder.CreateIndex(
                name: "IX_reconciliationissueallocations_DemandMaterialId",
                table: "reconciliationissueallocations",
                column: "DemandMaterialId");

            migrationBuilder.CreateIndex(
                name: "IX_reconciliationissueallocations_IssueLineId_Purpose_DemandMat~",
                table: "reconciliationissueallocations",
                columns: new[] { "IssueLineId", "Purpose", "DemandMaterialId" });

            migrationBuilder.CreateIndex(
                name: "IX_reconciliationsupplementaldemandcontributions_DemandDishId_D~",
                table: "reconciliationsupplementaldemandcontributions",
                columns: new[] { "DemandDishId", "DemandMaterialId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_reconciliationsupplementaldemandcontributions_DemandMaterial~",
                table: "reconciliationsupplementaldemandcontributions",
                column: "DemandMaterialId");

            migrationBuilder.CreateIndex(
                name: "IX_reconciliationsupplementaldemandcontributions_FrozenContribu~",
                table: "reconciliationsupplementaldemandcontributions",
                column: "FrozenContributorId");

            migrationBuilder.CreateIndex(
                name: "IX_reconciliationsupplementaldemanddishes_DemandId_DishId_Shift~",
                table: "reconciliationsupplementaldemanddishes",
                columns: new[] { "DemandId", "DishId", "ShiftName", "MenuVariant" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_reconciliationsupplementaldemanddishes_DishId",
                table: "reconciliationsupplementaldemanddishes",
                column: "DishId");

            migrationBuilder.CreateIndex(
                name: "IX_reconciliationsupplementaldemandmaterials_DailyLineId_BatchI~",
                table: "reconciliationsupplementaldemandmaterials",
                columns: new[] { "DailyLineId", "BatchId", "IngredientId", "CanonicalUnitId" });

            migrationBuilder.CreateIndex(
                name: "IX_reconciliationsupplementaldemandmaterials_DemandId_BatchId",
                table: "reconciliationsupplementaldemandmaterials",
                columns: new[] { "DemandId", "BatchId" });

            migrationBuilder.CreateIndex(
                name: "IX_reconciliationsupplementaldemandmaterials_DemandId_DailyLine~",
                table: "reconciliationsupplementaldemandmaterials",
                columns: new[] { "DemandId", "DailyLineId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_reconciliationsupplementaldemands_BatchId_ServiceDate_Status",
                table: "reconciliationsupplementaldemands",
                columns: new[] { "BatchId", "ServiceDate", "Status" });

            migrationBuilder.CreateIndex(
                name: "IX_reconciliationsupplementaldemands_CreatedBy",
                table: "reconciliationsupplementaldemands",
                column: "CreatedBy");

            migrationBuilder.CreateIndex(
                name: "IX_reconciliationsupplementaldemands_DecidedBy",
                table: "reconciliationsupplementaldemands",
                column: "DecidedBy");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "reconciliationissueallocations");

            migrationBuilder.DropTable(
                name: "reconciliationsupplementaldemandcontributions");

            migrationBuilder.DropTable(
                name: "reconciliationsupplementaldemanddishes");

            migrationBuilder.DropTable(
                name: "reconciliationsupplementaldemandmaterials");

            migrationBuilder.DropTable(
                name: "reconciliationsupplementaldemands");
        }
    }
}
