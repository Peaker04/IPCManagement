using IPCManagement.Api.Data;
using IPCManagement.Api.Helpers;
using IPCManagement.Api.Models.DTOs.Workflow;
using IPCManagement.Api.Models.Entities;
using Microsoft.EntityFrameworkCore;

namespace IPCManagement.Api.Services.Workflow;

public class MaterialDemandService : IMaterialDemandService
{
    private readonly IpcManagementContext _context;
    private const string PublishedBomStatus = "PUBLISHED";
    private const string DemandApprovedStatus = "MANAGERAPPROVED";
    private const decimal FixedBomRatePercent = 100m;

    public MaterialDemandService(IpcManagementContext context)
    {
        _context = context;
    }

    public async Task<MaterialDemandResultDto?> GenerateAsync(
        GenerateMaterialDemandRequestDto request,
        string? userId,
        CancellationToken cancellationToken = default)
    {
        var userIdBytes = GuidHelper.ParseGuidString(userId);
        if (userIdBytes is null)
        {
            return null;
        }

        if (!DateOnly.TryParse(request.ServiceDate, out var serviceDate))
        {
            throw new ArgumentException("Ngày phục vụ không hợp lệ.");
        }

        var scope = NormalizeScope(request.Scope, request.ShiftName);
        var shiftName = scope == "FULLDAY" ? null : NormalizeShiftName(request.ShiftName);
        if (scope != "FULLDAY" && shiftName is null)
        {
            throw new ArgumentException("Ca phục vụ không hợp lệ.");
        }

        var customerId = string.IsNullOrWhiteSpace(request.CustomerId)
            ? null
            : GuidHelper.ParseGuidString(request.CustomerId);
        if (!string.IsNullOrWhiteSpace(request.CustomerId) && customerId is null)
        {
            throw new ArgumentException("Khách hàng không hợp lệ.");
        }

        var quantityLines = await QueryConfirmedQuantityLines(serviceDate, shiftName, customerId)
            .ToListAsync(cancellationToken);
        if (quantityLines.Count == 0)
        {
            if (await HasUnsignedOffQuantityLinesAsync(serviceDate, shiftName, customerId, cancellationToken))
            {
                throw new InvalidOperationException("Cần hoàn tất số suất trước khi tạo nhu cầu nguyên liệu.");
            }

            return null;
        }

        var planContext = await ResolveProductionPlanContextAsync(quantityLines, customerId, cancellationToken);
        var plan = await EnsureProductionPlanAsync(serviceDate, scope, planContext, userIdBytes, cancellationToken);
        var (materialRequest, isRecalculate) = await EnsureMaterialRequestAsync(plan, serviceDate, scope, planContext.CustomerCode, userIdBytes, cancellationToken);
        
        var requiredIngredientIds = quantityLines
            .SelectMany(line => line.Menu.Menuitems)
            .SelectMany(item => item.Dish.Dishboms)
            .Where(bom => IsPublishedAndEffective(bom, serviceDate))
            .Select(bom => Convert.ToBase64String(bom.IngredientId))
            .Distinct()
            .Select(str => Convert.FromBase64String(str))
            .ToList();

        var currentStocks = await _context.Currentstocks
            .AsNoTracking()
            .Include(stock => stock.Unit)
            .Where(stock => requiredIngredientIds.Contains(stock.IngredientId))
            .ToListAsync(cancellationToken);

        var stockDict = currentStocks
            .GroupBy(s => Convert.ToBase64String(s.IngredientId))
            .ToDictionary(g => g.Key, g => g.ToList());
        var effectivePortionRules = await LoadEffectivePortionRulesAsync(serviceDate, cancellationToken);

        var outputLines = new List<MaterialDemandLineDto>();
        var missingBomDishes = new List<MissingBomDishDto>();
        var missingConversionIssues = new List<MissingUnitConversionIssueDto>();
        var generatedPlanLineIds = new HashSet<string>();
        var generatedRequestLineKeys = new HashSet<string>();
        foreach (var quantityLine in quantityLines)
        {
            foreach (var menuItem in quantityLine.Menu.Menuitems.OrderBy(item => item.DisplayOrder))
            {
                var productionLine = EnsureProductionPlanLine(plan, quantityLine, menuItem);
                generatedPlanLineIds.Add(BuildKey(productionLine.PlanLineId));
                var portionRule = ResolvePortionRule(effectivePortionRules, quantityLine, menuItem, serviceDate);
                var priceTier = NormalizePriceTier(quantityLine.MenuSchedule.MenuPrice);
                var activeBomLines = ResolveBomLines(menuItem.Dish.Dishboms, quantityLine.CustomerId, priceTier, serviceDate);
                if (activeBomLines.Count == 0)
                {
                    missingBomDishes.Add(MapMissingBomDish(
                        quantityLine,
                        menuItem,
                        $"Món chưa có BOM đang hiệu lực cho đơn giá {priceTier:0} và khách hàng này."));
                    continue;
                }

                foreach (var bom in activeBomLines)
                {
                    var stockConversion = CalculateStockInBomUnit(
                        stockDict.GetValueOrDefault(Convert.ToBase64String(bom.IngredientId), []),
                        bom.Unit);
                    missingConversionIssues.AddRange(stockConversion.MissingConversionIssues.Select(issue =>
                    {
                        var ingredientId = GuidHelper.ToGuidString(bom.IngredientId);
                        issue.IngredientId = ingredientId;
                        issue.IngredientName = bom.Ingredient.IngredientName;
                        issue.IssueId = $"missing_conversion:{ingredientId}:{issue.SourceUnitId}:{issue.TargetUnitId}";
                        return issue;
                    }));
                    var numbers = MaterialDemandCalculator.Calculate(
                        quantityLine.FinalServings,
                        bom.GrossQtyPerServing,
                        FixedBomRatePercent,
                        stockConversion.Quantity,
                        portionRule.PortionRatePercent,
                        portionRule.YieldLossPercent);
                    var requestLine = EnsureMaterialRequestLine(
                        materialRequest,
                        productionLine,
                        bom,
                        priceTier,
                        bom.CustomerId is null ? "global" : "customer",
                        quantityLine.FinalServings,
                        portionRule,
                        numbers);
                    generatedRequestLineKeys.Add(BuildMaterialRequestLineKey(productionLine.PlanLineId, bom.IngredientId));

                    outputLines.Add(MapLine(requestLine, productionLine, bom));
                }
            }
        }

        PruneStaleLines(plan, materialRequest, generatedPlanLineIds, generatedRequestLineKeys);

        _context.Auditlogs.Add(new Auditlog
        {
            AuditId = GuidHelper.NewId(),
            ChangedAt = DateTime.UtcNow,
            ChangedBy = userIdBytes,
            BusinessArea = "Demand",
            EntityName = nameof(Materialrequest),
            EntityId = materialRequest.RequestId,
            FieldName = isRecalculate ? "Recalculate" : "Generate",
            OldValue = null,
            NewValue = $"{outputLines.Count} demand lines; {missingBomDishes.Count} missing BOM dishes; {missingConversionIssues.Count} missing unit conversions",
            Reason = "Tạo nhu cầu nguyên liệu từ số suất, thực đơn và BOM."
        });

        await _context.SaveChangesAsync(cancellationToken);

        return new MaterialDemandResultDto
        {
            MaterialRequestId = GuidHelper.ToGuidString(materialRequest.RequestId),
            RequestCode = materialRequest.RequestCode,
            ServiceDate = serviceDate.ToString("yyyy-MM-dd"),
            Scope = scope,
            Status = materialRequest.Status,
            ProductionPlanLineCount = plan.Productionplanlines.Count,
            Lines = outputLines,
            MissingBomDishes = missingBomDishes,
            MissingConversionIssues = DeduplicateConversionIssues(missingConversionIssues)
        };
    }

