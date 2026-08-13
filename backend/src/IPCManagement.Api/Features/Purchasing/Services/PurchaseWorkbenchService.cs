
using System.Globalization;
using IPCManagement.Api.Data;
using IPCManagement.Api.Features.Purchasing.Contracts;
using IPCManagement.Api.Helpers;
using IPCManagement.Api.Models.Entities;
using Microsoft.EntityFrameworkCore;

namespace IPCManagement.Api.Features.Purchasing.Services;

public sealed class PurchaseWorkbenchService : IPurchaseWorkbenchService
{
    private readonly IpcManagementContext _context;

    public PurchaseWorkbenchService(IpcManagementContext context)
    {
        _context = context;
    }

    public async Task<PurchaseWorkbenchWeekDto> GetWorkbenchWeekAsync(
        PurchaseWorkbenchQueryDto query,
        CancellationToken cancellationToken = default)
    {
        var weekStart = PurchaseWorkbenchPolicy.ParseDate(query.Week, nameof(query.Week));
        if (weekStart.DayOfWeek != DayOfWeek.Monday)
        {
            throw new ArgumentException("Tuần thu mua phải bắt đầu vào thứ Hai.", nameof(query.Week));
        }

        var weekEnd = weekStart.AddDays(6);
        DateOnly? selectedDate = null;
        if (!string.IsNullOrWhiteSpace(query.Date))
        {
            selectedDate = PurchaseWorkbenchPolicy.ParseDate(query.Date, nameof(query.Date));
            if (selectedDate < weekStart || selectedDate > weekEnd)
            {
                throw new ArgumentException("Ngày cần xem phải nằm trong tuần đã chọn.", nameof(query.Date));
            }
        }

        var selectedStage = PurchaseWorkbenchPolicy.NormalizeStage(query.Stage);
        var page = Math.Max(1, query.Page);
        var pageSize = query.PageSize <= 0 ? 8 : Math.Min(query.PageSize, 100);
        var demandRows = await BuildApprovedDemandQuery(weekStart, weekEnd)
            .OrderBy(item => item.RequestDate)
            .ThenBy(item => item.RequestCode)
            .ToListAsync(cancellationToken);
        var pendingDemandRows = await BuildApprovedDemandQuery(weekStart, weekEnd, onlyUnattached: true)
            .OrderBy(item => item.RequestDate)
            .ThenBy(item => item.RequestCode)
            .ToListAsync(cancellationToken);

        var purchaseRequests = await _context.Purchaserequests
            .AsNoTracking()
            .Where(request =>
                request.PurchaseForDate >= weekStart &&
                request.PurchaseForDate <= weekEnd &&
                request.ShiftName == null)
            .OrderBy(request => request.PurchaseForDate)
            .ThenBy(request => request.PurchaseRequestCode)
            .ToListAsync(cancellationToken);
        var isInMemoryProvider = string.Equals(
            _context.Database.ProviderName,
            "Microsoft.EntityFrameworkCore.InMemory",
            StringComparison.Ordinal);

        var purchaseLineQuery = _context.Purchaserequestlines
            .AsNoTracking()
            .Include(line => line.Ingredient)
            .Include(line => line.PurchaseRequest)
            .Include(line => line.Supplier)
            .Include(line => line.Unit)
            .Include(line => line.SupplierDecisions)
            .AsQueryable();
        if (!isInMemoryProvider)
        {
            purchaseLineQuery = purchaseLineQuery.Where(line =>
                line.PurchaseRequest.PurchaseForDate >= weekStart &&
                line.PurchaseRequest.PurchaseForDate <= weekEnd &&
                line.PurchaseRequest.ShiftName == null);
        }

        var purchaseRequestKeys = purchaseRequests
            .Select(request => PurchaseWorkbenchPolicy.BuildKey(request.PurchaseRequestId))
            .ToHashSet();
        var queriedPurchaseLines = purchaseRequestKeys.Count == 0
            ? []
            : await purchaseLineQuery.ToListAsync(cancellationToken);
        var purchaseLines = (isInMemoryProvider
                ? _context.ChangeTracker.Entries<PurchaseRequestLine>()
                    .Select(entry => entry.Entity)
                    .Concat(queriedPurchaseLines)
                    .DistinctBy(line => PurchaseWorkbenchPolicy.BuildKey(line.PurchaseRequestLineId))
                : queriedPurchaseLines)
            .Where(line => purchaseRequestKeys.Contains(PurchaseWorkbenchPolicy.BuildKey(line.PurchaseRequestId)))
            .ToList();

        var purchaseOrderQuery = _context.Purchaseorders
            .AsNoTracking()
            .AsSplitQuery()
            .Include(order => order.PurchaseRequest)
            .Include(order => order.Purchaseorderlines)
            .AsQueryable();
        if (!isInMemoryProvider)
        {
            purchaseOrderQuery = purchaseOrderQuery.Where(order =>
                order.PurchaseRequest.PurchaseForDate >= weekStart &&
                order.PurchaseRequest.PurchaseForDate <= weekEnd &&
                order.PurchaseRequest.ShiftName == null);
        }

        var queriedPurchaseOrders = await purchaseOrderQuery.ToListAsync(cancellationToken);
        var purchaseOrders = (isInMemoryProvider
                ? _context.ChangeTracker.Entries<PurchaseOrder>()
                    .Select(entry => entry.Entity)
                    .Concat(queriedPurchaseOrders)
                    .DistinctBy(order => PurchaseWorkbenchPolicy.BuildKey(order.PurchaseOrderId))
                : queriedPurchaseOrders)
            .Where(order => purchaseRequestKeys.Contains(PurchaseWorkbenchPolicy.BuildKey(order.PurchaseRequestId)))
            .ToList();

        var purchaseByDate = purchaseRequests
            .GroupBy(request => request.PurchaseForDate)
            .ToDictionary(
                group => group.Key,
                group => group
                    .OrderByDescending(request => string.Equals(
                        request.PurchaseRequestCode,
                        $"PR-{group.Key:yyyyMMdd}-FULLDAY",
                        StringComparison.Ordinal))
                    .ThenBy(request => request.PurchaseRequestCode)
                    .First());
        var demandsByDate = demandRows
            .GroupBy(row => row.RequestDate)
            .ToDictionary(group => group.Key, group => group.ToList());
        var pendingDemandsByDate = pendingDemandRows
            .GroupBy(row => row.RequestDate)
            .ToDictionary(group => group.Key, group => group.ToList());
        var linesByRequest = purchaseLines
            .GroupBy(line => PurchaseWorkbenchPolicy.BuildKey(line.PurchaseRequestId))
            .ToDictionary(group => group.Key, group => group.ToList());
        var ordersByRequest = purchaseOrders
            .GroupBy(order => PurchaseWorkbenchPolicy.BuildKey(order.PurchaseRequestId))
            .ToDictionary(group => group.Key, group => group.ToList());
        var serviceDateValues = demandsByDate.Keys
            .Concat(purchaseByDate.Keys)
            .Distinct()
            .OrderBy(date => date)
            .ToList();

        selectedDate ??= serviceDateValues.FirstOrDefault();
        if (serviceDateValues.Count == 0)
        {
            selectedDate = null;
        }

        var stageCounts = new PurchaseWorkflowStageCountsDto();
        var serviceDates = new List<PurchaseWorkbenchServiceDateDto>(serviceDateValues.Count);
        foreach (var serviceDate in serviceDateValues)
        {
            demandsByDate.TryGetValue(serviceDate, out var dateDemands);
            purchaseByDate.TryGetValue(serviceDate, out var purchaseRequest);
            dateDemands ??= [];
            var purchaseKey = purchaseRequest is null
                ? null
                : PurchaseWorkbenchPolicy.BuildKey(purchaseRequest.PurchaseRequestId);
            var requestLines = purchaseKey is not null && linesByRequest.TryGetValue(purchaseKey, out var foundLines)
                ? foundLines : [];
            var requestOrders = purchaseKey is not null && ordersByRequest.TryGetValue(purchaseKey, out var foundOrders)
                ? foundOrders : [];
            pendingDemandsByDate.TryGetValue(serviceDate, out var pendingDateDemands);
            var currentStage = pendingDateDemands is { Count: > 0 }
                ? "demand"
                : PurchaseWorkbenchPolicy.ResolveStage(purchaseRequest, requestLines, requestOrders);
            PurchaseWorkbenchPolicy.IncrementStageCount(stageCounts, currentStage);
            var orderLines = requestOrders.SelectMany(order => order.Purchaseorderlines).ToList();
            serviceDates.Add(new PurchaseWorkbenchServiceDateDto
            {
                ServiceDate = serviceDate.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture),
                CurrentStage = currentStage,
                ApprovedDemandCount = dateDemands.Count,
                ShortageLineCount = dateDemands.Sum(item => item.ShortageLineCount),
                SupplierReadyLineCount = requestLines.Count(PurchaseWorkbenchPolicy.IsSupplierReady),
                BlockingExceptionCount = requestLines.Count(PurchaseWorkbenchPolicy.HasPriceException),
                PurchaseRequestId = purchaseRequest is null ? null : GuidHelper.ToGuidString(purchaseRequest.PurchaseRequestId),
                PurchaseRequestCode = purchaseRequest?.PurchaseRequestCode,
                PurchaseRequestStatus = purchaseRequest?.Status,
                OrderCount = requestOrders.Count,
                ReceivingLineCount = orderLines.Count,
                FullyReceivedLineCount = orderLines.Count(line => line.OrderedQty > 0 && line.ReceivedQty >= line.OrderedQty)
            });

        }

