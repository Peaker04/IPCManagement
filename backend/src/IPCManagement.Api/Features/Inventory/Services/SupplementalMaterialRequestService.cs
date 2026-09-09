using IPCManagement.Api.Data;
using IPCManagement.Api.Data.Transactions;
using IPCManagement.Api.Helpers;
using IPCManagement.Api.Models.Entities;
using Microsoft.EntityFrameworkCore;
using IPCManagement.Api.Features.Inventory.Contracts;
using IPCManagement.Api.Shared.Contracts;
using IPCManagement.Api.Exceptions;
using System.Collections.Concurrent;
using System.Data;
using System.Text.Json;
using IPCManagement.Api.Infrastructure.Lifecycle;
using IPCManagement.Api.Features.SystemOperation.Services;
using static IPCManagement.Api.Features.Inventory.Services.SupplementalMaterialRequestRules;
namespace IPCManagement.Api.Features.Inventory.Services;

public sealed class SupplementalMaterialRequestService : ISupplementalMaterialRequestService
{
    private const string AggregateType = nameof(SupplementalMaterialRequest);
    private const string PendingStatus = "PENDING_WAREHOUSE_REVIEW";
    private const string PartialStatus = "PARTIALLY_FULFILLED";
    private const string IssuedStatus = "ISSUED";
    private const string FulfilledStatus = "FULFILLED";
    private const string RejectedStatus = "REJECTED";
    private const string MovementRefTable = "supplementalmaterialrequests";
    private const string OpenIssueLineUniqueIndex = "uxSupplementalMaterialRequestsOpenIssueLine";
    internal const string FulfillmentIssueAuditField = "FulfillmentIssueId";
    private static readonly ConcurrentDictionary<string, SemaphoreSlim> InMemoryIssueLineLocks = new(StringComparer.Ordinal);

    private readonly IpcManagementContext _context;
    private readonly IUnitOfWork _unitOfWork;
    private readonly IStockLedgerService _stockLedgerService;
    private readonly IEfTransactionRunner _transactionRunner;
    private readonly IOperationalWarehouseResolver _operationalWarehouseResolver;
    private readonly SystemOperationRequestContext? _requestContext;
    private readonly SupplementalMaterialRequestPurchasingRouter _purchasingRouter;

    public SupplementalMaterialRequestService(
        IpcManagementContext context,
        IUnitOfWork unitOfWork,
        IStockLedgerService stockLedgerService,
        IEfTransactionRunner transactionRunner,
        IOperationalWarehouseResolver operationalWarehouseResolver,
        SystemOperationRequestContext? requestContext = null)
    {
        _context = context;
        _unitOfWork = unitOfWork;
        _stockLedgerService = stockLedgerService;
        _transactionRunner = transactionRunner;
        _operationalWarehouseResolver = operationalWarehouseResolver;
        _requestContext = requestContext;
        _purchasingRouter = new SupplementalMaterialRequestPurchasingRouter(
            context, unitOfWork, transactionRunner, operationalWarehouseResolver, requestContext);
    }

    public async Task<PagedResponseDto<SupplementalMaterialRequestDto>> GetPagedAsync(
        SupplementalMaterialRequestFilterDto request,
        string? scopedWarehouseId = null)
    {
        EnsureDefaultMode();
        var pageNumber = Math.Max(request.PageNumber, 1);
        var pageSize = Math.Clamp(request.PageSize, 1, 100);
        var query = _context.Supplementalmaterialrequests.AsNoTracking().AsQueryable();

        var warehouseId = await SupplementalMaterialRequestQueryPolicy.ResolveCanonicalScopeAsync(_operationalWarehouseResolver, request.WarehouseId, scopedWarehouseId);
        query = query.Where(item => item.WarehouseId == warehouseId);
        query = query.Where(item =>
            _context.Inventoryissuelines.Any(line =>
                line.IssueLineId.SequenceEqual(item.IssueLineId) &&
                line.MaterialRequestLineId != null &&
                line.ReconciliationBatchLineId == null) &&
            _context.Inventoryissues.Any(issue =>
                issue.IssueId.SequenceEqual(item.IssueId) &&
                issue.MaterialRequestId != null &&
                issue.ReconciliationBatchId == null));

        if (!string.IsNullOrWhiteSpace(request.Status))
        {
            var status = NormalizeStatus(request.Status);
            query = query.Where(item => item.Status == status ||
                (status == PendingStatus && item.Status == "PENDING"));
        }

        query = SupplementalMaterialRequestQueryPolicy.ApplySearch(query, _context, request.SearchKeyword);
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
        EnsureDefaultMode();
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

        await SupplementalMaterialRequestQueryPolicy.EnsureCanonicalWarehouseAsync(_operationalWarehouseResolver, entity.WarehouseId, scopedWarehouseId);
        return await MapAsync(entity);
    }

