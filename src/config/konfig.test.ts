import { describe, expect, it } from 'vitest'
import { baue, configFor, resolveRegelwerkId, ROH_QUELLE, ROH_REGELWERKE } from './konfig'
import { quellDateien } from './merge-positionen'
import aufbauListe from './aufbauten.yaml?raw'
import type { RawAufbau } from './schema'
import { buildConfig } from './build'

const eigener: RawAufbau = {
  id: 'hafenfestq3m8',
  name: 'Hafenfest',
  positionen: ['zeit', 'steg', { id: 'hf1', titel: 'Alle Tore', blick: 'rechts', bojen: ['StartZiel', 'Tor1', 'Tor2', 'Tor3', 'Tor4', 'Tor5'] }],
}

describe('configFor ist rein', () => {
  it('gleiche Eingabe, gleiches Ergebnis – auch mit inhaltsgleichen Kopien der eigenen Aufbauten', () => {
    expect(configFor({ regelwerk: 'uim-2026' })).toBe(configFor({ regelwerk: 'uim-2026' }))
    const kopie = JSON.parse(JSON.stringify([eigener])) as RawAufbau[]
    expect(configFor({ eigeneAufbauten: [eigener] })).toBe(configFor({ eigeneAufbauten: kopie }))
    expect(configFor()).toBe(configFor({ regelwerk: 'dm-2026', sprache: 'de', eigeneAufbauten: [] }))
  })

  it('zwei Regelwerke teilen keinen veränderlichen Zustand', () => {
    const dm = configFor({ regelwerk: 'dm-2026' })
    const vorher = JSON.stringify(dm)
    const uim = configFor({ regelwerk: 'uim-2026', sprache: 'en', beschriftung: 'ia', eigeneAufbauten: [eigener] })
    // Die zweite Auswahl hat an der ersten nichts geändert, und beide gelten nebeneinander.
    expect(JSON.stringify(dm)).toBe(vorher)
    expect(dm.getRegelwerk().label).toBe('DM 2026')
    expect(uim.getRegelwerk().label).toBe('UIM 2026')
    expect(dm.getSheetDef('steg').disqTableTitle).toBe('Disqualifikation (DM 2026):')
    expect(uim.getSheetDef('steg').disqTableTitle).toBe('Disqualification (UIM 2026):')
    expect(dm.getAufbauten().some((a) => a.eigen)).toBe(false)
    expect(uim.getAufbau('hafenfestq3m8').eigen).toBe(true)
  })

  it('liefert Eingefrorenes und hängt nicht an den Objekten des Aufrufers', () => {
    const meine: RawAufbau[] = [JSON.parse(JSON.stringify(eigener)) as RawAufbau]
    const k = configFor({ eigeneAufbauten: meine })
    meine[0].name = 'Umbenannt'
    expect(k.eigeneAufbauten[0].name).toBe('Hafenfest')
    expect(Object.isFrozen(k)).toBe(true)
    expect(Object.isFrozen(k.positions)).toBe(true)
    expect(Object.isFrozen(ROH_QUELLE.positionen)).toBe(true)
    expect(() => {
      k.aufbauten.push({ id: 'x', name: 'X', disziplin: 'x', order: [], zusatz: [] })
    }).toThrow()
  })

  it('unbekannte Kennungen gelten als Vorgabe', () => {
    expect(resolveRegelwerkId('uim-2026')).toBe('uim-2026')
    expect(resolveRegelwerkId('gibtsnicht')).toBe('dm-2026')
    expect(configFor({ regelwerk: 'gibtsnicht', beschriftung: 'gibtsnicht' })).toBe(configFor())
  })
})

// Die Fälle zu Regelwerken und Sprachen aus dem Prototyp stehen in regelwerke.test.ts.

describe('Aufbauten', () => {
  it('mit zusammengelegten Listen ändert sich die Reihenfolge', () => {
    const k = configFor()
    const kombi = k.getAufbau('alcatraz').kombi
    expect(kombi).toBeDefined()
    expect(k.aufbauOrder('alcatraz', false)).toEqual(k.getAufbau('alcatraz').order)
    expect(k.aufbauOrder('alcatraz', true)).toEqual(kombi!.order)
    expect(k.getAufbau('gibtsnicht').id).toBe(k.defaultAufbauId())
  })

  it('nennt die Lücken eines Entwurfs', () => {
    const k = configFor()
    expect(k.entwurfsLuecken({ id: 'entwurf1', name: 'Entwurf', positionen: ['steg'] }).length).toBeGreaterThan(0)
    expect(k.vergebeneIds().has('alcatraz')).toBe(true)
    expect(k.vergebeneIds().has('gate135')).toBe(true)
  })
})

