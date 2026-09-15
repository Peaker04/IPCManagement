import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { useBatchReceiptCommandId } from './useBatchReceiptCommandId';

describe('WarehouseBatchPurchaseReceiptDialog command identity', () => {
  it('keeps one key for retries and creates a new key after the dialog is reopened', () => {
    const first = renderHook(() => useBatchReceiptCommandId());
    const firstCommand = first.result.current;
    first.rerender();
    expect(first.result.current).toBe(firstCommand);

    first.unmount();
    const second = renderHook(() => useBatchReceiptCommandId());
    expect(second.result.current).not.toBe(firstCommand);
  });
});
