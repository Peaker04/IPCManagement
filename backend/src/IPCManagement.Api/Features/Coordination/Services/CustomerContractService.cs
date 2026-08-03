using IPCManagement.Api.Data;
using IPCManagement.Api.Features.Coordination.Contracts;
using IPCManagement.Api.Helpers;
using IPCManagement.Api.Models.Entities;
using Microsoft.EntityFrameworkCore;

namespace IPCManagement.Api.Features.Coordination.Services;

public sealed class CustomerContractService : ICustomerContractService
{
    private const decimal FixedBomRatePercent = 100m;
    private readonly IpcManagementContext _context;

    public CustomerContractService(IpcManagementContext context)
    {
        _context = context;
    }

    public async Task<IReadOnlyList<CustomerContractDto>> GetCustomerContractsAsync()
    {
        var customers = await _context.Customers
            .Include(customer => customer.Customercontracts)
            .Include(customer => customer.Menuschedules)
            .AsNoTracking()
            .OrderBy(customer => customer.CustomerCode)
            .ToListAsync();

        return customers.Select(MapCustomerContract).ToList();
    }

    public async Task<CustomerContractDto> CreateCustomerContractAsync(
        CreateCustomerContractRequest request,
        string? userId)
    {
        var customerCode = CustomerContractPolicy.NormalizeCustomerCode(request.CustomerCode);
        if (string.IsNullOrWhiteSpace(customerCode))
        {
            throw new ArgumentException("Mã khách hàng không được trống.");
        }

        var customerName = request.CustomerName.Trim();
        if (string.IsNullOrWhiteSpace(customerName))
        {
            throw new ArgumentException("Tên khách hàng không được trống.");
        }

        var exists = await _context.Customers
            .AsNoTracking()
            .AnyAsync(item => item.CustomerCode == customerCode);
        if (exists)
        {
            throw new ArgumentException("Mã khách hàng đã tồn tại.");
        }

        var actorId = ResolveActorId(userId);
        var changedAt = DateTime.UtcNow;
        var customer = new Customer
        {
            CustomerId = GuidHelper.NewId(),
            CustomerCode = customerCode,
            CustomerName = customerName,
            Note = string.IsNullOrWhiteSpace(request.Note) ? null : request.Note.Trim(),
            IsActive = request.IsActive ?? true
        };

        _context.Customers.Add(customer);
        AddAudit(actorId, changedAt, "CustomerContract", nameof(Customer), customer.CustomerId,
            "CustomerCreated", null, customer.CustomerCode, "Tạo khách hàng từ màn contract");

        var contractRequest = new UpdateCustomerContractRequest
        {
            EffectiveFrom = request.EffectiveFrom,
            EffectiveTo = request.EffectiveTo,
            ActiveWeekDays = request.ActiveWeekDays,
            ShiftNames = request.ShiftNames,
            DefaultMenuPrice = request.DefaultMenuPrice,
            DefaultBomRatePercent = request.DefaultBomRatePercent
        };
        var contract = ResolveMutableContract(customer, [], contractRequest, actorId, changedAt);
        ValidateNoOverlappingContract(customer.Customercontracts, contract);

        await _context.SaveChangesAsync();
        return MapCustomerContract(customer);
    }

