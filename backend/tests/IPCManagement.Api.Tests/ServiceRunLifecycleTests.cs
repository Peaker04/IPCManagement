using FluentAssertions;
using IPCManagement.Api.Data;
using IPCManagement.Api.Features.Planning.Services;
using IPCManagement.Api.Features.Planning.Contracts;
using IPCManagement.Api.Helpers;
using IPCManagement.Api.Models.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata;

namespace IPCManagement.Api.Tests;

public sealed class ServiceRunLifecycleTests
{
    [Fact]
    public void ServiceRun_Should_UseOneExecutionScopePerPlanAndShift()
    {
        var options = new DbContextOptionsBuilder<IpcManagementContext>()
            .UseInMemoryDatabase($"service-run-model-{Guid.NewGuid():N}")
            .Options;
        using var context = new IpcManagementContext(options);

        var entityType = context.Model.FindEntityType(typeof(ServiceRun));
        entityType.Should().NotBeNull();
        entityType!.FindProperty(nameof(ServiceRun.CloseSnapshotJson)).Should().NotBeNull();
        entityType.GetIndexes().Should().Contain(index =>
            index.IsUnique && index.Properties.Select(property => property.Name)
                .SequenceEqual(new[] { nameof(ServiceRun.PlanId), nameof(ServiceRun.ShiftName) }));
    }

    [Fact]
    public async Task OpenAsync_Should_BeIdempotent_AndProjectSourceBlockers()
    {
        var options = new DbContextOptionsBuilder<IpcManagementContext>()
            .UseInMemoryDatabase($"service-run-open-{Guid.NewGuid():N}")
            .Options;
        var actorId = GuidHelper.NewId();
        var planId = GuidHelper.NewId();
        var quantityPlanId = GuidHelper.NewId();
        var quantityPlanLineId = GuidHelper.NewId();
        var scheduleId = GuidHelper.NewId();
        await using (var context = new IpcManagementContext(options))
        {
            var quantityPlan = new MealQuantityPlan
            {
                QuantityPlanId = quantityPlanId, PlanCode = "QTY-SERVICE-RUN", ServiceDate = new DateOnly(2026, 8, 5),
                Status = "COMPLETED", ConfirmationTime = TimeOnly.MinValue,
            };
            var schedule = new MenuSchedule
            {
                MenuScheduleId = scheduleId, CustomerId = GuidHelper.NewId(), MenuId = GuidHelper.NewId(), ServiceDate = new DateOnly(2026, 8, 5),
                WeekStartDate = new DateOnly(2026, 8, 3), ShiftName = "MORNING", MenuPrice = 25000m, BomRatePercent = 100m, Status = "ACTIVE",
            };
            var quantityPlanLine = new MealQuantityPlanLine
            {
                QuantityPlanLineId = quantityPlanLineId, QuantityPlanId = quantityPlanId, MenuScheduleId = scheduleId,
                CustomerId = schedule.CustomerId, MenuId = schedule.MenuId, ShiftName = "MORNING", FinalServings = 120,
                QuantityPlan = quantityPlan, MenuSchedule = schedule,
            };
            context.AddRange(quantityPlan, schedule, quantityPlanLine);
            context.Productionplans.Add(new ProductionPlan
            {
                PlanId = planId, PlanCode = "KHSX-SERVICE-RUN", PlanDate = new DateOnly(2026, 8, 5), Status = "CREATED",
                CreatedBy = actorId, CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow, SentToKitchenAt = DateTime.UtcNow, SentToKitchenBy = actorId,
                Productionplanlines =
                [
                    new ProductionPlanLine
                    {
                        PlanLineId = GuidHelper.NewId(), PlanId = planId, QuantityPlanLineId = quantityPlanLineId,
                        CustomerId = schedule.CustomerId, MenuId = schedule.MenuId, DishId = GuidHelper.NewId(), ShiftName = "MORNING", TotalServings = 120,
                        QuantityPlanLine = quantityPlanLine,
                    },
                ],
            });
            await context.SaveChangesAsync();
        }

        await using var verificationContext = new IpcManagementContext(options);
        var service = new ServiceRunService(verificationContext);
        var first = await service.OpenAsync(new OpenServiceRunRequest { PlanId = GuidHelper.ToGuidString(planId), ShiftName = "MORNING" }, GuidHelper.ToGuidString(actorId));
        var second = await service.OpenAsync(new OpenServiceRunRequest { PlanId = GuidHelper.ToGuidString(planId), ShiftName = "MORNING" }, GuidHelper.ToGuidString(actorId));

        first.Should().NotBeNull();
        first!.Blockers.Should().Contain(ServiceRunBlocker.DemandNotGenerated);
        second!.ServiceRunId.Should().Be(first.ServiceRunId);
        verificationContext.Serviceruns.Should().ContainSingle();
        verificationContext.Auditlogs.Should().ContainSingle(item => item.EntityName == nameof(ServiceRun) && item.FieldName == "Open");
    }

