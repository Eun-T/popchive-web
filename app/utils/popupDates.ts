type PopupDates = { startDate: string | null; endDate: string | null }

export function popupCalendarDate(now: number, countryCode: string | null): string {
  const parts = new Intl.DateTimeFormat('en', {
    timeZone: countryCode === 'JP' ? 'Asia/Tokyo' : 'Asia/Seoul',
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(now)
  const part = (type: string) => parts.find(item => item.type === type)!.value
  return `${part('year')}-${part('month')}-${part('day')}`
}

// Shared list/detail calendar-day rules. Only the same-day wording is configurable.
export function popupDayStatus(
  popup: PopupDates,
  today: string,
  labels = { open: '오늘 오픈', end: '오늘 종료' },
) {
  const { startDate: start, endDate: end } = popup
  const daysUntil = (date: string) => (Date.parse(`${date}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86_400_000
  if (end && end < today) return { label: '종료', state: 'ended' }
  if (start && start > today) return { label: `오픈 D-${daysUntil(start)}`, state: 'upcoming' }
  if (end === today) return { label: labels.end, state: 'last-day' }
  if (start === today) return { label: labels.open, state: 'ongoing' }
  if (start && start < today && end && end > today) return { label: `종료 D-${daysUntil(end)}`, state: 'ongoing' }
  return null
}

export function formatPopupDetailPeriod(start: string | null, end: string | null): string {
  const format = (date: string, withYear: boolean) => {
    const [year, month, day] = date.split('-')
    return `${withYear ? `${year!.slice(-2)}년 ` : ''}${Number(month)}월 ${Number(day)}일`
  }
  if (start && end) return `${format(start, true)} - ${format(end, start.slice(0, 4) !== end.slice(0, 4))}`
  if (start) return format(start, true)
  if (end) return format(end, true)
  return ''
}
