using IPCManagement.Api.Data;
using IPCManagement.Api.Features.Reports.Contracts;
using IPCManagement.Api.Helpers;
using IPCManagement.Api.Shared.Contracts;
using Microsoft.EntityFrameworkCore;

namespace IPCManagement.Api.Features.Reports.Services;

public class StockMovementReportService : IStockMovementReportService
{
    private const int DefaultStockMovementWindowDays = 31;
    private readonly IpcManagementContext _context;

    public StockMovementReportService(IpcManagementContext context)
    {
        _context = context;
    }

    public async Task<IReadOnlyList<CurrentStockSummaryDto>> GetCurrentStockAsync(WorkflowReportQueryDto query)
    {
        var warehouseId = GuidHelper.ParseFilterIdOrThrow(query.WarehouseId, "kho");
        var ingredientId = GuidHelper.ParseFilterIdOrThrow(query.IngredientId, "nguyên liệu");

        var stocks = _context.Currentstocks
            .AsNoTracking()
            .Include(item => item.Warehouse)
            .Include(item => item.Ingredient)
            .Include(item => item.Unit)
            .AsQueryable();

        if (warehouseId is not null)
        {
            stocks = stocks.Where(item => item.WarehouseId == warehouseId);
        }

        if (ingredientId is not null)
        {
            stocks = stocks.Where(item => item.IngredientId == ingredientId);
        }

        return await stocks
            .OrderBy(item => item.Warehouse.WarehouseName)
            .ThenBy(item => item.Ingredient.IngredientName)
            .Take(NormalizeAggregateLimit(query.Limit))
            .Select(item => new CurrentStockSummaryDto
            {
                WarehouseId = GuidHelper.ToGuidString(item.WarehouseId),
                WarehouseName = item.Warehouse.WarehouseName,
                IngredientId = GuidHelper.ToGuidString(item.IngredientId),
                IngredientName = item.Ingredient.IngredientName,
                UnitId = GuidHelper.ToGuidString(item.UnitId),
                UnitName = item.Unit.UnitName,
                CurrentQty = item.CurrentQty,
                LastUpdated = item.LastUpdated
            })
            .ToListAsync();
    }

    public async Task<PagedResponseDto<CurrentStockSummaryDto>> GetCurrentStockPageAsync(CurrentStockPageQueryDto query)
    {
        var warehouseId = GuidHelper.ParseFilterIdOrThrow(query.WarehouseId, "kho");
        var ingredientId = GuidHelper.ParseFilterIdOrThrow(query.IngredientId, "nguyên liệu");

        var stocks = _context.Currentstocks
            .AsNoTracking()
            .Include(item => item.Warehouse)
            .Include(item => item.Ingredient)
            .Include(item => item.Unit)
            .AsQueryable();

        if (warehouseId is not null)
        {
            stocks = stocks.Where(item => item.WarehouseId == warehouseId);
        }

        if (ingredientId is not null)
        {
            stocks = stocks.Where(item => item.IngredientId == ingredientId);
        }

        if (!string.IsNullOrWhiteSpace(query.SearchKeyword))
        {
            var keyword = query.SearchKeyword.Trim();
            stocks = stocks.Where(item =>
                item.Warehouse.WarehouseName.Contains(keyword) ||
                item.Warehouse.WarehouseCode.Contains(keyword) ||
                item.Ingredient.IngredientName.Contains(keyword) ||
                item.Ingredient.IngredientCode.Contains(keyword) ||
                item.Unit.UnitName.Contains(keyword) ||
                item.Unit.UnitCode.Contains(keyword));
        }

        var projectedStocks = stocks.Select(item => new CurrentStockSummaryDto
        {
            WarehouseId = GuidHelper.ToGuidString(item.WarehouseId),
            WarehouseName = item.Warehouse.WarehouseName,
            IngredientId = GuidHelper.ToGuidString(item.IngredientId),
            IngredientName = item.Ingredient.IngredientName,
            UnitId = GuidHelper.ToGuidString(item.UnitId),
            UnitName = item.Unit.UnitName,
            CurrentQty = item.CurrentQty,
            LastUpdated = item.LastUpdated
        });

        var totalCount = await projectedStocks.CountAsync();
        var pageNumber = query.PageNumber;
        var pageSize = query.PageSize;
        var orderedStocks = stocks
            .OrderBy(item => item.Warehouse.WarehouseName)
            .ThenBy(item => item.Ingredient.IngredientName)
            .ThenBy(item => item.Unit.UnitName);
        var items = await orderedStocks
            .Skip((pageNumber - 1) * pageSize)
            .Take(pageSize)
            .Select(item => new CurrentStockSummaryDto
            {
                WarehouseId = GuidHelper.ToGuidString(item.WarehouseId),
                WarehouseName = item.Warehouse.WarehouseName,
                IngredientId = GuidHelper.ToGuidString(item.IngredientId),
                IngredientName = item.Ingredient.IngredientName,
                UnitId = GuidHelper.ToGuidString(item.UnitId),
                UnitName = item.Unit.UnitName,
                CurrentQty = item.CurrentQty,
                LastUpdated = item.LastUpdated
            })
            .ToListAsync();

        return PagedResponseDto<CurrentStockSummaryDto>.Create(items, totalCount, pageNumber, pageSize);
    }