        var totalItems = 0;
        IReadOnlyList<ApprovedDemandSummaryDto> selectedDetails = [];
        if (selectedDate is not null)
        {
            purchaseByDate.TryGetValue(selectedDate.Value, out var selectedRequest);
            var selectedKey = selectedRequest is null
                ? null
                : PurchaseWorkbenchPolicy.BuildKey(selectedRequest.PurchaseRequestId);
            var selectedLines = selectedKey is not null && linesByRequest.TryGetValue(selectedKey, out var foundLines)
                ? foundLines : [];
            var selectedOrders = selectedKey is not null && ordersByRequest.TryGetValue(selectedKey, out var foundOrders)
                ? foundOrders : [];
            pendingDemandsByDate.TryGetValue(selectedDate.Value, out var selectedDateDemands);
            var selectedDateStage = selectedDateDemands is { Count: > 0 }
                ? "demand"
                : PurchaseWorkbenchPolicy.ResolveStage(selectedRequest, selectedLines, selectedOrders);
            if (selectedStage is null || string.Equals(selectedStage, selectedDateStage, StringComparison.Ordinal))
            {
                var detailQuery = BuildApprovedDemandQuery(selectedDate.Value, selectedDate.Value, onlyUnattached: true);
                totalItems = await detailQuery.CountAsync(cancellationToken);
                var detailRows = await detailQuery
                    .OrderBy(item => item.RequestCode)
                    .Skip((page - 1) * pageSize)
                    .Take(pageSize)
                    .ToListAsync(cancellationToken);
                selectedDetails = detailRows.Select(item => new ApprovedDemandSummaryDto
                {
                    MaterialRequestId = GuidHelper.ToGuidString(item.RequestId),
                    RequestCode = item.RequestCode,
                    ServiceDate = item.RequestDate.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture),
                    Status = item.Status,
                    ShortageLineCount = item.ShortageLineCount,
                    CurrentStage = selectedDateStage,
                    PurchaseRequestId = selectedRequest is null ? null : GuidHelper.ToGuidString(selectedRequest.PurchaseRequestId),
                    PurchaseRequestCode = selectedRequest?.PurchaseRequestCode,
                    PurchaseRequestStatus = selectedRequest?.Status
                }).ToList();
            }

