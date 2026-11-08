namespace IPCManagement.Api.Features.Inventory.Services;

public interface IOperationalWarehouseResolver
{
    Task<byte[]> ResolveAsync(CancellationToken cancellationToken = default);
}

public enum OperationalWarehouseInvariantFailure
{
    MissingConfiguration,
    ZeroActiveWarehouses,
    MultipleActiveWarehouses,
    ConfiguredWarehouseMissing,
    ConfiguredWarehouseInactiveMismatch
}

public sealed class OperationalWarehouseInvariantException : InvalidOperationException
{
    public OperationalWarehouseInvariantException(
        OperationalWarehouseInvariantFailure reason,
        string message)
        : base(message)
    {
        Reason = reason;
    }

    public OperationalWarehouseInvariantFailure Reason { get; }
}
