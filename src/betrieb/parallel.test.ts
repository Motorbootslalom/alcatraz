import { describe, expect, it } from 'vitest'
import { configFor } from '../config/konfig'
import { emptyState, reducer } from '../state/reducer'
import { feldVon } from '../lib/eingaben'
import { attemptSchluessel } from '../lib/parallelSchluessel'
import { fahreRunde, festgeschrieben, parallelStarter, uimParallelStand } from '../testHilfen'
import { bereicheZumStand, lage, PARALLEL_BEREICH, programm, refKey } from './folge'
import { messungen, wartezeiten } from './prognose'
import { sichtOeffentlich, sichtZuschauer } from './sicht'
import type { AppState, ClassId, OeffentlicheSicht, ParallelRunde, SichtBereich } from '../types'

// Parallelslalom im Betrieb (Etappe E4, Plan vom 16.11.2026 §3 „Folge Parallel“, Kritik K7/K8): Runden als Punkte,
// Paare als Starts, Kennung aus dem festgeschriebenen Plan, leere Seiten, Re-run als später festgeschriebener Punkt.
// Alle Starter sind erfunden (Vor<klasse><n>/Nach<klasse><n>, Musterclub).

const P = PARALLEL_BEREICH
const konfig = configFor({ regelwerk: 'uim-2026' })
/** Die Disq-Zelle, in die das X „nicht gestartet“ im Parallelslalom gehört (Steg). */
const X_FELD = feldVon(konfig, 'steg', '1', 'disq')!.kennung
const p = (runde: ParallelRunde, attempt: 1 | 2, a: string | null, b: string | null) => refKey({ art: 'p', runde, attempt, a, b })

const mk = parallelStarter
const uim = uimParallelStand
const fahre = fahreRunde
const x = (state: AppState, runde: ParallelRunde, attempt: number, id: string) => reducer(state, { type: 'SET_EINGABEN', zellen: [{ lauf: attemptSchluessel(runde, attempt), starter: id, feld: X_FELD, wert: 'X' }] })
const festschreiben = (state: AppState, runde: ParallelRunde, klasse: ClassId) => reducer(state, { type: 'PARALLEL_RUNDE_FESTSCHREIBEN', klasse, runde })
const beginne = (state: AppState, runde: ParallelRunde) => reducer(state, { type: 'BETRIEB_BEGINNEN', bereich: P, punkt: `runde:${runde}` })
/** „Nächster Start“ wie die Start-Freigabe: Kennung und `vorher` aus der Sicht. */
function naechster(state: AppState, zeit = 1000): AppState {
  const b = bereich(sichtOeffentlich(state))
  return reducer(state, { type: 'BETRIEB_ZEIGEN', bereich: P, ref: b.offen[0].key, vorher: b.aktuell?.key ?? null, zeit })
}
const bereich = (sicht: OeffentlicheSicht): SichtBereich => sicht.bereiche.find((b) => b.id === P)!
const frei = (state: AppState) => lage(state, P).frei.map((e) => e.key)

/** Klasse 1 mit sechs Startern: Vorlauf gefahren (1-1 … 1-4 qualifiziert), Halbfinale festgeschrieben (1-1/1-2, 1-3/1-4). */
const VORLAUF6 = { '1-1': [40, 40], '1-2': [41, 41], '1-3': [42, 42], '1-4': [43, 43], '1-5': [50, 50], '1-6': [55, 55] }
const imHalbfinale = () => festschreiben(fahre(uim(mk('1', 6)), 'pre', VORLAUF6), 'semi', '1')

