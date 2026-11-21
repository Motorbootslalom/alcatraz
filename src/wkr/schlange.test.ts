import { describe, expect, it } from 'vitest'
import { reducer } from '../state/reducer'
import { lage } from '../betrieb/folge'
import { uimParallelStand, wkrBetriebsStand, zeigeNaechsten } from '../testHilfen'
import type { AppState, WkrModus, WkrStatus } from '../types'
import { danach, imBoot, papierStarts, schlange } from './schlange'
import { listenKennung, type Liste } from './liste'

// Die Schlange je Liste (Plan §3.1, §6): gezeigte Starts minus Haken, ab `seit`, ohne Pausen/P, Klasse ohne Liste
// „entfällt“, X fällt weg, Steg-Teile getrennt, Vorsteg mit den nächsten, Parallelslalom nur die eigene Seite.

const P1 = 'par_1'
const L = (typeId: string, bereich = P1): Liste => ({ bereich, typeId, racecourse: null })
const setzeListe = (s: AppState, l: Liste, zeit: number, modus?: WkrModus, status?: WkrStatus) => reducer(s, { type: 'WKR_LISTE', liste: listenKennung(l), modus, status, zeit })
const zeige = (s: AppState, n: number, zeit: number, bereich = P1) => Array.from({ length: n }).reduce<AppState>((st, _, i) => zeigeNaechsten(st, bereich, zeit + i * 100), s)
const gezeigteStarter = (s: AppState, bereich = P1) => s.betrieb.bereiche[bereich].gezeigt.map((g) => JSON.parse(g.ref)[1] as string)
const setze = (s: AppState, starter: string, feld: string, wert: string, lauf = 'manoevrieren/1') => reducer(s, { type: 'SET_EINGABEN', zellen: [{ lauf, starter, feld, wert }] })

