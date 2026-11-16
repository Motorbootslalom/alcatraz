import { describe, expect, it } from 'vitest'
import { reducer, type Action } from '../state/reducer'
import { configFor } from '../config/konfig'
import { laufSchluessel } from '../lib/eingaben'
import { wkrBoegenZumStand } from '../lib/wkrListen'
import { betriebsStand, betriebStarter, festgeschrieben, zeigeNaechsten } from '../testHilfen'
import { abgeleiteteFolge, lage, refKey, startfolge, type FolgeEintrag } from './folge'
import { abgleich, bloecke, ersterStart, schnappschuss, verschiebe, zeigerIn } from './schritte'
import { sichtOeffentlich } from './sicht'
import type { AppState, ClassId, PunktId, Starter, VerschiebeZiel } from '../types'

// Die Schritte des Betriebs an der Start-Freigabe (Etappe E2): gezielt zeigen, zurückstellen und einreihen,
// Klasse aussetzen und vorziehen, Klassen innerhalb der Spuren ziehen, verschieben, einsteigen – sinngemäß
// nach den Tests der Startliste im Tafel-Prototyp (lib/startlist.test.ts), neu auf die abgeleitete Folge.
// Alle Starter sind erfunden (Vor<id>/Nach<id>, Musterclub).

const P1 = 'par_1'
const m = (starter: string, lauf: number) => refKey({ art: 'm', starter, lauf })

/** Starter je Klasse: `{ E: 2, '1': 3 }` → kE1, kE2, k11, k12, k13 mit Nummern E01, E02, 101 … */
function starter(zahlen: Partial<Record<ClassId, number>>): Starter[] {
  return (Object.entries(zahlen) as [ClassId, number][]).flatMap(([klasse, n]) =>
    Array.from({ length: n }, (_, i) => betriebStarter(`k${klasse}${i + 1}`, klasse, `${klasse === 'E' ? 'E' : klasse}${String(i + 1).padStart(2, '0')}`)),
  )
}

/**
 * Ein Stand mit allen Klassen auf Parcours 1, festgeschrieben, Lauf 1 begonnen. `spuren`: die Spur-Anordnung
 * (je Spur die Klassen) – sonst die automatische Verteilung bei Faktor 2.
 */
function stand(zahlen: Partial<Record<ClassId, number>>, o: { spuren?: ClassId[][]; laeufe?: number; beginnen?: boolean; nacheinander?: boolean } = {}): AppState {
  let s = betriebsStand(o.nacheinander ? [] : starter(zahlen))
  if (o.nacheinander) {
    // „Versuche nacheinander“ gibt es nur unter UIM (Regel 960).
    s = reducer(s, { type: 'SET_REGELWERK', regelwerk: 'uim-2026' })
    s = reducer(s, { type: 'ADD_STARTERS', starters: starter(zahlen) })
    s = reducer(s, { type: 'SET_VERSUCHE_NACHEINANDER', on: true })
  }
  s = reducer(s, { type: 'SET_PARCOURS_CLASSES', id: 'par_2', classIds: [] })
  s = reducer(s, { type: 'SET_PARCOURS_CLASSES', id: P1, classIds: Object.keys(zahlen) as ClassId[] })
  s = reducer(s, { type: 'SET_EVENT', patch: { laufCount: o.laeufe ?? 1 } })
  if (o.spuren) {
    s = reducer(s, { type: 'SET_PARCOURS_FACTOR', id: P1, wechselFaktor: o.spuren.length as 1 | 2 | 3 | 4 })
    const tracks = o.spuren.map((spur) => spur.map((klasse) => ({ kind: 'class' as const, klasse })))
    s = reducer(s, { type: 'SET_VERZAHNUNG_LOCK', locked: true, tracks: { [P1]: tracks } })
  } else s = festgeschrieben(s)
  return o.beginnen === false ? s : beginne(s, 1)
}

const beginne = (s: AppState, lauf: number) => reducer(s, { type: 'BETRIEB_BEGINNEN', bereich: P1, punkt: `lauf:${lauf}` })
const tu = (s: AppState, a: Action) => reducer(s, a)
/** Gezielt zeigen, mit `vorher` aus der Lage. */
const zeige = (s: AppState, ref: string, zeit = 1000) => reducer(s, { type: 'BETRIEB_ZEIGEN', bereich: P1, ref, vorher: lage(s, P1).aktuell?.key ?? null, zeit })
const weiter = (s: AppState, n = 1) => Array.from({ length: n }).reduce<AppState>((st, _, i) => zeigeNaechsten(st, P1, 1000 * (i + 1)), s)
const aussetzen = (s: AppState, klasse: ClassId, an = true) => reducer(s, { type: 'BETRIEB_AUSSETZEN', bereich: P1, klasse, an })
const vorziehen = (s: AppState, an: boolean) => reducer(s, { type: 'BETRIEB_VORZIEHEN', bereich: P1, an })
const klasseVor = (s: AppState, klasse: ClassId, vor: ClassId | null) => reducer(s, { type: 'BETRIEB_KLASSE_VOR', bereich: P1, klasse, vor })
const verschiebe_ = (s: AppState, ref: string, ziel: VerschiebeZiel) => reducer(s, { type: 'BETRIEB_VERSCHIEBEN', bereich: P1, ref, ziel })
const halten = (s: AppState, an: boolean) => reducer(s, { type: 'SET_ANZEIGE', patch: { verzahnungHalten: an } })

/** Klassenfolge – Umsortierungen werden so gut sichtbar („E1E1E“). */
const muster = (xs: readonly FolgeEintrag[]) => xs.map((e) => e.klasse).join('')
const folge = (s: AppState, punkt?: PunktId) => lage(s, P1).folge.filter((e) => punkt === undefined || e.punkt === punkt)
const frei = (s: AppState) => muster(lage(s, P1).frei)
const keys = (xs: readonly FolgeEintrag[]) => xs.map((e) => e.key)
/** Starter und Lauf je Start: „E1/1 11/1 …“ (Starter ohne das führende k). */
const mitLauf = (xs: readonly FolgeEintrag[]) => xs.map((e) => `${e.starter.slice(1)}/${e.lauf}`).join(' ')

