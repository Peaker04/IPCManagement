using FluentAssertions;
using IPCManagement.Api.Exceptions;
using NSubstitute;
using IPCManagement.Api.Data;
using IPCManagement.Api.Data.Transactions;
using IPCManagement.Api.Data.Repositories;
using IPCManagement.Api.Helpers;
using IPCManagement.Api.Models.Entities;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using System.Data.Common;
using System.Diagnostics;
using System.Reflection;
using System.Security.Claims;
using IPCManagement.Api.Features.Approvals.Contracts;
using IPCManagement.Api.Features.Approvals.Services;
using IPCManagement.Api.Features.Coordination.Contracts;
using IPCManagement.Api.Features.Coordination.Services;
using IPCManagement.Api.Features.Inventory.Contracts;
using IPCManagement.Api.Features.Inventory.Services;
using IPCManagement.Api.Features.Planning.Contracts;
using IPCManagement.Api.Features.Planning.Services;
using IPCManagement.Api.Features.Purchasing.Contracts;
using IPCManagement.Api.Features.Purchasing.Services;
using IPCManagement.Api.Features.Reports.Contracts;
using IPCManagement.Api.Features.Reports.Services;
using IPCManagement.Api.Features.SampleData.Services;
using IPCManagement.Api.Shared.Contracts;

namespace IPCManagement.Api.Tests;

public partial class WorkflowGenerationTests
{
    [Fact]
    public async Task ApprovalInbox_Should_SurfacePriceAlerts_AsPendingPurchaseApprovalItems()
    {
        await using var fixture = await WorkflowFixture.CreateAsync();
        await fixture.SeedMenuWithDemandAsync(includeMissingDish: false);

        string purchaseRequestId;
        string purchaseRequestLineId;
        await using (var context = fixture.CreateContext())
        {
            var demand = await new MaterialDemandService(context).GenerateAsync(
                new GenerateMaterialDemandRequest { ServiceDate = "2026-06-15", Scope = "FULLDAY" },
                fixture.UserIdString);
            var materialRequest = await context.Materialrequests.SingleAsync();
            materialRequest.Status = "MANAGERAPPROVED";
            await context.SaveChangesAsync();

            var purchase = await CreatePurchaseRequestWorkflowService(context).GenerateFromDemandAsync(
                new GeneratePurchaseRequestFromDemandRequest { MaterialRequestId = demand!.MaterialRequestId },
                fixture.UserIdString);
            purchaseRequestId = purchase!.PurchaseRequestId;
            purchaseRequestLineId = purchase.Lines.Single().PurchaseRequestLineId;
        }

        await using (var context = fixture.CreateContext())
        {
            await ConfirmSupplierFromQuotationAsync(
                context,
                fixture.UserIdString,
                purchaseRequestId,
                purchaseRequestLineId,
                fixture.SupplierId,
                1200m);
        }

        await using (var context = fixture.CreateContext())
        {
            var inbox = await new ApprovalInboxService(context, Substitute.For<IApprovalRoutingService>())
                .GetPendingAsync(BuildPrincipal("Manager"), new ApprovalInboxQueryDto { Limit = 100 });

            var priceExceptionId = GuidHelper.ToGuidString(
                (await context.Purchasepriceexceptions.AsNoTracking().SingleAsync()).PurchasePriceExceptionId);
            var alert = inbox.Should().ContainSingle(item => item.ItemType == "price-exception").Subject;
            alert.TargetType.Should().Be("purchase-price-exception");
            alert.TargetId.Should().Be(priceExceptionId);
            alert.Tone.Should().Be("danger");
            alert.Materials.Should().ContainSingle(item => item.Name == "Ingredient" && item.Quantity == 200m);
        }
    }

    [Fact]
    public async Task ApprovalDecision_Should_WriteActorTimestampReason_AndUpdateDownstreamStatus()
    {
        await using var fixture = await WorkflowFixture.CreateAsync();
        await fixture.SeedMenuWithDemandAsync(includeMissingDish: false);

        string purchaseRequestId;
        await using (var context = fixture.CreateContext())
        {
            var demand = await new MaterialDemandService(context).GenerateAsync(
                new GenerateMaterialDemandRequest { ServiceDate = "2026-06-15", Scope = "FULLDAY" },
                fixture.UserIdString);
            var materialRequest = await context.Materialrequests.SingleAsync();
            materialRequest.Status = "MANAGERAPPROVED";
            await context.SaveChangesAsync();

            var purchase = await CreatePurchaseRequestWorkflowService(context).GenerateFromDemandAsync(
                new GeneratePurchaseRequestFromDemandRequest { MaterialRequestId = demand!.MaterialRequestId },
                fixture.UserIdString);
            await SelectDefaultSupplierAsync(context, fixture, purchase!);
            await CreatePurchaseRequestWorkflowService(context).SubmitAsync(purchase!.PurchaseRequestId, fixture.UserIdString);
            purchaseRequestId = purchase.PurchaseRequestId;
        }

        await using (var context = fixture.CreateContext())
        {
            var service = new ApprovalWorkflowService([new PurchaseRequestApprovalHandler(context)]);
            var before = DateTime.UtcNow.AddSeconds(-1);
            var result = await service.ExecuteAsync(
                "purchase-request",
                purchaseRequestId,
                new ApprovalRequest { Status = ApprovalDecision.Approve, Reason = "Đủ điều kiện mua" },
                fixture.UserIdString);
            var after = DateTime.UtcNow.AddSeconds(1);

            result.Should().NotBeNull();
            result!.OldStatus.Should().Be("SENTTOSUPPLIER");
            result.NewStatus.Should().Be("APPROVED");
            result.ActionAt.Should().BeOnOrAfter(before).And.BeOnOrBefore(after);

            var purchaseStatus = await context.Purchaserequests.AsNoTracking()
                .Select(item => item.Status)
                .SingleAsync();
            purchaseStatus.Should().Be("APPROVED");

            var history = await context.Approvalhistories.AsNoTracking().SingleAsync();
            history.TargetType.Should().Be("purchase-request");
            history.ActionBy.Should().Equal(fixture.UserId);
            history.Reason.Should().Be("Đủ điều kiện mua");
            history.ActionAt.Should().BeOnOrAfter(before).And.BeOnOrBefore(after);
        }
    }

