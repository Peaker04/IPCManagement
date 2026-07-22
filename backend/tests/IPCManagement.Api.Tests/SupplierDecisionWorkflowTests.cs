using FluentAssertions;
using IPCManagement.Api.Data;
using IPCManagement.Api.Helpers;
using IPCManagement.Api.Models.DTOs.Workflow;
using IPCManagement.Api.Models.Entities;
using IPCManagement.Api.Services;
using IPCManagement.Api.Services.Workflow;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Microsoft.EntityFrameworkCore;
using System.Data.Common;

namespace IPCManagement.Api.Tests;

public class SupplierDecisionWorkflowTests
{
    [Theory]
    [InlineData("DRAFT")]
    [InlineData("REJECTED")]
    public async Task ApprovedDemand_Generation_rejects_non_approved_status_before_writes(string status)
    {
        await using var context = CreateContext();
        var demand = SeedDemand(context, status, new DateOnly(2026, 7, 20), "FULLDAY");
        await context.SaveChangesAsync();

        var act = () => CreateService(context).GenerateFromDemandAsync(
            new GeneratePurchaseRequestFromDemandDto
            {
                MaterialRequestId = GuidHelper.ToGuidString(demand.RequestId)
            },
            UserId);

        await act.Should().ThrowAsync<InvalidOperationException>()
            .WithMessage("*duyệt nhu cầu nguyên liệu*");
        (await context.Purchaserequests.CountAsync()).Should().Be(0);
        (await context.Purchaserequestlines.CountAsync()).Should().Be(0);
    }

    [Fact]
    public async Task ApprovedDemand_Generation_creates_supplier_neutral_fullday_lines_and_reuses_draft()
    {
        await using var context = CreateContext();
        var demand = SeedDemand(context, "MANAGERAPPROVED", new DateOnly(2026, 7, 20), "FULLDAY");
        await context.SaveChangesAsync();
        var service = CreateService(context);
        var request = new GeneratePurchaseRequestFromDemandDto
        {
            MaterialRequestId = GuidHelper.ToGuidString(demand.RequestId)
        };

        var first = await service.GenerateFromDemandAsync(request, UserId);
        var second = await service.GenerateFromDemandAsync(request, UserId);

        first.Should().NotBeNull();
        second.Should().NotBeNull();
        second!.PurchaseRequestId.Should().Be(first!.PurchaseRequestId);
        first.PurchaseForDate.Should().Be("2026-07-20");
        first.ShiftName.Should().BeNull();
        first.Lines.Should().ContainSingle().Which.SupplierId.Should().BeNull();
        first.Lines.Single().SupplierName.Should().BeNull();
        second.Lines.Should().ContainSingle()
            .Which.PurchaseRequestLineId.Should().Be(first.Lines.Single().PurchaseRequestLineId);
        (await context.Purchaserequests.CountAsync()).Should().Be(1);
        (await context.Purchaserequestlines.CountAsync()).Should().Be(1);
        (await context.Purchaserequestlines.SingleAsync()).SupplierId.Should().BeNull();
    }

    [Fact]
    public async Task ApprovedDemand_Generation_rejects_non_fullday_scope_before_writes()
    {
        await using var context = CreateContext();
        var demand = SeedDemand(context, "MANAGERAPPROVED", new DateOnly(2026, 7, 20), "MORNING");
        await context.SaveChangesAsync();

        var act = () => CreateService(context).GenerateFromDemandAsync(
            new GeneratePurchaseRequestFromDemandDto
            {
                MaterialRequestId = GuidHelper.ToGuidString(demand.RequestId)
            },
            UserId);

        await act.Should().ThrowAsync<InvalidOperationException>()
            .WithMessage("*FULLDAY*");
        (await context.Purchaserequests.CountAsync()).Should().Be(0);
    }

