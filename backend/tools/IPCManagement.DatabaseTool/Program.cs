using System.Text.Json;
using IPCManagement.DatabaseTool;
using MySqlConnector;

if (args.Length == 15 &&
    args[0] == "phase42-rehearse" &&
    args[1] == "--settings" &&
    args[3] == "--request" &&
    args[5] == "--preflight" &&
    args[7] == "--apply" &&
    args[9] == "--postflight" &&
    args[11] == "--rollback" &&
    args[13] == "--manifest")
{
    try
    {
        var requestPath = Path.GetFullPath(args[4]);
        var request = JsonSerializer.Deserialize<Phase42RehearsalRequest>(
                await File.ReadAllBytesAsync(requestPath),
                new JsonSerializerOptions { PropertyNameCaseInsensitive = true })
            ?? throw new InvalidOperationException("Phase 4.2 rehearsal request is empty.");
        Phase42DisposableRehearsalCommand.ValidateRequest(request);
        Phase42DisposableRehearsalCommand.ValidateAdministrativeCommand(
            $"phase42-rehearse --source {request.SourceDatabase} --target {request.TargetDatabase} --run-id {request.RunId}");

        var artifacts = new Phase42RehearsalArtifacts(
            Path.GetFullPath(args[6]),
            Path.GetFullPath(args[8]),
            Path.GetFullPath(args[10]),
            Path.GetFullPath(args[12]),
            Path.GetFullPath(args[14]));
        await using var connection = await OpenServerConnectionAsync(Path.GetFullPath(args[2]));
        var operations = new MySqlPhase42DisposableRehearsalOperations(connection, request, artifacts);
        var result = await Phase42DisposableRehearsalCommand.ExecuteAsync(request, operations);
        Console.WriteLine(JsonSerializer.Serialize(result));
        return 0;
    }
    catch (Exception exception)
    {
        Console.Error.WriteLine($"Phase 4.2 disposable rehearsal failed: {exception.Message}");
        return 1;
    }
}

if (args.Length == 7 &&
    args[0] == "backup-table-retirement" &&
    args[1] == "--mode" &&
    args[3] == "--target" &&
    args[5] == "--sql")
{
    try
    {
        var mode = args[2];
        var target = args[4];
        BackupTableRetirementCommand.ValidateModeTarget(mode, target);
        var sql = await File.ReadAllTextAsync(Path.GetFullPath(args[6]));
        if (string.Equals(mode, "apply", StringComparison.OrdinalIgnoreCase))
        {
            BackupTableRetirementCommand.ValidateDropSql(sql);
        }
        Console.WriteLine(JsonSerializer.Serialize(new
        {
            Status = "RETIREMENT_CONTRACT_VALIDATED",
            Mode = mode,
            Target = target,
            MutationStatements = 0,
        }));
        return 0;
    }
    catch (Exception exception)
    {
        Console.Error.WriteLine($"Backup-table retirement validation failed: {exception.Message}");
        return 1;
    }
}

if ((args.Length == 5 || args.Length == 7) &&
    args[0] == "data-quality-classify" &&
    args[1] == "--settings" &&
    args[3] == "--database" &&
    (args.Length == 5 || args[5] == "--output"))
{
    var classificationSettingsPath = Path.GetFullPath(args[2]);
    var classificationDatabase = args[4];
    try
    {
        DatabaseClonePolicy.ValidateRemediationEvidenceTarget(classificationDatabase);
        await using var connection = await OpenServerConnectionAsync(classificationSettingsPath);
        var outputPath = args.Length == 7 ? args[6] : null;
        return await DataQualityClassificationCommand.ExecuteAsync(connection, classificationDatabase, outputPath);
    }
    catch (Exception exception)
    {
        Console.Error.WriteLine($"Data-quality classification failed: {exception.Message}");
        return 1;
    }
}

if (args.Length == 5 &&
    args[0] == "lineage-preflight" &&
    args[1] == "--settings" &&
    args[3] == "--database")
{
    var preflightSettingsPath = Path.GetFullPath(args[2]);
    var database = args[4];
    try
    {
        DatabaseClonePolicy.ValidateEvidenceTarget(database);
        await using var connection = await OpenServerConnectionAsync(preflightSettingsPath);
        await using var command = new MySqlCommand(
            $"""
            SELECT
              (SELECT COUNT(*) FROM {Quote(database)}.{Quote("__EFMigrationsHistory")}
               WHERE MigrationId = '20260809123338_AddInventoryReturnLineSourceIssueLine') AS returnLineageMigrationApplied,
              (SELECT COUNT(*) FROM {Quote(database)}.{Quote("__EFMigrationsHistory")}
               WHERE MigrationId = '20260809125931_AddInventoryIssueLineMaterialRequestSource') AS issueLineageMigrationApplied,
              (SELECT COUNT(*) FROM {Quote(database)}.{Quote("inventoryissuelines")}) AS issueLineCount,
              (SELECT COUNT(*) FROM {Quote(database)}.{Quote("inventoryreturnlines")}) AS returnLineCount,
              (SELECT COUNT(*) FROM (
                 SELECT iil.issueLineId
                 FROM {Quote(database)}.{Quote("inventoryissuelines")} AS iil
                 LEFT JOIN {Quote(database)}.{Quote("inventoryissues")} AS ii ON ii.issueId = iil.issueId
                 LEFT JOIN {Quote(database)}.{Quote("materialrequestlines")} AS mrl
                   ON mrl.requestId = ii.materialRequestId
                  AND mrl.ingredientId = iil.ingredientId
                  AND mrl.unitId = iil.unitId
                 GROUP BY iil.issueLineId
                 HAVING COUNT(mrl.requestLineId) <> 1
               ) AS ambiguous) AS ambiguousIssueLineCount,
              (SELECT COUNT(*) FROM (
                 SELECT iil.issueLineId
                 FROM {Quote(database)}.{Quote("inventoryissuelines")} AS iil
                 LEFT JOIN {Quote(database)}.{Quote("inventoryissues")} AS ii ON ii.issueId = iil.issueId
                 LEFT JOIN {Quote(database)}.{Quote("materialrequestlines")} AS mrl
                   ON mrl.requestId = ii.materialRequestId
                  AND mrl.ingredientId = iil.ingredientId
                  AND mrl.unitId = iil.unitId
                 GROUP BY iil.issueLineId
                 HAVING COUNT(mrl.requestLineId) = 0
               ) AS missing) AS missingDemandSourceCount,
              (SELECT COUNT(*) FROM (
                 SELECT iil.issueLineId
                 FROM {Quote(database)}.{Quote("inventoryissuelines")} AS iil
                 JOIN {Quote(database)}.{Quote("inventoryissues")} AS ii ON ii.issueId = iil.issueId
                 JOIN {Quote(database)}.{Quote("materialrequestlines")} AS mrl
                   ON mrl.requestId = ii.materialRequestId
                  AND mrl.ingredientId = iil.ingredientId
                  AND mrl.unitId = iil.unitId
                 GROUP BY iil.issueLineId
                 HAVING COUNT(mrl.requestLineId) > 1
               ) AS duplicate) AS duplicateDemandSourceCount;
            """,
            connection);
        await using var reader = await command.ExecuteReaderAsync();
        if (!await reader.ReadAsync())
        {
            throw new InvalidOperationException("Lineage preflight returned no row.");
        }

        Console.WriteLine(JsonSerializer.Serialize(new
        {
            Database = database,
            ReturnLineageMigrationApplied = reader.GetInt64("returnLineageMigrationApplied"),
            IssueLineageMigrationApplied = reader.GetInt64("issueLineageMigrationApplied"),
            IssueLineCount = reader.GetInt64("issueLineCount"),
            ReturnLineCount = reader.GetInt64("returnLineCount"),
            AmbiguousIssueLineCount = reader.GetInt64("ambiguousIssueLineCount"),
            MissingDemandSourceCount = reader.GetInt64("missingDemandSourceCount"),
            DuplicateDemandSourceCount = reader.GetInt64("duplicateDemandSourceCount"),
        }));
        return 0;
    }
    catch (Exception exception)
    {
        Console.Error.WriteLine($"Lineage preflight failed: {exception.Message}");
        return 1;
    }
}

