<script setup lang="ts">
import { computed, ref } from 'vue'
import type { ClassId, SichtKlasse, SichtStart, SichtStarter, ZuschauerBereich, ZuschauerSicht } from '../../types'
import { tIn, type MessageKey } from '../../i18n'
import { CLASS_IDS } from '../../domain/classes'
import { merke } from '../../lib/merken'
import { wartezeitAnzeige, wartezeiten, type Wartezeit } from '../../betrieb/prognose'
import { wartezeitText } from '../betrieb/texte'
import HerkunftText from '../HerkunftText.vue'

/**
 * Die Zuschauerliste (Etappe E3, Plan vom 16.11.2026; Vorbild: Tafel-Prototyp ListView.vue, Lastenheft L-1 bis L-7):
 * je Parcours, wer im Boot sitzt, wer am Steg und vor Steg wartet und wann die übrigen ungefähr dran sind – „ca. in“
 * und „zum Vorsteg in“ (Zeit bis zum Vorsteg). Ohne Zahl bleibt „Boot fehlt“ (L-7), ebenso alles, solange die Tafel
 * eine Pause oder Störung zeigt (BETRIEB_ANNAHMEN.keineZahlBeiPause – die Meldung steht darüber); Läufe, die nicht
 * begonnen haben, stehen gar nicht darin (L-2). Filter nach Klasse (L-1) der gezeigten Parcours, gemerkt über
 * lib/merken.ts – Bedienauswahl, kein Stand.
 *
 * Liest NUR die Zuschauersicht (betrieb/sicht.ts `sichtZuschauer`): nie Geburtsdatum, Gewicht, Geschlecht, Werte,
 * Abmeldungen, keine Bedienangaben. Dieselbe Komponente zeigt ab E6 den Zuschauer-Link auf fremden Handys; die
 * Wartezeit rechnet sie aus der Sicht und `jetzt` (Zeit des Hosts: eigene Uhr plus Versatz). Texte in der Sprache der
 * Anzeigetafel (`sicht.sprache`), wie die Tafel selbst.
 *
 * Groß genug fürs Handy (styles/zuschauer.css): je Start eine Karte statt einer Tabellenzeile, die Startnummer groß,
 * die Wartezeit rechts.
 *
 * Parallelslalom (E4): je Karte ein Paar – Racecourse A und B untereinander, eine leere Seite als „–“; ohne Wartezeit
 * (BETRIEB_ANNAHMEN.parallelOhnePrognose), die Gruppen Am Steg/Vor Steg bleiben. Der Klassenfilter zeigt ein Paar,
 * wenn eine Seite in der Klasse fährt.
 *
 * Team-Filter (Feldtest 21.11.2026, Wunsch des Nutzers; BETRIEB_ANNAHMEN.zuschauerTeamFilter): Team = Herkunft der
 * Veranstaltung (Verein, Landesverband, Nation – so, wie die Sicht sie nennt), Mehrfachwahl, keine Wahl = „Alle“. Nur
 * aus der Sicht gerechnet, gemerkt im localStorage dieses Bildschirms (merke `dauerhaft`) – auch auf Lese-Link-Geräten,
 * nichts geht übers Netz. Mit dem Klassenfilter UND-verknüpft; ein Paar passt, wenn eine Seite passt.
 */
const props = defineProps<{
  sicht: ZuschauerSicht
  jetzt: number
  /** Nur diese Bereiche (`#/zuschauer/<bereich>`); ohne alle. */
  bereiche?: readonly string[]
}>()

const tx = (key: MessageKey, params?: Record<string, string | number>) => tIn(props.sicht.sprache, key, params)

/** Die gezeigten Bereiche: unter `#/zuschauer/<bereich>` nur dieser. */
const gezeigt = computed(() => props.sicht.bereiche.filter((b) => !props.bereiche || props.bereiche.includes(b.id)))

