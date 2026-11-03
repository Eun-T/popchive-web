<script setup lang="ts">
import { loadAppleIdentity, type AppleIdentity } from '~/utils/appleIdentity'
import { authError } from '~/composables/useAuth'
import { normalizeNickname, validNickname } from '../../../shared/utils/auth'
import type { AppleSignup } from '../../../shared/types/auth'
import policies from '~/content/authPolicies.json'

const props = defineProps<{ disabled?: boolean }>()
const emit = defineEmits<{ busy: [value: boolean] }>()
const auth = useAuth(), route = useRoute()
const configured = !!String(useRuntimeConfig().public.appleClientId).trim()
const ready = ref(false), preparing = ref(false), working = ref(false)
const popup = ref(false)
const error = ref(''), notice = ref(''), signup = shallowRef<AppleSignup | null>(null)
const nickname = ref(''), age = ref(false), terms = ref(false), privacy = ref(false)
const locked = computed(() => !!props.disabled || working.value || preparing.value)
let sdk: AppleIdentity | undefined
let attempt: { state: string; expiresAt: number } | undefined
let disposed = false, generation = 0, expiry = 0
let expiryTimer: ReturnType<typeof setTimeout> | undefined
let popupTimer: ReturnType<typeof setTimeout> | undefined
watch([working, signup], () => emit('busy', working.value || !!signup.value), { flush: 'sync' })
function clearSignup() { signup.value = null; expiry = 0; clearTimeout(expiryTimer); nickname.value = ''; age.value = false; terms.value = false; privacy.value = false }
async function invalidate(state?: string) {
  try { await $fetch('/api/web-auth/apple-cancel', { method: 'POST', body: { state }, retry: 0, timeout: 10000 }) } catch { /* TTL remains authoritative on network failure. */ }
}
async function setup() {
  if (disposed || !configured || preparing.value) return
  preparing.value = true; ready.value = false
  const version = ++generation
  try {
    sdk = await loadAppleIdentity()
    if (disposed || version !== generation) return
    const value = await $fetch<{ clientId: string; redirectURI: string; state: string; nonce: string; expiresInSeconds: number }>('/api/web-auth/apple-start', {
      method: 'POST', body: { returnTo: route.query.redirect === '/mypage' ? '/mypage' : '/' }, retry: 0, timeout: 20000,
    })
    if (disposed || version !== generation) { void invalidate(value.state); return }
    sdk.init({ clientId: value.clientId, redirectURI: value.redirectURI, scope: 'email', state: value.state, nonce: value.nonce, usePopup: true })
    attempt = { state: value.state, expiresAt: Date.now() + value.expiresInSeconds * 1000 }
    ready.value = true
  } catch (cause) {
    if (!disposed) error.value = (cause as { data?: unknown }).data ? authError(cause) : 'Apple 로그인 SDK를 불러오지 못했습니다. 네트워크·콘텐츠 차단 설정을 확인하고 다시 준비해 주세요.'
  } finally { preparing.value = false }
}
function beginSignup(value: AppleSignup) {
  if (disposed) return
  signup.value = value; expiry = Date.now() + value.expiresInSeconds * 1000
  expiryTimer = setTimeout(() => {
    if (working.value) return
    clearSignup(); error.value = '가입 시간이 만료되었습니다. 다시 Apple 로그인해 주세요.'
    void setup()
  }, value.expiresInSeconds * 1000)
}
function appleError(cause: unknown) {
  const code = (cause as { error?: unknown })?.error
  if (code === 'popup_closed_by_user' || code === 'user_cancelled_authorize') return 'Apple 로그인을 취소했습니다.'
  if (code === 'popup_blocked_by_browser' || code === 'popup_blocked') return '팝업이 차단되었습니다. 팝업을 허용하고 다시 시도해 주세요.'
  return 'Apple 인증을 완료하지 못했습니다. 팝업·네트워크 설정을 확인하고 다시 시도해 주세요.'
}
function onLoginClick() {
  if (locked.value) return
  if (!configured) {
    notice.value = 'Apple 로그인 설정을 준비 중입니다. 이메일 또는 Google 로그인을 이용해 주세요.'
    return
  }
  if (!ready.value) {
    notice.value = 'Apple 로그인이 아직 준비되지 않았습니다. 아래 안내를 확인하고 Apple 로그인 다시 준비를 눌러 주세요.'
    return
  }
  void login()
}
async function login() {
  if (locked.value || !ready.value || !sdk || !attempt || auth.user.value) return
  if (Date.now() >= attempt.expiresAt) { error.value = '인증 시간이 만료되었습니다. 다시 눌러 주세요.'; await setup(); return }
  const current = attempt, version = ++generation
  let timer: ReturnType<typeof setTimeout> | undefined
  working.value = true; ready.value = false; error.value = ''; notice.value = ''
  try {
    // Call synchronously inside the user click. No challenge/SDK await before opening.
    popup.value = true
    const response = sdk.signIn()
    const result = await Promise.race([response, new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error('Popup timeout')), 120000)
      popupTimer = timer
    })])
    clearTimeout(timer)
    if (disposed || version !== generation) return
    popup.value = false
    const authorization = result?.authorization
    if (Date.now() >= current.expiresAt || authorization?.state !== current.state) {
      error.value = 'Apple 로그인 요청이 일치하지 않거나 만료되었습니다. 다시 시도해 주세요.'; return
    }
    if (!authorization.id_token || !authorization.code) { error.value = 'Apple 인증 토큰 또는 인증 코드를 받지 못했습니다. 다시 시도해 주세요.'; return }
    const success = await auth.appleLogin({ identityToken: authorization.id_token, authorizationCode: authorization.code, state: authorization.state }, beginSignup,
      path => { if (!disposed) void navigateTo(path, { replace: true }) })
    if (!success && !disposed) error.value = auth.error.value
  } catch (cause) { if (!disposed && version === generation) notice.value = appleError(cause) }
  finally {
    clearTimeout(timer)
    if (!disposed && version === generation) {
      popup.value = false
      attempt = undefined; working.value = false
      if (!signup.value && !auth.user.value) { await invalidate(current.state); await setup() }
    }
  }
}
async function cancelPopup() {
  if (!popup.value) return
  const state = attempt?.state
  generation++; clearTimeout(popupTimer); popup.value = false; ready.value = false; attempt = undefined
  notice.value = 'Apple 로그인을 취소했습니다. 열린 Apple 창은 닫아 주세요.'
  try { await invalidate(state); await setup() } finally { working.value = false }
}
async function complete() {
  if (locked.value || !signup.value) return
  if (Date.now() >= expiry) { clearSignup(); error.value = '가입 시간이 만료되었습니다. 다시 Apple 로그인해 주세요.'; await setup(); return }
  const name = normalizeNickname(nickname.value)
  if (!validNickname(name)) { error.value = '닉네임은 문자·숫자·밑줄 2~10자로 입력해 주세요.'; return }
  if (!age.value || !terms.value || !privacy.value) { error.value = '만 14세 이상 확인과 필수 동의를 완료해 주세요.'; return }
  working.value = true; error.value = ''
  try {
    const success = await auth.completeApple({ nickname: name, ageConfirmed: age.value, termsOfService: terms.value, privacyPolicy: privacy.value }, status => {
      if (status !== 400 && status !== 409) clearSignup()
    }, path => { if (!disposed) void navigateTo(path, { replace: true }) })
    if (disposed) return
    if (success) clearSignup()
    else { error.value = auth.error.value; if (!signup.value) await setup() }
  } finally { working.value = false }
}
async function cancelSignup() {
  if (working.value) return
  working.value = true
  try { clearSignup(); await invalidate(); notice.value = 'Apple 가입을 취소했습니다.'; await setup() }
  finally { working.value = false }
}
onMounted(() => { if (!auth.user.value) void setup() })
onBeforeUnmount(() => {
  disposed = true; generation++; clearSignup(); clearTimeout(popupTimer)
  if (attempt) void invalidate(attempt.state)
  emit('busy', false)
})
</script>

