using System.Data;
using System.Data.Common;
using System.Diagnostics;
using System.Globalization;
using System.IO.Compression;
using System.Text.Json;
using System.Text.RegularExpressions;
using System.Xml.Linq;
using IPCManagement.Api.Data;
using IPCManagement.Api.Data.Transactions;
using IPCManagement.Api.Features.Reconciliation.Contracts;
using IPCManagement.Api.Features.Reconciliation.Services;
using IPCManagement.Api.Features.SampleData.Contracts;
using IPCManagement.Api.Features.SampleData.Services;
using IPCManagement.Api.Features.SystemOperation.Services;
using IPCManagement.Api.Helpers;
using IPCManagement.Api.Models.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using MySqlConnector;

namespace IPCManagement.Api.Tests.Integration;

[Trait("Category", "EvidenceOwned")]
public sealed class MrxExportConsistencyMySqlTests
{
    [Fact]
    public async Task Export_and_real_source_writers_preserve_one_view_at_observed_boundaries()
    {
        var run = Environment.GetEnvironmentVariable("MRX_EVIDENCE_RUN_ID") ?? "";
        var connection = new MySqlConnectionStringBuilder(Environment.GetEnvironmentVariable("IPC_MRX_TARGET_CONNECTION_STRING") ?? "");
        Assert.Matches("^[0-9]{8}t[0-9]{6}z_[a-z0-9]{6}$", run);
        Assert.Equal($"ipc_mrx_evidence_{run}", connection.Database);
        Assert.Equal($"mrx_{run}", connection.UserID);
        Assert.Contains(connection.Server, new[] { "127.0.0.1", "localhost" });
        var directory = Path.GetFullPath(Environment.GetEnvironmentVariable("MRX_E2E_ARTIFACT_DIRECTORY") ?? "");
        Assert.Equal("runtime", Path.GetFileName(directory));
        Assert.Equal(run, Directory.GetParent(directory)!.Name);
        using var scope = JsonDocument.Parse(await File.ReadAllTextAsync(Path.Combine(directory, "export-scope.json")));
        Assert.Equal(run, scope.RootElement.GetProperty("runId").GetString());
        var batchId = GuidHelper.ParseGuidString(scope.RootElement.GetProperty("batchId").GetString())!;
        using var deadline = new CancellationTokenSource(TimeSpan.FromSeconds(300));
        var token = deadline.Token;
        var results = new List<object>();
        string? failure = null;
        string? currentSchedule = null;
        string[]? stockBefore = null;
        IpcManagementContext Context(params IInterceptor[] interceptors) => new(new DbContextOptionsBuilder<IpcManagementContext>()
            .UseMySql(connection.ConnectionString, new MySqlServerVersion(new Version(9, 5, 0)))
            .AddInterceptors(interceptors).Options);
        try
        {
            await using var admission = Context();
            var mode = await new SystemOperationModeGuard(admission).ReadRequiredAsync(token);
            Assert.Equal("MATERIAL_RECONCILIATION", mode.Mode);
            var actor = await admission.Users.Include(user => user.Role).SingleAsync(user => user.Username == $"mrx_{run}_admin" && user.IsActive == true, token);
            Assert.Equal("ADMIN", actor.Role.RoleCode);
            var original = await admission.Reconciliationbatches.SingleAsync(batch => batch.BatchId == batchId, token);
            var originalVersion = await admission.Menuversions.AsNoTracking().SingleAsync(version => version.MenuVersionId == original.MenuVersionId, token);
            Assert.Equal(scope.RootElement.GetProperty("week").GetString(), originalVersion.WeekStartDate.ToString("yyyy-MM-dd"));
            Assert.Empty(await MrxDayLockReader.GetLockedDatesAsync(admission, batchId, token));
            stockBefore = await StockChecksums(admission, token);

            foreach (var schedule in new[] { "writer-before-read", "writer-during-read", "unrelated-customer-during-read", "writer-during-render" })
            {
                currentSchedule = schedule;
                var writerId = batchId;
                if (schedule.StartsWith("unrelated", StringComparison.Ordinal))
                {
                    writerId = scope.RootElement.TryGetProperty("otherBatchId", out var declaredOther) && declaredOther.ValueKind == JsonValueKind.String
                        ? GuidHelper.ParseGuidString(declaredOther.GetString())
                        : await admission.Reconciliationbatches.AsNoTracking()
                        .Where(batch => batch.BatchId != batchId && admission.Menuversions.Any(version => version.MenuVersionId == batch.MenuVersionId && version.CustomerId != originalVersion.CustomerId)
                            && (batch.Status == "READY" || batch.Status == "IN_PROGRESS")
                            && !admission.Inventoryissues.Any(issue => issue.ReconciliationBatchId == batch.BatchId)
                            && batch.Lines.Any(line => line.Contributors.Any(item => item.InvalidatedAt == null && item.FrozenBomUnitToBaseRate != null && item.FrozenCanonicalUnitToBaseRate != null)))
                        .OrderBy(batch => batch.CreatedAt).Select(batch => batch.BatchId).FirstOrDefaultAsync(token);
                    if (writerId is null)
                    {
                        results.Add(new { schedule, verdict = "NOT_RUN", reason = "No existing eligible unlocked other-customer batch; no replacement fixture created." });
                        continue;
                    }
                }
                var readSql = new ReadGate(schedule.EndsWith("during-read", StringComparison.Ordinal));
                var readTx = new TransactionTrace(false);
                var writeSql = new WriteTrace();
                var writeTx = new TransactionTrace(schedule == "writer-during-render");
                await using var reader = Context(readSql, readTx);
                await using var writer = Context(writeSql, writeTx);
                await writer.Database.OpenConnectionAsync(token);
                var batch = await writer.Reconciliationbatches.AsNoTracking().SingleAsync(item => item.BatchId == writerId, token);
                var version = await writer.Menuversions.AsNoTracking().SingleAsync(item => item.MenuVersionId == batch.MenuVersionId, token);
                if (!writerId.SequenceEqual(batchId))
                {
                    Assert.False(version.CustomerId!.SequenceEqual(originalVersion.CustomerId!));
                    Assert.Empty(await MrxDayLockReader.GetLockedDatesAsync(writer, writerId, token));
                }
                var sources = await writer.Mealquantityplanlines.AsNoTracking().Include(item => item.MenuSchedule).ThenInclude(item => item.Menu).ThenInclude(item => item.Menuitems)
                    .Where(item => item.QuantityPlan.ImportBatchId == batch.QuantityImportBatchId && item.MenuSchedule.MenuVersionId == batch.MenuVersionId)
                    .OrderBy(item => item.MenuSchedule.ServiceDate).ThenBy(item => item.ShiftName).ToListAsync(token);
                var source = sources.First(item => item.SavoryServings > 0);
                var dish = source.MenuSchedule.Menu.Menuitems.First(item => !item.DishSlot!.StartsWith("vegetarian", StringComparison.Ordinal));
                var request = new CreateMenuAmendmentRequest
                {
                    CustomerId = GuidHelper.ToGuidString(version.CustomerId!), WeekStartDate = version.WeekStartDate,
                    ExpectedBaseMenuVersionId = GuidHelper.ToGuidString(batch.MenuVersionId), ExpectedBatchVersion = batch.Version,
                    Reason = $"T7 {run} {schedule}", Lines = [new() { ServiceDate = source.MenuSchedule.ServiceDate, ShiftName = source.ShiftName,
                        DishSlot = dish.DishSlot!, NewDishId = GuidHelper.ToGuidString(dish.DishId!), NewSavoryServings = source.SavoryServings + 1, NewVegetarianServings = source.VegetarianServings }]
                };
                var before = await Inputs(admission, batchId, token);
                var writerBefore = writerId.SequenceEqual(batchId) ? before : await Inputs(admission, writerId, token);
                var writerExpected = writerBefore.Select(item => item.ScheduleId.SequenceEqual(source.MenuScheduleId) && item.Variant == "savory"
                    ? item with { Servings = item.Servings + 1 } : item).ToList();
                var expected = writerId.SequenceEqual(batchId) ? writerExpected : before;
                await File.WriteAllTextAsync(Path.Combine(directory, $"{schedule}-inputs.json"), JsonSerializer.Serialize(new { before, expected, writerBefore, writerExpected, request, writerBatchId = GuidHelper.ToGuidString(writerId) }, new JsonSerializerOptions { WriteIndented = true }), token);
                var revisionCount = await admission.Reconciliationsourcerevisions.CountAsync(item => item.BatchId == writerId, token);
                var operation = new SystemOperationRequestContext { Mode = mode.Mode, ExpectedModeVersion = mode.Version,
                    OperationKey = "reconciliation.source-change.apply", Disposition = OperationDisposition.ReconciliationOnly };
                var service = new MenuAmendmentService(writer, new EfTransactionRunner(writer, operation, new SystemOperationModeGuard(writer)), operationContext: operation);
                var query = new ReconciliationPreparationWorkbookQuery { WeekStartDate = originalVersion.WeekStartDate, BatchIds = [GuidHelper.ToGuidString(batchId)], IncludeMenus = true, IsSupplemental = false };
                Task<MenuAmendmentResultDto>? writing = null;
                Task<ReconciliationPreparationWorkbookDto>? reading = null;
                double renderStart = 0, renderEnd = 0;
                byte[] bytes = [];
                try
                {
                    if (schedule == "writer-before-read")
                    {
                        writing = service.ApplyMrxAsync(request, GuidHelper.ToGuidString(actor.UserId), [actor.Role.RoleCode], token);
                        await writing;
                        reading = new ReconciliationPreparationWorkbookExporter(reader).GetWorkbookAsync(query, token);
                    }
                    else if (schedule == "writer-during-render")
                    {
                        reading = new ReconciliationPreparationWorkbookExporter(reader).GetWorkbookAsync(query, token);
                        await reading;
                        writing = service.ApplyMrxAsync(request, GuidHelper.ToGuidString(actor.UserId), [actor.Role.RoleCode], token);
                        await writeTx.AtBegin.Task.WaitAsync(TimeSpan.FromSeconds(15), token);
                    }
                    else
                    {
                        reading = new ReconciliationPreparationWorkbookExporter(reader).GetWorkbookAsync(query, token);
                        await readSql.Entered.Task.WaitAsync(TimeSpan.FromSeconds(15), token);
                        writing = service.ApplyMrxAsync(request, GuidHelper.ToGuidString(actor.UserId), [actor.Role.RoleCode], token);
                        await writeSql.Mutation.Task.WaitAsync(TimeSpan.FromSeconds(15), token);
                        readSql.Release.TrySetResult();
                    }
                    var document = await reading;
                    Assert.Null(reader.Database.CurrentTransaction);
                    CheckDocument(document, schedule == "writer-before-read" ? expected : before);
                    bytes = await Task.Run(() =>
                    {
                        renderStart = Now();
                        writeTx.Release.TrySetResult();
                        var file = PreparationWorkbookBuilder.BuildXlsx(document);
                        renderEnd = Now();
                        return file;
                    }, token);
                    var applied = await writing;
                    Assert.Equal("EXECUTED", applied.Status);
                    Assert.Equal(batch.Version + 1, (await admission.Reconciliationbatches.AsNoTracking().SingleAsync(item => item.BatchId == writerId, token)).Version);
                    Assert.Equal(revisionCount + 1, await admission.Reconciliationsourcerevisions.CountAsync(item => item.BatchId == writerId, token));
                    var after = await Inputs(admission, batchId, token);
                    Assert.Equal(Quantities(expected), Quantities(after));
                    if (!writerId.SequenceEqual(batchId)) Assert.Equal(Quantities(writerExpected), Quantities(await Inputs(admission, writerId, token)));
                    var daily = await admission.Reconciliationbatchdailylines.AsNoTracking().Include(item => item.BatchLine).ThenInclude(item => item.Ingredient)
                        .Where(item => item.BatchId == batchId && item.RequiredQuantity > 0).ToListAsync(token);
                    Assert.Equal(Quantities(expected), daily.Select(item => $"{item.ServiceDate:yyyyMMdd}|{item.BatchLine.Ingredient.IngredientCode}|{GuidHelper.ToGuidString(item.CanonicalUnitId)}|{Number(item.RequiredQuantity)}").Order().ToArray());
                    CheckFile(bytes, schedule == "writer-before-read" ? expected : before);
                    await File.WriteAllBytesAsync(Path.Combine(directory, $"{schedule}.xlsx"), bytes, token);
                    var readOverlap = writeTx.Started > readTx.Started && writeTx.Started < readTx.Committed && writeTx.Committed > readSql.EnteredAt;
                    var renderOverlap = writeTx.Started < renderStart && writeTx.Committed > renderEnd
                        && writeSql.FirstSqlCompleted - writeSql.FirstSqlDuration < renderEnd && writeSql.FirstSqlCompleted > renderStart;
                    var reached = schedule == "writer-before-read" ? writeTx.Committed < readTx.Started : schedule == "writer-during-render" ? renderOverlap : readOverlap;
                    results.Add(new { schedule, verdict = reached ? "PASS" : "NOT_REACHED", input = before, expected, readTx.Started, readCommit = readTx.Committed,
                        writerStart = writeTx.Started, writerCommit = writeTx.Committed, firstMutation = writeSql.MutationAt, firstSqlCompleted = writeSql.FirstSqlCompleted, firstSqlDuration = writeSql.FirstSqlDuration,
                        renderStart, renderEnd, readOverlap, renderOverlap, bytes = bytes.Length,
                        latencyVerdict = "NEEDS_EVIDENCE: no approved writer-latency budget" });
                    Assert.True(readTx.Started > 0 && readTx.Committed > readTx.Started);
                    Assert.Equal(IsolationLevel.Serializable, readTx.Isolation);
                    if (schedule == "writer-before-read") Assert.True(writeTx.Committed < readTx.Started);
                    else if (schedule == "writer-during-render") Assert.True(renderOverlap, "NOT_REACHED: no real writer SQL execution interval overlapped the actual renderer interval.");
                    else Assert.True(readOverlap, "NOT_REACHED: no actual read/writer transaction overlap.");
                }
                finally
                {
                    readSql.Release.TrySetResult(); writeTx.Release.TrySetResult();
                    if (reading is not null) await reading;
                    if (writing is not null) await writing;
                }
            }
            Assert.Equal(stockBefore, await StockChecksums(admission, token));
        }
        catch (Exception error) { failure = error.GetType().Name; throw; }
        finally
        {
            await using var final = Context();
            var stockAfter = stockBefore is null ? null : await StockChecksums(final, token);
            await File.WriteAllTextAsync(Path.Combine(directory, "export-consistency.json"), JsonSerializer.Serialize(new
            {
                stockBefore, stockAfter, stockInvariant = stockBefore is not null && stockBefore.SequenceEqual(stockAfter!),
                run, failure, currentSchedule, clock = "Stopwatch monotonic milliseconds, same test process for all observations",
                boundary = "Real MySQL exporter read + actual public XLSX renderer, real protected source service writes; not HTTP/RBAC or latency qualification",
                results
            }, new JsonSerializerOptions { WriteIndented = true }));
            if (stockBefore is not null) Assert.Equal(stockBefore, stockAfter);
        }
    }

