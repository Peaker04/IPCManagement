using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using IPCManagement.Api.Data;
using IPCManagement.Api.Data.Repositories;
using IPCManagement.Api.Helpers;
using IPCManagement.Api.Models.DTOs.Common;
using IPCManagement.Api.Models.DTOs.Inventory;
using IPCManagement.Api.Models.Entities;
using Microsoft.EntityFrameworkCore;

namespace IPCManagement.Api.Services;

public class StocktakeService : IStocktakeService
{
    private readonly IStocktakeRepository _stocktakeRepo;
    private readonly IUnitOfWork _unitOfWork;
    private readonly IStockLedgerService _stockLedgerService;
    private readonly IpcManagementContext? _context;

    public StocktakeService(
        IStocktakeRepository stocktakeRepo,
        IUnitOfWork unitOfWork,
        IStockLedgerService stockLedgerService,
        IpcManagementContext? context = null)
    {
        _stocktakeRepo = stocktakeRepo;
        _unitOfWork = unitOfWork;
        _stockLedgerService = stockLedgerService;
        _context = context;
    }

    private StocktakeDto MapStocktake(Stocktake entity, bool includeLines = false)
    {
        var dto = new StocktakeDto
        {
            StocktakeId = GuidHelper.ToGuidString(entity.StocktakeId),
            StocktakeCode = entity.StocktakeCode,
            WarehouseId = GuidHelper.ToGuidString(entity.WarehouseId),
            WarehouseName = entity.Warehouse?.WarehouseName ?? string.Empty,
            Status = entity.Status,
            Notes = entity.Notes,
            CreatedBy = GuidHelper.ToGuidString(entity.CreatedBy),
            CreatedByName = entity.CreatedByNavigation?.FullName,
            CreatedAt = entity.CreatedAt,
            ApprovedBy = entity.ApprovedBy != null ? GuidHelper.ToGuidString(entity.ApprovedBy) : null,
            ApprovedByName = entity.ApprovedByNavigation?.FullName,
            ApprovedAt = entity.ApprovedAt
        };

        if (includeLines && entity.Stocktakelines != null)
        {
            dto.Lines = entity.Stocktakelines.Select(line => new StocktakeLineDto
            {
                LineId = GuidHelper.ToGuidString(line.LineId),
                IngredientId = GuidHelper.ToGuidString(line.IngredientId),
                IngredientName = line.Ingredient?.IngredientName ?? string.Empty,
                UnitId = GuidHelper.ToGuidString(line.UnitId),
                UnitName = line.Unit?.UnitName ?? string.Empty,
                SystemQty = line.SystemQty,
                ActualQty = line.ActualQty,
                DiscrepancyQty = line.DiscrepancyQty,
                Reason = line.Reason
            }).ToList();
        }

        return dto;
    }

    public async Task<PagedResponseDto<StocktakeDto>> GetPagedAsync(StocktakeFilterRequestDto request)
    {
        var (items, totalCount) = await _stocktakeRepo.GetPagedAsync(request);
        return PagedResponseDto<StocktakeDto>.Create(
            items.Select(i => MapStocktake(i, false)),
            totalCount,
            request.PageNumber,
            request.PageSize);
    }

    public async Task<StocktakeDto?> GetByIdAsync(string id)
    {
        var bytes = GuidHelper.ParseGuidString(id);
        if (bytes == null) return null;
        var entity = await _stocktakeRepo.GetByIdWithLinesAsync(bytes);
        return entity == null ? null : MapStocktake(entity, true);
    }