// Klassenfilter: '' = alle. Übersteht das Neuladen (ein Handy lädt oft neu); eine Klasse, die es nicht mehr gibt,
// gilt als „alle“ (Muster WkrListen.vue). Angeboten werden nur Klassen, die auf den GEZEIGTEN Parcours fahren (L-1:
// je Parcours filterbar) – die Sicht nennt die Klassen aller Parcours. Der Start im Boot zählt mit: Geht der letzte
// Start einer Klasse ins Boot, bleibt ihr Knopf, und die gewählte Klasse springt nicht unvermittelt auf „alle“.
const gemerkt = merke<string>('zuschauer.klasse', '', { ueberNeuladen: true, gueltig: (x) => typeof x === 'string' })
/** Die Starter eines Starts: einer, im Parallelslalom die Seiten, die fahren. */
const starterVon = (s: SichtStart): string[] => (s.paar ? [s.paar.a, s.paar.b].filter((id): id is string => id !== null) : [s.starter])
const klassenVon = (s: SichtStart): ClassId[] => starterVon(s).flatMap((id) => props.sicht.starter[id]?.klasse ?? [])
const klassen = computed(() => {
  const da = new Set<ClassId>()
  for (const b of gezeigt.value) for (const s of [...(b.aktuell ? [b.aktuell] : []), ...b.frei, ...b.bootFehlt]) for (const k of klassenVon(s)) da.add(k)
  return CLASS_IDS.filter((k) => da.has(k) && props.sicht.klassen[k]).map((k) => ({ id: k, ...props.sicht.klassen[k]! }))
})
const filter = computed<ClassId | ''>(() => (klassen.value.some((k) => k.id === gemerkt.value) ? (gemerkt.value as ClassId) : ''))

// Team-Filter: Schlüssel einer Herkunft ist ihr Klartext (sonst Text, Kürzel). Angeboten nur Teams der gezeigten
// Parcours, wie beim Klassenfilter einschließlich des Starts im Boot; Gewähltes, das es nicht (mehr) gibt, zählt nicht.
const teamSchluessel = (h: SichtStarter['herkunft']): string => (h ? h.klartext || h.text || h.druck || h.alt : '')
const teamsVon = (s: SichtStart): string[] => starterVon(s).map((id) => teamSchluessel(props.sicht.starter[id]?.herkunft ?? null)).filter(Boolean)
const teamsGemerkt = merke<string[]>('zuschauer.teams', [], { dauerhaft: true, gueltig: (x) => Array.isArray(x) && x.every((t) => typeof t === 'string') })
const teams = computed(() => {
  const da = new Map<string, NonNullable<SichtStarter['herkunft']>>()
  for (const b of gezeigt.value) {
    for (const s of [...(b.aktuell ? [b.aktuell] : []), ...b.frei, ...b.bootFehlt]) {
      for (const id of starterVon(s)) {
        const h = props.sicht.starter[id]?.herkunft
        const k = teamSchluessel(h ?? null)
        if (h && k && !da.has(k)) da.set(k, h)
      }
    }
  }
  // Gewählte Teams, die gerade nicht dabei sind (alle gefahren, erst in einem späteren Lauf), bleiben als Knopf –
  // sonst ließen sie sich nicht abwählen und die Wahl wirkte unsichtbar (Prüfbefund 21.11.2026).
  const liste: { id: string; herkunft: SichtStarter['herkunft'] }[] = [...da.entries()].map(([id, herkunft]) => ({ id, herkunft }))
  for (const k of teamsGemerkt.value) if (!da.has(k)) liste.push({ id: k, herkunft: null })
  return liste.sort((a, b) => a.id.localeCompare(b.id, props.sicht.sprache))
})
/**
 * Prüfbefund 21.11.2026: Die Wahl gilt, auch wenn ein gewähltes Team gerade keine Starts hat – dann steht „Keine
 * Starts für diese Auswahl“ da, statt still auf „Alle“ zu fallen; und kommt das Team im nächsten Lauf wieder, ist es
 * noch gewählt (vorher kürzte jedes Umschalten die gemerkte Wahl auf die gerade sichtbaren Teams).
 */
const teamFilter = computed(() => teamsGemerkt.value)
// Zugeklappt, solange keins gewählt ist (lange Vereinslisten verdrängten am Handy sonst die Starts); aufgeklappt bleibt
// es, bis man es selbst zuklappt – ein Tipp auf „Alle“ soll die Liste nicht wegspringen lassen.
const teamsOffen = ref(teamsGemerkt.value.length > 0)
function schalteTeam(id: string): void {
  // Nur das angetippte Team ändert sich; Gemerktes, das gerade nicht zu sehen ist, bleibt.
  teamsGemerkt.value = teamsGemerkt.value.includes(id) ? teamsGemerkt.value.filter((k) => k !== id) : [...teamsGemerkt.value, id]
}

/** Eine Seite eines Paares (Parallelslalom). */
interface Seite {
  rc: 'A' | 'B'
  /** '–' für eine leere Seite (Dummy, gelöscht, X). */
  startNr: string
  name: string
  herkunft: SichtStarter['herkunft']
}

