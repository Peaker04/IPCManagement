// Keep exports read-only; spreadsheet formula prefixes are text, not executable cells.
export function downloadPlanningCsv(filename: string, rows: (string | number)[][]) {
  const cell = (value: string | number) => {
    const text = String(value)
    const safe = typeof value === 'string' && /^[\s]*[=+\-@]/.test(text) ? `'${text}` : text
    return `"${safe.replace(/"/g, '""')}"`
  }
  const csv = `\uFEFF${rows.map(row => row.map(cell).join(',')).join('\r\n')}\r\n`
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }))
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  try { link.click() } finally { link.remove(); URL.revokeObjectURL(url) }
}