describe('Abgleich, Schnappschuss, Zeiger (rein)', () => {
  const e = (key: string, punkt: PunktId = 'lauf:1') => ({ key, punkt })
  const abgeleitet = [e('a'), e('b'), e('c'), e('x', 'lauf:2'), e('y', 'lauf:2')]

  it('ohne Schnappschuss die abgeleitete Folge; gleicht die Folge ihr, braucht es keinen', () => {
    expect(abgleich(abgeleitet, null)).toEqual(abgeleitet)
    expect(schnappschuss(['a', 'b', 'c', 'x', 'y'], abgeleitet)).toBeNull()
    // Nur der umgestellte Lauf 1 steht im Schnappschuss; Lauf 2 folgt der Verzahnung.
    expect(schnappschuss(['b', 'a', 'c', 'x', 'y'], abgeleitet)).toEqual(['b', 'a', 'c'])
    expect(schnappschuss(['a', 'b', 'c', 'y', 'x'], abgeleitet)).toEqual(['y', 'x'])
  })

  it('Schnappschuss: ein unberührter Punkt folgt einer später geänderten Verzahnung, ein umgestellter nicht', () => {
    const snap = schnappschuss(['b', 'a', 'c', 'x', 'y'], abgeleitet)
    // Neu festgeschrieben: Lauf 2 jetzt y vor x, Lauf 1 c vorn.
    const neu = [e('c'), e('a'), e('b'), e('y', 'lauf:2'), e('x', 'lauf:2')]
    expect(abgleich(neu, snap).map((x) => x.key)).toEqual(['b', 'a', 'c', 'y', 'x'])
    // Ein Gast im Block eines anderen Laufs (x gezielt mitten in Lauf 1 gezeigt) bleibt dort; der Rest von Lauf 2
    // folgt der Verzahnung, und Lauf 3 kommt an seine Stelle.
    const drei = [...abgeleitet, e('p', 'lauf:3'), e('q', 'lauf:3')]
    const mitGast = schnappschuss(['a', 'x', 'b', 'c', 'y', 'p', 'q'], drei)
    expect(mitGast).toEqual(['a', 'x', 'b', 'c'])
    expect(abgleich(drei, mitGast).map((x) => x.key)).toEqual(['a', 'x', 'b', 'c', 'y', 'p', 'q'])
    // Ein Nachzügler am Ende von Lauf 2 hält Lauf 2 fest – ohne ihn käme er sonst an den Anfang.
    const nachzuegler = schnappschuss(['b', 'c', 'x', 'y', 'a', 'p', 'q'], drei)!
    expect(abgleich(drei, nachzuegler).map((x) => x.key)).toEqual(['b', 'c', 'x', 'y', 'a', 'p', 'q'])
    expect(nachzuegler).not.toContain('p')
  })

  it('Blöcke: je Stelle der Punkt, zu dessen Block sie gehört – Gäste anderer Punkte inbegriffen', () => {
    // Abgeleitet: jeder Punkt ein Block.
    expect(bloecke([0, 0, 1, 1, 2], 3)).toEqual([0, 0, 1, 1, 2])
    // Ein Lauf-1-Start am Ende von Lauf 2 gehört zu dessen Block, auch an der Grenze zu Lauf 3.
    expect(bloecke([0, 0, 1, 1, 0], 2)).toEqual([0, 0, 1, 1, 1])
    expect(bloecke([0, 1, 1, 0, 2, 2], 3)).toEqual([0, 1, 1, 1, 2, 2])
    // Ein Lauf-3-Start mitten in Lauf 1: Gast in Lauf 1.
    expect(bloecke([0, 2, 0, 1, 1, 2], 3)).toEqual([0, 0, 0, 1, 1, 2])
    // Ein Punkt: alles ein Block.
    expect(bloecke([0, 0, 0], 1)).toEqual([0, 0, 0])
    expect(bloecke([], 3)).toEqual([])
  })

  it('was es noch gibt, behält seine Stelle; Entferntes fällt weg; Neues kommt hinter seinen Vorgänger im Punkt', () => {
    // Schnappschuss: c vorgezogen, y vor x; „gone“ gibt es nicht mehr.
    const snap = ['c', 'a', 'gone', 'b', 'y', 'x']
    expect(abgleich(abgeleitet, snap).map((x) => x.key)).toEqual(['c', 'a', 'b', 'y', 'x'])
    // Nachmeldung n hinter b (abgeleitet: a b n c …): sie folgt b, wo immer b jetzt steht.
    const mitN = [e('a'), e('b'), e('n'), e('c'), e('x', 'lauf:2'), e('y', 'lauf:2')]
    expect(abgleich(mitN, snap).map((x) => x.key)).toEqual(['c', 'a', 'b', 'n', 'y', 'x'])
    // Ohne Vorgänger im Punkt: an den Anfang seines Blocks.
    const vorn = [e('a'), e('b'), e('c'), e('v', 'lauf:2'), e('x', 'lauf:2'), e('y', 'lauf:2')]
    expect(abgleich(vorn, snap).map((x) => x.key)).toEqual(['c', 'a', 'b', 'v', 'y', 'x'])
    // Ein ganz neuer Punkt (ein Lauf mehr): hinter alles bzw. vor den ersten späteren.
    const mehr = [...abgeleitet, e('p', 'lauf:3'), e('q', 'lauf:3')]
    expect(abgleich(mehr, snap).map((x) => x.key)).toEqual(['c', 'a', 'b', 'y', 'x', 'p', 'q'])
    const davor = [e('z', 'lauf:0' as PunktId), ...abgeleitet]
    expect(abgleich(davor, snap).map((x) => x.key)).toEqual(['z', 'c', 'a', 'b', 'y', 'x'])
  })

  it('Neues hinter den Vorgänger, der am weitesten hinten steht – nie vor einen, der in der Verzahnung vor ihm steht', () => {
    // c wurde gezielt vorn gezeigt; die Nachmeldung n steht abgeleitet hinter c – sie folgt b, nicht c.
    const mitN = [e('a'), e('b'), e('c'), e('n'), e('x', 'lauf:2')]
    expect(abgleich(mitN, ['c', 'a', 'b', 'x']).map((x) => x.key)).toEqual(['c', 'a', 'b', 'n', 'x'])
    // Ohne Umstellung: hinter den nächsten Vorgänger, wie in der abgeleiteten Folge.
    expect(abgleich(mitN, ['a', 'b', 'c', 'x']).map((x) => x.key)).toEqual(['a', 'b', 'c', 'n', 'x'])
    // Mehrere Neue hintereinander bleiben in ihrer Folge.
    const zwei = [e('a'), e('n1'), e('n2'), e('b'), e('c'), e('x', 'lauf:2')]
    expect(abgleich(zwei, ['b', 'a', 'c', 'x']).map((x) => x.key)).toEqual(['b', 'a', 'n1', 'n2', 'c', 'x'])
  })

  it('Zeiger: späteste Stelle eines Erledigten; mit „nur begonnene“ zählt ein späterer Punkt nicht', () => {
    const erledigt = new Set(['b', 'x'])
    expect(zeigerIn(abgeleitet, erledigt, new Set(['lauf:1']), false)).toBe(3)
    expect(zeigerIn(abgeleitet, erledigt, new Set(['lauf:1']), true)).toBe(1)
    expect(zeigerIn(abgeleitet, new Set(), new Set(['lauf:1']), true)).toBe(-1)
  })
})

describe('Gezielt zeigen (B-5, S-4)', () => {
  it('holt einen Starter aus einer anderen Klasse vor; der Nächste bleibt der bisherige', () => {
    const s = stand({ E: 3, '1': 3 }, { spuren: [['E'], ['1']] })
    expect(muster(folge(s))).toBe('E1E1E1')
    const ziel = folge(s).filter((x) => x.klasse === '1')[1]
    const n = zeige(s, ziel.key)
    const l = lage(n, P1)
    expect(l.aktuell?.key).toBe(ziel.key)
    expect(l.folge[0].key).toBe(ziel.key)
    expect(l.naechster?.key).toBe(m('kE1', 1))
    expect(l.nachzuholen).toEqual([])
  })

  it('sortiert einen vorgezogenen Start hinter den zuletzt gezeigten', () => {
    const s = weiter(stand({ E: 3, '1': 3 }, { spuren: [['E'], ['1']] }))
    const vorher = keys(folge(s))
    const n = zeige(s, vorher[4], 2000)
    expect(keys(folge(n)).slice(0, 2)).toEqual([vorher[0], vorher[4]])
    expect(n.betrieb.bereiche[P1].gezeigt.map((g) => g.ref)).toEqual([vorher[0], vorher[4]])
  })

  it('auch einen Start eines nicht begonnenen Laufs (S-4): erledigt, der laufende Lauf geht weiter', () => {
    const s = weiter(stand({ E: 2, '1': 2 }, { laeufe: 3 }))
    const dritter = m('k11', 3)
    const n = zeige(s, dritter)
    const l = lage(n, P1)
    expect([l.aktuell?.key, l.naechster?.key, l.nachzuholen]).toEqual([dritter, m('k11', 1), []])
    // Noch einer gezielt: Er steht hinter dem vorigen – die Folge zeigt, wie gefahren wurde (B-7).
    const zwei = zeige(n, m('kE2', 3), 2000)
    expect(keys(folge(zwei)).slice(0, 3)).toEqual([m('kE1', 1), dritter, m('kE2', 3)])
    expect(lage(zwei, P1).naechster?.key).toBe(m('k11', 1))
    // Lauf 1 und 2 fertig, Lauf 3 begonnen: Der gezeigte dritte Lauf kommt nicht noch einmal.
    let weiterGefahren = weiter(n, 3)
    weiterGefahren = weiter(beginne(weiterGefahren, 2), 4)
    weiterGefahren = beginne(weiterGefahren, 3)
    expect(lage(weiterGefahren, P1).frei.map((x) => x.key)).not.toContain(dritter)
    expect(lage(weiterGefahren, P1).frei).toHaveLength(3)
  })

  it('nie Erledigtes oder Entfallenes, nie mit falschem `vorher`; ein Zurückgestellter ist danach nicht mehr zurückgestellt', () => {
    let s = weiter(stand({ E: 2, '1': 2 }))
    expect(zeige(s, m('kE1', 1))).toBe(s)
    expect(zeige(s, m('gibt-es-nicht', 1))).toBe(s)
    expect(reducer(s, { type: 'BETRIEB_ZEIGEN', bereich: P1, ref: m('kE2', 1), vorher: null })).toBe(s)
    const x = reducer(s, { type: 'SET_EINGABEN', zellen: [{ lauf: laufSchluessel('manoevrieren', 1), starter: 'k12', feld: 'disq@steg', wert: 'X' }] })
    expect(zeige(x, m('k12', 1))).toBe(x)
    s = tu(s, { type: 'BETRIEB_ZURUECKSTELLEN', bereich: P1, ref: m('k11', 1) })
    const gezeigt = zeige(s, m('k11', 1))
    expect(gezeigt.betrieb.bereiche[P1].zurueckgestellt).toEqual([])
    expect(lage(gezeigt, P1).aktuell?.key).toBe(m('k11', 1))
  })
})

