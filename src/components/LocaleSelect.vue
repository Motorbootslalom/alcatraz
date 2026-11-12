<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { locale, LOCALES, setLocale, t, type Locale } from '../i18n'
import LocaleFlag from './LocaleFlag.vue'

/**
 * Sprachwahl als Auswahlliste mit Flagge vor jeder Sprache. Eine eigene Liste
 * statt `<select>`, weil dessen Einträge nur Text zeigen können – und sie
 * wächst mit, wenn weitere Sprachen dazukommen.
 */
const open = ref(false)
const root = ref<HTMLElement | null>(null)
const list = ref<HTMLElement | null>(null)

const current = () => LOCALES.find((l) => l.id === locale.value) ?? LOCALES[0]

async function toggle(show = !open.value) {
  open.value = show
  if (!show) return
  await nextTick()
  // Der Fokus geht auf die gewählte Sprache, damit die Pfeiltasten dort beginnen.
  list.value?.querySelector<HTMLElement>('[aria-selected="true"]')?.focus()
}

function choose(id: Locale) {
  setLocale(id)
  open.value = false
  root.value?.querySelector<HTMLElement>('.lang-button')?.focus()
}

function move(e: KeyboardEvent, step: number) {
  const items = [...(list.value?.querySelectorAll<HTMLElement>('[role="option"]') ?? [])]
  const index = items.indexOf(e.target as HTMLElement)
  items[(index + step + items.length) % items.length]?.focus()
}

function onOutside(e: MouseEvent) {
  if (open.value && !root.value?.contains(e.target as Node)) open.value = false
}

onMounted(() => document.addEventListener('click', onOutside))
onBeforeUnmount(() => document.removeEventListener('click', onOutside))
</script>

<template>
  <div ref="root" class="lang-select" @keydown.esc="open && choose(locale)">
    <button
      type="button"
      class="lang-button"
      aria-haspopup="listbox"
      :aria-expanded="open"
      :aria-label="`${t('app.language')}: ${current().name}`"
      @click="toggle()"
      @keydown.down.prevent="toggle(true)"
    >
      <LocaleFlag :locale="locale" />
      <span>{{ current().name }}</span>
      <span class="caret" aria-hidden="true">▾</span>
    </button>
    <ul v-if="open" ref="list" class="lang-list" role="listbox" :aria-label="t('app.language')">
      <li
        v-for="l in LOCALES"
        :key="l.id"
        role="option"
        tabindex="-1"
        :lang="l.id"
        :aria-selected="locale === l.id"
        @click="choose(l.id)"
        @keydown.enter.prevent="choose(l.id)"
        @keydown.space.prevent="choose(l.id)"
        @keydown.down.prevent="move($event, 1)"
        @keydown.up.prevent="move($event, -1)"
      >
        <LocaleFlag :locale="l.id" />
        <span>{{ l.name }}</span>
      </li>
    </ul>
  </div>
</template>
