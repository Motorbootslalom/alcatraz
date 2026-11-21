import { describe, expect, it } from 'vitest'
import { reducer, type Action } from '../reducer'
import { normalisiereWkr } from './wkr'
import { configFor } from '../../config/konfig'
import { lage, refKey } from '../../betrieb/folge'
import { wkrBetriebsStand, zeigeNaechsten } from '../../testHilfen'
import type { AppState, WkrZeile } from '../../types'
import { pruefeZeile, type GeraeteZeile } from '../../wkr/zeile'
import { listenKennung, type Liste } from '../../wkr/liste'
import { zeilenPruefsumme } from '../../wkr/uebernahme'
import { listenFelder } from '../../lib/eingaben'

// Reducer der digitalen WKR-Erfassung (Plan §4, §6). Zeilen entstehen wie beim Host über pruefeZeile. Nur erfundene
// Starter (testHilfen).

const DM = configFor({ regelwerk: 'dm-2026' })
const P1 = 'par_1'
const L1 = 'manoevrieren/1'
const L = (typeId: string): Liste => ({ bereich: P1, typeId, racecourse: null })
const K = (typeId: string) => listenKennung(L(typeId))

/** Liste digital (zeit 100), ein Start gezeigt (zeit 1000). */
function bereit(...typeIds: string[]): { s: AppState; erster: string; key: string } {
  let s = wkrBetriebsStand()
  for (const t of typeIds.length > 0 ? typeIds : ['gate135']) s = reducer(s, { type: 'WKR_LISTE', liste: K(t), modus: 'digital', zeit: 100 })
  s = zeigeNaechsten(s, P1, 1000)
  const erster = lage(s, P1).aktuell!.eintrag!.starter
  return { s, erster, key: refKey({ art: 'm', starter: erster, lauf: 1 }) }
}

function zeileVon(s: AppState, typeId: string, starter: string, c: GeraeteZeile['c'], mehr: Partial<GeraeteZeile> & { teil?: 'ab' | 'an'; geraet?: string } = {}): WkrZeile {
  const { teil, geraet = 'g1', ...rest } = mehr
  const r = pruefeZeile(s, DM, L(typeId), teil, geraet, { z: 1, s: refKey({ art: 'm', starter, lauf: 1 }), c, ...rest })
  if ('fehler' in r) throw new Error(r.fehler)
  return r
}

const sende = (s: AppState, typeId: string, zeilen: WkrZeile[], zeit = 5000) => reducer(s, { type: 'WKR_ZEILEN', liste: K(typeId), quelle: { geraet: 'g1', name: 'Handy Tor 1' }, zeilen, zeit })
const werte = (s: AppState, starter: string, lauf = L1) => s.eingaben[lauf]?.[starter] ?? {}
const tippe = (s: AppState, starter: string, feld: string, wert: string) => reducer(s, { type: 'SET_EINGABEN', zellen: [{ lauf: L1, starter, feld, wert }] })

