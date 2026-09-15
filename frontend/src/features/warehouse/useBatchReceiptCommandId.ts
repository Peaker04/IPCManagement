import { useState } from 'react';

export const useBatchReceiptCommandId = () => {
  const [commandId] = useState(() => `warehouse-po-batch-${crypto.randomUUID()}`);
  return commandId;
};