    public async Task<MaterialDemandStalenessDto> GetStalenessAsync(
        string serviceDate,
        string? customerId,
        string? scopeOrShift,
        CancellationToken cancellationToken = default)
    {
        if (!DateOnly.TryParse(serviceDate, out var parsedServiceDate))
        {
            throw new ArgumentException("Ngày phục vụ không hợp lệ.");
        }

        var scope = NormalizeScope(scopeOrShift, scopeOrShift);

        var customerBytes = string.IsNullOrWhiteSpace(customerId)
            ? null
            : GuidHelper.ParseGuidString(customerId);
        if (!string.IsNullOrWhiteSpace(customerId) && customerBytes is null)
        {
            throw new ArgumentException("Khách hàng không hợp lệ.");
        }

        string? customerCode = null;
        if (customerBytes is not null)
        {
            var customer = await _context.Customers
                .AsNoTracking()
                .FirstOrDefaultAsync(item => item.CustomerId.SequenceEqual(customerBytes), cancellationToken);
            customerCode = customer?.CustomerCode;
        }

        var planCode = BuildWorkflowCode("KHSX", parsedServiceDate, scope, customerCode);
        var plan = await _context.Productionplans
            .AsNoTracking()
            .Include(item => item.Productionplanlines)
            .FirstOrDefaultAsync(item => item.PlanCode == planCode, cancellationToken);

        if (plan is null)
        {
            return new MaterialDemandStalenessDto { HasExistingPlan = false, IsStale = false };
        }

        var reasons = new List<string>();
        var requestCode = BuildWorkflowCode("MR", parsedServiceDate, scope, customerCode);
        var materialRequest = await _context.Materialrequests
            .AsNoTracking()
            .Include(request => request.Materialrequestlines)
            .FirstOrDefaultAsync(request => request.RequestCode == requestCode, cancellationToken);

        if (materialRequest is not null && materialRequest.Status == "CANCELLED")
        {
            reasons.Add("Thực đơn tuần đã được import lại, demand cũ đã bị hủy.");
        }

        var quantityPlanLineIds = plan.Productionplanlines
            .Select(line => line.QuantityPlanLineId)
            .ToList();
        if (quantityPlanLineIds.Count > 0)
        {
            var quantityLinesUpdatedAfter = await _context.Mealquantityplanlines
                .AsNoTracking()
                .Where(line => quantityPlanLineIds.Any(id => line.QuantityPlanLineId.SequenceEqual(id)))
                .Where(line => line.UpdatedAt > plan.UpdatedAt)
                .AnyAsync(cancellationToken);
            if (quantityLinesUpdatedAfter)
            {
                reasons.Add("Số suất ăn đã được chỉnh sửa sau lần tính gần nhất.");
            }

            var menuScheduleIds = await _context.Mealquantityplanlines
                .AsNoTracking()
                .Where(line => quantityPlanLineIds.Any(id => line.QuantityPlanLineId.SequenceEqual(id)))
                .Select(line => line.MenuScheduleId)
                .Distinct()
                .ToListAsync(cancellationToken);
            var menuVersionUpdatedAfter = await _context.Menuschedules
                .AsNoTracking()
                .Where(schedule => menuScheduleIds.Any(id => schedule.MenuScheduleId.SequenceEqual(id)))
                .Where(schedule => schedule.MenuVersion != null && schedule.MenuVersion.CreatedAt > plan.UpdatedAt)
                .AnyAsync(cancellationToken);
            if (menuVersionUpdatedAfter)
            {
                reasons.Add("Thực đơn tuần đã được cập nhật sau lần tính gần nhất.");
            }
        }

        if (materialRequest is not null)
        {
            var ingredientIds = materialRequest.Materialrequestlines
                .Select(line => line.IngredientId)
                .Distinct()
                .ToList();
            if (ingredientIds.Count > 0)
            {
                var stockUpdatedAfter = await _context.Currentstocks
                    .AsNoTracking()
                    .Where(stock => ingredientIds.Any(id => stock.IngredientId.SequenceEqual(id)))
                    .Where(stock => stock.LastUpdated > plan.UpdatedAt)
                    .AnyAsync(cancellationToken);
                if (stockUpdatedAfter)
                {
                    reasons.Add("Tồn kho nguyên liệu đã thay đổi sau lần tính gần nhất.");
                }
            }
        }

        return new MaterialDemandStalenessDto
        {
            HasExistingPlan = true,
            IsStale = reasons.Count > 0,
            LastGeneratedAt = plan.UpdatedAt.ToString("O"),
            Reasons = reasons
        };
    }

