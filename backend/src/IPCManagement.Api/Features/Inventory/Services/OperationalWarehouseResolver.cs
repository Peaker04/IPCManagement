using IPCManagement.Api.Data.Repositories;
using IPCManagement.Api.Helpers;

namespace IPCManagement.Api.Features.Inventory.Services;

public sealed class OperationalWarehouseResolver : IOperationalWarehouseResolver
{
    private const string WarehouseIdConfigurationKey = "OperationalWarehouse:WarehouseId";
    private readonly IWarehouseRepository _warehouseRepository;
    private readonly IConfiguration _configuration;

    public OperationalWarehouseResolver(
        IWarehouseRepository warehouseRepository,
        IConfiguration configuration)
    {
        _warehouseRepository = warehouseRepository;
        _configuration = configuration;
    }

    public async Task<byte[]> ResolveAsync(CancellationToken cancellationToken = default)
    {
        var configuredId = GuidHelper.ParseGuidString(_configuration[WarehouseIdConfigurationKey]);
        if (configuredId is null)
        {
            throw Failure(
                OperationalWarehouseInvariantFailure.MissingConfiguration,
                $"{WarehouseIdConfigurationKey} must contain an existing warehouse GUID.");
        }

        var activeWarehouses = await _warehouseRepository.GetOperationalCandidatesAsync(2);
        if (activeWarehouses.Count == 0)
        {
            throw Failure(
                OperationalWarehouseInvariantFailure.ZeroActiveWarehouses,
                "No operational warehouse is active.");
        }

        if (activeWarehouses.Count > 1)
        {
            throw Failure(
                OperationalWarehouseInvariantFailure.MultipleActiveWarehouses,
                "More than one operational warehouse is active.");
        }

        var activeId = activeWarehouses[0].WarehouseId;
        if (activeId.AsSpan().SequenceEqual(configuredId))
        {
            return activeId;
        }

        var configuredWarehouse = await _warehouseRepository.GetByIdAsync(configuredId);
        if (configuredWarehouse is null)
        {
            throw Failure(
                OperationalWarehouseInvariantFailure.ConfiguredWarehouseMissing,
                "The configured operational warehouse row does not exist.");
        }

        throw Failure(
            OperationalWarehouseInvariantFailure.ConfiguredWarehouseInactiveMismatch,
            "The configured warehouse is not the active operational warehouse.");
    }

    private static OperationalWarehouseInvariantException Failure(
        OperationalWarehouseInvariantFailure reason,
        string message)
        => new(reason, $"Operational warehouse invariant failed ({reason}): {message}");
}
