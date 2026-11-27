import { describe, expect, it } from 'vitest'
import { AUFBAUTEN } from '../config/catalog'
import { configFor, type Konfig } from '../config/konfig'
import { parcoursDateien, parcoursSvg } from '../lib/parcoursQuelle'
import { PARALLEL_DATEI, PARALLEL_PFLICHT_IDS, PARCOURS_DATEIEN } from '../lib/parcoursVertrag'
import type { ClassId } from '../types'
import { WKR_ANNAHMEN } from './annahmen'
import {
  aufrechtTransform,
  BILD_BOJEN,
  BILD_LAGE_SEITE,
  BILD_LAGEN,
  istBildLage,
  lageVonDrehung,
  bildIdVon,
  bildTreffer,
  bildWege,
  bildZahlen,
  bildZiel,
  bildZuordnung,
  bojenMitHalt,
  inlineSvg,
  PARALLEL_BILD,
  parallelBildId,
  probeBild,
  schemaIdVon,
  schemaParallel,
  schiebeAuseinander,
  svgSeiten,
  wirksameDrehung,
} from './bild'
import { listenKennung } from './liste'
import { bojenVon, leererEntwurf, maskeFuer, tippeBoje, type MaskenAufbau } from './maske'
import { maskenJeKlasse, type ListenSicht } from './sicht'

// Maske „Bild“ (W5.2, Plan docs/plan-wkr-w5.md §5, BD1–BD6, 22.11.2026): Zuordnung Boje ↔ ID der Klassen-Zeichnung,
// Umschalter, Parallel-Schema, Drehung und Auseinanderschieben – rein, ohne DOM.

const KLASSEN: ClassId[] = ['1', '2', '3', '4', '5', '6', '7', 'E']

function sichtMit(konfig: Konfig, typeId: string, aufbauId?: string, liste = listenKennung({ bereich: 'p1', typeId, racecourse: null })): ListenSicht {
  return { liste, klassen: maskenJeKlasse(konfig, konfig, typeId, KLASSEN, WKR_ANNAHMEN.xListen.includes(typeId), aufbauId) } as ListenSicht
}

describe('BILD_BOJEN (BD1)', () => {
  it('jede ID der Tabelle steht in jeder Zeichnung (Speedboje unten nur, wo die Route um sie führt)', () => {
    expect(parcoursDateien()).toEqual([...PARCOURS_DATEIEN].sort())
    for (const datei of parcoursDateien()) {
      const svg = parcoursSvg(datei)!
      for (const id of Object.keys(BILD_BOJEN)) {
        const n = svg.split(`id="${id}"`).length - 1
        if (id === 'Speedboje_unten') expect(n, `${datei}: ${id}`).toBeLessThanOrEqual(1)
        else expect(n, `${datei}: ${id}`).toBe(1)
      }
    }
  })

  it('innen/außen wie die Beschriftung: Tor 1/3 innen = seiteB, Tor 2/4 innen = seiteA; Tor 5/Start oben = seiteB', () => {
    expect(BILD_BOJEN.Tor1_innen).toEqual({ halt: 'Tor1', seite: 'seiteB' })
    expect(BILD_BOJEN.Tor3_innen).toEqual({ halt: 'Tor3', seite: 'seiteB' })
    expect(BILD_BOJEN.Tor2_innen).toEqual({ halt: 'Tor2', seite: 'seiteA' })
    expect(BILD_BOJEN.Tor4_aussen).toEqual({ halt: 'Tor4', seite: 'seiteB' })
    expect(BILD_BOJEN.Tor5_oben).toEqual({ halt: 'Tor5', seite: 'seiteB' })
    expect(BILD_BOJEN.StartZiel_unten).toEqual({ halt: 'StartZiel', seite: 'seiteA' })
    expect(BILD_BOJEN.Speedboje_oben).toEqual({ halt: 'Speedboje_oben', seite: null })
    expect(Object.keys(BILD_BOJEN)).toHaveLength(14)
  })

  it('Feld → ID: Hin und Rück derselben Boje geben dieselbe ID', () => {
    expect(bildIdVon('t1a|hin seiteB')).toBe('Tor1_innen')
    expect(bildIdVon('t1b|rueck seiteB')).toBe('Tor1_innen')
    expect(bildIdVon('t1c|rueck seiteA')).toBe('Tor1_aussen')
    expect(bildIdVon('t5|hin seiteA')).toBe('Tor5_unten')
    expect(bildIdVon('t5|rueck seiteA')).toBe('Tor5_unten')
    expect(bildIdVon('start|hin seiteB')).toBe('StartZiel_oben')
    expect(bildIdVon('ziel|rueck seiteB')).toBe('StartZiel_oben')
    expect(bildIdVon('speed1')).toBe('Speedboje_oben')
    expect(bildIdVon('speed2')).toBe('Speedboje_unten')
    expect(bildIdVon('katalog:tor5')).toBeNull()
    expect(bildIdVon('b3a')).toBeNull()
  })

  it('zwei Knopfspalten eines Tores zeigen auf zwei verschiedene Bojen desselben Tores (P7 ↔ BD1)', () => {
    const k = configFor({ regelwerk: 'dm-2026' })
    for (const typeId of ['gate135', 'gate245', 'parcoursms']) {
      const aufbau = maskeFuer(sichtMit(k, typeId), '7')!
      for (const a of aufbau.abschnitte) {
        if (a.art !== 'halt' || a.halt.bojen.length !== 2) continue
        const [x, y] = a.halt.bojen.map((b) => BILD_BOJEN[bildIdVon(b.feld)!])
        expect(x.halt).toBe(y.halt)
        expect(x.seite).not.toBe(y.seite)
      }
    }
  })
})