    [Fact]
    public void Evaluate_Should_BlockAnUnsignedPlanOrIncompleteBom()
    {
        var result = ServiceRunLifecycle.Evaluate(new(
            IsPlanSignedOff: false, HasGeneratedMaterialDemand: false, HasBomBlocker: true, HasOpenSupply: false, HasUnreceivedIssue: false,
            HasOpenSupplemental: false, HasRecordedActualServings: false, HasUnresolvedVariance: false,
            HasServiceConfirmation: false, IsServiceConfirmationWaived: false, IsClosed: false));

        result.Status.Should().Be(ServiceRunStatus.Blocked);
        result.Blockers.Should().Contain([ServiceRunBlocker.PlanNotSignedOff, ServiceRunBlocker.BomIncomplete]);
        result.CanStartService.Should().BeFalse();
    }

    [Fact]
    public async Task OpenAsync_Should_RejectAPlanThatWasNotSentToKitchen()
    {
        var options = new DbContextOptionsBuilder<IpcManagementContext>().UseInMemoryDatabase($"service-run-unsent-{Guid.NewGuid():N}").Options;
        var actorId = GuidHelper.NewId();
        var planId = GuidHelper.NewId();
        await using (var context = new IpcManagementContext(options))
        {
            context.Productionplans.Add(new ProductionPlan
            {
                PlanId = planId, PlanCode = "KHSX-UNSENT", PlanDate = new DateOnly(2026, 8, 5), Status = "CREATED", CreatedBy = actorId,
                CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow, Productionplanlines = [new ProductionPlanLine { PlanLineId = GuidHelper.NewId(), PlanId = planId, QuantityPlanLineId = GuidHelper.NewId(), CustomerId = GuidHelper.NewId(), MenuId = GuidHelper.NewId(), DishId = GuidHelper.NewId(), ShiftName = "MORNING" }],
            });
            await context.SaveChangesAsync();
        }
        await using var verificationContext = new IpcManagementContext(options);
        var service = new ServiceRunService(verificationContext);
        var action = () => service.OpenAsync(new OpenServiceRunRequest { PlanId = GuidHelper.ToGuidString(planId), ShiftName = "MORNING" }, GuidHelper.ToGuidString(actorId));
        await action.Should().ThrowAsync<InvalidOperationException>().WithMessage("*chưa gửi Bếp*");
    }

    [Fact]
    public void Evaluate_Should_KeepSupplyExceptionsOpenBeforeProduction()
    {
        var result = ServiceRunLifecycle.Evaluate(new(
            IsPlanSignedOff: true, HasGeneratedMaterialDemand: true, HasBomBlocker: false, HasOpenSupply: true, HasUnreceivedIssue: true,
            HasOpenSupplemental: true, HasRecordedActualServings: false, HasUnresolvedVariance: false,
            HasServiceConfirmation: false, IsServiceConfirmationWaived: false, IsClosed: false));

        result.Status.Should().Be(ServiceRunStatus.MaterialsInProgress);
        result.Blockers.Should().Contain([
            ServiceRunBlocker.OpenSupply,
            ServiceRunBlocker.UnreceivedIssue,
            ServiceRunBlocker.OpenSupplemental,
        ]);
    }

    [Fact]
    public void Evaluate_Should_AllowProductionOnlyWhenMaterialsAreTerminal()
    {
        var result = ServiceRunLifecycle.Evaluate(new(
            IsPlanSignedOff: true, HasGeneratedMaterialDemand: true, HasBomBlocker: false, HasOpenSupply: false, HasUnreceivedIssue: false,
            HasOpenSupplemental: false, HasRecordedActualServings: false, HasUnresolvedVariance: false,
            HasServiceConfirmation: false, IsServiceConfirmationWaived: false, IsClosed: false));

        result.Status.Should().Be(ServiceRunStatus.ReadyToProduce);
        result.CanStartService.Should().BeTrue();
        result.Blockers.Should().Contain(ServiceRunBlocker.ActualServingsNotRecorded);
    }

