<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, useId } from 'vue'
import { merke } from '../lib/merken'
import { useReiter } from '../lib/router'
import type { ReiterNamen } from '../lib/adressen'
import { useStore } from '../state/store'
import { duplicateStartNrIds } from '../domain/startnumbers'
import { fileStamp } from '../persistenz/backup'
import { originLabelKey } from '../lib/origin'
import { t, tn } from '../i18n'
import { useListenSprache } from '../lib/listensprache'
import WkrListen from '../components/WkrListen.vue'
import ErgebnisListen from '../components/ErgebnisListen.vue'
import ParallelErgebnisListen from '../components/ParallelErgebnisListen.vue'
import EinzelwertungListen from '../components/EinzelwertungListen.vue'
import PokalListen from '../components/PokalListen.vue'
import LaufzettelListen from '../components/LaufzettelListen.vue'
import ParallelWkrListen from '../components/ParallelWkrListen.vue'
import ParallelLaufzettel from '../components/ParallelLaufzettel.vue'
import CodesAushang from '../components/CodesAushang.vue'
import StarterBlaetter from '../components/StarterBlaetter.vue'
import DruckdateiListen from '../components/DruckdateiListen.vue'
import AusgleichListen from '../components/AusgleichListen.vue'
import TeamListen from '../components/TeamListen.vue'
import { teamListen } from '../lib/teamListe'
import { mannschaftSchluessel } from '../lib/pokal'
import { ausgleichListen } from '../lib/ausgleich'
import { useEvent } from '../lib/event'
import type { ClassId, ParallelRunde } from '../types'
import { adresse } from '../lib/router'
import { gibDoppelseitig, istDoppelseitigArt, istDoppelseitigWahl, type DoppelseitigArt } from '../lib/doppelseitig'
import { ALLE, gewaehlteHerkuenfte, herkuenfte, istStarterArt, istStarterWahl, ohneHerkunft, PARALLEL_STARTLISTEN, STARTER_ARTEN, STARTER_WAHL, starterDokumente, type ParallelStartlisteForm, type StarterArt, type StarterDokument, type StarterWahl, type Herkunft } from '../lib/starterlisten'
import { hatEigene, rundenStartliste } from '../lib/parallelStartliste'
import { festeRunden } from '../lib/parallelBogen'
import { rundenName, VORLAUF } from '../planung/parallelRunden'
import ParallelStartlisten from '../components/ParallelStartlisten.vue'

/**
 * Druckbare Listen. Gedruckt wird über den Browser (auch „Als PDF speichern“);
 * die Bildschirmansicht ist die Druckansicht.
 */
// Die Starterlisten stehen vorn: ein Reiter, darunter die Auswahl „Art“ (verzahnt, je Herkunft
// nach Startnummer, nach Klasse – lib/starterlisten.ts). Danach in der Reihenfolge, in der man
// die Listen am Wettkampftag braucht: Die Laufzettel und der Aushang der Fehler- und
// Disqualifikations-Codes gehören zu den Bögen der Wettkampfrichter; die Mannschaftswertung
// (im Code „pokal“) entsteht aus den Wertungslisten und steht hinter ihnen. Zuletzt die
// Druckdatei: alles zusammen in einer Datei, die nach dem Wettkampf an die Gruppen geht.
const KINDS = ['starter', 'gewicht', 'vorsteg', 'wkr', 'laufzettel', 'codes', 'ergebnis', 'pokal', 'druckdatei'] as const satisfies readonly ReiterNamen['listen'][]
type Kind = (typeof KINDS)[number]

const { state, dispatch } = useStore()
// Eine gemerkte Listenart, die es nicht mehr gibt (die früheren zwei Starter-Reiter), gilt als die Vorgabe.
const kind = merke<Kind>('listen.art', 'starter', { gueltig: (x) => (KINDS as readonly unknown[]).includes(x) })
// Was im Reiter „Starterlisten“ gewählt ist, bleibt über Ansichtswechsel und Neuladen stehen.
const starterWahl = merke<StarterWahl>('listen.starter', () => ({ ...STARTER_WAHL }), { ueberNeuladen: true, gueltig: istStarterWahl })
const id = useId()
const { classes, classLabel, parallel } = useEvent()

// Doppelseitig drucken: Jedes Dokument beginnt auf einem neuen Blatt (lib/doppelseitig.ts).
// Den Schalter haben die Listenarten mit mehreren Dokumenten in einem Druck; die Bögen der
// Wettkampfrichter haben mit der Rückseiten-Option ihre eigene Logik. Vorgabe aus; gemerkt
// wird je Listenart, über Ansichtswechsel und Neuladen.
const doppelseitigWahl = merke<Partial<Record<DoppelseitigArt, boolean>>>('listen.doppelseitig', () => ({}), { ueberNeuladen: true, gueltig: istDoppelseitigWahl })
const doppelseitigArt = computed<DoppelseitigArt | undefined>(() => (istDoppelseitigArt(kind.value) ? kind.value : undefined))
const doppelseitig = computed(() => doppelseitigArt.value !== undefined && doppelseitigWahl.value[doppelseitigArt.value] === true)
gibDoppelseitig(doppelseitig)
function setzeDoppelseitig(e: Event) {
  if (doppelseitigArt.value) doppelseitigWahl.value[doppelseitigArt.value] = (e.target as HTMLInputElement).checked
}

