import { afterEach, describe, expect, it } from 'vitest'
import { configFor, resolveRegelwerkId } from './konfig'
import { regelwerkOf, versucheNacheinander } from './catalog'
import type { Sprache } from '../types'
import { CLASS_IDS } from '../domain/classes'
import { defFuerKlasse } from '../lib/bogen'
import { allowedSet, sanitizeBuoy } from '../lib/disq'
import { listenFelder } from '../lib/eingaben'
import { bojenWert } from '../lib/scoring'

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

  it('Länder überall mit dem Kürzel des IOC: UIM nach Regel 209, die DM ebenso (Entscheidung des Nutzers vom 15.11.2026)', () => {
    expect(regelwerkOf('dm-2026').laenderKuerzel).toBe('ioc')
    expect(regelwerkOf('uim-2026').laenderKuerzel).toBe('ioc')
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

  it('max/danach (Nutzer 24.11.2026): „2. und 3. Versuch“ höchstens 2×, danach D; Tor 5 Code 1 höchstens 1× – DM und UIM', () => {
    for (const regelwerk of ['dm-2026', 'uim-2026']) {
      const k = configFor({ regelwerk })
      const zeilen = [...(k.getSheetDef('steg').errorGroups ?? []).flatMap((g) => g.rows), ...(k.getSheetDef('tor5').errorTable ?? []), ...(k.getSheetDef('mueb').errorTable ?? [])]
      const von = (code: string) => zeilen.find((e) => e.code === code)
      for (const code of ['6', '7', '20', '19']) expect([regelwerk, von(code)?.max, von(code)?.danach]).toEqual([regelwerk, 2, 'D'])
      expect([von('1')?.max, von('1')?.danach]).toEqual([1, undefined])
      // Alle übrigen ohne eigene Angabe – dort gilt die allgemeine Grenze (WKR_ANNAHMEN.codeMaxAllgemein).
      expect(zeilen.filter((e) => e.max !== undefined).map((e) => e.code).sort()).toEqual(['1', '19', '20', '6', '7'])
    }
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
    expect(buchstaben('steg')).toEqual(['A', 'C', 'D', 'E', 'F', 'H', 'I', 'K', 'M', 'R', 'S', 'X'])
    expect(buchstaben('gate135')).toEqual(['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'J', 'K', 'M', 'N', 'P', 'R', 'X'])
  })
})

describe('Startnummern-Bereiche (DMYV-Liste, 19.11.2026)', () => {
  it('DM 2026 trägt die DMYV-Liste; Klasse 3 ohne L-XL; UIM ohne Bereiche', () => {
    const kurz = (id: string) =>
      Object.fromEntries(Object.entries(regelwerkOf(id).startNrBereiche).map(([k, l]) => [k, (l ?? []).map((b) => `${b.von}-${b.bis} ${b.gruppe}`).join(', ')]))
    expect(kurz('dm-2026')).toEqual({
      E: 'E01-E30 S-M',
      1: '101-130 S-M',
      2: '201-230 S-M',
      3: '301-330 S-M',
      4: '401-420 S-M, 421-430 L-XL',
      5: '501-510 S-M, 511-528 L-XL, 529-530 XXL',
      6: '601-610 S-M, 611-625 L-XL, 626-630 XXL',
      7: '701-710 S-M, 711-725 L-XL, 726-730 XXL',
    })
    expect(regelwerkOf('uim-2026').startNrBereiche).toEqual({})
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

  it('verlangt für den Aushang Unterschrift, Uhrzeit und Punkte (Pkt. 5.2, 5.2.1) und kennt die Option „Versuche direkt nacheinander“ (Pkt. 4.3.2; nicht vorgewählt) – die DM nicht', () => {
    const uim = regelwerkOf('uim-2026')
    expect(uim.aushang).toEqual({ unterschrift: true, punkte: true })
    expect(uim.versucheNacheinander).toBe(false)
    const dm = regelwerkOf('dm-2026')
    expect(dm.aushang).toEqual({ unterschrift: false, punkte: false })
    // Die DM kennt den Schalter nicht: Er ist dort weder sichtbar noch wirksam.
    expect(dm.versucheNacheinander).toBeUndefined()
    expect(versucheNacheinander({ regelwerk: 'dm-2026', versucheNacheinander: true })).toBe(false)
    expect(versucheNacheinander({ regelwerk: 'uim-2026', versucheNacheinander: true })).toBe(true)
    expect(versucheNacheinander({ regelwerk: 'uim-2026', versucheNacheinander: false })).toBe(false)
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
    expect(getBogenTexte().wkr).toBe('WKR / Race official:')
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

describe('Bojenzellen jedes Regelwerks (R7-14, 22.11.2026, WKR_ANNAHMEN BZ6)', () => {
  it('jede Bojenzelle jeder Position und Klasse: erlaubte Buchstaben einzeln und zu zweit laufen rund durch sanitizeBuoy → bojenWert', () => {
    let geprueft = 0
    for (const { id } of getRegelwerke()) {
      const k = configFor({ regelwerk: id, sprache: 'de' })
      for (const p of k.getPositions()) {
        for (const klasse of CLASS_IDS) {
          if (!k.positionAllowsClass(p.typeId, klasse)) continue
          const erlaubt = allowedSet(defFuerKlasse(k.getSheetDef(p.typeId), klasse).disqTable)
          const buchstaben = [...erlaubt].filter((b) => b !== 'X')
          const felder = listenFelder(k, p.typeId, klasse).filter((f) => f.kind === 'buoy')
          if (felder.length === 0) continue
          // Der Katalog hängt an Position und Klasse, nicht an der einzelnen Zelle: Rund-Probe einmal je Paar, danach
          // nimmt jede Bojenzelle (Feld.gueltig = derselbe Sanierer) jede Zelle unverändert an.
          const paare = buchstaben.flatMap((a, i) => [[a], ...buchstaben.slice(i + 1).map((b) => [b, a])])
          const zellen = paare.map((paar) => {
            const ort = `${id}/${p.typeId}/${klasse}: ${paar.join('')}`
            // Klein, ohne Trenner und in Tippfolge – die Zelle steht danach in der einen Form.
            const zelle = sanitizeBuoy(`${paar.join('').toLowerCase()}5`, erlaubt)
            expect(bojenWert(zelle), ort).toEqual({ punkte: 5, disq: buchstaben.filter((b) => paar.includes(b)) })
            expect(sanitizeBuoy(zelle, erlaubt), ort).toBe(zelle)
            return zelle
          })
          for (const feld of felder) {
            const falsch = zellen.filter((z) => feld.gueltig(z) !== z)
            expect(falsch, `${id}/${p.typeId}/${klasse}/${feld.kennung}`).toEqual([])
            geprueft += zellen.length
          }
        }
      }
    }
    expect(geprueft).toBeGreaterThan(1000)
  }, 30_000)
})
