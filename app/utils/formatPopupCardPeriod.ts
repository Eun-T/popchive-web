// Format date-only strings without time zone conversion; preserve unknown-date labels.
export function formatPopupCardPeriod(period: string): string {
  return period.replace(/\b\d{4}([.-])(\d{2})\1(\d{2})\b/g, (_date, _separator, month, day) =>
    `${Number(month)}월 ${Number(day)}일`,
  ).replaceAll(' ~ ', ' - ')
}
