using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using FluentAssertions;
using IPCManagement.Api.Data;
using IPCManagement.Api.Helpers;
using IPCManagement.Api.Models.DTOs.Approvals;
using IPCManagement.Api.Models.DTOs.Coordination;
using IPCManagement.Api.Models.DTOs.Workflow;
using IPCManagement.Api.Models.Entities;
using IPCManagement.Api.Services;
using IPCManagement.Api.Services.Approvals;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Xunit;
using NSubstitute;
using IPCManagement.Api.Services.Workflow;

namespace IPCManagement.Api.Tests;

public class CoordinationTransactionTests
{
    [Fact]
    public async Task LockOrderPlanAsync_Should_Rollback_LineAndPlanChanges_When_SaveChanges_Fails()
    {
        // Arrange
        using var connection = new SqliteConnection("Data Source=:memory:");
        await connection.OpenAsync();

        var options = BuildOptions(connection, new ThrowOnMealquantityplanSaveChangesInterceptor());
        await CreateMinimalSchemaAsync(connection);

        var fixture = SeedAdjustServingsFixture(options, confirmedPlan: false);

        var materialDemandService = Substitute.For<IMaterialDemandService>();
        var service = new CoordinationService(new IpcManagementContext(options), materialDemandService);
        var request = new LockOrderPlanRequestDto
        {
            ServiceDate = "2026-06-15",
            Scope = "FULLDAY",
            Lines =
            [
                new LockOrderPlanLineDto
                {
                    QuantityPlanLineId = GuidHelper.ToGuidString(fixture.LineId),
                    FinalServings = 140
                }
            ]
        };

        // Act
        Func<Task> act = async () => await service.LockOrderPlanAsync(request, fixture.UserId);

        // Assert
        await act.Should().ThrowAsync<InvalidOperationException>()
            .WithMessage("*Simulated lock failure*");

        await using var verifyContext = new IpcManagementContext(BuildOptions(connection));
        var persistedPlan = await verifyContext.Mealquantityplans
            .AsNoTracking()
            .FirstAsync(item => item.QuantityPlanId == fixture.PlanId);
        var persistedLine = await verifyContext.Mealquantityplanlines
            .AsNoTracking()
            .FirstAsync(item => item.QuantityPlanLineId == fixture.LineId);

        persistedPlan.Status.Should().Be("DRAFT");
        persistedPlan.ConfirmedAt.Should().BeNull();
        persistedLine.FinalServings.Should().Be(100);
        persistedLine.ConfirmedServings.Should().Be(100);
    }

    [Fact]
    public async Task AdjustServingsAsync_Should_BlockDirectPostLockAdjustment()
    {
        // Arrange
        using var connection = new SqliteConnection("Data Source=:memory:");
        await connection.OpenAsync();

        var options = BuildOptions(connection);

        await CreateMinimalSchemaAsync(connection);

        var fixture = SeedAdjustServingsFixture(options, confirmedPlan: true);
        var lineId = GuidHelper.ToGuidString(fixture.LineId);

        var materialDemandService = Substitute.For<IMaterialDemandService>();
        var service = new CoordinationService(new IpcManagementContext(options), materialDemandService);

        var request = new AdjustServingsRequestDto
        {
            ServingsQuantity = 120,
            Reason = "Điều chỉnh trực tiếp không qua duyệt"
        };

        // Act
        Func<Task> act = async () => await service.AdjustServingsAsync(lineId, request, fixture.UserId);

        // Assert
        await act.Should().ThrowAsync<InvalidOperationException>()
            .WithMessage("Không thể điều chỉnh trực tiếp sau khi chốt. Hãy gửi yêu cầu duyệt điều chỉnh.");

        await using var verifyContext = new IpcManagementContext(BuildOptions(connection));
        var persistedLine = await verifyContext.Mealquantityplanlines
            .AsNoTracking()
            .FirstAsync(item => item.QuantityPlanLineId == fixture.LineId);

        persistedLine.FinalServings.Should().Be(100);
        persistedLine.AdjustedServings.Should().Be(0);
        (await verifyContext.Auditlogs.AsNoTracking().CountAsync()).Should().Be(0);
    }

    [Fact]
    public async Task UpdateForecastServingsAsync_Should_Update_DraftForecastAndAudit()
    {
        // Arrange
        using var connection = new SqliteConnection("Data Source=:memory:");
        await connection.OpenAsync();

        var options = BuildOptions(connection);
        await CreateMinimalSchemaAsync(connection);

        var fixture = SeedAdjustServingsFixture(options, confirmedPlan: false);
        var lineId = GuidHelper.ToGuidString(fixture.LineId);

        var materialDemandService = Substitute.For<IMaterialDemandService>();
        var service = new CoordinationService(new IpcManagementContext(options), materialDemandService);

        var request = new UpdateForecastServingsRequestDto
        {
            ServingsQuantity = 135,
            Reason = "Nhập tay số suất trước chốt"
        };

        // Act
        var result = await service.UpdateForecastServingsAsync(lineId, request, fixture.UserId);

        // Assert
        result.Should().NotBeNull();
        result!.OldServings.Should().Be(100);
        result.NewServings.Should().Be(135);

        await using var verifyContext = new IpcManagementContext(BuildOptions(connection));
        var persistedLine = await verifyContext.Mealquantityplanlines
            .AsNoTracking()
            .FirstAsync(item => item.QuantityPlanLineId == fixture.LineId);
        var audit = await verifyContext.Auditlogs
            .AsNoTracking()
            .SingleAsync();

        persistedLine.ForecastServings.Should().Be(135);
        persistedLine.FinalServings.Should().Be(135);
        persistedLine.ConfirmedServings.Should().Be(100);
        audit.FieldName.Should().Be("forecastServings");
        audit.OldValue.Should().Be("100");
        audit.NewValue.Should().Be("135");
    }

    [Fact]
    public async Task UpdateForecastServingsAsync_Should_BlockNegativeForecast_AndKeepExistingValues()
    {
        using var connection = new SqliteConnection("Data Source=:memory:");
        await connection.OpenAsync();

        var options = BuildOptions(connection);
        await CreateMinimalSchemaAsync(connection);

        var fixture = SeedAdjustServingsFixture(options, confirmedPlan: false);
        var lineId = GuidHelper.ToGuidString(fixture.LineId);
        var materialDemandService = Substitute.For<IMaterialDemandService>();
        var service = new CoordinationService(new IpcManagementContext(options), materialDemandService);

        var act = async () => await service.UpdateForecastServingsAsync(
            lineId,
            new UpdateForecastServingsRequestDto
            {
                ServingsQuantity = -1,
                Reason = "Nhập sai"
            },
            fixture.UserId);

        await act.Should().ThrowAsync<ArgumentException>()
            .WithMessage("Số suất dự kiến phải lớn hơn hoặc bằng 0.");

        await using var verifyContext = new IpcManagementContext(BuildOptions(connection));
        var persistedLine = await verifyContext.Mealquantityplanlines
            .AsNoTracking()
            .FirstAsync(item => item.QuantityPlanLineId == fixture.LineId);
        persistedLine.ForecastServings.Should().Be(100);
        persistedLine.FinalServings.Should().Be(100);
        (await verifyContext.Auditlogs.AsNoTracking().CountAsync()).Should().Be(0);
    }