    private static double Now() => Stopwatch.GetTimestamp() * 1000d / Stopwatch.Frequency;
    private static string Number(decimal value) => value.ToString("F6", CultureInfo.InvariantCulture);
    private sealed record Input(byte[] ScheduleId, DateOnly Date, string Ingredient, string UnitId, string UnitName, string Dish, string Shift,
        string Variant, int Servings, decimal Raw, decimal BomRate, decimal CanonicalRate);
    private static async Task<List<Input>> Inputs(IpcManagementContext context, byte[] batch, CancellationToken token)
    {
        var rows = await context.Reconciliationbatchcontributors.AsNoTracking().Include(item => item.DailyLine)
            .Include(item => item.BatchLine).ThenInclude(item => item.Ingredient).Include(item => item.BatchLine).ThenInclude(item => item.CanonicalUnit)
            .Where(item => item.BatchLine.BatchId == batch && item.InvalidatedAt == null).ToListAsync(token);
        Assert.NotEmpty(rows);
        return rows.Select(item => new Input(item.MenuScheduleId, item.DailyLine!.ServiceDate, item.BatchLine.Ingredient.IngredientCode,
            GuidHelper.ToGuidString(item.BatchLine.CanonicalUnitId), item.BatchLine.CanonicalUnit.UnitName, item.FrozenDishCode!, item.FrozenShiftName!, item.FrozenMenuVariant!,
            item.FrozenServings!.Value, item.FrozenBomQuantityPerServing!.Value, item.FrozenBomUnitToBaseRate!.Value, item.FrozenCanonicalUnitToBaseRate!.Value)).ToList();
    }
    private static string[] Quantities(List<Input> inputs) => inputs.GroupBy(item => $"{item.Date:yyyyMMdd}|{item.Ingredient}|{item.UnitId}")
        .Select(group => $"{group.Key}|{Number(group.Sum(item => decimal.Round(item.Raw * item.Servings * item.BomRate / item.CanonicalRate, 6, MidpointRounding.AwayFromZero)))}").Order().ToArray();
    private static string[] Menus(List<Input> inputs) => inputs.Select(item => $"{item.Date:dd/MM/yyyy}|{(item.Shift == "MORNING" ? "Sáng" : "Chiều")}|{(item.Variant == "savory" ? "Mặn" : "Chay")}|{item.Dish}|{item.Servings}").Distinct().Order().ToArray();
    private static void CheckDocument(ReconciliationPreparationWorkbookDto document, List<Input> inputs)
    {
        Assert.Equal(Quantities(inputs), document.DetailRows.Select(row => $"{row.ServiceDate:yyyyMMdd}|{row.IngredientCode}|{row.CanonicalUnitId}|{Number(row.Quantity)}").Order().ToArray());
        Assert.Equal(Menus(inputs), document.MenuRows.Select(row => $"{row.ServiceDate:dd/MM/yyyy}|{row.ShiftName}|{row.MenuVariant}|{row.DishCode}|{row.Servings}").Order().ToArray());
    }
    private static void CheckFile(byte[] bytes, List<Input> inputs)
    {
        using var zip = new ZipArchive(new MemoryStream(bytes), ZipArchiveMode.Read);
        XNamespace ns = "http://schemas.openxmlformats.org/spreadsheetml/2006/main";
        using var stream = zip.GetEntry("xl/worksheets/sheet1.xml")!.Open();
        var rows = XDocument.Load(stream).Descendants(ns + "row").Select(row => row.Elements(ns + "c").Select(cell => cell.Value).ToArray()).ToArray();
        var dishCodes = inputs.Select(item => item.Dish).ToHashSet();
        Assert.Equal(Menus(inputs), rows.Where(row => row.Length == 7 && dishCodes.Contains(row[4])).Select(row => $"{row[1]}|{row[2]}|{row[3]}|{row[4]}|{row[6]}").Order().ToArray());
        foreach (var group in inputs.GroupBy(item => new { item.Ingredient, item.UnitName }))
        {
            var total = group.Sum(item => decimal.Round(item.Raw * item.Servings * item.BomRate / item.CanonicalRate, 6, MidpointRounding.AwayFromZero));
            var material = Assert.Single(rows, row => row.Length >= 5 && row[0] == group.Key.Ingredient && row[2] == group.Key.UnitName);
            Assert.Equal(total, decimal.Parse(material[^1], CultureInfo.InvariantCulture));
        }
    }
    private static async Task<string[]> StockChecksums(IpcManagementContext context, CancellationToken token)
    {
        var result = new List<string>();
        foreach (var table in new[] { "currentstock", "currentstocklots", "stockmovements" })
        {
            await context.Database.OpenConnectionAsync(token);
            await using var command = context.Database.GetDbConnection().CreateCommand();
            command.CommandText = $"CHECKSUM TABLE `{table}`";
            await using var rows = await command.ExecuteReaderAsync(token);
            Assert.True(await rows.ReadAsync(token));
            Assert.False(rows.IsDBNull(1));
            result.Add($"{table}:{rows.GetValue(1)}");
        }
        return result.ToArray();
    }
    private sealed class ReadGate(bool enabled) : DbCommandInterceptor
    {
        public TaskCompletionSource Entered { get; } = new(TaskCreationOptions.RunContinuationsAsynchronously);
        public TaskCompletionSource Release { get; } = new(TaskCreationOptions.RunContinuationsAsynchronously);
        public double EnteredAt;
        public override async ValueTask<DbDataReader> ReaderExecutedAsync(DbCommand command, CommandExecutedEventData eventData, DbDataReader result, CancellationToken cancellationToken = default)
        {
            if (enabled && command.Transaction is not null && command.CommandText.Contains("reconciliationbatchdailylines", StringComparison.OrdinalIgnoreCase) && EnteredAt == 0)
            {
                EnteredAt = Now(); Entered.TrySetResult();
                await Release.Task.WaitAsync(TimeSpan.FromSeconds(15), cancellationToken);
            }
            return result;
        }
    }
    private sealed class WriteTrace : DbCommandInterceptor
    {
        public TaskCompletionSource Mutation { get; } = new(TaskCreationOptions.RunContinuationsAsynchronously);
        public double MutationAt, FirstSqlCompleted, FirstSqlDuration;
        public override ValueTask<DbDataReader> ReaderExecutedAsync(DbCommand command, CommandExecutedEventData eventData, DbDataReader result, CancellationToken cancellationToken = default)
        {
            if (command.Transaction is not null && FirstSqlCompleted == 0)
            {
                FirstSqlCompleted = Now(); FirstSqlDuration = eventData.Duration.TotalMilliseconds;
            }
            return new(result);
        }
        public override ValueTask<InterceptionResult<DbDataReader>> ReaderExecutingAsync(DbCommand command, CommandEventData eventData, InterceptionResult<DbDataReader> result, CancellationToken cancellationToken = default)
        {
            if (MutationAt == 0 && command.Transaction is not null && !command.CommandText.TrimStart().StartsWith("SELECT", StringComparison.OrdinalIgnoreCase))
            { MutationAt = Now(); Mutation.TrySetResult(); }
            return new(result);
        }
    }
    private sealed class TransactionTrace(bool hold) : DbTransactionInterceptor
    {
        public TaskCompletionSource AtBegin { get; } = new(TaskCreationOptions.RunContinuationsAsynchronously);
        public TaskCompletionSource Release { get; } = new(TaskCreationOptions.RunContinuationsAsynchronously);
        public double Started, Committed;
        public IsolationLevel Isolation;
        public override async ValueTask<DbTransaction> TransactionStartedAsync(DbConnection connection, TransactionEndEventData eventData, DbTransaction result, CancellationToken cancellationToken = default)
        {
            Started = Now(); Isolation = result.IsolationLevel;
            if (hold) { AtBegin.TrySetResult(); await Release.Task.WaitAsync(TimeSpan.FromSeconds(15), cancellationToken); }
            return result;
        }
        public override Task TransactionCommittedAsync(DbTransaction transaction, TransactionEndEventData eventData, CancellationToken cancellationToken = default)
        { Committed = Now(); return Task.CompletedTask; }
    }
}
