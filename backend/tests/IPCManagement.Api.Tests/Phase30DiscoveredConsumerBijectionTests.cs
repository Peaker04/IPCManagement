using FluentAssertions;
using IPCManagement.Api.Features.Planning.Services;
using IPCManagement.Api.Helpers.Mappers;
using IPCManagement.Api.Models.Entities;
using Microsoft.CodeAnalysis;
using Microsoft.CodeAnalysis.CSharp;
using Microsoft.CodeAnalysis.CSharp.Syntax;
using Microsoft.CodeAnalysis.Operations;
using System.Reflection;

namespace IPCManagement.Api.Tests;

public sealed class Phase30DiscoveredConsumerBijectionTests
{
    private sealed record ConsumerRow(
        string OwnerMethod,
        string FamilyDisposition,
        string[] SourceKeys,
        bool MutatesIssueFamily,
        Type OracleType,
        string OracleMethod,
        string[] CoveredOwnerKeys);

    private static readonly HashSet<string> LineageMembers =
    [
        "MaterialRequestId", "MaterialRequestLineId", "ReconciliationBatchId", "ReconciliationBatchLineId",
        "MaterialRequest", "MaterialRequestLine", "ReconciliationBatch", "ReconciliationBatchLine"
    ];

    private static readonly string[] GeneratedDiscoveryExclusions =
    [
        "/bin/", "/obj/", "/Migrations/"
    ];

    private sealed record SourceCallGraph(
        CSharpCompilation Compilation,
        IReadOnlyDictionary<IMethodSymbol, MethodDeclarationSyntax> Declarations);

    private static readonly Lazy<SourceCallGraph> RepositoryCallGraph = new(() =>
    {
        var root = ResolveRepoPath("backend");
        var trees = new[] { Path.Combine(root, "src", "IPCManagement.Api"), Path.Combine(root, "tests", "IPCManagement.Api.Tests") }
            .SelectMany(directory => Directory.EnumerateFiles(directory, "*.cs", SearchOption.AllDirectories))
            .Where(IsCallGraphSource)
            .OrderBy(path => path, StringComparer.Ordinal)
            .Select(path => CSharpSyntaxTree.ParseText(File.ReadAllText(path), path: path))
            .ToArray();
        return CreateSourceCallGraph(trees, CreateReferences());
    });

    // Intentionally hand-maintained. Every owner names a real xUnit oracle and the complete set of
    // owners that oracle covers. Shared oracles are valid only when every row repeats the same exact set.
    private static readonly string[] DataQualityOwners =
    ["DataQualityCommandService.CleanupDataQualityAsync", "DataQualityReportService.GetDataQualityAsync"];
    private static readonly string[] ApprovalBusinessOwners =
    ["ApprovalInboxService.BuildInventoryIssueItemsAsync", "InventoryIssueApprovalHandler.HandleCoreAsync"];
    private static readonly string[] DefaultIssueOwners =
    ["InventoryIssueLineResolver.BuildIssuedBySourceLine", "InventoryIssueRepository.GetIssuedLinesForMaterialRequestAsync", "InventoryIssueService.ConfirmReceiptAsync", "InventoryIssueService.CreateAsync", "InventoryMapper.MapIssue", "InventoryMapper.MapIssueLine", "MaterialRequestCompletionTransitionService.Stage"];
    private static readonly string[] ReconciliationIssueOwners = ["InventoryIssueService.CreateFromReconciliationAsync"];
    private static readonly string[] InventoryReadOwners = ["InventoryIssueRepository.ApplyExactSourceFamily", "InventoryIssueRepository.GetPagedAsync"];
    private static readonly string[] SupplyReturnOwners =
    ["InventoryOperationsReportService.GetSupplyLineReconciliationAsync", "InventoryReturnService.EnsureExactSourceFamily", "InventoryReturnService.EnsureOwningFamilyActive", "InventoryReturnService.GetAllocationBalancesAsync", "InventoryReturnScopeLoader.LoadScopedAsync"];
    private static readonly string[] BusinessReadOwners =
    ["InventoryOperationsReportService.MapKitchenIssue", "InventoryOperationsReportService.QueryIssueLines", "OperationalKpiReportService.GetOperationalKpisAsync", "OperationalKpiReportService.QueryIssueLines"];
    private static readonly string[] LegacyOwners = ["LegacyLineageDispositionService.ApplyProvenanceAsync", "LegacyLineageDispositionService.GetIssueLineCandidatesAsync"];
    private static readonly string[] DemandOwners = ["MaterialDemandService.EnsureMaterialRequestAsync", "MaterialDemandService.GetStalenessAsync", "MaterialDemandStockReservation.ReserveAsync"];
    private static readonly string[] AmendmentOwners = ["MenuAmendmentService.CreateAsync", "MenuAmendmentService.ExecuteCoreAsync"];
    private static readonly string[] ServiceRunOwners = ["ServiceRunService.GetPageAsync", "ServiceRunService.GetProjectionAsync", "ServiceRunSourceSelection.SelectRelevantIssueLines"];
    private static readonly string[] SupplementalOwners = ["SupplementalMaterialRequestService.CreateAsync", "SupplementalMaterialRequestSourceLoader.EnsureDefaultSourceFamily", "SupplementalMaterialRequestService.FulfillAsync", "SupplementalMaterialRequestService.LoadSourceLineAsync", "SupplementalMaterialRequestSourceLoader.ResolveShiftNameAsync", "SupplementalMaterialRequestService.RouteToPurchasingAsync"];
    private static readonly string[] InventoryDocumentOwners = ["InventoryOperationsDocumentQueries.BuildIssueDocumentsAsync", "InventoryOperationsDocumentQueries.BuildReturnDocumentsAsync"];

