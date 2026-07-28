using System.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage;

namespace IPCManagement.Api.Data.Transactions;

public sealed class EfTransactionRunner : IEfTransactionRunner
{
    private readonly DbContext _context;
    private readonly Func<IExecutionStrategy> _executionStrategyFactory;

    public EfTransactionRunner(DbContext context)
        : this(context, context.Database.CreateExecutionStrategy)
    {
    }

    public EfTransactionRunner(
        DbContext context,
        Func<IExecutionStrategy> executionStrategyFactory)
    {
        _context = context;
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

                return await state.Operation(token);
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
