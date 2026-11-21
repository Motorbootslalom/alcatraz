import { describe, expect, it } from 'vitest'
import nacl from 'tweetnacl'
import { fromBase64Url, textHash, toBase64Url } from './codec'
import {
  belegteFassung,
  openDirekt,
  openGruppe,
  openVomGeraet,
  parseGeraetWire,
  parseHostWire,
  sealAnkuendigung,
  sealDirekt,
  sealGruppe,
  sealVomGeraet,
  verifyHostWire,
  type HostKopf,
  type HostWire,
} from './wire'
import { DIREKT, PROTOKOLL_FASSUNG, type GeraeteKlartext } from '../protokoll'

const host = { box: nacl.box.keyPair(), sign: nacl.sign.keyPair() }
const gruppenKey = nacl.randomBytes(32)
const THEMA = 'oeffentlichesThema1234'
const kopf: HostKopf = { v: PROTOKOLL_FASSUNG, r: 'raum1234', g: 'ko', e: 3, n: 7, a: 'v', sv: 4, hz: 1_000_000 }
const sicht = { bereiche: [{ id: 'par_1', name: 'Parcours 1' }] }

describe('an eine Gruppe', () => {
  it('liest nur, wer den Gruppenschlüssel hat, und die Signatur stimmt', async () => {
    const wire = parseHostWire(await sealGruppe({ voll: sicht }, kopf, THEMA, gruppenKey, host.sign.secretKey))!
    expect(wire).toMatchObject({ v: PROTOKOLL_FASSUNG, r: 'raum1234', g: 'ko', e: 3, n: 7, a: 'v', sv: 4, hz: 1_000_000 })
    expect(verifyHostWire(wire, THEMA, host.sign.publicKey)).toBe(true)
    expect(await openGruppe(wire, gruppenKey)).toEqual({ voll: sicht })
    expect(await openGruppe(wire, nacl.randomBytes(32))).toBeNull()
  })

  it('verwirft, was ein anderer signiert hat – auch mit dem richtigen Gruppenschlüssel', async () => {
    // Jeder mit einem Lese-Link kennt den öffentlichen Gruppenschlüssel, aber nicht den des Hosts.
    const faelscher = nacl.sign.keyPair()
    const wire = parseHostWire(await sealGruppe({ voll: sicht }, kopf, THEMA, gruppenKey, faelscher.secretKey))!
    expect(verifyHostWire(wire, THEMA, host.sign.publicKey)).toBe(false)
  })

  it('signiert den ganzen Kopf: Thema, Raum, Gruppe, Epoche, Nummer, Art, Fassungen, Sendezeit', async () => {
    const wire = parseHostWire(await sealGruppe({ voll: sicht }, kopf, THEMA, gruppenKey, host.sign.secretKey))!
    const anders: Partial<HostWire>[] = [{ r: 'raum9999' }, { g: 'steg' }, { e: 4 }, { n: 8 }, { a: 'p' }, { sv: 5 }, { hz: 1 }]
    for (const aenderung of anders) expect(verifyHostWire({ ...wire, ...aenderung }, THEMA, host.sign.publicKey)).toBe(false)
    // Auf ein anderes Thema (etwa vom Tafel- auf den Zuschauer-Link) passt sie nicht.
    expect(verifyHostWire(wire, 'anderesThema123456789', host.sign.publicKey)).toBe(false)
    const bytes = fromBase64Url(wire.c!)!
    bytes[0] ^= 1
    expect(verifyHostWire({ ...wire, c: toBase64Url(bytes) }, THEMA, host.sign.publicKey)).toBe(false)
  })

  it('der Inhalt muss zur signierten Art passen', async () => {
    const alsDifferenz = parseHostWire(await sealGruppe({ voll: sicht }, { ...kopf, a: 'p' }, THEMA, gruppenKey, host.sign.secretKey))!
    expect(await openGruppe(alsDifferenz, gruppenKey)).toBeNull()
  })
})

