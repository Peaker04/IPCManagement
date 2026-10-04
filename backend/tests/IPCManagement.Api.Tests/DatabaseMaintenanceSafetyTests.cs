using System.Text.RegularExpressions;
using FluentAssertions;

namespace IPCManagement.Api.Tests;

// Operational SQL safety, independent of retired gate runners and receipts.
public sealed class DatabaseMaintenanceSafetyTests
{
    private static readonly string[] Tables =
    [
        "backup_bomadjustments_20260717_141300", "backup_dishbom_20260717_141300",
        "backup_dishes_20260717_141300", "backup_ingredients_20260717_141300",
        "backup_materialrequestlines_bom_20260717_141300", "backup_menuitems_20260717_141300",
        "backup_menuitems_pre2026_20260717_141300",
    ];

    [Fact]
    public void Drop_template_is_exact_allowlist_without_dynamic_scope()
    {
        var sql = Read("backup-tables-drop.sql");
        Regex.Matches(sql, "(?im)^DROP TABLE `\\{\\{TARGET_DATABASE\\}\\}`\\.`([^`]+)`;")
            .Select(match => match.Groups[1].Value).Should().Equal(Tables);
        AssertRestricted(sql, true);
        sql.Should().NotContain("backup_%");
        sql.Contains("PREPARE", StringComparison.OrdinalIgnoreCase).Should().BeFalse();
        sql.Contains("EXECUTE", StringComparison.OrdinalIgnoreCase).Should().BeFalse();
    }

    [Fact]
    public void Preflight_and_postflight_preserve_definition_count_consumer_and_outside_scope_oracles()
    {
        var pre = Read("backup-tables-preflight.sql");
        var post = Read("backup-tables-postflight.sql");
        foreach (var sql in new[] { pre, post })
        {
            Tables.Should().OnlyContain(table => sql.Contains(table, StringComparison.Ordinal));
            sql.Should().Contain("{{TARGET_DATABASE}}").And.Contain("consumer").And.Contain("outsideScope").And.Contain("SHA2");
            AssertRestricted(sql, false);
        }
        pre.Should().Contain("SHOW CREATE TABLE", Exactly.Times(7)).And.Contain("rowCount").And.Contain("rowDigest");
        post.Should().Contain("ABSENT");
    }

    [Fact]
    public void Restore_is_extract_bound_and_disposable_only()
    {
        var sql = Read("backup-tables-restore.sql");
        Tables.Should().OnlyContain(table => sql.Contains(table, StringComparison.Ordinal));
        sql.Should().Contain("{{TARGET_DATABASE}}").And.Contain("{{RUN_ID}}")
            .And.Contain("{{ROLLBACK_EXTRACT_SHA256}}").And.Contain("{{ROLLBACK_EXTRACT_PATH}}")
            .And.Contain("ipc_rehearsal_phase42_").And.Contain("NO_GO_TARGET")
            .And.NotContain("ipc_lane1").And.NotContain("`ipcmanagement`");
        AssertRestricted(sql, false);
    }

    private static void AssertRestricted(string sql, bool allowDrop)
    {
        foreach (var verb in new[] { "USE", "CREATE\\s+DATABASE", "DROP\\s+DATABASE", "UPDATE", "DELETE" })
            sql.Should().NotMatchRegex($"(?im)^\\s*{verb}\\b");
        if (!allowDrop) sql.Should().NotMatchRegex("(?im)^\\s*DROP\\s+TABLE\\b");
    }

    private static string Read(string name)
    {
        var root = new DirectoryInfo(AppContext.BaseDirectory);
        while (root is not null && !File.Exists(Path.Combine(root.FullName, "AGENTS.md"))) root = root.Parent;
        return File.ReadAllText(Path.Combine(root?.FullName ?? throw new InvalidOperationException("Repository root missing"), "tools", "db", "phase-04.2", name));
    }
}
