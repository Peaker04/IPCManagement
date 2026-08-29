using IPCManagement.Api.Data;
using IPCManagement.Api.Data.Repositories;
using IPCManagement.Api.Data.Transactions;
using IPCManagement.Api.Exceptions;
using IPCManagement.Api.Helpers;
using IPCManagement.Api.Helpers.Mappers;
using IPCManagement.Api.Models.Entities;
using Microsoft.EntityFrameworkCore;
using static IPCManagement.Api.Features.Inventory.Services.InventoryReturnRules;
using IPCManagement.Api.Features.Inventory.Contracts;
using IPCManagement.Api.Shared.Contracts;
using IPCManagement.Api.Infrastructure.Lifecycle;
using IPCManagement.Api.Security;
using System.Data;
using System.Text.Json;
namespace IPCManagement.Api.Features.Inventory.Services;
public class InventoryReturnService : IInventoryReturnService
{
    private const string ReturnTypeReturn = "RETURN";
    private const string ReturnTypeWaste = "WASTE";
    private readonly IInventoryReturnRepository _returnRepository;
    private readonly IInventoryIssueRepository _issueRepository;
    private readonly IUnitOfWork _unitOfWork;
    private readonly IStockLedgerService _stockLedgerService;
    private readonly IEfTransactionRunner _transactionRunner;
    private readonly IpcManagementContext? _context;
    private readonly IOperationalWarehouseResolver _operationalWarehouseResolver;
    public InventoryReturnService(
        IInventoryReturnRepository returnRepository,
        IInventoryIssueRepository issueRepository,
        IUnitOfWork unitOfWork,
        IStockLedgerService stockLedgerService,
        IEfTransactionRunner transactionRunner,
        IOperationalWarehouseResolver operationalWarehouseResolver,
        IpcManagementContext? context = null)
    {
        _returnRepository = returnRepository;
        _issueRepository = issueRepository;
        _unitOfWork = unitOfWork;
        _stockLedgerService = stockLedgerService;
        _transactionRunner = transactionRunner;
        _operationalWarehouseResolver = operationalWarehouseResolver;
        _context = context;
    }
    public async Task<PagedResponseDto<InventoryReturnDto>> GetPagedAsync(InventoryReturnFilterRequestDto request)
    {
        request.WarehouseId = GuidHelper.ToGuidString(await ResolveCanonicalWarehouseAsync(_operationalWarehouseResolver, request.WarehouseId, authorizationScope: true));
        var (items, totalCount) = await _returnRepository.GetPagedAsync(request);
        return PagedResponseDto<InventoryReturnDto>.Create(
            items.Select(inventoryReturn => InventoryMapper.MapReturn(inventoryReturn, includeLines: true)),
            totalCount,
            request.PageNumber,
            request.PageSize);
    }
    public async Task<InventoryReturnDto?> GetByIdAsync(string id)
    {
        var bytes = GuidHelper.ParseGuidString(id);
        if (bytes is null) return null;
        var inventoryReturn = await _returnRepository.GetByIdWithLinesAsync(bytes);
        return inventoryReturn is null
            ? null
            : InventoryMapper.MapReturn(inventoryReturn, includeLines: true);
    }

