using System.Data;
using IPCManagement.Api.Data;
using IPCManagement.Api.Data.Transactions;
using IPCManagement.Api.Features.Reconciliation.Contracts;
using IPCManagement.Api.Exceptions;
using IPCManagement.Api.Features.SystemOperation.Services;
using IPCManagement.Api.Helpers;
using IPCManagement.Api.Models.Entities;
using IPCManagement.Api.Shared.Contracts;
using Microsoft.EntityFrameworkCore;
using MySqlConnector;

namespace IPCManagement.Api.Features.Reconciliation.Services;

public sealed class ReconciliationBatchService(
    IpcManagementContext context,
    IEfTransactionRunner transactions,
    SystemOperationRequestContext requestContext)
{
    public Task<PagedResponseDto<ReconciliationBatchSummaryDto>> GetPageAsync(
        ReconciliationBatchPageQuery request,
        CancellationToken token = default) =>
        ReconciliationBatchQueryProjector.GetPageAsync(context, request, RequiredId, token);

    public async Task<IReadOnlyList<ReconciliationBatchDto>> ListAsync(CancellationToken token = default)
    {
        var batches = await context.Reconciliationbatches.AsNoTracking()
            .Include(x => x.Lines).ThenInclude(x => x.Ingredient)
            .Include(x => x.Lines).ThenInclude(x => x.CanonicalUnit)
            .OrderByDescending(x => x.CreatedAt).ToListAsync(token);
        var lineIds = batches.SelectMany(x => x.Lines).Select(x => x.BatchLineId).ToList();
        var actuals = await context.Reconciliationactuals.AsNoTracking().Where(x => lineIds.Contains(x.BatchLineId)).ToListAsync(token);
        var dispositions = await context.Reconciliationdispositions.AsNoTracking()
            .Where(x => x.InvalidatedAt == null && lineIds.Contains(x.BatchLineId)).ToListAsync(token);
        var issued = await LoadLinkedIssuedQuantitiesAsync(lineIds, token);

        var customerMap = await LoadCustomersForBatchesAsync(batches, token);
        var weekMap = await LoadWeeksForBatchesAsync(batches, token);
        return batches.Select(batch => {
            var menuVersionKey = Convert.ToHexString(batch.MenuVersionId);
            customerMap.TryGetValue(menuVersionKey, out var customer);
            weekMap.TryGetValue(menuVersionKey, out var weekStartDate);
            return Map(batch, actuals, dispositions, issued, customer: customer, weekStartDate: weekStartDate);
        }).ToList();
    }

    public async Task<ReconciliationWarehouseDailyDto?> GetWarehouseDailyAsync(string id, CancellationToken token = default)
    {
        var normalizedId = GuidHelper.ToGuidString(RequiredId(id));
        var results = await GetWarehouseDailyManyAsync([normalizedId], token);
        return results.GetValueOrDefault(normalizedId);
    }

    public Task<IReadOnlyDictionary<string, ReconciliationWarehouseDailyDto>> GetWarehouseDailyManyAsync(
        IReadOnlyCollection<string> ids, CancellationToken token = default, bool includeMetadata = true) =>
        GetWarehouseDailyManyCoreAsync(ids, null, null, null, null, token, includeMetadata);

    private Task<IReadOnlyDictionary<string, ReconciliationWarehouseDailyDto>> GetWarehouseDailyManyCoreAsync(
        IReadOnlyCollection<string> ids,
        IReadOnlyList<ReconciliationBatch>? preloadedBatches,
        IReadOnlyList<ReconciliationBatchLine>? preloadedWeeklyLines,
        IReadOnlyDictionary<string, DateOnly>? preloadedWeekByVersionId,
        List<ReconciliationDailyDisposition>? dailyDispositionsSink,
        CancellationToken token = default,
        bool includeMetadata = true) =>
        ReconciliationWarehouseDailyQuery.GetManyAsync(context, ids, preloadedBatches, preloadedWeeklyLines, preloadedWeekByVersionId, dailyDispositionsSink, token, includeMetadata);

    public async Task<IReadOnlyList<ReconciliationDraftSourceDto>> ListDraftSourcesAsync(CancellationToken token = default)
    {
        var imports = await context.Quantityimportbatches.AsNoTracking()
            .Where(import => import.Status == "CONFIRMED"
                && import.MenuVersionId != null
                && import.ContentFingerprint != null && import.ContentFingerprint != ""
                && import.SourceLabel != null && import.SourceLabel != ""
                && import.FingerprintFormatVersion == ReconciliationQuantityImportService.CurrentFingerprintFormatVersion)
            .Include(import => import.Mealquantityplans)
            .ThenInclude(plan => plan.Mealquantityplanlines)
            .ThenInclude(line => line.MenuSchedule)
            .ThenInclude(schedule => schedule.MenuVersion)
            .AsSplitQuery()
            .ToListAsync(token);

        return imports
            .Where(import => IsExactCommittedAuthority(import, import.MenuVersionId!))
            .Select(import => new { Import = import, MenuVersion = import.Mealquantityplans.First().Mealquantityplanlines.First().MenuSchedule.MenuVersion! })
            .OrderByDescending(source => source.MenuVersion.WeekStartDate)
            .ThenByDescending(source => source.Import.ImportedAt)
            .Select(source => new ReconciliationDraftSourceDto(
                GuidHelper.ToGuidString(source.Import.MenuVersionId!),
                $"Tuần {source.MenuVersion.WeekStartDate:dd/MM/yyyy} · phiên bản {source.MenuVersion.VersionNo}",
                GuidHelper.ToGuidString(source.Import.ImportBatchId),
                $"{source.Import.BatchCode} · {source.Import.ImportedAt:dd/MM/yyyy HH:mm}"))
            .ToList();
    }

    public async Task<ReconciliationBatchDto?> GetAsync(string id, CancellationToken token = default)
    {
        var bytes = RequiredId(id);
        var batch = await context.Reconciliationbatches.AsNoTracking()
            .Include(x => x.Lines).ThenInclude(x => x.Ingredient)
            .Include(x => x.Lines).ThenInclude(x => x.CanonicalUnit)
            .SingleOrDefaultAsync(x => x.BatchId == bytes, token);
        if (batch is null) return null;
        var inMemory = string.Equals(context.Database.ProviderName, "Microsoft.EntityFrameworkCore.InMemory", StringComparison.Ordinal);
        var batchLines = batch.Lines.Count > 0
            ? batch.Lines.ToList()
            : inMemory
                ? (await context.Reconciliationbatchlines.AsNoTracking().ToListAsync(token)).Where(line => line.BatchId != null && line.BatchId.SequenceEqual(bytes)).ToList()
                : await context.Reconciliationbatchlines.AsNoTracking().Include(line => line.Ingredient).Include(line => line.CanonicalUnit)
                    .Where(line => line.BatchId == bytes).ToListAsync(token);
        var actuals = await context.Reconciliationactuals.AsNoTracking().Where(x => x.BatchLine.BatchId == bytes).ToListAsync(token);
        var dispositions = await context.Reconciliationdispositions.AsNoTracking()
            .Where(x => x.InvalidatedAt == null && x.BatchLine.BatchId == bytes).ToListAsync(token);
        var lineIds = batchLines.Select(line => line.BatchLineId).ToList();
        var issued = await LoadLinkedIssuedQuantitiesAsync(lineIds, token);
        var notes = await new MrxIssueNoteQuery(context).LoadAsync(lineIds, token);
        var issueNotes = notes.GroupBy(note => Convert.ToHexString(note.BatchLineId))
            .ToDictionary(group => group.Key, group => (IReadOnlyList<string>)group.Select(note => note.Reason).ToList(), StringComparer.Ordinal);
        var (customer, weekStartDate) = await TryGetMenuVersionMetadataAsync(batch.MenuVersionId, token);
        var result = Map(batch, actuals, dispositions, issued, batchLines, issueNotes, customer, weekStartDate);
        var normalizedId = GuidHelper.ToGuidString(bytes);
        var preloadedWeeks = weekStartDate is { } ws
            ? new Dictionary<string, DateOnly>(StringComparer.Ordinal) { [Convert.ToHexString(batch.MenuVersionId)] = ws }
            : null;
        var dailyDispositions = new List<ReconciliationDailyDisposition>();
        var dailyMap = await GetWarehouseDailyManyCoreAsync([normalizedId], [batch], batchLines, preloadedWeeks, dailyDispositions, token, includeMetadata: false);
        var daily = dailyMap.GetValueOrDefault(normalizedId);
        if (daily is null || daily.Compatibility.ReasonCode == "LEGACY_DAILY_LINEAGE_MISSING") return result;

        var dispositionById = dailyDispositions.ToDictionary(item => GuidHelper.ToGuidString(item.DailyLineId), StringComparer.Ordinal);
        var dailyNotes = notes.Where(note => note.DailyLineId != null)
            .GroupBy(note => GuidHelper.ToGuidString(note.DailyLineId!))
            .ToDictionary(group => group.Key, group => (IReadOnlyList<string>)group.Select(note => note.Reason).ToList(), StringComparer.Ordinal);
        var weeklyById = result.Lines.ToDictionary(line => line.BatchLineId, StringComparer.Ordinal);
        var reviewLines = daily.Dates.SelectMany(day => day.Lines.Select(line =>
        {
            dispositionById.TryGetValue(line.DailyLineId, out var disposition);
            var over = line.QuantityStatus == "OVER_ISSUED";
            return weeklyById[line.BatchLineId] with
            {
                DailyLineId = line.DailyLineId, ServiceDate = day.ServiceDate,
                RequiredQuantity = line.RequiredQuantity, FrozenTolerance = 0,
                PurchasedQuantity = null, PurchasedVersion = null, PurchasedRequiredDifference = null,
                PurchasedIssuedDifference = null, IssuedQuantity = line.IssuedQuantity, IssuedVersion = null,
                IssuedRequiredDifference = line.IssuedQuantity is { } issuedQuantity
                    ? DecimalPolicy.RoundQuantity(issuedQuantity - line.RequiredQuantity) : null,
                Status = line.QuantityStatus == "EXACT" ? "MATCHED" : over ? "NEEDS_REVIEW" : "INCOMPLETE",
                Triggers = over ? ["ISSUED_REQUIRED"] : [],
                Disposition = line.HasValidDisposition && disposition is not null
                    ? new ReconciliationDispositionDto(disposition.Category, disposition.Reason, disposition.Version, disposition.DisposedAt) : null,
                IssueNotes = dailyNotes.GetValueOrDefault(line.DailyLineId)
            };
        })).ToList();
        return result with { DailyReview = new ReconciliationDailyReviewDto(daily.WeeklyStatus, reviewLines) };
    }

    public Task<IReadOnlyList<ReconciliationSourceChangeDto>> ListSourceChangesAsync(string id, CancellationToken token = default) =>
        ReconciliationSourceChangeQuery.ListAsync(context, id, token);

    public Task<PagedResponseDto<ReconciliationSourceChangeDto>> GetSourceChangesPageAsync(string id, PagedRequestDto page, CancellationToken token = default) =>
        ReconciliationSourceChangeQuery.PageAsync(context, id, page, token);

    public Task<IReadOnlyList<ReconciliationBatchDishSummaryDto>> ListDishesAsync(string id, CancellationToken token = default) =>
        ReconciliationBatchQueryProjector.ListDishesAsync(context, id, RequiredId, token);

    public async Task<ReconciliationBatchDto> CreateDraftAsync(CreateReconciliationDraftRequest request, string actorId, CancellationToken token = default)
    {
        var batchId = GuidHelper.NewId();
        var menuVersionId = RequiredId(request.MenuVersionId);
        var importBatchId = RequiredId(request.QuantityImportBatchId);
        var actor = RequiredId(actorId);
        var protection = RequiredProtection();

        try
        {
            return await transactions.ExecuteProtectedAsync(
                protection.OperationKey,
                protection.ExpectedVersion,
                async operationToken =>
                {
                    var existing = await LoadByImportAsync(importBatchId, operationToken);
                    if (existing is not null)
                    {
                        if (!existing.MenuVersionId.AsSpan().SequenceEqual(menuVersionId))
                            throw new InvalidOperationException("Nguồn thực đơn không khớp lô đối chiếu đã tồn tại.");
                        return Map(existing, [], []);
                    }

                    var batch = await MaterializeDraftAsync(batchId, menuVersionId, importBatchId, actor, operationToken);
                    await context.SaveChangesAsync(operationToken);
                    return Map(batch, [], []);
                },
                verifySucceeded: verifyToken => context.Reconciliationbatches.AsNoTracking().AnyAsync(x => x.QuantityImportBatchId == importBatchId && x.Lines.Any(), verifyToken),
                isolationLevel: IsolationLevel.Serializable,
                cancellationToken: token);
        }
        catch (DbUpdateException error) when (IsQuantityImportBatchDuplicate(error))
        {
            context.ChangeTracker.Clear();
            var winner = await LoadByImportAsync(importBatchId, token);
            if (winner is null)
                throw new DbUpdateConcurrencyException("Đợt nhập đã được tạo lô đối chiếu đồng thời.", error);
            if (!winner.MenuVersionId.AsSpan().SequenceEqual(menuVersionId))
                throw new InvalidOperationException("Nguồn thực đơn không khớp lô đối chiếu đã tồn tại.");
            return Map(winner, [], []);
        }
    }

    internal async Task<ReconciliationBatch> MaterializeDraftAsync(
        byte[] batchId,
        byte[] menuVersionId,
        byte[] importBatchId,
        byte[] actor,
        CancellationToken token)
    {
        var committedImport = await context.Quantityimportbatches.AsNoTracking()
            .Include(x => x.Mealquantityplans)
            .ThenInclude(x => x.Mealquantityplanlines)
            .ThenInclude(x => x.MenuSchedule)
            .ThenInclude(x => x.MenuVersion)
            .AsSplitQuery()
            .SingleOrDefaultAsync(x => x.ImportBatchId == importBatchId, token);
        if (!IsExactCommittedAuthority(committedImport, menuVersionId))
            throw new BusinessRuleException("Nguồn thực đơn hoặc đợt nhập chưa được cam kết hợp lệ.");

        var sourceLines = await context.Mealquantityplanlines
            .Where(x => x.QuantityPlan.ImportBatchId == importBatchId && x.MenuSchedule.MenuVersionId == menuVersionId)
            .Include(x => x.QuantityPlan).Include(x => x.MenuSchedule)
            .Include(x => x.Menu).ThenInclude(x => x.Menuitems).ThenInclude(x => x.Dish).ThenInclude(x => x.Dishboms).ThenInclude(x => x.Unit)
            .Include(x => x.Menu).ThenInclude(x => x.Menuitems).ThenInclude(x => x.Dish).ThenInclude(x => x.Dishboms).ThenInclude(x => x.Ingredient).ThenInclude(x => x.Unit)
            .AsSplitQuery()
            .ToListAsync(token);
        if (sourceLines.Count == 0) throw new BusinessRuleException("Đợt nhập không có dòng số suất thuộc phiên bản thực đơn đã chọn.");

        var tolerances = await context.Reconciliationtolerances.AsNoTracking().ToListAsync(token);
        var batch = new ReconciliationBatch
        {
            BatchId = batchId,
            MenuVersionId = menuVersionId,
            QuantityImportBatchId = importBatchId,
            Status = "DRAFT",
            Version = 1,
            CreatedBy = actor,
            CreatedAt = DateTime.UtcNow
        };

        var materialized = new Dictionary<string, ReconciliationBatchLine>(StringComparer.Ordinal);
        var materializedDaily = new Dictionary<string, ReconciliationBatchDailyLine>(StringComparer.Ordinal);
        foreach (var projectedSource in ReconciliationMaterialProjection.Project(sourceLines))
        {
            foreach (var dish in projectedSource.Dishes)
            {
                foreach (var material in dish.Materials)
                {
                    var bom = material.Bom;
                    var key = Convert.ToBase64String(bom.IngredientId) + ":" + Convert.ToBase64String(bom.Ingredient.UnitId);
                    if (!materialized.TryGetValue(key, out var line))
                    {
                        var tolerance = ResolveTolerance(tolerances, bom.IngredientId, bom.Ingredient.UnitId);
                        line = new ReconciliationBatchLine
                        {
                            BatchLineId = GuidHelper.NewId(), BatchId = batchId, IngredientId = bom.IngredientId,
                            CanonicalUnitId = bom.Ingredient.UnitId, RequiredQuantity = 0, FrozenTolerance = tolerance.Value,
                            ToleranceSourceKind = tolerance.Kind, ToleranceSourceVersion = tolerance.Version, Version = 1
                        };
                        materialized.Add(key, line);
                        batch.Lines.Add(line);
                    }
                    line.RequiredQuantity += material.RequiredQuantity;
                    var dailyKey = $"{key}:{projectedSource.Source.MenuSchedule.ServiceDate:yyyy-MM-dd}";
                    if (!materializedDaily.TryGetValue(dailyKey, out var dailyLine))
                    {
                        dailyLine = new ReconciliationBatchDailyLine
                        {
                            DailyLineId = GuidHelper.NewId(), BatchLineId = line.BatchLineId, BatchId = batchId,
                            IngredientId = line.IngredientId, CanonicalUnitId = line.CanonicalUnitId,
                            ServiceDate = projectedSource.Source.MenuSchedule.ServiceDate, RequiredQuantity = 0, Version = 1
                        };
                        materializedDaily.Add(dailyKey, dailyLine);
                        line.DailyLines.Add(dailyLine);
                    }
                    dailyLine.RequiredQuantity += material.RequiredQuantity;
                    // Contributor dùng chung với tính lại lô (MrxBatchRecomputer) để không lệch lineage/biến thể.
                    line.Contributors.Add(MrxBatchRecomputer.CreateContributor(
                        line, dailyLine, MrxBatchRecomputer.ContributionFrom(projectedSource, dish, material)));
                }
            }
        }
        if (batch.Lines.Count == 0
            || batch.Lines.Any(line => line.RequiredQuantity <= 0
                || line.DailyLines.Count == 0
                || line.DailyLines.Any(daily => daily.RequiredQuantity <= 0)
                || decimal.Round(line.DailyLines.Sum(daily => daily.RequiredQuantity), 6, MidpointRounding.AwayFromZero) != decimal.Round(line.RequiredQuantity, 6, MidpointRounding.AwayFromZero)
                || line.Contributors.Count == 0
                || line.Contributors.Any(contributor => contributor.DailyLineId is null || contributor.SourceQuantity <= 0)))
            throw new BusinessRuleException("Không thể tạo đầy đủ dòng nguyên liệu dương từ nguồn đã chọn.");
        context.Reconciliationbatches.Add(batch);
        return batch;
    }

    public async Task<ReconciliationBatchDto> ReadyAsync(string id, ReadyReconciliationBatchRequest request, string actorId, CancellationToken token = default)
    {
        var bytes = RequiredId(id);
        var actor = RequiredId(actorId);
        var protection = RequiredProtection();
        return await transactions.ExecuteProtectedAsync(
            protection.OperationKey, protection.ExpectedVersion,
            async operationToken =>
            {
                var batch = await context.Reconciliationbatches
                    .Include(x => x.Lines).ThenInclude(x => x.Contributors.Where(contributor => contributor.InvalidatedAt == null))
                    .Include(x => x.Lines).ThenInclude(x => x.DailyLines)
                    .SingleOrDefaultAsync(x => x.BatchId == bytes, operationToken) ?? throw new KeyNotFoundException();
                context.Entry(batch).Property(x => x.Version).OriginalValue = request.ExpectedVersion;
                if (batch.Status != "DRAFT" || batch.Version != request.ExpectedVersion) throw new DbUpdateConcurrencyException("Lô đối chiếu đã thay đổi.");
                var activeLines = batch.Lines.Where(x => x.RequiredQuantity > 0).ToList();
                if (activeLines.Count == 0 || activeLines.Any(x =>
                        x.FrozenTolerance < 0
                        || x.DailyLines.Count(daily => daily.RequiredQuantity > 0) == 0
                        || x.DailyLines.Any(daily => daily.RequiredQuantity < 0)
                        || decimal.Round(x.DailyLines.Sum(daily => daily.RequiredQuantity), 6, MidpointRounding.AwayFromZero) != decimal.Round(x.RequiredQuantity, 6, MidpointRounding.AwayFromZero)
                        || x.Contributors.Count == 0
                        || x.Contributors.Any(contributor => contributor.DailyLineId is null || contributor.SourceQuantity <= 0)))
                    throw new InvalidOperationException("Lô chưa có đủ dòng nguyên liệu theo ngày hợp lệ để sẵn sàng đối chiếu.");
                batch.Status = "READY"; batch.Version++; batch.ReadyBy = actor; batch.ReadyAt = DateTime.UtcNow;
                await context.SaveChangesAsync(operationToken);
                return Map(batch, [], []);
            },
            verifySucceeded: verifyToken => context.Reconciliationbatches.AsNoTracking().AnyAsync(x => x.BatchId == bytes && x.Status == "READY" && x.Version == request.ExpectedVersion + 1, verifyToken),
            isolationLevel: IsolationLevel.Serializable,
            cancellationToken: token);
    }

    public async Task<ReconciliationWarehouseTransferDto> TransferToWarehouseAsync(string id, TransferReconciliationBatchRequest request, string actorId, CancellationToken token = default)
    {
        if (!string.Equals(requestContext.Mode, SystemOperationEligibility.MaterialReconciliation, StringComparison.Ordinal))
            throw new InvalidOperationException("Chỉ chế độ đối chiếu nguyên liệu mới được chuyển danh sách sang Kho.");
        var batchId = RequiredId(id);
        _ = RequiredId(actorId);
        var protection = RequiredProtection();
        var batch = await transactions.ExecuteProtectedAsync(
            protection.OperationKey,
            protection.ExpectedVersion,
            async operationToken =>
            {
                var source = await context.Reconciliationbatches
                    .Include(item => item.Lines).ThenInclude(line => line.Ingredient)
                    .Include(item => item.Lines).ThenInclude(line => line.CanonicalUnit)
                    .SingleOrDefaultAsync(item => item.BatchId == batchId, operationToken)
                    ?? throw new KeyNotFoundException();
                if (source.Status == "TRANSFERRED") return source;
                if (source.Status != "READY" || source.Version != request.ExpectedVersion)
                    throw new DbUpdateConcurrencyException("Lô đối chiếu đã thay đổi hoặc chưa sẵn sàng chuyển sang Kho.");
                source.Status = "TRANSFERRED";
                source.Version++;
                await context.SaveChangesAsync(operationToken);
                return source;
            },
            verifySucceeded: verifyToken => context.Reconciliationbatches.AsNoTracking().AnyAsync(item => item.BatchId == batchId && item.Status == "TRANSFERRED", verifyToken),
            isolationLevel: IsolationLevel.Serializable,
            cancellationToken: token);
        return MapTransfer(batch);
    }

    internal Task<IReadOnlyDictionary<string, decimal>> LoadLinkedIssuedQuantitiesForCompletionAsync(IReadOnlyCollection<byte[]> lineIds, CancellationToken token) =>
        LoadLinkedIssuedQuantitiesAsync(lineIds, token);

    private Task<IReadOnlyDictionary<string, decimal>> LoadLinkedIssuedQuantitiesAsync(IReadOnlyCollection<byte[]> lineIds, CancellationToken token) =>
        ReconciliationLinkedIssueQuery.LoadAsync(context, lineIds, token);

    internal static IReadOnlyDictionary<string, decimal> ProjectNetIssuedQuantities(
        IEnumerable<(byte[] IssueLineId, byte[] ReconciliationBatchLineId, decimal IssuedQty)> issueRows,
        IEnumerable<(byte[] SourceIssueLineId, decimal Quantity)> receivedReturns) =>
        ReconciliationLinkedIssueQuery.ProjectNetIssuedQuantities(issueRows, receivedReturns);

    private static ReconciliationWarehouseTransferDto MapTransfer(ReconciliationBatch batch) =>
        new(GuidHelper.ToGuidString(batch.BatchId), batch.Status, batch.Version,
            batch.Lines.Where(line => line.RequiredQuantity > 0).OrderBy(line => Convert.ToHexString(line.BatchLineId)).Select(line =>
                new ReconciliationWarehouseTransferLineDto(
                    GuidHelper.ToGuidString(line.BatchLineId), GuidHelper.ToGuidString(line.IngredientId),
                    line.Ingredient?.IngredientCode, line.Ingredient?.IngredientName,
                    GuidHelper.ToGuidString(line.CanonicalUnitId), line.CanonicalUnit?.UnitName,
                    line.RequiredQuantity, line.Version)).ToList());

    private static bool IsExactCommittedAuthority(QuantityImportBatch? import, byte[] menuVersionId) =>
        import is not null
        && import.Status == "CONFIRMED"
        && import.MenuVersionId is not null
        && import.MenuVersionId.AsSpan().SequenceEqual(menuVersionId)
        && !string.IsNullOrWhiteSpace(import.ContentFingerprint)
        && import.FingerprintFormatVersion == ReconciliationQuantityImportService.CurrentFingerprintFormatVersion
        && !string.IsNullOrWhiteSpace(import.SourceLabel)
        && import.Mealquantityplans.Count > 0
        && import.Mealquantityplans.All(plan =>
            plan.Status == "COMPLETED"
            && plan.Mealquantityplanlines.Count > 0
            && plan.Mealquantityplanlines.All(line =>
                line.MenuSchedule.MenuVersionId is not null
                && line.MenuSchedule.MenuVersionId.AsSpan().SequenceEqual(menuVersionId)
                && line.MenuSchedule.MenuVersion is not null
                && MenuVersionStatusPolicy.PublishedCompatibleStatuses.Contains(line.MenuSchedule.MenuVersion.Status)));

    private Task<ReconciliationBatch?> LoadByImportAsync(byte[] importBatchId, CancellationToken token) =>
        context.Reconciliationbatches.AsNoTracking()
            .Include(batch => batch.Lines)
            .SingleOrDefaultAsync(batch => batch.QuantityImportBatchId == importBatchId, token);

    internal static bool IsQuantityImportBatchDuplicate(DbUpdateException error)
    {
        var message = error.InnerException?.Message ?? error.Message;
        return (error.InnerException is MySqlException { ErrorCode: MySqlErrorCode.DuplicateKeyEntry }
                && message.Contains("ux_reconciliationbatches_quantityImportBatchId", StringComparison.OrdinalIgnoreCase))
            || message.Contains("reconciliationbatches.QuantityImportBatchId", StringComparison.OrdinalIgnoreCase)
            || message.Contains("reconciliationbatches_quantityImportBatchId", StringComparison.OrdinalIgnoreCase);
    }

    private (string OperationKey, long ExpectedVersion) RequiredProtection() =>
        (requestContext.OperationKey, requestContext.ExpectedModeVersion) switch
        {
            ({ Length: > 0 } key, long version) => (key, version),
            _ => throw new InvalidOperationException("Thiếu ngữ cảnh bảo vệ chế độ vận hành.")
        };

    internal static decimal ConvertToCanonical(decimal quantity, Unit source, Unit target)
    {
        if (source.UnitId.AsSpan().SequenceEqual(target.UnitId)) return quantity;
        if (string.IsNullOrWhiteSpace(source.BaseUnitCode) || string.IsNullOrWhiteSpace(target.BaseUnitCode)
            || !string.Equals(source.BaseUnitCode, target.BaseUnitCode, StringComparison.OrdinalIgnoreCase)
            || source.ConvertRateToBase <= 0 || target.ConvertRateToBase <= 0)
            throw new BusinessRuleException("Đơn vị nguyên liệu chưa có quy đổi chuẩn hợp lệ.");
        return quantity * source.ConvertRateToBase / target.ConvertRateToBase;
    }

    internal static (decimal Value, string Kind, string Version) ResolveTolerance(
        IReadOnlyList<ReconciliationTolerance> tolerances,
        byte[] ingredientId,
        byte[] canonicalUnitId)
    {
        var systemDefault = ReconciliationToleranceAuthority.ReadSystemDefault(tolerances)
            ?? throw new ReconciliationToleranceAuthorityException("Chưa cấu hình dung sai mặc định hệ thống.");
        var selected = tolerances.FirstOrDefault(x => x.ScopeKind == "INGREDIENT" && x.ScopeId != null && x.ScopeId.AsSpan().SequenceEqual(ingredientId))
            ?? tolerances.FirstOrDefault(x => x.ScopeKind == "UNIT_GROUP" && x.ScopeId != null && x.ScopeId.AsSpan().SequenceEqual(canonicalUnitId))
            ?? systemDefault;
        return (selected.Value, selected.ScopeKind, selected.Version.ToString(System.Globalization.CultureInfo.InvariantCulture));
    }

    private static ReconciliationBatchDto Map(
        ReconciliationBatch batch,
        IReadOnlyList<ReconciliationActual> actuals,
        IReadOnlyList<ReconciliationDisposition> dispositions,
        IReadOnlyDictionary<string, decimal>? linkedIssued = null,
        IReadOnlyList<ReconciliationBatchLine>? explicitLines = null,
        IReadOnlyDictionary<string, IReadOnlyList<string>>? issueNotes = null,
        (string? CustomerId, string? CustomerName, string? CustomerCode)? customer = null,
        DateOnly? weekStartDate = null) =>
        new(GuidHelper.ToGuidString(batch.BatchId), GuidHelper.ToGuidString(batch.MenuVersionId), GuidHelper.ToGuidString(batch.QuantityImportBatchId), batch.Status, batch.Version, batch.CreatedAt, batch.ReadyAt, batch.CompletedAt,
            (explicitLines ?? batch.Lines.ToList()).Where(line => line.RequiredQuantity > 0).Select(line => ReconciliationComparisonService.Map(
                line,
                actuals.Where(x => x.BatchLineId.AsSpan().SequenceEqual(line.BatchLineId)).ToList(),
                dispositions.FirstOrDefault(x => x.BatchLineId.AsSpan().SequenceEqual(line.BatchLineId)),
                LinkedQuantity(linkedIssued, line.BatchLineId),
                issueNotes?.GetValueOrDefault(Convert.ToHexString(line.BatchLineId)))).ToList())
        {
            CustomerId = customer?.CustomerId,
            CustomerName = customer?.CustomerName,
            CustomerCode = customer?.CustomerCode,
            WeekStartDate = weekStartDate,
            WeekEndDate = weekStartDate?.AddDays(5)
        };

    internal static decimal? LinkedQuantity(IReadOnlyDictionary<string, decimal>? linkedIssued, byte[] batchLineId) =>
        linkedIssued is not null && linkedIssued.TryGetValue(Convert.ToHexString(batchLineId), out var quantity) ? quantity : null;

    internal static byte[] RequiredId(string id) => GuidHelper.ParseGuidString(id) ?? throw new ArgumentException("ID không hợp lệ.");

    private async Task<((string? CustomerId, string? CustomerName, string? CustomerCode)? Customer, DateOnly? WeekStartDate)> TryGetMenuVersionMetadataAsync(
        byte[] menuVersionId,
        CancellationToken token)
    {
        if (context.Model.FindEntityType(typeof(MenuVersion)) is null) return (null, null);
        if (context.Model.FindEntityType(typeof(Customer)) is null)
        {
            var mvOnly = await context.Menuversions.AsNoTracking()
                .Where(mv => mv.MenuVersionId == menuVersionId)
                .Select(mv => new { mv.CustomerId, mv.WeekStartDate })
                .SingleOrDefaultAsync(token);
            return mvOnly is null
                ? (null, null)
                : ((GuidHelper.ToGuidString(mvOnly.CustomerId), null, null), mvOnly.WeekStartDate);
        }

        var mv = await context.Menuversions.AsNoTracking()
            .Where(item => item.MenuVersionId == menuVersionId)
            .Select(item => new
            {
                item.CustomerId,
                item.WeekStartDate,
                CustomerName = item.Customer != null ? item.Customer.CustomerName : null,
                CustomerCode = item.Customer != null ? item.Customer.CustomerCode : null
            })
            .SingleOrDefaultAsync(token);
        if (mv is null) return (null, null);
        return ((GuidHelper.ToGuidString(mv.CustomerId), mv.CustomerName, mv.CustomerCode), mv.WeekStartDate);
    }

    private async Task<(string? CustomerId, string? CustomerName, string? CustomerCode)?> TryGetCustomerAsync(byte[] menuVersionId, CancellationToken token)
    {
        if (context.Model.FindEntityType(typeof(MenuVersion)) is null) return null;
        var menuVersion = await context.Menuversions.AsNoTracking().Where(mv => mv.MenuVersionId == menuVersionId).Select(mv => new { mv.CustomerId }).SingleOrDefaultAsync(token);
        if (menuVersion is null) return null;
        var customerId = GuidHelper.ToGuidString(menuVersion.CustomerId);
        if (context.Model.FindEntityType(typeof(Customer)) is null) return (customerId, null, null);
        var customer = await context.Customers.AsNoTracking().Where(c => c.CustomerId == menuVersion.CustomerId).Select(c => new { c.CustomerName, c.CustomerCode }).SingleOrDefaultAsync(token);
        return (customerId, customer?.CustomerName, customer?.CustomerCode);
    }

    private async Task<IReadOnlyDictionary<string, DateOnly>> LoadWeeksForBatchesAsync(IReadOnlyList<ReconciliationBatch> batches, CancellationToken token)
    {
        if (batches.Count == 0 || context.Model.FindEntityType(typeof(MenuVersion)) is null) return new Dictionary<string, DateOnly>(StringComparer.Ordinal);
        var menuVersionIds = batches.Select(batch => batch.MenuVersionId).Distinct().ToList();
        return await context.Menuversions.AsNoTracking().Where(version => menuVersionIds.Contains(version.MenuVersionId)).ToDictionaryAsync(version => Convert.ToHexString(version.MenuVersionId), version => version.WeekStartDate, StringComparer.Ordinal, token);
    }

    private async Task<IReadOnlyDictionary<string, (string? CustomerId, string? CustomerName, string? CustomerCode)>> LoadCustomersForBatchesAsync(IReadOnlyList<ReconciliationBatch> batches, CancellationToken token)
    {
        var result = new Dictionary<string, (string? CustomerId, string? CustomerName, string? CustomerCode)>(StringComparer.Ordinal);
        if (batches.Count == 0 || context.Model.FindEntityType(typeof(MenuVersion)) is null) return result;
        var menuVersionIds = batches.Select(x => x.MenuVersionId).Distinct().ToList();
        var menuVersions = await context.Menuversions.AsNoTracking().Where(mv => menuVersionIds.Contains(mv.MenuVersionId)).Select(mv => new { mv.MenuVersionId, mv.CustomerId }).ToListAsync(token);
        if (menuVersions.Count == 0) return result;
        Dictionary<string, (string CustomerName, string CustomerCode)>? customerLookup = null;
        if (context.Model.FindEntityType(typeof(Customer)) is not null)
        {
            var customerIds = menuVersions.Select(mv => mv.CustomerId).Distinct().ToList();
            var customers = await context.Customers.AsNoTracking().Where(c => customerIds.Contains(c.CustomerId)).Select(c => new { c.CustomerId, c.CustomerName, c.CustomerCode }).ToListAsync(token);
            customerLookup = customers.ToDictionary(c => Convert.ToHexString(c.CustomerId), c => (c.CustomerName, c.CustomerCode), StringComparer.Ordinal);
        }
        foreach (var mv in menuVersions)
        {
            string? name = null, code = null;
            if (customerLookup is not null && customerLookup.TryGetValue(Convert.ToHexString(mv.CustomerId), out var cInfo))
            {
                name = cInfo.CustomerName; code = cInfo.CustomerCode;
            }
            result[Convert.ToHexString(mv.MenuVersionId)] = (GuidHelper.ToGuidString(mv.CustomerId), name, code);
        }
        return result;
    }
}