    public async Task<MaterialDemandApprovalDto?> ApproveAsync(
        string materialRequestId,
        string? userId,
        string? reason,
        CancellationToken cancellationToken = default)
    {
        var requestId = GuidHelper.ParseGuidString(materialRequestId)
            ?? throw new ArgumentException("Mã nhu cầu nguyên liệu không hợp lệ.");
        var userIdBytes = GuidHelper.ParseGuidString(userId);
        if (userIdBytes is null)
        {
            return null;
        }

        var request = await _context.Materialrequests
            .FirstOrDefaultAsync(item => item.RequestId == requestId, cancellationToken);
        if (request is null)
        {
            return null;
        }

        if (request.Status == DemandApprovedStatus)
        {
            return new MaterialDemandApprovalDto
            {
                MaterialRequestId = GuidHelper.ToGuidString(request.RequestId),
                RequestCode = request.RequestCode,
                OldStatus = request.Status,
                NewStatus = request.Status,
                ApprovedAt = request.ApprovedAt ?? DateTime.UtcNow
            };
        }

        if (request.Status != "DRAFT")
        {
            throw new InvalidOperationException("Chỉ nhu cầu nguyên liệu DRAFT mới được duyệt.");
        }

        var approvedAt = DateTime.UtcNow;
        var oldStatus = request.Status;
        request.Status = DemandApprovedStatus;
        request.ApprovedBy = userIdBytes;
        request.ApprovedAt = approvedAt;

        _context.Auditlogs.Add(new Auditlog
        {
            AuditId = GuidHelper.NewId(),
            ChangedAt = approvedAt,
            ChangedBy = userIdBytes,
            BusinessArea = "Demand",
            EntityName = nameof(Materialrequest),
            EntityId = request.RequestId,
            FieldName = nameof(Materialrequest.Status),
            OldValue = oldStatus,
            NewValue = DemandApprovedStatus,
            Reason = string.IsNullOrWhiteSpace(reason)
                ? "Duyệt nhu cầu nguyên liệu cho luồng mua hàng."
                : reason
        });

        await _context.SaveChangesAsync(cancellationToken);

        return new MaterialDemandApprovalDto
        {
            MaterialRequestId = GuidHelper.ToGuidString(request.RequestId),
            RequestCode = request.RequestCode,
            OldStatus = oldStatus,
            NewStatus = DemandApprovedStatus,
            ApprovedAt = approvedAt
        };
    }

    private IQueryable<Mealquantityplanline> QueryConfirmedQuantityLines(DateOnly serviceDate, string? shiftName, byte[]? customerId)
    {
        var query = _context.Mealquantityplanlines
            .Include(line => line.Customer)
            .Include(line => line.MenuSchedule)
            .Include(line => line.Menu)
                .ThenInclude(menu => menu.Menuitems)
                    .ThenInclude(item => item.Dish)
                        .ThenInclude(dish => dish.Dishboms)
                            .ThenInclude(bom => bom.Ingredient)
            .Include(line => line.Menu)
                .ThenInclude(menu => menu.Menuitems)
                    .ThenInclude(item => item.Dish)
                        .ThenInclude(dish => dish.Dishboms)
                            .ThenInclude(bom => bom.Customer)
            .Include(line => line.Menu)
                .ThenInclude(menu => menu.Menuitems)
                    .ThenInclude(item => item.Dish)
                        .ThenInclude(dish => dish.Dishboms)
                            .ThenInclude(bom => bom.Unit)
            .Include(line => line.QuantityPlan)
            .Where(line =>
                line.QuantityPlan.ServiceDate == serviceDate &&
                line.QuantityPlan.Status == "COMPLETED")
            .AsSplitQuery();

        if (!string.IsNullOrWhiteSpace(shiftName))
        {
            query = query.Where(line => line.ShiftName == shiftName);
        }

        if (customerId is not null)
        {
            query = query.Where(line => line.CustomerId.SequenceEqual(customerId));
        }

        return query;
    }

    private async Task<bool> HasUnsignedOffQuantityLinesAsync(
        DateOnly serviceDate,
        string? shiftName,
        byte[]? customerId,
        CancellationToken cancellationToken)
    {
        var query = _context.Mealquantityplanlines
            .Include(line => line.QuantityPlan)
            .Where(line =>
                line.QuantityPlan.ServiceDate == serviceDate &&
                (line.QuantityPlan.Status == "CONFIRMED" || line.QuantityPlan.Status == "ADJUSTED"));

        if (!string.IsNullOrWhiteSpace(shiftName))
        {
            query = query.Where(line => line.ShiftName == shiftName);
        }

        if (customerId is not null)
        {
            query = query.Where(line => line.CustomerId.SequenceEqual(customerId));
        }

        return await query.AnyAsync(cancellationToken);
    }

