import { describe, expect, it } from 'vitest'
import { configFor, eigeneAuswahl } from './konfig'
import { aufbauOf, manoeverAufbauten } from './catalog'
import { ausLinkUebernehmen } from './eigene'
import type { RawAufbau } from './schema'

/** Ein eigener Aufbau wie aus dem Assistenten oder einer Datei (KONZEPT-POSITIONEN.md §4.1). */
const sommercup: RawAufbau = {
  id: 'sommercupx7k2',
  name: 'Sommercup',
  positionen: [
    'zeit',
    'steg',
    { id: 'sc135', titel: 'Tor 1 / 3 / 5', blick: 'hinten', bojen: ['StartZiel_unten', 'Tor1', 'Tor3', 'Tor5_unten', 'Speedboje_unten'], aufgaben: ['tor5'] },
    { id: 'sc245', titel: 'Tor 2 / 4 / 5', blick: 'links', bojen: ['StartZiel_oben', 'Tor2', 'Tor4', 'Tor5_oben', 'Speedboje_oben'], bildNeben: true },
    'mueb',
    'parcours',
  ],
}

/** Lässt sich nicht auflösen: `bojen` muss eine Liste sein. */
const kaputt = { id: 'kaputt', name: 'Kaputt', positionen: [{ id: 'k1', titel: 'K', bojen: 7 }] } as unknown as RawAufbau

const pruefe = (eingabe: unknown) => configFor().pruefeEigeneAufbauten(eingabe)
const fehlerVon = (aufbau: unknown) => pruefe({ aufbauten: [aufbau] }).fehler.map((f) => f.message)

describe('Prüfung eigener Aufbauten', () => {
  it('übernimmt einen vollständigen Aufbau ohne Fehler und Hinweise', () => {
    const p = pruefe({ aufbauten: [sommercup] })
    expect(p.fehler).toEqual([])
    expect(p.hinweise).toEqual([])
    expect(p.aufbauten.map((a) => a.id)).toEqual(['sommercupx7k2'])
  })

  it('weist kaputte Dateien und Kollisionen mit den mitgelieferten ab', () => {
    expect(pruefe('aufbauten: [').fehler[0].message).toMatch(/kein gültiges YAML/)
    expect(pruefe('positionen: []').fehler[0].message).toMatch(/keinen Aufbau/)
    expect(fehlerVon({ ...sommercup, id: 'Sommer-Cup' })[0]).toMatch(/Kleinbuchstaben und Ziffern/)
    expect(fehlerVon({ ...sommercup, id: 'alcatraz' })[0]).toMatch(/gibt es schon unter den mitgelieferten/)
    const mitGate = { ...sommercup, positionen: [{ id: 'gate135', titel: 'X', bojen: ['Tor1'] }] }
    expect(fehlerVon(mitGate)[0]).toMatch(/Position „gate135“ gibt es schon/)
  })

  it('nennt zu jeder eigenen Meldung Code und Parameter für die Übersetzung', () => {
    expect(pruefe('aufbauten: [').fehler[0]).toMatchObject({ code: 'YAML' })
    expect(pruefe('positionen: []').fehler[0]).toMatchObject({ code: 'KEIN_AUFBAU', params: {} })
    expect(pruefe({ aufbauten: [{ ...sommercup, id: 'alcatraz' }] }).fehler[0]).toMatchObject({
      code: 'AUFBAU_VORHANDEN',
      params: { id: 'alcatraz' },
    })
  })

  it('prüft Bojen und Verweise wie die mitgelieferten Dateien', () => {
    expect(fehlerVon({ ...sommercup, positionen: [{ id: 'x1', titel: 'X', bojen: ['Tor9'] }] }).join()).toMatch(/Unbekannte Boje "Tor9"/)
    expect(fehlerVon({ ...sommercup, positionen: ['gibtsnicht'] }).join()).toMatch(/unbekannte Position "gibtsnicht"/)
  })

  it('übernimmt einen lückenhaften Aufbau mit Hinweisen', () => {
    const p = pruefe({ aufbauten: [{ id: 'nursteg', name: 'Nur Steg', positionen: ['steg'] }] })
    expect(p.fehler).toEqual([])
    expect(p.aufbauten).toHaveLength(1)
    expect(p.hinweise.length).toBeGreaterThan(0)
  })
})