    public async Task<InventoryReturnCreatedDto?> CreateAsync(CreateInventoryReturnRequest dto, string? userId)
    {
        var userIdBytes = GuidHelper.ParseGuidString(userId);
        if (userIdBytes is null) return null;
        var commandId = _context is null
            ? dto.CommandId?.Trim() ?? string.Empty
            : RequireText(dto.CommandId, "Mã lệnh tạo phiếu không được để trống.", 128);
        const string aggregateType = "InventoryReturn";
        var recorder = _context is null ? null : new LifecycleTransitionRecorder(_context);

        var canonicalWarehouseId = await ResolveCanonicalWarehouseAsync(
            _operationalWarehouseResolver,
            dto.WarehouseId);
        var warehouseBytes = canonicalWarehouseId;
        var issueBytes = GuidHelper.ParseGuidString(dto.IssueId)
            ?? throw new ArgumentException("IssueId không hợp lệ.");

        var returnType = NormalizeReturnType(dto.ReturnType);
        if (string.IsNullOrWhiteSpace(dto.Reason))
        {
            throw new ArgumentException("Cần ghi lý do trả kho hoặc hao hụt thực tế.");
        }

        var returnId = GuidHelper.NewId();
        var returnCode = $"{ResolveReturnCodePrefix(returnType)}-{DateTime.Now:yyyyMMdd-HHmmss}-{Guid.NewGuid().ToString("N")[..4].ToUpper()}";
        return await _transactionRunner.ExecuteAsync(
            async _ =>
            {
                var replay = _context is null ? null : await _context.Lifecyclecommandreceipts.AsNoTracking()
                    .SingleOrDefaultAsync(item => item.CommandId == commandId && item.AggregateType == aggregateType);
                if (replay is not null)
                {
                    return JsonSerializer.Deserialize<InventoryReturnCreatedDto>(replay.ResponseJson)
                        ?? throw new InvalidOperationException("Không thể đọc lại kết quả tạo phiếu trả.");
                }
                var issue = await _issueRepository.GetByIdWithLinesAsync(issueBytes)
                    ?? throw new KeyNotFoundException($"Không tìm thấy phiếu xuất kho với ID: {dto.IssueId}");

                if (!issue.WarehouseId.SequenceEqual(canonicalWarehouseId))
                {
                    throw new BusinessRuleException("Phiếu trả phải thuộc cùng kho với phiếu xuất gốc.");
                }

                if (issue.ReceivedAt is null)
                {
                    throw new BusinessRuleException(
                        "Bếp cần xác nhận đã nhận phiếu xuất gốc trước khi tạo phiếu trả hoặc khai báo hao hụt.");
                }

                var accountedQuantities = await _returnRepository.GetReturnedQuantitiesBySourceIssueLineAsync(issueBytes);
                var sourceLineIds = new HashSet<string>(StringComparer.Ordinal);

                var inventoryReturn = new InventoryReturn
                {
                    ReturnId = returnId,
                    ReturnCode = returnCode,
                    ReturnDate = dto.ReturnDate,
                    ShiftName = dto.ShiftName,
                    ReturnType = returnType,
                    WarehouseId = warehouseBytes,
                    IssueId = issueBytes,
                    Reason = dto.Reason.Trim(),
                    CreatedBy = userIdBytes,
                    CreatedAt = DateTime.UtcNow
                };

                inventoryReturn.Inventoryreturnlines = dto.Lines.Select(line =>
                {
                    var ingredientBytes = GuidHelper.ParseGuidString(line.IngredientId)
                        ?? throw new ArgumentException($"IngredientId '{line.IngredientId}' không hợp lệ.");
                    var unitBytes = GuidHelper.ParseGuidString(line.UnitId)
                        ?? throw new ArgumentException($"UnitId '{line.UnitId}' không hợp lệ.");
                    var sourceLine = ResolveSourceIssueLine(issue, line.SourceIssueLineId, ingredientBytes, unitBytes);
                    var sourceLineId = GuidHelper.ToGuidString(sourceLine.IssueLineId);
                    if (!sourceLineIds.Add(sourceLineId))
                    {
                        throw new BusinessRuleException("Mỗi dòng nguồn của phiếu xuất chỉ được trả/ghi hao hụt một lần trên cùng chứng từ.");
                    }

                    var quantity = DecimalPolicy.RoundQuantity(line.Quantity);
                    ValidateReturnQuantity(sourceLine, accountedQuantities.GetValueOrDefault(sourceLineId), quantity);

                    return new InventoryReturnLine
                    {
                        ReturnLineId = GuidHelper.NewId(),
                        ReturnId = inventoryReturn.ReturnId,
                        IngredientId = ingredientBytes,
                        UnitId = unitBytes,
                        SourceIssueLineId = sourceLine.IssueLineId,
                        Quantity = quantity
                    };
                }).ToList();

                _returnRepository.Add(inventoryReturn);

                var result = new InventoryReturnCreatedDto
                {
                    ReturnId = GuidHelper.ToGuidString(inventoryReturn.ReturnId),
                    ReturnCode = inventoryReturn.ReturnCode
                };
                var response = JsonSerializer.Serialize(result);
                recorder?.Stage(new LifecycleTransitionRequest(
                    aggregateType, inventoryReturn.ReturnId, commandId, 0, null, "PENDING_RECEIPT", userIdBytes, 0,
                    inventoryReturn.Reason, dto.CorrelationId?.Trim(), dto.CausationId?.Trim(), response, response));

                await _unitOfWork.SaveChangesAsync();

                return result;
            },
            async token => _context is null
                ? await _returnRepository.GetByIdWithLinesAsync(returnId) is not null
                : await _context.Lifecyclecommandreceipts.AsNoTracking()
                    .AnyAsync(item => item.CommandId == commandId && item.AggregateType == aggregateType, token),
            IsolationLevel.Serializable);
    }

