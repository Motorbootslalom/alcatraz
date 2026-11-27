import { describe, expect, it } from 'vitest'
import { reducer } from '../state/reducer'
import { configFor } from '../config/konfig'
import { betriebStarter, wkrBetriebsStand, zeigeNaechsten } from '../testHilfen'
import type { AppState } from '../types'
import { erfassungsLage, type GeraetAngabe } from './lage'
import { FREIGABE_SICHT_FASSUNG, liesFreigabe, sichtFreigabe, type FreigabeErfassung } from './freigabe'
import { listenKennung, type Liste } from './liste'
import { parcoursAmpel } from './ampel'
import { pruefeZeile } from './zeile'

// Freigabe-Sicht (W2.4, Plan W2 §5, A9, D1–D2): Positivliste wie betrieb/sicht.test.ts – nur Listentitel, Stand,
// Ampel, Zahlen und Startnummern; nie Werte, Starter-, Geräte- oder WKR-Namen. Nur erfundene Daten (testHilfen).

const DM = configFor({ regelwerk: 'dm-2026' })
const P1 = 'par_1'
const LAUF = 'manoevrieren/1'
const FELD = 't1a|hin seiteA'
const L = (typeId: string): Liste => ({ bereich: P1, typeId, racecourse: null })
const K = (typeId: string) => listenKennung(L(typeId))
const TOR = K('gate135')

/**
 * gate135 digital, vier Starts gezeigt, der erste mit Wert am Bedienrechner und widersprechender Gerätezeile
 * (Rückfrage). Der erste zählt als abgetippt nicht zum Rückstand (WKR_ANNAHMEN.abgetipptErledigt) – offen: 102–104.
 */
function stand(): { s: AppState; geraete: GeraetAngabe[] } {
  const starter = Array.from({ length: 6 }, (_, i) => betriebStarter(`m${i + 1}`, '1', String(101 + i)))
  let s = reducer(wkrBetriebsStand(starter), { type: 'WKR_LISTE', liste: TOR, modus: 'digital', zeit: 100 })
  for (let i = 0; i < 4; i++) s = zeigeNaechsten(s, P1, 1000 + i * 100)
  // Der vierte ist durchs Start-Tor (P-03): Er zählt auf der Parcours-Liste mit (AM5).
  s = reducer(s, { type: 'BETRIEB_DURCHFAHRT', bereich: P1, ref: s.betrieb.bereiche[P1].gezeigt[3].ref, an: true, zeit: 1350 })
  const erster = JSON.parse(s.betrieb.bereiche[P1].gezeigt[0].ref)[1] as string
  s = reducer(s, { type: 'SET_EINGABEN', zellen: [{ lauf: LAUF, starter: erster, feld: FELD, wert: '7' }] })
  const r = pruefeZeile(s, DM, L('gate135'), undefined, 'gNord', { z: 1, s: s.betrieb.bereiche[P1].gezeigt[0].ref, c: [[FELD, '5', '']] })
  if ('fehler' in r) throw new Error(r.fehler)
  s = reducer(s, { type: 'WKR_ZEILEN', liste: TOR, quelle: { geraet: 'gNord', name: 'Handy Geheimname' }, zeilen: [r], zeit: 5000 })
  const geraete: GeraetAngabe[] = [{ id: 'gNord', name: 'Handy Geheimname', listen: [{ liste: TOR }], zuletzt: 9000, wartend: 2, akku: 41 }]
  return { s, geraete }
}

const sicht = (s: AppState, geraete: GeraetAngabe[], jetzt = 10_000, autoIn: number | null = null): FreigabeErfassung => {
  const lagen = erfassungsLage(s, DM, P1, geraete, jetzt).listen
  return sichtFreigabe(P1, lagen, s.anzeige.wkrWarnung, parcoursAmpel(s, DM, P1, lagen), autoIn)
}