describe('WKR_ZEILEN – Übernahme', () => {
  it('leer → übernommen mit Haken; der Name des Geräts kommt nicht in den Stand', () => {
    const { s, erster } = bereit()
    const next = sende(s, 'gate135', [zeileVon(s, 'gate135', erster, [['t1a|hin seiteA', '5', '']])])
    expect(werte(next, erster)).toEqual({ 't1a|hin seiteA': '5', 'erfasst@gate135': '1' })
    expect(next.wkr.rueckfragen).toEqual([])
    expect(JSON.stringify(next)).not.toContain('Handy Tor 1')
  })

  it('„Fehlerfrei“: nur der Haken', () => {
    const { s, erster } = bereit()
    expect(werte(sende(s, 'gate135', [zeileVon(s, 'gate135', erster, [])]), erster)).toEqual({ 'erfasst@gate135': '1' })
  })

  it('gleich oder Stand = vorher → übernommen; anders → Rückfrage, Stand bleibt, kein Haken', () => {
    const { s: s0, erster } = bereit()
    let s = tippe(s0, erster, 't1a|hin seiteA', '5')
    s = tippe(s, erster, 't3a|hin seiteA', '10')
    const z = zeileVon(s, 'gate135', erster, [['t1a|hin seiteA', '5', ''], ['t3a|hin seiteA', '5', '']], { z: 4 })
    const next = sende(s, 'gate135', [z])
    expect(werte(next, erster)).toEqual({ 't1a|hin seiteA': '5', 't3a|hin seiteA': '10' })
    expect(next.wkr.rueckfragen).toEqual([
      {
        id: `g1.4|${L1}|${erster}|t3a|hin seiteA`,
        zeile: 'g1.4',
        liste: K('gate135'),
        ref: z.ref,
        lauf: L1,
        weitere: [],
        starter: erster,
        feld: 't3a|hin seiteA',
        wert: '5',
        steht: '10',
        grund: 'zelle',
        haken: ['erfasst@gate135'],
        zeit: 5000,
      },
    ])
    // Korrektur mit `vorher` = was steht: übernommen.
    const korrektur = zeileVon(s, 'gate135', erster, [['t3a|hin seiteA', '15', '10']], { z: 5, k: true })
    expect(werte(sende(s, 'gate135', [korrektur]), erster)['t3a|hin seiteA']).toBe('15')
  })

  it('doppelt zugestellt: derselbe Stand; zweimal angewandt: gleiches Ergebnis', () => {
    const { s, erster } = bereit()
    const z = zeileVon(s, 'gate135', erster, [['t1a|hin seiteA', '5', '']])
    const einmal = sende(s, 'gate135', [z])
    expect(sende(einmal, 'gate135', [z], 6000)).toBe(einmal)
    expect(sende(s, 'gate135', [z])).toEqual(einmal)
    // Auch mit Rückfrage: eine zweite Zustellung ändert nichts.
    const belegt = tippe(s, erster, 't1a|hin seiteA', '10')
    const mitFrage = sende(belegt, 'gate135', [z])
    expect(mitFrage.wkr.rueckfragen).toHaveLength(1)
    expect(sende(mitFrage, 'gate135', [z], 7000)).toBe(mitFrage)
  })

  it('eine neuere Zeile desselben Geräts ersetzt dessen ältere Rückfrage derselben Zelle', () => {
    const { s: s0, erster } = bereit()
    const s = tippe(s0, erster, 't1a|hin seiteA', '10')
    const alt = sende(s, 'gate135', [zeileVon(s, 'gate135', erster, [['t1a|hin seiteA', '5', '']], { z: 1 })])
    const neu = sende(alt, 'gate135', [zeileVon(s, 'gate135', erster, [['t1a|hin seiteA', '15', '5']], { z: 2, k: true })])
    expect(neu.wkr.rueckfragen.map((r) => [r.zeile, r.wert])).toEqual([['g1.2', '15']])
    // Ein anderes Gerät ersetzt nichts.
    const fremd = sende(alt, 'gate135', [zeileVon(s, 'gate135', erster, [['t1a|hin seiteA', '15', '']], { z: 1, geraet: 'g2' })])
    expect(fremd.wkr.rueckfragen.map((r) => r.zeile)).toEqual(['g1.1', 'g2.1'])
  })

  it('nicht gezeigter Start: die ganze Zeile wird Rückfrage (Grund start), mit Haken', () => {
    const { s, erster } = bereit()
    const anderer = lage(s, P1).frei[0].starter
    expect(anderer).not.toBe(erster)
    const next = sende(s, 'gate135', [zeileVon(s, 'gate135', anderer, [['t1a|hin seiteA', '5', '']])])
    expect(werte(next, anderer)).toEqual({})
    expect(next.wkr.rueckfragen.map((r) => [r.feld, r.wert, r.grund])).toEqual([
      ['t1a|hin seiteA', '5', 'start'],
      ['erfasst@gate135', '1', 'start'],
    ])
  })

  it('Liste auf Papier (oder ohne Eintrag): Vorschlag', () => {
    const { s, erster } = bereit('tor5')
    const next = sende(s, 'gate135', [zeileVon(s, 'gate135', erster, [['t1a|hin seiteA', '5', '']])])
    expect(werte(next, erster)).toEqual({})
    expect(next.wkr.vorschlaege).toMatchObject([{ id: 'g1.1', grund: 'papier', zellen: [{ feld: 't1a|hin seiteA', wert: '5' }], haken: ['erfasst@gate135'] }])
  })

  it('unbekannte Liste, Zeile einer anderen Liste, unbekannter Starter: nichts', () => {
    const { s, erster } = bereit()
    const z = zeileVon(s, 'gate135', erster, [['t1a|hin seiteA', '5', '']])
    expect(reducer(s, { type: 'WKR_ZEILEN', liste: 'kaputt', quelle: { geraet: 'g1', name: 'x' }, zeilen: [z] })).toBe(s)
    expect(sende(s, 'tor5', [z])).toBe(s)
    expect(sende(s, 'gate135', [{ ...z, starter: 'weg' }])).toBe(s)
  })
})

describe('WKR_ZEILEN – Steg in zwei Teilen', () => {
  it('Teilhaken; beide Teile → ganzer Haken; Disq. vereinigt; Bemerkung angehängt', () => {
    const { s, erster } = bereit('steg')
    const ab = zeileVon(s, 'steg', erster, [['katalog:stegAblegen', '3', ''], ['disq@steg', 'A', ''], ['bemerkung@steg', 'Leine', '']], { teil: 'ab', z: 1 })
    let next = sende(s, 'steg', [ab])
    expect(werte(next, erster)).toEqual({ 'katalog:stegAblegen': '3', 'disq@steg': 'A', 'bemerkung@steg': 'Leine', 'erfasst.ab@steg': '1' })
    const an = zeileVon(s, 'steg', erster, [['katalog:stegAnlegen', '7', ''], ['disq@steg', 'S', ''], ['bemerkung@steg', 'Fender', '']], { teil: 'an', z: 1, geraet: 'g2' })
    next = sende(next, 'steg', [an])
    expect(next.wkr.rueckfragen).toEqual([])
    expect(werte(next, erster)).toEqual({
      'katalog:stegAblegen': '3',
      'katalog:stegAnlegen': '7',
      'disq@steg': 'A, S',
      'bemerkung@steg': 'Leine; Fender',
      'erfasst.ab@steg': '1',
      'erfasst.an@steg': '1',
      'erfasst@steg': '1',
    })
  })

  it('ein Disq.-Buchstabe soll wegfallen: Rückfrage „entfernt“, Teilhaken erst nach der Entscheidung', () => {
    const { s: s0, erster } = bereit('steg')
    let s = sende(s0, 'steg', [zeileVon(s0, 'steg', erster, [['disq@steg', 'A', '']], { teil: 'ab', z: 1 })])
    s = sende(s, 'steg', [zeileVon(s0, 'steg', erster, [['disq@steg', 'S', '']], { teil: 'an', z: 1, geraet: 'g2' })])
    const korrektur = zeileVon(s0, 'steg', erster, [['disq@steg', '', 'A']], { teil: 'ab', z: 2, k: true })
    // Das Ablegen nimmt sein A zurück; dort steht inzwischen „A, S“ – nicht still.
    const next = sende(s, 'steg', [korrektur])
    expect(werte(next, erster)['disq@steg']).toBe('A, S')
    expect(next.wkr.rueckfragen).toMatchObject([{ grund: 'entfernt', wert: 'S', steht: 'A, S', zeile: 'g1.2' }])
    const entschieden = reducer(next, { type: 'WKR_RUECKFRAGE', id: next.wkr.rueckfragen[0].id, wahl: 'geraet' })
    expect(werte(entschieden, erster)['disq@steg']).toBe('S')
    expect(entschieden.wkr.rueckfragen).toEqual([])
  })
})