interface Zeile {
  key: string
  /** Nur im Parallelslalom: beide Seiten (dann gelten startNr/name/herkunft nicht). */
  seiten?: Seite[]
  startNr: string
  name: string
  klasse: SichtKlasse | undefined
  lauf: string
  herkunft: SichtStarter['herkunft']
  /** „ca. in 12 min“ bzw. „gleich“; '' ohne Zahl. */
  ca: string
  /** „zum Vorsteg in 8 min“; '' für die am Steg und vor Steg (sie sind schon dort) und ohne Zahl. */
  vorsteg: string
}

/** „ca. in 12 min“ bzw. „gleich“ – „ca. in gleich“ läse sich schief, deshalb unter einer Minute ein eigener Text. */
function zeitText(sekunden: number, gleich: MessageKey, mit: MessageKey): string {
  return wartezeitAnzeige(sekunden).art === 'gleich' ? tx(gleich) : tx(mit, { zeit: wartezeitText(sekunden, props.sicht.sprache) })
}

function zeile(s: SichtStart, w: Wartezeit | undefined): Zeile | null {
  const p = props.sicht.starter[s.starter]
  if (!p) return null
  const zeit = w?.art === 'zeit' ? w : null
  const seite = (rc: 'A' | 'B', id: string | null): Seite => {
    const x = id === null ? undefined : props.sicht.starter[id]
    return { rc, startNr: x ? x.startNr || '–' : '–', name: x?.name ?? '', herkunft: x?.herkunft ?? null }
  }
  return {
    key: s.key,
    ...(s.paar ? { seiten: [seite('A', s.paar.a), seite('B', s.paar.b)] } : {}),
    startNr: p.startNr || '–',
    name: p.name,
    klasse: props.sicht.klassen[p.klasse],
    lauf: s.titel,
    herkunft: p.herkunft,
    ca: zeit ? zeitText(zeit.bisStart, 'anzeige.zeit.gleich', 'zuschauer.caIn') : '',
    // Am Steg und vor Steg ist man schon am Vorsteg vorbei bzw. dort – dann keine Zeit dorthin.
    vorsteg: zeit && zeit.steg === null ? zeitText(zeit.bisVorsteg, 'zuschauer.vorsteg.gleich', 'zuschauer.vorsteg') : '',
  }
}

interface Gruppe {
  art: 'amSteg' | 'vorSteg' | 'danach' | 'bootFehlt'
  titel: string
  zeilen: Zeile[]
}

interface Ansicht {
  b: ZuschauerBereich
  stand: string
  imBoot: Zeile | null
  gruppen: Gruppe[]
  /** Der Filter lässt nichts übrig, obwohl es offene Starts gibt. */
  leer: boolean
}

/**
 * Wo der Parcours steht: „Lauf 1 läuft“; ist im begonnenen nichts mehr offen „Als Nächstes: Lauf 2“ (die Anzeigetafel
 * bleibt bis dahin stehen, S-8) bzw. „Alle Läufe sind zu Ende“; vor dem ersten Lauf „Als Nächstes: Lauf 1“.
 */
function standText(b: ZuschauerBereich, offen: number): string {
  if (b.punkt && offen > 0) return tx('zuschauer.laeuft', { punkt: b.punkt.titel })
  if (b.naechsterPunkt) return tx('zuschauer.naechsterPunkt', { punkt: b.naechsterPunkt.titel })
  return b.punkt ? tx(b.art === 'parallel' ? 'zuschauer.zuEnde.runde' : 'zuschauer.zuEnde') : ''
}

