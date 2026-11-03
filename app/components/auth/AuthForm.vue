<script setup lang="ts">
import { normalizeEmail, normalizeNickname, validEmail, validPassword, validNickname } from '../../../shared/utils/auth'
import { authError } from '~/composables/useAuth'
import policies from '~/content/authPolicies.json'
import GoogleLogin from './GoogleLogin.vue'
import AppleLogin from './AppleLogin.vue'

const props = defineProps<{ signup?: boolean }>()
// Temporarily hide Apple UI; set true to restore it on the login screen.
const showAppleLogin = false
const auth = useAuth()
const route = useRoute()
const email = ref(''), password = ref(''), confirmation = ref(''), nickname = ref(''), code = ref('')
const proof = ref(''), sent = ref(false), busy = ref(false), message = ref(''), error = ref('')
const age = ref(false), terms = ref(false), privacy = ref(false)
const googleBusy = ref(false)
const appleBusy = ref(false)
const locked = computed(() => busy.value || auth.pending.value || googleBusy.value || appleBusy.value)
watch(email, () => { proof.value = ''; code.value = ''; sent.value = false; message.value = '' })
async function verification(action: 'send-code' | 'verify-code') {
  if (locked.value) return
  error.value = ''; message.value = ''
  const submittedEmail = normalizeEmail(email.value)
  if (!validEmail(submittedEmail)) { error.value = '이메일 형식을 확인해 주세요.'; return }
  if (action === 'verify-code' && !/^\d{6}$/.test(code.value)) { error.value = '인증번호 6자리를 입력해 주세요.'; return }
  busy.value = true
  try {
    const response = await $fetch<{ signupProof?: string }>(`/api/web-auth/${action}`, {
      method: 'POST', body: { email: submittedEmail, code: code.value }, retry: 0, timeout: 15000,
    })
    if (normalizeEmail(email.value) !== submittedEmail) return
    if (action === 'send-code') { sent.value = true; proof.value = ''; message.value = '인증번호를 보냈습니다. 이메일을 확인해 주세요.' }
    else {
      if (!response.signupProof) throw new Error('Invalid proof')
      proof.value = response.signupProof; message.value = '이메일 인증이 완료되었습니다.'
    }
  } catch (cause) { error.value = authError(cause) }
  finally { busy.value = false }
}
async function submit() {
  if (locked.value) return
  error.value = ''; message.value = ''
  const normalized = normalizeEmail(email.value)
  if (!validEmail(normalized) || !password.value) { error.value = '이메일과 비밀번호를 확인해 주세요.'; return }
  if (!props.signup) {
    if (await auth.login(normalized, password.value)) {
      password.value = ''
      // Only accept the implemented protected destination, never arbitrary URLs.
      await navigateTo(route.query.redirect === '/mypage' ? '/mypage' : '/', { replace: true })
    }
    else error.value = auth.error.value
    return
  }
  if (!validPassword(password.value)) { error.value = '비밀번호는 영문과 숫자를 포함한 8~72자로 입력해 주세요. 특수문자 사용 가능 (공백 불가)'; return }
  if (password.value !== confirmation.value) { error.value = '비밀번호 확인이 일치하지 않습니다.'; return }
  const name = normalizeNickname(nickname.value)
  if (!validNickname(name)) { error.value = '닉네임은 문자·숫자·밑줄로 2~10자 입력해 주세요.'; return }
  if (!proof.value || !age.value || !terms.value || !privacy.value) { error.value = '이메일 인증과 필수 동의를 완료해 주세요.'; return }
  busy.value = true
  try {
    await $fetch('/api/web-auth/signup', { method: 'POST', retry: 0, timeout: 15000,
      body: { email: normalized, password: password.value, nickname: name, signupProof: proof.value,
        ageConfirmed: age.value, termsOfService: terms.value, privacyPolicy: privacy.value } })
    password.value = ''; confirmation.value = ''; proof.value = ''
    await navigateTo('/login?registered=1')
  } catch (cause) {
    error.value = authError(cause)
    if ((cause as { statusCode?: number }).statusCode === 403) { proof.value = ''; sent.value = false }
  } finally { busy.value = false }
}
</script>