    private async Task<List<Mealquantityplanline>> EnsureDefaultImportQuantityLinesAsync(
        DateOnly serviceDate,
        string? shiftName,
        byte[]? customerId,
        byte[] userId,
        CancellationToken cancellationToken)
    {
        var schedulesQuery = _context.Menuschedules
            .Include(schedule => schedule.Customer)
            .Include(schedule => schedule.Menu)
                .ThenInclude(menu => menu.Menuitems)
                    .ThenInclude(item => item.Dish)
                        .ThenInclude(dish => dish.Dishboms)
                            .ThenInclude(bom => bom.Ingredient)
            .Include(schedule => schedule.Menu)
                .ThenInclude(menu => menu.Menuitems)
                    .ThenInclude(item => item.Dish)
                        .ThenInclude(dish => dish.Dishboms)
                            .ThenInclude(bom => bom.Customer)
            .Include(schedule => schedule.Menu)
                .ThenInclude(menu => menu.Menuitems)
                    .ThenInclude(item => item.Dish)
                        .ThenInclude(dish => dish.Dishboms)
                            .ThenInclude(bom => bom.Unit)
            .Where(schedule => schedule.ServiceDate == serviceDate);

        if (!string.IsNullOrWhiteSpace(shiftName))
        {
            schedulesQuery = schedulesQuery.Where(schedule => schedule.ShiftName == shiftName);
        }

        if (customerId is not null)
        {
            schedulesQuery = schedulesQuery.Where(schedule => schedule.CustomerId.SequenceEqual(customerId));
        }

        var schedules = await schedulesQuery
            .AsSplitQuery()
            .ToListAsync(cancellationToken);
        if (schedules.Count == 0)
        {
            return [];
        }

        var changedAt = DateTime.UtcNow;

        foreach (var customerGroup in schedules.GroupBy(schedule => Convert.ToBase64String(schedule.CustomerId)))
        {
            var customerSchedules = customerGroup.ToList();
            var customer = customerSchedules.First().Customer;
            var scope = shiftName is null ? "FULLDAY" : shiftName;
            var planCode = BuildWorkflowCode("QTY-TMP", serviceDate, scope, customer.CustomerCode);
            var plan = await _context.Mealquantityplans
                .Include(item => item.Mealquantityplanlines)
                .FirstOrDefaultAsync(item => item.PlanCode == planCode, cancellationToken);

            if (plan is null)
            {
                plan = new Mealquantityplan
                {
                    QuantityPlanId = GuidHelper.NewId(),
                    PlanCode = planCode,
                    ServiceDate = serviceDate,
                    Status = "CONFIRMED",
                    ForecastReceivedAt = DateTime.UtcNow,
                    ConfirmedAt = DateTime.UtcNow,
                    ConfirmationTime = new TimeOnly(8, 30),
                    ConfirmedBy = userId
                };
                _context.Mealquantityplans.Add(plan);
            }
            else
            {
                plan.Status = "CONFIRMED";
                plan.ConfirmedAt = DateTime.UtcNow;
                plan.ConfirmedBy = userId;
            }

            foreach (var schedule in customerSchedules)
            {
                var servings = DefaultImportServings(schedule.ShiftName);
                var existingLine = plan.Mealquantityplanlines.FirstOrDefault(line =>
                    line.MenuScheduleId.SequenceEqual(schedule.MenuScheduleId));

                if (existingLine is null)
                {
                    plan.Mealquantityplanlines.Add(new Mealquantityplanline
                    {
                        QuantityPlanLineId = GuidHelper.NewId(),
                        QuantityPlanId = plan.QuantityPlanId,
                        MenuScheduleId = schedule.MenuScheduleId,
                        CustomerId = schedule.CustomerId,
                        MenuId = schedule.MenuId,
                        ShiftName = schedule.ShiftName,
                        ForecastServings = servings,
                        ConfirmedServings = servings,
                        AdjustedServings = 0,
                        FinalServings = servings,
                        UpdatedAt = changedAt
                    });
                    continue;
                }

                existingLine.MenuScheduleId = schedule.MenuScheduleId;
                existingLine.CustomerId = schedule.CustomerId;
                existingLine.MenuId = schedule.MenuId;
                existingLine.ShiftName = schedule.ShiftName;
                existingLine.ForecastServings = servings;
                existingLine.ConfirmedServings = servings;
                existingLine.AdjustedServings = 0;
                existingLine.FinalServings = servings;
                existingLine.UpdatedAt = changedAt;
            }
        }

        _context.Auditlogs.Add(new Auditlog
        {
            AuditId = GuidHelper.NewId(),
            ChangedAt = DateTime.UtcNow,
            ChangedBy = userId,
            BusinessArea = "Demand",
            EntityName = nameof(Mealquantityplan),
            EntityId = schedules.First().MenuScheduleId,
            FieldName = "DefaultImportServings",
            OldValue = null,
            NewValue = $"{schedules.Count} menu schedules",
            Reason = "Tạm dùng số suất default từ menu import để chạy workflow MVP khi chưa có Meal Quantity Plan đã chốt."
        });

        await _context.SaveChangesAsync(cancellationToken);

        return await QueryConfirmedQuantityLines(serviceDate, shiftName, customerId)
            .ToListAsync(cancellationToken);
    }

    private static int DefaultImportServings(string shiftName)
        => string.Equals(shiftName, "AFTERNOON", StringComparison.OrdinalIgnoreCase) ? 870 : 840;

    private async Task<Productionplan> EnsureProductionPlanAsync(
        DateOnly serviceDate,
        string scope,
        ProductionPlanContext planContext,
        byte[] userId,
        CancellationToken cancellationToken)
    {
        var planCode = BuildWorkflowCode("KHSX", serviceDate, scope, planContext.CustomerCode);
        var existing = await _context.Productionplans
            .Include(plan => plan.Productionplanlines)
            .FirstOrDefaultAsync(plan => plan.PlanCode == planCode, cancellationToken);
        if (existing is not null)
        {
            existing.CustomerId = planContext.CustomerId;
            existing.WeekStartDate = planContext.WeekStartDate;
            existing.MenuVersionId = planContext.MenuVersionId;
            existing.Status = string.IsNullOrWhiteSpace(existing.Status) ? "CREATED" : existing.Status;
            existing.UpdatedAt = DateTime.UtcNow;
            return existing;
        }

        var now = DateTime.UtcNow;
        var plan = new Productionplan
        {
            PlanId = GuidHelper.NewId(),
            PlanCode = planCode,
            PlanDate = serviceDate,
            CustomerId = planContext.CustomerId,
            WeekStartDate = planContext.WeekStartDate,
            MenuVersionId = planContext.MenuVersionId,
            Status = "CREATED",
            CreatedBy = userId,
            CreatedAt = now,
            UpdatedAt = now
        };

        _context.Productionplans.Add(plan);
        return plan;
    }