describe('sichtFreigabe', () => {
  it('Positivliste: genau diese Felder, je Liste nur Titel, Stand, Ampel, Zahlen, Startnummern', () => {
    const { s, geraete } = stand()
    const f = sicht(s, geraete)
    // fv 2 (21.11.2026, P-03): Parcours-Ampel, Auto-Modus; je Liste `parcours`. fv 3 (27.11.2026, R13-01): `ausfallGesperrt`.
    expect(Object.keys(f).sort()).toEqual(['ampel', 'ampelRef', 'ausfallGesperrt', 'autoIn', 'autoMoeglich', 'autoOhne', 'bereich', 'fv', 'listen', 'perKnopf', 'warnung'])
    expect(f.fv).toBe(FREIGABE_SICHT_FASSUNG)
    expect(FREIGABE_SICHT_FASSUNG).toBe(3)
    expect(f.ausfallGesperrt).toEqual([])
    expect(f).toMatchObject({ ampel: 'rot', ampelRef: s.betrieb.bereiche[P1].gezeigt[3].ref, perKnopf: true, autoMoeglich: false, autoOhne: [], autoIn: null })
    const erlaubt = ['ampel', 'bis', 'offen', 'parcours', 'rueckfragen', 'stand', 'titel', 'von', 'wartend', 'warnt']
    for (const l of f.listen) for (const k of Object.keys(l)) expect(erlaubt).toContain(k)
    const tor = f.listen.find((l) => l.titel === DM.getSheetDef('gate135').title)!
    expect(tor).toEqual({ titel: DM.getSheetDef('gate135').title, stand: 'aktiv', ampel: 'gehoert', offen: 3, von: '102', bis: '104', wartend: 2, rueckfragen: 1, warnt: true, parcours: true })
    expect(f.listen.find((l) => l.titel === DM.getSheetDef('steg').title)?.parcours).toBe(false)
    // Listen ohne Eintrag: Papier, ohne Zahlen.
    const papier = f.listen.filter((l) => l.stand === 'papier')
    expect(papier.length).toBeGreaterThan(0)
    for (const l of papier) expect(l).toMatchObject({ offen: 0, von: '', bis: '', ampel: null })
  })

  it('nie Werte, Namen von Startern, Geräten oder WKR, Herkunft, Akku, Geräte-ID', () => {
    let { s, geraete } = stand()
    s = reducer(s, { type: 'SET_ANZEIGE', patch: { wkrWarnung: 'nachfragen' } })
    const text = JSON.stringify(sicht(s, geraete))
    for (const verboten of ['Geheimname', 'Vorm1', 'Nachm1', 'Musterclub', 'gNord', '"7"', '"5"', '41', FELD, 'geburtsdatum', 'gewicht', 'geschlecht', 'name']) {
      expect(text).not.toContain(verboten)
    }
    expect(JSON.parse(text).warnung).toBe('nachfragen')
  })

  it('ohne Eintrag in irgendeiner Liste des Bereichs: leer (keine Leiste)', () => {
    const starter = Array.from({ length: 3 }, (_, i) => betriebStarter(`m${i + 1}`, '1', String(101 + i)))
    const s = zeigeNaechsten(wkrBetriebsStand(starter), P1, 1000)
    expect(sicht(s, []).listen).toEqual([])
  })

  it('pausiert/abgemeldet/Papier zählen nie als Rückstand (F1); R darüber: keine Warnung', () => {
    const { s, geraete } = stand()
    const titel = DM.getSheetDef('gate135').title
    const nimm = (st: AppState) => sicht(st, geraete).listen.find((l) => l.titel === titel)!
    expect(nimm(reducer(s, { type: 'WKR_LISTE', liste: TOR, status: 'pausiert', zeit: 6000 }))).toMatchObject({ stand: 'pausiert', offen: 0, warnt: false })
    expect(nimm(reducer(s, { type: 'WKR_LISTE', liste: TOR, modus: 'papier', zeit: 6000 }))).toMatchObject({ stand: 'papier', offen: 0, warnt: false })
    expect(nimm(reducer(s, { type: 'SET_ANZEIGE', patch: { wkrRueckstand: 4 } }))).toMatchObject({ offen: 3, warnt: false })
  })

  it('Ampel: das Gerät geht mit der Uhr auf ✕ (A13)', () => {
    const { s, geraete } = stand()
    const titel = DM.getSheetDef('gate135').title
    expect(sicht(s, geraete, 9000 + 6 * 60_000).listen.find((l) => l.titel === titel)!.ampel).toBe('weg')
  })
})

