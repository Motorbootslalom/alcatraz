import { describe, expect, it } from 'vitest'
import { configFor } from '../config/konfig'
import {
  erfasstKennung,
  feldVon,
  felderJeKennung,
  laufSchluessel,
  listenFelder,
  listenLauf,
  normalisiereEingaben,
  nurStarter,
  OHNE_LAUF,
  ohneLauf,
  setzeWerte,
  vergleicheNr,
  werteVon,
  zerlegeLauf,
} from './eingaben'

const konfig = configFor()
const L1 = laufSchluessel('manoevrieren', 1)

describe('Lauf-Schlüssel', () => {
  it('nennt Disziplin und Lauf; die Klasse folgt aus dem Starter', () => {
    expect(L1).toBe('manoevrieren/1')
    expect(zerlegeLauf('manoevrieren/3')).toEqual({ disziplin: 'manoevrieren', lauf: 3 })
  })

  it('Listen ohne Lauf (Knoten) stehen unter Lauf 0, egal welcher Bogen', () => {
    expect(listenLauf(konfig.getSheetDef('knoten'), 3)).toBe(OHNE_LAUF)
    expect(listenLauf(konfig.getSheetDef('steg'), 3)).toBe(3)
  })
})

describe('Felder', () => {
  it('eine Zelle des Bogens hat eine Kennung, die sagt, was erfasst wird', () => {
    expect(feldVon(konfig, 'gate135', '4', 't1a', 0)?.kennung).toMatch(/^t1a\|hin seite[AB]$/)
    expect(feldVon(konfig, 'steg', '4', 'fehlerAB')?.kennung).toBe('katalog:stegAblegen')
    expect(feldVon(konfig, 'zeit', '4', 'zeit2')).toMatchObject({ kennung: 'zeit2', kind: 'time' })
    // Disq. und Bemerkung gehören zu ihrer Liste.
    expect(feldVon(konfig, 'steg', '4', 'disq')?.kennung).toBe('disq@steg')
    expect(feldVon(konfig, 'vorsteg', '4', 'disq')?.kennung).toBe('disq@vorsteg')
  })

  it('Σ-Spalten und Spalten, die die Klasse nicht hat, sind keine Felder', () => {
    expect(feldVon(konfig, 'steg', '4', 'sum')).toBeUndefined()
    expect(feldVon(konfig, 'gate135', '4', 't1b', 0)).toBeUndefined() // Klasse 4 fährt zurück nicht durch Tor 1
    expect(feldVon(konfig, 'gate135', '3', 't1b', 0)).toBeDefined()
  })

  it('dasselbe Feld in jedem Aufbau: Die Bojen eines Tores stehen in Berlin auf einer anderen Liste', () => {
    const alcatraz = new Set(listenFelder(konfig, 'gate135', '5').map((f) => f.kennung))
    const berlin = new Set(['blinks', 'brechts'].flatMap((t) => listenFelder(konfig, t, '5').map((f) => f.kennung)))
    const tor1 = [...alcatraz].filter((k) => k.startsWith('t1a|'))
    expect(tor1).toHaveLength(2)
    for (const k of tor1) expect(berlin.has(k), k).toBe(true)
  })

  it('felderJeKennung: Die Listen des Aufbaus haben Vorrang – so kennt die Zeit ihr Gerät', () => {
    const dm26 = felderJeKennung(konfig, '4', konfig.aufbauOrder('alcatrazdm26', false))
    const zeiten = [...dm26.values()].filter((f) => f.kind === 'time')
    expect(zeiten.filter((f) => f.geraet === 'elektronisch')).toHaveLength(1)
    expect(zeiten.filter((f) => f.geraet === 'stoppuhr').length).toBeGreaterThanOrEqual(2)
  })

  it('gueltig: lässt nur, was auf der Liste gilt', () => {
    const ab = feldVon(konfig, 'steg', '4', 'fehlerAB')!
    expect(ab.gueltig('12 4 k 3 3')).toBe('2x3, 4, K')
    const disq = feldVon(konfig, 'vorsteg', '4', 'disq')!
    expect(disq.gueltig('x')).toBe('X')
    expect(disq.gueltig('?')).toBe('')
  })
})