    public Task<IReadOnlyList<StockMovementViewDto>> GetStockMovementsAsync(WorkflowReportQueryDto query)
        => GetStockMovementsCoreAsync(query, searchKeyword: null);

    private async Task<IReadOnlyList<StockMovementViewDto>> GetStockMovementsCoreAsync(
        WorkflowReportQueryDto query,
        string? searchKeyword)
    {
        var warehouseId = GuidHelper.ParseFilterIdOrThrow(query.WarehouseId, "kho");
        var ingredientId = GuidHelper.ParseFilterIdOrThrow(query.IngredientId, "nguyên liệu");
        var (dateFrom, dateToExclusive) = ResolveStockMovementWindow(query);
        var ascending = IsAscending(query);
        var cursorSkip = query.CursorOffset ?? 0;
        var cursorDate = ResolveCursorBoundary(ParseCursorDateTime(query.CursorDate), query.CursorOffset, ascending);

        var movements = _context.Stockmovements
            .AsNoTracking()
            .Include(item => item.Warehouse)
            .Include(item => item.Ingredient)
            .Include(item => item.Unit)
            .AsQueryable();

        if (warehouseId is not null)
        {
            movements = movements.Where(item => item.WarehouseId == warehouseId);
        }

        if (ingredientId is not null)
        {
            movements = movements.Where(item => item.IngredientId == ingredientId);
        }

        if (!string.IsNullOrWhiteSpace(query.MovementType))
        {
            var movementType = query.MovementType.Trim().ToUpperInvariant();
            movements = movements.Where(item => item.MovementType.ToUpper() == movementType);
        }

        if (!string.IsNullOrWhiteSpace(searchKeyword))
        {
            var keyword = searchKeyword.Trim();
            movements = movements.Where(item =>
                item.Warehouse.WarehouseName.Contains(keyword) ||
                item.Warehouse.WarehouseCode.Contains(keyword) ||
                item.Ingredient.IngredientName.Contains(keyword) ||
                item.Ingredient.IngredientCode.Contains(keyword) ||
                item.Unit.UnitName.Contains(keyword) ||
                item.Unit.UnitCode.Contains(keyword) ||
                item.MovementType.Contains(keyword) ||
                (item.RefTable != null && item.RefTable.Contains(keyword)) ||
                (item.Reason != null && item.Reason.Contains(keyword)) ||
                (item.Note != null && item.Note.Contains(keyword)));
        }

        movements = movements.Where(item =>
            item.MovementDate >= dateFrom &&
            item.MovementDate < dateToExclusive);

        if (cursorDate is not null)
        {
            movements = ascending
                ? movements.Where(item => item.MovementDate > cursorDate)
                : movements.Where(item => item.MovementDate < cursorDate);
        }

        var orderedMovements = ascending
            ? movements.OrderBy(item => item.MovementDate).ThenBy(item => item.MovementId)
            : movements.OrderByDescending(item => item.MovementDate).ThenByDescending(item => item.MovementId);

        return await orderedMovements
            .Skip(cursorDate is null ? 0 : cursorSkip)
            .Take(NormalizeLimit(query.Limit))
            .Select(item => new StockMovementViewDto
            {
                MovementId = GuidHelper.ToGuidString(item.MovementId),
                MovementDate = item.MovementDate,
                WarehouseId = GuidHelper.ToGuidString(item.WarehouseId),
                WarehouseName = item.Warehouse.WarehouseName,
                IngredientId = GuidHelper.ToGuidString(item.IngredientId),
                IngredientName = item.Ingredient.IngredientName,
                UnitId = GuidHelper.ToGuidString(item.UnitId),
                UnitName = item.Unit.UnitName,
                MovementType = item.MovementType,
                QuantityIn = item.QuantityIn,
                QuantityOut = item.QuantityOut,
                BeforeQty = item.BeforeQty,
                AfterQty = item.AfterQty,
                RefTable = item.RefTable,
                RefId = item.RefId == null ? null : GuidHelper.ToGuidString(item.RefId),
                Reason = item.Reason,
                Note = item.Note
            })
            .ToListAsync();
    }