const ansichten = computed<Ansicht[]>(() =>
  gezeigt.value.map((b) => {
    // Die Wartezeiten über die GANZE Folge – der Filter blendet nur aus, die Stellen bleiben.
    const zeiten = wartezeiten(props.sicht, b, props.jetzt)
    const passt = (s: SichtStart) =>
      (!filter.value || klassenVon(s).includes(filter.value)) && (teamFilter.value.length === 0 || teamsVon(s).some((k) => teamFilter.value.includes(k)))
    const gruppen: Gruppe[] = [
      { art: 'amSteg', titel: tx('zuschauer.amSteg'), zeilen: [] },
      { art: 'vorSteg', titel: tx('zuschauer.vorSteg'), zeilen: [] },
      { art: 'danach', titel: tx('zuschauer.danach'), zeilen: [] },
      { art: 'bootFehlt', titel: tx('anzeige.bootFehlt'), zeilen: [] },
    ]
    const [amSteg, vorSteg, danach, bootFehlt] = gruppen
    for (const s of b.frei) {
      const w = zeiten.get(s.key)
      const z = passt(s) ? zeile(s, w) : null
      if (!z) continue
      // Auch angehalten (Pause/Störung) bleibt die Gruppe – wer am Steg wartet, wartet dort weiter.
      const steg = w?.art === 'zeit' || w?.art === 'angehalten' ? w.steg : null
      ;(steg === 'amSteg' ? amSteg : steg === 'vorSteg' ? vorSteg : danach).zeilen.push(z)
    }
    for (const s of b.bootFehlt) {
      const z = passt(s) ? zeile(s, undefined) : null
      if (z) bootFehlt.zeilen.push(z)
    }
    const offen = b.frei.length + b.bootFehlt.length
    const sichtbar = gruppen.reduce((n, g) => n + g.zeilen.length, 0)
    return {
      b,
      stand: standText(b, offen),
      imBoot: b.aktuell ? zeile(b.aktuell, undefined) : null,
      gruppen: gruppen.filter((g) => g.zeilen.length > 0),
      leer: offen > 0 && sichtbar === 0,
    }
  }),
)
const mehrere = computed(() => ansichten.value.length > 1)
/** Zeigt die Liste einen Bereich mit Wartezeiten (Manövrieren)? Ohne ihn – nur Parallelslalom – kein Hinweis darauf. */
const mitWartezeiten = computed(() => ansichten.value.length === 0 || ansichten.value.some((a) => a.b.art !== 'parallel'))
</script>

