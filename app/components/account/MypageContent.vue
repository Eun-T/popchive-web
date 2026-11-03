<script setup lang="ts">
import { ChevronRight, Heart, MessageSquare, UserRound, Settings } from '@lucide/vue'
import HomeNewPopups from '~/components/home/HomeNewPopups.vue'
import { authError } from '~/composables/useAuth'
import type { AuthUser } from '../../../shared/types/auth'
import type { HomePopupCard } from '../../../shared/types/home'
import { normalizeNickname, validNickname, validPassword } from '../../../shared/utils/auth'

interface Favorite { publicId: string; name: string; coverImageUrl: string | null; startDate: string | null; endDate: string | null; regionName: string | null }
interface Review { id: number; content: string; rating: number; popup: { publicId: string; title: string }; images: string[]; createdAt: string }
interface ReviewEdit { id: number; content: string; rating: number; images: { id: number; url: string }[] }
const auth = useAuth()
const menus = [ { key: 'favorites', title: '찜한 팝업', icon: Heart }, { key: 'reviews', title: '내가 쓴 리뷰', icon: MessageSquare }, { key: 'profile', title: '내 정보 수정', icon: UserRound }, { key: 'account', title: '계정 관리', icon: Settings } ] as const
type Panel = typeof menus[number]['key']
const panel = ref<Panel | null>(null), busy = ref(false), error = ref(''), success = ref('')
const favorites = ref<Favorite[]>([]), reviews = ref<Review[]>([]), cursor = ref<string | null>(null)
const favoritesLoaded = ref(false), reviewsLoaded = ref(false)
const favoritesVisited = ref(false), reviewsVisited = ref(false)
let reviewPages = 1
const edit = ref<ReviewEdit | null>(null), nickname = ref(''), currentPassword = ref(''), newPassword = ref(''), confirmPassword = ref('')
const withdrawalConfirmed = ref(false)
let disposed = false
const controller = new AbortController()
onBeforeUnmount(() => { disposed = true; controller.abort() })
const locked = computed(() => busy.value || auth.pending.value)
const cards = computed<HomePopupCard[]>(() => favorites.value.map(p => ({ id: p.publicId, publicId: p.publicId, title: p.name, src: p.coverImageUrl, alt: p.name, period: [p.startDate, p.endDate].filter(Boolean).join(' ~ '), region: p.regionName ?? '' })))
async function request<T>(action: string, body: Record<string, unknown> = {}): Promise<T> {
  const owner = auth.user.value?.id
  const send = () => $fetch<T>(`/api/web-auth/${action}`, { method: 'POST', body: { ...body, ownerId: owner }, retry: 0, timeout: 60000, signal: controller.signal })
  const value = navigator.locks ? await navigator.locks.request('plave-auth', send) : await send()
  if (disposed || auth.user.value?.id !== owner) throw new Error('Session changed')
  return value as T
}
async function perform(task: () => Promise<void>) {
  if (locked.value) return
  busy.value = true; auth.pending.value = true; error.value = ''; success.value = ''
  try { await task() }
  catch (cause) {
    if (!disposed) error.value = authError(cause)
    if ((cause as { statusCode?: number }).statusCode === 401) auth.user.value = null
  } finally { busy.value = false; auth.pending.value = false }
}
async function loadReviews(append = false) {
  // An explicit refresh reloads the already-viewed pages without collapsing to page one.
  let next = append ? cursor.value : null
  let incoming: Review[] = []
  let fetched = 0
  do {
    const page = await request<{ items: Review[]; nextCursor: string | null }>('my-reviews', { cursor: next })
    if (!Array.isArray(page.items)) throw new Error('Invalid response')
    incoming.push(...page.items)
    next = page.nextCursor
    fetched++
  } while (!append && next && fetched < reviewPages)
  const combined = append ? [...reviews.value, ...incoming] : incoming
  reviews.value = combined.filter((item, index) => combined.findIndex(other => other.id === item.id) === index)
  cursor.value = next
  reviewPages = append ? reviewPages + 1 : fetched
  reviewsLoaded.value = true
}
function togglePanel(value: Panel) {
  if (locked.value) return
  if (panel.value === value) panel.value = null
  else choose(value)
}
function choose(value: Panel, refresh = false) {
  if (locked.value) return
  panel.value = value; edit.value = null
  error.value = ''; success.value = ''
  currentPassword.value = ''; newPassword.value = ''; confirmPassword.value = ''
  if (value === 'profile') nickname.value = auth.user.value?.nickname ?? ''
  if (value === 'favorites') favoritesVisited.value = true
  if (value === 'reviews') reviewsVisited.value = true
  if (value === 'favorites' && (!favoritesLoaded.value || refresh)) {
    void perform(async () => {
      const response = await request<{ popups: Favorite[] }>('my-favorites')
      if (!Array.isArray(response.popups)) throw new Error('Invalid response')
      favorites.value = response.popups
      favoritesLoaded.value = true
    })
  }
  if (value === 'reviews' && (!reviewsLoaded.value || refresh)) void perform(() => loadReviews())
}
function removeFavorite(publicId: string) {
  void perform(async () => {
    const response = await request<{ isFavorited: boolean }>('unfavorite', { publicId })
    if (response.isFavorited !== false) throw new Error('Invalid response')
    favorites.value = favorites.value.filter(p => p.publicId !== publicId)
  })
}
function startEdit(id: number) { void perform(async () => { edit.value = await request<ReviewEdit>('review-edit', { id }) }) }
function saveReview() {
  const draft = edit.value
  if (!draft) return
  if (new TextEncoder().encode(draft.content).length > 65535) { error.value = '리뷰는 UTF-8 기준 65,535바이트 이내로 입력해 주세요.'; return }
  void perform(async () => {
    const updated = await request<ReviewEdit>('review-update', { id: draft.id, rating: Number(draft.rating), content: draft.content, retainedImageIds: draft.images.map(image => image.id) })
    reviews.value = reviews.value.map(review => review.id === updated.id ? { ...review, rating: updated.rating, content: updated.content, images: updated.images.map(image => image.url) } : review)
    edit.value = null; success.value = '리뷰를 수정했습니다.'
  })
}
function deleteReview(id: number) {
  if (locked.value || !window.confirm('리뷰를 삭제하시겠어요? 삭제한 리뷰는 복구할 수 없습니다.')) return
  void perform(async () => { await request('review-delete', { id }); reviews.value = reviews.value.filter(r => r.id !== id); success.value = '리뷰를 삭제했습니다.' })
}
function saveNickname() {
  const name = normalizeNickname(nickname.value)
  if (!validNickname(name)) { error.value = '닉네임은 문자·숫자·밑줄 2~10자로 입력해 주세요.'; return }
  void perform(async () => {
    const response = await request<{ user: AuthUser }>('my-nickname', { nickname: name })
    if (response.user.id !== auth.user.value?.id) throw new Error('Invalid response')
    auth.user.value = response.user; success.value = '닉네임을 변경했습니다.'
  })
}
function changePassword() {
  if (!validPassword(newPassword.value) || newPassword.value !== confirmPassword.value || newPassword.value === currentPassword.value) {
    error.value = '영문·숫자를 포함한 공백 없는 8~72자의 새 비밀번호와 확인값을 입력해 주세요. 현재 비밀번호와 달라야 합니다.'; return
  }
  void perform(async () => {
    await request('my-password', { currentPassword: currentPassword.value, newPassword: newPassword.value, confirmPassword: confirmPassword.value })
    currentPassword.value = ''; newPassword.value = ''; confirmPassword.value = ''
    auth.user.value = null
    await navigateTo('/login', { replace: true })
  })
}
function withdraw() {
  if (locked.value || !withdrawalConfirmed.value || !window.confirm('정말 탈퇴하시겠어요? 탈퇴하면 삭제되는 정보는 복구할 수 없습니다.')) return
  void perform(async () => { await request('withdraw', { confirmed: true }); auth.user.value = null; await navigateTo('/', { replace: true }) })
}
</script>