    [Fact]
    public async Task ApprovalDecision_Should_RequireReason_WhenRejecting()
    {
        await using var fixture = await WorkflowFixture.CreateAsync();
        await fixture.SeedMenuWithDemandAsync(includeMissingDish: false);

        await using var context = fixture.CreateContext();
        var service = new ApprovalWorkflowService([new PurchaseRequestApprovalHandler(context)]);
        var act = async () => await service.ExecuteAsync(
            "purchase-request",
            GuidHelper.ToGuidString(GuidHelper.NewId()),
            new ApprovalRequest { Status = ApprovalDecision.Reject, Reason = " " },
            fixture.UserIdString);

        await act.Should().ThrowAsync<ArgumentException>()
            .WithMessage("Lý do từ chối không được để trống.");
        (await context.Approvalhistories.AsNoTracking().CountAsync()).Should().Be(0);
    }

    [Fact]
    public async Task ApprovalDecision_Should_RejectWithReason_AndUpdateDownstreamStatus()
    {
        await using var fixture = await WorkflowFixture.CreateAsync();
        await fixture.SeedMenuWithDemandAsync(includeMissingDish: false);
        var purchaseRequestId = await SeedSubmittedPurchaseRequestAsync(fixture);

        await using var context = fixture.CreateContext();
        var service = new ApprovalWorkflowService([new PurchaseRequestApprovalHandler(context)]);
        var result = await service.ExecuteAsync(
            "purchase-request",
            purchaseRequestId,
            new ApprovalRequest { Status = ApprovalDecision.Reject, Reason = "Thiếu báo giá" },
            fixture.UserIdString,
            BuildPrincipal("Manager"));

        result.Should().NotBeNull();
        result!.OldStatus.Should().Be("SENTTOSUPPLIER");
        result.NewStatus.Should().Be("REJECTED");

        (await context.Purchaserequests.AsNoTracking().Select(item => item.Status).SingleAsync())
            .Should().Be("REJECTED");
        var history = await context.Approvalhistories.AsNoTracking().SingleAsync();
        history.Decision.Should().Be("REJECT");
        history.Reason.Should().Be("Thiếu báo giá");
        history.ActionBy.Should().Equal(fixture.UserId);
    }

    [Fact]
    public async Task ApprovalDecision_Should_BlockUnauthorizedApproverRole()
    {
        await using var fixture = await WorkflowFixture.CreateAsync();
        await fixture.SeedMenuWithDemandAsync(includeMissingDish: false);
        var purchaseRequestId = await SeedSubmittedPurchaseRequestAsync(fixture);

        await using var context = fixture.CreateContext();
        var service = new ApprovalWorkflowService([new PurchaseRequestApprovalHandler(context)]);
        var act = async () => await service.ExecuteAsync(
            "purchase-request",
            purchaseRequestId,
            new ApprovalRequest { Status = ApprovalDecision.Approve, Reason = "Không đúng quyền" },
            fixture.UserIdString,
            BuildPrincipal("Điều phối"));

        await act.Should().ThrowAsync<UnauthorizedAccessException>()
            .WithMessage("Không có quyền phê duyệt chứng từ này.");
        (await context.Purchaserequests.AsNoTracking().Select(item => item.Status).SingleAsync())
            .Should().Be("SENTTOSUPPLIER");
        (await context.Approvalhistories.AsNoTracking().CountAsync()).Should().Be(0);
    }

    [Fact]
    public async Task ApprovalDecision_Should_BlockDoubleApprove_WithoutDuplicateHistory()
    {
        await using var fixture = await WorkflowFixture.CreateAsync();
        await fixture.SeedMenuWithDemandAsync(includeMissingDish: false);
        var purchaseRequestId = await SeedSubmittedPurchaseRequestAsync(fixture);

        await using var context = fixture.CreateContext();
        var service = new ApprovalWorkflowService([new PurchaseRequestApprovalHandler(context)]);
        await service.ExecuteAsync(
            "purchase-request",
            purchaseRequestId,
            new ApprovalRequest { Status = ApprovalDecision.Approve, Reason = "Lần đầu" },
            fixture.UserIdString,
            BuildPrincipal("Manager"));

        var act = async () => await service.ExecuteAsync(
            "purchase-request",
            purchaseRequestId,
            new ApprovalRequest { Status = ApprovalDecision.Approve, Reason = "Lần hai" },
            fixture.UserIdString,
            BuildPrincipal("Manager"));

        await act.Should().ThrowAsync<BusinessRuleException>()
            .WithMessage("Phiếu này đã được xử lý.");
        (await context.Purchaserequests.AsNoTracking().Select(item => item.Status).SingleAsync())
            .Should().Be("APPROVED");
        (await context.Approvalhistories.AsNoTracking().CountAsync()).Should().Be(1);
    }

}
