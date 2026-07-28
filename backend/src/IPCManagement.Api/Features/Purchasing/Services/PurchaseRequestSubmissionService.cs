using IPCManagement.Api.Data;
using IPCManagement.Api.Features.Purchasing.Contracts;
using IPCManagement.Api.Helpers;
using IPCManagement.Api.Models.Entities;
using Microsoft.EntityFrameworkCore;

namespace IPCManagement.Api.Features.Purchasing.Services;

public sealed class PurchaseRequestSubmissionService : IPurchaseRequestSubmissionService
{
    private const string DraftStatus = "DRAFT";
    private const string SubmittedStatus = "SENTTOSUPPLIER";

    private readonly IpcManagementContext _context;

    public PurchaseRequestSubmissionService(IpcManagementContext context)
    {
        _context = context;
    }

    public async Task<PurchaseRequestWorkflowResultDto?> SubmitAsync(
        string requestId,
        string? userId,
        CancellationToken cancellationToken = default)
    {
        var prIdBytes = GuidHelper.ParseGuidString(requestId);
        var userIdBytes = GuidHelper.ParseGuidString(userId);
        if (prIdBytes is null || userIdBytes is null)
        {
            throw new ArgumentException("Mã tham chiếu không hợp lệ.");
        }

        var purchaseRequest = await _context.Purchaserequests
            .Include(item => item.Purchaserequestlines)
                .ThenInclude(line => line.Ingredient)
            .Include(item => item.Purchaserequestlines)
                .ThenInclude(line => line.Supplier)
            .Include(item => item.Purchaserequestlines)
                .ThenInclude(line => line.Unit)
            .Include(item => item.Purchaserequestlines)
                .ThenInclude(line => line.MaterialRequestLine)
            .Include(item => item.Purchaserequestlines)
                .ThenInclude(line => line.SupplierDecisions)
                    .ThenInclude(decision => decision.Purchasepriceexceptions)
            .FirstOrDefaultAsync(item => item.PurchaseRequestId == prIdBytes, cancellationToken);
        if (purchaseRequest is null)
        {
            return null;
        }

        var materialRequest = await ResolveMaterialRequestForSubmitAsync(purchaseRequest, cancellationToken);
        await ValidateSubmitAsync(purchaseRequest, materialRequest, cancellationToken);

        if (purchaseRequest.Status == SubmittedStatus)
        {
            return PurchaseWorkflowMapper.MapResult(purchaseRequest, materialRequest.RequestId, purchaseRequest.Purchaserequestlines);
        }

        if (purchaseRequest.Status != DraftStatus)
        {
            throw new InvalidOperationException("Chỉ được gửi đơn mua khi danh sách còn ở trạng thái nháp.");
        }

        var oldStatus = purchaseRequest.Status;
        purchaseRequest.Status = SubmittedStatus;
        _context.Auditlogs.Add(new AuditLog
        {
            AuditId = GuidHelper.NewId(),
            ChangedAt = DateTime.UtcNow,
            ChangedBy = userIdBytes,
            BusinessArea = "Purchasing",
            EntityName = nameof(PurchaseRequest),
            EntityId = purchaseRequest.PurchaseRequestId,
            FieldName = "Submit",

            OldValue = oldStatus,
            NewValue = SubmittedStatus,
            Reason = "Gửi đơn mua chính thức từ nhu cầu đã duyệt."
        });

        await _context.SaveChangesAsync(cancellationToken);

        return PurchaseWorkflowMapper.MapResult(purchaseRequest, materialRequest.RequestId, purchaseRequest.Purchaserequestlines);

    }

    private async Task<MaterialRequest> ResolveMaterialRequestForSubmitAsync(
        PurchaseRequest purchaseRequest,
        CancellationToken cancellationToken)
    {
        if (purchaseRequest.Purchaserequestlines.Count == 0)
        {
            throw new InvalidOperationException("Danh sách mua chưa có dòng nguyên liệu hợp lệ.");
        }

        if (purchaseRequest.Purchaserequestlines.Any(line => line.MaterialRequestLine is null))
        {
            throw new InvalidOperationException("Danh sách mua đã cũ, vui lòng tạo lại từ nhu cầu hiện tại.");
        }

        var requestIds = purchaseRequest.Purchaserequestlines
            .Select(line => PurchaseRequestSubmissionPolicy.BuildKey(line.MaterialRequestLine.RequestId))
            .Distinct()
            .ToList();
        if (requestIds.Count != 1)
        {
            throw new InvalidOperationException("Danh sách mua đã cũ, vui lòng tạo lại từ nhu cầu hiện tại.");
        }

        var requestId = purchaseRequest.Purchaserequestlines.First().MaterialRequestLine.RequestId;
        var materialRequest = await _context.Materialrequests
            .Include(item => item.Materialrequestlines)
            .FirstOrDefaultAsync(item => item.RequestId == requestId, cancellationToken);

        return materialRequest
            ?? throw new InvalidOperationException("Danh sách mua đã cũ, vui lòng tạo lại từ nhu cầu hiện tại.");
    }

