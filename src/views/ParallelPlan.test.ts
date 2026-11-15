import { beforeEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import ParallelView from './ParallelView.vue'
import VerzahnungView from './VerzahnungView.vue'
import { createStore, storeKey, type Store } from '../state/store'
import { emptyState, reducer } from '../state/reducer'
import { migrate } from '../state/migrate'
import { makeFile, parseFile } from '../persistenz/backup'
import { vorlaufGebunden, vorlaufPlan } from '../planung/parallelRunden'
import { beschreibe } from '../lib/verlauf'
import { setLocale, tIn } from '../i18n'
import type { AppState, ClassId, Starter } from '../types'

// Erfundene Starter – keine echten Personen.
function mk(klasse: ClassId, n: number, ab = 1): Starter[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `${klasse}-${i + ab}`,
    startNr: klasse + String(i + ab).padStart(2, '0'),
    vorname: 'Vor',
    nachname: `Nach${klasse}${i + ab}`,
    verein: 'Club',
    bundesland: '',
    geburtsdatum: '2015-01-01',
    groesse: '',
    klasse,
  }))
}

const FELD = () => [...mk('E', 3), ...mk('1', 3), ...mk('4', 2)]
const uim = (): AppState => reducer(reducer(emptyState(), { type: 'SET_REGELWERK', regelwerk: 'uim-2026' }), { type: 'ADD_STARTERS', starters: FELD() })
const sperren = (state: AppState, locked = true) => reducer(state, { type: 'SET_VERZAHNUNG_LOCK', locked })
const AT = '2026-11-15T10:00:00.000Z'

