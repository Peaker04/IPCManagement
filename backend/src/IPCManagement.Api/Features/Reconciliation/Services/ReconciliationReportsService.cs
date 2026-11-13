using System.Globalization;
using System.Runtime.CompilerServices;
using System.Text;
using IPCManagement.Api.Data;
using IPCManagement.Api.Data.Transactions;
using IPCManagement.Api.Exceptions;
using IPCManagement.Api.Features.Reconciliation.Contracts;
using IPCManagement.Api.Features.SystemOperation.Services;
using IPCManagement.Api.Helpers;
using IPCManagement.Api.Models.Entities;
using IPCManagement.Api.Shared.Contracts;
using IPCManagement.Api.Security;
using Microsoft.EntityFrameworkCore;

namespace IPCManagement.Api.Features.Reconciliation.Services;

public sealed class ReconciliationReportsService(
    IpcManagementContext context,
    ReconciliationBatchService batchService,
    SystemOperationRequestContext? requestContext = null)
{
    public async Task<MrxOperationalSummaryDto> GetOperationalSummaryAsync(
        MrxOperationalSummaryQuery request,
        IReadOnlyCollection<string> actorRoles,
        CancellationToken token = default)
    {
        EnsureReconciliationMode();
        if (request.WeekFrom is not null && request.WeekTo is not null && request.WeekFrom > request.WeekTo)
            throw new BusinessRuleException("Ngày bắt đầu không được sau ngày kết thúc.");
        var customerId = string.IsNullOrWhiteSpace(request.CustomerId) ? null : ReconciliationBatchService.RequiredId(request.CustomerId);
        bool HasRole(string[] roles) => actorRoles.Any(role => roles.Contains(role, StringComparer.OrdinalIgnoreCase));
        var canDecide = HasRole(AuthorizationPolicies.ReconciliationDecisionRoles);
        var canIssue = HasRole(AuthorizationPolicies.ReconciliationWarehouseIssueRoles);
        var canReadSource = HasRole(AuthorizationPolicies.ReconciliationSourceReadRoles);
        var canSeeWarehouse = canDecide || canIssue || canReadSource;
        var items = new List<MrxOperationalQueueItemDto>();
        var queuePage = new PagedRequestDto { PageNumber = request.QueuePage, PageSize = request.QueuePageSize };
        var queueSkip = (int)Math.Min((long)(queuePage.PageNumber - 1) * queuePage.PageSize, int.MaxValue);
        var queueCounts = new Dictionary<string, int>();
        int? pendingChanges = null, awaitingWarehouse = null, pendingDeltas = null, unresolvedVariances = null, completionReady = null;

        var scopedBatches = from batch in context.Reconciliationbatches.AsNoTracking()
            join menu in context.Menuversions.AsNoTracking() on batch.MenuVersionId equals menu.MenuVersionId
            where customerId == null || menu.CustomerId == customerId
            where request.WeekFrom == null || menu.WeekStartDate >= request.WeekFrom
            where request.WeekTo == null || menu.WeekStartDate <= request.WeekTo
            select new { Batch = batch, menu.CustomerId, menu.WeekStartDate };

        if (canDecide)
        {
            var amendments = context.Menuamendments.AsNoTracking()
                .Where(m => m.Status == "PENDING_REVIEW" || m.Status == "RECONCILIATION_REQUIRED")
                .Where(m => customerId == null || m.CustomerId == customerId)
                .Where(m => request.WeekFrom == null || m.WeekStartDate >= request.WeekFrom)
                .Where(m => request.WeekTo == null || m.WeekStartDate <= request.WeekTo);
            pendingChanges = await amendments.CountAsync(token);
            queueCounts["PENDING_SOURCE_CHANGE"] = pendingChanges.Value;
            foreach (var amendment in await amendments.OrderBy(m => m.CreatedAt).ThenBy(m => m.MenuAmendmentId).Skip(queueSkip).Take(queuePage.PageSize).ToListAsync(token))
                items.Add(new("PENDING_SOURCE_CHANGE", GuidHelper.ToGuidString(amendment.MenuAmendmentId),
                    $"Thay đổi nguồn: {amendment.Reason}", $"Tuần {amendment.WeekStartDate:dd/MM/yyyy}",
                    $"/weekly-menu?view=mrx-batch&customerId={GuidHelper.ToGuidString(amendment.CustomerId)}&weekStartDate={amendment.WeekStartDate:yyyy-MM-dd}&amendmentId={GuidHelper.ToGuidString(amendment.MenuAmendmentId)}",
                    amendment.CreatedAt, "MANAGER", "OWN_ACTION"));
        }

        if (canSeeWarehouse)
        {
            var transferred = scopedBatches.Where(row => row.Batch.Status == "TRANSFERRED");
            awaitingWarehouse = await transferred.CountAsync(token);
            queueCounts["AWAITING_WAREHOUSE"] = awaitingWarehouse.Value;
            foreach (var row in await transferred.OrderBy(row => row.Batch.CreatedAt).ThenBy(row => row.Batch.BatchId).Skip(queueSkip).Take(queuePage.PageSize).ToListAsync(token))
                items.Add(new("AWAITING_WAREHOUSE", GuidHelper.ToGuidString(row.Batch.BatchId), "Chờ Kho xuất nguyên liệu",
                    $"Tuần {row.WeekStartDate:dd/MM/yyyy}",
                    canIssue ? $"/warehouse?view=mrx-daily&batchId={GuidHelper.ToGuidString(row.Batch.BatchId)}" : null,
                    row.Batch.CreatedAt, "WAREHOUSE", canIssue ? "OWN_ACTION" : "WAITING"));
        }

        if (canIssue || canDecide)
        {
            var deltas = from delta in context.Reconciliationsourcedeltas.AsNoTracking()
                join row in scopedBatches on delta.BatchId equals row.Batch.BatchId
                where delta.Status == "PENDING"
                select delta;
            pendingDeltas = await deltas.CountAsync(token);
            queueCounts["PENDING_DELTA"] = pendingDeltas.Value;
            foreach (var delta in await deltas.OrderBy(d => d.CreatedAt).ThenBy(d => d.SourceDeltaId).Skip(queueSkip).Take(queuePage.PageSize).ToListAsync(token))
                items.Add(new("PENDING_DELTA", GuidHelper.ToGuidString(delta.SourceDeltaId), "Biến động nguồn lịch sử",
                    $"Ngày {delta.ServiceDate:dd/MM/yyyy}", null,
                    delta.CreatedAt, "WAREHOUSE", "READ_ONLY"));
        }

        if (canDecide)
        {
            unresolvedVariances = 0;
            completionReady = 0;
            queueCounts["UNRESOLVED_VARIANCE"] = 0;
            queueCounts["COMPLETION_READY"] = 0;
            var activeQuery = scopedBatches.Where(row => row.Batch.Status == "IN_PROGRESS");
            // Bound the daily projection while keeping ordinary hundred-batch scopes in one bulk read.
            const int summaryChunkSize = 128;
            var activeCount = await activeQuery.CountAsync(token);
            for (var offset = 0; offset < activeCount; offset += summaryChunkSize)
            {
              var activeBatches = await activeQuery.OrderBy(row => row.Batch.CreatedAt).ThenBy(row => row.Batch.BatchId)
                  .Skip(offset).Take(summaryChunkSize).ToListAsync(token);
              var dailyByBatch = await batchService.GetWarehouseDailyManyAsync(activeBatches.Select(row => GuidHelper.ToGuidString(row.Batch.BatchId)).ToList(), token, includeMetadata: false);
              foreach (var row in activeBatches)
              {
                if (!dailyByBatch.TryGetValue(GuidHelper.ToGuidString(row.Batch.BatchId), out var daily)) continue;
                var overages = daily.Dates.SelectMany(d => d.Lines).Count(l => l.QuantityStatus == "OVER_ISSUED" && !l.HasValidDisposition);
                unresolvedVariances += overages;
                if (overages > 0) queueCounts["UNRESOLVED_VARIANCE"] += 1;
                if (overages > 0 && queueCounts["UNRESOLVED_VARIANCE"] > queueSkip && items.Count(i => i.QueueType == "UNRESOLVED_VARIANCE") < queuePage.PageSize)
                    items.Add(new("UNRESOLVED_VARIANCE", GuidHelper.ToGuidString(row.Batch.BatchId), $"Còn {overages} dòng xuất vượt cần xử lý",
                        $"Tuần {row.WeekStartDate:dd/MM/yyyy}", $"/reconciliation?batchId={GuidHelper.ToGuidString(row.Batch.BatchId)}",
                        row.Batch.CreatedAt, "MANAGER", "OWN_ACTION"));
                if (daily.WeeklyStatus != "WEEK_COMPLETE" || overages > 0) continue;
                completionReady += 1;
                queueCounts["COMPLETION_READY"] += 1;
                if (queueCounts["COMPLETION_READY"] > queueSkip && items.Count(i => i.QueueType == "COMPLETION_READY") < queuePage.PageSize)
                    items.Add(new("COMPLETION_READY", GuidHelper.ToGuidString(row.Batch.BatchId), "Lô sẵn sàng chốt tuần",
                        $"Tuần {row.WeekStartDate:dd/MM/yyyy}", $"/reconciliation?batchId={GuidHelper.ToGuidString(row.Batch.BatchId)}",
                        row.Batch.CreatedAt, "MANAGER", "OWN_ACTION"));
              }
            }
        }

        var customerOptions = await context.Customers.AsNoTracking()
            .Where(customer => (canReadSource && customer.IsActive != false)
                || context.Menuversions.Any(menu => menu.CustomerId == customer.CustomerId
                    && context.Reconciliationbatches.Any(batch => batch.MenuVersionId == menu.MenuVersionId)))
            .OrderBy(customer => customer.CustomerCode)
            .Select(customer => new MrxCustomerOptionDto(GuidHelper.ToGuidString(customer.CustomerId), customer.CustomerCode, customer.CustomerName))
            .ToListAsync(token);
        return new(pendingChanges, awaitingWarehouse, pendingDeltas, unresolvedVariances, completionReady, items, customerOptions)
        { QueuePageNumber = queuePage.PageNumber, QueuePageSize = queuePage.PageSize, QueueCounts = queueCounts };
    }

    public async Task<PagedResponseDto<MrxTransactionHistoryRowDto>> GetTransactionsHistoryAsync(
        string? batchId,
        DateOnly? fromDate,
        DateOnly? toDate,
        PagedRequestDto page,
        CancellationToken token = default)
    {
        EnsureReconciliationMode();
        ValidateTransactionDates(fromDate, toDate);
        var parsedBatchId = string.IsNullOrWhiteSpace(batchId) ? null : ReconciliationBatchService.RequiredId(batchId);
        return await new MrxTransactionHistoryQuery(context).GetPageAsync(parsedBatchId, fromDate, toDate, page, token);
    }

    public async IAsyncEnumerable<MrxTransactionHistoryRowDto> StreamTransactionsHistoryExportAsync(
        string? batchId,
        DateOnly? fromDate,
        DateOnly? toDate,
        [EnumeratorCancellation] CancellationToken token = default)
    {
        EnsureReconciliationMode();
        ValidateTransactionDates(fromDate, toDate);
        var parsedBatchId = string.IsNullOrWhiteSpace(batchId) ? null : ReconciliationBatchService.RequiredId(batchId);
        await using var exportContext = MrxReportExportContext.Create(context);
        await foreach (var row in new MrxTransactionHistoryQuery(exportContext)
                           .StreamAsync(parsedBatchId, fromDate, toDate, token)
                           .WithCancellation(token))
        {
            yield return row;
        }
    }

    private static void ValidateTransactionDates(DateOnly? fromDate, DateOnly? toDate)
    {
        if (fromDate is not null && toDate is not null && fromDate > toDate)
            throw new ArgumentException("Ngày bắt đầu không được sau ngày kết thúc.");
    }

    public async Task<MrxVarianceRegisterReportDto> GetVarianceRegisterAsync(
        string? batchId,
        DateOnly? weekStartDate,
        CancellationToken token = default,
        int? maximumDailyLines = null)
    {
        EnsureReconciliationMode();

        var query = context.Reconciliationbatchdailylines.AsNoTracking()
            .Include(d => d.BatchLine).ThenInclude(bl => bl.Ingredient)
            .Include(d => d.BatchLine).ThenInclude(bl => bl.CanonicalUnit)
            .Include(d => d.BatchLine).ThenInclude(bl => bl.Batch)
            .Where(d => d.RequiredQuantity > 0);

        if (!string.IsNullOrWhiteSpace(batchId))
        {
            var bBytes = ReconciliationBatchService.RequiredId(batchId);
            query = query.Where(d => d.BatchId == bBytes);
        }

        if (weekStartDate is not null)
        {
            var end = weekStartDate.Value.AddDays(ServiceCalendar.ServiceDaysPerWeek - 1);
            query = query.Where(d => d.ServiceDate >= weekStartDate.Value && d.ServiceDate <= end);
        }

        query = query.OrderBy(d => d.ServiceDate).ThenBy(d => d.DailyLineId);
        if (maximumDailyLines is int limit) query = query.Take(limit + 1);
        var dailyLines = await query.ToListAsync(token);
        if (maximumDailyLines is int maximum && dailyLines.Count > maximum)
            throw new BusinessRuleException($"Báo cáo vượt giới hạn {maximum} dòng nguồn. Hãy chọn lô hoặc tuần hẹp hơn rồi tải lại.");
        if (dailyLines.Count == 0)
        {
            return new MrxVarianceRegisterReportDto([], 0);
        }

        var dailyIds = dailyLines.Select(d => d.DailyLineId).ToList();

        var dailyDispositions = await context.Reconciliationdailydispositions.AsNoTracking()
            .Where(disp => disp.InvalidatedAt == null && dailyIds.Contains(disp.DailyLineId))
            .ToDictionaryAsync(disp => Convert.ToHexString(disp.DailyLineId), StringComparer.Ordinal, token);
        var disposedUsers = await LoadUserNamesByIdsAsync(
            dailyDispositions.Values.Select(disp => disp.DisposedBy).ToList(), token);

        var issueNotes = await new MrxIssueNoteQuery(context).LoadAsync(
            dailyLines.Select(line => line.BatchLineId).Distinct(ByteArrayComparer.Instance).ToList(), token);
        var auditNotes = issueNotes.Where(note => note.DailyLineId != null)
            .GroupBy(note => GuidHelper.ToGuidString(note.DailyLineId!))
            .ToDictionary(group => group.Key, group => (IReadOnlyList<string>)group.Select(note => note.Reason).ToList(), StringComparer.Ordinal);

        var netIssues = await new ReconciliationNetIssueProjection(context)
            .LoadByDailyLineIdsAsync(dailyIds, token);

        var contributorShifts = await context.Reconciliationbatchcontributors.AsNoTracking()
            .Where(c => c.InvalidatedAt == null && c.DailyLineId != null && dailyIds.Contains(c.DailyLineId))
            .OrderBy(c => c.ContributorId)
            .Select(c => new { c.DailyLineId, c.FrozenShiftName })
            .ToListAsync(token);
        var shiftNameByDailyHex = new Dictionary<string, string>(StringComparer.Ordinal);
        foreach (var cs in contributorShifts)
        {
            if (cs.DailyLineId is not null && !string.IsNullOrWhiteSpace(cs.FrozenShiftName))
            {
                var key = Convert.ToHexString(cs.DailyLineId);
                shiftNameByDailyHex[key] = shiftNameByDailyHex.TryGetValue(key, out var previous)
                    && !string.Equals(previous, cs.FrozenShiftName, StringComparison.Ordinal)
                        ? "Cả ngày"
                        : cs.FrozenShiftName;
            }
        }

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
            if (!netIssues.TryGetValue(dHex, out var netIssue)) continue;
            var issued = netIssue.NetIssuedQuantity;
            var diff = DecimalPolicy.RoundQuantity(issued - d.RequiredQuantity);

            if (diff == 0) continue; // Only variances!

            dailyDispositions.TryGetValue(dHex, out var disp);
            var notes = auditNotes.GetValueOrDefault(GuidHelper.ToGuidString(d.DailyLineId)) ?? [];

            var shiftName = shiftNameByDailyHex.GetValueOrDefault(dHex, "Cả ngày");

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
                disp?.DisposedBy is null
                    ? null
                    : disposedUsers.GetValueOrDefault(Convert.ToHexString(disp.DisposedBy)) ?? GuidHelper.ToGuidString(disp.DisposedBy),
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
                Csv(MrxReportWorkbookExporter.VarianceTypeLabel(r.VarianceType)),
                Csv(MrxReportWorkbookExporter.DispositionCategoryLabel(r.DispositionCategory)),
                Csv(r.DispositionReason),
                Csv(r.DisposedBy),
                r.DisposedAt?.ToString("yyyy-MM-dd HH:mm:ss", CultureInfo.InvariantCulture) ?? "",
                Csv(string.Join("; ", r.IssueNotes))).Append("\r\n");
        }
        return Encoding.UTF8.GetPreamble().Concat(Encoding.UTF8.GetBytes(csv.ToString())).ToArray();
    }

    public Task<MrxCompletedRegisterReportDto> GetCompletedRegisterAsync(PagedRequestDto page, CancellationToken token = default)
        => GetCompletedRegisterCoreAsync(page, null, new(), token);

    public Task<MrxCompletedRegisterReportDto> GetCompletedRegisterAsync(PagedRequestDto page, MrxHistoricalScopeQuery scope, CancellationToken token = default)
        => GetCompletedRegisterCoreAsync(page, null, scope, token);

    public async IAsyncEnumerable<MrxCompletedRegisterRowDto> StreamCompletedRegisterExportAsync(
        [System.Runtime.CompilerServices.EnumeratorCancellation] CancellationToken token = default)
    {
        await foreach (var row in StreamCompletedRegisterExportAsync(new MrxHistoricalScopeQuery(), token)) yield return row;
    }

    public async IAsyncEnumerable<MrxCompletedRegisterRowDto> StreamCompletedRegisterExportAsync(
        MrxHistoricalScopeQuery scope,
        [System.Runtime.CompilerServices.EnumeratorCancellation] CancellationToken token = default)
    {
        var cutoff = DateTime.UtcNow;
        for (var number = 1; ; number++)
        {
            var page = await GetCompletedRegisterCoreAsync(new PagedRequestDto { PageNumber = number, PageSize = 100 }, cutoff, scope, token);
            foreach (var row in page.Rows) { token.ThrowIfCancellationRequested(); yield return row; }
            if (page.Rows.Count < 100) yield break;
        }
    }

    private async Task<MrxCompletedRegisterReportDto> GetCompletedRegisterCoreAsync(
        PagedRequestDto page, DateTime? cutoff, MrxHistoricalScopeQuery scope, CancellationToken token)
    {
        EnsureReconciliationMode();

        if (scope.WeekFrom is not null && scope.WeekTo is not null && scope.WeekFrom > scope.WeekTo)
            throw new BusinessRuleException("Ngày bắt đầu không được sau ngày kết thúc.");
        var customerId = string.IsNullOrWhiteSpace(scope.CustomerId) ? null : ReconciliationBatchService.RequiredId(scope.CustomerId);

        var query = context.Reconciliationbatches.AsNoTracking()
            .Include(b => b.Lines).ThenInclude(line => line.CanonicalUnit)
            .Where(b => b.Status == "COMPLETED")
            .Where(b => cutoff == null || (b.CreatedAt <= cutoff && (b.CompletedAt == null || b.CompletedAt <= cutoff)));
        if (customerId is not null || scope.WeekFrom is not null || scope.WeekTo is not null)
            query = query.Where(batch => context.Menuversions.Any(menu => menu.MenuVersionId == batch.MenuVersionId
                && (customerId == null || menu.CustomerId == customerId)
                && (scope.WeekFrom == null || menu.WeekStartDate >= scope.WeekFrom)
                && (scope.WeekTo == null || menu.WeekStartDate <= scope.WeekTo)));

        var total = await query.CountAsync(token);
        var batches = await query
            .OrderByDescending(b => b.CompletedAt).ThenBy(b => b.BatchId)
            .Skip((page.PageNumber - 1) * page.PageSize)
            .Take(page.PageSize)
            .ToListAsync(token);

        var batchIds = batches.Select(batch => batch.BatchId).ToList();
        var dailyLines = await context.Reconciliationbatchdailylines.AsNoTracking()
            .Where(line => batchIds.Contains(line.BatchId))
            .Select(line => new { line.BatchId, line.DailyLineId, line.RequiredQuantity })
            .ToListAsync(token);
        var dailyIds = dailyLines.Select(line => line.DailyLineId).ToList();
        var netIssues = await new ReconciliationNetIssueProjection(context)
            .LoadByDailyLineIdsAsync(dailyIds, token);
        var dailyLinesByBatch = dailyLines
            .GroupBy(line => Convert.ToHexString(line.BatchId), StringComparer.Ordinal)
            .ToDictionary(
                group => group.Key,
                group => group.ToList(),
                StringComparer.Ordinal);

        var menuVersionIds = batches.Select(b => b.MenuVersionId).Distinct(ByteArrayComparer.Instance).ToList();
        var menuVersions = await context.Menuversions.AsNoTracking()
            .Include(mv => mv.Customer)
            .Where(mv => menuVersionIds.Contains(mv.MenuVersionId))
            .ToDictionaryAsync(mv => Convert.ToHexString(mv.MenuVersionId), StringComparer.Ordinal, token);

        var users = await LoadUserNamesByIdsAsync(
            batches.Where(b => b.CompletedBy != null).Select(b => b.CompletedBy!).ToList(), token);

        var rows = new List<MrxCompletedRegisterRowDto>();

        foreach (var b in batches)
        {
            var mvHex = Convert.ToHexString(b.MenuVersionId);
            menuVersions.TryGetValue(mvHex, out var mv);

            var totalReq = b.Lines.Sum(l => l.RequiredQuantity);
            dailyLinesByBatch.TryGetValue(Convert.ToHexString(b.BatchId), out var batchDailyLines);
            decimal? totalIss = null;
            if (batchDailyLines is { Count: > 0 }
                && batchDailyLines.Sum(line => line.RequiredQuantity) == totalReq
                && batchDailyLines.All(line => line.RequiredQuantity <= 0
                    || netIssues.ContainsKey(Convert.ToHexString(line.DailyLineId))))
            {
                totalIss = batchDailyLines.Sum(line =>
                    netIssues.TryGetValue(Convert.ToHexString(line.DailyLineId), out var netIssue)
                        ? netIssue.NetIssuedQuantity : 0m);
            }
            var diff = totalIss is { } issued
                ? DecimalPolicy.RoundQuantity(issued - totalReq)
                : (decimal?)null;

            var completedByName = "—";
            if (b.CompletedBy is not null)
            {
                var userHex = Convert.ToHexString(b.CompletedBy);
                completedByName = users.TryGetValue(userHex, out var name)
                    ? name
                    : GuidHelper.ToGuidString(b.CompletedBy);
            }

            var weekStart = mv?.WeekStartDate ?? DateOnly.FromDateTime(b.CreatedAt);
            rows.Add(new MrxCompletedRegisterRowDto(
                GuidHelper.ToGuidString(b.BatchId),
                mv?.Customer?.CustomerName ?? "Khách hàng",
                weekStart,
                weekStart.AddDays(ServiceCalendar.ServiceDaysPerWeek - 1),
                completedByName,
                b.CompletedAt ?? DateTime.UtcNow,
                b.Version,
                b.Lines.Count,
                totalReq,
                totalIss,
                diff)
            {
                QuantityUnitName = b.Lines.Select(line => Convert.ToHexString(line.CanonicalUnitId)).Distinct().Count() == 1
                    ? b.Lines.First().CanonicalUnit.UnitName : null
            });
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
                r.TotalIssued is { } issued ? Number(issued) : "",
                r.TotalVariance is { } variance ? Number(variance) : "").Append("\r\n");
        }
        return Encoding.UTF8.GetPreamble().Concat(Encoding.UTF8.GetBytes(csv.ToString())).ToArray();
    }

    public async Task<MrxAuditTrailReportDto> GetAuditTrailAsync(
        string? batchId, PagedRequestDto page, CancellationToken token = default)
    {
        EnsureReconciliationMode();
        var parsedBatchId = string.IsNullOrWhiteSpace(batchId) ? null : ReconciliationBatchService.RequiredId(batchId);
        var query = await MrxAuditSearch.ApplyAsync(context, await BuildAuditTrailQueryAsync(parsedBatchId, token), page.SearchKeyword, token);
        var total = await query.CountAsync(token);
        var logs = await query.OrderByDescending(a => a.ChangedAt)
            .Skip((page.PageNumber - 1) * page.PageSize).Take(page.PageSize).ToListAsync(token);
        var actorNames = await LoadAuditActorNamesAsync(logs, token);
        return new MrxAuditTrailReportDto(MapAuditRows(logs, actorNames), total);
    }

    public async IAsyncEnumerable<MrxAuditTrailRowDto> StreamAuditTrailExportAsync(
        string? batchId,
        [EnumeratorCancellation] CancellationToken token = default)
    {
        EnsureReconciliationMode();
        var parsedBatchId = string.IsNullOrWhiteSpace(batchId) ? null : ReconciliationBatchService.RequiredId(batchId);
        await using var exportContext = MrxReportExportContext.Create(context);
        var scoped = await new MrxAuditScopeQuery(exportContext).ApplyScopedAsync(exportContext.Auditlogs.AsNoTracking(), parsedBatchId, token);
        var query = scoped
            .OrderByDescending(audit => audit.ChangedAt)
            .Select(audit => new
            {
                Audit = audit,
                ActorName = exportContext.Users
                    .Where(user => user.UserId == audit.ChangedBy)
                    .Select(user => user.FullName ?? user.Username)
                    .FirstOrDefault()
            });

        await foreach (var row in query.AsAsyncEnumerable().WithCancellation(token))
        {
            yield return MapAuditRow(row.Audit, row.ActorName);
        }
    }

    private Task<IQueryable<AuditLog>> BuildAuditTrailQueryAsync(byte[]? batchId, CancellationToken token) =>
        new MrxAuditScopeQuery(context).ApplyScopedAsync(context.Auditlogs.AsNoTracking(), batchId, token);

    private Task<IReadOnlyDictionary<string, string>> LoadAuditActorNamesAsync(
        IReadOnlyCollection<AuditLog> logs,
        CancellationToken token) =>
        LoadUserNamesByIdsAsync(logs.Select(log => log.ChangedBy).ToList(), token);

    private async Task<IReadOnlyDictionary<string, string>> LoadUserNamesByIdsAsync(
        IReadOnlyCollection<byte[]> userIds,
        CancellationToken token)
    {
        var distinctIds = userIds.Distinct(ByteArrayComparer.Instance).ToList();
        if (distinctIds.Count == 0)
            return new Dictionary<string, string>(StringComparer.Ordinal);
        var users = string.Equals(context.Database.ProviderName, "Microsoft.EntityFrameworkCore.InMemory", StringComparison.Ordinal)
            ? (await context.Users.AsNoTracking().ToListAsync(token))
                .Where(user => distinctIds.Any(id => id.AsSpan().SequenceEqual(user.UserId))).ToList()
            : await context.Users.AsNoTracking().Where(user => distinctIds.Contains(user.UserId)).ToListAsync(token);
        return users.ToDictionary(
            user => Convert.ToHexString(user.UserId),
            user => user.FullName ?? user.Username,
            StringComparer.Ordinal);
    }

    private static IReadOnlyList<MrxAuditTrailRowDto> MapAuditRows(
        IReadOnlyList<AuditLog> logs, IReadOnlyDictionary<string, string> actorNames) =>
        logs.Select(audit => MapAuditRow(
            audit,
            actorNames.GetValueOrDefault(Convert.ToHexString(audit.ChangedBy)))).ToList();

    private static MrxAuditTrailRowDto MapAuditRow(AuditLog audit, string? actorName) =>
        new(
            GuidHelper.ToGuidString(audit.AuditId),
            audit.ChangedAt,
            actorName ?? GuidHelper.ToGuidString(audit.ChangedBy),
            audit.BusinessArea,
            audit.EntityName,
            audit.EntityId is null ? "—" : GuidHelper.ToGuidString(audit.EntityId),
            audit.FieldName,
            audit.OldValue,
            audit.NewValue,
            audit.Reason);

    private void EnsureReconciliationMode()
    {
        if (requestContext is not null && !string.Equals(requestContext.Mode, SystemOperationEligibility.MaterialReconciliation, StringComparison.Ordinal))
        {
            throw new BusinessRuleException("Báo cáo đối soát chỉ hoạt động trong chế độ đối chiếu nguyên liệu.");
        }
    }

    private static string Csv(string? value) => MrxReportCsvStreamWriter.Csv(value);
    private static string Number(decimal value) => value.ToString("0.######", CultureInfo.InvariantCulture);

    private sealed class ByteArrayComparer : IEqualityComparer<byte[]>
    {
        public static readonly ByteArrayComparer Instance = new();
        public bool Equals(byte[]? x, byte[]? y) => System.Collections.StructuralComparisons.StructuralEqualityComparer.Equals(x, y);
        public int GetHashCode(byte[] obj) => System.Collections.StructuralComparisons.StructuralEqualityComparer.GetHashCode(obj);
    }
}
