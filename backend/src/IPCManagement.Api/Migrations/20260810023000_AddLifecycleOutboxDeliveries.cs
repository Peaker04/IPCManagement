using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace IPCManagement.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddLifecycleOutboxDeliveries : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "lifecycleoutboxdeliveries",
                columns: table => new
                {
                    deliveryId = table.Column<byte[]>(type: "binary(16)", fixedLength: true, maxLength: 16, nullable: false),
                    outboxMessageId = table.Column<byte[]>(type: "binary(16)", fixedLength: true, maxLength: 16, nullable: false),
                    consumerName = table.Column<string>(type: "varchar(120)", maxLength: 120, nullable: false, collation: "utf8mb4_unicode_ci")
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    processedAt = table.Column<DateTime>(type: "datetime", nullable: false, defaultValueSql: "CURRENT_TIMESTAMP")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PRIMARY", x => x.deliveryId);
                    table.ForeignKey(
                        name: "fkLifecycleOutboxDeliveriesMessage",
                        column: x => x.outboxMessageId,
                        principalTable: "lifecycleoutboxmessages",
                        principalColumn: "outboxMessageId",
                        onDelete: ReferentialAction.Restrict);
                })
                .Annotation("MySql:CharSet", "utf8mb4")
                .Annotation("Relational:Collation", "utf8mb4_unicode_ci");

            migrationBuilder.CreateIndex(
                name: "uqLifecycleOutboxDeliveriesMessageConsumer",
                table: "lifecycleoutboxdeliveries",
                columns: new[] { "outboxMessageId", "consumerName" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "lifecycleoutboxdeliveries");
        }
    }
}
