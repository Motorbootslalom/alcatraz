import { describe, expect, it } from 'vitest'
import { ausgleichAmSteg, ausgleichListen, ausgleichVon, coPilotAusgleichVon, coPilotZeilen, type AusgleichStand } from './ausgleich'
import type { AppState, ClassId, Starter } from '../types'
import { emptyState, reducer } from '../state/reducer'
import { migrate } from '../state/migrate'
import { makeFile, parseFile } from '../persistenz/backup'
import { teamListen } from './teamListe'
import { configFor } from '../config/konfig'
import { sichtListe } from '../wkr/sicht'
import { listenKennung, type Liste } from '../wkr/liste'
import { BETRIEB_STARTER, wkrBetriebsStand, zeigeNaechsten } from '../testHilfen'
import { setzeCoPilotGewicht, setzeCoPilotName } from './besetzung'

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
  ausgleichStufe: 1,
  boote: {},
  coPiloten: {},
  coPilotAusgleich: 'klasse',
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
    const [e, vier] = ausgleichListen(stand({ boote: { '4': ' Boot 1 ' }, coPiloten: { E: { haupt: { name: 'Erika Beispiel' } } } }))
    expect(e.boot).toBe('')
    expect(e.coPiloten).toEqual([{ rolle: 'haupt', name: 'Erika Beispiel', ausgleich: undefined }])
    expect(vier.boot).toBe('Boot 1')
    expect(vier.coPiloten).toBeUndefined()
    // Vorgesehen, aber noch niemand eingetragen: Das Feld bleibt zum Ausfüllen von Hand.
    expect(ausgleichListen(stand(), ['E'])[0].coPiloten).toEqual([{ rolle: 'haupt', name: '', ausgleich: undefined }])
    expect(ausgleichListen(stand({ coPiloten: { '4': { haupt: { name: 'Max Muster' } } } }), ['4'])[0].coPiloten?.map((c) => c.name)).toEqual(['Max Muster'])
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

