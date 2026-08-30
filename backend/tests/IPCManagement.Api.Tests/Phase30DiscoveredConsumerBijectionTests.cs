using FluentAssertions;
using IPCManagement.Api.Features.Planning.Services;
using IPCManagement.Api.Models.Entities;
using Microsoft.CodeAnalysis;
using Microsoft.CodeAnalysis.CSharp;
using Microsoft.CodeAnalysis.CSharp.Syntax;

namespace IPCManagement.Api.Tests;

public sealed class Phase30DiscoveredConsumerBijectionTests
{
    private sealed record ConsumerRow(
        string OwnerMethod,
        string FamilyDisposition,
        string[] SourceKeys,
        bool MutatesIssueFamily,
        string PublicOracle);

    private static readonly HashSet<string> LineageMembers =
    [
        "MaterialRequestId", "MaterialRequestLineId", "ReconciliationBatchId", "ReconciliationBatchLineId",
        "MaterialRequest", "MaterialRequestLine", "ReconciliationBatch", "ReconciliationBatchLine"
    ];

    private static readonly string[] ExplicitDiscoveryExclusions =
    [
        "/bin/", "/obj/", "/Migrations/", "/Models/Entities/", "/Contracts/", "/Persistence/", "/Data/Configurations/"
    ];

    // Intentionally hand-maintained. The semantic discovery side is independent, so duplicate,
    // stale, and missing rows all fail the same exact set comparison with Type.Method diagnostics.
    private static readonly ConsumerRow[] Matrix =
    [
        Row("ApprovalInboxService.BuildInventoryIssueItemsAsync", "FAMILY_PRESERVING_READ"),
        Row("AuditReportService.GetAuditChangesAsync", "FAMILY_LABELLED_AUDIT"),
        Row("DataQualityCommandService.CleanupDataQualityAsync", "DEFAULT_ONLY_COMMAND", "WorkflowGenerationTests.DataQualityCleanup_Should_DryRunAndRemoveSafeOrphanStaleDocuments"),
        Row("DataQualityReportService.GetDataQualityAsync", "FAMILY_LABELLED_REPORT", "WorkflowGenerationTests.DataQualityCleanup_Should_DryRunAndRemoveSafeOrphanStaleDocuments"),
        Row("InventoryIssueApprovalHandler.HandleCoreAsync", "FAMILY_PRESERVING_COMMAND"),
        Row("InventoryIssueLineResolver.BuildIssuedBySourceLine", "EXACT_ONE_LINE_RESOLUTION"),
        Row("InventoryIssueLineResolver.BuildLinesFromRemainingDemand", "DEFAULT_ONLY_RESOLUTION"),
        Row("InventoryIssueLineResolver.BuildLinesFromRequest", "DEFAULT_ONLY_RESOLUTION"),
        Row("InventoryIssueRepository.GetIssuedLinesForMaterialRequestAsync", "DEFAULT_ONLY_READ"),
        Row("InventoryIssueService.ConfirmReceiptAsync", "FAMILY_PRESERVING_COMMAND"),
        Row("InventoryIssueService.CreateAsync", "DEFAULT_COMPATIBLE_EXACT_ONE", "InventoryIssueServiceTests.CreateAsync_ShouldInferCanonicalDefaultLineOwnership"),
        Row("InventoryIssueService.CreateFromReconciliationAsync", "RECONCILIATION_ONLY_COMMAND"),
        Row("InventoryIssueService.UpdateMaterialRequestStatusIfCompleted", "DEFAULT_ONLY_COMMAND"),
        Row("InventoryMapper.MapIssue", "FAMILY_LABELLED_MAPPING"),
        Row("InventoryMapper.MapIssueLine", "FAMILY_LABELLED_MAPPING"),
        Row("InventoryOperationsReportService.GetSupplyLineReconciliationAsync", "FAMILY_LABELLED_REPORT"),
        Row("InventoryOperationsReportService.GetWorkflowDocumentsAsync", "FAMILY_LABELLED_REPORT"),
        Row("InventoryOperationsReportService.MapKitchenIssue", "FAMILY_LABELLED_MAPPING"),
        Row("InventoryOperationsReportService.QueryIssueLines", "FAMILY_LABELLED_REPORT"),
        Row("InventoryReturnService.EnsureExactSourceFamily", "EXACT_ONE_VALIDATION"),
        Row("InventoryReturnService.EnsureOwningFamilyActive", "FAMILY_STATUS_VALIDATION"),
        Row("InventoryReturnService.GetAllocationBalancesAsync", "FAMILY_PRESERVING_READ"),
        Row("InventoryReturnService.LoadScopedSourceLinesAsync", "FAMILY_SCOPED_READ"),
        Row("LegacyLineageDispositionService.ApplyProvenanceAsync", "LEGACY_REMEDIATION_COMMAND"),
        Row("LegacyLineageDispositionService.GetIssueLineCandidatesAsync", "LEGACY_REMEDIATION_READ"),
        Row("MaterialDemandService.EnsureMaterialRequestAsync", "DEFAULT_ONLY_COMMAND", "Phase30InactiveWorkflowFenceTests"),
        Row("MaterialDemandService.GetStalenessAsync", "DEFAULT_ONLY_READ", "Phase30InactiveWorkflowFenceTests"),
        Row("MaterialDemandStockReservation.ReserveAsync", "DEFAULT_ONLY_COMMAND", "Phase30InactiveWorkflowFenceTests"),
        Row("MenuAmendmentService.CreateAsync", "DEFAULT_ONLY_COMMAND", "Phase30InactiveWorkflowFenceTests"),
        Row("MenuAmendmentService.ExecuteCoreAsync", "DEFAULT_ONLY_COMMAND", "Phase30InactiveWorkflowFenceTests"),
        Row("MenuAmendmentService.ExecuteDecisionAsync", "DEFAULT_ONLY_COMMAND", "Phase30InactiveWorkflowFenceTests"),
        Row("MenuAmendmentService.RemediateDecisionFanAsync", "DEFAULT_ONLY_COMMAND", "Phase30InactiveWorkflowFenceTests"),
        Row("MenuScheduleService.InvalidateWorkflowDocumentsForMenuRollbackAsync", "FAMILY_PRESERVING_COMMAND"),
        Row("MenuScheduleService.RollbackMenuVersionAsync", "FAMILY_PRESERVING_COMMAND"),
        Row("OperationalKpiReportService.GetOperationalKpisAsync", "FAMILY_LABELLED_REPORT"),
        Row("PurchaseRequestGenerationService.ClearStaleRequestAsync", "DEFAULT_ONLY_COMMAND"),
        Row("PurchaseRequestGenerationService.EnsureLine", "DEFAULT_ONLY_COMMAND"),
        Row("PurchaseRequestGenerationService.GenerateFromDemandAsync", "DEFAULT_ONLY_COMMAND"),
        Row("PurchaseRequestQueryService.Map", "DEFAULT_ONLY_MAPPING"),
        Row("PurchaseRequestSubmissionService.ResolveMaterialRequestsForSubmitAsync", "DEFAULT_ONLY_READ"),
        Row("PurchaseRequestSubmissionService.ValidateSubmitAsync", "DEFAULT_ONLY_VALIDATION"),
        Row("PurchasingReportService.GetPurchaseDemandAsync", "DEFAULT_ONLY_REPORT"),
        Row("ReconciliationBatchService.LoadLinkedIssuedQuantitiesAsync", "RECONCILIATION_ONLY_READ"),
        Row("ReconciliationBatchService.ProjectNetIssuedQuantities", "RECONCILIATION_ONLY_PROJECTION"),
        Row("ServiceRunService.GetPageAsync", "DEFAULT_ONLY_READ", "Phase30DiscoveredConsumerBijectionTests.ServiceRun_PublicProjectionIgnoresCollidingFamilies"),
        Row("ServiceRunService.GetProjectionAsync", "DEFAULT_ONLY_READ", "Phase30DiscoveredConsumerBijectionTests.ServiceRun_PublicProjectionIgnoresCollidingFamilies"),
        Row("ServiceRunService.SelectRelevantIssueLines", "DEFAULT_ONLY_PROJECTION", "Phase30DiscoveredConsumerBijectionTests.ServiceRun_PublicProjectionIgnoresCollidingFamilies"),
        Row("SupplementalMaterialRequestService.CreateAsync", "DEFAULT_ONLY_COMMAND"),
        Row("SupplementalMaterialRequestService.EnsureDefaultSourceFamily", "DEFAULT_ONLY_VALIDATION"),
        Row("SupplementalMaterialRequestService.FulfillAsync", "DEFAULT_ONLY_COMMAND"),
        Row("SupplementalMaterialRequestService.LoadSourceLineAsync", "DEFAULT_ONLY_READ"),
        Row("SupplementalMaterialRequestService.ResolveSourceShiftNameAsync", "DEFAULT_ONLY_READ"),
        Row("SupplementalMaterialRequestService.RouteToPurchasingAsync", "DEFAULT_ONLY_COMMAND"),
        Row("WeeklyMenuImportPersistence.InvalidateWorkflowDocumentsForMenuReimportAsync", "DEFAULT_ONLY_COMMAND", "Phase30InactiveWorkflowFenceTests"),
        Row("WeeklyMenuImportPersistence.RequireNoIrreversibleDownstreamDocumentsAsync", "DEFAULT_ONLY_VALIDATION", "Phase30InactiveWorkflowFenceTests")
    ];

