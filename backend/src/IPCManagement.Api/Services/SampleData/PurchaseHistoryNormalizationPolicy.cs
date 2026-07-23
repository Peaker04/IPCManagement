using System.Globalization;
using System.Text.RegularExpressions;

namespace IPCManagement.Api.Services.SampleData;

internal static class PurchaseHistoryPolicyVersion
{
    public const string Current = "purchase-history-normalization/2026-07-22/v3";
}

internal sealed class PurchaseHistoryNormalizationPolicy
{
    private static readonly CultureInfo VietnameseCulture = CultureInfo.GetCultureInfo("vi-VN");

    private static readonly IReadOnlyDictionary<string, string> UnitAliases =
        new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
        {
            ["kg"] = "KG",
            ["kgs"] = "KG",
            ["kilogram"] = "KG",
            ["ký"] = "KG",
            ["ky"] = "KG",
            ["k"] = "KG",
            ["g"] = "G",
            ["bich"] = "BICH",
            ["bịch"] = "BICH",
            ["cái"] = "CAI",
            ["cai"] = "CAI",
            ["chai"] = "CHAI",
            ["gói"] = "GOI",
            ["goi"] = "GOI",
            ["hộp"] = "HOP",
            ["hop"] = "HOP",
            ["hũ"] = "HU",
            ["hủ"] = "HU",
            ["hu"] = "HU",
            ["lốc"] = "LOC",
            ["loốc"] = "LOC",
            ["loc"] = "LOC",
            ["cây"] = "CAY",
            ["cay"] = "CAY",
            ["lát"] = "LAT",
            ["lất"] = "LAT",
            ["lat"] = "LAT",
            ["lát nhỏ"] = "LAT",
            ["miếng"] = "MIENG",
            ["mieng"] = "MIENG",
            ["quả"] = "QUA",
            ["qua"] = "QUA",
            ["ổ"] = "O",
            ["o"] = "O",
            ["thùng"] = "THUNG",
            ["thung"] = "THUNG",
            ["bao"] = "BAO",
            ["can"] = "CAN",
            ["cặp"] = "CAP",
            ["cục"] = "CUC",
            ["đôi"] = "DOI",
            ["lon"] = "LON",
            ["lít"] = "LIT",
            ["phần"] = "PHAN",
            ["trái"] = "TRAI",
            ["vỉ"] = "VI",
            ["viên"] = "VIEN",
            ["xấp"] = "XAP",
            ["bó"] = "BO_BUNCH",
            ["bộ"] = "BO_SET",
            ["bình"] = "BINH",
            ["chiếc"] = "CHIEC",
            ["con"] = "CON",
            ["bì"] = "BI"
        };

    private static readonly IReadOnlyDictionary<string, string> IngredientAliases =
        new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
        {
            ["Cảithiaf"] = "Cải thìa",
            ["Nấm bào ngừ"] = "Nấm bào ngư",
            ["Bì ngòi xanh"] = "Bí ngòi xanh"
        };

    private static readonly HashSet<string> AmbiguousUnits =
        new(["kh", "canh"], StringComparer.OrdinalIgnoreCase);

    private readonly IReadOnlyDictionary<string, string> _canonicalSuppliers;
    private readonly IReadOnlyDictionary<string, PurchaseHistoryEmbeddedSupplierMapping> _embeddedMappings;
    private readonly IReadOnlyList<PurchaseHistoryPackageRule> _packageRules;

    public PurchaseHistoryNormalizationPolicy(
        IEnumerable<string> canonicalSuppliers,
        IEnumerable<PurchaseHistoryEmbeddedSupplierMapping>? embeddedMappings = null,
        IEnumerable<PurchaseHistoryPackageRule>? packageRules = null)
    {
        _canonicalSuppliers = canonicalSuppliers
            .Where(value => !string.IsNullOrWhiteSpace(value))
            .Select(CollapseWhitespace)
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToDictionary(value => value, value => value, StringComparer.OrdinalIgnoreCase);
        _embeddedMappings = (embeddedMappings ?? [])
            .ToDictionary(
                mapping => CollapseWhitespace(mapping.RawIngredient),
                mapping => mapping,
                StringComparer.OrdinalIgnoreCase);
        _packageRules = (packageRules ?? []).ToList();
    }