    private static readonly ConsumerRow[] Matrix =
    [
        Row("ApprovalInboxService.BuildInventoryIssueItemsAsync", "DEFAULT_ONLY_READ", typeof(Phase30BusinessReadConsumerMatrixTests), nameof(Phase30BusinessReadConsumerMatrixTests.ApprovalInboxAndHandler_Should_UseOnlyExactDefaultLineage), ApprovalBusinessOwners),
        Row("AuditReportService.GetAuditChangesAsync", "FAMILY_LABELLED_AUDIT", typeof(Phase30BusinessReadConsumerMatrixTests), nameof(Phase30BusinessReadConsumerMatrixTests.AuditAndCsv_Should_LabelEveryCollidingSourceFamily_WithExactAvailableIdentity), ["AuditReportService.GetAuditChangesAsync"]),
        Row("DataQualityCommandService.CleanupDataQualityAsync", "DEFAULT_ONLY_COMMAND", typeof(WorkflowGenerationTests), nameof(WorkflowGenerationTests.DataQualityCleanup_Should_DryRunAndRemoveSafeOrphanStaleDocuments), DataQualityOwners),
        Row("DataQualityReportService.GetDataQualityAsync", "FAMILY_LABELLED_REPORT", typeof(WorkflowGenerationTests), nameof(WorkflowGenerationTests.DataQualityCleanup_Should_DryRunAndRemoveSafeOrphanStaleDocuments), DataQualityOwners),
        Row("InventoryIssueApprovalHandler.HandleCoreAsync", "DEFAULT_ONLY_COMMAND", typeof(Phase30BusinessReadConsumerMatrixTests), nameof(Phase30BusinessReadConsumerMatrixTests.ApprovalInboxAndHandler_Should_UseOnlyExactDefaultLineage), ApprovalBusinessOwners),
        Row("InventoryIssueLineResolver.BuildIssuedBySourceLine", "EXACT_ONE_LINE_RESOLUTION", typeof(Phase30DiscoveredConsumerBijectionTests), nameof(DefaultIssue_PublicCreateApprovalMappingAndReceipt_ExerciseCompleteOwnerSet), DefaultIssueOwners),
        Row("InventoryIssueRepository.ApplyExactSourceFamily", "FAMILY_SCOPED_READ", typeof(Phase30BusinessReadConsumerMatrixTests), nameof(Phase30BusinessReadConsumerMatrixTests.InventoryListAndDetail_Should_RequireExactRequestedFamily_AndLabelLegacyDetail), InventoryReadOwners),
        Row("InventoryIssueRepository.GetIssuedLinesForMaterialRequestAsync", "DEFAULT_ONLY_READ", typeof(Phase30DiscoveredConsumerBijectionTests), nameof(DefaultIssue_PublicCreateApprovalMappingAndReceipt_ExerciseCompleteOwnerSet), DefaultIssueOwners),
        Row("InventoryIssueRepository.GetPagedAsync", "FAMILY_SCOPED_READ", typeof(Phase30BusinessReadConsumerMatrixTests), nameof(Phase30BusinessReadConsumerMatrixTests.InventoryListAndDetail_Should_RequireExactRequestedFamily_AndLabelLegacyDetail), InventoryReadOwners),
        Row("InventoryIssueService.ConfirmReceiptAsync", "FAMILY_PRESERVING_COMMAND", typeof(Phase30DiscoveredConsumerBijectionTests), nameof(DefaultIssue_PublicCreateApprovalMappingAndReceipt_ExerciseCompleteOwnerSet), DefaultIssueOwners),
        Row("InventoryIssueService.CreateAsync", "DEFAULT_COMPATIBLE_EXACT_ONE", typeof(Phase30DiscoveredConsumerBijectionTests), nameof(DefaultIssue_PublicCreateApprovalMappingAndReceipt_ExerciseCompleteOwnerSet), DefaultIssueOwners),
        Row("InventoryIssueService.CreateFromReconciliationAsync", "RECONCILIATION_ONLY_COMMAND", typeof(ReconciliationWarehouseIssueApplicationPathTests), nameof(ReconciliationWarehouseIssueApplicationPathTests.Reconciliation_issue_rejects_line_from_another_batch_with_atomic_zero_effects), ReconciliationIssueOwners),
        Row("InventoryMapper.MapIssue", "FAMILY_LABELLED_MAPPING", typeof(Phase30DiscoveredConsumerBijectionTests), nameof(DefaultIssue_PublicCreateApprovalMappingAndReceipt_ExerciseCompleteOwnerSet), DefaultIssueOwners),
        Row("InventoryMapper.MapIssueLine", "FAMILY_LABELLED_MAPPING", typeof(Phase30DiscoveredConsumerBijectionTests), nameof(DefaultIssue_PublicCreateApprovalMappingAndReceipt_ExerciseCompleteOwnerSet), DefaultIssueOwners),
        Row("InventoryOperationsDocumentQueries.BuildIssueDocumentsAsync", "DEFAULT_ONLY_READ", typeof(Phase30BusinessReadConsumerMatrixTests), nameof(Phase30BusinessReadConsumerMatrixTests.WorkflowDocuments_Should_ExcludeReconciliationAndLegacyIssues), InventoryDocumentOwners),
        Row("InventoryOperationsDocumentQueries.BuildReturnDocumentsAsync", "DEFAULT_ONLY_READ", typeof(Phase30BusinessReadConsumerMatrixTests), nameof(Phase30BusinessReadConsumerMatrixTests.WorkflowDocuments_Should_ExcludeReconciliationAndLegacyIssues), InventoryDocumentOwners),
        Row("InventoryOperationsReportService.GetSupplyLineReconciliationAsync", "FAMILY_LABELLED_REPORT", typeof(Phase30DiscoveredConsumerBijectionTests), nameof(ReturnAndReports_PublicOraclesExerciseCompleteOwnerSet), SupplyReturnOwners),
        Row("InventoryOperationsReportService.MapKitchenIssue", "FAMILY_LABELLED_MAPPING", typeof(Phase30BusinessReadConsumerMatrixTests), nameof(Phase30BusinessReadConsumerMatrixTests.DefaultReportsKpisAndPhysicalTruth_Should_RemainInvariantWithCollidingFamilies), BusinessReadOwners),
        Row("InventoryOperationsReportService.QueryIssueLines", "FAMILY_LABELLED_REPORT", typeof(Phase30BusinessReadConsumerMatrixTests), nameof(Phase30BusinessReadConsumerMatrixTests.DefaultReportsKpisAndPhysicalTruth_Should_RemainInvariantWithCollidingFamilies), BusinessReadOwners),
        Row("InventoryReturnService.EnsureExactSourceFamily", "EXACT_ONE_VALIDATION", typeof(Phase30DiscoveredConsumerBijectionTests), nameof(ReturnAndReports_PublicOraclesExerciseCompleteOwnerSet), SupplyReturnOwners),
        Row("InventoryReturnService.EnsureOwningFamilyActive", "FAMILY_STATUS_VALIDATION", typeof(Phase30DiscoveredConsumerBijectionTests), nameof(ReturnAndReports_PublicOraclesExerciseCompleteOwnerSet), SupplyReturnOwners),
        Row("InventoryReturnService.GetAllocationBalancesAsync", "FAMILY_PRESERVING_READ", typeof(Phase30DiscoveredConsumerBijectionTests), nameof(ReturnAndReports_PublicOraclesExerciseCompleteOwnerSet), SupplyReturnOwners),
        Row("InventoryReturnScopeLoader.LoadScopedAsync", "FAMILY_SCOPED_READ", typeof(Phase30DiscoveredConsumerBijectionTests), nameof(ReturnAndReports_PublicOraclesExerciseCompleteOwnerSet), SupplyReturnOwners),
        Row("LegacyLineageDispositionService.ApplyProvenanceAsync", "LEGACY_REMEDIATION_COMMAND", typeof(LegacyLineageDispositionServiceTests), nameof(LegacyLineageDispositionServiceTests.IssueDisposition_ShouldRequireIndependentManagerThenApplyOnlyReviewedProvenance), LegacyOwners),
        Row("LegacyLineageDispositionService.GetIssueLineCandidatesAsync", "LEGACY_REMEDIATION_READ", typeof(LegacyLineageDispositionServiceTests), nameof(LegacyLineageDispositionServiceTests.IssueDisposition_ShouldRequireIndependentManagerThenApplyOnlyReviewedProvenance), LegacyOwners),
        Row("MaterialDemandService.EnsureMaterialRequestAsync", "DEFAULT_ONLY_COMMAND", typeof(WorkflowGenerationTests), nameof(WorkflowGenerationTests.MaterialDemand_PublicGenerationStalenessAndReservation_IgnoreCollidingIssueFamilies), DemandOwners),
        Row("MaterialDemandService.GetStalenessAsync", "DEFAULT_ONLY_READ", typeof(WorkflowGenerationTests), nameof(WorkflowGenerationTests.MaterialDemand_PublicGenerationStalenessAndReservation_IgnoreCollidingIssueFamilies), DemandOwners),
        Row("MaterialDemandStockReservation.ReserveAsync", "DEFAULT_ONLY_COMMAND", typeof(WorkflowGenerationTests), nameof(WorkflowGenerationTests.MaterialDemand_PublicGenerationStalenessAndReservation_IgnoreCollidingIssueFamilies), DemandOwners),
        Row("MaterialRequestCompletionTransitionService.Stage", "DEFAULT_ONLY_COMMAND", typeof(Phase30DiscoveredConsumerBijectionTests), nameof(DefaultIssue_PublicCreateApprovalMappingAndReceipt_ExerciseCompleteOwnerSet), DefaultIssueOwners),
        Row("MenuAmendmentService.CreateAsync", "DEFAULT_ONLY_COMMAND", typeof(WorkflowGenerationTests), nameof(WorkflowGenerationTests.MenuAmendment_PublicCreateAndExecute_PreserveCollidingFamiliesAndReadySnapshot), AmendmentOwners),
        Row("MenuAmendmentService.ExecuteCoreAsync", "DEFAULT_ONLY_COMMAND", typeof(WorkflowGenerationTests), nameof(WorkflowGenerationTests.MenuAmendment_PublicCreateAndExecute_PreserveCollidingFamiliesAndReadySnapshot), AmendmentOwners),
        Row("OperationalKpiReportService.GetOperationalKpisAsync", "DEFAULT_ONLY_READ", typeof(Phase30BusinessReadConsumerMatrixTests), nameof(Phase30BusinessReadConsumerMatrixTests.DefaultReportsKpisAndPhysicalTruth_Should_RemainInvariantWithCollidingFamilies), BusinessReadOwners),
        Row("OperationalKpiReportService.QueryIssueLines", "DEFAULT_ONLY_READ", typeof(Phase30BusinessReadConsumerMatrixTests), nameof(Phase30BusinessReadConsumerMatrixTests.DefaultReportsKpisAndPhysicalTruth_Should_RemainInvariantWithCollidingFamilies), BusinessReadOwners),
        Row("ReconciliationBatchService.ListSourceChangesAsync", "RECONCILIATION_ONLY_READ", typeof(ReconciliationServiceTests), nameof(ReconciliationServiceTests.Source_changes_are_scoped_to_frozen_batch_contributors), ["ReconciliationBatchService.ListSourceChangesAsync"]),
        Row("ReconciliationBatchService.LoadLinkedIssuedQuantitiesAsync", "RECONCILIATION_ONLY_READ", typeof(ReconciliationServiceTests), nameof(ReconciliationServiceTests.AggregateAndCompletion_Should_IgnoreDefaultAndLegacyCollisionQuantities), ["ReconciliationBatchService.LoadLinkedIssuedQuantitiesAsync"]),
        Row("ServiceRunService.GetPageAsync", "DEFAULT_ONLY_READ", typeof(ServiceRunLifecycleTests), nameof(ServiceRunLifecycleTests.OpenAndVarianceCommands_Should_BeIdempotent_AndRecordCompleteLifecycleEvidence), ServiceRunOwners),
        Row("ServiceRunService.GetProjectionAsync", "DEFAULT_ONLY_READ", typeof(ServiceRunLifecycleTests), nameof(ServiceRunLifecycleTests.OpenAndVarianceCommands_Should_BeIdempotent_AndRecordCompleteLifecycleEvidence), ServiceRunOwners),
        Row("ServiceRunSourceSelection.SelectRelevantIssueLines", "DEFAULT_ONLY_PROJECTION", typeof(ServiceRunLifecycleTests), nameof(ServiceRunLifecycleTests.OpenAndVarianceCommands_Should_BeIdempotent_AndRecordCompleteLifecycleEvidence), ServiceRunOwners),
        Row("SupplementalMaterialRequestService.CreateAsync", "DEFAULT_ONLY_COMMAND", typeof(Phase30DiscoveredConsumerBijectionTests), nameof(Supplemental_PublicLifecycleOraclesExerciseCompleteOwnerSet), SupplementalOwners),
        Row("SupplementalMaterialRequestService.GetPagedAsync", "DEFAULT_ONLY_READ", typeof(SupplementalMaterialRequestServiceTests), nameof(SupplementalMaterialRequestServiceTests.GetPagedAsync_ShouldExcludeLegacyRequestsOutsideDefaultSourceFamilyBeforeCount), ["SupplementalMaterialRequestService.GetPagedAsync"]),
        Row("SupplementalMaterialRequestSourceLoader.EnsureDefaultSourceFamily", "DEFAULT_ONLY_VALIDATION", typeof(Phase30DiscoveredConsumerBijectionTests), nameof(Supplemental_PublicLifecycleOraclesExerciseCompleteOwnerSet), SupplementalOwners),
        Row("SupplementalMaterialRequestService.FulfillAsync", "DEFAULT_ONLY_COMMAND", typeof(Phase30DiscoveredConsumerBijectionTests), nameof(Supplemental_PublicLifecycleOraclesExerciseCompleteOwnerSet), SupplementalOwners),
        Row("SupplementalMaterialRequestService.LoadSourceLineAsync", "DEFAULT_ONLY_READ", typeof(Phase30DiscoveredConsumerBijectionTests), nameof(Supplemental_PublicLifecycleOraclesExerciseCompleteOwnerSet), SupplementalOwners),
        Row("SupplementalMaterialRequestSourceLoader.ResolveShiftNameAsync", "DEFAULT_ONLY_READ", typeof(Phase30DiscoveredConsumerBijectionTests), nameof(Supplemental_PublicLifecycleOraclesExerciseCompleteOwnerSet), SupplementalOwners),
        Row("SupplementalMaterialRequestService.RouteToPurchasingAsync", "DEFAULT_ONLY_COMMAND", typeof(Phase30DiscoveredConsumerBijectionTests), nameof(Supplemental_PublicLifecycleOraclesExerciseCompleteOwnerSet), SupplementalOwners),
        Row("WeeklyMenuImportPersistence.RequireNoIrreversibleDownstreamDocumentsAsync", "DEFAULT_ONLY_VALIDATION", typeof(WorkflowGenerationTests), nameof(WorkflowGenerationTests.WeeklyMenuReimport_PublicCommitPreservesReadySnapshotAndCollidingFamilies), ["WeeklyMenuImportPersistence.RequireNoIrreversibleDownstreamDocumentsAsync"])
    ];

