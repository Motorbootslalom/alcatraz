import { describe, expect, it } from 'vitest'
import { emptyState, reducer } from '../state/reducer'
import { migrate } from '../state/migrate'
import { makeFile, parseFile } from '../persistenz/backup'
import { mergeStarters } from '../import/starterMerge'
import { formatStartersTsv, parseGeschlecht, parseStartersTsv } from '../import/tsv'
import { beispielHerkuenfte, generateStarters } from '../domain/generate'
import { teamListen } from './teamListe'
import type { AppState, ClassId, Starter } from '../types'

// Die Liste der Fahrer je Team (Regel 960, Pkt. 3.7) und das freiwillige Starterfeld
// „Geschlecht“. Alle Starter sind erfunden.

const mk = (id: string, klasse: ClassId, land: string, mehr: Partial<Starter> = {}): Starter => ({
  id,
  startNr: `${klasse === 'E' ? 'E' : klasse}0${id.slice(-1)}`,
  vorname: `Vor${id}`,
  nachname: `Nach${id}`,
  verein: '',
  bundesland: '',
  land,
  geburtsdatum: '2015-03-04',
  groesse: '',
  klasse,
  ...mehr,
})
const stand = (): AppState => ({
  ...emptyState(),
  regelwerk: 'uim-2026',
  originMode: 'land',
  coPiloten: { E: 'Erika Beispiel' },
  starters: [mk('a2', '4', 'Estland', { gewicht: 70, geschlecht: 'M' }), mk('a1', 'E', 'Estland', { gewicht: 20, geschlecht: 'F' }), mk('b1', '1', 'Lettland')],
})

describe('Liste der Fahrer je Team (Regel 960, Pkt. 3.7)', () => {
  it('je Team ein Dokument nach Startnummer – mit Ballast und, wo vorgesehen, dem Co-Driver', () => {
    const listen = teamListen(stand())
    expect(listen.map((l) => [l.name, l.zeilen.map((z) => z.starter.id)])).toEqual([
      ['Estland', ['a1', 'a2']],
      ['Lettland', ['b1']],
    ])
    const [dolphin, vier] = listen[0].zeilen
    // Dolphin: 26 kg Durchschnitt, gewogen 20 → 6 kg Ballast; Co-Driver aus der Besetzung.
    expect([dolphin.ausgleich, dolphin.coDriver, dolphin.starter.geschlecht]).toEqual([6, 'Erika Beispiel', 'F'])
    // Klasse 4: schwerer als der Durchschnitt (64 kg) → kein Ballast; ohne Co-Driver.
    expect([vier.ausgleich, vier.coDriver]).toEqual([null, undefined])
    // Nicht gewogen ist nicht „kein Ballast“; Klasse 1 hat ein (noch leeres) Feld für den Co-Driver.
    expect([listen[1].zeilen[0].ausgleich, listen[1].zeilen[0].coDriver, listen[1].ungewogen]).toEqual([undefined, '', 1])
    // Ein Team allein; ohne Herkunft gibt es keine Liste.
    expect(teamListen(stand(), listen[1].schluessel).map((l) => l.name)).toEqual(['Lettland'])
    expect(teamListen({ ...stand(), originMode: 'none' })).toEqual([])
  })
})

