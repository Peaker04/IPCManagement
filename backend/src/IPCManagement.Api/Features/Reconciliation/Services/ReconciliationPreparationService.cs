using System.Collections;
using System.Data;
using System.Text.Json;
using IPCManagement.Api.Data;
using IPCManagement.Api.Data.Transactions;
using IPCManagement.Api.Exceptions;
using IPCManagement.Api.Features.Inventory.Services;
using IPCManagement.Api.Features.Reconciliation.Contracts;
using IPCManagement.Api.Features.SystemOperation.Services;
using IPCManagement.Api.Helpers;
using IPCManagement.Api.Infrastructure.Lifecycle;
using IPCManagement.Api.Models.Entities;
using Microsoft.EntityFrameworkCore;

namespace IPCManagement.Api.Features.Reconciliation.Services;

public sealed class ReconciliationPreparationService(
    IpcManagementContext context,
    IStockLedgerService stockLedgerService,
    IEfTransactionRunner transactionRunner,
    IOperationalWarehouseResolver operationalWarehouseResolver,
    SystemOperationRequestContext? requestContext = null)
{
    public async Task<ReconciliationPreparationDto> GetPreparationAsync(
        DateOnly serviceDate,
        IReadOnlyList<string>? batchIds = null,
        CancellationToken token = default)
    {
        EnsureReconciliationMode();

        var query = context.Reconciliationbatchdailylines.AsNoTracking()
            .Include(d => d.BatchLine).ThenInclude(bl => bl.Ingredient).ThenInclude(i => i.Unit)
            .Include(d => d.BatchLine).ThenInclude(bl => bl.CanonicalUnit)
            .Include(d => d.BatchLine).ThenInclude(bl => bl.Batch)
            .Where(d => d.ServiceDate == serviceDate && d.RequiredQuantity > 0);

        if (batchIds is not null && batchIds.Count > 0)
        {
            var parsedBatchBytes = batchIds
                .Select(ReconciliationBatchService.RequiredId)
                .ToList();
            query = query.Where(d => parsedBatchBytes.Contains(d.BatchId));
        }

        var dailyLines = await query.ToListAsync(token);
        if (dailyLines.Count == 0)
        {
            return new ReconciliationPreparationDto(serviceDate, [], []);
        }

        var distinctBatchIds = dailyLines.Select(d => d.BatchId).Distinct(ByteArrayComparer.Instance).ToList();
        var batches = await context.Reconciliationbatches.AsNoTracking()
            .Where(b => distinctBatchIds.Contains(b.BatchId))
            .ToListAsync(token);

        var menuVersionIds = batches.Select(b => b.MenuVersionId).Distinct(ByteArrayComparer.Instance).ToList();
        var menuVersions = await context.Menuversions.AsNoTracking()
            .Include(mv => mv.Customer)
            .Where(mv => menuVersionIds.Contains(mv.MenuVersionId))
            .ToDictionaryAsync(mv => Convert.ToHexString(mv.MenuVersionId), StringComparer.Ordinal, token);

        var existingIssues = await context.Inventoryissues.AsNoTracking()
            .Include(i => i.Inventoryissuelines)
            .Where(i => i.IssueDate == serviceDate && i.ReconciliationBatchId != null && distinctBatchIds.Contains(i.ReconciliationBatchId))
            .ToListAsync(token);

        var issueLinesByDailyLineId = existingIssues
            .SelectMany(i => i.Inventoryissuelines)
            .Where(l => l.ReconciliationBatchDailyLineId != null)
            .GroupBy(l => Convert.ToHexString(l.ReconciliationBatchDailyLineId!))
            .ToDictionary(g => g.Key, g => g.Sum(l => l.IssuedQty), StringComparer.Ordinal);

        var existingIssueBatchIds = existingIssues
            .Select(i => Convert.ToHexString(i.ReconciliationBatchId!))
            .ToHashSet(StringComparer.Ordinal);

        var allocationsByIngredientKey = new Dictionary<string, List<ReconciliationPreparationBatchAllocationDto>>(StringComparer.Ordinal);
        var batchSummaries = new List<ReconciliationPreparationBatchSummaryDto>();

        foreach (var batch in batches)
        {
            var bHex = Convert.ToHexString(batch.BatchId);
            var mvHex = Convert.ToHexString(batch.MenuVersionId);
            menuVersions.TryGetValue(mvHex, out var menuVersion);

            var batchDailyLines = dailyLines.Where(d => d.BatchId.SequenceEqual(batch.BatchId)).ToList();
            var batchRequired = batchDailyLines.Sum(d => d.RequiredQuantity);
            var batchIssued = batchDailyLines.Sum(d => issueLinesByDailyLineId.GetValueOrDefault(Convert.ToHexString(d.DailyLineId)));
            var batchRemaining = Math.Max(0, batchRequired - batchIssued);

            batchSummaries.Add(new ReconciliationPreparationBatchSummaryDto(
                GuidHelper.ToGuidString(batch.BatchId),
                menuVersion?.CustomerId is null ? string.Empty : GuidHelper.ToGuidString(menuVersion.CustomerId),
                menuVersion?.Customer?.CustomerCode,
                menuVersion?.Customer?.CustomerName,
                batch.Status,
                batch.Version,
                batch.Status is "TRANSFERRED" or "IN_PROGRESS",
                existingIssueBatchIds.Contains(bHex),
                batchRequired,
                batchIssued,
                batchRemaining));

            foreach (var daily in batchDailyLines)
            {
                var ingredientKey = $"{Convert.ToHexString(daily.IngredientId)}:{Convert.ToHexString(daily.CanonicalUnitId)}";
                if (!allocationsByIngredientKey.TryGetValue(ingredientKey, out var allocList))
                {
                    allocList = [];
                    allocationsByIngredientKey[ingredientKey] = allocList;
                }

                var dailyHex = Convert.ToHexString(daily.DailyLineId);
                var issued = issueLinesByDailyLineId.TryGetValue(dailyHex, out var issVal) ? issVal : (decimal?)null;
                var remaining = Math.Max(0, daily.RequiredQuantity - (issued ?? 0));
                var status = ReconciliationDailyIssuePolicy.ResolveLineStatus(daily.RequiredQuantity, issued, false).QuantityStatus;

                allocList.Add(new ReconciliationPreparationBatchAllocationDto(
                    GuidHelper.ToGuidString(daily.BatchId),
                    GuidHelper.ToGuidString(daily.BatchLineId),
                    GuidHelper.ToGuidString(daily.DailyLineId),
                    menuVersion?.CustomerId is null ? string.Empty : GuidHelper.ToGuidString(menuVersion.CustomerId),
                    menuVersion?.Customer?.CustomerCode,
                    menuVersion?.Customer?.CustomerName,
                    daily.RequiredQuantity,
                    issued,
                    remaining,
                    status));
            }
        }

        var aggregatedLines = dailyLines
            .GroupBy(d => $"{Convert.ToHexString(d.IngredientId)}:{Convert.ToHexString(d.CanonicalUnitId)}")
            .Select(g =>
            {
                var first = g.First();
                var ingredientKey = g.Key;
                var allocs = allocationsByIngredientKey.GetValueOrDefault(ingredientKey) ?? [];
                var totalReq = allocs.Sum(a => a.RequiredQuantity);
                var totalIss = allocs.Sum(a => a.IssuedQuantity ?? 0);
                var totalRem = allocs.Sum(a => a.RemainingQuantity);

                return new ReconciliationPreparationAggregatedLineDto(
                    GuidHelper.ToGuidString(first.IngredientId),
                    first.BatchLine.Ingredient.IngredientCode,
                    first.BatchLine.Ingredient.IngredientName,
                    GuidHelper.ToGuidString(first.CanonicalUnitId),
                    first.BatchLine.CanonicalUnit.UnitName,
                    totalReq,
                    totalIss,
                    totalRem,
                    allocs);
            })
            .OrderBy(l => l.IngredientName)
            .ToList();

        return new ReconciliationPreparationDto(serviceDate, batchSummaries, aggregatedLines);
    }

    public async Task<CoordinatedPreparationIssueResultDto> IssueCoordinatedAsync(
        CoordinatedPreparationIssueRequest request,
        string actorUserId,
        CancellationToken token = default)
    {
        EnsureReconciliationMode();
        var actorId = GuidHelper.ParseGuidString(actorUserId)
            ?? throw new UnauthorizedAccessException("Không xác định được người dùng.");
        var commandId = request.CommandId?.Trim() ?? string.Empty;
        if (commandId.Length == 0)
            throw new ArgumentException("CommandId là bắt buộc.");
        if (request.Batches is null || request.Batches.Count == 0)
            throw new ArgumentException("Cần chọn ít nhất một lô đối soát để xuất kho.");

        var distinctBatchIds = request.Batches.Select(b => b.ReconciliationBatchId).Distinct(StringComparer.OrdinalIgnoreCase).ToList();
        if (distinctBatchIds.Count != request.Batches.Count)
            throw new BusinessRuleException("Danh sách xuất kho không được chứa lô trùng lặp.");

        const string aggregateType = "CoordinatedPreparationIssue";
        var existingReceipt = await context.Lifecyclecommandreceipts.AsNoTracking()
            .SingleOrDefaultAsync(item => item.CommandId == commandId && item.AggregateType == aggregateType, token);
        if (existingReceipt is not null)
        {
            var existingResult = JsonSerializer.Deserialize<CoordinatedPreparationIssueResultDto>(existingReceipt.ResponseJson)
                ?? throw new InvalidOperationException("Không thể giải mã kết quả lệnh xuất kho đã ghi nhận.");
            return existingResult with { IdempotentReplay = true };
        }

        var preparationGroupId = GuidHelper.NewId();
        var warehouseId = await ResolveCanonicalWarehouseAsync(request.WarehouseId);

        var (operationKey, expectedModeVersion) = RequiredModeProtection();

        return await transactionRunner.ExecuteProtectedAsync(
            operationKey,
            expectedModeVersion,
            async opToken =>
            {
                var issueResults = new List<CoordinatedPreparationBatchResultDto>();
                var recorder = new LifecycleTransitionRecorder(context);

                foreach (var batchReq in request.Batches)
                {
                    var batchBytes = ReconciliationBatchService.RequiredId(batchReq.ReconciliationBatchId);
                    var batch = await context.Reconciliationbatches
                        .Include(b => b.Lines).ThenInclude(l => l.DailyLines)
                        .SingleOrDefaultAsync(b => b.BatchId == batchBytes, opToken)
                        ?? throw new BusinessRuleException($"Không tìm thấy lô đối soát với ID: {batchReq.ReconciliationBatchId}");

                    if (batch.Status is not ("TRANSFERRED" or "IN_PROGRESS"))
                        throw new BusinessRuleException($"Lô {batchReq.ReconciliationBatchId} chưa sẵn sàng để xuất kho (trạng thái: {batch.Status}).");
                    if (batch.Version != batchReq.ExpectedVersion)
                        throw new DbUpdateConcurrencyException($"Lô {batchReq.ReconciliationBatchId} đã thay đổi; hãy tải lại trước khi xác nhận.");

                    var dailyLines = batch.Lines.SelectMany(l => l.DailyLines)
                        .Where(d => d.ServiceDate == request.ServiceDate)
                        .ToList();
                    if (dailyLines.Count == 0)
                        throw new BusinessRuleException($"Lô {batchReq.ReconciliationBatchId} không có định lượng cho ngày {request.ServiceDate:yyyy-MM-dd}.");

                    if (batchReq.Lines.Count == 0)
                        throw new BusinessRuleException($"Lô {batchReq.ReconciliationBatchId} phải có ít nhất một dòng xuất.");

                    var dailyById = dailyLines.ToDictionary(d => Convert.ToHexString(d.DailyLineId), StringComparer.Ordinal);
                    var resolvedLines = new List<(ReconciliationBatchDailyLine Daily, decimal IssuedQty, string? VarianceReason)>();

                    foreach (var lineReq in batchReq.Lines)
                    {
                        var dailyId = ReconciliationBatchService.RequiredId(lineReq.ReconciliationBatchDailyLineId);
                        var dailyHex = Convert.ToHexString(dailyId);
                        if (!dailyById.TryGetValue(dailyHex, out var dailyLine))
                            throw new BusinessRuleException($"Dòng xuất không thuộc ngày {request.ServiceDate:yyyy-MM-dd} của lô {batchReq.ReconciliationBatchId}.");

                        var expectedBatchLineId = ReconciliationBatchService.RequiredId(lineReq.ReconciliationBatchLineId);
                        if (!dailyLine.BatchLineId.SequenceEqual(expectedBatchLineId))
                            throw new BusinessRuleException("Dòng tổng tuần không khớp nguồn theo ngày đã đóng băng.");

                        var reqIngredientId = ReconciliationBatchService.RequiredId(lineReq.IngredientId);
                        var reqUnitId = ReconciliationBatchService.RequiredId(lineReq.UnitId);
                        if (!dailyLine.IngredientId.SequenceEqual(reqIngredientId) || !dailyLine.CanonicalUnitId.SequenceEqual(reqUnitId))
                            throw new BusinessRuleException("Nguyên liệu hoặc đơn vị không khớp dòng nguồn đã đóng băng.");

                        if (lineReq.RequestedQty != dailyLine.RequiredQuantity)
                            throw new BusinessRuleException("Số lượng cần xuất không khớp dòng nguồn đã đóng băng.");

                        var issuedQty = DecimalPolicy.RoundQuantity(lineReq.IssuedQty);
                        if (issuedQty <= 0)
                            throw new BusinessRuleException("Số lượng thực xuất phải lớn hơn 0.");

                        var isOver = DecimalPolicy.LessThanQuantity(dailyLine.RequiredQuantity, issuedQty);
                        var varianceReason = lineReq.VarianceReason?.Trim();
                        if (isOver && string.IsNullOrWhiteSpace(varianceReason))
                            throw new BusinessRuleException("Cần nhập lý do khi số lượng thực xuất vượt số lượng cần xuất.");

                        resolvedLines.Add((dailyLine, issuedQty, varianceReason));
                    }

                    if (resolvedLines.Select(r => Convert.ToHexString(r.Daily.DailyLineId)).Distinct().Count() != resolvedLines.Count)
                        throw new BusinessRuleException($"Một dòng nguồn theo ngày không thể xuất lặp trong cùng phiếu.");

                    var hasExistingIssue = await context.Inventoryissues.AnyAsync(
                        i => i.ReconciliationBatchId == batchBytes && i.IssueDate == request.ServiceDate, opToken);
                    if (!hasExistingIssue && resolvedLines.Count != dailyById.Count)
                        throw new BusinessRuleException($"Phiếu xuất đầu tiên của lô {batchReq.ReconciliationBatchId} phải ghi nhận đủ mọi nguyên liệu của ngày đã khóa.");

                    foreach (var r in resolvedLines)
                    {
                        var stock = await context.Currentstocks.SingleOrDefaultAsync(
                            s => s.WarehouseId.SequenceEqual(warehouseId) && s.IngredientId.SequenceEqual(r.Daily.IngredientId), opToken);
                        var available = stock?.CurrentQty ?? 0m;
                        if (DecimalPolicy.LessThanQuantity(available, r.IssuedQty))
                        {
                            var missing = DecimalPolicy.RoundQuantity(r.IssuedQty - available);
                            await stockLedgerService.AddStockAsync(
                                warehouseId,
                                r.Daily.IngredientId,
                                r.Daily.CanonicalUnitId,
                                missing,
                                "ADJUSTMENT",
                                nameof(ReconciliationBatch),
                                batchBytes,
                                actorId,
                                "Bảo đảm đủ tồn kho cho chế độ đối chiếu nguyên liệu",
                                $"Tự động bổ sung tồn kho cho lô {GuidHelper.ToGuidString(batchBytes)}");
                        }
                    }
                    await context.SaveChangesAsync(opToken);

                    context.Entry(batch).Property(b => b.Version).OriginalValue = batchReq.ExpectedVersion;
                    var prevStatus = batch.Status;
                    batch.Status = "IN_PROGRESS";
                    batch.Version++;

                    var issueId = GuidHelper.NewId();
                    var issueCode = $"ISS-{DateTime.Now:yyyyMMdd-HHmmss}-{Guid.NewGuid().ToString("N")[..4].ToUpper()}";
                    var issue = new InventoryIssue
                    {
                        IssueId = issueId,
                        IssueCode = issueCode,
                        IssueDate = request.ServiceDate,
                        WarehouseId = warehouseId,
                        ReconciliationBatchId = batchBytes,
                        PreparationGroupId = preparationGroupId,
                        IssuedBy = actorId,
                        CreatedAt = DateTime.UtcNow,
                        Inventoryissuelines = resolvedLines.Select(r => new InventoryIssueLine
                        {
                            IssueLineId = GuidHelper.NewId(),
                            IssueId = issueId,
                            IngredientId = r.Daily.IngredientId,
                            UnitId = r.Daily.CanonicalUnitId,
                            RequestedQty = r.Daily.RequiredQuantity,
                            IssuedQty = r.IssuedQty,
                            ReconciliationBatchLineId = r.Daily.BatchLineId,
                            ReconciliationBatchDailyLineId = r.Daily.DailyLineId,
                            ReconciliationServiceDate = request.ServiceDate
                        }).ToList()
                    };
                    context.Inventoryissues.Add(issue);

                    foreach (var line in issue.Inventoryissuelines)
                    {
                        await stockLedgerService.RemoveStockWithCheckAsync(
                            warehouseId,
                            line.IngredientId,
                            line.UnitId,
                            line.IssuedQty,
                            "ISSUE",
                            "inventoryissues",
                            issueId,
                            actorId,
                            "Xuất kho đối chiếu",
                            $"Phiếu xuất {issue.IssueCode}");
                    }

                    foreach (var r in resolvedLines.Where(item => item.VarianceReason is not null))
                    {
                        context.Auditlogs.Add(new AuditLog
                        {
                            AuditId = GuidHelper.NewId(),
                            ChangedAt = DateTime.UtcNow,
                            ChangedBy = actorId,
                            BusinessArea = "Inventory",
                            EntityName = nameof(InventoryIssueLine),
                            EntityId = r.Daily.DailyLineId,
                            FieldName = nameof(InventoryIssueLine.IssuedQty),
                            OldValue = r.Daily.RequiredQuantity.ToString("0.######"),
                            NewValue = r.IssuedQty.ToString("0.######"),
                            Reason = r.VarianceReason
                        });
                    }

                    issueResults.Add(new CoordinatedPreparationBatchResultDto(
                        batchReq.ReconciliationBatchId,
                        GuidHelper.ToGuidString(issueId),
                        issueCode,
                        batch.Version));
                }

                await context.SaveChangesAsync(opToken);

                var finalResult = new CoordinatedPreparationIssueResultDto(
                    GuidHelper.ToGuidString(preparationGroupId),
                    request.ServiceDate,
                    commandId,
                    issueResults,
                    false);

                var responseJson = JsonSerializer.Serialize(finalResult);
                recorder.Stage(new LifecycleTransitionRequest(
                    aggregateType,
                    preparationGroupId,
                    commandId,
                    1,
                    null,
                    "COORDINATED_ISSUED",
                    actorId,
                    0,
                    $"Xuất kho phối hợp {issueResults.Count} lô đối soát cho ngày {request.ServiceDate:yyyy-MM-dd}.",
                    null,
                    null,
                    responseJson,
                    responseJson));

                await context.SaveChangesAsync(opToken);
                return finalResult;
            },
            async verifyToken => await context.Lifecyclecommandreceipts.AsNoTracking().AnyAsync(
                r => r.CommandId == commandId && r.AggregateType == aggregateType, verifyToken),
            IsolationLevel.Serializable,
            token);
    }

    public Task<ReconciliationPreparationWorkbookDto> GetWorkbookAsync(
        ReconciliationPreparationWorkbookQuery query,
        CancellationToken token = default)
        => new ReconciliationPreparationWorkbookExporter(context, requestContext).GetWorkbookAsync(query, token);

    public Task<byte[]> ExportWorkbookXlsxAsync(
        ReconciliationPreparationWorkbookQuery query,
        CancellationToken token = default)
        => new ReconciliationPreparationWorkbookExporter(context, requestContext).ExportWorkbookXlsxAsync(query, token);

    private void EnsureReconciliationMode()
    {
        if (requestContext is not null && !string.Equals(requestContext.Mode, SystemOperationEligibility.MaterialReconciliation, StringComparison.Ordinal))
        {
            throw new BusinessRuleException("Chuẩn bị nguyên liệu chỉ được thực hiện trong chế độ đối chiếu nguyên liệu.");
        }
    }

    private (string OperationKey, long ExpectedModeVersion) RequiredModeProtection()
    {
        if (requestContext is null)
            throw new InvalidOperationException("Thiếu ngữ cảnh bảo vệ chế độ vận hành cho lệnh xuất kho phối hợp.");
        requestContext.Disposition = OperationDisposition.ReconciliationOnly;
        return (requestContext.OperationKey, requestContext.ExpectedModeVersion) switch
        {
            ({ Length: > 0 } operationKey, long expectedModeVersion) => (operationKey, expectedModeVersion),
            _ => ("reconciliation.preparation.issue", 1)
        };
    }

    private async Task<byte[]> ResolveCanonicalWarehouseAsync(string? suppliedWarehouseId)
    {
        var canonicalId = await operationalWarehouseResolver.ResolveAsync();
        if (suppliedWarehouseId is null) return canonicalId;
        var suppliedId = GuidHelper.ParseGuidString(suppliedWarehouseId)
            ?? throw new ArgumentException("WarehouseId không hợp lệ.");
        if (!suppliedId.AsSpan().SequenceEqual(canonicalId))
            throw new BusinessRuleException("Kho trên yêu cầu không khớp kho vận hành của hệ thống.");
        return canonicalId;
    }

    private sealed class ByteArrayComparer : IEqualityComparer<byte[]>
    {
        public static readonly ByteArrayComparer Instance = new();
        public bool Equals(byte[]? x, byte[]? y) => StructuralComparisons.StructuralEqualityComparer.Equals(x, y);
        public int GetHashCode(byte[] obj) => StructuralComparisons.StructuralEqualityComparer.GetHashCode(obj);
    }
}
