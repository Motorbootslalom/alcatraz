import { describe, expect, it } from 'vitest'
import { fromVerzahnungPrototyp, migrate } from './migrate'
import { emptyState } from './reducer'
import { SCHEMA_VERSION } from '../types'

describe('migrate', () => {
  it('lehnt Unbrauchbares ab', () => {
    expect(migrate(null)).toBeNull()
    expect(migrate('x')).toBeNull()
    expect(migrate({ starters: 'nein' })).toBeNull()
  })

  it('lehnt Stände einer neueren Fassung ab, statt sie zu verstümmeln', () => {
    expect(migrate({ ...emptyState(), schemaVersion: SCHEMA_VERSION + 1 })).toBeNull()
  })

  it('füllt fehlende Felder mit Vorgaben auf', () => {
    const state = migrate({ starters: [{ id: 'a', klasse: '1', nachname: 'A' }], eventName: 'Pokal' })
    expect(state).not.toBeNull()
    expect(state!.eventName).toBe('Pokal')
    expect(state!.laufCount).toBe(3)
    expect(state!.starters[0]).toMatchObject({ id: 'a', klasse: '1', nachname: 'A', vorname: '', groesse: '' })
    expect(state!.boats).toEqual({ klein: 2, gross: 2 })
  })

  it('übernimmt einen Stand des Verzahnungs-Prototyps', () => {
    const state = fromVerzahnungPrototyp({
      eventName: 'Möwepokal',
      eventJahr: 2026,
      originMode: 'bundesland',
      initialized: true,
      participants: [{ id: 'p1', startNr: 'E01', vorname: 'A', nachname: 'B', verein: '', bundesland: 'Berlin', geburtsdatum: '2019-01-01', klasse: 'E' }],
      parcoursList: [{ id: 'x', name: 'Parcours 1', classIds: ['E'], wechselFaktor: 1 }],
      boats: { klein: 3, gross: 1 },
    })
    expect(state).not.toBeNull()
    expect(state!.starters).toHaveLength(1)
    expect(state!.starters[0].groesse).toBe('')
    expect(state!.originMode).toBe('bundesland')
    expect(state!.boats).toEqual({ klein: 3, gross: 1 })
    expect(state).not.toHaveProperty('participants')
    expect(state).not.toHaveProperty('initialized')
  })

  it('behält von gespeicherten Standardgewichten nur, was vom Regelwerk abweicht', () => {
    const state = migrate({ starters: [], regelwerk: 'dm-2026', sollgewicht: { E: 26, '1': 33, '2': 45 } })
    expect(state!.sollgewicht).toEqual({ '2': 45 })
  })

  it('erkennt fremde Daten nicht als Prototyp-Stand', () => {
    expect(fromVerzahnungPrototyp({ starters: [] })).toBeNull()
  })
})

describe('migrate: Einstellungen der Wettkampfrichter-Listen', () => {
  it('fehlen in älteren Ständen und bekommen die Vorgaben', () => {
    expect(migrate({ starters: [] })).toMatchObject({ wkrLeerzeilen: 3, wkrLeerzeilenKlasse: {}, wkrRueckseite: false })
  })

  it('Unbrauchbares entfällt, Brauchbares bleibt', () => {
    const state = migrate({
      starters: [],
      wkrLeerzeilen: 4,
      wkrLeerzeilenKlasse: { '7': 6, '1': 4, X: 2, '2': 'viele', '3': 99 },
      wkrRueckseite: true,
    })
    expect(state).toMatchObject({ wkrLeerzeilen: 4, wkrLeerzeilenKlasse: { '7': 6, '3': 30 }, wkrRueckseite: true })
    expect(migrate({ starters: [], wkrLeerzeilen: 'drei', wkrLeerzeilenKlasse: [1] })).toMatchObject({ wkrLeerzeilen: 3, wkrLeerzeilenKlasse: {} })
  })
})

