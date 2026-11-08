using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace IPCManagement.Api.Migrations
{
    /// <inheritdoc />
    public partial class RefineReconciliationSourceRevisionProjection : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_reconciliationsourcedeltas_reconciliationbatchdailylines_Dai~",
                table: "reconciliationsourcedeltas");

            migrationBuilder.DropForeignKey(
                name: "FK_reconciliationsourcedeltas_reconciliationsourcerevisions_Sou~",
                table: "reconciliationsourcedeltas");

            migrationBuilder.DropIndex(
                name: "IX_reconciliationsourcedeltas_SourceRevisionId_DailyLineId_Ingr~",
                table: "reconciliationsourcedeltas");

            migrationBuilder.DropCheckConstraint(
                name: "ckReconciliationBatchDailyLineRequiredQuantity",
                table: "reconciliationbatchdailylines");

            migrationBuilder.AlterColumn<byte[]>(
                name: "DailyLineId",
                table: "reconciliationsourcedeltas",
                type: "binary(16)",
                fixedLength: true,
                maxLength: 16,
                nullable: true,
                oldClrType: typeof(byte[]),
                oldType: "binary(16)",
                oldFixedLength: true,
                oldMaxLength: 16);

            migrationBuilder.AddColumn<DateOnly>(
                name: "ServiceDate",
                table: "reconciliationsourcedeltas",
                type: "date",
                nullable: false,
                defaultValue: new DateOnly(1, 1, 1));

            migrationBuilder.CreateIndex(
                name: "IX_reconciliationsourcedeltas_SourceRevisionId_DailyLineId_Serv~",
                table: "reconciliationsourcedeltas",
                columns: new[] { "SourceRevisionId", "DailyLineId", "ServiceDate", "IngredientId", "CanonicalUnitId" },
                unique: true);

            migrationBuilder.AddForeignKey(
                name: "FK_reconciliationsourcedeltas_reconciliationbatchdailylines_Dai~",
                table: "reconciliationsourcedeltas",
                columns: new[] { "DailyLineId", "BatchId", "IngredientId", "CanonicalUnitId" },
                principalTable: "reconciliationbatchdailylines",
                principalColumns: new[] { "DailyLineId", "BatchId", "IngredientId", "CanonicalUnitId" },
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_reconciliationsourcedeltas_reconciliationsourcerevisions_Sou~",
                table: "reconciliationsourcedeltas",
                column: "SourceRevisionId",
                principalTable: "reconciliationsourcerevisions",
                principalColumn: "SourceRevisionId",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddCheckConstraint(
                name: "ckReconciliationBatchDailyLineRequiredQuantity",
                table: "reconciliationbatchdailylines",
                sql: "`requiredQuantity` >= 0");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_reconciliationsourcedeltas_reconciliationbatchdailylines_Dai~",
                table: "reconciliationsourcedeltas");

            migrationBuilder.DropForeignKey(
                name: "FK_reconciliationsourcedeltas_reconciliationsourcerevisions_Sou~",
                table: "reconciliationsourcedeltas");

            migrationBuilder.DropIndex(
                name: "IX_reconciliationsourcedeltas_SourceRevisionId_DailyLineId_Serv~",
                table: "reconciliationsourcedeltas");

            migrationBuilder.DropCheckConstraint(
                name: "ckReconciliationBatchDailyLineRequiredQuantity",
                table: "reconciliationbatchdailylines");

            migrationBuilder.DropColumn(
                name: "ServiceDate",
                table: "reconciliationsourcedeltas");

            migrationBuilder.AlterColumn<byte[]>(
                name: "DailyLineId",
                table: "reconciliationsourcedeltas",
                type: "binary(16)",
                fixedLength: true,
                maxLength: 16,
                nullable: false,
                defaultValue: new byte[0],
                oldClrType: typeof(byte[]),
                oldType: "binary(16)",
                oldFixedLength: true,
                oldMaxLength: 16,
                oldNullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_reconciliationsourcedeltas_SourceRevisionId_DailyLineId_Ingr~",
                table: "reconciliationsourcedeltas",
                columns: new[] { "SourceRevisionId", "DailyLineId", "IngredientId", "CanonicalUnitId" },
                unique: true);

            migrationBuilder.AddForeignKey(
                name: "FK_reconciliationsourcedeltas_reconciliationbatchdailylines_Dai~",
                table: "reconciliationsourcedeltas",
                columns: new[] { "DailyLineId", "BatchId", "IngredientId", "CanonicalUnitId" },
                principalTable: "reconciliationbatchdailylines",
                principalColumns: new[] { "DailyLineId", "BatchId", "IngredientId", "CanonicalUnitId" },
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_reconciliationsourcedeltas_reconciliationsourcerevisions_Sou~",
                table: "reconciliationsourcedeltas",
                column: "SourceRevisionId",
                principalTable: "reconciliationsourcerevisions",
                principalColumn: "SourceRevisionId",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddCheckConstraint(
                name: "ckReconciliationBatchDailyLineRequiredQuantity",
                table: "reconciliationbatchdailylines",
                sql: "`requiredQuantity` > 0");
        }
    }
}