<template>
  <div class="account-content">
    <nav aria-label="마이페이지 메뉴" class="account-content__menus">
      <button v-for="menu in menus" :key="menu.key" type="button" :disabled="locked" :aria-expanded="panel === menu.key" :aria-current="panel === menu.key ? 'true' : undefined" @click="togglePanel(menu.key)">
        <component :is="menu.icon" :size="20" aria-hidden="true" /><span>{{ menu.title }}</span><ChevronRight :size="20" aria-hidden="true" class="account-content__chevron" :class="{ 'account-content__chevron--open': panel === menu.key }" />
      </button>
    </nav>
    <section v-if="panel || favoritesVisited || reviewsVisited" v-show="panel !== null" class="account-content__panel" :aria-busy="busy">
      <h2 class="type-title-m">{{ menus.find(menu => menu.key === panel)?.title }}</h2>
      <button v-if="panel === 'favorites' || panel === 'reviews'" type="button" class="account-content__refresh" :disabled="locked" @click="choose(panel, true)">목록 새로고침</button>
      <p v-if="busy && (panel === 'favorites' ? !favoritesLoaded : panel === 'reviews' ? !reviewsLoaded : true)" role="status">처리 중입니다.</p>
      <p v-if="error" role="alert">{{ error }} <button v-if="panel === 'favorites' || panel === 'reviews'" type="button" :disabled="locked" @click="choose(panel, true)">다시 불러오기</button></p>
      <p v-if="success" role="status">{{ success }}</p>
      <div v-if="favoritesVisited" v-show="panel === 'favorites'">
        <p v-if="favoritesLoaded && !favorites.length">찜한 팝업이 없습니다.</p>
        <HomeNewPopups v-if="favorites.length" :items="cards" :show-favorite="false" heading="찜한 팝업 목록" class="account-content__favorites">
          <template #card-action="{ item }"><button type="button" class="account-content__secondary" :disabled="locked" :aria-label="`${item.title} 찜 취소`" @click="removeFavorite(item.publicId)">찜 취소</button></template>
        </HomeNewPopups>
      </div>
      <div v-if="reviewsVisited" v-show="panel === 'reviews'">
        <form v-if="edit" @submit.prevent="saveReview">
          <fieldset :disabled="locked">
            <label>별점<select v-model.number="edit.rating"><option v-for="n in 5" :key="n" :value="n">{{ n }}점</option></select></label>
            <label>리뷰 내용<textarea v-model="edit.content" rows="6" /></label>
            <div v-for="image in edit.images" :key="image.id" class="account-content__image"><img :src="image.url" alt="리뷰 첨부 사진" loading="lazy" /><button type="button" @click="edit.images = edit.images.filter(i => i.id !== image.id)">사진 삭제</button></div>
            <button type="submit" class="account-content__primary">수정 저장</button><button type="button" class="account-content__secondary" @click="edit = null">취소</button>
          </fieldset>
        </form>
        <template v-else>
          <p v-if="reviewsLoaded && !reviews.length">작성한 리뷰가 없습니다.</p>
          <article v-for="review in reviews" :key="review.id" class="account-content__review">
            <NuxtLink :to="`/places/${encodeURIComponent(review.popup.publicId)}`">{{ review.popup.title }}</NuxtLink>
            <p class="account-content__muted">{{ review.rating }}점 · {{ review.createdAt.slice(0, 10) }}</p>
            <p class="account-content__text">{{ review.content }}</p>
            <div class="account-content__images"><img v-for="(src, i) in review.images" :key="i" :src="src" alt="리뷰 첨부 사진" loading="lazy" /></div>
            <button type="button" class="account-content__secondary" :disabled="locked" @click="startEdit(review.id)">수정</button>
            <button type="button" class="account-content__secondary" :disabled="locked" @click="deleteReview(review.id)">삭제</button>
          </article>
          <button v-if="cursor" type="button" class="account-content__secondary" :disabled="locked" @click="perform(() => loadReviews(true))">더 보기</button>
        </template>
      </div>
      <form v-if="panel === 'profile'" @submit.prevent="saveNickname">
        <fieldset :disabled="locked"><label>이메일<input :value="auth.user.value?.email" readonly /></label><label>닉네임<input v-model="nickname" autocomplete="nickname" required /></label><p class="account-content__muted">문자·숫자·밑줄 2~10자</p><button type="submit" class="account-content__primary">닉네임 저장</button></fieldset>
      </form>
      <template v-if="panel === 'account'">
        <form v-if="auth.user.value?.provider === 'LOCAL'" @submit.prevent="changePassword">
          <h3>비밀번호 변경</h3>
          <fieldset :disabled="locked">
            <label>현재 비밀번호<input v-model="currentPassword" type="password" autocomplete="current-password" maxlength="72" required /></label>
            <label>새 비밀번호<input v-model="newPassword" type="password" autocomplete="new-password" maxlength="72" required /></label>
            <label>새 비밀번호 확인<input v-model="confirmPassword" type="password" autocomplete="new-password" maxlength="72" required /></label>
            <p class="account-content__muted">영문·숫자를 포함한 8~72자, 공백 불가. 변경 후 다시 로그인해야 합니다.</p>
            <button type="submit" class="account-content__primary">비밀번호 변경</button>
          </fieldset>
        </form>
        <p v-else class="account-content__muted">소셜 로그인 계정은 비밀번호를 변경할 수 없습니다.</p>
        <section class="account-content__withdraw"><h3>회원탈퇴</h3><ul><li>질문/자유 게시글과 해당 글에 달린 댓글은 삭제됩니다.</li><li>관심 팝업과 좋아요 등 개인 활동 정보가 삭제됩니다.</li><li>방문 리뷰와 일부 댓글은 삭제되지 않고 '탈퇴한 사용자'로 표시되어 유지됩니다.</li><li>삭제된 정보는 복구할 수 없습니다.</li></ul><label class="account-content__check"><input v-model="withdrawalConfirmed" type="checkbox" :disabled="locked" />탈퇴 안내를 확인했습니다.</label><button type="button" class="account-content__secondary" :disabled="locked || !withdrawalConfirmed" @click="withdraw">회원탈퇴</button></section>
      </template>
    </section>
  </div>
