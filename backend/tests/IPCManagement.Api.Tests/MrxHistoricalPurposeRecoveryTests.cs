using System.Security.Claims;
using IPCManagement.Api.Data.Transactions;
using IPCManagement.Api.Exceptions;
using IPCManagement.Api.Features.Reconciliation.Contracts;
using IPCManagement.Api.Features.Reconciliation.Services;
using IPCManagement.Api.Features.SystemOperation.Services;
using IPCManagement.Api.Helpers;
using IPCManagement.Api.Models.Entities;
using Microsoft.EntityFrameworkCore;

namespace IPCManagement.Api.Tests;

public sealed class MrxHistoricalPurposeRecoveryTests
{
    [Theory]
    [InlineData(false)]
    [InlineData(true)]
    public async Task Known_legacy_issue_is_allocated_once_by_the_authorized_actor_without_rewriting_the_issue(bool direct)
    {
        await using var fixture = await ReconciliationSupplementalDemandTests.Fixture.CreateAsync();
        var (recovery, request, issueLineId) = await SeedAsync(fixture);
        var candidates = await recovery.ListAsync(request.BatchId, request.ServiceDate, fixture.Warehouse, default);
        Assert.Equal(4m, Assert.Single(candidates).UnallocatedQuantity);
        var admin = new ClaimsPrincipal(new ClaimsIdentity([
            new Claim(ClaimTypes.NameIdentifier, GuidHelper.ToGuidString(fixture.ManagerId)),
            new Claim(ClaimTypes.Role, "Admin")], "test"));
        var initial = await recovery.ProposeAsync(request, direct ? admin : fixture.Warehouse);
        Assert.Equal(direct ? "APPLIED" : "PENDING", initial.Status);
        if (!direct)
        {
            Assert.Empty(await fixture.Db.Reconciliationissueallocations.ToListAsync());
            var decision = new MrxHistoricalPurposeDecision(Guid.NewGuid().ToString(), 1, 2, true, "Đã đối chiếu phiếu");
            await Assert.ThrowsAsync<UnauthorizedAccessException>(() => recovery.DecideAsync(initial.ProposalId, decision, fixture.Warehouse));
            Assert.Equal("APPLIED", (await recovery.DecideAsync(initial.ProposalId, decision, fixture.Manager)).Status);
            Assert.Equal("APPLIED", (await recovery.DecideAsync(initial.ProposalId, decision, fixture.Manager)).Status);
        }
        else Assert.Equal("APPLIED", (await recovery.ProposeAsync(request, admin)).Status);

        fixture.Db.ChangeTracker.Clear();
        var allocation = await fixture.Db.Reconciliationissueallocations.SingleAsync();
        Assert.Equal(issueLineId, allocation.IssueLineId);
        Assert.Equal(4m, allocation.Quantity);
        Assert.Equal("BASELINE_SHORTAGE", allocation.Purpose);
        Assert.Equal(4m, (await fixture.Db.Inventoryissuelines.SingleAsync()).IssuedQty);
        Assert.Equal(3, (await fixture.Db.Reconciliationbatches.SingleAsync()).Version);
        var history = await fixture.Db.Auditlogs.OrderBy(row => row.ChangedAt).ToListAsync();
        Assert.Equal(direct ? new[] { "ADMIN_DIRECT" } : new[] { "PENDING", "APPLIED" }, history.Select(row => row.NewValue));
        Assert.Equal(fixture.ManagerId, history.Last().ChangedBy);
        Assert.Empty(await recovery.ListAsync(request.BatchId, request.ServiceDate, fixture.Warehouse, default));
    }

