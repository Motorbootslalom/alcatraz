<script setup lang="ts">
import { computed } from 'vue'
import { locale, texteIn, type Locale } from '../../i18n'
import type { ClassId } from '../../types'
import type { PlaetzeWertung } from '../../lib/pokal'
import { ERGEBNIS_FUSS_MM, SEITEN_VORGABE, zeilenDerSeite } from '../../lib/seiten'
import type { HerkunftAnzeige } from '../../lib/origin'
import HerkunftText from '../HerkunftText.vue'
import ListenDokument from '../ListenDokument.vue'
import ErgebnisFuss from '../ergebnis/ErgebnisFuss.vue'

/**
 * Pokalauswertung nach Plätzen (A4 quer), Varianten „Plätze 1–3“ und „Plätze 1–6“: je
 * Herkunft eine Zeile mit ihrem Platz, der Summe und – je Klasse – den Punkten, die sie für
 * Platz 1, 2, 3 … dieser Klasse bekommen hat. Vorbild: Blatt „Mannschaftswertung_Ausgabe“ der
 * Excel-Mappe der DM 2026 (Platz, Verein, Gesamt, je Klasse sechs schmale Spalten „1.“ bis
 * „6.“); die blaue Farbe ist nicht übernommen – das Blatt folgt den anderen Listen.
 */
const props = defineProps<{
  wertung: PlaetzeWertung
  /** Punkte für Platz 1, 2, 3 … – stehen im Kopf, damit das Blatt für sich verständlich ist. */
  punkte: readonly number[]
  eventName: string
  /** Überschrift der Spalte Herkunft („Verein“, „Bundesland“, „Land“). */
  herkunftTitel: string
  /** Herkunft, wie sie auf dem Blatt steht: ausgeschrieben, als Kürzel, mit Flagge (lib/origin.ts). */
  herkunftAnzeige: (herkunft: string) => HerkunftAnzeige
  klasseText: (klasse: ClassId) => string
  /** Eine Klasse ohne Endergebnis im Hinweis zum Zwischenstand – kurz, mit der Zahl ihrer gewerteten Läufe („1: 1/2“). */
  offenText?: (klasse: ClassId) => string
  /** „Letzte Änderung“, schon als Text; leer = unbekannt. */
  stand?: string
  sprache?: Locale
}>()

const sprache = () => props.sprache ?? locale.value
const { t } = texteIn(sprache)

/** Breite der Tabelle in mm – wie `.erg-tabelle` (styles/ergebnis.css). */
const BREITE = 279.8
const PLATZ = 11
const GESAMT = 15
/**
 * Eine Punkte-Spalte: mindestens so breit, dass zwei Ziffern in voller Größe hineinpassen.
 * Stehen dreistellige Punkte auf dem Blatt (eigene Punkte bis 999, oder zwei Starter einer
 * Herkunft auf demselben Platz), bekommt sie mehr – auf Kosten der Herkunft, deren Name dann
 * eher umbricht: Punkte in 5 pt wären am Aushang kaum zu lesen, ein zweizeiliger Name schon.
 * Bei acht Klassen mit sechs Plätzen bleiben der Herkunft damit noch rund 30 mm.
 */
const ZELLE_MIN = 4.2
const ZELLE_MIN_DREI = 4.65
const ZELLE_MAX = 9
/** Breite eines Zeichens in mm bei 8,5 pt (wie auf der Gesamtliste gemessen). */
const ZEICHEN_MM = 1.65
const HERKUNFT_MIN = 30
const dreistellig = computed(() => props.wertung.zeilen.some((z) => z.punkte.some((klasse) => klasse.some((p) => p >= 100))))
const spalten = computed(() => props.wertung.klassen.length * props.wertung.plaetze)
const zeichen = computed(() => Math.max(0, ...props.wertung.zeilen.map((z) => props.herkunftAnzeige(z.herkunft).mass.length)))
// Die Herkunft bekommt, was ihr längster Name braucht (in Grenzen); den Rest teilen sich die
// Punkte-Spalten. Werden die zu schmal, gibt die Herkunft nach – ihr Name steht dann
// zweizeilig (er bricht um, abgeschnitten wird nichts; die Zeile wird höher, und die
// Seitenteilung misst das).
const zelleMm = computed(() => {
  const wunsch = Math.min(95, Math.max(30, zeichen.value * ZEICHEN_MM + 4))
  if (spalten.value === 0) return ZELLE_MAX
  // Die Herkunft behält mindestens HERKUNFT_MIN – bei sehr vielen Spalten geht das vor.
  const hoechstens = (BREITE - PLATZ - GESAMT - HERKUNFT_MIN) / spalten.value
  const mindestens = Math.min(dreistellig.value ? ZELLE_MIN_DREI : ZELLE_MIN, Math.max(ZELLE_MIN, hoechstens))
  return Math.max(mindestens, Math.min(ZELLE_MAX, (BREITE - PLATZ - GESAMT - wunsch) / spalten.value))
})
/** In schmalen Spalten stehen dreistellige Punkte eine Stufe kleiner, vierstellige (zwei Starter auf einem Platz) zwei. */
const fitZelle = (text: string) => {
  const platz = (zelleMm.value - 0.6) / 1.5
  return text.length <= platz ? undefined : text.length <= platz / 0.85 ? 'fit-1' : 'fit-2'
}
const zwischenstand = computed(() =>
  props.wertung.offen.length > 0 ? t('cup.interimNote', { classes: props.wertung.offen.map((k) => (props.offenText ?? props.klasseText)(k)).join(', ') }) : '',
)
const regelText = computed(() => t('cup.places.rule', { n: props.wertung.plaetze, points: props.punkte.join(' · ') }))
</script>

