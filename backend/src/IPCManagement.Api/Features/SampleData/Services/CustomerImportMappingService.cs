using IPCManagement.Api.Data;
using IPCManagement.Api.Features.SampleData.Contracts;
using IPCManagement.Api.Helpers;
using IPCManagement.Api.Models.Entities;
using Microsoft.EntityFrameworkCore;

namespace IPCManagement.Api.Features.SampleData.Services;

internal sealed class CustomerImportMappingService(
    IpcManagementContext context,
    WeeklyMenuCustomerResolver customerResolver) : ICustomerImportMappingService
{
    public async Task<CustomerImportMappingDto?> GetCustomerImportMappingAsync(
        string customerId,
        CancellationToken cancellationToken = default)
    {
        var customer = await customerResolver.ResolveAsync(customerId, cancellationToken);
        var mapping = await context.Customerimportmappings
            .AsNoTracking()
            .FirstOrDefaultAsync(
                item => item.CustomerId.SequenceEqual(customer.CustomerId),
                cancellationToken);
        return mapping is null ? null : ToDto(customerId, mapping);
    }

    public async Task<CustomerImportMappingDto> SaveCustomerImportMappingAsync(
        string customerId,
        SaveCustomerImportMappingRequest request,
        CancellationToken cancellationToken = default)
    {
        var customer = await customerResolver.ResolveAsync(customerId, cancellationToken);
        var mapping = await context.Customerimportmappings.FirstOrDefaultAsync(
            item => item.CustomerId.SequenceEqual(customer.CustomerId),
            cancellationToken);

        var now = DateTime.UtcNow;
        if (mapping is null)
        {
            mapping = new CustomerImportMapping
            {
                MappingId = GuidHelper.NewId(),
                CustomerId = customer.CustomerId,
                CreatedAt = now
            };
            context.Customerimportmappings.Add(mapping);
        }

        mapping.SheetNameHint = string.IsNullOrWhiteSpace(request.SheetNameHint)
            ? null
            : request.SheetNameHint.Trim();
        mapping.LabelColumn = string.IsNullOrWhiteSpace(request.LabelColumn)
            ? null
            : request.LabelColumn.Trim().ToUpperInvariant();
        mapping.UpdatedAt = now;
        await context.SaveChangesAsync(cancellationToken);
        return ToDto(customerId, mapping);
    }

    private static CustomerImportMappingDto ToDto(string customerId, CustomerImportMapping mapping)
        => new()
        {
            CustomerId = customerId,
            SheetNameHint = mapping.SheetNameHint,
            LabelColumn = mapping.LabelColumn
        };
}
