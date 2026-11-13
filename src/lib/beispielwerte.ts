import type { AppState, ClassId, Eingaben } from '../types'
import { CLASS_IDS } from '../domain/classes'
import { erfasstKennung, felderJeKennung, laufSchluessel, listenFelder, listenLauf, OHNE_LAUF, type EingabenKonfig, type Feld } from './eingaben'
import { mittlereZeit } from './ergebnis'
import { formatMinutenEingabe, formatSeconds } from './time'
import { veranstaltungsListen, type ListenWahl } from './listen'

// Glaubhafte Zufallswerte für alle Listen des Aufbaus, damit sich Erfassung und Ergebnislisten
// ohne ausgedachte Werte zeigen und prüfen lassen. Vorbild: lib/beispielwerte.ts im
// Fehlerpunkte-Prototyp – dort für die angezeigten Bögen, hier für die ganze Veranstaltung.
//
// Die Zahlen sind gerundete Kennzahlen je Klasse aus echten Ergebnislisten, je Wettkampf aus
// anderen: Das Manövrieren der DM kommt aus der DM 2026 (450 Läufe), das Manövrieren nach UIM
// aus der WM 2025 (194 Versuche). Einzelne Ergebnisse oder Namen stehen bewusst nicht im Repo.
// Zwei Annahmen stammen nicht aus den Listen, weil dort nur der Mittelwert steht: die Streuung
// zwischen den Stoppuhren und wie oft eine dritte Zeit dabei ist.
//
// Der Zufall kommt von außen (`zufall`): Der Reducer bleibt deterministisch, weil die Action
// die Saat mitbringt ({@link zufallAus}).

/** Stoppuhr: 2 bis 3 Zeiten als „1,2345“. Lichtschranke: genau eine Zeit als „85,34“. */
export type Zeitnahme = 'stoppuhr' | 'lichtschranke'

export type BeispielStand = ListenWahl & Pick<AppState, 'regelwerk' | 'starters' | 'laufCount' | 'eingaben'>
type Zufall = () => number

interface Profil {
  /** Gefahrene Zeit in Sekunden: unteres Quartil, Median, oberes Quartil. */
  zeit: [number, number, number]
  /** Wahrscheinlichkeit je Bojen-Zelle. */
  boje: number
  /** Abweichende Wahrscheinlichkeit je Zelle an diesen Stellen; ohne Angabe gilt `boje`. */
  start?: number
  ziel?: number
  tor5?: number
  /** Wahrscheinlichkeit eines Fehlers beim Anlegen je Start. */
  stegAn: number
  /** Wahrscheinlichkeit einer Disqualifikation je Start. */
  disq: number
  /** Wahrscheinlichkeit je Knoten. */
  knoten: number
}

type Ort = 'boje' | 'tor5' | 'mueb' | 'steg' | 'spalte'

/** Was einen Wettkampf statistisch ausmacht. */
interface Kennzahlen {
  /** Je Klasse; fehlt eine, gilt Klasse 5 (die WM kennt 6 und 7 nicht). */
  profile: Partial<Record<ClassId, Profil>>
  /** Fehler je Start an Stellen, die sich zwischen den Klassen kaum unterscheiden. */
  fehlerJeStart: Record<string, number>
  /**
   * Wie oft die Codes vorkamen, in der Nummerierung der Regelwerke. Was hier fehlt, kam nicht vor
   * oder gilt erst ab einer bestimmten Klasse und wird nicht gezogen.
   */
  codeHaeufigkeit: Record<string, number>
  /** Codes für den 2. und 3. Versuch stehen auch als „2x7“: Anteil der Wiederholungen. */
  wiederholt: Record<string, number>
  /** Anteil der Fehler-Zellen mit einem zweiten Code. */
  zweiterCode: number
  /** Wo Disqualifikationen standen und welche Buchstaben dort. `spalte` ist die Spalte Disq. */
  disqOrte: Record<Ort, { anteil: number; buchstaben: Record<string, number> }>
  /** Streuung derselben Person von Lauf zu Lauf in Sekunden. */
  laufStreuung: number
  /** Anteil der Läufe, die deutlich länger dauern, z. B. durch einen wiederholten Versuch. */
  patzer: number
}

