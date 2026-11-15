import { describe, expect, it } from 'vitest'
import { configFor } from '../config/konfig'
import { regelwerkOf } from '../config/catalog'
import { pokalVorgabe } from '../config/pokal'
import { emptyState, reducer } from '../state/reducer'
import { feldVon, laufSchluessel } from './eingaben'
import { klassenErgebnis, wertungDer, type ErgebnisKonfig } from './ergebnis'
import { gesamtListenSchluessel, gesamtZeit, laufListenSchluessel, listenInhalte, standZeit, wertungZeit } from './listenStand'
import { attemptTabellen, PARALLEL_ANNAHMEN, qualifikation, rundenBlaetter, rundenEinheit, rundenErgebnis, rundenErgebnisse, vorlaufVermerke } from './parallelErgebnis'
import { attemptSchluessel } from './parallelSchluessel'
import type { AppState, ClassId, Starter } from '../types'

// Das Ergebnis des Vorlaufs (Regel 960, Pkt. 4.4, 5.2.2, 5.2.6). Alle Starter sind erfunden.

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

/** UIM mit festgeschriebenem Plan. */
function uim(starters: Starter[], fest = true): AppState {
  let state = reducer(emptyState(), { type: 'SET_REGELWERK', regelwerk: 'uim-2026' })
  state = reducer(state, { type: 'ADD_STARTERS', starters })
  return fest ? reducer(state, { type: 'SET_VERZAHNUNG_LOCK', locked: true }) : state
}
const konfig = configFor({ regelwerk: 'uim-2026' })
const dm = configFor({ regelwerk: 'dm-2026' })
const PUNKTE = pokalVorgabe('uim-2026').punkte.uim
const DISQ = feldVon(konfig, 'parallelparcours', '1', 'disq')!.kennung
const BOJE = feldVon(konfig, 'parallelparcours', '1', 'b1a')!.kennung

/** Je Starter die beiden Attempts in Sekunden; `null` = disqualifiziert (mit Zeit), `undefined` = nicht gefahren. */
function vorlauf(state: AppState, zeiten: Record<string, Array<number | null | undefined>>, zeit?: number): AppState {
  const zellen = Object.entries(zeiten).flatMap(([id, je]) =>
    je.flatMap((sek, i) => {
      if (sek === undefined) return []
      const lauf = attemptSchluessel('pre', i + 1)
      return [{ lauf, starter: id, feld: 'zeit1', wert: `${sek ?? 50},00` }, ...(sek === null ? [{ lauf, starter: id, feld: DISQ, wert: 'J' }] : [])]
    }),
  )
  return reducer(state, { type: 'SET_EINGABEN', zellen, zeit })
}
const pre = (state: AppState, klasse: ClassId = '1') => rundenErgebnis(state, konfig, klasse, 'pre')!
const plaetze = (state: AppState, klasse: ClassId = '1') => Object.fromEntries(pre(state, klasse).gesamt.nachPlatz.map((z) => [z.starter.id, z.platz]))
const sekunden = (state: AppState, klasse: ClassId = '1') => Object.fromEntries(pre(state, klasse).gesamt.nachNummer.map((z) => [z.starter.id, z.gesamt === null ? null : z.gesamt / 100]))