    private void AddWasteAudit(InventoryReturn inventoryReturn, InventoryIssue issue, byte[] userIdBytes)
    {
        if (_context is null) return;

        foreach (var line in inventoryReturn.Inventoryreturnlines)
        {
            _context.Auditlogs.Add(new AuditLog
            {
                AuditId = GuidHelper.NewId(),
                ChangedAt = DateTime.UtcNow,
                ChangedBy = userIdBytes,
                BusinessArea = "ProductionWaste",
                EntityName = nameof(InventoryReturnLine),
                EntityId = line.ReturnLineId,
                FieldName = "WasteQuantity",
                OldValue = "0",
                NewValue = line.Quantity.ToString("0.######"),
                Reason = $"Khai báo hao hụt {line.Quantity} từ phiếu xuất {issue.IssueCode}. Lý do: {inventoryReturn.Reason}"
            });
        }
    }

    public async Task<bool> ConfirmReceiptAsync(string id, ConfirmInventoryReturnReceiptRequest dto, string? userId)
    {
        var bytes = GuidHelper.ParseGuidString(id);
        var userIdBytes = GuidHelper.ParseGuidString(userId);
        if (bytes is null || userIdBytes is null || _context is null) return false;
        var commandId = RequireText(dto.CommandId, "Mã lệnh xác nhận không được để trống.", 128);
        const string aggregateType = "InventoryReturn";
        var recorder = new LifecycleTransitionRecorder(_context);

        // Luồng này ghi vào 6 bảng (inventoryreturns, inventoryreturnlines, auditlogs, currentstock,
        // currentstocklots, stockmovements). Không có transaction thì một lỗi giữa chừng để lại
        // phiếu đã đánh dấu "đã nhận" nhưng tồn kho chưa cộng. Dùng đúng khuôn mẫu của CreateAsync
        // trong chính file này. Đọc phiếu cũng nằm trong transaction để chốt chặn xác nhận hai lần.
        return await _transactionRunner.ExecuteAsync(
            async cancellationToken =>
            {
                var inventoryReturn = await _context.Inventoryreturns
                    .Include(r => r.Inventoryreturnlines)
                    .FirstOrDefaultAsync(r => r.ReturnId == bytes, cancellationToken);

                if (inventoryReturn is null) return false;

                var replay = await recorder.FindExistingCommandAsync(commandId, aggregateType, bytes, cancellationToken);
                if (replay is not null) return true;

                if (inventoryReturn.ReceivedAt.HasValue)
                {
                    throw new ResourceConflictException("Phiếu trả nguyên liệu này đã được xác nhận.");
                }
                if (dto.ExpectedVersion != 0)
                {
                    throw new ResourceConflictException("Phiếu trả đã thay đổi; hãy tải lại trước khi xác nhận.");
                }

                var proposedAdjustments = new List<(InventoryReturnLine Line, decimal Quantity)>();
                if (dto.AdjustedLines != null && dto.AdjustedLines.Any())
                {
                    var adjustedLineIds = new HashSet<string>(StringComparer.Ordinal);
                    foreach (var adjustedLine in dto.AdjustedLines)
                    {
                        var lineBytes = GuidHelper.ParseFilterIdOrThrow(adjustedLine.ReturnLineId, "dòng phiếu trả");
                        var line = inventoryReturn.Inventoryreturnlines.FirstOrDefault(l => lineBytes != null && l.ReturnLineId.SequenceEqual(lineBytes));
                        if (line is null)
                        {
                            throw new BusinessRuleException("Dòng điều chỉnh không thuộc phiếu trả đang xác nhận.");
                        }

                        var lineKey = Convert.ToHexString(line.ReturnLineId);
                        if (!adjustedLineIds.Add(lineKey))
                        {
                            throw new BusinessRuleException("Mỗi dòng phiếu trả chỉ được điều chỉnh một lần trong một lệnh xác nhận.");
                        }

                        var adjustedQuantity = DecimalPolicy.RoundQuantity(adjustedLine.NewQuantity);
                        if (!DecimalPolicy.GreaterThanQuantity(adjustedQuantity, 0))
                        {
                            throw new BusinessRuleException("Số lượng thực nhận sau điều chỉnh phải lớn hơn 0.");
                        }

                        proposedAdjustments.Add((line, adjustedQuantity));
                    }
                }

                await EnsureReturnBalanceAfterAdjustmentAsync(
                    inventoryReturn,
                    proposedAdjustments.ToDictionary(item => Convert.ToHexString(item.Line.ReturnLineId), item => item.Quantity),
                    cancellationToken);

                var confirmedAt = DateTime.UtcNow;
                inventoryReturn.ReceivedBy = userIdBytes;
                inventoryReturn.ReceivedAt = confirmedAt;
                var auditLogReason = $"Thủ kho xác nhận phiếu trả {inventoryReturn.ReturnCode}.";

                foreach (var (line, adjustedQuantity) in proposedAdjustments.Where(item => item.Line.Quantity != item.Quantity))
                {
                    _context.Auditlogs.Add(new AuditLog
                    {
                        AuditId = GuidHelper.NewId(),
                        ChangedAt = confirmedAt,
                        ChangedBy = userIdBytes,
                        BusinessArea = "StorekeeperReturnReceipt",
                        EntityName = nameof(InventoryReturnLine),
                        EntityId = line.ReturnLineId,
                        FieldName = "Quantity",
                        OldValue = line.Quantity.ToString("0.######"),
                        NewValue = adjustedQuantity.ToString("0.######"),
                        Reason = $"Thủ kho điều chỉnh số lượng thực nhận từ {line.Quantity} thành {adjustedQuantity} cho phiếu trả {inventoryReturn.ReturnCode}."
                    });
                    line.Quantity = adjustedQuantity;
                }

                if (dto.HasDiscrepancy)
                {
                    var note = dto.DiscrepancyNote?.Trim() ?? "";
                    _context.Auditlogs.Add(new AuditLog
                    {
                        AuditId = GuidHelper.NewId(),
                        ChangedAt = confirmedAt,
                        ChangedBy = userIdBytes,
                        BusinessArea = "StorekeeperReturnReceipt",
                        EntityName = nameof(InventoryReturn),
                        EntityId = inventoryReturn.ReturnId,
                        FieldName = "StorekeeperReceiptDiscrepancy",
                        OldValue = "expected=kitchen_qty",
                        NewValue = note,
                        Reason = $"Thủ kho báo chênh lệch khi nhận phiếu trả {inventoryReturn.ReturnCode}: {note}"
                    });
                }

                _context.Auditlogs.Add(new AuditLog
                {
                    AuditId = GuidHelper.NewId(),
                    ChangedAt = confirmedAt,
                    ChangedBy = userIdBytes,
                    BusinessArea = "StorekeeperReturnReceipt",
                    EntityName = nameof(InventoryReturn),
                    EntityId = inventoryReturn.ReturnId,
                    FieldName = "StorekeeperReceived",
                    OldValue = null,
                    NewValue = $"receivedAt={confirmedAt:O}",
                    Reason = auditLogReason
                });

                if (inventoryReturn.ReturnType == ReturnTypeReturn)
                {
                    foreach (var line in inventoryReturn.Inventoryreturnlines)
                    {
                        await _stockLedgerService.AddStockAsync(
                            inventoryReturn.WarehouseId,
                            line.IngredientId,
                            line.UnitId,
                            line.Quantity,
                            "RETURN",
                            "inventoryreturns",
                            inventoryReturn.ReturnId,
                            userIdBytes,
                            "Trả nguyên liệu dư sau sản xuất",
                            $"Phiếu trả {inventoryReturn.ReturnCode}");
                    }
                }
                else
                {
                    var issue = await _issueRepository.GetByIdWithLinesAsync(inventoryReturn.IssueId);
                    if (issue != null)
                    {
                        AddWasteAudit(inventoryReturn, issue, userIdBytes);
                    }
                }

                var response = JsonSerializer.Serialize(new
                {
                    returnId = id,
                    status = inventoryReturn.ReturnType == ReturnTypeWaste ? "RECORDED" : "RECEIVED",
                    concurrencyVersion = 1
                });
                recorder.Stage(new LifecycleTransitionRequest(
                    aggregateType,
                    inventoryReturn.ReturnId,
                    commandId,
                    1,
                    "PENDING_RECEIPT",
                    inventoryReturn.ReturnType == ReturnTypeWaste ? "RECORDED" : "RECEIVED",
                    userIdBytes,
                    dto.ExpectedVersion,
                    dto.HasDiscrepancy ? dto.DiscrepancyNote?.Trim() : auditLogReason,
                    dto.CorrelationId?.Trim(),
                    dto.CausationId?.Trim(),
                    response,
                    response));

                await _context.SaveChangesAsync(cancellationToken);
                return true;
            },
            cancellationToken => _context.Lifecyclecommandreceipts.AsNoTracking().AnyAsync(
                receipt => receipt.CommandId == commandId && receipt.AggregateType == aggregateType && receipt.AggregateId.SequenceEqual(bytes),
                cancellationToken),
            IsolationLevel.Serializable);
    }

