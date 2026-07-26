import type { ProductionPlanLine } from '@/features/workflow';

export type ChefReadiness = {
  variant: 'success' | 'warning' | 'neutral';
  label: string;
};

export type ChefReadinessLine = Pick<ProductionPlanLine, 'hasKitchenIssue'> & {
  sentToKitchenAt?: string | null;
};

export function getChefReadiness(line: ChefReadinessLine): ChefReadiness {
  if (line.sentToKitchenAt) {
    return { variant: 'success', label: 'Đã gửi bếp' };
  }
  if (line.hasKitchenIssue) {
    return { variant: 'warning', label: 'Cần kho/thu mua' };
  }
  return { variant: 'neutral', label: 'Chờ gửi' };
}

export function countPendingKitchenReceipts(lines: Array<{ isReceivedByKitchen?: boolean }>): number {
  return lines.filter((line) => !line.isReceivedByKitchen).length;
}
