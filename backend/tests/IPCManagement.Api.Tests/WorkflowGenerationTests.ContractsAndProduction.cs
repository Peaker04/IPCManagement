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
using IPCManagement.Api.Features.Coordination.Controllers;
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
using IPCManagement.Api.Security;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;

namespace IPCManagement.Api.Tests;

public partial class WorkflowGenerationTests
{
    [Fact]
    public async Task CustomerContractEffectiveRangeAudit_Should_JoinApiTransitionActorAndCorrelation()
    {
        await using var fixture = await WorkflowFixture.CreateAsync();
        await fixture.SeedMenuWithDemandAsync(includeMissingDish: false);
        await using var context = fixture.CreateContext();
        var customerIdBytes = await context.Customers.Select(item => item.CustomerId).SingleAsync();
        var customerId = GuidHelper.ToGuidString(customerIdBytes);
        context.Customercontracts.Add(new CustomerContract
        {
            ContractId = GuidHelper.NewId(),
            CustomerId = customerIdBytes,
            EffectiveFrom = new DateOnly(2026, 6, 15),
            EffectiveTo = null,
            ActiveWeekDays = "t2,t3,t4,t5,t6,t7",
            ShiftNames = "MORNING,AFTERNOON",
            DefaultMenuPrice = 25000m,
            DefaultBomRatePercent = 100m,
            Status = "ACTIVE",
            CreatedAt = DateTime.UtcNow.AddDays(-1),
            UpdatedAt = DateTime.UtcNow.AddDays(-1)
        });
        await context.SaveChangesAsync();
        var oldEffectiveTo = await context.Customercontracts.Select(item => item.EffectiveTo).SingleAsync();
        const string correlationId = "contract-range-20260803";
        var currentUser = Substitute.For<ICurrentUserService>();
        currentUser.GetUserId(Arg.Any<ClaimsPrincipal>()).Returns(fixture.UserIdString);
        var controller = new CustomerContractsController(new CustomerContractService(context), currentUser)
        {
            ControllerContext = new ControllerContext { HttpContext = new DefaultHttpContext() }
        };
        controller.HttpContext.TraceIdentifier = correlationId;

        var action = await controller.UpdateCustomerContractAsync(
            customerId,
            new UpdateCustomerContractRequest { EffectiveTo = "2026-06-30" });

        var response = action.Should().BeOfType<OkObjectResult>().Subject.Value
            .Should().BeOfType<ApiResponse<CustomerContractDto>>().Subject;
        response.Data!.EffectiveTo.Should().Be("2026-06-30");
        (await context.Customercontracts.AsNoTracking().Select(item => item.EffectiveTo).SingleAsync())
            .Should().Be(new DateOnly(2026, 6, 30));
        var audit = await context.Auditlogs.AsNoTracking().SingleAsync(item =>
            item.EntityName == nameof(CustomerContract) &&
            item.FieldName == nameof(CustomerContract.EffectiveTo));
        audit.OldValue.Should().Be(oldEffectiveTo?.ToString("yyyy-MM-dd"));
        audit.NewValue.Should().Be("2026-06-30");
        audit.ChangedBy.Should().Equal(fixture.UserId);
        audit.CorrelationId.Should().Be(correlationId);
    }

    [Fact]
    public async Task CustomerContract_Should_UpdateCustomerContract_AndWriteAudit()
    {
        await using var fixture = await WorkflowFixture.CreateAsync();
        await fixture.SeedMenuWithDemandAsync(includeMissingDish: false);

        await using var context = fixture.CreateContext();
        var service = new CoordinationConfigurationTestHarness(context);

        var contracts = await service.GetCustomerContractsAsync();
        var contract = contracts.Should().ContainSingle().Subject;
        contract.ActiveWeekDays.Should().Contain("t2");
        contract.ShiftNames.Should().Contain("MORNING");

        var updated = await service.UpdateCustomerContractAsync(
            contract.CustomerId,
            new UpdateCustomerContractRequest
            {
                Note = "No beef on Monday",
                IsActive = false,
                EffectiveFrom = "2026-06-15",
                ActiveWeekDays = ["t2"],
                ShiftNames = ["MORNING"],
                DefaultMenuPrice = 25000,
                DefaultBomRatePercent = 135
            },
            fixture.UserIdString);

        updated.Should().NotBeNull();
        updated!.Note.Should().Be("No beef on Monday");
        updated.IsActive.Should().BeFalse();
        updated.ContractId.Should().NotBeNullOrWhiteSpace();
        updated.ContractStatus.Should().Be("ACTIVE");
        updated.EffectiveFrom.Should().Be("2026-06-15");
        updated.ActiveWeekDays.Should().Equal("t2");
        updated.ShiftNames.Should().Equal("MORNING");
        updated.DefaultMenuPrice.Should().Be(25000);
        updated.DefaultBomRatePercent.Should().Be(100);

        var contractRow = await context.Customercontracts.AsNoTracking().SingleAsync();
        contractRow.DefaultMenuPrice.Should().Be(25000);
        contractRow.DefaultBomRatePercent.Should().Be(100);
        contractRow.ActiveWeekDays.Should().Be("t2");
        contractRow.ShiftNames.Should().Be("MORNING");

        var schedule = await context.Menuschedules.AsNoTracking().SingleAsync();
        schedule.MenuPrice.Should().Be(25000);
        schedule.BomRatePercent.Should().Be(100);

        var audits = await context.Auditlogs.AsNoTracking()
            .Where(item => item.BusinessArea == "CustomerContract")
            .ToListAsync();
        audits.Should().HaveCountGreaterThanOrEqualTo(3);
        audits.Select(item => item.FieldName).Should().Contain([
            nameof(Customer.Note),
            nameof(Customer.IsActive),
            "ContractCreated"
        ]);
    }

