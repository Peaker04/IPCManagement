using IPCManagement.Api.Data;
using IPCManagement.Api.Models.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Metadata;

namespace IPCManagement.Api.Tests;

public sealed class ReconciliationSupplementalDemandModelTests
{
    [Fact]
    public void Supplemental_model_preserves_additive_lineage_precision_and_concurrency_without_inventing_legacy_allocations()
    {
        using var db = new IpcManagementContext(new DbContextOptionsBuilder<IpcManagementContext>()
            .UseMySql("Server=127.0.0.1;Database=model_only;User=none", new MySqlServerVersion(new Version(8, 0, 36))).Options);
        var model = db.GetService<IDesignTimeModel>().Model;
        var demand = model.FindEntityType(typeof(ReconciliationSupplementalDemand))!;
        Assert.True(demand.FindProperty(nameof(ReconciliationSupplementalDemand.Version))!.IsConcurrencyToken);
        Assert.Contains(demand.GetForeignKeys(), fk => fk.PrincipalEntityType.ClrType == typeof(ReconciliationBatch));
        var material = model.FindEntityType(typeof(ReconciliationSupplementalDemandMaterial))!;
        Assert.Equal(6, material.FindProperty(nameof(ReconciliationSupplementalDemandMaterial.RequiredQuantity))!.GetScale());
        Assert.Contains(material.GetForeignKeys(), fk => fk.PrincipalEntityType.ClrType == typeof(ReconciliationBatchDailyLine));
        Assert.Contains(material.GetIndexes(), index => index.IsUnique && index.Properties.Select(property => property.Name)
            .SequenceEqual(new[] { "DemandId", "DailyLineId" }));
        var contribution = model.FindEntityType(typeof(ReconciliationSupplementalDemandContribution))!;
        Assert.Equal(24, contribution.FindProperty("CanonicalQuantityPerServing")!.GetScale());
        Assert.Contains(contribution.GetForeignKeys(), fk => fk.PrincipalEntityType.ClrType == typeof(ReconciliationSupplementalDemandDish));
        var allocation = model.FindEntityType(typeof(ReconciliationIssueAllocation))!;
        Assert.True(allocation.FindProperty("DemandMaterialId")!.IsNullable);
        Assert.Contains(allocation.GetForeignKeys(), fk => fk.PrincipalEntityType.ClrType == typeof(InventoryIssueLine));
        Assert.Contains(allocation.GetForeignKeys(), fk => fk.PrincipalEntityType.ClrType == typeof(ReconciliationBatchDailyLine));
        Assert.Contains(allocation.GetCheckConstraints(), constraint => constraint.Name == "ckMrxIssueAllocationPurpose");
        Assert.All(new[] { demand, material, contribution, allocation }, entity =>
            Assert.All(entity.GetForeignKeys(), fk => Assert.Equal(DeleteBehavior.Restrict, fk.DeleteBehavior)));
    }
}
