import { describe, expect, it } from 'vitest'
import { bereinige, darf, erlaubteAction, erlaubteWkr, freigabeBereiche, liesAufgaben, LISTEN_JE_GERAET, listenAufgaben, STARTFREIGABE_ACTIONS, WKR_ACTIONS, type Aufgabe, type AufgabenStand } from './aufgaben'
import { reducer } from '../state/reducer'
import { configFor } from '../config/konfig'
import { lage, refKey } from '../betrieb/folge'
import { wkrBetriebsStand, zeigeNaechsten } from '../testHilfen'
import { listenKennung, type Liste } from '../wkr/liste'
import type { AppState } from '../types'

/**
 * Rechte der Geräte (E7) – sinngemäß aus tafel state/permissions.test.ts portiert (Steg nur eigene Parcours, nie
 * Stammdaten, Rechte ändern wirkt sofort, ohne Rechte nichts), dazu die Positivliste von alcatraz.
 */

const DM = { parcoursList: [{ id: 'see' }, { id: 'land' }], regelwerk: 'dm-2026' } as unknown as AufgabenStand
const UIM = { parcoursList: [{ id: 'see' }], regelwerk: 'uim-2026' } as unknown as AufgabenStand
const steg = (...bereiche: string[]): Aufgabe[] => [{ art: 'startfreigabe', bereiche }]

const zeigen = (bereich = 'see') => ({ type: 'BETRIEB_ZEIGEN', bereich, ref: '["m","s1",1]', vorher: null })
const meldung = (bereich = 'see') => ({ type: 'BETRIEB_MELDUNG', bereich, meldung: { text: 'Störung', art: 'stoerung' } })

describe('darf – Start-Freigabe', () => {
  it('lässt das Steg-Handy nur seine eigenen Bereiche bedienen', () => {
    expect(darf(zeigen(), steg('see'), DM)).toBe(true)
    expect(darf(meldung(), steg('see'), DM)).toBe(true)
    expect(darf(zeigen('land'), steg('see'), DM)).toBe(false)
  })

  it('mit mehreren Bereichen alle davon', () => {
    expect(darf(zeigen('see'), steg('see', 'land'), DM)).toBe(true)
    expect(darf(zeigen('land'), steg('see', 'land'), DM)).toBe(true)
  })

  it('alles Betriebliche (F5) – nur nicht „Betrieb zurücksetzen“', () => {
    const r = '["m","s1",1]'
    const alle = [
      { type: 'BETRIEB_BEGINNEN', bereich: 'see', punkt: 'lauf:1' },
      zeigen(),
      { type: 'BETRIEB_ZURUECK', bereich: 'see', ref: r },
      meldung(),
      { type: 'BETRIEB_MELDUNG', bereich: 'see', meldung: null },
      { type: 'BETRIEB_ZURUECKSTELLEN', bereich: 'see', ref: r },
      { type: 'BETRIEB_EINREIHEN', bereich: 'see', ref: r, wo: 'ende' },
      { type: 'BETRIEB_AUSSETZEN', bereich: 'see', klasse: '3', an: true },
      { type: 'BETRIEB_VORZIEHEN', bereich: 'see', an: false },
      { type: 'BETRIEB_KLASSE_VOR', bereich: 'see', klasse: '3', vor: null },
      { type: 'BETRIEB_VERSCHIEBEN', bereich: 'see', ref: r, ziel: { nachPunkt: 'lauf:2' } },
      { type: 'BETRIEB_AB', bereich: 'see', ref: r },
      // Parcours-Ampel (P-03, 21.11.2026): „Durchs Start-Tor“ auch vom Handy.
      { type: 'BETRIEB_DURCHFAHRT', bereich: 'see', ref: r, an: true },
    ]
    expect([...new Set(alle.map((a) => a.type))].sort()).toEqual([...STARTFREIGABE_ACTIONS].sort())
    for (const a of alle) expect(darf(a, steg('see'), DM), a.type).toBe(true)
    expect(darf({ type: 'BETRIEB_ZURUECKSETZEN', bereich: 'see' }, steg('see'), DM)).toBe(false)
    expect(darf({ type: 'BETRIEB_ZURUECKSETZEN' }, steg('see'), DM)).toBe(false)
  })

  it('nie Stammdaten, Einstellungen, Eingaben, Gewichte, Laden oder Zurücksetzen – auch mit Bereich', () => {
    const verboten = [
      { type: 'LOAD_STATE', state: {}, bereich: 'see' },
      { type: 'RESET_ALL', bereich: 'see' },
      { type: 'SET_ANZEIGE', patch: { skala: 2 }, bereich: 'see' },
      { type: 'SET_GERAETE_SERVER', server: 'https://ntfy.test', bereich: 'see' },
      { type: 'SET_EINGABEN', zellen: [], bereich: 'see' },
      { type: 'SET_WEIGHT', starterId: 's1', gewicht: 40, bereich: 'see' },
      { type: 'IMPORT_STARTERS', starters: [], mode: 'replace', bereich: 'see' },
      { type: 'CLEAR_EINGABEN', bereich: 'see' },
      { type: 'SET_KENNUNG', kennung: 'X', bereich: 'see' },
    ]
    for (const a of verboten) expect(darf(a, steg('see'), DM), a.type).toBe(false)
  })

  it('Meldung an alle Bereiche („*“) nie vom Gerät', () => {
    expect(darf(meldung('*'), steg('see', 'land', '*'), DM)).toBe(false)
  })

  it('zieht geänderte Rechte sofort nach (Bereich entzogen, anderer dazu)', () => {
    let aufgaben = steg('see')
    expect(darf(zeigen('see'), aufgaben, DM)).toBe(true)
    aufgaben = steg('land')
    expect(darf(zeigen('see'), aufgaben, DM)).toBe(false)
    expect(darf(zeigen('land'), aufgaben, DM)).toBe(true)
  })

  it('ohne Aufgaben (entzogen, nie gekoppelt) gar nichts', () => {
    expect(darf(zeigen(), [], DM)).toBe(false)
    expect(darf(zeigen(), steg(), DM)).toBe(false)
  })

  it('einen Bereich, den es im Stand nicht gibt, nicht – auch nicht „parallel“ unter DM', () => {
    expect(darf(zeigen('weg'), steg('weg'), DM)).toBe(false)
    expect(darf(zeigen('parallel'), steg('parallel'), DM)).toBe(false)
    expect(darf(zeigen('parallel'), steg('parallel'), UIM)).toBe(true)
  })
})

