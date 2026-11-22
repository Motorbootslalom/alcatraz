import { describe, expect, it } from 'vitest'
import { artAusKennung, eindeutigerName, geraeteArt, saubererName, NAME_MAX, typAus } from './geraeteName'
import { liesGeraeteNachricht } from './transport/protokoll'

// Aus tafel lib/deviceName.test.ts portiert (16.11.2026); Namen sind Gerätebezeichnungen, keine Personen.

describe('artAusKennung', () => {
  const faelle: [string, string][] = [
    ['Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15', 'iphone'],
    ['Mozilla/5.0 (iPad; CPU OS 16_0 like Mac OS X) AppleWebKit/605.1.15', 'ipad'],
    ['Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Mobile Safari/537.36', 'android-handy'],
    ['Mozilla/5.0 (Linux; Android 13; SM-X200) AppleWebKit/537.36 Safari/537.36', 'android-tablet'],
    ['Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36', 'mac'],
    ['Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36', 'windows'],
    ['Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36', 'linux'],
    ['irgendein Browser', 'geraet'],
    ['', 'geraet'],
  ]
  it.each(faelle)('erkennt %s', (ua, art) => expect(artAusKennung(ua)).toBe(art))

  it('ein iPad, das sich als Mac ausgibt, verrät sich durch Mehrfinger-Bedienung', () => {
    const mac = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
    expect(geraeteArt(mac, 5)).toBe('ipad')
    expect(geraeteArt(mac, 0)).toBe('mac')
  })
})

describe('eindeutigerName', () => {
  it('lässt einen freien Namen, hängt sonst eine Zahl an', () => {
    expect(eindeutigerName('iPhone', ['Android-Handy'], 'Gerät')).toBe('iPhone')
    expect(eindeutigerName('iPhone', ['iPhone'], 'Gerät')).toBe('iPhone 2')
    expect(eindeutigerName('iPhone', ['iPhone', 'iPhone 2'], 'Gerät')).toBe('iPhone 3')
  })

  it('zählt bei einem nummerierten Namen weiter und füllt Lücken', () => {
    expect(eindeutigerName('Steg 2', ['Steg 2'], 'Gerät')).toBe('Steg 3')
    expect(eindeutigerName('iPhone', ['iPhone', 'iPhone 3'], 'Gerät')).toBe('iPhone 2')
  })

  it('ignoriert Groß-/Kleinschreibung und Leerzeichen; leerer Wunsch → Ersatz', () => {
    expect(eindeutigerName(' iphone ', ['iPhone'], 'Gerät')).toBe('iphone 2')
    expect(eindeutigerName('', [], 'Device')).toBe('Device')
    expect(eindeutigerName('   ', ['Gerät'], 'Gerät')).toBe('Gerät 2')
  })

  it('kürzt und entfernt Steuerzeichen', () => {
    expect(saubererName('a\u0000b\nc', 'x')).toBe('abc')
    expect(saubererName('y'.repeat(100), 'x')).toHaveLength(NAME_MAX)
  })
})

describe('Art beim Koppeln (Nutzer 21.11.2026, W3-25, GF7)', () => {
  it('Finger + kurze Seite < 600 px = Handy, Finger sonst = Pad, Maus = Rechner', () => {
    expect(typAus(390, true)).toBe('handy')
    expect(typAus(820, true)).toBe('pad')
    expect(typAus(390, false)).toBe('rechner')
    expect(typAus(0, true)).toBe('pad')
  })

  it('`hallo` trägt die Art freiwillig; Unbekanntes fällt weg, die Anmeldung gilt weiter', () => {
    expect(liesGeraeteNachricht({ art: 'hallo', name: 'Handy', code: 'X', typ: 'handy' })).toEqual({ art: 'hallo', name: 'Handy', code: 'X', typ: 'handy' })
    expect(liesGeraeteNachricht({ art: 'hallo', name: 'Handy', code: 'X', typ: 'toaster' })).toEqual({ art: 'hallo', name: 'Handy', code: 'X' })
  })

  it('`lebenszeichen` trägt WKR-Namen freiwillig (W3-13, WN2): getrimmt, Unbrauchbares fällt weg, das Lebenszeichen gilt weiter', () => {
    expect(liesGeraeteNachricht({ art: 'lebenszeichen', wartend: 0, namen: { a: ' Erika Muster ', b: '', c: 7, d: 'x'.repeat(61) } })).toEqual({ art: 'lebenszeichen', wartend: 0, namen: { a: 'Erika Muster' } })
    expect(liesGeraeteNachricht({ art: 'lebenszeichen', wartend: 1, namen: 'kaputt' })).toEqual({ art: 'lebenszeichen', wartend: 1 })
    expect(liesGeraeteNachricht({ art: 'lebenszeichen', wartend: 1, namen: {} })).toEqual({ art: 'lebenszeichen', wartend: 1, namen: {} })
    const viele = Object.fromEntries(Array.from({ length: 20 }, (_, i) => [`l${i}`, `N${i}`]))
    expect(Object.keys((liesGeraeteNachricht({ art: 'lebenszeichen', wartend: 0, namen: viele }) as { namen: object }).namen)).toHaveLength(8)
  })
})
