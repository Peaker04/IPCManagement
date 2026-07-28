using IPCManagement.Api.Helpers;
using IPCManagement.Api.Data.Repositories;
using IPCManagement.Api.Data;
using IPCManagement.Api.Models.Entities;
using Microsoft.EntityFrameworkCore;
using IPCManagement.Api.Features.Planning.Contracts;
using IPCManagement.Api.Shared.Contracts;

using IPCManagement.Api.Exceptions;

namespace IPCManagement.Api.Features.Planning.Services;

public class ProductionPlanService : IProductionPlanService
{
    private readonly IProductionPlanRepository _productionPlanRepository;
    private readonly IpcManagementContext _context;

    public ProductionPlanService(IProductionPlanRepository productionPlanRepository, IpcManagementContext context)
    {
        _productionPlanRepository = productionPlanRepository;
        _context = context;
    }

    public async Task<PagedResponseDto<ProductionPlanDto>> GetPagedAsync(PagedRequestDto request)
    {
        var (items, totalCount) = await _productionPlanRepository.GetPagedAsync(
            request.PageNumber,
            request.PageSize);

        return PagedResponseDto<ProductionPlanDto>.Create(
            items.Select(plan => MapPlan(plan)),
            totalCount,
            request.PageNumber,
            request.PageSize);
    }

    public async Task<ProductionPlanDto?> GetByIdAsync(string id)
    {
        var bytes = GuidHelper.ParseGuidString(id);
        if (bytes is null) return null;

        var plan = await _productionPlanRepository.GetByIdWithLinesAsync(bytes);
        return plan is null ? null : MapPlan(plan, includeLines: true);
    }

    public async Task<IReadOnlyList<ProductionPlanDto>> GetFilteredAsync(
        string? serviceDate,
        string? dateFrom,
        string? dateTo,
        string? customerId,
        CancellationToken cancellationToken = default)
    {
        var parsedDate = ParseOptionalDate(serviceDate, "Ngày phục vụ");
        var parsedDateFrom = ParseOptionalDate(dateFrom, "Ngày bắt đầu");
        var parsedDateTo = ParseOptionalDate(dateTo, "Ngày kết thúc");
        if (parsedDateFrom.HasValue && parsedDateTo.HasValue && parsedDateFrom > parsedDateTo)
        {
            throw new ArgumentException("Khoảng ngày kế hoạch sản xuất không hợp lệ.");
        }

        byte[]? customerIdBytes = null;
        if (!string.IsNullOrWhiteSpace(customerId))
        {
            customerIdBytes = GuidHelper.ParseGuidString(customerId)
                ?? throw new ArgumentException("CustomerId không hợp lệ.");
        }

        var plans = await _productionPlanRepository.GetFilteredAsync(parsedDate, parsedDateFrom, parsedDateTo, customerIdBytes, cancellationToken);
        return plans.Select(plan => MapPlan(plan, includeLines: true)).ToList();
    }

    private static DateOnly? ParseOptionalDate(string? value, string label)
    {
        if (string.IsNullOrWhiteSpace(value)) return null;
        if (DateOnly.TryParse(value, out var parsed)) return parsed;
        throw new ArgumentException($"{label} không hợp lệ.");
    }

    public async Task<DailyProductionPlanDto> GetDailyAsync(
        string? serviceDate,
        string? customerId,
        string? shiftName,
        CancellationToken cancellationToken = default)
    {
        var parsedDate = ParseServiceDate(serviceDate);
        var customerIdBytes = ParseOptionalCustomerId(customerId);
        var normalizedShift = NormalizeShiftName(shiftName);

        var plans = await BuildDailyPlansQuery(parsedDate, customerIdBytes, normalizedShift)
            .AsNoTracking()
            .ToListAsync(cancellationToken);

        return BuildDailyDto(parsedDate, customerIdBytes, normalizedShift, plans);
    }