describe('bereinige', () => {
  it('nimmt nur die Felder, die der Reducer liest – ohne `zeit` und Fremdes', () => {
    const roh = { ...zeigen(), zeit: 5, kennung: 'X', state: { starters: [] } }
    expect(bereinige(roh)).toEqual(zeigen())
    expect(erlaubteAction(roh, steg('see'), DM)).toEqual(zeigen())
  })

  it('verwirft falsche Typen und zu Langes', () => {
    expect(bereinige({ type: 'BETRIEB_ZEIGEN', bereich: 'see', ref: 5, vorher: null })).toBeNull()
    expect(bereinige({ type: 'BETRIEB_ZEIGEN', bereich: 'see', ref: 'a' })).toBeNull()
    expect(bereinige({ type: 'BETRIEB_BEGINNEN', bereich: 'see', punkt: 'lauf:0' })).toBeNull()
    expect(bereinige({ type: 'BETRIEB_MELDUNG', bereich: 'see', meldung: { text: 'x'.repeat(201), art: 'info' } })).toBeNull()
    expect(bereinige({ type: 'BETRIEB_MELDUNG', bereich: 'see', meldung: { text: 'x', art: 'laut' } })).toBeNull()
    expect(bereinige({ type: 'BETRIEB_AUSSETZEN', bereich: 'see', klasse: 'ME', an: true })).toBeNull()
    expect(bereinige({ type: 'BETRIEB_VERSCHIEBEN', bereich: 'see', ref: 'a', ziel: { vor: 'b', nach: 'c' } })).toBeNull()
    expect(bereinige({ type: 'BETRIEB_VORZIEHEN', bereich: 'see', an: 'ja' })).toBeNull()
    expect(bereinige({ type: 'BETRIEB_ZEIGEN', bereich: 'x'.repeat(65), ref: 'a', vorher: null })).toBeNull()
    expect(bereinige(null)).toBeNull()
  })
})