    private static ConsumerRow Row(string ownerMethod, string disposition, Type oracleType, string oracleMethod, string[] coveredOwnerKeys)
        => new(ownerMethod, disposition,
            disposition.StartsWith("RECONCILIATION", StringComparison.Ordinal)
                ? ["ReconciliationBatchId", "ReconciliationBatchLineId"]
                : disposition.StartsWith("DEFAULT", StringComparison.Ordinal)
                    ? ["MaterialRequestId", "MaterialRequestLineId"]
                    : ["MaterialRequestId", "MaterialRequestLineId", "ReconciliationBatchId", "ReconciliationBatchLineId"],
            false, oracleType, oracleMethod, coveredOwnerKeys);

    [Fact]
    public void DiscoveredProductionOwnerMethods_AndTypedMatrix_AreAnExactBijection()
    {
        var discovered = DiscoverOwners();
        var matrixOwners = Matrix.Select(row => row.OwnerMethod).ToArray();

        matrixOwners.Should().OnlyHaveUniqueItems("duplicate Type.Method rows hide ambiguous lineage authority");
        ValidateRegistry(Matrix, discovered);
        Matrix.Should().OnlyContain(row =>
            !string.IsNullOrWhiteSpace(row.FamilyDisposition) &&
            row.SourceKeys.Distinct(StringComparer.Ordinal).Count() == row.SourceKeys.Length &&
            !row.MutatesIssueFamily);
    }