    [Fact]
    public async Task CustomerContract_Should_CreateCustomerAndContract_AndBlockDuplicateCode()
    {
        await using var fixture = await WorkflowFixture.CreateAsync();

        await using var context = fixture.CreateContext();
        var service = new CoordinationConfigurationTestHarness(context);

        var created = await service.CreateCustomerContractAsync(
            new CreateCustomerContractRequest
            {
                CustomerCode = " new ",
                CustomerName = "New Customer",
                Note = "No pork",
                EffectiveFrom = "2026-06-15",
                ActiveWeekDays = ["t2", "t3"],
                ShiftNames = ["MORNING", "AFTERNOON"],
                DefaultMenuPrice = 50000,
                DefaultBomRatePercent = 120
            },
            fixture.UserIdString);

        created.CustomerCode.Should().Be("NEW");
        created.CustomerName.Should().Be("New Customer");
        created.Note.Should().Be("No pork");
        created.ContractId.Should().NotBeNullOrWhiteSpace();
        created.ContractStatus.Should().Be("ACTIVE");
        created.ActiveWeekDays.Should().Equal("t2", "t3");
        created.ShiftNames.Should().Equal("AFTERNOON", "MORNING");
        created.DefaultMenuPrice.Should().Be(50000);
        created.DefaultBomRatePercent.Should().Be(100);

        (await context.Customers.AsNoTracking().CountAsync()).Should().Be(1);
        (await context.Customercontracts.AsNoTracking().CountAsync()).Should().Be(1);
        var audits = await context.Auditlogs.AsNoTracking()
            .Where(item => item.BusinessArea == "CustomerContract")
            .Select(item => item.FieldName)
            .ToListAsync();
        audits.Should().Contain(["CustomerCreated", "ContractCreated"]);

        Func<Task> duplicate = async () => await service.CreateCustomerContractAsync(
            new CreateCustomerContractRequest
            {
                CustomerCode = "NEW",
                CustomerName = "Duplicate",
                ActiveWeekDays = ["t2"],
                ShiftNames = ["MORNING"]
            },
            fixture.UserIdString);

        await duplicate.Should().ThrowAsync<ArgumentException>()
            .WithMessage("*đã tồn tại*");
    }

    [Fact]
    public async Task CustomerContract_Should_BlockOverlappingEffectiveContract()
    {
        await using var fixture = await WorkflowFixture.CreateAsync();
        await fixture.SeedMenuWithDemandAsync(includeMissingDish: false);

        string customerId;
        await using (var context = fixture.CreateContext())
        {
            var service = new CoordinationConfigurationTestHarness(context);
            var contract = (await service.GetCustomerContractsAsync()).Should().ContainSingle().Subject;
            customerId = contract.CustomerId;
            await service.UpdateCustomerContractAsync(
                customerId,
                new UpdateCustomerContractRequest
                {
                    EffectiveFrom = "2026-06-15",
                    ActiveWeekDays = ["t2"],
                    ShiftNames = ["MORNING"],
                    DefaultMenuPrice = 25000,
                    DefaultBomRatePercent = 120
                },
                fixture.UserIdString);
        }

        await using (var context = fixture.CreateContext())
        {
            context.Customercontracts.Add(new CustomerContract
            {
                ContractId = GuidHelper.NewId(),
                CustomerId = GuidHelper.ParseGuidString(customerId)!,
                EffectiveFrom = new DateOnly(2026, 6, 16),
                ActiveWeekDays = "t3",
                ShiftNames = "AFTERNOON",
                DefaultMenuPrice = 45000,
                DefaultBomRatePercent = 130,
                Status = "ACTIVE",
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            });
            await context.SaveChangesAsync();
        }

        await using (var context = fixture.CreateContext())
        {
            var service = new CoordinationConfigurationTestHarness(context);
            Func<Task> act = async () => await service.UpdateCustomerContractAsync(
                customerId,
                new UpdateCustomerContractRequest
                {
                    EffectiveFrom = "2026-06-15",
                    ActiveWeekDays = ["t2"],
                    ShiftNames = ["MORNING"],
                    DefaultMenuPrice = 46000,
                    DefaultBomRatePercent = 140
                },
                fixture.UserIdString);

            await act.Should().ThrowAsync<ArgumentException>()
                .WithMessage("*trùng hiệu lực*");
        }
    }

    [Fact]
    public async Task PortionRuleApi_Should_ResolvePriorityEffectiveDate_AndBlockOverlap()
    {
        await using var fixture = await WorkflowFixture.CreateAsync();
        await fixture.SeedMenuWithDemandAsync(includeMissingDish: false);

        await using var context = fixture.CreateContext();
        var service = new CoordinationConfigurationTestHarness(context);
        var customerId = GuidHelper.ToGuidString(await context.Customers
            .Select(item => item.CustomerId)
            .SingleAsync());
        var dishId = GuidHelper.ToGuidString(fixture.DishWithBomId);

        var categoryRule = await service.CreatePortionRuleAsync(
            new CreatePortionRuleRequest
            {
                CustomerId = customerId,
                EffectiveFrom = "2026-06-01",
                EffectiveTo = "2026-06-20",
                ActiveWeekDays = ["t2"],
                ShiftNames = ["MORNING"],
                SlotName = "mon_chinh",
                PortionRatePercent = 80,
                Reason = "Category portion"
            },
            fixture.UserIdString);
        categoryRule.RuleSource.Should().Be("CATEGORY_SLOT");

        var dishRule = await service.CreatePortionRuleAsync(
            new CreatePortionRuleRequest
            {
                CustomerId = customerId,
                DishId = dishId,
                EffectiveFrom = "2026-06-01",
                EffectiveTo = "2026-06-20",
                ActiveWeekDays = ["t2"],
                ShiftNames = ["MORNING"],
                SlotName = "mon_chinh",
                PortionRatePercent = 120,
                BomRatePercent = 110,
                Reason = "Dish override"
            },
            fixture.UserIdString);
        dishRule.RuleSource.Should().Be("DISH_OVERRIDE");

        var resolvedDish = await service.ResolvePortionRuleAsync(new ResolvePortionRuleRequest
        {
            CustomerId = customerId,
            ServiceDate = "2026-06-15",
            ShiftName = "MORNING",
            SlotName = "mon_chinh",
            DishId = dishId
        });
        resolvedDish.Should().NotBeNull();
        resolvedDish!.Source.Should().Be("DISH_OVERRIDE");
        resolvedDish.PortionRatePercent.Should().Be(120);
        resolvedDish.BomRatePercent.Should().Be(100);

        var resolvedCategory = await service.ResolvePortionRuleAsync(new ResolvePortionRuleRequest
        {
            CustomerId = customerId,
            ServiceDate = "2026-06-15",
            ShiftName = "MORNING",
            SlotName = "mon_chinh"
        });
        resolvedCategory.Should().NotBeNull();
        resolvedCategory!.Source.Should().Be("CATEGORY_SLOT");
        resolvedCategory.PortionRatePercent.Should().Be(80);

        var rules = await service.GetPortionRulesAsync(new PortionRuleQueryDto
        {
            CustomerId = customerId,
            EffectiveDate = "2026-06-15",
            ShiftName = "MORNING"
        });
        rules.Should().HaveCount(2);

        Func<Task> duplicate = async () => await service.CreatePortionRuleAsync(
            new CreatePortionRuleRequest
            {
                CustomerId = customerId,
                DishId = dishId,
                EffectiveFrom = "2026-06-10",
                EffectiveTo = "2026-06-18",
                ActiveWeekDays = ["t2"],
                ShiftNames = ["MORNING"],
                SlotName = "mon_chinh",
                PortionRatePercent = 115,
                Reason = "Duplicate dish scope"
            },
            fixture.UserIdString);
        await duplicate.Should().ThrowAsync<ArgumentException>()
            .WithMessage("*trùng hiệu lực*");

        var outOfRange = await service.ResolvePortionRuleAsync(new ResolvePortionRuleRequest
        {
            CustomerId = customerId,
            ServiceDate = "2026-07-01",
            ShiftName = "MORNING",
            SlotName = "mon_chinh",
            DishId = dishId
        });
        outOfRange.Should().NotBeNull();
        outOfRange!.Source.Should().Be("DEMO_FALLBACK");
        outOfRange.Warnings.Should().ContainSingle();
    }

