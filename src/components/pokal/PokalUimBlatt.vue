<script setup lang="ts">
import { listenNachname, type NamenArt } from '../../lib/namen'
import { computed } from 'vue'
import { locale, texteIn, type Locale } from '../../i18n'
import type { ClassId, Starter } from '../../types'
import type { UimGruppe, UimStarter, UimWertung } from '../../lib/pokal'
import { ergebnisFussMm, SEITEN_VORGABE, type SeitenTeil } from '../../lib/seiten'
import type { HerkunftAnzeige } from '../../lib/origin'
import HerkunftText from '../HerkunftText.vue'
import ListenDokument from '../ListenDokument.vue'
import ErgebnisFuss from '../ergebnis/ErgebnisFuss.vue'

/**
 * Pokalauswertung nach UIM-Punkten (A4 hoch): je Herkunft ein Block mit allen ihren Startern
 * nach Punkten, dem Kennzeichen der Besten, darunter die Summe aller Punkte, die Summe der
 * Besten und der Platz der Herkunft. Vorbild: Blatt „Mannschaftswertung_UIM“ der Excel-Mappe
 * der DM 2026 (Spalten Platz, Klasse, Nr, Name, Vorname, Punkte, Top 5, Gesamt Platz; „X“ bei
 * den fünf Besten; Herkünfte mit weniger als fünf Startern ohne Top-5-Summe und ohne Platz).
 *
 * Die Spaltenköpfe stehen bei jeder Tabelle, also über jedem Herkunftsblock unter dessen Titel
 * (Wunsch des Nutzers) – nicht mehr einmal oben auf der Seite: Wer in der Mitte des Blatts
 * liest, hat sie vor Augen.
 *
 * Seitenteilung: Jede Herkunft ist ein Block aus Titelzeile, Spaltenköpfen, Startern und
 * Summenzeile – alle als Zeilen der Tabelle, damit das Dokument sie messen kann
 * (ListenDokument.vue). Ein Block bleibt zusammen, solange er auf eine Seite passt. Wird ein
 * sehr großer geteilt, steht auf der Folgeseite im Kopf, welche Herkunft fortgesetzt wird (in
 * fester Höhe – die Messung hängt nicht davon ab), und darunter stehen die Spaltenköpfe noch
 * einmal; ihren Platz zieht das Dokument dieser Seite ab (`wiederholte-zeile`).
 */
const props = defineProps<{
  wertung: UimWertung
  eventName: string
  herkunftTitel: string
  /** Herkunft, wie sie auf dem Blatt steht: ausgeschrieben, als Kürzel, mit Flagge (lib/origin.ts). */
  herkunftAnzeige: (herkunft: string) => HerkunftAnzeige
  /** Die Klasse in der Spalte „Klasse“: ihr Name, wenn das Regelwerk einen hat, sonst die Kennung. */
  klasseKurz: (klasse: ClassId) => string
  /** Die Klasse ausgeschrieben, für den Hinweis zum Zwischenstand. */
  klasseText: (klasse: ClassId) => string
  /** Namen wie auf den Wertungslisten: voll, Nachname gekürzt („M.“) oder gar nicht. */
  namen?: NamenArt
  /** Eine Klasse ohne Endergebnis im Hinweis zum Zwischenstand – kurz, mit der Zahl ihrer gewerteten Läufe („1: 1/2“). */
  offenText?: (klasse: ClassId) => string
  /** Die Erklärung zum Sternchen am Platz (Stichentscheid der Mannschaften), in der Listensprache. */
  stichText?: string
  stand?: string
  /**
   * Ein Hinweis, der auf jeder Seite unter dem Kopf steht – worauf die Wertung beruht („Nur
   * Manövrieren – zu Parallel-Slalom ist noch nichts erfasst.“) und welche Disziplin der O.O.D.
   * für welche Klassen nicht wertet. Leer = keiner.
   */
  hinweis?: string
  /**
   * Die Punkte sind die der Einzelwertung (UIM 960, Pkt. 5.2.4: „UIM points secured by the top
   * five team members in the overall individual competitions“): Der Platz in der ersten Spalte
   * ist dann der der Einzelwertung.
   */
  ausEinzel?: boolean
  /** Die Disziplinen, aus denen die Punkte stammen, für den Kopf („Manövrieren + Parallel-Slalom“); leer = ohne Zusatz. */
  disziplinenText?: string
  /**
   * Unter der Liste stehen die Unterschriftszeile des O.O.D. und das leere Feld für die Uhrzeit
   * des Aushangs (UIM 960, Pkt. 5.2) – nur unter einem Regelwerk, das sie verlangt. Der Fuß ist
   * dann höher; die Seitenteilung rechnet damit (lib/seiten.ts `ergebnisFussMm`).
   */
  unterschrift?: boolean
  sprache?: Locale
}>()

const sprache = () => props.sprache ?? locale.value
const { t } = texteIn(sprache)

