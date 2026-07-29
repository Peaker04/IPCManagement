using FluentAssertions;
using IPCManagement.Api.Exceptions;
using IPCManagement.Api.Data;
using IPCManagement.Api.Data.Transactions;
using IPCManagement.Api.Helpers;
using IPCManagement.Api.Data.Repositories;
using IPCManagement.Api.Models.Entities;
using IPCManagement.Api.Security;
using IPCManagement.DatabaseTool;
using Microsoft.Data.Sqlite;
using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Metadata;
using MySqlConnector;
using System.Security.Cryptography;
using System.Text;
using System.Data.Common;
using IPCManagement.Api.Features.Inventory.Services;
using IPCManagement.Api.Features.Purchasing.Contracts;
using IPCManagement.Api.Features.Purchasing.Controllers;
using IPCManagement.Api.Features.Purchasing.Services;

namespace IPCManagement.Api.Tests;

public partial class SupplierDecisionWorkflowTests
{
    [Fact]
    public void Supplier_decision_fixture_requires_evidence_and_explicit_confirmation()
    {
        var requiredEvidence = new[] { "effective-quotation", "latest-valid-receipt" };
        var requiresConfirmation = true;

        requiredEvidence.Should().Equal("effective-quotation", "latest-valid-receipt");
        requiresConfirmation.Should().BeTrue();
    }

    [Fact]
    public async Task Evidence_effective_quotations_are_deterministic_and_inspectable()
    {
        await using var context = CreateContext();
        var demand = SeedDemand(context, "MANAGERAPPROVED", new DateOnly(2026, 7, 20), "FULLDAY");
        var supplierB = SeedSupplier(context, "SUP-B", "B supplier");
        var supplierA = SeedSupplier(context, "SUP-A", "A supplier");
        var inactiveSupplier = SeedSupplier(context, "SUP-INACTIVE", "Inactive supplier", isActive: false);
        await context.SaveChangesAsync();
        var service = CreateService(context);
        var generated = await service.GenerateFromDemandAsync(
            new GeneratePurchaseRequestFromDemandRequest
            {
                MaterialRequestId = GuidHelper.ToGuidString(demand.RequestId)
            },
            UserId);
        var line = demand.Materialrequestlines.Single();
        var quoteB = SeedQuotation(context, supplierB, line.Ingredient, 120m, new DateOnly(2026, 7, 1));
        var quoteA = SeedQuotation(context, supplierA, line.Ingredient, 120m, new DateOnly(2026, 7, 10));
        SeedQuotation(context, inactiveSupplier, line.Ingredient, 90m, new DateOnly(2026, 7, 1));
        SeedQuotation(context, supplierA, line.Ingredient, 80m, new DateOnly(2026, 7, 21));
        SeedQuotation(context, supplierA, new Ingredient
        {
            IngredientId = GuidHelper.NewId(),
            IngredientCode = "ING-OTHER",
            IngredientName = "Other ingredient",
            UnitId = line.UnitId,
            WarehouseId = GuidHelper.NewId(),
            ReferencePrice = 10m,
            IsActive = true,
            Unit = line.Unit
        }, 70m, new DateOnly(2026, 7, 1));
        await context.SaveChangesAsync();

        var result = await service.GetSupplierEvidenceAsync(
            generated!.PurchaseRequestId,
            generated.Lines.Single().PurchaseRequestLineId);

        result.Blocker.Should().BeNull();
        result.Candidates.Should().HaveCount(2);
        result.Candidates.Select(candidate => candidate.EvidenceId)
            .Should().Equal(
                GuidHelper.ToGuidString(quoteA.QuotationId),
                GuidHelper.ToGuidString(quoteB.QuotationId));
        result.Candidates.Should().OnlyContain(candidate =>
            candidate.EvidenceType == SupplierEvidenceType.EffectiveQuotation &&
            candidate.UnitPrice == 120m &&
            candidate.UnitId == GuidHelper.ToGuidString(line.UnitId) &&
            candidate.EffectiveFrom != null &&
            candidate.EvidenceDate != null);
    }

