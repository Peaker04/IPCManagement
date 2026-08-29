using FluentAssertions;
using IPCManagement.Api.Data;
using IPCManagement.Api.Data.Transactions;
using IPCManagement.Api.Exceptions;
using IPCManagement.Api.Features.Inventory.Contracts;
using IPCManagement.Api.Features.Inventory.Services;
using IPCManagement.Api.Features.SystemOperation.Contracts;
using IPCManagement.Api.Features.SystemOperation.Services;
using IPCManagement.Api.Helpers;
using IPCManagement.Api.Models.Entities;
using Microsoft.EntityFrameworkCore;
using NSubstitute;
using Xunit;

namespace IPCManagement.Api.Tests;

public sealed class Phase30InactiveWorkflowFenceTests
{
    [Fact]
    public async Task DefaultIssueCreation_UsesTheCapturedModeVersionFenceInsteadOfOrdinaryTransactionDispatch()
    {
        var issueRepository = Substitute.For<IPCManagement.Api.Data.Repositories.IInventoryIssueRepository>();
        var unitOfWork = Substitute.For<IUnitOfWork>();
        var stockLedger = Substitute.For<IStockLedgerService>();
        var warehouse = Substitute.For<IOperationalWarehouseResolver>();
        var actorId = Guid.NewGuid().ToString();
        var warehouseId = GuidHelper.NewId();
        var materialRequestId = GuidHelper.NewId();
        var materialRequestLineId = GuidHelper.NewId();
        var ingredientId = GuidHelper.NewId();
        var unitId = GuidHelper.NewId();
        warehouse.ResolveAsync(Arg.Any<CancellationToken>()).Returns(warehouseId);
        issueRepository.GetMaterialRequestForIssueAsync(Arg.Any<byte[]>()).Returns(new MaterialRequest
        {
            RequestId = materialRequestId,
            RequestCode = "MR-P30-DEFAULT-FENCE",
            Status = "APPROVED",
            Materialrequestlines =
            [
                new MaterialRequestLine
                {
                    RequestLineId = materialRequestLineId,
                    IngredientId = ingredientId,
                    UnitId = unitId,
                    TotalRequiredQty = 1,
                    Ingredient = new Ingredient { IngredientId = ingredientId, IngredientName = "Rice" },
                    Unit = new Unit { UnitId = unitId, UnitName = "kg" },
                }
            ]
        });
        issueRepository.GetIssuedLinesForMaterialRequestAsync(Arg.Any<byte[]>()).Returns([]);
        var requestContext = new SystemOperationRequestContext
        {
            Mode = SystemOperationEligibility.Default,
            OperationKey = "inventoryissues.createasync",
            ExpectedModeVersion = 7,
            Disposition = OperationDisposition.Retained,
        };
        var runner = new RecordingProtectedTransactionRunner(requestContext);
        var service = new InventoryIssueService(
            issueRepository, unitOfWork, stockLedger, runner, warehouse, requestContext: requestContext);

        await service.CreateAsync(new CreateInventoryIssueRequest
        {
            MaterialRequestId = GuidHelper.ToGuidString(materialRequestId),
            WarehouseId = GuidHelper.ToGuidString(warehouseId),
            IssueDate = new DateOnly(2026, 8, 30),
            Lines =
            [
                new CreateInventoryIssueLineRequest
                {
                    MaterialRequestLineId = GuidHelper.ToGuidString(materialRequestLineId),
                    IngredientId = GuidHelper.ToGuidString(ingredientId),
                    UnitId = GuidHelper.ToGuidString(unitId),
                    RequestedQty = 1,
                    IssuedQty = 1,
                }
            ]
        }, actorId);

        runner.ProtectedCalls.Should().Be(1);
        runner.OrdinaryCalls.Should().Be(0);
        runner.OperationKey.Should().Be("inventoryissues.createasync");
        runner.ExpectedModeVersion.Should().Be(7);
        runner.DispositionAtDispatch.Should().Be(OperationDisposition.ExcludedInMaterialReconciliation);
    }

