<script setup lang="ts">
import { computed } from 'vue'
import { listenNachname, type NamenArt } from '../../lib/namen'
import { ergebnisTexte } from '../../lib/ergebnisText'
import { locale, texteIn, type Locale } from '../../i18n'
import type { Starter, WertungsDisziplin } from '../../types'
import type { HerkunftAnzeige } from '../../lib/origin'
import type { EinzelZeile } from '../../lib/einzelwertung'
import { ergebnisFussMm, SEITEN_VORGABE, zeilenDerSeite, type SeitenTeil } from '../../lib/seiten'
import HerkunftText from '../HerkunftText.vue'
import ListenDokument from '../ListenDokument.vue'
import ErgebnisFuss from './ErgebnisFuss.vue'

/**
 * Die Einzelwertung einer Klasse (A4 quer; lib/einzelwertung.ts): ganz vorn der Platz in der
 * Einzelwertung – wie auf allen Wertungslisten (Entscheidung des Nutzers vom 15.11.2026, abends) –,
 * dann der Starter, je Disziplin drei Spalten aus ihrem Gesamtergebnis – Zeit, Platz, UIM points –
 * und dahinter die Summe der Punkte (Entscheidung des Nutzers vom 15.11.2026). Die Zeit des
 * Manövrierens ist die gewertete der Gesamtliste (der bessere Versuch mit seinen Strafen und den
 * Strafen der Knoten), die des Parallelslaloms die Summe beider Attempts in der Runde, die den
 * Platz bestimmt hat (Finalisten im Finale, ab Platz 5 im Vorlauf). Eine Spalte mit dieser Runde
 * gibt es nicht und keinen Fuß dazu: Der Platz sagt es – unter Platz 4 ist alles aus dem Vorlauf.
 * Spalten gibt es nur für eine Disziplin, die für die Klasse zählt (`disziplinen`): Ist nur eine
 * gefahren, stehen ihre drei und die Summe da. Nie die Nummer einer Stage, nur der Name der
 * Disziplin.
 *
 * Regel 960, Pkt. 5.2.3: „Individual competition / General: manoeuvring overall UIM points,
 * parallel slalom overall UIM points, UIM combined points ranking.“ Pkt. 5.2: „All results must
 * be signed by the O.O.D. and must show the time of posting.“
 *
 * Bei Punktgleichheit entscheidet die Zeit nach Pkt. 5.2.6 („the sum of his/her better
 * manoeuvring attempt (including penalties) and both his/her parallel slalom attempts“). Sie
 * steht nur da, wo sie gebraucht wird: Gibt es in der Klasse Punktgleiche, bekommt die Liste
 * die Spalte „Combined time“, gefüllt bei den Punktgleichen – wer keine hat (in einer Disziplin
 * disqualifiziert), bei dem steht ein Strich, und er steht hinter den Punktgleichen mit Zeit
 * (Entscheidung des Nutzers). Ein Sternchen am Platz heißt: Der Stichentscheid hat ihn bestimmt.
 * Der Fuß nennt die Regel auf jeder Seite mit Punktgleichen – auch ohne Sternchen (gleiche
 * Zeit), und den Zusatz zu Strich und geteiltem Platz, wo einer davon vorkommt. Wertet der
 * O.O.D. eine Disziplin für die Klasse nicht, steht das im Fuß jeder Seite (`hinweisText`).
 * Eine eigene Seitenteilung wie jede Liste (ListenDokument.vue).
 */
const props = defineProps<{
  klasseText: string
  titel: string
  eventName: string
  zeilen: EinzelZeile[]
  /** Die Disziplinen, die für die Klasse zählen – je eine Spalte; fehlt = beide. */
  disziplinen?: readonly WertungsDisziplin[]
  /** Steht im Fuß jeder Seite: welche Disziplin der O.O.D. für die Klasse nicht wertet. */
  hinweisText?: string
  herkunft?: { titel: string; anzeige: (p: Starter) => HerkunftAnzeige; zeichen: number }
  namen?: NamenArt
  /** Die Erklärung zum Sternchen am Platz (Stichentscheid der Einzelwertung), in der Listensprache. */
  stichText?: string
  /** Dieselbe Regel ohne den Vorsatz zum Sternchen – für eine Seite mit Punktgleichen, die nichts trennt. */
  regelText?: string
  /** Der Zusatz zum geteilten Platz und zum Strich in der Spalte der Zeit („dead-heat result“, Pkt. 5.2.6). */
  geteiltText?: string
  stand?: string
  unterschrift?: boolean
  sprache?: Locale
}>()

