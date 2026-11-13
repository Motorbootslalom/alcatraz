<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { hasDescription, type BogenBlattSpalte, type BogenSeite } from '../../lib/bogen'
import { PRINT_MARGIN_MM, PX_PER_MM, overflowRows, pageHeightMm as pageHeightOf } from '../../lib/paging'
import { tn } from '../../i18n'
import { nachweisZeile } from '../../lib/parcoursNachweis'
import type { Column, TrennerDesign } from '../../types'
import BogenBild from './BogenBild.vue'
import BogenKopf from './BogenKopf.vue'
import BogenLegende from './BogenLegende.vue'

/**
 * Eine Druckseite eines Wettkampfrichter-Bogens. Vorbild: SheetPage.vue im
 * Fehlerpunkte-Prototyp; gezeichnet wird das reine Modell aus lib/bogen.ts.
 *
 * Noch ohne Eingabe: Die Zellen sind leer (bzw. zeigen, was das Modell über `anzeige`
 * mitbringt). Die Erfassung setzt später Felder in dieselben Zellen – Zeilenschlüssel und
 * Spalte stehen dafür schon als `data-`Attribute da.
 */
const props = defineProps<{
  seite: BogenSeite
  /** Beschreibung (Legende, Bild) auf der Rückseite statt im Fuß. */
  rueckseite?: boolean
  /** Kennzeichen quer über dem Blatt, z. B. „Beispielansicht“. Solche Blätter werden nie gedruckt. */
  kennzeichen?: string
  wkrPflege?: boolean
  wkrLabel?: string
}>()
const emit = defineEmits<{
  wkr: [name: string]
  /** Gemessene Höhe von Kopf/Fuß und Zeilenhöhe der ersten Seite, in ungezoomten CSS-Pixeln. */
  layout: [mass: { fixedPx: number; rowPx: number }]
}>()

const def = computed(() => props.seite.def)
const gedreht = computed(() => Math.abs(props.seite.bild?.drehung ?? 0) === 90)
// Gesamtspaltenzahl für die Kopf-/Fußzellen über die volle Breite.
const totalCols = computed(() => 1 + (props.seite.zeigtKlasse ? 1 : 0) + props.seite.leaves.length)
// Die Klassen-Spalte nennt den Namen der Klasse; für lange Namen („Dolphin“) ist sie breiter.
const klasseBreit = computed(() => props.seite.klassen.some((k) => props.seite.texte.klasseName(k).length > 3))
// Die Zeichnungen stehen unter CC BY-NC-SA: Wo ein Bild gedruckt wird, steht auch die Namensnennung.
const nachweis = computed(() => (props.seite.bild && !props.rueckseite ? nachweisZeile() : undefined))
const bildAlt = computed(() => `${props.seite.titel} – ${props.seite.klassenText}`)

const trennerClass = (trenner?: TrennerDesign) => (trenner ? ` sep-${trenner}` : '')
const trennerClassR = (trenner?: TrennerDesign) => (trenner ? ` sepr-${trenner}` : '')

/** Spaltenbreite fürs <colgroup>; ohne Angabe teilen sich die Spalten den Rest. */
function leafWidth(leaf: BogenBlattSpalte): string | undefined {
  if (leaf.kind === 'sum') return leaf.einzeln ? '18mm' : '12mm'
  if (leaf.kind === 'disq') return '16mm'
  if (leaf.grow) return `${leaf.grow * 12}%`
  return undefined
}

const hatSub = (col: Column) => !!col.sub && col.sub.length > 0
const headTopClass = (col: Column) => (hatSub(col) ? `bt-gruppe${trennerClass(col.trenner)}` : `bt-${col.kind}${trennerClass(col.trenner)}`)
const subCellClass = (col: Column, i: number) =>
  `bt-sub${trennerClass(i === 0 ? col.trenner : col.subTrenner)}${i < col.sub!.length - 1 ? trennerClassR(col.subTrenner) : ''}`
const leafKey = (leaf: BogenBlattSpalte) => (leaf.subIndex === undefined ? leaf.colKey : `${leaf.colKey}#${leaf.subIndex}`)
const leafSep = (leaf: BogenBlattSpalte) => trennerClass(leaf.trenner) + trennerClassR(leaf.trennerR)

