using IPCManagement.Api.Data;
using IPCManagement.Api.Helpers;
using Microsoft.EntityFrameworkCore;

namespace IPCManagement.Api.Features.SampleData.Services;

internal sealed class WeeklyMenuTemplateService(IpcManagementContext context) : IWeeklyMenuTemplateService
{
    public async Task<(byte[] Content, string CustomerCode)> BuildWeeklyMenuTemplateAsync(
        string? customerId,
        DateOnly? weekStartDate,
        CancellationToken cancellationToken = default)
    {
        cancellationToken.ThrowIfCancellationRequested();
        var resolvedWeekStart = weekStartDate ?? ResolveCurrentWeekStart();
        var customerCode = "IPC";
        var customerBytes = GuidHelper.ParseFilterIdOrThrow(customerId, "khách hàng");
        if (customerBytes is not null)
        {
            customerCode = await context.Customers
                .AsNoTracking()
                .Where(customer =>
                    customer.CustomerId.SequenceEqual(customerBytes) && customer.IsActive != false)
                .Select(customer => customer.CustomerCode)
                .FirstOrDefaultAsync(cancellationToken) ?? customerCode;
        }

        var content = string.Equals(customerCode, "ANV", StringComparison.OrdinalIgnoreCase)
            ? ReadEmbeddedAnvWeeklyMenuTemplate()
            : WeeklyMenuTemplateWorkbookBuilder.Build(resolvedWeekStart, customerCode);
        return (content, customerCode);
    }

    private static byte[] ReadEmbeddedAnvWeeklyMenuTemplate()
    {
        const string resourceName =
            "IPCManagement.Api.Resources.Templates.weekly-menu-template-ANV-default.xlsx";
        using var resourceStream = typeof(WeeklyMenuTemplateService).Assembly
            .GetManifestResourceStream(resourceName)
            ?? throw new InvalidOperationException(
                "Không tìm thấy template thực đơn ANV mặc định trong ứng dụng.");
        using var output = new MemoryStream();
        resourceStream.CopyTo(output);
        return output.ToArray();
    }

    private static DateOnly ResolveCurrentWeekStart()
    {
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var offset = ((int)today.DayOfWeek + 6) % 7;
        return today.AddDays(-offset);
    }
}
