import { normalizeSearchQuery, validQuickSearch } from '#shared/utils/quickSearch'

const STORAGE_KEY = 'popchive:recent-searches:v1'
export function useRecentSearches() {
  const recent = useState<string[]>('recent-searches', () => [])
  function clean(values: unknown): string[] {
    if (!Array.isArray(values)) return []
    const seen = new Set<string>()
    return values.filter((v): v is string => typeof v === 'string').map(normalizeSearchQuery)
      .filter(v => validQuickSearch(v) && !seen.has(v.toLowerCase()) && !!seen.add(v.toLowerCase())).slice(0, 10)
  }
  onMounted(() => {
    try { recent.value = clean(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]')) } catch { /* Search works without storage. */ }
  })
  function save(values: string[]) {
    recent.value = clean(values)
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(recent.value)) } catch { /* Keep session state. */ }
  }
  return {
    recent,
    add: (value: string) => { if (import.meta.client) save([value, ...recent.value]) },
    remove: (value: string) => save(recent.value.filter(v => v !== value)),
    clear: () => save([]),
  }
}