const DM_2026: Kennzahlen = {
  profile: {
    E: { zeit: [79, 82, 95], boje: 0.05, stegAn: 0.43, disq: 0.25, knoten: 0.23 },
    1: { zeit: [68, 71, 81], boje: 0.12, stegAn: 0.41, disq: 0.08, knoten: 0.13 },
    2: { zeit: [70, 74, 80], boje: 0.1, stegAn: 0.17, disq: 0.05, knoten: 0.03 },
    3: { zeit: [74, 78, 83], boje: 0.06, stegAn: 0.18, disq: 0.05, knoten: 0.04 },
    4: { zeit: [76, 83, 94], boje: 0.11, stegAn: 0.04, disq: 0.24, knoten: 0.02 },
    5: { zeit: [100, 111, 117], boje: 0.03, stegAn: 0.03, disq: 0.23, knoten: 0.01 },
    6: { zeit: [102, 112, 123], boje: 0.04, stegAn: 0.03, disq: 0.31, knoten: 0 },
    7: { zeit: [108, 119, 131], boje: 0.05, stegAn: 0.12, disq: 0.29, knoten: 0 },
  },
  fehlerJeStart: { 'katalog:stegAblegen': 0.02, 'katalog:tor5': 0.03, 'katalog:mueb': 0.38 },
  codeHaeufigkeit: { 1: 7, 3: 8, 7: 28, 8: 14, 11: 4, 12: 32, 14: 25, 15: 10, 17: 57, 18: 7, 19: 15 },
  wiederholt: { 7: 0.15, 19: 0.3 },
  zweiterCode: 0.2,
  disqOrte: {
    boje: { anteil: 32, buchstaben: { J: 26, G: 4, H: 2 } },
    tor5: { anteil: 23, buchstaben: { J: 22, G: 1 } },
    mueb: { anteil: 23, buchstaben: { J: 7, D: 6, C: 4, H: 2, G: 2, L: 1, F: 1 } },
    steg: { anteil: 1, buchstaben: { I: 1 } },
    spalte: { anteil: 10, buchstaben: { D: 6, C: 3, G: 3, A: 1 } },
  },
  laufStreuung: 2.8,
  patzer: 0.1,
}

// Für die WM-Tabelle gilt: Je Klasse gab es nur 20 bis 44 Versuche. Die Quoten sind deshalb
// mit dem Schnitt aller Klassen geglättet (mit dem Gewicht von zehn Versuchen), sonst käme in
// manchen Klassen nie eine Disqualifikation vor. Die Codes und Buchstaben sind auf die Nummern
// von regelwerke/uim-2026.yaml umgeschrieben, die Legende der WM nummeriert anders. Geschrieben
// wie „2x7“ hat die WM keinen Code.

/**
 * Manövrieren nach UIM, beide Versuche. Fehler beim Anlegen sind nach ihren Codes gezählt, weil
 * die Liste sie in einigen Klassen unter „Pon. dep.“ führt. Die Buchstaben stehen dort meist nur
 * in der Spalte Error Code: Die Stellen von J sind wie bei der DM verteilt.
 */
const WM_MANOEVRIEREN: Kennzahlen = {
  profile: {
    E: { zeit: [71, 74, 85], boje: 0.02, start: 0.003, ziel: 0.15, tor5: 0.12, stegAn: 0.3, disq: 0.09, knoten: 0.003 },
    1: { zeit: [75, 79, 88], boje: 0.1, start: 0.003, ziel: 0.02, tor5: 0.05, stegAn: 0.14, disq: 0.04, knoten: 0.003 },
    2: { zeit: [77, 82, 88], boje: 0.03, start: 0.003, ziel: 0.01, tor5: 0.13, stegAn: 0.06, disq: 0.02, knoten: 0.003 },
    3: { zeit: [76, 84, 95], boje: 0.06, start: 0.003, ziel: 0.02, tor5: 0.16, stegAn: 0.03, disq: 0.04, knoten: 0.003 },
    4: { zeit: [73, 77, 83], boje: 0.06, start: 0.003, ziel: 0.06, tor5: 0.08, stegAn: 0.08, disq: 0.09, knoten: 0.003 },
    5: { zeit: [100, 108, 114], boje: 0.01, start: 0.003, ziel: 0.01, tor5: 0.05, stegAn: 0.09, disq: 0.11, knoten: 0.003 },
  },
  fehlerJeStart: { 'katalog:stegAblegen': 0.02, 'katalog:tor5': 0.05, 'katalog:mueb': 0.37 },
  codeHaeufigkeit: { 1: 7, 3: 4, 7: 9, 9: 7, 11: 1, 12: 4, 14: 2, 15: 1, 17: 14, 18: 14, 19: 10, 20: 3, 21: 1 },
  wiederholt: {},
  zweiterCode: 0.2,
  disqOrte: {
    boje: { anteil: 5, buchstaben: { J: 5 } },
    tor5: { anteil: 4, buchstaben: { J: 4 } },
    mueb: { anteil: 3, buchstaben: { Q: 2, J: 1 } },
    steg: { anteil: 0, buchstaben: {} },
    spalte: { anteil: 4, buchstaben: { F: 3, D: 1 } },
  },
  laufStreuung: 2.8,
  patzer: 0.15,
}

