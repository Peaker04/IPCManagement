export const typography = {
  pageTitle: 'font-heading text-page-title',
  sectionTitle: 'font-heading text-section-title',
  body: 'font-sans text-body',
  label: 'font-sans text-label',
  caption: 'font-sans text-caption',
  code: 'font-mono text-code',
  numeric: 'font-sans text-body tabular-nums',
} as const

export type TypographyRole = keyof typeof typography
