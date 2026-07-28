namespace IPCManagement.Api.Exceptions;

/// <summary>
/// Trạng thái tài nguyên xung đột với thao tác đang thực hiện (map HTTP 409):
/// trùng khóa nghiệp vụ, chứng từ đã chốt, hoặc người khác vừa đổi dữ liệu.
/// </summary>
public class ResourceConflictException : Exception
{
    public ResourceConflictException(string message)
        : base(message)
    {
    }

    public ResourceConflictException(string message, Exception innerException)
        : base(message, innerException)
    {
    }
}
