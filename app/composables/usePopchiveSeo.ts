import { canonicalUrl, isPublicSeoPath, seoImageUrl, SITE_NAME } from '#shared/utils/seo'

export function usePopchiveSeo(options: {
  title: MaybeRefOrGetter<string>
  description: MaybeRefOrGetter<string>
  image?: MaybeRefOrGetter<string | null | undefined>
  noindex?: MaybeRefOrGetter<boolean>
  nofollow?: MaybeRefOrGetter<boolean>
}) {
  const route = useRoute()
  const production = useState<boolean>('seo:production')
  const image = computed(() => seoImageUrl(toValue(options.image)))
  useSeoMeta({
    title: () => toValue(options.title),
    description: () => toValue(options.description),
    ogTitle: () => toValue(options.title),
    ogDescription: () => toValue(options.description),
    ogSiteName: SITE_NAME,
    ogType: 'website',
    ogLocale: 'ko_KR',
    ogUrl: () => canonicalUrl(route.path, route.query),
    ogImage: () => image.value,
    ogImageAlt: () => image.value ? toValue(options.title) : undefined,
    twitterCard: () => image.value ? 'summary_large_image' : 'summary',
    twitterTitle: () => toValue(options.title),
    twitterDescription: () => toValue(options.description),
    twitterImage: () => image.value,
    robots: () => {
      if (!production.value || !isPublicSeoPath(route.path)) return 'noindex, nofollow'
      const noindex = !!toValue(options.noindex)
      // Preserve legacy noindex callers; filters explicitly opt into follow.
      const nofollow = options.nofollow === undefined ? noindex : !!toValue(options.nofollow)
      if (noindex) return nofollow ? 'noindex, nofollow' : 'noindex, follow'
      return nofollow ? 'index, nofollow, max-image-preview:large' : 'index, follow, max-image-preview:large'
    },
  })
}