<template>
  <div v-if="!auth.user.value" class="apple-login">
    <button v-if="!signup" type="button" class="apple-login__button" :disabled="locked" aria-label="Apple로 계속하기" @click="onLoginClick">
      <img src="https://appleid.cdn-apple.com/appleid/button?color=black&amp;border=false&amp;type=continue&amp;height=44&amp;width=280&amp;border_radius=6&amp;scale=2&amp;locale=ko_KR" alt="Apple로 계속하기" width="280" height="44" referrerpolicy="no-referrer" />
    </button>
    <p v-if="preparing || working" role="status">{{ preparing ? 'Apple 로그인을 준비하고 있습니다.' : 'Apple 인증을 진행하고 있습니다.' }}</p>
    <p v-if="notice" role="status">{{ notice }}</p>
    <p v-if="error" role="alert">{{ error }}</p>
    <button v-if="popup" type="button" @click="cancelPopup">Apple 로그인 취소</button>
    <button v-if="configured && !ready && !preparing && !working && !signup" type="button" :disabled="locked" @click="error = ''; setup()">Apple 로그인 다시 준비</button>
    <form v-if="signup" @submit.prevent="complete">
      <h2>Apple 계정으로 가입 완료</h2>
      <fieldset :disabled="locked">
        <label>닉네임<input v-model="nickname" autocomplete="nickname" required /><span>문자·숫자·밑줄 2~10자</span></label>
        <label class="apple-login__check"><input v-model="age" type="checkbox" required />[필수] 만 14세 이상입니다.</label>
        <details v-for="(policy, key) in policies" :key="key"><summary>{{ policy.title }} 전문 보기</summary><p>{{ policy.effectiveDate }}</p><section v-for="(section, i) in policy.sections" :key="i"><h3>{{ section.title }}</h3><p v-for="(block, j) in section.blocks" :key="j">{{ block.text }}</p></section></details>
        <label class="apple-login__check"><input v-model="terms" type="checkbox" required />[필수] 이용약관에 동의합니다.</label>
        <label class="apple-login__check"><input v-model="privacy" type="checkbox" required />[필수] 개인정보 처리방침에 동의합니다.</label>
        <BaseButton type="submit">가입 완료</BaseButton>
        <button type="button" @click="cancelSignup">취소</button>
      </fieldset>
    </form>
  </div>
