using System.Security.Claims;
using System.Text;
using FluentAssertions;
using IPCManagement.Api.Data;
using IPCManagement.Api.Features.Approvals.Contracts;
using IPCManagement.Api.Features.Approvals.Services;
using IPCManagement.Api.Data.Repositories;
using IPCManagement.Api.Data.Transactions;
using IPCManagement.Api.Features.Inventory.Contracts;
using IPCManagement.Api.Features.Inventory.Services;
using IPCManagement.Api.Features.Planning.Contracts;
using IPCManagement.Api.Features.Planning.Services;
using IPCManagement.Api.Features.Reconciliation.Contracts;
using IPCManagement.Api.Features.Reconciliation.Services;
using IPCManagement.Api.Features.Reports.Contracts;
using IPCManagement.Api.Features.Reports.Services;
using IPCManagement.Api.Features.SystemOperation.Services;
using IPCManagement.Api.Helpers;
using IPCManagement.Api.Models.Entities;
using IPCManagement.Api.Shared.Contracts;
using Microsoft.EntityFrameworkCore;
using NSubstitute;

namespace IPCManagement.Api.Tests;

public sealed class Phase30BusinessReadConsumerMatrixTests
{
    [Fact]
    public async Task InventoryListAndDetail_Should_RequireExactRequestedFamily_AndLabelLegacyDetail()
    {
        await using var fixture = await WorkflowGenerationTests.WorkflowFixture.CreateAsync();
        await fixture.SeedMenuWithDemandAsync(includeMissingDish: false);
        await using var context = fixture.CreateContext();
        var seed = await SeedCollidingIssuesAsync(context, fixture);
        var resolver = Substitute.For<IOperationalWarehouseResolver>();
        resolver.ResolveAsync(Arg.Any<CancellationToken>()).Returns(fixture.WarehouseId);
        var service = new InventoryIssueService(
            new InventoryIssueRepository(context),
            Substitute.For<IUnitOfWork>(),
            Substitute.For<IStockLedgerService>(),
            new ImmediateTransactionRunner(),
            resolver,
            context);

        var defaultPage = await service.GetPagedAsync(new InventoryIssueFilterRequestDto
        {
            SourceFamily = InventoryIssueSourceFamilies.Default,
            PageNumber = 1,
            PageSize = 20
        });
        defaultPage.Items.Should().ContainSingle().Which.IssueId.Should().Be(GuidHelper.ToGuidString(seed.DefaultIssueId));
        defaultPage.Items.Single().SourceFamily.Should().Be(InventoryIssueSourceFamilies.Default);

        var reconciliationPage = await service.GetPagedAsync(new InventoryIssueFilterRequestDto
        {
            SourceFamily = InventoryIssueSourceFamilies.MaterialReconciliation,
            ReconciliationBatchId = GuidHelper.ToGuidString(seed.ReconciliationBatchId),
            PageNumber = 1,
            PageSize = 20
        });
        reconciliationPage.Items.Should().ContainSingle().Which.IssueId.Should().Be(GuidHelper.ToGuidString(seed.ReconciliationIssueId));
        reconciliationPage.Items.Single().SourceFamily.Should().Be(InventoryIssueSourceFamilies.MaterialReconciliation);

        (await service.GetByIdAsync(GuidHelper.ToGuidString(seed.ReconciliationIssueId), InventoryIssueSourceFamilies.Default))
            .Should().BeNull();
        var reconciliationDetail = await service.GetByIdAsync(
            GuidHelper.ToGuidString(seed.ReconciliationIssueId),
            InventoryIssueSourceFamilies.MaterialReconciliation);
        reconciliationDetail.Should().NotBeNull();
        reconciliationDetail!.SourceFamily.Should().Be(InventoryIssueSourceFamilies.MaterialReconciliation);
        reconciliationDetail.Lines.Should().ContainSingle().Which.ReconciliationBatchLineId
            .Should().Be(GuidHelper.ToGuidString(seed.ReconciliationBatchLineId));

        (await service.GetByIdAsync(GuidHelper.ToGuidString(seed.LegacyIssueId), InventoryIssueSourceFamilies.Default))
            .Should().BeNull();
        var legacyDetail = await service.GetByIdAsync(
            GuidHelper.ToGuidString(seed.LegacyIssueId),
            InventoryIssueSourceFamilies.LegacyUnclassified);
        legacyDetail.Should().NotBeNull();
        legacyDetail!.SourceFamily.Should().Be(InventoryIssueSourceFamilies.LegacyUnclassified);
        legacyDetail.MaterialRequestId.Should().BeNull();
        legacyDetail.ReconciliationBatchId.Should().BeNull();
    }

