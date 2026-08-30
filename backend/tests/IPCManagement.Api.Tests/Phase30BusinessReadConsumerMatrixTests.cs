using System.Security.Claims;
using System.Text;
using FluentAssertions;
using IPCManagement.Api.Data;
using IPCManagement.Api.Features.Approvals.Contracts;
using IPCManagement.Api.Features.Approvals.Services;
using IPCManagement.Api.Features.Planning.Contracts;
using IPCManagement.Api.Features.Planning.Services;
using IPCManagement.Api.Features.Reports.Contracts;
using IPCManagement.Api.Features.Reports.Services;
using IPCManagement.Api.Helpers;
using IPCManagement.Api.Models.Entities;
using IPCManagement.Api.Shared.Contracts;
using Microsoft.EntityFrameworkCore;
using NSubstitute;

namespace IPCManagement.Api.Tests;

public sealed class Phase30BusinessReadConsumerMatrixTests
{
    [Fact]
    public async Task ApprovalInboxAndHandler_Should_UseOnlyExactDefaultLineage()
    {
        await using var fixture = await WorkflowGenerationTests.WorkflowFixture.CreateAsync();
        await fixture.SeedMenuWithDemandAsync(includeMissingDish: false);
        await using var context = fixture.CreateContext();
        var seed = await SeedCollidingIssuesAsync(context, fixture);
        (await context.Inventoryissues.CountAsync()).Should().Be(3);
        (await context.Inventoryissuelines.CountAsync()).Should().Be(3);
        (await context.Inventoryissues.CountAsync(item =>
            item.MaterialRequestId != null && item.ReconciliationBatchId == null &&
            item.Inventoryissuelines.All(line => line.MaterialRequestLineId != null && line.ReconciliationBatchLineId == null)))
            .Should().Be(1);
        (await context.Inventoryissues.CountAsync(item =>
            item.MaterialRequest.Status == "SENTTOWAREHOUSE" &&
            item.MaterialRequestId != null && item.ReconciliationBatchId == null))
            .Should().Be(1);
        var principal = new ClaimsPrincipal(new ClaimsIdentity(
            [new Claim(ClaimTypes.Role, "Admin")], "test"));
        var inbox = await new ApprovalInboxService(context, Substitute.For<IApprovalRoutingService>())
            .GetPendingAsync(principal, new ApprovalInboxQueryDto { TargetType = "inventory-issue", Limit = 20 });

        inbox.Should().ContainSingle(item => item.TargetId == GuidHelper.ToGuidString(seed.DefaultIssueId));
        inbox.Should().NotContain(item => item.TargetId == GuidHelper.ToGuidString(seed.ReconciliationIssueId));
        inbox.Should().NotContain(item => item.TargetId == GuidHelper.ToGuidString(seed.LegacyIssueId));

        var handler = new InventoryIssueApprovalHandler(context);
        var request = new ApprovalRequest { Status = ApprovalDecision.Approve, Reason = "matrix" };
        (await handler.HandleAsync(GuidHelper.ToGuidString(seed.ReconciliationIssueId), request, seed.UserId)).Should().BeNull();
        (await handler.HandleAsync(GuidHelper.ToGuidString(seed.LegacyIssueId), request, seed.UserId)).Should().BeNull();
        seed.MaterialRequest.Status.Should().Be("SENTTOWAREHOUSE");

        (await handler.HandleAsync(GuidHelper.ToGuidString(seed.DefaultIssueId), request, seed.UserId)).Should().NotBeNull();
        seed.MaterialRequest.Status.Should().Be("CONFIRMED");
    }

