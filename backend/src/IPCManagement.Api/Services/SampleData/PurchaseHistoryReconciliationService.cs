using System.Globalization;
using System.Security.Cryptography;
using System.Text;
using IPCManagement.Api.Data;
using IPCManagement.Api.Models.DTOs.SampleData;
using Microsoft.EntityFrameworkCore;

namespace IPCManagement.Api.Services.SampleData;

public sealed class PurchaseHistoryReconciliationService : IPurchaseHistoryReconciliationService
{
    private const string SourceFileName = "IPC. Theo dõi đặt hàng ngày 20.7.2026.xlsx";
    private const string AuditedSourceSha256 = "4A91F9EA847068ABEB147EFF7ED7401B029D698F73E495641099DD9FA552BC88";
    private const int AuditedCurrentUniqueBusinessKeyCount = 17_739;
    private const int AuditedDeltaCount = 3_207;
    private static readonly DateOnly AuditedAsOfDate = new(2026, 7, 20);

    private readonly IpcManagementContext _context;
    private readonly Func<PurchaseHistoryPreviewSource> _sourceFactory;

    public PurchaseHistoryReconciliationService(
        IpcManagementContext context,
        IWebHostEnvironment environment)
        : this(context, () => ReadServerOwnedSource(environment))
    {
    }

    internal PurchaseHistoryReconciliationService(
        IpcManagementContext context,
        Func<PurchaseHistoryPreviewSource> sourceFactory)
    {
        _context = context;
        _sourceFactory = sourceFactory;
    }