describe('Zustand: strenge Klassentrennung und festgeschriebener Plan', () => {
  it('Vorgabe ist streng (Regel 960 Pkt. 4.4), der Schalter stellt um; bei festgeschriebener Verzahnung ist er gesperrt', () => {
    expect(emptyState().parallelStreng).toBe(true)
    expect(emptyState().parallelPlaene).toEqual({})
    const aus = reducer(uim(), { type: 'SET_PARALLEL_STRENG', value: false })
    expect(aus.parallelStreng).toBe(false)
    const state = uim()
    expect(reducer(state, { type: 'SET_PARALLEL_STRENG', value: true })).toBe(state)
    const fest = sperren(state)
    expect(reducer(fest, { type: 'SET_PARALLEL_STRENG', value: false })).toBe(fest)
    expect(beschreibe({ type: 'SET_PARALLEL_STRENG', value: false }, state)).toEqual({ art: 'einstellung' })
  })

  it('„Verzahnung festschreiben“ friert den Vorlauf ein; Nachmeldungen und neue Nummern rechnen ihn nicht neu', () => {
    const fest = sperren(uim())
    const plan = fest.parallelPlaene.pre
    // E: 3 Starter (ein Dummy), 1: 3 Starter (ein Dummy), 4: ein Paar → 5 Paare, 10 Starts.
    expect(plan?.starts).toHaveLength(10)
    expect(plan?.starts.filter((s) => s.attempt === 1 && (s.a === null || s.b === null))).toHaveLength(2)
    let state = reducer(fest, { type: 'ADD_STARTERS', starters: mk('E', 1, 4) })
    state = reducer(state, { type: 'SET_START_NR_MODE', mode: 'klassisch' })
    state = reducer(state, { type: 'SET_RUNNING_NUMBERS', patch: { source: 'parallel' } })
    state = reducer(state, { type: 'ASSIGN_START_NUMBERS' })
    expect(state.parallelPlaene.pre).toEqual(plan)
  })

  it('Lösen wirft den Plan weg; erneutes Festschreiben nimmt den Nachgemeldeten auf', () => {
    let state = reducer(sperren(uim()), { type: 'ADD_STARTERS', starters: mk('E', 1, 4) })
    state = sperren(state, false)
    expect(state.parallelPlaene).toEqual({})
    state = sperren(state)
    expect(state.parallelPlaene.pre?.starts.some((s) => s.a === 'E-4' || s.b === 'E-4')).toBe(true)
    // Dolphin ist jetzt gerade: nur noch der Dummy der Klasse 1.
    expect(state.parallelPlaene.pre?.starts.filter((s) => s.attempt === 1 && (s.a === null || s.b === null))).toHaveLength(1)
  })

  it('gebundener Plan bei offener Verzahnung: Er entfällt nur über „Werte löschen“ – neues Festschreiben rechnet neu', () => {
    const wert = (w: string) => ({ type: 'SET_EINGABEN' as const, zellen: [{ lauf: 'parallel:pre/1', starter: 'E-1', feld: 'zeit1', wert: w }] })
    const fest = reducer(sperren(uim()), wert('1:00,00'))
    // Freigeben: Der Plan bleibt, weil Werte an ihm hängen.
    const offen = sperren(fest, false)
    expect(offen.parallelPlaene).toEqual(fest.parallelPlaene)
    // Bei gesetzter Sperre ändert das Löschen der Werte nichts am Plan.
    expect(reducer(fest, { type: 'CLEAR_EINGABEN' }).parallelPlaene).toEqual(fest.parallelPlaene)
    expect(reducer(fest, wert('')).parallelPlaene).toEqual(fest.parallelPlaene)
    // Offen: Das Leeren des letzten Felds löst die Bindung NICHT (Entscheidung des Nutzers) – nur „Werte löschen“.
    const geleert = reducer(offen, wert(''))
    expect(geleert.eingaben).toEqual({})
    expect(geleert.parallelPlaene).toEqual(fest.parallelPlaene)
    expect(vorlaufGebunden(geleert)).toBe(true)
    expect(reducer(geleert, { type: 'CLEAR_EINGABEN' }).parallelPlaene).toEqual({})
    let state = reducer(offen, { type: 'CLEAR_EINGABEN' })
    expect(state).toMatchObject({ verzahnungLocked: false, parallelPlaene: {} })
    // Andere Starter, neu festschreiben: Der Plan kennt sie alle.
    state = reducer(reducer(state, { type: 'CLEAR_ALL_STARTERS' }), { type: 'ADD_STARTERS', starters: mk('2', 4) })
    state = sperren(state)
    const plan = vorlaufPlan(state)
    expect(plan.ohnePlatz).toEqual([])
    expect(plan.fehlend).toEqual([])
    expect(state.parallelPlaene.pre?.starts).toHaveLength(4)
    // Ein Wert des Manövrierens bindet den Plan nicht und hält ihn nicht.
    const manoever = reducer(sperren(uim()), { type: 'SET_EINGABEN', zellen: [{ lauf: 'manoevrieren/1', starter: 'E-1', feld: 'zeit1', wert: '50,00' }] })
    expect(sperren(manoever, false).parallelPlaene).toEqual({})
  })

  it('nur unter einem Regelwerk mit Parallelslalom: Unter der DM entsteht kein Plan – erst mit dem Wechsel zu UIM', () => {
    const dm = sperren(reducer(emptyState(), { type: 'ADD_STARTERS', starters: FELD() }))
    expect(dm.regelwerk).toBe('dm-2026')
    expect(dm.parallelPlaene).toEqual({})
    const gewechselt = reducer(dm, { type: 'SET_REGELWERK', regelwerk: 'uim-2026' })
    expect(gewechselt.parallelPlaene.pre?.starts).toHaveLength(10)
    // Zurück zur DM bleibt er im Stand, ohne Wirkung – und unter UIM derselbe.
    const zurueck = reducer(gewechselt, { type: 'SET_REGELWERK', regelwerk: 'dm-2026' })
    expect(reducer(zurueck, { type: 'SET_REGELWERK', regelwerk: 'uim-2026' }).parallelPlaene).toEqual(gewechselt.parallelPlaene)
  })

  it('klassische Nummern bei festgeschriebener Verzahnung: erneutes Vergeben ändert nichts', () => {
    let state = reducer(uim(), { type: 'SET_START_NR_MODE', mode: 'klassisch' })
    state = reducer(state, { type: 'SET_RUNNING_NUMBERS', patch: { source: 'parallel' } })
    state = reducer(state, { type: 'ASSIGN_START_NUMBERS' })
    const nummern = (s: AppState) => s.starters.map((p) => `${p.id}=${p.startNr}`)
    const fest = sperren(state)
    expect(nummern(reducer(fest, { type: 'ASSIGN_START_NUMBERS' }))).toEqual(nummern(state))
    // Die Nummern laufen in der Reihenfolge des Plans: Block 1 ist Dolphin-Paar, dann Klasse 4.
    expect(nummern(state).slice(0, 2)).toEqual(['E-1=1', 'E-2=2'])
    expect(state.starters.find((p) => p.id === '4-1')?.startNr).toBe('3')
  })

  it('klassische Nummern bei festem Plan: Ein Nachgemeldeter bekommt die nächste Nummer, ein Entfernter hinterlässt eine Lücke', () => {
    let state = reducer(uim(), { type: 'SET_START_NR_MODE', mode: 'klassisch' })
    state = reducer(state, { type: 'SET_RUNNING_NUMBERS', patch: { source: 'parallel' } })
    state = sperren(reducer(state, { type: 'ASSIGN_START_NUMBERS' }))
    const nummern = (s: AppState) => Object.fromEntries(s.starters.map((p) => [p.id, p.startNr]))
    const vorher = nummern(state)
    // Acht Starter tragen 1 bis 8.
    expect(Object.values(vorher).map(Number).sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5, 6, 7, 8])

    // Nachmeldung mit eigener Nummer: Beim Neuvergeben verliert er sie nicht ersatzlos, sondern steht hinten.
    state = reducer(state, { type: 'ADD_STARTERS', starters: mk('E', 1, 4).map((p) => ({ ...p, startNr: '99' })) })
    state = reducer(state, { type: 'ASSIGN_START_NUMBERS' })
    expect(nummern(state)).toEqual({ ...vorher, 'E-4': '9' })

    // Ein Starter aus dem Plan entfällt: Seine Nummer bleibt frei, niemand rückt auf.
    const weg = state.starters.find((p) => p.startNr === '2')!.id
    state = reducer(reducer(state, { type: 'REMOVE_STARTER', id: weg }), { type: 'ASSIGN_START_NUMBERS' })
    expect(nummern(state)).toEqual(Object.fromEntries(Object.entries({ ...vorher, 'E-4': '9' }).filter(([id]) => id !== weg)))
  })
})