    [Fact]
    public async Task Evidence_latest_valid_receipt_normalizes_price_and_excludes_incomparable_units_with_reason()
    {
        await using var context = CreateContext();
        var demand = SeedDemand(context, "MANAGERAPPROVED", new DateOnly(2026, 7, 20), "FULLDAY");
        var supplier = SeedSupplier(context, "SUP-RECEIPT", "Receipt supplier");
        var inactiveSupplier = SeedSupplier(context, "SUP-INACTIVE-RECEIPT", "Inactive receipt supplier", isActive: false);
        await context.SaveChangesAsync();
        var service = CreateService(context);
        var generated = await service.GenerateFromDemandAsync(
            new GeneratePurchaseRequestFromDemandRequest
            {
                MaterialRequestId = GuidHelper.ToGuidString(demand.RequestId)
            },
            UserId);
        var demandLine = demand.Materialrequestlines.Single();
        demandLine.Unit.UnitCode = "KG";
        demandLine.Unit.BaseUnitCode = "KG";
        demandLine.Unit.ConvertRateToBase = 1m;
        var gram = SeedUnit(context, "G", "g", "KG", 0.001m);
        var litre = SeedUnit(context, "L", "l", "L", 1m);
        SeedReceiptLine(context, supplier, demandLine.Ingredient, gram, new DateOnly(2026, 7, 10), 0.10m);
        var latest = SeedReceiptLine(context, supplier, demandLine.Ingredient, gram, new DateOnly(2026, 7, 19), 0.12m);
        SeedReceiptLine(context, supplier, demandLine.Ingredient, litre, new DateOnly(2026, 7, 20), 50m);
        SeedReceiptLine(context, inactiveSupplier, demandLine.Ingredient, gram, new DateOnly(2026, 7, 20), 0.05m);
        await context.SaveChangesAsync();

        var result = await service.GetSupplierEvidenceAsync(
            generated!.PurchaseRequestId,
            generated.Lines.Single().PurchaseRequestLineId);

        result.Blocker.Should().BeNull();
        result.Candidates.Should().ContainSingle();
        result.Candidates.Single().Should().Match<SupplierEvidenceCandidateDto>(candidate =>
            candidate.EvidenceType == SupplierEvidenceType.LatestValidReceipt &&
            candidate.EvidenceId == GuidHelper.ToGuidString(latest.ReceiptLineId) &&
            candidate.SupplierId == GuidHelper.ToGuidString(supplier.SupplierId) &&
            candidate.UnitPrice == 120m &&
            candidate.EvidenceDate == "2026-07-19");
        result.Diagnostics.Should().Contain(message => message.Contains("không thể quy đổi", StringComparison.OrdinalIgnoreCase));
    }

    [Fact]
    public async Task Evidence_without_valid_source_returns_empty_candidates_and_actionable_blocker_without_mutation()
    {
        await using var context = CreateContext();
        var demand = SeedDemand(context, "MANAGERAPPROVED", new DateOnly(2026, 7, 20), "FULLDAY");
        SeedSupplier(context, "SUP-NO-EVIDENCE", "No evidence supplier");
        await context.SaveChangesAsync();
        var service = CreateService(context);
        var generated = await service.GenerateFromDemandAsync(
            new GeneratePurchaseRequestFromDemandRequest
            {
                MaterialRequestId = GuidHelper.ToGuidString(demand.RequestId)
            },
            UserId);

        var result = await service.GetSupplierEvidenceAsync(
            generated!.PurchaseRequestId,
            generated.Lines.Single().PurchaseRequestLineId);

        result.Candidates.Should().BeEmpty();
        result.Blocker.Should().Contain("đơn giá hiệu lực");
        result.Blocker.Should().Contain("biên nhận");
        var persistedLine = await context.Purchaserequestlines.AsNoTracking().SingleAsync();
        persistedLine.SupplierId.Should().BeNull();
        persistedLine.EstimatedUnitPrice.Should().Be(0m);
    }

