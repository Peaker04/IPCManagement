namespace IPCManagement.Api.Shared.Contracts;

/// <summary>
/// Cross-feature filtering contract used by reporting endpoints and purchasing projections.
/// </summary>
public class WorkflowReportQueryDto
{
    public string? ServiceDate { get; set; }
    public string? DateFrom { get; set; }
    public string? DateTo { get; set; }
    public string? CustomerId { get; set; }
    public string? WarehouseId { get; set; }
    public string? IngredientId { get; set; }
    public string? SupplierId { get; set; }
    public string? ShiftName { get; set; }
    public string? Format { get; set; }
    public string? CursorDate { get; set; }
    public string? CursorId { get; set; }

    /// <summary>
    /// Số dòng đã trả ở cùng mốc thời gian <see cref="CursorDate"/>. Bắt buộc để phân trang không nhảy dòng:
    /// cột thời gian là <c>datetime</c> theo giây nên một mốc có thể chứa hàng chục dòng, nhiều hơn một trang.
    /// Null nghĩa là client cũ — server giữ nguyên hành vi so sánh chặt để hai bản deploy không lệch nhau.
    /// </summary>
    public int? CursorOffset { get; set; }

    public int Limit { get; set; } = 100;
    public string? SortDirection { get; set; }
    public string? Actor { get; set; }
    public string? BusinessArea { get; set; }
    public string? EntityName { get; set; }
    public string? FieldName { get; set; }
    public string? MovementType { get; set; }
    public string? SourceFamily { get; set; }
    public string? GroupBy { get; set; }
    public decimal? PriceTier { get; set; }
    public bool WarningOnly { get; set; }
}

/// <summary>
/// Shared page-number contract for list-style workflow reports.
/// </summary>
public class WorkflowReportPageQueryDto : WorkflowReportQueryDto
{
    private int _pageNumber = 1;
    private int _pageSize = 20;

    public int PageNumber
    {
        get => _pageNumber;
        set => _pageNumber = value < 1 ? 1 : value;
    }

    public int PageSize
    {
        get => _pageSize;
        set => _pageSize = value < 1 ? 1 : Math.Min(value, 100);
    }
}
