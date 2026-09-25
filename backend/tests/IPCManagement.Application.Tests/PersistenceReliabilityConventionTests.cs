namespace IPCManagement.Application.Tests;

public sealed class PersistenceReliabilityConventionTests
{
    [Fact]
    public void ManualTransactions_Should_BeOwnedByEfTransactionRunner()
    {
        var apiSourceRoot = FindApiSourceRoot();
        var transactionOpeners = Directory
            .EnumerateFiles(apiSourceRoot, "*.cs", SearchOption.AllDirectories)
            .Where(file => !file.Contains(
                $"{Path.DirectorySeparatorChar}Migrations{Path.DirectorySeparatorChar}",
                StringComparison.Ordinal))
            .SelectMany(file => File.ReadLines(file)
                .Select((line, index) => new
                {
                    File = file,
                    Line = line,
                    LineNumber = index + 1,
                }))
            .Where(item => item.Line.Contains("BeginTransactionAsync(", StringComparison.Ordinal))
            .Select(item => $"{Path.GetRelativePath(apiSourceRoot, item.File).Replace('\\', '/')}:{item.LineNumber}")
            .OrderBy(item => item, StringComparer.Ordinal)
            .ToArray();

        var transactionOpener = Assert.Single(transactionOpeners);
        Assert.StartsWith("Data/Transactions/EfTransactionRunner.cs:", transactionOpener, StringComparison.Ordinal);
    }

    [Fact]
    public void MySqlProvider_Should_EnableTransientRetry()
    {
        var dependencyInjectionSource = File.ReadAllText(
            Path.Combine(FindApiSourceRoot(), "DependencyInjection.cs"));

        Assert.Contains(".EnableRetryOnFailure()", dependencyInjectionSource, StringComparison.Ordinal);
    }

    private static string FindApiSourceRoot()
    {
        foreach (var start in new[] { Directory.GetCurrentDirectory(), AppContext.BaseDirectory })
        for (var directory = new DirectoryInfo(start); directory is not null; directory = directory.Parent)
        {
            foreach (var candidate in new[]
            {
                Path.Combine(directory.FullName, "src", "IPCManagement.Api"),
                Path.Combine(directory.FullName, "backend", "src", "IPCManagement.Api")
            })
            {
                if (Directory.Exists(candidate))
                {
                    return candidate;
                }
            }
        }

        throw new DirectoryNotFoundException("Could not locate src/IPCManagement.Api from the test output directory.");
    }
}
