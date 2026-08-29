using FluentAssertions;
using IPCManagement.Api.Exceptions;
using IPCManagement.Api.Models.Entities;
using NSubstitute;
using Xunit;

namespace IPCManagement.Api.Tests;

public sealed class Phase30InactiveWorkflowFenceTests
{
    [Theory]
    [InlineData("DEFAULT", "MATERIAL_RECONCILIATION")]
    [InlineData("MATERIAL_RECONCILIATION", "DEFAULT")]
    public async Task CreateAsync_FreezesInactiveFamilyThenResumesTheSameSourceWithoutDrift(
        string owningFamily,
        string inactiveMode)
    {
        var fixture = Phase30WarehouseReturnFamilyTests.CreateFixture(owningFamily, inactiveMode);
        var issueIdBefore = fixture.Request.IssueId;
        var sourceLineBefore = fixture.Request.Lines.Single().SourceIssueLineId;

        var inactive = () => fixture.Service.CreateAsync(fixture.Request, fixture.UserId);

        await inactive.Should().ThrowAsync<BusinessRuleException>()
            .WithMessage("*workflow nguồn đang hoạt động*");
        fixture.ReturnRepository.DidNotReceive().Add(Arg.Any<InventoryReturn>());
        await fixture.UnitOfWork.DidNotReceive().SaveChangesAsync();
        await fixture.StockLedger.DidNotReceiveWithAnyArgs().AddStockAsync(
            default!, default!, default!, default, default!, default!, default!, default!, default!, default!);

        fixture.RequestContext.Mode = owningFamily;
        var resumed = await fixture.Service.CreateAsync(fixture.Request, fixture.UserId);

        resumed.Should().NotBeNull();
        fixture.Request.IssueId.Should().Be(issueIdBefore);
        fixture.Request.Lines.Single().SourceIssueLineId.Should().Be(sourceLineBefore);
        fixture.ReturnRepository.Received(1).Add(Arg.Is<InventoryReturn>(created =>
            created.IssueId.SequenceEqual(fixture.Issue.IssueId)
            && created.Inventoryreturnlines.Single().SourceIssueLineId!.SequenceEqual(
                fixture.Issue.Inventoryissuelines.Single().IssueLineId)));
        await fixture.UnitOfWork.Received(1).SaveChangesAsync();
    }
}
