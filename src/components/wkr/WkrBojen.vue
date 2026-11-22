<script setup lang="ts">
import { computed } from 'vue'
import { BOJEN_ANSICHT_VORGABE, type BojenAnsicht } from '../../geraete/ablage'
import { WKR_ANNAHMEN } from '../../wkr/annahmen'
import type { Weg } from '../../wkr/bojen'
import { eintraegeAuf, nachLage, wegVon, type Entwurf, type MaskenAbschnitt, type MaskenAufbau, type MaskenBoje, type MaskenHalt, type MaskenTeil } from '../../wkr/maske'
import WkrKnoepfe from './WkrKnoepfe.vue'
import WkrWegUmschalter from './WkrWegUmschalter.vue'
import { useWkrText } from './texte'

/**
 * Mitte der Bojen-Maske (W4.2, Plan docs/plan-wkr-w4.md §5, 21.11.2026): die Abschnitte der gewählten Seite (ohne
 * Umschalter alle, mit Kopfzeile HINWEG/RÜCKWEG) in Fahrtfolge (P6) – je Halt eine Zeile, Katalog-Abschnitte
 * (Einfahrt Tor 5, MüB) an ihrem Platz über WkrKnoepfe.
 *
 * - Zwei Knopfspalten nach `boje.spalte` (P7: wie die Unterspalten auf dem Bogen, also wie der WKR die Bojen sieht);
 *   eine Einzelboje (Start/Ziel, Tor-5-Boje) steht in der Spalte ihrer Seite, die andere bleibt frei; Speedboje und
 *   Parallel-Bojen 1–5 (`spalte: null`) volle Breite.
 * - Schalter: Tipp setzt („✔ 5“, schwarz hinterlegt), zweiter Tipp nimmt weg (Prellschutz in WkrMaske). Zähler (Tor 5):
 *   „0×“, jeder Tipp +1, „2× = 10“, ab WKR_ANNAHMEN.bojenZaehlerMax nimmt der Knopf nichts mehr an und sagt es in einer
 *   zweiten Zeile („höchstens 9×“). Nie nur Farbe.
 * - Tor 1, 2. Durchfahrt (`durchfahrt: 2`): eigene Zeile mit dem Satz „2. Durchfahrt (Speedrunde)“ über den Knöpfen.
 * - Kein [−][+]: zurück nur über „− letzte zurück“ im Fuß.
 *
 * Nutzer 21.11.2026 (WKR_ANNAHMEN V1/V2): `ansicht.folge` `lage` zeigt die Bojen, „wie der Parcours liegt“ – je Ort eine
 * Gruppe (wkr/maske.ts nachLage: Tor 1 mit Hin, Rück und 2. Durchfahrt), Start oben bzw. unten, ohne Umschalter;
 * `tauschen` tauscht die zwei Knopfspalten in beiden Ansichten. Gemerkt in WkrGeraet (ablage.ts `bojen[liste]`).
 *
 * Disq. an der Boje (Nutzer 21.11.2026, U1; umgebaut nach W4-12 am 21.11.2026, WKR_ANNAHMEN BZ1/BZ4): „Disq. an Boje …“
 * ist ein Einstieg in DIESELBE Wahl wie DISQ im Fuß (`disq` → WkrMaske/WkrProbe öffnen WkrDisqOrt: erst die Boje, dann
 * der Buchstabe). Eine Boje mit Buchstaben zeigt Punkte UND „Disq. G“ (zwei Zeilen, nichts abgeschnitten bei 360 px) und
 * nimmt weiter Berührungen an – die Zelle trägt beides („5G“).
 */
const props = withDefaults(
  defineProps<{
    aufbau: MaskenAufbau
    entwurf: Entwurf
    /** Gewählte Seite des Umschalters (nur mit `aufbau.umschalter` in der Fahrtfolge). */
    weg: Weg
    /** Reihenfolge und Spiegeln dieser Liste (Vorgabe: Fahrtfolge). */
    ansicht?: BojenAnsicht
  }>(),
  { ansicht: () => ({ ...BOJEN_ANSICHT_VORGABE }) },
)
const emit = defineEmits<{ boje: [boje: MaskenBoje]; tippe: [feld: string, code: string]; weg: [weg: Weg]; disq: [] }>()
const { w } = useWkrText()

