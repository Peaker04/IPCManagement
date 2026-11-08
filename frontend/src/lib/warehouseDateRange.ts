export const addIsoDays = (value: string, days: number) => {
  const date = new Date(`${value}T00:00:00Z`)
  if (Number.isNaN(date.valueOf())) return undefined
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}
