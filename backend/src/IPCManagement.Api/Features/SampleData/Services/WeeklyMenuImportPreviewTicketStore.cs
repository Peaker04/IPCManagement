using System.Security.Cryptography;
using IPCManagement.Api.Exceptions;
using Microsoft.Extensions.Caching.Memory;

namespace IPCManagement.Api.Features.SampleData.Services;

internal sealed record WeeklyMenuImportPreviewTicket(
    string Checksum,
    string CustomerId,
    DateOnly WeekStartDate,
    decimal PriceTierAmount,
    DateTimeOffset ExpiresAt);

internal sealed record IssuedWeeklyMenuImportPreviewTicket(string Token, DateTimeOffset ExpiresAt);

internal sealed class WeeklyMenuImportPreviewTicketStore(IMemoryCache cache)
{
    private static readonly TimeSpan Lifetime = TimeSpan.FromMinutes(15);
    private const string CachePrefix = "WeeklyMenuImportPreview:";

    internal IssuedWeeklyMenuImportPreviewTicket Issue(
        string checksum,
        string customerId,
        DateOnly weekStartDate,
        decimal priceTierAmount)
    {
        var token = Convert.ToHexString(RandomNumberGenerator.GetBytes(32));
        var expiresAt = DateTimeOffset.UtcNow.Add(Lifetime);
        cache.Set(
            CachePrefix + token,
            new WeeklyMenuImportPreviewTicket(
                checksum,
                customerId,
                weekStartDate,
                priceTierAmount,
                expiresAt),
            expiresAt);
        return new IssuedWeeklyMenuImportPreviewTicket(token, expiresAt);
    }

    internal WeeklyMenuImportPreviewTicket Validate(
        string? token,
        string checksum,
        string customerId,
        DateOnly weekStartDate,
        decimal priceTierAmount)
    {
        if (string.IsNullOrWhiteSpace(token))
        {
            throw new BusinessRuleException(
                "Thiếu phiên xem trước hợp lệ. Vui lòng kiểm tra file trước khi lưu.");
        }

        if (!cache.TryGetValue<WeeklyMenuImportPreviewTicket>(CachePrefix + token, out var ticket) ||
            ticket is null || ticket.ExpiresAt <= DateTimeOffset.UtcNow)
        {
            throw new BusinessRuleException(
                "Phiên xem trước đã hết hạn hoặc không còn hợp lệ. Vui lòng kiểm tra lại file.");
        }

        if (!string.Equals(ticket.Checksum, checksum, StringComparison.Ordinal) ||
            !string.Equals(ticket.CustomerId, customerId, StringComparison.OrdinalIgnoreCase) ||
            ticket.WeekStartDate != weekStartDate ||
            ticket.PriceTierAmount != priceTierAmount)
        {
            throw new BusinessRuleException(
                "File hoặc phạm vi import đã thay đổi sau khi xem trước. Vui lòng kiểm tra lại file.");
        }

        return ticket;
    }

    internal void Consume(string token) => cache.Remove(CachePrefix + token);
}