    [Fact]
    public void Evaluate_Should_RequireVarianceResolutionBeforeServiceConfirmation()
    {
        var result = ServiceRunLifecycle.Evaluate(new(
            IsPlanSignedOff: true, HasGeneratedMaterialDemand: true, HasBomBlocker: false, HasOpenSupply: false, HasUnreceivedIssue: false,
            HasOpenSupplemental: false, HasRecordedActualServings: true, HasUnresolvedVariance: true,
            HasServiceConfirmation: false, IsServiceConfirmationWaived: false, IsClosed: false));

        result.Status.Should().Be(ServiceRunStatus.ReconciliationRequired);
        result.Blockers.Should().Contain(ServiceRunBlocker.UnresolvedVariance);
    }

    [Fact]
    public void Evaluate_Should_RequireServingVarianceDecision_AndRejectConflictingConfirmationOutcomes()
    {
        var result = ServiceRunLifecycle.Evaluate(new(
            IsPlanSignedOff: true, HasGeneratedMaterialDemand: true, HasBomBlocker: false, HasOpenSupply: false, HasUnreceivedIssue: false,
            HasOpenSupplemental: false, HasRecordedActualServings: true, HasUnresolvedVariance: false,
            HasServiceConfirmation: true, IsServiceConfirmationWaived: true, IsClosed: false,
            HasUnresolvedServingVariance: true));

        result.Status.Should().Be(ServiceRunStatus.ReconciliationRequired);
        result.Blockers.Should().Contain([ServiceRunBlocker.UnresolvedServingVariance, ServiceRunBlocker.ConfirmationOutcomeConflict]);
        result.CanClose.Should().BeFalse();
    }

    [Fact]
    public void Evaluate_Should_AllowClosingOnlyAfterConfirmationOrApprovedWaiver()
    {
        var result = ServiceRunLifecycle.Evaluate(new(
            IsPlanSignedOff: true, HasGeneratedMaterialDemand: true, HasBomBlocker: false, HasOpenSupply: false, HasUnreceivedIssue: false,
            HasOpenSupplemental: false, HasRecordedActualServings: true, HasUnresolvedVariance: false,
            HasServiceConfirmation: false, IsServiceConfirmationWaived: true, IsClosed: false));

        result.Status.Should().Be(ServiceRunStatus.ReadyToClose);
        result.Blockers.Should().BeEmpty();
        result.CanClose.Should().BeTrue();
    }

    [Fact]
    public async Task CreateAdjustmentAsync_Should_AppendCorrectionWithoutMutatingClosedSnapshot()
    {
        var options = new DbContextOptionsBuilder<IpcManagementContext>()
            .UseInMemoryDatabase($"service-run-adjustment-{Guid.NewGuid():N}")
            .Options;
        var actorId = GuidHelper.NewId();
        var runId = GuidHelper.NewId();
        const string snapshot = "{\"actualServings\":120}";
        await using (var context = new IpcManagementContext(options))
        {
            context.Serviceruns.Add(new ServiceRun
            {
                ServiceRunId = runId, PlanId = GuidHelper.NewId(), ShiftName = "MORNING", Status = ServiceRunStatus.Closed,
                ActualServings = 120, ClosedAt = DateTime.UtcNow, CloseSnapshotJson = snapshot,
                OpenedBy = actorId, CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow,
            });
            await context.SaveChangesAsync();
        }

        await using var verificationContext = new IpcManagementContext(options);
        var service = new ServiceRunService(verificationContext);
        var adjustment = await service.CreateAdjustmentAsync(GuidHelper.ToGuidString(runId), new CreateServiceRunAdjustmentRequest
        {
            CorrectedActualServings = 118,
            Reason = "Khách vắng có xác nhận hậu kiểm.",
        }, GuidHelper.ToGuidString(actorId));

        adjustment!.CorrectedActualServings.Should().Be(118);
        verificationContext.Serviceruns.Single().ActualServings.Should().Be(120);
        verificationContext.Serviceruns.Single().CloseSnapshotJson.Should().Be(snapshot);
        verificationContext.Servicerunadjustments.Should().ContainSingle(item => item.Reason == "Khách vắng có xác nhận hậu kiểm.");
        verificationContext.Auditlogs.Should().ContainSingle(item => item.EntityName == nameof(ServiceRunAdjustment) && item.FieldName == "ActualServingsCorrection");
    }
}