    [Fact]
    public async Task LockOrderPlanAsync_Should_LockPlanAndBlockDirectForecastEdits()
    {
        using var connection = new SqliteConnection("Data Source=:memory:");
        await connection.OpenAsync();

        var options = BuildOptions(connection);
        await CreateMinimalSchemaAsync(connection);

        var fixture = SeedAdjustServingsFixture(options, confirmedPlan: false);
        var lineId = GuidHelper.ToGuidString(fixture.LineId);
        var materialDemandService = Substitute.For<IMaterialDemandService>();
        var service = new CoordinationService(new IpcManagementContext(options), materialDemandService);

        var lockResult = await service.LockOrderPlanAsync(
            new LockOrderPlanRequestDto
            {
                ServiceDate = "2026-06-15",
                Scope = "FULLDAY",
                Lines =
                [
                    new LockOrderPlanLineDto
                    {
                        QuantityPlanLineId = lineId,
                        FinalServings = 140
                    }
                ]
            },
            fixture.UserId);

        lockResult.Should().NotBeNull();
        await using (var verifyContext = new IpcManagementContext(BuildOptions(connection)))
        {
            var persistedPlan = await verifyContext.Mealquantityplans.AsNoTracking().SingleAsync();
            var persistedLine = await verifyContext.Mealquantityplanlines.AsNoTracking().SingleAsync();

            persistedPlan.Status.Should().Be(OrderStatus.Confirmed);
            persistedLine.ConfirmedServings.Should().Be(140);
            persistedLine.FinalServings.Should().Be(140);
        }

        var directForecastEdit = async () => await service.UpdateForecastServingsAsync(
            lineId,
            new UpdateForecastServingsRequestDto
            {
                ServingsQuantity = 150,
                Reason = "Không được sửa trực tiếp sau khóa"
            },
            fixture.UserId);

        await directForecastEdit.Should().ThrowAsync<InvalidOperationException>()
            .WithMessage("Chỉ có thể cập nhật số suất dự kiến trước khi kế hoạch được chốt.");
    }

    [Fact]
    public async Task LockOrderPlanAsync_Should_Not_DowngradeCompletedPlan()
    {
        using var connection = new SqliteConnection("Data Source=:memory:");
        await connection.OpenAsync();

        var options = BuildOptions(connection);
        await CreateMinimalSchemaAsync(connection);
        var fixture = SeedAdjustServingsFixture(options, confirmedPlan: true);

        await using (var arrangeContext = new IpcManagementContext(options))
        {
            var plan = await arrangeContext.Mealquantityplans.SingleAsync();
            plan.Status = OrderStatus.Completed;
            plan.CompletedAt = DateTime.UtcNow;
            await arrangeContext.SaveChangesAsync();
        }

        var service = new CoordinationService(
            new IpcManagementContext(options),
            Substitute.For<IMaterialDemandService>());
        var act = async () => await service.LockOrderPlanAsync(
            new LockOrderPlanRequestDto
            {
                ServiceDate = "2026-06-15",
                Scope = "MORNING",
                ShiftName = "MORNING",
                Lines =
                [
                    new LockOrderPlanLineDto
                    {
                        QuantityPlanLineId = GuidHelper.ToGuidString(fixture.LineId),
                        FinalServings = 140
                    }
                ]
            },
            fixture.UserId);

        await act.Should().ThrowAsync<InvalidOperationException>()
            .WithMessage("Chỉ có thể chốt kế hoạch đang ở trạng thái nháp hoặc dự báo.*");

        await using var verifyContext = new IpcManagementContext(options);
        var persistedPlan = await verifyContext.Mealquantityplans.AsNoTracking().SingleAsync();
        persistedPlan.Status.Should().Be(OrderStatus.Completed);
    }

    [Theory]
    [InlineData(OrderStatus.Draft)]
    [InlineData(OrderStatus.Forecasted)]
    public async Task LockOrderPlanAsync_Should_AllowEveryLegalSourceStatus(string sourceStatus)
    {
        using var connection = new SqliteConnection("Data Source=:memory:");
        await connection.OpenAsync();
        var options = BuildOptions(connection);
        await CreateMinimalSchemaAsync(connection);
        var fixture = SeedAdjustServingsFixture(options, false, planStatus: sourceStatus);
        var service = new CoordinationService(new IpcManagementContext(options), Substitute.For<IMaterialDemandService>());

        var result = await service.LockOrderPlanAsync(
            new LockOrderPlanRequestDto { ServiceDate = "2026-06-15", Scope = "FULLDAY" },
            fixture.UserId);

        result.Should().NotBeNull();
        result!.LockedLineCount.Should().Be(1);
        await using var verifyContext = new IpcManagementContext(options);
        (await verifyContext.Mealquantityplans.AsNoTracking().SingleAsync()).Status
            .Should().Be(OrderStatus.Confirmed);
    }

    [Theory]
    [InlineData(OrderStatus.Confirmed)]
    [InlineData(OrderStatus.Adjusted)]
    [InlineData(OrderStatus.Completed)]
    [InlineData(OrderStatus.Archived)]
    [InlineData(OrderStatus.Cancelled)]
    public async Task LockOrderPlanAsync_Should_RejectEveryIllegalSourceStatus(string sourceStatus)
    {
        using var connection = new SqliteConnection("Data Source=:memory:");
        await connection.OpenAsync();
        var options = BuildOptions(connection);
        await CreateMinimalSchemaAsync(connection);
        var fixture = SeedAdjustServingsFixture(options, false, planStatus: sourceStatus);
        var service = new CoordinationService(new IpcManagementContext(options), Substitute.For<IMaterialDemandService>());

        var act = async () => await service.LockOrderPlanAsync(
            new LockOrderPlanRequestDto { ServiceDate = "2026-06-15", Scope = "FULLDAY" },
            fixture.UserId);

        await act.Should().ThrowAsync<InvalidOperationException>();
        await using var verifyContext = new IpcManagementContext(options);
        (await verifyContext.Mealquantityplans.AsNoTracking().SingleAsync()).Status
            .Should().Be(sourceStatus);
    }

