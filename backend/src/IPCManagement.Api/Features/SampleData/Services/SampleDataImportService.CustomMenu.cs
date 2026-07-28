using System.Globalization;
using System.Security.Cryptography;
using System.Text.RegularExpressions;
using IPCManagement.Api.Helpers;
using IPCManagement.Api.Models.Entities;
using Microsoft.EntityFrameworkCore;
using IPCManagement.Api.Features.Coordination.Contracts;
using IPCManagement.Api.Features.SampleData.Contracts;

namespace IPCManagement.Api.Features.SampleData.Services;

public partial class SampleDataImportService
{
    private static readonly string[] MenuDayKeys = ["t2", "t3", "t4", "t5", "t6", "t7", "cn"];
    private static readonly decimal[] WeeklyMenuPriceTiers = [25000m, 30000m, 34000m];

    public async Task<IReadOnlyList<CoordinationCustomerOptionDto>> GetActiveCustomersAsync(
        CancellationToken cancellationToken = default)
        => await _context.Customers
            .Where(customer => customer.IsActive != false)
            .OrderBy(customer => customer.CustomerCode)
            .Select(customer => new CoordinationCustomerOptionDto
            {
                CustomerId = GuidHelper.ToGuidString(customer.CustomerId),
                CustomerCode = customer.CustomerCode,
                CustomerName = customer.CustomerName
            })
            .ToListAsync(cancellationToken);

    public async Task<WeeklyMenuImportResultDto?> GetCommittedWeeklyMenuAsync(
        string customerId,
        DateOnly? weekStartDate,
        CancellationToken cancellationToken = default)
    {
        var customer = await ResolveImportCustomerAsync(customerId, cancellationToken);
        var customerSchedules = _context.Menuschedules
            .AsNoTracking()
            .Where(schedule => schedule.CustomerId.SequenceEqual(customer.CustomerId));

        var resolvedWeekStart = weekStartDate;
        if (resolvedWeekStart is null)
        {
            var latestSchedule = await customerSchedules
                .OrderByDescending(schedule => schedule.WeekStartDate)
                .ThenByDescending(schedule => schedule.ServiceDate)
                .FirstOrDefaultAsync(cancellationToken);
            if (latestSchedule is null)
            {
                return null;
            }

            resolvedWeekStart = latestSchedule.WeekStartDate;
        }

        var schedules = await customerSchedules
            .Where(schedule => schedule.WeekStartDate == resolvedWeekStart.Value)
            .Include(schedule => schedule.Menu)
                .ThenInclude(menu => menu.Menuitems)
                    .ThenInclude(menuItem => menuItem.Dish)
            .OrderBy(schedule => schedule.ServiceDate)
            .ThenBy(schedule => schedule.ShiftName)
            .ToListAsync(cancellationToken);

        if (schedules.Count == 0)
        {
            return null;
        }

        var parsedItems = new List<ParsedWeeklyMenuItem>();
        var rows = new List<WeeklyMenuImportRowDto>();
        foreach (var schedule in schedules)
        {
            var dayKey = DayKey(schedule.ServiceDate.DayOfWeek);
            foreach (var menuItem in schedule.Menu.Menuitems.OrderBy(item => item.DisplayOrder))
            {
                var slotInfo = ParsePersistedDishSlot(menuItem.DishSlot);
                var sourceShiftLabel = ToVietnameseShift(schedule.ShiftName);
                var item = new ParsedWeeklyMenuItem
                {
                    SourceOrder = menuItem.DisplayOrder,
                    ServiceDate = schedule.ServiceDate,
                    DayKey = dayKey,
                    SectionLabel = $"MENU {slotInfo.VariantLabel.ToUpperInvariant()} {sourceShiftLabel.ToUpperInvariant()}",
                    SectionKey = $"{slotInfo.VariantKey}-{schedule.ShiftName.ToLowerInvariant()}",
                    SourceShift = schedule.ShiftName,
                    SourceShiftLabel = sourceShiftLabel,
                    DbShiftName = schedule.ShiftName,
                    VariantKey = slotInfo.VariantKey,
                    VariantLabel = slotInfo.VariantLabel,
                    Slot = slotInfo.Slot,
                    SlotLabel = slotInfo.SlotLabel,
                    DishName = menuItem.Dish.DishName,
                    DishId = GuidHelper.ToGuidString(menuItem.DishId),
                    ExistingDish = true
                };
                parsedItems.Add(item);

                rows.Add(new WeeklyMenuImportRowDto
                {
                    ServiceDate = item.ServiceDate,
                    DayKey = item.DayKey,
                    SourceRowNumber = item.SourceRowNumber,
                    SourceColumn = item.SourceColumn,
                    SourceSection = item.SectionLabel,
                    SourceShift = item.SourceShift,
                    DbShiftName = item.DbShiftName,
                    Variant = item.VariantLabel,
                    Slot = item.Slot,
                    SlotLabel = item.SlotLabel,
                    DishName = item.DishName,
                    RowSpan = item.RowSpan,
                    IsMergedContinuation = item.IsMergedContinuation,
                    DishId = item.DishId,
                    ExistingDish = true
                });
            }
        }

        var result = new WeeklyMenuImportResultDto
        {
            Committed = true,
            FileName = "Persisted weekly menu",
            CustomerId = GuidHelper.ToGuidString(customer.CustomerId),
            CustomerCode = customer.CustomerCode,
            CustomerName = customer.CustomerName,
            WeekStartDate = resolvedWeekStart,
            WeekEndDate = schedules.Max(schedule => schedule.ServiceDate),
            DetectedLayout = new WeeklyMenuImportLayoutDto
            {
                SheetName = "Backend",
                LabelColumn = "DB",
                DayColumns = schedules
                    .GroupBy(schedule => schedule.ServiceDate)
                    .OrderBy(group => group.Key)
                    .Select(group => new WeeklyMenuImportColumnDto
                    {
                        Column = DayKey(group.Key.DayOfWeek),
                        ServiceDate = group.Key,
                        Label = group.Key.ToString("dd/MM/yyyy", CultureInfo.InvariantCulture)
                    })
                    .ToList(),
                Sections = parsedItems
                    .Select(item => item.SectionLabel)
                    .Distinct(StringComparer.OrdinalIgnoreCase)
                    .ToList(),
                RowsScanned = parsedItems.Count,
                RowsImported = parsedItems.Count
            },
            Rows = rows
        };

        var version = await GetLatestMenuVersionAsync(customer.CustomerId, resolvedWeekStart.Value, cancellationToken);
        ApplyMenuVersion(result, version);
        BuildImportedWeeklyMenu(result, parsedItems);
        return result;
    }