    public async Task<PurchaseHistoryPreviewDto> PreviewAsync(CancellationToken cancellationToken = default)
    {
        var source = _sourceFactory();
        var suppliers = await _context.Suppliers
            .AsNoTracking()
            .Select(item => new SupplierSnapshot(
                Convert.ToHexString(item.SupplierId),
                item.SupplierCode,
                item.SupplierName,
                item.IsActive))
            .ToListAsync(cancellationToken);
        var ingredients = await _context.Ingredients
            .AsNoTracking()
            .Select(item => new IngredientSnapshot(
                Convert.ToHexString(item.IngredientId),
                item.IngredientCode,
                item.IngredientName,
                Convert.ToHexString(item.UnitId),
                item.ReferencePrice,
                item.IsActive))
            .ToListAsync(cancellationToken);
        var units = await _context.Units
            .AsNoTracking()
            .Select(item => new UnitSnapshot(
                Convert.ToHexString(item.UnitId),
                item.UnitCode,
                item.UnitName,
                item.BaseUnitCode,
                item.ConvertRateToBase))
            .ToListAsync(cancellationToken);
        var receipts = await _context.Inventoryreceipts
            .AsNoTracking()
            .Select(item => new ReceiptSnapshot(
                Convert.ToHexString(item.ReceiptId),
                item.ReceiptCode,
                item.ReceiptDate,
                Convert.ToHexString(item.SupplierId),
                item.PurchaseRequestId == null ? null : Convert.ToHexString(item.PurchaseRequestId)))
            .ToListAsync(cancellationToken);
        var lines = await _context.Inventoryreceiptlines
            .AsNoTracking()
            .Select(item => new ReceiptLineSnapshot(
                Convert.ToHexString(item.ReceiptLineId),
                Convert.ToHexString(item.ReceiptId),
                item.PurchaseRequestLineId == null ? null : Convert.ToHexString(item.PurchaseRequestLineId),
                Convert.ToHexString(item.IngredientId),
                Convert.ToHexString(item.UnitId),
                item.Quantity,
                item.UnitPrice,
                item.Amount,
                item.LotNumber))
            .ToListAsync(cancellationToken);
        var movements = await _context.Stockmovements
            .AsNoTracking()
            .Select(item => new MovementSnapshot(
                Convert.ToHexString(item.MovementId),
                item.RefTable,
                item.RefId == null ? null : Convert.ToHexString(item.RefId),
                Convert.ToHexString(item.IngredientId),
                Convert.ToHexString(item.UnitId),
                item.QuantityIn,
                item.QuantityOut))
            .ToListAsync(cancellationToken);
        var stocks = await _context.Currentstocks
            .AsNoTracking()
            .Select(item => new StockSnapshot(
                Convert.ToHexString(item.WarehouseId),
                Convert.ToHexString(item.IngredientId),
                Convert.ToHexString(item.UnitId),
                item.CurrentQty))
            .ToListAsync(cancellationToken);

        var databaseFingerprint = Hash(BuildDatabaseEvidence(
            suppliers,
            ingredients,
            units,
            receipts,
            lines,
            movements,
            stocks));
        var actions = new List<PurchaseHistoryActionDto>();
        var blockers = BuildNormalizationBlockers(source.ParseResult.Candidates);
        var processedLineIds = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        var receiptById = receipts.ToDictionary(item => item.Id, StringComparer.OrdinalIgnoreCase);
        var supplierById = suppliers.ToDictionary(item => item.Id, StringComparer.OrdinalIgnoreCase);
        var ingredientById = ingredients.ToDictionary(item => item.Id, StringComparer.OrdinalIgnoreCase);
        var unitById = units.ToDictionary(item => item.Id, StringComparer.OrdinalIgnoreCase);
        var lineViews = lines
            .Where(line => receiptById.ContainsKey(line.ReceiptId) &&
                           ingredientById.ContainsKey(line.IngredientId) &&
                           unitById.ContainsKey(line.UnitId))
            .Select(line => new ExistingLineView(
                line,
                receiptById[line.ReceiptId],
                supplierById.GetValueOrDefault(receiptById[line.ReceiptId].SupplierId),
                ingredientById[line.IngredientId],
                unitById[line.UnitId]))
            .Where(view => view.Supplier is not null)
            .ToList();
        var linesByBusinessKey = lineViews
            .GroupBy(BuildBusinessKey, StringComparer.OrdinalIgnoreCase)
            .ToDictionary(group => group.Key, group => group.ToList(), StringComparer.OrdinalIgnoreCase);

        var candidates = PurchaseHistorySourceParser
            .Supersede([], source.ParseResult.Candidates)
            .Where(candidate => candidate.IsImportable && candidate.Normalization?.Blockers.Count == 0)
            .OrderBy(candidate => candidate.BusinessKey, StringComparer.OrdinalIgnoreCase)
            .ThenBy(candidate => candidate.SourceKey, StringComparer.Ordinal)
            .ToList();

        foreach (var candidate in candidates)
        {
            cancellationToken.ThrowIfCancellationRequested();
            var normalization = candidate.Normalization!;
            var catalogBlocker = ValidateCatalog(candidate, normalization, suppliers, ingredients, units);
            if (catalogBlocker is not null)
            {
                blockers.Add(catalogBlocker);
                continue;
            }

            var existing = linesByBusinessKey.GetValueOrDefault(candidate.BusinessKey!) ?? [];
            foreach (var line in existing)
            {
                processedLineIds.Add(line.Line.Id);
            }

            var exact = existing.FirstOrDefault(line => Matches(line, candidate));
            if (exact is not null)
            {
                actions.Add(CreateAction(
                    "keep",
                    candidate.SourceKey,
                    candidate.BusinessKey,
                    exact,
                    CandidateEvidence(candidate),
                    "SOURCE_AND_DATABASE_MATCH"));
                foreach (var duplicate in existing.Where(line => line.Line.Id != exact.Line.Id))
                {
                    actions.Add(CreateExistingOnlyAction(
                        duplicate,
                        IsDependencyFreeSample(duplicate, movements, stocks) ? "delete" : "keep",
                        IsDependencyFreeSample(duplicate, movements, stocks)
                            ? "DEPENDENCY_FREE_SAMPLE_DUPLICATE"
                            : "REFERENCED_DUPLICATE_PRESERVED"));
                }
                continue;
            }

            var immutable = existing.FirstOrDefault(line => !IsDependencyFreeSample(line, movements, stocks));
            foreach (var disposable in existing.Where(line => IsDependencyFreeSample(line, movements, stocks)))
            {
                actions.Add(CreateExistingOnlyAction(
                    disposable,
                    "delete",
                    "DEPENDENCY_FREE_SAMPLE_REPLACED"));
            }

            actions.Add(CreateAction(
                "version",
                candidate.SourceKey,
                candidate.BusinessKey,
                immutable,
                CandidateEvidence(candidate),
                immutable is null ? "SOURCE_ROW_REQUIRES_VERSION" : "IMMUTABLE_HISTORY_VERSION_REQUIRED"));
            foreach (var additionalImmutable in existing.Where(line =>
                         immutable is not null &&
                         line.Line.Id != immutable.Line.Id &&
                         !IsDependencyFreeSample(line, movements, stocks)))
            {
                actions.Add(CreateExistingOnlyAction(
                    additionalImmutable,
                    "keep",
                    "IMMUTABLE_DEPENDENCY_PRESERVED"));
            }
        }

        foreach (var existing in lineViews
                     .Where(item => !processedLineIds.Contains(item.Line.Id))
                     .OrderBy(item => item.Line.Id, StringComparer.Ordinal))
        {
            var canDelete = IsDependencyFreeSample(existing, movements, stocks);
            actions.Add(CreateExistingOnlyAction(
                existing,
                canDelete ? "delete" : "keep",
                canDelete ? "DEPENDENCY_FREE_SAMPLE_ORPHAN" : "IMMUTABLE_DEPENDENCY_PRESERVED"));
        }

        actions = actions
            .OrderBy(action => action.BusinessKey, StringComparer.OrdinalIgnoreCase)
            .ThenBy(action => action.ActionType, StringComparer.Ordinal)
            .ThenBy(action => action.ActionId, StringComparer.Ordinal)
            .ToList();
        blockers = blockers
            .OrderBy(blocker => blocker.SourceSheet, StringComparer.Ordinal)
            .ThenBy(blocker => blocker.SourceRow)
            .ThenBy(blocker => blocker.Code, StringComparer.Ordinal)
            .ToList();
        var actionCounts = actions
            .GroupBy(action => action.ActionType, StringComparer.OrdinalIgnoreCase)
            .OrderBy(group => group.Key, StringComparer.Ordinal)
            .ToDictionary(group => group.Key, group => group.Count(), StringComparer.OrdinalIgnoreCase);
        var manifestHash = Hash(string.Join("\n", new[]
        {
            $"source={source.SourceName}",
            $"sourceHash={source.ParseResult.WorkbookSha256}",
            $"policy={PurchaseHistoryPolicyVersion.Current}",
            $"asOf={source.ParseResult.AsOfDate:yyyy-MM-dd}",
            $"database={databaseFingerprint}",
            $"candidateCount={source.ParseResult.Candidates.Count}",
            $"uniqueBusinessKeys={source.ParseResult.ImportableBusinessKeys.Count}",
            $"auditedDelta={AuditedDeltaCount}",
            $"actions={string.Join(',', actions.Select(action => action.ActionHash))}",
            $"counts={string.Join(',', actionCounts.Select(item => $"{item.Key}:{item.Value}"))}",
            $"blockers={string.Join(',', blockers.Select(blocker => blocker.BlockerId))}"
        }));

        return new PurchaseHistoryPreviewDto
        {
            Manifest = new PurchaseHistoryManifestDto
            {
                ManifestId = manifestHash[..32],
                ManifestHash = manifestHash,
                SourceName = source.SourceName,
                SourceSha256 = source.ParseResult.WorkbookSha256,
                PolicyVersion = PurchaseHistoryPolicyVersion.Current,
                DatabaseFingerprint = databaseFingerprint,
                AsOfDate = source.ParseResult.AsOfDate,
                CandidateCount = source.ParseResult.Candidates.Count,
                CurrentUniqueBusinessKeyCount = source.ParseResult.ImportableBusinessKeys.Count,
                AuditedDeltaCount = AuditedDeltaCount,
                ActionCount = actions.Count,
                BlockerCount = blockers.Count,
                ActionCounts = actionCounts
            },
            Actions = actions,
            Blockers = blockers
        };
    }

