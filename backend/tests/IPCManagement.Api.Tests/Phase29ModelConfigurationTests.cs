using IPCManagement.Api.Data;
using IPCManagement.Api.Features.Reconciliation.Controllers;
using IPCManagement.Api.Models.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata;
using Microsoft.EntityFrameworkCore.Metadata.Internal;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.AspNetCore.Authorization;
using IPCManagement.Api.Security;

namespace IPCManagement.Api.Tests;

public sealed class Phase29ModelConfigurationTests
{
    private static IModel Model()
    {
        var options = new DbContextOptionsBuilder<IpcManagementContext>()
            .UseMySql("Server=localhost;Database=phase29_model;User=root;Password=unused", ServerVersion.Parse("8.0.36-mysql"))
            .Options;
        using var context = new IpcManagementContext(options);
        return context.GetService<IDesignTimeModel>().Model;
    }

    [Fact]
    public void Maps_fixed_mode_singleton_and_frozen_batch_grain()
    {
        var model = Model();
        var mode = model.FindEntityType(typeof(SystemOperationMode))!;
        Assert.Equal("systemoperationmodes", mode.GetTableName());
        Assert.True(mode.FindProperty(nameof(SystemOperationMode.Version))!.IsConcurrencyToken);
        Assert.Contains(mode.GetCheckConstraints(), check => check.Sql!.Contains("DEFAULT") && check.Sql.Contains("MATERIAL_RECONCILIATION"));

        var batch = model.FindEntityType(typeof(ReconciliationBatch))!;
        var importIndex = Assert.Single(batch.GetIndexes(), index =>
            index.Properties.Select(property => property.Name).SequenceEqual([nameof(ReconciliationBatch.QuantityImportBatchId)]));
        Assert.True(importIndex.IsUnique);
        Assert.Equal("ux_reconciliationbatches_quantityImportBatchId", importIndex.GetDatabaseName());

        var line = model.FindEntityType(typeof(ReconciliationBatchLine))!;
        Assert.Equal(18, line.FindProperty(nameof(ReconciliationBatchLine.RequiredQuantity))!.GetPrecision());
        Assert.Equal(6, line.FindProperty(nameof(ReconciliationBatchLine.RequiredQuantity))!.GetScale());
        Assert.Contains(line.GetIndexes(), index => index.IsUnique && index.Properties.Select(p => p.Name).SequenceEqual([
            nameof(ReconciliationBatchLine.BatchId), nameof(ReconciliationBatchLine.IngredientId), nameof(ReconciliationBatchLine.CanonicalUnitId)]));

        var contributor = model.FindEntityType(typeof(ReconciliationBatchContributor))!;
        Assert.All(contributor.GetForeignKeys(), foreignKey => Assert.Equal(DeleteBehavior.Restrict, foreignKey.DeleteBehavior));
    }

    [Fact]
    public void Tolerance_initializer_endpoint_is_admin_only()
    {
        var authorization = typeof(ReconciliationConfigurationController)
            .GetCustomAttributes(typeof(AuthorizeAttribute), inherit: true)
            .Cast<AuthorizeAttribute>()
            .Single();

        Assert.Equal(AuthorizationPolicies.AdminAccess, authorization.Policy);
    }

    [Fact]
    public void Maps_tolerance_actual_revision_and_disposition_invariants()
    {
        var model = Model();
        var tolerance = model.FindEntityType(typeof(ReconciliationTolerance))!;
        Assert.Equal(18, tolerance.FindProperty(nameof(ReconciliationTolerance.Value))!.GetPrecision());
        Assert.Equal(6, tolerance.FindProperty(nameof(ReconciliationTolerance.Value))!.GetScale());
        Assert.Contains(tolerance.GetCheckConstraints(), check => check.Name == "ckReconciliationToleranceScope" && check.Sql!.Contains("SYSTEM_DEFAULT"));
        Assert.Contains(tolerance.GetCheckConstraints(), check => check.Name == "ckReconciliationToleranceValue" && check.Sql!.Contains(">= 0"));
        Assert.Contains(tolerance.GetIndexes(), index => index.IsUnique && index.Properties.Single().Name == nameof(ReconciliationTolerance.SystemDefaultKey));

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