// Gewichtslisten gibt es in zwei Arten: je Herkunft zum Eintragen beim Check-in (quer, ohne
// Startnummern) und „Ausgleichsgewichte“ für den Steg (hoch, je Klasse ein Blatt nach
// Startnummer – lib/ausgleich.ts). Die Wahl bleibt über Ansichtswechsel und Neuladen stehen.
// Unter Regel 960 kommt eine dritte dazu: die Liste der Fahrer je Team nach Pkt. 3.7 (Race
// number, Name, Sex, Date of birth, Verified weight and ballast, Class, Co-driver –
// lib/teamListe.ts). Eine interne Liste; sie steht nie in der Druckdatei.
const GEWICHT_ARTEN = ['herkunft', 'steg', 'team'] as const
type GewichtArt = (typeof GEWICHT_ARTEN)[number]
// `herkunft`: für welche Herkunft die Listen zum Eintragen gedruckt werden (Schlüssel wie in
// lib/starterlisten.ts `herkuenfte`) – auch per Querverweis aus der Verwiegung gewählt.
const gewichtWahl = merke<{ art: GewichtArt; klasse: string; team?: string; herkunft?: string }>('listen.gewicht', () => ({ art: 'herkunft', klasse: ALLE }), {
  ueberNeuladen: true,
  gueltig: (x) => !!x && typeof x === 'object' && (GEWICHT_ARTEN as readonly unknown[]).includes((x as { art?: unknown }).art) && typeof (x as { klasse?: unknown }).klasse === 'string',
})
/** Die Arten, die es für die Veranstaltung gibt: die Liste je Team nur unter Regel 960 und mit einer Herkunft. */
const gewichtArten = computed(() => GEWICHT_ARTEN.filter((a) => a !== 'team' || (parallel.value && state.value.originMode !== 'none')))
const gewichtArt = computed<GewichtArt>(() => (gewichtArten.value.includes(gewichtWahl.value.art) ? gewichtWahl.value.art : 'herkunft'))
/** Die Liste für den Steg ist gewählt. */
const stegList = computed(() => kind.value === 'gewicht' && gewichtArt.value === 'steg')
/** Die Liste der Fahrer je Team (Regel 960, Pkt. 3.7) ist gewählt. */
const teamList = computed(() => kind.value === 'gewicht' && gewichtArt.value === 'team')
/** Klassen mit Startern – nur für sie gibt es ein Blatt. */
const stegKlassen = computed(() => classes.value.filter((c) => state.value.starters.some((p) => p.klasse === c.id)))
/** Die gewählte Klasse – eine, die es nicht mehr gibt, zählt wie „alle“. */
const stegKlasse = computed(() => (stegKlassen.value.some((c) => c.id === gewichtWahl.value.klasse) ? (gewichtWahl.value.klasse as ClassId) : ALLE))
const stegListen = computed(() => (stegList.value ? ausgleichListen(state.value, stegKlasse.value === ALLE ? undefined : [stegKlasse.value as ClassId]) : []))
const stegUngewogen = computed(() => stegListen.value.reduce((n, l) => n + l.ungewogen, 0))
// Was auf den Blättern steht, folgt der Listensprache (`lt`, lib/listensprache.ts); die
// Bedienung und der Fenstertitel der Sprache der Oberfläche (`t`).
const { t: lt } = useListenSprache()

const ohneHerkunftsArt = computed(() => state.value.originMode === 'none')
/** Die Arten der Starterliste, die es gibt: die des Parallelslaloms nur unter einem Regelwerk, das ihn kennt. */
const starterArten = computed(() => STARTER_ARTEN.filter((a) => a !== 'parallel' || parallel.value))
/** Die Herkünfte des Starterfelds – gleichbedeutende Schreibweisen zusammengefasst wie in der Mannschaftswertung. */
const alleHerkuenfte = computed(() => herkuenfte(state.value.starters, state.value.originMode))
const starterOhneHerkunft = computed(() => ohneHerkunft(state.value.starters, state.value.originMode).length)
/** Die Art, die gilt: Ohne Herkunft gibt es keine Liste je Herkunft – dann bleibt die Wahl stehen, gezeigt wird die verzahnte. */
const starterArt = computed<StarterArt>(() =>
  (starterWahl.value.art === 'herkunft' && ohneHerkunftsArt.value) || (starterWahl.value.art === 'parallel' && !parallel.value) ? 'verzahnt' : starterWahl.value.art,
)

