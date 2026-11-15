import { describe, expect, it } from 'vitest'
import { configFor } from '../config/konfig'
import { pokalRegeln, pokalVorgabe, pokalWert, POKAL_LEER } from '../config/pokal'
import { emptyState, reducer, type Action } from '../state/reducer'
import { migrate } from '../state/migrate'
import { makeFile, parseFile } from '../persistenz/backup'
import { laufSchluessel } from './eingaben'
import { klassenErgebnis } from './ergebnis'
import { gesamtPunkte, klasseFertig, platzPunkte, plaetzeWertung, pokalKlassen, pokalZuordnung, uimWertung, type PokalKlasse, type PokalZeile, type PokalZuordnung } from './pokal'
import { gesamtListenSchluessel, wertungZeit } from './listenStand'
import type { AppState, ClassId, Starter } from '../types'

// Pokalauswertung je Herkunft. Alle Starter und Vereine sind erfunden.

const P3 = [10, 7, 5]
const P6 = [6, 5, 4, 3, 2, 1]
const UIM = pokalVorgabe('uim-2026')

let lfd = 0
const starter = (verein: string, klasse: ClassId = '1', extra: Partial<Starter> = {}): Starter => {
  const nr = String(++lfd)
  return { id: `s${nr}`, startNr: nr, vorname: 'Vor', nachname: `Nach${nr}`, verein, bundesland: 'Musterland', geburtsdatum: '', klasse, groesse: '', ...extra }
}
/** Eine Klasse aus „Platz Verein“-Angaben: `1 A`, `2 B`, `d C` (disqualifiziert), `o D` (offen). */
function klasse(id: ClassId, angaben: string[], fertig = true): PokalKlasse {
  const zeilen = angaben.map((a): PokalZeile => {
    const [platz, ...verein] = a.split(' ')
    const s = starter(verein.join(' '), id)
    if (platz === 'd') return { starter: s, platz: 99, disq: true, offen: false }
    if (platz === 'o') return { starter: s, platz: 1, disq: false, offen: true }
    return { starter: s, platz: Number(platz), disq: false, offen: false }
  })
  return { klasse: id, fertig, laeufe: fertig ? [1] : [], gefahren: zeilen.filter((z) => !z.offen).length, zeilen }
}
const ALLE: PokalZuordnung = { herkunft: (p) => p.verein, zaehlt: () => true }
const tabelle = (w: ReturnType<typeof plaetzeWertung>) => w.zeilen.map((z) => `${z.platz}. ${z.herkunft} ${z.gesamt}`)

describe('Vorgaben aus der Konfiguration', () => {
  it('Punkte je Platz stehen in einstellungen.yaml: 10/7/5 und 6/5/4/3/2/1', () => {
    expect(pokalVorgabe('dm-2026').punkte.plaetze3).toEqual([10, 7, 5])
    expect(pokalVorgabe('dm-2026').punkte.plaetze6).toEqual([6, 5, 4, 3, 2, 1])
  })

  it('die UIM-Tabelle steht im Regelwerk der UIM (Regel 960, Pkt. 5.1) und gilt auch unter DM', () => {
    const punkte = [400, 300, 225, 169, 127, 95, 71, 53, 40, 30, 22, 17, 13, 9, 7, 5, 4, 3, 2, 1]
    expect(UIM.punkte.uim).toEqual(punkte)
    expect(pokalVorgabe('dm-2026').punkte.uim).toEqual(punkte)
    expect([UIM.beste, UIM.mindestens]).toEqual([5, 5])
  })

  it('eingeschaltet sind unter UIM die UIM-Variante, unter DM die Plätze 1–6 und die UIM-Variante (wie die Excel-Mappe druckt)', () => {
    expect(pokalVorgabe('uim-2026').an).toEqual(['uim'])
    expect(pokalVorgabe('dm-2026').an).toEqual(['plaetze6', 'uim'])
    // Ein unbekanntes Regelwerk gilt wie überall als das erste.
    expect(pokalVorgabe('gibtsnicht').an).toEqual(['plaetze6', 'uim'])
  })

  it('die Regelwerke bestehen die Prüfung der Konfiguration', () => {
    expect(configFor({ regelwerk: 'dm-2026' }).allDisqs.length).toBeGreaterThan(0)
    expect(configFor({ regelwerk: 'uim-2026' }).allDisqs.length).toBeGreaterThan(0)
  })
})

describe('Punkte eines Platzes', () => {
  it('Platz 1 bis n laut Tabelle, dahinter nichts', () => {
    expect([1, 2, 3, 4].map((p) => platzPunkte(P3, p))).toEqual([10, 7, 5, 0])
    expect([1, 20, 21, 99].map((p) => platzPunkte(UIM.punkte.uim, p))).toEqual([400, 1, 0, 0])
    expect(platzPunkte(P3, 0)).toBe(0)
  })
})

describe('Variante 1: die ersten drei Plätze je Klasse (10, 7, 5)', () => {
  it('zählt je Herkunft die Punkte aller Klassen zusammen', () => {
    const w = plaetzeWertung([klasse('1', ['1 A', '2 B', '3 C', '4 A']), klasse('2', ['1 B', '2 A', '3 A'])], P3, ALLE)
    expect(tabelle(w)).toEqual(['1. A 22', '2. B 17', '3. C 5'])
    expect(w.klassen).toEqual(['1', '2'])
    expect(w.plaetze).toBe(3)
    // Je Klasse die Punkte für Platz 1, 2, 3 – so stehen sie in den Spalten der Liste.
    expect(w.zeilen[0].punkte).toEqual([[10, 0, 0], [0, 7, 5]])
    expect(w.offen).toEqual([])
  })

  it('geänderte Punkte gelten', () => {
    const w = plaetzeWertung([klasse('1', ['1 A', '2 B', '3 C'])], [12, 8, 1], ALLE)
    expect(tabelle(w)).toEqual(['1. A 12', '2. B 8', '3. C 1'])
  })
})

describe('Variante 2: die ersten sechs Plätze je Klasse (6, 5, 4, 3, 2, 1)', () => {
  it('Platz 7 bekommt nichts mehr; die Herkunft steht trotzdem in der Liste', () => {
    const w = plaetzeWertung([klasse('1', ['1 A', '2 B', '3 A', '4 B', '5 A', '6 B', '7 C'])], P6, ALLE)
    expect(tabelle(w)).toEqual(['1. A 12', '2. B 9', '3. C 0'])
    expect(w.zeilen[0].punkte).toEqual([[6, 0, 4, 0, 2, 0]])
  })
})

