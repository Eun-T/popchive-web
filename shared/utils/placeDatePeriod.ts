export type PlaceDatePeriod = {
  mode: 'all' | 'today' | 'sevenDays' | 'custom'
  startDate: string | null
  endDate: string | null
}

export function emptyDatePeriod(): PlaceDatePeriod {
  return { mode: 'all', startDate: null, endDate: null }
}

export function localDateValue(date: Date): string {
  return `${String(date.getFullYear()).padStart(4, '0')}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

export function isValidDateRange(start: string | null, end: string | null): boolean {
  const valid = (value: string | null) => {
    if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
    const [year, month, day] = value.split('-').map(Number) as [number, number, number]
    const date = new Date(0)
    date.setHours(12, 0, 0, 0)
    date.setFullYear(year, month - 1, day)
    return year >= 1 && localDateValue(date) === value
  }
  return valid(start) && valid(end) && start! <= end!
}

export function presetDatePeriod(mode: 'all' | 'today' | 'sevenDays', today = new Date()): PlaceDatePeriod {
  if (mode === 'all') return emptyDatePeriod()
  const end = new Date(today.getTime())
  end.setHours(12, 0, 0, 0)
  end.setDate(end.getDate() + (mode === 'sevenDays' ? 6 : 0))
  return { mode, startDate: localDateValue(today), endDate: localDateValue(end) }
}
