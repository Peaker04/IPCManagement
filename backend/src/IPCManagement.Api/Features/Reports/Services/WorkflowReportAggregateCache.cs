using System.Collections.Concurrent;
using System.Text.Json;
using IPCManagement.Api.Features.Reports.Contracts;
using IPCManagement.Api.Shared.Contracts;
using Microsoft.Extensions.Caching.Memory;

namespace IPCManagement.Api.Features.Reports.Services;

public sealed class WorkflowReportAggregateCache : IWorkflowReportAggregateCache
{
    private static readonly TimeSpan CacheDuration = TimeSpan.FromSeconds(15);
    private const string OperationalKpisCacheKey = "workflow-reports:operational-kpis";

    private readonly IMemoryCache _cache;
    private readonly ConcurrentDictionary<string, Lazy<Task<object>>> _loads = new();
    private long _dataQualityVersion;

    public WorkflowReportAggregateCache(IMemoryCache cache)
    {
        _cache = cache;
    }

    public Task<OperationalKpiSummaryDto> GetOperationalKpisAsync(
        Func<Task<OperationalKpiSummaryDto>> factory)
        => GetOrCreateAsync(OperationalKpisCacheKey, factory);

    public Task<DataQualityReportDto> GetDataQualitySnapshotAsync(
        WorkflowReportQueryDto query,
        Func<WorkflowReportQueryDto, Task<DataQualityReportDto>> factory)
    {
        var snapshotQuery = JsonSerializer.Deserialize<WorkflowReportQueryDto>(JsonSerializer.Serialize(query))
            ?? new WorkflowReportQueryDto();
        snapshotQuery.Limit = 500;
        var version = Volatile.Read(ref _dataQualityVersion);
        var cacheKey = $"workflow-reports:data-quality-snapshot:{version}:{JsonSerializer.Serialize(snapshotQuery)}";
        return GetOrCreateAsync(cacheKey, () => factory(snapshotQuery));
    }

    public Task<T> GetOrCreateReportAsync<T>(
        string reportType,
        object query,
        Func<Task<T>> factory)
        where T : class
    {
        var version = Volatile.Read(ref _dataQualityVersion);
        var queryJson = JsonSerializer.Serialize(query);
        var cacheKey = $"workflow-reports:{reportType}:{version}:{queryJson}";
        return GetOrCreateAsync(cacheKey, factory);
    }

    public void Invalidate()
    {
        _cache.Remove(OperationalKpisCacheKey);
        Interlocked.Increment(ref _dataQualityVersion);
    }

    private async Task<T> GetOrCreateAsync<T>(string cacheKey, Func<Task<T>> factory)
        where T : class
    {
        if (_cache.TryGetValue<T>(cacheKey, out var cached) && cached is not null)
        {
            return cached;
        }

        var load = _loads.GetOrAdd(
            cacheKey,
            _ => new Lazy<Task<object>>(
                async () => await factory(),
                LazyThreadSafetyMode.ExecutionAndPublication));
        try
        {
            var result = (T)await load.Value;
            _cache.Set(cacheKey, result, CacheDuration);
            return result;
        }
        finally
        {
            _loads.TryRemove(cacheKey, out _);
        }
    }
}
