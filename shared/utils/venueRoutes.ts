// Add only verified ID/slug pairs. Names and request-time translations never form URLs.
// Keep published pairs permanent. Duplicate IDs/slugs and alias chains fail closed to ID URLs.
const VENUE_SLUGS: readonly { venueId: string; slug: string }[] = [
  // 더현대 서울: venueId confirmed by the user; keep this pair when its name changes.
  { venueId: 'venue-36bf5330-7454-4ebc-9038-ff5448fb414f', slug: 'the-hyundai-seoul' },
  // 압구정 현대백화점: venueId confirmed by the user.
  { venueId: 'venue-495cfe1a-a735-4ec0-8c42-81ad6923a816', slug: 'hyundai-apgujeong' },
]

const mappings = VENUE_SLUGS.filter(entry =>
  publicVenueId(entry.venueId) && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(entry.slug) && entry.slug.length <= 64
  && entry.venueId !== entry.slug
  && VENUE_SLUGS.filter(other => other.venueId === entry.venueId).length === 1
  && VENUE_SLUGS.filter(other => other.slug.toLowerCase() === entry.slug).length === 1
  && !VENUE_SLUGS.some(other => other.venueId === entry.slug),
)

// The public API's venueId remains the unique, immutable venue_key.
export function publicVenueId(value: unknown): value is string {
  return typeof value === 'string' && /^[A-Za-z0-9_-]{1,64}$/.test(value)
}

export function venueIdFromSlug(slug: string): string | undefined {
  if (!publicVenueId(slug)) return undefined
  return mappings.find(entry => entry.slug === slug.toLowerCase())?.venueId ?? slug
}

export function venuePath(venueId: string): string {
  return `/venues/${encodeURIComponent(mappings.find(entry => entry.venueId === venueId)?.slug ?? venueId)}`
}
