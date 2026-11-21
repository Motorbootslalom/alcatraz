import { describe, expect, it } from 'vitest'
import { configFor } from '../config/konfig'
import { aufbauFuer, aufbautenFuer, aufbauOf, PARALLEL } from '../config/catalog'
import { emptyState, reducer } from '../state/reducer'
import { migrate } from '../state/migrate'
import { plaetzeVon } from '../planung/parallelRunden'
import { bogenSeiten } from './bogen'
import { laufSchluessel, verborgeneZellen } from './eingaben'
import { bogenFortschritt, zeilenSchluessel } from './erfassung'
import { haengeUm, normalisiereEinteilung } from './einteilung'
import { beispielRunde, zufallAus } from './beispielwerte'
import { gruppenSeiten } from './paging'
import { bogenTexte } from '../config/sprache'
import {
  blockLaengen,
  festeRunden,
  messBoegenRunde,
  messKennungRunde,
  musterRundenBoegen,
  musterStarter,
  parallelAufbauId,
  parallelBoegen,
  parallelListen,
  rundenSeitenzahl,
  rundenZeilen,
  rundenZettel,
  scanRundenBogen,
  waehleRundenBoegen,
} from './parallelBogen'
import { attemptSchluessel, attemptsImPlan, RACECOURSE_PARCOURS, rundeHatEingaben, rundenDisziplin, rundeVon, zerlegeAttempt } from './parallelSchluessel'
import { leseCode, rundenBogenCode, rundenZettelCode, seitenCode, type QrBekannt, type QrRundenZiel } from './qr'
import { scanBogen } from './scan'
import { rundenStartliste } from './parallelStartliste'
import { wkrBoegenZumStand } from './wkrListen'
import type { AppState, ClassId, Starter } from '../types'

// Erfundene Starter – keine echten Personen.
function mk(klasse: ClassId, n: number): Starter[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `${klasse}-${i + 1}`,
    startNr: klasse + String(i + 1).padStart(2, '0'),
    vorname: 'Vor',
    nachname: `Nach${klasse}${i + 1}`,
    verein: 'Club',
    bundesland: '',
    geburtsdatum: '2015-01-01',
    groesse: '',
    klasse,
  }))
}

/** UIM, festgeschrieben: E 3 Starter (ein Dummy), Klasse 1 zwei, Klasse 4 zwei → 4 Paare, 8 Starts. */
const FELD = () => [...mk('E', 3), ...mk('1', 2), ...mk('4', 2)]
function uim(starters: Starter[] = FELD(), fest = true): AppState {
  let state = reducer(emptyState(), { type: 'SET_REGELWERK', regelwerk: 'uim-2026' })
  state = reducer(state, { type: 'SET_EVENT', patch: { eventName: 'Hafenpokal' } })
  state = reducer(state, { type: 'SET_KENNUNG', kennung: 'K7Q4' })
  state = reducer(state, { type: 'ADD_STARTERS', starters })
  return fest ? reducer(state, { type: 'SET_VERZAHNUNG_LOCK', locked: true }) : state
}
const konfig = configFor({ regelwerk: 'uim-2026' })
const dm = configFor({ regelwerk: 'dm-2026' })

describe('Aufbau je Disziplin', () => {
  it('aufbauFuer: Manövrieren wie aufbauOf, der Parallelslalom hat seinen eigenen Aufbau', () => {
    expect(aufbauFuer('manoevrieren', 'bawue')?.id).toBe(aufbauOf('bawue').id)
    expect(aufbauFuer('manoevrieren', 'gibt-es-nicht')?.id).toBe(aufbauOf('gibt-es-nicht').id)
    expect(aufbauFuer(PARALLEL)?.id).toBe('parallel')
    expect(aufbauFuer(PARALLEL, 'alcatraz')?.id).toBe('parallel')
    expect(aufbautenFuer(PARALLEL).map((a) => a.id)).toEqual(['parallel'])
    expect(aufbauFuer('gibt-es-nicht')).toBeUndefined()
    // Der Aufbau des Manövrierens bleibt, was er war: Der parallele ist dort nicht wählbar.
    expect(aufbauOf('parallel').disziplin).toBe('manoevrieren')
  })

  it('Listen des Parallelslaloms: Zeit, Steg, Fahrweg – nur unter einem Regelwerk, das ihn kennt', () => {
    expect(parallelAufbauId(konfig)).toBe('parallel')
    expect(parallelListen(konfig)).toEqual(['zeit', 'steg', 'parallelparcours'])
    expect(parallelAufbauId(dm)).toBeUndefined()
    expect(parallelListen(dm)).toEqual([])
    expect(parallelBoegen(reducer(uim(), { type: 'SET_REGELWERK', regelwerk: 'dm-2026' }), dm).boegen).toEqual([])
  })
})

describe('Lauf-Schlüssel des Parallelslaloms', () => {
  it('parallel:pre/1|2 – gebaut wie laufSchluessel, der Racecourse steht nicht darin', () => {
    expect(rundenDisziplin('pre')).toBe('parallel:pre')
    expect(attemptSchluessel('pre', 1)).toBe('parallel:pre/1')
    expect(attemptSchluessel('pre', 2)).toBe(laufSchluessel(rundenDisziplin('pre'), 2))
    expect(attemptSchluessel('rerun-pre-1', 2)).toBe('parallel:rerun-pre-1/2')
    expect(zerlegeAttempt('parallel:pre/2')).toEqual({ runde: 'pre', attempt: 2 })
    expect(zerlegeAttempt('parallel:rerun-pre-1/1')).toEqual({ runde: 'rerun-pre-1', attempt: 1 })
    expect(zerlegeAttempt('manoevrieren/1')).toBeUndefined()
    expect(zerlegeAttempt('parallel/1')).toBeUndefined()
    expect(zerlegeAttempt('parallel:quatsch/1')).toBeUndefined()
    expect(rundeVon('parallel:semi')).toBe('semi')
    expect(rundeHatEingaben({ 'manoevrieren/1': {}, 'parallel:pre/2': {} }, 'pre')).toBe(true)
    expect(rundeHatEingaben({ 'manoevrieren/1': {} }, 'pre')).toBe(false)
  })
})

