using IPCManagement.Api.Data;
using IPCManagement.Api.Helpers;
using IPCManagement.Api.Models.DTOs.Workflow;
using IPCManagement.Api.Models.DTOs.Common;
using IPCManagement.Api.Models.Entities;
using IPCManagement.Api.Services;
using Microsoft.EntityFrameworkCore;
using System.Collections.Concurrent;
using System.Data;
using System.Security.Cryptography;
using System.Text;

namespace IPCManagement.Api.Services.Workflow;

public class PurchaseOrderService : IPurchaseOrderService
{
    private const string StatusOrdered = "ORDERED";
    private const string StatusPartiallyReceived = "PARTIALLY_RECEIVED";
    private const string StatusReceived = "RECEIVED";
    private const string StatusCancelled = "CANCELLED";
    private static readonly ConcurrentDictionary<string, SemaphoreSlim> InMemoryRequestLocks = new(StringComparer.Ordinal);

    private readonly IpcManagementContext _context;
    private readonly IStockLedgerService _stockLedgerService;

    public PurchaseOrderService(IpcManagementContext context, IStockLedgerService stockLedgerService)
    {
        _context = context;
        _stockLedgerService = stockLedgerService;
    }

    public async Task<IReadOnlyList<PurchaseOrderDto>> CreateFromApprovedRequestAsync(
        string purchaseRequestId,
        string? userId,
        CancellationToken cancellationToken = default)
    {
        var purchaseRequestIdBytes = GuidHelper.ParseGuidString(purchaseRequestId)
            ?? throw new ArgumentException("Đề xuất mua hàng không hợp lệ.");
        var userIdBytes = GuidHelper.ParseGuidString(userId)
            ?? throw new ArgumentException("Không xác định được người tạo đơn mua hàng.");

        SemaphoreSlim? inMemoryLock = null;
        if (IsInMemoryProvider())
        {
            inMemoryLock = InMemoryRequestLocks.GetOrAdd(
                Convert.ToHexString(purchaseRequestIdBytes),
                static _ => new SemaphoreSlim(1, 1));
            await inMemoryLock.WaitAsync(cancellationToken);
        }

        try
        {
            return await GetOrCreateOrdersForApprovedRequestAsync(
                purchaseRequestIdBytes,
                userIdBytes,
                cancellationToken);
        }
        catch (DbUpdateException exception) when (exception is not DbUpdateConcurrencyException)
        {
            _context.ChangeTracker.Clear();
            var source = await LoadPurchaseRequestForOrdersAsync(purchaseRequestIdBytes, cancellationToken)
                ?? throw new KeyNotFoundException("Không tìm thấy đề xuất mua hàng.");
            var expectedLines = ValidateCurrentOrderDecisions(source.Lines);
            var establishedOrders = await LoadOrdersForRequestAsync(purchaseRequestIdBytes, cancellationToken);
            if (establishedOrders.Count == 0)
            {
                throw;
            }

            ValidateEstablishedOrders(establishedOrders, expectedLines, exception);
            return establishedOrders.Select(MapToDto).ToList();
        }
        finally
        {
            inMemoryLock?.Release();
        }
    }

