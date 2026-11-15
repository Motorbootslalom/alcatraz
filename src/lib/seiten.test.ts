import { describe, expect, it } from 'vitest'
import { PRINT_RESERVE_MM, PX_PER_MM, printableHeightPx } from './paging'
import { ERGEBNIS_FUSS_MM, ERGEBNIS_FUSS_UNTERSCHRIFT_MM, SEITENZAHL_MM, ergebnisFussMm, listenSeiten, zeilenDerSeite, zeilenPlatzPx } from './seiten'

/** Kurzschrift: je Seite die Stücke als „Block:von-bis“. */
const kurz = (laengen: number[], kapazitaet: number) => listenSeiten(laengen, kapazitaet).map((s) => s.map((t) => `${t.block}:${t.von}-${t.bis}`).join(' '))
/** Zeilen je Seite. */
const zeilen = (laengen: number[], kapazitaet: number) => listenSeiten(laengen, kapazitaet).map((s) => s.reduce((n, t) => n + t.bis - t.von, 0))

describe('listenSeiten: Zeilenblöcke auf Druckseiten verteilen', () => {
  it('passt alles auf eine Seite, bleibt es eine', () => {
    expect(kurz([24], 40)).toEqual(['0:0-24'])
    expect(kurz([6, 6, 6], 40)).toEqual(['0:0-6 1:0-6 2:0-6'])
  })

  it('genau volle Seite: keine zweite, leere Seite', () => {
    expect(kurz([40], 40)).toEqual(['0:0-40'])
    expect(kurz([20, 20], 40)).toEqual(['0:0-20 1:0-20'])
    expect(kurz([80], 40)).toEqual(['0:0-40', '0:40-80'])
  })

  it('leere Liste: eine leere Seite; leere Blöcke belegen nichts', () => {
    expect(listenSeiten([], 40)).toEqual([[]])
    expect(listenSeiten([0, 0], 40)).toEqual([[]])
    expect(kurz([0, 5, 0, 5], 40)).toEqual(['1:0-5 3:0-5'])
    expect(listenSeiten([], 0)).toEqual([[]])
  })

  it('ein Block, der nicht mehr auf den Rest passt, beginnt auf der nächsten Seite', () => {
    expect(kurz([30, 20], 40)).toEqual(['0:0-30', '1:0-20'])
    expect(kurz([30, 20, 20, 5], 40)).toEqual(['0:0-30', '1:0-20 2:0-20', '3:0-5'])
    // Ein späterer, kleiner Block rückt nicht auf eine frühere Seite zurück: Die Reihenfolge bleibt.
    expect(kurz([30, 20, 5], 40)).toEqual(['0:0-30', '1:0-20 2:0-5'])
  })

  it('ein Block größer als eine Seite wird geteilt und füllt die Seiten', () => {
    expect(kurz([100], 40)).toEqual(['0:0-40', '0:40-80', '0:80-100'])
    // Er beginnt auf der laufenden Seite, wenn dort noch Platz für ein ordentliches Stück ist …
    expect(kurz([10, 50], 40)).toEqual(['0:0-10 1:0-30', '1:30-50'])
    // … sonst auf einer neuen.
    expect(kurz([38, 50], 40)).toEqual(['0:0-38', '1:0-40', '1:40-50'])
    // Hinter dem Rest hat der nächste Block Platz.
    expect(kurz([50, 10], 40)).toEqual(['0:0-40', '0:40-50 1:0-10'])
  })

  it('kein Blatt für eine einzelne Zeile: Das letzte Stück bekommt mindestens drei', () => {
    expect(zeilen([41], 40)).toEqual([38, 3])
    expect(zeilen([42], 40)).toEqual([39, 3])
    expect(zeilen([43], 40)).toEqual([40, 3])
    expect(zeilen([81], 40)).toEqual([40, 38, 3])
  })

  it('keine Zeile geht verloren oder steht doppelt, keine Seite ist zu voll', () => {
    for (const kap of [1, 2, 3, 7, 40]) {
      for (const laengen of [[1], [5], [kap], [kap + 1], [3 * kap + 2], [4, 9, 0, 13, 2], [kap, kap, 1], [2 * kap + 1, kap - 1, 5]]) {
        const seiten = listenSeiten(laengen, kap)
        for (const s of seiten) expect(s.reduce((n, t) => n + t.bis - t.von, 0)).toBeLessThanOrEqual(kap)
        laengen.forEach((n, block) => {
          const teile = seiten.flat().filter((t) => t.block === block)
          expect(teile.reduce((x, t) => x + t.bis - t.von, 0)).toBe(Math.max(0, n))
          teile.forEach((t, i) => expect(t.von).toBe(i === 0 ? 0 : teile[i - 1].bis))
        })
        // Keine leere Seite – außer der einen einer leeren Liste.
        if (seiten.length > 1) for (const s of seiten) expect(s.length).toBeGreaterThan(0)
      }
    }
  })

  it('unbekannte Kapazität (0): alles auf einer Seite', () => {
    expect(kurz([100, 100], 0)).toEqual(['0:0-100 1:0-100'])
  })

  it('gebundene Zeilen (eine Zelle über mehrere Zeilen) teilt kein Seitenwechsel – der Rest füllt die Seiten wie sonst', () => {
    /** Die Zeilen `von` bis `bis` (ausschließlich) bilden je eine zusammengefasste Zelle. */
    const bindung = (...gruppen: [number, number][]) => (_: number, zeile: number) => gruppen.some(([von, bis]) => zeile > von && zeile < bis)
    const stuecke = (laengen: number[], kap: number, g: (b: number, z: number) => boolean) =>
      listenSeiten(laengen, kap, undefined, undefined, g).map((s) => s.map((t) => `${t.block}:${t.von}-${t.bis}`).join(' '))
    // „Qualified“ auf den Zeilen 8–11 (von 20, 10 je Seite): Seite 1 endet vor der Zelle (das
    // letzte Stück bekommt wie immer mindestens drei Zeilen).
    expect(stuecke([20], 10, bindung([8, 12]))).toEqual(['0:0-8', '0:8-17', '0:17-20'])
    // Ohne Bindung wie bisher; eine Zelle, die genau an der Grenze endet oder beginnt, ändert nichts.
    expect(stuecke([20], 10, () => false)).toEqual(['0:0-10', '0:10-20'])
    expect(stuecke([20], 10, bindung([6, 10], [10, 14]))).toEqual(['0:0-10', '0:10-20'])
    // Der Rest von mindestens drei Zeilen holt sich keine halbe Zelle: lieber ein kürzeres vorletztes Stück.
    expect(stuecke([21], 10, bindung([17, 19]))).toEqual(['0:0-10', '0:10-17', '0:17-21'])
    expect(stuecke([21], 10, bindung([18, 20]))).toEqual(['0:0-10', '0:10-18', '0:18-21'])
    // Füllt die gebundene Folge allein mehr als eine Seite, wird sie doch geteilt – nichts geht verloren.
    expect(stuecke([12], 4, bindung([0, 12]))).toEqual(['0:0-4', '0:4-8', '0:8-12'])
    // Nichts geht verloren, keine Seite ist zu voll, keine gebundene Folge (bis Seitengröße) ist geteilt.
    for (const kap of [3, 5, 7, 10]) {
      const g = bindung([1, 4], [6, 8], [9, 13], [20, 22])
      const seiten = listenSeiten([25], kap, undefined, undefined, g)
      for (const s of seiten) expect(s.reduce((n, t) => n + t.bis - t.von, 0)).toBeLessThanOrEqual(kap)
      expect(seiten.flat().reduce((n, t) => n + t.bis - t.von, 0)).toBe(25)
      for (const t of seiten.flat().slice(1)) if (kap >= 4) expect(g(0, t.von), `${kap}: ${t.von}`).toBe(false)
    }
  })
})

