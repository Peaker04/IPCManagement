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
    private static string FindRoot(){var d=new DirectoryInfo(AppContext.BaseDirectory);while(d!=null&&!Directory.Exists(Path.Combine(d.FullName,".git")))d=d.Parent;return d?.FullName??throw new DirectoryNotFoundException();}
}
