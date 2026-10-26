// Korea and Japan both use UTC+9. Share this date through Nuxt state for hydration.
export function featuredPopupToday(now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(now)
}

export function featuredPopupDateLabel(period: string, today: string): string {
  // The existing home DTO preserves API LocalDates as YYYY.MM.DD in period.
  // Read those values without changing the API contract or parsing local times.
  const [startText, endText] = period.split(' ~ ')
  const readDate = (value: string | undefined) =>
    value && /^\d{4}\.\d{2}\.\d{2}$/.test(value) ? value.replaceAll('.', '-') : null
  const start = readDate(startText)
  const end = readDate(endText)
  const monthDay = (date: string) => `${Number(date.slice(5, 7))}월 ${Number(date.slice(8, 10))}일`

  if (end === today) return 'TODAY LAST DAY'
  if (start && start > today) return `${monthDay(start)} OPEN`
  if (start && end && start <= today && today <= end) return `${monthDay(end)}까지`
  return ''
}
