using Microsoft.Extensions.Caching.Memory;

namespace IPCManagement.Api.Caching;

internal static class DishCatalogCache
{
    internal const string ActiveKey = "DishCatalog";
    internal const string AllKey = "DishCatalog:all";

    internal static string Key(bool includeInactive) => includeInactive ? AllKey : ActiveKey;

    internal static void Clear(IMemoryCache cache)
    {
        cache.Remove(ActiveKey);
        cache.Remove(AllKey);
    }
}