if (args.Length == 5 &&
    args[0] == "lineage-preflight-details" &&
    args[1] == "--settings" &&
    args[3] == "--database")
{
    var preflightSettingsPath = Path.GetFullPath(args[2]);
    var database = args[4];
    try
    {
        DatabaseClonePolicy.ValidateEvidenceTarget(database);
        await using var connection = await OpenServerConnectionAsync(preflightSettingsPath);
        await using var command = new MySqlCommand(
            $"""
            SELECT HEX(iil.issueLineId) AS issueLineId,
                   ii.issueCode,
                   ii.issueDate,
                   ii.shiftName,
                   HEX(iil.ingredientId) AS ingredientId,
                   HEX(iil.unitId) AS unitId,
                   iil.issuedQty,
                   COUNT(mrl.requestLineId) AS matchingDemandLineCount
            FROM {Quote(database)}.{Quote("inventoryissuelines")} AS iil
            LEFT JOIN {Quote(database)}.{Quote("inventoryissues")} AS ii ON ii.issueId = iil.issueId
            LEFT JOIN {Quote(database)}.{Quote("materialrequestlines")} AS mrl
              ON mrl.requestId = ii.materialRequestId
             AND mrl.ingredientId = iil.ingredientId
             AND mrl.unitId = iil.unitId
            GROUP BY iil.issueLineId, ii.issueCode, ii.issueDate, ii.shiftName, iil.ingredientId, iil.unitId, iil.issuedQty
            HAVING COUNT(mrl.requestLineId) <> 1
            ORDER BY ii.issueDate, ii.issueCode, issueLineId;
            """,
            connection);
        await using var reader = await command.ExecuteReaderAsync();
        var rows = new List<object>();
        while (await reader.ReadAsync())
        {
            rows.Add(new
            {
                IssueLineId = reader.GetString("issueLineId"),
                IssueCode = reader.IsDBNull(reader.GetOrdinal("issueCode")) ? null : reader.GetString("issueCode"),
                IssueDate = reader.IsDBNull(reader.GetOrdinal("issueDate")) ? null : reader.GetDateTime("issueDate").ToString("yyyy-MM-dd"),
                ShiftName = reader.IsDBNull(reader.GetOrdinal("shiftName")) ? null : reader.GetString("shiftName"),
                IngredientId = reader.GetString("ingredientId"),
                UnitId = reader.GetString("unitId"),
                IssuedQty = reader.GetDecimal("issuedQty"),
                MatchingDemandLineCount = reader.GetInt64("matchingDemandLineCount"),
            });
        }
        Console.WriteLine(JsonSerializer.Serialize(new { Database = database, Rows = rows }));
        return 0;
    }
    catch (Exception exception)
    {
        Console.Error.WriteLine($"Lineage preflight details failed: {exception.Message}");
        return 1;
    }
}

if (args.Length == 5 &&
    args[0] == "supplemental-open-preflight" &&
    args[1] == "--settings" &&
    args[3] == "--database")
{
    var preflightSettingsPath = Path.GetFullPath(args[2]);
    var database = args[4];
    try
    {
        DatabaseClonePolicy.ValidateEvidenceTarget(database);
        await using var connection = await OpenServerConnectionAsync(preflightSettingsPath);
        await using var command = new MySqlCommand(
            $"""
            SELECT
              (SELECT COUNT(*) FROM {Quote(database)}.{Quote("__EFMigrationsHistory")}
               WHERE MigrationId = '20260809141103_AddOpenSupplementalRequestUniqueFence') AS openFenceMigrationApplied,
              (SELECT COUNT(*) FROM information_schema.columns
               WHERE table_schema = @database AND table_name = 'supplementalmaterialrequests'
                 AND column_name = 'openIssueLineId' AND generation_expression <> '') AS generatedOpenIssueLineColumnCount,
              (SELECT COUNT(*) FROM information_schema.statistics
               WHERE table_schema = @database AND table_name = 'supplementalmaterialrequests'
                 AND index_name = 'uxSupplementalMaterialRequestsOpenIssueLine' AND non_unique = 0) AS openIssueLineUniqueIndexCount,
              (SELECT COUNT(*)
               FROM {Quote(database)}.{Quote("supplementalmaterialrequests")}
               WHERE status NOT IN ('REJECTED', 'FULFILLED')) AS activeRequestCount,
              (SELECT COUNT(*)
               FROM (
                 SELECT issueLineId
                 FROM {Quote(database)}.{Quote("supplementalmaterialrequests")}
                 WHERE status NOT IN ('REJECTED', 'FULFILLED')
                 GROUP BY issueLineId
                 HAVING COUNT(*) > 1
               ) AS duplicateOpenIssueLines) AS duplicateOpenIssueLineCount;

            SELECT HEX(issueLineId) AS issueLineId,
                   COUNT(*) AS requestCount,
                   GROUP_CONCAT(requestCode ORDER BY requestedAt SEPARATOR ',') AS requestCodes,
                   GROUP_CONCAT(status ORDER BY requestedAt SEPARATOR ',') AS statuses
            FROM {Quote(database)}.{Quote("supplementalmaterialrequests")}
            WHERE status NOT IN ('REJECTED', 'FULFILLED')
            GROUP BY issueLineId
            HAVING COUNT(*) > 1
            ORDER BY requestCount DESC, issueLineId;
            """,
            connection);
        command.Parameters.AddWithValue("@database", database);
        await using var reader = await command.ExecuteReaderAsync();
        if (!await reader.ReadAsync())
        {
            throw new InvalidOperationException("Supplemental preflight returned no summary row.");
        }

        var openFenceMigrationApplied = reader.GetInt64("openFenceMigrationApplied");
        var generatedOpenIssueLineColumnCount = reader.GetInt64("generatedOpenIssueLineColumnCount");
        var openIssueLineUniqueIndexCount = reader.GetInt64("openIssueLineUniqueIndexCount");
        var activeRequestCount = reader.GetInt64("activeRequestCount");
        var duplicateOpenIssueLineCount = reader.GetInt64("duplicateOpenIssueLineCount");
        var rows = new List<object>();
        if (await reader.NextResultAsync())
        {
            while (await reader.ReadAsync())
            {
                rows.Add(new
                {
                    IssueLineId = reader.GetString("issueLineId"),
                    RequestCount = reader.GetInt64("requestCount"),
                    RequestCodes = reader.GetString("requestCodes").Split(',', StringSplitOptions.RemoveEmptyEntries),
                    Statuses = reader.GetString("statuses").Split(',', StringSplitOptions.RemoveEmptyEntries),
                });
            }
        }

        Console.WriteLine(JsonSerializer.Serialize(new
        {
            Database = database,
            OpenFenceMigrationApplied = openFenceMigrationApplied,
            GeneratedOpenIssueLineColumnCount = generatedOpenIssueLineColumnCount,
            OpenIssueLineUniqueIndexCount = openIssueLineUniqueIndexCount,
            ActiveRequestCount = activeRequestCount,
            DuplicateOpenIssueLineCount = duplicateOpenIssueLineCount,
            DuplicateGroups = rows,
        }));
        return 0;
    }
    catch (Exception exception)
    {
        Console.Error.WriteLine($"Supplemental open preflight failed: {exception.Message}");
        return 1;
    }
}

