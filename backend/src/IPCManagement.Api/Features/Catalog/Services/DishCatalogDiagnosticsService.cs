using IPCManagement.Api.Data;
using IPCManagement.Api.Features.Catalog.Contracts;
using IPCManagement.Api.Helpers;
using IPCManagement.Api.Models.Entities;
using Microsoft.EntityFrameworkCore;

namespace IPCManagement.Api.Features.Catalog.Services;

public sealed class DishCatalogDiagnosticsService : IDishCatalogDiagnosticsService
{
    private const string BomStatusPublished = "PUBLISHED";
    private static readonly decimal[] SupportedBomPriceTiers = [25000m, 30000m, 34000m];
    private readonly IpcManagementContext _context;

    public DishCatalogDiagnosticsService(IpcManagementContext context)
    {
        _context = context;
    }

    public async Task<BomCoverageReportDto> GetBomCoverageAsync()
    {
        var today = ServiceCalendar.Today();
        var dishes = await _context.Dishes
            .AsNoTracking()
            .Where(dish => dish.IsActive ?? true)
            .OrderBy(dish => dish.DishCode)
            .ToListAsync();
        var activeBomLines = await _context.Dishboms
            .AsNoTracking()
            .Where(line =>
                SupportedBomPriceTiers.Contains(line.PriceTierAmount) &&
                line.BomStatus == BomStatusPublished &&
                line.EffectiveFrom <= today &&
                (line.EffectiveTo == null || line.EffectiveTo >= today))
            .ToListAsync();
        var bomCountByDish = activeBomLines
            .GroupBy(line => GuidHelper.ToGuidString(line.DishId))
            .ToDictionary(group => group.Key, group => group.Count());
        var coverage = dishes
            .Select(dish =>
            {
                var dishId = GuidHelper.ToGuidString(dish.DishId);
                var bomLineCount = bomCountByDish.GetValueOrDefault(dishId);
                var hasBom = bomLineCount > 0;
                return new BomCoverageDishDto
                {
                    DishId = dishId,
                    DishCode = dish.DishCode,
                    DishName = dish.DishName,
                    DishType = dish.DishType,
                    DishGroup = dish.DishGroup,
                    BomLineCount = bomLineCount,
                    HasBom = hasBom,
                    Status = hasBom ? "complete" : "missing",
                    StatusLabel = hasBom ? "Đủ BOM" : "Thiếu định lượng"
                };
            })
            .ToList();

        return new BomCoverageReportDto
        {
            GeneratedAt = DateTime.UtcNow,
            TotalDishes = coverage.Count,
            CompleteDishes = coverage.Count(item => item.HasBom),
            MissingBomDishes = coverage.Count(item => !item.HasBom),
            TotalBomLines = activeBomLines.Count,
            Dishes = coverage
        };
    }

