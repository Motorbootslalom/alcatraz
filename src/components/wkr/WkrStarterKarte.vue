<script setup lang="ts">
import { computed } from 'vue'
import type { SchlangenEintrag } from '../../geraete/erfassen'
import type { ListenCoPilot } from '../../wkr/sicht'
import { gewichtText } from '../../domain/gewicht'
import { useWkrText } from './texte'

/**
 * Starterkarte (W3.3, Plan §5.1): die Startnummer riesig, Klasse, Lauf bzw. Attempt, Boot – **nie der Name des
 * Starters** (F6; die Sicht der Liste trägt an keinem Start einen). Einzige Namen: die Co-Piloten der Klasse am Steg,
 * aus der Besetzung (unten).
 * Kennzeichen als Wort: „geschätzt (ohne Verbindung)“, „noch nicht gezeigt“
 * (Vorsteg vorab), „außer der Reihe“ (gewählt statt des Kopfs der Schlange), „● gesendet“ (Doppeltipp-Schutz, G5),
 * „Korrektur“ (F7). Parcours-Ampel (Nutzer 21.11.2026, P-03, AM9): kleiner Punkt mit Wort am gezeigten Start – grün
 * „Start frei“, rot „im Parcours“, frei „alle fertig“ (Farben nur --wkr-*, Zeichen UND Wort, bricht um statt abzuschneiden).
 * Ausgleichsgewicht (Nutzer 24.11.2026, WKR_ANNAHMEN AG1–AG3): nur lesen, neben der Startnummer – „AG 4 kg“ umrandet,
 * „kein AG“ leise, „AG: Gewicht fehlt“ auf Warnfläche; Zahl mit dem Dezimalzeichen der Liste (domain/gewicht.ts
 * gewichtText). Welcher Teil es zeigt, entscheidet WkrMaske (Prop `ausgleich`, `null` = nicht hier).
 * Besetzung am Steg (Nutzer 27.11.2026: „Hier beim Steg bitte noch das Boot und ggf. die Co-Piloten mit anzeigen“,
 * WKR_ANNAHMEN CP5–CP7): unter dem Ausgleichsgewicht des Starters das Boot; darunter in einer eigenen Zeile über die
 * ganze Breite der Karte der Co-Pilot und kleiner der Ersatz wie auf der Papierliste, das Ausgleichsgewicht eines
 * Co-Piloten in Klammern dahinter („(+3 kg)“, „(nicht gewogen)“ auf Warnfläche). Ob die Klammer erscheint, entscheidet
 * WkrMaske (nur im Ablegen, CP6). `coPilotPlatz` sind die Blöcke der anderen Klassen der Liste: Sie liegen unsichtbar in
 * derselben Rasterzelle, der Platz ist so hoch wie der höchste – die Knöpfe darunter springen weder beim Klassenwechsel
 * noch, wenn ein langer Name umbricht (CP7, Prüfbefund 27.11.2026: in der Spalte neben der Nummer brachen auf dem Handy
 * schon gewöhnliche Namen um). Nie abgeschnitten.
 */
const props = defineProps<{
  start: Pick<SchlangenEintrag, 'startNr' | 'titel' | 'boot' | 'geschaetzt' | 'vorab'>
  klasse: string
  ausserDerReihe?: boolean
  gesendet?: boolean
  korrektur?: 'korrektur' | 'vorschlag' | null
  ampel?: 'gruen' | 'rot' | 'frei' | null
  ausgleich?: number | 'fehlt' | null
  /** Co-Piloten der Klasse dieses Starts (Folge Co-Pilot, Ersatz); `ausgleich` nur, wo die Klammer hier stehen soll. */
  coPiloten?: readonly ListenCoPilot[] | null
  /**
   * Nur für den Platz (CP7): die Co-Piloten der ANDEREN Klassen der Liste, mit derselben Regel für die Klammer – sie
   * stehen unsichtbar unter dem sichtbaren Block, damit die Karte so hoch ist wie für die Klasse mit dem höchsten.
   */
  coPilotPlatz?: readonly (readonly ListenCoPilot[])[]
}>()
const { w, sprache } = useWkrText()
const kgText = (kg: number) => gewichtText(kg, sprache.value === 'en' ? 'en' : 'de')
/** Die Klammer hinter einem Co-Piloten wie auf der Papierliste (components/AusgleichListen.vue coAg). */
const coPilotAg = (c: ListenCoPilot) =>
  c.ausgleich === 'fehlt' ? w('wkr.geraet.coPilot.fehlt') : typeof c.ausgleich === 'number' && c.ausgleich > 0 ? w('wkr.geraet.coPilot.ag', { kg: kgText(c.ausgleich) }) : ''