    private static InventoryIssueLine ResolveSourceIssueLine(
        InventoryIssue issue,
        string? requestedSourceIssueLineId,
        byte[] ingredientId,
        byte[] unitId)
    {
        if (string.IsNullOrWhiteSpace(requestedSourceIssueLineId))
        {
            throw new BusinessRuleException("Mỗi dòng trả hoặc hao hụt phải chỉ rõ SourceIssueLineId để giữ lineage.");
        }

        var sourceLineId = GuidHelper.ParseGuidString(requestedSourceIssueLineId)
            ?? throw new ArgumentException("SourceIssueLineId không hợp lệ.");
        var sourceLine = issue.Inventoryissuelines.SingleOrDefault(line => line.IssueLineId.SequenceEqual(sourceLineId))
            ?? throw new BusinessRuleException("Dòng nguồn không thuộc phiếu xuất gốc.");
        if (!sourceLine.IngredientId.SequenceEqual(ingredientId) || !sourceLine.UnitId.SequenceEqual(unitId))
        {
            throw new BusinessRuleException("Nguyên liệu hoặc đơn vị của dòng trả không khớp dòng nguồn phiếu xuất.");
        }

        EnsureExactSourceFamily(issue, sourceLine);
        return sourceLine;
    }

    private static void EnsureExactSourceFamily(InventoryIssue issue, InventoryIssueLine sourceLine)
    {
        var headerIsDefault = issue.MaterialRequestId is not null;
        var headerIsReconciliation = issue.ReconciliationBatchId is not null;
        var lineIsDefault = sourceLine.MaterialRequestLineId is not null;
        var lineIsReconciliation = sourceLine.ReconciliationBatchLineId is not null;

        if (headerIsDefault == headerIsReconciliation
            || lineIsDefault == lineIsReconciliation
            || headerIsDefault != lineIsDefault
            || headerIsReconciliation != lineIsReconciliation)
        {
            throw new BusinessRuleException(
                "Dòng phiếu xuất gốc phải có lineage chính xác thuộc đúng một workflow family và khớp với phiếu xuất.");
        }
    }