describe('Wertung je Disziplin im Regelwerk', () => {
  it('UIM: der Parallelslalom hat zwei Läufe ohne Streichlauf und den Stichentscheid „besserer Einzelversuch“', () => {
    const uimRegel = konfig.getRegelwerk()
    expect(wertungDer(uimRegel, 'parallel')).toEqual({ stichentscheid: ['besterLauf'], wertungslaeufe: { laeufe: 2, streichlaeufe: 0 } })
    expect(regelwerkOf('uim-2026').wertungJeDisziplin).toEqual({ parallel: { stichentscheid: ['besterLauf'], wertungslaeufe: { laeufe: 2, streichlaeufe: 0 } } })
    expect(rundenEinheit(konfig, 'pre')).toEqual({ disziplin: 'parallel', schluessel: 'parallel:pre', listen: ['zeit', 'steg', 'parallelparcours'], laeufe: 2, streichlaeufe: 0 })
  })

  it('das Manövrieren folgt weiter den allgemeinen Angaben – unter UIM und DM', () => {
    for (const k of [konfig, dm]) {
      const regel = k.getRegelwerk()
      expect(wertungDer(regel, 'manoevrieren')).toEqual({ stichentscheid: regel.stichentscheid, wertungslaeufe: regel.wertungslaeufe })
    }
    expect(wertungDer(konfig.getRegelwerk(), 'manoevrieren').stichentscheid).toEqual(['summeAllerLaeufe'])
    expect(dm.getRegelwerk().wertungJeDisziplin).toEqual({})
    // Die DM kennt keinen Parallelslalom: keine Einheit, keine Liste.
    expect(rundenEinheit(dm, 'pre')).toBeUndefined()
    // Eine Disziplin ohne Eintrag folgt der allgemeinen Angabe; „constructor“ trifft nicht das Objekt-Urbild.
    expect(wertungDer(konfig.getRegelwerk(), 'constructor').stichentscheid).toEqual(['summeAllerLaeufe'])
    expect(wertungDer(undefined, 'parallel')).toEqual({ stichentscheid: [], wertungslaeufe: undefined })
  })

  it('Regression: Die Wertung des Manövrierens ist dieselbe wie ohne die Angabe je Disziplin', () => {
    for (const regelwerk of ['dm-2026', 'uim-2026']) {
      const k = configFor({ regelwerk })
      // Dieselbe Konfiguration, aber mit dem Regelwerk, wie es vor der Angabe je Disziplin aussah.
      const { wertungJeDisziplin: _weg, ...alt } = k.getRegelwerk()
      const ohne: ErgebnisKonfig = { ...k, getRegelwerk: () => alt }
      let state = reducer(reducer(emptyState(), { type: 'SET_REGELWERK', regelwerk }), { type: 'ADD_STARTERS', starters: mk('4', 5) })
      const zeiten: Record<string, number[]> = { '4-1': [80, 75, 90], '4-2': [75, 82, 70], '4-3': [81, 74, 91], '4-4': [70, 99, 99], '4-5': [75, 80, 71] }
      const zellen = Object.entries(zeiten).flatMap(([id, je]) => je.slice(0, state.laufCount).map((sek, i) => ({ lauf: laufSchluessel('manoevrieren', i + 1), starter: id, feld: 'zeit1', wert: `${sek},00` })))
      state = reducer(state, { type: 'SET_EINGABEN', zellen: [...zellen, { lauf: laufSchluessel('manoevrieren', 1), starter: '4-4', feld: feldVon(k, 'parcours', '4', 'disq')!.kennung, wert: 'J' }] })
      const neu = klassenErgebnis(state, k, '4')
      expect(neu).not.toBeNull()
      expect(JSON.stringify(neu)).toBe(JSON.stringify(klassenErgebnis(state, ohne, '4')))
      // Die Daten enthalten einen Gleichstand, den der Stichentscheid des Regelwerks trennt.
      expect(neu!.gesamt.nachPlatz.some((z) => z.stich)).toBe(true)
    }
  })
})