    public async Task<SupplementalMaterialRequestDto> CreateAsync(
        CreateSupplementalMaterialRequest request,
        string actorUserId,
        string? scopedWarehouseId = null)
    {
        EnsureDefaultMode();
        var commandId = RequireCommandId(request.CommandId);
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

        SemaphoreSlim? inMemoryLock = null;
        if (IsInMemory(_context))
        {
            inMemoryLock = InMemoryIssueLineLocks.GetOrAdd(
                Convert.ToHexString(issueLineId),
                static _ => new SemaphoreSlim(1, 1));
            await inMemoryLock.WaitAsync();
        }

        try
        {
            var recorder = new LifecycleTransitionRecorder(_context);
            var replay = await _context.Lifecyclecommandreceipts.AsNoTracking()
                .SingleOrDefaultAsync(item => item.CommandId == commandId && item.AggregateType == AggregateType);
            if (replay is not null)
            {
                return DeserializeResponse(replay.ResponseJson);
            }
            var (operationKey, expectedModeVersion) = RequiredModeProtection();
            return await _transactionRunner.ExecuteProtectedAsync(
                operationKey,
                expectedModeVersion,
                async _ =>
                {
                    var source = await SupplementalMaterialRequestSourceLoader.LoadForCreateAsync(_context, issueLineId);
                    if (!source.IssueId.SequenceEqual(issueId))
                    {
                        throw new BusinessRuleException("Dòng nguyên liệu không thuộc phiếu xuất đã chọn.");
                    }
                    if (source.MaterialRequestLineId is null)
                    {
                        throw new BusinessRuleException(
                            "Dòng xuất gốc chưa có lineage nhu cầu; cần đối soát trước khi tạo yêu cầu bổ sung.");
                    }
                    if (source.Issue.ReceivedAt is null)
                    {
                        throw new BusinessRuleException("Bếp cần xác nhận đã nhận phiếu xuất trước khi yêu cầu bổ sung.");
                    }

                    await SupplementalMaterialRequestQueryPolicy.EnsureCanonicalWarehouseAsync(_operationalWarehouseResolver, source.Issue.WarehouseId, scopedWarehouseId);

                    // One issue line owns one active deficit. Returning the existing
                    // exception is deliberate idempotency; merging quantities would
                    // silently change an already-routed purchasing obligation.
                    var existing = await FindOpenByIssueLineAsync(issueLineId);
                    if (existing is not null)
                    {
                        return await MapAsync(existing, source);
                    }

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
                    AddAudit(_context, entity, actorId, "Create", null, PendingStatus, "Bếp gửi yêu cầu cấp nguyên liệu bổ sung tới kho.");
                    await _context.SaveChangesAsync();
                    var result = await MapAsync(entity, source);
                    result.ConcurrencyVersion = 1;
                    var response = JsonSerializer.Serialize(result);
                    recorder.Stage(new LifecycleTransitionRequest(
                        AggregateType, entity.RequestId, commandId, 0, null, PendingStatus, actorId, 0,
                        entity.Reason, commandId, null, response, response));
                    await _context.SaveChangesAsync();
                    return result;
                },
                token => _context.Lifecyclecommandreceipts.AsNoTracking()
                    .AnyAsync(item => item.CommandId == commandId && item.AggregateType == AggregateType, token),
                IsolationLevel.Serializable);
        }
        catch (DbUpdateException exception) when (IsOpenIssueLineUniqueViolation(exception))
        {
            // The generated unique column is the cross-process concurrency fence.
            // A concurrent winner is the idempotent result for this source line.
            if (!IsInMemory(_context))
            {
                _context.ChangeTracker.Clear();
            }
            var existing = await FindOpenByIssueLineAsync(issueLineId);
            if (existing is not null)
            {
                return await MapAsync(existing);
            }

            throw;
        }
        finally
        {
            inMemoryLock?.Release();
        }
    }