const coPilotText = (c: ListenCoPilot) => w(c.rolle === 'ersatz' ? 'wkr.geraet.coPilot.ersatz' : 'wkr.geraet.coPilot.haupt', { name: c.coPilot })
const platz = computed(() => (props.coPilotPlatz ?? []).filter((b) => b.length > 0))
const mitBesetzung = computed(() => (props.coPiloten?.length ?? 0) > 0 || platz.value.length > 0)
const ausgleichArt = computed(() => {
  const a = props.ausgleich
  return a === undefined || a === null ? null : a === 'fehlt' ? 'fehlt' : a > 0 ? 'kg' : 'kein'
})
const ausgleichText = computed(() => {
  const a = props.ausgleich
  if (typeof a === 'number' && a > 0) return w('wkr.geraet.ausgleich.kg', { kg: kgText(a) })
  return ausgleichArt.value ? w(`wkr.geraet.ausgleich.${ausgleichArt.value === 'fehlt' ? 'fehlt' : 'kein'}`) : ''
})
</script>

<template>
  <section
    class="wkr-starterkarte"
    :class="{ 'wkr-starterkarte--ausser': ausserDerReihe, 'wkr-starterkarte--gesendet': gesendet, 'wkr-starterkarte--korrektur': !!korrektur }"
    data-teil="karte"
    :data-startnr="start.startNr"
  >
    <p v-if="korrektur" class="wkr-starterkarte-art" data-teil="korrektur">{{ w(korrektur === 'vorschlag' ? 'wkr.geraet.korrektur.vorschlagTitel' : 'wkr.geraet.korrektur.titel', { nr: start.startNr }) }}</p>
    <div class="wkr-starterkarte-zeile">
      <span class="wkr-startnr" data-teil="startnr">{{ start.startNr }}</span>
      <span class="wkr-starterkarte-angaben">
        <span data-teil="klasse">{{ klasse }}</span>
        <span class="wkr-starterkarte-klein" data-teil="start-titel">{{ start.titel }}</span>
        <span v-if="ausgleichArt" class="wkr-starterkarte-ausgleich" :class="`wkr-starterkarte-ausgleich--${ausgleichArt}`" data-teil="ausgleich" :data-ausgleich="String(ausgleich)" :title="w('wkr.geraet.ausgleich.wort')">{{ ausgleichText }}</span>
        <!-- Besetzung der Klasse (CP5): das Boot hier, Co-Pilot und Ersatz darunter über die ganze Breite. -->
        <span v-if="start.boot" class="wkr-starterkarte-klein" data-teil="boot">{{ w('wkr.geraet.boot', { boot: start.boot }) }}</span>
      </span>
    </div>
    <!-- CP7: sichtbarer Block und die Blöcke der anderen Klassen in EINER Rasterzelle – Höhe des höchsten. -->
    <div v-if="mitBesetzung" class="wkr-starterkarte-besetzung" data-teil="co-piloten">
      <span v-if="coPiloten?.length" class="wkr-starterkarte-copiloten" data-teil="co-piloten-sichtbar">
        <span
          v-for="c in coPiloten"
          :key="c.rolle"
          class="wkr-starterkarte-copilot"
          :class="`wkr-starterkarte-copilot--${c.rolle}`"
          data-teil="co-pilot"
          :data-rolle="c.rolle"
          :title="c.rolle === 'ersatz' ? w('wkr.geraet.coPilot.ersatzWort') : undefined"
        >{{ coPilotText(c) }}<template v-if="coPilotAg(c)">{{ ' ' }}<span class="wkr-starterkarte-copilot-ag" :class="{ 'wkr-starterkarte-copilot-ag--fehlt': c.ausgleich === 'fehlt' }" data-teil="co-pilot-ag" :data-ausgleich="String(c.ausgleich)">{{ coPilotAg(c) }}</span></template></span>
      </span>
      <span v-for="(b, i) in platz" :key="i" class="wkr-starterkarte-copiloten wkr-starterkarte-copiloten--platz" data-teil="co-pilot-platz" aria-hidden="true">
        <span v-for="c in b" :key="c.rolle" class="wkr-starterkarte-copilot" :class="`wkr-starterkarte-copilot--${c.rolle}`">{{ coPilotText(c) }}<template v-if="coPilotAg(c)">{{ ' ' }}<span class="wkr-starterkarte-copilot-ag" :class="{ 'wkr-starterkarte-copilot-ag--fehlt': c.ausgleich === 'fehlt' }">{{ coPilotAg(c) }}</span></template></span>
      </span>
    </div>
    <p v-if="ampel" class="wkr-starterkarte-marke wkr-starterkarte-ampel" :data-ampel="ampel" data-teil="karten-ampel">
      <span class="wkr-starterkarte-ampel-licht" aria-hidden="true">●</span> {{ w(`wkr.geraet.ampel.${ampel}`) }}
    </p>
    <p v-if="gesendet" class="wkr-starterkarte-marke wkr-starterkarte-marke--gesendet" role="status" data-teil="gesendet">● {{ w('wkr.geraet.gesendet') }}</p>
    <p v-if="start.geschaetzt" class="wkr-starterkarte-marke" data-teil="geschaetzt">{{ w('wkr.geraet.geschaetzt') }}</p>
    <p v-if="start.vorab" class="wkr-starterkarte-marke" data-teil="vorab">{{ w('wkr.geraet.vorab') }}</p>
    <p v-if="ausserDerReihe && !gesendet" class="wkr-starterkarte-marke" data-teil="ausser">{{ w('wkr.geraet.ausserDerReihe') }}</p>
  </section>
</template>
