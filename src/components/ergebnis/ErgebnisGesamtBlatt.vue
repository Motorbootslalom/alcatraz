<script setup lang="ts">
import { listenNachname, type NamenArt } from '../../lib/namen'
import { computed } from 'vue'
import { abstaende, type AbstandArt, type GesamtZeile } from '../../lib/ergebnis'
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
 * Gesamtliste einer Klasse (A4 quer): alle Läufe nebeneinander, die gestrichenen
 * durchgestrichen, dazu die Knoten (wenn der Aufbau sie hat). Vorbild:
 * ErgebnisGesamtSeite.vue im Fehlerpunkte-Prototyp.
 */
const props = defineProps<{
  klasseText: string
  eventName: string
  laeufe: number[]
  zeilen: GesamtZeile[]
  mitKnoten: boolean
  /**
   * Die Spalte „UIM points“ hinter dem Gesamtergebnis (UIM 960, Pkt. 5.2.1) – nur unter einem
   * Regelwerk, das sie verlangt. `werte`: die Punkte je Starter-ID (lib/pokal.ts
   * `gesamtPunkte`); `null`, solange die Klasse nicht vollständig ist – dann steht die Spalte
   * leer da. Fehlt die Angabe, gibt es die Spalte nicht. `titel`: eine andere Überschrift – im
   * Ergebnis einer Runde, deren Disziplin der O.O.D. für die Klasse nicht wertet, stehen dort nur
   * noch Vermerke wie „Qualified“ (ParallelErgebnisStapel.vue).
   */
  punkte?: { werte: ReadonlyMap<string, number | string> | null; titel?: string }
  /**
   * Das Ergebnis einer Runde des Parallelslaloms statt der Gesamtliste des Manövrierens (UIM
   * 960, Pkt. 5.2.2: „1st attempt times, 1st att. penalties, 1st att. times including
   * penalties, 2nd attempt times, 2nd penalties, 2nd attempt times including penalties, 1st and
   * 2nd attempts combined times including penalties, ranking, UIM points“). Dann gilt:
   *   • `titel` steht im Kopf statt „Gesamt“, `event` statt des Namens der Veranstaltung allein;
   *   • die Läufe heißen `laufTitel(n)` („1st attempt“);
   *   • je Lauf steht statt des Platzes im Lauf der Racecourse (`racecourse`: Starter-ID → Lauf
   *     → A/B, aus dem Plan) – einen Platz je Attempt nennt die Regel nicht;
   *   • es gibt EINE Summe (keine Knoten, also kein Zwischenergebnis davor);
   *   • die Spalte `punkte` ist breiter: Dort steht auch „Qualified“ oder „Re-run“.
   * Fehlt die Angabe, ist das Blatt die Gesamtliste wie immer.
   */
  runde?: { titel: string; laufTitel: (lauf: number) => string; racecourse: ReadonlyMap<string, Readonly<Record<number, string>>> }
  abstand?: AbstandArt
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
   * Ein Hinweis ohne Zeichen unter der Tabelle jeder Seite – im Ergebnis einer Runde des
   * Parallelslaloms, deren Plätze eine Wiederholung mitbestimmt hat (UIM 960, Pkt. 5.2.6).
   * Fehlt = keiner (Gesamtliste des Manövrierens).
   */
  fussHinweis?: string
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
const { abstandTitel, abstandZelle, punkteZelle, zeitText } = ergebnisTexte(sprache)

/** Für den Aushang lässt sich der Nachname auf den Anfangsbuchstaben kürzen. */
const nachname = (p: Starter) => listenNachname(p, props.namen)

const spaltenZahl = computed(
  () =>
    (props.runde ? 5 : 6) -
    (props.namen === 'ohne' ? 2 : 0) +
    (props.mitKnoten ? 1 : 0) +
    (props.punkte ? 1 : 0) +
    (props.herkunft ? 1 : 0) +
    (props.geburtsdatum ? 1 : 0) +
    (props.abstand ? 1 : 0) +
    props.laeufe.length * 4,
)
const abstandWerte = computed(() => (props.abstand ? abstaende(props.zeilen, props.abstand) : []))
const gestrichen = (z: GesamtZeile, li: number) => z.gestrichen.includes(props.laeufe[li])

// Name und Vorname teilen sich, was die festen Spalten übrig lassen (`width: auto`). Bei drei
// Läufen und ausgeschriebener Herkunft blieben ihnen sonst nur 17 mm: „Schumacher B“ stand
// abgeschnitten da, ohne kleiner gesetzt zu werden. Deshalb haben die Namen Vorrang vor der
// Herkunft, und kleiner gesetzt wird nach der tatsächlichen Breite der Spalte.
/** Breite der Tabelle und der festen Spalten in mm – wie in styles/ergebnis.css (`.erg-w-*`, `.erg-tabelle--gesamt`). */
const BREITE = 279.8
const LAUF = 14 + 10 + 13 + 9.5
/** So breit sollen Name und Vorname mindestens je sein, solange die Herkunft dafür nachgeben kann. */
/** Breite der Spalte „UIM points“ – wie `.erg-w-uim` in styles/ergebnis.css; im Ergebnis einer Runde breiter („Qualified“). */
const UIM_MM = 12
const UIM_RUNDE_MM = 18
/** Breite der Spalte „Racecourse“ je Lauf im Ergebnis einer Runde (statt des Platzes im Lauf, 9,5 mm). */
const RACECOURSE_MM = 19
/** Breite der einen Summe im Ergebnis einer Runde: Die Überschrift „Combined time“ braucht mehr als die 14 mm von „Gesamt“. */
const SUMME_RUNDE_MM = 18
const uimMm = computed(() => (props.runde ? UIM_RUNDE_MM : UIM_MM))
const NAME_MIN = 22
const HERKUNFT_MIN = 14
/**
 * Breite eines Zeichens in mm bei 8,5 pt, breite Buchstaben eingerechnet. In Chromium gemessen:
 * „Schumacher B“ braucht rund 20 mm, „MYWSC Schwielochsee e.V.“ rund 39 mm.
 */
const ZEICHEN_MM = 1.65
/** Was nach den festen Spalten bleibt: für Name, Vorname und Herkunft. */
const frei = computed(
  () =>
    BREITE -
    9.5 -
    9 -
    (props.geburtsdatum ? 18 : 0) -
    props.laeufe.length * (LAUF + (props.runde ? RACECOURSE_MM - 9.5 : 0)) -
    (props.runde ? SUMME_RUNDE_MM : 2 * 14) -
    (props.mitKnoten ? 12 : 0) -
    (props.punkte ? uimMm.value : 0) -
    (props.abstand ? 13 : 0),
)
const herkunftWunsch = computed(() => Math.min(48, Math.max(20, Math.round((props.herkunft?.zeichen ?? 0) * ZEICHEN_MM + 3))))
// Breite der Herkunft-Spalte in mm: für Kürzel schmal, für ausgeschriebene Namen breiter –
// aber nur so breit, dass den Namen ihre Mindestbreite bleibt.
const herkunftMm = computed(() =>
  props.namen === 'ohne' ? herkunftWunsch.value : Math.max(HERKUNFT_MIN, Math.min(herkunftWunsch.value, Math.floor(frei.value - 2 * NAME_MIN))),
)
/** Breite der Spalten Name und Vorname in mm: Sie teilen sich den Rest gleich. */
const nameMm = computed(() => (frei.value - (props.herkunft ? herkunftMm.value : 0)) / 2)
/**
 * Kleiner setzen nach dem Platz: `normal` Zeichen passen in voller Größe. Reicht auch die
 * kleinste Stufe nicht, steht der Text zweizeilig – abgeschnitten wäre er nicht zu erkennen.
 */
const fit = (text: string, normal: number) =>
  text.length <= normal ? undefined : text.length <= normal / 0.85 ? 'fit-1' : text.length <= normal / 0.7 ? 'fit-2' : 'erg-zweizeilig'
const fitName = (text: string) => fit(text, Math.floor((nameMm.value - 1) / ZEICHEN_MM))
const fitHerkunft = (text: string) => fit(text, Math.floor((herkunftMm.value - 2) / ZEICHEN_MM))
</script>

<template>
  <ListenDokument
    class="ergebnis-blatt"
    data-art="gesamt"
    :data-runde="runde ? '' : undefined"
    :laengen="[zeilen.length]"
    format="landscape"
    :vorgabe="SEITEN_VORGABE.ergebnisGesamt"
    :sprache="sprache()"
    :fuss-mm="ergebnisFussMm(unterschrift)"
  >
    <template #fuss="{ teile, seitenzahl }">
      <ErgebnisFuss :stand="stand" :stand-label="t('results.changed')" :stich="mitStich(teile) ? stichText : ''" :hinweis="fussHinweis" :seitenzahl="seitenzahl" :unterschrift="unterschriftTexte" />
    </template>
    <template #default="{ teile }">
    <table class="erg-tabelle erg-tabelle--gesamt">
      <colgroup>
        <col class="erg-w-platz" />
        <col class="erg-w-nr" />
        <col v-if="namen !== 'ohne'" class="erg-w-name" />
        <col v-if="namen !== 'ohne'" class="erg-w-vorname" />
        <col v-if="herkunft" class="erg-w-herkunft" :style="{ width: `${herkunftMm}mm` }" />
        <col v-if="geburtsdatum" class="erg-w-geb" />
        <template v-for="l in laeufe" :key="l">
          <col v-if="runde" :style="{ width: `${RACECOURSE_MM}mm` }" />
          <col class="erg-w-zeit" />
          <col class="erg-w-strafp" />
          <col class="erg-w-ges" />
          <col v-if="!runde" class="erg-w-platz" />
        </template>
        <col v-if="!runde" class="erg-w-ergebnis" />
        <col v-if="mitKnoten" class="erg-w-knoten" />
        <col class="erg-w-ergebnis" :style="runde ? { width: `${SUMME_RUNDE_MM}mm` } : undefined" />
        <col v-if="punkte" class="erg-w-uim" :style="runde ? { width: `${UIM_RUNDE_MM}mm` } : undefined" />
        <col v-if="props.abstand" class="erg-w-abstand" />
      </colgroup>
      <thead>
        <tr>
          <th class="erg-kopfzelle" :colspan="spaltenZahl">
            <div :class="['erg-kopf', { 'erg-kopf--runde': runde }]">
              <span class="erg-kopf-klasse">{{ klasseText }}</span>
              <span class="erg-kopf-titel">{{ runde ? runde.titel : t('results.overall') }}</span>
              <span class="erg-kopf-event">{{ eventName }}</span>
            </div>
          </th>
        </tr>
        <tr class="erg-spaltenkopf">
          <th rowspan="2">{{ t('results.place') }}</th>
          <th rowspan="2">{{ t('common.startNr') }}</th>
          <th v-if="namen !== 'ohne'" rowspan="2">{{ t('common.lastName') }}</th>
          <th v-if="namen !== 'ohne'" rowspan="2">{{ t('common.firstName') }}</th>
          <th v-if="herkunft" rowspan="2">{{ herkunft.titel }}</th>
          <th v-if="geburtsdatum" rowspan="2">{{ t('common.birthdate') }}</th>
          <th v-for="l in laeufe" :key="l" colspan="4" class="erg-gruppe">{{ runde ? runde.laufTitel(l) : t('lists.wkr.runN', { n: l }) }}</th>
          <th v-if="!runde" rowspan="2" class="erg-gruppe">{{ t('results.result') }}</th>
          <th v-if="mitKnoten" rowspan="2">{{ t('results.knots') }}</th>
          <th rowspan="2" :class="{ 'erg-gruppe': runde }" :data-spalte="runde ? 'summe' : undefined">{{ runde ? t('parallel.results.combined') : t('results.bestInclKnots') }}</th>
          <th v-if="punkte" rowspan="2" data-spalte="uim-punkte">{{ punkte.titel ?? t('results.uimPoints') }}</th>
          <th v-if="props.abstand" rowspan="2">
            {{ t('results.gap') }}<br /><small>{{ abstandTitel(props.abstand) }}</small>
          </th>
        </tr>
        <tr class="erg-unterkopf erg-unterkopf--gesamt">
          <template v-for="l in laeufe" :key="l">
            <th v-if="runde" class="erg-gruppe" data-spalte="racecourse">{{ t('parallel.lists.racecourse') }}</th>
            <th :class="{ 'erg-gruppe': !runde }">{{ t('results.runTime') }}</th>
            <th>{{ t('results.penalty') }}</th>
            <th>{{ t('results.sum') }}</th>
            <th v-if="!runde">{{ t('results.place') }}</th>
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
          <td v-if="namen !== 'ohne'" :class="fitName(z.starter.vorname)">{{ z.starter.vorname }}</td>
          <td v-if="herkunft" :class="fitHerkunft(herkunft.anzeige(z.starter).mass)"><HerkunftText :anzeige="herkunft.anzeige(z.starter)" /></td>
          <td v-if="geburtsdatum">{{ z.starter.geburtsdatum ? formatDate(z.starter.geburtsdatum) : '' }}</td>
          <template v-for="(l, li) in z.laeufe" :key="li">
            <td v-if="runde" class="erg-gruppe" data-spalte="racecourse">{{ runde.racecourse.get(z.starter.id)?.[laeufe[li]] ?? '' }}</td>
            <!-- „Nicht gestartet“ (X) ausgeschrieben statt „disq.“: gewertet wird der Lauf wie jede Disqualifikation. -->
            <td v-if="l.nichtGestartet && l.zeit === null" colspan="3" :class="[{ 'erg-gruppe': !runde }, 'erg-disq', 'erg-dns', { 'erg-gestrichen': gestrichen(z, li) }]">{{ t('results.dns') }}</td>
            <template v-else>
              <td :class="[{ 'erg-gruppe': !runde }, { 'erg-gestrichen': gestrichen(z, li) }]">{{ zeitText(l.zeit) }}</td>
              <td :class="{ 'erg-gestrichen': gestrichen(z, li) }">{{ l.strafpunkte || '' }}</td>
              <td :class="{ 'erg-gestrichen': gestrichen(z, li), 'erg-disq': l.disq }">{{ punkteZelle(l.disq, l.gesamt) }}</td>
            </template>
            <td v-if="!runde">{{ l.platz }}</td>
          </template>
          <td v-if="!runde" :class="['erg-gruppe', { 'erg-disq': z.disq }]">{{ punkteZelle(z.disq, z.ergebnis) }}</td>
          <td v-if="mitKnoten">{{ z.knoten || '' }}</td>
          <td :class="{ 'erg-gruppe': runde, 'erg-disq': z.disq }" :data-spalte="runde ? 'summe' : undefined">{{ punkteZelle(z.disq, z.gesamt) }}</td>
          <!-- Leer, solange die Klasse nicht vollständig ist: Vorläufige Punkte gehören nicht auf den Aushang. -->
          <td v-if="punkte" data-spalte="uim-punkte">{{ punkte.werte?.get(z.starter.id) ?? '' }}</td>
          <td v-if="props.abstand">{{ abstandZelle(abstandWerte[i]) }}</td>
        </tr>
      </tbody>
    </table>
    </template>
  </ListenDokument>
</template>
