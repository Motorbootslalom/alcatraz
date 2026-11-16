<script setup lang="ts">
import { computed } from 'vue'
import KopfLogos from '../KopfLogos.vue'
import { listenNachname, type NamenArt } from '../../lib/namen'
import type { ErgebnisGruppe } from '../../lib/ergebnis'
import type { AttemptTabelle, AttemptZeile } from '../../lib/parallelErgebnis'
import { ergebnisTexte } from '../../lib/ergebnisText'
import { locale, texteIn, type Locale } from '../../i18n'
import type { Starter } from '../../types'
import type { HerkunftAnzeige } from '../../lib/origin'
import HerkunftText from '../HerkunftText.vue'
import { ergebnisFussMm, SEITEN_VORGABE } from '../../lib/seiten'
import type { SeitenTeil } from '../../lib/seiten'
import ListenDokument from '../ListenDokument.vue'
import ErgebnisFuss from './ErgebnisFuss.vue'

/**
 * Die Liste der Attempts einer Klasse in einer Runde des Parallelslaloms (A4 quer): zwei
 * Tabellen auf einem Blatt – „1st attempt“ und „2nd attempt“ mit der Spalte Racecourse, oder
 * (Ansicht „nach Racecourse“) „Racecourse A“ und „Racecourse B“ mit der Spalte Attempt. Je
 * Fahrt stehen die Strafsekunden an jeder Stelle des Fahrwegs, wie auf der Wertungsliste eines
 * Laufs im Manövrieren (ErgebnisLaufBlatt.vue).
 *
 * Regel 960, Pkt. 5.2.2 verlangt für jede Runde „1st attempt times, 1st att. penalties, 1st
 * att. times including penalties, 2nd attempt times, 2nd penalties, 2nd attempt times including
 * penalties“ – das trägt das Ergebnis der Runde (ErgebnisGesamtBlatt.vue mit `runde`). Diese
 * Liste zeigt dazu, wo die Strafsekunden entstanden sind. Organisation, nicht Regel 960.
 *
 * Seiten: Jede Tabelle ist ein Block des Dokuments (ListenDokument.vue) – ihre Titelzeile ist
 * dessen erste Zeile. Passt die zweite Tabelle nicht mehr unter die erste, beginnt sie auf der
 * nächsten Seite; wird eine Tabelle geteilt, steht ihr Titel auf der Fortsetzung noch einmal.
 */
const props = defineProps<{
  klasseText: string
  /** Was im Kopf steht: „Preliminary heat – Attempts“. */
  titel: string
  eventName: string
  gruppen: ErgebnisGruppe[]
  /** Die beiden Tabellen in der gewählten Ansicht und Reihenfolge (lib/parallelErgebnis.ts `attemptTabellen`). */
  tabellen: AttemptTabelle[]
  /** Spalte der Herkunft: Überschrift und Text je Starter; fehlt = keine Spalte. */
  herkunft?: { titel: string; anzeige: (p: Starter) => HerkunftAnzeige; zeichen: number }
  /** Namen: voll, Nachname gekürzt („M.“) oder gar nicht (Aushang – dann steht nur die Startnummer da). */
  namen?: NamenArt
  /** Wann sich die Liste zuletzt geändert hat (lib/listenStand.ts), schon als Text. */
  stand?: string
  /** Unterschriftszeile des O.O.D. und Feld für die Uhrzeit des Aushangs (UIM 960, Pkt. 5.2). */
  unterschrift?: boolean
  /** Sprache der Liste (lib/listensprache.ts); fehlt = die der Oberfläche. */
  sprache?: Locale
}>()

// Alles auf dem Blatt steht in der Sprache der Liste, nicht in der der Oberfläche.
const sprache = () => props.sprache ?? locale.value
const { t } = texteIn(sprache)
const { punkteZelle, sekundenText, spaltenText, zeitText } = ergebnisTexte(sprache)

const unterschriftTexte = computed(() => (props.unterschrift ? { wer: t('results.signOod'), aushang: t('results.postingTime') } : undefined))