    public async Task<StocktakeDto> CreateAsync(CreateStocktakeDto dto, string userId)
    {
        if (_context == null) throw new InvalidOperationException("DbContext is null.");

        var warehouseBytes = GuidHelper.ParseGuidString(dto.WarehouseId) ?? throw new ArgumentException("WarehouseId không hợp lệ.");
        var userBytes = GuidHelper.ParseGuidString(userId) ?? throw new ArgumentException("UserId không hợp lệ.");

        if (dto.IngredientIds == null || !dto.IngredientIds.Any())
        {
            throw new ArgumentException("Phải chọn ít nhất 1 nguyên liệu để kiểm kê.");
        }

        var ingredientBytesList = dto.IngredientIds
            .Select(id => GuidHelper.ParseGuidString(id) ?? throw new ArgumentException($"IngredientId {id} không hợp lệ."))
            .ToList();

        // Check pending stocktakes in the same warehouse
        var hasPending = await _context.Stocktakes
            .AnyAsync(s => s.WarehouseId == warehouseBytes && (s.Status == "DRAFT" || s.Status == "REVIEWING"));
        if (hasPending)
        {
            throw new InvalidOperationException("Kho này đang có một phiên kiểm kê chưa hoàn tất.");
        }

        var currentStocks = await _context.Currentstocks
            .Where(cs => cs.WarehouseId == warehouseBytes && ingredientBytesList.Contains(cs.IngredientId))
            .ToListAsync();

        var stocktake = new Stocktake
        {
            StocktakeId = GuidHelper.NewId(),
            StocktakeCode = $"STK-{DateTime.Now:yyyyMMdd-HHmmss}-{Guid.NewGuid().ToString("N").Substring(0, 4).ToUpper()}",
            WarehouseId = warehouseBytes,
            Status = "DRAFT",
            Notes = dto.Notes,
            CreatedBy = userBytes,
            CreatedAt = DateTime.UtcNow
        };

        foreach (var ingredientId in ingredientBytesList)
        {
            var stock = currentStocks.FirstOrDefault(s => s.IngredientId.SequenceEqual(ingredientId));
            
            stocktake.Stocktakelines.Add(new Stocktakeline
            {
                LineId = GuidHelper.NewId(),
                StocktakeId = stocktake.StocktakeId,
                IngredientId = ingredientId,
                UnitId = stock?.UnitId ?? _context.Ingredients.FirstOrDefault(i => i.IngredientId == ingredientId)?.UnitId ?? GuidHelper.NewId(),
                SystemQty = stock?.CurrentQty ?? 0m,
                ActualQty = null,
                DiscrepancyQty = null,
                Reason = null
            });
        }

        _stocktakeRepo.Add(stocktake);

        _context.Auditlogs.Add(new Auditlog
        {
            AuditId = GuidHelper.NewId(),
            ChangedAt = stocktake.CreatedAt,
            ChangedBy = userBytes,
            BusinessArea = "Stocktake",
            EntityName = nameof(Stocktake),
            EntityId = stocktake.StocktakeId,
            FieldName = "Status",
            OldValue = null,
            NewValue = "DRAFT",
            Reason = "Tạo phiên kiểm kê mới."
        });

        await _unitOfWork.SaveChangesAsync();
        return await GetByIdAsync(GuidHelper.ToGuidString(stocktake.StocktakeId)) ?? throw new InvalidOperationException("Lỗi sau khi tạo.");
    }

