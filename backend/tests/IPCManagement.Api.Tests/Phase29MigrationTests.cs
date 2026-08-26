using Xunit;
namespace IPCManagement.Api.Tests;
public sealed class Phase29MigrationTests
{
    [Fact]
    public void Migration_is_schema_only_and_has_no_database_lane_commands()
    {
        var root = FindRoot(); var file = Directory.GetFiles(Path.Combine(root,"backend","src","IPCManagement.Api","Migrations"),"*AddSystemOperationModeAndReconciliation.cs").Single(); var sql=File.ReadAllText(file);
        Assert.DoesNotContain("USE ",sql,StringComparison.OrdinalIgnoreCase); Assert.DoesNotContain("CreateDatabase",sql); Assert.DoesNotContain("DropDatabase",sql); Assert.Contains("systemoperationmodes",sql); Assert.Contains("reconciliationbatches",sql);
    }

    [Fact]
    public void Quantity_import_authority_migration_is_additive_fail_closed_and_discoverable()
    {
        var root = FindRoot();
        var migration = Path.Combine(root, "backend", "src", "IPCManagement.Api", "Migrations", "20260826120000_AddQuantityImportCommitAuthority.cs");
        var designer = Path.Combine(root, "backend", "src", "IPCManagement.Api", "Migrations", "20260826120000_AddQuantityImportCommitAuthority.Designer.cs");
        var sql = File.ReadAllText(migration);
        var metadata = File.ReadAllText(designer);

        Assert.Contains("contentFingerprint", sql);
        Assert.Contains("fingerprintFormatVersion", sql);
        Assert.Contains("menuVersionId", sql);
        Assert.Contains("sourceLabel", sql);
        Assert.Contains("ux_quantityimportbatches_contentFingerprint", sql);
        Assert.Contains("quantityimportbatches_ibfk_2", sql);
        Assert.Contains("quantity_import_authority_rollback_guard", sql);
        Assert.Contains("SELECT NULL", sql);
        var rollbackGuard = sql[sql.IndexOf("CREATE TEMPORARY TABLE quantity_import_authority_rollback_guard", StringComparison.Ordinal)..sql.IndexOf("DROP TEMPORARY TABLE quantity_import_authority_rollback_guard", StringComparison.Ordinal)];
        Assert.All(new[] { "menuVersionId", "contentFingerprint", "fingerprintFormatVersion", "sourceLabel" }, column =>
            Assert.Contains($"q.{column} IS NOT NULL", rollbackGuard));
        Assert.DoesNotContain("UpdateData", sql);
        Assert.DoesNotContain("DeleteData", sql);
        Assert.DoesNotContain("USE ", sql, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("CreateDatabase", sql);
        Assert.DoesNotContain("DropDatabase", sql);
        Assert.Contains("20260826120000_AddQuantityImportCommitAuthority", metadata);
    }
    [Fact]
    public void Reconciliation_batch_import_uniqueness_migration_orders_replacement_indexes_and_uses_deterministic_guards()
    {
        var root = FindRoot();
        var migration = Path.Combine(root, "backend", "src", "IPCManagement.Api", "Migrations", "20260826130000_EnforceReconciliationBatchImportUniqueness.cs");
        var designer = Path.Combine(root, "backend", "src", "IPCManagement.Api", "Migrations", "20260826130000_EnforceReconciliationBatchImportUniqueness.Designer.cs");
        var source = File.ReadAllText(migration);
        var metadata = File.ReadAllText(designer);
        var up = source[source.IndexOf("protected override void Up", StringComparison.Ordinal)..source.IndexOf("protected override void Down", StringComparison.Ordinal)];
        var down = source[source.IndexOf("protected override void Down", StringComparison.Ordinal)..];

        Assert.True(up.IndexOf("CREATE TEMPORARY TABLE", StringComparison.Ordinal) < up.IndexOf("migrationBuilder.CreateIndex", StringComparison.Ordinal));
        Assert.True(up.IndexOf("migrationBuilder.CreateIndex", StringComparison.Ordinal) < up.IndexOf("migrationBuilder.DropIndex", StringComparison.Ordinal));
        Assert.True(down.IndexOf("migrationBuilder.CreateIndex", StringComparison.Ordinal) < down.IndexOf("migrationBuilder.DropIndex", StringComparison.Ordinal));
        Assert.Contains("PRIMARY KEY", up);
        Assert.Contains("WHERE EXISTS", up);
        Assert.Contains("GROUP BY QuantityImportBatchId", up);
        Assert.Contains("HAVING COUNT(*) > 1", up);
        Assert.Equal(2, Count(up, "INSERT INTO reconciliation_batch_import_uniqueness_guard"));
        Assert.Contains("PRIMARY KEY", down);
        Assert.Contains("WHERE EXISTS", down);
        Assert.Equal(2, Count(down, "INSERT INTO reconciliation_batch_import_uniqueness_rollback_guard"));
        Assert.DoesNotContain("SELECT NULL", source);
        Assert.DoesNotContain("DeleteData", source);
        Assert.DoesNotContain("UpdateData", source);
        Assert.DoesNotContain("USE ", source, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("20260826130000_EnforceReconciliationBatchImportUniqueness", metadata);
    }

    private static int Count(string source, string value) =>
        source.Split(value, StringSplitOptions.None).Length - 1;

    private static string FindRoot(){var d=new DirectoryInfo(AppContext.BaseDirectory);while(d!=null&&!Directory.Exists(Path.Combine(d.FullName,".git")))d=d.Parent;return d?.FullName??throw new DirectoryNotFoundException();}
}
