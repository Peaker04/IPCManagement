/**
 * Enterprise Idempotency-Key Generator and Lifecycle Manager (Rule L5-DATA-03 & L4-UI-01)
 * Guarantees exactly-once mutation execution on backend under flaky network retries.
 */

export function generateIdempotencyKey(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'idemp_' + Math.random().toString(36).substring(2, 15) + '_' + Date.now().toString(36);
}

class IdempotencyKeyManager {
  private activeKeys = new Map<string, string>();

  /**
   * Retrieves existing idempotency key for an ongoing operation or generates a new one.
   */
  getOrCreateKey(operationScope: string): string {
    const existing = this.activeKeys.get(operationScope);
    if (existing) {
      return existing;
    }
    const fresh = generateIdempotencyKey();
    this.activeKeys.set(operationScope, fresh);
    return fresh;
  }

  /**
   * Rotates key upon successful completion or user cancellation of the operation.
   */
  rotateKey(operationScope: string): string {
    this.activeKeys.delete(operationScope);
    return this.getOrCreateKey(operationScope);
  }

  clearKey(operationScope: string): void {
    this.activeKeys.delete(operationScope);
  }

  clearAll(): void {
    this.activeKeys.clear();
  }
}

export const idempotencyManager = new IdempotencyKeyManager();

export function getIdempotencyHeader(key: string): Record<string, string> {
  return {
    'Idempotency-Key': key,
  };
}
