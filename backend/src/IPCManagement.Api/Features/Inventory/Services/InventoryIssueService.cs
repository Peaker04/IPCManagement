using IPCManagement.Api.Helpers;
using IPCManagement.Api.Helpers.Mappers;
using IPCManagement.Api.Data;
using IPCManagement.Api.Data.Repositories;
using IPCManagement.Api.Data.Transactions;
using IPCManagement.Api.Exceptions;
using IPCManagement.Api.Models.Entities;
using Microsoft.EntityFrameworkCore;
using static IPCManagement.Api.Features.Inventory.Services.InventoryIssueLineResolver;
using IPCManagement.Api.Features.Inventory.Contracts;
using IPCManagement.Api.Features.Inventory.Validators;
using IPCManagement.Api.Infrastructure.Lifecycle;
using IPCManagement.Api.Shared.Contracts;
using IPCManagement.Api.Features.SystemOperation.Services;
using System.Data;
using System.Text.Json;
namespace IPCManagement.Api.Features.Inventory.Services;
public interface IInventoryIssuePreWriteGate { Task WaitAsync(CancellationToken token); }
public class InventoryIssueService : IInventoryIssueService
{
    private static readonly HashSet<string> IssuableDemandStatuses = new(StringComparer.OrdinalIgnoreCase)
    {
        "MANAGERAPPROVED",
        "APPROVED",
        "SENTTOWAREHOUSE"
    };
    private readonly IInventoryIssueRepository _issueRepository;
    private readonly IUnitOfWork _unitOfWork;
    private readonly IStockLedgerService _stockLedgerService;
    private readonly IEfTransactionRunner _transactionRunner;
    private readonly IpcManagementContext? _context;
    private readonly IOperationalWarehouseResolver _operationalWarehouseResolver;
    private readonly SystemOperationRequestContext? _requestContext;
    private readonly SystemOperationModeGuard? _modeGuard;
    private readonly IInventoryIssuePreWriteGate? _preWriteGate;
    private readonly IMaterialRequestCompletionTransitionService _materialRequestCompletionTransition;

    public InventoryIssueService(
        IInventoryIssueRepository issueRepository,
        IUnitOfWork unitOfWork,
        IStockLedgerService stockLedgerService,
        IEfTransactionRunner transactionRunner,
        IOperationalWarehouseResolver operationalWarehouseResolver,
        IMaterialRequestCompletionTransitionService materialRequestCompletionTransition,
        IpcManagementContext? context = null,
        SystemOperationRequestContext? requestContext = null,
        SystemOperationModeGuard? modeGuard = null,
        IInventoryIssuePreWriteGate? preWriteGate = null)
    {
        _issueRepository = issueRepository;
        _unitOfWork = unitOfWork;
        _stockLedgerService = stockLedgerService;
        _transactionRunner = transactionRunner;
        _operationalWarehouseResolver = operationalWarehouseResolver;
        _context = context;
        _requestContext = requestContext;
        _modeGuard = modeGuard;
        _preWriteGate = preWriteGate;
        _materialRequestCompletionTransition = materialRequestCompletionTransition ??
            throw new ArgumentNullException(nameof(materialRequestCompletionTransition));
    }

    public async Task<PagedResponseDto<InventoryIssueDto>> GetPagedAsync(InventoryIssueFilterRequestDto request)
    {
        request.WarehouseId = GuidHelper.ToGuidString(await ResolveCanonicalWarehouseFilterAsync(request.WarehouseId));
        var (items, totalCount) = await _issueRepository.GetPagedAsync(request);

        return PagedResponseDto<InventoryIssueDto>.Create(
            items.Select(issue => InventoryMapper.MapIssue(issue)),
            totalCount,
            request.PageNumber,
            request.PageSize);
    }

    public async Task<InventoryIssueDto?> GetByIdAsync(
        string id,
        string sourceFamily = InventoryIssueSourceFamilies.Default)
    {
        var bytes = GuidHelper.ParseGuidString(id);
        if (bytes is null) return null;

        var issue = await _issueRepository.GetByIdWithLinesAsync(bytes, sourceFamily);
        return issue is null ? null : InventoryMapper.MapIssue(issue, includeLines: true);
    }

