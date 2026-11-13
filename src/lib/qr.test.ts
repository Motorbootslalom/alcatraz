import { describe, expect, it } from 'vitest'
import { KENNUNG_ZEICHEN, QR_RAND, bogenCode, istKennung, laufzettelCode, leseCode, musterCode, neueKennung, qrModules, qrPfad, seitenCode, type QrBekannt } from './qr'

const kontext = { kennung: 'K7Q4', regelwerk: 'dm-2026', aufbau: 'alcatraz' }
const bekannt: QrBekannt = {
  ...kontext,
  regelwerke: ['dm-2026', 'uim-2026'],
  aufbauten: ['alcatraz', 'bawue', 'moewe'],
  parcours: ['par_1', 'par_2', 'p_x9zy'],
  listen: ['zeit', 'zeit-2', 'steg', 'tor135', 'knoten'],
  laufCount: 3,
}
const fehler = (code: string, b: QrBekannt = bekannt) => {
  const l = leseCode(code, b)
  return l.ok ? 'ok' : l.fehler.art
}

describe('laufzettelCode / bogenCode', () => {
  it('kodiert Veranstaltung, Regelwerk, Aufbau, Parcours, Klassen und Lauf', () => {
    expect(laufzettelCode(kontext, { parcoursId: 'par_1', klassen: ['3'], lauf: 1 })).toBe('ALC1.K7Q4.DM2026.ALCATRAZ.PAR1.3.1')
  })

  it('hängt bei Bögen die Liste an, je Druckseite die Seite', () => {
    const code = bogenCode(kontext, { parcoursId: 'par_2', klassen: ['E'], lauf: 2, typeId: 'steg' })
    expect(code).toBe('ALC1.K7Q4.DM2026.ALCATRAZ.PAR2.E.2.STEG')
    expect(seitenCode(code, 2)).toBe('ALC1.K7Q4.DM2026.ALCATRAZ.PAR2.E.2.STEG.S2')
  })

  it('gemeinsamer Bogen (Clubmeisterschaft): die Klassen aneinandergereiht, in fester Reihenfolge', () => {
    expect(bogenCode(kontext, { parcoursId: 'par_1', klassen: ['4', 'E', '1', '7'], lauf: 1, typeId: 'zeit-2' })).toBe('ALC1.K7Q4.DM2026.ALCATRAZ.PAR1.E147.1.ZEIT2')
  })

  it('nutzt die Kennung des Parcours, nicht seinen Namen – Umbenennen ändert den Code nicht', () => {
    // Der Name kommt im Code gar nicht vor; nur die Kennung.
    expect(laufzettelCode(kontext, { parcoursId: 'p_x9zy', klassen: ['5'], lauf: 3 })).toBe('ALC1.K7Q4.DM2026.ALCATRAZ.PX9ZY.5.3')
  })

  it('nutzt nur Zeichen, die jede Tastaturbelegung gleich tippt; ohne Kennung steht „0“', () => {
    const code = seitenCode(bogenCode({ ...kontext, kennung: '' }, { parcoursId: 'par_1', klassen: ['7'], lauf: 3, typeId: 'tor135' }), 12)
    expect(code).toMatch(/^[A-Z0-9.]+$/)
    expect(code.split('.')[1]).toBe('0')
    expect(leseCode(code, { ...bekannt, kennung: '' }).ok).toBe(true)
  })
})

describe('Kennung der Veranstaltung', () => {
  it('ist zufällig aus Zeichen ohne Y, Z, 0, O, 1, I – und bei gleichem Zufall gleich', () => {
    let i = 0
    const zufall = () => [0, 0.5, 0.999, 0.25][i++ % 4]
    const k = neueKennung(zufall)
    expect(k).toHaveLength(4)
    expect([...k].every((z) => KENNUNG_ZEICHEN.includes(z))).toBe(true)
    expect(KENNUNG_ZEICHEN).not.toMatch(/[YZ0O1I]/)
    i = 0
    expect(neueKennung(zufall)).toBe(k)
    expect(istKennung(k)).toBe(true)
  })

  it('erkennt Unbrauchbares', () => {
    for (const x of ['', 'a1b2', 'K7.Q4', 'MUSTER', 42, null, undefined]) expect(istKennung(x), String(x)).toBe(false)
  })
})

