import { describe, expect, it } from 'vitest'
import nacl from 'tweetnacl'
import { koppelnAdresse, koppelPaketAus, leseLinkUrl, liesKoppelLink, liesLeseLink, packeKoppelPaket, packeLesePaket, PAKET_FASSUNG, sehenAdresse } from './paket'
import { PAGES_URL } from '../lib/build'
import { qrModules } from '../lib/qr'
import { fromBase64Url, toBase64Url } from './transport/ntfy/codec'
import { geraeteThemaVon, lesePaket, neuerRaum } from './transport/ntfy/raum'
import { OEFFENTLICH, ZUSCHAUER } from './transport/protokoll'
import { NTFY_VORGABE, zufallsThema } from './themen'

/**
 * Das Paket eines Lese-Links in der Adresse (`#/sehen/<paket>`, E6). Server und Schlüssel sind erfunden bzw. für den
 * Test gewürfelt; kein Netz.
 */

/** Steht `nadel` als zusammenhängende Bytefolge in `heu`? */
function enthaelt(heu: Uint8Array, nadel: Uint8Array): boolean {
  outer: for (let i = 0; i + nadel.length <= heu.length; i++) {
    for (let j = 0; j < nadel.length; j++) if (heu[i + j] !== nadel[j]) continue outer
    return true
  }
  return false
}

describe('Lese-Link packen und lesen', () => {
  it('kommt unverändert zurück – Anzeigetafel und Zuschauer, Vorgabe-Server, eigener Server, http', () => {
    for (const server of [NTFY_VORGABE, 'https://ntfy.example.org', 'https://example.org/ntfy', 'http://192.168.1.20:8080']) {
      const raum = neuerRaum(server)
      for (const welches of ['a', 'z'] as const) {
        const paket = lesePaket(raum, welches)
        const text = packeLesePaket(paket)
        expect(text).toMatch(/^[A-Za-z0-9_-]+$/)
        expect(liesLeseLink(text)).toEqual({ ok: true, paket, welches })
      }
    }
  })

  it('kurz genug für einen QR-Code (Version 10, Fehlerkorrektur M, mit der Adresse der Seite)', () => {
    expect(packeLesePaket(lesePaket(neuerRaum(NTFY_VORGABE), 'a')).length).toBeLessThanOrEqual(156)
    expect(packeLesePaket(lesePaket(neuerRaum('https://ntfy.example.org'), 'z')).length).toBeLessThanOrEqual(156)
    // So lang wie die Adresse auf Pages (motorbootslalom.github.io/alcatraz/).
    const adresse = `https://muster12345678901.example.org/alcatraz/${sehenAdresse(packeLesePaket(lesePaket(neuerRaum(NTFY_VORGABE), 'a')))}`
    expect(adresse.length).toBeLessThanOrEqual(213)
  })

  it('der Server steht immer darin, auch die Vorgabe – ein neueres Programm mit anderer Vorgabe liest denselben', () => {
    const text = packeLesePaket(lesePaket(neuerRaum(NTFY_VORGABE), 'a'))
    const bytes = fromBase64Url(text)!
    expect(enthaelt(bytes, new TextEncoder().encode(NTFY_VORGABE.replace('https://', '')))).toBe(true)
  })

  it('trägt nur das eigene Thema und den Schlüssel der eigenen Gruppe – nie g, Geheimnis oder geheime Schlüssel', () => {
    const raum = neuerRaum('https://ntfy.example.org')
    for (const [welches, anderes] of [['a', 'z'], ['z', 'a']] as const) {
      const bytes = fromBase64Url(packeLesePaket(lesePaket(raum, welches)))!
      const fremdeGruppe = raum.gruppen[anderes === 'a' ? OEFFENTLICH : ZUSCHAUER].k
      for (const geheim of [raum.geheimnis, raum.box.sk, raum.sign.sk, raum.oeffentlich[anderes], fremdeGruppe, geraeteThemaVon(raum)]) {
        expect(enthaelt(bytes, fromBase64Url(geheim)!)).toBe(false)
      }
      expect(enthaelt(bytes, fromBase64Url(raum.oeffentlich[welches])!)).toBe(true)
    }
  })

  it('weist Verstümmeltes ab: ein Zeichen anders, abgeschnitten, angehängt, Unsinn', () => {
    const text = packeLesePaket(lesePaket(neuerRaum(NTFY_VORGABE), 'z'))
    const mitte = Math.floor(text.length / 2)
    const anders = text.slice(0, mitte) + (text[mitte] === 'A' ? 'B' : 'A') + text.slice(mitte + 1)
    for (const kaputt of [anders, text.slice(0, -3), `${text}AA`, '', 'Unsinn', 'a'.repeat(2000), 42, null]) {
      expect(liesLeseLink(kaputt)).toEqual({ ok: false, code: 'link-ungueltig' })
    }
  })

  it('erkennt ein Paket einer anderen Fassung (mit gültiger Prüfsumme) – „Update nötig“ statt „Link ungültig“', () => {
    const bytes = fromBase64Url(packeLesePaket(lesePaket(neuerRaum(NTFY_VORGABE), 'a')))!
    const daten = bytes.slice(0, -4)
    daten[0] = PAKET_FASSUNG + 1
    const neu = new Uint8Array(daten.length + 4)
    neu.set(daten, 0)
    neu.set(nacl.hash(daten).subarray(0, 4), daten.length)
    expect(liesLeseLink(toBase64Url(neu))).toEqual({ ok: false, code: 'fassung', fassung: PAKET_FASSUNG + 1 })
  })

  it('packt nichts Unpassendes', () => {
    const paket = lesePaket(neuerRaum(NTFY_VORGABE), 'a')
    expect(() => packeLesePaket({ ...paket, g: 'steg' })).toThrow()
    expect(() => packeLesePaket({ ...paket, u: 'ftp://x' })).toThrow()
    expect(() => packeLesePaket({ ...paket, k: 'kurz' })).toThrow()
  })

  it('die Adresse: #/sehen/<paket>', () => {
    expect(sehenAdresse('abc')).toBe('#/sehen/abc')
  })

  it('der ganze Link: die Seite des Bedienrechners – unter file:// die App auf Pages; passt in QR Version 10', () => {
    const text = packeLesePaket(lesePaket(neuerRaum(NTFY_VORGABE), 'z'))
    expect(leseLinkUrl(text, { protocol: 'https:', origin: 'https://muster.example.org', pathname: '/alcatraz/' }, PAGES_URL)).toBe(`https://muster.example.org/alcatraz/#/sehen/${text}`)
    expect(leseLinkUrl(text, { protocol: 'http:', origin: 'http://localhost:5173', pathname: '/' }, PAGES_URL)).toBe(`http://localhost:5173/#/sehen/${text}`)
    // Die Ein-Datei-Fassung vom Stick: Kein Handy erreicht file:// – der Link führt zu Pages.
    const datei = leseLinkUrl(text, { protocol: 'file:', origin: 'null', pathname: '/media/stick/alcatraz.html' }, PAGES_URL)
    expect(datei).toBe(`${PAGES_URL}#/sehen/${text}`)
    expect(datei.length).toBeLessThanOrEqual(213)
    // Version 10 = 57 Module: noch vom Bildschirm und vom A4-Aushang zu scannen.
    expect(qrModules(datei).length).toBeLessThanOrEqual(57)
    expect(liesLeseLink(datei.split('#/sehen/')[1]).ok).toBe(true)
  })
})

