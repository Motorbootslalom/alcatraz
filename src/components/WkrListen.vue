<script setup lang="ts">
import { computed, ref, useId, watchEffect } from 'vue'
import { merke } from '../lib/merken'
import { useStore } from '../state/store'
import { useKonfig } from '../lib/konfig'
import { useEvent } from '../lib/event'
import { useBogenZoom } from '../lib/bogenZoom'
import { waehleBoegen, wkrBoegenZumStand, type WkrAuswahl } from '../lib/wkrListen'
import { t, tn } from '../i18n'
import type { ClassId } from '../types'
import BogenBlatt from './bogen/BogenBlatt.vue'
import ParcoursNachweis from './ParcoursNachweis.vue'
import { veranstaltungsListen } from '../lib/listen'

/**
 * Die Wettkampfrichter-Listen der Veranstaltung unter „Listen“: je Parcours, Klasse, Lauf
 * und Liste des Aufbaus ein Bogen mit den Startnummern in der Startreihenfolge der
 * Verzahnung (lib/wkrListen.ts). Die Bildschirmansicht ist die Druckansicht; gedruckt wird,
 * was die Auswahl zeigt.
 *
 * `gesperrt`: Startnummern fehlen oder sind doppelt (ListsView.vue zeigt den Hinweis) –
 * dann entsteht kein Bogen, auch nicht über Strg+P: Ein Bogen mit leerer oder doppelter
 * Nummer wäre am Steg nicht zu gebrauchen.
 */
const props = defineProps<{ gesperrt?: boolean }>()
const emit = defineEmits<{
  /** Wie viele Bögen die Auswahl zeigt und wie sie heißt (für Fenstertitel und Dateiname). */
  stand: [stand: { anzahl: number; auswahl: string }]
}>()

const { state } = useStore()
const konfig = useKonfig()
const { classLabel } = useEvent()
const id = useId()

const listen = computed(() => wkrBoegenZumStand(state.value, konfig.value))
const alle = computed(() => listen.value.boegen)

// Was sich wählen lässt, ergibt sich aus den Bögen: nur Parcours, Klassen, Läufe und Listen, die es gibt.
const parcours = computed(() => state.value.parcoursList.filter((p) => alle.value.some((b) => b.parcoursId === p.id)))
const klassen = computed(() => [...new Set(alle.value.flatMap((b) => b.klassen))])
const laeufe = computed(() => [...new Set(alle.value.map((b) => b.lauf))].sort((a, b) => a - b))
const listenArten = computed(() => {
  const titel = new Map(alle.value.map((b) => [b.typeId, b.titel]))
  // Teilen sich zwei Listen den Titel, unterscheidet sie der ausführliche Name aus dem Menü.
  const mehrfach = (text: string) => [...titel.values()].filter((x) => x === text).length > 1
  // In der Reihenfolge der Veranstaltung, nicht in der, in der die Bögen der ersten Klasse sie zufällig bringen.
  const folge = veranstaltungsListen(konfig.value, state.value)
  return [...titel]
    .sort((a, b) => folge.indexOf(a[0]) - folge.indexOf(b[0]))
    .map(([typeId, text]) => ({ typeId, titel: mehrfach(text) ? konfig.value.getSheetDef(typeId).menuLabel : text }))
})

// Eine Wahl, die es nach einer Änderung (Aufbau, Verzahnung, Läufe) nicht mehr gibt, gilt als „alle“.
const wahl = merke<WkrAuswahl>('listen.wkr', {})
const auswahl = computed<WkrAuswahl>(() => ({
  parcours: parcours.value.some((p) => p.id === wahl.value.parcours) ? wahl.value.parcours : undefined,
  klasse: wahl.value.klasse !== undefined && klassen.value.includes(wahl.value.klasse) ? wahl.value.klasse : undefined,
  lauf: wahl.value.lauf !== undefined && laeufe.value.includes(wahl.value.lauf) ? wahl.value.lauf : undefined,
  liste: listenArten.value.some((l) => l.typeId === wahl.value.liste) ? wahl.value.liste : undefined,
}))
const boegen = computed(() => (props.gesperrt ? [] : waehleBoegen(alle.value, auswahl.value)))

function setze<K extends keyof WkrAuswahl>(feld: K, e: Event) {
  const wert = (e.target as HTMLSelectElement).value
  wahl.value = { ...wahl.value, [feld]: wert === '' ? undefined : feld === 'lauf' ? Number(wert) : wert }
}