    public async Task<(byte[] Content, string CustomerCode)> BuildWeeklyMenuTemplateAsync(
        string? customerId,
        DateOnly? weekStartDate,
        CancellationToken cancellationToken = default)
    {
        cancellationToken.ThrowIfCancellationRequested();
        var resolvedWeekStart = weekStartDate ?? ResolveCurrentWeekStart();
        var customerCode = "IPC";
        // Id khách sai định dạng không được rơi về khách mặc định "IPC" — người dùng sẽ tải
        // đúng file template của một khách khác mà không có tín hiệu nào.
        var customerBytes = GuidHelper.ParseFilterIdOrThrow(customerId, "khách hàng");
        if (customerBytes is not null)
        {
            customerCode = await _context.Customers
                .AsNoTracking()
                .Where(customer => customer.CustomerId.SequenceEqual(customerBytes) && customer.IsActive != false)
                .Select(customer => customer.CustomerCode)
                .FirstOrDefaultAsync(cancellationToken) ?? customerCode;
        }

        var content = string.Equals(customerCode, "ANV", StringComparison.OrdinalIgnoreCase)
            ? ReadEmbeddedAnvWeeklyMenuTemplate()
            : WeeklyMenuTemplateWorkbookBuilder.Build(resolvedWeekStart, customerCode);

        return (content, customerCode);
    }

    private static byte[] ReadEmbeddedAnvWeeklyMenuTemplate()
    {
        const string resourceName =
            "IPCManagement.Api.Resources.Templates.weekly-menu-template-ANV-default.xlsx";
        using var resourceStream = typeof(SampleDataImportService).Assembly
            .GetManifestResourceStream(resourceName)
            ?? throw new InvalidOperationException("Không tìm thấy template thực đơn ANV mặc định trong ứng dụng.");
        using var output = new MemoryStream();
        resourceStream.CopyTo(output);
        return output.ToArray();
    }

    public async Task<WeeklyMenuImportResultDto> PreviewWeeklyMenuImportAsync(
        Stream fileStream,
        string fileName,
        string customerId,
        DateOnly? weekStartDate,
        decimal? priceTierAmount,
        CancellationToken cancellationToken = default)
    {
        var customer = await TryResolveImportCustomerAsync(customerId, cancellationToken);
        if (customer is null)
        {
            return WeeklyMenuImportValidationPolicy.BuildInvalidResult(
                fileName,
                customerId,
                "UNKNOWN_CUSTOMER",
                "Không tìm thấy khách hàng đang hoạt động để import thực đơn.",
                "customerId");
        }

        var normalizedPriceTier = NormalizeWeeklyMenuPriceTier(priceTierAmount);
        var mapping = await FindCustomerImportMappingAsync(customer.CustomerId, cancellationToken);
        var tempFilePath = await SaveTempWorkbookAsync(fileStream, cancellationToken);
        try
        {
            var plan = WeeklyMenuWorkbookParser.Parse(
                _reader,
                tempFilePath,
                fileName,
                weekStartDate,
                mapping,
                normalizedPriceTier);
            return await BuildWeeklyMenuImportResultAsync(
                plan,
                customer,
                committed: false,
                cancellationToken);
        }
        catch (Exception ex) when (WeeklyMenuImportValidationPolicy.IsUnreadableWorkbookException(ex))
        {
            return WeeklyMenuImportValidationPolicy.BuildInvalidResult(
                fileName,
                GuidHelper.ToGuidString(customer.CustomerId),
                "FILE_READ_ERROR",
                WeeklyMenuImportValidationPolicy.UnreadableWorkbookMessage,
                "file");
        }
        catch (InvalidOperationException ex)
        {
            return WeeklyMenuImportValidationPolicy.BuildInvalidResult(
                fileName,
                GuidHelper.ToGuidString(customer.CustomerId),
                WeeklyMenuImportValidationPolicy.ResolveCode(ex.Message),
                ex.Message,
                WeeklyMenuImportValidationPolicy.ResolveField(ex.Message));
        }
        finally
        {
            DeleteTempWorkbook(tempFilePath);
        }
    }

    public async Task<WeeklyMenuImportResultDto> CommitWeeklyMenuImportAsync(
        Stream fileStream,
        string fileName,
        string customerId,
        DateOnly? weekStartDate,
        decimal? priceTierAmount,
        string? actorUserId = null,
        CancellationToken cancellationToken = default)
    {
        var customer = await ResolveImportCustomerAsync(customerId, cancellationToken);
        var normalizedPriceTier = NormalizeWeeklyMenuPriceTier(priceTierAmount);
        var mapping = await FindCustomerImportMappingAsync(customer.CustomerId, cancellationToken);
        var tempFilePath = await SaveTempWorkbookAsync(fileStream, cancellationToken);
        try
        {
            var plan = WeeklyMenuWorkbookParser.Parse(
                _reader,
                tempFilePath,
                fileName,
                weekStartDate,
                mapping,
                normalizedPriceTier);
            plan.SourceChecksum = ComputeFileChecksum(tempFilePath);
            var validationResult = await BuildWeeklyMenuImportResultAsync(
                plan,
                customer,
                committed: false,
                cancellationToken);
            if (validationResult.Validation.HasCriticalErrors)
            {
                var firstIssue = validationResult.Validation.Issues.FirstOrDefault(item =>
                    string.Equals(item.Severity, "error", StringComparison.OrdinalIgnoreCase));
                throw new InvalidOperationException(firstIssue?.Message ?? "File import còn lỗi critical, không thể commit DB.");
            }

            await using var transaction = await _context.Database.BeginTransactionAsync(cancellationToken);
            var result = await CommitWeeklyMenuImportPlanAsync(plan, customer, normalizedPriceTier, actorUserId, cancellationToken);
            await _context.SaveChangesAsync(cancellationToken);
            await transaction.CommitAsync(cancellationToken);
            return result;
        }
        catch (Exception ex) when (WeeklyMenuImportValidationPolicy.IsUnreadableWorkbookException(ex))
        {
            throw new InvalidOperationException(WeeklyMenuImportValidationPolicy.UnreadableWorkbookMessage, ex);
        }
        finally
        {
            DeleteTempWorkbook(tempFilePath);
        }
    }

    private async Task<Customer> ResolveImportCustomerAsync(string customerId, CancellationToken cancellationToken)
    {
        var customerBytes = GuidHelper.ParseGuidString(customerId);
        if (customerBytes is null)
        {
            throw new ArgumentException("Khách hàng import không hợp lệ.");
        }

        var customer = await _context.Customers
            .FirstOrDefaultAsync(item => item.CustomerId.SequenceEqual(customerBytes), cancellationToken);
        if (customer is null || customer.IsActive == false)
        {
            throw new KeyNotFoundException("Không tìm thấy khách hàng đang hoạt động để import thực đơn.");
        }

        return customer;
    }

    private Task<CustomerImportMapping?> FindCustomerImportMappingAsync(
        byte[] customerId,
        CancellationToken cancellationToken)
        => _context.Customerimportmappings
            .AsNoTracking()
            .FirstOrDefaultAsync(item => item.CustomerId.SequenceEqual(customerId), cancellationToken);