describe('Vorlauf: Summe, Stichentscheid, Disqualifikation', () => {
  it('ohne festgeschriebenen Plan, ohne Eingaben und unter der DM gibt es kein Ergebnis', () => {
    expect(rundenErgebnis(vorlauf(uim(mk('1', 4), false), { '1-1': [40, 41] }), konfig, '1', 'pre')).toBeNull()
    expect(rundenErgebnis(uim(mk('1', 4)), konfig, '1', 'pre')).toBeNull()
    expect(rundenErgebnis(vorlauf(uim(mk('1', 4)), { '1-1': [40, 41] }), dm, '1', 'pre')).toBeNull()
    // Werte einer anderen Klasse machen noch keine Liste dieser Klasse.
    const state = vorlauf(uim([...mk('1', 2), ...mk('2', 2)]), { '2-1': [40, 41] })
    expect(rundenErgebnis(state, konfig, '1', 'pre')).toBeNull()
    expect(rundenErgebnisse(state, konfig, ['1', '2'], 'pre').map((e) => e.klasse)).toEqual(['2'])
  })

  it('es zählt die Summe beider Attempts mit ihren Strafsekunden (Pkt. 4.4)', () => {
    let state = vorlauf(uim(mk('1', 4)), { '1-1': [40, 42], '1-2': [41, 40], '1-3': [39, 45], '1-4': [50, 50] })
    state = reducer(state, { type: 'SET_EINGABEN', zellen: [{ lauf: attemptSchluessel('pre', 2), starter: '1-2', feld: BOJE, wert: '1' }] })
    const strafe = pre(state).laeufe[1].nachNummer.find((z) => z.starter.id === '1-2')!.strafpunkte
    expect(strafe).toBeGreaterThan(0)
    expect(sekunden(state)).toEqual({ '1-1': 82, '1-2': 81 + strafe, '1-3': 84, '1-4': 100 })
    expect(pre(state).gesamt.laeufe).toEqual([1, 2])
    expect(pre(state).gesamt.streichen).toBe(0)
    expect(pre(state).gesamt.mitKnoten).toBe(false)
    expect(pre(state).gesamt.nachPlatz.every((z) => z.gestrichen.length === 0)).toBe(true)
  })

  it('gleiche Summe: Der bessere Einzelversuch steht vorn (Pkt. 5.2.6); trennt auch er nichts, wird der Platz geteilt', () => {
    const state = vorlauf(uim(mk('1', 4)), { '1-1': [40, 44], '1-2': [42, 42], '1-3': [44, 40], '1-4': [30, 30] })
    // 1-1 und 1-3: Summe 84, bester Versuch 40 – geteilt. 1-2: Summe 84, bester Versuch 42 – dahinter.
    expect(plaetze(state)).toEqual({ '1-4': 1, '1-1': 2, '1-3': 2, '1-2': 4 })
    const stich = Object.fromEntries(pre(state).gesamt.nachPlatz.map((z) => [z.starter.id, z.stich]))
    expect(stich).toEqual({ '1-4': false, '1-1': true, '1-3': true, '1-2': true })
  })

  it('ein disqualifizierter Attempt disqualifiziert für die ganze Runde (Pkt. 5.2.2) – gemeinsamer letzter Platz', () => {
    const state = vorlauf(uim(mk('1', 5)), { '1-1': [40, 41], '1-2': [null, 30], '1-3': [39, 45], '1-4': [30, null], '1-5': [45, 45] })
    const e = pre(state)
    expect(plaetze(state)).toEqual({ '1-1': 1, '1-3': 2, '1-5': 3, '1-2': 4, '1-4': 4 })
    const zeile = (id: string) => e.gesamt.nachNummer.find((z) => z.starter.id === id)!
    expect(zeile('1-2')).toMatchObject({ disq: true, offen: false, ergebnis: null, gesamt: null })
    // Der gültige Attempt steht in der Liste, zählt aber nicht.
    expect(zeile('1-2').laeufe.map((l) => l.gesamt)).toEqual([null, 3000])
    expect(e.vollstaendig).toBe(true)
    expect([...e.qualifiziert].sort()).toEqual(['1-1', '1-3', '1-5'])
    expect(vorlaufVermerke(e, PUNKTE)!.get('1-2')).toEqual({ art: 'punkte', punkte: 0 })
  })

  it('X „Nicht gestartet“ zählt wie eine Disqualifikation', () => {
    let state = vorlauf(uim(mk('1', 2)), { '1-1': [40, 41] })
    state = reducer(state, { type: 'SET_EINGABEN', zellen: [1, 2].map((n) => ({ lauf: attemptSchluessel('pre', n), starter: '1-2', feld: DISQ, wert: 'X' })) })
    expect(plaetze(state)).toEqual({ '1-1': 1, '1-2': 2 })
    expect(pre(state).gesamt.nachPlatz[1]).toMatchObject({ disq: true })
    expect(pre(state).vollstaendig).toBe(true)
  })

  it('wer erst einen Attempt gefahren ist, ist offen: Platz 1 ohne Ergebnis, kein „Qualified“, keine Punkte', () => {
    const state = vorlauf(uim(mk('1', 6)), { '1-1': [40, 41], '1-2': [30], '1-3': [39, 45], '1-4': [35, 35], '1-5': [50, 50], '1-6': [60, 60] })
    const e = pre(state)
    expect(e.laeufe.map((l) => l.lauf)).toEqual([1, 2])
    expect(plaetze(state)).toEqual({ '1-2': 1, '1-4': 2, '1-1': 3, '1-3': 4, '1-5': 5, '1-6': 6 })
    expect(e.gesamt.nachPlatz[0]).toMatchObject({ offen: true, disq: false, gesamt: null })
    expect(e).toMatchObject({ vollstaendig: false, entschieden: false, rerun: [] })
    expect(e.qualifiziert.size).toBe(0)
    expect(vorlaufVermerke(e, PUNKTE)).toBeNull()
    // Auch wenn noch keiner den 2. Attempt gefahren ist: beide Attempts zählen von Anfang an.
    const nurErster = pre(vorlauf(uim(mk('1', 2)), { '1-1': [40], '1-2': [41] }))
    expect(nurErster.gesamt.laeufe).toEqual([1, 2])
    expect(nurErster.gesamt.nachPlatz.every((z) => z.offen && z.platz === 1)).toBe(true)
    expect(nurErster.vollstaendig).toBe(false)
  })

  it('gewertet wird nur, wer im festgeschriebenen Plan steht', () => {
    let state = vorlauf(uim(mk('1', 2)), { '1-1': [40, 41], '1-2': [42, 43] })
    // Nachgemeldet nach dem Festschreiben: kein Platz im Plan, keine Zeile.
    state = { ...state, starters: [...state.starters, { ...mk('1', 3)[2] }] }
    expect(pre(state).gesamt.nachNummer.map((z) => z.starter.id)).toEqual(['1-1', '1-2'])
    expect(pre(state).vollstaendig).toBe(true)
  })

  it('der Racecourse je Attempt kommt aus dem Plan: Im 2. Attempt ist es der andere', () => {
    const state = vorlauf(uim(mk('1', 4)), { '1-1': [40, 41] })
    const e = pre(state)
    for (const p of mk('1', 4)) {
      const rc = e.racecourse.get(p.id)!
      expect([rc[1], rc[2]].sort()).toEqual(['A', 'B'])
    }
  })
})

