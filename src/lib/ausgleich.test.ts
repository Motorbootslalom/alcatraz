import { describe, expect, it } from 'vitest'
import { ausgleichAmSteg, ausgleichListen, ausgleichVon, type AusgleichStand } from './ausgleich'
import type { ClassId, Starter } from '../types'

// Ausgleichsgewichte für den Steg. Alle Starter sind erfunden.

const starter = (klasse: ClassId, nr: string, gewicht?: number): Starter => ({
  id: `id-${nr}`,
  startNr: nr,
  vorname: `Vor${nr}`,
  nachname: `Nach${nr}`,
  verein: 'Musterclub',
  bundesland: '',
  geburtsdatum: '2014-05-01',
  groesse: '',
  klasse,
  ...(gewicht === undefined ? {} : { gewicht }),
})

const stand = (mehr: Partial<AusgleichStand> = {}): AusgleichStand => ({
  regelwerk: 'dm-2026',
  sollgewicht: {},
  boote: {},
  coPiloten: {},
  // Absichtlich ungeordnet: Die Liste ordnet nach Startnummer.
  starters: [starter('4', '403', 65), starter('4', '401', 58.4), starter('E', 'E02'), starter('4', '402', 70), starter('E', 'E01', 20.5), starter('4', '404', 64.6)],
  ...mehr,
})

describe('Ausgleichsgewichte für den Steg', () => {
  it('je Klasse mit Startern eine Liste in der Reihenfolge der Klassen, nach Startnummer', () => {
    const listen = ausgleichListen(stand())
    expect(listen.map((l) => l.klasse)).toEqual(['E', '4'])
    expect(listen[1].zeilen.map((z) => z.starter.startNr)).toEqual(['401', '402', '403', '404'])
    expect(listen[0].soll).toBe(26)
    expect(listen[1].soll).toBe(65)
  })

  it('rechnet wie die Verwiegung: Durchschnittsgewicht minus Gewicht, auf ganze kg; nichts, wenn nicht leichter', () => {
    const [e, vier] = ausgleichListen(stand())
    // 65 − 58,4 = 6,6 → 7; 70 ≥ 65 → keines; 65 = 65 → keines; 65 − 64,6 = 0,4 → 0 (gerundet, wie die Mappe: ROUND).
    expect(vier.zeilen.map((z) => z.ausgleich)).toEqual([7, null, null, 0])
    // 26 − 20,5 = 5,5 → 6 (ab ,5 aufgerundet); nicht gewogen ist etwas anderes als „keines nötig“.
    expect(e.zeilen.map((z) => z.ausgleich)).toEqual([6, undefined])
    expect(e.ungewogen).toBe(1)
    expect(vier.ungewogen).toBe(0)
  })

  it('eigene Durchschnittsgewichte der Veranstaltung und die des Regelwerks gelten', () => {
    expect(ausgleichListen(stand({ sollgewicht: { '4': 68 } }), ['4'])[0].zeilen.map((z) => z.ausgleich)).toEqual([10, null, 3, 3])
    // UIM: Klasse 4 = 64 kg.
    expect(ausgleichListen(stand({ regelwerk: 'uim-2026' }), ['4'])[0].zeilen.map((z) => z.ausgleich)).toEqual([6, null, null, null])
  })

  it('Boot und Co-Pilot kommen aus der Besetzung; den Co-Piloten gibt es nur, wo er vorgesehen oder eingetragen ist', () => {
    const [e, vier] = ausgleichListen(stand({ boote: { '4': ' Boot 1 ' }, coPiloten: { E: 'Erika Beispiel' } }))
    expect(e.boot).toBe('')
    expect(e.coPilot).toBe('Erika Beispiel')
    expect(vier.boot).toBe('Boot 1')
    expect(vier.coPilot).toBeUndefined()
    // Vorgesehen, aber noch niemand eingetragen: Das Feld bleibt zum Ausfüllen von Hand.
    expect(ausgleichListen(stand(), ['E'])[0].coPilot).toBe('')
    expect(ausgleichListen(stand({ coPiloten: { '4': 'Max Muster' } }), ['4'])[0].coPilot).toBe('Max Muster')
  })

  it('die Auswahl schränkt ein; eine Klasse ohne Starter hat kein Blatt', () => {
    expect(ausgleichListen(stand(), ['4']).map((l) => l.klasse)).toEqual(['4'])
    expect(ausgleichListen(stand(), ['2'])).toEqual([])
    expect(ausgleichListen(stand({ starters: [] }))).toEqual([])
  })
})

describe('Ausgleichsgewicht je Starter – eine Rechnung für Papier und Steg-Gerät (Nutzer 24.11.2026, WKR_ANNAHMEN AG2)', () => {
  it('ausgleichVon rechnet wie die Liste; ausgleichAmSteg: 0 statt „keines“, „fehlt“ statt „nicht gewogen“', () => {
    const st = stand()
    for (const z of ausgleichListen(st).flatMap((l) => l.zeilen)) expect(ausgleichVon(st, z.starter), z.starter.startNr).toBe(z.ausgleich)
    const am = (klasse: ClassId, gewicht?: number) => ausgleichAmSteg(st, { klasse, ...(gewicht === undefined ? {} : { gewicht }) })
    expect([am('4', 58.4), am('4', 70), am('4', 65), am('4', 64.6), am('E', 20.5), am('E')]).toEqual([7, 0, 0, 0, 6, 'fehlt'])
  })

  it('ohne Durchschnittsgewicht der Klasse (eigener Wert 0) steht am Steg nichts – auch nicht „fehlt“', () => {
    const st = stand({ sollgewicht: { '4': 0 } })
    expect([ausgleichAmSteg(st, { klasse: '4', gewicht: 50 }), ausgleichAmSteg(st, { klasse: '4' })]).toEqual([null, null])
    expect(ausgleichAmSteg(st, { klasse: 'E', gewicht: 20.5 })).toBe(6)
  })
})
