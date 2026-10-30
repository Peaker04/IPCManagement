using System.Data;
using FluentAssertions;
using IPCManagement.Api.Data.Transactions;
using IPCManagement.Api.Data;
using IPCManagement.Api.Exceptions;
using IPCManagement.Api.Features.Reconciliation.Services;
using IPCManagement.Api.Features.SampleData.Contracts;
using IPCManagement.Api.Features.SampleData.Services;
using IPCManagement.Api.Helpers;
using IPCManagement.Api.Models.Entities;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;

namespace IPCManagement.Api.Tests;

public partial class WorkflowGenerationTests
{
    [Fact]
    public async Task Mrx_preview_rejects_stale_base_version_before_tracking_changes()
    {
        await using var fixture = await WorkflowFixture.CreateAsync();
        await fixture.SeedMenuWithDemandAsync(includeMissingDish: false);
        await using var context = fixture.CreateContext();
        await EnsureMrxRevisionSchemaAsync(context);
        var (schedule, _, sourceLine) = await AttachMrxBaseVersionAsync(context);
        var request = new CreateMenuAmendmentRequest
        {
            CustomerId = fixture.CustomerIdString,
            WeekStartDate = schedule.WeekStartDate,
            ExpectedBaseMenuVersionId = GuidHelper.ToGuidString(GuidHelper.NewId()),
            Reason = "Preview đã cũ.",
            Lines = [new CreateMenuAmendmentLineRequest { ServiceDate = schedule.ServiceDate, ShiftName = schedule.ShiftName, DishSlot = "main", NewSavoryServings = sourceLine.FinalServings + 1, NewVegetarianServings = 0 }]
        };

        Func<Task> action = () => new MenuAmendmentService(context).PreviewAsync(request);

        // Spec §4.4: nguồn đã đổi phiên bản trả mã có cấu trúc MRX_SOURCE_STALE (409), không còn lỗi 400 chung.
        (await action.Should().ThrowAsync<MrxSourceChangeException>()).Which.Code.Should().Be(MrxErrorCodes.SourceStale);
        context.ChangeTracker.Entries<MenuAmendment>().Should().BeEmpty();
    }

