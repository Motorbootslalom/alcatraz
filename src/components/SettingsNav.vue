<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { locale, t } from '../i18n'

/**
 * Sprungleiste der Einstellungen: je Abschnitt ein Eintrag. Die Abschnitte werden aus der
 * Seite gelesen (Überschrift jedes Blocks) statt hier aufgezählt – so kann kein Block
 * dazukommen, der in der Leiste fehlt. Gerollt wird von Hand, weil die Adresse (`#/…`)
 * schon die Ansicht trägt und kein Sprungziel mehr aufnehmen kann.
 */
const props = defineProps<{ inhalt: HTMLElement | null }>()

interface Eintrag {
  el: HTMLElement
  titel: string
}
const eintraege = ref<Eintrag[]>([])
const aktiv = ref<HTMLElement>()

function sammeln() {
  const bloecke = props.inhalt ? [...props.inhalt.querySelectorAll<HTMLElement>(':scope > .panel')] : []
  eintraege.value = bloecke
    .map((el) => ({ el, titel: el.querySelector(':scope > h2, :scope > summary, :scope > * > h2, :scope > * > h3')?.firstChild?.textContent?.trim() ?? '' }))
    .filter((e) => e.titel)
}

function springe(e: Eintrag) {
  aktiv.value = e.el
  // Ein zugeklappter Block geht auf: Wer hinspringt, will hinein.
  if (e.el instanceof HTMLDetailsElement) e.el.open = true
  e.el.scrollIntoView?.({ block: 'start', behavior: 'smooth' })
}

// Blöcke kommen und gehen (Assistent, Clubmeisterschaft), und die Überschriften folgen der Sprache.
let beobachter: MutationObserver | undefined
onMounted(() => {
  watch(
    () => props.inhalt,
    (el) => {
      beobachter?.disconnect()
      if (!el) return
      sammeln()
      beobachter = new MutationObserver(sammeln)
      beobachter.observe(el, { childList: true })
    },
    { immediate: true },
  )
})
watch(locale, () => nextTick(sammeln))
onBeforeUnmount(() => beobachter?.disconnect())
</script>

<template>
  <nav class="settings-nav no-print" :aria-label="t('settings.jump')">
    <button v-for="e in eintraege" :key="e.titel" type="button" :class="aktiv === e.el ? 'active' : ''" @click="springe(e)">
      {{ e.titel }}
    </button>
  </nav>
</template>