describe('setzeWerte', () => {
  it('setzt Zellen, ein leerer Wert löscht; leere Zeilen und Läufe verschwinden', () => {
    const a = setzeWerte({}, [
      { lauf: L1, starter: 's1', feld: 'zeit1', wert: '83,45' },
      { lauf: L1, starter: 's1', feld: 'disq@steg', wert: 'X' },
    ])
    expect(a).toEqual({ [L1]: { s1: { zeit1: '83,45', 'disq@steg': 'X' } } })
    expect(werteVon(a, L1, 's1').zeit1).toBe('83,45')
    expect(werteVon(a, L1, 'niemand')).toEqual({})
    const b = setzeWerte(a, [{ lauf: L1, starter: 's1', feld: 'zeit1', wert: '' }])
    expect(b).toEqual({ [L1]: { s1: { 'disq@steg': 'X' } } })
    expect(setzeWerte(b, [{ lauf: L1, starter: 's1', feld: 'disq@steg', wert: '' }])).toEqual({})
  })

  it('ändert das Original nicht und gibt es unverändert zurück, wenn sich nichts ändert', () => {
    const a = setzeWerte({}, [{ lauf: L1, starter: 's1', feld: 'zeit1', wert: '83,45' }])
    const kopie = JSON.parse(JSON.stringify(a))
    expect(setzeWerte(a, [{ lauf: L1, starter: 's1', feld: 'zeit1', wert: '83,45' }])).toBe(a)
    expect(setzeWerte(a, [{ lauf: L1, starter: 's2', feld: 'zeit1', wert: '' }])).toBe(a)
    setzeWerte(a, [{ lauf: L1, starter: 's1', feld: 'zeit1', wert: '90' }])
    expect(a).toEqual(kopie)
  })

  it('zusammenführbar: Zwei Geräte erfassen verschiedene Listen – die Reihenfolge ist egal', () => {
    const steg = [{ lauf: L1, starter: 's1', feld: 'katalog:stegAnlegen', wert: '9' }, { lauf: L1, starter: 's2', feld: erfasstKennung('steg'), wert: '1' }]
    const tor = [{ lauf: L1, starter: 's1', feld: 't1a|hin seiteA', wert: '5' }, { lauf: L1, starter: 's2', feld: 't1a|hin seiteA', wert: 'G' }]
    expect(setzeWerte(setzeWerte({}, steg), tor)).toEqual(setzeWerte(setzeWerte({}, tor), steg))
  })
})

describe('Aufräumen', () => {
  const voll = setzeWerte({}, [
    { lauf: L1, starter: 's1', feld: 'zeit1', wert: '80' },
    { lauf: L1, starter: 's2', feld: 'zeit1', wert: '81' },
    { lauf: laufSchluessel('manoevrieren', 2), starter: 's2', feld: 'zeit1', wert: '82' },
  ])

  it('nurStarter: Wer gelöscht ist, nimmt seine Werte mit', () => {
    expect(nurStarter(voll, new Set(['s1']))).toEqual({ [L1]: { s1: { zeit1: '80' } } })
    expect(nurStarter(voll, new Set(['s1', 's2']))).toBe(voll)
  })

  it('ohneLauf: ein Lauf oder alles', () => {
    expect(Object.keys(ohneLauf(voll, 2))).toEqual([L1])
    expect(ohneLauf(voll, 3)).toBe(voll)
    expect(ohneLauf(voll)).toEqual({})
  })

  it('normalisiereEingaben: nur brauchbare Zeichenketten überleben', () => {
    expect(normalisiereEingaben(undefined)).toEqual({})
    expect(normalisiereEingaben([1, 2])).toEqual({})
    expect(
      normalisiereEingaben({
        'manoevrieren/1': { s1: { zeit1: '80', leer: '', zahl: 5 }, s2: 'kaputt', s3: {} },
        ohneLauf: { s1: { zeit1: '80' } },
        'manoevrieren/2': null,
      }),
    ).toEqual({ 'manoevrieren/1': { s1: { zeit1: '80' } } })
  })
})

describe('vergleicheNr', () => {
  it('sortiert Startnummern natürlich', () => {
    expect(['E10', '401', 'E2', '99'].sort(vergleicheNr)).toEqual(['99', '401', 'E2', 'E10'])
  })
})
