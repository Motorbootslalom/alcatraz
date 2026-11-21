<script setup lang="ts">
import { computed } from 'vue'
import type { ListenTeil } from '../../wkr/liste'
import { useWkrText } from './texte'

/**
 * Fuß der Maske (W3.3, Plan §5.1/§5.2): „− letzte zurück“, [DISQ] und der EINE Hauptknopf – leer „Fehlerfrei ✓“
 * (Steg „Ablegen OK ✓“/„Anlegen OK ✓“, Vorsteg „In Ordnung ✓“), mit Einträgen „Abschicken · n Pkt.“, in der
 * Korrektur „Korrektur abschicken“ bzw. nach dem Abschluss „Als Vorschlag senden“ (F7). DISQ steht links, der
 * Hauptknopf rechts, dazwischen mindestens 24 px (styles/wkr-geraet.css `--wkr-disq-abstand`); Linkshand spiegelt.
 * Der Umschaltknopf nennt immer, WOHIN er wechselt: „DISQ“ bei offenen Codes, „FEHLER“ bei offenen Disq.-Buchstaben
 * (Befund 10, Feldtest 21.11.2026: „Wenn man Disq offen hat, dann sollte hier Fehler stehen“).
 */
const props = defineProps<{
  art: 'katalog' | 'vorsteg'
  teil?: ListenTeil
  eintraege: number
  punkte: number
  disq: string[]
  korrektur: 'korrektur' | 'vorschlag' | null
  hand: 'rechts' | 'links'
  /** Katalog: Gibt es Disq.-Buchstaben in diesem Teil? (Vorsteg zeigt sie in der Mitte.) */
  mitDisq: boolean
  disqOffen: boolean
}>()
const emit = defineEmits<{ zurueck: []; disq: []; haupt: [] }>()
const { w } = useWkrText()

const haupt = computed(() => {
  if (props.korrektur) return w(props.korrektur === 'vorschlag' ? 'wkr.geraet.korrektur.vorschlag' : 'wkr.geraet.korrektur.abschicken')
  if (props.eintraege === 0) {
    if (props.art === 'vorsteg') return w('wkr.geraet.inOrdnung')
    if (props.teil) return w(props.teil === 'ab' ? 'wkr.geraet.fehlerfrei.ab' : 'wkr.geraet.fehlerfrei.an')
    return w('wkr.geraet.fehlerfrei')
  }
  const was = [props.punkte > 0 ? w('wkr.geraet.punkte', { n: props.punkte }) : '', props.disq.length > 0 ? `${w('wkr.geraet.disq')} ${props.disq.join(', ')}` : '']
    .filter(Boolean)
    .join(' · ')
  if (props.teil) return w(props.teil === 'ab' ? 'wkr.geraet.abschicken.ab' : 'wkr.geraet.abschicken.an', { was })
  return w('wkr.geraet.abschicken', { was })
})
</script>

<template>
  <footer class="wkr-fuss" :class="{ 'wkr-fuss--links': hand === 'links' }" data-teil="fuss" :data-hand="hand">
    <div class="wkr-fuss-neben">
      <button type="button" class="wkr-knopf" data-ziel="klein" data-action="zurueck" :disabled="eintraege === 0" @click="emit('zurueck')">{{ w('wkr.geraet.zurueck') }}</button>
      <button
        v-if="art === 'katalog' && mitDisq"
        type="button"
        class="wkr-knopf wkr-knopf--disq"
        data-ziel="gross"
        data-action="disq"
        :aria-expanded="disqOffen"
        :data-ziel-liste="disqOffen ? 'fehler' : 'disq'"
        @click="emit('disq')"
      >
        {{ w(disqOffen ? 'wkr.geraet.fehlerKnopf' : 'wkr.geraet.disqKnopf') }}
      </button>
    </div>
    <button
      type="button"
      class="wkr-knopf wkr-knopf--haupt"
      :class="{ 'wkr-knopf--riesig': art === 'vorsteg' }"
      data-ziel="gross"
      data-action="haupt"
      :data-leer="eintraege === 0 || undefined"
      @click="emit('haupt')"
    >
      {{ haupt }}
    </button>
  </footer>
</template>
