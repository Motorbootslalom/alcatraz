<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { parcoursSvg } from '../../lib/parcoursQuelle'
import { WKR_ANNAHMEN } from '../../wkr/annahmen'
import type { Weg } from '../../wkr/bojen'
import { bildWege, bildZahlen, bildZiel, inlineSvg, schiebeAuseinander, svgSeiten, wirksameDrehung, type BildBojeMitHalt, type BildWeg, type BildZuordnung } from '../../wkr/bild'
import { bojenDisqVon, type Entwurf, type MaskenAufbau, type MaskenBoje } from '../../wkr/maske'
import { bojenZelle } from '../../lib/disq'
import WkrDisq from './WkrDisq.vue'
import WkrKnoepfe from './WkrKnoepfe.vue'
import { useLangdruck } from './langdruck'
import { useWkrText } from './texte'

/**
 * Maske „Bild“ (W5.2, Plan docs/plan-wkr-w5.md §5.2, 22.11.2026; WKR_ANNAHMEN BD1–BD10): die Parcours-Zeichnung der
 * Klasse (bzw. im Parallelslalom die eine Bahn ohne Steg aus dem Parcours-Repo, für Racecourse A und B dieselbe – BD3
 * umgebaut 22.11.2026, BD8–BD10 umgebaut 23.11.2026 nach R9-05 bis R9-07, Nutzer: „Nur eine Bahn.“; welcher
 * Racecourse, sagt die Liste: `aria-label` der figure, `data-racecourse`; nur ohne Parallel.svg das Schema), die Bojen
 * der eigenen Liste antippen.
 *
 * - Zeichnung INLINE aus dem gebündelten Klassen-SVG (lib/parcoursQuelle.ts, kein Netz), alle IDs mit eigenem Präfix
 *   (wkr/bild.ts inlineSvg – zwei Bilder nebeneinander stören sich nicht), gedimmt wie auf dem Bogen plus fremde Bojen
 *   blass (nicht antippbar), gedreht wie der WKR am Ufer steht: auf dem Pad `bild.drehung` samt ±90°, auf dem Handy nur
 *   180° (wie WkrParcoursBild – liegend bleibt es breit; BD-Auslegung `bildDrehungNurPad`); ±90° auch auf dem Pad nur,
 *   wenn die gedrehte Zeichnung dadurch nicht kleiner wird (`bildDrehungNachPlatz`, Prüfbefund 22.11.2026), und nie
 *   höher als der freie Platz (CSS max-height über --wkr-bild-rest).
 * - Trefferkreise über den Bojen: Mitte aus der Lage der ID (getBBox/getBoundingClientRect), Größe ≥ bildTrefferMm
 *   (15 CSS-mm) und ≥ --wkr-ziel, zu nahe auseinandergeschoben mit Linie zur echten Boje (BD6, wkr/bild.ts schiebeAuseinander). Ohne Lage
 *   (Test-DOM ohne Layout) dieselben Treffer als Knopfliste `bild-ersatz` – Tests prüfen über `data-feld`.
 * - Ein Tipp ist DIESELBE Boje wie in den Knöpfen (wkr/bild.ts bildZiel → Ereignis `boje` → WkrMaske tippeBoje);
 *   Stand am Kreis: „✔ 5“, Zähler „2×“, Disq. „5 G“ (BZ1) – nie nur Farbe.
 * - Umschalter Hin / Rück / Rück 2 (BD5: Tor 1 der Speedrunde); wechselt nur von Hand wie bei den Knöpfen (BD4
 *   umgebaut 22.11.2026, R8-20 – vorher sprang er nach dem ersten Tipp an Tor 5 auf Rückweg); WkrMaske merkt Hin/Rück
 *   je Start (`weg`), „Rück 2“ merkt WkrMitte je Start (`bildWeg`, Prüfbefund 22.11.2026 – das Bild wird bei offener
 *   Disq.-Wahl neu gebaut).
 * - Disq.: DISQ im Fuß öffnet wie bisher WkrDisqOrt (WkrMitte); hier zusätzlich „Disq. an Boje …“ → der nächste Tipp
 *   ins Bild wählt die Boje, dann der Buchstabe (BD7), und seit 22.11.2026 (R8-23, LD1–LD4) ein langer Druck auf einen
 *   Trefferkreis direkt die Buchstaben DIESER Boje (components/wkr/langdruck.ts; der Tipp zählt beim Loslassen).
 * - Katalog-Teile gemischter Listen (Einfahrt Tor 5, MüB) stehen als Knöpfe unter dem Bild, auf ihrer Seite.
 */