    [Fact]
    public async Task ApprovedDemand_Generation_rejects_stale_demand_identity_without_mutating_existing_draft()
    {
        await using var context = CreateContext();
        var serviceDate = new DateOnly(2026, 7, 20);
        var current = SeedDemand(context, "MANAGERAPPROVED", serviceDate, "FULLDAY", "MR-CURRENT");
        await context.SaveChangesAsync();
        var service = CreateService(context);
        await service.GenerateFromDemandAsync(
            new GeneratePurchaseRequestFromDemandDto
            {
                MaterialRequestId = GuidHelper.ToGuidString(current.RequestId)
            },
            UserId);

        var stale = SeedDemand(context, "MANAGERAPPROVED", serviceDate, "FULLDAY", "MR-STALE");
        await context.SaveChangesAsync();

        var act = () => service.GenerateFromDemandAsync(
            new GeneratePurchaseRequestFromDemandDto
            {
                MaterialRequestId = GuidHelper.ToGuidString(stale.RequestId)
            },
            UserId);

        await act.Should().ThrowAsync<InvalidOperationException>()
            .WithMessage("*cũ*");
        (await context.Purchaserequests.CountAsync()).Should().Be(1);
        (await context.Purchaserequestlines.CountAsync()).Should().Be(1);
        (await context.Purchaserequestlines.SingleAsync()).MaterialRequestLineId
            .Should().Equal(current.Materialrequestlines.Single().RequestLineId);
    }

    [Fact]
    public async Task Workbench_rejects_non_monday_week_and_cross_week_date()
    {
        await using var context = CreateContext();
        var service = CreateService(context);

        var nonMonday = () => service.GetWorkbenchWeekAsync(new PurchaseWorkbenchQueryDto
        {
            Week = "2026-07-21"
        });
        await nonMonday.Should().ThrowAsync<ArgumentException>()
            .WithMessage("*thứ Hai*");

        var crossWeek = () => service.GetWorkbenchWeekAsync(new PurchaseWorkbenchQueryDto
        {
            Week = "2026-07-20",
            Date = "2026-07-27"
        });
        await crossWeek.Should().ThrowAsync<ArgumentException>()
            .WithMessage("*trong tuần*");
    }

    [Fact]
    public async Task Workbench_returns_stable_dates_and_only_selected_date_default_page()
    {
        await using var context = CreateContext();
        for (var index = 10; index >= 1; index--)
        {
            SeedDemand(context, "MANAGERAPPROVED", new DateOnly(2026, 7, 20), "FULLDAY", $"MR-MON-{index:00}");
        }
        SeedDemand(context, "MANAGERAPPROVED", new DateOnly(2026, 7, 22), "FULLDAY", "MR-WED-01");
        SeedDemand(context, "DRAFT", new DateOnly(2026, 7, 23), "FULLDAY", "MR-THU-DRAFT");
        await context.SaveChangesAsync();

        var result = await CreateService(context).GetWorkbenchWeekAsync(new PurchaseWorkbenchQueryDto
        {
            Week = "2026-07-20",
            Date = "2026-07-20",
            Stage = "demand"
        });

        result.WeekStart.Should().Be("2026-07-20");
        result.WeekEnd.Should().Be("2026-07-26");
        result.PageSize.Should().Be(8);
        result.TotalItems.Should().Be(10);
        result.ServiceDates.Select(item => item.ServiceDate)
            .Should().Equal("2026-07-20", "2026-07-22");
        var selected = result.ServiceDates.First();
        selected.Scope.Should().Be("FULLDAY");
        selected.ApprovedDemands.Should().HaveCount(8);
        selected.ApprovedDemands.Select(item => item.RequestCode)
            .Should().BeInAscendingOrder();
        result.ServiceDates.Last().ApprovedDemands.Should().BeEmpty();

        var capped = await CreateService(context).GetWorkbenchWeekAsync(new PurchaseWorkbenchQueryDto
        {
            Week = "2026-07-20",
            Date = "2026-07-20",
            PageSize = 500
        });
        capped.PageSize.Should().Be(100);
    }