    public async Task<InventoryIssueCreatedDto?> CreateAsync(CreateInventoryIssueRequest dto, string? userId)
    {
        var userIdBytes = GuidHelper.ParseGuidString(userId);
        if (userIdBytes is null) return null;

        var hasMaterialSource = !string.IsNullOrWhiteSpace(dto.MaterialRequestId);
        var hasReconciliationSource = !string.IsNullOrWhiteSpace(dto.ReconciliationBatchId);
        if (hasMaterialSource == hasReconciliationSource)
            throw new ArgumentException("Phiếu xuất phải có đúng một nguồn nhu cầu hoặc lô đối chiếu.");
        foreach (var line in dto.Lines ?? [])
        {
            var hasMaterialLineSource = !string.IsNullOrWhiteSpace(line.MaterialRequestLineId);
            var hasReconciliationLineSource = !string.IsNullOrWhiteSpace(line.ReconciliationBatchLineId);
            if (hasMaterialLineSource && hasReconciliationLineSource)
                throw new ArgumentException("Dòng xuất phải có đúng một nguồn và cùng họ nguồn với phiếu xuất.");
            if (hasReconciliationSource != hasReconciliationLineSource)
                throw new ArgumentException("Dòng xuất phải có đúng một nguồn và cùng họ nguồn với phiếu xuất.");
        }
        if (hasReconciliationSource)
            return await CreateFromReconciliationAsync(dto, userIdBytes);

        EnsureOwningMode(SystemOperationEligibility.Default,
            "Nguồn nhu cầu chỉ được xuất trong chế độ DEFAULT.");
        var modeProtection = OptionalModeProtection(OperationDisposition.ExcludedInMaterialReconciliation);
        var warehouseBytes = await ResolveCanonicalWarehouseAsync(dto.WarehouseId);
        var materialRequestBytes = GuidHelper.ParseGuidString(dto.MaterialRequestId)
            ?? throw new ArgumentException("MaterialRequestId không hợp lệ.");
        var commandId = dto.CommandId?.Trim() ?? string.Empty;
        var hasLifecycleIdentity = commandId.Length > 0;
        var recorder = _context is null ? null : new LifecycleTransitionRecorder(_context);
        if (hasLifecycleIdentity && recorder is not null)
        {
            var replay = await recorder.FindExistingCommandAsync(commandId, nameof(InventoryIssue), materialRequestBytes);
            if (replay is not null)
            {
                return JsonSerializer.Deserialize<InventoryIssueCreatedDto>(replay.ResponseJson)
                    ?? throw new InvalidOperationException("Không thể đọc lại kết quả tạo phiếu xuất kho.");
            }
        }
        var issueId = GuidHelper.NewId();
        var issueCode = $"ISS-{DateTime.Now:yyyyMMdd-HHmmss}-{Guid.NewGuid().ToString("N")[..4].ToUpper()}";
        try
        {
            return await ExecuteWithOptionalModeProtectionAsync(
                modeProtection,
                async _ =>
                {
                    var materialRequest = await _issueRepository.GetMaterialRequestForIssueAsync(materialRequestBytes)
                        ?? throw new BusinessRuleException("Không tìm thấy nhu cầu nguyên liệu để tạo phiếu xuất kho.");
                    var issuedLines = await _issueRepository.GetIssuedLinesForMaterialRequestAsync(materialRequestBytes);
                    if (hasLifecycleIdentity)
                    {
                        var currentVersion = await _context!.Inventoryissues.LongCountAsync(item => item.MaterialRequestId == materialRequestBytes);
                        if (dto.ExpectedVersion != currentVersion)
                        {
                            throw new DbUpdateConcurrencyException("Nhu cầu xuất kho đã thay đổi; hãy tải lại trước khi xác nhận.");
                        }
                    }
                    if (!IssuableDemandStatuses.Contains(materialRequest.Status))
                    {
                        throw new BusinessRuleException("Cần duyệt nhu cầu nguyên liệu trước khi xuất kho.");
                    }

                    var issueLines = ResolveIssueLines(dto, materialRequest, issuedLines);
                    await InventoryIssueStockValidator.EnsureAvailableAsync(
                        _context,
                        warehouseBytes,
                        dto.IssueDate,
                        materialRequest,
                        issueLines.Select(line => new InventoryIssueStockLine(
                            line.IngredientId,
                            line.UnitId,
                            line.IssuedQty)));

                    var issue = new InventoryIssue
                    {
                        IssueId = issueId,
                        IssueCode = issueCode,
                        IssueDate = dto.IssueDate,
                        ShiftName = dto.ShiftName,
                        WarehouseId = warehouseBytes,
                        MaterialRequestId = materialRequestBytes,
                        IssuedBy = userIdBytes,
                        CreatedAt = DateTime.UtcNow
                    };

                    issue.Inventoryissuelines = issueLines.Select(line => new InventoryIssueLine
                    {
                        IssueLineId = GuidHelper.NewId(),
                        IssueId = issue.IssueId,
                        IngredientId = line.IngredientId,
                        RequestedQty = line.RequestedQty,
                        IssuedQty = line.IssuedQty,
                        UnitId = line.UnitId,
                        MaterialRequestLineId = line.MaterialRequestLineId
                    }).ToList();

                    _issueRepository.Add(issue);

                    foreach (var line in issue.Inventoryissuelines)
                    {
                        await _stockLedgerService.RemoveStockWithCheckAsync(
                            warehouseBytes,
                            line.IngredientId,
                            line.UnitId,
                            line.IssuedQty,
                            "ISSUE",
                            "inventoryissues",
                            issue.IssueId,
                            userIdBytes,
                            "Xuất kho sản xuất",
                            $"Phiếu xuất {issue.IssueCode}");
                    }

                    var completionLines = issueLines.Select(line =>
                        new MaterialRequestCompletionIssueLine(line.MaterialRequestLineId, line.IssuedQty)).ToList();
                    _materialRequestCompletionTransition.Stage(new(
                        materialRequest, issuedLines, completionLines, userIdBytes));

                    await _unitOfWork.SaveChangesAsync();

                    var result = new InventoryIssueCreatedDto
                    {
                        IssueId = GuidHelper.ToGuidString(issue.IssueId),
                        IssueCode = issue.IssueCode,
                        ConcurrencyVersion = hasLifecycleIdentity ? checked(dto.ExpectedVersion + 1) : 0,
                    };
                    if (hasLifecycleIdentity && recorder is not null)
                    {
                        var response = JsonSerializer.Serialize(result);
                        recorder.Stage(new LifecycleTransitionRequest(
                            nameof(InventoryIssue), materialRequestBytes, commandId, checked((int)result.ConcurrencyVersion),
                            dto.ExpectedVersion == 0 ? null : "PARTIALLY_ISSUED", "ISSUED", userIdBytes,
                            dto.ExpectedVersion, $"Tạo phiếu xuất {issue.IssueCode} cho nhu cầu đã chọn.",
                            dto.CorrelationId?.Trim(), dto.CausationId?.Trim(), response, response));
                        await _unitOfWork.SaveChangesAsync();
                    }

                    return result;
                },
                async token => hasLifecycleIdentity && recorder is not null
                    ? await recorder.FindExistingCommandAsync(commandId, nameof(InventoryIssue), materialRequestBytes, token) is not null
                    : await _issueRepository.GetByIdWithLinesAsync(issueId) is not null,
                hasLifecycleIdentity ? IsolationLevel.Serializable : IsolationLevel.ReadCommitted);
        }
        catch (StockShortageException ex)
        {
            await WriteStockShortageAuditAsync(ex.Shortage, materialRequestBytes, userIdBytes, commandId);
            throw;
        }
    }