describe('Qualifikation und UIM points', () => {
  const feld = (n: number) => uim(mk('1', n))
  /** Starter 1 … n mit den Summen `summen` (je zur Hälfte auf beide Attempts, der zweite 1 s langsamer). */
  const mitSummen = (summen: number[]) => vorlauf(feld(summen.length), Object.fromEntries(summen.map((s, i) => [`1-${i + 1}`, [(s - 1) / 2, (s + 1) / 2]])))

  it('die besten vier sind „Qualified“; ab Platz 5 gelten die Punkte des Platzes (Pkt. 4.4, 5.1)', () => {
    const e = pre(mitSummen([81, 83, 85, 87, 89, 91, 93]))
    expect(e).toMatchObject({ vollstaendig: true, entschieden: true, rerun: [] })
    expect([...e.qualifiziert]).toEqual(['1-1', '1-2', '1-3', '1-4'])
    const vermerke = vorlaufVermerke(e, PUNKTE)!
    expect(['1-1', '1-2', '1-3', '1-4'].map((id) => vermerke.get(id))).toEqual(Array(4).fill({ art: 'qualified' }))
    expect(['1-5', '1-6', '1-7'].map((id) => vermerke.get(id))).toEqual([127, 95, 71].map((punkte) => ({ art: 'punkte', punkte })))
  })

  it('weniger als fünf Gewertete: alle Gewerteten sind „Qualified“', () => {
    const e = pre(vorlauf(feld(4), { '1-1': [40, 41], '1-2': [42, 43], '1-3': [44, null], '1-4': [46, 47] }))
    expect([...e.qualifiziert].sort()).toEqual(['1-1', '1-2', '1-4'])
    expect(e.entschieden).toBe(true)
  })

  it('Gleichstand an der Grenze 4/5 wird gemeldet und sperrt das Weiterkommen (Pkt. 5.2.6: Re-run)', () => {
    // 1-4 und 1-5: gleiche Summe UND gleicher bester Versuch – beide auf Platz 4.
    const e = pre(mitSummen([81, 83, 85, 87, 87, 91]))
    expect(Object.fromEntries(e.gesamt.nachPlatz.map((z) => [z.starter.id, z.platz]))).toEqual({ '1-1': 1, '1-2': 2, '1-3': 3, '1-4': 4, '1-5': 4, '1-6': 6 })
    expect(e).toMatchObject({ vollstaendig: true, entschieden: false, rerun: ['1-4', '1-5'] })
    // Die GANZE Klasse bleibt ohne „Qualified“, bis der Re-run gefahren ist – auch wer klar davor steht.
    expect([...e.qualifiziert]).toEqual([])
    const vermerke = vorlaufVermerke(e, PUNKTE)!
    expect(['1-1', '1-2', '1-3'].map((id) => vermerke.get(id))).toEqual([undefined, undefined, undefined])
    expect(vermerke.get('1-4')).toEqual({ art: 'rerun' })
    expect(vermerke.get('1-5')).toEqual({ art: 'rerun' })
    // Wer dahinter steht, hat seine Punkte schon: Auch wer im Re-run disqualifiziert wird, bleibt in
    // der Gruppe (hinterer Platz, Entscheidung des Nutzers, PARALLEL_ANNAHMEN.disqInWiederholungDesVorlaufs).
    expect(PARALLEL_ANNAHMEN.disqInWiederholungDesVorlaufs).toBe('heat')
    expect(vermerke.get('1-6')).toEqual({ art: 'punkte', punkte: 95 })
  })

  it('ein geteilter Platz, der über die Grenze reicht (3, 3, 3), sperrt ebenso', () => {
    const e = pre(mitSummen([81, 83, 85, 85, 85, 91]))
    expect(e.rerun).toEqual(['1-3', '1-4', '1-5'])
    expect([...e.qualifiziert]).toEqual([])
    expect(e.entschieden).toBe(false)
  })

  it('gleiche Summe an der Grenze, die der bessere Einzelversuch trennt, sperrt nicht', () => {
    const e = pre(vorlauf(feld(5), { '1-1': [40, 41], '1-2': [41, 42], '1-3': [42, 43], '1-4': [43, 47], '1-5': [45, 45] }))
    expect(Object.fromEntries(e.gesamt.nachPlatz.map((z) => [z.starter.id, z.platz]))).toEqual({ '1-1': 1, '1-2': 2, '1-3': 3, '1-4': 4, '1-5': 5 })
    expect(e).toMatchObject({ entschieden: true, rerun: [] })
    expect(vorlaufVermerke(e, PUNKTE)!.get('1-5')).toEqual({ art: 'punkte', punkte: 127 })
  })

  it('ein geteilter Platz vor oder hinter der Grenze braucht keine Entscheidung; hinten bekommen beide die Punkte des Platzes', () => {
    const vorn = pre(mitSummen([81, 81, 85, 87, 89]))
    expect(vorn).toMatchObject({ entschieden: true, rerun: [] })
    expect([...vorn.qualifiziert]).toEqual(['1-1', '1-2', '1-3', '1-4'])
    const hinten = pre(mitSummen([81, 83, 85, 87, 89, 89, 93]))
    expect(hinten.entschieden).toBe(true)
    const vermerke = vorlaufVermerke(hinten, PUNKTE)!
    expect(['1-5', '1-6', '1-7'].map((id) => vermerke.get(id))).toEqual([127, 127, 71].map((punkte) => ({ art: 'punkte', punkte })))
  })

  it('qualifikation: eine andere Zahl von Plätzen', () => {
    const e = pre(mitSummen([81, 83, 85]))
    expect([...qualifikation(e.gesamt, 2).qualifiziert]).toEqual(['1-1', '1-2'])
  })
})

