using IPCManagement.Api.Features.Reconciliation.Services;
using Microsoft.EntityFrameworkCore;

namespace IPCManagement.Api.Tests;

public sealed class ReconciliationDuplicateHandlerTests
{
    [Theory]
    [InlineData("Duplicate entry 'x' for key 'ux_reconciliationbatches_quantityImportBatchId'")]
    [InlineData("SQLite Error 19: 'UNIQUE constraint failed: reconciliationbatches.QuantityImportBatchId'.")]
    [InlineData("UNIQUE constraint failed: reconciliationbatches_ux_reconciliationbatches_quantityImportBatchId")]
    public void Batch_duplicate_handler_accepts_only_import_fence_shapes(string message)
    {
        Assert.True(ReconciliationBatchService.IsQuantityImportBatchDuplicate(UpdateError(message)));
        Assert.False(ReconciliationBatchService.IsQuantityImportBatchDuplicate(
            UpdateError("Duplicate entry 'x' for key 'ux_reconciliationbatchlines_grain'")));
    }

    [Theory]
    [InlineData("Duplicate entry 'x' for key 'ux_quantityimportbatches_contentFingerprint'")]
    [InlineData("SQLite Error 19: 'UNIQUE constraint failed: quantityimportbatches.contentFingerprint'.")]
    [InlineData("UNIQUE constraint failed: quantityimportbatches_ux_quantityimportbatches_contentFingerprint")]
    public void Import_duplicate_handler_accepts_only_fingerprint_fence_shapes(string message)
    {
        Assert.True(ReconciliationQuantityImportService.IsContentFingerprintDuplicate(UpdateError(message)));
        Assert.False(ReconciliationQuantityImportService.IsContentFingerprintDuplicate(
            UpdateError("Duplicate entry 'x' for key 'ux_quantityimportbatches_batchCode'")));
    }

    private static DbUpdateException UpdateError(string message) =>
        new("Persistence failed", new InvalidOperationException(message));
}
