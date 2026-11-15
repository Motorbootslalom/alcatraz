<script setup lang="ts">
import { listenNachname, type NamenArt } from '../../lib/namen'
import { computed } from 'vue'
import { abstaende, type AbstandArt, type ErgebnisGruppe, type LaufZeile } from '../../lib/ergebnis'
import { ergebnisTexte } from '../../lib/ergebnisText'
import { locale, texteIn, type Locale } from '../../i18n'
import type { Starter } from '../../types'
import type { HerkunftAnzeige } from '../../lib/origin'
import HerkunftText from '../HerkunftText.vue'
import { ergebnisFussMm, SEITEN_VORGABE, zeilenDerSeite } from '../../lib/seiten'
import type { SeitenTeil } from '../../lib/seiten'
import ListenDokument from '../ListenDokument.vue'
import ErgebnisFuss from './ErgebnisFuss.vue'

/**
 * Wertungsliste eines Laufs (A4 quer): je Starter die Punkte an jeder Stelle des Fahrwegs –
 * so sieht man im Aushang, an welchem Tor und welcher Boje was passiert ist, nicht nur die
 * Summe. Vorbild: ErgebnisLaufSeite.vue im Fehlerpunkte-Prototyp und die Listen der DM 2026.
 */
const props = defineProps<{
  klasseText: string
  laufText: string
  eventName: string
  gruppen: ErgebnisGruppe[]
  zeilen: LaufZeile[]
  abstand?: AbstandArt
  /** Spalte der Herkunft: Überschrift und Text je Starter; fehlt = keine Spalte. */
  herkunft?: { titel: string; anzeige: (p: Starter) => HerkunftAnzeige; zeichen: number }
  /** Namen: voll, Nachname gekürzt („M.“) oder gar nicht (Aushang – dann steht nur die Startnummer da). */
  namen?: NamenArt
  geburtsdatum?: boolean
  /**
   * Wann sich die Liste zuletzt geändert hat (lib/listenStand.ts), schon als Text. Steht in
   * einem eigenen Feld unter der Tabelle (ErgebnisFuss.vue), auf jeder Seite der Liste und
   * auch im Druck: Hängen zwei Fassungen aus, zeigt er die neuere. Leer = unbekannt, dann
   * steht nichts da.
   */
  stand?: string
  /**
   * Was bei gleichem Ergebnis entschieden hat, in Worten (in der Sprache der Liste). Steht
   * unter der Tabelle jeder Seite, auf der ein Platz per Stichentscheid entstand – dort
   * trägt der Platz ein Sternchen.
   */
  stichText?: string
  /**
   * Unter der Liste stehen die Unterschriftszeile des O.O.D. und das leere Feld für die Uhrzeit
   * des Aushangs (UIM 960, Pkt. 5.2) – nur unter einem Regelwerk, das sie verlangt. Der Fuß ist
   * dann höher; die Seitenteilung rechnet damit (lib/seiten.ts `ergebnisFussMm`).
   */
  unterschrift?: boolean
  /** Sprache der Liste (lib/listensprache.ts); fehlt = die der Oberfläche. */
  sprache?: Locale
}>()

// Alles auf dem Blatt steht in der Sprache der Liste, nicht in der der Oberfläche.
const sprache = () => props.sprache ?? locale.value
const { t, formatDate } = texteIn(sprache)

/** Die Beschriftung der Zeile für Unterschrift und Aushang, in der Sprache der Liste. */
const unterschriftTexte = computed(() => (props.unterschrift ? { wer: t('results.signOod'), aushang: t('results.postingTime') } : undefined))

// Die Liste ist ein Dokument: Sie teilt sich selbst in Seiten und zählt nur die eigenen
// (ListenDokument.vue). Platz, graue Zeile und Abstand hängen an der Stelle in der ganzen
// Liste, nicht an der auf der Seite (lib/seiten.ts `zeilenDerSeite`).
/** Steht auf dieser Seite ein Platz, den der Stichentscheid vergeben hat? */
const mitStich = (teile: readonly SeitenTeil[]) => zeilenDerSeite(props.zeilen, teile).some(({ z }) => z.stich)
const { abstandTitel, abstandZelle, punkteZelle, sekundenText, spaltenText, zeitText } = ergebnisTexte(sprache)

const zweizeilig = computed(() => props.gruppen.some((g) => g.mitUnter))
const kopfZeilen = computed(() => (zweizeilig.value ? 2 : 1))
const blaetter = computed(() => props.gruppen.flatMap((g) => g.blaetter.map((b, bi) => ({ erste: bi === 0, label: b.label }))))
// Platz, S-Nr., Name, Vorname, Zeit, Punkte + Fahrweg + disq., ges. Punkte, Fehler-Schlüssel
/** Für den Aushang lässt sich der Nachname auf den Anfangsbuchstaben kürzen. */
const nachname = (p: Starter) => listenNachname(p, props.namen)