    [Fact]
    public async Task Admin_approval_touching_issued_day_is_rejected_and_keeps_locked_day_frozen()
    {
        await using var fixture = await WorkflowFixture.CreateAsync();
        await fixture.SeedMenuWithDemandAsync(includeMissingDish: false);
        await using var context = fixture.CreateContext();
        await EnsureMrxRevisionSchemaAsync(context);
        var schedule = await context.Menuschedules.Include(item => item.Menu).ThenInclude(menu => menu.Menuitems).ThenInclude(item => item.Dish)
            .SingleAsync(item => item.ServiceDate == new DateOnly(2026, 6, 15));
        var sourceLine = await context.Mealquantityplanlines.SingleAsync(item => item.MenuScheduleId == schedule.MenuScheduleId);
        sourceLine.SavoryServings = sourceLine.FinalServings; // BR-MRX-SERV-1: món slot mặn nhân số suất mặn.
        sourceLine.VegetarianServings = 0;
        var bom = await context.Dishboms.Include(item => item.Ingredient).ThenInclude(item => item.Unit)
            .Include(item => item.Unit).SingleAsync(item => item.DishId == schedule.Menu.Menuitems.Single().DishId);
        var replacementDish = await context.Dishes.SingleAsync(item => item.DishId != schedule.Menu.Menuitems.Single().DishId && item.IsActive == true);
        var replacementIngredient = new Ingredient
        {
            IngredientId = GuidHelper.NewId(), IngredientCode = "ING-REPLACEMENT", IngredientName = "Nguyên liệu thay thế",
            UnitId = fixture.UnitId, WarehouseId = fixture.WarehouseId, ReferencePrice = 1200m, IsFreshDaily = true, IsActive = true
        };
        var replacementBom = new DishBom
        {
            BomId = GuidHelper.NewId(), DishId = replacementDish.DishId, IngredientId = replacementIngredient.IngredientId,
            UnitId = fixture.UnitId, CustomerId = bom.CustomerId, PriceTierAmount = bom.PriceTierAmount,
            GrossQtyPerServing = bom.GrossQtyPerServing * 2, WasteRatePercent = 0,
            BomStatus = "PUBLISHED", EffectiveFrom = schedule.ServiceDate.AddDays(-1)
        };
        context.Ingredients.Add(replacementIngredient);
        context.Dishboms.Add(replacementBom);
        var baseVersion = new MenuVersion
        {
            MenuVersionId = GuidHelper.NewId(), CustomerId = schedule.CustomerId, WeekStartDate = schedule.WeekStartDate,
            VersionNo = 1, Status = "ACTIVE", CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow
        };
        context.Menuversions.Add(baseVersion);
        schedule.MenuVersionId = baseVersion.MenuVersionId;
        var required = decimal.Round(ReconciliationBatchService.ConvertToCanonical(
            bom.GrossQtyPerServing * sourceLine.FinalServings, bom.Unit, bom.Ingredient.Unit), 6, MidpointRounding.AwayFromZero);
        var importBatchId = GuidHelper.NewId();
        // Lô được tạo từ đợt nhập này; tính lại chỉ đọc dòng số suất của đúng đợt nhập (như lúc tạo lô).
        (await context.Mealquantityplans.SingleAsync(item => item.QuantityPlanId == sourceLine.QuantityPlanId)).ImportBatchId = importBatchId;
        var batch = new ReconciliationBatch
        {
            BatchId = GuidHelper.NewId(), MenuVersionId = baseVersion.MenuVersionId, QuantityImportBatchId = importBatchId,
            Status = "IN_PROGRESS", Version = 1, CreatedBy = fixture.UserId, CreatedAt = DateTime.UtcNow
        };
        var batchLine = new ReconciliationBatchLine
        {
            BatchLineId = GuidHelper.NewId(), BatchId = batch.BatchId, IngredientId = bom.IngredientId,
            CanonicalUnitId = bom.Ingredient.UnitId, RequiredQuantity = required, FrozenTolerance = 0.5m,
            ToleranceSourceKind = "SYSTEM_DEFAULT", ToleranceSourceVersion = "1", Version = 1, Batch = batch
        };
        var daily = new ReconciliationBatchDailyLine
        {
            DailyLineId = GuidHelper.NewId(), BatchLineId = batchLine.BatchLineId, BatchId = batch.BatchId,
            IngredientId = batchLine.IngredientId, CanonicalUnitId = batchLine.CanonicalUnitId,
            ServiceDate = schedule.ServiceDate, RequiredQuantity = required, Version = 1, BatchLine = batchLine
        };
        batch.Lines.Add(batchLine);
        batchLine.DailyLines.Add(daily);
        batchLine.Contributors.Add(new ReconciliationBatchContributor
        {
            ContributorId = GuidHelper.NewId(), BatchLineId = batchLine.BatchLineId, DailyLineId = daily.DailyLineId,
            MenuScheduleId = schedule.MenuScheduleId, MealQuantityPlanLineId = sourceLine.QuantityPlanLineId,
            DishBomId = bom.BomId, DishId = bom.DishId, FrozenShiftName = schedule.ShiftName,
            FrozenDishCode = schedule.Menu.Menuitems.Single().Dish.DishCode,
            FrozenDishName = schedule.Menu.Menuitems.Single().Dish.DishName,
            FrozenServings = sourceLine.FinalServings, FrozenBomQuantityPerServing = bom.GrossQtyPerServing,
            FrozenWasteRatePercent = bom.WasteRatePercent, SourceQuantity = required
        });
        context.Reconciliationbatches.Add(batch);
        context.Inventoryissues.Add(new InventoryIssue
        {
            IssueId = GuidHelper.NewId(), IssueCode = "ISS-MRX-REV", IssueDate = schedule.ServiceDate,
            WarehouseId = fixture.WarehouseId, ReconciliationBatchId = batch.BatchId,
            IssuedBy = fixture.UserId, CreatedAt = DateTime.UtcNow
        });
        context.Reconciliationdailydispositions.Add(new ReconciliationDailyDisposition
        {
            DispositionId = GuidHelper.NewId(), DailyLineId = daily.DailyLineId, Category = "ACCEPTED_VARIANCE",
            Reason = "Quyết định cũ", Version = 1, DisposedBy = fixture.UserId, DisposedAt = DateTime.UtcNow
        });
        context.Reconciliationtolerances.Add(new ReconciliationTolerance
        {
            ToleranceId = GuidHelper.NewId(), ScopeKind = "SYSTEM_DEFAULT", Value = 0.5m, Version = 1,
            CreatedBy = fixture.UserId, CreatedAt = DateTime.UtcNow
        });
        await context.SaveChangesAsync();
        var adminId = await CreateApprovalActorAsync(context, "mrx-admin-issued-revision");
        var service = new MenuAmendmentService(context, null, new ReconciliationSourceRevisionService(context));
        var request = await service.SubmitMrxAsync(new CreateMenuAmendmentRequest
        {
            CustomerId = fixture.CustomerIdString, WeekStartDate = schedule.WeekStartDate,
            ExpectedBaseMenuVersionId = GuidHelper.ToGuidString(baseVersion.MenuVersionId),
            Reason = "Đổi món sau xuất kho.",
            Lines = [new CreateMenuAmendmentLineRequest { ServiceDate = schedule.ServiceDate, ShiftName = schedule.ShiftName, DishSlot = "main", NewDishId = GuidHelper.ToGuidString(replacementDish.DishId) }]
        }, fixture.UserIdString);

        Func<Task> approval = () => service.DecideMrxAsync(request.MenuAmendmentId,
            new ReviewMenuAmendmentRequest { Approved = true }, adminId, ["ADMIN"]);

        // BR-MRX-EDIT-4/9: 2026-06-15 đã có phiếu xuất nên là ngày khóa; dòng đổi món chạm ngày khóa bị từ chối toàn bộ,
        // yêu cầu chuyển CORRECTION_REQUIRED, không ghi revision/delta, không đổi số đóng băng.
        var error = (await approval.Should().ThrowAsync<MrxSourceChangeException>()).Which;
        error.Code.Should().Be(MrxErrorCodes.DayLocked);
        error.LockedDates.Should().Equal(schedule.ServiceDate);
        context.ChangeTracker.Clear();
        (await context.Menuamendments.SingleAsync()).Status.Should().Be("CORRECTION_REQUIRED");
        (await context.Reconciliationsourcerevisions.CountAsync()).Should().Be(0);
        (await context.Reconciliationsourcedeltas.CountAsync()).Should().Be(0);
        var storedDaily = await context.Reconciliationbatchdailylines.SingleAsync();
        storedDaily.RequiredQuantity.Should().Be(required);
        storedDaily.Version.Should().Be(1);
        (await context.Reconciliationbatchdailylines.AnyAsync(item => item.IngredientId == replacementIngredient.IngredientId)).Should().BeFalse();
        (await context.Reconciliationbatchcontributors.SingleAsync()).DishBomId.Should().Equal(bom.BomId);
        (await context.Reconciliationdailydispositions.SingleAsync()).InvalidatedAt.Should().BeNull();
        (await context.Reconciliationbatches.SingleAsync()).MenuVersionId.Should().Equal(baseVersion.MenuVersionId);
        (await context.Menuversions.CountAsync()).Should().Be(1);
    }

