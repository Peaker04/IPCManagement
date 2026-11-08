namespace IPCManagement.Api.Features.Catalog.Contracts;

public sealed record UnitDto(
    string UnitId,
    string UnitCode,
    string UnitName,
    string? BaseUnitCode,
    decimal ConvertRateToBase);
