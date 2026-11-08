using System.Text;
using System.Text.Json;
using FluentAssertions;
using IPCManagement.Api.Data;
using IPCManagement.Api.Features.Reports.Contracts;
using IPCManagement.Api.Features.Reports.Services;
using IPCManagement.Api.Helpers;
using IPCManagement.Api.Models.Entities;
using IPCManagement.Api.Shared.Contracts;
using Microsoft.EntityFrameworkCore;

namespace IPCManagement.Api.Tests;

/// <summary>
/// MXE-06 trust-boundary red oracle. Production projection/export is intentionally unchanged in this task.
/// These tests must stay red until a human approves a server-side privacy contract change.
/// </summary>
public partial class WorkflowGenerationTests
{
    [Fact]
    [Trait("MXE", "MXE-06-RED")]
    public async Task Audit_list_boundary_should_not_serialize_password_secret_material()
    {
        await using var fixture = await WorkflowFixture.CreateAsync();
        await using var context = fixture.CreateContext();
        var canary = PrivacyCanary("LIST");
        await SeedPrivacyAuditAsync(context, fixture.UserId, canary);
        (await context.Auditlogs.CountAsync(row => row.EntityName == nameof(User) && row.FieldName == nameof(User.PasswordHash))).Should().Be(1);

        var service = new AuditReportService(context);
        var rows = await service.GetAuditChangesAsync(PrivacyQuery());
        var serialized = JsonSerializer.Serialize(rows);

        rows.Should().ContainSingle();
        rows[0].OldValue.Should().BeNull();
        rows[0].NewValue.Should().Be(AuditPrivacyProjection.PasswordChangedValue);
        rows[0].Reason.Should().BeNull();
        serialized.Should().NotContain(canary, "public list DTO serialization must not carry secret material");
    }

    [Fact]
    [Trait("MXE", "MXE-06-RED")]
    public async Task Audit_page_boundary_should_not_serialize_password_secret_material()
    {
        await using var fixture = await WorkflowFixture.CreateAsync();
        await using var context = fixture.CreateContext();
        var canary = PrivacyCanary("PAGE");
        await SeedPrivacyAuditAsync(context, fixture.UserId, canary);
        (await context.Auditlogs.CountAsync(row => row.EntityName == nameof(User) && row.FieldName == nameof(User.PasswordHash))).Should().Be(1);

        var page = await new AuditReportService(context).GetAuditChangePageAsync(PrivacyQuery(limit: 8));
        var serialized = JsonSerializer.Serialize(page);

        page.Items.Should().ContainSingle();
        page.Items[0].OldValue.Should().BeNull();
        page.Items[0].NewValue.Should().Be(AuditPrivacyProjection.PasswordChangedValue);
        page.Items[0].Reason.Should().BeNull();
        serialized.Should().NotContain(canary, "public page DTO serialization must not carry secret material");
    }

    [Fact]
    [Trait("MXE", "MXE-06-RED")]
    public void Audit_csv_exporter_should_not_emit_secret_material_from_a_password_dto()
    {
        var canary = PrivacyCanary("EXPORTER");
        var bytes = AuditCsvExporter.Build([
            new AuditChangeReportDto
            {
                AuditId = "audit-privacy-probe",
                ChangedAt = new DateTime(2026, 9, 5, 8, 0, 0, DateTimeKind.Utc),
                ChangedBy = "actor-privacy-probe",
                ChangedByName = "Privacy probe",
                BusinessArea = "Admin",
                EntityName = nameof(User),
                FieldName = nameof(User.PasswordHash),
                OldValue = canary,
                NewValue = canary,
                Reason = canary
            }
        ]);

        var csv = Encoding.UTF8.GetString(bytes);
        csv.Should().NotContain(canary, "the exporter is a public download boundary");
        csv.Should().Contain(AuditPrivacyProjection.PasswordChangedValue);
    }

    [Fact]
    [Trait("MXE", "MXE-06")]
    public async Task Audit_privacy_list_page_and_service_csv_should_preserve_the_same_identity_and_marker()
    {
        await using var fixture = await WorkflowFixture.CreateAsync();
        await using var context = fixture.CreateContext();
        var canary = PrivacyCanary("PARITY");
        await SeedPrivacyAuditAsync(context, fixture.UserId, canary);
        var service = new AuditReportService(context);

        var list = await service.GetAuditChangesAsync(PrivacyQuery());
        var page = await service.GetAuditChangePageAsync(PrivacyQuery(limit: 8));
        var csv = Encoding.UTF8.GetString((await service.ExportAuditChangesCsvAsync(PrivacyQuery())).Content);

        list.Should().ContainSingle();
        page.Items.Should().ContainSingle();
        page.Items[0].AuditId.Should().Be(list[0].AuditId);
        page.Items[0].NewValue.Should().Be(list[0].NewValue).And.Be(AuditPrivacyProjection.PasswordChangedValue);
        csv.Should().Contain(list[0].AuditId).And.Contain(AuditPrivacyProjection.PasswordChangedValue).And.NotContain(canary);
    }

    [Fact]
    [Trait("MXE", "MXE-06")]
    public async Task Audit_privacy_reads_should_retain_the_historical_audit_record()
    {
        await using var fixture = await WorkflowFixture.CreateAsync();
        await using var context = fixture.CreateContext();
        var canary = PrivacyCanary("RETAINED");
        await SeedPrivacyAuditAsync(context, fixture.UserId, canary);
        var before = await context.Auditlogs.CountAsync();
        var service = new AuditReportService(context);

        _ = await service.GetAuditChangesAsync(PrivacyQuery());
        _ = await service.GetAuditChangePageAsync(PrivacyQuery(limit: 8));
        _ = await service.ExportAuditChangesCsvAsync(PrivacyQuery());

        (await context.Auditlogs.CountAsync()).Should().Be(before);
        (await context.Auditlogs.SingleAsync(row => row.BusinessArea == "Admin" && row.EntityName == nameof(User) && row.FieldName == nameof(User.PasswordHash))).Reason.Should().Be(canary);
    }

    private static WorkflowReportQueryDto PrivacyQuery(int limit = 100) => new()
    {
        EntityName = nameof(User),
        FieldName = nameof(User.PasswordHash),
        Limit = limit
    };

    private static string PrivacyCanary(string suffix)
        => string.Concat("AUDIT_SECRET_", "CANARY_", suffix, "_", Guid.NewGuid().ToString("N"));

    private static async Task SeedPrivacyAuditAsync(IpcManagementContext context, byte[] actorId, string canary)
    {
        if (!await context.Users.AnyAsync(user => user.UserId == actorId))
        {
            context.Users.Add(new User
            {
                UserId = actorId,
                Username = "privacy-probe",
                FullName = "Privacy probe",
                PasswordHash = "fixture-only",
                RoleId = GuidHelper.NewId(),
                IsActive = true,
                CreatedAt = DateTime.UtcNow
            });
        }
        context.Auditlogs.Add(new AuditLog
        {
            AuditId = GuidHelper.NewId(),
            ChangedAt = DateTime.UtcNow,
            ChangedBy = actorId,
            BusinessArea = "Admin",
            EntityName = nameof(User),
            EntityId = actorId,
            FieldName = nameof(User.PasswordHash),
            OldValue = canary,
            NewValue = JsonSerializer.Serialize(new { nested = new { passwordHash = canary } }),
            Reason = canary
        });
        await context.SaveChangesAsync();
    }
}
