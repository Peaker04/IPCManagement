using IPCManagement.Api.Data;
using IPCManagement.Api.Helpers;
using IPCManagement.Api.Models.DTOs.Workflow;
using IPCManagement.Api.Models.Entities;
using IPCManagement.Api.Services;
using Microsoft.EntityFrameworkCore;
using System.Globalization;

namespace IPCManagement.Api.Services.Workflow;

public class PurchaseRequestWorkflowService : IPurchaseRequestWorkflowService
{
    private const string PurchaseDraftStatus = "DRAFT";
    private const string PurchaseSubmittedStatus = "SENTTOSUPPLIER";
    private static readonly HashSet<string> ApprovedDemandStatuses = new(StringComparer.OrdinalIgnoreCase)
    {
        "MANAGERAPPROVED",
        "APPROVED"
    };
    private static readonly HashSet<string> WorkbenchStages = new(StringComparer.Ordinal)
    {
        "demand",
        "supplier-price",
        "exception",
        "submitted",
        "approved-order",
        "receiving"
    };

    private readonly IpcManagementContext _context;
    private readonly ISupplierQuotationService _supplierQuotationService;

    public PurchaseRequestWorkflowService(IpcManagementContext context, ISupplierQuotationService supplierQuotationService)
    {
        _context = context;
        _supplierQuotationService = supplierQuotationService;
    }

    public async Task<PurchaseWorkbenchWeekDto> GetWorkbenchWeekAsync(
        PurchaseWorkbenchQueryDto query,
        CancellationToken cancellationToken = default)
    {
        var weekStart = ParseWorkbenchDate(query.Week, nameof(query.Week));
        if (weekStart.DayOfWeek != DayOfWeek.Monday)
        {
            throw new ArgumentException("Tuần thu mua phải bắt đầu vào thứ Hai.", nameof(query.Week));
        }

        var weekEnd = weekStart.AddDays(6);
        DateOnly? selectedDate = null;
        if (!string.IsNullOrWhiteSpace(query.Date))
        {
            selectedDate = ParseWorkbenchDate(query.Date, nameof(query.Date));
            if (selectedDate < weekStart || selectedDate > weekEnd)
            {
                throw new ArgumentException("Ngày cần xem phải nằm trong tuần đã chọn.", nameof(query.Date));
            }
        }

        var selectedStage = NormalizeWorkbenchStage(query.Stage);
        var page = Math.Max(1, query.Page);
        var pageSize = query.PageSize <= 0 ? 8 : Math.Min(query.PageSize, 100);

        var demandRows = await BuildApprovedWorkbenchDemandQuery(weekStart, weekEnd)
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
            .AsQueryable();
        if (!isInMemoryProvider)
        {
            purchaseLineQuery = purchaseLineQuery.Where(line =>
                line.PurchaseRequest.PurchaseForDate >= weekStart &&
                line.PurchaseRequest.PurchaseForDate <= weekEnd &&
                line.PurchaseRequest.ShiftName == null);
        }

        var purchaseRequestKeys = purchaseRequests
            .Select(request => BuildKey(request.PurchaseRequestId))
            .ToHashSet();
        var queriedPurchaseLines = await purchaseLineQuery.ToListAsync(cancellationToken);
        var purchaseLines = (isInMemoryProvider
                ? _context.ChangeTracker.Entries<Purchaserequestline>()
                    .Select(entry => entry.Entity)
                    .Concat(queriedPurchaseLines)
                    .DistinctBy(line => BuildKey(line.PurchaseRequestLineId))
                : queriedPurchaseLines)
            .Where(line => purchaseRequestKeys.Contains(BuildKey(line.PurchaseRequestId)))
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
                ? _context.ChangeTracker.Entries<Purchaseorder>()
                    .Select(entry => entry.Entity)
                    .Concat(queriedPurchaseOrders)
                    .DistinctBy(order => BuildKey(order.PurchaseOrderId))
                : queriedPurchaseOrders)
            .Where(order => purchaseRequestKeys.Contains(BuildKey(order.PurchaseRequestId)))
            .ToList();

