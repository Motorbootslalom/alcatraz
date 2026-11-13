import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { configFor, ROH_QUELLE } from '../config/konfig'
import { feldKennungen } from '../config/feld'
import { aufloesen, istInlineKurzform, kurzformPosition } from '../config/kurzform'
import type { RawAufbau, RawKurzform, RawPosition } from '../config/schema'
import { setLocale } from '../i18n'
import { ausAufbau, befund, FELDER, leererEntwurf, lueckenJeFeld, namensteil, neueId, ohneEnglischenTitel, spalteAlsPosition, umschalten, ZEILEN, zuAufbau, type Entwurf } from './assistent'
import { lueckenName } from './assistentTexte'

const zeile = (id: string) => ZEILEN.find((z) => z.id === id)!

/** Was eine Liste je Klasse erfasst, ohne die Felder, die zur Liste selbst gehören (Disq., Bemerkung). */
function erfasst(p: RawPosition) {
  return ['E', '4', '5', '7'].map((klasse) =>
    p.spalten
      .filter((s) => ['boje', 'code', 'zeit'].includes(s.typ) && (!s.klassen || s.klassen.map(String).includes(klasse)))
      .flatMap((s) => feldKennungen(s, p.katalog)),
  )
}

describe('Assistent: Entwurf und Aufbau', () => {
  it('ergibt aus dem Möwe-Aufbau als Vorlage wieder dieselben Listen', () => {
    const quelle = ROH_QUELLE
    const moewe = quelle.aufbauten!.find((a) => a.id === 'moewe')!
    let n = 0
    const { entwurf, nichtUebernommen } = ausAufbau(moewe, quelle, { id: 'probe', name: 'Probe' }, () => `p${++n}`)
    expect(nichtUebernommen).toEqual([])
    expect(entwurf.steg).toBe(true)
    expect(entwurf.kurs).toBe('moewe')

    const aufbau = zuAufbau(entwurf)
    const neu: Array<string | RawPosition> = aufbau.positionen.map((e) =>
      istInlineKurzform(e) ? kurzformPosition(e as RawKurzform) : (e as string),
    )
    const alt = aufloesen(quelle).positionen
    const original = moewe.positionen.map((id) => alt.find((p) => p.id === id)!)
    expect(neu.map((p) => (typeof p === 'string' ? p : p.titel))).toEqual(original.map((p) => (p.id === 'steg' ? 'steg' : p.titel)))
    neu.forEach((p, i) => {
      if (typeof p === 'string') return
      expect(erfasst(p), original[i].id).toEqual(erfasst(original[i]))
      expect(p.bildDrehung, original[i].id).toBe(original[i].bildDrehung)
    })
  })

  it('setzt mit einem Klick beide Bojen eines Tores, aufgeklappt eine einzelne', () => {
    let e = { ...leererEntwurf('x', 'X'), spalten: [{ id: 'a', titel: 'A' }] }
    e = umschalten(e, zeile('Tor1'), 'a')
    expect(e.zuordnung).toMatchObject({ Tor1_aussen: ['a'], Tor1_innen: ['a'] })
    e = umschalten(e, zeile('Tor1'), 'a', 'Tor1_innen')
    expect(e.zuordnung.Tor1_innen).toEqual([])
    expect(zuAufbau(e).positionen).toContainEqual(expect.objectContaining({ id: 'a', bojen: ['Tor1_aussen'] }))
    e = umschalten(e, zeile('Tor1'), 'a', 'Tor1_innen')
    expect(zuAufbau(e).positionen).toContainEqual(expect.objectContaining({ bojen: ['Tor1'] }))
  })

  it('meldet Lücken, doppelte Felder und leere Spalten', () => {
    let e = { ...leererEntwurf('x', 'X'), spalten: [{ id: 'a', titel: 'A' }, { id: 'b', titel: 'B' }, { id: 'c', titel: 'C' }] }
    e = umschalten(e, zeile('Tor2'), 'a')
    e = umschalten(e, zeile('Tor2'), 'b', 'Tor2_innen')
    const b = befund(e)
    expect(b.doppelt).toEqual(['Tor2_innen'])
    expect(b.leer).toEqual(['c'])
    expect(b.fehlt).toContain('Tor1_innen')
    expect(b.fehlt).not.toContain('Tor2_aussen')
    expect(b.fehlt).not.toContain('parcours') // freiwillig
    // Leere Spalten entfallen im Aufbau.
    expect(zuAufbau(e).positionen.map((p) => (typeof p === 'string' ? p : p.id))).toEqual(['steg', 'a', 'b'])
  })

  it('ordnet Zeitlisten vor den Steg, die übrigen dahinter, Knoten ans Ende', () => {
    let e: Entwurf = {
      ...leererEntwurf('x', 'X'),
      vorsteg: true,
      knoten: true,
      spalten: [
        { id: 'a', titel: 'Tore' },
        { id: 'z', titel: '', zeiten: ['elektronisch'] },
      ],
    }
    e = umschalten(e, zeile('StartZiel'), 'z')
    e = umschalten(e, zeile('Tor3'), 'a')
    const a = zuAufbau(e)
    expect(a.positionen.map((p) => (typeof p === 'string' ? p : p.id))).toEqual(['z', 'vorsteg', 'steg', 'a', 'knoten'])
    expect(a.positionen[0]).toMatchObject({ titel: 'Elektronische Zeiterfassung', aufgaben: ['zeit'], zeiten: ['elektronisch'], bojen: ['StartZiel'] })
  })
})