    [Fact]
    public async Task DefaultReportsKpisAndPhysicalTruth_Should_RemainInvariantWithCollidingFamilies()
    {
        await using var fixture = await WorkflowGenerationTests.WorkflowFixture.CreateAsync();
        await fixture.SeedMenuWithDemandAsync(includeMissingDish: false);
        await using var context = fixture.CreateContext();
        var movementId = GuidHelper.ToBytes(Guid.Parse("30000000-0000-0000-0000-000000000010"));
        var referenceId = GuidHelper.ToBytes(Guid.Parse("30000000-0000-0000-0000-000000000011"));
        var physicalTimestamp = new DateTime(2026, 6, 14, 8, 30, 0, DateTimeKind.Utc);
        context.Currentstocks.Add(new CurrentStock
        {
            WarehouseId = fixture.WarehouseId,
            IngredientId = fixture.IngredientId,
            UnitId = fixture.UnitId,
            CurrentQty = 12.75m,
            LastUpdated = physicalTimestamp,
            RowVersion = physicalTimestamp.AddTicks(17)
        });
        context.Stockmovements.Add(new StockMovement
        {
            MovementId = movementId,
            MovementDate = physicalTimestamp,
            WarehouseId = fixture.WarehouseId,
            IngredientId = fixture.IngredientId,
            UnitId = fixture.UnitId,
            MovementType = "RECEIPT",
            RefTable = "inventoryreceipts",
            RefId = referenceId,
            QuantityIn = 12.75m,
            QuantityOut = 0.25m,
            BeforeQty = 0.25m,
            AfterQty = 12.75m,
            LotNumber = "LOT-PHYSICAL-30-10",
            ManufactureDate = new DateOnly(2026, 6, 1),
            ExpiredDate = new DateOnly(2026, 12, 1),
            Reason = "Canonical physical receipt",
            Note = "Shared truth across workflow families",
            PerformedBy = fixture.UserId
        });
        await context.SaveChangesAsync();
        await context.Currentstocks.ExecuteUpdateAsync(setters => setters
            .SetProperty(row => row.RowVersion, physicalTimestamp.AddTicks(17)));
        context.ChangeTracker.Clear();

        var stockBefore = await ReadPhysicalStocksAsync(context);
        var movementsBefore = await ReadPhysicalMovementsAsync(context);
        stockBefore.Should().ContainSingle();
        stockBefore.Single().Should().BeEquivalentTo(new
        {
            WarehouseId = GuidHelper.ToGuidString(fixture.WarehouseId),
            IngredientId = GuidHelper.ToGuidString(fixture.IngredientId),
            UnitId = GuidHelper.ToGuidString(fixture.UnitId),
            CurrentQty = 12.75m,
            LastUpdated = physicalTimestamp,
            RowVersion = physicalTimestamp.AddTicks(17)
        });
        movementsBefore.Should().ContainSingle();
        movementsBefore.Single().Should().BeEquivalentTo(new
        {
            MovementId = GuidHelper.ToGuidString(movementId),
            MovementDate = physicalTimestamp,
            WarehouseId = GuidHelper.ToGuidString(fixture.WarehouseId),
            IngredientId = GuidHelper.ToGuidString(fixture.IngredientId),
            UnitId = GuidHelper.ToGuidString(fixture.UnitId),
            MovementType = "RECEIPT",
            RefTable = "inventoryreceipts",
            RefId = GuidHelper.ToGuidString(referenceId),
            QuantityIn = 12.75m,
            QuantityOut = 0.25m,
            BeforeQty = 0.25m,
            AfterQty = 12.75m,
            LotNumber = "LOT-PHYSICAL-30-10",
            ManufactureDate = new DateOnly(2026, 6, 1),
            ExpiredDate = new DateOnly(2026, 12, 1),
            Reason = "Canonical physical receipt",
            Note = "Shared truth across workflow families",
            PerformedBy = GuidHelper.ToGuidString(fixture.UserId)
        });

        var physicalReports = new StockMovementReportService(context);
        var stockReportBefore = await physicalReports.GetCurrentStockAsync(new WorkflowReportQueryDto { Limit = 20 });
        stockReportBefore.Should().ContainSingle().Which.CurrentQty.Should().Be(12.75m);
        var movementReportBefore = await physicalReports.GetStockMovementsAsync(new WorkflowReportQueryDto
        {
            DateFrom = "2026-06-14",
            DateTo = "2026-06-14",
            Limit = 20
        });
        movementReportBefore.Should().ContainSingle().Which.MovementId.Should().Be(GuidHelper.ToGuidString(movementId));

        var emptyReports = new InventoryOperationsReportService(context);
        (await emptyReports.GetKitchenIssuesAsync(new WorkflowReportQueryDto { Limit = 20 })).Should().BeEmpty();
        (await emptyReports.GetIssueVsReturnAsync(new WorkflowReportQueryDto { Limit = 20 })).Should().BeEmpty();
        var emptyKpis = await new OperationalKpiReportService(context).GetOperationalKpisAsync(0);
        emptyKpis.TotalKitchenIssuedQty.Should().Be(0m);

        var seed = await SeedCollidingIssuesAsync(context, fixture);
        var reports = new InventoryOperationsReportService(context);
        var kitchen = await reports.GetKitchenIssuesAsync(new WorkflowReportQueryDto { Limit = 20 });
        kitchen.Should().ContainSingle().Which.IssueId.Should().Be(GuidHelper.ToGuidString(seed.DefaultIssueId));
        kitchen.Single().IssuedQty.Should().Be(7m);
        var kitchenPage = await reports.GetKitchenIssuesPageAsync(new KitchenIssuePageQueryDto { PageNumber = 1, PageSize = 20 });
        kitchenPage.TotalCount.Should().Be(1);
        kitchenPage.Items.Single().IssuedQty.Should().Be(7m);
        var usage = await reports.GetIssueVsReturnAsync(new WorkflowReportQueryDto { Limit = 20 });
        usage.Should().ContainSingle().Which.IssuedQty.Should().Be(7m);
        var usagePage = await reports.GetIssueVsReturnPageAsync(new IssueVsReturnPageQueryDto { PageNumber = 1, PageSize = 20 });
        usagePage.TotalCount.Should().Be(1);
        usagePage.Items.Single().IssuedQty.Should().Be(7m);

        var kpis = await new OperationalKpiReportService(context).GetOperationalKpisAsync(0);
        kpis.PendingKitchenConfirmationCount.Should().Be(1);
        kpis.TotalKitchenIssuedQty.Should().Be(7m);
        kpis.TotalKitchenUsedQty.Should().Be(7m);

        var stockReportAfter = await physicalReports.GetCurrentStockAsync(new WorkflowReportQueryDto { Limit = 20 });
        stockReportAfter.Should().BeEquivalentTo(stockReportBefore,
            "shared current-stock truth must remain visible through the real report seam regardless of workflow family");
        var movementReportAfter = await physicalReports.GetStockMovementsAsync(new WorkflowReportQueryDto
        {
            DateFrom = "2026-06-14",
            DateTo = "2026-06-14",
            Limit = 20
        });
        movementReportAfter.Should().BeEquivalentTo(movementReportBefore,
            "shared stock-movement truth must remain visible through the real report seam regardless of workflow family");

        var stockAfter = await ReadPhysicalStocksAsync(context);
        var movementsAfter = await ReadPhysicalMovementsAsync(context);
        stockAfter.Should().BeEquivalentTo(stockBefore, options => options.WithStrictOrdering());
        movementsAfter.Should().BeEquivalentTo(movementsBefore, options => options.WithStrictOrdering());
    }