/** Die Tabellen heißen nach dem Attempt – dann nennt die Spalte den Racecourse – oder umgekehrt. */
const nachRacecourse = computed(() => props.tabellen.some((tab) => tab.titel.art === 'racecourse'))
const attemptText = (n: number) => (n === 1 ? t('parallel.attempt.1') : n === 2 ? t('parallel.attempt.2') : `${t('parallel.attempt')} ${n}`)
const titelVon = (tab: AttemptTabelle) => (tab.titel.art === 'attempt' ? attemptText(tab.titel.attempt) : `${t('parallel.lists.racecourse')} ${tab.titel.racecourse}`)
/** Kennung einer Tabelle für Tests und Messung: „1“, „2“ oder „A“, „B“. */
const kennung = (tab: AttemptTabelle) => (tab.titel.art === 'attempt' ? String(tab.titel.attempt) : tab.titel.racecourse)
/** Was in der wechselnden Spalte steht: der Racecourse der Fahrt oder ihr Attempt. */
const wechselZelle = (z: AttemptZeile) => (nachRacecourse.value ? String(z.attempt) : (z.racecourse ?? ''))

const blaetter = computed(() => props.gruppen.flatMap((g) => g.blaetter.map((b, bi) => ({ erste: bi === 0, label: b.label }))))
const zweizeilig = computed(() => props.gruppen.some((g) => g.mitUnter))
const kopfZeilen = computed(() => (zweizeilig.value ? 2 : 1))
const nachname = (p: Starter) => listenNachname(p, props.namen)
// Nr., Name, Vorname, Racecourse/Attempt, Zeit, Sek. + Fahrweg + disq., Summe, Fehler-Schlüssel –
// ohne Spalte „Platz“ (Entscheidung des Nutzers: Es zählt die Summe beider Attempts, nicht der
// Platz im einzelnen; sortiert ist „nach Platz“ trotzdem nach der Zeit, lib/parallelErgebnis.ts).
const spaltenZahl = computed(() => 9 - (props.namen === 'ohne' ? 2 : 0) + (props.herkunft ? 1 : 0) + blaetter.value.length)

// Je Tabelle ein Block: die Titelzeile (0) und ihre Fahrten.
const laengen = computed(() => props.tabellen.map((tab) => tab.zeilen.length + 1))
type Zeile = { art: 'titel'; tab: AttemptTabelle } | { art: 'fahrt'; z: AttemptZeile; i: number }
const zeilen = (teil: SeitenTeil): Zeile[] => {
  const tab = props.tabellen[teil.block]
  return Array.from({ length: teil.bis - teil.von }, (_, j): Zeile => {
    const r = teil.von + j
    return r === 0 ? { art: 'titel', tab } : { art: 'fahrt', z: tab.zeilen[r - 1], i: r - 1 }
  })
}
/** Die Tabelle, die auf dieser Seite weitergeht (ohne ihre Titelzeile beginnt). */
const fortsetzung = (teile: readonly SeitenTeil[]) => (teile.length > 0 && teile[0].von > 0 ? props.tabellen[teile[0].block] : undefined)

/** Breite der Tabelle und der festen Spalten in mm – wie in styles/ergebnis.css (`.erg-w-*`). */
const BREITE = 279.8
const NAMEN = 22 + 18.5
/** Die wechselnde Spalte (Racecourse oder Attempt): so breit wie ihre längere Überschrift. */
const WECHSEL_MM = 20
const EINZEL = 8
const FEST = 9 + NAMEN + WECHSEL_MM + 12.5 + 10.5 + 8 + 11.5 + 14.5
const HERKUNFT_MIN = 11
const ZEICHEN_MM = 1.46
const frei = computed(() => BREITE - FEST + (props.namen === 'ohne' ? NAMEN : 0) - EINZEL * blaetter.value.length)
// Breite der Herkunft-Spalte in mm: für Kürzel schmal, für ausgeschriebene Namen breiter – soweit Platz ist.
const herkunftMm = computed(() => Math.max(HERKUNFT_MIN, Math.min(30, Math.round((props.herkunft?.zeichen ?? 0) * ZEICHEN_MM + 3), Math.floor(frei.value))))
/** Kleiner setzen nach der Breite der Spalte; reicht auch die kleinste Stufe nicht, steht der Text zweizeilig. */
const fitBreite = (text: string, mm: number) => {
  const normal = Math.floor((mm - 1.5) / ZEICHEN_MM)
  return text.length <= normal ? undefined : text.length <= normal / 0.85 ? 'fit-1' : text.length <= normal / 0.7 ? 'fit-2' : 'erg-zweizeilig'
}
const fit = (text: string, normal: number) => (text.length > normal * 1.4 ? 'fit-2' : text.length > normal ? 'fit-1' : undefined)
</script>

