using FluentAssertions;

namespace IPCManagement.Api.Tests;

public sealed class BusinessEvidenceClosureCommandTests
{
    [Fact]
    public void DatabaseTool_DoesNotExposeSupersededBusinessEvidenceClose()
    {
        var root = FindWorkspaceRoot();
        var commandPath = Path.Combine(
            root, "backend/tools/IPCManagement.DatabaseTool/BusinessEvidenceClosureCommand.cs");
        var programSource = File.ReadAllText(Path.Combine(
            root, "backend/tools/IPCManagement.DatabaseTool/Program.cs"));

        File.Exists(commandPath).Should().BeFalse();
        programSource.Contains("business-evidence-close", StringComparison.Ordinal).Should().BeFalse();
        programSource.Contains("BusinessEvidenceClosureCommand", StringComparison.Ordinal).Should().BeFalse();
    }

    private static string FindWorkspaceRoot()
    {
        for (var directory = new DirectoryInfo(AppContext.BaseDirectory);
             directory is not null;
             directory = directory.Parent)
        {
            if (File.Exists(Path.Combine(directory.FullName, "package.json")))
                return directory.FullName;
        }

        throw new DirectoryNotFoundException("Workspace root not found.");
    }
}