describe('gruppenSeiten: Seitenende nur am Ende eines Blocks', () => {
  it('ohne Messung steht alles auf einer Seite', () => {
    expect(gruppenSeiten([4, 4, 2], 0)).toEqual([[0, 1, 2]])
    expect(gruppenSeiten([], 10)).toEqual([[]])
  })

  it('teilt nie einen Block, braucht so wenige Seiten wie möglich und gleicht sie aus', () => {
    // 5 Blöcke zu 4 Zeilen, 10 passen: drei Seiten, 2 + 2 + 1 Blöcke (nie 2,5) – gleichmäßiger geht es nicht.
    expect(gruppenSeiten([4, 4, 4, 4, 4], 10)).toEqual([[0, 1], [2, 3], [4]])
    // 6 Blöcke, 18 passen: zwei Seiten – ausgeglichen 3 + 3 Blöcke statt 4 + 2.
    expect(gruppenSeiten([4, 4, 4, 4, 4, 4], 18)).toEqual([[0, 1, 2], [3, 4, 5]])
    // Passt alles, bleibt es eine Seite.
    expect(gruppenSeiten([4, 4, 2], 10)).toEqual([[0, 1, 2]])
  })

  it('Seiten ausgleichen (Entscheidung des Nutzers): 70 Starts, 34 passen – 24 + 24 + 22 statt 32 + 32 + 6', () => {
    // 17 Blöcke zu 4 und einer zu 2 (70 Starts). So voll wie möglich wären es 32 + 32 + 6 – ausgeglichen
    // sind es drei fast gleich volle Seiten.
    const laengen = [...Array(17).fill(4), 2]
    const zeilen = (seiten: number[][]) => seiten.map((s) => s.reduce((n, g) => n + laengen[g], 0))
    expect(zeilen(gruppenSeiten(laengen, 34))).toEqual([24, 24, 22])
    // Steht der kurze Block mittendrin, bleibt es ebenso ausgeglichen.
    const mitten = [...Array(8).fill(4), 2, ...Array(9).fill(4)]
    expect(gruppenSeiten(mitten, 34).map((s) => s.reduce((n, g) => n + mitten[g], 0))).toEqual([24, 22, 24])
    // Keine Seite trägt mehr, als passt, und die Zahl der Seiten bleibt die kleinste (der Reihe nach gefüllt).
    const voll = (kap: number) => laengen.reduce((a, n) => (a.belegt + n > kap ? { seiten: a.seiten + 1, belegt: n } : { ...a, belegt: a.belegt + n }), { seiten: 1, belegt: 0 }).seiten
    for (const kap of [8, 13, 20, 30, 50]) {
      const seiten = gruppenSeiten(laengen, kap)
      expect(Math.max(...zeilen(seiten))).toBeLessThanOrEqual(kap)
      expect(seiten).toHaveLength(voll(kap))
      expect(seiten.flat()).toEqual(laengen.map((_, i) => i))
    }
  })

  it('der Rest steht nicht allein auf dem letzten Blatt: die kürzeste Seite so lang wie möglich', () => {
    const zeilen = (laengen: number[], kap: number) => gruppenSeiten(laengen, kap).map((s) => s.reduce((n, g) => n + laengen[g], 0))
    const bloecke = (n: number) => Array<number>(n).fill(4)
    // 40 Starts in Blöcken zu 4, 12 je Seite: vier Seiten – 12 + 12 + 8 + 8 statt 12 + 12 + 12 + 4.
    expect(zeilen(bloecke(10), 12)).toEqual([12, 12, 8, 8])
    // 100 Starts, 28 passen: 28 + 24 + 24 + 24 statt 28 + 28 + 28 + 16.
    expect(zeilen(bloecke(25), 28)).toEqual([28, 24, 24, 24])
    // 120 Starts, 32 passen: 32 + 32 + 28 + 28 statt 32 + 32 + 32 + 24.
    expect(zeilen(bloecke(30), 32)).toEqual([32, 32, 28, 28])
    expect(zeilen(bloecke(13), 20)).toEqual([20, 16, 16])
    expect(zeilen(bloecke(19), 28)).toEqual([28, 24, 24])
  })

  it('ein Block, der allein nicht passt, steht für sich – er wird nicht zerrissen', () => {
    expect(gruppenSeiten([2, 12, 2], 5)).toEqual([[0], [1], [2]])
  })
})