    private static PurchaseHistoryPreviewSource ReadServerOwnedSource(IWebHostEnvironment environment)
    {
        var current = new DirectoryInfo(environment.ContentRootPath);
        while (current is not null)
        {
            var candidate = Path.Combine(current.FullName, ".docs", SourceFileName);
            if (File.Exists(candidate))
            {
                using var stream = File.OpenRead(candidate);
                var parsed = new PurchaseHistorySourceParser().Parse(stream, AuditedAsOfDate);
                if (!string.Equals(parsed.WorkbookSha256, AuditedSourceSha256, StringComparison.Ordinal) ||
                    parsed.ImportableBusinessKeys.Count != AuditedCurrentUniqueBusinessKeyCount)
                {
                    throw new InvalidOperationException("Nguồn lịch sử mua hàng phía server không khớp baseline đã kiểm toán.");
                }

                return new PurchaseHistoryPreviewSource(SourceFileName, parsed);
            }

            current = current.Parent;
        }

        throw new FileNotFoundException($"Không tìm thấy nguồn lịch sử mua hàng phía server: {SourceFileName}");
    }

    private static List<PurchaseHistoryBlockerDto> BuildNormalizationBlockers(
        IReadOnlyList<PurchaseHistorySourceCandidate> candidates)
        => candidates
            .SelectMany(candidate => candidate.Normalization?.Blockers ?? [])
            .Select(blocker => CreateBlocker(
                blocker.Code,
                blocker.Field,
                blocker.RawValue,
                blocker.Trace))
            .ToList();