    [Fact]
    public async Task GenerateDemand_Should_ApplyPortionRule_AndPersistTrace()
    {
        await using var fixture = await WorkflowFixture.CreateAsync();
        await fixture.SeedMenuWithDemandAsync(includeMissingDish: false);

        string customerId;
        string portionRuleId;
        await using (var context = fixture.CreateContext())
        {
            var service = new CoordinationConfigurationTestHarness(context);
            customerId = GuidHelper.ToGuidString(await context.Customers
                .Select(item => item.CustomerId)
                .SingleAsync());
            var rule = await service.CreatePortionRuleAsync(
                new CreatePortionRuleRequest
                {
                    CustomerId = customerId,
                    DishId = GuidHelper.ToGuidString(fixture.DishWithBomId),
                    EffectiveFrom = "2026-06-01",
                    EffectiveTo = "2026-06-30",
                    ActiveWeekDays = ["t2"],
                    ShiftNames = ["MORNING"],
                    PortionRatePercent = 50,
                    BomRatePercent = 125,
                    Reason = "Half portion premium BOM"
                },
                fixture.UserIdString);
            portionRuleId = rule.PortionRuleId;
        }

        await using (var context = fixture.CreateContext())
        {
            var demand = await new MaterialDemandService(context).GenerateAsync(
                new GenerateMaterialDemandRequest { ServiceDate = "2026-06-15", CustomerId = customerId, Scope = "FULLDAY" },
                fixture.UserIdString);

            demand.Should().NotBeNull();
            var line = demand!.Lines.Single();
            line.TotalRequiredQty.Should().Be(100m);
            line.BomRatePercent.Should().Be(100m);
            line.AppliedPortionRuleId.Should().Be(portionRuleId);
            line.AppliedPortionRuleSource.Should().Be("DISH_OVERRIDE");
            line.AppliedPortionRatePercent.Should().Be(50m);

            var savedLine = await context.Materialrequestlines.AsNoTracking().SingleAsync();
            GuidHelper.ToGuidString(savedLine.AppliedPortionRuleId!).Should().Be(portionRuleId);
            savedLine.AppliedPortionRuleSource.Should().Be("DISH_OVERRIDE");
            savedLine.AppliedPortionRatePercent.Should().Be(50m);
            savedLine.BomRatePercent.Should().Be(100m);

            var reportLine = (await new DemandReportService(context).GetIngredientDemandAsync(new WorkflowReportQueryDto
            {
                CustomerId = customerId,
                DateFrom = "2026-06-15",
                DateTo = "2026-06-15"
            })).Single();
            reportLine.AppliedPortionRuleId.Should().Be(portionRuleId);
            reportLine.AppliedPortionRuleSource.Should().Be("DISH_OVERRIDE");
            reportLine.AppliedPortionRatePercent.Should().Be(50m);
            reportLine.BomRatePercent.Should().Be(100m);
        }
    }

    [Fact]
    public async Task GenerateDemand_Should_RequireSignoffBeforeUsingLockedOrder()
    {
        await using var fixture = await WorkflowFixture.CreateAsync();
        await fixture.SeedMenuWithDemandAsync(includeMissingDish: false);

        await using (var context = fixture.CreateContext())
        {
            var quantityPlan = await context.Mealquantityplans.SingleAsync();
            quantityPlan.Status = OrderStatus.Confirmed;
            await context.SaveChangesAsync();
        }

        await using (var context = fixture.CreateContext())
        {
            var service = new MaterialDemandService(context);

            var act = async () => await service.GenerateAsync(
                new GenerateMaterialDemandRequest { ServiceDate = "2026-06-15", Scope = "FULLDAY" },
                fixture.UserIdString);

            await act.Should().ThrowAsync<BusinessRuleException>()
                .WithMessage("Cần hoàn tất số suất trước khi tạo nhu cầu nguyên liệu.");
        }
    }

    [Fact]
    public async Task GenerateDemand_Should_UseSignedOffAdjustedOrderFinalServings()
    {
        await using var fixture = await WorkflowFixture.CreateAsync();
        await fixture.SeedMenuWithDemandAsync(includeMissingDish: false);

        await using (var context = fixture.CreateContext())
        {
            var quantityPlan = await context.Mealquantityplans.SingleAsync();
            var quantityLine = await context.Mealquantityplanlines.SingleAsync();
            quantityPlan.Status = OrderStatus.Completed;
            quantityLine.ConfirmedServings = 100;
            quantityLine.AdjustedServings = 20;
            quantityLine.FinalServings = 120;
            await context.SaveChangesAsync();
        }

        await using (var context = fixture.CreateContext())
        {
            var demand = await new MaterialDemandService(context).GenerateAsync(
                new GenerateMaterialDemandRequest { ServiceDate = "2026-06-15", Scope = "FULLDAY" },
                fixture.UserIdString);

            demand.Should().NotBeNull();
            demand!.Lines.Single().TotalRequiredQty.Should().Be(240m);
        }
    }

