export type PlacesSeoQuery = Readonly<Record<string, unknown>>

const filterKeys = [
  'regionIds', 'tagIds', 'tagId', 'status',
  'operatingFrom', 'operatingTo', 'openingFrom', 'openingTo',
] as const

function alternativeSort(query: PlacesSeoQuery): boolean {
  return query.sort === 'START_DATE_ASC' || query.sort === 'END_DATE_ASC'
}

function exploreView(query: PlacesSeoQuery): boolean {
  // With an explicit page, places.vue selects All even when tab=explore is present.
  return query.tab === 'explore' && query.page === undefined
}

export function hasPlacesSeoFilters(query: PlacesSeoQuery): boolean {
  return filterKeys.some(key => query[key] !== undefined) || alternativeSort(query) || exploreView(query)
}

export function placesFilterCanonicalQuery(query: PlacesSeoQuery): URLSearchParams {
  const values: Record<string, unknown> = {}
  for (const key of filterKeys) if (query[key] !== undefined) values[key] = query[key]
  if (alternativeSort(query)) values.sort = query.sort
  // tab=all is otherwise the default, but activates the legacy tagId shortcut.
  if (exploreView(query) || (query.tagId !== undefined && query.tab === 'all')) values.tab = query.tab
  const params = new URLSearchParams()
  for (const key of Object.keys(values).sort()) {
    const value = values[key]
    if (typeof value === 'string') params.append(key, value)
    else if (Array.isArray(value)) {
      for (const item of value) if (typeof item === 'string') params.append(key, item)
    }
  }
  return params
}