    public async Task<CustomerImportMappingDto?> GetCustomerImportMappingAsync(
        string customerId,
        CancellationToken cancellationToken = default)
    {
        var customer = await ResolveImportCustomerAsync(customerId, cancellationToken);
        var mapping = await FindCustomerImportMappingAsync(customer.CustomerId, cancellationToken);
        return mapping is null
            ? null
            : new CustomerImportMappingDto
            {
                CustomerId = customerId,
                SheetNameHint = mapping.SheetNameHint,
                LabelColumn = mapping.LabelColumn
            };
    }

    public async Task<CustomerImportMappingDto> SaveCustomerImportMappingAsync(
        string customerId,
        SaveCustomerImportMappingRequest request,
        CancellationToken cancellationToken = default)
    {
        var customer = await ResolveImportCustomerAsync(customerId, cancellationToken);
        var mapping = await _context.Customerimportmappings
            .FirstOrDefaultAsync(item => item.CustomerId.SequenceEqual(customer.CustomerId), cancellationToken);

        var now = DateTime.UtcNow;
        if (mapping is null)
        {
            mapping = new CustomerImportMapping
            {
                MappingId = GuidHelper.NewId(),
                CustomerId = customer.CustomerId,
                CreatedAt = now
            };
            _context.Customerimportmappings.Add(mapping);
        }

        mapping.SheetNameHint = string.IsNullOrWhiteSpace(request.SheetNameHint) ? null : request.SheetNameHint.Trim();
        mapping.LabelColumn = string.IsNullOrWhiteSpace(request.LabelColumn) ? null : request.LabelColumn.Trim().ToUpperInvariant();
        mapping.UpdatedAt = now;

        await _context.SaveChangesAsync(cancellationToken);

        return new CustomerImportMappingDto
        {
            CustomerId = customerId,
            SheetNameHint = mapping.SheetNameHint,
            LabelColumn = mapping.LabelColumn
        };
    }

    private async Task<Customer?> TryResolveImportCustomerAsync(string customerId, CancellationToken cancellationToken)
    {
        var customerBytes = GuidHelper.ParseGuidString(customerId);
        if (customerBytes is null)
        {
            return null;
        }

        return await _context.Customers
            .FirstOrDefaultAsync(item => item.CustomerId.SequenceEqual(customerBytes) && item.IsActive != false, cancellationToken);
    }

    private async Task<WeeklyMenuImportResultDto> CommitWeeklyMenuImportPlanAsync(
        WeeklyMenuImportPlan plan,
        Customer customer,
        decimal priceTierAmount,
        string? actorUserId,
        CancellationToken cancellationToken)
    {
        var version = await CreateMenuVersionHeaderAsync(plan, customer, actorUserId, cancellationToken);
        var result = await BuildWeeklyMenuImportResultAsync(
            plan,
            customer,
            committed: true,
            cancellationToken);
        ApplyMenuVersion(result, version);

        var existingDishes = await _context.Dishes
            .Include(dish => dish.Dishboms)
            .ToListAsync(cancellationToken);
        var existingMenus = await _context.Menus.ToListAsync(cancellationToken);
        var existingMenuItems = await _context.Menuitems.ToListAsync(cancellationToken);
        var existingSchedules = await _context.Menuschedules.ToListAsync(cancellationToken);

        var groupedItems = plan.Items
            .GroupBy(item => new { item.ServiceDate, item.DbShiftName })
            .OrderBy(group => group.Key.ServiceDate)
            .ThenBy(group => group.Key.DbShiftName)
            .ToList();

        var importKeys = groupedItems
            .Select(group => WeeklyMenuScheduleKey(group.Key.ServiceDate, group.Key.DbShiftName))
            .ToHashSet(StringComparer.OrdinalIgnoreCase);
        var staleSchedules = existingSchedules
            .Where(item =>
                item.CustomerId.SequenceEqual(customer.CustomerId) &&
                item.WeekStartDate == plan.WeekStartDate &&
                !importKeys.Contains(WeeklyMenuScheduleKey(item.ServiceDate, item.ShiftName)))
            .ToList();

        var lockedStaleSchedule = staleSchedules.FirstOrDefault(item =>
            !string.Equals(item.Status, "DRAFT", StringComparison.OrdinalIgnoreCase));
        if (lockedStaleSchedule is not null)
        {
            throw new InvalidOperationException(
                $"Không thể thay thế thực đơn tuần vì lịch {lockedStaleSchedule.ServiceDate:dd/MM/yyyy} {ToVietnameseShift(lockedStaleSchedule.ShiftName)} đã ở trạng thái {lockedStaleSchedule.Status}.");
        }

        var staleScheduleIds = staleSchedules.Select(item => item.MenuScheduleId).ToList();
        if (staleScheduleIds.Count > 0)
        {
            var linkedScheduleIds = await _context.Mealquantityplanlines
                .AsNoTracking()
                .Where(line => line.CustomerId.SequenceEqual(customer.CustomerId))
                .Select(line => line.MenuScheduleId)
                .ToListAsync(cancellationToken);
            var hasQuantityLines = linkedScheduleIds.Any(linkedId =>
                staleScheduleIds.Any(staleId => linkedId.SequenceEqual(staleId)));
            if (hasQuantityLines)
            {
                throw new InvalidOperationException(
                    "Không thể xóa lịch thực đơn cũ vì đã có số suất liên kết. Vui lòng điều chỉnh số suất hoặc import lại file đầy đủ ngày/ca.");
            }

            _context.Menuschedules.RemoveRange(staleSchedules);
            existingSchedules.RemoveAll(item => staleScheduleIds.Any(id => item.MenuScheduleId.SequenceEqual(id)));
            result.Warnings.Add($"Đã bỏ {staleScheduleIds.Count} lịch DRAFT không còn trong file import mới.");
        }

        foreach (var group in groupedItems)
        {
            var lockedSchedule = existingSchedules.FirstOrDefault(item =>
                item.CustomerId.SequenceEqual(customer.CustomerId) &&
                item.ServiceDate == group.Key.ServiceDate &&
                string.Equals(item.ShiftName, group.Key.DbShiftName, StringComparison.OrdinalIgnoreCase) &&
                !string.Equals(item.Status, "DRAFT", StringComparison.OrdinalIgnoreCase));
            if (lockedSchedule is not null)
            {
                throw new InvalidOperationException(
                    $"Không thể ghi đè thực đơn {group.Key.ServiceDate:dd/MM/yyyy} {ToVietnameseShift(group.Key.DbShiftName)} vì lịch đã ở trạng thái {lockedSchedule.Status}.");
            }

            var menu = EnsureMenu(
                group.Key.ServiceDate,
                group.Key.DbShiftName,
                customer,
                plan.WeekStartDate,
                plan.WeekEndDate,
                existingMenus,
                dryRun: false,
                result.Counts);

            var staleItems = existingMenuItems
                .Where(item => item.MenuId.SequenceEqual(menu.MenuId))
                .ToList();
            if (staleItems.Count > 0)
            {
                _context.Menuitems.RemoveRange(staleItems);
                existingMenuItems.RemoveAll(item => item.MenuId.SequenceEqual(menu.MenuId));
            }

            var displayOrder = 0;
            foreach (var parsedItem in group.OrderBy(item => item.SourceOrder))
            {
                var dish = EnsureImportedMenuDish(
                    parsedItem.DishName,
                    parsedItem.SectionKey,
                    parsedItem.SlotLabel,
                    existingDishes,
                    dryRun: false,
                    result.Counts);
                parsedItem.DishId = GuidHelper.ToGuidString(dish.DishId);
                parsedItem.ExistingDish = result.Rows.Any(row =>
                    row.DishName.Equals(parsedItem.DishName, StringComparison.OrdinalIgnoreCase) &&
                    row.ExistingDish);

                EnsureMenuItem(
                    menu,
                    dish,
                    $"{parsedItem.VariantKey}-{parsedItem.Slot}",
                    ++displayOrder,
                    existingMenuItems,
                    dryRun: false,
                    result.Counts);
            }

            var contractPolicy = new CustomerContractPolicy(
                DecimalPolicy.RoundMoney(priceTierAmount),
                DecimalPolicy.RoundPercent(100),
                UsedFallback: false);

            EnsureMenuSchedule(
                customer,
                menu,
                group.Key.ServiceDate,
                plan.WeekStartDate,
                group.Key.DbShiftName,
                existingSchedules,
                dryRun: false,
                result.Counts,
                contractPolicy,
                version.MenuVersionId);
        }

        var invalidatedCount = await InvalidateWorkflowDocumentsForMenuReimportAsync(
            customer,
            plan.WeekStartDate,
            plan.WeekEndDate,
            version,
            actorUserId,
            cancellationToken);
        if (invalidatedCount > 0)
        {
            result.Warnings.Add(
                $"Đã đánh dấu {invalidatedCount} demand/PR cũ là CANCELLED vì thực đơn tuần được import lại. Vui lòng tạo lại demand và danh sách mua thêm.");
        }

        version.SuccessRowCount = plan.Items.Count;
        version.ErrorRowCount = plan.RowsSkipped;
        version.WarningRowCount = result.Warnings.Count;

        ApplyCommittedDishIds(result, plan.Items);
        return result;
    }

