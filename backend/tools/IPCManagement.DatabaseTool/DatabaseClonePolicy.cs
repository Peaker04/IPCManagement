using System.Text.RegularExpressions;

namespace IPCManagement.DatabaseTool;

public static partial class DatabaseClonePolicy
{
    public const string TemplateDatabase = "ipc_e2e_template";

    public static void ValidateTransition(string sourceDatabase, string targetDatabase)
    {
        if (!AllowedDatabaseName().IsMatch(sourceDatabase) || !AllowedDatabaseName().IsMatch(targetDatabase))
        {
            throw new ArgumentException(
                "Database clone is restricted to ipc_lane1..ipc_lane9 and ipc_e2e_template.");
        }

        var sourceIsTemplate = sourceDatabase == TemplateDatabase;
        var targetIsTemplate = targetDatabase == TemplateDatabase;
        if (sourceIsTemplate == targetIsTemplate)
        {
            throw new ArgumentException(
                "Database clone must run between one IPC lane database and ipc_e2e_template.");
        }
    }

    [GeneratedRegex("^ipc_(?:lane[1-9]|e2e_template)$", RegexOptions.CultureInvariant)]
    private static partial Regex AllowedDatabaseName();
}
