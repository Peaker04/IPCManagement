using System.Data;
using IPCManagement.Api.Data;
using IPCManagement.Api.Data.Transactions;
using IPCManagement.Api.Features.Reconciliation.Contracts;
using IPCManagement.Api.Features.SystemOperation.Services;
using IPCManagement.Api.Helpers;
using IPCManagement.Api.Models.Entities;
using Microsoft.EntityFrameworkCore;
using MySqlConnector;

namespace IPCManagement.Api.Features.Reconciliation.Services;

public sealed class ReconciliationBatchService(
    IpcManagementContext context,
    IEfTransactionRunner transactions,
    SystemOperationRequestContext requestContext)
{
    public async Task<IReadOnlyList<ReconciliationBatchDto>> ListAsync(CancellationToken token = default)
    {
        var batches = await context.Reconciliationbatches.AsNoTracking()
            .Include(x => x.Lines).ThenInclude(x => x.Ingredient)
            .Include(x => x.Lines).ThenInclude(x => x.CanonicalUnit)
            .OrderByDescending(x => x.CreatedAt).ToListAsync(token);
        var lineIds = batches.SelectMany(x => x.Lines).Select(x => x.BatchLineId).ToList();
        var actuals = await context.Reconciliationactuals.AsNoTracking().Where(x => lineIds.Contains(x.BatchLineId)).ToListAsync(token);
        var dispositions = await context.Reconciliationdispositions.AsNoTracking().Where(x => lineIds.Contains(x.BatchLineId)).ToListAsync(token);
        var issued = await LoadLinkedIssuedQuantitiesAsync(lineIds, token);
        return batches.Select(batch => Map(batch, actuals, dispositions, issued)).ToList();
    }

    public async Task<IReadOnlyList<ReconciliationDraftSourceDto>> ListDraftSourcesAsync(CancellationToken token = default)
    {
        var imports = await context.Quantityimportbatches.AsNoTracking()
            .Where(import => import.Status == "CONFIRMED" && import.MenuVersionId != null)
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
        var batchLines = string.Equals(context.Database.ProviderName, "Microsoft.EntityFrameworkCore.InMemory", StringComparison.Ordinal)
            ? (await context.Reconciliationbatchlines.AsNoTracking().Include(line => line.Ingredient).Include(line => line.CanonicalUnit).ToListAsync(token))
                .Where(line => line.BatchId.SequenceEqual(bytes)).ToList()
            : await context.Reconciliationbatchlines.AsNoTracking().Include(line => line.Ingredient).Include(line => line.CanonicalUnit)
                .Where(line => line.BatchId == bytes).ToListAsync(token);
        var actuals = await context.Reconciliationactuals.AsNoTracking().Where(x => x.BatchLine.BatchId == bytes).ToListAsync(token);
        var dispositions = await context.Reconciliationdispositions.AsNoTracking().Where(x => x.BatchLine.BatchId == bytes).ToListAsync(token);
        var issued = await LoadLinkedIssuedQuantitiesAsync(batchLines.Select(line => line.BatchLineId).ToList(), token);
        return Map(batch, actuals, dispositions, issued, batchLines);
    }

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
            throw new InvalidOperationException("Nguồn thực đơn hoặc đợt nhập chưa được cam kết hợp lệ.");

        var sourceLines = await context.Mealquantityplanlines
            .Where(x => x.QuantityPlan.ImportBatchId == importBatchId && x.MenuSchedule.MenuVersionId == menuVersionId)
            .Include(x => x.MenuSchedule)
            .Include(x => x.Menu).ThenInclude(x => x.Menuitems).ThenInclude(x => x.Dish).ThenInclude(x => x.Dishboms).ThenInclude(x => x.Unit)
            .Include(x => x.Menu).ThenInclude(x => x.Menuitems).ThenInclude(x => x.Dish).ThenInclude(x => x.Dishboms).ThenInclude(x => x.Ingredient).ThenInclude(x => x.Unit)
            .AsSplitQuery()
            .ToListAsync(token);
        if (sourceLines.Count == 0) throw new InvalidOperationException("Đợt nhập không có dòng số suất thuộc phiên bản thực đơn đã chọn.");

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
        foreach (var source in sourceLines)
        {
            foreach (var menuItem in source.Menu.Menuitems
                         .OrderBy(item => item.DisplayOrder)
                         .DistinctBy(item => Convert.ToBase64String(item.DishId)))
            {
                var boms = BomSelectionResolver.Resolve(
                    menuItem.Dish.Dishboms,
                    source.CustomerId,
                    source.MenuSchedule.MenuPrice,
                    source.MenuSchedule.ServiceDate);
                if (boms.Count == 0)
                    throw new InvalidOperationException($"Món '{menuItem.Dish.DishName}' chưa có BOM đã phát hành hợp lệ.");

                foreach (var bom in boms)
                {
                    var converted = ConvertToCanonical(bom.GrossQtyPerServing * source.FinalServings, bom.Unit, bom.Ingredient.Unit);
                    var persistedQuantity = decimal.Round(converted, 6, MidpointRounding.AwayFromZero);
                    if (converted > 0 && persistedQuantity <= 0)
                        throw new InvalidOperationException($"Món '{menuItem.Dish.DishName}' có lượng nguyên liệu dương nhỏ hơn độ chính xác lưu trữ.");
                    if (persistedQuantity <= 0) continue;
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
                    line.RequiredQuantity += persistedQuantity;
                    line.Contributors.Add(new ReconciliationBatchContributor
                    {
                        ContributorId = GuidHelper.NewId(), BatchLineId = line.BatchLineId,
                        MenuScheduleId = source.MenuScheduleId, MealQuantityPlanLineId = source.QuantityPlanLineId,
                        DishBomId = bom.BomId, SourceQuantity = persistedQuantity
                    });
                }
            }
        }
        if (batch.Lines.Count == 0
            || batch.Lines.Any(line => line.RequiredQuantity <= 0
                || line.Contributors.Count == 0
                || line.Contributors.Any(contributor => contributor.SourceQuantity <= 0)))
            throw new InvalidOperationException("Không thể tạo đầy đủ dòng nguyên liệu dương từ nguồn đã chọn.");
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
                var batch = await context.Reconciliationbatches.Include(x => x.Lines).ThenInclude(x => x.Contributors).SingleOrDefaultAsync(x => x.BatchId == bytes, operationToken) ?? throw new KeyNotFoundException();
                context.Entry(batch).Property(x => x.Version).OriginalValue = request.ExpectedVersion;
                if (batch.Status != "DRAFT" || batch.Version != request.ExpectedVersion) throw new DbUpdateConcurrencyException("Lô đối chiếu đã thay đổi.");
                if (batch.Lines.Count == 0 || batch.Lines.Any(x => x.RequiredQuantity <= 0 || x.FrozenTolerance < 0 || x.Contributors.Count == 0 || x.Contributors.Any(contributor => contributor.SourceQuantity <= 0))) throw new InvalidOperationException("Lô chưa có đủ dòng nguyên liệu hợp lệ để sẵn sàng đối chiếu.");
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
        var batch = await transactions.ExecuteAsync(
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

    private async Task<IReadOnlyDictionary<string, decimal>> LoadLinkedIssuedQuantitiesAsync(IReadOnlyCollection<byte[]> lineIds, CancellationToken token)
    {
        if (lineIds.Count == 0) return new Dictionary<string, decimal>();
        var rows = string.Equals(context.Database.ProviderName, "Microsoft.EntityFrameworkCore.InMemory", StringComparison.Ordinal)
            ? (await context.Inventoryissuelines.AsNoTracking().Where(line => line.ReconciliationBatchLineId != null)
                .Select(line => new { line.ReconciliationBatchLineId, line.IssuedQty }).ToListAsync(token))
                .Where(row => lineIds.Any(id => id.SequenceEqual(row.ReconciliationBatchLineId!))).ToList()
            : await context.Inventoryissuelines.AsNoTracking()
                .Where(line => line.ReconciliationBatchLineId != null && lineIds.Contains(line.ReconciliationBatchLineId))
                .Select(line => new { line.ReconciliationBatchLineId, line.IssuedQty }).ToListAsync(token);
        return rows.GroupBy(row => Convert.ToHexString(row.ReconciliationBatchLineId!))
            .ToDictionary(group => group.Key, group => group.Sum(row => row.IssuedQty), StringComparer.Ordinal);
    }

    private static ReconciliationWarehouseTransferDto MapTransfer(ReconciliationBatch batch) =>
        new(GuidHelper.ToGuidString(batch.BatchId), batch.Status, batch.Version,
            batch.Lines.OrderBy(line => Convert.ToHexString(line.BatchLineId)).Select(line =>
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
        && import.FingerprintFormatVersion == 1
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
            throw new InvalidOperationException("Đơn vị nguyên liệu chưa có quy đổi chuẩn hợp lệ.");
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
        IReadOnlyList<ReconciliationBatchLine>? explicitLines = null) =>
        new(GuidHelper.ToGuidString(batch.BatchId), GuidHelper.ToGuidString(batch.MenuVersionId), GuidHelper.ToGuidString(batch.QuantityImportBatchId), batch.Status, batch.Version, batch.CreatedAt, batch.ReadyAt, batch.CompletedAt,
            (explicitLines ?? batch.Lines.ToList()).Select(line => ReconciliationComparisonService.Map(
                line,
                actuals.Where(x => x.BatchLineId.AsSpan().SequenceEqual(line.BatchLineId)).ToList(),
                dispositions.FirstOrDefault(x => x.BatchLineId.AsSpan().SequenceEqual(line.BatchLineId)),
                linkedIssued?.GetValueOrDefault(Convert.ToHexString(line.BatchLineId)))).ToList());

    internal static byte[] RequiredId(string id) => GuidHelper.ParseGuidString(id) ?? throw new ArgumentException("ID không hợp lệ.");
}
