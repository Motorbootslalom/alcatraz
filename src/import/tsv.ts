import type { PlanState, ClassId, Starter } from '../types'
import { geschlechtKuerzel, parseGeschlecht } from '../domain/geschlecht'
import { uid } from '../domain/ids'
import { CLASS_IDS } from '../domain/classes'
import { normalizeSize } from '../domain/sizes'
import { orderBySize, parseClassNumber, sortedByStartNr, type StartNrPraefixe } from '../domain/startnumbers'
import { naechsteStartNr, vergibKlasse, type StartNrRegeln } from '../domain/startnrBereiche'
import { planEvent } from '../planung/plan'
import { canonicalRunningNumbers } from '../planung/running'
import { originOf } from '../lib/origin'
import { dublettenSchluessel, namensSchluessel } from './starterMerge'
import { excelSeriennummer, liesDatum } from '../lib/datum'

const TAB = '\t'

/** Logische Spalten, die der Import kennt. */
type Field = 'startNr' | 'klasse' | 'nachname' | 'vorname' | 'verein' | 'bundesland' | 'land' | 'geburtsdatum' | 'groesse' | 'geschlecht'

/**
 * Kopfzeilen-Aliasse → logische Spalte. Schlüssel in normalisierter Form (siehe
 * {@link normalizeHeaderCell}): „S-Nr.“, „Start-Nr.“ → `snr`/`startnr`,
 * „Geb. Datum“ → `gebdatum`.
 */
const HEADER_ALIASES: Record<string, Field> = {
  startnummer: 'startNr',
  startnr: 'startNr',
  snr: 'startNr',
  klasse: 'klasse',
  kl: 'klasse',
  class: 'klasse',
  ak: 'klasse',
  nachname: 'nachname',
  name: 'nachname',
  familienname: 'nachname',
  surname: 'nachname',
  lastname: 'nachname',
  vorname: 'vorname',
  firstname: 'vorname',
  verein: 'verein',
  club: 'verein',
  mannschaft: 'verein',
  bundesland: 'bundesland',
  land: 'bundesland',
  region: 'bundesland',
  state: 'bundesland',
  // Eindeutig der Staat; „Land“ allein meint in deutschen Listen meist das Bundesland (siehe `landIstStaat`).
  country: 'land',
  nation: 'land',
  staat: 'land',
  geburtsdatum: 'geburtsdatum',
  geburtstag: 'geburtsdatum',
  geb: 'geburtsdatum',
  gebdatum: 'geburtsdatum',
  birthdate: 'geburtsdatum',
  birthday: 'geburtsdatum',
  größe: 'groesse',
  groesse: 'groesse',
  grösse: 'groesse',
  size: 'groesse',
  shirt: 'groesse',
  shirtgröße: 'groesse',
  // Regel 960, Pkt. 3.7: „Sex“ – freiwillig, nur für die Liste der Fahrer je Team.
  sex: 'geschlecht',
  gender: 'geschlecht',
  geschlecht: 'geschlecht',
}

/** Feste Spaltenreihenfolge, wenn keine Kopfzeile erkannt wird. */
const FIXED_ORDER: Field[] = [
  'startNr',
  'klasse',
  'nachname',
  'vorname',
  'verein',
  'bundesland',
  'geburtsdatum',
  'groesse',
]

/** Kleinschreibung ohne Leerzeichen, Punkte, Binde- und Unterstriche. */
function normalizeHeaderCell(cell: string): string {
  return cell.trim().toLowerCase().replace(/[\s._-]+/g, '')
}

/** Prüft, ob eine Zeile als Kopfzeile taugt (mind. zwei bekannte Spaltennamen). */
function detectHeader(cells: string[], landIstStaat = false): Field[] | null {
  const mapped = cells.map((c) => {
    const kopf = normalizeHeaderCell(c)
    return landIstStaat && kopf === 'land' ? 'land' : HEADER_ALIASES[kopf]
  })
  const known = mapped.filter(Boolean).length
  return known >= 2 ? mapped.map((f) => f ?? ('' as Field)) : null
}

