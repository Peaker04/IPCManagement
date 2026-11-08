using System.Data;
using IPCManagement.Api.Data.Transactions;

namespace IPCManagement.Api.Tests;

internal sealed class ImmediateTransactionRunner : IEfTransactionRunner
{
    public int ExecutionCount { get; private set; }

    public async Task ExecuteAsync(
        Func<CancellationToken, Task> operation,
        Func<CancellationToken, Task<bool>> verifySucceeded,
        IsolationLevel isolationLevel = IsolationLevel.ReadCommitted,
        CancellationToken cancellationToken = default)
    {
        ExecutionCount++;
        await operation(cancellationToken);
    }

    public async Task<TResult> ExecuteProtectedAsync<TResult>(
        string operationKey,
        long expectedModeVersion,
        Func<CancellationToken, Task<TResult>> operation,
        Func<CancellationToken, Task<bool>> verifySucceeded,
        IsolationLevel isolationLevel = IsolationLevel.ReadCommitted,
        CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(operationKey) || expectedModeVersion < 1)
            throw new InvalidOperationException("Protected transaction requires mode context.");
        ExecutionCount++;
        return await operation(cancellationToken);
    }

    public async Task<TResult> ExecuteAsync<TResult>(
        Func<CancellationToken, Task<TResult>> operation,
        Func<CancellationToken, Task<bool>> verifySucceeded,
        IsolationLevel isolationLevel = IsolationLevel.ReadCommitted,
        CancellationToken cancellationToken = default)
    {
        ExecutionCount++;
        return await operation(cancellationToken);
    }
}
