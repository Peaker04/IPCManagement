using IPCManagement.Api.Data;
using IPCManagement.Api.Helpers;
using IPCManagement.Api.Models.Entities;
using Microsoft.EntityFrameworkCore;

namespace IPCManagement.Api.Features.Purchasing.Services;

internal sealed class PurchaseReceivingQueries(IpcManagementContext context)
{
    public bool IsInMemoryProvider()
        => string.Equals(
            context.Database.ProviderName,
            "Microsoft.EntityFrameworkCore.InMemory",
            StringComparison.Ordinal);

    public async Task<PurchaseOrder?> LoadOrderAsync(byte[] purchaseOrderId, CancellationToken cancellationToken)
    {
        if (!IsInMemoryProvider())
        {
            return await context.Purchaseorders
                .Include(order => order.Supplier)
                .Include(order => order.PurchaseRequest)
                .Include(order => order.Purchaseorderlines)
                    .ThenInclude(line => line.Ingredient)
                .Include(order => order.Purchaseorderlines)
                    .ThenInclude(line => line.Unit)
                .SingleOrDefaultAsync(
                    order => order.PurchaseOrderId == purchaseOrderId,
                    cancellationToken);
        }

        var order = (await context.Purchaseorders.ToListAsync(cancellationToken))
            .SingleOrDefault(item => item.PurchaseOrderId.AsSpan().SequenceEqual(purchaseOrderId));
        if (order is null)
        {
            return null;
        }

        order.Supplier = (await context.Suppliers.ToListAsync(cancellationToken))
            .Single(item => item.SupplierId.AsSpan().SequenceEqual(order.SupplierId));
        order.PurchaseRequest = (await context.Purchaserequests.ToListAsync(cancellationToken))
            .Single(item => item.PurchaseRequestId.AsSpan().SequenceEqual(order.PurchaseRequestId));
        order.Purchaseorderlines = (await context.Purchaseorderlines.ToListAsync(cancellationToken))
            .Where(line => line.PurchaseOrderId.AsSpan().SequenceEqual(order.PurchaseOrderId))
            .ToList();
        var ingredients = await context.Ingredients.ToListAsync(cancellationToken);
        var units = await context.Units.ToListAsync(cancellationToken);
        foreach (var line in order.Purchaseorderlines)
        {
            line.Ingredient = ingredients.Single(item =>
                item.IngredientId.AsSpan().SequenceEqual(line.IngredientId));
            line.Unit = units.Single(item => item.UnitId.AsSpan().SequenceEqual(line.UnitId));
        }

        return order;
    }

    public async Task<InventoryReceipt?> LoadReceiptAsync(byte[] receiptId, CancellationToken cancellationToken)
    {
        var query = context.Inventoryreceipts
            .Include(receipt => receipt.Inventoryreceiptlines)
            .AsQueryable();
        if (!IsInMemoryProvider())
        {
            return await query.SingleOrDefaultAsync(receipt => receipt.ReceiptId == receiptId, cancellationToken);
        }

        var receipts = await query.ToListAsync(cancellationToken);
        return receipts.SingleOrDefault(receipt => receipt.ReceiptId.AsSpan().SequenceEqual(receiptId));
    }

    public async Task<InventoryReceipt?> LoadActiveReceiptForOrderLineAsync(
        byte[] purchaseOrderLineId,
        CancellationToken cancellationToken)
    {
        var activeLines = await context.Purchasereceiptactivelines
            .ToListAsync(cancellationToken);
        var activeLine = activeLines.SingleOrDefault(line =>
            line.PurchaseOrderLineId.AsSpan().SequenceEqual(purchaseOrderLineId));
        if (activeLine is not null)
        {
            return await LoadReceiptAsync(activeLine.ReceiptId, cancellationToken);
        }

        // The fallback protects legacy rows which predate the fence. It stays
        // read-only and is deliberately retained until every legacy active
        // receipt has been reconciled through lifecycle commands.
        var activeStatuses = new[] { "DRAFT", "PENDING_APPROVAL", "APPROVED" };
        var receiptLines = await context.Inventoryreceiptlines
            .Include(line => line.Receipt)
            .ToListAsync(cancellationToken);
        return receiptLines
            .Where(line => line.PurchaseOrderLineId is not null &&
                line.PurchaseOrderLineId.AsSpan().SequenceEqual(purchaseOrderLineId) &&
                activeStatuses.Contains(line.Receipt.Status, StringComparer.Ordinal))
            .OrderBy(line => line.Receipt.CreatedAt)
            .Select(line => line.Receipt)
            .FirstOrDefault();
    }