    [Fact]
    public async Task LockOrderPlanAsync_FullDay_Should_LockBothShiftsAndUseRequestedOrForecastServings()
    {
        using var connection = new SqliteConnection("Data Source=:memory:");
        await connection.OpenAsync();
        var options = BuildOptions(connection);
        await CreateMinimalSchemaAsync(connection);
        var morning = SeedAdjustServingsFixture(options, false, suffix: "101", shiftName: "MORNING");
        SeedAdjustServingsFixture(options, false, suffix: "102", shiftName: "AFTERNOON", planStatus: OrderStatus.Forecasted);
        var service = new CoordinationService(new IpcManagementContext(options), Substitute.For<IMaterialDemandService>());

        var result = await service.LockOrderPlanAsync(
            new LockOrderPlanRequestDto
            {
                ServiceDate = "2026-06-15",
                Scope = "FULLDAY",
                Lines =
                [
                    new LockOrderPlanLineDto
                    {
                        QuantityPlanLineId = GuidHelper.ToGuidString(morning.LineId),
                        FinalServings = 140
                    }
                ]
            },
            morning.UserId);

        result.Should().NotBeNull();
        result!.LockedLineCount.Should().Be(2);
        result.LockedShiftNames.Should().BeEquivalentTo(["MORNING", "AFTERNOON"]);

        await using var verifyContext = new IpcManagementContext(options);
        (await verifyContext.Mealquantityplans.AsNoTracking().Select(plan => plan.Status).ToListAsync())
            .Should().OnlyContain(status => status == OrderStatus.Confirmed);
        var lines = await verifyContext.Mealquantityplanlines.AsNoTracking().OrderBy(line => line.ShiftName).ToListAsync();
        lines.Single(line => line.ShiftName == "MORNING").FinalServings.Should().Be(140);
        lines.Single(line => line.ShiftName == "AFTERNOON").FinalServings.Should().Be(100);
    }

    [Fact]
    public async Task LockOrderPlanAsync_Should_HandleMissingUserInvalidShiftAndMissingPlans()
    {
        using var connection = new SqliteConnection("Data Source=:memory:");
        await connection.OpenAsync();
        var options = BuildOptions(connection);
        await CreateMinimalSchemaAsync(connection);
        var service = new CoordinationService(new IpcManagementContext(options), Substitute.For<IMaterialDemandService>());

        (await service.LockOrderPlanAsync(
            new LockOrderPlanRequestDto { ServiceDate = "2026-06-15", Scope = "FULLDAY" },
            null)).Should().BeNull();

        var invalidShift = async () => await service.LockOrderPlanAsync(
            new LockOrderPlanRequestDto { ServiceDate = "2026-06-15", Scope = "MORNING", ShiftName = "INVALID" },
            Guid.NewGuid().ToString());
        await invalidShift.Should().ThrowAsync<ArgumentException>();

        (await service.LockOrderPlanAsync(
            new LockOrderPlanRequestDto { ServiceDate = "2026-06-15", Scope = "FULLDAY" },
            Guid.NewGuid().ToString())).Should().BeNull();
    }

    [Fact]
    public async Task AdjustOrderAfterLockAsync_Should_BlockDuplicatePendingAdjustment()
    {
        using var connection = new SqliteConnection("Data Source=:memory:");
        await connection.OpenAsync();

        var options = BuildOptions(connection);
        await CreateMinimalSchemaAsync(connection);

        var fixture = SeedAdjustServingsFixture(options, confirmedPlan: true);
        var lineId = GuidHelper.ToGuidString(fixture.LineId);
        var materialDemandService = Substitute.For<IMaterialDemandService>();
        var service = new CoordinationService(new IpcManagementContext(options), materialDemandService);

        var first = await service.AdjustOrderAfterLockAsync(
            new AdjustOrderAfterLockRequestDto
            {
                OrderId = lineId,
                Field = "actualQuantity",
                NewValue = 125,
                Reason = "Khách tăng suất sau chốt"
            },
            fixture.UserId);

        first.Should().NotBeNull();

        var duplicate = async () => await service.AdjustOrderAfterLockAsync(
            new AdjustOrderAfterLockRequestDto
            {
                OrderId = lineId,
                Field = "actualQuantity",
                NewValue = 130,
                Reason = "Gửi trùng khi chưa duyệt"
            },
            fixture.UserId);

        await duplicate.Should().ThrowAsync<InvalidOperationException>()
            .WithMessage("Dòng này đang có yêu cầu điều chỉnh chờ duyệt.");

        await using var verifyContext = new IpcManagementContext(BuildOptions(connection));
        var persistedLine = await verifyContext.Mealquantityplanlines.AsNoTracking().SingleAsync();
        var pendingCount = await verifyContext.Quantityadjustments.AsNoTracking().CountAsync();

        pendingCount.Should().Be(1);
        persistedLine.FinalServings.Should().Be(100);
        persistedLine.AdjustedServings.Should().Be(0);
    }

    [Fact]
    public async Task AdjustOrderAfterLockAsync_Should_CreatePendingApproval_AndKeepLockedServings()
    {
        using var connection = new SqliteConnection("Data Source=:memory:");
        await connection.OpenAsync();

        var options = BuildOptions(connection);
        await CreateMinimalSchemaAsync(connection);

        var fixture = SeedAdjustServingsFixture(options, confirmedPlan: true);
        var lineId = GuidHelper.ToGuidString(fixture.LineId);
        var materialDemandService = Substitute.For<IMaterialDemandService>();
        var service = new CoordinationService(new IpcManagementContext(options), materialDemandService);

        var result = await service.AdjustOrderAfterLockAsync(
            new AdjustOrderAfterLockRequestDto
            {
                OrderId = lineId,
                Field = "actualQuantity",
                NewValue = 125,
                Reason = "Khách tăng suất sau chốt"
            },
            fixture.UserId);

        result.Should().NotBeNull();
        result!.RequiresApproval.Should().BeTrue();
        result.ApprovalStatus.Should().Be("PENDING");
        result.ApprovalTargetType.Should().Be("order-adjustment");
        result.OldValue.Should().Be(100);
        result.NewValue.Should().Be(125);

        await using var verifyContext = new IpcManagementContext(BuildOptions(connection));
        var persistedLine = await verifyContext.Mealquantityplanlines.AsNoTracking().SingleAsync();
        var pendingAdjustment = await verifyContext.Quantityadjustments.AsNoTracking().SingleAsync();

        persistedLine.FinalServings.Should().Be(100);
        persistedLine.AdjustedServings.Should().Be(0);
        pendingAdjustment.OldServings.Should().Be(100);
        pendingAdjustment.NewServings.Should().Be(125);
    }