    public async Task<SupplementalMaterialRequestDto> FulfillAsync(
        string id,
        FulfillSupplementalMaterialRequest request,
        string actorUserId,
        string? scopedWarehouseId = null)
    {
        EnsureDefaultMode();
        var commandId = RequireCommandId(request.CommandId);
        var actorId = ParseActor(actorUserId);
        var requestedQuantity = DecimalPolicy.RoundQuantity(request.Quantity);
        if (requestedQuantity <= 0)
        {
            throw new ArgumentException("Số lượng cấp bổ sung phải lớn hơn 0.");
        }

        var issueId = GuidHelper.NewId();
        var issueCode = $"ISS-SUP-{DateTime.UtcNow:yyyyMMdd-HHmmss}-{Guid.NewGuid().ToString("N")[..4].ToUpperInvariant()}";
        var requestId = GuidHelper.ParseGuidString(id) ?? throw new ArgumentException("Yêu cầu bổ sung không hợp lệ.");
        var recorder = new LifecycleTransitionRecorder(_context);
        var replay = await recorder.FindExistingCommandAsync(commandId, AggregateType, requestId);
        if (replay is not null)
        {
            return DeserializeResponse(replay.ResponseJson);
        }
        var (operationKey, expectedModeVersion) = RequiredModeProtection();
        return await _transactionRunner.ExecuteProtectedAsync(
            operationKey,
            expectedModeVersion,
            async _ =>
            {
                var entity = await LoadTrackedAsync(_context, id);
                await SupplementalMaterialRequestQueryPolicy.EnsureCanonicalWarehouseAsync(_operationalWarehouseResolver, entity.WarehouseId, scopedWarehouseId);
                EnsureActionable(entity);

                var source = await LoadSourceLineAsync(entity);
                var sourceShiftName = await SupplementalMaterialRequestSourceLoader.ResolveShiftNameAsync(_context, source);
                var current = await MapAsync(entity, source);
                if (request.ExpectedVersion != current.ConcurrencyVersion)
                {
                    throw new DbUpdateConcurrencyException("Yêu cầu bổ sung đã thay đổi; hãy tải lại trạng thái.");
                }
                if (requestedQuantity > current.RemainingQty)
                {
                    throw new BusinessRuleException($"Số lượng cấp vượt phần còn thiếu {current.RemainingQty} {current.UnitName}.");
                }
                if (requestedQuantity > current.AvailableQty)
                {
                    throw new BusinessRuleException($"Kho chỉ còn {current.AvailableQty} {current.UnitName}; hãy cấp một phần hoặc chuyển phần thiếu sang thu mua.");
                }

                var issue = new InventoryIssue
                {
                    IssueId = issueId,
                    IssueCode = issueCode,
                    IssueDate = source.Issue.IssueDate,
                    ShiftName = sourceShiftName,
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
                    MaterialRequestLineId = source.MaterialRequestLineId
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
                AddAudit(_context,
                    entity,
                    actorId,
                    FulfillmentIssueAuditField,
                    oldStatus,
                    GuidHelper.ToGuidString(issue.IssueId),
                    $"Kho cấp {requestedQuantity} {source.Unit.UnitName} bằng phiếu {issue.IssueCode}.");

                await _unitOfWork.SaveChangesAsync();
                var result = await MapAsync(entity, source);
                result.ConcurrencyVersion = checked(request.ExpectedVersion + 1);
                var response = JsonSerializer.Serialize(result);
                recorder.Stage(new LifecycleTransitionRequest(
                    AggregateType, entity.RequestId, commandId, checked((int)request.ExpectedVersion), oldStatus,
                    entity.Status, actorId, request.ExpectedVersion,
                    $"Kho cấp {requestedQuantity} {source.Unit.UnitName} bằng phiếu {issue.IssueCode}.",
                    commandId, null, response, response));
                await _unitOfWork.SaveChangesAsync();
                return result;
            },
            async token => await recorder.FindExistingCommandAsync(commandId, AggregateType, requestId, token) is not null,
            IsolationLevel.Serializable);
    }

    public Task<SupplementalMaterialRequestDto> RouteToPurchasingAsync(
        string id,
        RouteSupplementalMaterialRequestToPurchasing request,
        string actorUserId,
        string? scopedWarehouseId = null)
        => _purchasingRouter.RouteAsync(id, request, actorUserId, scopedWarehouseId);

    public async Task<SupplementalMaterialRequestDto> RejectAsync(
        string id,
        RejectSupplementalMaterialRequest request,
        string actorUserId,
        string? scopedWarehouseId = null)
    {
        EnsureDefaultMode();
        var commandId = RequireCommandId(request.CommandId);
        var actorId = ParseActor(actorUserId);
        var requestId = GuidHelper.ParseGuidString(id) ?? throw new ArgumentException("Yêu cầu bổ sung không hợp lệ.");
        var recorder = new LifecycleTransitionRecorder(_context);
        var replay = await recorder.FindExistingCommandAsync(commandId, AggregateType, requestId);
        if (replay is not null)
        {
            return DeserializeResponse(replay.ResponseJson);
        }

        var reason = request.Reason?.Trim();
        if (string.IsNullOrWhiteSpace(reason))
        {
            throw new ArgumentException("Cần nhập lý do từ chối yêu cầu bổ sung.");
        }

        var (operationKey, expectedModeVersion) = RequiredModeProtection();
        return await _transactionRunner.ExecuteProtectedAsync(
            operationKey,
            expectedModeVersion,
            async _ =>
            {
                var entity = await LoadTrackedAsync(_context, id);
                await SupplementalMaterialRequestQueryPolicy.EnsureCanonicalWarehouseAsync(_operationalWarehouseResolver, entity.WarehouseId, scopedWarehouseId);
                EnsureActionable(entity);
                var current = await MapAsync(entity);
                if (request.ExpectedVersion != current.ConcurrencyVersion)
                {
                    throw new DbUpdateConcurrencyException("Yêu cầu bổ sung đã thay đổi; hãy tải lại trạng thái.");
                }
                if (current.FulfilledQty > 0 || current.PurchaseRequestId is not null)
                {
                    throw new BusinessRuleException("Không thể từ chối yêu cầu đã cấp một phần hoặc đã chuyển sang thu mua.");
                }

                var oldStatus = entity.Status;
                entity.Status = RejectedStatus;
                AddAudit(_context, entity, actorId, "Reject", oldStatus, RejectedStatus, reason);
                await _context.SaveChangesAsync();
                var result = await MapAsync(entity);
                result.ConcurrencyVersion = checked(request.ExpectedVersion + 1);
                var response = JsonSerializer.Serialize(result);
                recorder.Stage(new LifecycleTransitionRequest(
                    AggregateType, entity.RequestId, commandId, checked((int)request.ExpectedVersion), oldStatus,
                    RejectedStatus, actorId, request.ExpectedVersion, reason, commandId, null, response, response));
                await _context.SaveChangesAsync();
                return result;
            },
            async token => await recorder.FindExistingCommandAsync(commandId, AggregateType, requestId, token) is not null,
            IsolationLevel.Serializable);
    }

    private async Task<SupplementalMaterialRequestDto> MapAsync(
        SupplementalMaterialRequest entity,
        InventoryIssueLine? loadedSource = null)
    {
        var source = loadedSource ?? await LoadSourceLineAsync(entity);
        return await SupplementalMaterialRequestMapper.MapAsync(_context, entity, source);
    }

    private Task<InventoryIssueLine> LoadSourceLineAsync(SupplementalMaterialRequest entity)
        => SupplementalMaterialRequestSourceLoader.LoadAsync(_context, entity);

    private void EnsureDefaultMode()
    {
        if (_requestContext is not null
            && !string.Equals(_requestContext.Mode, SystemOperationEligibility.Default, StringComparison.Ordinal))
        {
            throw new BusinessRuleException("Yêu cầu cấp bổ sung chỉ khả dụng trong chế độ DEFAULT.");
        }
    }

    private (string OperationKey, long ExpectedModeVersion) RequiredModeProtection() =>
        _requestContext is null
            ? throw new InvalidOperationException("Thiếu ngữ cảnh mode/version cho yêu cầu cấp bổ sung.")
            : (_requestContext.OperationKey, _requestContext.ExpectedModeVersion) switch
            {
                ({ Length: > 0 } operationKey, long expectedModeVersion) => (operationKey, expectedModeVersion),
                _ => throw new InvalidOperationException("Thiếu ngữ cảnh mode/version cho yêu cầu cấp bổ sung.")
            };

    private async Task<SupplementalMaterialRequest?> FindOpenByIssueLineAsync(byte[] issueLineId)
    {
        var candidates = IsInMemory(_context)
            ? (await _context.Supplementalmaterialrequests.ToListAsync())
                .Where(item => item.IssueLineId.SequenceEqual(issueLineId))
                .OrderByDescending(item => item.RequestedAt)
                .ToList()
            : await _context.Supplementalmaterialrequests
                .Where(item => item.IssueLineId == issueLineId)
                .OrderByDescending(item => item.RequestedAt)
                .ToListAsync();
        return candidates.FirstOrDefault(item =>
        {
            var status = NormalizeStatus(item.Status);
            return status is not RejectedStatus and not FulfilledStatus;
        });
    }




}
