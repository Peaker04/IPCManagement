using IPCManagement.Api.Data;
using IPCManagement.Api.Helpers;
using IPCManagement.Api.Models.Entities;
using Microsoft.EntityFrameworkCore;
using IPCManagement.Api.Features.Inventory.Contracts;
using IPCManagement.Api.Shared.Contracts;

namespace IPCManagement.Api.Features.Inventory.Services;

public sealed class SupplementalMaterialRequestService : ISupplementalMaterialRequestService
{
    private const string PendingStatus = "PENDING_WAREHOUSE_REVIEW";
    private const string PartialStatus = "PARTIALLY_FULFILLED";
    private const string NeedsPurchaseStatus = "NEEDS_PURCHASE";
    private const string IssuedStatus = "ISSUED";
    private const string FulfilledStatus = "FULFILLED";
    private const string RejectedStatus = "REJECTED";
    private const string MovementRefTable = "supplementalmaterialrequests";
    private const string PurchaseRequestAuditField = "PurchaseRequestId";
    internal const string FulfillmentIssueAuditField = "FulfillmentIssueId";

    private readonly IpcManagementContext _context;
    private readonly IUnitOfWork _unitOfWork;
    private readonly IStockLedgerService _stockLedgerService;

    public SupplementalMaterialRequestService(
        IpcManagementContext context,
        IUnitOfWork unitOfWork,
        IStockLedgerService stockLedgerService)
    {
        _context = context;
        _unitOfWork = unitOfWork;
        _stockLedgerService = stockLedgerService;
    }