    [Fact]
    public async Task OrderAdjustmentApproval_Should_ApplyServingsAndWaitForSignoff_WhenApproved()
    {
        using var connection = new SqliteConnection("Data Source=:memory:");
        await connection.OpenAsync();

        var options = BuildOptions(connection);
        await CreateMinimalSchemaAsync(connection);

        var fixture = SeedAdjustServingsFixture(options, confirmedPlan: true);
        var lineId = GuidHelper.ToGuidString(fixture.LineId);
        var materialDemandService = Substitute.For<IMaterialDemandService>();
        var coordinationService = new CoordinationService(new IpcManagementContext(options), materialDemandService);
        var pending = await coordinationService.AdjustOrderAfterLockAsync(
            new AdjustOrderAfterLockRequestDto
            {
                OrderId = lineId,
                Field = "actualQuantity",
                NewValue = 130,
                Reason = "Khách tăng suất sau chốt"
            },
            fixture.UserId);

        await using var approvalContext = new IpcManagementContext(BuildOptions(connection));
        var handler = new InventoryAdjustmentApprovalHandler(approvalContext);

        var approval = await handler.HandleAsync(
            pending!.ApprovalTargetId,
            new ApprovalRequestDto
            {
                Status = ApprovalDecision.Approve,
                Reason = "Đã kiểm tra"
            },
            GuidHelper.ParseGuidString(fixture.UserId)!);

        approval.Should().NotBeNull();
        approval!.TargetType.Should().Be("order-adjustment");
        approval.NewStatus.Should().Be("APPROVED");

        await using var verifyContext = new IpcManagementContext(BuildOptions(connection));
        var persistedPlan = await verifyContext.Mealquantityplans.AsNoTracking().SingleAsync();
        var persistedLine = await verifyContext.Mealquantityplanlines.AsNoTracking().SingleAsync();
        var audit = await verifyContext.Auditlogs.AsNoTracking().SingleAsync();
        var history = await verifyContext.Approvalhistories.AsNoTracking().SingleAsync();

        persistedPlan.Status.Should().Be(OrderStatus.Adjusted);
        persistedLine.ConfirmedServings.Should().Be(100);
        persistedLine.AdjustedServings.Should().Be(30);
        persistedLine.FinalServings.Should().Be(130);
        audit.FieldName.Should().Be("finalServings");
        audit.OldValue.Should().Be("100");
        audit.NewValue.Should().Be("130");
        history.TargetType.Should().Be("order-adjustment");
        history.Decision.Should().Be("APPROVE");

        await materialDemandService.DidNotReceiveWithAnyArgs().GenerateAsync(default!, default);
    }

    [Fact]
    public async Task OrderAdjustmentApproval_Should_KeepServings_WhenRejected()
    {
        using var connection = new SqliteConnection("Data Source=:memory:");
        await connection.OpenAsync();

        var options = BuildOptions(connection);
        await CreateMinimalSchemaAsync(connection);

        var fixture = SeedAdjustServingsFixture(options, confirmedPlan: true);
        var lineId = GuidHelper.ToGuidString(fixture.LineId);
        var materialDemandService = Substitute.For<IMaterialDemandService>();
        var coordinationService = new CoordinationService(new IpcManagementContext(options), materialDemandService);
        var pending = await coordinationService.AdjustOrderAfterLockAsync(
            new AdjustOrderAfterLockRequestDto
            {
                OrderId = lineId,
                Field = "actualQuantity",
                NewValue = 130,
                Reason = "Khách tăng suất sau chốt"
            },
            fixture.UserId);

        await using var approvalContext = new IpcManagementContext(BuildOptions(connection));
        var handler = new InventoryAdjustmentApprovalHandler(approvalContext);

        var rejection = await handler.HandleAsync(
            pending!.ApprovalTargetId,
            new ApprovalRequestDto
            {
                Status = ApprovalDecision.Reject,
                Reason = "Không đủ căn cứ"
            },
            GuidHelper.ParseGuidString(fixture.UserId)!);

        rejection.Should().NotBeNull();
        rejection!.TargetType.Should().Be("order-adjustment");
        rejection.NewStatus.Should().Be("REJECTED");

        await using var verifyContext = new IpcManagementContext(BuildOptions(connection));
        var persistedPlan = await verifyContext.Mealquantityplans.AsNoTracking().SingleAsync();
        var persistedLine = await verifyContext.Mealquantityplanlines.AsNoTracking().SingleAsync();
        var history = await verifyContext.Approvalhistories.AsNoTracking().SingleAsync();

        persistedPlan.Status.Should().Be(OrderStatus.Confirmed);
        persistedLine.ConfirmedServings.Should().Be(100);
        persistedLine.AdjustedServings.Should().Be(0);
        persistedLine.FinalServings.Should().Be(100);
        history.Decision.Should().Be("REJECT");
        (await verifyContext.Auditlogs.AsNoTracking().CountAsync()).Should().Be(0);
        await materialDemandService.DidNotReceiveWithAnyArgs().GenerateAsync(default!, default);
    }

    [Fact]
    public async Task SignoffOrderAsync_Should_WriteAuditWithActor()
    {
        using var connection = new SqliteConnection("Data Source=:memory:");
        await connection.OpenAsync();

        var options = BuildOptions(connection);
        await CreateMinimalSchemaAsync(connection);

        var fixture = SeedAdjustServingsFixture(options, confirmedPlan: true);
        var planId = GuidHelper.ToGuidString(fixture.PlanId);
        var materialDemandService = Substitute.For<IMaterialDemandService>();
        var service = new CoordinationService(new IpcManagementContext(options), materialDemandService);

        var result = await service.SignoffOrderAsync(
            planId,
            new SignoffOrderRequestDto { Note = "Chốt số suất trước khi tạo demand" },
            fixture.UserId);

        result.Should().NotBeNull();
        result!.OldStatus.Should().Be(OrderStatus.Confirmed);
        result.NewStatus.Should().Be(OrderStatus.Completed);

        await using var verifyContext = new IpcManagementContext(BuildOptions(connection));
        var persistedPlan = await verifyContext.Mealquantityplans.AsNoTracking().SingleAsync();
        var audit = await verifyContext.Auditlogs.AsNoTracking().SingleAsync();

        persistedPlan.Status.Should().Be(OrderStatus.Completed);
        audit.BusinessArea.Should().Be("Coordination");
        audit.EntityName.Should().Be(nameof(MealQuantityPlan));
        audit.FieldName.Should().Be(nameof(MealQuantityPlan.Status));
        audit.OldValue.Should().Be(OrderStatus.Confirmed);
        audit.NewValue.Should().Be(OrderStatus.Completed);
        audit.ChangedBy.Should().Equal(GuidHelper.ParseGuidString(fixture.UserId)!);
        audit.Reason.Should().Be("Chốt số suất trước khi tạo demand");
    }