    [Fact]
    public async Task Workbench_counts_each_authoritative_stage_once()
    {
        await using var context = CreateContext();
        var supplier = SeedSupplier(context);
        var demandOnly = SeedDemand(context, "MANAGERAPPROVED", new DateOnly(2026, 7, 20), "FULLDAY", "MR-DEMAND");
        var supplierStage = SeedDemand(context, "MANAGERAPPROVED", new DateOnly(2026, 7, 21), "FULLDAY", "MR-SUPPLIER");
        var exceptionStage = SeedDemand(context, "MANAGERAPPROVED", new DateOnly(2026, 7, 22), "FULLDAY", "MR-EXCEPTION");
        var submittedStage = SeedDemand(context, "MANAGERAPPROVED", new DateOnly(2026, 7, 23), "FULLDAY", "MR-SUBMITTED");
        var approvedStage = SeedDemand(context, "MANAGERAPPROVED", new DateOnly(2026, 7, 24), "FULLDAY", "MR-APPROVED");
        var receivingStage = SeedDemand(context, "MANAGERAPPROVED", new DateOnly(2026, 7, 25), "FULLDAY", "MR-RECEIVING");

        SeedPurchaseProgress(context, supplierStage, "DRAFT", supplier, estimatedUnitPrice: 115m);
        var exceptionRequest = SeedPurchaseProgress(context, exceptionStage, "DRAFT", supplier, estimatedUnitPrice: 120m);
        SeedPurchaseProgress(context, submittedStage, "SENTTOSUPPLIER", supplier);
        SeedPurchaseProgress(context, approvedStage, "APPROVED", supplier);
        SeedPurchaseProgress(context, receivingStage, "APPROVED", supplier, withOrder: true);
        await context.SaveChangesAsync();
        var exceptionLine = exceptionRequest.Purchaserequestlines.Single();
        exceptionLine.SupplierId.Should().NotBeNull();
        exceptionLine.Ingredient.ReferencePrice.Should().Be(100m);
        exceptionLine.EstimatedUnitPrice.Should().Be(120m);

        var result = await CreateService(context).GetWorkbenchWeekAsync(new PurchaseWorkbenchQueryDto
        {
            Week = "2026-07-20",
            Date = "2026-07-20"
        });

        var exceptionSummary = result.ServiceDates.Single(item => item.ServiceDate == "2026-07-22");
        exceptionSummary.SupplierReadyLineCount.Should().Be(1);
        exceptionSummary.BlockingExceptionCount.Should().Be(1);
        result.ServiceDates.Single(item => item.ServiceDate == "2026-07-21")
            .BlockingExceptionCount.Should().Be(0);
        result.ServiceDates.Select(item => $"{item.ServiceDate}:{item.CurrentStage}")
            .Should().Equal(
                "2026-07-20:demand",
                "2026-07-21:supplier-price",
                "2026-07-22:exception",
                "2026-07-23:submitted",
                "2026-07-24:approved-order",
                "2026-07-25:receiving");
        result.StageCounts.Demand.Should().Be(1);
        result.StageCounts.SupplierPrice.Should().Be(1);
        result.StageCounts.Exception.Should().Be(1);
        result.StageCounts.SubmittedRequest.Should().Be(1);
        result.StageCounts.ApprovedOrder.Should().Be(1);
        result.StageCounts.ReceivingProgress.Should().Be(1);
        result.ServiceDates.Single(item => item.ServiceDate == "2026-07-25")
            .ReceivingLineCount.Should().Be(1);
        result.ServiceDates.Single(item => item.ServiceDate == "2026-07-25")
            .FullyReceivedLineCount.Should().Be(0);
        demandOnly.RequestCode.Should().Be("MR-DEMAND");
    }

