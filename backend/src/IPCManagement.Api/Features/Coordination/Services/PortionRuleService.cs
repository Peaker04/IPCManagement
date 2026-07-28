using IPCManagement.Api.Data;
using IPCManagement.Api.Features.Coordination.Contracts;
using IPCManagement.Api.Helpers;
using IPCManagement.Api.Models.Entities;
using Microsoft.EntityFrameworkCore;

namespace IPCManagement.Api.Features.Coordination.Services;

public sealed class PortionRuleService : IPortionRuleService
{
    private const decimal FixedBomRatePercent = 100m;
    private readonly IpcManagementContext _context;

    public PortionRuleService(IpcManagementContext context)
    {
        _context = context;
    }

    public async Task<IReadOnlyList<PortionRuleDto>> GetPortionRulesAsync(PortionRuleQueryDto query)
    {
        var rulesQuery = _context.Portionrules
            .Include(rule => rule.Customer)
            .Include(rule => rule.Dish)
            .AsNoTracking()
            .AsSplitQuery()
            .AsQueryable();

        if (!string.IsNullOrWhiteSpace(query.CustomerId))
        {
            var customerIdBytes = GuidHelper.ParseGuidString(query.CustomerId);
            if (customerIdBytes is null)
            {
                return [];
            }

            rulesQuery = rulesQuery.Where(rule => rule.CustomerId == customerIdBytes);
        }

        if (!string.IsNullOrWhiteSpace(query.DishId))
        {
            var dishIdBytes = GuidHelper.ParseGuidString(query.DishId);
            if (dishIdBytes is null)
            {
                return [];
            }

            rulesQuery = rulesQuery.Where(rule => rule.DishId == dishIdBytes);
        }

        if (!string.IsNullOrWhiteSpace(query.Status))
        {
            var status = PortionRulePolicy.NormalizePortionRuleStatus(query.Status);
            if (status is null)
            {
                return [];
            }

            rulesQuery = rulesQuery.Where(rule => rule.Status == status);
        }

        if (!string.IsNullOrWhiteSpace(query.EffectiveDate))
        {
            var effectiveDate = PortionRulePolicy.ParseDateOnly(query.EffectiveDate, "Ngày hiệu lực")!.Value;
            rulesQuery = rulesQuery.Where(rule =>
                rule.EffectiveFrom <= effectiveDate &&
                (rule.EffectiveTo == null || rule.EffectiveTo >= effectiveDate));
        }

        var rules = await rulesQuery
            .OrderBy(rule => rule.Customer.CustomerCode)
            .ThenBy(rule => rule.EffectiveFrom)
            .ThenByDescending(rule => rule.Priority)
            .ToListAsync();

        var shiftName = PortionRulePolicy.NormalizeShiftName(query.ShiftName);
        var menuVariant = PortionRulePolicy.NormalizeNullableCode(query.MenuVariant);
        var slotName = PortionRulePolicy.NormalizeNullableCode(query.SlotName);
        return rules
            .Where(rule => string.IsNullOrWhiteSpace(query.ShiftName) || PortionRulePolicy.MatchesCsv(rule.ShiftNames, shiftName))
            .Where(rule => string.IsNullOrWhiteSpace(query.MenuVariant) || string.Equals(PortionRulePolicy.NormalizeNullableCode(rule.MenuVariant), menuVariant, StringComparison.Ordinal))
            .Where(rule => string.IsNullOrWhiteSpace(query.SlotName) || string.Equals(PortionRulePolicy.NormalizeNullableCode(rule.SlotName), slotName, StringComparison.Ordinal))
            .Select(PortionRulePolicy.MapPortionRule)
            .ToList();
    }