    public string Version => PurchaseHistoryPolicyVersion.Current;

    public PurchaseHistoryNormalizationPolicy WithCanonicalSuppliers(IEnumerable<string> suppliers)
        => new(
            _canonicalSuppliers.Values.Concat(suppliers),
            _embeddedMappings.Values,
            _packageRules);

    public PurchaseHistoryFieldResult<string> NormalizeSupplier(
        string rawSupplier,
        PurchaseHistorySourceTrace trace)
    {
        var normalized = CollapseWhitespace(rawSupplier);
        if (_canonicalSuppliers.TryGetValue(normalized, out var canonical))
        {
            return PurchaseHistoryFieldResult<string>.Success(canonical);
        }

        return PurchaseHistoryFieldResult<string>.Blocked(
            Blocker("SUPPLIER_UNKNOWN", "Supplier", rawSupplier, trace));
    }

    public PurchaseHistoryFieldResult<PurchaseHistoryNormalizedIngredient> NormalizeIngredient(
        string rawIngredient,
        PurchaseHistorySourceTrace trace)
    {
        var normalized = CollapseWhitespace(rawIngredient);
        if (string.IsNullOrWhiteSpace(normalized))
        {
            return PurchaseHistoryFieldResult<PurchaseHistoryNormalizedIngredient>.Blocked(
                Blocker("INGREDIENT_MISSING", "Ingredient", rawIngredient, trace));
        }

        if (IngredientAliases.TryGetValue(normalized, out var canonicalIngredient))
        {
            return PurchaseHistoryFieldResult<PurchaseHistoryNormalizedIngredient>.Success(
                new PurchaseHistoryNormalizedIngredient(canonicalIngredient, null));
        }

        if (_embeddedMappings.TryGetValue(normalized, out var mapping))
        {
            var supplier = NormalizeSupplier(mapping.SupplierName, trace);
            if (supplier.Blockers.Count > 0)
            {
                return new PurchaseHistoryFieldResult<PurchaseHistoryNormalizedIngredient>(
                    null,
                    supplier.Blockers);
            }

            return PurchaseHistoryFieldResult<PurchaseHistoryNormalizedIngredient>.Success(
                new PurchaseHistoryNormalizedIngredient(
                    SentenceCase(mapping.IngredientName),
                    supplier.Value));
        }

        if (LooksLikeEmbeddedSupplier(normalized))
        {
            return PurchaseHistoryFieldResult<PurchaseHistoryNormalizedIngredient>.Blocked(
                Blocker("INGREDIENT_SUPPLIER_AMBIGUOUS", "Ingredient", rawIngredient, trace));
        }

        return PurchaseHistoryFieldResult<PurchaseHistoryNormalizedIngredient>.Success(
            new PurchaseHistoryNormalizedIngredient(SentenceCase(normalized), null));
    }

    public PurchaseHistoryFieldResult<string> NormalizeUnit(
        string rawUnit,
        PurchaseHistorySourceTrace trace)
    {
        var normalized = CollapseWhitespace(rawUnit);
        if (AmbiguousUnits.Contains(normalized))
        {
            return PurchaseHistoryFieldResult<string>.Blocked(
                Blocker("UNIT_AMBIGUOUS", "Unit", rawUnit, trace));
        }

        if (UnitAliases.TryGetValue(normalized, out var unitCode))
        {
            return PurchaseHistoryFieldResult<string>.Success(unitCode);
        }

        return PurchaseHistoryFieldResult<string>.Blocked(
            Blocker("UNIT_UNKNOWN", "Unit", rawUnit, trace));
    }

