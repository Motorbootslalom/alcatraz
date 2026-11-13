<script setup lang="ts">
import { computed } from 'vue'
import { abstaende, type AbstandArt, type ErgebnisGruppe, type LaufZeile } from '../../lib/ergebnis'
import { abstandTitel, abstandZelle, punkteZelle, sekundenText, spaltenText, zeitText } from '../../lib/ergebnisText'
import { formatDate, t } from '../../i18n'
import type { Starter } from '../../types'

/**
 * Ergebnisliste eines Laufs (A4 quer): je Starter die Punkte an jeder Stelle des Fahrwegs –
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
  herkunft?: { titel: string; text: (p: Starter) => string; zeichen: number }
  geburtsdatum?: boolean
}>()

const zweizeilig = computed(() => props.gruppen.some((g) => g.mitUnter))
const kopfZeilen = computed(() => (zweizeilig.value ? 2 : 1))
const blaetter = computed(() => props.gruppen.flatMap((g) => g.blaetter.map((b, bi) => ({ erste: bi === 0, label: b.label }))))
// Platz, S-Nr., Name, Vorname, Zeit, Punkte + Fahrweg + disq., ges. Punkte, Fehler-Schlüssel
const spaltenZahl = computed(() => 9 + (props.herkunft ? 1 : 0) + (props.geburtsdatum ? 1 : 0) + (props.abstand ? 1 : 0) + blaetter.value.length)
// Der Abstand hängt nur von den Punkten ab, nicht von der Reihenfolge der Liste.
const abstandWerte = computed(() => (props.abstand ? abstaende(props.zeilen, props.abstand) : []))
/** Lange Namen werden kleiner gesetzt statt umbrochen (wie auf den Startlisten). */
// Breite der Herkunft-Spalte in mm: für Kürzel schmal, für ausgeschriebene Namen breiter.
const herkunftMm = computed(() => Math.min(30, Math.max(11, Math.round((props.herkunft?.zeichen ?? 0) * 1.2 + 3))))
const fit = (text: string, normal: number) => (text.length > normal * 1.4 ? 'fit-2' : text.length > normal ? 'fit-1' : undefined)
</script>

<template>
  <section class="ergebnis-blatt" data-art="lauf">
    <table class="erg-tabelle">
      <colgroup>
        <col class="erg-w-platz" />
        <col class="erg-w-nr" />
        <col class="erg-w-name" />
        <col class="erg-w-vorname" />
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
          <th :rowspan="kopfZeilen">{{ t('common.lastName') }}</th>
          <th :rowspan="kopfZeilen">{{ t('common.firstName') }}</th>
          <th v-if="herkunft" :rowspan="kopfZeilen">{{ herkunft.titel }}</th>
          <th v-if="geburtsdatum" :rowspan="kopfZeilen">{{ t('common.birthdate') }}</th>
          <th :rowspan="kopfZeilen">{{ t('results.time') }}</th>
          <th :rowspan="kopfZeilen">{{ t('results.points') }}</th>
          <template v-for="(g, gi) in gruppen" :key="gi">
            <th v-if="g.mitUnter" :colspan="g.blaetter.length" class="erg-gruppe">{{ spaltenText(g.label) }}</th>
            <th v-else :rowspan="kopfZeilen" class="erg-gruppe">{{ spaltenText(g.label) }}</th>
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
        <tr v-for="(z, i) in zeilen" :key="z.starter.id" :class="(i + 1) % 5 === 0 ? 'grau' : undefined" :data-starter="z.starter.id" :data-wertung="z.disq ? 'disq' : z.offen ? 'offen' : 'gewertet'">
          <td class="erg-platz">{{ z.platz }}</td>
          <td>{{ z.starter.startNr }}</td>
          <td :class="fit(z.starter.nachname, 14)">{{ z.starter.nachname }}</td>
          <td :class="fit(z.starter.vorname, 12)">{{ z.starter.vorname }}</td>
          <td v-if="herkunft" :class="fit(herkunft.text(z.starter), Math.floor((herkunftMm - 2) / 1.2))">{{ herkunft.text(z.starter) }}</td>
          <td v-if="geburtsdatum">{{ z.starter.geburtsdatum ? formatDate(z.starter.geburtsdatum) : '' }}</td>
          <td>{{ zeitText(z.zeit) }}</td>
          <td>{{ sekundenText(z.zeit) }}</td>
          <td v-for="(b, bi) in blaetter" :key="bi" :class="[{ 'erg-gruppe': b.erste }, fit(z.zellen[bi], 2)]">{{ z.zellen[bi] }}</td>
          <td class="erg-gruppe">{{ z.disq ? 'x' : '' }}</td>
          <td :class="{ 'erg-disq': z.disq }">{{ punkteZelle(z.disq, z.gesamt) }}</td>
          <td v-if="props.abstand">{{ abstandZelle(abstandWerte[i]) }}</td>
          <td :class="fit(z.schluessel, 9)">{{ z.schluessel }}</td>
        </tr>
      </tbody>
    </table>
  </section>
</template>
