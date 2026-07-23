using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace IPCManagement.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddSupplierDecisionsAndPriceExceptions : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "isLegacySupplierSnapshot",
                table: "purchaserequestlines",
                type: "tinyint(1)",
                nullable: false,
                defaultValue: false);

            migrationBuilder.Sql(
                "UPDATE `purchaserequestlines` SET `isLegacySupplierSnapshot` = 1 WHERE `supplierId` IS NOT NULL");

            migrationBuilder.CreateTable(
                name: "purchaselinesupplierdecisions",
                columns: table => new
                {
                    purchaseLineSupplierDecisionId = table.Column<byte[]>(type: "binary(16)", fixedLength: true, maxLength: 16, nullable: false),
                    purchaseRequestLineId = table.Column<byte[]>(type: "binary(16)", fixedLength: true, maxLength: 16, nullable: false),
                    supplierId = table.Column<byte[]>(type: "binary(16)", fixedLength: true, maxLength: 16, nullable: false),
                    evidenceType = table.Column<string>(type: "varchar(40)", maxLength: 40, nullable: false, collation: "utf8mb4_unicode_ci")
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    evidenceId = table.Column<byte[]>(type: "binary(16)", fixedLength: true, maxLength: 16, nullable: false),
                    evidenceDate = table.Column<DateOnly>(type: "date", nullable: false),
                    evidenceReferencePrice = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    proposedUnitPrice = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    proposedDeliveryDate = table.Column<DateOnly>(type: "date", nullable: false),
                    confirmedBy = table.Column<byte[]>(type: "binary(16)", fixedLength: true, maxLength: 16, nullable: false),
                    confirmedAt = table.Column<DateTime>(type: "datetime", nullable: false),
                    decisionFingerprint = table.Column<string>(type: "char(64)", fixedLength: true, maxLength: 64, nullable: false, collation: "utf8mb4_unicode_ci")
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    version = table.Column<int>(type: "int", nullable: false),
                    status = table.Column<string>(type: "varchar(20)", maxLength: 20, nullable: false, defaultValue: "CURRENT", collation: "utf8mb4_unicode_ci")
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    currentDecisionKey = table.Column<byte[]>(type: "binary(16)", fixedLength: true, maxLength: 16, nullable: true),
                    supersededByDecisionId = table.Column<byte[]>(type: "binary(16)", fixedLength: true, maxLength: 16, nullable: true),
                    concurrencyVersion = table.Column<int>(type: "int", nullable: false, defaultValue: 1)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PRIMARY", x => x.purchaseLineSupplierDecisionId);
                    table.CheckConstraint("ckPurchaseLineSupplierDecisionsConfirmationComplete", "`confirmedBy` IS NOT NULL AND `confirmedAt` IS NOT NULL AND `version` > 0 AND `concurrencyVersion` > 0");
                    table.CheckConstraint("ckPurchaseLineSupplierDecisionsCurrentKey", "(`status` = 'CURRENT' AND `currentDecisionKey` = `purchaseRequestLineId` AND `supersededByDecisionId` IS NULL) OR (`status` = 'SUPERSEDED' AND `currentDecisionKey` IS NULL AND `supersededByDecisionId` IS NOT NULL)");
                    table.CheckConstraint("ckPurchaseLineSupplierDecisionsEvidenceComplete", "`evidenceType` IN ('EFFECTIVE_QUOTATION', 'LATEST_VALID_RECEIPT') AND `evidenceReferencePrice` > 0 AND `proposedUnitPrice` > 0");
                    table.CheckConstraint("ckPurchaseLineSupplierDecisionsStatus", "`status` IN ('CURRENT', 'SUPERSEDED')");
                    table.ForeignKey(
                        name: "purchaselinesupplierdecisions_ibfk_1",
                        column: x => x.purchaseRequestLineId,
                        principalTable: "purchaserequestlines",
                        principalColumn: "purchaseRequestLineId",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "purchaselinesupplierdecisions_ibfk_2",
                        column: x => x.supplierId,
                        principalTable: "suppliers",
                        principalColumn: "supplierId",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "purchaselinesupplierdecisions_ibfk_3",
                        column: x => x.confirmedBy,
                        principalTable: "users",
                        principalColumn: "userId",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "purchaselinesupplierdecisions_ibfk_4",
                        column: x => x.supersededByDecisionId,
                        principalTable: "purchaselinesupplierdecisions",
                        principalColumn: "purchaseLineSupplierDecisionId",
                        onDelete: ReferentialAction.Restrict);
                })
                .Annotation("MySql:CharSet", "utf8mb4")
                .Annotation("Relational:Collation", "utf8mb4_unicode_ci");

            migrationBuilder.CreateTable(
                name: "purchasepriceexceptions",
                columns: table => new
                {
                    purchasePriceExceptionId = table.Column<byte[]>(type: "binary(16)", fixedLength: true, maxLength: 16, nullable: false),
                    purchaseLineSupplierDecisionId = table.Column<byte[]>(type: "binary(16)", fixedLength: true, maxLength: 16, nullable: false),
                    referencePrice = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    proposedPrice = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    variancePercent = table.Column<decimal>(type: "decimal(9,4)", precision: 9, scale: 4, nullable: false),
                    evidenceType = table.Column<string>(type: "varchar(40)", maxLength: 40, nullable: false, collation: "utf8mb4_unicode_ci")
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    evidenceId = table.Column<byte[]>(type: "binary(16)", fixedLength: true, maxLength: 16, nullable: false),
                    evidenceDate = table.Column<DateOnly>(type: "date", nullable: false),
                    reason = table.Column<string>(type: "text", nullable: false, collation: "utf8mb4_unicode_ci")
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    proposalFingerprint = table.Column<string>(type: "char(64)", fixedLength: true, maxLength: 64, nullable: false, collation: "utf8mb4_unicode_ci")
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    proposalVersion = table.Column<int>(type: "int", nullable: false),
                    requestedBy = table.Column<byte[]>(type: "binary(16)", fixedLength: true, maxLength: 16, nullable: false),
                    requestedAt = table.Column<DateTime>(type: "datetime", nullable: false),
                    status = table.Column<string>(type: "varchar(20)", maxLength: 20, nullable: false, defaultValue: "PENDING", collation: "utf8mb4_unicode_ci")
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    decidedBy = table.Column<byte[]>(type: "binary(16)", fixedLength: true, maxLength: 16, nullable: true),
                    decisionReason = table.Column<string>(type: "text", nullable: true, collation: "utf8mb4_unicode_ci")
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    decidedAt = table.Column<DateTime>(type: "datetime", nullable: true),
                    supersededByExceptionId = table.Column<byte[]>(type: "binary(16)", fixedLength: true, maxLength: 16, nullable: true),
                    concurrencyVersion = table.Column<int>(type: "int", nullable: false, defaultValue: 1)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PRIMARY", x => x.purchasePriceExceptionId);
                    table.CheckConstraint("ckPurchasePriceExceptionsDecisionComplete", "(`status` = 'PENDING' AND `decidedBy` IS NULL AND `decisionReason` IS NULL AND `decidedAt` IS NULL) OR (`status` IN ('APPROVED', 'REJECTED') AND `decidedBy` IS NOT NULL AND `decisionReason` IS NOT NULL AND `decidedAt` IS NOT NULL) OR `status` = 'SUPERSEDED'");
                    table.CheckConstraint("ckPurchasePriceExceptionsStatus", "`status` IN ('PENDING', 'APPROVED', 'REJECTED', 'SUPERSEDED')");
                    table.CheckConstraint("ckPurchasePriceExceptionsStrictVariance", "`referencePrice` > 0 AND `proposedPrice` > `referencePrice` AND `variancePercent` > 15");
                    table.CheckConstraint("ckPurchasePriceExceptionsSupersession", "(`status` = 'SUPERSEDED' AND `supersededByExceptionId` IS NOT NULL) OR (`status` <> 'SUPERSEDED' AND `supersededByExceptionId` IS NULL)");
                    table.ForeignKey(
                        name: "purchasepriceexceptions_ibfk_1",
                        column: x => x.purchaseLineSupplierDecisionId,
                        principalTable: "purchaselinesupplierdecisions",
                        principalColumn: "purchaseLineSupplierDecisionId",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "purchasepriceexceptions_ibfk_2",
                        column: x => x.requestedBy,
                        principalTable: "users",
                        principalColumn: "userId",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "purchasepriceexceptions_ibfk_3",
                        column: x => x.decidedBy,
                        principalTable: "users",
                        principalColumn: "userId",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "purchasepriceexceptions_ibfk_4",
                        column: x => x.supersededByExceptionId,
                        principalTable: "purchasepriceexceptions",
                        principalColumn: "purchasePriceExceptionId",
                        onDelete: ReferentialAction.Restrict);
                })
                .Annotation("MySql:CharSet", "utf8mb4")
                .Annotation("Relational:Collation", "utf8mb4_unicode_ci");

            migrationBuilder.CreateIndex(
                name: "ixPurchaseLineSupplierDecisionsConfirmer",
                table: "purchaselinesupplierdecisions",
                column: "confirmedBy");

            migrationBuilder.CreateIndex(
                name: "ixPurchaseLineSupplierDecisionsSupersededBy",
                table: "purchaselinesupplierdecisions",
                column: "supersededByDecisionId");

            migrationBuilder.CreateIndex(
                name: "ixPurchaseLineSupplierDecisionsSupplier",
                table: "purchaselinesupplierdecisions",
                column: "supplierId");

            migrationBuilder.CreateIndex(
                name: "uqPurchaseLineSupplierDecisionsCurrentKey",
                table: "purchaselinesupplierdecisions",
                column: "currentDecisionKey",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "uqPurchaseLineSupplierDecisionsLineFingerprint",
                table: "purchaselinesupplierdecisions",
                columns: new[] { "purchaseRequestLineId", "decisionFingerprint" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "uqPurchaseLineSupplierDecisionsLineVersion",
                table: "purchaselinesupplierdecisions",
                columns: new[] { "purchaseRequestLineId", "version" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ixPurchasePriceExceptionsDecider",
                table: "purchasepriceexceptions",
                column: "decidedBy");

            migrationBuilder.CreateIndex(
                name: "ixPurchasePriceExceptionsRequester",
                table: "purchasepriceexceptions",
                column: "requestedBy");

            migrationBuilder.CreateIndex(
                name: "ixPurchasePriceExceptionsSupersededBy",
                table: "purchasepriceexceptions",
                column: "supersededByExceptionId");

            migrationBuilder.CreateIndex(
                name: "uqPurchasePriceExceptionsProposal",
                table: "purchasepriceexceptions",
                columns: new[] { "purchaseLineSupplierDecisionId", "proposalFingerprint", "proposalVersion" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "purchasepriceexceptions");

            migrationBuilder.DropTable(
                name: "purchaselinesupplierdecisions");

            migrationBuilder.DropColumn(
                name: "isLegacySupplierSnapshot",
                table: "purchaserequestlines");
        }
    }
}
