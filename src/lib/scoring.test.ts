import { describe, expect, it } from 'vitest'
import { configFor } from '../config/konfig'
import { columnsForClass } from './bogen'
import { cellKey, scoreRow, summenText } from './scoring'

// Aus dem Fehlerpunkte-Prototyp übernommen; die Konfiguration ist hier eine reine Funktion.
const { getSheetDef, positionAllowsClass } = configFor()

function getter(values: Record<string, string>) {
  return (key: string) => values[key] ?? ''
}

describe('scoreRow - Tor-Liste (Bojen)', () => {
  const def = getSheetDef('gate135')

  it('summiert direkt eingegebene Bojen-Punkte (5, 10, 15)', () => {
    const nr = '301'
    const values = {
      [cellKey(nr, 'start', 0)]: '5',
      [cellKey(nr, 't1a', 0)]: '10',
      [cellKey(nr, 'ziel', 0)]: '5',
    }
    const r = scoreRow(def, nr, getter(values))
    expect(r.sum).toBe(20)
    expect(r.computedCols).toEqual({})
  })

  it('erkennt Disqualifikations-Buchstaben in einer Tor-Zelle', () => {
    const nr = '302'
    const values = {
      [cellKey(nr, 't3a', 1)]: 'G', // Disq an Tor 3 H H
      [cellKey(nr, 'start', 0)]: '5',
    }
    const r = scoreRow(def, nr, getter(values))
    expect(r.sum).toBe(5)
    expect(r.disqs).toHaveLength(1)
    expect(r.disqs[0].code).toBe('G')
    expect(r.disqs[0].where).toContain('Tor 3')
  })
})

describe('scoreRow - Mann-über-Bord (Fehlercodes → Punkte)', () => {
  const def = getSheetDef('mueb')

  it('mappt Codes auf Punkte und füllt Fehlerpunkte + Σ', () => {
    const nr = '401'
    const values = { [cellKey(nr, 'fehler')]: '13, 17' } // 5 + 5
    const r = scoreRow(def, nr, getter(values))
    expect(r.sum).toBe(10)
    expect(r.computedCols['fp']).toBe(10)
  })

  it('nimmt den Disq-Buchstaben aus der Disq-Spalte auf', () => {
    const nr = '402'
    const values = { [cellKey(nr, 'disq')]: 'F' }
    const r = scoreRow(def, nr, getter(values))
    expect(r.disqs[0].code).toBe('F')
  })
})

describe('scoreRow - Steg (zwei Fehlergruppen, unterschiedliche Gewichte)', () => {
  const def = getSheetDef('steg')

  it('rechnet AB und AN getrennt in ihre Punkte-Spalten', () => {
    const nr = '303'
    const values = {
      [cellKey(nr, 'fehlerAB')]: '3', // 5
      [cellKey(nr, 'fehlerAN')]: '9, 12', // 10 + 10
    }
    const r = scoreRow(def, nr, getter(values))
    expect(r.computedCols['fpab']).toBe(5)
    expect(r.computedCols['fpan']).toBe(20)
    expect(r.sum).toBe(25)
  })

  it('wertet nur den eigenen Spalten-Katalog: AN-Code in AB zählt nicht', () => {
    const nr = '304'
    // 12 gehört zu Anlegen; in der Ablegen-Spalte darf es keine Punkte geben.
    const r = scoreRow(def, nr, getter({ [cellKey(nr, 'fehlerAB')]: '12' }))
    expect(r.computedCols['fpab'] ?? 0).toBe(0)
    expect(r.sum).toBe(0)
  })

  it('erkennt einen Disqualifikations-Buchstaben in einer Fehler-Spalte', () => {
    const nr = '306'
    const r = scoreRow(def, nr, getter({ [cellKey(nr, 'fehlerAN')]: '9, K' }))
    expect(r.sum).toBe(10) // nur Code 9 gibt Punkte
    expect(r.disqs.map((d) => d.code)).toContain('K')
    expect(r.disqs[0].where).toContain('Fehler AN')
  })
})

