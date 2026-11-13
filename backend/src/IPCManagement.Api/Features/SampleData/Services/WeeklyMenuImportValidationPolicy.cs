using System.Globalization;
using System.Xml;
using IPCManagement.Api.Features.SampleData.Contracts;
using IPCManagement.Api.Data;
using IPCManagement.Api.Exceptions;
using IPCManagement.Api.Helpers;
using IPCManagement.Api.Features.SystemOperation.Services;
using Microsoft.EntityFrameworkCore;

namespace IPCManagement.Api.Features.SampleData.Services;

internal static class WeeklyMenuImportValidationPolicy
{
    internal const string UnreadableWorkbookMessage =
        "File Excel không đọc được. Vui lòng chọn đúng file Excel theo mẫu thực đơn rồi thử lại.";

    internal static async Task RequireNoMrxBatchAsync(
        IpcManagementContext context, string? mode, IReadOnlyList<PreparedWeeklyMenuImport> prepared, CancellationToken cancellationToken)
    {
        if (!string.Equals(mode, SystemOperationEligibility.MaterialReconciliation, StringComparison.Ordinal)) return;
        foreach (var item in prepared)
        {
            var exists = await (from batch in context.Reconciliationbatches.AsNoTracking()
                                join version in context.Menuversions.AsNoTracking() on batch.MenuVersionId equals version.MenuVersionId
                                where version.CustomerId == item.Customer.CustomerId && version.WeekStartDate == item.Plan.WeekStartDate
                                select batch.BatchId).AnyAsync(cancellationToken);
            if (exists)
                throw new BusinessRuleException($"Nhóm import chỉ hỗ trợ phạm vi chưa có lô đối soát. Khách hàng {item.Customer.CustomerCode}, tuần {item.Plan.WeekStartDate:dd/MM/yyyy}: hãy import lại từng file. Không file nào trong nhóm được lưu.");
        }
    }

    internal static DateOnly? ParseRequestedWeekStart(string? value)
    {
        if (string.IsNullOrWhiteSpace(value)) return null;
        if (!DateOnly.TryParseExact(value, "yyyy-MM-dd", CultureInfo.InvariantCulture, DateTimeStyles.None, out var date))
            throw new ArgumentException("Ngày bắt đầu tuần không hợp lệ. Dùng định dạng yyyy-MM-dd.");
        if (date.DayOfWeek != DayOfWeek.Monday)
            throw new ArgumentException("Ngày bắt đầu tuần phải là Thứ Hai.");
        return date;
    }

    internal static void AddDuplicateWarnings(WeeklyMenuImportPlan plan)
    {
        var duplicateGroups = plan.Items
            .GroupBy(
                item => SlotKey(item.ServiceDate, item.DbShiftName, item.VariantKey, item.Slot),
                StringComparer.OrdinalIgnoreCase)
            .Where(group => group.Count() > 1);
        foreach (var group in duplicateGroups)
        {
            var first = group.OrderBy(item => item.SourceOrder).First();
            var locations = string.Join(
                ", ",
                group
                    .OrderBy(item => item.SourceOrder)
                    .Take(4)
                    .Select(item => $"{item.SourceColumn}{item.SourceRowNumber}: {item.DishName}"));
            var suffix = group.Count() > 4 ? ", ..." : string.Empty;
            AddWarning(
                plan,
                $"File import có dòng trùng cho {first.ServiceDate:yyyy-MM-dd} {WeeklyMenuWorkbookSyntaxPolicy.ToVietnameseShift(first.DbShiftName)} {first.VariantLabel} / {first.SlotLabel}: {group.Count()} dòng ({locations}{suffix}). Vui lòng xử lý trước khi lưu.");
        }
    }

