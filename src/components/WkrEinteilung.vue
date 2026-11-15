<script setup lang="ts">
import { computed, ref } from 'vue'
import { useStore } from '../state/store'
import { useBogenKonfig, useKonfig } from '../lib/konfig'
import { useEvent } from '../lib/event'
import { einteilungsListen, listeGilt } from '../lib/einteilung'
import { t } from '../i18n'
import { adresse } from '../lib/router'
import { bietetEnglisch, regelwerkSprache, wkrSpracheFuer } from '../lib/listensprache'
import { SPRACHEN } from '../config/sprache'
import { parallelListen } from '../lib/parallelBogen'
import { RACECOURSE_PARCOURS, RACECOURSES, type Racecourse } from '../lib/parallelSchluessel'
import type { Parcours, Sprache } from '../types'

/**
 * WKR-Einteilung (Vorbild: WkrEinteilung.vue im Fehlerpunkte-Prototyp,
 * KONZEPT-NAMEN-FREIHAND.md §1): Namen der Wettkampfrichter je Liste des gewählten Aufbaus,
 * einmal eingetragen statt auf jedem Bogen.
 *
 * Anders als im Prototyp gibt es hier keinen Haken „Zwei Parcours“ und keine eigene
 * Zuordnung der Klassen: Die Spalten sind die Parcours der Verzahnung. Welche Klassen dort
 * fahren, wird nur gezeigt – geändert wird es unter „Verzahnung“, damit es eine Stelle gibt.
 *
 * Der Abschnitt steht im Block „Besetzung“ der Ansicht „Veranstaltung“
 * (BesetzungPanel.vue), neben Booten und Co-Piloten: Für einen gewöhnlichen Wettkampf soll
 * niemand in die Einstellungen wechseln müssen (Wunsch des Nutzers; vorher stand er dort).
 * `eingebettet` macht ihn zum Unterabschnitt – ohne eigenen Rahmen, die Überschrift eine
 * Stufe tiefer. Die Beispielansicht der Listen (WkrVorschau.vue) trägt denselben Namen im
 * Bogenkopf; auch dort lässt er sich eintragen.
 *
 * Hier steht auch die Sprache des Bogens je Liste (deutsch, englisch, zweisprachig): Sie
 * hängt daran, wer an der Position sitzt – also neben dem Namen. Wählbar nur, wo das
 * Regelwerk Englisch anbietet (lib/listensprache.ts); „alle auf …“ stellt alle Listen um.
 *
 * Parallelslalom (nur unter einem Regelwerk, das ihn kennt): eine zweite Tabelle mit den
 * race officials der beiden Racecourses A und B – je Racecourse Zeit, Steg (pontoon) und
 * Fahrweg. Das ist Organisation, nicht Regel 960; die Namen stehen in derselben Einteilung
 * unter der Kennung des Racecourse (lib/parallelSchluessel.ts). Die Sprache einer Liste gilt
 * für ihren Bogen in beiden Disziplinen (Zeit und Steg gibt es in beiden).
 */
defineProps<{ eingebettet?: boolean }>()
const { state, dispatch } = useStore()
const konfig = useKonfig()
const { classLabel, parallel } = useEvent()

const parcours = computed(() => state.value.parcoursList)
// Jede Zeile nennt die Liste so, wie sie im Kopf ihres Bogens steht – in der Sprache, die
// daneben für sie gewählt ist (zweisprachig: „Zeit / Time“).
const bogenKonfig = useBogenKonfig()
const listen = computed(() =>
  einteilungsListen({ ...konfig.value, getSheetDef: (typeId) => bogenKonfig(typeId).getSheetDef(typeId) }, state.value, state.value.einteilung),
)
const gruppen = computed(() => [
  { id: 'aufbau', zeilen: listen.value.aufbau },
  { id: 'weitere', zeilen: listen.value.weitere },
])

/** Hat eine Klasse dieses Parcours die Liste? Sonst steht ein Strich statt eines Feldes. */
const gilt = (typeId: string, p: Parcours) => listeGilt(konfig.value, typeId, p.classIds)
const klassenText = (p: Parcours) => (p.classIds.length > 0 ? p.classIds.map(classLabel).join(', ') : t('wkr.noClasses'))

// --- Parallelslalom: race officials je Racecourse ------------------------------
const parallelZeilen = computed(() =>
  parallel.value ? parallelListen(konfig.value).map((typeId) => ({ id: typeId, titel: bogenKonfig(typeId).getSheetDef(typeId).title })) : [],
)
const racecourseName = (rc: Racecourse) => t(rc === 'A' ? 'parallel.parcoursA' : 'parallel.parcoursB')
function setzeRacecourse(rc: Racecourse, typeId: string, name: string) {
  dispatch({ type: 'SET_WKR_NAME', parcoursId: RACECOURSE_PARCOURS[rc], typeId, name })
}

