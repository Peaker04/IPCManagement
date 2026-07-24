export type StatusTone = 'neutral' | 'info' | 'success' | 'warning' | 'danger'

export type StatusPresentation = {
  label: string
  tone: StatusTone
  description?: string
}

export const issueCountPresentation = ({
  count,
  singular,
  plural = singular,
  emptyLabel = 'Không có',
  severity = 'danger',
}: {
  count: number
  singular: string
  plural?: string
  emptyLabel?: string
  severity?: Extract<StatusTone, 'warning' | 'danger'>
}): StatusPresentation => ({
  label: count > 0 ? `${count} ${count === 1 ? singular : plural}` : emptyLabel,
  tone: count > 0 ? severity : 'neutral',
})

export const booleanStatusPresentation = ({
  condition,
  trueLabel,
  falseLabel,
  trueTone = 'success',
  falseTone = 'neutral',
}: {
  condition: boolean
  trueLabel: string
  falseLabel: string
  trueTone?: StatusTone
  falseTone?: StatusTone
}): StatusPresentation => ({
  label: condition ? trueLabel : falseLabel,
  tone: condition ? trueTone : falseTone,
})
