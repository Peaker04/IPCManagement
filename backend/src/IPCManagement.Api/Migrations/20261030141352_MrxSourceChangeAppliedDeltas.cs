using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace IPCManagement.Api.Migrations
{
    /// <inheritdoc />
    public partial class MrxSourceChangeAppliedDeltas : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropCheckConstraint(
                name: "ckReconciliationSourceDeltaStatus",
                table: "reconciliationsourcedeltas");

            migrationBuilder.DropCheckConstraint(
                name: "ckReconciliationSourceDeltaWorkKind",
                table: "reconciliationsourcedeltas");

            migrationBuilder.AlterColumn<byte[]>(
                name: "MenuAmendmentId",
                table: "reconciliationsourcerevisions",
                type: "binary(16)",
                fixedLength: true,
                maxLength: 16,
                nullable: true,
                oldClrType: typeof(byte[]),
                oldType: "binary(16)",
                oldFixedLength: true,
                oldMaxLength: 16);

            migrationBuilder.AddCheckConstraint(
                name: "ckReconciliationSourceDeltaStatus",
                table: "reconciliationsourcedeltas",
                sql: "`status` IN ('PENDING','RESOLVED','CANCELLED','APPLIED')");

            migrationBuilder.AddCheckConstraint(
                name: "ckReconciliationSourceDeltaWorkKind",
                table: "reconciliationsourcedeltas",
                sql: "`workKind` IN ('SUPPLEMENTAL_ISSUE','RETURN_REQUIRED','SOURCE_CHANGE')");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropCheckConstraint(
                name: "ckReconciliationSourceDeltaStatus",
                table: "reconciliationsourcedeltas");

            migrationBuilder.DropCheckConstraint(
                name: "ckReconciliationSourceDeltaWorkKind",
                table: "reconciliationsourcedeltas");

            migrationBuilder.AlterColumn<byte[]>(
                name: "MenuAmendmentId",
                table: "reconciliationsourcerevisions",
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

            migrationBuilder.AddCheckConstraint(
                name: "ckReconciliationSourceDeltaStatus",
                table: "reconciliationsourcedeltas",
                sql: "`status` IN ('PENDING','RESOLVED','CANCELLED')");

            migrationBuilder.AddCheckConstraint(
                name: "ckReconciliationSourceDeltaWorkKind",
                table: "reconciliationsourcedeltas",
                sql: "`workKind` IN ('SUPPLEMENTAL_ISSUE','RETURN_REQUIRED')");
        }
    }
}
