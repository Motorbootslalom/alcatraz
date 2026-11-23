import { describe, expect, it } from 'vitest'
import { configFor, type Konfig } from '../config/konfig'
import { listenFelder } from '../lib/eingaben'
import type { ClassId } from '../types'
import { WKR_ANNAHMEN } from './annahmen'
import { teileVon, type ListenTeil } from './liste'
import { bojenVon, disqFuer, maskeFuer, tippe, tippeBoje, tippeBojenDisq, leererEntwurf, zellenAus, type MaskenAufbau } from './maske'
import { maskenJeKlasse, type ListenSicht } from './sicht'
import { eingabenAus, kopfGruppen, tabellenSpalten, zeileAusEingaben, zelleAusEingabe, type TabellenSpalte } from './tabelle'
import { wertGilt } from './zeile'

// Maske „Tabelle“ (W5.5, Plan docs/plan-wkr-w5.md §8, 22.11.2026): Spalten wie der Bogen, jede Spalte jeder Liste mit
// Maske unter DM und UIM über dieselben Sanierer wie die Erfassung – was die Tabelle als gültig durchlässt, nimmt
// wertGilt unverändert an, und der Entwurf schickt genau die Zellen der Tabelle (Rund-Probe). Nur Konfiguration, keine Starter.

const DM = configFor({ regelwerk: 'dm-2026' })
const UIM = configFor({ regelwerk: 'uim-2026' })
const KLASSEN: ClassId[] = ['1', '2', '3', '4', '5', '6', '7', 'E']

function sichtMit(konfig: Konfig, typeId: string): ListenSicht {
  return { klassen: maskenJeKlasse(konfig, konfig, typeId, KLASSEN, WKR_ANNAHMEN.xListen.includes(typeId)) } as ListenSicht
}

/** Alle Masken, die die Tabelle tragen kann (wie die Knöpfe: Katalog, Vorsteg, Bojen, Zeit), je Klasse und Teil. */
function alleMasken(): { name: string; konfig: Konfig; typeId: string; klasse: ClassId; sicht: ListenSicht; aufbau: MaskenAufbau; teil: ListenTeil | undefined }[] {
  const out: ReturnType<typeof alleMasken> = []
  for (const [name, konfig] of [['DM', DM], ['UIM', UIM]] as const) {
    for (const p of konfig.getPositions()) {
      const sicht = sichtMit(konfig, p.typeId)
      for (const klasse of KLASSEN) {
        const aufbau = maskeFuer(sicht, klasse)
        if (!aufbau || aufbau.art === 'spaeter' || aufbau.art === 'pruefliste') continue
        for (const teil of teileVon(p.typeId) ? ([undefined, 'ab', 'an'] as const) : ([undefined] as const)) {
          out.push({ name: `${name} ${p.typeId} Kl. ${klasse}${teil ? ` ${teil}` : ''}`, konfig, typeId: p.typeId, klasse, sicht, aufbau, teil })
        }
      }
    }
  }
  return out
}

/** Gültige Eingaben je Spalte – so, wie ein Geübter sie tippt (klein, mit Leerzeichen). */
function gueltigeEingaben(s: TabellenSpalte, aufbau: MaskenAufbau, teil: ListenTeil | undefined): string[] {
  switch (s.art) {
    case 'boje': {
      const b = bojenVon(aufbau).find((x) => x.feld === s.feld)!
      const out = [String(b.punkte)]
      if (b.zaehler) out.push(String(b.punkte * 2))
      if (b.disq[0]) out.push(`${b.punkte} ${b.disq[0].code.toLowerCase()}`, b.disq[0].code)
      return out
    }
    case 'code': {
      const t = aufbau.teile.find((x) => x.feld === s.feld)!
      const [a, b] = t.codes.map((c) => c.code)
      const out = [a, `2x${a}`]
      if (b) out.push(`${b} ${a}`)
      // Buchstaben nur, wo die Maske sie in DIESES Feld schreibt (H1: Liste ohne eigenes Disq.-Feld).
      const d = aufbau.disq?.feld === s.feld ? disqFuer(aufbau, teil)[0] : undefined
      if (d) out.push(`${a}, ${d.code.toLowerCase()}`)
      return out
    }
    case 'disq': {
      const d = disqFuer(aufbau, teil)
      return d.length > 0 ? [d[0].code.toLowerCase(), d.map((x) => x.code).join(' ')] : []
    }
    case 'zeit':
      return ['83,45', '1:02.5', '61.3']
    case 'text':
      return ['  Boot kippte ']
  }
}

