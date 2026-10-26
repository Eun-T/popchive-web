import { canonicalUrl, isPublicSeoPath, seoImageUrl, SITE_NAME } from '#shared/utils/seo'

export function usePopchiveSeo(options: {
  title: MaybeRefOrGetter<string>
  description: MaybeRefOrGetter<string>
  image?: MaybeRefOrGetter<string | null | undefined>
  noindex?: MaybeRefOrGetter<boolean>
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
    ogUrl: () => canonicalUrl(route.path),
    ogImage: () => image.value,
    ogImageAlt: () => image.value ? toValue(options.title) : undefined,
    twitterCard: () => image.value ? 'summary_large_image' : 'summary',
    twitterTitle: () => toValue(options.title),
    twitterDescription: () => toValue(options.description),
    twitterImage: () => image.value,
    robots: () => !production.value || !isPublicSeoPath(route.path) || toValue(options.noindex)
      ? 'noindex, nofollow' : 'index, follow, max-image-preview:large',
  })
}