if (args.Length == 5 &&
    args[0] == "supplemental-open-concurrency-probe" &&
    args[1] == "--settings" &&
    args[3] == "--database")
{
    var probeSettingsPath = Path.GetFullPath(args[2]);
    var database = args[4];
    try
    {
        DatabaseClonePolicy.ValidateEvidenceTarget(database);
        if (database != "ipc_lane9")
        {
            throw new ArgumentException("Supplemental concurrency probe is restricted to ipc_lane9.");
        }

        await using var firstConnection = await OpenServerConnectionAsync(probeSettingsPath);
        await using var secondConnection = await OpenServerConnectionAsync(probeSettingsPath);
        await firstConnection.ChangeDatabaseAsync(database);
        await secondConnection.ChangeDatabaseAsync(database);

        var source = await ReadSupplementalConcurrencyProbeSourceAsync(firstConnection);
        if (source is null)
        {
            throw new InvalidOperationException("No issue line without an active supplemental request is available for the rollback-only probe.");
        }

        var firstRequestCode = $"CONC-{Guid.NewGuid():N}";
        var secondRequestCode = $"CONC-{Guid.NewGuid():N}";
        var outcome = "UNSET";

        await using var firstTransaction = await firstConnection.BeginTransactionAsync();
        MySqlTransaction? secondTransaction = null;
        try
        {
            await InsertSupplementalConcurrencyProbeAsync(firstConnection, firstTransaction, source, firstRequestCode);
            await ExecuteAsync(secondConnection, "SET SESSION innodb_lock_wait_timeout = 2;");
            secondTransaction = await secondConnection.BeginTransactionAsync();

            try
            {
                await InsertSupplementalConcurrencyProbeAsync(secondConnection, secondTransaction, source, secondRequestCode);
                outcome = "UNEXPECTED_SECOND_INSERT_SUCCEEDED";
            }
            catch (MySqlException exception) when (exception.Number == 1205)
            {
                outcome = "LOCK_WAIT_TIMEOUT";
            }
        }
        finally
        {
            if (secondTransaction is not null)
            {
                await secondTransaction.RollbackAsync();
            }

            await firstTransaction.RollbackAsync();
        }

        var residualRows = await ReadSupplementalProbeResidualRowsAsync(
            firstConnection,
            firstRequestCode,
            secondRequestCode);
        if (outcome != "LOCK_WAIT_TIMEOUT" || residualRows != 0)
        {
            throw new InvalidOperationException(
                $"Rollback-only supplemental concurrency probe failed: outcome={outcome}, residualRows={residualRows}.");
        }

        Console.WriteLine(JsonSerializer.Serialize(new
        {
            Database = database,
            Outcome = outcome,
            ResidualRows = residualRows,
            PersistedBusinessMutation = false,
        }));
        return 0;
    }
    catch (Exception exception)
    {
        Console.Error.WriteLine($"Supplemental open concurrency probe failed: {exception.Message}");
        return 1;
    }
}

if (args.Length == 7 &&
    args[0] == "weekly-menu-evidence" &&
    args[1] == "--settings" &&
    args[3] == "--database" &&
    args[5] == "--week")
{
    var evidenceSettingsPath = Path.GetFullPath(args[2]);
    var evidenceDatabase = args[4];
    if (!DateOnly.TryParseExact(args[6], "yyyy-MM-dd", out var evidenceWeek))
    {
        Console.Error.WriteLine("Weekly-menu evidence week must use yyyy-MM-dd.");
        return 2;
    }

    try
    {
        DatabaseClonePolicy.ValidateEvidenceTarget(evidenceDatabase);
        await using var connection = await OpenServerConnectionAsync(evidenceSettingsPath);
        await using var command = new MySqlCommand(
            $"""
            SELECT customer.customerCode,
                   COUNT(DISTINCT version.menuVersionId) AS menuVersionCount,
                   COUNT(DISTINCT schedule.menuScheduleId) AS menuScheduleCount,
                   COUNT(DISTINCT tier.tierId) AS tierCount,
                   COALESCE(GROUP_CONCAT(DISTINCT version.status ORDER BY version.status SEPARATOR ','), '') AS statuses
            FROM {Quote(evidenceDatabase)}.{Quote("customers")} AS customer
            LEFT JOIN {Quote(evidenceDatabase)}.{Quote("menuversions")} AS version
                ON version.customerId = customer.customerId
               AND version.weekStartDate = @week
            LEFT JOIN {Quote(evidenceDatabase)}.{Quote("menuschedules")} AS schedule
                ON schedule.customerId = customer.customerId
               AND schedule.weekStartDate = @week
            LEFT JOIN {Quote(evidenceDatabase)}.{Quote("customerweekmenutiers")} AS tier
                ON tier.customerId = customer.customerId
               AND tier.weekStartDate = @week
            WHERE customer.customerCode IN ('ANV', 'DAV')
            GROUP BY customer.customerCode
            ORDER BY customer.customerCode;
            """,
            connection);
        command.Parameters.AddWithValue("@week", evidenceWeek.ToDateTime(TimeOnly.MinValue));
        await using var reader = await command.ExecuteReaderAsync();
        var customers = new List<object>();
        while (await reader.ReadAsync())
        {
            customers.Add(new
            {
                CustomerCode = reader.GetString("customerCode"),
                MenuVersionCount = reader.GetInt32("menuVersionCount"),
                MenuScheduleCount = reader.GetInt32("menuScheduleCount"),
                TierCount = reader.GetInt32("tierCount"),
                Statuses = reader.GetString("statuses")
            });
        }

        Console.WriteLine(JsonSerializer.Serialize(new
        {
            Database = evidenceDatabase,
            WeekStartDate = evidenceWeek.ToString("yyyy-MM-dd"),
            Customers = customers
        }));
        return 0;
    }
    catch (Exception exception)
    {
        Console.Error.WriteLine($"Weekly-menu evidence failed: {exception.Message}");
        return 1;
    }
}

if (args.Length == 5 &&
    args[0] == "lifecycle-evidence" &&
    args[1] == "--settings" &&
    args[3] == "--database")
{
    var evidenceSettingsPath = Path.GetFullPath(args[2]);
    var evidenceDatabase = args[4];
    try
    {
        DatabaseClonePolicy.ValidateEvidenceTarget(evidenceDatabase);
        await using var connection = await OpenServerConnectionAsync(evidenceSettingsPath);
        await using var command = new MySqlCommand(
            $"""
            SELECT
                (SELECT COUNT(*)
                 FROM {Quote(evidenceDatabase)}.{Quote("inventoryissues")}
                 WHERE issueCode = 'ISS-20260804-200023-2BB4' AND receivedAt IS NOT NULL) AS receivedIssueCount,
                (SELECT COUNT(*)
                 FROM {Quote(evidenceDatabase)}.{Quote("inventoryissuelines")} AS line
                 INNER JOIN {Quote(evidenceDatabase)}.{Quote("inventoryissues")} AS issue ON issue.issueId = line.issueId
                 WHERE issue.issueCode = 'ISS-20260804-200023-2BB4') AS issueLineCount,
                (SELECT COUNT(*)
                 FROM {Quote(evidenceDatabase)}.{Quote("inventoryreturns")}
                 WHERE reason = 'E2E controlled clean surplus return.' AND receivedAt IS NOT NULL) AS receivedReturnCount,
                (SELECT COUNT(*)
                 FROM {Quote(evidenceDatabase)}.{Quote("supplementalmaterialrequests")}
                 WHERE reason = 'E2E controlled supplemental request after signed receipt.'
                   AND status = 'FULFILLED') AS fulfilledSupplementalCount;
            """,
            connection);
        await using var reader = await command.ExecuteReaderAsync();
        if (!await reader.ReadAsync())
        {
            throw new InvalidOperationException("Lifecycle evidence query returned no row.");
        }

        Console.WriteLine(JsonSerializer.Serialize(new
        {
            Database = evidenceDatabase,
            ReceivedIssueCount = reader.GetInt32("receivedIssueCount"),
            IssueLineCount = reader.GetInt32("issueLineCount"),
            ReceivedReturnCount = reader.GetInt32("receivedReturnCount"),
            FulfilledSupplementalCount = reader.GetInt32("fulfilledSupplementalCount")
        }));
        return 0;
    }
    catch (Exception exception)
    {
        Console.Error.WriteLine($"Lifecycle evidence failed: {exception.Message}");
        return 1;
    }
}