    private static decimal NormalizeWeeklyMenuPriceTier(decimal? priceTierAmount)
    {
        if (priceTierAmount is null)
        {
            throw new InvalidOperationException("Vui lòng chọn định mức 25.000, 30.000 hoặc 34.000 trước khi import menu.");
        }

        var normalized = DecimalPolicy.RoundMoney(priceTierAmount.Value);
        if (!Array.Exists(WeeklyMenuPriceTiers, tier => tier == normalized))
        {
            throw new InvalidOperationException("Định mức import menu chỉ được chọn 25.000, 30.000 hoặc 34.000.");
        }

        return normalized;
    }

    private static DateOnly ResolveCurrentWeekStart()
    {
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var offset = ((int)today.DayOfWeek + 6) % 7;
        return today.AddDays(-offset);
    }

    private async Task<int> InvalidateWorkflowDocumentsForMenuReimportAsync(
        Customer customer,
        DateOnly weekStartDate,
        DateOnly weekEndDate,
        MenuVersion version,
        string? actorUserId,
        CancellationToken cancellationToken)
    {
        var actorId = await ResolveAuditActorIdAsync(actorUserId, cancellationToken);
        var changedAt = DateTime.UtcNow;
        var reason = $"Menu re-import {version.SourceImportBatch} invalidated downstream demand/PR; regenerate required.";
        var invalidatedCount = 0;

        var materialRequests = await _context.Materialrequests
            .Include(request => request.Plan)
                .ThenInclude(plan => plan.Productionplanlines)
            .Where(request =>
                request.RequestDate >= weekStartDate &&
                request.RequestDate <= weekEndDate &&
                request.Status != "CANCELLED" &&
                request.Plan.Productionplanlines.Any(line => line.CustomerId.SequenceEqual(customer.CustomerId)))
            .ToListAsync(cancellationToken);

        foreach (var request in materialRequests)
        {
            var oldStatus = request.Status;
            request.Status = "CANCELLED";
            invalidatedCount++;
            _context.Auditlogs.Add(new AuditLog
            {
                AuditId = GuidHelper.NewId(),
                ChangedAt = changedAt,
                ChangedBy = actorId,
                BusinessArea = "Demand",
                EntityName = nameof(MaterialRequest),
                EntityId = request.RequestId,
                FieldName = "Status",
                OldValue = oldStatus,
                NewValue = "CANCELLED",
                Reason = reason
            });
        }

        var purchaseRequests = await _context.Purchaserequests
            .Include(request => request.Purchaserequestlines)
                .ThenInclude(line => line.MaterialRequestLine)
                    .ThenInclude(line => line.PlanLine)
            .Where(request =>
                request.PurchaseForDate >= weekStartDate &&
                request.PurchaseForDate <= weekEndDate &&
                request.Status != "CANCELLED" &&
                request.Purchaserequestlines.Any(line => line.MaterialRequestLine.PlanLine.CustomerId.SequenceEqual(customer.CustomerId)))
            .ToListAsync(cancellationToken);

        foreach (var request in purchaseRequests)
        {
            var oldStatus = request.Status;
            request.Status = "CANCELLED";
            invalidatedCount++;
            _context.Auditlogs.Add(new AuditLog
            {
                AuditId = GuidHelper.NewId(),
                ChangedAt = changedAt,
                ChangedBy = actorId,
                BusinessArea = "Purchase",
                EntityName = nameof(PurchaseRequest),
                EntityId = request.PurchaseRequestId,
                FieldName = "Status",
                OldValue = oldStatus,
                NewValue = "CANCELLED",
                Reason = reason
            });
        }

        return invalidatedCount;
    }

    private async Task<byte[]> ResolveAuditActorIdAsync(string? actorUserId, CancellationToken cancellationToken)
    {
        var requestedActorId = GuidHelper.ParseGuidString(actorUserId);
        if (requestedActorId is not null)
        {
            var exists = await _context.Users
                .AsNoTracking()
                .AnyAsync(user => user.UserId.SequenceEqual(requestedActorId), cancellationToken);
            if (exists)
            {
                return requestedActorId;
            }
        }

        var actor = await _context.Users
            .AsNoTracking()
            .OrderByDescending(user => user.Role != null && EF.Functions.Like(user.Role.RoleName, "%admin%"))
            .ThenBy(user => user.Username)
            .FirstOrDefaultAsync(cancellationToken);

        if (actor is null)
        {
            throw new InvalidOperationException("Không tìm thấy user để ghi audit import thực đơn.");
        }

        return actor.UserId;
    }

