import { describe, expect, it } from 'vitest'
import { jahrgaengeText, klassenFuerJahr, pruefeKlassen, startendeJahrgaenge } from './klassenPruefung'
import { birthYearRange, CLASS_IDS } from '../domain/classes'
import type { ClassId, Starter } from '../types'

// Erfundene Starter.
const s = (klasse: ClassId, geburtsdatum: string, nachname = 'Muster'): Starter => ({ id: nachname + klasse, startNr: '', vorname: 'Max', nachname, verein: '', bundesland: '', geburtsdatum, groesse: '', klasse })

describe('Klasse gegen Geburtsjahr prüfen', () => {
  const [von, bis] = birthYearRange('3', 2026)

  it('ein Jahrgang innerhalb der Klasse ist in Ordnung – an beiden Rändern', () => {
    expect(pruefeKlassen([s('3', `${von}-01-01`), s('3', `${bis}-12-31`)], 2026, CLASS_IDS).fehler).toEqual([])
  })

  it('ein falscher Jahrgang wird gemeldet, mit der Klasse, in die er gehört', () => {
    const { fehler } = pruefeKlassen([s('3', `${von - 1}-06-15`, 'Zualt'), s('3', `${bis + 1}-06-15`, 'Zujung')], 2026, CLASS_IDS)
    expect(fehler.map((f) => [f.starter.nachname, f.jahr, f.erlaubt, f.passend])).toEqual([
      ['Zualt', von - 1, [von, bis], ['4']],
      ['Zujung', bis + 1, [von, bis], ['2']],
    ])
  })

  it('ohne Geburtsdatum lässt sich nichts prüfen: gezählt, aber kein Fehler', () => {
    expect(pruefeKlassen([s('3', '')], 2026, CLASS_IDS)).toEqual({ fehler: [], ohneDatum: 1 })
  })

  it('ein Jahrgang, der in keine Klasse des Regelwerks gehört', () => {
    expect(pruefeKlassen([s('3', '1990-01-01')], 2026, CLASS_IDS).fehler[0].passend).toEqual([])
  })

  it('die Jahrgänge, die überhaupt starten, folgen aus Regelwerk und Jahr der Veranstaltung', () => {
    // DM: Klasse E bis 7 (6–27 Jahre), UIM: Dolphin bis 5 (6–18 Jahre).
    expect(jahrgaengeText(startendeJahrgaenge(2026, CLASS_IDS))).toBe('1999–2020')
    expect(jahrgaengeText(startendeJahrgaenge(2026, ['E', '1', '2', '3', '4', '5']))).toBe('2008–2020')
    // Fehlt eine Klasse dazwischen, sind es zwei Bereiche.
    expect(jahrgaengeText(startendeJahrgaenge(2026, ['E', '2']))).toBe('2015–2016, 2019–2020')
    expect(klassenFuerJahr(2019, 2026, CLASS_IDS)).toEqual(['E'])
    expect(klassenFuerJahr(2023, 2026, CLASS_IDS)).toEqual([])
    // Klasse 6 gibt es unter UIM nicht.
    expect(klassenFuerJahr(2006, 2026, ['E', '1', '2', '3', '4', '5'])).toEqual([])
  })
})