describe('schlange', () => {
  it('ohne Eintrag oder auf Papier: leer', () => {
    const s = zeige(wkrBetriebsStand(), 2, 1000)
    expect(schlange(s, L('gate135'))).toEqual([])
    expect(schlange(setzeListe(s, L('gate135'), 100, 'papier'), L('gate135'))).toEqual([])
  })

  it('die gezeigten Starts ab `seit`, älteste oben; der Haken schließt', () => {
    let s = setzeListe(wkrBetriebsStand(), L('gate135'), 100, 'digital')
    s = zeige(s, 3, 1000)
    const starter = gezeigteStarter(s)
    const q = schlange(s, L('gate135'))
    expect(q.map((x) => x.starter)).toEqual(starter)
    expect(q.map((x) => x.zeit)).toEqual([1000, 1100, 1200])
    expect(q[0]).toMatchObject({ lauf: 'manoevrieren/1', punkt: 'lauf:1', weitere: [] })
    s = setze(s, starter[0], 'erfasst@gate135', '1')
    expect(schlange(s, L('gate135')).map((x) => x.starter)).toEqual(starter.slice(1))
    // Der Haken einer anderen Liste schließt hier nichts.
    expect(schlange(setze(s, starter[1], 'erfasst@tor5', '1'), L('gate135')).map((x) => x.starter)).toEqual(starter.slice(1))
  })

  it('`seit`: früher Gezeigtes steht nicht in der Schlange (vom Bogen abtippen)', () => {
    let s = zeige(wkrBetriebsStand(), 1, 1000)
    s = setzeListe(s, L('gate135'), 2000, 'digital')
    s = zeige(s, 1, 3000)
    expect(schlange(s, L('gate135')).map((x) => x.zeit)).toEqual([3000])
  })

  it('Klasse ohne die Liste: nur der zuletzt gezeigte Start, grau „entfällt“', () => {
    let s = setzeListe(wkrBetriebsStand(), L('mueb'), 100, 'digital')
    s = zeige(s, 2, 1000)
    const q = schlange(s, L('mueb'))
    expect(q).toHaveLength(1)
    expect(q[0]).toMatchObject({ starter: gezeigteStarter(s)[1], entfaellt: 'klasse' })
  })

  it('X im Lauf: der Start fällt weg', () => {
    let s = setzeListe(wkrBetriebsStand(), L('gate135'), 100, 'digital')
    s = zeige(s, 2, 1000)
    const [erster, zweiter] = gezeigteStarter(s)
    s = setze(s, erster, 'disq@steg', 'X')
    expect(schlange(s, L('gate135')).map((x) => x.starter)).toEqual([zweiter])
  })

  it('Steg: Ablegen und Anlegen haben getrennte Schlangen', () => {
    let s = setzeListe(wkrBetriebsStand(), L('steg'), 100, 'digital')
    s = zeige(s, 2, 1000)
    const [erster, zweiter] = gezeigteStarter(s)
    s = setze(s, erster, 'erfasst.ab@steg', '1')
    expect(schlange(s, L('steg'), 'ab').filter((x) => !x.vorab).map((x) => x.starter)).toEqual([zweiter])
    // Anlegen nachlaufend (T2): der zweite ist noch im Boot.
    expect(schlange(s, L('steg'), 'an').map((x) => x.starter)).toEqual([erster])
    // Ohne Teil zählt nur der ganze Haken.
    expect(schlange(s, L('steg')).filter((x) => !x.vorab).map((x) => x.starter)).toEqual([erster, zweiter])
  })

  // Nutzer 21.11.2026: „Eine Startnummer kann nicht gleichzeitig am Steg und im Parcours sein.“
  it('Steg-Zeitversatz: Ablegen vorab („Am Steg“), Anlegen erst nach dem Boot – nie derselbe Start in beiden', () => {
    let s = setzeListe(wkrBetriebsStand(), L('steg'), 100, 'digital')
    // Vor dem ersten Zeigen: Ablegen sieht schon „Als Nächstes“ (und die übrigen am Steg), Anlegen nichts.
    const vorher = lage(s, P1).frei.slice(0, s.anzeige.amSteg).map((e) => e.starter)
    expect(schlange(s, L('steg'), 'ab').map((x) => [x.starter, x.vorab])).toEqual(vorher.map((x) => [x, true]))
    expect(schlange(s, L('steg'), 'an')).toEqual([])
    s = zeige(s, 1, 1000)
    const [erster] = gezeigteStarter(s)
    expect(imBoot(s, P1)).toBe(s.betrieb.bereiche[P1].gezeigt[0].ref)
    expect(schlange(s, L('steg'), 'an')).toEqual([])
    // Ohne Teil: der Start im Boot braucht nur das Ablegen, die vorab nur das Ablegen.
    const ganz = schlange(s, L('steg'))
    expect(ganz.map((x) => x.starter)).toEqual([erster, ...lage(s, P1).frei.slice(0, s.anzeige.amSteg).map((e) => e.starter)])
    expect(ganz.every((x) => x.teileOffen?.ab === true && x.teileOffen.an === false)).toBe(true)
    s = setze(s, erster, 'erfasst.ab@steg', '1')
    s = zeige(s, 1, 2000)
    const ab = schlange(s, L('steg'), 'ab').map((x) => x.starter)
    const an = schlange(s, L('steg'), 'an').map((x) => x.starter)
    expect(an).toEqual([erster])
    expect(ab.some((x) => an.includes(x))).toBe(false)
    // Ende des Punkts: Ist im Lauf kein Start mehr frei, gilt der letzte als zurück.
    const rest = lage(s, P1).frei.filter((e) => e.punkt === 'lauf:1').length
    s = zeige(s, rest, 3000)
    expect(imBoot(s, P1)).toBeNull()
    const letzter = gezeigteStarter(s).at(-1)!
    expect(schlange(s, L('steg'), 'an').map((x) => x.starter)).toContain(letzter)
  })

  // Prüfbefund 21.11.2026: „Im Boot“ hing nur an `frei` – ein zurückgestellter Start bzw. eine ausgesetzte Klasse im Punkt
  // machte den gerade gezeigten Start sofort „zurück“.
  it('Im Boot auch, wenn im Punkt nur noch ein zurückgestellter Start bzw. eine ausgesetzte Klasse aussteht', () => {
    let s = setzeListe(wkrBetriebsStand(), L('steg'), 100, 'digital')
    const rest = lage(s, P1).frei.filter((e) => e.punkt === 'lauf:1').length
    s = zeige(s, rest - 2, 1000)
    const [a, c] = lage(s, P1).frei
    expect(c.punkt).toBe('lauf:1')
    const zurueck = reducer(s, { type: 'BETRIEB_ZURUECKSTELLEN', bereich: P1, ref: c.key, zeit: 5000 })
    expect(lage(zurueck, P1).zurueckgestellt.map((e) => e.key)).toEqual([c.key])
    const mitA = zeige(zurueck, 1, 6000)
    expect(lage(mitA, P1).aktuell!.key).toBe(a.key)
    expect(imBoot(mitA, P1)).toBe(a.key)
    expect(schlange(mitA, L('steg'), 'an').map((x) => x.key)).not.toContain(a.key)
    // Ausgesetzte Klasse („Boot fehlt“): C wartet aufs Boot, A ist noch im Boot.
    const ohneC = zeige(reducer(s, { type: 'BETRIEB_AUSSETZEN', bereich: P1, klasse: c.klasse, an: true, zeit: 5000 }), 1, 6000)
    expect(lage(ohneC, P1).bootFehlt.map((e) => e.key)).toContain(c.key)
    expect(imBoot(ohneC, P1)).toBe(lage(ohneC, P1).aktuell!.key)
    expect(schlange(ohneC, L('steg'), 'an').map((x) => x.key)).not.toContain(lage(ohneC, P1).aktuell!.key)
  })

  // Prüfbefund 21.11.2026: P ohne das Anlegen des Starts im Boot ließ es nach „Weiter“ wieder offen in die Schlange fallen.
  it('Abmelden bzw. Pause mit Start im Boot: sein Anlegen geht mit aufs Papier, nach „Weiter“ nicht offen', () => {
    for (const teil of [undefined, 'an'] as const) {
      let s = setzeListe(wkrBetriebsStand(), L('steg'), 100, 'digital')
      s = zeige(s, 1, 1000)
      const e1 = s.betrieb.bereiche[P1].gezeigt[0].ref
      s = setze(s, gezeigteStarter(s)[0], 'erfasst.ab@steg', '1')
      expect(imBoot(s, P1)).toBe(e1)
      s = reducer(s, { type: 'WKR_LISTE', liste: listenKennung(L('steg')), status: teil ? 'pausiert' : 'abgemeldet', ...(teil ? { teil } : {}), zeit: 2000 })
      const eintrag = s.wkr.listen[listenKennung(L('steg'))]
      const pausen = teil ? eintrag.teile![teil]!.pausen : eintrag.pausen
      expect(pausen.at(-1)!.papier).toContain(e1)
      s = zeige(s, 1, 2500)
      s = reducer(s, { type: 'WKR_LISTE', liste: listenKennung(L('steg')), status: 'aktiv', ...(teil ? { teil } : {}), zeit: 3000 })
      expect(schlange(s, L('steg'), 'an').map((x) => x.key)).not.toContain(e1)
      expect(papierStarts(s, L('steg'), 'an')).toContain(e1)
    }
  })

  it('Pause: Schlange leer, P = Offene beim Pausieren und alles in der Pause Gezeigte; nach „weiter“ nur Neues', () => {
    let s = setzeListe(wkrBetriebsStand(), L('gate135'), 100, 'digital')
    s = zeige(s, 2, 1000)
    const [erster, zweiter] = gezeigteStarter(s)
    s = setze(s, erster, 'erfasst@gate135', '1')
    s = setzeListe(s, L('gate135'), 2000, undefined, 'pausiert')
    expect(s.wkr.listen[listenKennung(L('gate135'))].pausen).toEqual([{ von: 2000, bis: null, papier: [s.betrieb.bereiche[P1].gezeigt[1].ref] }])
    expect(schlange(s, L('gate135'))).toEqual([])
    s = zeige(s, 1, 2500)
    const dritter = gezeigteStarter(s)[2]
    expect(papierStarts(s, L('gate135')).map((k) => JSON.parse(k)[1])).toEqual([zweiter, dritter])
    s = setzeListe(s, L('gate135'), 3000, undefined, 'aktiv')
    s = zeige(s, 1, 3500)
    const vierter = gezeigteStarter(s)[3]
    expect(schlange(s, L('gate135')).map((x) => x.starter)).toEqual([vierter])
    expect(papierStarts(s, L('gate135')).map((k) => JSON.parse(k)[1])).toEqual([zweiter, dritter])
  })

  it('Vorsteg: dazu die nächsten freien (Am Steg + Vor Steg)', () => {
    let s = setzeListe(wkrBetriebsStand(), L('vorsteg'), 100, 'digital')
    s = zeige(s, 1, 1000)
    const frei = lage(s, P1).frei.slice(0, s.anzeige.amSteg + s.anzeige.vorSteg).map((e) => e.starter)
    const q = schlange(s, L('vorsteg'))
    expect(q.map((x) => x.starter)).toEqual([gezeigteStarter(s)[0], ...frei])
    expect(q.slice(1).every((x) => x.vorab)).toBe(true)
    expect(q[0].vorab).toBeUndefined()
  })

  it('danach: die nächsten freien Starts dieser Liste (ohne Netz geschätzt)', () => {
    let s = setzeListe(wkrBetriebsStand(), L('gate135'), 100, 'digital')
    s = zeige(s, 1, 1000)
    expect(danach(s, L('gate135')).map((x) => x.starter)).toEqual(lage(s, P1).frei.slice(0, 5).map((e) => e.starter))
    expect(danach(s, L('gate135')).every((x) => x.zeit === undefined)).toBe(true)
  })
})

