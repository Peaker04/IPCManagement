using FluentAssertions;
using IPCManagement.Api.Data;
using IPCManagement.Api.Helpers;
using IPCManagement.Api.Models.DTOs.Coordination;
using IPCManagement.Api.Models.DTOs.Supplier;
using IPCManagement.Api.Models.DTOs.Workflow;
using IPCManagement.Api.Models.Entities;
using IPCManagement.Api.Services;
using IPCManagement.Api.Services.SampleData;
using IPCManagement.Api.Services.Workflow;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using System.Reflection;

namespace IPCManagement.Api.Tests;

public class WorkflowGenerationTests
{
    [Fact]
    public async Task GenerateDemand_Should_ReportMissingBom_And_WriteDemandAudit()
    {
        await using var fixture = await WorkflowFixture.CreateAsync();
        await fixture.SeedMenuWithDemandAsync(includeMissingDish: true);

        await using var context = fixture.CreateContext();
        var service = new MaterialDemandService(context);

        var result = await service.GenerateAsync(
            new GenerateMaterialDemandRequestDto { ServiceDate = "2026-06-15", Scope = "FULLDAY" },
            fixture.UserIdString);

        result.Should().NotBeNull();
        result!.Lines.Should().ContainSingle();
        result.MissingBomDishes.Should().ContainSingle(item => item.DishCode == "DISH-MISSING");

        var audit = await context.Auditlogs.AsNoTracking().SingleAsync(item => item.BusinessArea == "Demand");
        audit.NewValue.Should().Contain("1 demand lines");
        audit.NewValue.Should().Contain("1 missing BOM dishes");
    }

    [Fact]
    public async Task GenerateDemand_Should_Ignore_Draft_BomLines()
    {
        await using var fixture = await WorkflowFixture.CreateAsync();
        await fixture.SeedMenuWithDemandAsync(includeMissingDish: false);

        await using (var setupContext = fixture.CreateContext())
        {
            var bom = await setupContext.Dishboms.SingleAsync();
            bom.BomStatus = "DRAFT";
            await setupContext.SaveChangesAsync();
        }

        await using var context = fixture.CreateContext();
        var service = new MaterialDemandService(context);

        var result = await service.GenerateAsync(
            new GenerateMaterialDemandRequestDto { ServiceDate = "2026-06-15", Scope = "FULLDAY" },
            fixture.UserIdString);

        result.Should().NotBeNull();
        result!.Lines.Should().BeEmpty();
        result.MissingBomDishes.Should().ContainSingle(item => item.DishCode == "DISH-BOM");
    }

    [Fact]
    public async Task GenerateDemand_Should_PruneStaleDemandAndProductionLines_OnRegenerate()
    {
        await using var fixture = await WorkflowFixture.CreateAsync();
        await fixture.SeedMenuWithDemandAsync(includeMissingDish: true);

        await using (var context = fixture.CreateContext())
        {
            var service = new MaterialDemandService(context);
            await service.GenerateAsync(
                new GenerateMaterialDemandRequestDto { ServiceDate = "2026-06-15", Scope = "FULLDAY" },
                fixture.UserIdString);
        }

        await using (var context = fixture.CreateContext())
        {
            var menuItem = await context.Menuitems.SingleAsync(item => item.DishId == fixture.DishWithBomId);
            context.Menuitems.Remove(menuItem);
            await context.SaveChangesAsync();
        }

        await using (var context = fixture.CreateContext())
        {
            var service = new MaterialDemandService(context);
            var result = await service.GenerateAsync(
                new GenerateMaterialDemandRequestDto { ServiceDate = "2026-06-15", Scope = "FULLDAY" },
                fixture.UserIdString);

            result.Should().NotBeNull();
            result!.Lines.Should().BeEmpty();
            result.MissingBomDishes.Should().ContainSingle();
            var demandLineCount = await context.Materialrequestlines.AsNoTracking().CountAsync();
            var productionLineCount = await context.Productionplanlines.AsNoTracking().CountAsync();
            demandLineCount.Should().Be(0);
            productionLineCount.Should().Be(1);
        }
    }

    [Fact]
    public async Task GeneratePurchaseRequest_Should_LeaveSupplierUnassigned_WhenNoQuotationOrReceiptHistoryExists()
    {
        await using var fixture = await WorkflowFixture.CreateAsync();
        await fixture.SeedMenuWithDemandAsync(includeMissingDish: false);

        await using var context = fixture.CreateContext();
        var demandService = new MaterialDemandService(context);
        var demand = await demandService.GenerateAsync(
            new GenerateMaterialDemandRequestDto { ServiceDate = "2026-06-15", Scope = "FULLDAY" },
            fixture.UserIdString);

        var purchaseService = new PurchaseRequestWorkflowService(context, new SupplierQuotationService(context));
        var purchase = await purchaseService.GenerateFromDemandAsync(
            new GeneratePurchaseRequestFromDemandDto { MaterialRequestId = demand!.MaterialRequestId },
            fixture.UserIdString);

        // No supplier quotation and no inventory receipt history exist for this ingredient in the fixture,
        // so the line must be left without a supplier rather than silently defaulting to an unrelated one.
        purchase!.Lines.Should().ContainSingle();
        purchase.Lines[0].SupplierId.Should().BeNull();
        purchase.Lines[0].SupplierName.Should().BeNull();

        var persistedLine = await context.Purchaserequestlines.AsNoTracking().SingleAsync();
        persistedLine.SupplierId.Should().BeNull();
    }

    [Fact]
    public async Task GeneratePurchaseRequest_Should_RemoveStalePurchaseLines_WhenDemandNoLongerShort()
    {
        await using var fixture = await WorkflowFixture.CreateAsync();
        await fixture.SeedMenuWithDemandAsync(includeMissingDish: false);

        string materialRequestId;
        await using (var context = fixture.CreateContext())
        {
            var demandService = new MaterialDemandService(context);
            var demand = await demandService.GenerateAsync(
                new GenerateMaterialDemandRequestDto { ServiceDate = "2026-06-15", Scope = "FULLDAY" },
                fixture.UserIdString);
            materialRequestId = demand!.MaterialRequestId;

            var purchaseService = new PurchaseRequestWorkflowService(context, new SupplierQuotationService(context));
            var purchase = await purchaseService.GenerateFromDemandAsync(
                new GeneratePurchaseRequestFromDemandDto { MaterialRequestId = materialRequestId },
                fixture.UserIdString);
            purchase!.Lines.Should().ContainSingle();
        }

        await using (var context = fixture.CreateContext())
        {
            var requestLine = await context.Materialrequestlines.SingleAsync();
            requestLine.CurrentStockQty = requestLine.TotalRequiredQty;
            requestLine.SuggestedPurchaseQty = 0;
            await context.SaveChangesAsync();
        }

        await using (var context = fixture.CreateContext())
        {
            var purchaseService = new PurchaseRequestWorkflowService(context, new SupplierQuotationService(context));
            var purchase = await purchaseService.GenerateFromDemandAsync(
                new GeneratePurchaseRequestFromDemandDto { MaterialRequestId = materialRequestId },
                fixture.UserIdString);

            purchase.Should().NotBeNull();
            purchase!.Lines.Should().BeEmpty();
            var purchaseLineCount = await context.Purchaserequestlines.AsNoTracking().CountAsync();
            purchaseLineCount.Should().Be(0);
            var latestAudit = await context.Auditlogs.AsNoTracking()
                .Where(item => item.BusinessArea == "Purchasing")
                .OrderByDescending(item => item.ChangedAt)
                .FirstAsync();
            latestAudit.NewValue.Should().Be("0 shortage lines; 0 purchase lines");
        }
    }

    [Fact]
    public async Task GenerateDemand_Should_ConvertCurrentStock_ToBomUnit()
    {
        await using var fixture = await WorkflowFixture.CreateAsync();
        await fixture.SeedMenuWithDemandAsync(includeMissingDish: false);

        await using (var context = fixture.CreateContext())
        {
            var gramUnitId = GuidHelper.NewId();
            context.Units.Add(new Unit
            {
                UnitId = gramUnitId,
                UnitCode = "G",
                UnitName = "gram",
                BaseUnitCode = "KG",
                ConvertRateToBase = 0.001m
            });
            context.Currentstocks.Add(new Currentstock
            {
                WarehouseId = fixture.WarehouseId,
                IngredientId = fixture.IngredientId,
                UnitId = gramUnitId,
                CurrentQty = 150000m,
                LastUpdated = DateTime.UtcNow,
                RowVersion = [1]
            });
            await context.SaveChangesAsync();
        }

        await using (var context = fixture.CreateContext())
        {
            var service = new MaterialDemandService(context);
            var result = await service.GenerateAsync(
                new GenerateMaterialDemandRequestDto { ServiceDate = "2026-06-15", Scope = "FULLDAY" },
                fixture.UserIdString);

            result.Should().NotBeNull();
            var line = result!.Lines.Single();
            line.TotalRequiredQty.Should().Be(200m);
            line.CurrentStockQty.Should().Be(150m);
            line.SuggestedPurchaseQty.Should().Be(50m);
        }
    }

    [Fact]
    public async Task AuditReport_Should_IncludeImportApprovalReceiptIssueAndSignoffRows()
    {
        await using var fixture = await WorkflowFixture.CreateAsync();
        await fixture.SeedMenuWithDemandAsync(includeMissingDish: false);

        await using (var context = fixture.CreateContext())
        {
            var materialRequest = await SeedReportDocumentsAsync(context, fixture);
            context.Auditlogs.Add(new Auditlog
            {
                AuditId = GuidHelper.NewId(),
                ChangedAt = DateTime.UtcNow.AddMinutes(-1),
                ChangedBy = fixture.UserId,
                BusinessArea = "Coordination",
                EntityName = nameof(Mealquantityplan),
                EntityId = fixture.QuantityPlanId,
                FieldName = nameof(Mealquantityplan.Status),
                OldValue = "CONFIRMED",
                NewValue = "COMPLETED",
                Reason = "Hoàn tất ca điều phối"
            });
            await context.SaveChangesAsync();

            var service = new WorkflowReportService(context);
            var rows = await service.GetAuditChangesAsync(new WorkflowReportQueryDto { Limit = 20 });
            var areas = rows.Select(item => item.BusinessArea).ToList();

            areas.Should().Contain(["Import", "Approval", "Receipt", "Issue", "Signoff"]);
            rows.Single(item => item.BusinessArea == "Issue").OldValue.Should().Be(GuidHelper.ToGuidString(materialRequest.RequestId));
        }
    }

