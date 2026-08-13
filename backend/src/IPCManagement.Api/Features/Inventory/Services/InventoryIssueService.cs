using IPCManagement.Api.Helpers;
using IPCManagement.Api.Helpers.Mappers;
using IPCManagement.Api.Data;
using IPCManagement.Api.Data.Repositories;
using IPCManagement.Api.Data.Transactions;
using IPCManagement.Api.Exceptions;
using IPCManagement.Api.Models.Entities;
using Microsoft.EntityFrameworkCore;
using IPCManagement.Api.Features.Inventory.Contracts;
using IPCManagement.Api.Features.Inventory.Validators;
using IPCManagement.Api.Infrastructure.Lifecycle;
using IPCManagement.Api.Shared.Contracts;
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

    public InventoryIssueService(
        IInventoryIssueRepository issueRepository,
        IUnitOfWork unitOfWork,
        IStockLedgerService stockLedgerService,
        IEfTransactionRunner transactionRunner,
        IpcManagementContext? context = null)
    {
        _issueRepository = issueRepository;
        _unitOfWork = unitOfWork;
        _stockLedgerService = stockLedgerService;
        _transactionRunner = transactionRunner;
        _context = context;
    }

    public async Task<PagedResponseDto<InventoryIssueDto>> GetPagedAsync(InventoryIssueFilterRequestDto request)
    {
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

        var warehouseBytes = GuidHelper.ParseGuidString(dto.WarehouseId)
            ?? throw new ArgumentException("WarehouseId không hợp lệ.");
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

    private static IReadOnlyList<ResolvedIssueLine> ResolveIssueLines(
        CreateInventoryIssueRequest dto,
        MaterialRequest materialRequest,
        IReadOnlyList<InventoryIssueLine> issuedLines)
    {
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

        if (demandLines.Count == 0)
        {
            throw new BusinessRuleException("Nhu cầu nguyên liệu chưa có dòng để xuất kho.");
        }

        var alreadyIssuedBySource = BuildIssuedBySourceLine(demandLines, issuedLines);

        var inputLines = dto.Lines ?? [];
        var requestedLines = inputLines.Count == 0
            ? BuildLinesFromRemainingDemand(demandLines, alreadyIssuedBySource)
            : BuildLinesFromRequest(inputLines, demandLines, alreadyIssuedBySource);

        if (requestedLines.Count == 0)
        {
            throw new BusinessRuleException("Nhu cầu nguyên liệu đã được xuất đủ.");
        }

        return requestedLines;
    }

    private static List<ResolvedIssueLine> BuildLinesFromRemainingDemand(
        IReadOnlyList<DemandLineSummary> demandLines,
        IReadOnlyDictionary<string, decimal> alreadyIssuedBySource)
    {
        var lines = new List<ResolvedIssueLine>();
        foreach (var demand in demandLines)
        {
            var remaining = CalculateRemaining(
                demand.TotalRequiredQty,
                alreadyIssuedBySource.GetValueOrDefault(BuildSourceKey(demand.MaterialRequestLineId)));
            if (DecimalPolicy.GreaterThanQuantity(remaining, 0))
            {
                lines.Add(new ResolvedIssueLine(
                    demand.MaterialRequestLineId,
                    demand.IngredientId,
                    demand.UnitId,
                    remaining,
                    remaining));
            }
        }

        return lines;
    }

    private static List<ResolvedIssueLine> BuildLinesFromRequest(
        IReadOnlyList<CreateInventoryIssueLineRequest> inputLines,
        IReadOnlyList<DemandLineSummary> demandLines,
        IReadOnlyDictionary<string, decimal> alreadyIssuedBySource)
    {
        var result = new List<ResolvedIssueLine>();
        var requestedBySource = new Dictionary<string, decimal>();
        foreach (var input in inputLines)
        {
            var ingredientId = GuidHelper.ParseGuidString(input.IngredientId)
                ?? throw new ArgumentException($"IngredientId '{input.IngredientId}' không hợp lệ.");
            var unitId = GuidHelper.ParseGuidString(input.UnitId)
                ?? throw new ArgumentException($"UnitId '{input.UnitId}' không hợp lệ.");
            var requestedQty = DecimalPolicy.RoundQuantity(input.RequestedQty);
            var issuedQty = DecimalPolicy.RoundQuantity(input.IssuedQty);
            var explicitSourceId = string.IsNullOrWhiteSpace(input.MaterialRequestLineId)
                ? null
                : GuidHelper.ParseGuidString(input.MaterialRequestLineId)
                    ?? throw new ArgumentException($"MaterialRequestLineId '{input.MaterialRequestLineId}' không hợp lệ.");
            var candidates = demandLines
                .Where(demand => demand.IngredientId.SequenceEqual(ingredientId) && demand.UnitId.SequenceEqual(unitId))
                .ToList();
            if (explicitSourceId is null && candidates.Count > 1)
            {
                throw new BusinessRuleException("Nhu cầu có nhiều dòng cùng nguyên liệu và đơn vị; cần chỉ rõ MaterialRequestLineId.");
            }
            var demand = explicitSourceId is null
                ? candidates.SingleOrDefault()
                : candidates.SingleOrDefault(candidate => candidate.MaterialRequestLineId.SequenceEqual(explicitSourceId));
            if (demand is null)
            {
                throw new BusinessRuleException("Dòng xuất kho không nằm trong nhu cầu nguyên liệu đã duyệt.");
            }

            if (!DecimalPolicy.GreaterThanQuantity(requestedQty, 0) ||
                !DecimalPolicy.GreaterThanQuantity(issuedQty, 0))
            {
                throw new BusinessRuleException("Số lượng xuất kho phải lớn hơn 0.");
            }
            if (DecimalPolicy.GreaterThanQuantity(issuedQty, requestedQty))
            {
                throw new BusinessRuleException("Số lượng xuất không được lớn hơn số lượng yêu cầu.");
            }

            var sourceKey = BuildSourceKey(demand.MaterialRequestLineId);
            if (requestedBySource.ContainsKey(sourceKey))
            {
                throw new BusinessRuleException("Mỗi dòng nhu cầu chỉ được xuất một lần trong cùng lệnh.");
            }
            var requestedEarlier = requestedBySource.GetValueOrDefault(sourceKey);
            var remaining = CalculateRemaining(
                demand.TotalRequiredQty,
                alreadyIssuedBySource.GetValueOrDefault(sourceKey) + requestedEarlier);
            if (DecimalPolicy.GreaterThanQuantity(requestedQty, remaining))
            {
                throw new BusinessRuleException(
                    $"Dòng xuất kho '{demand.IngredientName}' vượt nhu cầu còn lại. Yêu cầu: {requestedQty}, còn lại: {remaining}.");
            }

            requestedBySource[sourceKey] = requestedEarlier + requestedQty;
            result.Add(new ResolvedIssueLine(demand.MaterialRequestLineId, ingredientId, unitId, requestedQty, issuedQty));
        }

        return result;
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

    private static decimal CalculateRemaining(decimal requiredQty, decimal issuedQty)
        => DecimalPolicy.RoundQuantity(requiredQty - issuedQty);

    private static string BuildKey(byte[] ingredientId, byte[] unitId)
        => $"{Convert.ToHexString(ingredientId)}:{Convert.ToHexString(unitId)}";

    private static string BuildSourceKey(byte[] materialRequestLineId)
        => Convert.ToHexString(materialRequestLineId);

    private static Dictionary<string, decimal> BuildIssuedBySourceLine(
        IReadOnlyList<DemandLineSummary> demandLines,
        IReadOnlyList<InventoryIssueLine> issuedLines)
    {
        var issuedBySource = issuedLines
            .Where(line => line.MaterialRequestLineId is not null)
            .GroupBy(line => BuildSourceKey(line.MaterialRequestLineId!))
            .ToDictionary(group => group.Key, group => DecimalPolicy.RoundQuantity(group.Sum(line => line.IssuedQty)));
        var legacyIssuedByItem = issuedLines
            .Where(line => line.MaterialRequestLineId is null)
            .GroupBy(line => BuildKey(line.IngredientId, line.UnitId))
            .ToDictionary(group => group.Key, group => DecimalPolicy.RoundQuantity(group.Sum(line => line.IssuedQty)));

        foreach (var (itemKey, legacyQuantity) in legacyIssuedByItem)
        {
            if (!DecimalPolicy.GreaterThanQuantity(legacyQuantity, 0))
            {
                continue;
            }
            var sourceCandidates = demandLines
                .Where(demand => BuildKey(demand.IngredientId, demand.UnitId) == itemKey)
                .ToList();
            if (sourceCandidates.Count != 1)
            {
                throw new BusinessRuleException(
                    "Có dòng xuất lịch sử chưa có lineage nhưng nhu cầu có nhiều dòng cùng nguyên liệu/đơn vị; cần đối soát trước khi xuất thêm.");
            }
            var sourceKey = BuildSourceKey(sourceCandidates[0].MaterialRequestLineId);
            issuedBySource[sourceKey] = DecimalPolicy.RoundQuantity(
                issuedBySource.GetValueOrDefault(sourceKey) + legacyQuantity);
        }

        return issuedBySource;
    }

    private sealed record DemandLineSummary(
        byte[] MaterialRequestLineId,
        byte[] IngredientId,
        byte[] UnitId,
        string? IngredientName,
        string? UnitName,
        decimal TotalRequiredQty);

    private sealed record ResolvedIssueLine(
        byte[] MaterialRequestLineId,
        byte[] IngredientId,
        byte[] UnitId,
        decimal RequestedQty,
        decimal IssuedQty);

}