describe('liesAufgaben', () => {
  it('liest, was es kennt, und verwirft den Rest', () => {
    expect(liesAufgaben([{ art: 'startfreigabe', bereiche: ['see', 'see', 5, 'land'] }, { art: 'admin' }, 'x'])).toEqual([
      { art: 'startfreigabe', bereiche: ['see', 'land'] },
    ])
    expect(liesAufgaben(null)).toEqual([])
    expect(freigabeBereiche([...steg('see'), ...steg('land', 'see')])).toEqual(['see', 'land'])
  })
})

// --- WKR-Listen (W1, 21.11.2026) ----------------------------------------------------------------

describe('Aufgabe `liste` (W1)', () => {
  const kennung = (typeId: string, bereich = 'par_1') => listenKennung({ bereich, typeId, racecourse: null })

  it('liesAufgaben: Liste, Teil nur am Steg, höchstens vier Listen (W3-03), Doppelte einmal', () => {
    expect(liesAufgaben([{ art: 'liste', liste: kennung('steg'), teil: 'ab' }, { art: 'liste', liste: kennung('gate135') }])).toEqual([
      { art: 'liste', liste: kennung('steg'), teil: 'ab' },
      { art: 'liste', liste: kennung('gate135') },
    ])
    // Teil an einer ungeteilten Liste, falscher Teil, unlesbare Kennung: fällt weg.
    expect(liesAufgaben([{ art: 'liste', liste: kennung('gate135'), teil: 'ab' }, { art: 'liste', liste: kennung('steg'), teil: 'mitte' }, { art: 'liste', liste: 'kaputt' }])).toEqual([])
    // Fünf Listen → die ersten vier (LISTEN_JE_GERAET, W3-03/GF8 21.11.2026; vorher zwei, F15); dieselbe zweimal →
    // einmal; die Start-Freigabe zählt nicht mit.
    const fuenf = liesAufgaben([
      { art: 'liste', liste: kennung('tor5') },
      { art: 'liste', liste: kennung('tor5') },
      { art: 'startfreigabe', bereiche: ['par_1'] },
      { art: 'liste', liste: kennung('mueb') },
      { art: 'liste', liste: kennung('steg') },
      { art: 'liste', liste: kennung('gate135') },
      { art: 'liste', liste: kennung('vorsteg') },
    ])
    expect(LISTEN_JE_GERAET).toBe(4)
    expect(listenAufgaben(fuenf).map((a) => a.liste)).toEqual([kennung('tor5'), kennung('mueb'), kennung('steg'), kennung('gate135')])
    expect(freigabeBereiche(fuenf)).toEqual(['par_1'])
  })

  it('W3 (F14): Maskenvorgabe `maske`/`fest` nur mit bekannten Werten', () => {
    expect(liesAufgaben([{ art: 'liste', liste: kennung('tor5'), maske: 'knoepfe', fest: true }])).toEqual([
      { art: 'liste', liste: kennung('tor5'), maske: 'knoepfe', fest: true },
    ])
    expect(liesAufgaben([{ art: 'liste', liste: kennung('steg'), teil: 'an', maske: 'bild' }])).toEqual([{ art: 'liste', liste: kennung('steg'), teil: 'an', maske: 'bild' }])
    // Unbekannte Maske, `fest` nicht `true`: fallen still weg, die Liste bleibt.
    expect(liesAufgaben([{ art: 'liste', liste: kennung('tor5'), maske: 'zauber', fest: 'ja' }])).toEqual([{ art: 'liste', liste: kennung('tor5') }])
    expect(liesAufgaben([{ art: 'liste', liste: kennung('tor5'), maske: 7, fest: 1 }])).toEqual([{ art: 'liste', liste: kennung('tor5') }])
  })
})

