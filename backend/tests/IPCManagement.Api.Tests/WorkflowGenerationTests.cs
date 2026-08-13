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
using IPCManagement.Api.Shared.Contracts;

namespace IPCManagement.Api.Tests;

public partial class WorkflowGenerationTests
{
    [Fact]
    public async Task GetMealQuantityPlansAsync_Should_ExcludePlansWithoutRequestedShift()
    {
        await using var fixture = await WorkflowFixture.CreateAsync();
        await fixture.SeedMenuWithDemandAsync(includeMissingDish: false);
        await using var context = fixture.CreateContext();
        var menu = await context.Menus.SingleAsync();
        var afternoonScheduleId = GuidHelper.NewId();
        var afternoonPlanId = GuidHelper.NewId();
        context.Menuschedules.Add(new MenuSchedule
        {
            MenuScheduleId = afternoonScheduleId,
            CustomerId = fixture.CustomerId,
            MenuId = menu.MenuId,
            ServiceDate = new DateOnly(2026, 6, 15),
            WeekStartDate = new DateOnly(2026, 6, 15),
            ShiftName = "AFTERNOON",
            MenuPrice = 25000,
            BomRatePercent = 100,
            Status = "ACTIVE"
        });
        context.Mealquantityplans.Add(new MealQuantityPlan
        {
            QuantityPlanId = afternoonPlanId,
            PlanCode = "QTY-20260615-AFTERNOON",
            ServiceDate = new DateOnly(2026, 6, 15),
            Status = OrderStatus.Forecasted,
            ConfirmationTime = new TimeOnly(8, 30)
        });
        context.Mealquantityplanlines.Add(new MealQuantityPlanLine
        {
            QuantityPlanLineId = GuidHelper.NewId(),
            QuantityPlanId = afternoonPlanId,
            MenuScheduleId = afternoonScheduleId,
            CustomerId = fixture.CustomerId,
            MenuId = menu.MenuId,
            ShiftName = "AFTERNOON",
            ForecastServings = 120,
            FinalServings = 120
        });
        await context.SaveChangesAsync();

        var result = await new MealQuantityPlanService(context, new EfTransactionRunner(context))
            .GetMealQuantityPlansAsync(new MealQuantityPlanQueryDto
            {
                ServiceDate = "2026-06-15",
                ShiftName = "MORNING"
            });

        result.Should().ContainSingle();
        result.Single().Lines.Should().OnlyContain(line => line.ShiftName == "MORNING");
    }

    [Fact]
    public async Task GetMealQuantityPlansAsync_Should_MatchCustomerAndShiftOnTheSameLine()
    {
        await using var fixture = await WorkflowFixture.CreateAsync();
        await fixture.SeedMenuWithDemandAsync(includeMissingDish: false);
        await using var context = fixture.CreateContext();
        var menu = await context.Menus.SingleAsync();
        var secondCustomerId = GuidHelper.NewId();
        var secondScheduleId = GuidHelper.NewId();
        context.Customers.Add(new Customer
        {
            CustomerId = secondCustomerId,
            CustomerCode = "CUS-SECOND",
            CustomerName = "Second customer",
            IsActive = true
        });
        context.Menuschedules.Add(new MenuSchedule
        {
            MenuScheduleId = secondScheduleId,
            CustomerId = secondCustomerId,
            MenuId = menu.MenuId,
            ServiceDate = new DateOnly(2026, 6, 15),
            WeekStartDate = new DateOnly(2026, 6, 15),
            ShiftName = "AFTERNOON",
            MenuPrice = 25000,
            BomRatePercent = 100,
            Status = "ACTIVE"
        });
        context.Mealquantityplanlines.Add(new MealQuantityPlanLine
        {
            QuantityPlanLineId = GuidHelper.NewId(),
            QuantityPlanId = fixture.QuantityPlanId,
            MenuScheduleId = secondScheduleId,
            CustomerId = secondCustomerId,
            MenuId = menu.MenuId,
            ShiftName = "AFTERNOON",
            ForecastServings = 75,
            ConfirmedServings = 75,
            FinalServings = 75
        });
        await context.SaveChangesAsync();

        var service = new MealQuantityPlanService(context, new EfTransactionRunner(context));
        var mismatched = await service.GetMealQuantityPlansAsync(new MealQuantityPlanQueryDto
        {
            CustomerId = fixture.CustomerIdString,
            ServiceDate = "2026-06-15",
            ShiftName = "AFTERNOON"
        });
        var matched = await service.GetMealQuantityPlansAsync(new MealQuantityPlanQueryDto
        {
            CustomerId = GuidHelper.ToGuidString(secondCustomerId),
            ServiceDate = "2026-06-15",
            ShiftName = "AFTERNOON"
        });

        mismatched.Should().BeEmpty();
        matched.Should().ContainSingle();
        matched.Single().Lines.Should().ContainSingle(line =>
            line.CustomerId == GuidHelper.ToGuidString(secondCustomerId) &&
            line.ShiftName == "AFTERNOON");
    }

