using FluentAssertions;
using IPCManagement.Api.Features.Purchasing.Services;
using IPCManagement.Api.Models.Entities;

namespace IPCManagement.Api.Tests;

public class PurchaseRequestSubmissionPolicyTests
{
    [Fact]
    public void ValidateCurrentSupplierDecisions_Should_AcceptMatchingCurrentDecision()
    {
        var request = CreateRequest("APPROVED");

        var act = () => PurchaseRequestSubmissionPolicy.ValidateCurrentSupplierDecisions(request);

        act.Should().NotThrow();
    }

    [Fact]
    public void ValidateCurrentSupplierDecisions_Should_RejectStaleDecision()
    {
        var request = CreateRequest("APPROVED");
        request.Purchaserequestlines.Single().EstimatedUnitPrice = 101m;

        var act = () => PurchaseRequestSubmissionPolicy.ValidateCurrentSupplierDecisions(request);

        act.Should()
            .Throw<InvalidOperationException>()
            .WithMessage("*quyết định nhà cung cấp hiện hành*");
    }

    [Theory]
    [InlineData("APPROVED", false)]
    [InlineData("REJECTED", true)]
    [InlineData("PENDING", true)]
    public void ValidatePriceExceptions_Should_RequireApprovedCurrentException(
        string exceptionStatus,
        bool shouldThrow)
    {
        var request = CreateRequest(exceptionStatus);
        var act = () => PurchaseRequestSubmissionPolicy.ValidatePriceExceptions(request);

        if (shouldThrow)
        {
            act.Should().Throw<InvalidOperationException>();
        }
        else
        {
            act.Should().NotThrow();
        }
    }

    private static PurchaseRequest CreateRequest(string exceptionStatus)
    {
        var supplierId = new byte[] { 1 };
        var decision = new PurchaseLineSupplierDecision
        {
            SupplierId = supplierId,
            Status = "CURRENT",
            EvidenceReferencePrice = 100m,
            ProposedUnitPrice = 120m,
            ProposedDeliveryDate = new DateOnly(2026, 7, 29),
            DecisionFingerprint = "fingerprint",
            Version = 1
        };
        decision.Purchasepriceexceptions.Add(new PurchasePriceException
        {
            ProposalFingerprint = decision.DecisionFingerprint,
            ProposalVersion = decision.Version,
            Status = exceptionStatus
        });

        var line = new PurchaseRequestLine
        {
            SupplierId = supplierId,
            EstimatedUnitPrice = decision.ProposedUnitPrice,
            ExpectedDeliveryDate = decision.ProposedDeliveryDate
        };
        line.SupplierDecisions.Add(decision);

        var request = new PurchaseRequest();
        request.Purchaserequestlines.Add(line);
        return request;
    }
}

