using System.Text.Json;
using System.Text.Json.Nodes;
using System.Text.RegularExpressions;
using IPCManagement.Api.Features.Reports.Contracts;

namespace IPCManagement.Api.Features.Reports.Services;

/// <summary>
/// Redacts sensitive audit values at public read/export boundaries without changing stored audit history.
/// </summary>
public static partial class AuditPrivacyProjection
{
    public const string RedactedValue = "Thông tin nhạy cảm đã được ẩn";
    public const string PasswordChangedValue = "Đã đổi mật khẩu";

    private const int MaxStructuredLength = 32_768;
    private const int MaxJsonDepth = 16;

    public static AuditChangeReportDto Project(AuditChangeReportDto source)
    {
        ArgumentNullException.ThrowIfNull(source);

        var passwordTuple = IsPasswordTuple(source.BusinessArea, source.EntityName, source.FieldName);
        return new AuditChangeReportDto
        {
            AuditId = source.AuditId,
            ChangedAt = source.ChangedAt,
            ChangedBy = source.ChangedBy,
            ChangedByName = source.ChangedByName,
            BusinessArea = source.BusinessArea,
            EntityName = source.EntityName,
            EntityId = source.EntityId,
            FieldName = source.FieldName,
            OldValue = passwordTuple ? null : RedactValue(source.OldValue),
            NewValue = passwordTuple ? PasswordChangedValue : RedactValue(source.NewValue),
            Reason = passwordTuple ? null : RedactValue(source.Reason),
            CorrelationId = source.CorrelationId,
            SourceFamily = source.SourceFamily,
            MaterialRequestId = source.MaterialRequestId,
            MaterialRequestLineId = source.MaterialRequestLineId,
            ReconciliationBatchId = source.ReconciliationBatchId,
            ReconciliationBatchLineId = source.ReconciliationBatchLineId,
            EventId = source.EventId,
            EventType = source.EventType,
            EventRole = source.EventRole,
            EventCode = source.EventCode,
            EventLineCount = source.EventLineCount,
            EventStatus = source.EventStatus
        };
    }

    public static IReadOnlyList<AuditChangeReportDto> Project(IReadOnlyList<AuditChangeReportDto> rows)
        => rows.Select(Project).ToList();

    public static bool IsPasswordTuple(string? businessArea, string? entityName, string? fieldName)
        => string.Equals(businessArea?.Trim(), "Admin", StringComparison.OrdinalIgnoreCase)
           && string.Equals(entityName?.Trim(), "User", StringComparison.OrdinalIgnoreCase)
           && string.Equals(fieldName?.Trim(), "PasswordHash", StringComparison.OrdinalIgnoreCase);

    public static string? RedactValue(string? value)
    {
        if (string.IsNullOrWhiteSpace(value)) return value;
        var trimmed = value.Trim();

        if (trimmed.Length <= MaxStructuredLength && LooksLikeJson(trimmed))
        {
            try
            {
                var node = JsonNode.Parse(trimmed, documentOptions: new JsonDocumentOptions { MaxDepth = MaxJsonDepth });
                if (node is not null)
                {
                    var changed = RedactJson(node, propertyName: null, depth: 0);
                    if (changed) return node.ToJsonString(new JsonSerializerOptions { WriteIndented = false });
                }
            }
            catch (JsonException)
            {
                // Malformed structured values fall through to the high-confidence whole-slot detector.
            }
        }

        return ContainsSensitiveMaterial(trimmed) ? RedactedValue : value;
    }

    public static bool ContainsSensitiveMaterial(string value)
        => BcryptRegex().IsMatch(value)
           || BearerRegex().IsMatch(value)
           || JwtRegex().IsMatch(value)
           || PrivateKeyRegex().IsMatch(value)
           || SensitiveAssignmentRegex().IsMatch(value);

    private static bool RedactJson(JsonNode node, string? propertyName, int depth)
    {
        if (depth > MaxJsonDepth) return false;
        if (propertyName is not null && IsSensitiveKey(propertyName))
        {
            ReplaceNodeValue(node, RedactedValue);
            return true;
        }

        var changed = false;
        switch (node)
        {
            case JsonObject obj:
                foreach (var property in obj.ToList())
                {
                    if (property.Value is null) continue;
                    if (IsSensitiveKey(property.Key))
                    {
                        obj[property.Key] = RedactedValue;
                        changed = true;
                    }
                    else
                    {
                        changed |= RedactJson(property.Value, property.Key, depth + 1);
                    }
                }
                break;
            case JsonArray array:
                for (var index = 0; index < array.Count; index++)
                {
                    var item = array[index];
                    if (item is null) continue;
                    if (item is JsonValue jsonValue && jsonValue.TryGetValue<string>(out var text) && ContainsSensitiveMaterial(text))
                    {
                        array[index] = RedactedValue;
                        changed = true;
                    }
                    else
                    {
                        changed |= RedactJson(item, null, depth + 1);
                    }
                }
                break;
            case JsonValue jsonValue when jsonValue.TryGetValue<string>(out var text) && ContainsSensitiveMaterial(text):
                ReplaceNodeValue(node, RedactedValue);
                changed = true;
                break;
        }
        return changed;
    }

    private static void ReplaceNodeValue(JsonNode node, string value)
    {
        if (node.Parent is JsonObject parentObject)
        {
            var key = parentObject.First(property => ReferenceEquals(property.Value, node)).Key;
            parentObject[key] = value;
        }
        else if (node.Parent is JsonArray parentArray)
        {
            var index = parentArray.IndexOf(node);
            parentArray[index] = value;
        }
    }

    private static bool LooksLikeJson(string value)
        => (value.StartsWith('{') && value.EndsWith('}')) || (value.StartsWith('[') && value.EndsWith(']'));

    private static bool IsSensitiveKey(string key)
    {
        var normalized = new string(key.Where(char.IsLetterOrDigit).Select(char.ToLowerInvariant).ToArray());
        return normalized is "password" or "passwordhash" or "passwd" or "accesstoken" or "refreshtoken" or "apikey" or "clientsecret" or "privatekey";
    }

    [GeneratedRegex(@"\$2[aby]\$\d{2}\$[./A-Za-z0-9]{20,}", RegexOptions.CultureInvariant)]
    private static partial Regex BcryptRegex();

    [GeneratedRegex(@"\bBearer\s+[A-Za-z0-9._~+/=-]{12,}", RegexOptions.IgnoreCase | RegexOptions.CultureInvariant)]
    private static partial Regex BearerRegex();

    [GeneratedRegex(@"\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b", RegexOptions.CultureInvariant)]
    private static partial Regex JwtRegex();

    [GeneratedRegex(@"-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----", RegexOptions.IgnoreCase | RegexOptions.CultureInvariant)]
    private static partial Regex PrivateKeyRegex();

    [GeneratedRegex("[\\\"']?(?:password(?:hash)?|passwd|access[_-]?token|refresh[_-]?token|api[_-]?key|client[_-]?secret|private[_-]?key)[\\\"']?\\s*[:=]\\s*[\\\"']?[^\\s,;}\\\"]{6,}", RegexOptions.IgnoreCase | RegexOptions.CultureInvariant)]
    private static partial Regex SensitiveAssignmentRegex();
}
