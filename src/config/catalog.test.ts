import { describe, expect, it } from 'vitest'
import { AUFBAUTEN, DEFAULT_AUFBAU, DEFAULT_REGELWERK, MANOEVER_AUFBAUTEN, REGELWERKE, STARTABSTAENDE, codeKlassenOf, hasParallel, regelwerkOf, sollgewichtOf, startabstandOf, startabstandVorgabe, startNrPraefixe } from './catalog'

describe('Regelwerke und Aufbauten', () => {
  it('liest die Regelwerke in Menü-Reihenfolge', () => {
    expect(REGELWERKE.map((r) => r.id)).toEqual(['dm-2026', 'uim-2026'])
    expect(REGELWERKE.map((r) => r.label)).toEqual(['DM 2026', 'UIM 2026'])
    expect(DEFAULT_REGELWERK).toBe('dm-2026')
  })

  it('UIM fährt nur bis Klasse 5 und nennt E „Dolphin“', () => {
    const uim = regelwerkOf('uim-2026')
    expect(uim.klassen).toEqual(['E', '1', '2', '3', '4', '5'])
    expect(uim.klassenNamen.E).toBe('Dolphin')
    expect(regelwerkOf('dm-2026').klassen).toHaveLength(8)
  })

  it('der Name der Klasse E kommt aus dem Regelwerk: unter UIM „Dolphin“ (Kurzzeichen „D“), unter DM keiner – also „Klasse E“, nicht „ME“', () => {
    const uim = regelwerkOf('uim-2026')
    const dm = regelwerkOf('dm-2026')
    expect(uim.klassenNamen).toEqual({ E: 'Dolphin' })
    expect(uim.klassenKurz).toEqual({ E: 'D' })
    expect(dm.klassenNamen).toEqual({})
    expect(dm.klassenKurz).toEqual({})
    expect(JSON.stringify([dm.klassenNamen, dm.klassenKurz, dm.startNrPraefix])).not.toContain('ME')
  })

  it('der Buchstabe der Startnummern steht im Regelwerk: E01 – auch unter UIM, wo die Klasse „Dolphin“ heißt', () => {
    expect(regelwerkOf('uim-2026').startNrPraefix).toEqual({ E: 'E' })
    expect(regelwerkOf('dm-2026').startNrPraefix).toEqual({ E: 'E' })
  })

  it('der gewählte Buchstabe der Klasse E (E oder D) gilt seit 24.11.2026 unter jedem Regelwerk, auch DM', () => {
    expect(startNrPraefixe({ regelwerk: 'dm-2026', dolphinPraefix: 'D' })).toEqual({ E: 'D' })
    expect(startNrPraefixe({ regelwerk: 'uim-2026', dolphinPraefix: 'D' })).toEqual({ E: 'D' })
    expect(startNrPraefixe({ regelwerk: 'dm-2026', dolphinPraefix: 'E' })).toEqual({ E: 'E' })
    expect(startNrPraefixe({ regelwerk: 'dm-2026' })).toEqual({ E: 'E' })
  })

  it('Geburtstags-Grenzen (DM-Reglement C8, 24.11.2026): nur die DM nennt sie – E ab dem 6., 7 bis zum 27.', () => {
    expect(regelwerkOf('dm-2026').geburtstagsGrenzen).toEqual({ E: { ab: 6 }, '7': { bis: 27 } })
    expect(regelwerkOf('uim-2026').geburtstagsGrenzen).toEqual({})
  })

  it('Parallelslalom gibt es nur nach den Regeln der UIM', () => {
    expect(hasParallel('dm-2026')).toBe(false)
    expect(hasParallel('uim-2026')).toBe(true)
  })

  it('zur Wahl stehen nur Aufbauten für das Manövrieren', () => {
    expect(DEFAULT_AUFBAU).toBe('alcatraz')
    expect(MANOEVER_AUFBAUTEN.map((a) => a.id)).toEqual(['alcatraz', 'alcatrazdm26', 'frontal', 'berlin', 'bawue', 'moewe'])
    expect(AUFBAUTEN.find((a) => a.id === 'parallel')?.disziplin).toBe('parallel')
  })

  it('nennt die Durchschnittsgewichte des Regelwerks – DM und UIM unterscheiden sich', () => {
    expect(regelwerkOf('dm-2026').gewichte).toEqual({ E: 26, '1': 33, '2': 42, '3': 52, '4': 65, '5': 72, '6': 75, '7': 78 })
    expect(regelwerkOf('uim-2026').gewichte).toEqual({ E: 26, '1': 32, '2': 40, '3': 52, '4': 64, '5': 71 })
    expect(sollgewichtOf('uim-2026', {}, '2')).toBe(40)
    expect(sollgewichtOf('uim-2026', { '2': 41 }, '2')).toBe(41)
    expect(sollgewichtOf('uim-2026', {}, '7')).toBe(0)
  })

  it('Startabstände: eigener Wert, sonst Regelwerk (je Klasse), sonst einstellungen.yaml – aufgelöst beim Lesen', () => {
    // Die allgemeinen Werte (DM 2025, gerundet); weder DM noch UIM nennen bisher eigene.
    expect(STARTABSTAENDE).toEqual({ E: 120, '1': 110, '2': 115, '3': 120, '4': 120, '5': 135, '6': 135, '7': 140 })
    expect([regelwerkOf('dm-2026').startabstaende, regelwerkOf('uim-2026').startabstaende]).toEqual([{}, {}])
    const stand = (abstaende: Partial<Record<string, number>> = {}) => ({ regelwerk: 'uim-2026', anzeige: { abstaende } })
    expect([startabstandOf(stand(), 'E'), startabstandOf(stand({ E: 95 }), 'E'), startabstandOf(stand({ E: 95 }), '1')]).toEqual([120, 95, 110])
    // Ein Regelwerk mit eigenem Wert ersetzt nur seine Klasse (hier nachgestellt; die Testdatei hat ihre eigenen Module).
    const uim = regelwerkOf('uim-2026')
    const vorher = uim.startabstaende
    try {
      uim.startabstaende = { E: 150 }
      expect([startabstandVorgabe('uim-2026', 'E'), startabstandVorgabe('uim-2026', '1'), startabstandVorgabe('dm-2026', 'E')]).toEqual([150, 110, 120])
      expect(startabstandOf(stand({ E: 95 }), 'E')).toBe(95)
    } finally {
      uim.startabstaende = vorher
    }
  })

  it('unbekannte Kennungen fallen auf die Vorgabe zurück', () => {
    expect(regelwerkOf('gibt-es-nicht').id).toBe('dm-2026')
  })

  it('Klassen je Fehler-Code (W3-07, 21.11.2026): DM aus „ab Klasse 3“/„erst ab Klasse 4“, UIM ohne', () => {
    const dm = codeKlassenOf('dm-2026')
    expect(dm['4']).toEqual(['3', '4', '5', '6', '7'])
    expect(dm['23']).toEqual(['3', '4', '5', '6', '7'])
    for (const c of ['2', '5', '10', '16']) expect(dm[c]).toEqual(['4', '5', '6', '7'])
    expect(Object.keys(dm).sort()).toEqual(['10', '16', '2', '23', '4', '5'])
    expect(codeKlassenOf('uim-2026')).toEqual({})
  })
})