describe('Abstufung des Ausgleichsgewichts (Nutzer 24.11.2026: „wie kleinteilig die Zusatzgewichte sind“)', () => {
  it('Vorgabe 1 kg = wie vorher; jede Stelle rundet über dieselbe Rechnung auf die Stufe, ab der Hälfte aufwärts', () => {
    expect(emptyState().ausgleichStufe).toBe(1)
    // Klasse 4 (65 kg): 58,4 → 6,6 kg leichter; 64,6 → 0,4; Klasse E (26 kg): 20,5 → 5,5.
    const mit = (ausgleichStufe: number) => ausgleichListen(stand({ ausgleichStufe })).flatMap((l) => l.zeilen.map((z) => z.ausgleich))
    expect(mit(1)).toEqual([6, undefined, 7, null, null, 0])
    expect(mit(2)).toEqual([6, undefined, 6, null, null, 0])
    expect(mit(0.5)).toEqual([5.5, undefined, 6.5, null, null, 0.5])
    expect(mit(0.1)).toEqual([5.5, undefined, 6.6, null, null, 0.4])
    expect(mit(5)).toEqual([5, undefined, 5, null, null, 0])
    // Am Steg dieselbe Zahl; ohne Stufe (nur die Übung auf dem Gerät hat keinen Stand) gilt die Vorgabe.
    const st = stand({ ausgleichStufe: 0.5 })
    expect([ausgleichAmSteg(st, { klasse: '4', gewicht: 58.4 }), ausgleichAmSteg(st, { klasse: '4', gewicht: 64.6 }), ausgleichAmSteg(st, { klasse: '4' })]).toEqual([6.5, 0.5, 'fehlt'])
    expect(ausgleichVon({ regelwerk: 'dm-2026', sollgewicht: {} }, { klasse: '4', gewicht: 58.4 })).toBe(7)
  })

  it('Einstellung: SET_AUSGLEICH_STUFE nimmt 0,1–10 kg (auf 10 g), sonst bleibt der Stand derselbe', () => {
    const leer = emptyState()
    const halb = reducer(leer, { type: 'SET_AUSGLEICH_STUFE', kg: 0.5 })
    expect(halb.ausgleichStufe).toBe(0.5)
    expect(reducer(halb, { type: 'SET_AUSGLEICH_STUFE', kg: 0.5 })).toBe(halb)
    for (const kg of [0, -2, 0.05, 10.01, 12, NaN, Infinity]) expect(reducer(halb, { type: 'SET_AUSGLEICH_STUFE', kg }), String(kg)).toBe(halb)
    expect(reducer(halb, { type: 'SET_AUSGLEICH_STUFE', kg: 0.254 }).ausgleichStufe).toBe(0.25)
    expect(reducer(halb, { type: 'SET_AUSGLEICH_STUFE', kg: 10 }).ausgleichStufe).toBe(10)
  })

  it('migrate: fehlt oder unbrauchbar → 1 kg (ganze kg wie vorher), sonst bleibt sie', () => {
    const roh = (ausgleichStufe: unknown) => {
      const { ausgleichStufe: _weg, ...rest } = emptyState()
      return ausgleichStufe === undefined ? rest : { ...rest, ausgleichStufe }
    }
    expect(migrate(roh(undefined))!.ausgleichStufe).toBe(1)
    for (const kaputt of ['2', null, 0, -1, 50, {}]) expect(migrate(roh(kaputt))!.ausgleichStufe, JSON.stringify(kaputt)).toBe(1)
    expect(migrate(roh(2))!.ausgleichStufe).toBe(2)
    expect(migrate(roh(0.25))!.ausgleichStufe).toBe(0.25)
  })

  it('reist als Einstellung mit Sicherung und Vorlage (wie die Durchschnittsgewichte)', () => {
    const quelle = reducer(reducer(emptyState(), { type: 'SET_AUSGLEICH_STUFE', kg: 2 }), { type: 'SET_SOLLGEWICHT', klasse: '4', kg: 66 })
    const vorlage = makeFile('vorlage', quelle, '2026-11-24T00:00:00.000Z')
    expect(vorlage.kind === 'vorlage' && vorlage.settings).toMatchObject({ ausgleichStufe: 2, sollgewicht: { '4': 66 } })
    const gelesen = parseFile(JSON.stringify(vorlage))
    expect(gelesen.ok && gelesen.kind === 'vorlage' && gelesen.apply(emptyState()).ausgleichStufe).toBe(2)
    const sicherung = parseFile(JSON.stringify(makeFile('sicherung', quelle, '2026-11-24T00:00:00.000Z')))
    expect(sicherung.ok && sicherung.kind === 'sicherung' && sicherung.state.ausgleichStufe).toBe(2)
  })

  it('die Liste nach Regel 960 Pkt. 3.7 rechnet dieselbe Zahl', () => {
    const starter = stand().starters
    const uim: AppState = { ...emptyState(), regelwerk: 'uim-2026', originMode: 'verein', starters: starter, ausgleichStufe: 0.5 }
    const zeilen = teamListen(uim).flatMap((l) => l.zeilen)
    // UIM Klasse 4 = 64 kg: 58,4 → 5,6 kg leichter → 5,5 bei 0,5 kg; jede Zeile wie ausgleichVon.
    for (const z of zeilen) expect(z.ausgleich, z.starter.startNr).toBe(ausgleichVon(uim, z.starter))
    expect(zeilen.find((z) => z.starter.startNr === '401')?.ausgleich).toBe(5.5)
  })

  it('Steg-Gerät: die Sicht trägt die gerundete Zahl, mit Stufe 0,5 kg auch mit Nachkommastelle – nie ein Gewicht', () => {
    const DM = configFor({ regelwerk: 'dm-2026' })
    const STEG: Liste = { bereich: 'par_1', typeId: 'steg', racecourse: null }
    // Klasse 1 (DM 33 kg): k1 31,5 kg → 1,5; k2 32,6 → 0,4. Klasse E (26 kg): e1 24 → 2.
    const kg: Record<string, number> = { e1: 24, k1: 31.5, k2: 32.6 }
    const basis = (ausgleichStufe: number) => {
      let s = wkrBetriebsStand(BETRIEB_STARTER.map((p) => (p.id in kg ? { ...p, gewicht: kg[p.id] } : p)))
      s = reducer(s, { type: 'SET_AUSGLEICH_STUFE', kg: ausgleichStufe })
      s = reducer(s, { type: 'WKR_LISTE', liste: listenKennung(STEG), modus: 'digital', zeit: 100 })
      return zeigeNaechsten(zeigeNaechsten(s, 'par_1', 1000), 'par_1', 1100)
    }
    const werte = (ausgleichStufe: number) => {
      const sicht = sichtListe(basis(ausgleichStufe), DM, STEG, { geraete: {} })
      return Object.fromEntries([...sicht.schlange, ...sicht.danach].filter((x) => ['E01', '101', '102'].includes(x.startNr)).map((x) => [x.startNr, x.ausgleich]))
    }
    expect(werte(1)).toEqual({ E01: 2, '101': 2, '102': 0 })
    expect(werte(0.5)).toEqual({ E01: 2, '101': 1.5, '102': 0.5 })
    expect(werte(2)).toEqual({ E01: 2, '101': 2, '102': 0 })
    const text = JSON.stringify(sichtListe(basis(0.5), DM, STEG, { geraete: {} }))
    for (const verboten of ['31.5', '32.6', '"gewicht"']) expect(text, verboten).not.toContain(verboten)
  })
})