    private static PurchaseHistoryBlockerDto? ValidateCatalog(
        PurchaseHistorySourceCandidate candidate,
        PurchaseHistoryNormalizationResult normalization,
        IReadOnlyList<SupplierSnapshot> suppliers,
        IReadOnlyList<IngredientSnapshot> ingredients,
        IReadOnlyList<UnitSnapshot> units)
    {
        if (suppliers.Count(item => string.Equals(item.Name, normalization.SupplierName, StringComparison.OrdinalIgnoreCase)) != 1)
        {
            return CreateBlocker("SUPPLIER_CATALOG_AMBIGUOUS", "Nhà cung cấp", normalization.SupplierName ?? string.Empty, candidate.Trace);
        }

        if (ingredients.Count(item => string.Equals(item.Name, normalization.IngredientName, StringComparison.OrdinalIgnoreCase)) != 1)
        {
            return CreateBlocker("INGREDIENT_CATALOG_AMBIGUOUS", "Tên hàng", normalization.IngredientName ?? string.Empty, candidate.Trace);
        }

        if (units.Count(item => string.Equals(item.Code, normalization.UnitCode, StringComparison.OrdinalIgnoreCase)) != 1)
        {
            return CreateBlocker("UNIT_CATALOG_AMBIGUOUS", "Đơn vị tính", normalization.UnitCode ?? string.Empty, candidate.Trace);
        }

        return null;
    }

    private static PurchaseHistoryBlockerDto CreateBlocker(
        string code,
        string field,
        string rawValue,
        PurchaseHistorySourceTrace trace)
    {
        var id = Hash($"{code}|{field}|{rawValue}|{trace.SourceSheet}|{trace.SourceRow}|{CanonicalRawCells(trace.RawCells)}");
        return new PurchaseHistoryBlockerDto
        {
            BlockerId = id,
            Code = code,
            Field = field,
            RawValue = rawValue,
            SourceSheet = trace.SourceSheet,
            SourceRow = trace.SourceRow,
            RawCells = new Dictionary<string, string>(trace.RawCells, StringComparer.OrdinalIgnoreCase)
        };
    }

    private static bool Matches(ExistingLineView existing, PurchaseHistorySourceCandidate candidate)
        => string.Equals(existing.Supplier!.Name, candidate.Normalization!.SupplierName, StringComparison.OrdinalIgnoreCase) &&
           string.Equals(existing.Unit.Code, candidate.Normalization.UnitCode, StringComparison.OrdinalIgnoreCase) &&
           existing.Line.Quantity == candidate.Quantity &&
           existing.Line.UnitPrice == candidate.UnitPrice;