describe('Geteilte Plätze', () => {
  it('in der Klasse: Beide bekommen die Punkte des Platzes, der nächste entfällt', () => {
    // Zwei auf Platz 1, dann Platz 3 – so liefert es die Gesamtliste.
    const w = plaetzeWertung([klasse('1', ['1 A', '1 B', '3 C'])], P3, ALLE)
    expect(tabelle(w)).toEqual(['1. A 10', '1. B 10', '3. C 5'])
  })

  it('zwei Starter derselben Herkunft auf demselben Platz: Ihre Punkte stehen zusammen in der Spalte', () => {
    const w = plaetzeWertung([klasse('1', ['1 A', '1 A', '3 B'])], P3, ALLE)
    expect(w.zeilen[0]).toMatchObject({ herkunft: 'A', gesamt: 20, punkte: [[20, 0, 0]] })
  })

  it('zwischen Herkünften: gleiche Punkte, gleicher Platz – der nächste entfällt, ohne weiteres Kriterium', () => {
    const w = plaetzeWertung([klasse('1', ['1 B', '2 A', '3 C']), klasse('2', ['1 A', '2 B', '3 D'])], P3, ALLE)
    // A und B haben je 17 Punkte; die Reihenfolge untereinander ist die der Namen.
    expect(tabelle(w)).toEqual(['1. A 17', '1. B 17', '3. C 5', '3. D 5'])
  })

  it('auch der Gleichstand mit 0 Punkten teilt sich den Platz', () => {
    const w = plaetzeWertung([klasse('1', ['1 A', '4 B', '5 C'])], P3, ALLE)
    expect(tabelle(w)).toEqual(['1. A 10', '2. B 0', '2. C 0'])
  })
})

describe('Disqualifizierte und Offene', () => {
  it('bekommen keine Punkte – auch der Offene nicht, der in der Gesamtliste auf Platz 1 steht', () => {
    const w = plaetzeWertung([klasse('1', ['o A', '2 B', '3 C', 'd D'], false)], P3, ALLE)
    expect(tabelle(w)).toEqual(['1. B 7', '2. C 5', '3. A 0', '3. D 0'])
  })

  it('Zwischenstand: Die Wertung nennt die Klassen, deren Gesamtergebnis noch nicht feststeht', () => {
    const w = plaetzeWertung([klasse('1', ['1 A', '2 B']), klasse('2', ['o A', '2 B'], false), klasse('3', ['1 A'], false)], P3, ALLE)
    expect(w.offen).toEqual(['2', '3'])
    expect(uimWertung([klasse('1', ['1 A']), klasse('2', ['o A'], false)], UIM_REGELN, ALLE).offen).toEqual(['2'])
  })
})

const UIM_REGELN = { punkte: UIM.punkte.uim, beste: 5, mindestens: 5 }
const gruppen = (w: ReturnType<typeof uimWertung>) => w.gruppen.map((g) => `${g.platz ?? '–'}. ${g.herkunft} ${g.summeBeste}/${g.summe}`)

describe('Variante 3: UIM', () => {
  it('je Herkunft zählen die fünf Besten; die Summe aller steht daneben', () => {
    const w = uimWertung(
      [klasse('1', ['1 A', '2 A', '3 A', '4 B', '5 B', '6 B']), klasse('2', ['1 B', '2 B', '3 A', '4 A', '5 A', '6 B'])],
      UIM_REGELN,
      ALLE,
    )
    // A: 400 + 300 + 225 + 225 + 169 = 1319 (der Sechste mit 127 zählt nicht mehr).
    // B: 400 + 300 + 169 + 127 + 95 = 1091 (der zweite 6. Platz mit 95 zählt nicht mehr).
    expect(gruppen(w)).toEqual(['1. A 1319/1446', '2. B 1091/1186'])
    const a = w.gruppen[0]
    expect(a.starter.map((s) => s.punkte)).toEqual([400, 300, 225, 225, 169, 127])
    expect(a.starter.map((s) => s.top)).toEqual([true, true, true, true, true, false])
    // Bei gleichen Punkten steht die frühere Klasse vorn.
    expect(a.starter.slice(2, 4).map((s) => s.klasse)).toEqual(['1', '2'])
  })

  it('genau fünf Starter reichen – eine kleine Mannschaft kann gewinnen', () => {
    const w = uimWertung(
      [
        klasse('1', ['1 Klein', '2 Gross', '3 Gross', '4 Gross', '5 Gross']),
        klasse('2', ['1 Klein', '2 Klein', '3 Gross', '4 Gross', '5 Gross']),
        klasse('3', ['1 Klein', '2 Klein', '3 Gross', '4 Gross', '5 Gross']),
      ],
      UIM_REGELN,
      ALLE,
    )
    // Klein: 3 × 400 + 2 × 300 = 1800. Gross (10 Starter): 300 + 225 + 225 + 225 + 169 = 1144.
    expect(gruppen(w)).toEqual(['1. Klein 1800/1800', '2. Gross 1144/1863'])
  })

  it('weniger als fünf Starter: Die Herkunft wird nicht gewertet, steht aber mit ihren Punkten dahinter', () => {
    const w = uimWertung([klasse('1', ['1 Vier', '2 Vier', '3 Vier', '4 Vier', '5 A', '6 A', '7 A', '8 A', '9 A'])], UIM_REGELN, ALLE)
    expect(gruppen(w)).toEqual(['1. A 386/386', '–. Vier 1094/1094'])
  })

  it('die Mindestzahl und die Zahl der Besten lassen sich ändern', () => {
    const k = [klasse('1', ['1 A', '2 A', '3 A', '4 B', '5 B'])]
    expect(gruppen(uimWertung(k, { ...UIM_REGELN, beste: 2, mindestens: 2 }, ALLE))).toEqual(['1. A 700/925', '2. B 296/296'])
    expect(gruppen(uimWertung(k, { ...UIM_REGELN, mindestens: 1 }, ALLE))).toEqual(['1. A 925/925', '2. B 296/296'])
  })

  it('Platz 21 und dahinter: keine Punkte; Disqualifizierte und Offene ebenso, sie zählen aber zur Mannschaft', () => {
    const viele = Array.from({ length: 22 }, (_, i) => `${i + 1} ${i >= 19 ? 'A' : 'B'}`)
    const w = uimWertung([klasse('1', [...viele, 'd A', 'o A'], false)], { ...UIM_REGELN, mindestens: 5 }, ALLE)
    const a = w.gruppen.find((g) => g.herkunft === 'A')!
    // Platz 20, 21, 22, disqualifiziert, offen: fünf Starter, ein Punkt.
    expect(a.starter.map((s) => s.punkte)).toEqual([1, 0, 0, 0, 0])
    expect(a.platz).toBe(2)
    // Wer keine Punkte hat, ist nicht als „zählt“ gekennzeichnet.
    expect(a.starter.map((s) => s.top)).toEqual([true, false, false, false, false])
  })

  it('punktgleiche Herkünfte teilen sich den Platz, der nächste entfällt', () => {
    const k = [klasse('1', ['1 A', '2 B', '3 C']), klasse('2', ['1 B', '2 A', '3 C'])]
    expect(gruppen(uimWertung(k, { ...UIM_REGELN, mindestens: 1 }, ALLE))).toEqual(['1. A 700/700', '1. B 700/700', '3. C 450/450'])
  })
})