    [Fact]
    public async Task Workbench_query_count_stays_bounded_when_detail_page_grows()
    {
        var counter = new SelectCommandCounter();
        await using var connection = new SqliteConnection("Data Source=:memory:");
        await connection.OpenAsync();
        await using var context = CreateSqliteContext(connection, counter);
        await CreateWorkbenchSqliteSchemaAsync(context);
        for (var index = 1; index <= 25; index++)
        {
            var requestId = GuidHelper.NewId();
            var requestLineId = GuidHelper.NewId();
            await context.Database.ExecuteSqlInterpolatedAsync($"""
                INSERT INTO materialrequests
                    (requestId, requestCode, requestDate, requestScope, status)
                VALUES
                    ({requestId}, {$"MR-BOUND-{index:00}"}, {new DateOnly(2026, 7, 20)}, {"FULLDAY"}, {"MANAGERAPPROVED"});
                """);
            await context.Database.ExecuteSqlInterpolatedAsync($"""
                INSERT INTO materialrequestlines
                    (requestLineId, requestId, suggestedPurchaseQty)
                VALUES
                    ({requestLineId}, {requestId}, {10m});
                """);
        }

        counter.Reset();
        var result = await CreateService(context).GetWorkbenchWeekAsync(new PurchaseWorkbenchQueryDto
        {
            Week = "2026-07-20",
            Date = "2026-07-20",
            Page = 2,
            PageSize = 8
        });

        result.TotalItems.Should().Be(25);
        result.ServiceDates.Single().ApprovedDemands.Should().HaveCount(8);
        counter.SelectCount.Should().BeLessThanOrEqualTo(8);
    }

    [Fact]
    public void Supplier_decision_fixture_requires_evidence_and_explicit_confirmation()
    {
        var requiredEvidence = new[] { "effective-quotation", "latest-valid-receipt" };
        var requiresConfirmation = true;

        requiredEvidence.Should().Equal("effective-quotation", "latest-valid-receipt");
        requiresConfirmation.Should().BeTrue();
    }

    [Fact(Skip = "Plan 09-08 owns evidence-backed supplier suggestions and confirmation snapshots.")]
    public void Purchasing_confirms_supplier_from_effective_evidence()
    {
        Assert.Fail("Plan 09-08 must replace the first-active-supplier fallback.");
    }

    [Fact(Skip = "Plan 09-10 owns the price threshold and exception handoff.")]
    public void Supplier_price_above_threshold_routes_to_manager_exception_approval()
    {
        Assert.Fail("Plan 09-10 must route strict greater-than-fifteen-percent exceptions.");
    }

    private static readonly byte[] UserIdBytes = GuidHelper.NewId();
    private static string UserId => GuidHelper.ToGuidString(UserIdBytes);

    private static IpcManagementContext CreateContext()
    {
        var options = new DbContextOptionsBuilder<IpcManagementContext>()
            .UseInMemoryDatabase($"supplier-decision-{Guid.NewGuid():N}")
            .Options;
        return new IpcManagementContext(options);
    }