describe('leseCode', () => {
  it('liest den eigenen Code eines Laufzettels zurück', () => {
    expect(leseCode(laufzettelCode(kontext, { parcoursId: 'par_2', klassen: ['4', '5'], lauf: 3 }), bekannt)).toEqual({
      ok: true,
      ziel: { parcoursId: 'par_2', klassen: ['4', '5'], lauf: 3 },
    })
  })

  it('liest Bögen mit Liste und Seite zurück – jede Liste, jede Parcours-Kennung', () => {
    for (const typeId of bekannt.listen) {
      for (const parcoursId of bekannt.parcours) {
        const code = seitenCode(bogenCode(kontext, { parcoursId, klassen: ['E', '1'], lauf: 2, typeId }), 4)
        expect(leseCode(code, bekannt), code).toEqual({ ok: true, ziel: { parcoursId, klassen: ['E', '1'], lauf: 2, typeId, seite: 4 } })
      }
    }
  })

  it('ist unempfindlich gegen Kleinschreibung und Leerraum', () => {
    expect(fehler('  alc1.k7q4.dm2026.alcatraz.par1.3.1\n')).toBe('ok')
    expect(fehler('ALC1.K7Q4.DM2026. ALCATRAZ.PAR1.3.1')).toBe('ok')
  })

  it('liest ab dem Anfang des Codes, wenn der Scanner eine Kennung der Code-Art voranstellt', () => {
    expect(leseCode(']Q1ALC1.K7Q4.DM2026.ALCATRAZ.PAR2.4.1.ZEIT.S1', bekannt)).toEqual({ ok: true, ziel: { parcoursId: 'par_2', klassen: ['4'], lauf: 1, typeId: 'zeit', seite: 1 } })
    expect(fehler(']Q1FP2.DM2026.ALCATRAZ.3.1')).toBe('prototyp')
    expect(fehler(']Q14006381333931')).toBe('fremd')
  })

  it('verkraftet vertauschtes Y/Z (Scanner und PC mit anderer Tastatur)', () => {
    // Der Scanner vertauscht dann JEDES Y und Z: im Aufbau, in der Liste und in der Kennung des Parcours.
    const lesung = leseCode('ALC1.K7Q4.DM2026.ALCATRAY.PX9YZ.3.1.YEIT.S1', bekannt)
    expect(lesung).toEqual({ ok: true, ziel: { parcoursId: 'p_x9zy', klassen: ['3'], lauf: 1, typeId: 'zeit', seite: 1 } })
    // Scheitert auch der zweite Versuch, wird der Fehler gemeldet, der weiter kam (hier: der Parcours, nicht der Aufbau).
    expect(fehler('ALC1.K7Q4.DM2026.ALCATRAY.PAR9.3.1')).toBe('parcours')
  })

  it('weist einen Code einer anderen Veranstaltung ab und nennt deren Kennung', () => {
    expect(leseCode('ALC1.ABCD.DM2026.ALCATRAZ.PAR1.3.1', bekannt)).toEqual({ ok: false, fehler: { art: 'veranstaltung', wert: 'ABCD' } })
    // Auch ein Stand ohne Kennung nimmt keinen Bogen mit Kennung an – und umgekehrt.
    expect(fehler('ALC1.K7Q4.DM2026.ALCATRAZ.PAR1.3.1', { ...bekannt, kennung: '' })).toBe('veranstaltung')
    expect(fehler('ALC1.0.DM2026.ALCATRAZ.PAR1.3.1')).toBe('veranstaltung')
  })

  it('weist ein anderes Regelwerk und einen anderen Aufbau ab und nennt sie, wenn sie bekannt sind', () => {
    expect(leseCode('ALC1.K7Q4.UIM2026.ALCATRAZ.PAR1.3.1', bekannt)).toEqual({ ok: false, fehler: { art: 'regelwerk', wert: 'UIM2026', id: 'uim-2026' } })
    expect(leseCode('ALC1.K7Q4.DM2026.BAWUE.PAR1.3.1.STEG.S1', bekannt)).toEqual({ ok: false, fehler: { art: 'aufbau', wert: 'BAWUE', id: 'bawue' } })
    expect(leseCode('ALC1.K7Q4.DM2026.EIGENER.PAR1.3.1', bekannt)).toEqual({ ok: false, fehler: { art: 'aufbau', wert: 'EIGENER', id: undefined } })
  })

  it('der Code einer Beispielansicht trifft keinen Bogen', () => {
    const code = seitenCode(musterCode(kontext, { parcoursId: 'par_1', klassen: ['3'], lauf: 1, typeId: 'zeit' }), 1)
    expect(code).toBe('ALC1.MUSTER.DM2026.ALCATRAZ.PAR1.3.1.ZEIT.S1')
    expect(fehler(code)).toBe('muster')
    // … auch nicht in einer Veranstaltung ohne Kennung oder wenn er abgeschnitten ist.
    expect(fehler(code, { ...bekannt, kennung: '' })).toBe('muster')
    expect(fehler('ALC1.MUSTER.DM2026')).toBe('muster')
  })

  it('nennt den Grund, wenn ein Code nicht passt', () => {
    expect(fehler('')).toBe('leer')
    expect(fehler('   ')).toBe('leer')
    expect(fehler('4006381333931')).toBe('fremd')
    expect(fehler('https://example.org/x')).toBe('fremd')
    expect(fehler('FP2.DM2026.ALCATRAZ.3.1.ZEIT.S1')).toBe('prototyp')
    expect(fehler('ALC2.K7Q4.DM2026.ALCATRAZ.PAR1.3.1')).toBe('fassung')
    expect(fehler('ALC1.K7Q4.DM2026.ALCATRAZ.PAR1.3')).toBe('kaputt')
    expect(fehler('ALC1.K7Q4.DM2026.ALCATRAZ.PAR1.3.1.STEG')).toBe('kaputt')
    expect(fehler('ALC1.K7Q4.DM2026.ALCATRAZ.PAR1.3.1.STEG.S0')).toBe('kaputt')
    // Eine Seitenzahl mit mehr als drei Stellen gibt es nicht.
    expect(fehler('ALC1.K7Q4.DM2026.ALCATRAZ.PAR1.3.1.STEG.S1000')).toBe('kaputt')
    expect(fehler('ALC1.K7Q4.DM2026.ALCATRAZ.PAR1.3.1.STEG.S999999999999999999999')).toBe('kaputt')
    expect(fehler('ALC1.K7Q4.DM2026.ALCATRAZ.PAR1.3.1.STEG.2')).toBe('kaputt')
    expect(fehler('ALC1.K7Q4.DM2026.ALCATRAZ.PAR1.3.1.STEG.S1.X')).toBe('kaputt')
    expect(fehler('ALC1.K7Q4.DM2026.ALCATRAZ.PAR1.3.1;STEG')).toBe('kaputt')
    expect(fehler('ALC1.K7Q4.DM2026.ALCATRAZ.PAR9.3.1')).toBe('parcours')
    expect(fehler('ALC1.K7Q4.DM2026.ALCATRAZ.PAR1.A.1')).toBe('klasse')
    expect(fehler('ALC1.K7Q4.DM2026.ALCATRAZ.PAR1.33.1')).toBe('klasse')
    expect(fehler('ALC1.K7Q4.DM2026.ALCATRAZ.PAR1.3.0')).toBe('lauf')
    expect(fehler('ALC1.K7Q4.DM2026.ALCATRAZ.PAR1.3.4')).toBe('lauf')
    expect(fehler('ALC1.K7Q4.DM2026.ALCATRAZ.PAR1.3.X')).toBe('lauf')
    expect(fehler('ALC1.K7Q4.DM2026.ALCATRAZ.PAR1.3.1.TOR9.S1')).toBe('liste')
  })

  it('zwei Kennungen mit demselben Code-Teil gelten als unbekannt statt die falsche zu treffen', () => {
    expect(fehler('ALC1.K7Q4.DM2026.ALCATRAZ.PAR1.3.1', { ...bekannt, parcours: ['par_1', 'par1'] })).toBe('parcours')
  })
})