describe('listenSeiten mit gemessenen Zeilenhöhen', () => {
  it('höhere Zeilen brauchen mehr Platz: Die Seite fasst weniger davon', () => {
    // 10 Zeilen zu 20, Platz 100 → 5 je Seite; ist jede zweite doppelt so hoch, nur noch 3.
    expect(zeilen([10], 100)).toEqual([10])
    expect(listenSeiten([10], 100, () => 20).map((s) => s[0].bis - s[0].von)).toEqual([5, 5])
    const seiten = listenSeiten([10], 100, (_, z) => (z % 2 === 0 ? 40 : 20))
    expect(seiten.map((s) => `${s[0].von}-${s[0].bis}`)).toEqual(['0-3', '3-6', '6-9', '9-10'])
  })

  it('genau volle Seite nach Höhe', () => {
    expect(listenSeiten([4], 100, () => 25)).toEqual([[{ block: 0, von: 0, bis: 4 }]])
    // Eine Zeile mehr: zweite Seite – mit zwei Zeilen statt einer einzelnen.
    expect(listenSeiten([5], 100, () => 25).map((s) => s[0].bis - s[0].von)).toEqual([3, 2])
  })

  it('ein Block bleibt nach seiner Höhe zusammen', () => {
    const hoehe = (block: number) => (block === 1 ? 30 : 10)
    // Block 0: 50, Block 1: 3 × 30 = 90 passt nicht mehr auf den Rest (50), aber auf eine ganze Seite.
    expect(listenSeiten([5, 3], 100, hoehe).map((s) => s.map((t) => t.block))).toEqual([[0], [1]])
  })

  it('eine Zeile höher als das Blatt bekommt trotzdem eine Seite; nichts geht verloren', () => {
    const seiten = listenSeiten([4], 100, (_, z) => (z === 1 ? 250 : 10))
    expect(seiten.flat().map((t) => `${t.von}-${t.bis}`)).toEqual(['0-1', '1-2', '2-4'])
  })

  it('ein wiederholter Kopf auf der Fortsetzungsseite geht von deren Platz ab – auch für die Blöcke danach', () => {
    // Ohne Abzug: 10 + 10 + 5 Zeilen; mit einer Zeile Kopf auf jeder Fortsetzung 10 + 9 + 6.
    expect(listenSeiten([25], 10).map((s) => s.map((t) => t.bis - t.von))).toEqual([[10], [10], [5]])
    expect(listenSeiten([25], 10, undefined, () => 1).map((s) => s.map((t) => t.bis - t.von))).toEqual([[10], [9], [6]])
    // Der Block danach passt nur noch, wenn der Kopf mitgerechnet ist: 6 + 1 + 4 > 10.
    expect(listenSeiten([25, 4], 10, undefined, () => 1)).toEqual([[{ block: 0, von: 0, bis: 10 }], [{ block: 0, von: 10, bis: 19 }], [{ block: 0, von: 19, bis: 25 }], [{ block: 1, von: 0, bis: 4 }]])
    expect(listenSeiten([25, 3], 10, undefined, () => 1).at(-1)).toEqual([{ block: 0, von: 19, bis: 25 }, { block: 1, von: 0, bis: 3 }])
    // Keine Seite ist zu voll, nichts geht verloren – mit gemessenen Höhen.
    for (const kap of [4, 7, 40]) {
      for (const laengen of [[3 * kap + 2], [kap + 1, 2], [2 * kap + 1, kap - 1, 5]]) {
        const seiten = listenSeiten(laengen, kap, () => 1, () => 1)
        for (const s of seiten) expect(s.reduce((n, t) => n + t.bis - t.von, 0) + (s[0].von > 0 ? 1 : 0), `${kap} ${laengen}`).toBeLessThanOrEqual(kap)
        expect(seiten.flat().reduce((n, t) => n + t.bis - t.von, 0)).toBe(laengen.reduce((a, b) => a + b, 0))
      }
    }
    // Ein Block, der ganz auf eine Seite passt, ist nie eine Fortsetzung: kein Abzug.
    expect(listenSeiten([6, 6], 10, undefined, () => 5)).toEqual([[{ block: 0, von: 0, bis: 6 }], [{ block: 1, von: 0, bis: 6 }]])
  })

  it('die Teilung hängt nur an den Höhen, nicht an der vorigen Teilung: zweimal gerechnet, gleiches Ergebnis', () => {
    const hoehe = (_: number, z: number) => 17.39 + (z % 7 === 0 ? 9.4 : 0)
    expect(listenSeiten([48, 20], 700, hoehe)).toEqual(listenSeiten([48, 20], 700, hoehe))
  })
})

