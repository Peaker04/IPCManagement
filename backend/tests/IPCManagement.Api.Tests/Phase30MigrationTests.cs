namespace IPCManagement.Api.Tests;

public sealed class Phase30MigrationTests
{
    [Fact]
    public void Closed_loop_lineage_migration_is_additive_discoverable_and_has_source_family_fences()
    {
        var root = FindRoot();
        var migration = Directory.GetFiles(
            Path.Combine(root, "backend", "src", "IPCManagement.Api", "Migrations"),
            "*ClosedLoopReconciliationIssueLineage.cs").Single();
        var designer = Path.ChangeExtension(migration, ".Designer.cs");
        var source = File.ReadAllText(migration);
        var metadata = File.ReadAllText(designer);

        Assert.Contains("reconciliationBatchId", source);
        Assert.Contains("reconciliationBatchLineId", source);
        Assert.Contains("ckInventoryIssuesSourceFamily", source);
        Assert.Contains("ckInventoryIssueLinesSourceFamily", source);
        Assert.Contains("ixInventoryIssuesReconciliationBatch", source);
        Assert.Contains("uxInventoryIssueLinesReconciliationBatchLine", source);
        Assert.Contains("inventoryissues_ibfk_5", source);
        Assert.Contains("inventoryissuelines_ibfk_5", source);
        Assert.DoesNotContain("UpdateData", source);
        Assert.DoesNotContain("DeleteData", source);
        Assert.DoesNotContain("USE ", source, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("CreateDatabase", source);
        Assert.DoesNotContain("DropDatabase", source);
        Assert.Contains("ClosedLoopReconciliationIssueLineage", metadata);
    }

    private static string FindRoot()
    {
        var directory = new DirectoryInfo(AppContext.BaseDirectory);
        while (directory is not null && !Directory.Exists(Path.Combine(directory.FullName, ".git")))
            directory = directory.Parent;
        return directory?.FullName ?? throw new DirectoryNotFoundException();
    }
}