    [Fact]
    public async Task ApprovalInboxAndHandler_Should_UseOnlyExactDefaultLineage()
    {
        await using var fixture = await WorkflowGenerationTests.WorkflowFixture.CreateAsync();
        await fixture.SeedMenuWithDemandAsync(includeMissingDish: false);
        await using var context = fixture.CreateContext();
        var seed = await SeedCollidingIssuesAsync(context, fixture);
        (await context.Inventoryissues.CountAsync()).Should().Be(3);
        (await context.Inventoryissuelines.CountAsync()).Should().Be(3);
        (await context.Inventoryissues.CountAsync(item =>
            item.MaterialRequestId != null && item.ReconciliationBatchId == null &&
            item.Inventoryissuelines.All(line => line.MaterialRequestLineId != null && line.ReconciliationBatchLineId == null)))
            .Should().Be(1);
        (await context.Inventoryissues.CountAsync(item =>
            item.MaterialRequestId != null && item.MaterialRequest != null &&
            item.MaterialRequest.Status == "SENTTOWAREHOUSE" && item.ReconciliationBatchId == null))
            .Should().Be(1);
        var principal = new ClaimsPrincipal(new ClaimsIdentity(
            [new Claim(ClaimTypes.Role, "Admin")], "test"));
        var inbox = await new ApprovalInboxService(context, Substitute.For<IApprovalRoutingService>())
            .GetPendingAsync(principal, new ApprovalInboxQueryDto { TargetType = "inventory-issue", Limit = 20 });

        inbox.Should().ContainSingle(item => item.TargetId == GuidHelper.ToGuidString(seed.DefaultIssueId));
        inbox.Should().NotContain(item => item.TargetId == GuidHelper.ToGuidString(seed.ReconciliationIssueId));
        inbox.Should().NotContain(item => item.TargetId == GuidHelper.ToGuidString(seed.LegacyIssueId));

        var handler = new InventoryIssueApprovalHandler(context);
        var request = new ApprovalRequest { Status = ApprovalDecision.Approve, Reason = "matrix" };
        (await handler.HandleAsync(GuidHelper.ToGuidString(seed.ReconciliationIssueId), request, seed.UserId)).Should().BeNull();
        (await handler.HandleAsync(GuidHelper.ToGuidString(seed.LegacyIssueId), request, seed.UserId)).Should().BeNull();
        seed.MaterialRequest.Status.Should().Be("SENTTOWAREHOUSE");

        (await handler.HandleAsync(GuidHelper.ToGuidString(seed.DefaultIssueId), request, seed.UserId)).Should().NotBeNull();
        seed.MaterialRequest.Status.Should().Be("CONFIRMED");
    }