describe('bildTreffer über alle Zeichnungen × Aufbauten × Klassen (BD2)', () => {
  for (const regelwerk of ['dm-2026', 'uim-2026']) {
    it(`${regelwerk}: jede Boje jeder Bojen-Liste hat genau eine ID im Bild ihrer Klasse`, () => {
      const k = configFor({ regelwerk })
      let geprueft = 0
      const ohne: string[] = []
      const rueckfall = new Set<string>()
      for (const a of AUFBAUTEN) {
        for (const kombi of [false, true]) {
          for (const typeId of k.aufbauOrder(a.id, kombi)) {
            const sicht = sichtMit(k, typeId, a.id)
            for (const klasse of KLASSEN) {
              const aufbau = maskeFuer(sicht, klasse)
              if (!aufbau || aufbau.art !== 'bojen') continue
              const z = bildTreffer(sicht, klasse, parcoursSvg)
              if (bojenVon(aufbau).every((b) => schemaIdVon(b.feld) !== null)) {
                // Parallelslalom: die eine Bahn aus dem Parcours-Repo (BD3 umgebaut 22.11.2026, BD8–BD10 umgebaut 23.11.2026).
                expect(z?.art, `${a.id}/${typeId}/${klasse}`).toBe('svg')
                const svg = parcoursSvg(PARALLEL_DATEI)!
                for (const b of bojenVon(aufbau)) {
                  const id = z!.treffer[b.feld]
                  expect(PARALLEL_PFLICHT_IDS, `${b.feld} → ${id}`).toContain(id)
                  expect(svg.split(`id="${id}"`).length - 1, id).toBe(1)
                }
                continue
              }
              if (!sicht.klassen[klasse]?.bild) {
                // Ohne Zeichnung des Bogens kein Bild – die Klasse zeigt Knöpfe.
                expect(z, `${a.id}/${typeId}/${klasse}`).toBeNull()
                ohne.push(`${a.id}/${typeId}/${klasse}`)
                continue
              }
              const svg = parcoursSvg(sicht.klassen[klasse]!.bild!.datei)!
              if (!z) {
                // BD2: kein stilles Fehlen – mindestens eine Boje steht nicht genau einmal im Bild; die Klasse zeigt Knöpfe.
                const fehlt = bojenVon(aufbau).filter((b) => {
                  const id = bildIdVon(b.feld)
                  return !id || svg.split(`id="${id}"`).length - 1 !== 1
                })
                expect(fehlt.length, `${a.id}/${typeId}/${klasse}`).toBeGreaterThan(0)
                rueckfall.add(`${sicht.klassen[klasse]!.bild!.datei}: ${fehlt.map((b) => b.feld).join(', ')}`)
                continue
              }
              for (const b of bojenVon(aufbau)) {
                const id = z!.treffer[b.feld]
                expect(id, `${a.id}/${typeId}/${klasse}: ${b.feld}`).toBeTruthy()
                expect(svg.split(`id="${id}"`).length - 1, `${a.id}/${typeId}/${klasse}: ${id}`).toBe(1)
              }
              // Blasse Bojen gehören nie zur Liste und stehen im Bild.
              for (const id of z!.blass) {
                expect(z!.ids).not.toContain(id)
                expect(svg).toContain(`id="${id}"`)
              }
              geprueft++
            }
          }
        }
      }
      expect(geprueft).toBeGreaterThan(20)
      // Nur Listen ohne Zeichnung auf dem Bogen fallen zurück (Stand 22.11.2026: keine unter den Bojen-Listen).
      expect(ohne).toEqual([])
      // Stand 22.11.2026: Die Möwe-Zeichnung der Klasse 7 hat keine untere Speedboje (lib/parcoursVertrag.ts
      // OPTIONALE_IDS), die Liste fragt sie aber ab – Klasse 7 auf Möwe-Listen zeigt Knöpfe, bis die Zeichnung sie hat (UIM kennt den Möwe-Kurs nicht).
      expect([...rueckfall]).toEqual(regelwerk === 'dm-2026' ? ['Klasse7_Moewe: speed2'] : [])
    })
  }

  it('fehlt eine ID (oder die Zeichnung), fällt die Klasse auf Knöpfe zurück', () => {
    const k = configFor({ regelwerk: 'dm-2026' })
    const sicht = sichtMit(k, 'gate135', 'alcatraz')
    const bild = sicht.klassen['3']!.bild!
    const svg = parcoursSvg(bild.datei)!
    expect(bildTreffer(sicht, '3', () => svg)).not.toBeNull()
    expect(bildTreffer(sicht, '3', () => svg.replace('id="Tor1_innen"', 'id="weg"'))).toBeNull()
    expect(bildTreffer(sicht, '3', () => svg + '<g id="Tor1_innen"/>')).toBeNull()
    expect(bildTreffer(sicht, '3', () => undefined)).toBeNull()
    // Katalog-Listen (Tor 5 ohne Bojen) haben kein Bild.
    expect(bildTreffer(sichtMit(k, 'tor5', 'alcatraz'), '3', parcoursSvg)).toBeNull()
  })

  it('fremde Bojen blass: auf Tor 1/3/5 sind Tor 2 und Tor 4 blass, Tor 1 nie', () => {
    const k = configFor({ regelwerk: 'dm-2026' })
    const z = bildTreffer(sichtMit(k, 'gate135', 'alcatraz'), '3', parcoursSvg)!
    expect(z.art).toBe('svg')
    expect(z.blass).toEqual(expect.arrayContaining(['Tor2_innen', 'Tor2_aussen', 'Tor4_innen', 'Tor4_aussen']))
    expect(z.blass).not.toContain('Tor1_innen')
    expect(z.ids).toEqual(expect.arrayContaining(['Tor1_innen', 'Tor1_aussen', 'Tor3_innen', 'Tor5_unten']))
  })

  it('Probe: die Klasse mit den meisten Zeilen unter denen mit Bild', () => {
    const k = configFor({ regelwerk: 'dm-2026' })
    const p = probeBild(sichtMit(k, 'gate135', 'alcatraz'), parcoursSvg)!
    expect(p.klasse).toBe('7')
    expect(probeBild(sichtMit(k, 'tor5', 'alcatraz'), parcoursSvg)).toBeNull()
  })
})