describe('Migration, Sicherung und Vorlage', () => {
  it('ältere Stände: streng als Vorgabe, kein Plan ohne Sperre; ein festgeschriebener UIM-Stand bekommt seinen Plan einmal', () => {
    const { parallelStreng: _s, parallelPlaene: _p, ...alt } = uim()
    const offen = migrate(alt)!
    expect(offen.parallelStreng).toBe(true)
    expect(offen.parallelPlaene).toEqual({})
    const fest = migrate({ ...alt, verzahnungLocked: true })!
    expect(fest.parallelPlaene.pre?.starts).toHaveLength(10)
    // Danach wird nicht neu gerechnet: Der geladene Plan gilt, auch wenn die Optionen anders stehen.
    const wieder = migrate({ ...fest, parallelStreng: false })!
    expect(wieder.parallelPlaene).toEqual(fest.parallelPlaene)
    expect(wieder.parallelStreng).toBe(false)
    // Unter der DM entsteht keiner.
    expect(migrate({ ...alt, regelwerk: 'dm-2026', verzahnungLocked: true })!.parallelPlaene).toEqual({})
  })

  it('ein unbrauchbarer Plan entfällt; ein Plan bei freigegebener Verzahnung bleibt beim Laden (er entfällt nur über „Werte löschen“)', () => {
    const fest = sperren(uim())
    expect(migrate({ ...fest, verzahnungLocked: false })!.parallelPlaene).toEqual(fest.parallelPlaene)
    // Ohne Sperre und ohne Plan entsteht keiner.
    expect(migrate({ ...fest, verzahnungLocked: false, parallelPlaene: {} })!.parallelPlaene).toEqual({})
    const kaputt = migrate({ ...fest, parallelPlaene: { pre: { starts: [{ a: 1 }] } } })!
    // Festgeschrieben und ohne brauchbaren Plan: Er wird aus dem Starterfeld neu festgeschrieben.
    expect(kaputt.parallelPlaene).toEqual(fest.parallelPlaene)
  })

  it('die Sicherung trägt Plan und Schalter; die Vorlage nur den Schalter – der Plan hängt an den Startern', () => {
    const fest = { ...sperren(reducer(uim(), { type: 'SET_PARALLEL_STRENG', value: false })) }
    const sicherung = parseFile(JSON.stringify(makeFile('sicherung', fest, AT)))
    expect(sicherung.ok && sicherung.kind === 'sicherung' && sicherung.state.parallelPlaene).toEqual(fest.parallelPlaene)
    expect(sicherung.ok && sicherung.kind === 'sicherung' && sicherung.state.parallelStreng).toBe(false)

    const datei = makeFile('vorlage', fest, AT)
    expect(datei.kind === 'vorlage' && 'parallelPlaene' in datei.settings).toBe(false)
    expect(datei.kind === 'vorlage' && datei.settings.parallelStreng).toBe(false)
    const text = JSON.stringify(datei)
    expect(text).not.toContain('E-1')
    expect(text).not.toContain('NachE1')
  })

  it('eine Vorlage anwenden: Ein fester Plan bleibt, wenn auch die Vorlage festschreibt; sonst entfällt er oder entsteht aus den hiesigen Startern', () => {
    const hier = sperren(uim())
    const gesperrt = parseFile(JSON.stringify(makeFile('vorlage', { ...hier, parallelStreng: false }, AT)))
    const offen = parseFile(JSON.stringify(makeFile('vorlage', uim(), AT)))
    if (!gesperrt.ok || gesperrt.kind !== 'vorlage' || !offen.ok || offen.kind !== 'vorlage') throw new Error('keine Vorlage')
    expect(gesperrt.apply(hier).parallelPlaene).toEqual(hier.parallelPlaene)
    expect(offen.apply(hier).parallelPlaene).toEqual({})
    // Offener Stand, festschreibende Vorlage: Der Plan entsteht aus den hiesigen Startern, mit den Optionen der Vorlage.
    // Bleibt der hiesige Plan, bleiben auch die Schalter, nach denen er gerechnet wurde – wie im
    // Reducer, der sie bei gesetzter Sperre sperrt. Sonst stünde „streng“ aus über einem strengen Plan.
    const geblieben = gesperrt.apply(hier)
    expect(geblieben.parallelStreng).toBe(true)
    const andere = parseFile(JSON.stringify(makeFile('vorlage', { ...hier, parallelStreng: false, class4Small: true, parallelOrderByStartNr: true }, AT)))
    if (!andere.ok || andere.kind !== 'vorlage') throw new Error('keine Vorlage')
    const danach = andere.apply(hier)
    expect(danach).toMatchObject({ verzahnungLocked: true, parallelStreng: true, class4Small: false, parallelOrderByStartNr: false })
    expect(danach.parallelPlaene).toEqual(hier.parallelPlaene)
    expect(vorlaufPlan(danach).falschesBoot).toEqual([])
    // Löst die Vorlage die Sperre, gelten ihre Schalter.
    const loesend = parseFile(JSON.stringify(makeFile('vorlage', { ...uim(), parallelStreng: false, class4Small: true }, AT)))
    if (!loesend.ok || loesend.kind !== 'vorlage') throw new Error('keine Vorlage')
    expect(loesend.apply(hier)).toMatchObject({ verzahnungLocked: false, parallelStreng: false, class4Small: true, parallelPlaene: {} })
    // Hängen Werte am hiesigen Plan, bleibt er auch ohne Sperre der Vorlage – und mit ihm die Schalter.
    const gebunden = reducer(hier, { type: 'SET_EINGABEN', zellen: [{ lauf: 'parallel:pre/1', starter: 'E-1', feld: 'zeit1', wert: '1:00,00' }] })
    const gehalten = loesend.apply(gebunden)
    expect(gehalten).toMatchObject({ verzahnungLocked: false, parallelStreng: true, class4Small: false })
    expect(gehalten.parallelPlaene).toEqual(gebunden.parallelPlaene)
    expect(vorlaufPlan(gehalten).falschesBoot).toEqual([])
    const neu = gesperrt.apply(uim())
    expect(neu.verzahnungLocked).toBe(true)
    // Nicht streng: E-3 fährt gegen 1-1, kein Dummy im geraden Pool.
    expect(neu.parallelPlaene.pre?.starts.some((s) => s.a === 'E-3' && s.b === '1-1')).toBe(true)
    expect(neu.parallelPlaene.pre?.starts.some((s) => s.a === null || s.b === null)).toBe(false)
  })
})