</template>

<style scoped>
.apple-login { margin: 16px 0 24px; font-size: 14px; color: #525252; }
.apple-login button.apple-login__button[type=button] { display: flex; align-items: center; justify-content: center; width: 100%; min-height: 48px; padding: 2px 0; border: 0; border-radius: 10px; background: #000; color: #fff; cursor: pointer; }
.apple-login button.apple-login__button[type=button]:is(:hover, :active, :disabled) { background: #000; color: #fff; border-color: #000; }
.apple-login__button img { display: block; width: 280px; max-width: 100%; height: 44px; object-fit: contain; }
.apple-login__button:disabled { opacity: .6; cursor: default; }
.apple-login p { margin-block: 12px; line-height: 1.6; }
.apple-login fieldset { display: flex; flex-direction: column; gap: 16px; min-width: 0; margin: 20px 0; padding: 0; border: 0; }
.apple-login label { display: flex; flex-direction: column; gap: 8px; }
.apple-login input:not([type=checkbox]) { width: 100%; min-height: 48px; padding: 12px; border: 1px solid #e5e7eb; border-radius: 10px; }
.apple-login label span { font-size: 12px; color: #737373; }
.apple-login .apple-login__check { flex-direction: row; align-items: center; gap: 8px; min-height: 36px; font-size: 13px; }
.apple-login input[type=checkbox] { flex-shrink: 0; accent-color: #262626; }
.apple-login details { max-height: 200px; overflow: auto; padding: 12px; border: 1px solid #e5e7eb; border-radius: 10px; font-size: 12px; }
.apple-login summary { cursor: pointer; }
.apple-login button:focus-visible, .apple-login input:focus-visible { outline: 2px solid #6b7280; outline-offset: 2px; }
</style>
