<script setup lang="ts">
import { computed, onBeforeUnmount, ref, shallowRef } from 'vue'
import { WKR_ANNAHMEN } from '../../wkr/annahmen'
import type { ListenTeil } from '../../wkr/liste'
import type { Weg } from '../../wkr/bojen'
import {
  disqFuer,
  eintraege,
  leererEntwurf,
  punkteVon,
  teileFuer,
  tippe,
  tippeBoje,
  tippeDisq,
  wechselNach,
  wechselTakt,
  zurueck,
  type Entwurf,
  type MaskenAufbau,
  type MaskenBoje,
  type MaskenHalt,
} from '../../wkr/maske'
import WkrBojen from './WkrBojen.vue'
import WkrFuss from './WkrFuss.vue'
import WkrKnoepfe from './WkrKnoepfe.vue'
import WkrStarterKarte from './WkrStarterKarte.vue'
import WkrUebertragen from './WkrUebertragen.vue'
import WkrVorsteg from './WkrVorsteg.vue'
import { useWkrText } from './texte'

/**
 * Probe beim Einrichten (W3.4, Plan docs/plan-wkr-w3.md §5.9, G10, 21.11.2026): DIESELBEN Teile wie die echte Maske
 * (Karte, Knöpfe bzw. Vorsteg, Fuß) mit dem Start „P“ – aber ohne Quelle: Es wird nichts gesendet, nichts als Entwurf
 * abgelegt, der Bedienrechner sieht die Probe nicht. Schritte (immer mit „Überspringen“):
 *
 * - Katalog (Tor 5, MüB, Steg-Teil): Code <erster Code> tippen → „− letzte zurück“ → Hauptknopf (Fehlerfrei bzw.
 *   Ablegen/Anlegen OK).
 * - Vorsteg: zweimal X, dann „Abbrechen“ (die große Rückfrage, F5) → „In Ordnung“.
 * - Bojen (W4.2, Plan docs/plan-wkr-w4.md §5.3, P11, 21.11.2026): Boje antippen (erste zweibojige Zeile, linker
 *   Knopf; ohne eine solche die erste Boje) → „− letzte zurück“ → nur mit Zähler: Tor 5 zweimal (2 Berührungen) →
 *   nur mit Umschalter: „Rückweg“ → Hauptknopf. Katalog-Teile gemischter Listen übt sie nicht (wie W3).
 *
 * Der letzte Schritt zeigt das Weiterspringen samt Sperre (G5, wkr/maske.ts wechselTakt): Overlay „wird übertragen …“
 * (WkrUebertragen), nach `uebungQuittungMs` gespielter Quittung „✓ übernommen“, Blitz, 1 s keine Eingabe – erst dann
 * „Probe fertig“. WkrGeraet merkt die Probe je Raum und Liste (ablage.ts `probe`).
 *
 * Ende (Feldtest 21.11.2026, Befund 4 – N5: „Was denn nun?!“): ein Satz, was ab jetzt geschieht („Ab jetzt wird
 * gesendet: Jeder Start, den die Start-Freigabe zeigt, erscheint hier.“; in der Übung: gesendet wird nichts), „Los
 * geht's“ und klein „Probe wiederholen“; das gelbe Band sagt dann „Probe beendet“.
 */
const props = defineProps<{
  aufbau: MaskenAufbau
  teil?: ListenTeil
  hand: 'rechts' | 'links'
  /** In der Übung (N5): Am Ende wird nicht „ab jetzt gesendet“, sondern weiter geübt. */
  uebung?: boolean
}>()
const emit = defineEmits<{ fertig: [] }>()
const { w } = useWkrText()

const vorsteg = computed(() => props.aufbau.art === 'vorsteg')
const teile = computed(() => teileFuer(props.aufbau, props.teil))
const ersterCode = computed(() => teile.value[0]?.codes[0] ?? null)
const disqCodes = computed(() => disqFuer(props.aufbau, props.teil))
/** Ohne Code (Katalog ohne Einträge) und ohne X am Vorsteg bleibt nur der Hauptknopf. */
type Schritt = 'code' | 'zurueck' | 'x' | 'boje' | 'zaehler' | 'rueckweg' | 'haupt'
const bojen = computed(() => props.aufbau.art === 'bojen')
const halte = computed(() => props.aufbau.abschnitte.flatMap((a) => (a.art === 'halt' ? [a.halt] : [])))
/** Ziel des ersten Schritts: linker Knopf der ersten zweibojigen Zeile, sonst die erste Boje (P11). */
const ersteBoje = computed<{ halt: MaskenHalt; boje: MaskenBoje } | null>(() => {
  const zwei = halte.value.find((h) => h.bojen.filter((b) => b.spalte !== null).length === 2)
  const h = zwei ?? halte.value[0]
  return h ? { halt: h, boje: h.bojen[0] } : null
})
const zaehlerBoje = computed<{ halt: MaskenHalt; boje: MaskenBoje } | null>(() => {
  for (const h of halte.value) for (const b of h.bojen) if (b.zaehler) return { halt: h, boje: b }
  return null
})
const schritte = computed<Schritt[]>(() => {
  if (vorsteg.value) return disqCodes.value.some((c) => c.code === 'X') ? ['x', 'haupt'] : ['haupt']
  if (bojen.value) {
    if (!ersteBoje.value) return ['haupt']
    return ['boje', 'zurueck', ...(zaehlerBoje.value ? (['zaehler'] as const) : []), ...(props.aufbau.umschalter ? (['rueckweg'] as const) : []), 'haupt']
  }
  return ersterCode.value ? ['code', 'zurueck', 'haupt'] : ['haupt']
})
const schritt = ref(0)
const art = computed(() => schritte.value[schritt.value] ?? null)
const entwurf = shallowRef<Entwurf>(leererEntwurf())

