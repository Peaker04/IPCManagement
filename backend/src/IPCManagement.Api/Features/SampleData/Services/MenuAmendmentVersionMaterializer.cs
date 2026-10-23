using IPCManagement.Api.Data;
using IPCManagement.Api.Helpers;
using IPCManagement.Api.Models.Entities;
using Microsoft.EntityFrameworkCore;

namespace IPCManagement.Api.Features.SampleData.Services;

internal static class MenuAmendmentVersionMaterializer
{
    public static async Task<MenuVersion> MaterializeAmendedVersionAsync(
        IpcManagementContext context,
        MenuAmendment amendment,
        IReadOnlyList<MenuSchedule> schedules,
        byte[] actorId,
        DateTime changedAt,
        CancellationToken cancellationToken)
    {
        var versions = await context.Menuversions
            .Where(item => item.CustomerId.SequenceEqual(amendment.CustomerId) && item.WeekStartDate == amendment.WeekStartDate)
            .ToListAsync(cancellationToken);
        var versionNo = versions.Count == 0 ? 1 : versions.Max(item => item.VersionNo) + 1;
        var version = new MenuVersion
        {
            MenuVersionId = GuidHelper.NewId(), CustomerId = amendment.CustomerId, WeekStartDate = amendment.WeekStartDate,
            VersionNo = versionNo, Status = "ACTIVE", SourceImportBatch = $"AMEND-{GuidHelper.ToGuidString(amendment.MenuAmendmentId)}",
            CreatedBy = actorId, CreatedAt = changedAt, PublishedBy = actorId, PublishedAt = changedAt, UpdatedAt = changedAt,
            SuccessRowCount = schedules.Count
        };
        context.Menuversions.Add(version);

        foreach (var sourceSchedule in schedules)
        {
            var sourceMenu = sourceSchedule.Menu;
            var menu = new Menu
            {
                MenuId = GuidHelper.NewId(),
                MenuCode = AmendmentMenuCode(sourceMenu.MenuCode, versionNo),
                MenuName = $"{sourceMenu.MenuName} · Điều chỉnh V{versionNo}",
                FromDate = sourceMenu.FromDate, ToDate = sourceMenu.ToDate, IsActive = sourceMenu.IsActive
            };
            context.Menus.Add(menu);
            foreach (var sourceItem in sourceMenu.Menuitems)
            {
                var menuItem = new MenuItem
                {
                    MenuItemId = GuidHelper.NewId(), MenuId = menu.MenuId, DishId = sourceItem.DishId,
                    DishSlot = sourceItem.DishSlot, DisplayOrder = sourceItem.DisplayOrder
                };
                menu.Menuitems.Add(menuItem);
            }
            sourceSchedule.MenuId = menu.MenuId;
            sourceSchedule.MenuVersionId = version.MenuVersionId;
            sourceSchedule.Menu = menu;
        }

        return version;
    }

    public static string AmendmentMenuCode(string sourceCode, int versionNo)
    {
        var suffix = $"-A{versionNo:00}";
        return sourceCode.Length + suffix.Length <= 50 ? sourceCode + suffix : sourceCode[..(50 - suffix.Length)] + suffix;
    }

    public static MenuItem? ResolveLegacyMenuItem(IEnumerable<MenuItem> items, string dishSlot)
        => dishSlot is "savory-main" or "vegetarian-main" or "main"
            ? items.SingleOrDefault(item => string.IsNullOrWhiteSpace(item.DishSlot) || item.DishSlot == "main")
            : null;
}