describe('Stichentscheid der Mannschaften nach Regelbuch', () => {
  const DM = pokalVorgabe('dm-2026').stich!
  const UIM_STICH = pokalVorgabe('uim-2026').stich!
  const plaetze = (w: ReturnType<typeof plaetzeWertung>) => w.zeilen.map((z) => `${z.platz}${z.stich ? '*' : ''} ${z.herkunft} ${z.gesamt}`)
  const uim = (w: ReturnType<typeof uimWertung>) => w.gruppen.map((g) => `${g.platz ?? '–'}${g.stich ? '*' : ''} ${g.herkunft} ${g.summeBeste}`)

  it('die Regel steht im Regelwerk: DM C6 Zahl der 1. Plätze, dann 2 und 3; UIM 960, Pkt. 5.2.6 Punkte der 1. Plätze, dann der 2. … ohne Grenze', () => {
    expect(DM).toEqual({ zaehlt: 'anzahl', plaetze: 3 })
    expect(UIM_STICH).toEqual({ zaehlt: 'punkte' })
    expect(pokalRegeln(emptyState()).stich).toEqual(DM)
  })

  it('Plätze-Variante: Bei gleicher Punktzahl steht vorn, wer mehr 1. Plätze hat – beide tragen das Zeichen', () => {
    // A: Platz 1 und Platz 6 (6 + 1 = 7); B: Platz 2 und Platz 5 (5 + 2 = 7); C: Platz 3 (4).
    const klassen = [klasse('1', ['1 A', '2 B', '3 C']), klasse('2', ['6 A', '5 B'])]
    expect(plaetze(plaetzeWertung(klassen, P6, ALLE))).toEqual(['1 A 7', '1 B 7', '3 C 4'])
    expect(plaetze(plaetzeWertung(klassen, P6, ALLE, DM))).toEqual(['1* A 7', '2* B 7', '3 C 4'])
  })

  it('gleich viele 1. Plätze: dann die 2., dann die 3. Plätze – danach ist unter DM Schluss, der Platz wird geteilt', () => {
    // Je ein 1. Platz; B hat dazu einen 2., A einen 3. und einen 6. (6+4+1 = 11, 6+5 = 11).
    const zweite = [klasse('1', ['1 A', '2 B']), klasse('2', ['1 B', '3 A']), klasse('3', ['6 A'])]
    expect(plaetze(plaetzeWertung(zweite, P6, ALLE, DM))).toEqual(['1* B 11', '2* A 11'])
    // Bis Platz 3 gleich (je ein 1.), erst Platz 4 gegen 5 + 6 unterschiede sie: DM teilt, die UIM-Regel trennt.
    const vierte = [klasse('1', ['1 A', '1 B']), klasse('2', ['4 A', '5 B', '6 B'])]
    expect(plaetze(plaetzeWertung(vierte, P6, ALLE, DM))).toEqual(['1 A 9', '1 B 9'])
    expect(plaetze(plaetzeWertung(vierte, P6, ALLE, UIM_STICH))).toEqual(['1* A 9', '2* B 9'])
  })

  it('nur Punktgleiche werden verglichen; wer allein steht, trägt kein Zeichen', () => {
    const klassen = [klasse('1', ['1 A', '2 B', '3 C', '4 D']), klasse('2', ['2 A', '1 D', '3 B', '4 C'])]
    // A 11, D 9, B 9, C 7: D hat einen 1. Platz, B keinen.
    expect(plaetze(plaetzeWertung(klassen, P6, ALLE, DM))).toEqual(['1 A 11', '2* D 9', '3* B 9', '4 C 7'])
  })

  it('UIM-Variante: gleiche Summe der Besten – die Punkte der 1. Plätze entscheiden, dann der 2.', () => {
    // Mit der UIM-Tabelle entstehen gleiche Summen praktisch nur aus denselben Plätzen in verschiedenen Klassen.
    const klassen = [klasse('1', ['1 A', '2 B']), klasse('2', ['2 A', '1 B']), klasse('3', ['3 A', '3 B', '1 C'])]
    const regeln = { punkte: UIM.punkte.uim, beste: 5, mindestens: 1 }
    expect(uim(uimWertung(klassen, regeln, ALLE))).toEqual(['1 A 925', '1 B 925', '3 C 400'])
    // Alles gleich (je ein 1., 2., 3. Platz): Auch der Stichentscheid trennt nicht – „dead-heat result“.
    expect(uim(uimWertung(klassen, { ...regeln, stich: UIM_STICH }, ALLE))).toEqual(['1 A 925', '1 B 925', '3 C 400'])
    // Eigene Punkte, bei denen 1. + 4. Platz so viel zählt wie 2. + 3.: Der 1. Platz entscheidet.
    const eigene = [klasse('1', ['1 A', '2 B']), klasse('2', ['4 A', '3 B'])]
    const tabelle = { punkte: [10, 7, 5, 2], beste: 5, mindestens: 1 }
    expect(uim(uimWertung(eigene, tabelle, ALLE))).toEqual(['1 A 12', '1 B 12'])
    expect(uim(uimWertung(eigene, { ...tabelle, stich: UIM_STICH }, ALLE))).toEqual(['1* A 12', '2* B 12'])
    expect(uim(uimWertung(eigene, { ...tabelle, stich: DM }, ALLE))).toEqual(['1* A 12', '2* B 12'])
  })

  it('UIM-Variante: Nicht gewertete Herkünfte (zu wenige Starter) nehmen am Stichentscheid nicht teil', () => {
    const klassen = [klasse('1', ['1 A', '2 B', '4 A']), klasse('2', ['4 B', '1 C'])]
    const w = uimWertung(klassen, { punkte: [10, 7, 5, 2], beste: 5, mindestens: 2, stich: UIM_STICH }, ALLE)
    expect(uim(w)).toEqual(['1 A 12', '2 B 9', '– C 10'])
  })

  it('UIM-Variante: Verglichen werden nur die Besten, deren Punkte zählen – ein sechster Starter entscheidet nichts', () => {
    // A: 1, 1, 2, 3, 4 und ein 5. Platz, der nicht mehr zu den fünf Besten gehört; B: 1, 1, 2, 3, 4.
    const klassen = [klasse('1', ['1 A', '2 A', '3 A', '4 A', '5 A']), klasse('2', ['1 B', '2 B', '3 B', '4 B']), klasse('3', ['1 A']), klasse('4', ['1 B'])]
    expect(uim(uimWertung(klassen, { ...UIM_REGELN, stich: UIM_STICH }, ALLE))).toEqual(['1 A 1494', '1 B 1494'])
  })

  it('UIM-Variante aus beiden Stages: Bei gleichen Punkten an der Grenze der Besten zählt der bessere Platz', () => {
    // Die Zeile trägt die Summe beider Stages und den Platz der Einzelwertung (lib/einzelwertung.ts):
    // Gleiche Punkte heißen dann nicht mehr gleicher Platz.
    const zeile = (verein: string, id: ClassId, platz: number, punkte: number): PokalZeile => ({ starter: starter(verein, id), platz, disq: false, offen: false, punkte })
    const k = (id: ClassId, zeilen: PokalZeile[]): PokalKlasse => ({ klasse: id, fertig: true, laeufe: [1], gefahren: zeilen.length, zeilen })
    const klassen = [k('1', [zeile('Y', '1', 1, 700), zeile('X', '1', 2, 700)]), k('2', [zeile('X', '2', 1, 700), zeile('Z', '2', 2, 700)])]
    const w = uimWertung(klassen, { punkte: UIM.punkte.uim, beste: 1, mindestens: 1, stich: UIM_STICH }, ALLE)
    // X zählt mit seinem 1. Platz der Klasse 2, nicht mit dem 2. Platz der früheren Klasse 1.
    const x = w.gruppen.find((g) => g.herkunft === 'X')!
    expect(x.starter.map((s) => [s.klasse, s.platz, s.top])).toEqual([
      ['2', 1, true],
      ['1', 2, false],
    ])
    expect(uim(w)).toEqual(['1* X 700', '1* Y 700', '3* Z 700'])
  })

  it('Disqualifizierte und Offene zählen im Stichentscheid nicht als Platz', () => {
    const klassen = [klasse('1', ['1 A', '2 B', 'o B', 'd A']), klasse('2', ['6 A', '5 B'])]
    expect(plaetze(plaetzeWertung(klassen, P6, ALLE, DM))).toEqual(['1* A 7', '2* B 7'])
  })
})

