using FluentAssertions;
using IPCManagement.Api.Exceptions;
using IPCManagement.Api.Features.Purchasing.Services;
using IPCManagement.Api.Models.Entities;

namespace IPCManagement.Api.Tests;

public class PurchaseRequestGenerationPolicyTests
{
    [Theory]
    [InlineData("MANAGERAPPROVED")]
    [InlineData("approved")]
    public void ValidateApprovedFullDayDemand_Should_AcceptApprovedDemand(string status)
    {
        var demand = CreateDemand(status: status);

        var act = () => PurchaseRequestGenerationPolicy.ValidateApprovedFullDayDemand(demand);

        act.Should().NotThrow();
    }

    [Theory]
    [InlineData("DRAFT", "FULLDAY", "Cần duyệt nhu cầu")]
    [InlineData("APPROVED", "MORNING", "Cả ngày")]
    public void ValidateApprovedFullDayDemand_Should_RejectIneligibleDemand(
        string status,
        string scope,
        string expectedMessage)
    {
        var demand = CreateDemand(status: status, scope: scope);

        var act = () => PurchaseRequestGenerationPolicy.ValidateApprovedFullDayDemand(demand);

        act.Should()
            .Throw<BusinessRuleException>()
            .WithMessage($"*{expectedMessage}*");
    }

    [Fact]
    public void BuildRequestCode_Should_UseCanonicalFullDaySegment()
    {
        var demand = CreateDemand(status: "APPROVED");

        PurchaseRequestGenerationPolicy.BuildRequestCode(demand)
            .Should().Be("PR-20260728-FULLDAY");
    }

    [Fact]
    public void BelongsToCurrentDemand_Should_AcceptCompatibleDateAndFullDayScope()
    {
        var demandLineId = new byte[] { 1 };
        var demand = CreateDemand(status: "APPROVED");
        demand.Materialrequestlines.Add(new MaterialRequestLine { RequestLineId = demandLineId });
        var existing = new PurchaseRequest
        {
            PurchaseForDate = demand.RequestDate,
            ShiftName = null,
            Purchaserequestlines =
            {
                new PurchaseRequestLine { MaterialRequestLineId = demandLineId }
            }
        };

        PurchaseRequestGenerationPolicy.BelongsToCurrentDemand(existing, demand).Should().BeTrue();

        existing.Purchaserequestlines.Single().MaterialRequestLineId = [2];
        PurchaseRequestGenerationPolicy.BelongsToCurrentDemand(existing, demand).Should().BeTrue();

        existing.PurchaseForDate = demand.RequestDate.AddDays(1);
        PurchaseRequestGenerationPolicy.BelongsToCurrentDemand(existing, demand).Should().BeFalse();
    }

    private static MaterialRequest CreateDemand(
        string status,
        string scope = "FULLDAY")
        => new()
        {
            RequestDate = new DateOnly(2026, 7, 28),
            RequestScope = scope,
            Status = status
        };
}
