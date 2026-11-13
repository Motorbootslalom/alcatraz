import { afterEach, describe, expect, it } from 'vitest'
import { configFor } from '../config/konfig'
import { setLocale } from '../i18n'
import {
  backNeedsFlip,
  bogenSeiten,
  columnsForClass,
  defFuerKlasse,
  hasDescription,
  listenFuerKlasse,
  musterZeilen,
  type BogenAuftrag,
} from './bogen'
import { listenSprache, listenSpracheVon } from './listensprache'
import { parcoursSvg } from './parcoursQuelle'

const dm = configFor({ regelwerk: 'dm-2026' })
const uim = configFor({ regelwerk: 'uim-2026', sprache: 'en' })

const auftrag = (typeId: string, klasse: string, mehr: Partial<BogenAuftrag> = {}): BogenAuftrag => ({
  typeId,
  klassen: [klasse],
  lauf: 1,
  zeilen: musterZeilen(10, 'M'),
  eventName: 'Hafenpokal 2026',
  aufbauId: 'alcatraz',
  ...mehr,
})
const spalten = (seite: { leaves: Array<{ colKey: string; subIndex?: number }> }) =>
  seite.leaves.map((l) => (l.subIndex === undefined ? l.colKey : `${l.colKey}#${l.subIndex}`))

afterEach(() => setLocale('de'))

describe('Muster-Startnummern', () => {
  it('tragen einen Buchstaben davor und sind damit keine echten Startnummern', () => {
    expect(musterZeilen(3, 'M').map((z) => z.nr)).toEqual(['M1', 'M2', 'M3'])
    expect(musterZeilen(2, 'S').map((z) => z.nr)).toEqual(['S1', 'S2'])
    expect(musterZeilen(12, 'M').every((z) => /^\D/.test(z.nr))).toBe(true)
    expect(musterZeilen(0, 'M')).toEqual([])
    expect(musterZeilen(-3, 'M')).toEqual([])
  })
})

describe('Listen eines Aufbaus je Klasse', () => {
  it('Alcatraz: Mann-über-Bord erst ab Klasse 4', () => {
    expect(listenFuerKlasse(dm, 'alcatraz', '7')).toEqual(['zeit', 'vorsteg', 'steg', 'gate135', 'gate245', 'tor5', 'mueb', 'parcours'])
    expect(listenFuerKlasse(dm, 'alcatraz', '2')).toEqual(['zeit', 'vorsteg', 'steg', 'gate135', 'gate245', 'tor5', 'parcours'])
  })

  it('Berlin hat andere Listen als Alcatraz', () => {
    expect(listenFuerKlasse(dm, 'berlin', '7')).toEqual(['steg', 'bstartziel', 'brechts', 'blinks'])
  })

  it('UIM kennt die Klassen 6 und 7 nicht', () => {
    expect(listenFuerKlasse(uim, 'alcatraz', '7')).toEqual([])
    expect(listenFuerKlasse(uim, 'alcatraz', '5')).toContain('mueb')
  })
})