const props = defineProps<{
  aufbau: MaskenAufbau
  entwurf: Entwurf
  zuordnung: BildZuordnung
  /** Titel der Klasse für die Beschriftung. */
  klasse: string
  startNr: string
  /** Seite des Umschalters (je Start gemerkt): Hin/Rück aus WkrMaske, „Rück 2“ aus WkrMitte (Prüfbefund 22.11.2026). */
  weg: BildWeg
  /** Pad: Drehung wie auf dem Bogen, auch ±90°. */
  pad?: boolean
  gesperrt?: boolean
}>()
const emit = defineEmits<{
  boje: [boje: MaskenBoje]
  bojeDisq: [boje: MaskenBoje, code: string | null]
  tippe: [feld: string, code: string]
  weg: [weg: Weg]
  /** Die volle Wahl samt „Rück 2“ – WkrMitte merkt sie über ein Neu-Einhängen hinweg. */
  bildWeg: [weg: BildWeg]
}>()
const { w } = useWkrText()

// Eigener Präfix je Bild: zwei Bilder nebeneinander (Pad, zwei Listen) dürfen keine ID teilen.
const praefix = `wb${Math.random().toString(36).slice(2, 9)}-`

// --- Umschalter ---
const wege = computed(() => bildWege(props.aufbau))
const zustand = ref<BildWeg>(wege.value.includes(props.weg) ? props.weg : props.weg === 'rueck2' ? 'rueck' : props.weg)
const zahlen = computed(() => bildZahlen(props.entwurf, props.aufbau))
function waehleWeg(x: BildWeg): void {
  if (props.gesperrt) return
  zustand.value = x
  emit('weg', x === 'hin' ? 'hin' : 'rueck')
  emit('bildWeg', x)
}
const wegText = (x: BildWeg) => w(x === 'hin' ? 'wkr.geraet.bild.hin' : x === 'rueck' ? 'wkr.geraet.bild.rueck' : 'wkr.geraet.bild.rueck2')

// --- Treffer: je eigene ID die Boje auf der gewählten Seite ---
interface Treffer {
  id: string
  ziel: BildBojeMitHalt
  name: string
  stand: string
}
function standVon(b: MaskenBoje): string {
  const n = props.entwurf.bojen[b.feld] ?? 0
  // Mit Disq. steht der Stand wie die Zelle („5, J, D“, BZ6, 22.11.2026) – kurz genug für den Kreis, gleich in jeder Sprache.
  const d = bojenDisqVon(props.entwurf, b)
  if (d.length > 0) return bojenZelle(n * b.punkte, d)
  if (n === 0) return ''
  return b.zaehler ? w('wkr.geraet.bild.zaehler', { n }) : w('wkr.geraet.bild.schalter', { punkte: n * b.punkte })
}
function nameVon(x: BildBojeMitHalt): string {
  const wegName = wege.value.length > 1 ? w(x.halt.weg === 'hin' ? 'wkr.geraet.bojen.hin' : 'wkr.geraet.bojen.rueck') : ''
  return [x.halt.titel, x.halt.durchfahrt ? w('wkr.geraet.bojen.durchfahrtKurz') : '', wegName, x.boje.unter].filter(Boolean).join(' ')
}
const treffer = computed<Treffer[]>(() =>
  props.zuordnung.ids.flatMap((id) => {
    const ziel = bildZiel(props.aufbau, props.zuordnung, id, zustand.value)
    return ziel ? [{ id, ziel, name: nameVon(ziel), stand: standVon(ziel.boje) }] : []
  }),
)