// Startliste einer Runde des Parallelslaloms (components/ParallelStartlisten.vue): A und B
// nebeneinander wie in der Druckdatei – oder je Racecourse eine eigene zum Aushang am jeweiligen
// Parcours (Entscheidung des Nutzers vom 15.11.2026). Es gibt sie für jede festgeschriebene Runde.
const parallelStart = computed(() => kind.value === 'starter' && starterArt.value === 'parallel')
const startRunden = computed<ParallelRunde[]>(() => (parallel.value ? festeRunden(state.value.parallelPlaene) : []))
const startRunde = computed(() => (startRunden.value.some((r) => r === starterWahl.value.runde) ? (starterWahl.value.runde as ParallelRunde) : ALLE))
const startForm = computed<ParallelStartlisteForm>(() => starterWahl.value.racecourse ?? 'nebeneinander')
/** Die Dokumente: je gewählter Runde die gemeinsame Liste oder die eines bzw. beider Racecourses. */
// Mit Markierung (Wunsch des Nutzers vom 21.11.2026, wie verzahnt): je Herkunft der ganze Satz;
// eine Runde bzw. ein Racecourse, auf dem die Herkunft niemanden am Start hat, entfällt für sie.
const startDokumente = computed(() => {
  const runden = startRunde.value === ALLE ? startRunden.value : [startRunde.value as ParallelRunde]
  const formen = startForm.value === 'je' ? (['A', 'B'] as const) : startForm.value === 'nebeneinander' ? [undefined] : [startForm.value]
  const fuer = parallelStart.value && markierung.value !== '' ? gewaehlteHerkuenfte(alleHerkuenfte.value, markierung.value) : []
  if (fuer.length === 0) return formen.map((racecourse) => ({ key: racecourse ?? 'ab', racecourse, runden, herkunft: undefined as Herkunft | undefined }))
  const listen = new Map(runden.map((r) => [r, rundenStartliste(state.value, r)]))
  return fuer.flatMap((h) => {
    const eigene = new Set(h.starter.map((p) => p.id))
    return formen
      .map((racecourse) => ({ key: `${racecourse ?? 'ab'}|${h.schluessel}`, racecourse, herkunft: h as Herkunft | undefined, runden: runden.filter((r) => { const l = listen.get(r); return !!l && hatEigene(l, eigene, racecourse) }) }))
      .filter((d) => d.runden.length > 0)
  })
})
const parallelStartStand = computed(() => ({
  anzahl: startDokumente.value.reduce((n, d) => n + d.runden.length, 0),
  auswahl: [
    [t('lists.starter.art.parallel'), startRunde.value === ALLE ? '' : rundenName(startRunde.value as ParallelRunde, t), t(`lists.starter.parallel.${startForm.value}`)].filter(Boolean).join(' '),
    markierung.value === '' ? '' : (alleHerkuenfte.value.find((h) => h.schluessel === markierung.value)?.name ?? `${t(originLabelKey(state.value.originMode))}: ${t('lists.wkr.all')}`),
  ]
    .filter(Boolean)
    .join(', '),
}))
/** Verzahnt: die Markierung, die gilt – '' = keine. Eine Herkunft, die es nicht mehr gibt, zählt wie „ohne Markierung“. */
const markierung = computed(() => {
  const m = starterWahl.value.markierung
  return ohneHerkunftsArt.value || m === '' ? '' : m === ALLE || alleHerkuenfte.value.some((h) => h.schluessel === m) ? m : ''
})
/** Je Herkunft: die gewählte – eine, die es nicht mehr gibt, zählt wie „alle“. */
const herkunftsWahl = computed(() => (alleHerkuenfte.value.some((h) => h.schluessel === starterWahl.value.herkunft) ? starterWahl.value.herkunft : ALLE))

// Die Listen mit einer Zeile je Starter (Starterlisten, Vorsteg, Gewichtsliste zum Eintragen)
// zeichnet components/StarterBlaetter.vue; was auf ihnen steht, legt lib/starterlisten.ts fest.
// Die Ausgleichsgewichte für den Steg zeichnet eine eigene Ansicht (components/AusgleichListen.vue).

// Listen entstehen erst, wenn jede Startnummer gesetzt und eindeutig ist.
const missing = computed(() => state.value.starters.filter((p) => p.startNr.trim() === '').length)
const duplicate = computed(() => duplicateStartNrIds(state.value.starters, state.value.startNrMode).size)
// Gewichtslisten entstehen beim Check-in, oft bevor es Startnummern gibt – sie brauchen keine.
// Die Liste für den Steg dagegen ist nach Startnummer geordnet und braucht sie wie die übrigen;
// ebenso die Liste je Team, die die Race number nennen muss (Pkt. 3.7).
const weightList = computed(() => kind.value === 'gewicht' && !stegList.value && !teamList.value)
/** Das gewählte Team – eines, das es nicht mehr gibt, zählt wie „alle“. */
const teamWahl = computed(() => (alleHerkuenfte.value.some((h) => h.schluessel === gewichtWahl.value.team) ? gewichtWahl.value.team! : ALLE))
const teamListenAlle = computed(() => (teamList.value ? teamListen(state.value, teamWahl.value) : []))
/** Gewichtslisten zum Eintragen: die gewählte Herkunft – eine, die es nicht (mehr) gibt, zählt wie „alle“. */
const gewichtHerkunft = computed(() => (alleHerkuenfte.value.some((h) => h.schluessel === gewichtWahl.value.herkunft) ? gewichtWahl.value.herkunft! : ALLE))
const teamUngewogen = computed(() => teamListenAlle.value.reduce((n, l) => n + l.ungewogen, 0))
const teamOhneGeschlecht = computed(() => teamListenAlle.value.reduce((n, l) => n + l.zeilen.filter((z) => z.starter.geschlecht === undefined).length, 0))
// Der Aushang der Codes hängt nur am Regelwerk – er lässt sich drucken, bevor es Starter gibt.
const codeList = computed(() => kind.value === 'codes')
// Wertungslisten und Mannschaftswertung rechnen über die Starter-ID; eine fehlende Nummer hält den Aushang nicht auf.
// Die Druckdatei lässt dann nur ihre Starterliste weg und sagt das (components/DruckdateiListen.vue).
const blocked = computed(() => !weightList.value && !codeList.value && kind.value !== 'ergebnis' && kind.value !== 'pokal' && kind.value !== 'druckdatei' && (missing.value > 0 || duplicate.value > 0))

