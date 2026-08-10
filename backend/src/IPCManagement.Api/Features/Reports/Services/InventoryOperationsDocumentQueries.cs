using IPCManagement.Api.Data;
using IPCManagement.Api.Features.Reports.Contracts;
using IPCManagement.Api.Helpers;
using IPCManagement.Api.Shared.Contracts;
using Microsoft.EntityFrameworkCore;

namespace IPCManagement.Api.Features.Reports.Services;

internal static class InventoryOperationsDocumentQueries
{
    public static async Task<IReadOnlyList<WorkflowDocumentDto>> BuildReceiptDocumentsAsync(
        IpcManagementContext context,
        WorkflowReportQueryDto query,
        int limit)
    {
        var dateFrom = ParseDateOnly(query.DateFrom);
        var dateTo = ParseDateOnly(query.DateTo);
        var receipts = context.Inventoryreceipts.AsNoTracking().AsQueryable();

        if (dateFrom is not null)
        {
            receipts = receipts.Where(item => item.ReceiptDate >= dateFrom);
        }

        if (dateTo is not null)
        {
            receipts = receipts.Where(item => item.ReceiptDate <= dateTo);
        }

        return await receipts
            .OrderByDescending(item => item.ReceiptDate)
            .Take(limit)
            .Select(item => new WorkflowDocumentDto
            {
                DocumentId = GuidHelper.ToGuidString(item.ReceiptId),
                DocumentCode = item.ReceiptCode,
                DocumentType = "Phiếu nhập kho",
                DocumentDate = item.ReceiptDate,
                Status = "Đã ghi nhận",
                OwnerLane = "Thủ kho",
                Route = "/warehouse",
                Summary = "Phiếu nhập kho làm tăng tồn kho hiện tại"
            })
            .ToListAsync();
    }

    public static async Task<IReadOnlyList<WorkflowDocumentDto>> BuildIssueDocumentsAsync(
        IpcManagementContext context,
        WorkflowReportQueryDto query,
        int limit)
    {
        var dateFrom = ParseDateOnly(query.DateFrom);
        var dateTo = ParseDateOnly(query.DateTo);
        var shiftName = NormalizeShiftName(query.ShiftName);
        var issues = context.Inventoryissues.AsNoTracking().AsQueryable();

        if (dateFrom is not null)
        {
            issues = issues.Where(item => item.IssueDate >= dateFrom);
        }

        if (dateTo is not null)
        {
            issues = issues.Where(item => item.IssueDate <= dateTo);
        }

        if (!string.IsNullOrWhiteSpace(shiftName))
        {
            issues = issues.Where(item => item.ShiftName == shiftName);
        }

        return await issues
            .OrderByDescending(item => item.IssueDate)
            .Take(limit)
            .Select(item => new WorkflowDocumentDto
            {
                DocumentId = GuidHelper.ToGuidString(item.IssueId),
                DocumentCode = item.IssueCode,
                DocumentType = "Phiếu xuất kho",
                DocumentDate = item.IssueDate,
                ShiftName = item.ShiftName,
                Status = item.ReceivedAt == null ? "Chờ bếp nhận" : "Bếp đã nhận",
                OwnerLane = item.ReceivedAt == null ? "Bếp trưởng" : "Bếp",
                Route = "/chef",
                Summary = item.ReceivedAt == null
                    ? "Kho đã xuất, chờ bếp xác nhận nhận nguyên liệu"
                    : "Bếp đã xác nhận nhận nguyên liệu từ phiếu xuất"
            })
            .ToListAsync();
    }

    public static async Task<IReadOnlyList<WorkflowDocumentDto>> BuildReturnDocumentsAsync(
        IpcManagementContext context,
        WorkflowReportQueryDto query,
        int limit)
    {
        var dateFrom = ParseDateOnly(query.DateFrom);
        var dateTo = ParseDateOnly(query.DateTo);
        var shiftName = NormalizeShiftName(query.ShiftName);
        var returns = context.Inventoryreturns.AsNoTracking().AsQueryable();

        if (dateFrom is not null)
        {
            returns = returns.Where(item => item.ReturnDate >= dateFrom);
        }

        if (dateTo is not null)
        {
            returns = returns.Where(item => item.ReturnDate <= dateTo);
        }

        if (!string.IsNullOrWhiteSpace(shiftName))
        {
            returns = returns.Where(item => item.ShiftName == shiftName);
        }

        return await returns
            .OrderByDescending(item => item.ReturnDate)
            .Take(limit)
            .Select(item => new WorkflowDocumentDto
            {
                DocumentId = GuidHelper.ToGuidString(item.ReturnId),
                DocumentCode = item.ReturnCode,
                DocumentType = item.ReturnType == "WASTE" ? "Phiếu hao hụt" : "Phiếu hoàn kho",
                DocumentDate = item.ReturnDate,
                ShiftName = item.ShiftName,
                Status = "Đã ghi nhận",
                OwnerLane = "Bếp trưởng",
                Route = "/chef",
                Summary = item.ReturnType == "WASTE"
                    ? "Hao hụt thực tế sau sản xuất được ghi nhận"
                    : "Nguyên liệu dư được hoàn lại kho"
            })
            .ToListAsync();
    }

    private static DateOnly? ParseDateOnly(string? value)
        => DateOnly.TryParse(value, out var parsed) ? parsed : null;

    private static string? NormalizeShiftName(string? value)
        => string.IsNullOrWhiteSpace(value) ? null : value.Trim();
}
