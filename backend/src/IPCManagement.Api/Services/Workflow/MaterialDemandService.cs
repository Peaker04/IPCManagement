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
            quantityLines = await EnsureDefaultImportQuantityLinesAsync(
                serviceDate,
                shiftName,
                customerId,
                userIdBytes,
                cancellationToken);
        }

        if (quantityLines.Count == 0)
        {
            return null;
        }

        var customerCode = customerId is null ? null : quantityLines.First().Customer.CustomerCode;
        var plan = await EnsureProductionPlanAsync(serviceDate, scope, customerCode, userIdBytes, cancellationToken);
        var materialRequest = await EnsureMaterialRequestAsync(plan, serviceDate, scope, customerCode, userIdBytes, cancellationToken);
        
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
                var activeBomLines = menuItem.Dish.Dishboms
                    .Where(bom => IsPublishedAndEffective(bom, serviceDate))
                    .ToList();
                if (activeBomLines.Count == 0)
                {
                    missingBomDishes.Add(MapMissingBomDish(quantityLine, menuItem));
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
                        portionRule.BomRatePercent,
                        stockConversion.Quantity,
                        portionRule.PortionRatePercent,
                        portionRule.YieldLossPercent);
                    var requestLine = EnsureMaterialRequestLine(
                        materialRequest,
                        productionLine,
                        bom,
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
            FieldName = "Generate",
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
                            .ThenInclude(bom => bom.Unit)
            .Include(line => line.QuantityPlan)
            .Where(line =>
                line.QuantityPlan.ServiceDate == serviceDate &&
                line.QuantityPlan.Status == "CONFIRMED")
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
                        FinalServings = servings
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
        string? customerCode,
        byte[] userId,
        CancellationToken cancellationToken)
    {
        var planCode = BuildWorkflowCode("KHSX", serviceDate, scope, customerCode);
        var existing = await _context.Productionplans
            .Include(plan => plan.Productionplanlines)
            .FirstOrDefaultAsync(plan => plan.PlanCode == planCode, cancellationToken);
        if (existing is not null)
        {
            return existing;
        }

        var plan = new Productionplan
        {
            PlanId = GuidHelper.NewId(),
            PlanCode = planCode,
            PlanDate = serviceDate,
            Status = "CREATED",
            CreatedBy = userId,
            CreatedAt = DateTime.UtcNow
        };

        _context.Productionplans.Add(plan);
        return plan;
    }

    private async Task<Materialrequest> EnsureMaterialRequestAsync(
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
            return existing;
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
        return materialRequest;
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
        int servings,
        AppliedPortionRule portionRule,
        MaterialDemandNumbers numbers)
    {
        var bomRatePercent = portionRule.BomRatePercent;
        var existing = request.Materialrequestlines.FirstOrDefault(line =>
            line.PlanLineId.SequenceEqual(productionLine.PlanLineId) &&
            line.IngredientId.SequenceEqual(bom.IngredientId));
        if (existing is not null)
        {
            existing.TotalServings = servings;
            existing.GrossQtyPerServing = DecimalPolicy.RoundQuantity(bom.GrossQtyPerServing);
            existing.BomRatePercent = DecimalPolicy.RoundPercent(bomRatePercent);
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
            TotalServings = servings,
            GrossQtyPerServing = DecimalPolicy.RoundQuantity(bom.GrossQtyPerServing),
            BomRatePercent = DecimalPolicy.RoundPercent(bomRatePercent),
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

    private static MissingBomDishDto MapMissingBomDish(Mealquantityplanline quantityLine, Menuitem menuItem)
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
            Message = "Món chưa có dòng BOM/định lượng đang hiệu lực nên chưa sinh nhu cầu nguyên liệu."
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
}
