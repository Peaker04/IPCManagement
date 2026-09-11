using FluentAssertions;
using IPCManagement.DatabaseTool;

namespace IPCManagement.Api.Tests;

public class DatabaseClonePolicyTests
{
    [Theory]
    [InlineData("ipc_lane1", "ipc_e2e_template")]
    [InlineData("ipc_e2e_template", "ipc_lane9")]
    public void ValidateTransition_ShouldAllowLaneAndTemplateOnly(string source, string target)
    {
        var action = () => DatabaseClonePolicy.ValidateTransition(source, target);

        action.Should().NotThrow();
    }

    [Theory]
    [InlineData("mysql", "ipc_e2e_template")]
    [InlineData("ipc_lane1", "ipc_lane2")]
    [InlineData("ipc_e2e_template", "ipc_e2e_template")]
    [InlineData("ipc_lane0", "ipc_e2e_template")]
    [InlineData("ipc_lane1; DROP DATABASE mysql", "ipc_e2e_template")]
    public void ValidateTransition_ShouldRejectUnsafeDatabaseTargets(string source, string target)
    {
        var action = () => DatabaseClonePolicy.ValidateTransition(source, target);

        action.Should().Throw<ArgumentException>();
    }

    [Theory]
    [InlineData("ipc_lane1")]
    [InlineData("ipc_lane9")]
    public void ValidateSanitizeTarget_ShouldAllowDisposableLanes(string database)
    {
        var action = () => DatabaseClonePolicy.ValidateSanitizeTarget(database);

        action.Should().NotThrow();
    }

    [Theory]
    [InlineData("ipcmanagement")]
    [InlineData("ipc_e2e_template")]
    [InlineData("ipc_lane0")]
    [InlineData("ipc_lane1; DROP DATABASE mysql")]
    public void ValidateSanitizeTarget_ShouldRejectPrimaryTemplateAndUnsafeNames(string database)
    {
        var action = () => DatabaseClonePolicy.ValidateSanitizeTarget(database);

        action.Should().Throw<ArgumentException>();
    }

    [Theory]
    [InlineData("ipc_lane1")]
    [InlineData("ipc_lane9")]
    [InlineData("ipc_e2e_template")]
    public void ValidateEvidenceTarget_ShouldAllowOnlyIpcEvidenceDatabases(string database)
    {
        var action = () => DatabaseClonePolicy.ValidateEvidenceTarget(database);

        action.Should().NotThrow();
    }

    [Theory]
    [InlineData("mysql")]
    [InlineData("ipc_lane0")]
    [InlineData("ipc_lane1; DROP DATABASE mysql")]
    public void ValidateEvidenceTarget_ShouldRejectUnsafeNames(string database)
    {
        var action = () => DatabaseClonePolicy.ValidateEvidenceTarget(database);

        action.Should().Throw<ArgumentException>();
    }

    [Fact]
    public void ValidateRemediationEvidenceTarget_ShouldAllowLane9AndBaseOnly()
    {
        foreach (var allowed in new[] { "ipc_lane9", "ipcmanagement" })
        {
            var action = () => DatabaseClonePolicy.ValidateRemediationEvidenceTarget(allowed);
            action.Should().NotThrow();
        }

        foreach (var rejected in new[] { "ipc_lane1", "ipc_e2e_template", "ipc_lane9; DROP DATABASE mysql" })
        {
            var action = () => DatabaseClonePolicy.ValidateRemediationEvidenceTarget(rejected);
            action.Should().Throw<ArgumentException>();
        }
    }

    [Fact]
    public void TransactionTables_ShouldIncludeSupplierDecisionsBeforePurchaseRequestLines()
    {
        var tables = DatabaseSanitizePolicy.TransactionTables;
        var orderedTables = tables.ToList();

        tables.Should().Contain("purchaselinesupplierdecisions");
        orderedTables.IndexOf("purchaselinesupplierdecisions")
            .Should().BeLessThan(orderedTables.IndexOf("purchaserequestlines"));
        tables.Should().OnlyHaveUniqueItems();
    }

    [Fact]
    public void Clone_implementation_should_preserve_table_definitions_and_triggers()
    {
        var source = File.ReadAllText(FindRepositoryFile(
            "backend", "tools", "IPCManagement.DatabaseTool", "Program.cs"));

        source.Should().Contain("SHOW CREATE TABLE");
        source.Should().Contain("information_schema.triggers");
        source.Should().Contain("VerifyRequiredSchemaObjectsAsync");
        source.Should().Contain("Table definition mismatch");
        source.Should().NotContain("CREATE TABLE {targetTable} LIKE {sourceTable}");
    }

    [Fact]
    public void Legacy_receipt_reconciliation_should_require_complete_physical_movement_evidence()
    {
        var source = File.ReadAllText(FindRepositoryFile(
            "backend", "src", "IPCManagement.Api", "Migrations",
            "20260810011000_ReconcileLegacyReceiptLifecycle.cs"));

        source.Should().Contain("movement.`refTable` = 'inventoryreceiptlines'");
        source.Should().Contain("ABS(movement.`quantityIn` - line.`quantity`) <= 0.000001");
        source.Should().Contain("COUNT(DISTINCT movement.`performedBy`) = 1");
        source.Should().Contain("LEGACY_PRE_LIFECYCLE_NO_MANAGER_EVIDENCE");
        source.Should().NotContain("managerApprovedBy` =");
        source.Should().NotContain("managerApprovedAt` =");
    }

    private static string FindRepositoryFile(params string[] segments)
    {
        var directory = new DirectoryInfo(AppContext.BaseDirectory);
        while (directory is not null && !File.Exists(Path.Combine(directory.FullName, "package.json")))
        {
            directory = directory.Parent;
        }

        return Path.Combine(
            directory?.FullName ?? throw new InvalidOperationException("Workspace root not found."),
            Path.Combine(segments));
    }
}
