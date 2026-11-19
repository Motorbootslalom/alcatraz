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

  it('vorgabeListen: nur Positionen, die sich in jedem Aufbau wählen lassen', () => {
    const positionen = [
      { id: 'knoten', titel: 'Knoten', schnellauswahl: true, spalten: [{ key: 'a', label: 'A', typ: 'boje' as const }] },
      { id: 'steg', titel: 'Steg', spalten: [{ key: 'a', label: 'A', typ: 'boje' as const }] },
    ]
    const disziplinen = [{ id: 'manoevrieren' }]
    const codes = (vorgabeListen: unknown) => validateRawConfig({ positionen, disziplinen, vorgabeListen: vorgabeListen as Record<string, string[]> }).map((i) => i.code)
    const neu = (liste: unknown) => codes(liste).filter((c) => !codes(undefined).includes(c))
    expect(neu({ manoevrieren: ['knoten'] })).toEqual([])
    expect(neu({ manoevrieren: ['gibtsnicht'] })).toEqual(['UNKNOWN_VORGABELISTE'])
    expect(neu({ manoevrieren: ['steg'] })).toEqual(['VORGABELISTE_NICHT_WAEHLBAR'])
    expect(neu({ manoevrieren: ['knoten', 'knoten'] })).toEqual(['DUP_VORGABELISTE'])
    // Die Vorgabe hängt an der Disziplin – eine bloße Liste gälte auch im Parallelslalom.
    expect(neu(['knoten'])).toEqual(['BAD_VORGABELISTEN'])
    expect(neu({ manoevrieren: 'knoten' })).toEqual(['BAD_VORGABELISTEN'])
    expect(neu({ gibtsnicht: ['knoten'] })).toEqual(['UNKNOWN_VORGABE_DISZIPLIN'])
  })

  it('wertungslaeufe: mindestens ein Lauf, weniger Streichläufe als Läufe', () => {
    const codes = (wertungslaeufe: unknown) => validateRawConfig({ wertungslaeufe: wertungslaeufe as { laeufe: number } }).map((i) => i.code)
    const neu = (w: unknown) => codes(w).filter((c) => !codes(undefined).includes(c))
    expect(neu({ laeufe: 2, streichlaeufe: 1 })).toEqual([])
    expect(neu({ laeufe: 3 })).toEqual([])
    expect(neu({ laeufe: 2, streichlaeufe: 2 })).toEqual(['BAD_WERTUNGSLAEUFE'])
    expect(neu({ laeufe: 0 })).toEqual(['BAD_WERTUNGSLAEUFE'])
    expect(neu({ streichlaeufe: 1 })).toEqual(['BAD_WERTUNGSLAEUFE'])
    expect(neu('zwei')).toEqual(['BAD_WERTUNGSLAEUFE'])
    // `nurVorgabe` (Voreinstellung ohne Hinweis bei Abweichung) ist ein Wahrheitswert.
    expect(neu({ laeufe: 3, streichlaeufe: 1, nurVorgabe: true })).toEqual([])
    expect(neu({ laeufe: 3, streichlaeufe: 1, nurVorgabe: false })).toEqual([])
    expect(neu({ laeufe: 3, streichlaeufe: 1, nurVorgabe: 'ja' })).toEqual(['BAD_WERTUNGSLAEUFE'])
  })

  it('wertungJeDisziplin: je Disziplin nur stichentscheid und wertungslaeufe, in ihrer Form', () => {
    const codes = (mehr: Record<string, unknown>) => validateRawConfig(mehr as Parameters<typeof validateRawConfig>[0]).map((i) => i.code)
    const neu = (je: unknown) => codes({ wertungJeDisziplin: je }).filter((c) => !codes({}).includes(c))
    expect(neu({ parallel: { wertungslaeufe: { laeufe: 2, streichlaeufe: 0 }, stichentscheid: ['besterLauf'] } })).toEqual([])
    expect(neu({ parallel: { stichentscheid: ['besterLauf'] } })).toEqual([])
    expect(neu({ parallel: {} })).toEqual([])
    expect(neu('parallel')).toEqual(['BAD_WERTUNG_JE_DISZIPLIN'])
    expect(neu({ parallel: true })).toEqual(['BAD_WERTUNG_JE_DISZIPLIN'])
    expect(neu({ parallel: { punkte: 3 } })).toEqual(['BAD_WERTUNG_JE_DISZIPLIN'])
    expect(neu({ parallel: { stichentscheid: 'besterLauf' } })).toEqual(['BAD_STICHENTSCHEID'])
    expect(neu({ parallel: { stichentscheid: ['muenzwurf'] } })).toEqual(['UNKNOWN_STICHENTSCHEID'])
    expect(neu({ parallel: { stichentscheid: ['besterLauf', 'besterLauf'] } })).toEqual(['DUP_STICHENTSCHEID'])
    expect(neu({ parallel: { wertungslaeufe: { laeufe: 2, streichlaeufe: 2 } } })).toEqual(['BAD_WERTUNGSLAEUFE'])
    // `nurVorgabe` und `nachRegel` gibt es hier nicht: Die Läufe dieser Disziplin stellt niemand ein.
    expect(neu({ parallel: { wertungslaeufe: { laeufe: 2, streichlaeufe: 0, nurVorgabe: true } } })).toEqual(['BAD_WERTUNGSLAEUFE'])
    // Eine Disziplin, die die Konfiguration nicht kennt.
    const mitDisziplinen = (je: unknown) => codes({ disziplinen: [{ id: 'manoevrieren', name: 'M' }], wertungJeDisziplin: je }).filter((c) => !codes({ disziplinen: [{ id: 'manoevrieren', name: 'M' }] }).includes(c))
    expect(mitDisziplinen({ parallel: {} })).toEqual(['UNKNOWN_WERTUNG_DISZIPLIN'])
    expect(mitDisziplinen({ manoevrieren: {} })).toEqual([])
  })

  it('aushang und versucheNacheinander: nur Ja/Nein; Punkte brauchen die Punktetabelle', () => {
    const codes = (mehr: Record<string, unknown>) => validateRawConfig(mehr as Parameters<typeof validateRawConfig>[0]).map((i) => i.code)
    const neu = (mehr: Record<string, unknown>) => codes(mehr).filter((c) => !codes({}).includes(c))
    const pokal = { uim: { punkte: [400, 300], beste: 5, mindestens: 5 } }
    expect(neu({ aushang: { unterschrift: true, punkte: true }, pokal })).toEqual(neu({ pokal }))
    expect(neu({ aushang: { unterschrift: false } })).toEqual([])
    expect(neu({ aushang: { unterschrift: 'ja' } })).toEqual(['BAD_AUSHANG'])
    expect(neu({ aushang: { stempel: true } })).toEqual(['BAD_AUSHANG'])
    expect(neu({ aushang: true })).toEqual(['BAD_AUSHANG'])
    expect(neu({ aushang: { punkte: true } })).toEqual(['AUSHANG_OHNE_PUNKTE'])
    expect(neu({ versucheNacheinander: true })).toEqual([])
    expect(neu({ versucheNacheinander: false })).toEqual([])
    expect(neu({ versucheNacheinander: 'ja' })).toEqual(['BAD_VERSUCHE_NACHEINANDER'])
  })

  it('startabstaende: bekannte Klassen, ganze Sekunden von 30 bis 600', () => {
    const codes = (mehr: Record<string, unknown>) => validateRawConfig(mehr as Parameters<typeof validateRawConfig>[0]).map((i) => i.code)
    const neu = (startabstaende: unknown) => codes({ startabstaende }).filter((c) => !codes({}).includes(c))
    expect(neu({ E: 120, 1: 110, 7: 140 })).toEqual([])
    expect(neu({ E: 30, 1: 600 })).toEqual([])
    expect(neu({ E: 29 })).toEqual(['BAD_STARTABSTAND'])
    expect(neu({ E: 601 })).toEqual(['BAD_STARTABSTAND'])
    expect(neu({ E: 90.5 })).toEqual(['BAD_STARTABSTAND'])
    expect(neu({ E: '120' })).toEqual(['BAD_STARTABSTAND'])
    expect(neu({ M: 120 })).toEqual(['UNKNOWN_STARTABSTAND_KLASSE'])
    expect(neu([120, 110])).toEqual(['BAD_STARTABSTAENDE'])
    expect(neu(120)).toEqual(['BAD_STARTABSTAENDE'])
  })

  it('startNrBereiche (19.11.2026): bekannte Klassen, Nummern der Klasse, von ≤ bis, Größengruppe, keine Überschneidung', () => {
    const codes = (mehr: Record<string, unknown>) => validateRawConfig(mehr as Parameters<typeof validateRawConfig>[0]).map((i) => i.code)
    const neu = (startNrBereiche: unknown) => codes({ startNrPraefix: { E: 'E' }, startNrBereiche }).filter((c) => !codes({}).includes(c))
    expect(neu({ E: [{ von: 'E101', bis: 'E130', gruppe: 'S-M' }], 5: [{ von: 501, bis: 510, gruppe: 'S-M' }, { von: 511, bis: 530, gruppe: 'L-XL' }] })).toEqual([])
    expect(neu({ 5: [{ von: 510, bis: 501, gruppe: 'S-M' }] })).toEqual(['BAD_STARTNR_BEREICH'])
    expect(neu({ 5: [{ von: 601, bis: 610, gruppe: 'S-M' }] })).toEqual(['BAD_STARTNR_BEREICH'])
    expect(neu({ 5: [{ von: 501, bis: 510, gruppe: 'XL' }] })).toEqual(['BAD_STARTNR_GRUPPE'])
    expect(neu({ 5: [{ von: 501, bis: 510, gruppe: 'S-M' }, { von: 510, bis: 520, gruppe: 'L-XL' }] })).toEqual(['DUP_STARTNR_BEREICH'])
    expect(neu({ M: [] })).toEqual(['UNKNOWN_STARTNR_KLASSE'])
    expect(neu({ 5: 'x' })).toEqual(['BAD_STARTNR_BEREICHE'])
    expect(neu([1])).toEqual(['BAD_STARTNR_BEREICHE'])
  })

  it('startabstaende: einstellungen.yaml nennt jede Klasse; ein Regelwerk ersetzt je Klasse und wird mitgeprüft', () => {
    const allgemein = (yamlLoad(texte.positionen) as RawQuelle).startabstaende ?? {}
    for (const k of ['E', '1', '2', '3', '4', '5', '6', '7']) expect(allgemein[k], `Klasse ${k}`).toBeGreaterThanOrEqual(30)
    // Ein falscher Wert im Regelwerk fällt auf – mit der Datei des Regelwerks als Fundstelle.
    const mitAbstand = (zeile: string) => ({ ...bundledRegelwerke, 'dm-2026': bundledRegelwerke['dm-2026'].replace('\nid: dm-2026\n', `\nid: dm-2026\n${zeile}\n`) })
    expect(errors(validateConfigTexts({ ...texte, regelwerke: mitAbstand('startabstaende: { E: 100 }') }))).toEqual([])
    const falsch = errors(validateConfigTexts({ ...texte, regelwerke: mitAbstand('startabstaende: { E: 10 }') }))
    expect(falsch.map((i) => [i.code, i.where])).toEqual([['BAD_STARTABSTAND', 'regelwerke/dm-2026.yaml: startabstaende']])
    const keinObjekt = errors(validateConfigTexts({ ...texte, regelwerke: mitAbstand('startabstaende: [100]') }))
    expect(keinObjekt.map((i) => i.code)).toEqual(['BAD_STARTABSTAENDE'])
    // Ein Fehler in einstellungen.yaml gilt für jedes Regelwerk und steht deshalb nur einmal da.
    const allgemeinFalsch = errors(validateConfigTexts({ ...texte, positionen: positionenText((t) => t.replace('startabstaende: { E: 120,', 'startabstaende: { E: 1200,')) }))
    expect(allgemeinFalsch.map((i) => i.code)).toEqual(['BAD_STARTABSTAND'])
  })

  it('Stichentscheid: nur Kriterien, die die Wertung kennt, und jedes einmal', () => {
    const codes = (stichentscheid: unknown) => validateRawConfig({ stichentscheid: stichentscheid as string[] }).map((i) => i.code)
    expect(codes(['schnellsterLauf', 'besterLauf', 'summeAllerLaeufe'])).toEqual([])
    expect(codes(['losentscheid'])).toContain('UNKNOWN_STICHENTSCHEID')
    expect(codes(['besterLauf', 'besterLauf'])).toContain('DUP_STICHENTSCHEID')
    expect(codes('besterLauf')).toContain('BAD_STICHENTSCHEID')
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
    // Ein mitgelieferter Titel ohne Übersetzung bleibt ein Fehler; nur eigene Aufbauten dürfen frei benennen.
    const ohneTitel = positionenText((t) => t.replace('"Steg": "Pontoon"', ''))
    expect(errors(validateConfigTexts({ ...texte, positionen: ohneTitel })).map((i) => i.code)).toContain('MISSING_EN')
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

  describe('Wertungslisten', () => {
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

    it('Parallelslalom: Die Spalten seiner Listen hängen nicht von der Klasse ab – ein Blatt trägt alle Klassen', () => {
      expect(codes((t) => t)).not.toContain('PARALLEL_KLASSEN')
      // Eine Spalte nur für bestimmte Klassen …
      expect(codes((t) => t.replace('- { key: b5, label: "Boje 5", typ: boje }', '- { key: b5, label: "Boje 5", typ: boje, klassen: [4, 5] }'))).toContain('PARALLEL_KLASSEN')
      // … oder die ganze Position.
      expect(codes((t) => t.replace('    menue: "Parallelslalom (nur Fahrweg)"\n', '    menue: "Parallelslalom (nur Fahrweg)"\n    klassen: [4, 5]\n'))).toContain('PARALLEL_KLASSEN')
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
