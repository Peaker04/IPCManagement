using FluentAssertions;
using IPCManagement.Api.Data;
using IPCManagement.Api.Exceptions;
using IPCManagement.Api.Features.Planning.Services;
using IPCManagement.Api.Features.Planning.Contracts;
using IPCManagement.Api.Helpers;
using IPCManagement.Api.Models.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata;
using Pomelo.EntityFrameworkCore.MySql.Infrastructure;

namespace IPCManagement.Api.Tests;

public sealed class ServiceRunLifecycleTests
{
    [Fact]
    public void ServiceRun_Should_UseOneExecutionScopePerCustomerDateShiftAndTier()
    {
        var options = new DbContextOptionsBuilder<IpcManagementContext>()
            .UseInMemoryDatabase($"service-run-model-{Guid.NewGuid():N}")
            .Options;
        using var context = new IpcManagementContext(options);

        var entityType = context.Model.FindEntityType(typeof(ServiceRun));
        entityType.Should().NotBeNull();
        entityType!.FindProperty(nameof(ServiceRun.CloseSnapshotJson)).Should().NotBeNull();
        entityType.FindProperty(nameof(ServiceRun.CustomerId)).Should().NotBeNull();
        entityType.FindProperty(nameof(ServiceRun.ServiceDate)).Should().NotBeNull();
        entityType.FindProperty(nameof(ServiceRun.PriceTierAmount)).Should().NotBeNull();
        entityType.GetIndexes().Should().Contain(index =>
            index.IsUnique && index.Properties.Select(property => property.Name)
                .SequenceEqual(new[]
                {
                    nameof(ServiceRun.CustomerId),
                    nameof(ServiceRun.ServiceDate),
                    nameof(ServiceRun.ShiftName),
                    nameof(ServiceRun.PriceTierAmount),
                }));

        context.Model.FindEntityType(typeof(ServiceRunSourceLine)).Should().NotBeNull();
    }

    [Fact]
    public void ScopedProjection_Should_ExposeRequiredScopeFourTracksAndServerOwnedActions()
    {
        var projection = new ServiceRunLifecycleProjectionDto();

        projection.CustomerId.Should().NotBeNull();
        projection.PriceTierAmount.Should().BeGreaterThanOrEqualTo(0m);
        projection.CurrentVersion.Should().BeGreaterThanOrEqualTo(0);
        projection.Tracks.Should().HaveCount(4);
        projection.AllowedActions.Should().NotBeNull();
        projection.CloseSnapshot.Should().NotBeNull();
        projection.CorrectionOverlay.Should().NotBeNull();
    }