        var purchaseByDate = purchaseRequests
            .GroupBy(request => request.PurchaseForDate)
            .ToDictionary(
                group => group.Key,
                group => group
                    .OrderByDescending(request =>
                        string.Equals(
                            request.PurchaseRequestCode,
                            $"PR-{group.Key:yyyyMMdd}-FULLDAY",
                            StringComparison.Ordinal))
                    .ThenBy(request => request.PurchaseRequestCode)
                    .First());
        var demandsByDate = demandRows
            .GroupBy(row => row.RequestDate)
            .ToDictionary(group => group.Key, group => group.ToList());
        var linesByRequest = purchaseLines
            .GroupBy(line => BuildKey(line.PurchaseRequestId))
            .ToDictionary(group => group.Key, group => group.ToList());
        var ordersByRequest = purchaseOrders
            .GroupBy(order => BuildKey(order.PurchaseRequestId))
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
            var purchaseKey = purchaseRequest is null ? null : BuildKey(purchaseRequest.PurchaseRequestId);
            var purchaseRequestLines = purchaseKey is not null && linesByRequest.TryGetValue(purchaseKey, out var foundLines)
                ? foundLines
                : [];
            var purchaseRequestOrders = purchaseKey is not null && ordersByRequest.TryGetValue(purchaseKey, out var foundOrders)
                ? foundOrders
                : [];
            var currentStage = ResolveWorkbenchStage(
                purchaseRequest,
                purchaseRequestLines,
                purchaseRequestOrders);
            IncrementWorkbenchStageCount(stageCounts, currentStage);

