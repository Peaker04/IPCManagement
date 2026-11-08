namespace IPCManagement.Api.Helpers;

public static class MenuVersionStatusPolicy
{
    public static readonly string[] PublishedCompatibleStatuses = ["ACTIVE", "PUBLISHED"];

    public static bool IsPublishedCompatible(string? status)
        => PublishedCompatibleStatuses.Contains(status, StringComparer.OrdinalIgnoreCase);
}
