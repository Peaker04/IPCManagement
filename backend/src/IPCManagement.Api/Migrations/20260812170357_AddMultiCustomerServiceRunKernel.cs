using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace IPCManagement.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddMultiCustomerServiceRunKernel : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<long>(
                name: "concurrencyVersion",
                table: "serviceruns",
                type: "bigint",
                nullable: false,
                defaultValue: 0L);

            migrationBuilder.AddColumn<byte[]>(
                name: "customerId",
                table: "serviceruns",
                type: "binary(16)",
                fixedLength: true,
                maxLength: 16,
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "priceTierAmount",
                table: "serviceruns",
                type: "decimal(18,2)",
                precision: 18,
                scale: 2,
                nullable: true);

            migrationBuilder.AddColumn<DateOnly>(
                name: "serviceDate",
                table: "serviceruns",
                type: "date",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "servicerundecisionitems",
                columns: table => new
                {
                    serviceRunDecisionItemId = table.Column<byte[]>(type: "binary(16)", fixedLength: true, maxLength: 16, nullable: false),
                    planId = table.Column<byte[]>(type: "binary(16)", fixedLength: true, maxLength: 16, nullable: false),
                    customerId = table.Column<byte[]>(type: "binary(16)", fixedLength: true, maxLength: 16, nullable: true),
                    serviceDate = table.Column<DateOnly>(type: "date", nullable: false),
                    shiftName = table.Column<string>(type: "varchar(20)", maxLength: 20, nullable: false, collation: "utf8mb4_unicode_ci")
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    priceTierAmount = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: true),
                    reason = table.Column<string>(type: "text", nullable: false, collation: "utf8mb4_unicode_ci")
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    createdAt = table.Column<DateTime>(type: "datetime", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PRIMARY", x => x.serviceRunDecisionItemId);
                })
                .Annotation("MySql:CharSet", "utf8mb4")
                .Annotation("Relational:Collation", "utf8mb4_unicode_ci");

            migrationBuilder.CreateTable(
                name: "servicerunsourcelines",
                columns: table => new
                {
                    serviceRunSourceLineId = table.Column<byte[]>(type: "binary(16)", fixedLength: true, maxLength: 16, nullable: false),
                    serviceRunId = table.Column<byte[]>(type: "binary(16)", fixedLength: true, maxLength: 16, nullable: false),
                    materialRequestLineId = table.Column<byte[]>(type: "binary(16)", fixedLength: true, maxLength: 16, nullable: false),
                    recordedAt = table.Column<DateTime>(type: "datetime", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PRIMARY", x => x.serviceRunSourceLineId);
                    table.ForeignKey(
                        name: "FK_servicerunsourcelines_materialrequestlines_materialRequestLi~",
                        column: x => x.materialRequestLineId,
                        principalTable: "materialrequestlines",
                        principalColumn: "requestLineId",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_servicerunsourcelines_serviceruns_serviceRunId",
                        column: x => x.serviceRunId,
                        principalTable: "serviceruns",
                        principalColumn: "serviceRunId",
                        onDelete: ReferentialAction.Restrict);
                })
                .Annotation("MySql:CharSet", "utf8mb4")
                .Annotation("Relational:Collation", "utf8mb4_unicode_ci");

            migrationBuilder.CreateIndex(
                name: "ixServiceRunDecisionItemsPlanShiftReason",
                table: "servicerundecisionitems",
                columns: new[] { "planId", "shiftName", "reason" });

            migrationBuilder.CreateIndex(
                name: "IX_servicerunsourcelines_materialRequestLineId",
                table: "servicerunsourcelines",
                column: "materialRequestLineId");

            migrationBuilder.CreateIndex(
                name: "uqServiceRunSourceLinesRunLine",
                table: "servicerunsourcelines",
                columns: new[] { "serviceRunId", "materialRequestLineId" },
                unique: true);

            migrationBuilder.Sql("""
                WITH resolvedCandidates AS (
                    SELECT candidateRun.serviceRunId, resolved.customerId, plan.planDate AS serviceDate,
                           candidateRun.shiftName, resolved.priceTierAmount
                    FROM serviceruns AS candidateRun
                    INNER JOIN productionplans AS plan ON plan.planId = candidateRun.planId
                    INNER JOIN (
                        SELECT line.planId, line.shiftName, MIN(line.customerId) AS customerId,
                               MIN(requestLine.priceTierAmount) AS priceTierAmount
                        FROM productionplanlines AS line
                        INNER JOIN materialrequestlines AS requestLine ON requestLine.planLineId = line.planLineId
                        GROUP BY line.planId, line.shiftName
                        HAVING COUNT(DISTINCT line.customerId) = 1
                           AND COUNT(DISTINCT requestLine.priceTierAmount) = 1
                    ) AS resolved ON resolved.planId = candidateRun.planId AND resolved.shiftName = candidateRun.shiftName
                ), nonConflictingScopes AS (
                    SELECT customerId, serviceDate, shiftName, priceTierAmount
                    FROM resolvedCandidates
                    GROUP BY customerId, serviceDate, shiftName, priceTierAmount
                    HAVING COUNT(*) = 1
                )
                UPDATE serviceruns AS run
                INNER JOIN resolvedCandidates AS resolved ON resolved.serviceRunId = run.serviceRunId
                INNER JOIN nonConflictingScopes AS scope ON scope.customerId = resolved.customerId
                    AND scope.serviceDate = resolved.serviceDate
                    AND scope.shiftName = resolved.shiftName
                    AND scope.priceTierAmount = resolved.priceTierAmount
                LEFT JOIN (
                    SELECT customerId, serviceDate, shiftName, priceTierAmount
                    FROM (
                        SELECT customerId, serviceDate, shiftName, priceTierAmount
                        FROM serviceruns
                        WHERE customerId IS NOT NULL
                          AND serviceDate IS NOT NULL
                          AND priceTierAmount IS NOT NULL
                    ) AS scopedSnapshot
                ) AS existingScope ON existingScope.customerId = resolved.customerId
                    AND existingScope.serviceDate = resolved.serviceDate
                    AND existingScope.shiftName = resolved.shiftName
                    AND existingScope.priceTierAmount = resolved.priceTierAmount
                SET run.customerId = resolved.customerId,
                    run.serviceDate = resolved.serviceDate,
                    run.priceTierAmount = resolved.priceTierAmount
                WHERE run.customerId IS NULL
                  AND run.serviceDate IS NULL
                  AND run.priceTierAmount IS NULL
                  AND existingScope.customerId IS NULL;
                """);

            migrationBuilder.CreateIndex(
                name: "uqServiceRunsCustomerDateShiftTier",
                table: "serviceruns",
                columns: new[] { "customerId", "serviceDate", "shiftName", "priceTierAmount" },
                unique: true);

            migrationBuilder.Sql("""
                INSERT INTO servicerunsourcelines
                    (serviceRunSourceLineId, serviceRunId, materialRequestLineId, recordedAt)
                SELECT UUID_TO_BIN(UUID()), run.serviceRunId, requestLine.requestLineId, UTC_TIMESTAMP()
                FROM serviceruns AS run
                INNER JOIN productionplanlines AS line
                    ON line.planId = run.planId
                   AND line.shiftName = run.shiftName
                   AND line.customerId = run.customerId
                INNER JOIN materialrequestlines AS requestLine
                    ON requestLine.planLineId = line.planLineId
                   AND requestLine.priceTierAmount = run.priceTierAmount
                WHERE run.customerId IS NOT NULL
                  AND run.serviceDate IS NOT NULL
                  AND run.priceTierAmount IS NOT NULL;
                """);

            migrationBuilder.Sql("""
                INSERT INTO servicerundecisionitems
                    (serviceRunDecisionItemId, planId, customerId, serviceDate, shiftName, priceTierAmount, reason, createdAt)
                SELECT UUID_TO_BIN(UUID()), run.planId, NULL, plan.planDate, run.shiftName, NULL,
                       'Legacy ServiceRun scope is ambiguous or conflicts with another ServiceRun; resolve customer and price tier before lifecycle mutation.',
                       UTC_TIMESTAMP()
                FROM serviceruns AS run
                INNER JOIN productionplans AS plan ON plan.planId = run.planId
                WHERE run.customerId IS NULL
                   OR run.serviceDate IS NULL
                   OR run.priceTierAmount IS NULL;
                """);

            migrationBuilder.AddForeignKey(
                name: "fkServiceRunsCustomer",
                table: "serviceruns",
                column: "customerId",
                principalTable: "customers",
                principalColumn: "customerId",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "fkServiceRunsCustomer",
                table: "serviceruns");

            migrationBuilder.DropTable(
                name: "servicerundecisionitems");

            migrationBuilder.DropTable(
                name: "servicerunsourcelines");

            migrationBuilder.DropIndex(
                name: "uqServiceRunsCustomerDateShiftTier",
                table: "serviceruns");

            migrationBuilder.DropColumn(
                name: "concurrencyVersion",
                table: "serviceruns");

            migrationBuilder.DropColumn(
                name: "customerId",
                table: "serviceruns");

            migrationBuilder.DropColumn(
                name: "priceTierAmount",
                table: "serviceruns");

            migrationBuilder.DropColumn(
                name: "serviceDate",
                table: "serviceruns");

        }
    }
}
