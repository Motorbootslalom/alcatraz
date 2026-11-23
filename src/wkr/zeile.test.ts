import { describe, expect, it } from 'vitest'
import { reducer } from '../state/reducer'
import { configFor } from '../config/konfig'
import { lage, refKey } from '../betrieb/folge'
import { festgeschrieben, uimParallelStand, wkrBetriebsStand, zeigeNaechsten } from '../testHilfen'
import type { AppState } from '../types'
import { pruefeZeile, type GeraeteZeile } from './zeile'
import { istParcoursListe, listenDerVeranstaltung, listenKennung, liesListe, type Liste } from './liste'

// Prüfung einer Gerätezeile (Plan §6): jede Zellart wie die Erfassungstabelle, X nur Steg-Ablegen/Vorsteg (F5),
// Teile des Stegs (F16), fremde Felder, Klasse ohne Liste, Parallelslalom (eigene Seite), Vorsteg auf alle Versuche.
// Nur erfundene Starter (testHilfen: Vor<id>/Nach<id>, Musterclub).

const DM = configFor({ regelwerk: 'dm-2026' })
const UIM = configFor({ regelwerk: 'uim-2026' })
const P1 = 'par_1'
const P2 = 'par_2'
const L = (typeId: string, bereich = P1): Liste => ({ bereich, typeId, racecourse: null })
const m = (starter: string, lauf = 1) => refKey({ art: 'm', starter, lauf })

/** Stand mit einem gezeigten Start auf Parcours 1 (dem ersten der Folge) – und dessen Starter. */
function gezeigt(): { s: AppState; erster: string } {
  const s = zeigeNaechsten(wkrBetriebsStand(), P1, 1000)
  return { s, erster: lage(s, P1).aktuell!.eintrag!.starter }
}

const zeile = (s: string, c: GeraeteZeile['c'], mehr: Partial<GeraeteZeile> = {}): GeraeteZeile => ({ z: 1, s, c, ...mehr })

describe('Listen und Kennungen', () => {
  it('Kennung hin und zurück; Unbrauchbares ist keine Liste', () => {
    const l = L('gate135')
    expect(liesListe(listenKennung(l))).toEqual(l)
    expect(liesListe(listenKennung({ bereich: 'parallel', typeId: 'steg', racecourse: 'B' }))).toEqual({ bereich: 'parallel', typeId: 'steg', racecourse: 'B' })
    for (const x of ['', 'x', '["l","par_1","steg"]', '["l","par_1","steg","A"]', '["l","parallel","steg",null]', '["m","par_1","steg",null]', 7, null]) expect(liesListe(x)).toBeNull()
  })

  it('Listen der Veranstaltung: je Parcours die Listen mit Lauf, Knoten einmal am Tisch (W5.3, KN1), im Parallelslalom je Racecourse', () => {
    const s = wkrBetriebsStand()
    const listen = listenDerVeranstaltung(s, DM)
    expect(listen.filter((l) => l.bereich === P1).map((l) => l.typeId)).toEqual(['zeit', 'vorsteg', 'steg', 'gate135', 'gate245', 'tor5', 'mueb', 'parcours'])
    // Seit W5.3 (22.11.2026): Knoten genau einmal, im Bereich `tisch`, Kennung ["l","tisch","knoten",null].
    const knoten = listen.filter((l) => l.typeId === 'knoten')
    expect(knoten).toEqual([{ bereich: 'tisch', typeId: 'knoten', racecourse: null }])
    expect(listenKennung(knoten[0])).toBe('["l","tisch","knoten",null]')
    expect(istParcoursListe(DM, 'knoten')).toBe(false)
    const uim = uimParallelStand()
    const parallel = listenDerVeranstaltung(uim, UIM).filter((l) => l.bereich === 'parallel')
    expect(parallel.length).toBeGreaterThan(0)
    expect(new Set(parallel.map((l) => l.racecourse))).toEqual(new Set(['A', 'B']))
  })
})

