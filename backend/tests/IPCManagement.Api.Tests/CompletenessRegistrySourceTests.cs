using FluentAssertions;
using IPCManagement.Api.Features.Coordination.Controllers;
using IPCManagement.Api.Security;
using Microsoft.AspNetCore.Authorization;

namespace IPCManagement.Api.Tests;

public sealed class CompletenessRegistrySourceTests
{
    [Fact]
    public void Coordination_controller_class_and_unlock_method_policies_are_still_authoritative()
    {
        AuthorizationPolicies.CoordinationAccess.Should().Be("CoordinationAccess");
        AuthorizationPolicies.CatalogAccess.Should().Be("CatalogAccess");

        GetAuthorizePolicies(typeof(CoordinationOrdersController))
            .Should().Equal(AuthorizationPolicies.CoordinationAccess);
        GetAuthorizePolicies(GetControllerMethod(nameof(CoordinationOrdersController.UnlockOrderPlanScopeAsync)))
            .Should().Equal(AuthorizationPolicies.CatalogAccess);
        GetAuthorizePolicies(GetControllerMethod(nameof(CoordinationOrdersController.UnlockOrderPlanAsync)))
            .Should().Equal(AuthorizationPolicies.CatalogAccess);
    }

    [Fact]
    public void Coordination_lifecycle_fragments_are_unique_and_drift_protected()
    {
        AssertUniqueSourceFragment(
            "backend/src/IPCManagement.Api/Features/Coordination/Services/OrderPlanService.cs",
            "!OrderStatus.CanTransition(plan.Status, OrderStatus.Confirmed)");
        AssertUniqueSourceFragment(
            "backend/src/IPCManagement.Api/Features/Coordination/Services/OrderPlanService.cs",
            "return status != OrderStatus.Confirmed && status != OrderStatus.Adjusted;");
        AssertUniqueSourceFragment(
            "backend/src/IPCManagement.Api/Features/Coordination/Services/OrderPlanService.cs",
            "AffectedPlanCount = plans.Count,\n                    OldStatuses = oldStatuses,\n                    NewStatus = OrderStatus.Draft");
        AssertUniqueSourceFragment(
            "backend/src/IPCManagement.Api/Features/Coordination/Services/OrderSignoffService.cs",
            "!OrderStatus.CanTransition(plan.Status, OrderStatus.Completed)");
        AssertUniqueSourceFragment(
            "backend/src/IPCManagement.Api/Features/Coordination/Services/OrderSignoffService.cs",
            "AffectedPlanCount = plans.Count,\n                    OldStatuses = oldStatuses,\n                    NewStatus = OrderStatus.Completed");
        AssertUniqueSourceFragment(
            "backend/src/IPCManagement.Api/Features/Coordination/Services/OrderAdjustmentService.cs",
            "if (!OrderStatus.IsLocked(line.QuantityPlan.Status))");
        AssertUniqueSourceFragment(
            "backend/src/IPCManagement.Api/Features/Coordination/Services/OrderAdjustmentService.cs",
            "if (!OrderStatus.CanEditForecast(line.QuantityPlan.Status))");
    }

    [Fact]
    public void Backend_production_source_does_not_import_test_owned_registry_modules()
    {
        string[] registryNames =
        [
            "stateActionRegistryContract",
            "protectedOperationalFamilyRegistry",
            "coordinationOrderScopeLifecycleRegistry",
            "weeklyMenuLifecyclePa2Registry",
            nameof(CompletenessRegistrySourceTests)
        ];
        var productionRoot = Path.Combine(FindWorkspaceRoot(), "backend", "src");
        var imports = Directory.EnumerateFiles(productionRoot, "*.cs", SearchOption.AllDirectories)
            .Select(path => new { Path = path, Source = File.ReadAllText(path) })
            .Where(file => registryNames.Any(name => file.Source.Contains(name, StringComparison.Ordinal)))
            .Select(file => Path.GetRelativePath(FindWorkspaceRoot(), file.Path).Replace('\\', '/'))
            .ToArray();

        imports.Should().BeEmpty();
    }

    private static System.Reflection.MethodInfo GetControllerMethod(string name)
        => typeof(CoordinationOrdersController).GetMethod(name)
            ?? throw new InvalidOperationException($"Không tìm thấy controller method {name}.");

    private static string[] GetAuthorizePolicies(System.Reflection.MemberInfo member)
        => member.GetCustomAttributes(typeof(AuthorizeAttribute), true)
            .Cast<AuthorizeAttribute>()
            .Select(attribute => attribute.Policy)
            .Where(policy => policy is not null)
            .Cast<string>()
            .ToArray();

    private static void AssertUniqueSourceFragment(string relativePath, string fragment)
    {
        var source = ReadWorkspaceSource(relativePath).ReplaceLineEndings("\n");
        var normalizedFragment = fragment.ReplaceLineEndings("\n");
        var matches = source.Split(normalizedFragment, StringSplitOptions.None).Length - 1;
        matches.Should().Be(1, $"{relativePath} must contain exactly one authoritative source fragment: {fragment}");
    }

    private static string ReadWorkspaceSource(string relativePath)
    {
        var path = Path.Combine(
            FindWorkspaceRoot(),
            relativePath.Replace('/', Path.DirectorySeparatorChar));
        return File.ReadAllText(path);
    }

    private static string FindWorkspaceRoot()
    {
        var directory = new DirectoryInfo(AppContext.BaseDirectory);
        while (directory is not null && !File.Exists(Path.Combine(directory.FullName, "package.json")))
        {
            directory = directory.Parent;
        }

        return directory?.FullName
            ?? throw new InvalidOperationException("Không tìm thấy workspace root cho completeness registry assertions.");
    }
}
