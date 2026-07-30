using System.Text.RegularExpressions;

namespace IPCManagement.Api.Tests;

public sealed class AsyncActionRoutingContractTests
{
    [Fact]
    public void CreatedAtAction_ShouldUsePublishedMvcActionNameWithoutAsyncSuffix()
    {
        var sourceRoot = Path.GetFullPath(Path.Combine(
            AppContext.BaseDirectory,
            "..", "..", "..", "..", "..",
            "src", "IPCManagement.Api"));
        var invalidPattern = new Regex(
            @"CreatedAtAction\s*\(\s*nameof\s*\([^)]*Async\s*\)",
            RegexOptions.CultureInvariant);

        var offenders = Directory.EnumerateFiles(sourceRoot, "*Controller.cs", SearchOption.AllDirectories)
            .Where(path => invalidPattern.IsMatch(File.ReadAllText(path)))
            .Select(path => Path.GetRelativePath(sourceRoot, path))
            .ToArray();

        Assert.Empty(offenders);
    }
}
