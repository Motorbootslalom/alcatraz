<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { KeineZeitGrund } from '../../types'
import { KEINE_ZEIT_GRUENDE } from '../../wkr/keineZeit'
import { WKR_ANNAHMEN } from '../../wkr/annahmen'
import { setzeZeit, zeitDeutung, zeitFertig, zeitUhr, zeitUnlesbar, zeitVollstaendig, type Entwurf, type MaskenAufbau } from '../../wkr/maske'
import WkrZiffern from './WkrZiffern.vue'
import { useWkrText } from './texte'

/**
 * Zeitfelder einer Liste mit Ziffernblock (W5.4, Plan docs/plan-wkr-w5.md §7.2, 22.11.2026, WKR_ANNAHMEN ZT1–ZT4) –
 * die Mitte der Maske `zeit` und der Zeit-Abschnitt unter den Bojen gemischter Listen (`moewezeit`, `bstartziel`).
 *
 * - Je Zeitfeld ein Block `zeit-feld` (Titel wie der Bogen, Stand offen|zeit|unlesbar|keine): auf dem Pad nebeneinander
 *   (`data-anordnung="nebeneinander"`, das aktive umrandet), auf dem Handy als Feld-Reiter. Ein Tipp macht es aktiv.
 * - Darunter EIN Ziffernblock (WkrZiffern `zeit`) für das aktive Feld – nur Ablesen, kein Stoppen am Gerät (F9).
 * - „Keine Zeit“ (ZT4): Knopf `keine-zeit` → Gründe `keine-zeit-grund` (`data-grund`); steht ein Grund, zeigt das Feld
 *   ihn mit „Aufheben“ (`keine-zeit-weg`) statt des Ziffernblocks.
 * - Weiterspringen (ZT6, umgebaut 22.11.2026 R8-35: „Weiter springen ist okay“): Ist die getippte Zeit fertig (alle
 *   Stellen, wkr/maske.ts zeitVollstaendig: „83,45“, nicht „83,4“), wird das nächste Feld aktiv – auf dem Pad wandert
 *   die Umrandung, auf dem Handy der Feld-Reiter. Im letzten Feld kein Sprung; zurück per Antippen. Weitere Felder sind
 *   freiwillig (ZT5). Beim neuen Start beginnt es beim ersten offenen Feld (`:key` je Start in WkrMitte).
 */
const props = defineProps<{
  aufbau: Pick<MaskenAufbau, 'zeiten'>
  entwurf: Entwurf
  gesperrt: boolean
  /** Pad: Felder nebeneinander statt Reiter. */
  pad?: boolean
}>()
const emit = defineEmits<{ zeit: [feld: string, text: string]; keineZeit: [feld: string, grund: KeineZeitGrund | null] }>()
const text = useWkrText()
const { w } = text
const komma = computed<',' | '.'>(() => (text.sprache.value === 'en' ? '.' : ','))

const ersterOffener = () => props.aufbau.zeiten.find((z) => !zeitFertig(props.entwurf, z.feld))?.feld ?? props.aufbau.zeiten[0]?.feld ?? ''
const aktiv = ref(ersterOffener())
// Ändert sich der Aufbau (Klassenwechsel ohne neuen Schlüssel), muss das aktive Feld dazugehören.
watch(
  () => props.aufbau.zeiten.map((z) => z.feld).join('|'),
  () => {
    if (!props.aufbau.zeiten.some((z) => z.feld === aktiv.value)) aktiv.value = ersterOffener()
  },
)
const gruendeOffen = ref(false)

type Stand = 'offen' | 'zeit' | 'unlesbar' | 'keine'
function standVon(feld: string): Stand {
  if (props.entwurf.keineZeit[feld]) return 'keine'
  if (zeitUnlesbar(props.entwurf, feld)) return 'unlesbar'
  return (props.entwurf.zeiten[feld] ?? '') !== '' ? 'zeit' : 'offen'
}
function wertVon(feld: string): string {
  const grund = props.entwurf.keineZeit[feld]
  if (grund) return w('wkr.geraet.keineZeit.kurz')
  const t = props.entwurf.zeiten[feld] ?? ''
  const c = t === '' ? null : zeitDeutung(t)
  return c !== null ? zeitUhr(c, komma.value) : t === '' ? '–' : t.replace(',', komma.value)
}

