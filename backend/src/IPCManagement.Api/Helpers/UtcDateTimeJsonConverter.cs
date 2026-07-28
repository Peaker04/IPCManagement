using System.Text.Json;
using System.Text.Json.Serialization;

namespace IPCManagement.Api.Helpers;

/// <summary>
/// MySQL trả DateTime với Kind=Unspecified nên JSON mặc định không có hậu tố "Z",
/// khiến client parse nhầm thành giờ local. Converter này luôn xuất ISO-8601 UTC.
/// Chỉ áp dụng cho DateTime — DateOnly/TimeOnly giữ nguyên định dạng mặc định.
/// </summary>
public sealed class UtcDateTimeJsonConverter : JsonConverter<DateTime>
{
    public override DateTime Read(ref Utf8JsonReader reader, Type typeToConvert, JsonSerializerOptions options)
        => reader.GetDateTime();

    public override void Write(Utf8JsonWriter writer, DateTime value, JsonSerializerOptions options)
    {
        var utcValue = value.Kind switch
        {
            DateTimeKind.Utc => value,
            DateTimeKind.Local => value.ToUniversalTime(),
            _ => DateTime.SpecifyKind(value, DateTimeKind.Utc)
        };

        writer.WriteStringValue(utcValue);
    }
}