    public async Task<StocktakeDto> UpdateActualQtyAsync(string id, UpdateStocktakeLinesDto dto, string userId)
    {
        var bytes = GuidHelper.ParseGuidString(id) ?? throw new ArgumentException("Id không hợp lệ.");
        var userBytes = GuidHelper.ParseGuidString(userId) ?? throw new ArgumentException("UserId không hợp lệ.");

        var stocktake = await _stocktakeRepo.GetByIdWithLinesAsync(bytes) ?? throw new InvalidOperationException("Không tìm thấy phiên kiểm kê.");
        
        if (stocktake.Status != "DRAFT" && stocktake.Status != "REVIEWING")
        {
            throw new InvalidOperationException($"Không thể cập nhật số lượng khi phiếu ở trạng thái {stocktake.Status}.");
        }

        foreach (var item in dto.Lines)
        {
            var lineBytes = GuidHelper.ParseGuidString(item.LineId) ?? throw new ArgumentException($"LineId {item.LineId} không hợp lệ.");
            var line = stocktake.Stocktakelines.FirstOrDefault(l => l.LineId.SequenceEqual(lineBytes));
            if (line == null) continue;

            line.ActualQty = DecimalPolicy.RoundQuantity(item.ActualQty);
            line.DiscrepancyQty = DecimalPolicy.RoundQuantity(line.ActualQty.Value - line.SystemQty);
            line.Reason = item.Reason;
        }

        _stocktakeRepo.Update(stocktake);
        await _unitOfWork.SaveChangesAsync();

        return await GetByIdAsync(id) ?? throw new InvalidOperationException("Lỗi sau khi cập nhật.");
    }

    public async Task<StocktakeDto> SubmitForApprovalAsync(string id, string userId)
    {
        if (_context == null) throw new InvalidOperationException("DbContext is null.");
        var bytes = GuidHelper.ParseGuidString(id) ?? throw new ArgumentException("Id không hợp lệ.");
        var userBytes = GuidHelper.ParseGuidString(userId) ?? throw new ArgumentException("UserId không hợp lệ.");

        var stocktake = await _stocktakeRepo.GetByIdWithLinesAsync(bytes) ?? throw new InvalidOperationException("Không tìm thấy phiên kiểm kê.");
        
        if (stocktake.Status != "DRAFT")
        {
            throw new InvalidOperationException($"Không thể gửi duyệt khi phiếu đang ở trạng thái {stocktake.Status}.");
        }

        if (stocktake.Stocktakelines.Any(l => !l.ActualQty.HasValue))
        {
            throw new InvalidOperationException("Cần nhập đầy đủ tồn thực tế cho tất cả nguyên liệu trước khi gửi duyệt.");
        }

        stocktake.Status = "REVIEWING";
        
        _context.Auditlogs.Add(new Auditlog
        {
            AuditId = GuidHelper.NewId(),
            ChangedAt = DateTime.UtcNow,
            ChangedBy = userBytes,
            BusinessArea = "Stocktake",
            EntityName = nameof(Stocktake),
            EntityId = stocktake.StocktakeId,
            FieldName = "Status",
            OldValue = "DRAFT",
            NewValue = "REVIEWING",
            Reason = "Gửi duyệt chênh lệch kiểm kê."
        });

        _stocktakeRepo.Update(stocktake);
        await _unitOfWork.SaveChangesAsync();

        return await GetByIdAsync(id) ?? throw new InvalidOperationException("Lỗi sau khi gửi duyệt.");
    }

