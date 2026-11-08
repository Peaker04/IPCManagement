using IPCManagement.Api.Data;
using IPCManagement.Api.Features.Inventory.Contracts;
using IPCManagement.Api.Helpers;
using Microsoft.EntityFrameworkCore;

namespace IPCManagement.Api.Features.Inventory.Services;

internal sealed record MrxStockProvisionFact(
    byte[] MovementId,
    byte[] IngredientId,
    byte[] UnitId,
    decimal Quantity);

internal sealed class MrxIssueProvisionQuery(IpcManagementContext context)
{
    internal const string ProvisionReason = "Bảo đảm đủ tồn kho cho chế độ đối chiếu nguyên liệu";
    internal const string ProvisionNotePrefix = "Tự động bổ sung phần thiếu cho lô ";

    internal async Task<IReadOnlyList<MrxStockProvisionFact>> GetByIssueIdAsync(
        byte[] issueId,
        CancellationToken token = default)
    {
        var query = context.Stockmovements.AsNoTracking().Where(movement =>
            movement.MovementType == "ADJUSTMENT"
            && movement.RefTable == "inventoryissues"
            && movement.Reason == ProvisionReason
            && movement.Note != null
            && movement.Note.StartsWith(ProvisionNotePrefix));

        var movements = string.Equals(
            context.Database.ProviderName,
            "Microsoft.EntityFrameworkCore.InMemory",
            StringComparison.Ordinal)
            ? (await query.ToListAsync(token)).Where(movement => movement.RefId is not null
                && movement.RefId.AsSpan().SequenceEqual(issueId)).ToList()
            : await query.Where(movement => movement.RefId == issueId).ToListAsync(token);

        return movements.Select(movement => new MrxStockProvisionFact(
            movement.MovementId,
            movement.IngredientId,
            movement.UnitId,
            movement.QuantityIn)).ToList();
    }

    internal async Task<IReadOnlyList<MrxStockProvisionDto>> GetDtosByIssueIdAsync(
        byte[] issueId,
        CancellationToken token = default)
    {
        var facts = await GetByIssueIdAsync(issueId, token);
        var unitIds = facts.Select(fact => fact.UnitId).Distinct(ByteArrayComparer.Instance).ToList();
        var units = string.Equals(context.Database.ProviderName, "Microsoft.EntityFrameworkCore.InMemory", StringComparison.Ordinal)
            ? (await context.Units.AsNoTracking().ToListAsync(token))
                .Where(unit => unitIds.Any(id => id.AsSpan().SequenceEqual(unit.UnitId))).ToList()
            : await context.Units.AsNoTracking().Where(unit => unitIds.Contains(unit.UnitId)).ToListAsync(token);
        var unitNames = units.ToDictionary(unit => Convert.ToHexString(unit.UnitId), unit => unit.UnitName, StringComparer.Ordinal);
        return facts.Select(fact => new MrxStockProvisionDto
        {
            StockMovementId = GuidHelper.ToGuidString(fact.MovementId),
            IngredientId = GuidHelper.ToGuidString(fact.IngredientId),
            UnitId = GuidHelper.ToGuidString(fact.UnitId),
            UnitName = unitNames.GetValueOrDefault(Convert.ToHexString(fact.UnitId)),
            ProvisionedQuantity = fact.Quantity
        }).ToList();
    }

    private sealed class ByteArrayComparer : IEqualityComparer<byte[]>
    {
        internal static readonly ByteArrayComparer Instance = new();
        public bool Equals(byte[]? x, byte[]? y) => x is not null && y is not null && x.AsSpan().SequenceEqual(y);
        public int GetHashCode(byte[] value) => System.Collections.StructuralComparisons.StructuralEqualityComparer.GetHashCode(value);
    }
}