    public async Task<PortionRuleDto> CreatePortionRuleAsync(CreatePortionRuleRequest request, string? userId)
    {
        var customerId = GuidHelper.ParseGuidString(request.CustomerId)
            ?? throw new ArgumentException("Khách hàng không hợp lệ.");
        var customer = await _context.Customers
            .FirstOrDefaultAsync(item => item.CustomerId == customerId)
            ?? throw new ArgumentException("Không tìm thấy khách hàng để tạo portion rule.");

        var dishId = await ResolveOptionalDishIdAsync(request.DishId);
        var changedAt = DateTime.UtcNow;
        var rule = new PortionRule
        {
            PortionRuleId = GuidHelper.NewId(),
            CustomerId = customer.CustomerId,
            DishId = dishId,
            EffectiveFrom = PortionRulePolicy.ParseDateOnly(request.EffectiveFrom, "Ngày bắt đầu hiệu lực")
                ?? throw new ArgumentException("Ngày bắt đầu hiệu lực không được trống."),
            EffectiveTo = PortionRulePolicy.ParseDateOnly(request.EffectiveTo, "Ngày kết thúc hiệu lực"),
            ActiveWeekDays = PortionRulePolicy.NormalizeOptionalWeekDays(request.ActiveWeekDays),
            ShiftNames = PortionRulePolicy.NormalizeOptionalShiftNames(request.ShiftNames),
            MenuVariant = PortionRulePolicy.NormalizeNullableCode(request.MenuVariant),
            MenuSectionName = PortionRulePolicy.NormalizeNullableText(request.MenuSectionName),
            SlotName = PortionRulePolicy.NormalizeNullableCode(request.SlotName),
            DishCategory = PortionRulePolicy.NormalizeNullableText(request.DishCategory),
            PortionRatePercent = DecimalPolicy.RoundPercent(request.PortionRatePercent),
            BomRatePercent = null,
            YieldLossPercent = request.YieldLossPercent is null ? null : DecimalPolicy.RoundPercent(request.YieldLossPercent.Value),
            Priority = request.Priority ?? 0,
            Status = PortionRulePolicy.NormalizePortionRuleStatus(request.Status) ?? "ACTIVE",
            Reason = PortionRulePolicy.NormalizeNullableText(request.Reason) ?? "Tạo portion rule",
            CreatedAt = changedAt,
            UpdatedAt = changedAt
        };

        await ValidatePortionRuleAsync(rule, null);
        _context.Portionrules.Add(rule);
        AddAudit(ResolveActorId(userId), changedAt, "PortionRule", nameof(PortionRule), rule.PortionRuleId,
            "RuleCreated", null, PortionRulePolicy.BuildPortionRuleAuditValue(rule), rule.Reason);
        await _context.SaveChangesAsync();

        await _context.Entry(rule).Reference(item => item.Customer).LoadAsync();
        if (rule.DishId is not null)
        {
            await _context.Entry(rule).Reference(item => item.Dish).LoadAsync();
        }

        return PortionRulePolicy.MapPortionRule(rule);
    }

    public async Task<PortionRuleDto?> UpdatePortionRuleAsync(
        string portionRuleId,
        UpdatePortionRuleRequest request,
        string? userId)
    {
        var portionRuleIdBytes = GuidHelper.ParseGuidString(portionRuleId);
        if (portionRuleIdBytes is null)
        {
            return null;
        }

        var rule = await _context.Portionrules
            .Include(item => item.Customer)
            .Include(item => item.Dish)
            .FirstOrDefaultAsync(item => item.PortionRuleId == portionRuleIdBytes);
        if (rule is null)
        {
            return null;
        }

        var oldValue = PortionRulePolicy.BuildPortionRuleAuditValue(rule);
        if (request.DishId is not null)
        {
            rule.DishId = await ResolveOptionalDishIdAsync(request.DishId);
        }

        if (request.EffectiveFrom is not null)
        {
            rule.EffectiveFrom = PortionRulePolicy.ParseDateOnly(request.EffectiveFrom, "Ngày bắt đầu hiệu lực")
                ?? throw new ArgumentException("Ngày bắt đầu hiệu lực không được trống.");
        }

        if (request.EffectiveTo is not null)
        {
            rule.EffectiveTo = PortionRulePolicy.ParseDateOnly(request.EffectiveTo, "Ngày kết thúc hiệu lực");
        }

        if (request.ActiveWeekDays is not null)
        {
            rule.ActiveWeekDays = PortionRulePolicy.NormalizeOptionalWeekDays(request.ActiveWeekDays);
        }

        if (request.ShiftNames is not null)
        {
            rule.ShiftNames = PortionRulePolicy.NormalizeOptionalShiftNames(request.ShiftNames);
        }

        if (request.MenuVariant is not null)
        {
            rule.MenuVariant = PortionRulePolicy.NormalizeNullableCode(request.MenuVariant);
        }

        if (request.MenuSectionName is not null)
        {
            rule.MenuSectionName = PortionRulePolicy.NormalizeNullableText(request.MenuSectionName);
        }

        if (request.SlotName is not null)
        {
            rule.SlotName = PortionRulePolicy.NormalizeNullableCode(request.SlotName);
        }

        if (request.DishCategory is not null)
        {
            rule.DishCategory = PortionRulePolicy.NormalizeNullableText(request.DishCategory);
        }

        if (request.PortionRatePercent is not null)
        {
            rule.PortionRatePercent = DecimalPolicy.RoundPercent(request.PortionRatePercent.Value);
        }

        rule.BomRatePercent = null;

        if (request.YieldLossPercent is not null)
        {
            rule.YieldLossPercent = DecimalPolicy.RoundPercent(request.YieldLossPercent.Value);
        }

        if (request.Priority is not null)
        {
            rule.Priority = request.Priority.Value;
        }

        if (request.Status is not null)
        {
            rule.Status = PortionRulePolicy.NormalizePortionRuleStatus(request.Status)
                ?? throw new ArgumentException("Trạng thái portion rule không hợp lệ.");
        }

        rule.Reason = PortionRulePolicy.NormalizeNullableText(request.Reason) ?? rule.Reason;
        rule.UpdatedAt = DateTime.UtcNow;

        await ValidatePortionRuleAsync(rule, rule.PortionRuleId);
        AddAudit(ResolveActorId(userId), rule.UpdatedAt, "PortionRule", nameof(PortionRule), rule.PortionRuleId,
            "RuleUpdated", oldValue, PortionRulePolicy.BuildPortionRuleAuditValue(rule), rule.Reason);
        await _context.SaveChangesAsync();

        return PortionRulePolicy.MapPortionRule(rule);
    }

