using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using IPCManagement.Api.Data;
using IPCManagement.Api.Helpers;
using IPCManagement.Api.Models.Entities;
using Microsoft.EntityFrameworkCore;

namespace IPCManagement.Api.Data.Repositories;

public class CurrentStockRepository : GenericRepository<CurrentStock>, ICurrentStockRepository
{
    public CurrentStockRepository(IpcManagementContext context) : base(context) { }

    public async Task<CurrentStock?> GetByWarehouseAndIngredientAsync(byte[] warehouseId, byte[] ingredientId)
    {
        var trackedStock = _dbSet.Local.FirstOrDefault(c =>
            c.WarehouseId.SequenceEqual(warehouseId) &&
            c.IngredientId.SequenceEqual(ingredientId));
        if (trackedStock is not null)
        {
            return trackedStock;
        }

        return await _dbSet
            .Include(c => c.Ingredient)
            .Include(c => c.Unit)
            .FirstOrDefaultAsync(c => c.WarehouseId == warehouseId && c.IngredientId == ingredientId);
    }

    public override void Update(CurrentStock entity)
    {
        if (_context.Entry(entity).State != EntityState.Added)
        {
            base.Update(entity);
        }
    }

    public async Task<IEnumerable<CurrentStock>> GetByWarehouseAsync(byte[] warehouseId)
    {
        return await _dbSet
            .AsNoTracking()
            .Include(c => c.Ingredient)
            .Include(c => c.Unit)
            .Where(c => c.WarehouseId == warehouseId)
            .ToListAsync();
    }

    public async Task<bool> ExistsAsync(byte[] warehouseId, byte[] ingredientId)
    {
        return await _dbSet.AnyAsync(c => c.WarehouseId == warehouseId && c.IngredientId == ingredientId);
    }

    /// <summary>
    /// Trừ tồn kho theo kiểu compare-and-set nguyên tử.
    ///
    /// Vì sao giữ <c>ExecuteUpdateAsync</c> thay vì đọc-sửa-ghi qua RowVersion: điều kiện
    /// <c>currentQty &gt;= quantity</c> nằm ngay trong mệnh đề WHERE của câu UPDATE nên database tự
    /// quyết định thắng thua. Với N request đồng thời, tổng số lần trừ thành công không bao giờ vượt
    /// quá tồn thực có, tồn kho không thể âm, và không sinh <c>DbUpdateConcurrencyException</c> giả
    /// buộc người dùng bấm lại. Optimistic lock kiểu đọc-rồi-so-RowVersion yếu hơn ở đúng bài toán này.
    ///
    /// RowVersion KHÔNG bị vô hiệu hóa: cột <c>rowVersion</c> là
    /// <c>timestamp(6) ... ON UPDATE CURRENT_TIMESTAMP(6)</c> nên chính câu UPDATE này vẫn làm database
    /// đẩy token lên; mọi luồng EF khác đang giữ bản cũ sẽ fail concurrency check đúng như thiết kế.
    ///
    /// Lỗ hổng thật nằm ở phía bộ nhớ: câu lệnh chạy thẳng xuống database, bỏ qua change-tracker, nên
    /// bản sao entity đang được tracking giữ <c>currentQty</c>/<c>rowVersion</c> cũ. Nếu để nguyên,
    /// một <c>SaveChangesAsync</c> sau đó có thể ghi đè lại số cũ (lost update) hoặc so sánh nhầm
    /// RowVersion, và lần đọc lại trong cùng unit of work sẽ nhận đúng bản cũ đó từ identity map.
    /// Vì vậy sau khi chạy, bản sao cũ được gỡ khỏi change-tracker để lần truy cập kế tiếp buộc phải
    /// đọc lại giá trị thật (vẫn nằm trong transaction hiện hành nên đọc được thay đổi của chính mình).
    /// </summary>
    public async Task<bool> TryDecreaseAsync(byte[] warehouseId, byte[] ingredientId, decimal quantity, DateTime updatedAt)
    {
        var affectedRows = await _dbSet
            .Where(c =>
                c.WarehouseId == warehouseId &&
                c.IngredientId == ingredientId &&
                c.CurrentQty >= quantity)
            .ExecuteUpdateAsync(setters => setters
                .SetProperty(c => c.CurrentQty, c => c.CurrentQty - quantity)
                .SetProperty(c => c.LastUpdated, updatedAt));

        DetachStaleTrackedStock(warehouseId, ingredientId);

        return affectedRows == 1;
    }

