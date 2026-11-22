import { describe, expect, it } from 'vitest'
import { aufgabenVon, bekannteGeraete, benenne, beruehre, entzogeneListe, geraeteListe, hatGruppe, koppelStandVon, setzeAufgaben, setzeKoppelStand, setzeTyp, vermerkeEntzug, vermerkeLebenszeichen } from './register'
import { gruppeDerFreigabe, gruppeDerListe } from './wkrGruppen'
import { listenKennung } from '../wkr/liste'
import { gibCode, leererKoppelStand } from './koppeln'
import { istHostRaum, neuerRaum, ENTZOGEN_HOECHSTENS } from './transport/ntfy/raum'
import { SERVER } from './transport/ntfy/testNtfy'

/** Register im Raum des Hosts (E7) – rein; Gerätenamen erfunden. */

const PK = 'A'.repeat(43)

function raumMitGeraet() {
  const raum = neuerRaum(SERVER)
  raum.geraete.g1 = { pk: PK, letzteNr: 5, gruppen: [], name: 'Steg Nord', aufgaben: [{ art: 'startfreigabe', bereiche: ['see'] }], seit: 10, zuletzt: 20 }
  raum.geraete.g2 = { pk: 'B'.repeat(43), letzteNr: 1, gruppen: [] }
  return raum
}