    [Fact]
    public async Task LegacyDispositionApply_RejectsInactiveThenAppliesTheSameApprovedIdentityAfterRealSwitchBack()
    {
        await using var context = CreateContext();
        var adminRole = new Role { RoleId = GuidHelper.NewId(), RoleCode = "ADMIN", RoleName = "Admin" };
        var admin = new User
        {
            UserId = GuidHelper.NewId(),
            RoleId = adminRole.RoleId,
            Username = "phase30-admin",
            FullName = "Phase 30 Admin",
            PasswordHash = "test-only",
            IsActive = true,
            CreatedAt = DateTime.UtcNow,
        };
        var ingredientId = GuidHelper.NewId();
        var unitId = GuidHelper.NewId();
        var request = new MaterialRequest
        {
            RequestId = GuidHelper.NewId(),
            RequestCode = "MR-P30-LEGACY-RESUME",
            PlanId = GuidHelper.NewId(),
            RequestDate = new DateOnly(2026, 8, 30),
            RequestScope = "FULLDAY",
            Status = "APPROVED",
            CreatedBy = admin.UserId,
        };
        var targetLine = new MaterialRequestLine
        {
            RequestLineId = GuidHelper.NewId(),
            RequestId = request.RequestId,
            PlanLineId = GuidHelper.NewId(),
            IngredientId = ingredientId,
            UnitId = unitId,
            AppliedPortionRuleSource = "TEST",
        };
        request.Materialrequestlines.Add(targetLine);
        var issue = new InventoryIssue
        {
            IssueId = GuidHelper.NewId(),
            IssueCode = "ISS-P30-LEGACY-RESUME",
            IssueDate = new DateOnly(2026, 8, 30),
            WarehouseId = GuidHelper.NewId(),
            MaterialRequestId = request.RequestId,
            IssuedBy = admin.UserId,
            CreatedAt = DateTime.UtcNow,
        };
        var legacyLine = new InventoryIssueLine
        {
            IssueLineId = GuidHelper.NewId(),
            IssueId = issue.IssueId,
            IngredientId = ingredientId,
            UnitId = unitId,
            RequestedQty = 1,
            IssuedQty = 1,
        };
        issue.Inventoryissuelines.Add(legacyLine);
        var disposition = new LegacyLineageDisposition
        {
            DispositionId = GuidHelper.NewId(),
            LegacyLineType = "ISSUE_LINE",
            LegacyLineId = legacyLine.IssueLineId,
            TargetMaterialRequestLineId = targetLine.RequestLineId,
            Status = "APPROVED",
            Reason = "Exact evidence approved before mode switch.",
            CreatedBy = admin.UserId,
            CreatedAt = DateTime.UtcNow,
            ReviewedBy = GuidHelper.NewId(),
            ReviewedAt = DateTime.UtcNow,
            Version = 1,
        };
        context.AddRange(adminRole, admin, request, issue, disposition,
            new SystemOperationMode { Id = 1, Mode = SystemOperationEligibility.Default, Version = 1, UpdatedAt = DateTime.UtcNow, UpdatedBy = admin.UserId });
        await context.SaveChangesAsync();
        var guard = new SystemOperationModeGuard(context);
        var modeService = new SystemOperationModeService(context, guard, new EfTransactionRunner(context));
        var reconciliation = await modeService.ChangeAsync(new ChangeSystemOperationModeRequest(
            SystemOperationEligibility.MaterialReconciliation, 1, true, "Freeze legacy disposition."), GuidHelper.ToGuidString(admin.UserId));
        var requestContext = new SystemOperationRequestContext
        {
            Mode = SystemOperationEligibility.MaterialReconciliation,
            OperationKey = "legacylineagedispositions.applyasync",
            ExpectedModeVersion = reconciliation.Version,
            Disposition = OperationDisposition.ExcludedInMaterialReconciliation,
        };
        var service = new LegacyLineageDispositionService(
            context, new ImmediateTransactionRunner(), new IPCManagement.Api.Infrastructure.Lifecycle.LifecycleTransitionRecorder(context), requestContext);
        var command = new ApplyLegacyLineageDispositionRequest
        {
            CommandId = "phase30-legacy-apply-resume",
            ExpectedVersion = 1,
            Reason = "Apply the exact approved evidence after DEFAULT resumes.",
        };
        var before = await CaptureLegacyLedgerAsync(context, disposition.DispositionId, legacyLine.IssueLineId);

        var inactive = () => service.ApplyAsync(GuidHelper.ToGuidString(disposition.DispositionId), command, GuidHelper.ToGuidString(admin.UserId));
        await inactive.Should().ThrowAsync<BusinessRuleException>()
            .WithMessage("*chỉ khả dụng trong chế độ DEFAULT*");
        (await CaptureLegacyLedgerAsync(context, disposition.DispositionId, legacyLine.IssueLineId)).Should().BeEquivalentTo(before);

        var resumedAuthority = await modeService.ChangeAsync(new ChangeSystemOperationModeRequest(
            SystemOperationEligibility.Default, reconciliation.Version, true, "Resume exact legacy disposition."), GuidHelper.ToGuidString(admin.UserId));
        requestContext.Mode = SystemOperationEligibility.Default;
        requestContext.ExpectedModeVersion = resumedAuthority.Version;
        var applied = await service.ApplyAsync(GuidHelper.ToGuidString(disposition.DispositionId), command, GuidHelper.ToGuidString(admin.UserId));
        var replay = await service.ApplyAsync(GuidHelper.ToGuidString(disposition.DispositionId), command, GuidHelper.ToGuidString(admin.UserId));

        applied.DispositionId.Should().Be(GuidHelper.ToGuidString(disposition.DispositionId));
        replay.DispositionId.Should().Be(applied.DispositionId);
        var after = await CaptureLegacyLedgerAsync(context, disposition.DispositionId, legacyLine.IssueLineId);
        after.Status.Should().Be("APPLIED");
        after.Version.Should().Be(2);
        after.Lineage.Should().Be(Convert.ToHexString(targetLine.RequestLineId));
        after.Dispositions.Should().Be(1);
        after.Transitions.Should().Be(1);
        after.Outbox.Should().Be(1);
        after.Receipts.Should().Be(1);
    }

