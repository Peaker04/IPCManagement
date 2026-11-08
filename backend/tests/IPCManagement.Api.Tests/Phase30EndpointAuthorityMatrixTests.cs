using System.Reflection;
using IPCManagement.Api.Features.Catalog.Controllers;
using IPCManagement.Api.Features.Inventory.Controllers;
using IPCManagement.Api.Features.Reconciliation.Controllers;
using IPCManagement.Api.Security;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc.Routing;

namespace IPCManagement.Api.Tests;

public sealed class Phase30EndpointAuthorityMatrixTests
{
    private static readonly Assembly ProductionAssembly = typeof(IngredientsController).Assembly;

    public static IEnumerable<object[]> RetainedMutationEndpoints() => DiscoverMutationEndpoints()
        .Select(row => new object[] { row });

    [Theory]
    [MemberData(nameof(RetainedMutationEndpoints))]
    public void Every_retained_mutation_has_one_mode_independent_permission_owner(EndpointAuthorityRow row)
    {
        Assert.False(string.IsNullOrWhiteSpace(row.Route));
        Assert.False(string.IsNullOrWhiteSpace(row.ProductionOwner));
        Assert.NotEmpty(row.Policies);

        if (row.Authority == MutationAuthority.AdminData)
            Assert.Contains(AuthorizationPolicies.CatalogAccess, row.Policies);

        Assert.True(row.AppliesInDefault || row.AppliesInMaterialReconciliation);
    }

    [Fact]
    public void Source_enumeration_has_no_unclassified_retained_mutation_endpoint()
    {
        var rows = DiscoverMutationEndpoints().ToList();

        Assert.NotEmpty(rows);
        Assert.Equal(rows.Count, rows.Select(row => row.ProductionOwner).Distinct(StringComparer.Ordinal).Count());
        Assert.DoesNotContain(rows, row => row.Authority == MutationAuthority.Unclassified);
        Assert.Contains(rows, row => row.Authority == MutationAuthority.AdminData);
        Assert.Contains(rows, row => row.Authority == MutationAuthority.Warehouse);
        Assert.Contains(rows, row => row.Authority == MutationAuthority.NonWarehouseWorkflow);
    }

    [Fact]
    public void Every_reconciliation_non_warehouse_service_is_free_of_stock_mutation_owners()
    {
        var root = FindRepositoryRoot();
        var files = new[]
        {
            "src/IPCManagement.Api/Features/Reconciliation/Services/ReconciliationBatchService.cs",
            "src/IPCManagement.Api/Features/Reconciliation/Services/ReconciliationCompletionService.cs",
            "src/IPCManagement.Api/Features/Reconciliation/Services/ReconciliationActualService.cs"
        };

        foreach (var relativePath in files)
        {
            var source = File.ReadAllText(Path.Combine(root, relativePath));
            Assert.DoesNotContain("IStockLedgerService", source, StringComparison.Ordinal);
            Assert.DoesNotContain("Stockmovements.Add", source, StringComparison.OrdinalIgnoreCase);
            Assert.DoesNotContain("Currentstocks.Add", source, StringComparison.OrdinalIgnoreCase);
        }
    }

    [Fact]
    public void Every_mode_sensitive_reconciliation_write_uses_transaction_local_authority_fence()
    {
        var root = FindRepositoryRoot();
        var batchService = File.ReadAllText(Path.Combine(root,
            "src/IPCManagement.Api/Features/Reconciliation/Services/ReconciliationBatchService.cs"));
        var completionService = File.ReadAllText(Path.Combine(root,
            "src/IPCManagement.Api/Features/Reconciliation/Services/ReconciliationCompletionService.cs"));

        Assert.Contains("ExecuteProtectedAsync", batchService, StringComparison.Ordinal);
        Assert.Contains("TransferToWarehouseAsync", batchService, StringComparison.Ordinal);
        Assert.Contains("ExecuteProtectedAsync", completionService, StringComparison.Ordinal);
        Assert.Contains("CompleteAsync", completionService, StringComparison.Ordinal);
    }

    private static IEnumerable<EndpointAuthorityRow> DiscoverMutationEndpoints()
    {
        var controllerNamespaces = new[]
        {
            typeof(IngredientsController).Namespace!,
            typeof(InventoryIssuesController).Namespace!,
            typeof(ReconciliationBatchesController).Namespace!
        };

        foreach (var controller in ProductionAssembly.GetTypes()
                     .Where(type => !type.IsAbstract && controllerNamespaces.Contains(type.Namespace) && type.Name.EndsWith("Controller", StringComparison.Ordinal)))
        {
            foreach (var method in controller.GetMethods(BindingFlags.Instance | BindingFlags.Public | BindingFlags.DeclaredOnly))
            {
                var http = method.GetCustomAttributes<HttpMethodAttribute>(inherit: true).SingleOrDefault();
                if (http is null || http.HttpMethods.All(verb => string.Equals(verb, "GET", StringComparison.OrdinalIgnoreCase)))
                    continue;

                var policies = controller.GetCustomAttributes<AuthorizeAttribute>(inherit: true)
                    .Concat(method.GetCustomAttributes<AuthorizeAttribute>(inherit: true))
                    .Select(attribute => attribute.Policy)
                    .Where(policy => !string.IsNullOrWhiteSpace(policy))
                    .Cast<string>()
                    .Distinct(StringComparer.Ordinal)
                    .ToArray();
                var authority = controller.Namespace switch
                {
                    var value when value == typeof(IngredientsController).Namespace => MutationAuthority.AdminData,
                    var value when value == typeof(InventoryIssuesController).Namespace => MutationAuthority.Warehouse,
                    var value when value == typeof(ReconciliationBatchesController).Namespace &&
                        policies.Any(policy => policy.Contains("Warehouse", StringComparison.Ordinal)) => MutationAuthority.Warehouse,
                    var value when value == typeof(ReconciliationBatchesController).Namespace => MutationAuthority.NonWarehouseWorkflow,
                    _ => MutationAuthority.Unclassified
                };
                var route = $"{controller.Name}/{http.Template ?? string.Empty}";
                yield return new EndpointAuthorityRow(
                    route,
                    $"{controller.FullName}.{method.Name}",
                    authority,
                    policies,
                    AppliesInDefault: authority != MutationAuthority.NonWarehouseWorkflow,
                    AppliesInMaterialReconciliation: authority != MutationAuthority.Warehouse ||
                        controller == typeof(InventoryIssuesController) || controller == typeof(InventoryReturnsController));
            }
        }
    }

    private static string FindRepositoryRoot()
    {
        var directory = new DirectoryInfo(AppContext.BaseDirectory);
        while (directory is not null && !File.Exists(Path.Combine(directory.FullName, "IPCManagement.slnx")))
            directory = directory.Parent;
        return directory?.FullName ?? throw new DirectoryNotFoundException("Không tìm thấy repository root.");
    }

    public sealed record EndpointAuthorityRow(
        string Route,
        string ProductionOwner,
        MutationAuthority Authority,
        IReadOnlyList<string> Policies,
        bool AppliesInDefault,
        bool AppliesInMaterialReconciliation);

    public enum MutationAuthority
    {
        Unclassified,
        AdminData,
        Warehouse,
        NonWarehouseWorkflow
    }
}