describe('pruefeZeile – Werte wie in der Erfassungstabelle', () => {
  const fall = (typeId: string, c: GeraeteZeile['c'], teil?: 'ab' | 'an', mehr: Partial<GeraeteZeile> = {}) => {
    const { s, erster } = gezeigt()
    return pruefeZeile(s, DM, L(typeId), teil, 'g1', zeile(m(erster), c, mehr))
  }

  it('gültige Zeile wird aufgelöst: Lauf-Schlüssel, Haken, gezeigt', () => {
    const { s, erster } = gezeigt()
    const r = pruefeZeile(s, DM, L('gate135'), undefined, 'g1', zeile(m(erster), [['t1a|hin seiteA', '5', '']], { z: 7 }))
    expect(r).toEqual({
      id: 'g1.7',
      liste: listenKennung(L('gate135')),
      ref: m(erster),
      lauf: 'manoevrieren/1',
      weitere: [],
      starter: erster,
      zellen: [{ feld: 't1a|hin seiteA', wert: '5', vorher: '' }],
      haken: ['erfasst@gate135'],
      gezeigt: true,
      korrektur: false,
    })
  })

  it('„Fehlerfrei“ ist eine Zeile ohne Zellen, nur mit Haken', () => {
    const r = fall('gate135', [])
    expect(r).toMatchObject({ zellen: [], haken: ['erfasst@gate135'] })
  })

  it.each([
    ['Boje: Punkte', 'gate135', 't1a|hin seiteA', '10', true],
    ['Boje: Disq-Buchstabe', 'gate135', 't1a|hin seiteA', 'A', true],
    ['Boje: Buchstabe klein (die Tabelle machte ihn groß)', 'gate135', 't1a|hin seiteA', 'a', false],
    ['Boje: Ziffern und Text', 'gate135', 't1a|hin seiteA', '5x', false],
    // W4-12 (21.11.2026, BZ1/BZ2), seit R7-14 (22.11.2026, BZ6): Punkte und Buchstaben in einer Zelle, so geschrieben
    // wie gespeichert („5, A“, Katalogfolge); X nie mit Punkten oder anderen Buchstaben.
    ['Boje: Punkte und Disq-Buchstabe', 'gate135', 't1a|hin seiteA', '5, A', true],
    ['Boje: Tor 5, Zähler mit Buchstabe', 'gate135', 't5|hin seiteA', '10, A', true],
    ['Boje: zwei Buchstaben', 'gate135', 't1a|hin seiteA', '5, A, B', true],
    ['Boje: zwei Buchstaben ohne Punkte', 'gate135', 't1a|hin seiteA', 'A, B', true],
    ['Boje: alte Schreibweise ohne Komma', 'gate135', 't1a|hin seiteA', '5A', false],
    ['Boje: Buchstaben nicht in Katalogfolge', 'gate135', 't1a|hin seiteA', '5, B, A', false],
    ['Boje: Buchstabe vor den Punkten', 'gate135', 't1a|hin seiteA', 'A, 5', false],
    ['Boje: Punkte, Leerzeichen, Buchstabe', 'gate135', 't1a|hin seiteA', '5 A', false],
    ['Boje: X mit Punkten', 'gate135', 't1a|hin seiteA', '5X', false],
    ['Boje: X neben einem Buchstaben', 'gate135', 't1a|hin seiteA', 'A, X', false],
    ['Fehlercode aus dem Katalog', 'tor5', 'katalog:tor5', '1', true],
    ['Fehlercode, zwei mit Faktor', 'tor5', 'katalog:tor5', '2x1', true],
    ['Fehlercode fremd', 'tor5', 'katalog:tor5', '999', false],
    ['Disq einzeln', 'tor5', 'disq@tor5', 'A', true],
    ['Disq zwei in Tabellenform', 'tor5', 'disq@tor5', 'A, B', true],
    ['Disq ohne Leerzeichen', 'tor5', 'disq@tor5', 'A,B', false],
    ['Disq nicht erlaubt', 'tor5', 'disq@tor5', 'Z', false],
    ['Zeit', 'zeit', 'zeit1', '83,45', true],
    ['Zeit mit Doppelpunkt', 'zeit', 'zeit1', '1:23,45', true],
    ['Zeit unlesbar', 'zeit', 'zeit1', 'abc', false],
    ['Zeit mit Leerzeichen', 'zeit', 'zeit1', ' 83,45', false],
    ['Bemerkung', 'tor5', 'bemerkung@tor5', 'Motor aus', true],
    ['Bemerkung nicht getrimmt', 'tor5', 'bemerkung@tor5', 'Motor aus ', false],
    ['Bemerkung zu lang', 'tor5', 'bemerkung@tor5', 'x'.repeat(201), false],
    ['leer löscht', 'tor5', 'disq@tor5', '', true],
  ])('%s', (_name, typeId, feld, wert, gilt) => {
    const r = fall(typeId, [[feld, wert, '']])
    if (gilt) expect(r).not.toHaveProperty('fehler')
    else expect(r).toEqual({ fehler: 'wert-ungueltig' })
  })

  it('kaputte Form: wert-ungueltig', () => {
    const { s } = gezeigt()
    for (const z of [null, {}, { z: 0, s: 'x', c: [] }, { z: 1.5, s: 'x', c: [] }, { z: 1, s: 'x', c: [['a', 'b']] }, { z: 1, s: 'x', c: [], t: 'mitte' }]) {
      expect(pruefeZeile(s, DM, L('gate135'), undefined, 'g1', z)).toEqual({ fehler: 'wert-ungueltig' })
    }
  })

  it('fremdes oder doppeltes Feld: feld-fremd', () => {
    expect(fall('gate135', [['zeit1', '83,45', '']])).toEqual({ fehler: 'feld-fremd' })
    expect(fall('gate135', [['disq@tor5', 'A', '']])).toEqual({ fehler: 'feld-fremd' })
    expect(fall('gate135', [['t1a|hin seiteA', '5', ''], ['t1a|hin seiteA', '10', '']])).toEqual({ fehler: 'feld-fremd' })
  })

  it('Klasse ohne die Liste (MüB erst ab Klasse 4): feld-fremd', () => {
    expect(fall('mueb', [])).toEqual({ fehler: 'feld-fremd' })
  })
})