    private static ConsumerRow Row(string ownerMethod, string disposition, string? publicOracle = null)
        => new(ownerMethod, disposition,
            disposition.StartsWith("RECONCILIATION", StringComparison.Ordinal)
                ? ["ReconciliationBatchId", "ReconciliationBatchLineId"]
                : disposition.StartsWith("DEFAULT", StringComparison.Ordinal)
                    ? ["MaterialRequestId", "MaterialRequestLineId"]
                    : ["MaterialRequestId", "MaterialRequestLineId", "ReconciliationBatchId", "ReconciliationBatchLineId"],
            false,
            publicOracle ?? "Phase30 public service/controller regression suite");

    [Fact]
    public void DiscoveredProductionOwnerMethods_AndTypedMatrix_AreAnExactBijection()
    {
        var discovered = DiscoverOwners();
        var matrixOwners = Matrix.Select(row => row.OwnerMethod).ToArray();

        matrixOwners.Should().OnlyHaveUniqueItems("duplicate Type.Method rows hide ambiguous lineage authority");
        discovered.Should().BeEquivalentTo(matrixOwners,
            "semantic production discovery and the typed matrix must fail exactly for every duplicate, stale, or missing Type.Method row");
        Matrix.Should().OnlyContain(row =>
            !string.IsNullOrWhiteSpace(row.FamilyDisposition) &&
            row.SourceKeys.Distinct(StringComparer.Ordinal).Count() == row.SourceKeys.Length &&
            !row.MutatesIssueFamily &&
            !string.IsNullOrWhiteSpace(row.PublicOracle));
    }

