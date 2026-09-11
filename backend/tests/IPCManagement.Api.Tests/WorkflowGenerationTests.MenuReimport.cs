using FluentAssertions;
using IPCManagement.Api.Exceptions;
using NSubstitute;
using IPCManagement.Api.Data;
using IPCManagement.Api.Data.Transactions;
using IPCManagement.Api.Data.Repositories;
using IPCManagement.Api.Helpers;
using IPCManagement.Api.Models.Entities;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using System.Data.Common;
using System.Diagnostics;
using System.Reflection;
using System.Security.Claims;
using IPCManagement.Api.Features.Approvals.Contracts;
using IPCManagement.Api.Features.Approvals.Services;
using IPCManagement.Api.Features.Coordination.Contracts;
using IPCManagement.Api.Features.Coordination.Services;
using IPCManagement.Api.Features.Inventory.Contracts;
using IPCManagement.Api.Features.Inventory.Services;
using IPCManagement.Api.Features.Planning.Contracts;
using IPCManagement.Api.Features.Planning.Services;
using IPCManagement.Api.Features.Purchasing.Contracts;
using IPCManagement.Api.Features.Purchasing.Services;
using IPCManagement.Api.Features.Reports.Contracts;
using IPCManagement.Api.Features.Reports.Services;
using IPCManagement.Api.Features.SampleData.Services;
using IPCManagement.Api.Features.SampleData.Contracts;
using IPCManagement.Api.Shared.Contracts;

namespace IPCManagement.Api.Tests;

public partial class WorkflowGenerationTests
{
    [Fact]
    public async Task MaterialDemand_PublicGenerationStalenessAndReservation_IgnoreCollidingIssueFamilies()
    {
        await using var fixture = await WorkflowFixture.CreateAsync();
        await fixture.SeedMenuWithDemandAsync(includeMissingDish: false);
        await using var context = fixture.CreateContext();
        context.Currentstocks.Add(new CurrentStock
        {
            WarehouseId = fixture.WarehouseId, IngredientId = fixture.IngredientId, UnitId = fixture.UnitId,
            CurrentQty = 250m, LastUpdated = DateTime.UtcNow, RowVersion = DateTime.UtcNow
        });
        await context.SaveChangesAsync();

        var service = new MaterialDemandService(context);
        var first = await service.GenerateAsync(
            new GenerateMaterialDemandRequest { ServiceDate = "2026-06-15", Scope = "FULLDAY" }, fixture.UserIdString);
        first.Should().NotBeNull();
        first!.Lines.Should().ContainSingle().Which.Should().Match<MaterialDemandLineDto>(line =>
            line.TotalRequiredQty == 200m && line.CurrentStockQty == 250m && line.SuggestedPurchaseQty == 0m);
        var firstRequestId = GuidHelper.ParseGuidString(first.MaterialRequestId)!;
        var firstRequestLineId = await context.Materialrequestlines.Select(line => line.RequestLineId).SingleAsync();

        await SeedSecondDemandDayAsync(context, fixture);
        await SeedCollidingIssueFamiliesAsync(context, fixture, firstRequestId, firstRequestLineId, includeDefault: true);
        var frozenNonDefault = await NonDefaultIssueSnapshotAsync(context);

        var second = await service.GenerateAsync(
            new GenerateMaterialDemandRequest { ServiceDate = "2026-06-16", Scope = "FULLDAY" }, fixture.UserIdString);
        var staleness = await service.GetStalenessAsync("2026-06-15", fixture.CustomerIdString, "FULLDAY");

        second.Should().NotBeNull();
        second!.Lines.Should().ContainSingle().Which.Should().Match<MaterialDemandLineDto>(line =>
            line.TotalRequiredQty == 200m && line.CurrentStockQty == 100m && line.SuggestedPurchaseQty == 100m,
            "the earlier DEFAULT request reserves 200 minus its exact 50 issued quantity; reconciliation and legacy collisions reserve nothing");
        staleness.MaterialRequestId.Should().Be(first.MaterialRequestId);
        staleness.CanRegenerate.Should().BeFalse();
        staleness.RegenerationBlockReason.Should().Contain("phiếu xuất kho");
        (await context.Materialrequests.AsNoTracking().OrderBy(request => request.RequestDate).Select(request => new { request.RequestCode, request.RequestDate, request.Status }).ToListAsync())
            .Should().HaveCount(2).And.OnlyContain(request => request.Status == "DRAFT");
        (await context.Materialrequestlines.AsNoTracking().OrderBy(line => line.Request.RequestDate).Select(line => new { line.TotalRequiredQty, line.CurrentStockQty, line.SuggestedPurchaseQty }).ToListAsync())
            .Should().Equal(
                new { TotalRequiredQty = 200m, CurrentStockQty = 250m, SuggestedPurchaseQty = 0m },
                new { TotalRequiredQty = 200m, CurrentStockQty = 100m, SuggestedPurchaseQty = 100m });
        (await context.Inventoryissues.AsNoTracking().Include(issue => issue.Inventoryissuelines).OrderBy(issue => issue.IssueCode).Select(issue => new
        {
            issue.IssueCode, issue.MaterialRequestId, issue.ReconciliationBatchId,
            Lines = issue.Inventoryissuelines.Select(line => new { line.IssuedQty, line.MaterialRequestLineId, line.ReconciliationBatchLineId }).ToList()
        }).ToListAsync()).Should().SatisfyRespectively(
            issue => { issue.IssueCode.Should().Be("ISS-DEFAULT-COLLISION"); issue.MaterialRequestId.Should().Equal(firstRequestId); issue.ReconciliationBatchId.Should().BeNull(); issue.Lines.Should().ContainSingle().Which.IssuedQty.Should().Be(50m); },
            issue => { issue.IssueCode.Should().Be("ISS-LEGACY-COLLISION"); issue.MaterialRequestId.Should().BeNull(); issue.ReconciliationBatchId.Should().BeNull(); issue.Lines.Should().ContainSingle().Which.IssuedQty.Should().Be(70m); },
            issue => { issue.IssueCode.Should().Be("ISS-RECON-COLLISION"); issue.MaterialRequestId.Should().BeNull(); issue.ReconciliationBatchId.Should().NotBeNull(); issue.Lines.Should().ContainSingle().Which.IssuedQty.Should().Be(80m); });
        (await context.Currentstocks.AsNoTracking().SingleAsync()).CurrentQty.Should().Be(250m, "reservation is an in-memory allocation and never mutates persisted stock");
        (await NonDefaultIssueSnapshotAsync(context)).Should().Be(frozenNonDefault, "reconciliation and legacy rows must remain value-stable through generation, reservation, and staleness");
        (await context.Stockmovements.CountAsync()).Should().Be(0);
    }

