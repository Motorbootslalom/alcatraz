<script setup lang="ts">
import { computed } from 'vue'
import KopfLogos from './KopfLogos.vue'
import { useStore } from '../state/store'
import { useEvent } from '../lib/event'
import { useListenSprache } from '../lib/listensprache'
import { SEITEN_VORGABE } from '../lib/seiten'
import type { AusgleichListe } from '../lib/ausgleich'
import type { ClassId } from '../types'
import ListenDokument from './ListenDokument.vue'

/**
 * „Ausgleichsgewichte“ – die Gewichtsliste für den Steg (lib/ausgleich.ts): je Klasse ein
 * eigenes Dokument im Hochformat, nach Startnummer, mit dem Ausgleichsgewicht und einem
 * Kästchen zum Abhaken je Lauf. Vorbild sind die Blätter „Gewichte_Druck_K…“ der Excel-Mappe;
 * der Kopf folgt den übrigen Listen (jede Angabe in einem eigenen Feld): Liste | Klasse |
 * Boot | Co-Pilot | Veranstaltung. Boot und Co-Pilot kommen aus der Besetzung; ohne Eintrag
 * bleibt ihr Feld leer zum Eintragen von Hand. Den Co-Piloten gibt es nur, wo das Regelwerk
 * ihn vorsieht oder einer eingetragen ist. Wer nicht gewogen ist, bekommt ein Feld zum Nachtragen
 * von Hand (klein „nicht gewogen“, rechts „kg“; Nutzer 24.11.2026) – digital kommt ein in der
 * Verwiegung nachgetragenes Gewicht von selbst aufs Steg-Gerät (wkr/sicht.ts `ausgleich`).
 *
 * Alles auf dem Blatt steht in der Sprache des Regelwerks (lib/listensprache.ts). Der Name
 * folgt dem Reglement (DM C3 „Ausgleichsgewichte“, UIM 960 Pkt. 3.7 „extra weight“).
 */
defineProps<{ listen: AusgleichListe[] }>()

const { state } = useStore()
const { regelwerk, classCell } = useEvent()
const { t: lt, listenLocale } = useListenSprache()

const heading = computed(() => [state.value.eventName, state.value.eventJahr].filter(Boolean).join(' '))
const runs = computed(() => Array.from({ length: state.value.laufCount }, (_, i) => i + 1))
const klasseText = (k: ClassId) => regelwerk.value.klassenNamen[k] ?? lt('common.class', { id: k })

// Lange Namen kleiner statt umbrochen – wie auf den Starterlisten (views/ListsView.vue).
const fit = (text: string, normal: number) => (text.length > normal * 1.9 ? 'fit-3' : text.length > normal * 1.35 ? 'fit-2' : text.length > normal ? 'fit-1' : '')
/** Der längste Text einer Spalte: hält die Spalten auf allen Seiten eines Dokuments gleich breit (Maßzeile). */
const laengster = (texte: string[]) => texte.reduce((a, b) => (b.length > a.length ? b : a), '')
</script>