    [Fact]
    public void PlanDeclaredOwnersWithoutABoundedWorkflowMutationHaveExplicitProductionNotApplicableOracles()
    {
        var reconciliationCapabilities = SystemOperationEligibility.CapabilitiesFor(SystemOperationEligibility.MaterialReconciliation);

        reconciliationCapabilities.Navigation.Should().NotContain("approvals");
        reconciliationCapabilities.Navigation.Should().NotContain("purchasing");
        reconciliationCapabilities.PageTabs.GetValueOrDefault("admin-data", []).Should().NotContain("cleanup");
        SystemOperationEligibility.Classify("Approvals", "Approve").Should().Be(OperationDisposition.ExcludedInMaterialReconciliation);
        SystemOperationEligibility.Classify("ServiceRuns", "Continue").Should().Be(OperationDisposition.ExcludedInMaterialReconciliation);
        SystemOperationEligibility.Classify("SampleData", "Cleanup").Should().Be(OperationDisposition.Retained);
        SystemOperationEligibility.Classify("LifecycleOutbox", "Process").Should().Be(OperationDisposition.Neutral);
    }

    private static IpcManagementContext CreateContext()
    {
        var options = new DbContextOptionsBuilder<IpcManagementContext>()
            .UseInMemoryDatabase($"phase30-owner-matrix-{Guid.NewGuid():N}")
            .Options;
        return new IpcManagementContext(options);
    }

