using System.Text.RegularExpressions;
using IPCManagement.Api.Data;
using Microsoft.EntityFrameworkCore;

namespace IPCManagement.Api.Tests.Infrastructure;

internal static class StocktakeSqliteSchema
{
    internal static async Task CreateAsync(IpcManagementContext context)
    {
        var script = context.Database.GenerateCreateScript().Replace("COLLATE utf8mb4_unicode_ci", "COLLATE BINARY", StringComparison.Ordinal)
            .Replace("COLLATE \"utf8mb4_unicode_ci\"", "COLLATE BINARY", StringComparison.Ordinal);
        var statements = Regex.Matches(script, "^CREATE TABLE \"(?:stocktakes|stocktakelines)\" \\([\\s\\S]*?^\\);|^CREATE (?:UNIQUE )?INDEX [^\\r\\n]+ ON \"(?:stocktakes|stocktakelines)\" [^\\r\\n]+;", RegexOptions.Multiline);
        if (statements.Count < 2) throw new InvalidOperationException("Stocktake fixture schema is incomplete.");
        foreach (Match statement in statements)
        {
            var sql = Regex.Replace(statement.Value, "enum\\([^)]*\\)", "TEXT", RegexOptions.IgnoreCase);
            await context.Database.ExecuteSqlRawAsync(sql);
        }
    }
}