    [Fact]
    public async Task Admin_direct_apply_applies_previewed_change_with_same_actor()
    {
        await using var fixture = await WorkflowFixture.CreateAsync();
        await fixture.SeedMenuWithDemandAsync(includeMissingDish: false);
        await using var context = fixture.CreateContext();
        await EnsureMrxRevisionSchemaAsync(context);
        var (schedule, currentVersion, sourceLine) = await AttachMrxBaseVersionAsync(context);
        var adminId = await CreateApprovalActorAsync(context, "mrx-admin-direct");
        var service = new MenuAmendmentService(context);
        var command = new CreateMenuAmendmentRequest
        {
            CustomerId = fixture.CustomerIdString,
            WeekStartDate = schedule.WeekStartDate,
            ExpectedBaseMenuVersionId = GuidHelper.ToGuidString(currentVersion.MenuVersionId),
            Reason = "Admin áp dụng trực tiếp sau preview.",
            Lines = [new CreateMenuAmendmentLineRequest { ServiceDate = schedule.ServiceDate, ShiftName = schedule.ShiftName, DishSlot = "main", NewSavoryServings = sourceLine.FinalServings + 10, NewVegetarianServings = 0 }]
        };
        (await service.PreviewMrxAsync(command)).Status.Should().Be("PREVIEW");

        var result = await service.ApplyMrxAsync(command, adminId, ["ADMIN"]);

        result.Status.Should().Be("EXECUTED");
        context.ChangeTracker.Clear();
        (await context.Menuamendments.SingleAsync()).CreatedBy.Should().Equal(GuidHelper.ParseGuidString(adminId)!);
        (await context.Menuamendments.SingleAsync()).ExecutedBy.Should().Equal(GuidHelper.ParseGuidString(adminId)!);
        (await context.Quantityadjustments.CountAsync()).Should().Be(1);
        (await context.Mealquantityplanlines.SingleAsync()).FinalServings.Should().Be(sourceLine.FinalServings + 10);
    }

    [Fact]
    public async Task Admin_approval_applies_specialist_serving_change_and_records_one_source_version()
    {
        await using var fixture = await WorkflowFixture.CreateAsync();
        await fixture.SeedMenuWithDemandAsync(includeMissingDish: false);
        await using var context = fixture.CreateContext();
        await EnsureMrxRevisionSchemaAsync(context);
        var (schedule, baseVersion, sourceLine) = await AttachMrxBaseVersionAsync(context);
        var requestedServings = sourceLine.FinalServings + 30;
        var service = new MenuAmendmentService(context);
        var request = await service.SubmitMrxAsync(new CreateMenuAmendmentRequest
        {
            CustomerId = fixture.CustomerIdString,
            WeekStartDate = schedule.WeekStartDate,
            ExpectedBaseMenuVersionId = GuidHelper.ToGuidString(baseVersion.MenuVersionId),
            Reason = "Chuyên viên đề nghị tăng số suất.",
            Lines = [new CreateMenuAmendmentLineRequest { ServiceDate = schedule.ServiceDate, ShiftName = schedule.ShiftName, DishSlot = "main", NewSavoryServings = requestedServings, NewVegetarianServings = 0 }]
        }, fixture.UserIdString);
        var adminId = await CreateApprovalActorAsync(context, "mrx-admin-approve");

        var result = await service.DecideMrxAsync(request.MenuAmendmentId, new ReviewMenuAmendmentRequest { Approved = true, Reason = "Đã xác nhận với khách hàng." }, adminId, ["ADMIN"]);

        result.Status.Should().Be("EXECUTED");
        (await context.Mealquantityplanlines.AsNoTracking().SingleAsync(item => item.QuantityPlanLineId == sourceLine.QuantityPlanLineId)).FinalServings.Should().Be(requestedServings);
        // Phiên bản gốc + đúng một phiên bản nguồn mới.
        (await context.Menuversions.CountAsync()).Should().Be(2);
        var revision = await context.Quantityadjustments.AsNoTracking().SingleAsync();
        revision.OldServings.Should().Be(sourceLine.FinalServings);
        revision.NewServings.Should().Be(requestedServings);
        (await context.Auditlogs.AnyAsync(item => item.EntityName == nameof(MealQuantityPlanLine) && item.FieldName == nameof(MealQuantityPlanLine.FinalServings) && item.ChangedBy.SequenceEqual(GuidHelper.ParseGuidString(adminId)!))).Should().BeTrue();
        (await context.Auditlogs.AnyAsync(item => item.EntityName == nameof(MealQuantityPlanLine) && item.FieldName == nameof(MealQuantityPlanLine.SavoryServings) && item.NewValue == requestedServings.ToString())).Should().BeTrue();
        Func<Task> duplicateApproval = () => service.DecideMrxAsync(request.MenuAmendmentId, new ReviewMenuAmendmentRequest { Approved = true }, adminId, ["ADMIN"]);
        await duplicateApproval.Should().ThrowAsync<BusinessRuleException>().WithMessage("*không còn chờ*");
        (await context.Menuversions.CountAsync()).Should().Be(2);
    }

