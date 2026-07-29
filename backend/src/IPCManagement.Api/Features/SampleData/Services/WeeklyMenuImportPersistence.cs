using System.Security.Cryptography;
using System.Text;
using System.Text.RegularExpressions;
using IPCManagement.Api.Data;
using IPCManagement.Api.Features.SampleData.Contracts;
using IPCManagement.Api.Helpers;
using IPCManagement.Api.Models.Entities;
using Microsoft.EntityFrameworkCore;

using IPCManagement.Api.Exceptions;

namespace IPCManagement.Api.Features.SampleData.Services;

internal sealed class WeeklyMenuImportPersistence(
    IpcManagementContext context,
    WeeklyMenuImportResultBuilder resultBuilder,
    WeeklyMenuAuditActorResolver actorResolver)
{
    public async Task<WeeklyMenuImportResultDto> CommitAsync(
        WeeklyMenuImportPlan plan,
        Customer customer,
        decimal priceTierAmount,
        string? actorUserId,
        CancellationToken cancellationToken)
    {
        await ValidateReimportBoundaryAsync(plan, customer, cancellationToken);

        var version = await CreateMenuVersionHeaderAsync(
            plan,
            customer,
            actorUserId,
            cancellationToken);
        var result = await resultBuilder.BuildAsync(plan, customer, committed: true, cancellationToken);
        WeeklyMenuImportProjection.ApplyMenuVersion(result, version);

        var existingDishes = await context.Dishes
            .Include(dish => dish.Dishboms)
            .ToListAsync(cancellationToken);
        var existingMenus = await context.Menus.ToListAsync(cancellationToken);
        var existingMenuItems = await context.Menuitems.ToListAsync(cancellationToken);
        var existingSchedules = await context.Menuschedules.ToListAsync(cancellationToken);
        var groupedItems = plan.Items
            .GroupBy(item => new { item.ServiceDate, item.DbShiftName })
            .OrderBy(group => group.Key.ServiceDate)
            .ThenBy(group => group.Key.DbShiftName)
            .ToList();

        var importKeys = groupedItems
            .Select(group => ScheduleKey(group.Key.ServiceDate, group.Key.DbShiftName))
            .ToHashSet(StringComparer.OrdinalIgnoreCase);
        var staleSchedules = existingSchedules
            .Where(item =>
                item.CustomerId.SequenceEqual(customer.CustomerId) &&
                item.WeekStartDate == plan.WeekStartDate &&
                !importKeys.Contains(ScheduleKey(item.ServiceDate, item.ShiftName)))
            .ToList();
        ValidateStaleSchedules(staleSchedules);
        await RemoveStaleSchedulesAsync(
            staleSchedules,
            existingSchedules,
            customer,
            result,
            cancellationToken);

        foreach (var group in groupedItems)
        {
            ValidateScheduleIsEditable(existingSchedules, customer, group.Key.ServiceDate, group.Key.DbShiftName);
            var menu = EnsureMenu(
                group.Key.ServiceDate,
                group.Key.DbShiftName,
                customer,
                plan.WeekStartDate,
                plan.WeekEndDate,
                existingMenus,
                result.Counts);

            var staleItems = existingMenuItems
                .Where(item => item.MenuId.SequenceEqual(menu.MenuId))
                .ToList();
            if (staleItems.Count > 0)
            {
                context.Menuitems.RemoveRange(staleItems);
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
                    result.Counts);
            }

            EnsureMenuSchedule(
                customer,
                menu,
                group.Key.ServiceDate,
                plan.WeekStartDate,
                group.Key.DbShiftName,
                DecimalPolicy.RoundMoney(priceTierAmount),
                existingSchedules,
                result.Counts,
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
        WeeklyMenuImportProjection.ApplyCommittedDishIds(result, plan.Items);
        return result;
    }

    private async Task ValidateReimportBoundaryAsync(
        WeeklyMenuImportPlan plan,
        Customer customer,
        CancellationToken cancellationToken)
    {
        var irreversiblePlan = await context.Mealquantityplanlines
            .AsNoTracking()
            .Where(line =>
                line.CustomerId.SequenceEqual(customer.CustomerId) &&
                line.MenuSchedule.WeekStartDate == plan.WeekStartDate &&
                (line.QuantityPlan.Status == "CONFIRMED" ||
                 line.QuantityPlan.Status == "ADJUSTED" ||
                 line.QuantityPlan.Status == "COMPLETED" ||
                 line.QuantityPlan.Status == "ARCHIVED"))
            .Select(line => new
            {
                line.QuantityPlan.PlanCode,
                line.QuantityPlan.Status
            })
            .FirstOrDefaultAsync(cancellationToken);
        if (irreversiblePlan is not null)
        {
            throw new BusinessRuleException(
                $"Không thể import lại thực đơn tuần vì kế hoạch {irreversiblePlan.PlanCode} " +
                $"đã ở trạng thái {irreversiblePlan.Status}. " +
                "Hãy dùng luồng điều chỉnh chứng từ thay vì ghi đè thực đơn nguồn.");
        }
    }

    internal async Task<int> InvalidateWorkflowDocumentsForMenuReimportAsync(
        Customer customer,
        DateOnly weekStartDate,
        DateOnly weekEndDate,
        MenuVersion version,
        string? actorUserId,
        CancellationToken cancellationToken)
    {
        var actorId = await actorResolver.ResolveAsync(actorUserId, cancellationToken);
        var changedAt = DateTime.UtcNow;
        var reason = $"Menu re-import {version.SourceImportBatch} invalidated downstream demand/PR; regenerate required.";
        var invalidatedCount = 0;

        var materialRequests = await context.Materialrequests
            .Include(request => request.Plan)
                .ThenInclude(plan => plan.Productionplanlines)
            .Where(request =>
                request.RequestDate >= weekStartDate &&
                request.RequestDate <= weekEndDate &&
                request.Status != "CANCELLED" &&
                request.Plan.Productionplanlines.Any(line =>
                    line.CustomerId.SequenceEqual(customer.CustomerId)))
            .ToListAsync(cancellationToken);
        foreach (var request in materialRequests)
        {
            var oldStatus = request.Status;
            request.Status = "CANCELLED";
            invalidatedCount++;
            context.Auditlogs.Add(CreateStatusAudit(
                actorId,
                changedAt,
                "Demand",
                nameof(MaterialRequest),
                request.RequestId,
                oldStatus,
                reason));
        }

        var purchaseRequests = await context.Purchaserequests
            .Include(request => request.Purchaserequestlines)
                .ThenInclude(line => line.MaterialRequestLine)
                    .ThenInclude(line => line.PlanLine)
            .Where(request =>
                request.PurchaseForDate >= weekStartDate &&
                request.PurchaseForDate <= weekEndDate &&
                request.Status != "CANCELLED" &&
                request.Purchaserequestlines.Any(line =>
                    line.MaterialRequestLine.PlanLine.CustomerId.SequenceEqual(customer.CustomerId)))
            .ToListAsync(cancellationToken);
        foreach (var request in purchaseRequests)
        {
            var oldStatus = request.Status;
            request.Status = "CANCELLED";
            invalidatedCount++;
            context.Auditlogs.Add(CreateStatusAudit(
                actorId,
                changedAt,
                "Purchase",
                nameof(PurchaseRequest),
                request.PurchaseRequestId,
                oldStatus,
                reason));
        }

        return invalidatedCount;
    }

    private static AuditLog CreateStatusAudit(
        byte[] actorId,
        DateTime changedAt,
        string businessArea,
        string entityName,
        byte[] entityId,
        string oldStatus,
        string reason)
        => new()
        {
            AuditId = GuidHelper.NewId(),
            ChangedAt = changedAt,
            ChangedBy = actorId,
            BusinessArea = businessArea,
            EntityName = entityName,
            EntityId = entityId,
            FieldName = "Status",
            OldValue = oldStatus,
            NewValue = "CANCELLED",
            Reason = reason
        };

    private async Task<MenuVersion> CreateMenuVersionHeaderAsync(
        WeeklyMenuImportPlan plan,
        Customer customer,
        string? actorUserId,
        CancellationToken cancellationToken)
    {
        var changedAt = DateTime.UtcNow;
        var actorId = await actorResolver.ResolveAsync(actorUserId, cancellationToken);
        var versions = await context.Menuversions
            .Where(version => version.WeekStartDate == plan.WeekStartDate)
            .OrderByDescending(version => version.VersionNo)
            .ToListAsync(cancellationToken);
        var customerVersions = versions
            .Where(version => version.CustomerId.SequenceEqual(customer.CustomerId))
            .ToList();
        var versionNo = customerVersions.Count == 0
            ? 1
            : customerVersions.Max(version => version.VersionNo) + 1;
        foreach (var draft in customerVersions.Where(version =>
            string.Equals(version.Status, "DRAFT", StringComparison.OrdinalIgnoreCase)))
        {
            draft.Status = "SUPERSEDED";
            draft.UpdatedAt = changedAt;
        }

        var version = new MenuVersion
        {
            MenuVersionId = GuidHelper.NewId(),
            CustomerId = customer.CustomerId,
            WeekStartDate = plan.WeekStartDate,
            VersionNo = versionNo,
            Status = "DRAFT",
            SourceFileName = plan.FileName,
            SourceChecksum = plan.SourceChecksum,
            SourceImportBatch = $"MENU-{customer.CustomerCode}-{plan.WeekStartDate:yyyyMMdd}-V{versionNo:00}",
            CreatedBy = actorId,
            CreatedAt = changedAt,
            UpdatedAt = changedAt
        };
        context.Menuversions.Add(version);
        return version;
    }

    private static void ValidateStaleSchedules(IReadOnlyList<MenuSchedule> staleSchedules)
    {
        var lockedSchedule = staleSchedules.FirstOrDefault(item =>
            !string.Equals(item.Status, "DRAFT", StringComparison.OrdinalIgnoreCase));
        if (lockedSchedule is not null)
        {
            throw new BusinessRuleException(
                $"Không thể thay thế thực đơn tuần vì lịch {lockedSchedule.ServiceDate:dd/MM/yyyy} {WeeklyMenuWorkbookSyntaxPolicy.ToVietnameseShift(lockedSchedule.ShiftName)} đã ở trạng thái {lockedSchedule.Status}.");
        }
    }

    private async Task RemoveStaleSchedulesAsync(
        IReadOnlyList<MenuSchedule> staleSchedules,
        List<MenuSchedule> existingSchedules,
        Customer customer,
        WeeklyMenuImportResultDto result,
        CancellationToken cancellationToken)
    {
        var staleScheduleIds = staleSchedules.Select(item => item.MenuScheduleId).ToList();
        if (staleScheduleIds.Count == 0)
        {
            return;
        }

        var linkedScheduleIds = await context.Mealquantityplanlines
            .AsNoTracking()
            .Where(line => line.CustomerId.SequenceEqual(customer.CustomerId))
            .Select(line => line.MenuScheduleId)
            .ToListAsync(cancellationToken);
        if (linkedScheduleIds.Any(linkedId =>
            staleScheduleIds.Any(staleId => linkedId.SequenceEqual(staleId))))
        {
            throw new BusinessRuleException(
                "Không thể xóa lịch thực đơn cũ vì đã có số suất liên kết. Vui lòng điều chỉnh số suất hoặc import lại file đầy đủ ngày/ca.");
        }

        context.Menuschedules.RemoveRange(staleSchedules);
        existingSchedules.RemoveAll(item =>
            staleScheduleIds.Any(id => item.MenuScheduleId.SequenceEqual(id)));
        result.Warnings.Add($"Đã bỏ {staleScheduleIds.Count} lịch DRAFT không còn trong file import mới.");
    }

    private static void ValidateScheduleIsEditable(
        IEnumerable<MenuSchedule> schedules,
        Customer customer,
        DateOnly serviceDate,
        string shiftName)
    {
        var lockedSchedule = schedules.FirstOrDefault(item =>
            item.CustomerId.SequenceEqual(customer.CustomerId) &&
            item.ServiceDate == serviceDate &&
            string.Equals(item.ShiftName, shiftName, StringComparison.OrdinalIgnoreCase) &&
            !string.Equals(item.Status, "DRAFT", StringComparison.OrdinalIgnoreCase));
        if (lockedSchedule is not null)
        {
            throw new BusinessRuleException(
                $"Không thể ghi đè thực đơn {serviceDate:dd/MM/yyyy} {WeeklyMenuWorkbookSyntaxPolicy.ToVietnameseShift(shiftName)} vì lịch đã ở trạng thái {lockedSchedule.Status}.");
        }
    }

    private Dish EnsureImportedMenuDish(
        string dishName,
        string dishGroup,
        string dishType,
        List<Dish> dishes,
        SampleDataImportCountsDto counts)
    {
        var cleanDishName = WeeklyMenuWorkbookSyntaxPolicy.NormalizeDishCell(dishName);
        var normalized = WeeklyMenuImportProjection.NormalizeDishMatchKey(dishName);
        var existing = dishes
            .Where(item => string.Equals(
                WeeklyMenuImportProjection.NormalizeDishMatchKey(item.DishName),
                normalized,
                StringComparison.OrdinalIgnoreCase))
            .OrderByDescending(WeeklyMenuImportProjection.HasPublishedBom)
            .ThenBy(item => WeeklyMenuImportProjection.HasPortionSuffix(item.DishName))
            .ThenBy(item => item.DishName.Length)
            .FirstOrDefault();
        if (existing is not null)
        {
            // Group/type describe the global dish catalog. A workbook slot only describes where the
            // dish is used in this menu, so importing another customer/week must not reclassify it.
            var reactivated = existing.IsActive != true;
            existing.IsActive = true;
            if (reactivated)
            {
                counts.DishesUpdated++;
            }
            return existing;
        }

        // Workbook section/slot belongs to the menu line and is persisted in MenuItem.DishSlot.
        // A newly discovered dish must stay uncategorized until the global catalog is reviewed.
        return EnsureDish(cleanDishName, null, null, dishes, counts);
    }

    private Dish EnsureDish(
        string dishName,
        string? dishGroup,
        string? dishType,
        List<Dish> dishes,
        SampleDataImportCountsDto counts)
    {
        var normalized = NormalizeName(dishName);
        var stableCode = StableCode("DISH", dishName);
        var existing = dishes.FirstOrDefault(item =>
            string.Equals(NormalizeName(item.DishName), normalized, StringComparison.OrdinalIgnoreCase) ||
            string.Equals(item.DishCode, stableCode, StringComparison.OrdinalIgnoreCase));
        if (existing is not null)
        {
            var reactivated = existing.IsActive != true;
            existing.IsActive = true;
            if (reactivated)
            {
                counts.DishesUpdated++;
            }
            return existing;
        }

        counts.DishesCreated++;
        var dish = new Dish
        {
            DishId = GuidHelper.NewId(),
            DishCode = stableCode,
            DishName = dishName.Trim(),
            DishGroup = string.IsNullOrWhiteSpace(dishGroup) ? null : dishGroup.Trim(),
            DishType = string.IsNullOrWhiteSpace(dishType) ? null : dishType.Trim(),
            IsActive = true
        };
        context.Dishes.Add(dish);
        dishes.Add(dish);
        return dish;
    }

    private Menu EnsureMenu(
        DateOnly serviceDate,
        string shiftName,
        Customer customer,
        DateOnly weekStart,
        DateOnly weekEnd,
        List<Menu> menus,
        SampleDataImportCountsDto counts)
    {
        var menuCode = $"MENU-{customer.CustomerCode}-{serviceDate:yyyyMMdd}-{shiftName}";
        var existing = menus.FirstOrDefault(item =>
            string.Equals(item.MenuCode, menuCode, StringComparison.OrdinalIgnoreCase));
        var menuName = $"Thực đơn {customer.CustomerCode} {WeeklyMenuWorkbookSyntaxPolicy.ToVietnameseShift(shiftName)} {serviceDate:dd/MM/yyyy}";
        if (existing is not null)
        {
            existing.MenuName = menuName;
            existing.FromDate = weekStart;
            existing.ToDate = weekEnd;
            existing.IsActive = true;
            counts.MenusUpdated++;
            return existing;
        }

        counts.MenusCreated++;
        var menu = new Menu
        {
            MenuId = GuidHelper.NewId(),
            MenuCode = menuCode,
            MenuName = menuName,
            FromDate = weekStart,
            ToDate = weekEnd,
            IsActive = true
        };
        context.Menus.Add(menu);
        menus.Add(menu);
        return menu;
    }

    private void EnsureMenuItem(
        Menu menu,
        Dish dish,
        string dishSlot,
        int displayOrder,
        List<MenuItem> menuItems,
        SampleDataImportCountsDto counts)
    {
        var existing = menuItems.FirstOrDefault(item =>
            item.MenuId.SequenceEqual(menu.MenuId) &&
            item.DishId.SequenceEqual(dish.DishId) &&
            string.Equals(item.DishSlot, dishSlot, StringComparison.OrdinalIgnoreCase));
        if (existing is not null)
        {
            existing.DisplayOrder = displayOrder;
            counts.MenuItemsUpdated++;
            return;
        }

        counts.MenuItemsCreated++;
        var menuItem = new MenuItem
        {
            MenuItemId = GuidHelper.NewId(),
            MenuId = menu.MenuId,
            DishId = dish.DishId,
            DishSlot = dishSlot,
            DisplayOrder = displayOrder
        };
        context.Menuitems.Add(menuItem);
        menuItems.Add(menuItem);
    }

    private void EnsureMenuSchedule(
        Customer customer,
        Menu menu,
        DateOnly serviceDate,
        DateOnly weekStart,
        string shiftName,
        decimal menuPrice,
        List<MenuSchedule> schedules,
        SampleDataImportCountsDto counts,
        byte[] menuVersionId)
    {
        var existing = schedules.FirstOrDefault(item =>
            item.CustomerId.SequenceEqual(customer.CustomerId) &&
            item.ServiceDate == serviceDate &&
            string.Equals(item.ShiftName, shiftName, StringComparison.OrdinalIgnoreCase));
        if (existing is not null)
        {
            existing.MenuId = menu.MenuId;
            existing.WeekStartDate = weekStart;
            existing.MenuPrice = menuPrice;
            existing.BomRatePercent = DecimalPolicy.RoundPercent(100);
            existing.Status = "DRAFT";
            existing.MenuVersionId = menuVersionId;
            counts.MenuSchedulesUpdated++;
            return;
        }

        counts.MenuSchedulesCreated++;
        var schedule = new MenuSchedule
        {
            MenuScheduleId = GuidHelper.NewId(),
            CustomerId = customer.CustomerId,
            MenuId = menu.MenuId,
            ServiceDate = serviceDate,
            WeekStartDate = weekStart,
            ShiftName = shiftName,
            MenuPrice = menuPrice,
            BomRatePercent = DecimalPolicy.RoundPercent(100),
            Status = "DRAFT",
            MenuVersionId = menuVersionId
        };
        context.Menuschedules.Add(schedule);
        schedules.Add(schedule);
    }

    private static string ScheduleKey(DateOnly serviceDate, string shiftName)
        => $"{serviceDate:yyyyMMdd}|{shiftName.Trim().ToUpperInvariant()}";

    private static string NormalizeName(string value)
        => Regex.Replace(value.Trim(), @"\s+", " ");

    private static string StableCode(string prefix, string name)
    {
        var hash = SHA1.HashData(Encoding.UTF8.GetBytes(NormalizeName(name).ToUpperInvariant()));
        return $"{prefix}-{Convert.ToHexString(hash)[..10]}";
    }
}
