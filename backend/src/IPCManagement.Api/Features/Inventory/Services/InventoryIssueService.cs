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

    public InventoryIssueService(
        IInventoryIssueRepository issueRepository,
        IUnitOfWork unitOfWork,
        IStockLedgerService stockLedgerService,
        IEfTransactionRunner transactionRunner,
        IOperationalWarehouseResolver operationalWarehouseResolver,
        IpcManagementContext? context = null,
        SystemOperationRequestContext? requestContext = null)
    {
        _issueRepository = issueRepository;
        _unitOfWork = unitOfWork;
        _stockLedgerService = stockLedgerService;
        _transactionRunner = transactionRunner;
        _operationalWarehouseResolver = operationalWarehouseResolver;
        _context = context;
        _requestContext = requestContext;
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

    public async Task<InventoryIssueDto?> GetByIdAsync(string id)
    {
        var bytes = GuidHelper.ParseGuidString(id);
        if (bytes is null) return null;

        var issue = await _issueRepository.GetByIdWithLinesAsync(bytes);
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
        if (hasReconciliationSource)
            return await CreateFromReconciliationAsync(dto, userIdBytes);

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
            return await _transactionRunner.ExecuteAsync(
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

                    // Add issue using sync change tracking
                    _issueRepository.Add(issue);

                    // Cập nhật tồn kho hiện tại + ghi nhận stock movements
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

                    UpdateMaterialRequestStatusIfCompleted(materialRequest, issuedLines, issueLines, userIdBytes);

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

        // Luồng này ghi vào inventoryissues, auditlogs và supplementalmaterialrequests. Không có
        // transaction thì phiếu có thể được đánh dấu "bếp đã nhận" trong khi nhu cầu bổ sung liên quan
        // vẫn treo ở trạng thái cũ. Theo đúng khuôn mẫu transaction của CreateAsync trong cùng file.
        // Đọc phiếu nằm trong transaction để chốt chặn hai request xác nhận song song.
        return await _transactionRunner.ExecuteAsync(
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
                    throw new ResourceConflictException("Phiếu xuất này đã được bếp xác nhận nhận nguyên liệu.");
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
                    cancellationToken));
    }

    private async Task<InventoryIssueCreatedDto> CreateFromReconciliationAsync(CreateInventoryIssueRequest dto, byte[] actorId)
    {
        if (_context is null) throw new InvalidOperationException("Chưa cấu hình dữ liệu cho xuất kho đối chiếu.");
        if (_requestContext is not null && !string.Equals(_requestContext.Mode, SystemOperationEligibility.MaterialReconciliation, StringComparison.Ordinal))
            throw new BusinessRuleException("Nguồn đối chiếu chỉ được xuất trong chế độ đối chiếu nguyên liệu.");
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
            var (operationKey, expectedModeVersion) = RequiredModeProtection();
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

    private (string OperationKey, long ExpectedModeVersion) RequiredModeProtection() =>
        (_requestContext?.OperationKey, _requestContext?.ExpectedModeVersion) switch
        {
            ({ Length: > 0 } operationKey, long expectedModeVersion) => (operationKey, expectedModeVersion),
            _ => throw new InvalidOperationException("Thiếu ngữ cảnh bảo vệ chế độ vận hành cho phiếu xuất đối chiếu.")
        };

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

    private void UpdateMaterialRequestStatusIfCompleted(
        MaterialRequest materialRequest,
        IReadOnlyList<InventoryIssueLine> previouslyIssuedLines,
        IReadOnlyList<ResolvedIssueLine> currentIssueLines,
        byte[] userIdBytes)
    {
        if (_context is null) return;

        var demandLines = materialRequest.Materialrequestlines
            .OrderBy(line => Convert.ToHexString(line.RequestLineId))
            .Select(line => new DemandLineSummary(
                line.RequestLineId,
                line.IngredientId,
                line.UnitId,
                line.Ingredient.IngredientName,
                line.Unit.UnitName,
                DecimalPolicy.RoundQuantity(line.TotalRequiredQty)))
            .ToList();
        var alreadyIssuedBySource = BuildIssuedBySourceLine(demandLines, previouslyIssuedLines);

        foreach (var issueLine in currentIssueLines)
        {
            var sourceKey = BuildSourceKey(issueLine.MaterialRequestLineId);
            alreadyIssuedBySource[sourceKey] = alreadyIssuedBySource.GetValueOrDefault(sourceKey) + issueLine.IssuedQty;
        }

        var isFullyIssued = true;
        foreach (var demand in demandLines)
        {
            var totalIssued = alreadyIssuedBySource.GetValueOrDefault(BuildSourceKey(demand.MaterialRequestLineId), 0m);
            if (DecimalPolicy.LessThanQuantity(totalIssued, demand.TotalRequiredQty))
            {
                isFullyIssued = false;
                break;
            }
        }

        if (isFullyIssued)
        {
            var oldStatus = materialRequest.Status;
            var newStatus = "EXPORTED";
            if (!string.Equals(oldStatus, newStatus, StringComparison.OrdinalIgnoreCase))
            {
                materialRequest.Status = newStatus;
                _context.Auditlogs.Add(new AuditLog
                {
                    AuditId = GuidHelper.NewId(),
                    ChangedAt = DateTime.UtcNow,
                    ChangedBy = userIdBytes,
                    BusinessArea = "InventoryIssue",
                    EntityName = nameof(MaterialRequest),
                    EntityId = materialRequest.RequestId,
                    FieldName = nameof(MaterialRequest.Status),
                    OldValue = oldStatus,
                    NewValue = newStatus,
                    Reason = "Đã xuất đủ nguyên liệu, tự động chuyển trạng thái Nhu cầu thành EXPORTED."
                });
            }
        }
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