// Unter einem Regelwerk mit Parallelslalom (UIM 960) gibt es die Bögen der Wettkampfrichter, die
// Laufzettel und die Wertungslisten je Disziplin: Die des Parallelslaloms gehören zu Runde und
// Racecourse statt zu Klasse und Lauf und haben eigene Ansichten (components/ParallelWkrListen.vue,
// ParallelLaufzettel.vue, ParallelErgebnisListen.vue). Die Wahl bleibt über Ansichtswechsel und
// Neuladen stehen.
// Bei den Wertungslisten steht daneben die Einzelwertung über beide Stages („Individual
// competition“, Pkt. 5.2.3; components/EinzelwertungListen.vue) – Bögen und Laufzettel gibt es
// dazu nicht: Dort gilt die Wahl „Einzelwertung“ wie „Manövrieren“.
const DISZIPLINEN = ['manoever', 'parallel', 'einzel'] as const
type Disziplin = (typeof DISZIPLINEN)[number]
const disziplinWahl = merke<Disziplin>('listen.disziplin', 'manoever', { ueberNeuladen: true, gueltig: (x) => (DISZIPLINEN as readonly unknown[]).includes(x) })
const mitDisziplin = computed(() => parallel.value && (kind.value === 'wkr' || kind.value === 'laufzettel' || kind.value === 'ergebnis'))
const disziplinen = computed(() => DISZIPLINEN.filter((d) => d !== 'einzel' || kind.value === 'ergebnis'))
const disziplin = computed<Disziplin>(() => (disziplinen.value.includes(disziplinWahl.value) ? disziplinWahl.value : 'manoever'))
const imParallel = computed(() => mitDisziplin.value && disziplin.value === 'parallel')
const imEinzel = computed(() => mitDisziplin.value && disziplin.value === 'einzel')

// Die Bögen der Wettkampfrichter (Manövrieren) und ihre Laufzettel lassen sich erst drucken,
// wenn die Verzahnung festgeschrieben ist (Entscheidung des Nutzers vom 15.11.2026): Sie legt
// Startnummern und Startreihenfolge auf den Bögen fest. Ansehen geht vorher schon; gedruckt wird
// weder über den Knopf noch über Strg+P (`druck-gesperrt` in WkrListen/LaufzettelListen). Die
// Listen des Parallelslaloms hängen an ihren festgeschriebenen Runden und bleiben, wie sie sind.
// Andere Wege zu diesen Bögen gibt es nicht: Die Druckdatei enthält keine (lib/druckdatei.ts),
// die Beispielansicht wird nie gedruckt (components/WkrVorschau.vue).
const vorVerzahnung = computed(() => (kind.value === 'wkr' || kind.value === 'laufzettel') && !imParallel.value && !state.value.verzahnungLocked)

// Wettkampfrichter-Listen zeichnet eine eigene Ansicht (components/WkrListen.vue); sie
// meldet, wie viele Bögen die Auswahl zeigt und wie die Auswahl heißt.
const wkrList = computed(() => kind.value === 'wkr')
const wkrStand = ref<{ anzahl: number; auswahl: string; runden?: ParallelRunde[] }>({ anzahl: 0, auswahl: '' })
// Wertungslisten ebenso (components/ErgebnisListen.vue).
const resultList = computed(() => kind.value === 'ergebnis')
const resultStand = ref({ anzahl: 0, auswahl: '' })
// Und die Laufzettel (components/LaufzettelListen.vue).
const runSheets = computed(() => kind.value === 'laufzettel')
const runSheetStand = ref<{ anzahl: number; auswahl: string; runden?: ParallelRunde[] }>({ anzahl: 0, auswahl: '' })
// Und die Pokalauswertung (components/PokalListen.vue); sie sagt auch selbst, warum es keine gibt.
const cupList = computed(() => kind.value === 'pokal')
const cupStand = ref({ anzahl: 0, auswahl: '' })
// Und die Ausgleichsgewichte für den Steg (components/AusgleichListen.vue); ihre Auswahl steht hier.
const teamStand = computed(() => ({ anzahl: teamListenAlle.value.length, auswahl: [t('lists.weight.art.team'), teamWahl.value === ALLE ? '' : (alleHerkuenfte.value.find((h) => h.schluessel === teamWahl.value)?.name ?? '')].filter(Boolean).join(' ') }))
const stegStand = computed(() => ({ anzahl: stegListen.value.length, auswahl: [t('lists.title.ausgleich'), stegKlasse.value === ALLE ? '' : classLabel(stegKlasse.value as ClassId)].filter(Boolean).join(' ') }))
// Und die Druckdatei (components/DruckdateiListen.vue): Starterliste, Mannschaftswertungen, Codes und Wertungslisten in einem Druck.
const bookletList = computed(() => kind.value === 'druckdatei')
const bookletStand = ref<{ anzahl: number; auswahl: string; runden: ParallelRunde[] }>({ anzahl: 0, auswahl: '', runden: [] })
const ownView = computed(() => wkrList.value || resultList.value || runSheets.value || cupList.value || stegList.value || teamList.value || bookletList.value || parallelStart.value)
const ownStand = computed(() =>
  parallelStart.value
    ? parallelStartStand.value
    : teamList.value
      ? teamStand.value
      : stegList.value
        ? stegStand.value
        : wkrList.value
          ? wkrStand.value
          : resultList.value
            ? resultStand.value
            : cupList.value
              ? cupStand.value
              : bookletList.value
                ? bookletStand.value
                : runSheetStand.value,
)
const nothingToPrint = computed(() => !codeList.value && (ownView.value ? ownStand.value.anzahl === 0 : sections.value.length === 0))