    public PurchaseHistoryFieldResult<PurchaseHistoryPackageSnapshot> NormalizePackage(
        string rawUnit,
        string ingredientName,
        string supplierName,
        DateOnly deliveryDate,
        bool requiresCrossUnitConversion,
        PurchaseHistorySourceTrace trace)
    {
        var decorated = Regex.Match(
            CollapseWhitespace(rawUnit),
            @"^(?:bich|bịch)\s*\(\s*(?<size>\d+(?:[.,]\d+)?)\s*(?<unit>[^)]+)\s*\)$",
            RegexOptions.IgnoreCase | RegexOptions.CultureInvariant);
        if (decorated.Success &&
            decimal.TryParse(
                decorated.Groups["size"].Value.Replace(',', '.'),
                NumberStyles.Number,
                CultureInfo.InvariantCulture,
                out var packageSize) &&
            packageSize > 0)
        {
            var baseUnit = NormalizeUnit(decorated.Groups["unit"].Value, trace);
            return baseUnit.Blockers.Count == 0
                ? PurchaseHistoryFieldResult<PurchaseHistoryPackageSnapshot>.Success(
                    new PurchaseHistoryPackageSnapshot("BICH", packageSize, baseUnit.Value))
                : new PurchaseHistoryFieldResult<PurchaseHistoryPackageSnapshot>(null, baseUnit.Blockers);
        }

        var unit = NormalizeUnit(rawUnit, trace);
        if (unit.Blockers.Count > 0)
        {
            return new PurchaseHistoryFieldResult<PurchaseHistoryPackageSnapshot>(null, unit.Blockers);
        }

        if (!string.Equals(unit.Value, "BICH", StringComparison.Ordinal))
        {
            return PurchaseHistoryFieldResult<PurchaseHistoryPackageSnapshot>.Success(
                new PurchaseHistoryPackageSnapshot(unit.Value!, null, null));
        }

        if (!requiresCrossUnitConversion)
        {
            return PurchaseHistoryFieldResult<PurchaseHistoryPackageSnapshot>.Success(
                new PurchaseHistoryPackageSnapshot("BICH", null, null));
        }

        var rules = _packageRules
            .Where(rule => string.Equals(
                               CollapseWhitespace(rule.IngredientName),
                               CollapseWhitespace(ingredientName),
                               StringComparison.OrdinalIgnoreCase) &&
                           string.Equals(
                               CollapseWhitespace(rule.SupplierName),
                               CollapseWhitespace(supplierName),
                               StringComparison.OrdinalIgnoreCase) &&
                           rule.EffectiveFrom <= deliveryDate &&
                           rule.EffectiveTo >= deliveryDate)
            .ToList();
        if (rules.Count == 1)
        {
            var rule = rules[0];
            return PurchaseHistoryFieldResult<PurchaseHistoryPackageSnapshot>.Success(
                new PurchaseHistoryPackageSnapshot("BICH", rule.PackageSize, rule.BaseUnitCode));
        }

        return PurchaseHistoryFieldResult<PurchaseHistoryPackageSnapshot>.Blocked(
            Blocker(
                rules.Count == 0 ? "PACKAGE_SIZE_REQUIRED" : "PACKAGE_RULE_AMBIGUOUS",
                "Package",
                rawUnit,
                trace));
    }

    public PurchaseHistoryFieldResult<DateOnly> ValidateHistoricalDate(
        string rawDate,
        DateOnly? parsedDate,
        DateOnly asOfDate,
        PurchaseHistorySourceTrace trace)
    {
        if (parsedDate is null)
        {
            return PurchaseHistoryFieldResult<DateOnly>.Blocked(
                Blocker("DATE_INVALID", "DeliveryDate", rawDate, trace));
        }

        if (parsedDate.Value > asOfDate.AddDays(7))
        {
            return PurchaseHistoryFieldResult<DateOnly>.Blocked(
                Blocker("DATE_AFTER_AS_OF_WINDOW", "DeliveryDate", rawDate, trace));
        }

        return PurchaseHistoryFieldResult<DateOnly>.Success(parsedDate.Value);
    }