    [Fact]
    public async Task MenuAmendment_PublicCreateAndExecute_PreserveCollidingFamiliesAndReadySnapshot()
    {
        await using var fixture = await WorkflowFixture.CreateAsync();
        await fixture.SeedMenuWithDemandAsync(includeMissingDish: false);
        await using var context = fixture.CreateContext();
        (await context.Menuschedules.SingleAsync()).Status = "DRAFT";
        await SeedCollidingIssueFamiliesAsync(context, fixture, null, null, includeDefault: false);
        await SeedReadyReconciliationSnapshotAsync(context, fixture);
        var frozenReady = await FrozenReadySnapshotAsync(context);
        var frozenIssues = await NonDefaultIssueSnapshotAsync(context);
        var versionCountBefore = await context.Menuversions.CountAsync();
        var service = new MenuAmendmentService(context);
        var slot = (await context.Menuitems.SingleAsync()).DishSlot ?? "main";

        var amendment = await service.CreateAsync(new CreateMenuAmendmentRequest
        {
            CustomerId = fixture.CustomerIdString, WeekStartDate = new DateOnly(2026, 6, 15), Reason = "Đổi món không chạm họ chứng từ khác.",
            Lines = [new CreateMenuAmendmentLineRequest { ServiceDate = new DateOnly(2026, 6, 15), ShiftName = "MORNING", DishSlot = slot, NewDishId = GuidHelper.ToGuidString(fixture.DishWithBomId) }]
        }, fixture.UserIdString);
        amendment.RequiresReconciliation.Should().BeFalse();
        var reviewer = await CreateApprovalActorAsync(context, "collision-reviewer");
        var executor = await CreateApprovalActorAsync(context, "collision-executor");
        await service.ReviewAsync(amendment.MenuAmendmentId, new ReviewMenuAmendmentRequest { Approved = true }, reviewer);

        var executed = await service.ExecuteAsync(amendment.MenuAmendmentId, executor);

        executed.Status.Should().Be("EXECUTED");
        executed.AppliedMenuVersionId.Should().NotBeNullOrWhiteSpace();
        (await FrozenReadySnapshotAsync(context)).Should().Be(frozenReady);
        (await NonDefaultIssueSnapshotAsync(context)).Should().Be(frozenIssues);
        (await context.Materialrequests.CountAsync()).Should().Be(0);
        (await context.Purchaserequests.CountAsync()).Should().Be(0);
        (await context.Stockmovements.CountAsync()).Should().Be(0);
        (await context.Currentstocks.CountAsync()).Should().Be(0);
        (await context.Menuversions.CountAsync()).Should().Be(versionCountBefore + 1, "changed source creates exactly one new menu version instead of mutating READY reconciliation facts");
    }

    [Fact]
    public async Task WeeklyMenuReimport_PublicCommitPreservesReadySnapshotAndCollidingFamilies()
    {
        await using var fixture = await WorkflowFixture.CreateAsync();
        await fixture.SeedMenuWithDemandAsync(includeMissingDish: false);
        await using var context = fixture.CreateContext();
        (await context.Menuschedules.SingleAsync()).Status = "DRAFT";
        await SeedCollidingIssueFamiliesAsync(context, fixture, null, null, includeDefault: false);
        await SeedReadyReconciliationSnapshotAsync(context, fixture);
        var frozenReady = await FrozenReadySnapshotAsync(context);
        var frozenIssues = await NonDefaultIssueSnapshotAsync(context);
        var customer = await context.Customers.SingleAsync();
        var serviceDate = new DateOnly(2026, 6, 15);
        var plan = new WeeklyMenuImportPlan("collision-reimport.xlsx", "CUS 25k", "C", serviceDate, serviceDate, 10,
            [new WeeklyMenuImportDayColumn("D", serviceDate, "t2", "D - 15/06/2026", 7)], serviceDate)
        { SourceChecksum = "COLLISION-REIMPORT-V2" };
        plan.Sections.Add("MENU MẶN- CA SÁNG");
        plan.Items.Add(new ParsedWeeklyMenuItem
        {
            SourceOrder = 1, ServiceDate = serviceDate, DayKey = "t2", SourceRowNumber = 9, SourceColumn = "D",
            SectionLabel = "MENU MẶN- CA SÁNG", SectionKey = "savory-morning", SourceShift = "MORNING",
            SourceShiftLabel = "Ca sáng", DbShiftName = "MORNING", VariantKey = "savory", VariantLabel = "Mặn",
            Slot = "main", SlotLabel = "Món chính", DishName = "Dish with BOM"
        });

        var versionCountBefore = await context.Menuversions.CountAsync();
        var act = () => CreateWeeklyMenuImportPersistence(context).CommitAsync(plan, customer, 25_000m, fixture.UserIdString, CancellationToken.None);

        await act.Should().ThrowAsync<BusinessRuleException>().WithMessage("*Không thể import lại thực đơn tuần*");
        context.ChangeTracker.Clear();
        (await FrozenReadySnapshotAsync(context)).Should().Be(frozenReady);
        (await NonDefaultIssueSnapshotAsync(context)).Should().Be(frozenIssues);
        (await context.Materialrequests.CountAsync()).Should().Be(0);
        (await context.Purchaserequests.CountAsync()).Should().Be(0);
        (await context.Stockmovements.CountAsync()).Should().Be(0);
        (await context.Menuversions.CountAsync()).Should().Be(versionCountBefore);
    }

    private static async Task SeedSecondDemandDayAsync(IpcManagementContext context, WorkflowFixture fixture)
    {
        var firstSchedule = await context.Menuschedules.SingleAsync();
        var firstQuantityPlan = await context.Mealquantityplans.SingleAsync();
        var scheduleId = GuidHelper.NewId();
        var quantityPlanId = GuidHelper.NewId();
        context.Menuschedules.Add(new MenuSchedule
        {
            MenuScheduleId = scheduleId, CustomerId = firstSchedule.CustomerId, MenuId = firstSchedule.MenuId,
            ServiceDate = new DateOnly(2026, 6, 16), WeekStartDate = firstSchedule.WeekStartDate,
            ShiftName = firstSchedule.ShiftName, MenuPrice = firstSchedule.MenuPrice,
            BomRatePercent = firstSchedule.BomRatePercent, Status = "ACTIVE"
        });
        context.Mealquantityplans.Add(new MealQuantityPlan
        {
            QuantityPlanId = quantityPlanId, PlanCode = "QTY-COLLISION-20260616", ServiceDate = new DateOnly(2026, 6, 16),
            Status = firstQuantityPlan.Status, ForecastReceivedAt = firstQuantityPlan.ForecastReceivedAt,
            ConfirmedAt = firstQuantityPlan.ConfirmedAt, ConfirmationTime = firstQuantityPlan.ConfirmationTime,
            ConfirmedBy = firstQuantityPlan.ConfirmedBy
        });
        context.Mealquantityplanlines.Add(new MealQuantityPlanLine
        {
            QuantityPlanLineId = GuidHelper.NewId(), QuantityPlanId = quantityPlanId, MenuScheduleId = scheduleId,
            CustomerId = firstSchedule.CustomerId, MenuId = firstSchedule.MenuId, ShiftName = firstSchedule.ShiftName,
            ForecastServings = 100, ConfirmedServings = 100, FinalServings = 100
        });
        await context.SaveChangesAsync();
    }

