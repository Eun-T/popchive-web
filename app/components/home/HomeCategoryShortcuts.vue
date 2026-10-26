<script setup lang="ts">
import { Coffee, Landmark, LayoutGrid, MapPin, Shirt, Sparkles } from '@lucide/vue'

const categories = [
  { id: 'all', name: '전체', icon: LayoutGrid, background: '#E9EDF2' },
  { id: 'korea', name: '한국', icon: MapPin, background: '#E5F1EA' },
  { id: 'japan', name: '일본', icon: Landmark, background: '#FCE8E8' },
  { id: 'fashion', name: '패션', icon: Shirt, background: '#EAE6F7' },
  { id: 'beauty', name: '뷰티', icon: Sparkles, background: '#FCE8EE' },
  { id: 'food', name: 'F&B', icon: Coffee, background: '#FFF0D9' },
]
</script>

<template>
  <section class="category-shortcuts" aria-labelledby="home-categories-title">
    <h2 id="home-categories-title">인기 카테고리</h2>
    <ul class="category-shortcuts__list">
      <li v-for="category in categories" :key="category.id">
        <button
          type="button"
          class="category-shortcuts__button"
          aria-disabled="true"
          :aria-label="`${category.name} (바로가기 준비 중)`"
          title="카테고리 바로가기 준비 중"
        >
          <span class="category-shortcuts__circle" :style="{ backgroundColor: category.background }">
            <component :is="category.icon" :size="24" aria-hidden="true" />
          </span>
          <span>{{ category.name }}</span>
        </button>
      </li>
    </ul>
  </section>
</template>

<style scoped>
.category-shortcuts {
  width: 100%;
  max-width: 826px;
  min-width: 0;
  color: #111827;
}
.category-shortcuts h2 {
  margin: 0 0 20px;
  font-size: 20px;
  font-weight: 700;
  line-height: 1.4;
}
.category-shortcuts__list {
  display: grid;
  grid-template-columns: repeat(6, minmax(100px, 1fr));
  gap: 12px;
  margin: 0;
  padding: 4px 0;
  list-style: none;
  overflow-x: auto;
}
.category-shortcuts__button {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 0;
  border: 0;
  background: transparent;
  color: #111827;
  font-size: 14px;
  font-weight: 500;
  line-height: 20px;
  cursor: pointer;
}
.category-shortcuts__circle {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 88px;
  height: 88px;
  border-radius: 50%;
  color: #374151;
}
.category-shortcuts__button:hover .category-shortcuts__circle {
  filter: brightness(0.96);
}
.category-shortcuts__button:focus-visible {
  outline: 2px solid #15803d;
  outline-offset: -2px;
  border-radius: 8px;
}
</style>