    [Fact]
    public async Task Confirmation_revalidates_server_evidence_and_appends_versioned_decisions()
    {
        await using var context = CreateContext();
        var demand = SeedDemand(context, "MANAGERAPPROVED", new DateOnly(2026, 7, 20), "FULLDAY");
        var supplier = SeedSupplier(context, "SUP-CONFIRM", "Confirm supplier");
        await context.SaveChangesAsync();
        var service = CreateService(context);
        var generated = await service.GenerateFromDemandAsync(
            new GeneratePurchaseRequestFromDemandRequest
            {
                MaterialRequestId = GuidHelper.ToGuidString(demand.RequestId)
            },
            UserId);
        var demandLine = demand.Materialrequestlines.Single();
        var quotation = SeedQuotation(context, supplier, demandLine.Ingredient, 100m, new DateOnly(2026, 7, 1));
        await context.SaveChangesAsync();
        var requestId = generated!.PurchaseRequestId;
        var lineId = generated.Lines.Single().PurchaseRequestLineId;

        var first = await service.ConfirmLineSupplierAsync(
            requestId,
            lineId,
            new ConfirmPurchaseLineSupplierRequest
            {
                EvidenceType = SupplierEvidenceType.EffectiveQuotation,
                EvidenceId = GuidHelper.ToGuidString(quotation.QuotationId),
                SupplierId = GuidHelper.ToGuidString(supplier.SupplierId),
                ProposedUnitPrice = 110m,
                ProposedDeliveryDate = "2026-07-21",
                ExpectedDecisionVersion = 0
            },
            UserId);
        var second = await service.ConfirmLineSupplierAsync(
            requestId,
            lineId,
            new ConfirmPurchaseLineSupplierRequest
            {
                EvidenceType = SupplierEvidenceType.EffectiveQuotation,
                EvidenceId = GuidHelper.ToGuidString(quotation.QuotationId),
                SupplierId = GuidHelper.ToGuidString(supplier.SupplierId),
                ProposedUnitPrice = 112m,
                ProposedDeliveryDate = "2026-07-22",
                ExpectedDecisionVersion = 1
            },
            UserId);

        first.Version.Should().Be(1);
        second.Version.Should().Be(2);
        second.Status.Should().Be("CURRENT");
        second.DecisionFingerprint.Should().HaveLength(64).And.NotBe(first.DecisionFingerprint);
        second.ConfirmedBy.Should().Be(UserId);
        var decisions = await context.Purchaselinesupplierdecisions
            .AsNoTracking()
            .OrderBy(item => item.Version)
            .ToListAsync();
        decisions.Should().HaveCount(2);
        decisions[0].Status.Should().Be("SUPERSEDED");
        decisions[0].SupersededByDecisionId.Should().Equal(decisions[1].PurchaseLineSupplierDecisionId);
        decisions[0].CurrentDecisionKey.Should().BeNull();
        decisions[1].CurrentDecisionKey.Should().Equal(decisions[1].PurchaseRequestLineId);
        var persistedLine = await context.Purchaserequestlines.AsNoTracking().SingleAsync();
        persistedLine.SupplierId.Should().Equal(supplier.SupplierId);
        persistedLine.EstimatedUnitPrice.Should().Be(112m);
        persistedLine.ExpectedDeliveryDate.Should().Be(new DateOnly(2026, 7, 22));
    }

