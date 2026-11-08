using System.Data;
using System.Text.Json;
using IPCManagement.Api.Data;
using IPCManagement.Api.Data.Transactions;
using IPCManagement.Api.Exceptions;
using IPCManagement.Api.Features.Inventory.Contracts;
using IPCManagement.Api.Features.SystemOperation.Services;
using IPCManagement.Api.Helpers;
using IPCManagement.Api.Infrastructure.Lifecycle;
using IPCManagement.Api.Models.Entities;
using Microsoft.EntityFrameworkCore;
using static IPCManagement.Api.Features.Inventory.Services.SupplementalMaterialRequestRules;

namespace IPCManagement.Api.Features.Inventory.Services;

internal sealed class SupplementalMaterialRequestPurchasingRouter
{
    private const string AggregateType = nameof(SupplementalMaterialRequest);
    private const string NeedsPurchaseStatus = "NEEDS_PURCHASE";
    private const string PurchaseRequestAuditField = "PurchaseRequestId";

    private readonly IpcManagementContext _context;
    private readonly IUnitOfWork _unitOfWork;
    private readonly IEfTransactionRunner _transactionRunner;
    private readonly IOperationalWarehouseResolver _operationalWarehouseResolver;
    private readonly SystemOperationRequestContext? _requestContext;

    internal SupplementalMaterialRequestPurchasingRouter(
        IpcManagementContext context,
        IUnitOfWork unitOfWork,
        IEfTransactionRunner transactionRunner,
        IOperationalWarehouseResolver operationalWarehouseResolver,
        SystemOperationRequestContext? requestContext)
    {
        _context = context;
        _unitOfWork = unitOfWork;
        _transactionRunner = transactionRunner;
        _operationalWarehouseResolver = operationalWarehouseResolver;
        _requestContext = requestContext;
    }

    internal async Task<SupplementalMaterialRequestDto> RouteAsync(
        string id,
        RouteSupplementalMaterialRequestToPurchasing request,
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
        var purchaseRequestId = GuidHelper.NewId();
        var purchaseRequestCode = $"PR-SUP-{DateTime.UtcNow:yyyyMMdd}-{Guid.NewGuid().ToString("N")[..4].ToUpperInvariant()}";
        var (operationKey, expectedModeVersion) = RequiredModeProtection();
        return await _transactionRunner.ExecuteProtectedAsync(
            operationKey,
            expectedModeVersion,
            async _ =>
            {
                var entity = await LoadTrackedAsync(_context, id);
                await SupplementalMaterialRequestQueryPolicy.EnsureCanonicalWarehouseAsync(_operationalWarehouseResolver, entity.WarehouseId, scopedWarehouseId);
                EnsureActionable(entity);

                var source = await SupplementalMaterialRequestSourceLoader.LoadAsync(_context, entity);
                var sourceShiftName = await SupplementalMaterialRequestSourceLoader.ResolveShiftNameAsync(_context, source);
                var current = await SupplementalMaterialRequestMapper.MapAsync(_context, entity, source);
                if (request.ExpectedVersion != current.ConcurrencyVersion)
                {
                    throw new DbUpdateConcurrencyException("Yêu cầu bổ sung đã thay đổi; hãy tải lại trạng thái.");
                }
                var purchaseQty = DecimalPolicy.RoundQuantity(current.RemainingQty - current.AvailableQty);
                if (purchaseQty <= 0)
                {
                    throw new BusinessRuleException("Kho đang đủ hàng cho phần còn thiếu; hãy tạo phiếu xuất bổ sung.");
                }
                if (current.PurchaseRequestId is not null)
                {
                    throw new BusinessRuleException($"Yêu cầu đã được chuyển sang thu mua bằng {current.PurchaseRequestCode}.");
                }

                if (source.MaterialRequestLineId is null)
                {
                    throw new BusinessRuleException("Dòng xuất gốc chưa có liên kết nhu cầu; không thể chuyển thiếu hụt sang thu mua một cách chính xác.");
                }

                var materialLine = await SupplementalMaterialRequestSourceLoader.LoadMaterialRequestLineAsync(
                    _context,
                    source.MaterialRequestLineId);

                var purchaseRequest = new PurchaseRequest
                {
                    PurchaseRequestId = purchaseRequestId,
                    PurchaseRequestCode = purchaseRequestCode,
                    RequestDate = DateOnly.FromDateTime(DateTime.UtcNow),
                    PurchaseForDate = source.Issue.IssueDate,
                    ShiftName = sourceShiftName,
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
                AddAudit(_context,
                    entity,
                    actorId,
                    PurchaseRequestAuditField,
                    oldStatus,
                    GuidHelper.ToGuidString(purchaseRequest.PurchaseRequestId),
                    $"Kho chuyển {purchaseQty} {source.Unit.UnitName} còn thiếu sang đề xuất {purchaseRequest.PurchaseRequestCode}.");

                await _unitOfWork.SaveChangesAsync();
                var result = await SupplementalMaterialRequestMapper.MapAsync(_context, entity, source);
                result.ConcurrencyVersion = checked(request.ExpectedVersion + 1);
                var response = JsonSerializer.Serialize(result);
                recorder.Stage(new LifecycleTransitionRequest(
                    AggregateType, entity.RequestId, commandId, checked((int)request.ExpectedVersion), oldStatus,
                    entity.Status, actorId, request.ExpectedVersion,
                    $"Kho chuyển {purchaseQty} {source.Unit.UnitName} còn thiếu sang đề xuất {purchaseRequest.PurchaseRequestCode}.",
                    commandId, null, response, response));
                await _unitOfWork.SaveChangesAsync();
                return result;
            },
            async token => await recorder.FindExistingCommandAsync(commandId, AggregateType, requestId, token) is not null,
            IsolationLevel.Serializable);
    }

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
}
