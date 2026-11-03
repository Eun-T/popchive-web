<script setup lang="ts">
import { loadGoogleIdentity } from '~/utils/googleIdentity'
import { authError } from '~/composables/useAuth'
import { normalizeNickname, validNickname } from '../../../shared/utils/auth'
import type { GoogleSignup } from '../../../shared/types/auth'
import policies from '~/content/authPolicies.json'

const props = defineProps<{ disabled?: boolean }>()
const emit = defineEmits<{ busy: [value: boolean] }>()
const auth = useAuth(), route = useRoute()
const clientId = String(useRuntimeConfig().public.googleClientId).trim()
const button = ref<HTMLDivElement | null>(null)
const ready = ref(false), loading = ref(false), exchanging = ref(false), popup = ref(false)
const error = ref(''), notice = ref('')
// Provider signup proof is component memory only; no URL, storage or SSR payload.
const signup = shallowRef<GoogleSignup | null>(null)
const nickname = ref(''), age = ref(false), terms = ref(false), privacy = ref(false)
let expiry = 0, generation = 0, disposed = false
let signupTimer: ReturnType<typeof setTimeout> | undefined
let popupTimer: ReturnType<typeof setTimeout> | undefined
let focusTimer: ReturnType<typeof setTimeout> | undefined
let waitCleanup: (() => void) | undefined
let resizeObserver: ResizeObserver | undefined
let renderGoogle: (() => void) | undefined
let buttonWidth = 0
const locked = computed(() => !!props.disabled || exchanging.value || loading.value)
watch([exchanging, popup, signup], () => emit('busy', exchanging.value || popup.value || !!signup.value))
function clearSignup() { signup.value = null; expiry = 0; clearTimeout(signupTimer); nickname.value = ''; age.value = false; terms.value = false; privacy.value = false }
async function destination() { await navigateTo(route.query.redirect === '/mypage' ? '/mypage' : '/', { replace: true }) }
async function idle() {
  if (!auth.pending.value) return
  await new Promise<void>(resolve => {
    const stop = watch(auth.pending, pending => { if (!pending) { stop(); waitCleanup = undefined; resolve() } })
    waitCleanup = () => { stop(); resolve() }
  })
}
function beginSignup(value: GoogleSignup) {
  signup.value = value; expiry = Date.now() + value.expiresInSeconds * 1000
  signupTimer = setTimeout(() => {
    clearSignup(); error.value = '가입 시간이 만료되었습니다. 다시 Google 로그인해 주세요.'
    void setup(false)
  }, value.expiresInSeconds * 1000)
}
async function credential(value: { credential?: string }, version: number) {
  if (disposed || version !== generation || exchanging.value || auth.user.value) return
  clearTimeout(popupTimer); clearTimeout(focusTimer); popup.value = false
  if (!value.credential) { error.value = 'Google 인증 정보를 받지 못했습니다. 다시 시도해 주세요.'; void setup(false); return }
  exchanging.value = true; error.value = ''; notice.value = ''
  try {
    await idle()
    if (disposed || version !== generation || auth.user.value) return
    const success = await auth.googleLogin(value.credential, beginSignup)
    if (disposed) return
    if (success && !signup.value) await destination()
    else if (!success) { error.value = auth.error.value; await setup(false) }
  } finally { exchanging.value = false }
}
function incomplete() {
  if (!popup.value || exchanging.value) return
  popup.value = false
  clearTimeout(popupTimer); clearTimeout(focusTimer)
  notice.value = '로그인이 취소되었거나 팝업이 차단되었을 수 있습니다. 팝업을 허용하고 다시 시도해 주세요.'
  void setup(false)
}
function focus() { if (popup.value && !exchanging.value) { clearTimeout(focusTimer); focusTimer = setTimeout(incomplete, 2000) } }
async function setup(clearError = true) {
  if (disposed || !clientId || loading.value) return
  const version = ++generation
  loading.value = true; ready.value = false
  if (clearError) { error.value = ''; notice.value = '' }
  try {
    const sdk = await loadGoogleIdentity()
    if (disposed || version !== generation) return
    const attempt = await $fetch<{ nonce: string }>('/api/web-auth/google-start', { method: 'POST', body: {}, retry: 0, timeout: 15000 })
    if (disposed || version !== generation || !button.value) return
    sdk.initialize({ client_id: clientId, nonce: attempt.nonce, ux_mode: 'popup', auto_select: false, callback: value => { void credential(value, version) } })
    buttonWidth = 0
    renderGoogle = () => {
      if (!button.value || disposed) return
      const width = Math.max(200, Math.min(400, Math.floor(button.value.getBoundingClientRect().width)))
      if (width === buttonWidth) return
      buttonWidth = width
      button.value.replaceChildren()
      sdk.renderButton(button.value, {
      type: 'standard', theme: 'outline', size: 'large', text: 'continue_with', locale: 'ko',
      width,
      click_listener: () => {
        if (locked.value || popup.value) return
        error.value = ''; notice.value = ''; popup.value = true
        popupTimer = setTimeout(incomplete, 120000)
      },
      })
    }
    renderGoogle()
    ready.value = true
  } catch (cause) {
    if (!disposed) error.value = (cause as { data?: unknown }).data ? authError(cause) : 'Google 로그인 SDK를 불러오지 못했습니다. 네트워크·콘텐츠 차단 설정을 확인하고 다시 시도해 주세요.'
  } finally { loading.value = false }
}
async function complete() {
  if (locked.value || !signup.value) return
  if (Date.now() >= expiry) { clearSignup(); error.value = '가입 시간이 만료되었습니다. 다시 Google 로그인해 주세요.'; await setup(false); return }
  const name = normalizeNickname(nickname.value)
  if (!validNickname(name)) { error.value = '닉네임은 문자·숫자·밑줄 2~10자로 입력해 주세요.'; return }
  if (!age.value || !terms.value || !privacy.value) { error.value = '만 14세 이상 확인과 필수 동의를 완료해 주세요.'; return }
  exchanging.value = true; error.value = ''
  try {
    const success = await auth.completeGoogle({ signupToken: signup.value.signupToken, nickname: name, ageConfirmed: age.value, termsOfService: terms.value, privacyPolicy: privacy.value }, status => {
      if (status === 401 || status === 403) clearSignup()
    })
    if (disposed) return
    if (success) { clearSignup(); await destination() }
    else { error.value = auth.error.value; if (!signup.value) await setup(false) }
  } finally { exchanging.value = false }
}
function cancel() {
  if (exchanging.value || loading.value) return
  clearSignup(); popup.value = false; clearTimeout(popupTimer); clearTimeout(focusTimer)
  notice.value = 'Google 로그인을 취소했습니다.'
  void setup(false)
}
onMounted(() => {
  if (clientId && !auth.user.value) void setup()
  if (button.value) {
    resizeObserver = new ResizeObserver(() => { if (ready.value && !popup.value && !exchanging.value && !signup.value) renderGoogle?.() })
    resizeObserver.observe(button.value)
  }
  window.addEventListener('focus', focus)
})
onBeforeUnmount(() => {
  disposed = true; generation++; clearSignup(); waitCleanup?.()
  clearTimeout(popupTimer); clearTimeout(focusTimer)
  window.removeEventListener('focus', focus)
  resizeObserver?.disconnect()
  emit('busy', false)
})
</script>

