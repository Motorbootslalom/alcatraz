import { describe, expect, it } from 'vitest'
import { istGruppe, OEFFENTLICH, ZUSCHAUER } from './transport/protokoll'
import { gruppeDerListe, gruppenFuer } from './wkrGruppen'
import { listenKennung } from '../wkr/liste'
import { RACECOURSES } from '../lib/parallelSchluessel'

// Gruppen der WKR-Listen (W1): Form passt zum Protokoll, stabil, keine Kollision in einer großen Veranstaltung.

const K = (bereich: string, typeId: string, racecourse: 'A' | 'B' | null = null) => listenKennung({ bereich, typeId, racecourse })

describe('gruppeDerListe', () => {
  it('Form: l + 8 Hexziffern, eine gültige Gruppe, nie öffentlich', () => {
    const g = gruppeDerListe(K('par_1', 'steg'))
    expect(g).toMatch(/^l[0-9a-f]{8}$/)
    expect(istGruppe(g)).toBe(true)
    expect([OEFFENTLICH, ZUSCHAUER]).not.toContain(g)
    expect(istGruppe(gruppeDerListe(''))).toBe(true)
  })

  it('stabil: gleiche Kennung → gleiche Gruppe, auf jedem Gerät (fester Wert)', () => {
    expect(gruppeDerListe(K('par_1', 'steg'))).toBe(gruppeDerListe(K('par_1', 'steg')))
    // FNV-1a 32 Bit von "a" = e40c292c – so bilden Host und Gerät denselben Namen ohne Absprache.
    expect(gruppeDerListe('a')).toBe('le40c292c')
    expect(gruppeDerListe(K('par_1', 'steg'))).not.toBe(gruppeDerListe(K('par_2', 'steg')))
  })

  it('keine Kollision in einer großen Veranstaltung (20 Parcours × 30 Listen + Parallelslalom)', () => {
    const kennungen: string[] = []
    for (let p = 1; p <= 20; p++) for (let l = 1; l <= 30; l++) kennungen.push(K(`par_${p}`, `liste${l}`))
    for (const typeId of ['steg', 'vorsteg', 'gate135', 'gate245', 'tor5', 'mueb', 'parcours', 'zeit']) {
      for (let p = 1; p <= 20; p++) kennungen.push(K(`par_${p}`, typeId))
      for (const rc of RACECOURSES) kennungen.push(K('parallel', typeId, rc))
    }
    const gruppen = new Set(kennungen.map(gruppeDerListe))
    expect(gruppen.size).toBe(new Set(kennungen).size)
  })
})

describe('gruppenFuer', () => {
  it('die öffentliche Gruppe und je Liste deren Gruppe; die Start-Freigabe bringt keine dazu', () => {
    const a = K('par_1', 'steg')
    const b = K('par_1', 'gate135')
    expect(gruppenFuer([{ art: 'startfreigabe', bereiche: ['par_1'] }])).toEqual([OEFFENTLICH])
    expect(gruppenFuer([{ art: 'liste', liste: a, teil: 'ab' }, { art: 'startfreigabe', bereiche: ['par_1'] }, { art: 'liste', liste: b }])).toEqual([OEFFENTLICH, gruppeDerListe(a), gruppeDerListe(b)])
    expect(gruppenFuer([])).toEqual([OEFFENTLICH])
  })
})