    public async Task<DailyProductionPlanDto> SendDailyToKitchenAsync(
        SendDailyProductionPlanRequest request,
        string? userId,
        CancellationToken cancellationToken = default)
    {
        var userIdBytes = GuidHelper.ParseGuidString(userId)
            ?? throw new UnauthorizedAccessException("Không xác định được người gửi bếp.");
        var parsedDate = ParseServiceDate(request.ServiceDate);
        var customerIdBytes = ParseOptionalCustomerId(request.CustomerId);
        var normalizedShift = NormalizeShiftName(request.ShiftName);
        var plans = await BuildDailyPlansQuery(parsedDate, customerIdBytes, normalizedShift)
            .ToListAsync(cancellationToken);
        if (plans.Count == 0)
        {
            throw new BusinessRuleException("Chưa có kế hoạch sản xuất để gửi bếp.");
        }

        var now = DateTime.UtcNow;
        foreach (var plan in plans)
        {
            plan.Status = "SENTTOKITCHEN";
            plan.SentToKitchenAt = now;
            plan.SentToKitchenBy = userIdBytes;
            plan.UpdatedAt = now;
            _context.Auditlogs.Add(new AuditLog
            {
                AuditId = GuidHelper.NewId(),
                ChangedAt = now,
                ChangedBy = userIdBytes,
                BusinessArea = "Kitchen",
                EntityName = nameof(ProductionPlan),
                EntityId = plan.PlanId,
                FieldName = "SendToKitchen",
                OldValue = null,
                NewValue = plan.PlanCode,
                Reason = string.IsNullOrWhiteSpace(request.Reason)
                    ? "Gửi kế hoạch sản xuất trong ngày cho bếp."
                    : request.Reason
            });
        }

        await _context.SaveChangesAsync(cancellationToken);

        var refreshed = await BuildDailyPlansQuery(parsedDate, customerIdBytes, normalizedShift)
            .AsNoTracking()
            .ToListAsync(cancellationToken);
        return BuildDailyDto(parsedDate, customerIdBytes, normalizedShift, refreshed);
    }

    private static ProductionPlanDto MapPlan(ProductionPlan plan, bool includeLines = false) => new()
    {
        PlanId = GuidHelper.ToGuidString(plan.PlanId),
        PlanCode = plan.PlanCode,
        PlanDate = plan.PlanDate,
        CustomerId = plan.CustomerId is null ? null : GuidHelper.ToGuidString(plan.CustomerId),
        CustomerCode = plan.Customer?.CustomerCode,
        CustomerName = plan.Customer?.CustomerName,
        WeekStartDate = plan.WeekStartDate,
        MenuVersionId = plan.MenuVersionId is null ? null : GuidHelper.ToGuidString(plan.MenuVersionId),
        MenuVersionNo = plan.MenuVersion?.VersionNo,
        MenuVersionStatus = plan.MenuVersion?.Status,
        Status = plan.Status,
        CreatedBy = GuidHelper.ToGuidString(plan.CreatedBy),
        CreatedByName = plan.CreatedByNavigation?.FullName,
        CreatedAt = plan.CreatedAt,
        SentToKitchenAt = plan.SentToKitchenAt,
        SentToKitchenBy = plan.SentToKitchenBy is null ? null : GuidHelper.ToGuidString(plan.SentToKitchenBy),
        SentToKitchenByName = plan.SentToKitchenByNavigation?.FullName,
        Lines = includeLines
            ? plan.Productionplanlines.Select(MapLine).ToList()
            : new List<ProductionPlanLineDto>()
    };

    private static ProductionPlanLineDto MapLine(ProductionPlanLine line) => new()
    {
        PlanLineId = GuidHelper.ToGuidString(line.PlanLineId),
        DishId = GuidHelper.ToGuidString(line.DishId),
        DishName = line.Dish?.DishName,
        ShiftName = line.ShiftName,
        TotalServings = line.TotalServings,
        PriceTierAmount = line.Materialrequestlines.FirstOrDefault()?.PriceTierAmount,
        BomScope = line.Materialrequestlines.FirstOrDefault()?.BomScope,
        TotalRequiredQty = line.Materialrequestlines.Sum(item => item.TotalRequiredQty),
        SuggestedPurchaseQty = line.Materialrequestlines.Sum(item => item.SuggestedPurchaseQty),
        HasKitchenIssue = line.Materialrequestlines.Any(item => item.SuggestedPurchaseQty > 0),
        IsReceivedByKitchen = false
    };