    [Fact]
    public async Task GenerateDemand_Should_CreateProductionPlanWithCustomerWeekVersionAndStatus()
    {
        await using var fixture = await WorkflowFixture.CreateAsync();
        await fixture.SeedMenuWithDemandAsync(includeMissingDish: false);

        byte[] menuVersionId;
        byte[] customerId;
        await using (var setupContext = fixture.CreateContext())
        {
            customerId = await setupContext.Customers.Select(item => item.CustomerId).SingleAsync();
            menuVersionId = GuidHelper.NewId();
            setupContext.Menuversions.Add(new MenuVersion
            {
                MenuVersionId = menuVersionId,
                CustomerId = customerId,
                WeekStartDate = new DateOnly(2026, 6, 15),
                VersionNo = 2,
                Status = "PUBLISHED",
                SourceImportBatch = "MENU-CUS-20260615-V02",
                CreatedBy = fixture.UserId,
                CreatedAt = DateTime.UtcNow.AddMinutes(-10),
                PublishedBy = fixture.UserId,
                PublishedAt = DateTime.UtcNow.AddMinutes(-5),
                UpdatedAt = DateTime.UtcNow.AddMinutes(-5)
            });
            await setupContext.SaveChangesAsync();
        }

        await using (var context = fixture.CreateContext())
        {
            var demand = await new MaterialDemandService(context).GenerateAsync(
                new GenerateMaterialDemandRequest
                {
                    ServiceDate = "2026-06-15",
                    CustomerId = GuidHelper.ToGuidString(customerId),
                    Scope = "FULLDAY"
                },
                fixture.UserIdString);

            demand.Should().NotBeNull();
            var plan = await context.Productionplans
                .Include(item => item.Customer)
                .Include(item => item.MenuVersion)
                .SingleAsync(item => item.PlanCode == "KHSX-CUS-20260615-FULLDAY");

            plan.CustomerId.Should().NotBeNull();
            plan.CustomerId!.Should().Equal(customerId);
            plan.WeekStartDate.Should().Be(new DateOnly(2026, 6, 15));
            plan.MenuVersionId.Should().NotBeNull();
            plan.MenuVersionId!.Should().Equal(menuVersionId);
            plan.Status.Should().Be("CREATED");
            plan.Customer!.CustomerCode.Should().Be("CUS");
            plan.MenuVersion!.VersionNo.Should().Be(2);
            plan.MenuVersion.Status.Should().Be("PUBLISHED");
        }
    }

    [Fact]
    public async Task SendDailyToKitchen_Should_UpdatePlansAndReturnKitchenReadyDailyPlan()
    {
        await using var fixture = await WorkflowFixture.CreateAsync();
        await fixture.SeedMenuWithDemandAsync(includeMissingDish: false);

        await using (var demandContext = fixture.CreateContext())
        {
            await new MaterialDemandService(demandContext).GenerateAsync(
                new GenerateMaterialDemandRequest
                {
                    ServiceDate = "2026-06-15",
                    CustomerId = fixture.CustomerIdString,
                    Scope = "FULLDAY"
                },
                fixture.UserIdString);

            var plan = await demandContext.Productionplans
                .Include(item => item.Productionplanlines)
                .SingleAsync(item => item.PlanCode == "KHSX-CUS-20260615-FULLDAY");
            var sourceLine = plan.Productionplanlines.Single();
            demandContext.Productionplanlines.AddRange(
                new ProductionPlanLine
                {
                    PlanLineId = GuidHelper.NewId(),
                    PlanId = sourceLine.PlanId,
                    QuantityPlanLineId = sourceLine.QuantityPlanLineId,
                    CustomerId = sourceLine.CustomerId,
                    MenuId = sourceLine.MenuId,
                    DishId = sourceLine.DishId,
                    ShiftName = "MORNING",
                    TotalServings = 100
                },
                new ProductionPlanLine
                {
                    PlanLineId = GuidHelper.NewId(),
                    PlanId = sourceLine.PlanId,
                    QuantityPlanLineId = sourceLine.QuantityPlanLineId,
                    CustomerId = sourceLine.CustomerId,
                    MenuId = sourceLine.MenuId,
                    DishId = sourceLine.DishId,
                    ShiftName = "AFTERNOON",
                    TotalServings = 150
                });
            await demandContext.SaveChangesAsync();
        }

        await using var context = fixture.CreateContext();
        var service = new ProductionPlanService(new ProductionPlanRepository(context), context);

        var daily = await service.SendDailyToKitchenAsync(new SendDailyProductionPlanRequest
        {
            ServiceDate = "2026-06-15",
            CustomerId = fixture.CustomerIdString,
            ShiftName = "MORNING",
            Reason = "UAT gửi bếp"
        }, fixture.UserIdString);

        daily.ServiceDate.Should().Be(new DateOnly(2026, 6, 15));
        daily.CustomerId.Should().Be(fixture.CustomerIdString);
        daily.CustomerCode.Should().Be("CUS");
        daily.ShiftName.Should().Be("MORNING");
        daily.TotalPlans.Should().Be(1);
        daily.SentPlans.Should().Be(1);
        daily.TotalDishes.Should().Be(2);
        daily.TotalServings.Should().Be(100);
        daily.Plans.Single().Lines.Should().OnlyContain(line => line.ShiftName == "MORNING");
        daily.Plans.Should().ContainSingle();
        daily.Plans.Single().Status.Should().Be("SENTTOKITCHEN");
        daily.Plans.Single().SentToKitchenBy.Should().Be(fixture.UserIdString);
        daily.Plans.Single().SentToKitchenByName.Should().Be("Workflow Test");
        daily.Plans.Single().SentToKitchenAt.Should().NotBeNull();
        daily.Warnings.Should().NotContain("Có kế hoạch chưa gửi bếp.");

        var savedPlan = await context.Productionplans
            .AsNoTracking()
            .SingleAsync(plan => plan.PlanCode == "KHSX-CUS-20260615-FULLDAY");
        savedPlan.Status.Should().Be("SENTTOKITCHEN");
        savedPlan.SentToKitchenBy.Should().NotBeNull();
        savedPlan.SentToKitchenBy!.Should().Equal(fixture.UserId);
        savedPlan.SentToKitchenAt.Should().NotBeNull();

        var audit = await context.Auditlogs
            .AsNoTracking()
            .SingleAsync(log => log.BusinessArea == "Kitchen" && log.FieldName == "SendToKitchen");
        audit.EntityId.Should().Equal(savedPlan.PlanId);
        audit.ChangedBy.Should().Equal(fixture.UserId);
        audit.NewValue.Should().Be("KHSX-CUS-20260615-FULLDAY");
        audit.Reason.Should().Be("UAT gửi bếp");
    }

