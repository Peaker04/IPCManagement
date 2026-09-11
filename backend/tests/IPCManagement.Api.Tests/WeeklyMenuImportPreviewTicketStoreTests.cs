using FluentAssertions;
using IPCManagement.Api.Exceptions;
using IPCManagement.Api.Features.SampleData.Services;
using Microsoft.Extensions.Caching.Memory;

namespace IPCManagement.Api.Tests;

public class WeeklyMenuImportPreviewTicketStoreTests
{
    [Fact]
    public void Validate_Should_AcceptExactPreviewAndRejectChangedBytesOrScope()
    {
        using var cache = new MemoryCache(new MemoryCacheOptions());
        var store = new WeeklyMenuImportPreviewTicketStore(cache);
        var issued = store.Issue("ABC123", "customer-1", new DateOnly(2026, 8, 3), 25000m, "parser-v1");

        store.Validate(issued.Token, "ABC123", "customer-1", new DateOnly(2026, 8, 3), 25000m, "parser-v1")
            .Should().NotBeNull();

        var changedBytes = () => store.Validate(
            issued.Token, "DIFFERENT", "customer-1", new DateOnly(2026, 8, 3), 25000m, "parser-v1");
        changedBytes.Should().Throw<BusinessRuleException>()
            .WithMessage("File hoặc phạm vi import đã thay đổi sau khi xem trước. Vui lòng kiểm tra lại file.");

        var changedCustomer = () => store.Validate(
            issued.Token, "ABC123", "customer-2", new DateOnly(2026, 8, 3), 25000m, "parser-v1");
        changedCustomer.Should().Throw<BusinessRuleException>()
            .WithMessage("File hoặc phạm vi import đã thay đổi sau khi xem trước. Vui lòng kiểm tra lại file.");
    }

    [Fact]
    public void Validate_Should_RejectMissingUnknownAndConsumedTickets()
    {
        using var cache = new MemoryCache(new MemoryCacheOptions());
        var store = new WeeklyMenuImportPreviewTicketStore(cache);

        var missing = () => store.Validate(null, "ABC", "customer-1", new DateOnly(2026, 8, 3), 25000m, "parser-v1");
        missing.Should().Throw<BusinessRuleException>()
            .WithMessage("Thiếu phiên xem trước hợp lệ. Vui lòng kiểm tra file trước khi lưu.");

        var unknown = () => store.Validate("unknown", "ABC", "customer-1", new DateOnly(2026, 8, 3), 25000m, "parser-v1");
        unknown.Should().Throw<BusinessRuleException>()
            .WithMessage("Phiên xem trước đã hết hạn hoặc không còn hợp lệ. Vui lòng kiểm tra lại file.");

        var issued = store.Issue("ABC", "customer-1", new DateOnly(2026, 8, 3), 25000m, "parser-v1");
        store.Consume(issued.Token);
        var replay = () => store.Validate(issued.Token, "ABC", "customer-1", new DateOnly(2026, 8, 3), 25000m, "parser-v1");
        replay.Should().Throw<BusinessRuleException>()
            .WithMessage("Phiên xem trước đã hết hạn hoặc không còn hợp lệ. Vui lòng kiểm tra lại file.");
    }

    [Fact]
    public void Validate_Should_RejectParserVersionDrift()
    {
        using var cache = new MemoryCache(new MemoryCacheOptions());
        var store = new WeeklyMenuImportPreviewTicketStore(cache);
        var issued = store.Issue("ABC", "customer-1", new DateOnly(2026, 8, 3), 25000m, "parser-v1");

        var changedParser = () => store.Validate(
            issued.Token, "ABC", "customer-1", new DateOnly(2026, 8, 3), 25000m, "parser-v2");

        changedParser.Should().Throw<BusinessRuleException>()
            .WithMessage("File hoặc phạm vi import đã thay đổi sau khi xem trước. Vui lòng kiểm tra lại file.");
    }
}