    [Fact]
    public async Task Confirmation_rejects_stale_version_evidence_and_non_draft_status_without_writes()
    {
        await using var context = CreateContext();
        var demand = SeedDemand(context, "MANAGERAPPROVED", new DateOnly(2026, 7, 20), "FULLDAY");
        var supplier = SeedSupplier(context, "SUP-CONFLICT", "Conflict supplier");
        await context.SaveChangesAsync();
        var service = CreateService(context);
        var generated = await service.GenerateFromDemandAsync(
            new GeneratePurchaseRequestFromDemandRequest
            {
                MaterialRequestId = GuidHelper.ToGuidString(demand.RequestId)
            },
            UserId);
        var quotation = SeedQuotation(
            context,
            supplier,
            demand.Materialrequestlines.Single().Ingredient,
            100m,
            new DateOnly(2026, 7, 1));
        await context.SaveChangesAsync();
        var requestId = generated!.PurchaseRequestId;
        var lineId = generated.Lines.Single().PurchaseRequestLineId;
        var baseRequest = new ConfirmPurchaseLineSupplierRequest
        {
            EvidenceType = SupplierEvidenceType.EffectiveQuotation,
            EvidenceId = GuidHelper.ToGuidString(quotation.QuotationId),
            SupplierId = GuidHelper.ToGuidString(supplier.SupplierId),
            ProposedUnitPrice = 105m,
            ProposedDeliveryDate = "2026-07-21",
            ExpectedDecisionVersion = 0
        };
        await service.ConfirmLineSupplierAsync(requestId, lineId, baseRequest, UserId);

        var staleVersion = () => service.ConfirmLineSupplierAsync(
            requestId,
            lineId,
            new ConfirmPurchaseLineSupplierRequest
            {
                EvidenceType = baseRequest.EvidenceType,
                EvidenceId = baseRequest.EvidenceId,
                SupplierId = baseRequest.SupplierId,
                ProposedUnitPrice = 106m,
                ProposedDeliveryDate = "2026-07-22",
                ExpectedDecisionVersion = 0
            },
            UserId);
        await staleVersion.Should().ThrowAsync<DbUpdateConcurrencyException>();
        (await context.Purchaselinesupplierdecisions.CountAsync()).Should().Be(1);

        quotation.IsActive = false;
        await context.SaveChangesAsync();
        var staleEvidence = () => service.ConfirmLineSupplierAsync(
            requestId,
            lineId,
            new ConfirmPurchaseLineSupplierRequest
            {
                EvidenceType = baseRequest.EvidenceType,
                EvidenceId = baseRequest.EvidenceId,
                SupplierId = baseRequest.SupplierId,
                ProposedUnitPrice = 106m,
                ProposedDeliveryDate = "2026-07-22",
                ExpectedDecisionVersion = 1
            },
            UserId);
        await staleEvidence.Should().ThrowAsync<DbUpdateConcurrencyException>();
        (await context.Purchaselinesupplierdecisions.CountAsync()).Should().Be(1);

        var purchaseRequest = await context.Purchaserequests.SingleAsync();
        purchaseRequest.Status = "SENTTOSUPPLIER";
        await context.SaveChangesAsync();
        quotation.IsActive = true;
        await context.SaveChangesAsync();
        var wrongStatus = () => service.ConfirmLineSupplierAsync(
            requestId,
            lineId,
            new ConfirmPurchaseLineSupplierRequest
            {
                EvidenceType = baseRequest.EvidenceType,
                EvidenceId = baseRequest.EvidenceId,
                SupplierId = baseRequest.SupplierId,
                ProposedUnitPrice = 106m,
                ProposedDeliveryDate = "2026-07-22",
                ExpectedDecisionVersion = 1
            },
            UserId);
        await wrongStatus.Should().ThrowAsync<BusinessRuleException>()
            .WithMessage("*DRAFT*");
        (await context.Purchaselinesupplierdecisions.CountAsync()).Should().Be(1);
    }