    [Fact]
    public async Task Admin_approval_rolls_back_source_and_affected_batch_when_transaction_fails_after_staging()
    {
        await using var fixture = await WorkflowFixture.CreateAsync();
        await fixture.SeedMenuWithDemandAsync(includeMissingDish: false);
        await using var context = fixture.CreateContext();
        await EnsureMrxRevisionSchemaAsync(context);
        var schedule = await context.Menuschedules.SingleAsync(item => item.ServiceDate == new DateOnly(2026, 6, 15));
        var sourceLine = await context.Mealquantityplanlines.SingleAsync(item => item.MenuScheduleId == schedule.MenuScheduleId);
        var originalServings = sourceLine.FinalServings;
        sourceLine.SavoryServings = sourceLine.FinalServings; // BR-MRX-SERV-1: món slot mặn nhân số suất mặn.
        sourceLine.VegetarianServings = 0;
        // Đổi món (không đổi số suất) để staging thành công rồi giao dịch mới bị ép lỗi; đổi số suất
        // qua NewServings không còn qua được projection MRX vì số suất Mặn/Chay sẽ lệch tổng.
        var originalMenuId = schedule.MenuId;
        var originalDishId = (await context.Menuitems.SingleAsync(item => item.MenuId == originalMenuId)).DishId;
        var originalBom = await context.Dishboms.SingleAsync(item => item.DishId == originalDishId);
        var replacementDish = await context.Dishes.SingleAsync(item => item.DishId != originalDishId && item.IsActive == true);
        context.Dishboms.Add(new DishBom
        {
            BomId = GuidHelper.NewId(), DishId = replacementDish.DishId, IngredientId = originalBom.IngredientId,
            UnitId = originalBom.UnitId, CustomerId = originalBom.CustomerId, PriceTierAmount = originalBom.PriceTierAmount,
            GrossQtyPerServing = originalBom.GrossQtyPerServing * 2, WasteRatePercent = 0,
            BomStatus = "PUBLISHED", EffectiveFrom = schedule.ServiceDate.AddDays(-1)
        });
        var baseVersion = new MenuVersion { MenuVersionId = GuidHelper.NewId(), CustomerId = schedule.CustomerId, WeekStartDate = schedule.WeekStartDate, VersionNo = 1, Status = "ACTIVE", CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow };
        context.Menuversions.Add(baseVersion);
        schedule.MenuVersionId = baseVersion.MenuVersionId;
        var importBatchId = GuidHelper.NewId();
        (await context.Mealquantityplans.SingleAsync(item => item.QuantityPlanId == sourceLine.QuantityPlanId)).ImportBatchId = importBatchId;
        context.Reconciliationbatches.Add(new ReconciliationBatch { BatchId = GuidHelper.NewId(), MenuVersionId = baseVersion.MenuVersionId, QuantityImportBatchId = importBatchId, Status = "DRAFT", Version = 1, CreatedBy = fixture.UserId, CreatedAt = DateTime.UtcNow });
        context.Reconciliationtolerances.Add(new ReconciliationTolerance { ToleranceId = GuidHelper.NewId(), ScopeKind = "SYSTEM_DEFAULT", Value = 0.5m, Version = 1, CreatedBy = fixture.UserId, CreatedAt = DateTime.UtcNow });
        await context.SaveChangesAsync();
        var request = await new MenuAmendmentService(context).SubmitMrxAsync(new CreateMenuAmendmentRequest
        {
            CustomerId = fixture.CustomerIdString, WeekStartDate = schedule.WeekStartDate, Reason = "Kiểm tra rollback sau staging.",
            ExpectedBaseMenuVersionId = GuidHelper.ToGuidString(baseVersion.MenuVersionId),
            Lines = [new CreateMenuAmendmentLineRequest { ServiceDate = schedule.ServiceDate, ShiftName = schedule.ShiftName, DishSlot = "main", NewDishId = GuidHelper.ToGuidString(replacementDish.DishId) }]
        }, fixture.UserIdString);
        var adminId = await CreateApprovalActorAsync(context, "mrx-admin-rollback");
        var service = new MenuAmendmentService(context, new FailAfterOperationTransactionRunner(context), new ReconciliationSourceRevisionService(context));

        Func<Task> approval = () => service.DecideMrxAsync(request.MenuAmendmentId, new ReviewMenuAmendmentRequest { Approved = true }, adminId, ["ADMIN"]);

        await approval.Should().ThrowAsync<InvalidOperationException>().WithMessage("forced failure after staging");
        context.ChangeTracker.Clear();
        (await context.Menuamendments.SingleAsync()).Status.Should().Be("PENDING_REVIEW");
        (await context.Mealquantityplanlines.SingleAsync()).FinalServings.Should().Be(originalServings);
        var restoredSchedule = await context.Menuschedules.SingleAsync(item => item.MenuScheduleId == schedule.MenuScheduleId);
        restoredSchedule.MenuId.Should().Equal(originalMenuId);
        (await context.Menuitems.SingleAsync(item => item.MenuId == originalMenuId)).DishId.Should().Equal(originalDishId);
        (await context.Menuversions.CountAsync()).Should().Be(1);
        (await context.Reconciliationsourcerevisions.CountAsync()).Should().Be(0);
        (await context.Reconciliationbatchlines.CountAsync()).Should().Be(0);
    }

