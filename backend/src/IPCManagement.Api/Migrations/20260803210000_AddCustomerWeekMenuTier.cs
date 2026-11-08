using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace IPCManagement.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddCustomerWeekMenuTier : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "customerweekmenutiers",
                columns: table => new
                {
                    tierId = table.Column<byte[]>(type: "binary(16)", fixedLength: true, maxLength: 16, nullable: false),
                    customerId = table.Column<byte[]>(type: "binary(16)", fixedLength: true, maxLength: 16, nullable: false),
                    weekStartDate = table.Column<DateOnly>(type: "date", nullable: false),
                    priceTierAmount = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    createdAt = table.Column<DateTime>(type: "datetime", nullable: false, defaultValueSql: "CURRENT_TIMESTAMP")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PRIMARY", x => x.tierId);
                    table.UniqueConstraint("uqCustomerWeekMenuTiersScope", x => new { x.customerId, x.weekStartDate });
                    table.ForeignKey(
                        name: "customerweekmenutiers_ibfk_1",
                        column: x => x.customerId,
                        principalTable: "customers",
                        principalColumn: "customerId");
                })
                .Annotation("MySql:CharSet", "utf8mb4")
                .Annotation("Relational:Collation", "utf8mb4_unicode_ci");

            migrationBuilder.CreateIndex(
                name: "ixMenuSchedulesCustomerWeek",
                table: "menuschedules",
                columns: new[] { "customerId", "weekStartDate" });

            migrationBuilder.Sql(
                """
                INSERT INTO `customerweekmenutiers`
                    (`tierId`, `customerId`, `weekStartDate`, `priceTierAmount`, `createdAt`)
                SELECT
                    UNHEX(MD5(CONCAT(
                        HEX(`customerId`), '|',
                        DATE_FORMAT(`weekStartDate`, '%Y-%m-%d'), '|',
                        CAST(`menuPrice` AS CHAR)))),
                    `customerId`,
                    `weekStartDate`,
                    `menuPrice`,
                    UTC_TIMESTAMP()
                FROM `menuschedules`
                GROUP BY `customerId`, `weekStartDate`, `menuPrice`;
                """);

            migrationBuilder.AddForeignKey(
                name: "menuschedules_customerweek_tier_fk",
                table: "menuschedules",
                columns: new[] { "customerId", "weekStartDate" },
                principalTable: "customerweekmenutiers",
                principalColumns: new[] { "customerId", "weekStartDate" },
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.Sql(
                """
                CREATE TRIGGER `trg_menuschedules_tier_insert`
                BEFORE INSERT ON `menuschedules`
                FOR EACH ROW
                BEGIN
                    IF NOT EXISTS (
                        SELECT 1
                        FROM `customerweekmenutiers` AS tier
                        WHERE tier.`customerId` = NEW.`customerId`
                          AND tier.`weekStartDate` = NEW.`weekStartDate`
                          AND tier.`priceTierAmount` = NEW.`menuPrice`
                    ) THEN
                        SIGNAL SQLSTATE '45000'
                            SET MESSAGE_TEXT = 'Menu schedule price tier conflicts with the canonical customer/week tier.';
                    END IF;
                END
                """);

            migrationBuilder.Sql(
                """
                CREATE TRIGGER `trg_menuschedules_tier_update`
                BEFORE UPDATE ON `menuschedules`
                FOR EACH ROW
                BEGIN
                    IF NOT EXISTS (
                        SELECT 1
                        FROM `customerweekmenutiers` AS tier
                        WHERE tier.`customerId` = NEW.`customerId`
                          AND tier.`weekStartDate` = NEW.`weekStartDate`
                          AND tier.`priceTierAmount` = NEW.`menuPrice`
                    ) THEN
                        SIGNAL SQLSTATE '45000'
                            SET MESSAGE_TEXT = 'Menu schedule price tier conflicts with the canonical customer/week tier.';
                    END IF;
                END
                """);

            migrationBuilder.Sql(
                """
                CREATE TRIGGER `trg_customerweekmenutiers_immutable_update`
                BEFORE UPDATE ON `customerweekmenutiers`
                FOR EACH ROW
                BEGIN
                    IF OLD.`priceTierAmount` <> NEW.`priceTierAmount`
                       AND EXISTS (
                           SELECT 1
                           FROM `menuschedules` AS schedule
                           WHERE schedule.`customerId` = OLD.`customerId`
                             AND schedule.`weekStartDate` = OLD.`weekStartDate`
                       ) THEN
                        SIGNAL SQLSTATE '45000'
                            SET MESSAGE_TEXT = 'Cannot change a canonical customer/week tier while schedules exist.';
                    END IF;
                END
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("DROP TRIGGER IF EXISTS `trg_customerweekmenutiers_immutable_update`;");
            migrationBuilder.Sql("DROP TRIGGER IF EXISTS `trg_menuschedules_tier_update`;");
            migrationBuilder.Sql("DROP TRIGGER IF EXISTS `trg_menuschedules_tier_insert`;");

            migrationBuilder.DropForeignKey(
                name: "menuschedules_customerweek_tier_fk",
                table: "menuschedules");

            migrationBuilder.DropTable(
                name: "customerweekmenutiers");

            migrationBuilder.DropIndex(
                name: "ixMenuSchedulesCustomerWeek",
                table: "menuschedules");
        }
    }
}