describe('Eigene Aufbauten in der Konfiguration', () => {
  it('stehen hinter den mitgelieferten, mit ihren Positionen', () => {
    const k = configFor({ eigeneAufbauten: [sommercup] })
    expect(k.getAufbauten().at(-1)?.id).toBe('sommercupx7k2')
    expect(k.getAufbau('sommercupx7k2')).toMatchObject({ eigen: true, order: ['zeit', 'steg', 'sc135', 'sc245', 'mueb', 'parcours'] })
    expect(k.getSheetDef('sc135').titelDe).toBe('Tor 1 / 3 / 5')
    expect(k.abgelehnteEigene).toEqual([])
    // Ohne sie gibt es weder den Aufbau noch seine Positionen.
    expect(configFor().getAufbauten().some((a) => a.id === 'sommercupx7k2')).toBe(false)
    expect(() => configFor().getSheetDef('sc135')).toThrow()
  })

  it('weichen einem mitgelieferten Aufbau mit derselben ID', () => {
    const k = configFor({ eigeneAufbauten: [{ ...sommercup, id: 'alcatraz', positionen: ['steg'] }] })
    expect(k.getAufbau('alcatraz').eigen).toBeUndefined()
    expect(k.verdeckteEigene.map((a) => a.id)).toEqual(['alcatraz'])
  })

  it('gehen als YAML hin und zurück, ohne interne Kennzeichen', () => {
    const text = configFor({ eigeneAufbauten: [sommercup] }).aufbauAlsYaml('sommercupx7k2', { datum: '2026-11-08', version: 'test' })!
    expect(text).toContain('# Aufbau „Sommercup“')
    expect(text).not.toMatch(/eigen:|bildImBrowser/)
    expect(pruefe(text).aufbauten).toEqual([sommercup])
  })

  it('legen die Anwendung nicht lahm, wenn sie sich nicht auflösen lassen', () => {
    const k = configFor({ eigeneAufbauten: [kaputt] })
    expect(k.abgelehnteEigene.map((a) => a.id)).toEqual(['kaputt'])
    expect(k.getAufbauten().map((a) => a.id)).toEqual(configFor().getAufbauten().map((a) => a.id))
  })
})