    [Fact]
    public async Task Concurrent_admin_approvals_commit_exactly_one_source_version()
    {
        await using var fixture = await WorkflowFixture.CreateAsync();
        await fixture.SeedMenuWithDemandAsync(includeMissingDish: false);
        await using var setupContext = fixture.CreateContext();
        await EnsureMrxRevisionSchemaAsync(setupContext);
        var (schedule, baseVersion, sourceLine) = await AttachMrxBaseVersionAsync(setupContext);
        var request = await new MenuAmendmentService(setupContext).SubmitMrxAsync(new CreateMenuAmendmentRequest
        {
            CustomerId = fixture.CustomerIdString,
            WeekStartDate = schedule.WeekStartDate,
            ExpectedBaseMenuVersionId = GuidHelper.ToGuidString(baseVersion.MenuVersionId),
            Reason = "Kiểm tra hàng rào phê duyệt đồng thời.",
            Lines = [new CreateMenuAmendmentLineRequest { ServiceDate = schedule.ServiceDate, ShiftName = schedule.ShiftName, DishSlot = "main", NewSavoryServings = sourceLine.FinalServings + 15, NewVegetarianServings = 0 }]
        }, fixture.UserIdString);
        var adminId = await CreateApprovalActorAsync(setupContext, "mrx-admin-concurrent");

        var databasePath = Path.Combine(Path.GetTempPath(), $"mrx-approval-{Guid.NewGuid():N}.db");
        try
        {
            await using (var destination = new SqliteConnection($"Data Source={databasePath}"))
            {
                await destination.OpenAsync();
                ((SqliteConnection)setupContext.Database.GetDbConnection()).BackupDatabase(destination);
            }

            var options = new DbContextOptionsBuilder<IpcManagementContext>()
                .UseSqlite($"Data Source={databasePath};Default Timeout=30")
                .Options;
            await using var firstContext = new IpcManagementContext(options);
            await using var secondContext = new IpcManagementContext(options);
            var gate = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
            var first = Task.Run(async () =>
            {
                await gate.Task;
                return await Record.ExceptionAsync(() => new MenuAmendmentService(firstContext).DecideMrxAsync(
                    request.MenuAmendmentId, new ReviewMenuAmendmentRequest { Approved = true }, adminId, ["ADMIN"]));
            });
            var second = Task.Run(async () =>
            {
                await gate.Task;
                return await Record.ExceptionAsync(() => new MenuAmendmentService(secondContext).DecideMrxAsync(
                    request.MenuAmendmentId, new ReviewMenuAmendmentRequest { Approved = true }, adminId, ["ADMIN"]));
            });
            gate.SetResult();
            var outcomes = await Task.WhenAll(first, second);

            outcomes.Count(item => item is null).Should().Be(1);
            outcomes.OfType<BusinessRuleException>().Should().ContainSingle()
                .Which.Message.Should().Contain("không còn chờ");
            await using var verifyContext = new IpcManagementContext(options);
            // Phiên bản gốc + đúng một phiên bản nguồn mới.
            (await verifyContext.Menuversions.CountAsync()).Should().Be(2);
            (await verifyContext.Quantityadjustments.CountAsync()).Should().Be(1);
            (await verifyContext.Menuamendments.SingleAsync()).Status.Should().Be("EXECUTED");
        }
        finally
        {
            SqliteConnection.ClearAllPools();
            File.Delete(databasePath);
        }
    }

