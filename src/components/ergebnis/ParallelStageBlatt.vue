<script setup lang="ts">
import { computed } from 'vue'
import KopfLogos from '../KopfLogos.vue'
import { listenNachname, type NamenArt } from '../../lib/namen'
import { ergebnisTexte } from '../../lib/ergebnisText'
import { locale, texteIn, type Locale } from '../../i18n'
import type { Starter } from '../../types'
import type { HerkunftAnzeige } from '../../lib/origin'
import type { StageZeile } from '../../lib/parallelStage'
import { ergebnisFussMm, SEITEN_VORGABE, zeilenDerSeite, type SeitenTeil } from '../../lib/seiten'
import HerkunftText from '../HerkunftText.vue'
import ListenDokument from '../ListenDokument.vue'
import ErgebnisFuss from './ErgebnisFuss.vue'

/**
 * Das Ergebnis der Stage „Parallel slalom“ einer Klasse (A4 quer; lib/parallelStage.ts
 * `stageErgebnis`): Platz, Starter, die Summe beider Attempts in der Runde, die den Platz
 * bestimmt hat – und die UIM points des Platzes.
 *
 * Regel 960, Pkt. 4.4: „the driver is awarded UIM points for his/her ranking“; Pkt. 5.2: „Results
 * for each class and stage must be posted …“. Die Plätze 1 bis 4 kommen aus den Finals, ab
 * Platz 5 aus dem Vorlauf. Eine Spalte mit dieser Runde gibt es nicht (Entscheidung des Nutzers
 * vom 15.11.2026): Der Platz sagt es – unter Platz 4 ist alles aus dem Vorlauf; hat dort ein
 * Re-run entschieden, trägt der Platz ein Sternchen (`wiederholt`). Eine eigene Seitenteilung
 * wie jede Liste (ListenDokument.vue).
 */
const props = defineProps<{
  klasseText: string
  titel: string
  eventName: string
  zeilen: StageZeile[]
  herkunft?: { titel: string; anzeige: (p: Starter) => HerkunftAnzeige; zeichen: number }
  namen?: NamenArt
  stand?: string
  /** Steht im Fuß jeder Seite: Der O.O.D. wertet den Parallelslalom für die Klasse nicht (lib/disziplinen.ts). */
  hinweisText?: string
  /** Ohne die Spalte „UIM points“: Der O.O.D. wertet den Parallelslalom für die Klasse nicht – Plätze und Zeiten bleiben. */
  ohnePunkte?: boolean
  /**
   * Plätze, die eine Wiederholung entschieden hat (ab Platz 5 aus dem Vorlauf; Pkt. 5.2.6): Sie
   * tragen ein Sternchen, `text` erklärt es im Fuß jeder Seite mit einem – auch, warum dort die
   * Summe der Wiederholung steht (lib/parallelStage.ts `stageDurchWiederholung`).
   */
  wiederholt?: { ids: ReadonlySet<string>; text: string }
  unterschrift?: boolean
  sprache?: Locale
}>()

const sprache = () => props.sprache ?? locale.value
const { t } = texteIn(sprache)
const { punkteZelle } = ergebnisTexte(sprache)
const unterschriftTexte = computed(() => (props.unterschrift ? { wer: t('results.signOod'), aushang: t('results.postingTime') } : undefined))
const nachname = (p: Starter) => listenNachname(p, props.namen)
const durchWiederholung = (z: StageZeile) => !!props.wiederholt?.ids.has(z.starter.id)
/** Die Erklärung zum Sternchen – nur auf einer Seite, auf der eines steht. */
const sternText = (teile: readonly SeitenTeil[]) => (zeilenDerSeite(props.zeilen, teile).some(({ z }) => durchWiederholung(z)) ? (props.wiederholt?.text ?? '') : '')
// Platz, Nr., Name, Vorname – dann Herkunft, die Summe und die UIM points (wenn gewertet).
const spaltenZahl = computed(() => 4 - (props.namen === 'ohne' ? 2 : 0) + (props.herkunft ? 1 : 0) + (props.ohnePunkte ? 1 : 2))
/** Breite der Herkunft in mm: für Kürzel schmal, für ausgeschriebene Namen breiter (wie auf der Gesamtliste). */
const herkunftMm = computed(() => Math.min(60, Math.max(20, Math.round((props.herkunft?.zeichen ?? 0) * 1.65 + 3))))
</script>

<template>
  <ListenDokument class="ergebnis-blatt" data-art="stage" :laengen="[zeilen.length]" format="landscape" :vorgabe="SEITEN_VORGABE.ergebnisGesamt" :sprache="sprache()" :fuss-mm="ergebnisFussMm(unterschrift)">
    <template #fuss="{ seitenzahl, teile }">
      <ErgebnisFuss :stand="stand" :stand-label="t('results.changed')" :stich="sternText(teile)" :hinweis="hinweisText" :seitenzahl="seitenzahl" :unterschrift="unterschriftTexte" />
    </template>
    <template #default="{ teile }">
      <table class="erg-tabelle erg-tabelle--gesamt">
        <colgroup>
          <col class="erg-w-platz" />
          <col class="erg-w-nr" />
          <col v-if="namen !== 'ohne'" class="erg-w-name" />
          <col v-if="namen !== 'ohne'" class="erg-w-vorname" />
          <col v-if="herkunft" :style="{ width: `${herkunftMm}mm` }" />
          <col style="width: 30mm" />
          <col v-if="!ohnePunkte" style="width: 26mm" />
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
            <th>{{ t('results.place') }}</th>
            <th>{{ t('common.startNr') }}</th>
            <th v-if="namen !== 'ohne'">{{ t('common.lastName') }}</th>
            <th v-if="namen !== 'ohne'">{{ t('common.firstName') }}</th>
            <th v-if="herkunft">{{ herkunft.titel }}</th>
            <th class="erg-gruppe" data-spalte="summe">{{ t('parallel.results.combined') }}</th>
            <th v-if="!ohnePunkte" class="erg-gruppe" data-spalte="uim-punkte">{{ t('results.uimPoints') }}</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="{ z, i } in zeilenDerSeite(zeilen, teile)"
            :key="z.starter.id"
            :class="(i + 1) % 5 === 0 ? 'grau' : undefined"
            :data-starter="z.starter.id"
            :data-wertung="z.disq ? 'disq' : 'gewertet'"
            :data-wiederholt="durchWiederholung(z) ? '' : undefined"
          >
            <td class="erg-platz">{{ z.platz }}<span v-if="durchWiederholung(z)" class="erg-stich-zeichen">*</span></td>
            <td>{{ z.starter.startNr }}</td>
            <td v-if="namen !== 'ohne'">{{ nachname(z.starter) }}</td>
            <td v-if="namen !== 'ohne'">{{ z.starter.vorname }}</td>
            <td v-if="herkunft"><HerkunftText :anzeige="herkunft.anzeige(z.starter)" /></td>
            <td :class="['erg-gruppe', { 'erg-disq': z.disq }]" data-spalte="summe">{{ punkteZelle(z.disq, z.gesamt) }}</td>
            <td v-if="!ohnePunkte" class="erg-gruppe" data-spalte="uim-punkte">{{ z.punkte }}</td>
          </tr>
        </tbody>
      </table>
    </template>
  </ListenDokument>
</template>
