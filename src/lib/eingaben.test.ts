import { describe, expect, it } from 'vitest'
import { configFor } from '../config/konfig'
import type { ClassId, Eingaben, Starter } from '../types'
import {
  erfasstKennung,
  ganzerHaken,
  istHaken,
  teilHaken,
  gueltigeZellen,
  starterMitEingaben,
  verborgeneEinzelheiten,
  verborgeneZellen,
  feldVon,
  felderJeKennung,
  laufSchluessel,
  listenFelder,
  listenLauf,
  normalisiereEingaben,
  nurStarter,
  OHNE_LAUF,
  setzeWerte,
  vergleicheNr,
  werteVon,
  zerlegeLauf,
} from './eingaben'

const konfig = configFor()
const L1 = laufSchluessel('manoevrieren', 1)

describe('Lauf-Schlüssel', () => {
  it('nennt Disziplin und Lauf; die Klasse folgt aus dem Starter', () => {
    expect(L1).toBe('manoevrieren/1')
    expect(zerlegeLauf('manoevrieren/3')).toEqual({ disziplin: 'manoevrieren', lauf: 3 })
  })

  it('Listen ohne Lauf (Knoten) stehen unter Lauf 0, egal welcher Bogen', () => {
    expect(listenLauf(konfig.getSheetDef('knoten'), 3)).toBe(OHNE_LAUF)
    expect(listenLauf(konfig.getSheetDef('steg'), 3)).toBe(3)
  })
})

describe('Felder', () => {
  it('eine Zelle des Bogens hat eine Kennung, die sagt, was erfasst wird', () => {
    expect(feldVon(konfig, 'gate135', '4', 't1a', 0)?.kennung).toMatch(/^t1a\|hin seite[AB]$/)
    expect(feldVon(konfig, 'steg', '4', 'fehlerAB')?.kennung).toBe('katalog:stegAblegen')
    expect(feldVon(konfig, 'zeit', '4', 'zeit2')).toMatchObject({ kennung: 'zeit2', kind: 'time' })
    // Disq. und Bemerkung gehören zu ihrer Liste.
    expect(feldVon(konfig, 'steg', '4', 'disq')?.kennung).toBe('disq@steg')
    expect(feldVon(konfig, 'vorsteg', '4', 'disq')?.kennung).toBe('disq@vorsteg')
  })

  it('Σ-Spalten und Spalten, die die Klasse nicht hat, sind keine Felder', () => {
    expect(feldVon(konfig, 'steg', '4', 'sum')).toBeUndefined()
    expect(feldVon(konfig, 'gate135', '4', 't1b', 0)).toBeUndefined() // Klasse 4 fährt zurück nicht durch Tor 1
    expect(feldVon(konfig, 'gate135', '3', 't1b', 0)).toBeDefined()
  })

  it('dasselbe Feld in jedem Aufbau: Die Bojen eines Tores stehen in Berlin auf einer anderen Liste', () => {
    const alcatraz = new Set(listenFelder(konfig, 'gate135', '5').map((f) => f.kennung))
    const berlin = new Set(['blinks', 'brechts'].flatMap((t) => listenFelder(konfig, t, '5').map((f) => f.kennung)))
    const tor1 = [...alcatraz].filter((k) => k.startsWith('t1a|'))
    expect(tor1).toHaveLength(2)
    for (const k of tor1) expect(berlin.has(k), k).toBe(true)
  })

  it('felderJeKennung: Die Listen des Aufbaus haben Vorrang – so kennt die Zeit ihr Gerät', () => {
    const dm26 = felderJeKennung(konfig, '4', konfig.aufbauOrder('alcatrazdm26', false))
    const zeiten = [...dm26.values()].filter((f) => f.kind === 'time')
    expect(zeiten.filter((f) => f.geraet === 'elektronisch')).toHaveLength(1)
    expect(zeiten.filter((f) => f.geraet === 'stoppuhr').length).toBeGreaterThanOrEqual(2)
  })

  it('gueltig: lässt nur, was auf der Liste gilt', () => {
    const ab = feldVon(konfig, 'steg', '4', 'fehlerAB')!
    expect(ab.gueltig('12 4 k 3 3')).toBe('2x3, 4, K')
    const disq = feldVon(konfig, 'vorsteg', '4', 'disq')!
    expect(disq.gueltig('x')).toBe('X')
    expect(disq.gueltig('?')).toBe('')
  })
})