    private async Task<ProductionPlanContext> ResolveProductionPlanContextAsync(
        IReadOnlyCollection<Mealquantityplanline> quantityLines,
        byte[]? requestedCustomerId,
        CancellationToken cancellationToken)
    {
        var customerGroups = quantityLines
            .Select(line => line.CustomerId)
            .Distinct(ByteArrayComparer.Instance)
            .ToList();
        var customerId = requestedCustomerId ?? (customerGroups.Count == 1 ? customerGroups[0] : null);
        var customerCode = customerId is null
            ? null
            : quantityLines.FirstOrDefault(line => line.CustomerId.SequenceEqual(customerId))?.Customer.CustomerCode;

        var weekStarts = quantityLines
            .Select(line => line.MenuSchedule.WeekStartDate)
            .Distinct()
            .ToList();
        DateOnly? weekStartDate = weekStarts.Count == 1 ? weekStarts[0] : null;
        byte[]? menuVersionId = null;

        if (customerId is not null && weekStartDate is not null)
        {
            menuVersionId = await _context.Menuversions
                .AsNoTracking()
                .Where(version => version.WeekStartDate == weekStartDate.Value)
                .Where(version => version.CustomerId.SequenceEqual(customerId))
                .OrderByDescending(version => version.PublishedAt.HasValue)
                .ThenByDescending(version => version.VersionNo)
                .Select(version => version.MenuVersionId)
                .FirstOrDefaultAsync(cancellationToken);

            if (menuVersionId is not { Length: > 0 })
            {
                menuVersionId = null;
            }
        }

        return new ProductionPlanContext(customerId, customerCode, weekStartDate, menuVersionId);
    }

    private async Task<(Materialrequest Request, bool IsRecalculate)> EnsureMaterialRequestAsync(
        Productionplan plan,
        DateOnly serviceDate,
        string scope,
        string? customerCode,
        byte[] userId,
        CancellationToken cancellationToken)
    {
        var requestCode = BuildWorkflowCode("MR", serviceDate, scope, customerCode);
        var existing = await _context.Materialrequests
            .Include(request => request.Materialrequestlines)
                .ThenInclude(line => line.Purchaserequestlines)
            .FirstOrDefaultAsync(request => request.RequestCode == requestCode, cancellationToken);
        if (existing is not null)
        {
            existing.Status = existing.Status == "MANAGERAPPROVED" ? existing.Status : "DRAFT";
            return (existing, true);
        }

        var materialRequest = new Materialrequest
        {
            RequestId = GuidHelper.NewId(),
            RequestCode = requestCode,
            PlanId = plan.PlanId,
            RequestDate = serviceDate,
            RequestScope = scope,
            Status = "DRAFT",
            CreatedBy = userId
        };

        _context.Materialrequests.Add(materialRequest);
        return (materialRequest, false);
    }

    private static string BuildWorkflowCode(string prefix, DateOnly serviceDate, string scope, string? customerCode)
    {
        var code = string.IsNullOrWhiteSpace(customerCode)
            ? null
            : customerCode.Trim().ToUpperInvariant();
        return code is null
            ? $"{prefix}-{serviceDate:yyyyMMdd}-{scope}"
            : $"{prefix}-{code}-{serviceDate:yyyyMMdd}-{scope}";
    }

    private void PruneStaleLines(
        Productionplan plan,
        Materialrequest materialRequest,
        HashSet<string> generatedPlanLineIds,
        HashSet<string> generatedRequestLineKeys)
    {
        var staleRequestLines = materialRequest.Materialrequestlines
            .Where(line => !generatedRequestLineKeys.Contains(BuildMaterialRequestLineKey(line.PlanLineId, line.IngredientId)))
            .ToList();
        foreach (var staleLine in staleRequestLines)
        {
            if (staleLine.Purchaserequestlines.Count > 0)
            {
                _context.Purchaserequestlines.RemoveRange(staleLine.Purchaserequestlines);
            }

            materialRequest.Materialrequestlines.Remove(staleLine);
            _context.Materialrequestlines.Remove(staleLine);
        }

        var stalePlanLines = plan.Productionplanlines
            .Where(line => !generatedPlanLineIds.Contains(BuildKey(line.PlanLineId)))
            .ToList();
        foreach (var staleLine in stalePlanLines)
        {
            plan.Productionplanlines.Remove(staleLine);
            _context.Productionplanlines.Remove(staleLine);
        }
    }

    private Productionplanline EnsureProductionPlanLine(
        Productionplan plan,
        Mealquantityplanline quantityLine,
        Menuitem menuItem)
    {
        var existing = plan.Productionplanlines.FirstOrDefault(line =>
            line.QuantityPlanLineId.SequenceEqual(quantityLine.QuantityPlanLineId) &&
            line.DishId.SequenceEqual(menuItem.DishId));
        if (existing is not null)
        {
            existing.TotalServings = quantityLine.FinalServings;
            existing.Dish = menuItem.Dish;
            return existing;
        }

        var productionLine = new Productionplanline
        {
            PlanLineId = GuidHelper.NewId(),
            PlanId = plan.PlanId,
            QuantityPlanLineId = quantityLine.QuantityPlanLineId,
            CustomerId = quantityLine.CustomerId,
            MenuId = quantityLine.MenuId,
            DishId = menuItem.DishId,
            ShiftName = quantityLine.ShiftName,
            TotalServings = quantityLine.FinalServings
        };
        productionLine.Dish = menuItem.Dish;

        plan.Productionplanlines.Add(productionLine);
        _context.Productionplanlines.Add(productionLine);
        return productionLine;
    }

