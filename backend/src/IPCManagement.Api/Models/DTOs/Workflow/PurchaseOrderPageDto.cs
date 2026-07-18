using IPCManagement.Api.Models.DTOs.Common;

namespace IPCManagement.Api.Models.DTOs.Workflow;

public sealed class PurchaseOrderPageDto
{
    public PagedResponseDto<PurchaseOrderDto> Page { get; set; } = new();
    public IReadOnlyDictionary<string, int> OrderCountByRequest { get; set; } = new Dictionary<string, int>();
}
