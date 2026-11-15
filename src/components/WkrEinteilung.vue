<script setup lang="ts">
import { computed, ref } from 'vue'
import { useStore } from '../state/store'
import { useKonfig } from '../lib/konfig'
import { useEvent } from '../lib/event'
import { einteilungsListen, einteilungsZellen, listeGilt, type WkrZelle } from '../lib/einteilung'
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
 * Stufe tiefer. Gepflegt werden die Namen NUR hier: Die Beispielansicht der Listen
 * (WkrVorschau.vue) zeigt im Bogenkopf den Namen, der hier eingeteilt ist, nimmt aber keinen an
 * (Entscheidung des Nutzers vom 15.11.2026 – ein Name auf einem Beispielbogen war unlogisch).
 *
 * Hier steht auch die Sprache des Bogens (deutsch, englisch, zweisprachig) – je Zelle, also je
 * Liste UND Parcours, gleich neben dem Namen: Sie hängt daran, wer an der Position sitzt, und
 * auf den Parcours sitzen ganz getrennte Gruppen (Entscheidung des Nutzers vom 15.11.2026; vorher
 * eine Spalte je Liste für alle Parcours). Wählbar nur, wo das Regelwerk Englisch anbietet
 * (lib/listensprache.ts); „alle auf …“ stellt alle Zellen um. Die Zeilen nennen die Listen in
 * der Sprache des Regelwerks – die Sprache der Bögen kann ja je Parcours eine andere sein.
 *
 * Parallelslalom (nur unter einem Regelwerk, das ihn kennt): eine zweite Tabelle mit den
 * race officials der beiden Racecourses A und B – je Racecourse Zeit, Steg (pontoon) und
 * Fahrweg. Das ist Organisation, nicht Regel 960; Namen und Sprachen stehen in derselben
 * Einteilung unter der Kennung des Racecourse (lib/parallelSchluessel.ts), getrennt von denen
 * des Manövrierens.
 */
defineProps<{ eingebettet?: boolean }>()
const { state, dispatch } = useStore()
const konfig = useKonfig()
const { classLabel, parallel } = useEvent()

const parcours = computed(() => state.value.parcoursList)
// Jede Zeile nennt die Liste in der Sprache des Regelwerks: Ihre Bögen können je Parcours eine
// andere haben (siehe oben).
const listen = computed(() => einteilungsListen(konfig.value, state.value, state.value.einteilung))
const gruppen = computed(() => [
  { id: 'aufbau', zeilen: listen.value.aufbau },
  { id: 'weitere', zeilen: listen.value.weitere },
])

/** Hat eine Klasse dieses Parcours die Liste? Sonst steht ein Strich statt eines Feldes. */
const gilt = (typeId: string, p: Parcours) => listeGilt(konfig.value, typeId, p.classIds)
const klassenText = (p: Parcours) => (p.classIds.length > 0 ? p.classIds.map(classLabel).join(', ') : t('wkr.noClasses'))

// --- Parallelslalom: race officials je Racecourse ------------------------------
const parallelZeilen = computed(() => (parallel.value ? parallelListen(konfig.value).map((typeId) => ({ id: typeId, titel: konfig.value.getSheetDef(typeId).title })) : []))
const racecourseName = (rc: Racecourse) => t(rc === 'A' ? 'parallel.parcoursA' : 'parallel.parcoursB')
function setzeRacecourse(rc: Racecourse, typeId: string, name: string) {
  dispatch({ type: 'SET_WKR_NAME', parcoursId: RACECOURSE_PARCOURS[rc], typeId, name })
}

// --- Sprache der Bögen je Liste und Parcours ---------------------------------
const spracheWaehlbar = computed(() => bietetEnglisch(state.value.regelwerk))
const vorgabeSprache = computed(() => regelwerkSprache(state.value.regelwerk))
const spracheVon = (parcoursId: string, typeId: string) => wkrSpracheFuer(state.value, parcoursId, typeId)
const sprachName = (sprache: Sprache) => SPRACHEN.find((s) => s.id === sprache)?.name ?? sprache
function setzeSprache(zellen: readonly WkrZelle[], sprache: Sprache) {
  // Was der Vorgabe des Regelwerks entspricht, steht nicht im Stand: So folgt es ihr weiter.
  dispatch({ type: 'SET_WKR_SPRACHE', zellen, sprache: sprache === vorgabeSprache.value ? null : sprache })
}
/**
 * Alle Zellen, deren Bogen gedruckt wird: je Parcours die Listen des Manövrierens, die eine
 * seiner Klassen hat, und – unter einem Regelwerk mit Parallelslalom – je Racecourse dessen Listen.
 */