    private async Task<WeeklyMenuImportResultDto> BuildWeeklyMenuImportResultAsync(
        WeeklyMenuImportPlan plan,
        Customer customer,
        bool committed,
        CancellationToken cancellationToken)
    {
        var existingDishes = await _context.Dishes
            .Include(dish => dish.Dishboms)
            .ToListAsync(cancellationToken);
        var existingByName = existingDishes
            .GroupBy(dish => NormalizeDishMatchKey(dish.DishName), StringComparer.OrdinalIgnoreCase)
            .ToDictionary(group => group.Key, SelectPreferredImportedDish, StringComparer.OrdinalIgnoreCase);

        var result = new WeeklyMenuImportResultDto
        {
            Committed = committed,
            FileName = plan.FileName,
            CustomerId = GuidHelper.ToGuidString(customer.CustomerId),
            CustomerCode = customer.CustomerCode,
            CustomerName = customer.CustomerName,
            WeekStartDate = plan.WeekStartDate,
            WeekEndDate = plan.WeekEndDate,
            DetectedLayout = new WeeklyMenuImportLayoutDto
            {
                SheetName = plan.SheetName,
                LabelColumn = plan.LabelColumn,
                DayColumns = plan.DayColumns
                    .Select(column => new WeeklyMenuImportColumnDto
                    {
                        Column = column.Column,
                        ServiceDate = column.ServiceDate,
                        Label = column.Label
                    })
                    .ToList(),
                Sections = plan.Sections.ToList(),
                RowsScanned = plan.RowsScanned,
                RowsImported = plan.Items.Count,
                RowsSkipped = plan.RowsSkipped
            },
            Warnings = plan.Warnings.ToList()
        };
        result.PreviewDiff = await BuildWeeklyMenuImportDiffAsync(plan, customer, cancellationToken);

        foreach (var parsedItem in plan.Items)
        {
            var key = NormalizeDishMatchKey(parsedItem.DishName);
            if (existingByName.TryGetValue(key, out var existingDish))
            {
                parsedItem.DishId = GuidHelper.ToGuidString(existingDish.DishId);
                parsedItem.ExistingDish = true;
            }

            result.Rows.Add(new WeeklyMenuImportRowDto
            {
                ServiceDate = parsedItem.ServiceDate,
                DayKey = parsedItem.DayKey,
                SourceRowNumber = parsedItem.SourceRowNumber,
                SourceColumn = parsedItem.SourceColumn,
                SourceSection = parsedItem.SectionLabel,
                SourceShift = parsedItem.SourceShift,
                DbShiftName = parsedItem.DbShiftName,
                Variant = parsedItem.VariantLabel,
                Slot = parsedItem.Slot,
                SlotLabel = parsedItem.SlotLabel,
                DishName = parsedItem.DishName,
                RowSpan = parsedItem.RowSpan,
                IsMergedContinuation = parsedItem.IsMergedContinuation,
                DishId = parsedItem.DishId,
                ExistingDish = parsedItem.ExistingDish
            });
        }

        result.Validation = WeeklyMenuImportValidationPolicy.Build(plan, result.Rows);
        BuildImportedWeeklyMenu(result, plan.Items);
        return result;
    }

    private static void BuildImportedWeeklyMenu(
        WeeklyMenuImportResultDto result,
        IReadOnlyList<ParsedWeeklyMenuItem> parsedItems)
    {
        foreach (var dayKey in MenuDayKeys)
        {
            result.ImportedWeeklyMenu[dayKey] = new ImportedDayMenuDto();
        }

        foreach (var item in parsedItems)
        {
            var dayMenu = result.ImportedWeeklyMenu[item.DayKey];
            var slotDto = GetImportedSlot(dayMenu, item.DbShiftName, item.VariantKey);
            if (slotDto.Portions == 0)
            {
                slotDto.Portions = DefaultImportPortions(item.DbShiftName, item.VariantKey);
            }

            if (item.Slot == "main" && !string.IsNullOrWhiteSpace(item.DishId))
            {
                slotDto.DishId = item.DishId;
            }

            ApplyImportedComponent(slotDto.CustomComponents, item.Slot, item.DishName);
        }
    }

    private static ImportedMenuSlotDto GetImportedSlot(
        ImportedDayMenuDto day,
        string dbShiftName,
        string variantKey)
        => (dbShiftName, variantKey) switch
        {
            ("MORNING", "vegetarian") => day.MorningVegetarian,
            ("AFTERNOON", "vegetarian") => day.AfternoonVegetarian,
            ("AFTERNOON", _) => day.AfternoonSavory,
            _ => day.MorningSavory
        };

    private static void ApplyImportedComponent(ImportedCustomComponentsDto components, string slot, string dishName)
    {
        switch (slot)
        {
            case "main":
                components.Main = dishName;
                break;
            case "sub1":
                components.Sub1 = dishName;
                break;
            case "sub2":
                components.Sub2 = dishName;
                break;
            case "rau":
                components.Rau = dishName;
                break;
            case "canh":
                components.Canh = dishName;
                break;
            case "fruit":
                components.Fruit = dishName;
                break;
            case "dessert":
                components.Dessert = dishName;
                break;
        }
    }

    private static int DefaultImportPortions(string dbShiftName, string variantKey)
        => (dbShiftName, variantKey) switch
        {
            ("MORNING", "vegetarian") => 150,
            ("AFTERNOON", "vegetarian") => 150,
            ("AFTERNOON", _) => 870,
            _ => 840
        };

    private static (string VariantKey, string VariantLabel, string Slot, string SlotLabel) ParsePersistedDishSlot(string? dishSlot)
    {
        var parts = (dishSlot ?? string.Empty).Split('-', 2, StringSplitOptions.TrimEntries);
        var variantKey = parts.Length > 0 && string.Equals(parts[0], "vegetarian", StringComparison.OrdinalIgnoreCase)
            ? "vegetarian"
            : "savory";
        var slot = parts.Length > 1 && !string.IsNullOrWhiteSpace(parts[1])
            ? parts[1]
            : "main";

        var slotLabel = slot switch
        {
            "sub1" => "Phụ 1",
            "sub2" => "Phụ 2",
            "rau" => "Rau",
            "canh" => "Canh",
            "fruit" => "Trái cây",
            "dessert" => "Sữa chua",
            _ => "Món chính"
        };

        return (variantKey, variantKey == "vegetarian" ? "Chay" : "Mặn", slot, slotLabel);
    }

    private static void ApplyCommittedDishIds(
        WeeklyMenuImportResultDto result,
        IReadOnlyList<ParsedWeeklyMenuItem> parsedItems)
    {
        var idsByKey = parsedItems
            .Where(item => !string.IsNullOrWhiteSpace(item.DishId))
            .GroupBy(item => $"{item.ServiceDate:yyyyMMdd}|{item.DbShiftName}|{item.VariantKey}|{item.Slot}|{NormalizeDishMatchKey(item.DishName)}")
            .ToDictionary(group => group.Key, group => group.First().DishId);

        foreach (var row in result.Rows)
        {
            var key = $"{row.ServiceDate:yyyyMMdd}|{row.DbShiftName}|{(row.Variant == "Chay" ? "vegetarian" : "savory")}|{row.Slot}|{NormalizeDishMatchKey(row.DishName)}";
            if (idsByKey.TryGetValue(key, out var dishId))
            {
                row.DishId = dishId;
            }
        }

        result.ImportedWeeklyMenu.Clear();
        BuildImportedWeeklyMenu(result, parsedItems);
    }

