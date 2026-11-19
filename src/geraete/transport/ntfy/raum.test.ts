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
import { OEFFENTLICH, ZUSCHAUER } from '../protokoll'
import { NTFY_VORGABE } from '../../themen'

const SERVER = 'https://ntfy.test'

describe('Raum des Hosts', () => {
  it('wird vollständig angelegt, mit der öffentlichen Gruppe', () => {
    const raum = neuerRaum(`${SERVER}/`)
    expect(istHostRaum(raum)).toBe(true)
    expect(raum.server).toBe(SERVER)
    expect(raum.gruppen[OEFFENTLICH]).toMatchObject({ e: 1, n: 0 })
    expect(raum.gruppen[ZUSCHAUER]).toMatchObject({ e: 1, n: 0 })
    expect(raum.gruppen[ZUSCHAUER].k).not.toBe(raum.gruppen[OEFFENTLICH].k)
    expect(raum.oeffentlich.a).not.toBe(raum.oeffentlich.z)
    expect(istHostRaum(JSON.parse(JSON.stringify(raum)))).toBe(true)
    expect(() => neuerRaum('ftp://x')).toThrow()
    // Der Server kommt immer von außen – auch die Vorgabe.
    expect(neuerRaum(NTFY_VORGABE).server).toBe(NTFY_VORGABE)
  })

  it('erkennt Kaputtes', () => {
    const raum = neuerRaum(SERVER)
    expect(istHostRaum({ ...raum, gruppen: {} })).toBe(false)
    expect(istHostRaum({ ...raum, gruppen: { [OEFFENTLICH]: raum.gruppen[OEFFENTLICH] } })).toBe(false)
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
    expect(themenDerGruppe(raum, OEFFENTLICH)).toEqual([raum.oeffentlich.a])
    expect(themenDerGruppe(raum, ZUSCHAUER)).toEqual([raum.oeffentlich.z])
    mitGruppe(raum, 'steg')
    const alle = [raum.oeffentlich.a, raum.oeffentlich.z, geraeteThemaVon(raum), direktThemaVon(raum, 'geraet-a'), ...themenDerGruppe(raum, 'steg')]
    expect(new Set(alle).size).toBe(5)
  })

  it('der öffentlichen Gruppe nie einen neuen Schlüssel (K14), den übrigen schon', () => {
    const raum = neuerRaum(SERVER)
    const ko = { ...raum.gruppen[OEFFENTLICH] }
    const kz = { ...raum.gruppen[ZUSCHAUER] }
    expect(mitNeuemSchluessel(raum, OEFFENTLICH)).toBe(false)
    expect(mitNeuemSchluessel(raum, ZUSCHAUER)).toBe(false)
    expect(raum.gruppen[OEFFENTLICH]).toEqual(ko)
    expect(raum.gruppen[ZUSCHAUER]).toEqual(kz)
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
  it('trägt nur sein Thema, den Schlüssel seiner Gruppe und den Signaturschlüssel des Hosts', () => {
    const raum = neuerRaum(SERVER)
    const tafel = lesePaket(raum, 'a')
    const zuschauer = lesePaket(raum, 'z')
    expect(Object.keys(tafel).sort()).toEqual(['e', 'g', 'k', 'r', 's', 't', 'u'])
    expect(tafel).toMatchObject({ t: raum.oeffentlich.a, g: OEFFENTLICH, k: raum.gruppen.ko.k })
    expect(zuschauer).toMatchObject({ t: raum.oeffentlich.z, g: ZUSCHAUER, k: raum.gruppen.kz.k })
    // Nie g, nie das Geheimnis, nie das andere öffentliche Thema oder dessen Schlüssel, keine geheimen Schlüssel.
    for (const [paket, anderes] of [[tafel, 'z'], [zuschauer, 'a']] as const) {
      const text = JSON.stringify(paket)
      const fremd = raum.gruppen[anderes === 'z' ? ZUSCHAUER : OEFFENTLICH].k
      for (const geheim of [geraeteThemaVon(raum), raum.geheimnis, raum.oeffentlich[anderes], fremd, raum.box.sk, raum.sign.sk]) {
        expect(text).not.toContain(geheim)
      }
      expect(liesLesePaket(JSON.parse(text))).toEqual(paket)
    }
  })

  it('weist ein unvollständiges Paket ab', () => {
    const paket = lesePaket(neuerRaum(SERVER), 'z')
    expect(liesLesePaket({ ...paket, s: 'kurz' })).toBeNull()
    expect(liesLesePaket({ ...paket, u: 'ftp://x' })).toBeNull()
    expect(liesLesePaket({ ...paket, t: 'a/b' })).toBeNull()
    expect(liesLesePaket({ ...paket, g: 'steg' })).toBeNull()
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