if ((args.Length == 5 || args.Length == 7) &&
    args[0] == "service-run-fixture" &&
    args[1] == "--settings" &&
    args[3] == "--database" &&
    (args.Length == 5 || args[5] == "--scenario"))
{
    var fixtureSettingsPath = Path.GetFullPath(args[2]);
    var fixtureDatabase = args[4];
    var fixtureScenario = args.Length == 7 ? args[6] : "happy";
    try
    {
        DatabaseClonePolicy.ValidateEvidenceTarget(fixtureDatabase);
        await using var connection = await OpenServerConnectionAsync(fixtureSettingsPath);
        var fixtureCodes = fixtureScenario switch
        {
            "happy" => ("KHSX-E2E-SERVICE-RUN-20260808", "MR-E2E-SERVICE-RUN-20260808", "ISS-E2E-SERVICE-RUN-20260808"),
            "variance-waiver" => ("KHSX-E2E-SERVICE-RUN-WAIVER-20260808", "MR-E2E-SERVICE-RUN-WAIVER-20260808", "ISS-E2E-SERVICE-RUN-WAIVER-20260808"),
            "variance-resolution" => ("KHSX-E2E-SERVICE-RUN-VARIANCE-20260808", "MR-E2E-SERVICE-RUN-VARIANCE-20260808", "ISS-E2E-SERVICE-RUN-VARIANCE-20260808"),
            _ => throw new ArgumentException("Service-run fixture scenario không hợp lệ."),
        };
        var existing = await ReadServiceRunFixtureAsync(connection, fixtureDatabase, fixtureCodes.Item1, fixtureCodes.Item2, fixtureCodes.Item3);
        if (existing is not null)
        {
            Console.WriteLine(JsonSerializer.Serialize(new { Database = fixtureDatabase, Fixture = existing, Reused = true }));
            return 0;
        }

        var source = await ReadServiceRunFixtureSourceAsync(connection, fixtureDatabase)
            ?? throw new InvalidOperationException("Không tìm thấy dòng KHSX đã chốt có BOM để tạo fixture Ca phục vụ.");
        var warehouseId = await ReadFirstWarehouseIdAsync(connection, fixtureDatabase)
            ?? throw new InvalidOperationException("Không tìm thấy kho để cấp fixture Ca phục vụ.");
        var fixture = new ServiceRunFixture(Guid.NewGuid().ToByteArray(), Guid.NewGuid().ToByteArray(), Guid.NewGuid().ToByteArray(), Guid.NewGuid().ToByteArray(), Guid.NewGuid().ToByteArray(),
            fixtureCodes.Item1, fixtureCodes.Item2, fixtureCodes.Item3);
        var now = DateTime.UtcNow;

        await using var transaction = await connection.BeginTransactionAsync();
        try
        {
            await ExecuteFixtureAsync(connection, transaction, $"""
                INSERT INTO {Quote(fixtureDatabase)}.{Quote("productionplans")}
                    (planId, planCode, planDate, customerId, weekStartDate, menuVersionId, status, createdBy, createdAt, updatedAt, sentToKitchenAt, sentToKitchenBy)
                VALUES (@planId, @planCode, @planDate, @customerId, @weekStartDate, @menuVersionId, @planStatus, @createdBy, @now, @now, @now, @createdBy);
                INSERT INTO {Quote(fixtureDatabase)}.{Quote("productionplanlines")}
                    (planLineId, planId, quantityPlanLineId, customerId, menuId, dishId, shiftName, totalServings)
                VALUES (@planLineId, @planId, @quantityPlanLineId, @customerId, @menuId, @dishId, 'MORNING', @totalServings);
                INSERT INTO {Quote(fixtureDatabase)}.{Quote("materialrequests")}
                    (requestId, requestCode, planId, requestDate, requestScope, status, createdBy, approvedBy, approvedAt)
                VALUES (@requestId, @requestCode, @planId, @planDate, 'MORNING', @requestStatus, @createdBy, @createdBy, @now);
                """, source, fixture, warehouseId, now);
            await ExecuteFixtureAsync(connection, transaction, $"""
                INSERT INTO {Quote(fixtureDatabase)}.{Quote("materialrequestlines")}
                    (requestLineId, requestId, planLineId, ingredientId, unitId, bomId, priceTierAmount, bomScope, totalServings, grossQtyPerServing, bomRatePercent, appliedPortionRuleId, appliedPortionRuleSource, appliedPortionRatePercent, yieldLossPercent, totalRequiredQty, currentStockQty, suggestedPurchaseQty)
                SELECT UUID_TO_BIN(UUID()), @requestId, @planLineId, ingredientId, unitId, bomId, priceTierAmount, bomScope, totalServings, grossQtyPerServing, bomRatePercent, appliedPortionRuleId, appliedPortionRuleSource, appliedPortionRatePercent, yieldLossPercent, totalRequiredQty, totalRequiredQty, 0
                FROM {Quote(fixtureDatabase)}.{Quote("materialrequestlines")}
                WHERE planLineId = @sourcePlanLineId AND bomId IS NOT NULL;
                INSERT INTO {Quote(fixtureDatabase)}.{Quote("inventoryissues")}
                    (issueId, issueCode, issueDate, shiftName, warehouseId, materialRequestId, issuedBy, receivedBy, receivedAt, createdAt)
                VALUES (@issueId, @issueCode, @planDate, 'MORNING', @warehouseId, @requestId, @createdBy, @createdBy, @now, @now);
                INSERT INTO {Quote(fixtureDatabase)}.{Quote("inventoryissuelines")}
                    (issueLineId, issueId, ingredientId, unitId, requestedQty, issuedQty)
                SELECT UUID_TO_BIN(UUID()), @issueId, ingredientId, unitId, totalRequiredQty, totalRequiredQty
                FROM {Quote(fixtureDatabase)}.{Quote("materialrequestlines")} WHERE requestId = @requestId;
                """, source, fixture, warehouseId, now);
            await transaction.CommitAsync();
        }
        catch
        {
            await transaction.RollbackAsync();
            throw;
        }

        Console.WriteLine(JsonSerializer.Serialize(new { Database = fixtureDatabase, Fixture = fixture, Reused = false }));
        return 0;
    }
    catch (Exception exception)
    {
        Console.Error.WriteLine($"Service-run fixture failed: {exception.Message}");
        return 1;
    }
}

