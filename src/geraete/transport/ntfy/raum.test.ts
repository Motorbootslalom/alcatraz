import { describe, expect, it } from 'vitest'
import {
  fingerabdruck,
  geraeteThemaVon,
  hostOeffentlich,
  hostSpeicherImSpeicher,
  istGeraetStand,
  istHostRaum,
  leererGeraetStand,
  lesePaket,
  liesHostOeffentlich,
  liesLesePaket,
  mitGruppe,
  mitNeuemSchluessel,
  neuerRaum,
  themenDerGruppe,
  direktThemaVon,
} from './raum'
import { OEFFENTLICH } from '../protokoll'
import { NTFY_VORGABE } from '../../themen'

const SERVER = 'https://ntfy.test'

describe('Raum des Hosts', () => {
  it('wird vollständig angelegt, mit der öffentlichen Gruppe', () => {
    const raum = neuerRaum(`${SERVER}/`)
    expect(istHostRaum(raum)).toBe(true)
    expect(raum.server).toBe(SERVER)
    expect(raum.gruppen[OEFFENTLICH]).toMatchObject({ e: 1, n: 0 })
    expect(raum.oeffentlich.a).not.toBe(raum.oeffentlich.z)
    expect(istHostRaum(JSON.parse(JSON.stringify(raum)))).toBe(true)
    expect(() => neuerRaum('ftp://x')).toThrow()
    // Der Server kommt immer von außen – auch die Vorgabe.
    expect(neuerRaum(NTFY_VORGABE).server).toBe(NTFY_VORGABE)
  })

  it('erkennt Kaputtes', () => {
    const raum = neuerRaum(SERVER)
    expect(istHostRaum({ ...raum, gruppen: {} })).toBe(false)
    expect(istHostRaum({ ...raum, sign: { pk: raum.sign.pk, sk: 'kurz' } })).toBe(false)
    expect(istHostRaum({ ...raum, geraete: { a: { pk: raum.box.pk, letzteNr: -1, gruppen: [] } } })).toBe(false)
    expect(istHostRaum({ ...raum, ausstehend: [{ id: 'geraet-a', pk: raum.box.pk, art: 'schluessel' }] })).toBe(true)
    expect(istHostRaum({ ...raum, ausstehend: [{ id: 'geraet-a', pk: 'kurz', art: 'schluessel' }] })).toBe(false)
    expect(istHostRaum({ ...raum, ausstehend: [{ id: 'geraet-a', pk: raum.box.pk, art: 'irgendwas' }] })).toBe(false)
    expect(istHostRaum({ ...raum, ausstehend: undefined })).toBe(false)
    expect(istHostRaum(null)).toBe(false)
  })

  it('öffentliche Themen sind zufällig, die übrigen abgeleitet und verschieden', () => {
    const raum = neuerRaum(SERVER)
    expect(themenDerGruppe(raum, OEFFENTLICH)).toEqual([raum.oeffentlich.a, raum.oeffentlich.z])
    mitGruppe(raum, 'steg')
    const alle = [raum.oeffentlich.a, raum.oeffentlich.z, geraeteThemaVon(raum), direktThemaVon(raum, 'geraet-a'), ...themenDerGruppe(raum, 'steg')]
    expect(new Set(alle).size).toBe(5)
  })

  it('der öffentlichen Gruppe nie einen neuen Schlüssel (K14), den übrigen schon', () => {
    const raum = neuerRaum(SERVER)
    const ko = { ...raum.gruppen[OEFFENTLICH] }
    expect(mitNeuemSchluessel(raum, OEFFENTLICH)).toBe(false)
    expect(raum.gruppen[OEFFENTLICH]).toEqual(ko)
    expect(mitGruppe(raum, 'steg')).toBe(true)
    expect(mitGruppe(raum, 'steg')).toBe(false)
    expect(mitGruppe(raum, 'Steg|x')).toBe(false)
    const alt = { ...raum.gruppen.steg }
    expect(mitNeuemSchluessel(raum, 'steg')).toBe(true)
    expect(raum.gruppen.steg.e).toBe(alt.e + 1)
    expect(raum.gruppen.steg.k).not.toBe(alt.k)
  })
})

describe('Lese-Link (K13)', () => {
  it('trägt nur sein Thema, den öffentlichen Schlüssel und den Signaturschlüssel des Hosts', () => {
    const raum = neuerRaum(SERVER)
    const tafel = lesePaket(raum, 'a')
    const zuschauer = lesePaket(raum, 'z')
    expect(Object.keys(tafel).sort()).toEqual(['e', 'k', 'r', 's', 't', 'u'])
    expect(tafel.t).toBe(raum.oeffentlich.a)
    expect(zuschauer.t).toBe(raum.oeffentlich.z)
    const text = JSON.stringify(tafel)
    // Nie g, nie das Geheimnis, nie das andere öffentliche Thema, keine geheimen Schlüssel.
    for (const geheim of [geraeteThemaVon(raum), raum.geheimnis, raum.oeffentlich.z, raum.box.sk, raum.sign.sk]) {
      expect(text).not.toContain(geheim)
    }
    expect(liesLesePaket(JSON.parse(text))).toEqual(tafel)
  })

  it('weist ein unvollständiges Paket ab', () => {
    const paket = lesePaket(neuerRaum(SERVER), 'z')
    expect(liesLesePaket({ ...paket, s: 'kurz' })).toBeNull()
    expect(liesLesePaket({ ...paket, u: 'ftp://x' })).toBeNull()
    expect(liesLesePaket({ ...paket, t: 'a/b' })).toBeNull()
    expect(liesLesePaket('Unsinn')).toBeNull()
  })

  it('öffentliche Schlüssel des Hosts in einem Stück, mit kurzem Fingerabdruck', () => {
    const raum = neuerRaum(SERVER)
    const beide = liesHostOeffentlich(hostOeffentlich(raum))!
    expect(beide.box).toHaveLength(32)
    expect(beide.sign).toHaveLength(32)
    expect(liesHostOeffentlich('kurz')).toBeNull()
    expect(fingerabdruck(raum.sign.pk)).toHaveLength(8)
  })
})

describe('Speicher', () => {
  it('ändert den frisch gelesenen Raum, ohne Referenz nach draußen', () => {
    const speicher = hostSpeicherImSpeicher(neuerRaum(SERVER))
    const gelesen = speicher.lies()!
    gelesen.uhr = 99
    expect(speicher.lies()!.uhr).toBe(0)
    speicher.aendere((r) => {
      r.uhr += 1
    })
    speicher.aendere((r) => {
      r.uhr += 1
    })
    expect(speicher.lies()!.uhr).toBe(2)
    expect(hostSpeicherImSpeicher().aendere(() => {})).toBeNull()
  })

  it('Stand eines Geräts: leer gültig, Kaputtes nicht', () => {
    expect(istGeraetStand(leererGeraetStand())).toBe(true)
    expect(istGeraetStand({ ...leererGeraetStand(), naechsteNr: 0 })).toBe(false)
    expect(istGeraetStand({ ...leererGeraetStand(), seen: { 'Böse|': 1 } })).toBe(false)
  })
})