describe('Geschlecht: freiwilliges Starterfeld', () => {
  it('Import: Spalte sex/gender mit vier Werten M, F, D, nA in gängigen Schreibweisen, leer erlaubt, Unbekanntes gilt als leer', () => {
    expect(['m', 'male', 'Männlich', 'maennlich'].map(parseGeschlecht)).toEqual(['M', 'M', 'M', 'M'])
    expect(['F', 'female', 'w', 'Weiblich'].map(parseGeschlecht)).toEqual(['F', 'F', 'F', 'F'])
    expect(['d', 'Diverse', 'divers'].map(parseGeschlecht)).toEqual(['D', 'D', 'D'])
    expect(['na', 'nA', 'N/A', 'n/a', 'keine Angabe', 'Keine  Angabe'].map(parseGeschlecht)).toEqual(['nA', 'nA', 'nA', 'nA', 'nA', 'nA'])
    expect(['', 'x', '?'].map(parseGeschlecht)).toEqual([undefined, undefined, undefined])
    const res = parseStartersTsv(['Klasse\tName\tVorname\tSex', '1\tMuster\tMia\tF', '1\tBeispiel\tBen\t', '1\tProbe\tPia\t?'].join('\n'))
    expect(res.starters.map((p) => p.geschlecht)).toEqual(['F', undefined, undefined])
    expect(res.skipped).toEqual([])
    // Nicht Erkanntes wird gemeldet (je Wert einmal), Leeres nicht.
    expect(res.geschlechtUnbekannt).toEqual({ anzahl: 1, werte: ['?'] })
    expect(parseStartersTsv(['Klasse\tName\tVorname\tSex', '1\tA\tB\tX', '1\tC\tD\tX', '1\tE\tF\tunbekannt', '1\tG\tH\tD'].join('\n')).geschlechtUnbekannt).toEqual({ anzahl: 3, werte: ['X', 'unbekannt'] })
    expect(parseStartersTsv('Klasse\tName\tVorname\tGender\n2\tMuster\tMax\tm').starters[0].geschlecht).toBe('M')
  })

  it('Export und Import: die vier Werte kommen so zurück, wie sie hinausgingen', () => {
    const vier = (['M', 'F', 'D', 'nA'] as const).map((g, i) => mk(`g${i}`, '1', 'Estland', { geschlecht: g }))
    const tsv = formatStartersTsv({ ...stand(), starters: vier })
    expect(parseStartersTsv(tsv).starters.map((p) => p.geschlecht)).toEqual(['M', 'F', 'D', 'nA'])
  })

  it('eine Liste ohne die Spalte löscht die Angabe nicht; der Export nennt sie nur, wenn es sie gibt', () => {
    const alt = [mk('a1', '1', 'Estland', { geschlecht: 'F' })]
    const { geschlecht: _g, id: _id, ...ohne } = alt[0]
    expect(mergeStarters(alt, [{ ...ohne, id: 'neu' }]).starters[0]).toMatchObject({ id: 'a1', geschlecht: 'F' })
    expect(mergeStarters(alt, [{ ...ohne, id: 'neu', geschlecht: 'M' }]).changed[0].geschlecht).toBe('M')
    expect(formatStartersTsv({ ...stand(), starters: alt }).split('\n')[0].endsWith('\tGeschlecht')).toBe(true)
    expect(formatStartersTsv({ ...stand(), starters: [ohne as Starter] })).not.toContain('Geschlecht')
  })

  it('steht in Sicherung und Teilnehmerdaten; die Vorlage trägt keine Starter; migrate() verwirft Unbekanntes', () => {
    const s = stand()
    for (const art of ['sicherung', 'starter'] as const) {
      const gelesen = parseFile(JSON.stringify(makeFile(art, s, '2026-11-15T10:00:00.000Z')))
      const starters = gelesen.ok && gelesen.kind === 'sicherung' ? gelesen.state.starters : gelesen.ok && gelesen.kind === 'starter' ? gelesen.starters : []
      expect(starters.map((p) => p.geschlecht)).toEqual(['M', 'F', undefined])
    }
    expect(JSON.stringify(makeFile('vorlage', s, '2026-11-15T10:00:00.000Z'))).not.toContain('geschlecht')
    const kaputt = migrate({ ...s, starters: [{ ...s.starters[0], geschlecht: 'divers' }, { ...s.starters[1], geschlecht: 1 }] })!
    expect(kaputt.starters.map((p) => 'geschlecht' in p)).toEqual([false, false])
    // D und nA bleiben – auch über Sicherung und Teilnehmerdaten.
    const vier = { ...s, starters: [{ ...s.starters[0], geschlecht: 'D' as const }, { ...s.starters[1], geschlecht: 'nA' as const }] }
    expect(migrate(vier)!.starters.map((p) => p.geschlecht)).toEqual(['D', 'nA'])
    const gelesen = parseFile(JSON.stringify(makeFile('starter', vier, '2026-11-15T10:00:00.000Z')))
    expect(gelesen.ok && gelesen.kind === 'starter' ? gelesen.starters.map((p) => p.geschlecht) : []).toEqual(['D', 'nA'])
  })

  it('von Hand: setzen und wieder leeren – „nicht erfasst“ steht nicht im Stand, „keine Angabe“ schon', () => {
    const gesetzt = reducer(stand(), { type: 'UPDATE_STARTER', id: 'b1', patch: { geschlecht: 'F' } })
    expect(gesetzt.starters.find((p) => p.id === 'b1')!.geschlecht).toBe('F')
    expect(reducer(stand(), { type: 'UPDATE_STARTER', id: 'b1', patch: { geschlecht: 'nA' } }).starters.find((p) => p.id === 'b1')!.geschlecht).toBe('nA')
    expect(reducer(stand(), { type: 'UPDATE_STARTER', id: 'b1', patch: { geschlecht: 'D' } }).starters.find((p) => p.id === 'b1')!.geschlecht).toBe('D')
    const leer = reducer(gesetzt, { type: 'UPDATE_STARTER', id: 'b1', patch: { geschlecht: undefined } })
    expect('geschlecht' in leer.starters.find((p) => p.id === 'b1')!).toBe(false)
  })
})