    [Fact]
    public async Task LockOrderPlanAsync_Should_RejectDraftMenuBeforeMutatingPlan()
    {
        await using var fixture = await WorkflowFixture.CreateAsync();
        await fixture.SeedMenuWithDemandAsync(includeMissingDish: false);
        await using (var setupContext = fixture.CreateContext())
        {
            (await setupContext.Mealquantityplans.SingleAsync()).Status = OrderStatus.Draft;
            (await setupContext.Menuschedules.SingleAsync()).Status = "DRAFT";
            await setupContext.SaveChangesAsync();
        }

        await using var context = fixture.CreateContext();
        var service = new OrderPlanService(context, new EfTransactionRunner(context));
        var act = () => service.LockOrderPlanAsync(new LockOrderPlanRequest
        {
            ServiceDate = "2026-06-15",
            Scope = "FULLDAY"
        }, fixture.UserIdString);

        await act.Should().ThrowAsync<BusinessRuleException>()
            .WithMessage("*thực đơn chưa được phát hành*");
        await using var verifyContext = fixture.CreateContext();
        (await verifyContext.Mealquantityplans.AsNoTracking().SingleAsync()).Status.Should().Be(OrderStatus.Draft);
        (await verifyContext.Auditlogs.AsNoTracking().CountAsync()).Should().Be(0);
    }

    [Fact]
    public async Task SignoffEndpoints_Should_RejectDraftLinkedMenuVersionBeforeMutation()
    {
        await using var fixture = await WorkflowFixture.CreateAsync();
        await fixture.SeedMenuWithDemandAsync(includeMissingDish: false);
        await using (var setupContext = fixture.CreateContext())
        {
            var plan = await setupContext.Mealquantityplans.SingleAsync();
            var schedule = await setupContext.Menuschedules.SingleAsync();
            var version = new MenuVersion
            {
                MenuVersionId = GuidHelper.NewId(),
                CustomerId = fixture.CustomerId,
                WeekStartDate = schedule.WeekStartDate,
                VersionNo = 1,
                Status = "DRAFT",
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            };
            plan.Status = OrderStatus.Confirmed;
            schedule.MenuVersionId = version.MenuVersionId;
            setupContext.Menuversions.Add(version);
            await setupContext.SaveChangesAsync();
        }

        await using var context = fixture.CreateContext();
        var service = new OrderSignoffService(context, new EfTransactionRunner(context));
        var scopeAct = () => service.SignoffOrderScopeAsync(new CoordinationScopeActionRequest
        {
            ServiceDate = "2026-06-15",
            ShiftName = "MORNING"
        }, fixture.UserIdString);
        var planAct = () => service.SignoffOrderAsync(
            GuidHelper.ToGuidString(fixture.QuantityPlanId),
            new SignoffOrderRequest(),
            fixture.UserIdString);

        await scopeAct.Should().ThrowAsync<BusinessRuleException>()
            .WithMessage("*thực đơn chưa được phát hành*");
        await planAct.Should().ThrowAsync<BusinessRuleException>()
            .WithMessage("*thực đơn chưa được phát hành*");
        await using var verifyContext = fixture.CreateContext();
        (await verifyContext.Mealquantityplans.AsNoTracking().SingleAsync()).Status.Should().Be(OrderStatus.Confirmed);
        (await verifyContext.Auditlogs.AsNoTracking().CountAsync()).Should().Be(0);
    }