    public async Task<CustomerContractDto?> UpdateCustomerContractAsync(
        string customerId,
        UpdateCustomerContractRequest request,
        string? userId,
        string? correlationId = null)
    {
        var customerIdBytes = GuidHelper.ParseGuidString(customerId);
        if (customerIdBytes is null)
        {
            return null;
        }

        var customer = await _context.Customers
            .Include(item => item.Customercontracts)
            .Include(item => item.Menuschedules)
            .FirstOrDefaultAsync(item => item.CustomerId == customerIdBytes);
        if (customer is null)
        {
            return null;
        }

        var actorId = ResolveActorId(userId);
        var changedAt = DateTime.UtcNow;
        var auditCorrelationId = ResolveCorrelationId(correlationId);

        if (!string.IsNullOrWhiteSpace(request.CustomerName) &&
            !string.Equals(customer.CustomerName, request.CustomerName.Trim(), StringComparison.Ordinal))
        {
            AddAudit(actorId, changedAt, "CustomerContract", nameof(Customer), customer.CustomerId,
                nameof(Customer.CustomerName), customer.CustomerName, request.CustomerName.Trim(),
                "Cập nhật tên khách hàng/contract", auditCorrelationId);
            customer.CustomerName = request.CustomerName.Trim();
        }

        if (request.Note is not null &&
            !string.Equals(customer.Note ?? string.Empty, request.Note.Trim(), StringComparison.Ordinal))
        {
            AddAudit(actorId, changedAt, "CustomerContract", nameof(Customer), customer.CustomerId,
                nameof(Customer.Note), customer.Note, request.Note.Trim(),
                "Cập nhật ghi chú/ràng buộc khách hàng", auditCorrelationId);
            customer.Note = string.IsNullOrWhiteSpace(request.Note) ? null : request.Note.Trim();
        }

        if (request.IsActive is not null && customer.IsActive != request.IsActive.Value)
        {
            AddAudit(actorId, changedAt, "CustomerContract", nameof(Customer), customer.CustomerId,
                nameof(Customer.IsActive), customer.IsActive.ToString(), request.IsActive.Value.ToString(),
                "Cập nhật trạng thái khách hàng", auditCorrelationId);
            customer.IsActive = request.IsActive.Value;
        }

        var schedules = customer.Menuschedules
            .OrderBy(schedule => schedule.ServiceDate)
            .ThenBy(schedule => schedule.ShiftName)
            .ToList();
        var contract = ResolveMutableContract(customer, schedules, request, actorId, changedAt, auditCorrelationId);

        if (request.EffectiveFrom is not null || request.EffectiveTo is not null)
        {
            var nextEffectiveFrom = ParseDateOnly(request.EffectiveFrom, "Ngày bắt đầu hiệu lực") ?? contract.EffectiveFrom;
            var nextEffectiveTo = ParseDateOnly(request.EffectiveTo, "Ngày kết thúc hiệu lực");
            if (nextEffectiveTo is not null && nextEffectiveTo.Value < nextEffectiveFrom)
            {
                throw new ArgumentException("Ngày kết thúc hiệu lực không được trước ngày bắt đầu.");
            }

            UpdateContractField(actorId, changedAt, contract, nameof(CustomerContract.EffectiveFrom),
                contract.EffectiveFrom.ToString("yyyy-MM-dd"), nextEffectiveFrom.ToString("yyyy-MM-dd"),
                () => contract.EffectiveFrom = nextEffectiveFrom, auditCorrelationId);
            UpdateContractField(actorId, changedAt, contract, nameof(CustomerContract.EffectiveTo),
                contract.EffectiveTo?.ToString("yyyy-MM-dd"), nextEffectiveTo?.ToString("yyyy-MM-dd"),
                () => contract.EffectiveTo = nextEffectiveTo, auditCorrelationId);
        }

        if (request.ActiveWeekDays is not null)
        {
            var nextWeekDays = NormalizeWeekDays(request.ActiveWeekDays, schedules);
            UpdateContractField(actorId, changedAt, contract, nameof(CustomerContract.ActiveWeekDays),
                contract.ActiveWeekDays, string.Join(",", nextWeekDays),
                () => contract.ActiveWeekDays = string.Join(",", nextWeekDays), auditCorrelationId);
        }

        if (request.ShiftNames is not null)
        {
            var nextShifts = NormalizeShiftNames(request.ShiftNames, schedules);
            UpdateContractField(actorId, changedAt, contract, nameof(CustomerContract.ShiftNames),
                contract.ShiftNames, string.Join(",", nextShifts),
                () => contract.ShiftNames = string.Join(",", nextShifts), auditCorrelationId);
        }

        if (request.DefaultMenuPrice is not null)
        {
            var nextPrice = DecimalPolicy.RoundMoney(request.DefaultMenuPrice.Value);
            if (nextPrice < 0)
            {
                throw new ArgumentException("Đơn giá menu mặc định không được âm.");
            }

            UpdateContractField(actorId, changedAt, contract, nameof(CustomerContract.DefaultMenuPrice),
                contract.DefaultMenuPrice.ToString(), nextPrice.ToString(),
                () => contract.DefaultMenuPrice = nextPrice, auditCorrelationId);
        }

        UpdateContractField(actorId, changedAt, contract, nameof(CustomerContract.DefaultBomRatePercent),
            contract.DefaultBomRatePercent.ToString(), FixedBomRatePercent.ToString(),
            () => contract.DefaultBomRatePercent = FixedBomRatePercent, auditCorrelationId);

        contract.UpdatedAt = changedAt;
        ValidateNoOverlappingContract(customer.Customercontracts, contract);
        ApplyContractToUnlockedSchedules(contract, schedules, actorId, changedAt, auditCorrelationId);

        await _context.SaveChangesAsync();
        return MapCustomerContract(customer);
    }

