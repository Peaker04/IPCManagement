using System.Text.Json;
using System.Text.Json.Nodes;
using FluentAssertions;
using IPCManagement.Api.Features.Reports.Contracts;
using IPCManagement.Api.Features.Reports.Services;

namespace IPCManagement.Api.Tests;

public class AuditPrivacyProjectionTests
{
    [Theory]
    [InlineData("Admin", "User", "PasswordHash")]
    [InlineData(" admin ", " USER ", " passwordhash ")]
    public void Password_tuple_aliases_should_emit_only_business_marker(string area, string entity, string field)
    {
        var source = Row(area, entity, field, "old-sensitive", "new-sensitive", "reason-sensitive");

        var result = AuditPrivacyProjection.Project(source);

        result.OldValue.Should().BeNull();
        result.NewValue.Should().Be(AuditPrivacyProjection.PasswordChangedValue);
        result.Reason.Should().BeNull();
    }

    [Theory]
    [InlineData("OldValue")]
    [InlineData("NewValue")]
    [InlineData("Reason")]
    public void Every_value_slot_should_redact_high_confidence_sensitive_assignments(string slot)
    {
        var source = Row("Unknown", "Unknown", "Unknown", "safe-old", "safe-new", "safe-reason");
        var sensitive = $"clientSecret={SyntheticCredential("slot")}";
        SetSlot(source, slot, sensitive);

        var result = AuditPrivacyProjection.Project(source);

        GetSlot(result, slot).Should().Be(AuditPrivacyProjection.RedactedValue);
    }

    [Fact]
    public void Valid_nested_json_should_redact_sensitive_keys_and_preserve_safe_business_facts()
    {
        var source = Row("Unknown", "Unknown", "Payload", null,
            JsonSerializer.Serialize(new { status = "READY", nested = new { accessToken = SyntheticCredential("json"), servings = 120 } }), null);

        var result = AuditPrivacyProjection.Project(source);

        var projectedJson = JsonNode.Parse(result.NewValue!)!.AsObject();
        projectedJson["status"]!.GetValue<string>().Should().Be("READY");
        projectedJson["nested"]!["servings"]!.GetValue<int>().Should().Be(120);
        projectedJson["nested"]!["accessToken"]!.GetValue<string>().Should().Be(AuditPrivacyProjection.RedactedValue);
        result.NewValue.Should().NotContain(SyntheticCredential("json"));
    }

    [Fact]
    public void Malformed_sensitive_assignment_should_redact_the_whole_slot()
    {
        var value = $"{{not-json; refresh_token={SyntheticCredential("malformed")}";
        AuditPrivacyProjection.RedactValue(value).Should().Be(AuditPrivacyProjection.RedactedValue);
    }

    [Theory]
    [InlineData("Người dùng yêu cầu đổi mật khẩu trong phiên hỗ trợ")]
    [InlineData("token định lượng đã hết hạn; hãy kiểm tra lại nguồn")]
    [InlineData("previewToken=preview-command-42")]
    [InlineData("Số âm hợp lệ -12.5")]
    public void Safe_business_wording_and_workflow_tokens_should_be_retained(string value)
    {
        AuditPrivacyProjection.RedactValue(value).Should().Be(value);
    }

    [Fact]
    public void Collection_projection_should_preserve_row_count()
    {
        var source = Row("Admin", "User", "PasswordHash", "old", "new", "reason");
        AuditPrivacyProjection.Project([source]).Should().ContainSingle();
    }

    [Fact]
    public void Projection_should_be_idempotent_and_should_not_mutate_the_caller_dto()
    {
        var source = Row("Unknown", "Unknown", "Payload", "safe", $"apiKey={SyntheticCredential("copy")}", "business reason");
        var before = JsonSerializer.Serialize(source);

        var once = AuditPrivacyProjection.Project(source);
        var twice = AuditPrivacyProjection.Project(once);

        JsonSerializer.Serialize(source).Should().Be(before);
        JsonSerializer.Serialize(twice).Should().Be(JsonSerializer.Serialize(once));
        once.Should().NotBeSameAs(source);
    }

    [Fact]
    public void Projection_should_preserve_identity_ordering_and_lineage_fields()
    {
        var source = Row("Admin", "User", "PasswordHash", "old", "new", "reason");
        source.AuditId = "audit-42";
        source.ChangedAt = new DateTime(2026, 9, 5, 8, 0, 0, DateTimeKind.Utc);
        source.ChangedBy = "actor-42";
        source.ChangedByName = "Actor name";
        source.EntityId = "entity-42";
        source.CorrelationId = "corr-42";
        source.SourceFamily = "MATERIAL_RECONCILIATION";
        source.MaterialRequestId = "request-42";
        source.MaterialRequestLineId = "request-line-42";
        source.ReconciliationBatchId = "batch-42";
        source.ReconciliationBatchLineId = "batch-line-42";

        var result = AuditPrivacyProjection.Project(source);

        result.Should().BeEquivalentTo(source, options => options.Excluding(row => row.OldValue).Excluding(row => row.NewValue).Excluding(row => row.Reason));
    }

    [Fact]
    public void Direct_exporter_defense_should_redact_without_mutating_source()
    {
        var source = Row("Unknown", "Unknown", "Payload", "safe", $"password={SyntheticCredential("csv")}", "safe reason");
        var before = JsonSerializer.Serialize(source);

        var csv = System.Text.Encoding.UTF8.GetString(AuditCsvExporter.Build([source]));

        csv.Should().Contain(AuditPrivacyProjection.RedactedValue);
        csv.Should().NotContain(SyntheticCredential("csv"));
        JsonSerializer.Serialize(source).Should().Be(before);
    }

    private static AuditChangeReportDto Row(string area, string entity, string field, string? oldValue, string? newValue, string? reason) => new()
    {
        AuditId = "audit",
        ChangedAt = new DateTime(2026, 9, 5, 8, 0, 0, DateTimeKind.Utc),
        ChangedBy = "actor",
        ChangedByName = "Actor",
        BusinessArea = area,
        EntityName = entity,
        FieldName = field,
        OldValue = oldValue,
        NewValue = newValue,
        Reason = reason
    };

    private static string SyntheticCredential(string suffix) => $"value-{suffix}-1234567890abcdef";

    private static void SetSlot(AuditChangeReportDto row, string slot, string value)
    {
        if (slot == "OldValue") row.OldValue = value;
        else if (slot == "NewValue") row.NewValue = value;
        else row.Reason = value;
    }

    private static string? GetSlot(AuditChangeReportDto row, string slot)
        => slot == "OldValue" ? row.OldValue : slot == "NewValue" ? row.NewValue : row.Reason;
}