describe('Listen des Vorlaufs', () => {
  it('ohne festgeschriebenen Plan gibt es keine Liste', () => {
    const offen = uim(FELD(), false)
    expect(parallelBoegen(offen, konfig).boegen).toEqual([])
    expect(festeRunden(offen.parallelPlaene)).toEqual([])
  })

  it('sechs Listen je Runde: je Racecourse Zeit, Steg, Fahrweg – erst A, dann B', () => {
    const p = parallelBoegen(uim(), konfig)
    expect(p.runden).toEqual(['pre'])
    expect(p.boegen.map((b) => `${b.runde?.racecourse}:${b.typeId}`)).toEqual(['A:zeit', 'A:steg', 'A:parallelparcours', 'B:zeit', 'B:steg', 'B:parallelparcours'])
    expect(new Set(p.boegen.map((b) => b.id)).size).toBe(6)
    expect(p.boegen.every((b) => b.auftrag.disziplin === 'parallel:pre' && b.auftrag.aufbauId === 'parallel' && b.optionen.leerzeilen === 0)).toBe(true)
    // Die Bögen des Manövrierens kennen sie nicht: Dort bleibt alles, wie es war.
    expect(wkrBoegenZumStand(uim(), konfig).boegen.some((b) => b.runde !== undefined)).toBe(false)
  })

  it('Zeile n ist auf A und B derselbe Start, in Planreihenfolge über alle Klassen', () => {
    const state = uim()
    const plan = state.parallelPlaene.pre!
    const a = rundenZeilen(plan, state.starters, 'A')
    const b = rundenZeilen(plan, state.starters, 'B')
    expect(a).toHaveLength(plan.starts.length)
    expect(a.map((z) => z.start)).toEqual(plan.starts.map((_, i) => i + 1))
    expect(b.map((z) => [z.start, z.attempt, z.gruppe])).toEqual(a.map((z) => [z.start, z.attempt, z.gruppe]))
    plan.starts.forEach((s, i) => {
      expect(a[i].id ?? null).toBe(s.a)
      expect(b[i].id ?? null).toBe(s.b)
      expect(a[i].attempt).toBe(s.attempt)
    })
    // Mehrere Klassen auf einer Liste; jede Zeile nennt ihre.
    expect(new Set(a.flatMap((z) => (z.klasse ? [z.klasse] : []))).size).toBeGreaterThan(1)
  })

  it('jeder Starter steht je Attempt genau einmal – einmal auf A, einmal auf B (Pkt. 4.4)', () => {
    const state = uim()
    const plan = state.parallelPlaene.pre!
    const zeilen = [...rundenZeilen(plan, state.starters, 'A').map((z) => ({ ...z, rc: 'A' })), ...rundenZeilen(plan, state.starters, 'B').map((z) => ({ ...z, rc: 'B' }))]
    for (const s of state.starters) {
      const eigene = zeilen.filter((z) => z.id === s.id)
      expect(eigene.map((z) => z.attempt).sort()).toEqual([1, 2])
      expect(new Set(eigene.map((z) => z.rc)).size).toBe(2)
      // Dasselbe sagt der Plan: Der frühere Start ist der 1. Attempt.
      expect(plaetzeVon(plan, s.id).map((x) => `${x.attempt}${x.racecourse}`).sort()).toEqual(eigene.map((z) => `${z.attempt}${z.rc}`).sort())
    }
    expect(attemptsImPlan(plan).get('E-1')).toEqual(new Set([1, 2]))
  })

  it('Dummy: Zeile ohne Starter; entfallener Start: Zeile bleibt, Positionen auch', () => {
    const state = uim()
    const plan = state.parallelPlaene.pre!
    const beide = [...rundenZeilen(plan, state.starters, 'A'), ...rundenZeilen(plan, state.starters, 'B')]
    // E hat drei Starter: einer fährt gegen einen Dummy – in beiden Attempts eine Dummy-Zeile.
    expect(beide.filter((z) => z.dummy)).toHaveLength(2)
    expect(beide.filter((z) => z.dummy).every((z) => z.id === undefined && z.nr === '')).toBe(true)
    // Beide Starter eines Paares gibt es nicht mehr: Der Start entfällt, die Zeilen bleiben.
    const ohne = state.starters.filter((s) => s.klasse !== '4')
    const a = rundenZeilen(plan, ohne, 'A')
    expect(a).toHaveLength(plan.starts.length)
    expect(a.filter((z) => z.entfaellt)).toHaveLength(2)
    expect(a.map((z) => z.start)).toEqual(plan.starts.map((_, i) => i + 1))
  })

  it('Bogenmodell: Start, Klasse und Attempt vorn; Kopf nennt Runde und Racecourse statt Klasse und Lauf', () => {
    const state = uim()
    const bogen = parallelBoegen(state, konfig).boegen.find((b) => b.runde?.racecourse === 'B' && b.typeId === 'steg')!
    // In der Sprache des Bogens – hier englisch, wie es das Regelwerk vorgibt.
    const [seite] = bogenSeiten(configFor({ regelwerk: 'uim-2026', sprache: 'en' }), bogen.auftrag, bogen.optionen)
    expect(seite.startForm).toBe(true)
    expect(seite.zeigtKlasse).toBe(true)
    expect(seite.klassenText).toBe('Preliminary heat')
    expect(seite.parcours).toBe('Racecourse B')
    expect(seite.laufText).toBeUndefined()
    expect(seite.texte.attempt).toBe('Attempt')
    // Keine Leerzeilen: so viele Zeilen wie Starts.
    expect(seite.rows).toHaveLength(state.parallelPlaene.pre!.starts.length)
    expect(seite.rows.every((r) => r.fixed)).toBe(true)
    expect(seite.rows.map((r) => r.key)).toEqual(seite.rows.map((_, i) => `s${i + 1}`))
    const starter = seite.rows.find((r) => r.starter === 'E-1')!
    expect([starter.nr, starter.klasseText, starter.lauf]).toEqual(['E01', 'Dolphin', plaetzeVon(state.parallelPlaene.pre!, 'E-1').find((x) => x.racecourse === 'B')!.attempt])
    // Dummy: schraffierte Zeile ohne Eingabe – keine Zelle gilt.
    const dummy = seite.rows.find((r) => r.dummy)!
    expect(dummy.starter).toBeUndefined()
    expect(dummy.cells.every((c) => !c.gilt)).toBe(true)
    // Linie am Blockende: an der letzten Zeile jedes Blocks.
    const enden = seite.rows.filter((r) => r.blockEnde).map((r) => r.start)
    const laengen = blockLaengen(state.parallelPlaene.pre!)
    expect(enden).toEqual(laengen.map((_, i) => laengen.slice(0, i + 1).reduce((x, y) => x + y, 0)))
    // Deutsch und zweisprachig wie bei den übrigen Bögen.
    const de = bogenSeiten(configFor({ regelwerk: 'uim-2026', sprache: 'de' }), bogen.auftrag, bogen.optionen)[0]
    expect([de.klassenText, de.parcours, de.texte.attempt]).toEqual(['Vorlauf', 'Parcours B', 'Versuch'])
    const beide = bogenSeiten(configFor({ regelwerk: 'uim-2026', sprache: 'de+en' }), bogen.auftrag, bogen.optionen)[0]
    expect(beide.klassenText).toBe('Vorlauf / Preliminary heat')
  })

  it('Seiten: Bruch nur am Blockende, jede Liste für sich, so wenige Seiten wie möglich und ausgeglichen', () => {
    // 4 kleine und 4 große Paare → 4 volle Blöcke zu 4 Starts, danach nichts.
    const state = uim([...mk('1', 8), ...mk('4', 8)])
    const plan = state.parallelPlaene.pre!
    expect(blockLaengen(plan)).toEqual([4, 4, 4, 4])
    const boegen = parallelBoegen(state, konfig).boegen
    // Die Zeit-Liste fasst mehr als die Listen mit Legende: Sie bleibt auf einem Blatt, die anderen teilen.
    const starts = (b: (typeof boegen)[number], zeilenKapazitaet: number) => bogenSeiten(konfig, b.auftrag, { ...b.optionen, zeilenKapazitaet }).map((s) => s.rows.map((r) => r.start))
    const zeit = boegen.find((b) => b.typeId === 'zeit')!
    const steg = boegen.find((b) => b.typeId === 'steg')!
    expect(starts(zeit, 30)).toHaveLength(1)
    // 13 Zeilen passen: zwei Blätter, ausgeglichen 8 + 8 statt 12 + 4 (Entscheidung des Nutzers).
    expect(starts(steg, 13)).toEqual([
      [1, 2, 3, 4, 5, 6, 7, 8],
      [9, 10, 11, 12, 13, 14, 15, 16],
    ])
    const seiten = bogenSeiten(konfig, steg.auftrag, { ...steg.optionen, zeilenKapazitaet: 13 })
    // Kein Block ist zerrissen: Jede Seite endet mit einem Blockende.
    expect(seiten.every((s) => s.rows[s.rows.length - 1].blockEnde)).toBe(true)
    expect(seiten.map((s) => s.qr?.slice(-3))).toEqual(['.S1', '.S2'])
    expect(rundenSeitenzahl(plan, 13)).toBe(2)
    expect(rundenSeitenzahl(plan, 30)).toBe(1)
    expect(rundenSeitenzahl(plan, 0)).toBe(1)
    // Gemessen wird je Racecourse und Liste ein Bogen: Die Sprache des Bogens gilt je Racecourse.
    expect(messBoegenRunde(boegen).map((b) => messKennungRunde({ racecourse: b.runde!.racecourse, typeId: b.typeId }))).toEqual([
      'A|zeit',
      'A|steg',
      'A|parallelparcours',
      'B|zeit',
      'B|steg',
      'B|parallelparcours',
    ])
  })

  it('„Starter je Seite“ und „Teilen ab“ gelten als Obergrenze, abgerundet auf Blockenden', () => {
    const basis = uim([...mk('1', 8), ...mk('4', 8)])
    const plan = basis.parallelPlaene.pre!
    const zeit = (stand: typeof basis) => parallelBoegen(stand, konfig).boegen.find((b) => b.typeId === 'zeit')!
    const zeilen = (stand: typeof basis, zeilenKapazitaet: number) => bogenSeiten(konfig, zeit(stand).auftrag, { ...zeit(stand).optionen, zeilenKapazitaet }).map((s) => s.rows.length)
    // 10 je Seite: zwei Blöcke (8) passen, der dritte nicht mehr.
    expect(zeilen({ ...basis, wkrZeilenJeSeite: 10 }, 30)).toEqual([8, 8])
    expect(rundenSeitenzahl(plan, 30, { zeilenJeSeite: 10 })).toBe(2)
    // Passt gemessen weniger aufs Blatt, gilt das.
    expect(zeilen({ ...basis, wkrZeilenJeSeite: 10 }, 5)).toEqual([4, 4, 4, 4])
    // „Teilen ab“: erst Listen mit mindestens so vielen Starts.
    expect(zeilen({ ...basis, wkrZeilenJeSeite: 10, wkrTeilenAb: 20 }, 30)).toEqual([16])
    expect(rundenSeitenzahl(plan, 30, { zeilenJeSeite: 10, teilenAb: 20 })).toBe(1)
    // Auch ohne Messung (Test, erster Aufbau) teilt die feste Zahl.
    expect(zeilen({ ...basis, wkrZeilenJeSeite: 10 }, 0)).toEqual([8, 8])
  })

  it('Steg ohne „Bemerkung“, Fahrweg mit Σ; jede zweite Zeile grau als Vorgabe, abschaltbar', () => {
    const state = uim()
    const { boegen } = parallelBoegen(state, konfig)
    const spalten = (typeId: string) => bogenSeiten(konfig, boegen.find((b) => b.typeId === typeId)!.auftrag, {})[0].columns.map((c) => c.key)
    expect(spalten('steg')).toEqual(['fehlerAB', 'fpab', 'fehlerAN', 'fpan', 'disq', 'sum'])
    // Die Liste selbst (Manövrieren) behält die Spalte.
    expect(konfig.getSheetDef('steg').columns.map((c) => c.key)).toContain('bemerkung')
    expect(spalten('parallelparcours').slice(-2)).toEqual(['disq', 'sum'])
    const grau = (stand: typeof state) => {
      const b = parallelBoegen(stand, konfig).boegen[0]
      return bogenSeiten(konfig, b.auftrag, b.optionen)[0].rows.map((r) => r.shaded)
    }
    expect(grau(state).slice(0, 4)).toEqual([false, true, false, true])
    expect(grau({ ...state, parallelZebra: false }).some(Boolean)).toBe(false)
  })

  it('Laufzettel: immer je Racecourse einer, ein Kästchen je Blatt seiner drei Listen, eigener Code (Entscheidung des Nutzers)', () => {
    const state = uim([...mk('1', 8), ...mk('4', 8)])
    const parallel = parallelBoegen(state, konfig)
    const seitenVon = (_r: string, typeId: string) => (typeId === 'zeit' ? 1 : 3)
    const zettel = rundenZettel(state, parallel, seitenVon)
    expect(zettel.map((z) => [z.id, z.racecourse, z.schritte])).toEqual([
      ['parallel|pre|A', 'A', true],
      ['parallel|pre|B', 'B', false],
    ])
    expect(zettel[0].listen.map((l) => l.boegen.map((b) => `${b.racecourse}${b.seiten}`))).toEqual([['A1'], ['A3'], ['A3']])
    expect(zettel[1].listen.map((l) => l.boegen.map((b) => `${b.racecourse}${b.seiten}`))).toEqual([['B1'], ['B3'], ['B3']])
    // Jeder Zettel hat seinen Code: Er öffnet nur die Listen seines Racecourse.
    expect(zettel.map((z) => z.qr)).toEqual(['ALC2.K7Q4.UIM2026.PARALLEL.PRE.A', 'ALC2.K7Q4.UIM2026.PARALLEL.PRE.B'])
    // Die Seitenzahl gilt je Racecourse: Ein zweisprachiger Bogen auf B kann mehr Blätter haben als auf A.
    const jeRacecourse = rundenZettel(state, parallel, (_r, typeId, rc) => (typeId === 'steg' && rc === 'B' ? 4 : 1))
    expect(jeRacecourse.map((z) => z.listen[1].boegen.map((b) => b.seiten))).toEqual([[1], [4]])
  })

  it('Auswahl nach Racecourse und Liste', () => {
    const { boegen } = parallelBoegen(uim(), konfig)
    expect(waehleRundenBoegen(boegen, {})).toHaveLength(6)
    expect(waehleRundenBoegen(boegen, { racecourse: 'B' }).map((b) => b.typeId)).toEqual(['zeit', 'steg', 'parallelparcours'])
    expect(waehleRundenBoegen(boegen, { liste: 'steg', runde: 'pre' }).map((b) => b.runde?.racecourse)).toEqual(['A', 'B'])
    expect(waehleRundenBoegen(boegen, { runde: 'semi' })).toEqual([])
  })

  it('race officials je Racecourse: Namen aus der Einteilung unter der Kennung des Racecourse', () => {
    let state = uim()
    state = reducer(state, { type: 'SET_WKR_NAME', parcoursId: RACECOURSE_PARCOURS.A, typeId: 'zeit', name: 'Erika Beispiel' })
    state = reducer(state, { type: 'SET_WKR_NAME', parcoursId: RACECOURSE_PARCOURS.B, typeId: 'parallelparcours', name: 'Max Muster' })
    const { boegen } = parallelBoegen(state, konfig)
    const wkr = (rc: string, typeId: string) => boegen.find((b) => b.runde?.racecourse === rc && b.typeId === typeId)!.auftrag.wkr
    expect([wkr('A', 'zeit'), wkr('B', 'zeit'), wkr('B', 'parallelparcours')]).toEqual(['Erika Beispiel', '', 'Max Muster'])
    // Die Namen hängen an keinem Parcours der Verzahnung: Sie überstehen Laden und neue Parcours.
    expect(normalisiereEinteilung(state.einteilung, ['par_1'])).toEqual(state.einteilung)
    expect(haengeUm(state.einteilung, ['par_1'], ['par_9'])).toEqual(state.einteilung)
    expect(migrate(JSON.parse(JSON.stringify(state)))!.einteilung).toEqual(state.einteilung)
    const neu = reducer(reducer(state, { type: 'SET_VERZAHNUNG_LOCK', locked: false }), { type: 'SET_PARCOURS_PRESET', parcours: [{ id: 'par_neu', classIds: ['E', '1', '4'] }] })
    expect(neu.einteilung[RACECOURSE_PARCOURS.A]).toEqual({ zeit: 'Erika Beispiel' })
  })
})