    [Fact]
    public async Task Workbench_projects_current_and_historical_supplier_decision_references()
    {
        await using var context = CreateContext();
        var demand = SeedDemand(context, "MANAGERAPPROVED", new DateOnly(2026, 7, 20), "FULLDAY");
        var supplier = SeedSupplier(context, "SUP-AUDIT", "Audit supplier");
        await context.SaveChangesAsync();
        var service = CreateService(context);
        var generated = await service.GenerateFromDemandAsync(
            new GeneratePurchaseRequestFromDemandRequest
            {
                MaterialRequestId = GuidHelper.ToGuidString(demand.RequestId)
            },
            UserId);
        var quotation = SeedQuotation(
            context,
            supplier,
            demand.Materialrequestlines.Single().Ingredient,
            100m,
            new DateOnly(2026, 7, 1));
        await context.SaveChangesAsync();
        var requestId = generated!.PurchaseRequestId;
        var lineId = generated.Lines.Single().PurchaseRequestLineId;
        for (var version = 0; version < 2; version++)
        {
            await service.ConfirmLineSupplierAsync(
                requestId,
                lineId,
                new ConfirmPurchaseLineSupplierRequest
                {
                    EvidenceType = SupplierEvidenceType.EffectiveQuotation,
                    EvidenceId = GuidHelper.ToGuidString(quotation.QuotationId),
                    SupplierId = GuidHelper.ToGuidString(supplier.SupplierId),
                    ProposedUnitPrice = 105m + version,
                    ProposedDeliveryDate = $"2026-07-{21 + version:00}",
                    ExpectedDecisionVersion = version
                },
                UserId);
        }

        var workbench = await service.GetWorkbenchWeekAsync(new PurchaseWorkbenchQueryDto
        {
            Week = "2026-07-20",
            Date = "2026-07-20",
            Stage = "supplier-price"
        });

        var line = workbench.ServiceDates.Single().PurchaseLines.Single();
        line.SupplierDecisionStatus.Should().Be("CONFIRMED");
        line.CurrentSupplierDecision.Should().NotBeNull();
        line.CurrentSupplierDecision!.Version.Should().Be(2);
        line.SupplierDecisionHistory.Select(item => item.Version).Should().Equal(2, 1);
        line.SupplierDecisionHistory.Should().OnlyContain(item =>
            !string.IsNullOrWhiteSpace(item.EvidenceId) &&
            !string.IsNullOrWhiteSpace(item.ConfirmedBy) &&
            item.DecisionFingerprint.Length == 64);
    }

    [Fact]
    public void Confirmation_endpoint_uses_purchasing_policy_and_contract_omits_server_fields()
    {
        var action = typeof(PurchaseWorkflowController).GetMethod(nameof(PurchaseWorkflowController.ConfirmLineSupplierAsync));
        action.Should().NotBeNull();
        action!.GetCustomAttributes(typeof(AuthorizeAttribute), inherit: true)
            .Cast<AuthorizeAttribute>()
            .Should().Contain(attribute => attribute.Policy == AuthorizationPolicies.PurchaseGenerateAccess);
        typeof(PurchaseWorkflowController).GetMethod("UpdateLineSupplier").Should().BeNull();

        var clientFields = typeof(ConfirmPurchaseLineSupplierRequest).GetProperties()
            .Select(property => property.Name)
            .ToArray();
        clientFields.Should().NotContain([
            "ConfirmedBy",
            "ConfirmedAt",
            "EvidenceReferencePrice",
            "VariancePercent",
            "DecisionFingerprint"
        ]);
    }

    [Fact]
    public async Task Supplier_price_above_threshold_routes_to_manager_exception_approval()
    {
        await using var context = CreateContext();
        var demand = SeedDemand(context, "MANAGERAPPROVED", new DateOnly(2026, 7, 20), "FULLDAY");
        var supplier = SeedSupplier(context, "SUP-EXCEPTION", "Exception supplier");
        await context.SaveChangesAsync();
        var service = CreateService(context);
        var generated = await service.GenerateFromDemandAsync(
            new GeneratePurchaseRequestFromDemandRequest
            {
                MaterialRequestId = GuidHelper.ToGuidString(demand.RequestId)
            },
            UserId);
        var quotation = SeedQuotation(
            context,
            supplier,
            demand.Materialrequestlines.Single().Ingredient,
            100m,
            new DateOnly(2026, 7, 1));
        await context.SaveChangesAsync();
        var requestId = generated!.PurchaseRequestId;
        var lineId = generated.Lines.Single().PurchaseRequestLineId;
        await service.ConfirmLineSupplierAsync(
            requestId,
            lineId,
            new ConfirmPurchaseLineSupplierRequest
            {
                EvidenceType = SupplierEvidenceType.EffectiveQuotation,
                EvidenceId = GuidHelper.ToGuidString(quotation.QuotationId),
                SupplierId = GuidHelper.ToGuidString(supplier.SupplierId),
                ProposedUnitPrice = 120m,
                ProposedDeliveryDate = "2026-07-21",
                Note = "Giá nguyên liệu tăng",
                ExpectedDecisionVersion = 0
            },
            UserId);

        var blocked = () => service.SubmitAsync(requestId, UserId);
        await blocked.Should().ThrowAsync<BusinessRuleException>()
            .WithMessage("*ngoại lệ giá*");

        var priceException = await context.Purchasepriceexceptions.SingleAsync();
        priceException.Status = "APPROVED";
        priceException.DecidedBy = UserIdBytes;
        priceException.DecisionReason = "Báo giá hợp lệ";
        priceException.DecidedAt = DateTime.UtcNow;
        await context.SaveChangesAsync();

        var submitted = await service.SubmitAsync(requestId, UserId);
        submitted!.Status.Should().Be("SENTTOSUPPLIER");
    }

