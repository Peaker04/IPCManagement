using IPCManagement.Api.Data;
using IPCManagement.Api.Exceptions;
using IPCManagement.Api.Helpers;
using IPCManagement.Api.Models.Entities;
using Microsoft.EntityFrameworkCore;

namespace IPCManagement.Api.Features.Coordination.Services;

internal static class CustomerWeekMenuTierInvariant
{
    internal static async Task<CustomerWeekMenuTier> RequireAsync(
        IpcManagementContext context,
        byte[] customerId,
        DateOnly weekStartDate,
        decimal requestedTier,
        CancellationToken cancellationToken = default)
    {
        var normalizedTier = DecimalPolicy.RoundMoney(requestedTier);
        var tier = context.Customerweekmenutiers.Local.FirstOrDefault(item =>
                item.CustomerId.SequenceEqual(customerId) && item.WeekStartDate == weekStartDate)
            ?? await context.Customerweekmenutiers.FirstOrDefaultAsync(
                item => item.CustomerId == customerId && item.WeekStartDate == weekStartDate,
                cancellationToken);

        if (tier is null)
        {
            var persistedPrices = await context.Menuschedules
                .AsNoTracking()
                .Where(item => item.CustomerId == customerId && item.WeekStartDate == weekStartDate)
                .Select(item => item.MenuPrice)
                .Distinct()
                .ToListAsync(cancellationToken);
            var trackedPrices = context.Menuschedules.Local
                .Where(item => item.CustomerId.SequenceEqual(customerId) && item.WeekStartDate == weekStartDate)
                .Select(item => DecimalPolicy.RoundMoney(item.MenuPrice));
            var existingPrices = persistedPrices
                .Select(DecimalPolicy.RoundMoney)
                .Concat(trackedPrices)
                .Distinct()
                .ToList();
            if (existingPrices.Count > 1)
            {
                throw new BusinessRuleException(
                    $"Tuần {weekStartDate:dd/MM/yyyy} đang có nhiều định mức trong dữ liệu lịch. " +
                    "Hãy rollback/xóa toàn bộ lịch DRAFT xung đột trước khi tạo lại.");
            }

            if (existingPrices.Count == 1 && existingPrices[0] != normalizedTier)
            {
                throw TierConflict(weekStartDate, existingPrices[0], normalizedTier);
            }

            tier = new CustomerWeekMenuTier
            {
                TierId = GuidHelper.NewId(),
                CustomerId = customerId,
                WeekStartDate = weekStartDate,
                PriceTierAmount = normalizedTier,
                CreatedAt = DateTime.UtcNow
            };
            context.Customerweekmenutiers.Add(tier);
            return tier;
        }

        if (tier.PriceTierAmount != normalizedTier)
        {
            throw TierConflict(weekStartDate, tier.PriceTierAmount, normalizedTier);
        }

        return tier;
    }

    private static BusinessRuleException TierConflict(
        DateOnly weekStartDate,
        decimal canonicalTier,
        decimal requestedTier)
        => new(
            $"Tuần {weekStartDate:dd/MM/yyyy} đã khóa định mức {canonicalTier:N0} cho khách hàng này; " +
            $"không thể gán định mức {requestedTier:N0}. Hãy giữ định mức hiện tại hoặc rollback/xóa toàn bộ lịch DRAFT của tuần trước khi tạo lại.");
}