describe('WKR_RUECKFRAGE, WKR_VORSCHLAG', () => {
  function mitFrage() {
    const { s: s0, erster } = bereit()
    const s = tippe(s0, erster, 't1a|hin seiteA', '10')
    const next = sende(s, 'gate135', [zeileVon(s, 'gate135', erster, [['t1a|hin seiteA', '5', ''], ['t3a|hin seiteA', '5', '']])])
    return { s: next, erster }
  }

  it('Gerät übernehmen: Wert gesetzt, Rückfrage weg, Haken (letzte der Zeile)', () => {
    const { s, erster } = mitFrage()
    expect(werte(s, erster)['erfasst@gate135']).toBeUndefined()
    const next = reducer(s, { type: 'WKR_RUECKFRAGE', id: s.wkr.rueckfragen[0].id, wahl: 'geraet' })
    expect(werte(next, erster)).toEqual({ 't1a|hin seiteA': '5', 't3a|hin seiteA': '5', 'erfasst@gate135': '1' })
    expect(next.wkr.rueckfragen).toEqual([])
  })

  it('behalten: Stand bleibt, Haken trotzdem (die Zeile ist entschieden)', () => {
    const { s, erster } = mitFrage()
    const next = reducer(s, { type: 'WKR_RUECKFRAGE', id: s.wkr.rueckfragen[0].id, wahl: 'behalten' })
    expect(werte(next, erster)).toEqual({ 't1a|hin seiteA': '10', 't3a|hin seiteA': '5', 'erfasst@gate135': '1' })
  })

  it('unbekannte Kennung: derselbe Stand', () => {
    const { s } = mitFrage()
    expect(reducer(s, { type: 'WKR_RUECKFRAGE', id: 'gibt-es-nicht', wahl: 'geraet' })).toBe(s)
    expect(reducer(s, { type: 'WKR_VORSCHLAG', id: 'gibt-es-nicht', wahl: 'uebernehmen' })).toBe(s)
  })

  it('Vorschlag übernehmen setzt Zellen und Haken ohne Bedingung; verwerfen lässt alles', () => {
    const { s: s0, erster } = bereit('tor5')
    const s = tippe(s0, erster, 't1a|hin seiteA', '10')
    const mit = sende(s, 'gate135', [zeileVon(s, 'gate135', erster, [['t1a|hin seiteA', '5', '']])])
    const id = mit.wkr.vorschlaege[0].id
    expect(werte(reducer(mit, { type: 'WKR_VORSCHLAG', id, wahl: 'uebernehmen' }), erster)).toEqual({ 't1a|hin seiteA': '5', 'erfasst@gate135': '1' })
    const verworfen = reducer(mit, { type: 'WKR_VORSCHLAG', id, wahl: 'verwerfen' })
    expect(werte(verworfen, erster)).toEqual({ 't1a|hin seiteA': '10' })
    expect(verworfen.wkr.vorschlaege).toEqual([])
  })
})

describe('WKR_LISTE', () => {
  it('erstes digital setzt seit; nurWennFehlt; unverändert = derselbe Stand', () => {
    const s = wkrBetriebsStand()
    const a = reducer(s, { type: 'WKR_LISTE', liste: K('gate135'), modus: 'digital', nurWennFehlt: true, zeit: 100 })
    expect(a.wkr.listen[K('gate135')]).toEqual({ modus: 'digital', status: 'aktiv', seit: 100, pausen: [] })
    expect(reducer(a, { type: 'WKR_LISTE', liste: K('gate135'), modus: 'beides', nurWennFehlt: true, zeit: 200 })).toBe(a)
    expect(reducer(a, { type: 'WKR_LISTE', liste: K('gate135'), modus: 'digital', zeit: 200 })).toBe(a)
    // digital → beides behält seit; Papier → digital setzt neu.
    const b = reducer(a, { type: 'WKR_LISTE', liste: K('gate135'), modus: 'beides', zeit: 300 })
    expect(b.wkr.listen[K('gate135')].seit).toBe(100)
    const c = reducer(reducer(b, { type: 'WKR_LISTE', liste: K('gate135'), modus: 'papier', zeit: 400 }), { type: 'WKR_LISTE', liste: K('gate135'), modus: 'digital', zeit: 500 })
    expect(c.wkr.listen[K('gate135')].seit).toBe(500)
  })

  it('Unbrauchbares ändert nichts', () => {
    const s = wkrBetriebsStand()
    expect(reducer(s, { type: 'WKR_LISTE', liste: 'x', modus: 'digital' })).toBe(s)
    expect(reducer(s, { type: 'WKR_LISTE', liste: K('gate135'), modus: 'analog' as never })).toBe(s)
    expect(reducer(s, { type: 'WKR_LISTE', liste: K('gate135'), status: 'weg' as never })).toBe(s)
  })

  it('Pause und Weiter: P = Schlange beim Pausieren; Abmelden aus der Pause hält sie offen', () => {
    const { s, key } = bereit()
    const p = reducer(s, { type: 'WKR_LISTE', liste: K('gate135'), status: 'pausiert', zeit: 2000 })
    expect(p.wkr.listen[K('gate135')]).toMatchObject({ status: 'pausiert', pausen: [{ von: 2000, bis: null, papier: [key] }] })
    const ab = reducer(p, { type: 'WKR_LISTE', liste: K('gate135'), status: 'abgemeldet', zeit: 2500 })
    expect(ab.wkr.listen[K('gate135')]).toMatchObject({ status: 'abgemeldet', pausen: [{ von: 2000, bis: null }] })
    const weiter = reducer(ab, { type: 'WKR_LISTE', liste: K('gate135'), status: 'aktiv', zeit: 3000 })
    expect(weiter.wkr.listen[K('gate135')]).toMatchObject({ status: 'aktiv', pausen: [{ von: 2000, bis: 3000, papier: [key] }] })
  })
})