/** Die Beschriftung der Zeile für Unterschrift und Aushang, in der Sprache der Liste. */
const unterschriftTexte = computed(() => (props.unterschrift ? { wer: t('results.signOod'), aushang: t('results.postingTime') } : undefined))

const mitNamen = computed(() => props.namen !== 'ohne')
const spalten = computed(() => (mitNamen.value ? 8 : 6))
const nachname = (p: Starter) => listenNachname(p, props.namen)

/** Breite der Tabelle und der festen Spalten in mm – wie in styles/pokal.css (`.pokal-w-*`). */
const BREITE = 184.8
const FEST = 13 + 20 + 14 + 17 + 15 + 20
const ZEICHEN_MM = 1.65
/** So viele Zeichen passen in voller Größe in eine Namensspalte; darüber kleiner, notfalls zweizeilig. */
const normal = Math.floor(((BREITE - FEST) / 2 - 1) / ZEICHEN_MM)
const fit = (text: string) => (text.length <= normal ? undefined : text.length <= normal / 0.85 ? 'fit-1' : text.length <= normal / 0.7 ? 'fit-2' : 'erg-zweizeilig')
const fitKlasse = (text: string) => (text.length <= 10 ? undefined : text.length <= 12 ? 'fit-1' : text.length <= 15 ? 'fit-2' : 'erg-zweizeilig')

/** Zeilen vor den Startern eines Blocks: der Titel (0) und die Spaltenköpfe (1). */
const VOR = 2
const KOPF_ZEILE = 1
/** Titel, Spaltenköpfe, Starter und Summe: so viele Zeilen hat der Block einer Herkunft. */
const laengen = computed(() => props.wertung.gruppen.map((g) => g.starter.length + VOR + 1))

type Zeile = { art: 'titel'; g: UimGruppe } | { art: 'kopf'; g: UimGruppe } | { art: 'summe'; g: UimGruppe } | { art: 'starter'; g: UimGruppe; s: UimStarter; nr: number }
const zeilen = (teil: SeitenTeil): Zeile[] => {
  const g = props.wertung.gruppen[teil.block]
  return Array.from({ length: teil.bis - teil.von }, (_, j): Zeile => {
    const r = teil.von + j
    return r === 0 ? { art: 'titel', g } : r === KOPF_ZEILE ? { art: 'kopf', g } : r === g.starter.length + VOR ? { art: 'summe', g } : { art: 'starter', g, s: g.starter[r - VOR], nr: r - VOR + 1 }
  })
}
/** Die Spaltenköpfe – über jedem Block und im Kopf einer Seite, die einen Block fortsetzt. */
const koepfe = computed(() => [
  t('results.place'),
  t('lists.class'),
  t('common.startNr'),
  ...(mitNamen.value ? [t('common.lastName'), t('common.firstName')] : []),
  t('results.points'),
  t('cup.uim.top', { n: props.wertung.beste }),
  t('cup.uim.teamRank'),
])
/** Die Herkunft, deren Block auf dieser Seite weitergeht (ohne Titelzeile beginnt). */
const fortsetzung = (teile: readonly SeitenTeil[]) => (teile.length > 0 && teile[0].von > 0 ? props.herkunftAnzeige(props.wertung.gruppen[teile[0].block].herkunft).klartext : '')
/** Beginnt die Seite mitten in einem Block HINTER dessen Spaltenköpfen? Dann stehen sie im Kopf der Seite noch einmal. */
const kopfWiederholt = (teile: readonly SeitenTeil[]) => teile.length > 0 && teile[0].von > KOPF_ZEILE

const platzText = (s: UimStarter) => (s.disq ? t('results.dsq') : s.offen || s.platz < 1 ? '–' : String(s.platz))
// Die Erklärung steht auf jeder Seite des Blatts, sobald irgendein Platz so entstand: Die
// Plätze einer Mannschaftswertung liest man im Ganzen, nicht seitenweise.
const mitStich = computed(() => props.wertung.gruppen.some((g) => g.stich))
const zwischenstand = computed(() =>
  props.wertung.offen.length > 0 ? t(props.ausEinzel ? 'cup.interimNoteBoth' : 'cup.interimNote', { classes: props.wertung.offen.map((k) => (props.offenText ?? props.klasseText)(k)).join(', ') }) : '',
)
</script>

