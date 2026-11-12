import { describe, expect, it } from 'vitest'
import { configFor, resolveRegelwerkId, ROH_QUELLE, ROH_REGELWERKE } from './konfig'
import { quellDateien } from './merge-positionen'
import aufbauListe from './aufbauten.yaml?raw'
import type { RawAufbau } from './schema'

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
})