describe('sichtFreigabe – Parcours-Ampel und Auto-Modus (P-03, AM6)', () => {
  it('Auto-Modus: aus ohne Einstellung; an, aber eine Parcours-Liste ohne Gerät/auf Papier → autoOhne; Countdown nur wirksam', () => {
    const { s, geraete } = stand()
    expect(sicht(s, geraete, 10_000, 3)).toMatchObject({ autoMoeglich: false, autoOhne: [], autoIn: null })
    const an = reducer(s, { type: 'SET_ANZEIGE', patch: { wkrAuto: true } })
    const f = sicht(an, geraete, 10_000, 3)
    expect(f.autoMoeglich).toBe(false)
    // Alle anderen Parcours-Listen des Aufbaus sind Papier; Steg/Vorsteg zählen nie.
    expect(f.autoOhne.length).toBeGreaterThan(0)
    expect(f.autoOhne).not.toContain(DM.getSheetDef('gate135').title)
    expect(f.autoOhne).not.toContain(DM.getSheetDef('steg').title)
    expect(f.autoIn).toBeNull()
  })
})

describe('liesFreigabe (Gerät)', () => {
  it('rund: was der Host baut, liest das Gerät unverändert', () => {
    const { s, geraete } = stand()
    const f = sicht(s, geraete)
    expect(liesFreigabe(JSON.parse(JSON.stringify(f)))).toEqual(f)
  })

  it('falsche Fassung oder Form → null; Fremdes fällt weg', () => {
    expect(liesFreigabe(null)).toBeNull()
    // Fassung 1 (vor der Parcours-Ampel) und 2 (vor `ausfallGesperrt`, R13-01) liest ein neues Gerät nicht mehr.
    expect(liesFreigabe({ fv: 1, bereich: P1, listen: [] })).toBeNull()
    expect(liesFreigabe({ fv: 2, bereich: P1, listen: [] })).toBeNull()
    expect(liesFreigabe({ fv: 3, bereich: P1 })).toBeNull()
    const f = liesFreigabe({ fv: 3, bereich: P1, warnung: 'sperren', ampel: 'blau', ampelRef: 7, autoIn: -1, autoOhne: [3, 'Tor 2'], ausfallGesperrt: ['m1', 7, '', 'm1', 'x'.repeat(65)], name: 'Geheim', listen: [{ titel: 'Tor', stand: 'x', ampel: 'rot', offen: -3, von: 1, warnt: 'ja', parcours: 'ja', name: 'Geheim' }, 'kaputt'] })
    expect(f).toEqual({
      fv: 3, bereich: P1, warnung: 'warnen', ampel: 'aus', ampelRef: null, perKnopf: false, autoMoeglich: false, autoOhne: ['Tor 2'], autoIn: null, ausfallGesperrt: ['m1'],
      listen: [{ titel: 'Tor', stand: 'papier', ampel: null, offen: 0, von: '', bis: '', rueckfragen: 0, warnt: false, parcours: false }],
    })
    // Ohne das Feld (oder kaputt): keine gesperrten Starter – der Host lehnt Abgemeldete ohnehin ab.
    expect(liesFreigabe({ fv: 3, bereich: P1, listen: [], ausfallGesperrt: 'm1' })?.ausfallGesperrt).toEqual([])
    // Ampel nur mit Kennung des Starts; Countdown nur mit Auto-Modus, höchstens 60 s.
    expect(liesFreigabe({ fv: 3, bereich: P1, listen: [], ampel: 'gruen', ampelRef: '["m","a",1]', perKnopf: true, autoMoeglich: true, autoIn: 999 })).toMatchObject({ ampel: 'gruen', ampelRef: '["m","a",1]', perKnopf: true, autoIn: 60 })
  })
})