    private static bool IsDependencyFreeSample(
        ExistingLineView existing,
        IReadOnlyList<MovementSnapshot> movements,
        IReadOnlyList<StockSnapshot> stocks)
    {
        var sampleGenerated = existing.Receipt.Code.StartsWith("RCP-SAMPLE-", StringComparison.OrdinalIgnoreCase) &&
                              (existing.Line.LotNumber?.StartsWith("SAMPLE-", StringComparison.OrdinalIgnoreCase) ?? false);
        var referencedByMovement = movements.Any(item =>
            string.Equals(item.RefTable, "InventoryReceiptLine", StringComparison.OrdinalIgnoreCase) &&
            string.Equals(item.RefId, existing.Line.Id, StringComparison.OrdinalIgnoreCase));
        var contributesToStock = stocks.Any(item =>
            string.Equals(item.IngredientId, existing.Line.IngredientId, StringComparison.OrdinalIgnoreCase) &&
            string.Equals(item.UnitId, existing.Line.UnitId, StringComparison.OrdinalIgnoreCase) &&
            item.Quantity != 0);
        return sampleGenerated &&
               existing.Receipt.PurchaseRequestId is null &&
               existing.Line.PurchaseRequestLineId is null &&
               !referencedByMovement &&
               !contributesToStock;
    }

    private static PurchaseHistoryActionDto CreateAction(
        string actionType,
        string sourceKey,
        string? businessKey,
        ExistingLineView? existing,
        string afterEvidence,
        string reasonCode)
    {
        var beforeEvidence = existing is null ? "none" : ExistingEvidence(existing);
        return BuildAction(
            actionType,
            sourceKey,
            businessKey,
            existing?.Line.Id ?? string.Empty,
            reasonCode,
            beforeEvidence,
            afterEvidence);
    }

    private static PurchaseHistoryActionDto CreateExistingOnlyAction(
        ExistingLineView existing,
        string actionType,
        string reasonCode)
    {
        var evidence = ExistingEvidence(existing);
        var afterEvidence = actionType == "delete" ? "none" : evidence;
        return BuildAction(
            actionType,
            $"database:{existing.Line.Id}",
            BuildBusinessKey(existing),
            existing.Line.Id,
            reasonCode,
            evidence,
            afterEvidence);
    }

    private static PurchaseHistoryActionDto BuildAction(
        string actionType,
        string sourceKey,
        string? businessKey,
        string targetId,
        string reasonCode,
        string beforeEvidence,
        string afterEvidence)
    {
        var beforeHash = Hash(beforeEvidence);
        var afterHash = Hash(afterEvidence);
        var actionHash = Hash($"{actionType}|{sourceKey}|{businessKey}|{targetId}|{reasonCode}|{beforeHash}|{afterHash}");
        return new PurchaseHistoryActionDto
        {
            ActionId = actionHash[..32],
            ActionType = actionType,
            SourceKey = sourceKey,
            BusinessKey = businessKey,
            TargetType = "InventoryReceiptLine",
            TargetId = targetId,
            ReasonCode = reasonCode,
            BeforeEvidence = beforeEvidence,
            BeforeHash = beforeHash,
            AfterEvidence = afterEvidence,
            AfterHash = afterHash,
            ActionHash = actionHash
        };
    }

    private static string ExistingEvidence(ExistingLineView existing)
        => string.Join('|', new[]
        {
            $"receiptLine={existing.Line.Id}",
            $"receipt={existing.Receipt.Code}",
            $"date={existing.Receipt.Date:yyyy-MM-dd}",
            $"supplier={existing.Supplier!.Name}",
            $"ingredient={existing.Ingredient.Name}",
            $"unit={existing.Unit.Code}",
            $"quantity={Invariant(existing.Line.Quantity)}",
            $"unitPrice={Invariant(existing.Line.UnitPrice)}",
            $"lot={existing.Line.LotNumber ?? string.Empty}"
        });

    private static string CandidateEvidence(PurchaseHistorySourceCandidate candidate)
        => string.Join('|', new[]
        {
            $"source={candidate.SourceKey}",
            $"date={candidate.DeliveryDate:yyyy-MM-dd}",
            $"supplier={candidate.Normalization!.SupplierName}",
            $"ingredient={candidate.Normalization.IngredientName}",
            $"unit={candidate.Normalization.UnitCode}",
            $"quantity={Invariant(candidate.Quantity)}",
            $"unitPrice={Invariant(candidate.UnitPrice)}",
            $"rowHash={candidate.RowHash}"
        });