    [Fact]
    public async Task DefaultIssue_PublicCreateApprovalMappingAndReceipt_ExerciseCompleteOwnerSet()
    {
        await new WorkflowGenerationTests().CreateInventoryIssue_Should_AutoBuildLinesFromApprovedDemand_AndDecreaseStock();
        await new InventoryIssueServiceTests().ConfirmReceiptAsync_Should_UpdateReceivedAt_And_WriteAuditLog();
        InventoryMapper.MapIssueLine(Line(materialRequestLineId: Guid.NewGuid().ToByteArray(), issuedQty: 1m))
            .MaterialRequestLineId.Should().NotBeNullOrWhiteSpace();
    }

    [Fact]
    public async Task ReturnAndReports_PublicOraclesExerciseCompleteOwnerSet()
    {
        var tests = new WorkflowGenerationTests();
        await tests.InventoryReturnAndWaste_Should_RecordProductionVariance_AndFeedUsageReport();
        await tests.ConfirmInventoryIssueReceipt_Should_MarkKitchenReceipt_AndCreateDiscrepancyIssue();
        await tests.AllocationBalance_Should_PreserveExactSourceLine_And_DefaultDenyDisposition();
    }

    [Fact]
    public async Task Supplemental_PublicLifecycleOraclesExerciseCompleteOwnerSet()
    {
        var tests = new SupplementalMaterialRequestServiceTests();
        await tests.CreateAsync_ShouldPersistPendingRequestFromReceivedIssueLine();
        await tests.FulfillAsync_ShouldCreateSupplementalIssue_DecreaseStock_AndExposeRemainingQuantity();
        await tests.RouteToPurchasingAsync_ShouldCreateTraceableDraftForOnlyMissingQuantity();
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
            .Where(path => !IsGenerated(path)).OrderBy(path => path, StringComparer.Ordinal).ToArray();
        var trees = sourceFiles.Select(path => CSharpSyntaxTree.ParseText(File.ReadAllText(path), path: path)).ToArray();
        return DiscoverOwners(trees, CreateReferences());
    }

    private static string[] DiscoverOwners(IEnumerable<SyntaxTree> syntaxTrees, IEnumerable<MetadataReference> references)
    {
        var trees = syntaxTrees.Append(CSharpSyntaxTree.ParseText("""
global using Microsoft.AspNetCore.Builder;
global using Microsoft.AspNetCore.Hosting;
global using Microsoft.AspNetCore.Http;
global using Microsoft.AspNetCore.Routing;
global using Microsoft.Extensions.Configuration;
global using Microsoft.Extensions.DependencyInjection;
global using Microsoft.Extensions.Hosting;
global using Microsoft.Extensions.Logging;
global using System;
global using System.Collections.Generic;
global using System.IO;
global using System.Linq;
global using System.Net.Http;
global using System.Threading;
global using System.Threading.Tasks;
""", path: "Phase30.GlobalUsings.g.cs")).ToArray();
        var outputKind = trees.Any(tree => tree.GetRoot().DescendantNodes().OfType<GlobalStatementSyntax>().Any())
            ? OutputKind.ConsoleApplication
            : OutputKind.DynamicallyLinkedLibrary;
        var compilation = CSharpCompilation.Create("Phase30ProductionLineageDiscovery", trees, references,
            new CSharpCompilationOptions(outputKind, nullableContextOptions: NullableContextOptions.Enable));
        var errors = compilation.GetDiagnostics().Where(diagnostic => diagnostic.Severity == DiagnosticSeverity.Error).ToArray();
        errors.Should().BeEmpty("lineage discovery must use a compilable semantic model and fail closed, not accept unresolved textual candidates");

        var owners = new SortedSet<string>(StringComparer.Ordinal);
        foreach (var tree in trees)
        {
            var model = compilation.GetSemanticModel(tree, ignoreAccessibility: true);
            foreach (var node in tree.GetRoot().DescendantNodes())
            {
                if (!TryResolveLineageProperty(node, model, out _)) continue;
                var method = node.AncestorsAndSelf().OfType<BaseMethodDeclarationSyntax>().FirstOrDefault();
                var type = node.AncestorsAndSelf().OfType<TypeDeclarationSyntax>().FirstOrDefault();
                if (method is null || type is null || IsSemanticallyDeclarativeConfiguration(method, type, model)) continue;
                var methodName = method switch
                {
                    MethodDeclarationSyntax declaration => declaration.Identifier.ValueText,
                    ConstructorDeclarationSyntax constructor => constructor.Identifier.ValueText,
                    _ => method.Kind().ToString()
                };
                owners.Add($"{type.Identifier.ValueText}.{methodName}");
            }
        }
        return owners.ToArray();
    }