    [Fact]
    public async Task AuditAndCsv_Should_LabelEveryCollidingSourceFamily_WithExactAvailableIdentity()
    {
        await using var fixture = await WorkflowGenerationTests.WorkflowFixture.CreateAsync();
        await fixture.SeedMenuWithDemandAsync(includeMissingDish: false);
        await using var context = fixture.CreateContext();
        var seed = await SeedCollidingIssuesAsync(context, fixture);
        (await context.Inventoryissues.CountAsync()).Should().Be(3);
        (await context.Inventoryissuelines.CountAsync()).Should().Be(3);
        (await context.Inventoryissues.SelectMany(issue => issue.Inventoryissuelines).CountAsync()).Should().Be(3);
        var rows = await new AuditReportService(context)
            .GetAuditChangesAsync(new WorkflowReportQueryDto { Limit = 20 });

        rows.Should().NotBeEmpty();
        var issueRows = rows.Where(row => row.BusinessArea == "Issue").ToList();
        issueRows.Should().HaveCount(3, string.Join(" | ", rows.Select(row => $"{row.BusinessArea}:{row.EntityName}:{row.SourceFamily}")));
        var defaultRow = issueRows.Single(row => row.SourceFamily == "DEFAULT");
        defaultRow.MaterialRequestId.Should().Be(GuidHelper.ToGuidString(seed.MaterialRequest.RequestId));
        defaultRow.MaterialRequestLineId.Should().Be(GuidHelper.ToGuidString(seed.MaterialRequestLineId));
        defaultRow.ReconciliationBatchId.Should().BeNull();
        defaultRow.ReconciliationBatchLineId.Should().BeNull();

        var reconciliationRow = issueRows.Single(row => row.SourceFamily == "MATERIAL_RECONCILIATION");
        reconciliationRow.MaterialRequestId.Should().BeNull();
        reconciliationRow.MaterialRequestLineId.Should().BeNull();
        reconciliationRow.ReconciliationBatchId.Should().Be(GuidHelper.ToGuidString(seed.ReconciliationBatchId));
        reconciliationRow.ReconciliationBatchLineId.Should().Be(GuidHelper.ToGuidString(seed.ReconciliationBatchLineId));

        var legacyRow = issueRows.Single(row => row.SourceFamily == "LEGACY_UNCLASSIFIED");
        legacyRow.MaterialRequestId.Should().BeNull();
        legacyRow.MaterialRequestLineId.Should().BeNull();
        legacyRow.ReconciliationBatchId.Should().BeNull();
        legacyRow.ReconciliationBatchLineId.Should().BeNull();

        var filtered = await new AuditReportService(context).GetAuditChangesAsync(new WorkflowReportQueryDto
        {
            BusinessArea = "Issue",
            SourceFamily = "material_reconciliation",
            Limit = 20
        });
        filtered.Should().ContainSingle().Which.SourceFamily.Should().Be("MATERIAL_RECONCILIATION");

        var csv = Encoding.UTF8.GetString(AuditCsvExporter.Build(issueRows));
        csv.Should().Contain("sourceFamily,MaterialRequestId,MaterialRequestLineId,ReconciliationBatchId,ReconciliationBatchLineId");
        csv.Should().Contain("\"DEFAULT\"");
        csv.Should().Contain("\"MATERIAL_RECONCILIATION\"");
        csv.Should().Contain("\"LEGACY_UNCLASSIFIED\"");
        csv.Should().Contain(GuidHelper.ToGuidString(seed.MaterialRequestLineId));
        csv.Should().Contain(GuidHelper.ToGuidString(seed.ReconciliationBatchLineId));
    }

