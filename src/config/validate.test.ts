import { describe, expect, it } from 'vitest'
import { ueberwachungsLuecken, validateConfigTexts, validateRawConfig, type ConfigIssue } from './validate'
// Gebündelte Standard-Konfiguration (dieselben Dateien, die die App bündelt).
import { dump as yamlDump, load as yamlLoad } from 'js-yaml'
import bundledListe from './regelwerke.yaml?raw'
import bundledAufbauten from './aufbauten.yaml?raw'
import { mergePositionen, quellDateien } from './merge-positionen'
import { aufloesen } from './kurzform'
import type { RawQuelle } from './schema'

const bundledRegelwerke = Object.fromEntries(
  Object.entries(
    import.meta.glob('./regelwerke/*.yaml', { query: '?raw', import: 'default', eager: true }) as Record<string, string>,
  ).map(([pfad, text]) => [pfad.replace('./regelwerke/', '').replace('.yaml', ''), text]),
)
const positionenTeile = import.meta.glob(['./einstellungen.yaml', './i18n/*.yaml', './aufbauten/*.yaml'], {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>

/** Die Positions-Dateien zusammengeführt, wahlweise mit geändertem Text. */
function positionenText(aendern: (text: string) => string = (t) => t): string {
  const teile = quellDateien(bundledAufbauten).map((n) => yamlLoad(aendern(positionenTeile[`./${n}.yaml`])))
  return yamlDump(mergePositionen(teile), { lineWidth: -1, noRefs: true })
}

const texte = { liste: bundledListe, regelwerke: bundledRegelwerke, positionen: positionenText() }

const errors = (issues: ConfigIssue[]) => issues.filter((i) => i.severity === 'error')

describe('Konfigurations-Validierung', () => {
  it('die gebündelte Konfiguration ist fehlerfrei', () => {
    const issues = validateConfigTexts(texte)
    // Bei einem Treffer die Meldungen sichtbar machen (erleichtert die Suche).
    expect(errors(issues), errors(issues).map((i) => `${i.where}: ${i.message}`).join('\n')).toEqual([])
  })

  it('meldet ein gelistetes Regelwerk ohne Datei und eine Datei ohne Listeneintrag', () => {
    const codes = validateConfigTexts({
      ...texte,
      liste: 'regelwerke: [dm-2026, gibtsnicht]',
    }).map((i) => i.code)
    expect(codes).toContain('MISSING_REGELWERK')
    expect(codes).toContain('ORPHAN_REGELWERK') // uim-2026 steht nicht mehr in der Liste
  })

  it('meldet eine Regelwerk-ID, die nicht zum Dateinamen passt', () => {
    const codes = validateConfigTexts({
      ...texte,
      regelwerke: { 'dm-2026': bundledRegelwerke['uim-2026'] },
      liste: 'regelwerke: [dm-2026]',
    }).map((i) => i.code)
    expect(codes).toContain('BAD_REGELWERK_ID')
  })

  it('prüft die Positionen gegen jedes Regelwerk: fehlender Katalog in einem genügt', () => {
    const ohneTor5 = bundledRegelwerke['uim-2026'].replace('  tor5:', '  tor5x:')
    const issues = validateConfigTexts({ ...texte, regelwerke: { ...bundledRegelwerke, 'uim-2026': ohneTor5 } })
    expect(errors(issues).map((i) => i.code)).toContain('UNKNOWN_KATALOG')
    expect(errors(issues).find((i) => i.code === 'UNKNOWN_KATALOG')?.where).toContain('uim-2026')
  })

  it('meldet fehlende Übersetzungen, wenn das Regelwerk Englisch anbietet', () => {
    const ohneEn = bundledRegelwerke['uim-2026'].replace(', en: "Additional touch of the starting pontoon"', '')
    const issues = errors(validateConfigTexts({ ...texte, regelwerke: { ...bundledRegelwerke, 'uim-2026': ohneEn } }))
    expect(issues.map((i) => i.code)).toContain('MISSING_EN')
    const ohneWort = positionenText((t) => t.replace('"Bemerkung": "Remarks"', ''))
    const issues2 = errors(validateConfigTexts({ ...texte, positionen: ohneWort }))
    expect(issues2.find((i) => i.code === 'MISSING_EN')?.message).toContain('Bemerkung')
  })

  it('meldet unbekannte Bereiche, Buchstaben-Listen und ungültige Codes', () => {
    const raw = {
      disqualifikationen: [
        { code: 'AB', text: 'x' },
        { code: 'C', text: 'x', bereiche: ['gibtsnicht'] },
      ],
      kataloge: { k: { fehler: [{ code: 'x1', text: 'x', punkte: 5 }] } },
      klassen: ['9'],
      ohneSpalten: { p: ['fehlt'] },
      positionen: [
        { id: 'p', disq: 'tippfehler', spalten: [] },
        { id: 'q', disq: ['A'] as unknown as string, spalten: [] },
      ],
    }
    const codes = validateRawConfig(raw).map((i) => i.code)
    expect(codes).toEqual(
      expect.arrayContaining(['BAD_DISQ_CODE', 'UNKNOWN_DISQ_BEREICH', 'BAD_DISQ', 'BAD_FEHLER_CODE', 'BAD_KLASSE', 'UNKNOWN_SPALTE']),
    )
  })

  describe('Ergebnislisten', () => {
    const codes = (aendern: (text: string) => string) =>
      validateConfigTexts({ ...texte, positionen: positionenText(aendern) }).map((i) => i.code)

    it('meldet ein Feld, das in keiner Ergebnisspalte steht', () => {
      const nurStart = (t: string) =>
        t.replace('ergebnisspalten: fahrweg', 'ergebnisspalten: [{ label: "Start", felder: ["start|hin seiteA", "start|hin seiteB"] }]')
      expect(codes(nurStart)).toContain('ERGEBNIS_LUECKE')
    })

    it('meldet eine ungültige oder widersprüchliche Abwandlung im Aufbau', () => {
      const dm26 = '      - { id: zeit, zeiten: [elektronisch] }\n'
      expect(codes((t) => t.replace(dm26, '      - { id: zeit, zeiten: [sanduhr] }\n'))).toContain('BAD_AUFBAU_EINTRAG')
      expect(codes((t) => t.replace(dm26, '      - { id: zeit, farbe: rot }\n'))).toContain('BAD_AUFBAU_EINTRAG')
      // Ein zweiter Aufbau wandelt zeit-1 anders ab als Alcatraz-DM26.
      const zweiter = (t: string) =>
        t.replace('aufbauten:\n', 'aufbauten:\n  - { id: probe, name: Probe, positionen: [{ id: zeit, zeiten: [stoppuhr] }, steg] }\n')
      expect(codes(zweiter)).toContain('ABWANDLUNG_KONFLIKT')
    })

    it('meldet einen Aufbau mit unbekannter Disziplin', () => {
      expect(codes((t) => t.replace('disziplin: parallel', 'disziplin: gibtsnicht'))).toContain('UNKNOWN_DISZIPLIN')
    })

    it('weist auf eine Ergebnisspalte ohne bekanntes Feld hin', () => {
      expect(codes((t) => t.replace('felder: [b5]', 'felder: [b5, tippfehler]'))).toContain('UNKNOWN_ERGEBNIS_FELD')
    })
  })

  describe('Überwachung', () => {
    const roh = (aendern?: (t: string) => string) =>
      aufloesen(yamlLoad(positionenText(aendern)) as RawQuelle) as Parameters<typeof ueberwachungsLuecken>[0]
    const luecken = (raw: Parameters<typeof ueberwachungsLuecken>[0], aufbau: string) =>
      ueberwachungsLuecken(raw).filter((l) => l.aufbau === aufbau)

    it('jeder Aufbau überwacht jede Boje, auch zusammengelegt', () => {
      expect(ueberwachungsLuecken(roh())).toEqual([])
    })

    it('meldet einen falschen Spaltennamen', () => {
      const raw = { positionen: [{ id: 'p', spalten: [{ key: 't4a', label: 'Tor 2', typ: 'boje' as const, innen: 'seiteA' as const }] }] }
      expect(validateRawConfig(raw).map((i) => i.code)).toContain('FALSCHER_TORNAME')
    })

    it('meldet eine Boje, die mit zusammengelegter Tor-5-Liste nicht mehr überwacht wird', () => {
      // Ohne Start/Ziel auf der DM26-Liste gehen sie beim Zusammenlegen verloren.
      const ohneStartZiel = roh((t) =>
        t.replace('    bojen: [StartZiel]\n    aufgaben: [tor5, parcours]\n', '    aufgaben: [tor5, parcours]\n'),
      )
      const l = luecken(ohneStartZiel, 'alcatrazdm26')
      expect(l.map((x) => x.element)).toEqual(['Start (hin seiteA)', 'Start (hin seiteB)', 'Ziel (rueck seiteA)', 'Ziel (rueck seiteB)'])
      expect(l.every((x) => x.nurZusammengelegt)).toBe(true)
      expect(l[0].klassen).toHaveLength(8)
    })

    it('beachtet die Klassen: Tor 1 auf der Rückfahrt nicht bei Klasse 4, MüB erst ab Klasse 4', () => {
      const ohneMueb = roh((t) => t.replace('[zeit, vorsteg, steg, gate135, gate245, tor5, mueb, parcours]', '[zeit, vorsteg, steg, gate135, gate245, tor5, parcours]'))
      expect(luecken(ohneMueb, 'alcatraz').map((l) => [l.element, l.klassen])).toEqual([['Mann-über-Bord', ['4', '5', '6', '7']]])
    })

    it('lässt Aufbauten mit eigener Strecke aus', () => {
      expect(luecken(roh(), 'parallel')).toEqual([])
    })

    it('zeigt Lücken als Hinweis in der Prüfung, nicht als Fehler', () => {
      const raw = {
        ueberwachung: [{ name: 'Start', key: 'start' }],
        aufbauten: [{ id: 'a', name: 'A', positionen: ['p'] }],
        positionen: [{ id: 'p', spalten: [{ key: 'x', label: 'X', typ: 'boje' as const }] }],
      }
      const issues = validateRawConfig(raw).filter((i) => i.code === 'NICHT_UEBERWACHT')
      expect(issues.map((i) => i.severity)).toEqual(['warning'])
      expect(issues[0].message).toContain('alle Klassen')
    })
  })

  it('findet doppelte Positions-IDs', () => {
    const raw = { positionen: [{ id: 'zeit', spalten: [] }, { id: 'zeit', spalten: [] }] }
    expect(validateRawConfig(raw).map((i) => i.code)).toContain('DUP_POSITION_ID')
  })

  it('findet doppelte Spalten-Keys innerhalb einer Position', () => {
    const raw = {
      positionen: [
        {
          id: 'p',
          spalten: [
            { key: 'a', label: 'A', typ: 'boje' as const },
            { key: 'a', label: 'A2', typ: 'boje' as const },
          ],
        },
      ],
    }
    expect(validateRawConfig(raw).map((i) => i.code)).toContain('DUP_SPALTE_KEY')
  })

  it('findet einen Aufbau, der eine unbekannte Position referenziert', () => {
    const raw = {
      aufbauten: [{ id: 'x', name: 'X', positionen: ['zeit', 'gibtsnicht'] }],
      positionen: [{ id: 'zeit', spalten: [] }],
    }
    const codes = validateRawConfig(raw).map((i) => i.code)
    expect(codes).toContain('UNKNOWN_POSITION_REF')
  })

  it('findet punkteSpalte / summeSpalte, die nicht existiert oder keine Summe ist', () => {
    const raw = {
      positionen: [
        {
          id: 'p',
          summeSpalte: 'fehlt',
          spalten: [
            { key: 'f', label: 'F', typ: 'code' as const, punkteSpalte: 'gibtsnicht' },
            { key: 'b', label: 'B', typ: 'boje' as const },
          ],
        },
      ],
    }
    const codes = validateRawConfig(raw).map((i) => i.code)
    expect(codes).toContain('UNKNOWN_SUMME_SPALTE')
    expect(codes).toContain('UNKNOWN_PUNKTE_SPALTE')
  })

  it('meldet einen Verweis auf einen unbekannten Katalog', () => {
    const raw = {
      positionen: [{ id: 'p', katalog: 'gibtsnicht', spalten: [{ key: 'x', label: 'X', typ: 'boje' as const }] }],
    }
    expect(validateRawConfig(raw).map((i) => i.code)).toContain('UNKNOWN_KATALOG')
  })

  it('akzeptiert eine korrekte Minimal-Konfiguration ohne Befund', () => {
    const raw = {
      kataloge: { k: { fehler: [{ code: 1, text: 'x', punkte: 5 }] } },
      aufbauten: [{ id: 'a', name: 'A', positionen: ['p'] }],
      positionen: [
        {
          id: 'p',
          katalog: 'k',
          summeSpalte: 'sum',
          spalten: [
            { key: 'f', label: 'F', typ: 'code' as const, punkteSpalte: 'sum' },
            { key: 'sum', label: 'Σ', typ: 'summe' as const },
          ],
        },
      ],
    }
    expect(validateRawConfig(raw)).toEqual([])
  })
})

describe('Fehlerpunkte-Spalten', () => {
  it('neben jeder Fehler-Spalte steht eine Punkte-Spalte, die die Punkte einzeln zeigt', () => {
    for (const pos of aufloesen(yamlLoad(positionenText()) as RawQuelle).positionen) {
      const spalten = pos.spalten ?? []
      for (const sp of spalten.filter((s) => s.typ === 'code')) {
        const ziel = spalten.find((s) => s.key === sp.punkteSpalte)
        expect(ziel?.einzeln, `${pos.id}: ${sp.key}`).toBe(true)
      }
    }
  })
})