/** Klasse aus Freitext normalisieren (E/Dolphin/D → 'E', Ziffern 1–7). */
function parseKlasse(raw: string): ClassId | null {
  const s = raw.trim().toUpperCase()
  if (s === 'E' || s === 'D' || s === 'DOLPHIN') return 'E'
  if ((CLASS_IDS as string[]).includes(s)) return s as ClassId
  return null
}

/** Geschlecht aus einer Datei: M, F, D, nA in gängigen Schreibweisen (domain/geschlecht.ts). */
export { parseGeschlecht }

/**
 * Geburtsdatum in ISO (JJJJ-MM-TT) – dieselben Schreibweisen wie das Datumsfeld der Oberfläche
 * (lib/datum.ts): JJJJ-MM-TT, TT.MM.JJJJ, TT/MM/JJJJ. Ein Schrägstrich heißt IMMER Tag zuerst,
 * nie Monat/Tag (Entscheidung des Nutzers vom 15.11.2026) – 12/01/2019 ist der 12. Januar.
 * Dazu, nur hier: ein reines Jahr (→ 1. Januar), eine angehängte Uhrzeit (manche Programme
 * kopieren „01.12.2019 00:00:00“) und eine Excel-Seriennummer (fünfstellig, Zelle als Zahl
 * formatiert). `null`: nicht lesbar – das Feld bleibt leer, die Vorschau nennt den Wert.
 */
function parseGeburtsdatum(raw: string): string | null {
  const s = raw.trim().replace(/\s+\d{1,2}:\d{2}(:\d{2})?$/, '')
  if (!s) return ''
  const gelesen = liesDatum(s)
  if (gelesen.art === 'ok') return gelesen.iso
  if (/^\d{4}$/.test(s)) return `${s}-01-01`
  if (/^\d{5}$/.test(s)) return excelSeriennummer(Number(s))
  return null
}

export interface ImportSkip {
  line: number
  raw: string
  /** Grund als Schlüssel – die Oberfläche übersetzt ihn (import.skip.*). */
  reason: 'unknownClass' | 'noName'
  /** Der beanstandete Wert, z. B. die unbekannte Klasse. */
  value: string
}

export interface ImportResult {
  starters: Starter[]
  usedHeader: boolean
  imported: number
  /** Starter ohne Startnummer in der Quelle, deren Nummer der Import ergänzt hat. */
  assignedNumbers: number
  skipped: ImportSkip[]
  /**
   * Angaben in der Spalte Geschlecht, die der Import nicht kennt (etwa „X“ oder „?“): Die Zeile
   * wird übernommen, das Feld bleibt leer – die Oberfläche sagt es, sonst fiele es erst auf der
   * Liste nach Pkt. 3.7 auf. Je Wert einmal, in der Folge des ersten Auftretens.
   */
  geschlechtUnbekannt: { anzahl: number; werte: string[] }
  /**
   * Geburtsdaten, die sich nicht lesen lassen (31.02.2019, „Mai 2019“): Die Zeilen kommen herein,
   * das Feld bleibt leer – wie beim Geschlecht. Je Wert einmal, in der Folge des ersten Auftretens.
   */
  datumUnlesbar: { anzahl: number; werte: string[] }
  /**
   * Klassenbasierte Nummern aus der Liste, die wegfielen, weil die Zeile in einer anderen Klasse
   * übernommen wird (`klasseJeZeile`) – dort bekommt der Starter eine neue. Sie zählen nicht als
   * „ohne Startnummer“: Erkannt war die Nummer ja (Prüfbefund zu Paket F, 16.11.2026; vorher hieß
   * es „keine Startnummern erkannt“). Je Wert einmal, in der Folge des ersten Auftretens.
   */
  nummerEntfallen: { anzahl: number; werte: string[] }
  /** IDs der Starter, deren Nummer erst der Import vergab – für `IMPORT_STARTERS` (zählt nicht zum Wiedererkennen). */
  nummerVomImport: string[]
  /** Starter ohne Nummer in der Quelle, die beim Ersetzen ihre bisherige behalten (`bisherige`). */
  nummerBehalten: number
  /** Je Starter (gleicher Index wie `starters`) die Zeile der Quelle – für die Klassenprüfung der Vorschau. */
  zeilen: number[]
}