    public async Task<InventoryIssueDto?> ConfirmReceiptAsync(
        string id,
        ConfirmInventoryIssueReceiptRequest dto,
        string? userId)
    {
        if (_context is null)
        {
            throw new InvalidOperationException("Chưa cấu hình dữ liệu để xác nhận bếp nhận nguyên liệu.");
        }

        var issueId = GuidHelper.ParseGuidString(id);
        var userIdBytes = GuidHelper.ParseGuidString(userId);
        if (issueId is null || userIdBytes is null)
        {
            return null;
        }

        if (dto.HasDiscrepancy && string.IsNullOrWhiteSpace(dto.DiscrepancyNote))
        {
            throw new ArgumentException("Vui lòng ghi rõ chênh lệch khi bếp nhận nguyên liệu.");
        }

        var sourceFamily = await _context.Inventoryissues.AsNoTracking()
            .Where(item => item.IssueId == issueId)
            .Select(item => new { item.MaterialRequestId, item.ReconciliationBatchId })
            .SingleOrDefaultAsync();
        if (sourceFamily is null)
            return null;
        var isDefaultSource = sourceFamily.MaterialRequestId is not null && sourceFamily.ReconciliationBatchId is null;
        var isReconciliationSource = sourceFamily.MaterialRequestId is null && sourceFamily.ReconciliationBatchId is not null;
        if (!isDefaultSource && !isReconciliationSource)
            throw new BusinessRuleException("Phiếu xuất không có đúng một source lineage để xác nhận nhận hàng.");
        var owningMode = isDefaultSource ? SystemOperationEligibility.Default : SystemOperationEligibility.MaterialReconciliation;
        EnsureOwningMode(owningMode, "Phiếu xuất chỉ được tiếp tục khi workflow nguồn đang hoạt động.");
        var disposition = isDefaultSource
            ? OperationDisposition.ExcludedInMaterialReconciliation
            : OperationDisposition.ReconciliationOnly;
        var modeProtection = OptionalModeProtection(disposition);

        // Luồng này ghi vào inventoryissues, auditlogs và supplementalmaterialrequests. Không có
        // transaction thì phiếu có thể được đánh dấu "bếp đã nhận" trong khi nhu cầu bổ sung liên quan
        // vẫn treo ở trạng thái cũ. Theo đúng khuôn mẫu transaction của CreateAsync trong cùng file.
        // Đọc phiếu nằm trong transaction để chốt chặn hai request xác nhận song song.
        return await ExecuteWithOptionalModeProtectionAsync(
            modeProtection,
            async cancellationToken =>
            {
                var issue = await _context.Inventoryissues
                    .Include(item => item.Warehouse)
                    .Include(item => item.IssuedByNavigation)
                    .Include(item => item.ReceivedByNavigation)
                    .Include(item => item.Inventoryissuelines)
                        .ThenInclude(line => line.Ingredient)
                    .Include(item => item.Inventoryissuelines)
                        .ThenInclude(line => line.Unit)
                    .FirstOrDefaultAsync(item => item.IssueId == issueId, cancellationToken);
                if (issue is null)
                {
                    return null;
                }

                if (issue.ReceivedAt is not null)
                {
                    return InventoryMapper.MapIssue(issue, includeLines: true);
                }

                var confirmedAt = DateTime.UtcNow;
                issue.ReceivedBy = userIdBytes;
                issue.ReceivedAt = confirmedAt;

                _context.Auditlogs.Add(new AuditLog
                {
                    AuditId = GuidHelper.NewId(),
                    ChangedAt = confirmedAt,
                    ChangedBy = userIdBytes,
                    BusinessArea = "KitchenReceipt",
                    EntityName = nameof(InventoryIssue),
                    EntityId = issue.IssueId,
                    FieldName = "KitchenReceived",
                    OldValue = null,
                    NewValue = $"receivedAt={confirmedAt:O}",
                    Reason = $"Bếp xác nhận đã nhận nguyên liệu từ phiếu xuất {issue.IssueCode}."
                });

                if (dto.HasDiscrepancy)
                {
                    var note = dto.DiscrepancyNote!.Trim();
                    _context.Auditlogs.Add(new AuditLog
                    {
                        AuditId = GuidHelper.NewId(),
                        ChangedAt = confirmedAt,
                        ChangedBy = userIdBytes,
                        BusinessArea = "KitchenReceipt",
                        EntityName = nameof(InventoryIssue),
                        EntityId = issue.IssueId,
                        FieldName = "KitchenReceiptDiscrepancy",
                        OldValue = "expected=issued_qty",
                        NewValue = note,
                        Reason = $"Bếp báo chênh lệch khi nhận phiếu xuất {issue.IssueCode}: {note}"
                    });
                }

                var issueIdText = GuidHelper.ToGuidString(issue.IssueId);
                var supplementalLinks = await _context.Auditlogs
                    .Where(item => item.EntityName == nameof(SupplementalMaterialRequest) &&
                        item.FieldName == SupplementalMaterialRequestService.FulfillmentIssueAuditField &&
                        item.NewValue == issueIdText)
                    .ToListAsync();
                foreach (var link in supplementalLinks)
                {
                    var supplementalRequest = await _context.Supplementalmaterialrequests
                        .FirstOrDefaultAsync(item => item.RequestId == link.EntityId);
                    if (supplementalRequest is null)
                    {
                        continue;
                    }

                    var fulfilledQty = await _context.Stockmovements
                        .Where(item => item.RefTable == "supplementalmaterialrequests" &&
                            item.RefId == supplementalRequest.RequestId)
                        .SumAsync(item => (decimal?)item.QuantityOut) ?? 0;
                    var linkedIssueIds = await _context.Auditlogs
                        .Where(item => item.EntityName == nameof(SupplementalMaterialRequest) &&
                            item.EntityId == supplementalRequest.RequestId &&
                            item.FieldName == SupplementalMaterialRequestService.FulfillmentIssueAuditField)
                        .Select(item => item.NewValue)
                        .ToListAsync();
                    var parsedIssueIds = linkedIssueIds
                        .Select(GuidHelper.ParseGuidString)
                        .Where(item => item is not null)
                        .Select(item => item!)
                        .ToList();
                    var allLinkedIssuesReceived = parsedIssueIds.Count > 0;
                    foreach (var linkedIssueId in parsedIssueIds)
                    {
                        if (linkedIssueId.SequenceEqual(issue.IssueId))
                        {
                            continue;
                        }

                        if (!await _context.Inventoryissues.AnyAsync(item =>
                                item.IssueId == linkedIssueId && item.ReceivedAt != null))
                        {
                            allLinkedIssuesReceived = false;
                            break;
                        }
                    }

                    if (!DecimalPolicy.LessThanQuantity(fulfilledQty, supplementalRequest.RequestedQty) &&
                        allLinkedIssuesReceived)
                    {
                        var oldStatus = supplementalRequest.Status;
                        supplementalRequest.Status = "FULFILLED";
                        _context.Auditlogs.Add(new AuditLog
                        {
                            AuditId = GuidHelper.NewId(),
                            ChangedAt = confirmedAt,
                            ChangedBy = userIdBytes,
                            BusinessArea = "SupplementalMaterial",
                            EntityName = nameof(SupplementalMaterialRequest),
                            EntityId = supplementalRequest.RequestId,
                            FieldName = nameof(SupplementalMaterialRequest.Status),
                            OldValue = oldStatus,
                            NewValue = supplementalRequest.Status,
                            Reason = $"Bếp đã xác nhận nhận đủ nguyên liệu bổ sung qua phiếu {issue.IssueCode}."
                        });
                    }
                }

                await _context.SaveChangesAsync(cancellationToken);
                return InventoryMapper.MapIssue(issue, includeLines: true);
            },
            cancellationToken => _context.Inventoryissues
                .AsNoTracking()
                .AnyAsync(
                    item => item.IssueId == issueId && item.ReceivedAt != null,
                    cancellationToken),
            IsolationLevel.ReadCommitted);
    }

