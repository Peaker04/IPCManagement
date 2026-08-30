using System.Reflection;
using System.Text;
using FluentAssertions;
using IPCManagement.Api.Features.Planning.Services;
using IPCManagement.Api.Models.Entities;

namespace IPCManagement.Api.Tests;

public sealed class Phase30DiscoveredConsumerBijectionTests
{
    private sealed record ConsumerRow(
        string Owner,
        string FamilyDisposition,
        string[] SourceKeys,
        bool MutatesIssueFamily,
        string PublicSeam,
        string OracleMethod);

    private static readonly string[] LineageMembers =
    [
        "MaterialRequestId",
        "MaterialRequestLineId",
        "ReconciliationBatchId",
        "ReconciliationBatchLineId",
        "MaterialRequest",
        "MaterialRequestLine",
        "ReconciliationBatch",
        "ReconciliationBatchLine"
    ];

    private static readonly IReadOnlyDictionary<string, string> ProductionOwners =
        new Dictionary<string, string>(StringComparer.Ordinal)
        {
            ["DataQualityReportService"] = "backend/src/IPCManagement.Api/Features/Reports/Services/DataQualityReportService.cs",
            ["DataQualityCommandService"] = "backend/src/IPCManagement.Api/Features/Reports/Services/DataQualityCommandService.cs",
            ["DishCatalogDiagnosticsService"] = "backend/src/IPCManagement.Api/Features/Catalog/Services/DishCatalogDiagnosticsService.cs",
            ["MaterialDemandService"] = "backend/src/IPCManagement.Api/Features/Planning/Services/MaterialDemandService.cs",
            ["MaterialDemandStockReservation"] = "backend/src/IPCManagement.Api/Features/Planning/Services/MaterialDemandStockReservation.cs",
            ["ServiceRunService"] = "backend/src/IPCManagement.Api/Features/Planning/Services/ServiceRunService.cs",
            ["MenuAmendmentService"] = "backend/src/IPCManagement.Api/Features/SampleData/Services/MenuAmendmentService.cs",
            ["WeeklyMenuImportPersistence"] = "backend/src/IPCManagement.Api/Features/SampleData/Services/WeeklyMenuImportPersistence.cs"
        };

    private static readonly ConsumerRow[] Matrix =
    [
        new("DataQualityReportService", "LABELLED_AUDIT", ["MaterialRequestId", "ReconciliationBatchId"], false, "GetDataQualityAsync", nameof(DataQualityReport_LabelsOnlyExactDefaultOrphans)),
        new("DataQualityCommandService", "FAMILY_PRESERVING_COMMAND", ["MaterialRequestId", "ReconciliationBatchId"], false, "CleanupDataQualityAsync", nameof(DataQualityCommand_DeletesOnlyExactDefaultOrphans)),
        new("DishCatalogDiagnosticsService", "SHARED_NOT_APPLICABLE", [], false, "GetBomCoverageAsync/GetBomValidationAsync", nameof(DishCatalogDiagnostics_IsExecutableNotApplicable)),
        new("MaterialDemandService", "DEFAULT_ONLY", ["MaterialRequestId"], false, "GenerateAsync/GetStalenessAsync", nameof(MaterialDemand_UsesExactDefaultIssueOwnership)),
        new("MaterialDemandStockReservation", "DEFAULT_ONLY", ["MaterialRequestId", "MaterialRequestLineId"], false, "ReserveAsync", nameof(MaterialDemandReservation_UsesExactDefaultIssueOwnership)),
        new("ServiceRunService", "DEFAULT_ONLY", ["MaterialRequestId", "MaterialRequestLineId"], false, "GetProjectionAsync/GetPageAsync", nameof(ServiceRun_IgnoresReconciliationAndLegacyIssueLines)),
        new("MenuAmendmentService", "DEFAULT_ONLY", ["MaterialRequestId", "MaterialRequestLineId"], false, "CreateAsync/ExecuteAsync", nameof(MenuAmendment_UsesExactDefaultIssueOwnership)),
        new("WeeklyMenuImportPersistence", "DEFAULT_ONLY", ["MaterialRequestId", "MaterialRequestLineId"], false, "CommitAsync", nameof(WeeklyMenuImport_UsesExactDefaultIssueOwnership))
    ];

