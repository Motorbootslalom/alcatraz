import { beforeEach, describe, expect, it } from 'vitest'
import { emptyState, reducer, type Action } from '../state/reducer'
import { migrate } from '../state/migrate'
import { createStore } from '../state/store'
import { makeFile, parseFile } from '../persistenz/backup'
import { laufSchluessel } from './eingaben'
import { gesamtListenSchluessel, laufListenSchluessel, listenInhalte, standZeit } from './listenStand'
import type { AppState, ClassId, Starter } from '../types'

// Wann sich eine Ergebnisliste zuletzt geändert hat. Alle Starter sind erfunden.

const D = 'manoevrieren'
const L = (n: number) => laufSchluessel(D, n)
const lauf = (klasse: string, n: number) => laufListenSchluessel(D, klasse, n)
const gesamt = (klasse: string) => gesamtListenSchluessel(D, klasse)
const starter = (id: string, klasse: ClassId): Starter => ({ id, startNr: id.toUpperCase(), vorname: 'Test', nachname: id, verein: 'Club', bundesland: 'Land', geburtsdatum: '', klasse, groesse: '' })
const START: Starter[] = [starter('a', '4'), starter('b', '4'), starter('c', '1'), starter('d', '1')]
const anfang = (): AppState => reducer(emptyState(), { type: 'ADD_STARTERS', starters: START, zeit: 1 })
const zelle = (id: string, feld: string, wert: string, n = 1) => ({ lauf: L(n), starter: id, feld, wert })
const eingabe = (zeit: number | undefined, ...zellen: ReturnType<typeof zelle>[]): Action => ({ type: 'SET_EINGABEN', zellen, zeit })
const nach = (s: AppState, ...actions: Action[]) => actions.reduce(reducer, s)
const zeiten = (s: AppState) => Object.fromEntries(Object.entries(s.listenStand).map(([k, v]) => [k, v.zeit]))