    private CustomerContract ResolveMutableContract(
        Customer customer,
        IReadOnlyList<MenuSchedule> schedules,
        UpdateCustomerContractRequest request,
        byte[] actorId,
        DateTime changedAt,
        string? correlationId = null)
    {
        var existing = ResolveActiveContract(customer.Customercontracts);
        if (existing is not null)
        {
            return existing;
        }

        var activeWeekDays = NormalizeWeekDays(request.ActiveWeekDays, schedules);
        var shiftNames = NormalizeShiftNames(request.ShiftNames, schedules);
        var effectiveFrom = ParseDateOnly(request.EffectiveFrom, "Ngày bắt đầu hiệu lực")
            ?? schedules.FirstOrDefault()?.WeekStartDate
            ?? ServiceCalendar.Today();
        var effectiveTo = ParseDateOnly(request.EffectiveTo, "Ngày kết thúc hiệu lực");
        if (effectiveTo is not null && effectiveTo.Value < effectiveFrom)
        {
            throw new ArgumentException("Ngày kết thúc hiệu lực không được trước ngày bắt đầu.");
        }

        var defaultMenuPrice = request.DefaultMenuPrice is null
            ? ResolveDefaultMenuPrice(schedules)
            : DecimalPolicy.RoundMoney(request.DefaultMenuPrice.Value);
        var defaultBomRate = FixedBomRatePercent;
        if (defaultMenuPrice < 0)
        {
            throw new ArgumentException("Đơn giá menu mặc định không được âm.");
        }
        var contract = new CustomerContract
        {
            ContractId = GuidHelper.NewId(),
            CustomerId = customer.CustomerId,
            EffectiveFrom = effectiveFrom,
            EffectiveTo = effectiveTo,
            ActiveWeekDays = string.Join(",", activeWeekDays),
            ShiftNames = string.Join(",", shiftNames),
            DefaultMenuPrice = defaultMenuPrice,
            DefaultBomRatePercent = defaultBomRate,
            Status = "ACTIVE",
            CreatedAt = changedAt,
            UpdatedAt = changedAt
        };

        customer.Customercontracts.Add(contract);
        AddAudit(actorId, changedAt, "CustomerContract", nameof(CustomerContract), contract.ContractId,
            "ContractCreated", null, GuidHelper.ToGuidString(customer.CustomerId), "Tạo contract hiệu lực cho khách hàng", correlationId);
        return contract;
    }

    private static CustomerContract? ResolveActiveContract(IEnumerable<CustomerContract> contracts)
    {
        var today = ServiceCalendar.Today();
        return contracts
            .Where(contract => string.Equals(contract.Status, "ACTIVE", StringComparison.OrdinalIgnoreCase))
            .OrderByDescending(contract =>
                contract.EffectiveFrom <= today &&
                (contract.EffectiveTo is null || contract.EffectiveTo >= today))
            .ThenByDescending(contract => contract.EffectiveFrom)
            .FirstOrDefault();
    }

    private void UpdateContractField(
        byte[] actorId,
        DateTime changedAt,
        CustomerContract contract,
        string fieldName,
        string? oldValue,
        string? newValue,
        Action apply,
        string? correlationId = null)
    {
        if (string.Equals(oldValue ?? string.Empty, newValue ?? string.Empty, StringComparison.Ordinal))
        {
            return;
        }

        AddAudit(actorId, changedAt, "CustomerContract", nameof(CustomerContract), contract.ContractId,
            fieldName, oldValue, newValue, "Cập nhật contract hiệu lực của khách hàng", correlationId);
        apply();
    }