    private Materialrequestline EnsureMaterialRequestLine(
        Materialrequest request,
        Productionplanline productionLine,
        Dishbom bom,
        decimal priceTier,
        string bomScope,
        int servings,
        AppliedPortionRule portionRule,
        MaterialDemandNumbers numbers)
    {
        var existing = request.Materialrequestlines.FirstOrDefault(line =>
            line.PlanLineId.SequenceEqual(productionLine.PlanLineId) &&
            line.IngredientId.SequenceEqual(bom.IngredientId));
        if (existing is not null)
        {
            existing.TotalServings = servings;
            existing.BomId = bom.BomId;
            existing.PriceTierAmount = priceTier;
            existing.BomScope = bomScope;
            existing.GrossQtyPerServing = DecimalPolicy.RoundQuantity(bom.GrossQtyPerServing);
            existing.BomRatePercent = FixedBomRatePercent;
            existing.AppliedPortionRuleId = portionRule.PortionRuleId;
            existing.AppliedPortionRuleSource = portionRule.Source;
            existing.AppliedPortionRatePercent = DecimalPolicy.RoundPercent(portionRule.PortionRatePercent);
            existing.YieldLossPercent = portionRule.YieldLossPercent is null ? null : DecimalPolicy.RoundPercent(portionRule.YieldLossPercent.Value);
            existing.TotalRequiredQty = numbers.TotalRequiredQty;
            existing.CurrentStockQty = numbers.CurrentStockQty;
            existing.SuggestedPurchaseQty = numbers.SuggestedPurchaseQty;
            return existing;
        }

        var requestLine = new Materialrequestline
        {
            RequestLineId = GuidHelper.NewId(),
            RequestId = request.RequestId,
            PlanLineId = productionLine.PlanLineId,
            IngredientId = bom.IngredientId,
            UnitId = bom.UnitId,
            BomId = bom.BomId,
            PriceTierAmount = priceTier,
            BomScope = bomScope,
            TotalServings = servings,
            GrossQtyPerServing = DecimalPolicy.RoundQuantity(bom.GrossQtyPerServing),
            BomRatePercent = FixedBomRatePercent,
            AppliedPortionRuleId = portionRule.PortionRuleId,
            AppliedPortionRuleSource = portionRule.Source,
            AppliedPortionRatePercent = DecimalPolicy.RoundPercent(portionRule.PortionRatePercent),
            YieldLossPercent = portionRule.YieldLossPercent is null ? null : DecimalPolicy.RoundPercent(portionRule.YieldLossPercent.Value),
            TotalRequiredQty = numbers.TotalRequiredQty,
            CurrentStockQty = numbers.CurrentStockQty,
            SuggestedPurchaseQty = numbers.SuggestedPurchaseQty
        };

        request.Materialrequestlines.Add(requestLine);
        _context.Materialrequestlines.Add(requestLine);
        return requestLine;
    }

    private static MaterialDemandLineDto MapLine(
        Materialrequestline requestLine,
        Productionplanline productionLine,
        Dishbom bom)
        => new()
        {
            MaterialRequestLineId = GuidHelper.ToGuidString(requestLine.RequestLineId),
            IngredientId = GuidHelper.ToGuidString(requestLine.IngredientId),
            IngredientName = bom.Ingredient.IngredientName,
            UnitId = GuidHelper.ToGuidString(requestLine.UnitId),
            UnitName = bom.Unit.UnitName,
            BomId = requestLine.BomId is null ? null : GuidHelper.ToGuidString(requestLine.BomId),
            PriceTierAmount = requestLine.PriceTierAmount,
            BomScope = requestLine.BomScope,
            DishId = GuidHelper.ToGuidString(productionLine.DishId),
            DishName = productionLine.Dish?.DishName ?? bom.Dish?.DishName ?? string.Empty,
            ShiftName = productionLine.ShiftName,
            TotalServings = requestLine.TotalServings,
            GrossQtyPerServing = requestLine.GrossQtyPerServing,
            BomRatePercent = requestLine.BomRatePercent,
            AppliedPortionRuleId = requestLine.AppliedPortionRuleId is null ? null : GuidHelper.ToGuidString(requestLine.AppliedPortionRuleId),
            AppliedPortionRuleSource = requestLine.AppliedPortionRuleSource,
            AppliedPortionRatePercent = requestLine.AppliedPortionRatePercent,
            YieldLossPercent = requestLine.YieldLossPercent,
            TotalRequiredQty = requestLine.TotalRequiredQty,
            CurrentStockQty = requestLine.CurrentStockQty,
            SuggestedPurchaseQty = requestLine.SuggestedPurchaseQty
        };

    private static MissingBomDishDto MapMissingBomDish(Mealquantityplanline quantityLine, Menuitem menuItem, string? message = null)
        => new()
        {
            DishId = GuidHelper.ToGuidString(menuItem.DishId),
            DishCode = menuItem.Dish.DishCode,
            DishName = menuItem.Dish.DishName,
            CustomerId = GuidHelper.ToGuidString(quantityLine.CustomerId),
            CustomerCode = quantityLine.Customer.CustomerCode,
            CustomerName = quantityLine.Customer.CustomerName,
            MenuId = GuidHelper.ToGuidString(quantityLine.MenuId),
            MenuName = quantityLine.Menu.MenuName,
            ShiftName = quantityLine.ShiftName,
            TotalServings = quantityLine.FinalServings,
            Message = message ?? "Món chưa có dòng BOM/định lượng đang hiệu lực nên chưa sinh nhu cầu nguyên liệu."
        };