describe('Beispiel-Starterfeld: begrenzte Zahl der Herkünfte', () => {
  it('die Starter verteilen sich reihum auf genau so viele Nationen bzw. Vereine – über alle Klassen', () => {
    const drei = beispielHerkuenfte('land', 3)
    expect(new Set(drei.map((h) => h.land)).size).toBe(3)
    let alle: Starter[] = []
    for (const k of ['E', '1', '2'] as ClassId[]) alle = alle.concat(generateStarters(k, 4, 2026, 'land', alle, undefined, drei))
    const jeLand = new Map<string, number>()
    for (const p of alle) jeLand.set(p.land!, (jeLand.get(p.land!) ?? 0) + 1)
    expect([...jeLand.values()]).toEqual([4, 4, 4])
    const vereine = beispielHerkuenfte('verein', 2)
    expect(new Set(generateStarters('3', 9, 2026, 'verein', [], undefined, vereine).map((p) => p.verein)).size).toBe(2)
    // Mehr, als es gibt, sind alle; ohne Angabe wird gewürfelt wie bisher.
    expect(beispielHerkuenfte('land', 999).length).toBeGreaterThan(5)
    expect(generateStarters('3', 1, 2026, 'land', [])[0].geschlecht).toMatch(/^[MF]$/)
  })
})

describe('Listen-Option „jede zweite Zeile grau“ (Parallelslalom)', () => {
  it('Vorgabe an (Entscheidung des Nutzers), abschaltbar; eine Einstellung in Sicherung und Vorlage; migrate() kennt Stände ohne das Feld', () => {
    expect(emptyState().parallelZebra).toBe(true)
    const aus = reducer(emptyState(), { type: 'SET_PARALLEL_ZEBRA', zebra: false })
    expect(aus.parallelZebra).toBe(false)
    expect(reducer(aus, { type: 'SET_PARALLEL_ZEBRA', zebra: false })).toBe(aus)
    const vorlage = makeFile('vorlage', aus, '2026-11-15T10:00:00.000Z')
    expect(vorlage.kind === 'vorlage' && vorlage.settings.parallelZebra).toBe(false)
    expect(migrate(aus)!.parallelZebra).toBe(false)
    const { parallelZebra: _z, ...alt } = aus
    expect(migrate(alt)!.parallelZebra).toBe(true)
    expect(migrate({ ...alt, parallelZebra: 'ja' })!.parallelZebra).toBe(true)
  })
})
