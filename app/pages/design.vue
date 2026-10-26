<script setup lang="ts">
import { ref } from 'vue'
import { ArrowRight, Check, Heart, Search } from '@lucide/vue'

definePageMeta({ layout: 'preview' })

const selectedCountry = ref(true)
const selectedCategory = ref(false)
const actionCount = ref(0)
const palette = [
  { label: 'Brand', value: '#22C55E', token: 'brand' },
  { label: 'Brand soft', value: '#DCFCE7', token: 'brand-soft' },
  { label: 'Brand strong', value: '#15803D', token: 'brand-strong' },
  { label: 'Background', value: '#FFFFFF', token: 'background' },
  { label: 'Surface', value: '#F8FAFC', token: 'surface' },
  { label: 'Text', value: '#111827', token: 'text' },
  { label: 'Secondary', value: '#6B7280', token: 'secondary' },
  { label: 'Border', value: '#E5E7EB', token: 'border' },
  { label: 'Tag', value: '#F3F4F6', token: 'tag' },
  { label: 'Favorite', value: '#FF5A6E', token: 'favorite' }
]
const typeSamples = [
  { name: 'Display', spec: '32 / 700 / 40', class: 'type-display' },
  { name: 'Title L', spec: '24 / 700 / 32', class: 'type-title-l' },
  { name: 'Title M', spec: '20 / 700 / 28', class: 'type-title-m' },
  { name: 'Title S', spec: '18 / 600 / 26', class: 'type-title-s' },
  { name: 'Body', spec: '16 / 400 / 24', class: 'type-body' },
  { name: 'Label', spec: '14 / 500 / 20', class: 'type-label' },
  { name: 'Caption', spec: '12 / 400 / 18', class: 'type-caption' }
]
const spaces = [0, 2, 4, 6, 8, 10, 12, 16, 20, 24, 28, 32, 40, 48, 56, 60]
const radii = [4, 8, 12, 16, 24]
</script>