    [Fact]
    public async Task SignoffOrderScopeAsync_Should_CompleteSelectedShiftInOneTransaction()
    {
        using var connection = new SqliteConnection("Data Source=:memory:");
        await connection.OpenAsync();

        var options = BuildOptions(connection);
        await CreateMinimalSchemaAsync(connection);
        var fixture = SeedAdjustServingsFixture(options, confirmedPlan: true);
        var service = new CoordinationService(
            new IpcManagementContext(options),
            Substitute.For<IMaterialDemandService>());

        var result = await service.SignoffOrderScopeAsync(
            new CoordinationScopeActionRequestDto
            {
                ServiceDate = "2026-06-15",
                ShiftName = "MORNING",
                Note = "Hoàn tất ca kiểm thử"
            },
            fixture.UserId);

        result.Should().NotBeNull();
        result!.AffectedPlanCount.Should().Be(1);
        result.ShiftName.Should().Be("MORNING");
        result.NewStatus.Should().Be(OrderStatus.Completed);

        await using var verifyContext = new IpcManagementContext(options);
        (await verifyContext.Mealquantityplans.AsNoTracking().SingleAsync()).Status
            .Should().Be(OrderStatus.Completed);
        (await verifyContext.Auditlogs.AsNoTracking().SingleAsync()).Reason
            .Should().Be("Hoàn tất ca kiểm thử");
    }

    [Fact]
    public async Task UnlockOrderPlanScopeAsync_Should_UnlockSelectedShiftInOneTransaction()
    {
        using var connection = new SqliteConnection("Data Source=:memory:");
        await connection.OpenAsync();

        var options = BuildOptions(connection);
        await CreateMinimalSchemaAsync(connection);
        var fixture = SeedAdjustServingsFixture(options, confirmedPlan: true);
        var service = new CoordinationService(
            new IpcManagementContext(options),
            Substitute.For<IMaterialDemandService>());

        var result = await service.UnlockOrderPlanScopeAsync(
            new CoordinationScopeActionRequestDto
            {
                ServiceDate = "2026-06-15",
                ShiftName = "MORNING",
                Note = "Mở khóa ca kiểm thử"
            },
            fixture.UserId);

        result.Should().NotBeNull();
        result!.AffectedPlanCount.Should().Be(1);
        result.NewStatus.Should().Be(OrderStatus.Draft);

        await using var verifyContext = new IpcManagementContext(options);
        var plan = await verifyContext.Mealquantityplans.AsNoTracking().SingleAsync();
        plan.Status.Should().Be(OrderStatus.Draft);
        plan.ConfirmedAt.Should().BeNull();
        (await verifyContext.Auditlogs.AsNoTracking().SingleAsync()).NewValue
            .Should().Be(OrderStatus.Draft);
    }

    [Theory]
    [InlineData(OrderStatus.Confirmed)]
    [InlineData(OrderStatus.Adjusted)]
    public async Task SignoffOrderScopeAsync_Should_AllowEveryLegalSourceStatus(string sourceStatus)
    {
        using var connection = new SqliteConnection("Data Source=:memory:");
        await connection.OpenAsync();
        var options = BuildOptions(connection);
        await CreateMinimalSchemaAsync(connection);
        var fixture = SeedAdjustServingsFixture(options, false, planStatus: sourceStatus);
        var service = new CoordinationService(new IpcManagementContext(options), Substitute.For<IMaterialDemandService>());

        var result = await service.SignoffOrderScopeAsync(
            new CoordinationScopeActionRequestDto { ServiceDate = "2026-06-15", ShiftName = "MORNING" },
            fixture.UserId);

        result.Should().NotBeNull();
        result!.OldStatuses.Should().ContainSingle().Which.Should().Be(sourceStatus);
        result.NewStatus.Should().Be(OrderStatus.Completed);
    }

    [Theory]
    [InlineData(OrderStatus.Draft)]
    [InlineData(OrderStatus.Forecasted)]
    [InlineData(OrderStatus.Completed)]
    [InlineData(OrderStatus.Archived)]
    [InlineData(OrderStatus.Cancelled)]
    public async Task SignoffOrderScopeAsync_Should_RejectEveryIllegalSourceStatus(string sourceStatus)
    {
        using var connection = new SqliteConnection("Data Source=:memory:");
        await connection.OpenAsync();
        var options = BuildOptions(connection);
        await CreateMinimalSchemaAsync(connection);
        var fixture = SeedAdjustServingsFixture(options, false, planStatus: sourceStatus);
        var service = new CoordinationService(new IpcManagementContext(options), Substitute.For<IMaterialDemandService>());

        var act = async () => await service.SignoffOrderScopeAsync(
            new CoordinationScopeActionRequestDto { ServiceDate = "2026-06-15", ShiftName = "MORNING" },
            fixture.UserId);

        await act.Should().ThrowAsync<InvalidOperationException>();
        await using var verifyContext = new IpcManagementContext(options);
        (await verifyContext.Mealquantityplans.AsNoTracking().SingleAsync()).Status.Should().Be(sourceStatus);
        (await verifyContext.Auditlogs.AsNoTracking().CountAsync()).Should().Be(0);
    }

    [Theory]
    [InlineData(OrderStatus.Confirmed)]
    [InlineData(OrderStatus.Adjusted)]
    public async Task UnlockOrderPlanScopeAsync_Should_AllowEveryLegalSourceStatus(string sourceStatus)
    {
        using var connection = new SqliteConnection("Data Source=:memory:");
        await connection.OpenAsync();
        var options = BuildOptions(connection);
        await CreateMinimalSchemaAsync(connection);
        var fixture = SeedAdjustServingsFixture(options, false, planStatus: sourceStatus);
        var service = new CoordinationService(new IpcManagementContext(options), Substitute.For<IMaterialDemandService>());

        var result = await service.UnlockOrderPlanScopeAsync(
            new CoordinationScopeActionRequestDto { ServiceDate = "2026-06-15", ShiftName = "MORNING" },
            fixture.UserId);

        result.Should().NotBeNull();
        result!.OldStatuses.Should().ContainSingle().Which.Should().Be(sourceStatus);
        result.NewStatus.Should().Be(OrderStatus.Draft);
    }