/** Die Auswahl in Worten, für Fenstertitel und Dateiname – in der Sprache der Oberfläche. */
const auswahlText = computed(() => {
  const a = auswahl.value
  return [
    a.parcours !== undefined ? parcours.value.find((p) => p.id === a.parcours)?.name : undefined,
    a.klasse !== undefined ? classLabel(a.klasse) : undefined,
    a.lauf !== undefined ? t('lists.wkr.runN', { n: a.lauf }) : undefined,
    a.liste !== undefined ? listenArten.value.find((l) => l.typeId === a.liste)?.titel : undefined,
  ]
    .filter(Boolean)
    .join(' - ')
    // Der Titel wird zum Dateinamen des PDF: „Tor 1 / 3 / 5“ ergäbe dort „Tor 1 _ 3 _ 5“.
    .replace(/\s*[/\\:]\s*/g, '-')
})
watchEffect(() => emit('stand', { anzahl: boegen.value.length, auswahl: auswahlText.value }))

const mitBild = computed(() => boegen.value.some((b) => konfig.value.getSheetDef(b.typeId).bildErzeugen))
const ohneListe = computed(() => listen.value.ohneListe.map((k: ClassId) => classLabel(k)).join(', '))
const stapel = ref<HTMLElement | null>(null)
const { zoom } = useBogenZoom(stapel)
</script>

<template>
  <div v-if="!gesperrt" class="panel no-print wkr-listen-wahl">
    <p class="hint">{{ t('lists.wkr.hint') }}</p>
    <p v-if="state.eventKind === 'club'" class="note">{{ state.wkrClubGemeinsam ? t('lists.wkr.clubJoint') : t('lists.wkr.club') }}</p>
    <div class="row wkr-listen-leiste">
      <div v-if="state.parcoursList.length > 1" class="field">
        <label :for="`${id}-parcours`">{{ t('lists.wkr.parcours') }}</label>
        <select :id="`${id}-parcours`" class="input" data-feld="wkr-parcours" :value="auswahl.parcours ?? ''" @change="setze('parcours', $event)">
          <option value="">{{ t('lists.wkr.all') }}</option>
          <option v-for="p in parcours" :key="p.id" :value="p.id">{{ p.name }}</option>
        </select>
      </div>
      <div class="field">
        <label :for="`${id}-klasse`">{{ t('lists.class') }}</label>
        <select :id="`${id}-klasse`" class="input" data-feld="wkr-klasse" :value="auswahl.klasse ?? ''" @change="setze('klasse', $event)">
          <option value="">{{ t('lists.wkr.all') }}</option>
          <option v-for="k in klassen" :key="k" :value="k">{{ classLabel(k) }}</option>
        </select>
      </div>
      <div class="field">
        <label :for="`${id}-lauf`">{{ t('lists.wkr.run') }}</label>
        <select :id="`${id}-lauf`" class="input" data-feld="wkr-lauf" :value="auswahl.lauf ?? ''" @change="setze('lauf', $event)">
          <option value="">{{ t('lists.wkr.all') }}</option>
          <option v-for="l in laeufe" :key="l" :value="l">{{ t('lists.wkr.runN', { n: l }) }}</option>
        </select>
      </div>
      <div class="field">
        <label :for="`${id}-liste`">{{ t('lists.wkr.list') }}</label>
        <select :id="`${id}-liste`" class="input" data-feld="wkr-liste" :value="auswahl.liste ?? ''" @change="setze('liste', $event)">
          <option value="">{{ t('lists.wkr.all') }}</option>
          <option v-for="l in listenArten" :key="l.typeId" :value="l.typeId">{{ l.titel }}</option>
        </select>
      </div>
      <p class="note wkr-listen-stand" role="status">{{ tn('lists.wkr.count', boegen.length) }}</p>
    </div>
    <p v-if="ohneListe" class="boat-banner warn" role="status">
      {{ t('lists.wkr.without', { classes: ohneListe }) }} <a href="#/verzahnung">{{ t('nav.verzahnung') }}</a>
    </p>
    <p v-if="state.wkrRueckseite" class="boat-banner ok" role="status">{{ t('lists.wkr.duplex') }}</p>
    <p class="note">
      {{ t('lists.wkr.settings') }} <a href="#/einstellungen?wkr">{{ t('nav.einstellungen') }}</a
      >.
    </p>
  </div>

  <div v-if="!gesperrt && alle.length > 0 && boegen.length === 0" class="panel empty no-print">{{ t('lists.wkr.noSheets') }}</div>

  <!-- Immer da, auch leer: Der Stapel misst seine Breite ab dem Einhängen (lib/bogenZoom.ts). -->
  <div ref="stapel" class="bogen-stapel wkr-listen" :style="zoom">
    <BogenBlatt v-for="b in boegen" :key="b.id" :konfig="konfig" :auftrag="b.auftrag" :optionen="b.optionen" :rueckseite="state.wkrRueckseite" />
  </div>
  <div v-if="mitBild" class="no-print"><ParcoursNachweis /></div>
</template>