<template>
  <ListenDokument
    class="ergebnis-blatt"
    data-art="attempts"
    :data-ansicht="nachRacecourse ? 'racecourse' : 'attempt'"
    :laengen="laengen"
    format="landscape"
    :vorgabe="SEITEN_VORGABE.ergebnisLauf"
    :sprache="sprache()"
    :fuss-mm="ergebnisFussMm(unterschrift)"
    :wiederholte-zeile="0"
  >
    <template #fuss="{ seitenzahl }">
      <ErgebnisFuss :stand="stand" :stand-label="t('results.changed')" :seitenzahl="seitenzahl" :unterschrift="unterschriftTexte" />
    </template>
    <template #default="{ teile }">
      <table class="erg-tabelle erg-tabelle--attempts">
        <colgroup>
          <col class="erg-w-nr" />
          <col v-if="namen !== 'ohne'" class="erg-w-name" />
          <col v-if="namen !== 'ohne'" class="erg-w-vorname" />
          <col v-if="herkunft" class="erg-w-herkunft" :style="{ width: `${herkunftMm}mm` }" />
          <col :style="{ width: `${WECHSEL_MM}mm` }" />
          <col class="erg-w-zeit" />
          <col class="erg-w-punkte" />
          <col v-for="bi in blaetter.length" :key="bi" class="erg-w-spalte" />
          <col class="erg-w-disq" />
          <col class="erg-w-ges" />
          <col class="erg-w-schluessel" />
        </colgroup>
        <thead>
          <tr>
            <th class="erg-kopfzelle" :colspan="spaltenZahl">
              <KopfLogos>
                <div class="erg-kopf erg-kopf--runde">
                  <span class="erg-kopf-klasse">{{ klasseText }}</span>
                  <span class="erg-kopf-titel">{{ titel }}</span>
                  <span class="erg-kopf-event">{{ eventName }}</span>
                </div>
              </KopfLogos>
            </th>
          </tr>
          <tr class="erg-spaltenkopf">
            <th :rowspan="kopfZeilen">{{ t('common.startNr') }}</th>
            <th v-if="namen !== 'ohne'" :rowspan="kopfZeilen">{{ t('common.lastName') }}</th>
            <th v-if="namen !== 'ohne'" :rowspan="kopfZeilen">{{ t('common.firstName') }}</th>
            <th v-if="herkunft" :rowspan="kopfZeilen">{{ herkunft.titel }}</th>
            <th :rowspan="kopfZeilen" data-spalte="wechsel">{{ nachRacecourse ? t('parallel.attempt') : t('parallel.lists.racecourse') }}</th>
            <th :rowspan="kopfZeilen">{{ t('results.time') }}</th>
            <th :rowspan="kopfZeilen">{{ t('results.timeValue') }}</th>
            <template v-for="(g, gi) in gruppen" :key="gi">
              <th v-if="g.mitUnter" :colspan="g.blaetter.length" class="erg-gruppe">{{ spaltenText(g.label) }}</th>
              <th v-else :rowspan="kopfZeilen" class="erg-gruppe">{{ spaltenText(g.label) }}</th>
            </template>
            <th :rowspan="kopfZeilen" class="erg-gruppe">{{ t('results.dsq') }}</th>
            <th :rowspan="kopfZeilen">{{ t('results.total') }}</th>
            <th :rowspan="kopfZeilen">{{ t('results.key') }}</th>
          </tr>
          <tr v-if="zweizeilig" class="erg-unterkopf">
            <template v-for="(g, gi) in gruppen" :key="gi">
              <template v-if="g.mitUnter">
                <th v-for="(b, bi) in g.blaetter" :key="bi" :class="bi === 0 ? 'erg-gruppe' : undefined">{{ b.label }}</th>
              </template>
            </template>
          </tr>
          <!-- Nur auf der Fortsetzung einer Tabelle: ihr Titel noch einmal, so hoch wie die Titelzeile selbst (das Dokument rechnet mit ihr). -->
          <tr v-if="fortsetzung(teile)" class="erg-teil-titel" data-titel="fortsetzung">
            <th :colspan="spaltenZahl">{{ t('parallel.results.continued', { title: titelVon(fortsetzung(teile)!) }) }}</th>
          </tr>
        </thead>
        <tbody v-for="teil in teile" :key="teil.block" :data-tabelle="kennung(tabellen[teil.block])">
          <template v-for="zeile in zeilen(teil)" :key="zeile.art === 'titel' ? 'titel' : `${zeile.z.zeile.starter.id}/${zeile.z.attempt}`">
            <tr v-if="zeile.art === 'titel'" class="erg-teil-titel" data-titel="tabelle">
              <td :colspan="spaltenZahl">{{ titelVon(zeile.tab) }}</td>
            </tr>
            <tr
              v-else
              :class="(zeile.i + 1) % 5 === 0 ? 'grau' : undefined"
              :data-starter="zeile.z.zeile.starter.id"
              :data-attempt="zeile.z.attempt"
              :data-racecourse="zeile.z.racecourse"
              :data-wertung="zeile.z.zeile.disq ? 'disq' : zeile.z.zeile.offen ? 'offen' : 'gewertet'"
            >
              <td>{{ zeile.z.zeile.starter.startNr }}</td>
              <td v-if="namen !== 'ohne'" :class="fitBreite(nachname(zeile.z.zeile.starter), 22)">{{ nachname(zeile.z.zeile.starter) }}</td>
              <td v-if="namen !== 'ohne'" :class="fitBreite(zeile.z.zeile.starter.vorname, 18.5)">{{ zeile.z.zeile.starter.vorname }}</td>
              <td v-if="herkunft" :class="fitBreite(herkunft.anzeige(zeile.z.zeile.starter).mass, herkunftMm)"><HerkunftText :anzeige="herkunft.anzeige(zeile.z.zeile.starter)" /></td>
              <td data-spalte="wechsel">{{ wechselZelle(zeile.z) }}</td>
              <!-- „Nicht gestartet“ (X) steht ausgeschrieben da, wo sonst die Zeit stünde. -->
              <td v-if="zeile.z.zeile.nichtGestartet && zeile.z.zeile.zeit === null" colspan="2" class="erg-dns">{{ t('results.dns') }}</td>
              <template v-else>
                <td>{{ zeitText(zeile.z.zeile.zeit) }}</td>
                <td>{{ sekundenText(zeile.z.zeile.zeit) }}</td>
              </template>
              <td v-for="(b, bi) in blaetter" :key="bi" :class="[{ 'erg-gruppe': b.erste }, fit(zeile.z.zeile.zellen[bi], 2)]">{{ zeile.z.zeile.zellen[bi] }}</td>
              <td class="erg-gruppe">{{ zeile.z.zeile.disq ? 'x' : '' }}</td>
              <td :class="{ 'erg-disq': zeile.z.zeile.disq }">{{ punkteZelle(zeile.z.zeile.disq, zeile.z.zeile.gesamt) }}</td>
              <td :class="fit(zeile.z.zeile.schluessel, 9)">{{ zeile.z.zeile.schluessel }}</td>
            </tr>
          </template>
        </tbody>
      </table>
    </template>
  </ListenDokument>
</template>
