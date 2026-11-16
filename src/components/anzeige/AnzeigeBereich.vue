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
 *
 * Parallelslalom (E4): ein Paar – Racecourse A und B, je Seite Nummer, Name und Herkunft; oben mittig Klasse,
 * Runde und Attempt. Eine leere Seite (Dummy, gelöscht, X) zeigt nur ihren Racecourse und „–“
 * (BETRIEB_ANNAHMEN.parallelLeereSeite). Wo die Seiten liegen – A oder B links, A oder B oben –, sagt die Sicht
 * (`einst.parallelAnordnung`, Einstellung nach dem Standort der Tafel, 16.11.2026); jede Seite trägt ihre Überschrift
 * mit, nur die Lage wechselt.
 */
const props = defineProps<{
  bereich: SichtBereich
  sicht: OeffentlicheSicht
  /** Startnummer über den Angaben statt daneben – für hohe Bereiche (AnzeigeTafel.vue). */
  gestapelt: boolean
  /** Parallelslalom, A und B untereinander: je Seite Nummer und Angaben nebeneinander (breit genug, AnzeigeTafel.vue). */
  paarFlach?: boolean
  /** Anordnung der Tafel; ändert sie sich, misst lib/fit.ts neu (über `updated`). */
  anordnung?: string
}>()

const tx = (key: MessageKey, params?: Record<string, string | number>) => tIn(props.sicht.sprache, key, params)

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

interface Seite {
  rc: 'A' | 'B'
  /** `null`: leer. */
  startNr: string | null
  name: string
  herkunft: SichtStarter['herkunft']
}
interface Paar {
  klassen: SichtKlasse[]
  titel: string
  seiten: Seite[]
}

/**
 * Lage der Seiten nach der Einstellung: B zuerst (links bzw. oben)? Untereinander statt nebeneinander? Ohne Angabe die
 * Vorgabe – die Sicht trägt sie nur, wenn sie den Parallelslalom hat, und nur dort gibt es Paare.
 */
const lage = computed(() => props.sicht.einst.parallelAnordnung ?? 'a-links')
const bZuerst = computed(() => lage.value === 'b-links' || lage.value === 'b-oben')
const untereinander = computed(() => lage.value === 'a-oben' || lage.value === 'b-oben')

/**
 * Ein Paar des Parallelslaloms: beide Seiten in der Folge, in der sie auf der Tafel stehen (links bzw. oben zuerst);
 * eine leere (oder ein Starter, der in der Sicht fehlt) ohne Angaben. Die Klassen nennt es in der Folge A, B.
 */
function beschreibePaar(s: SichtStart | null): Paar | null {
  if (!s?.paar) return null
  const seite = (rc: 'A' | 'B', id: string | null): Seite => {
    const p = id === null ? undefined : props.sicht.starter[id]
    return { rc, startNr: p ? p.startNr || '–' : null, name: p?.name ?? '', herkunft: p?.herkunft ?? null }
  }
  const starter = [s.paar.a, s.paar.b].flatMap((id) => (id !== null && props.sicht.starter[id] ? [props.sicht.starter[id]] : []))
  const klassen = [...new Set(starter.map((p) => p.klasse))].flatMap((k) => (props.sicht.klassen[k] ? [props.sicht.klassen[k]!] : []))
  const a = seite('A', s.paar.a)
  const b = seite('B', s.paar.b)
  return { klassen, titel: s.titel, seiten: bZuerst.value ? [b, a] : [a, b] }
}

/**
 * Der Start davor in einer Zeile: Manövrieren Nummer, Klasse, Name; ein Paar beide Nummern (in der Folge der Seiten auf
 * der Tafel, BETRIEB_ANNAHMEN.parallelAnordnungNurTafel) und die Klasse.
 */
function davorText(s: SichtStart | null): string {
  const paar = beschreibePaar(s)
  if (paar) {
    if (!paar.seiten.some((x) => x.startNr)) return ''
    return [paar.seiten.map((x) => x.startNr ?? '–').join(' / '), paar.klassen.map((k) => k.titel).join(' / ')].filter(Boolean).join(' · ')
  }
  const d = beschreibe(s)
  return d ? [d.startNr, d.klasse?.titel, d.name].filter(Boolean).join(' · ') : ''
}

// Ein Paar, von dem keine Seite mehr in der Sicht steht (beide gelöscht), zeigt „bereit“ – wie ein gelöschter Starter.
const paar = computed(() => {
  const p = beschreibePaar(props.bereich.aktuell)
  return p && p.seiten.some((x) => x.startNr !== null) ? p : null
})
const aktuell = computed(() => (props.bereich.aktuell?.paar ? null : beschreibe(props.bereich.aktuell)))
// Mit Klasse: Am Steg wird daran abgelesen, welches Boot gerade zurückkommt.
const vorig = computed(() => (props.sicht.einst.davor ? davorText(props.bereich.vorig) : ''))
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

      <template v-else-if="paar">
        <div v-fit class="anzeige-zeile anzeige-meta">
          <span class="anzeige-parcours">{{ parcours }}</span>
          <span class="anzeige-mitte">
            <span v-for="k in paar.klassen" :key="k.titel" class="anzeige-klasse" data-klasse
              ><span class="anzeige-klassenfarbe" :style="{ background: k.farbe }" aria-hidden="true" />{{ k.titel }}</span
            >
            <span class="anzeige-lauf" data-lauf>{{ paar.titel }}</span>
          </span>
          <span />
        </div>

        <div class="anzeige-rumpf">
          <!-- Die Seiten liegen, wie die Racecourses vom Publikum aus liegen (Einstellung): nebeneinander mit senkrechter,
               untereinander mit waagerechter Trennlinie (styles/anzeige.css). Die Folge im DOM ist die auf der Tafel. -->
          <div class="anzeige-paar" :class="{ untereinander, flach: untereinander && paarFlach }" :data-lage="lage">
            <div v-for="x in paar.seiten" :key="x.rc" class="anzeige-bahn" :class="{ leer: !x.startNr }" :data-racecourse="x.rc">
              <div v-fit class="anzeige-zeile anzeige-racecourse" data-teil="racecourse">{{ tx('anzeige.racecourse', { rc: x.rc }) }}</div>
              <div v-fit class="anzeige-zeile anzeige-startnr" data-startnr>{{ x.startNr ?? '–' }}</div>
              <div v-if="x.name" v-fit class="anzeige-zeile anzeige-name" data-name>{{ x.name }}</div>
              <div v-if="x.herkunft" v-fit class="anzeige-zeile anzeige-herkunft" data-herkunft><HerkunftText :anzeige="x.herkunft" /></div>
            </div>
          </div>
          <div v-if="vorig" v-fit class="anzeige-zeile anzeige-vorig anzeige-vorig-paar" data-vorig>{{ tx('anzeige.davor') }}: {{ vorig }}</div>
          <div v-if="meldung" v-fit-zeilen="HINWEIS_ZEILEN" class="anzeige-zeile anzeige-meldung info darunter" data-meldung>{{ meldung.text }}</div>
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
              <div v-if="vorig" v-fit class="anzeige-zeile anzeige-vorig" data-vorig>{{ tx('anzeige.davor') }}: {{ vorig }}</div>
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
