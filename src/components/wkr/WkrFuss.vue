<script setup lang="ts">
import { computed } from 'vue'
import type { ListenTeil } from '../../wkr/liste'
import { useWkrText } from './texte'

/**
 * Fuß der Maske (W3.3, Plan §5.1/§5.2): „↶ Rückgängig“, [DISQ] und der EINE Hauptknopf – leer „Fehlerfrei ✓“
 * (Steg „Ablegen OK ✓“/„Anlegen OK ✓“, Vorsteg „In Ordnung ✓“), mit Einträgen „Abschicken · n Pkt.“, in der
 * Korrektur „Korrektur abschicken“ bzw. nach dem Abschluss „Als Vorschlag senden“ (F7). DISQ steht links, der
 * Hauptknopf rechts, dazwischen mindestens 24 px (styles/wkr-geraet.css `--wkr-disq-abstand`); Linkshand spiegelt.
 * Der Umschaltknopf nennt immer, WOHIN er wechselt: „DISQ“ bei offenen Codes, „FEHLER“ bei offenen Disq.-Buchstaben
 * (Befund 10, Feldtest 21.11.2026: „Wenn man Disq offen hat, dann sollte hier Fehler stehen“).
 * Bojen-Maske (W4.2, 21.11.2026, P13): `bojen` wie `katalog` – „Fehlerfrei ✓“ bzw. „Abschicken · n Pkt.“ (Bojen und
 * Codes zählen), DISQ/FEHLER schaltet zwischen Disq.-Liste und Bojen.
 * Zeit (W5.4, 22.11.2026, ZT3): Solange ein Zeitfeld weder eine lesbare Zeit noch „keine Zeit“ hat, ist der Hauptknopf
 * gesperrt und sagt „noch 2 Zeiten“ (`zeitenOffen`); danach „Zeiten abschicken ✓“ bzw. mit Punkten/Disq. wie sonst.
 * Tabelle (W5.5, 22.11.2026, TB3): Zellen mit Fehler sperren ebenso („2 Zellen prüfen“, `zellenFehler`).
 */
const props = defineProps<{
  art: 'katalog' | 'vorsteg' | 'bojen' | 'zeit'
  teil?: ListenTeil
  eintraege: number
  punkte: number
  disq: string[]
  korrektur: 'korrektur' | 'vorschlag' | null
  hand: 'rechts' | 'links'
  /** Katalog: Gibt es Disq.-Buchstaben in diesem Teil? (Vorsteg zeigt sie in der Mitte.) */
  mitDisq: boolean
  disqOffen: boolean
  /** Zeitfelder ohne lesbare Zeit und ohne „keine Zeit“ (W5.4) – > 0 sperrt den Hauptknopf. */
  zeitenOffen?: number
  /** Die Liste hat Zeitfelder (W5.4): dann nie „Fehlerfrei“, sondern „Zeiten abschicken“. */
  mitZeit?: boolean
  /** Maske „Tabelle“ (W5.5): Zellen mit Fehler – > 0 sperrt den Hauptknopf. */
  zellenFehler?: number
}>()
const emit = defineEmits<{ zurueck: []; disq: []; haupt: [] }>()
const { w, wn } = useWkrText()

const gesperrt = computed(() => (props.zeitenOffen ?? 0) > 0 || (props.zellenFehler ?? 0) > 0)
const haupt = computed(() => {
  if ((props.zellenFehler ?? 0) > 0) return wn('wkr.geraet.tabelle.fehlerZahl', props.zellenFehler ?? 0)
  if (gesperrt.value) return wn('wkr.geraet.zeit.nochOffen', props.zeitenOffen ?? 0)
  if (props.korrektur) return w(props.korrektur === 'vorschlag' ? 'wkr.geraet.korrektur.vorschlag' : 'wkr.geraet.korrektur.abschicken')
  if (props.eintraege === 0 && !props.mitZeit) {
    if (props.art === 'vorsteg') return w('wkr.geraet.inOrdnung')
    if (props.teil) return w(props.teil === 'ab' ? 'wkr.geraet.fehlerfrei.ab' : 'wkr.geraet.fehlerfrei.an')
    return w('wkr.geraet.fehlerfrei')
  }
  const was = [props.punkte > 0 ? w('wkr.geraet.punkte', { n: props.punkte }) : '', props.disq.length > 0 ? `${w('wkr.geraet.disq')} ${props.disq.join(', ')}` : '']
    .filter(Boolean)
    .join(' · ')
  if (props.mitZeit && was === '') return w('wkr.geraet.zeit.abschicken')
  if (props.teil) return w(props.teil === 'ab' ? 'wkr.geraet.abschicken.ab' : 'wkr.geraet.abschicken.an', { was })
  return w('wkr.geraet.abschicken', { was })
})
</script>

<template>
  <footer class="wkr-fuss" :class="{ 'wkr-fuss--links': hand === 'links' }" data-teil="fuss" :data-hand="hand">
    <div class="wkr-fuss-neben">
      <button type="button" class="wkr-knopf" data-ziel="klein" data-action="zurueck" :disabled="eintraege === 0" @click="emit('zurueck')">{{ w('wkr.geraet.zurueck') }}</button>
      <button
        v-if="art !== 'vorsteg' && mitDisq"
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
      :data-offen="gesperrt || undefined"
      :disabled="gesperrt"
      @click="emit('haupt')"
    >
      {{ haupt }}
    </button>
  </footer>
</template>