describe('pruefeZeile – X nur am Steg (Ablegen) und am Vorsteg (F5)', () => {
  const fall = (typeId: string, c: GeraeteZeile['c'], teil?: 'ab' | 'an', t?: 'ab' | 'an') => {
    const { s, erster } = gezeigt()
    return pruefeZeile(s, DM, L(typeId), teil, 'g1', zeile(m(erster), c, t ? { t } : {}))
  }

  it('Tor-Liste und Tor 5: x-nicht-erlaubt', () => {
    expect(fall('gate135', [['disq@gate135', 'X', '']])).toEqual({ fehler: 'x-nicht-erlaubt' })
    expect(fall('gate135', [['t1a|hin seiteA', 'X', '']])).toEqual({ fehler: 'x-nicht-erlaubt' })
    expect(fall('tor5', [['disq@tor5', 'A, X', '']])).toEqual({ fehler: 'x-nicht-erlaubt' })
  })

  it('Steg: Ablegen ja, Anlegen nein; ein Gerät für den ganzen Steg nicht in der Spalte des Anlegens', () => {
    expect(fall('steg', [['disq@steg', 'X', '']], 'ab')).not.toHaveProperty('fehler')
    expect(fall('steg', [['katalog:stegAblegen', 'X', '']], 'ab')).not.toHaveProperty('fehler')
    expect(fall('steg', [['disq@steg', 'X', '']], 'an')).toEqual({ fehler: 'x-nicht-erlaubt' })
    expect(fall('steg', [['disq@steg', 'X', '']])).not.toHaveProperty('fehler')
    expect(fall('steg', [['katalog:stegAnlegen', 'X', '']])).toEqual({ fehler: 'x-nicht-erlaubt' })
    expect(fall('steg', [['disq@steg', 'X', '']], undefined, 'an')).toEqual({ fehler: 'x-nicht-erlaubt' })
  })

  it('Vorsteg: ja', () => {
    expect(fall('vorsteg', [['disq@vorsteg', 'X', '']])).not.toHaveProperty('fehler')
  })
})

