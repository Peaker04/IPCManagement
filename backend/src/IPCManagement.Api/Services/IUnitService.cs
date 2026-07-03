using IPCManagement.Api.Models.DTOs.Unit;

namespace IPCManagement.Api.Services;

public interface IUnitService
{
    Task<List<UnitDto>> GetAllAsync(CancellationToken cancellationToken = default);
}