describe('setzeWerte', () => {
  it('setzt Zellen, ein leerer Wert löscht; leere Zeilen und Läufe verschwinden', () => {
    const a = setzeWerte({}, [
      { lauf: L1, starter: 's1', feld: 'zeit1', wert: '83,45' },
      { lauf: L1, starter: 's1', feld: 'disq@steg', wert: 'X' },
    ])
    expect(a).toEqual({ [L1]: { s1: { zeit1: '83,45', 'disq@steg': 'X' } } })
    expect(werteVon(a, L1, 's1').zeit1).toBe('83,45')
    expect(werteVon(a, L1, 'niemand')).toEqual({})
    const b = setzeWerte(a, [{ lauf: L1, starter: 's1', feld: 'zeit1', wert: '' }])
    expect(b).toEqual({ [L1]: { s1: { 'disq@steg': 'X' } } })
    expect(setzeWerte(b, [{ lauf: L1, starter: 's1', feld: 'disq@steg', wert: '' }])).toEqual({})
  })

  it('ändert das Original nicht und gibt es unverändert zurück, wenn sich nichts ändert', () => {
    const a = setzeWerte({}, [{ lauf: L1, starter: 's1', feld: 'zeit1', wert: '83,45' }])
    const kopie = JSON.parse(JSON.stringify(a))
    expect(setzeWerte(a, [{ lauf: L1, starter: 's1', feld: 'zeit1', wert: '83,45' }])).toBe(a)
    expect(setzeWerte(a, [{ lauf: L1, starter: 's2', feld: 'zeit1', wert: '' }])).toBe(a)
    setzeWerte(a, [{ lauf: L1, starter: 's1', feld: 'zeit1', wert: '90' }])
    expect(a).toEqual(kopie)
  })

  it('zusammenführbar: Zwei Geräte erfassen verschiedene Listen – die Reihenfolge ist egal', () => {
    const steg = [{ lauf: L1, starter: 's1', feld: 'katalog:stegAnlegen', wert: '9' }, { lauf: L1, starter: 's2', feld: erfasstKennung('steg'), wert: '1' }]
    const tor = [{ lauf: L1, starter: 's1', feld: 't1a|hin seiteA', wert: '5' }, { lauf: L1, starter: 's2', feld: 't1a|hin seiteA', wert: 'G' }]
    expect(setzeWerte(setzeWerte({}, steg), tor)).toEqual(setzeWerte(setzeWerte({}, tor), steg))
  })
})

describe('Aufräumen', () => {
  const voll = setzeWerte({}, [
    { lauf: L1, starter: 's1', feld: 'zeit1', wert: '80' },
    { lauf: L1, starter: 's2', feld: 'zeit1', wert: '81' },
    { lauf: laufSchluessel('manoevrieren', 2), starter: 's2', feld: 'zeit1', wert: '82' },
  ])

  it('nurStarter: Wer gelöscht ist, nimmt seine Werte mit', () => {
    expect(nurStarter(voll, new Set(['s1']))).toEqual({ [L1]: { s1: { zeit1: '80' } } })
    expect(nurStarter(voll, new Set(['s1', 's2']))).toBe(voll)
  })

  it('normalisiereEingaben: nur brauchbare Zeichenketten überleben', () => {
    expect(normalisiereEingaben(undefined)).toEqual({})
    expect(normalisiereEingaben([1, 2])).toEqual({})
    expect(
      normalisiereEingaben({
        'manoevrieren/1': { s1: { zeit1: '80', leer: '', zahl: 5 }, s2: 'kaputt', s3: {} },
        ohneLauf: { s1: { zeit1: '80' } },
        'manoevrieren/2': null,
      }),
    ).toEqual({ 'manoevrieren/1': { s1: { zeit1: '80' } } })
  })
})