describe('Klassen ohne Starter, Starter ohne Herkunft', () => {
  it('eine Klasse ohne Starter kommt nicht vor', () => {
    const stand = { ...emptyState(), starters: [starter('A', '1'), starter('B', '3')] }
    expect(pokalKlassen(stand, configFor(), ['E', '1', '2', '3']).map((k) => k.klasse)).toEqual(['1', '3'])
  })

  it('Starter ohne Herkunft behalten ihren Platz, zählen aber für niemanden – die Wertung nennt ihre Zahl', () => {
    const w = plaetzeWertung([klasse('1', ['1 ', '2 A', '3 B'])], P3, ALLE)
    expect(tabelle(w)).toEqual(['1. A 7', '2. B 5'])
    expect(w.ohneHerkunft).toBe(1)
    expect(uimWertung([klasse('1', ['1 ', '2 A'])], { ...UIM_REGELN, mindestens: 1 }, ALLE).ohneHerkunft).toBe(1)
  })

  it('die Herkunft ist, was die Veranstaltung gewählt hat', () => {
    const s = starter('Club X', '1', { bundesland: 'Bayern', land: 'Deutschland' })
    expect(pokalZuordnung({ originMode: 'verein' }, false).herkunft(s)).toBe('Club X')
    expect(pokalZuordnung({ originMode: 'bundesland' }, false).herkunft(s)).toBe('Bayern')
    expect(pokalZuordnung({ originMode: 'land' }, false).herkunft(s)).toBe('Deutschland')
    expect(pokalZuordnung({ originMode: 'none' }, false).herkunft(s)).toBe('')
  })
})

describe('Nur ausgewählte Starter zählen', () => {
  const k = klasse('1', ['1 A', '2 B', '3 A', '4 B'])
  const abgewaehlt = new Set([k.zeilen[0].starter.id])
  const nurGewaehlte: PokalZuordnung = { herkunft: (p) => p.verein, zaehlt: (p) => !abgewaehlt.has(p.id) }

  it('wer nicht gewählt ist, behält seinen Platz und bekommt keine Punkte – die anderen rücken nicht auf (wie die Excel-Mappe)', () => {
    expect(tabelle(plaetzeWertung([k], P3, nurGewaehlte))).toEqual(['1. B 7', '2. A 5'])
    const w = uimWertung([k], { ...UIM_REGELN, mindestens: 1 }, nurGewaehlte)
    expect(gruppen(w)).toEqual(['1. B 469/469', '2. A 225/225'])
    // Auf der Liste der Mannschaft steht er nicht.
    expect(w.gruppen[1].starter).toHaveLength(1)
  })

  it('ausgeschaltet zählen alle, auch wer abgewählt ist; eingeschaltet gilt die Markierung am Starter', () => {
    const s: Starter = { ...starter('A'), pokal: false }
    expect(pokalZuordnung({ originMode: 'verein' }, false).zaehlt(s)).toBe(true)
    expect(pokalZuordnung({ originMode: 'verein' }, true).zaehlt(s)).toBe(false)
    expect(pokalZuordnung({ originMode: 'verein' }, true).zaehlt(starter('A'))).toBe(true)
  })

  it('eine Herkunft ohne gewählten Starter steht nicht in der Liste', () => {
    const keiner: PokalZuordnung = { herkunft: (p) => p.verein, zaehlt: (p) => p.verein !== 'B' }
    expect(tabelle(plaetzeWertung([k], P3, keiner))).toEqual(['1. A 15'])
  })
})

// ---------------------------------------------------------------------------
// Mit der echten Wertung und dem Reducer
// ---------------------------------------------------------------------------

const D = 'manoevrieren'
const zeit = (id: string, sekunden: string, lauf = 1) => ({ lauf: laufSchluessel(D, lauf), starter: id, feld: 'zeit1', wert: sekunden })
const nach = (s: AppState, ...actions: Action[]) => actions.reduce(reducer, s)
const FELD: Starter[] = [
  { ...starter('Club A', '1'), id: 'a1' },
  { ...starter('Club B', '1'), id: 'b1' },
  { ...starter('Club A', '1'), id: 'a2' },
  { ...starter('Club B', '2'), id: 'b2' },
]
const anfang = (): AppState => nach({ ...emptyState(), laufCount: 1 }, { type: 'ADD_STARTERS', starters: FELD, zeit: 1 })
const wertung = (s: AppState, variante: 'plaetze3' | 'plaetze6' = 'plaetze3') => {
  const regeln = pokalRegeln(s)
  return plaetzeWertung(pokalKlassen(s, configFor({ regelwerk: s.regelwerk }), ['E', '1', '2', '3', '4', '5', '6', '7']), regeln.punkte[variante], pokalZuordnung(s, regeln.nurAuswahl))
}

describe('Aus den Gesamtlisten gerechnet', () => {
  it('Zwischenstand, solange eine Klasse offen ist; fertig, wenn jede ihr Ergebnis hat', () => {
    let s = nach(anfang(), { type: 'SET_EINGABEN', zellen: [zeit('a1', '60'), zeit('b1', '70')], zeit: 10 })
    // a2 ist noch nicht gefahren (offen, Platz 1 ohne Zeit); Klasse 2 hat noch gar nichts.
    expect(wertung(s).offen).toEqual(['1', '2'])
    // Der angefangene Lauf zählt schon: In der Gesamtliste steht a1 hinter dem Offenen auf
    // Platz 2 – unter den Gefahrenen ist er der Erste und bekommt dessen Punkte; a2 bekommt nichts.
    expect(tabelle(wertung(s))).toEqual(['1. Club A 10', '2. Club B 7'])
    s = nach(s, { type: 'SET_EINGABEN', zellen: [zeit('a2', '80'), zeit('b2', '90')], zeit: 20 })
    expect(wertung(s).offen).toEqual([])
    expect(tabelle(wertung(s))).toEqual(['1. Club B 17', '2. Club A 15'])
  })

  it('der Stichentscheid der Klasse gilt: Die Plätze kommen aus der Gesamtliste', () => {
    // Gleiche Punkte (60 s + 5 gegen 65 s): Unter DM entscheidet die schnellere gefahrene Zeit.
    const s = nach(anfang(), {
      type: 'SET_EINGABEN',
      zellen: [zeit('a1', '65'), zeit('b1', '60'), { lauf: laufSchluessel(D, 1), starter: 'b1', feld: 't1a|hin seiteA', wert: '1' }, zeit('a2', '90'), zeit('b2', '90')],
      zeit: 10,
    })
    const k1 = pokalKlassen(s, configFor(), ['1'])[0]
    expect(k1.zeilen.map((z) => `${z.platz} ${z.starter.id}`)).toEqual(['1 b1', '2 a1', '3 a2'])
  })
})