if (args.Length >= 5 && (args.Length - 5) % 2 == 0 &&
    args[0] == "service-run-evidence" &&
    args[1] == "--settings" &&
    args[3] == "--database")
{
    var evidenceSettingsPath = Path.GetFullPath(args[2]);
    var evidenceDatabase = args[4];
    try
    {
        var evidenceOptions = args.Skip(5).Chunk(2).ToDictionary(pair => pair[0], pair => pair[1], StringComparer.Ordinal);
        if (evidenceOptions.Keys.Any(option => option is not "--scenario" and not "--plan-code" and not "--output")) throw new ArgumentException("Service-run evidence option không hợp lệ.");
        var evidenceScenario = evidenceOptions.GetValueOrDefault("--scenario") ?? "happy";
        DatabaseClonePolicy.ValidateEvidenceTarget(evidenceDatabase);
        var planCode = evidenceOptions.GetValueOrDefault("--plan-code") ?? evidenceScenario switch
        {
            "happy" => "KHSX-E2E-SERVICE-RUN-20260808",
            "variance-waiver" => "KHSX-E2E-SERVICE-RUN-WAIVER-20260808",
            "variance-resolution" => "KHSX-E2E-SERVICE-RUN-VARIANCE-20260808",
            _ => throw new ArgumentException("Service-run evidence scenario không hợp lệ."),
        };
        await using var connection = await OpenServerConnectionAsync(evidenceSettingsPath);
        await using var command = new MySqlCommand($"""
            SELECT run.status, run.actualServings, run.actualServingsReason, run.serviceConfirmationWaivedAt, run.serviceConfirmationWaiverReason, run.closedAt, run.closeSnapshotJson IS NOT NULL AS hasCloseSnapshot,
                   COUNT(DISTINCT adjustment.serviceRunAdjustmentId) AS adjustmentCount,
                   COUNT(DISTINCT CASE WHEN audit.entityName = 'ServiceRun' AND audit.fieldName = 'Close' THEN audit.auditId END) AS closeAuditCount,
                   COUNT(DISTINCT CASE WHEN audit.entityName = 'ServiceRun' AND audit.fieldName = 'ActualServings' THEN audit.auditId END) AS actualServingsAuditCount,
                   COUNT(DISTINCT CASE WHEN audit.entityName = 'ServiceRun' AND audit.fieldName = 'ServiceConfirmationWaived' THEN audit.auditId END) AS waiverAuditCount,
                   COUNT(DISTINCT CASE WHEN audit.entityName = 'ServiceRunAdjustment' AND audit.fieldName = 'ActualServingsCorrection' THEN audit.auditId END) AS correctionAuditCount
            FROM {Quote(evidenceDatabase)}.{Quote("serviceruns")} AS run
            INNER JOIN {Quote(evidenceDatabase)}.{Quote("productionplans")} AS plan ON plan.planId = run.planId
            LEFT JOIN {Quote(evidenceDatabase)}.{Quote("servicerunadjustments")} AS adjustment ON adjustment.serviceRunId = run.serviceRunId
            LEFT JOIN {Quote(evidenceDatabase)}.{Quote("auditlogs")} AS audit ON audit.entityId IN (run.serviceRunId, adjustment.serviceRunAdjustmentId)
            WHERE plan.planCode = @planCode AND run.shiftName = 'MORNING'
            GROUP BY run.status, run.actualServings, run.actualServingsReason, run.serviceConfirmationWaivedAt, run.serviceConfirmationWaiverReason, run.closedAt, run.closeSnapshotJson
            ORDER BY run.closedAt DESC LIMIT 1;
            """, connection);
        command.Parameters.AddWithValue("@planCode", planCode);
        await using var reader = await command.ExecuteReaderAsync();
        if (!await reader.ReadAsync()) throw new InvalidOperationException("Không tìm thấy Ca phục vụ theo plan code để lấy evidence.");
        var serializedEvidence = JsonSerializer.Serialize(new
        {
            Database = evidenceDatabase,
            Status = reader.GetString("status"),
            ActualServings = reader.IsDBNull(reader.GetOrdinal("actualServings")) ? (int?)null : reader.GetInt32("actualServings"),
            ActualServingsReason = reader.IsDBNull(reader.GetOrdinal("actualServingsReason")) ? null : reader.GetString("actualServingsReason"),
            IsServiceConfirmationWaived = !reader.IsDBNull(reader.GetOrdinal("serviceConfirmationWaivedAt")),
            ServiceConfirmationWaiverReason = reader.IsDBNull(reader.GetOrdinal("serviceConfirmationWaiverReason")) ? null : reader.GetString("serviceConfirmationWaiverReason"),
            IsClosed = !reader.IsDBNull(reader.GetOrdinal("closedAt")),
            HasCloseSnapshot = reader.GetInt64("hasCloseSnapshot") == 1,
            AdjustmentCount = reader.GetInt32("adjustmentCount"),
            CloseAuditCount = reader.IsDBNull(reader.GetOrdinal("closeAuditCount")) ? 0 : reader.GetInt32("closeAuditCount"),
            ActualServingsAuditCount = reader.IsDBNull(reader.GetOrdinal("actualServingsAuditCount")) ? 0 : reader.GetInt32("actualServingsAuditCount"),
            WaiverAuditCount = reader.IsDBNull(reader.GetOrdinal("waiverAuditCount")) ? 0 : reader.GetInt32("waiverAuditCount"),
            CorrectionAuditCount = reader.IsDBNull(reader.GetOrdinal("correctionAuditCount")) ? 0 : reader.GetInt32("correctionAuditCount"),
        });
        if (evidenceOptions.TryGetValue("--output", out var outputPath))
        {
            var fullOutputPath = Path.GetFullPath(outputPath);
            Directory.CreateDirectory(Path.GetDirectoryName(fullOutputPath) ?? throw new InvalidOperationException("Service-run evidence output path không hợp lệ."));
            await File.WriteAllTextAsync(fullOutputPath, serializedEvidence + Environment.NewLine);
        }
        Console.WriteLine(serializedEvidence);
        return 0;
    }
    catch (Exception exception)
    {
        Console.Error.WriteLine($"Service-run evidence failed: {exception.Message}");
        return 1;
    }
}

if (args.Length == 5 &&
    args[0] == "sanitize-e2e" &&
    args[1] == "--settings" &&
    args[3] == "--database")
{
    var sanitizeSettingsPath = Path.GetFullPath(args[2]);
    var database = args[4];
    try
    {
        DatabaseClonePolicy.ValidateSanitizeTarget(database);
        await using var connection = await OpenServerConnectionAsync(sanitizeSettingsPath);
        var transactionTables = DatabaseSanitizePolicy.TransactionTables;

        var importedMenuIdsTable = $"phase18_imported_menu_ids_{Environment.ProcessId}";
        await ExecuteAsync(connection, $"""
            CREATE TEMPORARY TABLE {Quote(importedMenuIdsTable)} (
                menuId BINARY(16) NOT NULL PRIMARY KEY
            );
            INSERT IGNORE INTO {Quote(importedMenuIdsTable)} (menuId)
            SELECT DISTINCT schedule.menuId
            FROM {Quote(database)}.{Quote("menuschedules")} AS schedule
            INNER JOIN {Quote(database)}.{Quote("menuversions")} AS version
                ON version.menuVersionId = schedule.menuVersionId
            WHERE schedule.menuVersionId IS NOT NULL
              AND (
                  COALESCE(version.sourceChecksum, '') <> '' OR
                  COALESCE(version.sourceImportBatch, '') <> ''
              );
            """);
        var importedMenuCount = await ReadScalarAsync(
            connection,
            $"SELECT COUNT(*) FROM {Quote(importedMenuIdsTable)};");

        await ExecuteAsync(connection, "SET FOREIGN_KEY_CHECKS=0;");
        try
        {
            foreach (var table in transactionTables)
            {
                await ExecuteAsync(connection, $"TRUNCATE TABLE {Quote(database)}.{Quote(table)};");
            }

            await ExecuteAsync(connection, $"""
                DELETE item
                FROM {Quote(database)}.{Quote("menuitems")} AS item
                INNER JOIN {Quote(importedMenuIdsTable)} AS imported
                    ON imported.menuId = item.menuId;
                DELETE menu
                FROM {Quote(database)}.{Quote("menus")} AS menu
                INNER JOIN {Quote(importedMenuIdsTable)} AS imported
                    ON imported.menuId = menu.menuId;
                """);
        }
        finally
        {
            await ExecuteAsync(connection, "SET FOREIGN_KEY_CHECKS=1;");
        }

        foreach (var table in transactionTables)
        {
            var count = await ReadRowCountAsync(connection, database, table);
            if (count != 0)
            {
                throw new InvalidOperationException($"E2E sanitization left {count} rows in {table}.");
            }
        }
        var importedMenusLeft = await ReadScalarAsync(
            connection,
            $"""
            SELECT COUNT(*)
            FROM {Quote(database)}.{Quote("menus")} AS menu
            INNER JOIN {Quote(importedMenuIdsTable)} AS imported ON imported.menuId = menu.menuId;
            """);
        var importedMenuItemsLeft = await ReadScalarAsync(
            connection,
            $"""
            SELECT COUNT(*)
            FROM {Quote(database)}.{Quote("menuitems")} AS item
            INNER JOIN {Quote(importedMenuIdsTable)} AS imported ON imported.menuId = item.menuId;
            """);
        var importedMenuArtifactsLeft = importedMenusLeft + importedMenuItemsLeft;
        if (importedMenuArtifactsLeft != 0)
        {
            throw new InvalidOperationException(
                $"E2E sanitization left {importedMenuArtifactsLeft} imported menu artifacts.");
        }

        Console.WriteLine($"SANITIZE={database}");
        Console.WriteLine($"TRANSACTION_TABLES={transactionTables.Count}");
        Console.WriteLine($"IMPORTED_MENUS_REMOVED={importedMenuCount}");
        Console.WriteLine("VERIFY=PASS");
        return 0;
    }
    catch (Exception exception)
    {
        Console.Error.WriteLine($"E2E sanitization failed: {exception.Message}");
        return 1;
    }
}

