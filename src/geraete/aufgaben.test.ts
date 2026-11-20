import { describe, expect, it } from 'vitest'
import { bereinige, darf, erlaubteAction, freigabeBereiche, liesAufgaben, STARTFREIGABE_ACTIONS, type Aufgabe, type AufgabenStand } from './aufgaben'

/**
 * Rechte der Geräte (E7) – sinngemäß aus tafel state/permissions.test.ts portiert (Steg nur eigene Parcours, nie
 * Stammdaten, Rechte ändern wirkt sofort, ohne Rechte nichts), dazu die Positivliste von alcatraz.
 */

const DM = { parcoursList: [{ id: 'see' }, { id: 'land' }], regelwerk: 'dm-2026' } as unknown as AufgabenStand
const UIM = { parcoursList: [{ id: 'see' }], regelwerk: 'uim-2026' } as unknown as AufgabenStand
const steg = (...bereiche: string[]): Aufgabe[] => [{ art: 'startfreigabe', bereiche }]

const zeigen = (bereich = 'see') => ({ type: 'BETRIEB_ZEIGEN', bereich, ref: '["m","s1",1]', vorher: null })
const meldung = (bereich = 'see') => ({ type: 'BETRIEB_MELDUNG', bereich, meldung: { text: 'Störung', art: 'stoerung' } })

describe('darf – Start-Freigabe', () => {
  it('lässt das Steg-Handy nur seine eigenen Bereiche bedienen', () => {
    expect(darf(zeigen(), steg('see'), DM)).toBe(true)
    expect(darf(meldung(), steg('see'), DM)).toBe(true)
    expect(darf(zeigen('land'), steg('see'), DM)).toBe(false)
  })

  it('mit mehreren Bereichen alle davon', () => {
    expect(darf(zeigen('see'), steg('see', 'land'), DM)).toBe(true)
    expect(darf(zeigen('land'), steg('see', 'land'), DM)).toBe(true)
  })

  it('alles Betriebliche (F5) – nur nicht „Betrieb zurücksetzen“', () => {
    const r = '["m","s1",1]'
    const alle = [
      { type: 'BETRIEB_BEGINNEN', bereich: 'see', punkt: 'lauf:1' },
      zeigen(),
      { type: 'BETRIEB_ZURUECK', bereich: 'see', ref: r },
      meldung(),
      { type: 'BETRIEB_MELDUNG', bereich: 'see', meldung: null },
      { type: 'BETRIEB_ZURUECKSTELLEN', bereich: 'see', ref: r },
      { type: 'BETRIEB_EINREIHEN', bereich: 'see', ref: r, wo: 'ende' },
      { type: 'BETRIEB_AUSSETZEN', bereich: 'see', klasse: '3', an: true },
      { type: 'BETRIEB_VORZIEHEN', bereich: 'see', an: false },
      { type: 'BETRIEB_KLASSE_VOR', bereich: 'see', klasse: '3', vor: null },
      { type: 'BETRIEB_VERSCHIEBEN', bereich: 'see', ref: r, ziel: { nachPunkt: 'lauf:2' } },
      { type: 'BETRIEB_AB', bereich: 'see', ref: r },
    ]
    expect([...new Set(alle.map((a) => a.type))].sort()).toEqual([...STARTFREIGABE_ACTIONS].sort())
    for (const a of alle) expect(darf(a, steg('see'), DM), a.type).toBe(true)
    expect(darf({ type: 'BETRIEB_ZURUECKSETZEN', bereich: 'see' }, steg('see'), DM)).toBe(false)
    expect(darf({ type: 'BETRIEB_ZURUECKSETZEN' }, steg('see'), DM)).toBe(false)
  })

  it('nie Stammdaten, Einstellungen, Eingaben, Gewichte, Laden oder Zurücksetzen – auch mit Bereich', () => {
    const verboten = [
      { type: 'LOAD_STATE', state: {}, bereich: 'see' },
      { type: 'RESET_ALL', bereich: 'see' },
      { type: 'SET_ANZEIGE', patch: { skala: 2 }, bereich: 'see' },
      { type: 'SET_GERAETE_SERVER', server: 'https://ntfy.test', bereich: 'see' },
      { type: 'SET_EINGABEN', zellen: [], bereich: 'see' },
      { type: 'SET_WEIGHT', starterId: 's1', gewicht: 40, bereich: 'see' },
      { type: 'IMPORT_STARTERS', starters: [], mode: 'replace', bereich: 'see' },
      { type: 'CLEAR_EINGABEN', bereich: 'see' },
      { type: 'SET_KENNUNG', kennung: 'X', bereich: 'see' },
    ]
    for (const a of verboten) expect(darf(a, steg('see'), DM), a.type).toBe(false)
  })

  it('Meldung an alle Bereiche („*“) nie vom Gerät', () => {
    expect(darf(meldung('*'), steg('see', 'land', '*'), DM)).toBe(false)
  })

  it('zieht geänderte Rechte sofort nach (Bereich entzogen, anderer dazu)', () => {
    let aufgaben = steg('see')
    expect(darf(zeigen('see'), aufgaben, DM)).toBe(true)
    aufgaben = steg('land')
    expect(darf(zeigen('see'), aufgaben, DM)).toBe(false)
    expect(darf(zeigen('land'), aufgaben, DM)).toBe(true)
  })

  it('ohne Aufgaben (entzogen, nie gekoppelt) gar nichts', () => {
    expect(darf(zeigen(), [], DM)).toBe(false)
    expect(darf(zeigen(), steg(), DM)).toBe(false)
  })

  it('einen Bereich, den es im Stand nicht gibt, nicht – auch nicht „parallel“ unter DM', () => {
    expect(darf(zeigen('weg'), steg('weg'), DM)).toBe(false)
    expect(darf(zeigen('parallel'), steg('parallel'), DM)).toBe(false)
    expect(darf(zeigen('parallel'), steg('parallel'), UIM)).toBe(true)
  })
})