    public async Task<StocktakeDto> ApproveAsync(string id, string userId)
    {
        if (_context == null) throw new InvalidOperationException("DbContext is null.");
        var bytes = GuidHelper.ParseGuidString(id) ?? throw new ArgumentException("Id không hợp lệ.");
        var userBytes = GuidHelper.ParseGuidString(userId) ?? throw new ArgumentException("UserId không hợp lệ.");

        var stocktake = await _stocktakeRepo.GetByIdWithLinesAsync(bytes) ?? throw new InvalidOperationException("Không tìm thấy phiên kiểm kê.");
        
        if (stocktake.Status != "REVIEWING")
        {
            throw new InvalidOperationException($"Chỉ có thể duyệt khi phiếu ở trạng thái REVIEWING.");
        }

        using var transaction = await _unitOfWork.BeginTransactionAsync();
        try
        {
            stocktake.Status = "APPROVED";
            var now = DateTime.UtcNow;
            stocktake.ApprovedBy = userBytes;
            stocktake.ApprovedAt = now;

            foreach (var line in stocktake.Stocktakelines)
            {
                if (!line.DiscrepancyQty.HasValue || line.DiscrepancyQty.Value == 0) continue;

                if (line.DiscrepancyQty.Value > 0)
                {
                    await _stockLedgerService.AddStockAsync(
                        stocktake.WarehouseId,
                        line.IngredientId,
                        line.UnitId,
                        line.DiscrepancyQty.Value,
                        "ADJUSTMENT",
                        "stocktakes",
                        stocktake.StocktakeId,
                        userBytes,
                        "Điều chỉnh tăng kiểm kê",
                        line.Reason ?? $"Phiếu kiểm kê {stocktake.StocktakeCode}");
                }
                else
                {
                    // Lệch âm => trừ kho
                    await _stockLedgerService.RemoveStockWithCheckAsync(
                        stocktake.WarehouseId,
                        line.IngredientId,
                        line.UnitId,
                        Math.Abs(line.DiscrepancyQty.Value),
                        "ADJUSTMENT",
                        "stocktakes",
                        stocktake.StocktakeId,
                        userBytes,
                        "Điều chỉnh giảm kiểm kê",
                        line.Reason ?? $"Phiếu kiểm kê {stocktake.StocktakeCode}");
                }
            }

            _context.Auditlogs.Add(new Auditlog
            {
                AuditId = GuidHelper.NewId(),
                ChangedAt = now,
                ChangedBy = userBytes,
                BusinessArea = "Stocktake",
                EntityName = nameof(Stocktake),
                EntityId = stocktake.StocktakeId,
                FieldName = "Status",
                OldValue = "REVIEWING",
                NewValue = "APPROVED",
                Reason = "Duyệt phiếu kiểm kê và cập nhật tồn kho."
            });

            _stocktakeRepo.Update(stocktake);
            await _unitOfWork.SaveChangesAsync();
            await transaction.CommitAsync();

            return await GetByIdAsync(id) ?? throw new InvalidOperationException("Lỗi sau khi duyệt.");
        }
        catch
        {
            await transaction.RollbackAsync();
            throw;
        }
    }

    public async Task<StocktakeDto> RejectAsync(string id, string userId, string reason)
    {
        if (_context == null) throw new InvalidOperationException("DbContext is null.");
        var bytes = GuidHelper.ParseGuidString(id) ?? throw new ArgumentException("Id không hợp lệ.");
        var userBytes = GuidHelper.ParseGuidString(userId) ?? throw new ArgumentException("UserId không hợp lệ.");

        var stocktake = await _stocktakeRepo.GetByIdWithLinesAsync(bytes) ?? throw new InvalidOperationException("Không tìm thấy phiên kiểm kê.");
        
        if (stocktake.Status != "REVIEWING")
        {
            throw new InvalidOperationException($"Chỉ có thể từ chối khi phiếu ở trạng thái REVIEWING.");
        }

        stocktake.Status = "REJECTED";
        var now = DateTime.UtcNow;
        stocktake.ApprovedBy = userBytes;
        stocktake.ApprovedAt = now;
        
        if (!string.IsNullOrWhiteSpace(reason))
        {
            stocktake.Notes = string.IsNullOrWhiteSpace(stocktake.Notes) ? reason : $"{stocktake.Notes}\nTừ chối: {reason}";
        }

        _context.Auditlogs.Add(new Auditlog
        {
            AuditId = GuidHelper.NewId(),
            ChangedAt = now,
            ChangedBy = userBytes,
            BusinessArea = "Stocktake",
            EntityName = nameof(Stocktake),
            EntityId = stocktake.StocktakeId,
            FieldName = "Status",
            OldValue = "REVIEWING",
            NewValue = "REJECTED",
            Reason = $"Từ chối duyệt. Lý do: {reason}"
        });

        _stocktakeRepo.Update(stocktake);
        await _unitOfWork.SaveChangesAsync();

        return await GetByIdAsync(id) ?? throw new InvalidOperationException("Lỗi sau khi từ chối.");
    }
}