    private async Task<IReadOnlyList<Portionrule>> LoadEffectivePortionRulesAsync(
        DateOnly serviceDate,
        CancellationToken cancellationToken)
        => await _context.Portionrules
            .AsNoTracking()
            .Where(rule =>
                rule.Status == "ACTIVE" &&
                rule.EffectiveFrom <= serviceDate &&
                (rule.EffectiveTo == null || rule.EffectiveTo >= serviceDate))
            .ToListAsync(cancellationToken);

    private static AppliedPortionRule ResolvePortionRule(
        IReadOnlyList<Portionrule> rules,
        Mealquantityplanline quantityLine,
        Menuitem menuItem,
        DateOnly serviceDate)
    {
        var customerKey = BuildKey(quantityLine.CustomerId);
        var dishKey = BuildKey(menuItem.DishId);
        var dayCode = ToDayCode(serviceDate);
        var shiftName = NormalizeShiftName(quantityLine.ShiftName);
        var dishCategory = NormalizeNullableText(menuItem.Dish.DishGroup ?? menuItem.Dish.DishType);
        var slotName = NormalizeNullableCode(menuItem.DishSlot);
        var candidates = rules
            .Where(rule => BuildKey(rule.CustomerId) == customerKey)
            .Where(rule => MatchesCsv(rule.ActiveWeekDays, dayCode))
            .Where(rule => MatchesCsv(rule.ShiftNames, shiftName))
            .Where(rule => rule.DishId is null || BuildKey(rule.DishId) == dishKey)
            .Where(rule => MatchesNullableScope(rule.SlotName, slotName, NormalizeNullableCode))
            .Where(rule => MatchesNullableScope(rule.DishCategory, dishCategory, NormalizeNullableText))
            .OrderByDescending(PortionRuleMatchScore)
            .ThenByDescending(rule => rule.EffectiveFrom)
            .ToList();
        var rule = candidates.FirstOrDefault();
        if (rule is null)
        {
            return new AppliedPortionRule(
                null,
                "CONTRACT_DEFAULT",
                100,
                quantityLine.MenuSchedule.BomRatePercent,
                null);
        }

        return new AppliedPortionRule(
            rule.PortionRuleId,
            ResolvePortionRuleSource(rule),
            rule.PortionRatePercent,
            rule.BomRatePercent ?? quantityLine.MenuSchedule.BomRatePercent,
            rule.YieldLossPercent);
    }

    private static bool MatchesCsv(string? csv, string? value)
    {
        var values = SplitOptionalCsv(csv);
        if (values.Count == 0)
        {
            return true;
        }

        return !string.IsNullOrWhiteSpace(value) &&
               values.Contains(value, StringComparer.OrdinalIgnoreCase);
    }

    private static bool MatchesNullableScope(
        string? ruleValue,
        string? requestValue,
        Func<string?, string?> normalize)
    {
        var normalizedRuleValue = normalize(ruleValue);
        if (string.IsNullOrWhiteSpace(normalizedRuleValue))
        {
            return true;
        }

        return string.Equals(normalizedRuleValue, normalize(requestValue), StringComparison.Ordinal);
    }

    private static int PortionRuleMatchScore(Portionrule rule)
    {
        var source = ResolvePortionRuleSource(rule);
        var baseScore = source switch
        {
            "DISH_OVERRIDE" => 400,
            "CATEGORY_SLOT" => 300,
            "CUSTOMER_SHIFT" => 200,
            _ => 100
        };

        return baseScore + rule.Priority;
    }

    private static string ResolvePortionRuleSource(Portionrule rule)
    {
        if (rule.DishId is not null)
        {
            return "DISH_OVERRIDE";
        }

        if (!string.IsNullOrWhiteSpace(rule.MenuVariant) ||
            !string.IsNullOrWhiteSpace(rule.MenuSectionName) ||
            !string.IsNullOrWhiteSpace(rule.SlotName) ||
            !string.IsNullOrWhiteSpace(rule.DishCategory))
        {
            return "CATEGORY_SLOT";
        }

        if (!string.IsNullOrWhiteSpace(rule.ActiveWeekDays) ||
            !string.IsNullOrWhiteSpace(rule.ShiftNames))
        {
            return "CUSTOMER_SHIFT";
        }

        return "CUSTOMER_DEFAULT";
    }