    public PurchaseHistoryNormalizationResult Normalize(
        PurchaseHistorySourceCandidate candidate,
        DateOnly asOfDate)
    {
        var supplier = NormalizeSupplier(candidate.SupplierName, candidate.Trace);
        var ingredient = NormalizeIngredient(candidate.RawIngredient, candidate.Trace);
        var unit = NormalizeUnit(candidate.RawUnit, candidate.Trace);
        var date = ValidateHistoricalDate(
            candidate.Trace.RawCells.GetValueOrDefault("Ngày Giao hàng", string.Empty),
            candidate.DeliveryDate,
            asOfDate,
            candidate.Trace);
        var package = date.Blockers.Count == 0 &&
                      candidate.DeliveryDate is DateOnly deliveryDate &&
                      ingredient.Value is not null &&
                      supplier.Value is not null
            ? NormalizePackage(
                candidate.RawUnit,
                ingredient.Value.IngredientName,
                ingredient.Value.SupplierName ?? supplier.Value,
                deliveryDate,
                requiresCrossUnitConversion: false,
                candidate.Trace)
            : null;
        var blockers = supplier.Blockers
            .Concat(ingredient.Blockers)
            .Concat(package?.Value is null ? unit.Blockers : [])
            .Concat(date.Blockers)
            .Concat(package?.Blockers ?? [])
            .DistinctBy(blocker => $"{blocker.Code}|{blocker.Field}|{blocker.RawValue}")
            .ToList();

        return new PurchaseHistoryNormalizationResult(
            Version,
            ingredient.Value?.SupplierName ?? supplier.Value,
            ingredient.Value?.IngredientName,
            package?.Value?.UnitCode ?? unit.Value,
            package?.Value,
            date.Blockers.Count == 0 ? candidate.DeliveryDate : null,
            blockers);
    }

    private static PurchaseHistoryNormalizationBlocker Blocker(
        string code,
        string field,
        string rawValue,
        PurchaseHistorySourceTrace trace)
        => new(code, field, rawValue, trace);

    private static string CollapseWhitespace(string value)
        => Regex.Replace(value.Trim(), @"\s+", " ");

    private static string SentenceCase(string value)
    {
        var collapsed = CollapseWhitespace(value).ToLower(VietnameseCulture);
        return string.IsNullOrEmpty(collapsed)
            ? collapsed
            : char.ToUpper(collapsed[0], VietnameseCulture) + collapsed[1..];
    }

    private static bool LooksLikeEmbeddedSupplier(string value)
        => value.Contains(" - ", StringComparison.Ordinal) ||
           value.Contains(" ncc ", StringComparison.OrdinalIgnoreCase) ||
           value.Contains("nhà cung cấp", StringComparison.OrdinalIgnoreCase);
}

internal sealed record PurchaseHistoryFieldResult<T>(
    T? Value,
    IReadOnlyList<PurchaseHistoryNormalizationBlocker> Blockers)
{
    public static PurchaseHistoryFieldResult<T> Success(T value) => new(value, []);

    public static PurchaseHistoryFieldResult<T> Blocked(PurchaseHistoryNormalizationBlocker blocker)
        => new(default, [blocker]);
}

internal sealed record PurchaseHistoryNormalizationBlocker(
    string Code,
    string Field,
    string RawValue,
    PurchaseHistorySourceTrace Trace);

internal sealed record PurchaseHistoryNormalizedIngredient(
    string IngredientName,
    string? SupplierName);

internal sealed record PurchaseHistoryPackageSnapshot(
    string UnitCode,
    decimal? PackageSize,
    string? BaseUnitCode);

internal sealed record PurchaseHistoryEmbeddedSupplierMapping(
    string RawIngredient,
    string IngredientName,
    string SupplierName);

internal sealed record PurchaseHistoryPackageRule(
    string IngredientName,
    string SupplierName,
    DateOnly EffectiveFrom,
    DateOnly EffectiveTo,
    decimal PackageSize,
    string BaseUnitCode);

internal sealed record PurchaseHistoryNormalizationResult(
    string PolicyVersion,
    string? SupplierName,
    string? IngredientName,
    string? UnitCode,
    PurchaseHistoryPackageSnapshot? Package,
    DateOnly? DeliveryDate,
    IReadOnlyList<PurchaseHistoryNormalizationBlocker> Blockers);