    [Fact]
    public void DishCatalogDiagnostics_IsExplicitlyNotApplicableAtPublicSeam()
    {
        Matrix.Should().NotContain(row => row.OwnerMethod.StartsWith("DishCatalogDiagnosticsService.", StringComparison.Ordinal));
        typeof(DishCatalogDiagnosticsServiceTests).GetMethod(
            nameof(DishCatalogDiagnosticsServiceTests.Diagnostics_Should_BeLineageNotApplicable_WithIdenticalOutputAndZeroEffects))
            .Should().NotBeNull();
    }

    [Fact]
    public void ServiceRun_PublicProjectionIgnoresCollidingFamilies()
    {
        var defaultDemandLine = Guid.NewGuid().ToByteArray();
        var reconciliationLine = Line(reconciliationLineId: Guid.NewGuid().ToByteArray(), issuedQty: 4);
        var legacyLine = Line(issuedQty: 3);
        var exactDefaultLine = Line(materialRequestLineId: defaultDemandLine, issuedQty: 2);
        var issues = new[]
        {
            new InventoryIssue { IssueId = Guid.NewGuid().ToByteArray(), ShiftName = "MORNING", ReconciliationBatchId = Guid.NewGuid().ToByteArray(), Inventoryissuelines = [reconciliationLine] },
            new InventoryIssue { IssueId = Guid.NewGuid().ToByteArray(), ShiftName = "MORNING", Inventoryissuelines = [legacyLine] },
            new InventoryIssue { IssueId = Guid.NewGuid().ToByteArray(), ShiftName = "MORNING", MaterialRequestId = Guid.NewGuid().ToByteArray(), Inventoryissuelines = [exactDefaultLine] }
        };

        ServiceRunService.SelectRelevantIssueLines(issues, [new MaterialRequestLine { RequestLineId = defaultDemandLine }], "MORNING")
            .Should().ContainSingle().Which.Should().BeSameAs(exactDefaultLine);
    }

