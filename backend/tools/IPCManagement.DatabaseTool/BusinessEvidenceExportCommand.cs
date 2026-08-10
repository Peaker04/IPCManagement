using System.Data;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;
using MySqlConnector;

namespace IPCManagement.DatabaseTool;

public sealed record BusinessEvidenceSubject(
    string SourceEntityId,
    string CurrentFingerprint,
    IReadOnlyDictionary<string, string?> Facts,
    IReadOnlyList<string> RequiredSourceReferenceTypes,
    IReadOnlyList<string> RequiredAuthoritySlots);

public sealed record MenuEvidenceSubject(
    string SourceEntityId,
    string CurrentFingerprint,
    IReadOnlyDictionary<string, IReadOnlyList<string>> PhysicalReferences,
    IReadOnlyList<string> RequiredSourceReferenceTypes,
    IReadOnlyList<string> RequiredAuthoritySlots);

public sealed record StableEvidenceRow(
    string RowId,
    string CurrentFingerprint,
    IReadOnlyDictionary<string, string?> Facts);

public sealed record QuotationEvidenceSubject(
    string SourceEntityId,
    string CurrentFingerprint,
    IReadOnlyList<StableEvidenceRow> CurrentRows,
    bool RequiresResolution,
    IReadOnlyList<string> RequiredSourceReferenceTypes,
    IReadOnlyList<string> RequiredAuthoritySlots);

public sealed record BomEvidenceSubject(
    string SourceEntityId,
    string CurrentFingerprint,
    IReadOnlyList<StableEvidenceRow> CurrentRows,
    bool RequiresResolution,
    IReadOnlyList<string> RequiredSourceReferenceTypes,
    IReadOnlyList<string> RequiredAuthoritySlots);

public sealed record StableConsumerReference(string RowId, string IngredientId);

public sealed record DuplicateEvidenceGroup(
    string GroupId,
    string CurrentFingerprint,
    IReadOnlyList<string> MemberIds,
    IReadOnlyDictionary<string, IReadOnlyList<StableConsumerReference>> ConsumerReferences,
    bool SourceScanClosed,
    bool RuntimeScanClosed,
    IReadOnlyList<string> RequiredSourceReferenceTypes,
    IReadOnlyList<string> RequiredAuthoritySlots);

public sealed record BusinessEvidenceExportSnapshot(
    string Database,
    string MigrationHead,
    IReadOnlyList<BusinessEvidenceSubject> Movements,
    IReadOnlyList<MenuEvidenceSubject> MenuWeeks,
    IReadOnlyList<BusinessEvidenceSubject> UnitReviews,
    IReadOnlyList<QuotationEvidenceSubject> Quotations,
    IReadOnlyList<BomEvidenceSubject> Boms,
    IReadOnlyList<DuplicateEvidenceGroup> DuplicateGroups,
    int MutationStatements);

public sealed record BusinessEvidenceExportReceipt(
    string Database,
    string OutputPath,
    string PackageSha256,
    int MovementCount,
    int MenuWeekCount,
    int UnitReviewCount,
    int QuotationSubjectCount,
    int BomSubjectCount,
    int DuplicateGroupCount,
    int MutationStatements);

public static class BusinessEvidenceExportCommand
{
    public const int ExpectedMovementCount = 2461;
    public const int ExpectedMenuWeekCount = 84;
    public const int ExpectedUnitReviewCount = 44;
    public const int ExpectedDuplicateGroupCount = 16;

    public static readonly string[] RequiredMenuReferenceSurfaces =
    [
        "productionplans", "materialrequests", "purchaserequests", "purchaseorders",
        "inventoryreceipts", "inventoryissues", "inventoryreturns",
        "supplementalmaterialrequests", "stockmovements"
    ];