    private static async Task SeedCollidingIssueFamiliesAsync(IpcManagementContext context, WorkflowFixture fixture, byte[]? requestId, byte[]? requestLineId, bool includeDefault)
    {
        var families = new List<(InventoryIssue Issue, decimal Quantity)>
        {
            (new InventoryIssue { IssueId = GuidHelper.NewId(), IssueCode = "ISS-RECON-COLLISION", IssueDate = new DateOnly(2026, 6, 16), WarehouseId = fixture.WarehouseId, ReconciliationBatchId = GuidHelper.NewId(), IssuedBy = fixture.UserId, CreatedAt = DateTime.UtcNow }, 80m),
            (new InventoryIssue { IssueId = GuidHelper.NewId(), IssueCode = "ISS-LEGACY-COLLISION", IssueDate = new DateOnly(2026, 6, 16), WarehouseId = fixture.WarehouseId, IssuedBy = fixture.UserId, CreatedAt = DateTime.UtcNow }, 70m)
        };
        if (includeDefault)
            families.Add((new InventoryIssue { IssueId = GuidHelper.NewId(), IssueCode = "ISS-DEFAULT-COLLISION", IssueDate = new DateOnly(2026, 6, 16), WarehouseId = fixture.WarehouseId, MaterialRequestId = requestId, IssuedBy = fixture.UserId, CreatedAt = DateTime.UtcNow }, 50m));
        foreach (var (issue, quantity) in families)
            issue.Inventoryissuelines.Add(new InventoryIssueLine { IssueLineId = GuidHelper.NewId(), IngredientId = fixture.IngredientId, UnitId = fixture.UnitId, IssuedQty = quantity, MaterialRequestLineId = issue.MaterialRequestId is null ? null : requestLineId, ReconciliationBatchLineId = issue.ReconciliationBatchId is null ? null : GuidHelper.NewId() });
        context.Inventoryissues.AddRange(families.Select(item => item.Issue));
        await context.SaveChangesAsync();
    }

    private static async Task SeedReadyReconciliationSnapshotAsync(IpcManagementContext context, WorkflowFixture fixture)
    {
        await context.Database.ExecuteSqlRawAsync("""
CREATE TABLE IF NOT EXISTS reconciliationbatches (
 BatchId BLOB NOT NULL PRIMARY KEY, MenuVersionId BLOB NOT NULL, QuantityImportBatchId BLOB NOT NULL,
 Status TEXT NOT NULL, Version INTEGER NOT NULL, CreatedBy BLOB NOT NULL, CreatedAt TEXT NOT NULL,
 ReadyBy BLOB NULL, ReadyAt TEXT NULL, CompletedBy BLOB NULL, CompletedAt TEXT NULL);
CREATE UNIQUE INDEX IF NOT EXISTS IX_reconciliationbatches_QuantityImportBatchId ON reconciliationbatches (QuantityImportBatchId);
CREATE TABLE IF NOT EXISTS reconciliationbatchlines (
 BatchLineId BLOB NOT NULL PRIMARY KEY, BatchId BLOB NOT NULL, IngredientId BLOB NOT NULL, CanonicalUnitId BLOB NOT NULL,
 RequiredQuantity TEXT NOT NULL, FrozenTolerance TEXT NOT NULL, ToleranceSourceKind TEXT NOT NULL,
 ToleranceSourceVersion TEXT NOT NULL, Version INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS reconciliationbatchcontributors (
 ContributorId BLOB NOT NULL PRIMARY KEY, BatchLineId BLOB NOT NULL, MenuScheduleId BLOB NOT NULL,
 MealQuantityPlanLineId BLOB NOT NULL, DishBomId BLOB NOT NULL, SourceQuantity TEXT NOT NULL);
""");
        var line = new ReconciliationBatchLine
        {
            BatchLineId = GuidHelper.NewId(), IngredientId = fixture.IngredientId, CanonicalUnitId = fixture.UnitId,
            RequiredQuantity = 17.25m, FrozenTolerance = 0.125m, ToleranceSourceKind = "SYSTEM_DEFAULT", ToleranceSourceVersion = "frozen-v1", Version = 4,
            Contributors = [new ReconciliationBatchContributor { ContributorId = GuidHelper.NewId(), MenuScheduleId = GuidHelper.NewId(), MealQuantityPlanLineId = GuidHelper.NewId(), DishBomId = GuidHelper.NewId(), SourceQuantity = 17.25m }]
        };
        context.Reconciliationbatches.Add(new ReconciliationBatch
        {
            BatchId = GuidHelper.NewId(), MenuVersionId = GuidHelper.NewId(), QuantityImportBatchId = GuidHelper.NewId(), Status = "READY", Version = 9,
            CreatedBy = fixture.UserId, CreatedAt = new DateTime(2026, 6, 14, 8, 30, 0, DateTimeKind.Utc), ReadyBy = fixture.UserId,
            ReadyAt = new DateTime(2026, 6, 14, 9, 0, 0, DateTimeKind.Utc), Lines = [line]
        });
        await context.SaveChangesAsync();
    }

    private static async Task<string> FrozenReadySnapshotAsync(IpcManagementContext context)
    {
        context.ChangeTracker.Clear();
        var batches = await context.Reconciliationbatches.AsNoTracking().Include(batch => batch.Lines).ThenInclude(line => line.Contributors)
            .Where(batch => batch.Status == "READY").OrderBy(batch => batch.BatchId).ToListAsync();
        return System.Text.Json.JsonSerializer.Serialize(batches.Select(batch => new
        {
            BatchId = Convert.ToHexString(batch.BatchId), MenuVersionId = Convert.ToHexString(batch.MenuVersionId), QuantityImportBatchId = Convert.ToHexString(batch.QuantityImportBatchId), batch.Status, batch.Version,
            CreatedBy = Convert.ToHexString(batch.CreatedBy), batch.CreatedAt, ReadyBy = batch.ReadyBy == null ? null : Convert.ToHexString(batch.ReadyBy), batch.ReadyAt, CompletedBy = batch.CompletedBy == null ? null : Convert.ToHexString(batch.CompletedBy), batch.CompletedAt,
            Lines = batch.Lines.OrderBy(line => line.BatchLineId).Select(line => new { BatchLineId = Convert.ToHexString(line.BatchLineId), BatchId = Convert.ToHexString(line.BatchId), IngredientId = Convert.ToHexString(line.IngredientId), CanonicalUnitId = Convert.ToHexString(line.CanonicalUnitId), line.RequiredQuantity, line.FrozenTolerance, line.ToleranceSourceKind, line.ToleranceSourceVersion, line.Version,
                Contributors = line.Contributors.OrderBy(item => item.ContributorId).Select(item => new { ContributorId = Convert.ToHexString(item.ContributorId), BatchLineId = Convert.ToHexString(item.BatchLineId), MenuScheduleId = Convert.ToHexString(item.MenuScheduleId), MealQuantityPlanLineId = Convert.ToHexString(item.MealQuantityPlanLineId), DishBomId = Convert.ToHexString(item.DishBomId), item.SourceQuantity }) })
        }));
    }