    private async Task ValidateSubmitAsync(
        PurchaseRequest purchaseRequest,
        MaterialRequest materialRequest,
        CancellationToken cancellationToken)
    {
        var purchaseRequestId = GuidHelper.ToGuidString(purchaseRequest.PurchaseRequestId);
        var supplementalAudit = await _context.Auditlogs
            .AsNoTracking()
            .Where(item => item.EntityName == nameof(SupplementalMaterialRequest) &&
                item.FieldName == "PurchaseRequestId" &&
                item.NewValue == purchaseRequestId)
            .OrderByDescending(item => item.ChangedAt)
            .FirstOrDefaultAsync(cancellationToken);
        var supplementalRequest = supplementalAudit is null
            ? null
            : await _context.Supplementalmaterialrequests
                .AsNoTracking()
                .FirstOrDefaultAsync(item => item.RequestId == supplementalAudit.EntityId, cancellationToken);

        if (supplementalRequest is null && !PurchaseRequestSubmissionPolicy.IsApprovedDemandStatus(materialRequest.Status))
        {
            throw new InvalidOperationException("Cần duyệt nhu cầu nguyên liệu trước khi gửi đơn mua.");
        }

        var currentShortageLineIds = materialRequest.Materialrequestlines
            .Where(line => PurchaseRequestPlanner.CalculatePurchaseQty(line.SuggestedPurchaseQty) > 0)
            .Select(line => PurchaseRequestSubmissionPolicy.BuildKey(line.RequestLineId))
            .ToHashSet();
        var purchaseLineDemandIds = purchaseRequest.Purchaserequestlines
            .Select(line => PurchaseRequestSubmissionPolicy.BuildKey(line.MaterialRequestLineId))
            .ToHashSet();
        if (supplementalRequest is null && !currentShortageLineIds.SetEquals(purchaseLineDemandIds))
        {
            throw new InvalidOperationException("Danh sách mua đã cũ, vui lòng tạo lại từ nhu cầu hiện tại.");
        }

        if (supplementalRequest is not null)
        {
            var fulfilledQty = await _context.Stockmovements
                .AsNoTracking()
                .Where(item => item.RefTable == "supplementalmaterialrequests" &&
                    item.RefId == supplementalRequest.RequestId)
                .SumAsync(item => (decimal?)item.QuantityOut, cancellationToken) ?? 0;
            var remainingQty = DecimalPolicy.RoundQuantity(
                Math.Max(supplementalRequest.RequestedQty - fulfilledQty, 0));
            if (!(string.Equals(supplementalRequest.Status, "NEEDS_PURCHASE", StringComparison.OrdinalIgnoreCase) ||
                    string.Equals(supplementalRequest.Status, "PARTIALLY_FULFILLED", StringComparison.OrdinalIgnoreCase)) ||
                purchaseRequest.Purchaserequestlines.Count != 1 ||
                purchaseRequest.Purchaserequestlines.Any(line =>
                    !line.IngredientId.SequenceEqual(supplementalRequest.IngredientId) ||
                    !line.UnitId.SequenceEqual(supplementalRequest.UnitId) ||
                    line.PurchaseQty <= 0 ||
                    DecimalPolicy.GreaterThanQuantity(line.PurchaseQty, remainingQty)))
            {
                throw new InvalidOperationException("Đề xuất mua bổ sung không còn khớp số lượng bếp đang thiếu. Hãy tải lại yêu cầu.");
            }
        }

        foreach (var line in purchaseRequest.Purchaserequestlines)
        {
            if (line.SupplierId is null || line.Supplier is null || line.Supplier.IsActive == false)
            {
                throw new InvalidOperationException("Có dòng mua chưa chọn nhà cung cấp hợp lệ.");
            }

            if (line.PurchaseQty <= 0 || line.EstimatedUnitPrice <= 0)
            {
                throw new InvalidOperationException("Có dòng mua thiếu số lượng hoặc giá dự kiến hợp lệ.");
            }

        }

        PurchaseRequestSubmissionPolicy.ValidateCurrentSupplierDecisions(purchaseRequest);
        PurchaseRequestSubmissionPolicy.ValidatePriceExceptions(purchaseRequest);

    }

}

