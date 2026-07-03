using IPCManagement.Api.Data;
using IPCManagement.Api.Helpers;
using IPCManagement.Api.Models.DTOs.Unit;
using Microsoft.EntityFrameworkCore;

namespace IPCManagement.Api.Services;

public class UnitService : IUnitService
{
    private readonly IpcManagementContext _context;

    public UnitService(IpcManagementContext context)
    {
        _context = context;
    }

    public async Task<List<UnitDto>> GetAllAsync(CancellationToken cancellationToken = default)
    {
        var units = await _context.Units
            .AsNoTracking()
            .OrderBy(unit => unit.UnitCode)
            .ToListAsync(cancellationToken);

        return units.Select(unit => new UnitDto
        {
            UnitId = GuidHelper.ToGuidString(unit.UnitId),
            UnitCode = unit.UnitCode,
            UnitName = unit.UnitName
        }).ToList();
    }
}