    private async Task<InventoryIssueCreatedDto> CreateFromReconciliationAsync(CreateInventoryIssueRequest dto, byte[] actorId)
    {
        if (_context is null) throw new InvalidOperationException("Chưa cấu hình dữ liệu cho xuất kho đối chiếu.");
        EnsureOwningMode(SystemOperationEligibility.MaterialReconciliation,
            "Nguồn đối chiếu chỉ được xuất trong chế độ đối chiếu nguyên liệu.");
        var batchId = GuidHelper.ParseGuidString(dto.ReconciliationBatchId)
            ?? throw new ArgumentException("ReconciliationBatchId không hợp lệ.");
        var commandId = dto.CommandId.Trim();
        if (commandId.Length == 0) throw new ArgumentException("CommandId là bắt buộc.");
        var recorder = new LifecycleTransitionRecorder(_context);
        var replay = await recorder.FindExistingCommandAsync(commandId, nameof(InventoryIssue), batchId);
        if (replay is not null)
            return JsonSerializer.Deserialize<InventoryIssueCreatedDto>(replay.ResponseJson)
                ?? throw new InvalidOperationException("Không thể đọc lại kết quả tạo phiếu xuất kho.");
        var warehouseId = await ResolveCanonicalWarehouseAsync(dto.WarehouseId);
        var issueId = GuidHelper.NewId();
        try
        {
            var (operationKey, expectedModeVersion) = RequiredModeProtection(OperationDisposition.ReconciliationOnly);
            return await _transactionRunner.ExecuteProtectedAsync(operationKey, expectedModeVersion, async token =>
            {
                var batch = await _context.Reconciliationbatches
                    .Include(item => item.Lines).ThenInclude(line => line.Ingredient)
                    .Include(item => item.Lines).ThenInclude(line => line.CanonicalUnit)
                    .SingleOrDefaultAsync(item => item.BatchId == batchId, token)
                    ?? throw new BusinessRuleException("Không tìm thấy lô đối chiếu để xuất kho.");
                if (batch.Status != "TRANSFERRED" || batch.Version != dto.ExpectedVersion)
                    throw new DbUpdateConcurrencyException("Danh sách xuất kho đã thay đổi; hãy tải lại trước khi xác nhận.");
                if (dto.Lines.Count == 0) throw new ArgumentException("Phiếu xuất kho phải có ít nhất một dòng nguồn.");
                var sourceById = batch.Lines.ToDictionary(line => Convert.ToHexString(line.BatchLineId), StringComparer.Ordinal);
                var resolved = new List<(ReconciliationBatchLine Source, decimal Quantity)>();
                foreach (var requested in dto.Lines)
                {
                    if (!string.IsNullOrWhiteSpace(requested.MaterialRequestLineId)
                        || string.IsNullOrWhiteSpace(requested.ReconciliationBatchLineId))
                        throw new BusinessRuleException("Dòng xuất phải thuộc đúng nguồn lô đối chiếu của phiếu.");
                    var sourceLineId = GuidHelper.ParseGuidString(requested.ReconciliationBatchLineId)
                        ?? throw new ArgumentException("ReconciliationBatchLineId không hợp lệ.");
                    if (!sourceById.TryGetValue(Convert.ToHexString(sourceLineId), out var source))
                        throw new BusinessRuleException("Dòng xuất kho không thuộc lô đối chiếu đã chuyển.");
                    if (!source.IngredientId.SequenceEqual(GuidHelper.ParseGuidString(requested.IngredientId) ?? [])
                        || !source.CanonicalUnitId.SequenceEqual(GuidHelper.ParseGuidString(requested.UnitId) ?? [])
                        || requested.RequestedQty != source.RequiredQuantity
                        || requested.IssuedQty != source.RequiredQuantity)
                        throw new BusinessRuleException("Nguyên liệu, đơn vị hoặc số lượng không khớp dòng nguồn đã đóng băng.");
                    resolved.Add((source, source.RequiredQuantity));
                }
                if (resolved.Select(item => Convert.ToHexString(item.Source.BatchLineId)).Distinct().Count() != resolved.Count)
                    throw new BusinessRuleException("Một dòng nguồn không thể xuất lặp trong cùng phiếu.");
                var requestedLineIds = resolved.Select(item => item.Source.BatchLineId).ToList();
                if (await _context.Inventoryissuelines.AnyAsync(item =>
                        item.ReconciliationBatchLineId != null && requestedLineIds.Contains(item.ReconciliationBatchLineId), token))
                    throw new ResourceConflictException("Một dòng đối chiếu đã có phiếu xuất kho liên kết.");
                await InventoryIssueStockValidator.EnsureAvailableAsync(_context, warehouseId, dto.IssueDate, batchId,
                    $"REC-{GuidHelper.ToGuidString(batchId)}", resolved.Select(item => new InventoryIssueStockLine(item.Source.IngredientId, item.Source.CanonicalUnitId, item.Quantity)));

                if (_preWriteGate is not null)
                    await _preWriteGate.WaitAsync(token);
                if (_modeGuard is not null)
                    await _modeGuard.ValidateAsync(operationKey, expectedModeVersion, OperationDisposition.ReconciliationOnly, token);

                var issue = new InventoryIssue
                {
                    IssueId = issueId, IssueCode = $"ISS-{DateTime.Now:yyyyMMdd-HHmmss}-{Guid.NewGuid().ToString("N")[..4].ToUpper()}",
                    IssueDate = dto.IssueDate, ShiftName = dto.ShiftName, WarehouseId = warehouseId,
                    ReconciliationBatchId = batchId, IssuedBy = actorId, CreatedAt = DateTime.UtcNow,
                    Inventoryissuelines = resolved.Select(item => new InventoryIssueLine
                    {
                        IssueLineId = GuidHelper.NewId(), IssueId = issueId, IngredientId = item.Source.IngredientId,
                        UnitId = item.Source.CanonicalUnitId, RequestedQty = item.Quantity, IssuedQty = item.Quantity,
                        ReconciliationBatchLineId = item.Source.BatchLineId
                    }).ToList()
                };
                _issueRepository.Add(issue);
                foreach (var line in issue.Inventoryissuelines)
                    await _stockLedgerService.RemoveStockWithCheckAsync(warehouseId, line.IngredientId, line.UnitId, line.IssuedQty,
                        "ISSUE", "inventoryissues", issueId, actorId, "Xuất kho đối chiếu", $"Phiếu xuất {issue.IssueCode}");
                await _unitOfWork.SaveChangesAsync();
                var result = new InventoryIssueCreatedDto { IssueId = GuidHelper.ToGuidString(issueId), IssueCode = issue.IssueCode, ConcurrencyVersion = 1 };
                var response = JsonSerializer.Serialize(result);
                recorder.Stage(new LifecycleTransitionRequest(nameof(InventoryIssue), batchId, commandId, 1, "TRANSFERRED", "ISSUED", actorId,
                    dto.ExpectedVersion, $"Tạo phiếu xuất {issue.IssueCode} từ lô đối chiếu.", dto.CorrelationId, dto.CausationId, response, response));
                await _unitOfWork.SaveChangesAsync();
                return result;
            }, async token => await recorder.FindExistingCommandAsync(commandId, nameof(InventoryIssue), batchId, token) is not null,
            IsolationLevel.Serializable);
        }
        catch (StockShortageException ex)
        {
            await WriteStockShortageAuditAsync(ex.Shortage, batchId, actorId, commandId);
            throw;
        }
    }

