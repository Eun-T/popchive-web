<script setup lang="ts">
import { UserRound } from '@lucide/vue'

const auth = useAuth()
const open = ref(false)
const root = ref<HTMLDivElement | null>(null)
const trigger = ref<HTMLButtonElement | null>(null)
const id = useId()
function outside(event: PointerEvent) {
  if (!root.value?.contains(event.target as Node)) open.value = false
}
function escape(event: KeyboardEvent) {
  if (event.key === 'Escape' && open.value) {
    open.value = false
    trigger.value?.focus()
  }
}
function focusout(event: FocusEvent) {
  if (!root.value?.contains(event.relatedTarget as Node | null)) open.value = false
}
async function logout() {
  await auth.logout()
  open.value = false
}
watch(() => auth.user.value, () => { open.value = false })
onMounted(() => {
  document.addEventListener('pointerdown', outside)
  document.addEventListener('keydown', escape)
})
onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', outside)
  document.removeEventListener('keydown', escape)
})
</script>

<template>
  <div ref="root" class="user-menu" @focusout="focusout">
    <button ref="trigger" type="button" class="user-menu__trigger" aria-label="사용자 메뉴" :aria-expanded="open" :aria-controls="id" @click="open = !open">
      <UserRound :size="20" aria-hidden="true" />
    </button>
    <div v-if="open" :id="id" class="user-menu__panel">
      <NuxtLink to="/mypage" class="user-menu__name" @click="open = false">{{ auth.user.value?.nickname }}님</NuxtLink>
      <button type="button" class="user-menu__logout" :disabled="auth.pending.value" @click="logout">로그아웃</button>
    </div>
  </div>
</template>

<style scoped>
.user-menu { position: relative; }
.user-menu__trigger { display: flex; align-items: center; justify-content: center; width: 40px; height: 40px; padding: 0; border: 0; border-radius: 8px; background: transparent; color: #6b7280; cursor: pointer; }
.user-menu__panel { position: absolute; top: calc(100% + 8px); right: 0; z-index: 50; width: 192px; max-width: calc(100vw - 40px); padding: 12px; border: 1px solid #e5e7eb; border-radius: 8px; background: #fff; color: #374151; box-shadow: 0 4px 12px rgb(0 0 0 / 5%); }
.user-menu__name { padding: 4px 4px 12px; margin: 0 0 8px; border-bottom: 1px solid #e5e7eb; overflow-wrap: anywhere; white-space: normal; font-size: 14px; }
.user-menu__logout { display: block; width: 100%; min-height: 40px; padding: 8px; border: 0; border-radius: 4px; background: transparent; color: #374151; text-align: left; font-size: 14px; cursor: pointer; }
.user-menu__trigger:hover, .user-menu__logout:hover:enabled { background: #f3f4f6; }
.user-menu button:focus-visible { outline: 2px solid #6b7280; outline-offset: 2px; }
.user-menu__logout:disabled { color: #9ca3af; cursor: wait; }
.user-menu__name { display: block; text-decoration: none; }
.user-menu__name:hover { color: #111; }
.user-menu__name:focus-visible { outline: 2px solid #6b7280; outline-offset: 2px; }
</style>