// --- Sprache der Bögen je Liste ---------------------------------------------
const spracheWaehlbar = computed(() => bietetEnglisch(state.value.regelwerk))
const vorgabeSprache = computed(() => regelwerkSprache(state.value.regelwerk))
const spracheVon = (typeId: string) => wkrSpracheFuer(state.value, typeId)
function setzeSprache(typeIds: readonly string[], sprache: Sprache) {
  // Was der Vorgabe des Regelwerks entspricht, steht nicht im Stand: So folgt es ihr weiter.
  dispatch({ type: 'SET_WKR_SPRACHE', typeIds, sprache: sprache === vorgabeSprache.value ? null : sprache })
}
/** Alle Listen, die gedruckt werden: die des Manövrierens und – unter einem Regelwerk mit Parallelslalom – dessen Listen. */
const alleListen = computed(() => [...new Set([...listen.value.aufbau.map((l) => l.id), ...parallelZeilen.value.map((l) => l.id)])])
/** Stehen alle Listen der Veranstaltung auf dieser Sprache? */
const alleAuf = (sprache: Sprache) => alleListen.value.length > 0 && alleListen.value.every((id) => spracheVon(id) === sprache)

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
  <div id="wkr-einteilung" :class="[eingebettet ? 'besetzung-teil' : 'panel', 'wkr-einteilung']">
    <h3 v-if="eingebettet" class="subhead">{{ t('wkr.title') }}</h3>
    <h2 v-else>{{ t('wkr.title') }}</h2>
    <p class="hint">{{ t('wkr.intro') }}</p>
    <p v-if="parcours.length === 0" class="boat-banner warn" role="status">
      {{ t('wkr.noParcours') }} <a :href="adresse('verzahnung')">{{ t('nav.verzahnung') }}</a>
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
            <th v-if="spracheWaehlbar" scope="col" class="wkr-sprache-kopf">{{ t('wkr.language') }}</th>
          </tr>
        </thead>
        <tbody v-for="g in gruppen" :key="g.id">
          <tr v-if="g.id === 'weitere' && g.zeilen.length > 0" class="wkr-gruppe">
            <th :colspan="parcours.length + 1 + (spracheWaehlbar ? 1 : 0)" scope="colgroup">{{ t('wkr.moreLists') }}</th>
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
            <!-- Nur für Listen, die gedruckt werden: Eine nicht verwendete hat keinen Bogen. -->
            <td v-if="spracheWaehlbar" class="wkr-sprache">
              <select
                v-if="g.id === 'aufbau'"
                class="input"
                :data-feld="`wkr-sprache|${l.id}`"
                :value="spracheVon(l.id)"
                :aria-label="t('wkr.languageFor', { list: l.titel })"
                @change="setzeSprache([l.id], ($event.target as HTMLSelectElement).value as Sprache)"
              >
                <option v-for="s in SPRACHEN" :key="s.id" :value="s.id">{{ s.name }}</option>
              </select>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    <template v-if="spracheWaehlbar && parcours.length > 0">
      <div class="row wkr-sprache-alle" style="align-items: center; gap: 10px; margin-top: 10px">
        <span>{{ t('wkr.languageAll') }}</span>
        <div class="segmented" role="group" :aria-label="t('wkr.languageAll')">
          <button
            v-for="s in SPRACHEN"
            :key="s.id"
            type="button"
            :data-alle-sprache="s.id"
            :class="alleAuf(s.id) ? 'active' : ''"
            :aria-pressed="alleAuf(s.id)"
            @click="setzeSprache(alleListen, s.id)"
          >
            {{ s.name }}
          </button>
        </div>
      </div>
      <p class="note" data-hinweis="wkr-sprache">{{ t('wkr.languageNote', { language: t(`listopt.language.${vorgabeSprache}`) }) }}</p>
    </template>
    <p class="note">
      {{ t('wkr.classesNote') }} <a :href="adresse('verzahnung')">{{ t('nav.verzahnung') }}</a>
    </p>
    <!-- Parallelslalom: die race officials der Racecourses A und B. -->
    <template v-if="parallelZeilen.length > 0">
      <h4 class="subhead wkr-parallel-titel">{{ t('wkr.parallel.title') }}</h4>
      <p class="hint">{{ t('wkr.parallel.intro') }}</p>
      <div class="assistent-rahmen">
        <table class="assistent-tabelle wkr-tabelle" data-tabelle="wkr-parallel">
          <thead>
            <tr>
              <th scope="col" class="zeilenkopf">{{ t('wkr.list') }}</th>
              <th v-for="rc in RACECOURSES" :key="rc" scope="col">
                <strong>{{ racecourseName(rc) }}</strong>
              </th>
              <th v-if="spracheWaehlbar" scope="col" class="wkr-sprache-kopf">{{ t('wkr.language') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="l in parallelZeilen" :key="l.id">
              <th scope="row" class="zeilenkopf">{{ l.titel }}</th>
              <td v-for="rc in RACECOURSES" :key="rc">
                <input
                  class="cell-input"
                  autocomplete="off"
                  :data-feld="`${RACECOURSE_PARCOURS[rc]}|${l.id}`"
                  :value="state.einteilung[RACECOURSE_PARCOURS[rc]]?.[l.id] ?? ''"
                  :placeholder="t('wkr.name')"
                  :aria-label="t('wkr.nameFor', { list: l.titel, parcours: racecourseName(rc) })"
                  @input="setzeRacecourse(rc, l.id, ($event.target as HTMLInputElement).value)"
                />
              </td>
              <td v-if="spracheWaehlbar" class="wkr-sprache">
                <select
                  class="input"
                  :data-feld="`wkr-sprache-parallel|${l.id}`"
                  :value="spracheVon(l.id)"
                  :aria-label="t('wkr.languageFor', { list: l.titel })"
                  @change="setzeSprache([l.id], ($event.target as HTMLSelectElement).value as Sprache)"
                >
                  <option v-for="s in SPRACHEN" :key="s.id" :value="s.id">{{ s.name }}</option>
                </select>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>
    <p class="note">{{ t('wkr.privacyNote') }}</p>
  </div>
</template>