    [Fact]
    public async Task ProductionPlans_Should_PageNewestFirst_WhenPlansSpanMultipleYears()
    {
        await using var fixture = await WorkflowFixture.CreateAsync();
        await fixture.SeedMenuWithDemandAsync(includeMissingDish: false);

        await using var context = fixture.CreateContext();
        context.Productionplans.AddRange(
            new ProductionPlan
            {
                PlanId = GuidHelper.NewId(),
                PlanCode = "KHSX-CUS-20280101-FULLDAY",
                PlanDate = new DateOnly(2028, 1, 1),
                CustomerId = fixture.CustomerId,
                Status = "CREATED",
                CreatedBy = fixture.UserId,
                CreatedAt = DateTime.UtcNow
            },
            new ProductionPlan
            {
                PlanId = GuidHelper.NewId(),
                PlanCode = "KHSX-CUS-20240101-FULLDAY",
                PlanDate = new DateOnly(2024, 1, 1),
                CustomerId = fixture.CustomerId,
                Status = "CREATED",
                CreatedBy = fixture.UserId,
                CreatedAt = DateTime.UtcNow
            });
        await context.SaveChangesAsync();

        var service = new ProductionPlanService(new ProductionPlanRepository(context), context);
        var firstPage = await service.GetPagedAsync(new PagedRequestDto { PageNumber = 1, PageSize = 2 });
        var secondPage = await service.GetPagedAsync(new PagedRequestDto { PageNumber = 2, PageSize = 2 });

        firstPage.TotalCount.Should().Be(3);
        firstPage.PageNumber.Should().Be(1);
        firstPage.PageSize.Should().Be(2);
        firstPage.HasNext.Should().BeTrue();
        firstPage.Items.Select(plan => plan.PlanCode)
            .Should().Equal("KHSX-CUS-20280101-FULLDAY", "KHSX-REPORT-SEED");

        secondPage.HasPrev.Should().BeTrue();
        secondPage.HasNext.Should().BeFalse();
        secondPage.Items.Select(plan => plan.PlanCode)
            .Should().ContainSingle().Which.Should().Be("KHSX-CUS-20240101-FULLDAY");
    }

    [Fact]
    public async Task GenerateDemand_Should_ApplyDifferentPortionRules_ByShift()
    {
        await using var fixture = await WorkflowFixture.CreateAsync();
        await fixture.SeedMenuWithDemandAsync(includeMissingDish: false);

        string customerId;
        await using (var context = fixture.CreateContext())
        {
            var schedule = await context.Menuschedules.AsNoTracking().SingleAsync();
            var quantityPlan = await context.Mealquantityplans.SingleAsync();
            context.Menuschedules.Add(new MenuSchedule
            {
                MenuScheduleId = GuidHelper.NewId(),
                CustomerId = schedule.CustomerId,
                MenuId = schedule.MenuId,
                ServiceDate = schedule.ServiceDate,
                WeekStartDate = schedule.WeekStartDate,
                ShiftName = "AFTERNOON",
                MenuPrice = schedule.MenuPrice,
                BomRatePercent = schedule.BomRatePercent,
                Status = "ACTIVE"
            });
            await context.SaveChangesAsync();

            var afternoonSchedule = await context.Menuschedules.SingleAsync(item => item.ShiftName == "AFTERNOON");
            context.Mealquantityplanlines.Add(new MealQuantityPlanLine
            {
                QuantityPlanLineId = GuidHelper.NewId(),
                QuantityPlanId = quantityPlan.QuantityPlanId,
                MenuScheduleId = afternoonSchedule.MenuScheduleId,
                CustomerId = afternoonSchedule.CustomerId,
                MenuId = afternoonSchedule.MenuId,
                ShiftName = "AFTERNOON",
                ForecastServings = 100,
                ConfirmedServings = 100,
                FinalServings = 100
            });
            await context.SaveChangesAsync();

            customerId = GuidHelper.ToGuidString(schedule.CustomerId);
            var service = new CoordinationConfigurationTestHarness(context);
            foreach (var (shiftName, rate) in new[] { ("MORNING", 50m), ("AFTERNOON", 75m) })
            {
                await service.CreatePortionRuleAsync(
                    new CreatePortionRuleRequest
                    {
                        CustomerId = customerId,
                        DishId = GuidHelper.ToGuidString(fixture.DishWithBomId),
                        EffectiveFrom = "2026-06-01",
                        EffectiveTo = "2026-06-30",
                        ActiveWeekDays = ["t2"],
                        ShiftNames = [shiftName],
                        PortionRatePercent = rate,
                        Reason = $"Shift rule {shiftName}"
                    },
                    fixture.UserIdString);
            }
        }

        await using (var context = fixture.CreateContext())
        {
            var demandService = new MaterialDemandService(context);
            var morning = await demandService.GenerateAsync(
                new GenerateMaterialDemandRequest
                {
                    ServiceDate = "2026-06-15",
                    CustomerId = customerId,
                    ShiftName = "MORNING",
                    Scope = "MORNING"
                },
                fixture.UserIdString);
            var afternoon = await demandService.GenerateAsync(
                new GenerateMaterialDemandRequest
                {
                    ServiceDate = "2026-06-15",
                    CustomerId = customerId,
                    ShiftName = "AFTERNOON",
                    Scope = "AFTERNOON"
                },
                fixture.UserIdString);

            morning!.Lines.Single().TotalRequiredQty.Should().Be(100m);
            morning.Lines.Single().AppliedPortionRatePercent.Should().Be(50m);
            afternoon!.Lines.Single().TotalRequiredQty.Should().Be(150m);
            afternoon.Lines.Single().AppliedPortionRatePercent.Should().Be(75m);
        }
    }

