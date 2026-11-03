<script setup lang="ts">
import { verifyAuth } from '~/utils/verifyAuth'
import MypageContent from '~/components/account/MypageContent.vue'

definePageMeta({ middleware: 'auth', hideSidebar: false })
useSeoMeta({ title: '마이페이지 | 더플레이브', robots: 'noindex, nofollow' })
const auth = useAuth()
const visible = ref(true)
const restoreError = ref('')
const root = ref<HTMLElement | null>(null)
watch([auth.user, auth.pending], ([user, pending]) => {
  if (!user && !pending && visible.value) void navigateTo('/', { replace: true })
}, { flush: 'sync' })
async function logout() {
  if (auth.pending.value) return
  await auth.logout()
  if (!auth.user.value) await navigateTo('/', { replace: true })
}
function conceal() {
  visible.value = false
  // Conceal synchronously before the browser captures its history snapshot.
  if (root.value) root.value.style.visibility = 'hidden'
}
async function recheck() {
  restoreError.value = ''
  try {
    if (!await verifyAuth(auth)) { await navigateTo('/', { replace: true }); return }
    visible.value = true
  } catch { restoreError.value = '로그인 상태를 확인하지 못했습니다. 다시 확인해 주세요.' }
  finally { if (root.value) root.value.style.visibility = '' }
}
function pageshow(event: PageTransitionEvent) { if (event.persisted) void recheck() }
onMounted(() => {
  window.addEventListener('pagehide', conceal)
  window.addEventListener('pageshow', pageshow)
})
onBeforeUnmount(() => {
  window.removeEventListener('pagehide', conceal)
  window.removeEventListener('pageshow', pageshow)
})
</script>

<template>
  <section ref="root" class="mypage">
    <template v-if="visible && auth.user.value">
      <h1 class="type-title-l">마이페이지</h1>
      <p class="mypage__description">{{ auth.user.value.nickname }}님 · {{ auth.user.value.email }}</p>
      <MypageContent :key="auth.user.value.id" />
    </template>
    <p v-else-if="restoreError" role="alert">{{ restoreError }} <button type="button" class="ds-control" :disabled="auth.pending.value" @click="recheck">다시 확인</button></p>
    <p v-else role="status">로그인 상태를 확인하고 있습니다.</p>
  </section>
</template>

<style scoped>
.mypage { width: 100%; min-width: 0; margin: 8px 0 24px; background: #fff; color: #171717; }
.mypage__description { margin-top: 8px; color: #737373; font-size: 14px; overflow-wrap: anywhere; }
@media (width < 640px) { .mypage { margin-top: 0; } }
</style>