describe('Parallelslalom: eine Bahn für beide Racecourses (BD3, BD8–BD10 umgebaut 23.11.2026), Schema nur ohne Datei', () => {
  const k = configFor({ regelwerk: 'uim-2026' })
  const sichtRc = (rc: 'A' | 'B') => sichtMit(k, 'parallelparcours', undefined, listenKennung({ bereich: 'parallel', typeId: 'parallelparcours', racecourse: rc }))
  const klasseVon = (sicht: ListenSicht) => (Object.keys(sicht.klassen) as ClassId[]).find((x) => maskeFuer(sicht, x)?.art === 'bojen')!
  /** Alle sieben Bojen der einen Bahn: Bojen 1–5 und Start/Ziel unten (seiteA) und oben (seiteB). */
  const EINE_BAHN = ['A_Boje1', 'A_Boje2', 'A_Boje3', 'A_Boje4', 'A_Boje5', 'A_StartZiel_unten', 'A_StartZiel_oben']

  it('Schema: Start/Ziel ein Tor, Boje n hin und rück dieselbe; A und B dieselbe Zeichnung (seit 23.11.2026 nicht mehr gespiegelt)', () => {
    expect(schemaIdVon('start|seiteA')).toBe('P_StartZiel_seiteA')
    expect(schemaIdVon('ziel|seiteA')).toBe('P_StartZiel_seiteA')
    expect(schemaIdVon('b2a')).toBe('P_b2')
    expect(schemaIdVon('b2b')).toBe('P_b2')
    expect(schemaIdVon('b5')).toBe('P_b5')
    expect(schemaIdVon('t1a|hin seiteA')).toBeNull()
    expect(schemaIdVon('start|hin seiteA')).toBeNull()
    const a = schemaParallel('A')
    const b = schemaParallel('B')
    expect(b).toEqual({ ...a, racecourse: 'B' })
    expect(a.punkte.map((p) => p.id)).toEqual(['P_StartZiel_seiteA', 'P_StartZiel_seiteB', 'P_b1', 'P_b2', 'P_b3', 'P_b4', 'P_b5'])
    // seiteA links, wie bisher für A.
    expect(a.punkte[0].x).toBeLessThan(a.punkte[1].x)
  })

  it('IDs der Zeichnung (Parcours-Repository, R9-05): Boje n hin und rück dieselbe, Start und Ziel dasselbe Tor – ohne Racecourse', () => {
    expect(parallelBildId('b2a')).toBe('A_Boje2')
    expect(parallelBildId('b2b')).toBe('A_Boje2')
    expect(parallelBildId('b5')).toBe('A_Boje5')
    expect(parallelBildId('start|seiteA')).toBe('A_StartZiel_unten')
    expect(parallelBildId('ziel|seiteA')).toBe('A_StartZiel_unten')
    expect(parallelBildId('ziel|seiteB')).toBe('A_StartZiel_oben')
    expect(parallelBildId('t1a|hin seiteA')).toBeNull()
  })

  it('mit Parallel.svg: A und B treffen dieselbe eine Bahn, jede Boje genau einmal, nichts gedimmt (BD9, BD10)', () => {
    const svg = parcoursSvg(PARALLEL_DATEI)!
    expect(svg).toBeDefined()
    const treffer: Record<string, Record<string, string>> = {}
    for (const rc of ['A', 'B'] as const) {
      const sicht = sichtRc(rc)
      const klasse = klasseVon(sicht)
      const aufbau = maskeFuer(sicht, klasse)!
      const z = bildTreffer(sicht, klasse, parcoursSvg)!
      expect(z.art).toBe('svg')
      // Welcher Racecourse, sagt die Liste – nicht die Zeichnung.
      expect(z.racecourse).toBe(rc)
      expect(z.bild).toEqual(PARALLEL_BILD)
      expect(z.bild!.dim).toEqual([])
      expect(z.schema).toBeNull()
      const felder = bojenVon(aufbau)
      expect(felder.length).toBeGreaterThan(0)
      for (const b of felder) expect(svg.split(`id="${z.treffer[b.feld]}"`).length - 1, b.feld).toBe(1)
      // Alle fünf Bojen und beide Start/Ziel-Bojen sind antippbar – je ID ein Trefferkreis; keine fremde Bahn.
      expect([...z.ids].sort()).toEqual([...EINE_BAHN].sort())
      expect(z.blass).toEqual([])
      treffer[rc] = z.treffer
    }
    expect(treffer.B).toEqual(treffer.A)
  })

  it('ohne Datei (oder ohne die IDs) das Schema – vollständig, keine stille Lücke', () => {
    const svg = parcoursSvg(PARALLEL_DATEI)!
    for (const rc of ['A', 'B'] as const) {
      const sicht = sichtRc(rc)
      const klasse = klasseVon(sicht)
      // Auch eine Datei mit einer fehlenden oder doppelten Pflicht-ID fällt aufs Schema zurück (nie ein Bild mit Lücke).
      for (const svgVon of [undefined, () => undefined, () => '<svg viewBox="0 0 1 1"></svg>', () => svg.replace('id="A_Boje4"', 'id="x"'), () => svg + '<g id="A_Boje1"/>']) {
        const z = bildTreffer(sicht, klasse, svgVon)!
        expect(z.art).toBe('schema')
        expect(z.racecourse).toBe(rc)
        expect(z.schema!.racecourse).toBe(rc)
        for (const b of bojenVon(maskeFuer(sicht, klasse)!)) expect(z.schema!.punkte.some((p) => p.id === z.treffer[b.feld])).toBe(true)
        expect(z.blass).toEqual([])
      }
    }
  })

  it('inlineSvg lässt die Bahn, wie sie ist (keine Deckkraft), und bringt kein Rasterbild', () => {
    const sicht = sichtRc('B')
    const z = bildTreffer(sicht, klasseVon(sicht), parcoursSvg)!
    const html = inlineSvg(parcoursSvg(PARALLEL_DATEI)!, { praefix: 'x-', drehung: 0, dim: [...z.bild!.dim, ...z.blass], aus: z.bild!.aus })
    expect(html).not.toContain('<image')
    expect(html).not.toContain('opacity:0.')
    for (const id of EINE_BAHN) expect(html).toContain(`id="x-${id}"`)
  })
})

