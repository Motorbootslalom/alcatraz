<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { Blick } from '../config/schema'
import {
  AUFGABEN_FELDER,
  BILD_BOJEN,
  BLICKE,
  bojenAufLinie,
  feldUmschalten,
  spaltenFarbe,
  zeitnahmeId,
  ZEITNAHMEN,
  zuordnen,
  type Befund,
  type Entwurf,
  type Punkt,
  type Spalte,
} from '../lib/assistent'
import { BLICK_NAME, feldName, ZEITNAHME_NAME } from '../lib/assistentTexte'
import { ohneRahmen } from '../lib/parcoursbild'
import ParcoursNachweis from './ParcoursNachweis.vue'
import { t } from '../i18n'

/**
 * Zuordnen im Parcoursbild (Vorbild: ZuordnungImBild.vue im Fehlerpunkte-Prototyp,
 * KONZEPT-NAMEN-FREIHAND.md §2): Eine Freihandlinie um oder über Bojen gibt sie der
 * gewählten Position, ein Klick auf eine Boje schaltet sie an oder aus. Dasselbe
 * Datenmodell wie die Tabelle: Beide ändern den Entwurf.
 *
 * `bild` ist die Zeichnung als SVG-Text (lib/parcoursQuelle.ts) – nichts wird geladen.
 * Sie steht eingebettet in der Seite, damit die Bojen über ihre IDs messbar sind.
 */
const props = defineProps<{
  entwurf: Entwurf
  befund: Befund
  bild: string
  /** Das Regelwerk bietet Englisch an: je Position ein freiwilliger englischer Titel. */
  mitEnglisch?: boolean
}>()
const emit = defineEmits<{ 'update:entwurf': [Entwurf]; spalteDazu: []; spalteWeg: [string] }>()

/** Abstand in Bildeinheiten (Bild 853 breit), in dem eine Linie eine Boje noch trifft. */
const TOLERANZ = 14
/** Kürzer als das ist keine Linie, sondern ein Klick. */
const KLICK = 6

// ---- Gewählte Position -------------------------------------------------------------------
// Zuerst eine Position, die Bojen beobachten kann: nicht die reine Zeitliste.
const aktiv = ref((props.entwurf.spalten.find((s) => !s.zeiten) ?? props.entwurf.spalten[0])?.id ?? '')
const aktiveSpalte = computed(() => props.entwurf.spalten.find((s) => s.id === aktiv.value))
watch(
  () => props.entwurf.spalten.map((s) => s.id),
  (neu, alt) => {
    // Eine neue Position gleich wählen; eine entfernte durch die erste ersetzen.
    const dazu = neu.find((id) => !alt?.includes(id))
    if (dazu) aktiv.value = dazu
    else if (!neu.includes(aktiv.value)) aktiv.value = neu[0] ?? ''
  },
)
const farbe = (spalte: string) => spaltenFarbe(props.entwurf, spalte)
const titel = (s: Spalte | undefined) => s?.titel.trim() || t('assist.img.unnamed')

// ---- Das Bild: eingebettet, damit die Bojen über ihre IDs erreichbar sind -----------------
const rahmen = ref<HTMLDivElement>()
const ueberlage = ref<SVGSVGElement>()
const masse = ref({ w: 853, h: 361 })
const mitten = ref<Record<string, Punkt>>({})
const gemessen = ref(false)

/** Quellbild ohne Rahmen, in der Breite des Rahmens und ohne eigene Maus-Ereignisse. */
function vorbereiten(text: string): { svg: string; w: number; h: number } | undefined {
  if (!text) return undefined
  const el = new DOMParser().parseFromString(ohneRahmen(text), 'image/svg+xml').documentElement
  if (el.nodeName !== 'svg') return undefined
  const w = parseFloat(el.getAttribute('width') ?? '') || 853
  const h = parseFloat(el.getAttribute('height') ?? '') || 361
  if (!el.getAttribute('viewBox')) el.setAttribute('viewBox', `0 0 ${w} ${h}`)
  el.setAttribute('width', '100%')
  el.removeAttribute('height')
  el.removeAttribute('id')
  el.setAttribute('class', 'zib-parcours')
  // Für Vorleseprogramme ist die Überlage das Bild; die Zeichnung darunter wäre nur Lärm.
  el.setAttribute('aria-hidden', 'true')
  return { svg: new XMLSerializer().serializeToString(el), w, h }
}