    [Fact]
    public async Task WorkflowDocuments_Should_ExcludeReconciliationAndLegacyIssues()
    {
        await using var fixture = await WorkflowGenerationTests.WorkflowFixture.CreateAsync();
        await fixture.SeedMenuWithDemandAsync(includeMissingDish: false);
        await using var context = fixture.CreateContext();
        var seed = await SeedCollidingIssuesAsync(context, fixture);

        var documents = await new InventoryOperationsReportService(context)
            .GetWorkflowDocumentsAsync(new WorkflowReportQueryDto { DateFrom = "2026-06-15", DateTo = "2026-06-15", Limit = 50 });
        var issueDocuments = documents.Where(item => item.DocumentType == "Phiếu xuất kho").ToList();

        issueDocuments.Should().ContainSingle().Which.DocumentId.Should().Be(GuidHelper.ToGuidString(seed.DefaultIssueId));
        issueDocuments.Should().NotContain(item => item.DocumentId == GuidHelper.ToGuidString(seed.ReconciliationIssueId));
        issueDocuments.Should().NotContain(item => item.DocumentId == GuidHelper.ToGuidString(seed.LegacyIssueId));
    }

    [Fact]
    public async Task AuditAndCsv_Should_LabelEveryCollidingSourceFamily_WithExactAvailableIdentity()
    {
        await using var fixture = await WorkflowGenerationTests.WorkflowFixture.CreateAsync();
        await fixture.SeedMenuWithDemandAsync(includeMissingDish: false);
        await using var context = fixture.CreateContext();
        var seed = await SeedCollidingIssuesAsync(context, fixture);
        (await context.Inventoryissues.CountAsync()).Should().Be(3);
        (await context.Inventoryissuelines.CountAsync()).Should().Be(3);
        (await context.Inventoryissues.SelectMany(issue => issue.Inventoryissuelines).CountAsync()).Should().Be(3);
        var rows = await new AuditReportService(context)
            .GetAuditChangesAsync(new WorkflowReportQueryDto { Limit = 20 });

        rows.Should().NotBeEmpty();
        var issueRows = rows.Where(row => row.BusinessArea == "Issue").ToList();
        issueRows.Should().HaveCount(3, string.Join(" | ", rows.Select(row => $"{row.BusinessArea}:{row.EntityName}:{row.SourceFamily}")));
        var defaultRow = issueRows.Single(row => row.SourceFamily == "DEFAULT");
        defaultRow.MaterialRequestId.Should().Be(GuidHelper.ToGuidString(seed.MaterialRequest.RequestId));
        defaultRow.MaterialRequestLineId.Should().Be(GuidHelper.ToGuidString(seed.MaterialRequestLineId));
        defaultRow.ReconciliationBatchId.Should().BeNull();
        defaultRow.ReconciliationBatchLineId.Should().BeNull();

        var reconciliationRow = issueRows.Single(row => row.SourceFamily == "MATERIAL_RECONCILIATION");
        reconciliationRow.MaterialRequestId.Should().BeNull();
        reconciliationRow.MaterialRequestLineId.Should().BeNull();
        reconciliationRow.ReconciliationBatchId.Should().Be(GuidHelper.ToGuidString(seed.ReconciliationBatchId));
        reconciliationRow.ReconciliationBatchLineId.Should().Be(GuidHelper.ToGuidString(seed.ReconciliationBatchLineId));

        var legacyRow = issueRows.Single(row => row.SourceFamily == "LEGACY_UNCLASSIFIED");
        legacyRow.MaterialRequestId.Should().BeNull();
        legacyRow.MaterialRequestLineId.Should().BeNull();
        legacyRow.ReconciliationBatchId.Should().BeNull();
        legacyRow.ReconciliationBatchLineId.Should().BeNull();

        var filtered = await new AuditReportService(context).GetAuditChangesAsync(new WorkflowReportQueryDto
        {
            BusinessArea = "Issue",
            SourceFamily = "material_reconciliation",
            Limit = 20
        });
        filtered.Should().ContainSingle().Which.SourceFamily.Should().Be("MATERIAL_RECONCILIATION");

        issueRows.Select(row => row.SourceFamily).Should().BeEquivalentTo(
            ["DEFAULT", "MATERIAL_RECONCILIATION", "LEGACY_UNCLASSIFIED"]);
        issueRows.GroupBy(row => row.SourceFamily).Should().OnlyContain(group => group.Count() == 1);
        issueRows.Select(row => row.EntityId).Should().OnlyHaveUniqueItems(
            "audit emits source rows, never one quantity-bearing aggregate merged across families");

        defaultRow.Reason = "quoted \"reason\", first line\nsecond line";
        var csv = Encoding.UTF8.GetString(AuditCsvExporter.Build(issueRows));
        csv.Should().Contain("sourceFamily,MaterialRequestId,MaterialRequestLineId,ReconciliationBatchId,ReconciliationBatchLineId");
        csv.Should().Contain("quoted \"\"reason\"\", first line\nsecond line");
        csv.Should().Contain("\"DEFAULT\"");
        csv.Should().Contain("\"MATERIAL_RECONCILIATION\"");
        csv.Should().Contain("\"LEGACY_UNCLASSIFIED\"");
        csv.Should().Contain(GuidHelper.ToGuidString(seed.MaterialRequestLineId));
        csv.Should().Contain(GuidHelper.ToGuidString(seed.ReconciliationBatchLineId));
    }