describe('IDs', () => {
  it('bildet aus dem Namen einen Anfang aus Kleinbuchstaben und Ziffern', () => {
    expect(namensteil('Möwe-Cup 2026 Süß')).toBe('moewecup2026')
    expect(namensteil('!!!')).toBe('aufbau')
  })

  it('vergibt jede ID nur einmal', () => {
    const vergeben = new Set(['abyyyy'])
    const wuerfel = [0.7, 0.7, 0.7, 0.7, 0.1, 0.2, 0.3, 0.4] // erst „yyyy“ (vergeben), dann „dgkn“ …
    let i = 0
    const id = neueId('ab', vergeben, () => wuerfel[i++])
    expect(i).toBe(8)
    expect(id).toMatch(/^ab[a-z0-9]{4}$/)
    expect(id).not.toBe('abyyyy')
    expect(vergeben.has(id)).toBe(true)
  })

  it('setzt keinen Ersatznamen: Ein leerer Name bleibt leer und fällt der Prüfung auf', () => {
    expect(zuAufbau(leererEntwurf('e1', '   ')).name).toBe('')
    expect(zuAufbau(leererEntwurf('e1', ' Hafenfest ')).name).toBe('Hafenfest')
  })
})

describe('Assistent: Lücken in den Begriffen der Tabelle', () => {
  const alleAusser = (ohne: string[]): RawAufbau => {
    const spalten = [{ id: 'pa', titel: 'A' }]
    const zuordnung = Object.fromEntries(FELDER.filter((f) => !ohne.includes(f)).map((f) => [f, ['pa']]))
    return zuAufbau({ ...leererEntwurf('lueckentest1', 'Lücken'), spalten: [...spalten, { id: 'pz', titel: 'Zeit', zeiten: ['stoppuhr'] }], zuordnung })
  }
  const luecken = (ohne: string[]) => lueckenJeFeld(configFor().entwurfsLuecken(alleAusser(ohne)))

  it('ohne Lücke bleibt die Liste leer', () => {
    expect(luecken([])).toEqual([])
  })

  it('eine fehlende Boje ist ein Eintrag, nicht einer je Fahrtrichtung, mit allen Klassen', () => {
    // Die Prüfung selbst nennt die Boje dreimal: Hinfahrt, Rückfahrt und Speedrunde der Klasse 7.
    const roh = configFor().entwurfsLuecken(alleAusser(['Tor1_aussen']))
    expect(roh.map((l) => l.element)).toEqual(['Tor 1 (hin seiteA)', 'Tor 1 (rueck seiteA)', 'Tor 1 (Speedrunde) (rueck seiteA)'])
    expect(luecken(['Tor1_aussen'])).toEqual([
      { feld: 'Tor1_aussen', element: 'Tor 1 (hin seiteA)', klassen: ['E', '1', '2', '3', '4', '5', '6', '7'], nurZusammengelegt: false },
    ])
  })

  it('ordnet jede Boje und Aufgabe ihrem Feld zu, in der Reihenfolge der Tabelle', () => {
    const pflicht = FELDER.filter((f) => f !== 'parcours')
    for (const feld of pflicht) expect(luecken([feld]).map((l) => l.feld), feld).toEqual([feld])
    expect(luecken(['mueb', 'Speedboje_unten', 'StartZiel_oben', 'Tor2_innen']).map((l) => [l.feld, l.klassen.join('')])).toEqual([
      ['StartZiel_oben', 'E1234567'],
      ['Tor2_innen', 'E1234567'],
      ['Speedboje_unten', '7'],
      ['mueb', '4567'],
    ])
  })

  it('der fehlende Steg hat kein Feld, aber einen Katalog für den Namen', () => {
    const ohneSteg = { ...alleAusser([]), positionen: alleAusser([]).positionen.filter((e) => e !== 'steg') }
    expect(lueckenJeFeld(configFor().entwurfsLuecken(ohneSteg)).map((l) => l.feld ?? l.katalog)).toEqual(['stegAblegen', 'stegAnlegen'])
  })
})