    [Theory]
    [InlineData("ACTIVE")]
    [InlineData("PUBLISHED")]
    public async Task SignoffOrderScopeAsync_Should_AllowOperationalMenuVersion(string versionStatus)
    {
        await using var fixture = await WorkflowFixture.CreateAsync();
        await fixture.SeedMenuWithDemandAsync(includeMissingDish: false);
        await using (var setupContext = fixture.CreateContext())
        {
            var plan = await setupContext.Mealquantityplans.SingleAsync();
            var schedule = await setupContext.Menuschedules.SingleAsync();
            var version = new MenuVersion
            {
                MenuVersionId = GuidHelper.NewId(),
                CustomerId = fixture.CustomerId,
                WeekStartDate = schedule.WeekStartDate,
                VersionNo = 1,
                Status = versionStatus,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            };
            plan.Status = OrderStatus.Confirmed;
            schedule.MenuVersionId = version.MenuVersionId;
            setupContext.Menuversions.Add(version);
            await setupContext.SaveChangesAsync();
        }

        await using var context = fixture.CreateContext();
        var result = await new OrderSignoffService(context, new EfTransactionRunner(context))
            .SignoffOrderScopeAsync(new CoordinationScopeActionRequest
            {
                ServiceDate = "2026-06-15",
                ShiftName = "MORNING"
            }, fixture.UserIdString);

        result.Should().NotBeNull();
        result!.NewStatus.Should().Be(OrderStatus.Completed);
    }

    [Fact]
    public async Task SignoffOrderScopeAsync_Should_RejectPlanContainingAnotherShift()
    {
        await using var fixture = await WorkflowFixture.CreateAsync();
        await fixture.SeedMenuWithDemandAsync(includeMissingDish: false);
        await using (var setupContext = fixture.CreateContext())
        {
            var plan = await setupContext.Mealquantityplans.SingleAsync();
            var menu = await setupContext.Menus.SingleAsync();
            var schedule = await setupContext.Menuschedules.SingleAsync();
            var afternoonScheduleId = GuidHelper.NewId();
            plan.Status = OrderStatus.Confirmed;
            setupContext.Menuschedules.Add(new MenuSchedule
            {
                MenuScheduleId = afternoonScheduleId,
                CustomerId = fixture.CustomerId,
                MenuId = menu.MenuId,
                ServiceDate = schedule.ServiceDate,
                WeekStartDate = schedule.WeekStartDate,
                ShiftName = "AFTERNOON",
                MenuPrice = 25000,
                BomRatePercent = 100,
                Status = "ACTIVE"
            });
            setupContext.Mealquantityplanlines.Add(new MealQuantityPlanLine
            {
                QuantityPlanLineId = GuidHelper.NewId(),
                QuantityPlanId = fixture.QuantityPlanId,
                MenuScheduleId = afternoonScheduleId,
                CustomerId = fixture.CustomerId,
                MenuId = menu.MenuId,
                ShiftName = "AFTERNOON",
                ForecastServings = 100,
                ConfirmedServings = 100,
                FinalServings = 100
            });
            await setupContext.SaveChangesAsync();
        }

        await using var context = fixture.CreateContext();
        var service = new OrderSignoffService(context, new EfTransactionRunner(context));
        var act = () => service.SignoffOrderScopeAsync(new CoordinationScopeActionRequest
        {
            ServiceDate = "2026-06-15",
            ShiftName = "MORNING"
        }, fixture.UserIdString);

        await act.Should().ThrowAsync<BusinessRuleException>()
            .WithMessage("*chứa nhiều ca*");
        await using var verifyContext = fixture.CreateContext();
        (await verifyContext.Mealquantityplans.AsNoTracking().SingleAsync()).Status.Should().Be(OrderStatus.Confirmed);
        (await verifyContext.Auditlogs.AsNoTracking().CountAsync()).Should().Be(0);
    }

