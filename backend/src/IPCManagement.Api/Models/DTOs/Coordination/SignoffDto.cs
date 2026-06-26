namespace IPCManagement.Api.Models.DTOs.Coordination;

// ── BE-4.3: POST /api/coordination/orders/{id}/signoff ──────────────────────

public class SignoffOrderRequestDto
{
    /// <summary>Ghi chú khi chốt ca (không bắt buộc).</summary>
    public string? Note { get; set; }
}

public class SignoffOrderResultDto
{
    public bool Success { get; set; }
    public string QuantityPlanId { get; set; } = string.Empty;
    public string ServiceDate { get; set; } = string.Empty;
    public string OldStatus { get; set; } = string.Empty;
    public string NewStatus { get; set; } = string.Empty;
    public DateTime SignedOffAt { get; set; }
}

// ── BE-4.4: OrderStatus enum (state machine) ─────────────────────────────────

/// <summary>
/// Vòng đời trạng thái của MealQuantityPlan:
/// DRAFT → CONFIRMED → COMPLETED → ARCHIVED
/// </summary>
public static class OrderStatus
{
    /// <summary>Bản nháp — điều phối đang nhập liệu, chưa chốt.</summary>
    public const string Draft = "DRAFT";

    /// <summary>Đã chốt — điều phối đã lock số suất, có thể điều chỉnh nhỏ.</summary>
    public const string Confirmed = "CONFIRMED";

    /// <summary>Đã hoàn tất — bếp trưởng/điều phối signoff sau ca nấu.</summary>
    public const string Completed = "COMPLETED";

    /// <summary>Lưu trữ — ca đã được archive, không chỉnh sửa thêm.</summary>
    public const string Archived = "ARCHIVED";

    /// <summary>
    /// Kiểm tra xem trạng thái có thể chuyển hợp lệ không.
    /// Các chuyển đổi được phép:
    ///   DRAFT      → CONFIRMED
    ///   CONFIRMED  → COMPLETED
    ///   COMPLETED  → ARCHIVED
    /// </summary>
    public static bool CanTransition(string fromStatus, string toStatus)
        => (fromStatus, toStatus) switch
        {
            (Draft, Confirmed)     => true,
            (Confirmed, Completed) => true,
            (Completed, Archived)  => true,
            _                      => false
        };

    /// <summary>Danh sách trạng thái cho phép điều chỉnh số suất sau khi chốt.</summary>
    public static bool AllowsAdjustment(string status)
        => status == Confirmed;

    /// <summary>Danh sách trạng thái đã kết thúc ca (readonly).</summary>
    public static bool IsTerminal(string status)
        => status is Completed or Archived;
}