    private void ApplyContractToUnlockedSchedules(
        CustomerContract contract,
        IReadOnlyList<MenuSchedule> schedules,
        byte[] actorId,
        DateTime changedAt,
        string? correlationId)
    {
        var activeDays = SplitCsv(contract.ActiveWeekDays).ToHashSet(StringComparer.OrdinalIgnoreCase);
        var shifts = SplitCsv(contract.ShiftNames).ToHashSet(StringComparer.OrdinalIgnoreCase);
        foreach (var schedule in schedules.Where(schedule => !IsLockedSchedule(schedule) && MatchesContract(schedule, contract, activeDays, shifts)))
        {
            if (schedule.MenuPrice != contract.DefaultMenuPrice)
            {
                AddAudit(actorId, changedAt, "CustomerContract", nameof(MenuSchedule), schedule.MenuScheduleId,
                    nameof(MenuSchedule.MenuPrice), schedule.MenuPrice.ToString(), contract.DefaultMenuPrice.ToString(),
                    "Áp dụng đơn giá mặc định từ contract khách hàng", correlationId);
                schedule.MenuPrice = contract.DefaultMenuPrice;
            }

            if (schedule.BomRatePercent != contract.DefaultBomRatePercent)
            {
                AddAudit(actorId, changedAt, "CustomerContract", nameof(MenuSchedule), schedule.MenuScheduleId,
                    nameof(MenuSchedule.BomRatePercent), schedule.BomRatePercent.ToString(), contract.DefaultBomRatePercent.ToString(),
                    "Áp dụng BOM cố định 100% theo tier đơn giá mới", correlationId);
                schedule.BomRatePercent = FixedBomRatePercent;
            }
        }
    }

    private static void ValidateNoOverlappingContract(
        IEnumerable<CustomerContract> contracts,
        CustomerContract target)
    {
        var targetDays = SplitCsv(target.ActiveWeekDays).ToHashSet(StringComparer.OrdinalIgnoreCase);
        var targetShifts = SplitCsv(target.ShiftNames).ToHashSet(StringComparer.OrdinalIgnoreCase);
        var hasOverlap = contracts.Any(contract =>
            contract.ContractId != target.ContractId &&
            string.Equals(contract.Status, "ACTIVE", StringComparison.OrdinalIgnoreCase) &&
            CustomerContractPolicy.DatesOverlap(
                contract.EffectiveFrom,
                contract.EffectiveTo,
                target.EffectiveFrom,
                target.EffectiveTo) &&
            SplitCsv(contract.ActiveWeekDays).Any(day => targetDays.Contains(day)) &&
            SplitCsv(contract.ShiftNames).Any(shift => targetShifts.Contains(shift)));

        if (hasOverlap)
        {
            throw new ArgumentException("Contract khách hàng bị trùng hiệu lực theo ngày làm việc và ca phục vụ.");
        }
    }

    private static bool MatchesContract(
        MenuSchedule schedule,
        CustomerContract contract,
        ISet<string> activeDays,
        ISet<string> shifts)
    {
        if (schedule.ServiceDate < contract.EffectiveFrom ||
            (contract.EffectiveTo is not null && schedule.ServiceDate > contract.EffectiveTo))
        {
            return false;
        }

        return activeDays.Contains(ToDayCode(schedule.ServiceDate)) && shifts.Contains(schedule.ShiftName);
    }

    private static IReadOnlyList<string> NormalizeWeekDays(
        IReadOnlyList<string>? requestedWeekDays,
        IReadOnlyList<MenuSchedule> schedules)
    {
        var values = requestedWeekDays is { Count: > 0 }
            ? requestedWeekDays
            : schedules.Select(schedule => ToDayCode(schedule.ServiceDate)).Distinct().ToList();
        if (values.Count == 0)
        {
            values = ["t2", "t3", "t4", "t5", "t6", "t7"];
        }

        var normalized = values
            .Select(NormalizeDayCode)
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .OrderBy(DaySortOrder)
            .ToList();
        if (normalized.Any(string.IsNullOrWhiteSpace))
        {
            throw new ArgumentException("Ngày làm việc contract không hợp lệ.");
        }

        return normalized;
    }

    private static IReadOnlyList<string> NormalizeShiftNames(
        IReadOnlyList<string>? requestedShiftNames,
        IReadOnlyList<MenuSchedule> schedules)
    {
        var values = requestedShiftNames is { Count: > 0 }
            ? requestedShiftNames
            : schedules.Select(schedule => schedule.ShiftName).Distinct().ToList();
        if (values.Count == 0)
        {
            values = ["MORNING", "AFTERNOON"];
        }

        var normalized = values
            .Select(NormalizeShiftName)
            .ToList();
        if (normalized.Any(string.IsNullOrWhiteSpace))
        {
            throw new ArgumentException("Ca phục vụ contract không hợp lệ.");
        }

        return normalized
            .Select(shift => shift!)
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .OrderBy(shift => shift)
            .ToList();
    }

    private static string NormalizeDayCode(string value)
        => value.Trim().ToLowerInvariant() switch
        {
            "t2" or "mon" or "monday" => "t2",
            "t3" or "tue" or "tuesday" => "t3",
            "t4" or "wed" or "wednesday" => "t4",
            "t5" or "thu" or "thursday" => "t5",
            "t6" or "fri" or "friday" => "t6",
            "t7" or "sat" or "saturday" => "t7",
            "cn" or "sun" or "sunday" => "cn",
            _ => string.Empty
        };

