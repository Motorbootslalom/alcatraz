import { describe, expect, it } from 'vitest'
import { configFor } from '../config/konfig'
import { erfasstKennung, felderJeKennung, laufSchluessel, listenFelder, setzeWerte } from './eingaben'
import { bogenFortschritt, zeileErfasst, zeileHatWerte, zeilenHinweise, type ErfassungsBogen } from './erfassung'

const konfig = configFor()
const L1 = laufSchluessel('manoevrieren', 1)
const alle = (klasse: string, aufbau = 'alcatraz') => felderJeKennung(konfig, klasse, konfig.aufbauOrder(aufbau, false))
const arten = (typeId: string, werte: Record<string, string>, klasse = '4', aufbau = 'alcatraz') =>
  zeilenHinweise(listenFelder(konfig, typeId, klasse), werte, alle(klasse, aufbau), typeId).map((h) => h.art + (h.zelle ? `@${h.zelle}` : ''))

describe('Fortschritt eines Bogens', () => {
  const bogen: ErfassungsBogen = { typeId: 'gate135', lauf: 1, zeilen: [{ id: 'a', klasse: '4' }, { id: 'b', klasse: '4' }, { id: 'c', klasse: '4' }] }
  const boje = listenFelder(konfig, 'gate135', '4').find((f) => f.kind === 'buoy')!.kennung

  it('zählt Zeilen mit Wert auf dieser Liste und bestätigte leere Zeilen', () => {
    expect(bogenFortschritt(konfig, {}, 'alcatraz', bogen)).toEqual({ erfasst: 0, gesamt: 3 })
    const e = setzeWerte({}, [
      { lauf: L1, starter: 'a', feld: boje, wert: '5' },
      { lauf: L1, starter: 'b', feld: erfasstKennung('gate135'), wert: '1' },
      // Ein Wert einer anderen Liste macht diese Zeile hier nicht „erfasst“.
      { lauf: L1, starter: 'c', feld: 'zeit1', wert: '80' },
    ])
    expect(bogenFortschritt(konfig, e, 'alcatraz', bogen)).toEqual({ erfasst: 2, gesamt: 3 })
    // Ein anderer Lauf zählt nicht.
    expect(bogenFortschritt(konfig, e, 'alcatraz', { ...bogen, lauf: 2 })).toEqual({ erfasst: 0, gesamt: 3 })
  })

  it('gemeinsame Liste: Klassen, die die Liste nicht haben, zählen nicht mit', () => {
    const mueb: ErfassungsBogen = { typeId: 'mueb', lauf: 1, zeilen: [{ id: 'a', klasse: '3' }, { id: 'b', klasse: '4' }] }
    expect(bogenFortschritt(konfig, {}, 'alcatraz', mueb)).toEqual({ erfasst: 0, gesamt: 1 })
  })

  it('zeileErfasst / zeileHatWerte: Der Haken allein ist kein Wert', () => {
    const felder = listenFelder(konfig, 'gate135', '4')
    expect(zeileErfasst(felder, { [erfasstKennung('gate135')]: '1' }, 'gate135')).toBe(true)
    expect(zeileHatWerte(felder, { [erfasstKennung('gate135')]: '1' })).toBe(false)
    expect(zeileHatWerte(felder, { [boje]: '5' })).toBe(true)
  })
})

describe('Hinweise auf unvollständige und unplausible Eingaben', () => {
  it('eine saubere Zeile hat keine', () => {
    expect(arten('zeit', { zeit1: '83,40', zeit2: '83,55' })).toEqual([])
    expect(arten('gate135', { 't1a|hin seiteA': '5', 't1a|hin seiteB': 'G' })).toEqual([])
  })

  it('Bojen: Punkte, die kein Vielfaches von 5 sind oder zu viele', () => {
    const boje = listenFelder(konfig, 'gate135', '4').find((f) => f.kind === 'buoy')!
    expect(arten('gate135', { [boje.kennung]: '7' })).toEqual([`bojePunkte@${boje.zelle}`])
    expect(arten('gate135', { [boje.kennung]: '35' })).toEqual([`bojePunkte@${boje.zelle}`])
    expect(arten('gate135', { [boje.kennung]: '10' })).toEqual([])
  })

  it('Zeit außerhalb des glaubhaften Bereichs', () => {
    expect(arten('zeit', { zeit1: '0,15', zeit2: '0,15' })).toEqual(['zeitBereich@zeit1', 'zeitBereich@zeit2'])
    expect(arten('zeit', { zeit1: '12', zeit2: '12' })).toEqual(['zeitBereich@zeit1', 'zeitBereich@zeit2'])
  })

  it('Stoppuhren, die mehr als eine Sekunde auseinanderliegen', () => {
    expect(arten('zeit', { zeit1: '83,40', zeit2: '84,41' })).toEqual(['zeitSpanne'])
    expect(arten('zeit', { zeit1: '83,40', zeit2: '84,40' })).toEqual([])
  })

  it('auch über Listen hinweg (DM 2026: je Gerät eine Zeitliste); die Lichtschranke zählt nicht zur Spanne', () => {
    const dm = alle('4', 'alcatrazdm26')
    const stopp = [...dm.values()].filter((f) => f.kind === 'time' && f.geraet !== 'elektronisch').map((f) => f.kennung)
    const elektro = [...dm.values()].find((f) => f.geraet === 'elektronisch')!.kennung
    expect(arten('zeit-2', { [stopp[0]]: '83,00', [stopp[1]]: '85,00' }, '4', 'alcatrazdm26')).toEqual(['zeitSpanne'])
    expect(arten('zeit-2', { [stopp[0]]: '83,00', [elektro]: '85,00' }, '4', 'alcatrazdm26')).toEqual([])
  })

  it('nur eine von mehreren Stoppuhren eingetragen', () => {
    expect(arten('zeit', { zeit1: '83,40' })).toEqual(['zeitEinzeln'])
    // Eine eigene Liste je Gerät hat nur eine Spalte – dort ist eine Zeit vollständig.
    const dm = alle('4', 'alcatrazdm26')
    const stopp = [...dm.values()].filter((f) => f.kind === 'time' && f.geraet !== 'elektronisch').map((f) => f.kennung)
    expect(arten('zeit-2', { [stopp[0]]: '83,00' }, '4', 'alcatrazdm26')).toEqual([])
  })

  it('Zeit fehlt, obwohl der Lauf auf einer anderen Liste schon erfasst ist – nicht bei Disqualifikation', () => {
    expect(arten('zeit', {})).toEqual([])
    expect(arten('zeit', { 't1a|hin seiteA': '5' })).toEqual(['zeitFehlt'])
    expect(arten('zeit', { [erfasstKennung('steg')]: '1' })).toEqual(['zeitFehlt'])
    expect(arten('zeit', { [erfasstKennung('zeit')]: '1' })).toEqual([])
    expect(arten('zeit', { 'disq@vorsteg': 'X' })).toEqual([])
    expect(arten('zeit', { 't1a|hin seiteA': 'J' })).toEqual([])
  })
})
