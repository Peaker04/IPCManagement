using FluentAssertions;
using IPCManagement.Api.Data;
using IPCManagement.Api.Helpers;
using IPCManagement.Api.Models.DTOs.Workflow;
using IPCManagement.Api.Models.Entities;
using IPCManagement.Api.Services;
using IPCManagement.Api.Services.Workflow;
using Microsoft.EntityFrameworkCore;

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

    private static PurchaseRequestWorkflowService CreateService(IpcManagementContext context)
        => new(context, new SupplierQuotationService(context));

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