/** Der Parallelslalom wird hier noch nicht gewertet; seine Kennzahlen bleiben im Prototyp. */
function kennzahlenFuer(regelwerk: string): Kennzahlen {
  return regelwerk.startsWith('uim') ? WM_MANOEVRIEREN : DM_2026
}

/** Quartile liegen so viele Standardabweichungen vom Median entfernt. */
const QUARTIL_ABSTAND = 0.674
/** Annahme: Abweichung einer Stoppuhr von der gefahrenen Zeit in Sekunden. */
const STOPPUHR_STREUUNG = 0.15
/** Annahme: Anteil der Läufe mit einer dritten Stoppuhr-Zeit. */
const DRITTE_ZEIT = 0.5

function normal(zufall: Zufall): number {
  return Math.sqrt(-2 * Math.log(1 - zufall())) * Math.cos(2 * Math.PI * zufall())
}

function waehle<T>(liste: T[], gewicht: (t: T) => number, zufall: Zufall): T | undefined {
  let rest = zufall() * liste.reduce((s, t) => s + gewicht(t), 0)
  return liste.find((t) => (rest -= gewicht(t)) < 0)
}

/** Die übliche Zeit eines Starters in Sekunden; nach unten und oben verschieden breit gestreut. */
function grundzeit({ zeit: [q1, median, q3] }: Profil, zufall: Zufall): number {
  const z = Math.max(-2, Math.min(2.5, normal(zufall)))
  return median + (z * (z < 0 ? median - q1 : q3 - median)) / QUARTIL_ABSTAND
}

/** Die gefahrene Zeit eines Laufs in Hundertstel. */
function laufzeit(grund: number, k: Kennzahlen, zufall: Zufall): number {
  const patzer = zufall() < k.patzer ? 5 + zufall() * 15 : 0
  return Math.round((grund + normal(zufall) * k.laufStreuung + patzer) * 100)
}

/**
 * Die Lichtschranke schreibt in die elektronische Spalte, die Stoppuhren in die übrigen. Fehlt
 * die passende Spalte, nehmen sie die anderen. Erst die ersten Spalten aller Zeit-Listen
 * („zeit1“, „zeit1~2“, „zeit2“ …).
 */
function zeitWerte(felder: Feld[], zeit: number, zeitnahme: Zeitnahme, zufall: Zufall): Record<string, string> {
  const sortiert = [...felder].sort((a, b) => (a.kennung < b.kennung ? -1 : 1))
  const elektronisch = sortiert.filter((f) => f.geraet === 'elektronisch')
  const stoppuhren = sortiert.filter((f) => f.geraet !== 'elektronisch')
  if (zeitnahme === 'lichtschranke') return { [(elektronisch[0] ?? sortiert[0]).kennung]: formatSeconds(zeit) }
  const anzahl = zufall() < DRITTE_ZEIT ? 3 : 2
  return Object.fromEntries(
    (stoppuhren.length > 0 ? stoppuhren : sortiert)
      .slice(0, anzahl)
      .map((f) => [f.kennung, formatMinutenEingabe(zeit + Math.round(normal(zufall) * STOPPUHR_STREUUNG * 100))]),
  )
}