describe('Listen des Vorlaufs', () => {
  const state = vorlauf(uim([...mk('1', 5), ...mk('2', 2)]), {
    '1-1': [40, 41],
    '1-2': [42, 39],
    '1-3': [44, null],
    '1-4': [46, 47],
    '1-5': [38, 50],
    '2-1': [40, 41],
    '2-2': [42, 43],
  })
  const alle = rundenErgebnisse(state, konfig, ['1', '2'], 'pre')

  it('rundenBlaetter: je Klasse erst die Attempts, dann das Result; „beide“ = nach Startnummer, dann nach Platz', () => {
    expect(rundenBlaetter(alle, { umfang: 'alles', ordnung: 'platz' }).map((b) => b.key)).toEqual([
      'parallel:pre/1/attempts/platz',
      'parallel:pre/1/result/platz',
      'parallel:pre/2/attempts/platz',
      'parallel:pre/2/result/platz',
    ])
    expect(rundenBlaetter(alle, { umfang: 'result', ordnung: 'beide', klassen: ['2'] }).map((b) => b.key)).toEqual(['parallel:pre/2/result/nummer', 'parallel:pre/2/result/platz'])
    expect(rundenBlaetter(alle, { umfang: 'attempts', ordnung: 'nummer' }).map((b) => `${b.art}/${b.ordnung}`)).toEqual(['attempts/nummer', 'attempts/nummer'])
  })

  it('nach Attempt: zwei Tabellen mit allen Startern und ihrem Racecourse', () => {
    const tabellen = attemptTabellen(alle[0], 'attempt', 'nummer')
    expect(tabellen.map((t) => t.titel)).toEqual([{ art: 'attempt', attempt: 1 }, { art: 'attempt', attempt: 2 }])
    expect(tabellen.map((t) => t.zeilen.map((z) => z.zeile.starter.id))).toEqual([['1-1', '1-2', '1-3', '1-4', '1-5'], ['1-1', '1-2', '1-3', '1-4', '1-5']])
    expect(tabellen[0].zeilen.every((z) => z.racecourse === alle[0].racecourse.get(z.zeile.starter.id)![1])).toBe(true)
    // Nach Platz: die Reihenfolge der Liste des Attempts, der Disqualifizierte hinten.
    expect(attemptTabellen(alle[0], 'attempt', 'platz')[1].zeilen.map((z) => z.zeile.starter.id)).toEqual(['1-2', '1-1', '1-4', '1-5', '1-3'])
  })

  it('nach Racecourse: dieselben Fahrten, nur anders geteilt – die Umschaltung ändert keinen Wert', () => {
    for (const ordnung of ['platz', 'nummer'] as const) {
      const nachAttempt = attemptTabellen(alle[0], 'attempt', ordnung)
      const nachRacecourse = attemptTabellen(alle[0], 'racecourse', ordnung)
      expect(nachRacecourse.map((t) => t.titel)).toEqual([{ art: 'racecourse', racecourse: 'A' }, { art: 'racecourse', racecourse: 'B' }])
      const fahrten = (tabellen: typeof nachAttempt) =>
        tabellen
          .flatMap((t) => t.zeilen)
          .map((z) => JSON.stringify([z.zeile.starter.id, z.attempt, z.racecourse, z.zeile.zeit, z.zeile.strafpunkte, z.zeile.gesamt, z.zeile.disq, z.zeile.platz, z.zeile.zellen, z.zeile.schluessel]))
          .sort()
      expect(fahrten(nachRacecourse)).toEqual(fahrten(nachAttempt))
      expect(fahrten(nachRacecourse)).toHaveLength(10)
      // Jede Tabelle trägt nur Fahrten ihres Racecourse; jeder Starter steht auf jedem einmal.
      for (const t of nachRacecourse) {
        expect(t.zeilen.every((z) => t.titel.art === 'racecourse' && z.racecourse === t.titel.racecourse)).toBe(true)
        expect(t.zeilen.map((z) => z.zeile.starter.id).sort()).toEqual(['1-1', '1-2', '1-3', '1-4', '1-5'])
      }
      // Hin und zurück: dasselbe Ergebnis wie vorher.
      expect(JSON.stringify(attemptTabellen(alle[0], 'attempt', ordnung))).toBe(JSON.stringify(nachAttempt))
    }
    // „Nach Platz“ – in beiden Ansichten: die beste Zeit (mit Strafen) zuerst, Disqualifizierte am Ende.
    // Eine Spalte „Platz“ hat die Liste nicht; ein Platz im einzelnen Attempt entscheidet nichts.
    for (const ansicht of ['attempt', 'racecourse'] as const) {
      for (const t of attemptTabellen(alle[0], ansicht, 'platz')) {
        const stufe = t.zeilen.map((z) => (z.zeile.disq ? 1 : z.zeile.gesamt === null ? 2 : 0))
        expect(stufe).toEqual([...stufe].sort())
        const zeiten = t.zeilen.filter((z) => !z.zeile.disq && z.zeile.gesamt !== null).map((z) => z.zeile.gesamt!)
        expect(zeiten).toEqual([...zeiten].sort((a, b) => a - b))
        expect(zeiten.length).toBeGreaterThan(1)
      }
    }
    // Nach Startnummer: jeder Starter einmal, in der Reihenfolge der Nummern.
    expect(attemptTabellen(alle[0], 'racecourse', 'nummer')[0].zeilen.map((z) => z.zeile.starter.id)).toEqual(['1-1', '1-2', '1-3', '1-4', '1-5'])
  })
})

