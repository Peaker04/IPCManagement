using IPCManagement.Api.Data;
using IPCManagement.Api.Models.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Metadata;

namespace IPCManagement.Api.Tests;

public sealed class MrxDirectSourceEditModelTests
{
    private static IModel Model()
    {
        var options = new DbContextOptionsBuilder<IpcManagementContext>()
            .UseMySql("Server=localhost;Database=mrx_direct_edit_model;User=root;Password=unused", ServerVersion.Parse("8.0.36-mysql"))
            .Options;
        using var context = new IpcManagementContext(options);
        return context.GetService<IDesignTimeModel>().Model;
    }

    [Fact]
    public void Model_exposes_mrx_direct_edit_columns_and_issue_date_index()
    {
        var model = Model();

        var planLine = model.FindEntityType(typeof(MealQuantityPlanLine))!;
        foreach (var name in new[] { nameof(MealQuantityPlanLine.SavoryServings), nameof(MealQuantityPlanLine.VegetarianServings) })
        {
            var property = planLine.FindProperty(name)!;
            Assert.True(property.IsNullable);
            Assert.Equal(typeof(int?), property.ClrType);
        }

        var contributorVariant = model.FindEntityType(typeof(ReconciliationBatchContributor))!
            .FindProperty(nameof(ReconciliationBatchContributor.FrozenMenuVariant))!;
        Assert.True(contributorVariant.IsNullable);
        Assert.Equal(16, contributorVariant.GetMaxLength());

        var revision = model.FindEntityType(typeof(ReconciliationSourceRevision))!;
        var role = revision.FindProperty(nameof(ReconciliationSourceRevision.AppliedByRole))!;
        Assert.True(role.IsNullable);
        Assert.Equal(32, role.GetMaxLength());
        var mode = revision.FindProperty(nameof(ReconciliationSourceRevision.ApplyMode))!;
        Assert.True(mode.IsNullable);
        Assert.Equal(24, mode.GetMaxLength());

        var issue = model.FindEntityType(typeof(InventoryIssue))!;
        var index = Assert.Single(issue.GetIndexes(), i => i.GetDatabaseName() == "ix_inventoryissues_reconciliationBatchId_issueDate");
        Assert.Equal(
            [nameof(InventoryIssue.ReconciliationBatchId), nameof(InventoryIssue.IssueDate)],
            index.Properties.Select(p => p.Name));
    }
}