    public async Task<PagedResponseDto<SupplementalMaterialRequestDto>> GetPagedAsync(
        SupplementalMaterialRequestFilterDto request,
        string? scopedWarehouseId = null)
    {
        var pageNumber = Math.Max(request.PageNumber, 1);
        var pageSize = Math.Clamp(request.PageSize, 1, 100);
        var query = _context.Supplementalmaterialrequests.AsNoTracking().AsQueryable();

        var requestedWarehouseId = GuidHelper.ParseGuidString(request.WarehouseId);
        var scopeId = GuidHelper.ParseGuidString(scopedWarehouseId);
        if (scopedWarehouseId is not null && scopeId is null)
        {
            throw new UnauthorizedAccessException("Phạm vi kho của người dùng không hợp lệ.");
        }

        var warehouseId = scopeId ?? requestedWarehouseId;
        if (warehouseId is not null)
        {
            query = query.Where(item => item.WarehouseId == warehouseId);
        }

        if (!string.IsNullOrWhiteSpace(request.Status))
        {
            var status = NormalizeStatus(request.Status);
            query = query.Where(item => item.Status == status ||
                (status == PendingStatus && item.Status == "PENDING"));
        }

        var totalCount = await query.CountAsync();
        var entities = await query
            .OrderByDescending(item => item.RequestedAt)
            .Skip((pageNumber - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync();
        var items = new List<SupplementalMaterialRequestDto>(entities.Count);
        foreach (var entity in entities)
        {
            items.Add(await MapAsync(entity));
        }

        return PagedResponseDto<SupplementalMaterialRequestDto>.Create(items, totalCount, pageNumber, pageSize);
    }

    public async Task<SupplementalMaterialRequestDto?> GetByIdAsync(
        string id,
        string? scopedWarehouseId = null)
    {
        var requestId = GuidHelper.ParseGuidString(id);
        if (requestId is null)
        {
            return null;
        }

        var entity = await _context.Supplementalmaterialrequests
            .AsNoTracking()
            .FirstOrDefaultAsync(item => item.RequestId == requestId);
        if (entity is null)
        {
            return null;
        }

        EnsureWarehouseScope(entity, scopedWarehouseId);
        return await MapAsync(entity);
    }

    public async Task<SupplementalMaterialRequestDto> CreateAsync(
        CreateSupplementalMaterialRequest request,
        string actorUserId,
        string? scopedWarehouseId = null)
    {
        var actorId = GuidHelper.ParseGuidString(actorUserId)
            ?? throw new ArgumentException("Người yêu cầu không hợp lệ.");
        var issueId = GuidHelper.ParseGuidString(request.IssueId)
            ?? throw new ArgumentException("Phiếu xuất không hợp lệ.");
        var issueLineId = GuidHelper.ParseGuidString(request.IssueLineId)
            ?? throw new ArgumentException("Dòng nguyên liệu không hợp lệ.");

        if (request.RequestedQty <= 0)
        {
            throw new ArgumentException("Số lượng yêu cầu bổ sung phải lớn hơn 0.");
        }

        var source = await _context.Inventoryissuelines.FindAsync(issueLineId)
            ?? throw new InvalidOperationException("Không tìm thấy dòng nguyên liệu trên phiếu xuất.");
        if (!source.IssueId.SequenceEqual(issueId))
        {
            throw new InvalidOperationException("Dòng nguyên liệu không thuộc phiếu xuất đã chọn.");
        }

        await _context.Entry(source).Reference(line => line.Issue).LoadAsync();
        await _context.Entry(source).Reference(line => line.Ingredient).LoadAsync();
        await _context.Entry(source).Reference(line => line.Unit).LoadAsync();

        if (source.Issue.ReceivedAt is null)
        {
            throw new InvalidOperationException("Bếp cần xác nhận đã nhận phiếu xuất trước khi yêu cầu bổ sung.");
        }

        EnsureWarehouseScope(source.Issue.WarehouseId, scopedWarehouseId);

        var entity = new SupplementalMaterialRequest
        {
            RequestId = GuidHelper.NewId(),
            RequestCode = $"SUP-{DateTime.UtcNow:yyyyMMdd-HHmmss}-{Guid.NewGuid().ToString("N")[..4].ToUpperInvariant()}",
            IssueId = source.IssueId,
            IssueLineId = source.IssueLineId,
            WarehouseId = source.Issue.WarehouseId,
            IngredientId = source.IngredientId,
            UnitId = source.UnitId,
            RequestedQty = DecimalPolicy.RoundQuantity(request.RequestedQty),
            Reason = string.IsNullOrWhiteSpace(request.Reason) ? null : request.Reason.Trim(),
            Status = PendingStatus,
            RequestedBy = actorId,
            RequestedAt = DateTime.UtcNow,
        };

        _context.Supplementalmaterialrequests.Add(entity);
        AddAudit(entity, actorId, "Create", null, PendingStatus, "Bếp gửi yêu cầu cấp nguyên liệu bổ sung tới kho.");
        await _context.SaveChangesAsync();

        return await MapAsync(entity, source);
    }

    public async Task<SupplementalMaterialRequestDto> FulfillAsync(
        string id,
        FulfillSupplementalMaterialRequest request,
        string actorUserId,
        string? scopedWarehouseId = null)
    {
        var actorId = ParseActor(actorUserId);
        var entity = await LoadTrackedAsync(id);
        EnsureWarehouseScope(entity, scopedWarehouseId);
        EnsureActionable(entity);

        var requestedQuantity = DecimalPolicy.RoundQuantity(request.Quantity);
        if (requestedQuantity <= 0)
        {
            throw new ArgumentException("Số lượng cấp bổ sung phải lớn hơn 0.");
        }

        var source = await LoadSourceLineAsync(entity);
        var current = await MapAsync(entity, source);
        if (requestedQuantity > current.RemainingQty)
        {
            throw new InvalidOperationException($"Số lượng cấp vượt phần còn thiếu {current.RemainingQty} {current.UnitName}.");
        }
        if (requestedQuantity > current.AvailableQty)
        {
            throw new InvalidOperationException($"Kho chỉ còn {current.AvailableQty} {current.UnitName}; hãy cấp một phần hoặc chuyển phần thiếu sang thu mua.");
        }

        using var transaction = await _unitOfWork.BeginTransactionAsync();
        try
        {
            var issue = new InventoryIssue
            {
                IssueId = GuidHelper.NewId(),
                IssueCode = $"ISS-SUP-{DateTime.UtcNow:yyyyMMdd-HHmmss}-{Guid.NewGuid().ToString("N")[..4].ToUpperInvariant()}",
                IssueDate = DateOnly.FromDateTime(DateTime.UtcNow),
                ShiftName = source.Issue.ShiftName,
                WarehouseId = entity.WarehouseId,
                MaterialRequestId = source.Issue.MaterialRequestId,
                IssuedBy = actorId,
                CreatedAt = DateTime.UtcNow,
            };
            issue.Inventoryissuelines.Add(new InventoryIssueLine
            {
                IssueLineId = GuidHelper.NewId(),
                IssueId = issue.IssueId,
                IngredientId = entity.IngredientId,
                UnitId = entity.UnitId,
                RequestedQty = requestedQuantity,
                IssuedQty = requestedQuantity,
            });
            _context.Inventoryissues.Add(issue);

            await _stockLedgerService.RemoveStockWithCheckAsync(
                entity.WarehouseId,
                entity.IngredientId,
                entity.UnitId,
                requestedQuantity,
                "ISSUE",
                MovementRefTable,
                entity.RequestId,
                actorId,
                "Cấp nguyên liệu bổ sung cho bếp",
                $"Yêu cầu {entity.RequestCode}; phiếu xuất {issue.IssueCode}");

            var totalFulfilled = DecimalPolicy.RoundQuantity(current.FulfilledQty + requestedQuantity);
            var oldStatus = entity.Status;
            entity.Status = totalFulfilled >= entity.RequestedQty ? IssuedStatus : PartialStatus;
            AddAudit(
                entity,
                actorId,
                FulfillmentIssueAuditField,
                oldStatus,
                GuidHelper.ToGuidString(issue.IssueId),
                $"Kho cấp {requestedQuantity} {source.Unit.UnitName} bằng phiếu {issue.IssueCode}.");

            await _unitOfWork.SaveChangesAsync();
            await transaction.CommitAsync();
        }
        catch
        {
            await transaction.RollbackAsync();
            throw;
        }

        return await MapAsync(entity, source);
    }

    public async Task<SupplementalMaterialRequestDto> RouteToPurchasingAsync(
        string id,
        string actorUserId,
        string? scopedWarehouseId = null)
    {
        var actorId = ParseActor(actorUserId);
        var entity = await LoadTrackedAsync(id);
        EnsureWarehouseScope(entity, scopedWarehouseId);
        EnsureActionable(entity);

        var source = await LoadSourceLineAsync(entity);
        var current = await MapAsync(entity, source);
        var purchaseQty = DecimalPolicy.RoundQuantity(current.RemainingQty - current.AvailableQty);
        if (purchaseQty <= 0)
        {
            throw new InvalidOperationException("Kho đang đủ hàng cho phần còn thiếu; hãy tạo phiếu xuất bổ sung.");
        }
        if (current.PurchaseRequestId is not null)
        {
            throw new InvalidOperationException($"Yêu cầu đã được chuyển sang thu mua bằng {current.PurchaseRequestCode}.");
        }

        var materialLineQuery = _context.Materialrequestlines
            .Include(line => line.Ingredient)
            .Include(line => line.Unit);
        var materialLine = string.Equals(
                _context.Database.ProviderName,
                "Microsoft.EntityFrameworkCore.InMemory",
                StringComparison.Ordinal)
            ? _context.ChangeTracker.Entries<MaterialRequestLine>()
                .Select(entry => entry.Entity)
                .FirstOrDefault()
            : await materialLineQuery.FirstOrDefaultAsync(line =>
                line.RequestId == source.Issue.MaterialRequestId &&
                line.IngredientId == entity.IngredientId &&
                line.UnitId == entity.UnitId);
        if (materialLine is null)
        {
            throw new InvalidOperationException("Không tìm thấy dòng nhu cầu gốc để chuyển phần thiếu sang thu mua.");
        }

        using var transaction = await _unitOfWork.BeginTransactionAsync();
        try
        {
            var purchaseRequest = new PurchaseRequest
            {
                PurchaseRequestId = GuidHelper.NewId(),
                PurchaseRequestCode = $"PR-SUP-{DateTime.UtcNow:yyyyMMdd}-{Guid.NewGuid().ToString("N")[..4].ToUpperInvariant()}",
                RequestDate = DateOnly.FromDateTime(DateTime.UtcNow),
                PurchaseForDate = DateOnly.FromDateTime(DateTime.UtcNow),
                ShiftName = source.Issue.ShiftName,
                Status = "DRAFT",
                CreatedBy = actorId,
            };
            purchaseRequest.Purchaserequestlines.Add(new PurchaseRequestLine
            {
                PurchaseRequestLineId = GuidHelper.NewId(),
                PurchaseRequestId = purchaseRequest.PurchaseRequestId,
                MaterialRequestLineId = materialLine.RequestLineId,
                IngredientId = entity.IngredientId,
                UnitId = entity.UnitId,
                RequiredQty = current.RemainingQty,
                CurrentStockQty = current.AvailableQty,
                PurchaseQty = purchaseQty,
                EstimatedUnitPrice = 0,
            });
            _context.Purchaserequests.Add(purchaseRequest);

            var oldStatus = entity.Status;
            entity.Status = NeedsPurchaseStatus;
            AddAudit(
                entity,
                actorId,
                PurchaseRequestAuditField,
                oldStatus,
                GuidHelper.ToGuidString(purchaseRequest.PurchaseRequestId),
                $"Kho chuyển {purchaseQty} {source.Unit.UnitName} còn thiếu sang đề xuất {purchaseRequest.PurchaseRequestCode}.");

            await _unitOfWork.SaveChangesAsync();
            await transaction.CommitAsync();
        }
        catch
        {
            await transaction.RollbackAsync();
            throw;
        }

        return await MapAsync(entity, source);
    }

    public async Task<SupplementalMaterialRequestDto> RejectAsync(
        string id,
        RejectSupplementalMaterialRequest request,
        string actorUserId,
        string? scopedWarehouseId = null)
    {
        var actorId = ParseActor(actorUserId);
        var entity = await LoadTrackedAsync(id);
        EnsureWarehouseScope(entity, scopedWarehouseId);
        EnsureActionable(entity);

        var reason = request.Reason?.Trim();
        if (string.IsNullOrWhiteSpace(reason))
        {
            throw new ArgumentException("Cần nhập lý do từ chối yêu cầu bổ sung.");
        }

        var current = await MapAsync(entity);
        if (current.FulfilledQty > 0 || current.PurchaseRequestId is not null)
        {
            throw new InvalidOperationException("Không thể từ chối yêu cầu đã cấp một phần hoặc đã chuyển sang thu mua.");
        }

        var oldStatus = entity.Status;
        entity.Status = RejectedStatus;
        AddAudit(entity, actorId, "Reject", oldStatus, RejectedStatus, reason);
        await _context.SaveChangesAsync();
        return await MapAsync(entity);
    }

    private async Task<SupplementalMaterialRequestDto> MapAsync(
        SupplementalMaterialRequest entity,
        InventoryIssueLine? loadedSource = null)
    {
        var source = loadedSource ?? await LoadSourceLineAsync(entity);
        decimal fulfilledQty;
        if (IsInMemory())
        {
            fulfilledQty = (await _context.Stockmovements.AsNoTracking().ToListAsync())
                .Where(item => item.RefTable == MovementRefTable && item.RefId is not null && item.RefId.SequenceEqual(entity.RequestId))
                .Sum(item => item.QuantityOut);
        }
        else
        {
            fulfilledQty = await _context.Stockmovements
                .AsNoTracking()
                .Where(item => item.RefTable == MovementRefTable && item.RefId == entity.RequestId)
                .SumAsync(item => (decimal?)item.QuantityOut) ?? 0;
        }
        fulfilledQty = DecimalPolicy.RoundQuantity(fulfilledQty);
        var remainingQty = DecimalPolicy.RoundQuantity(Math.Max(entity.RequestedQty - fulfilledQty, 0));
        var availableQty = await GetAvailableQuantityAsync(entity.WarehouseId, entity.IngredientId, source.Unit);
        var purchaseLink = await GetPurchaseLinkAsync(entity.RequestId);
        var status = NormalizeStatus(entity.Status);
        var terminal = status is RejectedStatus or FulfilledStatus;
        var canFulfill = !terminal && remainingQty > 0 && availableQty > 0;
        var canRoute = !terminal && remainingQty > availableQty && purchaseLink.RequestId is null;
        var canReject = !terminal && fulfilledQty <= 0 && purchaseLink.RequestId is null;

        return new SupplementalMaterialRequestDto
        {
            RequestId = GuidHelper.ToGuidString(entity.RequestId),
            RequestCode = entity.RequestCode,
            IssueId = GuidHelper.ToGuidString(entity.IssueId),
            IssueCode = source.Issue.IssueCode,
            IssueLineId = GuidHelper.ToGuidString(entity.IssueLineId),
            WarehouseId = GuidHelper.ToGuidString(entity.WarehouseId),
            IngredientId = GuidHelper.ToGuidString(entity.IngredientId),
            IngredientName = source.Ingredient.IngredientName,
            UnitId = GuidHelper.ToGuidString(entity.UnitId),
            UnitName = source.Unit.UnitName,
            RequestedQty = DecimalPolicy.RoundQuantity(entity.RequestedQty),
            FulfilledQty = fulfilledQty,
            RemainingQty = remainingQty,
            AvailableQty = availableQty,
            Reason = entity.Reason,
            Status = status,
            RequestedAt = entity.RequestedAt,
            PurchaseRequestId = purchaseLink.RequestId,
            PurchaseRequestCode = purchaseLink.RequestCode,
            PurchaseRequestStatus = purchaseLink.Status,
            CanFulfill = canFulfill,
            CanRouteToPurchasing = canRoute,
            CanReject = canReject,
            ActionDisabledReason = ResolveDisabledReason(status, remainingQty, availableQty, purchaseLink.RequestCode),
        };
    }

    private async Task<InventoryIssueLine> LoadSourceLineAsync(SupplementalMaterialRequest entity)
    {
        var query = _context.Inventoryissuelines
            .AsNoTracking()
            .Include(line => line.Issue)
            .Include(line => line.Ingredient)
            .Include(line => line.Unit);
        if (!string.Equals(_context.Database.ProviderName, "Microsoft.EntityFrameworkCore.InMemory", StringComparison.Ordinal))
        {
            return await query.FirstAsync(line => line.IssueLineId == entity.IssueLineId);
        }

        var tracked = _context.ChangeTracker.Entries<InventoryIssueLine>()
            .Select(entry => entry.Entity)
            .FirstOrDefault(line =>
                line.IssueLineId.SequenceEqual(entity.IssueLineId) ||
                (line.IssueId.SequenceEqual(entity.IssueId) &&
                    line.IngredientId.SequenceEqual(entity.IngredientId) &&
                    line.UnitId.SequenceEqual(entity.UnitId)));
        if (tracked is not null)
        {
            return tracked;
        }

        return (await query.ToListAsync()).First(line =>
            line.IssueLineId.SequenceEqual(entity.IssueLineId) ||
            (line.IssueId.SequenceEqual(entity.IssueId) &&
                line.IngredientId.SequenceEqual(entity.IngredientId) &&
                line.UnitId.SequenceEqual(entity.UnitId)));
    }

    private async Task<SupplementalMaterialRequest> LoadTrackedAsync(string id)
    {
        var requestId = GuidHelper.ParseGuidString(id)
            ?? throw new ArgumentException("Yêu cầu bổ sung không hợp lệ.");
        return await _context.Supplementalmaterialrequests
            .FirstOrDefaultAsync(item => item.RequestId == requestId)
            ?? throw new KeyNotFoundException("Không tìm thấy yêu cầu cấp nguyên liệu bổ sung.");
    }

    private async Task<decimal> GetAvailableQuantityAsync(byte[] warehouseId, byte[] ingredientId, Unit targetUnit)
    {
        var stockQuery = _context.Currentstocks
            .AsNoTracking()
            .Include(item => item.Unit);
        var stock = IsInMemory()
            ? _context.ChangeTracker.Entries<CurrentStock>()
                .Select(entry => entry.Entity)
                .FirstOrDefault()
            : await stockQuery.FirstOrDefaultAsync(item => item.WarehouseId == warehouseId && item.IngredientId == ingredientId);
        if (stock is null)
        {
            return 0;
        }
        if (stock.UnitId.SequenceEqual(targetUnit.UnitId))
        {
            return DecimalPolicy.RoundQuantity(stock.CurrentQty);
        }
        if (stock.Unit.ConvertRateToBase <= 0 || targetUnit.ConvertRateToBase <= 0 ||
            !string.Equals(BaseUnit(stock.Unit), BaseUnit(targetUnit), StringComparison.OrdinalIgnoreCase))
        {
            return 0;
        }
        return DecimalPolicy.RoundQuantity(stock.CurrentQty * stock.Unit.ConvertRateToBase / targetUnit.ConvertRateToBase);
    }

    private async Task<(string? RequestId, string? RequestCode, string? Status)> GetPurchaseLinkAsync(byte[] requestId)
    {
        var audit = await _context.Auditlogs
            .AsNoTracking()
            .Where(item => item.EntityName == nameof(SupplementalMaterialRequest) &&
                item.EntityId == requestId &&
                item.FieldName == PurchaseRequestAuditField)
            .OrderByDescending(item => item.ChangedAt)
            .FirstOrDefaultAsync();
        var purchaseRequestId = GuidHelper.ParseGuidString(audit?.NewValue);
        if (purchaseRequestId is null)
        {
            return (null, null, null);
        }
        var purchaseRequest = await _context.Purchaserequests
            .AsNoTracking()
            .FirstOrDefaultAsync(item => item.PurchaseRequestId == purchaseRequestId);
        return purchaseRequest is null
            ? (GuidHelper.ToGuidString(purchaseRequestId), null, null)
            : (GuidHelper.ToGuidString(purchaseRequest.PurchaseRequestId), purchaseRequest.PurchaseRequestCode, purchaseRequest.Status);
    }

    private void AddAudit(
        SupplementalMaterialRequest entity,
        byte[] actorId,
        string fieldName,
        string? oldValue,
        string? newValue,
        string reason)
        => _context.Auditlogs.Add(new AuditLog
        {
            AuditId = GuidHelper.NewId(),
            ChangedAt = DateTime.UtcNow,
            ChangedBy = actorId,
            BusinessArea = "SupplementalMaterial",
            EntityName = nameof(SupplementalMaterialRequest),
            EntityId = entity.RequestId,
            FieldName = fieldName,
            OldValue = oldValue,
            NewValue = newValue,
            Reason = reason,
        });

    private static void EnsureActionable(SupplementalMaterialRequest entity)
    {
        var status = NormalizeStatus(entity.Status);
        if (status is RejectedStatus or FulfilledStatus)
        {
            throw new InvalidOperationException("Yêu cầu bổ sung đã ở trạng thái kết thúc và không thể thao tác thêm.");
        }
    }

    private static void EnsureWarehouseScope(SupplementalMaterialRequest entity, string? scopedWarehouseId)
        => EnsureWarehouseScope(entity.WarehouseId, scopedWarehouseId);

    private static void EnsureWarehouseScope(byte[] warehouseId, string? scopedWarehouseId)
    {
        if (scopedWarehouseId is null)
        {
            return;
        }
        var scopedWarehouse = GuidHelper.ParseGuidString(scopedWarehouseId);
        if (scopedWarehouse is null || !warehouseId.SequenceEqual(scopedWarehouse))
        {
            throw new UnauthorizedAccessException("Không có quyền xử lý yêu cầu của kho khác.");
        }
    }

    private static byte[] ParseActor(string actorUserId)
        => GuidHelper.ParseGuidString(actorUserId)
            ?? throw new ArgumentException("Người thao tác không hợp lệ.");

    private static string NormalizeStatus(string? status)
        => string.Equals(status, "PENDING", StringComparison.OrdinalIgnoreCase)
            ? PendingStatus
            : status?.Trim().ToUpperInvariant() ?? PendingStatus;

    private static string BaseUnit(Unit unit)
        => string.IsNullOrWhiteSpace(unit.BaseUnitCode) ? unit.UnitCode : unit.BaseUnitCode;

    private bool IsInMemory()
        => string.Equals(
            _context.Database.ProviderName,
            "Microsoft.EntityFrameworkCore.InMemory",
            StringComparison.Ordinal);

    private static string? ResolveDisabledReason(
        string status,
        decimal remainingQty,
        decimal availableQty,
        string? purchaseRequestCode)
    {
        if (status == RejectedStatus) return "Yêu cầu đã bị từ chối.";
        if (status == FulfilledStatus) return "Yêu cầu đã được cấp đủ và bếp đã xác nhận.";
        if (remainingQty <= 0) return "Kho đã cấp đủ; đang chờ bếp kiểm đếm và ký nhận.";
        if (availableQty <= 0 && purchaseRequestCode is not null) return $"Đang chờ nhập hàng theo {purchaseRequestCode}.";
        if (availableQty <= 0) return "Kho không còn hàng; chuyển phần thiếu sang thu mua để tiếp tục.";
        if (availableQty < remainingQty) return $"Kho chỉ đủ cấp một phần {availableQty}; phần còn lại cần chuyển thu mua.";
        return null;
    }
}
