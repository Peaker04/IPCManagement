
using IPCManagement.Api.Data;
using IPCManagement.Api.Features.Purchasing.Contracts;
using IPCManagement.Api.Helpers;
using IPCManagement.Api.Models.Entities;
using Microsoft.EntityFrameworkCore;

using IPCManagement.Api.Exceptions;

namespace IPCManagement.Api.Features.Purchasing.Services;

public sealed class PurchaseRequestGenerationService : IPurchaseRequestGenerationService
{
    private const string DraftStatus = "DRAFT";
    private const string SubmittedStatus = "SENTTOSUPPLIER";

    private readonly IpcManagementContext _context;

    public PurchaseRequestGenerationService(IpcManagementContext context)
    {
        _context = context;
    }

    public async Task<PurchaseRequestWorkflowResultDto?> GenerateFromDemandAsync(
        GeneratePurchaseRequestFromDemandRequest request,
        string? userId,
        CancellationToken cancellationToken = default)
    {
        var userIdBytes = GuidHelper.ParseGuidString(userId);
        var materialRequestId = GuidHelper.ParseGuidString(request.MaterialRequestId);
        if (userIdBytes is null || materialRequestId is null)
        {
            return null;
        }

        var materialRequest = await _context.Materialrequests.FindAsync(
            new object[] { materialRequestId },
            cancellationToken);
        if (materialRequest is null)
        {
            return null;
        }

        await _context.Entry(materialRequest)
            .Collection(item => item.Materialrequestlines)
            .Query()
            .Include(line => line.Ingredient)
            .Include(line => line.Unit)
            .LoadAsync(cancellationToken);
        await _context.Entry(materialRequest)
            .Reference(item => item.Plan)
            .LoadAsync(cancellationToken);

        PurchaseRequestGenerationPolicy.ValidateApprovedFullDayDemand(materialRequest);
        await ValidateExistingRequestAsync(materialRequest, cancellationToken);

        var shortageLines = materialRequest.Materialrequestlines
            .Where(line => PurchaseRequestPlanner.CalculatePurchaseQty(line.SuggestedPurchaseQty) > 0)
            .OrderBy(line => line.Ingredient.IngredientName)
            .ToList();
        if (shortageLines.Count == 0)
        {
            return await ClearStaleRequestAsync(materialRequest, userIdBytes, cancellationToken);
        }

        var purchaseRequest = await EnsureRequestAsync(materialRequest, userIdBytes, cancellationToken);
        var existingLines = purchaseRequest.Purchaserequestlines.ToList();
        if (purchaseRequest.Status == SubmittedStatus)
        {
            return PurchaseWorkflowMapper.MapResult(purchaseRequest, materialRequest.RequestId, existingLines);
        }

        foreach (var line in shortageLines)
        {
            EnsureLine(purchaseRequest, line, existingLines);
        }

        var currentDemandLineIds = materialRequest.Materialrequestlines
            .Select(line => Convert.ToBase64String(line.RequestLineId))
            .ToHashSet(StringComparer.Ordinal);
        var staleLines = existingLines
            .Where(line =>
                currentDemandLineIds.Contains(Convert.ToBase64String(line.MaterialRequestLineId)) &&
                shortageLines.All(shortage => !shortage.RequestLineId.SequenceEqual(line.MaterialRequestLineId)))
            .ToList();
        if (staleLines.Count > 0)
        {
            _context.Purchaserequestlines.RemoveRange(staleLines);
            existingLines.RemoveAll(line =>
                staleLines.Any(stale => stale.PurchaseRequestLineId.SequenceEqual(line.PurchaseRequestLineId)));
        }

        _context.Auditlogs.Add(new AuditLog
        {
            AuditId = GuidHelper.NewId(),
            ChangedAt = DateTime.UtcNow,
            ChangedBy = userIdBytes,
            BusinessArea = "Purchasing",
            EntityName = nameof(PurchaseRequest),
            EntityId = purchaseRequest.PurchaseRequestId,
            FieldName = "GenerateFromDemand",
            OldValue = null,
            NewValue = $"{shortageLines.Count} shortage lines; {existingLines.Count} purchase lines",
            Reason = "Sinh đề xuất mua hàng từ dòng thiếu nguyên liệu sau kiểm tồn."
        });

        await _context.SaveChangesAsync(cancellationToken);

        return PurchaseWorkflowMapper.MapResult(purchaseRequest, materialRequest.RequestId, existingLines);
    }