    public async Task<BomValidationReportDto> GetBomValidationAsync()
    {
        var today = ServiceCalendar.Today();
        var dishes = await _context.Dishes
            .AsNoTracking()
            .Where(dish => dish.IsActive ?? true)
            .OrderBy(dish => dish.DishCode)
            .ToListAsync();
        var activeBomLines = await _context.Dishboms
            .AsNoTracking()
            .Include(line => line.Ingredient)
            .Include(line => line.Unit)
            .Where(line =>
                SupportedBomPriceTiers.Contains(line.PriceTierAmount) &&
                line.BomStatus == BomStatusPublished &&
                line.EffectiveFrom <= today &&
                (line.EffectiveTo == null || line.EffectiveTo >= today))
            .ToListAsync();
        var legacyBomLines = await _context.Dishboms
            .AsNoTracking()
            .Include(line => line.Dish)
            .Include(line => line.Ingredient)
            .Where(line =>
                !SupportedBomPriceTiers.Contains(line.PriceTierAmount) &&
                line.BomStatus == BomStatusPublished &&
                line.EffectiveFrom <= today &&
                (line.EffectiveTo == null || line.EffectiveTo >= today))
            .OrderBy(line => line.Dish.DishCode)
            .ToListAsync();
        var linesByDish = activeBomLines
            .GroupBy(line => GuidHelper.ToGuidString(line.DishId))
            .ToDictionary(group => group.Key, group => group.ToList());
        var issues = new List<BomValidationIssueDto>();

        foreach (var dish in dishes)
        {
            var dishId = GuidHelper.ToGuidString(dish.DishId);
            if (!linesByDish.TryGetValue(dishId, out var dishLines) || dishLines.Count == 0)
            {
                issues.Add(CreateValidationIssue(
                    dish,
                    null,
                    "missing_bom",
                    "error",
                    "Món chưa có dòng BOM/định lượng đang hiệu lực."));
                continue;
            }

            foreach (var line in dishLines)
            {
                if (line.Ingredient is null || line.Ingredient.IsActive == false)
                {
                    issues.Add(CreateValidationIssue(
                        dish,
                        line,
                        "missing_ingredient",
                        "error",
                        "Dòng BOM thiếu nguyên liệu hợp lệ hoặc nguyên liệu đã ngừng sử dụng."));
                }

                if (line.GrossQtyPerServing <= 0)
                {
                    issues.Add(CreateValidationIssue(
                        dish,
                        line,
                        "zero_quantity",
                        "error",
                        "Định lượng trên mỗi suất phải lớn hơn 0."));
                }

                if (line.Unit is null || string.IsNullOrWhiteSpace(line.Unit.UnitCode) || line.Unit.ConvertRateToBase <= 0)
                {
                    issues.Add(CreateValidationIssue(
                        dish,
                        line,
                        "unknown_unit",
                        "warning",
                        "Đơn vị tính thiếu mã hoặc hệ số quy đổi không hợp lệ."));
                }

                if (line.Ingredient is not null && line.Ingredient.ReferencePrice <= 0)
                {
                    issues.Add(CreateValidationIssue(
                        dish,
                        line,
                        "missing_reference_price",
                        "warning",
                        "Nguyên liệu chưa có giá tham chiếu hợp lệ."));
                }
            }
        }

        issues.AddRange(legacyBomLines.Select(line => CreateValidationIssue(
            line.Dish,
            line,
            "legacy_bom_tier",
            "error",
            $"Dòng BOM cũ có đơn giá {line.PriceTierAmount:0.##}; chỉ chấp nhận 25000, 30000 hoặc 34000. Hãy export/import lại bằng mẫu Excel BOM theo đơn giá.")));

        return new BomValidationReportDto
        {
            GeneratedAt = DateTime.UtcNow,
            TotalIssues = issues.Count,
            MissingBomDishes = issues.Count(item => item.IssueCode == "missing_bom"),
            MissingIngredientLines = issues.Count(item => item.IssueCode == "missing_ingredient"),
            ZeroQuantityLines = issues.Count(item => item.IssueCode == "zero_quantity"),
            UnknownUnitLines = issues.Count(item => item.IssueCode == "unknown_unit"),
            MissingReferencePriceLines = issues.Count(item => item.IssueCode == "missing_reference_price"),
            Issues = issues
        };
    }

    public async Task<MenuImportHistoryDto> GetMenuImportHistoryAsync()
    {
        var latestBatch = await _context.Quantityimportbatches
            .AsNoTracking()
            .OrderByDescending(batch => batch.ImportedAt)
            .FirstOrDefaultAsync();
        var latestSchedule = await _context.Menuschedules
            .AsNoTracking()
            .OrderByDescending(schedule => schedule.WeekStartDate)
            .ThenByDescending(schedule => schedule.ServiceDate)
            .FirstOrDefaultAsync();
        var dishCount = await _context.Dishes.AsNoTracking().CountAsync(dish => dish.IsActive ?? true);
        var menuCount = await _context.Menus.AsNoTracking().CountAsync();
        var menuScheduleCount = await _context.Menuschedules.AsNoTracking().CountAsync();
        var bomLineCount = await _context.Dishboms.AsNoTracking()
            .CountAsync(line => SupportedBomPriceTiers.Contains(line.PriceTierAmount));
        var bomAdjustedCount = await _context.Bomadjustments.AsNoTracking().CountAsync();
        var lastBomAdjustedAt = await _context.Bomadjustments
            .AsNoTracking()
            .OrderByDescending(item => item.AdjustedAt)
            .Select(item => (DateTime?)item.AdjustedAt)
            .FirstOrDefaultAsync();
        var importBatchCount = await _context.Quantityimportbatches.AsNoTracking().CountAsync();
        var warnings = new List<string>();

        if (latestBatch is null)
        {
            warnings.Add("Chưa tìm thấy batch import định lượng có thông tin source/file.");
        }
        if (latestSchedule is null)
        {
            warnings.Add("Chưa có lịch thực đơn được seed/import.");
        }
        if (bomLineCount == 0)
        {
            warnings.Add("Chưa có dòng BOM nào trong catalog.");
        }
        if (bomAdjustedCount == 0)
        {
            warnings.Add("Chưa có lịch sử cập nhật BOM; số BOM tạo/cập nhật đang là snapshot dòng hiện tại.");
        }

        return new MenuImportHistoryDto
        {
            GeneratedAt = DateTime.UtcNow,
            LastImportSource = latestBatch?.SourceType,
            LastImportFileOrBatch = latestBatch?.BatchCode ?? latestBatch?.SourceCompanyName,
            LastImportedAt = latestBatch?.ImportedAt,
            LatestMenuWeekStartDate = latestSchedule?.WeekStartDate,
            LatestMenuServiceDate = latestSchedule?.ServiceDate,
            DishCount = dishCount,
            MenuCount = menuCount,
            MenuScheduleCount = menuScheduleCount,
            BomLineCount = bomLineCount,
            BomAdjustedCount = bomAdjustedCount,
            LastBomAdjustedAt = lastBomAdjustedAt,
            MealQuantityImportBatchCount = importBatchCount,
            BomCreatedOrUpdatedCount = bomLineCount + bomAdjustedCount,
            Warnings = warnings
        };
    }