describe('QR-Code der Listen einer Runde (ALC2)', () => {
  const kontext = { kennung: 'K7Q4', regelwerk: 'uim-2026', aufbau: 'parallel' }
  const bekannt: QrBekannt = {
    kennung: 'K7Q4',
    regelwerk: 'uim-2026',
    aufbau: 'alcatraz',
    regelwerke: ['dm-2026', 'uim-2026'],
    aufbauten: ['alcatraz', 'parallel'],
    parcours: ['par_1'],
    listen: ['zeit', 'steg', 'tor135'],
    laufCount: 2,
    parallel: { aufbau: 'parallel', listen: ['zeit', 'steg', 'parallelparcours'], runden: ['pre'] },
  }

  it('nennt Runde und Racecourse; Rundlauf über leseCode', () => {
    expect(rundenZettelCode(kontext, { runde: 'pre', racecourse: 'A' })).toBe('ALC2.K7Q4.UIM2026.PARALLEL.PRE.A')
    const code = seitenCode(rundenBogenCode(kontext, { runde: 'pre', racecourse: 'B', typeId: 'parallelparcours' }), 2)
    expect(code).toBe('ALC2.K7Q4.UIM2026.PARALLEL.PRE.B.PARALLELPARCOURS.S2')
    expect(code).toMatch(/^[A-Z0-9.]+$/)
    expect(leseCode(code, bekannt)).toEqual({ ok: true, ziel: { art: 'runde', runde: 'pre', racecourse: 'B', typeId: 'parallelparcours', seite: 2 } })
    expect(leseCode(' alc2.k7q4.uim2026.parallel.pre.b ', bekannt)).toEqual({ ok: true, ziel: { art: 'runde', runde: 'pre', racecourse: 'B' } })
    // Einen Laufzettel der ganzen Runde (beide Racecourses) gibt es nicht mehr.
    expect(leseCode('ALC2.K7Q4.UIM2026.PARALLEL.PRE', bekannt)).toEqual({ ok: false, fehler: { art: 'kaputt' } })
  })

  it('nennt den Grund, wenn ein Code der Runde nicht passt', () => {
    const fehler = (code: string, b: QrBekannt = bekannt) => {
      const l = leseCode(code, b)
      return l.ok ? 'ok' : l.fehler.art
    }
    expect(fehler('ALC2.K7Q4.UIM2026.PARALLEL.SEMI.A')).toBe('runde')
    expect(fehler('ALC2.K7Q4.UIM2026.PARALLEL.PRE.C')).toBe('racecourse')
    expect(fehler('ALC2.K7Q4.UIM2026.PARALLEL.PRE.C.ZEIT.S1')).toBe('racecourse')
    expect(fehler('ALC2.K7Q4.UIM2026.PARALLEL.PRE.A.TOR135.S1')).toBe('liste')
    expect(fehler('ALC2.K7Q4.UIM2026.PARALLEL.PRE.A.ZEIT')).toBe('kaputt')
    expect(fehler('ALC2.K7Q4.UIM2026.PARALLEL.PRE.A.ZEIT.S0')).toBe('kaputt')
    expect(fehler('ALC2.XXXX.UIM2026.PARALLEL.PRE.A')).toBe('veranstaltung')
    expect(fehler('ALC2.K7Q4.DM2026.PARALLEL.PRE.A')).toBe('regelwerk')
    expect(fehler('ALC2.K7Q4.UIM2026.ALCATRAZ.PRE.A')).toBe('aufbau')
    // Ohne Parallelslalom in der Veranstaltung passt kein ALC2-Blatt.
    expect(fehler('ALC2.K7Q4.UIM2026.PARALLEL.PRE.A', { ...bekannt, parallel: undefined })).toBe('aufbau')
    expect(fehler('ALC2.MUSTER.UIM2026.PARALLEL.PRE.A')).toBe('muster')
  })

  it('Kleines Finale (21.11.2026 eigene Runde): eigene sechs Listen, eigener Laufzettel, Code SMALL – nie verwechselt mit FINAL', () => {
    // Pläne von Hand: Klasse 1 im Kleinen Finale (1-1/1-2), Klasse 4 im Finale (4-1/4-2) – erfundene Starter.
    const paar = (a: string, b: string, klasse: ClassId, boot: 'klein' | 'gross') => [
      { a, b, attempt: 1 as const, block: 0, boot, klasse },
      { a: b, b: a, attempt: 2 as const, block: 0, boot, klasse },
    ]
    const state: AppState = {
      ...uim(),
      parallelPlaene: {
        ...uim().parallelPlaene,
        final: { runde: 'final', starts: paar('4-1', '4-2', '4', 'gross') },
        small: { runde: 'small', starts: paar('1-1', '1-2', '1', 'klein') },
      },
    }
    const p = parallelBoegen(state, konfig)
    expect(p.runden).toEqual(['pre', 'small', 'final'])
    const klein = p.boegen.filter((b) => b.runde?.runde === 'small')
    expect(klein).toHaveLength(6)
    expect(klein.every((b) => b.auftrag.disziplin === 'parallel:small')).toBe(true)
    expect(new Set(p.boegen.map((b) => b.id)).size).toBe(p.boegen.length)
    const qrKlein = klein.find((b) => b.runde?.racecourse === 'B' && b.typeId === 'zeit')!.auftrag.qr!
    expect(qrKlein).toBe('ALC2.K7Q4.UIM2026.PARALLEL.SMALL.B.ZEIT')
    // Hin und zurück: Bogen und Laufzettel des Kleinen Finales treffen ihre Runde, nicht das Finale.
    const bekanntHier: QrBekannt = { ...bekannt, parallel: { ...bekannt.parallel!, runden: p.runden } }
    const ziel = leseCode(seitenCode(qrKlein, 1), bekanntHier)
    expect(ziel).toEqual({ ok: true, ziel: { art: 'runde', runde: 'small', racecourse: 'B', typeId: 'zeit', seite: 1 } })
    expect(scanRundenBogen((ziel as { ziel: QrRundenZiel }).ziel, p.boegen)?.runde?.runde).toBe('small')
    expect(leseCode(rundenZettelCode(kontext, { runde: 'small', racecourse: 'A' }), bekanntHier)).toEqual({ ok: true, ziel: { art: 'runde', runde: 'small', racecourse: 'A' } })
    expect(leseCode(rundenZettelCode(kontext, { runde: 'final', racecourse: 'A' }), bekanntHier)).toEqual({ ok: true, ziel: { art: 'runde', runde: 'final', racecourse: 'A' } })
    // Die Laufzettel: je Runde und Racecourse einer.
    expect(rundenZettel(state, p, () => 1).map((z) => z.qr)).toEqual(expect.arrayContaining(['ALC2.K7Q4.UIM2026.PARALLEL.SMALL.A', 'ALC2.K7Q4.UIM2026.PARALLEL.FINAL.A']))
  })

  it('alte Codes (ALC1) bleiben lesbar, und die Bögen des Manövrierens tragen weiter ALC1', () => {
    expect(leseCode('ALC1.K7Q4.UIM2026.ALCATRAZ.PAR1.E.2.STEG.S1', bekannt)).toEqual({
      ok: true,
      ziel: { parcoursId: 'par_1', klassen: ['E'], lauf: 2, typeId: 'steg', seite: 1 },
    })
    const state = uim()
    expect(wkrBoegenZumStand(state, konfig).boegen.every((b) => b.auftrag.qr?.startsWith('ALC1.'))).toBe(true)
    expect(parallelBoegen(state, konfig).boegen.every((b) => b.auftrag.qr?.startsWith('ALC2.K7Q4.UIM2026.PARALLEL.PRE.'))).toBe(true)
  })

  it('vom Code zum Bogen: Bogen-Code trifft seine Liste, der Laufzettel die erste seines Racecourse', () => {
    const { boegen } = parallelBoegen(uim(), konfig)
    expect(scanRundenBogen({ art: 'runde', runde: 'pre', racecourse: 'B', typeId: 'steg', seite: 1 }, boegen)?.id).toBe('parallel|pre|B|steg')
    expect(scanRundenBogen({ art: 'runde', runde: 'pre', racecourse: 'A' }, boegen)?.id).toBe('parallel|pre|A|zeit')
    expect(scanRundenBogen({ art: 'runde', runde: 'pre', racecourse: 'B' }, boegen)?.id).toBe('parallel|pre|B|zeit')
    expect(scanRundenBogen({ art: 'runde', runde: 'semi', racecourse: 'A' }, boegen)).toBeNull()
    // Unter den Bögen des Manövrierens trifft ein Blatt der Runde nie.
    expect(scanBogen({ art: 'runde', runde: 'pre', racecourse: 'A' }, boegen, () => false)).toBeNull()
  })
})