    private static async Task<SeedIds> SeedAuthorityAndUnfinishedAggregatesAsync(IpcManagementContext context)
    {
        var actor = GuidHelper.NewId();
        var actorId = GuidHelper.ToGuidString(actor);
        var ingredientId = GuidHelper.NewId();
        var unitId = GuidHelper.NewId();
        var warehouseId = GuidHelper.NewId();
        var materialRequestId = GuidHelper.NewId();
        var materialRequestLineId = GuidHelper.NewId();
        var defaultIssueId = GuidHelper.NewId();
        var defaultIssueLineId = GuidHelper.NewId();
        var reconciliationBatchId = GuidHelper.NewId();
        var reconciliationBatchLineId = GuidHelper.NewId();
        var legacyDispositionId = GuidHelper.NewId();

        var materialRequest = new MaterialRequest
        {
            RequestId = materialRequestId,
            RequestCode = "MR-P30-FROZEN",
            PlanId = GuidHelper.NewId(),
            RequestDate = new DateOnly(2026, 8, 29),
            RequestScope = "FULLDAY",
            Status = "SENTTOWAREHOUSE",
            CreatedBy = actor,
            Materialrequestlines =
            [
                new MaterialRequestLine
                {
                    RequestLineId = materialRequestLineId,
                    PlanLineId = GuidHelper.NewId(),
                    IngredientId = ingredientId,
                    UnitId = unitId,
                    TotalServings = 10,
                    GrossQtyPerServing = 0.5m,
                    BomRatePercent = 100,
                    AppliedPortionRuleSource = "TEST",
                    AppliedPortionRatePercent = 100,
                    TotalRequiredQty = 5,
                    CurrentStockQty = 20,
                    SuggestedPurchaseQty = 0,
                }
            ]
        };
        var defaultIssue = new InventoryIssue
        {
            IssueId = defaultIssueId,
            IssueCode = "ISS-P30-FROZEN",
            IssueDate = new DateOnly(2026, 8, 29),
            WarehouseId = warehouseId,
            MaterialRequestId = materialRequestId,
            IssuedBy = actor,
            CreatedAt = DateTime.UtcNow,
            Inventoryissuelines =
            [
                new InventoryIssueLine
                {
                    IssueLineId = defaultIssueLineId,
                    IngredientId = ingredientId,
                    UnitId = unitId,
                    MaterialRequestLineId = materialRequestLineId,
                    RequestedQty = 5,
                    IssuedQty = 4,
                }
            ]
        };
        var reconciliationBatch = new ReconciliationBatch
        {
            BatchId = reconciliationBatchId,
            MenuVersionId = GuidHelper.NewId(),
            QuantityImportBatchId = GuidHelper.NewId(),
            Status = "IN_PROGRESS",
            Version = 4,
            CreatedBy = actor,
            CreatedAt = DateTime.UtcNow,
            Lines =
            [
                new ReconciliationBatchLine
                {
                    BatchLineId = reconciliationBatchLineId,
                    IngredientId = ingredientId,
                    CanonicalUnitId = unitId,
                    RequiredQuantity = 5,
                    FrozenTolerance = 0.1m,
                    ToleranceSourceKind = "SYSTEM_DEFAULT",
                    ToleranceSourceVersion = "1",
                    Version = 2,
                }
            ]
        };
        var legacyDisposition = new LegacyLineageDisposition
        {
            DispositionId = legacyDispositionId,
            LegacyLineType = "ISSUE_LINE",
            LegacyLineId = defaultIssueLineId,
            TargetMaterialRequestLineId = materialRequestLineId,
            Status = "APPROVED",
            Reason = "Exact pending provenance remains frozen.",
            CreatedBy = actor,
            CreatedAt = DateTime.UtcNow,
            ReviewedBy = actor,
            ReviewedAt = DateTime.UtcNow,
            Version = 1,
        };
        context.AddRange(
            new SystemOperationMode { Id = 1, Mode = SystemOperationEligibility.Default, Version = 1, UpdatedAt = DateTime.UtcNow, UpdatedBy = actor },
            materialRequest,
            defaultIssue,
            reconciliationBatch,
            legacyDisposition);
        await context.SaveChangesAsync();
        return new(actorId, Convert.ToHexString(materialRequestId), Convert.ToHexString(defaultIssueId), Convert.ToHexString(reconciliationBatchId), Convert.ToHexString(legacyDispositionId));
    }

    private static async Task<LegacyLedger> CaptureLegacyLedgerAsync(IpcManagementContext context, byte[] dispositionId, byte[] lineId)
    {
        context.ChangeTracker.Clear();
        var disposition = await context.Legacylinedispositions.AsNoTracking().SingleAsync(item => item.DispositionId == dispositionId);
        var line = await context.Inventoryissuelines.AsNoTracking().SingleAsync(item => item.IssueLineId == lineId);
        return new LegacyLedger(
            disposition.Status,
            disposition.Version,
            line.MaterialRequestLineId is null ? null : Convert.ToHexString(line.MaterialRequestLineId),
            await context.Legacylinedispositions.CountAsync(),
            await context.Lifecycletransitions.CountAsync(),
            await context.Lifecycleoutboxmessages.CountAsync(),
            await context.Lifecyclecommandreceipts.CountAsync());
    }

