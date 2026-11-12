import type { PlanState, ClassId, Starter } from '../types'
import { uid } from '../domain/ids'
import { CLASS_IDS } from '../domain/classes'
import { normalizeSize } from '../domain/sizes'
import { makeStartNr, orderBySize, parseClassNumber, sortedByStartNr } from '../domain/startnumbers'
import { planEvent } from '../planung/plan'
import { canonicalRunningNumbers } from '../planung/running'

const TAB = '\t'

/** Logische Spalten, die der Import kennt. */
type Field = 'startNr' | 'klasse' | 'nachname' | 'vorname' | 'verein' | 'bundesland' | 'geburtsdatum' | 'groesse'

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
function detectHeader(cells: string[]): Field[] | null {
  const mapped = cells.map((c) => HEADER_ALIASES[normalizeHeaderCell(c)])
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

/** Geburtsdatum in ISO (YYYY-MM-DD) normalisieren; toleriert TT.MM.JJJJ und reine Jahre. */
function parseGeburtsdatum(raw: string): string {
  const s = raw.trim()
  if (!s) return ''
  // ISO bereits vorhanden
  const iso = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/)
  if (iso) return `${iso[1]}-${iso[2].padStart(2, '0')}-${iso[3].padStart(2, '0')}`
  // Deutsch: TT.MM.JJJJ (auch T.M.JJJJ)
  const de = s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/)
  if (de) return `${de[3]}-${de[2].padStart(2, '0')}-${de[1].padStart(2, '0')}`
  // Nur Jahr
  const yr = s.match(/^(\d{4})$/)
  if (yr) return `${yr[1]}-01-01`
  return s
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
}

/**
 * Parst eine aus Excel kopierte TSV-Teilnehmerliste. Erkennt eine Kopfzeile
 * automatisch (Spaltenreihenfolge dann egal); fehlt sie, gilt die feste
 * Reihenfolge {@link FIXED_ORDER}. Zeilen ohne gültige Klasse/Namen werden
 * übersprungen und in `skipped` gemeldet. Vorhandene Startnummern werden
 * unverändert übernommen; nur fehlende werden ergänzt.
 */
export function parseStartersTsv(text: string, options: { assignMissing?: boolean } = {}): ImportResult {
  const lines = text
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .filter((l) => l.trim() !== '')

  const skipped: ImportSkip[] = []
  if (lines.length === 0) {
    return { starters: [], usedHeader: false, imported: 0, assignedNumbers: 0, skipped }
  }

  const firstCells = lines[0].split(TAB)
  const header = detectHeader(firstCells)
  const usedHeader = header !== null
  const fields = header ?? FIXED_ORDER
  const dataLines = usedHeader ? lines.slice(1) : lines

  const starters: Starter[] = []
  dataLines.forEach((line, idx) => {
    const lineNo = (usedHeader ? idx + 2 : idx + 1)
    const cells = line.split(TAB)
    const get = (f: Field): string => {
      const i = fields.indexOf(f)
      return i >= 0 && i < cells.length ? cells[i].trim() : ''
    }

    const klasse = parseKlasse(get('klasse'))
    if (!klasse) {
      skipped.push({ line: lineNo, raw: line, reason: 'unknownClass', value: get('klasse') })
      return
    }
    const nachname = get('nachname')
    const vorname = get('vorname')
    if (!nachname && !vorname) {
      skipped.push({ line: lineNo, raw: line, reason: 'noName', value: '' })
      return
    }

    starters.push({
      id: uid('st'),
      startNr: get('startNr').trim(),
      vorname,
      nachname,
      verein: get('verein'),
      bundesland: get('bundesland'),
      geburtsdatum: parseGeburtsdatum(get('geburtsdatum')),
      klasse,
      groesse: normalizeSize(get('groesse')),
    })
  })

  // Klassenbasierte Nummern lassen sich ergänzen; klassische vergibt die Verzahnung.
  const assignedNumbers = (options.assignMissing ?? true) ? fillMissingStartNumbers(starters) : 0

  return { starters, usedHeader, imported: starters.length, assignedNumbers, skipped }
}

/**
 * Ergänzt **leere** klassenbasierte Startnummern und liefert deren Anzahl.
 * Vorhandene Nummern bleiben unverändert – auch mit Lücken oder in anderem
 * Schema (z. B. 7, 12), denn sie stehen so auf Startlisten und Fehlerpunktbögen.
 * Fehlt in einer Klasse jede Nummer, wird nach Größe durchnummeriert; fehlen nur
 * einzelne, werden sie hinten angehängt (höchste Nummer + 1).
 */
function fillMissingStartNumbers(starters: Starter[]): number {
  let assigned = 0
  for (const klasse of CLASS_IDS) {
    const inClass = starters.filter((p) => p.klasse === klasse)
    const missing = inClass.filter((p) => p.startNr === '')
    if (missing.length === 0) continue
    assigned += missing.length
    if (missing.length === inClass.length) {
      // Ganze Klasse ohne Nummern → nach Größe vergeben.
      orderBySize(inClass).forEach((p, i) => {
        p.startNr = makeStartNr(klasse, i + 1)
      })
    } else {
      let max = 0
      for (const p of inClass) max = Math.max(max, parseClassNumber(p.startNr, klasse) ?? 0)
      for (const p of missing) p.startNr = makeStartNr(klasse, ++max)
    }
  }
  return assigned
}

/**
 * Wie die Startnummern übernommen wurden – als Schlüssel für die Import-Vorschau
 * (die Oberfläche übersetzt: import.numbers.*).
 */
export type StartNrImportNote = 'none' | 'unchanged' | 'allAssigned' | 'someAssigned'

export function startNrImportNote(res: ImportResult): StartNrImportNote {
  if (res.imported === 0) return 'none'
  if (res.assignedNumbers === 0) return 'unchanged'
  return res.assignedNumbers === res.imported ? 'allAssigned' : 'someAssigned'
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
 */
export function formatStartersTsv(state: PlanState): string {
  const running = canonicalRunningNumbers(state)
  const header = tsvRow([
    'Startnummer',
    'Nr',
    'Klasse',
    'Nachname',
    'Vorname',
    'Verein',
    'Bundesland',
    'Geburtsdatum',
    'Größe',
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
          formatGeburtsdatum(p.geburtsdatum),
          p.groesse,
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
    state.originMode === 'bundesland' ? 'Bundesland' : 'Verein',
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
          state.originMode === 'bundesland' ? p.bundesland : p.verein || p.bundesland,
          p.groesse,
        ]),
      )
    }
  }
  return [header, ...rows].join('\n')
}