// Im Prototyp meldete `npm run config:check` fehlende und nicht eingetragene Dateien
// (MISSING_DATEI, ORPHAN_DATEI). Hier sind die Dateien eingebunden; dieser Fall hält fest,
// dass die Liste in aufbauten.yaml und die Dateien im Ordner zusammenpassen.
describe('Positionsdateien', () => {
  const vorhanden = Object.keys(import.meta.glob(['./i18n/*.yaml', './aufbauten/*.yaml']))
    .map((pfad) => pfad.replace(/^\.\/|\.yaml$/g, ''))
    .sort()
  const genannt = quellDateien(aufbauListe)

  it('jede in aufbauten.yaml genannte Datei gibt es, und keine liegt ungenannt im Ordner', () => {
    expect(vorhanden.length).toBeGreaterThan(0)
    expect(genannt.filter((name) => name !== 'einstellungen').sort()).toEqual(vorhanden)
    expect(new Set(genannt).size).toBe(genannt.length)
  })

  it('jedes Regelwerk aus regelwerke.yaml hat seine Datei und umgekehrt', () => {
    const dateien = Object.keys(import.meta.glob('./regelwerke/*.yaml')).map((pfad) => pfad.replace(/^\.\/regelwerke\/|\.yaml$/g, ''))
    expect(ROH_REGELWERKE.map((r) => r.id).sort()).toEqual(dateien.sort())
  })

  it('die Aufbauten jeder Datei kommen in der Konfiguration an', () => {
    const ids = configFor().getAufbauten().map((a) => a.id)
    expect(ROH_QUELLE.aufbauten?.map((a) => a.id)).toEqual(ids)
    for (const id of ['alcatraz', 'moewe']) expect(ids).toContain(id)
  })

  it('Laufzettel: Der letzte Lauf hat eigene Schritte; fehlen sie, gelten die der übrigen Läufe', () => {
    const { schritte, schritteLetzterLauf } = configFor().getLaufzettelConfig()
    expect(schritte.length).toBeGreaterThan(0)
    expect(schritteLetzterLauf.length).toBeGreaterThan(0)
    expect(schritteLetzterLauf).not.toEqual(schritte)
    expect(buildConfig({ positionen: [], laufzettel: { schritte: ['a', 'b'] } }).laufzettel).toMatchObject({ schritte: [{ text: 'a' }, { text: 'b' }], schritteLetzterLauf: [{ text: 'a' }, { text: 'b' }] })
    expect(buildConfig({ positionen: [], laufzettel: { schritte: ['a'], schritteLetzterLauf: ['z', 7 as never] } }).laufzettel).toMatchObject({ schritte: [{ text: 'a' }], schritteLetzterLauf: [{ text: 'z' }, { text: '7' }] })
    expect(buildConfig({ positionen: [] }).laufzettel).toMatchObject({ schritte: [], schritteLetzterLauf: [] })
  })

  it('Laufzettel: Die Schritte hängen am Regelwerk – die Vorgabe steht in einstellungen.yaml, das Regelwerk darf abweichen', () => {
    const dm = configFor({ regelwerk: 'dm-2026' }).getLaufzettelConfig()
    const uim = configFor({ regelwerk: 'uim-2026' }).getLaufzettelConfig()
    // DM: unverändert die Vorgabe (C6: letzter Lauf nur Einsicht der Mannschaftsleiter, kein Aushang).
    expect(dm.schritteLetzterLauf.map((s) => s.text)).toContain('Einsicht der Mannschaftsleiter (kein Aushang)')
    expect(dm.schritteLetzterLauf.every((s) => s.en === undefined)).toBe(true)
    // UIM 960, Pkt. 5.2: Aushang binnen einer Stunde, vom O.O.D. unterschrieben, mit Uhrzeit – englisch nach dem Rulebook.
    expect(uim.schritte).toEqual(dm.schritte)
    expect(uim.titel).toBe(dm.titel)
    const aushang = uim.schritteLetzterLauf.find((s) => s.en)
    expect(aushang?.en).toBe('Results signed by the O.O.D. and posted – not more than 1 (one) hour after the last driver of the class has finished, showing the time of posting (rule 960, pt. 5.2)')
    expect(uim.schritteLetzterLauf.map((s) => s.text)).not.toContain('Einsicht der Mannschaftsleiter (kein Aushang)')
    // Was ein Regelwerk nennt, ersetzt die gleichnamige Angabe der Vorgabe – der Rest bleibt.
    const eigen = baue({ id: 'x', laufzettel: { schritteLetzterLauf: [{ text: 'Aushang', en: 'Posted' }] } }, { positionen: [], laufzettel: { titel: 'T', schritte: ['a'], schritteLetzterLauf: ['b'] } })
    expect(eigen.laufzettel).toEqual({ titel: 'T', schritte: [{ text: 'a' }], schritteLetzterLauf: [{ text: 'Aushang', en: 'Posted' }] })
  })
})
