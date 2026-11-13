using System.Globalization;
using System.Text;
using IPCManagement.Api.Helpers;
using Microsoft.EntityFrameworkCore;
using IPCManagement.Api.Data;
using IPCManagement.Api.Models.Entities;

namespace IPCManagement.Api.Features.Reconciliation.Services;

internal static class MrxAuditSearch
{
    private static readonly Dictionary<string, string> Labels = new()
    {
        [nameof(MealQuantityPlanLine)] = "Số suất theo món và ca",
        [nameof(MealQuantityPlan)] = "Kế hoạch suất ăn",
        [nameof(QuantityImportBatch)] = "Đợt nhập số suất",
        [nameof(MenuVersion)] = "Phiên bản thực đơn",
        [nameof(MenuAmendment)] = "Điều chỉnh thực đơn",
        [nameof(MenuSchedule)] = "Lịch thực đơn",
        [nameof(MenuItem)] = "Món trong thực đơn",
        [nameof(Menu)] = "Thực đơn",
        [nameof(DishBom)] = "Định mức món ăn",
        [nameof(BomAdjustment)] = "Điều chỉnh BOM",
        [nameof(ReconciliationSourceRevision)] = "Phiên bản nguồn đối soát",
        [nameof(ReconciliationBatch)] = "Lô đối soát",
        [nameof(InventoryIssue)] = "Phiếu xuất kho",
        [nameof(InventoryIssueLine)] = "Dòng xuất kho",
        [nameof(InventoryReturn)] = "Phiếu hoàn trả kho",
        [nameof(InventoryReturnLine)] = "Dòng hoàn trả kho",
        [nameof(ReconciliationDailyDisposition)] = "Xử lý chênh lệch",
        ["FinalServings"] = "Số suất chốt", ["VegetarianServings"] = "Số suất chay",
        ["SavoryServings"] = "Số suất mặn", ["DishId"] = "Món ăn",
        ["Commit"] = "Xác nhận nguồn số suất", ["IssuedQty"] = "Số lượng thực xuất",
        ["ReceivedAt"] = "Xác nhận nhận hàng", ["Category"] = "Phân loại giải trình",
        ["Validity"] = "Hiệu lực giải trình", ["SourceVersion"] = "Phiên bản nguồn",
        ["MenuAndServings"] = "Thực đơn số suất", ["QuantityAndWaste"] = "Định lượng hao hụt",
        ["QuickCompleteServings"] = "Chốt số suất ca", ["Status"] = "Trạng thái",
        ["Quantity"] = "Số lượng", ["Servings"] = "Số suất",
        ["MenuAmendmentScheduleLine"] = "Dòng điều chỉnh lịch ăn",
        ["Coordination"] = "Điều phối", ["RECONCILIATION"] = "Đối soát",
        ["Inventory"] = "Kho", ["Warehouse"] = "Kho", ["Planning"] = "Kế hoạch",
        ["DRAFT"] = "Bản nháp", ["READY"] = "Sẵn sàng", ["TRANSFERRED"] = "Chờ Kho xuất",
        ["IN_PROGRESS"] = "Đang đối chiếu", ["COMPLETED"] = "Hoàn tất",
    };

    internal static string Normalize(string text) => new(text.ToLowerInvariant().Replace('đ', 'd')
        .Normalize(NormalizationForm.FormD).Where(character => CharUnicodeInfo.GetUnicodeCategory(character) != UnicodeCategory.NonSpacingMark).ToArray());

    internal static bool LabelMatches(string key, string word) => Normalize(key + " " + Labels.GetValueOrDefault(key)).Contains(Normalize(word));

    internal static async Task<IQueryable<AuditLog>> ApplyAsync(IpcManagementContext context, IQueryable<AuditLog> query, string? search, CancellationToken cancellationToken)
    {
        foreach (var word in (search ?? "").Trim().ToLowerInvariant().Split(' ', StringSplitOptions.RemoveEmptyEntries))
        {
            var token = Normalize(word);
            var aliases = Labels.Where(pair => Normalize(pair.Key + " " + pair.Value).Contains(token)).Select(pair => pair.Key).ToArray();
            var dishIds = context.Model.FindEntityType(typeof(Dish)) is null ? [] : await context.Dishes.AsNoTracking()
                .Where(dish => dish.DishName.ToLower().Contains(word) || dish.DishCode.ToLower().Contains(word))
                .Select(dish => dish.DishId).ToListAsync(cancellationToken);
            var dishReferences = dishIds.Select(GuidHelper.ToGuidString).ToArray();
            var actors = context.Model.FindEntityType(typeof(User)) is null
                ? context.Auditlogs.Where(log => false).Select(log => log.ChangedBy)
                : context.Users.Where(user => (user.FullName ?? user.Username).ToLower().Contains(word)).Select(user => user.UserId);
            query = query.Where(log => aliases.Contains(log.EntityName) || aliases.Contains(log.FieldName)
                || log.EntityName.ToLower().Contains(word) || (log.FieldName != null && log.FieldName.ToLower().Contains(word))
                || (log.BusinessArea != null && (aliases.Contains(log.BusinessArea) || log.BusinessArea.ToLower().Contains(word)))
                || (log.FieldName == "Status" && (aliases.Contains(log.OldValue!) || aliases.Contains(log.NewValue!)))
                || (log.FieldName == "DishId" && (dishReferences.Contains(log.OldValue!) || dishReferences.Contains(log.NewValue!)))
                || (log.OldValue != null && log.OldValue.ToLower().Contains(word))
                || (log.NewValue != null && log.NewValue.ToLower().Contains(word))
                || (log.Reason != null && log.Reason.ToLower().Contains(word)) || actors.Contains(log.ChangedBy));
        }
        return query;
    }
}