describe('QR-Bild', () => {
  const code = 'ALC1.K7Q4.DM2026.ALCATRAZ.PAR1.E1234567.3.TOR135.S12'

  it('nutzt für unsere Codes den kompakten alphanumerischen Modus', () => {
    // 29 × 29 Kästchen (Version 3); im Byte-Modus wären es 33 × 33.
    expect(qrModules(code)).toHaveLength(29)
    expect(qrModules(code.toLowerCase())).toHaveLength(33)
  })

  it('der Pfad deckt genau die dunklen Module, mit hellem Rand ringsum', () => {
    const module = qrModules(code)
    const { groesse, pfad } = qrPfad(code)
    expect(groesse).toBe(module.length + 2 * QR_RAND)
    // Aus dem Pfad zurückgerechnet: Jedes Rechteck „Mx yhBv1h-Bz“ füllt B Module der Zeile y.
    const bild = module.map((z) => z.map(() => false))
    for (const [, x, y, b] of pfad.matchAll(/M(\d+) (\d+)h(\d+)v1h-\d+z/g)) {
      for (let i = 0; i < Number(b); i++) bild[Number(y) - QR_RAND][Number(x) - QR_RAND + i] = true
    }
    expect(bild).toEqual(module)
    // Die drei Suchmuster in den Ecken: 7 dunkle Module am Anfang der ersten Zeile.
    expect(module[0].slice(0, 7).every(Boolean)).toBe(true)
    expect(module[0][7]).toBe(false)
  })
})