describe('Laufzettel je Runde', () => {
  it('zwei Zettel je Runde: je Racecourse die Kästchen seiner Listen, je Druckseite eines', () => {
    const state = uim()
    const p = parallelBoegen(state, konfig)
    const [a, b, ...rest] = rundenZettel(state, p, () => 2)
    expect(rest).toEqual([])
    expect([a.runde, b.runde]).toEqual(['pre', 'pre'])
    expect([a.qr, b.qr]).toEqual(['ALC2.K7Q4.UIM2026.PARALLEL.PRE.A', 'ALC2.K7Q4.UIM2026.PARALLEL.PRE.B'])
    expect(a.listen.map((l) => l.typeId)).toEqual(['zeit', 'steg', 'parallelparcours'])
    expect(a.listen.every((l) => l.boegen.map((x) => `${x.racecourse}${x.seiten}`).join() === 'A2')).toBe(true)
    expect(b.listen.every((l) => l.boegen.map((x) => `${x.racecourse}${x.seiten}`).join() === 'B2')).toBe(true)
    expect(rundenZettel(uim(FELD(), false), parallelBoegen(uim(FELD(), false), konfig), () => 1)).toEqual([])
  })
})

describe('Erfassung des Vorlaufs', () => {
  it('die Werte einer Zeile stehen unter Starter und Attempt; Dummy-Zeilen zählen nicht', () => {
    let state = uim()
    const { boegen } = parallelBoegen(state, konfig)
    const zeitA = boegen[0]
    expect(zeilenSchluessel(konfig, state.aufbau, zeitA.auftrag, 2)).toBe('parallel:pre/2')
    const gesamt = zeitA.auftrag.zeilen.filter((z) => z.id).length
    expect(bogenFortschritt(konfig, state.eingaben, state.aufbau, zeitA.auftrag)).toEqual({ erfasst: 0, gesamt })
    expect(gesamt).toBe(zeitA.auftrag.zeilen.length - 1)
    // Ein Wert zu Starter und Attempt erscheint genau auf der Liste des Racecourse, auf dem er im Plan fährt.
    const zeile = zeitA.auftrag.zeilen.find((z) => z.id)!
    state = reducer(state, { type: 'SET_EINGABEN', zellen: [{ lauf: attemptSchluessel('pre', zeile.attempt!), starter: zeile.id!, feld: 'zeit1', wert: '1,0500' }] })
    expect(state.eingaben[`parallel:pre/${zeile.attempt}`][zeile.id!]).toEqual({ zeit1: '1,0500' })
    expect(bogenFortschritt(konfig, state.eingaben, state.aufbau, zeitA.auftrag).erfasst).toBe(1)
    expect(bogenFortschritt(konfig, state.eingaben, state.aufbau, boegen[3].auftrag).erfasst).toBe(0)
    // Das Manövrieren zählt davon nichts.
    const manoever = wkrBoegenZumStand(state, konfig).boegen
    expect(manoever.every((b) => bogenFortschritt(konfig, state.eingaben, state.aufbau, b.auftrag).erfasst === 0)).toBe(true)
  })

  it('Werte des Vorlaufs sind keine „verborgenen“ – außer Plan, Attempt oder Feld fehlen', () => {
    let state = uim()
    const zellen = [
      { lauf: 'parallel:pre/1', starter: 'E-1', feld: 'zeit1', wert: '1,0500' },
      { lauf: 'parallel:pre/2', starter: 'E-1', feld: 'erfasst@steg', wert: '1' },
      { lauf: 'manoevrieren/1', starter: 'E-1', feld: 'zeit1', wert: '1,2000' },
    ]
    state = reducer(state, { type: 'SET_EINGABEN', zellen })
    expect(verborgeneZellen(state, konfig)).toEqual([])
    // Ein Attempt, den der Plan nicht kennt, und ein Feld, das keine Liste des Parallelslaloms hat.
    state = reducer(state, { type: 'SET_EINGABEN', zellen: [{ lauf: 'parallel:pre/3', starter: 'E-1', feld: 'zeit1', wert: '1,0000' }, { lauf: 'parallel:pre/1', starter: 'E-1', feld: 'katalog:tor5', wert: '7' }] })
    expect(verborgeneZellen(state, konfig).map((z) => `${z.lauf}:${z.feld}`).sort()).toEqual(['parallel:pre/1:katalog:tor5', 'parallel:pre/3:zeit1'])
    // Ohne Plan zeigt keine Liste die Werte der Runde.
    const ohnePlan = { ...state, parallelPlaene: {} }
    expect(verborgeneZellen(ohnePlan, konfig).filter((z) => z.lauf.startsWith('parallel:'))).toHaveLength(4)
  })

  it('ein anderer Aufbau des Manövrierens lässt die Werte des Vorlaufs stehen', () => {
    let state = uim()
    state = reducer(state, { type: 'SET_EINGABEN', zellen: [{ lauf: 'parallel:pre/1', starter: '4-1', feld: 'zeit1', wert: '0,5800' }] })
    const vorher = state.eingaben['parallel:pre/1']
    state = reducer(state, { type: 'SET_AUFBAU', aufbau: 'bawue' })
    state = reducer(state, { type: 'SET_TOR5_MIT_PARCOURS', on: true })
    state = reducer(state, { type: 'SET_AUFBAU', aufbau: 'alcatraz' })
    expect(state.eingaben['parallel:pre/1']).toEqual(vorher)
    expect(migrate(JSON.parse(JSON.stringify(state)))!.eingaben['parallel:pre/1']).toEqual(vorher)
  })

  it('sind Werte erfasst, bleibt der Plan fest – auch bei freigegebener Verzahnung; die Schalter sind gesperrt', () => {
    let state = uim()
    const plan = state.parallelPlaene.pre
    // Ohne Werte entfällt der Plan beim Freigeben (wie bisher).
    expect(reducer(state, { type: 'SET_VERZAHNUNG_LOCK', locked: false }).parallelPlaene.pre).toBeUndefined()
    state = reducer(state, { type: 'SET_EINGABEN', zellen: [{ lauf: 'parallel:pre/1', starter: 'E-1', feld: 'zeit1', wert: '1,0500' }] })
    const frei = reducer(state, { type: 'SET_VERZAHNUNG_LOCK', locked: false })
    expect(frei.verzahnungLocked).toBe(false)
    expect(frei.parallelPlaene.pre).toEqual(plan)
    expect(reducer(frei, { type: 'SET_PARALLEL_STRENG', value: false })).toBe(frei)
    expect(reducer(frei, { type: 'SET_CLASS4_SMALL', class4Small: true })).toBe(frei)
    expect(reducer(frei, { type: 'SET_PARALLEL_ORDER_BY_STARTNR', value: true })).toBe(frei)
    expect(reducer(frei, { type: 'SET_VERZAHNUNG_LOCK', locked: true }).parallelPlaene.pre).toEqual(plan)
    // Das letzte einzelne Feld zu leeren löst den Plan NICHT (Entscheidung des Nutzers): Er und
    // seine Schalter bleiben, bis „Werte löschen“ gedrückt wird.
    const leer = reducer(frei, { type: 'SET_EINGABEN', zellen: [{ lauf: 'parallel:pre/1', starter: 'E-1', feld: 'zeit1', wert: '' }] })
    expect(leer.eingaben).toEqual({})
    expect(leer.parallelPlaene.pre).toEqual(plan)
    expect(reducer(leer, { type: 'SET_PARALLEL_STRENG', value: false })).toBe(leer)
    // Auch ein Neuladen (Migration) lässt ihn stehen.
    expect(migrate(JSON.parse(JSON.stringify(leer)))!.parallelPlaene.pre).toEqual(plan)
    // „Werte löschen“ löst ihn – danach folgt der Plan wieder dem Starterfeld.
    const geloescht = reducer(leer, { type: 'CLEAR_EINGABEN' })
    expect(geloescht.parallelPlaene.pre).toBeUndefined()
    expect(reducer(geloescht, { type: 'SET_PARALLEL_STRENG', value: false }).parallelStreng).toBe(false)
    // Mit Werten ebenso: „Werte löschen“ bei freigegebener Verzahnung nimmt den Plan mit.
    expect(reducer(frei, { type: 'CLEAR_EINGABEN' }).parallelPlaene).toEqual({})
    // Bei festgeschriebener Verzahnung bleibt er.
    expect(reducer(state, { type: 'CLEAR_EINGABEN' }).parallelPlaene.pre).toEqual(plan)
  })
})

