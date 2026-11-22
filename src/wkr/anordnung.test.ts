import { describe, expect, it } from 'vitest'
import { anordnung, anordnungsArt, spaltenPlatz, type GeraeteArt } from './anordnung'
import { MASKEN_GEBAUT, MASKEN_WAHL, erlaubteMasken, maskeAufGeraet, vorgabeMaske, wirksameMaske } from './maskenWahl'
import { MASKEN_VORGABEN } from '../geraete/aufgaben'
import { WKR_ANNAHMEN } from './annahmen'

/** Anordnung der WKR-Maske (W5.1, Plan docs/plan-wkr-w5.md §4.1, PD1–PD3, 22.11.2026). */

const L = ['tor5', 'mueb', 'tor135', 'vorsteg']

describe('anordnungsArt (PD1)', () => {
  it('Art aus der Kopplung vor der Fenstergröße; Rechner wie Pad; ohne Art die kürzere Seite ≥ 600 px', () => {
    expect(anordnungsArt(1366, 1024, 'handy')).toBe('handy')
    expect(anordnungsArt(390, 844, 'pad')).toBe('padHoch')
    expect(anordnungsArt(844, 390, 'rechner')).toBe('padQuer')
    expect(anordnungsArt(390, 844)).toBe('handy')
    expect(anordnungsArt(844, 390, null)).toBe('handy')
    expect(anordnungsArt(768, 1024)).toBe('padHoch')
    expect(anordnungsArt(1024, 768)).toBe('padQuer')
    expect(anordnungsArt(599, 1000)).toBe('handy')
    expect(anordnungsArt(600, 1000)).toBe('padHoch')
    expect(WKR_ANNAHMEN.padAbKurzeSeite).toBe(600)
  })
})

describe('anordnung (PD2, PD3)', () => {
  const groessen: [number, number][] = [
    [360, 640],
    [390, 844],
    [768, 1024],
    [1024, 768],
    [1366, 1024],
    [1024, 1366],
    [1920, 1080],
    [2560, 1440],
  ]
  const typen: (GeraeteArt | undefined)[] = [undefined, 'handy', 'pad', 'rechner']

  it('Tabelle Breite × Höhe × Art × Listen: nie mehr Spalten als Listen, nie > 4, hoch nie > 2, jede Liste genau einmal erreichbar', () => {
    for (const [breite, hoehe] of groessen)
      for (const typ of typen)
        for (let n = 1; n <= 4; n++) {
          const listen = L.slice(0, n)
          const a = anordnung({ breite, hoehe, typ, listen })
          const was = `${breite}×${hoehe} ${typ ?? '–'} ${n}`
          expect(a.spalten.length, was).toBeLessThanOrEqual(n)
          expect(a.spalten.length, was).toBeLessThanOrEqual(4)
          expect(a.spalten.length, was).toBeGreaterThanOrEqual(1)
          if (a.art === 'padHoch') expect(a.spalten.length, was).toBeLessThanOrEqual(2)
          if (a.art === 'handy') expect(a.spalten.length, was).toBe(1)
          expect(a.spalten.length, was).toBeLessThanOrEqual(spaltenPlatz(a.art, breite))
          // Erreichbar: fest in einer Spalte oder als Reiter der letzten.
          const fest = a.spalten.slice(0, a.reiter.length ? -1 : undefined).map((s) => s.liste)
          expect([...fest, ...a.reiter].sort(), was).toEqual([...listen].sort())
          if (a.reiter.length) expect(a.reiter[0], was).toBe(a.spalten[a.spalten.length - 1].liste)
          // Seitenspalte nur bei genau einer Spalte auf dem Pad (PD3).
          expect(a.seite, was).toBe(a.art === 'handy' || a.spalten.length > 1 ? null : a.art === 'padQuer' ? 'rechts' : 'unten')
        }
  })

  it('quer floor(Breite / 480), höchstens 4; hoch ab 360 px je Spalte, höchstens 2', () => {
    expect(spaltenPlatz('padQuer', 1024)).toBe(2)
    expect(spaltenPlatz('padQuer', 1366)).toBe(2)
    expect(spaltenPlatz('padQuer', 1440)).toBe(3)
    expect(spaltenPlatz('padQuer', 1920)).toBe(4)
    expect(spaltenPlatz('padQuer', 2560)).toBe(4)
    expect(spaltenPlatz('padQuer', 400)).toBe(1)
    expect(spaltenPlatz('padHoch', 768)).toBe(2)
    expect(spaltenPlatz('padHoch', 700)).toBe(1)
    expect(spaltenPlatz('padHoch', 1366)).toBe(2)
    expect(spaltenPlatz('handy', 2000)).toBe(1)
  })

  it('Handy: eine Spalte, mehrere Listen als Reiter wie bisher', () => {
    expect(anordnung({ breite: 390, hoehe: 844, typ: 'handy', listen: ['a'] })).toEqual({ art: 'handy', spalten: [{ liste: 'a' }], reiter: [], seite: null })
    expect(anordnung({ breite: 390, hoehe: 844, typ: 'handy', listen: ['a', 'b', 'c'] })).toEqual({ art: 'handy', spalten: [{ liste: 'a' }], reiter: ['a', 'b', 'c'], seite: null })
  })

  it('Pad quer 1024: zwei Listen nebeneinander ohne Seite; drei → zwei Spalten, die zweite mit Reitern', () => {
    expect(anordnung({ breite: 1024, hoehe: 768, typ: 'pad', listen: ['a'] })).toEqual({ art: 'padQuer', spalten: [{ liste: 'a' }], reiter: [], seite: 'rechts' })
    expect(anordnung({ breite: 1024, hoehe: 768, typ: 'pad', listen: ['a', 'b'] })).toEqual({ art: 'padQuer', spalten: [{ liste: 'a' }, { liste: 'b' }], reiter: [], seite: null })
    expect(anordnung({ breite: 1024, hoehe: 768, typ: 'pad', listen: ['a', 'b', 'c'] })).toEqual({ art: 'padQuer', spalten: [{ liste: 'a' }, { liste: 'b' }], reiter: ['b', 'c'], seite: null })
    expect(anordnung({ breite: 1920, hoehe: 1080, typ: 'rechner', listen: ['a', 'b', 'c'] }).spalten.map((s) => s.liste)).toEqual(['a', 'b', 'c'])
    expect(anordnung({ breite: 768, hoehe: 1024, typ: 'pad', listen: ['a'] }).seite).toBe('unten')
  })

  it('Steg ganz auf dem Pad: Ablegen und Anlegen als zwei Spalten; passt es nicht, ein Steg mit Reitern wie auf dem Handy', () => {
    expect(anordnung({ breite: 1024, hoehe: 768, typ: 'pad', listen: ['steg'], teile: ['steg'] })).toEqual({
      art: 'padQuer',
      spalten: [
        { liste: 'steg', teil: 'ab' },
        { liste: 'steg', teil: 'an' },
      ],
      reiter: [],
      seite: null,
    })
    // Zwei Listen auf 1024 px: der Steg bleibt eine Spalte (sonst ginge die andere Liste in einen Reiter).
    expect(anordnung({ breite: 1024, hoehe: 768, typ: 'pad', listen: ['steg', 'tor5'], teile: ['steg'] }).spalten).toEqual([{ liste: 'steg' }, { liste: 'tor5' }])
    expect(anordnung({ breite: 1920, hoehe: 1080, typ: 'pad', listen: ['steg', 'tor5'], teile: ['steg'] }).spalten).toEqual([{ liste: 'steg', teil: 'ab' }, { liste: 'steg', teil: 'an' }, { liste: 'tor5' }])
    // Handy: nie geteilt.
    expect(anordnung({ breite: 390, hoehe: 844, typ: 'handy', listen: ['steg'], teile: ['steg'] }).spalten).toEqual([{ liste: 'steg' }])
  })
})

