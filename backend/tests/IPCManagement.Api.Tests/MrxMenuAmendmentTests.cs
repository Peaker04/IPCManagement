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
        var schedule = await context.Menuschedules.Include(item => item.Menu).ThenInclude(menu => menu.Menuitems).SingleAsync(item => item.ServiceDate == new DateOnly(2026, 6, 15));
        var currentVersion = new MenuVersion { MenuVersionId = GuidHelper.NewId(), CustomerId = schedule.CustomerId, WeekStartDate = schedule.WeekStartDate, VersionNo = 1, Status = "ACTIVE", CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow };
        context.Menuversions.Add(currentVersion);
        schedule.MenuVersionId = currentVersion.MenuVersionId;
        await context.SaveChangesAsync();
        var sourceLine = await context.Mealquantityplanlines.AsNoTracking().SingleAsync(item => item.MenuScheduleId == schedule.MenuScheduleId);
        var request = new CreateMenuAmendmentRequest
        {
            CustomerId = fixture.CustomerIdString,
            WeekStartDate = schedule.WeekStartDate,
            ExpectedBaseMenuVersionId = GuidHelper.ToGuidString(GuidHelper.NewId()),
            Reason = "Preview đã cũ.",
            Lines = [new CreateMenuAmendmentLineRequest { ServiceDate = schedule.ServiceDate, ShiftName = schedule.ShiftName, DishSlot = "main", NewServings = sourceLine.FinalServings + 1 }]
        };

        Func<Task> action = () => new MenuAmendmentService(context).PreviewAsync(request);

        await action.Should().ThrowAsync<BusinessRuleException>().WithMessage("*đã thay đổi*");
        context.ChangeTracker.Entries<MenuAmendment>().Should().BeEmpty();
    }

    [Fact]
    public async Task Admin_approval_of_issued_batch_commits_source_revision_pending_delta_and_disposition_invalidation()
    {
        await using var fixture = await WorkflowFixture.CreateAsync();
        await fixture.SeedMenuWithDemandAsync(includeMissingDish: false);
        await using var context = fixture.CreateContext();
        await EnsureMrxRevisionSchemaAsync(context);
        var schedule = await context.Menuschedules.Include(item => item.Menu).ThenInclude(menu => menu.Menuitems).ThenInclude(item => item.Dish)
            .SingleAsync(item => item.ServiceDate == new DateOnly(2026, 6, 15));
        var sourceLine = await context.Mealquantityplanlines.SingleAsync(item => item.MenuScheduleId == schedule.MenuScheduleId);
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
        var batch = new ReconciliationBatch
        {
            BatchId = GuidHelper.NewId(), MenuVersionId = baseVersion.MenuVersionId, QuantityImportBatchId = GuidHelper.NewId(),
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

        var result = await service.DecideMrxAsync(request.MenuAmendmentId,
            new ReviewMenuAmendmentRequest { Approved = true }, adminId);

        result.Status.Should().Be("EXECUTED");
        var revision = await context.Reconciliationsourcerevisions.Include(item => item.Deltas).SingleAsync();
        revision.MenuAmendmentId.Should().Equal(GuidHelper.ParseGuidString(request.MenuAmendmentId)!);
        revision.AppliedMenuVersionId.Should().Equal(GuidHelper.ParseGuidString(result.AppliedMenuVersionId)!);
        revision.Deltas.Should().HaveCount(2);
        revision.Deltas.Should().ContainSingle(item => item.WorkKind == "SUPPLEMENTAL_ISSUE" && item.IngredientId.SequenceEqual(replacementIngredient.IngredientId));
        revision.Deltas.Should().ContainSingle(item => item.WorkKind == "RETURN_REQUIRED" && item.IngredientId.SequenceEqual(bom.IngredientId));
        revision.Deltas.Should().OnlyContain(item => item.Status == "PENDING");
        daily.RequiredQuantity.Should().Be(required);
        var placeholder = await context.Reconciliationbatchdailylines.SingleAsync(item => item.IngredientId == replacementIngredient.IngredientId);
        placeholder.RequiredQuantity.Should().Be(0);
        (await context.Reconciliationbatchcontributors.SingleAsync()).DishBomId.Should().Equal(bom.BomId);
        (await context.Reconciliationdailydispositions.SingleAsync()).InvalidatedAt.Should().NotBeNull();
    }

    [Fact]
    public async Task Admin_direct_confirmation_applies_previewed_change_with_same_actor()
    {
        await using var fixture = await WorkflowFixture.CreateAsync();
        await fixture.SeedMenuWithDemandAsync(includeMissingDish: false);
        await using var context = fixture.CreateContext();
        await EnsureMrxRevisionSchemaAsync(context);
        var schedule = await context.Menuschedules.SingleAsync(item => item.ServiceDate == new DateOnly(2026, 6, 15));
        var currentVersion = new MenuVersion { MenuVersionId = GuidHelper.NewId(), CustomerId = schedule.CustomerId, WeekStartDate = schedule.WeekStartDate, VersionNo = 1, Status = "ACTIVE", CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow };
        context.Menuversions.Add(currentVersion);
        schedule.MenuVersionId = currentVersion.MenuVersionId;
        await context.SaveChangesAsync();
        var sourceLine = await context.Mealquantityplanlines.AsNoTracking().SingleAsync(item => item.MenuScheduleId == schedule.MenuScheduleId);
        var adminId = await CreateApprovalActorAsync(context, "mrx-admin-direct");
        var service = new MenuAmendmentService(context);
        var command = new CreateMenuAmendmentRequest
        {
            CustomerId = fixture.CustomerIdString,
            WeekStartDate = schedule.WeekStartDate,
            ExpectedBaseMenuVersionId = GuidHelper.ToGuidString(currentVersion.MenuVersionId),
            Reason = "Admin xác nhận trực tiếp sau preview.",
            Lines = [new CreateMenuAmendmentLineRequest { ServiceDate = schedule.ServiceDate, ShiftName = schedule.ShiftName, DishSlot = "main", NewServings = sourceLine.FinalServings + 10 }]
        };
        (await service.PreviewMrxAsync(command)).Status.Should().Be("PREVIEW");

        var result = await service.ConfirmMrxAsync(command, adminId);

        result.Status.Should().Be("EXECUTED");
        (await context.Menuamendments.SingleAsync()).CreatedBy.Should().Equal(GuidHelper.ParseGuidString(adminId)!);
        (await context.Menuamendments.SingleAsync()).ExecutedBy.Should().Equal(GuidHelper.ParseGuidString(adminId)!);
        (await context.Quantityadjustments.CountAsync()).Should().Be(1);
    }

    [Fact]
    public async Task Admin_approval_applies_specialist_serving_change_and_records_one_source_version()
    {
        await using var fixture = await WorkflowFixture.CreateAsync();
        await fixture.SeedMenuWithDemandAsync(includeMissingDish: false);
        await using var context = fixture.CreateContext();
        var schedule = await context.Menuschedules.AsNoTracking().SingleAsync(item => item.ServiceDate == new DateOnly(2026, 6, 15));
        var sourceLine = await context.Mealquantityplanlines.AsNoTracking().SingleAsync(item => item.MenuScheduleId == schedule.MenuScheduleId);
        var requestedServings = sourceLine.FinalServings + 30;
        var service = new MenuAmendmentService(context);
        var request = await service.CreateAsync(new CreateMenuAmendmentRequest
        {
            CustomerId = fixture.CustomerIdString,
            WeekStartDate = schedule.WeekStartDate,
            Reason = "Chuyên viên đề nghị tăng số suất.",
            Lines = [new CreateMenuAmendmentLineRequest { ServiceDate = schedule.ServiceDate, ShiftName = schedule.ShiftName, DishSlot = "main", NewServings = requestedServings }]
        }, fixture.UserIdString);
        var adminId = await CreateApprovalActorAsync(context, "mrx-admin-approve");

        var result = await service.DecideMrxAsync(request.MenuAmendmentId, new ReviewMenuAmendmentRequest { Approved = true, Reason = "Đã xác nhận với khách hàng." }, adminId);

        result.Status.Should().Be("EXECUTED");
        (await context.Mealquantityplanlines.AsNoTracking().SingleAsync(item => item.QuantityPlanLineId == sourceLine.QuantityPlanLineId)).FinalServings.Should().Be(requestedServings);
        (await context.Menuversions.CountAsync()).Should().Be(1);
        var revision = await context.Quantityadjustments.AsNoTracking().SingleAsync();
        revision.OldServings.Should().Be(sourceLine.FinalServings);
        revision.NewServings.Should().Be(requestedServings);
        (await context.Auditlogs.AnyAsync(item => item.EntityName == nameof(MealQuantityPlanLine) && item.FieldName == nameof(MealQuantityPlanLine.FinalServings) && item.ChangedBy.SequenceEqual(GuidHelper.ParseGuidString(adminId)!))).Should().BeTrue();
        Func<Task> duplicateApproval = () => service.DecideMrxAsync(request.MenuAmendmentId, new ReviewMenuAmendmentRequest { Approved = true }, adminId);
        await duplicateApproval.Should().ThrowAsync<BusinessRuleException>().WithMessage("*không còn chờ*");
        (await context.Menuversions.CountAsync()).Should().Be(1);
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
        var baseVersion = new MenuVersion { MenuVersionId = GuidHelper.NewId(), CustomerId = schedule.CustomerId, WeekStartDate = schedule.WeekStartDate, VersionNo = 1, Status = "ACTIVE", CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow };
        context.Menuversions.Add(baseVersion);
        schedule.MenuVersionId = baseVersion.MenuVersionId;
        context.Reconciliationbatches.Add(new ReconciliationBatch { BatchId = GuidHelper.NewId(), MenuVersionId = baseVersion.MenuVersionId, QuantityImportBatchId = GuidHelper.NewId(), Status = "DRAFT", Version = 1, CreatedBy = fixture.UserId, CreatedAt = DateTime.UtcNow });
        context.Reconciliationtolerances.Add(new ReconciliationTolerance { ToleranceId = GuidHelper.NewId(), ScopeKind = "SYSTEM_DEFAULT", Value = 0.5m, Version = 1, CreatedBy = fixture.UserId, CreatedAt = DateTime.UtcNow });
        await context.SaveChangesAsync();
        var request = await new MenuAmendmentService(context).CreateAsync(new CreateMenuAmendmentRequest
        {
            CustomerId = fixture.CustomerIdString, WeekStartDate = schedule.WeekStartDate, Reason = "Kiểm tra rollback sau staging.",
            Lines = [new CreateMenuAmendmentLineRequest { ServiceDate = schedule.ServiceDate, ShiftName = schedule.ShiftName, DishSlot = "main", NewServings = originalServings + 10 }]
        }, fixture.UserIdString);
        var adminId = await CreateApprovalActorAsync(context, "mrx-admin-rollback");
        var service = new MenuAmendmentService(context, new FailAfterOperationTransactionRunner(context), new ReconciliationSourceRevisionService(context));

        Func<Task> approval = () => service.DecideMrxAsync(request.MenuAmendmentId, new ReviewMenuAmendmentRequest { Approved = true }, adminId);

        await approval.Should().ThrowAsync<InvalidOperationException>().WithMessage("forced failure after staging");
        context.ChangeTracker.Clear();
        (await context.Menuamendments.SingleAsync()).Status.Should().Be("PENDING_REVIEW");
        (await context.Mealquantityplanlines.SingleAsync()).FinalServings.Should().Be(originalServings);
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
        var schedule = await setupContext.Menuschedules.AsNoTracking().SingleAsync(item => item.ServiceDate == new DateOnly(2026, 6, 15));
        var sourceLine = await setupContext.Mealquantityplanlines.AsNoTracking().SingleAsync(item => item.MenuScheduleId == schedule.MenuScheduleId);
        var request = await new MenuAmendmentService(setupContext).CreateAsync(new CreateMenuAmendmentRequest
        {
            CustomerId = fixture.CustomerIdString,
            WeekStartDate = schedule.WeekStartDate,
            Reason = "Kiểm tra hàng rào phê duyệt đồng thời.",
            Lines = [new CreateMenuAmendmentLineRequest { ServiceDate = schedule.ServiceDate, ShiftName = schedule.ShiftName, DishSlot = "main", NewServings = sourceLine.FinalServings + 15 }]
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
                    request.MenuAmendmentId, new ReviewMenuAmendmentRequest { Approved = true }, adminId));
            });
            var second = Task.Run(async () =>
            {
                await gate.Task;
                return await Record.ExceptionAsync(() => new MenuAmendmentService(secondContext).DecideMrxAsync(
                    request.MenuAmendmentId, new ReviewMenuAmendmentRequest { Approved = true }, adminId));
            });
            gate.SetResult();
            var outcomes = await Task.WhenAll(first, second);

            outcomes.Count(item => item is null).Should().Be(1);
            outcomes.OfType<BusinessRuleException>().Should().ContainSingle()
                .Which.Message.Should().Contain("không còn chờ");
            await using var verifyContext = new IpcManagementContext(options);
            (await verifyContext.Menuversions.CountAsync()).Should().Be(1);
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
        var schedule = await context.Menuschedules.AsNoTracking().Include(item => item.Menu).ThenInclude(menu => menu.Menuitems).SingleAsync(item => item.ServiceDate == new DateOnly(2026, 6, 15));
        var sourceLine = await context.Mealquantityplanlines.AsNoTracking().SingleAsync(item => item.MenuScheduleId == schedule.MenuScheduleId);
        var service = new MenuAmendmentService(context);
        var request = await service.CreateAsync(new CreateMenuAmendmentRequest
        {
            CustomerId = fixture.CustomerIdString,
            WeekStartDate = schedule.WeekStartDate,
            Reason = "Chuyên viên đề nghị tăng số suất.",
            Lines = [new CreateMenuAmendmentLineRequest { ServiceDate = schedule.ServiceDate, ShiftName = schedule.ShiftName, DishSlot = "main", NewServings = sourceLine.FinalServings + 20 }]
        }, fixture.UserIdString);
        var adminId = await CreateApprovalActorAsync(context, "mrx-admin-reject");
        var inboxItem = (await service.GetMrxInboxAsync()).Should().ContainSingle().Subject;
        inboxItem.ImpactLines.Should().ContainSingle().Which.NewServings.Should().Be(sourceLine.FinalServings + 20);

        var result = await service.DecideMrxAsync(request.MenuAmendmentId, new ReviewMenuAmendmentRequest { Approved = false, Reason = "Khách hàng không xác nhận." }, adminId);

        result.Status.Should().Be("REJECTED");
        (await context.Mealquantityplanlines.AsNoTracking().SingleAsync(item => item.QuantityPlanLineId == sourceLine.QuantityPlanLineId)).FinalServings.Should().Be(sourceLine.FinalServings);
        (await context.Menuversions.CountAsync()).Should().Be(0);
        (await context.Auditlogs.SingleAsync(item => item.EntityName == nameof(MenuAmendment) && item.NewValue == "REJECTED")).ChangedBy.Should().Equal(GuidHelper.ParseGuidString(adminId)!);
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

    private static Task EnsureMrxRevisionSchemaAsync(IpcManagementContext context) => context.Database.ExecuteSqlRawAsync("""
        CREATE TABLE reconciliationbatches (batchId BLOB PRIMARY KEY, menuVersionId BLOB NOT NULL, quantityImportBatchId BLOB NOT NULL, status TEXT NOT NULL, version INTEGER NOT NULL, createdBy BLOB NOT NULL, createdAt TEXT NOT NULL, readyBy BLOB NULL, readyAt TEXT NULL, completedBy BLOB NULL, completedAt TEXT NULL);
        CREATE TABLE reconciliationbatchlines (batchLineId BLOB PRIMARY KEY, batchId BLOB NOT NULL, ingredientId BLOB NOT NULL, canonicalUnitId BLOB NOT NULL, requiredQuantity TEXT NOT NULL, frozenTolerance TEXT NOT NULL, toleranceSourceKind TEXT NOT NULL, toleranceSourceVersion TEXT NOT NULL, version INTEGER NOT NULL);
        CREATE TABLE reconciliationbatchdailylines (dailyLineId BLOB PRIMARY KEY, batchLineId BLOB NOT NULL, batchId BLOB NOT NULL, ingredientId BLOB NOT NULL, canonicalUnitId BLOB NOT NULL, serviceDate TEXT NOT NULL, requiredQuantity TEXT NOT NULL, version INTEGER NOT NULL);
        CREATE TABLE reconciliationbatchcontributors (contributorId BLOB PRIMARY KEY, batchLineId BLOB NOT NULL, dailyLineId BLOB NULL, menuScheduleId BLOB NOT NULL, mealQuantityPlanLineId BLOB NOT NULL, dishBomId BLOB NOT NULL, dishId BLOB NULL, frozenShiftName TEXT NOT NULL, frozenDishCode TEXT NULL, frozenDishName TEXT NULL, frozenServings INTEGER NULL, frozenBomQuantityPerServing TEXT NULL, frozenWasteRatePercent TEXT NULL, sourceQuantity TEXT NOT NULL, FrozenMenuVariant TEXT NULL);
        CREATE TABLE reconciliationtolerances (toleranceId BLOB PRIMARY KEY, scopeKind TEXT NOT NULL, scopeId BLOB NULL, value TEXT NOT NULL, version INTEGER NOT NULL, createdBy BLOB NOT NULL, createdAt TEXT NOT NULL, systemDefaultKey INTEGER NULL);
        CREATE TABLE reconciliationdailydispositions (dispositionId BLOB PRIMARY KEY, dailyLineId BLOB NOT NULL, category TEXT NOT NULL, reason TEXT NOT NULL, version INTEGER NOT NULL, disposedBy BLOB NOT NULL, disposedAt TEXT NOT NULL, invalidatedAt TEXT NULL, invalidatedBy BLOB NULL, invalidationReason TEXT NULL);
        CREATE TABLE reconciliationsourcerevisions (sourceRevisionId BLOB PRIMARY KEY, menuAmendmentId BLOB NOT NULL, batchId BLOB NOT NULL, previousMenuVersionId BLOB NOT NULL, appliedMenuVersionId BLOB NOT NULL, revisionNumber INTEGER NOT NULL, status TEXT NOT NULL, reason TEXT NOT NULL, appliedBy BLOB NOT NULL, appliedAt TEXT NOT NULL, AppliedByRole TEXT NULL, ApplyMode TEXT NULL, UNIQUE (menuAmendmentId, batchId), UNIQUE (batchId, revisionNumber));
        CREATE TABLE reconciliationsourcedeltas (sourceDeltaId BLOB PRIMARY KEY, sourceRevisionId BLOB NOT NULL, batchId BLOB NOT NULL, dailyLineId BLOB NULL, serviceDate TEXT NOT NULL, ingredientId BLOB NOT NULL, canonicalUnitId BLOB NOT NULL, previousRequiredQuantity TEXT NOT NULL, newRequiredQuantity TEXT NOT NULL, deltaQuantity TEXT NOT NULL, workKind TEXT NOT NULL, status TEXT NOT NULL, version INTEGER NOT NULL, createdAt TEXT NOT NULL, resolvedAt TEXT NULL, resolvedBy BLOB NULL, resolutionEntity TEXT NULL, resolutionId BLOB NULL, resolutionCommandId TEXT NULL);
        """);
}