describe('Zwischenstand einer laufenden Klasse', () => {
  // Klasse 1 mit vier Startern der Vereine A bis D, zwei Läufe; in Lauf 1 fahren sie in dieser Reihenfolge.
  const VIER: Starter[] = ['A', 'B', 'C', 'D'].map((v) => ({ ...starter(`Club ${v}`, '1'), id: v.toLowerCase() }))
  const zwei = (): AppState => nach({ ...emptyState(), laufCount: 2 }, { type: 'ADD_STARTERS', starters: VIER, zeit: 1 })
  const lauf1 = [zeit('a', '60'), zeit('b', '61'), zeit('c', '62'), zeit('d', '63')]
  const k1 = (s: AppState) => pokalKlassen(s, configFor({ regelwerk: s.regelwerk }), ['1'])[0]
  const p6 = (s: AppState) => tabelle(wertung(s, 'plaetze6'))

  it('ein angefangener erster Lauf zählt: Wer als Erster gefahren ist, steht unter den Gefahrenen auf Platz 1; Offene bekommen nichts', () => {
    let s = nach(zwei(), { type: 'SET_EINGABEN', zellen: [zeit('a', '60')], zeit: 10 })
    expect(k1(s)).toMatchObject({ fertig: false, laeufe: [1], gefahren: 1 })
    expect(k1(s).zeilen.map((z) => `${z.starter.id}:${z.platz}${z.offen ? ' offen' : ''}`).sort()).toEqual(['a:1', 'b:0 offen', 'c:0 offen', 'd:0 offen'])
    expect(p6(s)).toEqual(['1. Club A 6', '2. Club B 0', '2. Club C 0', '2. Club D 0'])
    const uim = uimWertung([k1(s)], { ...UIM_REGELN, mindestens: 1 }, pokalZuordnung(s, false))
    expect(uim.gruppen.map((g) => g.summe)).toEqual([400, 0, 0, 0])
    // Der Zweite ist schneller: Der Zwischenstand springt – A rutscht auf Platz 2.
    s = nach(s, { type: 'SET_EINGABEN', zellen: [zeit('b', '55')], zeit: 20 })
    expect(p6(s)).toEqual(['1. Club B 6', '2. Club A 5', '3. Club C 0', '3. Club D 0'])
    expect(wertung(s).offen).toEqual(['1'])
  })

  it('Offene schieben die Gefahrenen nicht nach hinten – auch im angefangenen zweiten Lauf', () => {
    let s = nach(zwei(), { type: 'SET_EINGABEN', zellen: lauf1, zeit: 10 })
    expect(p6(s)).toEqual(['1. Club A 6', '2. Club B 5', '3. Club C 4', '4. Club D 3'])
    expect(k1(s)).toMatchObject({ fertig: false, laeufe: [1], gefahren: 4 })
    expect(wertung(s).offen).toEqual(['1'])
    // Im zweiten Lauf ist erst der Letzte gefahren: In der Gesamtliste stehen A, B, C jetzt als
    // Offene auf Platz 1 und D allein dahinter (Platz 4). Unter den Gefahrenen ist D der Erste.
    s = nach(s, { type: 'SET_EINGABEN', zellen: [zeit('d', '50', 2)], zeit: 20 })
    expect(k1(s)).toMatchObject({ fertig: false, laeufe: [1, 2], gefahren: 1 })
    expect(p6(s)).toEqual(['1. Club D 6', '2. Club A 0', '2. Club B 0', '2. Club C 0'])
    s = nach(s, { type: 'SET_EINGABEN', zellen: [zeit('a', '70', 2), zeit('b', '55', 2)], zeit: 30 })
    // Unter DM zählt bei zwei Läufen der bessere (C6): D 50, B 55, A 60 – C ist noch offen.
    expect(p6(s)).toEqual(['1. Club D 6', '2. Club B 5', '3. Club A 4', '4. Club C 0'])
    expect(wertung(s).offen).toEqual(['1'])
    // Mit dem Letzten ist der zweite Lauf vollständig: Jetzt gilt die Gesamtliste selbst.
    s = nach(s, { type: 'SET_EINGABEN', zellen: [zeit('c', '65', 2)], zeit: 40 })
    expect(k1(s)).toMatchObject({ fertig: true, laeufe: [1, 2], gefahren: 4 })
    expect(wertung(s).offen).toEqual([])
    expect(p6(s)).toEqual(['1. Club D 6', '2. Club B 5', '3. Club A 4', '4. Club C 3'])
  })

  it('am Endergebnis ändert sich nichts: Sind alle gefahren, sind es die Plätze der Gesamtliste', () => {
    const s = nach(zwei(), { type: 'SET_EINGABEN', zellen: [...lauf1, zeit('a', '70', 2), zeit('b', '55', 2), zeit('c', '65', 2), zeit('d', '50', 2)], zeit: 10 })
    const gesamt = klassenErgebnis(s, configFor({ regelwerk: s.regelwerk }), '1')!.gesamt
    expect(k1(s).zeilen.map((z) => [z.starter.id, z.platz])).toEqual(gesamt.nachPlatz.map((z) => [z.starter.id, z.platz]))
  })

  it('ein Disqualifizierter zählt als gefahren, bekommt aber keine Punkte', () => {
    const s = nach(zwei(), { type: 'SET_EINGABEN', zellen: [zeit('a', '60'), { lauf: laufSchluessel(D, 1), starter: 'b', feld: 'disq@steg', wert: 'D' }], zeit: 10 })
    expect(k1(s)).toMatchObject({ gefahren: 2 })
    expect(p6(s)).toEqual(['1. Club A 6', '2. Club B 0', '2. Club C 0', '2. Club D 0'])
  })
})

describe('Schreibweise der Herkunft', () => {
  it('Groß-/Kleinschreibung und überzählige Leerzeichen trennen keine Mannschaft; es steht die häufigste Schreibweise da', () => {
    const k = klasse('1', ['1 Club X', '2 club  x', '3 Club Y', '4 CLUB X'])
    k.zeilen[3].starter.verein = 'Club X '
    const zu = pokalZuordnung({ originMode: 'verein' }, false)
    expect(tabelle(plaetzeWertung([k], P3, zu))).toEqual(['1. Club X 17', '2. Club Y 5'])
    expect(gruppen(uimWertung([k], { ...UIM_REGELN, mindestens: 1 }, zu))).toEqual(['1. Club X 869/869', '2. Club Y 225/225'])
  })

  it('Bundesland und Land: Schreibweisen, die als dasselbe Land erkannt werden, sind eine Mannschaft – sonst stünden zwei gleich aussehende Zeilen da', () => {
    const k = klasse('1', ['1 x', '2 x', '3 x', '4 x', '5 x'])
    const laender = ['NRW', 'Nordrhein-Westfalen', 'Bayern', 'nrw', 'Atlantis']
    k.zeilen.forEach((z, i) => (z.starter.bundesland = laender[i]))
    const zu = pokalZuordnung({ originMode: 'bundesland' }, false)
    // NRW: Platz 1 und 2 (10 + 7); die häufigste Schreibweise steht da. Nicht Erkanntes bleibt für sich.
    expect(tabelle(plaetzeWertung([k], P3, zu))).toEqual(['1. NRW 17', '2. Bayern 5', '3. Atlantis 0'])
    expect(uimWertung([k], { ...UIM_REGELN, mindestens: 1 }, zu).gruppen.map((g) => `${g.herkunft} ${g.starter.length}`)).toEqual(['NRW 3', 'Bayern 1', 'Atlantis 1'])

    const staaten = ['GER', 'Germany', 'Deutschland', 'NED', 'Holland']
    k.zeilen.forEach((z, i) => (z.starter.land = staaten[i]))
    const land = plaetzeWertung([k], P3, pokalZuordnung({ originMode: 'land' }, false))
    expect(tabelle(land)).toEqual(['1. GER 22', '2. NED 0'])
    // Als Verein gelesen sind es verschiedene Namen: Dort gibt es keine Zuordnung.
    k.zeilen.forEach((z, i) => (z.starter.verein = staaten[i]))
    expect(plaetzeWertung([k], P3, pokalZuordnung({ originMode: 'verein' }, false)).zeilen).toHaveLength(5)
  })

  it('in der Vereinswertung zählt nur der Verein: Wer keinen hat, bildet keine Mannschaft mit dem Namen seines Bundeslands', () => {
    const k = klasse('1', ['1 ', '2 Club Y'])
    k.zeilen[0].starter.bundesland = 'Bayern'
    const w = plaetzeWertung([k], P3, pokalZuordnung({ originMode: 'verein' }, false))
    expect(tabelle(w)).toEqual(['1. Club Y 7'])
    expect(w.ohneHerkunft).toBe(1)
  })
})

