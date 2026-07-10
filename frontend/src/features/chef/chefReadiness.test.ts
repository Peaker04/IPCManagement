import { describe, expect, it } from 'vitest';

import { countPendingKitchenReceipts, getChefReadiness } from './chefReadiness';

describe('chefReadiness', () => {
  it('marks sent production lines as kitchen-ready even when they still carry warning quantities', () => {
    expect(getChefReadiness({ sentToKitchenAt: '2026-07-10T05:00:00Z', hasKitchenIssue: true })).toEqual({
      variant: 'success',
      label: 'Đã gửi bếp',
    });
  });

  it('warns kitchen when the production line has stock or purchasing issues before send', () => {
    expect(getChefReadiness({ sentToKitchenAt: null, hasKitchenIssue: true })).toEqual({
      variant: 'warning',
      label: 'Cần kho/thu mua',
    });
  });

  it('keeps unsent clean lines in neutral waiting state', () => {
    expect(getChefReadiness({ hasKitchenIssue: false })).toEqual({
      variant: 'neutral',
      label: 'Chờ gửi',
    });
  });

  it('counts only documents that kitchen has not confirmed yet', () => {
    expect(countPendingKitchenReceipts([
      { isReceivedByKitchen: true },
      { isReceivedByKitchen: false },
      {},
    ])).toBe(2);
  });
});
