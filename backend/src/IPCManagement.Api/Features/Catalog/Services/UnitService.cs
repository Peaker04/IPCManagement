using IPCManagement.Api.Data;
using IPCManagement.Api.Features.Catalog.Contracts;
using IPCManagement.Api.Helpers;
using Microsoft.EntityFrameworkCore;

namespace IPCManagement.Api.Features.Catalog.Services;

public interface IUnitService
{
    Task<IReadOnlyList<UnitDto>> GetAllAsync(CancellationToken cancellationToken);
}

public sealed class UnitService(IpcManagementContext context) : IUnitService
{
    public async Task<IReadOnlyList<UnitDto>> GetAllAsync(CancellationToken cancellationToken)
    {
        var units = await context.Units
            .AsNoTracking()
            .OrderBy(unit => unit.UnitCode)
            .ToListAsync(cancellationToken);

        return units.Select(unit => new UnitDto(
                GuidHelper.ToGuidString(unit.UnitId),
                unit.UnitCode,
                unit.UnitName,
                unit.BaseUnitCode,
                unit.ConvertRateToBase))
            .ToList();
    }
}
