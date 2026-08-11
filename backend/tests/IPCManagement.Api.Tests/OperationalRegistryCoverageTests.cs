using System.Reflection;
using System.Text.Json;
using FluentAssertions;
using IPCManagement.Api.Features.Approvals.Services;
using IPCManagement.Api.Features.Coordination.Controllers;
using IPCManagement.Api.Features.Inventory.Controllers;
using IPCManagement.Api.Features.Planning.Controllers;
using IPCManagement.Api.Features.Purchasing.Controllers;
using IPCManagement.Api.Features.SampleData.Controllers;
using IPCManagement.Api.Security;
using Microsoft.AspNetCore.Authorization;

namespace IPCManagement.Api.Tests;

public sealed class OperationalRegistryCoverageTests
{
    private const int SupportedSchemaVersion = 1;
    private static readonly JsonSerializerOptions ManifestJsonOptions = new()
    {
        PropertyNameCaseInsensitive = true
    };

    [Fact]
    public void Shared_manifest_backend_families_have_exact_policy_and_source_coverage()
    {
        var manifest = LoadManifest();
        var manifestBackendFamilies = ValidateManifestAndGetBackendFamilyIds(manifest);
        var validatedBackendFamilies = ValidateBackendFamilyEvidence();

        ValidateExactBackendFamilyParity(manifestBackendFamilies, validatedBackendFamilies)
            .Should().Equal(manifestBackendFamilies.Order(StringComparer.Ordinal));
    }

    [Fact]
    public void Manifest_validator_rejects_schema_duplicates_missing_evidence_and_outside_paths()
    {
        var manifest = LoadManifest();
        var backendFamily = manifest.Families.Single(family => family.Id == "MaterialDemand");

        var unknownSchema = manifest with { SchemaVersion = SupportedSchemaVersion + 1 };
        var duplicateFamily = manifest with { Families = [.. manifest.Families, backendFamily] };
        var missingEvidence = manifest with
        {
            Families = manifest.Families
                .Select(family => family.Id == backendFamily.Id
                    ? family with { BackendEvidence = [] }
                    : family)
                .ToList()
        };
        var outsidePath = manifest with
        {
            Families = manifest.Families
                .Select(family => family.Id == backendFamily.Id
                    ? family with
                    {
                        BackendEvidence =
                        [
                            new BackendEvidenceDescriptor(
                                "source",
                                "../backend/src/IPCManagement.Api/Features/Planning/Controllers/MaterialDemandController.cs")
                        ]
                    }
                    : family)
                .ToList()
        };

        FluentActions.Invoking(() => ValidateManifestAndGetBackendFamilyIds(unknownSchema))
            .Should().Throw<InvalidOperationException>().WithMessage("*schema*");
        FluentActions.Invoking(() => ValidateManifestAndGetBackendFamilyIds(duplicateFamily))
            .Should().Throw<InvalidOperationException>().WithMessage("*Duplicate family ID*");
        FluentActions.Invoking(() => ValidateManifestAndGetBackendFamilyIds(missingEvidence))
            .Should().Throw<InvalidOperationException>().WithMessage("*MaterialDemand*backend evidence*");
        FluentActions.Invoking(() => ValidateManifestAndGetBackendFamilyIds(outsidePath))
            .Should().Throw<InvalidOperationException>().WithMessage("*outside backend production roots*");
    }

    [Fact]
    public void Missing_backend_evidence_mapping_fails_pure_parity_validation()
    {
        var manifestFamilies = ValidateManifestAndGetBackendFamilyIds(LoadManifest());
        var missingMaterialDemand = ValidateBackendFamilyEvidence()
            .Where(family => family != "MaterialDemand")
            .ToHashSet(StringComparer.Ordinal);

        FluentActions.Invoking(() => ValidateExactBackendFamilyParity(
                manifestFamilies,
                missingMaterialDemand))
            .Should().Throw<InvalidOperationException>()
            .WithMessage("*Missing backend evidence mapping: MaterialDemand*");
    }

    [Fact]
    public void Backend_production_source_does_not_import_operational_registry_test_paths()
    {
        string[] testOwnedNames =
        [
            "operationalStateActionRegistry",
            "operationalRegistryFamilyManifest",
            "coordinationOrderScopeLifecycleRegistry",
            "weeklyMenuLifecycleStateActionRegistry",
            nameof(OperationalRegistryCoverageTests)
        ];
        var workspaceRoot = FindWorkspaceRoot();
        var productionRoot = Path.Combine(workspaceRoot, "backend", "src");
        var imports = Directory.EnumerateFiles(productionRoot, "*.cs", SearchOption.AllDirectories)
            .Select(path => new { Path = path, Source = File.ReadAllText(path) })
            .Where(file => testOwnedNames.Any(name => file.Source.Contains(name, StringComparison.Ordinal)))
            .Select(file => Path.GetRelativePath(workspaceRoot, file.Path).Replace('\\', '/'))
            .ToArray();

        imports.Should().BeEmpty();
    }