describe('Beispielwerte für den Vorlauf', () => {
  it('füllt für jeden Starter des Plans beide Attempts auf allen Listen; der Dummy bekommt nichts', () => {
    const state = uim()
    const eingaben = beispielRunde(state, konfig, 'pre', { zeitnahme: 'stoppuhr' }, zufallAus(7))
    for (const attempt of [1, 2]) {
      const zeilen = eingaben[`parallel:pre/${attempt}`]
      expect(Object.keys(zeilen).sort()).toEqual(state.starters.map((s) => s.id).sort())
      for (const werte of Object.values(zeilen)) {
        expect(werte['erfasst@zeit']).toBe('1')
        expect(werte['erfasst@steg']).toBe('1')
        expect(werte['erfasst@parallelparcours']).toBe('1')
        expect(werte.zeit1).toMatch(/^\d,\d{4}$|^\d+,\d{2}$/)
      }
    }
    // Danach ist jede Liste vollständig erfasst, und nichts davon ist verborgen.
    const mit = { ...state, eingaben }
    expect(parallelBoegen(mit, konfig).boegen.every((b) => {
      const f = bogenFortschritt(konfig, eingaben, mit.aufbau, b.auftrag)
      return f.gesamt > 0 && f.erfasst === f.gesamt
    })).toBe(true)
    expect(verborgeneZellen(mit, konfig)).toEqual([])
    // Gleiche Saat, gleiche Werte; das Manövrieren bleibt unberührt.
    expect(beispielRunde(state, konfig, 'pre', { zeitnahme: 'stoppuhr' }, zufallAus(7))).toEqual(eingaben)
    expect(Object.keys(eingaben).every((k) => k.startsWith('parallel:pre/'))).toBe(true)
  })

  it('ohne festgeschriebenen Plan und ohne Parallelslalom ändert sich nichts', () => {
    const offen = uim(FELD(), false)
    expect(beispielRunde(offen, konfig, 'pre', { zeitnahme: 'stoppuhr' }, zufallAus(1))).toBe(offen.eingaben)
    const fest = uim()
    expect(beispielRunde(fest, dm, 'pre', { zeitnahme: 'stoppuhr' }, zufallAus(1))).toBe(fest.eingaben)
  })

  it('Beispielwerte nur für das Gewählte: eine Runde füllen und wieder löschen lässt das Manövrieren stehen', () => {
    const manoever = reducer(uim(), { type: 'FILL_BEISPIELWERTE', zeitnahme: 'lichtschranke', saat: 5 })
    const vorher = Object.keys(manoever.eingaben).sort()
    const mitVorlauf = reducer(manoever, { type: 'FILL_BEISPIELWERTE', zeitnahme: 'lichtschranke', saat: 6, runden: ['pre'], nurRunden: true })
    // Das Manövrieren ist unberührt (dieselben Objekte), der Vorlauf dazu.
    for (const k of vorher) expect(mitVorlauf.eingaben[k]).toBe(manoever.eingaben[k])
    expect(Object.keys(mitVorlauf.eingaben).sort()).toEqual([...vorher, attemptSchluessel('pre', 1), attemptSchluessel('pre', 2)].sort())
    // Eine Runde ohne festgeschriebenen Plan füllt nichts.
    expect(reducer(manoever, { type: 'FILL_BEISPIELWERTE', zeitnahme: 'lichtschranke', saat: 6, runden: ['semi'], nurRunden: true }).eingaben).toEqual(manoever.eingaben)
    // Löschen für das Gewählte: nur die Runde; der Plan bleibt festgeschrieben.
    const ohne = reducer(mitVorlauf, { type: 'CLEAR_EINGABEN_TEIL', runden: ['pre'] })
    expect(Object.keys(ohne.eingaben).sort()).toEqual(vorher)
    expect(ohne.parallelPlaene.pre).toBe(mitVorlauf.parallelPlaene.pre)
  })

  it('„Werte des Gewählten löschen“ lässt Abgemeldeten ihr X; Beispielwerte geben ihnen keine Werte', () => {
    let s = reducer(uim(), { type: 'FILL_BEISPIELWERTE', zeitnahme: 'stoppuhr', saat: 7, laeufe: [1] })
    const id = s.parallelPlaene.pre!.starts.find((x) => x.a !== null)!.a!
    s = reducer(s, { type: 'ABMELDEN_STARTER', id })
    const xIn = (st: AppState) => Object.keys(st.eingaben).filter((k) => st.eingaben[k][id] && Object.values(st.eingaben[k][id]).includes('X')).sort()
    const M2 = laufSchluessel('manoevrieren', 2)
    expect(xIn(s)).toEqual([M2, attemptSchluessel('pre', 1), attemptSchluessel('pre', 2)].sort())
    // Die Runde löschen: Das X kommt zurück, der Starter bleibt abgemeldet.
    const ohnePre = reducer(s, { type: 'CLEAR_EINGABEN_TEIL', runden: ['pre'] })
    expect([xIn(ohnePre), ohnePre.abgemeldet]).toEqual([xIn(s), [id]])
    // Lauf 1 trug Werte (gefahren vor der Abmeldung): gelöscht, steht dort jetzt sein X.
    expect(xIn(reducer(s, { type: 'CLEAR_EINGABEN_TEIL', laeufe: [1] }))).toContain(laufSchluessel('manoevrieren', 1))
    // Beispielwerte überschreiben das X nicht – weder in der Runde noch im Manövrieren.
    const runde = reducer(ohnePre, { type: 'FILL_BEISPIELWERTE', zeitnahme: 'stoppuhr', saat: 9, runden: ['pre'], nurRunden: true })
    expect(xIn(runde)).toEqual(xIn(s))
    const laeufe = reducer(s, { type: 'FILL_BEISPIELWERTE', zeitnahme: 'stoppuhr', saat: 11, laeufe: [1, 2] })
    expect(laeufe.eingaben[M2][id]).toEqual(s.eingaben[M2][id])
  })

  it('„Werte des Gewählten löschen“, das alles leert, nimmt bei freigegebener Verzahnung den Plan mit – wie „Werte löschen“', () => {
    let s = reducer(uim(), { type: 'FILL_BEISPIELWERTE', zeitnahme: 'stoppuhr', saat: 3, runden: ['pre'], nurRunden: true })
    s = reducer(s, { type: 'SET_VERZAHNUNG_LOCK', locked: false })
    expect(s.parallelPlaene.pre).toBeDefined()
    const leer = reducer(s, { type: 'CLEAR_EINGABEN_TEIL', runden: ['pre'] })
    expect([leer.eingaben, leer.parallelPlaene]).toEqual([{}, {}])
  })

  it('Startliste einer Runde: je Start eine Zeile in den Blöcken des Plans, der Dummy als leerer Platz', () => {
    const state = uim()
    const liste = rundenStartliste(state, 'pre')!
    expect(liste.bloecke.map((b) => b.length)).toEqual(blockLaengen(state.parallelPlaene.pre!))
    const zeilen = liste.bloecke.flat()
    expect(zeilen.map((z) => z.start)).toEqual(zeilen.map((_, i) => i + 1))
    // E hat drei Starter: Einer fährt gegen den Dummy – in beiden Attempts, mit getauschtem Racecourse.
    const dummy = zeilen.filter((z) => z.a === null || z.b === null)
    expect(dummy.map((z) => [z.klasse, z.attempt, z.a === null ? 'A' : 'B'])).toEqual([
      ['E', 1, dummy[0].a === null ? 'A' : 'B'],
      ['E', 2, dummy[0].a === null ? 'B' : 'A'],
    ])
    expect(zeilen.every((z) => !z.entfaellt && z.klasse !== undefined)).toBe(true)
    // Ohne festgeschriebenen Plan gibt es keine Liste.
    expect(rundenStartliste(state, 'semi')).toBeUndefined()
    expect(rundenStartliste(uim(FELD(), false), 'pre')).toBeUndefined()
  })

  it('FILL_BEISPIELWERTE füllt den Vorlauf nur auf Wunsch – das Manövrieren wie zuvor', () => {
    const state = uim()
    const ohne = reducer(state, { type: 'FILL_BEISPIELWERTE', zeitnahme: 'lichtschranke', saat: 11 })
    const mit = reducer(state, { type: 'FILL_BEISPIELWERTE', zeitnahme: 'lichtschranke', saat: 11, runden: ['pre'] })
    expect(Object.keys(ohne.eingaben).some((k) => k.startsWith('parallel:'))).toBe(false)
    expect(Object.keys(mit.eingaben).filter((k) => k.startsWith('parallel:')).sort()).toEqual(['parallel:pre/1', 'parallel:pre/2'])
    for (const k of Object.keys(ohne.eingaben)) expect(mit.eingaben[k]).toEqual(ohne.eingaben[k])
  })
})