    [Fact]
    public async Task MenuScheduleRules_Should_UpdatePortionRate_AndDemandUsesNewRate()
    {
        await using var fixture = await WorkflowFixture.CreateAsync();
        await fixture.SeedMenuWithDemandAsync(includeMissingDish: false);

        string scheduleId;
        await using (var context = fixture.CreateContext())
        {
            scheduleId = GuidHelper.ToGuidString(await context.Menuschedules
                .Select(item => item.MenuScheduleId)
                .SingleAsync());
        }

        await using (var context = fixture.CreateContext())
        {
            var service = new CoordinationConfigurationTestHarness(context);
            var updated = await service.UpdateMenuScheduleRulesAsync(
                scheduleId,
                new UpdateMenuScheduleRulesRequest
                {
                    MenuPrice = 25000,
                    BomRatePercent = 125,
                    Reason = "Customer premium portion"
                },
                fixture.UserIdString);

            updated.Should().NotBeNull();
            updated!.MenuPrice.Should().Be(25000);
            updated.BomRatePercent.Should().Be(100);
        }

        await using (var context = fixture.CreateContext())
        {
            var demand = await new MaterialDemandService(context).GenerateAsync(
                new GenerateMaterialDemandRequest { ServiceDate = "2026-06-15", Scope = "FULLDAY" },
                fixture.UserIdString);

            var line = demand!.Lines.Single();
            line.BomRatePercent.Should().Be(100);
            line.TotalRequiredQty.Should().Be(200);
        }
    }

    [Fact]
    public async Task MenuScheduleVersion_Should_UpdateStatus_AndWriteAudit()
    {
        await using var fixture = await WorkflowFixture.CreateAsync();
        await fixture.SeedMenuWithDemandAsync(includeMissingDish: false);

        await using var context = fixture.CreateContext();
        var firstSchedule = await context.Menuschedules.SingleAsync();
        var scheduleId = GuidHelper.ToGuidString(firstSchedule.MenuScheduleId);
        context.Menuschedules.Add(new MenuSchedule
        {
            MenuScheduleId = GuidHelper.NewId(),
            CustomerId = firstSchedule.CustomerId,
            MenuId = firstSchedule.MenuId,
            ServiceDate = new DateOnly(2026, 6, 16),
            WeekStartDate = firstSchedule.WeekStartDate,
            ShiftName = "AFTERNOON",
            MenuPrice = firstSchedule.MenuPrice,
            BomRatePercent = firstSchedule.BomRatePercent,
            Status = "ACTIVE"
        });
        await context.SaveChangesAsync();
        var service = new CoordinationConfigurationTestHarness(context);

        var updated = await service.UpdateMenuScheduleVersionAsync(
            scheduleId,
            new UpdateMenuScheduleVersionRequest
            {
                Status = "SUPERSEDED",
                Reason = "Replaced by new weekly version"
            },
            fixture.UserIdString);

        updated.Should().NotBeNull();
        updated!.Status.Should().Be("SUPERSEDED");
        updated.MenuVersionId.Should().NotBeNullOrWhiteSpace();
        updated.MenuVersionNo.Should().Be(1);
        updated.MenuVersionStatus.Should().Be("SUPERSEDED");
        updated.SourceImportBatch.Should().Be("LEGACY-20260615");

        var version = await context.Menuversions.AsNoTracking().SingleAsync();
        version.Status.Should().Be("SUPERSEDED");
        var weekStatuses = await context.Menuschedules.AsNoTracking()
            .Select(item => item.Status)
            .ToListAsync();
        weekStatuses.Should().AllBeEquivalentTo("SUPERSEDED");
        var audit = await context.Auditlogs.AsNoTracking()
            .Where(item =>
                item.BusinessArea == "MenuVersion" &&
                item.EntityName == nameof(MenuSchedule) &&
                item.FieldName == nameof(MenuSchedule.Status))
            .ToListAsync();
        audit.Should().HaveCount(2);
        audit.Select(item => item.OldValue).Should().AllBeEquivalentTo("ACTIVE");
        audit.Select(item => item.NewValue).Should().AllBeEquivalentTo("SUPERSEDED");
    }

    [Fact]
    public async Task CustomerWeekMenuTierIntegrity_ApiShouldReturnDomainConflictAndPreserveSchedule()
    {
        await using var fixture = await WorkflowFixture.CreateAsync();
        await fixture.SeedMenuWithDemandAsync(includeMissingDish: false);
        await using var context = fixture.CreateContext();
        var schedule = await context.Menuschedules.SingleAsync();
        var currentUser = Substitute.For<ICurrentUserService>();
        currentUser.GetUserId(Arg.Any<ClaimsPrincipal>()).Returns(fixture.UserIdString);
        var controller = new MenuSchedulesController(
            new MenuScheduleService(context, new EfTransactionRunner(context)),
            currentUser)
        {
            ControllerContext = new ControllerContext { HttpContext = new DefaultHttpContext() }
        };

        var action = await controller.UpdateMenuScheduleRulesAsync(
            GuidHelper.ToGuidString(schedule.MenuScheduleId),
            new UpdateMenuScheduleRulesRequest { MenuPrice = 30000m });

        var response = action.Should().BeOfType<BadRequestObjectResult>().Subject.Value
            .Should().BeOfType<ApiResponse>().Subject;
        response.Message.Should().Contain("đã khóa định mức 25,000");
        response.Message.Should().Contain("rollback/xóa toàn bộ lịch DRAFT");
        (await context.Menuschedules.AsNoTracking().Select(item => item.MenuPrice).SingleAsync())
            .Should().Be(25000m);
        (await context.Customerweekmenutiers.AsNoTracking().Select(item => item.PriceTierAmount).SingleAsync())
            .Should().Be(25000m);
    }

    [Fact]
    public async Task CustomerWeekMenuTierIntegrity_RollbackLastDraftVersionShouldReleaseEmptyWeekTier()
    {
        await using var fixture = await WorkflowFixture.CreateAsync();
        await fixture.SeedMenuWithDemandAsync(includeMissingDish: false);
        await using var context = fixture.CreateContext();
        context.Mealquantityplanlines.RemoveRange(await context.Mealquantityplanlines.ToListAsync());
        context.Mealquantityplans.RemoveRange(await context.Mealquantityplans.ToListAsync());
        var schedule = await context.Menuschedules.SingleAsync();
        var version = new MenuVersion
        {
            MenuVersionId = GuidHelper.NewId(),
            CustomerId = fixture.CustomerId,
            WeekStartDate = schedule.WeekStartDate,
            VersionNo = 1,
            Status = "DRAFT",
            SourceFileName = "valid-anv.xlsx",
            SourceChecksum = "fixture-checksum",
            SourceImportBatch = "fixture-batch",
            CreatedBy = fixture.UserId,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow,
            SuccessRowCount = 1
        };
        context.Menuversions.Add(version);
        schedule.Status = "DRAFT";
        schedule.MenuVersionId = version.MenuVersionId;
        await context.SaveChangesAsync();
        var service = new WeeklyMenuImportHistoryService(
            context,
            new WeeklyMenuAuditActorResolver(context));

        var result = await service.RollbackWeeklyMenuImportAsync(
            GuidHelper.ToGuidString(version.MenuVersionId),
            fixture.UserIdString);

        result.MenuSchedulesRemoved.Should().Be(1);
        (await context.Menuschedules.AsNoTracking().CountAsync()).Should().Be(0);
        (await context.Customerweekmenutiers.AsNoTracking().CountAsync()).Should().Be(0);
        (await context.Menuversions.AsNoTracking().SingleAsync()).Status.Should().Be("ROLLED_BACK");
    }

