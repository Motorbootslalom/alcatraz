<script setup lang="ts">
import { computed } from 'vue'
import type { OeffentlicheSicht, SichtBereich, SichtKlasse, SichtStart, SichtStarter } from '../../types'
import { tIn, type MessageKey } from '../../i18n'
import { vFit, vFitBlock, vFitZeilen } from '../../lib/fit'
import HerkunftText from '../HerkunftText.vue'

/**
 * Ein Bereich (Parcours) der Anzeigetafel, nach dem Tafel-Prototyp (BoardRegion.vue, 16.11.2026): oben links
 * der Parcours, mittig Klasse und Lauf, darunter groß die Startnummer, daneben Name, Herkunft und – wenn
 * eingestellt – der Start davor. Liest NUR die öffentliche Sicht (betrieb/sicht.ts): So zeigt eine entfernte
 * Anzeige (ab E6) dasselbe wie die am Bedienrechner. Texte in der Sprache der Tafel (`sicht.sprache`).
 */
const props = defineProps<{
  bereich: SichtBereich
  sicht: OeffentlicheSicht
  /** Startnummer über den Angaben statt daneben – für hohe Bereiche (AnzeigeTafel.vue). */
  gestapelt: boolean
  /** Anordnung der Tafel; ändert sie sich, misst lib/fit.ts neu (über `updated`). */
  anordnung?: string
}>()

const tx = (key: MessageKey) => tIn(props.sicht.sprache, key)

interface Gezeigt {
  startNr: string
  name: string
  klasse: SichtKlasse | undefined
  lauf: string
  herkunft: SichtStarter['herkunft']
}

function beschreibe(s: SichtStart | null): Gezeigt | null {
  if (!s) return null
  const p = props.sicht.starter[s.starter]
  if (!p) return null
  return { startNr: p.startNr || '–', name: p.name, klasse: props.sicht.klassen[p.klasse], lauf: s.titel, herkunft: p.herkunft }
}

const aktuell = computed(() => beschreibe(props.bereich.aktuell))
// Mit Klasse: Am Steg wird daran abgelesen, welches Boot gerade zurückkommt.
const vorig = computed(() => (props.sicht.einst.davor ? beschreibe(props.bereich.vorig) : null))
const parcours = computed(() => (props.sicht.einst.parcoursName ? props.bereich.name : ''))
const meldung = computed(() => props.bereich.meldung)
/** Störung und Pause verdrängen den Starter; ein Hinweis steht darunter. */
const ersetzt = computed(() => !!meldung.value && meldung.value.art !== 'info')

/**
 * Wechselt der Starter (oder die verdrängende Meldung), entsteht ein neuer Block: Er misst sich in
 * `mounted` neu (lib/fit.ts) und blendet per CSS auf. Bewusst KEIN `<Transition>` – eine Überblendung
 * bräuchte Animationsframes, und ein verdecktes Fenster bliebe sonst auf dem alten Starter stehen.
 */
const wechsel = computed(() => (ersetzt.value ? `meldung:${meldung.value!.art}:${meldung.value!.text}` : `start:${props.bereich.aktuell?.key ?? ''}`))

/** Höchstens so viele Zeilen hat ein Hinweis unter dem Starter (lib/fit.ts fitZeilen). */
const HINWEIS_ZEILEN = 2
</script>

<template>
  <section class="anzeige-bereich" :data-bereich="bereich.id" :data-anordnung="anordnung">
    <!-- Die Kopfzeile (Parcours, Klasse, Lauf) steht in jedem Zustand oben im Bereich, der Rest mittig darunter
         (.anzeige-rumpf): So springt der Parcours nicht, wenn auf „bereit“ der erste Start folgt oder eine Meldung kommt. -->
    <div :key="wechsel" v-fit-block class="anzeige-inhalt" :class="{ gestapelt }">
      <template v-if="ersetzt">
        <!-- Der Parcours bleibt auch bei Störung und Pause stehen: Bei zwei Parcours sagt nur er, wofür die Meldung gilt. -->
        <div v-if="parcours" v-fit class="anzeige-zeile anzeige-meta">
          <span class="anzeige-parcours">{{ parcours }}</span>
          <span class="anzeige-mitte" />
          <span />
        </div>
        <div class="anzeige-rumpf">
          <div v-fit class="anzeige-zeile anzeige-meldung" :class="meldung!.art" data-meldung>{{ meldung!.text }}</div>
        </div>
      </template>

      <template v-else-if="aktuell">
        <div v-fit class="anzeige-zeile anzeige-meta">
          <span class="anzeige-parcours">{{ parcours }}</span>
          <span class="anzeige-mitte">
            <span v-if="aktuell.klasse" class="anzeige-klasse" data-klasse
              ><span class="anzeige-klassenfarbe" :style="{ background: aktuell.klasse.farbe }" aria-hidden="true" />{{ aktuell.klasse.titel }}</span
            >
            <span class="anzeige-lauf" data-lauf>{{ aktuell.lauf }}</span>
          </span>
          <span />
        </div>

        <div class="anzeige-rumpf">
          <div class="anzeige-haupt">
            <div v-fit class="anzeige-zeile anzeige-startnr" data-startnr>{{ aktuell.startNr }}</div>
            <div class="anzeige-angaben">
              <div v-if="aktuell.name" v-fit class="anzeige-zeile anzeige-name" data-name>{{ aktuell.name }}</div>
              <div v-if="aktuell.herkunft" v-fit class="anzeige-zeile anzeige-herkunft" data-herkunft><HerkunftText :anzeige="aktuell.herkunft" /></div>
              <div v-if="vorig" v-fit class="anzeige-zeile anzeige-vorig" data-vorig>
                {{ tx('anzeige.davor') }}: {{ [vorig.startNr, vorig.klasse?.titel, vorig.name].filter(Boolean).join(' · ') }}
              </div>
            </div>
          </div>
          <!-- Ein Hinweis schrumpft selbst (höchstens zwei Zeilen), statt über den Block die Startnummer zu verkleinern. -->
          <div v-if="meldung" v-fit-zeilen="HINWEIS_ZEILEN" class="anzeige-zeile anzeige-meldung info darunter" data-meldung>{{ meldung.text }}</div>
        </div>
      </template>

      <template v-else>
        <div v-if="parcours" v-fit class="anzeige-zeile anzeige-meta">
          <span class="anzeige-parcours">{{ parcours }}</span>
          <span class="anzeige-mitte" />
          <span />
        </div>
        <div class="anzeige-rumpf">
          <div class="anzeige-leer" data-leer>{{ tx('anzeige.bereit') }}</div>
          <div v-if="meldung" v-fit-zeilen="HINWEIS_ZEILEN" class="anzeige-zeile anzeige-meldung info darunter" data-meldung>{{ meldung.text }}</div>
        </div>
      </template>
    </div>
  </section>
</template>