    public async Task<IReadOnlyList<InventoryReturnAllocationBalanceDto>> GetAllocationBalancesAsync(
        InventoryReturnAllocationBalanceQuery query,
        string? userId,
        CancellationToken cancellationToken = default)
    {
        EnsureAllocationContext(_context);
        var sourceLines = await LoadScopedSourceLinesAsync(query, cancellationToken);
        var customers = (await _context!.Customers.AsNoTracking().ToListAsync(cancellationToken))
            .ToDictionary(item => Convert.ToHexString(item.CustomerId));
        var ingredients = (await _context.Ingredients.AsNoTracking().ToListAsync(cancellationToken))
            .ToDictionary(item => Convert.ToHexString(item.IngredientId));
        var units = (await _context.Units.AsNoTracking().ToListAsync(cancellationToken))
            .ToDictionary(item => Convert.ToHexString(item.UnitId));
        var actorIsAdmin = await IsAdminAsync(userId, cancellationToken);
        var sourceIds = sourceLines.Select(item => item.Line.IssueLineId).ToList();
        var returnedAndWasted = await _context!.Inventoryreturnlines.AsNoTracking()
            .Include(item => item.Return)
            .Where(item => item.SourceIssueLineId != null && sourceIds.Contains(item.SourceIssueLineId))
            .GroupBy(item => new { item.SourceIssueLineId, item.Return.ReturnType })
            .Select(group => new { group.Key.SourceIssueLineId, group.Key.ReturnType, Quantity = group.Sum(item => item.Quantity) })
            .ToListAsync(cancellationToken);
        var dispositions = await _context.Inventoryallocationdispositions.AsNoTracking()
            .Where(item => sourceIds.Contains(item.SourceIssueLineId) || sourceIds.Contains(item.DestinationIssueLineId))
            .ToListAsync(cancellationToken);

        return sourceLines.Select(source =>
        {
            var customer = customers[Convert.ToHexString(source.PlanLine.CustomerId)];
            var ingredient = ingredients[Convert.ToHexString(source.Line.IngredientId)];
            var unit = units[Convert.ToHexString(source.Line.UnitId)];
            var sourceId = GuidHelper.ToGuidString(source.Line.IssueLineId);
            var returned = returnedAndWasted.Where(item => item.SourceIssueLineId!.SequenceEqual(source.Line.IssueLineId) && item.ReturnType == ReturnTypeReturn).Sum(item => item.Quantity);
            var wasted = returnedAndWasted.Where(item => item.SourceIssueLineId!.SequenceEqual(source.Line.IssueLineId) && item.ReturnType == ReturnTypeWaste).Sum(item => item.Quantity);
            var outgoing = dispositions.Where(item => item.SourceIssueLineId.SequenceEqual(source.Line.IssueLineId)).Sum(item => item.Quantity);
            var incoming = dispositions.Where(item => item.DestinationIssueLineId.SequenceEqual(source.Line.IssueLineId)).Sum(item => item.Quantity);
            var issued = DecimalPolicy.RoundQuantity(source.Line.IssuedQty);
            var excess = DecimalPolicy.RoundQuantity(issued - returned - wasted - outgoing);
            var hasValidLineage = source.Line.MaterialRequestLineId is not null;
            return new InventoryReturnAllocationBalanceDto
            {
                SourceIssueLineId = sourceId,
                MaterialRequestLineId = GuidHelper.ToGuidString(source.Material.RequestLineId),
                CustomerId = GuidHelper.ToGuidString(source.PlanLine.CustomerId),
                CustomerCode = customer.CustomerCode,
                CustomerName = customer.CustomerName,
                ServiceDate = source.Plan.PlanDate,
                ShiftName = source.PlanLine.ShiftName,
                PriceTierAmount = source.Material.PriceTierAmount,
                IngredientId = GuidHelper.ToGuidString(source.Line.IngredientId),
                IngredientName = ingredient.IngredientName,
                UnitId = GuidHelper.ToGuidString(source.Line.UnitId),
                UnitName = unit.UnitName,
                IssuedQuantity = issued,
                KitchenAcknowledgedQuantity = source.Issue.ReceivedAt is null ? 0 : issued,
                ReturnedQuantity = DecimalPolicy.RoundQuantity(returned),
                WastedQuantity = DecimalPolicy.RoundQuantity(wasted),
                DisposedQuantity = DecimalPolicy.RoundQuantity(outgoing),
                IncomingDispositionQuantity = DecimalPolicy.RoundQuantity(incoming),
                ExcessQuantity = excess,
                Version = dispositions.Count(item => item.SourceIssueLineId.SequenceEqual(source.Line.IssueLineId)),
                DecisionId = hasValidLineage && DecimalPolicy.GreaterThanQuantity(excess, 0) ? BuildDecisionId(sourceId) : null,
                DecisionReason = hasValidLineage ? null : "Chưa xác định được dòng chứng từ gốc; cần người có thẩm quyền quyết định.",
                AllowedActions = hasValidLineage && actorIsAdmin && DecimalPolicy.GreaterThanQuantity(excess, 0)
                    ? ["CROSS_CUSTOMER_DISPOSITION"]
                    : [],
            };
        }).ToList();
    }