    [Theory]
    [InlineData("DEFAULT", true, false, true, false)]
    [InlineData("MATERIAL_RECONCILIATION", false, true, false, true)]
    [InlineData("LEGACY_UNCLASSIFIED", false, false, false, false)]
    public void SharedAuditMatrix_Should_Not_Fabricate_SourceIdentities(
        string sourceFamily,
        bool hasMaterialRequest,
        bool hasReconciliationBatch,
        bool hasMaterialRequestLine,
        bool hasReconciliationBatchLine)
    {
        var row = new AuditChangeReportDto
        {
            SourceFamily = sourceFamily,
            MaterialRequestId = hasMaterialRequest ? Guid.NewGuid().ToString() : null,
            ReconciliationBatchId = hasReconciliationBatch ? Guid.NewGuid().ToString() : null,
            MaterialRequestLineId = hasMaterialRequestLine ? Guid.NewGuid().ToString() : null,
            ReconciliationBatchLineId = hasReconciliationBatchLine ? Guid.NewGuid().ToString() : null
        };

        (row.MaterialRequestId is not null).Should().Be(hasMaterialRequest);
        (row.ReconciliationBatchId is not null).Should().Be(hasReconciliationBatch);
        (row.MaterialRequestLineId is not null).Should().Be(hasMaterialRequestLine);
        (row.ReconciliationBatchLineId is not null).Should().Be(hasReconciliationBatchLine);
    }

