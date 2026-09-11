using IPCManagement.Api.Data;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace IPCManagement.Api.Migrations;

/// <summary>
/// Restores the historical migration ID as a lineage marker.
/// The maintained successor 20260706033326_AddMealQuantityPlanCompletedAndConcurrency
/// owns the completed-status schema and concurrency changes for fresh installations.
/// </summary>
[DbContext(typeof(IpcManagementContext))]
[Migration("20260705121500_AddCompletedMealQuantityPlanStatuses")]
public partial class AddCompletedMealQuantityPlanStatuses : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
    }
}
