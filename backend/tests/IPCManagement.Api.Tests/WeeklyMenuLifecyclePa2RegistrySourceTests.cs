using FluentAssertions;
using IPCManagement.Api.Features.Coordination.Controllers;
using IPCManagement.Api.Features.Planning.Controllers;
using IPCManagement.Api.Features.SampleData.Controllers;
using IPCManagement.Api.Security;
using Microsoft.AspNetCore.Authorization;

namespace IPCManagement.Api.Tests;

public sealed class WeeklyMenuLifecyclePa2RegistrySourceTests
{
    [Fact]
    public void Backend_permission_and_lifecycle_sources_used_by_pa2_registry_are_still_present()
    {
        ReadWorkspaceLine("backend/src/IPCManagement.Api/Program.cs", 165)
            .Should().Contain("options.AddPolicy(AuthorizationPolicies.CoordinationAccess, policy =>");
        ReadWorkspaceLine("backend/src/IPCManagement.Api/Program.cs", 166)
            .Should().Contain("RequireRole(AuthorizationPolicies.CoordinationRoles)");
        ReadWorkspaceLine("backend/src/IPCManagement.Api/Program.cs", 176)
            .Should().Contain("options.AddPolicy(AuthorizationPolicies.DemandGenerateAccess, policy =>");
        ReadWorkspaceLine("backend/src/IPCManagement.Api/Program.cs", 177)
            .Should().Contain("RequireRole(AuthorizationPolicies.CoordinationRoles)");
        ReadWorkspaceLine("backend/src/IPCManagement.Api/Security/AuthorizationPolicies.cs", 42)
            .Should().Contain("public static readonly string[] CoordinationRoles");
        ReadWorkspaceLine("backend/src/IPCManagement.Api/Features/Coordination/Services/MealQuantityPlanService.cs", 149)
            .Should().Contain("if (request.Complete && schedules.Any(schedule =>");
        ReadWorkspaceLine("backend/src/IPCManagement.Api/Features/Coordination/Services/MealQuantityPlanService.cs", 150)
            .Should().Contain("!string.Equals(schedule.Status, \"ACTIVE\"");
        ReadWorkspaceLine("backend/src/IPCManagement.Api/Features/Coordination/Services/MenuScheduleService.cs", 160)
            .Should().Contain("var status = MenuSchedulePolicy.NormalizeMenuScheduleStatus(request.Status)");
        ReadWorkspaceLine("backend/src/IPCManagement.Api/Features/Coordination/Services/MenuScheduleService.cs", 194)
            .Should().Contain("if (!string.Equals(version.Status, status, StringComparison.OrdinalIgnoreCase))");
    }

    [Fact]
    public void Backend_controller_policies_used_by_pa2_registry_are_still_authoritative()
    {
        AuthorizationPolicies.CoordinationRoles.Should().Contain(["Admin", "Manager", "Coordinator"]);
        AuthorizationPolicies.AllPermissions.Should().Contain(AuthorizationPolicies.CoordinationOrderLock);
        AuthorizationPolicies.AllPermissions.Should().NotContain("orders.lock");
        AuthorizationPolicies.DemandGenerateAccess.Should().Be("DemandGenerateAccess");

        GetControllerPolicy<WeeklyMenuImportsController>()
            .Should().Be(AuthorizationPolicies.CoordinationAccess);
        GetControllerPolicy<MenuSchedulesController>()
            .Should().Be(AuthorizationPolicies.CoordinationAccess);
        GetControllerPolicy<MealQuantityPlansController>()
            .Should().Be(AuthorizationPolicies.CoordinationAccess);
        GetControllerPolicy<MaterialDemandController>()
            .Should().Be(AuthorizationPolicies.DemandGenerateAccess);
    }

    private static string GetControllerPolicy<T>()
        => typeof(T).GetCustomAttributes(typeof(AuthorizeAttribute), true)
            .Cast<AuthorizeAttribute>()
            .Single(attribute => attribute.Policy is not null)
            .Policy!;

    private static string ReadWorkspaceLine(string relativePath, int lineNumber)
    {
        var workspaceRoot = FindWorkspaceRoot();
        var path = Path.Combine(workspaceRoot, relativePath.Replace('/', Path.DirectorySeparatorChar));
        return File.ReadAllLines(path)[lineNumber - 1];
    }

    private static string FindWorkspaceRoot()
    {
        var directory = new DirectoryInfo(AppContext.BaseDirectory);
        while (directory is not null && !File.Exists(Path.Combine(directory.FullName, "package.json")))
        {
            directory = directory.Parent;
        }

        return directory?.FullName
            ?? throw new InvalidOperationException("Không tìm thấy workspace root cho PA-2 source assertions.");
    }
}
