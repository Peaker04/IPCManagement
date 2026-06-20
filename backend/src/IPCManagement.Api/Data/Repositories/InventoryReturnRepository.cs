using IPCManagement.Api.Helpers;
using IPCManagement.Api.Models.Entities;
using Microsoft.EntityFrameworkCore;

namespace IPCManagement.Api.Data.Repositories;

public class InventoryReturnRepository : GenericRepository<Inventoryreturn>, IInventoryReturnRepository
{
    public InventoryReturnRepository(IpcManagementContext context) : base(context)
    {
    }

    public async Task<(IEnumerable<Inventoryreturn> Items, int TotalCount)> GetPagedAsync(
        int pageNumber,
        int pageSize)
    {
        (pageNumber, pageSize) = NormalizePaging(pageNumber, pageSize);

        var query = _context.Inventoryreturns
            .AsNoTracking()
            .Include(inventoryReturn => inventoryReturn.Warehouse)
            .Include(inventoryReturn => inventoryReturn.Issue)
            .Include(inventoryReturn => inventoryReturn.CreatedByNavigation)
            .OrderByDescending(inventoryReturn => inventoryReturn.CreatedAt)
            .AsQueryable();

        var totalCount = await query.CountAsync();
        var items = await query
            .Skip((pageNumber - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync();

        return (items, totalCount);
    }

    public async Task<Inventoryreturn?> GetByIdWithLinesAsync(byte[] id)
        => await _context.Inventoryreturns
            .AsNoTracking()
            .Include(inventoryReturn => inventoryReturn.Warehouse)
            .Include(inventoryReturn => inventoryReturn.Issue)
            .Include(inventoryReturn => inventoryReturn.CreatedByNavigation)
            .Include(inventoryReturn => inventoryReturn.Inventoryreturnlines)
                .ThenInclude(line => line.Ingredient)
            .Include(inventoryReturn => inventoryReturn.Inventoryreturnlines)
                .ThenInclude(line => line.Unit)
            .FirstOrDefaultAsync(inventoryReturn => inventoryReturn.ReturnId == id);

    public async Task<Dictionary<string, decimal>> GetReturnedQuantitiesByIssueAsync(byte[] issueId)
    {
        var lines = await _context.Inventoryreturnlines
            .AsNoTracking()
            .Where(line => line.Return.IssueId == issueId)
            .Select(line => new
            {
                line.IngredientId,
                line.UnitId,
                line.Quantity
            })
            .ToListAsync();

        return lines
            .GroupBy(line => BuildLineKey(line.IngredientId, line.UnitId))
            .ToDictionary(group => group.Key, group => group.Sum(line => line.Quantity));
    }

    public static string BuildLineKey(byte[] ingredientId, byte[] unitId)
        => $"{GuidHelper.ToGuidString(ingredientId)}|{GuidHelper.ToGuidString(unitId)}";
}
