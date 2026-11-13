<script setup lang="ts">
import { computed } from 'vue'
import { abstaende, type AbstandArt, type GesamtZeile } from '../../lib/ergebnis'
import { abstandTitel, abstandZelle, punkteZelle, zeitText } from '../../lib/ergebnisText'
import { formatDate, t } from '../../i18n'
import type { Starter } from '../../types'

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
  abstand?: AbstandArt
  herkunft?: { titel: string; text: (p: Starter) => string; zeichen: number }
  /** Namen: voll, Nachname gekürzt („M.“) oder gar nicht (Aushang – dann steht nur die Startnummer da). */
  namen?: 'voll' | 'kurz' | 'ohne'
  geburtsdatum?: boolean
  /**
   * Wann sich die Liste zuletzt geändert hat (lib/listenStand.ts), schon als Text. Steht
   * im Kopf der Liste, auch im Druck: Hängen zwei Fassungen aus, zeigt er die neuere – der
   * Zeitpunkt im Seitenrand ist dagegen nur der des Drucks. Leer = unbekannt, dann steht nichts da.
   */
  stand?: string
}>()

/** Für den Aushang lässt sich der Nachname auf den Anfangsbuchstaben kürzen. */
const nachname = (p: Starter) => (props.namen === 'kurz' && p.nachname.trim() ? `${[...p.nachname.trim()][0]}.` : p.nachname)

const spaltenZahl = computed(
  () => 6 - (props.namen === 'ohne' ? 2 : 0) + (props.mitKnoten ? 1 : 0) + (props.herkunft ? 1 : 0) + (props.geburtsdatum ? 1 : 0) + (props.abstand ? 1 : 0) + props.laeufe.length * 4,
)
const abstandWerte = computed(() => (props.abstand ? abstaende(props.zeilen, props.abstand) : []))
const gestrichen = (z: GesamtZeile, li: number) => z.gestrichen.includes(props.laeufe[li])
// Breite der Herkunft-Spalte in mm: für Kürzel schmal, für ausgeschriebene Namen breiter.
const herkunftMm = computed(() => Math.min(48, Math.max(20, Math.round((props.herkunft?.zeichen ?? 0) * 1.2 + 3))))
const fit = (text: string, normal: number) => (text.length > normal * 1.4 ? 'fit-2' : text.length > normal ? 'fit-1' : undefined)
</script>

<template>
  <section class="ergebnis-blatt" data-art="gesamt">
    <table class="erg-tabelle erg-tabelle--gesamt">
      <colgroup>
        <col class="erg-w-platz" />
        <col class="erg-w-nr" />
        <col v-if="namen !== 'ohne'" class="erg-w-name" />
        <col v-if="namen !== 'ohne'" class="erg-w-vorname" />
        <col v-if="herkunft" class="erg-w-herkunft" :style="{ width: `${herkunftMm}mm` }" />
        <col v-if="geburtsdatum" class="erg-w-geb" />
        <template v-for="l in laeufe" :key="l">
          <col class="erg-w-zeit" />
          <col class="erg-w-strafp" />
          <col class="erg-w-ges" />
          <col class="erg-w-platz" />
        </template>
        <col class="erg-w-ergebnis" />
        <col v-if="mitKnoten" class="erg-w-knoten" />
        <col class="erg-w-ergebnis" />
        <col v-if="props.abstand" class="erg-w-abstand" />
      </colgroup>
      <thead>
        <tr>
          <th class="erg-kopfzelle" :colspan="spaltenZahl">
            <div :class="['erg-kopf', { 'erg-kopf--stand': stand }]">
              <span class="erg-kopf-klasse">{{ klasseText }}</span>
              <span class="erg-kopf-titel">{{ t('results.overall') }}</span>
              <span class="erg-kopf-event">{{ eventName }}</span>
              <!-- Im Kopf, nicht unter der Liste: Dort kostete er Höhe und schöbe bei voller Seite
                   die letzte Zeile aufs nächste Blatt. Der Kopf kehrt zudem auf jeder Seite wieder. -->
              <span v-if="stand" class="erg-stand">{{ t('results.changed', { time: stand }) }}</span>
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
          <th v-for="l in laeufe" :key="l" colspan="4" class="erg-gruppe">{{ t('lists.wkr.runN', { n: l }) }}</th>
          <th rowspan="2" class="erg-gruppe">{{ t('results.result') }}</th>
          <th v-if="mitKnoten" rowspan="2">{{ t('results.knots') }}</th>
          <th rowspan="2">{{ t('results.overall') }}</th>
          <th v-if="props.abstand" rowspan="2">
            {{ t('results.gap') }}<br /><small>{{ abstandTitel(props.abstand) }}</small>
          </th>
        </tr>
        <tr class="erg-unterkopf erg-unterkopf--gesamt">
          <template v-for="l in laeufe" :key="l">
            <th class="erg-gruppe">{{ t('results.runTime') }}</th>
            <th>{{ t('results.penalty') }}</th>
            <th>{{ t('results.sum') }}</th>
            <th>{{ t('results.place') }}</th>
          </template>
        </tr>
      </thead>
      <tbody>
        <tr v-for="(z, i) in zeilen" :key="z.starter.id" :class="(i + 1) % 5 === 0 ? 'grau' : undefined" :data-starter="z.starter.id" :data-wertung="z.disq ? 'disq' : z.offen ? 'offen' : 'gewertet'">
          <td class="erg-platz">{{ z.platz }}</td>
          <td>{{ z.starter.startNr }}</td>
          <td v-if="namen !== 'ohne'" :class="fit(nachname(z.starter), 14)">{{ nachname(z.starter) }}</td>
          <td v-if="namen !== 'ohne'" :class="fit(z.starter.vorname, 12)">{{ z.starter.vorname }}</td>
          <td v-if="herkunft" :class="fit(herkunft.text(z.starter), Math.floor((herkunftMm - 2) / 1.2))">{{ herkunft.text(z.starter) }}</td>
          <td v-if="geburtsdatum">{{ z.starter.geburtsdatum ? formatDate(z.starter.geburtsdatum) : '' }}</td>
          <template v-for="(l, li) in z.laeufe" :key="li">
            <td :class="['erg-gruppe', { 'erg-gestrichen': gestrichen(z, li) }]">{{ zeitText(l.zeit) }}</td>
            <td :class="{ 'erg-gestrichen': gestrichen(z, li) }">{{ l.strafpunkte || '' }}</td>
            <td :class="{ 'erg-gestrichen': gestrichen(z, li), 'erg-disq': l.disq }">{{ punkteZelle(l.disq, l.gesamt) }}</td>
            <td>{{ l.platz }}</td>
          </template>
          <td :class="['erg-gruppe', { 'erg-disq': z.disq }]">{{ punkteZelle(z.disq, z.ergebnis) }}</td>
          <td v-if="mitKnoten">{{ z.knoten || '' }}</td>
          <td :class="{ 'erg-disq': z.disq }">{{ punkteZelle(z.disq, z.gesamt) }}</td>
          <td v-if="props.abstand">{{ abstandZelle(abstandWerte[i]) }}</td>
        </tr>
      </tbody>
    </table>
  </section>
</template>