/**
 * Parst eine aus Excel kopierte TSV-Teilnehmerliste. Erkennt eine Kopfzeile
 * automatisch (Spaltenreihenfolge dann egal); fehlt sie, gilt die feste
 * Reihenfolge {@link FIXED_ORDER}. Zeilen ohne gültige Klasse/Namen werden
 * übersprungen und in `skipped` gemeldet. Vorhandene Startnummern werden
 * unverändert übernommen; nur fehlende werden ergänzt.
 */
/**
 * `landIstStaat`: Die Herkunft der Veranstaltung ist „Land“ – dann meint eine Spalte „Land“
 * den Staat und nicht, wie sonst in deutschen Listen, das Bundesland.
 *
 * `vorhandene`: die Starter, zu denen die Liste hinzukommt („Ergänzen“). Fehlende Nummern
 * schließen dann an die höchste Nummer der Klasse an, statt sie ein zweites Mal zu vergeben;
 * wer als Dublette übergangen wird, bekommt keine. Beim Ersetzen bleibt es leer – die Liste
 * gilt als Ganzes.
 *
 * `bisherige`: die Starter, die die Liste ersetzt („Liste ersetzen“). Wer ohne Nummer kommt und an
 * Klasse und Namen wiedererkannt wird (wie in import/starterMerge.ts), behält seine bisherige Nummer,
 * sofern die Liste sie nicht selbst vergibt; erst die übrigen bekommen neue (Entscheidung 16.11.2026).
 *
 * `klasseJeZeile`: Zeilen (wie in `zeilen`), deren Starter in einer anderen Klasse als in der
 * Liste übernommen werden – der Vorschlag der Klassenprüfung, wenn der Jahrgang in eine andere
 * Klasse gehört (Entscheidung des Nutzers vom 15.11.2026). Eine klassenbasierte Nummer der
 * bisherigen Klasse fällt dann weg und wird in der neuen ergänzt (`assignMissing`).
 *
 * `ohneZeilen`: Zeilen (wie in `zeilen`), die bewusst nicht übernommen werden – Starter, deren
 * Jahrgang in keine Klasse des Regelwerks passt („Alle beheben“, Entscheidung des Nutzers vom
 * 16.11.2026). Sie zählen nicht als übersprungen: Die Oberfläche nennt sie eigens.
 */
