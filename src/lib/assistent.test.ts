import { describe, expect, it } from 'vitest'
import { ROH_QUELLE } from '../config/konfig'
import { feldKennungen } from '../config/feld'
import { aufloesen, istInlineKurzform, kurzformPosition } from '../config/kurzform'
import type { RawKurzform, RawPosition } from '../config/schema'
import { ausAufbau, befund, leererEntwurf, namensteil, neueId, umschalten, ZEILEN, zuAufbau, type Entwurf } from './assistent'

const zeile = (id: string) => ZEILEN.find((z) => z.id === id)!

/** Was eine Liste je Klasse erfasst, ohne die Felder, die zur Liste selbst gehören (Disq., Bemerkung). */
function erfasst(p: RawPosition) {
  return ['E', '4', '5', '7'].map((klasse) =>
    p.spalten
      .filter((s) => ['boje', 'code', 'zeit'].includes(s.typ) && (!s.klassen || s.klassen.map(String).includes(klasse)))
      .flatMap((s) => feldKennungen(s, p.katalog)),
  )
}

describe('Assistent: Entwurf und Aufbau', () => {
  it('ergibt aus dem Möwe-Aufbau als Vorlage wieder dieselben Listen', () => {
    const quelle = ROH_QUELLE
    const moewe = quelle.aufbauten!.find((a) => a.id === 'moewe')!
    let n = 0
    const { entwurf, nichtUebernommen } = ausAufbau(moewe, quelle, { id: 'probe', name: 'Probe' }, () => `p${++n}`)
    expect(nichtUebernommen).toEqual([])
    expect(entwurf.steg).toBe(true)
    expect(entwurf.kurs).toBe('moewe')

    const aufbau = zuAufbau(entwurf)
    const neu: Array<string | RawPosition> = aufbau.positionen.map((e) =>
      istInlineKurzform(e) ? kurzformPosition(e as RawKurzform) : (e as string),
    )
    const alt = aufloesen(quelle).positionen
    const original = moewe.positionen.map((id) => alt.find((p) => p.id === id)!)
    expect(neu.map((p) => (typeof p === 'string' ? p : p.titel))).toEqual(original.map((p) => (p.id === 'steg' ? 'steg' : p.titel)))
    neu.forEach((p, i) => {
      if (typeof p === 'string') return
      expect(erfasst(p), original[i].id).toEqual(erfasst(original[i]))
      expect(p.bildDrehung, original[i].id).toBe(original[i].bildDrehung)
    })
  })

  it('setzt mit einem Klick beide Bojen eines Tores, aufgeklappt eine einzelne', () => {
    let e = { ...leererEntwurf('x', 'X'), spalten: [{ id: 'a', titel: 'A' }] }
    e = umschalten(e, zeile('Tor1'), 'a')
    expect(e.zuordnung).toMatchObject({ Tor1_aussen: ['a'], Tor1_innen: ['a'] })
    e = umschalten(e, zeile('Tor1'), 'a', 'Tor1_innen')
    expect(e.zuordnung.Tor1_innen).toEqual([])
    expect(zuAufbau(e).positionen).toContainEqual(expect.objectContaining({ id: 'a', bojen: ['Tor1_aussen'] }))
    e = umschalten(e, zeile('Tor1'), 'a', 'Tor1_innen')
    expect(zuAufbau(e).positionen).toContainEqual(expect.objectContaining({ bojen: ['Tor1'] }))
  })

  it('meldet Lücken, doppelte Felder und leere Spalten', () => {
    let e = { ...leererEntwurf('x', 'X'), spalten: [{ id: 'a', titel: 'A' }, { id: 'b', titel: 'B' }, { id: 'c', titel: 'C' }] }
    e = umschalten(e, zeile('Tor2'), 'a')
    e = umschalten(e, zeile('Tor2'), 'b', 'Tor2_innen')
    const b = befund(e)
    expect(b.doppelt).toEqual(['Tor2_innen'])
    expect(b.leer).toEqual(['c'])
    expect(b.fehlt).toContain('Tor1_innen')
    expect(b.fehlt).not.toContain('Tor2_aussen')
    expect(b.fehlt).not.toContain('parcours') // freiwillig
    // Leere Spalten entfallen im Aufbau.
    expect(zuAufbau(e).positionen.map((p) => (typeof p === 'string' ? p : p.id))).toEqual(['steg', 'a', 'b'])
  })

  it('ordnet Zeitlisten vor den Steg, die übrigen dahinter, Knoten ans Ende', () => {
    let e: Entwurf = {
      ...leererEntwurf('x', 'X'),
      vorsteg: true,
      knoten: true,
      spalten: [
        { id: 'a', titel: 'Tore' },
        { id: 'z', titel: '', zeiten: ['elektronisch'] },
      ],
    }
    e = umschalten(e, zeile('StartZiel'), 'z')
    e = umschalten(e, zeile('Tor3'), 'a')
    const a = zuAufbau(e)
    expect(a.positionen.map((p) => (typeof p === 'string' ? p : p.id))).toEqual(['z', 'vorsteg', 'steg', 'a', 'knoten'])
    expect(a.positionen[0]).toMatchObject({ titel: 'Elektronische Zeiterfassung', aufgaben: ['zeit'], zeiten: ['elektronisch'], bojen: ['StartZiel'] })
  })
})

describe('IDs', () => {
  it('bildet aus dem Namen einen Anfang aus Kleinbuchstaben und Ziffern', () => {
    expect(namensteil('Möwe-Cup 2026 Süß')).toBe('moewecup2026')
    expect(namensteil('!!!')).toBe('aufbau')
  })

  it('vergibt jede ID nur einmal', () => {
    const vergeben = new Set(['abyyyy'])
    const wuerfel = [0.7, 0.7, 0.7, 0.7, 0.1, 0.2, 0.3, 0.4] // erst „yyyy“ (vergeben), dann „dgkn“ …
    let i = 0
    const id = neueId('ab', vergeben, () => wuerfel[i++])
    expect(i).toBe(8)
    expect(id).toMatch(/^ab[a-z0-9]{4}$/)
    expect(id).not.toBe('abyyyy')
    expect(vergeben.has(id)).toBe(true)
  })

  it('setzt keinen Ersatznamen: Ein leerer Name bleibt leer und fällt der Prüfung auf', () => {
    expect(zuAufbau(leererEntwurf('e1', '   ')).name).toBe('')
    expect(zuAufbau(leererEntwurf('e1', ' Hafenfest ')).name).toBe('Hafenfest')
  })
})