describe('Register', () => {
  it('Liste ohne Schlüssel und Nummern, nach Name; Kaputtes in Aufgaben fällt weg', () => {
    const raum = raumMitGeraet()
    raum.geraete.g2.aufgaben = [{ art: 'admin' }]
    const liste = geraeteListe(raum)
    expect(liste.map((g) => g.id)).toEqual(['g2', 'g1'])
    expect(liste[1]).toEqual({ id: 'g1', name: 'Steg Nord', aufgaben: [{ art: 'startfreigabe', bereiche: ['see'] }], seit: 10, zuletzt: 20 })
    expect(liste[0].aufgaben).toEqual([])
    expect(JSON.stringify(liste)).not.toContain(PK)
    expect(bekannteGeraete(raum).g1).toEqual({ pk: PK, name: 'Steg Nord', aufgaben: [{ art: 'startfreigabe', bereiche: ['see'] }] })
  })

  it('Rechte ändern, umbenennen, berühren – nur für Eingetragene; der Raum bleibt gültig', () => {
    const raum = raumMitGeraet()
    // W2.4: Die Start-Freigabe bringt die Freigabe-Gruppe ihres Bereichs mit (angelegt im selben Schreiben).
    expect(setzeAufgaben(raum, 'g1', [{ art: 'startfreigabe', bereiche: ['land'] }])).toEqual({ neu: [gruppeDerFreigabe('land')], weg: [] })
    expect(raum.gruppen[gruppeDerFreigabe('land')]).toBeTruthy()
    expect(setzeAufgaben(raum, 'g1', [{ art: 'startfreigabe', bereiche: ['land'] }])).toEqual({ neu: [], weg: [] })
    expect(aufgabenVon(raum, 'g1')).toEqual([{ art: 'startfreigabe', bereiche: ['land'] }])
    expect(setzeAufgaben(raum, 'weg', [])).toBeNull()
    expect(aufgabenVon(raum, 'weg')).toEqual([])
    expect(benenne(raum, 'g1', 'Steg Süd')).toBe(true)
    beruehre(raum, 'g1', 99)
    expect(raum.geraete.g1).toMatchObject({ name: 'Steg Süd', zuletzt: 99 })
    expect(istHostRaum(JSON.parse(JSON.stringify(raum)))).toBe(true)
  })

  it('Entzug vermerkt, begrenzt, neueste zuerst; Koppel-Stand rund', () => {
    const raum = raumMitGeraet()
    for (let i = 0; i < ENTZOGEN_HOECHSTENS + 5; i++) vermerkeEntzug(raum, { id: `x${i}`, name: 'Alt', um: i })
    vermerkeEntzug(raum, { id: 'g1', name: 'Steg Nord', um: 1000 })
    expect(raum.entzogen).toHaveLength(ENTZOGEN_HOECHSTENS)
    expect(entzogeneListe(raum)[0]).toEqual({ id: 'g1', name: 'Steg Nord', um: 1000 })
    const k = gibCode(leererKoppelStand(), raum.oeffentlich.a, [], 5)
    setzeKoppelStand(raum, k)
    expect(koppelStandVon(JSON.parse(JSON.stringify(raum)))).toEqual(k)
    setzeKoppelStand(raum, leererKoppelStand())
    expect('koppeln' in raum).toBe(false)
    expect(istHostRaum(JSON.parse(JSON.stringify(raum)))).toBe(true)
  })

  it('W5.1 (F14, 22.11.2026): Maskenvorgabe maske/fest bleibt im Register; die Gruppen ändert sie nicht', () => {
    const raum = raumMitGeraet()
    const tor = listenKennung({ bereich: 'see', typeId: 'gate135', racecourse: null })
    setzeAufgaben(raum, 'g1', [{ art: 'liste', liste: tor }])
    expect(setzeAufgaben(raum, 'g1', [{ art: 'liste', liste: tor, maske: 'bild', fest: true }])).toEqual({ neu: [], weg: [] })
    expect(aufgabenVon(raum, 'g1')).toEqual([{ art: 'liste', liste: tor, maske: 'bild', fest: true }])
    expect(aufgabenVon(JSON.parse(JSON.stringify(raum)), 'g1')).toEqual([{ art: 'liste', liste: tor, maske: 'bild', fest: true }])
  })

  it('W1: Gruppen folgen den Listen-Aufgaben (neu/weg), Lebenszeichen mit Akku und wartend', () => {
    const raum = raumMitGeraet()
    const tor = listenKennung({ bereich: 'see', typeId: 'gate135', racecourse: null })
    const steg = listenKennung({ bereich: 'see', typeId: 'steg', racecourse: null })
    const r1 = setzeAufgaben(raum, 'g1', [{ art: 'liste', liste: tor }, { art: 'liste', liste: steg, teil: 'ab' }])!
    expect(r1).toEqual({ neu: [gruppeDerListe(tor), gruppeDerListe(steg)], weg: [] })
    // Die Gruppen sind im selben Schreiben angelegt; `ko` steht nie unter den Gruppen des Geräts.
    expect(raum.gruppen[gruppeDerListe(tor)]).toMatchObject({ e: 1, n: 0 })
    expect(raum.geraete.g1.gruppen).not.toContain('ko')
    expect(hatGruppe(raum, 'g1', gruppeDerListe(steg))).toBe(true)
    const r2 = setzeAufgaben(raum, 'g1', [{ art: 'liste', liste: tor }])!
    expect(r2).toEqual({ neu: [], weg: [gruppeDerListe(steg)] })
    expect(hatGruppe(raum, 'g1', gruppeDerListe(steg))).toBe(false)

    vermerkeLebenszeichen(raum, 'g1', 500, { wartend: 2, akku: 41 })
    expect(geraeteListe(raum).find((g) => g.id === 'g1')).toMatchObject({ zuletzt: 500, wartend: 2, akku: 41 })
    vermerkeLebenszeichen(raum, 'g1', 600, { wartend: 0 })
    expect(raum.geraete.g1.akku).toBeUndefined()
    vermerkeLebenszeichen(raum, 'weg', 700, { wartend: 1 })
    expect(istHostRaum(JSON.parse(JSON.stringify(raum)))).toBe(true)
  })

  it('WKR-Namen (W3-13, WN2): aus dem Lebenszeichen, nur eigene Listen, `{}` räumt, ohne Feld bleibt; im Raum geprüft', () => {
    const raum = raumMitGeraet()
    const tor = listenKennung({ bereich: 'par_1', typeId: 'gate135', racecourse: null })
    const fremd = listenKennung({ bereich: 'par_1', typeId: 'steg', racecourse: null })
    setzeAufgaben(raum, 'g1', [{ art: 'liste', liste: tor }])
    vermerkeLebenszeichen(raum, 'g1', 500, { wartend: 0, namen: { [tor]: 'Erika Muster', [fremd]: 'Max Beispiel' } })
    expect(geraeteListe(raum).find((g) => g.id === 'g1')!.wkrNamen).toEqual({ [tor]: 'Erika Muster' })
    expect(istHostRaum(JSON.parse(JSON.stringify(raum)))).toBe(true)
    // Ein älteres Gerät ohne `namen` ändert nichts.
    vermerkeLebenszeichen(raum, 'g1', 600, { wartend: 0 })
    expect(raum.geraete.g1.wkrNamen).toEqual({ [tor]: 'Erika Muster' })
    // Zurück zur Einteilung: leer.
    vermerkeLebenszeichen(raum, 'g1', 700, { wartend: 0, namen: {} })
    expect(raum.geraete.g1.wkrNamen).toBeUndefined()
    expect('wkrNamen' in geraeteListe(raum).find((g) => g.id === 'g1')!).toBe(false)
    // Kaputter Raum (Name zu lang) wird nicht gelesen.
    const kaputt = JSON.parse(JSON.stringify(raum))
    kaputt.geraete.g1.wkrNamen = { [tor]: 'x'.repeat(61) }
    expect(istHostRaum(kaputt)).toBe(false)
  })

  it('Art (W3-25, GF7): aus der Anmeldung nur beim ersten Mal, die Wahl am Bedienrechner bleibt; im Raum geprüft', () => {
    const raum = raumMitGeraet()
    expect(setzeTyp(raum, 'g1', 'handy', true)).toBe(true)
    expect(setzeTyp(raum, 'g1', 'pad')).toBe(true)
    expect(setzeTyp(raum, 'g1', 'handy', true)).toBe(false)
    expect(geraeteListe(raum).find((g) => g.id === 'g1')!.typ).toBe('pad')
    expect(setzeTyp(raum, 'weg', 'pad')).toBe(false)
    expect(istHostRaum(JSON.parse(JSON.stringify(raum)))).toBe(true)
    expect(istHostRaum(JSON.parse(JSON.stringify({ ...raum, geraete: { ...raum.geraete, g1: { ...raum.geraete.g1, typ: 'toaster' } } })))).toBe(false)
  })
})