describe('Parallelslalom im Betrieb: Bereich und Programm', () => {
  it('nur unter UIM – unter DM gibt es den Bereich nicht, auch nicht in der Sicht', () => {
    const dm = festgeschrieben(reducer({ ...emptyState(), eventName: 'Musterpokal' }, { type: 'ADD_STARTERS', starters: [...mk('E', 3), ...mk('1', 6)] }))
    expect(bereicheZumStand(dm).map((b) => b.art)).not.toContain('parallel')
    expect(programm(dm, P)).toEqual([])
    // Veraltete oder fremde Actions ändern nichts.
    expect(reducer(dm, { type: 'BETRIEB_BEGINNEN', bereich: P, punkt: 'runde:pre' })).toBe(dm)
    expect(reducer(dm, { type: 'BETRIEB_MELDUNG', bereich: P, meldung: { text: 'Pause', art: 'pause' } })).toBe(dm)
    const sicht = sichtOeffentlich(dm)
    expect(sicht.bereiche.map((b) => b.id)).not.toContain(P)
    expect(JSON.stringify(sicht)).not.toMatch(/parallel|Parallel|runde:/)
  })

  it('unter UIM hinter den Parcours; Runden ohne festgeschriebenen Plan stehen nicht im Programm', () => {
    const offen = uim(undefined, false)
    expect(bereicheZumStand(offen).map((b) => [b.id, b.art])).toEqual([
      ['par_1', 'manoevrieren'],
      [P, 'parallel'],
    ])
    expect([programm(offen, P), lage(offen, P).fest]).toEqual([[], false])
    expect(reducer(offen, { type: 'BETRIEB_BEGINNEN', bereich: P, punkt: 'runde:pre' })).toBe(offen)
    const fest = uim()
    expect([programm(fest, P), lage(fest, P).fest]).toEqual([['runde:pre'], true])
    // Halbfinale erst, wenn es festgeschrieben ist.
    expect(programm(fahre(uim(mk('1', 6)), 'pre', VORLAUF6), P)).toEqual(['runde:pre'])
    expect(programm(imHalbfinale(), P)).toEqual(['runde:pre', 'runde:semi'])
    expect(sichtOeffentlich(imHalbfinale()).bereiche.find((b) => b.id === P)!.programm.map((x) => [x.id, x.titel, x.laeufe])).toEqual([
      ['runde:pre', 'Preliminary heat', []],
      ['runde:semi', 'Semi-finals', []],
    ])
  })

  it('die Starts der Runde in der Folge des Plans, Kennung aus den gespeicherten IDs (fest.starts)', () => {
    const s = uim()
    const l = lage(s, P)
    expect(l.folge.map((e) => e.key)).toEqual(
      s.parallelPlaene.pre!.starts.map((st) => p('pre', st.attempt, st.a, st.b)),
    )
    expect(l.folge.slice(0, 4).map((e) => [e.key, e.klasse, e.lauf, e.entfaellt])).toEqual([
      [p('pre', 1, 'E-1', 'E-2'), 'E', 1, false],
      [p('pre', 2, 'E-2', 'E-1'), 'E', 2, false],
      // Dolphin 3 fährt gegen den Dummy: Die Seite ist leer, der Start entfällt nicht.
      [p('pre', 1, 'E-3', null), 'E', 1, false],
      [p('pre', 2, null, 'E-3'), 'E', 2, false],
    ])
    // Noch nicht begonnen: Die Starts warten auf ihre Runde.
    expect([l.frei, l.naechsterPunkt]).toEqual([[], 'runde:pre'])
    expect(frei(beginne(s, 'pre'))[0]).toBe(p('pre', 1, 'E-1', 'E-2'))
  })

  it('Re-run: nach dem ersten Halbfinal-Start festgeschrieben, wartet er als nicht begonnener Punkt; begonnen ist er dran', () => {
    // Dolphin: Gleichstand an der Grenze 4/5 (E-4 und E-5 gleich auf) – sie wiederholen beide Attempts (Pkt. 5.2.6).
    let s = uim([...mk('E', 5), ...mk('1', 6)])
    s = fahre(s, 'pre', { ...VORLAUF6, 'E-1': [40, 40], 'E-2': [41, 41], 'E-3': [42, 42], 'E-4': [43, 43], 'E-5': [43, 43] })
    s = festschreiben(s, 'semi', '1')
    // Der Vorlauf lief ohne Anzeige: ab dem Halbfinale einsteigen, den 1. Attempt des ersten Paares zeigen.
    s = naechster(reducer(s, { type: 'BETRIEB_AB', bereich: P, ref: p('semi', 1, '1-1', '1-2') }))
    expect(programm(s, P)).toEqual(['runde:pre', 'runde:semi'])
    s = festschreiben(s, 'rerun-pre-1', 'E')
    expect(programm(s, P)).toEqual(['runde:pre', 'runde:rerun-pre-1', 'runde:semi'])
    let l = lage(s, P)
    expect([l.begonnen, l.laufend, l.naechsterPunkt]).toEqual([['runde:pre', 'runde:semi'], 'runde:semi', 'runde:rerun-pre-1'])
    // Die Starts des Re-run sind offen, aber nicht frei – bis „Re-run beginnen“; nachzuholen sind sie nie
    // (BETRIEB_ANNAHMEN.parallelRundenFuerSich: Das Gezeigte des Halbfinales überholt nur Starts des Halbfinales).
    const rerun = l.offen.filter((e) => e.punkt === 'runde:rerun-pre-1').map((e) => e.key)
    expect(rerun).toEqual([p('rerun-pre-1', 1, 'E-4', 'E-5'), p('rerun-pre-1', 2, 'E-5', 'E-4')])
    expect([l.frei.some((e) => rerun.includes(e.key)), l.nachzuholen]).toEqual([false, []])
    expect(bereich(sichtOeffentlich(s)).naechsterPunkt).toEqual({ id: 'runde:rerun-pre-1', titel: 'Preliminary heat – Re-run', laeufe: [] })
    // „Re-run beginnen“ mitten im Paar: Erst fährt das Paar im Boot seinen 2. Attempt (parallelPaarZuEnde) …
    s = beginne(s, 'rerun-pre-1')
    l = lage(s, P)
    expect([l.naechster?.key, l.laufend, l.nachzuholen]).toEqual([p('semi', 2, '1-2', '1-1'), 'runde:semi', []])
    // … dann der Re-run, vor den übrigen Paaren des Halbfinales – und die Tafel nennt ihn als laufende Runde.
    s = naechster(s, 2000)
    l = lage(s, P)
    expect(l.frei.map((e) => e.key)).toEqual([...rerun, p('semi', 1, '1-3', '1-4'), p('semi', 2, '1-4', '1-3')])
    expect(l.laufend).toBe('runde:rerun-pre-1')
    expect(bereich(sichtOeffentlich(s)).punkt?.titel).toBe('Preliminary heat – Re-run')
    s = naechster(naechster(s, 3000), 4000)
    l = lage(s, P)
    expect([l.naechster?.key, l.laufend, l.nachzuholen]).toEqual([p('semi', 1, '1-3', '1-4'), 'runde:semi', []])
    expect(bereich(sichtOeffentlich(s)).punkt?.titel).toBe('Semi-finals')
  })

  it('Klassen in verschiedenen Runden: ein Halbfinale, festgeschrieben während der Finals einer anderen Klasse, ist frei', () => {
    // Dolphin klar, Klasse 1 mit Gleichstand an der Grenze 4/5: Dolphin ist schon in den Finals, wenn Klasse 1 ihren
    // Re-run fährt und danach ihr Halbfinale festgeschrieben wird.
    const v = (k: string, funf: number) => ({ [`${k}-1`]: [40, 40], [`${k}-2`]: [41, 41], [`${k}-3`]: [42, 42], [`${k}-4`]: [43, 43], [`${k}-5`]: [funf, funf], [`${k}-6`]: [55, 55] })
    let s = uim([...mk('E', 6), ...mk('1', 6)])
    s = fahre(s, 'pre', { ...v('E', 50), ...v('1', 43) })
    s = festschreiben(s, 'semi', 'E')
    s = reducer(s, { type: 'BETRIEB_AB', bereich: P, ref: p('semi', 1, 'E-1', 'E-2') })
    for (let i = 0; i < 4; i++) s = naechster(s, 1000 * (i + 1))
    s = fahre(s, 'semi', { 'E-1': [40, 40], 'E-2': [41, 41], 'E-3': [42, 42], 'E-4': [43, 43] })
    s = festschreiben(s, 'final', 'E')
    s = naechster(beginne(s, 'final'), 10_000)
    const kleinesFinale2 = lage(s, P).frei[0].key
    expect(lage(s, P).aktuell?.eintrag?.paar).toMatchObject({ finale: 3, attempt: 1 })
    // Re-run der Klasse 1 festgeschrieben, gefahren (Werte da), ihr Halbfinale festgeschrieben – die Runde ist begonnen.
    s = festschreiben(s, 'rerun-pre-1', '1')
    s = fahre(s, 'rerun-pre-1', { '1-4': [40, 40], '1-5': [45, 45] })
    s = festschreiben(s, 'semi', '1')
    const semi1 = lage(s, P).folge.filter((e) => e.punkt === 'runde:semi' && e.klasse === '1').map((e) => e.key)
    expect(semi1).toHaveLength(4)
    let l = lage(s, P)
    // Nichts davon nachzuholen; erst das Paar im Boot zu Ende, dann das Halbfinale (es steht vor den Finals).
    expect(l.nachzuholen).toEqual([])
    expect(l.frei.map((e) => e.key).slice(0, 5)).toEqual([kleinesFinale2, ...semi1])
    expect(l.laufend).toBe('runde:final')
    const z = sichtZuschauer(sichtOeffentlich(s)).bereiche.find((b) => b.id === P)!
    expect(z.frei.map((x) => x.punkt)).toEqual(expect.arrayContaining(['runde:semi']))
    // Gezielt das 2. Paar des Halbfinales zeigen: Es rückt mit seinem 2. Attempt hinter das Erledigte SEINER Runde –
    // das 1. Paar bleibt frei (im Manövrieren wäre der Zeiger die Grenze; er steht hier in den Finals).
    s = reducer(s, { type: 'BETRIEB_ZEIGEN', bereich: P, ref: semi1[2], vorher: l.aktuell!.key, zeit: 20_000 })
    l = lage(s, P)
    expect(l.nachzuholen).toEqual([])
    expect(l.frei.map((e) => e.key).slice(0, 3)).toEqual([semi1[3], semi1[0], semi1[1]])
    // Zurückstellen und „Ans Ende der Runde“: hinter den letzten Start des Halbfinales, nicht in die Finals.
    s = reducer(s, { type: 'BETRIEB_ZURUECKSTELLEN', bereich: P, ref: semi1[3] })
    s = reducer(s, { type: 'BETRIEB_EINREIHEN', bereich: P, ref: semi1[3], wo: 'ende' })
    l = lage(s, P)
    expect(l.frei.map((e) => [e.key, e.punkt]).slice(0, 4)).toEqual([
      [semi1[0], 'runde:semi'],
      [semi1[1], 'runde:semi'],
      [semi1[3], 'runde:semi'],
      [kleinesFinale2, 'runde:final'],
    ])
    expect([l.nachzuholen, l.zurueckgestellt]).toEqual([[], []])
    // Pläne und Werte ändert der Betrieb nie.
    expect(s.parallelPlaene.semi!.starts.filter((x) => x.klasse === '1').map((x) => p('semi', x.attempt, x.a, x.b))).toEqual(semi1)
  })
})