function fehlerCodes(feld: Feld, k: Kennzahlen, zufall: Zufall): string {
  const haeufig = (code: string) => k.codeHaeufigkeit[code] ?? 0
  const kandidaten = (feld.katalog ?? []).map((e) => e.code).filter((c) => haeufig(c) > 0)
  const erster = waehle(kandidaten, haeufig, zufall)
  if (!erster) return ''
  const zweiter = zufall() < k.zweiterCode ? waehle(kandidaten.filter((c) => c !== erster), haeufig, zufall) : undefined
  return [erster, ...(zweiter ? [zweiter] : [])]
    .map((c) => (zufall() < (k.wiederholt[c] ?? 0) ? `2x${c}` : c))
    .join(', ')
}

/** Die Quote einer Bojen-Zelle; Start, Ziel und Tor 5 können abweichen. */
function bojenQuote(feld: Feld, profil: Profil): number {
  const stelle = feld.kennung.split('|')[0]
  const abweichend = stelle === 'start' ? profil.start : stelle === 'ziel' ? profil.ziel : stelle === 't5' ? profil.tor5 : undefined
  return abweichend ?? profil.boje
}

function ortVon(feld: Feld): Ort | null {
  if (feld.kind === 'buoy') return 'boje'
  if (feld.kind === 'disq') return 'spalte'
  if (feld.kind !== 'code') return null
  if (feld.kennung === 'katalog:tor5') return 'tor5'
  return feld.kennung === 'katalog:mueb' ? 'mueb' : 'steg'
}

/** Zieht Stelle und Buchstabe einer Disqualifikation; nur Buchstaben, die dort erlaubt sind. */
function disqualifikation(felder: Feld[], k: Kennzahlen, zufall: Zufall): { feld: Feld; buchstabe: string } | null {
  const erlaubt = (feld: Feld, ort: Ort) => Object.keys(k.disqOrte[ort].buchstaben).filter((b) => feld.gueltig(b))
  const orte = (Object.keys(k.disqOrte) as Ort[]).flatMap((ort) => {
    const zellen = felder.filter((f) => ortVon(f) === ort && erlaubt(f, ort).length > 0)
    return zellen.length > 0 ? [{ ort, zellen }] : []
  })
  const treffer = waehle(orte, (o) => k.disqOrte[o.ort].anteil, zufall)
  if (!treffer) return null
  const feld = treffer.zellen[Math.floor(zufall() * treffer.zellen.length)]
  const buchstaben = k.disqOrte[treffer.ort].buchstaben
  const buchstabe = waehle(erlaubt(feld, treffer.ort), (b) => buchstaben[b], zufall)
  return buchstabe ? { feld, buchstabe } : null
}

/**
 * Kleiner, schneller Zufallsgenerator (mulberry32) aus einer Saat: gleiche Saat, gleiche Folge.
 * Damit kann eine Action den Zufall mitbringen und der Reducer rein bleiben.
 */
