import { describe, expect, it } from 'vitest'
import type { Aufgabe } from './aufgaben'
import {
  CODE_ALPHABET,
  CODE_GUELTIG_MS,
  CODE_LAENGE,
  dreheQr,
  formatiereCode,
  gibCode,
  KOPPEL_NACHLAUF_MS,
  koppelThemen,
  leererKoppelStand,
  liesKoppelStand,
  markiereBenutzt,
  normalisiereCode,
  oeffneQr,
  pruefeKoppeln,
  QR_GNADE_MS,
  QR_SITZUNG_MS,
  QR_TOKEN_GUELTIG_MS,
  qrFaellig,
  raeumeAuf,
  restSekunden,
  schliesseKoppeln,
  TOKEN_LAENGE,
  zufallsZeichen,
} from './koppeln'
import { koppelThema, zufallsThema } from './themen'
import { entscheideAnmeldung, type Anmeldung, type BekanntesGeraet, type KoppelAnfrage } from './koppelEntscheid'

// Aus tafel lib/pairing.test.ts und state/pairingDecision.test.ts portiert (16.11.2026) – ohne Dauercode (F3), mit
// Thema je Code und dem Fix S1. Gerätenamen erfunden.

const OA = zufallsThema()
const JETZT = 1_000_000
const STEG_SEE: Aufgabe[] = [{ art: 'startfreigabe', bereiche: ['see'] }]
const STEG_LAND: Aufgabe[] = [{ art: 'startfreigabe', bereiche: ['land'] }]

describe('Codes', () => {
  it('Alphabet ohne verwechselbare Zeichen', () => {
    for (const c of 'OILZSBU') expect(CODE_ALPHABET).not.toContain(c)
    expect(new Set(CODE_ALPHABET).size).toBe(CODE_ALPHABET.length)
  })

  it('Codes der vereinbarten Länge aus dem Alphabet, ohne Schieflage', () => {
    for (let i = 0; i < 50; i++) {
      const c = zufallsZeichen(CODE_LAENGE)
      expect(c).toHaveLength(CODE_LAENGE)
      for (const z of c) expect(CODE_ALPHABET).toContain(z)
    }
    // Bytes über der Grenze (232 = 8·29) werden verworfen statt auf die ersten Zeichen gefaltet.
    let zug = 0
    const zufall = (n: number) => Uint8Array.from({ length: n }, () => (zug++ % 2 === 0 ? 255 : 0))
    expect(zufallsZeichen(3, CODE_ALPHABET, zufall)).toBe('000')
  })

  it('normalisiert, wie abgelesen wird; weist Falsches ab', () => {
    expect(normalisiereCode('a3f-k7m')).toBe('A3FK7M')
    expect(normalisiereCode(' A3F K7M ')).toBe('A3FK7M')
    expect(normalisiereCode('OIL5B2')).toBe('011582')
    expect(normalisiereCode('ABC')).toBeNull()
    expect(normalisiereCode('ABCDE!')).toBeNull()
    expect(formatiereCode('A3FK7M')).toBe('A3F-K7M')
  })
})

describe('Geräte-Code', () => {
  const stand = gibCode(leererKoppelStand(), OA, STEG_SEE, JETZT)
  const code = stand.code!
  const thema = koppelThema(OA, code.wert)

  it('gilt fünf Minuten auf seinem Thema, mit genau den Rechten der Ausgabe', () => {
    expect(code.thema).toBe(thema)
    expect(pruefeKoppeln(stand, code.wert, thema, JETZT + CODE_GUELTIG_MS - 1)).toEqual({ ok: true, aufgaben: STEG_SEE, weg: 'code' })
    expect(pruefeKoppeln(stand, code.wert, thema, JETZT + CODE_GUELTIG_MS)).toEqual({ ok: false, grund: 'code-abgelaufen' })
  })

  it('so, wie er abgelesen wurde', () => {
    const abgelesen = formatiereCode(code.wert).toLowerCase().replace(/0/g, 'O').replace(/1/g, 'l')
    expect(pruefeKoppeln(stand, abgelesen, thema, JETZT + 1).ok).toBe(true)
  })

  it('nur auf dem eigenen Thema – nicht auf dem eines anderen Codes oder der QR-Sitzung', () => {
    expect(pruefeKoppeln(stand, code.wert, koppelThema(OA, 'AAAAAA'), JETZT + 1)).toEqual({ ok: false, grund: 'code-ungueltig' })
    const mitQr = oeffneQr(stand, STEG_LAND, JETZT)
    expect(pruefeKoppeln(mitQr, code.wert, mitQr.qr!.thema, JETZT + 1).ok).toBe(false)
  })

  it('für EIN Gerät: benutzt gilt er nicht mehr; ein neuer macht den alten sofort ungültig', () => {
    const benutzt = markiereBenutzt(stand, JETZT + 1)
    expect(pruefeKoppeln(benutzt, code.wert, thema, JETZT + 2)).toEqual({ ok: false, grund: 'code-abgelaufen' })
    expect(markiereBenutzt(benutzt, JETZT + 5).code!.benutzt).toBe(JETZT + 1)
    const neu = gibCode(stand, OA, STEG_SEE, JETZT + 3)
    expect(neu.code!.wert).not.toBe(code.wert)
    expect(pruefeKoppeln(neu, code.wert, thema, JETZT + 4).ok).toBe(false)
  })

  it('weist einen fremden Code ab; schließen räumt nur den Code', () => {
    expect(pruefeKoppeln(stand, 'XXXXXX', koppelThema(OA, 'XXXXXX'), JETZT)).toEqual({ ok: false, grund: 'code-ungueltig' })
    const beide = oeffneQr(stand, STEG_LAND, JETZT)
    expect(schliesseKoppeln(beide, 'code')).toEqual({ code: null, qr: beide.qr })
    expect(schliesseKoppeln(beide)).toEqual(leererKoppelStand())
  })
})