    [Theory]
    [InlineData(OrderStatus.Draft)]
    [InlineData(OrderStatus.Forecasted)]
    [InlineData(OrderStatus.Completed)]
    [InlineData(OrderStatus.Archived)]
    [InlineData(OrderStatus.Cancelled)]
    public async Task UnlockOrderPlanScopeAsync_Should_RejectEveryIllegalSourceStatus(string sourceStatus)
    {
        using var connection = new SqliteConnection("Data Source=:memory:");
        await connection.OpenAsync();
        var options = BuildOptions(connection);
        await CreateMinimalSchemaAsync(connection);
        var fixture = SeedAdjustServingsFixture(options, false, planStatus: sourceStatus);
        var service = new CoordinationService(new IpcManagementContext(options), Substitute.For<IMaterialDemandService>());

        var act = async () => await service.UnlockOrderPlanScopeAsync(
            new CoordinationScopeActionRequestDto { ServiceDate = "2026-06-15", ShiftName = "MORNING" },
            fixture.UserId);

        await act.Should().ThrowAsync<InvalidOperationException>();
        await using var verifyContext = new IpcManagementContext(options);
        (await verifyContext.Mealquantityplans.AsNoTracking().SingleAsync()).Status.Should().Be(sourceStatus);
        (await verifyContext.Auditlogs.AsNoTracking().CountAsync()).Should().Be(0);
    }

    [Fact]
    public async Task ScopeActions_Should_UpdateAllPlansInSelectedShiftAndLeaveOtherShiftUntouched()
    {
        using var connection = new SqliteConnection("Data Source=:memory:");
        await connection.OpenAsync();
        var options = BuildOptions(connection);
        await CreateMinimalSchemaAsync(connection);
        var morning = SeedAdjustServingsFixture(options, false, suffix: "201", planStatus: OrderStatus.Confirmed);
        SeedAdjustServingsFixture(options, false, suffix: "202", planStatus: OrderStatus.Adjusted);
        SeedAdjustServingsFixture(options, false, suffix: "203", shiftName: "AFTERNOON", planStatus: OrderStatus.Confirmed);
        var service = new CoordinationService(new IpcManagementContext(options), Substitute.For<IMaterialDemandService>());

        var signoff = await service.SignoffOrderScopeAsync(
            new CoordinationScopeActionRequestDto { ServiceDate = "2026-06-15", ShiftName = "MORNING" },
            morning.UserId);

        signoff.Should().NotBeNull();
        signoff!.AffectedPlanCount.Should().Be(2);
        signoff.OldStatuses.Should().BeEquivalentTo([OrderStatus.Confirmed, OrderStatus.Adjusted]);

        await using var verifyContext = new IpcManagementContext(options);
        var plans = await verifyContext.Mealquantityplans
            .AsNoTracking()
            .Include(plan => plan.Mealquantityplanlines)
            .ToListAsync();
        plans.Where(plan => plan.Mealquantityplanlines.Single().ShiftName == "MORNING")
            .Should().OnlyContain(plan => plan.Status == OrderStatus.Completed);
        plans.Single(plan => plan.Mealquantityplanlines.Single().ShiftName == "AFTERNOON").Status
            .Should().Be(OrderStatus.Confirmed);
        (await verifyContext.Auditlogs.AsNoTracking().CountAsync()).Should().Be(2);
    }

    [Fact]
    public async Task ScopeActions_Should_BlockMixedStatusesAtomically()
    {
        using var connection = new SqliteConnection("Data Source=:memory:");
        await connection.OpenAsync();
        var options = BuildOptions(connection);
        await CreateMinimalSchemaAsync(connection);
        var first = SeedAdjustServingsFixture(options, false, suffix: "301", planStatus: OrderStatus.Confirmed);
        SeedAdjustServingsFixture(options, false, suffix: "302", planStatus: OrderStatus.Draft);
        var service = new CoordinationService(new IpcManagementContext(options), Substitute.For<IMaterialDemandService>());

        var act = async () => await service.SignoffOrderScopeAsync(
            new CoordinationScopeActionRequestDto { ServiceDate = "2026-06-15", ShiftName = "MORNING" },
            first.UserId);

        await act.Should().ThrowAsync<InvalidOperationException>();
        await using var verifyContext = new IpcManagementContext(options);
        (await verifyContext.Mealquantityplans.AsNoTracking().Select(plan => plan.Status).ToListAsync())
            .Should().BeEquivalentTo([OrderStatus.Confirmed, OrderStatus.Draft]);
        (await verifyContext.Auditlogs.AsNoTracking().CountAsync()).Should().Be(0);
    }

    [Fact]
    public async Task ScopeActions_Should_HandleMissingUserInvalidShiftAndMissingPlans()
    {
        using var connection = new SqliteConnection("Data Source=:memory:");
        await connection.OpenAsync();
        var options = BuildOptions(connection);
        await CreateMinimalSchemaAsync(connection);
        var service = new CoordinationService(new IpcManagementContext(options), Substitute.For<IMaterialDemandService>());
        var request = new CoordinationScopeActionRequestDto { ServiceDate = "2026-06-15", ShiftName = "MORNING" };

        (await service.SignoffOrderScopeAsync(request, null)).Should().BeNull();
        (await service.UnlockOrderPlanScopeAsync(request, null)).Should().BeNull();
        (await service.SignoffOrderScopeAsync(request, Guid.NewGuid().ToString())).Should().BeNull();
        (await service.UnlockOrderPlanScopeAsync(request, Guid.NewGuid().ToString())).Should().BeNull();
        var fallbackShiftRequest = new CoordinationScopeActionRequestDto
        {
            ServiceDate = "2026-06-15",
            Shift = "Ca Sáng"
        };
        (await service.SignoffOrderScopeAsync(fallbackShiftRequest, Guid.NewGuid().ToString())).Should().BeNull();
        (await service.UnlockOrderPlanScopeAsync(fallbackShiftRequest, Guid.NewGuid().ToString())).Should().BeNull();

        var invalidRequest = new CoordinationScopeActionRequestDto { ServiceDate = "2026-06-15", ShiftName = "INVALID" };
        Func<Task> invalidSignoff = async () =>
            await service.SignoffOrderScopeAsync(invalidRequest, Guid.NewGuid().ToString());
        Func<Task> invalidUnlock = async () =>
            await service.UnlockOrderPlanScopeAsync(invalidRequest, Guid.NewGuid().ToString());
        await invalidSignoff.Should().ThrowAsync<ArgumentException>();
        await invalidUnlock.Should().ThrowAsync<ArgumentException>();
    }

