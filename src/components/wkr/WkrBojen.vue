<script setup lang="ts">
import { computed } from 'vue'
import { WKR_ANNAHMEN } from '../../wkr/annahmen'
import type { Weg } from '../../wkr/bojen'
import { BOJEN_FOLGE_VORGABE, bojenAbschnitte, eintraegeAuf, mitUmschalter, wegVon, type BojenFolge, type Entwurf, type MaskenAbschnitt, type MaskenAufbau, type MaskenBoje, type MaskenHalt, type MaskenTeil } from '../../wkr/maske'
import WkrKnoepfe from './WkrKnoepfe.vue'
import WkrWegUmschalter from './WkrWegUmschalter.vue'
import { useWkrText } from './texte'

/**
 * Mitte der Bojen-Maske (W4.2, Plan docs/plan-wkr-w4.md §5, 21.11.2026): die Abschnitte der gewählten Seite (ohne
 * Umschalter alle, mit Kopfzeile HINWEG/RÜCKWEG) in der gewählten Folge (unten) – je Halt eine Zeile, Katalog-Abschnitte
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
 * Reihenfolge (Nutzer 22.11.2026, WKR_ANNAHMEN.bojenFolge; ersetzt „Wie der Parcours liegt“ vom 21.11.2026): `folge`
 * `gedreht` (Vorgabe) zeigt den Rück-Reiter in derselben Folge wie Hin (Start/Ziel, Tor 1, Tor 3, Tor 5), `fahrt` in
 * Fahrtfolge, `untereinander` alles auf einem Reiter ohne Umschalter – wkr/maske.ts bojenAbschnitte. Gemerkt in
 * WkrGeraet (ablage.ts `bojenFolge[liste]`).
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
    /** Gewählte Seite des Umschalters (nur mit Umschalter, s. mitUmschalter). */
    weg: Weg
    /** Reihenfolge dieser Liste (Vorgabe: Rückweg gedreht). */
    folge?: BojenFolge
  }>(),
  { folge: BOJEN_FOLGE_VORGABE },
)
const emit = defineEmits<{ boje: [boje: MaskenBoje]; tippe: [feld: string, code: string]; weg: [weg: Weg]; disq: [] }>()
const { w } = useWkrText()

/** Unter „Alles untereinander“ ein Reiter ohne Umschalter (22.11.2026). */
const umschalter = computed(() => mitUmschalter(props.aufbau, props.folge))
const zahlen = computed(() => ({ hin: eintraegeAuf(props.entwurf, props.aufbau, 'hin'), rueck: eintraegeAuf(props.entwurf, props.aufbau, 'rueck') }))

/** Was die Mitte zeigt, in EINER Folge: Kopfzeilen (Weg), Halte mit ihrer Zeilenbeschriftung, Kataloge. */
type Eintrag = { typ: 'weg'; weg: Weg; key: string } | { typ: 'halt'; halt: MaskenHalt; zeile: string; key: string } | { typ: 'katalog'; teil: MaskenTeil; key: string }
const schluessel = (a: MaskenAbschnitt) => (a.art === 'halt' ? `h|${a.halt.halt}|${a.halt.weg}` : `k|${a.teil.feld}`)

const eintraege = computed<Eintrag[]>(() => {
  const out: Eintrag[] = []
  const abschnitt = (a: MaskenAbschnitt, zeile: string): Eintrag =>
    a.art === 'halt' ? { typ: 'halt', halt: a.halt, zeile, key: schluessel(a) } : { typ: 'katalog', teil: a.teil, key: schluessel(a) }
  const gezeigt = bojenAbschnitte(props.aufbau, props.folge, props.weg)
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
/** Platz im Raster: Spalte 1 bzw. 2 nach dem Blick (P7), volle Breite ohne Seite. */
function platz(b: MaskenBoje): string {
  return b.spalte === null ? '1 / -1' : String(b.spalte + 1)
}

// --- Disq. an der Boje (U1, BZ4): nur der Einstieg, die Wahl macht WkrDisqOrt ---
const mitBojenDisq = computed(() => props.aufbau.abschnitte.some((a) => a.art === 'halt' && a.halt.bojen.some((b) => b.disq.length > 0)))
</script>

<template>
  <div class="wkr-bojen" data-teil="bojen" :data-weg="umschalter ? weg : undefined" :data-folge="folge">
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
