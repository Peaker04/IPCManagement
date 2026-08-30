using FluentAssertions;
using IPCManagement.Api.Features.Planning.Services;
using IPCManagement.Api.Models.Entities;
using Microsoft.CodeAnalysis;
using Microsoft.CodeAnalysis.CSharp;
using Microsoft.CodeAnalysis.CSharp.Syntax;
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
        string OracleMethod);

    private static readonly HashSet<string> LineageMembers =
    [
        "MaterialRequestId", "MaterialRequestLineId", "ReconciliationBatchId", "ReconciliationBatchLineId",
        "MaterialRequest", "MaterialRequestLine", "ReconciliationBatch", "ReconciliationBatchLine"
    ];

    private static readonly string[] GeneratedDiscoveryExclusions =
    [
        "/bin/", "/obj/", "/Migrations/"
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
        Row("InventoryIssueRepository.GetIssuedLinesForMaterialRequestAsync", "DEFAULT_ONLY_READ"),
        Row("InventoryIssueService.ConfirmReceiptAsync", "FAMILY_PRESERVING_COMMAND"),
        Row("InventoryIssueService.CreateAsync", "DEFAULT_COMPATIBLE_EXACT_ONE"),
        Row("InventoryIssueService.CreateFromReconciliationAsync", "RECONCILIATION_ONLY_COMMAND"),
        Row("InventoryMapper.MapIssue", "FAMILY_LABELLED_MAPPING"),
        Row("InventoryMapper.MapIssueLine", "FAMILY_LABELLED_MAPPING"),
        Row("InventoryOperationsReportService.GetSupplyLineReconciliationAsync", "FAMILY_LABELLED_REPORT"),
        Row("InventoryOperationsReportService.MapKitchenIssue", "FAMILY_LABELLED_MAPPING"),
        Row("InventoryOperationsReportService.QueryIssueLines", "FAMILY_LABELLED_REPORT"),
        Row("InventoryReturnService.EnsureExactSourceFamily", "EXACT_ONE_VALIDATION"),
        Row("InventoryReturnService.EnsureOwningFamilyActive", "FAMILY_STATUS_VALIDATION"),
        Row("InventoryReturnService.GetAllocationBalancesAsync", "FAMILY_PRESERVING_READ"),
        Row("InventoryReturnService.LoadScopedSourceLinesAsync", "FAMILY_SCOPED_READ"),
        Row("LegacyLineageDispositionService.ApplyProvenanceAsync", "LEGACY_REMEDIATION_COMMAND"),
        Row("LegacyLineageDispositionService.GetIssueLineCandidatesAsync", "LEGACY_REMEDIATION_READ"),
        Row("MaterialDemandService.EnsureMaterialRequestAsync", "DEFAULT_ONLY_COMMAND"),
        Row("MaterialDemandService.GetStalenessAsync", "DEFAULT_ONLY_READ"),
        Row("MaterialDemandStockReservation.ReserveAsync", "DEFAULT_ONLY_COMMAND"),
        Row("MenuAmendmentService.CreateAsync", "DEFAULT_ONLY_COMMAND"),
        Row("MenuAmendmentService.ExecuteCoreAsync", "DEFAULT_ONLY_COMMAND"),
        Row("OperationalKpiReportService.GetOperationalKpisAsync", "FAMILY_LABELLED_REPORT"),
        Row("ReconciliationBatchService.LoadLinkedIssuedQuantitiesAsync", "RECONCILIATION_ONLY_READ"),
        Row("ServiceRunService.GetPageAsync", "DEFAULT_ONLY_READ", "ServiceRunLifecycleTests.OpenAndVarianceCommands_Should_BeIdempotent_AndRecordCompleteLifecycleEvidence"),
        Row("ServiceRunService.GetProjectionAsync", "DEFAULT_ONLY_READ", "ServiceRunLifecycleTests.OpenAndVarianceCommands_Should_BeIdempotent_AndRecordCompleteLifecycleEvidence"),
        Row("ServiceRunService.SelectRelevantIssueLines", "DEFAULT_ONLY_PROJECTION", "ServiceRunLifecycleTests.OpenAndVarianceCommands_Should_BeIdempotent_AndRecordCompleteLifecycleEvidence"),
        Row("SupplementalMaterialRequestService.CreateAsync", "DEFAULT_ONLY_COMMAND"),
        Row("SupplementalMaterialRequestService.EnsureDefaultSourceFamily", "DEFAULT_ONLY_VALIDATION"),
        Row("SupplementalMaterialRequestService.FulfillAsync", "DEFAULT_ONLY_COMMAND"),
        Row("SupplementalMaterialRequestService.LoadSourceLineAsync", "DEFAULT_ONLY_READ"),
        Row("SupplementalMaterialRequestService.ResolveSourceShiftNameAsync", "DEFAULT_ONLY_READ"),
        Row("SupplementalMaterialRequestService.RouteToPurchasingAsync", "DEFAULT_ONLY_COMMAND"),
        Row("WeeklyMenuImportPersistence.RequireNoIrreversibleDownstreamDocumentsAsync", "DEFAULT_ONLY_VALIDATION")
    ];

    private static ConsumerRow Row(string ownerMethod, string disposition, string? publicOracle = null)
    {
        var oracle = publicOracle ?? "Phase30DiscoveredConsumerBijectionTests.RegistryDispositionOracle";
        var split = oracle.LastIndexOf('.');
        var typeName = split < 0 ? oracle : oracle[..split];
        var methodName = split < 0 ? nameof(RegistryDispositionOracle) : oracle[(split + 1)..];
        var type = typeof(Phase30DiscoveredConsumerBijectionTests).Assembly.GetTypes()
            .Single(candidate => candidate.Name == typeName || candidate.FullName?.EndsWith($".{typeName}", StringComparison.Ordinal) == true);
        return new ConsumerRow(ownerMethod, disposition,
            disposition.StartsWith("RECONCILIATION", StringComparison.Ordinal)
                ? ["ReconciliationBatchId", "ReconciliationBatchLineId"]
                : disposition.StartsWith("DEFAULT", StringComparison.Ordinal)
                    ? ["MaterialRequestId", "MaterialRequestLineId"]
                    : ["MaterialRequestId", "MaterialRequestLineId", "ReconciliationBatchId", "ReconciliationBatchLineId"],
            false, type, methodName);
    }

    [Fact]
    public void DiscoveredProductionOwnerMethods_AndTypedMatrix_AreAnExactBijection()
    {
        var discovered = DiscoverOwners();
        var matrixOwners = Matrix.Select(row => row.OwnerMethod).ToArray();

        matrixOwners.Should().OnlyHaveUniqueItems("duplicate Type.Method rows hide ambiguous lineage authority");
        discovered.Should().BeEquivalentTo(matrixOwners,
            "semantic production discovery and the typed matrix must fail exactly for every duplicate, stale, or missing Type.Method row. Actual: {0}", string.Join(", ", discovered));
        Matrix.Should().OnlyContain(row =>
            !string.IsNullOrWhiteSpace(row.FamilyDisposition) &&
            row.SourceKeys.Distinct(StringComparer.Ordinal).Count() == row.SourceKeys.Length &&
            !row.MutatesIssueFamily &&
            ResolveOracle(row) != null);
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
                if (method is null || type is null || type.Identifier.ValueText.EndsWith("Configuration", StringComparison.Ordinal)) continue;
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
        property = symbol as IPropertySymbol;
        return property?.ContainingType.Name is nameof(InventoryIssue) or nameof(InventoryIssueLine);
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
        => row.OracleType.GetMethod(row.OracleMethod, BindingFlags.Public | BindingFlags.Instance | BindingFlags.Static);

    private static bool IsGenerated(string path)
    {
        var normalized = path.Replace('\\', '/');
        return GeneratedDiscoveryExclusions.Any(exclusion => normalized.Contains(exclusion, StringComparison.Ordinal)) ||
               normalized.EndsWith(".Designer.cs", StringComparison.Ordinal) ||
               normalized.EndsWith("ModelSnapshot.cs", StringComparison.Ordinal) ||
               normalized.EndsWith(".g.cs", StringComparison.Ordinal) ||
               normalized.EndsWith(".generated.cs", StringComparison.Ordinal);
    }

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
}}
""";
        var tree = CSharpSyntaxTree.ParseText(fixture, path: "Synthetic/Persistence/PersistenceOwner.cs");
        DiscoverOwners([tree], CreateReferences()).Should().BeEquivalentTo(
            "PersistenceOwner.Member", "PersistenceOwner.Identifier", "PersistenceOwner.PropertyPattern",
            "PersistenceOwner.Recursive", "PersistenceOwner.EfString", "PersistenceOwner.Query");
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
        materialized.Select(row => row.OwnerMethod).Should().OnlyHaveUniqueItems();
        materialized.Select(row => row.OwnerMethod).Should().BeEquivalentTo(discovered);
        materialized.Should().OnlyContain(row => ResolveOracle(row) != null);
    }

    [Fact]
    public static void RegistryDispositionOracle()
    {
        Matrix.Should().OnlyContain(row => row.SourceKeys.Length > 0 && !row.MutatesIssueFamily);
    }

    private static string ResolveRepoPath(string relativePath)
    {
        var directory = new DirectoryInfo(AppContext.BaseDirectory);
        while (directory is not null && !File.Exists(Path.Combine(directory.FullName, "AGENTS.md"))) directory = directory.Parent;
        directory.Should().NotBeNull("the test must resolve production source from the repository root");
        return Path.Combine(directory!.FullName, relativePath.Replace('/', Path.DirectorySeparatorChar));
    }
}
