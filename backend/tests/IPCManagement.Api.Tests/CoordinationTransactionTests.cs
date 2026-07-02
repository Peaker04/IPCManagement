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
    public async Task AdjustServingsAsync_Should_Rollback_LineUpdate_When_AuditLog_Insert_Fails()
    {
        // Arrange
        using var connection = new SqliteConnection("Data Source=:memory:");
        await connection.OpenAsync();

        var options = BuildOptions(connection, new ThrowOnAuditlogSaveChangesInterceptor());

        var userId = Guid.NewGuid().ToString();

        await CreateMinimalSchemaAsync(connection);

        var fixture = SeedAdjustServingsFixture(options, confirmedPlan: true);
        var lineId = GuidHelper.ToGuidString(fixture.LineId);

        var materialDemandService = Substitute.For<IMaterialDemandService>();
        var service = new CoordinationService(new IpcManagementContext(options), materialDemandService);

        var request = new AdjustServingsRequestDto
        {
            ServingsQuantity = 120,
            Reason = "Điều chỉnh theo thực tế"
        };

        // Act
        Func<Task> act = async () => await service.AdjustServingsAsync(lineId, request, userId);

        // Assert
        await act.Should().ThrowAsync<InvalidOperationException>()
            .WithMessage("*Simulated audit log failure*");

        await using var verifyContext = new IpcManagementContext(BuildOptions(connection));
        var persistedLine = await verifyContext.Mealquantityplanlines
            .AsNoTracking()
            .FirstAsync(item => item.QuantityPlanLineId == fixture.LineId);

        var auditCount = await verifyContext.Auditlogs.AsNoTracking().CountAsync();

        persistedLine.FinalServings.Should().Be(100);
        persistedLine.AdjustedServings.Should().Be(0);
        auditCount.Should().Be(0);
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
    public async Task AdjustServingsAsync_Should_MoveLockedPlanToAdjustedStatus()
    {
        using var connection = new SqliteConnection("Data Source=:memory:");
        await connection.OpenAsync();

        var options = BuildOptions(connection);
        await CreateMinimalSchemaAsync(connection);

        var fixture = SeedAdjustServingsFixture(options, confirmedPlan: true);
        var lineId = GuidHelper.ToGuidString(fixture.LineId);
        var materialDemandService = Substitute.For<IMaterialDemandService>();
        var service = new CoordinationService(new IpcManagementContext(options), materialDemandService);

        var result = await service.AdjustServingsAsync(
            lineId,
            new AdjustServingsRequestDto
            {
                ServingsQuantity = 125,
                Reason = "Khách tăng suất sau khóa"
            },
            fixture.UserId);

        result.Should().NotBeNull();
        await using var verifyContext = new IpcManagementContext(BuildOptions(connection));
        var persistedPlan = await verifyContext.Mealquantityplans.AsNoTracking().SingleAsync();
        var persistedLine = await verifyContext.Mealquantityplanlines.AsNoTracking().SingleAsync();

        persistedPlan.Status.Should().Be(OrderStatus.Adjusted);
        persistedLine.ConfirmedServings.Should().Be(100);
        persistedLine.AdjustedServings.Should().Be(25);
        persistedLine.FinalServings.Should().Be(125);
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
    public async Task OrderAdjustmentApproval_Should_ApplyServingsAndRegenerateDemand_WhenApproved()
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
        var handler = new InventoryAdjustmentApprovalHandler(approvalContext, materialDemandService);

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

        await materialDemandService.Received(1).GenerateAsync(
            Arg.Is<GenerateMaterialDemandRequestDto>(request =>
                request.ServiceDate == "2026-06-15" &&
                request.Scope == "FULLDAY"),
            fixture.UserId,
            Arg.Any<CancellationToken>());
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
        bool confirmedPlan)
    {
        using var context = new IpcManagementContext(options);

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
            CustomerCode = "CUS-001",
            CustomerName = "Customer Test",
            IsActive = true
        };

        var menu = new Menu
        {
            MenuId = menuId,
            MenuCode = "MENU-001",
            MenuName = "Menu Test",
            IsActive = true
        };

        var dish = new Dish
        {
            DishId = dishId,
            DishCode = "DISH-001",
            DishName = "Dish Test",
            IsActive = true
        };

        var menuItem = new Menuitem
        {
            MenuItemId = menuItemId,
            MenuId = menuId,
            DishId = dishId,
            DisplayOrder = 1,
            Dish = dish,
            Menu = menu
        };

        var schedule = new Menuschedule
        {
            MenuScheduleId = scheduleId,
            CustomerId = customerId,
            MenuId = menuId,
            ServiceDate = new DateOnly(2026, 6, 15),
            WeekStartDate = new DateOnly(2026, 6, 15),
            ShiftName = "MORNING",
            MenuPrice = 35000,
            BomRatePercent = 100,
            Status = "ACTIVE",
            Customer = customer,
            Menu = menu
        };

        var plan = new Mealquantityplan
        {
            QuantityPlanId = planId,
            PlanCode = "PLAN-001",
            ServiceDate = new DateOnly(2026, 6, 15),
            Status = confirmedPlan ? "CONFIRMED" : "DRAFT",
            ConfirmationTime = new TimeOnly(8, 0),
            ConfirmedAt = confirmedPlan ? DateTime.UtcNow : null
        };

        var line = new Mealquantityplanline
        {
            QuantityPlanLineId = lineId,
            QuantityPlanId = planId,
            MenuScheduleId = scheduleId,
            CustomerId = customerId,
            MenuId = menuId,
            ShiftName = "MORNING",
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
            "CREATE TABLE menuschedules (menuScheduleId BLOB NOT NULL PRIMARY KEY, customerId BLOB NOT NULL, menuId BLOB NOT NULL, serviceDate TEXT NOT NULL, weekStartDate TEXT NOT NULL, shiftName TEXT NOT NULL, menuPrice TEXT NOT NULL, bomRatePercent TEXT NOT NULL, status TEXT NOT NULL);",
            "CREATE TABLE mealquantityplans (quantityPlanId BLOB NOT NULL PRIMARY KEY, importBatchId BLOB NULL, planCode TEXT NOT NULL UNIQUE, serviceDate TEXT NOT NULL, status TEXT NOT NULL, forecastReceivedAt TEXT NULL, confirmedAt TEXT NULL, confirmationTime TEXT NOT NULL, confirmedBy BLOB NULL);",
            "CREATE TABLE mealquantityplanlines (quantityPlanLineId BLOB NOT NULL PRIMARY KEY, quantityPlanId BLOB NOT NULL, menuScheduleId BLOB NOT NULL, customerId BLOB NOT NULL, menuId BLOB NOT NULL, shiftName TEXT NOT NULL, forecastServings INTEGER NOT NULL, confirmedServings INTEGER NOT NULL, adjustedServings INTEGER NOT NULL, finalServings INTEGER NOT NULL);",
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
            var hasPendingAuditLog = context?.ChangeTracker.Entries<Auditlog>()
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
            var hasPendingPlanChange = context?.ChangeTracker.Entries<Mealquantityplan>()
                .Any(entry => entry.State is EntityState.Modified) == true;

            if (hasPendingPlanChange)
            {
                throw new InvalidOperationException("Simulated lock failure");
            }
        }
    }

    private sealed class AdjustFixture
    {
        public string UserId { get; set; } = string.Empty;
        public byte[] PlanId { get; set; } = null!;
        public byte[] LineId { get; set; } = null!;
    }
}
