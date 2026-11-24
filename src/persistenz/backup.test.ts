import { describe, expect, it } from 'vitest'
import { fileStamp, filename, makeFile, parseFile } from './backup'
import { loadState, saveState, STATE_KEY } from './storage'
import { emptyState } from '../state/reducer'
import type { AppState, Starter } from '../types'
import { testLogo, testSvgLogo } from '../testHilfen'

const AT = '2026-11-11T22:15:00.000Z'
const starter: Starter = {
  id: 'st_1',
  startNr: '101',
  vorname: 'A',
  nachname: 'B',
  verein: 'Club',
  bundesland: '',
  geburtsdatum: '2017-01-01',
  klasse: '1',
  groesse: 'M',
}
const filled = (): AppState => ({
  ...emptyState(),
  eventName: '30. Möwepokal',
  starters: [starter],
  regelwerk: 'uim-2026',
  showBirthdate: false,
  originShort: { Club: 'CLB' },
})
const roundTrip = (kind: Parameters<typeof makeFile>[0]) => parseFile(JSON.stringify(makeFile(kind, filled(), AT)))

describe('Dateien', () => {
  it('Beispiel-Starterfeld: steht in der Sicherung, nicht in der Vorlage – es gehört zu den Startern', () => {
    const beispiel: AppState = { ...filled(), beispielStarter: true }
    const sicherung = parseFile(JSON.stringify(makeFile('sicherung', beispiel, AT)))
    expect(sicherung.ok && sicherung.kind === 'sicherung' && sicherung.state.beispielStarter).toBe(true)

    const datei = makeFile('vorlage', beispiel, AT)
    expect(JSON.stringify(datei)).not.toContain('beispielStarter')
    const vorlage = parseFile(JSON.stringify(datei))
    if (!vorlage.ok || vorlage.kind !== 'vorlage') throw new Error('keine Vorlage')
    // Die Vorlage ändert nichts daran, woher die hiesigen Starter stammen – in beide Richtungen.
    expect(vorlage.apply(beispiel).beispielStarter).toBe(true)
    expect(vorlage.apply(filled()).beispielStarter).toBe(false)
    // Auch eine von Hand ergänzte Vorlage macht echte Starter nicht zu Beispieldaten.
    const ergaenzt = parseFile(JSON.stringify({ ...datei, settings: { ...(datei as { settings: object }).settings, beispielStarter: true } }))
    if (!ergaenzt.ok || ergaenzt.kind !== 'vorlage') throw new Error('keine Vorlage')
    expect(ergaenzt.apply(filled()).beispielStarter).toBe(false)
  })

  it('„Disziplin nicht werten“ gehört zu den Ergebnissen: in der Sicherung, nicht in der Vorlage; der Buchstabe der Dolphin-Nummern ist eine Einstellung', () => {
    const stand: AppState = { ...filled(), nichtWerten: { parallel: ['1', '2'] }, dolphinPraefix: 'D' }
    const sicherung = parseFile(JSON.stringify(makeFile('sicherung', stand, AT)))
    expect(sicherung.ok && sicherung.kind === 'sicherung' && [sicherung.state.nichtWerten, sicherung.state.dolphinPraefix]).toEqual([{ parallel: ['1', '2'] }, 'D'])
    const datei = makeFile('vorlage', stand, AT)
    expect(JSON.stringify(datei)).not.toContain('nichtWerten')
    const vorlage = parseFile(JSON.stringify(datei))
    if (!vorlage.ok || vorlage.kind !== 'vorlage') throw new Error('keine Vorlage')
    // Die hiesige Entscheidung bleibt; der Buchstabe kommt aus der Vorlage.
    const hier: AppState = { ...filled(), nichtWerten: { manoever: ['3'] } }
    const danach = vorlage.apply(hier)
    expect([danach.nichtWerten, danach.dolphinPraefix]).toEqual([{ manoever: ['3'] }, 'D'])
    // Unbrauchbares entfällt beim Laden, ohne abzustürzen.
    const kaputt = parseFile(JSON.stringify({ app: 'alcatraz', version: 1, savedAt: AT, kind: 'sicherung', state: { ...stand, nichtWerten: { parallel: ['1', 'x', 9], quer: ['1'], manoever: 'alle' }, dolphinPraefix: 'Q' } }))
    expect(kaputt.ok && kaputt.kind === 'sicherung' && [kaputt.state.nichtWerten, kaputt.state.dolphinPraefix]).toEqual([{ parallel: ['1'] }, 'E'])
  })

  it('sind Ergebnisse erfasst, wechselt auch eine Vorlage das Regelwerk nicht', () => {
    const datei = JSON.stringify(makeFile('vorlage', { ...filled(), regelwerk: 'dm-2026' }, AT))
    const vorlage = parseFile(datei)
    if (!vorlage.ok || vorlage.kind !== 'vorlage') throw new Error('keine Vorlage')
    const mitWerten: AppState = { ...filled(), eingaben: { 'manoevrieren/1': { st_1: { zeit1: '80' } } } }
    expect(vorlage.apply(mitWerten).regelwerk).toBe('uim-2026')
    expect(vorlage.apply(filled()).regelwerk).toBe('dm-2026')
  })

  it('Besetzung: Co-Piloten sind Personennamen – in der Sicherung, nie in der Vorlage; die Boote reisen mit', () => {
    const besetzt: AppState = { ...filled(), boote: { '1': 'Boot 2, 9,9 PS' }, coPiloten: { '1': 'Erika Beispiel' } }
    const sicherung = parseFile(JSON.stringify(makeFile('sicherung', besetzt, AT)))
    if (!sicherung.ok || sicherung.kind !== 'sicherung') throw new Error('keine Sicherung')
    expect(sicherung.state.coPiloten).toEqual({ '1': 'Erika Beispiel' })
    expect(sicherung.state.boote).toEqual({ '1': 'Boot 2, 9,9 PS' })

    const datei = makeFile('vorlage', besetzt, AT)
    const text = JSON.stringify(datei)
    expect(text).not.toContain('Erika Beispiel')
    expect(text).not.toContain('coPiloten')
    expect(text).toContain('Boot 2, 9,9 PS')
    const vorlage = parseFile(text)
    if (!vorlage.ok || vorlage.kind !== 'vorlage') throw new Error('keine Vorlage')
    // Die Vorlage bringt die Boote mit; die hiesigen Co-Piloten bleiben, wie sie sind.
    const hier: AppState = { ...emptyState(), boote: { '4': 'altes Boot' }, coPiloten: { '2': 'Max Muster' } }
    const danach = vorlage.apply(hier)
    expect(danach.boote).toEqual({ '1': 'Boot 2, 9,9 PS' })
    expect(danach.coPiloten).toEqual({ '2': 'Max Muster' })
    // Auch eine von Hand um Namen ergänzte Vorlage bringt keine Co-Piloten mit.
    const ergaenzt = parseFile(JSON.stringify({ ...datei, settings: { ...(datei as { settings: object }).settings, coPiloten: { '3': 'Fremder Name' } } }))
    if (!ergaenzt.ok || ergaenzt.kind !== 'vorlage') throw new Error('keine Vorlage')
    expect(ergaenzt.apply(hier).coPiloten).toEqual({ '2': 'Max Muster' })
  })

  it('Betrieb am Wettkampftag: in der Sicherung, nicht in der Vorlage; die Anzeigetafel reist mit, außer der Kopfzeile', () => {
    const ref = JSON.stringify(['m', starter.id, 1])
    const imBetrieb: AppState = {
      ...filled(),
      betrieb: { bereiche: { par_1: { begonnen: ['lauf:1'], gezeigt: [{ ref, zeit: 1000 }], ohneAnzeige: [], zurueckgestellt: [], reihenfolge: null, ausgesetzt: [], vorziehen: false, meldung: { text: 'Mittagspause', art: 'pause' } } } },
      anzeige: { ...filled().anzeige, kopfzeile: '30. Möwepokal am See', namen: 'kurz', skala: 1.2, abstaende: { E: 95, '1': 80 }, parallelAnordnung: 'b-oben' },
    }
    const sicherung = parseFile(JSON.stringify(makeFile('sicherung', imBetrieb, AT)))
    if (!sicherung.ok || sicherung.kind !== 'sicherung') throw new Error('keine Sicherung')
    expect([sicherung.state.betrieb, sicherung.state.anzeige]).toEqual([imBetrieb.betrieb, imBetrieb.anzeige])

    const datei = makeFile('vorlage', imBetrieb, AT)
    const text = JSON.stringify(datei)
    for (const nie of ['betrieb', 'Mittagspause', 'Möwepokal', ref]) expect(text).not.toContain(nie)
    if (datei.kind !== 'vorlage') throw new Error('keine Vorlage')
    // Auch die eigenen (oder übernommenen) Startabstände reisen mit – sie sind die Vorgabe fürs nächste Mal (L-6).
    expect(datei.settings.anzeige).toMatchObject({ kopfzeile: null, namen: 'kurz', skala: 1.2, abstaende: { E: 95, '1': 80 }, parallelAnordnung: 'b-oben' })
    const vorlage = parseFile(text)
    if (!vorlage.ok || vorlage.kind !== 'vorlage') throw new Error('keine Vorlage')
    // Hier: eigener Betrieb und eigene Kopfzeile – beide bleiben; die übrigen Einstellungen kommen aus der Vorlage.
    const hier: AppState = { ...imBetrieb, anzeige: { ...emptyState().anzeige, kopfzeile: 'Hiesige Kopfzeile' } }
    const danach = vorlage.apply(hier)
    expect(danach.betrieb).toEqual(imBetrieb.betrieb)
    // Auch die Lage von Racecourse A und B (16.11.2026): Sie gehört zum Standort der Tafel, der meist derselbe bleibt.
    expect(danach.anzeige).toMatchObject({ kopfzeile: 'Hiesige Kopfzeile', namen: 'kurz', skala: 1.2, abstaende: { E: 95, '1': 80 }, parallelAnordnung: 'b-oben' })
  })

  it('Server des Gerätebetriebs (E6): eine Einstellung – in Sicherung und Vorlage; Raum und Schlüssel nie', () => {
    const hier: AppState = { ...filled(), geraeteServer: 'https://ntfy.example.org' }
    const sicherung = parseFile(JSON.stringify(makeFile('sicherung', hier, AT)))
    if (!sicherung.ok || sicherung.kind !== 'sicherung') throw new Error('keine Sicherung')
    expect(sicherung.state.geraeteServer).toBe('https://ntfy.example.org')
    const datei = makeFile('vorlage', hier, AT)
    if (datei.kind !== 'vorlage') throw new Error('keine Vorlage')
    expect(datei.settings.geraeteServer).toBe('https://ntfy.example.org')
    const vorlage = parseFile(JSON.stringify(datei))
    if (!vorlage.ok || vorlage.kind !== 'vorlage') throw new Error('keine Vorlage')
    expect(vorlage.apply(emptyState()).geraeteServer).toBe('https://ntfy.example.org')
    // Raum und Schlüssel liegen gerätelokal (geraete/ablage.ts), nie im Stand – also in keiner Datei.
    for (const kind of ['sicherung', 'vorlage'] as const) {
      const text = JSON.stringify(makeFile(kind, hier, AT))
      for (const nie of ['alcatraz.geraete', 'geheimnis', 'oeffentlich']) expect(text).not.toContain(nie)
    }
  })

  it('eine Vorlage mit anderen Parcours hängt den Betrieb um wie die Einteilung; der Parallelslalom bleibt', () => {
    const bereich = (text: string) => ({ begonnen: ['lauf:1' as const], gezeigt: [], ohneAnzeige: [], zurueckgestellt: [], reihenfolge: null, ausgesetzt: [], vorziehen: false, meldung: { text, art: 'info' as const } })
    const hier: AppState = { ...filled(), betrieb: { bereiche: { par_1: bereich('eins'), par_2: bereich('zwei'), parallel: bereich('parallel') } } }
    const parcoursList: AppState['parcoursList'] = [
      { id: 'v_1', name: 'Parcours See', classIds: ['E', '1'], wechselFaktor: 2 },
      { id: 'par_2', name: 'Parcours 2', classIds: ['4'], wechselFaktor: 2 },
    ]
    const vorlage = parseFile(JSON.stringify(makeFile('vorlage', { ...filled(), parcoursList }, AT)))
    if (!vorlage.ok || vorlage.kind !== 'vorlage') throw new Error('keine Vorlage')
    const danach = vorlage.apply(hier)
    expect(Object.fromEntries(Object.entries(danach.betrieb.bereiche).map(([id, b]) => [id, b.meldung?.text]))).toEqual({ v_1: 'eins', par_2: 'zwei', parallel: 'parallel' })
  })

  it('Sicherung: der ganze Stand kommt zurück', () => {
    expect(roundTrip('sicherung')).toEqual({ ok: true, kind: 'sicherung', state: filled(), savedAt: AT })
  })

  it('Vorlage: enthält keine Starter und keinen Namen, setzt nur die Einstellungen', () => {
    const file = makeFile('vorlage', filled(), AT)
    expect(JSON.stringify(file)).not.toContain('Möwepokal')
    expect(JSON.stringify(file)).not.toContain('st_1')

    const result = roundTrip('vorlage')
    if (!result.ok || result.kind !== 'vorlage') throw new Error('keine Vorlage')
    const other: Starter = { ...starter, id: 'st_9', nachname: 'Anders' }
    const applied = result.apply({ ...emptyState(), eventName: 'Neuer Pokal', eventJahr: 2027, starters: [other] })
    expect(applied).toMatchObject({ eventName: 'Neuer Pokal', eventJahr: 2027, regelwerk: 'uim-2026', showBirthdate: false })
    expect(applied.originShort).toEqual({ Club: 'CLB' })
    expect(applied.starters).toEqual([other])
  })

  it('Datum der Veranstaltung (24.11.2026): in der Sicherung, nicht in der Vorlage – das hiesige bleibt', () => {
    const mitDatum: AppState = { ...filled(), eventDatum: '2026-09-05' }
    const sicherung = parseFile(JSON.stringify(makeFile('sicherung', mitDatum, AT)))
    expect(sicherung.ok && sicherung.kind === 'sicherung' && sicherung.state.eventDatum).toBe('2026-09-05')
    const datei = makeFile('vorlage', mitDatum, AT)
    expect(JSON.stringify(datei)).not.toContain('eventDatum')
    const vorlage = parseFile(JSON.stringify(datei))
    if (!vorlage.ok || vorlage.kind !== 'vorlage') throw new Error('keine Vorlage')
    expect(vorlage.apply({ ...emptyState(), eventDatum: '2027-06-12' }).eventDatum).toBe('2027-06-12')
  })

  it('Teilnehmerdaten: nur die Starter', () => {
    const file = makeFile('starter', filled(), AT)
    expect(file).not.toHaveProperty('state')
    expect(roundTrip('starter')).toEqual({ ok: true, kind: 'starter', starters: [starter], savedAt: AT })
  })

  it('liest ältere Sicherungen ohne Angabe der Art', () => {
    const old = { app: 'alcatraz', version: 1, savedAt: AT, state: emptyState() }
    expect(parseFile(JSON.stringify(old))).toMatchObject({ ok: true, kind: 'sicherung' })
  })

  it('weist fremde und kaputte Dateien ab', () => {
    expect(parseFile('kein json').ok).toBe(false)
    expect(parseFile(JSON.stringify({ app: 'tafel', state: emptyState() })).ok).toBe(false)
    expect(parseFile(JSON.stringify({ app: 'alcatraz', kind: 'sicherung', state: {} })).ok).toBe(false)
    expect(parseFile(JSON.stringify({ app: 'alcatraz', kind: 'starter', starters: 'nein' })).ok).toBe(false)
    expect(parseFile(JSON.stringify({ app: 'alcatraz', kind: 'unbekannt' })).ok).toBe(false)
  })

  it('bildet Dateinamen ohne Sonderzeichen', () => {
    const at = new Date(2026, 10, 11, 23, 5)
    expect(fileStamp(at)).toBe('2026-11-11_2305')
    expect(filename('sicherung', 'Sicherung', filled(), at)).toBe('alcatraz-sicherung-30-mowepokal-2026-2026-11-11_2305.json')
    expect(filename('vorlage', 'Vorlage', filled(), at)).toBe('alcatraz-vorlage-2026-11-11_2305.json')
    // In der englischen Oberfläche heißen auch die Dateien englisch.
    expect(filename('sicherung', 'Backup', filled(), at)).toBe('alcatraz-backup-30-mowepokal-2026-2026-11-11_2305.json')
  })
})