// Co-Piloten mit Ersatz und Gewicht (Antwort des Nutzers vom 26.11.2026, R11-07; DM-Reglement C3: „Bei wechselnden
// Co-Piloten innerhalb einer Klasse ist durch Ausgleichsgewichte sicherzustellen, dass das Gesamtgewicht in der
// jeweiligen Klasse und jedem Lauf gleich ist.“). Namen und Gewichte erfunden.
describe('Ausgleichsgewicht der Co-Piloten (R11-07)', () => {
  const co = (name: string, gewicht?: number) => ({ name, ...(gewicht === undefined ? {} : { gewicht }) })
  const mit = (coPiloten: AusgleichStand['coPiloten'], mehr: Partial<AusgleichStand> = {}) => stand({ coPiloten, ...mehr })

  it('je Klasse: der schwerste Co-Pilot der Klasse ist der Bezug, der leichtere bekommt den Unterschied – gerundet wie beim Fahrer', () => {
    const s = mit({ E: { haupt: co('Vor1 Nach1', 78.2), ersatz: co('Vor2 Nach2', 74.6) }, '1': { haupt: co('Vor3 Nach3', 90) } })
    expect(coPilotAusgleichVon(s, 'E', 'haupt')).toBeNull()
    // 78,2 − 74,6 = 3,6 → 4 kg (Stufe 1 kg, ab der Hälfte aufwärts).
    expect(coPilotAusgleichVon(s, 'E', 'ersatz')).toBe(4)
    // Klasse 1 allein: kein Ausgleich – die schwerere Klasse 1 zählt für E nicht.
    expect(coPilotAusgleichVon(s, '1', 'haupt')).toBeNull()
    // Dieselbe Abstufung wie beim Fahrer: 0,5 kg → 3,5 kg; 2 kg → 4 kg.
    expect(coPilotAusgleichVon({ ...s, ausgleichStufe: 0.5 }, 'E', 'ersatz')).toBe(3.5)
    expect(coPilotAusgleichVon({ ...s, ausgleichStufe: 2 }, 'E', 'ersatz')).toBe(4)
    // Weniger als eine halbe Stufe leichter: 0 (gedruckt wie „keines“).
    expect(coPilotAusgleichVon(mit({ E: { haupt: co('A', 70.4), ersatz: co('B', 70) } }), 'E', 'ersatz')).toBe(0)
  })

  it('über alle Co-Piloten: der schwerste der fahrenden Klassen ist der Bezug – auch für den eingeteilten Co-Piloten', () => {
    const mitKlasse1 = [...stand().starters, starter('1', '101', 50)]
    const s = mit({ E: { haupt: co('Vor1 Nach1', 78.2), ersatz: co('Vor2 Nach2', 74.6) }, '1': { haupt: co('Vor3 Nach3', 90) } }, { coPilotAusgleich: 'alle', starters: mitKlasse1 })
    expect(coPilotAusgleichVon(s, '1', 'haupt')).toBeNull()
    expect(coPilotAusgleichVon(s, 'E', 'haupt')).toBe(12)
    expect(coPilotAusgleichVon(s, 'E', 'ersatz')).toBe(15)
    // Nur Klassen der Veranstaltung (Regelwerk oder Starter) zählen: Klasse 7 gibt es unter UIM nicht.
    const uim = mit({ E: { haupt: co('Vor1 Nach1', 78) }, '7': { haupt: co('Vor9 Nach9', 120) } }, { coPilotAusgleich: 'alle', regelwerk: 'uim-2026' })
    expect(coPilotAusgleichVon(uim, 'E', 'haupt')).toBeNull()
  })

  it('über alle: eine Klasse ohne Starter zieht den Bezug nicht hoch; ohne jeden Starter gelten alle Klassen (Prüfbefund 27.11.2026)', () => {
    // Starter nur in Klasse E; „Beispiel-Co-Piloten“ füllen auch Klasse 3 (ohne Starter) mit 95 kg.
    const nurE = [starter('E', 'E01', 20.5)]
    const s = mit({ E: { haupt: co('Vor1 Nach1', 70) }, '3': { haupt: co('Vor5 Nach5', 95) } }, { coPilotAusgleich: 'alle', starters: nurE })
    expect(coPilotAusgleichVon(s, 'E', 'haupt')).toBeNull()
    expect(ausgleichListen(s, ['E'])[0].coPiloten).toEqual([{ rolle: 'haupt', name: 'Vor1 Nach1', ausgleich: null }])
    // Die eigene Klasse zählt immer mit: Der Block „Besetzung“ zeigt für Klasse 3 den Wert gegen E und 3.
    expect(coPilotAusgleichVon(s, '3', 'haupt')).toBeNull()
    expect(coPilotAusgleichVon({ ...s, coPiloten: { ...s.coPiloten, '3': { haupt: co('Vor5 Nach5', 60) } } }, '3', 'haupt')).toBe(10)
    // Sobald in Klasse 3 jemand startet, zählt sie: 95 − 70 = 25 kg.
    expect(coPilotAusgleichVon({ ...s, starters: [...nurE, starter('3', '301', 60)] }, 'E', 'haupt')).toBe(25)
    // Noch gar kein Starter: alle Klassen der Besetzung (Vorschau beim Eintragen).
    expect(coPilotAusgleichVon({ ...s, starters: [] }, 'E', 'haupt')).toBe(25)
  })

  it('ein Gewicht ohne Namen zählt nicht – weder als Bezug noch auf der Liste (Prüfbefund 27.11.2026)', () => {
    // Der Ersatz fällt weg, sein Name wird gelöscht; das Gewicht bleibt im Stand (setzeCoPilotName), zählt aber nicht.
    let c = setzeCoPilotName({}, 'E', 'haupt', 'Vor1 Nach1')
    c = setzeCoPilotGewicht(c, 'E', 'haupt', 70)
    c = setzeCoPilotName(c, 'E', 'ersatz', 'Vor2 Nach2')
    c = setzeCoPilotGewicht(c, 'E', 'ersatz', 80)
    expect(coPilotAusgleichVon(mit(c), 'E', 'haupt')).toBe(10)
    c = setzeCoPilotName(c, 'E', 'ersatz', '')
    expect(c.E?.ersatz).toEqual({ name: '', gewicht: 80 })
    // Der eingeteilte ist allein und damit der schwerste: keines nötig (nicht 10 kg gegen niemanden).
    expect(coPilotAusgleichVon(mit(c), 'E', 'haupt')).toBeNull()
    expect(coPilotAusgleichVon(mit(c), 'E', 'ersatz')).toBeUndefined()
    // Kein leeres Feld „Ersatz-Co-Pilot“ auf der Liste.
    expect(coPilotZeilen(mit(c), 'E')).toEqual([{ rolle: 'haupt', name: 'Vor1 Nach1', ausgleich: null }])
    // Neu getippt, zählt das Gewicht wieder.
    expect(coPilotAusgleichVon(mit(setzeCoPilotName(c, 'E', 'ersatz', 'Vor3 Nach3')), 'E', 'haupt')).toBe(10)
    // Auch beim eingeteilten: ohne Namen kein Bezug; seine Zeile bleibt (leer, zum Eintragen von Hand).
    const ohneHaupt = mit({ E: { haupt: co('', 90), ersatz: co('Vor2 Nach2', 80) } })
    expect(coPilotAusgleichVon(ohneHaupt, 'E', 'ersatz')).toBeNull()
    expect(coPilotZeilen(ohneHaupt, 'E')).toEqual([
      { rolle: 'haupt', name: '', ausgleich: undefined },
      { rolle: 'ersatz', name: 'Vor2 Nach2', ausgleich: null },
    ])
  })

  it('ohne Gewicht: „fehlt“ nur, wenn andere der Gruppe gewogen sind; sonst nichts – und der Fahrer bleibt unberührt', () => {
    const s = mit({ E: { haupt: co('Vor1 Nach1', 78), ersatz: co('Vor2 Nach2') }, '1': { haupt: co('Vor3 Nach3') } })
    expect(coPilotAusgleichVon(s, 'E', 'ersatz')).toBe('fehlt')
    expect(coPilotAusgleichVon(s, 'E', 'haupt')).toBeNull()
    expect(coPilotAusgleichVon(s, '1', 'haupt')).toBeUndefined()
    expect(coPilotAusgleichVon(s, '1', 'ersatz')).toBeUndefined()
    expect(coPilotAusgleichVon({ ...s, coPilotAusgleich: 'alle' }, '1', 'haupt')).toBe('fehlt')
    // Der Ausgleich des Fahrers rechnet weiter gegen das Durchschnittsgewicht (26 kg in Klasse E).
    expect(ausgleichListen(s, ['E'])[0].zeilen.map((z) => z.ausgleich)).toEqual([6, undefined])
  })

  it('auf der Liste: der eingeteilte, darunter der Ersatz – nie das Körpergewicht', () => {
    const s = mit({ E: { haupt: co('Vor1 Nach1', 78.2), ersatz: co('Vor2 Nach2', 74.6) }, '2': { ersatz: co('Vor4 Nach4') } })
    expect(ausgleichListen(s, ['E'])[0].coPiloten).toEqual([
      { rolle: 'haupt', name: 'Vor1 Nach1', ausgleich: null },
      { rolle: 'ersatz', name: 'Vor2 Nach2', ausgleich: 4 },
    ])
    // Nur ein Ersatz eingetragen: Das Feld für den eingeteilten bleibt leer zum Eintragen von Hand.
    expect(coPilotZeilen(s, '2')).toEqual([
      { rolle: 'haupt', name: '', ausgleich: undefined },
      { rolle: 'ersatz', name: 'Vor4 Nach4', ausgleich: undefined },
    ])
    expect(JSON.stringify(ausgleichListen(s, ['E'])[0].coPiloten)).not.toMatch(/78|74/)
    // Klasse 4 sieht keinen Co-Piloten vor: kein Feld.
    expect(coPilotZeilen(s, '4')).toBeUndefined()
  })
})