    [Fact]
    public async Task UpsertQuickServingsAsync_Should_RejectDraftMenuBeforeMutation()
    {
        await using var fixture = await WorkflowFixture.CreateAsync();
        await fixture.SeedMenuWithDemandAsync(includeMissingDish: false);
        await using (var setupContext = fixture.CreateContext())
        {
            (await setupContext.Menuschedules.SingleAsync()).Status = "DRAFT";
            await setupContext.SaveChangesAsync();
        }

        await using var context = fixture.CreateContext();
        var service = new MealQuantityPlanService(context, new EfTransactionRunner(context));
        var act = () => service.UpsertQuickServingsAsync(new UpsertQuickServingsRequest
        {
            CustomerId = fixture.CustomerIdString,
            ServiceDate = "2026-06-15",
            ShiftName = "MORNING",
            Servings = 120,
            Complete = true
        }, fixture.UserIdString);

        await act.Should().ThrowAsync<BusinessRuleException>()
            .WithMessage("*thực đơn chưa được phát hành*");
        await using var verifyContext = fixture.CreateContext();
        (await verifyContext.Auditlogs.AsNoTracking().CountAsync()).Should().Be(0);
    }

    [Fact]
    public async Task GenerateMaterialDemandAsync_Should_RejectCompletedPlanWithDraftMenu()
    {
        await using var fixture = await WorkflowFixture.CreateAsync();
        await fixture.SeedMenuWithDemandAsync(includeMissingDish: false);
        await using (var setupContext = fixture.CreateContext())
        {
            (await setupContext.Menuschedules.SingleAsync()).Status = "DRAFT";
            await setupContext.SaveChangesAsync();
        }

        await using var context = fixture.CreateContext();
        var service = new MaterialDemandService(context);
        var act = () => service.GenerateAsync(new GenerateMaterialDemandRequest
        {
            ServiceDate = "2026-06-15",
            Scope = "FULLDAY",
            CustomerId = fixture.CustomerIdString
        }, fixture.UserIdString);

        await act.Should().ThrowAsync<BusinessRuleException>()
            .WithMessage("*thực đơn chưa được phát hành*");
        await using var verifyContext = fixture.CreateContext();
        (await verifyContext.Materialrequests.AsNoTracking().CountAsync()).Should().Be(0);
        (await verifyContext.Auditlogs.AsNoTracking().CountAsync()).Should().Be(0);
    }

    [Fact]
    public async Task GetIngredientDemandAggregatePageAsync_Should_GroupDemandByIngredientAndDate()
    {
        await using var fixture = await WorkflowFixture.CreateAsync();
        await fixture.SeedMenuWithDemandAsync(includeMissingDish: false);

        await using (var context = fixture.CreateContext())
        {
            await new MaterialDemandService(context).GenerateAsync(
                new GenerateMaterialDemandRequest { ServiceDate = "2026-06-15", Scope = "FULLDAY" },
                fixture.UserIdString);

            var firstLine = await context.Materialrequestlines.SingleAsync();
            firstLine.CurrentStockQty = 2m;
            context.Materialrequestlines.Add(new MaterialRequestLine
            {
                RequestLineId = GuidHelper.NewId(),
                RequestId = firstLine.RequestId,
                PlanLineId = firstLine.PlanLineId,
                IngredientId = firstLine.IngredientId,
                UnitId = firstLine.UnitId,
                BomId = firstLine.BomId,
                PriceTierAmount = firstLine.PriceTierAmount,
                BomScope = firstLine.BomScope,
                TotalServings = 10,
                GrossQtyPerServing = 1m,
                BomRatePercent = 100m,
                TotalRequiredQty = 6m,
                CurrentStockQty = 3m,
                SuggestedPurchaseQty = 3m,
            });
            await context.SaveChangesAsync();
        }

        await using var reportContext = fixture.CreateContext();
        var page = await new DemandReportService(reportContext).GetIngredientDemandAggregatePageAsync(
            new IngredientDemandAggregatePageQueryDto
            {
                DateFrom = "2026-06-15",
                DateTo = "2026-06-15",
                PageNumber = 1,
                PageSize = 1,
            });

        page.TotalCount.Should().Be(1);
        page.Items.Should().ContainSingle();
        page.Items[0].RequestDate.Should().Be(new DateOnly(2026, 6, 15));
        page.Items[0].TotalRequiredQty.Should().Be(206m);
        page.Items[0].CurrentStockQty.Should().Be(5m);
        page.Items[0].LineCount.Should().Be(2);
    }

