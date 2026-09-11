using IPCManagement.Api.Data;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace IPCManagement.Api.Migrations;

/// <summary>
/// Restores the canonical migration ID without restoring its retired demo-data side effects.
/// The original migration inserted TMP-BOM sample rows only and made no schema changes.
/// Fresh installations use the maintained catalog/import paths instead of historical sample data.
/// </summary>
[DbContext(typeof(IpcManagementContext))]
[Migration("20260626043000_SeedTemporaryBomData")]
public partial class SeedTemporaryBomData : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
    }
}