<template>
  <div class="sheet ausgleich">
    <!-- Je Klasse ein Dokument: Es teilt sich selbst in Seiten und zählt nur die eigenen. -->
    <div v-for="l in listen" :key="l.klasse" class="sheet-section" :data-liste="`ausgleich:${l.klasse}`">
      <ListenDokument v-slot="{ teile }" class="sheet-page" :laengen="[l.zeilen.length]" format="portrait" :vorgabe="SEITEN_VORGABE.ausgleich" :sprache="listenLocale">
        <table class="sheet-table">
          <thead>
            <tr class="sheet-title">
              <th :colspan="5 + runs.length">
                <KopfLogos>
                  <div class="sheet-title-box">
                    <!-- Das Leerzeichen trennt die Felder im Text (kopiert, vorgelesen, aus dem PDF gelesen). -->
                    <span class="list" data-feld="liste">{{ lt('lists.title.ausgleich') }}</span>{{ ' ' }}
                    <span class="feld" data-feld="klasse">{{ klasseText(l.klasse) }}</span>{{ ' ' }}
                    <span class="feld benannt" data-feld="boot"><small>{{ lt('lists.boat') }}</small>{{ ' ' }}<span class="wert">{{ l.boot }}</span></span>{{ ' ' }}
                    <span v-if="l.coPilot !== undefined" class="feld benannt" data-feld="coPilot"><small>{{ lt('lists.coPilot') }}</small>{{ ' ' }}<span class="wert">{{ l.coPilot }}</span></span>{{ ' ' }}
                    <span class="event" data-feld="veranstaltung">{{ heading }}</span>
                  </div>
                </KopfLogos>
              </th>
            </tr>
            <tr class="sheet-cols">
              <th class="narrow">{{ lt('common.startNr') }}</th>
              <th>{{ lt('common.lastName') }}</th>
              <th>{{ lt('common.firstName') }}</th>
              <th class="weight">{{ lt('lists.ballast') }}</th>
              <th class="narrow">{{ lt('lists.class') }}</th>
              <th v-for="r in runs" :key="r" class="check">{{ lt('lists.wkr.runN', { n: r }) }}</th>
            </tr>
            <tr class="sheet-mass" aria-hidden="true">
              <td class="narrow">{{ laengster(l.zeilen.map((z) => z.starter.startNr)) }}</td>
              <td :class="fit(laengster(l.zeilen.map((z) => z.starter.nachname)), 18)">{{ laengster(l.zeilen.map((z) => z.starter.nachname)) }}</td>
              <td :class="fit(laengster(l.zeilen.map((z) => z.starter.vorname)), 18)">{{ laengster(l.zeilen.map((z) => z.starter.vorname)) }}</td>
              <td class="weight" />
              <td class="narrow">{{ classCell(l.klasse) }}</td>
              <td v-for="r in runs" :key="r" class="check" />
            </tr>
          </thead>
          <tbody v-for="teil in teile" :key="teil.block">
            <!-- Jede fünfte Zeile grau, über das Dokument durchgezählt. -->
            <tr v-for="(z, i) in l.zeilen.slice(teil.von, teil.bis)" :key="z.starter.id" :class="{ shade: (teil.von + i + 1) % 5 === 0 }" :data-ausgleich="z.ausgleich === undefined ? 'ungewogen' : (z.ausgleich ?? '')">
              <td class="narrow">{{ z.starter.startNr }}</td>
              <td :class="fit(z.starter.nachname, 18)">{{ z.starter.nachname }}</td>
              <td :class="fit(z.starter.vorname, 18)">{{ z.starter.vorname }}</td>
              <!-- Leer heißt „kein Ausgleichsgewicht nötig“ – wer nicht gewogen ist, steht deshalb ausdrücklich da.
                   Seit 24.11.2026 (Nutzer: „bei einer Papierliste manuell nachgetragen“, WKR_ANNAHMEN AG2) nur noch
                   klein oben in der Ecke: Der Rest der Zelle bleibt frei zum Eintragen von Hand, „kg“ steht rechts. -->
              <td v-if="z.ausgleich === undefined" class="weight ungewogen"><span class="ungewogen-vermerk">{{ lt('lists.notWeighed') }}</span>{{ ' ' }}<span class="ungewogen-kg">kg</span></td>
              <!-- Auf 0 kg gerundet (z. B. 64,6 kg bei 65 kg) heißt wie „gewogen, keines nötig“ leer – so liest das
                   Steg-Gerät denselben Starter als „kein AG“ (Prüfbefund 24.11.2026, WKR_ANNAHMEN AG2, noch zu
                   bestätigen; vorher stand „0 kg“). Die Verwiegung zeigt weiter „0 kg“ (WeighingView). -->
              <td v-else class="weight ausgleich-kg">{{ z.ausgleich ? `${z.ausgleich} kg` : '' }}</td>
              <td class="narrow">{{ classCell(z.starter.klasse) }}</td>
              <td v-for="r in runs" :key="r" class="check" />
            </tr>
          </tbody>
        </table>
      </ListenDokument>
    </div>
  </div>
</template>