    internal static WeeklyMenuImportValidationDto Build(
        WeeklyMenuImportPlan plan,
        IReadOnlyList<WeeklyMenuImportRowDto> rows)
    {
        var validation = new WeeklyMenuImportValidationDto();
        if (plan.WeekStartDate.DayOfWeek != DayOfWeek.Monday)
            AddIssue(validation, "error", "WEEK_START_NOT_MONDAY", "Ngày bắt đầu tuần trong file phải là Thứ Hai.", plan.SheetName, null, null, "weekStartDate");
        if (plan.RequestedWeekStartDate.HasValue && plan.WeekStartDate != plan.RequestedWeekStartDate.Value)
        {
            var firstDayColumn = plan.DayColumns
                .OrderBy(item => WeeklyMenuWorkbookLayoutPolicy.ColumnLetterToIndex(item.Column))
                .FirstOrDefault();
            AddIssue(
                validation,
                "error",
                "WEEK_START_MISMATCH",
                $"Tuần trong file bắt đầu {plan.WeekStartDate:yyyy-MM-dd} khác tuần đã chọn {plan.RequestedWeekStartDate.Value:yyyy-MM-dd}.",
                plan.SheetName,
                firstDayColumn?.RowNumber,
                firstDayColumn?.Column,
                "weekStartDate");
        }

        foreach (var column in plan.DayColumns.Where(column => !ServiceCalendar.IsServiceDay(column.ServiceDate)))
            AddIssue(validation, "error", "NON_SERVICE_DAY", "Tuần nghiệp vụ chỉ từ Thứ Hai đến Thứ Bảy; không nhập Chủ nhật.", plan.SheetName, column.RowNumber, column.Column, "serviceDate");

        var duplicateGroups = rows
            .GroupBy(
                row => SlotKey(row.ServiceDate, row.DbShiftName, ResolveVariantKey(row.Variant), row.Slot),
                StringComparer.OrdinalIgnoreCase)
            .Where(group => group.Count() > 1);
        foreach (var group in duplicateGroups)
        {
            var first = group.OrderBy(row => row.SourceRowNumber).First();
            var locations = string.Join(
                ", ",
                group
                    .OrderBy(row => row.SourceRowNumber)
                    .Take(4)
                    .Select(row => $"{row.SourceColumn}{row.SourceRowNumber}: {row.DishName}"));
            var suffix = group.Count() > 4 ? ", ..." : string.Empty;
            AddIssue(
                validation,
                "error",
                "DUPLICATE_SLOT",
                $"File import có dòng trùng cho {first.ServiceDate:yyyy-MM-dd} {WeeklyMenuWorkbookSyntaxPolicy.ToVietnameseShift(first.DbShiftName)} {first.Variant} / {first.SlotLabel}: {group.Count()} dòng ({locations}{suffix}).",
                plan.SheetName,
                first.SourceRowNumber,
                first.SourceColumn,
                "duplicateRows");
        }

        var ambiguousCells = plan.Items
            .Where(item => item.DishMatchAmbiguous)
            .Select(item => $"{item.SourceColumn}{item.SourceRowNumber}")
            .ToHashSet(StringComparer.OrdinalIgnoreCase);
        foreach (var item in plan.Items.Where(item => item.DishMatchAmbiguous))
        {
            AddIssue(
                validation,
                "error",
                "DISH_MATCH_AMBIGUOUS",
                $"Món '{item.DishName}' có thể khớp với nhiều món trong ngân hàng món ăn. Vui lòng dùng đúng tên món đầy đủ rồi kiểm tra lại.",
                plan.SheetName,
                item.SourceRowNumber,
                item.SourceColumn,
                "dishMapping");
        }

        foreach (var row in rows.Where(row => !row.ExistingDish && !ambiguousCells.Contains($"{row.SourceColumn}{row.SourceRowNumber}")))
        {
            AddIssue(
                validation,
                "warning",
                "NEW_DISH",
                $"Món '{row.DishName}' chưa có trong ngân hàng món ăn và sẽ được tạo mới khi lưu. Cần bổ sung BOM trước khi tạo nhu cầu nguyên liệu.",
                plan.SheetName,
                row.SourceRowNumber,
                row.SourceColumn,
                "dishMapping");
        }

        Finalize(validation);
        return validation;
    }