export function parseStartersTsv(
  text: string,
  options: {
    assignMissing?: boolean
    landIstStaat?: boolean
    startNrPraefix?: StartNrPraefixe
    /** Startnummern-Bereiche und fehlende Westen je Klasse (19.11.2026, config/catalog.ts startNrRegeln); fehlt = fortlaufend. */
    startNrRegeln?: (klasse: ClassId) => StartNrRegeln
    vorhandene?: readonly Starter[]
    bisherige?: readonly Starter[]
    klasseJeZeile?: Readonly<Record<number, ClassId>>
    ohneZeilen?: readonly number[]
  } = {},
): ImportResult {
  const lines = text
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .filter((l) => l.trim() !== '')

  const skipped: ImportSkip[] = []
  const geschlechtUnbekannt = { anzahl: 0, werte: [] as string[] }
  const datumUnlesbar = { anzahl: 0, werte: [] as string[] }
  const nummerEntfallen = { anzahl: 0, werte: [] as string[] }
  const zeilen: number[] = []
  if (lines.length === 0) {
    return { starters: [], usedHeader: false, imported: 0, assignedNumbers: 0, skipped, geschlechtUnbekannt, datumUnlesbar, nummerEntfallen, nummerVomImport: [], nummerBehalten: 0, zeilen }
  }

  const firstCells = lines[0].split(TAB)
  const header = detectHeader(firstCells, options.landIstStaat)
  const usedHeader = header !== null
  const fields = header ?? FIXED_ORDER
  const dataLines = usedHeader ? lines.slice(1) : lines

  const starters: Starter[] = []
  dataLines.forEach((line, idx) => {
    const lineNo = (usedHeader ? idx + 2 : idx + 1)
    if (options.ohneZeilen?.includes(lineNo)) return
    const cells = line.split(TAB)
    const get = (f: Field): string => {
      const i = fields.indexOf(f)
      return i >= 0 && i < cells.length ? cells[i].trim() : ''
    }

    const gelistet = parseKlasse(get('klasse'))
    if (!gelistet) {
      skipped.push({ line: lineNo, raw: line, reason: 'unknownClass', value: get('klasse') })
      return
    }
    const klasse = options.klasseJeZeile?.[lineNo] ?? gelistet
    // In eine andere Klasse übernommen: Eine Nummer der gelisteten Klasse passt dort nicht mehr.
    const alteNummer = klasse !== gelistet && options.assignMissing !== false && parseClassNumber(get('startNr'), gelistet, options.startNrPraefix) !== null
    const nachname = get('nachname')
    const vorname = get('vorname')
    if (!nachname && !vorname) {
      skipped.push({ line: lineNo, raw: line, reason: 'noName', value: '' })
      return
    }

    const geschlecht = parseGeschlecht(get('geschlecht'))
    if (geschlecht === undefined && get('geschlecht') !== '') {
      geschlechtUnbekannt.anzahl++
      if (!geschlechtUnbekannt.werte.includes(get('geschlecht'))) geschlechtUnbekannt.werte.push(get('geschlecht'))
    }
    const geburtsdatum = parseGeburtsdatum(get('geburtsdatum'))
    if (geburtsdatum === null) {
      datumUnlesbar.anzahl++
      if (!datumUnlesbar.werte.includes(get('geburtsdatum'))) datumUnlesbar.werte.push(get('geburtsdatum'))
    }
    if (alteNummer) {
      nummerEntfallen.anzahl++
      if (!nummerEntfallen.werte.includes(get('startNr').trim())) nummerEntfallen.werte.push(get('startNr').trim())
    }
    zeilen.push(lineNo)
    starters.push({
      id: uid('st'),
      startNr: alteNummer ? '' : get('startNr').trim(),
      vorname,
      nachname,
      verein: get('verein'),
      bundesland: get('bundesland'),
      ...(get('land') ? { land: get('land') } : {}),
      geburtsdatum: geburtsdatum ?? '',
      klasse,
      groesse: normalizeSize(get('groesse')),
      ...(geschlecht ? { geschlecht } : {}),
    })
  })

  // Klassenbasierte Nummern lassen sich ergänzen; klassische vergibt die Verzahnung.
  const ergaenzen = options.assignMissing ?? true
  const nummerBehalten = ergaenzen && options.bisherige ? bisherigeNummern(starters, options.bisherige) : 0
  const vergeben = ergaenzen ? fillMissingStartNumbers(starters, (k) => options.startNrRegeln?.(k) ?? { bereiche: [], fehlend: [], praefixe: options.startNrPraefix }, options.vorhandene) : []

  return {
    starters,
    usedHeader,
    imported: starters.length,
    assignedNumbers: vergeben.length,
    skipped,
    geschlechtUnbekannt,
    datumUnlesbar,
    nummerEntfallen,
    nummerVomImport: vergeben.map((p) => p.id),
    nummerBehalten,
    zeilen,
  }
}

/**
 * Beim Ersetzen: Starter ohne Nummer, die an Klasse und Namen einem bisherigen entsprechen, bekommen
 * dessen Nummer – außer die Liste vergibt sie selbst schon oder ein anderer hat sie eben bekommen.
 * Liefert, wie viele so ihre Nummer behielten.
 */
