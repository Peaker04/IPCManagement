using IPCManagement.Api.Data;
using IPCManagement.Api.Features.Coordination.Contracts;
using IPCManagement.Api.Features.SampleData.Contracts;
using IPCManagement.Api.Helpers;
using IPCManagement.Api.Models.Entities;
using Microsoft.EntityFrameworkCore;

namespace IPCManagement.Api.Features.SampleData.Services;

internal sealed class WeeklyMenuBulkEditService(IpcManagementContext context) : IWeeklyMenuBulkEditService
{
    public async Task<(bool Success, string Message, List<string> Warnings)> BulkUpdateWeeklyMenuAsync(
        BulkUpdateWeeklyMenuRequest request,
        CancellationToken cancellationToken = default)
    {
        var customerBytes = GuidHelper.ParseGuidString(request.CustomerId);
        if (customerBytes is null)
        {
            return (false, "ID khách hàng không hợp lệ.", []);
        }

        var warnings = new List<string>();
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        await using var transaction = await context.Database.BeginTransactionAsync(cancellationToken);
        try
        {
            foreach (var slot in request.Slots)
            {
                var dishBytes = GuidHelper.ParseGuidString(slot.DishId);
                if (dishBytes is null)
                {
                    return (false, $"ID món ăn không hợp lệ: {slot.DishId}", []);
                }

                var dish = await context.Dishes
                    .AsNoTracking()
                    .FirstOrDefaultAsync(
                        item => item.DishId.SequenceEqual(dishBytes),
                        cancellationToken);
                if (dish is null)
                {
                    return (false, $"Món ăn với ID {slot.DishId} không tồn tại trong hệ thống.", []);
                }

                var hasActiveBom = await context.Dishboms.AnyAsync(
                    bom =>
                        bom.DishId.SequenceEqual(dishBytes) &&
                        (bom.EffectiveTo == null || bom.EffectiveTo >= today),
                    cancellationToken);
                if (!hasActiveBom)
                {
                    var warning = $"Món '{dish.DishName}' chưa được cấu hình định lượng (BOM).";
                    if (!warnings.Contains(warning))
                    {
                        warnings.Add(warning);
                    }
                }

                var dbShiftName = string.Equals(
                        slot.ShiftName,
                        "Ca Sáng",
                        StringComparison.OrdinalIgnoreCase) ||
                    string.Equals(slot.ShiftName, "Ca sáng", StringComparison.OrdinalIgnoreCase)
                        ? "MORNING"
                        : "AFTERNOON";
                var schedule = await context.Menuschedules
                    .Include(item => item.Menu)
                        .ThenInclude(menu => menu.Menuitems)
                    .FirstOrDefaultAsync(
                        item =>
                            item.CustomerId.SequenceEqual(customerBytes) &&
                            item.ServiceDate == slot.ServiceDate &&
                            item.ShiftName == dbShiftName,
                        cancellationToken);
                if (schedule is null)
                {
                    return (false,
                        $"Không tìm thấy lịch thực đơn cho ngày {slot.ServiceDate:dd/MM/yyyy} {slot.ShiftName}. Vui lòng import thực đơn Excel trước.",
                        []);
                }

                if (!string.Equals(schedule.Status, "DRAFT", StringComparison.OrdinalIgnoreCase))
                {
                    return (false,
                        $"Không thể chỉnh sửa thực đơn vì lịch ngày {slot.ServiceDate:dd/MM/yyyy} {slot.ShiftName} đã ở trạng thái {schedule.Status}.",
                        []);
                }

                var variantKey = slot.SlotType.Contains("Vegetarian", StringComparison.OrdinalIgnoreCase)
                    ? "vegetarian"
                    : "savory";
                var dishSlot = $"{variantKey}-main";
                var menuItem = schedule.Menu.Menuitems.FirstOrDefault(item => item.DishSlot == dishSlot);
                if (menuItem is not null)
                {
                    menuItem.DishId = dishBytes;
                    context.Menuitems.Update(menuItem);
                }
                else
                {
                    await context.Menuitems.AddAsync(new MenuItem
                    {
                        MenuItemId = GuidHelper.NewId(),
                        MenuId = schedule.Menu.MenuId,
                        DishId = dishBytes,
                        DishSlot = dishSlot,
                        DisplayOrder = schedule.Menu.Menuitems.Count + 1
                    }, cancellationToken);
                }
            }

            await context.SaveChangesAsync(cancellationToken);
            await transaction.CommitAsync(cancellationToken);
            return (true, "Đã lưu thực đơn chỉnh sửa thành công.", warnings);
        }
        catch (Exception ex)
        {
            await transaction.RollbackAsync(cancellationToken);
            return (false, $"Lỗi hệ thống khi lưu thực đơn: {ex.Message}", []);
        }
    }
}