describe('zeilenPlatzPx: Platz für die Zeilen aus der Messung', () => {
  it('Blatt minus Rand, Reserve, Seitenzahl und Kopf', () => {
    // A4 hoch: 297 − 16 Rand − 5 Reserve − 5 Seitenzahl − 31 Kopf = 240 mm.
    expect(zeilenPlatzPx(31 * PX_PER_MM, 297)).toBeCloseTo(240 * PX_PER_MM, 6)
    expect(zeilenPlatzPx(31 * PX_PER_MM, 297)).toBeCloseTo(printableHeightPx(297) - (PRINT_RESERVE_MM + SEITENZAHL_MM + 31) * PX_PER_MM, 6)
    // Quer bleibt weniger.
    expect(zeilenPlatzPx(31 * PX_PER_MM, 210)).toBeCloseTo(153 * PX_PER_MM, 6)
  })

  it('ein höherer Fuß (Wertungslisten: Stichentscheid, Seitenzahl, letzte Änderung) nimmt den Zeilen seinen Platz', () => {
    // A4 quer: 210 − 16 Rand − 5 Reserve − 12 Fuß − 31 Kopf = 146 mm – 7 mm weniger als mit der bloßen Seitenzahl.
    expect(ERGEBNIS_FUSS_MM).toBe(12)
    expect(zeilenPlatzPx(31 * PX_PER_MM, 210, ERGEBNIS_FUSS_MM)).toBeCloseTo(146 * PX_PER_MM, 6)
    expect(zeilenPlatzPx(31 * PX_PER_MM, 210) - zeilenPlatzPx(31 * PX_PER_MM, 210, ERGEBNIS_FUSS_MM)).toBeCloseTo((ERGEBNIS_FUSS_MM - SEITENZAHL_MM) * PX_PER_MM, 6)
  })

  it('mit Unterschrift und Uhrzeit des Aushangs (UIM 960, Pkt. 5.2) ist der Fuß 10 mm höher – nur dort, wo das Regelwerk sie verlangt', () => {
    expect(ERGEBNIS_FUSS_UNTERSCHRIFT_MM).toBe(22)
    expect(ergebnisFussMm(true)).toBe(22)
    expect(ergebnisFussMm(false)).toBe(ERGEBNIS_FUSS_MM)
    expect(ergebnisFussMm(undefined)).toBe(ERGEBNIS_FUSS_MM)
    // A4 quer: 210 − 16 Rand − 5 Reserve − 22 Fuß − 31 Kopf = 136 mm.
    expect(zeilenPlatzPx(31 * PX_PER_MM, 210, ergebnisFussMm(true))).toBeCloseTo(136 * PX_PER_MM, 6)
  })

  it('füllt der Kopf das Blatt, bleibt kein Platz – die Teilung gibt dann jeder Zeile eine Seite', () => {
    const platz = zeilenPlatzPx(400 * PX_PER_MM, 297)
    expect(platz).toBeLessThan(0)
    // Kein Platz gilt wie „unbekannt“: alles auf einer Seite; die Ansicht setzt deshalb mindestens eine Zeilenhöhe an.
    expect(listenSeiten([3], platz)).toHaveLength(1)
    expect(listenSeiten([3], 20, () => 20)).toHaveLength(3)
  })
})

describe('zeilenDerSeite: die Zeilen einer Seite mit ihrer Stelle in der ganzen Liste', () => {
  it('die Stelle zählt über die Seiten weiter – daran hängen graue Zeile und Abstand', () => {
    const liste = ['a', 'b', 'c', 'd', 'e', 'f', 'g']
    const seiten = listenSeiten([liste.length], 4)
    expect(seiten.map((teile) => zeilenDerSeite(liste, teile))).toEqual([
      [{ z: 'a', i: 0 }, { z: 'b', i: 1 }, { z: 'c', i: 2 }, { z: 'd', i: 3 }],
      [{ z: 'e', i: 4 }, { z: 'f', i: 5 }, { z: 'g', i: 6 }],
    ])
  })

  it('leere Liste: eine Seite ohne Zeilen', () => {
    expect(listenSeiten([0], 4).map((teile) => zeilenDerSeite([], teile))).toEqual([[]])
  })
})
