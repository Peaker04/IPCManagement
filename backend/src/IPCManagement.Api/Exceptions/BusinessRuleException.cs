namespace IPCManagement.Api.Exceptions;

/// <summary>
/// Vi phạm quy tắc nghiệp vụ do dữ liệu người dùng gửi lên (map HTTP 400).
/// Dùng thay cho <see cref="InvalidOperationException"/> để tách lỗi nghiệp vụ
/// khỏi lỗi lập trình — nhờ đó alert theo error-rate mới nhìn thấy lỗi 500 thật.
/// </summary>
public class BusinessRuleException : Exception
{
    public BusinessRuleException(string message)
        : base(message)
    {
    }

    public BusinessRuleException(string message, Exception innerException)
        : base(message, innerException)
    {
    }
}