export function zufallAus(saat: number): Zufall {
  let a = saat >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export interface BeispielOptionen {
  zeitnahme: Zeitnahme
  /** Die Läufe, die gefüllt werden; fehlt = alle Läufe der Veranstaltung. */
  laeufe?: readonly number[]
}

/**
 * Ersetzt die Werte aller Listen des Aufbaus in den gewählten Läufen durch Zufallswerte – für
 * jeden Starter, dessen Klasse der Aufbau kennt. Bemerkungen und andere Läufe bleiben. Jede
 * Zeile gilt danach als erfasst. Listen ohne Lauf (Knoten) werden mit dem 1. Lauf gefüllt.
 */
export function beispielEingaben(stand: BeispielStand, konfig: EingabenKonfig, optionen: BeispielOptionen, zufall: Zufall): Eingaben {
  const disziplin = konfig.getAufbau(stand.aufbau).disziplin
  const listen = veranstaltungsListen(konfig, stand)
  const k = kennzahlenFuer(stand.regelwerk)
  const profilVon = (klasse: ClassId): Profil => k.profile[klasse] ?? k.profile[5]!
  const alleLaeufe = Array.from({ length: Math.max(1, stand.laufCount) }, (_, i) => i + 1)
  const laeufe = alleLaeufe.filter((l) => !optionen.laeufe || optionen.laeufe.includes(l))
  const eingaben: Eingaben = { ...stand.eingaben }

  /** Die Felder der Listen einer Klasse in einem Lauf (0 = Listen ohne Lauf); Freitext bleibt außen vor. */
  const felderImLauf = (klasse: ClassId, lauf: number): { felder: Map<string, Feld>; haken: string[] } => {
    const felder = new Map<string, Feld>()
    const haken: string[] = []
    for (const typeId of listen) {
      if (!konfig.positionAllowsClass(typeId, klasse)) continue
      const ohneLauf = listenLauf(konfig.getSheetDef(typeId), 1) === OHNE_LAUF
      if (ohneLauf !== (lauf === OHNE_LAUF)) continue
      haken.push(erfasstKennung(typeId))
      for (const feld of listenFelder(konfig, typeId, klasse)) if (feld.kind !== 'text' && !felder.has(feld.kennung)) felder.set(feld.kennung, feld)
    }
    return { felder, haken }
  }

  const fehlerQuote = (feld: Feld, profil: Profil, lauf: number): number => {
    if (feld.kind === 'buoy') return lauf === OHNE_LAUF ? profil.knoten : bojenQuote(feld, profil)
    return feld.kennung === 'katalog:stegAnlegen' ? profil.stegAn : (k.fehlerJeStart[feld.kennung] ?? 0)
  }

  const zuFuellen = [...(laeufe.includes(1) ? [OHNE_LAUF] : []), ...laeufe]
  for (const klasse of CLASS_IDS) {
    const starter = stand.starters.filter((s) => s.klasse === klasse)
    if (starter.length === 0) continue
    const profil = profilVon(klasse)
    const alleFelder = felderJeKennung(konfig, klasse, listen)
    // Dieselbe Person bleibt über die Läufe ähnlich schnell – auch wenn die Läufe einzeln gefüllt werden.
    const grundzeiten = new Map<string, number>()
    const grundzeitVon = (id: string): number => {
      const bekannt = grundzeiten.get(id)
      if (bekannt !== undefined) return bekannt
      const bisher = alleLaeufe
        .filter((l) => !laeufe.includes(l))
        .flatMap((l) => mittlereZeit(stand.eingaben[laufSchluessel(disziplin, l)]?.[id] ?? {}, alleFelder) ?? [])
      const grund = bisher.length > 0 ? bisher.reduce((a, b) => a + b, 0) / bisher.length / 100 : grundzeit(profil, zufall)
      grundzeiten.set(id, grund)
      return grund
    }

    for (const lauf of zuFuellen) {
      const { felder, haken } = felderImLauf(klasse, lauf)
      if (haken.length === 0) continue
      const schluessel = laufSchluessel(disziplin, lauf)
      const zeitFelder = [...felder.values()].filter((f) => f.kind === 'time')
      const zeilen = { ...eingaben[schluessel] }
      for (const s of starter) {
        const werte = { ...zeilen[s.id] }
        for (const kennung of felder.keys()) delete werte[kennung]

        for (const feld of felder.values()) {
          if (feld.kind !== 'buoy' && feld.kind !== 'code') continue
          if (zufall() >= fehlerQuote(feld, profil, lauf)) continue
          const wert = feld.kind === 'buoy' ? '5' : feld.gueltig(fehlerCodes(feld, k, zufall))
          if (wert) werte[feld.kennung] = wert
        }

        if (zeitFelder.length > 0) Object.assign(werte, zeitWerte(zeitFelder, laufzeit(grundzeitVon(s.id), k, zufall), optionen.zeitnahme, zufall))

        if (lauf !== OHNE_LAUF && zufall() < profil.disq) {
          const treffer = disqualifikation([...felder.values()], k, zufall)
          if (treffer) {
            const { kennung } = treffer.feld
            werte[kennung] = treffer.feld.gueltig(werte[kennung] ? `${werte[kennung]}, ${treffer.buchstabe}` : treffer.buchstabe)
          }
        }
        for (const kennung of haken) werte[kennung] = '1'
        zeilen[s.id] = werte
      }
      eingaben[schluessel] = zeilen
    }
  }
  return eingaben
}