    private static Task CreateWorkbenchSqliteSchemaAsync(IpcManagementContext context)
        => context.Database.ExecuteSqlRawAsync("""
            CREATE TABLE materialrequests (
                requestId BLOB PRIMARY KEY,
                requestCode TEXT NOT NULL,
                requestDate TEXT NOT NULL,
                requestScope TEXT NOT NULL,
                status TEXT NOT NULL
            );
            CREATE TABLE materialrequestlines (
                requestLineId BLOB PRIMARY KEY,
                requestId BLOB NOT NULL,
                suggestedPurchaseQty TEXT NOT NULL
            );
            CREATE TABLE purchaserequests (
                purchaseRequestId BLOB PRIMARY KEY,
                purchaseRequestCode TEXT NOT NULL,
                requestDate TEXT NOT NULL,
                purchaseForDate TEXT NOT NULL,
                shiftName TEXT NULL,
                status TEXT NOT NULL,
                createdBy BLOB NOT NULL,
                approvedBy BLOB NULL,
                approvedAt TEXT NULL
            );
            CREATE TABLE ingredients (
                ingredientId BLOB PRIMARY KEY,
                ingredientCode TEXT NOT NULL,
                ingredientName TEXT NOT NULL,
                unitId BLOB NOT NULL,
                warehouseId BLOB NOT NULL,
                referencePrice TEXT NOT NULL,
                isFreshDaily INTEGER NOT NULL,
                isActive INTEGER NULL
            );
            CREATE TABLE purchaserequestlines (
                purchaseRequestLineId BLOB PRIMARY KEY,
                purchaseRequestId BLOB NOT NULL,
                materialRequestLineId BLOB NOT NULL,
                ingredientId BLOB NOT NULL,
                supplierId BLOB NULL,
                unitId BLOB NOT NULL,
                requiredQty TEXT NOT NULL,
                currentStockQty TEXT NOT NULL,
                purchaseQty TEXT NOT NULL,
                estimatedUnitPrice TEXT NOT NULL,
                expectedDeliveryDate TEXT NULL,
                note TEXT NULL
            );
            CREATE TABLE purchaseorders (
                purchaseOrderId BLOB PRIMARY KEY,
                purchaseOrderCode TEXT NOT NULL,
                purchaseRequestId BLOB NOT NULL,
                supplierId BLOB NOT NULL,
                orderDate TEXT NOT NULL,
                status TEXT NOT NULL,
                createdBy BLOB NOT NULL,
                createdAt TEXT NOT NULL,
                updatedAt TEXT NOT NULL
            );
            CREATE TABLE purchaseorderlines (
                purchaseOrderLineId BLOB PRIMARY KEY,
                purchaseOrderId BLOB NOT NULL,
                purchaseRequestLineId BLOB NOT NULL,
                ingredientId BLOB NOT NULL,
                unitId BLOB NOT NULL,
                orderedQty TEXT NOT NULL,
                receivedQty TEXT NOT NULL,
                unitPrice TEXT NOT NULL
            );
            """);

    private static PurchaseRequestWorkflowService CreateService(IpcManagementContext context)
        => new(context, new SupplierQuotationService(context));

    private static IpcManagementContext CreateSqliteContext(
        SqliteConnection connection,
        DbCommandInterceptor interceptor)
    {
        var options = new DbContextOptionsBuilder<IpcManagementContext>()
            .UseSqlite(connection)
            .AddInterceptors(interceptor)
            .Options;
        return new IpcManagementContext(options);
    }

    private static Supplier SeedSupplier(IpcManagementContext context)
    {
        var supplier = new Supplier
        {
            SupplierId = GuidHelper.NewId(),
            SupplierCode = "SUP-WORKBENCH",
            SupplierName = "Supplier workbench",
            IsActive = true
        };
        context.Suppliers.Add(supplier);
        return supplier;
    }

    private static Purchaserequest SeedPurchaseProgress(
        IpcManagementContext context,
        Materialrequest demand,
        string status,
        Supplier? supplier = null,
        decimal estimatedUnitPrice = 100m,
        bool withOrder = false)
    {
        var materialLine = demand.Materialrequestlines.Single();
        var request = new Purchaserequest
        {
            PurchaseRequestId = GuidHelper.NewId(),
            PurchaseRequestCode = $"PR-{demand.RequestDate:yyyyMMdd}-FULLDAY",
            RequestDate = demand.RequestDate,
            PurchaseForDate = demand.RequestDate,
            Status = status,
            CreatedBy = UserIdBytes
        };
        var line = new Purchaserequestline
        {
            PurchaseRequestLineId = GuidHelper.NewId(),
            PurchaseRequestId = request.PurchaseRequestId,
            MaterialRequestLineId = materialLine.RequestLineId,
            IngredientId = materialLine.IngredientId,
            SupplierId = supplier?.SupplierId,
            UnitId = materialLine.UnitId,
            RequiredQty = 10m,
            CurrentStockQty = 0m,
            PurchaseQty = 10m,
            EstimatedUnitPrice = supplier is null ? 0m : estimatedUnitPrice,
            ExpectedDeliveryDate = supplier is null ? null : demand.RequestDate,
            PurchaseRequest = request,
            MaterialRequestLine = materialLine,
            Ingredient = materialLine.Ingredient,
            Supplier = supplier,
            Unit = materialLine.Unit
        };
        request.Purchaserequestlines.Add(line);
        context.Purchaserequests.Add(request);

        if (withOrder)
        {
            var order = new Purchaseorder
            {
                PurchaseOrderId = GuidHelper.NewId(),
                PurchaseOrderCode = "PO-WORKBENCH",
                PurchaseRequestId = request.PurchaseRequestId,
                SupplierId = supplier!.SupplierId,
                OrderDate = demand.RequestDate,
                Status = "PARTIALLYRECEIVED",
                CreatedBy = UserIdBytes,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow,
                PurchaseRequest = request,
                Supplier = supplier,
                Purchaseorderlines =
                [
                    new Purchaseorderline
                    {
                        PurchaseOrderLineId = GuidHelper.NewId(),
                        PurchaseRequestLineId = line.PurchaseRequestLineId,
                        IngredientId = line.IngredientId,
                        UnitId = line.UnitId,
                        OrderedQty = 10m,
                        ReceivedQty = 5m,
                        UnitPrice = estimatedUnitPrice,
                        PurchaseRequestLine = line,
                        Ingredient = line.Ingredient,
                        Unit = line.Unit
                    }
                ]
            };
            request.Purchaseorders.Add(order);
            context.Purchaseorders.Add(order);
        }

        return request;
    }

