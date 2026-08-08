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