describe('Bogen-Modell (DM 2026)', () => {
  it('Kopf: Veranstaltung, Liste, Klasse, Lauf, Parcours und WKR-Name', () => {
    const [seite, ...rest] = bogenSeiten(dm, auftrag('gate135', '4', { parcours: 'Parcours 2', wkr: 'A. Muster', lauf: 2 }))
    expect(rest).toEqual([])
    expect(seite).toMatchObject({
      eventName: 'Hafenpokal 2026',
      titel: 'Tor 1 / 3 / 5',
      klassenText: 'Klasse 4',
      laufText: '2. Lauf',
      parcours: 'Parcours 2',
      wkr: 'A. Muster',
      orientation: 'portrait',
      pageIndex: 0,
      pageCount: 1,
      zeigtKlasse: false,
    })
  })

  it('ohne Parcours-Namen (nur ein Parcours) bleibt die Zeile weg', () => {
    expect(bogenSeiten(dm, auftrag('steg', '4'))[0].parcours).toBeUndefined()
    expect(bogenSeiten(dm, auftrag('steg', '4', { parcours: '  ' }))[0].parcours).toBeUndefined()
  })

  it('Spalten je Klasse: Tor 1 / 3 / 5 in Klasse 4, 5 und 7', () => {
    const k4 = bogenSeiten(dm, auftrag('gate135', '4'))[0]
    const k5 = bogenSeiten(dm, auftrag('gate135', '5'))[0]
    const k7 = bogenSeiten(dm, auftrag('gate135', '7'))[0]
    // Klasse 4 fährt Tor 1 auf der Rückfahrt nicht, Speed 2 und das dritte Tor 1 nur Klasse 7.
    expect(spalten(k4)).toEqual(['start#0', 't1a#0', 't1a#1', 't3a#0', 't3a#1', 't5#0', 't5#1', 't3b#0', 't3b#1', 'ziel#0', 'disq', 'sum'])
    expect(spalten(k5)).toContain('t1b#0')
    expect(spalten(k5)).not.toContain('speed2')
    expect(spalten(k7)).toEqual(expect.arrayContaining(['t1b#1', 'speed2', 't1c#0', 't1c#1']))
    expect(k7.twoRow).toBe(true)
    expect(k7.columns.map((c) => c.key)).toEqual(columnsForClass(dm.getSheetDef('gate135').columns, '7').map((c) => c.key))
  })

  it('Alcatraz und Berlin: dieselbe Klasse, andere Listen und Spalten', () => {
    const steg = bogenSeiten(dm, auftrag('steg', '7'))[0]
    expect(spalten(steg)).toEqual(['fehlerAB', 'fpab', 'fehlerAN', 'fpan', 'disq', 'sum', 'bemerkung'])
    expect(steg.twoRow).toBe(false)
    const rechts = bogenSeiten(dm, auftrag('brechts', '7', { aufbauId: 'berlin' }))[0]
    expect(rechts.titel).toBe('Rechts')
    expect(spalten(rechts)).toEqual(expect.arrayContaining(['t1a#0', 't3b#1', 'fehler', 'fp', 't1c#1', 'disq', 'sum']))
    expect(rechts.def.bildNeben).toBe(true)
    // Berlin Rechts ohne Mann-über-Bord (Klasse 3): keine Fehler-Spalte, also auch keine Fehlerpunkte in der Legende.
    const ohne = bogenSeiten(dm, auftrag('brechts', '3', { aufbauId: 'berlin' }))[0]
    expect(spalten(ohne)).not.toContain('fehler')
    expect(ohne.def.errorTable).toBeUndefined()
    expect(defFuerKlasse(dm.getSheetDef('brechts'), '7').errorTable?.length).toBeGreaterThan(0)
  })

  it('Zeilen: Muster-Nummern, drei Leerzeilen, jede fünfte grau, leere Zellen je Blatt-Spalte', () => {
    const seite = bogenSeiten(dm, auftrag('gate245', '6'))[0]
    expect(seite.rows.map((r) => r.nr)).toEqual(['M1', 'M2', 'M3', 'M4', 'M5', 'M6', 'M7', 'M8', 'M9', 'M10', '', '', ''])
    expect(seite.rows.filter((r) => !r.fixed).map((r) => r.key)).toEqual(['_p0_x0', '_p0_x1', '_p0_x2'])
    expect(seite.rows.flatMap((r, i) => (r.shaded ? [i + 1] : []))).toEqual([5, 10])
    for (const r of seite.rows) {
      expect(r.cells).toHaveLength(seite.leaves.length)
      expect(r.cells.every((c) => c.display === '' && c.gilt)).toBe(true)
    }
    expect(bogenSeiten(dm, auftrag('gate245', '6'), { leerzeilen: 0 })[0].rows).toHaveLength(10)
  })

  it('Querformat und Liste ohne Lauf: Knoten', () => {
    const seite = bogenSeiten(dm, auftrag('knoten', '3', { aufbauId: 'bawue' }))[0]
    expect(seite.orientation).toBe('landscape')
    expect(seite.laufText).toBeUndefined()
    expect(seite.bild).toBeUndefined()
  })

  it('Bild: Zeichnung der Klasse, Abblendung und Drehung der Position; die Kursvariante bringt ihr eigenes mit', () => {
    const seite = bogenSeiten(dm, auftrag('gate135', '5'))[0]
    expect(seite.bild).toEqual({ datei: 'Klasse5', vorgabe: dm.getSheetDef('gate135').bildErzeugen, drehung: 90 })
    expect(seite.bild?.vorgabe.dim).toContain('Tor2')
    expect(bogenSeiten(dm, auftrag('moewe135', '5', { aufbauId: 'moewe' }))[0].bild?.datei).toBe('Klasse5_Moewe')
    expect(bogenSeiten(dm, auftrag('zeit', '5'))[0].bild).toBeUndefined()
  })

  it('jede mitgelieferte Position mit Bild trägt ihre Vorgabe, und die Zeichnung jeder Klasse ist eingebunden', () => {
    for (const k of [dm, uim]) {
      for (const p of k.getPositions()) expect(!!p.bildErzeugen, p.typeId).toBe(!!p.courseImageDir)
      for (const a of k.getAufbauten()) {
        for (const klasse of k.regelwerk.klassen) expect(parcoursSvg(k.bildDatei(a.id, klasse)), `${a.id} ${klasse}`).toBeTruthy()
      }
    }
  })

  it('Seitenaufteilung: ohne Messung eine Seite, mit Kapazität in Fünferschritten', () => {
    const viele = auftrag('steg', '4', { zeilen: musterZeilen(24, 'M') })
    expect(bogenSeiten(dm, viele)).toHaveLength(1)
    const seiten = bogenSeiten(dm, viele, { kapazitaet: 20 })
    expect(seiten.map((s) => s.rows.filter((r) => r.fixed).length)).toEqual([15, 9])
    expect(seiten.map((s) => [s.pageIndex, s.pageCount])).toEqual([
      [0, 2],
      [1, 2],
    ])
    // Leerzeilen auf jeder Seite, mit eigenen Schlüsseln.
    expect(seiten[1].rows.filter((r) => !r.fixed).map((r) => r.key)).toEqual(['_p1_x0', '_p1_x1', '_p1_x2'])
    // Grau wird über den ganzen Bogen gezählt: M20 ist die fünfte Zeile der zweiten Seite.
    expect(seiten[1].rows.filter((r) => r.shaded).map((r) => r.nr)).toEqual(['M20', ''])
    expect(bogenSeiten(dm, viele, { zeilenJeSeite: 10 }).map((s) => s.rows.filter((r) => r.fixed).length)).toEqual([10, 10, 4])
  })

  it('wenig Platz je Blatt: Leerzeilen stehen einmal am Ende statt auf jeder Seite', () => {
    // Fünf Zeilen je Blatt, drei Leerzeilen: Auf jeder Seite blieben nur zwei Starter (drei Blätter).
    const sechs = auftrag('steg', '4', { zeilen: musterZeilen(6, 'M') })
    const eng = bogenSeiten(dm, sechs, { kapazitaet: 2, zeilenKapazitaet: 5 })
    expect(eng.map((s) => s.rows.map((r) => r.nr || '·'))).toEqual([
      ['M1', 'M2', 'M3', 'M4', 'M5'],
      ['M6', '·', '·', '·'],
    ])
    expect(new Set(eng.flatMap((s) => s.rows.map((r) => r.key))).size).toBe(9)
    expect(eng.flatMap((s) => s.rows.filter((r) => r.shaded).map((r) => r.nr))).toEqual(['M5'])
    // Das letzte Blatt trägt nie nur Leerzeilen.
    const fuenf = bogenSeiten(dm, auftrag('steg', '4', { zeilen: musterZeilen(5, 'M') }), { kapazitaet: 2, zeilenKapazitaet: 5 })
    expect(fuenf.map((s) => s.rows.filter((r) => r.fixed).length)).toEqual([4, 1])
    // Passt alles auf ein Blatt oder ist genug Platz, bleibt es bei den Leerzeilen je Seite.
    expect(bogenSeiten(dm, auftrag('steg', '4', { zeilen: musterZeilen(2, 'M') }), { kapazitaet: 2, zeilenKapazitaet: 5 })).toHaveLength(1)
    const weit = bogenSeiten(dm, auftrag('steg', '4', { zeilen: musterZeilen(24, 'M') }), { kapazitaet: 20, zeilenKapazitaet: 23 })
    expect(weit.map((s) => s.rows.filter((r) => !r.fixed).length)).toEqual([3, 3])
  })

  it('verbaut die Erfassung nicht: Zeilen hängen an der Starter-ID, Zellen lassen sich füllen', () => {
    const zeilen = [
      { nr: '12', id: 'st_a' },
      { nr: '13', id: 'st_b' },
    ]
    const seite = bogenSeiten(dm, auftrag('steg', '4', { zeilen }), {
      leerzeilen: 0,
      anzeige: (zeile, colKey) => (zeile === 'st_b' && colKey === 'sum' ? '15' : ''),
    })[0]
    expect(seite.rows.map((r) => r.key)).toEqual(['st_a', 'st_b'])
    const sum = seite.leaves.findIndex((l) => l.colKey === 'sum')
    expect(seite.rows.map((r) => r.cells[sum].display)).toEqual(['', '15'])
  })

  it('mehrere Klassen auf einer Seite (Clubmeisterschaft): alle Spalten, je Zeile nur die ihrer Klasse', () => {
    const zeilen = [
      { nr: 'M1', klasse: '4' },
      { nr: 'M2', klasse: '7' },
    ]
    const seite = bogenSeiten(dm, { ...auftrag('gate135', '4', { zeilen }), klassen: ['4', '7'] }, { leerzeilen: 1 })[0]
    expect(seite.zeigtKlasse).toBe(true)
    expect(seite.klassenText).toBe('Klassen 4, 7')
    expect(spalten(seite)).toEqual(spalten(bogenSeiten(dm, auftrag('gate135', '7'))[0]))
    const speed2 = seite.leaves.findIndex((l) => l.colKey === 'speed2')
    expect(seite.rows.map((r) => r.cells[speed2].gilt)).toEqual([false, true, true])
    expect(seite.rows.map((r) => r.klasse)).toEqual(['4', '7', undefined])
    // Das Bild der höheren Klasse zeigt den längeren Parcours.
    expect(seite.bild?.datei).toBe('Klasse7')
  })

  it('mehrere Klassen: Hat eine Klasse die ganze Liste nicht, gilt für ihre Zeile keine Spalte', () => {
    // Mann-über-Bord gibt es erst ab Klasse 4; die Spalten selbst nennen keine Klassen.
    const zeilen = [
      { nr: 'M1', klasse: '2' },
      { nr: 'M2', klasse: '4' },
    ]
    const seite = bogenSeiten(dm, { ...auftrag('mueb', '4', { zeilen }), klassen: ['2', '4'] }, { leerzeilen: 1 })[0]
    expect(seite.rows.map((r) => r.cells.every((c) => c.gilt))).toEqual([false, true, true])
    expect(seite.rows[0].cells.some((c) => c.gilt)).toBe(false)
  })

  it('mehrere Klassen: Dieselbe Nummer in zwei Klassen ergibt verschiedene Zeilenschlüssel', () => {
    const zeilen = [
      { nr: '12', klasse: '4' },
      { nr: '12', klasse: '7' },
      { nr: '13', klasse: '7', id: 'st_c' },
    ]
    const seite = bogenSeiten(dm, { ...auftrag('steg', '4', { zeilen }), klassen: ['4', '7'] }, { leerzeilen: 0 })[0]
    // Die Starter-ID geht vor; ohne sie hält die Klasse die Schlüssel auseinander.
    expect(seite.rows.map((r) => r.key)).toEqual(['4:12', '7:12', 'st_c'])
    // Eine Klasse allein: Der Schlüssel bleibt die Nummer (Muster-Zeilen).
    expect(bogenSeiten(dm, auftrag('steg', '4', { zeilen: musterZeilen(2, 'M') }), { leerzeilen: 0 })[0].rows.map((r) => r.key)).toEqual(['M1', 'M2'])
  })
})