    private static OperationalRegistryManifest LoadManifest()
    {
        var path = Path.Combine(
            FindWorkspaceRoot(),
            "frontend",
            "tests",
            "operationalRegistryFamilyManifest.json");
        var manifest = JsonSerializer.Deserialize<OperationalRegistryManifest>(
            File.ReadAllText(path),
            ManifestJsonOptions);
        return manifest
            ?? throw new InvalidOperationException("Operational registry family manifest is empty.");
    }

    private static HashSet<string> ValidateManifestAndGetBackendFamilyIds(
        OperationalRegistryManifest manifest)
    {
        if (manifest.SchemaVersion != SupportedSchemaVersion)
        {
            throw new InvalidOperationException(
                $"Unsupported operational registry manifest schema: {manifest.SchemaVersion}.");
        }

        var duplicateIds = manifest.Families
            .GroupBy(family => family.Id, StringComparer.Ordinal)
            .Where(group => group.Count() > 1)
            .Select(group => group.Key)
            .Order(StringComparer.Ordinal)
            .ToArray();
        if (duplicateIds.Length > 0)
        {
            throw new InvalidOperationException($"Duplicate family ID: {string.Join(", ", duplicateIds)}.");
        }

        var workspaceRoot = FindWorkspaceRoot();
        var backendProductionRoot = Path.GetFullPath(Path.Combine(
            workspaceRoot,
            "backend",
            "src",
            "IPCManagement.Api"));
        var backendFamilies = new HashSet<string>(StringComparer.Ordinal);

        foreach (var family in manifest.Families)
        {
            if (string.IsNullOrWhiteSpace(family.Id))
            {
                throw new InvalidOperationException("Manifest family ID cannot be empty.");
            }
            if (family.BackendBacked && family.BackendEvidence.Count == 0)
            {
                throw new InvalidOperationException($"{family.Id} has empty backend evidence.");
            }
            if (!family.BackendBacked && family.BackendEvidence.Count > 0)
            {
                throw new InvalidOperationException(
                    $"{family.Id} has backend evidence without a backend-backed disposition.");
            }
            if (family.BackendBacked)
            {
                backendFamilies.Add(family.Id);
            }

            foreach (var evidence in family.BackendEvidence)
            {
                if (evidence.Kind is not ("policy" or "source"))
                {
                    throw new InvalidOperationException(
                        $"{family.Id} has unsupported backend evidence kind {evidence.Kind}.");
                }
                if (Path.IsPathRooted(evidence.Source) ||
                    evidence.Source.Split('/').Contains("..", StringComparer.Ordinal) ||
                    !evidence.Source.StartsWith(
                        "backend/src/IPCManagement.Api/",
                        StringComparison.Ordinal) ||
                    !evidence.Source.EndsWith(".cs", StringComparison.Ordinal))
                {
                    throw new InvalidOperationException(
                        $"{family.Id} backend evidence path is outside backend production roots: {evidence.Source}.");
                }

                var absolutePath = Path.GetFullPath(Path.Combine(
                    workspaceRoot,
                    evidence.Source.Replace('/', Path.DirectorySeparatorChar)));
                if (!absolutePath.StartsWith(
                        backendProductionRoot + Path.DirectorySeparatorChar,
                        StringComparison.OrdinalIgnoreCase) ||
                    !File.Exists(absolutePath))
                {
                    throw new InvalidOperationException(
                        $"{family.Id} backend evidence path is outside backend production roots: {evidence.Source}.");
                }
            }
        }

        return backendFamilies;
    }