    private async Task<PurchaseRequestWorkflowResultDto?> ClearStaleRequestAsync(
        MaterialRequest materialRequest,
        byte[] userId,
        CancellationToken cancellationToken)
    {
        var requestCode = PurchaseRequestGenerationPolicy.BuildRequestCode(materialRequest);
        var purchaseRequest = await _context.Purchaserequests
            .Include(item => item.Purchaserequestlines)
                .ThenInclude(line => line.Ingredient)
            .Include(item => item.Purchaserequestlines)
                .ThenInclude(line => line.Supplier)
            .Include(item => item.Purchaserequestlines)
                .ThenInclude(line => line.Unit)
            .FirstOrDefaultAsync(item => item.PurchaseRequestCode == requestCode, cancellationToken);
        if (purchaseRequest is null)
        {
            return null;
        }

        if (purchaseRequest.Status == SubmittedStatus)
        {
            return PurchaseWorkflowMapper.MapResult(
                purchaseRequest,
                materialRequest.RequestId,
                purchaseRequest.Purchaserequestlines);
        }

        var currentDemandLineIds = materialRequest.Materialrequestlines
            .Select(line => Convert.ToBase64String(line.RequestLineId))
            .ToHashSet(StringComparer.Ordinal);
        var staleLines = purchaseRequest.Purchaserequestlines
            .Where(line => currentDemandLineIds.Contains(Convert.ToBase64String(line.MaterialRequestLineId)))
            .ToList();
        var staleCount = staleLines.Count;
        if (staleCount > 0)
        {
            _context.Purchaserequestlines.RemoveRange(staleLines);
        }

        purchaseRequest.Status = DraftStatus;
        var remainingLines = purchaseRequest.Purchaserequestlines
            .Where(line => !currentDemandLineIds.Contains(Convert.ToBase64String(line.MaterialRequestLineId)))
            .ToList();
        _context.Auditlogs.Add(new AuditLog
        {
            AuditId = GuidHelper.NewId(),
            ChangedAt = DateTime.UtcNow,
            ChangedBy = userId,
            BusinessArea = "Purchasing",
            EntityName = nameof(PurchaseRequest),
            EntityId = purchaseRequest.PurchaseRequestId,
            FieldName = "GenerateFromDemand",
            OldValue = $"{staleCount} stale purchase lines",
            NewValue = $"0 shortage lines; {remainingLines.Count} purchase lines",
            Reason = "Dọn đề xuất mua hàng cũ vì nhu cầu hiện tại không còn thiếu nguyên liệu."
        });

        await _context.SaveChangesAsync(cancellationToken);

        return PurchaseWorkflowMapper.MapResult(purchaseRequest, materialRequest.RequestId, remainingLines);
    }

    private async Task<PurchaseRequest> EnsureRequestAsync(
        MaterialRequest materialRequest,
        byte[] userId,
        CancellationToken cancellationToken)
    {
        var requestCode = PurchaseRequestGenerationPolicy.BuildRequestCode(materialRequest);
        var existing = await _context.Purchaserequests
            .Include(item => item.Purchaserequestlines)
                .ThenInclude(line => line.Ingredient)
            .Include(item => item.Purchaserequestlines)
                .ThenInclude(line => line.Supplier)
            .Include(item => item.Purchaserequestlines)
                .ThenInclude(line => line.Unit)
            .FirstOrDefaultAsync(item => item.PurchaseRequestCode == requestCode, cancellationToken);
        if (existing is not null)
        {
            existing.Status = existing.Status == SubmittedStatus ? existing.Status : DraftStatus;
            return existing;
        }

        var purchaseRequest = new PurchaseRequest

        {
            PurchaseRequestId = GuidHelper.NewId(),
            PurchaseRequestCode = requestCode,
            RequestDate = DateOnly.FromDateTime(DateTime.UtcNow),
            PurchaseForDate = materialRequest.RequestDate,
            ShiftName = materialRequest.RequestScope == "FULLDAY" ? null : materialRequest.RequestScope,
            Status = DraftStatus,
            CreatedBy = userId
        };

        _context.Purchaserequests.Add(purchaseRequest);
        return purchaseRequest;
    }

    private void EnsureLine(
        PurchaseRequest purchaseRequest,
        MaterialRequestLine materialLine,
        List<PurchaseRequestLine> existingLines)
    {
        var purchaseQty = PurchaseRequestPlanner.CalculatePurchaseQty(materialLine.SuggestedPurchaseQty);
        var requiredQty = DecimalPolicy.RoundQuantity(materialLine.TotalRequiredQty);
        var currentStockQty = DecimalPolicy.RoundQuantity(materialLine.CurrentStockQty);
        var existing = existingLines.FirstOrDefault(line =>
            line.MaterialRequestLineId.SequenceEqual(materialLine.RequestLineId));
        if (existing is not null)
        {
            existing.IngredientId = materialLine.IngredientId;
            existing.UnitId = materialLine.UnitId;
            existing.RequiredQty = requiredQty;
            existing.CurrentStockQty = currentStockQty;
            existing.PurchaseQty = purchaseQty;
            existing.Ingredient = materialLine.Ingredient;
            existing.Unit = materialLine.Unit;
            return;
        }

        var line = new PurchaseRequestLine
        {
            PurchaseRequestLineId = GuidHelper.NewId(),
            PurchaseRequestId = purchaseRequest.PurchaseRequestId,
            MaterialRequestLineId = materialLine.RequestLineId,
            IngredientId = materialLine.IngredientId,
            SupplierId = null,
            UnitId = materialLine.UnitId,
            RequiredQty = requiredQty,
            CurrentStockQty = currentStockQty,
            PurchaseQty = purchaseQty,
            EstimatedUnitPrice = 0,
            PurchaseRequest = purchaseRequest,
            Ingredient = materialLine.Ingredient,
            Unit = materialLine.Unit
        };

        _context.Purchaserequestlines.Add(line);
        existingLines.Add(line);
    }

    private async Task ValidateExistingRequestAsync(
        MaterialRequest materialRequest,
        CancellationToken cancellationToken)
    {
        var requestCode = PurchaseRequestGenerationPolicy.BuildRequestCode(materialRequest);
        var existing = await _context.Purchaserequests
            .AsNoTracking()
            .Include(request => request.Purchaserequestlines)
            .FirstOrDefaultAsync(request => request.PurchaseRequestCode == requestCode, cancellationToken);
        if (existing is null)
        {
            return;
        }

        if (!PurchaseRequestGenerationPolicy.BelongsToCurrentDemand(existing, materialRequest))
        {
            throw new BusinessRuleException("Nhu cầu nguyên liệu đã cũ hoặc không khớp với đề xuất mua hiện tại.");
        }
    }

}
