using IPCManagement.Api.Data;
using IPCManagement.Api.Helpers;
using IPCManagement.Api.Models.DTOs.Workflow;
using IPCManagement.Api.Models.Entities;
using IPCManagement.Api.Services;
using Microsoft.EntityFrameworkCore;

namespace IPCManagement.Api.Services.Workflow;

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

    public PurchaseRequestWorkflowService(IpcManagementContext context, ISupplierQuotationService supplierQuotationService)
    {
        _context = context;
        _supplierQuotationService = supplierQuotationService;
    }

    public async Task<PurchaseRequestWorkflowResultDto?> GenerateFromDemandAsync(
        GeneratePurchaseRequestFromDemandDto request,
        string? userId,
        CancellationToken cancellationToken = default)
    {
        var userIdBytes = GuidHelper.ParseGuidString(userId);
        var materialRequestId = GuidHelper.ParseGuidString(request.MaterialRequestId);
        if (userIdBytes is null || materialRequestId is null)
        {
            return null;
        }

        var materialRequest = await _context.Materialrequests
            .Include(item => item.Materialrequestlines)
                .ThenInclude(line => line.Ingredient)
            .Include(item => item.Materialrequestlines)
                .ThenInclude(line => line.Unit)
            .Include(item => item.Plan)
            .FirstOrDefaultAsync(item => item.RequestId == materialRequestId, cancellationToken);
        if (materialRequest is null)
        {
            return null;
        }

        var shortageLines = materialRequest.Materialrequestlines
            .Where(line => PurchaseRequestPlanner.CalculatePurchaseQty(line.SuggestedPurchaseQty) > 0)
            .OrderBy(line => line.Ingredient.IngredientName)
            .ToList();
        if (shortageLines.Count == 0)
        {
            return await ClearStalePurchaseRequestAsync(materialRequest, userIdBytes, cancellationToken);
        }

        var purchaseRequest = await EnsurePurchaseRequestAsync(materialRequest, userIdBytes, cancellationToken);
        var existingLines = await _context.Purchaserequestlines
            .Include(line => line.Ingredient)
            .Include(line => line.Supplier)
            .Include(line => line.Unit)
            .Where(line => line.PurchaseRequestId == purchaseRequest.PurchaseRequestId)
            .ToListAsync(cancellationToken);
        if (purchaseRequest.Status == PurchaseSubmittedStatus)
        {
            return MapResult(purchaseRequest, materialRequest.RequestId, existingLines);
        }

        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var ingredientIds = shortageLines
            .GroupBy(line => BuildKey(line.IngredientId))
            .Select(group => group.First().IngredientId)
            .ToList();
        var quotations = await _context.Supplierquotations
            .Include(quotation => quotation.Supplier)
            .Where(quotation =>
                ingredientIds.Contains(quotation.IngredientId) &&
                quotation.IsActive != false &&
                quotation.Supplier.IsActive != false &&
                quotation.EffectiveFrom <= today &&
                (quotation.EffectiveTo == null || quotation.EffectiveTo >= today))
            .ToListAsync(cancellationToken);
        var bestQuotationByIngredient = quotations
            .GroupBy(quotation => BuildKey(quotation.IngredientId))
            .ToDictionary(
                group => group.Key,
                group => group
                    .OrderBy(quotation => quotation.UnitPrice)
                    .ThenByDescending(quotation => quotation.EffectiveFrom)
                    .ThenBy(quotation => quotation.Supplier.SupplierName, StringComparer.OrdinalIgnoreCase)
                    .First());
        var activeSuppliers = await _context.Suppliers
            .Where(supplier => supplier.IsActive != false)
            .OrderBy(supplier => supplier.SupplierCode)
            .ToListAsync(cancellationToken);
        var supplierById = activeSuppliers.ToDictionary(supplier => BuildKey(supplier.SupplierId));
        var fallbackSupplier = activeSuppliers.FirstOrDefault();
        var receiptLines = await _context.Inventoryreceiptlines
            .Include(line => line.Unit)
            .Include(line => line.Receipt)
                .ThenInclude(receipt => receipt.Supplier)
            .Where(line => ingredientIds.Contains(line.IngredientId))
            .OrderByDescending(line => line.Receipt.ReceiptDate)
            .ThenByDescending(line => line.Receipt.CreatedAt)
            .ToListAsync(cancellationToken);
        var latestReceiptByIngredient = receiptLines
            .GroupBy(line => BuildKey(line.IngredientId))
            .ToDictionary(group => group.Key, group => group.First());
        var latestActiveReceiptSupplierByIngredient = receiptLines
            .Where(line => line.Receipt.Supplier.IsActive != false)
            .GroupBy(line => BuildKey(line.IngredientId))
            .ToDictionary(group => group.Key, group => group.First().Receipt.SupplierId);

        foreach (var line in shortageLines)
        {
            var ingredientKey = BuildKey(line.IngredientId);
            bestQuotationByIngredient.TryGetValue(ingredientKey, out var bestQuotation);
            if (bestQuotation is not null)
            {
                EnsurePurchaseRequestLine(purchaseRequest, line, bestQuotation.Supplier, bestQuotation.UnitPrice, existingLines);
                continue;
            }

            latestReceiptByIngredient.TryGetValue(ingredientKey, out var latestReceiptLine);
            var supplier = latestActiveReceiptSupplierByIngredient.TryGetValue(ingredientKey, out var receiptSupplierId) &&
                           supplierById.TryGetValue(BuildKey(receiptSupplierId), out var receiptSupplier)
                ? receiptSupplier
                : fallbackSupplier;
            if (supplier is null)
            {
                throw new InvalidOperationException($"Chưa có nhà cung cấp để tạo đề xuất mua cho '{line.Ingredient.IngredientName}'.");
            }

            var latestPrice = ResolveLatestReceiptPrice(latestReceiptLine, line.Unit);
            EnsurePurchaseRequestLine(
                purchaseRequest,
                line,
                supplier,
                PurchaseRequestPlanner.EstimateUnitPrice(latestPrice, line.Ingredient.ReferencePrice),
                existingLines);
        }

        var shortageLineIds = shortageLines
            .Select(line => BuildKey(line.RequestLineId))
            .ToHashSet();
        var staleLines = existingLines
            .Where(line => !shortageLineIds.Contains(BuildKey(line.MaterialRequestLineId)))
            .ToList();
        if (staleLines.Count > 0)
        {
            _context.Purchaserequestlines.RemoveRange(staleLines);
            existingLines.RemoveAll(line => staleLines.Any(stale => stale.PurchaseRequestLineId.SequenceEqual(line.PurchaseRequestLineId)));
        }

        _context.Auditlogs.Add(new Auditlog
        {
            AuditId = GuidHelper.NewId(),
            ChangedAt = DateTime.UtcNow,
            ChangedBy = userIdBytes,
            BusinessArea = "Purchasing",
            EntityName = nameof(Purchaserequest),
            EntityId = purchaseRequest.PurchaseRequestId,
            FieldName = "GenerateFromDemand",
            OldValue = null,
            NewValue = $"{shortageLines.Count} shortage lines; {existingLines.Count} purchase lines",
            Reason = "Sinh đề xuất mua hàng từ dòng thiếu nguyên liệu sau kiểm tồn."
        });

        await _context.SaveChangesAsync(cancellationToken);

        return MapResult(purchaseRequest, materialRequest.RequestId, existingLines);
    }

    private async Task<PurchaseRequestWorkflowResultDto?> ClearStalePurchaseRequestAsync(
        Materialrequest materialRequest,
        byte[] userId,
        CancellationToken cancellationToken)
    {
        var requestCode = BuildPurchaseRequestCode(materialRequest);
        var purchaseRequest = await _context.Purchaserequests
            .Include(item => item.Purchaserequestlines)
                .ThenInclude(line => line.Ingredient)
            .Include(item => item.Purchaserequestlines)
                .ThenInclude(line => line.Supplier)
            .Include(item => item.Purchaserequestlines)
                .ThenInclude(line => line.Unit)
            .FirstOrDefaultAsync(item => item.PurchaseRequestCode == requestCode, cancellationToken);
        if (purchaseRequest is null)
        {
            return null;
        }

        if (purchaseRequest.Status == PurchaseSubmittedStatus)
        {
            return MapResult(purchaseRequest, materialRequest.RequestId, purchaseRequest.Purchaserequestlines);
        }

        var staleCount = purchaseRequest.Purchaserequestlines.Count;
        if (staleCount > 0)
        {
            _context.Purchaserequestlines.RemoveRange(purchaseRequest.Purchaserequestlines);
        }

        purchaseRequest.Status = purchaseRequest.Status == PurchaseSubmittedStatus ? purchaseRequest.Status : PurchaseDraftStatus;
        _context.Auditlogs.Add(new Auditlog
        {
            AuditId = GuidHelper.NewId(),
            ChangedAt = DateTime.UtcNow,
            ChangedBy = userId,
            BusinessArea = "Purchasing",
            EntityName = nameof(Purchaserequest),
            EntityId = purchaseRequest.PurchaseRequestId,
            FieldName = "GenerateFromDemand",
            OldValue = $"{staleCount} stale purchase lines",
            NewValue = "0 shortage lines; 0 purchase lines",
            Reason = "Dọn đề xuất mua hàng cũ vì nhu cầu hiện tại không còn thiếu nguyên liệu."
        });

        await _context.SaveChangesAsync(cancellationToken);

        return MapResult(purchaseRequest, materialRequest.RequestId, []);
    }

    public async Task UpdateLineSupplierAsync(
        string requestId,
        string lineId,
        UpdatePurchaseRequestLineSupplierDto request,
        string? userId,
        CancellationToken cancellationToken = default)
    {
        var prIdBytes = GuidHelper.ParseGuidString(requestId);
        var prLineIdBytes = GuidHelper.ParseGuidString(lineId);
        var supplierIdBytes = GuidHelper.ParseGuidString(request.SupplierId);
        var userIdBytes = GuidHelper.ParseGuidString(userId);

        if (prIdBytes is null || prLineIdBytes is null || supplierIdBytes is null || userIdBytes is null)
        {
            throw new ArgumentException("Mã tham chiếu không hợp lệ.");
        }

        DateOnly? expectedDeliveryDate = null;
        if (!string.IsNullOrWhiteSpace(request.ExpectedDeliveryDate))
        {
            if (!DateOnly.TryParse(request.ExpectedDeliveryDate, out var parsedDeliveryDate))
            {
                throw new ArgumentException("Ngày giao dự kiến không hợp lệ.");
            }

            expectedDeliveryDate = parsedDeliveryDate;
        }

        var pr = await _context.Purchaserequests
            .Include(x => x.Purchaserequestlines)
            .FirstOrDefaultAsync(x => x.PurchaseRequestId == prIdBytes, cancellationToken);

        if (pr is null)
        {
            throw new KeyNotFoundException("Không tìm thấy Purchase Request.");
        }

        if (pr.Status != PurchaseDraftStatus)
        {
            throw new InvalidOperationException("Chỉ được đổi nhà cung cấp khi Đề xuất mua ở trạng thái DRAFT.");
        }

        var line = pr.Purchaserequestlines.FirstOrDefault(x => x.PurchaseRequestLineId.SequenceEqual(prLineIdBytes));
        if (line is null)
        {
            throw new KeyNotFoundException("Không tìm thấy dòng nguyên liệu trong Purchase Request.");
        }

        var supplierExists = await _context.Suppliers.AnyAsync(s => s.SupplierId == supplierIdBytes && s.IsActive != false, cancellationToken);
        if (!supplierExists)
        {
            throw new KeyNotFoundException("Nhà cung cấp không tồn tại hoặc đã bị khóa.");
        }

        var oldValue = BuildPurchaseLineAuditValue(line);
        line.SupplierId = supplierIdBytes;
        line.EstimatedUnitPrice = DecimalPolicy.RoundMoney(request.EstimatedUnitPrice);
        line.ExpectedDeliveryDate = expectedDeliveryDate;
        line.Note = string.IsNullOrWhiteSpace(request.Note) ? null : request.Note.Trim();

        _context.Auditlogs.Add(new Auditlog
        {
            AuditId = GuidHelper.NewId(),
            ChangedAt = DateTime.UtcNow,
            ChangedBy = userIdBytes,
            BusinessArea = "Purchasing",
            EntityName = nameof(Purchaserequestline),
            EntityId = line.PurchaseRequestLineId,
            FieldName = "SupplierPriceDelivery",
            OldValue = oldValue,
            NewValue = BuildPurchaseLineAuditValue(line),
            Reason = "Cập nhật nhà cung cấp, giá dự kiến, ngày giao và ghi chú dòng mua."
        });

        await _context.SaveChangesAsync(cancellationToken);
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
        _context.Auditlogs.Add(new Auditlog
        {
            AuditId = GuidHelper.NewId(),
            ChangedAt = DateTime.UtcNow,
            ChangedBy = userIdBytes,
            BusinessArea = "Purchasing",
            EntityName = nameof(Purchaserequest),
            EntityId = purchaseRequest.PurchaseRequestId,
            FieldName = "Submit",
            OldValue = oldStatus,
            NewValue = PurchaseSubmittedStatus,
            Reason = "Gửi đơn mua chính thức từ nhu cầu đã duyệt."
        });

        await _context.SaveChangesAsync(cancellationToken);

        return MapResult(purchaseRequest, materialRequest.RequestId, purchaseRequest.Purchaserequestlines);
    }

    private static string BuildPurchaseLineAuditValue(Purchaserequestline line)
        => $"supplier={GuidHelper.ToGuidString(line.SupplierId)}; price={DecimalPolicy.RoundMoney(line.EstimatedUnitPrice)}; delivery={line.ExpectedDeliveryDate?.ToString("yyyy-MM-dd") ?? "-"}; note={line.Note ?? "-"}";

    private async Task<Purchaserequest> EnsurePurchaseRequestAsync(
        Materialrequest materialRequest,
        byte[] userId,
        CancellationToken cancellationToken)
    {
        var requestCode = BuildPurchaseRequestCode(materialRequest);
        var existing = await _context.Purchaserequests
            .FirstOrDefaultAsync(item => item.PurchaseRequestCode == requestCode, cancellationToken);
        if (existing is not null)
        {
            existing.Status = existing.Status == PurchaseSubmittedStatus ? existing.Status : PurchaseDraftStatus;
            return existing;
        }

        var purchaseRequest = new Purchaserequest
        {
            PurchaseRequestId = GuidHelper.NewId(),
            PurchaseRequestCode = requestCode,
            RequestDate = DateOnly.FromDateTime(DateTime.UtcNow),
            PurchaseForDate = materialRequest.RequestDate,
            ShiftName = materialRequest.RequestScope == "FULLDAY" ? null : materialRequest.RequestScope,
            Status = PurchaseDraftStatus,
            CreatedBy = userId
        };

        _context.Purchaserequests.Add(purchaseRequest);
        return purchaseRequest;
    }

    private static decimal ResolveLatestReceiptPrice(Inventoryreceiptline? latestReceiptLine, Unit targetUnit)
    {
        if (latestReceiptLine is null || latestReceiptLine.UnitPrice <= 0)
        {
            return 0m;
        }

        if (latestReceiptLine.UnitId.SequenceEqual(targetUnit.UnitId))
        {
            return latestReceiptLine.UnitPrice;
        }

        if (!CanConvertUnits(latestReceiptLine.Unit, targetUnit))
        {
            return 0m;
        }

        return DecimalPolicy.RoundMoney(latestReceiptLine.UnitPrice * targetUnit.ConvertRateToBase / latestReceiptLine.Unit.ConvertRateToBase);
    }

    private static bool CanConvertUnits(Unit sourceUnit, Unit targetUnit)
    {
        if (sourceUnit.UnitId.SequenceEqual(targetUnit.UnitId))
        {
            return true;
        }

        return sourceUnit.ConvertRateToBase > 0 &&
               targetUnit.ConvertRateToBase > 0 &&
               string.Equals(NormalizedBaseUnitCode(sourceUnit), NormalizedBaseUnitCode(targetUnit), StringComparison.OrdinalIgnoreCase);
    }

    private static string NormalizedBaseUnitCode(Unit unit)
        => string.IsNullOrWhiteSpace(unit.BaseUnitCode)
            ? unit.UnitCode.Trim().ToUpperInvariant()
            : unit.BaseUnitCode.Trim().ToUpperInvariant();

    private void EnsurePurchaseRequestLine(
        Purchaserequest purchaseRequest,
        Materialrequestline materialLine,
        Supplier supplier,
        decimal estimatedUnitPrice,
        List<Purchaserequestline> existingLines)
    {
        var purchaseQty = PurchaseRequestPlanner.CalculatePurchaseQty(materialLine.SuggestedPurchaseQty);
        var requiredQty = DecimalPolicy.RoundQuantity(materialLine.TotalRequiredQty);
        var currentStockQty = DecimalPolicy.RoundQuantity(materialLine.CurrentStockQty);
        estimatedUnitPrice = DecimalPolicy.RoundMoney(estimatedUnitPrice);
        var existing = existingLines.FirstOrDefault(line =>
            line.MaterialRequestLineId.SequenceEqual(materialLine.RequestLineId));
        if (existing is not null)
        {
            existing.IngredientId = materialLine.IngredientId;
            existing.SupplierId = supplier.SupplierId;
            existing.UnitId = materialLine.UnitId;
            existing.RequiredQty = requiredQty;
            existing.CurrentStockQty = currentStockQty;
            existing.PurchaseQty = purchaseQty;
            existing.EstimatedUnitPrice = estimatedUnitPrice;
            existing.Ingredient = materialLine.Ingredient;
            existing.Supplier = supplier;
            existing.Unit = materialLine.Unit;
            return;
        }

        var line = new Purchaserequestline
        {
            PurchaseRequestLineId = GuidHelper.NewId(),
            PurchaseRequestId = purchaseRequest.PurchaseRequestId,
            MaterialRequestLineId = materialLine.RequestLineId,
            IngredientId = materialLine.IngredientId,
            SupplierId = supplier.SupplierId,
            UnitId = materialLine.UnitId,
            RequiredQty = requiredQty,
            CurrentStockQty = currentStockQty,
            PurchaseQty = purchaseQty,
            EstimatedUnitPrice = estimatedUnitPrice,
            Ingredient = materialLine.Ingredient,
            Supplier = supplier,
            Unit = materialLine.Unit
        };

        _context.Purchaserequestlines.Add(line);
        existingLines.Add(line);
    }

    private static string BuildPurchaseRequestCode(Materialrequest materialRequest)
    {
        var shiftSegment = materialRequest.RequestScope == "FULLDAY" ? "FULLDAY" : materialRequest.RequestScope;
        return $"PR-{materialRequest.RequestDate:yyyyMMdd}-{shiftSegment}";
    }

    private static string BuildKey(byte[] value)
        => Convert.ToBase64String(value);

    private async Task<Materialrequest> ResolveMaterialRequestForSubmitAsync(
        Purchaserequest purchaseRequest,
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
        Purchaserequest purchaseRequest,
        Materialrequest materialRequest,
        CancellationToken cancellationToken)
    {
        if (!ApprovedDemandStatuses.Contains(materialRequest.Status))
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
        if (!currentShortageLineIds.SetEquals(purchaseLineDemandIds))
        {
            throw new InvalidOperationException("Danh sách mua đã cũ, vui lòng tạo lại từ nhu cầu hiện tại.");
        }

        foreach (var line in purchaseRequest.Purchaserequestlines)
        {
            if (line.Supplier is null || line.Supplier.IsActive == false)
            {
                throw new InvalidOperationException("Có dòng mua chưa chọn nhà cung cấp hợp lệ.");
            }

            if (line.PurchaseQty <= 0 || line.EstimatedUnitPrice <= 0)
            {
                throw new InvalidOperationException("Có dòng mua thiếu số lượng hoặc giá dự kiến hợp lệ.");
            }

            var referencePrice = await ResolveReferencePriceAsync(line, cancellationToken);
            var variance = WorkflowReportCalculator.CalculateVariancePercent(referencePrice, line.EstimatedUnitPrice);
            if (WorkflowReportCalculator.IsPriceIncreaseWarning(variance))
            {
                throw new InvalidOperationException("Có dòng mua vượt ngưỡng giá, cần xử lý cảnh báo trước khi gửi đơn mua.");
            }
        }
    }

    private async Task<decimal> ResolveReferencePriceAsync(
        Purchaserequestline line,
        CancellationToken cancellationToken)
    {
        var latestReceiptPrice = await _context.Inventoryreceiptlines
            .AsNoTracking()
            .Include(item => item.Receipt)
            .Where(item =>
                item.IngredientId.SequenceEqual(line.IngredientId) &&
                item.Receipt.SupplierId.SequenceEqual(line.SupplierId) &&
                item.UnitId.SequenceEqual(line.UnitId) &&
                item.UnitPrice > 0)
            .OrderByDescending(item => item.Receipt.ReceiptDate)
            .Select(item => item.UnitPrice)
            .FirstOrDefaultAsync(cancellationToken);

        return latestReceiptPrice > 0 ? latestReceiptPrice : DecimalPolicy.RoundMoney(line.Ingredient.ReferencePrice);
    }

    private static PurchaseRequestWorkflowResultDto MapResult(
        Purchaserequest purchaseRequest,
        byte[] materialRequestId,
        IEnumerable<Purchaserequestline> lines)
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

    private static PurchaseRequestWorkflowLineDto MapLine(Purchaserequestline line)
        => new()
        {
            PurchaseRequestLineId = GuidHelper.ToGuidString(line.PurchaseRequestLineId),
            MaterialRequestLineId = GuidHelper.ToGuidString(line.MaterialRequestLineId),
            IngredientId = GuidHelper.ToGuidString(line.IngredientId),
            IngredientName = line.Ingredient.IngredientName,
            SupplierId = GuidHelper.ToGuidString(line.SupplierId),
            SupplierName = line.Supplier.SupplierName,
            UnitId = GuidHelper.ToGuidString(line.UnitId),
            UnitName = line.Unit.UnitName,
            RequiredQty = line.RequiredQty,
            CurrentStockQty = line.CurrentStockQty,
            PurchaseQty = line.PurchaseQty,
            EstimatedUnitPrice = line.EstimatedUnitPrice,
            ExpectedDeliveryDate = line.ExpectedDeliveryDate?.ToString("yyyy-MM-dd"),
            Note = line.Note
        };
}