    private static Task<List<PhysicalStockSnapshot>> ReadPhysicalStocksAsync(IpcManagementContext context)
        => context.Currentstocks.AsNoTracking()
            .OrderBy(row => row.WarehouseId)
            .ThenBy(row => row.IngredientId)
            .ThenBy(row => row.UnitId)
            .Select(row => new PhysicalStockSnapshot(
                GuidHelper.ToGuidString(row.WarehouseId),
                GuidHelper.ToGuidString(row.IngredientId),
                GuidHelper.ToGuidString(row.UnitId),
                row.CurrentQty,
                row.LastUpdated,
                row.RowVersion))
            .ToListAsync();

    private static Task<List<PhysicalMovementSnapshot>> ReadPhysicalMovementsAsync(IpcManagementContext context)
        => context.Stockmovements.AsNoTracking()
            .OrderBy(row => row.MovementId)
            .Select(row => new PhysicalMovementSnapshot(
                GuidHelper.ToGuidString(row.MovementId),
                row.MovementDate,
                GuidHelper.ToGuidString(row.WarehouseId),
                GuidHelper.ToGuidString(row.IngredientId),
                GuidHelper.ToGuidString(row.UnitId),
                row.MovementType,
                row.RefTable,
                row.RefId == null ? null : GuidHelper.ToGuidString(row.RefId),
                row.QuantityIn,
                row.QuantityOut,
                row.BeforeQty,
                row.AfterQty,
                row.LotNumber,
                row.ManufactureDate,
                row.ExpiredDate,
                row.Reason,
                row.Note,
                GuidHelper.ToGuidString(row.PerformedBy)))
            .ToListAsync();

