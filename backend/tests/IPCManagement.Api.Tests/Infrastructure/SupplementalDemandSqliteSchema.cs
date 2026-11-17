using System.Text.RegularExpressions;
using IPCManagement.Api.Data;
using Microsoft.EntityFrameworkCore;

namespace IPCManagement.Api.Tests.Infrastructure;

// Extend the maintained minimal SQLite fixture from the real EF model, including checks and unique indexes.
// This is an isolated test schema, never a migration or a substitute for MySQL qualification.
internal static class SupplementalDemandSqliteSchema
{
    internal static async Task CreateAsync(IpcManagementContext context)
    {
        const string tables = "reconciliationsupplementaldemands|reconciliationsupplementaldemanddishes|reconciliationsupplementaldemandmaterials|reconciliationsupplementaldemandcontributions|reconciliationissueallocations";
        var script = context.Database.GenerateCreateScript()
            .Replace("COLLATE utf8mb4_unicode_ci", "COLLATE BINARY", StringComparison.Ordinal)
            .Replace("COLLATE \"utf8mb4_unicode_ci\"", "COLLATE BINARY", StringComparison.Ordinal);
        var statements = Regex.Matches(script, $"^CREATE TABLE \"(?:{tables})\" \\([\\s\\S]*?^\\);|^CREATE (?:UNIQUE )?INDEX [^\\r\\n]+ ON \"(?:{tables})\" [^\\r\\n]+;", RegexOptions.Multiline);
        if (statements.Count < 5) throw new InvalidOperationException("Supplemental fixture schema is incomplete.");
        foreach (Match statement in statements) await context.Database.ExecuteSqlRawAsync(statement.Value);
    }
}
