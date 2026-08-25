using System.Data;
using IPCManagement.Api.Data;
using IPCManagement.Api.Data.Transactions;
using IPCManagement.Api.Features.Reconciliation.Contracts;
using IPCManagement.Api.Helpers;
using IPCManagement.Api.Models.Entities;
using Microsoft.EntityFrameworkCore;

namespace IPCManagement.Api.Features.Reconciliation.Services;

public sealed class ReconciliationBatchService(
    IpcManagementContext context,
    IEfTransactionRunner transactions,
    SystemOperationRequestContext requestContext)
{
    public async Task<IReadOnlyList<ReconciliationBatchDto>> ListAsync(CancellationToken token = default)
    {
        var batches = await context.Reconciliationbatches.AsNoTracking().Include(x => x.Lines).OrderByDescending(x => x.CreatedAt).ToListAsync(token);
        var lineIds = batches.SelectMany(x => x.Lines).Select(x => x.BatchLineId).ToList();
        var actuals = await context.Reconciliationactuals.AsNoTracking().Where(x => lineIds.Contains(x.BatchLineId)).ToListAsync(token);
        var dispositions = await context.Reconciliationdispositions.AsNoTracking().Where(x => lineIds.Contains(x.BatchLineId)).ToListAsync(token);
        return batches.Select(batch => Map(batch, actuals, dispositions)).ToList();
    }

    public async Task<IReadOnlyList<ReconciliationDraftSourceDto>> ListDraftSourcesAsync(CancellationToken token = default)
    {
        var sources = await context.Mealquantityplanlines.AsNoTracking()
            .Where(line => line.QuantityPlan.ImportBatchId != null && line.QuantityPlan.ImportBatch != null)
            .Where(line => line.QuantityPlan.ImportBatch!.Status != "FAILED" && line.QuantityPlan.ImportBatch.Status != "PREVIEW")
            .Where(line => line.MenuSchedule.MenuVersionId != null && MenuVersionStatusPolicy.PublishedCompatibleStatuses.Contains(line.MenuSchedule.MenuVersion!.Status))
            .Select(line => new
            {
                MenuVersionId = line.MenuSchedule.MenuVersionId!,
                line.MenuSchedule.MenuVersion!.WeekStartDate,
                line.MenuSchedule.MenuVersion.VersionNo,
                ImportBatchId = line.QuantityPlan.ImportBatchId!,
                line.QuantityPlan.ImportBatch!.BatchCode,
                line.QuantityPlan.ImportBatch.ImportedAt
            })
            .Distinct()
            .OrderByDescending(source => source.WeekStartDate)
            .ThenByDescending(source => source.ImportedAt)
            .ToListAsync(token);

        return sources.Select(source => new ReconciliationDraftSourceDto(
            GuidHelper.ToGuidString(source.MenuVersionId),
            $"Tuần {source.WeekStartDate:dd/MM/yyyy} · phiên bản {source.VersionNo}",
            GuidHelper.ToGuidString(source.ImportBatchId),
            $"{source.BatchCode} · {source.ImportedAt:dd/MM/yyyy HH:mm}"))
            .ToList();
    }

    public async Task<ReconciliationBatchDto?> GetAsync(string id, CancellationToken token = default)
    {
        var bytes = RequiredId(id);
        var batch = await context.Reconciliationbatches.AsNoTracking().Include(x => x.Lines).SingleOrDefaultAsync(x => x.BatchId == bytes, token);
        if (batch is null) return null;
        var actuals = await context.Reconciliationactuals.AsNoTracking().Where(x => x.BatchLine.BatchId == bytes).ToListAsync(token);
        var dispositions = await context.Reconciliationdispositions.AsNoTracking().Where(x => x.BatchLine.BatchId == bytes).ToListAsync(token);
        return Map(batch, actuals, dispositions);
    }

    public async Task<ReconciliationBatchDto> CreateDraftAsync(CreateReconciliationDraftRequest request, string actorId, CancellationToken token = default)
    {
        var batchId = GuidHelper.NewId();
        var menuVersionId = RequiredId(request.MenuVersionId);
        var importBatchId = RequiredId(request.QuantityImportBatchId);
        var actor = RequiredId(actorId);
        var protection = RequiredProtection();

        return await transactions.ExecuteProtectedAsync(
            protection.OperationKey,
            protection.ExpectedVersion,
            async operationToken =>
            {
                var validCommittedPair = await context.Mealquantityplanlines.AsNoTracking()
                    .AnyAsync(x => x.QuantityPlan.ImportBatchId == importBatchId
                        && x.QuantityPlan.ImportBatch != null
                        && x.QuantityPlan.ImportBatch.Status != "FAILED"
                        && x.QuantityPlan.ImportBatch.Status != "PREVIEW"
                        && x.MenuSchedule.MenuVersionId == menuVersionId
                        && x.MenuSchedule.MenuVersion != null
                        && MenuVersionStatusPolicy.PublishedCompatibleStatuses.Contains(x.MenuSchedule.MenuVersion.Status), operationToken);
                if (!validCommittedPair) throw new InvalidOperationException("Nguồn thực đơn hoặc đợt nhập chưa được cam kết hợp lệ.");

                var sourceLines = await context.Mealquantityplanlines
                    .Where(x => x.QuantityPlan.ImportBatchId == importBatchId && x.MenuSchedule.MenuVersionId == menuVersionId)
                    .Include(x => x.MenuSchedule)
                    .Include(x => x.Menu).ThenInclude(x => x.Menuitems).ThenInclude(x => x.Dish).ThenInclude(x => x.Dishboms).ThenInclude(x => x.Unit)
                    .Include(x => x.Menu).ThenInclude(x => x.Menuitems).ThenInclude(x => x.Dish).ThenInclude(x => x.Dishboms).ThenInclude(x => x.Ingredient).ThenInclude(x => x.Unit)
                    .AsSplitQuery()
                    .ToListAsync(operationToken);
                if (sourceLines.Count == 0) throw new InvalidOperationException("Đợt nhập không có dòng số suất thuộc phiên bản thực đơn đã chọn.");

                var tolerances = await context.Reconciliationtolerances.AsNoTracking().ToListAsync(operationToken);
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
                        foreach (var bom in boms)
                        {
                            var converted = ConvertToCanonical(bom.GrossQtyPerServing * source.FinalServings, bom.Unit, bom.Ingredient.Unit);
                            if (converted <= 0) continue;
                            var key = Convert.ToBase64String(bom.IngredientId) + ":" + Convert.ToBase64String(bom.Ingredient.UnitId);
                            if (!materialized.TryGetValue(key, out var line))
                            {
                                var tolerance = ResolveTolerance(tolerances, bom.IngredientId);
                                line = new ReconciliationBatchLine
                                {
                                    BatchLineId = GuidHelper.NewId(), BatchId = batchId, IngredientId = bom.IngredientId,
                                    CanonicalUnitId = bom.Ingredient.UnitId, RequiredQuantity = 0, FrozenTolerance = tolerance.Value,
                                    ToleranceSourceKind = tolerance.Kind, ToleranceSourceVersion = tolerance.Version, Version = 1
                                };
                                materialized.Add(key, line);
                                batch.Lines.Add(line);
                            }
                            line.RequiredQuantity += decimal.Round(converted, 6, MidpointRounding.AwayFromZero);
                            line.Contributors.Add(new ReconciliationBatchContributor
                            {
                                ContributorId = GuidHelper.NewId(), BatchLineId = line.BatchLineId,
                                MenuScheduleId = source.MenuScheduleId, MealQuantityPlanLineId = source.QuantityPlanLineId,
                                DishBomId = bom.BomId, SourceQuantity = decimal.Round(converted, 6, MidpointRounding.AwayFromZero)
                            });
                        }
                    }
                }
                if (batch.Lines.Count == 0) throw new InvalidOperationException("Không thể tạo dòng nguyên liệu hợp lệ từ nguồn đã chọn.");
                context.Reconciliationbatches.Add(batch);
                await context.SaveChangesAsync(operationToken);
                return Map(batch, [], []);
            },
            verifySucceeded: verifyToken => context.Reconciliationbatches.AsNoTracking().AnyAsync(x => x.BatchId == batchId && x.Lines.Any(), verifyToken),
            isolationLevel: IsolationLevel.Serializable,
            cancellationToken: token);
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
                if (batch.Lines.Count == 0 || batch.Lines.Any(x => x.RequiredQuantity <= 0 || x.FrozenTolerance < 0 || x.Contributors.Count == 0)) throw new InvalidOperationException("Lô chưa có đủ dòng nguyên liệu hợp lệ để sẵn sàng đối chiếu.");
                batch.Status = "READY"; batch.Version++; batch.ReadyBy = actor; batch.ReadyAt = DateTime.UtcNow;
                await context.SaveChangesAsync(operationToken);
                return Map(batch, [], []);
            },
            verifySucceeded: verifyToken => context.Reconciliationbatches.AsNoTracking().AnyAsync(x => x.BatchId == bytes && x.Status == "READY" && x.Version == request.ExpectedVersion + 1, verifyToken),
            isolationLevel: IsolationLevel.Serializable,
            cancellationToken: token);
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

    private static (decimal Value, string Kind, string Version) ResolveTolerance(IReadOnlyList<ReconciliationTolerance> tolerances, byte[] ingredientId)
    {
        var selected = tolerances.FirstOrDefault(x => x.ScopeKind == "INGREDIENT" && x.ScopeId != null && x.ScopeId.AsSpan().SequenceEqual(ingredientId))
            ?? tolerances.FirstOrDefault(x => x.ScopeKind == "SYSTEM_DEFAULT" && x.ScopeId == null)
            ?? throw new InvalidOperationException("Chưa cấu hình dung sai đối chiếu.");
        return (selected.Value, selected.ScopeKind, selected.Version.ToString(System.Globalization.CultureInfo.InvariantCulture));
    }

    private static ReconciliationBatchDto Map(ReconciliationBatch batch, IReadOnlyList<ReconciliationActual> actuals, IReadOnlyList<ReconciliationDisposition> dispositions) =>
        new(GuidHelper.ToGuidString(batch.BatchId), GuidHelper.ToGuidString(batch.MenuVersionId), GuidHelper.ToGuidString(batch.QuantityImportBatchId), batch.Status, batch.Version, batch.CreatedAt, batch.ReadyAt, batch.CompletedAt,
            batch.Lines.Select(line => ReconciliationComparisonService.Map(line, actuals.Where(x => x.BatchLineId.AsSpan().SequenceEqual(line.BatchLineId)).ToList(), dispositions.FirstOrDefault(x => x.BatchLineId.AsSpan().SequenceEqual(line.BatchLineId)))).ToList());

    internal static byte[] RequiredId(string id) => GuidHelper.ParseGuidString(id) ?? throw new ArgumentException("ID không hợp lệ.");
}