    [Fact]
    public async Task OpenAndVarianceCommands_Should_BeIdempotent_AndRecordCompleteLifecycleEvidence()
    {
        var options = new DbContextOptionsBuilder<IpcManagementContext>()
            .UseInMemoryDatabase($"service-run-open-{Guid.NewGuid():N}")
            .Options;
        var actorId = GuidHelper.NewId();
        var planId = GuidHelper.NewId();
        var customerId = GuidHelper.NewId();
        var quantityPlanId = GuidHelper.NewId();
        var quantityPlanLineId = GuidHelper.NewId();
        var scheduleId = GuidHelper.NewId();
        var requestId = GuidHelper.NewId();
        var requestLineId = GuidHelper.NewId();
        await using (var context = new IpcManagementContext(options))
        {
            var quantityPlan = new MealQuantityPlan
            {
                QuantityPlanId = quantityPlanId, PlanCode = "QTY-SERVICE-RUN", ServiceDate = new DateOnly(2026, 8, 5),
                Status = "COMPLETED", ConfirmationTime = TimeOnly.MinValue,
            };
            var schedule = new MenuSchedule
            {
                MenuScheduleId = scheduleId, CustomerId = customerId, MenuId = GuidHelper.NewId(), ServiceDate = new DateOnly(2026, 8, 5),
                WeekStartDate = new DateOnly(2026, 8, 3), ShiftName = "MORNING", MenuPrice = 25000m, BomRatePercent = 100m, Status = "ACTIVE",
            };
            var quantityPlanLine = new MealQuantityPlanLine
            {
                QuantityPlanLineId = quantityPlanLineId, QuantityPlanId = quantityPlanId, MenuScheduleId = scheduleId,
                CustomerId = schedule.CustomerId, MenuId = schedule.MenuId, ShiftName = "MORNING", FinalServings = 120,
                QuantityPlan = quantityPlan, MenuSchedule = schedule,
            };
            context.AddRange(quantityPlan, schedule, quantityPlanLine);
            var productionPlanLine = new ProductionPlanLine
            {
                PlanLineId = GuidHelper.NewId(), PlanId = planId, QuantityPlanLineId = quantityPlanLineId,
                CustomerId = schedule.CustomerId, MenuId = schedule.MenuId, DishId = GuidHelper.NewId(), ShiftName = "MORNING", TotalServings = 120,
                QuantityPlanLine = quantityPlanLine,
            };
            context.Productionplans.Add(new ProductionPlan
            {
                PlanId = planId, PlanCode = "KHSX-SERVICE-RUN", PlanDate = new DateOnly(2026, 8, 5), Status = "CREATED",
                CreatedBy = actorId, CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow, SentToKitchenAt = DateTime.UtcNow, SentToKitchenBy = actorId,
                Productionplanlines = [productionPlanLine],
            });
            context.Materialrequests.Add(new MaterialRequest
            {
                RequestId = requestId, PlanId = planId, RequestCode = "YC-SERVICE-RUN", RequestDate = new DateOnly(2026, 8, 5),
                RequestScope = "SERVICE_RUN", Status = "PENDING", CreatedBy = actorId,
                Materialrequestlines =
                [
                    new MaterialRequestLine
                    {
                        RequestLineId = requestLineId, RequestId = requestId, PlanLineId = productionPlanLine.PlanLineId,
                        IngredientId = GuidHelper.NewId(), UnitId = GuidHelper.NewId(), PriceTierAmount = 25000m,
                        TotalServings = 120, GrossQtyPerServing = 1m, BomRatePercent = 100m, TotalRequiredQty = 120m,
                        PlanLine = productionPlanLine,
                    },
                ],
            });
            await context.SaveChangesAsync();
        }

        await using var verificationContext = new IpcManagementContext(options);
        var service = new ServiceRunService(verificationContext);
        var first = await service.OpenAsync(new OpenServiceRunRequest { PlanId = GuidHelper.ToGuidString(planId), ShiftName = "MORNING", CustomerId = GuidHelper.ToGuidString(customerId), PriceTierAmount = 25000m }, GuidHelper.ToGuidString(actorId));
        var second = await service.OpenAsync(new OpenServiceRunRequest { PlanId = GuidHelper.ToGuidString(planId), ShiftName = "MORNING", CustomerId = GuidHelper.ToGuidString(customerId), PriceTierAmount = 25000m }, GuidHelper.ToGuidString(actorId));

        first.Should().NotBeNull();
        first!.Blockers.Should().Contain(ServiceRunBlocker.DemandNotGenerated);
        second!.ServiceRunId.Should().Be(first.ServiceRunId);
        verificationContext.Serviceruns.Should().ContainSingle();
        verificationContext.Servicerunsourcelines.Should().ContainSingle();
        verificationContext.Lifecycletransitions.Should().ContainSingle(item => item.AggregateType == nameof(ServiceRun) && item.ToState == ServiceRunStatus.Planned);
        verificationContext.Lifecyclecommandreceipts.Should().ContainSingle();
        verificationContext.Lifecycleoutboxmessages.Should().ContainSingle();

        var declarationRequest = new DeclareServiceRunVarianceRequest
        {
            CommandId = "service-run-variance-declare-1",
            ExpectedVersion = first.CurrentVersion,
            Track = "SERVICE_EXECUTION",
            SourceLineIds = [GuidHelper.ToGuidString(requestLineId)],
            Reason = "Bếp ghi nhận chênh lệch đúng dòng nguyên liệu nguồn.",
        };
        var declared = await service.DeclareVarianceAsync(first.ServiceRunId, declarationRequest, GuidHelper.ToGuidString(actorId));
        var declarationId = GuidHelper.ToGuidString(verificationContext.Servicerunvariancedeclarations.Single().ServiceRunVarianceDeclarationId);
        var replayedDeclaration = await service.DeclareVarianceAsync(first.ServiceRunId, declarationRequest, GuidHelper.ToGuidString(actorId));

        replayedDeclaration!.CurrentVersion.Should().Be(declared!.CurrentVersion);
        verificationContext.Servicerunvariancedeclarations.Should().ContainSingle();
        verificationContext.Lifecycletransitions.Should().HaveCount(2);
        verificationContext.Lifecyclecommandreceipts.Should().HaveCount(2);
        verificationContext.Lifecycleoutboxmessages.Should().HaveCount(2);
        verificationContext.Auditlogs.Should().HaveCount(2);

        var waiverActorId = GuidHelper.NewId();
        var waiverRequest = new ApproveServiceRunVarianceWaiverRequest
        {
            CommandId = "service-run-variance-waiver-1",
            ExpectedVersion = declared.CurrentVersion,
            Reason = "Admin khác người khai báo đã kiểm tra bằng chứng nguồn.",
        };
        var waived = await service.ApproveVarianceWaiverAsync(first.ServiceRunId, declarationId, waiverRequest, GuidHelper.ToGuidString(waiverActorId));
        var replayedWaiver = await service.ApproveVarianceWaiverAsync(first.ServiceRunId, declarationId, waiverRequest, GuidHelper.ToGuidString(waiverActorId));

        replayedWaiver!.CurrentVersion.Should().Be(waived!.CurrentVersion);
        verificationContext.Servicerunvariancewaivers.Should().ContainSingle();
        verificationContext.Lifecycletransitions.Should().HaveCount(3);
        verificationContext.Lifecyclecommandreceipts.Should().HaveCount(3);
        verificationContext.Lifecycleoutboxmessages.Should().HaveCount(3);
        verificationContext.Auditlogs.Should().HaveCount(3);
    }