describe('Zurückstellen und einreihen (B-3, B-4)', () => {
  it('überspringt einen zurückgestellten Starter; er bleibt sichtbar', () => {
    const s = stand({ E: 2, '1': 2 })
    const erster = lage(s, P1).naechster!.key
    const n = tu(s, { type: 'BETRIEB_ZURUECKSTELLEN', bereich: P1, ref: erster })
    expect(lage(n, P1).naechster?.key).toBe(keys(folge(s))[1])
    expect(keys(lage(n, P1).zurueckgestellt)).toEqual([erster])
    expect(sichtOeffentlich(n).bereiche[0].zurueckgestellt.map((x) => x.key)).toEqual([erster])
    // Doppelt geschickt: derselbe Stand. Folge unverändert (kein Schnappschuss).
    expect(tu(n, { type: 'BETRIEB_ZURUECKSTELLEN', bereich: P1, ref: erster })).toBe(n)
    expect(n.betrieb.bereiche[P1].reihenfolge).toBeNull()
  })

  it('reiht einen Zurückgestellten als Nächsten wieder ein', () => {
    const s = stand({ E: 2, '1': 2 })
    const erster = keys(folge(s))[0]
    let n = tu(s, { type: 'BETRIEB_ZURUECKSTELLEN', bereich: P1, ref: erster })
    n = weiter(n)
    n = tu(n, { type: 'BETRIEB_EINREIHEN', bereich: P1, ref: erster, wo: 'naechster' })
    expect(lage(n, P1).naechster?.key).toBe(erster)
    expect(lage(n, P1).zurueckgestellt).toEqual([])
    // Ein zweites Mal geschickt: Er ist schon offen – derselbe Stand.
    expect(tu(n, { type: 'BETRIEB_EINREIHEN', bereich: P1, ref: erster, wo: 'naechster' })).toBe(n)
  })

  it('hängt einen Zurückgestellten ans Ende seines Laufs', () => {
    const s = stand({ E: 2, '1': 2 }, { laeufe: 2 })
    const erster = keys(folge(s))[0]
    const n = tu(tu(s, { type: 'BETRIEB_ZURUECKSTELLEN', bereich: P1, ref: erster }), { type: 'BETRIEB_EINREIHEN', bereich: P1, ref: erster, wo: 'ende' })
    expect(keys(folge(n)).indexOf(erster)).toBe(3)
    expect(folge(n)[4].punkt).toBe('lauf:2')
  })

  it('ein verpasster Lauf 1, während Lauf 2 läuft: „ans Ende“ heißt ans Ende von Lauf 2, „als Nächster“ sofort', () => {
    let s = stand({ E: 2, '1': 2 }, { laeufe: 3 })
    s = tu(s, { type: 'BETRIEB_ZURUECKSTELLEN', bereich: P1, ref: m('kE1', 1) })
    s = weiter(beginne(weiter(s, 3), 2))
    // Lauf 1 ist vorbei, der Zurückgestellte steht dort noch.
    expect(keys(lage(s, P1).zurueckgestellt)).toEqual([m('kE1', 1)])
    const ende = tu(s, { type: 'BETRIEB_EINREIHEN', bereich: P1, ref: m('kE1', 1), wo: 'ende' })
    const l = lage(ende, P1)
    const i = keys(l.folge).indexOf(m('kE1', 1))
    expect([l.folge[i - 1].punkt, l.folge[i + 1].punkt]).toEqual(['lauf:2', 'lauf:3'])
    expect(keys(l.frei).at(-1)).toBe(m('kE1', 1))
    const naechster = tu(s, { type: 'BETRIEB_EINREIHEN', bereich: P1, ref: m('kE1', 1), wo: 'naechster' })
    expect(lage(naechster, P1).naechster?.key).toBe(m('kE1', 1))
  })

  it('reiht einen Nachzuholenden ein; Erledigtes lässt sich nicht zurückstellen', () => {
    // X in Lauf 1, nach dem Zeiger entfernt: nachzuholen (E1) – E2 reiht ihn ans Ende des Laufs.
    let s = stand({ E: 2, '1': 2 })
    const x = (st: AppState, wert: string) => reducer(st, { type: 'SET_EINGABEN', zellen: [{ lauf: laufSchluessel('manoevrieren', 1), starter: 'k11', feld: 'disq@steg', wert }] })
    s = x(weiter(x(s, 'X'), 2), '')
    expect(keys(lage(s, P1).nachzuholen)).toEqual([m('k11', 1)])
    const n = tu(s, { type: 'BETRIEB_EINREIHEN', bereich: P1, ref: m('k11', 1), wo: 'ende' })
    expect(lage(n, P1).nachzuholen).toEqual([])
    expect(keys(lage(n, P1).frei)).toEqual([m('k12', 1), m('k11', 1)])
    expect(tu(n, { type: 'BETRIEB_ZURUECKSTELLEN', bereich: P1, ref: m('kE1', 1) })).toBe(n)
  })
})

describe('Klassen vorziehen (B-10)', () => {
  /** Klasse 1 allein auf Spur 1, E und 2 teilen sich Spur 2: Am Ende steht ein unverzahnter Block aus Klasse 2. */
  const drei = (laeufe = 1) => stand({ E: 3, '1': 3, '2': 3 }, { spuren: [['1'], ['E', '2']], laeufe })

  it('führt die Klassen in der Reihenfolge ihres nächsten Starts', () => {
    const s = drei()
    expect(muster(folge(s))).toBe('1E1E1E222')
    expect(sichtOeffentlich(s).bereiche[0].klassenFolge.map((k) => [k.klasse, k.offen, k.ausgesetzt, k.verschiebbar])).toEqual([
      ['1', 3, false, false],
      ['E', 3, false, true],
      ['2', 3, false, true],
    ])
  })

  it('macht die gezogene Klasse zur nächsten – ohne die Spuren aufzugeben', () => {
    const n = klasseVor(drei(), '2', '1')
    expect(muster(folge(n))).toBe('212121EEE')
    expect(sichtOeffentlich(n).bereiche[0].klassenFolge.map((k) => k.klasse)).toEqual(['2', '1', 'E'])
  })

  it('schiebt eine Klasse innerhalb ihrer Spur nach hinten', () => {
    expect(muster(folge(klasseVor(drei(), 'E', null)))).toBe('121212EEE')
  })

  it('eine Klasse, die ihre Spur für sich hat, lässt sich nicht verschieben', () => {
    const s = drei()
    expect(klasseVor(s, '1', null)).toBe(s)
    expect(klasseVor(s, '1', 'E')).toBe(s)
    // Wird E vorgezogen, beginnt die andere Spur – Klasse 1 behält jeden zweiten Platz.
    expect(muster(folge(klasseVor(s, 'E', '1')))).toBe('E1E1E1222')
  })

  it('lässt gefahrene Starts und den Verlauf unangetastet', () => {
    const s = weiter(drei(), 2)
    const n = klasseVor(s, '2', '1')
    expect(keys(folge(n)).slice(0, 2)).toEqual(keys(folge(s)).slice(0, 2))
    expect(n.betrieb.bereiche[P1].gezeigt).toEqual(s.betrieb.bereiche[P1].gezeigt)
    expect(folge(n)).toHaveLength(9)
    // Klasse 2 zuerst, E in ihrer Spur dahinter; Klasse 1 behält jeden zweiten Platz.
    expect(muster(lage(n, P1).frei)).toBe('21212EE')
  })

  it('rührt die Folge einer ausgesetzten Klasse nicht an; wer durch das Aussetzen allein fährt, steht fest', () => {
    const s = aussetzen(vorziehen(drei(), false), '1')
    const vorher = keys(folge(s).filter((x) => x.klasse === '1'))
    const n = klasseVor(s, '2', 'E')
    expect(keys(folge(n).filter((x) => x.klasse === '1'))).toEqual(vorher)
    expect(frei(n)).toBe('222EEE')
    // Setzt E aus, haben 1 und 2 ihre Spur je für sich – keine lässt sich ziehen.
    const ohneE = aussetzen(vorziehen(drei(), false), 'E')
    expect(klasseVor(ohneE, '2', '1')).toBe(ohneE)
    expect(sichtOeffentlich(ohneE).bereiche[0].klassenFolge.map((k) => [k.klasse, k.verschiebbar])).toEqual([
      ['1', false],
      ['2', false],
      ['E', false],
    ])
  })

  it('rührt einen späteren Lauf nicht an', () => {
    const s = drei(2)
    const n = klasseVor(s, '2', '1')
    expect(muster(folge(n, 'lauf:1'))).toBe('212121EEE')
    expect(keys(folge(n, 'lauf:2'))).toEqual(keys(folge(s, 'lauf:2')))
  })

  it('tut nichts, wenn die Klasse schon dort steht oder es sie hier nicht gibt', () => {
    const s = drei()
    expect(klasseVor(s, 'E', 'E')).toBe(s)
    expect(klasseVor(s, 'E', '2')).toBe(s)
    expect(klasseVor(s, '5', null)).toBe(s)
  })
})

