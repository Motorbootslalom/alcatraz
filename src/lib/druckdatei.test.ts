import { describe, expect, it } from 'vitest'
import { druckdateiFolge, druckdateiVorgabe, istDruckdateiWahl } from './druckdatei'

const DRUCKDATEI_WAHL = druckdateiVorgabe()

describe('Druckdatei: Folge der Dokumente', () => {
  const vorhanden = { starter: ['p1', 'p2'], pokal: ['plaetze6', 'uim'] as const, ergebnis: ['E/1/platz', 'E/gesamt/platz', '1/gesamt/platz'] }

  it('Starterliste, Mannschaftswertung (UIM vor Plätzen), Codes, Ergebnislisten – wie in der Vorlage', () => {
    expect(druckdateiFolge(DRUCKDATEI_WAHL, vorhanden).map((d) => `${d.teil}:${d.id}`)).toEqual([
      'starter:p1',
      'starter:p2',
      'pokal:uim',
      'pokal:plaetze6',
      'codes:codes',
      'ergebnis:E/1/platz',
      'ergebnis:E/gesamt/platz',
      'ergebnis:1/gesamt/platz',
    ])
  })

  it('abgewählte Teile entfallen; die Codes sind immer genau ein Dokument', () => {
    const teile = { starter: false, pokal: false, codes: true, ergebnis: false }
    expect(druckdateiFolge({ teile }, vorhanden)).toEqual([{ teil: 'codes', id: 'codes' }])
    expect(druckdateiFolge({ teile: { ...teile, codes: false } }, vorhanden)).toEqual([])
    expect(druckdateiFolge(DRUCKDATEI_WAHL, { starter: [], pokal: [], ergebnis: [] })).toEqual([{ teil: 'codes', id: 'codes' }])
  })

  it('eine gemerkte Auswahl gilt nur in der heutigen Form', () => {
    expect(istDruckdateiWahl(DRUCKDATEI_WAHL)).toBe(true)
    expect(istDruckdateiWahl({ ...DRUCKDATEI_WAHL, fassung: 'aushang' })).toBe(false)
    expect(istDruckdateiWahl({ ...DRUCKDATEI_WAHL, teile: { starter: true } })).toBe(false)
    expect(istDruckdateiWahl({ ...DRUCKDATEI_WAHL, umfang: 'laeufe' })).toBe(false)
    expect(istDruckdateiWahl({ ...DRUCKDATEI_WAHL, ohneKlassen: [1] })).toBe(false)
    expect(istDruckdateiWahl(null)).toBe(false)
    // Die Vorgabe ist jedes Mal ein eigenes Objekt: Eine Änderung an der Auswahl trifft sie nicht.
    expect(druckdateiVorgabe().teile).not.toBe(druckdateiVorgabe().teile)
  })
})