describe('bereinige', () => {
  it('nimmt nur die Felder, die der Reducer liest – ohne `zeit` und Fremdes', () => {
    const roh = { ...zeigen(), zeit: 5, kennung: 'X', state: { starters: [] } }
    expect(bereinige(roh)).toEqual(zeigen())
    expect(erlaubteAction(roh, steg('see'), DM)).toEqual(zeigen())
  })

  it('verwirft falsche Typen und zu Langes', () => {
    expect(bereinige({ type: 'BETRIEB_ZEIGEN', bereich: 'see', ref: 5, vorher: null })).toBeNull()
    expect(bereinige({ type: 'BETRIEB_ZEIGEN', bereich: 'see', ref: 'a' })).toBeNull()
    expect(bereinige({ type: 'BETRIEB_BEGINNEN', bereich: 'see', punkt: 'lauf:0' })).toBeNull()
    expect(bereinige({ type: 'BETRIEB_MELDUNG', bereich: 'see', meldung: { text: 'x'.repeat(201), art: 'info' } })).toBeNull()
    expect(bereinige({ type: 'BETRIEB_MELDUNG', bereich: 'see', meldung: { text: 'x', art: 'laut' } })).toBeNull()
    expect(bereinige({ type: 'BETRIEB_AUSSETZEN', bereich: 'see', klasse: 'ME', an: true })).toBeNull()
    expect(bereinige({ type: 'BETRIEB_VERSCHIEBEN', bereich: 'see', ref: 'a', ziel: { vor: 'b', nach: 'c' } })).toBeNull()
    expect(bereinige({ type: 'BETRIEB_VORZIEHEN', bereich: 'see', an: 'ja' })).toBeNull()
    expect(bereinige({ type: 'BETRIEB_ZEIGEN', bereich: 'x'.repeat(65), ref: 'a', vorher: null })).toBeNull()
    expect(bereinige(null)).toBeNull()
  })
})

describe('liesAufgaben', () => {
  it('liest, was es kennt, und verwirft den Rest', () => {
    expect(liesAufgaben([{ art: 'startfreigabe', bereiche: ['see', 'see', 5, 'land'] }, { art: 'admin' }, 'x'])).toEqual([
      { art: 'startfreigabe', bereiche: ['see', 'land'] },
    ])
    expect(liesAufgaben(null)).toEqual([])
    expect(freigabeBereiche([...steg('see'), ...steg('land', 'see')])).toEqual(['see', 'land'])
  })
})