    public async Task<SampleImportStatusDto> GetSampleImportStatusAsync()
    {
        var customerCount = await _context.Customers.AsNoTracking().CountAsync();
        var dishCount = await _context.Dishes.AsNoTracking().CountAsync(dish => dish.IsActive ?? true);
        var bomLineCount = await _context.Dishboms.AsNoTracking()
            .CountAsync(line => SupportedBomPriceTiers.Contains(line.PriceTierAmount));
        var menuScheduleCount = await _context.Menuschedules.AsNoTracking().CountAsync();
        var mealPlanCount = await _context.Mealquantityplans.AsNoTracking().CountAsync();
        var stockCount = await _context.Currentstocks.AsNoTracking().CountAsync();
        var reportSourceCount =
            await _context.Materialrequests.AsNoTracking().CountAsync() +
            await _context.Purchaserequests.AsNoTracking().CountAsync() +
            await _context.Inventoryissues.AsNoTracking().CountAsync() +
            await _context.Inventoryreturns.AsNoTracking().CountAsync() +
            await _context.Stockmovements.AsNoTracking().CountAsync() +
            await _context.Bomadjustments.AsNoTracking().CountAsync() +
            await _context.Quantityadjustments.AsNoTracking().CountAsync();
        var domains = new List<SampleImportDomainStatusDto>
        {
            BuildDomainStatus("customers", "Khách hàng", customerCount, "Có dữ liệu khách hàng để lập kế hoạch suất ăn."),
            BuildDomainStatus("dishes", "Món ăn", dishCount, "Có catalog món ăn."),
            BuildDomainStatus("bom", "BOM/định lượng", bomLineCount, "Có dòng định lượng nguyên liệu cho món ăn."),
            BuildDomainStatus("menuSchedules", "Lịch thực đơn", menuScheduleCount, "Có lịch thực đơn theo ngày/ca."),
            BuildDomainStatus("mealPlans", "Kế hoạch suất ăn", mealPlanCount, "Có kế hoạch số suất/định lượng."),
            BuildDomainStatus("stock", "Tồn kho", stockCount, "Có tồn kho hiện tại."),
            BuildDomainStatus("reports", "Dữ liệu báo cáo", reportSourceCount, "Có dữ liệu nguồn cho báo cáo vận hành.")
        };

        return new SampleImportStatusDto
        {
            GeneratedAt = DateTime.UtcNow,
            OverallStatus = domains.All(domain => domain.IsReady) ? "ready" : "incomplete",
            Domains = domains
        };
    }

    private static BomValidationIssueDto CreateValidationIssue(
        Dish dish,
        DishBom? line,
        string issueCode,
        string severity,
        string message) => new()
    {
        DishId = GuidHelper.ToGuidString(dish.DishId),
        DishCode = dish.DishCode,
        DishName = dish.DishName,
        BomId = line is null ? null : GuidHelper.ToGuidString(line.BomId),
        IngredientId = line is null ? null : GuidHelper.ToGuidString(line.IngredientId),
        IngredientName = line?.Ingredient?.IngredientName,
        IssueCode = issueCode,
        Severity = severity,
        Message = message
    };

    private static SampleImportDomainStatusDto BuildDomainStatus(
        string domain,
        string displayName,
        int rowCount,
        string readyNotes)
    {
        var isReady = rowCount > 0;
        return new SampleImportDomainStatusDto
        {
            Domain = domain,
            DisplayName = displayName,
            RowCount = rowCount,
            IsReady = isReady,
            Status = isReady ? "ready" : "missing",
            Notes = isReady ? readyNotes : "Chưa có dữ liệu hoặc dữ liệu chưa được import/seed."
        };
    }
}