describe('erlaubteWkr (W1)', () => {
  const DMK = configFor({ regelwerk: 'dm-2026' })
  const P1 = 'par_1'
  const L = (typeId: string): Liste => ({ bereich: P1, typeId, racecourse: null })
  const K = (typeId: string) => listenKennung(L(typeId))
  const G = { id: 'g1', name: '  Handy Tor 1  ' }

  function bereit(): { s: AppState; erster: string } {
    let s = wkrBetriebsStand()
    for (const t of ['gate135', 'steg', 'vorsteg']) s = reducer(s, { type: 'WKR_LISTE', liste: K(t), modus: 'digital', zeit: 100 })
    s = zeigeNaechsten(s, P1, 1000)
    return { s, erster: lage(s, P1).aktuell!.eintrag!.starter }
  }
  const z = (starter: string, c: [string, string, string][], nr = 1, mehr: Record<string, unknown> = {}) => ({ z: nr, s: refKey({ art: 'm', starter, lauf: 1 }), c, ...mehr })
  const zeilen = (typeId: string, ...zs: unknown[]) => ({ type: 'WKR_ZEILEN', liste: K(typeId), zeilen: zs })

  it('Zeilen der eigenen Liste → WKR_ZEILEN mit `quelle` aus dem Register; schlechte Zeilen einzeln abgelehnt', () => {
    const { s, erster } = bereit()
    const r = erlaubteWkr(zeilen('gate135', z(erster, [['t1a|hin seiteA', '5', '']], 1), z(erster, [['fremd', '1', '']], 2), { kaputt: true }), [{ art: 'liste', liste: K('gate135') }], s, DMK, G)!
    expect(r.action).toMatchObject({ type: 'WKR_ZEILEN', liste: K('gate135'), quelle: { geraet: 'g1', name: 'Handy Tor 1' } })
    expect(r.action!.type === 'WKR_ZEILEN' && r.action!.zeilen.map((x) => x.id)).toEqual(['g1.1'])
    expect(r.abgelehnt).toEqual([{ z: 2, grund: 'feld-fremd' }, { z: 0, grund: 'wert-ungueltig' }])
    // Was durchkommt, wendet der Reducer an.
    expect(reducer(s, { ...r.action!, zeit: 2000 }).eingaben['manoevrieren/1'][erster]['t1a|hin seiteA']).toBe('5')
    // Alles abgelehnt: keine Action, aber die Ablehnungen.
    expect(erlaubteWkr(zeilen('gate135', z(erster, [['fremd', '1', '']], 3)), [{ art: 'liste', liste: K('gate135') }], s, DMK, G)).toEqual({ action: null, abgelehnt: [{ z: 3, grund: 'feld-fremd' }] })
  })

  it('fremde Liste, unbekannte Liste, Art außerhalb der Positivliste, zu viele Zeilen → nicht erlaubt', () => {
    const { s, erster } = bereit()
    const eigene = [{ art: 'liste', liste: K('gate135') }] as Aufgabe[]
    const gut = z(erster, [['t1a|hin seiteA', '5', '']])
    expect(erlaubteWkr(zeilen('tor5', gut), eigene, s, DMK, G)).toBeNull()
    expect(erlaubteWkr(zeilen('gate135', gut), [{ art: 'startfreigabe', bereiche: [P1] }], s, DMK, G)).toBeNull()
    expect(erlaubteWkr(zeilen('gate135', gut), [], s, DMK, G)).toBeNull()
    // Eine Liste, die es in der Veranstaltung nicht gibt (Knoten erst W5; fremder Parcours).
    const knoten = listenKennung({ bereich: P1, typeId: 'knoten', racecourse: null })
    expect(erlaubteWkr({ type: 'WKR_ZEILEN', liste: knoten, zeilen: [gut] }, [{ art: 'liste', liste: knoten }], s, DMK, G)).toBeNull()
    const fremd = listenKennung({ bereich: 'see', typeId: 'gate135', racecourse: null })
    expect(erlaubteWkr({ type: 'WKR_ZEILEN', liste: fremd, zeilen: [gut] }, [{ art: 'liste', liste: fremd }], s, DMK, G)).toBeNull()
    for (const type of ['WKR_RUECKFRAGE', 'WKR_VORSCHLAG', 'WKR_LISTE', 'WKR_ABSCHLUSS_LOESEN', 'SET_EINGABEN', 'BETRIEB_ZEIGEN'])
      expect(erlaubteWkr({ type, liste: K('gate135'), zeilen: [gut], id: 'x', wahl: 'geraet', modus: 'digital' }, eigene, s, DMK, G), type).toBeNull()
    expect(erlaubteWkr(zeilen('gate135'), eigene, s, DMK, G)).toBeNull()
    expect(erlaubteWkr(zeilen('gate135', ...Array.from({ length: 9 }, (_, i) => z(erster, [], i + 1))), eigene, s, DMK, G)).toBeNull()
    expect(erlaubteWkr(zeilen('gate135', ...Array.from({ length: 8 }, (_, i) => z(erster, [], i + 1))), eigene, s, DMK, G)).not.toBeNull()
  })

  it('Steg mit Teil (F16): fremder Teil abgelehnt; X neben anderem nur Steg-Ablegen und Vorsteg (F5), allein überall (NG2)', () => {
    const { s, erster } = bereit()
    const ab = [{ art: 'liste', liste: K('steg'), teil: 'ab' }] as Aufgabe[]
    const an = [{ art: 'liste', liste: K('steg'), teil: 'an' }] as Aufgabe[]
    expect(erlaubteWkr(zeilen('steg', z(erster, [['katalog:stegAnlegen', '7', '']])), ab, s, DMK, G)!.abgelehnt).toEqual([{ z: 1, grund: 'teil-fremd' }])
    expect(erlaubteWkr(zeilen('steg', z(erster, [], 1, { t: 'an' })), ab, s, DMK, G)!.abgelehnt).toEqual([{ z: 1, grund: 'teil-fremd' }])
    const x = erlaubteWkr(zeilen('steg', z(erster, [['disq@steg', 'X', '']])), ab, s, DMK, G)!
    expect([x.abgelehnt, x.action!.type === 'WKR_ZEILEN' && x.action!.zeilen[0].haken]).toEqual([[], ['erfasst.ab@steg']])
    // „Nicht gestartet“ (24.11.2026, NG2/NG4): X allein ins gemeinsame Feld auch vom Anlegen; neben einem Code nicht.
    expect(erlaubteWkr(zeilen('steg', z(erster, [['disq@steg', 'X', '']])), an, s, DMK, G)!.abgelehnt).toEqual([])
    expect(erlaubteWkr(zeilen('steg', z(erster, [['disq@steg', 'X', ''], ['katalog:stegAnlegen', '7', '']])), an, s, DMK, G)!.abgelehnt).toEqual([{ z: 1, grund: 'x-nicht-erlaubt' }])
    expect(erlaubteWkr(zeilen('vorsteg', z(erster, [['disq@vorsteg', 'X', '']])), [{ art: 'liste', liste: K('vorsteg') }], s, DMK, G)!.abgelehnt).toEqual([])
    expect(erlaubteWkr(zeilen('gate135', z(erster, [['t1a|hin seiteA', 'X', '']])), [{ art: 'liste', liste: K('gate135') }], s, DMK, G)!.abgelehnt).toEqual([{ z: 1, grund: 'x-nicht-erlaubt' }])
  })

  it('WKR_STATUS → WKR_LISTE nur mit Status (Modus bleibt am Bedienrechner); WKR_ABSCHLUSS mit Name ≤ 60 und Teil der Aufgabe', () => {
    const { s } = bereit()
    const steg = [{ art: 'liste', liste: K('steg'), teil: 'an' }] as Aufgabe[]
    expect(erlaubteWkr({ type: 'WKR_STATUS', liste: K('steg'), status: 'pausiert', modus: 'papier' }, steg, s, DMK, G)).toEqual({ action: { type: 'WKR_LISTE', liste: K('steg'), status: 'pausiert', teil: 'an' }, abgelehnt: [] })
    // Ohne Teil (ganzer Steg bzw. ungeteilte Liste): die ganze Liste.
    expect(erlaubteWkr({ type: 'WKR_STATUS', liste: K('steg'), status: 'pausiert' }, [{ art: 'liste', liste: K('steg') }], s, DMK, G)!.action).toEqual({ type: 'WKR_LISTE', liste: K('steg'), status: 'pausiert' })
    expect(erlaubteWkr({ type: 'WKR_STATUS', liste: K('steg'), status: 'weg' }, steg, s, DMK, G)).toBeNull()
    const abschluss = (mehr: Record<string, unknown> = {}) => ({ type: 'WKR_ABSCHLUSS', liste: K('steg'), punkt: 'lauf:1', name: ' Vorname Muster ', pruefsummen: { [refKey({ art: 'm', starter: 'e1', lauf: 1 })]: 'abc' }, restPapier: false, ...mehr })
    expect(erlaubteWkr(abschluss({ zeit: 1, fremd: true }), steg, s, DMK, G)).toEqual({
      action: { type: 'WKR_ABSCHLUSS', liste: K('steg'), punkt: 'lauf:1', name: 'Vorname Muster', pruefsummen: { [refKey({ art: 'm', starter: 'e1', lauf: 1 })]: 'abc' }, restPapier: false, teil: 'an' },
      abgelehnt: [],
    })
    for (const kaputt of [{ name: '' }, { name: 'x'.repeat(61) }, { punkt: 'lauf:x' }, { restPapier: 'ja' }, { pruefsummen: { a: 5 } }, { pruefsummen: null }])
      expect(erlaubteWkr(abschluss(kaputt), steg, s, DMK, G), JSON.stringify(kaputt)).toBeNull()
    expect(erlaubteWkr(abschluss({ name: 'x'.repeat(60) }), steg, s, DMK, G)).not.toBeNull()
    // Ein Punkt, der noch nicht begonnen hat (Prüfbefund 21.11.2026): nicht erlaubt.
    expect(erlaubteWkr(abschluss({ punkt: 'lauf:2' }), steg, s, DMK, G)).toBeNull()
  })

  it('erlaubteAction lässt keine WKR-Art durch; die Start-Freigabe bleibt, wie sie war', () => {
    const { s } = bereit()
    const beide: Aufgabe[] = [{ art: 'startfreigabe', bereiche: [P1] }, { art: 'liste', liste: K('gate135') }]
    for (const type of WKR_ACTIONS) expect(erlaubteAction({ type, bereich: P1, liste: K('gate135') }, beide, s)).toBeNull()
    expect(erlaubteAction({ type: 'BETRIEB_MELDUNG', bereich: P1, meldung: null }, beide, s)).toEqual({ type: 'BETRIEB_MELDUNG', bereich: P1, meldung: null })
    // Eine Liste allein gibt keine Start-Freigabe.
    expect(darf({ type: 'BETRIEB_MELDUNG', bereich: P1, meldung: null }, [{ art: 'liste', liste: K('gate135') }], s)).toBe(false)
    expect(WKR_ACTIONS).toEqual(['WKR_ZEILEN', 'WKR_STATUS', 'WKR_ABSCHLUSS', 'WKR_SO_LASSEN'])
  })

  it('WKR_SO_LASSEN (W3-35): Zeile mit Geräte-ID aus dem Register, nie aus der Nachricht', () => {
    const { s } = bereit()
    const eigene = [{ art: 'liste', liste: K('gate135') }] as Aufgabe[]
    expect(erlaubteWkr({ type: 'WKR_SO_LASSEN', liste: K('gate135'), z: 7, zeile: 'fremd.1' }, eigene, s, DMK, G)).toEqual({
      action: { type: 'WKR_SO_LASSEN', liste: K('gate135'), zeile: 'g1.7' },
      abgelehnt: [],
    })
    for (const z of [0, -1, 1.5, '7', undefined]) expect(erlaubteWkr({ type: 'WKR_SO_LASSEN', liste: K('gate135'), z }, eigene, s, DMK, G)).toBeNull()
    expect(erlaubteWkr({ type: 'WKR_SO_LASSEN', liste: K('tor5'), z: 1 }, eigene, s, DMK, G)).toBeNull()
  })
})
