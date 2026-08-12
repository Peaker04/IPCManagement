
using System.Globalization;
using IPCManagement.Api.Data;
using IPCManagement.Api.Data.Transactions;
using IPCManagement.Api.Features.Purchasing.Contracts;
using IPCManagement.Api.Helpers;
using IPCManagement.Api.Models.Entities;
using Microsoft.EntityFrameworkCore;

using IPCManagement.Api.Exceptions;

namespace IPCManagement.Api.Features.Purchasing.Services;

public sealed class PurchaseSupplierDecisionService : IPurchaseSupplierDecisionService
{
    private const string DraftStatus = "DRAFT";
    private const string MissingEvidenceBlocker =
        "Chưa có đơn giá hiệu lực hoặc biên nhận hợp lệ cho nguyên liệu này. Hãy cập nhật báo giá hoặc xác minh biên nhận trước khi chọn nhà cung cấp.";

    private readonly IpcManagementContext _context;
    private readonly IEfTransactionRunner _transactionRunner;

    public PurchaseSupplierDecisionService(
        IpcManagementContext context,
        IEfTransactionRunner transactionRunner)
    {
        _context = context;
        _transactionRunner = transactionRunner;
    }

    public async Task<SupplierEvidenceResultDto> GetSupplierEvidenceAsync(
        string requestId,
        string lineId,
        CancellationToken cancellationToken = default)
    {
        var purchaseRequestId = GuidHelper.ParseGuidString(requestId);
        var purchaseRequestLineId = GuidHelper.ParseGuidString(lineId);
        if (purchaseRequestId is null || purchaseRequestLineId is null)
        {
            throw new ArgumentException("Mã tham chiếu không hợp lệ.");
        }

        var lineQuery = _context.Purchaserequestlines
            .AsNoTracking()
            .Include(item => item.PurchaseRequest)
            .Include(item => item.Ingredient)
            .Include(item => item.Unit);
        PurchaseRequestLine? line;
        if (string.Equals(
                _context.Database.ProviderName,
                "Microsoft.EntityFrameworkCore.InMemory",
                StringComparison.Ordinal))
        {
            var trackedAndStored = _context.ChangeTracker.Entries<PurchaseRequestLine>()
                .Select(entry => entry.Entity)
                .Concat(await lineQuery.ToListAsync(cancellationToken))
                .DistinctBy(item => PurchaseSupplierDecisionPolicy.BuildKey(item.PurchaseRequestLineId));
            line = trackedAndStored.FirstOrDefault(item =>

                item.PurchaseRequestId.SequenceEqual(purchaseRequestId) &&
                item.PurchaseRequestLineId.SequenceEqual(purchaseRequestLineId));
        }
        else
        {
            line = await lineQuery.FirstOrDefaultAsync(item =>
                item.PurchaseRequestId == purchaseRequestId &&
                item.PurchaseRequestLineId == purchaseRequestLineId,
                cancellationToken);
        }

        if (line is null)
        {
            throw new KeyNotFoundException("Không tìm thấy dòng nguyên liệu trong đề xuất mua.");
        }

        var asOfDate = line.PurchaseRequest.PurchaseForDate;
        var isInMemoryProvider = string.Equals(
            _context.Database.ProviderName,
            "Microsoft.EntityFrameworkCore.InMemory",
            StringComparison.Ordinal);
        var quotationQuery = _context.Supplierquotations
            .AsNoTracking()
            .Include(item => item.Supplier)
            .AsQueryable();
        if (!isInMemoryProvider)
        {
            quotationQuery = quotationQuery.Where(item =>
                item.IngredientId == line.IngredientId &&
                item.IsActive != false &&
                item.Supplier.IsActive != false &&
                item.UnitPrice > 0 &&
                item.EffectiveFrom <= asOfDate &&
                (item.EffectiveTo == null || item.EffectiveTo >= asOfDate));
        }

        var queriedQuotations = (isInMemoryProvider

                ? _context.ChangeTracker.Entries<SupplierQuotation>()
                    .Select(entry => entry.Entity)
                    .Concat(await quotationQuery.ToListAsync(cancellationToken))
                    .DistinctBy(item => PurchaseSupplierDecisionPolicy.BuildKey(item.QuotationId))
                : await quotationQuery.ToListAsync(cancellationToken))
            .Where(item =>
                item.IngredientId.SequenceEqual(line.IngredientId) &&
                item.IsActive != false &&
                item.Supplier.IsActive != false &&
                item.UnitPrice > 0 &&
                item.EffectiveFrom <= asOfDate &&
                (item.EffectiveTo == null || item.EffectiveTo >= asOfDate));
        var quotations = queriedQuotations
            .OrderBy(item => item.UnitPrice)
            .ThenByDescending(item => item.EffectiveFrom)
            .ThenBy(item => item.Supplier.SupplierName, StringComparer.OrdinalIgnoreCase)
            .ThenBy(item => PurchaseSupplierDecisionPolicy.BuildKey(item.QuotationId), StringComparer.Ordinal)
            .ToList();

        if (quotations.Count > 0)
        {
            return new SupplierEvidenceResultDto
            {
                Candidates = quotations.Select(item => new SupplierEvidenceCandidateDto
                {
                    EvidenceType = SupplierEvidenceType.EffectiveQuotation,
                    EvidenceId = GuidHelper.ToGuidString(item.QuotationId),
                    EvidenceDate = item.EffectiveFrom.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture),
                    SupplierId = GuidHelper.ToGuidString(item.SupplierId),
                    SupplierName = item.Supplier.SupplierName,
                    IngredientId = GuidHelper.ToGuidString(line.IngredientId),
                    UnitId = GuidHelper.ToGuidString(line.UnitId),
                    UnitName = line.Unit.UnitName,
                    UnitPrice = DecimalPolicy.RoundMoney(item.UnitPrice),
                    EffectiveFrom = item.EffectiveFrom.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture),
                    EffectiveTo = item.EffectiveTo?.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture)
                }).ToList()
            };
        }

        var receiptLineQuery = _context.Inventoryreceiptlines
            .AsNoTracking()
            .Include(item => item.Receipt)
                .ThenInclude(receipt => receipt.Supplier)
            .Include(item => item.Unit)
            .AsQueryable();
        if (!isInMemoryProvider)
        {
            receiptLineQuery = receiptLineQuery.Where(item =>
                item.IngredientId == line.IngredientId &&
                item.Quantity > 0 &&
                item.UnitPrice > 0 &&
                item.Receipt.ReceiptDate <= asOfDate &&
                item.Receipt.Supplier.IsActive != false);

        }

        var queriedReceiptLines = (isInMemoryProvider
                ? _context.ChangeTracker.Entries<InventoryReceiptLine>()
                    .Select(entry => entry.Entity)
                    .Concat(await receiptLineQuery.ToListAsync(cancellationToken))
                    .DistinctBy(item => PurchaseSupplierDecisionPolicy.BuildKey(item.ReceiptLineId))
                : await receiptLineQuery.ToListAsync(cancellationToken))
            .Where(item =>
                item.IngredientId.SequenceEqual(line.IngredientId) &&
                item.Quantity > 0 &&
                item.UnitPrice > 0 &&
                item.Receipt.ReceiptDate <= asOfDate &&
                item.Receipt.Supplier.IsActive != false);
        var receiptLines = queriedReceiptLines
            .OrderByDescending(item => item.Receipt.ReceiptDate)
            .ThenByDescending(item => item.Receipt.CreatedAt)
            .ThenBy(item => PurchaseSupplierDecisionPolicy.BuildKey(item.ReceiptLineId), StringComparer.Ordinal)
            .ToList();

        var diagnostics = receiptLines
            .Where(item => !PurchaseSupplierDecisionPolicy.CanConvertUnits(item.Unit, line.Unit))
            .Select(item =>
                $"Biên nhận {GuidHelper.ToGuidString(item.ReceiptLineId)} có đơn vị {item.Unit.UnitName} không thể quy đổi sang {line.Unit.UnitName}.")
            .OrderBy(message => message, StringComparer.Ordinal)
            .ToList();

        var candidates = receiptLines
            .Where(item => PurchaseSupplierDecisionPolicy.CanConvertUnits(item.Unit, line.Unit))
            .GroupBy(item => PurchaseSupplierDecisionPolicy.BuildKey(item.Receipt.SupplierId))
            .Select(group => group
                .OrderByDescending(item => item.Receipt.ReceiptDate)
                .ThenByDescending(item => item.Receipt.CreatedAt)
                .ThenBy(item => PurchaseSupplierDecisionPolicy.BuildKey(item.ReceiptLineId), StringComparer.Ordinal)
                .First())
            .Select(item => new SupplierEvidenceCandidateDto

            {
                EvidenceType = SupplierEvidenceType.LatestValidReceipt,
                EvidenceId = GuidHelper.ToGuidString(item.ReceiptLineId),
                EvidenceDate = item.Receipt.ReceiptDate.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture),
                SupplierId = GuidHelper.ToGuidString(item.Receipt.SupplierId),
                SupplierName = item.Receipt.Supplier.SupplierName,
                IngredientId = GuidHelper.ToGuidString(line.IngredientId),
                UnitId = GuidHelper.ToGuidString(line.UnitId),
                UnitName = line.Unit.UnitName,
                UnitPrice = PurchaseSupplierDecisionPolicy.ResolveLatestReceiptPrice(item, line.Unit)
            })
            .OrderBy(item => item.UnitPrice)
            .ThenBy(item => item.SupplierName, StringComparer.OrdinalIgnoreCase)
            .ThenBy(item => item.EvidenceId, StringComparer.Ordinal)
            .ToList();

        return new SupplierEvidenceResultDto
        {
            Candidates = candidates,
            Blocker = candidates.Count == 0 ? MissingEvidenceBlocker : null,
            Diagnostics = diagnostics
        };
    }

    public async Task<PurchaseLineSupplierDecisionDto> ConfirmLineSupplierAsync(
        string requestId,
        string lineId,
        ConfirmPurchaseLineSupplierRequest request,
        string? userId,
        CancellationToken cancellationToken = default)
    {
        var purchaseRequestId = GuidHelper.ParseGuidString(requestId);
        var purchaseRequestLineId = GuidHelper.ParseGuidString(lineId);
        var supplierId = GuidHelper.ParseGuidString(request.SupplierId);
        var actorId = GuidHelper.ParseGuidString(userId);

        if (purchaseRequestId is null || purchaseRequestLineId is null || supplierId is null || actorId is null)
        {
            throw new ArgumentException("Mã tham chiếu không hợp lệ.");
        }

        if (request.ExpectedDecisionVersion < 0)
        {
            throw new ArgumentException("Phiên bản quyết định không hợp lệ.");
        }

        var proposedUnitPrice = DecimalPolicy.RoundMoney(request.ProposedUnitPrice);
        if (proposedUnitPrice <= 0)
        {
            throw new ArgumentException("Đơn giá đề xuất phải lớn hơn 0.");
        }

        var receivingWarehouseId = string.IsNullOrWhiteSpace(request.ReceivingWarehouseId)
            ? null
            : GuidHelper.ParseGuidString(request.ReceivingWarehouseId);
        if (!string.IsNullOrWhiteSpace(request.ReceivingWarehouseId) && receivingWarehouseId is null)
        {
            throw new ArgumentException("Kho nhận hàng không hợp lệ.");
        }

        var purchasingTerms = string.IsNullOrWhiteSpace(request.PurchasingTerms) ? null : request.PurchasingTerms.Trim();

        if (!DateOnly.TryParseExact(
                request.ProposedDeliveryDate,
                "yyyy-MM-dd",
                CultureInfo.InvariantCulture,
                DateTimeStyles.None,
                out var proposedDeliveryDate))
        {

            throw new ArgumentException("Ngày giao dự kiến phải có định dạng yyyy-MM-dd.");
        }

        string? committedFingerprint = null;
        return await _transactionRunner.ExecuteAsync(
            async token =>
            {
                var lineQuery = _context.Purchaserequestlines
            .Include(item => item.PurchaseRequest)
            .Include(item => item.SupplierDecisions)
            .Include(item => item.Ingredient)
            .Include(item => item.Unit)
            .AsQueryable();
                PurchaseRequestLine? line;
                if (string.Equals(
                        _context.Database.ProviderName,
                        "Microsoft.EntityFrameworkCore.InMemory",
                        StringComparison.Ordinal))
                {
                    line = _context.ChangeTracker.Entries<PurchaseRequestLine>()
                        .Select(entry => entry.Entity)
                        .FirstOrDefault(item =>
                            item.PurchaseRequestId.SequenceEqual(purchaseRequestId) &&
                            item.PurchaseRequestLineId.SequenceEqual(purchaseRequestLineId));
                }
                else
                {
                    line = await lineQuery.FirstOrDefaultAsync(item =>
                        item.PurchaseRequestId == purchaseRequestId &&
                        item.PurchaseRequestLineId == purchaseRequestLineId,
                        token);
                }

                if (line is null)
                {
                    throw new KeyNotFoundException("Không tìm thấy dòng nguyên liệu trong đề xuất mua.");
                }

                if (!string.Equals(line.PurchaseRequest.Status, DraftStatus, StringComparison.OrdinalIgnoreCase))
                {
                    throw new BusinessRuleException("Chỉ được xác nhận nhà cung cấp khi đề xuất mua ở trạng thái DRAFT.");
                }

                var currentDecision = line.SupplierDecisions
                    .SingleOrDefault(item => string.Equals(item.Status, "CURRENT", StringComparison.Ordinal));
                var currentVersion = currentDecision?.Version ?? 0;
                if (request.ExpectedDecisionVersion != currentVersion)
                {
                    throw new DbUpdateConcurrencyException("Quyết định nhà cung cấp đã thay đổi. Hãy tải lại dữ liệu.");
                }

                var evidence = await GetSupplierEvidenceAsync(requestId, lineId, token);
                var evidenceCandidate = evidence.Candidates.SingleOrDefault(candidate =>
                    candidate.EvidenceType == request.EvidenceType &&
                    string.Equals(candidate.EvidenceId, request.EvidenceId, StringComparison.OrdinalIgnoreCase) &&
                    string.Equals(candidate.SupplierId, request.SupplierId, StringComparison.OrdinalIgnoreCase));
                if (evidenceCandidate is null)
                {
                    throw new DbUpdateConcurrencyException("Bằng chứng nhà cung cấp đã hết hiệu lực hoặc không còn khớp. Hãy tải lại gợi ý.");
                }

                var evidenceType = PurchaseSupplierDecisionPolicy.ToPersistenceEvidenceType(request.EvidenceType);
                var referencePrice = DecimalPolicy.RoundMoney(evidenceCandidate.UnitPrice);
                var variancePercent = PurchasePricePolicy.CalculateVariancePercent(referencePrice, proposedUnitPrice);
                var exceptionReason = string.IsNullOrWhiteSpace(request.Note) ? null : request.Note.Trim();
                if (PurchasePricePolicy.RequiresException(variancePercent) && exceptionReason is null)
                {
                    throw new BusinessRuleException("Cần nhập lý do khi giá đề xuất vượt 15% giá tham chiếu.");
                }

                var fingerprint = PurchaseSupplierDecisionPolicy.BuildFingerprint(
                    line.PurchaseRequestLineId,
                    supplierId,
                    evidenceType,
                    GuidHelper.ParseGuidString(evidenceCandidate.EvidenceId)!,
                    evidenceCandidate.UnitPrice,
                    proposedUnitPrice,
                    proposedDeliveryDate,
                    receivingWarehouseId,
                    purchasingTerms);
                if (currentDecision is not null &&
                    string.Equals(currentDecision.DecisionFingerprint, fingerprint, StringComparison.Ordinal))
                {
                    await UpsertPriceExceptionAsync(
                        currentDecision,
                        null,
                        variancePercent,
                        exceptionReason,
                        actorId,
                            token);
                    committedFingerprint = fingerprint;
                    await _context.SaveChangesAsync(token);

                    return PurchaseWorkflowMapper.MapDecision(currentDecision);
                }

                var decisionId = GuidHelper.NewId();
                if (currentDecision is not null)
                {
                    currentDecision.Status = "SUPERSEDED";
                    currentDecision.CurrentDecisionKey = null;
                    currentDecision.SupersededByDecisionId = decisionId;
                    currentDecision.ConcurrencyVersion++;
                    await _context.SaveChangesAsync(token);

                }

                var decision = new PurchaseLineSupplierDecision
                {
                    PurchaseLineSupplierDecisionId = decisionId,
                    PurchaseRequestLineId = line.PurchaseRequestLineId,
                    SupplierId = supplierId,
                    EvidenceType = evidenceType,
                    EvidenceId = GuidHelper.ParseGuidString(evidenceCandidate.EvidenceId)!,
                    EvidenceDate = DateOnly.ParseExact(
                        evidenceCandidate.EvidenceDate,
                        "yyyy-MM-dd",
                        CultureInfo.InvariantCulture),
                    EvidenceReferencePrice = DecimalPolicy.RoundMoney(evidenceCandidate.UnitPrice),
                    ProposedUnitPrice = proposedUnitPrice,

                    ProposedDeliveryDate = proposedDeliveryDate,
                    ReceivingWarehouseId = receivingWarehouseId,
                    PurchasingTerms = purchasingTerms,
                    ConfirmedBy = actorId,
                    ConfirmedAt = DateTime.UtcNow,
                    DecisionFingerprint = fingerprint,
                    Version = currentVersion + 1,
                    Status = "CURRENT",
                    CurrentDecisionKey = line.PurchaseRequestLineId,
                    ConcurrencyVersion = 1,
                    PurchaseRequestLine = line
                };

                line.SupplierId = supplierId;
                line.EstimatedUnitPrice = proposedUnitPrice;
                line.ExpectedDeliveryDate = proposedDeliveryDate;
                line.Note = exceptionReason;
                line.IsLegacySupplierSnapshot = false;
                line.SupplierDecisions.Add(decision);
                _context.Purchaselinesupplierdecisions.Add(decision);

                await UpsertPriceExceptionAsync(
                    decision,
                    currentDecision,
                    variancePercent,
                    exceptionReason,
                    actorId,
                        token);

                _context.Auditlogs.Add(new AuditLog
                {
                    AuditId = GuidHelper.NewId(),
                    ChangedAt = DateTime.UtcNow,
                    ChangedBy = actorId,
                    BusinessArea = "Purchasing",
                    EntityName = nameof(PurchaseLineSupplierDecision),
                    EntityId = decision.PurchaseLineSupplierDecisionId,
                    FieldName = "ConfirmSupplierDecision",
                    OldValue = currentDecision?.DecisionFingerprint,
                    NewValue = decision.DecisionFingerprint,
                    Reason = "Xác nhận nhà cung cấp, giá và ngày giao từ bằng chứng hợp lệ."
                });

                committedFingerprint = fingerprint;
                await _context.SaveChangesAsync(token);
                return PurchaseWorkflowMapper.MapDecision(decision);
            },
            async token =>
                committedFingerprint is not null &&
                await _context.Purchaselinesupplierdecisions
                    .AsNoTracking()
                    .AnyAsync(
                        decision =>
                            decision.PurchaseRequestLineId == purchaseRequestLineId &&
                            decision.Status == "CURRENT" &&
                            decision.DecisionFingerprint == committedFingerprint,
                        token),
            cancellationToken: cancellationToken);
    }

    private async Task UpsertPriceExceptionAsync(
        PurchaseLineSupplierDecision decision,
        PurchaseLineSupplierDecision? supersededDecision,
        decimal variancePercent,
        string? reason,
        byte[] actorId,
        CancellationToken cancellationToken)
    {
        if (!PurchasePricePolicy.RequiresException(variancePercent))
        {
            return;
        }

        if (string.IsNullOrWhiteSpace(reason))
        {
            throw new BusinessRuleException("Cần nhập lý do khi giá đề xuất vượt 15% giá tham chiếu.");
        }

        var existing = await _context.Purchasepriceexceptions.FirstOrDefaultAsync(item =>
            item.PurchaseLineSupplierDecisionId == decision.PurchaseLineSupplierDecisionId &&
            item.ProposalFingerprint == decision.DecisionFingerprint &&
            item.ProposalVersion == decision.Version,
            cancellationToken);
        if (existing is not null)
        {
            return;
        }

        var exceptionId = GuidHelper.NewId();
        if (supersededDecision is not null)

        {
            var priorExceptions = await _context.Purchasepriceexceptions
                .Where(item =>
                    item.PurchaseLineSupplierDecisionId == supersededDecision.PurchaseLineSupplierDecisionId &&
                    item.Status != "SUPERSEDED")
                .ToListAsync(cancellationToken);
            foreach (var priorException in priorExceptions)
            {
                priorException.Status = "SUPERSEDED";
                priorException.SupersededByExceptionId = exceptionId;
                priorException.ConcurrencyVersion++;
            }
        }

        var priceException = new PurchasePriceException
        {
            PurchasePriceExceptionId = exceptionId,
            PurchaseLineSupplierDecisionId = decision.PurchaseLineSupplierDecisionId,
            ReferencePrice = DecimalPolicy.RoundMoney(decision.EvidenceReferencePrice),
            ProposedPrice = DecimalPolicy.RoundMoney(decision.ProposedUnitPrice),
            VariancePercent = variancePercent,
            EvidenceType = decision.EvidenceType,
            EvidenceId = decision.EvidenceId,
            EvidenceDate = decision.EvidenceDate,
            Reason = reason,
            ProposalFingerprint = decision.DecisionFingerprint,
            ProposalVersion = decision.Version,
            RequestedBy = actorId,
            RequestedAt = DateTime.UtcNow,
            Status = "PENDING",
            ConcurrencyVersion = 1,
            PurchaseLineSupplierDecision = decision
        };
        _context.Purchasepriceexceptions.Add(priceException);
        _context.Auditlogs.Add(new AuditLog
        {
            AuditId = GuidHelper.NewId(),
            ChangedAt = priceException.RequestedAt,
            ChangedBy = actorId,
            BusinessArea = "Purchasing",
            EntityName = nameof(PurchasePriceException),
            EntityId = exceptionId,
            FieldName = "CreatePriceException",
            OldValue = null,
            NewValue = decision.DecisionFingerprint,
            Reason = reason
        });
    }

}
