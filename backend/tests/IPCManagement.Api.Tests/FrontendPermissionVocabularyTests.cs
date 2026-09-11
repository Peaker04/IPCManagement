using System.Text.RegularExpressions;
using FluentAssertions;
using IPCManagement.Api.Security;

namespace IPCManagement.Api.Tests;

public sealed class FrontendPermissionVocabularyTests
{
    private static readonly Regex StringLiteralRegex = new(
        @"'(?<single>[^']*)'|""(?<double>[^""]*)""",
        RegexOptions.Compiled);

    [Fact]
    public void Frontend_permission_literals_must_exist_in_backend_generated_vocabulary()
    {
        var workspaceRoot = FindWorkspaceRoot();
        var backendVocabulary = AuthorizationPolicies.AllPermissions
            .ToHashSet(StringComparer.Ordinal);

        backendVocabulary.UnionWith(ReadAdminGeneratedPermissionLiterals(workspaceRoot));

        var usages = EnumerateFrontendPermissionUsages(workspaceRoot).ToList();
        usages.Should().NotBeEmpty("the guard, fixture and test source must be inspected");

        var unknown = usages
            .Where(usage => !backendVocabulary.Contains(usage.Value))
            .GroupBy(usage => usage.Value, StringComparer.Ordinal)
            .OrderBy(group => group.Key, StringComparer.Ordinal)
            .Select(group => $"{group.Key}: {string.Join(", ", group.Select(usage => $"{usage.RelativePath}:{usage.Line}").Distinct())}")
            .ToArray();

        unknown.Should().BeEmpty(
            "every frontend permission literal, including dev fixtures and tests, must come from the backend vocabulary. Unknown: {0}",
            string.Join(" | ", unknown));
    }

    private static IEnumerable<string> ReadAdminGeneratedPermissionLiterals(string workspaceRoot)
    {
        var source = File.ReadAllText(Path.Combine(
            workspaceRoot,
            "backend",
            "src",
            "IPCManagement.Api",
            "Features",
            "Auth",
            "Services",
            "AuthService.cs"));

        const string methodMarker = "private static List<string> BuildPermissionsForRole";
        const string nextMethodMarker = "private static void AddPermissionIfMatches";
        var methodStart = source.IndexOf(methodMarker, StringComparison.Ordinal);
        var methodEnd = source.IndexOf(nextMethodMarker, methodStart, StringComparison.Ordinal);

        methodStart.Should().BeGreaterThanOrEqualTo(0, "the login permission builder must remain discoverable");
        methodEnd.Should().BeGreaterThan(methodStart, "the login permission builder boundary must remain discoverable");

        var methodSource = source[methodStart..methodEnd];
        return Regex.Matches(methodSource, @"return\s+\[(?<values>[^\]]*)\]", RegexOptions.Singleline)
            .SelectMany(match => ExtractStringLiterals(match.Groups["values"].Value))
            .ToArray();
    }

    private static IEnumerable<PermissionUsage> EnumerateFrontendPermissionUsages(string workspaceRoot)
    {
        var roots = new[]
        {
            Path.Combine(workspaceRoot, "frontend", "src"),
            Path.Combine(workspaceRoot, "frontend", "tests")
        };

        foreach (var root in roots)
        {
            foreach (var file in Directory.EnumerateFiles(root, "*.*", SearchOption.AllDirectories)
                         .Where(path => path.EndsWith(".ts", StringComparison.OrdinalIgnoreCase)
                                     || path.EndsWith(".tsx", StringComparison.OrdinalIgnoreCase)))
            {
                var source = File.ReadAllText(file);
                var relativePath = Path.GetRelativePath(workspaceRoot, file).Replace('\\', '/');

                foreach (Match match in Regex.Matches(
                             source,
                             @"requiredPermissions\s*(?::|=)\s*\{?\s*\[(?<values>.*?)\]",
                             RegexOptions.Singleline))
                {
                    foreach (var usage in ExtractPermissionUsages(source, relativePath, match))
                    {
                        yield return usage;
                    }
                }

                foreach (Match match in Regex.Matches(
                             source,
                             @"permissions\s*:\s*\[(?<values>.*?)\]",
                             RegexOptions.Singleline))
                {
                    foreach (var usage in ExtractPermissionUsages(source, relativePath, match))
                    {
                        yield return usage;
                    }
                }

                foreach (Match match in Regex.Matches(
                             source,
                             @"\b(?:const|let|var)\s+\w*PERMISSIONS\w*\s*=\s*(?<values>[\s\S]*?)(?:\bas const\b|;)",
                             RegexOptions.Singleline))
                {
                    foreach (var usage in ExtractPermissionUsages(source, relativePath, match))
                    {
                        yield return usage;
                    }
                }

                foreach (Match match in Regex.Matches(
                             source,
                             @"useHasPermission\s*\(\s*(?<value>'[^']*'|""[^""]*"")",
                             RegexOptions.Singleline))
                {
                    var value = ExtractStringLiterals(match.Groups["value"].Value).Single();
                    yield return new PermissionUsage(value, relativePath, GetLineNumber(source, match.Index));
                }

                foreach (Match match in Regex.Matches(
                             source,
                             @"(?:permissions|requiredPermissions)\s*\.\s*includes\s*\(\s*(?<value>'[^']*'|""[^""]*"")",
                             RegexOptions.Singleline))
                {
                    var value = ExtractStringLiterals(match.Groups["value"].Value).Single();
                    yield return new PermissionUsage(value, relativePath, GetLineNumber(source, match.Index));
                }
            }
        }
    }

    private static IEnumerable<PermissionUsage> ExtractPermissionUsages(
        string source,
        string relativePath,
        Match match)
    {
        foreach (Match literal in StringLiteralRegex.Matches(match.Groups["values"].Value))
        {
            var value = literal.Groups["single"].Success
                ? literal.Groups["single"].Value
                : literal.Groups["double"].Value;

            yield return new PermissionUsage(
                value,
                relativePath,
                GetLineNumber(source, match.Groups["values"].Index + literal.Index));
        }
    }

    private static IEnumerable<string> ExtractStringLiterals(string source)
        => StringLiteralRegex.Matches(source)
            .Select(literal => literal.Groups["single"].Success
                ? literal.Groups["single"].Value
                : literal.Groups["double"].Value);

    private static int GetLineNumber(string source, int index)
        => source[..index].Count(character => character == '\n') + 1;

    private static string FindWorkspaceRoot()
    {
        var directory = new DirectoryInfo(AppContext.BaseDirectory);
        while (directory is not null && !File.Exists(Path.Combine(directory.FullName, "package.json")))
        {
            directory = directory.Parent;
        }

        return directory?.FullName
            ?? throw new InvalidOperationException("Không tìm thấy workspace root cho permission vocabulary check.");
    }

    private sealed record PermissionUsage(string Value, string RelativePath, int Line);
}
