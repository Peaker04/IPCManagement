using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace IPCManagement.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddRefreshTokenTable : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "refreshtokens",
                columns: table => new
                {
                    tokenId = table.Column<byte[]>(type: "binary(16)", fixedLength: true, maxLength: 16, nullable: false),
                    userId = table.Column<byte[]>(type: "binary(16)", fixedLength: true, maxLength: 16, nullable: false),
                    tokenHash = table.Column<string>(type: "char(64)", fixedLength: true, maxLength: 64, nullable: false, collation: "utf8mb4_unicode_ci")
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    deviceInfo = table.Column<string>(type: "varchar(200)", maxLength: 200, nullable: false, defaultValue: "", collation: "utf8mb4_unicode_ci")
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    createdAt = table.Column<DateTime>(type: "datetime", nullable: false, defaultValueSql: "CURRENT_TIMESTAMP"),
                    expiresAt = table.Column<DateTime>(type: "datetime", nullable: false),
                    isUsed = table.Column<bool>(type: "tinyint(1)", nullable: false, defaultValue: false),
                    isRevoked = table.Column<bool>(type: "tinyint(1)", nullable: false, defaultValue: false),
                    revokedAt = table.Column<DateTime>(type: "datetime", nullable: true),
                    replacedByToken = table.Column<string>(type: "varchar(64)", maxLength: 64, nullable: true, collation: "utf8mb4_unicode_ci")
                        .Annotation("MySql:CharSet", "utf8mb4")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PRIMARY", x => x.tokenId);
                    table.ForeignKey(
                        name: "refreshtokens_ibfk_1",
                        column: x => x.userId,
                        principalTable: "users",
                        principalColumn: "userId",
                        onDelete: ReferentialAction.Cascade);
                })
                .Annotation("MySql:CharSet", "utf8mb4")
                .Annotation("Relational:Collation", "utf8mb4_unicode_ci");

            migrationBuilder.CreateIndex(
                name: "ixRefreshTokensHash",
                table: "refreshtokens",
                column: "tokenHash",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ixRefreshTokensUserExpiry",
                table: "refreshtokens",
                columns: new[] { "userId", "expiresAt" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "refreshtokens");
        }
    }
}