    private static InventoryIssueLine Line(byte[]? materialRequestLineId = null, byte[]? reconciliationLineId = null, decimal issuedQty = 0)
        => new()
        {
            IssueLineId = Guid.NewGuid().ToByteArray(), IngredientId = Guid.NewGuid().ToByteArray(), UnitId = Guid.NewGuid().ToByteArray(),
            MaterialRequestLineId = materialRequestLineId, ReconciliationBatchLineId = reconciliationLineId, IssuedQty = issuedQty
        };

    private static string[] DiscoverOwners()
    {
        var sourceRoot = ResolveRepoPath("backend/src");
        var sourceFiles = Directory.EnumerateFiles(sourceRoot, "*.cs", SearchOption.AllDirectories)
            .Where(path => !IsExplicitlyExcluded(path)).OrderBy(path => path, StringComparer.Ordinal).ToArray();
        var trees = sourceFiles.Select(path => CSharpSyntaxTree.ParseText(File.ReadAllText(path), path: path)).ToArray();
        var references = ((string?)AppContext.GetData("TRUSTED_PLATFORM_ASSEMBLIES"))!
            .Split(Path.PathSeparator, StringSplitOptions.RemoveEmptyEntries)
            .Concat(AppDomain.CurrentDomain.GetAssemblies().Where(assembly => !assembly.IsDynamic && !string.IsNullOrWhiteSpace(assembly.Location)).Select(assembly => assembly.Location))
            .Distinct(StringComparer.OrdinalIgnoreCase).Select(path => MetadataReference.CreateFromFile(path));
        var compilation = CSharpCompilation.Create("Phase30ProductionLineageDiscovery", trees, references, new CSharpCompilationOptions(OutputKind.DynamicallyLinkedLibrary));
        var owners = new SortedSet<string>(StringComparer.Ordinal);

        foreach (var tree in trees)
        {
            var model = compilation.GetSemanticModel(tree, ignoreAccessibility: true);
            foreach (var access in tree.GetRoot().DescendantNodes().OfType<MemberAccessExpressionSyntax>())
            {
                var symbol = model.GetSymbolInfo(access).Symbol as IPropertySymbol;
                if (!LineageMembers.Contains(access.Name.Identifier.ValueText) ||
                    (symbol is not null && symbol.ContainingType.Name is not (nameof(InventoryIssue) or nameof(InventoryIssueLine))))
                    continue;

                var method = access.Ancestors().OfType<MethodDeclarationSyntax>().FirstOrDefault();
                var type = access.Ancestors().OfType<TypeDeclarationSyntax>().FirstOrDefault();
                if (method is not null && type is not null)
                    owners.Add($"{type.Identifier.ValueText}.{method.Identifier.ValueText}");
            }
        }

        return owners.ToArray();
    }

    private static bool IsExplicitlyExcluded(string path)
    {
        var normalized = path.Replace('\\', '/');
        return ExplicitDiscoveryExclusions.Any(exclusion => normalized.Contains(exclusion, StringComparison.Ordinal)) ||
               normalized.EndsWith(".Designer.cs", StringComparison.Ordinal) ||
               normalized.EndsWith(".g.cs", StringComparison.Ordinal) ||
               normalized.EndsWith(".generated.cs", StringComparison.Ordinal);
    }

    private static string ResolveRepoPath(string relativePath)
    {
        var directory = new DirectoryInfo(AppContext.BaseDirectory);
        while (directory is not null && !File.Exists(Path.Combine(directory.FullName, "AGENTS.md"))) directory = directory.Parent;
        directory.Should().NotBeNull("the test must resolve production source from the repository root");
        return Path.Combine(directory!.FullName, relativePath.Replace('/', Path.DirectorySeparatorChar));
    }
}
