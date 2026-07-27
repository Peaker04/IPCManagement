
using IPCManagement.Api.Shared.Contracts;

namespace IPCManagement.Api.Features.Purchasing.Contracts;

public sealed class PurchaseOrderPageDto
{
    public PagedResponseDto<PurchaseOrderDto> Page { get; set; } = new();
    public IReadOnlyDictionary<string, int> OrderCountByRequest { get; set; } = new Dictionary<string, int>();
}