describe('Speicher im Browser', () => {
  it('speichert und lädt den Stand', () => {
    localStorage.clear()
    expect(loadState()).toBeNull()
    const state = { ...emptyState(), eventName: 'Test' }
    expect(saveState(state)).toBe(true)
    expect(loadState()).toEqual(state)
  })

  it('beginnt leer, wenn der gespeicherte Stand kaputt ist', () => {
    localStorage.setItem(STATE_KEY, '{kaputt')
    expect(loadState()).toBeNull()
  })
})

describe('Listenoptionen in den Dateien', () => {
  const optionen = {
    wkrZeilenJeSeite: 15,
    wkrTeilenAb: 25,
    beschriftung: 'ls',
    wkrSprachen: { par_1: { steg: 'de+en' }, par_2: { knoten: 'de' }, 'racecourse-a': { zeit: 'de' } },
    wkrLeerzeilenSeite: 5,
    tor5MitParcours: true,
    zusatzListen: { knoten: false, vorsteg: true },
    laufzettelLayout: 'liste',
    logos: { links: testLogo(), rechts: null },
    logoHoeheMm: 20,
  } as const

  it('sind Einstellungen: Sie stehen in Sicherung und Vorlage', () => {
    const stand: AppState = { ...filled(), ...optionen }
    const sicherung = parseFile(JSON.stringify(makeFile('sicherung', stand, AT)))
    expect(sicherung.ok && sicherung.kind === 'sicherung' && sicherung.state).toMatchObject(optionen)
    const datei = makeFile('vorlage', stand, AT)
    expect(datei.kind === 'vorlage' && datei.settings).toMatchObject(optionen)
    const vorlage = parseFile(JSON.stringify(datei))
    if (!vorlage.ok || vorlage.kind !== 'vorlage') throw new Error('keine Vorlage')
    // Die Vorlage stellt eine andere Veranstaltung so ein, deren Starter bleiben.
    const danach = vorlage.apply(filled())
    expect(danach).toMatchObject(optionen)
    expect(danach.starters).toEqual(filled().starters)
  })

  it('Logos: Je Seite gilt das Logo der Vorlage; fehlt es ihr, bleibt das hiesige. Die Höhe kommt aus der Vorlage', () => {
    const hier: AppState = { ...filled(), logos: { links: testLogo(), rechts: testLogo(4, 2) }, logoHoeheMm: 12 }
    const ohne = parseFile(JSON.stringify(makeFile('vorlage', { ...filled(), logoHoeheMm: 25 }, AT)))
    if (!ohne.ok || ohne.kind !== 'vorlage') throw new Error('keine Vorlage')
    expect(ohne.apply(hier)).toMatchObject({ logos: hier.logos, logoHoeheMm: 25 })
    // Eine Vorlage von vor den Logos (ohne beide Felder) lässt die Logos stehen, die Höhe wird die Vorgabe.
    const { logos: _l, logoHoeheMm: _h, ...settings } = (makeFile('vorlage', filled(), AT) as unknown as { settings: AppState }).settings
    const alt = parseFile(JSON.stringify({ app: 'alcatraz', version: 1, savedAt: AT, kind: 'vorlage', settings }))
    if (!alt.ok || alt.kind !== 'vorlage') throw new Error('keine Vorlage')
    expect(alt.apply(hier)).toMatchObject({ logos: hier.logos, logoHoeheMm: 15 })
    const rechts = parseFile(JSON.stringify(makeFile('vorlage', { ...filled(), logos: { links: null, rechts: testSvgLogo() } }, AT)))
    if (!rechts.ok || rechts.kind !== 'vorlage') throw new Error('keine Vorlage')
    expect(rechts.apply(hier).logos).toEqual({ links: testLogo(), rechts: testSvgLogo() })
  })

  it('Logos: Eine Sicherung mit einem Logo aus dem Netz lädt, das Logo entfällt', () => {
    const datei = makeFile('sicherung', { ...filled(), logos: { links: { src: 'https://example.org/logo.png', breite: 2, hoehe: 1 }, rechts: testLogo() } }, AT)
    const sicherung = parseFile(JSON.stringify(datei))
    if (!sicherung.ok || sicherung.kind !== 'sicherung') throw new Error('keine Sicherung')
    expect(sicherung.state.logos).toEqual({ links: null, rechts: testLogo() })
    expect(sicherung.state.starters).toEqual(filled().starters)
  })

  it('Sprache der Bögen je Parcours: Die Vorlage bringt sie mit den eigenen Parcours mit, an deren Kennungen sie hängt', () => {
    const parcoursList: AppState['parcoursList'] = [{ id: 'v_1', name: 'Parcours 1', classIds: ['1', '2'], wechselFaktor: 2 }]
    const datei = makeFile('vorlage', { ...filled(), parcoursList, wkrSprachen: { v_1: { steg: 'de' }, 'racecourse-b': { steg: 'de+en' } } }, AT)
    const vorlage = parseFile(JSON.stringify(datei))
    if (!vorlage.ok || vorlage.kind !== 'vorlage') throw new Error('keine Vorlage')
    const danach = vorlage.apply({ ...filled(), wkrSprachen: { par_1: { zeit: 'de+en' } } })
    expect(danach.parcoursList.map((p) => p.id)).toEqual(['v_1'])
    expect(danach.wkrSprachen).toEqual({ v_1: { steg: 'de' }, 'racecourse-b': { steg: 'de+en' } })
  })

  it('eine Vorlage, die Tor 5 und Parcours zusammenlegt, zieht die hiesigen Eingaben und Namen mit', () => {
    const lauf = 'manoevrieren/1'
    // Die Disq-Buchstaben sind die der DM.
    const dm = (): AppState => ({ ...filled(), regelwerk: 'dm-2026' })
    const hier: AppState = {
      ...dm(),
      eingaben: { [lauf]: { [starter.id]: { 'disq@tor5': 'G', 'bemerkung@tor5': 'x', 'erfasst@tor5': '1', zeit1: '80' } } },
      einteilung: Object.fromEntries(filled().parcoursList.map((p) => [p.id, { tor5: 'Erika Muster' }])),
    }
    const vorlage = parseFile(JSON.stringify(makeFile('vorlage', { ...dm(), tor5MitParcours: true }, AT)))
    if (!vorlage.ok || vorlage.kind !== 'vorlage') throw new Error('keine Vorlage')
    const danach = vorlage.apply(hier)
    expect(danach.tor5MitParcours).toBe(true)
    expect(danach.eingaben[lauf][starter.id]).toEqual({ 'disq@tor5pue': 'G', 'bemerkung@tor5pue': 'x', 'erfasst@tor5pue': '1', zeit1: '80' })
    expect(Object.values(danach.einteilung)).toEqual(filled().parcoursList.map(() => ({ tor5pue: 'Erika Muster' })))
    // Und zurück mit einer Vorlage ohne die Option.
    const ohne = parseFile(JSON.stringify(makeFile('vorlage', dm(), AT)))
    if (!ohne.ok || ohne.kind !== 'vorlage') throw new Error('keine Vorlage')
    expect(ohne.apply(danach).eingaben).toEqual(hier.eingaben)
  })
})