    public async Task<InventoryAllocationDispositionDto> CreateAllocationDispositionAsync(
        CreateInventoryAllocationDispositionRequest request,
        string? userId,
        CancellationToken cancellationToken = default)
    {
        EnsureAllocationContext(_context);
        var actorId = GuidHelper.ParseGuidString(userId) ?? throw new UnauthorizedAccessException("Không xác định được người thực hiện disposition.");
        if (!await IsAdminAsync(userId, cancellationToken)) throw new UnauthorizedAccessException("Chỉ Admin được điều phối excess giữa khách hàng.");
        var sourceId = ParseRequiredId(request.SourceIssueLineId, "SourceIssueLineId không hợp lệ.");
        var destinationId = ParseRequiredId(request.DestinationSourceLineId, "DestinationSourceLineId không hợp lệ.");
        if (sourceId.SequenceEqual(destinationId)) throw new BusinessRuleException("Dòng nguồn và dòng đích phải khác nhau.");
        var commandId = RequireText(request.CommandId, "CommandId không được để trống.", 128);
        var reason = RequireText(request.Reason, "Cần ghi lý do disposition excess.", 1000);
        if (request.DecisionId != BuildDecisionId(GuidHelper.ToGuidString(sourceId))) throw new BusinessRuleException("Decision token không khớp dòng nguồn.");
        var aggregateType = "InventoryAllocationDisposition";
        var recorder = new LifecycleTransitionRecorder(_context!);
        var replay = await recorder.FindExistingCommandAsync(commandId, aggregateType, sourceId, cancellationToken);
        if (replay is not null) return DeserializeDisposition(replay.ResponseJson);

        return await _transactionRunner.ExecuteAsync(async token =>
        {
            var source = await LoadSourceLineAsync(sourceId, token);
            var destination = await LoadSourceLineAsync(destinationId, token);
            EnsureCompatibleCrossCustomerScope(source, destination);
            var balances = await GetAllocationBalancesAsync(new InventoryReturnAllocationBalanceQuery(), userId, token);
            var sourceBalance = balances.SingleOrDefault(item => item.SourceIssueLineId == GuidHelper.ToGuidString(sourceId))
                ?? throw new BusinessRuleException("Không thể đọc balance dòng nguồn.");
            if (sourceBalance.DecisionId != request.DecisionId) throw new BusinessRuleException("Disposition không còn được phép; hãy tải lại trạng thái.");
            if (request.ExpectedVersion != sourceBalance.Version) throw new DbUpdateConcurrencyException("Balance source-line đã thay đổi; hãy tải lại trạng thái.");
            var quantity = DecimalPolicy.RoundQuantity(request.Quantity);
            if (!DecimalPolicy.GreaterThanQuantity(quantity, 0) || DecimalPolicy.GreaterThanQuantity(quantity, sourceBalance.ExcessQuantity))
                throw new BusinessRuleException("Số lượng disposition phải nằm trong excess hiện tại của đúng dòng nguồn.");
            var disposition = new InventoryAllocationDisposition
            {
                AllocationDispositionId = GuidHelper.NewId(), SourceIssueLineId = sourceId, DestinationIssueLineId = destinationId,
                Quantity = quantity, Reason = reason, CreatedBy = actorId, CreatedAt = DateTime.UtcNow, Version = 0,
                CorrelationId = request.CorrelationId?.Trim(), CausationId = request.CausationId?.Trim(),
            };
            _context!.Inventoryallocationdispositions.Add(disposition);
            var result = MapDisposition(disposition);
            recorder.Stage(new LifecycleTransitionRequest(aggregateType, sourceId, commandId, 1, null, "APPLIED", actorId,
                request.ExpectedVersion, reason, disposition.CorrelationId, disposition.CausationId,
                JsonSerializer.Serialize(result), JsonSerializer.Serialize(result)));
            await _context.SaveChangesAsync(token);
            return result;
        }, async token => await recorder.FindExistingCommandAsync(commandId, aggregateType, sourceId, token) is not null,
        IsolationLevel.Serializable, cancellationToken);
    }

