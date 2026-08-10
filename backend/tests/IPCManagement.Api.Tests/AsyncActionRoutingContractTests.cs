using System.Text.RegularExpressions;

namespace IPCManagement.Api.Tests;

public sealed class AsyncActionRoutingContractTests
{
    [Fact]
    public void CreatedAtAction_ShouldUsePublishedMvcActionNameWithoutAsyncSuffix()
    {
        var sourceRoot = FindApiSourceRoot();
        var invalidPattern = new Regex(
            @"CreatedAtAction\s*\(\s*nameof\s*\([^)]*Async\s*\)",
            RegexOptions.CultureInvariant);

        var offenders = Directory.EnumerateFiles(sourceRoot, "*Controller.cs", SearchOption.AllDirectories)
            .Where(path => invalidPattern.IsMatch(File.ReadAllText(path)))
            .Select(path => Path.GetRelativePath(sourceRoot, path))
            .ToArray();

        Assert.Empty(offenders);
    }

    private static string FindApiSourceRoot()
    {
        foreach (var startPath in new[] { Directory.GetCurrentDirectory(), AppContext.BaseDirectory })
        {
            for (var directory = new DirectoryInfo(startPath); directory is not null; directory = directory.Parent)
            {
                foreach (var relativePath in new[]
                         {
                             Path.Combine("backend", "src", "IPCManagement.Api"),
                             Path.Combine("src", "IPCManagement.Api"),
                         })
                {
                    var candidate = Path.Combine(directory.FullName, relativePath);
                    if (Directory.Exists(candidate))
                        return candidate;
                }
            }
        }

        throw new DirectoryNotFoundException(
            "Could not locate backend/src/IPCManagement.Api or src/IPCManagement.Api from the current or test output directory.");
    }
}
