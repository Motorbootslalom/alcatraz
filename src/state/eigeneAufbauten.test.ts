import { describe, expect, it } from 'vitest'
import { emptyState, reducer, type Action } from './reducer'
import { migrate } from './migrate'
import { makeFile, parseFile } from '../persistenz/backup'
import { manoeverAufbauten } from '../config/catalog'
import { configFor } from '../config/konfig'
import type { RawAufbau } from '../config/schema'
import type { AppState } from '../types'

/** Ein eigener Aufbau, wie ihn der Assistent abschickt (erfundene Veranstaltung). */
const hafenfest: RawAufbau = {
  id: 'hafenfestq3m8',
  name: 'Hafenfest',
  positionen: [
    'zeit',
    'steg',
    { id: 'hf135', titel: 'Tor 1 / 3 / 5', blick: 'hinten', bojen: ['StartZiel_unten', 'Tor1', 'Tor3', 'Tor5_unten', 'Speedboje_unten'], aufgaben: ['tor5'] },
    { id: 'hf245', titel: 'Tor 2 / 4 / 5', blick: 'links', bojen: ['StartZiel_oben', 'Tor2', 'Tor4', 'Tor5_oben', 'Speedboje_oben'] },
    'mueb',
  ],
}
/** Wie aus einer beschädigten Sicherung: Die Form stimmt, auflösen lässt er sich nicht. */
const kaputt = { id: 'kaputt', name: 'Kaputt', positionen: [{ id: 'k1', titel: 'K', bojen: 7 }] } as unknown as RawAufbau
const zweiter: RawAufbau = { id: 'stadtseek4p9', name: 'Stadtsee', positionen: ['zeit', 'steg'] }

const mit = (aufbauten: RawAufbau[], aufbau?: string): AppState =>
  reducer(emptyState(), { type: 'SET_EIGENE_AUFBAUTEN', aufbauten, aufbau })

describe('Eigene Aufbauten im Zustand', () => {
  it('beginnt ohne eigene Aufbauten', () => {
    expect(emptyState().eigeneAufbauten).toEqual([])
  })

  it('SET_EIGENE_AUFBAUTEN ersetzt die Liste und lässt die Wahl stehen', () => {
    const state = mit([hafenfest])
    expect(state.eigeneAufbauten).toEqual([hafenfest])
    expect(state.aufbau).toBe('alcatraz')
  })

  it('wechselt mit `aufbau` zugleich dorthin – aber nur zu einem, den es gibt', () => {
    expect(mit([hafenfest], 'hafenfestq3m8').aufbau).toBe('hafenfestq3m8')
    expect(mit([hafenfest], 'gibtsnicht').aufbau).toBe('alcatraz')
  })

  it('SET_AUFBAU kennt eigene Aufbauten, aber nur die vorhandenen', () => {
    const state = mit([hafenfest])
    expect(reducer(state, { type: 'SET_AUFBAU', aufbau: 'hafenfestq3m8' }).aufbau).toBe('hafenfestq3m8')
    expect(reducer(state, { type: 'SET_AUFBAU', aufbau: 'stadtseek4p9' }).aufbau).toBe('alcatraz')
    expect(reducer(emptyState(), { type: 'SET_AUFBAU', aufbau: 'hafenfestq3m8' }).aufbau).toBe('alcatraz')
  })

  it('wird der gewählte eigene Aufbau gelöscht, gilt wieder die Vorgabe', () => {
    const gewaehlt = mit([hafenfest, zweiter], 'hafenfestq3m8')
    const geloescht = reducer(gewaehlt, { type: 'SET_EIGENE_AUFBAUTEN', aufbauten: [zweiter] })
    expect(geloescht.aufbau).toBe('alcatraz')
    expect(geloescht.eigeneAufbauten).toEqual([zweiter])
    // Wird ein anderer gelöscht, bleibt die Wahl.
    expect(reducer(gewaehlt, { type: 'SET_EIGENE_AUFBAUTEN', aufbauten: [hafenfest] }).aufbau).toBe('hafenfestq3m8')
  })

  it('ist deterministisch: dieselbe Action ergibt denselben Stand', () => {
    const action: Action = { type: 'SET_EIGENE_AUFBAUTEN', aufbauten: [hafenfest], aufbau: 'hafenfestq3m8' }
    expect(reducer(emptyState(), action)).toEqual(reducer(emptyState(), action))
  })

  it('ein eigener Aufbau mit der Kennung eines mitgelieferten steht nicht zur Wahl', () => {
    const doppelt = { ...zweiter, id: 'moewe' }
    expect(manoeverAufbauten([doppelt]).filter((a) => a.id === 'moewe')).toEqual([expect.not.objectContaining({ eigen: true })])
    // Eigene für eine andere Disziplin gehören nicht in die Wahl des Manövrier-Aufbaus.
    expect(manoeverAufbauten([{ ...zweiter, disziplin: 'parallel' }]).some((a) => a.id === zweiter.id)).toBe(false)
    expect(manoeverAufbauten([hafenfest]).at(-1)).toEqual({ id: 'hafenfestq3m8', name: 'Hafenfest', disziplin: 'manoevrieren', eigen: true })
  })

  it('„Alles zurücksetzen“ nimmt auch die eigenen Aufbauten mit', () => {
    expect(reducer(mit([hafenfest], 'hafenfestq3m8'), { type: 'RESET_ALL' })).toEqual(emptyState())
  })
})

