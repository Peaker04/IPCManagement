using IPCManagement.Api.Features.Catalog.Contracts;

namespace IPCManagement.Api.Features.Catalog.Services;

public interface IDishBomTemplateService
{
    Task<(byte[] Content, string FileName)> BuildAsync(BomTemplateQueryDto query, CancellationToken cancellationToken = default);
}