describe('WKR_ABSCHLUSS', () => {
  const summe = (s: AppState, starter: string) => zeilenPruefsumme(werte(s, starter), listenFelder(DM, 'gate135', s.starters.find((x) => x.id === starter)!.klasse).map((f) => f.kennung))

  it('offene Starts: nur mit „Rest auf Papier“', () => {
    const { s, key } = bereit()
    const abschluss: Action = { type: 'WKR_ABSCHLUSS', liste: K('gate135'), punkt: 'lauf:1', name: 'Vor1 Nach1', pruefsummen: {}, restPapier: false, zeit: 9000 }
    expect(reducer(s, abschluss)).toBe(s)
    const mitRest = reducer(s, { ...abschluss, restPapier: true })
    expect(mitRest.wkr.abschluss[K('gate135')]).toEqual({ 'lauf:1': { name: 'Vor1 Nach1', zeit: 9000, abweichend: [], papier: [key] } })
  })

  it('alles erfasst: angenommen; abweichende Prüfsumme wird vermerkt; danach werden Zeilen Vorschläge', () => {
    const { s: s0, erster, key } = bereit()
    const s = sende(s0, 'gate135', [zeileVon(s0, 'gate135', erster, [['t1a|hin seiteA', '5', '']])])
    const ok = reducer(s, { type: 'WKR_ABSCHLUSS', liste: K('gate135'), punkt: 'lauf:1', name: ' Vor1 ', pruefsummen: { [key]: summe(s, erster) }, restPapier: false, zeit: 9000 })
    expect(ok.wkr.abschluss[K('gate135')]?.['lauf:1']).toEqual({ name: 'Vor1', zeit: 9000, abweichend: [], papier: [] })
    const anders = reducer(s, { type: 'WKR_ABSCHLUSS', liste: K('gate135'), punkt: 'lauf:1', name: 'Vor1', pruefsummen: { [key]: '00000000' }, restPapier: false, zeit: 9000 })
    expect(anders.wkr.abschluss[K('gate135')]?.['lauf:1']?.abweichend).toEqual([key])
    // Korrektur nach dem Abschluss: Vorschlag statt Übernahme.
    const korrektur = sende(ok, 'gate135', [zeileVon(ok, 'gate135', erster, [['t1a|hin seiteA', '10', '5']], { z: 2, k: true })])
    expect(werte(korrektur, erster)['t1a|hin seiteA']).toBe('5')
    expect(korrektur.wkr.vorschlaege).toMatchObject([{ id: 'g1.2', grund: 'abgeschlossen' }])
    // Lösen: wieder direkt.
    const geloest = reducer(korrektur, { type: 'WKR_ABSCHLUSS_LOESEN', liste: K('gate135'), punkt: 'lauf:1' })
    expect(geloest.wkr.abschluss).toEqual({})
    expect(reducer(geloest, { type: 'WKR_ABSCHLUSS_LOESEN', liste: K('gate135'), punkt: 'lauf:1' })).toBe(geloest)
  })

  it('ohne Namen, zu langer Name, falscher Punkt: nichts', () => {
    const { s } = bereit()
    const basis = { type: 'WKR_ABSCHLUSS' as const, liste: K('gate135'), punkt: 'lauf:1' as const, pruefsummen: {}, restPapier: true }
    expect(reducer(s, { ...basis, name: '  ' })).toBe(s)
    expect(reducer(s, { ...basis, name: 'x'.repeat(61) })).toBe(s)
    expect(reducer(s, { ...basis, name: 'Vor1', punkt: 'lauf:x' as never })).toBe(s)
  })
})

