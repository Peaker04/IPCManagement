namespace IPCManagement.Api.Features.SystemOperation.Services;

[AttributeUsage(AttributeTargets.Class | AttributeTargets.Method, AllowMultiple = false)]
public sealed class SystemOperationAttribute(string operationKey, OperationDisposition disposition = OperationDisposition.Retained) : Attribute
{
    public string OperationKey { get; } = operationKey;
    public OperationDisposition Disposition { get; } = disposition;
}

[AttributeUsage(AttributeTargets.Class | AttributeTargets.Method, AllowMultiple = false)]
public sealed class SystemOperationNeutralAttribute : Attribute;
