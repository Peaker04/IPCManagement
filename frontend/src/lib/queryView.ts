export interface QueryViewTruncation {
  shown: number;
  total?: number;
}

export type QueryView<T> =
  | { phase: 'uninitialized'; instruction: string }
  | { phase: 'loading' }
  | { phase: 'forbidden'; message: string }
  | { phase: 'error'; message: string; retry: () => unknown; isRetrying: boolean }
  | {
      phase: 'ready';
      data: T;
      isRefreshing: boolean;
      truncation: QueryViewTruncation | null;
    };

export interface QuerySnapshot<T> {
  data?: T;
  currentData?: T;
  error?: unknown;
  isUninitialized: boolean;
  isLoading: boolean;
  isFetching: boolean;
  isSuccess: boolean;
  isError: boolean;
}

interface QueryViewOptions<T> {
  instruction: string;
  retry: () => unknown;
  errorMessage: string | ((error: unknown) => string);
  forbiddenMessage?: string;
  isForbidden?: (error: unknown) => boolean;
  getTruncation?: (data: T) => QueryViewTruncation | null;
}

export function isQueryErrorStatus(error: unknown, status: number): boolean {
  if (typeof error !== 'object' || error === null || !('status' in error)) return false;
  return error.status === status;
}

export function toQueryView<T>(query: QuerySnapshot<T>, options: QueryViewOptions<T>): QueryView<T> {
  if (query.isUninitialized) {
    return { phase: 'uninitialized', instruction: options.instruction };
  }

  if (query.isError) {
    const isForbidden = options.isForbidden?.(query.error) ?? isQueryErrorStatus(query.error, 403);
    if (isForbidden) {
      return {
        phase: 'forbidden',
        message: options.forbiddenMessage ?? 'Bạn không có quyền xem dữ liệu này.',
      };
    }

    return {
      phase: 'error',
      message: typeof options.errorMessage === 'function'
        ? options.errorMessage(query.error)
        : options.errorMessage,
      retry: options.retry,
      isRetrying: query.isFetching,
    };
  }

  const data = query.currentData !== undefined ? query.currentData : query.data;
  if (data !== undefined) {
    return {
      phase: 'ready',
      data,
      isRefreshing: query.isFetching,
      truncation: options.getTruncation?.(data) ?? null,
    };
  }

  if (query.isSuccess) {
    return {
      phase: 'ready',
      data: data as T,
      isRefreshing: query.isFetching,
      truncation: null,
    };
  }

  return { phase: 'loading' };
}