describe('Koppel-Link (E7)', () => {
  it('kommt unverändert zurück – ohne und mit QR-Token; trägt den Box-Schlüssel des Hosts, nie Geheimes', () => {
    const raum = neuerRaum(NTFY_VORGABE)
    const ohne = koppelPaketAus(raum)
    const text = packeKoppelPaket(ohne)
    expect(liesKoppelLink(text)).toEqual({ ok: true, paket: ohne })
    const mit = koppelPaketAus(raum, { token: 'A3FK7MXY12CDEFGH', thema: zufallsThema() })
    const qr = packeKoppelPaket(mit)
    expect(liesKoppelLink(qr)).toEqual({ ok: true, paket: mit })
    expect(mit.b).toBe(raum.box.pk)
    const bytes = fromBase64Url(qr)!
    for (const geheim of [raum.geheimnis, raum.box.sk, raum.sign.sk, raum.gruppen[ZUSCHAUER].k]) expect(enthaelt(bytes, fromBase64Url(geheim)!)).toBe(false)
    expect(qr).not.toContain(geraeteThemaVon(raum))
    // Passt mit der Adresse der Seite in einen QR-Code (Version 13, M): Das Handy am Steg scannt vom Bildschirm.
    expect(qrModules(`${PAGES_URL}${koppelnAdresse(qr)}`).length).toBeLessThanOrEqual(17 + 4 * 13)
  })

  it('ein Lese-Link ist kein Koppel-Link und umgekehrt', () => {
    const raum = neuerRaum(NTFY_VORGABE)
    expect(liesKoppelLink(packeLesePaket(lesePaket(raum, 'a'))).ok).toBe(false)
    expect(liesLeseLink(packeKoppelPaket(koppelPaketAus(raum))).ok).toBe(false)
    expect(() => packeKoppelPaket({ ...lesePaket(raum, 'z'), b: raum.box.pk })).toThrow()
    expect(koppelnAdresse('x')).toBe('#/koppeln/x')
  })
})