    [Fact]
    public async Task Rejected_or_stale_proposal_never_applies_the_historical_quantity()
    {
        await using var fixture = await ReconciliationSupplementalDemandTests.Fixture.CreateAsync();
        var (recovery, request, _) = await SeedAsync(fixture);
        var proposal = await recovery.ProposeAsync(request, fixture.Warehouse);
        await Assert.ThrowsAsync<DbUpdateConcurrencyException>(() => recovery.ProposeAsync(
            request with { CommandId = Guid.NewGuid().ToString() }, fixture.Warehouse));
        var stale = new MrxHistoricalPurposeDecision(Guid.NewGuid().ToString(), 1, 1, true, "Dữ liệu cũ");
        await Assert.ThrowsAsync<DbUpdateConcurrencyException>(() => recovery.DecideAsync(proposal.ProposalId, stale, fixture.Manager));
        var rejected = await recovery.DecideAsync(proposal.ProposalId, stale with {
            CommandId = Guid.NewGuid().ToString(), Approve = false, ExpectedBatchVersion = 2
        }, fixture.Manager);
        Assert.Equal("REJECTED", rejected.Status);
        Assert.Empty(await fixture.Db.Reconciliationissueallocations.ToListAsync());
        Assert.Equal(2, (await fixture.Db.Reconciliationbatches.SingleAsync()).Version);
        Assert.Null(Assert.Single(await recovery.ListAsync(request.BatchId, request.ServiceDate, fixture.Warehouse, default)).PendingProposalId);
    }

    [Fact]
    public async Task Legacy_recovery_rejects_incomplete_split_wrong_day_and_stale_batch()
    {
        await using var fixture = await ReconciliationSupplementalDemandTests.Fixture.CreateAsync();
        var (recovery, request, _) = await SeedAsync(fixture);
        await Assert.ThrowsAsync<BusinessRuleException>(() => recovery.ProposeAsync(request with {
            Allocations = [new("BASELINE_SHORTAGE", 3m, null, null)]
        }, fixture.Warehouse));
        await Assert.ThrowsAsync<KeyNotFoundException>(() => recovery.ProposeAsync(request with {
            ServiceDate = request.ServiceDate.AddDays(1)
        }, fixture.Warehouse));
        await Assert.ThrowsAsync<DbUpdateConcurrencyException>(() => recovery.ProposeAsync(request with {
            ExpectedBatchVersion = 1
        }, fixture.Warehouse));
        Assert.Empty(await fixture.Db.Reconciliationissueallocations.ToListAsync());
        Assert.Empty(await fixture.Db.Auditlogs.ToListAsync());
    }

    private static async Task<(MrxHistoricalPurposeRecoveryService, MrxHistoricalPurposeProposalRequest, byte[])> SeedAsync(
        ReconciliationSupplementalDemandTests.Fixture fixture)
    {
        var daily = await fixture.Db.Reconciliationbatchdailylines.SingleAsync();
        var issue = await fixture.Db.Inventoryissues.SingleAsync();
        var line = new InventoryIssueLine { IssueLineId = GuidHelper.NewId(), IssueId = issue.IssueId,
            IngredientId = daily.IngredientId, UnitId = daily.CanonicalUnitId, IssuedQty = 4, RequestedQty = 12,
            ReconciliationBatchLineId = daily.BatchLineId, ReconciliationBatchDailyLineId = daily.DailyLineId,
            ReconciliationServiceDate = daily.ServiceDate };
        fixture.Db.Inventoryissuelines.Add(line);
        await fixture.Db.SaveChangesAsync();
        var requestContext = new SystemOperationRequestContext { ExpectedModeVersion = 1, Mode = "MATERIAL_RECONCILIATION" };
        var service = new MrxHistoricalPurposeRecoveryService(fixture.Db,
            new EfTransactionRunner(fixture.Db, requestContext, new SystemOperationModeGuard(fixture.Db)), requestContext);
        return (service, new(Guid.NewGuid().ToString(), GuidHelper.ToGuidString(daily.BatchId), daily.ServiceDate,
            GuidHelper.ToGuidString(line.IssueLineId), 2, "Định mức theo chứng từ kho", [new("BASELINE_SHORTAGE", 4, null, null)]), line.IssueLineId);
    }
}