    [Fact]
    [Trait("Category", "Performance")]
    public async Task WeeklyMenuImportHistory_ShouldBatchPageEligibilityLookups()
    {
        var queryCounter = new SelectCommandCounter();
        await using var fixture = await WorkflowFixture.CreateAsync(queryCounter);
        await fixture.SeedMenuWithDemandAsync(includeMissingDish: false);

        await using (var setupContext = fixture.CreateContext())
        {
            var schedule = await setupContext.Menuschedules.SingleAsync();
            var version = new MenuVersion
            {
                MenuVersionId = GuidHelper.NewId(),
                CustomerId = fixture.CustomerId,
                WeekStartDate = schedule.WeekStartDate,
                VersionNo = 1,
                Status = "DRAFT",
                SourceFileName = "history-fixture.xlsx",
                SourceImportBatch = "history-fixture",
                CreatedBy = fixture.UserId,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow,
                SuccessRowCount = 1
            };
            setupContext.Menuversions.Add(version);
            schedule.MenuVersionId = version.MenuVersionId;
            await setupContext.SaveChangesAsync();
        }

        queryCounter.Reset();
        await using var context = fixture.CreateContext();
        var service = new WeeklyMenuImportHistoryService(
            context,
            new WeeklyMenuAuditActorResolver(context));
        var result = await service.GetWeeklyMenuImportHistoryAsync(
            fixture.CustomerIdString,
            null,
            null,
            new PagedRequestDto { PageNumber = 1, PageSize = 10 });

        result.Items.Should().ContainSingle();
        result.Items.Single().CanRollback.Should().BeFalse();
        queryCounter.SelectCount.Should().BeLessThanOrEqualTo(4,
            "history page, schedule eligibility and quantity-link checks must be batched per page");
        queryCounter.SelectCommands.Should().Contain(command =>
            command.Contains("LIMIT", StringComparison.OrdinalIgnoreCase),
            "the history list must be bounded at the database page boundary");
    }

    [Fact]
    public async Task WeeklyMenuImportHistory_ShouldApplyInclusiveDateWindowAcrossYears()
    {
        await using var fixture = await WorkflowFixture.CreateAsync();
        await fixture.SeedMenuWithDemandAsync(includeMissingDish: false);
        await using (var setupContext = fixture.CreateContext())
        {
            setupContext.Menuversions.AddRange(
                new MenuVersion
                {
                    MenuVersionId = GuidHelper.NewId(), CustomerId = fixture.CustomerId,
                    WeekStartDate = new DateOnly(2023, 1, 2), VersionNo = 1, Status = "PUBLISHED",
                    CreatedBy = fixture.UserId, CreatedAt = new DateTime(2023, 1, 2, 8, 0, 0, DateTimeKind.Utc), UpdatedAt = new DateTime(2023, 1, 2, 8, 0, 0, DateTimeKind.Utc)
                },
                new MenuVersion
                {
                    MenuVersionId = GuidHelper.NewId(), CustomerId = fixture.CustomerId,
                    WeekStartDate = new DateOnly(2026, 6, 15), VersionNo = 2, Status = "PUBLISHED",
                    CreatedBy = fixture.UserId, CreatedAt = new DateTime(2026, 6, 15, 8, 0, 0, DateTimeKind.Utc), UpdatedAt = new DateTime(2026, 6, 15, 8, 0, 0, DateTimeKind.Utc)
                },
                new MenuVersion
                {
                    MenuVersionId = GuidHelper.NewId(), CustomerId = fixture.CustomerId,
                    WeekStartDate = new DateOnly(2030, 1, 7), VersionNo = 3, Status = "PUBLISHED",
                    CreatedBy = fixture.UserId, CreatedAt = new DateTime(2030, 1, 7, 8, 0, 0, DateTimeKind.Utc), UpdatedAt = new DateTime(2030, 1, 7, 8, 0, 0, DateTimeKind.Utc)
                });
            await setupContext.SaveChangesAsync();
        }

        await using var context = fixture.CreateContext();
        var service = new WeeklyMenuImportHistoryService(
            context,
            new WeeklyMenuAuditActorResolver(context));
        var result = await service.GetWeeklyMenuImportHistoryAsync(
            fixture.CustomerIdString,
            new DateOnly(2026, 6, 15),
            new DateOnly(2030, 1, 7),
            new PagedRequestDto { PageNumber = 1, PageSize = 10 });

        result.TotalCount.Should().Be(2);
        result.Items.Select(item => item.WeekStartDate)
            .Should().Equal(new DateOnly(2030, 1, 7), new DateOnly(2026, 6, 15));
    }