describe('Klasse setzt aus (V-5, L-7)', () => {
  /** Das Beispiel aus dem Lastenheft: Spur 1 fährt E, 1, 3; Spur 2 fährt 2, 6. */
  const v5 = (laeufe = 2) => stand({ E: 2, '1': 6, '2': 6, '3': 1, '6': 2 }, { spuren: [['E', '1', '3'], ['2', '6']], laeufe })

  it('E2E21212121216163 → mit Vorziehen E6E61111113, Klasse 2 am Ende gekennzeichnet; spätere Läufe unverändert', () => {
    const s = v5()
    expect(muster(folge(s, 'lauf:1'))).toBe('E2E21212121216163')
    const n = aussetzen(s, '2')
    expect(n.betrieb.bereiche[P1].vorziehen).toBe(true)
    expect(frei(n)).toBe('E6E61111113')
    expect(muster(folge(n, 'lauf:1'))).toBe('E6E61111113' + '222222')
    expect(muster(folge(n, 'lauf:2'))).toBe('E2E21212121216163')
    const l = lage(n, P1)
    expect(muster(l.bootFehlt.filter((x) => x.punkt === 'lauf:1'))).toBe('222222')
    const b = sichtOeffentlich(n).bereiche[0]
    expect(b.bootFehlt.filter((x) => x.punkt === 'lauf:1')).toHaveLength(6)
    expect(b.klassenFolge.at(-1)).toEqual({ klasse: '2', offen: 6, ausgesetzt: true, verschiebbar: false })
    expect(b.vorziehen).toBe(true)
    expect(b.abweichend).toBe(true)
  })

  it('ohne Vorziehen schließen sich nur die Lücken: EE111116163, die Folge bleibt', () => {
    const s = vorziehen(v5(), false)
    const n = aussetzen(s, '2')
    expect(frei(n)).toBe('EE111116163')
    expect(n.betrieb.bereiche[P1].reihenfolge).toBeNull()
    expect(sichtOeffentlich(n).bereiche[0].klassenFolge.find((k) => k.klasse === '2')).toMatchObject({ ausgesetzt: true, offen: 6 })
  })

  it('Rückkehr verzahnt den Rest des Laufs neu – mit Vorziehen und ohne; spätere Läufe unverändert', () => {
    for (const mitVorziehen of [true, false]) {
      let s = aussetzen(vorziehen(v5(), mitVorziehen), '2')
      s = weiter(s, 3)
      const gezeigt = s.betrieb.bereiche[P1].gezeigt
      const zurueck = aussetzen(s, '2', false)
      const l = lage(zurueck, P1)
      expect(zurueck.betrieb.bereiche[P1].gezeigt, String(mitVorziehen)).toEqual(gezeigt)
      expect(l.bootFehlt, String(mitVorziehen)).toEqual([])
      expect(l.nachzuholen, String(mitVorziehen)).toEqual([])
      // Erledigt: E, 6, E (mit Vorziehen) bzw. E, E, 1 (ohne); der Rest wieder im Wechsel der Spuren,
      // Klasse 2 als Erste der anderen Spur.
      const rest = muster(l.frei)
      expect(rest.length, String(mitVorziehen)).toBe(14)
      expect(rest.slice(0, 10), String(mitVorziehen)).toBe(mitVorziehen ? '2121212121' : '2121212121')
      expect(muster(folge(zurueck, 'lauf:2')), String(mitVorziehen)).toBe('E2E21212121216163')
    }
  })

  it('überspringt die ausgesetzte Klasse in jedem Fall; der Lauf stockt, er ist nicht zu Ende', () => {
    for (const an of [true, false]) {
      const s = aussetzen(vorziehen(stand({ E: 3, '1': 3 }, { spuren: [['E'], ['1']] }), an), 'E')
      expect(lage(s, P1).naechster?.klasse, String(an)).toBe('1')
      expect(lage(s, P1).frei, String(an)).toHaveLength(3)
    }
    const nurE = aussetzen(stand({ E: 2 }), 'E')
    const b = sichtOeffentlich(nurE).bereiche[0]
    expect([b.offen, b.offenZahl, b.bootFehlt.length]).toEqual([[], 0, 2])
    expect(b.klassenFolge).toEqual([{ klasse: 'E', offen: 2, ausgesetzt: true, verschiebbar: false }])
  })

  it('webt die Klasse beim Zurückkommen wieder in den Rest ein (Vorbeigezogene inklusive)', () => {
    let s = aussetzen(vorziehen(stand({ E: 3, '1': 3 }, { spuren: [['E'], ['1']] }), false), 'E')
    s = weiter(s, 2)
    expect(muster(folge(s))).toBe('E1E1E1')
    // kE1 und kE2 hat der Zeiger überholt – sie fehlen, sind aber keine Nachzügler.
    expect(lage(s, P1).nachzuholen).toEqual([])
    const zurueck = aussetzen(s, 'E', false)
    // Ohne Neu-Verzahnung führen jetzt drei E am Stück – am Steg fehlte die Zeit für den Bootswechsel.
    expect(muster(folge(zurueck))).toBe('11E1EE')
    expect(keys(lage(zurueck, P1).frei)).toEqual([m('kE1', 1), m('k13', 1), m('kE2', 1), m('kE3', 1)])
  })

  it('lässt gefahrene Starts und den Verlauf unangetastet; vermischt die Läufe nicht', () => {
    const s = weiter(stand({ E: 3, '1': 3 }, { spuren: [['E'], ['1']], laeufe: 2 }), 2)
    const n = aussetzen(s, 'E')
    expect(keys(folge(n)).slice(0, 2)).toEqual(keys(folge(s)).slice(0, 2))
    expect(n.betrieb.bereiche[P1].gezeigt).toEqual(s.betrieb.bereiche[P1].gezeigt)
    // Beide Läufe begonnen: Jeder wird für sich gewoben.
    const beide = aussetzen(aussetzen(beginne(stand({ E: 3, '1': 3 }, { spuren: [['E'], ['1']], laeufe: 2 }), 2), '1'), '1', false)
    expect(muster(folge(beide, 'lauf:1'))).toBe('E1E1E1')
    expect(muster(folge(beide, 'lauf:2'))).toBe('E1E1E1')
  })

  it('Vorziehen später einschalten wirkt sofort; ausschalten lässt die Folge stehen; ausdrücklich, nie umschaltend', () => {
    const s = aussetzen(vorziehen(v5(), false), '2')
    const an = vorziehen(s, true)
    expect(frei(an)).toBe('E6E61111113')
    expect(vorziehen(an, true)).toBe(an)
    const aus = vorziehen(an, false)
    expect(frei(aus)).toBe('E6E61111113')
    expect(aus.betrieb.bereiche[P1].vorziehen).toBe(false)
  })

  it('fehlt das Boot schon vor dem Beginn: Lauf 1 und jeder neu begonnene Lauf fahren vorgezogen', () => {
    let s = stand({ E: 2, '1': 6, '2': 6, '3': 1, '6': 2 }, { spuren: [['E', '1', '3'], ['2', '6']], laeufe: 2, beginnen: false })
    s = aussetzen(s, '2')
    expect(muster(folge(s, 'lauf:1'))).toBe('E6E61111113222222')
    s = beginne(s, 1)
    expect(frei(s)).toBe('E6E61111113')
    s = beginne(weiter(s, 11), 2)
    expect(muster(folge(s, 'lauf:2'))).toBe('E6E61111113222222')
  })

  it('das Boot kommt erst zurück, wenn sein Lauf vorbei ist: Seine Starts dort sind nachzuholen', () => {
    let s = aussetzen(stand({ E: 2, '1': 2 }, { spuren: [['E'], ['1']], laeufe: 2 }), 'E')
    s = weiter(beginne(weiter(s, 2), 2))
    expect(keys(lage(s, P1).bootFehlt)).toEqual([m('kE1', 1), m('kE2', 1), m('kE1', 2), m('kE2', 2)])
    const zurueck = aussetzen(s, 'E', false)
    expect(keys(lage(zurueck, P1).nachzuholen)).toEqual([m('kE1', 1), m('kE2', 1)])
    expect(keys(lage(zurueck, P1).frei)).toEqual([m('kE1', 2), m('k12', 2), m('kE2', 2)])
  })

  it('nur Klassen dieses Parcours; doppelt = derselbe Stand', () => {
    const s = v5()
    expect(aussetzen(s, '5')).toBe(s)
    expect(aussetzen(s, '2', false)).toBe(s)
    const n = aussetzen(s, '2')
    expect(aussetzen(n, '2')).toBe(n)
  })
})