describe('Spalten wie der Bogen', () => {
  it('Reihenfolge der Felder des Bogens, nur was die Maske des Teils trägt; Köpfe wie der Bogen', () => {
    for (const m of alleMasken()) {
      const spalten = tabellenSpalten(m.sicht, m.klasse, m.aufbau, m.teil)
      const bogen = listenFelder(m.konfig, m.typeId, m.klasse).map((f) => f.kennung)
      const traegt = Object.keys(zellenAus(leererEntwurf(), m.aufbau, m.teil))
      expect(spalten.map((s) => s.feld), m.name).toEqual(bogen.filter((k) => traegt.includes(k)))
      expect(spalten.length, m.name).toBe(traegt.length)
      for (const s of spalten) {
        const f = m.sicht.klassen[m.klasse]!.felder!.find((x) => x.kennung === s.feld)!
        expect(s.titel, m.name).toBe((f.boje?.titel ?? f.label).replace(/:\s*$/, ''))
        expect(s.unter, m.name).toBe(f.boje?.unter ?? '')
      }
    }
  })

  it('Steg: Ablegen ohne Spalten des Anlegens, gemeinsame (Disq., Bemerkung) in beiden', () => {
    const sicht = sichtMit(DM, 'steg')
    const aufbau = maskeFuer(sicht, '1')!
    const ab = tabellenSpalten(sicht, '1', aufbau, 'ab')
    const an = tabellenSpalten(sicht, '1', aufbau, 'an')
    expect(ab.some((s) => s.teil === 'an')).toBe(false)
    expect(an.some((s) => s.teil === 'ab')).toBe(false)
    const gemeinsam = ab.filter((s) => !s.teil).map((s) => s.feld)
    expect(gemeinsam.length).toBeGreaterThan(0)
    expect(an.filter((s) => !s.teil).map((s) => s.feld)).toEqual(gemeinsam)
  })

  it('zweite Sprache (UIM): Köpfe aus `andere`', () => {
    const sicht = { ...sichtMit(UIM, 'gate135') } as ListenSicht
    sicht.andere = { sprache: 'de', titel: '', bereich: '', klassen: Object.fromEntries(Object.entries(sicht.klassen).map(([k, v]) => [k, { titel: v!.titel, felder: v!.felder?.map((f) => ({ kennung: f.kennung, label: f.label, ...(f.boje ? { boje: { titel: `${f.boje.titel}*`, unter: f.boje.unter } } : {}) })) ?? null }])) }
    const aufbau = maskeFuer(sicht, '5')!
    const spalten = tabellenSpalten(sicht, '5', aufbau, undefined, 'andere')
    expect(spalten.filter((s) => s.art === 'boje').every((s) => s.titel.endsWith('*'))).toBe(true)
  })

  it('kopfGruppen: gleiche Titel mit Unterspalten nebeneinander zusammengefasst', () => {
    const s = (titel: string, unter: string): TabellenSpalte => ({ feld: `${titel}${unter}`, art: 'boje', titel, unter })
    expect(kopfGruppen([s('Tor 1', 'H L'), s('Tor 1', 'H R'), s('Tor 2', 'H L'), { feld: 'b', art: 'text', titel: 'Bem.', unter: '' }])).toEqual([
      { titel: 'Tor 1', breite: 2, mitUnter: true },
      { titel: 'Tor 2', breite: 1, mitUnter: true },
      { titel: 'Bem.', breite: 1, mitUnter: false },
    ])
  })
})

