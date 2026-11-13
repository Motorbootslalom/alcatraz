import { describe, expect, it } from 'vitest'
import { pruefeKlassen } from './klassenPruefung'
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
})