</template>

<style scoped>
.account-content { min-width: 0; }
.account-content__menus { margin-top: 28px; border-top: 1px solid #e5e7eb; }
.account-content__menus > button { display: flex; align-items: center; gap: 14px; width: 100%; min-height: 72px; padding: 18px 16px; border-bottom: 1px solid #e5e7eb; background: #fff; color: #262626; text-align: left; }
.account-content__menus span { flex: 1; }
.account-content__menus svg { flex-shrink: 0; }
.account-content__chevron { transform: rotate(0deg); transform-origin: center; transition: transform 180ms ease-in-out; }
.account-content__chevron--open { transform: rotate(90deg); }
.account-content__menus button:hover:enabled, .account-content__menus button[aria-current] { background: #fafafa; }
.account-content__panel { margin-top: 32px; }
.account-content__panel > h2 { margin-bottom: 20px; }
.account-content__refresh { min-height: 40px; color: #737373; font-size: 13px; text-decoration: underline; text-underline-offset: 3px; }
.account-content__panel p { margin-block: 12px; }
.account-content__favorites { margin-top: 20px; }
.account-content fieldset { display: flex; flex-direction: column; gap: 16px; border: 0; padding: 0; min-width: 0; max-width: 540px; margin: 16px 0; }
.account-content label { display: flex; flex-direction: column; gap: 8px; font-size: 14px; }
.account-content input:not([type=checkbox]), .account-content textarea, .account-content select { width: 100%; min-height: 44px; padding: 10px 12px; border: 1px solid #d4d4d4; border-radius: 8px; background: #fff; }
.account-content textarea { resize: vertical; }
.account-content__primary, .account-content__secondary { min-height: 44px; padding: 10px 16px; border: 1px solid #d4d4d4; border-radius: 8px; background: #fff; color: #262626; }
.account-content__primary { background: #262626; color: #fff; border-color: #262626; }
.account-content button { cursor: pointer; }
.account-content button:disabled, .account-content fieldset:disabled button { opacity: .5; cursor: not-allowed; }
.account-content button:focus-visible, .account-content input:focus-visible, .account-content textarea:focus-visible, .account-content select:focus-visible { outline: 2px solid #6b7280; outline-offset: 2px; }
.account-content__review { padding: 20px 0; border-bottom: 1px solid #e5e7eb; overflow-wrap: anywhere; }
.account-content__review > a { font-weight: 600; text-decoration: underline; text-underline-offset: 3px; }
.account-content__text { white-space: pre-wrap; }
.account-content__images { display: flex; flex-wrap: wrap; gap: 8px; margin-block: 12px; }
.account-content img { width: 88px; height: 88px; object-fit: cover; border-radius: 8px; }
.account-content__image { display: flex; align-items: center; gap: 12px; }
.account-content__muted { color: #737373; font-size: 13px; line-height: 1.6; }
.account-content__withdraw { margin-top: 32px; padding-top: 24px; border-top: 1px solid #e5e7eb; }
.account-content__withdraw ul { margin: 16px 0; padding-left: 20px; list-style: disc; color: #737373; font-size: 14px; line-height: 1.8; }
.account-content .account-content__check { flex-direction: row; align-items: center; min-height: 44px; }
.account-content__check input { flex-shrink: 0; accent-color: #262626; }
</style>
