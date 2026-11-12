import { describe, expect, it } from 'vitest'
import { load as yamlLoad } from 'js-yaml'
import bundledAufbauten from './aufbauten.yaml?raw'
import { feldKennungen } from './feld'
import { aufloesen, ergebnisspaltenAusFahrweg, kurzformPosition, ueberwachungAusFahrweg } from './kurzform'
import { mergePositionen, quellDateien } from './merge-positionen'
import type { RawKurzform, RawPosition, RawSpalte } from './schema'
import { kurzformBefunde } from './validate'

const teile = import.meta.glob(['./einstellungen.yaml', './i18n/*.yaml', './aufbauten/*.yaml'], {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>

/** Alle Positionen in ausführlicher Form, wie sie die App bekommt. */
function positionen(): RawPosition[] {
  return aufloesen(mergePositionen(quellDateien(bundledAufbauten).map((n) => yamlLoad(teile[`./${n}.yaml`])))).positionen
}

const KLASSEN = ['E', '1', '2', '3', '4', '5', '6', '7']

/** Was der Bildgenerator abblendet: Tore ohne `hebt` und alles aus `abblenden` (wie deriveDimSet). */
function abgeblendet(p: RawPosition): string[] {
  const hell = new Set(p.spalten.map((s) => s.hebt).filter(Boolean))
  const dim = new Set(p.abblenden ?? [])
  if (hell.size > 0) for (const tor of ['Tor1', 'Tor2', 'Tor3', 'Tor4', 'Tor5']) if (!hell.has(tor)) dim.add(tor)
  return [...dim].sort()
}

const gilt = (klassen: Array<string | number> | undefined, klasse: string) => !klassen || klassen.map(String).includes(klasse)

/**
 * Was eine Liste erfasst und wie ihr Bild aussieht, ohne die reine Darstellung (Beschriftung,
 * Trennlinien, Reihenfolge von Disq., Σ und Bemerkung). Gleiche Felder je Klasse sind zusammengefasst.
 */
function wasSieErfasst(p: RawPosition) {
  const jeKlasse = new Map<string, string[]>()
  for (const klasse of KLASSEN.filter((k) => gilt(p.klassen, k))) {
    const felder = p.spalten
      .filter((s) => ['boje', 'code', 'zeit', 'punkte'].includes(s.typ) && gilt(s.klassen, klasse))
      .flatMap((s) => feldKennungen(s, p.katalog, p.id))
    const schluessel = JSON.stringify(felder)
    jeKlasse.set(schluessel, [...(jeKlasse.get(schluessel) ?? []), klasse])
  }
  return {
    titel: p.titel,
    menue: p.menue ?? p.titel,
    klassen: p.klassen?.map(String),
    felder: Object.fromEntries([...jeKlasse].map(([felder, klassen]) => [klassen.join(' '), JSON.parse(felder)])),
    listenFelder: [
      ...new Set(p.spalten.filter((s) => s.typ === 'disq' || s.typ === 'text').flatMap((s) => feldKennungen(s, p.katalog, p.id))),
    ].sort(),
    innen: Object.fromEntries(p.spalten.filter((s) => s.innen).map((s) => [s.key, s.innen])),
    bild: p.bild,
    abblenden: p.bildGenerator ? abgeblendet(p) : undefined,
    bildDrehung: p.bildDrehung ?? 0,
    bildNeben: !!p.bildNeben,
    bildBreite: p.bildBreite,
    pfeileSpiegeln: !!p.pfeileSpiegeln,
    disq: p.disq,
    katalog: p.katalog,
    ersetzt: p.ersetzt,
    schnellauswahl: !!p.schnellauswahl,
  }
}

/** Die Positionen, die die Kurzform beschreibt (KONZEPT-POSITIONEN.md §5.1). */
const KURZFORM_IDS = [
  'gate135',
  'gate135os',
  'gate245',
  'gate245os',
  'frontal135',
  'frontal245',
  'bstartziel',
  'brechts',
  'blinks',
  'bawueland1',
  'bawueland2',
  'bawuewasser1',
  'bawuewasser2',
  'mueb',
  'tor5',
  'tor5pue',
  'tor5puems',
  'parcours',
  'parcoursms',
]

describe('Kurzform bildet die Listen nach', () => {
  it('erfasst dieselben Felder in derselben Reihenfolge, mit demselben Bild', () => {
    const alle = positionen()
    const stand = Object.fromEntries(KURZFORM_IDS.map((id) => [id, wasSieErfasst(alle.find((p) => p.id === id)!)]))
    expect(stand).toMatchSnapshot()
  })
})

/** Die Spalten kurz: Key, Unter-Spalten, Trennlinie davor (‖) und zwischen den Unter-Spalten. */
function kurz(spalten: RawSpalte[]): string[] {
  return spalten.map((s) => {
    const sub = s.sub ? `[${s.sub.join(', ')}]` : ''
    return `${s.trenner === 'doppelt' ? '‖ ' : ''}${s.key}${sub}${s.subTrenner ? ` ~${s.subTrenner}` : ''}${s.klassen ? ` (${s.klassen.join('')})` : ''}`
  })
}

const moewe = (k: Omit<RawKurzform, 'titel'>) => kurzformPosition({ titel: 'Probe', ...k })

describe('Kurzform am Beispiel Möwe (KONZEPT-POSITIONEN.md §5.2)', () => {
  it('Tor 1 / 3 / 5 von hinten: Fehler Tor 5 zwischen Hin und Rück, sie zählen noch zur Hinfahrt', () => {
    const p = moewe({ id: 'm135', blick: 'hinten', bojen: ['Tor1', 'Tor3', 'Tor5_unten', 'Speedboje_unten'], aufgaben: ['tor5'] })
    expect(kurz(p.spalten)).toEqual([
      't1a[hin seiteA, hin seiteB]',
      't3a[hin seiteA, hin seiteB]',
      't5a[hin seiteA]',
      'fehler',
      'fp',
      '‖ t5b[rueck seiteA]',
      't3b[rueck seiteA, rueck seiteB]',
      't1b[rueck seiteA, rueck seiteB] (E123567)',
      'speed2 (7)',
      't1c[rueck seiteA, rueck seiteB] (7)',
      'disq',
      'sum',
    ])
    expect(p.spalten.find((s) => s.key === 'fehler')?.label).toBe('Fehler Tor 5')
    expect(p).toMatchObject({ bildDrehung: 90, pfeileSpiegeln: true, katalog: 'tor5', disq: 'parcours', subTrenner: 'gepunktet' })
    expect(p.abblenden).toEqual(['StartZiel', 'Tor2', 'Tor4', 'Tor5_oben', 'Speedboje_oben', 'Schikane'])
  })

  it('Tor 2 / 4 / 5 von links: Tor 5 in einer Spalte, Bild um 180° gedreht', () => {
    const p = moewe({ id: 'm245', blick: 'links', bojen: ['Tor2', 'Tor4', 'Tor5_oben', 'Speedboje_oben'] })
    expect(kurz(p.spalten)).toEqual([
      't2a[hin seiteA, hin seiteB]',
      't4a[hin seiteA, hin seiteB]',
      't5[hin seiteB, rueck seiteB] ~doppelt',
      't4b[rueck seiteA, rueck seiteB]',
      't2b[rueck seiteA, rueck seiteB]',
      'speed1 (567)',
      'disq',
      'sum',
    ])
    expect(p.bildDrehung).toBe(180)
    expect(p.pfeileSpiegeln).toBeUndefined()
    expect(p.katalog).toBeUndefined()
  })

  it('Mann-über-Bord: eigene Liste ab Klasse 4, nur die Schikane hell', () => {
    const p = moewe({ id: 'mm', blick: 'hinten', aufgaben: ['mueb'] })
    expect(p.klassen).toEqual(['4', '5', '6', '7'])
    expect(kurz(p.spalten)).toEqual(['fehler', 'fp', 'disq', 'sum', 'bemerkung'])
    expect(p.spalten.map((s) => s.label)).toEqual(['Fehler', 'Fehlerpunkte', 'Disq.', 'Σ', 'Bemerkung'])
    expect(p.abblenden).not.toContain('Schikane')
    expect(p).toMatchObject({ disq: 'mueb', katalog: 'mueb', bildDrehung: 90 })
  })

  it('Zeitliste mit Start und Ziel und nur der elektronischen Zeiterfassung', () => {
    const p = moewe({ id: 'mz', bojen: ['StartZiel'], aufgaben: ['zeit'], zeiten: ['elektronisch'] })
    expect(kurz(p.spalten)).toEqual(['zeit1', 'start[hin seiteA, hin seiteB]', '‖ ziel[rueck seiteA, rueck seiteB]', 'disq', 'sum'])
    expect(p.spalten[0]).toMatchObject({ label: 'Zeit', geraet: 'elektronisch' })
  })
})

describe('Regeln der Kurzform', () => {
  it('von vorne: obere Boje links, Tor 5 zuerst die Rückfahrt', () => {
    const p = kurzformPosition({ id: 'f', titel: 'F', blick: 'vorne', bojen: ['Tor1', 'Tor5_unten'] })
    expect(kurz(p.spalten).slice(0, 2)).toEqual(['t1a[hin seiteB, hin seiteA]', 't5[rueck seiteA, hin seiteA] ~doppelt'])
    expect(p.bildDrehung).toBe(-90)
  })

  it('mit beiden Bojen von Tor 5 stehen die Fehler an Tor 5 ebenso zwischen Hin und Rück', () => {
    const p = kurzformPosition({ id: 'b', titel: 'B', blick: 'links', bojen: ['Tor4', 'Tor5'], aufgaben: ['tor5'] })
    expect(kurz(p.spalten).slice(0, 6)).toEqual([
      't4a[hin seiteA, hin seiteB]',
      't5a[hin seiteA, hin seiteB]',
      'fehler',
      'fp',
      '‖ t5b[rueck seiteA, rueck seiteB]',
      't4b[rueck seiteA, rueck seiteB]',
    ])
  })

  it('ohne Tor-5-Bojen stehen die Fehler an Tor 5 am Ende der Hinfahrt', () => {
    const p = kurzformPosition({ id: 'r', titel: 'R', blick: 'rechts', bojen: ['Tor4_innen'], aufgaben: ['tor5'] })
    expect(kurz(p.spalten).slice(0, 4)).toEqual(['t4a[hin seiteA]', 'fehler', 'fp', '‖ t4b[rueck seiteA]'])
  })

  it('ohne Tor 5 doppelt dort, wo die Rückfahrt beginnt', () => {
    const p = kurzformPosition({ id: 'l', titel: 'L', blick: 'rechts', bojen: ['StartZiel_unten', 'Tor1_aussen'] })
    expect(kurz(p.spalten)).toEqual(['start[hin seiteA]', 't1a[hin seiteA]', '‖ t1b[rueck seiteA] (E123567)', 't1c[rueck seiteA] (7)', 'ziel[rueck seiteA]', 'disq', 'sum'])
  })

  it('Parcoursüberwachung: Bojen vorn, keine Abblendung, Hinweis zum Fahrweg', () => {
    const p = kurzformPosition({ id: 'p', titel: 'P', bojen: ['StartZiel'], aufgaben: ['tor5', 'parcours'] })
    expect(kurz(p.spalten)).toEqual(['start[hin seiteA, hin seiteB]', '‖ ziel[rueck seiteA, rueck seiteB]', 'fehler', 'fp', 'disq', 'sum', 'bemerkung'])
    expect(p.abblenden).toBeUndefined()
    expect(p.hinweis).toBe('parcours')
  })

  it('jedes Feld der ausführlichen Form gewinnt, `hinweis: keiner` lässt den Hinweis weg', () => {
    const p = kurzformPosition({ id: 'x', titel: 'X', blick: 'links', bojen: ['Tor2'], bild: 'eigen', bildDrehung: 0, hinweis: 'keiner' })
    expect(p).toMatchObject({ bild: 'eigen', bildDrehung: 0 })
    expect(p.hinweis).toBeUndefined()
  })

  it('nennt Fehler „Fehler“, wenn sie allein auf der Liste stehen, sonst mit ihrer Aufgabe', () => {
    const label = (k: Omit<RawKurzform, 'id' | 'titel'>) =>
      kurzformPosition({ id: 'f', titel: 'F', ...k }).spalten.filter((s) => s.typ === 'code' || s.typ === 'summe').map((s) => s.label)
    expect(label({ aufgaben: ['mueb'] })).toEqual(['Fehler', 'Fehlerpunkte', 'Σ'])
    expect(label({ aufgaben: ['tor5', 'parcours'] })).toEqual(['Fehler', 'Fehlerpunkte', 'Σ'])
    expect(label({ bojen: ['Tor1'], aufgaben: ['mueb'] })).toEqual(['Fehler MüB', 'F-Pkt.', 'Σ'])
    expect(label({ aufgaben: ['tor5', 'mueb'] })).toEqual(['Fehler Tor 5', 'F-Pkt.', 'Fehler MüB', 'F-Pkt.', 'Σ'])
  })

  it('meldet unbekannte Bojen, Aufgaben und Blicke', () => {
    const befunde = kurzformBefunde({
      positionen: [
        { id: 'a', titel: 'A', blick: 'oben' as never, bojen: ['Tor9'], aufgaben: ['kaffee' as never] },
        { id: 'b', titel: 'B' },
        { id: 'c', titel: 'C', bojen: ['Tor1'], zeiten: ['elektronisch'] },
      ],
    })
    expect(befunde.map((b) => b.code)).toEqual(['KURZFORM_BLICK', 'KURZFORM_BOJE', 'KURZFORM_AUFGABE', 'KURZFORM_LEER', 'KURZFORM_ZEITEN'])
  })
})

describe('Ergebnisspalten und Überwachung aus dem Fahrweg', () => {
  it('stehen in der Reihenfolge der Fahrt, Tor 5 mit E zwischen Hin und Rück', () => {
    expect(ergebnisspaltenAusFahrweg().map((s) => s.label)).toEqual([
      'Steg AB', 'Start', '1 H', '2 H', '3 H', '4 H', '5', '4 R', '3 R', '2 R', '1 R', 'MüB', 'S1', 'S2', '1 R', 'Ziel', 'Steg AN',
    ])
    expect(ergebnisspaltenAusFahrweg().find((s) => s.label === '5')?.unter).toEqual([
      't5|hin seiteB', 't5|hin seiteA', { label: 'E', feld: 'katalog:tor5' }, 't5|rueck seiteB', 't5|rueck seiteA',
    ])
  })

  it('verlangen jeden Halt mit seinen Klassen, Tor 5 in einem Eintrag', () => {
    const u = ueberwachungAusFahrweg()
    expect(u.map((e) => e.name)).toEqual([
      'Ablegen', 'Start', 'Tor 1', 'Tor 2', 'Tor 3', 'Tor 4', 'Tor 5', 'Fehler Tor 5', 'Tor 4', 'Tor 3', 'Tor 2', 'Tor 1',
      'Mann-über-Bord', 'Speed 1', 'Speed 2', 'Tor 1 (Speedrunde)', 'Ziel', 'Anlegen',
    ])
    expect(u.find((e) => e.key === 't5')?.sub).toEqual(['hin seiteA', 'hin seiteB', 'rueck seiteA', 'rueck seiteB'])
    expect(u.find((e) => e.katalog === 'mueb')?.klassen).toEqual(['4', '5', '6', '7'])
  })

  it('ersetzen `fahrweg` in den Dateien beim Auflösen', () => {
    const a = aufloesen({ positionen: [], ueberwachung: 'fahrweg', disziplinen: [{ id: 'm', name: 'M', ergebnisspalten: 'fahrweg' }] })
    expect(a.ueberwachung).toEqual(ueberwachungAusFahrweg())
    expect(a.disziplinen?.[0].ergebnisspalten).toEqual(ergebnisspaltenAusFahrweg())
  })
})