// --- Disq. an der Boje (BD7) ---
const disqWahl = ref(false)
const disqBoje = ref<Treffer | null>(null)
const mitBojenDisq = computed(() => props.aufbau.abschnitte.some((a) => a.art === 'halt' && a.halt.bojen.some((b) => b.disq.length > 0)))
function tippe(t: Treffer): void {
  if (props.gesperrt) return
  if (disqWahl.value) {
    if (t.ziel.boje.disq.length === 0) return
    disqBoje.value = t
    disqWahl.value = false
    return
  }
  emit('boje', t.ziel.boje)
}
/** Langdruck (LD1, R8-23): die Buchstaben DIESER Boje, ohne Tipp (LD2) – auch aus dem Modus „Disq. an Boje …“. */
function langeAufBoje(t: Treffer): void {
  if (props.gesperrt || t.ziel.boje.disq.length === 0) return
  disqWahl.value = false
  disqBoje.value = t
}
// Schlüssel je Treffer ist die ID: Ein Neuberechnen der Treffer (Stand) während des Drückens bricht nichts ab.
const druck = useLangdruck<Treffer>({
  kurz: tippe,
  lang: langeAufBoje,
  langMoeglich: (t) => t.ziel.boje.disq.length > 0,
  gesperrt: () => !!props.gesperrt,
})
const fuelltId = computed(() => druck.fuellt.value?.id ?? null)
/** Ein Buchstabe an der Boje an bzw. aus – Mehrfachwahl wie WkrDisqOrt (BZ7, 22.11.2026), „Fertig“ schließt. */
function setzeDisq(code: string): void {
  const t = disqBoje.value
  if (!t) return
  emit('bojeDisq', t.ziel.boje, code)
}
const disqDerWahl = computed(() => (disqBoje.value ? bojenDisqVon(props.entwurf, disqBoje.value.ziel.boje) : []))

// --- Katalog-Teile der gewählten Seite (Einfahrt Tor 5 auf Hin, MüB auf Rück) ---
const kataloge = computed(() =>
  props.aufbau.abschnitte.flatMap((a) => (a.art === 'katalog' && a.weg === (zustand.value === 'hin' ? 'hin' : 'rueck') ? [a.teil] : [])),
)

// --- Zeichnung ---
const quelle = computed(() => (props.zuordnung.art === 'svg' && props.zuordnung.bild ? (parcoursSvg(props.zuordnung.bild.datei) ?? '') : ''))
/** Freier Platz der Zeichnung (Breite der Fläche × max-height aus der CSS), gemessen; `null` vor dem ersten Messen. */
const platz = ref<{ breite: number; hoehe: number } | null>(null)
// ±90° nur, wo die gedrehte Zeichnung in den Platz passt (wkr/bild.ts wirksameDrehung, Prüfbefund 22.11.2026).
const drehung = computed(() => wirksameDrehung(props.zuordnung.bild?.drehung ?? 0, { pad: !!props.pad, seiten: svgSeiten(quelle.value), platz: platz.value }))
const svgText = computed(() => {
  const b = props.zuordnung.bild
  if (!b || !quelle.value) return ''
  return inlineSvg(quelle.value, { praefix, drehung: drehung.value, dim: [...b.dim, ...props.zuordnung.blass], aus: b.aus })
})
const schema = computed(() => props.zuordnung.schema)
const punkte = (xs: [number, number][]) => xs.map(([x, y]) => `${x},${y}`).join(' ')