describe('vergleicheNr', () => {
  it('sortiert Startnummern natürlich; ein Präfix zählt wie eine 0 und steht damit vor den übrigen', () => {
    expect(['E10', '401', 'E2', '99'].sort(vergleicheNr)).toEqual(['E2', 'E10', '99', '401'])
    expect(['101', 'D02', '201', 'E01', '7'].sort(vergleicheNr)).toEqual(['E01', 'D02', '7', '101', '201'])
  })
})

describe('Schutz vor kaputten Schlüsseln', () => {
  it('eine präparierte Sicherung erreicht den Prototyp aller Objekte nicht', () => {
    // JSON.parse liefert `__proto__` als eigene Eigenschaft – ungeprüft landete der Wert in Object.prototype.
    const roh = JSON.parse('{"manoevrieren/1": {"__proto__": {"verseucht": "ja"}, "s1": {"__proto__": "x", "constructor": "y", "zeit1": "80"}}, "__proto__": {"s1": {"zeit1": "1"}}}')
    expect(normalisiereEingaben(roh)).toEqual({ 'manoevrieren/1': { s1: { zeit1: '80' } } })
    expect(({} as Record<string, unknown>).verseucht).toBeUndefined()
    expect(Object.prototype).not.toHaveProperty('verseucht')
  })

  it('setzeWerte übergeht dieselben Schlüssel', () => {
    const nach = setzeWerte({}, [
      { lauf: L1, starter: '__proto__', feld: 'verseucht', wert: 'ja' },
      { lauf: L1, starter: 's1', feld: '__proto__', wert: 'ja' },
      { lauf: '__proto__', starter: 's1', feld: 'zeit1', wert: '80' },
      { lauf: L1, starter: 'constructor', feld: 'zeit1', wert: '80' },
    ])
    expect(nach).toEqual({})
    expect(({} as Record<string, unknown>).verseucht).toBeUndefined()
  })

  it('gueltigeZellen: nur bekannte Starter und Lauf-Schlüssel nach Muster – dieselbe Regel wie beim Laden', () => {
    const zellen = [
      { lauf: L1, starter: 's1', feld: 'zeit1', wert: '80' },
      { lauf: L1, starter: 'gibtsnicht', feld: 'zeit1', wert: '80' },
      { lauf: 'quatsch', starter: 's1', feld: 'zeit1', wert: '80' },
      { lauf: L1, starter: 's1', feld: '', wert: '80' },
      { lauf: L1, starter: 's1', feld: 'zeit2', wert: '' },
    ]
    expect(gueltigeZellen(zellen, new Set(['s1']))).toEqual([zellen[0], zellen[4]])
  })
})