describe('QR-Sitzung', () => {
  const stand = oeffneQr(leererKoppelStand(), STEG_LAND, JETZT)
  const qr = stand.qr!

  it('Token gilt 30 Sekunden auf dem zufälligen Thema der Sitzung', () => {
    expect(qr.token).toHaveLength(TOKEN_LAENGE)
    expect(pruefeKoppeln(stand, qr.token, qr.thema, JETZT + QR_TOKEN_GUELTIG_MS - 1)).toEqual({ ok: true, aufgaben: STEG_LAND, weg: 'qr' })
    expect(pruefeKoppeln(stand, qr.token, qr.thema, JETZT + QR_TOKEN_GUELTIG_MS).ok).toBe(false)
    expect(pruefeKoppeln(stand, qr.token, zufallsThema(), JETZT).ok).toBe(false)
  })

  it('wechselt; der abgelöste gilt noch im Gnadenfenster, mit denselben Rechten', () => {
    expect(qrFaellig(stand, JETZT + QR_TOKEN_GUELTIG_MS - 1000, 1000)).toBe(true)
    expect(qrFaellig(stand, JETZT + 1000, 1000)).toBe(false)
    const t = JETZT + QR_TOKEN_GUELTIG_MS - 500
    const gedreht = dreheQr(stand, t)
    expect(gedreht.qr!.token).not.toBe(qr.token)
    expect(gedreht.qr!.thema).toBe(qr.thema)
    expect(pruefeKoppeln(gedreht, qr.token, qr.thema, t + QR_GNADE_MS - 1)).toEqual({ ok: true, aufgaben: STEG_LAND, weg: 'qr' })
    expect(pruefeKoppeln(gedreht, qr.token, qr.thema, t + QR_GNADE_MS)).toEqual({ ok: false, grund: 'code-abgelaufen' })
  })

  it('endet nach höchstens zehn Minuten: kein Token, kein Wechsel, Thema nur noch im Nachlauf', () => {
    const ende = JETZT + QR_SITZUNG_MS
    expect(dreheQr(stand, ende)).toBe(stand)
    expect(qrFaellig(stand, ende)).toBe(false)
    expect(koppelThemen(stand, ende)).toEqual([qr.thema])
    expect(koppelThemen(stand, ende + KOPPEL_NACHLAUF_MS)).toEqual([])
    expect(raeumeAuf(stand, ende + KOPPEL_NACHLAUF_MS)).toEqual(leererKoppelStand())
    expect(raeumeAuf(stand, JETZT)).toBe(stand)
  })
})