describe('Stand der Ergebnislisten', () => {
  it('ohne Eingaben gibt es keine Liste und keinen Stand', () => {
    expect(anfang().listenStand).toEqual({})
    expect(listenInhalte(anfang()).size).toBe(0)
  })

  it('die erste Eingabe einer Klasse stempelt deren Lauf- und Gesamtliste mit dem Zeitpunkt der Action', () => {
    const s = nach(anfang(), eingabe(1000, zelle('a', 'zeit1', '80')))
    expect(zeiten(s)).toEqual({ [lauf('4', 1)]: 1000, [gesamt('4')]: 1000 })
    expect(standZeit(s.listenStand, lauf('4', 1))).toBe(new Date(1000).toISOString())
    expect(standZeit(s.listenStand, lauf('1', 1))).toBe('')
  })

  it('eine Eingabe betrifft nur ihre Liste: andere Klassen und andere Läufe behalten ihren Zeitpunkt', () => {
    const s = nach(
      anfang(),
      eingabe(1000, zelle('a', 'zeit1', '80')),
      eingabe(2000, zelle('c', 'zeit1', '70')),
      eingabe(3000, zelle('a', 'zeit1', '81', 2)),
    )
    expect(zeiten(s)).toEqual({
      [lauf('4', 1)]: 1000,
      [lauf('4', 2)]: 3000,
      // Die Gesamtliste zählt jeden Lauf ihrer Klasse mit.
      [gesamt('4')]: 3000,
      [lauf('1', 1)]: 2000,
      [gesamt('1')]: 2000,
    })
  })

  it('jeder Tastendruck, der den Inhalt ändert, zählt – derselbe Wert noch einmal nicht', () => {
    const s = nach(anfang(), eingabe(1000, zelle('a', 'zeit1', '8')), eingabe(2000, zelle('a', 'zeit1', '80')))
    expect(s.listenStand[lauf('4', 1)].zeit).toBe(2000)
    // Unveränderte Eingabe: derselbe Stand (der Reducer lässt alles stehen).
    expect(reducer(s, eingabe(9000, zelle('a', 'zeit1', '80')))).toBe(s)
  })

  it('auch das Löschen eines Werts zählt', () => {
    const s = nach(anfang(), eingabe(1000, zelle('a', 'zeit1', '80'), zelle('b', 'zeit1', '82')), eingabe(5000, zelle('b', 'zeit1', '')))
    expect(zeiten(s)).toEqual({ [lauf('4', 1)]: 5000, [gesamt('4')]: 5000 })
  })

  it('der letzte Wert gelöscht: Die Liste gibt es nicht mehr – und ihren Stand auch nicht', () => {
    const s = nach(anfang(), eingabe(1000, zelle('a', 'zeit1', '80')), eingabe(2000, zelle('c', 'zeit1', '70')), eingabe(5000, zelle('a', 'zeit1', '')))
    expect(Object.keys(s.listenStand).sort()).toEqual([lauf('1', 1), gesamt('1')].sort())
    // Kommt wieder ein Wert, beginnt sie neu.
    expect(nach(s, eingabe(6000, zelle('a', 'zeit1', '80'))).listenStand[lauf('4', 1)].zeit).toBe(6000)
  })

  it('CLEAR_EINGABEN leert auch den Stand', () => {
    const s = nach(anfang(), eingabe(1000, zelle('a', 'zeit1', '80')), { type: 'CLEAR_EINGABEN', zeit: 2000 })
    expect(s.listenStand).toEqual({})
  })

  it('ein Haken „erfasst“ ändert nichts am Ergebnis und damit nicht am Zeitpunkt', () => {
    const s = nach(anfang(), eingabe(1000, zelle('a', 'zeit1', '80')), eingabe(2000, zelle('b', 'erfasst@gate135', '1')))
    expect(s.eingaben[L(1)].b).toEqual({ 'erfasst@gate135': '1' })
    expect(zeiten(s)).toEqual({ [lauf('4', 1)]: 1000, [gesamt('4')]: 1000 })
  })

  it('Strafpunkte und Disqualifikation ändern die Liste, auch wenn die Zeit bleibt', () => {
    const s0 = nach(anfang(), eingabe(1000, zelle('a', 'zeit1', '80'), zelle('b', 'zeit1', '82')))
    const s1 = nach(s0, eingabe(2000, zelle('a', 't1a|hin seiteA', '5')))
    expect(s1.listenStand[lauf('4', 1)].zeit).toBe(2000)
    const s2 = nach(s1, eingabe(3000, zelle('b', 'disq@vorsteg', 'X')))
    expect(zeiten(s2)).toEqual({ [lauf('4', 1)]: 3000, [gesamt('4')]: 3000 })
  })

  it('Streichläufe ändern nur die Gesamtliste – und nur, wenn sich dort etwas ändert', () => {
    const drei = [1, 2, 3].flatMap((n) => [zelle('a', 'zeit1', String(80 + n), n), zelle('b', 'zeit1', String(90 - n), n)])
    const s = nach(anfang(), eingabe(1000, ...drei))
    const ohne = nach(s, { type: 'SET_STREICHLAEUFE', streichlaeufe: 0, zeit: 2000 })
    expect(zeiten(ohne)).toEqual({ [lauf('4', 1)]: 1000, [lauf('4', 2)]: 1000, [lauf('4', 3)]: 1000, [gesamt('4')]: 2000 })
    // „auto“ ist bei drei Läufen dasselbe wie 1: Nichts ändert sich.
    const eins = nach(s, { type: 'SET_STREICHLAEUFE', streichlaeufe: 1, zeit: 3000 })
    expect(zeiten(eins)).toEqual(zeiten(s))
    expect(eins.listenStand).toBe(s.listenStand)
  })

  it('die Zahl der Läufe: Ein Lauf, den es nicht mehr gibt, verliert seine Liste; die Gesamtliste ändert sich', () => {
    const s = nach(anfang(), eingabe(1000, zelle('a', 'zeit1', '80', 1), zelle('a', 'zeit1', '81', 3)))
    const zwei = nach(s, { type: 'SET_EVENT', patch: { laufCount: 2 }, zeit: 2000 })
    expect(zeiten(zwei)).toEqual({ [lauf('4', 1)]: 1000, [gesamt('4')]: 2000 })
  })

  it('ein entfernter Starter ändert die Listen seiner Klasse, nicht die der anderen', () => {
    const s = nach(anfang(), eingabe(1000, zelle('a', 'zeit1', '80'), zelle('c', 'zeit1', '70')))
    const ohne = nach(s, { type: 'REMOVE_STARTER', id: 'b', zeit: 2000 })
    expect(zeiten(ohne)).toEqual({ [lauf('4', 1)]: 2000, [gesamt('4')]: 2000, [lauf('1', 1)]: 1000, [gesamt('1')]: 1000 })
    // Der letzte Starter mit Werten geht: Die Listen der Klasse entfallen.
    expect(Object.keys(nach(ohne, { type: 'REMOVE_STARTER', id: 'a', zeit: 3000 }).listenStand).sort()).toEqual([lauf('1', 1), gesamt('1')].sort())
    expect(nach(s, { type: 'CLEAR_CLASS', klasse: '4', zeit: 3000 }).listenStand[lauf('4', 1)]).toBeUndefined()
  })

  it('ein neuer Starter, eine andere Startnummer, ein berichtigter Name: Die Liste sieht anders aus', () => {
    const s = nach(anfang(), eingabe(1000, zelle('a', 'zeit1', '80'), zelle('c', 'zeit1', '70')))
    expect(zeiten(nach(s, { type: 'ADD_STARTERS', starters: [starter('e', '4')], zeit: 2000 }))[lauf('4', 1)]).toBe(2000)
    expect(zeiten(nach(s, { type: 'UPDATE_STARTER', id: 'b', patch: { startNr: '499' }, zeit: 2000 }))[lauf('4', 1)]).toBe(2000)
    const name = nach(s, { type: 'UPDATE_STARTER', id: 'c', patch: { nachname: 'Berichtigt' }, zeit: 2000 })
    expect(zeiten(name)).toEqual({ [lauf('4', 1)]: 1000, [gesamt('4')]: 1000, [lauf('1', 1)]: 2000, [gesamt('1')]: 2000 })
  })

  it('was nicht auf der Liste steht oder nur die Darstellung betrifft, ändert nichts', () => {
    const s = nach(anfang(), eingabe(1000, zelle('a', 'zeit1', '80')))
    const danach = nach(
      s,
      { type: 'SET_WEIGHT', id: 'a', gewicht: 41, zeit: 2000 },
      { type: 'UPDATE_STARTER', id: 'a', patch: { groesse: 'M', geburtsdatum: '2012-01-01' }, zeit: 2000 },
      { type: 'SET_ERGEBNIS_LISTEN', fassung: 'aushang', patch: { namen: 'kurz', herkunft: 'lang' }, zeit: 2000 },
      { type: 'SET_ORIGIN_SHORT', name: 'Club', short: 'CL', zeit: 2000 },
      { type: 'SET_EVENT', patch: { eventName: 'Hafenpokal' }, zeit: 2000 },
      { type: 'SET_WKR_NAME', parcoursId: 'par_1', typeId: 'steg', name: 'A. Muster', zeit: 2000 },
      { type: 'RENAME_PARCOURS', id: 'par_1', name: 'Nord', zeit: 2000 },
    )
    expect(danach.listenStand).toBe(s.listenStand)
  })

  it('ein anderer Aufbau ändert die Liste genau dann, wenn sie danach anders aussieht', () => {
    const s = nach(anfang(), eingabe(1000, zelle('a', 'zeit1', '80'), zelle('a', 't1a|hin seiteA', '5')))
    for (const aufbau of ['bawue', 'berlin', 'moewe', 'alcatrazdm26']) {
      const danach = nach(s, { type: 'SET_AUFBAU', aufbau, zeit: 2000 })
      expect(danach.aufbau).toBe(aufbau)
      const anders = listenInhalte(danach).get(lauf('4', 1)) !== listenInhalte(s).get(lauf('4', 1))
      expect(danach.listenStand[lauf('4', 1)].zeit, aufbau).toBe(anders ? 2000 : 1000)
    }
    // Baden-Württemberg: dieselben Spalten im Lauf, nur anders auf die Listen verteilt – die
    // Lauf-Liste bleibt, wie sie war. Auch die Gesamtliste: Die Spalte der Knoten hat sie in
    // jedem Aufbau (Vorgabe des Regelwerks).
    expect(zeiten(nach(s, { type: 'SET_AUFBAU', aufbau: 'bawue', zeit: 2000 }))).toEqual({ [lauf('4', 1)]: 1000, [gesamt('4')]: 1000 })
    // Ohne die Knoten-Liste verliert die Gesamtliste ihre Spalte – das ist eine Änderung.
    const ohne = nach(s, { type: 'SET_ZUSATZ_LISTE', liste: 'knoten', an: false, zeit: 3000 })
    expect(zeiten(ohne)).toEqual({ [lauf('4', 1)]: 1000, [gesamt('4')]: 3000 })
    // Dort gehört die Liste zum Aufbau selbst: Die Spalte ist wieder da.
    expect(zeiten(nach(ohne, { type: 'SET_AUFBAU', aufbau: 'bawue', zeit: 4000 }))).toEqual({ [lauf('4', 1)]: 1000, [gesamt('4')]: 4000 })
  })

  it('eine Action ohne Zeitpunkt lässt ihn unbekannt, statt einen zu erfinden', () => {
    const s = nach(anfang(), eingabe(1000, zelle('a', 'zeit1', '80')), eingabe(undefined, zelle('a', 'zeit1', '81')))
    expect(s.listenStand[lauf('4', 1)].zeit).toBeUndefined()
    expect(standZeit(s.listenStand, lauf('4', 1))).toBe('')
    // Die nächste Änderung mit Zeitpunkt setzt wieder einen.
    expect(nach(s, eingabe(3000, zelle('a', 'zeit1', '82'))).listenStand[lauf('4', 1)].zeit).toBe(3000)
  })

  it('der Reducer bleibt rein: gleiche Action, gleicher Stand – ohne Uhr', () => {
    const action = eingabe(1234, zelle('a', 'zeit1', '80'))
    expect(reducer(anfang(), action)).toEqual(reducer(anfang(), action))
    expect(reducer(anfang(), action).listenStand[lauf('4', 1)]).toEqual({ inhalt: expect.any(Number), zeit: 1234 })
  })
})

