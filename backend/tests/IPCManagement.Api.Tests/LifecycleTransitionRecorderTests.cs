using FluentAssertions;
using IPCManagement.Api.Data;
using IPCManagement.Api.Helpers;
using IPCManagement.Api.Shared.Lifecycle;
using Microsoft.EntityFrameworkCore;

namespace IPCManagement.Api.Tests;

public sealed class LifecycleTransitionRecorderTests
{
    [Fact]
    public async Task Stage_Should_AddTransitionOutboxCommandReceiptAndAuditTogether()
    {
        var options = new DbContextOptionsBuilder<IpcManagementContext>()
            .UseInMemoryDatabase($"lifecycle-kernel-{Guid.NewGuid():N}")
            .Options;
        var aggregateId = GuidHelper.NewId();
        var actorId = GuidHelper.NewId();
        await using var context = new IpcManagementContext(options);
        var recorder = new LifecycleTransitionRecorder(context);

        var transition = recorder.Stage(new LifecycleTransitionRequest(
            "ServiceRun", aggregateId, "cmd-kernel-1", 0, "PLANNED", "BLOCKED", actorId, 0,
            "Thiếu BOM", "corr-kernel-1", null, "{\"blocker\":\"BOM_INCOMPLETE\"}", "{\"status\":\"BLOCKED\"}"));

        await context.SaveChangesAsync();

        transition.ToState.Should().Be("BLOCKED");
        context.Lifecycletransitions.Should().ContainSingle(item => item.CommandId == "cmd-kernel-1");
        context.Lifecycleoutboxmessages.Should().ContainSingle(item => item.Status == "PENDING" && item.CommandId == "cmd-kernel-1");
        context.Lifecyclecommandreceipts.Should().ContainSingle(item => item.CommandId == "cmd-kernel-1");
        context.Auditlogs.Should().ContainSingle(item => item.BusinessArea == "Lifecycle" && item.CorrelationId == "corr-kernel-1");
    }

    [Fact]
    public async Task FindExistingCommand_Should_ReturnPriorResponseForIdempotentReplay()
    {
        var options = new DbContextOptionsBuilder<IpcManagementContext>()
            .UseInMemoryDatabase($"lifecycle-replay-{Guid.NewGuid():N}")
            .Options;
        var aggregateId = GuidHelper.NewId();
        await using (var context = new IpcManagementContext(options))
        {
            var recorder = new LifecycleTransitionRecorder(context);
            recorder.Stage(new LifecycleTransitionRequest(
                "Receipt", aggregateId, "cmd-replay-1", 1, "APPROVED", "POSTED", null, 1,
                null, "corr-replay-1", null, "{}", "{\"receiptId\":\"r1\"}"));
            await context.SaveChangesAsync();
        }

        await using var verificationContext = new IpcManagementContext(options);
        var existing = await new LifecycleTransitionRecorder(verificationContext)
            .FindExistingCommandAsync("cmd-replay-1", "Receipt", aggregateId);

        existing.Should().NotBeNull();
        existing!.ResponseJson.Should().Be("{\"receiptId\":\"r1\"}");
    }
}