    private async Task EnsureReturnBalanceAfterAdjustmentAsync(
        InventoryReturn inventoryReturn,
        IReadOnlyDictionary<string, decimal> proposedAdjustments,
        CancellationToken cancellationToken)
    {
        var issue = await _issueRepository.GetByIdWithLinesAsync(inventoryReturn.IssueId)
            ?? throw new BusinessRuleException("Không tìm thấy phiếu xuất gốc để đối soát số lượng trả.");

        var issuedBySourceLine = issue.Inventoryissuelines
            .ToDictionary(line => GuidHelper.ToGuidString(line.IssueLineId), line => DecimalPolicy.RoundQuantity(line.IssuedQty));

        var returnLines = await _context!.Inventoryreturnlines
            .Include(line => line.Return)
            .Where(line => line.Return.IssueId == inventoryReturn.IssueId)
            .ToListAsync(cancellationToken);
        var accountedBySourceLine = returnLines
            .Where(line => line.SourceIssueLineId is not null)
            .GroupBy(line => GuidHelper.ToGuidString(line.SourceIssueLineId!))
            .ToDictionary(
                group => group.Key,
                group => DecimalPolicy.RoundQuantity(group.Sum(line => proposedAdjustments.GetValueOrDefault(
                    Convert.ToHexString(line.ReturnLineId),
                    line.Quantity))));

        foreach (var (key, accountedQuantity) in accountedBySourceLine)
        {
            if (!issuedBySourceLine.TryGetValue(key, out var issuedQuantity) ||
                DecimalPolicy.GreaterThanQuantity(accountedQuantity, issuedQuantity))
            {
                throw new BusinessRuleException(
                    "Số lượng trả/hao hụt sau điều chỉnh vượt quá số lượng đã xuất của dòng nguồn.");
            }
        }
    }