// Prüfbefunde W1 (21.11.2026): Steg in zwei Teilen – Abschluss je Teil, Pause je Teil, Rückfrage `start` vereinigt.
describe('Steg je Teil (F16) – Abschluss, Status, Rückfrage', () => {
  const abschluss = (teil: 'ab' | 'an' | undefined, name: string, restPapier = false, zeit = 9000): Action => ({
    type: 'WKR_ABSCHLUSS',
    liste: K('steg'),
    punkt: 'lauf:1',
    name,
    pruefsummen: {},
    restPapier,
    ...(teil ? { teil } : {}),
    zeit,
  })

  it('AB schließt ab, AN-Zeilen gehen danach weiter direkt durch; AN schließt eigenen Teil ab, beide Unterschriften bleiben', () => {
    const { s: s0, erster } = bereit('steg')
    let s = sende(s0, 'steg', [zeileVon(s0, 'steg', erster, [['katalog:stegAblegen', '3', '']], { teil: 'ab', z: 1 })])
    s = reducer(s, abschluss('ab', 'Vor1'))
    expect(s.wkr.abschluss[K('steg')]).toEqual({ 'lauf:1|ab': { name: 'Vor1', zeit: 9000, abweichend: [], papier: [] } })
    // AN schließt mit offenem Start ohne „Rest auf Papier“ ab: nichts – der AB-Abschluss bleibt unberührt.
    expect(reducer(s, abschluss('an', 'Vor2'))).toBe(s)
    const an = sende(s, 'steg', [zeileVon(s, 'steg', erster, [['katalog:stegAnlegen', '7', '']], { teil: 'an', z: 1, geraet: 'g2' })])
    expect(an.wkr.vorschlaege).toEqual([])
    expect(werte(an, erster)).toMatchObject({ 'katalog:stegAnlegen': '7', 'erfasst.an@steg': '1', 'erfasst@steg': '1' })
    // Eine Korrektur des Ablegens wird dagegen Vorschlag.
    const korr = sende(an, 'steg', [zeileVon(an, 'steg', erster, [['katalog:stegAblegen', '4', '3']], { teil: 'ab', z: 2, k: true })])
    expect(korr.wkr.vorschlaege).toMatchObject([{ id: 'g1.2', grund: 'abgeschlossen' }])
    const beide = reducer(an, abschluss('an', 'Vor2', false, 9500))
    expect(beide.wkr.abschluss[K('steg')]).toEqual({
      'lauf:1|ab': { name: 'Vor1', zeit: 9000, abweichend: [], papier: [] },
      'lauf:1|an': { name: 'Vor2', zeit: 9500, abweichend: [], papier: [] },
    })
    // Lösen je Teil.
    const geloest = reducer(beide, { type: 'WKR_ABSCHLUSS_LOESEN', liste: K('steg'), punkt: 'lauf:1', teil: 'ab' })
    expect(Object.keys(geloest.wkr.abschluss[K('steg')])).toEqual(['lauf:1|an'])
  })

  it('Abschluss nur für einen begonnenen Punkt; P einer Pause steht im Abschluss', () => {
    const { s, key } = bereit('steg')
    expect(reducer(s, { ...abschluss('ab', 'Vor1'), punkt: 'lauf:2' } as Action)).toBe(s)
    const pause = reducer(s, { type: 'WKR_LISTE', liste: K('steg'), status: 'pausiert', teil: 'ab', zeit: 2000 })
    // Pausiert: Die Schlange des Teils ist leer – der Abschluss geht ohne „Rest“, nennt aber P.
    const zu = reducer(pause, abschluss('ab', 'Vor1'))
    expect(zu.wkr.abschluss[K('steg')]['lauf:1|ab'].papier).toEqual([key])
  })

  it('Status je Teil: AB meldet sich ab, AN erfasst weiter; ohne Eintrag oder bei ungeteilter Liste nichts', () => {
    const { s, erster } = bereit('steg', 'gate135')
    const ab = reducer(s, { type: 'WKR_LISTE', liste: K('steg'), status: 'abgemeldet', teil: 'ab', zeit: 2000 })
    expect(ab.wkr.listen[K('steg')].status).toBe('aktiv')
    expect(ab.wkr.listen[K('steg')].teile?.ab?.status).toBe('abgemeldet')
    const an = sende(ab, 'steg', [zeileVon(ab, 'steg', erster, [['katalog:stegAnlegen', '7', '']], { teil: 'an', z: 1, geraet: 'g2' })])
    expect(werte(an, erster)).toMatchObject({ 'katalog:stegAnlegen': '7', 'erfasst.an@steg': '1' })
    expect(reducer(s, { type: 'WKR_LISTE', liste: K('gate135'), status: 'pausiert', teil: 'ab', zeit: 2000 })).toBe(s)
    expect(reducer(s, { type: 'WKR_LISTE', liste: K('tor5'), status: 'pausiert', teil: 'ab', zeit: 2000 })).toBe(s)
  })

  it('nicht gezeigter Start, gemeinsame Zelle: „Gerätewert“ vereinigt mit dem, was dann steht', () => {
    const { s: s0 } = bereit('steg')
    const anderer = lage(s0, P1).frei[0].starter
    // Das Anlegen (am Bedienrechner abgetippt) hat schon „S“.
    let s = tippe(s0, anderer, 'disq@steg', 'S')
    s = sende(s, 'steg', [zeileVon(s, 'steg', anderer, [['disq@steg', 'A', '']], { teil: 'ab', z: 1 })])
    const rf = s.wkr.rueckfragen.find((r) => r.feld === 'disq@steg')!
    expect(rf).toMatchObject({ grund: 'start', wert: 'A', steht: 'S', vereinige: { vorher: '' } })
    // Inzwischen kommt noch ein Buchstabe dazu – auch er bleibt.
    s = tippe(s, anderer, 'disq@steg', 'S, B')
    const entschieden = reducer(s, { type: 'WKR_RUECKFRAGE', id: rf.id, wahl: 'geraet' })
    expect(werte(entschieden, anderer)['disq@steg']).toBe('S, B, A')
  })
})