// --- Lage der Treffer (BD6) ---
const flaeche = ref<HTMLElement | null>(null)
interface Lage {
  id: string
  x: number
  y: number
  echtX: number
  echtY: number
}
const lage = ref<Lage[] | null>(null)
/** 15 mm in CSS-px (CSS-mm = 96 dpi, Auslegung bildTrefferMm). */
const trefferPx = (WKR_ANNAHMEN.bildTrefferMm * 96) / 25.4
const pxVon = (x: string) => {
  const n = parseFloat(x)
  return Number.isFinite(n) ? n : 0
}
/** Platz der Zeichnung: Inhaltsbreite der Fläche, Höhe aus der max-height der CSS (sonst Fensterhöhe). */
function messePlatz(f: HTMLElement, rahmen: DOMRect): void {
  if (typeof getComputedStyle !== 'function') return
  const st = getComputedStyle(f)
  const breite = rahmen.width - pxVon(st.paddingLeft) - pxVon(st.paddingRight)
  const svg = f.querySelector('.wkr-bild-svg > svg, svg.wkr-bild-schema')
  const hoehe = (svg ? pxVon(getComputedStyle(svg).maxHeight) : 0) || (typeof window !== 'undefined' ? window.innerHeight : 0)
  const neu = breite > 0 && hoehe > 0 ? { breite, hoehe } : null
  if (neu?.breite !== platz.value?.breite || neu?.hoehe !== platz.value?.hoehe) platz.value = neu
}
function messen(): void {
  const f = flaeche.value
  if (!f) return
  const rahmen = f.getBoundingClientRect()
  messePlatz(f, rahmen)
  const echt: { id: string; x: number; y: number }[] = []
  for (const id of props.zuordnung.ids) {
    const el = f.querySelector(props.zuordnung.art === 'svg' ? `[id="${praefix}${id}"]` : `[data-schema-id="${id}"]`) as (SVGGraphicsElement & Element) | null
    if (!el || typeof el.getBBox !== 'function') return void (lage.value = null)
    const r = el.getBoundingClientRect()
    if (!r.width && !r.height) return void (lage.value = null)
    echt.push({ id, x: r.left - rahmen.left + r.width / 2, y: r.top - rahmen.top + r.height / 2 })
  }
  // Abstand = wirkliche Kreisgröße: nie unter --wkr-ziel (CSS `--wkr-bild-kreis`, Prüfbefund 22.11.2026).
  const ziel = typeof getComputedStyle === 'function' ? pxVon(getComputedStyle(f).getPropertyValue('--wkr-ziel')) : 0
  const geschoben = schiebeAuseinander(echt, Math.max(trefferPx, ziel))
  lage.value = geschoben.map((p, i) => ({ id: p.id, x: p.x, y: p.y, echtX: echt[i].x, echtY: echt[i].y }))
}
const lageVon = (id: string) => lage.value?.find((l) => l.id === id) ?? null
let beobachter: ResizeObserver | null = null
let beobachtet: HTMLElement | null = null
/** Den Beobachter an die aktuelle Fläche hängen (genau eine). */
function beobachte(): void {
  const neu = flaeche.value
  if (!beobachter || neu === beobachtet) return
  if (beobachtet) beobachter.unobserve(beobachtet)
  beobachtet = neu
  if (neu) beobachter.observe(neu)
}
onMounted(() => {
  void nextTick(messen)
  if (typeof ResizeObserver !== 'undefined') beobachter = new ResizeObserver(() => messen())
  beobachte()
})
// Die Fläche steht im v-else zu `disqBoje` – nach „Disq. an Boje …“ ist sie ein NEUES Element (Prüfbefund 22.11.2026):
// der Beobachter zieht mit, sonst blieben die Kreise nach einer Drehung des Pads an den alten Stellen.
watch(flaeche, (neu) => {
  beobachte()
  if (neu) void nextTick(messen)
})
onBeforeUnmount(() => beobachter?.disconnect())
watch([svgText, schema], () => void nextTick(messen))
</script>