describe('Dateien: digitale WKR-Erfassung (W1, 21.11.2026)', () => {
  const liste = JSON.stringify(['l', 'par_1', 'gate135', null])
  const mitWkr = (): AppState => ({
    ...filled(),
    wkr: {
      listen: { [liste]: { modus: 'beides', status: 'aktiv', seit: 100, pausen: [] } },
      rueckfragen: [],
      vorschlaege: [],
      abschluss: { [liste]: { 'lauf:1': { name: 'Vor9 Nach9', zeit: 9000, abweichend: [], papier: [] } } },
      nichtVorbei: {},
      keineZeit: {},
    },
  })

  it('in der Sicherung, nicht in der Vorlage; eine Vorlage lässt den hiesigen Stand', () => {
    const sicherung = parseFile(JSON.stringify(makeFile('sicherung', mitWkr(), AT)))
    if (!sicherung.ok || sicherung.kind !== 'sicherung') throw new Error('keine Sicherung')
    expect(sicherung.state.wkr).toEqual(mitWkr().wkr)
    const datei = makeFile('vorlage', mitWkr(), AT)
    const text = JSON.stringify(datei)
    for (const nie of ['"wkr"', 'Vor9 Nach9', 'gate135']) expect(text).not.toContain(nie)
    const vorlage = parseFile(text)
    if (!vorlage.ok || vorlage.kind !== 'vorlage') throw new Error('keine Vorlage')
    const hier = mitWkr()
    expect(vorlage.apply(hier).wkr).toBe(hier.wkr)
  })
})
