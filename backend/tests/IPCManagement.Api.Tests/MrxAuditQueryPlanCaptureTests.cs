using FluentAssertions;
using IPCManagement.Api.Data;
using IPCManagement.Api.Features.Reconciliation.Services;
using IPCManagement.Api.Helpers;
using Microsoft.EntityFrameworkCore;

namespace IPCManagement.Api.Tests;

[Trait("Category", "EvidenceOwned")]
public sealed class MrxAuditQueryPlanCaptureTests
{
    [Fact]
    public void Generated_plan_uses_the_complete_production_typed_audit_scope()
    {
        var options = new DbContextOptionsBuilder<IpcManagementContext>()
            .UseMySql(
                "Server=localhost;Port=3306;Database=ipc_mrx_evidence_query_shape;User=test;Password=test",
                new MySqlServerVersion(new Version(9, 5, 0)))
            .Options;
        using var context = new IpcManagementContext(options);

        var sql = new MrxAuditScopeQuery(context)
            .Apply(context.Auditlogs.AsNoTracking(), GuidHelper.NewId())
            .OrderByDescending(audit => audit.ChangedAt)
            .Take(25)
            .ToQueryString();

        foreach (var entityName in new[]
                 {
                     "ReconciliationBatch", "ReconciliationBatchLine", "ReconciliationBatchDailyLine",
                     "ReconciliationBatchContributor", "ReconciliationSourceRevision", "ReconciliationSourceDelta",
                     "ReconciliationDisposition", "ReconciliationDailyDisposition", "ReconciliationActual",
                     "ReconciliationActualRevision", "InventoryIssue", "InventoryIssueLine", "InventoryReturn",
                     "InventoryReturnLine", "StockMovement", "MenuAmendment", "MealQuantityPlanLine",
                     "MenuSchedule", "MenuVersion", "QuantityImportBatch",
                 })
        {
            sql.Should().Contain(entityName, $"the production audit branch for {entityName} must reach EXPLAIN");
        }

        foreach (var table in new[]
                 {
                     "auditlogs", "reconciliationbatches", "reconciliationbatchlines",
                     "reconciliationbatchdailylines", "reconciliationbatchcontributors",
                     "reconciliationsourcerevisions", "reconciliationsourcedeltas",
                     "reconciliationdispositions", "reconciliationdailydispositions",
                     "reconciliationactuals", "reconciliationactualrevisions", "inventoryissues",
                     "inventoryissuelines", "inventoryreturns", "inventoryreturnlines", "stockmovements",
                     "menuamendments",
                 })
        {
            sql.Should().Contain(table, $"the production relation {table} must reach EXPLAIN");
        }

        var outputPath = Environment.GetEnvironmentVariable("MRX_AUDIT_PLAN_SQL_OUTPUT");
        if (string.IsNullOrWhiteSpace(outputPath)) return;

        var selectIndex = sql.IndexOf("SELECT", StringComparison.Ordinal);
        selectIndex.Should().BeGreaterThanOrEqualTo(0);
        var explainSql = sql.Insert(selectIndex, "EXPLAIN FORMAT=JSON\n");
        Directory.CreateDirectory(Path.GetDirectoryName(Path.GetFullPath(outputPath))!);
        File.WriteAllText(outputPath, explainSql);
    }
}