<template>
  <ListenDokument
    class="ergebnis-blatt pokal-blatt"
    data-art="pokal-plaetze"
    :data-zelle-mm="zelleMm.toFixed(2)"
    :laengen="[wertung.zeilen.length]"
    format="landscape"
    :vorgabe="SEITEN_VORGABE.pokalPlaetze"
    :sprache="sprache()"
    :fuss-mm="ERGEBNIS_FUSS_MM"
  >
    <template #fuss="{ seitenzahl }">
      <ErgebnisFuss :stand="stand" :stand-label="t('results.changed')" :hinweis="zwischenstand" :seitenzahl="seitenzahl" />
    </template>
    <template #default="{ teile }">
      <table class="erg-tabelle erg-tabelle--gesamt pokal-tabelle">
        <colgroup>
          <col :style="{ width: `${PLATZ}mm` }" />
          <col />
          <col :style="{ width: `${GESAMT}mm` }" />
          <col v-for="n in spalten" :key="n" :style="{ width: `${zelleMm}mm` }" />
        </colgroup>
        <thead>
          <tr>
            <th class="erg-kopfzelle" :colspan="3 + spalten">
              <div class="erg-kopf pokal-kopf">
                <span>{{ t('cup.sheet.title') }}<template v-if="zwischenstand"> – {{ t('cup.interim') }}</template></span>
                <span class="erg-kopf-titel pokal-kopf-regel">{{ regelText }}</span>
                <span class="erg-kopf-event">{{ eventName }}</span>
              </div>
            </th>
          </tr>
          <tr class="erg-spaltenkopf">
            <th rowspan="2">{{ t('results.place') }}</th>
            <th rowspan="2">{{ herkunftTitel }}</th>
            <th rowspan="2">{{ t('results.overall') }}</th>
            <th v-for="k in wertung.klassen" :key="k" :colspan="wertung.plaetze" class="erg-gruppe">{{ klasseText(k) }}</th>
          </tr>
          <tr class="erg-unterkopf erg-unterkopf--gesamt pokal-unterkopf">
            <template v-for="k in wertung.klassen" :key="k">
              <th v-for="n in wertung.plaetze" :key="n" :class="n === 1 ? 'erg-gruppe' : undefined">{{ n }}.</th>
            </template>
          </tr>
        </thead>
        <tbody>
          <tr v-for="{ z, i } in zeilenDerSeite(wertung.zeilen, teile)" :key="z.herkunft" :class="(i + 1) % 5 === 0 ? 'grau' : undefined" :data-herkunft="z.herkunft">
            <td class="erg-platz">{{ z.platz }}</td>
            <td class="pokal-herkunft"><HerkunftText :anzeige="herkunftAnzeige(z.herkunft)" /></td>
            <td class="pokal-summe">{{ z.gesamt }}</td>
            <template v-for="(klasse, ki) in z.punkte" :key="ki">
              <!-- Leer statt 0: Die wenigen belegten Plätze sollen ins Auge fallen. -->
              <td v-for="(p, pi) in klasse" :key="pi" :class="[pi === 0 ? 'erg-gruppe' : undefined, 'pokal-punkt', fitZelle(String(p))]">{{ p || '' }}</td>
            </template>
          </tr>
        </tbody>
      </table>
    </template>
  </ListenDokument>
</template>