    [Fact]
    public async Task GetIngredientDemandAggregatePageAsync_Should_Not_Report_Received_Issue_As_Missing()
    {
        await using var fixture = await WorkflowFixture.CreateAsync();
        await fixture.SeedMenuWithDemandAsync(includeMissingDish: false);

        await using (var context = fixture.CreateContext())
        {
            await new MaterialDemandService(context).GenerateAsync(
                new GenerateMaterialDemandRequest { ServiceDate = "2026-06-15", Scope = "FULLDAY" },
                fixture.UserIdString);
            var line = await context.Materialrequestlines.SingleAsync();
            line.Request.Status = "EXPORTED";
            var issue = new InventoryIssue
            {
                IssueId = fixture.IssueId,
                IssueCode = "ISSUE-RECEIVED-DEMAND-PROJECTION",
                IssueDate = new DateOnly(2026, 6, 15),
                ShiftName = "MORNING",
                WarehouseId = fixture.WarehouseId,
                MaterialRequestId = line.RequestId,
                IssuedBy = fixture.UserId,
                ReceivedBy = fixture.UserId,
                ReceivedAt = DateTime.UtcNow,
                CreatedAt = DateTime.UtcNow,
            };
            issue.Inventoryissuelines.Add(new InventoryIssueLine
            {
                IssueLineId = GuidHelper.NewId(),
                IssueId = issue.IssueId,
                IngredientId = line.IngredientId,
                UnitId = line.UnitId,
                MaterialRequestLineId = line.RequestLineId,
                RequestedQty = line.TotalRequiredQty,
                IssuedQty = line.TotalRequiredQty,
            });
            context.Inventoryissues.Add(issue);
            await context.SaveChangesAsync();
        }

        await using var reportContext = fixture.CreateContext();
        var page = await new DemandReportService(reportContext).GetIngredientDemandAggregatePageAsync(
            new IngredientDemandAggregatePageQueryDto
            {
                DateFrom = "2026-06-15",
                DateTo = "2026-06-15",
                PageNumber = 1,
                PageSize = 20,
            });

        page.ShortageCount.Should().Be(0);
        var item = page.Items.Should().ContainSingle().Subject;
        item.FulfilledQty.Should().Be(item.TotalRequiredQty);
        item.OutstandingQty.Should().Be(0);
        item.FulfillmentStatus.Should().Be("FULFILLED");
        item.SuggestedPurchaseQty.Should().BeGreaterThan(0, "the immutable demand calculation remains historical evidence");
    }

