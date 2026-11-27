import { describe, expect, it } from 'vitest'
import {
  BESETZUNG_MAX,
  besetzungText,
  coPilotGewichtWert,
  coPilotKlassenBesetzt,
  coPilotName,
  coPilotVorgesehen,
  normalisiereBesetzung,
  normalisiereCoPiloten,
  setzeBesetzung,
  setzeCoPilotGewicht,
  setzeCoPilotName,
  zeigtCoPilot,
} from './besetzung'
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
    expect(zeigtCoPilot({ regelwerk: 'dm-2026', coPiloten: { '4': { haupt: { name: 'Max Muster' } } } }, '4')).toBe(true)
    // Auch nur ein Ersatz (26.11.2026).
    expect(zeigtCoPilot({ regelwerk: 'dm-2026', coPiloten: { '4': { ersatz: { name: 'Max Muster' } } } }, '4')).toBe(true)
    expect(zeigtCoPilot({ regelwerk: 'dm-2026', coPiloten: {} }, '2')).toBe(true)
  })

  it('Reducer und Migration: Boote und Co-Piloten stehen im Stand; alte Stände beginnen leer', () => {
    expect(emptyState().boote).toEqual({})
    expect(emptyState().coPiloten).toEqual({})
    let s = reducer(emptyState(), { type: 'SET_BOOT', klasse: '4', text: 'Boot 1, 15 PS' })
    s = reducer(s, { type: 'SET_CO_PILOT', klasse: 'E', text: 'Erika Beispiel' })
    expect(s.boote).toEqual({ '4': 'Boot 1, 15 PS' })
    expect(s.coPiloten).toEqual({ E: { haupt: { name: 'Erika Beispiel' } } })
    expect(reducer(s, { type: 'SET_CO_PILOT', klasse: 'E', text: '' }).coPiloten).toEqual({})
    // Unverändert: derselbe Stand.
    expect(reducer(s, { type: 'SET_CO_PILOT', klasse: 'E', text: 'Erika Beispiel' })).toBe(s)
    // Ein Wechsel des Regelwerks nimmt nichts weg (UIM kennt Klasse 7 nicht – die Angabe bleibt gespeichert).
    const mit7 = reducer(s, { type: 'SET_BOOT', klasse: '7', text: 'Boot 3' })
    expect(reducer(mit7, { type: 'SET_REGELWERK', regelwerk: 'uim-2026' }).boote).toEqual({ '4': 'Boot 1, 15 PS', '7': 'Boot 3' })

    const alt = migrate({ starters: [] })!
    expect(alt.boote).toEqual({})
    expect(alt.coPiloten).toEqual({})
    // Ein Stand vor dem 26.11.2026 (je Klasse ein Name als Text): Der Name wird der eingeteilte Co-Pilot.
    const geladen = migrate({ starters: [], boote: { '4': 'Boot 1', x: 'y' }, coPiloten: { E: 'Erika Beispiel', '1': 5 } })!
    expect(geladen.boote).toEqual({ '4': 'Boot 1' })
    expect(geladen.coPiloten).toEqual({ E: { haupt: { name: 'Erika Beispiel' } } })
    expect(alt.coPilotAusgleich).toBe('klasse')
  })
})