    private IQueryable<ProductionPlan> BuildDailyPlansQuery(DateOnly serviceDate, byte[]? customerId, string? shiftName)
    {
        var query = _context.Productionplans
            .Include(plan => plan.Customer)
            .Include(plan => plan.MenuVersion)
            .Include(plan => plan.CreatedByNavigation)
            .Include(plan => plan.SentToKitchenByNavigation)
            .Include(plan => plan.Productionplanlines)
                .ThenInclude(line => line.Dish)
            .Include(plan => plan.Productionplanlines)
                .ThenInclude(line => line.Materialrequestlines)
                    .ThenInclude(line => line.Ingredient)
            .Where(plan => plan.PlanDate == serviceDate)
            .AsSplitQuery()
            .AsQueryable();

        if (customerId is not null)
        {
            query = query.Where(plan => plan.CustomerId != null && plan.CustomerId.SequenceEqual(customerId));
        }
        if (!string.IsNullOrWhiteSpace(shiftName))
        {
            query = query.Where(plan => plan.Productionplanlines.Any(line => line.ShiftName == shiftName));
        }

        return query.OrderBy(plan => plan.Customer!.CustomerCode).ThenBy(plan => plan.PlanCode);
    }

    private static DailyProductionPlanDto BuildDailyDto(
        DateOnly serviceDate,
        byte[]? customerId,
        string? shiftName,
        IReadOnlyList<ProductionPlan> plans)
    {
        var planDtos = plans.Select(plan => MapPlan(plan, includeLines: true)).ToList();
        if (!string.IsNullOrWhiteSpace(shiftName))
        {
            foreach (var plan in planDtos)
            {
                plan.Lines = plan.Lines
                    .Where(line => string.Equals(line.ShiftName, shiftName, StringComparison.OrdinalIgnoreCase))
                    .ToList();
            }
        }

        var warnings = new List<string>();
        if (plans.Count == 0)
        {
            warnings.Add("Chưa có KHSX cho ngày/khách/ca này.");
        }
        if (planDtos.SelectMany(plan => plan.Lines).Any(line => line.SuggestedPurchaseQty > 0))
        {
            warnings.Add("Một số nguyên liệu còn thiếu, cần đối chiếu tồn kho hoặc thu mua trước khi bếp nhận.");
        }
        if (plans.Any(plan => plan.SentToKitchenAt is null))
        {
            warnings.Add("Có kế hoạch chưa gửi bếp.");
        }

        var firstCustomer = plans.Select(plan => plan.Customer).FirstOrDefault(customer => customer is not null);
        return new DailyProductionPlanDto
        {
            ServiceDate = serviceDate,
            CustomerId = customerId is null ? null : GuidHelper.ToGuidString(customerId),
            CustomerCode = firstCustomer?.CustomerCode,
            CustomerName = firstCustomer?.CustomerName,
            ShiftName = shiftName,
            TotalPlans = plans.Count,
            SentPlans = plans.Count(plan => plan.SentToKitchenAt is not null || plan.Status == "SENTTOKITCHEN"),
            TotalDishes = planDtos.Sum(plan => plan.Lines.Count),
            TotalServings = planDtos.Sum(plan => plan.Lines
                .GroupBy(line => line.ShiftName, StringComparer.OrdinalIgnoreCase)
                .Sum(group => group.Max(line => line.TotalServings))),
            TotalRequiredQty = planDtos.SelectMany(plan => plan.Lines).Sum(line => line.TotalRequiredQty),
            SuggestedPurchaseQty = planDtos.SelectMany(plan => plan.Lines).Sum(line => line.SuggestedPurchaseQty),
            Warnings = warnings,
            Plans = planDtos
        };
    }

    private static DateOnly ParseServiceDate(string? serviceDate)
        => DateOnly.TryParse(serviceDate, out var parsed)
            ? parsed
            : ServiceCalendar.Today();

    private static byte[]? ParseOptionalCustomerId(string? customerId)
        => string.IsNullOrWhiteSpace(customerId)
            ? null
            : GuidHelper.ParseGuidString(customerId) ?? throw new ArgumentException("CustomerId không hợp lệ.");

    private static string? NormalizeShiftName(string? shift)
        => (shift ?? string.Empty).Trim().ToUpperInvariant() switch
        {
            "MORNING" or "CA SANG" or "CA SÁNG" => "MORNING",
            "AFTERNOON" or "CA CHIEU" or "CA CHIỀU" => "AFTERNOON",
            _ => null
        };
}