<template>
  <main id="preview-content" tabindex="-1" class="scroll-mt-[80px]">
    <div class="mx-auto max-w-[1080px] px-rn-16 py-rn-40 sm:px-rn-24">
      <p class="type-caption text-secondary">임시 개발 프리뷰 · 홈 외 메뉴와 검색·인증 기능은 준비 중입니다.</p>
      <div class="py-rn-40">
        <p class="type-label mb-rn-8 text-brand-strong">POPCHIVE / FOUNDATIONS</p>
        <h1 class="type-display">작은 규칙부터, 팝카이브답게.</h1>
        <p class="type-body mt-rn-12 max-w-2xl text-secondary">색상, 글꼴, 기본 컴포넌트를 확인하는 디자인 시스템 프리뷰입니다. 실제 서비스 홈이 아닙니다.</p>
      </div>

      <section aria-labelledby="colors-title" class="border-t border-border py-rn-32">
        <h2 id="colors-title" class="type-title-m">01. 색상</h2>
        <p class="type-label mt-rn-6 text-secondary">흰 바탕과 짙은 글자, 필요한 곳에 초록색 포인트.</p>
        <ul class="mt-rn-24 grid grid-cols-2 gap-rn-12 sm:grid-cols-5">
          <li v-for="color in palette" :key="color.token" class="overflow-hidden rounded-rn-12 border border-border">
            <div class="h-rn-60 border-b border-border" :style="{ backgroundColor: `var(--ds-${color.token})` }" aria-hidden="true" />
            <div class="p-rn-12">
              <p class="type-label">{{ color.label }}</p>
              <p class="type-caption mt-rn-4 text-secondary">{{ color.value }}</p>
            </div>
          </li>
        </ul>
      </section>

      <section aria-labelledby="components-title" class="border-t border-border py-rn-32">
        <h2 id="components-title" class="type-title-m">02. 기본 컴포넌트</h2>
        <div class="mt-rn-24 grid gap-rn-24 md:grid-cols-2">
          <div class="rounded-rn-16 bg-surface p-rn-24">
            <h3 class="type-title-s">버튼</h3>
            <div class="mt-rn-16 flex flex-wrap gap-rn-12">
              <BaseButton @click="actionCount++">Primary <ArrowRight :size="16" aria-hidden="true" /></BaseButton>
              <BaseButton variant="secondary" @click="actionCount = 0">초기화</BaseButton>
              <BaseButton disabled>비활성</BaseButton>
              <BaseButton variant="secondary" disabled>비활성</BaseButton>
            </div>
            <p class="type-caption mt-rn-16 text-secondary" role="status">버튼 클릭 {{ actionCount }}회</p>
          </div>
          <div class="rounded-rn-16 bg-surface p-rn-24">
            <h3 class="type-title-s">필터</h3>
            <div class="mt-rn-16 flex flex-wrap gap-rn-8" role="group" aria-label="필터 예시">
              <FilterChip v-model:selected="selectedCountry">한국</FilterChip>
              <FilterChip v-model:selected="selectedCategory">패션</FilterChip>
              <FilterChip disabled>비활성</FilterChip>
              <FilterChip selected disabled>선택 · 비활성</FilterChip>
            </div>
            <p class="type-caption mt-rn-16 text-secondary">클릭하거나 Tab으로 이동한 뒤 Space·Enter로 선택해 보세요.</p>
          </div>
          <div class="rounded-rn-16 border border-border p-rn-24">
            <h3 class="type-title-s">상태 배지</h3>
            <div class="mt-rn-16 flex flex-wrap items-center gap-rn-8">
              <StatusBadge status="ongoing" />
              <StatusBadge status="upcoming" />
              <StatusBadge status="ended" />
            </div>
          </div>
          <div class="rounded-rn-16 border border-border p-rn-24">
            <h3 class="type-title-s">Lucide 아이콘</h3>
            <div class="mt-rn-16 flex flex-wrap gap-rn-24 text-secondary">
              <span class="inline-flex items-center gap-rn-8"><Search :size="20" aria-hidden="true" /><span class="type-label">검색</span></span>
              <span class="inline-flex items-center gap-rn-8"><Heart :size="20" class="text-favorite" aria-hidden="true" /><span class="type-label text-foreground">찜</span></span>
              <span class="inline-flex items-center gap-rn-8"><Check :size="20" class="text-brand-strong" aria-hidden="true" /><span class="type-label">완료</span></span>
            </div>
          </div>
        </div>
      </section>

      <section aria-labelledby="type-title" class="border-t border-border py-rn-32">
        <h2 id="type-title" class="type-title-m">03. Pretendard Variable</h2>
        <p class="type-label mt-rn-6 text-secondary">RN 공통 규격 · 크기 / 굵기 / 줄 높이</p>
        <ul class="mt-rn-24 divide-y divide-border">
          <li v-for="sample in typeSamples" :key="sample.name" class="flex flex-wrap items-baseline justify-between gap-rn-12 py-rn-16">
            <div>
              <p class="type-caption mb-rn-6 text-secondary">{{ sample.name }}</p>
              <p :class="sample.class">팝업을 발견하는 즐거움</p>
            </div>
            <span class="type-caption text-secondary">{{ sample.spec }}</span>
          </li>
        </ul>
      </section>

      <section aria-labelledby="space-title" class="border-t border-border py-rn-32">
        <h2 id="space-title" class="type-title-m">04. 간격과 모서리</h2>
        <ul class="mt-rn-24 flex flex-wrap items-end gap-rn-16" aria-label="간격 척도, 16px 루트 기준">
          <li v-for="space in spaces" :key="space" class="flex flex-col items-center gap-rn-8">
            <div class="w-rn-16 rounded-rn-4 bg-brand-soft" :style="{ height: `var(--ds-space-${space})` }" aria-hidden="true" />
            <span class="type-caption text-secondary">{{ space }}</span>
          </li>
        </ul>
        <ul class="mt-rn-32 flex flex-wrap gap-rn-16" aria-label="모서리 척도, 16px 루트 기준">
          <li v-for="radius in radii" :key="radius" class="type-label flex size-rn-60 items-center justify-center border border-secondary bg-surface" :style="{ borderRadius: `var(--ds-radius-${radius})` }">{{ radius }}</li>
          <li class="type-label flex h-rn-60 items-center justify-center rounded-pill border border-secondary bg-surface px-rn-20">Full</li>
        </ul>
      </section>
      <p class="type-caption border-t border-border pt-rn-24 text-secondary">기초 컴포넌트 검토용 · 서비스 레이아웃과 최종 로고는 추후 설계합니다.</p>
      </div>
    </main>
</template>
