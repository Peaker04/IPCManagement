const BANGKOK_TIME_ZONE = 'Asia/Bangkok'

const DAY_CODE_BY_UTC_DAY = ['cn', 't2', 't3', 't4', 't5', 't6', 't7'] as const
const WEEK_INDEX_BY_DAY_CODE: Record<string, number> = {
  t2: 0,
  t3: 1,
  t4: 2,
  t5: 3,
  t6: 4,
  t7: 5,
  cn: 6,
}

const getBangkokCalendarDate = (now: Date) => {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: BANGKOK_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now)
  const valueOf = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((part) => part.type === type)?.value)
  return new Date(Date.UTC(valueOf('year'), valueOf('month') - 1, valueOf('day')))
}

const formatCalendarDate = (date: Date) => [
  date.getUTCFullYear(),
  String(date.getUTCMonth() + 1).padStart(2, '0'),
  String(date.getUTCDate()).padStart(2, '0'),
].join('-')

export function getBangkokDayCode(now = new Date()): string {
  return DAY_CODE_BY_UTC_DAY[getBangkokCalendarDate(now).getUTCDay()]
}

export function resolveChefServiceDate(activeDay: string, now = new Date()): string {
  const targetWeekIndex = WEEK_INDEX_BY_DAY_CODE[activeDay]
  if (targetWeekIndex === undefined) throw new Error(`Unsupported chef weekday: ${activeDay}`)

  const bangkokDate = getBangkokCalendarDate(now)
  const currentWeekIndex = (bangkokDate.getUTCDay() + 6) % 7
  bangkokDate.setUTCDate(bangkokDate.getUTCDate() + targetWeekIndex - currentWeekIndex)
  return formatCalendarDate(bangkokDate)
}