describe('Eingabe → Zellwert: dieselben Sanierer, wertGilt unverändert', () => {
  it('jede Spalte jeder Liste mit Maske (DM, UIM, je Klasse und Teil): gültige Eingaben gelten am Bedienrechner und gehen genau so hinaus', () => {
    let geprueft = 0
    const arten = new Set<string>()
    for (const m of alleMasken()) {
      const spalten = tabellenSpalten(m.sicht, m.klasse, m.aufbau, m.teil)
      const host = new Map(listenFelder(m.konfig, m.typeId, m.klasse).map((f) => [f.kennung, f]))
      for (const s of spalten) {
        for (const eingabe of gueltigeEingaben(s, m.aufbau, m.teil)) {
          const z = zelleAusEingabe(s, eingabe, m.aufbau, m.teil)
          expect(z.fehler, `${m.name} ${s.feld} „${eingabe}“`).toBeNull()
          expect(wertGilt(host.get(s.feld)!, z.wert), `${m.name} ${s.feld} „${eingabe}“ → „${z.wert}“`).toBe(true)
          // Die ganze Zeile: nur diese Zelle gefüllt – der Entwurf schickt genau sie.
          const zeile = zeileAusEingaben(spalten, { [s.feld]: eingabe }, m.aufbau, m.teil)
          expect(zeile.fehler, `${m.name} ${s.feld} „${eingabe}“`).toEqual({})
          expect(zellenAus(zeile.entwurf, m.aufbau, m.teil), `${m.name} ${s.feld}`).toEqual(zeile.zellen)
          geprueft++
          arten.add(s.art)
        }
      }
    }
    expect(geprueft).toBeGreaterThan(500)
    expect([...arten].sort()).toEqual(['boje', 'code', 'disq', 'text', 'zeit'])
  })

  it('Leer gilt immer; Bojen als Zahl/„5, J“ (BZ6, 22.11.2026: mehrere Buchstaben in Katalogfolge); Codes „2x6, 20“ sortiert wie die Erfassung', () => {
    const sicht = sichtMit(DM, 'gate135')
    const aufbau = maskeFuer(sicht, '7')!
    const spalten = tabellenSpalten(sicht, '7', aufbau, undefined)
    const schalter = spalten.find((s) => s.art === 'boje' && !bojenVon(aufbau).find((b) => b.feld === s.feld)!.zaehler)!
    const zaehler = spalten.find((s) => s.art === 'boje' && bojenVon(aufbau).find((b) => b.feld === s.feld)!.zaehler)!
    const mitDisq = spalten.find((s) => s.art === 'boje' && bojenVon(aufbau).find((b) => b.feld === s.feld)!.disq.some((d) => d.code === 'J'))!
    expect(zelleAusEingabe(schalter, '', aufbau)).toEqual({ wert: '', fehler: null })
    expect(zelleAusEingabe(schalter, '5', aufbau)).toEqual({ wert: '5', fehler: null })
    expect(zelleAusEingabe(mitDisq, 'j5', aufbau)).toEqual({ wert: '5, J', fehler: null })
    // Zwei erlaubte Buchstaben (R7-14): kein Fehler, Katalogfolge, Dubletten still weg.
    const [x, y] = bojenVon(aufbau).find((b) => b.feld === mitDisq.feld)!.disq.map((d) => d.code)
    expect(zelleAusEingabe(mitDisq, `${y}5${x}${y}`, aufbau)).toEqual({ wert: `5, ${x}, ${y}`, fehler: null })
    expect(zelleAusEingabe(zaehler, '15', aufbau)).toEqual({ wert: '15', fehler: null })
    const code = spalten.find((s) => s.art === 'code')
    if (code) {
      const [a, b] = aufbau.teile.find((t) => t.feld === code.feld)!.codes.map((c) => c.code)
      expect(zelleAusEingabe(code, `${b} ${a} ${a}`, aufbau).wert).toBe(`2x${a}, ${b}`)
    }
  })

  it('Fehler je Zelle als Code: fremde Zeichen, unbekannter Code, Punkte ohne Berührung, unlesbare Zeit, zu lang', () => {
    const sicht = sichtMit(DM, 'gate135')
    const aufbau = maskeFuer(sicht, '7')!
    const spalten = tabellenSpalten(sicht, '7', aufbau, undefined)
    const schalter = spalten.find((s) => s.art === 'boje' && !bojenVon(aufbau).find((b) => b.feld === s.feld)!.zaehler)!
    expect(zelleAusEingabe(schalter, '3', aufbau).fehler).toBe('boje-punkte')
    expect(zelleAusEingabe(schalter, '10', aufbau).fehler).toBe('boje-punkte')
    expect(zelleAusEingabe(schalter, '0', aufbau).fehler).toBe('boje-punkte')
    expect(zelleAusEingabe(schalter, '5Q', aufbau).fehler).toBe('zeichen-fremd')
    // Ein fremder Buchstabe neben einem erlaubten ist weiter ein Fehler (sanitizeBuoy ließe ihn still weg).
    expect(zelleAusEingabe(schalter, '5JQ', aufbau).fehler).toBe('zeichen-fremd')
    const tor5 = maskeFuer(sichtMit(DM, 'tor5'), '1')!
    const t5 = tabellenSpalten(sichtMit(DM, 'tor5'), '1', tor5, undefined)
    const code = t5.find((s) => s.art === 'code')!
    expect(zelleAusEingabe(code, '999', tor5, undefined).fehler).toBe('code-unbekannt')
    expect(zelleAusEingabe(code, `${tor5.teile[0].codes[0].code} #`, tor5, undefined).fehler).toBe('zeichen-fremd')
    const zeit: TabellenSpalte = { feld: 'z', art: 'zeit', titel: 'Zeit', unter: '' }
    expect(zelleAusEingabe(zeit, 'abc', aufbau).fehler).toBe('zeit-unlesbar')
    expect(zelleAusEingabe(zeit, '83,4s', aufbau).fehler).toBe('zeichen-fremd')
    const text: TabellenSpalte = { feld: 't', art: 'text', titel: 'Bem.', unter: '' }
    expect(zelleAusEingabe(text, 'x'.repeat(WKR_ANNAHMEN.textMax + 1), aufbau).fehler).toBe('zu-lang')
  })

  it('Rund-Probe: einzeln gültig, als Zeile anders → `nicht-darstellbar` (derselbe Disq.-Buchstabe doppelt)', () => {
    const sicht = sichtMit(DM, 'steg')
    const aufbau = maskeFuer(sicht, '1')!
    const spalten = tabellenSpalten(sicht, '1', aufbau, 'ab')
    const disq = spalten.find((s) => s.feld === aufbau.disq!.feld)!
    const d = disqFuer(aufbau, 'ab')[0].code
    const zeile = zeileAusEingaben(spalten, { [disq.feld]: `${d}${d}` }, aufbau, 'ab')
    expect(zeile.fehler[disq.feld]).toBe('nicht-darstellbar')
  })

  it('eingabenAus: Entwurf → Eingaben (Codes „2x…“, Bojen „5, J“, Zeit wie getippt), und zurück dieselbe Zeile', () => {
    const sicht = sichtMit(DM, 'gate135')
    const aufbau = maskeFuer(sicht, '7')!
    const spalten = tabellenSpalten(sicht, '7', aufbau, undefined)
    const b = bojenVon(aufbau).find((x) => x.disq.some((d) => d.code === 'J'))!
    let e = tippeBojenDisq(tippeBoje(leererEntwurf(), b), b, 'J')
    const t = aufbau.teile[0]
    if (t) e = tippe(tippe(e, t.feld, t.codes[0].code), t.feld, t.codes[0].code)
    const eingaben = eingabenAus(spalten, e, aufbau)
    expect(eingaben[b.feld]).toBe('5, J')
    if (t) expect(eingaben[t.feld]).toBe(`2x${t.codes[0].code}`)
    const zeile = zeileAusEingaben(spalten, eingaben, aufbau)
    expect(zeile.fehler).toEqual({})
    expect(zellenAus(zeile.entwurf, aufbau)).toEqual(zellenAus(e, aufbau))
  })
})