    [Fact]
    public async Task GetIngredientDemandAggregatePageAsync_Should_SearchIngredientBeforePaging()
    {
        await using var fixture = await WorkflowFixture.CreateAsync();
        await fixture.SeedMenuWithDemandAsync(includeMissingDish: false);
        await using (var context = fixture.CreateContext())
        {
            await new MaterialDemandService(context).GenerateAsync(
                new GenerateMaterialDemandRequest { ServiceDate = "2026-06-15", Scope = "FULLDAY" },
                fixture.UserIdString);

        }

        await using var reportContext = fixture.CreateContext();
        var service = new DemandReportService(reportContext);
        var baseline = await service.GetIngredientDemandAggregatePageAsync(
            new IngredientDemandAggregatePageQueryDto { PageNumber = 1, PageSize = 20 });
        var ingredientName = baseline.Items.Should().ContainSingle().Subject.IngredientName!;

        var matching = await service.GetIngredientDemandAggregatePageAsync(
            new IngredientDemandAggregatePageQueryDto
            {
                SearchKeyword = ingredientName,
                PageNumber = 1,
                PageSize = 1,
            });
        var missing = await service.GetIngredientDemandAggregatePageAsync(
            new IngredientDemandAggregatePageQueryDto
            {
                SearchKeyword = "KHÔNG-CÓ-NGUYÊN-LIỆU-NÀY",
                PageNumber = 1,
                PageSize = 1,
            });

        matching.Items.Should().ContainSingle().Which.IngredientName.Should().Be(ingredientName);
        matching.TotalCount.Should().Be(1);
        missing.Items.Should().BeEmpty();
        missing.TotalCount.Should().Be(0);
    }

    [Fact]
    public async Task GetIngredientDemandAggregatePageAsync_Should_ExcludeCancelledDemandFromActiveTotals()
    {
        await using var fixture = await WorkflowFixture.CreateAsync();
        await fixture.SeedMenuWithDemandAsync(includeMissingDish: false);

        await using (var context = fixture.CreateContext())
        {
            await new MaterialDemandService(context).GenerateAsync(
                new GenerateMaterialDemandRequest { ServiceDate = "2026-06-15", Scope = "FULLDAY" },
                fixture.UserIdString);

            var activeLine = await context.Materialrequestlines.AsNoTracking().SingleAsync();
            var cancelledRequestId = GuidHelper.NewId();
            context.Materialrequests.Add(new MaterialRequest
            {
                RequestId = cancelledRequestId,
                RequestCode = "MR-CANCELLED-STALE",
                PlanId = fixture.ProductionPlanId,
                RequestDate = new DateOnly(2026, 6, 15),
                RequestScope = "FULLDAY",
                Status = "CANCELLED",
                CreatedBy = fixture.UserId,
                Materialrequestlines =
                [
                    new MaterialRequestLine
                    {
                        RequestLineId = GuidHelper.NewId(),
                        RequestId = cancelledRequestId,
                        PlanLineId = activeLine.PlanLineId,
                        IngredientId = activeLine.IngredientId,
                        UnitId = activeLine.UnitId,
                        TotalServings = 500,
                        GrossQtyPerServing = 1,
                        BomRatePercent = 100,
                        TotalRequiredQty = 500,
                        CurrentStockQty = 0,
                        SuggestedPurchaseQty = 500,
                    },
                ],
            });
            await context.SaveChangesAsync();
        }

        await using var reportContext = fixture.CreateContext();
        var page = await new DemandReportService(reportContext).GetIngredientDemandAggregatePageAsync(
            new IngredientDemandAggregatePageQueryDto
            {
                DateFrom = "2026-06-15",
                DateTo = "2026-06-15",
                PageNumber = 1,
                PageSize = 20,
            });

        page.TotalCount.Should().Be(1);
        page.ShortageCount.Should().Be(1);
        var item = page.Items.Should().ContainSingle().Subject;
        item.TotalRequiredQty.Should().Be(200m);
        item.SuggestedPurchaseQty.Should().Be(200m);
        item.LineCount.Should().Be(1);
        item.HasCancelledLine.Should().BeFalse();
    }