function waehle(feld: string): void {
  if (props.gesperrt) return
  aktiv.value = feld
  gruendeOffen.value = false
}
function tippe(neu: string): void {
  if (props.gesperrt) return
  const feld = aktiv.value
  // Was die Maske daraus macht (dieselbe reine Funktion wie WkrMaske) – nur so weiß der Block schon jetzt, ob die Zeit
  // fertig ist; der Entwurf kommt erst mit dem nächsten Durchlauf zurück.
  const nachher = setzeZeit(props.entwurf, props.aufbau, feld, neu).zeiten[feld] ?? ''
  emit('zeit', feld, neu)
  if (!WKR_ANNAHMEN.zeitSpringtWeiter || !zeitVollstaendig(nachher)) return
  const i = props.aufbau.zeiten.findIndex((z) => z.feld === feld)
  if (i >= 0 && i < props.aufbau.zeiten.length - 1) {
    aktiv.value = props.aufbau.zeiten[i + 1].feld
    gruendeOffen.value = false
  }
}
function grund(g: KeineZeitGrund): void {
  if (props.gesperrt) return
  gruendeOffen.value = false
  emit('keineZeit', aktiv.value, g)
}
function aufheben(): void {
  if (props.gesperrt) return
  emit('keineZeit', aktiv.value, null)
}
const aktivTitel = computed(() => props.aufbau.zeiten.find((z) => z.feld === aktiv.value)?.titel ?? '')
const aktivGrund = computed(() => props.entwurf.keineZeit[aktiv.value] ?? null)
</script>

<template>
  <section class="wkr-zeiten" data-teil="zeiten" :data-anordnung="pad ? 'nebeneinander' : 'reiter'">
    <div class="wkr-zeiten-felder" role="tablist" :aria-label="w('wkr.geraet.zeit.felder')">
      <button
        v-for="z in aufbau.zeiten"
        :key="z.feld"
        type="button"
        role="tab"
        class="wkr-knopf wkr-zeit-feld"
        :class="{ 'wkr-zeit-feld--aktiv': z.feld === aktiv }"
        data-ziel="gross"
        data-action="zeit-feld"
        :data-feld="z.feld"
        :data-stand="standVon(z.feld)"
        :data-aktiv="z.feld === aktiv || undefined"
        :aria-selected="z.feld === aktiv"
        @click="waehle(z.feld)"
      >
        <span class="wkr-zeit-feld-titel">{{ z.titel }}</span>
        <span class="wkr-zeit-feld-wert" data-teil="zeit-feld-wert">{{ wertVon(z.feld) }}</span>
      </button>
    </div>

    <div v-if="aktivGrund" class="wkr-band wkr-band--hinweis" role="status" data-teil="keine-zeit-stand" :data-grund="aktivGrund">
      <b>{{ w('wkr.geraet.keineZeit.stand', { feld: aktivTitel, grund: w(`wkr.geraet.keineZeit.grund.${aktivGrund}`) }) }}</b>
      <button type="button" class="wkr-knopf" data-ziel="klein" data-action="keine-zeit-weg" @click="aufheben">{{ w('wkr.geraet.keineZeit.aufheben') }}</button>
    </div>
    <template v-else>
      <WkrZiffern :key="aktiv" :model-value="entwurf.zeiten[aktiv] ?? ''" zeit :titel="aktivTitel" :gesperrt="gesperrt" @update:model-value="tippe" />
      <div class="wkr-zeiten-keine">
        <button
          v-if="!gruendeOffen"
          type="button"
          class="wkr-knopf"
          data-ziel="klein"
          data-action="keine-zeit"
          :aria-expanded="false"
          @click="gruendeOffen = true"
        >
          {{ w('wkr.geraet.keineZeit.knopf', { feld: aktivTitel }) }}
        </button>
        <fieldset v-else class="wkr-zeiten-gruende" data-teil="keine-zeit-gruende">
          <legend>{{ w('wkr.geraet.keineZeit.frage', { feld: aktivTitel }) }}</legend>
          <button
            v-for="g in KEINE_ZEIT_GRUENDE"
            :key="g"
            type="button"
            class="wkr-knopf"
            data-ziel="gross"
            data-action="keine-zeit-grund"
            :data-grund="g"
            @click="grund(g)"
          >
            {{ w(`wkr.geraet.keineZeit.grund.${g}`) }}
          </button>
          <button type="button" class="wkr-knopf" data-ziel="klein" data-action="keine-zeit-abbrechen" @click="gruendeOffen = false">{{ w('wkr.geraet.abbrechen') }}</button>
        </fieldset>
      </div>
    </template>
  </section>
</template>