describe('UIM: Mindestzahl und Auswahl', () => {
  it('mit „nur ausgewählte Starter zählen“ ist die Auswahl die Mannschaft: Abgewählte zählen nicht zur Mindestzahl', () => {
    const k = klasse('1', ['1 A', '2 A', '3 A', '4 A'])
    const ohneErsten: PokalZuordnung = { herkunft: (p) => p.verein, zaehlt: (p) => p.id !== k.zeilen[0].starter.id }
    expect(gruppen(uimWertung([k], { ...UIM_REGELN, mindestens: 4 }, ALLE))).toEqual(['1. A 1094/1094'])
    expect(gruppen(uimWertung([k], { ...UIM_REGELN, mindestens: 4 }, ohneErsten))).toEqual(['–. A 694/694'])
  })
})

describe('Einstellungen im Stand', () => {
  it('eine neue Veranstaltung folgt dem Regelwerk; im Stand steht nur die Abweichung', () => {
    let s = emptyState()
    expect(s.pokal).toEqual(POKAL_LEER)
    expect(pokalRegeln(s).an).toEqual(['plaetze6', 'uim'])
    s = nach(s, { type: 'SET_POKAL_VARIANTE', variante: 'plaetze3', an: true }, { type: 'SET_POKAL_VARIANTE', variante: 'uim', an: false })
    expect(pokalRegeln(s).an).toEqual(['plaetze3', 'plaetze6'])
    expect(s.pokal.varianten).toEqual({ plaetze3: true, uim: false })
    // Zurück auf die Vorgabe: Der Eintrag verschwindet.
    s = nach(s, { type: 'SET_POKAL_VARIANTE', variante: 'uim', an: true })
    expect(s.pokal.varianten).toEqual({ plaetze3: true })
    // Wechselt das Regelwerk, folgt alles Unveränderte dem neuen.
    expect(pokalRegeln(nach(s, { type: 'SET_REGELWERK', regelwerk: 'uim-2026' })).an).toEqual(['plaetze3', 'uim'])
  })

  it('Punkte je Platz lassen sich ändern und zurücksetzen; die Zahl der Plätze bleibt', () => {
    let s = nach(emptyState(), { type: 'SET_POKAL_PUNKTE', variante: 'plaetze3', punkte: [12, 9.4, -3, 77] })
    expect(pokalRegeln(s).punkte.plaetze3).toEqual([12, 9, 0])
    expect(pokalRegeln(s).punkte.plaetze6).toEqual([6, 5, 4, 3, 2, 1])
    s = nach(s, { type: 'SET_POKAL_PUNKTE', variante: 'plaetze3', punkte: null })
    expect(s.pokal.punkte).toEqual({})
    // Dieselben Punkte wie die Vorgabe sind keine eigene Angabe.
    expect(nach(s, { type: 'SET_POKAL_PUNKTE', variante: 'plaetze6', punkte: [6, 5, 4, 3, 2, 1] })).toBe(s)
  })

  it('UIM: Zahl der Besten und Mindestzahl, mit dem Regelwerk als Vorgabe', () => {
    let s = nach(emptyState(), { type: 'SET_POKAL_UIM', patch: { beste: 3 } })
    expect([pokalRegeln(s).beste, pokalRegeln(s).mindestens]).toEqual([3, 5])
    s = nach(s, { type: 'SET_POKAL_UIM', patch: { mindestens: 1, beste: null } })
    expect(s.pokal).toMatchObject({ mindestens: 1 })
    expect(s.pokal.beste).toBeUndefined()
    expect(nach(s, { type: 'SET_POKAL_UIM', patch: { mindestens: 5 } }).pokal.mindestens).toBeUndefined()
  })

  it('unbrauchbare Einstellungen aus einer Datei entfallen', () => {
    expect(pokalWert({ varianten: { uim: 'ja', plaetze3: true, fremd: true }, punkte: { plaetze3: ['x', 4], uim: [1] }, beste: 'viele', nurAuswahl: 1 })).toEqual({
      varianten: { plaetze3: true },
      punkte: { plaetze3: [0, 4] },
      nurAuswahl: false,
    })
    expect(pokalWert(undefined)).toEqual(POKAL_LEER)
    // Eine Liste in falscher Länge gilt nicht: Dann bleibt es bei der Vorgabe.
    expect(pokalRegeln({ regelwerk: 'dm-2026', pokal: { ...POKAL_LEER, punkte: { plaetze3: [0, 4] } } }).punkte.plaetze3).toEqual([10, 7, 5])
  })
})

