import { describe, expect, it } from 'vitest'
import nacl from 'tweetnacl'
import {
  direktThema,
  geraeteThema,
  gruppenThema,
  istThema,
  koppelThema,
  normalisiereServer,
  NTFY_VORGABE,
  THEMA_LAENGE,
  zufallsThema,
} from './themen'

describe('Themen', () => {
  it('öffentliche sind Zufall, je 22 Zeichen', () => {
    const a = zufallsThema()
    const b = zufallsThema()
    expect(a).not.toBe(b)
    expect(a).toHaveLength(THEMA_LAENGE)
    expect(istThema(a)).toBe(true)
  })

  it('abgeleitete hängen am Geheimnis und am Kennzeichen, und nur daran', () => {
    const geheimnis = nacl.randomBytes(32)
    expect(geraeteThema(geheimnis)).toBe(geraeteThema(geheimnis.slice()))
    expect(geraeteThema(geheimnis)).not.toBe(geraeteThema(nacl.randomBytes(32)))
    const alle = [
      geraeteThema(geheimnis),
      direktThema(geheimnis, 'geraet-a'),
      direktThema(geheimnis, 'geraet-b'),
      gruppenThema(geheimnis, 'steg'),
      // Die Teile sind getrennt: 'd' + 'g' ist nicht 'g' allein, 'k' + 'g' auch nicht.
      direktThema(geheimnis, 'g'),
      gruppenThema(geheimnis, 'g'),
    ]
    expect(new Set(alle).size).toBe(alle.length)
    for (const t of alle) {
      expect(t).toHaveLength(THEMA_LAENGE)
      expect(istThema(t)).toBe(true)
    }
  })

  it('das Koppel-Thema hängt am Tafel-Thema und am Code', () => {
    const oA = zufallsThema()
    expect(koppelThema(oA, 'ABC234')).toBe(koppelThema(oA, 'ABC234'))
    expect(koppelThema(oA, 'ABC234')).not.toBe(koppelThema(oA, 'ABC235'))
    expect(koppelThema(oA, 'ABC234')).not.toBe(koppelThema(zufallsThema(), 'ABC234'))
  })

  it('weist ab, was ntfy nicht nähme', () => {
    expect(istThema('kurz')).toBe(false)
    expect(istThema('mit/schraegstrich1234567')).toBe(false)
    expect(istThema(42)).toBe(false)
  })
})

describe('Server', () => {
  it('Vorgabe laut Entscheidung vom 11.11.2026, als gültige Adresse', () => {
    expect(NTFY_VORGABE).toBe('https://ntfy.adminforge.de')
    expect(normalisiereServer(NTFY_VORGABE)).toBe(NTFY_VORGABE)
  })

  it('wird vereinheitlicht', () => {
    expect(normalisiereServer(' ntfy.example.org/ ')).toBe('https://ntfy.example.org')
    expect(normalisiereServer('http://192.168.1.2:8080')).toBe('http://192.168.1.2:8080')
    expect(normalisiereServer('https://ntfy.example.org/unter/')).toBe('https://ntfy.example.org/unter')
  })

  it('weist Unbrauchbares ab', () => {
    expect(normalisiereServer('')).toBeNull()
    expect(normalisiereServer('ftp://ntfy.example.org')).toBeNull()
    expect(normalisiereServer('https://ntfy.example.org/?x=1')).toBeNull()
    expect(normalisiereServer('https://nutzer:geheim@ntfy.example.org')).toBeNull()
  })
})