    private static bool IsSemanticallyDeclarativeConfiguration(BaseMethodDeclarationSyntax method, TypeDeclarationSyntax type, SemanticModel model)
    {
        if (method is not MethodDeclarationSyntax declaration || declaration.Identifier.ValueText != "Configure") return false;
        var typeSymbol = model.GetDeclaredSymbol(type);
        if (typeSymbol is null || !typeSymbol.AllInterfaces.Any(candidate =>
                candidate.OriginalDefinition.ToDisplayString() == "Microsoft.EntityFrameworkCore.IEntityTypeConfiguration<TEntity>"))
            return false;
        var parameter = declaration.ParameterList.Parameters.SingleOrDefault();
        var parameterSymbol = parameter is null ? null : model.GetDeclaredSymbol(parameter);
        if (parameterSymbol?.Type.OriginalDefinition.ToDisplayString() != "Microsoft.EntityFrameworkCore.Metadata.Builders.EntityTypeBuilder<TEntity>")
            return false;
        var statements = declaration.Body?.Statements.ToArray() ?? [];
        return statements.Length > 0 && statements.All(statement =>
            statement is ExpressionStatementSyntax { Expression: InvocationExpressionSyntax invocation } &&
            IsInvocationRootedIn(invocation, parameter!.Identifier.ValueText));
    }

    private static bool IsInvocationRootedIn(InvocationExpressionSyntax invocation, string parameterName)
    {
        SyntaxNode? cursor = invocation.Expression;
        while (cursor is MemberAccessExpressionSyntax member) cursor = member.Expression;
        while (cursor is InvocationExpressionSyntax nested)
        {
            cursor = nested.Expression;
            while (cursor is MemberAccessExpressionSyntax member) cursor = member.Expression;
        }
        return cursor is IdentifierNameSyntax identifier && identifier.Identifier.ValueText == parameterName;
    }

    private static bool TryResolveLineageProperty(SyntaxNode node, SemanticModel model, out IPropertySymbol property)
    {
        property = null!;
        ISymbol? symbol = node switch
        {
            MemberAccessExpressionSyntax access when LineageMembers.Contains(access.Name.Identifier.ValueText) => model.GetSymbolInfo(access).Symbol,
            IdentifierNameSyntax identifier when LineageMembers.Contains(identifier.Identifier.ValueText) => model.GetSymbolInfo(identifier).Symbol,
            SubpatternSyntax subpattern when subpattern.NameColon?.Name is IdentifierNameSyntax name && LineageMembers.Contains(name.Identifier.ValueText) => model.GetSymbolInfo(name).Symbol,
            InvocationExpressionSyntax invocation when invocation.Expression.ToString().Contains("EF.Property", StringComparison.Ordinal) &&
                invocation.ArgumentList.Arguments.Count == 2 && invocation.ArgumentList.Arguments[1].Expression is LiteralExpressionSyntax literal &&
                literal.IsKind(SyntaxKind.StringLiteralExpression) && LineageMembers.Contains(literal.Token.ValueText)
                => ResolveEfPropertyTarget(invocation, literal.Token.ValueText, model),
            _ => null
        };
        if (symbol is IAliasSymbol alias) symbol = alias.Target;
        if (symbol is not IPropertySymbol candidate || candidate.ContainingType.Name is not (nameof(InventoryIssue) or nameof(InventoryIssueLine)))
            return false;
        property = candidate;
        return true;
    }

    private static IPropertySymbol? ResolveEfPropertyTarget(InvocationExpressionSyntax invocation, string propertyName, SemanticModel model)
    {
        var targetType = model.GetTypeInfo(invocation.ArgumentList.Arguments[0].Expression).Type;
        return targetType?.GetMembers(propertyName).OfType<IPropertySymbol>().SingleOrDefault(property =>
            property.ContainingType.Name is nameof(InventoryIssue) or nameof(InventoryIssueLine));
    }

    private static MetadataReference[] CreateReferences() => ((string?)AppContext.GetData("TRUSTED_PLATFORM_ASSEMBLIES"))!
        .Split(Path.PathSeparator, StringSplitOptions.RemoveEmptyEntries)
        .Concat(AppDomain.CurrentDomain.GetAssemblies().Where(assembly => !assembly.IsDynamic && !string.IsNullOrWhiteSpace(assembly.Location)).Select(assembly => assembly.Location))
        .Distinct(StringComparer.OrdinalIgnoreCase)
        .Where(path => !string.Equals(Path.GetFileName(path), "IPCManagement.Api.dll", StringComparison.OrdinalIgnoreCase))
        .Select(path => MetadataReference.CreateFromFile(path)).ToArray();

    private static MethodInfo? ResolveOracle(ConsumerRow row)
    {
        var overloads = row.OracleType.GetMethods(BindingFlags.Public | BindingFlags.Instance | BindingFlags.Static)
            .Where(method => method.Name == row.OracleMethod).ToArray();
        return overloads.Length == 1 ? overloads[0] : null;
    }

    private static bool IsGenerated(string path)
    {
        var normalized = path.Replace('\\', '/');
        return GeneratedDiscoveryExclusions.Any(exclusion => normalized.Contains(exclusion, StringComparison.Ordinal)) ||
               IsGeneratedFileName(normalized);
    }

    private static bool IsCallGraphSource(string path)
    {
        var normalized = path.Replace('\\', '/');
        return !normalized.Contains("/bin/", StringComparison.Ordinal) &&
               !normalized.Contains("/obj/", StringComparison.Ordinal) &&
               !IsGeneratedFileName(normalized);
    }

    private static bool IsGeneratedFileName(string normalizedPath)
        => normalizedPath.EndsWith(".Designer.cs", StringComparison.Ordinal) ||
           normalizedPath.EndsWith("ModelSnapshot.cs", StringComparison.Ordinal) ||
           normalizedPath.EndsWith(".g.cs", StringComparison.Ordinal) ||
           normalizedPath.EndsWith(".generated.cs", StringComparison.Ordinal);

    [Fact]
    public void SemanticDiscovery_CoversEverySupportedSyntaxAndPersistenceOwner()
    {
        const string fixture = """
using System.Linq;
using Microsoft.EntityFrameworkCore;
namespace IPCManagement.Api.Models.Entities { public class InventoryIssue { public byte[]? MaterialRequestId {get;set;} public byte[]? ReconciliationBatchId {get;set;} } }
namespace Synthetic.Persistence {
using I = IPCManagement.Api.Models.Entities.InventoryIssue;
public static class PersistenceOwner {
 public static void Member(I x) { _ = x.MaterialRequestId; }
 public static void Identifier(I x) { var MaterialRequestId = x.MaterialRequestId; _ = MaterialRequestId; }
 public static bool PropertyPattern(I x) => x is { ReconciliationBatchId: null };
 public static bool Recursive(I x) => x is { MaterialRequestId.Length: > 0 };
 public static object? EfString(I x) => EF.Property<byte[]>(x, "MaterialRequestId");
 public static bool Query(I[] xs) => (from x in xs where x.ReconciliationBatchId == null select x).Any();
 public static int Conditional(I? x) => x?.MaterialRequestId?.Length ?? 0;
}}
namespace Synthetic.Services {
using I = IPCManagement.Api.Models.Entities.InventoryIssue;
public static class ServiceOwner { public static bool Member(I x) => x.MaterialRequestId != null; }
public static class ArbitraryConfiguration { public static bool Executable(I x) => x.ReconciliationBatchId != null; }
}
""";
        var tree = CSharpSyntaxTree.ParseText(fixture, path: "Synthetic/Persistence/PersistenceOwner.cs");
        DiscoverOwners([tree], CreateReferences()).Should().BeEquivalentTo(
            "PersistenceOwner.Member", "PersistenceOwner.Identifier", "PersistenceOwner.PropertyPattern",
            "PersistenceOwner.Recursive", "PersistenceOwner.EfString", "PersistenceOwner.Query", "PersistenceOwner.Conditional",
            "ServiceOwner.Member", "ArbitraryConfiguration.Executable");
    }

