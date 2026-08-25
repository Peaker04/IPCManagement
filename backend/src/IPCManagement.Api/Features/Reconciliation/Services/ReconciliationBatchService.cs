using System.Data;
using IPCManagement.Api.Data;
using IPCManagement.Api.Data.Transactions;
using IPCManagement.Api.Features.Reconciliation.Contracts;
using IPCManagement.Api.Features.SystemOperation.Services;
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
                var menuVersionExists = await context.Menuversions.AnyAsync(x => x.MenuVersionId == menuVersionId, operationToken);
                var importBatchExists = await context.Quantityimportbatches.AnyAsync(x => x.ImportBatchId == importBatchId && x.Status != "FAILED" && x.Status != "PREVIEW", operationToken);
                if (!menuVersionExists || !importBatchExists) throw new InvalidOperationException("Nguồn thực đơn hoặc đợt nhập chưa được cam kết hợp lệ.");

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
                    foreach (var menuItem in source.Menu.Menuitems)
                    {
                        var boms = menuItem.Dish.Dishboms
                            .Where(x => x.BomStatus == "PUBLISHED" && x.EffectiveFrom <= source.MenuSchedule.ServiceDate && (x.EffectiveTo == null || x.EffectiveTo >= source.MenuSchedule.ServiceDate))
                            .Where(x => x.CustomerId == null || x.CustomerId.AsSpan().SequenceEqual(source.CustomerId));
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

    private static decimal ConvertToCanonical(decimal quantity, Unit source, Unit target)
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