describe('Migration', () => {
  it('ältere Stände ohne das Feld bekommen eine leere Liste', () => {
    const { eigeneAufbauten: _ohne, ...alt } = emptyState()
    expect(migrate(alt)?.eigeneAufbauten).toEqual([])
    expect(migrate({ starters: [], eigeneAufbauten: 'kaputt' })?.eigeneAufbauten).toEqual([])
  })

  it('behält eigene Aufbauten und die Wahl eines eigenen', () => {
    const state = migrate({ ...emptyState(), eigeneAufbauten: [hafenfest], aufbau: 'hafenfestq3m8' })
    expect(state?.eigeneAufbauten).toEqual([hafenfest])
    expect(state?.aufbau).toBe('hafenfestq3m8')
  })

  it('lässt weg, was nicht die Gestalt eines Aufbaus hat, und setzt eine verwaiste Wahl zurück', () => {
    const state = migrate({
      ...emptyState(),
      aufbau: 'Nicht-Erlaubt',
      eigeneAufbauten: [null, 'text', { id: 'Nicht-Erlaubt', name: 'X', positionen: ['steg'] }, { id: 'ohnelisten', name: 'Y' }, zweiter],
    })
    expect(state?.eigeneAufbauten).toEqual([zweiter])
    expect(state?.aufbau).toBe('alcatraz')
  })

  it('behält je Kennung nur den ersten Eintrag', () => {
    const state = migrate({ ...emptyState(), eigeneAufbauten: [zweiter, { ...zweiter, name: 'Doppelt' }, hafenfest] })
    expect(state?.eigeneAufbauten).toEqual([zweiter, hafenfest])
  })

  it('behält, was die Fachprüfung ablehnt, wählt es aber nicht', () => {
    const state = migrate({ ...emptyState(), aufbau: 'kaputt', eigeneAufbauten: [kaputt, hafenfest] })
    // Gespeichert bleibt er (Herunterladen, Löschen); gelten kann er nicht.
    expect(state?.eigeneAufbauten).toEqual([kaputt, hafenfest])
    expect(state?.aufbau).toBe('alcatraz')
    expect(migrate({ ...emptyState(), aufbau: 'hafenfestq3m8', eigeneAufbauten: [kaputt, hafenfest] })?.aufbau).toBe('hafenfestq3m8')
  })
})

describe('Abgelehnte eigene Aufbauten im Reducer', () => {
  it('lassen sich nicht wählen', () => {
    const state = mit([kaputt, hafenfest])
    expect(reducer(state, { type: 'SET_AUFBAU', aufbau: 'kaputt' }).aufbau).toBe('alcatraz')
    expect(mit([kaputt, hafenfest], 'kaputt').aufbau).toBe('alcatraz')
    expect(reducer(state, { type: 'SET_AUFBAU', aufbau: 'hafenfestq3m8' }).aufbau).toBe('hafenfestq3m8')
  })

  it('ein Wechsel des Regelwerks nimmt niemandem seinen Aufbau – auch nicht mit eigenen Titeln ohne Übersetzung', () => {
    // Unter UIM nennt die Prüfung den fehlenden englischen Titel als Hinweis; brauchbar bleibt der Aufbau.
    const frei: RawAufbau = { id: 'freix2k7', name: 'Frei', positionen: ['zeit', 'steg', { id: 'fr1', titel: 'Alle Tore am Stadthafen', blick: 'rechts', bojen: ['StartZiel', 'Tor1', 'Tor2', 'Tor3', 'Tor4', 'Tor5'] }] }
    const pruefung = configFor({ regelwerk: 'uim-2026' }).pruefeEigeneAufbauten({ aufbauten: [frei] })
    expect(pruefung.fehler).toEqual([])
    expect(pruefung.hinweise.map((f) => f.code)).toContain('EN_TITEL_FEHLT')
    const state = reducer(mit([frei], 'freix2k7'), { type: 'SET_REGELWERK', regelwerk: 'uim-2026' })
    expect(state.aufbau).toBe('freix2k7')
    const k = configFor({ regelwerk: 'uim-2026', eigeneAufbauten: state.eigeneAufbauten })
    expect(k.abgelehnteEigene).toEqual([])
    expect(k.getAufbau('freix2k7').eigen).toBe(true)
    expect(migrate(state)?.aufbau).toBe('freix2k7')
  })
})