    public async Task<CursorPageDto<StockMovementViewDto>> GetStockMovementPageAsync(StockMovementPageQueryDto query)
    {
        var limit = NormalizePageLimit(query.Limit);
        var rows = await GetStockMovementsCoreAsync(CloneQuery(query, limit + 1), query.SearchKeyword);
        return BuildCursorPage(rows, limit, row => row.MovementDate, row => row.MovementId, query);
    }

    private static DateTime? ParseDateTimeStart(string? value)
        => DateOnly.TryParse(value, out var date)
            ? date.ToDateTime(TimeOnly.MinValue)
            : null;

    private static DateTime? ParseDateTimeEndExclusive(string? value)
        => DateOnly.TryParse(value, out var date)
            ? date.AddDays(1).ToDateTime(TimeOnly.MinValue)
            : null;

    private static DateTime? ParseCursorDateTime(string? value)
        => DateTime.TryParse(value, out var dateTime)
            ? dateTime
            : ParseDateTimeStart(value);

    private static DateTime? ResolveCursorBoundary(DateTime? cursorDate, int? cursorOffset, bool ascending)
    {
        if (cursorDate is null || cursorOffset is null) return cursorDate;

        return ascending
            ? cursorDate.Value > DateTime.MinValue ? cursorDate.Value.AddTicks(-1) : cursorDate
            : cursorDate.Value < DateTime.MaxValue ? cursorDate.Value.AddTicks(1) : cursorDate;
    }

    private static (DateTime DateFrom, DateTime DateToExclusive) ResolveStockMovementWindow(WorkflowReportQueryDto query)
    {
        var dateToExclusive = ParseDateTimeEndExclusive(query.DateTo)
            ?? ServiceCalendar.Today().AddDays(1).ToDateTime(TimeOnly.MinValue);
        var dateFrom = ParseDateTimeStart(query.DateFrom)
            ?? DateOnly.FromDateTime(dateToExclusive).AddDays(-DefaultStockMovementWindowDays).ToDateTime(TimeOnly.MinValue);

        return (dateFrom, dateToExclusive);
    }

    private static int NormalizeLimit(int limit)
        => Math.Clamp(limit <= 0 ? 100 : limit, 1, 500);

    private static int NormalizeAggregateLimit(int limit)
        => limit < 0 ? int.MaxValue : NormalizeLimit(limit);

    private static int NormalizePageLimit(int limit)
        => Math.Clamp(limit <= 0 ? 20 : limit, 1, 100);

    private static bool IsAscending(WorkflowReportQueryDto query)
        => string.Equals(query.SortDirection, "asc", StringComparison.OrdinalIgnoreCase);

    private static WorkflowReportQueryDto CloneQuery(WorkflowReportQueryDto query, int limit)
        => new()
        {
            ServiceDate = query.ServiceDate,
            DateFrom = query.DateFrom,
            DateTo = query.DateTo,
            CustomerId = query.CustomerId,
            WarehouseId = query.WarehouseId,
            IngredientId = query.IngredientId,
            SupplierId = query.SupplierId,
            ShiftName = query.ShiftName,
            Format = query.Format,
            CursorDate = query.CursorDate,
            CursorId = query.CursorId,
            CursorOffset = query.CursorOffset,
            Limit = limit,
            SortDirection = query.SortDirection,
            Actor = query.Actor,
            BusinessArea = query.BusinessArea,
            EntityName = query.EntityName,
            FieldName = query.FieldName,
            GroupBy = query.GroupBy,
            PriceTier = query.PriceTier
        };

    private static CursorPageDto<T> BuildCursorPage<T>(
        IReadOnlyList<T> rows,
        int limit,
        Func<T, DateTime> getCursorDate,
        Func<T, string> getCursorId,
        WorkflowReportQueryDto query)
    {
        var items = rows.Take(limit).ToList();
        var hasNext = rows.Count > limit;
        var cursorItem = hasNext ? items.LastOrDefault() : default;
        var nextCursorOffset = 0;
        if (cursorItem is not null)
        {
            var boundaryDate = getCursorDate(cursorItem);
            nextCursorOffset = items.Count(item => getCursorDate(item) == boundaryDate);
            if (ParseCursorDateTime(query.CursorDate) == boundaryDate)
            {
                nextCursorOffset += query.CursorOffset ?? 0;
            }
        }

        return new CursorPageDto<T>
        {
            Items = items,
            Limit = limit,
            HasNext = hasNext,
            NextCursorDate = cursorItem is null ? null : getCursorDate(cursorItem).ToString("O"),
            NextCursorId = cursorItem is null ? null : getCursorId(cursorItem),
            NextCursorOffset = nextCursorOffset
        };
    }
}