// Passt die Seite auf ein A4-Blatt? Das Blatt am Bildschirm hat dieselben Maße wie die
// Druckseite (A4, 8 mm Rand); ist der Inhalt höher, bricht der Druck um. Das zeigt die
// Ansicht mit Hinweis und Seitenende-Linie (nur am Bildschirm). Die erste Seite meldet
// außerdem Kopf-/Fußhöhe und Zeilenhöhe – daraus ergibt sich die automatische Aufteilung.
const blattEl = ref<HTMLElement | null>(null)
const zuViele = ref(0)
// Höhe des Blatts in echten Pixeln: Die verkleinerte Ansicht (bogen.css, `transform`) zieht
// damit den Platz ab, den das Blatt nach dem Verkleinern nicht mehr braucht.
const hoehe = ref(0)
const pageHeightMm = computed(() => pageHeightOf(props.seite.orientation))

function messen() {
  const blatt = blattEl.value
  const table = blatt?.querySelector<HTMLTableElement>('.bogen-tabelle')
  const rows = table?.tBodies[0]?.rows
  if (!blatt || !table || !rows || rows.length === 0) return
  hoehe.value = blatt.offsetHeight
  // In schmalen Fenstern ist das Blatt verkleinert – mit `transform`, nicht mit `zoom`: Das
  // Layout bleibt dann in den Maßen der Druckseite, und nur das fertige Bild wird skaliert.
  // (Unter `zoom` rundet der Browser Rahmen und Zeilen je Faktor anders; die Aufteilung hing
  // so von der Fensterbreite ab.) Die Rechtecke hier sind skaliert, der Faktor exakt.
  const sollBreite = (props.seite.orientation === 'landscape' ? 297 : 210) * PX_PER_MM
  const faktor = blatt.getBoundingClientRect().width / sollBreite
  if (!(faktor > 0)) return // ohne Layout (z. B. Test-DOM) nichts messen
  const contentPx = table.getBoundingClientRect().height / faktor
  const rowPx = (rows[rows.length - 1].getBoundingClientRect().bottom - rows[0].getBoundingClientRect().top) / rows.length / faktor
  if (contentPx <= 0 || rowPx <= 0) return
  zuViele.value = overflowRows(contentPx, pageHeightMm.value, rowPx)
  if (props.seite.pageIndex === 0) emit('layout', { fixedPx: contentPx - rows.length * rowPx, rowPx })
}

let beobachter: ResizeObserver | undefined
onMounted(() => {
  messen()
  const table = blattEl.value?.querySelector('.bogen-tabelle')
  if (typeof ResizeObserver !== 'undefined' && table) {
    beobachter = new ResizeObserver(messen)
    beobachter.observe(table)
    // Auch das Blatt selbst: Seine Höhe kann sich ändern, ohne dass die Tabelle es tut.
    if (blattEl.value) beobachter.observe(blattEl.value)
  }
})
onBeforeUnmount(() => beobachter?.disconnect())
</script>