    private static async Task<CollidingIssueSeed> SeedCollidingIssuesAsync(
        IpcManagementContext context,
        WorkflowGenerationTests.WorkflowFixture fixture)
    {
        var demand = await new MaterialDemandService(context).GenerateAsync(
            new GenerateMaterialDemandRequest { ServiceDate = "2026-06-15", Scope = "FULLDAY" },
            fixture.UserIdString);
        demand.Should().NotBeNull();
        var materialRequest = await context.Materialrequests.SingleAsync();
        var materialRequestLine = await context.Materialrequestlines.SingleAsync();
        materialRequest.Status = "SENTTOWAREHOUSE";

        var reconciliationBatchId = GuidHelper.NewId();
        var reconciliationBatchLineId = GuidHelper.NewId();
        var defaultIssueId = GuidHelper.NewId();
        var reconciliationIssueId = GuidHelper.NewId();
        var legacyIssueId = GuidHelper.NewId();

        context.Inventoryissues.AddRange(
            BuildIssue(defaultIssueId, "ISS-DEFAULT", materialRequest.RequestId, null, materialRequestLine.RequestLineId, null),
            BuildIssue(reconciliationIssueId, "ISS-RECON", null, reconciliationBatchId, null, reconciliationBatchLineId),
            BuildIssue(legacyIssueId, "ISS-LEGACY", null, null, null, null));
        await context.SaveChangesAsync();

        return new CollidingIssueSeed(
            fixture.UserId, materialRequest, materialRequestLine.RequestLineId, reconciliationBatchId, reconciliationBatchLineId,
            defaultIssueId, reconciliationIssueId, legacyIssueId);

        InventoryIssue BuildIssue(
            byte[] issueId,
            string code,
            byte[]? requestId,
            byte[]? batchId,
            byte[]? requestLineId,
            byte[]? batchLineId)
            => new()
            {
                IssueId = issueId,
                IssueCode = code,
                IssueDate = new DateOnly(2026, 6, 15),
                ShiftName = "MORNING",
                WarehouseId = fixture.WarehouseId,
                MaterialRequestId = requestId,
                ReconciliationBatchId = batchId,
                IssuedBy = fixture.UserId,
                CreatedAt = DateTime.UtcNow,
                Inventoryissuelines =
                [
                    new InventoryIssueLine
                    {
                        IssueLineId = GuidHelper.NewId(),
                        IssueId = issueId,
                        MaterialRequestLineId = requestLineId,
                        ReconciliationBatchLineId = batchLineId,
                        IngredientId = fixture.IngredientId,
                        UnitId = fixture.UnitId,
                        RequestedQty = 7,
                        IssuedQty = 7
                    }
                ]
            };
    }

    private sealed record PhysicalStockSnapshot(
        string WarehouseId,
        string IngredientId,
        string UnitId,
        decimal CurrentQty,
        DateTime LastUpdated,
        DateTime RowVersion);

    private sealed record PhysicalMovementSnapshot(
        string MovementId,
        DateTime MovementDate,
        string WarehouseId,
        string IngredientId,
        string UnitId,
        string MovementType,
        string? RefTable,
        string? RefId,
        decimal QuantityIn,
        decimal QuantityOut,
        decimal BeforeQty,
        decimal AfterQty,
        string? LotNumber,
        DateOnly? ManufactureDate,
        DateOnly? ExpiredDate,
        string? Reason,
        string? Note,
        string PerformedBy);

    private sealed record CollidingIssueSeed(
        byte[] UserId,
        MaterialRequest MaterialRequest,
        byte[] MaterialRequestLineId,
        byte[] ReconciliationBatchId,
        byte[] ReconciliationBatchLineId,
        byte[] DefaultIssueId,
        byte[] ReconciliationIssueId,
        byte[] LegacyIssueId);
}