    [Fact]
    public void DiscoveredProductionOwners_AndTypedMatrix_AreAnExactBijection()
    {
        var discovered = DiscoverOwners();
        var matrixOwners = Matrix.Select(row => row.Owner).ToArray();

        matrixOwners.Should().OnlyHaveUniqueItems("duplicate matrix rows hide ambiguous family authority");
        discovered.Should().BeEquivalentTo(matrixOwners,
            "every concrete source owner must have exactly one executable family row, with no stale advertised rows");

        foreach (var row in Matrix)
        {
            row.FamilyDisposition.Should().NotBeNullOrWhiteSpace();
            row.PublicSeam.Should().NotBeNullOrWhiteSpace();
            row.MutatesIssueFamily.Should().BeFalse("none of these consumers owns lineage reclassification");
            GetType().GetMethod(row.OracleMethod, BindingFlags.Instance | BindingFlags.Public)
                .Should().NotBeNull($"matrix owner {row.Owner} must name an executable oracle");
        }
    }

    [Fact]
    public void DataQualityReport_LabelsOnlyExactDefaultOrphans()
        => ReadProduction("DataQualityReportService").Should().Contain(
            "issue.MaterialRequestId != null && issue.ReconciliationBatchId == null",
            "reconciliation and legacy issues are labelled by their own family, not as DEFAULT orphans");

    [Fact]
    public void DataQualityCommand_DeletesOnlyExactDefaultOrphans()
        => ReadProduction("DataQualityCommandService").Should().Contain(
            "issue.MaterialRequestId != null && issue.ReconciliationBatchId == null",
            "cleanup must have a public zero-effect path for valid reconciliation and legacy issues");

    [Fact]
    public void DishCatalogDiagnostics_IsExecutableNotApplicable()
    {
        var semanticTokens = Tokenize(ReadProduction("DishCatalogDiagnosticsService"));
        semanticTokens.Should().NotContain("ReconciliationBatchId");
        semanticTokens.Should().NotContain("ReconciliationBatchLineId");
        semanticTokens.Should().NotContain("MaterialRequestId");
        semanticTokens.Should().NotContain("MaterialRequestLineId");
    }

    [Fact]
    public void MaterialDemand_UsesExactDefaultIssueOwnership()
        => ReadProduction("MaterialDemandService").Should().Contain(
            "issue.MaterialRequestId != null && issue.ReconciliationBatchId == null",
            "only exact DEFAULT issues may block demand regeneration");

    [Fact]
    public void MaterialDemandReservation_UsesExactDefaultIssueOwnership()
    {
        var source = ReadProduction("MaterialDemandStockReservation");
        source.Should().Contain("line.Issue.MaterialRequestId != null && line.Issue.ReconciliationBatchId == null");
        source.Should().Contain("line.MaterialRequestLineId != null && line.ReconciliationBatchLineId == null");
    }

    [Fact]
    public void ServiceRun_IgnoresReconciliationAndLegacyIssueLines()
    {
        var defaultDemandLine = Guid.NewGuid().ToByteArray();
        var reconciliationLine = new InventoryIssueLine
        {
            IssueLineId = Guid.NewGuid().ToByteArray(),
            IngredientId = Guid.NewGuid().ToByteArray(),
            UnitId = Guid.NewGuid().ToByteArray(),
            ReconciliationBatchLineId = Guid.NewGuid().ToByteArray(),
            IssuedQty = 4
        };
        var legacyLine = new InventoryIssueLine
        {
            IssueLineId = Guid.NewGuid().ToByteArray(),
            IngredientId = Guid.NewGuid().ToByteArray(),
            UnitId = Guid.NewGuid().ToByteArray(),
            IssuedQty = 3
        };
        var exactDefaultLine = new InventoryIssueLine
        {
            IssueLineId = Guid.NewGuid().ToByteArray(),
            IngredientId = Guid.NewGuid().ToByteArray(),
            UnitId = Guid.NewGuid().ToByteArray(),
            MaterialRequestLineId = defaultDemandLine,
            IssuedQty = 2
        };
        var issues = new[]
        {
            new InventoryIssue { IssueId = Guid.NewGuid().ToByteArray(), ShiftName = "MORNING", ReconciliationBatchId = Guid.NewGuid().ToByteArray(), Inventoryissuelines = [reconciliationLine] },
            new InventoryIssue { IssueId = Guid.NewGuid().ToByteArray(), ShiftName = "MORNING", Inventoryissuelines = [legacyLine] },
            new InventoryIssue { IssueId = Guid.NewGuid().ToByteArray(), ShiftName = "MORNING", MaterialRequestId = Guid.NewGuid().ToByteArray(), Inventoryissuelines = [exactDefaultLine] }
        };
        var demand = new[] { new MaterialRequestLine { RequestLineId = defaultDemandLine } };

        ServiceRunService.SelectRelevantIssueLines(issues, demand, "MORNING")
            .Should().ContainSingle().Which.Should().BeSameAs(exactDefaultLine);
    }

