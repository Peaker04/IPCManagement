using System.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage;
using IPCManagement.Api.Features.SystemOperation.Services;

namespace IPCManagement.Api.Data.Transactions;

public sealed class EfTransactionRunner : IEfTransactionRunner
{
    private readonly DbContext _context;
    private readonly Func<IExecutionStrategy> _executionStrategyFactory;
    private readonly SystemOperationRequestContext? _requestContext;
    private readonly SystemOperationModeGuard? _modeGuard;

    public EfTransactionRunner(DbContext context)
        : this(context, null, null, context.Database.CreateExecutionStrategy)
    {
    }

    public EfTransactionRunner(DbContext context, SystemOperationRequestContext requestContext, SystemOperationModeGuard modeGuard)
        : this(context, requestContext, modeGuard, context.Database.CreateExecutionStrategy)
    {
    }

    public EfTransactionRunner(DbContext context, Func<IExecutionStrategy> executionStrategyFactory)
        : this(context, null, null, executionStrategyFactory)
    {
    }

    private EfTransactionRunner(DbContext context, SystemOperationRequestContext? requestContext, SystemOperationModeGuard? modeGuard, Func<IExecutionStrategy> executionStrategyFactory)
    {
        _context = context;
        _requestContext = requestContext;
        _modeGuard = modeGuard;
        _executionStrategyFactory = executionStrategyFactory;
    }

    public Task ExecuteAsync(
        Func<CancellationToken, Task> operation,
        Func<CancellationToken, Task<bool>> verifySucceeded,
        IsolationLevel isolationLevel = IsolationLevel.ReadCommitted,
        CancellationToken cancellationToken = default)
    {
        return ExecuteAsync(
            async token =>
            {
                await operation(token);
                return true;
            },
            verifySucceeded,
            isolationLevel,
            cancellationToken);
    }

    public Task<TResult> ExecuteProtectedAsync<TResult>(
        string operationKey,
        long expectedModeVersion,
        Func<CancellationToken, Task<TResult>> operation,
        Func<CancellationToken, Task<bool>> verifySucceeded,
        IsolationLevel isolationLevel = IsolationLevel.ReadCommitted,
        CancellationToken cancellationToken = default)
    {
        if (_requestContext is null) throw new InvalidOperationException("Protected transaction context is unavailable.");
        _requestContext.OperationKey = operationKey;
        _requestContext.ExpectedModeVersion = expectedModeVersion;
        _requestContext.Disposition = OperationDisposition.Retained;
        return ExecuteAsync(operation, verifySucceeded, isolationLevel, cancellationToken);
    }

    public async Task<TResult> ExecuteAsync<TResult>(
        Func<CancellationToken, Task<TResult>> operation,
        Func<CancellationToken, Task<bool>> verifySucceeded,
        IsolationLevel isolationLevel = IsolationLevel.ReadCommitted,
        CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(operation);
        ArgumentNullException.ThrowIfNull(verifySucceeded);

        if (!_context.Database.IsRelational())
        {
            return await operation(cancellationToken);
        }

        var attempt = 0;
        var strategy = _executionStrategyFactory();

        return await ExecutionStrategyExtensions.ExecuteInTransactionAsync<TransactionExecution<TResult>, TResult>(
            strategy,
            new TransactionExecution<TResult>(operation, verifySucceeded),
            async (state, token) =>
            {
                if (attempt++ > 0)
                {
                    // A failed relational transaction leaves tracked states behind. Retrying those
                    // states can silently skip or duplicate writes, so every retry starts clean.
                    // Callers must load all mutable entities inside the operation delegate.
                    _context.ChangeTracker.Clear();
                }

                var result = await state.Operation(token);
                if (_modeGuard is not null && _requestContext?.OperationKey is { } operationKey && _requestContext.ExpectedModeVersion is { } expectedVersion)
                {
                    _context.ChangeTracker.Clear();
                    await _modeGuard.ValidateAsync(operationKey, expectedVersion, _requestContext.Disposition, token);
                }
                return result;
            },
            async (state, token) =>
            {
                // Commit may have succeeded even when the connection dropped. Verify against the
                // database without accepting a tracked entity from the uncertain attempt.
                _context.ChangeTracker.Clear();
                return await state.VerifySucceeded(token);
            },
            (context, token) =>
                context.Database.BeginTransactionAsync(isolationLevel, token),
            cancellationToken);
    }

    private sealed record TransactionExecution<TResult>(
        Func<CancellationToken, Task<TResult>> Operation,
        Func<CancellationToken, Task<bool>> VerifySucceeded);
}