    private static async Task<string> NonDefaultIssueSnapshotAsync(IpcManagementContext context)
    {
        context.ChangeTracker.Clear();
        var issues = await context.Inventoryissues.AsNoTracking().Include(issue => issue.Inventoryissuelines)
            .Where(issue => issue.MaterialRequestId == null).OrderBy(issue => issue.IssueCode).ToListAsync();
        var issueProperties = context.Model.FindEntityType(typeof(InventoryIssue))!.GetProperties().OrderBy(property => property.Name).ToArray();
        var lineProperties = context.Model.FindEntityType(typeof(InventoryIssueLine))!.GetProperties().OrderBy(property => property.Name).ToArray();
        return System.Text.Json.JsonSerializer.Serialize(issues.Select(issue => new
        {
            Values = issueProperties.ToDictionary(property => property.Name, property => SnapshotScalar(property.PropertyInfo!.GetValue(issue))),
            Lines = issue.Inventoryissuelines.OrderBy(line => Convert.ToHexString(line.IssueLineId)).Select(line =>
                lineProperties.ToDictionary(property => property.Name, property => SnapshotScalar(property.PropertyInfo!.GetValue(line))))
        }));
    }

    private static object? SnapshotScalar(object? value)
        => value is byte[] bytes ? Convert.ToHexString(bytes) : value;
    [Fact]
    public async Task MenuAmendment_Should_SnapshotSafeDemandImpact_WithoutMutatingMenu()
    {
        await using var fixture = await WorkflowFixture.CreateAsync();
        await fixture.SeedMenuWithDemandAsync(includeMissingDish: false);
        await using var context = fixture.CreateContext();

        var result = await new MenuAmendmentService(context).CreateAsync(new CreateMenuAmendmentRequest
        {
            CustomerId = fixture.CustomerIdString,
            WeekStartDate = new DateOnly(2026, 6, 15),
            Reason = "Khách hàng đổi món trước khi tạo demand.",
            Lines =
            [
                new CreateMenuAmendmentLineRequest
                {
                    ServiceDate = new DateOnly(2026, 6, 15),
                    ShiftName = "MORNING",
                    DishSlot = "savory-main",
                    NewDishId = GuidHelper.ToGuidString(fixture.DishWithBomId)
                }
            ]
        }, fixture.UserIdString);

        result.Status.Should().Be("PENDING_REVIEW");
        result.RequiresReconciliation.Should().BeFalse();
        (await context.Menuamendments.Include(item => item.Lines).SingleAsync()).Lines.Should().ContainSingle();
        (await context.Auditlogs.AnyAsync(item => item.EntityName == nameof(MenuAmendment))).Should().BeTrue();
    }

    [Fact]
    public async Task MenuAmendment_Should_GroupDecisionScopesByCustomerDateShiftAndPriceTier()
    {
        var sources = new[]
        {
            new MenuAmendmentService.DecisionScopeSource("customer-1", "AMANN", new DateOnly(2026, 6, 15), "AFTERNOON", 25_000m, "line-1"),
            new MenuAmendmentService.DecisionScopeSource("customer-1", "AMANN", new DateOnly(2026, 6, 15), "AFTERNOON", 25_000m, "line-2"),
            new MenuAmendmentService.DecisionScopeSource("customer-1", "AMANN", new DateOnly(2026, 6, 16), "AFTERNOON", 25_000m, "line-3"),
        };

        var result = MenuAmendmentService.BuildDecisionScopes(sources, ["document-1"]);

        result.Should().HaveCount(2);
        result.Single(item => item.ServiceDate == new DateOnly(2026, 6, 15)).SourceLineIds
            .Should().BeEquivalentTo(["line-1", "line-2"]);
    }

    [Fact]
    public async Task MenuAmendment_Should_ExecuteOnlyBeforeDemandExists()
    {
        await using var fixture = await WorkflowFixture.CreateAsync();
        await fixture.SeedMenuWithDemandAsync(includeMissingDish: false);
        await using var context = fixture.CreateContext();
        (await context.Menuschedules.SingleAsync()).Status = "DRAFT";
        await context.SaveChangesAsync();
        var sourceSchedule = await context.Menuschedules.AsNoTracking().SingleAsync();
        var sourceMenuId = sourceSchedule.MenuId;
        var service = new MenuAmendmentService(context);
        var dishSlot = (await context.Menuitems.SingleAsync()).DishSlot ?? "main";
        var amendment = await service.CreateAsync(new CreateMenuAmendmentRequest
        {
            CustomerId = fixture.CustomerIdString, WeekStartDate = new DateOnly(2026, 6, 15), Reason = "Sửa bản nháp.",
            Lines = [new CreateMenuAmendmentLineRequest { ServiceDate = new DateOnly(2026, 6, 15), ShiftName = "MORNING", DishSlot = dishSlot, NewDishId = GuidHelper.ToGuidString(fixture.DishWithBomId) }]
        }, fixture.UserIdString);
        var reviewerId = await CreateApprovalActorAsync(context, "menu-reviewer");
        var executorId = await CreateApprovalActorAsync(context, "menu-executor");
        await service.ReviewAsync(amendment.MenuAmendmentId, new ReviewMenuAmendmentRequest { Approved = true }, reviewerId);

        var result = await service.ExecuteAsync(amendment.MenuAmendmentId, executorId);

        result.Status.Should().Be("EXECUTED");
        (await context.Menuamendments.SingleAsync()).Status.Should().Be("EXECUTED");
        result.AppliedMenuVersionId.Should().NotBeNullOrWhiteSpace();
        var amendedSchedule = await context.Menuschedules.AsNoTracking().SingleAsync();
        amendedSchedule.MenuId.SequenceEqual(sourceMenuId).Should().BeFalse();
        amendedSchedule.MenuVersionId.Should().NotBeNull();
        (await context.Menus.FindAsync(sourceMenuId)).Should().NotBeNull();
        (await context.Menuversions.SingleAsync(item => item.MenuVersionId.SequenceEqual(amendedSchedule.MenuVersionId!))).Status.Should().Be("ACTIVE");
    }

