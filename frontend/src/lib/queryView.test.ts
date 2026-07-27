import { describe, expect, it, vi } from 'vitest';
import { toQueryView, type QuerySnapshot } from './queryView';

const snapshot = <T>(overrides: Partial<QuerySnapshot<T>> = {}): QuerySnapshot<T> => ({
  isUninitialized: false,
  isLoading: false,
  isFetching: false,
  isSuccess: false,
  isError: false,
  ...overrides,
});

const options = (retry = vi.fn()) => ({
  instruction: 'Chọn phạm vi để xem dữ liệu.',
  retry,
  errorMessage: 'Không tải được dữ liệu.',
});

describe('toQueryView', () => {
  it('keeps a skipped query uninitialized instead of treating it as empty', () => {
    expect(toQueryView(snapshot<string[]>({ isUninitialized: true }), options())).toEqual({
      phase: 'uninitialized',
      instruction: 'Chọn phạm vi để xem dữ liệu.',
    });
  });

  it('maps the first request without data to loading', () => {
    expect(toQueryView(snapshot<string[]>({ isLoading: true, isFetching: true }), options())).toEqual({
      phase: 'loading',
    });
  });

  it('keeps an authoritative empty collection in ready state', () => {
    expect(toQueryView(snapshot<string[]>({ data: [], isSuccess: true }), options())).toEqual({
      phase: 'ready',
      data: [],
      isRefreshing: false,
      truncation: null,
    });
  });

  it('maps successful data to ready', () => {
    expect(toQueryView(snapshot({ data: ['item'], isSuccess: true }), options())).toMatchObject({
      phase: 'ready',
      data: ['item'],
      isRefreshing: false,
    });
  });

  it('preserves current data while a refresh is in flight', () => {
    expect(toQueryView(snapshot({
      data: ['old cache'],
      currentData: ['current cache'],
      isFetching: true,
      isSuccess: true,
    }), options())).toEqual({
      phase: 'ready',
      data: ['current cache'],
      isRefreshing: true,
      truncation: null,
    });
  });

  it('carries partial-result evidence into the ready view', () => {
    const view = toQueryView(snapshot({
      data: { items: ['one', 'two'], totalCount: 5 },
      isSuccess: true,
    }), {
      ...options(),
      getTruncation: (data) => ({ shown: data.items.length, total: data.totalCount }),
    });

    expect(view).toMatchObject({
      phase: 'ready',
      truncation: { shown: 2, total: 5 },
    });
  });

  it('maps HTTP 403 to forbidden without exposing retry', () => {
    expect(toQueryView(snapshot<string[]>({
      error: { status: 403 },
      isError: true,
    }), options())).toEqual({
      phase: 'forbidden',
      message: 'Bạn không có quyền xem dữ liệu này.',
    });
  });

  it('maps other failures to an actionable error', () => {
    const retry = vi.fn();
    const view = toQueryView(snapshot<string[]>({
      error: { status: 500 },
      isError: true,
      isFetching: true,
    }), options(retry));

    expect(view).toEqual({
      phase: 'error',
      message: 'Không tải được dữ liệu.',
      retry,
      isRetrying: true,
    });
  });
});