    [Fact]
    public void ScopedSourceLineQuery_Should_TranslateForMySqlWithoutClientSideBase64Keys()
    {
        var options = new DbContextOptionsBuilder<IpcManagementContext>()
            .UseMySql(
                "Server=localhost;Database=translation_only;User=root;Password=unused",
                new MySqlServerVersion(new Version(8, 0, 0)))
            .Options;
        using var context = new IpcManagementContext(options);

        var sql = ServiceRunService.SelectRequestSourceLines(
                context.Materialrequestlines,
                GuidHelper.NewId())
            .ToQueryString();

        sql.Should().Contain("requestId");
        sql.Should().NotContain("Base64");
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
        await action.Should().ThrowAsync<BusinessRuleException>().WithMessage("*chưa gửi Bếp*");
    }

    [Fact]
    public void SelectRelevantIssueLines_Should_IncludeFullDayIssueByMaterialRequestLineInsteadOfHeaderShift()
    {
        var morningRequestLineId = GuidHelper.NewId();
        var afternoonRequestLineId = GuidHelper.NewId();
        var ingredientId = GuidHelper.NewId();
        var unitId = GuidHelper.NewId();
        var fullDayIssue = new InventoryIssue
        {
            ShiftName = null,
            Inventoryissuelines =
            [
                new InventoryIssueLine { IssueLineId = GuidHelper.NewId(), IngredientId = ingredientId, UnitId = unitId, MaterialRequestLineId = morningRequestLineId, IssuedQty = 10m },
                new InventoryIssueLine { IssueLineId = GuidHelper.NewId(), IngredientId = ingredientId, UnitId = unitId, MaterialRequestLineId = afternoonRequestLineId, IssuedQty = 10m },
            ],
        };

        var relevant = ServiceRunService.SelectRelevantIssueLines(
            [fullDayIssue],
            [new MaterialRequestLine { RequestLineId = morningRequestLineId, IngredientId = ingredientId, UnitId = unitId }],
            "MORNING");

        relevant.Should().ContainSingle().Which.MaterialRequestLineId.Should().Equal(morningRequestLineId);
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
    public void Evaluate_Should_PrioritizeADeclaredKitchenDiscrepancyBeforeProductionStarts()
    {
        var result = ServiceRunLifecycle.Evaluate(new(
            IsPlanSignedOff: true, HasGeneratedMaterialDemand: true, HasBomBlocker: false, HasOpenSupply: false, HasUnreceivedIssue: false,
            HasOpenSupplemental: false, HasRecordedActualServings: false, HasUnresolvedVariance: true,
            HasServiceConfirmation: false, IsServiceConfirmationWaived: false, IsClosed: false));

        result.Status.Should().Be(ServiceRunStatus.ReconciliationRequired);
        result.Blockers.Should().Contain(ServiceRunBlocker.UnresolvedVariance);
        result.CanStartService.Should().BeFalse();
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
    public void Evaluate_Should_KeepADeclaredExceptionBlockedUntilAnAdminWaiverCoversItsSourceLine()
    {
        var result = ServiceRunLifecycle.Evaluate(new(
            IsPlanSignedOff: true, HasGeneratedMaterialDemand: true, HasBomBlocker: false, HasOpenSupply: false, HasUnreceivedIssue: false,
            HasOpenSupplemental: false, HasRecordedActualServings: true, HasUnresolvedVariance: true,
            HasServiceConfirmation: true, IsServiceConfirmationWaived: false, IsClosed: false,
            HasUnresolvedServingVariance: false, HasApprovedVarianceWaiver: true));

        result.Blockers.Should().NotContain(ServiceRunBlocker.UnresolvedVariance);
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
                ServiceRunId = runId, PlanId = GuidHelper.NewId(), CustomerId = GuidHelper.NewId(), ServiceDate = new DateOnly(2026, 8, 5),
                ShiftName = "MORNING", PriceTierAmount = 25000m, Status = ServiceRunStatus.Closed,
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