describe('schlange – Parallelslalom', () => {
  it('nur die eigene Seite; eine leere Seite fehlt', () => {
    let s = uimParallelStand()
    s = reducer(s, { type: 'BETRIEB_BEGINNEN', bereich: 'parallel', punkt: 'runde:pre', zeit: 500 })
    const A: Liste = { bereich: 'parallel', typeId: 'steg', racecourse: 'A' }
    const B: Liste = { bereich: 'parallel', typeId: 'steg', racecourse: 'B' }
    s = setzeListe(setzeListe(s, A, 100, 'digital'), B, 100, 'digital')
    const n = lage(s, 'parallel').frei.length
    s = zeige(s, n, 1000, 'parallel')
    const folge = lage(s, 'parallel').folge
    const qa = schlange(s, A)
    const qb = schlange(s, B)
    expect(qa.map((x) => x.starter)).toEqual(folge.filter((e) => e.paar!.a !== null).map((e) => e.paar!.a))
    expect(qb.map((x) => x.starter)).toEqual(folge.filter((e) => e.paar!.b !== null).map((e) => e.paar!.b))
    // Dolphin hat drei Starter: einer fährt gegen den Dummy – auf dessen Seite fehlt der Start.
    expect(qa.length + qb.length).toBe(folge.length * 2 - folge.filter((e) => e.paar!.a === null || e.paar!.b === null).length)
    expect(folge.some((e) => e.paar!.a === null || e.paar!.b === null)).toBe(true)
    expect(qa[0].lauf).toMatch(/^parallel:pre\/[12]$/)
  })

  // Prüfbefunde W1 (21.11.2026): Abschluss mit „Rest auf Papier“, Pause eines Steg-Teils.
  it('Abschluss mit „Rest auf Papier“: die offenen Starts und der Punkt fehlen danach in der Schlange', () => {
    let s = setzeListe(wkrBetriebsStand(), L('gate135'), 100, 'digital')
    s = zeige(s, 2, 1000)
    expect(schlange(s, L('gate135'))).toHaveLength(2)
    s = reducer(s, { type: 'WKR_ABSCHLUSS', liste: listenKennung(L('gate135')), punkt: 'lauf:1', name: 'Vor1', pruefsummen: {}, restPapier: true, zeit: 2000 })
    expect(s.wkr.abschluss[listenKennung(L('gate135'))]['lauf:1'].papier).toHaveLength(2)
    expect(schlange(s, L('gate135'))).toEqual([])
    // Auch ein später gezeigter Start desselben Punkts gehört nicht mehr in die Schlange (Punkt abgeschlossen).
    expect(schlange(zeige(s, 1, 3000), L('gate135'))).toEqual([])
  })

  it('Steg: Abschluss eines Teils lässt den anderen Teil in der Schlange', () => {
    let s = setzeListe(wkrBetriebsStand(), L('steg'), 100, 'digital')
    s = zeige(s, 1, 1000)
    s = reducer(s, { type: 'WKR_ABSCHLUSS', liste: listenKennung(L('steg')), punkt: 'lauf:1', name: 'Vor1', pruefsummen: {}, restPapier: true, teil: 'ab', zeit: 2000 })
    expect(schlange(s, L('steg'), 'ab')).toEqual([])
    // Das Anlegen kommt erst nach dem Boot (T2): ein zweiter Start.
    expect(schlange(s, L('steg'), 'an')).toEqual([])
    s = zeige(s, 1, 2500)
    expect(schlange(s, L('steg'), 'an')).toHaveLength(1)
    // Ohne Teil (Sicht der Liste): steht noch da, nur das Anlegen braucht ihn.
    expect(schlange(s, L('steg')).map((x) => x.teileOffen)).toEqual([{ ab: false, an: true }])
  })

  it('Steg: Pause eines Teils (Teil-Gerät, F16 mit F1) – der andere Teil erfasst weiter, P nur für den Teil', () => {
    let s = setzeListe(wkrBetriebsStand(), L('steg'), 100, 'digital')
    s = zeige(s, 1, 1000)
    const [erster] = schlange(s, L('steg'), 'ab').filter((x) => !x.vorab)
    s = reducer(s, { type: 'WKR_LISTE', liste: listenKennung(L('steg')), status: 'abgemeldet', teil: 'ab', zeit: 1500 })
    expect(s.wkr.listen[listenKennung(L('steg'))]).toMatchObject({ status: 'aktiv', teile: { ab: { status: 'abgemeldet', pausen: [{ von: 1500, bis: null, papier: [erster.key] }] } } })
    s = zeige(s, 1, 2000)
    expect(schlange(s, L('steg'), 'ab')).toEqual([])
    // Anlegen: nur der erste – der zweite ist noch im Boot (T2).
    expect(schlange(s, L('steg'), 'an')).toHaveLength(1)
    expect(papierStarts(s, L('steg'), 'ab')).toHaveLength(2)
    expect(papierStarts(s, L('steg'), 'an')).toEqual([])
    // Weiter: Was in der Pause gezeigt wurde, bleibt beim Ablegen auf Papier.
    s = reducer(s, { type: 'WKR_LISTE', liste: listenKennung(L('steg')), status: 'aktiv', teil: 'ab', zeit: 2500 })
    expect(schlange(s, L('steg'), 'ab').filter((x) => !x.vorab)).toEqual([])
    s = zeige(s, 1, 3000)
    expect(schlange(s, L('steg'), 'ab').filter((x) => !x.vorab).map((x) => x.zeit)).toEqual([3000])
  })
})