describe('Parallelslalom im Betrieb: leere Seiten (K7) und stabile Kennung (K8)', () => {
  it('gelöschter Starter: die Kennung des gezeigten Starts bleibt, er taucht nicht wieder auf; die Seite ist leer', () => {
    let s = naechster(beginne(uim(), 'pre'))
    const gezeigt = p('pre', 1, 'E-1', 'E-2')
    expect(bereich(sichtOeffentlich(s)).aktuell?.key).toBe(gezeigt)
    // Ohne erfasste Werte lässt sich ein Starter löschen; der Plan behält seine ID (Dummy auf den Listen).
    s = reducer(s, { type: 'REMOVE_STARTER', id: 'E-2' })
    expect(s.parallelPlaene.pre!.starts[0]).toMatchObject({ a: 'E-1', b: 'E-2' })
    const l = lage(s, P)
    expect(l.aktuell?.key).toBe(gezeigt)
    expect(l.aktuell?.eintrag?.paar).toMatchObject({ a: 'E-1', b: 'E-2', aFaehrt: true, bFaehrt: false })
    // Kein Wiederauftauchen: weder offen noch nachzuholen – der Nächste ist der 2. Attempt (A leer, B E-1).
    expect([...l.offen, ...l.nachzuholen].map((e) => e.key)).not.toContain(gezeigt)
    const b = bereich(sichtOeffentlich(s))
    expect(b.aktuell?.paar).toEqual({ attempt: 1, a: 'E-1', b: null })
    expect(b.offen[0]).toMatchObject({ key: p('pre', 2, 'E-2', 'E-1'), starter: 'E-1', paar: { attempt: 2, a: null, b: 'E-1' } })
    expect(sichtOeffentlich(s).starter['E-2']).toBeUndefined()
    // „Nächster Start“ geht weiter.
    expect(bereich(sichtOeffentlich(naechster(s, 2000))).aktuell?.key).toBe(p('pre', 2, 'E-2', 'E-1'))
  })

  it('Runde gelöscht (neu festzuschreiben): der gezeigte Start bleibt im Boot, mit den Startern, die es gibt', () => {
    let s = reducer(imHalbfinale(), { type: 'BETRIEB_AB', bereich: P, ref: p('semi', 1, '1-1', '1-2') })
    s = naechster(s)
    s = reducer(s, { type: 'PARALLEL_RUNDE_LOESEN', klasse: '1', runde: 'semi' })
    expect(programm(s, P)).toEqual(['runde:pre'])
    const b = bereich(sichtOeffentlich(s))
    expect(b.aktuell).toMatchObject({ key: p('semi', 1, '1-1', '1-2'), punkt: 'runde:semi', paar: { attempt: 1, a: '1-1', b: '1-2' } })
    // Begonnen bleibt nur, was es noch gibt: der Vorlauf (Einsteigen hatte ihn mit begonnen).
    expect(b.punkt?.id).toBe('runde:pre')
    // „Zurück“ geht weiter (die Kennung passt).
    expect(reducer(s, { type: 'BETRIEB_ZURUECK', bereich: P, ref: b.aktuell!.key }).betrieb.bereiche[P].gezeigt).toEqual([])
  })

  it('Halbfinale mit einer abgemeldeten Seite fährt: die Seite ist leer, der Gegner fährt', () => {
    let s = imHalbfinale()
    // Der Vorlauf ist gefahren (ohne Anzeige): ab dem ersten Start des Halbfinales einsteigen.
    s = reducer(s, { type: 'BETRIEB_AB', bereich: P, ref: p('semi', 1, '1-1', '1-2') })
    s = reducer(s, { type: 'ABMELDEN_STARTER', id: '1-2' })
    expect(s.eingaben[attemptSchluessel('semi', 1)]?.['1-2']?.[X_FELD]).toBe('X')
    const l = lage(s, P)
    expect(l.folge.filter((e) => e.punkt === 'runde:semi').map((e) => [e.key, e.entfaellt, e.paar!.aFaehrt, e.paar!.bFaehrt])).toEqual([
      [p('semi', 1, '1-1', '1-2'), false, true, false],
      [p('semi', 2, '1-2', '1-1'), false, false, true],
      [p('semi', 1, '1-3', '1-4'), false, true, true],
      [p('semi', 2, '1-4', '1-3'), false, true, true],
    ])
    expect(l.naechster?.key).toBe(p('semi', 1, '1-1', '1-2'))
    const gezeigt = naechster(s)
    expect(bereich(sichtOeffentlich(gezeigt)).aktuell).toMatchObject({ key: p('semi', 1, '1-1', '1-2'), paar: { attempt: 1, a: '1-1', b: null } })
    // Beide abgemeldet: Auf keiner Seite fährt jemand – der Start entfällt (beide X).
    const beide = reducer(s, { type: 'ABMELDEN_STARTER', id: '1-1' })
    expect(lage(beide, P).folge.filter((e) => e.punkt === 'runde:semi' && e.entfaellt).map((e) => e.key)).toEqual([p('semi', 1, '1-1', '1-2'), p('semi', 2, '1-2', '1-1')])
    expect(lage(beide, P).naechster?.key).toBe(p('semi', 1, '1-3', '1-4'))
  })

  it('Dummy gegen ein X: niemand fährt, der Start entfällt; ein X allein auf einer Seite nicht', () => {
    const s = beginne(uim(), 'pre')
    const mitX = x(s, 'pre', 1, 'E-3')
    const l = lage(mitX, P)
    expect(l.folge.find((e) => e.key === p('pre', 1, 'E-3', null))?.entfaellt).toBe(true)
    // Der 2. Attempt (ohne X) fährt.
    expect(l.folge.find((e) => e.key === p('pre', 2, null, 'E-3'))?.entfaellt).toBe(false)
    // Ein X gegen einen Starter: Die Seite ist leer, gefahren wird.
    const einX = lage(x(s, 'pre', 1, 'E-2'), P).folge[0]
    expect([einX.entfaellt, einX.paar?.aFaehrt, einX.paar?.bFaehrt]).toEqual([false, true, false])
    // Wird das X entfernt, ist der Start wieder da (die Tafel schreibt nie in die Eingaben).
    const ohne = reducer(mitX, { type: 'SET_EINGABEN', zellen: [{ lauf: attemptSchluessel('pre', 1), starter: 'E-3', feld: X_FELD, wert: '' }] })
    expect(lage(ohne, P).folge.find((e) => e.key === p('pre', 1, 'E-3', null))?.entfaellt).toBe(false)
  })

  it('Finals: das kleine Finale zuerst, jeder Start nennt sein Finale', () => {
    let s = imHalbfinale()
    s = fahre(s, 'semi', { '1-1': [40, 40], '1-2': [41, 41], '1-3': [42, 42], '1-4': [43, 43] })
    s = festschreiben(s, 'final', '1')
    expect(programm(s, P)).toEqual(['runde:pre', 'runde:semi', 'runde:final'])
    const finals = lage(s, P).folge.filter((e) => e.punkt === 'runde:final')
    expect(finals.map((e) => e.paar?.finale)).toEqual([3, 3, 1, 1])
    const sicht = bereich(sichtOeffentlich(beginne(s, 'final')))
    expect(sicht.waehlbar.filter((w) => w.punkt === 'runde:final').map((w) => w.titel)).toEqual([
      'Small final (3rd and 4th place) · Attempt 1',
      'Small final (3rd and 4th place) · Attempt 2',
      'Final · Attempt 1',
      'Final · Attempt 2',
    ])
  })
})

