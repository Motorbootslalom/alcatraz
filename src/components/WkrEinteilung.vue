<script setup lang="ts">
import { computed, ref } from 'vue'
import { useStore } from '../state/store'
import { useKonfig } from '../lib/konfig'
import { useEvent } from '../lib/event'
import { einteilungsListen, listeGilt } from '../lib/einteilung'
import { t } from '../i18n'
import type { Parcours } from '../types'

/**
 * WKR-Einteilung (Vorbild: WkrEinteilung.vue im Fehlerpunkte-Prototyp,
 * KONZEPT-NAMEN-FREIHAND.md §1): Namen der Wettkampfrichter je Liste des gewählten Aufbaus,
 * einmal eingetragen statt auf jedem Bogen.
 *
 * Anders als im Prototyp gibt es hier keinen Haken „Zwei Parcours“ und keine eigene
 * Zuordnung der Klassen: Die Spalten sind die Parcours der Verzahnung. Welche Klassen dort
 * fahren, wird nur gezeigt – geändert wird es unter „Verzahnung“, damit es eine Stelle gibt.
 *
 * Der Abschnitt steht unter „Einstellungen“ (Wunsch des Nutzers: nicht unter
 * „Veranstaltung“). Die Beispielansicht der Listen (WkrVorschau.vue, unter den
 * Aufbauten) trägt denselben Namen im Bogenkopf; auch dort lässt er sich eintragen.
 */
const { state, dispatch } = useStore()
const konfig = useKonfig()
const { classLabel } = useEvent()

const parcours = computed(() => state.value.parcoursList)
const listen = computed(() => einteilungsListen(konfig.value, state.value.aufbau))
const gruppen = computed(() => [
  { id: 'aufbau', zeilen: listen.value.aufbau },
  { id: 'weitere', zeilen: listen.value.weitere },
])

/** Hat eine Klasse dieses Parcours die Liste? Sonst steht ein Strich statt eines Feldes. */
const gilt = (typeId: string, p: Parcours) => listeGilt(konfig.value, typeId, p.classIds)
const klassenText = (p: Parcours) => (p.classIds.length > 0 ? p.classIds.map(classLabel).join(', ') : t('wkr.noClasses'))

function setze(p: Parcours, typeId: string, name: string) {
  dispatch({ type: 'SET_WKR_NAME', parcoursId: p.id, typeId, name })
}

// Enter springt ins nächste Feld – erst den Parcours hinunter (so steht es meist auf dem
// Zettel: ein Parcours, alle seine Wettkampfrichter), dann zum nächsten Parcours.
const tabelle = ref<HTMLTableElement>()
const feldId = (p: Parcours, typeId: string) => `${p.id}|${typeId}`
const reihenfolge = computed(() =>
  parcours.value.flatMap((p) =>
    [...listen.value.aufbau, ...listen.value.weitere].filter((l) => gilt(l.id, p)).map((l) => feldId(p, l.id)),
  ),
)
function weiter(p: Parcours, typeId: string) {
  const i = reihenfolge.value.indexOf(feldId(p, typeId))
  const naechstes = reihenfolge.value[i + 1]
  if (!naechstes) return
  const feld = [...(tabelle.value?.querySelectorAll<HTMLInputElement>('input[data-feld]') ?? [])].find((x) => x.dataset.feld === naechstes)
  feld?.focus()
  feld?.select()
}
</script>

<template>
  <div id="wkr-einteilung" class="panel wkr-einteilung">
    <h2>{{ t('wkr.title') }}</h2>
    <p class="hint">{{ t('wkr.intro') }}</p>
    <p v-if="parcours.length === 0" class="boat-banner warn" role="status">
      {{ t('wkr.noParcours') }} <a href="#/verzahnung">{{ t('nav.verzahnung') }}</a>
    </p>
    <div v-else class="assistent-rahmen">
      <table ref="tabelle" class="assistent-tabelle wkr-tabelle">
        <thead>
          <tr>
            <th scope="col" class="zeilenkopf">{{ t('wkr.list') }}</th>
            <th v-for="p in parcours" :key="p.id" scope="col">
              <strong>{{ p.name }}</strong>
              <small>{{ klassenText(p) }}</small>
            </th>
          </tr>
        </thead>
        <tbody v-for="g in gruppen" :key="g.id">
          <tr v-if="g.id === 'weitere' && g.zeilen.length > 0" class="wkr-gruppe">
            <th :colspan="parcours.length + 1" scope="colgroup">{{ t('wkr.moreLists') }}</th>
          </tr>
          <tr v-for="l in g.zeilen" :key="l.id">
            <th scope="row" class="zeilenkopf">{{ l.titel }}</th>
            <td v-for="p in parcours" :key="p.id">
              <input
                v-if="gilt(l.id, p)"
                class="cell-input"
                autocomplete="off"
                :data-feld="feldId(p, l.id)"
                :value="state.einteilung[p.id]?.[l.id] ?? ''"
                :placeholder="t('wkr.name')"
                :aria-label="t('wkr.nameFor', { list: l.titel, parcours: p.name })"
                @input="setze(p, l.id, ($event.target as HTMLInputElement).value)"
                @keydown.enter.prevent="weiter(p, l.id)"
              />
              <span v-else class="wkr-entfaellt" :title="t('wkr.notUsed')">
                <span aria-hidden="true">–</span><span class="sr-only">{{ t('wkr.notUsed') }}</span>
              </span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    <p class="note">
      {{ t('wkr.classesNote') }} <a href="#/verzahnung">{{ t('nav.verzahnung') }}</a>
    </p>
    <p class="note">{{ t('wkr.privacyNote') }}</p>
  </div>
</template>