    private static HashSet<string> ValidateBackendFamilyEvidence()
    {
        var validated = new HashSet<string>(StringComparer.Ordinal);

        AuthorizationPolicies.MaterialDemandApprove.Should().NotBeNullOrWhiteSpace();
        AuthorizationPolicies.PurchaseRequestApprove.Should().NotBeNullOrWhiteSpace();
        AuthorizationPolicies.InventoryIssueApprove.Should().NotBeNullOrWhiteSpace();
        AssertUniqueSourceFragment(
            "backend/src/IPCManagement.Api/Features/Approvals/Services/ApprovalWorkflowService.cs",
            "ApprovalTargetType.MaterialDemand => AuthorizationPolicies.MaterialDemandApprove");
        AssertUniqueSourceFragment(
            "backend/src/IPCManagement.Api/Features/Approvals/Services/ApprovalInboxService.cs",
            "permissions.Contains(AuthorizationPolicies.MaterialDemandApprove)");
        validated.Add("ApprovalDocument");

        GetControllerPolicy<CoordinationOrdersController>()
            .Should().Be(AuthorizationPolicies.CoordinationAccess);
        AssertUniqueSourceFragment(
            "backend/src/IPCManagement.Api/Features/Coordination/Services/OrderPlanService.cs",
            "!OrderStatus.CanTransition(plan.Status, OrderStatus.Confirmed)");
        validated.Add("CoordinationOrderScopeLifecycle");

        GetControllerPolicy<MaterialDemandController>()
            .Should().Be(AuthorizationPolicies.DemandGenerateAccess);
        AssertUniqueSourceFragment(
            "backend/src/IPCManagement.Api/Features/Planning/Controllers/MaterialDemandController.cs",
            "[HttpPost(\"{id}/approve\")]");
        validated.Add("MaterialDemand");

        GetControllerPolicy<ProductionPlansController>()
            .Should().Be(AuthorizationPolicies.ProductionAccess);
        AssertUniqueSourceFragment(
            "backend/src/IPCManagement.Api/Features/Planning/Services/ProductionPlanService.cs",
            "plan.Status = \"SENTTOKITCHEN\";");
        validated.Add("ProductionPlan");

        GetControllerPolicy<PurchaseWorkflowController>()
            .Should().Be(AuthorizationPolicies.PurchaseAccess);
        AssertUniqueSourceFragment(
            "backend/src/IPCManagement.Api/Features/Purchasing/Services/PurchaseRequestSubmissionPolicy.cs",
            "private static readonly HashSet<string> ApprovedDemandStatuses =");
        AssertUniqueSourceFragment(
            "backend/src/IPCManagement.Api/Features/Purchasing/Services/PurchaseWorkbenchPolicy.cs",
            "private const string PurchaseSubmittedStatus = \"SENTTOSUPPLIER\";");
        validated.Add("PurchasingWorkflow");

        GetControllerPolicy<InventoryIssuesController>()
            .Should().Be(AuthorizationPolicies.InventoryIssueAccess);
        validated.Add("WarehouseFulfilment");

        GetActionPolicy<WarehousePurchaseReceiptsController>("RecordAsync")
            .Should().Be(AuthorizationPolicies.CoordinationAccess);
        validated.Add("WarehousePurchaseReceipt");

        GetControllerPolicy<WeeklyMenuImportsController>()
            .Should().Be(AuthorizationPolicies.CoordinationAccess);
        GetControllerPolicy<MenuSchedulesController>()
            .Should().Be(AuthorizationPolicies.CoordinationAccess);
        GetControllerPolicy<MealQuantityPlansController>()
            .Should().Be(AuthorizationPolicies.CoordinationAccess);
        validated.Add("WeeklyMenuLifecycle");

        return validated;
    }

    private static IReadOnlyList<string> ValidateExactBackendFamilyParity(
        IEnumerable<string> manifestBackendFamilies,
        IEnumerable<string> validatedBackendFamilies)
    {
        var manifestSet = manifestBackendFamilies.ToHashSet(StringComparer.Ordinal);
        var validatedSet = validatedBackendFamilies.ToHashSet(StringComparer.Ordinal);
        var missing = manifestSet.Except(validatedSet, StringComparer.Ordinal).Order(StringComparer.Ordinal).ToArray();
        var stale = validatedSet.Except(manifestSet, StringComparer.Ordinal).Order(StringComparer.Ordinal).ToArray();

        if (missing.Length > 0)
        {
            throw new InvalidOperationException(
                $"Missing backend evidence mapping: {string.Join(", ", missing)}.");
        }
        if (stale.Length > 0)
        {
            throw new InvalidOperationException(
                $"Stale backend evidence mapping: {string.Join(", ", stale)}.");
        }

        return validatedSet.Order(StringComparer.Ordinal).ToArray();
    }

    private static string GetControllerPolicy<T>()
        => typeof(T).GetCustomAttributes(typeof(AuthorizeAttribute), true)
            .Cast<AuthorizeAttribute>()
            .Single(attribute => attribute.Policy is not null)
            .Policy!;

    private static string GetActionPolicy<T>(string methodName)
        => typeof(T).GetMethod(methodName)!
            .GetCustomAttributes(typeof(AuthorizeAttribute), true)
            .Cast<AuthorizeAttribute>()
            .Single(attribute => attribute.Policy is not null)
            .Policy!;

    private static void AssertUniqueSourceFragment(string relativePath, string fragment)
    {
        var source = ReadWorkspaceSource(relativePath).ReplaceLineEndings("\n");
        var normalizedFragment = fragment.ReplaceLineEndings("\n");
        var matches = source.Split(normalizedFragment, StringSplitOptions.None).Length - 1;
        matches.Should().Be(1, $"{relativePath} must contain one authoritative fragment: {fragment}");
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
            ?? throw new InvalidOperationException("Cannot find workspace root for operational registry coverage.");
    }

    private sealed record OperationalRegistryManifest(
        int SchemaVersion,
        List<OperationalRegistryFamily> Families);

    private sealed record OperationalRegistryFamily(
        string Id,
        string Disposition,
        string RegistryModule,
        bool BackendBacked,
        List<BackendEvidenceDescriptor> BackendEvidence);

    private sealed record BackendEvidenceDescriptor(string Kind, string Source);
}