describe('Verschieben mit gehaltener Verzahnung (V-7)', () => {
  const zwei = () => stand({ E: 4, '1': 4 }, { spuren: [['E'], ['1']] })

  it('hält das Wechselmuster, wenn ein Start mittendrin woanders hin geht', () => {
    const s = zwei()
    const k = keys(folge(s))
    expect(muster(folge(s))).toBe('E1E1E1E1')
    const n = verschiebe_(s, k[0], { vor: k[4] })
    expect(muster(folge(n))).toBe('E1E1E1E1')
    // Er ist wirklich gewandert – nur eben auf einen Platz seiner eigenen Spur.
    expect(keys(folge(n))[2]).toBe(k[0])
    expect(keys(folge(n))[0]).toBe(k[2])
  })

  it('zerreißt das Muster, wenn das Halten abgeschaltet ist', () => {
    const s = halten(zwei(), false)
    const k = keys(folge(s))
    expect(muster(folge(verschiebe_(s, k[0], { vor: k[4] })))).toBe('1E1EE1E1')
  })

  it('macht aus einem Start am Ende den letzten seiner Spur; die andere Spur bleibt', () => {
    const s = zwei()
    const k = keys(folge(s))
    const n = verschiebe_(s, k[0], { nach: k[7] })
    expect(muster(folge(n))).toBe('E1E1E1E1')
    expect(keys(folge(n))[6]).toBe(k[0])
    expect(keys(folge(n)).filter((_, i) => i % 2 === 1)).toEqual(k.filter((_, i) => i % 2 === 1))
  })

  it('rührt Gefahrenes nicht an, schiebt nichts davor; ein Gefahrener lässt sich nicht verschieben', () => {
    const s = weiter(zwei(), 2)
    const k = keys(folge(s))
    const n = verschiebe_(s, k[4], { nach: k[7] })
    expect(keys(folge(n)).slice(0, 2)).toEqual(k.slice(0, 2))
    expect(n.betrieb.bereiche[P1].gezeigt).toEqual(s.betrieb.bereiche[P1].gezeigt)
    expect(verschiebe_(s, k[0], { nach: k[7] })).toBe(s)
    // „Vor den ersten“ heißt: direkt hinter den Zeiger.
    const vorn = verschiebe_(halten(s, false), k[5], { vor: k[0] })
    expect(keys(folge(vorn)).slice(0, 3)).toEqual([k[0], k[1], k[5]])
  })

  it('fällt auf einfaches Umsetzen zurück, wenn die Spur unbekannt ist', () => {
    const s = zwei()
    const l = lage(s, P1)
    const k = keys(l.folge)
    const neu = verschiebe(l, k[0], { vor: k[4] }, [])!
    expect(neu.slice(0, 4)).toEqual([k[1], k[2], k[3], k[0]])
  })

  it('unbekanntes Ziel, sich selbst als Ziel oder schon dort: derselbe Stand', () => {
    const s = zwei()
    const k = keys(folge(s))
    expect(verschiebe_(s, k[0], { vor: m('weg', 1) })).toBe(s)
    expect(verschiebe_(s, k[0], { vor: k[0] })).toBe(s)
    expect(verschiebe_(s, k[0], { vorPunkt: 'lauf:5' })).toBe(s)
    expect(verschiebe_(s, k[0], { vor: k[1] })).toBe(s)
    const n = verschiebe_(s, k[0], { vor: k[4] })
    expect(verschiebe_(n, k[0], { vor: k[4] })).toBe(n)
  })
})

describe('An Laufgrenzen verschieben (S-4, S-6, S-9)', () => {
  const drei = () => stand({ E: 2, '1': 2 }, { laeufe: 3 })

  it('den dritten Lauf ans Ende von Lauf 2 – mit und ohne gehaltene Verzahnung', () => {
    for (const an of [false, true]) {
      const s = halten(drei(), an)
      const dritter = folge(s, 'lauf:3')[3].key
      const n = verschiebe_(s, dritter, { nachPunkt: 'lauf:2' })
      const k = keys(folge(n))
      const i = k.indexOf(dritter)
      // Hinter allen Starts von Lauf 2, vor den übrigen von Lauf 3 (mit Halten auf dem Platz seiner Spur).
      expect(Math.max(...folge(n, 'lauf:2').map((x) => k.indexOf(x.key))), String(an)).toBeLessThan(i)
      expect(folge(n)).toHaveLength(12)
      // Über eine Laufgrenze genau ans Ziel – auch mit Halten (BETRIEB_ANNAHMEN.haltenImBlock).
      expect(k.slice(i - 1, i + 2).map((key) => folge(n).find((x) => x.key === key)!.punkt), String(an)).toEqual(['lauf:2', 'lauf:3', 'lauf:3'])
      expect(keys(folge(n)).slice(0, 8), String(an)).toEqual(keys(folge(s)).slice(0, 8))
    }
  })

  it('mit gehaltener Verzahnung (Vorgabe) über Laufgrenzen: kein fremder Start wechselt den Lauf', () => {
    const s = drei()
    expect(s.anzeige.verzahnungHalten).toBe(true)
    // Ein Lauf-1-Start „vor Lauf 3“: Lauf 1 ohne ihn, Lauf 2 unverändert, er direkt davor.
    const n = verschiebe_(s, m('kE1', 1), { vorPunkt: 'lauf:3' })
    const k = keys(folge(n))
    expect(k.slice(0, 3)).toEqual(keys(folge(s, 'lauf:1')).filter((x) => x !== m('kE1', 1)))
    expect(k.slice(3, 7)).toEqual(keys(folge(s, 'lauf:2')))
    expect([k.indexOf(m('kE1', 1)), folge(n)[8].punkt]).toEqual([7, 'lauf:3'])
    // „Vorziehen“ eines Lauf-3-Starts, während Lauf 2 läuft: Lauf 2 bleibt, wie er ist; er steht vorn und wartet.
    const l2 = weiter(beginne(weiter(s, 4), 2))
    const vorher = keys(lage(l2, P1).frei)
    const v = verschiebe_(l2, m('kE2', 3), { vor: vorher[0] })
    expect(keys(lage(v, P1).frei)).toEqual(vorher)
    expect(lage(v, P1).offen[0].key).toBe(m('kE2', 3))
    // Im eigenen Lauf rutscht die Spur weiter mit: „vor Lauf 3“ für einen Lauf-2-Start ist der letzte Platz seiner Spur.
    const imLauf = verschiebe_(s, m('kE1', 2), { vorPunkt: 'lauf:3' })
    expect(muster(folge(imLauf, 'lauf:2'))).toBe('E1E1')
    expect(keys(folge(imLauf, 'lauf:2'))).toEqual([m('kE2', 2), m('k11', 2), m('kE1', 2), m('k12', 2)])
  })

  it('den zweiten vor Beginn von Lauf 3: hinter allen anderen Starts von Lauf 2', () => {
    const s = halten(drei(), false)
    const zweiter = folge(s, 'lauf:2')[0].key
    const n = verschiebe_(s, zweiter, { vorPunkt: 'lauf:3' })
    const k = keys(folge(n))
    expect(k.indexOf(zweiter)).toBe(7)
    expect(folge(n)[8].punkt).toBe('lauf:3')
    // Während Lauf 2 läuft, ist er dessen letzter Start.
    const lauf2 = beginne(weiter(n, 4), 2)
    expect(keys(lage(lauf2, P1).frei).at(-1)).toBe(zweiter)
  })

  it('S-9: ein Lauf-1-Start vor Lauf 2 bleibt freigegeben und kommt vor den Starts von Lauf 2', () => {
    let s = halten(drei(), false)
    const nachzuegler = keys(folge(s))[0]
    s = verschiebe_(s, nachzuegler, { vorPunkt: 'lauf:2' })
    s = weiter(s, 3)
    // Die anderen drei Starts von Lauf 1 sind durch, der Nachzügler steht noch – freigegeben.
    expect(lage(s, P1).naechster?.key).toBe(nachzuegler)
    s = beginne(s, 2)
    expect(lage(s, P1).frei[0].key).toBe(nachzuegler)
    expect(lage(s, P1).frei[1].punkt).toBe('lauf:2')
  })

  it('S-9: ein dritter Lauf mitten in Lauf 2, dort übergangen, wartet auf Lauf 3 – kein Nachzügler', () => {
    let s = halten(beginne(weiter(drei(), 4), 2), false)
    const dritter = m('kE1', 3)
    s = verschiebe_(s, dritter, { vor: folge(s, 'lauf:2')[2].key })
    s = weiter(s, 4)
    const l = lage(s, P1)
    expect([l.naechster, l.nachzuholen]).toEqual([null, []])
    expect(l.offen[0].key).toBe(dritter)
    expect(lage(beginne(s, 3), P1).naechster?.key).toBe(dritter)
  })
})