    private static int DaySortOrder(string dayCode)
        => dayCode switch
        {
            "t2" => 1,
            "t3" => 2,
            "t4" => 3,
            "t5" => 4,
            "t6" => 5,
            "t7" => 6,
            "cn" => 7,
            _ => 99
        };

    private static DateOnly? ParseDateOnly(string? value, string fieldName)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return null;
        }

        if (DateOnly.TryParse(value, out var parsed))
        {
            return parsed;
        }

        throw new ArgumentException($"{fieldName} không hợp lệ.");
    }

    private static decimal ResolveDefaultMenuPrice(IReadOnlyList<MenuSchedule> schedules)
        => schedules.Count == 0
            ? 25000
            : DecimalPolicy.RoundMoney(schedules.Average(schedule => schedule.MenuPrice));

    private static decimal ResolveDefaultBomRate(IReadOnlyList<MenuSchedule> schedules)
        => FixedBomRatePercent;

    private static IReadOnlyList<string> SplitCsv(string value)
        => value.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);

    private static CustomerContractDto MapCustomerContract(Customer customer)
    {
        var schedules = customer.Menuschedules
            .OrderBy(schedule => schedule.ServiceDate)
            .ThenBy(schedule => schedule.ShiftName)
            .ToList();
        var contract = ResolveActiveContract(customer.Customercontracts);
        var activeWeekDays = contract is null
            ? schedules
                .Select(schedule => ToDayCode(schedule.ServiceDate))
                .Distinct()
                .ToList()
            : SplitCsv(contract.ActiveWeekDays);
        var shiftNames = contract is null
            ? schedules
                .Select(schedule => schedule.ShiftName)
                .Distinct()
                .OrderBy(shift => shift)
                .ToList()
            : SplitCsv(contract.ShiftNames);

        return new CustomerContractDto
        {
            ContractId = contract is null ? null : GuidHelper.ToGuidString(contract.ContractId),
            CustomerId = GuidHelper.ToGuidString(customer.CustomerId),
            CustomerCode = customer.CustomerCode,
            CustomerName = customer.CustomerName,
            Note = customer.Note,
            IsActive = customer.IsActive ?? true,
            EffectiveFrom = contract?.EffectiveFrom.ToString("yyyy-MM-dd"),
            EffectiveTo = contract?.EffectiveTo?.ToString("yyyy-MM-dd"),
            ContractStatus = contract?.Status ?? "FALLBACK",
            MenuScheduleCount = schedules.Count,
            ActiveWeekDays = activeWeekDays,
            ShiftNames = shiftNames,
            DefaultMenuPrice = contract is null ? (schedules.Count == 0 ? null : ResolveDefaultMenuPrice(schedules)) : contract.DefaultMenuPrice,
            DefaultBomRatePercent = FixedBomRatePercent,
            LatestServiceDate = schedules.LastOrDefault()?.ServiceDate.ToString("yyyy-MM-dd")
        };
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
        string reason,
        string? correlationId = null)
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
            Reason = reason,
            CorrelationId = correlationId
        });
    }

    private static string ResolveCorrelationId(string? correlationId)
    {
        var value = string.IsNullOrWhiteSpace(correlationId)
            ? Guid.NewGuid().ToString("N")
            : correlationId.Trim();
        return value[..Math.Min(value.Length, 128)];
    }

    private static string? NormalizeShiftName(string? shift)
        => (shift ?? string.Empty).Trim().ToUpperInvariant() switch
        {
            "MORNING" or "CA SANG" or "CA SÁNG" => "MORNING",
            "AFTERNOON" or "CA CHIEU" or "CA CHIỀU" => "AFTERNOON",
            _ => null
        };

    private static string ToDayCode(DateOnly serviceDate)
        => serviceDate.DayOfWeek switch
        {
            DayOfWeek.Monday => "t2",
            DayOfWeek.Tuesday => "t3",
            DayOfWeek.Wednesday => "t4",
            DayOfWeek.Thursday => "t5",
            DayOfWeek.Friday => "t6",
            DayOfWeek.Saturday => "t7",
            _ => "cn"
        };

    private static bool IsLockedSchedule(MenuSchedule schedule)
        => string.Equals(schedule.Status, "LOCKED", StringComparison.OrdinalIgnoreCase);
}
