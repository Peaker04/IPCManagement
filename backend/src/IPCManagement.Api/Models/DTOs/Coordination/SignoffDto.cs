namespace IPCManagement.Api.Models.DTOs.Coordination;

public class SignoffOrderRequestDto
{
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

public static class OrderStatus
{
    public const string Draft = "DRAFT";
    public const string Confirmed = "CONFIRMED";
    public const string Completed = "COMPLETED";
    public const string Archived = "ARCHIVED";

    public static bool CanTransition(string? fromStatus, string toStatus)
        => (Normalize(fromStatus), Normalize(toStatus)) switch
        {
            (Draft, Confirmed) => true,
            (Confirmed, Completed) => true,
            (Completed, Archived) => true,
            _ => false
        };

    public static string Normalize(string? status)
        => (status ?? string.Empty).Trim().ToUpperInvariant();
}