    private Dish EnsureImportedMenuDish(
        string dishName,
        string dishGroup,
        string dishType,
        List<Dish> dishes,
        bool dryRun,
        SampleDataImportCountsDto counts)
    {
        var cleanDishName = WeeklyMenuWorkbookSyntaxPolicy.NormalizeDishCell(dishName);
        var normalized = NormalizeDishMatchKey(dishName);
        var existing = dishes
            .Where(item => string.Equals(NormalizeDishMatchKey(item.DishName), normalized, StringComparison.OrdinalIgnoreCase))
            .OrderByDescending(HasPublishedBom)
            .ThenBy(item => HasPortionSuffix(item.DishName))
            .ThenBy(item => item.DishName.Length)
            .FirstOrDefault();
        if (existing is not null)
        {
            existing.DishGroup = string.IsNullOrWhiteSpace(dishGroup) ? existing.DishGroup : dishGroup.Trim();
            existing.DishType = string.IsNullOrWhiteSpace(dishType) ? existing.DishType : dishType.Trim();
            existing.IsActive = true;
            counts.DishesUpdated++;
            return existing;
        }

        return EnsureDish(cleanDishName, dishGroup, dishType, dishes, dryRun, counts);
    }

    private static string NormalizeDishMatchKey(string? value)
    {
        var normalized = RemoveDiacritics(value ?? string.Empty)
            .Replace('Đ', 'D')
            .Replace('đ', 'd')
            .Trim()
            .ToUpperInvariant();
        normalized = Regex.Replace(normalized, @"\b\d+\s*(G|GRAM)\b", " ", RegexOptions.IgnoreCase);
        normalized = Regex.Replace(normalized, @"\s+", " ");
        return normalized.Trim();
    }

    private static bool HasPortionSuffix(string? value)
        => Regex.IsMatch(value ?? string.Empty, @"\b\d+\s*(g|gram)\b", RegexOptions.IgnoreCase);

    private static Dish SelectPreferredImportedDish(IEnumerable<Dish> dishes)
        => dishes
            .OrderByDescending(HasPublishedBom)
            .ThenBy(dish => HasPortionSuffix(dish.DishName))
            .ThenBy(dish => dish.DishName.Length)
            .First();

    private static bool HasPublishedBom(Dish dish)
        => dish.Dishboms.Any(bom => string.Equals(bom.BomStatus, "PUBLISHED", StringComparison.OrdinalIgnoreCase));

    private static string WeeklyMenuScheduleKey(DateOnly serviceDate, string shiftName)
        => $"{serviceDate:yyyyMMdd}|{shiftName.Trim().ToUpperInvariant()}";

    private static string DayKey(DayOfWeek dayOfWeek)
        => dayOfWeek switch
        {
            DayOfWeek.Monday => "t2",
            DayOfWeek.Tuesday => "t3",
            DayOfWeek.Wednesday => "t4",
            DayOfWeek.Thursday => "t5",
            DayOfWeek.Friday => "t6",
            DayOfWeek.Saturday => "t7",
            DayOfWeek.Sunday => "cn",
            _ => "t2"
        };

    private async Task<WeeklyMenuImportDiffDto> BuildWeeklyMenuImportDiffAsync(
        WeeklyMenuImportPlan plan,
        Customer customer,
        CancellationToken cancellationToken)
    {
        var existingSchedules = await _context.Menuschedules
            .AsNoTracking()
            .Include(schedule => schedule.Menu)
                .ThenInclude(menu => menu.Menuitems)
                    .ThenInclude(menuItem => menuItem.Dish)
            .Where(schedule =>
                schedule.CustomerId.SequenceEqual(customer.CustomerId) &&
                schedule.WeekStartDate == plan.WeekStartDate)
            .ToListAsync(cancellationToken);

        var existingSlots = new Dictionary<string, WeeklyMenuImportDiffRowDto>(StringComparer.OrdinalIgnoreCase);
        foreach (var schedule in existingSchedules)
        {
            foreach (var item in schedule.Menu.Menuitems)
            {
                var slot = ParsePersistedDishSlot(item.DishSlot);
                var key = WeeklyMenuSlotKey(schedule.ServiceDate, schedule.ShiftName, slot.VariantKey, slot.Slot);
                existingSlots[key] = new WeeklyMenuImportDiffRowDto
                {
                    ServiceDate = schedule.ServiceDate.ToString("yyyy-MM-dd"),
                    ShiftName = schedule.ShiftName,
                    Variant = slot.VariantLabel,
                    Slot = slot.Slot,
                    CurrentDishName = item.Dish.DishName,
                    ChangeType = "removed"
                };
            }
        }

        var diff = new WeeklyMenuImportDiffDto();
        var importedKeys = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        foreach (var item in plan.Items.OrderBy(item => item.ServiceDate).ThenBy(item => item.DbShiftName).ThenBy(item => item.SourceOrder))
        {
            var key = WeeklyMenuSlotKey(item.ServiceDate, item.DbShiftName, item.VariantKey, item.Slot);
            importedKeys.Add(key);
            var row = new WeeklyMenuImportDiffRowDto
            {
                ServiceDate = item.ServiceDate.ToString("yyyy-MM-dd"),
                ShiftName = item.DbShiftName,
                Variant = item.VariantLabel,
                Slot = item.Slot,
                ImportedDishName = item.DishName
            };

            if (!existingSlots.TryGetValue(key, out var existing))
            {
                row.ChangeType = "added";
                diff.AddedSlots++;
            }
            else if (string.Equals(existing.CurrentDishName, item.DishName, StringComparison.OrdinalIgnoreCase))
            {
                row.CurrentDishName = existing.CurrentDishName;
                row.ChangeType = "unchanged";
                diff.UnchangedSlots++;
            }
            else
            {
                row.CurrentDishName = existing.CurrentDishName;
                row.ChangeType = "changed";
                diff.ChangedSlots++;
            }

            diff.Rows.Add(row);
        }

        foreach (var removed in existingSlots.Where(slot => !importedKeys.Contains(slot.Key)).Select(slot => slot.Value))
        {
            diff.RemovedSlots++;
            diff.Rows.Add(removed);
        }

        return diff;
    }

    private static string WeeklyMenuSlotKey(DateOnly serviceDate, string shiftName, string variantKey, string slot)
        => $"{serviceDate:yyyyMMdd}|{shiftName.ToUpperInvariant()}|{variantKey.ToLowerInvariant()}|{slot.ToLowerInvariant()}";

