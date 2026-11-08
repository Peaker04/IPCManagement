using System.Data;
using System.Globalization;
using System.Text.Json;
using IPCManagement.Api.Data;
using IPCManagement.Api.Data.Repositories;
using IPCManagement.Api.Data.Transactions;
using IPCManagement.Api.Exceptions;
using IPCManagement.Api.Features.Inventory.Contracts;
using IPCManagement.Api.Features.Inventory.Validators;
using IPCManagement.Api.Features.SystemOperation.Services;
using IPCManagement.Api.Helpers;
using IPCManagement.Api.Infrastructure.Lifecycle;
using IPCManagement.Api.Models.Entities;
using Microsoft.EntityFrameworkCore;

namespace IPCManagement.Api.Features.Inventory.Services;

internal sealed class ReconciliationInventoryIssueCreator
{
    private readonly IInventoryIssueRepository _issueRepository;
    private readonly IUnitOfWork _unitOfWork;
    private readonly IStockLedgerService _stockLedgerService;
    private readonly IEfTransactionRunner _transactionRunner;
    private readonly IpcManagementContext? _context;
    private readonly IOperationalWarehouseResolver _operationalWarehouseResolver;
    private readonly SystemOperationRequestContext? _requestContext;
    private readonly SystemOperationModeGuard? _modeGuard;
    private readonly IInventoryIssuePreWriteGate? _preWriteGate;