// --- Takt wie nach dem echten Abschicken ---
const gesendetUm = ref<number | null>(null)
const jetzt = ref(Date.now())
const zeitgeber = new Set<ReturnType<typeof setTimeout>>()
function nach(ms: number, f: () => void): void {
  const id = setTimeout(() => {
    zeitgeber.delete(id)
    f()
  }, ms)
  zeitgeber.add(id)
}
onBeforeUnmount(() => {
  for (const id of zeitgeber) clearTimeout(id)
})
/** Die Probe spielt die Quittung (wie die Übung nach uebungQuittungMs) – so sieht sie aus wie das echte Abschicken. */
const quittungUm = computed(() => (gesendetUm.value === null ? null : gesendetUm.value + WKR_ANNAHMEN.uebungQuittungMs))
const takt = computed(() => wechselTakt(gesendetUm.value, jetzt.value, quittungUm.value))
const imOverlay = computed(() => takt.value === 'gesendet' || takt.value === 'uebernommen')
const probeStufe = computed(() =>
  takt.value === 'uebernommen' ? ({ stufe: 'uebernommen' } as const) : ({ stufe: 'unterwegs', gesendet: false } as const),
)
const gesperrt = computed(() => gesendetUm.value !== null)
const blitz = ref(false)
const fertig = computed(() => gesendetUm.value !== null && takt.value === 'frei')

const weiter = () => (schritt.value += 1)
/** Seite des Umschalters in der Probe (wechselt nie von selbst – wie in der echten Maske). */
const weg = ref<Weg>('hin')
function tippeBojeKnopf(b: MaskenBoje): void {
  if (gesperrt.value) return
  entwurf.value = tippeBoje(entwurf.value, b)
  if (art.value === 'boje' && b.feld === ersteBoje.value?.boje.feld && (entwurf.value.bojen[b.feld] ?? 0) > 0) weiter()
  else if (art.value === 'zaehler' && b.feld === zaehlerBoje.value?.boje.feld && (entwurf.value.bojen[b.feld] ?? 0) >= 2) weiter()
}
function waehleWeg(x: Weg): void {
  if (gesperrt.value) return
  weg.value = x
  if (art.value === 'rueckweg' && x === 'rueck') weiter()
}
function tippeCode(feld: string, code: string): void {
  if (gesperrt.value) return
  entwurf.value = tippe(entwurf.value, feld, code)
  if (art.value === 'code' && code === ersterCode.value?.code) weiter()
}
function zurueckTipp(): void {
  if (gesperrt.value) return
  entwurf.value = zurueck(entwurf.value)
  if (art.value === 'zurueck') weiter()
}
function setzeDisq(code: string): void {
  if (gesperrt.value) return
  entwurf.value = tippeDisq(entwurf.value, code)
}
function xNein(): void {
  if (art.value === 'x') weiter()
}
function haupt(): void {
  if (gesperrt.value || art.value !== 'haupt') return
  const um = Date.now()
  gesendetUm.value = um
  jetzt.value = um
  const wechsel = wechselNach(um, quittungUm.value)
  nach(Math.max(WKR_ANNAHMEN.uebertragenMinMs, WKR_ANNAHMEN.uebungQuittungMs), () => (jetzt.value = Date.now()))
  nach(wechsel, () => {
    jetzt.value = Date.now()
    blitz.value = true
    try {
      if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') navigator.vibrate(60)
    } catch {
      // ohne Bedienung werfen manche Browser – der Blitz genügt
    }
    nach(150, () => (blitz.value = false))
  })
  nach(wechsel + WKR_ANNAHMEN.sperreMs, () => (jetzt.value = Date.now()))
}
/** „Probe wiederholen“: alles auf Anfang, ohne die Probe zu verlassen. */
function wiederhole(): void {
  for (const id of zeitgeber) clearTimeout(id)
  zeitgeber.clear()
  schritt.value = 0
  entwurf.value = leererEntwurf()
  gesendetUm.value = null
  weg.value = 'hin'
  blitz.value = false
  jetzt.value = Date.now()
}

