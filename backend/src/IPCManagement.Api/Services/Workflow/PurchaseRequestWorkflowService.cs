using IPCManagement.Api.Data;
using IPCManagement.Api.Helpers;
using IPCManagement.Api.Models.DTOs.Workflow;
using IPCManagement.Api.Models.Entities;
using Microsoft.EntityFrameworkCore;

namespace IPCManagement.Api.Services.Workflow;

public class PurchaseRequestWorkflowService : IPurchaseRequestWorkflowService
{
    private readonly IpcManagementContext _context;

    public PurchaseRequestWorkflowService(IpcManagementContext context)
    {
        _context = context;
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

        foreach (var line in shortageLines)
        {
            var supplier = await ResolveSupplierAsync(line.IngredientId, cancellationToken);
            if (supplier is null)
            {
                throw new InvalidOperationException($"Chưa có nhà cung cấp để tạo đề xuất mua cho '{line.Ingredient.IngredientName}'.");
            }

            var latestPrice = await ResolveLatestReceiptPriceAsync(line.IngredientId, line.Unit, cancellationToken);
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

        return new PurchaseRequestWorkflowResultDto
        {
            PurchaseRequestId = GuidHelper.ToGuidString(purchaseRequest.PurchaseRequestId),
            PurchaseRequestCode = purchaseRequest.PurchaseRequestCode,
            MaterialRequestId = GuidHelper.ToGuidString(materialRequest.RequestId),
            PurchaseForDate = purchaseRequest.PurchaseForDate.ToString("yyyy-MM-dd"),
            ShiftName = purchaseRequest.ShiftName,
            Status = purchaseRequest.Status,
            Lines = existingLines
                .OrderBy(line => line.Ingredient.IngredientName)
                .Select(MapLine)
            .ToList()
        };
    }

    private async Task<PurchaseRequestWorkflowResultDto?> ClearStalePurchaseRequestAsync(
        Materialrequest materialRequest,
        byte[] userId,
        CancellationToken cancellationToken)
    {
        var requestCode = BuildPurchaseRequestCode(materialRequest);
        var purchaseRequest = await _context.Purchaserequests
            .Include(item => item.Purchaserequestlines)
            .FirstOrDefaultAsync(item => item.PurchaseRequestCode == requestCode, cancellationToken);
        if (purchaseRequest is null)
        {
            return null;
        }

        var staleCount = purchaseRequest.Purchaserequestlines.Count;
        if (staleCount > 0)
        {
            _context.Purchaserequestlines.RemoveRange(purchaseRequest.Purchaserequestlines);
        }

        purchaseRequest.Status = purchaseRequest.Status == "SENTTOSUPPLIER" ? purchaseRequest.Status : "DRAFT";
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

        return new PurchaseRequestWorkflowResultDto
        {
            PurchaseRequestId = GuidHelper.ToGuidString(purchaseRequest.PurchaseRequestId),
            PurchaseRequestCode = purchaseRequest.PurchaseRequestCode,
            MaterialRequestId = GuidHelper.ToGuidString(materialRequest.RequestId),
            PurchaseForDate = purchaseRequest.PurchaseForDate.ToString("yyyy-MM-dd"),
            ShiftName = purchaseRequest.ShiftName,
            Status = purchaseRequest.Status,
            Lines = []
        };
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

        if (pr.Status != "DRAFT")
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
            existing.Status = existing.Status == "SENTTOSUPPLIER" ? existing.Status : "DRAFT";
            return existing;
        }

        var purchaseRequest = new Purchaserequest
        {
            PurchaseRequestId = GuidHelper.NewId(),
            PurchaseRequestCode = requestCode,
            RequestDate = DateOnly.FromDateTime(DateTime.UtcNow),
            PurchaseForDate = materialRequest.RequestDate,
            ShiftName = materialRequest.RequestScope == "FULLDAY" ? null : materialRequest.RequestScope,
            Status = "DRAFT",
            CreatedBy = userId
        };

        _context.Purchaserequests.Add(purchaseRequest);
        return purchaseRequest;
    }

    private async Task<Supplier?> ResolveSupplierAsync(byte[] ingredientId, CancellationToken cancellationToken)
    {
        var latestReceiptSupplier = await _context.Inventoryreceiptlines
            .Include(line => line.Receipt)
                .ThenInclude(receipt => receipt.Supplier)
            .Where(line =>
                line.IngredientId == ingredientId &&
                line.Receipt.Supplier.IsActive != false)
            .OrderByDescending(line => line.Receipt.ReceiptDate)
            .Select(line => line.Receipt.Supplier)
            .FirstOrDefaultAsync(cancellationToken);
        if (latestReceiptSupplier is not null)
        {
            return latestReceiptSupplier;
        }

        return await _context.Suppliers
            .Where(supplier => supplier.IsActive != false)
            .OrderBy(supplier => supplier.SupplierCode)
            .FirstOrDefaultAsync(cancellationToken);
    }

    private async Task<decimal> ResolveLatestReceiptPriceAsync(byte[] ingredientId, Unit targetUnit, CancellationToken cancellationToken)
    {
        var latestReceiptLine = await _context.Inventoryreceiptlines
            .Include(line => line.Unit)
            .Include(line => line.Receipt)
            .Where(line => line.IngredientId == ingredientId)
            .OrderByDescending(line => line.Receipt.ReceiptDate)
            .FirstOrDefaultAsync(cancellationToken);

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