describe('Umschalter und Ziel eines Tipps (BD4, BD5)', () => {
  const k = configFor({ regelwerk: 'dm-2026' })
  const sicht = sichtMit(k, 'gate135', 'alcatraz')
  const sieben = maskeFuer(sicht, '7')!
  const z7 = bildTreffer(sicht, '7', parcoursSvg)!
  const feldBei = (a: MaskenAufbau, z: ReturnType<typeof bildTreffer>, id: string, weg: 'hin' | 'rueck' | 'rueck2') => bildZiel(a, z!, id, weg)?.boje.feld

  it('Klasse 7: Hin, Rück und Rück 2 (Tor 1 der Speedrunde)', () => {
    expect(bildWege(sieben)).toEqual(['hin', 'rueck', 'rueck2'])
    expect(feldBei(sieben, z7, 'Tor1_innen', 'hin')).toBe('t1a|hin seiteB')
    expect(feldBei(sieben, z7, 'Tor1_innen', 'rueck')).toBe('t1b|rueck seiteB')
    expect(feldBei(sieben, z7, 'Tor1_innen', 'rueck2')).toBe('t1c|rueck seiteB')
    expect(feldBei(sieben, z7, 'Tor5_unten', 'hin')).toBe('t5|hin seiteA')
    expect(feldBei(sieben, z7, 'Tor5_unten', 'rueck')).toBe('t5|rueck seiteA')
    // Rück 2 kennt Tor 3 nicht – es bleibt beim Rückweg.
    expect(feldBei(sieben, z7, 'Tor3_innen', 'rueck2')).toBe('t3b|rueck seiteB')
    expect(bildZiel(sieben, z7, 'Tor2_innen', 'hin')).toBeNull()
  })

  it('Klasse 4 ohne Tor 1 rück: Tor 1 ist auch auf dem Rückweg die Hinfahrt; kein Rück 2', () => {
    const vier = maskeFuer(sicht, '4')!
    const z4 = bildTreffer(sicht, '4', parcoursSvg)!
    expect(bildWege(vier)).toEqual(['hin', 'rueck'])
    expect(feldBei(vier, z4, 'Tor1_innen', 'rueck')).toBe('t1a|hin seiteB')
  })

  it('BD4 umgebaut (R8-20, 22.11.2026): kein Wechsel von selbst – an Tor 5 auf dem Hinweg ist zweimal dieselbe Boje', () => {
    // Ohne wegNachTipp bleibt die Seite stehen: Der zweite Tipp an derselben ID auf „hin“ trifft wieder Tor 5 hin.
    const t5 = bildZiel(sieben, z7, 'Tor5_unten', 'hin')!
    expect(t5.halt.weg).toBe('hin')
    expect(bildZiel(sieben, z7, 'Tor5_unten', 'hin')!.boje.feld).toBe(t5.boje.feld)
    expect(WKR_ANNAHMEN.bildUmschalterNurVonHand).toBe(true)
  })

  it('Zahlen je Seite: Rück 2 getrennt', () => {
    let e = leererEntwurf()
    e = tippeBoje(e, bildZiel(sieben, z7, 'Tor1_innen', 'hin')!.boje)
    e = tippeBoje(e, bildZiel(sieben, z7, 'Tor1_innen', 'rueck2')!.boje)
    e = tippeBoje(e, bildZiel(sieben, z7, 'Tor5_unten', 'rueck')!.boje)
    expect(bildZahlen(e, sieben)).toEqual({ hin: 1, rueck: 1, rueck2: 1 })
    expect(bojenMitHalt(sieben).length).toBe(bojenVon(sieben).length)
  })

  it('bildZuordnung ohne SVG prüft nur die Tabelle', () => {
    const z = bildZuordnung(sieben, { bild: sicht.klassen['7']!.bild })!
    expect(z.treffer['speed2']).toBe('Speedboje_unten')
  })
})