    private void EnsureOwningMode(string owningMode, string message)
    {
        if (_requestContext is not null && !string.Equals(_requestContext.Mode, owningMode, StringComparison.Ordinal))
            throw new BusinessRuleException(message);
    }

    private (string OperationKey, long ExpectedModeVersion)? OptionalModeProtection(OperationDisposition disposition)
    {
        if (_requestContext is null)
            return null;
        _requestContext.Disposition = disposition;
        return (_requestContext.OperationKey, _requestContext.ExpectedModeVersion) switch
        {
            ({ Length: > 0 } operationKey, long expectedModeVersion) => (operationKey, expectedModeVersion),
            _ => throw new InvalidOperationException("Thiếu ngữ cảnh bảo vệ chế độ vận hành cho phiếu xuất kho.")
        };
    }

    private (string OperationKey, long ExpectedModeVersion) RequiredModeProtection(OperationDisposition disposition)
        => OptionalModeProtection(disposition)
            ?? throw new InvalidOperationException("Thiếu ngữ cảnh bảo vệ chế độ vận hành cho phiếu xuất đối chiếu.");

    private Task<TResult> ExecuteWithOptionalModeProtectionAsync<TResult>(
        (string OperationKey, long ExpectedModeVersion)? protection,
        Func<CancellationToken, Task<TResult>> operation,
        Func<CancellationToken, Task<bool>> verifySucceeded,
        IsolationLevel isolationLevel)
        => protection is { } required
            ? _transactionRunner.ExecuteProtectedAsync(required.OperationKey, required.ExpectedModeVersion, operation, verifySucceeded, isolationLevel)
            : _transactionRunner.ExecuteAsync(operation, verifySucceeded, isolationLevel);