    private async Task<IReadOnlyList<PurchaseOrderDto>> GetOrCreateOrdersForApprovedRequestAsync(
        byte[] purchaseRequestId,
        byte[] userId,
        CancellationToken cancellationToken)
    {
        await using var transaction = _context.Database.IsRelational()
            ? await _context.Database.BeginTransactionAsync(IsolationLevel.Serializable, cancellationToken)
            : null;

        var source = await LoadPurchaseRequestForOrdersAsync(purchaseRequestId, cancellationToken)
            ?? throw new KeyNotFoundException("Không tìm thấy đề xuất mua hàng.");
        var purchaseRequest = source.Request;
        if (!string.Equals(purchaseRequest.Status, "APPROVED", StringComparison.Ordinal))
        {
            throw new InvalidOperationException("Chỉ có thể tạo đơn mua hàng từ đề xuất mua hàng đã được Quản lý duyệt.");
        }

        var expectedLines = ValidateCurrentOrderDecisions(source.Lines);
        var existingOrders = await LoadOrdersForRequestAsync(purchaseRequestId, cancellationToken);
        if (existingOrders.Count > 0)
        {
            ValidateEstablishedOrders(existingOrders, expectedLines);
            if (transaction is not null)
            {
                await transaction.CommitAsync(cancellationToken);
            }

            return existingOrders.Select(MapToDto).ToList();
        }

        var now = DateTime.UtcNow;
        var orderDate = DateOnly.FromDateTime(now);
        foreach (var supplierGroup in expectedLines.GroupBy(item => Convert.ToHexString(item.Decision.SupplierId)))
        {
            var supplierId = supplierGroup.First().Decision.SupplierId;
            var order = new Purchaseorder
            {
                PurchaseOrderId = GuidHelper.NewId(),
                PurchaseOrderCode = BuildPurchaseOrderCode(purchaseRequest.PurchaseRequestCode, supplierId),
                PurchaseRequestId = purchaseRequestId,
                SupplierId = supplierId,
                OrderDate = orderDate,
                Status = StatusOrdered,
                CreatedBy = userId,
                CreatedAt = now,
                UpdatedAt = now
            };
            foreach (var expected in supplierGroup)
            {
                order.Purchaseorderlines.Add(new Purchaseorderline
                {
                    PurchaseOrderLineId = BuildDecisionSnapshotId(expected.Line.PurchaseRequestLineId, expected.Decision.DecisionFingerprint),
                    PurchaseOrderId = order.PurchaseOrderId,
                    PurchaseRequestLineId = expected.Line.PurchaseRequestLineId,
                    IngredientId = expected.Line.IngredientId,
                    UnitId = expected.Line.UnitId,
                    OrderedQty = DecimalPolicy.RoundQuantity(expected.Line.PurchaseQty),
                    ReceivedQty = 0,
                    UnitPrice = DecimalPolicy.RoundMoney(expected.Decision.ProposedUnitPrice),
                    PurchaseOrder = order
                });
            }

            _context.Purchaseorders.Add(order);
        }

        await _context.SaveChangesAsync(cancellationToken);
        if (transaction is not null)
        {
            await transaction.CommitAsync(cancellationToken);
        }

        return await GetByPurchaseRequestAsync(purchaseRequestId, cancellationToken);
    }

    public async Task<IReadOnlyList<PurchaseOrderDto>> GetListAsync(string? status, CancellationToken cancellationToken = default)
    {
        var query = _context.Purchaseorders
            .AsNoTracking()
            .Include(po => po.Supplier)
            .Include(po => po.PurchaseRequest)
            .Include(po => po.Purchaseorderlines)
                .ThenInclude(line => line.Ingredient)
            .Include(po => po.Purchaseorderlines)
                .ThenInclude(line => line.Unit)
            .AsQueryable();

        if (!string.IsNullOrWhiteSpace(status))
        {
            query = query.Where(po => po.Status == status.Trim().ToUpperInvariant());
        }

        var orders = await query
            .OrderByDescending(po => po.CreatedAt)
            .ToListAsync(cancellationToken);

        return orders.Select(MapToDto).ToList();
    }