describe('Eigene Aufbauten unter einem Regelwerk mit Englisch (UIM)', () => {
  const tore = { id: 'fr1', titel: 'Alle Tore am Stadthafen', blick: 'rechts' as const, bojen: ['StartZiel', 'Tor1', 'Tor2', 'Tor3', 'Tor4', 'Tor5'] }
  const frei = (position: object = tore): RawAufbau => ({ id: 'freix2k7', name: 'Frei', positionen: ['zeit', 'steg', position as typeof tore] })
  const uim = (aufbauten: RawAufbau[] = [], sprache?: 'de' | 'en' | 'de+en') => configFor({ regelwerk: 'uim-2026', eigeneAufbauten: aufbauten, sprache })

  it('ein frei benannter Titel ohne Englisch ist ein Hinweis, kein Fehler: Der Aufbau lässt sich speichern', () => {
    const pruefung = uim().pruefeEigeneAufbauten({ aufbauten: [frei()] })
    expect(pruefung.fehler).toEqual([])
    expect(pruefung.aufbauten).toEqual([frei()])
    const hinweis = pruefung.hinweise.find((h) => h.code === 'EN_TITEL_FEHLT')!
    expect(hinweis.params.titel).toBe('Alle Tore am Stadthafen')
    expect(hinweis.message).toContain('Auf englischen Listen steht der deutsche')
    // Unter DM gibt es kein Englisch und damit auch keinen Hinweis.
    expect(configFor().pruefeEigeneAufbauten({ aufbauten: [frei()] }).hinweise.map((h) => h.code)).not.toContain('EN_TITEL_FEHLT')
  })

  it('mit englischem Titel entfällt der Hinweis', () => {
    const pruefung = uim().pruefeEigeneAufbauten({ aufbauten: [frei({ ...tore, titelEn: 'All gates at the town harbour' })] })
    expect(pruefung.fehler).toEqual([])
    expect(pruefung.hinweise.map((h) => h.code)).not.toContain('EN_TITEL_FEHLT')
  })

  it('auch eine umbenannte Liste ({ id: steg, titel }) ist frei benannt', () => {
    const umbenannt: RawAufbau = { ...frei({ ...tore, titelEn: 'All gates' }), positionen: ['zeit', { id: 'steg', titel: 'Steg am Kran' }, { ...tore, titelEn: 'All gates' }] }
    const pruefung = uim().pruefeEigeneAufbauten({ aufbauten: [umbenannt] })
    expect(pruefung.fehler).toEqual([])
    expect(pruefung.hinweise.filter((h) => h.code === 'EN_TITEL_FEHLT').map((h) => h.params.titel)).toEqual(['Steg am Kran'])
  })

  it('die Liste zeigt den englischen Titel; ohne ihn fällt sie auf den deutschen zurück', () => {
    const mitEn = frei({ ...tore, titelEn: 'All gates at the town harbour' })
    expect(uim([mitEn], 'en').getSheetDef('fr1').title).toBe('All gates at the town harbour')
    expect(uim([mitEn], 'de+en').getSheetDef('fr1').title).toBe('Alle Tore am Stadthafen / All gates at the town harbour')
    expect(uim([mitEn], 'de').getSheetDef('fr1').title).toBe('Alle Tore am Stadthafen')
    expect(uim([mitEn], 'en').getSheetDef('fr1').titelDe).toBe('Alle Tore am Stadthafen')
    for (const sprache of ['en', 'de+en'] as const) expect(uim([frei()], sprache).getSheetDef('fr1').title).toBe('Alle Tore am Stadthafen')
    // Unter DM gibt es kein Englisch: Der englische Titel reist mit, wirkt aber nicht.
    expect(configFor({ eigeneAufbauten: [mitEn], sprache: 'en' }).getSheetDef('fr1').title).toBe('Alle Tore am Stadthafen')
  })

  it('der englische Titel steht in der YAML-Datei und kommt beim Einspielen zurück', () => {
    const mitEn = frei({ ...tore, titelEn: 'All gates at the town harbour' })
    const yaml = uim([mitEn]).aufbauAlsYaml('freix2k7', { datum: '2026-11-13', version: 'test' })!
    expect(yaml).toContain('titelEn: All gates at the town harbour')
    expect(uim().pruefeEigeneAufbauten(yaml).aufbauten).toEqual([mitEn])
  })

  it('ein englischer Titel, der kein Text ist, wird unter jedem Regelwerk abgelehnt', () => {
    const falsch = frei({ ...tore, titelEn: 7 })
    for (const k of [configFor(), uim()]) expect(k.pruefeEigeneAufbauten({ aufbauten: [falsch] }).fehler.map((f) => f.code)).toContain('BAD_TITEL_EN')
    expect(uim([falsch]).abgelehnteEigene.map((a) => a.id)).toEqual(['freix2k7'])
  })
})