    internal ReconciliationInventoryIssueCreator(
        IInventoryIssueRepository issueRepository,
        IUnitOfWork unitOfWork,
        IStockLedgerService stockLedgerService,
        IEfTransactionRunner transactionRunner,
        IOperationalWarehouseResolver operationalWarehouseResolver,
        IpcManagementContext? context,
        SystemOperationRequestContext? requestContext,
        SystemOperationModeGuard? modeGuard,
        IInventoryIssuePreWriteGate? preWriteGate)
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
    }

    internal async Task<InventoryIssueCreatedDto> CreateAsync(CreateInventoryIssueRequest dto, byte[] actorId)
    {
        if (_context is null) throw new InvalidOperationException("Chưa cấu hình dữ liệu cho xuất kho đối chiếu.");
        EnsureOwningMode();
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
                var isSupplemental = dto.IsSupplemental == true;
                if ((isSupplemental ? batch.Status != "IN_PROGRESS" : batch.Status != "TRANSFERRED") || batch.Version != dto.ExpectedVersion)
                    throw new DbUpdateConcurrencyException("Danh sách xuất kho đã thay đổi; hãy tải lại trước khi xác nhận.");
                if (dto.Lines.Count == 0) throw new ArgumentException("Phiếu xuất kho phải có ít nhất một dòng nguồn.");
                if (isSupplemental && dto.Lines.Count != 1)
                    throw new BusinessRuleException("Mỗi phiếu xuất thêm chỉ được chọn một nguyên liệu trong lô.");
                var sourceById = batch.Lines.ToDictionary(line => Convert.ToHexString(line.BatchLineId), StringComparer.Ordinal);
                var resolved = new List<(ReconciliationBatchLine Source, decimal Quantity, string? VarianceReason)>();
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
                        || !source.CanonicalUnitId.SequenceEqual(GuidHelper.ParseGuidString(requested.UnitId) ?? []))
                        throw new BusinessRuleException("Nguyên liệu hoặc đơn vị không khớp dòng nguồn đã đóng băng.");
                    var issuedQuantity = DecimalPolicy.RoundQuantity(requested.IssuedQty);
                    if ((!isSupplemental && requested.RequestedQty != source.RequiredQuantity)
                        || (isSupplemental && DecimalPolicy.RoundQuantity(requested.RequestedQty) != issuedQuantity))
                        throw new BusinessRuleException(isSupplemental
                            ? "Số lượng đề nghị xuất thêm phải khớp số lượng thực xuất thêm."
                            : "Số lượng cần xuất không khớp dòng nguồn đã đóng băng.");
                    if (issuedQuantity <= 0)
                        throw new BusinessRuleException("Số lượng thực xuất phải lớn hơn 0.");
                    var isOverIssued = DecimalPolicy.LessThanQuantity(source.RequiredQuantity, issuedQuantity);
                    var varianceReason = requested.VarianceReason?.Trim();
                    if ((isSupplemental || isOverIssued) && string.IsNullOrWhiteSpace(varianceReason))
                        throw new BusinessRuleException(isSupplemental
                            ? "Cần nhập lý do xuất thêm nguyên liệu."
                            : "Cần nhập lý do khi số lượng thực xuất vượt số lượng cần xuất.");
                    resolved.Add((source, issuedQuantity, varianceReason));
                }
                if (resolved.Select(item => Convert.ToHexString(item.Source.BatchLineId)).Distinct().Count() != resolved.Count)
                    throw new BusinessRuleException("Một dòng nguồn không thể xuất lặp trong cùng phiếu.");
                if (!isSupplemental && resolved.Count != sourceById.Count)
                    throw new BusinessRuleException("Phiếu xuất đầu tiên phải ghi nhận đủ mọi nguyên liệu của lô đã khóa.");
                var hasExistingIssue = await _context.Inventoryissues.AnyAsync(item => item.ReconciliationBatchId == batchId, token);
                if (isSupplemental != hasExistingIssue)
                    throw new ResourceConflictException(isSupplemental
                        ? "Lô chưa có phiếu xuất đầu tiên để thực hiện xuất thêm."
                        : "Lô đã có phiếu xuất; hãy dùng chức năng xuất thêm nguyên liệu.");
                try
                {
                    await InventoryIssueStockValidator.EnsureAvailableAsync(_context, warehouseId, dto.IssueDate, batchId,
                        $"REC-{GuidHelper.ToGuidString(batchId)}", resolved.Select(item => new InventoryIssueStockLine(item.Source.IngredientId, item.Source.CanonicalUnitId, item.Quantity)));
                }
                catch (StockShortageException shortage)
                {
                    foreach (var line in shortage.Shortage.Lines)
                    {
                        var ingredientId = GuidHelper.ParseGuidString(line.IngredientId)
                            ?? throw new InvalidOperationException("Không thể xác định nguyên liệu cần bảo đảm tồn cho chế độ đối chiếu.");
                        var unitId = GuidHelper.ParseGuidString(line.UnitId)
                            ?? throw new InvalidOperationException("Không thể xác định đơn vị cần bảo đảm tồn cho chế độ đối chiếu.");
                        await _stockLedgerService.AddStockAsync(
                            warehouseId,
                            ingredientId,
                            unitId,
                            line.MissingQty,
                            "ADJUSTMENT",
                            nameof(ReconciliationBatch),
                            batchId,
                            actorId,
                            "Bảo đảm đủ tồn kho cho chế độ đối chiếu nguyên liệu",
                            $"Tự động bổ sung phần thiếu cho lô {GuidHelper.ToGuidString(batchId)} trước khi tạo phiếu xuất.");
                    }
                    await _context.SaveChangesAsync(token);
                }

                if (_preWriteGate is not null)
                    await _preWriteGate.WaitAsync(token);
                if (_modeGuard is not null)
                    await _modeGuard.ValidateAsync(operationKey, expectedModeVersion, OperationDisposition.ReconciliationOnly, token);

                _context.Entry(batch).Property(item => item.Version).OriginalValue = dto.ExpectedVersion;
                batch.Status = "IN_PROGRESS";
                batch.Version++;

                var issue = new InventoryIssue
                {
                    IssueId = issueId, IssueCode = $"ISS-{DateTime.Now:yyyyMMdd-HHmmss}-{Guid.NewGuid().ToString("N")[..4].ToUpper()}",
                    IssueDate = dto.IssueDate, ShiftName = dto.ShiftName, WarehouseId = warehouseId,
                    ReconciliationBatchId = batchId, IssuedBy = actorId, CreatedAt = DateTime.UtcNow,
                    Inventoryissuelines = resolved.Select(item => new InventoryIssueLine
                    {
                        IssueLineId = GuidHelper.NewId(), IssueId = issueId, IngredientId = item.Source.IngredientId,
                        UnitId = item.Source.CanonicalUnitId, RequestedQty = isSupplemental ? item.Quantity : item.Source.RequiredQuantity, IssuedQty = item.Quantity,
                        ReconciliationBatchLineId = item.Source.BatchLineId
                    }).ToList()
                };
                _issueRepository.Add(issue);
                if (isSupplemental)
                {
                    var affectedLineIds = resolved.Select(item => item.Source.BatchLineId).ToList();
                    var staleDispositions = (await _context.Reconciliationdispositions.ToListAsync(token))
                        .Where(item => affectedLineIds.Any(lineId => lineId.AsSpan().SequenceEqual(item.BatchLineId)))
                        .ToList();
                    foreach (var disposition in staleDispositions)
                    {
                        _context.Auditlogs.Add(new AuditLog
                        {
                            AuditId = GuidHelper.NewId(), ChangedAt = DateTime.UtcNow, ChangedBy = actorId,
                            BusinessArea = "RECONCILIATION", EntityName = nameof(ReconciliationDisposition), EntityId = disposition.DispositionId,
                            FieldName = "Validity", OldValue = $"{disposition.Category}|{disposition.Reason}|v{disposition.Version}", NewValue = "INVALIDATED",
                            Reason = "Supplemental inventory issue changed the linked issued quantity.", CorrelationId = dto.CorrelationId?.Trim()
                        });
                        _context.Reconciliationdispositions.Remove(disposition);
                    }
                }
                foreach (var item in resolved.Where(item => item.VarianceReason is not null))
                    _context.Auditlogs.Add(new AuditLog
                    {
                        AuditId = GuidHelper.NewId(), ChangedAt = DateTime.UtcNow, ChangedBy = actorId,
                        BusinessArea = "Inventory", EntityName = nameof(InventoryIssueLine), EntityId = item.Source.BatchLineId,
                        FieldName = nameof(InventoryIssueLine.IssuedQty), OldValue = item.Source.RequiredQuantity.ToString(CultureInfo.InvariantCulture),
                        NewValue = item.Quantity.ToString(CultureInfo.InvariantCulture), Reason = item.VarianceReason,
                        CorrelationId = dto.CorrelationId?.Trim()
                    });
                foreach (var line in issue.Inventoryissuelines)
                    await _stockLedgerService.RemoveStockWithCheckAsync(warehouseId, line.IngredientId, line.UnitId, line.IssuedQty,
                        "ISSUE", "inventoryissues", issueId, actorId, "Xuất kho đối chiếu", $"Phiếu xuất {issue.IssueCode}");
                await _unitOfWork.SaveChangesAsync();
                var result = new InventoryIssueCreatedDto { IssueId = GuidHelper.ToGuidString(issueId), IssueCode = issue.IssueCode, ConcurrencyVersion = 1 };
                var response = JsonSerializer.Serialize(result);
                recorder.Stage(new LifecycleTransitionRequest(nameof(InventoryIssue), batchId, commandId, checked((int)batch.Version), isSupplemental ? "IN_PROGRESS" : "TRANSFERRED", isSupplemental ? "SUPPLEMENTAL_ISSUED" : "ISSUED", actorId,
                    dto.ExpectedVersion, isSupplemental ? $"Tạo phiếu xuất thêm {issue.IssueCode} cho lô đối chiếu." : $"Tạo phiếu xuất {issue.IssueCode} từ lô đối chiếu.", dto.CorrelationId, dto.CausationId, response, response));
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

    private void EnsureOwningMode()
    {
        if (_requestContext is not null
            && !string.Equals(_requestContext.Mode, SystemOperationEligibility.MaterialReconciliation, StringComparison.Ordinal))
        {
            throw new BusinessRuleException("Nguồn đối chiếu chỉ được xuất trong chế độ đối chiếu nguyên liệu.");
        }
    }

    private (string OperationKey, long ExpectedModeVersion) RequiredModeProtection()
    {
        if (_requestContext is null)
            throw new InvalidOperationException("Thiếu ngữ cảnh bảo vệ chế độ vận hành cho phiếu xuất đối chiếu.");
        _requestContext.Disposition = OperationDisposition.ReconciliationOnly;
        return (_requestContext.OperationKey, _requestContext.ExpectedModeVersion) switch
        {
            ({ Length: > 0 } operationKey, long expectedModeVersion) => (operationKey, expectedModeVersion),
            _ => throw new InvalidOperationException("Thiếu ngữ cảnh bảo vệ chế độ vận hành cho phiếu xuất đối chiếu.")
        };
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

    private async Task WriteStockShortageAuditAsync(StockShortageIssueDto shortage, byte[] batchId, byte[] actorId, string commandId)
    {
        if (_context is null)
        {
            return;
        }

        var changedAt = DateTime.UtcNow;
        if (commandId.Length > 0 && await _context.Auditlogs.AsNoTracking().AnyAsync(item =>
                item.BusinessArea == "StockException" && item.EntityId == batchId && item.CorrelationId == commandId))
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
                EntityId = batchId,
                FieldName = "StockShortage",
                OldValue = $"available={line.AvailableQty}",
                NewValue = $"ingredient={line.IngredientName}; required={line.RequiredQty}; available={line.AvailableQty}; missing={line.MissingQty}; unit={line.UnitName}; date={shortage.IssueDate:yyyy-MM-dd}",
                Reason = $"Thiếu tồn kho {line.IngredientName}: cần {line.RequiredQty} {line.UnitName}, hiện có {line.AvailableQty} {line.UnitName} tại {shortage.WarehouseName ?? shortage.WarehouseId}.",
                CorrelationId = commandId.Length > 0 ? commandId : null
            });
        }

        await _context.SaveChangesAsync();
    }
}