    [Fact]
    public async Task GetIngredientDemandPageAsync_Should_CountOnlyUncoveredActiveShortages()
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
            purchase!.Lines.Should().ContainSingle();
        }

        await using var reportContext = fixture.CreateContext();
        var page = await new DemandReportService(reportContext).GetIngredientDemandPageAsync(
            new IngredientDemandPageQueryDto
            {
                DateFrom = "2026-06-15",
                DateTo = "2026-06-15",
                PageNumber = 1,
                PageSize = 20,
            });

        page.TotalCount.Should().Be(1);
        page.Items.Should().ContainSingle();
        page.Items[0].SuggestedPurchaseQty.Should().BeGreaterThan(0);
        page.ShortageCount.Should().Be(0);
    }

    [Fact]
    public async Task GetMaterialRequestCandidatePageAsync_Should_PagePurchaseCandidatesBeyondOneHundredRequests()
    {
        await using var fixture = await WorkflowFixture.CreateAsync();
        await fixture.SeedMenuWithDemandAsync(includeMissingDish: false);

        await using (var context = fixture.CreateContext())
        {
            await new MaterialDemandService(context).GenerateAsync(
                new GenerateMaterialDemandRequest { ServiceDate = "2026-06-15", Scope = "FULLDAY" },
                fixture.UserIdString);

            var planLineId = await context.Productionplanlines.Select(line => line.PlanLineId).SingleAsync();
            for (var index = 1; index <= 105; index++)
            {
                var requestId = GuidHelper.NewId();
                context.Materialrequests.Add(new MaterialRequest
                {
                    RequestId = requestId,
                    RequestCode = $"MR-PAGED-{index:000}",
                    PlanId = fixture.ProductionPlanId,
                    RequestDate = new DateOnly(2026, 6, 15).AddDays(index),
                    RequestScope = "FULLDAY",
                    Status = "DRAFT",
                    CreatedBy = fixture.UserId,
                    Materialrequestlines =
                    [
                        new MaterialRequestLine
                        {
                            RequestLineId = GuidHelper.NewId(),
                            RequestId = requestId,
                            PlanLineId = planLineId,
                            IngredientId = fixture.IngredientId,
                            UnitId = fixture.UnitId,
                            TotalServings = 1,
                            GrossQtyPerServing = 1,
                            BomRatePercent = 100,
                            TotalRequiredQty = 1,
                            CurrentStockQty = 0,
                            SuggestedPurchaseQty = 1,
                        },
                    ],
                });
            }

            await context.SaveChangesAsync();
        }

        await using var reportContext = fixture.CreateContext();
        var page = await new DemandReportService(reportContext).GetMaterialRequestCandidatePageAsync(
            new MaterialRequestCandidatePageQueryDto
            {
                Purpose = "purchase",
                PageNumber = 2,
                PageSize = 100,
            });

        page.TotalCount.Should().Be(106);
        page.Items.Should().HaveCount(6);
        page.HasPrev.Should().BeTrue();
        page.HasNext.Should().BeFalse();
        page.Items.Should().OnlyContain(item => item.ActionableLineCount == 1 && item.ActionableQuantity > 0);
    }

    [Fact]
    public async Task GetMaterialRequestCandidatePageAsync_Should_ReturnOnlyApprovedUnissuedRequestsForWarehouse()
    {
        await using var fixture = await WorkflowFixture.CreateAsync();
        await fixture.SeedMenuWithDemandAsync(includeMissingDish: false);

        await using (var context = fixture.CreateContext())
        {
            await new MaterialDemandService(context).GenerateAsync(
                new GenerateMaterialDemandRequest { ServiceDate = "2026-06-15", Scope = "FULLDAY" },
                fixture.UserIdString);
            var request = await context.Materialrequests.SingleAsync();
            request.Status = "MANAGERAPPROVED";
            await context.SaveChangesAsync();
        }

        await using var reportContext = fixture.CreateContext();
        var page = await new DemandReportService(reportContext).GetMaterialRequestCandidatePageAsync(
            new MaterialRequestCandidatePageQueryDto
            {
                Purpose = "issue",
                PageNumber = 1,
                PageSize = 8,
            });

        var candidate = page.Items.Should().ContainSingle().Subject;
        candidate.Status.Should().Be("MANAGERAPPROVED");
        candidate.ActionableQuantity.Should().Be(200m);
    }

}
