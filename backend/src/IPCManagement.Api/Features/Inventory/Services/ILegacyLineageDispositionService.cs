using IPCManagement.Api.Features.Inventory.Contracts;

namespace IPCManagement.Api.Features.Inventory.Services;

public interface ILegacyLineageDispositionService
{
    Task<IReadOnlyList<LegacyLineageDispositionDto>> GetAsync(string? status = null, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<LegacyLineageCandidateDto>> GetCandidatesAsync(string legacyLineType, string legacyLineId, CancellationToken cancellationToken = default);
    Task<LegacyLineageDispositionDto> CreateAsync(CreateLegacyLineageDispositionRequest request, string actorUserId, CancellationToken cancellationToken = default);
    Task<LegacyLineageDispositionDto> ReviewAsync(string dispositionId, ReviewLegacyLineageDispositionRequest request, string actorUserId, CancellationToken cancellationToken = default);
    Task<LegacyLineageDispositionDto> ApplyAsync(string dispositionId, ApplyLegacyLineageDispositionRequest request, string actorUserId, CancellationToken cancellationToken = default);
}