<template>
  <div
    ref="blattEl"
    :data-seite="seite.pageIndex + 1"
    :data-liste="seite.typeId"
    :data-muster="kennzeichen ? '' : undefined"
    :class="[
      'bogen',
      `bogen--${seite.orientation === 'landscape' ? 'quer' : 'hoch'}`,
      { 'bogen--gedreht': gedreht && !rueckseite, 'bogen--bild-neben': def.bildNeben && !rueckseite },
    ]"
    :style="[def.bildBreite ? { '--bild-breite': `${def.bildBreite}mm` } : undefined, hoehe > 0 ? { '--bogen-hoehe': `${hoehe}px` } : undefined]"
  >
    <template v-if="zuViele > 0">
      <p class="bogen-zuviel">{{ tn('sheet.overflow', zuViele) }}</p>
      <div class="bogen-seitenende" :style="{ top: `${pageHeightMm - PRINT_MARGIN_MM}mm` }" />
    </template>
    <!-- Der Bogen ist EINE Tabelle: <thead>/<tfoot> wiederholen sich beim Druck auf jeder
         Seite, falls eine Seite doch noch umbricht. -->
    <table class="bogen-tabelle">
      <colgroup>
        <col class="bt-cg-nr" />
        <col v-if="seite.zeigtKlasse" :class="['bt-cg-klasse', { 'bt-cg-klasse--breit': klasseBreit }]" />
        <col v-for="leaf in seite.leaves" :key="leafKey(leaf)" :style="{ width: leafWidth(leaf) }" />
      </colgroup>
      <thead>
        <tr>
          <th class="bt-kopfzelle" :colspan="totalCols">
            <BogenKopf :seite="seite" :wkr-pflege="wkrPflege" :wkr-label="wkrLabel" @wkr="emit('wkr', $event)" />
          </th>
        </tr>
        <tr>
          <th class="bt-nr" :rowspan="seite.twoRow ? 2 : 1">{{ seite.texte.nr }}</th>
          <th v-if="seite.zeigtKlasse" class="bt-klasse" :rowspan="seite.twoRow ? 2 : 1">{{ seite.texte.klasseKurz }}</th>
          <template v-for="col in seite.columns" :key="col.key">
            <th v-if="hatSub(col)" :class="headTopClass(col)" :colspan="col.sub!.length">{{ col.label }}</th>
            <th v-else :class="headTopClass(col)" :rowspan="seite.twoRow ? 2 : 1">{{ col.label }}</th>
          </template>
        </tr>
        <tr v-if="seite.twoRow">
          <template v-for="col in seite.columns" :key="col.key">
            <template v-if="hatSub(col)">
              <th v-for="(s, i) in col.sub" :key="`${col.key}-${i}`" :class="subCellClass(col, i)">{{ s }}</th>
            </template>
          </template>
        </tr>
      </thead>
      <tfoot>
        <tr>
          <td class="bt-fusszelle" :colspan="totalCols">
            <div class="bogen-fuss">
              <template v-if="!rueckseite">
                <BogenLegende :def="def" />
                <div v-if="seite.bild" class="bogen-bild"><BogenBild :bild="seite.bild" :alt="bildAlt" /></div>
              </template>
              <!-- Die Beschreibung steht auf der Rückseite (BogenRueckseite.vue). -->
              <div v-else-if="hasDescription(def)" class="bogen-rueckhinweis">
                <svg class="bogen-rueckhinweis-pfeil" viewBox="0 0 24 24" aria-hidden="true">
                  <!-- Blatt mit angehobener unterer Ecke; der Bogen des Pfeils führt von unten über die
                       Oberkante: hochklappen, nicht bloß „nach oben“. Muss ohne den Text verständlich sein. -->
                  <path class="brp-blatt" d="M3 8h12v9l-5 5H3zM10 22v-5h5" />
                  <path class="brp-zeilen" d="M5.5 11.5h7M5.5 14.5h7" />
                  <path d="M17.5 20.5c4-4 4.5-11 0-15-2.5-2.2-6-2.6-9-1.2M12 1.5L8.3 4.4l3.4 3.2" />
                </svg>
                <span>{{ seite.texte.rueckseite }}</span>
              </div>
              <div class="bogen-unterschrift-zeile">
                <span v-if="nachweis" class="bogen-nachweis">{{ nachweis }}</span>
                <span v-if="seite.pageCount > 1" class="bogen-seitenzahl">{{ seite.texte.seite(seite.pageIndex + 1, seite.pageCount) }}</span>
                <div class="bogen-unterschrift">
                  <span class="bu-linie" />
                  <span class="bu-text">{{ seite.texte.unterschrift }}</span>
                </div>
              </div>
            </div>
          </td>
        </tr>
      </tfoot>
      <tbody>
        <template v-for="row in seite.rows" :key="row.key">
        <!-- Zwischenüberschrift einer Klasse auf einer gemeinsamen Liste (Clubmeisterschaft). -->
        <tr v-if="row.zwischen !== undefined" class="bt-zwischen" :data-klasse="row.klasse">
          <th :colspan="totalCols" scope="rowgroup">{{ row.zwischen }}</th>
        </tr>
        <tr v-else :class="row.shaded ? 'grau' : undefined" :data-zeile="row.key">
          <td class="bt-nr">{{ row.nr }}</td>
          <td v-if="seite.zeigtKlasse" class="bt-klasse">{{ row.klasseText ?? '' }}</td>
          <td
            v-for="(leaf, li) in seite.leaves"
            :key="leafKey(leaf)"
            :class="`bt-${leaf.kind}-zelle${leafSep(leaf)}${row.cells[li].gilt ? '' : ' bt-entfaellt'}`"
            :data-spalte="leafKey(leaf)"
          >
            {{ row.cells[li].display }}
          </td>
        </tr>
        </template>
      </tbody>
    </table>
    <!-- Nach der Tabelle, damit es über ihr liegt; für Vorleseprogramme steht es im Rahmen der Ansicht. -->
    <div v-if="kennzeichen" class="bogen-kennzeichen" aria-hidden="true"><span>{{ kennzeichen }}</span></div>
  </div>
</template>