const spaltenZahl = computed(() => 9 - (props.namen === 'ohne' ? 2 : 0) + (props.herkunft ? 1 : 0) + (props.geburtsdatum ? 1 : 0) + (props.abstand ? 1 : 0) + blaetter.value.length)
// Der Abstand hängt nur von den Punkten ab, nicht von der Reihenfolge der Liste.
const abstandWerte = computed(() => (props.abstand ? abstaende(props.zeilen, props.abstand) : []))

// Die Bojen-Spalten teilen sich, was die festen Spalten übrig lassen. Bei Klasse 7 sind das
// rund 30 Spalten: Eine breite Herkunft-Spalte (ausgeschriebener Vereinsname) drückte sie so
// schmal, dass „20“ abgeschnitten wurde – im Aushang fehlte genau die Angabe, an welcher Boje
// wie viele Punkte entstanden sind. Deshalb haben die Bojen Vorrang: Die Herkunft bekommt
// nur, was darüber hinaus frei ist, und wird sonst kleiner gesetzt.
/** Breite der Tabelle und der festen Spalten in mm – wie in styles/ergebnis.css (`.erg-w-*`). */
const BREITE = 281
/** Name und Vorname; sie entfallen im Aushang „ohne Namen“. */
const NAMEN = 22 + 18.5
const FEST = 9.5 + 9 + NAMEN + 12.5 + 10.5 + 8 + 11.5 + 14.5
const GEB = 14
const ABSTAND = 13
const EINZEL = 8
/** So breit muss eine Bojen-Spalte mindestens sein, damit zwei Ziffern hineinpassen. */
const BOJE_MIN = 4
const HERKUNFT_MIN = 11
const bojenSpalten = computed(() => props.gruppen.reduce((n, g) => n + (g.mitUnter ? g.blaetter.length : 0), 0))
/** Was nach den festen Spalten bleibt: für Herkunft und Bojen. */
const frei = computed(
  () => BREITE - FEST + (props.namen === 'ohne' ? NAMEN : 0) - (props.geburtsdatum ? GEB : 0) - (props.abstand ? ABSTAND : 0) - EINZEL * props.gruppen.filter((g) => !g.mitUnter).length,
)
/**
 * Breite eines Zeichens in mm bei 7,5 pt, breite Buchstaben eingerechnet – dasselbe Maß wie
 * auf der Gesamtliste (dort 1,65 mm bei 8,5 pt). Mit 1,2 und später 1,37 mm war zu knapp
 * geschätzt: Ein langer Vereinsname stand unverkleinert da und war am Zellenrand um wenige
 * Pixel abgeschnitten.
 */
const ZEICHEN_MM = 1.46
// Breite der Herkunft-Spalte in mm: für Kürzel schmal, für ausgeschriebene Namen breiter.
// Die Überschrift zählt mit: Über einer Spalte voller Kürzel stand sonst „Bundeslar“.
const herkunftMm = computed(() => {
  const wunsch = Math.min(30, Math.max(Math.ceil(titelMm.value * TITEL_KLEINER), Math.round((props.herkunft?.zeichen ?? 0) * ZEICHEN_MM + 3)))
  return Math.max(HERKUNFT_MIN, Math.min(wunsch, Math.floor(frei.value - BOJE_MIN * bojenSpalten.value)))
})
/** Breite eines Zeichens der Überschrift in mm (8,5 pt fett; gemessen an „Bundesland“: 17,7 mm). */
const TITEL_ZEICHEN_MM = 1.8
/**
 * Für die Überschrift allein wird die Spalte nur bis hierhin breiter (Anteil der vollen Breite) –
 * den Rest gleicht eine kleinere Schrift aus. Die Bojen-Spalten brauchen den Platz nötiger.
 */
const TITEL_KLEINER = 0.8
/** So breit braucht die Überschrift der Herkunft in voller Größe. */
const titelMm = computed(() => (props.herkunft?.titel.length ?? 0) * TITEL_ZEICHEN_MM + 1.5)
/** Ist die Spalte schmaler als die Überschrift, wird diese kleiner gesetzt statt abgeschnitten. */
const titelStil = computed(() => (herkunftMm.value < titelMm.value ? { fontSize: `${(8.5 * Math.max(0.5, (herkunftMm.value - 1.5) / (titelMm.value - 1.5))).toFixed(1)}pt` } : undefined))
/**
 * Kleiner setzen nach der tatsächlichen Breite der Spalte, wie auf der Gesamtliste: `normal`
 * Zeichen passen in voller Größe. Reicht auch die kleinste Stufe nicht, steht der Text
 * zweizeilig – abgeschnitten wäre er nicht zu erkennen.
 */
