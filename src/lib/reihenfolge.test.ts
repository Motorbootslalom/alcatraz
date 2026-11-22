import { describe, expect, it } from 'vitest'
import { emptyState, reducer, type Action } from '../state/reducer'
import { beschreibe } from './verlauf'
import { gleicheFolge, istGeordnet, istSortierWahl, mische, naechsteSortierung, ordneNach, sortierPfeil, sortierSpalten } from './reihenfolge'
import { sortedByStartNr } from '../domain/startnumbers'
import type { AppState, ClassId, Starter } from '../types'

// „Sortierung ändern“ und „Zufall“ im Reiter „Starter“ (Entscheidung des Nutzers vom 15.11.2026).
// Alle Starter sind erfunden.

const mk = (id: string, startNr: string, mehr: Partial<Starter> = {}, klasse: ClassId = '4'): Starter => ({
  id,
  startNr,
  vorname: `Vor${id}`,
  nachname: `Nach${id}`,
  verein: 'Musterclub',
  bundesland: '',
  geburtsdatum: '',
  groesse: '',
  klasse,
  ...mehr,
})
const ids = (list: readonly Starter[]) => list.map((p) => p.id)
const tu = (state: AppState, action: Action) => reducer(state, { ...action, zeit: 1 } as Action)

describe('ordneNach: stabil, fehlende Angaben hinten', () => {
  const feld = [
    mk('a', '401', { nachname: 'Berg', vorname: 'Tom', groesse: 'L', geburtsdatum: '2012-05-01', geschlecht: 'F', verein: 'Zelt-Club' }),
    mk('b', '402', { nachname: 'Arndt', vorname: 'Ute', groesse: '', geburtsdatum: '', verein: '' }),
    mk('c', '403', { nachname: 'Berg', vorname: 'Ada', groesse: 'XS', geburtsdatum: '2011-02-03', geschlecht: 'M', verein: 'Anker-Club' }),
    mk('d', '404', { nachname: 'Ärmel', vorname: 'Ben', groesse: 'XXL', geburtsdatum: '2012-01-09', geschlecht: 'nA', verein: 'anker-club' }),
  ]

  it('nach Name: Umlaut beim Grundbuchstaben, Gleichstand behält die Reihenfolge; umgedreht ebenso stabil', () => {
    expect(ids(ordneNach(feld, { spalte: 'nachname', absteigend: false }, 'verein'))).toEqual(['d', 'b', 'a', 'c'])
    expect(ids(ordneNach(feld, { spalte: 'nachname', absteigend: true }, 'verein'))).toEqual(['a', 'c', 'b', 'd'])
  })

  it('erst nach Vorname, dann nach Name sortiert ergibt Name und Vorname', () => {
    const nachVorname = ordneNach(feld, { spalte: 'vorname', absteigend: false }, 'verein')
    expect(ids(ordneNach(nachVorname, { spalte: 'nachname', absteigend: false }, 'verein'))).toEqual(['d', 'b', 'c', 'a'])
  })

  it('Größe klein → groß; ohne Größe in beiden Richtungen hinten', () => {
    expect(ids(ordneNach(feld, { spalte: 'groesse', absteigend: false }, 'verein'))).toEqual(['c', 'a', 'd', 'b'])
    expect(ids(ordneNach(feld, { spalte: 'groesse', absteigend: true }, 'verein'))).toEqual(['d', 'a', 'c', 'b'])
  })

  it('Geburtsdatum chronologisch, Geschlecht in der Folge M, F, D, nA, Herkunft nach der der Veranstaltung', () => {
    expect(ids(ordneNach(feld, { spalte: 'geburtsdatum', absteigend: false }, 'verein'))).toEqual(['c', 'd', 'a', 'b'])
    expect(ids(ordneNach(feld, { spalte: 'geschlecht', absteigend: false }, 'verein'))).toEqual(['c', 'a', 'd', 'b'])
    // Groß und klein gleich: Gleichstand – die bisherige Reihenfolge bleibt.
    expect(ids(ordneNach(feld, { spalte: 'herkunft', absteigend: false }, 'verein'))).toEqual(['c', 'd', 'a', 'b'])
  })

  it('istGeordnet erkennt, ob eine Klasse noch so steht', () => {
    const s = { spalte: 'nachname', absteigend: false } as const
    expect(istGeordnet(feld, s, 'verein')).toBe(false)
    expect(istGeordnet(ordneNach(feld, s, 'verein'), s, 'verein')).toBe(true)
  })

  it('Spalten wie in der Tabelle: Herkunft nur mit Herkunft, Geschlecht nur, wenn die Spalte steht', () => {
    expect(sortierSpalten('verein', true)).toEqual(['nachname', 'vorname', 'herkunft', 'groesse', 'geschlecht', 'geburtsdatum'])
    expect(sortierSpalten('none', false)).toEqual(['nachname', 'vorname', 'groesse', 'geburtsdatum'])
  })

  it('mische: aus derselben Saat dieselbe Folge, nichts geht verloren', () => {
    const zahlen = Array.from({ length: 20 }, (_, i) => i)
    expect(mische(zahlen, 42)).toEqual(mische(zahlen, 42))
    expect(mische(zahlen, 42)).not.toEqual(mische(zahlen, 43))
    expect([...mische(zahlen, 7)].sort((a, b) => a - b)).toEqual(zahlen)
  })
})

