using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace IPCManagement.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddLifecycleKernel : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "lifecyclecommandreceipts",
                columns: table => new
                {
                    commandReceiptId = table.Column<byte[]>(type: "binary(16)", fixedLength: true, maxLength: 16, nullable: false),
                    commandId = table.Column<string>(type: "varchar(100)", maxLength: 100, nullable: false, collation: "utf8mb4_unicode_ci")
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    aggregateType = table.Column<string>(type: "varchar(80)", maxLength: 80, nullable: false, collation: "utf8mb4_unicode_ci")
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    aggregateId = table.Column<byte[]>(type: "binary(16)", fixedLength: true, maxLength: 16, nullable: false),
                    responseJson = table.Column<string>(type: "longtext", nullable: false, collation: "utf8mb4_unicode_ci")
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    createdAt = table.Column<DateTime>(type: "datetime", nullable: false, defaultValueSql: "CURRENT_TIMESTAMP")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PRIMARY", x => x.commandReceiptId);
                })
                .Annotation("MySql:CharSet", "utf8mb4")
                .Annotation("Relational:Collation", "utf8mb4_unicode_ci");

            migrationBuilder.CreateTable(
                name: "lifecycleoutboxmessages",
                columns: table => new
                {
                    outboxMessageId = table.Column<byte[]>(type: "binary(16)", fixedLength: true, maxLength: 16, nullable: false),
                    eventType = table.Column<string>(type: "varchar(120)", maxLength: 120, nullable: false, collation: "utf8mb4_unicode_ci")
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    aggregateType = table.Column<string>(type: "varchar(80)", maxLength: 80, nullable: false, collation: "utf8mb4_unicode_ci")
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    aggregateId = table.Column<byte[]>(type: "binary(16)", fixedLength: true, maxLength: 16, nullable: false),
                    aggregateSequence = table.Column<int>(type: "int", nullable: false),
                    commandId = table.Column<string>(type: "varchar(100)", maxLength: 100, nullable: false, collation: "utf8mb4_unicode_ci")
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    payloadJson = table.Column<string>(type: "longtext", nullable: false, collation: "utf8mb4_unicode_ci")
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    status = table.Column<string>(type: "varchar(20)", maxLength: 20, nullable: false, defaultValue: "PENDING", collation: "utf8mb4_unicode_ci")
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    attemptCount = table.Column<int>(type: "int", nullable: false, defaultValue: 0),
                    nextAttemptAt = table.Column<DateTime>(type: "datetime", nullable: true),
                    lockedAt = table.Column<DateTime>(type: "datetime", nullable: true),
                    processedAt = table.Column<DateTime>(type: "datetime", nullable: true),
                    lastError = table.Column<string>(type: "text", nullable: true, collation: "utf8mb4_unicode_ci")
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    createdAt = table.Column<DateTime>(type: "datetime", nullable: false, defaultValueSql: "CURRENT_TIMESTAMP")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PRIMARY", x => x.outboxMessageId);
                    table.CheckConstraint("ckLifecycleOutboxStatus", "`status` IN ('PENDING','PROCESSING','PROCESSED','FAILED','POISON')");
                })
                .Annotation("MySql:CharSet", "utf8mb4")
                .Annotation("Relational:Collation", "utf8mb4_unicode_ci");

            migrationBuilder.CreateTable(
                name: "lifecycletransitions",
                columns: table => new
                {
                    transitionId = table.Column<byte[]>(type: "binary(16)", fixedLength: true, maxLength: 16, nullable: false),
                    aggregateType = table.Column<string>(type: "varchar(80)", maxLength: 80, nullable: false, collation: "utf8mb4_unicode_ci")
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    aggregateId = table.Column<byte[]>(type: "binary(16)", fixedLength: true, maxLength: 16, nullable: false),
                    commandId = table.Column<string>(type: "varchar(100)", maxLength: 100, nullable: false, collation: "utf8mb4_unicode_ci")
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    aggregateSequence = table.Column<int>(type: "int", nullable: false),
                    fromState = table.Column<string>(type: "varchar(60)", maxLength: 60, nullable: true, collation: "utf8mb4_unicode_ci")
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    toState = table.Column<string>(type: "varchar(60)", maxLength: 60, nullable: false, collation: "utf8mb4_unicode_ci")
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    actorId = table.Column<byte[]>(type: "binary(16)", fixedLength: true, maxLength: 16, nullable: true),
                    expectedVersion = table.Column<long>(type: "bigint", nullable: false),
                    reason = table.Column<string>(type: "text", nullable: true, collation: "utf8mb4_unicode_ci")
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    correlationId = table.Column<string>(type: "varchar(120)", maxLength: 120, nullable: true, collation: "utf8mb4_unicode_ci")
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    causationId = table.Column<string>(type: "varchar(120)", maxLength: 120, nullable: true, collation: "utf8mb4_unicode_ci")
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    payloadJson = table.Column<string>(type: "longtext", nullable: true, collation: "utf8mb4_unicode_ci")
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    schemaVersion = table.Column<int>(type: "int", nullable: false, defaultValue: 1),
                    createdAt = table.Column<DateTime>(type: "datetime", nullable: false, defaultValueSql: "CURRENT_TIMESTAMP")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PRIMARY", x => x.transitionId);
                })
                .Annotation("MySql:CharSet", "utf8mb4")
                .Annotation("Relational:Collation", "utf8mb4_unicode_ci");

            migrationBuilder.CreateIndex(
                name: "ixLifecycleCommandReceiptsCreatedAt",
                table: "lifecyclecommandreceipts",
                column: "createdAt");

            migrationBuilder.CreateIndex(
                name: "uqLifecycleCommandReceiptsCommand",
                table: "lifecyclecommandreceipts",
                columns: new[] { "commandId", "aggregateType", "aggregateId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ixLifecycleOutboxAggregate",
                table: "lifecycleoutboxmessages",
                columns: new[] { "aggregateType", "aggregateId", "aggregateSequence" });

            migrationBuilder.CreateIndex(
                name: "ixLifecycleOutboxPending",
                table: "lifecycleoutboxmessages",
                columns: new[] { "status", "nextAttemptAt", "createdAt" });

            migrationBuilder.CreateIndex(
                name: "uqLifecycleOutboxCommand",
                table: "lifecycleoutboxmessages",
                column: "commandId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ixLifecycleTransitionsCreatedAt",
                table: "lifecycletransitions",
                columns: new[] { "createdAt", "transitionId" });

            migrationBuilder.CreateIndex(
                name: "uqLifecycleTransitionsAggregateSequence",
                table: "lifecycletransitions",
                columns: new[] { "aggregateType", "aggregateId", "aggregateSequence" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "uqLifecycleTransitionsCommand",
                table: "lifecycletransitions",
                column: "commandId",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "lifecyclecommandreceipts");

            migrationBuilder.DropTable(
                name: "lifecycleoutboxmessages");

            migrationBuilder.DropTable(
                name: "lifecycletransitions");
        }
    }
}