    public async Task ReleaseActiveLinesAsync(byte[] receiptId, CancellationToken cancellationToken)
    {
        var locks = await context.Purchasereceiptactivelines
            .ToListAsync(cancellationToken);
        var matching = locks.Where(item => item.ReceiptId.AsSpan().SequenceEqual(receiptId)).ToList();
        context.Purchasereceiptactivelines.RemoveRange(matching);
    }

    public async Task<ReceiptCorrection?> LoadReceiptCorrectionAsync(
        byte[] correctionId,
        CancellationToken cancellationToken)
    {
        var corrections = await context.Receiptcorrections
            .Include(item => item.Lines)
            .ToListAsync(cancellationToken);
        return corrections.SingleOrDefault(item => item.CorrectionId.AsSpan().SequenceEqual(correctionId));
    }

    public async Task<Dictionary<string, decimal>> LoadCorrectedQuantitiesAsync(
        byte[] receiptId,
        CancellationToken cancellationToken)
    {
        var corrections = await context.Receiptcorrections
            .Include(item => item.Lines)
            .ToListAsync(cancellationToken);
        return corrections
            .Where(item => item.ReceiptId.AsSpan().SequenceEqual(receiptId))
            .SelectMany(item => item.Lines)
            .GroupBy(item => Convert.ToHexString(item.ReceiptLineId), StringComparer.Ordinal)
            .ToDictionary(
                group => group.Key,
                group => DecimalPolicy.RoundQuantity(group.Sum(item => item.Quantity)),
                StringComparer.Ordinal);
    }

    public async Task<PurchaseOrder?> LoadOrderForReceiptAsync(
        InventoryReceipt receipt,
        CancellationToken cancellationToken)
    {
        if (receipt.PurchaseOrderId is not null)
        {
            return await LoadOrderAsync(receipt.PurchaseOrderId, cancellationToken);
        }

        var receiptRequestLineIds = receipt.Inventoryreceiptlines
            .Where(line => line.PurchaseRequestLineId is not null)
            .Select(line => Convert.ToHexString(line.PurchaseRequestLineId!))
            .ToHashSet(StringComparer.Ordinal);
        if (receiptRequestLineIds.Count == 0)
        {
            return null;
        }

        var matchingOrderIds = (await context.Purchaseorderlines
                .AsNoTracking()
                .ToListAsync(cancellationToken))
            .Where(line => receiptRequestLineIds.Contains(Convert.ToHexString(line.PurchaseRequestLineId)))
            .GroupBy(line => Convert.ToHexString(line.PurchaseOrderId), StringComparer.Ordinal)
            .Where(group => receiptRequestLineIds.All(receiptLineId =>
                group.Any(line => Convert.ToHexString(line.PurchaseRequestLineId) == receiptLineId)))
            .Select(group => group.First().PurchaseOrderId)
            .ToList();

        return matchingOrderIds.Count == 1
            ? await LoadOrderAsync(matchingOrderIds[0], cancellationToken)
            : null;
    }

    public async Task<bool> UnitExistsAsync(byte[] unitId, CancellationToken cancellationToken)
    {
        if (!IsInMemoryProvider())
        {
            return await context.Units.AnyAsync(unit => unit.UnitId == unitId, cancellationToken);
        }

        return (await context.Units.AsNoTracking().ToListAsync(cancellationToken))
            .Any(unit => unit.UnitId.AsSpan().SequenceEqual(unitId));
    }

    public async Task<bool> WarehouseExistsAsync(byte[] warehouseId, CancellationToken cancellationToken)
    {
        if (!IsInMemoryProvider())
        {
            return await context.Warehouses.AnyAsync(
                warehouse => warehouse.WarehouseId == warehouseId,
                cancellationToken);
        }

        return (await context.Warehouses.AsNoTracking().ToListAsync(cancellationToken))
            .Any(warehouse => warehouse.WarehouseId.AsSpan().SequenceEqual(warehouseId));
    }
}