    public static TheoryData<string, string, string> MissingMatrixMutationCases => new()
    {
        { "Synthetic/Persistence/PersistenceMutation.cs", "PersistenceMutation", "public static bool Owner(InventoryIssue issue) => issue.MaterialRequestId != null;" },
        { "Synthetic/Services/ServiceMutation.cs", "ServiceMutation", "public static bool Owner(InventoryIssue issue) => issue.MaterialRequestId != null;" },
        { "Synthetic/Services/ArbitraryConfiguration.cs", "ArbitraryConfiguration", "public static bool Owner(InventoryIssue issue) => issue.MaterialRequestId != null;" },
        { "Synthetic/Services/MemberMutation.cs", "MemberMutation", "public static bool Owner(InventoryIssue issue) => issue.MaterialRequestId != null;" },
        { "Synthetic/Services/PropertyPatternMutation.cs", "PropertyPatternMutation", "public static bool Owner(InventoryIssue issue) => issue is { ReconciliationBatchId: not null };" },
        { "Synthetic/Services/RecursivePatternMutation.cs", "RecursivePatternMutation", "public static bool Owner(InventoryIssue issue) => issue is { MaterialRequestId.Length: > 0 };" },
        { "Synthetic/Services/QueryMutation.cs", "QueryMutation", "public static bool Owner(InventoryIssue[] issues) => (from issue in issues where issue.ReconciliationBatchId != null select issue).Any();" },
        { "Synthetic/Services/ConditionalMutation.cs", "ConditionalMutation", "public static int Owner(InventoryIssue? issue) => issue?.MaterialRequestId?.Length ?? 0;" },
        { "Synthetic/Services/AliasMutation.cs", "AliasMutation", "public static bool Owner(IssueAlias issue) { var MaterialRequestId = issue.MaterialRequestId; return MaterialRequestId != null; }" },
        { "Synthetic/Services/EfPropertyMutation.cs", "EfPropertyMutation", "public static object? Owner(InventoryIssue issue) => EF.Property<byte[]>(issue, \"MaterialRequestId\");" }
    };

    [Theory]
    [MemberData(nameof(MissingMatrixMutationCases))]
    public void AugmentedProductionSyntax_EachNewOwnerForcesExactMissingMatrixFailure(string path, string typeName, string body)
    {
        var fixture = $$"""
using System.Linq;
using Microsoft.EntityFrameworkCore;
using IssueAlias = IPCManagement.Api.Models.Entities.InventoryIssue;
namespace IPCManagement.Api.Models.Entities { public class InventoryIssue { public byte[]? MaterialRequestId {get;set;} public byte[]? ReconciliationBatchId {get;set;} } }
namespace Synthetic { using IPCManagement.Api.Models.Entities; public static class {{typeName}} { {{body}} } }
""";
        var discovered = DiscoverOwners([CSharpSyntaxTree.ParseText(fixture, path: path)], CreateReferences());
        discovered.Should().Equal($"{typeName}.Owner");

        var act = () => ValidateRegistry(Array.Empty<ConsumerRow>(), discovered);
        act.Should().Throw<Exception>().WithMessage($"*{typeName}.Owner*");
    }

    [Fact]
    public void SemanticDiscovery_FailsClosedForUnresolvedLineageCandidates()
    {
        var tree = CSharpSyntaxTree.ParseText("class Broken { void Owner(InventoryIssue issue) { _ = issue.MaterialRequestId; } }", path: "Broken.cs");
        var act = () => DiscoverOwners([tree], CreateReferences());
        act.Should().Throw<Exception>().WithMessage("*compilable semantic model*");
    }

    [Fact]
    public void DeclarativeEntityConfigurationAndContractFilesContainNoExecutableConsumers()
    {
        var root = ResolveRepoPath("backend/src");
        var declarative = Directory.EnumerateFiles(root, "*.cs", SearchOption.AllDirectories)
            .Where(path => path.Replace('\\', '/').Contains("/Models/Entities/", StringComparison.Ordinal) ||
                           path.Replace('\\', '/').Contains("/Data/Configurations/", StringComparison.Ordinal) ||
                           path.Replace('\\', '/').Contains("/Contracts/", StringComparison.Ordinal))
            .Where(path => !IsGenerated(path)).ToArray();
        var trees = declarative.Select(path => CSharpSyntaxTree.ParseText(File.ReadAllText(path), path: path)).ToArray();
        if (trees.Length > 0) DiscoverOwners(trees, CreateReferences()).Should().BeEmpty("declarative paths may not hide executable lineage consumers");
    }

    [Fact]
    public void OracleRegistryRejectsMissingStaleDuplicateAndUnresolvableMappings()
    {
        var valid = Matrix.ToList();
        Action missing = () => ValidateRegistry(valid.Skip(1), Matrix.Select(row => row.OwnerMethod));
        Action stale = () => ValidateRegistry(valid.Append(valid[0] with { OwnerMethod = "Stale.Owner" }), Matrix.Select(row => row.OwnerMethod));
        Action duplicate = () => ValidateRegistry(valid.Append(valid[0]), Matrix.Select(row => row.OwnerMethod));
        Action unresolved = () => ValidateRegistry(valid.Select((row, index) => index == 0 ? row with { OracleMethod = "MissingOracle" } : row), Matrix.Select(row => row.OwnerMethod));
        missing.Should().Throw<Exception>(); stale.Should().Throw<Exception>(); duplicate.Should().Throw<Exception>(); unresolved.Should().Throw<Exception>();
    }