    [Fact]
    public async Task MenuAmendment_Should_CancelReversibleDemandBeforeExecution()
    {
        await using var fixture = await WorkflowFixture.CreateAsync();
        await fixture.SeedMenuWithDemandAsync(includeMissingDish: false);
        await using var context = fixture.CreateContext();
        await new MaterialDemandService(context).GenerateAsync(
            new GenerateMaterialDemandRequest { ServiceDate = "2026-06-15", Scope = "FULLDAY" }, fixture.UserIdString);
        var service = new MenuAmendmentService(context);
        var amendment = await service.CreateAsync(new CreateMenuAmendmentRequest
        {
            CustomerId = fixture.CustomerIdString, WeekStartDate = new DateOnly(2026, 6, 15), Reason = "Đổi món sau demand.",
            Lines = [new CreateMenuAmendmentLineRequest { ServiceDate = new DateOnly(2026, 6, 15), ShiftName = "MORNING", DishSlot = "main", NewDishId = GuidHelper.ToGuidString(fixture.DishWithBomId) }]
        }, fixture.UserIdString);
        var reviewerId = await CreateApprovalActorAsync(context, "demand-reviewer");
        var executorId = await CreateApprovalActorAsync(context, "demand-executor");
        await service.ReviewAsync(amendment.MenuAmendmentId, new ReviewMenuAmendmentRequest { Approved = true }, reviewerId);

        var result = await service.ExecuteAsync(amendment.MenuAmendmentId, executorId);

        result.Status.Should().Be("EXECUTED");
        (await context.Materialrequests.SingleAsync()).Status.Should().Be("CANCELLED");
    }

    [Fact]
    public async Task MenuAmendment_Should_NotExecute_WhenManagerRequestsCorrection()
    {
        await using var fixture = await WorkflowFixture.CreateAsync();
        await fixture.SeedMenuWithDemandAsync(includeMissingDish: false);
        await using var context = fixture.CreateContext();
        (await context.Menuschedules.SingleAsync()).Status = "DRAFT";
        await context.SaveChangesAsync();
        var service = new MenuAmendmentService(context);
        var amendment = await service.CreateAsync(new CreateMenuAmendmentRequest
        {
            CustomerId = fixture.CustomerIdString, WeekStartDate = new DateOnly(2026, 6, 15), Reason = "Đổi món.",
            Lines = [new CreateMenuAmendmentLineRequest { ServiceDate = new DateOnly(2026, 6, 15), ShiftName = "MORNING", DishSlot = "main", NewDishId = GuidHelper.ToGuidString(fixture.DishWithBomId) }]
        }, fixture.UserIdString);
        var reviewerId = await CreateApprovalActorAsync(context, "correction-reviewer");
        await service.ReviewAsync(amendment.MenuAmendmentId, new ReviewMenuAmendmentRequest { Approved = false, Reason = "Cần xác minh BOM." }, reviewerId);

        var act = () => service.ExecuteAsync(amendment.MenuAmendmentId, fixture.UserIdString);

        await act.Should().ThrowAsync<BusinessRuleException>().WithMessage("*chưa đủ điều kiện thực thi*");
    }

    [Fact]
    public async Task MenuAmendment_Should_RejectSelfReview_And_AuditBreakGlassExecution()
    {
        await using var fixture = await WorkflowFixture.CreateAsync();
        await fixture.SeedMenuWithDemandAsync(includeMissingDish: false);
        await using var context = fixture.CreateContext();
        (await context.Menuschedules.SingleAsync()).Status = "DRAFT";
        await context.SaveChangesAsync();
        var service = new MenuAmendmentService(context);
        var amendment = await service.CreateAsync(new CreateMenuAmendmentRequest
        {
            CustomerId = fixture.CustomerIdString, WeekStartDate = new DateOnly(2026, 6, 15), Reason = "Đổi món khẩn.",
            Lines = [new CreateMenuAmendmentLineRequest { ServiceDate = new DateOnly(2026, 6, 15), ShiftName = "MORNING", DishSlot = "main", NewDishId = GuidHelper.ToGuidString(fixture.DishWithBomId) }]
        }, fixture.UserIdString);

        var selfReview = () => service.ReviewAsync(amendment.MenuAmendmentId, new ReviewMenuAmendmentRequest { Approved = true }, fixture.UserIdString);
        await selfReview.Should().ThrowAsync<BusinessRuleException>().WithMessage("*không được tự hậu kiểm*");

        var result = await service.BreakGlassExecuteAsync(amendment.MenuAmendmentId, new BreakGlassMenuAmendmentRequest { Reason = "Khách hàng yêu cầu đổi suất gấp." }, fixture.UserIdString);

        result.Status.Should().Be("EXECUTED");
        var audit = await context.Auditlogs.SingleAsync(item => item.FieldName == "BreakGlassExecute");
        audit.EntityId.Should().NotBeNull();
        audit.EntityId!.SequenceEqual(GuidHelper.ParseGuidString(amendment.MenuAmendmentId)!).Should().BeTrue();
        audit.Reason.Should().Be("Khách hàng yêu cầu đổi suất gấp.");
    }

    private static async Task<string> CreateApprovalActorAsync(IpcManagementContext context, string username)
    {
        var id = GuidHelper.NewId();
        var roleId = await context.Roles.Select(role => role.RoleId).SingleAsync();
        context.Users.Add(new User
        {
            UserId = id,
            Username = username,
            FullName = username,
            PasswordHash = "test-hash",
            RoleId = roleId,
            IsActive = true,
            CreatedAt = DateTime.UtcNow
        });
        await context.SaveChangesAsync();
        return GuidHelper.ToGuidString(id);
    }

    [Fact]
    public async Task WeeklyMenuReimport_Should_CancelDownstreamDemandAndPurchase_ForCustomerWeek()
    {
        await using var fixture = await WorkflowFixture.CreateAsync();
        await fixture.SeedMenuWithDemandAsync(includeMissingDish: false);

        await using var context = fixture.CreateContext();
        var demand = await new MaterialDemandService(context).GenerateAsync(
            new GenerateMaterialDemandRequest { ServiceDate = "2026-06-15", Scope = "FULLDAY" },
            fixture.UserIdString);
        demand.Should().NotBeNull();
        await ApproveDemandAsync(context, demand!.MaterialRequestId);
        var purchase = await new PurchaseRequestWorkflowService(context, new SupplierQuotationService(context)).GenerateFromDemandAsync(
            new GeneratePurchaseRequestFromDemandRequest { MaterialRequestId = demand.MaterialRequestId },
            fixture.UserIdString);
        purchase.Should().NotBeNull();

        var customer = await context.Customers.SingleAsync();
        var version = new MenuVersion
        {
            MenuVersionId = GuidHelper.NewId(),
            CustomerId = customer.CustomerId,
            WeekStartDate = new DateOnly(2026, 6, 15),
            VersionNo = 2,
            Status = "DRAFT",
            SourceImportBatch = "MENU-CUS-20260615-V02",
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };
        context.Menuversions.Add(version);
        await context.SaveChangesAsync();

        var service = CreateWeeklyMenuImportPersistence(context);
        var invalidated = await service.InvalidateWorkflowDocumentsForMenuReimportAsync(
            customer,
            new DateOnly(2026, 6, 15),
            new DateOnly(2026, 6, 20),
            version,
            fixture.UserIdString,
            CancellationToken.None);
        await context.SaveChangesAsync();

        invalidated.Should().Be(2);
        (await context.Materialrequests.Select(item => item.Status).SingleAsync()).Should().Be("CANCELLED");
        (await context.Purchaserequests.Select(item => item.Status).SingleAsync()).Should().Be("CANCELLED");
        var auditReasons = await context.Auditlogs
            .Where(item => item.Reason != null && item.Reason.Contains("invalidated downstream demand/PR"))
            .Select(item => item.BusinessArea)
            .ToListAsync();
        auditReasons.Should().BeEquivalentTo(["Demand", "Purchase"]);
    }