describe('Auswahl der Starter', () => {
  it('alle/keine und umkehren; im Stand steht nur die Abwahl', () => {
    let s = nach(anfang(), { type: 'SET_POKAL_ZAEHLT', ids: ['a1', 'b1'], zaehlt: false })
    expect(s.starters.map((p) => p.pokal)).toEqual([false, false, undefined, undefined])
    s = nach(s, { type: 'INVERT_POKAL_ZAEHLT', ids: ['a1', 'a2', 'b2'] })
    expect(s.starters.map((p) => p.pokal)).toEqual([undefined, false, false, false])
    expect('pokal' in s.starters[0]).toBe(false)
    s = nach(s, { type: 'SET_POKAL_ZAEHLT', ids: s.starters.map((p) => p.id), zaehlt: true })
    expect(s.starters.every((p) => !('pokal' in p))).toBe(true)
    // Nichts geändert: derselbe Stand.
    expect(nach(s, { type: 'SET_POKAL_ZAEHLT', ids: ['a1'], zaehlt: true })).toBe(s)
  })

  it('bleibt änderbar, wenn schon Ergebnisse erfasst sind – das Starterfeld ändert sich dadurch nicht', () => {
    let s = nach(anfang(), { type: 'SET_EINGABEN', zellen: [zeit('a1', '60'), zeit('b1', '70'), zeit('a2', '80'), zeit('b2', '90')], zeit: 10 }, { type: 'SET_POKAL_NUR_AUSWAHL', an: true })
    expect(tabelle(wertung(s))).toEqual(['1. Club B 17', '2. Club A 15'])
    s = nach(s, { type: 'SET_POKAL_ZAEHLT', ids: ['b2'], zaehlt: false })
    expect(s.starters).toHaveLength(4)
    expect(tabelle(wertung(s))).toEqual(['1. Club A 15', '2. Club B 7'])
    // Ausgeschaltet zählen wieder alle; die Auswahl bleibt für später stehen.
    s = nach(s, { type: 'SET_POKAL_NUR_AUSWAHL', an: false })
    expect(tabelle(wertung(s))).toEqual(['1. Club B 17', '2. Club A 15'])
    expect(s.starters.find((p) => p.id === 'b2')!.pokal).toBe(false)
  })

  it('Sicherung und Teilnehmerdaten tragen die Auswahl, die Vorlage die Einstellungen – nicht umgekehrt', () => {
    const s = nach(
      anfang(),
      { type: 'SET_POKAL_NUR_AUSWAHL', an: true },
      { type: 'SET_POKAL_PUNKTE', variante: 'plaetze3', punkte: [9, 6, 3] },
      { type: 'SET_POKAL_ZAEHLT', ids: ['a2'], zaehlt: false },
    )
    const lies = (kind: 'sicherung' | 'vorlage' | 'starter') => parseFile(JSON.stringify(makeFile(kind, s, '2026-11-14T10:00:00Z')))
    const sicherung = lies('sicherung')
    expect(sicherung.ok && sicherung.kind === 'sicherung' && [sicherung.state.pokal, sicherung.state.starters.map((p) => p.pokal)]).toEqual([s.pokal, [undefined, undefined, false, undefined]])
    const daten = lies('starter')
    expect(daten.ok && daten.kind === 'starter' && daten.starters.map((p) => p.pokal)).toEqual([undefined, undefined, false, undefined])
    // Die Vorlage: Einstellungen ja, Starter (und damit die Auswahl) nein.
    const vorlage = makeFile('vorlage', s, '2026-11-14T10:00:00Z')
    expect(JSON.stringify(vorlage)).not.toContain('Club A')
    expect(vorlage.kind === 'vorlage' && vorlage.settings.pokal).toEqual(s.pokal)
    const gelesen = lies('vorlage')
    const ziel = nach(anfang(), { type: 'SET_POKAL_ZAEHLT', ids: ['b1'], zaehlt: false })
    const angewandt = gelesen.ok && gelesen.kind === 'vorlage' ? gelesen.apply(ziel) : ziel
    expect(angewandt.pokal).toEqual(s.pokal)
    expect(angewandt.starters.map((p) => p.pokal)).toEqual([undefined, false, undefined, undefined])
  })

  it('eine Teilnehmerdaten-Datei stellt die Auswahl her, wie sie in ihr steht – in beiden Richtungen', () => {
    const an = nach(anfang(), { type: 'SET_POKAL_NUR_AUSWAHL', an: true })
    const datei = (s: AppState) => {
      const gelesen = parseFile(JSON.stringify(makeFile('starter', s, '2026-11-14T10:00:00Z')))
      if (!gelesen.ok || gelesen.kind !== 'starter') throw new Error('keine Teilnehmerdaten')
      return gelesen.starters
    }
    const lade = (s: AppState, starters: Starter[]) => nach(s, { type: 'IMPORT_STARTERS', starters, mode: 'replace', auswahlAusDatei: true })
    const abwahl = (s: AppState) => s.starters.filter((p) => p.pokal === false).map((p) => p.id)
    // Datei, in der alle zählen, über einen Stand mit Abwahl: Danach zählen wieder alle.
    const alleZaehlen = datei(an)
    const mitAbwahl = nach(an, { type: 'SET_POKAL_ZAEHLT', ids: ['a1', 'b1'], zaehlt: false })
    expect(abwahl(lade(mitAbwahl, alleZaehlen))).toEqual([])
    // Datei mit Abwahl von a1 über einen Stand, in dem stattdessen b1 abgewählt ist: Es gilt die Datei.
    const nurA1 = datei(nach(an, { type: 'SET_POKAL_ZAEHLT', ids: ['a1'], zaehlt: false }))
    const nurB1 = nach(an, { type: 'SET_POKAL_ZAEHLT', ids: ['b1'], zaehlt: false })
    const geladen = lade(nurB1, nurA1)
    expect(abwahl(geladen)).toEqual(['a1'])
    // Die Starter bleiben dieselben (gleiche Kennung) – die Startlisten verweisen darauf.
    expect(geladen.starters.map((p) => p.id)).toEqual(['a1', 'b1', 'a2', 'b2'])
    // Eine Liste aus Excel kennt die Auswahl nicht: Die bestehende Abwahl bleibt.
    const ausExcel = alleZaehlen.map((p) => ({ ...p, id: `neu-${p.id}` }))
    expect(abwahl(nach(nurB1, { type: 'IMPORT_STARTERS', starters: ausExcel, mode: 'replace' }))).toEqual(['b1'])
  })

  it('ein alter Stand ohne Pokalauswertung: Vorgabe des Regelwerks, alle zählen', () => {
    const { pokal: _p, ...alt } = anfang()
    const s = migrate(alt)!
    expect(s.pokal).toEqual(POKAL_LEER)
    expect(migrate({ ...alt, starters: [{ ...FELD[0], pokal: 'nein' }, { ...FELD[1], pokal: false }] })!.starters.map((p) => p.pokal)).toEqual([undefined, false])
  })
})

