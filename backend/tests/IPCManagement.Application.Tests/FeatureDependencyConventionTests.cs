using System.Text.RegularExpressions;

namespace IPCManagement.Application.Tests;

public class FeatureDependencyConventionTests
{
    private static readonly Regex FeatureReferencePattern = new(
        @"IPCManagement\.Api\.Features\.([A-Za-z0-9_]+)\b",
        RegexOptions.Compiled | RegexOptions.CultureInvariant);

    private static readonly HashSet<FeatureEdge> PreferredEdges =
    [
        new("Approvals", "Purchasing"),
        new("Catalog", "Coordination"),
        new("Catalog", "SampleData"),
        new("Coordination", "Approvals"),
        new("Coordination", "Purchasing"),
        new("Planning", "Purchasing"),
        new("Purchasing", "Inventory"),
        new("Reports", "Purchasing"),
        new("SampleData", "Coordination"),
    ];

    // These four reverse edges are the known cycles scheduled for removal in
    // Step 13. Their reference count may decrease, but must never increase.
    private static readonly Dictionary<FeatureEdge, int> LegacyCycleReferenceCeilings = new()
    {
        [new("Approvals", "Coordination")] = 1,
        [new("Coordination", "SampleData")] = 2,
        [new("Purchasing", "Planning")] = 1,
        [new("Purchasing", "Reports")] = 3,
    };

    [Fact]
    public void FeatureDependencies_Should_NotAddEdgesOrGrowLegacyCycles()
    {
        var references = ScanFeatureReferences();
        var allowedEdges = PreferredEdges
            .Concat(LegacyCycleReferenceCeilings.Keys)
            .ToHashSet();
        var unexpectedEdges = references.Keys
            .Where(edge => !allowedEdges.Contains(edge))
            .OrderBy(edge => edge.From)
            .ThenBy(edge => edge.To)
            .ToArray();
        var grownLegacyEdges = LegacyCycleReferenceCeilings
            .Select(item => new
            {
                Edge = item.Key,
                Ceiling = item.Value,
                Actual = references.GetValueOrDefault(item.Key),
            })
            .Where(item => item.Actual > item.Ceiling)
            .OrderBy(item => item.Edge.From)
            .ThenBy(item => item.Edge.To)
            .ToArray();

        Assert.True(
            unexpectedEdges.Length == 0,
            $"Unexpected feature dependency edge(s): {string.Join(", ", unexpectedEdges)}");
        Assert.True(
            grownLegacyEdges.Length == 0,
            "Legacy cycle reference ceiling exceeded: "
            + string.Join(", ", grownLegacyEdges.Select(item =>
                $"{item.Edge} ({item.Actual}>{item.Ceiling})")));
    }

    [Fact]
    public void PreferredFeatureDependencyGraph_Should_BeAcyclic()
    {
        var adjacency = PreferredEdges
            .GroupBy(edge => edge.From)
            .ToDictionary(group => group.Key, group => group.Select(edge => edge.To).ToArray());
        var visiting = new HashSet<string>(StringComparer.Ordinal);
        var visited = new HashSet<string>(StringComparer.Ordinal);

        foreach (var feature in PreferredEdges.SelectMany(edge => new[] { edge.From, edge.To }).Distinct())
        {
            Assert.False(
                HasCycle(feature, adjacency, visiting, visited),
                $"Preferred feature dependency graph contains a cycle starting at {feature}.");
        }
    }

    private static Dictionary<FeatureEdge, int> ScanFeatureReferences()
    {
        var featureRoot = FindFeatureRoot();
        var references = new Dictionary<FeatureEdge, int>();

        foreach (var file in Directory.EnumerateFiles(featureRoot, "*.cs", SearchOption.AllDirectories))
        {
            var relativePath = Path.GetRelativePath(featureRoot, file);
            var owner = relativePath.Split(Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar)[0];
            var source = File.ReadAllText(file);

            foreach (Match match in FeatureReferencePattern.Matches(source))
            {
                var target = match.Groups[1].Value;
                if (string.Equals(owner, target, StringComparison.Ordinal))
                {
                    continue;
                }

                var edge = new FeatureEdge(owner, target);
                references[edge] = references.GetValueOrDefault(edge) + 1;
            }
        }

        return references;
    }

    private static string FindFeatureRoot()
    {
        for (var directory = new DirectoryInfo(AppContext.BaseDirectory); directory is not null; directory = directory.Parent)
        {
            var candidate = Path.Combine(directory.FullName, "src", "IPCManagement.Api", "Features");
            if (Directory.Exists(candidate))
            {
                return candidate;
            }
        }

        throw new DirectoryNotFoundException("Could not locate src/IPCManagement.Api/Features from the test output directory.");
    }

    private static bool HasCycle(
        string feature,
        IReadOnlyDictionary<string, string[]> adjacency,
        ISet<string> visiting,
        ISet<string> visited)
    {
        if (visited.Contains(feature))
        {
            return false;
        }

        if (!visiting.Add(feature))
        {
            return true;
        }

        foreach (var dependency in adjacency.GetValueOrDefault(feature, []))
        {
            if (HasCycle(dependency, adjacency, visiting, visited))
            {
                return true;
            }
        }

        visiting.Remove(feature);
        visited.Add(feature);
        return false;
    }

    private readonly record struct FeatureEdge(string From, string To)
    {
        public override string ToString() => $"{From}->{To}";
    }
}