describe('Sicherung und Vorlage', () => {
  const AT = '2026-11-12T10:00:00.000Z'
  const stand = (): AppState => ({ ...mit([hafenfest], 'hafenfestq3m8'), eventName: 'Hafenfest-Pokal' })

  it('die Sicherung bringt eigene Aufbauten und die Wahl zurück', () => {
    const result = parseFile(JSON.stringify(makeFile('sicherung', stand(), AT)))
    if (!result.ok || result.kind !== 'sicherung') throw new Error('keine Sicherung')
    expect(result.state.eigeneAufbauten).toEqual([hafenfest])
    expect(result.state.aufbau).toBe('hafenfestq3m8')
  })

  it('eine Vorlage ohne eigene Aufbauten löscht die vorhandenen nicht', () => {
    for (const ohne of [undefined, []]) {
      const file = makeFile('vorlage', emptyState(), AT)
      if (file.kind !== 'vorlage') throw new Error('keine Vorlage')
      // `undefined`: eine Vorlage aus der Zeit vor den eigenen Aufbauten.
      const settings = { ...file.settings, eigeneAufbauten: ohne }
      const result = parseFile(JSON.stringify({ ...file, settings }))
      if (!result.ok || result.kind !== 'vorlage') throw new Error('keine Vorlage')
      const applied = result.apply(stand())
      expect(applied.eigeneAufbauten).toEqual([hafenfest])
      // Die Wahl ist eine Einstellung und kommt aus der Vorlage.
      expect(applied.aufbau).toBe('alcatraz')
    }
  })

  it('eine Vorlage, deren Wahl auf einen hier vorhandenen eigenen Aufbau zeigt, behält die Wahl', () => {
    const file = makeFile('vorlage', stand(), AT)
    if (file.kind !== 'vorlage') throw new Error('keine Vorlage')
    const result = parseFile(JSON.stringify({ ...file, settings: { ...file.settings, eigeneAufbauten: [] } }))
    if (!result.ok || result.kind !== 'vorlage') throw new Error('keine Vorlage')
    expect(result.apply(mit([hafenfest])).aufbau).toBe('hafenfestq3m8')
    // Ohne den Aufbau gilt die Vorgabe.
    expect(result.apply(emptyState()).aufbau).toBe('alcatraz')
  })

  it('die eigenen Aufbauten der Vorlage kommen dazu; bei gleicher Kennung gilt die Vorlage', () => {
    const file = makeFile('vorlage', mit([{ ...hafenfest, name: 'Hafenfest neu' }]), AT)
    const result = parseFile(JSON.stringify(file))
    if (!result.ok || result.kind !== 'vorlage') throw new Error('keine Vorlage')
    const applied = result.apply(mit([zweiter, hafenfest]))
    expect(applied.eigeneAufbauten.map((a) => a.name)).toEqual(['Hafenfest neu', 'Stadtsee'])
  })

  it('die Vorlage enthält die eigenen Aufbauten und setzt sie in der nächsten Veranstaltung', () => {
    const file = makeFile('vorlage', stand(), AT)
    if (file.kind !== 'vorlage') throw new Error('keine Vorlage')
    expect(file.settings.eigeneAufbauten).toEqual([hafenfest])
    expect(JSON.stringify(file)).not.toContain('Hafenfest-Pokal')

    const result = parseFile(JSON.stringify(file))
    if (!result.ok || result.kind !== 'vorlage') throw new Error('keine Vorlage')
    const applied = result.apply({ ...emptyState(), eventName: 'Nächster Pokal', eventJahr: 2027 })
    expect(applied.eigeneAufbauten).toEqual([hafenfest])
    expect(applied.aufbau).toBe('hafenfestq3m8')
    expect(applied.eventName).toBe('Nächster Pokal')
  })
})