describe('Werte, die keine Liste mehr zeigt', () => {
  const starter = (id: string, klasse: ClassId): Starter => ({ id, startNr: id, vorname: 'Vor', nachname: id, verein: '', bundesland: '', geburtsdatum: '', klasse, groesse: '' })
  const stand = (extra: Partial<Parameters<typeof verborgeneZellen>[0]> = {}) => ({
    aufbau: 'alcatraz',
    laufCount: 3,
    starters: [starter('s1', '4'), starter('s2', '1')],
    eingaben: setzeWerte({}, [
      { lauf: L1, starter: 's1', feld: 'zeit1', wert: '80' },
      { lauf: L1, starter: 's1', feld: 'katalog:mueb', wert: '17' },
      { lauf: L1, starter: 's1', feld: erfasstKennung('mueb'), wert: '1' },
      { lauf: laufSchluessel('manoevrieren', 3), starter: 's2', feld: 'zeit1', wert: '70' },
    ]),
    ...extra,
  })

  it('im passenden Stand ist nichts verborgen', () => {
    expect(feldVon(konfig, 'mueb', '4', 'fehler')?.kennung).toBe('katalog:mueb')
    expect(verborgeneZellen(stand(), konfig)).toEqual([])
    expect([...starterMitEingaben(stand().eingaben)].sort()).toEqual(['s1', 's2'])
  })

  it('weniger Läufe: Die Werte der weggefallenen Läufe sind gemeldet', () => {
    const v = verborgeneZellen(stand({ laufCount: 2 }), konfig)
    expect(v).toEqual([{ lauf: 'manoevrieren/3', starter: 's2', feld: 'zeit1', wert: '70' }])
    // Entfernen leert genau diese Zellen.
    expect(Object.keys(setzeWerte(stand().eingaben, v.map((z) => ({ ...z, wert: '' }))))).toEqual([L1])
  })

  it('Klassenwechsel: Was die neue Klasse nicht hat (Mann über Bord), samt Haken der Liste', () => {
    const gewechselt = stand({ starters: [starter('s1', '1'), starter('s2', '1')] })
    expect(verborgeneZellen(gewechselt, konfig).map((z) => z.feld).sort()).toEqual(['erfasst@mueb', 'katalog:mueb'])
  })

  it('auch Werte eines Starters, den es nicht mehr gibt, und einer anderen Disziplin', () => {
    const fremd = stand({ starters: [starter('s1', '4')] })
    expect(verborgeneZellen(fremd, konfig).map((z) => z.starter)).toEqual(['s2'])
    const andere = { ...stand(), eingaben: { 'parallel/1': { s1: { zeit1: '30' } } } }
    expect(verborgeneZellen(andere, konfig)).toHaveLength(1)
  })
})

describe('Teilhaken (digitale WKR-Erfassung, Steg Ablegen/Anlegen, 21.11.2026)', () => {
  const starter = (id: string, klasse: ClassId): Starter => ({ id, startNr: id, vorname: 'Vor', nachname: id, verein: '', bundesland: '', geburtsdatum: '', klasse, groesse: '' })
  const mit = (feld: string) => ({ aufbau: 'alcatraz', laufCount: 3, starters: [starter('s1', '4')], eingaben: { [L1]: { s1: { [feld]: '1' } } } as Eingaben })

  it('istHaken, teilHaken, ganzerHaken', () => {
    expect(teilHaken('steg', 'ab')).toBe('erfasst.ab@steg')
    for (const k of ['erfasst@steg', 'erfasst.ab@steg', 'erfasst.an@steg']) expect(istHaken(k)).toBe(true)
    for (const k of ['erfasst.mitte@steg', 'disq@steg', 'erfasst', 'x.erfasst@steg']) expect(istHaken(k)).toBe(false)
    expect(ganzerHaken('erfasst.an@steg')).toBe('erfasst@steg')
    expect(ganzerHaken('disq@steg')).toBeUndefined()
  })

  it('sichtbar, wo der Haken seiner Liste es ist; sonst verborgen wie der Haken', () => {
    expect(verborgeneZellen(mit('erfasst.ab@steg'), konfig)).toEqual([])
    expect(verborgeneZellen(mit('erfasst.ab@nirgends'), konfig).map((z) => z.feld)).toEqual(['erfasst.ab@nirgends'])
    expect(verborgeneEinzelheiten(mit('erfasst.ab@nirgends'), konfig)[0].werte[0]).toMatchObject({ art: 'erfasst', zaehlt: false })
  })
})

