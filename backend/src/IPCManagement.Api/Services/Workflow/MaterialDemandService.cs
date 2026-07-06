using IPCManagement.Api.Data;
using IPCManagement.Api.Helpers;
using IPCManagement.Api.Models.DTOs.Workflow;
using IPCManagement.Api.Models.Entities;
using Microsoft.EntityFrameworkCore;

namespace IPCManagement.Api.Services.Workflow;

public class MaterialDemandService : IMaterialDemandService
{
    private readonly IpcManagementContext _context;

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

        var quantityLines = await QueryConfirmedQuantityLines(serviceDate, shiftName)
            .ToListAsync(cancellationToken);
        if (quantityLines.Count == 0)
        {
            return null;
        }

        var plan = await EnsureProductionPlanAsync(serviceDate, scope, userIdBytes, cancellationToken);
        var materialRequest = await EnsureMaterialRequestAsync(plan, serviceDate, scope, userIdBytes, cancellationToken);
        
        var requiredIngredientIds = quantityLines
            .SelectMany(line => line.Menu.Menuitems)
            .SelectMany(item => item.Dish.Dishboms)
            .Where(bom => bom.EffectiveFrom <= serviceDate && (bom.EffectiveTo is null || bom.EffectiveTo >= serviceDate))
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

        var outputLines = new List<MaterialDemandLineDto>();
        var missingBomDishes = new List<MissingBomDishDto>();
        var generatedPlanLineIds = new HashSet<string>();
        var generatedRequestLineKeys = new HashSet<string>();
        foreach (var quantityLine in quantityLines)
        {
            foreach (var menuItem in quantityLine.Menu.Menuitems.OrderBy(item => item.DisplayOrder))
            {
                var productionLine = EnsureProductionPlanLine(plan, quantityLine, menuItem);
                generatedPlanLineIds.Add(BuildKey(productionLine.PlanLineId));
                var activeBomLines = menuItem.Dish.Dishboms
                    .Where(bom => bom.EffectiveFrom <= serviceDate && (bom.EffectiveTo is null || bom.EffectiveTo >= serviceDate))
                    .ToList();
                if (activeBomLines.Count == 0)
                {
                    missingBomDishes.Add(MapMissingBomDish(quantityLine, menuItem));
                    continue;
                }

                foreach (var bom in activeBomLines)
                {
                    var currentStockQty = CalculateStockInBomUnit(
                        stockDict.GetValueOrDefault(Convert.ToBase64String(bom.IngredientId), []),
                        bom.Unit);
                    var numbers = MaterialDemandCalculator.Calculate(
                        quantityLine.FinalServings,
                        bom.GrossQtyPerServing,
                        quantityLine.MenuSchedule.BomRatePercent,
                        currentStockQty);
                    var requestLine = EnsureMaterialRequestLine(
                        materialRequest,
                        productionLine,
                        bom,
                        quantityLine.FinalServings,
                        quantityLine.MenuSchedule.BomRatePercent,
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
            NewValue = $"{outputLines.Count} demand lines; {missingBomDishes.Count} missing BOM dishes",
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
            MissingBomDishes = missingBomDishes
        };
    }

    private IQueryable<Mealquantityplanline> QueryConfirmedQuantityLines(DateOnly serviceDate, string? shiftName)
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

        return query;
    }

    private async Task<Productionplan> EnsureProductionPlanAsync(
        DateOnly serviceDate,
        string scope,
        byte[] userId,
        CancellationToken cancellationToken)
    {
        var planCode = $"KHSX-{serviceDate:yyyyMMdd}-{scope}";
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
        byte[] userId,
        CancellationToken cancellationToken)
    {
        var requestCode = $"MR-{serviceDate:yyyyMMdd}-{scope}";
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
        decimal bomRatePercent,
        MaterialDemandNumbers numbers)
    {
        var existing = request.Materialrequestlines.FirstOrDefault(line =>
            line.PlanLineId.SequenceEqual(productionLine.PlanLineId) &&
            line.IngredientId.SequenceEqual(bom.IngredientId));
        if (existing is not null)
        {
            existing.TotalServings = servings;
            existing.GrossQtyPerServing = DecimalPolicy.RoundQuantity(bom.GrossQtyPerServing);
            existing.BomRatePercent = DecimalPolicy.RoundPercent(bomRatePercent);
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

    private static string BuildMaterialRequestLineKey(byte[] planLineId, byte[] ingredientId)
        => $"{BuildKey(planLineId)}:{BuildKey(ingredientId)}";

    private static string BuildKey(byte[] value)
        => Convert.ToBase64String(value);

    private static decimal CalculateStockInBomUnit(IReadOnlyList<Currentstock> stocks, Unit bomUnit)
    {
        if (stocks.Count == 0)
        {
            return 0m;
        }

        var bomRate = bomUnit.ConvertRateToBase <= 0 ? 1m : bomUnit.ConvertRateToBase;
        return stocks.Sum(stock =>
        {
            var stockRate = stock.Unit.ConvertRateToBase <= 0 ? bomRate : stock.Unit.ConvertRateToBase;
            return stock.CurrentQty * stockRate / bomRate;
        });
    }

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
}