describe('Einsteigen (mitten im Wettkampf)', () => {
  it('beginnt direkt mit Lauf 3: alles davor erledigt ohne Anzeige, nichts in `gezeigt`', () => {
    const s = stand({ E: 2, '1': 2 }, { laeufe: 3, beginnen: false })
    const ziel = ersterStart(lage(s, P1), 'lauf:3')!
    const n = tu(s, { type: 'BETRIEB_AB', bereich: P1, ref: ziel.key })
    const b = n.betrieb.bereiche[P1]
    expect(b.begonnen).toEqual(['lauf:1', 'lauf:2', 'lauf:3'])
    expect(b.gezeigt).toEqual([])
    expect(b.ohneAnzeige).toHaveLength(8)
    expect(lage(n, P1).naechster?.key).toBe(ziel.key)
    expect(lage(n, P1).nachzuholen).toEqual([])
    // Doppelt geschickt: derselbe Stand.
    expect(tu(n, { type: 'BETRIEB_AB', bereich: P1, ref: ziel.key })).toBe(n)
  })

  it('steigt in einem Lauf bei einer Klasse ein; die Sicht nennt die Einstiege', () => {
    const s = stand({ E: 2, '1': 2 }, { laeufe: 2, beginnen: false })
    const einstieg = sichtOeffentlich(s).bereiche[0].einstieg
    const ziel = einstieg.find((x) => x.punkt === 'lauf:2' && x.klasse === '1')!
    expect(ziel.key).toBe(ersterStart(lage(s, P1), 'lauf:2', '1')!.key)
    expect(einstieg.filter((x) => x.punkt === 'lauf:1').map((x) => x.klasse)).toEqual([null, 'E', '1'])
    const n = tu(s, { type: 'BETRIEB_AB', bereich: P1, ref: ziel.key })
    expect(lage(n, P1).naechster?.key).toBe(ziel.key)
    expect(n.betrieb.bereiche[P1].begonnen).toEqual(['lauf:1', 'lauf:2'])
  })

  it('macht einen zu späten Einstieg mit einem früheren wieder gut', () => {
    const s = stand({ E: 2, '1': 2 }, { laeufe: 3, beginnen: false })
    const zuWeit = tu(s, { type: 'BETRIEB_AB', bereich: P1, ref: ersterStart(lage(s, P1), 'lauf:3')!.key })
    const zurueck = tu(zuWeit, { type: 'BETRIEB_AB', bereich: P1, ref: ersterStart(lage(zuWeit, P1), 'lauf:2')!.key })
    const b = zurueck.betrieb.bereiche[P1]
    // Lauf 3 ist nicht mehr begonnen – sonst ginge es nach Lauf 2 ungefragt weiter (S-8).
    expect(b.begonnen).toEqual(['lauf:1', 'lauf:2'])
    expect(b.ohneAnzeige).toEqual(keys(folge(s, 'lauf:1')))
    expect(lage(zurueck, P1).frei).toHaveLength(4)
  })

  it('zu spät eingestiegen, schon einen gezeigt, dann früher eingestiegen: der gewählte Start ist der Nächste', () => {
    // Innerhalb eines Laufs: ab dem dritten Start, ihn gezeigt, dann ab dem ersten.
    let s = stand({ E: 2, '1': 2 }, { spuren: [['E'], ['1']], laeufe: 2, beginnen: false })
    s = weiter(tu(s, { type: 'BETRIEB_AB', bereich: P1, ref: m('kE2', 1) }))
    expect(lage(s, P1).aktuell?.key).toBe(m('kE2', 1))
    let n = tu(s, { type: 'BETRIEB_AB', bereich: P1, ref: ersterStart(lage(s, P1), 'lauf:1')!.key })
    let l = lage(n, P1)
    expect([l.naechster?.key, l.nachzuholen]).toEqual([m('kE1', 1), []])
    // E2 ist gefahren und bleibt vorn; E1 und 11 rücken hinter ihn – die Folge zeigt, wie gefahren wird (B-7).
    expect(mitLauf(folge(n, 'lauf:1'))).toBe('E2/1 E1/1 11/1 12/1')
    expect(mitLauf(l.frei)).toBe('E1/1 11/1 12/1')
    expect(n.betrieb.bereiche[P1].gezeigt.map((g) => g.ref)).toEqual([m('kE2', 1)])
    // Über Laufgrenzen: ab Lauf 2, einen gezeigt, dann ab Lauf 1.
    s = weiter(tu(stand({ E: 2, '1': 2 }, { spuren: [['E'], ['1']], laeufe: 2, beginnen: false }), { type: 'BETRIEB_AB', bereich: P1, ref: m('kE1', 2) }))
    n = tu(s, { type: 'BETRIEB_AB', bereich: P1, ref: m('kE1', 1) })
    l = lage(n, P1)
    expect([l.naechster?.key, l.nachzuholen, l.begonnen]).toEqual([m('kE1', 1), [], ['lauf:1', 'lauf:2']])
    expect(keys(l.frei).slice(0, 4)).toEqual(keys(folge(stand({ E: 2, '1': 2 }, { spuren: [['E'], ['1']], laeufe: 2 }), 'lauf:1')))
    // Doppelt geschickt: derselbe Stand.
    expect(tu(n, { type: 'BETRIEB_AB', bereich: P1, ref: m('kE1', 1) })).toBe(n)
  })

  it('lässt tatsächlich Gefahrenes stehen', () => {
    const s = weiter(stand({ E: 2, '1': 2 }, { laeufe: 2 }))
    const n = tu(s, { type: 'BETRIEB_AB', bereich: P1, ref: keys(folge(s))[0] })
    expect(n).toBe(s)
    const spaeter = tu(s, { type: 'BETRIEB_AB', bereich: P1, ref: keys(folge(s))[3] })
    expect(spaeter.betrieb.bereiche[P1].gezeigt).toEqual(s.betrieb.bereiche[P1].gezeigt)
    expect(spaeter.betrieb.bereiche[P1].ohneAnzeige).toEqual(keys(folge(s)).slice(1, 3))
    expect(lage(spaeter, P1).aktuell?.key).toBe(keys(folge(s))[0])
  })
})