describe('Ansicht „Verzahnung → Parallel-Slalom“', () => {
  let store: Store
  const zeige = () => mount(ParallelView, { global: { provide: { [storeKey as symbol]: store } } })
  const zeilen = (w: ReturnType<typeof zeige>) => w.findAll('tbody tr').map((tr) => tr.findAll('td').map((td) => td.text().replace(/\s+/g, ' ')))

  beforeEach(() => {
    localStorage.clear()
    location.hash = ''
    setLocale('de')
    store = createStore()
    store.dispatch({ type: 'SET_REGELWERK', regelwerk: 'uim-2026' })
    store.dispatch({ type: 'ADD_STARTERS', starters: FELD() })
  })

  it('zeigt den Vorlauf nach Klassen: Dummy je ungerader Klasse, Attempt 1 vor Attempt 2 mit getauschten Parcours', async () => {
    const w = zeige()
    expect(w.find('[data-runde="pre"] h2').text()).toBe('Vorlauf')
    expect(w.find('[data-hinweis="plan-stand"]').text()).toBe(tIn('de', 'parallel.live'))
    const z = zeilen(w)
    expect(z).toHaveLength(10)
    // Block 1: Dolphin-Paar und das Paar der Klasse 4, dann beide getauscht.
    expect(z[0].slice(2)).toEqual(['1', expect.stringContaining('E01'), expect.stringContaining('E02')])
    expect(z[2].slice(2)).toEqual([expect.stringMatching(/^2/), expect.stringContaining('E02'), expect.stringContaining('E01')])
    expect(z[4][4]).toContain('Dummy')
    // Kleine Boote: Dolphin und Klasse 1 je ungerade – zwei Dummys (Mehrzahl); große: keiner.
    expect(w.findAll('.parallel-stats .pstat b').map((b) => b.text())).toEqual(['6 Starter + 2 Dummys', '2 Starter'])

    // Nicht streng: E03 gegen 101, kein Dummy mehr.
    await w.find('[data-option="parallel-streng"]').setValue(false)
    expect(store.state.value.parallelStreng).toBe(false)
    expect(w.find('tbody').text()).not.toContain('Dummy')
    expect(w.find('.parallel-stats').text()).not.toContain('Dummy')
    expect(zeilen(w)[4].slice(3).join(' ')).toMatch(/E03.*101/)
    w.unmount()
  })

  it('englisch heißen die Runde „Preliminary heat“ und die Spalten nach dem Regelbuch', () => {
    setLocale('en')
    const w = zeige()
    expect(w.find('[data-runde="pre"] h2').text()).toBe('Preliminary heat')
    expect(w.findAll('thead th').map((th) => th.text())).toEqual(['#', 'Boat', 'Attempt', 'Racecourse A', 'Racecourse B'])
    expect(tIn('en', 'parallel.round.semi')).toBe('Semi-finals')
    expect(tIn('en', 'parallel.round.final')).toBe('Finals')
    expect(tIn('en', 'parallel.round.rerun')).toBe('Re-run')
    w.unmount()
  })

  it('festgeschrieben: Der Plan steht, eine Nachmeldung wird gemeldet statt eingereiht', async () => {
    store.dispatch({ type: 'SET_VERZAHNUNG_LOCK', locked: true })
    const w = zeige()
    const vorher = zeilen(w)
    expect(w.find('[data-runde="pre"]').attributes('data-fest')).toBe('true')
    expect(w.find('[data-hinweis="plan-stand"]').text()).toBe(tIn('de', 'parallel.fixed'))
    expect(w.find('[data-warnung]').exists()).toBe(false)

    store.dispatch({ type: 'ADD_STARTERS', starters: mk('E', 1, 4) })
    await nextTick()
    expect(zeilen(w)).toEqual(vorher)
    expect(w.find('[data-warnung="ohne-platz"]').text()).toContain('NachE4')

    store.dispatch({ type: 'REMOVE_STARTER', id: '1-1' })
    await nextTick()
    expect(w.find('[data-warnung="fehlend"]').text()).toContain('1 Starter')
    expect(zeilen(w)).toHaveLength(10)
    w.unmount()
  })

  it('festgeschrieben: Fehlen beide Starter eines Paares, entfällt der Start an seiner Position; ohne jeden Starter steht der Leertext', async () => {
    store.dispatch({ type: 'SET_VERZAHNUNG_LOCK', locked: true })
    const w = zeige()
    const vorher = zeilen(w)
    // Das Paar der Klasse 4 fährt die Starts 2 und 4.
    store.dispatch({ type: 'REMOVE_STARTER', id: '4-1' })
    store.dispatch({ type: 'REMOVE_STARTER', id: '4-2' })
    await nextTick()
    const z = zeilen(w)
    expect(z).toHaveLength(10)
    expect(z[1].slice(3)).toEqual([tIn('de', 'parallel.cancelled')])
    expect(z[3].slice(3)).toEqual([tIn('de', 'parallel.cancelled')])
    expect(w.findAll('[data-start="entfaellt"]')).toHaveLength(2)
    // Die übrigen Starts stehen, wo sie standen; ein entfallener Start braucht keinen Dummy.
    expect(z.filter((_, i) => i !== 1 && i !== 3)).toEqual(vorher.filter((_, i) => i !== 1 && i !== 3))
    expect(w.findAll('.parallel-stats .pstat b').map((b) => b.text())).toEqual(['6 Starter + 2 Dummys', '0 Starter'])

    store.dispatch({ type: 'CLEAR_ALL_STARTERS' })
    await nextTick()
    expect(w.find('tbody').exists()).toBe(false)
    expect(w.find('.empty').text()).toBe(tIn('de', 'parallel.empty'))
    expect(w.find('[data-warnung="fehlend"]').exists()).toBe(true)
    w.unmount()
  })

  it('ein Dummy heißt englisch „dummy“, mehrere „dummies“', () => {
    setLocale('en')
    const w = zeige()
    expect(w.findAll('.parallel-stats .pstat b').map((b) => b.text())).toEqual(['6 drivers + 2 dummies', '2 drivers'])
    store.dispatch({ type: 'ADD_STARTERS', starters: mk('E', 1, 4) })
    return nextTick().then(() => {
      expect(w.findAll('.parallel-stats .pstat b')[0].text()).toBe('7 drivers + 1 dummy')
      w.unmount()
    })
  })

  it('unter der DM gibt es den Parallelslalom nicht: kein Unterpunkt, kein Plan beim Festschreiben', async () => {
    store.dispatch({ type: 'SET_REGELWERK', regelwerk: 'dm-2026' })
    const w = mount(VerzahnungView, { global: { provide: { [storeKey as symbol]: store } } })
    expect(w.find('.subnav').exists()).toBe(false)
    expect(w.find('[data-runde="pre"]').exists()).toBe(false)
    await w.find('.lock-bar .btn.primary').trigger('click')
    expect(store.state.value.verzahnungLocked).toBe(true)
    expect(store.state.value.parallelPlaene).toEqual({})
    expect(w.find('.lock-bar').text()).toContain(tIn('de', 'vz.lockedNote'))
    w.unmount()
  })
})