    private static string BuildBusinessKey(ExistingLineView existing)
        => $"{existing.Receipt.Date:yyyy-MM-dd}|{existing.Ingredient.Name}";

    private static string BuildDatabaseEvidence(
        IEnumerable<SupplierSnapshot> suppliers,
        IEnumerable<IngredientSnapshot> ingredients,
        IEnumerable<UnitSnapshot> units,
        IEnumerable<ReceiptSnapshot> receipts,
        IEnumerable<ReceiptLineSnapshot> lines,
        IEnumerable<MovementSnapshot> movements,
        IEnumerable<StockSnapshot> stocks)
        => string.Join(
            "\n",
            suppliers.Select(item => $"supplier|{item.Id}|{item.Code}|{item.Name}|{item.IsActive}").Order()
                .Concat(ingredients.Select(item => $"ingredient|{item.Id}|{item.Code}|{item.Name}|{item.UnitId}|{Invariant(item.ReferencePrice)}|{item.IsActive}").Order())
                .Concat(units.Select(item => $"unit|{item.Id}|{item.Code}|{item.Name}|{item.BaseUnitCode}|{Invariant(item.ConversionRate)}").Order())
                .Concat(receipts.Select(item => $"receipt|{item.Id}|{item.Code}|{item.Date:yyyy-MM-dd}|{item.SupplierId}|{item.PurchaseRequestId}").Order())
                .Concat(lines.Select(item => $"line|{item.Id}|{item.ReceiptId}|{item.PurchaseRequestLineId}|{item.IngredientId}|{item.UnitId}|{Invariant(item.Quantity)}|{Invariant(item.UnitPrice)}|{Invariant(item.Amount)}|{item.LotNumber}").Order())
                .Concat(movements.Select(item => $"movement|{item.Id}|{item.RefTable}|{item.RefId}|{item.IngredientId}|{item.UnitId}|{Invariant(item.QuantityIn)}|{Invariant(item.QuantityOut)}").Order())
                .Concat(stocks.Select(item => $"stock|{item.WarehouseId}|{item.IngredientId}|{item.UnitId}|{Invariant(item.Quantity)}").Order()));

    private static string CanonicalRawCells(IReadOnlyDictionary<string, string> cells)
        => string.Join('|', cells.OrderBy(item => item.Key, StringComparer.OrdinalIgnoreCase).Select(item => $"{item.Key}={item.Value}"));

    private static string Invariant(decimal? value)
        => value?.ToString("0.############################", CultureInfo.InvariantCulture) ?? string.Empty;

    private static string Hash(string value)
        => Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(value)));

    private sealed record SupplierSnapshot(string Id, string Code, string Name, bool? IsActive);
    private sealed record IngredientSnapshot(string Id, string Code, string Name, string UnitId, decimal ReferencePrice, bool? IsActive);
    private sealed record UnitSnapshot(string Id, string Code, string Name, string? BaseUnitCode, decimal ConversionRate);
    private sealed record ReceiptSnapshot(string Id, string Code, DateOnly Date, string SupplierId, string? PurchaseRequestId);
    private sealed record ReceiptLineSnapshot(
        string Id,
        string ReceiptId,
        string? PurchaseRequestLineId,
        string IngredientId,
        string UnitId,
        decimal Quantity,
        decimal UnitPrice,
        decimal? Amount,
        string? LotNumber);
    private sealed record MovementSnapshot(
        string Id,
        string? RefTable,
        string? RefId,
        string IngredientId,
        string UnitId,
        decimal QuantityIn,
        decimal QuantityOut);
    private sealed record StockSnapshot(string WarehouseId, string IngredientId, string UnitId, decimal Quantity);
    private sealed record ExistingLineView(
        ReceiptLineSnapshot Line,
        ReceiptSnapshot Receipt,
        SupplierSnapshot? Supplier,
        IngredientSnapshot Ingredient,
        UnitSnapshot Unit);
}

internal sealed record PurchaseHistoryPreviewSource(
    string SourceName,
    PurchaseHistoryParseResult ParseResult);