    private async Task<List<SourceLineScope>> LoadScopedSourceLinesAsync(
        InventoryReturnAllocationBalanceQuery query,
        CancellationToken cancellationToken)
    {
        var items = await (
            from line in _context!.Inventoryissuelines.AsNoTracking()
            join issue in _context.Inventoryissues.AsNoTracking() on line.IssueId equals issue.IssueId
            join material in _context.Materialrequestlines.AsNoTracking() on line.MaterialRequestLineId equals material.RequestLineId
            join planLine in _context.Productionplanlines.AsNoTracking() on material.PlanLineId equals planLine.PlanLineId
            join plan in _context.Productionplans.AsNoTracking() on planLine.PlanId equals plan.PlanId
            where line.MaterialRequestLineId != null
                && (query.CustomerId == null || planLine.CustomerId.SequenceEqual(ParseRequiredId(query.CustomerId, "CustomerId không hợp lệ.")))
                && (query.ServiceDate == null || plan.PlanDate == query.ServiceDate)
                && (query.ShiftName == null || planLine.ShiftName == query.ShiftName)
                && (query.PriceTierAmount == null || material.PriceTierAmount == query.PriceTierAmount)
            select new SourceLineScope(line, issue, material, planLine, plan)).ToListAsync(cancellationToken);
        return items;
    }

    private async Task<SourceLineScope> LoadSourceLineAsync(byte[] sourceIssueLineId, CancellationToken cancellationToken)
    {
        var result = await LoadScopedSourceLinesAsync(new InventoryReturnAllocationBalanceQuery(), cancellationToken);
        return result.SingleOrDefault(item => item.Line.IssueLineId.SequenceEqual(sourceIssueLineId))
            ?? throw new BusinessRuleException("Dòng nguồn thiếu hoặc không có lineage material/customer/date/shift/tier.");
    }

    private async Task<bool> IsAdminAsync(string? userId, CancellationToken cancellationToken)
    {
        var actorId = GuidHelper.ParseGuidString(userId);
        if (actorId is null || _context is null) return false;
        var roleName = await (
            from user in _context.Users.AsNoTracking()
            join role in _context.Roles.AsNoTracking() on user.RoleId equals role.RoleId
            where user.UserId.SequenceEqual(actorId)
            select role.RoleName).SingleOrDefaultAsync(cancellationToken);
        return AuthorizationPolicies.IsAdminRole(roleName);
    }




}
