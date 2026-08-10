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

    public async Task<bool> UnitExistsAsync(byte[] unitId, CancellationToken cancellationToken)
    {
        if (!IsInMemoryProvider())
        {
            return await context.Units.AnyAsync(unit => unit.UnitId == unitId, cancellationToken);
        }

        return (await context.Units.AsNoTracking().ToListAsync(cancellationToken))
            .Any(unit => unit.UnitId.AsSpan().SequenceEqual(unitId));
    }
}