// Ersatz-Co-Pilot und Gewicht je Person (Antwort des Nutzers vom 26.11.2026, R11-07). Namen erfunden.
describe('Co-Piloten mit Ersatz und Gewicht (R11-07)', () => {
  it('Name und Gewicht je Rolle; eine Rolle ohne beides entfällt, eine Klasse ohne Rolle ebenso', () => {
    let c = setzeCoPilotName({}, 'E', 'haupt', 'Vor1 Nach1')
    c = setzeCoPilotName(c, 'E', 'ersatz', 'Vor2 Nach2 ')
    c = setzeCoPilotGewicht(c, 'E', 'ersatz', 74.64)
    expect(c).toEqual({ E: { haupt: { name: 'Vor1 Nach1' }, ersatz: { name: 'Vor2 Nach2 ', gewicht: 74.6 } } })
    expect(coPilotName(c, 'E', 'ersatz')).toBe('Vor2 Nach2')
    expect(coPilotName(c, 'E')).toBe('Vor1 Nach1')
    // Ein leerer Name lässt das Gewicht stehen; erst ohne beides fällt die Rolle weg.
    const nurGewicht = setzeCoPilotName(c, 'E', 'ersatz', '  ')
    expect(nurGewicht.E?.ersatz).toEqual({ name: '', gewicht: 74.6 })
    expect(setzeCoPilotGewicht(nurGewicht, 'E', 'ersatz', undefined).E).toEqual({ haupt: { name: 'Vor1 Nach1' } })
    expect(setzeCoPilotName(setzeCoPilotName(c, 'E', 'ersatz', ''), 'E', 'haupt', '').E).toEqual({ ersatz: { name: '', gewicht: 74.6 } })
    // Nur ein Gewicht genügt für eine Rolle.
    expect(setzeCoPilotGewicht({}, '2', 'haupt', 80)).toEqual({ '2': { haupt: { name: '', gewicht: 80 } } })
    // Unbrauchbares und Unverändertes: derselbe Stand.
    expect(setzeCoPilotGewicht(c, 'E', 'ersatz', -3)).toBe(c)
    expect(setzeCoPilotGewicht(c, 'E', 'ersatz', 400)).toBe(c)
    expect(setzeCoPilotGewicht(c, 'E', 'ersatz', 74.6)).toBe(c)
    expect(setzeCoPilotName(c, 'E', 'haupt', 'Vor1 Nach1')).toBe(c)
    expect(setzeCoPilotName({}, 'E', 'haupt', 'x'.repeat(200)).E?.haupt?.name).toHaveLength(BESETZUNG_MAX)
    expect(coPilotKlassenBesetzt(nurGewicht, ['E', '1'])).toBe(1)
  })

  it('Gewichte wie in der Verwiegung: über 0 und unter 300 kg, auf 0,1 kg', () => {
    expect(coPilotGewichtWert(72.46)).toBe(72.5)
    for (const falsch of [0, -1, 300, Number.NaN, Infinity, '72', null, undefined]) expect(coPilotGewichtWert(falsch), String(falsch)).toBeUndefined()
  })

  it('bereinigt Gespeichertes: alte Texte werden der eingeteilte Co-Pilot, Unbrauchbares entfällt', () => {
    expect(
      normalisiereCoPiloten({
        E: 'Vor1 Nach1',
        '1': { haupt: { name: 'Vor2 Nach2', gewicht: 81.23 }, ersatz: { name: 'Vor3 Nach3', gewicht: 'schwer' }, dritter: { name: 'x' } },
        '2': { ersatz: { name: '', gewicht: 70 } },
        '3': { haupt: { name: '  ' } },
        '9': { haupt: { name: 'Vor9 Nach9' } },
        '4': ['Vor4'],
      }),
    ).toEqual({
      E: { haupt: { name: 'Vor1 Nach1' } },
      '1': { haupt: { name: 'Vor2 Nach2', gewicht: 81.2 }, ersatz: { name: 'Vor3 Nach3' } },
      '2': { ersatz: { name: '', gewicht: 70 } },
    })
    expect(normalisiereCoPiloten(null)).toEqual({})
    expect(normalisiereCoPiloten('Vor1')).toEqual({})
  })

  it('Reducer: Ersatz, Gewicht und die Wahl des Ausgleichs; Unverändertes und Unbrauchbares ändern nichts', () => {
    let s = reducer(emptyState(), { type: 'SET_CO_PILOT', klasse: 'E', text: 'Vor1 Nach1' })
    s = reducer(s, { type: 'SET_CO_PILOT', klasse: 'E', text: 'Vor2 Nach2', rolle: 'ersatz' })
    s = reducer(s, { type: 'SET_CO_PILOT_GEWICHT', klasse: 'E', rolle: 'ersatz', gewicht: 71.5 })
    expect(s.coPiloten).toEqual({ E: { haupt: { name: 'Vor1 Nach1' }, ersatz: { name: 'Vor2 Nach2', gewicht: 71.5 } } })
    expect(reducer(s, { type: 'SET_CO_PILOT_GEWICHT', klasse: 'E', rolle: 'ersatz', gewicht: 71.5 })).toBe(s)
    expect(reducer(s, { type: 'SET_CO_PILOT_GEWICHT', klasse: 'E', rolle: 'ersatz', gewicht: -2 })).toBe(s)
    expect(reducer(s, { type: 'SET_CO_PILOT_GEWICHT', klasse: 'E', rolle: 'ersatz', gewicht: null }).coPiloten.E?.ersatz).toEqual({ name: 'Vor2 Nach2' })
    expect(s.coPilotAusgleich).toBe('klasse')
    const alle = reducer(s, { type: 'SET_CO_PILOT_AUSGLEICH', ausgleich: 'alle' })
    expect(alle.coPilotAusgleich).toBe('alle')
    expect(reducer(alle, { type: 'SET_CO_PILOT_AUSGLEICH', ausgleich: 'alle' })).toBe(alle)
    // Unbekanntes gilt als Vorgabe (je Klasse).
    expect(reducer(alle, { type: 'SET_CO_PILOT_AUSGLEICH', ausgleich: 'quer' as 'alle' }).coPilotAusgleich).toBe('klasse')
    // Migration: neue Form bleibt, Unbrauchbares fällt auf die Vorgabe.
    const geladen = migrate(JSON.parse(JSON.stringify({ ...alle, coPilotAusgleich: 'alle' })))!
    expect(geladen.coPiloten).toEqual(s.coPiloten)
    expect(geladen.coPilotAusgleich).toBe('alle')
    expect(migrate({ starters: [], coPilotAusgleich: 'quer' })!.coPilotAusgleich).toBe('klasse')
  })
})