describe('Bogen-Modell (UIM 2026, englisch)', () => {
  it('Titel, Klasse, Lauf und feste Texte auf Englisch; Dolphin statt Klasse E', () => {
    const seite = bogenSeiten(uim, auftrag('gate135', 'E', { parcours: 'Parcours 1' }))[0]
    expect(seite.titel).toBe('Gate 1 / 3 / 5')
    expect(seite.klassenText).toBe('Class Dolphin')
    expect(seite.laufText).toBe('Attempt 1')
    expect(seite.texte.nr).toBe('No.')
    expect(seite.texte.wkr).toBe('Judge:')
    expect(seite.texte.unterschrift).toBe('Signature of judge')
    expect(seite.def.disqTableTitle).toContain('Disqualification')
  })

  it('die Klassen-Spalte nennt den Namen der Klasse, nicht ihre Kennung', () => {
    const zeilen = [
      { nr: 'S1', klasse: 'E' },
      { nr: 'S2', klasse: '1' },
    ]
    const seite = bogenSeiten(uim, { ...auftrag('steg', 'E', { zeilen }), klassen: ['E', '1'] }, { leerzeilen: 1 })[0]
    expect(seite.klassenText).toBe('Classes Dolphin, 1')
    expect(seite.rows.map((r) => r.klasseText)).toEqual(['Dolphin', '1', undefined])
  })

  it('UIM hat eigene Spalten: Knoten ohne Schotstek', () => {
    const cols = (k: typeof dm) => bogenSeiten(k, auftrag('knoten', '3', { aufbauId: 'bawue' }))[0].columns.map((c) => c.key)
    expect(cols(dm)).toContain('schotstek')
    expect(cols(uim)).not.toContain('schotstek')
    expect(bogenSeiten(uim, auftrag('steg', '3'))[0].columns.map((c) => c.label)).toContain('Remarks')
  })

  it('nach den DM-Regeln bleiben die Listen deutsch, auch wenn Englisch verlangt ist', () => {
    const seite = bogenSeiten(configFor({ regelwerk: 'dm-2026', sprache: 'en' }), auftrag('steg', '3'))[0]
    expect(seite.titel).toBe('Steg')
    expect(seite.texte.wkr).toBe('WKR:')
  })
})

describe('Listensprache', () => {
  it('folgt vorerst der Sprache der Oberfläche – an einer Stelle', () => {
    expect(listenSpracheVon('de')).toBe('de')
    expect(listenSpracheVon('en')).toBe('en')
    expect(listenSprache.value).toBe('de')
    setLocale('en')
    expect(listenSprache.value).toBe('en')
  })
})

describe('Beschreibung auf der Rückseite', () => {
  it('Hochformat wird für das Nach-oben-Klappen um 180° gedreht, Querformat nicht', () => {
    expect(backNeedsFlip('portrait')).toBe(true)
    expect(backNeedsFlip('landscape')).toBe(false)
  })

  it('erkennt Bögen ohne Beschreibung (die Rückseite bleibt leer)', () => {
    expect(hasDescription(dm.getSheetDef('zeit'))).toBe(false)
    expect(hasDescription(dm.getSheetDef('gate135'))).toBe(true)
    expect(hasDescription(dm.getSheetDef('knoten'))).toBe(true)
  })
})