    [Theory]
    [InlineData("signoff")]
    [InlineData("unlock")]
    public async Task ScopeActions_Should_RollBackPlanAndAudit_WhenSaveFails(string action)
    {
        using var connection = new SqliteConnection("Data Source=:memory:");
        await connection.OpenAsync();
        var seedOptions = BuildOptions(connection);
        await CreateMinimalSchemaAsync(connection);
        var fixture = SeedAdjustServingsFixture(seedOptions, true);
        var failingOptions = BuildOptions(connection, new ThrowOnAuditlogSaveChangesInterceptor());
        var service = new CoordinationService(new IpcManagementContext(failingOptions), Substitute.For<IMaterialDemandService>());
        var request = new CoordinationScopeActionRequestDto { ServiceDate = "2026-06-15", ShiftName = "MORNING" };

        Func<Task> act = action == "signoff"
            ? async () => await service.SignoffOrderScopeAsync(request, fixture.UserId)
            : async () => await service.UnlockOrderPlanScopeAsync(request, fixture.UserId);

        await act.Should().ThrowAsync<InvalidOperationException>()
            .WithMessage("Simulated audit log failure");

        await using var verifyContext = new IpcManagementContext(seedOptions);
        var plan = await verifyContext.Mealquantityplans.AsNoTracking().SingleAsync();
        plan.Status.Should().Be(OrderStatus.Confirmed);
        plan.ConfirmedAt.Should().NotBeNull();
        plan.CompletedAt.Should().BeNull();
        (await verifyContext.Auditlogs.AsNoTracking().CountAsync()).Should().Be(0);
    }

    [Theory]
    [InlineData("signoff")]
    [InlineData("unlock")]
    public async Task ScopeActions_Should_ReturnBusinessConflict_WhenConcurrencyCheckFails(string action)
    {
        using var connection = new SqliteConnection("Data Source=:memory:");
        await connection.OpenAsync();
        var seedOptions = BuildOptions(connection);
        await CreateMinimalSchemaAsync(connection);
        var fixture = SeedAdjustServingsFixture(seedOptions, true);
        var failingOptions = BuildOptions(connection, new ThrowConcurrencyOnPlanSaveChangesInterceptor());
        var service = new CoordinationService(new IpcManagementContext(failingOptions), Substitute.For<IMaterialDemandService>());
        var request = new CoordinationScopeActionRequestDto { ServiceDate = "2026-06-15", ShiftName = "MORNING" };
        Func<Task> act = action == "signoff"
            ? async () => await service.SignoffOrderScopeAsync(request, fixture.UserId)
            : async () => await service.UnlockOrderPlanScopeAsync(request, fixture.UserId);

        await act.Should().ThrowAsync<InvalidOperationException>()
            .WithMessage("Một kế hoạch trong ca đã được người khác chỉnh sửa. Vui lòng tải lại trang.");

        await using var verifyContext = new IpcManagementContext(seedOptions);
        (await verifyContext.Mealquantityplans.AsNoTracking().SingleAsync()).Status
            .Should().Be(OrderStatus.Confirmed);
        (await verifyContext.Auditlogs.AsNoTracking().CountAsync()).Should().Be(0);
    }

    private static DbContextOptions<IpcManagementContext> BuildOptions(
        SqliteConnection connection,
        IInterceptor? interceptor = null)
    {
        var builder = new DbContextOptionsBuilder<IpcManagementContext>()
            .UseSqlite(connection);

        if (interceptor is not null)
        {
            builder.AddInterceptors(interceptor);
        }

        return builder.Options;
    }

    private static AdjustFixture SeedAdjustServingsFixture(
        DbContextOptions<IpcManagementContext> options,
        bool confirmedPlan,
        string suffix = "001",
        string shiftName = "MORNING",
        string? planStatus = null)
    {
        using var context = new IpcManagementContext(options);

        var resolvedStatus = planStatus ?? (confirmedPlan ? OrderStatus.Confirmed : OrderStatus.Draft);

        var customerId = GuidHelper.ToBytes(Guid.NewGuid());
        var menuId = GuidHelper.ToBytes(Guid.NewGuid());
        var scheduleId = GuidHelper.ToBytes(Guid.NewGuid());
        var planId = GuidHelper.ToBytes(Guid.NewGuid());
        var lineId = GuidHelper.ToBytes(Guid.NewGuid());
        var dishId = GuidHelper.ToBytes(Guid.NewGuid());
        var menuItemId = GuidHelper.ToBytes(Guid.NewGuid());

        var customer = new Customer
        {
            CustomerId = customerId,
            CustomerCode = $"CUS-{suffix}",
            CustomerName = "Customer Test",
            IsActive = true
        };

        var menu = new Menu
        {
            MenuId = menuId,
            MenuCode = $"MENU-{suffix}",
            MenuName = "Menu Test",
            IsActive = true
        };

        var dish = new Dish
        {
            DishId = dishId,
            DishCode = $"DISH-{suffix}",
            DishName = "Dish Test",
            IsActive = true
        };

        var menuItem = new MenuItem
        {
            MenuItemId = menuItemId,
            MenuId = menuId,
            DishId = dishId,
            DisplayOrder = 1,
            Dish = dish,
            Menu = menu
        };

        var schedule = new MenuSchedule
        {
            MenuScheduleId = scheduleId,
            CustomerId = customerId,
            MenuId = menuId,
            ServiceDate = new DateOnly(2026, 6, 15),
            WeekStartDate = new DateOnly(2026, 6, 15),
            ShiftName = shiftName,
            MenuPrice = 35000,
            BomRatePercent = 100,
            Status = "ACTIVE",
            Customer = customer,
            Menu = menu
        };

        var plan = new MealQuantityPlan
        {
            QuantityPlanId = planId,
            PlanCode = $"PLAN-{suffix}",
            ServiceDate = new DateOnly(2026, 6, 15),
            Status = resolvedStatus,
            ConfirmationTime = new TimeOnly(8, 0),
            ConfirmedAt = OrderStatus.IsLocked(resolvedStatus) || resolvedStatus is OrderStatus.Completed or OrderStatus.Archived
                ? DateTime.UtcNow
                : null
        };

        var line = new MealQuantityPlanLine
        {
            QuantityPlanLineId = lineId,
            QuantityPlanId = planId,
            MenuScheduleId = scheduleId,
            CustomerId = customerId,
            MenuId = menuId,
            ShiftName = shiftName,
            ForecastServings = 100,
            ConfirmedServings = 100,
            AdjustedServings = 0,
            FinalServings = 100,
            QuantityPlan = plan,
            MenuSchedule = schedule,
            Customer = customer,
            Menu = menu
        };

        context.Customers.Add(customer);
        context.Menus.Add(menu);
        context.Dishes.Add(dish);
        context.Menuitems.Add(menuItem);
        context.Menuschedules.Add(schedule);
        context.Mealquantityplans.Add(plan);
        context.Mealquantityplanlines.Add(line);

        context.SaveChanges();

        return new AdjustFixture
        {
            UserId = Guid.NewGuid().ToString(),
            PlanId = planId,
            LineId = lineId
        };
    }