describe('Parallelslalom im Betrieb: Schritte der Start-Freigabe', () => {
  it('Zurückstellen nimmt das ganze Paar (beide Attempts); Einreihen bringt es zurück, in der Folge der Attempts', () => {
    const s = beginne(uim(), 'pre')
    const a1 = p('pre', 1, 'E-1', 'E-2')
    const a2 = p('pre', 2, 'E-2', 'E-1')
    const zurueck = reducer(s, { type: 'BETRIEB_ZURUECKSTELLEN', bereich: P, ref: a1 })
    expect(zurueck.betrieb.bereiche[P].zurueckgestellt).toEqual([a1, a2])
    expect(frei(zurueck)[0]).toBe(p('pre', 1, 'E-3', null))
    // Einreihen über den 2. Attempt holt den 1. mit – und zwar davor.
    const naechster_ = reducer(zurueck, { type: 'BETRIEB_EINREIHEN', bereich: P, ref: a2, wo: 'naechster' })
    expect(naechster_.betrieb.bereiche[P].zurueckgestellt).toEqual([])
    expect(frei(naechster_).slice(0, 2)).toEqual([a1, a2])
    const ende = reducer(zurueck, { type: 'BETRIEB_EINREIHEN', bereich: P, ref: a1, wo: 'ende' })
    expect(frei(ende).slice(-2)).toEqual([a1, a2])
    // Gezielt zeigen eines zurückgestellten 1. Attempts: der 2. kommt direkt dahinter.
    const gezeigt = reducer(zurueck, { type: 'BETRIEB_ZEIGEN', bereich: P, ref: a1, vorher: null, zeit: 1000 })
    expect([gezeigt.betrieb.bereiche[P].zurueckgestellt, lage(gezeigt, P).naechster?.key]).toEqual([[], a2])
    // Hat das Paar seinen 1. Attempt schon gefahren, bleibt der nur der 2. zurückgestellt.
    const halb = naechster(s)
    expect(reducer(halb, { type: 'BETRIEB_ZURUECKSTELLEN', bereich: P, ref: a2 }).betrieb.bereiche[P].zurueckgestellt).toEqual([a2])
  })

  it('gezielt zeigen: im Halbfinale kommt der 2. Attempt mit, im Vorlauf (Bootstypen im Wechsel) bleibt der Plan', () => {
    // Halbfinale: Paare direkt hintereinander – gezielt das 2. Paar, sein 2. Attempt ist der Nächste.
    let s = reducer(imHalbfinale(), { type: 'BETRIEB_AB', bereich: P, ref: p('semi', 1, '1-1', '1-2') })
    s = reducer(s, { type: 'BETRIEB_ZEIGEN', bereich: P, ref: p('semi', 1, '1-3', '1-4'), vorher: null, zeit: 1000 })
    expect(frei(s)).toEqual([p('semi', 2, '1-4', '1-3'), p('semi', 1, '1-1', '1-2'), p('semi', 2, '1-2', '1-1')])
    // Vorlauf mit kleinen und großen Booten: 1. Attempt klein, 1. Attempt groß, 2. Attempt klein … (Plan).
    const v = beginne(uim([...mk('E', 2), ...mk('4', 2)]), 'pre')
    expect(lage(v, P).folge.map((e) => e.key)).toEqual([p('pre', 1, 'E-1', 'E-2'), p('pre', 1, '4-1', '4-2'), p('pre', 2, 'E-2', 'E-1'), p('pre', 2, '4-2', '4-1')])
    const gross = reducer(v, { type: 'BETRIEB_ZEIGEN', bereich: P, ref: p('pre', 1, '4-1', '4-2'), vorher: null, zeit: 1000 })
    // Der 2. Attempt des großen Paares rückt nicht vor: Zwischen den Attempts fährt der andere Bootstyp.
    expect(frei(gross)).toEqual([p('pre', 1, 'E-1', 'E-2'), p('pre', 2, 'E-2', 'E-1'), p('pre', 2, '4-2', '4-1')])
  })

  it('Verschieben, Klasse aussetzen, vorziehen und Klasse vor sind gesperrt – der Plan gibt die Folge vor', () => {
    const s = naechster(beginne(uim(), 'pre'))
    const ref = p('pre', 1, 'E-3', null)
    expect(reducer(s, { type: 'BETRIEB_VERSCHIEBEN', bereich: P, ref, ziel: { vor: p('pre', 2, 'E-2', 'E-1') } })).toBe(s)
    expect(reducer(s, { type: 'BETRIEB_VERSCHIEBEN', bereich: P, ref, ziel: { nachPunkt: 'runde:pre' } })).toBe(s)
    expect(reducer(s, { type: 'BETRIEB_AUSSETZEN', bereich: P, klasse: 'E', an: true })).toBe(s)
    expect(reducer(s, { type: 'BETRIEB_VORZIEHEN', bereich: P, an: false })).toBe(s)
    expect(reducer(s, { type: 'BETRIEB_KLASSE_VOR', bereich: P, klasse: '1', vor: 'E' })).toBe(s)
    expect(bereich(sichtOeffentlich(s)).klassenFolge).toEqual([])
  })

  it('Einsteigen ab Runde und Klasse; Zeigen, Zurück und Meldung wie im Manövrieren', () => {
    const s = uim()
    const einstieg = bereich(sichtOeffentlich(s)).einstieg
    const ab1 = einstieg.find((e) => e.punkt === 'runde:pre' && e.klasse === '1')!
    expect(ab1.key).toBe(p('pre', 1, '1-1', '1-2'))
    const ab = reducer(s, { type: 'BETRIEB_AB', bereich: P, ref: ab1.key })
    expect(ab.betrieb.bereiche[P].begonnen).toEqual(['runde:pre'])
    expect(ab.betrieb.bereiche[P].gezeigt).toEqual([])
    expect(frei(ab)[0]).toBe(ab1.key)
    const gezeigt = naechster(ab, 5000)
    const zurueck = reducer(gezeigt, { type: 'BETRIEB_ZURUECK', bereich: P, ref: ab1.key })
    expect(zurueck.betrieb.bereiche[P].gezeigt).toEqual([])
    const meldung = reducer(gezeigt, { type: 'BETRIEB_MELDUNG', bereich: P, meldung: { text: 'Bootswechsel', art: 'pause' } })
    expect(bereich(sichtOeffentlich(meldung)).meldung).toEqual({ text: 'Bootswechsel', art: 'pause' })
    // Die Pläne und Werte ändert der Betrieb nie.
    expect([gezeigt.parallelPlaene, gezeigt.eingaben]).toEqual([s.parallelPlaene, s.eingaben])
  })
})