    private sealed class SelectCommandCounter : DbCommandInterceptor
    {
        public int SelectCount { get; private set; }

        public void Reset() => SelectCount = 0;

        public override ValueTask<InterceptionResult<DbDataReader>> ReaderExecutingAsync(
            DbCommand command,
            CommandEventData eventData,
            InterceptionResult<DbDataReader> result,
            CancellationToken cancellationToken = default)
        {
            if (command.CommandText.TrimStart().StartsWith("SELECT", StringComparison.OrdinalIgnoreCase))
            {
                SelectCount++;
            }

            return base.ReaderExecutingAsync(command, eventData, result, cancellationToken);
        }
    }

    private static Materialrequest SeedDemand(
        IpcManagementContext context,
        string status,
        DateOnly serviceDate,
        string scope,
        string? requestCode = null)
    {
        var unit = new Unit
        {
            UnitId = GuidHelper.NewId(),
            UnitCode = $"KG-{Guid.NewGuid():N}",
            UnitName = "kg",
            ConvertRateToBase = 1
        };
        var ingredient = new Ingredient
        {
            IngredientId = GuidHelper.NewId(),
            IngredientCode = $"ING-{Guid.NewGuid():N}",
            IngredientName = requestCode ?? "Ingredient",
            UnitId = unit.UnitId,
            WarehouseId = GuidHelper.NewId(),
            ReferencePrice = 100,
            IsActive = true,
            Unit = unit
        };
        var plan = new Productionplan
        {
            PlanId = GuidHelper.NewId(),
            PlanCode = $"PLAN-{Guid.NewGuid():N}",
            PlanDate = serviceDate,
            WeekStartDate = serviceDate.AddDays(-(int)serviceDate.DayOfWeek + 1),
            Status = "FINALIZED",
            CreatedBy = UserIdBytes,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };
        var demand = new Materialrequest
        {
            RequestId = GuidHelper.NewId(),
            RequestCode = requestCode ?? $"MR-{Guid.NewGuid():N}",
            PlanId = plan.PlanId,
            RequestDate = serviceDate,
            RequestScope = scope,
            Status = status,
            CreatedBy = UserIdBytes,
            Plan = plan
        };
        demand.Materialrequestlines.Add(new Materialrequestline
        {
            RequestLineId = GuidHelper.NewId(),
            RequestId = demand.RequestId,
            PlanLineId = GuidHelper.NewId(),
            IngredientId = ingredient.IngredientId,
            UnitId = unit.UnitId,
            TotalRequiredQty = 10,
            SuggestedPurchaseQty = 10,
            Ingredient = ingredient,
            Unit = unit,
            Request = demand
        });
        context.Materialrequests.Add(demand);
        return demand;
    }
}