<template>
  <div class="zuschauer-liste">
    <div v-if="klassen.length > 1" class="zuschauer-filter" role="group" :aria-label="tx('zuschauer.klasse')" data-teil="filter">
      <button type="button" :class="['zuschauer-chip', filter === '' ? 'active' : '']" :aria-pressed="filter === ''" data-klasse="" @click="gemerkt = ''">
        {{ tx('zuschauer.alle') }}
      </button>
      <button
        v-for="k in klassen"
        :key="k.id"
        type="button"
        :class="['zuschauer-chip', filter === k.id ? 'active' : '']"
        :aria-pressed="filter === k.id"
        :data-klasse="k.id"
        :title="k.titel"
        @click="gemerkt = k.id"
      >
        <span class="class-badge" :style="{ background: k.farbe }">{{ k.name }}</span>
      </button>
    </div>

    <details v-if="teams.length > 1" class="zuschauer-teams" data-teil="team-filter" :open="teamsOffen" @toggle="teamsOffen = ($event.target as HTMLDetailsElement).open">
      <summary>
        {{ tx('zuschauer.team') }}:
        <span data-teil="team-wahl">{{ teamFilter.length === 0 ? tx('zuschauer.alle') : tx('zuschauer.team.gewaehlt', { n: teamFilter.length }) }}</span>
      </summary>
      <div class="zuschauer-filter" role="group" :aria-label="tx('zuschauer.team')">
        <button type="button" :class="['zuschauer-chip', teamFilter.length === 0 ? 'active' : '']" :aria-pressed="teamFilter.length === 0" data-team="" @click="teamsGemerkt = []">
          {{ tx('zuschauer.alle') }}
        </button>
        <button
          v-for="tm in teams"
          :key="tm.id"
          type="button"
          :class="['zuschauer-chip', 'zuschauer-team', teamFilter.includes(tm.id) ? 'active' : '']"
          :aria-pressed="teamFilter.includes(tm.id)"
          :data-team="tm.id"
          :title="tm.id"
          @click="schalteTeam(tm.id)"
        >
          <HerkunftText v-if="tm.herkunft" :anzeige="tm.herkunft" />
          <span v-else data-teil="team-ohne-start">{{ tm.id }}</span>
        </button>
      </div>
    </details>

    <p v-if="ansichten.length === 0" class="zuschauer-leer">{{ tx('anzeige.keineStarter') }}</p>

    <section v-for="a in ansichten" :key="a.b.id" class="zuschauer-bereich" :data-bereich="a.b.id">
      <h2 v-if="mehrere || sicht.einst.parcoursName">{{ a.b.name }}</h2>
      <p v-if="a.b.meldung" :class="['zuschauer-meldung', a.b.meldung.art]" data-teil="meldung">{{ a.b.meldung.text }}</p>
      <p v-if="a.stand" class="zuschauer-stand" data-teil="stand">{{ a.stand }}</p>
      <p v-if="a.b.art === 'parallel'" class="zuschauer-stand" data-teil="ohne-zeit">{{ tx('zuschauer.ohneZeit') }}</p>

      <div class="zuschauer-imboot" data-teil="imboot">
        <span class="zuschauer-gruppe-titel">{{ tx('zuschauer.imBoot') }}</span>
        <div v-if="a.imBoot?.seiten" class="zuschauer-start gross zuschauer-paar">
          <span class="zuschauer-wer">
            <span v-for="x in a.imBoot.seiten" :key="x.rc" class="zuschauer-seite" :data-racecourse="x.rc">
              <span class="zuschauer-rc">{{ tx('anzeige.racecourse', { rc: x.rc }) }}</span>
              <span class="zuschauer-nr">{{ x.startNr }}</span>
              <span class="zuschauer-name">{{ x.name }}</span>
              <HerkunftText v-if="x.herkunft" :anzeige="x.herkunft" />
            </span>
            <span class="zuschauer-was">
              <span v-if="a.imBoot.klasse" class="class-badge sm" :style="{ background: a.imBoot.klasse.farbe }">{{ a.imBoot.klasse.name }}</span>
              {{ a.imBoot.lauf }}
            </span>
          </span>
        </div>
        <div v-else-if="a.imBoot" class="zuschauer-start gross">
          <span class="zuschauer-nr">{{ a.imBoot.startNr }}</span>
          <span class="zuschauer-wer">
            <span class="zuschauer-name">{{ a.imBoot.name }}</span>
            <span class="zuschauer-was">
              <span v-if="a.imBoot.klasse" class="class-badge sm" :style="{ background: a.imBoot.klasse.farbe }">{{ a.imBoot.klasse.name }}</span>
              {{ a.imBoot.lauf }}
              <HerkunftText v-if="a.imBoot.herkunft" :anzeige="a.imBoot.herkunft" />
            </span>
          </span>
        </div>
        <span v-else class="zuschauer-leer">{{ tx('zuschauer.keiner') }}</span>
      </div>

      <div v-for="g in a.gruppen" :key="g.art" class="zuschauer-gruppe" :data-gruppe="g.art">
        <h3 class="zuschauer-gruppe-titel">{{ g.titel }}</h3>
        <ol class="zuschauer-starts">
          <li v-for="z in g.zeilen" :key="z.key" :class="['zuschauer-start', g.art === 'bootFehlt' ? 'aus' : '', z.seiten ? 'zuschauer-paar' : '']" :data-start="z.key">
            <span v-if="z.seiten" class="zuschauer-wer">
              <span v-for="x in z.seiten" :key="x.rc" class="zuschauer-seite" :data-racecourse="x.rc">
                <span class="zuschauer-rc">{{ tx('anzeige.racecourse', { rc: x.rc }) }}</span>
                <span class="zuschauer-nr">{{ x.startNr }}</span>
                <span class="zuschauer-name">{{ x.name }}</span>
                <HerkunftText v-if="x.herkunft" :anzeige="x.herkunft" />
              </span>
              <span class="zuschauer-was">
                <span v-if="z.klasse" class="class-badge sm" :style="{ background: z.klasse.farbe }">{{ z.klasse.name }}</span>
                {{ z.lauf }}
              </span>
            </span>
            <span v-else class="zuschauer-nr">{{ z.startNr }}</span>
            <span v-if="!z.seiten" class="zuschauer-wer">
              <span class="zuschauer-name">{{ z.name }}</span>
              <span class="zuschauer-was">
                <span v-if="z.klasse" class="class-badge sm" :style="{ background: g.art === 'bootFehlt' ? 'var(--muted)' : z.klasse.farbe }">{{ z.klasse.name }}</span>
                {{ z.lauf }}
                <HerkunftText v-if="z.herkunft" :anzeige="z.herkunft" />
              </span>
            </span>
            <span class="zuschauer-zeit">
              <span v-if="z.ca" data-teil="ca">{{ z.ca }}</span>
              <span v-if="z.vorsteg" class="zuschauer-vorsteg" data-teil="vorsteg">{{ z.vorsteg }}</span>
            </span>
          </li>
        </ol>
      </div>
      <p v-if="a.leer" class="zuschauer-leer" data-teil="leer">{{ tx('zuschauer.leer') }}</p>
    </section>

    <!-- Der Hinweis gilt den Wartezeiten – der Parallelslalom hat keine (BETRIEB_ANNAHMEN.parallelOhnePrognose) und sagt das selbst. -->
    <p v-if="mitWartezeiten" class="zuschauer-hinweis" data-teil="hinweis">{{ tx('zuschauer.hinweis') }}</p>
  </div>
</template>