describe('Zeitstempel der Listen des Vorlaufs', () => {
  const attempt = (klasse: string, n: number) => laufListenSchluessel('parallel:pre', klasse, n)
  const result = (klasse: string) => gesamtListenSchluessel('parallel:pre', klasse)
  const zeiten = (s: AppState) => Object.fromEntries(Object.entries(s.listenStand).map(([k, v]) => [k, v.zeit]))

  it('eine Eingabe im Vorlauf stempelt die Listen der Klasse in der Runde – nicht die des Manövrierens', () => {
    let state = uim([...mk('1', 2), ...mk('2', 2)])
    state = reducer(state, { type: 'SET_EINGABEN', zellen: [{ lauf: laufSchluessel('manoevrieren', 1), starter: '1-1', feld: 'zeit1', wert: '80,00' }], zeit: 1000 })
    state = vorlauf(state, { '1-1': [40] }, 2000)
    expect(zeiten(state)).toEqual({
      [laufListenSchluessel('manoevrieren', '1', 1)]: 1000,
      [gesamtListenSchluessel('manoevrieren', '1')]: 1000,
      [attempt('1', 1)]: 2000,
      [attempt('1', 2)]: 2000,
      [result('1')]: 2000,
    })
    state = vorlauf(state, { '1-2': [undefined, 41] }, 3000)
    expect(zeiten(state)).toMatchObject({ [attempt('1', 1)]: 2000, [attempt('1', 2)]: 3000, [result('1')]: 3000 })
    // Die Liste der Attempts und das Result tragen den jüngsten Zeitpunkt der Klasse in der Runde.
    expect(gesamtZeit(state.listenStand, 'parallel:pre', '1')).toBe(new Date(3000).toISOString())
    expect(standZeit(state.listenStand, attempt('1', 1))).toBe(new Date(2000).toISOString())
    // Die Mannschaftswertung liest bisher nur das Manövrieren.
    expect(wertungZeit(state.listenStand, 'manoevrieren')).toBe(new Date(1000).toISOString())
    expect([...listenInhalte(state).keys()].sort()).toEqual(Object.keys(state.listenStand).sort())
  })

  it('der letzte Wert des Vorlaufs gelöscht: Es bleibt der Zeitpunkt des Wegfalls', () => {
    let state = vorlauf(uim(mk('1', 2)), { '1-1': [40] }, 2000)
    state = reducer(state, { type: 'SET_EINGABEN', zellen: [{ lauf: attemptSchluessel('pre', 1), starter: '1-1', feld: 'zeit1', wert: '' }], zeit: 5000 })
    expect(rundenErgebnis(state, konfig, '1', 'pre')).toBeNull()
    expect(state.listenStand).toEqual({ [result('1')]: { inhalt: 0, zeit: 5000 } })
  })
})