describe('Aufräumen', () => {
  it('„Werte löschen“ nimmt Rückfragen, Vorschläge und Abschlüsse mit; Modus der Listen bleibt', () => {
    const { s: s0, erster } = bereit()
    let s = tippe(s0, erster, 't1a|hin seiteA', '10')
    s = sende(s, 'gate135', [zeileVon(s, 'gate135', erster, [['t1a|hin seiteA', '5', '']])])
    s = reducer(s, { type: 'WKR_ABSCHLUSS', liste: K('gate135'), punkt: 'lauf:1', name: 'Vor1', pruefsummen: {}, restPapier: true, zeit: 9000 })
    expect(s.wkr.rueckfragen).toHaveLength(1)
    const leer = reducer(s, { type: 'CLEAR_EINGABEN' })
    expect(leer.wkr).toEqual({ listen: s.wkr.listen, rueckfragen: [], vorschlaege: [], abschluss: {}, nichtVorbei: {} })
    const teil = reducer(s, { type: 'CLEAR_EINGABEN_TEIL', laeufe: [1] })
    expect(teil.wkr).toEqual({ listen: s.wkr.listen, rueckfragen: [], vorschlaege: [], abschluss: {}, nichtVorbei: {} })
    // Ein anderer Lauf lässt sie stehen.
    expect(reducer(s, { type: 'CLEAR_EINGABEN_TEIL', laeufe: [2] }).wkr).toBe(s.wkr)
  })

  it('ein entfernter Starter nimmt seine Rückfragen mit', () => {
    const { s, erster } = bereit()
    const anderer = lage(s, P1).frei[0].starter
    // Nur eine Rückfrage (nicht gezeigter Start), keine Werte: Das Starterfeld ist noch frei.
    const mit = sende(s, 'gate135', [zeileVon(s, 'gate135', anderer, [])])
    expect(mit.wkr.rueckfragen).toHaveLength(1)
    expect(Object.keys(mit.eingaben)).toEqual([])
    expect(reducer(mit, { type: 'REMOVE_STARTER', id: anderer }).wkr.rueckfragen).toEqual([])
    expect(reducer(mit, { type: 'REMOVE_STARTER', id: erster }).wkr.rueckfragen).toHaveLength(1)
  })
})

// W2 (Plan docs/plan-wkr-w2.md §4, 21.11.2026): „Papier ab Start …“, Zeilen zu Starts auf Papier werden Vorschlag (A6).
describe('WKR_PAPIER_AB (W2, A10)', () => {
  /** gate135 digital, drei Starts gezeigt (1000, 2000, 3000). */
  function drei(...typeIds: string[]) {
    let { s } = bereit(...typeIds)
    s = zeigeNaechsten(zeigeNaechsten(s, P1, 2000), P1, 3000)
    return { s, keys: s.betrieb.bereiche[P1].gezeigt.map((g) => g.ref) }
  }

  it('meldet ab: Pause ab der Zeit des gezeigten Starts, `ab`, P = Schlange ab dem Start', () => {
    const { s: s0, keys } = drei()
    const erster = JSON.parse(keys[0])[1] as string
    const s = tippe(s0, erster, 'erfasst@gate135', '1')
    const next = reducer(s, { type: 'WKR_PAPIER_AB', liste: K('gate135'), ref: keys[1], zeit: 5000 })
    expect(next.wkr.listen[K('gate135')]).toMatchObject({ status: 'abgemeldet', pausen: [{ von: 2000, bis: null, papier: [keys[1], keys[2]], ab: keys[1] }] })
    // Zweimal dasselbe: derselbe Stand; deterministisch.
    expect(reducer(next, { type: 'WKR_PAPIER_AB', liste: K('gate135'), ref: keys[1], zeit: 6000 })).toBe(next)
    expect(reducer(s, { type: 'WKR_PAPIER_AB', liste: K('gate135'), ref: keys[1], zeit: 5000 })).toEqual(next)
    // „Weiter digital“ schließt die Pause; was danach gezeigt wird, kommt wieder vom Gerät.
    const weiter = reducer(next, { type: 'WKR_LISTE', liste: K('gate135'), status: 'aktiv', zeit: 7000 })
    expect(weiter.wkr.listen[K('gate135')]).toMatchObject({ status: 'aktiv', pausen: [{ von: 2000, bis: 7000, ab: keys[1] }] })
  })

  it('nicht gezeigter Start: Pause ab jetzt; schon pausiert: die offene Pause bekommt `ab`', () => {
    const { s, keys } = drei()
    const kuenftig = refKey({ art: 'm', starter: lage(s, P1).frei[0].starter, lauf: 1 })
    expect(reducer(s, { type: 'WKR_PAPIER_AB', liste: K('gate135'), ref: kuenftig, zeit: 5000 }).wkr.listen[K('gate135')].pausen).toEqual([{ von: 5000, bis: null, papier: [], ab: kuenftig }])
    const p = reducer(s, { type: 'WKR_LISTE', liste: K('gate135'), status: 'pausiert', zeit: 4000 })
    const ab = reducer(p, { type: 'WKR_PAPIER_AB', liste: K('gate135'), ref: keys[2], zeit: 5000 })
    expect(ab.wkr.listen[K('gate135')]).toMatchObject({ status: 'abgemeldet', pausen: [{ von: 4000, bis: null, papier: keys, ab: keys[2] }] })
  })

  it('ohne Eintrag, auf Papier, unlesbare Kennung, Teil an ungeteilter Liste: derselbe Stand', () => {
    const { s, keys } = drei()
    expect(reducer(s, { type: 'WKR_PAPIER_AB', liste: K('tor5'), ref: keys[0], zeit: 5000 })).toBe(s)
    const papier = reducer(s, { type: 'WKR_LISTE', liste: K('gate135'), modus: 'papier', zeit: 4000 })
    expect(reducer(papier, { type: 'WKR_PAPIER_AB', liste: K('gate135'), ref: keys[0], zeit: 5000 })).toBe(papier)
    expect(reducer(s, { type: 'WKR_PAPIER_AB', liste: K('gate135'), ref: 'kaputt', zeit: 5000 })).toBe(s)
    expect(reducer(s, { type: 'WKR_PAPIER_AB', liste: K('gate135'), ref: keys[0], teil: 'ab', zeit: 5000 })).toBe(s)
  })

  it('Steg je Teil: nur dieser Teil wird abgemeldet', () => {
    const { s, keys } = drei('steg')
    const next = reducer(s, { type: 'WKR_PAPIER_AB', liste: K('steg'), ref: keys[2], teil: 'ab', zeit: 5000 })
    expect(next.wkr.listen[K('steg')]).toMatchObject({ status: 'aktiv', teile: { ab: { status: 'abgemeldet', pausen: [{ von: 3000, bis: null, papier: [keys[2]], ab: keys[2] }] } } })
  })

  it('Zeile zu einem Start auf Papier wird Vorschlag „papier“ (A6); Starts davor gehen weiter direkt durch', () => {
    const { s: s0, keys } = drei()
    const [erster, , dritter] = keys.map((k) => JSON.parse(k)[1] as string)
    const s = reducer(s0, { type: 'WKR_PAPIER_AB', liste: K('gate135'), ref: keys[2], zeit: 5000 })
    // P = ab dem dritten. Der erste liegt vor „Papier ab“ und ist kein P-Start: Seine (wartende) Zeile geht durch,
    // obwohl die Liste jetzt abgemeldet ist.
    const z1 = zeileVon(s, 'gate135', erster, [['t1a|hin seiteA', '5', '']], { z: 1 })
    const z3 = zeileVon(s, 'gate135', dritter, [['t1a|hin seiteA', '5', '']], { z: 2 })
    const next = sende(s, 'gate135', [z1, z3])
    expect(werte(next, erster)).toEqual({ 't1a|hin seiteA': '5', 'erfasst@gate135': '1' })
    expect(werte(next, dritter)).toEqual({})
    expect(next.wkr.vorschlaege).toMatchObject([{ id: 'g1.2', grund: 'papier', starter: dritter }])
  })

  it('Pause: Zeile zu einem Start, der in P ging, wird Vorschlag – auch nach „Weiter“', () => {
    const { s: s0, keys } = drei()
    const zweiter = JSON.parse(keys[1])[1] as string
    let s = reducer(s0, { type: 'WKR_LISTE', liste: K('gate135'), status: 'pausiert', zeit: 4000 })
    s = reducer(s, { type: 'WKR_LISTE', liste: K('gate135'), status: 'aktiv', zeit: 4500 })
    const next = sende(s, 'gate135', [zeileVon(s, 'gate135', zweiter, [['t1a|hin seiteA', '5', '']])])
    expect(werte(next, zweiter)).toEqual({})
    expect(next.wkr.vorschlaege).toMatchObject([{ grund: 'papier', starter: zweiter }])
  })
})