describe('pruefeZeile – Teile des Stegs (F16)', () => {
  const fall = (c: GeraeteZeile['c'], teil?: 'ab' | 'an', t?: 'ab' | 'an', typeId = 'steg') => {
    const { s, erster } = gezeigt()
    return pruefeZeile(s, DM, L(typeId), teil, 'g1', zeile(m(erster), c, t ? { t } : {}))
  }

  it('eigener Teil plus gemeinsame Spalten; Teilhaken; Disq./Bemerkung werden vereinigt', () => {
    const r = fall([['katalog:stegAblegen', '3', ''], ['disq@steg', 'A', ''], ['bemerkung@steg', 'Leine', '']], 'ab')
    expect(r).toMatchObject({
      haken: ['erfasst.ab@steg'],
      zellen: [
        { feld: 'katalog:stegAblegen', wert: '3', vorher: '' },
        { feld: 'disq@steg', wert: 'A', vorher: '', vereinige: true },
        { feld: 'bemerkung@steg', wert: 'Leine', vorher: '', vereinige: true },
      ],
    })
    expect((r as { zellen: { vereinige?: true }[] }).zellen[0].vereinige).toBeUndefined()
  })

  it('Feld des anderen Teils, abweichender Teil, Teil an einer Liste ohne Teile: teil-fremd', () => {
    expect(fall([['katalog:stegAnlegen', '7', '']], 'ab')).toEqual({ fehler: 'teil-fremd' })
    expect(fall([], 'ab', 'an')).toEqual({ fehler: 'teil-fremd' })
    expect(fall([], 'ab', undefined, 'gate135')).toEqual({ fehler: 'teil-fremd' })
    expect(fall([], undefined, 'an', 'gate135')).toEqual({ fehler: 'teil-fremd' })
  })

  it('ein Gerät für den ganzen Steg schickt je Teil (Reiter) oder die ganze Zeile', () => {
    expect(fall([['katalog:stegAnlegen', '7', '']], undefined, 'an')).toMatchObject({ haken: ['erfasst.an@steg'] })
    expect(fall([['katalog:stegAblegen', '3', ''], ['katalog:stegAnlegen', '7', '']])).toMatchObject({ haken: ['erfasst@steg'] })
  })
})

describe('pruefeZeile – Start', () => {
  it('unlesbare Kennung, Start eines anderen Parcours, gelöschter Starter: start-unbekannt', () => {
    const { s } = gezeigt()
    expect(pruefeZeile(s, DM, L('gate135'), undefined, 'g1', zeile('kaputt', []))).toEqual({ fehler: 'start-unbekannt' })
    expect(pruefeZeile(s, DM, L('gate135'), undefined, 'g1', zeile(m('v1'), []))).toEqual({ fehler: 'start-unbekannt' })
    expect(pruefeZeile(s, DM, L('gate135'), undefined, 'g1', zeile(m('gibtsnicht'), []))).toEqual({ fehler: 'start-unbekannt' })
    expect(pruefeZeile(s, DM, L('gate135', P2), undefined, 'g1', zeile(m('v1'), []))).not.toHaveProperty('fehler')
  })

  it('nicht gezeigter Start: angenommen, aber gezeigt = false (wird Rückfrage)', () => {
    const { s, erster } = gezeigt()
    const anderer = lage(s, P1).frei[0].starter
    expect(anderer).not.toBe(erster)
    expect(pruefeZeile(s, DM, L('gate135'), undefined, 'g1', zeile(m(anderer), []))).toMatchObject({ gezeigt: false })
  })

  it('Vorsteg: die nächsten freien gelten als gezeigt', () => {
    const { s } = gezeigt()
    const naechster = lage(s, P1).frei[0].starter
    expect(pruefeZeile(s, DM, L('vorsteg'), undefined, 'g1', zeile(m(naechster), []))).toMatchObject({ gezeigt: true })
  })

  it('Steg vorab (T1): nur eine Zeile des Ablegens gilt als gezeigt, nie eine ganze Steg-Zeile oder das Anlegen (Prüfbefund 21.11.2026)', () => {
    const { s } = gezeigt()
    const naechster = lage(s, P1).frei[0].starter
    expect(pruefeZeile(s, DM, L('steg'), undefined, 'g1', zeile(m(naechster), [], { t: 'ab' }))).toMatchObject({ gezeigt: true })
    expect(pruefeZeile(s, DM, L('steg'), undefined, 'g1', zeile(m(naechster), []))).toMatchObject({ gezeigt: false })
    expect(pruefeZeile(s, DM, L('steg'), undefined, 'g1', zeile(m(naechster), [], { t: 'an' }))).toMatchObject({ gezeigt: false })
  })

  it('Korrektur wird durchgereicht', () => {
    const { s, erster } = gezeigt()
    expect(pruefeZeile(s, DM, L('gate135'), undefined, 'g1', zeile(m(erster), [], { k: true }))).toMatchObject({ korrektur: true })
  })
})