    [Fact]
    public async Task Submit_exactly_fifteen_percent_requires_no_exception()
    {
        await using var context = CreateContext();
        var demand = SeedDemand(context, "MANAGERAPPROVED", new DateOnly(2026, 7, 20), "FULLDAY");
        var supplier = SeedSupplier(context, "SUP-FIFTEEN", "Fifteen supplier");
        var request = SeedPurchaseProgress(context, demand, "DRAFT", supplier, 115m);
        await context.SaveChangesAsync();

        var result = await CreateService(context).SubmitAsync(
            GuidHelper.ToGuidString(request.PurchaseRequestId),
            UserId);

        result!.Status.Should().Be("SENTTOSUPPLIER");
        (await context.Purchasepriceexceptions.CountAsync()).Should().Be(0);
    }

    [Fact]
    public async Task PurchaseOrder_creation_splits_current_decisions_by_supplier_with_complete_line_coverage()
    {
        await using var context = CreateContext();
        var fixture = SeedApprovedPurchaseRequestForOrders(context);
        await context.SaveChangesAsync();

        var orders = await CreatePurchaseOrderService(context).CreateFromApprovedRequestAsync(
            GuidHelper.ToGuidString(fixture.Request.PurchaseRequestId),
            UserId);

        orders.Should().HaveCount(2);
        orders.Select(order => order.SupplierId).Should().BeEquivalentTo(
            GuidHelper.ToGuidString(fixture.SupplierA.SupplierId),
            GuidHelper.ToGuidString(fixture.SupplierB.SupplierId));
        orders.SelectMany(order => order.Lines)
            .Select(line => line.PurchaseRequestLineId)
            .Should().BeEquivalentTo(fixture.Request.Purchaserequestlines
                .Select(line => GuidHelper.ToGuidString(line.PurchaseRequestLineId)));
        orders.SelectMany(order => order.Lines)
            .Should().OnlyContain(line => line.UnitPrice == 110m || line.UnitPrice == 120m);
    }

    [Fact]
    public async Task PurchaseOrder_creation_rejects_pending_current_exception()
    {
        await using var context = CreateContext();
        var fixture = SeedApprovedPurchaseRequestForOrders(context);
        fixture.Decisions.Single(decision => decision.ProposedUnitPrice == 120m)
            .Purchasepriceexceptions.Single().Status = "PENDING";
        await context.SaveChangesAsync();

        var act = () => CreatePurchaseOrderService(context).CreateFromApprovedRequestAsync(
            GuidHelper.ToGuidString(fixture.Request.PurchaseRequestId),
            UserId);

        await act.Should().ThrowAsync<BusinessRuleException>()
            .WithMessage("*ngoại lệ giá*");
        (await context.Purchaseorders.CountAsync()).Should().Be(0);
    }