    private static IReadOnlyList<string> SplitOptionalCsv(string? value)
        => string.IsNullOrWhiteSpace(value)
            ? []
            : value.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);

    private static string? NormalizeNullableCode(string? value)
        => string.IsNullOrWhiteSpace(value)
            ? null
            : value.Trim().ToUpperInvariant();

    private static string? NormalizeNullableText(string? value)
        => string.IsNullOrWhiteSpace(value)
            ? null
            : value.Trim();

    private sealed record StockConversionResult(decimal Quantity, IReadOnlyList<MissingUnitConversionIssueDto> MissingConversionIssues);

    private static string BuildMaterialRequestLineKey(byte[] planLineId, byte[] ingredientId)
        => $"{BuildKey(planLineId)}:{BuildKey(ingredientId)}";

    private static string BuildKey(byte[] value)
        => Convert.ToBase64String(value);

    private static bool IsPublishedAndEffective(Dishbom bom, DateOnly serviceDate)
        => bom.BomStatus == PublishedBomStatus &&
           bom.EffectiveFrom <= serviceDate &&
           (bom.EffectiveTo is null || bom.EffectiveTo >= serviceDate);

    private static List<Dishbom> ResolveBomLines(
        IEnumerable<Dishbom> lines,
        byte[] customerId,
        decimal priceTier,
        DateOnly serviceDate)
    {
        var effectiveLines = lines
            .Where(bom => IsPublishedAndEffective(bom, serviceDate))
            .Where(bom => bom.PriceTierAmount == priceTier)
            .ToList();
        var customerLines = effectiveLines
            .Where(bom => bom.CustomerId is not null && bom.CustomerId.SequenceEqual(customerId))
            .ToList();

        return customerLines.Count > 0
            ? customerLines
            : effectiveLines.Where(bom => bom.CustomerId is null).ToList();
    }

    private static decimal NormalizePriceTier(decimal menuPrice)
    {
        var normalized = decimal.Round(menuPrice, 0);
        return normalized switch
        {
            25000m or 30000m or 34000m => normalized,
            _ => throw new InvalidOperationException($"Đơn giá thực đơn {menuPrice:0.##} không thuộc tier BOM 25000/30000/34000.")
        };
    }

    private static StockConversionResult CalculateStockInBomUnit(IReadOnlyList<Currentstock> stocks, Unit bomUnit)
    {
        if (stocks.Count == 0)
        {
            return new StockConversionResult(0m, []);
        }

        var total = 0m;
        var issues = new List<MissingUnitConversionIssueDto>();
        foreach (var stock in stocks)
        {
            if (TryConvertQuantity(stock.CurrentQty, stock.Unit, bomUnit, out var convertedQty))
            {
                total += convertedQty;
                continue;
            }

            issues.Add(BuildMissingConversionIssue(stock.Unit, bomUnit));
        }

        return new StockConversionResult(DecimalPolicy.RoundQuantity(total), DeduplicateConversionIssues(issues));
    }

    private static bool TryConvertQuantity(decimal quantity, Unit sourceUnit, Unit targetUnit, out decimal convertedQty)
    {
        if (sourceUnit.UnitId.SequenceEqual(targetUnit.UnitId))
        {
            convertedQty = quantity;
            return true;
        }

        if (!CanConvertUnits(sourceUnit, targetUnit))
        {
            convertedQty = 0m;
            return false;
        }

        convertedQty = DecimalPolicy.RoundQuantity(quantity * sourceUnit.ConvertRateToBase / targetUnit.ConvertRateToBase);
        return true;
    }

    private static bool CanConvertUnits(Unit sourceUnit, Unit targetUnit)
        => sourceUnit.ConvertRateToBase > 0 &&
           targetUnit.ConvertRateToBase > 0 &&
           string.Equals(NormalizedBaseUnitCode(sourceUnit), NormalizedBaseUnitCode(targetUnit), StringComparison.OrdinalIgnoreCase);

    private static string NormalizedBaseUnitCode(Unit unit)
        => string.IsNullOrWhiteSpace(unit.BaseUnitCode)
            ? unit.UnitCode.Trim().ToUpperInvariant()
            : unit.BaseUnitCode.Trim().ToUpperInvariant();

    private static MissingUnitConversionIssueDto BuildMissingConversionIssue(Unit sourceUnit, Unit targetUnit)
    {
        var sourceUnitId = GuidHelper.ToGuidString(sourceUnit.UnitId);
        var targetUnitId = GuidHelper.ToGuidString(targetUnit.UnitId);
        return new MissingUnitConversionIssueDto
        {
            IssueId = $"missing_conversion:{sourceUnitId}:{targetUnitId}",
            SourceUnitId = sourceUnitId,
            SourceUnitName = sourceUnit.UnitName,
            TargetUnitId = targetUnitId,
            TargetUnitName = targetUnit.UnitName,
            Message = $"Thiếu cấu hình quy đổi từ {sourceUnit.UnitName} sang {targetUnit.UnitName}."
        };
    }

    private static IReadOnlyList<MissingUnitConversionIssueDto> DeduplicateConversionIssues(IEnumerable<MissingUnitConversionIssueDto> issues)
        => issues
            .GroupBy(issue => issue.IssueId)
            .Select(group => group.First())
            .ToList();

    private static string NormalizeScope(string? scope, string? shiftName)
    {
        var normalized = (scope ?? string.Empty).Trim().ToUpperInvariant();
        if (normalized is "FULLDAY")
        {
            return "FULLDAY";
        }

        return NormalizeShiftName(shiftName ?? scope) ?? "FULLDAY";
    }

    private static string? NormalizeShiftName(string? shift)
        => (shift ?? string.Empty).Trim().ToUpperInvariant() switch
        {
            "MORNING" or "CA SANG" or "CA SÁNG" => "MORNING",
            "AFTERNOON" or "CA CHIEU" or "CA CHIỀU" => "AFTERNOON",
            _ => null
        };

    private static string ToDayCode(DateOnly date)
        => date.DayOfWeek switch
        {
            DayOfWeek.Monday => "t2",
            DayOfWeek.Tuesday => "t3",
            DayOfWeek.Wednesday => "t4",
            DayOfWeek.Thursday => "t5",
            DayOfWeek.Friday => "t6",
            DayOfWeek.Saturday => "t7",
            DayOfWeek.Sunday => "cn",
            _ => string.Empty
        };

    private sealed record AppliedPortionRule(
        byte[]? PortionRuleId,
        string Source,
        decimal PortionRatePercent,
        decimal BomRatePercent,
        decimal? YieldLossPercent);

    private sealed record ProductionPlanContext(
        byte[]? CustomerId,
        string? CustomerCode,
        DateOnly? WeekStartDate,
        byte[]? MenuVersionId);

    private sealed class ByteArrayComparer : IEqualityComparer<byte[]>
    {
        public static readonly ByteArrayComparer Instance = new();

        public bool Equals(byte[]? x, byte[]? y)
            => ReferenceEquals(x, y) || (x is not null && y is not null && x.SequenceEqual(y));

        public int GetHashCode(byte[] obj)
        {
            var hash = new HashCode();
            foreach (var item in obj)
            {
                hash.Add(item);
            }

            return hash.ToHashCode();
        }
    }
}