    [Fact]
    public async Task WeeklyMenuReimport_Should_RejectBeforeCancelling_WhenPurchaseOrderAlreadyExists()
    {
        await using var fixture = await WorkflowFixture.CreateAsync();
        await fixture.SeedMenuWithDemandAsync(includeMissingDish: false);

        await using var context = fixture.CreateContext();
        var demand = await new MaterialDemandService(context).GenerateAsync(
            new GenerateMaterialDemandRequest { ServiceDate = "2026-06-15", Scope = "FULLDAY" },
            fixture.UserIdString);
        demand.Should().NotBeNull();
        await ApproveDemandAsync(context, demand!.MaterialRequestId);
        var purchase = await CreatePurchaseRequestWorkflowService(context).GenerateFromDemandAsync(
            new GeneratePurchaseRequestFromDemandRequest { MaterialRequestId = demand.MaterialRequestId },
            fixture.UserIdString);
        purchase.Should().NotBeNull();

        context.Purchaseorders.Add(new PurchaseOrder
        {
            PurchaseOrderId = GuidHelper.NewId(),
            PurchaseOrderCode = "PO-MENU-REIMPORT-BLOCK",
            PurchaseRequestId = GuidHelper.ParseGuidString(purchase!.PurchaseRequestId)!,
            SupplierId = fixture.SupplierId,
            OrderDate = new DateOnly(2026, 6, 14),
            Status = "ORDERED",
            CreatedBy = fixture.UserId,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        });
        var customer = await context.Customers.SingleAsync();
        var version = new MenuVersion
        {
            MenuVersionId = GuidHelper.NewId(),
            CustomerId = customer.CustomerId,
            WeekStartDate = new DateOnly(2026, 6, 15),
            VersionNo = 2,
            Status = "DRAFT",
            SourceImportBatch = "MENU-CUS-20260615-V02",
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };
        context.Menuversions.Add(version);
        await context.SaveChangesAsync();
        var auditCountBefore = await context.Auditlogs.AsNoTracking().CountAsync();

        var act = () => CreateWeeklyMenuImportPersistence(context).InvalidateWorkflowDocumentsForMenuReimportAsync(
            customer,
            new DateOnly(2026, 6, 15),
            new DateOnly(2026, 6, 20),
            version,
            fixture.UserIdString,
            CancellationToken.None);

        await act.Should().ThrowAsync<BusinessRuleException>()
            .WithMessage("*đã có PO, phiếu nhập hoặc phiếu xuất*");
        (await context.Materialrequests.AsNoTracking().SingleAsync()).Status.Should().Be("MANAGERAPPROVED");
        (await context.Purchaserequests.AsNoTracking().SingleAsync()).Status.Should().Be("DRAFT");
        (await context.Auditlogs.AsNoTracking().CountAsync()).Should().Be(auditCountBefore);
    }

    [Fact]
    public async Task WeeklyMenuReimport_Should_ScopePurchaseOrderBySourcePlanDate_NotPurchaseDocumentDate()
    {
        await using var fixture = await WorkflowFixture.CreateAsync();
        await fixture.SeedMenuWithDemandAsync(includeMissingDish: false);

        await using var context = fixture.CreateContext();
        var demand = await new MaterialDemandService(context).GenerateAsync(
            new GenerateMaterialDemandRequest { ServiceDate = "2026-06-15", Scope = "FULLDAY" },
            fixture.UserIdString);
        demand.Should().NotBeNull();
        await ApproveDemandAsync(context, demand!.MaterialRequestId);
        var purchase = await CreatePurchaseRequestWorkflowService(context).GenerateFromDemandAsync(
            new GeneratePurchaseRequestFromDemandRequest { MaterialRequestId = demand.MaterialRequestId },
            fixture.UserIdString);
        purchase.Should().NotBeNull();

        var purchaseRequest = await context.Purchaserequests.SingleAsync();
        purchaseRequest.PurchaseForDate = new DateOnly(2026, 6, 22);
        context.Purchaseorders.Add(new PurchaseOrder
        {
            PurchaseOrderId = GuidHelper.NewId(),
            PurchaseOrderCode = "PO-DOCUMENT-DATE-DIFFERS-FROM-SOURCE",
            PurchaseRequestId = purchaseRequest.PurchaseRequestId,
            SupplierId = fixture.SupplierId,
            OrderDate = new DateOnly(2026, 6, 22),
            Status = "ORDERED",
            CreatedBy = fixture.UserId,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        });
        var customer = await context.Customers.SingleAsync();
        var version = new MenuVersion
        {
            MenuVersionId = GuidHelper.NewId(),
            CustomerId = customer.CustomerId,
            WeekStartDate = new DateOnly(2026, 6, 22),
            VersionNo = 1,
            Status = "DRAFT",
            SourceImportBatch = "MENU-CUS-20260622-V01",
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };
        context.Menuversions.Add(version);
        await context.SaveChangesAsync();

        var invalidated = await CreateWeeklyMenuImportPersistence(context)
            .InvalidateWorkflowDocumentsForMenuReimportAsync(
                customer,
                new DateOnly(2026, 6, 22),
                new DateOnly(2026, 6, 27),
                version,
                fixture.UserIdString,
                CancellationToken.None);

        invalidated.Should().Be(0);
        (await context.Purchaseorders.AsNoTracking().SingleAsync()).Status.Should().Be("ORDERED");
    }