if (args.Length != 7 ||
    args[0] != "clone" ||
    args[1] != "--settings" ||
    args[3] != "--source" ||
    args[5] != "--target")
{
    Console.Error.WriteLine(
        "Usage: dotnet run --project IPCManagement.DatabaseTool -- clone --settings <appsettings.json> --source <database> --target <database>\n" +
        "   or: dotnet run --project IPCManagement.DatabaseTool -- sanitize-e2e --settings <appsettings.json> --database <ipc_laneN>\n" +
        "   or: dotnet run --project IPCManagement.DatabaseTool -- weekly-menu-evidence --settings <appsettings.json> --database <ipc_laneN|ipc_e2e_template> --week <yyyy-MM-dd>");
    return 2;
}

var settingsPath = Path.GetFullPath(args[2]);
var sourceDatabase = args[4];
var targetDatabase = args[6];

try
{
    DatabaseClonePolicy.ValidateTransition(sourceDatabase, targetDatabase);
    await using var connection = await OpenServerConnectionAsync(settingsPath);

    var sourceTables = await ReadTablesAsync(connection, sourceDatabase);
    if (sourceTables.Count == 0)
    {
        throw new InvalidOperationException($"Source database {sourceDatabase} has no base tables.");
    }
    await VerifyRequiredSchemaObjectsAsync(connection, sourceDatabase);

    var stagingDatabase = $"{targetDatabase}_clone_{Environment.ProcessId}";
    try
    {
        await CloneDatabaseAsync(connection, sourceDatabase, stagingDatabase, sourceTables);
        await VerifyCloneAsync(connection, sourceDatabase, stagingDatabase, sourceTables);
        await CloneDatabaseAsync(connection, stagingDatabase, targetDatabase, sourceTables);
        await VerifyCloneAsync(connection, sourceDatabase, targetDatabase, sourceTables);
    }
    finally
    {
        await ExecuteAsync(connection, $"DROP DATABASE IF EXISTS {Quote(stagingDatabase)};");
    }

    Console.WriteLine($"CLONE={sourceDatabase}->{targetDatabase}");
    Console.WriteLine($"TABLES={sourceTables.Count}");
    Console.WriteLine("VERIFY=PASS");
    return 0;
}
catch (Exception exception)
{
    Console.Error.WriteLine($"Database clone failed: {exception.Message}");
    return 1;
}

static async Task CloneDatabaseAsync(
    MySqlConnection connection,
    string sourceDatabase,
    string targetDatabase,
    IReadOnlyList<string> tables)
{
    var (characterSet, collation) = await ReadDatabaseCollationAsync(connection, sourceDatabase);
    var triggers = await ReadTriggersAsync(connection, sourceDatabase);
    var unsupportedSchemaObjects = await ReadUnsupportedSchemaObjectsAsync(connection, sourceDatabase);
    if (unsupportedSchemaObjects.Count > 0)
    {
        throw new InvalidOperationException(
            $"Clone does not support schema objects: {string.Join(", ", unsupportedSchemaObjects)}.");
    }
    await ExecuteAsync(
        connection,
        $"DROP DATABASE IF EXISTS {Quote(targetDatabase)}; " +
        $"CREATE DATABASE {Quote(targetDatabase)} CHARACTER SET {Quote(characterSet)} COLLATE {Quote(collation)}; " +
        "SET FOREIGN_KEY_CHECKS=0;");

    try
    {
        foreach (var table in tables)
        {
            var columns = await ReadPhysicalColumnsAsync(connection, sourceDatabase, table);
            if (columns.Count == 0)
            {
                throw new InvalidOperationException($"Table {sourceDatabase}.{table} has no writable columns.");
            }

            var sourceTable = $"{Quote(sourceDatabase)}.{Quote(table)}";
            var targetTable = $"{Quote(targetDatabase)}.{Quote(table)}";
            var columnList = string.Join(", ", columns.Select(Quote));
            var createTableSql = await ReadCreateTableSqlAsync(connection, sourceDatabase, table);
            var qualifiedCreateTableSql = QualifyCreateTableSql(createTableSql, targetDatabase, table);
            await ExecuteAsync(
                connection,
                $"{qualifiedCreateTableSql}; " +
                $"INSERT INTO {targetTable} ({columnList}) SELECT {columnList} FROM {sourceTable};",
                commandTimeout: 300);
        }

        foreach (var trigger in triggers)
        {
            await ExecuteAsync(connection, BuildCreateTriggerSql(targetDatabase, trigger));
        }
    }
    finally
    {
        await ExecuteAsync(connection, "SET FOREIGN_KEY_CHECKS=1;");
    }
}

static async Task VerifyCloneAsync(
    MySqlConnection connection,
    string sourceDatabase,
    string targetDatabase,
    IReadOnlyList<string> expectedTables)
{
    var targetTables = await ReadTablesAsync(connection, targetDatabase);
    if (!expectedTables.SequenceEqual(targetTables, StringComparer.Ordinal))
    {
        throw new InvalidOperationException("Target table inventory does not match the source database.");
    }

    foreach (var table in expectedTables)
    {
        var sourceCount = await ReadRowCountAsync(connection, sourceDatabase, table);
        var targetCount = await ReadRowCountAsync(connection, targetDatabase, table);
        if (sourceCount != targetCount)
        {
            throw new InvalidOperationException(
                $"Row count mismatch for {table}: source={sourceCount}, target={targetCount}.");
        }

        var sourceDefinition = NormalizeCreateTableSql(
            await ReadCreateTableSqlAsync(connection, sourceDatabase, table));
        var targetDefinition = NormalizeCreateTableSql(
            await ReadCreateTableSqlAsync(connection, targetDatabase, table));
        if (!string.Equals(sourceDefinition, targetDefinition, StringComparison.Ordinal))
        {
            throw new InvalidOperationException($"Table definition mismatch for {table}.");
        }
    }

    var sourceTriggers = await ReadTriggersAsync(connection, sourceDatabase);
    var targetTriggers = await ReadTriggersAsync(connection, targetDatabase);
    if (!sourceTriggers.SequenceEqual(targetTriggers))
    {
        throw new InvalidOperationException("Target trigger inventory does not match the source database.");
    }

    await VerifyRequiredSchemaObjectsAsync(connection, targetDatabase);
}

static async Task<string> ReadCreateTableSqlAsync(
    MySqlConnection connection,
    string database,
    string table)
{
    await using var command = new MySqlCommand(
        $"SHOW CREATE TABLE {Quote(database)}.{Quote(table)};",
        connection);
    await using var reader = await command.ExecuteReaderAsync();
    if (!await reader.ReadAsync())
    {
        throw new InvalidOperationException($"SHOW CREATE TABLE returned no row for {database}.{table}.");
    }

    return reader.GetString(1);
}

static string QualifyCreateTableSql(string createTableSql, string targetDatabase, string table)
{
    var prefix = $"CREATE TABLE {Quote(table)}";
    if (!createTableSql.StartsWith(prefix, StringComparison.Ordinal))
    {
        throw new InvalidOperationException($"Unexpected SHOW CREATE TABLE output for {table}.");
    }

    return $"CREATE TABLE {Quote(targetDatabase)}.{Quote(table)}{createTableSql[prefix.Length..]}";
}

static string NormalizeCreateTableSql(string createTableSql)
    => System.Text.RegularExpressions.Regex.Replace(
            createTableSql.Replace("\r\n", "\n", StringComparison.Ordinal),
            @"\sAUTO_INCREMENT=\d+",
            string.Empty,
            System.Text.RegularExpressions.RegexOptions.CultureInvariant)
        .Trim();

static async Task<IReadOnlyList<DatabaseTrigger>> ReadTriggersAsync(
    MySqlConnection connection,
    string database)
{
    const string sql = """
        SELECT trigger_name, event_manipulation, event_object_table, action_timing, action_statement
        FROM information_schema.triggers
        WHERE trigger_schema = @database
        ORDER BY trigger_name;
        """;
    await using var command = new MySqlCommand(sql, connection);
    command.Parameters.AddWithValue("@database", database);
    await using var reader = await command.ExecuteReaderAsync();
    var triggers = new List<DatabaseTrigger>();
    while (await reader.ReadAsync())
    {
        triggers.Add(new DatabaseTrigger(
            reader.GetString(0),
            reader.GetString(1),
            reader.GetString(2),
            reader.GetString(3),
            reader.GetString(4)));
    }

    return triggers;
}

