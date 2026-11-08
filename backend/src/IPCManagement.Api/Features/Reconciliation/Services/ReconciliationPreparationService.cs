using System.Collections;
using System.Data;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using IPCManagement.Api.Data;
using IPCManagement.Api.Data.Repositories;
using IPCManagement.Api.Data.Transactions;
using IPCManagement.Api.Exceptions;
using IPCManagement.Api.Features.Inventory.Contracts;
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
    IEfTransactionRunner transactionRunner,
    IOperationalWarehouseResolver operationalWarehouseResolver,
    SystemOperationRequestContext? requestContext = null)
{
    public async Task<ReconciliationPreparationDto> GetPreparationAsync(
        DateOnly serviceDate,
        IReadOnlyList<string>? batchIds = null,
        CancellationToken token = default,
        bool wholeWeek = false)
    {
        EnsureReconciliationMode();
        var scope = new ReconciliationPreparationWorkbookQuery
        {
            ServiceDate = wholeWeek ? null : serviceDate,
            WeekStartDate = wholeWeek ? serviceDate : null
        };
        var (start, end) = scope.GetDateRange();

        var query = context.Reconciliationbatchdailylines.AsNoTracking()
            .Include(d => d.BatchLine).ThenInclude(bl => bl.Ingredient).ThenInclude(i => i.Unit)
            .Include(d => d.BatchLine).ThenInclude(bl => bl.CanonicalUnit)
            .Include(d => d.BatchLine).ThenInclude(bl => bl.Batch)
            .Where(d => d.ServiceDate >= start && d.ServiceDate <= end && d.RequiredQuantity > 0);

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
            .Where(i => i.IssueDate >= start && i.IssueDate <= end && i.ReconciliationBatchId != null && distinctBatchIds.Contains(i.ReconciliationBatchId))
            .ToListAsync(token);

        var netIssues = await new ReconciliationNetIssueProjection(context).LoadByDailyLineIdsAsync(
            dailyLines.Select(line => line.DailyLineId).ToList(), token);
        var issueLinesByDailyLineId = netIssues.ToDictionary(item => item.Key, item => item.Value.NetIssuedQuantity, StringComparer.Ordinal);

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
        requestContext!.OperationKey = operationKey;
        requestContext.ExpectedModeVersion = expectedModeVersion;

        return await transactionRunner.ExecuteProtectedAsync(
            operationKey,
            expectedModeVersion,
            async opToken =>
            {
                var issueResults = new List<CoordinatedPreparationBatchResultDto>();
                var recorder = new LifecycleTransitionRecorder(context);
                var creator = new ReconciliationInventoryIssueCreator(
                    new InventoryIssueRepository(context), new UnitOfWork(context),
                    transactionRunner, operationalWarehouseResolver, context, requestContext, null, null);

                foreach (var batchReq in request.Batches)
                {
                    var batchBytes = ReconciliationBatchService.RequiredId(batchReq.ReconciliationBatchId);
                    var childCommandId = $"prep-{Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes($"{commandId}:{Convert.ToHexString(batchBytes)}")))}";
                    var created = await creator.CreateWithinTransactionAsync(new CreateInventoryIssueRequest
                    {
                        CommandId = childCommandId,
                        ReconciliationBatchId = batchReq.ReconciliationBatchId,
                        ExpectedVersion = batchReq.ExpectedVersion,
                        IssueDate = request.ServiceDate,
                        WarehouseId = GuidHelper.ToGuidString(warehouseId),
                        Lines = batchReq.Lines.Select(line => new CreateInventoryIssueLineRequest
                        {
                            ReconciliationBatchLineId = line.ReconciliationBatchLineId,
                            ReconciliationBatchDailyLineId = line.ReconciliationBatchDailyLineId,
                            IngredientId = line.IngredientId, UnitId = line.UnitId,
                            RequestedQty = line.RequestedQty, IssuedQty = line.IssuedQty, VarianceReason = line.VarianceReason
                        }).ToList()
                    }, actorId, opToken);
                    var issueId = ReconciliationBatchService.RequiredId(created.IssueId);
                    var issue = await context.Inventoryissues.SingleAsync(item => item.IssueId == issueId, opToken);
                    issue.PreparationGroupId = preparationGroupId;
                    var batch = await context.Reconciliationbatches.SingleAsync(item => item.BatchId == batchBytes, opToken);
                    issueResults.Add(new CoordinatedPreparationBatchResultDto(
                        batchReq.ReconciliationBatchId, created.IssueId, created.IssueCode, batch.Version));
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