describe('an ein Gerät', () => {
  const direktKopf: HostKopf = { ...kopf, g: DIREKT, e: 0, a: 'd' }

  it('öffnet nur das Gerät, an das es ging', async () => {
    const geraet = nacl.box.keyPair()
    const anderes = nacl.box.keyPair()
    const nachricht = { art: 'quittung' as const, auf: 3, ergebnis: 'angewandt' as const }
    const wire = parseHostWire(await sealDirekt(nachricht, direktKopf, THEMA, geraet.publicKey, host.box.secretKey, host.sign.secretKey))!
    expect(verifyHostWire(wire, THEMA, host.sign.publicKey)).toBe(true)
    expect(await openDirekt(wire, host.box.publicKey, geraet.secretKey)).toEqual(nachricht)
    expect(await openDirekt(wire, host.box.publicKey, anderes.secretKey)).toBeNull()
    // Kein `to` im Klartext: Wem sie gilt, steht nur im Thema (abgeleitet) und in der box.
    expect(Object.keys(JSON.parse(await sealDirekt(nachricht, direktKopf, THEMA, geraet.publicKey, host.box.secretKey, host.sign.secretKey)))).not.toContain('to')
  })

  it('geht nicht auf, wenn es nicht vom Host stammt', async () => {
    const geraet = nacl.box.keyPair()
    const fremd = nacl.box.keyPair()
    const wire = parseHostWire(await sealDirekt({ art: 'entzogen' }, direktKopf, THEMA, geraet.publicKey, fremd.secretKey, host.sign.secretKey))!
    expect(await openDirekt(wire, host.box.publicKey, geraet.secretKey)).toBeNull()
  })
})

describe('Ankündigung eines Anhangs (S5)', () => {
  it('trägt Adresse, Länge und Prüfsumme, signiert, ohne Inhalt', async () => {
    const gross = await sealGruppe({ voll: sicht }, kopf, THEMA, gruppenKey, host.sign.secretKey)
    const anhang = { u: 'https://ntfy.test/file/m1.txt', b: gross.length, h: textHash(gross) }
    const wire = parseHostWire(sealAnkuendigung(kopf, THEMA, anhang, host.sign.secretKey))!
    expect(wire.l).toEqual(anhang)
    expect(wire.c).toBeUndefined()
    expect(verifyHostWire(wire, THEMA, host.sign.publicKey)).toBe(true)
    // Eine andere Prüfsumme oder Adresse untergeschoben: Die Signatur passt nicht mehr.
    expect(verifyHostWire({ ...wire, l: { ...anhang, h: textHash('anders') } }, THEMA, host.sign.publicKey)).toBe(false)
    expect(verifyHostWire({ ...wire, l: { ...anhang, u: 'https://boese.example/file/x.txt' } }, THEMA, host.sign.publicKey)).toBe(false)
    expect(await openGruppe(wire, gruppenKey)).toBeNull()
  })
})

describe('vom Gerät an den Host', () => {
  it('liest nur der Host, und der Schlüssel des Absenders ist belegt', async () => {
    const geraet = nacl.box.keyPair()
    const klartext: GeraeteKlartext = { id: 'geraet-a', nr: 1, nachricht: { art: 'hallo', name: 'Steg Muster', code: 'ABC123' } }
    const wire = parseGeraetWire(await sealVomGeraet(klartext, geraet, host.box.publicKey))!
    expect(wire.pk).toBe(toBase64Url(geraet.publicKey))
    expect(await openVomGeraet(wire, host.box.secretKey)).toEqual(klartext)
    expect(await openVomGeraet(wire, nacl.box.keyPair().secretKey)).toBeNull()
    // Wer den Schlüssel eines anderen Geräts davorschreibt, bekommt es nicht auf.
    expect(await openVomGeraet({ ...wire, pk: toBase64Url(nacl.box.keyPair().publicKey) }, host.box.secretKey)).toBeNull()
    // Geräte-ID und Nummer stehen nicht im Klartext.
    expect(Object.keys(wire).sort()).toEqual(['c', 'pk', 'v', 'x'])
  })

  it('die Zeit einer Action stempelt der Host – vom Gerät fällt sie weg', async () => {
    const geraet = nacl.box.keyPair()
    const action = { type: 'BETRIEB_ZEIGEN', bereich: 'par_1', ref: 'x', vorher: null, zeit: 5 }
    const wire = parseGeraetWire(await sealVomGeraet({ id: 'geraet-a', nr: 2, nachricht: { art: 'action', action } }, geraet, host.box.publicKey))!
    const klar = await openVomGeraet(wire, host.box.secretKey)
    expect(klar?.nachricht).toEqual({ art: 'action', action: { type: 'BETRIEB_ZEIGEN', bereich: 'par_1', ref: 'x', vorher: null } })
  })
})