            var orderLines = purchaseRequestOrders
                .SelectMany(order => order.Purchaseorderlines)
                .ToList();
            serviceDates.Add(new PurchaseWorkbenchServiceDateDto
            {
                ServiceDate = serviceDate.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture),
                CurrentStage = currentStage,
                ApprovedDemandCount = dateDemands.Count,
                ShortageLineCount = dateDemands.Sum(item => item.ShortageLineCount),
                SupplierReadyLineCount = purchaseRequestLines.Count(IsSupplierReady),
                BlockingExceptionCount = purchaseRequestLines.Count(HasPriceException),
                PurchaseRequestId = purchaseRequest is null
                    ? null
                    : GuidHelper.ToGuidString(purchaseRequest.PurchaseRequestId),
                PurchaseRequestCode = purchaseRequest?.PurchaseRequestCode,
                PurchaseRequestStatus = purchaseRequest?.Status,
                OrderCount = purchaseRequestOrders.Count,
                ReceivingLineCount = orderLines.Count,
                FullyReceivedLineCount = orderLines.Count(line =>
                    line.OrderedQty > 0 && line.ReceivedQty >= line.OrderedQty)
            });
        }

        var totalItems = 0;
        IReadOnlyList<ApprovedDemandSummaryDto> selectedDetails = [];
        if (selectedDate is not null)
        {
            purchaseByDate.TryGetValue(selectedDate.Value, out var selectedPurchaseRequest);
            var selectedPurchaseKey = selectedPurchaseRequest is null
                ? null
                : BuildKey(selectedPurchaseRequest.PurchaseRequestId);
            var selectedLines = selectedPurchaseKey is not null && linesByRequest.TryGetValue(selectedPurchaseKey, out var foundSelectedLines)
                ? foundSelectedLines
                : [];
            var selectedOrders = selectedPurchaseKey is not null && ordersByRequest.TryGetValue(selectedPurchaseKey, out var foundSelectedOrders)
                ? foundSelectedOrders
                : [];
            var selectedDateStage = ResolveWorkbenchStage(
                selectedPurchaseRequest,
                selectedLines,
                selectedOrders);
            if (selectedStage is null || string.Equals(selectedStage, selectedDateStage, StringComparison.Ordinal))
            {
                var detailQuery = BuildApprovedWorkbenchDemandQuery(selectedDate.Value, selectedDate.Value);
                totalItems = await detailQuery.CountAsync(cancellationToken);
                var detailRows = await detailQuery
                    .OrderBy(item => item.RequestCode)
                    .Skip((page - 1) * pageSize)
                    .Take(pageSize)
                    .ToListAsync(cancellationToken);
                selectedDetails = detailRows
                    .Select(item => new ApprovedDemandSummaryDto
                    {
                        MaterialRequestId = GuidHelper.ToGuidString(item.RequestId),
                        RequestCode = item.RequestCode,
                        ServiceDate = item.RequestDate.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture),
                        Status = item.Status,
                        ShortageLineCount = item.ShortageLineCount,
                        CurrentStage = selectedDateStage,
                        PurchaseRequestId = selectedPurchaseRequest is null
                            ? null
                            : GuidHelper.ToGuidString(selectedPurchaseRequest.PurchaseRequestId),
                        PurchaseRequestCode = selectedPurchaseRequest?.PurchaseRequestCode,
                        PurchaseRequestStatus = selectedPurchaseRequest?.Status
                    })
                    .ToList();
            }

            var selectedDateText = selectedDate.Value.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture);
            var selectedDateSummary = serviceDates.SingleOrDefault(item => item.ServiceDate == selectedDateText);
            if (selectedDateSummary is not null)
            {
                selectedDateSummary.ApprovedDemands = selectedDetails;
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

    public async Task<PurchaseRequestWorkflowResultDto?> GenerateFromDemandAsync(
        GeneratePurchaseRequestFromDemandDto request,
        string? userId,
        CancellationToken cancellationToken = default)
    {
        var userIdBytes = GuidHelper.ParseGuidString(userId);
        var materialRequestId = GuidHelper.ParseGuidString(request.MaterialRequestId);
        if (userIdBytes is null || materialRequestId is null)
        {
            return null;
        }

        var materialRequest = await _context.Materialrequests.FindAsync(
            new object[] { materialRequestId },
            cancellationToken);
        if (materialRequest is null)
        {
            return null;
        }

        await _context.Entry(materialRequest)
            .Collection(item => item.Materialrequestlines)
            .Query()
            .Include(line => line.Ingredient)
            .Include(line => line.Unit)
            .LoadAsync(cancellationToken);
        await _context.Entry(materialRequest)
            .Reference(item => item.Plan)
            .LoadAsync(cancellationToken);

        await ValidateApprovedDemandEligibilityAsync(materialRequest, cancellationToken);

        var shortageLines = materialRequest.Materialrequestlines
            .Where(line => PurchaseRequestPlanner.CalculatePurchaseQty(line.SuggestedPurchaseQty) > 0)
            .OrderBy(line => line.Ingredient.IngredientName)
            .ToList();
        if (shortageLines.Count == 0)
        {
            return await ClearStalePurchaseRequestAsync(materialRequest, userIdBytes, cancellationToken);
        }

        var purchaseRequest = await EnsurePurchaseRequestAsync(materialRequest, userIdBytes, cancellationToken);
        var existingLines = purchaseRequest.Purchaserequestlines.ToList();
        if (purchaseRequest.Status == PurchaseSubmittedStatus)
        {
            return MapResult(purchaseRequest, materialRequest.RequestId, existingLines);
        }

        foreach (var line in shortageLines)
        {
            EnsurePurchaseRequestLine(purchaseRequest, line, existingLines);
        }

        var shortageLineIds = shortageLines
            .Select(line => BuildKey(line.RequestLineId))
            .ToHashSet();
        var staleLines = existingLines
            .Where(line => !shortageLineIds.Contains(BuildKey(line.MaterialRequestLineId)))
            .ToList();
        if (staleLines.Count > 0)
        {
            _context.Purchaserequestlines.RemoveRange(staleLines);
            existingLines.RemoveAll(line => staleLines.Any(stale => stale.PurchaseRequestLineId.SequenceEqual(line.PurchaseRequestLineId)));
        }

        _context.Auditlogs.Add(new Auditlog
        {
            AuditId = GuidHelper.NewId(),
            ChangedAt = DateTime.UtcNow,
            ChangedBy = userIdBytes,
            BusinessArea = "Purchasing",
            EntityName = nameof(Purchaserequest),
            EntityId = purchaseRequest.PurchaseRequestId,
            FieldName = "GenerateFromDemand",
            OldValue = null,
            NewValue = $"{shortageLines.Count} shortage lines; {existingLines.Count} purchase lines",
            Reason = "Sinh đề xuất mua hàng từ dòng thiếu nguyên liệu sau kiểm tồn."
        });

        await _context.SaveChangesAsync(cancellationToken);

        return MapResult(purchaseRequest, materialRequest.RequestId, existingLines);
    }

    private async Task<PurchaseRequestWorkflowResultDto?> ClearStalePurchaseRequestAsync(
        Materialrequest materialRequest,
        byte[] userId,
        CancellationToken cancellationToken)
    {
        var requestCode = BuildPurchaseRequestCode(materialRequest);
        var purchaseRequest = await _context.Purchaserequests
            .Include(item => item.Purchaserequestlines)
                .ThenInclude(line => line.Ingredient)
            .Include(item => item.Purchaserequestlines)
                .ThenInclude(line => line.Supplier)
            .Include(item => item.Purchaserequestlines)
                .ThenInclude(line => line.Unit)
            .FirstOrDefaultAsync(item => item.PurchaseRequestCode == requestCode, cancellationToken);
        if (purchaseRequest is null)
        {
            return null;
        }

        if (purchaseRequest.Status == PurchaseSubmittedStatus)
        {
            return MapResult(purchaseRequest, materialRequest.RequestId, purchaseRequest.Purchaserequestlines);
        }

        var staleCount = purchaseRequest.Purchaserequestlines.Count;
        if (staleCount > 0)
        {
            _context.Purchaserequestlines.RemoveRange(purchaseRequest.Purchaserequestlines);
        }

        purchaseRequest.Status = purchaseRequest.Status == PurchaseSubmittedStatus ? purchaseRequest.Status : PurchaseDraftStatus;
        _context.Auditlogs.Add(new Auditlog
        {
            AuditId = GuidHelper.NewId(),
            ChangedAt = DateTime.UtcNow,
            ChangedBy = userId,
            BusinessArea = "Purchasing",
            EntityName = nameof(Purchaserequest),
            EntityId = purchaseRequest.PurchaseRequestId,
            FieldName = "GenerateFromDemand",
            OldValue = $"{staleCount} stale purchase lines",
            NewValue = "0 shortage lines; 0 purchase lines",
            Reason = "Dọn đề xuất mua hàng cũ vì nhu cầu hiện tại không còn thiếu nguyên liệu."
        });

        await _context.SaveChangesAsync(cancellationToken);

        return MapResult(purchaseRequest, materialRequest.RequestId, []);
    }

    public async Task UpdateLineSupplierAsync(
        string requestId,
        string lineId,
        UpdatePurchaseRequestLineSupplierDto request,
        string? userId,
        CancellationToken cancellationToken = default)
    {
        var prIdBytes = GuidHelper.ParseGuidString(requestId);
        var prLineIdBytes = GuidHelper.ParseGuidString(lineId);
        var supplierIdBytes = GuidHelper.ParseGuidString(request.SupplierId);
        var userIdBytes = GuidHelper.ParseGuidString(userId);

        if (prIdBytes is null || prLineIdBytes is null || supplierIdBytes is null || userIdBytes is null)
        {
            throw new ArgumentException("Mã tham chiếu không hợp lệ.");
        }

        DateOnly? expectedDeliveryDate = null;
        if (!string.IsNullOrWhiteSpace(request.ExpectedDeliveryDate))
        {
            if (!DateOnly.TryParse(request.ExpectedDeliveryDate, out var parsedDeliveryDate))
            {
                throw new ArgumentException("Ngày giao dự kiến không hợp lệ.");
            }

            expectedDeliveryDate = parsedDeliveryDate;
        }

        var pr = await _context.Purchaserequests
            .Include(x => x.Purchaserequestlines)
            .FirstOrDefaultAsync(x => x.PurchaseRequestId == prIdBytes, cancellationToken);

        if (pr is null)
        {
            throw new KeyNotFoundException("Không tìm thấy Purchase Request.");
        }

        if (pr.Status != PurchaseDraftStatus)
        {
            throw new InvalidOperationException("Chỉ được đổi nhà cung cấp khi Đề xuất mua ở trạng thái DRAFT.");
        }

        var line = pr.Purchaserequestlines.FirstOrDefault(x => x.PurchaseRequestLineId.SequenceEqual(prLineIdBytes));
        if (line is null)
        {
            throw new KeyNotFoundException("Không tìm thấy dòng nguyên liệu trong Purchase Request.");
        }

        var supplierExists = await _context.Suppliers.AnyAsync(s => s.SupplierId == supplierIdBytes && s.IsActive != false, cancellationToken);
        if (!supplierExists)
        {
            throw new KeyNotFoundException("Nhà cung cấp không tồn tại hoặc đã bị khóa.");
        }

        var oldValue = BuildPurchaseLineAuditValue(line);
        line.SupplierId = supplierIdBytes;
        line.EstimatedUnitPrice = DecimalPolicy.RoundMoney(request.EstimatedUnitPrice);
        line.ExpectedDeliveryDate = expectedDeliveryDate;
        line.Note = string.IsNullOrWhiteSpace(request.Note) ? null : request.Note.Trim();

        _context.Auditlogs.Add(new Auditlog
        {
            AuditId = GuidHelper.NewId(),
            ChangedAt = DateTime.UtcNow,
            ChangedBy = userIdBytes,
            BusinessArea = "Purchasing",
            EntityName = nameof(Purchaserequestline),
            EntityId = line.PurchaseRequestLineId,
            FieldName = "SupplierPriceDelivery",
            OldValue = oldValue,
            NewValue = BuildPurchaseLineAuditValue(line),
            Reason = "Cập nhật nhà cung cấp, giá dự kiến, ngày giao và ghi chú dòng mua."
        });

        await _context.SaveChangesAsync(cancellationToken);
    }

    public async Task<PurchaseRequestWorkflowResultDto?> SubmitAsync(
        string requestId,
        string? userId,
        CancellationToken cancellationToken = default)
    {
        var prIdBytes = GuidHelper.ParseGuidString(requestId);
        var userIdBytes = GuidHelper.ParseGuidString(userId);
        if (prIdBytes is null || userIdBytes is null)
        {
            throw new ArgumentException("Mã tham chiếu không hợp lệ.");
        }

        var purchaseRequest = await _context.Purchaserequests
            .Include(item => item.Purchaserequestlines)
                .ThenInclude(line => line.Ingredient)
            .Include(item => item.Purchaserequestlines)
                .ThenInclude(line => line.Supplier)
            .Include(item => item.Purchaserequestlines)
                .ThenInclude(line => line.Unit)
            .Include(item => item.Purchaserequestlines)
                .ThenInclude(line => line.MaterialRequestLine)
            .FirstOrDefaultAsync(item => item.PurchaseRequestId == prIdBytes, cancellationToken);
        if (purchaseRequest is null)
        {
            return null;
        }

        var materialRequest = await ResolveMaterialRequestForSubmitAsync(purchaseRequest, cancellationToken);
        await ValidateSubmitAsync(purchaseRequest, materialRequest, cancellationToken);

        if (purchaseRequest.Status == PurchaseSubmittedStatus)
        {
            return MapResult(purchaseRequest, materialRequest.RequestId, purchaseRequest.Purchaserequestlines);
        }

        if (purchaseRequest.Status != PurchaseDraftStatus)
        {
            throw new InvalidOperationException("Chỉ được gửi đơn mua khi danh sách còn ở trạng thái nháp.");
        }

        var oldStatus = purchaseRequest.Status;
        purchaseRequest.Status = PurchaseSubmittedStatus;
        _context.Auditlogs.Add(new Auditlog
        {
            AuditId = GuidHelper.NewId(),
            ChangedAt = DateTime.UtcNow,
            ChangedBy = userIdBytes,
            BusinessArea = "Purchasing",
            EntityName = nameof(Purchaserequest),
            EntityId = purchaseRequest.PurchaseRequestId,
            FieldName = "Submit",
            OldValue = oldStatus,
            NewValue = PurchaseSubmittedStatus,
            Reason = "Gửi đơn mua chính thức từ nhu cầu đã duyệt."
        });

        await _context.SaveChangesAsync(cancellationToken);

        return MapResult(purchaseRequest, materialRequest.RequestId, purchaseRequest.Purchaserequestlines);
    }

    private static string BuildPurchaseLineAuditValue(Purchaserequestline line)
        => $"supplier={(line.SupplierId is null ? "-" : GuidHelper.ToGuidString(line.SupplierId))}; price={DecimalPolicy.RoundMoney(line.EstimatedUnitPrice)}; delivery={line.ExpectedDeliveryDate?.ToString("yyyy-MM-dd") ?? "-"}; note={line.Note ?? "-"}";

    private async Task<Purchaserequest> EnsurePurchaseRequestAsync(
        Materialrequest materialRequest,
        byte[] userId,
        CancellationToken cancellationToken)
    {
        var requestCode = BuildPurchaseRequestCode(materialRequest);
        var existing = await _context.Purchaserequests
            .Include(item => item.Purchaserequestlines)
                .ThenInclude(line => line.Ingredient)
            .Include(item => item.Purchaserequestlines)
                .ThenInclude(line => line.Supplier)
            .Include(item => item.Purchaserequestlines)
                .ThenInclude(line => line.Unit)
            .FirstOrDefaultAsync(item => item.PurchaseRequestCode == requestCode, cancellationToken);
        if (existing is not null)
        {
            existing.Status = existing.Status == PurchaseSubmittedStatus ? existing.Status : PurchaseDraftStatus;
            return existing;
        }

        var purchaseRequest = new Purchaserequest
        {
            PurchaseRequestId = GuidHelper.NewId(),
            PurchaseRequestCode = requestCode,
            RequestDate = DateOnly.FromDateTime(DateTime.UtcNow),
            PurchaseForDate = materialRequest.RequestDate,
            ShiftName = materialRequest.RequestScope == "FULLDAY" ? null : materialRequest.RequestScope,
            Status = PurchaseDraftStatus,
            CreatedBy = userId
        };

        _context.Purchaserequests.Add(purchaseRequest);
        return purchaseRequest;
    }

    private static decimal ResolveLatestReceiptPrice(Inventoryreceiptline? latestReceiptLine, Unit targetUnit)
    {
        if (latestReceiptLine is null || latestReceiptLine.UnitPrice <= 0)
        {
            return 0m;
        }

        if (latestReceiptLine.UnitId.SequenceEqual(targetUnit.UnitId))
        {
            return latestReceiptLine.UnitPrice;
        }

        if (!CanConvertUnits(latestReceiptLine.Unit, targetUnit))
        {
            return 0m;
        }

        return DecimalPolicy.RoundMoney(latestReceiptLine.UnitPrice * targetUnit.ConvertRateToBase / latestReceiptLine.Unit.ConvertRateToBase);
    }

    private static bool CanConvertUnits(Unit sourceUnit, Unit targetUnit)
    {
        if (sourceUnit.UnitId.SequenceEqual(targetUnit.UnitId))
        {
            return true;
        }

        return sourceUnit.ConvertRateToBase > 0 &&
               targetUnit.ConvertRateToBase > 0 &&
               string.Equals(NormalizedBaseUnitCode(sourceUnit), NormalizedBaseUnitCode(targetUnit), StringComparison.OrdinalIgnoreCase);
    }

    private static string NormalizedBaseUnitCode(Unit unit)
        => string.IsNullOrWhiteSpace(unit.BaseUnitCode)
            ? unit.UnitCode.Trim().ToUpperInvariant()
            : unit.BaseUnitCode.Trim().ToUpperInvariant();

    private void EnsurePurchaseRequestLine(
        Purchaserequest purchaseRequest,
        Materialrequestline materialLine,
        List<Purchaserequestline> existingLines)
    {
        var purchaseQty = PurchaseRequestPlanner.CalculatePurchaseQty(materialLine.SuggestedPurchaseQty);
        var requiredQty = DecimalPolicy.RoundQuantity(materialLine.TotalRequiredQty);
        var currentStockQty = DecimalPolicy.RoundQuantity(materialLine.CurrentStockQty);
        var existing = existingLines.FirstOrDefault(line =>
            line.MaterialRequestLineId.SequenceEqual(materialLine.RequestLineId));
        if (existing is not null)
        {
            existing.IngredientId = materialLine.IngredientId;
            existing.UnitId = materialLine.UnitId;
            existing.RequiredQty = requiredQty;
            existing.CurrentStockQty = currentStockQty;
            existing.PurchaseQty = purchaseQty;
            existing.Ingredient = materialLine.Ingredient;
            existing.Unit = materialLine.Unit;
            return;
        }

        var line = new Purchaserequestline
        {
            PurchaseRequestLineId = GuidHelper.NewId(),
            PurchaseRequestId = purchaseRequest.PurchaseRequestId,
            MaterialRequestLineId = materialLine.RequestLineId,
            IngredientId = materialLine.IngredientId,
            SupplierId = null,
            UnitId = materialLine.UnitId,
            RequiredQty = requiredQty,
            CurrentStockQty = currentStockQty,
            PurchaseQty = purchaseQty,
            EstimatedUnitPrice = 0,
            PurchaseRequest = purchaseRequest,
            Ingredient = materialLine.Ingredient,
            Unit = materialLine.Unit
        };

        _context.Purchaserequestlines.Add(line);
        existingLines.Add(line);
    }

    private static string BuildPurchaseRequestCode(Materialrequest materialRequest)
    {
        var shiftSegment = materialRequest.RequestScope == "FULLDAY" ? "FULLDAY" : materialRequest.RequestScope;
        return $"PR-{materialRequest.RequestDate:yyyyMMdd}-{shiftSegment}";
    }

    private async Task ValidateApprovedDemandEligibilityAsync(
        Materialrequest materialRequest,
        CancellationToken cancellationToken)
    {
        if (!ApprovedDemandStatuses.Contains(materialRequest.Status))
        {
            throw new InvalidOperationException("Cần duyệt nhu cầu nguyên liệu trước khi tạo đề xuất mua.");
        }

        if (!string.Equals(materialRequest.RequestScope, "FULLDAY", StringComparison.OrdinalIgnoreCase))
        {
            throw new InvalidOperationException("Đề xuất mua chỉ được tạo cho nhu cầu Cả ngày (FULLDAY).");
        }

        var requestCode = BuildPurchaseRequestCode(materialRequest);
        var existing = await _context.Purchaserequests
            .AsNoTracking()
            .Include(request => request.Purchaserequestlines)
            .FirstOrDefaultAsync(request => request.PurchaseRequestCode == requestCode, cancellationToken);
        if (existing is null)
        {
            return;
        }

        var currentDemandLineIds = materialRequest.Materialrequestlines
            .Select(line => BuildKey(line.RequestLineId))
            .ToHashSet();
        var belongsToCurrentDemand = existing.Purchaserequestlines.Count == 0 ||
            existing.Purchaserequestlines.All(line =>
                currentDemandLineIds.Contains(BuildKey(line.MaterialRequestLineId)));
        if (existing.PurchaseForDate != materialRequest.RequestDate ||
            existing.ShiftName is not null ||
            !belongsToCurrentDemand)
        {
            throw new InvalidOperationException("Nhu cầu nguyên liệu đã cũ hoặc không khớp với đề xuất mua hiện tại.");
        }
    }

    private IQueryable<WorkbenchDemandRow> BuildApprovedWorkbenchDemandQuery(
        DateOnly dateFrom,
        DateOnly dateTo)
        => _context.Materialrequests
            .AsNoTracking()
            .Where(request =>
                request.RequestDate >= dateFrom &&
                request.RequestDate <= dateTo &&
                request.RequestScope == "FULLDAY" &&
                (request.Status == "MANAGERAPPROVED" || request.Status == "APPROVED"))
            .Select(request => new WorkbenchDemandRow
            {
                RequestId = request.RequestId,
                RequestCode = request.RequestCode,
                RequestDate = request.RequestDate,
                Status = request.Status,
                ShortageLineCount = request.Materialrequestlines.Count(line => line.SuggestedPurchaseQty > 0)
            });

    private static DateOnly ParseWorkbenchDate(string? value, string parameterName)
    {
        if (!DateOnly.TryParseExact(
                value,
                "yyyy-MM-dd",
                CultureInfo.InvariantCulture,
                DateTimeStyles.None,
                out var parsed))
        {
            throw new ArgumentException("Ngày phải có định dạng yyyy-MM-dd.", parameterName);
        }

        return parsed;
    }

    private static string? NormalizeWorkbenchStage(string? stage)
    {
        if (string.IsNullOrWhiteSpace(stage))
        {
            return null;
        }

        var normalized = stage.Trim().ToLowerInvariant();
        if (!WorkbenchStages.Contains(normalized))
        {
            throw new ArgumentException("Giai đoạn thu mua không hợp lệ.", nameof(stage));
        }

        return normalized;
    }

    private static string ResolveWorkbenchStage(
        Purchaserequest? request,
        IReadOnlyCollection<Purchaserequestline> lines,
        IReadOnlyCollection<Purchaseorder> orders)
    {
        if (request is null)
        {
            return "demand";
        }

        if (orders.Count > 0)
        {
            return "receiving";
        }

        if (string.Equals(request.Status, "APPROVED", StringComparison.OrdinalIgnoreCase))
        {
            return "approved-order";
        }

        if (string.Equals(request.Status, PurchaseSubmittedStatus, StringComparison.OrdinalIgnoreCase))
        {
            return "submitted";
        }

        return lines.Any(HasPriceException)
            ? "exception"
            : "supplier-price";
    }

    private static bool IsSupplierReady(Purchaserequestline line)
        => line.SupplierId is not null &&
           line.EstimatedUnitPrice > 0 &&
           line.ExpectedDeliveryDate is not null;

    private static bool HasPriceException(Purchaserequestline line)
    {
        if (line.SupplierId is null || line.EstimatedUnitPrice <= 0 || line.Ingredient.ReferencePrice <= 0)
        {
            return false;
        }

        var variance = WorkflowReportCalculator.CalculateVariancePercent(
            DecimalPolicy.RoundMoney(line.Ingredient.ReferencePrice),
            DecimalPolicy.RoundMoney(line.EstimatedUnitPrice));
        return variance > 15m;
    }

    private static void IncrementWorkbenchStageCount(
        PurchaseWorkflowStageCountsDto counts,
        string stage)
    {
        switch (stage)
        {
            case "demand":
                counts.Demand++;
                break;
            case "supplier-price":
                counts.SupplierPrice++;
                break;
            case "exception":
                counts.Exception++;
                break;
            case "submitted":
                counts.SubmittedRequest++;
                break;
            case "approved-order":
                counts.ApprovedOrder++;
                break;
            case "receiving":
                counts.ReceivingProgress++;
                break;
        }
    }

    private static string BuildKey(byte[] value)
        => Convert.ToBase64String(value);

    private async Task<Materialrequest> ResolveMaterialRequestForSubmitAsync(
        Purchaserequest purchaseRequest,
        CancellationToken cancellationToken)
    {
        if (purchaseRequest.Purchaserequestlines.Count == 0)
        {
            throw new InvalidOperationException("Danh sách mua chưa có dòng nguyên liệu hợp lệ.");
        }

        if (purchaseRequest.Purchaserequestlines.Any(line => line.MaterialRequestLine is null))
        {
            throw new InvalidOperationException("Danh sách mua đã cũ, vui lòng tạo lại từ nhu cầu hiện tại.");
        }

        var requestIds = purchaseRequest.Purchaserequestlines
            .Select(line => BuildKey(line.MaterialRequestLine.RequestId))
            .Distinct()
            .ToList();
        if (requestIds.Count != 1)
        {
            throw new InvalidOperationException("Danh sách mua đã cũ, vui lòng tạo lại từ nhu cầu hiện tại.");
        }

        var requestId = purchaseRequest.Purchaserequestlines.First().MaterialRequestLine.RequestId;
        var materialRequest = await _context.Materialrequests
            .Include(item => item.Materialrequestlines)
            .FirstOrDefaultAsync(item => item.RequestId == requestId, cancellationToken);

        return materialRequest
            ?? throw new InvalidOperationException("Danh sách mua đã cũ, vui lòng tạo lại từ nhu cầu hiện tại.");
    }

    private async Task ValidateSubmitAsync(
        Purchaserequest purchaseRequest,
        Materialrequest materialRequest,
        CancellationToken cancellationToken)
    {
        if (!ApprovedDemandStatuses.Contains(materialRequest.Status))
        {
            throw new InvalidOperationException("Cần duyệt nhu cầu nguyên liệu trước khi gửi đơn mua.");
        }

        var currentShortageLineIds = materialRequest.Materialrequestlines
            .Where(line => PurchaseRequestPlanner.CalculatePurchaseQty(line.SuggestedPurchaseQty) > 0)
            .Select(line => BuildKey(line.RequestLineId))
            .ToHashSet();
        var purchaseLineDemandIds = purchaseRequest.Purchaserequestlines
            .Select(line => BuildKey(line.MaterialRequestLineId))
            .ToHashSet();
        if (!currentShortageLineIds.SetEquals(purchaseLineDemandIds))
        {
            throw new InvalidOperationException("Danh sách mua đã cũ, vui lòng tạo lại từ nhu cầu hiện tại.");
        }

        foreach (var line in purchaseRequest.Purchaserequestlines)
        {
            if (line.SupplierId is null || line.Supplier is null || line.Supplier.IsActive == false)
            {
                throw new InvalidOperationException("Có dòng mua chưa chọn nhà cung cấp hợp lệ.");
            }

            if (line.PurchaseQty <= 0 || line.EstimatedUnitPrice <= 0)
            {
                throw new InvalidOperationException("Có dòng mua thiếu số lượng hoặc giá dự kiến hợp lệ.");
            }

            var referencePrice = await ResolveReferencePriceAsync(line, cancellationToken);
            var variance = WorkflowReportCalculator.CalculateVariancePercent(referencePrice, line.EstimatedUnitPrice);
            if (WorkflowReportCalculator.IsPriceIncreaseWarning(variance))
            {
                throw new InvalidOperationException("Có dòng mua vượt ngưỡng giá, cần xử lý cảnh báo trước khi gửi đơn mua.");
            }
        }
    }

    private async Task<decimal> ResolveReferencePriceAsync(
        Purchaserequestline line,
        CancellationToken cancellationToken)
    {
        if (line.SupplierId is null)
        {
            throw new InvalidOperationException("Có dòng mua chưa chọn nhà cung cấp hợp lệ.");
        }

        var latestReceiptPrice = await _context.Inventoryreceiptlines
            .AsNoTracking()
            .Include(item => item.Receipt)
            .Where(item =>
                item.IngredientId.SequenceEqual(line.IngredientId) &&
                item.Receipt.SupplierId.SequenceEqual(line.SupplierId) &&
                item.UnitId.SequenceEqual(line.UnitId) &&
                item.UnitPrice > 0)
            .OrderByDescending(item => item.Receipt.ReceiptDate)
            .Select(item => item.UnitPrice)
            .FirstOrDefaultAsync(cancellationToken);

        return latestReceiptPrice > 0 ? latestReceiptPrice : DecimalPolicy.RoundMoney(line.Ingredient.ReferencePrice);
    }

    private static PurchaseRequestWorkflowResultDto MapResult(
        Purchaserequest purchaseRequest,
        byte[] materialRequestId,
        IEnumerable<Purchaserequestline> lines)
        => new()
        {
            PurchaseRequestId = GuidHelper.ToGuidString(purchaseRequest.PurchaseRequestId),
            PurchaseRequestCode = purchaseRequest.PurchaseRequestCode,
            MaterialRequestId = GuidHelper.ToGuidString(materialRequestId),
            PurchaseForDate = purchaseRequest.PurchaseForDate.ToString("yyyy-MM-dd"),
            ShiftName = purchaseRequest.ShiftName,
            Status = purchaseRequest.Status,
            Lines = lines
                .OrderBy(line => line.Ingredient.IngredientName)
                .Select(MapLine)
                .ToList()
        };

    private static PurchaseRequestWorkflowLineDto MapLine(Purchaserequestline line)
        => new()
        {
            PurchaseRequestLineId = GuidHelper.ToGuidString(line.PurchaseRequestLineId),
            MaterialRequestLineId = GuidHelper.ToGuidString(line.MaterialRequestLineId),
            IngredientId = GuidHelper.ToGuidString(line.IngredientId),
            IngredientName = line.Ingredient.IngredientName,
            SupplierId = line.SupplierId is null ? null : GuidHelper.ToGuidString(line.SupplierId),
            SupplierName = line.Supplier?.SupplierName,
            UnitId = GuidHelper.ToGuidString(line.UnitId),
            UnitName = line.Unit.UnitName,
            RequiredQty = line.RequiredQty,
            CurrentStockQty = line.CurrentStockQty,
            PurchaseQty = line.PurchaseQty,
            EstimatedUnitPrice = line.EstimatedUnitPrice,
            ExpectedDeliveryDate = line.ExpectedDeliveryDate?.ToString("yyyy-MM-dd"),
            Note = line.Note
        };

    private sealed class WorkbenchDemandRow
    {
        public byte[] RequestId { get; set; } = null!;
        public string RequestCode { get; set; } = string.Empty;
        public DateOnly RequestDate { get; set; }
        public string Status { get; set; } = string.Empty;
        public int ShortageLineCount { get; set; }
    }
}