    private async Task<MenuVersion> CreateMenuVersionHeaderAsync(
        WeeklyMenuImportPlan plan,
        Customer customer,
        string? actorUserId,
        CancellationToken cancellationToken)
    {
        var changedAt = DateTime.UtcNow;
        var actorId = await ResolveAuditActorIdAsync(actorUserId, cancellationToken);
        var versions = await _context.Menuversions
            .Where(version => version.WeekStartDate == plan.WeekStartDate)
            .OrderByDescending(version => version.VersionNo)
            .ToListAsync(cancellationToken);
        var customerVersions = versions
            .Where(version => version.CustomerId.SequenceEqual(customer.CustomerId))
            .ToList();
        var versionNo = customerVersions.Count == 0 ? 1 : customerVersions.Max(version => version.VersionNo) + 1;

        foreach (var draft in customerVersions.Where(version => string.Equals(version.Status, "DRAFT", StringComparison.OrdinalIgnoreCase)))
        {
            draft.Status = "SUPERSEDED";
            draft.UpdatedAt = changedAt;
        }

        var importBatch = $"MENU-{customer.CustomerCode}-{plan.WeekStartDate:yyyyMMdd}-V{versionNo:00}";
        var version = new MenuVersion
        {
            MenuVersionId = GuidHelper.NewId(),
            CustomerId = customer.CustomerId,
            WeekStartDate = plan.WeekStartDate,
            VersionNo = versionNo,
            Status = "DRAFT",
            SourceFileName = plan.FileName,
            SourceChecksum = plan.SourceChecksum,
            SourceImportBatch = importBatch,
            CreatedBy = actorId,
            CreatedAt = changedAt,
            UpdatedAt = changedAt
        };

        _context.Menuversions.Add(version);
        return version;
    }

    private async Task<MenuVersion?> GetLatestMenuVersionAsync(
        byte[] customerId,
        DateOnly weekStartDate,
        CancellationToken cancellationToken)
    {
        var versions = await _context.Menuversions
            .AsNoTracking()
            .Where(version => version.WeekStartDate == weekStartDate)
            .OrderByDescending(version => version.VersionNo)
            .ToListAsync(cancellationToken);

        return versions.FirstOrDefault(version => version.CustomerId.SequenceEqual(customerId));
    }

    public async Task<IReadOnlyList<WeeklyMenuImportHistoryItemDto>> GetWeeklyMenuImportHistoryAsync(
        string? customerId,
        CancellationToken cancellationToken = default)
    {
        var query = _context.Menuversions
            .AsNoTracking()
            .Include(version => version.Customer)
            .AsQueryable();

        if (!string.IsNullOrWhiteSpace(customerId))
        {
            var customerBytes = GuidHelper.ParseGuidString(customerId)
                ?? throw new ArgumentException("Khách hàng không hợp lệ.");
            query = query.Where(version => version.CustomerId.SequenceEqual(customerBytes));
        }

        var versions = await query
            .OrderByDescending(version => version.CreatedAt)
            .Take(100)
            .ToListAsync(cancellationToken);

        var userNamesById = await _context.Users
            .AsNoTracking()
            .ToDictionaryAsync(user => GuidHelper.ToGuidString(user.UserId), user => user.FullName, cancellationToken);

        var items = new List<WeeklyMenuImportHistoryItemDto>();
        foreach (var version in versions)
        {
            var (canRollback, reason) = await EvaluateRollbackEligibilityAsync(version, cancellationToken);
            items.Add(new WeeklyMenuImportHistoryItemDto
            {
                MenuVersionId = GuidHelper.ToGuidString(version.MenuVersionId),
                CustomerId = GuidHelper.ToGuidString(version.CustomerId),
                CustomerCode = version.Customer.CustomerCode,
                CustomerName = version.Customer.CustomerName,
                WeekStartDate = version.WeekStartDate,
                VersionNo = version.VersionNo,
                Status = version.Status,
                SourceFileName = version.SourceFileName,
                CreatedByName = version.CreatedBy is null
                    ? null
                    : userNamesById.GetValueOrDefault(GuidHelper.ToGuidString(version.CreatedBy)),
                CreatedAt = version.CreatedAt,
                SuccessRowCount = version.SuccessRowCount,
                ErrorRowCount = version.ErrorRowCount,
                WarningRowCount = version.WarningRowCount,
                CanRollback = canRollback,
                CannotRollbackReason = reason
            });
        }

        return items;
    }

    private async Task<(bool CanRollback, string? Reason)> EvaluateRollbackEligibilityAsync(
        MenuVersion version,
        CancellationToken cancellationToken)
    {
        if (!string.Equals(version.Status, "DRAFT", StringComparison.OrdinalIgnoreCase))
        {
            return (false, $"Phiên import đã ở trạng thái {version.Status}, không thể rollback.");
        }

        var schedules = await _context.Menuschedules
            .AsNoTracking()
            .Where(schedule => schedule.MenuVersionId != null && schedule.MenuVersionId.SequenceEqual(version.MenuVersionId))
            .ToListAsync(cancellationToken);

        if (schedules.Count == 0)
        {
            return (false, "Không tìm thấy lịch thực đơn nào thuộc phiên import này.");
        }

        var lockedSchedule = schedules.FirstOrDefault(schedule =>
            !string.Equals(schedule.Status, "DRAFT", StringComparison.OrdinalIgnoreCase));
        if (lockedSchedule is not null)
        {
            return (false, $"Lịch {lockedSchedule.ServiceDate:dd/MM/yyyy} đã ở trạng thái {lockedSchedule.Status}.");
        }

        var scheduleIds = schedules.Select(schedule => schedule.MenuScheduleId).ToList();
        var hasQuantityLines = await _context.Mealquantityplanlines
            .AsNoTracking()
            .AnyAsync(line => scheduleIds.Any(id => line.MenuScheduleId.SequenceEqual(id)), cancellationToken);
        if (hasQuantityLines)
        {
            return (false, "Đã có số suất liên kết với lịch thực đơn này.");
        }

        return (true, null);
    }

    public async Task<RollbackWeeklyMenuImportResultDto> RollbackWeeklyMenuImportAsync(
        string menuVersionId,
        string? actorUserId,
        CancellationToken cancellationToken = default)
    {
        var versionBytes = GuidHelper.ParseGuidString(menuVersionId)
            ?? throw new ArgumentException("Phiên import không hợp lệ.");
        var version = await _context.Menuversions
            .FirstOrDefaultAsync(item => item.MenuVersionId.SequenceEqual(versionBytes), cancellationToken)
            ?? throw new KeyNotFoundException("Không tìm thấy phiên import.");

        var (canRollback, reason) = await EvaluateRollbackEligibilityAsync(version, cancellationToken);
        if (!canRollback)
        {
            throw new InvalidOperationException(reason ?? "Không thể rollback phiên import này.");
        }

        var schedules = await _context.Menuschedules
            .Where(schedule => schedule.MenuVersionId != null && schedule.MenuVersionId.SequenceEqual(version.MenuVersionId))
            .ToListAsync(cancellationToken);
        var menuIds = schedules.Select(schedule => schedule.MenuId).ToList();

        var menuItems = await _context.Menuitems
            .Where(item => menuIds.Any(id => item.MenuId.SequenceEqual(id)))
            .ToListAsync(cancellationToken);
        _context.Menuitems.RemoveRange(menuItems);

        var scheduleCount = schedules.Count;
        _context.Menuschedules.RemoveRange(schedules);

        var menus = await _context.Menus
            .Where(menu => menuIds.Any(id => menu.MenuId.SequenceEqual(id)))
            .ToListAsync(cancellationToken);
        _context.Menus.RemoveRange(menus);

        var oldStatus = version.Status;
        version.Status = "ROLLED_BACK";
        version.UpdatedAt = DateTime.UtcNow;

        var actorId = await ResolveAuditActorIdAsync(actorUserId, cancellationToken);
        _context.Auditlogs.Add(new AuditLog
        {
            AuditId = GuidHelper.NewId(),
            ChangedAt = DateTime.UtcNow,
            ChangedBy = actorId,
            BusinessArea = "Menu",
            EntityName = nameof(MenuVersion),
            EntityId = version.MenuVersionId,
            FieldName = "Status",
            OldValue = oldStatus,
            NewValue = "ROLLED_BACK",
            Reason = $"Rollback lần import {version.SourceImportBatch} theo yêu cầu người dùng."
        });

        await _context.SaveChangesAsync(cancellationToken);

        return new RollbackWeeklyMenuImportResultDto
        {
            MenuVersionId = menuVersionId,
            MenuSchedulesRemoved = scheduleCount
        };
    }

