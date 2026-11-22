<script setup lang="ts">
import type { SchlangenEintrag, ZuletztZeile } from '../../geraete/erfassen'
import type { MaskenBild } from '../../wkr/sicht'
import WkrParcoursBild from './WkrParcoursBild.vue'
import { stufeZeichen, useWkrText } from './texte'

/**
 * Seitenspalte auf dem Pad (W5.1, Plan docs/plan-wkr-w5.md §4.2, 22.11.2026; WKR_ANNAHMEN PD3, PD6): Schlange, „Zuletzt“
 * als Liste und die **Einträge im Klartext** – die Kontrolle „was dort steht, wird abgeschickt“ (Vorschlag §4.2).
 * `kompakt` (ab zwei Spalten, PD3): nur Schlange und Einträge unter der Arbeitsfläche, ohne „Zuletzt“-Liste und ohne
 * Zeichnung (die Leiste „Zuletzt“ der Maske bleibt). Liest nur, was WkrMaske reicht; jede Wahl geht als Ereignis
 * zurück – Start wählen (`waehle`, wie Ausweichen), Suche öffnen (`suche` → WkrAusweichen), Korrigieren (`korrigiere`,
 * wie „Zuletzt“). Keine eigenen Zustände außer der Anzeige; kein Starter-Name, nie (F6). Auf dem Handy gibt es sie
 * nicht – dort bleiben Leiste und Ausweichen.
 */
defineProps<{
  /** Aktiver Start (Karte) und die nächsten der Schlange. */
  aktuell: Pick<SchlangenEintrag, 'key' | 'startNr'> | null
  aktuellKlasse: string
  naechste: SchlangenEintrag[]
  klasseVon: (e: SchlangenEintrag) => string
  /** Eigene Zeilen dieser Liste, neueste zuerst (wie „Zuletzt“). */
  zeilen: ZuletztZeile[]
  text: (z: ZuletztZeile) => string
  /** Einträge des Entwurfs als Text (texte.ts zellenText) und ihre Punkte (Σ, `null` = keine Punkte bei dieser Art). */
  eintraege: string | null
  punkte: number | null
  kompakt?: boolean
  /** Parcours-Zeichnung der Klasse (PD6): nur in der eigenen Seitenspalte. */
  bild?: MaskenBild | null
  gesperrt?: boolean
}>()
const emit = defineEmits<{ waehle: [key: string]; suche: []; korrigiere: [z: number] }>()
const { w } = useWkrText()
</script>

<template>
  <aside class="wkr-seite" data-teil="seite" :data-kompakt="kompakt || undefined" :aria-label="w('wkr.geraet.seite')">
    <section class="wkr-seite-block" data-teil="seite-schlange">
      <h2 class="wkr-seite-titel">{{ w('wkr.geraet.seite.schlange') }}</h2>
      <ol class="wkr-seite-liste">
        <li v-if="aktuell" class="wkr-seite-zeile wkr-seite-zeile--aktiv" data-teil="seite-aktiv" :data-start="aktuell.key">
          <span class="wkr-seite-nr">› {{ aktuell.startNr }}</span>
          <span>{{ aktuellKlasse }}</span>
          <b>{{ w('wkr.geraet.seite.aktiv') }}</b>
        </li>
        <li v-for="e in naechste" :key="e.key" class="wkr-seite-zeile">
          <button type="button" class="wkr-knopf wkr-seite-knopf" data-ziel="klein" data-action="seite-waehle" :data-start="e.key" :disabled="gesperrt" @click="emit('waehle', e.key)">
            <span class="wkr-seite-nr">{{ e.startNr }}</span>
            <span>{{ klasseVon(e) }}</span>
          </button>
        </li>
      </ol>
      <button type="button" class="wkr-knopf wkr-knopf--breit" data-ziel="klein" data-action="seite-suche" :disabled="gesperrt" @click="emit('suche')">{{ w('wkr.geraet.suche') }}</button>
    </section>

    <section class="wkr-seite-block" data-teil="seite-eintraege" aria-live="polite">
      <h2 class="wkr-seite-titel">{{ w('wkr.geraet.seite.eintraege') }}</h2>
      <p class="wkr-seite-text" data-teil="seite-eintraege-text">{{ eintraege ?? '–' }}</p>
      <p v-if="punkte !== null" class="wkr-seite-summe" data-teil="seite-summe">Σ {{ w('wkr.geraet.seite.punkte', { n: punkte }) }}</p>
    </section>

    <section v-if="!kompakt && zeilen.length > 0" class="wkr-seite-block" data-teil="seite-zuletzt">
      <h2 class="wkr-seite-titel">{{ w('wkr.geraet.zuletzt') }}</h2>
      <ol class="wkr-seite-liste">
        <li v-for="z in zeilen" :key="z.z" class="wkr-seite-zeile" :data-z="z.z" :data-stufe="z.stufe.stufe">
          <button type="button" class="wkr-knopf wkr-seite-knopf" data-ziel="klein" data-action="seite-korrigieren" :disabled="gesperrt" @click="emit('korrigiere', z.z)">
            <span class="wkr-seite-nr">{{ z.sn ?? '?' }} {{ stufeZeichen(z.stufe) }}</span>
            <span class="wkr-seite-text">{{ text(z) }}</span>
          </button>
        </li>
      </ol>
    </section>

    <WkrParcoursBild v-if="!kompakt && bild" :bild="bild" :klasse="aktuellKlasse" />
  </aside>
</template>
