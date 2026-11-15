import { describe, expect, it } from 'vitest'
import { druckdateiFolge, druckdateiVorgabe, istDruckdateiWahl, teilGewaehlt } from './druckdatei'

const DRUCKDATEI_WAHL = druckdateiVorgabe()

describe('Druckdatei: Folge der Dokumente', () => {
  const vorhanden = { starter: ['p1', 'p2'], pokal: ['plaetze6', 'uim'] as const, ergebnis: ['E/1/platz', 'E/gesamt/platz', '1/gesamt/platz'] }

  it('Starterliste, Mannschaftswertung (UIM vor Plätzen), Codes, Wertungslisten – wie in der Vorlage', () => {
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
    const teile = { starter: false, pokal: false, einzel: false, codes: true, ergebnis: false, parallel: false }
    expect(druckdateiFolge({ teile }, vorhanden)).toEqual([{ teil: 'codes', id: 'codes' }])
    expect(druckdateiFolge({ teile: { ...teile, codes: false } }, vorhanden)).toEqual([])
    expect(druckdateiFolge(DRUCKDATEI_WAHL, { starter: [], pokal: [], ergebnis: [] })).toEqual([{ teil: 'codes', id: 'codes' }])
  })

  it('die Wertungslisten des Parallelslaloms stehen hinter denen des Manövrierens – und nur, wenn es sie gibt', () => {
    const mit = { ...vorhanden, parallel: ['parallel:pre/1/attempts/platz', 'parallel:pre/1/result/platz'] }
    expect(druckdateiFolge(DRUCKDATEI_WAHL, mit).map((d) => `${d.teil}:${d.id}`).slice(-3)).toEqual([
      'ergebnis:1/gesamt/platz',
      'parallel:parallel:pre/1/attempts/platz',
      'parallel:parallel:pre/1/result/platz',
    ])
    expect(druckdateiFolge({ teile: { ...DRUCKDATEI_WAHL.teile, parallel: false } }, mit).some((d) => d.teil === 'parallel')).toBe(false)
    // Ohne Parallelslalom (DM) ändert der neue Teil nichts an der Folge.
    expect(druckdateiFolge(DRUCKDATEI_WAHL, vorhanden).some((d) => d.teil === 'parallel')).toBe(false)
  })

  it('die Einzelwertung über beide Stages steht hinter der Mannschaftswertung – und nur, wenn es sie gibt', () => {
    const mit = { ...vorhanden, einzel: ['einzel/E', 'einzel/1'] }
    expect(druckdateiFolge(DRUCKDATEI_WAHL, mit).map((d) => `${d.teil}:${d.id}`).slice(2, 7)).toEqual(['pokal:uim', 'pokal:plaetze6', 'einzel:einzel/E', 'einzel:einzel/1', 'codes:codes'])
    expect(druckdateiFolge({ teile: { ...DRUCKDATEI_WAHL.teile, einzel: false } }, mit).some((d) => d.teil === 'einzel')).toBe(false)
    // Ohne gewerteten Parallelslalom (und unter der DM) ändert der neue Teil nichts an der Folge.
    expect(druckdateiFolge(DRUCKDATEI_WAHL, vorhanden).some((d) => d.teil === 'einzel')).toBe(false)
  })

  it('Ordnung nach Regel 960: Mannschaftswertung, Codes, Einzelwertung, dann je Disziplin – vor jeder Runde ihre Startliste', () => {
    const mit = {
      ...vorhanden,
      einzel: ['einzel/1'],
      parallelAbschnitte: [
        { gruppe: 'stage', ids: ['stage/1'] },
        { gruppe: 'pre', startliste: 'pre', ids: ['pre/1/attempts', 'pre/1/result'] },
        { gruppe: 'semi', startliste: 'semi', ids: [] },
        { gruppe: 'final', startliste: 'final', ids: ['final/1/result'] },
      ],
    }
    const folge = (wahl = DRUCKDATEI_WAHL, v: Parameters<typeof druckdateiFolge>[1] = mit) => druckdateiFolge(wahl, v, 'regel960').map((d) => `${d.teil}:${d.id}`)
    expect(folge()).toEqual([
      'pokal:uim',
      'pokal:plaetze6',
      'codes:codes',
      'einzel:einzel/1',
      // Die verzahnte Starterliste steht vor den Wertungslisten des Manövrierens.
      'starter:p1',
      'starter:p2',
      'ergebnis:E/1/platz',
      'ergebnis:E/gesamt/platz',
      'ergebnis:1/gesamt/platz',
      'parallel:stage/1',
      'startliste:pre',
      'parallel:pre/1/attempts',
      'parallel:pre/1/result',
      // Eine Runde ohne Listen (alle Klassen abgewählt) bekommt auch keine Startliste.
      'startliste:final',
      'parallel:final/1/result',
    ])
    // Die Startlisten kommen und gehen mit dem Teil „Parallelslalom“.
    expect(folge({ ...DRUCKDATEI_WAHL, teile: { ...DRUCKDATEI_WAHL.teile, parallel: false } }).some((d) => d.startsWith('startliste:') || d.startsWith('parallel:'))).toBe(false)
    // Ist nur der Parallelslalom gefahren, entfällt die Starterliste des Manövrierens.
    expect(folge(DRUCKDATEI_WAHL, { ...mit, ergebnis: [] }).some((d) => d.startsWith('starter:'))).toBe(false)
    // Vor dem ersten Wert steht sie da.
    expect(folge(DRUCKDATEI_WAHL, { ...vorhanden, ergebnis: [] })).toEqual(['pokal:uim', 'pokal:plaetze6', 'codes:codes', 'starter:p1', 'starter:p2'])
    // Die Datei der DM bleibt, wie sie ist: ohne die Angabe gilt deren Ordnung.
    expect(druckdateiFolge(DRUCKDATEI_WAHL, mit)[0]).toEqual({ teil: 'starter', id: 'p1' })
  })

  it('eine Auswahl aus der Zeit vor dem Teil „Einzelwertung“ bleibt gültig; der Teil gilt dann als gewählt', () => {
    const { einzel: _, ...alt } = DRUCKDATEI_WAHL.teile
    const wahl = { ...DRUCKDATEI_WAHL, teile: { ...alt, starter: false } }
    expect(istDruckdateiWahl(wahl)).toBe(true)
    expect(teilGewaehlt(wahl as never, 'einzel')).toBe(true)
    expect(teilGewaehlt(wahl as never, 'starter')).toBe(false)
    expect(druckdateiFolge(wahl as never, { ...vorhanden, einzel: ['einzel/1'] }).map((d) => d.teil)).toContain('einzel')
  })

  it('eine gemerkte Auswahl gilt nur in der heutigen Form', () => {
    expect(istDruckdateiWahl(DRUCKDATEI_WAHL)).toBe(true)
    expect(istDruckdateiWahl({ ...DRUCKDATEI_WAHL, fassung: 'aushang' })).toBe(false)
    expect(istDruckdateiWahl({ ...DRUCKDATEI_WAHL, teile: { starter: true } })).toBe(false)
    expect(istDruckdateiWahl({ ...DRUCKDATEI_WAHL, umfang: 'laeufe' })).toBe(false)
    expect(istDruckdateiWahl({ ...DRUCKDATEI_WAHL, ohneKlassen: [1] })).toBe(false)
    expect(istDruckdateiWahl({ ...DRUCKDATEI_WAHL, ansicht: 'racecourse' })).toBe(true)
    expect(istDruckdateiWahl({ ...DRUCKDATEI_WAHL, ansicht: 'klasse' })).toBe(false)
    // Eine Auswahl aus der Zeit vor dem Teil „Parallelslalom“ gilt nicht mehr: Dann greift die Vorgabe.
    expect(istDruckdateiWahl({ ...DRUCKDATEI_WAHL, teile: { starter: true, pokal: true, codes: true, ergebnis: true } })).toBe(false)
    expect(istDruckdateiWahl(null)).toBe(false)
    // Die Vorgabe ist jedes Mal ein eigenes Objekt: Eine Änderung an der Auswahl trifft sie nicht.
    expect(druckdateiVorgabe().teile).not.toBe(druckdateiVorgabe().teile)
  })
})
