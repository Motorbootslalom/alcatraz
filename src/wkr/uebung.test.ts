import { describe, expect, it } from 'vitest'
import { NACHNAMEN, VORNAMEN_M, VORNAMEN_W } from '../data/names'
import { WKR_ANNAHMEN } from './annahmen'
import { maskeFuer } from './maske'
import { LISTEN_SICHT_FASSUNG } from './sicht'
import { uebungsSchritt, uebungsSicht, uebungsStand } from './uebung'

// Übung ohne Netz (W3.1, G13): Sicht wie vom Bedienrechner (`lv`, Masken), erfundene Starts ohne Namen, Schritt.

describe('Übungs-Sicht', () => {
  it('Fassung und Form wie die echte Sicht; Sprache des Regelwerks; Masken für jede Klasse der Starts', () => {
    const dm = uebungsSicht(uebungsStand('dm-2026', 'tor5'))
    expect(dm.lv).toBe(LISTEN_SICHT_FASSUNG)
    expect([dm.sprache, dm.modus, dm.status, dm.punkt?.id]).toEqual(['de', 'digital', 'aktiv', 'lauf:1'])
    expect(dm.andere).toBeUndefined()
    expect(dm.schlange.map((s) => s.startNr)).toEqual(['1', '2'])
    expect(dm.danach.map((s) => s.startNr)).toEqual(['3', '4', '5', '6', '7'])
    for (const s of [...dm.schlange, ...dm.danach]) expect(maskeFuer(dm, s.klasse)?.art).toBe('katalog')
    const uim = uebungsSicht(uebungsStand('uim-2026', 'steg'))
    expect([uim.sprache, uim.andere?.sprache]).toEqual(['en', 'de'])
    expect(uim.teile).toEqual({ ab: { status: 'aktiv', abgeschlossen: [] }, an: { status: 'aktiv', abgeschlossen: [] } })
    expect(uim.schlange[0].teile).toEqual({ ab: false, an: false })
  })

  it('MüB: nur Klassen, die die Liste haben (keine „entfällt“ in der Übung); Vorsteg sieht zwei vorab', () => {
    const mueb = uebungsSicht(uebungsStand('dm-2026', 'mueb'))
    for (const s of [...mueb.schlange, ...mueb.danach]) expect(mueb.klassen[s.klasse]!.felder).not.toBeNull()
    const vorsteg = uebungsSicht(uebungsStand('dm-2026', 'vorsteg'))
    expect(vorsteg.schlange.map((s) => [s.startNr, !!s.vorab])).toEqual([['1', false], ['2', false], ['3', true], ['4', true]])
    expect(vorsteg.danach[0].startNr).toBe('5')
  })

  it('ohne Namen: kein erfundener Vor- oder Nachname aus src/data, kein Boot-Text', () => {
    const text = JSON.stringify([uebungsSicht(uebungsStand('dm-2026', 'steg')), uebungsSicht(uebungsStand('uim-2026', 'vorsteg'))])
    const namen = [...VORNAMEN_M, ...VORNAMEN_W, ...NACHNAMEN].filter((n) => n.length > 3)
    for (const n of namen) expect(text, n).not.toContain(`"${n}`)
    expect(text).not.toContain('"boot"')
  })
})

describe('Übung mit Bojen-Listen (W4.1, P12)', () => {
  it('Tor 1/3/5, Tor 2/4/5, Parcours mit Start/Ziel (DM) und Parallelslalom (UIM): Bojen-Masken, ohne Namen und Boot', () => {
    for (const [regelwerk, typeId] of [['dm-2026', 'gate135'], ['dm-2026', 'gate245'], ['dm-2026', 'parcoursms'], ['uim-2026', 'gate135'], ['uim-2026', 'parallelparcours']] as const) {
      const sicht = uebungsSicht(uebungsStand(regelwerk, typeId))
      expect(sicht.lv, typeId).toBe(LISTEN_SICHT_FASSUNG)
      for (const s of [...sicht.schlange, ...sicht.danach]) {
        const m = maskeFuer(sicht, s.klasse)!
        expect(m.art, `${regelwerk}/${typeId}/${s.klasse}`).toBe('bojen')
        expect(m.abschnitte.length).toBeGreaterThan(0)
      }
      const text = JSON.stringify(sicht)
      const namen = [...VORNAMEN_M, ...VORNAMEN_W, ...NACHNAMEN].filter((n) => n.length > 3)
      for (const n of namen) expect(text, n).not.toContain(`"${n}`)
      expect(text).not.toContain('"boot"')
    }
  })
})

describe('Übungs-Schritt', () => {
  it('erledigter Start fällt weg, der nächste rückt nach; Takt zeigt weitere, höchstens die Schlange', () => {
    let st = uebungsStand('dm-2026', 'tor5')
    const erster = uebungsSicht(st).schlange[0].key
    st = uebungsSchritt(st, { s: erster })
    expect(uebungsSicht(st).schlange.map((s) => s.startNr)).toEqual(['2', '3'])
    st = uebungsSchritt(st, null)
    expect(uebungsSicht(st).schlange.map((s) => s.startNr)).toEqual(['2', '3', '4'])
    for (let i = 0; i < 30; i++) st = uebungsSchritt(st, null)
    expect(uebungsSicht(st).schlange).toHaveLength(WKR_ANNAHMEN.schlange)
    // Unbekannte Kennung: nichts ändert sich.
    expect(uebungsSchritt(st, { s: 'kaputt' })).toBe(st)
    expect(uebungsSchritt(st, { s: erster })).toBe(st)
  })

  it('Steg je Teil: Ablegen allein lässt den Start stehen, Anlegen schließt ihn', () => {
    let st = uebungsStand('dm-2026', 'steg')
    const k = uebungsSicht(st).schlange[0].key
    st = uebungsSchritt(st, { s: k, teil: 'ab' })
    expect(uebungsSicht(st).schlange[0]).toMatchObject({ key: k, teile: { ab: true, an: false } })
    st = uebungsSchritt(st, { s: k, teil: 'an' })
    expect(uebungsSicht(st).schlange.map((s) => s.key)).not.toContain(k)
  })

  it('Vorsteg: eine Zeile für einen vorab gesehenen Start zeigt ihn; nach Nr. 20 beginnt der 2. Lauf', () => {
    let st = uebungsStand('dm-2026', 'vorsteg')
    const vorab = uebungsSicht(st).schlange.find((s) => s.vorab)!
    st = uebungsSchritt(st, { s: vorab.key })
    const sicht = uebungsSicht(st)
    expect(sicht.schlange.filter((s) => !s.vorab).map((s) => s.startNr)).toEqual(['1', '2'])
    expect(sicht.schlange.filter((s) => s.vorab).map((s) => s.startNr)).toEqual(['4', '5'])
    let t = uebungsStand('dm-2026', 'tor5')
    for (let i = 0; i < 25; i++) t = uebungsSchritt(t, { s: uebungsSicht(t).schlange[0].key })
    const spaet = uebungsSicht(t)
    expect(spaet.punkt?.id).toBe('lauf:2')
    expect(spaet.schlange[0].titel).toBe('2. Lauf')
  })
})