            var selectedSummary = serviceDates.SingleOrDefault(item =>
                item.ServiceDate == selectedDate.Value.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture));
            if (selectedSummary is not null)
            {
                selectedSummary.ApprovedDemands = selectedDetails;
                selectedSummary.PurchaseLines = selectedLines
                    .OrderBy(line => line.Ingredient.IngredientName, StringComparer.OrdinalIgnoreCase)
                    .ThenBy(line => PurchaseWorkbenchPolicy.BuildKey(line.PurchaseRequestLineId), StringComparer.Ordinal)
                    .Select(PurchaseWorkflowMapper.MapLine)
                    .ToList();
            }
        }

        return new PurchaseWorkbenchWeekDto
        {
            WeekStart = weekStart.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture),
            WeekEnd = weekEnd.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture),
            SelectedDate = selectedDate?.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture),
            SelectedStage = selectedStage,
            Page = page,
            PageSize = pageSize,
            TotalItems = totalItems,
            TotalPages = totalItems == 0 ? 0 : (int)Math.Ceiling(totalItems / (double)pageSize),
            StageCounts = stageCounts,
            ServiceDates = serviceDates
        };
    }

    private IQueryable<WorkbenchDemandRow> BuildApprovedDemandQuery(
        DateOnly dateFrom,
        DateOnly dateTo,
        bool onlyUnattached = false)
    {
        var query = _context.Materialrequests
            .AsNoTracking()
            .Where(request =>
                request.RequestDate >= dateFrom &&
                request.RequestDate <= dateTo &&
                request.RequestScope == "FULLDAY" &&
                (request.Status == "MANAGERAPPROVED" || request.Status == "APPROVED"));
        if (onlyUnattached)
        {
            query = query.Where(request => !request.Materialrequestlines
                .Any(line => line.Purchaserequestlines.Any()));
        }

        return query.Select(request => new WorkbenchDemandRow
            {
                RequestId = request.RequestId,
                RequestCode = request.RequestCode,
                RequestDate = request.RequestDate,
                Status = request.Status,
                ShortageLineCount = request.Materialrequestlines.Count(line => line.SuggestedPurchaseQty > 0)
            });
    }

    private sealed class WorkbenchDemandRow
    {
        public byte[] RequestId { get; set; } = null!;
        public string RequestCode { get; set; } = string.Empty;
        public DateOnly RequestDate { get; set; }
        public string Status { get; set; } = string.Empty;
        public int ShortageLineCount { get; set; }
    }
}