    public async Task<ResolvedPortionRuleDto?> ResolvePortionRuleAsync(ResolvePortionRuleRequest request)
    {
        var customerId = GuidHelper.ParseGuidString(request.CustomerId);
        if (customerId is null)
        {
            return null;
        }

        var serviceDate = PortionRulePolicy.ParseDateOnly(request.ServiceDate, "Ngày phục vụ")
            ?? throw new ArgumentException("Ngày phục vụ không được trống.");
        var dishId = string.IsNullOrWhiteSpace(request.DishId)
            ? null
            : GuidHelper.ParseGuidString(request.DishId);
        if (!string.IsNullOrWhiteSpace(request.DishId) && dishId is null)
        {
            throw new ArgumentException("Món ăn không hợp lệ.");
        }

        var shiftName = PortionRulePolicy.NormalizeShiftName(request.ShiftName);
        var dayCode = PortionRulePolicy.ToDayCode(serviceDate);
        var rules = await _context.Portionrules
            .AsNoTracking()
            .Where(rule =>
                rule.CustomerId == customerId &&
                rule.Status == "ACTIVE" &&
                rule.EffectiveFrom <= serviceDate &&
                (rule.EffectiveTo == null || rule.EffectiveTo >= serviceDate))
            .ToListAsync();

        var candidates = rules
            .Where(rule => PortionRulePolicy.MatchesCsv(rule.ActiveWeekDays, dayCode))
            .Where(rule => PortionRulePolicy.MatchesCsv(rule.ShiftNames, shiftName))
            .Where(rule => rule.DishId is null || (dishId is not null && rule.DishId.SequenceEqual(dishId)))
            .Where(rule => PortionRulePolicy.MatchesNullableScope(rule.MenuVariant, request.MenuVariant, PortionRulePolicy.NormalizeNullableCode))
            .Where(rule => PortionRulePolicy.MatchesNullableScope(rule.MenuSectionName, request.MenuSectionName, PortionRulePolicy.NormalizeNullableText))
            .Where(rule => PortionRulePolicy.MatchesNullableScope(rule.SlotName, request.SlotName, PortionRulePolicy.NormalizeNullableCode))
            .Where(rule => PortionRulePolicy.MatchesNullableScope(rule.DishCategory, request.DishCategory, PortionRulePolicy.NormalizeNullableText))
            .OrderByDescending(PortionRulePolicy.PortionRuleMatchScore)
            .ThenByDescending(rule => rule.EffectiveFrom)
            .ToList();

        var resolvedRule = candidates.FirstOrDefault();
        if (resolvedRule is not null)
        {
            return new ResolvedPortionRuleDto
            {
                PortionRuleId = GuidHelper.ToGuidString(resolvedRule.PortionRuleId),
                Source = PortionRulePolicy.ResolvePortionRuleSource(resolvedRule),
                PortionRatePercent = resolvedRule.PortionRatePercent,
                BomRatePercent = FixedBomRatePercent,
                YieldLossPercent = resolvedRule.YieldLossPercent
            };
        }

        var contract = await _context.Customercontracts
            .AsNoTracking()
            .Where(contract =>
                contract.CustomerId == customerId &&
                contract.Status == "ACTIVE" &&
                contract.EffectiveFrom <= serviceDate &&
                (contract.EffectiveTo == null || contract.EffectiveTo >= serviceDate))
            .OrderByDescending(contract => contract.EffectiveFrom)
            .ToListAsync();
        var matchedContract = contract.FirstOrDefault(item =>
            PortionRulePolicy.MatchesCsv(item.ActiveWeekDays, dayCode) &&
            PortionRulePolicy.MatchesCsv(item.ShiftNames, shiftName));
        if (matchedContract is not null)
        {
            return new ResolvedPortionRuleDto
            {
                Source = "CONTRACT_DEFAULT",
                PortionRatePercent = 100,
                BomRatePercent = FixedBomRatePercent
            };
        }

        return new ResolvedPortionRuleDto
        {
            Source = "DEMO_FALLBACK",
            PortionRatePercent = 100,
            BomRatePercent = 100,
            Warnings = ["Không tìm thấy portion rule/contract hiệu lực; đang dùng fallback demo."]
        };
    }

