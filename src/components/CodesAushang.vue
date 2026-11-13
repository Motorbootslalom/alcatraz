<script setup lang="ts">
import { computed } from 'vue'
import { useStore } from '../state/store'
import { useKonfig } from '../lib/konfig'

/**
 * Aushang aller Fehler- und Disqualifikations-Codes des Regelwerks als A4-Blatt: zum
 * Aufhängen am Steg und als Nachschlagewerk für die Wettkampfrichter. Vorbild:
 * LegendePage.vue im Fehlerpunkte-Prototyp.
 *
 * Alle Texte kommen aus der Konfiguration (`getLegende()`, config/build.ts) und stehen damit
 * in der Sprache der Bögen – auch zweisprachig. Das Blatt hängt nur am Regelwerk: Es braucht
 * weder Starter noch Startnummern und lässt sich schon vor dem Check-in drucken.
 */
const { state } = useStore()
const konfig = useKonfig()
const legende = computed(() => konfig.value.getLegende())
const eventName = computed(() => [state.value.eventName, state.value.eventJahr].filter(Boolean).join(' '))
// Ohne genannte Quelle steht wenigstens da, nach welchem Regelwerk die Codes gelten.
const quelle = computed(() => legende.value.quelle ?? konfig.value.getRegelwerk().label)
</script>

<template>
  <div class="sheet lg-blatt" :data-regelwerk="konfig.getRegelwerk().id">
    <section class="sheet-section">
      <!-- Kopf wie auf allen Listen: links der Name der Liste, rechts die Veranstaltung. -->
      <div class="sheet-title-box lg-kopf">
        <span class="list">{{ legende.texte.titel }}</span>
        <span class="event">{{ eventName }}</span>
      </div>
      <p class="lg-quelle">{{ quelle }}</p>

      <div class="lg-abschnitt">
        <h3>{{ legende.texte.fehlercodes }}</h3>
        <div class="lg-raster">
          <table v-for="g in legende.gruppen" :key="g.title" class="lg-tabelle">
            <caption>
              {{ g.title }}
            </caption>
            <tbody>
              <tr v-for="e in g.rows" :key="e.code">
                <td class="lg-code">{{ e.code }}</td>
                <td>{{ e.text }}</td>
                <td class="lg-punkte">{{ e.punkte }}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p v-if="legende.fehlerHinweis" class="lg-hinweis">{{ legende.fehlerHinweis }}</p>
      </div>

      <div v-if="legende.direkt.length > 0" class="lg-abschnitt">
        <h3>{{ legende.texte.ohneCode }}</h3>
        <table class="lg-tabelle">
          <tbody>
            <tr v-for="d in legende.direkt" :key="d.titel">
              <td class="lg-titel">{{ d.titel }}</td>
              <td>{{ d.text }}</td>
              <td class="lg-punkte">{{ d.punkte }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div v-if="legende.disq.length > 0" class="lg-abschnitt">
        <h3>{{ legende.texte.disq }}</h3>
        <table class="lg-tabelle" data-tabelle="disq">
          <tbody>
            <tr v-for="d in legende.disq" :key="d.code">
              <td class="lg-code">{{ d.code }}</td>
              <td>{{ d.text }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <ul v-if="legende.hinweise.length > 0" class="lg-hinweise">
        <li v-for="h in legende.hinweise" :key="h">{{ h }}</li>
      </ul>
    </section>
  </div>
</template>