const fitBreite = (text: string, mm: number) => {
  const normal = Math.floor((mm - 1.5) / ZEICHEN_MM)
  return text.length <= normal ? undefined : text.length <= normal / 0.85 ? 'fit-1' : text.length <= normal / 0.7 ? 'fit-2' : 'erg-zweizeilig'
}
const fitHerkunft = (text: string) => fitBreite(text, herkunftMm.value)
/** Name und Vorname haben feste Spalten (styles/ergebnis.css `.erg-w-name`, `.erg-w-vorname`). */
const fitName = (text: string) => fitBreite(text, 22)
const fitVorname = (text: string) => fitBreite(text, 18.5)
const bojeMm = computed(() => (bojenSpalten.value > 0 ? (frei.value - (props.herkunft ? herkunftMm.value : 0)) / bojenSpalten.value : EINZEL))
/** Kurze Zellen (Fahrweg, Fehler-Schlüssel) werden kleiner gesetzt statt umbrochen. */
const fit = (text: string, normal: number) => (text.length > normal * 1.4 ? 'fit-2' : text.length > normal ? 'fit-1' : undefined)
/**
 * Zellen des Fahrwegs: In schmalen Spalten stehen schon zwei Ziffern („20“) kleiner; mehr als
 * drei Zeichen („20, G“ – Punkte und Disqualifikation an derselben Boje) stehen zweizeilig.
 */
const fitZelle = (text: string) => (bojeMm.value < 5 ? (text.length > 3 ? 'erg-zweizeilig' : text.length > 2 ? 'fit-2' : text.length > 1 ? 'fit-1' : undefined) : fit(text, 2))
/**
 * Kopf einer Spalte ohne Unterspalten (8 mm): Die englischen Kürzel der Steg-Spalten („Leav.“,
 * „Moor.“ nach Regel 960, Pkt. 4.1 und 4.1.1) sind ein Wort und brechen nicht um – in voller
 * Größe stand der Punkt über dem Rand (gemessen: „Moor.“ 32 px in 29 px). Sie stehen deshalb
 * kleiner. Die deutschen Köpfe („Steg AB“) brechen um und bleiben, wie sie sind.
 */
const kopfKlasse = (label: string) => {
  const text = spaltenText(label)
  return text !== label && !/\s/.test(text) && text.length > 4 ? 'erg-kopf-eng' : undefined
}
</script>