static string BuildCreateTriggerSql(string targetDatabase, DatabaseTrigger trigger)
    => $"CREATE TRIGGER {Quote(targetDatabase)}.{Quote(trigger.Name)} " +
       $"{trigger.ActionTiming} {trigger.EventManipulation} " +
       $"ON {Quote(targetDatabase)}.{Quote(trigger.EventObjectTable)} " +
       $"FOR EACH ROW {trigger.ActionStatement};";

static async Task<IReadOnlyList<string>> ReadUnsupportedSchemaObjectsAsync(
    MySqlConnection connection,
    string database)
{
    const string sql = """
        SELECT object_type, object_name
        FROM (
            SELECT 'VIEW' object_type, table_name object_name
            FROM information_schema.views WHERE table_schema = @database
            UNION ALL
            SELECT routine_type object_type, routine_name object_name
            FROM information_schema.routines WHERE routine_schema = @database
            UNION ALL
            SELECT 'EVENT' object_type, event_name object_name
            FROM information_schema.events WHERE event_schema = @database
        ) objects
        ORDER BY object_type, object_name;
        """;
    await using var command = new MySqlCommand(sql, connection);
    command.Parameters.AddWithValue("@database", database);
    await using var reader = await command.ExecuteReaderAsync();
    var objects = new List<string>();
    while (await reader.ReadAsync())
    {
        objects.Add($"{reader.GetString(0)}:{reader.GetString(1)}");
    }

    return objects;
}

static async Task VerifyRequiredSchemaObjectsAsync(MySqlConnection connection, string database)
{
    var migrationApplied = await ReadScalarAsync(
        connection,
        $"SELECT COUNT(*) FROM {Quote(database)}.{Quote("__EFMigrationsHistory")} " +
        "WHERE MigrationId = '20260803210000_AddCustomerWeekMenuTier';");
    if (migrationApplied == 0)
    {
        return;
    }

    var triggers = await ReadTriggersAsync(connection, database);
    var requiredTriggers = new[]
    {
        "trg_customerweekmenutiers_immutable_update",
        "trg_menuschedules_tier_insert",
        "trg_menuschedules_tier_update",
    };
    var missing = requiredTriggers
        .Where(required => triggers.All(trigger => !string.Equals(trigger.Name, required, StringComparison.Ordinal)))
        .ToArray();
    if (missing.Length > 0)
    {
        throw new InvalidOperationException(
            $"Database {database} records the customer/week tier migration but is missing triggers: {string.Join(", ", missing)}.");
    }
}

static async Task<IReadOnlyList<string>> ReadTablesAsync(MySqlConnection connection, string database)
{
    const string sql = """
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = @database
          AND table_type = 'BASE TABLE'
        ORDER BY table_name;
        """;
    await using var command = new MySqlCommand(sql, connection);
    command.Parameters.AddWithValue("@database", database);
    await using var reader = await command.ExecuteReaderAsync();
    var tables = new List<string>();
    while (await reader.ReadAsync())
    {
        tables.Add(reader.GetString(0));
    }

    return tables;
}

static async Task<IReadOnlyList<string>> ReadPhysicalColumnsAsync(
    MySqlConnection connection,
    string database,
    string table)
{
    const string sql = """
        SELECT column_name
        FROM information_schema.columns
        WHERE table_schema = @database
          AND table_name = @table
          AND COALESCE(generation_expression, '') = ''
        ORDER BY ordinal_position;
        """;
    await using var command = new MySqlCommand(sql, connection);
    command.Parameters.AddWithValue("@database", database);
    command.Parameters.AddWithValue("@table", table);
    await using var reader = await command.ExecuteReaderAsync();
    var columns = new List<string>();
    while (await reader.ReadAsync())
    {
        columns.Add(reader.GetString(0));
    }

    return columns;
}

static async Task<(string CharacterSet, string Collation)> ReadDatabaseCollationAsync(
    MySqlConnection connection,
    string database)
{
    const string sql = """
        SELECT default_character_set_name, default_collation_name
        FROM information_schema.schemata
        WHERE schema_name = @database;
        """;
    await using var command = new MySqlCommand(sql, connection);
    command.Parameters.AddWithValue("@database", database);
    await using var reader = await command.ExecuteReaderAsync();
    if (!await reader.ReadAsync())
    {
        throw new InvalidOperationException($"Database {database} does not exist.");
    }

    return (reader.GetString(0), reader.GetString(1));
}

static async Task<long> ReadRowCountAsync(MySqlConnection connection, string database, string table)
{
    await using var command = new MySqlCommand(
        $"SELECT COUNT(*) FROM {Quote(database)}.{Quote(table)};",
        connection);
    return Convert.ToInt64(await command.ExecuteScalarAsync());
}

static async Task<long> ReadScalarAsync(MySqlConnection connection, string sql)
{
    await using var command = new MySqlCommand(sql, connection);
    return Convert.ToInt64(await command.ExecuteScalarAsync());
}

static async Task<ServiceRunFixture?> ReadServiceRunFixtureAsync(MySqlConnection connection, string database, string planCode, string requestCode, string issueCode)
{
    await using var command = new MySqlCommand($"SELECT planId, planCode FROM {Quote(database)}.{Quote("productionplans")} WHERE planCode = @planCode LIMIT 1;", connection);
    command.Parameters.AddWithValue("@planCode", planCode);
    await using var reader = await command.ExecuteReaderAsync();
    if (!await reader.ReadAsync()) return null;
    var planId = reader.GetFieldValue<byte[]>(reader.GetOrdinal("planId"));
    return new ServiceRunFixture(planId, [], [], [], [], reader.GetString(reader.GetOrdinal("planCode")), requestCode, issueCode);
}

static async Task<ServiceRunFixtureSource?> ReadServiceRunFixtureSourceAsync(MySqlConnection connection, string database)
{
    await using var command = new MySqlCommand($"""
        SELECT line.planLineId, line.quantityPlanLineId, line.customerId, line.menuId, line.dishId, plan.menuVersionId, plan.planDate, plan.weekStartDate, line.totalServings, plan.createdBy, plan.status, request.status
        FROM {Quote(database)}.{Quote("productionplans")} AS plan
        INNER JOIN {Quote(database)}.{Quote("productionplanlines")} AS line ON line.planId = plan.planId
        INNER JOIN {Quote(database)}.{Quote("materialrequestlines")} AS requestLine ON requestLine.planLineId = line.planLineId
        INNER JOIN {Quote(database)}.{Quote("materialrequests")} AS request ON request.requestId = requestLine.requestId
        WHERE plan.planCode = 'KHSX-ANV-20260808-FULLDAY' AND line.shiftName = 'MORNING' AND requestLine.bomId IS NOT NULL
        GROUP BY line.planLineId, line.quantityPlanLineId, line.customerId, line.menuId, line.dishId, plan.menuVersionId, plan.planDate, plan.weekStartDate, line.totalServings, plan.createdBy, plan.status, request.status
        ORDER BY line.planLineId LIMIT 1;
        """, connection);
    await using var reader = await command.ExecuteReaderAsync();
    if (!await reader.ReadAsync()) return null;
    return new ServiceRunFixtureSource(reader.GetFieldValue<byte[]>(0), reader.GetFieldValue<byte[]>(1), reader.GetFieldValue<byte[]>(2), reader.GetFieldValue<byte[]>(3), reader.GetFieldValue<byte[]>(4), reader.IsDBNull(5) ? null : reader.GetFieldValue<byte[]>(5), DateOnly.FromDateTime(reader.GetDateTime(6)), reader.IsDBNull(7) ? null : DateOnly.FromDateTime(reader.GetDateTime(7)), reader.GetInt32(8), reader.GetFieldValue<byte[]>(9), reader.GetString(10), reader.GetString(11));
}