describe('pruefeZeile – Parallelslalom', () => {
  const stand = () => uimParallelStand()
  const RC = (typeId: string, racecourse: 'A' | 'B'): Liste => ({ bereich: 'parallel', typeId, racecourse })

  it('der Starter der eigenen Seite aus dem festen Plan; andere Seite: seite-anders', () => {
    const s = stand()
    const start = lage(s, 'parallel').folge.find((e) => e.paar?.aFaehrt && e.paar.bFaehrt)!
    const a = pruefeZeile(s, UIM, RC('steg', 'A'), undefined, 'g1', zeile(start.key, [], { seite: 'A' }))
    expect(a).toMatchObject({ starter: start.paar!.a, lauf: `parallel:pre/${start.paar!.attempt}` })
    const b = pruefeZeile(s, UIM, RC('steg', 'B'), undefined, 'g1', zeile(start.key, []))
    expect(b).toMatchObject({ starter: start.paar!.b })
    expect(pruefeZeile(s, UIM, RC('steg', 'A'), undefined, 'g1', zeile(start.key, [], { seite: 'B' }))).toEqual({ fehler: 'seite-anders' })
  })

  it('leere Seite (Dummy): start-unbekannt', () => {
    const s = stand()
    const start = lage(s, 'parallel').folge.find((e) => e.paar && (e.paar.a === null || e.paar.b === null))!
    const leer = start.paar!.a === null ? 'A' : 'B'
    expect(pruefeZeile(s, UIM, RC('steg', leer), undefined, 'g1', zeile(start.key, []))).toEqual({ fehler: 'start-unbekannt' })
  })

  it('ein Start des Manövrierens auf einer Liste des Parallelslaloms: start-unbekannt', () => {
    const s = stand()
    const manoever = lage(s, s.parcoursList[0].id).folge[0]
    expect(pruefeZeile(s, UIM, RC('steg', 'A'), undefined, 'g1', zeile(manoever.key, []))).toEqual({ fehler: 'start-unbekannt' })
  })
})

describe('pruefeZeile – Vorsteg mit „Versuche direkt nacheinander“', () => {
  it('die Zeile gilt für jeden Versuch: Lauf 1, weitere Lauf 2', () => {
    let s = reducer(uimParallelStand(undefined, false), { type: 'SET_VERSUCHE_NACHEINANDER', on: true })
    s = reducer(s, { type: 'SET_EVENT', patch: { laufCount: 2 } })
    s = festgeschrieben(s)
    const bereich = s.parcoursList.find((p) => lage(s, p.id).folge.length > 0)!.id
    const e = lage(s, bereich).folge[0]
    const r = pruefeZeile(s, UIM, L('vorsteg', bereich), undefined, 'g1', zeile(e.key, [['disq@vorsteg', 'X', '']]))
    expect(r).toMatchObject({ lauf: 'manoevrieren/1', weitere: ['manoevrieren/2'] })
    // Eine andere Liste bleibt je Versuch.
    expect(pruefeZeile(s, UIM, L('steg', bereich), undefined, 'g1', zeile(e.key, []))).toMatchObject({ lauf: 'manoevrieren/1', weitere: [] })
  })
})

describe('pruefeZeile – „Nicht vorbeigekommen“ (W4.3, P16)', () => {
  const fall = (typeId: string, c: GeraeteZeile['c'], teil?: 'ab' | 'an', mehr: Partial<GeraeteZeile> = {}) => {
    const { s, erster } = gezeigt()
    return pruefeZeile(s, DM, L(typeId), teil, 'g1', zeile(m(erster), c, { n: true, ...mehr }))
  }

  it('Zeile ohne Zellen mit `n`: Haken und Kennzeichen, keine Zellen', () => {
    expect(fall('gate135', [])).toMatchObject({ zellen: [], haken: ['erfasst@gate135'], nichtVorbei: true })
    expect(fall('tor5', [])).toMatchObject({ nichtVorbei: true })
  })

  it('`n` nur mit leerem `c` und nur als true – sonst wert-ungueltig', () => {
    expect(fall('gate135', [['t1a|hin seiteA', '5', '']])).toEqual({ fehler: 'wert-ungueltig' })
    expect(fall('gate135', [], undefined, { n: 1 as unknown as true })).toEqual({ fehler: 'wert-ungueltig' })
  })

  it('nicht am Vorsteg und nicht im Steg-Ablegen (dort X, F5): nv-nicht-erlaubt; Steg-Anlegen ja', () => {
    expect(fall('vorsteg', [])).toEqual({ fehler: 'nv-nicht-erlaubt' })
    expect(fall('steg', [], 'ab')).toEqual({ fehler: 'nv-nicht-erlaubt' })
    // Ein Gerät für den ganzen Steg: ohne Teil nicht (das schlösse das Ablegen ein), mit Teil `an` schon.
    expect(fall('steg', [])).toEqual({ fehler: 'nv-nicht-erlaubt' })
    expect(fall('steg', [], undefined, { t: 'an' })).toMatchObject({ teil: 'an', haken: ['erfasst.an@steg'], nichtVorbei: true })
    expect(fall('steg', [], 'an')).toMatchObject({ teil: 'an', nichtVorbei: true })
  })

  it('ohne `n` fehlt das Kennzeichen in der aufgelösten Zeile', () => {
    const { s, erster } = gezeigt()
    expect(pruefeZeile(s, DM, L('gate135'), undefined, 'g1', zeile(m(erster), []))).not.toHaveProperty('nichtVorbei')
  })
})