    [Fact]
    public async Task WeeklyMenuImport_Should_PreserveExistingGlobalDishClassification()
    {
        await using var fixture = await WorkflowFixture.CreateAsync();
        await using var context = fixture.CreateContext();
        var roleId = GuidHelper.NewId();
        var customer = new Customer
        {
            CustomerId = fixture.CustomerId,
            CustomerCode = "CUS",
            CustomerName = "Customer",
            IsActive = true
        };
        var dish = new Dish
        {
            DishId = fixture.DishWithBomId,
            DishCode = "DISH-GLOBAL",
            DishName = "Gà kho sả",
            DishGroup = "Món mặn",
            DishType = "Món chính",
            IsActive = true
        };
        context.Roles.Add(new Role { RoleId = roleId, RoleCode = "ADMIN", RoleName = "Admin" });
        context.Users.Add(new User
        {
            UserId = fixture.UserId,
            Username = "menu-importer",
            FullName = "Menu Importer",
            PasswordHash = "hash",
            RoleId = roleId,
            IsActive = true,
            CreatedAt = DateTime.UtcNow
        });
        context.Customers.Add(customer);
        context.Dishes.Add(dish);
        await context.SaveChangesAsync();

        var serviceDate = new DateOnly(2026, 7, 20);
        var plan = new WeeklyMenuImportPlan(
            "weekly-menu.xlsx",
            "CUS 25k",
            "C",
            serviceDate,
            serviceDate,
            10,
            [new WeeklyMenuImportDayColumn("D", serviceDate, "t2", "D - 20/07/2026", 7)],
            serviceDate)
        {
            SourceChecksum = "TEST-CHECKSUM"
        };
        plan.Sections.Add("MENU CHAY- CA CHIỀU");
        plan.Items.Add(new ParsedWeeklyMenuItem
        {
            SourceOrder = 1,
            ServiceDate = serviceDate,
            DayKey = "t2",
            SourceRowNumber = 9,
            SourceColumn = "D",
            SectionLabel = "MENU CHAY- CA CHIỀU",
            SectionKey = "vegetarian-afternoon",
            SourceShift = "AFTERNOON",
            SourceShiftLabel = "Ca chiều",
            DbShiftName = "AFTERNOON",
            VariantKey = "vegetarian",
            VariantLabel = "Chay",
            Slot = "main",
            SlotLabel = "Món chay chính",
            DishName = "Gà kho sả"
        });

        var result = await CreateWeeklyMenuImportPersistence(context).CommitAsync(
            plan,
            customer,
            25000m,
            fixture.UserIdString,
            CancellationToken.None);
        await context.SaveChangesAsync();

        var persisted = await context.Dishes.AsNoTracking().SingleAsync();
        persisted.DishGroup.Should().Be("Món mặn");
        persisted.DishType.Should().Be("Món chính");
        persisted.SourceImportBatch.Should().BeNull();
        persisted.SourceFileName.Should().BeNull();
        persisted.SourceChecksum.Should().BeNull();
        result.Counts.DishesUpdated.Should().Be(0);
        (await context.Menuitems.AsNoTracking().SingleAsync()).DishSlot.Should().Be("vegetarian-main");
    }

    [Fact]
    public async Task WeeklyMenuImport_Should_Not_ClassifyNewDishFromWorkbookSlot()
    {
        await using var fixture = await WorkflowFixture.CreateAsync();
        await using var context = fixture.CreateContext();
        var roleId = GuidHelper.NewId();
        var customer = new Customer
        {
            CustomerId = fixture.CustomerId,
            CustomerCode = "CUS",
            CustomerName = "Customer",
            IsActive = true
        };
        context.Roles.Add(new Role { RoleId = roleId, RoleCode = "ADMIN", RoleName = "Admin" });
        context.Users.Add(new User
        {
            UserId = fixture.UserId,
            Username = "menu-importer-new-dish",
            FullName = "Menu Importer",
            PasswordHash = "hash",
            RoleId = roleId,
            IsActive = true,
            CreatedAt = DateTime.UtcNow
        });
        context.Customers.Add(customer);
        await context.SaveChangesAsync();

        var serviceDate = new DateOnly(2026, 7, 20);
        var plan = new WeeklyMenuImportPlan(
            "weekly-menu.xlsx",
            "CUS 25k",
            "C",
            serviceDate,
            serviceDate,
            10,
            [new WeeklyMenuImportDayColumn("D", serviceDate, "t2", "D - 20/07/2026", 7)],
            serviceDate)
        {
            SourceChecksum = "TEST-NEW-DISH-CHECKSUM"
        };
        plan.Sections.Add("MENU CHAY- CA CHIỀU");
        plan.Items.Add(new ParsedWeeklyMenuItem
        {
            SourceOrder = 1,
            ServiceDate = serviceDate,
            DayKey = "t2",
            SourceRowNumber = 9,
            SourceColumn = "D",
            SectionLabel = "MENU CHAY- CA CHIỀU",
            SectionKey = "vegetarian-afternoon",
            SourceShift = "AFTERNOON",
            SourceShiftLabel = "Ca chiều",
            DbShiftName = "AFTERNOON",
            VariantKey = "vegetarian",
            VariantLabel = "Chay",
            Slot = "main",
            SlotLabel = "Món chay chính",
            DishName = "Món thử nghiệm chưa phân loại"
        });

        var result = await CreateWeeklyMenuImportPersistence(context).CommitAsync(
            plan,
            customer,
            25000m,
            fixture.UserIdString,
            CancellationToken.None);
        await context.SaveChangesAsync();

        var persisted = await context.Dishes.AsNoTracking().SingleAsync();
        persisted.DishGroup.Should().BeNull();
        persisted.DishType.Should().BeNull();
        persisted.SourceImportBatch.Should().Be("MENU-CUS-20260720-V01");
        persisted.SourceFileName.Should().Be("weekly-menu.xlsx");
        persisted.SourceChecksum.Should().Be("TEST-NEW-DISH-CHECKSUM");
        result.Counts.DishesCreated.Should().Be(1);
        (await context.Menuitems.AsNoTracking().SingleAsync()).DishSlot.Should().Be("vegetarian-main");
    }

    [Fact]
    public async Task WeeklyMenuReimport_Should_RejectCompletedQuantityPlanBeforeMutation()
    {
        await using var fixture = await WorkflowFixture.CreateAsync();
        await fixture.SeedMenuWithDemandAsync(includeMissingDish: false);
        await using (var setupContext = fixture.CreateContext())
        {
            (await setupContext.Menuschedules.SingleAsync()).Status = "DRAFT";
            await setupContext.SaveChangesAsync();
        }

        await using var context = fixture.CreateContext();
        var customer = await context.Customers.SingleAsync();
        var existingVersionCount = await context.Menuversions.CountAsync();
        var serviceDate = new DateOnly(2026, 6, 15);
        var plan = new WeeklyMenuImportPlan(
            "reimport.xlsx",
            "CUS 25k",
            "C",
            serviceDate,
            serviceDate,
            10,
            [new WeeklyMenuImportDayColumn("D", serviceDate, "t2", "D - 15/06/2026", 7)],
            serviceDate)
        {
            SourceChecksum = "REIMPORT-BLOCK-CHECKSUM"
        };
        plan.Sections.Add("MENU MẶN- CA SÁNG");
        plan.Items.Add(new ParsedWeeklyMenuItem
        {
            SourceOrder = 1,
            ServiceDate = serviceDate,
            DayKey = "t2",
            SourceRowNumber = 9,
            SourceColumn = "D",
            SectionLabel = "MENU MẶN- CA SÁNG",
            SectionKey = "savory-morning",
            SourceShift = "MORNING",
            SourceShiftLabel = "Ca sáng",
            DbShiftName = "MORNING",
            VariantKey = "savory",
            VariantLabel = "Mặn",
            Slot = "main",
            SlotLabel = "Món chính",
            DishName = "Dish with BOM"
        });

        var act = () => CreateWeeklyMenuImportPersistence(context).CommitAsync(
            plan,
            customer,
            25000m,
            fixture.UserIdString,
            CancellationToken.None);

        await act.Should().ThrowAsync<BusinessRuleException>()
            .WithMessage("*Không thể import lại thực đơn tuần*");
        context.ChangeTracker.HasChanges().Should().BeFalse();
        (await context.Menuversions.CountAsync()).Should().Be(existingVersionCount);
        (await context.Auditlogs.CountAsync()).Should().Be(0);
        (await context.Mealquantityplans.AsNoTracking().SingleAsync()).Status.Should().Be(OrderStatus.Completed);
    }

