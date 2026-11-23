import { describe, expect, it } from 'vitest'
import { naechsterOffener, tischOffen, type TischEintrag } from './tisch'

// KN9 (Nutzer 22.11.2026, R8-27): Vorschlag „nächster offener nach dem zuletzt abgeschickten“ in Folge des Bestands.
const bestand = (n: number, erledigt: number[] = [], geschickt: number[] = []): TischEintrag[] =>
  Array.from({ length: n }, (_, i) => ({
    key: `k${i + 1}`,
    erledigt: erledigt.includes(i + 1),
    ...(geschickt.includes(i + 1) ? { z: 100 + i } : {}),
  }))

describe('naechsterOffener (KN9)', () => {
  it('Beispiel des Nutzers: 8 fertig → 9; 10 getippt → 11; dann 9 → 11 (10 war schon)', () => {
    const fertig = [1, 2, 3, 4, 5, 6, 7]
    expect(naechsterOffener(bestand(20, fertig, [8]), 'k8')?.key).toBe('k9')
    expect(naechsterOffener(bestand(20, fertig, [8, 10]), 'k10')?.key).toBe('k11')
    expect(naechsterOffener(bestand(20, fertig, [8, 9, 10]), 'k9')?.key).toBe('k11')
  })

  it('Rundlauf: hinter dem letzten keiner offen → von vorn; ohne „zuletzt“ der erste offene', () => {
    expect(naechsterOffener(bestand(5, [], [5]), 'k5')?.key).toBe('k1')
    expect(naechsterOffener(bestand(5, [1, 2], [4, 5]), 'k4')?.key).toBe('k3')
    expect(naechsterOffener(bestand(5, [1]))?.key).toBe('k2')
    expect(naechsterOffener(bestand(5, [1]), null)?.key).toBe('k2')
    // Unbekanntes „zuletzt“ (Starter abgemeldet) → der erste offene.
    expect(naechsterOffener(bestand(5, [1]), 'weg')?.key).toBe('k2')
  })

  it('nichts offen → null; leerer Bestand → null', () => {
    expect(naechsterOffener(bestand(3, [1, 2], [3]), 'k3')).toBeNull()
    expect(naechsterOffener([], 'k1')).toBeNull()
  })

  it('selbst geschickt zählt als erledigt, auch wenn die Sicht (Quittung) noch nachläuft', () => {
    const b = bestand(4, [], [2])
    expect(tischOffen(b[1])).toBe(false)
    expect(naechsterOffener(b, 'k1')?.key).toBe('k3')
  })

  it('Übung „Klasse vorziehen“ (Y4): der erste offene dieser Klasse; ohne offenen die Regel ohne Klasse', () => {
    const b = bestand(6, [4], []).map((x, i) => ({ ...x, klasse: i < 3 ? 'a' : 'b' }))
    expect(naechsterOffener(b, 'k1', 'b')?.key).toBe('k5')
    expect(naechsterOffener(b, 'k1', 'c')?.key).toBe('k2')
    expect(naechsterOffener(b, 'k1', null)?.key).toBe('k2')
  })
})
