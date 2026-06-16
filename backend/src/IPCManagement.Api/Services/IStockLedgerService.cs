namespace IPCManagement.Api.Services;

public interface IStockLedgerService
{
    /// <summary>
    /// Thêm số lượng vào tồn kho hiện tại và ghi nhận Stock Movement (nhập kho).
    /// </summary>
    Task AddStockAsync(
        byte[] warehouseId,
        byte[] ingredientId,
        byte[] unitId,
        decimal quantity,
        string movementType,
        string refTable,
        byte[] refId,
        byte[] performedBy,
        string reason,
        string note);

    /// <summary>
    /// Kiểm tra tồn kho và trừ số lượng khỏi tồn kho hiện tại, ghi nhận Stock Movement (xuất kho).
    /// Ném InvalidOperationException nếu không đủ tồn kho.
    /// </summary>
    Task RemoveStockWithCheckAsync(
        byte[] warehouseId,
        byte[] ingredientId,
        byte[] unitId,
        decimal quantity,
        string movementType,
        string refTable,
        byte[] refId,
        byte[] performedBy,
        string reason,
        string note);
}