const anweisung = computed(() => {
  switch (art.value) {
    case 'code':
      return w('wkr.geraet.probe.code', { code: ersterCode.value?.code ?? '' })
    case 'zurueck':
      return w('wkr.geraet.probe.zurueck', { knopf: w('wkr.geraet.zurueck') })
    case 'x':
      return w('wkr.geraet.probe.x', { knopf: w('wkr.geraet.abbrechen') })
    case 'boje':
      return w('wkr.geraet.probe.boje', { halt: ersteBoje.value?.halt.titel ?? '', knopf: ersteBoje.value?.boje.unter || w('wkr.geraet.bojen.beruehrt') })
    case 'zaehler':
      return w('wkr.geraet.probe.bojeZaehler', {
        halt: zaehlerBoje.value?.halt.titel ?? '',
        knopf: zaehlerBoje.value?.boje.unter || w('wkr.geraet.bojen.beruehrt'),
        punkte: 2 * (zaehlerBoje.value?.boje.punkte ?? 0),
      })
    case 'rueckweg':
      return w('wkr.geraet.probe.bojeRueckweg', { knopf: w('wkr.geraet.bojen.rueckweg') })
    default:
      // Nach dem Zähler-Schritt stehen Berührungen im Entwurf – dann heißt der Hauptknopf „Abschicken“.
      if (bojen.value && eintraege(entwurf.value) > 0) return w('wkr.geraet.probe.haupt', { knopf: w('wkr.geraet.probe.bojeAbschicken') })
      return w('wkr.geraet.probe.haupt', {
        knopf: vorsteg.value ? w('wkr.geraet.inOrdnung') : props.teil ? w(props.teil === 'ab' ? 'wkr.geraet.fehlerfrei.ab' : 'wkr.geraet.fehlerfrei.an') : w('wkr.geraet.fehlerfrei'),
      })
  }
})
const start = computed(() => ({ startNr: 'P', titel: w('wkr.geraet.probe.titel') }))
</script>

<template>
  <div class="wkr-probe" :class="{ 'wkr-maske--bojen': bojen }" data-teil="probe" :data-schritt="fertig ? 'fertig' : gesperrt ? 'takt' : art" :data-takt="takt">
    <p class="wkr-band wkr-band--hinweis" data-teil="probe-band">
      <b>{{ w(fertig ? 'wkr.geraet.probe.bandFertig' : 'wkr.geraet.probe.band') }}</b>
      <button v-if="!fertig" type="button" class="wkr-knopf" data-ziel="klein" data-action="probe-ueberspringen" @click="emit('fertig')">{{ w('wkr.geraet.probe.ueberspringen') }}</button>
    </p>

    <template v-if="fertig">
      <section class="wkr-ruhe" role="status" data-teil="probe-fertig">
        <h2>{{ w('wkr.geraet.probe.fertig') }}</h2>
        <p class="wkr-probe-ende" data-teil="probe-ende">{{ w(uebung ? 'wkr.geraet.probe.endeUebung' : 'wkr.geraet.probe.ende') }}</p>
        <button type="button" class="wkr-knopf wkr-knopf--haupt" data-ziel="gross" data-action="probe-fertig" @click="emit('fertig')">{{ w('wkr.geraet.probe.los') }}</button>
        <button type="button" class="wkr-knopf wkr-knopf--klein-text" data-ziel="klein" data-action="probe-wiederholen" @click="wiederhole">{{ w('wkr.geraet.probe.wiederholen') }}</button>
      </section>
    </template>
    <template v-else>
      <p class="wkr-probe-schritt" role="status" data-teil="probe-schritt">
        <template v-if="gesperrt">{{ w('wkr.geraet.probe.warte') }}</template>
        <template v-else>{{ w('wkr.geraet.probe.schritt', { i: schritt + 1, n: schritte.length }) }} {{ anweisung }}</template>
      </p>
      <WkrStarterKarte :start="start" :klasse="aufbau.titel" :gesendet="imOverlay" />
      <div class="wkr-mitte" :inert="gesperrt" data-teil="mitte">
        <WkrVorsteg v-if="vorsteg" :codes="disqCodes" :gesetzt="entwurf.disq" start-nr="P" @setze="setzeDisq" @x-nein="xNein" />
        <WkrBojen v-else-if="bojen" :aufbau="aufbau" :entwurf="entwurf" :weg="weg" @boje="tippeBojeKnopf" @tippe="tippeCode" @weg="waehleWeg" />
        <WkrKnoepfe v-else :teile="teile" :entwurf="entwurf" @tippe="tippeCode" />
      </div>
      <div class="wkr-unten" :inert="gesperrt">
        <WkrFuss
          :art="vorsteg ? 'vorsteg' : bojen ? 'bojen' : 'katalog'"
          :teil="teil"
          :eintraege="eintraege(entwurf)"
          :punkte="punkteVon(entwurf, aufbau, teil)"
          :disq="entwurf.disq"
          :korrektur="null"
          :hand="hand"
          :mit-disq="false"
          :disq-offen="false"
          @zurueck="zurueckTipp"
          @haupt="haupt"
        />
      </div>
    </template>
    <WkrUebertragen v-if="imOverlay" start-nr="P" :takt="takt" :stufe="probeStufe" probe />
    <div v-if="blitz" class="wkr-blitz" data-teil="blitz" aria-hidden="true" />
  </div>
</template>