function bisherigeNummern(starters: Starter[], bisherige: readonly Starter[]): number {
  const nrKey = (p: Pick<Starter, 'klasse' | 'startNr'>) => `${p.klasse}|${p.startNr.trim().toUpperCase()}`
  const belegt = new Set(starters.filter((p) => p.startNr.trim()).map(nrKey))
  const nachName = new Map<string, Starter>()
  for (const p of bisherige) if (p.startNr.trim() && !nachName.has(namensSchluessel(p))) nachName.set(namensSchluessel(p), p)
  let behalten = 0
  for (const p of starters) {
    if (p.startNr !== '') continue
    const alt = nachName.get(namensSchluessel(p))
    if (!alt || belegt.has(nrKey(alt))) continue
    p.startNr = alt.startNr.trim()
    belegt.add(nrKey(alt))
    nachName.delete(namensSchluessel(p))
    behalten++
  }
  return behalten
}

/**
 * Ergänzt **leere** klassenbasierte Startnummern und liefert deren Anzahl.
 * Vorhandene Nummern bleiben unverändert – auch mit Lücken oder in anderem
 * Schema (z. B. 7, 12), denn sie stehen so auf Startlisten und Fehlerpunktbögen.
 * Fehlt in einer Klasse jede Nummer, wird nach Größe durchnummeriert; fehlen nur
 * einzelne, werden sie hinten angehängt (höchste Nummer + 1). Beim „Ergänzen“
 * zählen die Starter der Veranstaltung mit (`vorhandene`): Hat die Klasse dort schon
 * Starter, fehlen aus ihrer Sicht nur einzelne Nummern. Liefert die Starter, die eine bekamen.
 */
function fillMissingStartNumbers(starters: Starter[], regelnFuer: (klasse: ClassId) => StartNrRegeln, vorhandene: readonly Starter[] = []): Starter[] {
  const uebergangen = new Set(vorhandene.map(dublettenSchluessel))
  const assigned: Starter[] = []
  for (const klasse of CLASS_IDS) {
    const inClass = starters.filter((p) => p.klasse === klasse)
    const bisher = vorhandene.filter((p) => p.klasse === klasse)
    const missing = inClass.filter((p) => p.startNr === '' && !uebergangen.has(dublettenSchluessel(p)))
    if (missing.length === 0) continue
    assigned.push(...missing)
    if (bisher.length === 0 && missing.length === inClass.length) {
      // Ganze Klasse ohne Nummern → nach Größe vergeben; mit Startnummern-Bereichen aus dem Bereich
      // jeder Größe, fehlende Westen übersprungen (domain/startnrBereiche.ts, 19.11.2026).
      const geordnet = orderBySize(inClass)
      const neu = vergibKlasse(geordnet, klasse, regelnFuer(klasse))
      geordnet.forEach((p, i) => {
        p.startNr = neu[i].startNr
      })
    } else {
      // Einzelne fehlen: je Starter die nächste freie (mit Bereichen aus dem seiner Größe), in Eingangsfolge.
      for (const p of missing) p.startNr = naechsteStartNr([...bisher, ...inClass], klasse, p.groesse, regelnFuer(klasse))
    }
  }
  return assigned
}

/**
 * Wie die Startnummern übernommen wurden – als Schlüssel für die Import-Vorschau
 * (die Oberfläche übersetzt: import.numbers.*).
 */
/** `kept`: keine Nummer neu vergeben, aber Starter ohne Nummer behielten beim Ersetzen ihre bisherige. */
export type StartNrImportNote = 'none' | 'unchanged' | 'kept' | 'allAssigned' | 'someAssigned'

export function startNrImportNote(res: ImportResult): StartNrImportNote {
  if (res.imported === 0) return 'none'
  const ergaenzt = ergaenzteNummern(res)
  if (ergaenzt === 0) return res.nummerBehalten > 0 ? 'kept' : 'unchanged'
  return ergaenzt === res.imported ? 'allAssigned' : 'someAssigned'
}

/**
 * Wie viele Starter ohne Nummer in der Liste standen und eine bekamen – ohne die, deren Nummer nur
 * wegen einer anderen Klasse wegfiel (`nummerEntfallen`; die Oberfläche nennt sie eigens).
 */