describe('Name der Runde auf den Listen der race officials (config/sprache.ts)', () => {
  it('eine Wiederholung nennt ihre Runde und ab der zweiten ihre Nummer – wie `rundenName`', () => {
    const de = bogenTexte('de')
    const en = bogenTexte('en')
    expect(['pre', 'semi', 'final'].map(de.runde)).toEqual(['Vorlauf', 'Halbfinale', 'Finale'])
    expect(['rerun-pre-1', 'rerun-pre-2', 'rerun-semi-1'].map(de.runde)).toEqual(['Vorlauf – Wiederholung', 'Vorlauf – 2. Wiederholung', 'Halbfinale – Wiederholung'])
    expect(['rerun-pre-1', 'rerun-pre-2', 'rerun-semi-1'].map(en.runde)).toEqual(['Preliminary heat – Re-run', 'Preliminary heat – Re-run 2', 'Semi-finals – Re-run'])
  })
})

describe('Beispielansicht: Muster-Runde des Parallelslaloms', () => {
  const stand = () => reducer(emptyState(), { type: 'SET_REGELWERK', regelwerk: 'uim-2026' })
  const wahl = { anzahl: 10, praefix: 'M', klasse: '3' as ClassId }

  it('Muster-Starter: die gewählte Klasse und eine des anderen Bootstyps; „Muster-Zeilen“ zählt Starts, aufgerundet auf Paare', () => {
    const starter = musterStarter(wahl, false)
    // 10 Starts = 5 Paare: 3 kleine (5 Starter, einer gegen den Dummy), 2 große.
    expect(starter.map((p) => `${p.startNr}:${p.klasse}`)).toEqual(['M1:3', 'M2:3', 'M3:3', 'M4:3', 'M5:3', 'M6:4', 'M7:4', 'M8:4', 'M9:4'])
    expect(new Set(starter.map((p) => p.id)).size).toBe(9)
    // Die gewählte Klasse fährt in ihrem Boot; groß gewählt, kommt die höchste kleine dazu.
    expect(new Set(musterStarter({ ...wahl, klasse: '5' }, false).map((p) => p.klasse))).toEqual(new Set(['3', '5']))
    expect(new Set(musterStarter({ ...wahl, klasse: '5' }, true).map((p) => p.klasse))).toEqual(new Set(['4', '5']))
    expect(musterStarter({ ...wahl, anzahl: 0 }, false)).toEqual([])
    expect(musterStarter({ ...wahl, anzahl: 1 }, false).map((p) => p.startNr)).toEqual(['M1'])
  })

  it('dieselben Bausteine wie die echten Listen: Blöcke 4 und 2, je Racecourse eine Dummy-Zeile, Muster-QR, Namen aus der Einteilung', () => {
    const s = { ...stand(), eventName: 'Hafenpokal', einteilung: { 'racecourse-b': { steg: 'Tom Test' } } }
    const muster = musterRundenBoegen(s, configFor({ regelwerk: 'uim-2026' }), wahl)
    expect(muster.boegen.map((b) => b.id)).toEqual([
      'parallel|pre|A|zeit',
      'parallel|pre|A|steg',
      'parallel|pre|A|parallelparcours',
      'parallel|pre|B|zeit',
      'parallel|pre|B|steg',
      'parallel|pre|B|parallelparcours',
    ])
    const a = muster.boegen[0].auftrag
    // Blöcke wie gedruckt: zwei 4er-Blöcke (klein/groß im Wechsel), dann ein 2er-Block.
    const bloecke: number[] = []
    a.zeilen.forEach((z, i) => (i > 0 && a.zeilen[i - 1].gruppe === z.gruppe ? bloecke[bloecke.length - 1]++ : bloecke.push(1)))
    expect(bloecke).toEqual([4, 4, 2])
    expect(a.zeilen.map((z) => z.nr)).toEqual(['M1', 'M6', 'M2', 'M7', 'M3', 'M8', 'M4', 'M9', 'M5', ''])
    // Je Racecourse genau eine Dummy-Zeile.
    for (const b of muster.boegen) expect(b.auftrag.zeilen.filter((z) => z.dummy)).toHaveLength(1)
    // Der Code ist gebaut wie der echte, trägt aber „MUSTER“: Die Erfassung erkennt ihn als Beispiel.
    expect(a.qr).toBe('ALC2.MUSTER.UIM2026.PARALLEL.PRE.A.ZEIT')
    const bekannt: QrBekannt = {
      kennung: 'K7Q4',
      regelwerk: 'uim-2026',
      aufbau: 'alcatraz',
      regelwerke: ['uim-2026'],
      aufbauten: ['alcatraz', 'parallel'],
      parcours: ['par_1'],
      listen: [],
      laufCount: 1,
      parallel: { aufbau: 'parallel', listen: ['zeit', 'steg', 'parallelparcours'], runden: ['pre'] },
    }
    expect(leseCode(seitenCode(a.qr!, 1), bekannt)).toEqual({ ok: false, fehler: { art: 'muster' } })
    // Der Name kommt aus der Einteilung des Racecourse – nur angezeigt; sonst bleibt die Linie leer.
    expect(muster.boegen.map((b) => b.auftrag.wkr)).toEqual(['', '', '', '', 'Tom Test', ''])
    expect(a.eventName).toBe('Hafenpokal 2026')
    // Der Stand der Veranstaltung bleibt unberührt: kein Plan, keine Starter.
    expect(s.parallelPlaene).toEqual({})
    expect(s.starters).toEqual([])
  })

  it('ohne Parallelslalom im Regelwerk (DM) keine Listen; ohne Muster-Zeilen ein leeres Blatt je Liste', () => {
    expect(musterRundenBoegen(emptyState(), configFor({ regelwerk: 'dm-2026' }), wahl).boegen).toEqual([])
    const leer = musterRundenBoegen(stand(), configFor({ regelwerk: 'uim-2026' }), { ...wahl, anzahl: 0 })
    expect(leer.boegen).toHaveLength(6)
    expect(leer.boegen.every((b) => b.auftrag.zeilen.length === 0)).toBe(true)
  })
})