    private async Task WriteStockShortageAuditAsync(StockShortageIssueDto shortage, byte[] materialRequestId, byte[] actorId, string commandId)
    {
        if (_context is null)
        {
            return;
        }

        var changedAt = DateTime.UtcNow;
        if (commandId.Length > 0 && await _context.Auditlogs.AsNoTracking().AnyAsync(item =>
                item.BusinessArea == "StockException" && item.EntityId == materialRequestId && item.CorrelationId == commandId))
        {
            return;
        }
        foreach (var line in shortage.Lines)
        {
            _context.Auditlogs.Add(new AuditLog
            {
                AuditId = GuidHelper.NewId(),
                ChangedAt = changedAt,
                ChangedBy = actorId,
                BusinessArea = "StockException",
                EntityName = nameof(MaterialRequest),
                EntityId = materialRequestId,
                FieldName = "StockShortage",
                OldValue = $"available={line.AvailableQty}",
                NewValue = $"ingredient={line.IngredientName}; required={line.RequiredQty}; available={line.AvailableQty}; missing={line.MissingQty}; unit={line.UnitName}; date={shortage.IssueDate:yyyy-MM-dd}",
                Reason = $"Thiếu tồn kho {line.IngredientName}: cần {line.RequiredQty} {line.UnitName}, hiện có {line.AvailableQty} {line.UnitName} tại {shortage.WarehouseName ?? shortage.WarehouseId}."
                ,CorrelationId = commandId.Length > 0 ? commandId : null
            });
        }

        await _context.SaveChangesAsync();
    }

    private async Task<byte[]> ResolveCanonicalWarehouseAsync(string? suppliedWarehouseId)
    {
        var canonicalId = await _operationalWarehouseResolver.ResolveAsync();
        if (suppliedWarehouseId is null) return canonicalId;
        var suppliedId = GuidHelper.ParseGuidString(suppliedWarehouseId)
            ?? throw new ArgumentException("WarehouseId không hợp lệ.");
        if (!suppliedId.AsSpan().SequenceEqual(canonicalId))
            throw new BusinessRuleException("Kho trên yêu cầu không khớp kho vận hành của hệ thống.");
        return canonicalId;
    }

    private async Task<byte[]> ResolveCanonicalWarehouseFilterAsync(string? suppliedWarehouseId)
    {
        var canonicalId = await _operationalWarehouseResolver.ResolveAsync();
        if (suppliedWarehouseId is null) return canonicalId;
        var suppliedId = GuidHelper.ParseGuidString(suppliedWarehouseId)
            ?? throw new ArgumentException("WarehouseId không hợp lệ.");
        if (!suppliedId.AsSpan().SequenceEqual(canonicalId))
            throw new UnauthorizedAccessException("Phạm vi kho không khớp kho vận hành của hệ thống.");
        return canonicalId;
    }

}
