using System.Reflection;
using FluentAssertions;
using IPCManagement.Api.Data;
using IPCManagement.Api.Data.Transactions;
using IPCManagement.Api.Exceptions;
using IPCManagement.Api.Features.Inventory.Controllers;
using IPCManagement.Api.Features.Reconciliation.Controllers;
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
    [Theory]
    [InlineData("DEFAULT", "MATERIAL_RECONCILIATION")]
    [InlineData("MATERIAL_RECONCILIATION", "DEFAULT")]
    public async Task ReturnCreation_FreezesInactiveFamilyThenResumesTheSameSourceWithoutDrift(
        string owningFamily,
        string inactiveMode)
    {
        var fixture = Phase30WarehouseReturnFamilyTests.CreateFixture(owningFamily, inactiveMode);
        var issueIdBefore = fixture.Request.IssueId;
        var sourceLineBefore = fixture.Request.Lines.Single().SourceIssueLineId;

        var inactive = () => fixture.Service.CreateAsync(fixture.Request, fixture.UserId);

        await inactive.Should().ThrowAsync<BusinessRuleException>()
            .WithMessage("*workflow nguồn đang hoạt động*");
        fixture.ReturnRepository.DidNotReceive().Add(Arg.Any<InventoryReturn>());
        await fixture.UnitOfWork.DidNotReceive().SaveChangesAsync();
        await fixture.StockLedger.DidNotReceiveWithAnyArgs().AddStockAsync(
            default!, default!, default!, default, default!, default!, default!, default!, default!, default!);

        fixture.RequestContext.Mode = owningFamily;
        var resumed = await fixture.Service.CreateAsync(fixture.Request, fixture.UserId);

        resumed.Should().NotBeNull();
        fixture.Request.IssueId.Should().Be(issueIdBefore);
        fixture.Request.Lines.Single().SourceIssueLineId.Should().Be(sourceLineBefore);
        fixture.ReturnRepository.Received(1).Add(Arg.Is<InventoryReturn>(created =>
            created.IssueId.SequenceEqual(fixture.Issue.IssueId)
            && created.Inventoryreturnlines.Single().SourceIssueLineId!.SequenceEqual(
                fixture.Issue.Inventoryissuelines.Single().IssueLineId)));
        await fixture.UnitOfWork.Received(1).SaveChangesAsync();
    }

    [Fact]
    public async Task PersistedPublicOwnerMatrix_RejectsInactiveOwnersAndResumesExactAggregates()
    {
        await using var context = CreateContext();
        var seed = await SeedAuthorityAndUnfinishedAggregatesAsync(context);
        var guard = new SystemOperationModeGuard(context);
        var modeService = new SystemOperationModeService(context, guard, new EfTransactionRunner(context));
        var original = await CaptureWorkflowSnapshotAsync(context);

        var reconciliationAuthority = await modeService.ChangeAsync(
            new ChangeSystemOperationModeRequest(
                SystemOperationEligibility.MaterialReconciliation,
                ExpectedVersion: 1,
                Confirmed: true,
                Reason: "Verify frozen DEFAULT public owners."),
            seed.ActorId);

        foreach (var owner in DefaultOnlyOwners())
        {
            var attempt = () => guard.ValidateAsync(owner.OperationKey, reconciliationAuthority.Version, owner.Disposition);
            await attempt.Should().ThrowAsync<SystemOperationUnavailableException>(owner.Name);
            (await CaptureWorkflowSnapshotAsync(context)).Should().BeEquivalentTo(original, options => options.Excluding(row => row.Mode));
        }

        AssertDefaultNotApplicableOraclesAreProductionOwned();
        var defaultAuthority = await modeService.ChangeAsync(
            new ChangeSystemOperationModeRequest(
                SystemOperationEligibility.Default,
                ExpectedVersion: reconciliationAuthority.Version,
                Confirmed: true,
                Reason: "Resume the same DEFAULT aggregates."),
            seed.ActorId);
        foreach (var owner in DefaultOnlyOwners())
            await guard.ValidateAsync(owner.OperationKey, defaultAuthority.Version, owner.Disposition);

        var afterDefaultResume = await CaptureWorkflowSnapshotAsync(context);
        afterDefaultResume.Should().BeEquivalentTo(original, options => options.Excluding(row => row.Mode));

        var reconciliationMode = await modeService.ChangeAsync(
            new ChangeSystemOperationModeRequest(
                SystemOperationEligibility.MaterialReconciliation,
                ExpectedVersion: defaultAuthority.Version,
                Confirmed: true,
                Reason: "Activate reconciliation owner matrix."),
            seed.ActorId);
        foreach (var owner in ReconciliationOwners())
            await guard.ValidateAsync(owner.OperationKey, reconciliationMode.Version, owner.Disposition);

        var inactiveDefault = await modeService.ChangeAsync(
            new ChangeSystemOperationModeRequest(
                SystemOperationEligibility.Default,
                ExpectedVersion: reconciliationMode.Version,
                Confirmed: true,
                Reason: "Verify frozen reconciliation public owners."),
            seed.ActorId);

        foreach (var owner in ReconciliationOwners())
        {
            var attempt = () => guard.ValidateAsync(owner.OperationKey, inactiveDefault.Version, owner.Disposition);
            await attempt.Should().ThrowAsync<SystemOperationUnavailableException>(owner.Name);
            (await CaptureWorkflowSnapshotAsync(context)).Should().BeEquivalentTo(original, options => options.Excluding(row => row.Mode));
        }

        AssertReconciliationRegistrationsAreExecutablePublicOracles();
        var resumedReconciliation = await modeService.ChangeAsync(
            new ChangeSystemOperationModeRequest(
                SystemOperationEligibility.MaterialReconciliation,
                ExpectedVersion: inactiveDefault.Version,
                Confirmed: true,
                Reason: "Resume the same reconciliation aggregate."),
            seed.ActorId);
        foreach (var owner in ReconciliationOwners())
            await guard.ValidateAsync(owner.OperationKey, resumedReconciliation.Version, owner.Disposition);

        var resumed = await CaptureWorkflowSnapshotAsync(context);
        resumed.Should().BeEquivalentTo(original, options => options.Excluding(row => row.Mode));
        resumed.MaterialRequestId.Should().Be(seed.MaterialRequestId);
        resumed.DefaultIssueId.Should().Be(seed.DefaultIssueId);
        resumed.ReconciliationBatchId.Should().Be(seed.ReconciliationBatchId);
        resumed.LegacyDispositionId.Should().Be(seed.LegacyDispositionId);
        resumed.MaterialRequestChildren.Should().Be(1);
        resumed.DefaultIssueChildren.Should().Be(1);
        resumed.ReconciliationChildren.Should().Be(1);
        resumed.LegacyDispositionVersion.Should().Be(1);
        resumed.LegacyDispositionStatus.Should().Be("APPROVED");
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

    private static IReadOnlyList<OwnerRow> DefaultOnlyOwners() =>
    [
        new("DEFAULT approval/continuation", "approvals.continue", OperationDisposition.ExcludedInMaterialReconciliation),
        new("DEFAULT supplemental", "supplementalmaterialrequests.create", OperationDisposition.ExcludedInMaterialReconciliation),
        new("DEFAULT cleanup", "admindata.cleanup", OperationDisposition.ExcludedInMaterialReconciliation),
        new("DEFAULT pending legacy disposition", "legacylineagedispositions.apply", OperationDisposition.ExcludedInMaterialReconciliation),
    ];

    private static IReadOnlyList<OwnerRow> ReconciliationOwners() =>
    [
        RegisteredOwner<ReconciliationBatchesController>(nameof(ReconciliationBatchesController.TransferToWarehouse), "reconciliation transfer"),
        RegisteredOwner<ReconciliationActualsController>(nameof(ReconciliationActualsController.Issued), "reconciliation issue continuation"),
        RegisteredOwner<ReconciliationActualsController>(nameof(ReconciliationActualsController.Disposition), "reconciliation disposition"),
        RegisteredOwner<ReconciliationBatchesController>(nameof(ReconciliationBatchesController.Complete), "reconciliation completion"),
    ];

    private static OwnerRow RegisteredOwner<TController>(string methodName, string name, OperationDisposition? fallback = null)
    {
        var method = typeof(TController).GetMethod(methodName, BindingFlags.Instance | BindingFlags.Public)
            ?? throw new InvalidOperationException($"Missing production owner {typeof(TController).Name}.{methodName}.");
        var metadata = method.GetCustomAttribute<SystemOperationAttribute>();
        if (metadata is not null)
            return new OwnerRow(name, metadata.OperationKey, metadata.Disposition);
        if (fallback.HasValue)
            return new OwnerRow(name, SystemOperationEligibility.OperationKey(typeof(TController).Name.Replace("Controller", ""), methodName), fallback.Value);
        throw new InvalidOperationException($"Production owner {typeof(TController).Name}.{methodName} lacks explicit operation registration.");
    }

    private static void AssertReconciliationRegistrationsAreExecutablePublicOracles()
    {
        foreach (var owner in ReconciliationOwners())
            owner.Disposition.Should().Be(OperationDisposition.ReconciliationOnly, owner.Name);
    }

    private static void AssertDefaultNotApplicableOraclesAreProductionOwned()
    {
        SystemOperationEligibility.Classify("Approvals", "Continue")
            .Should().Be(OperationDisposition.ExcludedInMaterialReconciliation);
        SystemOperationEligibility.Classify("ServiceRuns", "Continue")
            .Should().Be(OperationDisposition.ExcludedInMaterialReconciliation);
        SystemOperationEligibility.CapabilitiesFor(SystemOperationEligibility.MaterialReconciliation)
            .PageTabs.GetValueOrDefault("admin-data", []).Should().NotContain("cleanup");
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

    private sealed record OwnerRow(string Name, string OperationKey, OperationDisposition Disposition);
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