    private static async Task<WorkflowSnapshot> CaptureWorkflowSnapshotAsync(IpcManagementContext context)
    {
        context.ChangeTracker.Clear();
        var mode = await context.Systemoperationmodes.AsNoTracking().SingleAsync();
        var request = await context.Materialrequests.AsNoTracking().Include(row => row.Materialrequestlines).SingleAsync();
        var issue = await context.Inventoryissues.AsNoTracking().Include(row => row.Inventoryissuelines).SingleAsync();
        var batch = await context.Reconciliationbatches.AsNoTracking().Include(row => row.Lines).SingleAsync();
        var legacy = await context.Legacylinedispositions.AsNoTracking().SingleAsync();
        return new WorkflowSnapshot(
            mode.Mode,
            Convert.ToHexString(request.RequestId), request.Status, request.Materialrequestlines.Count,
            request.Materialrequestlines.Single().TotalRequiredQty,
            Convert.ToHexString(issue.IssueId), Convert.ToHexString(issue.MaterialRequestId!), issue.Inventoryissuelines.Count,
            issue.Inventoryissuelines.Single().IssuedQty, Convert.ToHexString(issue.Inventoryissuelines.Single().MaterialRequestLineId!),
            Convert.ToHexString(batch.BatchId), batch.Status, batch.Version, batch.Lines.Count,
            batch.Lines.Single().Version, batch.Lines.Single().RequiredQuantity,
            Convert.ToHexString(legacy.DispositionId), legacy.Status, legacy.Version,
            Convert.ToHexString(legacy.LegacyLineId), Convert.ToHexString(legacy.TargetMaterialRequestLineId!),
            await context.Inventoryreturns.CountAsync(), await context.Supplementalmaterialrequests.CountAsync(),
            await context.Reconciliationactuals.CountAsync(), await context.Reconciliationdispositions.CountAsync(),
            await context.Stockmovements.CountAsync(), await context.Lifecycletransitions.CountAsync(),
            await context.Lifecycleoutboxmessages.CountAsync(), await context.Lifecyclecommandreceipts.CountAsync());
    }

    private sealed class RecordingProtectedTransactionRunner(SystemOperationRequestContext requestContext) : IEfTransactionRunner
    {
        public int OrdinaryCalls { get; private set; }
        public int ProtectedCalls { get; private set; }
        public string? OperationKey { get; private set; }
        public long ExpectedModeVersion { get; private set; }
        public OperationDisposition DispositionAtDispatch { get; private set; }

        public Task ExecuteAsync(Func<CancellationToken, Task> operation, Func<CancellationToken, Task<bool>> verifySucceeded, System.Data.IsolationLevel isolationLevel = System.Data.IsolationLevel.ReadCommitted, CancellationToken cancellationToken = default)
        {
            OrdinaryCalls++;
            return operation(cancellationToken);
        }

        public Task<TResult> ExecuteAsync<TResult>(Func<CancellationToken, Task<TResult>> operation, Func<CancellationToken, Task<bool>> verifySucceeded, System.Data.IsolationLevel isolationLevel = System.Data.IsolationLevel.ReadCommitted, CancellationToken cancellationToken = default)
        {
            OrdinaryCalls++;
            return operation(cancellationToken);
        }

        public Task<TResult> ExecuteProtectedAsync<TResult>(string operationKey, long expectedModeVersion, Func<CancellationToken, Task<TResult>> operation, Func<CancellationToken, Task<bool>> verifySucceeded, System.Data.IsolationLevel isolationLevel = System.Data.IsolationLevel.ReadCommitted, CancellationToken cancellationToken = default)
        {
            ProtectedCalls++;
            OperationKey = operationKey;
            ExpectedModeVersion = expectedModeVersion;
            DispositionAtDispatch = requestContext.Disposition;
            return operation(cancellationToken);
        }
    }

    private sealed record LegacyLedger(string Status, long Version, string? Lineage, int Dispositions, int Transitions, int Outbox, int Receipts);
    private sealed record SeedIds(string ActorId, string MaterialRequestId, string DefaultIssueId, string ReconciliationBatchId, string LegacyDispositionId);
    private sealed record WorkflowSnapshot(
        string Mode,
        string MaterialRequestId, string MaterialRequestStatus, int MaterialRequestChildren, decimal MaterialRequestQuantity,
        string DefaultIssueId, string DefaultIssueParentId, int DefaultIssueChildren, decimal DefaultIssuedQuantity, string DefaultLineageId,
        string ReconciliationBatchId, string ReconciliationStatus, long ReconciliationVersion, int ReconciliationChildren,
        long ReconciliationLineVersion, decimal ReconciliationQuantity,
        string LegacyDispositionId, string LegacyDispositionStatus, long LegacyDispositionVersion,
        string LegacySourceId, string LegacyTargetId,
        int Returns, int SupplementalRequests, int ReconciliationActuals, int ReconciliationDispositions,
        int Movements, int LifecycleTransitions, int Outbox, int CommandReceipts);
}