    [Fact]
    public void MenuAmendment_UsesExactDefaultIssueOwnership()
        => ReadProduction("MenuAmendmentService").Should().Contain(
            "item.MaterialRequestId != null && item.ReconciliationBatchId == null",
            "paired reconciliation and legacy issues must not lock or classify DEFAULT amendments");

    [Fact]
    public void WeeklyMenuImport_UsesExactDefaultIssueOwnership()
        => ReadProduction("WeeklyMenuImportPersistence").Should().Contain(
            "issue.MaterialRequestId != null && issue.ReconciliationBatchId == null",
            "replacement protection must navigate only exact DEFAULT ancestry");

    private static string[] DiscoverOwners()
        => ProductionOwners
            .Where(pair => pair.Key == "DishCatalogDiagnosticsService" ||
                           Tokenize(File.ReadAllText(ResolveRepoPath(pair.Value))).Any(LineageMembers.Contains))
            .Select(pair => pair.Key)
            .OrderBy(owner => owner, StringComparer.Ordinal)
            .ToArray();

    private static string ReadProduction(string owner)
        => File.ReadAllText(ResolveRepoPath(ProductionOwners[owner]));

    private static string ResolveRepoPath(string relativePath)
    {
        var directory = new DirectoryInfo(AppContext.BaseDirectory);
        while (directory is not null && !File.Exists(Path.Combine(directory.FullName, "AGENTS.md")))
        {
            directory = directory.Parent;
        }

        directory.Should().NotBeNull("the test must resolve production source from the repository root");
        return Path.Combine(directory!.FullName, relativePath.Replace('/', Path.DirectorySeparatorChar));
    }

    private static IReadOnlyList<string> Tokenize(string source)
    {
        var tokens = new List<string>();
        var current = new StringBuilder();
        var state = LexState.Code;
        for (var index = 0; index < source.Length; index++)
        {
            var value = source[index];
            var next = index + 1 < source.Length ? source[index + 1] : '\0';
            switch (state)
            {
                case LexState.Code when value == '/' && next == '/': Flush(); state = LexState.LineComment; index++; break;
                case LexState.Code when value == '/' && next == '*': Flush(); state = LexState.BlockComment; index++; break;
                case LexState.Code when value == '"': Flush(); state = LexState.String; break;
                case LexState.Code when value == '\'': Flush(); state = LexState.Character; break;
                case LexState.Code when char.IsLetterOrDigit(value) || value == '_': current.Append(value); break;
                case LexState.Code: Flush(); break;
                case LexState.LineComment when value == '\n': state = LexState.Code; break;
                case LexState.BlockComment when value == '*' && next == '/': state = LexState.Code; index++; break;
                case LexState.String when value == '\\': index++; break;
                case LexState.String when value == '"': state = LexState.Code; break;
                case LexState.Character when value == '\\': index++; break;
                case LexState.Character when value == '\'': state = LexState.Code; break;
            }
        }
        Flush();
        return tokens;

        void Flush()
        {
            if (current.Length == 0) return;
            tokens.Add(current.ToString());
            current.Clear();
        }
    }

    private enum LexState { Code, LineComment, BlockComment, String, Character }
}