describe('pruefeZeile – „Keine Zeit“ (W5.4, 22.11.2026, ZT4)', () => {
  const fall = (typeId: string, c: GeraeteZeile['c'], kz: unknown, mehr: Partial<GeraeteZeile> = {}) => {
    const { s, erster } = gezeigt()
    return pruefeZeile(s, DM, L(typeId), undefined, 'g1', { ...zeile(m(erster), c, mehr), kz })
  }

  it('Zeitfeld leer mit Grund: aufgelöst als `keineZeit`; leeres `kz` ersetzt (hebt auf), fehlendes lässt stehen', () => {
    expect(fall('zeit', [['zeit1', '83,45', '']], [['zeit2', 'anlage'], ['zeit3', 'nichtImZiel']])).toMatchObject({
      zellen: [{ feld: 'zeit1', wert: '83,45', vorher: '' }],
      haken: ['erfasst@zeit'],
      keineZeit: { zeit2: 'anlage', zeit3: 'nichtImZiel' },
    })
    expect(fall('zeit', [['zeit1', '83,45', '']], [])).toMatchObject({ keineZeit: {} })
    const { s, erster } = gezeigt()
    expect(pruefeZeile(s, DM, L('zeit'), undefined, 'g1', zeile(m(erster), [['zeit1', '83,45', '']]))).not.toHaveProperty('keineZeit')
    // Die leere Zelle darf mitkommen (vorher stand dort eine Zeit) – leer + Grund widerspricht sich nicht.
    expect(fall('zeit', [['zeit2', '', '80,12']], [['zeit2', 'anderes']])).toMatchObject({ keineZeit: { zeit2: 'anderes' } })
  })

  it('ZT5 (22.11.2026, R8-35): nur die erste Zeit, weitere Felder leer bzw. gar nicht dabei – die Zeile gilt', () => {
    expect(fall('zeit', [['zeit1', '83,45', '']], [])).toMatchObject({ zellen: [{ feld: 'zeit1', wert: '83,45', vorher: '' }], haken: ['erfasst@zeit'] })
    // Korrektur: eine selbst gesetzte zweite Zeit wird wieder leer (vorher = eigener Wert).
    expect(fall('zeit', [['zeit2', '', '84,10']], [])).toMatchObject({ zellen: [{ feld: 'zeit2', wert: '', vorher: '84,10' }] })
  })

  it('Form: Paare mit bekanntem Grund, nie zusammen mit `n` – sonst wert-ungueltig', () => {
    for (const kz of ['x', [['zeit1']], [['zeit1', 'kaputt']], [[1, 'anlage']], { zeit1: 'anlage' }]) expect(fall('zeit', [], kz), JSON.stringify(kz)).toEqual({ fehler: 'wert-ungueltig' })
    expect(fall('gate135', [], [['zeit1', 'anlage']], { n: true })).toEqual({ fehler: 'wert-ungueltig' })
  })

  it('Zeit UND „keine Zeit“ im selben Feld: wert-ungueltig; Feld, das keine Zeit ist, oder doppelt: feld-fremd', () => {
    expect(fall('zeit', [['zeit1', '83,45', '']], [['zeit1', 'anlage']])).toEqual({ fehler: 'wert-ungueltig' })
    expect(fall('tor5', [], [['disq@tor5', 'anlage']])).toEqual({ fehler: 'feld-fremd' })
    expect(fall('gate135', [], [['zeit1', 'anlage']])).toEqual({ fehler: 'feld-fremd' })
    expect(fall('zeit', [], [['zeit1', 'anlage'], ['zeit1', 'anderes']])).toEqual({ fehler: 'feld-fremd' })
  })
})
