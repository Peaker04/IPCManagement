using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace IPCManagement.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddSystemOperationModeAndReconciliation : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "reconciliationbatches",
                columns: table => new
                {
                    BatchId = table.Column<byte[]>(type: "binary(16)", fixedLength: true, maxLength: 16, nullable: false),
                    MenuVersionId = table.Column<byte[]>(type: "binary(16)", fixedLength: true, maxLength: 16, nullable: false),
                    QuantityImportBatchId = table.Column<byte[]>(type: "binary(16)", fixedLength: true, maxLength: 16, nullable: false),
                    Status = table.Column<string>(type: "varchar(20)", maxLength: 20, nullable: false, collation: "utf8mb4_unicode_ci")
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    Version = table.Column<long>(type: "bigint", nullable: false),
                    CreatedBy = table.Column<byte[]>(type: "binary(16)", fixedLength: true, maxLength: 16, nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime", nullable: false),
                    ReadyBy = table.Column<byte[]>(type: "binary(16)", fixedLength: true, maxLength: 16, nullable: true),
                    ReadyAt = table.Column<DateTime>(type: "datetime", nullable: true),
                    CompletedBy = table.Column<byte[]>(type: "binary(16)", fixedLength: true, maxLength: 16, nullable: true),
                    CompletedAt = table.Column<DateTime>(type: "datetime", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_reconciliationbatches", x => x.BatchId);
                    table.CheckConstraint("ckReconciliationBatchStatus", "`status` IN ('DRAFT','READY','IN_PROGRESS','COMPLETED')");
                    table.ForeignKey(
                        name: "FK_reconciliationbatches_menuversions_MenuVersionId",
                        column: x => x.MenuVersionId,
                        principalTable: "menuversions",
                        principalColumn: "menuVersionId",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_reconciliationbatches_quantityimportbatches_QuantityImportBa~",
                        column: x => x.QuantityImportBatchId,
                        principalTable: "quantityimportbatches",
                        principalColumn: "importBatchId",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_reconciliationbatches_users_CreatedBy",
                        column: x => x.CreatedBy,
                        principalTable: "users",
                        principalColumn: "userId",
                        onDelete: ReferentialAction.Restrict);
                })
                .Annotation("MySql:CharSet", "utf8mb4")
                .Annotation("Relational:Collation", "utf8mb4_unicode_ci");

            migrationBuilder.CreateTable(
                name: "reconciliationtolerances",
                columns: table => new
                {
                    ToleranceId = table.Column<byte[]>(type: "binary(16)", fixedLength: true, maxLength: 16, nullable: false),
                    ScopeKind = table.Column<string>(type: "varchar(32)", maxLength: 32, nullable: false, collation: "utf8mb4_unicode_ci")
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    ScopeId = table.Column<byte[]>(type: "binary(16)", fixedLength: true, maxLength: 16, nullable: true),
                    Value = table.Column<decimal>(type: "decimal(18,6)", precision: 18, scale: 6, nullable: false),
                    Version = table.Column<long>(type: "bigint", nullable: false),
                    CreatedBy = table.Column<byte[]>(type: "binary(16)", fixedLength: true, maxLength: 16, nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_reconciliationtolerances", x => x.ToleranceId);
                    table.ForeignKey(
                        name: "FK_reconciliationtolerances_users_CreatedBy",
                        column: x => x.CreatedBy,
                        principalTable: "users",
                        principalColumn: "userId",
                        onDelete: ReferentialAction.Restrict);
                })
                .Annotation("MySql:CharSet", "utf8mb4")
                .Annotation("Relational:Collation", "utf8mb4_unicode_ci");

            migrationBuilder.CreateTable(
                name: "systemoperationmodes",
                columns: table => new
                {
                    id = table.Column<byte>(type: "tinyint unsigned", nullable: false),
                    mode = table.Column<string>(type: "varchar(32)", maxLength: 32, nullable: false, collation: "utf8mb4_unicode_ci")
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    version = table.Column<long>(type: "bigint", nullable: false),
                    updatedBy = table.Column<byte[]>(type: "binary(16)", fixedLength: true, maxLength: 16, nullable: false),
                    updatedAt = table.Column<DateTime>(type: "datetime", nullable: false),
                    reason = table.Column<string>(type: "varchar(1000)", maxLength: 1000, nullable: true, collation: "utf8mb4_unicode_ci")
                        .Annotation("MySql:CharSet", "utf8mb4")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_systemoperationmodes", x => x.id);
                    table.CheckConstraint("ckSystemOperationModesSingleton", "`id` = 1");
                    table.CheckConstraint("ckSystemOperationModesToken", "`mode` IN ('DEFAULT','MATERIAL_RECONCILIATION')");
                    table.ForeignKey(
                        name: "FK_systemoperationmodes_users_updatedBy",
                        column: x => x.updatedBy,
                        principalTable: "users",
                        principalColumn: "userId",
                        onDelete: ReferentialAction.Restrict);
                })
                .Annotation("MySql:CharSet", "utf8mb4")
                .Annotation("Relational:Collation", "utf8mb4_unicode_ci");

            migrationBuilder.CreateTable(
                name: "reconciliationbatchlines",
                columns: table => new
                {
                    BatchLineId = table.Column<byte[]>(type: "binary(16)", fixedLength: true, maxLength: 16, nullable: false),
                    BatchId = table.Column<byte[]>(type: "binary(16)", fixedLength: true, maxLength: 16, nullable: false),
                    IngredientId = table.Column<byte[]>(type: "binary(16)", fixedLength: true, maxLength: 16, nullable: false),
                    CanonicalUnitId = table.Column<byte[]>(type: "binary(16)", fixedLength: true, maxLength: 16, nullable: false),
                    RequiredQuantity = table.Column<decimal>(type: "decimal(18,6)", precision: 18, scale: 6, nullable: false),
                    FrozenTolerance = table.Column<decimal>(type: "decimal(18,6)", precision: 18, scale: 6, nullable: false),
                    ToleranceSourceKind = table.Column<string>(type: "varchar(32)", maxLength: 32, nullable: false, collation: "utf8mb4_unicode_ci")
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    ToleranceSourceVersion = table.Column<string>(type: "varchar(128)", maxLength: 128, nullable: false, collation: "utf8mb4_unicode_ci")
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    Version = table.Column<long>(type: "bigint", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_reconciliationbatchlines", x => x.BatchLineId);
                    table.ForeignKey(
                        name: "FK_reconciliationbatchlines_ingredients_IngredientId",
                        column: x => x.IngredientId,
                        principalTable: "ingredients",
                        principalColumn: "ingredientId",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_reconciliationbatchlines_reconciliationbatches_BatchId",
                        column: x => x.BatchId,
                        principalTable: "reconciliationbatches",
                        principalColumn: "BatchId",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_reconciliationbatchlines_units_CanonicalUnitId",
                        column: x => x.CanonicalUnitId,
                        principalTable: "units",
                        principalColumn: "unitId",
                        onDelete: ReferentialAction.Restrict);
                })
                .Annotation("MySql:CharSet", "utf8mb4")
                .Annotation("Relational:Collation", "utf8mb4_unicode_ci");

            migrationBuilder.CreateTable(
                name: "reconciliationactuals",
                columns: table => new
                {
                    ActualId = table.Column<byte[]>(type: "binary(16)", fixedLength: true, maxLength: 16, nullable: false),
                    BatchLineId = table.Column<byte[]>(type: "binary(16)", fixedLength: true, maxLength: 16, nullable: false),
                    Side = table.Column<string>(type: "varchar(16)", maxLength: 16, nullable: false, collation: "utf8mb4_unicode_ci")
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    Quantity = table.Column<decimal>(type: "decimal(18,6)", precision: 18, scale: 6, nullable: false),
                    Version = table.Column<long>(type: "bigint", nullable: false),
                    EnteredBy = table.Column<byte[]>(type: "binary(16)", fixedLength: true, maxLength: 16, nullable: false),
                    EnteredAt = table.Column<DateTime>(type: "datetime", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_reconciliationactuals", x => x.ActualId);
                    table.CheckConstraint("ckReconciliationActualSide", "`side` IN ('PURCHASED','ISSUED')");
                    table.ForeignKey(
                        name: "FK_reconciliationactuals_reconciliationbatchlines_BatchLineId",
                        column: x => x.BatchLineId,
                        principalTable: "reconciliationbatchlines",
                        principalColumn: "BatchLineId",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_reconciliationactuals_users_EnteredBy",
                        column: x => x.EnteredBy,
                        principalTable: "users",
                        principalColumn: "userId",
                        onDelete: ReferentialAction.Restrict);
                })
                .Annotation("MySql:CharSet", "utf8mb4")
                .Annotation("Relational:Collation", "utf8mb4_unicode_ci");

            migrationBuilder.CreateTable(
                name: "reconciliationbatchcontributors",
                columns: table => new
                {
                    ContributorId = table.Column<byte[]>(type: "binary(16)", fixedLength: true, maxLength: 16, nullable: false),
                    BatchLineId = table.Column<byte[]>(type: "binary(16)", fixedLength: true, maxLength: 16, nullable: false),
                    MenuScheduleId = table.Column<byte[]>(type: "binary(16)", fixedLength: true, maxLength: 16, nullable: false),
                    MealQuantityPlanLineId = table.Column<byte[]>(type: "binary(16)", fixedLength: true, maxLength: 16, nullable: false),
                    DishBomId = table.Column<byte[]>(type: "binary(16)", fixedLength: true, maxLength: 16, nullable: false),
                    SourceQuantity = table.Column<decimal>(type: "decimal(18,6)", precision: 18, scale: 6, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_reconciliationbatchcontributors", x => x.ContributorId);
                    table.ForeignKey(
                        name: "FK_reconciliationbatchcontributors_dishbom_DishBomId",
                        column: x => x.DishBomId,
                        principalTable: "dishbom",
                        principalColumn: "bomId",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_reconciliationbatchcontributors_mealquantityplanlines_MealQu~",
                        column: x => x.MealQuantityPlanLineId,
                        principalTable: "mealquantityplanlines",
                        principalColumn: "quantityPlanLineId",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_reconciliationbatchcontributors_menuschedules_MenuScheduleId",
                        column: x => x.MenuScheduleId,
                        principalTable: "menuschedules",
                        principalColumn: "menuScheduleId",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_reconciliationbatchcontributors_reconciliationbatchlines_Bat~",
                        column: x => x.BatchLineId,
                        principalTable: "reconciliationbatchlines",
                        principalColumn: "BatchLineId",
                        onDelete: ReferentialAction.Restrict);
                })
                .Annotation("MySql:CharSet", "utf8mb4")
                .Annotation("Relational:Collation", "utf8mb4_unicode_ci");

            migrationBuilder.CreateTable(
                name: "reconciliationdispositions",
                columns: table => new
                {
                    DispositionId = table.Column<byte[]>(type: "binary(16)", fixedLength: true, maxLength: 16, nullable: false),
                    BatchLineId = table.Column<byte[]>(type: "binary(16)", fixedLength: true, maxLength: 16, nullable: false),
                    Category = table.Column<string>(type: "varchar(40)", maxLength: 40, nullable: false, collation: "utf8mb4_unicode_ci")
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    Reason = table.Column<string>(type: "varchar(1000)", maxLength: 1000, nullable: false, collation: "utf8mb4_unicode_ci")
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    Version = table.Column<long>(type: "bigint", nullable: false),
                    DisposedBy = table.Column<byte[]>(type: "binary(16)", fixedLength: true, maxLength: 16, nullable: false),
                    DisposedAt = table.Column<DateTime>(type: "datetime", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_reconciliationdispositions", x => x.DispositionId);
                    table.ForeignKey(
                        name: "FK_reconciliationdispositions_reconciliationbatchlines_BatchLin~",
                        column: x => x.BatchLineId,
                        principalTable: "reconciliationbatchlines",
                        principalColumn: "BatchLineId",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_reconciliationdispositions_users_DisposedBy",
                        column: x => x.DisposedBy,
                        principalTable: "users",
                        principalColumn: "userId",
                        onDelete: ReferentialAction.Restrict);
                })
                .Annotation("MySql:CharSet", "utf8mb4")
                .Annotation("Relational:Collation", "utf8mb4_unicode_ci");

            migrationBuilder.CreateTable(
                name: "reconciliationactualrevisions",
                columns: table => new
                {
                    RevisionId = table.Column<byte[]>(type: "binary(16)", fixedLength: true, maxLength: 16, nullable: false),
                    ActualId = table.Column<byte[]>(type: "binary(16)", fixedLength: true, maxLength: 16, nullable: false),
                    OldQuantity = table.Column<decimal>(type: "decimal(18,6)", precision: 18, scale: 6, nullable: false),
                    NewQuantity = table.Column<decimal>(type: "decimal(18,6)", precision: 18, scale: 6, nullable: false),
                    Reason = table.Column<string>(type: "varchar(1000)", maxLength: 1000, nullable: false, collation: "utf8mb4_unicode_ci")
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    ChangedBy = table.Column<byte[]>(type: "binary(16)", fixedLength: true, maxLength: 16, nullable: false),
                    ChangedAt = table.Column<DateTime>(type: "datetime", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_reconciliationactualrevisions", x => x.RevisionId);
                    table.ForeignKey(
                        name: "FK_reconciliationactualrevisions_reconciliationactuals_ActualId",
                        column: x => x.ActualId,
                        principalTable: "reconciliationactuals",
                        principalColumn: "ActualId",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_reconciliationactualrevisions_users_ChangedBy",
                        column: x => x.ChangedBy,
                        principalTable: "users",
                        principalColumn: "userId",
                        onDelete: ReferentialAction.Restrict);
                })
                .Annotation("MySql:CharSet", "utf8mb4")
                .Annotation("Relational:Collation", "utf8mb4_unicode_ci");

            migrationBuilder.CreateIndex(
                name: "IX_reconciliationactualrevisions_ActualId",
                table: "reconciliationactualrevisions",
                column: "ActualId");

            migrationBuilder.CreateIndex(
                name: "IX_reconciliationactualrevisions_ChangedBy",
                table: "reconciliationactualrevisions",
                column: "ChangedBy");

            migrationBuilder.CreateIndex(
                name: "IX_reconciliationactuals_BatchLineId_Side",
                table: "reconciliationactuals",
                columns: new[] { "BatchLineId", "Side" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_reconciliationactuals_EnteredBy",
                table: "reconciliationactuals",
                column: "EnteredBy");

            migrationBuilder.CreateIndex(
                name: "IX_reconciliationbatchcontributors_BatchLineId",
                table: "reconciliationbatchcontributors",
                column: "BatchLineId");

            migrationBuilder.CreateIndex(
                name: "IX_reconciliationbatchcontributors_DishBomId",
                table: "reconciliationbatchcontributors",
                column: "DishBomId");

            migrationBuilder.CreateIndex(
                name: "IX_reconciliationbatchcontributors_MealQuantityPlanLineId",
                table: "reconciliationbatchcontributors",
                column: "MealQuantityPlanLineId");

            migrationBuilder.CreateIndex(
                name: "IX_reconciliationbatchcontributors_MenuScheduleId",
                table: "reconciliationbatchcontributors",
                column: "MenuScheduleId");

            migrationBuilder.CreateIndex(
                name: "IX_reconciliationbatches_CreatedBy",
                table: "reconciliationbatches",
                column: "CreatedBy");

            migrationBuilder.CreateIndex(
                name: "IX_reconciliationbatches_MenuVersionId",
                table: "reconciliationbatches",
                column: "MenuVersionId");

            migrationBuilder.CreateIndex(
                name: "IX_reconciliationbatches_QuantityImportBatchId",
                table: "reconciliationbatches",
                column: "QuantityImportBatchId");

            migrationBuilder.CreateIndex(
                name: "IX_reconciliationbatchlines_BatchId_IngredientId_CanonicalUnitId",
                table: "reconciliationbatchlines",
                columns: new[] { "BatchId", "IngredientId", "CanonicalUnitId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_reconciliationbatchlines_CanonicalUnitId",
                table: "reconciliationbatchlines",
                column: "CanonicalUnitId");

            migrationBuilder.CreateIndex(
                name: "IX_reconciliationbatchlines_IngredientId",
                table: "reconciliationbatchlines",
                column: "IngredientId");

            migrationBuilder.CreateIndex(
                name: "IX_reconciliationdispositions_BatchLineId",
                table: "reconciliationdispositions",
                column: "BatchLineId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_reconciliationdispositions_DisposedBy",
                table: "reconciliationdispositions",
                column: "DisposedBy");

            migrationBuilder.CreateIndex(
                name: "IX_reconciliationtolerances_CreatedBy",
                table: "reconciliationtolerances",
                column: "CreatedBy");

            migrationBuilder.CreateIndex(
                name: "IX_reconciliationtolerances_ScopeKind_ScopeId",
                table: "reconciliationtolerances",
                columns: new[] { "ScopeKind", "ScopeId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_systemoperationmodes_updatedBy",
                table: "systemoperationmodes",
                column: "updatedBy");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "reconciliationactualrevisions");

            migrationBuilder.DropTable(
                name: "reconciliationbatchcontributors");

            migrationBuilder.DropTable(
                name: "reconciliationdispositions");

            migrationBuilder.DropTable(
                name: "reconciliationtolerances");

            migrationBuilder.DropTable(
                name: "systemoperationmodes");

            migrationBuilder.DropTable(
                name: "reconciliationactuals");

            migrationBuilder.DropTable(
                name: "reconciliationbatchlines");

            migrationBuilder.DropTable(
                name: "reconciliationbatches");
        }
    }
}