describe('Reducer: ORDER_STARTERS und SHUFFLE_STARTERS', () => {
  const stand = (): AppState => ({
    ...emptyState(),
    starters: [
      mk('a', '405', { nachname: 'Cedern' }),
      mk('b', '401', { nachname: 'Birke' }),
      mk('c', '410', { nachname: 'Ahorn' }),
      mk('e', '301', { nachname: 'Zeder' }, '3'),
      mk('f', '302', { nachname: 'Esche' }, '3'),
    ],
  })
  const nummern = (s: AppState) => Object.fromEntries(s.starters.map((p) => [p.id, p.startNr]))

  it('verteilt nur die vorhandenen Nummern der Klasse neu; andere Klassen bleiben', () => {
    const s = tu(stand(), { type: 'ORDER_STARTERS', klassen: ['4'], nach: 'nachname', absteigend: false })
    expect(nummern(s)).toEqual({ a: '410', b: '405', c: '401', e: '301', f: '302' })
    // Noch einmal dieselbe Richtung: nichts ändert sich – derselbe Stand.
    expect(tu(s, { type: 'ORDER_STARTERS', klassen: ['4'], nach: 'nachname', absteigend: false })).toBe(s)
    // Umgedreht.
    expect(nummern(tu(s, { type: 'ORDER_STARTERS', klassen: ['4'], nach: 'nachname', absteigend: true }))).toMatchObject({ a: '401', b: '405', c: '410' })
  })

  it('alle Klassen zugleich: jede in sich, die Reihenfolge der Klassen bleibt', () => {
    const s = tu(stand(), { type: 'ORDER_STARTERS', klassen: ['3', '4'], nach: 'nachname', absteigend: false })
    expect(nummern(s)).toEqual({ a: '410', b: '405', c: '401', e: '302', f: '301' })
  })

  it('Zufall: dieselbe Saat, dieselbe Folge; die Nummern der Klasse bleiben dieselben', () => {
    const viele: AppState = { ...emptyState(), starters: Array.from({ length: 12 }, (_, i) => mk(`p${i}`, String(401 + i))) }
    const eins = tu(viele, { type: 'SHUFFLE_STARTERS', klassen: ['4'], saat: 7 })
    expect(eins.starters).toEqual(tu(viele, { type: 'SHUFFLE_STARTERS', klassen: ['4'], saat: 7 }).starters)
    expect(eins).not.toBe(viele)
    expect(eins.starters.map((p) => p.startNr).sort()).toEqual(viele.starters.map((p) => p.startNr))
    expect(nummern(tu(viele, { type: 'SHUFFLE_STARTERS', klassen: ['4'], saat: 8 }))).not.toEqual(nummern(eins))
  })

  it('gesperrt, solange die Verzahnung festgeschrieben ist', () => {
    const fest = { ...stand(), verzahnungLocked: true }
    expect(tu(fest, { type: 'ORDER_STARTERS', klassen: ['4'], nach: 'nachname', absteigend: false })).toBe(fest)
    expect(tu(fest, { type: 'SHUFFLE_STARTERS', klassen: ['4'], saat: 3 })).toBe(fest)
  })

  // Prüfbefund zu Paket F (16.11.2026): Klassisch vergibt erst die Verzahnung die Nummern – vorher
  // muss die Sortierung trotzdem wirken (über die Folge der Starter), sonst bliebe alles stehen.
  describe('ohne oder mit teilweise fehlenden Startnummern (klassisch, vor der Verzahnung)', () => {
    const ohne = (): AppState => ({
      ...emptyState(),
      startNrMode: 'klassisch',
      starters: [
        mk('z', '', { nachname: 'Zeder' }, '3'),
        mk('k', '', { nachname: 'Kiefer' }),
        mk('m', '', { nachname: 'Mammutbaum' }, '3'),
        mk('a', '', { nachname: 'Ahorn' }, '3'),
        mk('l', '', { nachname: 'Linde' }, '3'),
      ],
    })
    /** Die Klasse, wie der Reiter sie zeigt (nach Startnummer, ohne Nummer in der Folge des Stands). */
    const gezeigt = (s: AppState, klasse: ClassId = '3') => sortedByStartNr(s.starters.filter((p) => p.klasse === klasse)).map((p) => `${p.startNr || '–'} ${p.nachname}`)

    it('nach Name: die Starter rücken in die neue Folge, ein zweiter Klick dreht sie um; andere Klassen bleiben an ihrem Platz', () => {
      const s = tu(ohne(), { type: 'ORDER_STARTERS', klassen: ['3'], nach: 'nachname', absteigend: false })
      expect(gezeigt(s)).toEqual(['– Ahorn', '– Linde', '– Mammutbaum', '– Zeder'])
      expect(istGeordnet(sortedByStartNr(s.starters.filter((p) => p.klasse === '3')), { spalte: 'nachname', absteigend: false }, 'verein')).toBe(true)
      expect(s.starters[1].id).toBe('k')
      expect(tu(s, { type: 'ORDER_STARTERS', klassen: ['3'], nach: 'nachname', absteigend: false })).toBe(s)
      expect(gezeigt(tu(s, { type: 'ORDER_STARTERS', klassen: ['3'], nach: 'nachname', absteigend: true }))).toEqual(['– Zeder', '– Mammutbaum', '– Linde', '– Ahorn'])
    })

    it('die Verzahnung vergibt die Nummern danach in der sortierten Folge', () => {
      const s = tu(tu(ohne(), { type: 'ORDER_STARTERS', klassen: ['3'], nach: 'nachname', absteigend: false }), { type: 'ASSIGN_START_NUMBERS' })
      const nr = (name: string) => Number(s.starters.find((p) => p.nachname === name)!.startNr)
      expect(nr('Ahorn')).toBeLessThan(nr('Linde'))
      expect(nr('Linde')).toBeLessThan(nr('Mammutbaum'))
      expect(nr('Mammutbaum')).toBeLessThan(nr('Zeder'))
    })

    it('Zufall mischt auch ohne Nummern, aus derselben Saat gleich', () => {
      const viele: AppState = { ...emptyState(), startNrMode: 'klassisch', starters: Array.from({ length: 12 }, (_, i) => mk(`p${i}`, '', {}, '3')) }
      const eins = tu(viele, { type: 'SHUFFLE_STARTERS', klassen: ['3'], saat: 7 })
      expect(eins).not.toBe(viele)
      expect(ids(eins.starters)).not.toEqual(ids(viele.starters))
      expect(ids(eins.starters)).toEqual(ids(tu(viele, { type: 'SHUFFLE_STARTERS', klassen: ['3'], saat: 7 }).starters))
      expect(eins.starters.every((p) => p.startNr === '')).toBe(true)
    })

    it('Verschieben wirkt auch ohne Nummern; ganz oben nach oben ändert nichts', () => {
      const s = tu(ohne(), { type: 'MOVE_STARTER', id: 'z', target: 'down' })
      expect(gezeigt(s)).toEqual(['– Mammutbaum', '– Zeder', '– Ahorn', '– Linde'])
      expect(gezeigt(tu(s, { type: 'MOVE_STARTER', id: 'l', target: 'first' }))).toEqual(['– Linde', '– Mammutbaum', '– Zeder', '– Ahorn'])
      expect(tu(s, { type: 'MOVE_STARTER', id: 'm', target: 'up' })).toBe(s)
    })

    it('fehlen nur einige Nummern: die vorhandenen gehen an die ersten, die übrigen stehen sortiert dahinter', () => {
      const teils: AppState = {
        ...emptyState(),
        starters: [
          mk('w1', '', { nachname: 'Weide', vorname: 'Ada' }),
          mk('h', '406', { nachname: 'Hasel' }),
          mk('s', '', { nachname: 'Sanddorn' }),
          mk('b', '402', { nachname: 'Buche' }),
          mk('w2', '', { nachname: 'Weide', vorname: 'Ben' }),
          mk('e', '404', { nachname: 'Eibe' }),
        ],
      }
      // Ohne Startnummern-Bereiche (sonst bliebe jede Nummer in ihrem Bereich und ginge nicht an Starter ohne Nummer, 20.11.2026).
      const s = tu({ ...teils, startNrBereiche: { 4: [] } }, { type: 'ORDER_STARTERS', klassen: ['4'], nach: 'nachname', absteigend: false })
      expect(gezeigt(s, '4')).toEqual(['402 Buche', '404 Eibe', '406 Hasel', '– Sanddorn', '– Weide', '– Weide'])
      expect(gezeigt(tu(s, { type: 'ORDER_STARTERS', klassen: ['4'], nach: 'nachname', absteigend: true }), '4')).toEqual(['402 Weide', '404 Weide', '406 Sanddorn', '– Hasel', '– Eibe', '– Buche'])
      // Klassisch vergibt die Verzahnung danach in genau dieser Folge – Starter ohne Nummer stehen
      // auch dort hinten (planung/verzahnung.ts startersByClass), nicht vorn.
      const klassisch = tu({ ...s, startNrMode: 'klassisch' }, { type: 'ASSIGN_START_NUMBERS' })
      const namen = sortedByStartNr(klassisch.starters.filter((p) => p.klasse === '4')).map((p) => p.nachname)
      expect(namen).toEqual(['Buche', 'Eibe', 'Hasel', 'Sanddorn', 'Weide', 'Weide'])
    })
  })

  it('Verlauf: „Reihenfolge geändert“ mit der Klasse, für alle Klassen ohne', () => {
    expect(beschreibe({ type: 'ORDER_STARTERS', klassen: ['4'], nach: 'groesse', absteigend: false }, { starters: [] })).toEqual({ art: 'reihenfolge', klasse: '4' })
    expect(beschreibe({ type: 'SHUFFLE_STARTERS', klassen: ['3', '4'], saat: 1 }, { starters: [] })).toEqual({ art: 'reihenfolge' })
  })
})