<template>
  <ListenDokument
    class="ergebnis-blatt"
    data-art="lauf"
    :data-boje-mm="bojeMm.toFixed(2)"
    :laengen="[zeilen.length]"
    format="landscape"
    :vorgabe="SEITEN_VORGABE.ergebnisLauf"
    :sprache="sprache()"
    :fuss-mm="ergebnisFussMm(unterschrift)"
  >
    <template #fuss="{ teile, seitenzahl }">
      <ErgebnisFuss :stand="stand" :stand-label="t('results.changed')" :stich="mitStich(teile) ? stichText : ''" :seitenzahl="seitenzahl" :unterschrift="unterschriftTexte" />
    </template>
    <template #default="{ teile }">
    <table class="erg-tabelle">
      <colgroup>
        <col class="erg-w-platz" />
        <col class="erg-w-nr" />
        <col v-if="namen !== 'ohne'" class="erg-w-name" />
        <col v-if="namen !== 'ohne'" class="erg-w-vorname" />
        <col v-if="herkunft" class="erg-w-herkunft" :style="{ width: `${herkunftMm}mm` }" />
        <col v-if="geburtsdatum" class="erg-w-geb" />
        <col class="erg-w-zeit" />
        <col class="erg-w-punkte" />
        <template v-for="(g, gi) in gruppen" :key="gi">
          <col v-for="bi in g.blaetter.length" :key="bi" :class="g.mitUnter ? undefined : 'erg-w-spalte'" />
        </template>
        <col class="erg-w-disq" />
        <col class="erg-w-ges" />
        <col v-if="props.abstand" class="erg-w-abstand" />
        <col class="erg-w-schluessel" />
      </colgroup>
      <thead>
        <tr>
          <th class="erg-kopfzelle" :colspan="spaltenZahl">
            <div class="erg-kopf">
              <span class="erg-kopf-klasse">{{ klasseText }}</span>
              <span class="erg-kopf-titel">{{ laufText }}</span>
              <span class="erg-kopf-event">{{ eventName }}</span>
            </div>
          </th>
        </tr>
        <tr class="erg-spaltenkopf">
          <th :rowspan="kopfZeilen">{{ t('results.place') }}</th>
          <th :rowspan="kopfZeilen">{{ t('common.startNr') }}</th>
          <th v-if="namen !== 'ohne'" :rowspan="kopfZeilen">{{ t('common.lastName') }}</th>
          <th v-if="namen !== 'ohne'" :rowspan="kopfZeilen">{{ t('common.firstName') }}</th>
          <th v-if="herkunft" :rowspan="kopfZeilen" :style="titelStil">{{ herkunft.titel }}</th>
          <th v-if="geburtsdatum" :rowspan="kopfZeilen">{{ t('common.birthdate') }}</th>
          <th :rowspan="kopfZeilen">{{ t('results.time') }}</th>
          <th :rowspan="kopfZeilen">{{ t('results.timeValue') }}</th>
          <template v-for="(g, gi) in gruppen" :key="gi">
            <th v-if="g.mitUnter" :colspan="g.blaetter.length" class="erg-gruppe">{{ spaltenText(g.label) }}</th>
            <th v-else :rowspan="kopfZeilen" :class="['erg-gruppe', kopfKlasse(g.label)]">{{ spaltenText(g.label) }}</th>
          </template>
          <th :rowspan="kopfZeilen" class="erg-gruppe">{{ t('results.dsq') }}</th>
          <th :rowspan="kopfZeilen">{{ t('results.total') }}</th>
          <th v-if="props.abstand" :rowspan="kopfZeilen">
            {{ t('results.gap') }}<br /><small>{{ abstandTitel(props.abstand) }}</small>
          </th>
          <th :rowspan="kopfZeilen">{{ t('results.key') }}</th>
        </tr>
        <tr v-if="zweizeilig" class="erg-unterkopf">
          <template v-for="(g, gi) in gruppen" :key="gi">
            <template v-if="g.mitUnter">
              <th v-for="(b, bi) in g.blaetter" :key="bi" :class="bi === 0 ? 'erg-gruppe' : undefined">{{ b.label }}</th>
            </template>
          </template>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="{ z, i } in zeilenDerSeite(zeilen, teile)"
          :key="z.starter.id"
          :class="(i + 1) % 5 === 0 ? 'grau' : undefined"
          :data-starter="z.starter.id"
          :data-wertung="z.disq ? 'disq' : z.offen ? 'offen' : 'gewertet'"
          :data-stich="z.stich ? '' : undefined"
        >
          <!-- Das Sternchen sagt: Diesen Platz hat der Stichentscheid vergeben (Erklärung unter der Tabelle). -->
          <td class="erg-platz">{{ z.platz }}<span v-if="z.stich" class="erg-stich-zeichen">*</span></td>
          <td>{{ z.starter.startNr }}</td>
          <td v-if="namen !== 'ohne'" :class="fitName(nachname(z.starter))">{{ nachname(z.starter) }}</td>
          <td v-if="namen !== 'ohne'" :class="fitVorname(z.starter.vorname)">{{ z.starter.vorname }}</td>
          <td v-if="herkunft" :class="fitHerkunft(herkunft.anzeige(z.starter).mass)"><HerkunftText :anzeige="herkunft.anzeige(z.starter)" /></td>
          <td v-if="geburtsdatum">{{ z.starter.geburtsdatum ? formatDate(z.starter.geburtsdatum) : '' }}</td>
          <!-- „Nicht gestartet“ (X) steht ausgeschrieben da, wo sonst die Zeit stünde: Es ist eine
               Disqualifikation, aber eine, die jeder ohne Schlüssel verstehen soll. -->
          <td v-if="z.nichtGestartet && z.zeit === null" colspan="2" class="erg-dns">{{ t('results.dns') }}</td>
          <template v-else>
            <td>{{ zeitText(z.zeit) }}</td>
            <td>{{ sekundenText(z.zeit) }}</td>
          </template>
          <td v-for="(b, bi) in blaetter" :key="bi" :class="[{ 'erg-gruppe': b.erste }, fitZelle(z.zellen[bi])]">{{ z.zellen[bi] }}</td>
          <td class="erg-gruppe">{{ z.disq ? 'x' : '' }}</td>
          <td :class="{ 'erg-disq': z.disq }">{{ punkteZelle(z.disq, z.gesamt) }}</td>
          <td v-if="props.abstand">{{ abstandZelle(abstandWerte[i]) }}</td>
          <td :class="fit(z.schluessel, 9)">{{ z.schluessel }}</td>
        </tr>
      </tbody>
    </table>
    </template>
  </ListenDokument>
</template>