describe('columnsForClass - Speed/MüB je Klasse, Tor-Bojen immer', () => {
  const keys = (id: string, kl: string) =>
    columnsForClass(getSheetDef(id).columns, kl).map((c) => c.key)

  it('Berlin Links: Speed 0 (Kl 3) / 1 (Kl 5, 6) / 2 (Kl 7)', () => {
    expect(keys('blinks', '3')).not.toContain('speed1')
    expect(keys('blinks', '5')).toContain('speed1')
    expect(keys('blinks', '5')).not.toContain('speed2')
    expect(keys('blinks', '6')).toContain('speed1')
    expect(keys('blinks', '7')).toContain('speed2')
  })

  it('Tor 2 / 4 / 5: Speed 1 ab Klasse 5 (alle Varianten)', () => {
    for (const id of ['gate245', 'gate245os', 'frontal245']) {
      expect(keys(id, '4')).not.toContain('speed1')
      expect(keys(id, '5')).toContain('speed1')
      expect(keys(id, '7')).toContain('speed1')
    }
    // Reihenfolge wie auf der Papierliste: nach Tor 2 (Rückfahrt), vor Ziel.
    expect(keys('gate245', '5').slice(-5)).toEqual(['t2b', 'speed1', 'ziel', 'disq', 'sum'])
  })

  it('Tor 1 / 3 / 5: nur Klasse 7 mit Speed 2 und zweitem Tor 1', () => {
    for (const id of ['gate135', 'gate135os', 'frontal135']) {
      expect(keys(id, '6')).not.toContain('speed2')
      expect(keys(id, '6')).not.toContain('t1c')
    }
    expect(keys('gate135', '7').slice(-6)).toEqual(['t1b', 'speed2', 't1c', 'ziel', 'disq', 'sum'])
    expect(keys('gate135os', '7').slice(-5)).toEqual(['t1b', 'speed2', 't1c', 'disq', 'sum'])
  })

  it('Klasse 4 fährt auf der Rückfahrt nicht durch Tor 1', () => {
    for (const id of ['gate135', 'gate135os', 'frontal135', 'brechts', 'bawueland1', 'bawuewasser1']) {
      expect(keys(id, '4')).not.toContain('t1b')
      expect(keys(id, '3')).toContain('t1b')
    }
    // Wie Excel und die alte Papierliste: … Tor 5, Tor 3, Ziel.
    expect(keys('gate135', '4').slice(-5)).toEqual(['t5', 't3b', 'ziel', 'disq', 'sum'])
  })

  it('Berlin Rechts: MüB erst ab Klasse 4', () => {
    expect(keys('brechts', '3')).not.toContain('fehler')
    expect(keys('brechts', '4')).toContain('fehler')
  })

  it('Tor-Bojen bleiben in jeder Klasse (auch E)', () => {
    expect(keys('blinks', 'E')).toEqual(expect.arrayContaining(['t2a', 't4a', 't5a', 't5b', 't2b']))
    expect(keys('brechts', 'E')).toEqual(expect.arrayContaining(['t1a', 't3a', 't1b']))
  })

  it('positionAllowsClass: MüB-Blatt erst ab Klasse 4', () => {
    expect(positionAllowsClass('mueb', 'E')).toBe(false)
    expect(positionAllowsClass('mueb', '3')).toBe(false)
    expect(positionAllowsClass('mueb', '4')).toBe(true)
    expect(positionAllowsClass('mueb', '7')).toBe(true)
    // Positionen ohne klassen gelten für alle
    expect(positionAllowsClass('zeit', 'E')).toBe(true)
    expect(positionAllowsClass('steg', '3')).toBe(true)
  })
})

describe('scoreRow - Tor 5 (Code 1 = 20 Punkte)', () => {
  it('mappt Code 1 auf 20', () => {
    const def = getSheetDef('tor5')
    const nr = '305'
    const r = scoreRow(def, nr, getter({ [cellKey(nr, 'fehler')]: '1' }))
    expect(r.sum).toBe(20)
    expect(r.computedCols['fp']).toBe(20)
  })
})

describe('Fehlerpunkte einzeln', () => {
  const nr = '401'

  it('MüB: Punkte in der Reihenfolge der Codes, Σ als Summe', () => {
    const r = scoreRow(getSheetDef('mueb'), nr, getter({ [cellKey(nr, 'fehler')]: '13, 14' }))
    expect(summenText(r, 'fp')).toBe('5 + 5')
    expect(summenText(r, 'sum')).toBe('10')
  })

  it('Steg: je Richtung einzeln, auch mit Mehrfachnennung, Σ über beide', () => {
    const r = scoreRow(
      getSheetDef('steg'),
      nr,
      getter({ [cellKey(nr, 'fehlerAB')]: '3, 2x6', [cellKey(nr, 'fehlerAN')]: '9' }),
    )
    expect(summenText(r, 'fpab')).toBe('5 + 2x5')
    expect(summenText(r, 'fpan')).toBe('10')
    expect(summenText(r, 'sum')).toBe('25')
  })

  it('Berlin Rechts: F-Pkt. einzeln, Σ inklusive der Bojen', () => {
    const def = getSheetDef('brechts')
    expect(def.columns.find((c) => c.key === 'fp')?.label).toBe('F-Pkt.')
    const r = scoreRow(def, nr, getter({ [cellKey(nr, 'fehler')]: '13, 14', [cellKey(nr, 't1a', 0)]: '5' }))
    expect(summenText(r, 'fp')).toBe('5 + 5')
    expect(summenText(r, 'sum')).toBe('15')
  })

  it('ein Fehler ist nur eine Zahl, keiner bleibt leer, Buchstaben zählen nicht', () => {
    const def = getSheetDef('mueb')
    expect(summenText(scoreRow(def, nr, getter({ [cellKey(nr, 'fehler')]: '13, G' })), 'fp')).toBe('5')
    expect(summenText(scoreRow(def, nr, getter({})), 'fp')).toBe('')
  })

  it('Tor 5: einzeln, Σ als Summe, in allen Listen', () => {
    for (const id of ['tor5', 'tor5pue', 'tor5puems', 'blinks']) {
      const r = scoreRow(getSheetDef(id), nr, getter({ [cellKey(nr, 'fehler')]: '1, 2' }))
      expect(summenText(r, 'fp'), id).toBe('20 + 5')
      expect(summenText(r, 'sum'), id).toBe('25')
    }
    const land2 = getSheetDef('bawueland2')
    expect(land2.columns.find((c) => c.key === 'fp')?.label).toBe('F-Pkt.')
    const r = scoreRow(land2, nr, getter({ [cellKey(nr, 'fehler')]: '1, 2' }))
    expect(summenText(r, 'fp')).toBe('20 + 5')
    expect(summenText(r, 'sum')).toBe('25')
  })
})