describe('Verborgene Werte, erklärt', () => {
  const starter = (id: string, klasse: ClassId, startNr = id): Starter => ({ id, startNr, vorname: 'Vor', nachname: id, verein: '', bundesland: '', geburtsdatum: '', klasse, groesse: '' })
  const L3 = laufSchluessel('manoevrieren', 3)
  const L0 = laufSchluessel('manoevrieren', OHNE_LAUF)
  const stand = (zellen: Parameters<typeof setzeWerte>[1], extra: Partial<Parameters<typeof verborgeneEinzelheiten>[0]> = {}) => ({
    aufbau: 'alcatraz',
    laufCount: 3,
    starters: [starter('s1', '4', '401'), starter('s2', '1', '101')],
    eingaben: setzeWerte({}, zellen),
    ...extra,
  })
  /** Je Wert das Wesentliche: Kennung → [Lauf, Liste, Art, zählt, Grund]. */
  const kurz = (s: Parameters<typeof verborgeneEinzelheiten>[0], k = konfig) =>
    Object.fromEntries(verborgeneEinzelheiten(s, k).flatMap((g) => g.werte.map((w) => [`${g.starterId}:${w.zelle.feld}`, [w.lauf, w.liste, w.art, w.zaehlt, w.grund]])))

  it('nichts verborgen: keine Gruppen', () => {
    expect(verborgeneEinzelheiten(stand([{ lauf: L1, starter: 's1', feld: 'zeit1', wert: '80' }]), konfig)).toEqual([])
  })

  it('dieselben Zellen wie verborgeneZellen – keine geht verloren, keine kommt dazu', () => {
    const s = stand(
      [
        { lauf: L3, starter: 's2', feld: 'zeit1', wert: '70' },
        { lauf: L1, starter: 's1', feld: 'katalog:mueb', wert: '17' },
        { lauf: L1, starter: 's1', feld: erfasstKennung('mueb'), wert: '1' },
        { lauf: L1, starter: 's1', feld: 'zeit1', wert: '80' },
      ],
      { laufCount: 2, starters: [starter('s1', '1', '401'), starter('s2', '1', '101')] },
    )
    const zellen = verborgeneEinzelheiten(s, konfig).flatMap((g) => g.werte.map((w) => w.zelle))
    const schluessel = (z: { lauf: string; starter: string; feld: string }) => `${z.lauf}|${z.starter}|${z.feld}`
    expect(zellen.map(schluessel).sort()).toEqual(verborgeneZellen(s, konfig).map(schluessel).sort())
    // Starter nach Startnummer.
    expect(verborgeneEinzelheiten(s, konfig).map((g) => [g.starterId, g.starter?.startNr])).toEqual([['s2', '101'], ['s1', '401']])
  })

  it('weniger Läufe: Der Lauf liegt über der Zahl der Läufe – der Wert ist nur gespeichert', () => {
    const s = stand([{ lauf: L3, starter: 's2', feld: 'zeit1', wert: '70' }], { laufCount: 2 })
    expect(kurz(s)).toEqual({ 's2:zeit1': [3, 'zeit', 'feld', false, 'lauf'] })
    expect(verborgeneEinzelheiten(s, konfig)[0].werte[0].feld).toMatchObject({ kind: 'time', label: expect.any(String) })
  })

  it('Klassenwechsel: Fehlerpunkte der alten Klasse zählen weiter mit, der Haken nicht', () => {
    const s = stand(
      [
        { lauf: L1, starter: 's1', feld: 'katalog:mueb', wert: '17' },
        { lauf: L1, starter: 's1', feld: erfasstKennung('mueb'), wert: '1' },
      ],
      { starters: [starter('s1', '1', '401')] },
    )
    // Die Wertung liest nur Felder, die irgendeine Liste für die NEUE Klasse kennt: „Mann über Bord“ hat Klasse 1 nicht.
    expect(kurz(s)).toEqual({ 's1:katalog:mueb': [1, 'mueb', 'feld', false, 'klasse'], 's1:erfasst@mueb': [1, 'mueb', 'erfasst', false, 'klasse'] })
  })

  it('anderer Aufbau: ein x am Vorsteg zählt weiter mit; die Liste gibt es im Aufbau nicht', () => {
    const s = stand([{ lauf: L1, starter: 's1', feld: 'disq@vorsteg', wert: 'X' }], { aufbau: 'frontal' })
    const [wert] = verborgeneEinzelheiten(s, konfig)[0].werte
    expect(wert).toMatchObject({ lauf: 1, liste: 'vorsteg', art: 'feld', zaehlt: true })
    expect(['aufbau', 'abgewaehlt']).toContain(wert.grund)
    expect(wert.feld?.kind).toBe('disq')
  })

  it('Stoppuhren neben einer elektronischen Zeit zählen nicht; ohne sie schon', () => {
    const zellen = [
      { lauf: L1, starter: 's1', feld: 'zeit1', wert: '80,00' },
      { lauf: L1, starter: 's1', feld: 'zeit2', wert: '83,00' },
      { lauf: L1, starter: 's1', feld: 'zeit3', wert: '83,00' },
    ]
    const dm26 = stand(zellen, { aufbau: 'alcatrazdm26' })
    expect(kurz(dm26)).toMatchObject({ 's1:zeit2': [1, 'zeit', 'feld', false, expect.any(String)], 's1:zeit3': [1, 'zeit', 'feld', false, expect.any(String)] })
    // Ohne die elektronische Zeit rechnet die Wertung mit den Stoppuhren, die keine Liste zeigt.
    const ohne = stand(zellen.slice(1), { aufbau: 'alcatrazdm26' })
    expect(kurz(ohne)).toMatchObject({ 's1:zeit2': [1, 'zeit', 'feld', true, expect.any(String)] })
    // Eine unlesbare Zeit zählt nie.
    const kaputt = stand([{ lauf: L1, starter: 's1', feld: 'zeit2', wert: 'abc' }], { aufbau: 'alcatrazdm26' })
    expect(kurz(kaputt)['s1:zeit2'][3]).toBe(false)
  })

  it('abgewählte Liste (Knoten): Punkte ohne Lauf sind nur gespeichert, solange die Liste nicht gilt', () => {
    const feld = listenFelder(konfig, 'knoten', '4').find((f) => f.kind !== 'text' && f.kind !== 'disq')!
    const zellen = [{ lauf: L0, starter: 's1', feld: feld.kennung, wert: feld.kind === 'code' ? (feld.katalog?.[0]?.code ?? '1') : '5' }]
    expect(verborgeneEinzelheiten(stand(zellen), konfig)).toEqual([])
    const ab = stand(zellen, { zusatzListen: { knoten: false } })
    expect(kurz(ab)).toEqual({ [`s1:${feld.kennung}`]: [OHNE_LAUF, 'knoten', 'feld', false, 'abgewaehlt'] })
  })

  it('Klasse, die das Regelwerk nicht kennt (DM-Klasse 7 unter UIM): eigener Grund, nichts zählt mit', () => {
    const uim = configFor({ regelwerk: 'uim-2026' })
    const aufbau = uim.getAufbauten()[0].id
    const s = { ...stand([{ lauf: L1, starter: 's7', feld: 'zeit1', wert: '80' }, { lauf: L1, starter: 's7', feld: 'nur-dort', wert: '5' }], { aufbau, starters: [starter('s7', '7', '701')] }) }
    expect(kurz(s, uim)).toMatchObject({ 's7:zeit1': [1, expect.anything(), 'feld', false, 'klasseFehlt'], 's7:nur-dort': [1, undefined, 'feld', false, 'klasseFehlt'] })
  })

  it('andere Disziplin, fehlender Starter, unbekanntes Feld', () => {
    const s = {
      ...stand([]),
      eingaben: { 'parallel/1': { s1: { zeit1: '30' } }, [L1]: { weg: { zeit1: '80' }, s1: { 'gibt-es-nicht': '5', 'erfasst@nirgends': '1' } } } as Eingaben,
    }
    expect(kurz(s)).toMatchObject({
      's1:zeit1': [1, 'zeit', 'feld', false, 'disziplin'],
      'weg:zeit1': [1, expect.anything(), 'feld', false, 'starter'],
      's1:gibt-es-nicht': [1, undefined, 'feld', false, 'unbekannt'],
      's1:erfasst@nirgends': [1, undefined, 'erfasst', false, 'unbekannt'],
    })
    const gruppen = verborgeneEinzelheiten(s, konfig)
    // Der Starter, den es nicht gibt, steht zuletzt und ohne Angaben.
    expect(gruppen.at(-1)).toMatchObject({ starterId: 'weg', starter: undefined })
  })
})