    private static void ValidateRegistry(IEnumerable<ConsumerRow> rows, IEnumerable<string> discovered)
    {
        var materialized = rows.ToArray();
        var discoveredKeys = discovered.OrderBy(key => key, StringComparer.Ordinal).ToArray();
        materialized.Select(row => row.OwnerMethod).Should().OnlyHaveUniqueItems("each discovered owner has exactly one registry row");
        materialized.Select(row => row.OwnerMethod).Should().BeEquivalentTo(discoveredKeys,
            "registry owner keys must be the exact reverse coverage of semantic discovery. Registry: {0}; discovered: {1}",
            string.Join(", ", materialized.Select(row => row.OwnerMethod)), string.Join(", ", discoveredKeys));

        foreach (var row in materialized)
        {
            var oracle = ResolveOracle(row);
            oracle.Should().NotBeNull($"{row.OwnerMethod} must resolve one unique public oracle overload");
            oracle!.GetCustomAttributes().Any(attribute =>
                attribute.GetType().FullName == "Xunit.FactAttribute" || attribute.GetType().FullName == "Xunit.TheoryAttribute")
                .Should().BeTrue($"{row.OracleType.Name}.{row.OracleMethod} must be an executable xUnit test");
            oracle.IsAbstract.Should().BeFalse();
            oracle.ContainsGenericParameters.Should().BeFalse();
            if (oracle.GetCustomAttributes().Any(attribute => attribute.GetType().FullName == "Xunit.FactAttribute"))
                oracle.GetParameters().Should().BeEmpty("[Fact] oracles need a directly executable signature");
            (oracle.ReturnType == typeof(void) || oracle.ReturnType == typeof(Task) || oracle.ReturnType == typeof(ValueTask))
                .Should().BeTrue("oracle return type must be void, Task, or ValueTask");
            ValidateExactInvocationMapping(
                OracleSourceTransitivelyInvokesOwner(row),
                $"{row.OracleType.Name}.{row.OracleMethod}",
                row.OwnerMethod);
            row.CoveredOwnerKeys.Should().OnlyHaveUniqueItems();
            row.CoveredOwnerKeys.Should().Contain(row.OwnerMethod, "every oracle mapping must explicitly claim its row owner");
            row.CoveredOwnerKeys.Should().OnlyContain(key => discoveredKeys.Contains(key, StringComparer.Ordinal), "no oracle may claim an unknown owner");
        }

        foreach (var oracleGroup in materialized.GroupBy(row => (row.OracleType, row.OracleMethod)))
        {
            var declaredSets = oracleGroup.Select(row => string.Join("\n", row.CoveredOwnerKeys.OrderBy(key => key, StringComparer.Ordinal))).Distinct().ToArray();
            declaredSets.Should().ContainSingle("a shared oracle must repeat one explicit complete owner-key declaration on every row");
            oracleGroup.Select(row => row.OwnerMethod).Should().BeEquivalentTo(oracleGroup.First().CoveredOwnerKeys,
                "shared oracle reverse coverage must be exact, with no hidden or unclaimed owner");
        }
    }

    [Fact]
    public void ExactOracleCallGraphRejectsSameNameOverloadAndExtensionReceiverImpostors()
    {
        const string fixture = """
namespace Synthetic {
public sealed class TargetOwner { public void Execute(int value) { } public void Execute(string value) { } }
public sealed class UnrelatedOwner { public void Execute(int value) { } }
public static class OwnerExtensions { public static void Reserve(this TargetOwner owner) { } }
public static class UnrelatedExtensions { public static void Reserve(this UnrelatedOwner owner) { } }
public sealed class OracleFixture {
 public void SameName() { new UnrelatedOwner().Execute(1); }
 public void WrongOverload() { new TargetOwner().Execute("not-the-int-overload"); }
 public void WrongExtensionReceiver() { new UnrelatedOwner().Reserve(); }
 public void ExactOwner() { new TargetOwner().Execute(1); }
 public void ExactExtension() { new TargetOwner().Reserve(); }
}}
""";
        var tree = CSharpSyntaxTree.ParseText(fixture, path: "Synthetic/OracleFixture.cs");
        var graph = CreateSourceCallGraph([tree], CreateReferences());

        Action sameNameClaim = () => ValidateExactInvocationMapping(
            SourceTransitivelyInvokesOwner(graph, "Synthetic.OracleFixture", "SameName", "Synthetic.TargetOwner.Execute(int)"),
            "Synthetic.OracleFixture.SameName", "Synthetic.TargetOwner.Execute(int)");
        Action wrongOverloadClaim = () => ValidateExactInvocationMapping(
            SourceTransitivelyInvokesOwner(graph, "Synthetic.OracleFixture", "WrongOverload", "Synthetic.TargetOwner.Execute(int)"),
            "Synthetic.OracleFixture.WrongOverload", "Synthetic.TargetOwner.Execute(int)");
        Action wrongExtensionClaim = () => ValidateExactInvocationMapping(
            SourceTransitivelyInvokesOwner(graph, "Synthetic.OracleFixture", "WrongExtensionReceiver", "Synthetic.OwnerExtensions.Reserve(Synthetic.TargetOwner)"),
            "Synthetic.OracleFixture.WrongExtensionReceiver", "Synthetic.OwnerExtensions.Reserve(Synthetic.TargetOwner)");

        sameNameClaim.Should().Throw<Exception>().WithMessage("*Synthetic.TargetOwner.Execute(int)*");
        wrongOverloadClaim.Should().Throw<Exception>().WithMessage("*Synthetic.TargetOwner.Execute(int)*");
        wrongExtensionClaim.Should().Throw<Exception>().WithMessage("*Synthetic.OwnerExtensions.Reserve(Synthetic.TargetOwner)*");
        SourceTransitivelyInvokesOwner(graph, "Synthetic.OracleFixture", "ExactOwner", "Synthetic.TargetOwner.Execute(int)").Should().BeTrue();
        SourceTransitivelyInvokesOwner(graph, "Synthetic.OracleFixture", "ExactExtension", "Synthetic.OwnerExtensions.Reserve(Synthetic.TargetOwner)").Should().BeTrue();
    }

    private static void ValidateExactInvocationMapping(bool invokesOwner, string oracleIdentity, string ownerIdentity)
        => invokesOwner.Should().BeTrue($"{oracleIdentity} must demonstrate an exact source-symbol invocation path to {ownerIdentity}");

    private static bool OracleSourceTransitivelyInvokesOwner(ConsumerRow row)
    {
        var graph = RepositoryCallGraph.Value;
        var oracleType = (row.OracleType.FullName ?? row.OracleType.Name).Replace('+', '.');
        var oracle = ResolveSourceMethod(graph, oracleType, row.OracleMethod);
        if (oracle is null) return false;

        var targetCandidates = graph.Declarations.Keys
            .Where(symbol => OwnerKey(symbol) == row.OwnerMethod)
            .ToArray();
        targetCandidates.Should().NotBeEmpty($"{row.OwnerMethod} must normalize to at least one exact source symbol");
        return TransitivelyInvokedSymbols(graph, oracle).Any(reached =>
            targetCandidates.Any(target => SymbolEqualityComparer.Default.Equals(reached, target)));
    }