const sections = computed<StarterDokument[]>(() => {
  const k = kind.value
  if ((k !== 'starter' && k !== 'vorsteg' && k !== 'gewicht') || stegList.value || teamList.value) return []
  return starterDokumente(
    state.value,
    { liste: k, art: starterArt.value, markierung: markierung.value, herkunft: k === 'gewicht' ? gewichtHerkunft.value : herkunftsWahl.value },
    { starter: lt('lists.title.starter'), vorsteg: lt('lists.title.vorsteg'), gewicht: lt('lists.title.gewicht'), klasse: lt('lists.title.klasse') },
  )
})

/** Die Auswahl im Reiter „Starterlisten“ in Worten – für Fenstertitel und Dateiname, in der Sprache der Oberfläche. */
const starterAuswahl = computed(() => {
  const herkunftTitel = t(originLabelKey(state.value.originMode))
  const name = (wahl: string) => (wahl === ALLE ? '' : (alleHerkuenfte.value.find((h) => h.schluessel === wahl)?.name ?? ''))
  if (starterArt.value === 'klasse') return t('lists.starter.art.klasse')
  if (starterArt.value === 'parallel') return parallelStartStand.value.auswahl
  if (starterArt.value === 'herkunft') return [t('lists.starter.art.herkunft', { origin: herkunftTitel }), name(herkunftsWahl.value)].filter(Boolean).join(' ')
  return [t('lists.starter.art.verzahnt'), markierung.value === '' ? '' : name(markierung.value) || `${herkunftTitel}: ${t('lists.wkr.all')}`].filter(Boolean).join(', ')
})

/** Gewichtslisten zum Eintragen: die gewählte Herkunft in Worten – für Fenstertitel und Dateiname. */
const gewichtAuswahl = computed(() => (gewichtHerkunft.value === ALLE ? '' : (alleHerkuenfte.value.find((h) => h.schluessel === gewichtHerkunft.value)?.name ?? '')))

// Die Listenart steht auch in der Adresse: Nach einem Neuladen ist man wieder bei derselben Liste.
// Die Adressen der früheren Reiter (`#/listen/verzahnt`, `#/listen/nach-klasse`) führen hierher
// und wählen die passende Art.
// Der Querverweis „Gewichtslisten drucken“ der Verwiegung (Entscheidung des Nutzers vom
// 15.11.2026) gibt die dort gewählte Herkunft mit (`#/listen/gewicht/Musterclub`, `*` = alle):
// Sie gilt für die Listen zum Eintragen, gefunden über denselben Schlüssel wie die Gruppen der
// Verwiegung (Schreibweisen zusammengefasst).
useReiter(
  'listen',
  kind,
  KINDS,
  (art) => {
    if (istStarterArt(art)) starterWahl.value.art = art
  },
  (reiter, wahl) => {
    if (reiter !== 'gewicht') return
    const name = wahl.replace(/\s+/g, ' ').trim()
    const herkunft = name === ALLE || name === '' ? ALLE : mannschaftSchluessel(name, state.value.originMode)
    gewichtWahl.value = { ...gewichtWahl.value, art: 'herkunft', herkunft }
  },
  // Die gewählte Herkunft bleibt in der Adresse stehen (Entscheidung 16.11.2026) – „alle“ ist die Vorgabe
  // und steht nicht da. Deshalb steht useReiter erst hier: Es schreibt die Adresse schon beim Aufbau.
  () => (kind.value === 'gewicht' && gewichtArt.value === 'herkunft' && gewichtAuswahl.value ? gewichtAuswahl.value : undefined),
)

const heading = computed(() => [state.value.eventName, state.value.eventJahr].filter(Boolean).join(' '))

// Im Seitenrand steht nichts, auch kein Druckzeitpunkt: Er änderte sich bei jedem Nachdruck
// und sagte nichts über die Liste. Nur die Wertungslisten tragen eine Zeit – die ihrer letzten
// Änderung, in einem eigenen Feld unter der Tabelle (components/ergebnis/ErgebnisFuss.vue).
// Eine Seitenzahl im Rand gab es nie: Die Zähler des Browsers laufen über den ganzen Druck-
// auftrag („Seite 58 von 178“); jede Liste zählt ihre Seiten selbst (ListenDokument.vue).

/** Dokumente (nicht Seiten), die die Auswahl zeigt. */
const dokumente = computed(() => sections.value.length)

/**
 * Die Runden des Parallelslaloms nach dem Vorlauf, deren Listen die Auswahl gerade zeigt: WKR-Bögen,
 * Laufzettel, Startlisten – auch die Startlisten in der Druckdatei (Regel 960). Werden sie gedruckt,
 * gilt die Runde als gebunden (Antwort des Nutzers vom 20.11.2026: „Ja, auf jeden Fall“) – eine
 * später festgeschriebene Klasse ordnet sie nicht mehr neu (state/reducer/parallel.ts).
 * Wertungslisten zählen nicht: Sie folgen den Werten, nicht der Folge.
 */
const gedruckteRunden = computed<ParallelRunde[]>(() => {
  if (!parallel.value || blocked.value) return []
  const runden = wkrList.value && imParallel.value ? (wkrStand.value.runden ?? []) : runSheets.value && imParallel.value ? (runSheetStand.value.runden ?? []) : parallelStart.value ? startDokumente.value.flatMap((d) => d.runden) : bookletList.value ? bookletStand.value.runden : []
  return [...new Set(runden)].filter((r) => r !== VORLAUF)
})