describe('Abgleich bei Nach- und Abmeldung', () => {
  it('Nachmeldung bei abweichender Folge: hinter ihren Vorgänger; Gezeigtes und Abweichung bleiben', () => {
    let s = stand({ E: 2, '1': 2 }, { spuren: [['E'], ['1']], laeufe: 2 })
    s = zeige(s, m('k12', 1))
    expect(keys(folge(s, 'lauf:1'))).toEqual([m('k12', 1), m('kE1', 1), m('k11', 1), m('kE2', 1)])
    // E03 kommt in der Klasse ans Ende: abgeleitet hinter k12. Der ist vorgezogen gefahren – sie kommt hinter
    // den Vorgänger, der am weitesten hinten steht (kE2), ans Ende von Lauf 1, und wird nicht sofort die Nächste.
    const n = reducer(s, { type: 'ADD_STARTERS', starters: [betriebStarter('kE3', 'E', 'E03')] })
    expect(keys(abgeleiteteFolge(n, P1).filter((x) => x.punkt === 'lauf:1'))).toEqual([m('kE1', 1), m('k11', 1), m('kE2', 1), m('k12', 1), m('kE3', 1)])
    expect(keys(folge(n, 'lauf:1'))).toEqual([m('k12', 1), m('kE1', 1), m('k11', 1), m('kE2', 1), m('kE3', 1)])
    // Lauf 2 hatte keinen Schnappschuss-Eintrag mit Abweichung: dort wie abgeleitet.
    expect(keys(folge(n, 'lauf:2'))).toEqual(keys(abgeleiteteFolge(n, P1).filter((x) => x.punkt === 'lauf:2')))
    expect(n.betrieb.bereiche[P1]).toBe(s.betrieb.bereiche[P1])
    expect(lage(n, P1).aktuell?.key).toBe(m('k12', 1))
    expect(keys(lage(n, P1).frei)).toContain(m('kE3', 1))
  })

  it('gelöschter Starter fällt aus der Folge; ein X (Abmeldung) lässt ihn entfallen, an seiner Stelle', () => {
    let s = stand({ E: 2, '1': 2 }, { spuren: [['E'], ['1']], laeufe: 2 })
    s = zeige(s, m('k12', 1))
    const geloescht = reducer(s, { type: 'REMOVE_STARTER', id: 'kE2' })
    expect(keys(folge(geloescht)).some((k) => k.includes('kE2'))).toBe(false)
    expect(lage(geloescht, P1).aktuell?.key).toBe(m('k12', 1))
    // Abmelden geht erst nach dem ersten erfassten Wert; das X kommt in alle leeren Läufe.
    const erfasst = reducer(s, { type: 'SET_EINGABEN', zellen: [{ lauf: laufSchluessel('manoevrieren', 1), starter: 'k12', feld: 'zeit1', wert: '80' }] })
    const ab = reducer(erfasst, { type: 'ABMELDEN_STARTER', id: 'kE2' })
    expect(keys(folge(ab))).toEqual(keys(folge(erfasst)))
    expect(folge(ab).filter((x) => x.starter === 'kE2').every((x) => x.entfaellt)).toBe(true)
    expect(keys(lage(ab, P1).frei)).toEqual([m('kE1', 1), m('k11', 1)])
  })
})

describe('Blöcke je Lauf: Umgestelltes bleibt, wo die Bedienung es hingesetzt hat', () => {
  it('Klasse aussetzen vertauscht keine eingereihten Nachzügler (B-4)', () => {
    let s = stand({ E: 3, '1': 3, '2': 2 }, { spuren: [['E', '2'], ['1']], laeufe: 2 })
    s = tu(s, { type: 'BETRIEB_ZURUECKSTELLEN', bereich: P1, ref: m('kE1', 1) })
    s = tu(s, { type: 'BETRIEB_ZURUECKSTELLEN', bereich: P1, ref: m('k11', 1) })
    s = weiter(beginne(weiter(s, 6), 2), 2)
    s = tu(s, { type: 'BETRIEB_EINREIHEN', bereich: P1, ref: m('k11', 1), wo: 'ende' })
    s = tu(s, { type: 'BETRIEB_EINREIHEN', bereich: P1, ref: m('kE1', 1), wo: 'naechster' })
    expect([keys(lage(s, P1).frei)[0], keys(lage(s, P1).frei).at(-1)]).toEqual([m('kE1', 1), m('k11', 1)])
    const n = aussetzen(s, '2')
    expect(mitLauf(lage(n, P1).frei)).toBe('E1/1 E2/2 12/2 E3/2 13/2 11/1')
  })

  it('„ans Ende des Laufs“: ans Ende des laufenden, auch wenn ein anderer Nachzügler schon als Nächster eingereiht ist', () => {
    let s = stand({ E: 3, '1': 3 }, { spuren: [['E'], ['1']], laeufe: 2 })
    s = tu(s, { type: 'BETRIEB_ZURUECKSTELLEN', bereich: P1, ref: m('kE1', 1) })
    s = tu(s, { type: 'BETRIEB_ZURUECKSTELLEN', bereich: P1, ref: m('k11', 1) })
    s = weiter(beginne(weiter(s, 4), 2), 2)
    s = tu(s, { type: 'BETRIEB_EINREIHEN', bereich: P1, ref: m('k11', 1), wo: 'naechster' })
    s = tu(s, { type: 'BETRIEB_EINREIHEN', bereich: P1, ref: m('kE1', 1), wo: 'ende' })
    expect(mitLauf(lage(s, P1).frei)).toBe('11/1 E2/2 12/2 E3/2 13/2 E1/1')
  })

  it('ein Lauf-3-Start mitten in Lauf 2 bleibt dort, wenn Lauf 2 neu verzahnt wird und Lauf 3 mit fehlendem Boot beginnt (S-9)', () => {
    let s = beginne(weiter(stand({ E: 2, '1': 2 }, { laeufe: 3 }), 4), 2)
    s = verschiebe_(s, m('kE1', 3), { vor: folge(s, 'lauf:2')[2].key })
    s = aussetzen(s, '1')
    const stelle = keys(folge(s)).indexOf(m('kE1', 3))
    s = beginne(weiter(s, 2), 3)
    expect(keys(folge(s)).indexOf(m('kE1', 3))).toBe(stelle)
    expect(lage(s, P1).naechster?.key).toBe(m('kE1', 3))
  })

  it('Klassen an der Start-Freigabe: die des laufenden Laufs, auch wenn ein Nachzügler als Nächster eingereiht ist (B-9, B-10)', () => {
    let s = stand({ E: 2, '1': 2, '2': 2 }, { spuren: [['E', '2'], ['1']], laeufe: 2 })
    s = tu(s, { type: 'BETRIEB_ZURUECKSTELLEN', bereich: P1, ref: m('kE1', 1) })
    s = weiter(beginne(weiter(s, 5), 2), 2)
    s = tu(s, { type: 'BETRIEB_EINREIHEN', bereich: P1, ref: m('kE1', 1), wo: 'naechster' })
    const l = lage(s, P1)
    expect([l.naechster?.key, l.arbeitsPunkt]).toEqual([m('kE1', 1), 'lauf:2'])
    expect(sichtOeffentlich(s).bereiche[0].klassenFolge.map((k) => [k.klasse, k.offen])).toEqual([
      ['E', 1],
      ['1', 1],
      ['2', 2],
    ])
    // „Boot fehlt“ für Klasse 2 wirkt auf Lauf 2; der Nachzügler bleibt der Nächste.
    const n = aussetzen(s, '2')
    expect(mitLauf(lage(n, P1).frei)).toBe('E1/1 E2/2 12/2')
  })

  it('das Boot kommt zurück, während der Lauf stockt: der Rest ist wieder frei, nicht nachzuholen (V-5)', () => {
    // Ohne Vorziehen: E setzt aus, alle Starts der Klasse 1 sind gefahren – nur noch E steht aus.
    let s = weiter(aussetzen(vorziehen(stand({ E: 3, '1': 3 }, { spuren: [['E'], ['1']] }), false), 'E'), 3)
    expect([frei(s), muster(lage(s, P1).bootFehlt)]).toEqual(['', 'EEE'])
    const zurueck = lage(aussetzen(s, 'E', false), P1)
    expect([frei(aussetzen(s, 'E', false)), zurueck.nachzuholen]).toEqual(['EEE', []])
    // Mit Vorziehen und einem Start, der „ans Ende des Laufs“ (hinter die Klasse ohne Boot) eingereiht wurde.
    let t = aussetzen(stand({ E: 3, '1': 3 }, { spuren: [['E'], ['1']] }), 'E')
    t = tu(t, { type: 'BETRIEB_ZURUECKSTELLEN', bereich: P1, ref: m('k11', 1) })
    t = weiter(tu(t, { type: 'BETRIEB_EINREIHEN', bereich: P1, ref: m('k11', 1), wo: 'ende' }), 3)
    expect(frei(t)).toBe('')
    const z = aussetzen(t, 'E', false)
    expect([frei(z), lage(z, P1).nachzuholen]).toEqual(['EEE', []])
  })

  it('ein unberührter Lauf folgt einer gelösten, geänderten und wieder festgeschriebenen Verzahnung', () => {
    let s = stand({ E: 2, '1': 2, '2': 2 }, { spuren: [['E', '1'], ['2']], laeufe: 2 })
    s = zeige(s, m('k22', 1))
    expect(s.betrieb.bereiche[P1].reihenfolge).not.toContain(m('kE1', 2))
    s = reducer(s, { type: 'SET_VERZAHNUNG_LOCK', locked: false })
    const tracks = [['2', '1'], ['E']].map((spur) => spur.map((klasse) => ({ kind: 'class' as const, klasse: klasse as ClassId })))
    s = reducer(s, { type: 'SET_VERZAHNUNG_LOCK', locked: true, tracks: { [P1]: tracks } })
    expect(keys(folge(s, 'lauf:2'))).toEqual(keys(abgeleiteteFolge(s, P1).filter((e) => e.punkt === 'lauf:2')))
    expect(keys(folge(s, 'lauf:2'))).not.toEqual(keys(folge(stand({ E: 2, '1': 2, '2': 2 }, { spuren: [['E', '1'], ['2']], laeufe: 2 }), 'lauf:2')))
    // Lauf 1 ist umgestellt (gezielt gezeigt) und behält seine Folge.
    expect(keys(folge(s, 'lauf:1'))[0]).toBe(m('k22', 1))
    expect(lage(s, P1).abweichend).toBe(true)
  })
})