    [Fact]
    public async Task Specialist_request_rejection_preserves_menu_servings_and_creates_no_source_version()
    {
        await using var fixture = await WorkflowFixture.CreateAsync();
        await fixture.SeedMenuWithDemandAsync(includeMissingDish: false);
        await using var context = fixture.CreateContext();
        await EnsureMrxRevisionSchemaAsync(context);
        var (schedule, baseVersion, sourceLine) = await AttachMrxBaseVersionAsync(context);
        var service = new MenuAmendmentService(context);
        var request = await service.SubmitMrxAsync(new CreateMenuAmendmentRequest
        {
            CustomerId = fixture.CustomerIdString,
            WeekStartDate = schedule.WeekStartDate,
            ExpectedBaseMenuVersionId = GuidHelper.ToGuidString(baseVersion.MenuVersionId),
            Reason = "Chuyên viên đề nghị tăng số suất.",
            Lines = [new CreateMenuAmendmentLineRequest { ServiceDate = schedule.ServiceDate, ShiftName = schedule.ShiftName, DishSlot = "main", NewSavoryServings = sourceLine.FinalServings + 20, NewVegetarianServings = 0 }]
        }, fixture.UserIdString);
        var adminId = await CreateApprovalActorAsync(context, "mrx-admin-reject");
        var inboxItem = (await service.GetMrxInboxAsync()).Should().ContainSingle().Subject;
        inboxItem.ImpactLines.Should().ContainSingle().Which.NewServings.Should().Be(sourceLine.FinalServings + 20);
        inboxItem.ImpactLines.Single().NewSavoryServings.Should().Be(sourceLine.FinalServings + 20);

        var result = await service.DecideMrxAsync(request.MenuAmendmentId, new ReviewMenuAmendmentRequest { Approved = false, Reason = "Khách hàng không xác nhận." }, adminId, ["ADMIN"]);

        result.Status.Should().Be("REJECTED");
        (await context.Mealquantityplanlines.AsNoTracking().SingleAsync(item => item.QuantityPlanLineId == sourceLine.QuantityPlanLineId)).FinalServings.Should().Be(sourceLine.FinalServings);
        (await context.Menuversions.CountAsync()).Should().Be(1);
        (await context.Auditlogs.SingleAsync(item => item.EntityName == nameof(MenuAmendment) && item.NewValue == "REJECTED")).ChangedBy.Should().Equal(GuidHelper.ParseGuidString(adminId)!);
    }

    [Fact]
    public async Task Mrx_request_with_total_servings_is_rejected_at_preview_submit_and_apply()
    {
        await using var fixture = await WorkflowFixture.CreateAsync();
        await fixture.SeedMenuWithDemandAsync(includeMissingDish: false);
        await using var context = fixture.CreateContext();
        await EnsureMrxRevisionSchemaAsync(context);
        var (schedule, baseVersion, sourceLine) = await AttachMrxBaseVersionAsync(context);
        var adminId = await CreateApprovalActorAsync(context, "mrx-admin-total");
        var request = new CreateMenuAmendmentRequest
        {
            CustomerId = fixture.CustomerIdString,
            WeekStartDate = schedule.WeekStartDate,
            ExpectedBaseMenuVersionId = GuidHelper.ToGuidString(baseVersion.MenuVersionId),
            Reason = "Gửi tổng số suất như luồng cũ.",
            Lines = [new CreateMenuAmendmentLineRequest { ServiceDate = schedule.ServiceDate, ShiftName = schedule.ShiftName, DishSlot = "main", NewServings = sourceLine.FinalServings + 5 }]
        };
        var service = new MenuAmendmentService(context);

        // Spec §3.7: ở MRX, NewServings bị từ chối (400) ngay khi xem trước/tạo, không đợi tới lúc duyệt.
        await service.Invoking(item => item.PreviewMrxAsync(request)).Should().ThrowAsync<BusinessRuleException>().WithMessage("*Mặn*Chay*");
        await service.Invoking(item => item.SubmitMrxAsync(request, fixture.UserIdString)).Should().ThrowAsync<BusinessRuleException>();
        await service.Invoking(item => item.ApplyMrxAsync(request, adminId, ["ADMIN"])).Should().ThrowAsync<BusinessRuleException>();
        (await context.Menuamendments.CountAsync()).Should().Be(0);
        (await context.Menuversions.CountAsync()).Should().Be(1);
    }

