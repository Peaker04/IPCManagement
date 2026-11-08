using System.Data;
using System.Globalization;
using System.Text.Json;
using IPCManagement.Api.Data;
using IPCManagement.Api.Data.Repositories;
using IPCManagement.Api.Data.Transactions;
using IPCManagement.Api.Exceptions;
using IPCManagement.Api.Features.Inventory.Contracts;
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
    private readonly IEfTransactionRunner _transactionRunner;
    private readonly IpcManagementContext? _context;
    private readonly IOperationalWarehouseResolver _operationalWarehouseResolver;
    private readonly SystemOperationRequestContext? _requestContext;
    private readonly SystemOperationModeGuard? _modeGuard;
    private readonly IInventoryIssuePreWriteGate? _preWriteGate;

    internal ReconciliationInventoryIssueCreator(
        IInventoryIssueRepository issueRepository,
        IUnitOfWork unitOfWork,
        IEfTransactionRunner transactionRunner,
        IOperationalWarehouseResolver operationalWarehouseResolver,
        IpcManagementContext? context,
        SystemOperationRequestContext? requestContext,
        SystemOperationModeGuard? modeGuard,
        IInventoryIssuePreWriteGate? preWriteGate)
    {
        _issueRepository = issueRepository;
        _unitOfWork = unitOfWork;
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
        var (operationKey, expectedModeVersion) = RequiredModeProtection();
        return await _transactionRunner.ExecuteProtectedAsync(operationKey, expectedModeVersion,
            token => CreateWithinTransactionAsync(dto, actorId, token),
            async token => await recorder.FindExistingCommandAsync(commandId, nameof(InventoryIssue), batchId, token) is not null,
            IsolationLevel.Serializable);
    }

    internal async Task<InventoryIssueCreatedDto> CreateWithinTransactionAsync(
        CreateInventoryIssueRequest dto, byte[] actorId, CancellationToken token)
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
        ServiceCalendar.EnsureServiceDay(dto.IssueDate);
        var warehouseId = await ResolveCanonicalWarehouseAsync(dto.WarehouseId);
        var issueId = GuidHelper.NewId();
        var (operationKey, expectedModeVersion) = RequiredModeProtection();
        var batch = await _context.Reconciliationbatches
            .Include(item => item.Lines).ThenInclude(line => line.Ingredient)
            .Include(item => item.Lines).ThenInclude(line => line.CanonicalUnit)
            .Include(item => item.Lines).ThenInclude(line => line.DailyLines)
            .SingleOrDefaultAsync(item => item.BatchId == batchId, token)
            ?? throw new BusinessRuleException("Không tìm thấy lô đối chiếu để xuất kho.");
        var isSupplemental = dto.IsSupplemental == true;
        var statusAllowsIssue = isSupplemental
            ? batch.Status == "IN_PROGRESS"
            : batch.Status is "TRANSFERRED" or "IN_PROGRESS";
        if (!statusAllowsIssue || batch.Version != dto.ExpectedVersion)
            throw new DbUpdateConcurrencyException("Danh sách xuất kho đã thay đổi; hãy tải lại trước khi xác nhận.");
        var allDailyLines = batch.Lines.SelectMany(line => line.DailyLines).ToList();
        if (allDailyLines.Count == 0)
            throw new BusinessRuleException("LEGACY_DAILY_LINEAGE_MISSING: Lô cũ chưa có định lượng đóng băng theo ngày nên không thể tạo phiếu xuất theo ngày.");
        var dateSources = allDailyLines.Where(line => line.ServiceDate == dto.IssueDate
            && (isSupplemental || line.RequiredQuantity > 0)).ToList();
        if (dateSources.Count == 0)
            throw new BusinessRuleException("Ngày xuất không thuộc nguồn định lượng theo ngày của lô đối chiếu.");
        if (dto.Lines.Count == 0)
            throw new ArgumentException(isSupplemental
                ? "Phiếu xuất thêm phải có ít nhất một nguyên liệu trong lô."
                : "Phiếu xuất kho phải có ít nhất một dòng nguồn.");
        var sourceById = dateSources.ToDictionary(line => Convert.ToHexString(line.DailyLineId), StringComparer.Ordinal);
        var resolved = new List<(ReconciliationBatchDailyLine Source, decimal Quantity, string? VarianceReason)>();
        foreach (var requested in dto.Lines)
        {
            if (!string.IsNullOrWhiteSpace(requested.MaterialRequestLineId)
                || string.IsNullOrWhiteSpace(requested.ReconciliationBatchLineId)
                || string.IsNullOrWhiteSpace(requested.ReconciliationBatchDailyLineId))
                throw new BusinessRuleException("Dòng xuất phải thuộc đúng nguồn theo ngày của lô đối chiếu.");
            var sourceLineId = GuidHelper.ParseGuidString(requested.ReconciliationBatchLineId)
                ?? throw new ArgumentException("ReconciliationBatchLineId không hợp lệ.");
            var dailyLineId = GuidHelper.ParseGuidString(requested.ReconciliationBatchDailyLineId)
                ?? throw new ArgumentException("ReconciliationBatchDailyLineId không hợp lệ.");
            if (!sourceById.TryGetValue(Convert.ToHexString(dailyLineId), out var source))
                throw new BusinessRuleException("Dòng xuất kho không thuộc ngày đã chọn của lô đối chiếu.");
            if (!source.BatchLineId.SequenceEqual(sourceLineId))
                throw new BusinessRuleException("Dòng tổng tuần không khớp nguồn theo ngày đã đóng băng.");
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
        if (resolved.Select(item => Convert.ToHexString(item.Source.DailyLineId)).Distinct().Count() != resolved.Count)
            throw new BusinessRuleException("Một dòng nguồn theo ngày không thể xuất lặp trong cùng phiếu.");
        if (!isSupplemental && resolved.Count != sourceById.Count)
            throw new BusinessRuleException("Phiếu xuất đầu tiên phải ghi nhận đủ mọi nguyên liệu của lô đã khóa.");
        ReconciliationSourceDelta? sourceDelta = null;
        if (!string.IsNullOrWhiteSpace(dto.ReconciliationSourceDeltaId))
        {
            if (!isSupplemental || dto.ExpectedSourceDeltaVersion is null || resolved.Count != 1)
                throw new BusinessRuleException("Xử lý thay đổi nguồn phải là một phiếu xuất thêm cho đúng một dòng delta.");
            var sourceDeltaId = GuidHelper.ParseGuidString(dto.ReconciliationSourceDeltaId)
                ?? throw new ArgumentException("ReconciliationSourceDeltaId không hợp lệ.");
            sourceDelta = await _context.Reconciliationsourcedeltas.SingleOrDefaultAsync(item => item.SourceDeltaId == sourceDeltaId, token)
                ?? throw new KeyNotFoundException("Không tìm thấy thay đổi nguồn cần xuất bổ sung.");
            var resolvedLine = resolved.Single();
            if (sourceDelta.Status != "PENDING" || sourceDelta.Version != dto.ExpectedSourceDeltaVersion
                || sourceDelta.WorkKind != "SUPPLEMENTAL_ISSUE" || !sourceDelta.BatchId.SequenceEqual(batchId)
                || sourceDelta.DailyLineId is null || !sourceDelta.DailyLineId.SequenceEqual(resolvedLine.Source.DailyLineId)
                || sourceDelta.ServiceDate != dto.IssueDate || !sourceDelta.IngredientId.SequenceEqual(resolvedLine.Source.IngredientId)
                || !sourceDelta.CanonicalUnitId.SequenceEqual(resolvedLine.Source.CanonicalUnitId)
                || DecimalPolicy.RoundQuantity(sourceDelta.DeltaQuantity) != resolvedLine.Quantity)
                throw new DbUpdateConcurrencyException("Thay đổi nguồn đã đổi hoặc không khớp phiếu xuất thêm; hãy tải lại hàng đợi.");
        }
        var hasExistingIssueForDate = await _context.Inventoryissues.AnyAsync(
            item => item.ReconciliationBatchId == batchId && item.IssueDate == dto.IssueDate, token);
        if (isSupplemental != hasExistingIssueForDate)
            throw new ResourceConflictException(isSupplemental
                ? "Lô chưa có phiếu xuất đầu tiên để thực hiện xuất thêm."
                : "Lô đã có phiếu xuất; hãy dùng chức năng xuất thêm nguyên liệu.");
        // MRX records reconciliation quantities only; sufficient stock is assumed, never provisioned or posted.

        if (_preWriteGate is not null)
            await _preWriteGate.WaitAsync(token);
        if (_modeGuard is not null)
            await _modeGuard.ValidateAsync(operationKey, expectedModeVersion, OperationDisposition.ReconciliationOnly, token);

        _context.Entry(batch).Property(item => item.Version).OriginalValue = dto.ExpectedVersion;
        var previousBatchStatus = batch.Status;
        batch.Status = "IN_PROGRESS";
        batch.Version++;

        var issue = new InventoryIssue
        {
            IssueId = issueId,
            IssueCode = $"ISS-{DateTime.Now:yyyyMMdd-HHmmss}-{Guid.NewGuid().ToString("N")[..4].ToUpper()}",
            IssueDate = dto.IssueDate,
            ShiftName = dto.ShiftName,
            WarehouseId = warehouseId,
            ReconciliationBatchId = batchId,
            IssuedBy = actorId,
            CreatedAt = DateTime.UtcNow,
            Inventoryissuelines = resolved.Select(item => new InventoryIssueLine
            {
                IssueLineId = GuidHelper.NewId(),
                IssueId = issueId,
                IngredientId = item.Source.IngredientId,
                UnitId = item.Source.CanonicalUnitId,
                RequestedQty = isSupplemental ? item.Quantity : item.Source.RequiredQuantity,
                IssuedQty = item.Quantity,
                ReconciliationBatchLineId = item.Source.BatchLineId,
                ReconciliationBatchDailyLineId = item.Source.DailyLineId,
                ReconciliationServiceDate = item.Source.ServiceDate
            }).ToList()
        };
        _issueRepository.Add(issue);
        if (sourceDelta is not null)
        {
            _context.Entry(sourceDelta).Property(item => item.Version).OriginalValue = dto.ExpectedSourceDeltaVersion!.Value;
            sourceDelta.Status = "RESOLVED";
            sourceDelta.Version++;
            sourceDelta.ResolvedAt = DateTime.UtcNow;
            sourceDelta.ResolvedBy = actorId;
            sourceDelta.ResolutionEntity = nameof(InventoryIssue);
            sourceDelta.ResolutionId = issueId;
            sourceDelta.ResolutionCommandId = commandId;
        }
        if (isSupplemental)
        {
            var invalidatedAt = DateTime.UtcNow;
            var affectedLineIds = resolved.Select(item => item.Source.BatchLineId).ToList();
            var affectedDailyLineIds = resolved.Select(item => item.Source.DailyLineId).ToList();
            var staleDispositions = await _context.Reconciliationdispositions
                .Where(item => item.InvalidatedAt == null && affectedLineIds.Contains(item.BatchLineId))
                .ToListAsync(token);
            foreach (var disposition in staleDispositions)
            {
                _context.Auditlogs.Add(new AuditLog
                {
                    AuditId = GuidHelper.NewId(),
                    ChangedAt = DateTime.UtcNow,
                    ChangedBy = actorId,
                    BusinessArea = "RECONCILIATION",
                    EntityName = nameof(ReconciliationDisposition),
                    EntityId = disposition.DispositionId,
                    FieldName = "Validity",
                    OldValue = $"{disposition.Category}|{disposition.Reason}|v{disposition.Version}",
                    NewValue = "INVALIDATED",
                    Reason = "Supplemental inventory issue changed the linked issued quantity.",
                    CorrelationId = dto.CorrelationId?.Trim()
                });
                disposition.InvalidatedAt = invalidatedAt;
                disposition.InvalidatedBy = actorId;
                disposition.InvalidationReason = "Supplemental inventory issue changed the linked issued quantity.";
            }
            var staleDailyDispositions = await _context.Reconciliationdailydispositions
                .Where(item => item.InvalidatedAt == null && affectedDailyLineIds.Contains(item.DailyLineId))
                .ToListAsync(token);
            foreach (var disposition in staleDailyDispositions)
            {
                _context.Auditlogs.Add(new AuditLog
                {
                    AuditId = GuidHelper.NewId(),
                    ChangedAt = DateTime.UtcNow,
                    ChangedBy = actorId,
                    BusinessArea = "RECONCILIATION",
                    EntityName = nameof(ReconciliationDailyDisposition),
                    EntityId = disposition.DispositionId,
                    FieldName = "Validity",
                    OldValue = $"{disposition.Category}|{disposition.Reason}|v{disposition.Version}",
                    NewValue = "INVALIDATED",
                    Reason = "Supplemental inventory issue changed the daily linked issued quantity.",
                    CorrelationId = dto.CorrelationId?.Trim()
                });
                disposition.InvalidatedAt = invalidatedAt;
                disposition.InvalidatedBy = actorId;
                disposition.InvalidationReason = "Supplemental inventory issue changed the daily linked issued quantity.";
            }
        }
        foreach (var item in resolved.Where(item => item.VarianceReason is not null))
            _context.Auditlogs.Add(new AuditLog
            {
                AuditId = GuidHelper.NewId(),
                ChangedAt = DateTime.UtcNow,
                ChangedBy = actorId,
                BusinessArea = "Inventory",
                EntityName = nameof(InventoryIssueLine),
                EntityId = issue.Inventoryissuelines.Single(line => line.ReconciliationBatchDailyLineId!.SequenceEqual(item.Source.DailyLineId)).IssueLineId,
                FieldName = nameof(InventoryIssueLine.IssuedQty),
                OldValue = item.Source.RequiredQuantity.ToString(CultureInfo.InvariantCulture),
                NewValue = item.Quantity.ToString(CultureInfo.InvariantCulture),
                Reason = item.VarianceReason,
                CorrelationId = dto.CorrelationId?.Trim()
            });
        await _unitOfWork.SaveChangesAsync();
        var result = new InventoryIssueCreatedDto
        {
            IssueId = GuidHelper.ToGuidString(issueId),
            IssueCode = issue.IssueCode,
            ConcurrencyVersion = 1
        };
        var response = JsonSerializer.Serialize(result);
        recorder.Stage(new LifecycleTransitionRequest(nameof(InventoryIssue), batchId, commandId, checked((int)batch.Version), previousBatchStatus, isSupplemental ? "SUPPLEMENTAL_ISSUED" : "ISSUED", actorId,
            dto.ExpectedVersion, isSupplemental ? $"Tạo phiếu xuất thêm {issue.IssueCode} cho lô đối chiếu." : $"Tạo phiếu xuất {issue.IssueCode} từ lô đối chiếu.", dto.CorrelationId, dto.CausationId, response, response));
        await _unitOfWork.SaveChangesAsync();
        return result;
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
}