    private async Task<byte[]?> ResolveOptionalDishIdAsync(string? dishId)
    {
        if (string.IsNullOrWhiteSpace(dishId))
        {
            return null;
        }

        var dishIdBytes = GuidHelper.ParseGuidString(dishId)
            ?? throw new ArgumentException("Món ăn không hợp lệ.");
        var exists = await _context.Dishes
            .AsNoTracking()
            .AnyAsync(item => item.DishId == dishIdBytes);
        if (!exists)
        {
            throw new ArgumentException("Không tìm thấy món ăn để tạo portion rule.");
        }

        return dishIdBytes;
    }

    private async Task ValidatePortionRuleAsync(PortionRule rule, byte[]? excludeRuleId)
    {
        if (rule.EffectiveTo is not null && rule.EffectiveTo.Value < rule.EffectiveFrom)
        {
            throw new ArgumentException("Ngày kết thúc hiệu lực không được trước ngày bắt đầu.");
        }

        if (rule.PortionRatePercent <= 0 || rule.PortionRatePercent > 300)
        {
            throw new ArgumentException("Tỷ lệ portion phải trong khoảng 0-300%.");
        }

        if (rule.YieldLossPercent is not null && (rule.YieldLossPercent < 0 || rule.YieldLossPercent >= 100))
        {
            throw new ArgumentException("Tỷ lệ hao hụt phải trong khoảng 0-99.99%.");
        }

        if (!string.Equals(rule.Status, "ACTIVE", StringComparison.OrdinalIgnoreCase))
        {
            return;
        }

        var existingRules = await _context.Portionrules
            .AsNoTracking()
            .Where(item => item.CustomerId == rule.CustomerId && item.Status == "ACTIVE")
            .ToListAsync();
        var hasOverlap = existingRules.Any(existing =>
            (excludeRuleId is null || !existing.PortionRuleId.SequenceEqual(excludeRuleId)) &&
            CustomerContractPolicy.DatesOverlap(existing.EffectiveFrom, existing.EffectiveTo, rule.EffectiveFrom, rule.EffectiveTo) &&
            PortionRulePolicy.SamePortionRuleScope(existing, rule) &&
            PortionRulePolicy.CsvScopesOverlap(existing.ActiveWeekDays, rule.ActiveWeekDays) &&
            PortionRulePolicy.CsvScopesOverlap(existing.ShiftNames, rule.ShiftNames));
        if (hasOverlap)
        {
            throw new ArgumentException("Portion rule bị trùng hiệu lực trong cùng phạm vi khách hàng/ca/món.");
        }
    }

    private static byte[] ResolveActorId(string? userId)
        => GuidHelper.ParseGuidString(userId) ?? GuidHelper.NewId();

    private void AddAudit(
        byte[] actorId,
        DateTime changedAt,
        string businessArea,
        string entityName,
        byte[] entityId,
        string fieldName,
        string? oldValue,
        string? newValue,
        string reason)
    {
        _context.Auditlogs.Add(new AuditLog
        {
            AuditId = GuidHelper.NewId(),
            ChangedAt = changedAt,
            ChangedBy = actorId,
            BusinessArea = businessArea,
            EntityName = entityName,
            EntityId = entityId,
            FieldName = fieldName,
            OldValue = oldValue,
            NewValue = newValue,
            Reason = reason
        });
    }

}