const lage = computed(() => props.ansicht.folge === 'lage')
/** Der Umschalter gilt nur in der Fahrtfolge – in der Lage-Ansicht steht jedes Tor einmal da (V2). */
const umschalter = computed(() => props.aufbau.umschalter && !lage.value)
const zahlen = computed(() => ({ hin: eintraegeAuf(props.entwurf, props.aufbau, 'hin'), rueck: eintraegeAuf(props.entwurf, props.aufbau, 'rueck') }))

/** Was die Mitte zeigt, in EINER Folge: Kopfzeilen (Weg bzw. Ort), Halte mit ihrer Zeilenbeschriftung, Kataloge. */
type Eintrag =
  | { typ: 'weg'; weg: Weg; key: string }
  | { typ: 'ort'; titel: string; lage: number | null; key: string }
  | { typ: 'halt'; halt: MaskenHalt; zeile: string; key: string }
  | { typ: 'katalog'; teil: MaskenTeil; key: string }
const schluessel = (a: MaskenAbschnitt) => (a.art === 'halt' ? `h|${a.halt.halt}|${a.halt.weg}` : `k|${a.teil.feld}`)
const wegText = (x: Weg) => w(x === 'hin' ? 'wkr.geraet.bojen.hin' : 'wkr.geraet.bojen.rueck')

const eintraege = computed<Eintrag[]>(() => {
  const out: Eintrag[] = []
  const abschnitt = (a: MaskenAbschnitt, zeile: string): Eintrag =>
    a.art === 'halt' ? { typ: 'halt', halt: a.halt, zeile, key: schluessel(a) } : { typ: 'katalog', teil: a.teil, key: schluessel(a) }
  if (lage.value) {
    for (const g of nachLage(props.aufbau, props.ansicht.startOben)) {
      out.push({ typ: 'ort', titel: g.titel, lage: g.lage, key: `o|${g.lage}|${g.titel}` })
      for (const a of g.abschnitte) out.push(abschnitt(a, a.art === 'halt' ? (g.titelJeZeile ? a.halt.titel : wegText(a.halt.weg)) : ''))
    }
    return out
  }
  const gezeigt = props.aufbau.abschnitte.filter((a) => !umschalter.value || wegVon(a) === props.weg)
  // Ohne Umschalter: Kopfzeile vor dem ersten Abschnitt jedes Wegs (nur wenn beide Wege vorkommen).
  const zweiWege = new Set(props.aufbau.abschnitte.map(wegVon)).size > 1
  for (const [i, a] of gezeigt.entries()) {
    if (!umschalter.value && zweiWege && (i === 0 || wegVon(gezeigt[i - 1]) !== wegVon(a))) out.push({ typ: 'weg', weg: wegVon(a), key: `w|${wegVon(a)}` })
    out.push(abschnitt(a, a.art === 'halt' ? a.halt.titel : ''))
  }
  return out
})

const anzahl = (b: MaskenBoje) => props.entwurf.bojen[b.feld] ?? 0
const disqVon = (b: MaskenBoje) => props.entwurf.bojenDisq[b.feld] ?? null
/**
 * Was der Knopf unter der Beschriftung sagt – Stand als Zeichen und Zahl, nie nur Farbe. Am Höchstwert „höchstens 9×“
 * als eigene Zeile (WKR_ANNAHMEN.zaehlerStandZweiZeilen, Prüfbefund 21.11.2026): „9× = 45 · höchstens 9×“ passte bei
 * 360 px nicht in den halben Knopf. Ein Disq. an der Boje steht seit W4-12 (21.11.2026) als eigene Zeile UNTER den
 * Punkten („✔ 5“ / „Disq. G“) – beides steht in der Zelle.
 */
function stand(b: MaskenBoje): { zahl: string; max: string | null; disq: string | null } {
  const d = disqVon(b)
  const disq = d ? w('wkr.geraet.bojen.disqGesetzt', { code: d }) : null
  const n = anzahl(b)
  if (!b.zaehler) return { zahl: n > 0 ? w('wkr.geraet.bojen.gesetzt', { punkte: n * b.punkte }) : '', max: null, disq }
  if (n === 0) return { zahl: d ? '' : w('wkr.geraet.bojen.zaehlerLeer'), max: null, disq }
  const zahl = w('wkr.geraet.bojen.zaehler', { n, punkte: n * b.punkte })
  return { zahl, max: n >= WKR_ANNAHMEN.bojenZaehlerMax ? w('wkr.geraet.bojen.max', { n: WKR_ANNAHMEN.bojenZaehlerMax }) : null, disq }
}
/** Platz im Raster: Spalte 1 bzw. 2 (getauscht, V2), volle Breite ohne Seite. */
function platz(b: MaskenBoje): string {
  if (b.spalte === null) return '1 / -1'
  return String((props.ansicht.tauschen ? 1 - b.spalte : b.spalte) + 1)
}