    [Fact]
    public async Task MenuScheduleEffectiveRangeAudit_Should_JoinApiWeekTransitionActorAndCorrelation()
    {
        await using var fixture = await WorkflowFixture.CreateAsync();
        await fixture.SeedMenuWithDemandAsync(includeMissingDish: false);
        await using var context = fixture.CreateContext();
        var firstSchedule = await context.Menuschedules.SingleAsync();
        context.Menuschedules.Add(new MenuSchedule
        {
            MenuScheduleId = GuidHelper.NewId(),
            CustomerId = firstSchedule.CustomerId,
            MenuId = firstSchedule.MenuId,
            ServiceDate = firstSchedule.ServiceDate.AddDays(1),
            WeekStartDate = firstSchedule.WeekStartDate,
            ShiftName = "AFTERNOON",
            MenuPrice = firstSchedule.MenuPrice,
            BomRatePercent = firstSchedule.BomRatePercent,
            Status = "ACTIVE"
        });
        await context.SaveChangesAsync();
        const string correlationId = "menu-range-20260803";
        var currentUser = Substitute.For<ICurrentUserService>();
        currentUser.GetUserId(Arg.Any<ClaimsPrincipal>()).Returns(fixture.UserIdString);
        var controller = new MenuSchedulesController(
            new MenuScheduleService(context, new EfTransactionRunner(context)),
            currentUser)
        {
            ControllerContext = new ControllerContext { HttpContext = new DefaultHttpContext() }
        };
        controller.HttpContext.TraceIdentifier = correlationId;

        var action = await controller.UpdateMenuScheduleVersionAsync(
            GuidHelper.ToGuidString(firstSchedule.MenuScheduleId),
            new UpdateMenuScheduleVersionRequest
            {
                Status = "SUPERSEDED",
                Reason = "Thay đổi version cho toàn tuần"
            });

        var response = action.Should().BeOfType<OkObjectResult>().Subject.Value
            .Should().BeOfType<ApiResponse<MenuScheduleDto>>().Subject;
        response.Data!.Status.Should().Be("SUPERSEDED");
        (await context.Menuschedules.AsNoTracking().Select(item => item.Status).ToListAsync())
            .Should().AllBeEquivalentTo("SUPERSEDED");
        var rangeAudit = await context.Auditlogs.AsNoTracking().SingleAsync(item =>
            item.EntityName == nameof(MenuVersion) && item.FieldName == "EffectiveRange");
        rangeAudit.OldValue.Should().Be("2026-06-15..2026-06-21|DRAFT");
        rangeAudit.NewValue.Should().Be("2026-06-15..2026-06-21|SUPERSEDED");
        rangeAudit.ChangedBy.Should().Equal(fixture.UserId);
        rangeAudit.CorrelationId.Should().Be(correlationId);
        var scheduleAudits = await context.Auditlogs.AsNoTracking()
            .Where(item => item.EntityName == nameof(MenuSchedule) && item.FieldName == nameof(MenuSchedule.Status))
            .ToListAsync();
        scheduleAudits.Should().HaveCount(2);
        scheduleAudits.Should().OnlyContain(item => item.CorrelationId == correlationId);
    }

    [Fact]
    public async Task MenuVersionRollback_Should_PublishPreviousVersion_AndInvalidateDemand()
    {
        await using var fixture = await WorkflowFixture.CreateAsync();
        await fixture.SeedMenuWithDemandAsync(includeMissingDish: false);

        byte[] customerId;
        byte[] versionOneId;
        byte[] versionTwoId;
        await using (var setupContext = fixture.CreateContext())
        {
            customerId = await setupContext.Customers.Select(item => item.CustomerId).SingleAsync();
            versionOneId = GuidHelper.NewId();
            versionTwoId = GuidHelper.NewId();
            setupContext.Menuversions.AddRange(
                new MenuVersion
                {
                    MenuVersionId = versionOneId,
                    CustomerId = customerId,
                    WeekStartDate = new DateOnly(2026, 6, 15),
                    VersionNo = 1,
                    Status = "SUPERSEDED",
                    SourceImportBatch = "MENU-CUS-20260615-V01",
                    CreatedBy = fixture.UserId,
                    CreatedAt = DateTime.UtcNow.AddHours(-2),
                    PublishedBy = fixture.UserId,
                    PublishedAt = DateTime.UtcNow.AddHours(-2),
                    UpdatedAt = DateTime.UtcNow.AddHours(-2)
                },
                new MenuVersion
                {
                    MenuVersionId = versionTwoId,
                    CustomerId = customerId,
                    WeekStartDate = new DateOnly(2026, 6, 15),
                    VersionNo = 2,
                    Status = "PUBLISHED",
                    SourceImportBatch = "MENU-CUS-20260615-V02",
                    CreatedBy = fixture.UserId,
                    CreatedAt = DateTime.UtcNow.AddHours(-1),
                    PublishedBy = fixture.UserId,
                    PublishedAt = DateTime.UtcNow.AddHours(-1),
                    UpdatedAt = DateTime.UtcNow.AddHours(-1)
                });
            await setupContext.SaveChangesAsync();
        }

        await using var context = fixture.CreateContext();
        var demand = await new MaterialDemandService(context).GenerateAsync(
            new GenerateMaterialDemandRequest
            {
                ServiceDate = "2026-06-15",
                CustomerId = GuidHelper.ToGuidString(customerId),
                Scope = "FULLDAY"
            },
            fixture.UserIdString);
        demand.Should().NotBeNull();
        await ApproveDemandAsync(context, demand!.MaterialRequestId);
        var purchase = await CreatePurchaseRequestWorkflowService(context).GenerateFromDemandAsync(
            new GeneratePurchaseRequestFromDemandRequest { MaterialRequestId = demand.MaterialRequestId },
            fixture.UserIdString);
        purchase.Should().NotBeNull();

        var service = new CoordinationConfigurationTestHarness(context);
        var result = await service.RollbackMenuVersionAsync(
            new RollbackMenuVersionRequest
            {
                CustomerId = GuidHelper.ToGuidString(customerId),
                WeekStartDate = "2026-06-15",
                Reason = "Excel published bị sai món chính"
            },
            fixture.UserIdString);

        result.ActiveVersionNo.Should().Be(1);
        result.RolledBackFromVersionNo.Should().Be(2);
        result.CancelledDemandCount.Should().Be(1);
        result.CancelledPurchaseCount.Should().Be(1);

        var versions = await context.Menuversions.AsNoTracking().ToListAsync();
        versions.Single(item => item.MenuVersionId.SequenceEqual(versionOneId)).Status.Should().Be("PUBLISHED");
        versions.Single(item => item.MenuVersionId.SequenceEqual(versionTwoId)).Status.Should().Be("SUPERSEDED");
        (await context.Materialrequests.AsNoTracking().Select(item => item.Status).SingleAsync()).Should().Be("CANCELLED");
        (await context.Purchaserequests.AsNoTracking().Select(item => item.Status).SingleAsync()).Should().Be("CANCELLED");

        var audits = await context.Auditlogs.AsNoTracking()
            .Where(item => item.Reason != null && item.Reason.Contains("Excel published bị sai món chính"))
            .Select(item => new { item.BusinessArea, item.FieldName })
            .ToListAsync();
        audits.Should().Contain(item => item.BusinessArea == "MenuVersion" && item.FieldName == "Rollback");
        audits.Should().Contain(item => item.BusinessArea == "Demand" && item.FieldName == nameof(MaterialRequest.Status));
        audits.Should().Contain(item => item.BusinessArea == "Purchase" && item.FieldName == nameof(PurchaseRequest.Status));
    }

}