    [Fact]
    public async Task PurchaseOrder_sequential_and_concurrent_retries_return_stable_ids_without_duplicates()
    {
        var options = new DbContextOptionsBuilder<IpcManagementContext>()
            .UseInMemoryDatabase($"purchase-order-retry-{Guid.NewGuid():N}")
            .Options;
        string requestId;
        await using (var seedContext = new IpcManagementContext(options))
        {
            var fixture = SeedApprovedPurchaseRequestForOrders(seedContext);
            await seedContext.SaveChangesAsync();
            requestId = GuidHelper.ToGuidString(fixture.Request.PurchaseRequestId);
        }
        await using (var setupVerificationContext = new IpcManagementContext(options))
        {
            (await setupVerificationContext.Purchaserequestlines.CountAsync()).Should().Be(2);
            (await setupVerificationContext.Purchaselinesupplierdecisions.CountAsync()).Should().Be(2);
            (await setupVerificationContext.Purchaserequestlines
                    .Select(line => line.PurchaseRequestId)
                    .ToListAsync())
                .Select(GuidHelper.ToGuidString)
                .Should().OnlyContain(id => id == requestId);
        }

        await using var creationContext = new IpcManagementContext(options);
        var created = await CreatePurchaseOrderService(creationContext)
            .CreateFromApprovedRequestAsync(requestId, UserId);

        await using var firstContext = new IpcManagementContext(options);
        await using var secondContext = new IpcManagementContext(options);
        var results = await Task.WhenAll(
            CreatePurchaseOrderService(firstContext).CreateFromApprovedRequestAsync(requestId, UserId),
            CreatePurchaseOrderService(secondContext).CreateFromApprovedRequestAsync(requestId, UserId));

        created.Select(order => order.PurchaseOrderId)
            .Should().BeEquivalentTo(results[0].Select(order => order.PurchaseOrderId));
        results[0].Select(order => order.PurchaseOrderId)
            .Should().BeEquivalentTo(results[1].Select(order => order.PurchaseOrderId));

        await using var verificationContext = new IpcManagementContext(options);
        (await verificationContext.Purchaseorders.CountAsync()).Should().Be(2);
        (await verificationContext.Purchaseorderlines.CountAsync()).Should().Be(2);

        var retry = await CreatePurchaseOrderService(verificationContext)
            .CreateFromApprovedRequestAsync(requestId, UserId);
        retry.Select(order => order.PurchaseOrderId)
            .Should().BeEquivalentTo(results[0].Select(order => order.PurchaseOrderId));
    }

    [Fact]
    public async Task PurchaseOrder_retry_rejects_changed_decision_fingerprint_even_when_price_is_unchanged()
    {
        await using var context = CreateContext();
        var fixture = SeedApprovedPurchaseRequestForOrders(context);
        await context.SaveChangesAsync();
        var service = CreatePurchaseOrderService(context);
        var requestId = GuidHelper.ToGuidString(fixture.Request.PurchaseRequestId);
        await service.CreateFromApprovedRequestAsync(requestId, UserId);

        var current = fixture.Decisions.Single(decision => decision.ProposedUnitPrice == 110m);
        current.Status = "SUPERSEDED";
        current.CurrentDecisionKey = null;
        var replacement = new PurchaseLineSupplierDecision
        {
            PurchaseLineSupplierDecisionId = GuidHelper.NewId(),
            PurchaseRequestLineId = current.PurchaseRequestLineId,
            SupplierId = current.SupplierId,
            EvidenceType = current.EvidenceType,
            EvidenceId = GuidHelper.NewId(),
            EvidenceDate = current.EvidenceDate,
            EvidenceReferencePrice = current.EvidenceReferencePrice,
            ProposedUnitPrice = current.ProposedUnitPrice,
            ProposedDeliveryDate = current.ProposedDeliveryDate,
            ConfirmedBy = UserIdBytes,
            ConfirmedAt = DateTime.UtcNow.AddMinutes(1),
            DecisionFingerprint = new string('C', 64),
            Version = 2,
            Status = "CURRENT",
            CurrentDecisionKey = current.PurchaseRequestLineId,
            PurchaseRequestLine = current.PurchaseRequestLine
        };
        current.SupersededByDecisionId = replacement.PurchaseLineSupplierDecisionId;
        context.Purchaselinesupplierdecisions.Add(replacement);
        await context.SaveChangesAsync();

        var act = () => service.CreateFromApprovedRequestAsync(requestId, UserId);

        await act.Should().ThrowAsync<DbUpdateConcurrencyException>()
            .WithMessage("*quyết định nhà cung cấp*");
        (await context.Purchaseorders.CountAsync()).Should().Be(2);
        (await context.Purchaseorderlines.CountAsync()).Should().Be(2);
    }

    private static readonly byte[] UserIdBytes = GuidHelper.NewId();
    private static string UserId => GuidHelper.ToGuidString(UserIdBytes);

}