export function ergaenzteNummern(res: ImportResult): number {
  return Math.max(0, res.assignedNumbers - res.nummerEntfallen.anzahl)
}

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------

function formatGeburtsdatum(iso: string): string {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  return m ? `${m[3]}.${m[2]}.${m[1]}` : iso
}

function tsvRow(cells: (string | number)[]): string {
  return cells.map((c) => String(c).replace(/[\t\n\r]/g, ' ')).join(TAB)
}

/**
 * Teilnehmerliste als TSV (eine Zeile je Starter, nach Klasse und Startnummer
 * sortiert). Enthält die klassische Nummer, falls aktiviert. Round-trip-fähig:
 * lässt sich unverändert wieder importieren.
 *
 * Das Geschlecht steht in der Sprache der Oberfläche (`sprache`): deutsch M, W, D, k. A., englisch
 * M, F, D, n/a – wie im Starter-Reiter (Entscheidung 16.11.2026). Der Import liest beide Schreibweisen.
 */
export function formatStartersTsv(state: PlanState, sprache: 'de' | 'en' = 'de'): string {
  const running = canonicalRunningNumbers(state)
  // Die freiwilligen Spalten stehen nur da, wenn sie jemand gefüllt hat – sonst bleibt die Datei, wie sie war.
  // Der Staat heißt „Staat“, nicht „Land“: „Land“ läse der Import sonst als Bundesland (siehe `landIstStaat`).
  const mitStaat = state.starters.some((p) => !!p.land)
  const mitGeschlecht = state.starters.some((p) => p.geschlecht !== undefined)
  const header = tsvRow([
    'Startnummer',
    'Nr',
    'Klasse',
    'Nachname',
    'Vorname',
    'Verein',
    'Bundesland',
    ...(mitStaat ? ['Staat'] : []),
    'Geburtsdatum',
    'Größe',
    ...(mitGeschlecht ? ['Geschlecht'] : []),
  ])
  const rows: string[] = []
  for (const klasse of CLASS_IDS) {
    const inClass = sortedByStartNr(state.starters.filter((p) => p.klasse === klasse))
    for (const p of inClass) {
      rows.push(
        tsvRow([
          p.startNr,
          running?.get(p.id) ?? '',
          p.klasse,
          p.nachname,
          p.vorname,
          p.verein,
          p.bundesland,
          ...(mitStaat ? [p.land ?? ''] : []),
          formatGeburtsdatum(p.geburtsdatum),
          p.groesse,
          ...(mitGeschlecht ? [p.geschlecht ? geschlechtKuerzel(p.geschlecht, sprache) : ''] : []),
        ]),
      )
    }
  }
  return [header, ...rows].join('\n')
}

/**
 * Verzahnte Startliste als TSV: eine Zeile pro Start in der Reihenfolge der
 * Manövrier-Verzahnung über alle Parcours. Direkt als Startliste in Excel nutzbar.
 */
export function formatStartlistTsv(state: PlanState): string {
  const plan = planEvent(state)
  const byId = new Map(plan.plans.map((p) => [p.parcoursId, p]))
  const running = canonicalRunningNumbers(state)
  const header = tsvRow([
    'Pos',
    'Nr',
    'Startnummer',
    'Parcours',
    'Klasse',
    'Nachname',
    'Vorname',
    state.originMode === 'bundesland' ? 'Bundesland' : state.originMode === 'land' ? 'Land' : 'Verein',
    'Größe',
  ])
  const rows: string[] = []
  let pos = 0
  for (const parcours of state.parcoursList) {
    const seq = byId.get(parcours.id)?.sequence ?? []
    for (const p of seq) {
      pos++
      rows.push(
        tsvRow([
          pos,
          running?.get(p.id) ?? '',
          p.startNr,
          parcours.name,
          p.klasse,
          p.nachname,
          p.vorname,
          state.originMode === 'none' ? p.verein || p.bundesland : originOf(p, state.originMode),
          p.groesse,
        ]),
      )
    }
  }
  return [header, ...rows].join('\n')
}