<template>
  <div class="wkr-bild" data-teil="bild" :data-art="zuordnung.art" :data-weg="zustand" :data-klasse="klasse">
    <div v-if="mitBojenDisq" class="wkr-bojen-disq" data-teil="bild-disq">
      <button
        v-if="!disqWahl && !disqBoje"
        type="button"
        class="wkr-knopf wkr-knopf--breit"
        data-ziel="klein"
        data-action="bild-disq-modus"
        :disabled="gesperrt"
        @click="disqWahl = true"
      >
        {{ w('wkr.geraet.bojen.disqModus') }}
      </button>
      <p v-else-if="disqWahl" class="wkr-band wkr-band--hinweis wkr-bild-disq-band" role="status" data-teil="bild-disq-tippe">
        <span>{{ w('wkr.geraet.bild.disqTippe', { nr: startNr }) }}</span>
        <button type="button" class="wkr-knopf" data-ziel="klein" data-action="bild-disq-abbrechen" @click="disqWahl = false">{{ w('wkr.geraet.bild.disqAbbrechen') }}</button>
      </p>
    </div>
    <template v-if="disqBoje">
      <button type="button" class="wkr-knopf wkr-knopf--breit" data-ziel="klein" data-action="bild-disq-zurueck" @click="disqBoje = null">
        {{ w('wkr.geraet.bojen.disqOrtZurueck') }}
      </button>
      <p class="wkr-disq-ort-text" data-teil="disq-ort-hint">{{ w('wkr.geraet.bojen.disqHint', { nr: startNr }) }}</p>
      <WkrDisq
        :titel="w('wkr.geraet.bojen.disqTitel', { boje: disqBoje.name })"
        :codes="disqBoje.ziel.boje.disq"
        :gesetzt="disqDerWahl"
        :start-nr="startNr"
        :gesperrt="gesperrt"
        @setze="setzeDisq"
      />
      <button
        type="button"
        class="wkr-knopf wkr-knopf--breit wkr-knopf--haupt wkr-disq-ort-fertig"
        data-ziel="gross"
        data-action="disq-ort-fertig"
        :data-anzahl="disqDerWahl.length"
        @click="disqBoje = null"
      >
        {{ disqDerWahl.length > 0 ? w('wkr.geraet.bojen.disqFertigMit', { codes: disqDerWahl.join(', ') }) : w('wkr.geraet.bojen.disqFertig') }}
      </button>
    </template>
    <template v-else>
      <nav v-if="wege.length > 1" class="wkr-bojen-weg wkr-bild-weg" role="tablist" :aria-label="w('wkr.geraet.bild.weg')" data-teil="bild-weg-umschalter">
        <button
          v-for="x in wege"
          :key="x"
          type="button"
          role="tab"
          class="wkr-knopf wkr-bojen-weg-knopf"
          data-ziel="gross"
          data-action="bild-weg"
          :data-weg="x"
          :data-anzahl="zahlen[x]"
          :aria-selected="zustand === x"
          @click="waehleWeg(x)"
        >
          {{ wegText(x) }} · {{ zahlen[x] }}
        </button>
      </nav>

      <!-- Ohne Überschrift (Nutzer 23.11.2026: „nimmt kostbaren Platz weg“) – der Name steht nur noch für Screenreader. -->
      <figure
        class="wkr-bild-figur"
        :data-disq-wahl="disqWahl || undefined"
        :aria-label="zuordnung.racecourse ? w('wkr.geraet.bild.racecourse', { rc: zuordnung.racecourse }) : w('wkr.geraet.bild', { klasse })"
      >
        <div ref="flaeche" class="wkr-bild-flaeche" data-teil="bild-flaeche" :data-drehung="drehung" :data-racecourse="zuordnung.racecourse">
          <!-- Gebündelte Zeichnung (lib/parcoursQuelle.ts), IDs mit Präfix – kein fremder Inhalt. -->
          <div v-if="svgText" class="wkr-bild-svg" aria-hidden="true" v-html="svgText" />
          <svg v-else-if="schema" class="wkr-bild-svg wkr-bild-schema" :viewBox="`0 0 ${schema.breite} ${schema.hoehe}`" aria-hidden="true" data-teil="bild-schema" :data-racecourse="schema.racecourse">
            <polyline class="wkr-bild-linie" :points="punkte(schema.hin)" />
            <polyline class="wkr-bild-linie wkr-bild-linie--rueck" :points="punkte(schema.rueck)" />
            <g v-for="p in schema.punkte" :key="p.id" :data-schema-id="p.id" :class="{ 'wkr-bild-blass': zuordnung.blass.includes(p.id) }">
              <circle class="wkr-bild-boje" :cx="p.x" :cy="p.y" r="3.5" />
              <text v-if="p.nr" class="wkr-bild-nr" :x="p.x + 6" :y="p.y + 2">{{ p.nr }}</text>
            </g>
            <text class="wkr-bild-nr" :x="schema.breite / 2" :y="schema.hoehe - 2" text-anchor="middle">{{ w('wkr.geraet.bild.startZiel') }}</text>
          </svg>
          <template v-if="lage">
            <svg class="wkr-bild-verbinder" aria-hidden="true">
              <template v-for="l in lage" :key="l.id">
                <line v-if="Math.hypot(l.x - l.echtX, l.y - l.echtY) > 2" :x1="l.echtX" :y1="l.echtY" :x2="l.x" :y2="l.y" />
              </template>
            </svg>
            <button
              v-for="t in treffer"
              :key="t.id"
              type="button"
              class="wkr-knopf wkr-bild-treffer"
              :class="{ 'wkr-bild-treffer--gesetzt': !!t.stand, 'wkr-bild-treffer--disq': !!entwurf.bojenDisq[t.ziel.boje.feld]?.length }"
              data-ziel="gross"
              data-action="bild-boje"
              :data-bild-id="t.id"
              :data-feld="t.ziel.boje.feld"
              :data-anzahl="entwurf.bojen[t.ziel.boje.feld] ?? 0"
              :data-disq="bojenDisqVon(entwurf, t.ziel.boje).join(', ') || undefined"
              :aria-label="[t.name, t.stand].filter(Boolean).join(' · ')"
              :disabled="disqWahl && t.ziel.boje.disq.length === 0"
              :data-langdruck="fuelltId === t.id ? 'fuellt' : undefined"
              :style="{ left: `${lageVon(t.id)?.x ?? 0}px`, top: `${lageVon(t.id)?.y ?? 0}px` }"
              v-on="druck.an(t)"
            >
              <span class="wkr-bild-stand">{{ t.stand }}</span>
            </button>
          </template>
        </div>
      </figure>

      <!-- Ohne Lage der Bojen (kein Layout): dieselben Treffer als Knopfliste in Fahrtfolge (BD6). -->
      <section v-if="!lage" class="wkr-bild-ersatz" data-teil="bild-ersatz">
        <h3 class="wkr-bojen-titel">{{ w('wkr.geraet.bild.ersatz') }}</h3>
        <div class="wkr-bild-ersatz-liste">
          <button
            v-for="t in treffer"
            :key="t.id"
            type="button"
            class="wkr-knopf wkr-bojen-knopf"
            :class="{ 'wkr-bojen-knopf--gesetzt': !!t.stand, 'wkr-bojen-knopf--disq': !!entwurf.bojenDisq[t.ziel.boje.feld]?.length }"
            data-ziel="gross"
            data-action="bild-boje"
            :data-bild-id="t.id"
            :data-feld="t.ziel.boje.feld"
            :data-anzahl="entwurf.bojen[t.ziel.boje.feld] ?? 0"
            :data-disq="bojenDisqVon(entwurf, t.ziel.boje).join(', ') || undefined"
            :disabled="disqWahl && t.ziel.boje.disq.length === 0"
            :data-langdruck="fuelltId === t.id ? 'fuellt' : undefined"
            v-on="druck.an(t)"
          >
            <span class="wkr-bojen-unter">{{ t.name }}</span>
            <span v-if="t.stand" class="wkr-bojen-stand"><span class="wkr-bojen-zahl wkr-bojen-disq-stand" data-teil="bild-stand">{{ t.stand }}</span></span>
          </button>
        </div>
      </section>

      <WkrKnoepfe v-if="kataloge.length > 0" :teile="kataloge" :entwurf="entwurf" @tippe="(f, c) => emit('tippe', f, c)" />
    </template>
  </div>
</template>
