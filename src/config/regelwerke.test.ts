import { afterEach, describe, expect, it } from 'vitest'
import { configFor, resolveRegelwerkId } from './konfig'
import type { Sprache } from '../types'

// Aus regelwerke.test.ts des Fehlerpunkte-Prototyps. Dort waren Regelwerk und Sprache ein
// Modulzustand; hier wählen `applyRegelwerk` und `applySprache` nur, mit welcher Auswahl
// die folgenden Abfragen rechnen. Was Punkte, Eingaben oder den Reducer der Bögen braucht,
// steht als `it.todo` da und kommt mit der Wertung – die Fälle sollen nicht verloren gehen.
let wahl: { regelwerk: string; sprache: Sprache } = { regelwerk: 'dm-2026', sprache: 'de' }
const konfig = () => configFor(wahl)
const applyRegelwerk = (regelwerk: string) => {
  wahl = { ...wahl, regelwerk }
}
const applySprache = (sprache: Sprache) => {
  wahl = { ...wahl, sprache }
}
const getSheetDef = (id: string) => konfig().getSheetDef(id)
const getLegende = () => konfig().getLegende()
const getBogenTexte = () => konfig().getBogenTexte()
const getRegelwerk = () => konfig().getRegelwerk()
const getRegelwerke = () => konfig().getRegelwerke()
const positionAllowsClass = (typeId: string, klasse: string) => konfig().positionAllowsClass(typeId, klasse)
const defaultRegelwerkId = () => resolveRegelwerkId(undefined)

afterEach(() => {
  applyRegelwerk('dm-2026')
  applySprache('de')
})

const buchstaben = (position: string) => getSheetDef(position).disqTable?.map((d) => d.code) ?? []

describe('Regelwerke', () => {
  it('bietet DM 2026 und UIM 2026 an, DM ist der Standard', () => {
    expect(getRegelwerke().map((r) => r.label)).toEqual(['DM 2026', 'UIM 2026'])
    expect(defaultRegelwerkId()).toBe('dm-2026')
  })

  it('fällt bei einem unbekannten Regelwerk auf den Standard zurück', () => {
    expect(resolveRegelwerkId('uim-2026')).toBe('uim-2026')
    expect(resolveRegelwerkId('gibtsnicht')).toBe('dm-2026')
  })

  it.todo('wertet denselben Code je Regelwerk anders: Stegberührung beim Anlegen (kommt mit der Wertung)')

  it('nennt das Regelwerk auf den Listen', () => {
    expect(getSheetDef('steg').disqTableTitle).toBe('Disqualifikation (DM 2026):')
    applyRegelwerk('uim-2026')
    expect(getSheetDef('steg').disqTableTitle).toBe('Disqualifikation (UIM 2026):')
    // Listen ohne Fehlercodes und Disqualifikationen bleiben ohne Hinweis.
    expect(getSheetDef('zeit').legendNote).toBeUndefined()
  })
})

describe('Laden zur Laufzeit', () => {
  // Entfällt hier bewusst: Die YAML-Dateien werden beim Bauen eingebunden, nichts wird nachgeladen.
  it('die Konfiguration steht ohne Laden bereit', () => {
    expect(configFor().allDisqs.length).toBeGreaterThan(0)
  })
})