const zeichnung = computed(() => vorbereiten(props.bild))

/** Mittelpunkte der Bojen in Koordinaten der Überlage; fehlt eine im Bild, bleibt sie weg. */
function messen() {
  const r = rahmen.value
  const ctm = ueberlage.value?.getScreenCTM?.()
  if (!r || !ctm) return
  const inv = ctm.inverse()
  const neu: Record<string, Punkt> = {}
  for (const id of BILD_BOJEN) {
    const el = r.querySelector(`.zib-parcours [id="${id}"]`)
    // Speedbojen sind Gruppen mit Fähnchen: gemessen wird nur die Tonne selbst.
    const tonne = el?.tagName === 'g' ? (el.querySelector(':scope > path, :scope > circle, :scope > ellipse') ?? el) : el
    const box = tonne?.getBoundingClientRect()
    if (!box || (box.width === 0 && box.height === 0)) continue
    const p = new DOMPoint(box.x + box.width / 2, box.y + box.height / 2).matrixTransform(inv)
    neu[id] = { x: p.x, y: p.y }
  }
  mitten.value = neu
  gemessen.value = Object.keys(neu).length > 0
}

watch(
  zeichnung,
  async (z) => {
    gemessen.value = false
    mitten.value = {}
    if (z) masse.value = { w: z.w, h: z.h }
    await nextTick()
    requestAnimationFrame(messen)
  },
  { immediate: true },
)
// Ändert sich die Breite, bleiben die Bildkoordinaten gleich; erst sichtbar gemessen stimmt alles.
let beobachter: ResizeObserver | undefined
onMounted(() => {
  if (typeof ResizeObserver === 'undefined' || !rahmen.value) return
  beobachter = new ResizeObserver(() => {
    if (zeichnung.value && !gemessen.value) messen()
  })
  beobachter.observe(rahmen.value)
})
onBeforeUnmount(() => beobachter?.disconnect())

/** Bojen, die das Bild nicht zeigt (die untere Speedboje bei manchen Kursen): Sie werden angehakt. */
const fehlenImBild = computed(() => (gemessen.value ? BILD_BOJEN.filter((f) => !mitten.value[f]) : []))

// ---- Ändern, mit Rückgängig --------------------------------------------------------------
// Der Verlauf gilt für das, was hier im Bild geschieht, und lebt mit dieser Ansicht: Nach
// einem Abstecher in die Tabelle beginnt er neu – ein älterer Stand überschriebe sonst
// stillschweigend, was dort inzwischen geändert wurde.
/** Ein Stand vor einer Änderung; `entfernt` nennt die Position, die mit ihr entfernt wurde. */
interface Schritt {
  zuordnung: Entwurf['zuordnung']
  entfernt?: { spalte: Spalte; stelle: number }
}
const verlauf = ref<Schritt[]>([])
const merken = (schritt: Schritt) => (verlauf.value = [...verlauf.value.slice(-49), schritt])

function aendern(neu: Entwurf) {
  if (neu === props.entwurf) return
  merken({ zuordnung: props.entwurf.zuordnung })
  emit('update:entwurf', neu)
}

/** Entfernt die gewählte Position – als Schritt, den „Rückgängig“ samt ihren Bojen zurückholt. */
function entfernen() {
  const stelle = props.entwurf.spalten.findIndex((s) => s.id === aktiv.value)
  if (stelle < 0) return
  // Eine Kopie: Die Tabelle ändert Positionen am Platz.
  merken({ zuordnung: props.entwurf.zuordnung, entfernt: { spalte: { ...props.entwurf.spalten[stelle] }, stelle } })
  emit('spalteWeg', aktiv.value)
}

function rueckgaengig() {
  const vorher = verlauf.value.at(-1)
  if (!vorher) return
  verlauf.value = verlauf.value.slice(0, -1)
  const { entfernt } = vorher
  const spalten =
    entfernt && !props.entwurf.spalten.some((s) => s.id === entfernt.spalte.id)
      ? [...props.entwurf.spalten.slice(0, entfernt.stelle), entfernt.spalte, ...props.entwurf.spalten.slice(entfernt.stelle)]
      : props.entwurf.spalten
  emit('update:entwurf', { ...props.entwurf, spalten, zuordnung: vorher.zuordnung })
}

