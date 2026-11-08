using System.Collections;
using System.Reflection;

namespace IPCManagement.Api.Tests;

public sealed class OperationalWarehouseTrustSurfaceClosureTests
{
    private static readonly string Root = FindRepositoryRoot();

    [Fact]
    public void Exact_inventory_has_one_resolved_owner_disposition_per_boundary()
    {
        var field = typeof(OperationalWarehouseCompatibilityTests)
            .GetField("Inventory", BindingFlags.NonPublic | BindingFlags.Static)!;
        var rows = ((IEnumerable)field.GetValue(null)!).Cast<object>().ToArray();
        var keys = rows.Select(ReadKey).ToArray();

        Assert.Equal(63, rows.Length);
        Assert.Equal(rows.Length, keys.Distinct(StringComparer.Ordinal).Count());
        Assert.All(rows, row =>
        {
            Assert.InRange((int)ReadProperty(row, "OwnerPlan"), 10, 13);
            Assert.NotEqual("Unresolved", ReadProperty(row, "Disposition").ToString());
            var file = ReadProperty(row, "File").ToString()!;
            Assert.True(File.Exists(Path.Combine(Root, file)), $"Missing owner file: {file}");
        });
    }

    [Fact]
    public void Exact_inventory_validator_rejects_missing_duplicate_and_unresolved_rows()
    {
        var clean = new[] { new ClosureRow("a", 10, "CanonicalInput"), new ClosureRow("b", 11, "LineageInput") };
        Assert.Empty(Validate(clean));
        Assert.Contains(Validate(clean.Skip(1)), item => item.StartsWith("missing:"));
        Assert.Contains(Validate(clean.Append(clean[0])), item => item.StartsWith("duplicate:"));
        Assert.Contains(Validate(clean.Append(new("c", 12, "Unresolved"))), item => item.StartsWith("unresolved:"));
    }

    [Fact]
    public void Converted_production_owners_have_no_warehouse_selection_or_repair_fallback()
    {
        var files = new[]
        {
            "backend/src/IPCManagement.Api/Features/Catalog/Services/DishBomImportService.cs",
            "backend/src/IPCManagement.Api/Features/SampleData/Services/SampleBomImportService.cs",
            "backend/src/IPCManagement.Api/Features/Inventory/Controllers/WarehousesController.cs",
            "backend/src/IPCManagement.Api/Features/Inventory/Services/WarehouseService.cs",
            "backend/src/IPCManagement.Api/Features/Purchasing/Services/PurchaseReceivingService.cs",
        };
        var source = string.Join("\n", files.Select(file => File.ReadAllText(Path.Combine(Root, file))));

        Assert.DoesNotContain("WarehouseCode ==", source, StringComparison.Ordinal);
        Assert.DoesNotContain("OrderBy(item => item.WarehouseCode)", source, StringComparison.Ordinal);
        Assert.DoesNotContain("warehouses[0]", source, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("IsOperationalActive = true", source, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("RemoveRange(warehouses", source, StringComparison.OrdinalIgnoreCase);
    }

    private static object ReadProperty(object row, string name)
        => row.GetType().GetProperty(name)!.GetValue(row)!;

    private static string ReadKey(object row) => ReadProperty(row, "Key").ToString()!;

    private static IReadOnlyList<string> Validate(IEnumerable<ClosureRow> rows)
    {
        var materialized = rows.ToArray();
        var expected = new HashSet<string>(["a", "b"], StringComparer.Ordinal);
        var actual = materialized.Select(row => row.Key).ToArray();
        return expected.Except(actual).Select(key => $"missing:{key}")
            .Concat(actual.GroupBy(key => key).Where(group => group.Count() > 1).Select(group => $"duplicate:{group.Key}"))
            .Concat(materialized.Where(row => row.Disposition == "Unresolved").Select(row => $"unresolved:{row.Key}"))
            .ToArray();
    }

    private static string FindRepositoryRoot()
    {
        var directory = new DirectoryInfo(AppContext.BaseDirectory);
        while (directory is not null && !File.Exists(Path.Combine(directory.FullName, "AGENTS.md")))
            directory = directory.Parent;
        return directory?.FullName ?? throw new InvalidOperationException("Repository root not found.");
    }

    private sealed record ClosureRow(string Key, int OwnerPlan, string Disposition);
}