describe('Einlesen', () => {
  it('weist Unsinn und fremde Fassungen ab', async () => {
    expect(parseHostWire('kein json')).toBeNull()
    expect(parseHostWire('[]')).toBeNull()
    const echt = JSON.parse(await sealGruppe({ voll: sicht }, kopf, THEMA, gruppenKey, host.sign.secretKey)) as HostWire
    expect(parseHostWire(JSON.stringify({ ...echt, v: PROTOKOLL_FASSUNG + 1 }))).toBeNull()
    expect(parseGeraetWire(JSON.stringify({ v: PROTOKOLL_FASSUNG, pk: 'kurz', x: 'x', c: 'y' }))).toBeNull()
  })

  it('W1: Fassung 2 – Nachrichten der Fassung 1 versteht keine Seite (F11: neue Arten, Werte auf g)', async () => {
    expect(PROTOKOLL_FASSUNG).toBe(2)
    // Host der Fassung 1 → Gerät der Fassung 2: nicht lesbar, aber mit Beleg als „Fassung“ erkannt.
    const alt = await sealGruppe({ voll: sicht }, { ...kopf, v: 1 }, THEMA, gruppenKey, host.sign.secretKey)
    expect(parseHostWire(alt)).toBeNull()
    expect(belegteFassung(alt, THEMA, host.sign.publicKey)?.v).toBe(1)
    // Gerät der Fassung 1 → Host der Fassung 2: verworfen.
    const geraet = nacl.box.keyPair()
    const neu = JSON.parse(await sealVomGeraet({ id: 'geraet-a', nr: 1, nachricht: { art: 'lebenszeichen', wartend: 1 } }, geraet, host.box.publicKey)) as Record<string, unknown>
    expect(parseGeraetWire(JSON.stringify(neu))).not.toBeNull()
    expect(parseGeraetWire(JSON.stringify({ ...neu, v: 1 }))).toBeNull()
  })

  it('eine fremde Fassung zählt nur mit dem Beleg des Hosts – für jede Fassung gleich geprüft', async () => {
    // Ein Host einer späteren Fassung: Sein Format kann das Gerät nicht lesen, den Beleg schon.
    const spaeter = await sealGruppe({ voll: sicht }, { ...kopf, v: PROTOKOLL_FASSUNG + 1, sv: 5 }, THEMA, gruppenKey, host.sign.secretKey)
    expect(parseHostWire(spaeter)).toBeNull()
    expect(belegteFassung(spaeter, THEMA, host.sign.publicKey)).toEqual({ v: PROTOKOLL_FASSUNG + 1, r: 'raum1234', sv: 5, hz: 1_000_000 })
    // Ohne oder mit falschem Beleg, auf einem anderen Thema, mit geänderter Angabe: nichts.
    const w = JSON.parse(spaeter) as Record<string, unknown>
    expect(belegteFassung(JSON.stringify({ v: 99, sv: 99 }), THEMA, host.sign.publicKey)).toBeNull()
    expect(belegteFassung(JSON.stringify({ ...w, fs: undefined }), THEMA, host.sign.publicKey)).toBeNull()
    expect(belegteFassung(spaeter, 'anderesThema123456789', host.sign.publicKey)).toBeNull()
    expect(belegteFassung(JSON.stringify({ ...w, v: PROTOKOLL_FASSUNG + 2 }), THEMA, host.sign.publicKey)).toBeNull()
    expect(belegteFassung(spaeter, THEMA, nacl.sign.keyPair().publicKey)).toBeNull()
    // Auch Ankündigungen und Nachrichten an ein Gerät tragen ihn.
    const ankuendigung = sealAnkuendigung(kopf, THEMA, { u: 'https://ntfy.test/file/m1.txt', b: 1, h: textHash('x') }, host.sign.secretKey)
    expect(belegteFassung(ankuendigung, THEMA, host.sign.publicKey)?.v).toBe(PROTOKOLL_FASSUNG)
  })

  it('verlangt eine Signatur, und direkt nur ohne Gruppe', async () => {
    const echt = JSON.parse(await sealGruppe({ voll: sicht }, kopf, THEMA, gruppenKey, host.sign.secretKey)) as HostWire
    const ohne: Partial<HostWire> = { ...echt }
    delete ohne.s
    expect(parseHostWire(JSON.stringify(ohne))).toBeNull()
    expect(parseHostWire(JSON.stringify({ ...echt, a: 'd' }))).toBeNull()
    expect(parseHostWire(JSON.stringify({ ...echt, g: DIREKT }))).toBeNull()
    expect(parseHostWire(JSON.stringify({ ...echt, g: 'Gruppe|x' }))).toBeNull()
    // Ankündigung und Inhalt zugleich passt nicht.
    expect(parseHostWire(JSON.stringify({ ...echt, l: { u: 'https://ntfy.test/file/m1.txt', b: 1, h: textHash('x') } }))).toBeNull()
  })
})
