import { describe, expect, it } from 'vitest'
import { BESETZUNG_MAX, besetzungText, coPilotVorgesehen, normalisiereBesetzung, setzeBesetzung, zeigtCoPilot } from './besetzung'
import { emptyState, reducer } from '../state/reducer'
import { migrate } from '../state/migrate'
import { REGELWERKE } from '../config/catalog'

// Boot und Co-Pilot je Klasse. Alle Namen sind erfunden.

describe('Besetzung je Klasse', () => {
  it('setzt die Angabe, wie sie getippt wurde; ein leerer Text entfernt sie', () => {
    const b = setzeBesetzung({}, '4', 'Boot 1 ')
    expect(b).toEqual({ '4': 'Boot 1 ' })
    expect(besetzungText(b, '4')).toBe('Boot 1')
    expect(besetzungText(b, '5')).toBe('')
    expect(setzeBesetzung(b, '4', '   ')).toEqual({})
    expect(setzeBesetzung(b, '5', 'Boot 2')).toEqual({ '4': 'Boot 1 ', '5': 'Boot 2' })
    // Eine Angabe muss in ein Feld des Listenkopfs passen.
    expect(setzeBesetzung({}, 'E', 'x'.repeat(200)).E).toHaveLength(BESETZUNG_MAX)
  })

  it('bereinigt Gespeichertes: nur bekannte Klassen mit Text', () => {
    expect(normalisiereBesetzung({ E: 'Erika Beispiel', '9': 'x', '4': '', '5': 7, __proto__: 'y' })).toEqual({ E: 'Erika Beispiel' })
    expect(normalisiereBesetzung(undefined)).toEqual({})
    expect(normalisiereBesetzung(['Boot'])).toEqual({})
    expect(normalisiereBesetzung('Boot')).toEqual({})
  })

  it('Co-Pilot: DM-Reglement C3 „Klassen ME bis M3“, UIM 960 Pkt. 2 „Classes Dolphin, 1 - 3“', () => {
    for (const r of REGELWERKE) expect(r.coPilotKlassen).toEqual(['E', '1', '2', '3'])
    expect(coPilotVorgesehen('dm-2026', '3')).toBe(true)
    expect(coPilotVorgesehen('dm-2026', '4')).toBe(false)
    expect(coPilotVorgesehen('uim-2026', 'E')).toBe(true)
    // Ein eingetragener Co-Pilot steht auch dort auf dem Blatt, wo das Regelwerk keinen vorsieht.
    expect(zeigtCoPilot({ regelwerk: 'dm-2026', coPiloten: {} }, '4')).toBe(false)
    expect(zeigtCoPilot({ regelwerk: 'dm-2026', coPiloten: { '4': 'Max Muster' } }, '4')).toBe(true)
    expect(zeigtCoPilot({ regelwerk: 'dm-2026', coPiloten: {} }, '2')).toBe(true)
  })

  it('Reducer und Migration: Boote und Co-Piloten stehen im Stand; alte Stände beginnen leer', () => {
    expect(emptyState().boote).toEqual({})
    expect(emptyState().coPiloten).toEqual({})
    let s = reducer(emptyState(), { type: 'SET_BOOT', klasse: '4', text: 'Boot 1, 15 PS' })
    s = reducer(s, { type: 'SET_CO_PILOT', klasse: 'E', text: 'Erika Beispiel' })
    expect(s.boote).toEqual({ '4': 'Boot 1, 15 PS' })
    expect(s.coPiloten).toEqual({ E: 'Erika Beispiel' })
    expect(reducer(s, { type: 'SET_CO_PILOT', klasse: 'E', text: '' }).coPiloten).toEqual({})
    // Ein Wechsel des Regelwerks nimmt nichts weg (UIM kennt Klasse 7 nicht – die Angabe bleibt gespeichert).
    const mit7 = reducer(s, { type: 'SET_BOOT', klasse: '7', text: 'Boot 3' })
    expect(reducer(mit7, { type: 'SET_REGELWERK', regelwerk: 'uim-2026' }).boote).toEqual({ '4': 'Boot 1, 15 PS', '7': 'Boot 3' })

    const alt = migrate({ starters: [] })!
    expect(alt.boote).toEqual({})
    expect(alt.coPiloten).toEqual({})
    const geladen = migrate({ starters: [], boote: { '4': 'Boot 1', x: 'y' }, coPiloten: { E: 'Erika Beispiel', '1': 5 } })!
    expect(geladen.boote).toEqual({ '4': 'Boot 1' })
    expect(geladen.coPiloten).toEqual({ E: 'Erika Beispiel' })
  })
})