<template>
  <section class="auth-form">
    <h1 class="type-title-l">{{ signup ? '회원가입' : '로그인' }}</h1>
    <p class="auth-form__description">{{ signup ? '더플레이브 계정을 만들고 팝업 정보를 저장해 보세요.' : '가입한 계정으로 더플레이브를 이용해 보세요.' }}</p>
    <p v-if="!signup && $route.query.registered === '1'" role="status">회원가입이 완료되었습니다. 로그인해 주세요.</p>
    <p v-if="auth.user.value" role="status">{{ auth.user.value.nickname }}님으로 로그인되어 있습니다. <NuxtLink to="/">홈으로</NuxtLink></p>
    <form v-else @submit.prevent="submit">
      <fieldset :disabled="locked">
        <label>이메일<input v-model="email" type="email" autocomplete="email" maxlength="255" required /></label>
        <template v-if="signup">
          <BaseButton variant="secondary" :disabled="!!proof" @click="verification('send-code')">{{ proof ? '이메일 인증 완료' : sent ? '인증번호 재전송' : '인증번호 받기' }}</BaseButton>
          <template v-if="sent && !proof">
            <label>인증번호<input v-model="code" inputmode="numeric" autocomplete="one-time-code" maxlength="6" /></label>
            <BaseButton variant="secondary" @click="verification('verify-code')">인증번호 확인</BaseButton>
          </template>
        </template>
        <label>비밀번호<input v-model="password" type="password" :autocomplete="signup ? 'new-password' : 'current-password'" required :maxlength="signup ? 72 : 1024" /></label>
        <template v-if="signup">
          <p class="type-caption text-secondary">8~72자 · 영문, 숫자, 특수문자 사용 가능 (공백 불가)</p>
          <label>비밀번호 확인<input v-model="confirmation" type="password" autocomplete="new-password" maxlength="72" required /></label>
          <label>닉네임<input v-model="nickname" autocomplete="nickname" required /><span class="type-caption text-secondary">문자·숫자·밑줄 2~10자</span></label>
          <label class="auth-form__check"><input v-model="age" type="checkbox" required />[필수] 만 14세 이상입니다.</label>
          <template v-for="(policy, key) in policies" :key="key">
            <details><summary>{{ policy.title }} 전문 보기</summary><p>{{ policy.effectiveDate }}</p><section v-for="(section, i) in policy.sections" :key="i"><h3>{{ section.title }}</h3><p v-for="(block, j) in section.blocks" :key="j">{{ block.text }}</p></section></details>
          </template>
          <label class="auth-form__check"><input v-model="terms" type="checkbox" required />[필수] 이용약관에 동의합니다.</label>
          <label class="auth-form__check"><input v-model="privacy" type="checkbox" required />[필수] 개인정보 처리방침에 동의합니다.</label>
        </template>
        <p v-if="message" role="status">{{ message }}</p>
        <p v-if="error" role="alert" class="auth-form__error">{{ error }}</p>
        <BaseButton type="submit">{{ locked ? '처리 중…' : signup ? '회원가입' : '로그인' }}</BaseButton>
      </fieldset>
    </form>
    <GoogleLogin v-if="!signup" :disabled="busy || auth.pending.value || appleBusy" @busy="googleBusy = $event" />
    <AppleLogin v-if="showAppleLogin && !signup" :disabled="busy || auth.pending.value || googleBusy" @busy="appleBusy = $event" />
    <p class="auth-form__footer">{{ signup ? '이미 계정이 있나요?' : '계정이 없나요?' }} <NuxtLink :to="signup ? '/login' : '/signup'">{{ signup ? '로그인' : '회원가입' }}</NuxtLink></p>
  </section>
</template>

<style scoped>
.auth-form { width: 100%; max-width: 480px; margin: 8px auto 48px; padding: 32px; border: 1px solid var(--ds-border); border-radius: 16px; background: #fff; color: var(--ds-text); box-shadow: 0 2px 12px rgb(0 0 0 / 2%); }
.auth-form h1 { margin: 0; color: #171717; font-size: 28px; font-weight: 700; line-height: 1.35; letter-spacing: -.025em; }
.auth-form__description { margin-top: 10px; color: #737373; font-size: 14px; line-height: 1.7; }
.auth-form fieldset { display: flex; flex-direction: column; gap: 16px; border: 0; padding: 0; margin: 24px 0; min-width: 0; }
.auth-form label { display: flex; flex-direction: column; gap: 8px; font-size: 14px; font-weight: 500; }
.auth-form input:not([type=checkbox]) { width: 100%; height: 48px; padding: 12px 14px; border: 1px solid var(--ds-border); border-radius: 10px; background: #fff; font-size: 16px; font-weight: 400; }
.auth-form input:focus-visible { outline: 2px solid #404040; outline-offset: 2px; }
.auth-form .type-caption { color: #737373; font-size: 12px; font-weight: 400; line-height: 1.6; }
.auth-form fieldset > .type-caption { margin-top: -10px; }
.auth-form .auth-form__check { flex-direction: row; align-items: center; gap: 8px; min-height: 36px; font-size: 13px; font-weight: 400; line-height: 1.5; }
.auth-form__check + .auth-form__check { margin-top: -12px; }
.auth-form input[type=checkbox] { width: 16px; height: 16px; flex-shrink: 0; accent-color: #262626; }
.auth-form details { max-height: 200px; overflow: auto; padding: 12px 14px; border: 1px solid var(--ds-border); border-radius: 10px; background: #fafafa; color: #737373; font-size: 12px; line-height: 1.7; }
.auth-form details + details { margin-top: -8px; }
.auth-form details p { margin-block: 12px; white-space: pre-line; }
.auth-form summary { cursor: pointer; color: #525252; font-size: 13px; font-weight: 500; }
.auth-form :deep(button) { min-height: 48px; border-radius: 10px; font-size: 14px; transition: background-color 150ms ease, border-color 150ms ease; }
.auth-form :deep(button[type=submit]) { border-color: #262626; background: #262626; color: #fff; }
.auth-form :deep(button[type=submit]:hover:enabled) { border-color: #404040; background: #404040; }
.auth-form :deep(button[type=submit]:active:enabled) { border-color: #171717; background: #171717; }
.auth-form :deep(button[type=button]) { border-color: #d4d4d4; background: #fff; color: #404040; }
.auth-form :deep(button[type=button]:hover:enabled) { background: #f5f5f5; }
.auth-form :deep(button[type=button]:active:enabled) { background: #e5e5e5; }
.auth-form :deep(button:disabled), .auth-form fieldset:disabled :deep(button) { border-color: #e5e5e5; background: #e5e5e5; color: #737373; cursor: not-allowed; }
.auth-form__error { color: #b42318; }
.auth-form a { text-decoration: underline; }
.auth-form__footer { padding-top: 20px; border-top: 1px solid var(--ds-border); color: #737373; text-align: center; font-size: 13px; line-height: 1.6; }
.auth-form__footer a { margin-left: 4px; color: #404040; font-weight: 500; text-underline-offset: 3px; }
@media (width < 640px) {
  .auth-form { margin: 0 auto 32px; padding: 24px 20px; }
  .auth-form h1 { font-size: 26px; }
}
</style>