describe('Versuche nacheinander: die Versuche eines Starters bleiben beisammen', () => {
  /** Spur 1 fährt E und 2, Spur 2 Klasse 1; zwei Versuche je Starter, ein Punkt (UIM). */
  const zwei = (beginnen = true) => stand({ E: 2, '1': 2, '2': 2 }, { spuren: [['E', '2'], ['1']], laeufe: 2, nacheinander: true, beginnen })
  /** Kommt jeder Starter nur in einem Stück vor? */
  const beisammen = (xs: readonly FolgeEintrag[]) => xs.every((e, i) => i === 0 || e.starter === xs[i - 1].starter || !xs.slice(0, i).some((x) => x.starter === e.starter))

  it('abgeleitet: je Starter Versuch 1 und 2 hintereinander, ein Punkt', () => {
    const s = zwei()
    expect(lage(s, P1).programm).toEqual(['lauf:1'])
    expect(mitLauf(folge(s))).toBe('E1/1 E1/2 11/1 11/2 E2/1 E2/2 12/1 12/2 21/1 21/2 22/1 22/2')
  })

  it('Klasse aussetzen und zurück: verzahnt je Starter; wer schon gefahren ist, fährt seine Versuche zu Ende', () => {
    const aus = aussetzen(zwei(), 'E')
    expect(mitLauf(folge(aus))).toBe('21/1 21/2 11/1 11/2 22/1 22/2 12/1 12/2 E1/1 E1/2 E2/1 E2/2')
    // Gefahren: 21 beide Versuche, 11 den ersten. Das Boot ist zurück.
    const zurueck = aussetzen(weiter(aus, 3), 'E', false)
    expect(mitLauf(folge(zurueck))).toBe('21/1 21/2 11/1 11/2 E1/1 E1/2 12/1 12/2 E2/1 E2/2 22/1 22/2')
    expect(beisammen(folge(zurueck))).toBe(true)
    expect(lage(zurueck, P1).naechster?.key).toBe(m('k11', 2))
  })

  it('Beginnen mit fehlendem Boot und Klasse vorziehen: ebenso je Starter', () => {
    const vorBeginn = aussetzen(zwei(false), 'E')
    const begonnen = beginne(vorBeginn, 1)
    expect(mitLauf(folge(begonnen))).toBe('21/1 21/2 11/1 11/2 22/1 22/2 12/1 12/2 E1/1 E1/2 E2/1 E2/2')
    const vor = klasseVor(zwei(), '2', 'E')
    expect(beisammen(folge(vor))).toBe(true)
    expect(mitLauf(folge(vor))).toBe('21/1 21/2 11/1 11/2 22/1 22/2 12/1 12/2 E1/1 E1/2 E2/1 E2/2')
    expect(lage(vor, P1).ausgesetzt).toEqual([])
  })
})

describe('Rein und sicher', () => {
  function ablauf(): Action[] {
    return [
      { type: 'BETRIEB_BEGINNEN', bereich: P1, punkt: 'lauf:1', zeit: 1 },
      { type: 'BETRIEB_ZEIGEN', bereich: P1, ref: m('kE1', 1), vorher: null, zeit: 1_000 },
      { type: 'BETRIEB_ZURUECKSTELLEN', bereich: P1, ref: m('k21', 1), zeit: 2_000 },
      { type: 'BETRIEB_AUSSETZEN', bereich: P1, klasse: '2', an: true, zeit: 3_000 },
      { type: 'BETRIEB_KLASSE_VOR', bereich: P1, klasse: '3', vor: 'E', zeit: 4_000 },
      { type: 'BETRIEB_ZEIGEN', bereich: P1, ref: m('k13', 1), vorher: m('kE1', 1), zeit: 5_000 },
      { type: 'BETRIEB_VERSCHIEBEN', bereich: P1, ref: m('k11', 2), ziel: { nachPunkt: 'lauf:1' }, zeit: 6_000 },
      { type: 'BETRIEB_VORZIEHEN', bereich: P1, an: false, zeit: 7_000 },
      { type: 'BETRIEB_AUSSETZEN', bereich: P1, klasse: '2', an: false, zeit: 8_000 },
      { type: 'BETRIEB_EINREIHEN', bereich: P1, ref: m('k21', 1), wo: 'ende', zeit: 9_000 },
      { type: 'BETRIEB_AB', bereich: P1, ref: m('k14', 1), zeit: 10_000 },
    ]
  }
  const start = () => stand({ E: 2, '1': 6, '2': 6, '3': 1, '6': 2 }, { spuren: [['E', '1', '3'], ['2', '6']], laeufe: 2, beginnen: false })

  it('derselbe Ablauf führt in zwei Fenstern zum selben Stand; jeder Schritt wirkt', () => {
    const a = ablauf().reduce(reducer, start())
    expect(a).toEqual(ablauf().reduce(reducer, start()))
    let s = start()
    for (const action of ablauf()) {
      const n = reducer(s, action)
      expect(n, action.type).not.toBe(s)
      s = n
    }
  })

  it('doppelt zugestellt ändert nichts: jede Action ein zweites Mal ist derselbe Stand', () => {
    let s = start()
    for (const action of ablauf()) {
      s = reducer(s, action)
      expect(reducer(s, action), action.type).toBe(s)
    }
  })

  it('WKR-Bögen und Verzahnung bleiben, wie sie sind', () => {
    const s = start()
    const dm = configFor({ regelwerk: 'dm-2026' })
    const n = ablauf().reduce(reducer, s)
    expect(n.betrieb.bereiche[P1].reihenfolge).not.toBeNull()
    expect(wkrBoegenZumStand(n, dm)).toEqual(wkrBoegenZumStand(s, dm))
    expect([n.parcoursList, n.starters, n.eingaben, n.listenStand]).toEqual([s.parcoursList, s.starters, s.eingaben, s.listenStand])
    expect(n.parcoursList).toBe(s.parcoursList)
    // Die abgeleitete Folge (wie auf den Bögen) ist unverändert – nur die des Betriebs weicht ab.
    expect(abgeleiteteFolge(n, P1)).toEqual(abgeleiteteFolge(s, P1))
    expect(startfolge(n, P1)).not.toEqual(abgeleiteteFolge(n, P1))
  })

  it('ein Bereich, den es nicht gibt (unter DM auch der Parallelslalom), bekommt keinen Eintrag; leer wird keiner', () => {
    const s = stand({ E: 2, '1': 2 })
    for (const bereich of ['gibt-es-nicht', 'parallel']) {
      for (const action of [
        { type: 'BETRIEB_VORZIEHEN', bereich, an: false },
        { type: 'BETRIEB_AUSSETZEN', bereich, klasse: 'E', an: true },
        { type: 'BETRIEB_ZURUECKSTELLEN', bereich, ref: m('kE1', 1) },
      ] as Action[])
        expect(reducer(s, action), `${bereich} ${action.type}`).toBe(s)
    }
    // „Vorziehen“ aus und wieder an in einem sonst unberührten Bereich: kein leerer Eintrag bleibt stehen.
    const s2 = stand({ E: 2, '1': 2 }, { beginnen: false })
    const aus = vorziehen(s2, false)
    expect(aus.betrieb.bereiche[P1]?.vorziehen).toBe(false)
    expect(vorziehen(aus, true).betrieb.bereiche).toEqual({})
  })

  it('ohne festgeschriebene Verzahnung ändern die Schritte nichts', () => {
    const s = reducer(beginne(start(), 1), { type: 'SET_VERZAHNUNG_LOCK', locked: false })
    for (const action of ablauf().slice(1)) expect(reducer(s, action), action.type).toBe(s)
  })
})