<template>
  <ListenDokument
    class="ergebnis-blatt pokal-blatt pokal-blatt--hoch"
    data-art="pokal-uim"
    :laengen="laengen"
    format="portrait"
    :vorgabe="SEITEN_VORGABE.pokalUim"
    :sprache="sprache()"
    :fuss-mm="ergebnisFussMm(unterschrift)"
    :wiederholte-zeile="KOPF_ZEILE"
  >
    <template #fuss="{ seitenzahl }">
      <ErgebnisFuss :stand="stand" :stand-label="t('results.changed')" :stich="mitStich ? stichText : ''" :hinweis="zwischenstand" :seitenzahl="seitenzahl" :unterschrift="unterschriftTexte" />
    </template>
    <template #default="{ teile }">
      <table class="erg-tabelle erg-tabelle--gesamt pokal-tabelle pokal-tabelle--uim">
        <colgroup>
          <col class="pokal-w-platz" />
          <col class="pokal-w-klasse" />
          <col :class="mitNamen ? 'pokal-w-nr' : undefined" />
          <col v-if="mitNamen" />
          <col v-if="mitNamen" />
          <col class="pokal-w-punkte" />
          <col class="pokal-w-top" />
          <col class="pokal-w-gesamt" />
        </colgroup>
        <thead>
          <tr>
            <th class="erg-kopfzelle pokal-kopfzelle" :colspan="spalten">
              <div class="erg-kopf pokal-kopf">
                <span>{{ t('cup.sheet.titleUim') }}<template v-if="zwischenstand"> – {{ t('cup.interim') }}</template></span>
                <span class="erg-kopf-titel pokal-kopf-regel">{{ disziplinenText ? t('cup.uim.ruleOf', { disciplines: disziplinenText, n: wertung.beste, origin: herkunftTitel }) : t('cup.uim.rule', { n: wertung.beste, origin: herkunftTitel }) }}</span>
                <span class="erg-kopf-event">{{ eventName }}</span>
              </div>
              <!-- Im festen Abstand unter dem Kopf: ändert die Höhe der Seite nicht. -->
              <span v-if="fortsetzung(teile)" class="pokal-fortsetzung" data-hinweis="fortsetzung">{{ t('cup.continued', { origin: fortsetzung(teile) }) }}</span>
            </th>
          </tr>
          <!-- Eine Zeile des Kopfs auf jeder Seite: Das Dokument misst sie mit (ListenDokument.vue). -->
          <tr v-if="hinweis" class="pokal-hinweis-zeile" data-hinweis="grundlage">
            <th :colspan="spalten">{{ hinweis }}</th>
          </tr>
          <!-- Nur auf der Fortsetzung eines Blocks: dieselbe Zeile wie über jedem Block (gleiche Höhe – das Dokument rechnet mit ihr). -->
          <tr v-if="kopfWiederholt(teile)" class="pokal-gruppe-kopf" data-kopf="fortsetzung">
            <th v-for="k in koepfe" :key="k" scope="col">{{ k }}</th>
          </tr>
        </thead>
        <tbody v-for="teil in teile" :key="teil.block" :data-herkunft="wertung.gruppen[teil.block].herkunft">
          <template v-for="z in zeilen(teil)" :key="z.art === 'starter' ? z.s.starter.id : z.art">
            <tr v-if="z.art === 'titel'" class="pokal-gruppe-titel">
              <td :colspan="spalten">
                <div>
                  <span><HerkunftText :anzeige="herkunftAnzeige(z.g.herkunft)" /></span>
                  <small v-if="z.g.platz === null" data-hinweis="nicht-gewertet">{{ t('cup.uim.notRanked', { n: wertung.mindestens }) }}</small>
                </div>
              </td>
            </tr>
            <!-- Die Spaltenköpfe gehören zum Block: direkt unter seinem Titel. -->
            <tr v-else-if="z.art === 'kopf'" class="pokal-gruppe-kopf" data-kopf="block">
              <th v-for="k in koepfe" :key="k" scope="col">{{ k }}</th>
            </tr>
            <tr v-else-if="z.art === 'summe'" class="pokal-gruppe-summe">
              <td :colspan="spalten - 3">{{ t('cup.uim.sum') }}</td>
              <td>{{ z.g.summe }}</td>
              <!-- Ohne Wertung (zu wenige Starter) gibt es weder die Summe der Besten noch einen Platz – wie in der Mappe. -->
              <td>{{ z.g.platz === null ? '' : z.g.summeBeste }}</td>
              <td class="erg-platz" :data-stich="z.g.stich ? '' : undefined">{{ z.g.platz ?? '–' }}<span v-if="z.g.stich" class="erg-stich-zeichen">*</span></td>
            </tr>
            <tr v-else :class="z.nr % 5 === 0 ? 'grau' : undefined" :data-starter="z.s.starter.id" :data-top="z.s.top && z.g.platz !== null ? '' : undefined">
              <td>{{ platzText(z.s) }}</td>
              <td :class="fitKlasse(klasseKurz(z.s.klasse))">{{ klasseKurz(z.s.klasse) }}</td>
              <td>{{ z.s.starter.startNr }}</td>
              <td v-if="mitNamen" :class="fit(nachname(z.s.starter))">{{ nachname(z.s.starter) }}</td>
              <td v-if="mitNamen" :class="fit(z.s.starter.vorname)">{{ z.s.starter.vorname }}</td>
              <td>{{ z.s.punkte }}</td>
              <td class="erg-platz">{{ z.s.top && z.g.platz !== null ? 'X' : '' }}</td>
              <td />
            </tr>
          </template>
        </tbody>
      </table>
    </template>
  </ListenDokument>
</template>
