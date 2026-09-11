namespace IPCManagement.Api.Features.Approvals.Services;

internal sealed record ApprovalInboxCursor(DateOnly DueDate, string TargetCode, string InboxItemId);