    private static async Task CreateMinimalSchemaAsync(SqliteConnection connection)
    {
        var commands = new[]
        {
            "CREATE TABLE customers (customerId BLOB NOT NULL PRIMARY KEY, customerCode TEXT NOT NULL UNIQUE, customerName TEXT NOT NULL, note TEXT NULL, isActive INTEGER NULL);",
            "CREATE TABLE menus (menuId BLOB NOT NULL PRIMARY KEY, menuCode TEXT NOT NULL UNIQUE, menuName TEXT NOT NULL, fromDate TEXT NULL, toDate TEXT NULL, isActive INTEGER NULL);",
            "CREATE TABLE dishes (dishId BLOB NOT NULL PRIMARY KEY, dishCode TEXT NOT NULL UNIQUE, dishName TEXT NOT NULL, dishGroup TEXT NULL, dishType TEXT NULL, isActive INTEGER NULL);",
            "CREATE TABLE menuitems (menuItemId BLOB NOT NULL PRIMARY KEY, menuId BLOB NOT NULL, dishId BLOB NOT NULL, dishSlot TEXT NULL, displayOrder INTEGER NOT NULL);",
            "CREATE TABLE menuschedules (menuScheduleId BLOB NOT NULL PRIMARY KEY, customerId BLOB NOT NULL, menuId BLOB NOT NULL, serviceDate TEXT NOT NULL, weekStartDate TEXT NOT NULL, shiftName TEXT NOT NULL, menuPrice TEXT NOT NULL, bomRatePercent TEXT NOT NULL, status TEXT NOT NULL, menuVersionId BLOB NULL);",
            "CREATE TABLE mealquantityplans (quantityPlanId BLOB NOT NULL PRIMARY KEY, importBatchId BLOB NULL, planCode TEXT NOT NULL UNIQUE, serviceDate TEXT NOT NULL, status TEXT NOT NULL, forecastReceivedAt TEXT NULL, confirmedAt TEXT NULL, confirmationTime TEXT NOT NULL, confirmedBy BLOB NULL, completedAt TEXT NULL, completedBy BLOB NULL, rowVersion TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);",
            "CREATE TABLE mealquantityplanlines (quantityPlanLineId BLOB NOT NULL PRIMARY KEY, quantityPlanId BLOB NOT NULL, menuScheduleId BLOB NOT NULL, customerId BLOB NOT NULL, menuId BLOB NOT NULL, shiftName TEXT NOT NULL, forecastServings INTEGER NOT NULL, confirmedServings INTEGER NOT NULL, adjustedServings INTEGER NOT NULL, finalServings INTEGER NOT NULL, updatedAt TEXT NOT NULL DEFAULT '2026-01-01 00:00:00');",
            "CREATE TABLE quantityadjustments (adjustmentId BLOB NOT NULL PRIMARY KEY, quantityPlanLineId BLOB NOT NULL, oldServings INTEGER NOT NULL, newServings INTEGER NOT NULL, reason TEXT NULL, adjustedBy BLOB NOT NULL, adjustedAt TEXT NOT NULL);",
            "CREATE TABLE approvalhistories (approvalHistoryId BLOB NOT NULL PRIMARY KEY, targetType TEXT NOT NULL, targetId BLOB NOT NULL, decision TEXT NOT NULL, oldStatus TEXT NULL, newStatus TEXT NULL, reason TEXT NULL, actionBy BLOB NOT NULL, actionAt TEXT NOT NULL);",
            "CREATE TABLE auditlogs (auditId BLOB NOT NULL PRIMARY KEY, changedAt TEXT NOT NULL, changedBy BLOB NOT NULL, businessArea TEXT NOT NULL, entityName TEXT NOT NULL, entityId BLOB NULL, fieldName TEXT NULL, oldValue TEXT NULL, newValue TEXT NULL, reason TEXT NULL);"
        };

        foreach (var sql in commands)
        {
            await using var command = connection.CreateCommand();
            command.CommandText = sql;
            await command.ExecuteNonQueryAsync();
        }
    }

    private sealed class ThrowOnAuditlogSaveChangesInterceptor : SaveChangesInterceptor
    {
        public override InterceptionResult<int> SavingChanges(
            DbContextEventData eventData,
            InterceptionResult<int> result)
        {
            ThrowIfAuditlogPending(eventData.Context);
            return base.SavingChanges(eventData, result);
        }

        public override ValueTask<InterceptionResult<int>> SavingChangesAsync(
            DbContextEventData eventData,
            InterceptionResult<int> result,
            CancellationToken cancellationToken = default)
        {
            ThrowIfAuditlogPending(eventData.Context);
            return base.SavingChangesAsync(eventData, result, cancellationToken);
        }

        private static void ThrowIfAuditlogPending(DbContext? context)
        {
            var hasPendingAuditLog = context?.ChangeTracker.Entries<AuditLog>()
                .Any(entry => entry.State is EntityState.Added) == true;

            if (hasPendingAuditLog)
            {
                throw new InvalidOperationException("Simulated audit log failure");
            }
        }
    }

    private sealed class ThrowOnMealquantityplanSaveChangesInterceptor : SaveChangesInterceptor
    {
        public override InterceptionResult<int> SavingChanges(
            DbContextEventData eventData,
            InterceptionResult<int> result)
        {
            ThrowIfMealQuantityPlanPending(eventData.Context);
            return base.SavingChanges(eventData, result);
        }

        public override ValueTask<InterceptionResult<int>> SavingChangesAsync(
            DbContextEventData eventData,
            InterceptionResult<int> result,
            CancellationToken cancellationToken = default)
        {
            ThrowIfMealQuantityPlanPending(eventData.Context);
            return base.SavingChangesAsync(eventData, result, cancellationToken);
        }

        private static void ThrowIfMealQuantityPlanPending(DbContext? context)
        {
            var hasPendingPlanChange = context?.ChangeTracker.Entries<MealQuantityPlan>()
                .Any(entry => entry.State is EntityState.Modified) == true;

            if (hasPendingPlanChange)
            {
                throw new InvalidOperationException("Simulated lock failure");
            }
        }
    }

    private sealed class ThrowConcurrencyOnPlanSaveChangesInterceptor : SaveChangesInterceptor
    {
        public override ValueTask<InterceptionResult<int>> SavingChangesAsync(
            DbContextEventData eventData,
            InterceptionResult<int> result,
            CancellationToken cancellationToken = default)
        {
            if (eventData.Context?.ChangeTracker.Entries<MealQuantityPlan>()
                    .Any(entry => entry.State == EntityState.Modified) == true)
            {
                throw new DbUpdateConcurrencyException("Simulated concurrency conflict");
            }

            return base.SavingChangesAsync(eventData, result, cancellationToken);
        }
    }

    private sealed class AdjustFixture
    {
        public string UserId { get; set; } = string.Empty;
        public byte[] PlanId { get; set; } = null!;
        public byte[] LineId { get; set; } = null!;
    }
}