    /// <summary>
    /// Chỉ gỡ bản sao đang ở trạng thái Unchanged — tức bản chỉ được đọc lên và giờ đã cũ.
    /// Bản đang Added/Modified được giữ nguyên có chủ đích: nếu cùng một dòng tồn kho vừa có thay đổi
    /// chờ ghi vừa bị trừ bằng ExecuteUpdate thì đó là lỗi luồng nghiệp vụ, và để nguyên sẽ khiến
    /// SaveChangesAsync ném DbUpdateConcurrencyException (RowVersion đã bị câu UPDATE đẩy lên) —
    /// thất bại lớn tiếng, tốt hơn là âm thầm nuốt mất một trong hai thay đổi.
    /// </summary>
    private void DetachStaleTrackedStock(byte[] warehouseId, byte[] ingredientId)
    {
        var trackedEntry = _context.ChangeTracker
            .Entries<CurrentStock>()
            .FirstOrDefault(entry =>
                entry.State == EntityState.Unchanged &&
                entry.Entity.WarehouseId is not null &&
                entry.Entity.IngredientId is not null &&
                entry.Entity.WarehouseId.SequenceEqual(warehouseId) &&
                entry.Entity.IngredientId.SequenceEqual(ingredientId));

        if (trackedEntry is not null)
        {
            trackedEntry.State = EntityState.Detached;
        }
    }

    public async Task<decimal> ConvertQuantityAsync(byte[] sourceUnitId, byte[] targetUnitId, decimal quantity)
    {
        if (sourceUnitId.SequenceEqual(targetUnitId))
        {
            return quantity;
        }

        var units = await _context.Units
            .AsNoTracking()
            .Where(unit => unit.UnitId == sourceUnitId || unit.UnitId == targetUnitId)
            .ToListAsync();
        var sourceUnit = units.FirstOrDefault(unit => unit.UnitId.SequenceEqual(sourceUnitId))
            ?? throw new InvalidOperationException("Không tìm thấy đơn vị nguồn để quy đổi tồn kho.");
        var targetUnit = units.FirstOrDefault(unit => unit.UnitId.SequenceEqual(targetUnitId))
            ?? throw new InvalidOperationException("Không tìm thấy đơn vị đích để quy đổi tồn kho.");

        if (!CanConvertUnits(sourceUnit, targetUnit))
        {
            throw new InvalidOperationException(
                $"Không thể quy đổi từ đơn vị '{sourceUnit.UnitName}' sang '{targetUnit.UnitName}' cho tồn kho.");
        }

        return DecimalPolicy.RoundQuantity(quantity * sourceUnit.ConvertRateToBase / targetUnit.ConvertRateToBase);
    }

    private static bool CanConvertUnits(Unit sourceUnit, Unit targetUnit)
        => sourceUnit.ConvertRateToBase > 0 &&
           targetUnit.ConvertRateToBase > 0 &&
           string.Equals(NormalizedBaseUnitCode(sourceUnit), NormalizedBaseUnitCode(targetUnit), StringComparison.OrdinalIgnoreCase);

    private static string NormalizedBaseUnitCode(Unit unit)
        => string.IsNullOrWhiteSpace(unit.BaseUnitCode)
            ? unit.UnitCode.Trim().ToUpperInvariant()
            : unit.BaseUnitCode.Trim().ToUpperInvariant();
}