    public async Task<PurchaseOrderPageDto> GetPageAsync(PurchaseOrderPageQueryDto query, CancellationToken cancellationToken = default)
    {
        var pageNumber = Math.Max(1, query.PageNumber);
        var pageSize = Math.Clamp(query.PageSize, 1, 100);
        var filteredQuery = BuildOrderQuery(query.Status);
        var totalCount = await filteredQuery.CountAsync(cancellationToken);
        var orderIdsByRequest = await filteredQuery
            .Select(order => new { order.PurchaseRequestId })
            .ToListAsync(cancellationToken);
        var counts = orderIdsByRequest
            .GroupBy(order => GuidHelper.ToGuidString(order.PurchaseRequestId))
            .ToDictionary(group => group.Key, group => group.Count());
        var orders = await filteredQuery
            .OrderByDescending(order => order.CreatedAt)
            .Skip((pageNumber - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(cancellationToken);

        return new PurchaseOrderPageDto
        {
            Page = PagedResponseDto<PurchaseOrderDto>.Create(orders.Select(MapToDto).ToList(), totalCount, pageNumber, pageSize),
            OrderCountByRequest = counts,
        };
    }

    public async Task<PurchaseOrderDto?> GetByIdAsync(string purchaseOrderId, CancellationToken cancellationToken = default)
    {
        var purchaseOrderIdBytes = GuidHelper.ParseGuidString(purchaseOrderId);
        if (purchaseOrderIdBytes is null)
        {
            return null;
        }

        var order = await LoadOrderAsync(purchaseOrderIdBytes, cancellationToken);
        return order is null ? null : MapToDto(order);
    }

    public async Task<PurchaseOrderDto> CancelAsync(string purchaseOrderId, CancellationToken cancellationToken = default)
    {
        var purchaseOrderIdBytes = GuidHelper.ParseGuidString(purchaseOrderId)
            ?? throw new ArgumentException("Đơn mua hàng không hợp lệ.");

        var order = await LoadOrderAsync(purchaseOrderIdBytes, cancellationToken)
            ?? throw new KeyNotFoundException("Không tìm thấy đơn mua hàng.");

        if (order.Purchaseorderlines.Any(line => line.ReceivedQty > 0))
        {
            throw new InvalidOperationException("Không thể hủy đơn mua hàng đã có dòng nhận hàng.");
        }

        order.Status = StatusCancelled;
        order.UpdatedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync(cancellationToken);

        return MapToDto(order);
    }

    private async Task<Purchaseorder?> LoadOrderAsync(byte[] purchaseOrderId, CancellationToken cancellationToken)
        => await _context.Purchaseorders
            .Include(po => po.Supplier)
            .Include(po => po.PurchaseRequest)
            .Include(po => po.Purchaseorderlines)
                .ThenInclude(line => line.Ingredient)
            .Include(po => po.Purchaseorderlines)
                .ThenInclude(line => line.Unit)
            .FirstOrDefaultAsync(po => po.PurchaseOrderId == purchaseOrderId, cancellationToken);

    private IQueryable<Purchaseorder> BuildOrderQuery(string? status)
    {
        var query = _context.Purchaseorders
            .AsNoTracking()
            .Include(po => po.Supplier)
            .Include(po => po.PurchaseRequest)
            .Include(po => po.Purchaseorderlines).ThenInclude(line => line.Ingredient)
            .Include(po => po.Purchaseorderlines).ThenInclude(line => line.Unit)
            .AsQueryable();

        return string.IsNullOrWhiteSpace(status)
            ? query
            : query.Where(po => po.Status == status.Trim().ToUpperInvariant());
    }

    private async Task<PurchaseRequestOrderSource?> LoadPurchaseRequestForOrdersAsync(
        byte[] purchaseRequestId,
        CancellationToken cancellationToken)
    {
        var purchaseRequestKey = GuidHelper.ToGuidString(purchaseRequestId);
        var query = _context.Purchaserequests
            .Include(request => request.Purchaserequestlines)
                .ThenInclude(line => line.Ingredient)
            .Include(request => request.Purchaserequestlines)
                .ThenInclude(line => line.Supplier)
            .Include(request => request.Purchaserequestlines)
                .ThenInclude(line => line.Unit)
            .Include(request => request.Purchaserequestlines)
                .ThenInclude(line => line.SupplierDecisions)
                    .ThenInclude(decision => decision.Purchasepriceexceptions)
            .AsQueryable();

        if (!IsInMemoryProvider())
        {
            var relationalRequest = await query.FirstOrDefaultAsync(
                request => request.PurchaseRequestId == purchaseRequestId,
                cancellationToken);
            return relationalRequest is null
                ? null
                : new PurchaseRequestOrderSource(relationalRequest, relationalRequest.Purchaserequestlines.ToList());
        }

        var purchaseRequest = (await _context.Purchaserequests
                .AsNoTracking()
                .ToListAsync(cancellationToken))
            .SingleOrDefault(
            request => string.Equals(
                GuidHelper.ToGuidString(request.PurchaseRequestId),
                purchaseRequestKey,
                StringComparison.OrdinalIgnoreCase));
        if (purchaseRequest is null)
        {
            return null;
        }

        var queriedLines = await _context.Purchaserequestlines
            .AsNoTracking()
            .ToListAsync(cancellationToken);
        var lines = queriedLines
            .Where(line => string.Equals(
                GuidHelper.ToGuidString(line.PurchaseRequestId),
                purchaseRequestKey,
                StringComparison.OrdinalIgnoreCase))
            .DistinctBy(line => Convert.ToHexString(line.PurchaseRequestLineId))
            .ToList();

        var lineKeys = lines
            .Select(line => Convert.ToHexString(line.PurchaseRequestLineId))
            .ToHashSet(StringComparer.Ordinal);
        var queriedDecisions = await _context.Purchaselinesupplierdecisions
            .AsNoTracking()
            .ToListAsync(cancellationToken);
        var decisions = queriedDecisions
            .Where(decision => lineKeys.Contains(Convert.ToHexString(decision.PurchaseRequestLineId)))
            .DistinctBy(decision => Convert.ToHexString(decision.PurchaseLineSupplierDecisionId))
            .ToList();
        var decisionKeys = decisions
            .Select(decision => Convert.ToHexString(decision.PurchaseLineSupplierDecisionId))
            .ToHashSet(StringComparer.Ordinal);
        var queriedExceptions = await _context.Purchasepriceexceptions.AsNoTracking().ToListAsync(cancellationToken);
        var priceExceptions = queriedExceptions
            .Where(priceException => decisionKeys.Contains(
                Convert.ToHexString(priceException.PurchaseLineSupplierDecisionId)))
            .DistinctBy(priceException => Convert.ToHexString(priceException.PurchasePriceExceptionId))
            .ToList();
        foreach (var decision in decisions)
        {
            decision.Purchasepriceexceptions = priceExceptions
                .Where(priceException => priceException.PurchaseLineSupplierDecisionId.AsSpan()
                    .SequenceEqual(decision.PurchaseLineSupplierDecisionId))
                .ToList();
        }

        var suppliers = await _context.Suppliers.AsNoTracking().ToListAsync(cancellationToken);
        var ingredients = await _context.Ingredients.AsNoTracking().ToListAsync(cancellationToken);
        var units = await _context.Units.AsNoTracking().ToListAsync(cancellationToken);
        foreach (var line in lines)
        {
            line.Supplier ??= line.SupplierId is null
                ? null
                : suppliers.SingleOrDefault(supplier =>
                    supplier.SupplierId.AsSpan().SequenceEqual(line.SupplierId));
            line.Ingredient ??= ingredients.Single(ingredient =>
                ingredient.IngredientId.AsSpan().SequenceEqual(line.IngredientId));
            line.Unit ??= units.Single(unit => unit.UnitId.AsSpan().SequenceEqual(line.UnitId));
            line.SupplierDecisions = decisions
                .Where(decision => decision.PurchaseRequestLineId.AsSpan()
                    .SequenceEqual(line.PurchaseRequestLineId))
                .ToList();
        }

        return new PurchaseRequestOrderSource(purchaseRequest, lines);
    }

    private async Task<List<Purchaseorder>> LoadOrdersForRequestAsync(
        byte[] purchaseRequestId,
        CancellationToken cancellationToken)
    {
        var query = _context.Purchaseorders
            .AsNoTracking()
            .Include(order => order.Supplier)
            .Include(order => order.PurchaseRequest)
            .Include(order => order.Purchaseorderlines)
                .ThenInclude(line => line.Ingredient)
            .Include(order => order.Purchaseorderlines)
                .ThenInclude(line => line.Unit)
            .AsQueryable();

        var orders = IsInMemoryProvider()
            ? (await _context.Purchaseorders.AsNoTracking().ToListAsync(cancellationToken))
                .Where(order => string.Equals(
                    GuidHelper.ToGuidString(order.PurchaseRequestId),
                    GuidHelper.ToGuidString(purchaseRequestId),
                    StringComparison.OrdinalIgnoreCase))
                .DistinctBy(order => Convert.ToHexString(order.PurchaseOrderId))
                .ToList()
            : await query
                .Where(order => order.PurchaseRequestId == purchaseRequestId)
                .ToListAsync(cancellationToken);

        if (IsInMemoryProvider() && orders.Count > 0)
        {
            var purchaseRequests = await _context.Purchaserequests.AsNoTracking().ToListAsync(cancellationToken);
            var suppliers = await _context.Suppliers.AsNoTracking().ToListAsync(cancellationToken);
            var ingredients = await _context.Ingredients.AsNoTracking().ToListAsync(cancellationToken);
            var units = await _context.Units.AsNoTracking().ToListAsync(cancellationToken);
            var orderKeys = orders
                .Select(order => Convert.ToHexString(order.PurchaseOrderId))
                .ToHashSet(StringComparer.Ordinal);
            var queriedLines = await _context.Purchaseorderlines
                .AsNoTracking()
                .ToListAsync(cancellationToken);
            var lines = queriedLines
                .Where(line => orderKeys.Contains(Convert.ToHexString(line.PurchaseOrderId)))
                .DistinctBy(line => Convert.ToHexString(line.PurchaseOrderLineId))
                .ToList();
            foreach (var order in orders)
            {
                order.PurchaseRequest = purchaseRequests.Single(request =>
                    request.PurchaseRequestId.AsSpan().SequenceEqual(order.PurchaseRequestId));
                order.Supplier = suppliers.Single(supplier =>
                    supplier.SupplierId.AsSpan().SequenceEqual(order.SupplierId));
                order.Purchaseorderlines = lines
                    .Where(line => line.PurchaseOrderId.AsSpan().SequenceEqual(order.PurchaseOrderId))
                    .ToList();
                foreach (var line in order.Purchaseorderlines)
                {
                    line.Ingredient = ingredients.Single(ingredient =>
                        ingredient.IngredientId.AsSpan().SequenceEqual(line.IngredientId));
                    line.Unit = units.Single(unit => unit.UnitId.AsSpan().SequenceEqual(line.UnitId));
                }
            }
        }

        return orders.OrderBy(order => order.PurchaseOrderCode, StringComparer.Ordinal).ToList();
    }

    private static List<ExpectedOrderLine> ValidateCurrentOrderDecisions(
        IReadOnlyCollection<Purchaserequestline> purchaseRequestLines)
    {
        if (purchaseRequestLines.Count == 0)
        {
            throw new InvalidOperationException("Đề xuất mua hàng không có dòng nào để tạo đơn.");
        }

        var expectedLines = new List<ExpectedOrderLine>(purchaseRequestLines.Count);
        foreach (var line in purchaseRequestLines)
        {
            var currentDecisions = line.SupplierDecisions
                .Where(decision => string.Equals(decision.Status, "CURRENT", StringComparison.Ordinal))
                .ToList();
            if (currentDecisions.Count != 1)
            {
                throw new InvalidOperationException("Mỗi dòng mua phải có đúng một quyết định nhà cung cấp hiện hành trước khi tạo đơn mua hàng.");
            }

            var decision = currentDecisions[0];
            if (line.SupplierId is null ||
                !line.SupplierId.AsSpan().SequenceEqual(decision.SupplierId) ||
                DecimalPolicy.RoundMoney(line.EstimatedUnitPrice) != DecimalPolicy.RoundMoney(decision.ProposedUnitPrice) ||
                line.ExpectedDeliveryDate != decision.ProposedDeliveryDate)
            {
                throw new DbUpdateConcurrencyException("Dòng mua không còn khớp với quyết định nhà cung cấp hiện hành.");
            }

            var variancePercent = PurchasePricePolicy.CalculateVariancePercent(
                decision.EvidenceReferencePrice,
                decision.ProposedUnitPrice);
            if (PurchasePricePolicy.RequiresException(variancePercent) &&
                !decision.Purchasepriceexceptions.Any(priceException =>
                    string.Equals(priceException.ProposalFingerprint, decision.DecisionFingerprint, StringComparison.Ordinal) &&
                    priceException.ProposalVersion == decision.Version &&
                    priceException.ReferencePrice == decision.EvidenceReferencePrice &&
                    priceException.ProposedPrice == decision.ProposedUnitPrice &&
                    string.Equals(priceException.EvidenceType, decision.EvidenceType, StringComparison.Ordinal) &&
                    priceException.EvidenceId.AsSpan().SequenceEqual(decision.EvidenceId) &&
                    priceException.EvidenceDate == decision.EvidenceDate &&
                    string.Equals(priceException.Status, "APPROVED", StringComparison.Ordinal)))
            {
                throw new InvalidOperationException("Ngoại lệ giá của quyết định nhà cung cấp hiện hành chưa được Quản lý duyệt.");
            }

            expectedLines.Add(new ExpectedOrderLine(line, decision));
        }

        return expectedLines;
    }

    private static void ValidateEstablishedOrders(
        IReadOnlyCollection<Purchaseorder> orders,
        IReadOnlyCollection<ExpectedOrderLine> expectedLines,
        Exception? innerException = null)
    {
        var expectedSupplierCount = expectedLines
            .Select(expected => Convert.ToHexString(expected.Decision.SupplierId))
            .Distinct(StringComparer.Ordinal)
            .Count();
        var establishedLines = orders.SelectMany(order => order.Purchaseorderlines).ToList();
        var matches = orders.Count == expectedSupplierCount &&
            establishedLines.Count == expectedLines.Count &&
            expectedLines.All(expected =>
            {
                var expectedLineId = BuildDecisionSnapshotId(
                    expected.Line.PurchaseRequestLineId,
                    expected.Decision.DecisionFingerprint);
                return orders.Any(order =>
                    order.SupplierId.AsSpan().SequenceEqual(expected.Decision.SupplierId) &&
                    order.CreatedAt >= expected.Decision.ConfirmedAt &&
                    order.Purchaseorderlines.Any(line =>
                        line.PurchaseOrderLineId.AsSpan().SequenceEqual(expectedLineId) &&
                        line.PurchaseRequestLineId.AsSpan().SequenceEqual(expected.Line.PurchaseRequestLineId) &&
                        line.IngredientId.AsSpan().SequenceEqual(expected.Line.IngredientId) &&
                        line.UnitId.AsSpan().SequenceEqual(expected.Line.UnitId) &&
                        line.OrderedQty == DecimalPolicy.RoundQuantity(expected.Line.PurchaseQty) &&
                        line.UnitPrice == DecimalPolicy.RoundMoney(expected.Decision.ProposedUnitPrice)));
            });

        if (!matches)
        {
            const string message = "Tập đơn mua hàng đã tạo không còn khớp với quyết định nhà cung cấp hiện hành.";
            throw innerException is null
                ? new DbUpdateConcurrencyException(message)
                : new DbUpdateConcurrencyException(message, innerException);
        }
    }

    private bool IsInMemoryProvider()
        => string.Equals(
            _context.Database.ProviderName,
            "Microsoft.EntityFrameworkCore.InMemory",
            StringComparison.Ordinal);

    private static byte[] BuildDecisionSnapshotId(byte[] purchaseRequestLineId, string decisionFingerprint)
    {
        var snapshotKey = $"{GuidHelper.ToGuidString(purchaseRequestLineId)}|{decisionFingerprint}";
        return SHA256.HashData(Encoding.UTF8.GetBytes(snapshotKey)).AsSpan(0, 16).ToArray();
    }

    private async Task<IReadOnlyList<PurchaseOrderDto>> GetByPurchaseRequestAsync(byte[] purchaseRequestId, CancellationToken cancellationToken)
    {
        var orders = await LoadOrdersForRequestAsync(purchaseRequestId, cancellationToken);
        return orders.Select(MapToDto).ToList();
    }

    private sealed record ExpectedOrderLine(
        Purchaserequestline Line,
        Purchaselinesupplierdecision Decision);

    private sealed record PurchaseRequestOrderSource(
        Purchaserequest Request,
        IReadOnlyCollection<Purchaserequestline> Lines);

    private static string ComputeOrderStatus(IEnumerable<Purchaseorderline> lines)
    {
        var lineList = lines.ToList();
        if (lineList.All(line => !DecimalPolicy.LessThanQuantity(line.ReceivedQty, line.OrderedQty)))
        {
            return StatusReceived;
        }

        return lineList.Any(line => line.ReceivedQty > 0) ? StatusPartiallyReceived : StatusOrdered;
    }

    private static string BuildPurchaseOrderCode(string purchaseRequestCode, byte[] supplierId)
        => $"PO-{purchaseRequestCode}-{GuidHelper.ToGuidString(supplierId)[..8]}";

    private static PurchaseOrderDto MapToDto(Purchaseorder order) => new()
    {
        PurchaseOrderId = GuidHelper.ToGuidString(order.PurchaseOrderId),
        PurchaseOrderCode = order.PurchaseOrderCode,
        PurchaseRequestId = GuidHelper.ToGuidString(order.PurchaseRequestId),
        PurchaseRequestCode = order.PurchaseRequest.PurchaseRequestCode,
        SupplierId = GuidHelper.ToGuidString(order.SupplierId),
        SupplierName = order.Supplier.SupplierName,
        OrderDate = order.OrderDate.ToString("yyyy-MM-dd"),
        Status = order.Status,
        Lines = order.Purchaseorderlines
            .OrderBy(line => line.Ingredient.IngredientName)
            .Select(line => new PurchaseOrderLineDto
            {
                PurchaseOrderLineId = GuidHelper.ToGuidString(line.PurchaseOrderLineId),
                PurchaseRequestLineId = GuidHelper.ToGuidString(line.PurchaseRequestLineId),
                IngredientId = GuidHelper.ToGuidString(line.IngredientId),
                IngredientName = line.Ingredient.IngredientName,
                UnitId = GuidHelper.ToGuidString(line.UnitId),
                UnitName = line.Unit.UnitName,
                OrderedQty = line.OrderedQty,
                ReceivedQty = line.ReceivedQty,
                UnitPrice = line.UnitPrice,
                LotNumberRequired = true,
                ManufactureDateRequired = line.Ingredient.IsFreshDaily,
                ExpiryDateRequired = line.Ingredient.IsFreshDaily,
                BlockerReason = line.Ingredient.IsActive == true
                    ? null
                    : $"Nguyên liệu {line.Ingredient.IngredientName} đã ngừng hoạt động."
            })
            .ToList()
    };
}