const sprache = () => props.sprache ?? locale.value
const { t } = texteIn(sprache)
const { sekundenText, punkteZelle } = ergebnisTexte(sprache)
const unterschriftTexte = computed(() => (props.unterschrift ? { wer: t('results.signOod'), aushang: t('results.postingTime') } : undefined))
const nachname = (p: Starter) => listenNachname(p, props.namen)
/** Die Spalte der Zeit gibt es nur, wenn in der Klasse jemand punktgleich ist. */
const mitZeit = computed(() => props.zeilen.some((z) => z.punktgleich))
const mitManoever = computed(() => props.disziplinen === undefined || props.disziplinen.includes('manoever'))
const mitParallel = computed(() => props.disziplinen === undefined || props.disziplinen.includes('parallel'))
/** Die Disziplinen, die Spalten bekommen – in fester Folge, je drei: Zeit, Platz, UIM points. */
const disziplinSpalten = computed(() => [...(mitManoever.value ? (['manoever'] as const) : []), ...(mitParallel.value ? (['parallel'] as const) : [])])
// Platz, Nr., Name, Vorname – dann Herkunft, je Disziplin drei Spalten, die Summe und die Zeit des Stichentscheids.
const spaltenZahl = computed(() => 4 - (props.namen === 'ohne' ? 2 : 0) + (props.herkunft ? 1 : 0) + 3 * disziplinSpalten.value.length + 1 + (mitZeit.value ? 1 : 0))
/** Breite der Herkunft in mm: für Kürzel schmal, für ausgeschriebene Namen breiter (wie auf der Gesamtliste). */
const herkunftMm = computed(() => Math.min(60, Math.max(20, Math.round((props.herkunft?.zeichen ?? 0) * 1.65 + 3))))
/** Punktgleich und trotzdem derselbe Platz wie ein anderer: gleiche Zeit – oder eine fehlt. */
const teilt = (z: EinzelZeile) => z.punktgleich && props.zeilen.some((y) => y !== z && !y.offen && y.platz === z.platz)
/**
 * Der Fuß der Seite: Steht ein Sternchen darauf, die Regel mit dem Vorsatz dazu; teilen sich
 * Punktgleiche den Platz, der Zusatz dazu – ohne Sternchen als Hinweis ohne Zeichen. So ist
 * die Spalte der Zeit auf jeder Seite erklärt, auf der sie gefüllt ist.
 */
const fuss = (teile: readonly SeitenTeil[]): { stich: string; hinweis: string } => {
  const seite = zeilenDerSeite(props.zeilen, teile).map(({ z }) => z)
  // Der Zusatz erklärt den Strich (ohne Zeit: hinter den Punktgleichen mit Zeit) und den geteilten Platz.
  const geteilt = seite.some((z) => teilt(z) || (z.punktgleich && z.zeit === null)) ? (props.geteiltText ?? '') : ''
  const zusammen = (...texte: (string | undefined)[]) => texte.filter(Boolean).join(' ')
  if (seite.some((z) => z.stich)) return { stich: zusammen(props.stichText, geteilt), hinweis: props.hinweisText ?? '' }
  return { stich: '', hinweis: zusammen(seite.some((z) => z.punktgleich) ? zusammen(props.regelText, geteilt) : '', props.hinweisText) }
}
const zeitZelle = (z: EinzelZeile) => (!z.punktgleich ? '' : z.zeit === null ? '–' : sekundenText(z.zeit))
/** Zeit, Platz und Punkte einer Disziplin in der Zeile; leer, wo es kein Ergebnis gibt (nicht im Plan des Parallelslaloms). */
const ergebnisVon = (z: EinzelZeile, d: WertungsDisziplin) => (d === 'manoever' ? z.manoeverErgebnis : z.parallelErgebnis)
const punkteVon = (z: EinzelZeile, d: WertungsDisziplin) => (d === 'manoever' ? z.manoever : z.parallel)
const disziplinTitel = (d: WertungsDisziplin) => t(d === 'manoever' ? 'individual.col.manoeuvring' : 'individual.col.parallel')
</script>