// Sicherung und Vorlage bringen eigene Aufbauten mit, die nie durch die Prüfung einer
// YAML-Datei gelaufen sind. Jeder wird deshalb einzeln geprüft; die Auswahl unter
// „Veranstaltung“ (catalog.ts) und die Konfiguration rechnen mit demselben Ergebnis.
describe('Eigene Aufbauten aus Sicherung oder Vorlage', () => {
  const wahl = (eigene: RawAufbau[]) => manoeverAufbauten(eigene).filter((a) => a.eigen).map((a) => a.id)
  const inKonfig = (eigene: RawAufbau[]) => configFor({ eigeneAufbauten: eigene }).getAufbauten().filter((a) => a.eigen).map((a) => a.id)
  const codes = (eigene: RawAufbau[], id: string) =>
    configFor({ eigeneAufbauten: eigene }).abgelehnteEigene.find((a) => a.id === id)?.fehler.map((f) => f.code) ?? []

  it('ein beschädigter Aufbau nimmt nur sich selbst heraus, und die Auswahl folgt der Konfiguration', () => {
    const eigene = [sommercup, kaputt]
    expect(inKonfig(eigene)).toEqual(['sommercupx7k2'])
    expect(wahl(eigene)).toEqual(['sommercupx7k2'])
    expect(configFor({ eigeneAufbauten: eigene }).abgelehnteEigene.map((a) => a.id)).toEqual(['kaputt'])
    // Ein abgelehnter ist nicht wählbar: Die Wahl fällt auf die Vorgabe.
    expect(aufbauOf('kaputt', eigene).id).toBe('alcatraz')
    expect(aufbauOf('sommercupx7k2', eigene).id).toBe('sommercupx7k2')
  })

  it('Daten, an denen die Prüfung selbst stolpert, sind eine Ablehnung und kein Absturz', () => {
    const zahl = { id: 'kk', name: 'Kaputt', positionen: [{ id: 'pz', titel: 'x', bojen: ['Tor1'], klassen: 5 }] } as unknown as RawAufbau
    const objekt = { id: 'oo', name: 'Kaputt', positionen: [{ id: 'po', titel: 'x', aufgaben: {} }] } as unknown as RawAufbau
    const k = configFor({ eigeneAufbauten: [zahl, objekt, sommercup] })
    expect(k.abgelehnteEigene.map((a) => a.id)).toEqual(['kk', 'oo'])
    expect(inKonfig([zahl, objekt, sommercup])).toEqual(['sommercupx7k2'])
    // Assistent und Einspielen rechnen nur mit den brauchbaren.
    expect(() => k.entwurfsLuecken({ id: 'entwurf1', name: 'Entwurf', positionen: ['steg'] })).not.toThrow()
    expect(k.pruefeEigeneAufbauten({ aufbauten: [{ ...sommercup, id: 'neu1', positionen: ['steg'] }] }).fehler).toEqual([])
    // Ihre IDs bleiben trotzdem belegt, solange sie gespeichert sind.
    expect(k.vergebeneIds().has('kk')).toBe(true)
    expect(k.vergebeneIds().has('pz')).toBe(true)
  })

  it('eine doppelte Kennung gilt einmal: Der erste Eintrag gewinnt', () => {
    const eigene = [sommercup, { ...sommercup, name: 'Zweiter' }]
    expect(inKonfig(eigene)).toEqual(['sommercupx7k2'])
    expect(wahl(eigene)).toEqual(['sommercupx7k2'])
    expect(configFor({ eigeneAufbauten: eigene }).getAufbau('sommercupx7k2').name).toBe('Sommercup')
  })

  it('ein Aufbau ohne Liste oder mit unbekanntem Verweis ist nicht wählbar', () => {
    const leer = { id: 'leer1', name: 'Leer', positionen: [] } as RawAufbau
    const verweis: RawAufbau = { id: 'verweis1', name: 'Verweis', positionen: ['gibtsnicht'] }
    expect(inKonfig([leer, verweis])).toEqual([])
    expect(wahl([leer, verweis])).toEqual([])
    expect(codes([leer, verweis], 'leer1')).toEqual(['AUFBAU_LEER'])
    expect(codes([leer, verweis], 'verweis1')).toContain('UNKNOWN_POSITION_REF')
  })

  it('eine eigene Position ersetzt keine mitgelieferte und keine eines anderen eigenen Aufbaus', () => {
    const steg: RawAufbau = { id: 'meinsteg1', name: 'Mein Steg', positionen: ['zeit', { id: 'steg', titel: 'Mein Steg', bojen: ['Tor1'] }] }
    expect(codes([steg], 'meinsteg1')).toEqual(['POSITION_VORHANDEN'])
    expect(configFor({ eigeneAufbauten: [steg] }).getSheetDef('steg').titelDe).toBe(configFor().getSheetDef('steg').titelDe)

    // Zwei eigene mit derselben Positions-ID: Der spätere wird abgelehnt.
    const zweiter: RawAufbau = { id: 'zweiter1', name: 'Zweiter', positionen: ['steg', { id: 'sc135', titel: 'Anders', bojen: ['Tor2'] }] }
    expect(inKonfig([sommercup, zweiter])).toEqual(['sommercupx7k2'])
    expect(codes([sommercup, zweiter], 'zweiter1').length).toBeGreaterThan(0)
  })

  it('ein eigener Aufbau für eine andere Disziplin wird abgelehnt statt still übergangen', () => {
    const parallel: RawAufbau = { ...sommercup, id: 'par1', disziplin: 'parallel' }
    expect(codes([parallel], 'par1')).toContain('AUFBAU_DISZIPLIN')
    expect(inKonfig([parallel])).toEqual([])
    expect(wahl([parallel])).toEqual([])
    expect(fehlerVon(parallel).join()).toMatch(/nur für das Manövrieren/)
    // Die Disziplin ausdrücklich zu nennen, schadet nicht.
    expect(inKonfig([{ ...sommercup, disziplin: 'manoevrieren' }])).toEqual(['sommercupx7k2'])
  })

  it('hängt nicht an den Objekten des Aufrufers und friert sie nicht ein', () => {
    const meine: RawAufbau[] = [JSON.parse(JSON.stringify(sommercup)) as RawAufbau]
    const auswahl = eigeneAuswahl(meine)
    expect(Object.isFrozen(meine[0])).toBe(false)
    expect(auswahl.gut).toEqual(meine)
    expect(eigeneAuswahl(JSON.parse(JSON.stringify(meine)) as RawAufbau[])).toBe(auswahl)
  })
})

describe('Kopie bei abweichendem Inhalt', () => {
  it('der neue hat Vorrang, ein abweichender vorhandener bleibt als Kopie mit eigenen Positionen', () => {
    expect(ausLinkUebernehmen([sommercup], sommercup)).toEqual([sommercup])
    const geaendert = { ...sommercup, name: 'Sommercup 2' }
    const liste = ausLinkUebernehmen([sommercup], geaendert)
    expect(liste.map((a) => a.id)).toEqual(['sommercupx7k2kopie2', 'sommercupx7k2'])
    expect(liste[0].positionen).toContainEqual(expect.objectContaining({ id: 'sc135k2' }))
    expect(liste[1]).toEqual(geaendert)
  })
})