    [Fact]
    public async Task WeeklyMenuReimport_Should_AllowDemandRegeneration_ForApprovedLineageWithoutIrreversibleDocuments()
    {
        await using var fixture = await WorkflowFixture.CreateAsync();
        await fixture.SeedMenuWithDemandAsync(includeMissingDish: false);

        await using (var context = fixture.CreateContext())
        {
            var demand = await new MaterialDemandService(context).GenerateAsync(
                new GenerateMaterialDemandRequest { ServiceDate = "2026-06-15", Scope = "FULLDAY" },
                fixture.UserIdString);
            demand.Should().NotBeNull();
            await ApproveDemandAsync(context, demand!.MaterialRequestId);

            var customer = await context.Customers.SingleAsync();
            var version = new MenuVersion
            {
                MenuVersionId = GuidHelper.NewId(),
                CustomerId = customer.CustomerId,
                WeekStartDate = new DateOnly(2026, 6, 15),
                VersionNo = 2,
                Status = "DRAFT",
                SourceImportBatch = "MENU-CUS-20260615-V02",
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            };
            context.Menuversions.Add(version);
            await context.SaveChangesAsync();

            var importService = CreateWeeklyMenuImportPersistence(context);
            var invalidated = await importService.InvalidateWorkflowDocumentsForMenuReimportAsync(
                customer,
                new DateOnly(2026, 6, 15),
                new DateOnly(2026, 6, 20),
                version,
                fixture.UserIdString,
                CancellationToken.None);
            invalidated.Should().Be(1);
            await context.SaveChangesAsync();
        }

        await using var regenerationContext = fixture.CreateContext();
        var regenerated = await new MaterialDemandService(regenerationContext).GenerateAsync(
            new GenerateMaterialDemandRequest { ServiceDate = "2026-06-15", Scope = "FULLDAY" },
            fixture.UserIdString);

        regenerated.Should().NotBeNull();
        regenerated!.Status.Should().Be("DRAFT");
        (await regenerationContext.Materialrequests.AsNoTracking().CountAsync()).Should().Be(1);
    }

    [Fact]
    public async Task WeeklyMenuReimport_Should_AllowDemandRegeneration_ForDraftLineageWithoutPurchaseOrder()
    {
        await using var fixture = await WorkflowFixture.CreateAsync();
        await fixture.SeedMenuWithDemandAsync(includeMissingDish: false);

        await using (var context = fixture.CreateContext())
        {
            var demand = await new MaterialDemandService(context).GenerateAsync(
                new GenerateMaterialDemandRequest { ServiceDate = "2026-06-15", Scope = "FULLDAY" },
                fixture.UserIdString);
            demand.Should().NotBeNull();
            await ApproveDemandAsync(context, demand!.MaterialRequestId);
            var purchase = await CreatePurchaseRequestWorkflowService(context).GenerateFromDemandAsync(
                new GeneratePurchaseRequestFromDemandRequest { MaterialRequestId = demand.MaterialRequestId },
                fixture.UserIdString);
            purchase.Should().NotBeNull();

            var materialRequest = await context.Materialrequests.SingleAsync();
            materialRequest.Status = "DRAFT";

            var customer = await context.Customers.SingleAsync();
            var version = new MenuVersion
            {
                MenuVersionId = GuidHelper.NewId(),
                CustomerId = customer.CustomerId,
                WeekStartDate = new DateOnly(2026, 6, 15),
                VersionNo = 2,
                Status = "DRAFT",
                SourceImportBatch = "MENU-CUS-20260615-V02",
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            };
            context.Menuversions.Add(version);
            await context.SaveChangesAsync();

            var importService = CreateWeeklyMenuImportPersistence(context);
            var invalidated = await importService.InvalidateWorkflowDocumentsForMenuReimportAsync(
                customer,
                new DateOnly(2026, 6, 15),
                new DateOnly(2026, 6, 20),
                version,
                fixture.UserIdString,
                CancellationToken.None);
            invalidated.Should().Be(2);
            await context.SaveChangesAsync();
            var demandCancellationAudit = await context.Auditlogs.SingleAsync(item =>
                item.BusinessArea == "Demand" &&
                item.FieldName == "Status" &&
                item.NewValue == "CANCELLED");
            demandCancellationAudit.Reason =
                "Menu re-import MENU-CUS-20260615-V01 invalidated downstream demand/PR; regenerate required.";
            await context.SaveChangesAsync();
        }

        await using (var context = fixture.CreateContext())
        {
            var regenerated = await new MaterialDemandService(context).GenerateAsync(
                new GenerateMaterialDemandRequest { ServiceDate = "2026-06-15", Scope = "FULLDAY" },
                fixture.UserIdString);

            regenerated.Should().NotBeNull();
            regenerated!.Status.Should().Be("DRAFT");
        }

        await using var verificationContext = fixture.CreateContext();
        (await verificationContext.Materialrequests.AsNoTracking().CountAsync()).Should().Be(1);
        (await verificationContext.Materialrequests.AsNoTracking().Select(item => item.Status).SingleAsync())
            .Should().Be("DRAFT");
        (await verificationContext.Purchaserequests.AsNoTracking().CountAsync()).Should().Be(1);
        (await verificationContext.Purchaserequests.AsNoTracking().Select(item => item.Status).SingleAsync())
            .Should().Be("DRAFT");
        (await verificationContext.Purchaserequestlines.AsNoTracking().CountAsync()).Should().Be(0);
        (await verificationContext.Purchaseorderlines.AsNoTracking().CountAsync()).Should().Be(0);
        (await verificationContext.Auditlogs.AsNoTracking().CountAsync(item =>
            item.FieldName == "Status" &&
            item.OldValue == "CANCELLED" &&
            item.NewValue == "DRAFT" &&
            item.Reason != null &&
            item.Reason.Contains("regeneration"))).Should().Be(2);
    }

}