    internal static WeeklyMenuImportResultDto BuildInvalidResult(
        string fileName,
        string customerId,
        DateOnly? weekStartDate,
        string code,
        string message,
        string field)
    {
        var validation = new WeeklyMenuImportValidationDto();
        AddIssue(validation, "error", code, message, null, null, null, field);
        Finalize(validation);
        return new WeeklyMenuImportResultDto
        {
            FileName = fileName,
            CustomerId = customerId,
            WeekStartDate = weekStartDate,
            Validation = validation,
            Warnings = [message]
        };
    }

    internal static bool IsUnreadableWorkbookException(Exception ex)
        => ex is InvalidDataException or IOException or XmlException ||
           ex is InvalidOperationException invalidOperation &&
           invalidOperation.Message.StartsWith("Workbook không có", StringComparison.OrdinalIgnoreCase);

    internal static string ResolveCode(string message)
    {
        if (message.Contains("bảng thực đơn", StringComparison.OrdinalIgnoreCase)) return "TEMPLATE_NOT_FOUND";
        if (message.Contains("cột nhãn", StringComparison.OrdinalIgnoreCase)) return "REQUIRED_LABEL_COLUMN_MISSING";
        if (message.Contains("cột ngày", StringComparison.OrdinalIgnoreCase)) return "WEEK_COLUMNS_MISSING";
        if (message.Contains("dòng món", StringComparison.OrdinalIgnoreCase)) return "NO_MENU_ROWS";
        return "IMPORT_VALIDATION_ERROR";
    }

    internal static string ResolveField(string message)
    {
        if (message.Contains("bảng thực đơn", StringComparison.OrdinalIgnoreCase)) return "template";
        if (message.Contains("cột nhãn", StringComparison.OrdinalIgnoreCase)) return "labelColumn";
        if (message.Contains("cột ngày", StringComparison.OrdinalIgnoreCase)) return "weekStartDate";
        if (message.Contains("dòng món", StringComparison.OrdinalIgnoreCase)) return "menuRows";
        return "file";
    }

    private static void AddIssue(
        WeeklyMenuImportValidationDto validation,
        string severity,
        string code,
        string message,
        string? sheetName,
        int? rowNumber,
        string? column,
        string? field)
    {
        validation.Issues.Add(new WeeklyMenuImportValidationIssueDto
        {
            Severity = severity,
            Code = code,
            Message = message,
            SheetName = sheetName,
            RowNumber = rowNumber,
            Column = column,
            Cell = rowNumber.HasValue && !string.IsNullOrWhiteSpace(column) ? $"{column}{rowNumber.Value}" : null,
            Field = field
        });
    }

    private static void Finalize(WeeklyMenuImportValidationDto validation)
    {
        validation.ErrorCount = validation.Issues.Count(item =>
            string.Equals(item.Severity, "error", StringComparison.OrdinalIgnoreCase));
        validation.WarningCount = validation.Issues.Count(item =>
            string.Equals(item.Severity, "warning", StringComparison.OrdinalIgnoreCase));
        validation.HasCriticalErrors = validation.ErrorCount > 0;
        validation.IsValid = !validation.HasCriticalErrors;
    }

    private static string ResolveVariantKey(string variant)
        => string.Equals(variant, "Chay", StringComparison.OrdinalIgnoreCase) ? "vegetarian" : "savory";

    private static string SlotKey(DateOnly serviceDate, string shiftName, string variantKey, string slot)
        => $"{serviceDate:yyyyMMdd}|{shiftName.ToUpperInvariant()}|{variantKey.ToLowerInvariant()}|{slot.ToLowerInvariant()}";

    private static void AddWarning(WeeklyMenuImportPlan plan, string warning)
    {
        if (!plan.Warnings.Contains(warning, StringComparer.OrdinalIgnoreCase))
        {
            plan.Warnings.Add(warning);
        }
    }
}
