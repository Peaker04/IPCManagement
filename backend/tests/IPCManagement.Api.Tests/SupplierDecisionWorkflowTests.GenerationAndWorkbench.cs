using FluentAssertions;
using IPCManagement.Api.Exceptions;
using IPCManagement.Api.Data;
using IPCManagement.Api.Data.Transactions;
using IPCManagement.Api.Helpers;
using IPCManagement.Api.Data.Repositories;
using IPCManagement.Api.Models.Entities;
using IPCManagement.Api.Security;
using IPCManagement.DatabaseTool;
using Microsoft.Data.Sqlite;
using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Metadata;
using MySqlConnector;
using System.Security.Cryptography;
using System.Text;
using System.Data.Common;
using IPCManagement.Api.Features.Inventory.Services;
using IPCManagement.Api.Features.Purchasing.Contracts;
using IPCManagement.Api.Features.Purchasing.Controllers;
using IPCManagement.Api.Features.Purchasing.Services;

namespace IPCManagement.Api.Tests;

public partial class SupplierDecisionWorkflowTests
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
            new GeneratePurchaseRequestFromDemandRequest
            {
                MaterialRequestId = GuidHelper.ToGuidString(demand.RequestId)
            },
            UserId);

        await act.Should().ThrowAsync<BusinessRuleException>()
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
        var request = new GeneratePurchaseRequestFromDemandRequest
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
            new GeneratePurchaseRequestFromDemandRequest
            {
                MaterialRequestId = GuidHelper.ToGuidString(demand.RequestId)
            },
            UserId);

        await act.Should().ThrowAsync<BusinessRuleException>()
            .WithMessage("*FULLDAY*");
        (await context.Purchaserequests.CountAsync()).Should().Be(0);
    }

    [Fact]
    public async Task ApprovedDemand_Generation_groups_compatible_demands_and_reconciles_only_current_demand()
    {
        await using var context = CreateContext();
        var serviceDate = new DateOnly(2026, 7, 20);
        var demandA = SeedDemand(context, "MANAGERAPPROVED", serviceDate, "FULLDAY", "MR-ANV");
        var demandB = SeedDemand(context, "MANAGERAPPROVED", serviceDate, "FULLDAY", "MR-DAV");
        await context.SaveChangesAsync();
        var service = CreateService(context);
        await service.GenerateFromDemandAsync(
            new GeneratePurchaseRequestFromDemandRequest
            {
                MaterialRequestId = GuidHelper.ToGuidString(demandA.RequestId)
            },
            UserId);

        var pending = await service.GetWorkbenchWeekAsync(new PurchaseWorkbenchQueryDto
        {
            Week = "2026-07-20",
            Date = "2026-07-20",
            Stage = "demand"
        });
        pending.ServiceDates.Should().ContainSingle().Which.CurrentStage.Should().Be("demand");
        pending.ServiceDates.Single().ApprovedDemandCount.Should().Be(2);
        pending.ServiceDates.Single().ShortageLineCount.Should().Be(2);
        pending.ServiceDates.Single().ApprovedDemands.Should().ContainSingle()
            .Which.MaterialRequestId.Should().Be(GuidHelper.ToGuidString(demandB.RequestId));

        await service.GenerateFromDemandAsync(
            new GeneratePurchaseRequestFromDemandRequest
            {
                MaterialRequestId = GuidHelper.ToGuidString(demandB.RequestId)
            },
            UserId);

        (await context.Purchaserequests.CountAsync()).Should().Be(1);
        (await context.Purchaserequestlines.CountAsync()).Should().Be(2);
        (await context.Purchaserequestlines
                .Select(line => line.MaterialRequestLineId)
                .ToListAsync())
            .Should().BeEquivalentTo(new[]
            {
                demandA.Materialrequestlines.Single().RequestLineId,
                demandB.Materialrequestlines.Single().RequestLineId
            });

        demandA.Materialrequestlines.Single().SuggestedPurchaseQty = 0;
        await context.SaveChangesAsync();
        await service.GenerateFromDemandAsync(
            new GeneratePurchaseRequestFromDemandRequest
            {
                MaterialRequestId = GuidHelper.ToGuidString(demandA.RequestId)
            },
            UserId);

        (await context.Purchaserequestlines.SingleAsync()).MaterialRequestLineId
            .Should().Equal(demandB.Materialrequestlines.Single().RequestLineId);
    }

    [Fact]
    public async Task Submit_accepts_union_of_compatible_grouped_demands()
    {
        await using var context = CreateContext();
        var serviceDate = new DateOnly(2026, 7, 20);
        var demandA = SeedDemand(context, "MANAGERAPPROVED", serviceDate, "FULLDAY", "MR-ANV");
        var demandB = SeedDemand(context, "MANAGERAPPROVED", serviceDate, "FULLDAY", "MR-DAV");
        var supplier = SeedSupplier(context);
        await context.SaveChangesAsync();
        var service = CreateService(context);
        foreach (var demand in new[] { demandA, demandB })
        {
            await service.GenerateFromDemandAsync(new GeneratePurchaseRequestFromDemandRequest
            {
                MaterialRequestId = GuidHelper.ToGuidString(demand.RequestId)
            }, UserId);
        }

        var request = await context.Purchaserequests
            .Include(item => item.Purchaserequestlines)
            .SingleAsync();
        foreach (var line in request.Purchaserequestlines)
        {
            line.SupplierId = supplier.SupplierId;
            line.Supplier = supplier;
            line.EstimatedUnitPrice = 100m;
            line.ExpectedDeliveryDate = serviceDate;
            line.SupplierDecisions.Add(new PurchaseLineSupplierDecision
            {
                PurchaseLineSupplierDecisionId = GuidHelper.NewId(),
                PurchaseRequestLineId = line.PurchaseRequestLineId,
                SupplierId = supplier.SupplierId,
                EvidenceType = "EFFECTIVE_QUOTATION",
                EvidenceId = GuidHelper.NewId(),
                EvidenceDate = serviceDate,
                EvidenceReferencePrice = 100m,
                ProposedUnitPrice = 100m,
                ProposedDeliveryDate = serviceDate,
                ConfirmedBy = UserIdBytes,
                ConfirmedAt = DateTime.UtcNow,
                DecisionFingerprint = Convert.ToHexString(SHA256.HashData(line.PurchaseRequestLineId)),
                Version = 1,
                Status = "CURRENT",
                CurrentDecisionKey = line.PurchaseRequestLineId,
                PurchaseRequestLine = line
            });
        }
        await context.SaveChangesAsync();

        var submitted = await service.SubmitAsync(GuidHelper.ToGuidString(request.PurchaseRequestId), UserId);

        submitted!.Status.Should().Be("SENTTOSUPPLIER");
        submitted.Lines.Should().HaveCount(2);
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
    public async Task Workbench_treats_reopened_empty_draft_as_demand_to_allow_regeneration()
    {
        await using var context = CreateContext();
        var demand = SeedDemand(
            context,
            "MANAGERAPPROVED",
            new DateOnly(2026, 7, 20),
            "FULLDAY",
            "MR-REOPENED");
        context.Purchaserequests.Add(new PurchaseRequest
        {
            PurchaseRequestId = GuidHelper.NewId(),
            PurchaseRequestCode = "PR-20260720-FULLDAY",
            RequestDate = demand.RequestDate,
            PurchaseForDate = demand.RequestDate,
            Status = "DRAFT",
            CreatedBy = UserIdBytes
        });
        await context.SaveChangesAsync();

        var result = await CreateService(context).GetWorkbenchWeekAsync(new PurchaseWorkbenchQueryDto
        {
            Week = "2026-07-20",
            Date = "2026-07-20",
            Stage = "demand"
        });

        var selected = result.ServiceDates.Should().ContainSingle().Subject;
        selected.CurrentStage.Should().Be("demand");
        selected.PurchaseLines.Should().BeEmpty();
        selected.ApprovedDemands.Should().ContainSingle()
            .Which.MaterialRequestId.Should().Be(GuidHelper.ToGuidString(demand.RequestId));
        result.StageCounts.Demand.Should().Be(1);
        result.StageCounts.SupplierPrice.Should().Be(0);
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

}