    [Fact]
    public async Task DataQualityReport_Should_GroupMissingBomInvalidUnitNegativeStockAndOrphans()
    {
        await using var fixture = await WorkflowFixture.CreateAsync();
        await fixture.SeedMenuWithDemandAsync(includeMissingDish: true);

        await using var context = fixture.CreateContext();
        var badUnitId = GuidHelper.NewId();
        var badIngredientId = GuidHelper.NewId();
        var orphanRequestId = GuidHelper.NewId();
        var orphanPurchaseRequestId = GuidHelper.NewId();
        var orphanIssueId = GuidHelper.NewId();

        context.Units.Add(new Unit
        {
            UnitId = badUnitId,
            UnitCode = "",
            UnitName = "Invalid unit",
            ConvertRateToBase = 1
        });
        context.Ingredients.Add(new Ingredient
        {
            IngredientId = badIngredientId,
            IngredientCode = "ING-BAD-UNIT",
            IngredientName = "Ingredient bad unit",
            UnitId = badUnitId,
            WarehouseId = fixture.WarehouseId,
            ReferencePrice = 1000,
            IsFreshDaily = false,
            IsActive = true
        });
        context.Currentstocks.Add(new Currentstock
        {
            WarehouseId = fixture.WarehouseId,
            IngredientId = fixture.IngredientId,
            UnitId = fixture.UnitId,
            CurrentQty = -2,
            LastUpdated = DateTime.UtcNow
        });
        context.Materialrequests.Add(new Materialrequest
        {
            RequestId = orphanRequestId,
            RequestCode = "MR-ORPHAN",
            PlanId = GuidHelper.NewId(),
            RequestDate = new DateOnly(2026, 6, 15),
            RequestScope = "FULLDAY",
            Status = "DRAFT",
            CreatedBy = fixture.UserId
        });
        context.Purchaserequests.Add(new Purchaserequest
        {
            PurchaseRequestId = orphanPurchaseRequestId,
            PurchaseRequestCode = "PR-ORPHAN",
            RequestDate = new DateOnly(2026, 6, 15),
            PurchaseForDate = new DateOnly(2026, 6, 15),
            Status = "DRAFT",
            CreatedBy = fixture.UserId
        });
        context.Purchaserequestlines.Add(new Purchaserequestline
        {
            PurchaseRequestLineId = GuidHelper.NewId(),
            PurchaseRequestId = orphanPurchaseRequestId,
            MaterialRequestLineId = GuidHelper.NewId(),
            IngredientId = fixture.IngredientId,
            SupplierId = fixture.SupplierId,
            UnitId = fixture.UnitId,
            RequiredQty = 2,
            CurrentStockQty = 0,
            PurchaseQty = 2,
            EstimatedUnitPrice = 1000
        });
        context.Inventoryissues.Add(new Inventoryissue
        {
            IssueId = orphanIssueId,
            IssueCode = "ISS-ORPHAN",
            IssueDate = new DateOnly(2026, 6, 15),
            WarehouseId = fixture.WarehouseId,
            MaterialRequestId = GuidHelper.NewId(),
            IssuedBy = fixture.UserId,
            CreatedAt = DateTime.UtcNow
        });
        await context.SaveChangesAsync();

        var service = new WorkflowReportService(context);
        var report = await service.GetDataQualityAsync(new WorkflowReportQueryDto { Limit = 20 });

        report.TotalIssues.Should().BeGreaterThanOrEqualTo(5);
        report.ErrorCount.Should().BeGreaterThanOrEqualTo(3);
        report.WarningCount.Should().BeGreaterThanOrEqualTo(3);
        report.MissingBomCount.Should().BeGreaterThanOrEqualTo(1);
        report.InvalidUnitCount.Should().BeGreaterThanOrEqualTo(1);
        report.NegativeStockCount.Should().Be(1);
        report.OrphanDocumentCount.Should().BeGreaterThanOrEqualTo(3);
        report.Issues.Select(issue => issue.Category).Should().Contain([
            "missing_bom",
            "invalid_unit",
            "negative_stock",
            "orphan_document"
        ]);
    }