describe('Parallelslalom im Betrieb: Sicht, Zuschauersicht, Prognose', () => {
  /** Vorlauf begonnen, zwei Starts gezeigt (60 s auseinander). */
  const laeuft = () => naechster(naechster(beginne(uim(), 'pre'), 1000), 61_000)

  it('Fassung 4: ein Start ist ein Paar mit Racecourse A und B – genau diese Felder', () => {
    const sicht = sichtOeffentlich(laeuft())
    expect(sicht.sv).toBe(4)
    const b = bereich(sicht)
    expect([b.name, b.art, b.punkt?.titel]).toEqual(['Parallel slalom', 'parallel', 'Preliminary heat'])
    expect(b.aktuell).toEqual({ key: p('pre', 2, 'E-2', 'E-1'), starter: 'E-2', lauf: 2, punkt: 'runde:pre', titel: 'Preliminary heat · Attempt 2', paar: { attempt: 2, a: 'E-2', b: 'E-1' } })
    // Eine leere Seite (Dummy) ist `null` – ohne Grund.
    expect(b.offen[0].paar).toEqual({ attempt: 1, a: 'E-3', b: null })
    for (const s of [b.aktuell!, ...b.offen, ...b.waehlbar]) expect(Object.keys(s).sort()).toEqual(['key', 'lauf', 'paar', 'punkt', 'starter', 'titel'])
    expect(sicht.klassen.E).toEqual({ name: 'Dolphin', titel: 'Class Dolphin', farbe: expect.any(String) })
    // Deutsch als Einstellung: Runde und Versuch wie auf den Listen.
    const de = bereich(sichtOeffentlich(reducer(laeuft(), { type: 'SET_ANZEIGE', patch: { sprache: 'de' } })))
    expect([de.name, de.aktuell?.titel]).toEqual(['Parallel-Slalom', 'Vorlauf · 2. Versuch'])
  })

  it('Zuschauersicht: das Paar Feld für Feld, nichts Zusätzliches', () => {
    const oeffentlich = sichtOeffentlich(laeuft())
    const z = sichtZuschauer(oeffentlich)
    const b = z.bereiche.find((x) => x.id === P)!
    for (const s of [b.aktuell!, ...b.frei]) {
      expect(Object.keys(s).sort()).toEqual(['key', 'lauf', 'paar', 'punkt', 'starter', 'titel'])
      expect(Object.keys(s.paar!).sort()).toEqual(['a', 'attempt', 'b'])
    }
    // Beide Seiten stehen in `starter`, eine leere nicht.
    expect(Object.keys(z.starter).filter((id) => id.startsWith('E-')).sort()).toEqual(['E-1', 'E-2', 'E-3'])
    const mehr = structuredClone(oeffentlich)
    for (const s of bereich(mehr).waehlbar) Object.assign(s.paar!, { nurBedienung: true })
    Object.assign(bereich(mehr).aktuell!.paar!, { nurBedienung: true })
    expect(JSON.stringify(sichtZuschauer(mehr))).not.toContain('nurBedienung')
    expect(sichtZuschauer(mehr)).toEqual(z)
  })

  it('Zuschauersicht: Die Kennung einer leeren Seite verrät nicht, wer dort abgemeldet ist', () => {
    let s = reducer(imHalbfinale(), { type: 'BETRIEB_AB', bereich: P, ref: p('semi', 1, '1-1', '1-2') })
    s = reducer(s, { type: 'ABMELDEN_STARTER', id: '1-2' })
    const oeffentlich = sichtOeffentlich(s)
    // Die öffentliche Sicht braucht die Kennung laut Plan („Nächster Start“ schickt sie als `vorher`, K8) …
    expect(bereich(oeffentlich).offen[0]).toMatchObject({ key: p('semi', 1, '1-1', '1-2'), paar: { attempt: 1, a: '1-1', b: null } })
    // … die Zuschauersicht nennt den abgemeldeten Starter nirgends – auch nicht in einer Kennung.
    const z = sichtZuschauer(oeffentlich)
    expect(JSON.stringify(z)).not.toContain('1-2')
    const frei = z.bereiche.find((b) => b.id === P)!.frei
    expect(frei.slice(0, 2).map((x) => [x.key, x.paar])).toEqual([
      [JSON.stringify(['p', 'runde:semi', 1, '1-1', null]), { attempt: 1, a: '1-1', b: null }],
      [JSON.stringify(['p', 'runde:semi', 2, null, '1-1']), { attempt: 2, a: null, b: '1-1' }],
    ])
    // Eindeutig bleibt sie.
    expect(new Set(frei.map((x) => x.key)).size).toBe(frei.length)
    // Gezeigt: der Start im Boot trägt dieselbe Kennung wie vorher in `frei`.
    const gezeigt = sichtZuschauer(sichtOeffentlich(naechster(s)))
    expect(gezeigt.bereiche.find((b) => b.id === P)!.aktuell?.key).toBe(frei[0].key)
  })

  it('keine Prognose: Paarstarts werden nicht gemessen, ihre Wartezeit hat keine Zahl – Steg bleibt', () => {
    const s = reducer(laeuft(), { type: 'SET_ANZEIGE', patch: { amSteg: 1, vorSteg: 1 } })
    expect(messungen(s).filter((m) => m.bereich === P)).toEqual([])
    const sicht = sichtOeffentlich(s)
    const zeiten = wartezeiten(sicht, bereich(sicht), 70_000)
    expect([...zeiten.values()].slice(0, 3)).toEqual([
      { art: 'angehalten', stelle: 0, steg: 'amSteg' },
      { art: 'angehalten', stelle: 1, steg: 'vorSteg' },
      { art: 'angehalten', stelle: 2, steg: null },
    ])
  })

  it('gemeinsame Anzeigetafel: der Parallelslalom erst, wenn dort eine Runde begonnen ist – oder ausdrücklich gewählt', () => {
    const s = uim()
    expect(sichtOeffentlich(s).auswahl).toEqual(['par_1'])
    expect(sichtOeffentlich(beginne(s, 'pre')).auswahl).toEqual(['par_1', P])
    expect(sichtOeffentlich(reducer(s, { type: 'SET_ANZEIGE', patch: { bereiche: [P] } })).auswahl).toEqual([P])
  })
})