function umschalten(feld: string) {
  if (aktiv.value) aendern(feldUmschalten(props.entwurf, feld, aktiv.value))
}

// ---- Zeichnen ----------------------------------------------------------------------------
const linie = ref<Punkt[]>([])
const letzte = ref<Punkt[]>([])
let zeichnet = false
/** Der Zeiger, der die Linie zieht: Ein zweiter Finger oder der Handballen darf sie weder fortsetzen noch beenden. */
let zeiger: number | undefined
let ausblenden: ReturnType<typeof setTimeout> | undefined

function punkt(e: PointerEvent): Punkt | undefined {
  const ctm = ueberlage.value?.getScreenCTM()
  if (!ctm) return undefined
  const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(ctm.inverse())
  return { x: p.x, y: p.y }
}

function runter(e: PointerEvent) {
  const p = punkt(e)
  if (!p || !aktiv.value || e.button !== 0) return
  // Auch außerhalb des Bildes weiterzeichnen; ein zweiter Finger beginnt keine zweite Linie.
  if (zeichnet) return
  ueberlage.value?.setPointerCapture(e.pointerId)
  zeiger = e.pointerId
  zeichnet = true
  linie.value = [p]
}

function bewegen(e: PointerEvent) {
  if (!zeichnet || e.pointerId !== zeiger) return
  const p = punkt(e)
  const vorher = linie.value.at(-1)
  if (p && vorher && Math.hypot(p.x - vorher.x, p.y - vorher.y) >= 2) linie.value = [...linie.value, p]
}

function laenge(l: Punkt[]): number {
  let n = 0
  for (let i = 1; i < l.length; i++) n += Math.hypot(l[i].x - l[i - 1].x, l[i].y - l[i - 1].y)
  return n
}

function hoch(e: PointerEvent) {
  if (!zeichnet || e.pointerId !== zeiger) return
  zeichnet = false
  zeiger = undefined
  const l = linie.value
  linie.value = []
  if (laenge(l) < KLICK) {
    // Ein Klick: die nächste Boje in Reichweite an- oder abschalten.
    const p = l[0]
    const naechste = Object.entries(mitten.value)
      .map(([id, m]) => ({ id, d: Math.hypot(m.x - p.x, m.y - p.y) }))
      .filter((x) => x.d <= TOLERANZ + 4)
      .sort((a, b) => a.d - b.d)[0]
    if (naechste) umschalten(naechste.id)
    return
  }
  aendern(zuordnen(props.entwurf, bojenAufLinie(mitten.value, l, TOLERANZ), aktiv.value))
  letzte.value = l
  clearTimeout(ausblenden)
  ausblenden = setTimeout(() => (letzte.value = []), 900)
}
onBeforeUnmount(() => clearTimeout(ausblenden))

const pfad = (l: Punkt[]) => l.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')

// ---- Markierungen an den Bojen -----------------------------------------------------------
const marken = computed(() => {
  const ids = new Set(props.entwurf.spalten.map((s) => s.id))
  return Object.entries(mitten.value).map(([feld, m]) => {
    const spalten = (props.entwurf.zuordnung[feld] ?? []).filter((s) => ids.has(s))
    const namen = spalten.map((s) => titel(props.entwurf.spalten.find((x) => x.id === s)))
    return {
      feld,
      m,
      spalten,
      fehlt: props.befund.fehlt.includes(feld),
      doppelt: props.befund.doppelt.includes(feld),
      aktiv: spalten.includes(aktiv.value),
      tipp: t('assist.img.buoy', { name: feldName(feld), positions: namen.length > 0 ? namen.join(', ') : t('assist.img.buoyNone') }),
    }
  })
})

const beobachtet = computed(() => BILD_BOJEN.filter((f) => props.entwurf.zuordnung[f]?.includes(aktiv.value)).map(feldName))

// ---- Einstellungen der gewählten Position ------------------------------------------------
function spalteAendern(f: (s: Spalte) => Spalte) {
  emit('update:entwurf', { ...props.entwurf, spalten: props.entwurf.spalten.map((s) => (s.id === aktiv.value ? f(s) : s)) })
}

