<script setup lang="ts">
import { computed } from 'vue'
import type { ZeilenStufe } from '../../geraete/erfassen'
import type { Takt } from '../../wkr/maske'
import { stufeZeichen, useWkrText } from './texte'

/**
 * Overlay nach „Fehlerfrei“/„Abschicken“ (Feldtest 21.11.2026, Befund 13 – N1 in WKR_ANNAHMEN): Vorher blieb die
 * Maske nach dem Tipp 2 s scheinbar unverändert stehen („als ob es ein Problem gibt“). Jetzt liegt sofort eine Fläche
 * über allem: „Start 605 – wird übertragen …“ (noch im Ausgang), „gesendet – wartet auf Bestätigung …“ (unterwegs),
 * dann „✓ übernommen“ (bzw. Rückfrage/abgelehnt mit Zeichen UND Wort), danach wechselt WkrMaske zum nächsten Start.
 *
 * Ohne Knöpfe und mit eigenem Tipp-Fang: Ein zweiter Tipp landet hier, nie auf der Maske darunter (Doppeltipp-Schutz).
 * Keine Animation (Akku, styles/wkr-geraet.test.ts) – das Zeichen ⧗ steht still. `probe`: dieselbe Fläche in der
 * Probe (WkrProbe), mit dem Satz, dass nichts gesendet wird.
 */
const props = defineProps<{
  startNr: string
  takt: Takt
  /** Stufe der Zeile (Kern); `null` = noch nicht im Ausgang sichtbar. */
  stufe: ZeilenStufe | null
  probe?: boolean
}>()
const { w } = useWkrText()

const beantwortet = computed(() => props.takt === 'uebernommen' && !!props.stufe && props.stufe.stufe !== 'unterwegs')
const zeile = computed(() => {
  const s = props.stufe
  if (beantwortet.value && s) return `${stufeZeichen(s)} ${w(`wkr.geraet.stufe.${s.stufe}`)}`
  return s?.stufe === 'unterwegs' && s.gesendet ? `⧗ ${w('wkr.geraet.uebertragen.wartet')}` : `⧗ ${w('wkr.geraet.uebertragen.laeuft')}`
})
</script>

<template>
  <div
    class="wkr-uebertragen"
    role="status"
    aria-live="polite"
    data-teil="uebertragen"
    :data-phase="beantwortet ? 'beantwortet' : 'laeuft'"
    :data-stufe="stufe?.stufe"
    @click.stop.prevent
  >
    <div class="wkr-uebertragen-kasten" :class="{ 'wkr-uebertragen-kasten--rot': beantwortet && stufe?.stufe === 'abgelehnt' }">
      <p class="wkr-uebertragen-nr" data-teil="uebertragen-nr">{{ w('wkr.geraet.uebertragen.start', { nr: startNr }) }}</p>
      <p class="wkr-uebertragen-zeile" data-teil="uebertragen-zeile">{{ zeile }}</p>
      <p v-if="probe" class="wkr-uebertragen-probe">{{ w('wkr.geraet.probe.band') }}</p>
    </div>
  </div>
</template>