// Drei Stufen je Spaltenkopf (Wunsch des Nutzers vom 21.11.2026, Befund 16; Folge bestätigt 21.11.2026 S-01).
describe('Stufen der Sortierung', () => {
  it('Klick 1 aufsteigend A→Z, Klick 2 absteigend Z→A, Klick 3 keine; eine andere Spalte beginnt bei A→Z', () => {
    const k1 = naechsteSortierung(null, 'herkunft')
    expect(k1).toEqual({ spalte: 'herkunft', absteigend: false })
    const k2 = naechsteSortierung(k1, 'herkunft')
    expect(k2).toEqual({ spalte: 'herkunft', absteigend: true })
    expect(naechsteSortierung(k2, 'herkunft')).toBeNull()
    expect(naechsteSortierung(k2, 'nachname')).toEqual({ spalte: 'nachname', absteigend: false })
    expect(naechsteSortierung(k1, 'nachname')).toEqual({ spalte: 'nachname', absteigend: false })
  })

  it('aufsteigend = kleinster Wert zuerst: XS vor XL, die Ältesten zuerst; ohne Angabe hinten', () => {
    const feld = [
      mk('a', '401', { groesse: 'XL', geburtsdatum: '2014-05-01' }),
      mk('b', '402', { groesse: '', geburtsdatum: '' }),
      mk('c', '403', { groesse: 'XS', geburtsdatum: '2011-02-03' }),
    ]
    expect(ordneNach(feld, { spalte: 'groesse', absteigend: false }, 'verein').map((p) => p.id)).toEqual(['c', 'a', 'b'])
    expect(ordneNach(feld, { spalte: 'geburtsdatum', absteigend: false }, 'verein').map((p) => p.id)).toEqual(['c', 'a', 'b'])
  })

  it('Pfeile ↓ ↑ ↕', () => {
    expect(sortierPfeil({ spalte: 'vorname', absteigend: true }, 'vorname')).toBe('↓')
    expect(sortierPfeil({ spalte: 'vorname', absteigend: false }, 'vorname')).toBe('↑')
    expect(sortierPfeil({ spalte: 'vorname', absteigend: false }, 'nachname')).toBe('↕')
    expect(sortierPfeil(null, 'nachname')).toBe('↕')
  })

  it('absteigend: Z→A, ohne Angabe hinten', () => {
    const feld = [mk('a', '401', { verein: 'Club A' }), mk('b', '402', { verein: '' }), mk('c', '403', { verein: 'Club Z' })]
    expect(ordneNach(feld, { spalte: 'herkunft', absteigend: true }, 'verein').map((p) => p.id)).toEqual(['c', 'a', 'b'])
  })

  it('gleicheFolge und istSortierWahl (gemerkte Auswahl)', () => {
    const feld = [mk('a', '401'), mk('b', '402')]
    expect(gleicheFolge(['a', 'b'], feld)).toBe(true)
    expect(gleicheFolge(['b', 'a'], feld)).toBe(false)
    expect(gleicheFolge(['a'], feld)).toBe(false)
    expect(gleicheFolge(undefined, feld)).toBe(false)
    expect(istSortierWahl({ spalte: 'nachname', absteigend: true, folge: { 4: ['a', 'b'] } })).toBe(true)
    expect(istSortierWahl({ spalte: 'quatsch', absteigend: true, folge: {} })).toBe(false)
    expect(istSortierWahl({ spalte: 'nachname', absteigend: true, folge: { 4: [1] } })).toBe(false)
    expect(istSortierWahl(null)).toBe(false)
  })
})