    private static SourceCallGraph CreateSourceCallGraph(IEnumerable<SyntaxTree> syntaxTrees, IEnumerable<MetadataReference> references)
    {
        var trees = syntaxTrees.Append(CSharpSyntaxTree.ParseText("""
global using Microsoft.AspNetCore.Builder;
global using Microsoft.AspNetCore.Hosting;
global using Microsoft.AspNetCore.Http;
global using Microsoft.AspNetCore.Routing;
global using Microsoft.Extensions.Configuration;
global using Microsoft.Extensions.DependencyInjection;
global using Microsoft.Extensions.Hosting;
global using Microsoft.Extensions.Logging;
global using System;
global using System.Collections.Generic;
global using System.IO;
global using System.Linq;
global using System.Net.Http;
global using System.Threading;
global using System.Threading.Tasks;
global using Xunit;
""", path: "Phase30.CallGraph.GlobalUsings.g.cs")).ToArray();
        var compilation = CSharpCompilation.Create("Phase30ExactOracleCallGraph", trees, references,
            new CSharpCompilationOptions(OutputKind.DynamicallyLinkedLibrary, nullableContextOptions: NullableContextOptions.Enable));
        // Source-generator declarations (for example [GeneratedRegex]) are completed only by the real
        // project build. The graph therefore fails closed at every reached invocation/method group rather
        // than accepting or rejecting unrelated generator diagnostics from unreachable test files.
        var declarations = new Dictionary<IMethodSymbol, MethodDeclarationSyntax>(SymbolEqualityComparer.Default);
        foreach (var tree in trees)
        {
            var model = compilation.GetSemanticModel(tree, ignoreAccessibility: true);
            foreach (var declaration in tree.GetRoot().DescendantNodes().OfType<MethodDeclarationSyntax>())
            {
                var symbol = model.GetDeclaredSymbol(declaration);
                if (symbol is not null) declarations[NormalizeMethod(symbol)] = declaration;
            }
        }
        return new SourceCallGraph(compilation, declarations);
    }

    private static IMethodSymbol? ResolveSourceMethod(SourceCallGraph graph, string fullyQualifiedType, string methodName)
    {
        var matches = graph.Declarations.Keys.Where(symbol =>
            FullyQualifiedType(symbol.ContainingType) == fullyQualifiedType && symbol.Name == methodName).ToArray();
        return matches.Length == 1 ? matches[0] : null;
    }

    private static HashSet<IMethodSymbol> TransitivelyInvokedSymbols(SourceCallGraph graph, IMethodSymbol root)
    {
        var reached = new HashSet<IMethodSymbol>(SymbolEqualityComparer.Default);
        var pending = new Queue<IMethodSymbol>();
        pending.Enqueue(NormalizeMethod(root));
        while (pending.TryDequeue(out var caller))
        {
            if (!graph.Declarations.TryGetValue(caller, out var declaration)) continue;
            var model = graph.Compilation.GetSemanticModel(declaration.SyntaxTree, ignoreAccessibility: true);
            foreach (var callee in ResolveCallees(declaration, model).SelectMany(symbol => ExactDispatchTargets(graph, symbol)))
            {
                if (!reached.Add(callee)) continue;
                if (graph.Declarations.ContainsKey(callee)) pending.Enqueue(callee);
            }
        }
        return reached;
    }

    private static IEnumerable<IMethodSymbol> ExactDispatchTargets(SourceCallGraph graph, IMethodSymbol called)
    {
        yield return called;
        foreach (var candidate in graph.Declarations.Keys)
        {
            if (candidate.OverriddenMethod is not null && SymbolEqualityComparer.Default.Equals(NormalizeMethod(candidate.OverriddenMethod), called))
            {
                yield return candidate;
                continue;
            }
            if (candidate.ExplicitInterfaceImplementations.Any(implemented =>
                    SymbolEqualityComparer.Default.Equals(NormalizeMethod(implemented), called)))
            {
                yield return candidate;
                continue;
            }
            if (called.ContainingType.TypeKind == TypeKind.Interface &&
                candidate.ContainingType.FindImplementationForInterfaceMember(called) is IMethodSymbol implementation &&
                SymbolEqualityComparer.Default.Equals(NormalizeMethod(implementation), candidate))
                yield return candidate;
        }
    }

    private static IEnumerable<IMethodSymbol> ResolveCallees(MethodDeclarationSyntax declaration, SemanticModel model)
    {
        var bodyNode = (SyntaxNode?)declaration.Body ?? declaration.ExpressionBody?.Expression;
        if (bodyNode is null) yield break;
        var rootOperation = model.GetOperation(bodyNode);
        if (rootOperation is null)
            throw new InvalidOperationException($"Unresolved method body in exact oracle call graph at {declaration.GetLocation().GetLineSpan()}");

        foreach (var operation in rootOperation.DescendantsAndSelf())
        {
            if (operation is IInvalidOperation invalid && invalid.Syntax is InvocationExpressionSyntax or MemberAccessExpressionSyntax)
                throw new InvalidOperationException($"Unresolved or ambiguous relevant call in exact oracle call graph at {invalid.Syntax.GetLocation().GetLineSpan()}: {invalid.Syntax}");
            if (operation is IInvocationOperation invocation)
                yield return NormalizeMethod(invocation.TargetMethod);
            else if (operation is IMethodReferenceOperation methodReference)
                yield return NormalizeMethod(methodReference.Method);
        }
    }

    private static bool SourceTransitivelyInvokesOwner(SourceCallGraph graph, string oracleType, string oracleMethod, string exactOwnerIdentity)
    {
        var oracle = ResolveSourceMethod(graph, oracleType, oracleMethod);
        oracle.Should().NotBeNull($"{oracleType}.{oracleMethod} must resolve exactly once");
        return TransitivelyInvokedSymbols(graph, oracle!).Any(symbol => MethodIdentity(symbol) == exactOwnerIdentity);
    }

    private static IMethodSymbol NormalizeMethod(IMethodSymbol symbol)
        => (symbol.ReducedFrom ?? symbol).OriginalDefinition;

    private static string OwnerKey(IMethodSymbol symbol)
        => $"{symbol.ContainingType.Name}.{symbol.Name}";

    private static string FullyQualifiedType(INamedTypeSymbol type)
        => type.ToDisplayString(SymbolDisplayFormat.CSharpErrorMessageFormat);

    private static string MethodIdentity(IMethodSymbol symbol)
    {
        var normalized = NormalizeMethod(symbol);
        var parameters = string.Join(",", normalized.Parameters.Select(parameter =>
            parameter.Type.ToDisplayString(SymbolDisplayFormat.CSharpErrorMessageFormat)));
        return $"{FullyQualifiedType(normalized.ContainingType)}.{normalized.Name}({parameters})";
    }

    private static string ResolveRepoPath(string relativePath)
    {
        var directory = new DirectoryInfo(AppContext.BaseDirectory);
        while (directory is not null && !File.Exists(Path.Combine(directory.FullName, "AGENTS.md"))) directory = directory.Parent;
        directory.Should().NotBeNull("the test must resolve production source from the repository root");
        return Path.Combine(directory!.FullName, relativePath.Replace('/', Path.DirectorySeparatorChar));
    }
}
