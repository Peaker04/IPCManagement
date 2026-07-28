


using IPCManagement.Api.Data;
using IPCManagement.Api.Helpers;
using IPCManagement.Api.Models.Entities;
using Microsoft.EntityFrameworkCore;
using System.Globalization;
using IPCManagement.Api.Features.Purchasing.Contracts;

namespace IPCManagement.Api.Features.Purchasing.Services;

public class PurchaseRequestWorkflowService : IPurchaseRequestWorkflowService
{
    private const string PurchaseDraftStatus = "DRAFT";
    private const string PurchaseSubmittedStatus = "SENTTOSUPPLIER";
    private static readonly HashSet<string> ApprovedDemandStatuses = new(StringComparer.OrdinalIgnoreCase)
    {
        "MANAGERAPPROVED",
        "APPROVED"
    };

    private readonly IpcManagementContext _context;
    private readonly ISupplierQuotationService _supplierQuotationService;
    private readonly IPurchaseWorkbenchService _purchaseWorkbenchService;
    private readonly IPurchaseRequestGenerationService _purchaseRequestGenerationService;
    private readonly IPurchaseSupplierDecisionService _purchaseSupplierDecisionService;

    public PurchaseRequestWorkflowService(
        IpcManagementContext context,
        ISupplierQuotationService supplierQuotationService)
        : this(
            context,
            supplierQuotationService,
            new PurchaseWorkbenchService(context),
            new PurchaseRequestGenerationService(context),
            new PurchaseSupplierDecisionService(context))
    {
    }

    public PurchaseRequestWorkflowService(
        IpcManagementContext context,
        ISupplierQuotationService supplierQuotationService,
        IPurchaseWorkbenchService purchaseWorkbenchService)
        : this(
            context,
            supplierQuotationService,
            purchaseWorkbenchService,
            new PurchaseRequestGenerationService(context),
            new PurchaseSupplierDecisionService(context))
    {
    }

    public PurchaseRequestWorkflowService(
        IpcManagementContext context,
        ISupplierQuotationService supplierQuotationService,
        IPurchaseWorkbenchService purchaseWorkbenchService,
        IPurchaseRequestGenerationService purchaseRequestGenerationService)
        : this(
            context,
            supplierQuotationService,
            purchaseWorkbenchService,
            purchaseRequestGenerationService,
            new PurchaseSupplierDecisionService(context))
    {
    }

    public PurchaseRequestWorkflowService(
        IpcManagementContext context,
        ISupplierQuotationService supplierQuotationService,
        IPurchaseWorkbenchService purchaseWorkbenchService,
        IPurchaseRequestGenerationService purchaseRequestGenerationService,
        IPurchaseSupplierDecisionService purchaseSupplierDecisionService)
    {
        _context = context;
        _supplierQuotationService = supplierQuotationService;
        _purchaseWorkbenchService = purchaseWorkbenchService;
        _purchaseRequestGenerationService = purchaseRequestGenerationService;
        _purchaseSupplierDecisionService = purchaseSupplierDecisionService;
    }

    public Task<PurchaseWorkbenchWeekDto> GetWorkbenchWeekAsync(
        PurchaseWorkbenchQueryDto query,
        CancellationToken cancellationToken = default)
        => _purchaseWorkbenchService.GetWorkbenchWeekAsync(query, cancellationToken);

    public Task<PurchaseRequestWorkflowResultDto?> GenerateFromDemandAsync(
        GeneratePurchaseRequestFromDemandRequest request,
        string? userId,
        CancellationToken cancellationToken = default)
        => _purchaseRequestGenerationService.GenerateFromDemandAsync(
            request,
            userId,
            cancellationToken);

    public Task<SupplierEvidenceResultDto> GetSupplierEvidenceAsync(
        string requestId,
        string lineId,
        CancellationToken cancellationToken = default)
        => _purchaseSupplierDecisionService.GetSupplierEvidenceAsync(
            requestId,
            lineId,
            cancellationToken);

    public Task<PurchaseLineSupplierDecisionDto> ConfirmLineSupplierAsync(
        string requestId,
        string lineId,
        ConfirmPurchaseLineSupplierRequest request,
        string? userId,
        CancellationToken cancellationToken = default)
        => _purchaseSupplierDecisionService.ConfirmLineSupplierAsync(
            requestId,
            lineId,
            request,
            userId,
            cancellationToken);

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