// --- Disq. an der Boje (U1, BZ4): nur der Einstieg, die Wahl macht WkrDisqOrt ---
const mitBojenDisq = computed(() => props.aufbau.abschnitte.some((a) => a.art === 'halt' && a.halt.bojen.some((b) => b.disq.length > 0)))
</script>

<template>
  <div class="wkr-bojen" data-teil="bojen" :data-weg="umschalter ? weg : undefined" :data-folge="ansicht.folge">
    <div v-if="mitBojenDisq" class="wkr-bojen-disq" data-teil="bojen-disq">
      <button type="button" class="wkr-knopf wkr-knopf--breit" data-ziel="klein" data-action="boje-disq-modus" @click="emit('disq')">
        {{ w('wkr.geraet.bojen.disqModus') }}
      </button>
    </div>
    <WkrWegUmschalter v-if="umschalter" :weg="weg" :zahlen="zahlen" @waehle="(x) => emit('weg', x)" />
    <template v-for="e in eintraege" :key="e.key">
      <h2 v-if="e.typ === 'weg'" class="wkr-bojen-kopf" data-teil="weg-kopf" :data-weg="e.weg">
        {{ w(e.weg === 'hin' ? 'wkr.geraet.bojen.hinweg' : 'wkr.geraet.bojen.rueckweg') }}
      </h2>
      <h2 v-else-if="e.typ === 'ort'" class="wkr-bojen-kopf wkr-bojen-ort" data-teil="ort-kopf" :data-lage="e.lage ?? undefined">{{ e.titel }}</h2>
      <section
        v-else-if="e.typ === 'halt'"
        class="wkr-bojen-zeile"
        data-teil="halt"
        :data-halt="e.halt.halt"
        :data-weg="e.halt.weg"
        :data-durchfahrt="e.halt.durchfahrt"
      >
        <p v-if="e.halt.durchfahrt" class="wkr-bojen-durchfahrt" data-teil="durchfahrt">{{ w('wkr.geraet.bojen.durchfahrt') }}</p>
        <h3 class="wkr-bojen-titel" data-teil="halt-titel">{{ e.zeile }}</h3>
        <div class="wkr-bojen-knoepfe">
          <button
            v-for="b in e.halt.bojen"
            :key="b.feld"
            type="button"
            class="wkr-knopf wkr-bojen-knopf"
            :class="{ 'wkr-bojen-knopf--gesetzt': anzahl(b) > 0, 'wkr-bojen-knopf--disq': !!disqVon(b) }"
            data-ziel="gross"
            data-action="boje"
            :data-feld="b.feld"
            :data-art="b.zaehler ? 'zaehler' : 'schalter'"
            :data-anzahl="anzahl(b)"
            :data-disq="disqVon(b) ?? undefined"
            :aria-pressed="b.zaehler ? undefined : anzahl(b) > 0 || !!disqVon(b)"
            :style="{ gridColumn: platz(b) }"
            @click="emit('boje', b)"
          >
            <span class="wkr-bojen-unter">{{ b.unter || w('wkr.geraet.bojen.beruehrt') }}</span>
            <span class="wkr-bojen-stand" data-teil="boje-stand">
              <span v-if="stand(b).zahl" class="wkr-bojen-zahl">{{ stand(b).zahl }}</span>
              <span v-if="stand(b).max" class="wkr-bojen-max" data-teil="boje-max">{{ stand(b).max }}</span>
              <span v-if="stand(b).disq" class="wkr-bojen-zahl" data-teil="boje-disq-stand">{{ stand(b).disq }}</span>
            </span>
          </button>
        </div>
      </section>
      <WkrKnoepfe v-else :teile="[e.teil]" :entwurf="entwurf" @tippe="(feld, code) => emit('tippe', feld, code)" />
    </template>
  </div>
</template>