    private static void ApplyMenuVersion(WeeklyMenuImportResultDto result, MenuVersion? version)
    {
        if (version is null)
        {
            return;
        }

        result.MenuVersionId = GuidHelper.ToGuidString(version.MenuVersionId);
        result.MenuVersionNo = version.VersionNo;
        result.MenuVersionStatus = version.Status;
        result.PublishedBy = version.PublishedBy is null ? null : GuidHelper.ToGuidString(version.PublishedBy);
        result.PublishedAt = version.PublishedAt?.ToString("O");
        result.SourceImportBatch = version.SourceImportBatch;
    }

    private static string ComputeFileChecksum(string filePath)
        => Convert.ToHexString(SHA256.HashData(File.ReadAllBytes(filePath)));

    private static async Task<string> SaveTempWorkbookAsync(Stream fileStream, CancellationToken cancellationToken)
    {
        var tempFilePath = Path.Combine(Path.GetTempPath(), $"{Guid.NewGuid():N}.xlsx");
        await using var fileOut = new FileStream(tempFilePath, FileMode.CreateNew, FileAccess.Write);
        await fileStream.CopyToAsync(fileOut, cancellationToken);
        return tempFilePath;
    }

    private static void DeleteTempWorkbook(string tempFilePath)
    {
        if (File.Exists(tempFilePath))
        {
            File.Delete(tempFilePath);
        }
    }

    public async Task<(bool Success, string Message, List<string> Warnings)> BulkUpdateWeeklyMenuAsync(
        BulkUpdateWeeklyMenuRequest request,
        CancellationToken cancellationToken = default)
    {
        var customerBytes = GuidHelper.ParseGuidString(request.CustomerId);
        if (customerBytes is null)
        {
            return (false, "ID khách hàng không hợp lệ.", new List<string>());
        }

        var warnings = new List<string>();
        var today = DateOnly.FromDateTime(DateTime.UtcNow);

        await using var transaction = await _context.Database.BeginTransactionAsync(cancellationToken);
        try
        {
            foreach (var slot in request.Slots)
            {
                var dishBytes = GuidHelper.ParseGuidString(slot.DishId);
                if (dishBytes is null)
                {
                    return (false, $"ID món ăn không hợp lệ: {slot.DishId}", new List<string>());
                }

                // 1. Verify dish exists
                var dish = await _context.Dishes
                    .AsNoTracking()
                    .FirstOrDefaultAsync(d => d.DishId.SequenceEqual(dishBytes), cancellationToken);
                if (dish is null)
                {
                    return (false, $"Món ăn với ID {slot.DishId} không tồn tại trong hệ thống.", new List<string>());
                }

                // Check BOM coverage
                var hasActiveBom = await _context.Dishboms
                    .AnyAsync(b => b.DishId.SequenceEqual(dishBytes) && (b.EffectiveTo == null || b.EffectiveTo >= today), cancellationToken);
                if (!hasActiveBom)
                {
                    var warningMsg = $"Món '{dish.DishName}' chưa được cấu hình định lượng (BOM).";
                    if (!warnings.Contains(warningMsg))
                    {
                        warnings.Add(warningMsg);
                    }
                }

                var dbShiftName = string.Equals(slot.ShiftName, "Ca Sáng", StringComparison.OrdinalIgnoreCase) || string.Equals(slot.ShiftName, "Ca sáng", StringComparison.OrdinalIgnoreCase)
                    ? "MORNING"
                    : "AFTERNOON";

                // 2. Find menuschedule
                var schedule = await _context.Menuschedules
                    .Include(s => s.Menu)
                        .ThenInclude(m => m.Menuitems)
                    .FirstOrDefaultAsync(s => s.CustomerId.SequenceEqual(customerBytes)
                        && s.ServiceDate == slot.ServiceDate
                        && s.ShiftName == dbShiftName, cancellationToken);

                if (schedule is null)
                {
                    return (false, $"Không tìm thấy lịch thực đơn cho ngày {slot.ServiceDate:dd/MM/yyyy} {slot.ShiftName}. Vui lòng import thực đơn Excel trước.", new List<string>());
                }

                if (!string.Equals(schedule.Status, "DRAFT", StringComparison.OrdinalIgnoreCase))
                {
                    return (false, $"Không thể chỉnh sửa thực đơn vì lịch ngày {slot.ServiceDate:dd/MM/yyyy} {slot.ShiftName} đã ở trạng thái {schedule.Status}.", new List<string>());
                }

                // Map SlotType to dishSlot in Database
                string variantKey = slot.SlotType.Contains("Vegetarian", StringComparison.OrdinalIgnoreCase) ? "vegetarian" : "savory";
                string dishSlot = $"{variantKey}-main";

                // Find the menuitem for this slot
                var menuItem = schedule.Menu.Menuitems.FirstOrDefault(item => item.DishSlot == dishSlot);
                if (menuItem is not null)
                {
                    menuItem.DishId = dishBytes;
                    _context.Menuitems.Update(menuItem);
                }
                else
                {
                    // Create new menuitem
                    var displayOrder = schedule.Menu.Menuitems.Count + 1;
                    var newItem = new MenuItem
                    {
                        MenuItemId = GuidHelper.NewId(),
                        MenuId = schedule.Menu.MenuId,
                        DishId = dishBytes,
                        DishSlot = dishSlot,
                        DisplayOrder = displayOrder
                    };
                    await _context.Menuitems.AddAsync(newItem, cancellationToken);
                }
            }

            await _context.SaveChangesAsync(cancellationToken);
            await transaction.CommitAsync(cancellationToken);

            var message = "Đã lưu thực đơn chỉnh sửa thành công.";
            return (true, message, warnings);
        }
        catch (Exception ex)
        {
            await transaction.RollbackAsync(cancellationToken);
            return (false, $"Lỗi hệ thống khi lưu thực đơn: {ex.Message}", new List<string>());
        }
    }

}