    [Fact]
    public async Task CustomerContract_Should_UpdateCustomerContract_AndWriteAudit()
    {
        await using var fixture = await WorkflowFixture.CreateAsync();
        await fixture.SeedMenuWithDemandAsync(includeMissingDish: false);

        await using var context = fixture.CreateContext();
        var service = new CoordinationService(context, new MaterialDemandService(context));

        var contracts = await service.GetCustomerContractsAsync();
        var contract = contracts.Should().ContainSingle().Subject;
        contract.ActiveWeekDays.Should().Contain("t2");
        contract.ShiftNames.Should().Contain("MORNING");

        var updated = await service.UpdateCustomerContractAsync(
            contract.CustomerId,
            new UpdateCustomerContractDto
            {
                Note = "No beef on Monday",
                IsActive = false,
                EffectiveFrom = "2026-06-15",
                ActiveWeekDays = ["t2"],
                ShiftNames = ["MORNING"],
                DefaultMenuPrice = 43000,
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
        updated.DefaultMenuPrice.Should().Be(43000);
        updated.DefaultBomRatePercent.Should().Be(135);

        var contractRow = await context.Customercontracts.AsNoTracking().SingleAsync();
        contractRow.DefaultMenuPrice.Should().Be(43000);
        contractRow.DefaultBomRatePercent.Should().Be(135);
        contractRow.ActiveWeekDays.Should().Be("t2");
        contractRow.ShiftNames.Should().Be("MORNING");

        var schedule = await context.Menuschedules.AsNoTracking().SingleAsync();
        schedule.MenuPrice.Should().Be(43000);
        schedule.BomRatePercent.Should().Be(135);

        var audits = await context.Auditlogs.AsNoTracking()
            .Where(item => item.BusinessArea == "CustomerContract")
            .ToListAsync();
        audits.Should().HaveCountGreaterThanOrEqualTo(5);
        audits.Select(item => item.FieldName).Should().Contain([
            nameof(Customer.Note),
            nameof(Customer.IsActive),
            "ContractCreated",
            nameof(Menuschedule.MenuPrice),
            nameof(Menuschedule.BomRatePercent)
        ]);
    }

    [Fact]
    public async Task CustomerContract_Should_CreateCustomerAndContract_AndBlockDuplicateCode()
    {
        await using var fixture = await WorkflowFixture.CreateAsync();

        await using var context = fixture.CreateContext();
        var service = new CoordinationService(context, new MaterialDemandService(context));

        var created = await service.CreateCustomerContractAsync(
            new CreateCustomerContractDto
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
        created.DefaultBomRatePercent.Should().Be(120);

        (await context.Customers.AsNoTracking().CountAsync()).Should().Be(1);
        (await context.Customercontracts.AsNoTracking().CountAsync()).Should().Be(1);
        var audits = await context.Auditlogs.AsNoTracking()
            .Where(item => item.BusinessArea == "CustomerContract")
            .Select(item => item.FieldName)
            .ToListAsync();
        audits.Should().Contain(["CustomerCreated", "ContractCreated"]);

        Func<Task> duplicate = async () => await service.CreateCustomerContractAsync(
            new CreateCustomerContractDto
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
            var service = new CoordinationService(context, new MaterialDemandService(context));
            var contract = (await service.GetCustomerContractsAsync()).Should().ContainSingle().Subject;
            customerId = contract.CustomerId;
            await service.UpdateCustomerContractAsync(
                customerId,
                new UpdateCustomerContractDto
                {
                    EffectiveFrom = "2026-06-15",
                    ActiveWeekDays = ["t2"],
                    ShiftNames = ["MORNING"],
                    DefaultMenuPrice = 43000,
                    DefaultBomRatePercent = 120
                },
                fixture.UserIdString);
        }

        await using (var context = fixture.CreateContext())
        {
            context.Customercontracts.Add(new Customercontract
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
            var service = new CoordinationService(context, new MaterialDemandService(context));
            Func<Task> act = async () => await service.UpdateCustomerContractAsync(
                customerId,
                new UpdateCustomerContractDto
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
        var service = new CoordinationService(context, new MaterialDemandService(context));
        var customerId = GuidHelper.ToGuidString(await context.Customers
            .Select(item => item.CustomerId)
            .SingleAsync());
        var dishId = GuidHelper.ToGuidString(fixture.DishWithBomId);

        var categoryRule = await service.CreatePortionRuleAsync(
            new CreatePortionRuleDto
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
            new CreatePortionRuleDto
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

        var resolvedDish = await service.ResolvePortionRuleAsync(new ResolvePortionRuleDto
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
        resolvedDish.BomRatePercent.Should().Be(110);

        var resolvedCategory = await service.ResolvePortionRuleAsync(new ResolvePortionRuleDto
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
            new CreatePortionRuleDto
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

        var outOfRange = await service.ResolvePortionRuleAsync(new ResolvePortionRuleDto
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
            var service = new CoordinationService(context, new MaterialDemandService(context));
            customerId = GuidHelper.ToGuidString(await context.Customers
                .Select(item => item.CustomerId)
                .SingleAsync());
            var rule = await service.CreatePortionRuleAsync(
                new CreatePortionRuleDto
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
                new GenerateMaterialDemandRequestDto { ServiceDate = "2026-06-15", CustomerId = customerId, Scope = "FULLDAY" },
                fixture.UserIdString);

            demand.Should().NotBeNull();
            var line = demand!.Lines.Single();
            line.TotalRequiredQty.Should().Be(125m);
            line.BomRatePercent.Should().Be(125m);
            line.AppliedPortionRuleId.Should().Be(portionRuleId);
            line.AppliedPortionRuleSource.Should().Be("DISH_OVERRIDE");
            line.AppliedPortionRatePercent.Should().Be(50m);

            var savedLine = await context.Materialrequestlines.AsNoTracking().SingleAsync();
            GuidHelper.ToGuidString(savedLine.AppliedPortionRuleId!).Should().Be(portionRuleId);
            savedLine.AppliedPortionRuleSource.Should().Be("DISH_OVERRIDE");
            savedLine.AppliedPortionRatePercent.Should().Be(50m);
            savedLine.BomRatePercent.Should().Be(125m);

            var reportLine = (await new WorkflowReportService(context).GetIngredientDemandAsync(new WorkflowReportQueryDto
            {
                CustomerId = customerId,
                DateFrom = "2026-06-15",
                DateTo = "2026-06-15"
            })).Single();
            reportLine.AppliedPortionRuleId.Should().Be(portionRuleId);
            reportLine.AppliedPortionRuleSource.Should().Be("DISH_OVERRIDE");
            reportLine.AppliedPortionRatePercent.Should().Be(50m);
            reportLine.BomRatePercent.Should().Be(125m);
        }
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
            context.Menuschedules.Add(new Menuschedule
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
            context.Mealquantityplanlines.Add(new Mealquantityplanline
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
            var service = new CoordinationService(context, new MaterialDemandService(context));
            foreach (var (shiftName, rate) in new[] { ("MORNING", 50m), ("AFTERNOON", 75m) })
            {
                await service.CreatePortionRuleAsync(
                    new CreatePortionRuleDto
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
                new GenerateMaterialDemandRequestDto
                {
                    ServiceDate = "2026-06-15",
                    CustomerId = customerId,
                    ShiftName = "MORNING",
                    Scope = "MORNING"
                },
                fixture.UserIdString);
            var afternoon = await demandService.GenerateAsync(
                new GenerateMaterialDemandRequestDto
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
            var service = new CoordinationService(context, new MaterialDemandService(context));
            var updated = await service.UpdateMenuScheduleRulesAsync(
                scheduleId,
                new UpdateMenuScheduleRulesDto
                {
                    MenuPrice = 42000,
                    BomRatePercent = 125,
                    Reason = "Customer premium portion"
                },
                fixture.UserIdString);

            updated.Should().NotBeNull();
            updated!.MenuPrice.Should().Be(42000);
            updated.BomRatePercent.Should().Be(125);
        }

        await using (var context = fixture.CreateContext())
        {
            var demand = await new MaterialDemandService(context).GenerateAsync(
                new GenerateMaterialDemandRequestDto { ServiceDate = "2026-06-15", Scope = "FULLDAY" },
                fixture.UserIdString);

            var line = demand!.Lines.Single();
            line.BomRatePercent.Should().Be(125);
            line.TotalRequiredQty.Should().Be(250);
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
        context.Menuschedules.Add(new Menuschedule
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
        var service = new CoordinationService(context, new MaterialDemandService(context));

        var updated = await service.UpdateMenuScheduleVersionAsync(
            scheduleId,
            new UpdateMenuScheduleVersionDto
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
                item.EntityName == nameof(Menuschedule) &&
                item.FieldName == nameof(Menuschedule.Status))
            .ToListAsync();
        audit.Should().HaveCount(2);
        audit.Select(item => item.OldValue).Should().AllBeEquivalentTo("ACTIVE");
        audit.Select(item => item.NewValue).Should().AllBeEquivalentTo("SUPERSEDED");
    }

    [Fact]
    public async Task WeeklyMenuReimport_Should_CancelDownstreamDemandAndPurchase_ForCustomerWeek()
    {
        await using var fixture = await WorkflowFixture.CreateAsync();
        await fixture.SeedMenuWithDemandAsync(includeMissingDish: false);

        await using var context = fixture.CreateContext();
        var demand = await new MaterialDemandService(context).GenerateAsync(
            new GenerateMaterialDemandRequestDto { ServiceDate = "2026-06-15", Scope = "FULLDAY" },
            fixture.UserIdString);
        demand.Should().NotBeNull();
        var purchase = await new PurchaseRequestWorkflowService(context, new SupplierQuotationService(context)).GenerateFromDemandAsync(
            new GeneratePurchaseRequestFromDemandDto { MaterialRequestId = demand!.MaterialRequestId },
            fixture.UserIdString);
        purchase.Should().NotBeNull();

        var customer = await context.Customers.SingleAsync();
        var version = new Menuversion
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

        var service = new SampleDataImportService(context, null!);
        var method = typeof(SampleDataImportService).GetMethod(
            "InvalidateWorkflowDocumentsForMenuReimportAsync",
            BindingFlags.NonPublic | BindingFlags.Instance);
        method.Should().NotBeNull();

        var task = (Task<int>)method!.Invoke(service, [
            customer,
            new DateOnly(2026, 6, 15),
            new DateOnly(2026, 6, 20),
            version,
            CancellationToken.None
        ])!;
        var invalidated = await task;
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

    private static async Task<Materialrequest> SeedReportDocumentsAsync(IpcManagementContext context, WorkflowFixture fixture)
    {
        var materialRequest = new Materialrequest
        {
            RequestId = GuidHelper.NewId(),
            RequestCode = "MR-20260615-FULLDAY",
            PlanId = fixture.ProductionPlanId,
            RequestDate = new DateOnly(2026, 6, 15),
            RequestScope = "FULLDAY",
            Status = "DRAFT",
            CreatedBy = fixture.UserId
        };

        context.Materialrequests.Add(materialRequest);
        context.Quantityimportbatches.Add(new Quantityimportbatch
        {
            ImportBatchId = GuidHelper.NewId(),
            BatchCode = "IMP-DEMO",
            SourceCompanyName = "Demo customer",
            SourceType = "EXCEL",
            ImportedBy = fixture.UserId,
            ImportedAt = DateTime.UtcNow.AddMinutes(-20),
            Status = "COMMITTED"
        });
        context.Approvalhistories.Add(new Approvalhistory
        {
            ApprovalHistoryId = GuidHelper.NewId(),
            TargetType = nameof(Materialrequest),
            TargetId = materialRequest.RequestId,
            Decision = "APPROVE",
            OldStatus = "DRAFT",
            NewStatus = "MANAGERAPPROVED",
            Reason = "Demo approval",
            ActionBy = fixture.UserId,
            ActionAt = DateTime.UtcNow.AddMinutes(-15)
        });
        context.Inventoryreceipts.Add(new Inventoryreceipt
        {
            ReceiptId = fixture.ReceiptId,
            ReceiptCode = "NK-DEMO",
            ReceiptDate = new DateOnly(2026, 6, 15),
            WarehouseId = fixture.WarehouseId,
            SupplierId = fixture.SupplierId,
            CreatedBy = fixture.UserId,
            CreatedAt = DateTime.UtcNow.AddMinutes(-10),
            Inventoryreceiptlines =
            [
                new Inventoryreceiptline
                {
                    ReceiptLineId = GuidHelper.NewId(),
                    IngredientId = fixture.IngredientId,
                    UnitId = fixture.UnitId,
                    Quantity = 10,
                    UnitPrice = 1000,
                    Amount = 10000
                }
            ]
        });
        context.Inventoryissues.Add(new Inventoryissue
        {
            IssueId = fixture.IssueId,
            IssueCode = "PX-DEMO",
            IssueDate = new DateOnly(2026, 6, 15),
            ShiftName = "MORNING",
            WarehouseId = fixture.WarehouseId,
            MaterialRequestId = materialRequest.RequestId,
            IssuedBy = fixture.UserId,
            CreatedAt = DateTime.UtcNow.AddMinutes(-5),
            Inventoryissuelines =
            [
                new Inventoryissueline
                {
                    IssueLineId = GuidHelper.NewId(),
                    IngredientId = fixture.IngredientId,
                    UnitId = fixture.UnitId,
                    RequestedQty = 4,
                    IssuedQty = 4
                }
            ]
        });

        await context.SaveChangesAsync();
        return materialRequest;
    }

    [Fact]
    public async Task CreateSupplierQuotation_Should_RejectOverlappingEffectivePeriod_ForSameSupplierAndIngredient()
    {
        await using var fixture = await WorkflowFixture.CreateAsync();
        await using var context = fixture.CreateContext();
        await SeedSupplierAndIngredientAsync(context, fixture, fixture.SupplierId, "Nhà cung cấp Demo");

        var service = new SupplierQuotationService(context);
        await service.CreateAsync(new CreateSupplierQuotationDto
        {
            SupplierId = GuidHelper.ToGuidString(fixture.SupplierId),
            IngredientId = GuidHelper.ToGuidString(fixture.IngredientId),
            UnitPrice = 10000,
            EffectiveFrom = "2026-01-01",
            EffectiveTo = "2026-06-30"
        });

        var act = () => service.CreateAsync(new CreateSupplierQuotationDto
        {
            SupplierId = GuidHelper.ToGuidString(fixture.SupplierId),
            IngredientId = GuidHelper.ToGuidString(fixture.IngredientId),
            UnitPrice = 12000,
            EffectiveFrom = "2026-05-01",
            EffectiveTo = null
        });

        await act.Should().ThrowAsync<ArgumentException>();
    }

    [Fact]
    public async Task GetBestPriceEntityAsync_Should_TieBreak_ByEffectiveFromThenSupplierName_WhenPricesEqual()
    {
        await using var fixture = await WorkflowFixture.CreateAsync();
        await using var context = fixture.CreateContext();

        var supplierEarlyZ = GuidHelper.NewId();
        var supplierLateA = GuidHelper.NewId();
        var supplierLateB = GuidHelper.NewId();
        await SeedSupplierAndIngredientAsync(context, fixture, supplierEarlyZ, "Nhà cung cấp Z (báo giá cũ hơn)");
        await SeedSupplierAsync(context, supplierLateA, "Nhà cung cấp A (mới, cùng giá)");
        await SeedSupplierAsync(context, supplierLateB, "Nhà cung cấp B (mới, cùng giá)");

        var service = new SupplierQuotationService(context);
        await service.CreateAsync(new CreateSupplierQuotationDto
        {
            SupplierId = GuidHelper.ToGuidString(supplierEarlyZ),
            IngredientId = GuidHelper.ToGuidString(fixture.IngredientId),
            UnitPrice = 10000,
            EffectiveFrom = "2026-01-01",
            EffectiveTo = null
        });
        await service.CreateAsync(new CreateSupplierQuotationDto
        {
            SupplierId = GuidHelper.ToGuidString(supplierLateB),
            IngredientId = GuidHelper.ToGuidString(fixture.IngredientId),
            UnitPrice = 10000,
            EffectiveFrom = "2026-06-01",
            EffectiveTo = null
        });
        await service.CreateAsync(new CreateSupplierQuotationDto
        {
            SupplierId = GuidHelper.ToGuidString(supplierLateA),
            IngredientId = GuidHelper.ToGuidString(fixture.IngredientId),
            UnitPrice = 10000,
            EffectiveFrom = "2026-06-01",
            EffectiveTo = null
        });

        var best = await service.GetBestPriceEntityAsync(fixture.IngredientId, new DateOnly(2026, 7, 1));

        // Cùng giá 10000: 2 báo giá "2026-06-01" (A, B) mới hơn báo giá "2026-01-01" (Z) nên thắng theo EffectiveFrom desc;
        // giữa A và B cùng ngày hiệu lực thì A thắng theo thứ tự tên A-Z.
        best.Should().NotBeNull();
        best!.SupplierId.Should().BeEquivalentTo(supplierLateA);
    }

    private static async Task SeedSupplierAndIngredientAsync(
        IpcManagementContext context,
        WorkflowFixture fixture,
        byte[] supplierId,
        string supplierName)
    {
        context.Units.Add(new Unit
        {
            UnitId = fixture.UnitId,
            UnitCode = "KG",
            UnitName = "Kilogram",
            ConvertRateToBase = 1
        });
        context.Warehouses.Add(new Warehouse
        {
            WarehouseId = fixture.WarehouseId,
            WarehouseCode = "WH-DEMO",
            WarehouseName = "Kho demo",
            WarehouseType = "DRY"
        });
        context.Ingredients.Add(new Ingredient
        {
            IngredientId = fixture.IngredientId,
            IngredientCode = "ING-DEMO",
            IngredientName = "Nguyên liệu demo",
            UnitId = fixture.UnitId,
            WarehouseId = fixture.WarehouseId,
            ReferencePrice = 9000,
            IsFreshDaily = false,
            IsActive = true
        });
        context.Suppliers.Add(new Supplier
        {
            SupplierId = supplierId,
            SupplierCode = $"SUP-{GuidHelper.ToGuidString(supplierId)[..8]}",
            SupplierName = supplierName,
            IsActive = true
        });
        await context.SaveChangesAsync();
    }

    private static async Task SeedSupplierAsync(IpcManagementContext context, byte[] supplierId, string supplierName)
    {
        context.Suppliers.Add(new Supplier
        {
            SupplierId = supplierId,
            SupplierCode = $"SUP-{GuidHelper.ToGuidString(supplierId)[..8]}",
            SupplierName = supplierName,
            IsActive = true
        });
        await context.SaveChangesAsync();
    }

    private static async Task<byte[]> SeedApprovedPurchaseRequestWithTwoSuppliersAsync(
        IpcManagementContext context,
        WorkflowFixture fixture,
        byte[] supplierA,
        byte[] supplierB)
    {
        await SeedSupplierAndIngredientAsync(context, fixture, supplierA, "NCC A");
        await SeedSupplierAsync(context, supplierB, "NCC B");

        var purchaseRequestId = GuidHelper.NewId();
        context.Purchaserequests.Add(new Purchaserequest
        {
            PurchaseRequestId = purchaseRequestId,
            PurchaseRequestCode = $"PR-DEMO-{GuidHelper.ToGuidString(purchaseRequestId)[..8]}",
            RequestDate = new DateOnly(2026, 6, 1),
            PurchaseForDate = new DateOnly(2026, 6, 2),
            Status = "APPROVED",
            CreatedBy = fixture.UserId,
            Purchaserequestlines =
            [
                new Purchaserequestline
                {
                    PurchaseRequestLineId = GuidHelper.NewId(),
                    PurchaseRequestId = purchaseRequestId,
                    MaterialRequestLineId = GuidHelper.NewId(),
                    IngredientId = fixture.IngredientId,
                    SupplierId = supplierA,
                    UnitId = fixture.UnitId,
                    RequiredQty = 10,
                    CurrentStockQty = 0,
                    PurchaseQty = 10,
                    EstimatedUnitPrice = 1000
                },
                new Purchaserequestline
                {
                    PurchaseRequestLineId = GuidHelper.NewId(),
                    PurchaseRequestId = purchaseRequestId,
                    MaterialRequestLineId = GuidHelper.NewId(),
                    IngredientId = fixture.IngredientId,
                    SupplierId = supplierB,
                    UnitId = fixture.UnitId,
                    RequiredQty = 5,
                    CurrentStockQty = 0,
                    PurchaseQty = 5,
                    EstimatedUnitPrice = 2000
                }
            ]
        });
        await context.SaveChangesAsync();

        return purchaseRequestId;
    }

    [Fact]
    public async Task CreatePurchaseOrders_Should_SplitBySupplier_WhenPurchaseRequestHasMultipleSuppliers()
    {
        await using var fixture = await WorkflowFixture.CreateAsync();
        await using var context = fixture.CreateContext();
        var supplierA = GuidHelper.NewId();
        var supplierB = GuidHelper.NewId();
        var purchaseRequestId = await SeedApprovedPurchaseRequestWithTwoSuppliersAsync(context, fixture, supplierA, supplierB);

        var service = new PurchaseOrderService(context);
        var orders = await service.CreateFromApprovedRequestAsync(GuidHelper.ToGuidString(purchaseRequestId), fixture.UserIdString);

        orders.Should().HaveCount(2);
        orders.Should().OnlyContain(order => order.Lines.Count == 1);
        orders.Should().Contain(order => order.SupplierId == GuidHelper.ToGuidString(supplierA) && order.Lines[0].OrderedQty == 10);
        orders.Should().Contain(order => order.SupplierId == GuidHelper.ToGuidString(supplierB) && order.Lines[0].OrderedQty == 5);
        orders.Should().OnlyContain(order => order.Status == "ORDERED");
    }

    [Fact]
    public async Task CreatePurchaseOrders_Should_Throw_WhenPurchaseRequestNotApproved()
    {
        await using var fixture = await WorkflowFixture.CreateAsync();
        await using var context = fixture.CreateContext();
        var supplierA = GuidHelper.NewId();
        var supplierB = GuidHelper.NewId();
        var purchaseRequestId = await SeedApprovedPurchaseRequestWithTwoSuppliersAsync(context, fixture, supplierA, supplierB);
        var purchaseRequest = await context.Purchaserequests.FirstAsync(pr => pr.PurchaseRequestId == purchaseRequestId);
        purchaseRequest.Status = "DRAFT";
        await context.SaveChangesAsync();

        var service = new PurchaseOrderService(context);
        var act = () => service.CreateFromApprovedRequestAsync(GuidHelper.ToGuidString(purchaseRequestId), fixture.UserIdString);

        await act.Should().ThrowAsync<InvalidOperationException>();
    }

    [Fact]
    public async Task CreatePurchaseOrders_Should_Throw_WhenCalledAgainAfterAllLinesConverted()
    {
        await using var fixture = await WorkflowFixture.CreateAsync();
        await using var context = fixture.CreateContext();
        var supplierA = GuidHelper.NewId();
        var supplierB = GuidHelper.NewId();
        var purchaseRequestId = await SeedApprovedPurchaseRequestWithTwoSuppliersAsync(context, fixture, supplierA, supplierB);

        var service = new PurchaseOrderService(context);
        await service.CreateFromApprovedRequestAsync(GuidHelper.ToGuidString(purchaseRequestId), fixture.UserIdString);

        var act = () => service.CreateFromApprovedRequestAsync(GuidHelper.ToGuidString(purchaseRequestId), fixture.UserIdString);

        await act.Should().ThrowAsync<InvalidOperationException>();
    }

    [Fact]
    public async Task RecordReceipt_Should_TransitionStatus_FromOrderedToPartialToReceived()
    {
        await using var fixture = await WorkflowFixture.CreateAsync();
        await using var context = fixture.CreateContext();
        var supplierA = GuidHelper.NewId();
        var supplierB = GuidHelper.NewId();
        var purchaseRequestId = await SeedApprovedPurchaseRequestWithTwoSuppliersAsync(context, fixture, supplierA, supplierB);

        var service = new PurchaseOrderService(context);
        var orders = await service.CreateFromApprovedRequestAsync(GuidHelper.ToGuidString(purchaseRequestId), fixture.UserIdString);
        var orderForSupplierA = orders.First(order => order.SupplierId == GuidHelper.ToGuidString(supplierA));
        var lineId = orderForSupplierA.Lines[0].PurchaseOrderLineId;

        var afterPartial = await service.RecordReceiptAsync(orderForSupplierA.PurchaseOrderId, new RecordPurchaseOrderReceiptDto
        {
            Lines = [new RecordPurchaseOrderReceiptLineDto { PurchaseOrderLineId = lineId, ReceivedQty = 4 }]
        });
        afterPartial.Status.Should().Be("PARTIALLY_RECEIVED");
        afterPartial.Lines[0].ReceivedQty.Should().Be(4);

        var afterFull = await service.RecordReceiptAsync(orderForSupplierA.PurchaseOrderId, new RecordPurchaseOrderReceiptDto
        {
            Lines = [new RecordPurchaseOrderReceiptLineDto { PurchaseOrderLineId = lineId, ReceivedQty = 6 }]
        });
        afterFull.Status.Should().Be("RECEIVED");
        afterFull.Lines[0].ReceivedQty.Should().Be(10);
    }

    [Fact]
    public async Task RecordReceipt_Should_Throw_WhenExceedingOrderedQty()
    {
        await using var fixture = await WorkflowFixture.CreateAsync();
        await using var context = fixture.CreateContext();
        var supplierA = GuidHelper.NewId();
        var supplierB = GuidHelper.NewId();
        var purchaseRequestId = await SeedApprovedPurchaseRequestWithTwoSuppliersAsync(context, fixture, supplierA, supplierB);

        var service = new PurchaseOrderService(context);
        var orders = await service.CreateFromApprovedRequestAsync(GuidHelper.ToGuidString(purchaseRequestId), fixture.UserIdString);
        var orderForSupplierA = orders.First(order => order.SupplierId == GuidHelper.ToGuidString(supplierA));
        var lineId = orderForSupplierA.Lines[0].PurchaseOrderLineId;

        var act = () => service.RecordReceiptAsync(orderForSupplierA.PurchaseOrderId, new RecordPurchaseOrderReceiptDto
        {
            Lines = [new RecordPurchaseOrderReceiptLineDto { PurchaseOrderLineId = lineId, ReceivedQty = 11 }]
        });

        await act.Should().ThrowAsync<InvalidOperationException>();
    }

    [Fact]
    public async Task Cancel_Should_Throw_WhenAnyLineAlreadyReceived()
    {
        await using var fixture = await WorkflowFixture.CreateAsync();
        await using var context = fixture.CreateContext();
        var supplierA = GuidHelper.NewId();
        var supplierB = GuidHelper.NewId();
        var purchaseRequestId = await SeedApprovedPurchaseRequestWithTwoSuppliersAsync(context, fixture, supplierA, supplierB);

        var service = new PurchaseOrderService(context);
        var orders = await service.CreateFromApprovedRequestAsync(GuidHelper.ToGuidString(purchaseRequestId), fixture.UserIdString);
        var orderForSupplierA = orders.First(order => order.SupplierId == GuidHelper.ToGuidString(supplierA));
        var lineId = orderForSupplierA.Lines[0].PurchaseOrderLineId;

        await service.RecordReceiptAsync(orderForSupplierA.PurchaseOrderId, new RecordPurchaseOrderReceiptDto
        {
            Lines = [new RecordPurchaseOrderReceiptLineDto { PurchaseOrderLineId = lineId, ReceivedQty = 2 }]
        });

        var act = () => service.CancelAsync(orderForSupplierA.PurchaseOrderId);

        await act.Should().ThrowAsync<InvalidOperationException>();
    }

    [Fact]
    public async Task GetPriceVarianceByDishGroupAsync_Should_WeightByBomQuantity_NotSimpleAverage()
    {
        await using var fixture = await WorkflowFixture.CreateAsync();
        await using var context = fixture.CreateContext();

        var supplierId = GuidHelper.NewId();
        var ingredientAId = GuidHelper.NewId();
        var ingredientBId = GuidHelper.NewId();
        var dishId = GuidHelper.NewId();

        context.Units.Add(new Unit { UnitId = fixture.UnitId, UnitCode = "KG", UnitName = "Kilogram", ConvertRateToBase = 1 });
        context.Warehouses.Add(new Warehouse { WarehouseId = fixture.WarehouseId, WarehouseCode = "WH-DEMO", WarehouseName = "Kho demo", WarehouseType = "DRY" });
        context.Suppliers.Add(new Supplier { SupplierId = supplierId, SupplierCode = "SUP-DEMO", SupplierName = "NCC Demo", IsActive = true });
        // Ingredient A: reference 100, avg receipt price 150 -> variance 50%
        context.Ingredients.Add(new Ingredient { IngredientId = ingredientAId, IngredientCode = "ING-A", IngredientName = "Nguyên liệu A", UnitId = fixture.UnitId, WarehouseId = fixture.WarehouseId, ReferencePrice = 100, IsFreshDaily = false, IsActive = true });
        // Ingredient B: reference 100, avg receipt price 110 -> variance 10%
        context.Ingredients.Add(new Ingredient { IngredientId = ingredientBId, IngredientCode = "ING-B", IngredientName = "Nguyên liệu B", UnitId = fixture.UnitId, WarehouseId = fixture.WarehouseId, ReferencePrice = 100, IsFreshDaily = false, IsActive = true });
        context.Dishes.Add(new Dish { DishId = dishId, DishCode = "DISH-DEMO", DishName = "Món demo", DishGroup = "Món chính", IsActive = true });
        // A dùng ít (weight 1), B dùng nhiều (weight 9) trong cùng món -> trung bình có trọng số phải lệch về phía B
        context.Dishboms.Add(new Dishbom { BomId = GuidHelper.NewId(), DishId = dishId, IngredientId = ingredientAId, UnitId = fixture.UnitId, GrossQtyPerServing = 1, WasteRatePercent = 0, EffectiveFrom = new DateOnly(2026, 1, 1) });
        context.Dishboms.Add(new Dishbom { BomId = GuidHelper.NewId(), DishId = dishId, IngredientId = ingredientBId, UnitId = fixture.UnitId, GrossQtyPerServing = 9, WasteRatePercent = 0, EffectiveFrom = new DateOnly(2026, 1, 1) });

        var receiptId = GuidHelper.NewId();
        context.Inventoryreceipts.Add(new Inventoryreceipt
        {
            ReceiptId = receiptId,
            ReceiptCode = "PN-DEMO",
            ReceiptDate = new DateOnly(2026, 6, 1),
            WarehouseId = fixture.WarehouseId,
            SupplierId = supplierId,
            CreatedBy = fixture.UserId,
            CreatedAt = DateTime.UtcNow,
            Inventoryreceiptlines =
            [
                new Inventoryreceiptline { ReceiptLineId = GuidHelper.NewId(), IngredientId = ingredientAId, UnitId = fixture.UnitId, Quantity = 10, UnitPrice = 150 },
                new Inventoryreceiptline { ReceiptLineId = GuidHelper.NewId(), IngredientId = ingredientBId, UnitId = fixture.UnitId, Quantity = 10, UnitPrice = 110 }
            ]
        });

        await context.SaveChangesAsync();

        var service = new WorkflowReportService(context);
        var result = await service.GetPriceVarianceByDishGroupAsync(new WorkflowReportQueryDto());

        var group = result.Should().ContainSingle(g => g.DishGroup == "Món chính").Subject;
        group.IngredientCount.Should().Be(2);
        // Trọng số theo BOM: (1*50 + 9*10) / (1+9) = 14, khác hẳn trung bình cộng đơn giản (50+10)/2 = 30
        group.WeightedAvgVariancePercent.Should().Be(14);
    }

    [Fact]
    public async Task GetOperationalKpisAsync_Should_ExcludeOverduePurchaseRequest_WhenAlreadyFullyReceivedViaPurchaseOrder()
    {
        await using var fixture = await WorkflowFixture.CreateAsync();
        await using var context = fixture.CreateContext();
        var supplierId = GuidHelper.NewId();
        await SeedSupplierAndIngredientAsync(context, fixture, supplierId, "NCC KPI");

        var yesterday = DateOnly.FromDateTime(DateTime.UtcNow).AddDays(-1);

        // PR 1: quá hạn (PurchaseForDate đã qua) và ĐÃ nhận đủ hàng qua PO -> không tính là quá hạn nữa
        var resolvedPrId = GuidHelper.NewId();
        var resolvedLineId = GuidHelper.NewId();
        context.Purchaserequests.Add(new Purchaserequest
        {
            PurchaseRequestId = resolvedPrId,
            PurchaseRequestCode = $"PR-RESOLVED-{GuidHelper.ToGuidString(resolvedPrId)[..8]}",
            RequestDate = yesterday,
            PurchaseForDate = yesterday,
            Status = "APPROVED",
            CreatedBy = fixture.UserId,
            Purchaserequestlines =
            [
                new Purchaserequestline
                {
                    PurchaseRequestLineId = resolvedLineId,
                    PurchaseRequestId = resolvedPrId,
                    MaterialRequestLineId = GuidHelper.NewId(),
                    IngredientId = fixture.IngredientId,
                    SupplierId = supplierId,
                    UnitId = fixture.UnitId,
                    RequiredQty = 5,
                    CurrentStockQty = 0,
                    PurchaseQty = 5,
                    EstimatedUnitPrice = 1000
                }
            ]
        });
        context.Purchaseorders.Add(new Purchaseorder
        {
            PurchaseOrderId = GuidHelper.NewId(),
            PurchaseOrderCode = "PO-RESOLVED",
            PurchaseRequestId = resolvedPrId,
            SupplierId = supplierId,
            OrderDate = yesterday,
            Status = "RECEIVED",
            CreatedBy = fixture.UserId,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow,
            Purchaseorderlines =
            [
                new Purchaseorderline { PurchaseOrderLineId = GuidHelper.NewId(), PurchaseRequestLineId = resolvedLineId, IngredientId = fixture.IngredientId, UnitId = fixture.UnitId, OrderedQty = 5, ReceivedQty = 5, UnitPrice = 1000 }
            ]
        });

        // PR 2: quá hạn và CHƯA từng tạo PO -> vẫn tính là quá hạn
        var unresolvedPrId = GuidHelper.NewId();
        context.Purchaserequests.Add(new Purchaserequest
        {
            PurchaseRequestId = unresolvedPrId,
            PurchaseRequestCode = $"PR-UNRESOLVED-{GuidHelper.ToGuidString(unresolvedPrId)[..8]}",
            RequestDate = yesterday,
            PurchaseForDate = yesterday,
            Status = "APPROVED",
            CreatedBy = fixture.UserId,
            Purchaserequestlines =
            [
                new Purchaserequestline
                {
                    PurchaseRequestLineId = GuidHelper.NewId(),
                    PurchaseRequestId = unresolvedPrId,
                    MaterialRequestLineId = GuidHelper.NewId(),
                    IngredientId = fixture.IngredientId,
                    SupplierId = supplierId,
                    UnitId = fixture.UnitId,
                    RequiredQty = 3,
                    CurrentStockQty = 0,
                    PurchaseQty = 3,
                    EstimatedUnitPrice = 1000
                }
            ]
        });

        await context.SaveChangesAsync();

        var service = new WorkflowReportService(context);
        var kpis = await service.GetOperationalKpisAsync();

        kpis.OverduePurchaseRequestCount.Should().Be(1);
    }

    [Fact]
    public async Task GetOperationalKpisAsync_Should_CountLateReceipt_OnlyBeyondThreeDayThreshold()
    {
        await using var fixture = await WorkflowFixture.CreateAsync();
        await using var context = fixture.CreateContext();
        var supplierId = GuidHelper.NewId();
        await SeedSupplierAndIngredientAsync(context, fixture, supplierId, "NCC KPI 2");
        var prId = GuidHelper.NewId();
        context.Purchaserequests.Add(new Purchaserequest
        {
            PurchaseRequestId = prId,
            PurchaseRequestCode = $"PR-LATE-{GuidHelper.ToGuidString(prId)[..8]}",
            RequestDate = DateOnly.FromDateTime(DateTime.UtcNow),
            PurchaseForDate = DateOnly.FromDateTime(DateTime.UtcNow),
            Status = "APPROVED",
            CreatedBy = fixture.UserId
        });

        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        // Đặt hàng 4 ngày trước (vượt ngưỡng 3 ngày) -> trễ
        context.Purchaseorders.Add(new Purchaseorder
        {
            PurchaseOrderId = GuidHelper.NewId(),
            PurchaseOrderCode = "PO-LATE",
            PurchaseRequestId = prId,
            SupplierId = supplierId,
            OrderDate = today.AddDays(-4),
            Status = "ORDERED",
            CreatedBy = fixture.UserId,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        });
        // Đặt hàng 1 ngày trước (chưa tới ngưỡng) -> chưa trễ
        context.Purchaseorders.Add(new Purchaseorder
        {
            PurchaseOrderId = GuidHelper.NewId(),
            PurchaseOrderCode = "PO-NOT-LATE",
            PurchaseRequestId = prId,
            SupplierId = supplierId,
            OrderDate = today.AddDays(-1),
            Status = "ORDERED",
            CreatedBy = fixture.UserId,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        });

        await context.SaveChangesAsync();

        var service = new WorkflowReportService(context);
        var kpis = await service.GetOperationalKpisAsync();

        kpis.LateReceiptCount.Should().Be(1);
    }

    [Fact]
    public async Task GetOperationalKpisAsync_Should_CountLowStock_UsingAverageDailyDemandOverLast7Days()
    {
        await using var fixture = await WorkflowFixture.CreateAsync();
        await using var context = fixture.CreateContext();
        context.Units.Add(new Unit { UnitId = fixture.UnitId, UnitCode = "KG", UnitName = "Kilogram", ConvertRateToBase = 1 });
        context.Warehouses.Add(new Warehouse { WarehouseId = fixture.WarehouseId, WarehouseCode = "WH-KPI", WarehouseName = "Kho KPI", WarehouseType = "DRY" });

        var lowStockIngredientId = GuidHelper.NewId();
        var healthyStockIngredientId = GuidHelper.NewId();
        context.Ingredients.Add(new Ingredient { IngredientId = lowStockIngredientId, IngredientCode = "ING-LOW", IngredientName = "NL tồn thấp", UnitId = fixture.UnitId, WarehouseId = fixture.WarehouseId, ReferencePrice = 100, IsFreshDaily = false, IsActive = true });
        context.Ingredients.Add(new Ingredient { IngredientId = healthyStockIngredientId, IngredientCode = "ING-OK", IngredientName = "NL tồn ổn", UnitId = fixture.UnitId, WarehouseId = fixture.WarehouseId, ReferencePrice = 100, IsFreshDaily = false, IsActive = true });

        // Nhu cầu trung bình 7 ngày: 70 / 7 = 10 mỗi ngày cho mỗi nguyên liệu
        var planId = GuidHelper.NewId();
        var requestId = GuidHelper.NewId();
        context.Materialrequests.Add(new Materialrequest
        {
            RequestId = requestId,
            RequestCode = "MR-KPI",
            PlanId = planId,
            RequestDate = DateOnly.FromDateTime(DateTime.UtcNow).AddDays(-1),
            RequestScope = "FULLDAY",
            Status = "CONFIRMED",
            CreatedBy = fixture.UserId,
            Materialrequestlines =
            [
                new Materialrequestline { RequestLineId = GuidHelper.NewId(), RequestId = requestId, PlanLineId = GuidHelper.NewId(), IngredientId = lowStockIngredientId, UnitId = fixture.UnitId, TotalServings = 100, GrossQtyPerServing = 1, BomRatePercent = 100, TotalRequiredQty = 70, CurrentStockQty = 0, SuggestedPurchaseQty = 0 },
                new Materialrequestline { RequestLineId = GuidHelper.NewId(), RequestId = requestId, PlanLineId = GuidHelper.NewId(), IngredientId = healthyStockIngredientId, UnitId = fixture.UnitId, TotalServings = 100, GrossQtyPerServing = 1, BomRatePercent = 100, TotalRequiredQty = 70, CurrentStockQty = 0, SuggestedPurchaseQty = 0 }
            ]
        });

        // Tồn kho hiện tại: NL tồn thấp chỉ còn 5 (< 10/ngày) -> tồn thấp; NL tồn ổn còn 50 (>= 10/ngày) -> không tính
        context.Currentstocks.Add(new Currentstock { WarehouseId = fixture.WarehouseId, IngredientId = lowStockIngredientId, UnitId = fixture.UnitId, CurrentQty = 5, LastUpdated = DateTime.UtcNow });
        context.Currentstocks.Add(new Currentstock { WarehouseId = fixture.WarehouseId, IngredientId = healthyStockIngredientId, UnitId = fixture.UnitId, CurrentQty = 50, LastUpdated = DateTime.UtcNow });

        await context.SaveChangesAsync();

        var service = new WorkflowReportService(context);
        var kpis = await service.GetOperationalKpisAsync();

        kpis.LowStockCount.Should().Be(1);
    }

    [Fact]
    public async Task GetOperationalKpisAsync_Should_CountShortageExcludingCancelled_AndPendingKitchenConfirmation()
    {
        await using var fixture = await WorkflowFixture.CreateAsync();
        await using var context = fixture.CreateContext();
        context.Units.Add(new Unit { UnitId = fixture.UnitId, UnitCode = "KG", UnitName = "Kilogram", ConvertRateToBase = 1 });
        context.Warehouses.Add(new Warehouse { WarehouseId = fixture.WarehouseId, WarehouseCode = "WH-KPI2", WarehouseName = "Kho KPI 2", WarehouseType = "DRY" });
        context.Ingredients.Add(new Ingredient { IngredientId = fixture.IngredientId, IngredientCode = "ING-SHORT", IngredientName = "NL thiếu", UnitId = fixture.UnitId, WarehouseId = fixture.WarehouseId, ReferencePrice = 100, IsFreshDaily = false, IsActive = true });

        var activeRequestId = GuidHelper.NewId();
        context.Materialrequests.Add(new Materialrequest
        {
            RequestId = activeRequestId,
            RequestCode = "MR-ACTIVE",
            PlanId = GuidHelper.NewId(),
            RequestDate = DateOnly.FromDateTime(DateTime.UtcNow),
            RequestScope = "FULLDAY",
            Status = "CONFIRMED",
            CreatedBy = fixture.UserId,
            Materialrequestlines =
            [
                new Materialrequestline { RequestLineId = GuidHelper.NewId(), RequestId = activeRequestId, PlanLineId = GuidHelper.NewId(), IngredientId = fixture.IngredientId, UnitId = fixture.UnitId, TotalServings = 10, GrossQtyPerServing = 1, BomRatePercent = 100, TotalRequiredQty = 10, CurrentStockQty = 0, SuggestedPurchaseQty = 10 }
            ]
        });

        var cancelledRequestId = GuidHelper.NewId();
        context.Materialrequests.Add(new Materialrequest
        {
            RequestId = cancelledRequestId,
            RequestCode = "MR-CANCELLED",
            PlanId = GuidHelper.NewId(),
            RequestDate = DateOnly.FromDateTime(DateTime.UtcNow),
            RequestScope = "FULLDAY",
            Status = "CANCELLED",
            CreatedBy = fixture.UserId,
            Materialrequestlines =
            [
                new Materialrequestline { RequestLineId = GuidHelper.NewId(), RequestId = cancelledRequestId, PlanLineId = GuidHelper.NewId(), IngredientId = fixture.IngredientId, UnitId = fixture.UnitId, TotalServings = 10, GrossQtyPerServing = 1, BomRatePercent = 100, TotalRequiredQty = 10, CurrentStockQty = 0, SuggestedPurchaseQty = 10 }
            ]
        });

        context.Inventoryissues.Add(new Inventoryissue
        {
            IssueId = GuidHelper.NewId(),
            IssueCode = "IX-PENDING",
            IssueDate = DateOnly.FromDateTime(DateTime.UtcNow),
            WarehouseId = fixture.WarehouseId,
            MaterialRequestId = activeRequestId,
            IssuedBy = fixture.UserId,
            ReceivedBy = null,
            CreatedAt = DateTime.UtcNow
        });
        context.Inventoryissues.Add(new Inventoryissue
        {
            IssueId = GuidHelper.NewId(),
            IssueCode = "IX-CONFIRMED",
            IssueDate = DateOnly.FromDateTime(DateTime.UtcNow),
            WarehouseId = fixture.WarehouseId,
            MaterialRequestId = activeRequestId,
            IssuedBy = fixture.UserId,
            ReceivedBy = fixture.UserId,
            CreatedAt = DateTime.UtcNow
        });

        await context.SaveChangesAsync();

        var service = new WorkflowReportService(context);
        var kpis = await service.GetOperationalKpisAsync();

        kpis.ShortageCount.Should().Be(1);
        kpis.PendingKitchenConfirmationCount.Should().Be(1);
    }

    private sealed class WorkflowFixture : IAsyncDisposable
    {
        private readonly SqliteConnection _connection;
        private readonly DbContextOptions<IpcManagementContext> _options;

        private WorkflowFixture(SqliteConnection connection, DbContextOptions<IpcManagementContext> options)
        {
            _connection = connection;
            _options = options;
        }

        public byte[] UserId { get; } = GuidHelper.NewId();
        public string UserIdString => GuidHelper.ToGuidString(UserId);
        public byte[] UnitId { get; } = GuidHelper.NewId();
        public byte[] WarehouseId { get; } = GuidHelper.NewId();
        public byte[] IngredientId { get; } = GuidHelper.NewId();
        public byte[] SupplierId { get; } = GuidHelper.NewId();
        public byte[] QuantityPlanId { get; } = GuidHelper.NewId();
        public byte[] ProductionPlanId { get; } = GuidHelper.NewId();
        public byte[] DishWithBomId { get; } = GuidHelper.NewId();
        public byte[] ReceiptId { get; } = GuidHelper.NewId();
        public byte[] IssueId { get; } = GuidHelper.NewId();

        public static async Task<WorkflowFixture> CreateAsync()
        {
            var connection = new SqliteConnection("Data Source=:memory:");
            await connection.OpenAsync();
            var options = new DbContextOptionsBuilder<IpcManagementContext>()
                .UseSqlite(connection)
                .Options;

            await CreateMinimalWorkflowSchemaAsync(connection);

            return new WorkflowFixture(connection, options);
        }

        public IpcManagementContext CreateContext() => new(_options);

        public async Task SeedMenuWithDemandAsync(bool includeMissingDish)
        {
            await using var context = CreateContext();

            var roleId = GuidHelper.NewId();
            var customerId = GuidHelper.NewId();
            var menuId = GuidHelper.NewId();
            var scheduleId = GuidHelper.NewId();
            var quantityLineId = GuidHelper.NewId();
            var dishMissingBomId = GuidHelper.NewId();

            var role = new Role { RoleId = roleId, RoleCode = "ADMIN", RoleName = "Admin" };
            var user = new User
            {
                UserId = UserId,
                Username = "workflow-test",
                FullName = "Workflow Test",
                PasswordHash = "hash",
                RoleId = roleId,
                IsActive = true,
                CreatedAt = DateTime.UtcNow
            };
            var unit = new Unit
            {
                UnitId = UnitId,
                UnitCode = "KG",
                UnitName = "kg",
                ConvertRateToBase = 1
            };
            var warehouse = new Warehouse
            {
                WarehouseId = WarehouseId,
                WarehouseCode = "WH",
                WarehouseName = "Main",
                WarehouseType = "MAIN"
            };
            var ingredient = new Ingredient
            {
                IngredientId = IngredientId,
                IngredientCode = "ING",
                IngredientName = "Ingredient",
                UnitId = UnitId,
                WarehouseId = WarehouseId,
                ReferencePrice = 1000,
                IsFreshDaily = true,
                IsActive = true
            };
            var supplier = new Supplier
            {
                SupplierId = SupplierId,
                SupplierCode = "SUP",
                SupplierName = "Supplier",
                IsActive = true
            };
            var customer = new Customer
            {
                CustomerId = customerId,
                CustomerCode = "CUS",
                CustomerName = "Customer",
                IsActive = true
            };
            var menu = new Menu
            {
                MenuId = menuId,
                MenuCode = "MENU",
                MenuName = "Menu",
                IsActive = true
            };
            var dishWithBom = new Dish
            {
                DishId = DishWithBomId,
                DishCode = "DISH-BOM",
                DishName = "Dish with BOM",
                IsActive = true
            };
            var dishMissingBom = new Dish
            {
                DishId = dishMissingBomId,
                DishCode = "DISH-MISSING",
                DishName = "Dish missing BOM",
                IsActive = true
            };

            context.Roles.Add(role);
            context.Users.Add(user);
            context.Units.Add(unit);
            context.Warehouses.Add(warehouse);
            context.Ingredients.Add(ingredient);
            context.Suppliers.Add(supplier);
            context.Customers.Add(customer);
            context.Menus.Add(menu);
            context.Dishes.AddRange(dishWithBom, dishMissingBom);
            context.Menuitems.Add(new Menuitem
            {
                MenuItemId = GuidHelper.NewId(),
                MenuId = menuId,
                DishId = DishWithBomId,
                DisplayOrder = 1
            });
            if (includeMissingDish)
            {
                context.Menuitems.Add(new Menuitem
                {
                    MenuItemId = GuidHelper.NewId(),
                    MenuId = menuId,
                    DishId = dishMissingBomId,
                    DisplayOrder = 2
                });
            }

            context.Dishboms.Add(new Dishbom
            {
                BomId = GuidHelper.NewId(),
                DishId = DishWithBomId,
                IngredientId = IngredientId,
                UnitId = UnitId,
                GrossQtyPerServing = 2,
                WasteRatePercent = 0,
                BomStatus = "PUBLISHED",
                EffectiveFrom = new DateOnly(2026, 1, 1)
            });
            context.Menuschedules.Add(new Menuschedule
            {
                MenuScheduleId = scheduleId,
                CustomerId = customerId,
                MenuId = menuId,
                ServiceDate = new DateOnly(2026, 6, 15),
                WeekStartDate = new DateOnly(2026, 6, 15),
                ShiftName = "MORNING",
                MenuPrice = 50000,
                BomRatePercent = 100,
                Status = "ACTIVE"
            });
            context.Mealquantityplans.Add(new Mealquantityplan
            {
                QuantityPlanId = QuantityPlanId,
                PlanCode = "QTY-20260615",
                ServiceDate = new DateOnly(2026, 6, 15),
                Status = "CONFIRMED",
                ForecastReceivedAt = DateTime.UtcNow.AddHours(-3),
                ConfirmedAt = DateTime.UtcNow.AddHours(-2),
                ConfirmationTime = new TimeOnly(9, 0),
                ConfirmedBy = UserId
            });
            context.Mealquantityplanlines.Add(new Mealquantityplanline
            {
                QuantityPlanLineId = quantityLineId,
                QuantityPlanId = QuantityPlanId,
                MenuScheduleId = scheduleId,
                CustomerId = customerId,
                MenuId = menuId,
                ShiftName = "MORNING",
                ForecastServings = 100,
                ConfirmedServings = 100,
                FinalServings = 100
            });
            context.Productionplans.Add(new Productionplan
            {
                PlanId = ProductionPlanId,
                PlanCode = "KHSX-REPORT-SEED",
                PlanDate = new DateOnly(2026, 6, 15),
                Status = "CREATED",
                CreatedBy = UserId,
                CreatedAt = DateTime.UtcNow
            });

            await context.SaveChangesAsync();
        }

        public async ValueTask DisposeAsync()
        {
            await _connection.DisposeAsync();
        }

        private static async Task CreateMinimalWorkflowSchemaAsync(SqliteConnection connection)
        {
            var command = connection.CreateCommand();
            command.CommandText = """
                CREATE TABLE roles (
                    roleId BLOB PRIMARY KEY,
                    roleCode TEXT NOT NULL,
                    roleName TEXT NOT NULL
                );
                CREATE TABLE users (
                    userId BLOB PRIMARY KEY,
                    username TEXT NOT NULL,
                    passwordHash TEXT NOT NULL,
                    fullName TEXT NOT NULL,
                    roleId BLOB NOT NULL,
                    isActive INTEGER NOT NULL,
                    createdAt TEXT NOT NULL
                );
                CREATE TABLE units (
                    unitId BLOB PRIMARY KEY,
                    unitCode TEXT NOT NULL,
                    unitName TEXT NOT NULL,
                    baseUnitCode TEXT NULL,
                    convertRateToBase TEXT NOT NULL
                );
                CREATE TABLE warehouses (
                    warehouseId BLOB PRIMARY KEY,
                    warehouseCode TEXT NOT NULL,
                    warehouseName TEXT NOT NULL,
                    warehouseType TEXT NOT NULL,
                    note TEXT NULL
                );
                CREATE TABLE ingredients (
                    ingredientId BLOB PRIMARY KEY,
                    ingredientCode TEXT NOT NULL,
                    ingredientName TEXT NOT NULL,
                    unitId BLOB NOT NULL,
                    warehouseId BLOB NOT NULL,
                    referencePrice TEXT NOT NULL,
                    isFreshDaily INTEGER NOT NULL,
                    isActive INTEGER NOT NULL
                );
                CREATE TABLE suppliers (
                    supplierId BLOB PRIMARY KEY,
                    supplierCode TEXT NOT NULL,
                    supplierName TEXT NOT NULL,
                    debtPolicy TEXT NULL,
                    invoicePolicy TEXT NULL,
                    contactName TEXT NULL,
                    phone TEXT NULL,
                    address TEXT NULL,
                    isActive INTEGER NOT NULL
                );
                CREATE TABLE customers (
                    customerId BLOB PRIMARY KEY,
                    customerCode TEXT NOT NULL,
                    customerName TEXT NOT NULL,
                    note TEXT NULL,
                    isActive INTEGER NOT NULL
                );
                CREATE TABLE supplierquotations (
                    quotationId BLOB PRIMARY KEY,
                    supplierId BLOB NOT NULL,
                    ingredientId BLOB NOT NULL,
                    unitPrice TEXT NOT NULL,
                    effectiveFrom TEXT NOT NULL,
                    effectiveTo TEXT NULL,
                    note TEXT NULL,
                    isActive INTEGER NOT NULL,
                    createdAt TEXT NOT NULL,
                    updatedAt TEXT NOT NULL
                );
                CREATE TABLE customercontracts (
                    contractId BLOB PRIMARY KEY,
                    customerId BLOB NOT NULL,
                    effectiveFrom TEXT NOT NULL,
                    effectiveTo TEXT NULL,
                    activeWeekDays TEXT NOT NULL,
                    shiftNames TEXT NOT NULL,
                    defaultMenuPrice TEXT NOT NULL,
                    defaultBomRatePercent TEXT NOT NULL,
                    status TEXT NOT NULL,
                    createdAt TEXT NOT NULL,
                    updatedAt TEXT NOT NULL
                );
                CREATE TABLE portionrules (
                    portionRuleId BLOB PRIMARY KEY,
                    customerId BLOB NOT NULL,
                    dishId BLOB NULL,
                    effectiveFrom TEXT NOT NULL,
                    effectiveTo TEXT NULL,
                    activeWeekDays TEXT NULL,
                    shiftNames TEXT NULL,
                    menuVariant TEXT NULL,
                    menuSectionName TEXT NULL,
                    slotName TEXT NULL,
                    dishCategory TEXT NULL,
                    portionRatePercent TEXT NOT NULL,
                    bomRatePercent TEXT NULL,
                    yieldLossPercent TEXT NULL,
                    priority INTEGER NOT NULL DEFAULT 0,
                    status TEXT NOT NULL,
                    reason TEXT NOT NULL,
                    createdAt TEXT NOT NULL,
                    updatedAt TEXT NOT NULL
                );
                CREATE TABLE menus (
                    menuId BLOB PRIMARY KEY,
                    menuCode TEXT NOT NULL,
                    menuName TEXT NOT NULL,
                    fromDate TEXT NULL,
                    toDate TEXT NULL,
                    isActive INTEGER NOT NULL
                );
                CREATE TABLE dishes (
                    dishId BLOB PRIMARY KEY,
                    dishCode TEXT NOT NULL,
                    dishName TEXT NOT NULL,
                    dishGroup TEXT NULL,
                    dishType TEXT NULL,
                    isActive INTEGER NOT NULL
                );
                CREATE TABLE menuitems (
                    menuItemId BLOB PRIMARY KEY,
                    menuId BLOB NOT NULL,
                    dishId BLOB NOT NULL,
                    dishSlot TEXT NULL,
                    displayOrder INTEGER NOT NULL
                );
                CREATE TABLE dishbom (
                    bomId BLOB PRIMARY KEY,
                    dishId BLOB NOT NULL,
                    ingredientId BLOB NOT NULL,
                    unitId BLOB NOT NULL,
                    grossQtyPerServing TEXT NOT NULL,
                    wasteRatePercent TEXT NOT NULL,
                    bomStatus TEXT NOT NULL DEFAULT 'PUBLISHED',
                    effectiveFrom TEXT NOT NULL,
                    effectiveTo TEXT NULL
                );
                CREATE TABLE menuschedules (
                    menuScheduleId BLOB PRIMARY KEY,
                    customerId BLOB NOT NULL,
                    menuId BLOB NOT NULL,
                    serviceDate TEXT NOT NULL,
                    weekStartDate TEXT NOT NULL,
                    shiftName TEXT NOT NULL,
                    menuPrice TEXT NOT NULL,
                    bomRatePercent TEXT NOT NULL,
                    status TEXT NOT NULL,
                    menuVersionId BLOB NULL
                );
                CREATE TABLE menuversions (
                    menuVersionId BLOB PRIMARY KEY,
                    customerId BLOB NOT NULL,
                    weekStartDate TEXT NOT NULL,
                    versionNo INTEGER NOT NULL,
                    status TEXT NOT NULL,
                    sourceFileName TEXT NULL,
                    sourceChecksum TEXT NULL,
                    sourceImportBatch TEXT NULL,
                    createdBy BLOB NULL,
                    createdAt TEXT NOT NULL,
                    publishedBy BLOB NULL,
                    publishedAt TEXT NULL,
                    updatedAt TEXT NOT NULL,
                    successRowCount INTEGER NOT NULL DEFAULT 0,
                    errorRowCount INTEGER NOT NULL DEFAULT 0,
                    warningRowCount INTEGER NOT NULL DEFAULT 0
                );
                CREATE TABLE quantityimportbatches (
                    importBatchId BLOB PRIMARY KEY,
                    batchCode TEXT NOT NULL,
                    sourceCompanyName TEXT NULL,
                    sourceType TEXT NOT NULL,
                    importedBy BLOB NULL,
                    importedAt TEXT NOT NULL,
                    status TEXT NOT NULL
                );
                CREATE TABLE mealquantityplans (
                    quantityPlanId BLOB PRIMARY KEY,
                    importBatchId BLOB NULL,
                    planCode TEXT NOT NULL,
                    serviceDate TEXT NOT NULL,
                    status TEXT NOT NULL,
                    forecastReceivedAt TEXT NULL,
                    confirmedAt TEXT NULL,
                    confirmationTime TEXT NOT NULL,
                    confirmedBy BLOB NULL
                );
                CREATE TABLE mealquantityplanlines (
                    quantityPlanLineId BLOB PRIMARY KEY,
                    quantityPlanId BLOB NOT NULL,
                    menuScheduleId BLOB NOT NULL,
                    customerId BLOB NOT NULL,
                    menuId BLOB NOT NULL,
                    shiftName TEXT NOT NULL,
                    forecastServings INTEGER NOT NULL,
                    confirmedServings INTEGER NOT NULL,
                    adjustedServings INTEGER NOT NULL,
                    finalServings INTEGER NOT NULL,
                    updatedAt TEXT NOT NULL DEFAULT '2026-01-01 00:00:00'
                );
                CREATE TABLE productionplans (
                    planId BLOB PRIMARY KEY,
                    planCode TEXT NOT NULL,
                    planDate TEXT NOT NULL,
                    status TEXT NOT NULL,
                    createdBy BLOB NOT NULL,
                    createdAt TEXT NOT NULL,
                    updatedAt TEXT NOT NULL DEFAULT '2026-01-01 00:00:00'
                );
                CREATE TABLE productionplanlines (
                    planLineId BLOB PRIMARY KEY,
                    planId BLOB NOT NULL,
                    quantityPlanLineId BLOB NOT NULL,
                    customerId BLOB NOT NULL,
                    menuId BLOB NOT NULL,
                    dishId BLOB NOT NULL,
                    shiftName TEXT NOT NULL,
                    totalServings INTEGER NOT NULL
                );
                CREATE TABLE materialrequests (
                    requestId BLOB PRIMARY KEY,
                    requestCode TEXT NOT NULL,
                    planId BLOB NOT NULL,
                    requestDate TEXT NOT NULL,
                    requestScope TEXT NOT NULL,
                    status TEXT NOT NULL,
                    createdBy BLOB NOT NULL,
                    approvedBy BLOB NULL,
                    approvedAt TEXT NULL
                );
                CREATE TABLE materialrequestlines (
                    requestLineId BLOB PRIMARY KEY,
                    requestId BLOB NOT NULL,
                    planLineId BLOB NOT NULL,
                    ingredientId BLOB NOT NULL,
                    unitId BLOB NOT NULL,
                    totalServings INTEGER NOT NULL,
                    grossQtyPerServing TEXT NOT NULL,
                    bomRatePercent TEXT NOT NULL,
                    appliedPortionRuleId BLOB NULL,
                    appliedPortionRatePercent TEXT NOT NULL DEFAULT '100.00',
                    appliedPortionRuleSource TEXT NOT NULL DEFAULT 'CONTRACT_DEFAULT',
                    yieldLossPercent TEXT NULL,
                    totalRequiredQty TEXT NOT NULL,
                    currentStockQty TEXT NOT NULL,
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
                CREATE TABLE purchaserequestlines (
                    purchaseRequestLineId BLOB PRIMARY KEY,
                    purchaseRequestId BLOB NOT NULL,
                    materialRequestLineId BLOB NOT NULL,
                    ingredientId BLOB NOT NULL,
                    supplierId BLOB,
                    unitId BLOB NOT NULL,
                    requiredQty TEXT NOT NULL,
                    currentStockQty TEXT NOT NULL,
                    purchaseQty TEXT NOT NULL,
                    estimatedUnitPrice TEXT NOT NULL
                );
                CREATE TABLE purchaseorders (
                    purchaseOrderId BLOB PRIMARY KEY,
                    purchaseOrderCode TEXT NOT NULL,
                    purchaseRequestId BLOB NOT NULL,
                    supplierId BLOB NOT NULL,
                    orderDate TEXT NOT NULL,
                    status TEXT NOT NULL DEFAULT 'ORDERED',
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
                CREATE TABLE currentstock (
                    warehouseId BLOB NOT NULL,
                    ingredientId BLOB NOT NULL,
                    unitId BLOB NOT NULL,
                    currentQty TEXT NOT NULL,
                    lastUpdated TEXT NOT NULL,
                    rowVersion BLOB NOT NULL DEFAULT (X'01'),
                    PRIMARY KEY (warehouseId, ingredientId)
                );
                CREATE TABLE auditlogs (
                    auditId BLOB PRIMARY KEY,
                    changedAt TEXT NOT NULL,
                    changedBy BLOB NOT NULL,
                    businessArea TEXT NOT NULL,
                    entityName TEXT NOT NULL,
                    entityId BLOB NULL,
                    fieldName TEXT NULL,
                    oldValue TEXT NULL,
                    newValue TEXT NULL,
                    reason TEXT NULL
                );
                CREATE TABLE approvalhistories (
                    approvalHistoryId BLOB PRIMARY KEY,
                    targetType TEXT NOT NULL,
                    targetId BLOB NOT NULL,
                    decision TEXT NOT NULL,
                    oldStatus TEXT NULL,
                    newStatus TEXT NULL,
                    reason TEXT NULL,
                    actionBy BLOB NOT NULL,
                    actionAt TEXT NOT NULL
                );
                CREATE TABLE inventoryreceipts (
                    receiptId BLOB PRIMARY KEY,
                    receiptCode TEXT NOT NULL,
                    receiptDate TEXT NOT NULL,
                    warehouseId BLOB NOT NULL,
                    supplierId BLOB NOT NULL,
                    purchaseRequestId BLOB NULL,
                    createdBy BLOB NOT NULL,
                    createdAt TEXT NOT NULL
                );
                CREATE TABLE inventoryreceiptlines (
                    receiptLineId BLOB PRIMARY KEY,
                    receiptId BLOB NOT NULL,
                    ingredientId BLOB NOT NULL,
                    unitId BLOB NOT NULL,
                    quantity TEXT NOT NULL,
                    unitPrice TEXT NOT NULL,
                    amount TEXT NULL,
                    lotNumber TEXT NULL,
                    manufactureDate TEXT NULL,
                    expiredDate TEXT NULL
                );
                CREATE TABLE inventoryissues (
                    issueId BLOB PRIMARY KEY,
                    issueCode TEXT NOT NULL,
                    issueDate TEXT NOT NULL,
                    shiftName TEXT NULL,
                    warehouseId BLOB NOT NULL,
                    materialRequestId BLOB NOT NULL,
                    issuedBy BLOB NOT NULL,
                    receivedBy BLOB NULL,
                    createdAt TEXT NOT NULL
                );
                CREATE TABLE inventoryissuelines (
                    issueLineId BLOB PRIMARY KEY,
                    issueId BLOB NOT NULL,
                    ingredientId BLOB NOT NULL,
                    unitId BLOB NOT NULL,
                    requestedQty TEXT NOT NULL,
                    issuedQty TEXT NOT NULL
                );
                CREATE TABLE quantityadjustments (
                    adjustmentId BLOB PRIMARY KEY,
                    quantityPlanLineId BLOB NOT NULL,
                    oldServings INTEGER NOT NULL,
                    newServings INTEGER NOT NULL,
                    reason TEXT NULL,
                    adjustedBy BLOB NOT NULL,
                    adjustedAt TEXT NOT NULL
                );
                CREATE TABLE bomadjustments (
                    bomAdjustmentId BLOB PRIMARY KEY,
                    bomId BLOB NOT NULL,
                    oldGrossQtyPerServing TEXT NOT NULL,
                    oldWasteRatePercent TEXT NOT NULL,
                    newGrossQtyPerServing TEXT NOT NULL,
                    newWasteRatePercent TEXT NOT NULL,
                    reason TEXT NULL,
                    adjustedBy BLOB NOT NULL,
                    adjustedAt TEXT NOT NULL
                );
                """;
            await command.ExecuteNonQueryAsync();
        }
    }
}