describe('Stand der Ergebnislisten: Laden und Dateien', () => {
  const mitWerten = () => nach(anfang(), eingabe(1000, zelle('a', 'zeit1', '80')), eingabe(2000, zelle('c', 'zeit1', '70')))

  it('alte Stände ohne Zeitpunkt: Die Listen zeigen nichts – auch nach der nächsten Eingabe anderswo', () => {
    const { listenStand: _stand, kennung: _kennung, ...alt } = mitWerten()
    const geladen = migrate(JSON.parse(JSON.stringify(alt)))!
    expect(geladen.listenStand).toEqual({})
    // Über LOAD_STATE (Sicherung): Die Listen sind bekannt, ihr Zeitpunkt nicht.
    const s = reducer(emptyState(), { type: 'LOAD_STATE', state: geladen, zeit: 5000 })
    expect(zeiten(s)).toEqual({ [lauf('4', 1)]: undefined, [gesamt('4')]: undefined, [lauf('1', 1)]: undefined, [gesamt('1')]: undefined })
    // Aus dem Speicher des Browsers (ohne LOAD_STATE): Die erste Eingabe stempelt nur ihre Klasse.
    const weiter = reducer(geladen, eingabe(6000, zelle('c', 'zeit1', '71')))
    expect(zeiten(weiter)).toEqual({ [lauf('1', 1)]: 6000, [gesamt('1')]: 6000 })
    // … und eine Änderung, die alle Klassen neu wertet, erfindet für die unveränderten keinen Zeitpunkt.
    const alle = reducer(geladen, { type: 'UPDATE_STARTER', id: 'c', patch: { nachname: 'Neu' }, zeit: 7000 })
    expect(zeiten(alle)).toEqual({ [lauf('4', 1)]: undefined, [gesamt('4')]: undefined, [lauf('1', 1)]: 7000, [gesamt('1')]: 7000 })
  })

  it('migrate verwirft Unbrauchbares im Stand', () => {
    const s = migrate({ ...mitWerten(), listenStand: { a: { inhalt: 1, zeit: 'gestern' }, b: { zeit: 5 }, c: null, d: { inhalt: 7, zeit: 9 } } })!
    expect(s.listenStand).toEqual({ a: { inhalt: 1 }, d: { inhalt: 7, zeit: 9 } })
    expect(migrate({ ...mitWerten(), listenStand: [1, 2] })!.listenStand).toEqual({})
  })

  it('Sicherung: Die Zeitpunkte kommen zurück und überstehen das Laden', () => {
    const s = mitWerten()
    const datei = parseFile(JSON.stringify(makeFile('sicherung', s, '2026-11-13T10:00:00.000Z')))
    if (!datei.ok || datei.kind !== 'sicherung') throw new Error('keine Sicherung')
    expect(datei.state.listenStand).toEqual(s.listenStand)
    const geladen = reducer(emptyState(), { type: 'LOAD_STATE', state: datei.state, zeit: 99999 })
    expect(geladen.listenStand).toEqual(s.listenStand)
  })

  it('Vorlage: enthält weder Stand noch Kennung; beim Einspielen bleiben die der Veranstaltung', () => {
    const s = { ...mitWerten(), kennung: 'K7Q4' }
    const datei = makeFile('vorlage', s, '2026-11-13T10:00:00.000Z')
    expect(JSON.stringify(datei)).not.toContain('listenStand')
    expect(JSON.stringify(datei)).not.toContain('K7Q4')
    const vorlage = parseFile(JSON.stringify(datei))
    if (!vorlage.ok || vorlage.kind !== 'vorlage') throw new Error('keine Vorlage')
    const danach = vorlage.apply(s)
    expect(danach.listenStand).toEqual(s.listenStand)
    expect(danach.kennung).toBe('K7Q4')
    // Auch eine von Hand ergänzte Vorlage bringt keine fremde Kennung mit.
    const gefaelscht = parseFile(JSON.stringify({ ...datei, settings: { ...(datei as { settings: object }).settings, kennung: 'XXXX', listenStand: { x: { inhalt: 1, zeit: 1 } } } }))
    if (!gefaelscht.ok || gefaelscht.kind !== 'vorlage') throw new Error('keine Vorlage')
    expect(gefaelscht.apply(s)).toMatchObject({ kennung: 'K7Q4', listenStand: s.listenStand })
  })

  it('eine Vorlage, die die Wertung umstellt, ändert die betroffenen Listen zum Zeitpunkt des Ladens', () => {
    const drei = [1, 2, 3].flatMap((n) => [zelle('a', 'zeit1', String(80 + n), n), zelle('b', 'zeit1', String(90 - n), n)])
    const s = nach(anfang(), eingabe(1000, ...drei))
    const vorlage = parseFile(JSON.stringify(makeFile('vorlage', { ...s, streichlaeufe: 0 }, '2026-11-13T10:00:00.000Z')))
    if (!vorlage.ok || vorlage.kind !== 'vorlage') throw new Error('keine Vorlage')
    const danach = reducer(s, { type: 'LOAD_STATE', state: vorlage.apply(s), zeit: 4000 })
    expect(zeiten(danach)).toEqual({ [lauf('4', 1)]: 1000, [lauf('4', 2)]: 1000, [lauf('4', 3)]: 1000, [gesamt('4')]: 4000 })
  })
})