// W4.3 (Plan docs/plan-wkr-w4.md §6, 21.11.2026, P16, R2/R3): „Nicht vorbeigekommen“ – Haken + Kennzeichen, kein X.
describe('WKR_ZEILEN – „Nicht vorbeigekommen“ (W4.3)', () => {
  const nv = (s: AppState, typeId: string, starter: string, mehr: Partial<GeraeteZeile> & { teil?: 'ab' | 'an' } = {}) => zeileVon(s, typeId, starter, [], { n: true, ...mehr })

  it('setzt den Haken und das Kennzeichen, keine Werte, kein X; doppelt = derselbe Stand', () => {
    const { s, erster } = bereit()
    const next = sende(s, 'gate135', [nv(s, 'gate135', erster)])
    expect(werte(next, erster)).toEqual({ 'erfasst@gate135': '1' })
    expect(next.wkr.nichtVorbei).toEqual({ [K('gate135')]: [`${L1}|${erster}`] })
    expect(sende(next, 'gate135', [nv(s, 'gate135', erster)])).toBe(next)
  })

  it('eine spätere Zeile ohne Kennzeichen hebt es auf – auch eine leere („doch vorbei, fehlerfrei“)', () => {
    const { s: s0, erster } = bereit()
    const s = sende(s0, 'gate135', [nv(s0, 'gate135', erster)])
    const mitWert = sende(s, 'gate135', [zeileVon(s, 'gate135', erster, [['t1a|hin seiteA', '5', '']], { z: 2, k: true })])
    expect(mitWert.wkr.nichtVorbei).toEqual({})
    expect(werte(mitWert, erster)['t1a|hin seiteA']).toBe('5')
    const leer = sende(s, 'gate135', [zeileVon(s, 'gate135', erster, [], { z: 3, k: true })])
    expect(leer.wkr.nichtVorbei).toEqual({})
    expect(werte(leer, erster)['erfasst@gate135']).toBe('1')
  })

  it('Abtippen am Bedienrechner hebt es auf (eigene Werte der Liste), der Haken bleibt; fremde Liste nicht', () => {
    const { s: s0, erster } = bereit('gate135', 'steg')
    const s = sende(s0, 'gate135', [nv(s0, 'gate135', erster)])
    // Ein Wert einer anderen Liste (Steg) betrifft gate135 nicht.
    const fremd = tippe(s, erster, 'disq@steg', 'A')
    expect(werte(fremd, erster)['disq@steg']).toBe('A')
    expect(fremd.wkr.nichtVorbei).toEqual(s.wkr.nichtVorbei)
    const eigen = tippe(s, erster, 't1a|hin seiteA', '5')
    expect(eigen.wkr.nichtVorbei).toEqual({})
    expect(werte(eigen, erster)['erfasst@gate135']).toBe('1')
  })

  it('nicht gezeigt (Rückfrage) bzw. Liste auf Papier (Vorschlag): Kennzeichen erst mit der Entscheidung für das Gerät (R2)', () => {
    const { s, erster } = bereit()
    const anderer = lage(s, P1).frei[0].starter
    const rf = sende(s, 'gate135', [nv(s, 'gate135', anderer)])
    expect(rf.wkr.rueckfragen.map((r) => [r.feld, r.nichtVorbei])).toEqual([['erfasst@gate135', true]])
    expect(rf.wkr.nichtVorbei).toEqual({})
    const behalten = reducer(rf, { type: 'WKR_RUECKFRAGE', id: rf.wkr.rueckfragen[0].id, wahl: 'behalten' })
    expect(behalten.wkr.nichtVorbei).toEqual({})
    const geraet = reducer(rf, { type: 'WKR_RUECKFRAGE', id: rf.wkr.rueckfragen[0].id, wahl: 'geraet' })
    expect(geraet.wkr.nichtVorbei).toEqual({ [K('gate135')]: [`${L1}|${anderer}`] })
    expect(werte(geraet, anderer)['erfasst@gate135']).toBe('1')

    const papier = reducer(s, { type: 'WKR_LISTE', liste: K('tor5'), modus: 'papier', zeit: 100 })
    const vs = reducer(papier, { type: 'WKR_ZEILEN', liste: K('tor5'), quelle: { geraet: 'g1', name: 'x' }, zeilen: [nv(s, 'tor5', erster)], zeit: 5000 })
    expect(vs.wkr.vorschlaege).toMatchObject([{ nichtVorbei: true, zellen: [] }])
    expect(vs.wkr.nichtVorbei).toEqual({})
    expect(reducer(vs, { type: 'WKR_VORSCHLAG', id: vs.wkr.vorschlaege[0].id, wahl: 'verwerfen' }).wkr.nichtVorbei).toEqual({})
    const ueber = reducer(vs, { type: 'WKR_VORSCHLAG', id: vs.wkr.vorschlaege[0].id, wahl: 'uebernehmen' })
    expect(ueber.wkr.nichtVorbei).toEqual({ [K('tor5')]: [`${L1}|${erster}`] })
  })

  it('„doch vorbei“ als Vorschlag (Punkt abgeschlossen): verwerfen lässt ⊘ stehen, übernehmen hebt es auf (R3)', () => {
    const { s: s0, erster } = bereit()
    const s1 = sende(s0, 'gate135', [nv(s0, 'gate135', erster)])
    const s = reducer(s1, { type: 'WKR_ABSCHLUSS', liste: K('gate135'), punkt: 'lauf:1', name: 'Vor1', pruefsummen: {}, restPapier: true, zeit: 9000 })
    expect(s.wkr.nichtVorbei).toEqual(s1.wkr.nichtVorbei)
    const vs = sende(s, 'gate135', [zeileVon(s, 'gate135', erster, [], { z: 2, k: true })])
    expect(vs.wkr.vorschlaege).toMatchObject([{ id: 'g1.2', grund: 'abgeschlossen' }])
    expect(vs.wkr.vorschlaege[0].nichtVorbei).toBeUndefined()
    // Das Kennzeichen fällt nicht schon beim Eingang (vorher: still weg, Prüfbefund 21.11.2026).
    expect(vs.wkr.nichtVorbei).toEqual(s1.wkr.nichtVorbei)
    expect(reducer(vs, { type: 'WKR_VORSCHLAG', id: 'g1.2', wahl: 'verwerfen' }).wkr.nichtVorbei).toEqual(s1.wkr.nichtVorbei)
    expect(reducer(vs, { type: 'WKR_VORSCHLAG', id: 'g1.2', wahl: 'uebernehmen' }).wkr.nichtVorbei).toEqual({})
  })

  it('normalisiereWkr behält Kennzeichen und Teil an Rückfrage und Vorschlag, Unbrauchbares fällt weg', () => {
    const { s, erster } = bereit()
    const anderer = lage(s, P1).frei[0].starter
    const rf = sende(s, 'gate135', [nv(s, 'gate135', anderer)])
    const ids = new Set(s.starters.map((x) => x.id))
    const roh = JSON.parse(JSON.stringify(rf.wkr))
    expect(normalisiereWkr(roh, ids).rueckfragen[0].nichtVorbei).toBe(true)
    roh.rueckfragen[0].nichtVorbei = 'ja'
    roh.rueckfragen[0].teil = 'mitte'
    const n = normalisiereWkr(roh, ids).rueckfragen[0]
    expect([n.nichtVorbei, n.teil]).toEqual([undefined, undefined])
    expect(erster).toBeTruthy()
  })

  it('Steg: nur Anlegen, Schlüssel mit Teil; eine ganze Zeile des Stegs hebt es auf', () => {
    const { s: s0, erster } = bereit('steg')
    const s = sende(s0, 'steg', [nv(s0, 'steg', erster, { teil: 'an' })])
    expect(werte(s, erster)).toEqual({ 'erfasst.an@steg': '1' })
    expect(s.wkr.nichtVorbei).toEqual({ [K('steg')]: [`${L1}|${erster}|an`] })
    // Ablegen kommt dazu: Kennzeichen des Anlegens bleibt.
    const ab = sende(s, 'steg', [zeileVon(s, 'steg', erster, [], { z: 2, teil: 'ab' })])
    expect(ab.wkr.nichtVorbei).toEqual(s.wkr.nichtVorbei)
    expect(werte(ab, erster)['erfasst@steg']).toBe('1')
    const ganz = sende(s, 'steg', [zeileVon(s, 'steg', erster, [], { z: 3 })])
    expect(ganz.wkr.nichtVorbei).toEqual({})
  })

  it('„Werte löschen“ nimmt die Kennzeichen mit', () => {
    const { s: s0, erster } = bereit()
    const s = sende(s0, 'gate135', [nv(s0, 'gate135', erster)])
    expect(reducer(s, { type: 'CLEAR_EINGABEN' }).wkr.nichtVorbei).toEqual({})
    expect(reducer(s, { type: 'CLEAR_EINGABEN_TEIL', laeufe: [1] }).wkr.nichtVorbei).toEqual({})
  })
})