describe('liesKoppelStand und restSekunden', () => {
  it('liest, was es ausgab, und verschluckt sich an Kaputtem nicht', () => {
    const stand = oeffneQr(gibCode(leererKoppelStand(), OA, STEG_SEE, JETZT), STEG_LAND, JETZT)
    expect(liesKoppelStand(JSON.parse(JSON.stringify(stand)))).toEqual(stand)
    expect(liesKoppelStand({ code: { wert: 'kurz' }, qr: 5 })).toEqual(leererKoppelStand())
    expect(liesKoppelStand(null)).toEqual(leererKoppelStand())
  })

  it('zählt herunter und bleibt bei null', () => {
    expect(restSekunden(JETZT + 1500, JETZT)).toBe(2)
    expect(restSekunden(JETZT - 1, JETZT)).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// Entscheidung über eine Anmeldung
// ---------------------------------------------------------------------------

const PK_ALT = 'A'.repeat(43)
const PK_NEU = 'B'.repeat(43)

function anfrage(koppeln = gibCode(leererKoppelStand(), OA, STEG_SEE, JETZT), mehr: Partial<Anmeldung> = {}, geraete: Record<string, BekanntesGeraet> = {}): KoppelAnfrage {
  const wert = koppeln.code?.wert ?? ''
  let n = 0
  return {
    koppeln,
    geraete,
    anmeldung: { id: 'neu', pk: PK_NEU, gebunden: false, name: 'iPhone', code: wert, thema: koppeln.code?.thema ?? '', ...mehr },
    jetzt: JETZT + 1000,
    neueId: () => `frei${++n}`,
    ersatzName: 'Gerät',
  }
}

describe('entscheideAnmeldung – mit gültigem Code', () => {
  it('gibt genau die Rechte, die im Code stecken – das Gerät bestimmt sie nicht', () => {
    expect(entscheideAnmeldung(anfrage())).toEqual({ art: 'willkommen', id: 'neu', name: 'iPhone', aufgaben: STEG_SEE, weg: 'code' })
  })

  it('hängt eine Zahl an einen vergebenen Namen; ein leerer Name wird „Gerät“', () => {
    const geraete = { alt: { pk: PK_ALT, name: 'iPhone', aufgaben: STEG_SEE } }
    expect(entscheideAnmeldung(anfrage(undefined, {}, geraete))).toMatchObject({ name: 'iPhone 2' })
    expect(entscheideAnmeldung(anfrage(undefined, { name: '' }))).toMatchObject({ name: 'Gerät' })
  })

  it('S1: eine ID, die einem anderen Schlüssel gehört, wird nie überschrieben – das Gerät bekommt eine neue', () => {
    const geraete = { neu: { pk: PK_ALT, name: 'Steg See', aufgaben: STEG_SEE } }
    const d = entscheideAnmeldung(anfrage(undefined, {}, geraete))
    expect(d).toMatchObject({ art: 'willkommen', id: 'frei1', name: 'iPhone' })
    // Auch eine Anmeldung, die sich „gebunden“ nennt, ohne dass der Schlüssel passt, ist kein bekanntes Gerät.
    const ohneCode = entscheideAnmeldung(anfrage(undefined, { gebunden: true, code: '' }, geraete))
    expect(ohneCode).toEqual({ art: 'abgelehnt', grund: 'code-ungueltig' })
  })

  it('mit QR-Token auf dem Thema der Sitzung', () => {
    const k = oeffneQr(leererKoppelStand(), STEG_LAND, JETZT)
    const d = entscheideAnmeldung(anfrage(k, { code: k.qr!.token, thema: k.qr!.thema }))
    expect(d).toMatchObject({ art: 'willkommen', aufgaben: STEG_LAND, weg: 'qr' })
  })
})

describe('entscheideAnmeldung – ohne gültigen Code', () => {
  it('weist ein unbekanntes Gerät ab, auch bei abgelaufenem oder benutztem Code', () => {
    expect(entscheideAnmeldung(anfrage(undefined, { code: 'AAAAAA' }))).toEqual({ art: 'abgelehnt', grund: 'code-ungueltig' })
    expect(entscheideAnmeldung({ ...anfrage(), jetzt: JETZT + 10 * 60_000 })).toEqual({ art: 'abgelehnt', grund: 'code-abgelaufen' })
    const benutzt = markiereBenutzt(gibCode(leererKoppelStand(), OA, STEG_SEE, JETZT), JETZT + 1)
    expect(entscheideAnmeldung(anfrage(benutzt, { id: 'mithoerer', name: 'Mithörer' }))).toEqual({ art: 'abgelehnt', grund: 'code-abgelaufen' })
  })

  it('ein bekanntes Gerät (ID UND Schlüssel) kommt nach dem Funkloch wieder herein – Name und Rechte bleiben', () => {
    const geraete = { alt: { pk: PK_ALT, name: 'Steg See', aufgaben: STEG_SEE } }
    const d = entscheideAnmeldung(anfrage(leererKoppelStand(), { id: 'alt', pk: PK_ALT, gebunden: true, code: '', name: 'Chef-Handy' }, geraete))
    expect(d).toEqual({ art: 'willkommen', id: 'alt', name: 'Steg See', aufgaben: STEG_SEE, weg: null })
  })

  it('das erste Gerät mit dem verbrauchten Code kommt trotzdem wieder herein (doppelte Anmeldung)', () => {
    const k = markiereBenutzt(gibCode(leererKoppelStand(), OA, STEG_SEE, JETZT), JETZT + 1)
    const geraete = { erstes: { pk: PK_ALT, name: 'iPhone', aufgaben: STEG_SEE } }
    const d = entscheideAnmeldung(anfrage(k, { id: 'erstes', pk: PK_ALT, gebunden: true }, geraete))
    expect(d).toEqual({ art: 'willkommen', id: 'erstes', name: 'iPhone', aufgaben: STEG_SEE, weg: null })
  })

  it('ein bekanntes Gerät mit neuem gültigem Code bekommt dessen Rechte', () => {
    const k = gibCode(leererKoppelStand(), OA, STEG_LAND, JETZT)
    const geraete = { alt: { pk: PK_ALT, name: 'Steg', aufgaben: STEG_SEE } }
    expect(entscheideAnmeldung(anfrage(k, { id: 'alt', pk: PK_ALT, gebunden: true }, geraete))).toMatchObject({ aufgaben: STEG_LAND, weg: 'code', name: 'Steg' })
  })
})