const alleZellen = computed<WkrZelle[]>(() => einteilungsZellen(konfig.value, state.value, parallelZeilen.value.map((l) => l.id)))
/** Stehen alle Bögen der Veranstaltung auf dieser Sprache? */
const alleAuf = (sprache: Sprache) => alleZellen.value.length > 0 && alleZellen.value.every((z) => spracheVon(z.parcoursId, z.typeId) === sprache)

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
          </tr>
        </thead>
        <tbody v-for="g in gruppen" :key="g.id">
          <tr v-if="g.id === 'weitere' && g.zeilen.length > 0" class="wkr-gruppe">
            <th :colspan="parcours.length + 1" scope="colgroup">{{ t('wkr.moreLists') }}</th>
          </tr>
          <tr v-for="l in g.zeilen" :key="l.id">
            <th scope="row" class="zeilenkopf">{{ l.titel }}</th>
            <td v-for="p in parcours" :key="p.id">
              <div v-if="gilt(l.id, p)" class="wkr-zelle">
                <input
                  class="cell-input"
                  autocomplete="off"
                  :data-feld="feldId(p, l.id)"
                  :value="state.einteilung[p.id]?.[l.id] ?? ''"
                  :title="state.einteilung[p.id]?.[l.id] || undefined"
                  :placeholder="t('wkr.name')"
                  :aria-label="t('wkr.nameFor', { list: l.titel, parcours: p.name })"
                  @input="setze(p, l.id, ($event.target as HTMLInputElement).value)"
                  @keydown.enter.prevent="weiter(p, l.id)"
                />
                <!-- Die Sprache des Bogens dieser Zelle, gleich neben dem Namen – nur für Listen, die
                     gedruckt werden: Eine nicht verwendete hat keinen Bogen. -->
                <select
                  v-if="spracheWaehlbar && g.id === 'aufbau'"
                  :class="['wkr-sprache-wahl', { 'wkr-sprache-eigen': spracheVon(p.id, l.id) !== vorgabeSprache }]"
                  :data-feld="`wkr-sprache|${p.id}|${l.id}`"
                  :value="spracheVon(p.id, l.id)"
                  :title="sprachName(spracheVon(p.id, l.id))"
                  :aria-label="t('wkr.languageFor', { list: l.titel, parcours: p.name })"
                  @change="setzeSprache([{ parcoursId: p.id, typeId: l.id }], ($event.target as HTMLSelectElement).value as Sprache)"
                >
                  <option v-for="s in SPRACHEN" :key="s.id" :value="s.id" :title="s.name">{{ s.kurz }}</option>
                </select>
              </div>
              <span v-else class="wkr-entfaellt" :title="t('wkr.notUsed')">
                <span aria-hidden="true">–</span><span class="sr-only">{{ t('wkr.notUsed') }}</span>
              </span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
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
            </tr>
          </thead>
          <tbody>
            <tr v-for="l in parallelZeilen" :key="l.id">
              <th scope="row" class="zeilenkopf">{{ l.titel }}</th>
              <td v-for="rc in RACECOURSES" :key="rc">
                <div class="wkr-zelle">
                  <input
                    class="cell-input"
                    autocomplete="off"
                    :data-feld="`${RACECOURSE_PARCOURS[rc]}|${l.id}`"
                    :value="state.einteilung[RACECOURSE_PARCOURS[rc]]?.[l.id] ?? ''"
                    :title="state.einteilung[RACECOURSE_PARCOURS[rc]]?.[l.id] || undefined"
                    :placeholder="t('wkr.name')"
                    :aria-label="t('wkr.nameFor', { list: l.titel, parcours: racecourseName(rc) })"
                    @input="setzeRacecourse(rc, l.id, ($event.target as HTMLInputElement).value)"
                  />
                  <select
                    v-if="spracheWaehlbar"
                    :class="['wkr-sprache-wahl', { 'wkr-sprache-eigen': spracheVon(RACECOURSE_PARCOURS[rc], l.id) !== vorgabeSprache }]"
                    :data-feld="`wkr-sprache|${RACECOURSE_PARCOURS[rc]}|${l.id}`"
                    :value="spracheVon(RACECOURSE_PARCOURS[rc], l.id)"
                    :title="sprachName(spracheVon(RACECOURSE_PARCOURS[rc], l.id))"
                    :aria-label="t('wkr.languageFor', { list: l.titel, parcours: racecourseName(rc) })"
                    @change="setzeSprache([{ parcoursId: RACECOURSE_PARCOURS[rc], typeId: l.id }], ($event.target as HTMLSelectElement).value as Sprache)"
                  >
                    <option v-for="s in SPRACHEN" :key="s.id" :value="s.id" :title="s.name">{{ s.kurz }}</option>
                  </select>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>
    <!-- „Alle auf …“ unter BEIDEN Tabellen: Es stellt jede Zelle um, die einen Bogen hat – die des
         Manövrierens und die der Racecourses A und B. Zwischen den Tabellen las es sich wie ein
         Schalter nur für die obere. -->
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
            @click="setzeSprache(alleZellen, s.id)"
          >
            {{ s.name }}
          </button>
        </div>
      </div>
      <p class="note" data-hinweis="wkr-sprache">
        {{ t('wkr.languageNote', { language: t(`listopt.language.${vorgabeSprache}`) }) }}
        <template v-if="parallelZeilen.length > 0">{{ t('wkr.languageAllParallel') }}</template>
      </p>
    </template>
    <p class="note">{{ t('wkr.privacyNote') }}</p>
  </div>
</template>
