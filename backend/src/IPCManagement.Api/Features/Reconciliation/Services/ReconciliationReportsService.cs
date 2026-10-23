using System.Globalization;
using System.Text;
using IPCManagement.Api.Data;
using IPCManagement.Api.Data.Transactions;
using IPCManagement.Api.Exceptions;
using IPCManagement.Api.Features.Reconciliation.Contracts;
using IPCManagement.Api.Features.SystemOperation.Services;
using IPCManagement.Api.Helpers;
using IPCManagement.Api.Models.Entities;
using Microsoft.EntityFrameworkCore;

namespace IPCManagement.Api.Features.Reconciliation.Services;

public sealed class ReconciliationReportsService(
    IpcManagementContext context,
    ReconciliationBatchService batchService,
    SystemOperationRequestContext? requestContext = null)
{
    public async Task<MrxOperationalSummaryDto> GetOperationalSummaryAsync(CancellationToken token = default)
    {
        EnsureReconciliationMode();

        var pendingAmendments = await context.Menuamendments.AsNoTracking()
            .Where(m => m.Status == "PENDING_REVIEW")
            .OrderByDescending(m => m.CreatedAt)
            .Take(10)
            .ToListAsync(token);

        var transferredBatches = await context.Reconciliationbatches.AsNoTracking()
            .Where(b => b.Status == "READY" || b.Status == "TRANSFERRED")
            .OrderBy(b => b.CreatedAt)
            .Take(10)
            .ToListAsync(token);

        var pendingDeltas = await context.Reconciliationsourcedeltas.AsNoTracking()
            .Include(d => d.DailyLine).ThenInclude(dl => dl!.BatchLine).ThenInclude(bl => bl.Ingredient)
            .Where(d => d.Status == "PENDING")
            .OrderBy(d => d.CreatedAt)
            .Take(10)
            .ToListAsync(token);

        var inProgressBatches = await context.Reconciliationbatches.AsNoTracking()
            .Where(b => b.Status == "IN_PROGRESS")
            .ToListAsync(token);

        var completionReadyBatches = new List<ReconciliationBatch>();
        var unresolvedVarianceLinesCount = 0;

        foreach (var batch in inProgressBatches)
        {
            var daily = await batchService.GetWarehouseDailyAsync(GuidHelper.ToGuidString(batch.BatchId), token);
            if (daily is not null)
            {
                if (daily.WeeklyStatus == "WEEK_COMPLETE")
                {
                    completionReadyBatches.Add(batch);
                }
                var overages = daily.Dates.SelectMany(d => d.Lines)
                    .Count(l => l.QuantityStatus == "OVER_ISSUED" && !l.HasValidDisposition);
                unresolvedVarianceLinesCount += overages;
            }
        }

        var items = new List<MrxOperationalQueueItemDto>();

        foreach (var m in pendingAmendments)
        {
            items.Add(new MrxOperationalQueueItemDto(
                "PENDING_SOURCE_CHANGE",
                GuidHelper.ToGuidString(m.MenuAmendmentId),
                $"Yêu cầu thay đổi thực đơn: {m.Reason}",
                $"Tuần {m.WeekStartDate:dd/MM/yyyy}",
                $"/weekly-menu?view=mrx-batch&amendmentId={GuidHelper.ToGuidString(m.MenuAmendmentId)}",
                m.CreatedAt));
        }

        foreach (var b in transferredBatches)
        {
            items.Add(new MrxOperationalQueueItemDto(
                "AWAITING_WAREHOUSE",
                GuidHelper.ToGuidString(b.BatchId),
                $"Lô đối soát chờ Kho: {b.Status}",
                $"Phiên bản v{b.Version}",
                $"/warehouse?view=mrx-daily&batchId={GuidHelper.ToGuidString(b.BatchId)}",
                b.CreatedAt));
        }

        foreach (var d in pendingDeltas)
        {
            var ingName = d.DailyLine?.BatchLine?.Ingredient?.IngredientName ?? "Nguyên liệu";
            items.Add(new MrxOperationalQueueItemDto(
                "PENDING_DELTA",
                GuidHelper.ToGuidString(d.SourceDeltaId),
                $"Delta nguồn chờ xử lý: {d.WorkKind} ({ingName})",
                $"Ngày {d.ServiceDate:dd/MM/yyyy} · Số lượng: {d.DeltaQuantity}",
                $"/warehouse?view=mrx-issues",
                d.CreatedAt));
        }

        foreach (var b in completionReadyBatches)
        {
            items.Add(new MrxOperationalQueueItemDto(
                "COMPLETION_READY",
                GuidHelper.ToGuidString(b.BatchId),
                $"Lô đủ điều kiện chốt tuần",
                $"Lô {GuidHelper.ToGuidString(b.BatchId).Substring(0, 8)} · v{b.Version}",
                $"/reconciliation?batchId={GuidHelper.ToGuidString(b.BatchId)}",
                b.CreatedAt));
        }

        var totalPendingAmendments = await context.Menuamendments.CountAsync(m => m.Status == "PENDING_REVIEW", token);
        var totalTransferredBatches = await context.Reconciliationbatches.CountAsync(b => b.Status == "READY" || b.Status == "TRANSFERRED", token);
        var totalPendingDeltas = await context.Reconciliationsourcedeltas.CountAsync(d => d.Status == "PENDING", token);

        return new MrxOperationalSummaryDto(
            totalPendingAmendments,
            totalTransferredBatches,
            totalPendingDeltas,
            unresolvedVarianceLinesCount,
            completionReadyBatches.Count,
            items);
    }

    public async Task<MrxTransactionHistoryReportDto> GetTransactionsHistoryAsync(
        string? batchId,
        DateOnly? fromDate,
        DateOnly? toDate,
        CancellationToken token = default)
    {
        EnsureReconciliationMode();

        var issueQuery = context.Inventoryissues.AsNoTracking()
            .Include(i => i.Warehouse)
            .Include(i => i.IssuedByNavigation)
            .Include(i => i.Inventoryissuelines).ThenInclude(l => l.Ingredient)
            .Include(i => i.Inventoryissuelines).ThenInclude(l => l.Unit)
            .Where(i => i.ReconciliationBatchId != null);

        var returnQuery = context.Inventoryreturns.AsNoTracking()
            .Include(r => r.Warehouse)
            .Include(r => r.CreatedByNavigation)
            .Include(r => r.Issue)
            .Include(r => r.Inventoryreturnlines).ThenInclude(l => l.Ingredient)
            .Include(r => r.Inventoryreturnlines).ThenInclude(l => l.Unit)
            .Where(r => r.Issue.ReconciliationBatchId != null);

        var issues = await issueQuery.OrderByDescending(i => i.CreatedAt).ToListAsync(token);
        var returns = await returnQuery.OrderByDescending(r => r.CreatedAt).ToListAsync(token);

        if (!string.IsNullOrWhiteSpace(batchId))
        {
            var bBytes = ReconciliationBatchService.RequiredId(batchId);
            issues = issues.Where(i => i.ReconciliationBatchId != null && i.ReconciliationBatchId.SequenceEqual(bBytes)).ToList();
            returns = returns.Where(r => r.Issue?.ReconciliationBatchId != null && r.Issue.ReconciliationBatchId.SequenceEqual(bBytes)).ToList();
        }

        var relevantBatchIds = issues.Select(i => i.ReconciliationBatchId!)
            .Concat(returns.Select(r => r.Issue.ReconciliationBatchId!))
            .Distinct(ByteArrayComparer.Instance)
            .ToList();

        var batches = await context.Reconciliationbatches.AsNoTracking()
            .Where(b => relevantBatchIds.Contains(b.BatchId))
            .ToListAsync(token);

        var mvIds = batches.Select(b => b.MenuVersionId).Distinct(ByteArrayComparer.Instance).ToList();
        var menuVersions = await context.Menuversions.AsNoTracking()
            .Include(mv => mv.Customer)
            .Where(mv => mvIds.Contains(mv.MenuVersionId))
            .ToDictionaryAsync(mv => Convert.ToHexString(mv.MenuVersionId), StringComparer.Ordinal, token);

        var customerNameByBatchId = batches.ToDictionary(
            b => Convert.ToHexString(b.BatchId),
            b => menuVersions.TryGetValue(Convert.ToHexString(b.MenuVersionId), out var mv) ? mv.Customer?.CustomerName ?? "Khách hàng" : "Khách hàng",
            StringComparer.Ordinal);

        var issuesByBatchAndDate = issues
            .GroupBy(i => $"{Convert.ToHexString(i.ReconciliationBatchId!)}:{i.IssueDate:yyyy-MM-dd}")
            .ToDictionary(g => g.Key, g => g.OrderBy(i => i.CreatedAt).ToList());

        var rows = new List<MrxTransactionHistoryRowDto>();

        foreach (var issue in issues)
        {
            var key = $"{Convert.ToHexString(issue.ReconciliationBatchId!)}:{issue.IssueDate:yyyy-MM-dd}";
            var batchIssues = issuesByBatchAndDate.GetValueOrDefault(key) ?? [];
            var isFirst = batchIssues.Count > 0 && batchIssues[0].IssueId.SequenceEqual(issue.IssueId);
            var type = isFirst ? "INITIAL_ISSUE" : "SUPPLEMENTAL_ISSUE";
            var customerName = customerNameByBatchId.GetValueOrDefault(Convert.ToHexString(issue.ReconciliationBatchId!), "Khách hàng");

            foreach (var line in issue.Inventoryissuelines)
            {
                rows.Add(new MrxTransactionHistoryRowDto(
                    type,
                    issue.IssueCode,
                    issue.IssueDate,
                    GuidHelper.ToGuidString(issue.ReconciliationBatchId!),
                    customerName,
                    line.Ingredient.IngredientCode,
                    line.Ingredient.IngredientName,
                    line.Unit.UnitName,
                    line.IssuedQty,
                    issue.IssuedByNavigation?.FullName ?? "Thủ kho",
                    issue.CreatedAt,
                    null));
            }
        }

        foreach (var ret in returns)
        {
            var customerName = customerNameByBatchId.GetValueOrDefault(Convert.ToHexString(ret.Issue.ReconciliationBatchId!), "Khách hàng");
            foreach (var line in ret.Inventoryreturnlines)
            {
                rows.Add(new MrxTransactionHistoryRowDto(
                    "PHYSICAL_RETURN",
                    ret.ReturnCode,
                    ret.ReturnDate,
                    GuidHelper.ToGuidString(ret.Issue.ReconciliationBatchId!),
                    customerName,
                    line.Ingredient.IngredientCode,
                    line.Ingredient.IngredientName,
                    line.Unit.UnitName,
                    line.Quantity,
                    ret.CreatedByNavigation?.FullName ?? "Bếp",
                    ret.CreatedAt,
                    ret.Reason));
            }
        }

        var ordered = rows.OrderByDescending(r => r.CreatedAt).ToList();
        return new MrxTransactionHistoryReportDto(ordered, ordered.Count);
    }

    public static byte[] BuildTransactionsHistoryCsv(IReadOnlyList<MrxTransactionHistoryRowDto> rows)
    {
        var csv = new StringBuilder("LoaiGiaoDich,MaChungTu,Ngay,MaLo,KhachHang,MaNguyenLieu,TenNguyenLieu,DVT,SoLuong,NguoiThucHien,ThoiGian,LyDo\r\n");
        foreach (var r in rows)
        {
            csv.AppendJoin(',',
                Csv(r.TransactionType),
                Csv(r.DocumentCode),
                r.Date.ToString("dd/MM/yyyy", CultureInfo.InvariantCulture),
                Csv(r.BatchId),
                Csv(r.CustomerName),
                Csv(r.IngredientCode),
                Csv(r.IngredientName),
                Csv(r.UnitName),
                Number(r.Quantity),
                Csv(r.ActorName),
                r.CreatedAt.ToString("yyyy-MM-dd HH:mm:ss", CultureInfo.InvariantCulture),
                Csv(r.Reason)).Append("\r\n");
        }
        return new UTF8Encoding(true).GetBytes(csv.ToString());
    }

    public async Task<MrxVarianceRegisterReportDto> GetVarianceRegisterAsync(
        string? batchId,
        DateOnly? weekStartDate,
        CancellationToken token = default)
    {
        EnsureReconciliationMode();

        var query = context.Reconciliationbatchdailylines.AsNoTracking()
            .Include(d => d.BatchLine).ThenInclude(bl => bl.Ingredient)
            .Include(d => d.BatchLine).ThenInclude(bl => bl.CanonicalUnit)
            .Include(d => d.BatchLine).ThenInclude(bl => bl.Batch)
            .Include(d => d.BatchLine).ThenInclude(bl => bl.Contributors)
            .Where(d => d.RequiredQuantity > 0);

        if (!string.IsNullOrWhiteSpace(batchId))
        {
            var bBytes = ReconciliationBatchService.RequiredId(batchId);
            query = query.Where(d => d.BatchId == bBytes);
        }

        if (weekStartDate is not null)
        {
            var end = weekStartDate.Value.AddDays(6);
            query = query.Where(d => d.ServiceDate >= weekStartDate.Value && d.ServiceDate <= end);
        }

        var dailyLines = await query.ToListAsync(token);
        if (dailyLines.Count == 0)
        {
            return new MrxVarianceRegisterReportDto([], 0);
        }

        var dailyIds = dailyLines.Select(d => d.DailyLineId).ToList();

        var dailyDispositions = await context.Reconciliationdailydispositions.AsNoTracking()
            .Where(disp => dailyIds.Contains(disp.DailyLineId))
            .ToDictionaryAsync(disp => Convert.ToHexString(disp.DailyLineId), StringComparer.Ordinal, token);

        var auditNotes = (await context.Auditlogs.AsNoTracking()
                .Where(audit => audit.EntityName == nameof(InventoryIssueLine) && audit.FieldName == nameof(InventoryIssueLine.IssuedQty)
                    && audit.EntityId != null && dailyIds.Contains(audit.EntityId) && audit.Reason != null)
                .OrderBy(audit => audit.ChangedAt).Select(audit => new { audit.EntityId, audit.Reason }).ToListAsync(token))
            .GroupBy(audit => GuidHelper.ToGuidString(audit.EntityId!))
            .ToDictionary(group => group.Key, group => (IReadOnlyList<string>)group.Select(audit => audit.Reason!).ToList(), StringComparer.Ordinal);

        var issueLines = (await context.Inventoryissuelines.AsNoTracking()
            .Where(l => l.ReconciliationBatchDailyLineId != null && dailyIds.Contains(l.ReconciliationBatchDailyLineId))
            .ToListAsync(token))
            .GroupBy(l => Convert.ToHexString(l.ReconciliationBatchDailyLineId!))
            .ToDictionary(g => g.Key, g => g.Sum(l => l.IssuedQty), StringComparer.Ordinal);

        var distinctBatchIds = dailyLines.Select(d => d.BatchId).Distinct(ByteArrayComparer.Instance).ToList();
        var batches = await context.Reconciliationbatches.AsNoTracking()
            .Where(b => distinctBatchIds.Contains(b.BatchId))
            .ToListAsync(token);
        var mvIds = batches.Select(b => b.MenuVersionId).Distinct(ByteArrayComparer.Instance).ToList();
        var menuVersions = await context.Menuversions.AsNoTracking()
            .Include(mv => mv.Customer)
            .Where(mv => mvIds.Contains(mv.MenuVersionId))
            .ToDictionaryAsync(mv => Convert.ToHexString(mv.MenuVersionId), StringComparer.Ordinal, token);
        var customerNameByBatchId = batches.ToDictionary(
            b => Convert.ToHexString(b.BatchId),
            b => menuVersions.TryGetValue(Convert.ToHexString(b.MenuVersionId), out var mv) ? mv.Customer?.CustomerName ?? "Khách hàng" : "Khách hàng",
            StringComparer.Ordinal);

        var rows = new List<MrxVarianceRegisterRowDto>();

        foreach (var d in dailyLines)
        {
            var dHex = Convert.ToHexString(d.DailyLineId);
            var issued = issueLines.GetValueOrDefault(dHex, 0m);
            var diff = issued - d.RequiredQuantity;

            if (diff == 0) continue; // Only variances!

            dailyDispositions.TryGetValue(dHex, out var disp);
            var notes = auditNotes.GetValueOrDefault(GuidHelper.ToGuidString(d.DailyLineId)) ?? [];

            var shiftName = d.BatchLine.Contributors
                .Where(c => c.DailyLineId != null && c.DailyLineId.SequenceEqual(d.DailyLineId))
                .Select(c => c.FrozenShiftName)
                .FirstOrDefault() ?? "Cả ngày";

            var customerName = customerNameByBatchId.GetValueOrDefault(Convert.ToHexString(d.BatchId), "Khách hàng");

            rows.Add(new MrxVarianceRegisterRowDto(
                GuidHelper.ToGuidString(d.BatchId),
                customerName,
                d.ServiceDate,
                shiftName,
                d.BatchLine.Ingredient.IngredientCode,
                d.BatchLine.Ingredient.IngredientName,
                d.BatchLine.CanonicalUnit.UnitName,
                d.RequiredQuantity,
                issued,
                diff,
                diff > 0 ? "OVER_ISSUED" : "UNDER_ISSUED",
                disp?.Category,
                disp?.Reason,
                disp?.DisposedBy is null ? null : GuidHelper.ToGuidString(disp.DisposedBy),
                disp?.DisposedAt,
                notes));
        }

        var ordered = rows.OrderBy(r => r.ServiceDate).ThenBy(r => r.IngredientName).ToList();
        return new MrxVarianceRegisterReportDto(ordered, ordered.Count);
    }

    public static byte[] BuildVarianceRegisterCsv(IReadOnlyList<MrxVarianceRegisterRowDto> rows)
    {
        var csv = new StringBuilder("MaLo,KhachHang,Ngay,Ca,MaNguyenLieu,TenNguyenLieu,DVT,NhuCau,ThucXuat,ChenhLech,LoaiChenhLech,DanhMucXuLy,LyDoXuLy,NguoiXuLy,NgayXuLy,GhiChuKho\r\n");
        foreach (var r in rows)
        {
            csv.AppendJoin(',',
                Csv(r.BatchId),
                Csv(r.CustomerName),
                r.ServiceDate.ToString("dd/MM/yyyy", CultureInfo.InvariantCulture),
                Csv(r.ShiftName),
                Csv(r.IngredientCode),
                Csv(r.IngredientName),
                Csv(r.CanonicalUnitName),
                Number(r.RequiredQuantity),
                Number(r.IssuedQuantity),
                Number(r.Difference),
                Csv(r.VarianceType),
                Csv(r.DispositionCategory),
                Csv(r.DispositionReason),
                Csv(r.DisposedBy),
                r.DisposedAt?.ToString("yyyy-MM-dd HH:mm:ss", CultureInfo.InvariantCulture) ?? "",
                Csv(string.Join("; ", r.IssueNotes))).Append("\r\n");
        }
        return new UTF8Encoding(true).GetBytes(csv.ToString());
    }

    public async Task<MrxCompletedRegisterReportDto> GetCompletedRegisterAsync(
        int pageNumber = 1,
        int pageSize = 50,
        CancellationToken token = default)
    {
        EnsureReconciliationMode();

        var query = context.Reconciliationbatches.AsNoTracking()
            .Include(b => b.Lines)
            .Where(b => b.Status == "COMPLETED");

        var total = await query.CountAsync(token);
        var batches = await query
            .OrderByDescending(b => b.CompletedAt)
            .Skip((pageNumber - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(token);

        var menuVersionIds = batches.Select(b => b.MenuVersionId).Distinct(ByteArrayComparer.Instance).ToList();
        var menuVersions = await context.Menuversions.AsNoTracking()
            .Include(mv => mv.Customer)
            .Where(mv => menuVersionIds.Contains(mv.MenuVersionId))
            .ToDictionaryAsync(mv => Convert.ToHexString(mv.MenuVersionId), StringComparer.Ordinal, token);

        var completedByIds = batches
            .Where(b => b.CompletedBy != null)
            .Select(b => b.CompletedBy!)
            .Distinct(ByteArrayComparer.Instance)
            .ToList();
        var users = await context.Users.AsNoTracking()
            .Where(u => completedByIds.Contains(u.UserId))
            .ToDictionaryAsync(u => Convert.ToHexString(u.UserId), u => u.FullName ?? u.Username, StringComparer.Ordinal, token);

        var rows = new List<MrxCompletedRegisterRowDto>();

        foreach (var b in batches)
        {
            var mvHex = Convert.ToHexString(b.MenuVersionId);
            menuVersions.TryGetValue(mvHex, out var mv);

            var totalReq = b.Lines.Sum(l => l.RequiredQuantity);
            var totalIss = totalReq; // In a completed batch, lines balance
            var diff = totalIss - totalReq;

            var completedByName = "—";
            if (b.CompletedBy is not null)
            {
                var userHex = Convert.ToHexString(b.CompletedBy);
                completedByName = users.TryGetValue(userHex, out var name)
                    ? name
                    : GuidHelper.ToGuidString(b.CompletedBy);
            }

            rows.Add(new MrxCompletedRegisterRowDto(
                GuidHelper.ToGuidString(b.BatchId),
                mv?.Customer?.CustomerName ?? "Khách hàng",
                mv?.WeekStartDate ?? DateOnly.FromDateTime(b.CreatedAt),
                mv?.WeekStartDate.AddDays(6) ?? DateOnly.FromDateTime(b.CreatedAt).AddDays(6),
                completedByName,
                b.CompletedAt ?? DateTime.UtcNow,
                b.Version,
                b.Lines.Count,
                totalReq,
                totalIss,
                diff));
        }

        return new MrxCompletedRegisterReportDto(rows, total);
    }

    public static byte[] BuildCompletedRegisterCsv(IReadOnlyList<MrxCompletedRegisterRowDto> rows)
    {
        var csv = new StringBuilder("MaLo,KhachHang,NgayBatDau,NgayKetThuc,NguoiHoanTat,ThoiGianHoanTat,PhienBan,SoNguyenLieu,TongNhuCau,TongThucXuat,TongChenhLech\r\n");
        foreach (var r in rows)
        {
            csv.AppendJoin(',',
                Csv(r.BatchId),
                Csv(r.CustomerName),
                r.WeekStartDate.ToString("dd/MM/yyyy", CultureInfo.InvariantCulture),
                r.WeekEndDate.ToString("dd/MM/yyyy", CultureInfo.InvariantCulture),
                Csv(r.CompletedBy),
                r.CompletedAt.ToString("yyyy-MM-dd HH:mm:ss", CultureInfo.InvariantCulture),
                r.Version.ToString(CultureInfo.InvariantCulture),
                r.TotalIngredientsCount.ToString(CultureInfo.InvariantCulture),
                Number(r.TotalRequired),
                Number(r.TotalIssued),
                Number(r.TotalVariance)).Append("\r\n");
        }
        return new UTF8Encoding(true).GetBytes(csv.ToString());
    }

    public async Task<MrxAuditTrailReportDto> GetAuditTrailAsync(
        string? batchId,
        int pageNumber = 1,
        int pageSize = 50,
        CancellationToken token = default)
    {
        EnsureReconciliationMode();

        var query = context.Auditlogs.AsNoTracking()
            .Include(a => a.ChangedByNavigation)
            .Where(a => a.BusinessArea == "Reconciliation" || a.BusinessArea == "RECONCILIATION" || a.BusinessArea == "Inventory");

        if (!string.IsNullOrWhiteSpace(batchId))
        {
            var bBytes = ReconciliationBatchService.RequiredId(batchId);
            query = query.Where(a => a.EntityId == bBytes);
        }

        var total = await query.CountAsync(token);
        var logs = await query
            .OrderByDescending(a => a.ChangedAt)
            .Skip((pageNumber - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(token);

        var rows = logs.Select(a => new MrxAuditTrailRowDto(
            GuidHelper.ToGuidString(a.AuditId),
            a.ChangedAt,
            a.ChangedByNavigation?.FullName ?? GuidHelper.ToGuidString(a.ChangedBy),
            a.BusinessArea,
            a.EntityName,
            a.EntityId is null ? "—" : GuidHelper.ToGuidString(a.EntityId),
            a.FieldName,
            a.OldValue,
            a.NewValue,
            a.Reason)).ToList();

        return new MrxAuditTrailReportDto(rows, total);
    }

    public static byte[] BuildAuditTrailCsv(IReadOnlyList<MrxAuditTrailRowDto> rows)
    {
        var csv = new StringBuilder("AuditId,ThoiGian,NguoiThucHien,PhanHe,ThucThe,EntityId,TruongDuLieu,GiaTriCu,GiaTriMoi,LyDo\r\n");
        foreach (var r in rows)
        {
            csv.AppendJoin(',',
                Csv(r.AuditId),
                r.ChangedAt.ToString("yyyy-MM-dd HH:mm:ss", CultureInfo.InvariantCulture),
                Csv(r.ChangedBy),
                Csv(r.BusinessArea),
                Csv(r.EntityName),
                Csv(r.EntityId),
                Csv(r.FieldName),
                Csv(r.OldValue),
                Csv(r.NewValue),
                Csv(r.Reason)).Append("\r\n");
        }
        return new UTF8Encoding(true).GetBytes(csv.ToString());
    }

    private void EnsureReconciliationMode()
    {
        if (requestContext is not null && !string.Equals(requestContext.Mode, SystemOperationEligibility.MaterialReconciliation, StringComparison.Ordinal))
        {
            throw new BusinessRuleException("Báo cáo đối soát chỉ hoạt động trong chế độ đối chiếu nguyên liệu.");
        }
    }

    private static string Csv(string? value) => $"\"{(value ?? string.Empty).Replace("\"", "\"\"")}\"";
    private static string Number(decimal value) => value.ToString("0.######", CultureInfo.InvariantCulture);

    private sealed class ByteArrayComparer : IEqualityComparer<byte[]>
    {
        public static readonly ByteArrayComparer Instance = new();
        public bool Equals(byte[]? x, byte[]? y) => System.Collections.StructuralComparisons.StructuralEqualityComparer.Equals(x, y);
        public int GetHashCode(byte[] obj) => System.Collections.StructuralComparisons.StructuralEqualityComparer.GetHashCode(obj);
    }
}
