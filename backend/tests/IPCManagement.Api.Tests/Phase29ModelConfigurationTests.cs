using IPCManagement.Api.Data;
using IPCManagement.Api.Models.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata;

namespace IPCManagement.Api.Tests;

public sealed class Phase29ModelConfigurationTests
{
    private static IModel Model()
    {
        var options = new DbContextOptionsBuilder<IpcManagementContext>()
            .UseMySql("Server=localhost;Database=phase29_model;User=root;Password=unused", ServerVersion.Parse("8.0.36-mysql"))
            .Options;
        using var context = new IpcManagementContext(options);
        return context.Model;
    }

    [Fact]
    public void Maps_fixed_mode_singleton_and_frozen_batch_grain()
    {
        var model = Model();
        var mode = model.FindEntityType(typeof(SystemOperationMode))!;
        Assert.Equal("systemoperationmodes", mode.GetTableName());
        Assert.True(mode.FindProperty(nameof(SystemOperationMode.Version))!.IsConcurrencyToken);
        Assert.Contains(mode.GetCheckConstraints(), check => check.Sql!.Contains("DEFAULT") && check.Sql.Contains("MATERIAL_RECONCILIATION"));

        var line = model.FindEntityType(typeof(ReconciliationBatchLine))!;
        Assert.Equal(6, line.FindProperty(nameof(ReconciliationBatchLine.RequiredQuantity))!.GetPrecision());
        Assert.Contains(line.GetIndexes(), index => index.IsUnique && index.Properties.Select(p => p.Name).SequenceEqual([
            nameof(ReconciliationBatchLine.BatchId), nameof(ReconciliationBatchLine.IngredientId), nameof(ReconciliationBatchLine.CanonicalUnitId)]));

        var contributor = model.FindEntityType(typeof(ReconciliationBatchContributor))!;
        Assert.All(contributor.GetForeignKeys(), foreignKey => Assert.Equal(DeleteBehavior.Restrict, foreignKey.DeleteBehavior));
    }

    [Fact]
    public void Maps_tolerance_actual_revision_and_disposition_invariants()
    {
        var model = Model();
        var tolerance = model.FindEntityType(typeof(ReconciliationTolerance))!;
        Assert.Equal(6, tolerance.FindProperty(nameof(ReconciliationTolerance.Value))!.GetPrecision());

        var actual = model.FindEntityType(typeof(ReconciliationActual))!;
        Assert.True(actual.FindProperty(nameof(ReconciliationActual.Version))!.IsConcurrencyToken);
        Assert.Contains(actual.GetIndexes(), index => index.IsUnique && index.Properties.Select(p => p.Name).SequenceEqual([
            nameof(ReconciliationActual.BatchLineId), nameof(ReconciliationActual.Side)]));

        var revision = model.FindEntityType(typeof(ReconciliationActualRevision))!;
        Assert.Equal(ValueGenerated.Never, revision.FindProperty(nameof(ReconciliationActualRevision.RevisionId))!.ValueGenerated);

        var disposition = model.FindEntityType(typeof(ReconciliationDisposition))!;
        Assert.True(disposition.FindProperty(nameof(ReconciliationDisposition.Version))!.IsConcurrencyToken);
        Assert.Contains(disposition.GetIndexes(), index => index.IsUnique && index.Properties.Single().Name == nameof(ReconciliationDisposition.BatchLineId));
    }
}