describe('Store: Zeitpunkt und Kennung kommen mit der Action', () => {
  beforeEach(() => localStorage.clear())

  it('der Store stempelt jede Action mit der Uhr; ein mitgebrachter Zeitpunkt gilt', () => {
    const store = createStore()
    store.dispatch({ type: 'ADD_STARTERS', starters: START })
    const vor = Date.now()
    store.dispatch({ type: 'SET_EINGABEN', zellen: [zelle('a', 'zeit1', '80')] })
    const zeit = store.state.value.listenStand[lauf('4', 1)].zeit!
    expect(zeit).toBeGreaterThanOrEqual(vor)
    expect(zeit).toBeLessThanOrEqual(Date.now())
    store.dispatch({ type: 'SET_EINGABEN', zellen: [zelle('c', 'zeit1', '70')], zeit: 4711 })
    expect(store.state.value.listenStand[lauf('1', 1)].zeit).toBe(4711)
  })

  it('eine Veranstaltung bekommt ihre Kennung sofort und behält sie; „Alles zurücksetzen“ ergibt eine neue', () => {
    const store = createStore()
    const kennung = store.state.value.kennung
    expect(kennung).toMatch(/^[A-X2-9]{4}$/)
    // Gespeichert, damit ein zweites Fenster dieselbe hat.
    expect(createStore().state.value.kennung).toBe(kennung)
    store.dispatch({ type: 'SET_KENNUNG', kennung: 'ABCD' })
    expect(store.state.value.kennung).toBe(kennung)
    store.dispatch({ type: 'SET_EVENT', patch: { eventName: 'Hafenpokal' } })
    expect(store.state.value.kennung).toBe(kennung)
    // Der Zufall ist hier nicht fest; zwei gleiche Kennungen nacheinander sind praktisch ausgeschlossen (1 : 810 000).
    store.dispatch({ type: 'RESET_ALL' })
    expect(store.state.value.kennung).toMatch(/^[A-X2-9]{4}$/)
    expect(store.state.value.kennung).not.toBe(kennung)
  })

  it('ein geladener Stand behält seine Kennung; ein alter ohne bekommt eine', () => {
    const store = createStore()
    store.dispatch({ type: 'LOAD_STATE', state: { ...emptyState(), kennung: 'K7Q4' } })
    expect(store.state.value.kennung).toBe('K7Q4')
    store.dispatch({ type: 'LOAD_STATE', state: migrate({ starters: [] })! })
    expect(store.state.value.kennung).toMatch(/^[A-X2-9]{4}$/)
    expect(store.state.value.kennung).not.toBe('K7Q4')
  })

  it('der Reducer würfelt nicht: Ohne Kennung in der Action bleibt sie leer', () => {
    expect(reducer({ ...emptyState(), kennung: 'K7Q4' }, { type: 'RESET_ALL' }).kennung).toBe('')
    expect(reducer({ ...emptyState(), kennung: 'K7Q4' }, { type: 'RESET_ALL', kennung: 'NEU2' }).kennung).toBe('NEU2')
    expect(reducer(emptyState(), { type: 'SET_KENNUNG', kennung: 'kaputt!' })).toEqual(emptyState())
    expect(migrate({ starters: [], kennung: 'x y' })!.kennung).toBe('')
    expect(migrate({ starters: [], kennung: 'K7Q4' })!.kennung).toBe('K7Q4')
  })
})
