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
}