function titelSetzen(neu: string) {
  spalteAendern((s) => ({ ...s, titel: neu }))
}

function titelEnSetzen(neu: string) {
  spalteAendern(({ titelEn: _alt, ...s }) => (neu ? { ...s, titelEn: neu } : s))
}

function blickSetzen(blick: string) {
  spalteAendern(({ blick: _alt, ...s }) => (blick ? { ...s, blick: blick as Blick } : s))
}

function zeitnahmeSetzen(id: string) {
  const z = ZEITNAHMEN.find((x) => x.id === id)
  spalteAendern(({ zeiten: _alt, ...s }) => (z?.zeiten ? { ...s, zeiten: [...z.zeiten] } : s))
}

function bildKleinSetzen(an: boolean) {
  spalteAendern(({ bildNeben: _alt, ...s }) => (an ? { ...s, bildNeben: true } : s))
}

const hatFeld = (id: string) => !!props.entwurf.zuordnung[id]?.includes(aktiv.value)
</script>

<template>
  <div class="zib">
    <div class="zib-leiste" role="group" :aria-label="t('assist.img.drawFor')">
      <span class="zib-label" aria-hidden="true">{{ t('assist.img.drawFor') }}</span>
      <button
        v-for="s in entwurf.spalten"
        :key="s.id"
        type="button"
        class="btn sm zib-spalte"
        :class="{ aktiv: s.id === aktiv, leer: befund.leer.includes(s.id) }"
        :style="{ '--farbe': farbe(s.id) }"
        :aria-pressed="s.id === aktiv"
        @click="aktiv = s.id"
      >
        <span class="zib-punkt" aria-hidden="true"></span>{{ titel(s) }}
      </button>
      <button type="button" class="btn sm" @click="emit('spalteDazu')">{{ t('assist.addPosition') }}</button>
      <button type="button" class="btn sm zib-zurueck" :disabled="verlauf.length === 0" :title="t('assist.img.undoTitle')" @click="rueckgaengig">
        {{ t('assist.img.undo') }}
      </button>
    </div>

    <p v-if="entwurf.spalten.length === 0" class="boat-banner warn" role="status">{{ t('assist.img.noPosition') }}</p>
    <p v-if="!zeichnung" class="boat-banner warn" role="status">{{ t('assist.img.missing') }}</p>

    <div v-else ref="rahmen" class="zib-bild" :class="{ gesperrt: !aktiv }">
      <!-- eslint-disable-next-line vue/no-v-html -- eigene Zeichnung aus src/assets/parcours, beim Bauen eingebunden -->
      <div class="zib-quelle" v-html="zeichnung.svg"></div>
      <svg
        ref="ueberlage"
        class="zib-ueberlage"
        :viewBox="`0 0 ${masse.w} ${masse.h}`"
        preserveAspectRatio="xMidYMid meet"
        role="group"
        :aria-label="aktiveSpalte ? t('assist.img.label', { position: titel(aktiveSpalte) }) : t('assist.img.labelNone')"
        @pointerdown="runter"
        @pointermove="bewegen"
        @pointerup="hoch"
        @pointercancel="hoch"
        @contextmenu.prevent
      >
        <!-- Jede Boje ist auch ohne Zeiger erreichbar: Tab, dann Leertaste oder Enter. -->
        <g
          v-for="k in marken"
          :key="k.feld"
          class="zib-marke"
          role="button"
          :tabindex="aktiv ? 0 : -1"
          :aria-pressed="k.aktiv"
          :aria-label="k.tipp"
          @keydown.enter.prevent="umschalten(k.feld)"
          @keydown.space.prevent="umschalten(k.feld)"
        >
          <title>{{ k.tipp }}</title>
          <circle :cx="k.m.x" :cy="k.m.y" r="16" class="zib-fokus" />
          <circle v-if="k.doppelt" :cx="k.m.x" :cy="k.m.y" r="10" class="zib-doppelt" />
          <circle v-if="k.aktiv" :cx="k.m.x" :cy="k.m.y" r="10" :fill="farbe(aktiv)" fill-opacity="0.3" />
          <circle v-if="k.fehlt" :cx="k.m.x" :cy="k.m.y" r="12" class="zib-fehlt" />
          <circle
            v-for="(s, i) in k.spalten"
            :key="s"
            :cx="k.m.x"
            :cy="k.m.y"
            :r="11 + 4 * i"
            fill="none"
            :stroke="farbe(s)"
            :stroke-width="s === aktiv ? 3.5 : 2.5"
          />
        </g>
        <polygon v-if="letzte.length > 2" :points="pfad(letzte)" class="zib-linie zib-linie-fertig" :style="{ '--farbe': farbe(aktiv) }" />
        <polyline v-if="linie.length > 1" :points="pfad(linie)" class="zib-linie" :style="{ '--farbe': farbe(aktiv) }" />
      </svg>
    </div>
    <p class="note zib-hilfe">{{ t('assist.img.help') }}</p>
    <ParcoursNachweis v-if="zeichnung" />
    <p v-if="fehlenImBild.length > 0 && aktiv" class="zib-nicht-im-bild">
      {{ t('assist.img.notInImage') }}
      <label v-for="f in fehlenImBild" :key="f" class="boat-check">
        <input type="checkbox" :checked="hatFeld(f)" @change="umschalten(f)" />
        {{ feldName(f) }}
      </label>
    </p>

    <div v-if="aktiveSpalte" class="zib-einstellungen" :style="{ '--farbe': farbe(aktiveSpalte.id) }">
      <div class="row">
        <div class="field">
          <label for="zib-titel">{{ t('assist.positionName') }}</label>
          <input
            id="zib-titel"
            class="input"
            :value="aktiveSpalte.titel"
            :placeholder="t('assist.positionName')"
            @input="titelSetzen(($event.target as HTMLInputElement).value)"
          />
        </div>
        <div v-if="mitEnglisch" class="field">
          <label for="zib-titel-en">{{ t('assist.positionNameEn') }}</label>
          <input
            id="zib-titel-en"
            class="input"
            lang="en"
            :value="aktiveSpalte.titelEn ?? ''"
            :title="t('assist.positionNameEnTitle')"
            @input="titelEnSetzen(($event.target as HTMLInputElement).value)"
          />
        </div>
        <div class="field">
          <label for="zib-blick">{{ t('assist.view.label') }}</label>
          <select
            id="zib-blick"
            class="input"
            :value="aktiveSpalte.blick ?? ''"
            :title="t('assist.viewTitle')"
            @change="blickSetzen(($event.target as HTMLSelectElement).value)"
          >
            <option v-for="b in BLICKE" :key="b.id" :value="b.id">{{ t(BLICK_NAME[b.id]) }}</option>
          </select>
        </div>
        <div class="field">
          <label for="zib-zeit">{{ t('assist.timing.label') }}</label>
          <select
            id="zib-zeit"
            class="input"
            :value="zeitnahmeId(aktiveSpalte.zeiten)"
            :title="t('assist.timing.title')"
            @change="zeitnahmeSetzen(($event.target as HTMLSelectElement).value)"
          >
            <option v-for="z in ZEITNAHMEN" :key="z.id" :value="z.id">{{ t(ZEITNAHME_NAME[z.id]) }}</option>
          </select>
        </div>
        <fieldset class="field zib-aufgaben">
          <legend>{{ t('assist.tasks') }}</legend>
          <div class="assistent-bausteine">
            <label v-for="a in AUFGABEN_FELDER" :key="a.id" class="boat-check">
              <input type="checkbox" :checked="hatFeld(a.id)" @change="umschalten(a.id)" /> {{ feldName(a.id) }}
            </label>
            <label class="boat-check" :title="t('assist.smallImageTitle')">
              <input type="checkbox" :checked="!!aktiveSpalte.bildNeben" @change="bildKleinSetzen(($event.target as HTMLInputElement).checked)" />
              {{ t('assist.smallImage') }}
            </label>
          </div>
        </fieldset>
        <button type="button" class="btn sm danger" @click="entfernen">{{ t('assist.removePositionLong') }}</button>
      </div>
      <p class="note zib-hilfe" role="status">
        {{ t('assist.img.observed', { names: beobachtet.length > 0 ? beobachtet.join(', ') : t('assist.img.observedNone') }) }}
      </p>
    </div>
  </div>
</template>