describe('Assistent: Namen in der Sprache der Oberfläche', () => {
  beforeEach(() => setLocale('de'))
  afterEach(() => setLocale('de'))

  it('nennt Lücken wie die Tabelle, deutsch und englisch, ohne technische Kennung', () => {
    const boje = { feld: 'Tor1_aussen', element: 'Tor 1 (hin seiteA)', klassen: ['7'], nurZusammengelegt: false }
    const steg = { katalog: 'stegAblegen', element: 'Ablegen', klassen: ['7'], nurZusammengelegt: false }
    expect(lueckenName(boje)).toBe('Tor 1 rechts · außen')
    expect(lueckenName({ ...boje, feld: 'StartZiel_oben' })).toBe('Start / Ziel links')
    expect(lueckenName(steg)).toBe('Ablegen am Steg (Haken „Steg“)')
    expect(lueckenName({ ...boje, nurZusammengelegt: true })).toBe('Tor 1 rechts · außen – nur bei zusammengelegten Tor-5-Listen')
    setLocale('en')
    expect(lueckenName(boje)).toBe('Gate 1 right · outer')
    expect(lueckenName({ ...boje, feld: 'mueb' })).toBe('Man-over-board')
    expect(lueckenName(steg)).toBe('Casting off at the pontoon (“Pontoon” option)')
    // Was sich nicht zuordnen lässt, behält den Namen der Prüfung.
    expect(lueckenName({ element: 'Unbekannt', klassen: [], nurZusammengelegt: false })).toBe('Unbekannt')
  })
})

describe('Assistent: englischer Titel', () => {
  const entwurf = (): Entwurf => ({
    ...leererEntwurf('probe', 'Probe'),
    spalten: [
      { id: 'p1', titel: 'Am Kran', titelEn: ' At the crane ' },
      { id: 'p2', titel: 'Hinter der Mole' },
      { id: 'p3', titel: 'Steg' },
      { id: 'p4', titel: 'Ohne alles' },
      { id: 'p5', titel: ' ', titelEn: 'Ignored', zeiten: ['elektronisch'] },
    ],
    zuordnung: { Tor1_innen: ['p1'], Tor1_aussen: ['p1'], Tor2_innen: ['p2'], Tor2_aussen: ['p2'], Tor3_innen: ['p3'], Tor3_aussen: ['p3'] },
  })
  const texte = ROH_QUELLE.uebersetzungen?.en?.texte ?? {}

  it('steht nur dann in der Position, wenn er etwas sagt', () => {
    const e = entwurf()
    expect(spalteAlsPosition(e, e.spalten[0])).toMatchObject({ titel: 'Am Kran', titelEn: 'At the crane' })
    expect(spalteAlsPosition(e, e.spalten[1])).not.toHaveProperty('titelEn')
    // Ohne deutschen Titel gilt der Ersatztitel – mit seiner mitgelieferten Übersetzung.
    expect(spalteAlsPosition(e, e.spalten[4])).toMatchObject({ titel: 'Elektronische Zeiterfassung' })
    expect(spalteAlsPosition(e, e.spalten[4])).not.toHaveProperty('titelEn')
  })

  it('bleibt beim Bearbeiten erhalten', () => {
    const aufbau = zuAufbau(entwurf())
    const { entwurf: wieder } = ausAufbau(aufbau, ROH_QUELLE, { id: 'probe', name: 'Probe' }, () => 'neu', true)
    expect(wieder.spalten.find((s) => s.id === 'p1')).toMatchObject({ titel: 'Am Kran', titelEn: 'At the crane' })
    expect(zuAufbau(wieder)).toEqual(aufbau)
  })

  it('nennt die Positionen ohne englischen Titel – nicht die mitgeliefert übersetzten und nicht die, die entfallen', () => {
    expect(texte.Steg).toBeTruthy()
    expect(ohneEnglischenTitel(entwurf(), texte).map((s) => s.id)).toEqual(['p2'])
  })
})