describe('Zeichnung inline und Trefferflächen (BD6)', () => {
  it('Präfix an jeder ID und jedem Verweis, Drehung in viewBox, gedimmt über eigene Regeln', () => {
    const svg = parcoursSvg('Klasse3')!
    const s = inlineSvg(svg, { praefix: 'wb1-', drehung: 0, dim: ['Tor2'], aus: [] })
    expect(s).not.toMatch(/<\?xml/)
    expect(s).toContain('id="wb1-Tor1_innen"')
    expect(s).not.toMatch(/\bid="Tor1_innen"/)
    expect(s).not.toMatch(/url\(#(?!wb1-)/)
    expect(/<[^<>]*\bid="wb1-Tor2"[^<>]*>/.exec(s)![0]).toMatch(/opacity:0\.2"/)
    expect(s).not.toContain('<style')
    expect(s).toMatch(/viewBox="0 0 853\.32581 360\.8295"/)
    expect(/<svg\b[^>]*>/.exec(s)![0]).not.toMatch(/\swidth=/)
    const q = inlineSvg(svg, { praefix: 'wb2-', drehung: 90, dim: [], aus: [] })
    expect(q).toMatch(/viewBox="-360\.8295 0 360\.8295 853\.32581"/)
    expect(q).toContain('<g transform="rotate(90)">')
    expect(inlineSvg(svg, { praefix: 'wb3-', drehung: -90, dim: [], aus: [] })).toContain('rotate(-90)')
    expect(inlineSvg(svg, { praefix: 'wb4-', drehung: 180, dim: [], aus: [] })).toMatch(/viewBox="-853\.32581 -360\.8295 853\.32581 360\.8295"/)
  })

  it('schiebt nahe Punkte auf den Mindestabstand, ferne bleiben', () => {
    const aus = schiebeAuseinander(
      [
        { id: 'a', x: 100, y: 100 },
        { id: 'b', x: 110, y: 100 },
        { id: 'c', x: 100, y: 100 },
        { id: 'd', x: 400, y: 400 },
      ],
      57,
    )
    for (let i = 0; i < 3; i++) for (let j = i + 1; j < 3; j++) expect(Math.hypot(aus[i].x - aus[j].x, aus[i].y - aus[j].y)).toBeGreaterThanOrEqual(56)
    expect(aus[3]).toEqual({ id: 'd', x: 400, y: 400 })
    expect(aus.map((p) => p.id)).toEqual(['a', 'b', 'c', 'd'])
  })
})

describe('Drehung nach dem Platz (Prüfbefund 22.11.2026, bildDrehungNachPlatz)', () => {
  // Rest über/unter der Zeichnung wie --wkr-bild-rest (styles/wkr-geraet.css), Rand der Fläche wie --wkr-bild-kreis/2 × 2.
  const REST = 380
  const RAND = 72
  const DM = configFor({ regelwerk: 'dm-2026' })

  it('gate135 Klasse 7 auf dem Pad quer 1024×768 (eine Liste, 7fr): nicht hochkant, Zeichnung ≤ Fenster − Rest', () => {
    const bild = sichtMit(DM, 'gate135', 'alcatraz').klassen['7']!.bild!
    expect(Math.abs(bild.drehung)).toBe(90)
    const seiten = svgSeiten(parcoursSvg(bild.datei)!)!
    const platz = { breite: (1024 * 7) / 10 - RAND, hoehe: Math.max(200, 768 - REST) }
    const d = wirksameDrehung(bild.drehung, { pad: true, seiten, platz })
    expect(d).toBe(0)
    const massstab = Math.min(platz.breite / seiten.breite, platz.hoehe / seiten.hoehe)
    expect(seiten.hoehe * massstab).toBeLessThanOrEqual(768 - REST)
  })

  it('±90° nur, wo die gedrehte Zeichnung nicht kleiner wird; 0/180 immer; ohne Platz und auf dem Handy 0', () => {
    const seiten = { breite: 853, hoehe: 361 }
    expect(wirksameDrehung(90, { pad: true, seiten, platz: { breite: 400, hoehe: 1200 } })).toBe(90)
    expect(wirksameDrehung(-90, { pad: true, seiten, platz: { breite: 400, hoehe: 1200 } })).toBe(-90)
    expect(wirksameDrehung(90, { pad: true, seiten, platz: { breite: 600, hoehe: 400 } })).toBe(0)
    expect(wirksameDrehung(90, { pad: true, seiten, platz: null })).toBe(0)
    expect(wirksameDrehung(90, { pad: false, seiten, platz: { breite: 400, hoehe: 1200 } })).toBe(0)
    expect(wirksameDrehung(180, { pad: false, seiten: null, platz: null })).toBe(180)
    expect(svgSeiten('<svg viewBox="0 0 10 20">')).toEqual({ breite: 10, hoehe: 20 })
    expect(svgSeiten('<svg>')).toBeNull()
  })
})

describe('Lage der Zeichnung nach Wahl des WKR (Nutzer 24.11.2026, BL1–BL5; Namen nach Start/Ziel 26.11.2026, BL7)', () => {
  /** Wohin ein Punkt der Datei (x, y) bei einer Drehung im Uhrzeigersinn wandert – wie inlineSvg (`<g rotate>` + viewBox). */
  function seiteNach(drehung: number, x: number, y: number): 'unten' | 'links' | 'oben' | 'rechts' {
    const svg = '<svg viewBox="0 0 100 40"><circle id="p" cx="0" cy="0" r="1"/></svg>'
    const s = inlineSvg(svg, { praefix: 'l-', drehung, dim: [], aus: [] })
    const [vx, vy, vw, vh] = /viewBox="([^"]+)"/.exec(s)![1].split(' ').map(Number)
    const r = (((drehung % 360) + 360) % 360) * (Math.PI / 180)
    // rotate(d) in SVG: x' = x·cos − y·sin, y' = x·sin + y·cos (y nach unten = im Uhrzeigersinn auf dem Bildschirm).
    const px = (x * Math.cos(r) - y * Math.sin(r) - vx) / vw
    const py = (x * Math.sin(r) + y * Math.cos(r) - vy) / vh
    if (py > 0.9) return 'unten'
    if (py < 0.1) return 'oben'
    return px < 0.5 ? 'links' : 'rechts'
  }

  it('BL7: Drehung im Uhrzeigersinn – die linke Kante der Datei (Start/Ziel) landet oben, rechts, unten; die Wende gegenüber', () => {
    expect(BILD_LAGEN).toEqual([0, 90, 180, 270])
    for (const l of BILD_LAGEN) {
      // Mitte der linken Kante = Start/Ziel, Mitte der rechten Kante = Tor 5 bzw. Boje 5 (die Wende).
      expect(seiteNach(l, 0, 20)).toBe(BILD_LAGE_SEITE[l].start)
      expect(seiteNach(l, 100, 20)).toBe(BILD_LAGE_SEITE[l].wende)
    }
    expect(BILD_LAGE_SEITE[0]).toEqual({ start: 'links', wende: 'rechts' })
    expect(BILD_LAGE_SEITE[90]).toEqual({ start: 'oben', wende: 'unten' })
  })

  /**
   * Mitte eines Elements der Zeichnung in Koordinaten der Datei: erster Punkt seiner ersten Form plus alle Verschiebungen
   * darüber. Andere transforms als `translate` lässt die Probe nicht zu (sie würfe) – dann stimmte die Rechnung nicht.
   */
  function punktVon(quelle: string, id: string): { x: number; y: number } {
    const doc = new DOMParser().parseFromString(quelle, 'image/svg+xml')
    const el = doc.getElementById(id)
    if (!el) throw new Error(`${id} fehlt`)
    const form = ['path', 'circle', 'ellipse', 'rect'].includes(el.tagName.toLowerCase()) ? el : el.querySelector('path, circle, ellipse, rect')
    if (!form) throw new Error(`${id} ohne Form`)
    let x: number
    let y: number
    if (form.tagName.toLowerCase() === 'path') {
      const m = /^\s*[mM]\s*(-?[\d.]+(?:e-?\d+)?)[\s,]+(-?[\d.]+(?:e-?\d+)?)/.exec(form.getAttribute('d') ?? '')
      if (!m) throw new Error(`${id}: Pfad ohne Anfang`)
      x = Number(m[1])
      y = Number(m[2])
    } else {
      x = Number(form.getAttribute('cx') ?? form.getAttribute('x'))
      y = Number(form.getAttribute('cy') ?? form.getAttribute('y'))
    }
    for (let n: Element | null = form; n; n = n.parentElement) {
      const t = n.getAttribute('transform')
      if (!t) continue
      const m = /^\s*translate\(\s*(-?[\d.]+(?:e-?\d+)?)(?:[\s,]+(-?[\d.]+(?:e-?\d+)?))?\s*\)\s*$/.exec(t)
      if (!m) throw new Error(`${id}: transform „${t}“ ist keine Verschiebung`)
      x += Number(m[1])
      y += Number(m[2] ?? 0)
    }
    return { x, y }
  }
  /** Kante, der ein Punkt der Datei nach der Drehung am nächsten liegt – im viewBox, den inlineSvg wirklich setzt. */
  function kanteIm(quelle: string, drehung: number, p: { x: number; y: number }): 'unten' | 'links' | 'oben' | 'rechts' {
    const s = inlineSvg(quelle, { praefix: 'k-', drehung, dim: [], aus: [] })
    const [vx, vy, vw, vh] = /<svg\b[^>]*\bviewBox="([^"]+)"/.exec(s)![1].split(/[\s,]+/).map(Number)
    const r = (((drehung % 360) + 360) % 360) * (Math.PI / 180)
    const px = (p.x * Math.cos(r) - p.y * Math.sin(r) - vx) / vw
    const py = (p.x * Math.sin(r) + p.y * Math.cos(r) - vy) / vh
    const abstand = { links: px, rechts: 1 - px, oben: py, unten: 1 - py }
    return (Object.keys(abstand) as (keyof typeof abstand)[]).reduce((a, b) => (abstand[b] < abstand[a] ? b : a))
  }

  it('BL7 an den echten Zeichnungen (Nutzer 26.11.2026, R11-13): „Start/Ziel links“ zeigt Start/Ziel links, Tor 5 bzw. Boje 5 rechts – jede Lage', () => {
    const proben: [string, string, string][] = [
      ...PARCOURS_DATEIEN.map((d): [string, string, string] => [d, 'StartZiel', 'Tor5']),
      [PARALLEL_DATEI, 'A_StartZiel_unten', 'A_Boje5'],
      [PARALLEL_DATEI, 'A_StartZiel_oben', 'A_Boje5'],
    ]
    for (const [datei, start, wende] of proben) {
      const quelle = parcoursSvg(datei)!
      expect(quelle, datei).toBeTruthy()
      const s = punktVon(quelle, start)
      const t = punktVon(quelle, wende)
      // In der Datei (0°) liegt Start/Ziel im linken Viertel, die Wende im rechten – nicht nur „weiter links“.
      const breite = svgSeiten(quelle)!.breite
      expect(s.x / breite, `${datei} ${start}`).toBeLessThan(0.25)
      expect(t.x / breite, `${datei} ${wende}`).toBeGreaterThan(0.75)
      for (const l of BILD_LAGEN) {
        expect(kanteIm(quelle, l, s), `${datei} ${l}° ${start}`).toBe(BILD_LAGE_SEITE[l].start)
        expect(kanteIm(quelle, l, t), `${datei} ${l}° ${wende}`).toBe(BILD_LAGE_SEITE[l].wende)
      }
    }
  })

  it('BL3: Die Wahl geht vor Blick, Gerät und Platz; ohne Wahl alles wie bisher', () => {
    const seiten = { breite: 853, hoehe: 361 }
    const eng = { breite: 600, hoehe: 400 }
    // Handy, Blick „hinten“ (90°): ohne Wahl liegend (0°), mit Wahl genau sie – auch 270° und 180°.
    expect(wirksameDrehung(90, { pad: false, seiten, platz: eng })).toBe(0)
    expect(wirksameDrehung(90, { pad: false, seiten, platz: eng, wahl: null })).toBe(0)
    expect(wirksameDrehung(90, { pad: false, seiten, platz: eng, wahl: 90 })).toBe(90)
    expect(wirksameDrehung(90, { pad: true, seiten, platz: eng, wahl: 270 })).toBe(270)
    expect(wirksameDrehung(180, { pad: false, seiten: null, platz: null, wahl: 0 })).toBe(0)
    expect(wirksameDrehung(0, { pad: false, seiten: null, platz: null, wahl: 180 })).toBe(180)
    // Unbekanntes gilt als keine Wahl.
    expect(wirksameDrehung(180, { pad: false, seiten, platz: eng, wahl: 45 as never })).toBe(180)
    expect(istBildLage(270)).toBe(true)
    expect(istBildLage(-90)).toBe(false)
    expect(istBildLage('90')).toBe(false)
    expect(lageVonDrehung(-90)).toBe(270)
    expect(lageVonDrehung(450)).toBe(90)
    expect(lageVonDrehung(45)).toBe(0)
    // inlineSvg nimmt 270° wie −90°.
    const svg = parcoursSvg('Klasse3')!
    expect(inlineSvg(svg, { praefix: 'x-', drehung: 270, dim: [], aus: [] })).toContain('<g transform="rotate(-90)">')
  })

  it('BL4: Text dreht um die eigene Mitte zurück, ein vorhandener transform bleibt vorn; 0° und leerer Rahmen nichts', () => {
    const rahmen = { x: 10, y: 20, width: 8, height: 12 }
    expect(aufrechtTransform(null, rahmen, 180)).toBe('rotate(-180 14 26)')
    expect(aufrechtTransform('rotate(2.0137401)', rahmen, 90)).toBe('rotate(2.0137401) rotate(-90 14 26)')
    expect(aufrechtTransform(null, rahmen, 270)).toBe('rotate(-270 14 26)')
    expect(aufrechtTransform(null, rahmen, -90)).toBe('rotate(-270 14 26)')
    expect(aufrechtTransform(null, rahmen, 0)).toBeNull()
    expect(aufrechtTransform(null, { x: 0, y: 0, width: 0, height: 0 }, 90)).toBeNull()
  })

  it('BL4: Zwischen Wurzel und Text der Zeichnungen stehen keine Spiegelungen (sonst dreht die Gegendrehung falsch)', () => {
    for (const datei of [...PARCOURS_DATEIEN, PARALLEL_DATEI]) {
      const svg = parcoursSvg(datei)
      if (!svg) continue
      expect(svg, datei).not.toMatch(/transform="[^"]*(?:scale\([^)]*-|matrix\()/)
    }
  })
})