describe('DM 2026', () => {
  it.todo('2. und 3. Versuch ist beim Ablegen und an Tor 5 eintragbar und zählt je Versuch (kommt mit der Wertung)')
  it.todo('„2x6“ ist kein Disq-Buchstabe X, ein X allein schon (kommt mit der Wertung)')
  it.todo('Treten auf den Schlauch ist beim Ablegen und beim Anlegen eintragbar (kommt mit der Wertung)')
  it.todo('MüB: getrennte Punkte der Ausschreibung sind kombinierbar – Punkte (kommt mit der Wertung)')

  it('MüB: die Codes der Ausschreibung stehen einzeln in der Legende', () => {
    const codes = getSheetDef('mueb').errorTable?.map((e) => e.code)
    expect(codes).toEqual(['13', '14', '15', '16', '17', '18', '19'])
  })

  it('zeigt den Hinweis „kombinierbar“ auf Listen mit Fehlercodes', () => {
    for (const id of ['steg', 'tor5', 'mueb', 'brechts']) {
      expect(getSheetDef(id).legendNote).toContain('Fehler sind kombinierbar')
    }
    expect(getSheetDef('gate135').legendNote).not.toContain('kombinierbar')
  })

  it('führt je Punkt der Ausschreibung einen eigenen Buchstaben', () => {
    const texte = Object.fromEntries(getLegende().disq.map((d) => [d.code, d.text]))
    expect(texte.A).toBe('Fahren ohne Quickstopp')
    expect(texte.D).toBe('4. Versuch eines Elementes')
    expect(texte.J).toBe('Falscher Parcours entgegen der Parcourszeichnung')
    expect(texte.M).toContain('Schuhwerk oder Startnummer')
    expect(texte.N).toContain('Auslassen')
    expect(texte.P).toContain('Vollkreis vor Tor 5')
    expect(texte.Q).toContain('Rückwärtsfahren beim MüB')
    expect(texte.R).toContain('Co-Piloten')
    expect(texte.H).toContain('über Bootsbreite') // bewusst genauer als die Ausschreibung
    expect(texte.E).not.toContain('gebückt')
    expect(texte.F).toContain('gebückter Haltung')
  })

  it('MüB-Buchstaben stehen nur auf Listen mit Mann-über-Bord', () => {
    for (const id of ['mueb', 'brechts', 'bawuewasser1']) {
      expect(buchstaben(id)).toEqual(expect.arrayContaining(['L', 'Q']))
    }
    for (const id of ['steg', 'vorsteg', 'tor5', 'parcours', 'gate135', 'gate245', 'frontal135', 'bawueland1']) {
      expect(buchstaben(id)).not.toContain('L')
      expect(buchstaben(id)).not.toContain('Q')
    }
  })

  it('die Disq-Legende steht bei querliegendem Bild zweispaltig', () => {
    for (const id of ['parcours', 'brechts', 'blinks', 'bawuewasser1']) expect(getSheetDef(id).disqZweispaltig).toBe(true)
    for (const id of ['steg', 'tor5', 'mueb', 'gate135']) expect(getSheetDef(id).disqZweispaltig).toBe(false)
  })

  it('jede Liste bekommt nur die Buchstaben ihres Bereichs', () => {
    expect(buchstaben('vorsteg')).toEqual(['M', 'X'])
    expect(buchstaben('steg')).toEqual(['A', 'C', 'D', 'E', 'F', 'H', 'I', 'K', 'M', 'R', 'X'])
    expect(buchstaben('gate135')).toEqual(['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'J', 'K', 'M', 'N', 'P', 'R', 'X'])
  })
})

describe('UIM 2026', () => {
  it('kennt nur die Klassen E bis 5', () => {
    applyRegelwerk('uim-2026')
    expect(getRegelwerk().klassen).toEqual(['E', '1', '2', '3', '4', '5'])
    expect(positionAllowsClass('steg', '5')).toBe(true)
    expect(positionAllowsClass('steg', '6')).toBe(false)
    expect(positionAllowsClass('mueb', '3')).toBe(false)
    expect(positionAllowsClass('mueb', '4')).toBe(true)
  })

  it.todo('lässt beim Wechsel die Bögen nicht vorhandener Klassen weg (kommt mit den Bögen im Zustand)')

  it('hat vier Knoten, keinen Schotstek', () => {
    expect(getSheetDef('knoten').columns.map((c) => c.key)).toContain('schotstek')
    applyRegelwerk('uim-2026')
    const spalten = getSheetDef('knoten').columns.filter((c) => c.kind === 'buoy').map((c) => c.key)
    expect(spalten).toEqual(['webleinstek', 'palstek', 'kreuzknoten', 'klampe'])
  })

  it('kennt keine Fehler, die Pkt. 5.3 nicht nennt, und führt das MüB einzeln auf', () => {
    applyRegelwerk('uim-2026')
    const texte = getLegende().gruppen.flatMap((g) => g.rows.map((r) => r.text)).join(' | ')
    for (const fehlt of ['Durchreißen', 'Treten', 'Festmacherleine', 'Leerlauf']) expect(texte).not.toContain(fehlt)
    expect(buchstaben('gate135')).toEqual(['D', 'E', 'F', 'J', 'X'])
    expect(buchstaben('mueb')).toEqual(['D', 'E', 'F', 'J', 'Q', 'X'])
  })
})

describe('A4-Legende', () => {
  it('enthält Kataloge, Fehler ohne Code, Disqualifikationen und Hinweise des Regelwerks', () => {
    const l = getLegende()
    expect(l.gruppen.map((g) => g.title)).toEqual([
      'Ablegen (AB)',
      'Anlegen (AN)',
      'Einfahrt Tor 5',
      'Fehler (MüB)',
    ])
    expect(l.direkt.map((d) => d.titel)).toEqual(['Bojen', 'Tor 5', 'Knoten'])
    expect(l.disq.at(-1)?.code).toBe('X')
    expect(l.fehlerHinweis).toContain('kombinierbar')
    expect(l.hinweise.length).toBeGreaterThan(0)
    expect(l.texte.fehlercodes).toBe('Fehlercodes (Punkte)')

    applyRegelwerk('uim-2026')
    expect(getLegende().texte.fehlercodes).toBe('Fehlercodes (Sekunden)')
    expect(getLegende().direkt.map((d) => d.titel)).toEqual(['Bojen', 'Knoten'])
  })
})

describe('Sprachen', () => {
  it('nur Regelwerke mit Englisch stellen um: DM bleibt deutsch', () => {
    expect(getRegelwerke().map((r) => r.sprachen)).toEqual([['de'], ['de', 'en']])
    applySprache('en')
    expect(getSheetDef('mueb').title).toBe('Mann-über-Bord')
    expect(getLegende().texte.titel).toContain('Legende')
  })

  it('UIM auf Englisch: Listen und Fehlertexte im Wortlaut der UIM', () => {
    applyRegelwerk('uim-2026')
    applySprache('en')
    const def = getSheetDef('mueb')
    expect(def.title).toBe('Man-over-board')
    expect(def.titelDe).toBe('Mann-über-Bord') // Bedienleiste und Dateinamen bleiben deutsch
    expect(def.errorTable?.map((e) => e.text)).toContain('Rising the safety belt with one hand')
    expect(def.disqTable?.map((d) => d.text)).toContain('Boat goes backwards during the man-over-board manoeuvre')
    expect(def.disqTableTitle).toBe('Disqualification (UIM 2026):')
    expect(def.legendNote).toContain('Penalties can be combined')
    expect(def.legendNote).not.toContain('kombinierbar')
    expect(def.legendNoteSpalten).toBeUndefined() // nur zweisprachig nebeneinander
    expect(getSheetDef('steg').columns.map((c) => c.label)).toContain('Remarks')
    const texte = getBogenTexte()
    expect(texte.klasse('E')).toBe('Class Dolphin')
    expect(texte.lauf(2)).toBe('Attempt 2')
    expect(getLegende().texte.fehlercodes).toBe('Penalty codes (seconds)')
  })

  it('UIM zweisprachig: beide Sprachen, ohne Dopplung bei gleichem Text', () => {
    applyRegelwerk('uim-2026')
    applySprache('de+en')
    const steg = getSheetDef('steg')
    expect(steg.title).toBe('Steg / Pontoon')
    expect(getSheetDef('gate135').title).toBe('Tor 1 / 3 / 5 · Gate 1 / 3 / 5')
    expect(steg.columns.map((c) => c.label)).toEqual(expect.arrayContaining(['Bemerkung / Remarks', 'Disq.']))
    expect(steg.errorGroups?.[0].rows[0].text).toBe('erneute Stegberührung / Additional touch of the starting pontoon')
    expect(steg.legendNote).toContain('kombinierbar')
    expect(steg.legendNote).toContain('Penalties can be combined')
    expect(getBogenTexte().wkr).toBe('WKR / Judge:')
    // Satz-Hinweise stehen untereinander, nicht mit „/“ verbunden.
    expect(getLegende().fehlerHinweis?.split('\n')).toHaveLength(2)
    // Auf den Listen stehen sie nebeneinander: links deutsch, rechts englisch.
    const [links, rechts] = getSheetDef('gate135').legendNoteSpalten ?? []
    expect(links).toContain('Fahrtrichtung')
    expect(links).not.toContain('direction')
    expect(rechts).toContain('direction')
    expect(rechts).not.toContain('Fahrtrichtung')
  })

  it('Bojen-Kürzel bleiben gleich, der Hinweis erklärt sie auf Englisch', () => {
    applyRegelwerk('uim-2026')
    const deutsch = getSheetDef('gate135').columns.find((c) => c.key === 't1a')?.sub
    applySprache('en')
    const def = getSheetDef('gate135')
    expect(def.columns.find((c) => c.key === 't1a')?.sub).toEqual(deutsch)
    expect(def.legendNote).toContain('1st character = direction: H = outward, R = return')
    expect(def.legendNote).toContain('R = Right, L = Left')
    expect(def.legendNote).not.toContain('Fahrtrichtung')
  })

  it.todo('Punkte ändern sich durch die Sprache nicht (kommt mit der Wertung)')

  it('die Disq-Erkennung ändert sich durch die Sprache nicht', () => {
    applyRegelwerk('uim-2026')
    applySprache('de+en')
    expect(buchstaben('mueb')).toEqual(['D', 'E', 'F', 'J', 'Q', 'X'])
    const def = getSheetDef('mueb')
    expect(def.columns.find((c) => c.kind === 'disq')?.label).toBe('Disq.') // SheetPage erkennt die Spalte daran
  })
})

describe('Legende je Klasse', () => {
  // `defFuerKlasse` gehört zur Wertung (lib/scoring im Prototyp).
  it.todo('Berlin Rechts zeigt die MüB-Punkte erst ab Klasse 4 (kommt mit der Wertung)')
  it.todo('gilt auch für Baden-Württemberg, und zweisprachig (kommt mit der Wertung)')
  it.todo('Listen, deren Fehler-Spalte immer da ist, bleiben unverändert (kommt mit der Wertung)')
})

describe('Tor 5 mit Parcoursüberwachung', () => {
  it.todo('die DM26-Liste summiert Start/Ziel und Fehlercodes in Σ – Punkte (kommt mit der Wertung)')

  it('die Listen mit Tor 5 enden mit Fehler, Punkten, Disq., Σ und Bemerkung', () => {
    expect(getSheetDef('tor5puems').sumColumnKey).toBe('sum')
    for (const id of ['tor5', 'tor5pue', 'tor5puems']) {
      const keys = getSheetDef(id).columns.map((c) => c.key)
      expect(keys.slice(-5)).toEqual(['fehler', 'fp', 'disq', 'sum', 'bemerkung'])
    }
  })
})

describe('Berlin-Bilder', () => {
  it('Links zeigt Start/Ziel rechts (180°), Rechts links, alle mit dem Bild neben der Legende', () => {
    expect(getSheetDef('blinks').bildDrehung).toBe(180)
    expect(getSheetDef('brechts').bildDrehung).toBeUndefined()
    for (const id of ['bstartziel', 'brechts', 'blinks']) expect(getSheetDef(id).bildNeben).toBe(true)
  })
})