<template>
  <ListenDokument class="ergebnis-blatt" data-art="einzel" :laengen="[zeilen.length]" format="landscape" :vorgabe="SEITEN_VORGABE.ergebnisGesamt" :sprache="sprache()" :fuss-mm="ergebnisFussMm(unterschrift)">
    <template #fuss="{ seitenzahl, teile }">
      <ErgebnisFuss :stand="stand" :stand-label="t('results.changed')" :stich="fuss(teile).stich" :hinweis="fuss(teile).hinweis" :seitenzahl="seitenzahl" :unterschrift="unterschriftTexte" />
    </template>
    <template #default="{ teile }">
      <table class="erg-tabelle erg-tabelle--gesamt erg-tabelle--einzel">
        <colgroup>
          <col class="erg-w-platz" />
          <col class="erg-w-nr" />
          <col v-if="namen !== 'ohne'" class="erg-w-name" />
          <col v-if="namen !== 'ohne'" class="erg-w-vorname" />
          <col v-if="herkunft" :style="{ width: `${herkunftMm}mm` }" />
          <template v-for="d in disziplinSpalten" :key="d">
            <col style="width: 17mm" />
            <col style="width: 11mm" />
            <col style="width: 15mm" />
          </template>
          <col style="width: 21mm" />
          <col v-if="mitZeit" style="width: 22mm" />
        </colgroup>
        <thead>
          <tr>
            <th class="erg-kopfzelle" :colspan="spaltenZahl">
              <div class="erg-kopf erg-kopf--runde">
                <span class="erg-kopf-klasse">{{ klasseText }}</span>
                <span class="erg-kopf-titel">{{ titel }}</span>
                <span class="erg-kopf-event">{{ eventName }}</span>
              </div>
            </th>
          </tr>
          <tr class="erg-spaltenkopf">
            <th rowspan="2" data-spalte="platz">{{ t('results.place') }}</th>
            <th rowspan="2">{{ t('common.startNr') }}</th>
            <th v-if="namen !== 'ohne'" rowspan="2">{{ t('common.lastName') }}</th>
            <th v-if="namen !== 'ohne'" rowspan="2">{{ t('common.firstName') }}</th>
            <th v-if="herkunft" rowspan="2">{{ herkunft.titel }}</th>
            <th v-for="d in disziplinSpalten" :key="d" colspan="3" class="erg-gruppe" :data-spalte="d">{{ disziplinTitel(d) }}</th>
            <th rowspan="2" class="erg-gruppe" data-spalte="summe">{{ t('individual.col.combined') }}</th>
            <th v-if="mitZeit" rowspan="2" data-spalte="zeit">{{ t('individual.col.time') }}</th>
          </tr>
          <tr class="erg-unterkopf erg-unterkopf--gesamt">
            <template v-for="d in disziplinSpalten" :key="d">
              <th class="erg-gruppe" :data-spalte="`${d}-zeit`">{{ t('individual.col.disciplineTime') }}</th>
              <th :data-spalte="`${d}-platz`">{{ t('results.place') }}</th>
              <th :data-spalte="`${d}-punkte`">{{ t('results.uimPoints') }}</th>
            </template>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="{ z, i } in zeilenDerSeite(zeilen, teile)"
            :key="z.starter.id"
            :class="(i + 1) % 5 === 0 ? 'grau' : undefined"
            :data-starter="z.starter.id"
            :data-stich="z.stich ? '' : undefined"
          >
            <td class="erg-platz" data-spalte="platz">{{ z.platz }}<span v-if="z.stich" class="erg-stich-zeichen">*</span></td>
            <td>{{ z.starter.startNr }}</td>
            <td v-if="namen !== 'ohne'">{{ nachname(z.starter) }}</td>
            <td v-if="namen !== 'ohne'">{{ z.starter.vorname }}</td>
            <td v-if="herkunft"><HerkunftText :anzeige="herkunft.anzeige(z.starter)" /></td>
            <template v-for="d in disziplinSpalten" :key="d">
              <td :class="['erg-gruppe', { 'erg-disq': ergebnisVon(z, d)?.disq }]" :data-spalte="`${d}-zeit`">{{ ergebnisVon(z, d) ? punkteZelle(ergebnisVon(z, d)!.disq, ergebnisVon(z, d)!.zeit) : '' }}</td>
              <td :data-spalte="`${d}-platz`">{{ ergebnisVon(z, d)?.platz ?? '' }}</td>
              <td :data-spalte="d">{{ punkteVon(z, d) ?? '' }}</td>
            </template>
            <td class="erg-gruppe" data-spalte="summe">{{ z.summe }}</td>
            <td v-if="mitZeit" data-spalte="zeit">{{ zeitZelle(z) }}</td>
          </tr>
        </tbody>
      </table>
    </template>
  </ListenDokument>
</template>
