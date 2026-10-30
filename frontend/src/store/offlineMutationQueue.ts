export interface QueuedOfflineMutation {
  id: string;
  url: string;
  method: string;
  payload: unknown;
  idempotencyKey: string;
  queuedAt: string;
}

const OFFLINE_QUEUE_KEY = 'ipc_offline_mutation_queue';

type QueueListener = (count: number) => void;
const listeners = new Set<QueueListener>();

function notify(count: number) {
  listeners.forEach((fn) => fn(count));
}

export const offlineMutationQueue = {
  getAll(): QueuedOfflineMutation[] {
    try {
      const saved = localStorage.getItem(OFFLINE_QUEUE_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  },

  enqueue(mutation: Omit<QueuedOfflineMutation, 'id' | 'queuedAt'>): QueuedOfflineMutation {
    const queue = this.getAll();
    const item: QueuedOfflineMutation = {
      ...mutation,
      id: `off_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      queuedAt: new Date().toISOString(),
    };
    queue.push(item);
    try {
      localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue));
    } catch (err) {
      console.error('Failed to enqueue offline mutation:', err);
    }
    notify(queue.length);
    return item;
  },

  async flush(
    executor: (item: QueuedOfflineMutation) => Promise<boolean>
  ): Promise<{ succeeded: number; failed: number }> {
    const queue = this.getAll();
    if (queue.length === 0) return { succeeded: 0, failed: 0 };

    let succeeded = 0;
    const remaining: QueuedOfflineMutation[] = [];

    for (const item of queue) {
      try {
        const ok = await executor(item);
        if (ok) {
          succeeded++;
        } else {
          remaining.push(item);
        }
      } catch {
        remaining.push(item);
      }
    }

    try {
      localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(remaining));
    } catch {}

    notify(remaining.length);
    return { succeeded, failed: remaining.length };
  },

  clear(): void {
    try {
      localStorage.removeItem(OFFLINE_QUEUE_KEY);
    } catch {}
    notify(0);
  },

  subscribe(listener: QueueListener): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
};

export function clearAllOfflineQueue(): void {
  offlineMutationQueue.clear();
}