static async Task<byte[]?> ReadFirstWarehouseIdAsync(MySqlConnection connection, string database)
{
    await using var command = new MySqlCommand($"SELECT warehouseId FROM {Quote(database)}.{Quote("warehouses")} ORDER BY warehouseId LIMIT 1;", connection);
    var value = await command.ExecuteScalarAsync();
    return value as byte[];
}

static async Task ExecuteFixtureAsync(MySqlConnection connection, MySqlTransaction transaction, string sql, ServiceRunFixtureSource source, ServiceRunFixture fixture, byte[] warehouseId, DateTime now)
{
    await using var command = new MySqlCommand(sql, connection, transaction);
    command.Parameters.AddWithValue("@planId", fixture.PlanId); command.Parameters.AddWithValue("@planLineId", fixture.PlanLineId); command.Parameters.AddWithValue("@requestId", fixture.RequestId); command.Parameters.AddWithValue("@issueId", fixture.IssueId);
    command.Parameters.AddWithValue("@planCode", fixture.PlanCode); command.Parameters.AddWithValue("@requestCode", fixture.RequestCode); command.Parameters.AddWithValue("@issueCode", fixture.IssueCode); command.Parameters.AddWithValue("@sourcePlanLineId", source.SourcePlanLineId);
    command.Parameters.AddWithValue("@quantityPlanLineId", source.QuantityPlanLineId); command.Parameters.AddWithValue("@customerId", source.CustomerId); command.Parameters.AddWithValue("@menuId", source.MenuId); command.Parameters.AddWithValue("@dishId", source.DishId); command.Parameters.AddWithValue("@menuVersionId", source.MenuVersionId); command.Parameters.AddWithValue("@planDate", source.PlanDate.ToDateTime(TimeOnly.MinValue)); command.Parameters.AddWithValue("@weekStartDate", source.WeekStartDate?.ToDateTime(TimeOnly.MinValue)); command.Parameters.AddWithValue("@totalServings", source.TotalServings); command.Parameters.AddWithValue("@createdBy", source.CreatedBy); command.Parameters.AddWithValue("@planStatus", source.PlanStatus); command.Parameters.AddWithValue("@requestStatus", source.RequestStatus); command.Parameters.AddWithValue("@warehouseId", warehouseId); command.Parameters.AddWithValue("@now", now);
    await command.ExecuteNonQueryAsync();
}

static async Task<SupplementalConcurrencyProbeSource?> ReadSupplementalConcurrencyProbeSourceAsync(
    MySqlConnection connection)
{
    const string sql = """
        SELECT issueDocument.issueId,
               issueLine.issueLineId,
               issueDocument.warehouseId,
               issueLine.ingredientId,
               issueLine.unitId,
               requester.userId
        FROM inventoryissuelines AS issueLine
        INNER JOIN inventoryissues AS issueDocument ON issueDocument.issueId = issueLine.issueId
        CROSS JOIN users AS requester
        WHERE requester.isActive = 1
          AND NOT EXISTS (
              SELECT 1
              FROM supplementalmaterialrequests AS existing
              WHERE existing.issueLineId = issueLine.issueLineId
                AND existing.status NOT IN ('REJECTED', 'FULFILLED'))
        ORDER BY issueDocument.issueDate, issueDocument.issueId, issueLine.issueLineId, requester.userId
        LIMIT 1;
        """;
    await using var command = new MySqlCommand(sql, connection);
    await using var reader = await command.ExecuteReaderAsync();
    if (!await reader.ReadAsync())
    {
        return null;
    }

    return new SupplementalConcurrencyProbeSource(
        reader.GetFieldValue<byte[]>(0),
        reader.GetFieldValue<byte[]>(1),
        reader.GetFieldValue<byte[]>(2),
        reader.GetFieldValue<byte[]>(3),
        reader.GetFieldValue<byte[]>(4),
        reader.GetFieldValue<byte[]>(5));
}

static async Task InsertSupplementalConcurrencyProbeAsync(
    MySqlConnection connection,
    MySqlTransaction transaction,
    SupplementalConcurrencyProbeSource source,
    string requestCode)
{
    const string sql = """
        INSERT INTO supplementalmaterialrequests
            (requestId, requestCode, issueId, issueLineId, warehouseId, ingredientId, unitId,
             requestedQty, reason, status, requestedBy, requestedAt)
        VALUES
            (@requestId, @requestCode, @issueId, @issueLineId, @warehouseId, @ingredientId, @unitId,
             1, 'Rollback-only database concurrency probe.', 'PENDING_WAREHOUSE_REVIEW', @requestedBy, UTC_TIMESTAMP());
        """;
    await using var command = new MySqlCommand(sql, connection, transaction);
    command.Parameters.AddWithValue("@requestId", Guid.NewGuid().ToByteArray());
    command.Parameters.AddWithValue("@requestCode", requestCode);
    command.Parameters.AddWithValue("@issueId", source.IssueId);
    command.Parameters.AddWithValue("@issueLineId", source.IssueLineId);
    command.Parameters.AddWithValue("@warehouseId", source.WarehouseId);
    command.Parameters.AddWithValue("@ingredientId", source.IngredientId);
    command.Parameters.AddWithValue("@unitId", source.UnitId);
    command.Parameters.AddWithValue("@requestedBy", source.RequestedBy);
    await command.ExecuteNonQueryAsync();
}

static async Task<long> ReadSupplementalProbeResidualRowsAsync(
    MySqlConnection connection,
    string firstRequestCode,
    string secondRequestCode)
{
    const string sql = """
        SELECT COUNT(*)
        FROM supplementalmaterialrequests
        WHERE requestCode IN (@firstRequestCode, @secondRequestCode);
        """;
    await using var command = new MySqlCommand(sql, connection);
    command.Parameters.AddWithValue("@firstRequestCode", firstRequestCode);
    command.Parameters.AddWithValue("@secondRequestCode", secondRequestCode);
    return Convert.ToInt64(await command.ExecuteScalarAsync());
}

static async Task ExecuteAsync(MySqlConnection connection, string sql, int commandTimeout = 120)
{
    await using var command = new MySqlCommand(sql, connection)
    {
        CommandTimeout = commandTimeout
    };
    await command.ExecuteNonQueryAsync();
}

static async Task<MySqlConnection> OpenServerConnectionAsync(string settingsPath)
{
    if (!File.Exists(settingsPath))
    {
        throw new FileNotFoundException("Appsettings file was not found.", settingsPath);
    }

    using var settings = JsonDocument.Parse(await File.ReadAllTextAsync(settingsPath));
    var sourceConnectionString = settings.RootElement
        .GetProperty("ConnectionStrings")
        .GetProperty("DefaultConnection")
        .GetString() ?? throw new InvalidOperationException("DefaultConnection is missing.");
    var connectionBuilder = new MySqlConnectionStringBuilder(sourceConnectionString)
    {
        Database = "mysql"
    };
    var connection = new MySqlConnection(connectionBuilder.ConnectionString);
    await connection.OpenAsync();
    return connection;
}

static string Quote(string identifier) => $"`{identifier.Replace("`", "``")}`";

sealed record ServiceRunFixture(byte[] PlanId, byte[] PlanLineId, byte[] RequestId, byte[] IssueId, byte[] SourcePlanLineId, string PlanCode, string RequestCode, string IssueCode);
sealed record ServiceRunFixtureSource(byte[] SourcePlanLineId, byte[] QuantityPlanLineId, byte[] CustomerId, byte[] MenuId, byte[] DishId, byte[]? MenuVersionId, DateOnly PlanDate, DateOnly? WeekStartDate, int TotalServings, byte[] CreatedBy, string PlanStatus, string RequestStatus);
sealed record SupplementalConcurrencyProbeSource(byte[] IssueId, byte[] IssueLineId, byte[] WarehouseId, byte[] IngredientId, byte[] UnitId, byte[] RequestedBy);
sealed record DatabaseTrigger(string Name, string EventManipulation, string EventObjectTable, string ActionTiming, string ActionStatement);