describe('Maskenwahl (F14, MW1, 22.11.2026)', () => {
  it('dieselben Namen wie die Aufgaben (geraete/aufgaben.ts MASKEN_VORGABEN)', () => {
    expect([...MASKEN_WAHL]).toEqual([...MASKEN_VORGABEN])
  })

  it('Knöpfe immer, Bild nur Bojen-Listen; Vorgabe Pad + Bojen → Bild, sonst Knöpfe; Tabelle nie Vorgabe', () => {
    expect(erlaubteMasken({ bojen: false })).toEqual(['knoepfe', 'text'])
    expect(erlaubteMasken({ bojen: true })).toEqual(['knoepfe', 'bild', 'text'])
    expect(vorgabeMaske({ bojen: true, pad: true })).toBe('bild')
    expect(vorgabeMaske({ bojen: true, pad: false })).toBe('knoepfe')
    expect(vorgabeMaske({ bojen: false, pad: true })).toBe('knoepfe')
  })

  it('wirksam: fest vor Wahl vor Vorgabe; nicht Erlaubtes zählt nicht; nicht Gebautes zeigt Knöpfe', () => {
    const gebaut = (m: 'knoepfe' | 'bild' | 'text') => (MASKEN_GEBAUT[m] ? m : 'knoepfe')
    const bojenPad = { bojen: true, pad: true }
    expect(wirksameMaske(bojenPad, {})).toBe(gebaut('bild'))
    expect(wirksameMaske(bojenPad, { vorgabe: 'knoepfe', wahl: 'bild' })).toBe(gebaut('bild'))
    expect(wirksameMaske(bojenPad, { vorgabe: 'knoepfe', fest: true, wahl: 'bild' })).toBe('knoepfe')
    expect(wirksameMaske({ bojen: false, pad: true }, { wahl: 'bild' })).toBe('knoepfe')
    expect(wirksameMaske({ bojen: false, pad: true }, { vorgabe: 'text', fest: true })).toBe(gebaut('text'))
    // Bild seit W5.2 (22.11.2026) gebaut, Tabelle seit W5.5 (22.11.2026).
    expect(MASKEN_GEBAUT).toEqual({ knoepfe: true, bild: true, text: true })
  })

  it('TB1 (W5.5): Tabelle nur auf Pad/Rechner – auf dem Handy zeigt eine Wahl oder feste Vorgabe „Knöpfe“; reine Zeit-Listen ohne Wahl', () => {
    expect(maskeAufGeraet('text', false)).toBe(false)
    expect(maskeAufGeraet('text', true)).toBe(true)
    expect(maskeAufGeraet('bild', false)).toBe(true)
    expect(wirksameMaske({ bojen: false, pad: false }, { wahl: 'text' })).toBe('knoepfe')
    expect(wirksameMaske({ bojen: true, pad: false }, { vorgabe: 'text', fest: true })).toBe('knoepfe')
    expect(wirksameMaske({ bojen: true, pad: true }, { wahl: 'text' })).toBe('text')
    expect(vorgabeMaske({ bojen: false, pad: true })).not.toBe('text')
    expect(erlaubteMasken({ bojen: false, zeit: true })).toEqual(['knoepfe'])
    expect(wirksameMaske({ bojen: false, pad: true, zeit: true }, { wahl: 'text' })).toBe('knoepfe')
  })
})
