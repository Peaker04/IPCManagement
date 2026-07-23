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
}