    [Theory]
    [InlineData("DEFAULT", true, false, true, false)]
    [InlineData("MATERIAL_RECONCILIATION", false, true, false, true)]
    [InlineData("LEGACY_UNCLASSIFIED", false, false, false, false)]
    public void SharedAuditMatrix_Should_Not_Fabricate_SourceIdentities(
        string sourceFamily,
        bool hasMaterialRequest,
        bool hasReconciliationBatch,
        bool hasMaterialRequestLine,
        bool hasReconciliationBatchLine)
    {
        var row = new AuditChangeReportDto
        {
            SourceFamily = sourceFamily,
            MaterialRequestId = hasMaterialRequest ? Guid.NewGuid().ToString() : null,
            ReconciliationBatchId = hasReconciliationBatch ? Guid.NewGuid().ToString() : null,
            MaterialRequestLineId = hasMaterialRequestLine ? Guid.NewGuid().ToString() : null,
            ReconciliationBatchLineId = hasReconciliationBatchLine ? Guid.NewGuid().ToString() : null
        };

        (row.MaterialRequestId is not null).Should().Be(hasMaterialRequest);
        (row.ReconciliationBatchId is not null).Should().Be(hasReconciliationBatch);
        (row.MaterialRequestLineId is not null).Should().Be(hasMaterialRequestLine);
        (row.ReconciliationBatchLineId is not null).Should().Be(hasReconciliationBatchLine);
    }

    private static async Task<CollidingIssueSeed> SeedCollidingIssuesAsync(
        IpcManagementContext context,
        WorkflowGenerationTests.WorkflowFixture fixture)
    {
        var demand = await new MaterialDemandService(context).GenerateAsync(
            new GenerateMaterialDemandRequest { ServiceDate = "2026-06-15", Scope = "FULLDAY" },
            fixture.UserIdString);
        demand.Should().NotBeNull();
        var materialRequest = await context.Materialrequests.SingleAsync();
        var materialRequestLine = await context.Materialrequestlines.SingleAsync();
        materialRequest.Status = "SENTTOWAREHOUSE";

        var reconciliationBatchId = GuidHelper.NewId();
        var reconciliationBatchLineId = GuidHelper.NewId();
        var defaultIssueId = GuidHelper.NewId();
        var reconciliationIssueId = GuidHelper.NewId();
        var legacyIssueId = GuidHelper.NewId();

        context.Inventoryissues.AddRange(
            BuildIssue(defaultIssueId, "ISS-DEFAULT", materialRequest.RequestId, null, materialRequestLine.RequestLineId, null),
            BuildIssue(reconciliationIssueId, "ISS-RECON", null, reconciliationBatchId, null, reconciliationBatchLineId),
            BuildIssue(legacyIssueId, "ISS-LEGACY", null, null, null, null));
        await context.SaveChangesAsync();

        return new CollidingIssueSeed(
            fixture.UserId, materialRequest, materialRequestLine.RequestLineId, reconciliationBatchId, reconciliationBatchLineId,
            defaultIssueId, reconciliationIssueId, legacyIssueId);

        InventoryIssue BuildIssue(
            byte[] issueId,
            string code,
            byte[]? requestId,
            byte[]? batchId,
            byte[]? requestLineId,
            byte[]? batchLineId)
            => new()
            {
                IssueId = issueId,
                IssueCode = code,
                IssueDate = new DateOnly(2026, 6, 15),
                ShiftName = "MORNING",
                WarehouseId = fixture.WarehouseId,
                MaterialRequestId = requestId,
                ReconciliationBatchId = batchId,
                IssuedBy = fixture.UserId,
                CreatedAt = DateTime.UtcNow,
                Inventoryissuelines =
                [
                    new InventoryIssueLine
                    {
                        IssueLineId = GuidHelper.NewId(),
                        IssueId = issueId,
                        MaterialRequestLineId = requestLineId,
                        ReconciliationBatchLineId = batchLineId,
                        IngredientId = fixture.IngredientId,
                        UnitId = fixture.UnitId,
                        RequestedQty = 7,
                        IssuedQty = 7
                    }
                ]
            };
    }

    private sealed record CollidingIssueSeed(
        byte[] UserId,
        MaterialRequest MaterialRequest,
        byte[] MaterialRequestLineId,
        byte[] ReconciliationBatchId,
        byte[] ReconciliationBatchLineId,
        byte[] DefaultIssueId,
        byte[] ReconciliationIssueId,
        byte[] LegacyIssueId);
}
