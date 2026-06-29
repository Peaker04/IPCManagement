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
            return null;
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

            var latestPrice = await ResolveLatestReceiptPriceAsync(line.IngredientId, cancellationToken);
            EnsurePurchaseRequestLine(
                purchaseRequest,
                line,
                supplier,
                PurchaseRequestPlanner.EstimateUnitPrice(latestPrice, line.Ingredient.ReferencePrice),
                existingLines);
        }

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

    private async Task<Purchaserequest> EnsurePurchaseRequestAsync(
        Materialrequest materialRequest,
        byte[] userId,
        CancellationToken cancellationToken)
    {
        var shiftSegment = materialRequest.RequestScope == "FULLDAY" ? "FULLDAY" : materialRequest.RequestScope;
        var requestCode = $"PR-{materialRequest.RequestDate:yyyyMMdd}-{shiftSegment}";
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
            .Where(line => line.IngredientId == ingredientId)
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

    private async Task<decimal> ResolveLatestReceiptPriceAsync(byte[] ingredientId, CancellationToken cancellationToken)
        => await _context.Inventoryreceiptlines
            .Where(line => line.IngredientId == ingredientId)
            .OrderByDescending(line => line.Receipt.ReceiptDate)
            .Select(line => line.UnitPrice)
            .FirstOrDefaultAsync(cancellationToken);

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
            EstimatedUnitPrice = line.EstimatedUnitPrice
        };
}
