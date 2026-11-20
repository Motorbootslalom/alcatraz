import { describe, expect, it } from 'vitest'
import { KONTINGENT, kontingentLage, kontingentZaehler, tagesGrenze, tagVon } from './kontingent'
import { ABLAGE, type Ablage } from './ablage'

function speicher(): Ablage & { daten: Map<string, string> } {
  const daten = new Map<string, string>()
  return { daten, getItem: (k) => daten.get(k) ?? null, setItem: (k, v) => void daten.set(k, String(v)), removeItem: (k) => void daten.delete(k) }
}

describe('Kontingent-Zähler (E8, 20.11.2026)', () => {
  it('zählt je lokalem Tag; nach Mitternacht beginnt er bei 0', () => {
    let jetzt = new Date(2026, 10, 21, 23, 59).getTime()
    const s = speicher()
    const z = kontingentZaehler(s, () => jetzt)
    z.zaehle('anfrage')
    z.zaehle('nachricht')
    expect(z.lies()).toEqual({ tag: '2026-11-21', gesendet: 1, anfragen: 1, gedrosselt: null })
    jetzt = new Date(2026, 10, 22, 0, 1).getTime()
    expect(z.lies()).toEqual({ tag: '2026-11-22', gesendet: 0, anfragen: 0, gedrosselt: null })
    z.zaehle('gedrosselt')
    expect(z.lies().gedrosselt).toBe(jetzt)
    expect(tagVon(jetzt)).toBe('2026-11-22')
  })

  it('zwei Fenster zählen in denselben Eintrag; ohne Speicher im Arbeitsspeicher; Kaputtes zählt nicht', () => {
    const s = speicher()
    const a = kontingentZaehler(s, () => 0)
    const b = kontingentZaehler(s, () => 0)
    a.zaehle('nachricht')
    b.zaehle('nachricht')
    expect(a.lies().gesendet).toBe(2)
    // Kaputter Eintrag: zurück auf das, was dieses Fenster zuletzt selbst gezählt hat.
    s.setItem(ABLAGE.kontingent, '{kaputt')
    expect(a.lies().gesendet).toBe(1)
    const ohne = kontingentZaehler(null, () => 0)
    ohne.zaehle('nachricht')
    expect(ohne.lies().gesendet).toBe(1)
  })

  it('Speicher voll: zählt im Arbeitsspeicher weiter, statt am letzten Eintrag stehen zu bleiben (Prüfung E8, 21.11.2026)', () => {
    const s = speicher()
    const z = kontingentZaehler(s, () => 0)
    z.zaehle('nachricht')
    s.setItem = () => {
      throw new DOMException('voll', 'QuotaExceededError')
    }
    for (let i = 0; i < 5; i++) z.zaehle('nachricht')
    z.zaehle('gedrosselt')
    expect(z.lies()).toEqual({ tag: tagVon(0), gesendet: 6, anfragen: 0, gedrosselt: 0 })
    // Ein anderes Fenster, das noch schreiben konnte, zählt mit: je Feld das Größere.
    s.daten.set(ABLAGE.kontingent, JSON.stringify({ tag: tagVon(0), gesendet: 9, anfragen: 3, gedrosselt: null }))
    expect(z.lies()).toEqual({ tag: tagVon(0), gesendet: 9, anfragen: 3, gedrosselt: 0 })
  })

  it('Lage: Warnung ab dem angenommenen Anteil, erschöpft an der Grenze oder nach 429', () => {
    const grenze = 250
    const stand = (gesendet: number, gedrosselt: number | null = null) => ({ tag: 'x', gesendet, anfragen: 0, gedrosselt })
    expect(kontingentLage(stand(Math.ceil(grenze * KONTINGENT.warnenAb) - 1), grenze)).toBe('ok')
    expect(kontingentLage(stand(Math.ceil(grenze * KONTINGENT.warnenAb)), grenze)).toBe('warnung')
    expect(kontingentLage(stand(grenze), grenze)).toBe('erschoepft')
    expect(kontingentLage(stand(3, 99), grenze)).toBe('erschoepft')
    // Unbekannter Server: nur zählen, warnen erst bei 429.
    expect(kontingentLage(stand(100_000), null)).toBe('ok')
    expect(kontingentLage(stand(3, 99), null)).toBe('erschoepft')
  })

  it('kennt die Grenzen von adminforge (17 280) und ntfy.sh (250), sonst keine', () => {
    expect(tagesGrenze('https://ntfy.adminforge.de')).toBe(17_280)
    expect(tagesGrenze('ntfy.adminforge.de')).toBe(17_280)
    expect(tagesGrenze('https://ntfy.sh/')).toBe(250)
    expect(tagesGrenze('https://ntfy.example.org')).toBeNull()
  })
})