// Gemerkt wird beim Drucken selbst (`beforeprint`): So zählen der Knopf und Strg+P gleich. Der
// Reducer ändert nur, was noch nicht vermerkt ist; den Zeitpunkt setzt der Store.
function merkeGedruckt() {
  if (gedruckteRunden.value.length > 0) dispatch({ type: 'PARALLEL_RUNDEN_GEDRUCKT', runden: gedruckteRunden.value })
}
onMounted(() => window.addEventListener('beforeprint', merkeGedruckt))
onBeforeUnmount(() => window.removeEventListener('beforeprint', merkeGedruckt))

/**
 * Drucken. Der Browser schlägt den Fenstertitel als Dateinamen für „Als PDF
 * speichern“ vor – deshalb trägt das Fenster währenddessen den Namen der Liste
 * (in der Sprache der Oberfläche), die Veranstaltung und den Zeitpunkt.
 */
function print() {
  const before = document.title
  const auswahl = ownView.value ? ownStand.value.auswahl : kind.value === 'starter' ? starterAuswahl.value : weightList.value ? gewichtAuswahl.value : ''
  // Die Druckdatei geht an alle Gruppen: Dort steht die Veranstaltung vorn – so heißt die Datei im Posteingang.
  const teile = bookletList.value ? [heading.value, t('lists.kind.druckdatei'), auswahl] : [t(`lists.kind.${kind.value}`), auswahl, heading.value]
  document.title = [...teile, fileStamp(new Date())].filter(Boolean).join(' - ')
  window.addEventListener('afterprint', () => (document.title = before), { once: true })
  window.print()
}
</script>

