import { roundQuantity } from '@/lib/formatters'

export type IssueQuantityRelation = 'invalid' | 'under' | 'exact' | 'over'

export const compareIssueQuantity = (entered: number, required: number): IssueQuantityRelation => {
  if (!Number.isFinite(entered) || entered <= 0) return 'invalid'
  const difference = roundQuantity(entered - required)
  if (difference < 0) return 'under'
  if (difference > 0) return 'over'
  return 'exact'
}

export const issueQuantityDifference = (entered: number, required: number): number =>
  roundQuantity(entered - required)