describe('Zeitpunkt der Mannschaftswertung: der jüngste der Gesamtlisten aller Klassen', () => {
  const fertig = () => nach(anfang(), { type: 'SET_EINGABEN', zellen: [zeit('a1', '60'), zeit('b1', '70'), zeit('a2', '80'), zeit('b2', '90')], zeit: 100 })
  const D = 'manoevrieren'
  const stand = (s: AppState) => {
    const iso = wertungZeit(s.listenStand, D)
    return iso ? Date.parse(iso) : undefined
  }

  it('ohne Ergebnisse gibt es keinen; mit der ersten Eingabe ist es deren Zeitpunkt', () => {
    expect(stand(anfang())).toBeUndefined()
    expect(stand(fertig())).toBe(100)
  })

  it('jede Eingabe in irgendeiner Klasse zählt – auch eine, die an den Punkten nichts ändert', () => {
    let s = fertig()
    // Platz 1 bleibt Platz 1: Die Mannschaftswertung sieht gleich aus und ist trotzdem neuer.
    const vorher = JSON.stringify(wertung(s, "plaetze6").zeilen)
    s = nach(s, { type: 'SET_EINGABEN', zellen: [zeit('a1', '61')], zeit: 200 })
    expect(JSON.stringify(wertung(s, "plaetze6").zeilen)).toBe(vorher)
    expect(stand(s)).toBe(200)
    // Die andere Klasse: Ihre Gesamtliste ist jetzt die jüngste.
    s = nach(s, { type: 'SET_EINGABEN', zellen: [zeit('b2', '91')], zeit: 300 })
    expect(stand(s)).toBe(300)
    expect(s.listenStand[gesamtListenSchluessel(D, '1')].zeit).toBe(200)
    // Nie älter als eine Wertungsliste.
    expect(stand(s)).toBe(Math.max(...Object.values(s.listenStand).map((e) => e.zeit ?? 0)))
  })

  it('eigene Einstellungen der Mannschaftswertung führen keinen eigenen Zeitpunkt mehr', () => {
    let s = fertig()
    s = nach(
      s,
      { type: 'SET_POKAL_PUNKTE', variante: 'plaetze6', punkte: [7, 5, 4, 3, 2, 1], zeit: 300 },
      { type: 'SET_POKAL_UIM', patch: { beste: 3 }, zeit: 400 },
      { type: 'SET_POKAL_VARIANTE', variante: 'plaetze3', an: true, zeit: 500 },
      { type: 'SET_POKAL_NUR_AUSWAHL', an: true, zeit: 600 },
    )
    expect(stand(s)).toBe(100)
    // Ein berichtigter Verein steht auf den Wertungslisten – und damit auch hier.
    s = nach(s, { type: 'UPDATE_STARTER', id: 'b2', patch: { verein: 'Club C' }, zeit: 700 })
    expect(stand(s)).toBe(700)
  })

  it('ein alter Stand mit eigenem `pokalStand`: Das Feld entfällt; es gilt der Zeitpunkt der Gesamtlisten', () => {
    const s = fertig()
    const alt = { ...s, pokalStand: { uim: { inhalt: 1, zeit: 99999 }, plaetze6: { inhalt: 2, zeit: 88888 } } }
    const geladen = nach(emptyState(), { type: 'LOAD_STATE', state: migrate(JSON.parse(JSON.stringify(alt)))!, zeit: 999 })
    expect('pokalStand' in geladen).toBe(false)
    expect(stand(geladen)).toBe(100)
    // Sicherung und Vorlage kennen das Feld nicht mehr.
    expect(JSON.stringify(makeFile('sicherung', s, '2026-11-14T10:00:00Z'))).not.toContain('pokalStand')
    // Ein Stand ganz ohne Zeitpunkte: unbekannt statt erfunden.
    const { listenStand: _l, ...ohne } = s
    expect(stand(nach(emptyState(), { type: 'LOAD_STATE', state: migrate(ohne)!, zeit: 999 }))).toBeUndefined()
  })

  it('der Reducer bleibt rein: gleiche Actions, gleicher Stand', () => {
    expect(fertig()).toEqual(fertig())
  })
})

describe('Spalte „UIM points“ der Gesamtliste (Regel 960, Pkt. 5.2.1)', () => {
  // Erfundene Zeilen einer Gesamtliste: `gesamt` in Hundertstel, null = disqualifiziert oder offen.
  const zeile = (id: string, platz: number, gesamt: number | null, disq = false) => ({ starter: starter('Club', '1', { id }), platz, gesamt, disq })
  const liste = (laeufe: number[], zeilen: ReturnType<typeof zeile>[]) => ({ laeufe, nachPlatz: zeilen })
  const punkte = (l: ReturnType<typeof liste>, laufCount = 2) => {
    const p = gesamtPunkte(l, laufCount, UIM.punkte.uim)
    return p && Object.fromEntries(p)
  }

  it('je Platz die Punkte der Tabelle aus Pkt. 5.1', () => {
    expect(punkte(liste([1, 2], [zeile('a', 1, 6000), zeile('b', 2, 6100), zeile('c', 3, 6200)]))).toEqual({ a: 400, b: 300, c: 225 })
  })

  it('geteilter Platz: beide bekommen die vollen Punkte des Platzes, der nächste entfällt', () => {
    expect(punkte(liste([1, 2], [zeile('a', 1, 6000), zeile('b', 2, 6100), zeile('c', 2, 6100), zeile('d', 4, 6300)]))).toEqual({ a: 400, b: 300, c: 300, d: 169 })
  })

  it('wer disqualifiziert ist, hat 0 Punkte – ebenso ein Platz hinter dem Ende der Tabelle', () => {
    expect(punkte(liste([1, 2], [zeile('a', 1, 6000), zeile('b', 2, null, true)]))).toEqual({ a: 400, b: 0 })
    const viele = Array.from({ length: 22 }, (_, i) => zeile(`s${i + 1}`, i + 1, 6000 + i))
    const p = punkte(liste([1, 2], viele))!
    expect([p.s20, p.s21, p.s22]).toEqual([1, 0, 0])
  })

  it('keine Punkte, solange die Klasse nicht vollständig ist: jemand ist offen oder ein Versuch fehlt noch ganz', () => {
    // b ist noch nicht gefahren: Er steht ohne Zeit auf Platz 1, a dahinter.
    const offen = liste([1, 2], [zeile('b', 1, null), zeile('a', 2, 6000)])
    expect(klasseFertig(offen, 2)).toBe(false)
    expect(punkte(offen)).toBeNull()
    // Alle sind den 1. Versuch gefahren, der 2. steht noch aus.
    const ersterVersuch = liste([1], [zeile('a', 1, 6000), zeile('b', 2, 6100)])
    expect(punkte(ersterVersuch)).toBeNull()
    expect(punkte(ersterVersuch, 1)).toEqual({ a: 400, b: 300 })
  })

  it('aus den erfassten Werten: dieselben Punkte wie in der Mannschaftswertung', () => {
    // Klasse 1: a1 und b1 sind gefahren, a2 noch nicht.
    let s = nach({ ...anfang(), regelwerk: 'uim-2026', laufCount: 1 }, { type: 'SET_EINGABEN', zellen: [zeit('a1', '60'), zeit('b1', '70')], zeit: 10 })
    const gesamt = () => klassenErgebnis(s, configFor({ regelwerk: 'uim-2026' }), '1')!.gesamt
    expect(gesamtPunkte(gesamt(), s.laufCount, UIM.punkte.uim)).toBeNull()
    s = nach(s, { type: 'SET_EINGABEN', zellen: [zeit('a2', '80')], zeit: 20 })
    // Alle gefahren – die Punkte gibt es trotzdem erst, wenn auch die Knoten erfasst sind (Pkt. 5.2.1).
    expect(gesamtPunkte(gesamt(), s.laufCount, UIM.punkte.uim)).toBeNull()
    expect(pokalKlassen(s, configFor({ regelwerk: 'uim-2026' }), ['1'], { knoten: true })[0].fertig).toBe(false)
    s = nach(s, { type: 'SET_EINGABEN', zellen: ['a1', 'b1', 'a2'].map((id) => ({ lauf: 'manoevrieren/0', starter: id, feld: 'erfasst@knoten', wert: '1' })), zeit: 30 })
    const p = gesamtPunkte(gesamt(), s.laufCount, UIM.punkte.uim)!
    const k1 = pokalKlassen(s, configFor({ regelwerk: 'uim-2026' }), ['1'], { knoten: true })[0]
    expect(k1.fertig).toBe(true)
    for (const z of k1.zeilen) expect(p.get(z.starter.id)).toBe(platzPunkte(UIM.punkte.uim, z.platz))
    expect(Object.fromEntries(p)).toEqual({ a1: 400, b1: 300, a2: 225 })
  })
})