    [Fact]
    public async Task Mrx_menu_change_preview_returns_exact_dish_and_serving_impact_without_writes()
    {
        await using var fixture = await WorkflowFixture.CreateAsync();
        await fixture.SeedMenuWithDemandAsync(includeMissingDish: false);
        await using var context = fixture.CreateContext();
        var schedule = await context.Menuschedules.AsNoTracking().Include(item => item.Menu).ThenInclude(menu => menu.Menuitems).SingleAsync(item => item.ServiceDate == new DateOnly(2026, 6, 15));
        var sourceItem = schedule.Menu.Menuitems.Single();
        var sourceLine = await context.Mealquantityplanlines.AsNoTracking().SingleAsync(item => item.MenuScheduleId == schedule.MenuScheduleId);
        var request = new CreateMenuAmendmentRequest
        {
            CustomerId = fixture.CustomerIdString,
            WeekStartDate = schedule.WeekStartDate,
            Reason = "Điều chỉnh số suất đã xác nhận.",
            Lines =
            [
                new CreateMenuAmendmentLineRequest
                {
                    ServiceDate = schedule.ServiceDate,
                    ShiftName = schedule.ShiftName,
                    DishSlot = sourceItem.DishSlot ?? "main",
                    NewServings = sourceLine.FinalServings + 25
                }
            ]
        };

        var preview = await new MenuAmendmentService(context).PreviewAsync(request);

        preview.Status.Should().Be("PREVIEW");
        var impact = preview.ImpactLines.Should().ContainSingle().Subject;
        impact.ServiceDate.Should().Be(schedule.ServiceDate);
        impact.ShiftName.Should().Be(schedule.ShiftName);
        impact.OldDishId.Should().Be(GuidHelper.ToGuidString(sourceItem.DishId!));
        impact.NewDishId.Should().Be(impact.OldDishId);
        impact.CurrentServings.Should().Be(sourceLine.FinalServings);
        impact.NewServings.Should().Be(sourceLine.FinalServings + 25);
        (await context.Menuamendments.CountAsync()).Should().Be(0);
    }

    [Fact]
    public async Task Mrx_menu_change_preview_is_read_only_and_rejects_replacement_without_bom()
    {
        await using var fixture = await WorkflowFixture.CreateAsync();
        await fixture.SeedMenuWithDemandAsync(includeMissingDish: false);
        await using var context = fixture.CreateContext();
        var schedule = await context.Menuschedules.AsNoTracking().SingleAsync(item => item.ServiceDate == new DateOnly(2026, 6, 15));
        var replacementWithoutBom = await context.Dishes.AsNoTracking()
            .Where(dish => !context.Dishboms.Any(bom => bom.DishId == dish.DishId))
            .Select(dish => dish.DishId)
            .FirstAsync();
        var request = new CreateMenuAmendmentRequest
        {
            CustomerId = fixture.CustomerIdString,
            WeekStartDate = schedule.WeekStartDate,
            Reason = "Khách hàng yêu cầu đổi món.",
            Lines =
            [
                new CreateMenuAmendmentLineRequest
                {
                    ServiceDate = schedule.ServiceDate,
                    ShiftName = schedule.ShiftName,
                    DishSlot = "savory-main",
                    NewDishId = GuidHelper.ToGuidString(replacementWithoutBom)
                }
            ]
        };
        var service = new MenuAmendmentService(context);

        Func<Task> action = () => service.PreviewAsync(request);

        await action.Should().ThrowAsync<BusinessRuleException>().WithMessage("*BOM*");
        (await context.Menuamendments.CountAsync()).Should().Be(0);
        context.ChangeTracker.Entries<MenuAmendment>().Should().BeEmpty();
    }

    private sealed class FailAfterOperationTransactionRunner(IpcManagementContext context) : IEfTransactionRunner
    {
        private readonly EfTransactionRunner inner = new(context);

        public Task ExecuteAsync(Func<CancellationToken, Task> operation, Func<CancellationToken, Task<bool>> verifySucceeded, IsolationLevel isolationLevel = IsolationLevel.ReadCommitted, CancellationToken cancellationToken = default)
            => inner.ExecuteAsync(async token => { await operation(token); throw new InvalidOperationException("forced failure after staging"); }, verifySucceeded, isolationLevel, cancellationToken);

        public Task<TResult> ExecuteAsync<TResult>(Func<CancellationToken, Task<TResult>> operation, Func<CancellationToken, Task<bool>> verifySucceeded, IsolationLevel isolationLevel = IsolationLevel.ReadCommitted, CancellationToken cancellationToken = default)
            => inner.ExecuteAsync<TResult>(async token => { await operation(token); throw new InvalidOperationException("forced failure after staging"); }, verifySucceeded, isolationLevel, cancellationToken);

        public Task<TResult> ExecuteProtectedAsync<TResult>(string operationKey, long expectedModeVersion, Func<CancellationToken, Task<TResult>> operation, Func<CancellationToken, Task<bool>> verifySucceeded, IsolationLevel isolationLevel = IsolationLevel.ReadCommitted, CancellationToken cancellationToken = default)
            => throw new NotSupportedException();
    }