        if (purchaseRequest.Status == PurchaseSubmittedStatus)
        {
            return MapResult(purchaseRequest, materialRequest.RequestId, purchaseRequest.Purchaserequestlines);
        }

        if (purchaseRequest.Status != PurchaseDraftStatus)
        {
            throw new InvalidOperationException("Chỉ được gửi đơn mua khi danh sách còn ở trạng thái nháp.");
        }

        var oldStatus = purchaseRequest.Status;
        purchaseRequest.Status = PurchaseSubmittedStatus;
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
            NewValue = PurchaseSubmittedStatus,
            Reason = "Gửi đơn mua chính thức từ nhu cầu đã duyệt."
        });

        await _context.SaveChangesAsync(cancellationToken);

        return MapResult(purchaseRequest, materialRequest.RequestId, purchaseRequest.Purchaserequestlines);
    }

    private static string BuildKey(byte[] value)
        => Convert.ToBase64String(value);

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
            .Select(line => BuildKey(line.MaterialRequestLine.RequestId))
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

        if (supplementalRequest is null && !ApprovedDemandStatuses.Contains(materialRequest.Status))
        {
            throw new InvalidOperationException("Cần duyệt nhu cầu nguyên liệu trước khi gửi đơn mua.");
        }

        var currentShortageLineIds = materialRequest.Materialrequestlines
            .Where(line => PurchaseRequestPlanner.CalculatePurchaseQty(line.SuggestedPurchaseQty) > 0)
            .Select(line => BuildKey(line.RequestLineId))
            .ToHashSet();
        var purchaseLineDemandIds = purchaseRequest.Purchaserequestlines
            .Select(line => BuildKey(line.MaterialRequestLineId))
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

        ValidateCurrentSupplierDecisionsAsync(purchaseRequest);
        ValidatePriceExceptionsAsync(purchaseRequest);

    }

    private static void ValidateCurrentSupplierDecisionsAsync(PurchaseRequest purchaseRequest)
    {
        foreach (var line in purchaseRequest.Purchaserequestlines)
        {
            var currentDecision = line.SupplierDecisions.SingleOrDefault(decision =>
                string.Equals(decision.Status, "CURRENT", StringComparison.Ordinal));
            if (currentDecision is null ||
                line.SupplierId is null ||
                !currentDecision.SupplierId.SequenceEqual(line.SupplierId) ||
                currentDecision.ProposedUnitPrice != DecimalPolicy.RoundMoney(line.EstimatedUnitPrice) ||
                currentDecision.ProposedDeliveryDate != line.ExpectedDeliveryDate)
            {
                throw new InvalidOperationException("Có dòng mua chưa có quyết định nhà cung cấp hiện hành hợp lệ.");
            }
        }

    }

    private static void ValidatePriceExceptionsAsync(PurchaseRequest purchaseRequest)
    {
        foreach (var line in purchaseRequest.Purchaserequestlines)
        {
            var currentDecision = line.SupplierDecisions.Single(decision =>
                string.Equals(decision.Status, "CURRENT", StringComparison.Ordinal));
            var variance = PurchasePricePolicy.CalculateVariancePercent(
                currentDecision.EvidenceReferencePrice,
                currentDecision.ProposedUnitPrice);
            if (!PurchasePricePolicy.RequiresException(variance))
            {
                continue;
            }

            var currentException = currentDecision.Purchasepriceexceptions.SingleOrDefault(priceException =>
                string.Equals(priceException.ProposalFingerprint, currentDecision.DecisionFingerprint, StringComparison.Ordinal) &&
                priceException.ProposalVersion == currentDecision.Version &&
                !string.Equals(priceException.Status, "SUPERSEDED", StringComparison.Ordinal));
            if (currentException is null)
            {
                throw new InvalidOperationException(
                    "Có dòng mua cần ngoại lệ giá hiện hành trước khi gửi đơn mua.");

            }

            if (string.Equals(currentException.Status, "REJECTED", StringComparison.Ordinal))
            {
                throw new InvalidOperationException(
                    "Ngoại lệ giá đã bị từ chối; hãy cập nhật và gửi lại đề xuất giá.");
            }

            if (!string.Equals(currentException.Status, "APPROVED", StringComparison.Ordinal))
            {
                throw new InvalidOperationException(
                    "Có dòng mua cần ngoại lệ giá được Quản lý duyệt trước khi gửi đơn mua.");
            }
        }

    }

    private static PurchaseRequestWorkflowResultDto MapResult(
        PurchaseRequest purchaseRequest,
        byte[] materialRequestId,
        IEnumerable<PurchaseRequestLine> lines)
        => new()
        {
            PurchaseRequestId = GuidHelper.ToGuidString(purchaseRequest.PurchaseRequestId),
            PurchaseRequestCode = purchaseRequest.PurchaseRequestCode,
            MaterialRequestId = GuidHelper.ToGuidString(materialRequestId),
            PurchaseForDate = purchaseRequest.PurchaseForDate.ToString("yyyy-MM-dd"),
            ShiftName = purchaseRequest.ShiftName,
            Status = purchaseRequest.Status,
            Lines = lines
                .OrderBy(line => line.Ingredient.IngredientName)
                .Select(MapLine)
                .ToList()
        };

    private static PurchaseRequestWorkflowLineDto MapLine(PurchaseRequestLine line)
    {
        var decisions = line.SupplierDecisions
            .OrderByDescending(decision => decision.Version)
            .ThenByDescending(decision => decision.ConfirmedAt)
            .Select(MapSupplierDecision)
            .ToList();
        var currentDecision = decisions.SingleOrDefault(decision =>
            string.Equals(decision.Status, "CURRENT", StringComparison.Ordinal));

        return new PurchaseRequestWorkflowLineDto
        {
            PurchaseRequestLineId = GuidHelper.ToGuidString(line.PurchaseRequestLineId),
            MaterialRequestLineId = GuidHelper.ToGuidString(line.MaterialRequestLineId),
            IngredientId = GuidHelper.ToGuidString(line.IngredientId),
            IngredientName = line.Ingredient.IngredientName,
            SupplierId = line.SupplierId is null ? null : GuidHelper.ToGuidString(line.SupplierId),
            SupplierName = line.Supplier?.SupplierName,
            UnitId = GuidHelper.ToGuidString(line.UnitId),
            UnitName = line.Unit.UnitName,
            RequiredQty = line.RequiredQty,
            CurrentStockQty = line.CurrentStockQty,
            PurchaseQty = line.PurchaseQty,
            EstimatedUnitPrice = line.EstimatedUnitPrice,
            ExpectedDeliveryDate = line.ExpectedDeliveryDate?.ToString("yyyy-MM-dd"),
            Note = line.Note,
            SupplierDecisionStatus = currentDecision is not null
                ? "CONFIRMED"
                : line.IsLegacySupplierSnapshot
                    ? "LEGACY"
                    : "BLOCKED",
            CurrentSupplierDecision = currentDecision,
            SupplierDecisionHistory = decisions
        };
    }

    private static PurchaseLineSupplierDecisionDto MapSupplierDecision(
        PurchaseLineSupplierDecision decision)
        => new()
        {
            PurchaseLineSupplierDecisionId = GuidHelper.ToGuidString(decision.PurchaseLineSupplierDecisionId),
            SupplierId = GuidHelper.ToGuidString(decision.SupplierId),
            EvidenceType = FromPersistenceEvidenceType(decision.EvidenceType),
            EvidenceId = GuidHelper.ToGuidString(decision.EvidenceId),
            EvidenceDate = decision.EvidenceDate.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture),
            EvidenceReferencePrice = decision.EvidenceReferencePrice,
            ProposedUnitPrice = decision.ProposedUnitPrice,
            ProposedDeliveryDate = decision.ProposedDeliveryDate.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture),
            ConfirmedBy = GuidHelper.ToGuidString(decision.ConfirmedBy),
            ConfirmedAt = decision.ConfirmedAt.ToUniversalTime().ToString("O", CultureInfo.InvariantCulture),
            DecisionFingerprint = decision.DecisionFingerprint,
            Version = decision.Version,
            Status = decision.Status,
            SupersededByDecisionId = decision.SupersededByDecisionId is null
                ? null
                : GuidHelper.ToGuidString(decision.SupersededByDecisionId),
            ConcurrencyVersion = decision.ConcurrencyVersion
        };

    private static SupplierEvidenceType FromPersistenceEvidenceType(string evidenceType)
        => evidenceType switch
        {
            "EFFECTIVE_QUOTATION" => SupplierEvidenceType.EffectiveQuotation,
            "LATEST_VALID_RECEIPT" => SupplierEvidenceType.LatestValidReceipt,
            _ => throw new InvalidOperationException($"Loại bằng chứng nhà cung cấp không hợp lệ: {evidenceType}.")
        };

}