    public static readonly string[] RequiredDuplicateConsumerSurfaces =
    [
        "dishbom", "materialrequestlines", "purchaserequestlines", "purchaseorderlines",
        "inventoryreceiptlines", "inventoryissuelines", "inventoryreturnlines", "stockmovements",
        "currentstocks", "currentstocklots", "stocksnapshots", "stocktakelines",
        "supplierquotations", "unitnormalizationreviews", "dataqualitydispositions"
    ];

    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        WriteIndented = true
    };

    public static IReadOnlyList<string> Validate(BusinessEvidenceExportSnapshot snapshot)
    {
        ArgumentNullException.ThrowIfNull(snapshot);
        var issues = new List<string>();
        RequireCount("movement", snapshot.Movements.Count, ExpectedMovementCount, issues);
        RequireCount("menu-week", snapshot.MenuWeeks.Count, ExpectedMenuWeekCount, issues);
        RequireCount("unit review", snapshot.UnitReviews.Count, ExpectedUnitReviewCount, issues);
        RequireCount("duplicate group", snapshot.DuplicateGroups.Count, ExpectedDuplicateGroupCount, issues);

        ValidateSubjects("movement", snapshot.Movements, issues);
        ValidateSubjects("unit review", snapshot.UnitReviews, issues);
        ValidateUniqueStableIds("menu-week", snapshot.MenuWeeks.Select(row => row.SourceEntityId), issues);
        foreach (var menu in snapshot.MenuWeeks)
        {
            ValidateStableIdAndFingerprint("menu-week", menu.SourceEntityId, menu.CurrentFingerprint, issues);
            ValidateReferenceSlots("menu-week", menu.SourceEntityId, menu.RequiredSourceReferenceTypes,
                menu.RequiredAuthoritySlots, issues);
            foreach (var surface in RequiredMenuReferenceSurfaces)
                if (!menu.PhysicalReferences.ContainsKey(surface))
                    issues.Add($"menu-week {menu.SourceEntityId} is missing full physical traversal surface {surface}.");
        }

        ValidateUniqueStableIds("quotation", snapshot.Quotations.Select(row => row.SourceEntityId), issues);
        foreach (var row in snapshot.Quotations)
        {
            ValidateStableIdAndFingerprint("quotation", row.SourceEntityId, row.CurrentFingerprint, issues);
            ValidateReferenceSlots("quotation", row.SourceEntityId, row.RequiredSourceReferenceTypes,
                row.RequiredAuthoritySlots, issues);
        }
        ValidateUniqueStableIds("BOM", snapshot.Boms.Select(row => row.SourceEntityId), issues);
        foreach (var row in snapshot.Boms)
        {
            ValidateStableIdAndFingerprint("BOM", row.SourceEntityId, row.CurrentFingerprint, issues);
            ValidateReferenceSlots("BOM", row.SourceEntityId, row.RequiredSourceReferenceTypes,
                row.RequiredAuthoritySlots, issues);
        }

        var groupIds = snapshot.DuplicateGroups.Select(group => group.GroupId).ToArray();
        if (groupIds.Distinct(StringComparer.Ordinal).Count() != groupIds.Length)
            issues.Add("duplicate group IDs are not unique.");
        foreach (var group in snapshot.DuplicateGroups)
        {
            if (!IsSha256(group.GroupId) || !IsSha256(group.CurrentFingerprint))
                issues.Add($"duplicate group {group.GroupId} has an invalid stable ID or fingerprint.");
            if (group.MemberIds.Count < 2 || group.MemberIds.Any(member => !IsStableId(member)) ||
                group.MemberIds.Distinct(StringComparer.Ordinal).Count() != group.MemberIds.Count)
                issues.Add($"duplicate group {group.GroupId} has invalid member stable IDs.");
            foreach (var surface in RequiredDuplicateConsumerSurfaces)
                if (!group.ConsumerReferences.ContainsKey(surface))
                    issues.Add($"duplicate group {group.GroupId} is missing consumer surface {surface}.");
            if (!group.SourceScanClosed || !group.RuntimeScanClosed)
                issues.Add($"duplicate group {group.GroupId} source/runtime closure is incomplete.");
            ValidateReferenceSlots("duplicate group", group.GroupId, group.RequiredSourceReferenceTypes,
                group.RequiredAuthoritySlots, issues);
        }

        if (snapshot.MutationStatements != 0)
            issues.Add("Business evidence export must prove MutationStatements=0.");
        return issues;
    }

    public static void ValidateTarget(string database)
    {
        if (!string.Equals(database, "ipcmanagement", StringComparison.Ordinal))
            throw new ArgumentException("Business evidence export is read-only and restricted to ipcmanagement.");
    }

    public static async Task<BusinessEvidenceExportReceipt> WritePackageAsync(
        BusinessEvidenceExportSnapshot snapshot,
        string outputPath)
    {
        var issues = Validate(snapshot);
        if (issues.Count != 0)
            throw new InvalidOperationException("Business evidence export failed closed: " + string.Join("; ", issues));

        var fullPath = Path.GetFullPath(outputPath);
        Directory.CreateDirectory(Path.GetDirectoryName(fullPath)
            ?? throw new ArgumentException("Export output must have a parent directory."));
        var bytes = JsonSerializer.SerializeToUtf8Bytes(snapshot, JsonOptions);
        await File.WriteAllBytesAsync(fullPath, bytes);
        var digest = Convert.ToHexString(SHA256.HashData(bytes));
        await File.WriteAllTextAsync(fullPath + ".sha256", digest + Environment.NewLine, new UTF8Encoding(false));
        return new BusinessEvidenceExportReceipt(snapshot.Database, fullPath, digest,
            snapshot.Movements.Count, snapshot.MenuWeeks.Count, snapshot.UnitReviews.Count,
            snapshot.Quotations.Count, snapshot.Boms.Count, snapshot.DuplicateGroups.Count,
            snapshot.MutationStatements);
    }

    public static async Task<int> ExecuteAsync(
        Func<Task<MySqlConnection>> connectionFactory,
        string database,
        string outputPath)
    {
        ValidateTarget(database);
        await using var connection = await connectionFactory();
        if (connection.State != ConnectionState.Open)
            await connection.OpenAsync();
        var snapshot = await ReadSnapshotAsync(connection, database);
        var receipt = await WritePackageAsync(snapshot, outputPath);
        Console.WriteLine(JsonSerializer.Serialize(receipt, JsonOptions));
        return 0;
    }

    private static async Task<BusinessEvidenceExportSnapshot> ReadSnapshotAsync(
        MySqlConnection connection,
        string database)
    {
        var migrationHead = await ScalarStringAsync(connection,
            $"SELECT MAX(MigrationId) FROM {Quote(database)}.`__EFMigrationsHistory`;");
        var movements = await ReadBusinessSubjectsAsync(connection,
            $"""
            SELECT HEX(movementId) sourceId,
                   SHA2(CONCAT_WS('|', HEX(movementId), DATE_FORMAT(movementDate, '%Y-%m-%d %H:%i:%s'),
                       beforeQty, quantityIn, quantityOut, afterQty, movementType,
                       COALESCE(refTable, ''), COALESCE(HEX(refId), '')), 256) fingerprint,
                   HEX(warehouseId) warehouseId, HEX(ingredientId) ingredientId, HEX(unitId) unitId,
                   COALESCE(refTable, '') referenceType, COALESCE(HEX(refId), '') referenceId
            FROM {Quote(database)}.stockmovements
            WHERE ABS(afterQty - (beforeQty + quantityIn - quantityOut)) > 0.000010
            ORDER BY movementId;
            """, ["warehouseId", "ingredientId", "unitId", "referenceType", "referenceId"],
            ["LEDGER", "RECEIPT", "STOCK_SNAPSHOT"],
            ["WAREHOUSE_SOURCE_OWNER", "FINANCE_SOURCE_OWNER"]);

        var menuSeeds = await ReadMenuSeedsAsync(connection, database);
        var menus = new List<MenuEvidenceSubject>(menuSeeds.Count);
        foreach (var seed in menuSeeds)
            menus.Add(new MenuEvidenceSubject(seed.Id, seed.Fingerprint,
                await ReadMenuPhysicalReferencesAsync(connection, database, seed),
                ["SOURCE_WORKBOOK", "DOWNSTREAM_TRAVERSAL"], ["COORDINATION_SOURCE_OWNER"]));

        var units = await ReadBusinessSubjectsAsync(connection,
            $"""
            SELECT HEX(review.reviewId) sourceId,
                   SHA2(CONCAT_WS('|', HEX(review.reviewId), HEX(review.ingredientId), HEX(review.sourceUnitId),
                       sourceUnit.unitCode, COALESCE(sourceUnit.baseUnitCode, ''), sourceUnit.convertRateToBase,
                       HEX(review.catalogUnitId), catalogUnit.unitCode, COALESCE(catalogUnit.baseUnitCode, ''),
                       catalogUnit.convertRateToBase), 256) fingerprint,
                   HEX(review.ingredientId) ingredientId, HEX(review.sourceUnitId) sourceUnitId,
                   HEX(review.catalogUnitId) catalogUnitId, review.status,
                   COALESCE(CAST(review.proposedSourceToCatalogFactor AS CHAR), '') proposedFactor
            FROM {Quote(database)}.unitnormalizationreviews review
            JOIN {Quote(database)}.units sourceUnit ON sourceUnit.unitId=review.sourceUnitId
            JOIN {Quote(database)}.units catalogUnit ON catalogUnit.unitId=review.catalogUnitId
            ORDER BY review.reviewId;
            """, ["ingredientId", "sourceUnitId", "catalogUnitId", "status", "proposedFactor"],
            ["AUTHORITATIVE_UNIT_SOURCE"], ["CATALOG_SOURCE_OWNER", "WAREHOUSE_SOURCE_OWNER"]);

        var quotations = await ReadQuotationSubjectsAsync(connection, database);
        var boms = await ReadBomSubjectsAsync(connection, database);
        var duplicates = await ReadDuplicateGroupsAsync(connection, database);
        return new BusinessEvidenceExportSnapshot(database, migrationHead, movements, menus, units,
            quotations, boms, duplicates, MutationStatements: 0);
    }

    private static async Task<List<BusinessEvidenceSubject>> ReadBusinessSubjectsAsync(
        MySqlConnection connection,
        string sql,
        IReadOnlyList<string> factColumns,
        IReadOnlyList<string> sourceReferenceTypes,
        IReadOnlyList<string> authoritySlots)
    {
        await using var command = new MySqlCommand(sql, connection);
        await using var reader = await command.ExecuteReaderAsync();
        var result = new List<BusinessEvidenceSubject>();
        while (await reader.ReadAsync())
        {
            var facts = factColumns.ToDictionary(column => column,
                column => reader.IsDBNull(reader.GetOrdinal(column)) ? null : Convert.ToString(reader[column]));
            result.Add(new BusinessEvidenceSubject(reader.GetString("sourceId"),
                reader.GetString("fingerprint").ToUpperInvariant(), facts, sourceReferenceTypes, authoritySlots));
        }
        return result;
    }

    private static async Task<List<MenuSeed>> ReadMenuSeedsAsync(MySqlConnection connection, string database)
    {
        await using var command = new MySqlCommand(
            $"""
            SELECT HEX(menuScheduleId) sourceId,
                   SHA2(CONCAT_WS('|', HEX(menuScheduleId), serviceDate, weekStartDate,
                       DATE_SUB(serviceDate, INTERVAL WEEKDAY(serviceDate) DAY), shiftName,
                       status, HEX(menuVersionId)), 256) fingerprint,
                   menuVersionId, customerId, serviceDate
            FROM {Quote(database)}.menuschedules
            WHERE weekStartDate <> DATE_SUB(serviceDate, INTERVAL WEEKDAY(serviceDate) DAY)
            ORDER BY menuScheduleId;
            """, connection);
        await using var reader = await command.ExecuteReaderAsync();
        var result = new List<MenuSeed>();
        while (await reader.ReadAsync())
            result.Add(new MenuSeed(reader.GetString("sourceId"), reader.GetString("fingerprint").ToUpperInvariant(),
                reader.IsDBNull(reader.GetOrdinal("menuVersionId"))
                    ? null
                    : reader.GetFieldValue<byte[]>(reader.GetOrdinal("menuVersionId")),
                reader.IsDBNull(reader.GetOrdinal("customerId"))
                    ? null
                    : reader.GetFieldValue<byte[]>(reader.GetOrdinal("customerId")),
                reader.GetDateTime("serviceDate")));
        return result;
    }

    private static async Task<IReadOnlyDictionary<string, IReadOnlyList<string>>> ReadMenuPhysicalReferencesAsync(
        MySqlConnection connection,
        string database,
        MenuSeed seed)
    {
        var sql = $"""
            SELECT surface, stableId FROM (
              SELECT 'productionplans' surface, HEX(p.planId) stableId
                FROM {Quote(database)}.productionplans p
               WHERE p.menuVersionId<=>@version AND p.customerId<=>@customer AND p.planDate=@serviceDate
              UNION ALL
              SELECT 'materialrequests', HEX(mr.requestId)
                FROM {Quote(database)}.materialrequests mr JOIN {Quote(database)}.productionplans p ON p.planId=mr.planId
               WHERE p.menuVersionId<=>@version AND p.customerId<=>@customer AND p.planDate=@serviceDate
              UNION ALL
              SELECT 'purchaserequests', HEX(pr.purchaseRequestId)
                FROM {Quote(database)}.purchaserequests pr JOIN {Quote(database)}.purchaserequestlines prl ON prl.purchaseRequestId=pr.purchaseRequestId
                JOIN {Quote(database)}.materialrequestlines mrl ON mrl.requestLineId=prl.materialRequestLineId
                JOIN {Quote(database)}.materialrequests mr ON mr.requestId=mrl.requestId JOIN {Quote(database)}.productionplans p ON p.planId=mr.planId
               WHERE p.menuVersionId<=>@version AND p.customerId<=>@customer AND p.planDate=@serviceDate
              UNION ALL
              SELECT 'purchaseorders', HEX(po.purchaseOrderId)
                FROM {Quote(database)}.purchaseorders po JOIN {Quote(database)}.purchaseorderlines pol ON pol.purchaseOrderId=po.purchaseOrderId
                JOIN {Quote(database)}.purchaserequestlines prl ON prl.purchaseRequestLineId=pol.purchaseRequestLineId
                JOIN {Quote(database)}.materialrequestlines mrl ON mrl.requestLineId=prl.materialRequestLineId
                JOIN {Quote(database)}.materialrequests mr ON mr.requestId=mrl.requestId JOIN {Quote(database)}.productionplans p ON p.planId=mr.planId
               WHERE p.menuVersionId<=>@version AND p.customerId<=>@customer AND p.planDate=@serviceDate
              UNION ALL
              SELECT 'inventoryreceipts', HEX(ir.receiptId)
                FROM {Quote(database)}.inventoryreceipts ir JOIN {Quote(database)}.inventoryreceiptlines irl ON irl.receiptId=ir.receiptId
                JOIN {Quote(database)}.purchaserequestlines prl ON prl.purchaseRequestLineId=irl.purchaseRequestLineId
                JOIN {Quote(database)}.materialrequestlines mrl ON mrl.requestLineId=prl.materialRequestLineId
                JOIN {Quote(database)}.materialrequests mr ON mr.requestId=mrl.requestId JOIN {Quote(database)}.productionplans p ON p.planId=mr.planId
               WHERE p.menuVersionId<=>@version AND p.customerId<=>@customer AND p.planDate=@serviceDate
              UNION ALL
              SELECT 'inventoryissues', HEX(ii.issueId)
                FROM {Quote(database)}.inventoryissues ii JOIN {Quote(database)}.materialrequests mr ON mr.requestId=ii.materialRequestId
                JOIN {Quote(database)}.productionplans p ON p.planId=mr.planId
               WHERE p.menuVersionId<=>@version AND p.customerId<=>@customer AND p.planDate=@serviceDate
              UNION ALL
              SELECT 'inventoryreturns', HEX(ret.returnId)
                FROM {Quote(database)}.inventoryreturns ret JOIN {Quote(database)}.inventoryissues ii ON ii.issueId=ret.issueId
                JOIN {Quote(database)}.materialrequests mr ON mr.requestId=ii.materialRequestId JOIN {Quote(database)}.productionplans p ON p.planId=mr.planId
               WHERE p.menuVersionId<=>@version AND p.customerId<=>@customer AND p.planDate=@serviceDate
              UNION ALL
              SELECT 'supplementalmaterialrequests', HEX(smr.requestId)
                FROM {Quote(database)}.supplementalmaterialrequests smr JOIN {Quote(database)}.inventoryissues ii ON ii.issueId=smr.issueId
                JOIN {Quote(database)}.materialrequests mr ON mr.requestId=ii.materialRequestId JOIN {Quote(database)}.productionplans p ON p.planId=mr.planId
               WHERE p.menuVersionId<=>@version AND p.customerId<=>@customer AND p.planDate=@serviceDate
              UNION ALL
              SELECT 'stockmovements', HEX(sm.movementId)
                FROM {Quote(database)}.stockmovements sm
               WHERE sm.refId IN (
                 SELECT ir.receiptId FROM {Quote(database)}.inventoryreceipts ir JOIN {Quote(database)}.inventoryreceiptlines irl ON irl.receiptId=ir.receiptId
                 JOIN {Quote(database)}.purchaserequestlines prl ON prl.purchaseRequestLineId=irl.purchaseRequestLineId
                 JOIN {Quote(database)}.materialrequestlines mrl ON mrl.requestLineId=prl.materialRequestLineId
                 JOIN {Quote(database)}.materialrequests mr ON mr.requestId=mrl.requestId JOIN {Quote(database)}.productionplans p ON p.planId=mr.planId
                 WHERE p.menuVersionId<=>@version AND p.customerId<=>@customer AND p.planDate=@serviceDate
                 UNION SELECT ii.issueId FROM {Quote(database)}.inventoryissues ii JOIN {Quote(database)}.materialrequests mr ON mr.requestId=ii.materialRequestId
                 JOIN {Quote(database)}.productionplans p ON p.planId=mr.planId
                 WHERE p.menuVersionId<=>@version AND p.customerId<=>@customer AND p.planDate=@serviceDate
               )
            ) refs ORDER BY surface, stableId;
            """;
        await using var command = new MySqlCommand(sql, connection);
        command.Parameters.AddWithValue("@version", (object?)seed.MenuVersionId ?? DBNull.Value);
        command.Parameters.AddWithValue("@customer", (object?)seed.CustomerId ?? DBNull.Value);
        command.Parameters.AddWithValue("@serviceDate", seed.ServiceDate.Date);
        await using var reader = await command.ExecuteReaderAsync();
        var result = RequiredMenuReferenceSurfaces.ToDictionary(surface => surface,
            _ => (IReadOnlyList<string>)new List<string>(), StringComparer.Ordinal);
        while (await reader.ReadAsync())
            ((List<string>)result[reader.GetString("surface")]).Add(reader.GetString("stableId"));
        return result.ToDictionary(pair => pair.Key,
            pair => (IReadOnlyList<string>)pair.Value.Distinct(StringComparer.Ordinal).Order().ToArray(),
            StringComparer.Ordinal);
    }

    private static async Task<IReadOnlyList<QuotationEvidenceSubject>> ReadQuotationSubjectsAsync(
        MySqlConnection connection, string database)
    {
        await using var command = new MySqlCommand(
            $"""
            SELECT HEX(i.ingredientId) subjectId, HEX(i.unitId) unitId,
                   CASE WHEN q.quotationId IS NULL THEN NULL ELSE HEX(q.quotationId) END rowId,
                   CASE WHEN q.quotationId IS NULL THEN NULL ELSE SHA2(CONCAT_WS('|',HEX(q.quotationId),HEX(q.supplierId),HEX(q.ingredientId),q.unitPrice,q.effectiveFrom,COALESCE(q.effectiveTo,''),q.isActive),256) END rowFingerprint,
                   CASE WHEN q.quotationId IS NULL THEN NULL ELSE HEX(q.supplierId) END supplierId,
                   CASE WHEN q.quotationId IS NULL THEN NULL ELSE CAST(q.unitPrice AS CHAR) END unitPrice,
                   CASE WHEN q.quotationId IS NULL THEN NULL ELSE CAST(q.effectiveFrom AS CHAR) END effectiveFrom,
                   CASE WHEN q.quotationId IS NULL THEN NULL ELSE COALESCE(CAST(q.effectiveTo AS CHAR),'') END effectiveTo
              FROM {Quote(database)}.ingredients i
              LEFT JOIN {Quote(database)}.supplierquotations q ON q.ingredientId=i.ingredientId AND q.isActive=1
               AND q.effectiveFrom<=CURRENT_DATE AND (q.effectiveTo IS NULL OR q.effectiveTo>=CURRENT_DATE)
             WHERE i.isActive=1 ORDER BY i.ingredientId,q.quotationId;
            """, connection);
        return await ReadCoverageSubjectsAsync(command,
            ["supplierId", "unitPrice", "effectiveFrom", "effectiveTo"]);
    }

    private static async Task<IReadOnlyList<BomEvidenceSubject>> ReadBomSubjectsAsync(
        MySqlConnection connection, string database)
    {
        await using var command = new MySqlCommand(
            $"""
            SELECT HEX(d.dishId) subjectId, '' unitId,
                   CASE WHEN b.bomId IS NULL THEN NULL ELSE HEX(b.bomId) END rowId,
                   CASE WHEN b.bomId IS NULL THEN NULL ELSE SHA2(CONCAT_WS('|',HEX(b.bomId),HEX(b.dishId),HEX(b.ingredientId),HEX(b.unitId),COALESCE(HEX(b.customerId),''),b.priceTierAmount,b.effectiveFrom,COALESCE(b.effectiveTo,''),b.bomStatus),256) END rowFingerprint,
                   CASE WHEN b.bomId IS NULL THEN NULL ELSE HEX(b.ingredientId) END ingredientId,
                   CASE WHEN b.bomId IS NULL THEN NULL ELSE HEX(b.unitId) END unitId,
                   CASE WHEN b.bomId IS NULL THEN NULL ELSE COALESCE(HEX(b.customerId),'') END customerId,
                   CASE WHEN b.bomId IS NULL THEN NULL ELSE CAST(b.priceTierAmount AS CHAR) END priceTierAmount,
                   CASE WHEN b.bomId IS NULL THEN NULL ELSE CAST(b.effectiveFrom AS CHAR) END effectiveFrom,
                   CASE WHEN b.bomId IS NULL THEN NULL ELSE COALESCE(CAST(b.effectiveTo AS CHAR),'') END effectiveTo
              FROM {Quote(database)}.dishes d
              LEFT JOIN {Quote(database)}.dishbom b ON b.dishId=d.dishId AND b.bomStatus='PUBLISHED'
               AND b.effectiveFrom<=CURRENT_DATE AND (b.effectiveTo IS NULL OR b.effectiveTo>=CURRENT_DATE)
             WHERE d.isActive=1 ORDER BY d.dishId,b.bomId;
            """, connection);
        var rows = await ReadCoverageRowsAsync(command,
            ["ingredientId", "unitId", "customerId", "priceTierAmount", "effectiveFrom", "effectiveTo"]);
        return rows.GroupBy(row => row.SubjectId, StringComparer.Ordinal).Select(group =>
        {
            var current = group.Where(row => row.Row is not null).Select(row => row.Row!).ToArray();
            return new BomEvidenceSubject(group.Key, HashCanonical(group.Key, current), current, current.Length == 0,
                ["PUBLISHED_BOM", "BOM_EXEMPTION"], ["CATALOG_SOURCE_OWNER", "COORDINATION_SOURCE_OWNER"]);
        }).ToArray();
    }

    private static async Task<IReadOnlyList<QuotationEvidenceSubject>> ReadCoverageSubjectsAsync(
        MySqlCommand command, IReadOnlyList<string> factColumns)
    {
        var rows = await ReadCoverageRowsAsync(command, factColumns);
        return rows.GroupBy(row => row.SubjectId, StringComparer.Ordinal).Select(group =>
        {
            var current = group.Where(row => row.Row is not null).Select(row => row.Row!).ToArray();
            return new QuotationEvidenceSubject(group.Key, HashCanonical(group.Key, current), current, current.Length == 0,
                ["SUPPLIER_QUOTATION", "TIME_BOUND_EXCEPTION"], ["PURCHASING_SOURCE_OWNER"]);
        }).ToArray();
    }

    private static async Task<List<CoverageRow>> ReadCoverageRowsAsync(
        MySqlCommand command, IReadOnlyList<string> factColumns)
    {
        await using var reader = await command.ExecuteReaderAsync();
        var rows = new List<CoverageRow>();
        while (await reader.ReadAsync())
            rows.Add(new CoverageRow(reader.GetString("subjectId"), reader.IsDBNull(reader.GetOrdinal("rowId"))
                ? null
                : new StableEvidenceRow(reader.GetString("rowId"), reader.GetString("rowFingerprint").ToUpperInvariant(),
                    factColumns.ToDictionary(column => column,
                        column => reader.IsDBNull(reader.GetOrdinal(column)) ? null : Convert.ToString(reader[column])))));
        return rows;
    }

    private static async Task<IReadOnlyList<DuplicateEvidenceGroup>> ReadDuplicateGroupsAsync(
        MySqlConnection connection, string database)
    {
        await using var groupCommand = new MySqlCommand(
            $"""
            SELECT groupset.normalizedName, HEX(i.ingredientId) memberId
              FROM {Quote(database)}.ingredients i
              JOIN (
                SELECT LOWER(TRIM(ingredientName)) normalizedName
                  FROM {Quote(database)}.ingredients
                 WHERE isActive=1
                 GROUP BY LOWER(TRIM(ingredientName))
                HAVING COUNT(*)>1
              ) groupset ON groupset.normalizedName=LOWER(TRIM(i.ingredientName))
             WHERE i.isActive=1
             ORDER BY groupset.normalizedName,i.ingredientId;
            """, connection);
        var membersByName = new Dictionary<string, List<string>>(StringComparer.Ordinal);
        await using (var reader = await groupCommand.ExecuteReaderAsync())
            while (await reader.ReadAsync())
            {
                var name = reader.GetString("normalizedName");
                if (!membersByName.TryGetValue(name, out var members))
                    membersByName[name] = members = [];
                members.Add(reader.GetString("memberId"));
            }

        var result = new List<DuplicateEvidenceGroup>();
        foreach (var members in membersByName.Values)
        {
            var orderedMembers = members.Order(StringComparer.Ordinal).ToArray();
            var maps = new Dictionary<string, IReadOnlyList<StableConsumerReference>>(StringComparer.Ordinal);
            foreach (var surface in ConsumerSurfaceDefinitions)
                maps[surface.LogicalName] = await ReadConsumerReferencesAsync(connection, database, surface, orderedMembers);
            var groupId = HashText(string.Join("\n", orderedMembers));
            var fingerprint = HashText(string.Join("\n", maps.OrderBy(pair => pair.Key, StringComparer.Ordinal)
                .SelectMany(pair => pair.Value.Select(row => $"{pair.Key}|{row.RowId}|{row.IngredientId}"))));
            result.Add(new DuplicateEvidenceGroup(groupId, fingerprint, orderedMembers, maps,
                SourceScanClosed: true, RuntimeScanClosed: true,
                ["FULL_REFERENCE_MAP"],
                ["CATALOG_SOURCE_OWNER", "WAREHOUSE_IMPACT_OWNER", "PURCHASING_IMPACT_OWNER"]));
        }
        return result.OrderBy(group => group.GroupId, StringComparer.Ordinal).ToArray();
    }

    private static readonly ConsumerSurface[] ConsumerSurfaceDefinitions =
    [
        new("dishbom", "dishbom", "HEX(bomId)", "ingredientId"),
        new("materialrequestlines", "materialrequestlines", "HEX(requestLineId)", "ingredientId"),
        new("purchaserequestlines", "purchaserequestlines", "HEX(purchaseRequestLineId)", "ingredientId"),
        new("purchaseorderlines", "purchaseorderlines", "HEX(purchaseOrderLineId)", "ingredientId"),
        new("inventoryreceiptlines", "inventoryreceiptlines", "HEX(receiptLineId)", "ingredientId"),
        new("inventoryissuelines", "inventoryissuelines", "HEX(issueLineId)", "ingredientId"),
        new("inventoryreturnlines", "inventoryreturnlines", "HEX(returnLineId)", "ingredientId"),
        new("stockmovements", "stockmovements", "HEX(movementId)", "ingredientId"),
        new("currentstocks", "currentstock", "CONCAT(HEX(warehouseId),':',HEX(ingredientId))", "ingredientId"),
        new("currentstocklots", "currentstocklots", "HEX(lotStockId)", "ingredientId"),
        new("stocksnapshots", "stocksnapshots", "HEX(snapshotId)", "ingredientId"),
        new("stocktakelines", "stocktakelines", "HEX(lineId)", "ingredientId"),
        new("supplierquotations", "supplierquotations", "HEX(quotationId)", "ingredientId"),
        new("unitnormalizationreviews", "unitnormalizationreviews", "HEX(reviewId)", "ingredientId"),
        new("dataqualitydispositions", "dataqualitydispositions", "HEX(dispositionId)", "sourceEntityId")
    ];

    private static async Task<IReadOnlyList<StableConsumerReference>> ReadConsumerReferencesAsync(
        MySqlConnection connection,
        string database,
        ConsumerSurface surface,
        IReadOnlyList<string> members)
    {
        var parameters = members.Select((_, index) => $"@member{index}").ToArray();
        var sql = $"SELECT {surface.RowIdSql} rowId, HEX({QuoteName(surface.IngredientColumn)}) ingredientId " +
                  $"FROM {Quote(database)}.{QuoteName(surface.TableName)} WHERE HEX({QuoteName(surface.IngredientColumn)}) " +
                  $"IN ({string.Join(',', parameters)}) ORDER BY ingredientId,rowId;";
        await using var command = new MySqlCommand(sql, connection);
        for (var index = 0; index < members.Count; index++)
            command.Parameters.AddWithValue(parameters[index], members[index]);
        await using var reader = await command.ExecuteReaderAsync();
        var result = new List<StableConsumerReference>();
        while (await reader.ReadAsync())
            result.Add(new StableConsumerReference(reader.GetString("rowId"), reader.GetString("ingredientId")));
        return result;
    }

    private static void ValidateSubjects(string family, IReadOnlyList<BusinessEvidenceSubject> rows, ICollection<string> issues)
    {
        ValidateUniqueStableIds(family, rows.Select(row => row.SourceEntityId), issues);
        foreach (var row in rows)
        {
            ValidateStableIdAndFingerprint(family, row.SourceEntityId, row.CurrentFingerprint, issues);
            ValidateReferenceSlots(family, row.SourceEntityId, row.RequiredSourceReferenceTypes,
                row.RequiredAuthoritySlots, issues);
        }
    }

    private static void ValidateReferenceSlots(
        string family,
        string id,
        IReadOnlyList<string> sourceReferenceTypes,
        IReadOnlyList<string> authoritySlots,
        ICollection<string> issues)
    {
        if (sourceReferenceTypes.Count == 0 || sourceReferenceTypes.Any(string.IsNullOrWhiteSpace))
            issues.Add($"{family} {id} has no source-document reference slots.");
        if (authoritySlots.Count == 0 || authoritySlots.Any(string.IsNullOrWhiteSpace))
            issues.Add($"{family} {id} has no authority slots.");
    }

    private static void ValidateUniqueStableIds(string family, IEnumerable<string> ids, ICollection<string> issues)
    {
        var values = ids.ToArray();
        if (values.Distinct(StringComparer.Ordinal).Count() != values.Length)
            issues.Add($"{family} stable subject IDs are duplicated.");
    }

    private static void ValidateStableIdAndFingerprint(string family, string id, string fingerprint, ICollection<string> issues)
    {
        if (!IsStableId(id) || !IsSha256(fingerprint))
            issues.Add($"{family} subject {id} has an invalid stable ID or current fingerprint.");
    }

    private static void RequireCount(string family, int actual, int expected, ICollection<string> issues)
    {
        if (actual != expected)
            issues.Add($"Expected exactly {expected:N0} {family} subjects but found {actual:N0}.");
    }

    private static bool IsStableId(string value) => Regex.IsMatch(value ?? string.Empty, "^[A-Fa-f0-9]{32}$");
    private static bool IsSha256(string value) => Regex.IsMatch(value ?? string.Empty, "^[A-Fa-f0-9]{64}$");
    private static string HashCanonical(string subjectId, IReadOnlyList<StableEvidenceRow> rows)
        => HashText(subjectId + "\n" + string.Join("\n", rows.OrderBy(row => row.RowId, StringComparer.Ordinal)
            .Select(row => $"{row.RowId}|{row.CurrentFingerprint}|{string.Join(',', row.Facts.OrderBy(pair => pair.Key).Select(pair => $"{pair.Key}={pair.Value}"))}")));
    private static string HashText(string text) => Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(text)));
    private static string Quote(string database) => QuoteName(database);
    private static string QuoteName(string identifier) => $"`{identifier.Replace("`", "``", StringComparison.Ordinal)}`";

    private static async Task<string> ScalarStringAsync(MySqlConnection connection, string sql)
    {
        await using var command = new MySqlCommand(sql, connection);
        return Convert.ToString(await command.ExecuteScalarAsync())
            ?? throw new InvalidOperationException("Required scalar value is missing.");
    }

    private sealed record MenuSeed(string Id, string Fingerprint, byte[]? MenuVersionId, byte[]? CustomerId, DateTime ServiceDate);
    private sealed record CoverageRow(string SubjectId, StableEvidenceRow? Row);
    private sealed record ConsumerSurface(string LogicalName, string TableName, string RowIdSql, string IngredientColumn);
}
