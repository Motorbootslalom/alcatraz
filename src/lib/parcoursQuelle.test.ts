import { describe, expect, it } from 'vitest'
import { configFor, ROH_QUELLE } from '../config/konfig'
import { aufloesen } from '../config/kurzform'
import lizenzDatei from '../assets/parcours/LICENSE.md?raw'
import { CLASS_IDS } from '../domain/classes'
import { BILD_BOJEN } from './assistent'
import { bildSvg, bildVorgabe, deriveDimSet, ZIFFERN_IDS } from './parcoursbild'
import { PARCOURS_HERKUNFT, parcoursBildUrl, parcoursDateien, parcoursSvg } from './parcoursQuelle'
import {
  BEARBEITUNGSVERMERK,
  ERWARTETE_LIZENZ,
  gleicheLizenz,
  metadaten,
  normalisiere,
  OPTIONALE_IDS,
  PARCOURS_DATEIEN,
  PFLICHT_IDS,
  RAHMEN_ID,
  vertragsBefunde,
} from './parcoursVertrag'

// Der ID-Vertrag der eingecheckten Zeichnungen (src/assets/parcours): Abblenden und „Zuordnen
// im Bild“ sprechen die Bojen über ihre IDs an. Eine geänderte Zeichnung fällt hier auf, nicht
// erst auf der gedruckten Liste.
describe('Eingecheckte Parcours-Zeichnungen', () => {
  it('sind genau die vereinbarten Dateien', () => {
    expect(parcoursDateien()).toEqual([...PARCOURS_DATEIEN].sort())
  })

  it.each(PARCOURS_DATEIEN)('%s hält den ID-Vertrag', (datei) => {
    const svg = parcoursSvg(datei)!
    expect(vertragsBefunde(svg)).toEqual([])
    // Alles, was Positionen ab- oder ausblenden können, gibt es – bis auf die optionalen IDs.
    expect(bildSvg(svg, { dim: [...PFLICHT_IDS], aus: [...ZIFFERN_IDS] }).fehlend).toEqual([])
  })

  it.each(PARCOURS_DATEIEN)('%s ist durch „npm run parcours:sync“ gelaufen', (datei) => {
    const svg = parcoursSvg(datei)!
    expect(normalisiere(svg)).toBe(svg)
    expect(svg).toMatch(/<svg\b[^>]*\bviewBox="0 0 853\.32581 360\.8295"/)
    expect(svg).not.toContain(`id="${RAHMEN_ID}"`)
    expect(svg).not.toMatch(/sodipodi:|inkscape:|RazorWire|Scissors|id="Legs"/)
    expect(svg).not.toMatch(/font-family:(verdana|'Arial Black')[;"]/i)
    // Nichts, was nachgeladen oder ausgeführt würde: Die Bilder liegen in einer Datei ohne Netz.
    expect(svg).not.toMatch(/<script|<image|<foreignObject|\bhref=|display:none/)
    // Die Namensnennung reist mit – samt dem Vermerk, dass die Zeichnung bearbeitet ist, und
    // der Lizenz, die das Parcours-Repository erklärt (genau einmal).
    expect(svg).toContain('<metadata')
    expect(svg.split(`<dc:description>${BEARBEITUNGSVERMERK}</dc:description>`).length - 1).toBe(1)
    expect(svg).toContain(ERWARTETE_LIZENZ.url)
    expect(metadaten(svg)).toMatchObject({ titel: PARCOURS_HERKUNFT.titel, urheber: PARCOURS_HERKUNFT.urheber })
  })

  it('die untere Speedboje steht nur in dem Klassenbild, dessen Route um sie herumführt', () => {
    expect(parcoursDateien().filter((d) => parcoursSvg(d)!.includes('id="Speedboje_unten"'))).toEqual(['Klasse7'])
    for (const id of OPTIONALE_IDS) expect(PFLICHT_IDS).not.toContain(id)
  })

  it.each(PARCOURS_DATEIEN)('%s: jede Ziffer im Bild hat eine Nummer_-ID, sonst ließe sie sich nicht ausblenden', (datei) => {
    const ziffern = [...parcoursSvg(datei)!.matchAll(/<text\b[^>]*\bid="([^"]*)"[^>]*>\s*<tspan\b[^>]*>\s*\d\s*<\/tspan>/g)].map((m) => m[1])
    expect(ziffern.length).toBeGreaterThan(0)
    for (const id of ziffern) expect(id).toMatch(/^Nummer_/)
  })

  it('das Bild zum Zuordnen (Klasse 7) zeigt jede Boje, die sich zuordnen lässt', () => {
    const svg = parcoursSvg('Klasse7')!
    for (const boje of BILD_BOJEN) expect(svg.split(`id="${boje}"`).length - 1, boje).toBe(1)
  })
})

describe('Herkunft und Lizenz der Zeichnungen', () => {
  it('QUELLE.json nennt den vollen Commit, die Dateien und die Lizenz des Parcours-Repositorys', () => {
    expect(PARCOURS_HERKUNFT.commit).toMatch(/^[0-9a-f]{40}$/)
    expect(PARCOURS_HERKUNFT.dateien).toEqual(PARCOURS_DATEIEN.map((d) => `${d}.svg`))
    expect(PARCOURS_HERKUNFT.lizenz).toBe(ERWARTETE_LIZENZ.name)
    expect(PARCOURS_HERKUNFT.lizenzUrl).toBe(ERWARTETE_LIZENZ.url)
    expect(PARCOURS_HERKUNFT.lizenzUrl).toContain('/by-sa/4.0/')
    expect(PARCOURS_HERKUNFT.urheber).not.toBe('')
  })

  it('LICENSE.md nennt denselben Commit und dieselbe Lizenz wie QUELLE.json', () => {
    expect(lizenzDatei).toContain(`Stand: Commit \`${PARCOURS_HERKUNFT.commit}\``)
    expect(lizenzDatei).toContain(PARCOURS_HERKUNFT.lizenz)
    expect(lizenzDatei).toContain(PARCOURS_HERKUNFT.urheber)
  })

  it('normalisiere setzt den Bearbeitungsvermerk genau einmal in die Metadaten', () => {
    const roh = '<svg width="2" height="1"><metadata><rdf:RDF><cc:Work rdf:about=""><dc:title>Bild</dc:title></cc:Work></rdf:RDF></metadata></svg>'
    const einmal = normalisiere(roh)
    expect(einmal).toContain(`<dc:title>Bild</dc:title><dc:description>${BEARBEITUNGSVERMERK}</dc:description></cc:Work>`)
    expect(normalisiere(einmal)).toBe(einmal)
    // Der Vermerk sagt, dass bearbeitet wurde, und nennt die Lizenz mit Adresse.
    expect(BEARBEITUNGSVERMERK).toContain('bearbeitet')
    expect(BEARBEITUNGSVERMERK).toContain(ERWARTETE_LIZENZ.name)
    expect(BEARBEITUNGSVERMERK).toContain(ERWARTETE_LIZENZ.url)
  })

  it('liest Titel, Urheber und Lizenz aus den Metadaten und erkennt eine abweichende Lizenz', () => {
    const svg =
      '<svg><metadata><rdf:RDF><cc:Work rdf:about=""><dc:creator><cc:Agent><dc:title>A. Muster</dc:title></cc:Agent></dc:creator>' +
      '<dc:title>Bild</dc:title><cc:license rdf:resource="http://creativecommons.org/licenses/by-nc-sa/4.0/" /></cc:Work></rdf:RDF></metadata></svg>'
    expect(metadaten(svg)).toEqual({ titel: 'Bild', urheber: 'A. Muster', lizenzUrl: 'http://creativecommons.org/licenses/by-nc-sa/4.0/' })
    expect(metadaten('<svg/>')).toEqual({ titel: '', urheber: '', lizenzUrl: '' })
    expect(gleicheLizenz(metadaten(svg).lizenzUrl, ERWARTETE_LIZENZ.url)).toBe(false)
    expect(gleicheLizenz('http://creativecommons.org/licenses/by-sa/4.0', ERWARTETE_LIZENZ.url)).toBe(true)
  })
})

// Aus scripts/generate-parcours.test.ts des Fehlerpunkte-Prototyps (dort „IDs in den Quell-SVGs“
// und „Berlin-Bilder“): Was die Positionen der Konfiguration ab- oder ausblenden, muss es in
// jeder Zeichnung geben – nicht nur die feste Liste PFLICHT_IDS.
describe('Positionen der Konfiguration und die Zeichnungen', () => {
  const positionen = aufloesen(ROH_QUELLE).positionen
  const erzeugt = positionen.filter((p) => p.bildGenerator)
  const dim = (id: string) => deriveDimSet(positionen.find((p) => p.id === id)!)

  it('jede ID aus den Positionen gibt es in allen Zeichnungen', () => {
    expect(erzeugt.length).toBeGreaterThan(10)
    const ids = new Set(erzeugt.flatMap((p) => [...(p.abblenden ?? []), ...(p.spalten ?? []).map((s) => s.hebt ?? '')]).filter(Boolean))
    expect(ids.size).toBeGreaterThan(0)
    for (const datei of PARCOURS_DATEIEN) {
      const svg = parcoursSvg(datei)!
      for (const id of ids) if (!OPTIONALE_IDS.has(id)) expect(svg, `${datei}: ${id}`).toContain(`id="${id}"`)
      for (const pos of erzeugt) expect(bildSvg(svg, bildVorgabe(pos)).fehlend, `${pos.id} in ${datei}`).toEqual([])
    }
  })

  it('die Zeitnahme bleibt zur Orientierung auf jeder Liste sichtbar', () => {
    const zeitnahme = ['Zeitnahme', 'Zeit_oben', 'Zeit_unten', 'Zeit_oben_Flagge', 'Zeit_unten_Flagge']
    for (const pos of erzeugt) for (const id of zeitnahme) expect(deriveDimSet(pos), pos.id).not.toContain(id)
  })

  // Die gelben Bojen des Start/Ziel-Tors: die Gruppe und ihre beiden Bojen.
  const GELB = ['StartZiel', 'StartZiel_oben', 'StartZiel_unten']

  it('Berlin, Start/Ziel: gelbe Bojen und Zeitnahme bleiben sichtbar, alle Tore nicht', () => {
    for (const id of [...GELB, 'Zeitnahme']) expect(dim('bstartziel')).not.toContain(id)
    expect(dim('bstartziel')).toEqual(expect.arrayContaining(['Tor1', 'Tor2', 'Tor3', 'Tor4', 'Tor5']))
  })

  it('Berlin, Rechts und Links blenden das Start/Ziel-Tor genau einmal ab', () => {
    for (const id of ['brechts', 'blinks']) expect(dim(id).filter((x) => GELB.includes(x))).toEqual(['StartZiel'])
  })
})

describe('Bilder der Konfiguration', () => {
  it('zu jedem Aufbau und jeder Klasse gibt es die Zeichnung', () => {
    const k = configFor()
    for (const a of k.getAufbauten()) {
      if (a.disziplin !== undefined && a.disziplin !== 'manoevrieren') continue
      for (const klasse of CLASS_IDS) expect(parcoursSvg(k.bildDatei(a.id, klasse)), `${a.id} Klasse ${klasse}`).toBeDefined()
    }
  })

  it('erzeugt jedes abgeblendete Bild nur einmal und liefert eine Blob-URL, ohne etwas zu laden', () => {
    const vorgabe = { dim: ['Tor1'], aus: [] }
    const a = parcoursBildUrl('Klasse5', vorgabe)
    expect(a?.startsWith('blob:')).toBe(true)
    expect(parcoursBildUrl('Klasse5', vorgabe)).toBe(a)
    expect(parcoursBildUrl('Klasse5', { dim: ['Tor2'], aus: [] })).not.toBe(a)
    expect(parcoursBildUrl('GibtEsNicht', vorgabe)).toBeUndefined()
  })
})
