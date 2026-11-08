using System;
using IPCManagement.Api.Data;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace IPCManagement.Api.Migrations;

[DbContext(typeof(IpcManagementContext))]
[Migration("20260808160000_EnforceMenuAmendmentSeparation")]
public partial class EnforceMenuAmendmentSeparation : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.AddColumn<byte[]>(
            name: "reviewedBy",
            table: "menuamendments",
            type: "binary(16)",
            fixedLength: true,
            maxLength: 16,
            nullable: true);
        migrationBuilder.AddColumn<DateTime>(
            name: "reviewedAt",
            table: "menuamendments",
            type: "datetime",
            nullable: true);
        migrationBuilder.AddColumn<byte[]>(
            name: "executedBy",
            table: "menuamendments",
            type: "binary(16)",
            fixedLength: true,
            maxLength: 16,
            nullable: true);
        migrationBuilder.AddColumn<DateTime>(
            name: "executedAt",
            table: "menuamendments",
            type: "datetime",
            nullable: true);

        migrationBuilder.CreateIndex(name: "IX_menuamendments_reviewedBy", table: "menuamendments", column: "reviewedBy");
        migrationBuilder.CreateIndex(name: "IX_menuamendments_executedBy", table: "menuamendments", column: "executedBy");
        migrationBuilder.AddForeignKey(name: "FK_menuamendments_users_reviewedBy", table: "menuamendments", column: "reviewedBy", principalTable: "users", principalColumn: "userId", onDelete: ReferentialAction.Restrict);
        migrationBuilder.AddForeignKey(name: "FK_menuamendments_users_executedBy", table: "menuamendments", column: "executedBy", principalTable: "users", principalColumn: "userId", onDelete: ReferentialAction.Restrict);
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropForeignKey(name: "FK_menuamendments_users_reviewedBy", table: "menuamendments");
        migrationBuilder.DropForeignKey(name: "FK_menuamendments_users_executedBy", table: "menuamendments");
        migrationBuilder.DropIndex(name: "IX_menuamendments_reviewedBy", table: "menuamendments");
        migrationBuilder.DropIndex(name: "IX_menuamendments_executedBy", table: "menuamendments");
        migrationBuilder.DropColumn(name: "reviewedBy", table: "menuamendments");
        migrationBuilder.DropColumn(name: "reviewedAt", table: "menuamendments");
        migrationBuilder.DropColumn(name: "executedBy", table: "menuamendments");
        migrationBuilder.DropColumn(name: "executedAt", table: "menuamendments");
    }
}