    /// <summary>Gắn phiên bản thực đơn gốc cho lịch 2026-06-15 và tách số suất (toàn bộ là suất mặn) như dữ liệu MRX hợp lệ.</summary>
    private static async Task<(MenuSchedule Schedule, MenuVersion Version, MealQuantityPlanLine SourceLine)> AttachMrxBaseVersionAsync(IpcManagementContext context)
    {
        var schedule = await context.Menuschedules.SingleAsync(item => item.ServiceDate == new DateOnly(2026, 6, 15));
        var version = new MenuVersion { MenuVersionId = GuidHelper.NewId(), CustomerId = schedule.CustomerId, WeekStartDate = schedule.WeekStartDate, VersionNo = 1, Status = "ACTIVE", CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow };
        context.Menuversions.Add(version);
        schedule.MenuVersionId = version.MenuVersionId;
        var sourceLine = await context.Mealquantityplanlines.SingleAsync(item => item.MenuScheduleId == schedule.MenuScheduleId);
        sourceLine.SavoryServings = sourceLine.FinalServings;
        sourceLine.VegetarianServings = 0;
        await context.SaveChangesAsync();
        context.ChangeTracker.Clear();
        return (schedule, version, sourceLine);
    }

    internal static Task EnsureMrxRevisionSchemaAsync(IpcManagementContext context) => context.Database.ExecuteSqlRawAsync("""
        CREATE TABLE reconciliationbatches (batchId BLOB PRIMARY KEY, menuVersionId BLOB NOT NULL, quantityImportBatchId BLOB NOT NULL, status TEXT NOT NULL, version INTEGER NOT NULL, createdBy BLOB NOT NULL, createdAt TEXT NOT NULL, readyBy BLOB NULL, readyAt TEXT NULL, completedBy BLOB NULL, completedAt TEXT NULL);
        CREATE TABLE reconciliationbatchlines (batchLineId BLOB PRIMARY KEY, batchId BLOB NOT NULL, ingredientId BLOB NOT NULL, canonicalUnitId BLOB NOT NULL, requiredQuantity TEXT NOT NULL, frozenTolerance TEXT NOT NULL, toleranceSourceKind TEXT NOT NULL, toleranceSourceVersion TEXT NOT NULL, version INTEGER NOT NULL);
        CREATE TABLE reconciliationbatchdailylines (dailyLineId BLOB PRIMARY KEY, batchLineId BLOB NOT NULL, batchId BLOB NOT NULL, ingredientId BLOB NOT NULL, canonicalUnitId BLOB NOT NULL, serviceDate TEXT NOT NULL, requiredQuantity TEXT NOT NULL, version INTEGER NOT NULL);
        CREATE TABLE reconciliationbatchcontributors (contributorId BLOB PRIMARY KEY, batchLineId BLOB NOT NULL, dailyLineId BLOB NULL, menuScheduleId BLOB NOT NULL, mealQuantityPlanLineId BLOB NOT NULL, dishBomId BLOB NOT NULL, dishId BLOB NULL, frozenShiftName TEXT NOT NULL, frozenDishCode TEXT NULL, frozenDishName TEXT NULL, frozenServings INTEGER NULL, frozenBomQuantityPerServing TEXT NULL, frozenWasteRatePercent TEXT NULL, sourceQuantity TEXT NOT NULL, FrozenMenuVariant TEXT NULL);
        CREATE TABLE reconciliationtolerances (toleranceId BLOB PRIMARY KEY, scopeKind TEXT NOT NULL, scopeId BLOB NULL, value TEXT NOT NULL, version INTEGER NOT NULL, createdBy BLOB NOT NULL, createdAt TEXT NOT NULL, systemDefaultKey INTEGER NULL);
        CREATE TABLE reconciliationdailydispositions (dispositionId BLOB PRIMARY KEY, dailyLineId BLOB NOT NULL, category TEXT NOT NULL, reason TEXT NOT NULL, version INTEGER NOT NULL, disposedBy BLOB NOT NULL, disposedAt TEXT NOT NULL, invalidatedAt TEXT NULL, invalidatedBy BLOB NULL, invalidationReason TEXT NULL);
        CREATE TABLE reconciliationsourcerevisions (sourceRevisionId BLOB PRIMARY KEY, menuAmendmentId BLOB NULL, batchId BLOB NOT NULL, previousMenuVersionId BLOB NOT NULL, appliedMenuVersionId BLOB NOT NULL, revisionNumber INTEGER NOT NULL, status TEXT NOT NULL, reason TEXT NOT NULL, appliedBy BLOB NOT NULL, appliedAt TEXT NOT NULL, AppliedByRole TEXT NULL, ApplyMode TEXT NULL, UNIQUE (menuAmendmentId, batchId), UNIQUE (batchId, revisionNumber));
        CREATE TABLE reconciliationsourcedeltas (sourceDeltaId BLOB PRIMARY KEY, sourceRevisionId BLOB NOT NULL, batchId BLOB NOT NULL, dailyLineId BLOB NULL, serviceDate TEXT NOT NULL, ingredientId BLOB NOT NULL, canonicalUnitId BLOB NOT NULL, previousRequiredQuantity TEXT NOT NULL, newRequiredQuantity TEXT NOT NULL, deltaQuantity TEXT NOT NULL, workKind TEXT NOT NULL, status TEXT NOT NULL, version INTEGER NOT NULL, createdAt TEXT NOT NULL, resolvedAt TEXT NULL, resolvedBy BLOB NULL, resolutionEntity TEXT NULL, resolutionId BLOB NULL, resolutionCommandId TEXT NULL);
        """);
}