<template>
  <div v-if="!auth.user.value" class="google-login">
    <p class="google-login__divider">또는</p>
    <p v-if="!clientId" role="status">Google 로그인 설정을 준비 중입니다. 이메일 로그인을 이용해 주세요.</p>
    <div v-show="!signup" class="google-login__button" :class="{ 'is-disabled': locked || popup }" :inert="locked || popup" :aria-disabled="locked || popup">
      <div ref="button" />
    </div>
    <p v-if="loading || exchanging" role="status">{{ exchanging ? 'Google 인증을 확인하고 있습니다.' : 'Google 로그인을 준비하고 있습니다.' }}</p>
    <p v-if="notice" role="status">{{ notice }}</p>
    <p v-if="error" role="alert">{{ error }}</p>
    <button v-if="clientId && !ready && !loading" type="button" :disabled="locked" @click="setup()">Google 로그인 다시 준비</button>
    <button v-if="popup" type="button" :disabled="exchanging" @click="cancel">Google 로그인 취소</button>
    <form v-if="signup" @submit.prevent="complete">
      <h2>Google 계정으로 가입 완료</h2>
      <fieldset :disabled="locked">
        <label>닉네임<input v-model="nickname" autocomplete="nickname" required /><span>문자·숫자·밑줄 2~10자</span></label>
        <label class="google-login__check"><input v-model="age" type="checkbox" required />[필수] 만 14세 이상입니다.</label>
        <details v-for="(policy, key) in policies" :key="key"><summary>{{ policy.title }} 전문 보기</summary><p>{{ policy.effectiveDate }}</p><section v-for="(section, i) in policy.sections" :key="i"><h3>{{ section.title }}</h3><p v-for="(block, j) in section.blocks" :key="j">{{ block.text }}</p></section></details>
        <label class="google-login__check"><input v-model="terms" type="checkbox" required />[필수] 이용약관에 동의합니다.</label>
        <label class="google-login__check"><input v-model="privacy" type="checkbox" required />[필수] 개인정보 처리방침에 동의합니다.</label>
        <BaseButton type="submit">가입 완료</BaseButton>
        <button type="button" @click="cancel">취소</button>
      </fieldset>
    </form>
  </div>
</template>

<style scoped>
.google-login { margin: 24px 0; font-size: 14px; color: #525252; }
.google-login__divider { display: flex; align-items: center; gap: 12px; margin-bottom: 20px; color: #737373; font-size: 13px; }
.google-login__divider::before, .google-login__divider::after { content: ''; flex: 1; height: 1px; background: #e5e7eb; }
.google-login__button { width: 100%; min-height: 44px; }
.google-login__button.is-disabled { pointer-events: none; opacity: .6; }
.google-login p { margin-block: 12px; line-height: 1.6; }
.google-login fieldset { display: flex; flex-direction: column; gap: 16px; min-width: 0; margin: 20px 0; padding: 0; border: 0; }
.google-login label { display: flex; flex-direction: column; gap: 8px; }
.google-login input:not([type=checkbox]) { width: 100%; min-height: 48px; padding: 12px; border: 1px solid #e5e7eb; border-radius: 10px; }
.google-login label span { font-size: 12px; color: #737373; }
.google-login .google-login__check { flex-direction: row; align-items: center; gap: 8px; min-height: 36px; font-size: 13px; }
.google-login input[type=checkbox] { flex-shrink: 0; accent-color: #262626; }
.google-login details { max-height: 200px; overflow: auto; padding: 12px; border: 1px solid #e5e7eb; border-radius: 10px; font-size: 12px; }
.google-login summary { cursor: pointer; }
.google-login button:focus-visible, .google-login input:focus-visible { outline: 2px solid #6b7280; outline-offset: 2px; }
</style>