<template>
  <div class="panel no-print">
    <h2>{{ t('lists.title') }}</h2>
    <p class="hint">{{ t('lists.hint') }}</p>
    <div class="row" style="align-items: center">
      <div class="segmented list-kinds">
        <button v-for="k in KINDS" :key="k" type="button" :data-kind="k" :class="kind === k ? 'active' : ''" @click="kind = k">
          {{ t(`lists.kind.${k}`) }}
        </button>
      </div>
      <span style="flex: 1" />
      <label v-if="doppelseitigArt" class="boat-check doppelseitig-wahl" :title="t('lists.duplex.hint')">
        <input type="checkbox" data-feld="doppelseitig" :checked="doppelseitig" @change="setzeDoppelseitig" />
        {{ t('lists.duplex') }}
      </label>
      <button class="btn primary" :disabled="nothingToPrint || blocked || vorVerzahnung" @click="print">{{ t('common.print') }}</button>
    </div>
  </div>

  <!-- Starterlisten: die Art der Liste und – wo es eine Herkunft gibt – für wen. -->
  <div v-if="kind === 'starter'" class="panel no-print starter-wahl">
    <div class="row">
      <div class="field">
        <label>{{ t('lists.starter.art') }}</label>
        <div class="segmented starter-arten" role="group" :aria-label="t('lists.starter.art')">
          <button
            v-for="a in starterArten"
            :key="a"
            type="button"
            :data-art="a"
            :class="starterArt === a ? 'active' : ''"
            :aria-pressed="starterArt === a"
            :disabled="a === 'herkunft' && ohneHerkunftsArt"
            @click="starterWahl.art = a"
          >
            {{ t(`lists.starter.art.${a}`, { origin: t(originLabelKey(state.originMode)) }) }}
          </button>
        </div>
      </div>
      <div v-if="(starterArt === 'verzahnt' || starterArt === 'parallel') && !ohneHerkunftsArt" class="field">
        <label :for="`${id}-markierung`">{{ t('lists.starter.for', { origin: t(originLabelKey(state.originMode)) }) }}</label>
        <select :id="`${id}-markierung`" class="input" data-feld="starter-markierung" :value="markierung" @change="starterWahl.markierung = ($event.target as HTMLSelectElement).value">
          <option value="">{{ t('lists.starter.unmarked') }}</option>
          <option v-for="h in alleHerkuenfte" :key="h.schluessel" :value="h.schluessel">{{ h.name }}</option>
          <option v-if="alleHerkuenfte.length > 0" :value="ALLE">{{ t('lists.wkr.all') }}</option>
        </select>
      </div>
      <div v-if="starterArt === 'herkunft'" class="field">
        <label :for="`${id}-herkunft`">{{ t(originLabelKey(state.originMode)) }}</label>
        <select :id="`${id}-herkunft`" class="input" data-feld="starter-herkunft" :value="herkunftsWahl" @change="starterWahl.herkunft = ($event.target as HTMLSelectElement).value">
          <option :value="ALLE">{{ t('lists.wkr.all') }}</option>
          <option v-for="h in alleHerkuenfte" :key="h.schluessel" :value="h.schluessel">{{ h.name }}</option>
        </select>
      </div>
      <template v-if="starterArt === 'parallel'">
        <div v-if="startRunden.length > 1" class="field">
          <label :for="`${id}-start-runde`">{{ t('parallel.lists.round') }}</label>
          <select :id="`${id}-start-runde`" class="input" data-feld="start-runde" :value="startRunde" @change="starterWahl.runde = ($event.target as HTMLSelectElement).value">
            <option :value="ALLE">{{ t('lists.wkr.all') }}</option>
            <option v-for="r in startRunden" :key="r" :value="r">{{ rundenName(r, t) }}</option>
          </select>
        </div>
        <div class="field">
          <label :for="`${id}-start-racecourse`">{{ t('parallel.lists.racecourse') }}</label>
          <select :id="`${id}-start-racecourse`" class="input" data-feld="start-racecourse" :value="startForm" @change="starterWahl.racecourse = ($event.target as HTMLSelectElement).value as ParallelStartlisteForm">
            <option v-for="f in PARALLEL_STARTLISTEN" :key="f" :value="f">{{ t(`lists.starter.parallel.${f}`) }}</option>
          </select>
        </div>
      </template>
      <p v-if="!blocked" class="note ergebnis-zahl" role="status">{{ tn('results.count', parallelStart ? parallelStartStand.anzahl : dokumente) }}</p>
    </div>
    <p class="note" data-hinweis="starter-art">{{ t((starterArt === 'verzahnt' || starterArt === 'parallel') && markierung !== '' ? `lists.starter.hint.${starterArt}.marked` : `lists.starter.hint.${starterArt}`, { origin: t(originLabelKey(state.originMode)) }) }}</p>
    <p v-if="parallelStart && startRunden.length === 0" class="boat-banner warn" role="status" data-hinweis="parallel-plan">
      {{ t('parallel.lists.needPlan') }} <a :href="adresse('verzahnung', { reiter: 'parallel' })">{{ t('nav.verzahnung') }} → {{ t('parallel.title') }}</a>
    </p>
    <p v-if="ohneHerkunftsArt" class="note" data-hinweis="starter-ohne-herkunftsart">
      {{ t('lists.starter.noOrigin') }} <a :href="adresse('veranstaltung')">{{ t('nav.veranstaltung') }}</a
      >.
    </p>
    <p v-else-if="starterOhneHerkunft > 0 && (starterArt === 'herkunft' || markierung !== '')" class="note" data-hinweis="starter-ohne-herkunft">
      {{ tn('lists.starter.withoutOrigin', starterOhneHerkunft, { origin: t(originLabelKey(state.originMode)) }) }}
    </p>
  </div>

  <!-- Gewichtslisten: zum Eintragen beim Check-in (je Herkunft) oder die Ausgleichsgewichte für den Steg (je Klasse). -->
  <div v-if="kind === 'gewicht'" class="panel no-print gewicht-wahl">
    <div class="row">
      <div class="field">
        <label>{{ t('lists.weight.art') }}</label>
        <div class="segmented gewicht-arten" role="group" :aria-label="t('lists.weight.art')">
          <button v-for="a in gewichtArten" :key="a" type="button" :data-art="a" :class="gewichtArt === a ? 'active' : ''" :aria-pressed="gewichtArt === a" @click="gewichtWahl.art = a">
            {{ a === 'team' ? t('lists.weight.art.team') : a === 'steg' ? t('lists.weight.art.steg') : ohneHerkunftsArt ? t('lists.weight.art.checkin') : t('lists.weight.art.herkunft', { origin: t(originLabelKey(state.originMode)) }) }}
          </button>
        </div>
      </div>
      <div v-if="stegList" class="field">
        <label :for="`${id}-steg-klasse`">{{ t('lists.class') }}</label>
        <select :id="`${id}-steg-klasse`" class="input" data-feld="steg-klasse" :value="stegKlasse" @change="gewichtWahl.klasse = ($event.target as HTMLSelectElement).value">
          <option :value="ALLE">{{ t('lists.wkr.all') }}</option>
          <option v-for="c in stegKlassen" :key="c.id" :value="c.id">{{ classLabel(c.id) }}</option>
        </select>
      </div>
      <div v-if="weightList && !ohneHerkunftsArt && alleHerkuenfte.length > 0" class="field">
        <label :for="`${id}-gewicht-herkunft`">{{ t(originLabelKey(state.originMode)) }}</label>
        <select :id="`${id}-gewicht-herkunft`" class="input" data-feld="gewicht-herkunft" :value="gewichtHerkunft" @change="gewichtWahl.herkunft = ($event.target as HTMLSelectElement).value">
          <option :value="ALLE">{{ t('lists.wkr.all') }}</option>
          <option v-for="h in alleHerkuenfte" :key="h.schluessel" :value="h.schluessel">{{ h.name }}</option>
        </select>
      </div>
      <div v-if="teamList" class="field">
        <label :for="`${id}-team`">{{ t(originLabelKey(state.originMode)) }}</label>
        <select :id="`${id}-team`" class="input" data-feld="team-wahl" :value="teamWahl" @change="gewichtWahl.team = ($event.target as HTMLSelectElement).value">
          <option :value="ALLE">{{ t('lists.wkr.all') }}</option>
          <option v-for="h in alleHerkuenfte" :key="h.schluessel" :value="h.schluessel">{{ h.name }}</option>
        </select>
      </div>
      <p v-if="!blocked && state.starters.length > 0" class="note ergebnis-zahl" role="status">{{ tn('results.count', teamList ? teamListenAlle.length : stegList ? stegListen.length : dokumente) }}</p>
    </div>
    <p class="note" data-hinweis="gewicht-art">
      {{ t(`lists.weight.hint.${gewichtArt}`) }}
      <template v-if="teamList">
        <a :href="adresse('einstellungen')">{{ t('nav.einstellungen') }}</a
        >.
      </template>
      <template v-if="stegList">
        <a :href="adresse('veranstaltung', { ziel: 'besetzung' })">{{ t('nav.veranstaltung') }} → {{ t('crew.title') }}</a
        >.
      </template>
    </p>
    <p v-if="teamList && !blocked && teamOhneGeschlecht > 0" class="note" data-hinweis="team-ohne-geschlecht" role="status">
      {{ tn('lists.team.noSex', teamOhneGeschlecht) }} <a :href="adresse('starter')">{{ t('nav.starter') }}</a
      >.
    </p>
    <p v-if="teamList && !blocked && teamUngewogen > 0" class="boat-banner warn" data-hinweis="team-ungewogen" role="status">
      {{ tn('lists.weight.unweighed', teamUngewogen) }} <a :href="adresse('verwiegung')">{{ t('nav.verwiegung') }}</a
      >.
    </p>
    <p v-if="stegList && !blocked && stegUngewogen > 0" class="boat-banner warn" data-hinweis="steg-ungewogen" role="status">
      {{ tn('lists.weight.unweighed', stegUngewogen) }} <a :href="adresse('verwiegung')">{{ t('nav.verwiegung') }}</a
      >.
    </p>
  </div>

  <!-- Bögen, Laufzettel und Wertungslisten je Disziplin – nur, wenn nach dem Regelwerk ein Parallelslalom gefahren wird. -->
  <div v-if="mitDisziplin" class="panel no-print disziplin-wahl">
    <div class="segmented" role="group" :aria-label="t('capture.discipline')">
      <button v-for="d in disziplinen" :key="d" type="button" :data-disziplin="d" :class="disziplin === d ? 'active' : ''" :aria-pressed="disziplin === d" @click="disziplinWahl = d">
        {{ d === 'einzel' ? t('individual.title') : t(`running.source.${d}`) }}
      </button>
    </div>
  </div>

  <p v-if="blocked" class="boat-banner warn no-print" role="alert" style="margin-bottom: 16px">
    <template v-if="missing > 0">{{ tn('lists.missingNumbers', missing) }} </template>
    <template v-if="duplicate > 0">{{ tn('lists.duplicateNumbers', duplicate) }} </template>
    {{ t('lists.fixNumbers') }}
  </p>
  <!-- Ohne no-print: Wer trotzdem Strg+P drückt, bekommt statt der Bögen diesen Hinweis aufs Papier. -->
  <p v-if="vorVerzahnung && !blocked && state.starters.length > 0" class="boat-banner warn" role="status" data-hinweis="vor-verzahnung" style="margin-bottom: 16px">
    {{ t('lists.wkr.needLock') }} <a :href="adresse('verzahnung')">{{ t('nav.verzahnung') }}</a
    >.
  </p>

  <CodesAushang v-if="codeList" />

  <!-- Vor dem Hinweis „keine Starter“: Ohne Herkunft oder ohne eingeschaltete Variante sagt die Ansicht das zuerst. -->
  <PokalListen v-else-if="cupList" @stand="cupStand = $event" />

  <div v-else-if="state.starters.length === 0" class="panel empty no-print">{{ t('lists.empty') }}</div>
  <!-- Starter gibt es, aber keine Liste: keiner fährt auf einem Parcours, oder keiner hat eine Herkunft. -->
  <div v-else-if="!ownView && sections.length === 0" class="panel empty no-print" data-hinweis="keine-liste">{{ t('lists.noList') }}</div>

  <ParallelWkrListen v-else-if="wkrList && imParallel" :gesperrt="blocked" @stand="wkrStand = $event" />
  <WkrListen v-else-if="wkrList" :gesperrt="blocked" :druck-gesperrt="vorVerzahnung" @stand="wkrStand = $event" />

  <ParallelLaufzettel v-else-if="runSheets && imParallel" :gesperrt="blocked" @stand="runSheetStand = $event" />
  <LaufzettelListen v-else-if="runSheets" :gesperrt="blocked" :druck-gesperrt="vorVerzahnung" @stand="runSheetStand = $event" />

  <ParallelErgebnisListen v-else-if="resultList && imParallel" @stand="resultStand = $event" />
  <EinzelwertungListen v-else-if="resultList && imEinzel" @stand="resultStand = $event" />
  <ErgebnisListen v-else-if="resultList" @stand="resultStand = $event" />

  <DruckdateiListen v-else-if="bookletList" :starter-gesperrt="missing > 0 || duplicate > 0" @stand="bookletStand = $event" />

  <!-- Vor gültigen Startnummern gibt es die Liste für den Steg nicht (der Hinweis steht oben). -->
  <template v-else-if="stegList"><AusgleichListen v-if="!blocked" :listen="stegListen" /></template>
  <!-- Startliste einer Runde des Parallelslaloms: gemeinsam oder je Racecourse; vor gültigen Startnummern keine. -->
  <template v-else-if="parallelStart">
    <template v-if="!blocked"><ParallelStartlisten v-for="d in startDokumente" :key="d.key" :runden="d.runden" :racecourse="d.racecourse" :herkunft="state.listOrigin" :markierung="d.herkunft" /></template>
  </template>
  <!-- Die Liste je Team nennt die Race number (Pkt. 3.7) und braucht gültige Startnummern wie die für den Steg. -->
  <template v-else-if="teamList"><TeamListen v-if="!blocked" :listen="teamListenAlle" :geburtsdatum="state.showBirthdate" /></template>

  <StarterBlaetter v-else :dokumente="sections" :liste="kind === 'gewicht' ? 'gewicht' : kind === 'vorsteg' ? 'vorsteg' : 'starter'" :form="starterArt === 'herkunft' ? 'herkunft' : 'starter'" :data-art="kind === 'starter' ? starterArt : undefined" />
</template>
