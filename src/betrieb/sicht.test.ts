import { describe, expect, it } from 'vitest'
import { reducer } from '../state/reducer'
import { laufSchluessel } from '../lib/eingaben'
import { BETRIEB_STARTER, betriebsStand, betriebStarter, festgeschrieben, testLogo, uimParallelStand, zeigeNaechsten } from '../testHilfen'
import { refKey } from './folge'
import { sichtOeffentlich, sichtZuschauer } from './sicht'
import type { AppState, OeffentlicheSicht } from '../types'

// Die öffentliche Sicht: was Anzeigetafel, Zuschauer und Start-Freigabe vom Stand sehen. Alle Starter
// sind erfunden (Vor<id>/Nach<id>, Musterclub); Geburtsdatum und Gewicht stehen nur hier, um zu
// prüfen, dass sie draußen bleiben.

const P1 = 'par_1'
const m = (starter: string, lauf: number) => refKey({ art: 'm', starter, lauf })
const GEHEIM = '2014-02-03'

/** Lauf 1 auf Parcours 1 begonnen, zwei Starts gezeigt; alle Starter mit Geburtsdatum, Gewicht, Geschlecht und Werten. */
function imBetrieb(regelwerk = 'dm-2026'): AppState {
  const starter = BETRIEB_STARTER.map((p) => ({ ...p, geburtsdatum: GEHEIM, gewicht: 41.7, geschlecht: 'F' as const }))
  let s = reducer(betriebsStand(starter), { type: 'SET_REGELWERK', regelwerk })
  s = festgeschrieben(s)
  s = reducer(s, { type: 'BETRIEB_BEGINNEN', bereich: P1, punkt: 'lauf:1' })
  s = zeigeNaechsten(zeigeNaechsten(s, P1, 1000), P1, 61_000)
  s = reducer(s, { type: 'SET_EINGABEN', zellen: [{ lauf: laufSchluessel('manoevrieren', 1), starter: 'e1', feld: 'zeit1', wert: '83.4' }] })
  return { ...s, abgemeldet: ['f1'] }
}

/** Alle Schlüssel eines Werts, auch verschachtelt. */
function schluessel(wert: unknown, out = new Set<string>()): Set<string> {
  if (Array.isArray(wert)) wert.forEach((w) => schluessel(w, out))
  else if (wert && typeof wert === 'object')
    for (const [k, v] of Object.entries(wert)) {
      out.add(k)
      schluessel(v, out)
    }
  return out
}

const name = (sicht: OeffentlicheSicht, id: string) => sicht.starter[id]?.name

describe('Öffentliche Sicht', () => {
  it('Datenschutz: kein Geburtsdatum, Gewicht, Geschlecht, keine Werte, keine Abmeldungen', () => {
    const sicht = sichtOeffentlich(imBetrieb())
    const alle = schluessel(sicht)
    for (const verboten of ['geburtsdatum', 'gewicht', 'geschlecht', 'eingaben', 'abgemeldet', 'abgemeldetBis', 'groesse', 'vorname', 'nachname', 'coPiloten', 'einteilung'])
      expect(alle.has(verboten), verboten).toBe(false)
    const text = JSON.stringify(sicht)
    for (const verboten of [GEHEIM, '41.7', '83.4']) expect(text).not.toContain(verboten)
  })

  it('nur Starter, die in der Sicht vorkommen; der erste offene ist der Nächste', () => {
    const s = reducer(imBetrieb(), { type: 'SET_ANZEIGE', patch: { amSteg: 0, vorSteg: 0 } })
    const sicht = sichtOeffentlich(s)
    const b = sicht.bereiche[0]
    expect([b.id, b.name, b.fest, b.punkt?.id, b.punkt?.titel, b.naechsterPunkt?.id]).toEqual([P1, 'Parcours 1', true, 'lauf:1', '1. Lauf', 'lauf:2'])
    expect([b.aktuell?.key, b.vorig?.key, b.seit, b.offen.map((o) => o.key), b.offenZahl]).toEqual([m('k1', 1), m('e1', 1), 61_000, [m('e2', 1)], 2])
    expect(b.aktuell?.titel).toBe('1. Lauf')
    // Zur Wahl (E2) stehen alle offenen Starts, auch späterer Läufe und des Parcours, der noch nicht begonnen hat.
    expect(Object.keys(sicht.starter).sort()).toEqual(['e1', 'e2', 'f1', 'k1', 'k2', 'v1', 'v2'])
    // Wer nirgends mehr vorkommt, steht nicht darin: k2 mit X in allen Läufen.
    const x = [1, 2, 3].reduce((st, lauf) => reducer(st, { type: 'SET_EINGABEN', zellen: [{ lauf: laufSchluessel('manoevrieren', lauf), starter: 'k2', feld: 'disq@steg', wert: 'X' }] }), s)
    expect(Object.keys(sichtOeffentlich(x).starter)).not.toContain('k2')
    expect(sicht.starter.k1).toEqual({ startNr: '101', name: 'Vork1 Nachk1', klasse: '1', herkunft: expect.objectContaining({ klartext: 'Musterclub' }) })
    expect(Object.keys(sicht.klassen).sort()).toEqual(['1', '4', '5', 'E'])
    // Parcours 2 hat nicht begonnen: steht da, ohne Start im Boot und ohne freigegebene – seine Starts warten.
    expect(sicht.bereiche[1]).toMatchObject({ id: 'par_2', punkt: null, aktuell: null, offen: [], offenZahl: 0, naechsterPunkt: { id: 'lauf:1' } })
    expect(sicht.auswahl).toEqual([P1, 'par_2'])
  })

  it('Fassung 2 (E2): zur Wahl, zurückgestellt, „Boot fehlt“, Klassen, Einstiege – alles aus der Lage', () => {
    let s = reducer(imBetrieb(), { type: 'BETRIEB_ZURUECKSTELLEN', bereich: P1, ref: m('e2', 1) })
    s = reducer(s, { type: 'BETRIEB_AUSSETZEN', bereich: P1, klasse: 'E', an: true })
    const sicht = sichtOeffentlich(s)
    const b = sicht.bereiche[0]
    expect(sicht.sv).toBeGreaterThanOrEqual(2)
    expect(b.begonnen).toEqual(['lauf:1'])
    expect(b.zurueckgestellt.map((x) => x.key)).toEqual([m('e2', 1)])
    expect(b.bootFehlt.map((x) => x.key)).toEqual([m('e1', 2), m('e2', 2), m('e1', 3), m('e2', 3)])
    // Zur Wahl: alle offenen Starts aller Läufe, ohne Zurückgestellte und ohne „Boot fehlt“.
    expect(b.waehlbar.map((x) => x.key)).toEqual([m('k2', 1), m('k1', 2), m('k2', 2), m('k1', 3), m('k2', 3)])
    expect(b.arbeitsPunkt?.id).toBe('lauf:1')
    // Das ganze Programm, für „vor/nach Lauf n“ und „Einsteigen ab …“ – auch die nicht begonnenen Läufe.
    expect(b.programm.map((p) => [p.id, p.titel, p.laeufe])).toEqual([
      ['lauf:1', '1. Lauf', [1]],
      ['lauf:2', '2. Lauf', [2]],
      ['lauf:3', '3. Lauf', [3]],
    ])
    expect(b.klassenFolge).toEqual([
      { klasse: '1', offen: 1, ausgesetzt: false, verschiebbar: false },
      { klasse: 'E', offen: 0, ausgesetzt: true, verschiebbar: false },
    ])
    expect([b.vorziehen, b.abweichend]).toEqual([true, false])
    // Einsteigen: je Lauf der erste nicht gezeigte Start, auch je Klasse.
    expect(b.einstieg.filter((x) => x.punkt === 'lauf:2').map((x) => [x.klasse, x.key])).toEqual([
      [null, m('e1', 2)],
      ['E', m('e1', 2)],
      ['1', m('k1', 2)],
    ])
    expect(b.einstieg.find((x) => x.punkt === 'lauf:1' && x.klasse === null)?.key).toBe(m('e2', 1))
    // Als Start, mit Starter und Lauf – die Start-Freigabe nennt ihn auch, wenn er schon „ohne Anzeige“ erledigt ist.
    expect(b.einstieg[0]).toEqual({ key: m('e2', 1), starter: 'e2', lauf: 1, punkt: 'lauf:1', titel: '1. Lauf', klasse: null })
    const spaet = reducer(s, { type: 'BETRIEB_AB', bereich: P1, ref: m('e1', 3) })
    const ohne = sichtOeffentlich(spaet).bereiche[0]
    expect(ohne.einstieg.find((x) => x.punkt === 'lauf:1' && x.klasse === 'E')).toMatchObject({ key: m('e2', 1), starter: 'e2', lauf: 1 })
    // Ein entfallener Start (X) ist kein Einstieg: „Weiter mit“ nennte sonst einen, der nicht fährt.
    const x = reducer(s, { type: 'SET_EINGABEN', zellen: [{ lauf: laufSchluessel('manoevrieren', 2), starter: 'e1', feld: 'disq@steg', wert: 'X' }] })
    expect(sichtOeffentlich(x).bereiche[0].einstieg.filter((e) => e.punkt === 'lauf:2').map((e) => [e.klasse, e.key])).toEqual([
      [null, m('k1', 2)],
      ['1', m('k1', 2)],
      ['E', m('e2', 2)],
    ])
  })

  it('Fassung 3 (E3): Startabstand je Klasse und „am Steg“/„vor Steg“ – zeitunabhängig, gemessen oder Vorgabe', () => {
    const sicht = sichtOeffentlich(imBetrieb())
    expect(sicht.sv).toBeGreaterThanOrEqual(3)
    expect(sicht.einst).toEqual({ davor: true, parcoursName: true, amSteg: 2, vorSteg: 2 })
    // Eine Messung (E: 60 s) ist zu wenig – es gilt die Vorgabe aus einstellungen.yaml, für jede Klasse der Sicht.
    expect(sicht.abstaende).toEqual({ E: 120, '1': 110, '4': 120, '5': 135 })
    expect(Object.keys(sicht.abstaende).sort()).toEqual(Object.keys(sicht.klassen).sort())
    // Eigener Wert der Veranstaltung vor der Vorgabe.
    expect(sichtOeffentlich(reducer(imBetrieb(), { type: 'SET_ANZEIGE', patch: { abstaende: { E: 95 } } })).abstaende.E).toBe(95)
    // Ab drei Messungen das gemessene Mittel: E bekommt die Abstände e1→k1 (60 s), e2→k2 (70 s), e1→k1 in Lauf 2 (80 s).
    let s = zeigeNaechsten(imBetrieb(), P1, 141_000) // k1 → e2: 80 s für Klasse 1
    s = zeigeNaechsten(s, P1, 211_000) // e2 → k2: 70 s für E
    s = reducer(s, { type: 'BETRIEB_BEGINNEN', bereich: P1, punkt: 'lauf:2' })
    s = zeigeNaechsten(zeigeNaechsten(s, P1, 311_000), P1, 391_000) // k2 → e1: über die Laufgrenze, zählt nicht; e1 → k1: 80 s für E
    expect(sichtOeffentlich(s).abstaende).toMatchObject({ E: 70, '1': 110 })
  })

  it('Fassung 5: die Lage von Racecourse A und B in `einst` – nur mit dem Parallelslalom, nie in der Zuschauersicht', () => {
    // DM: kein Parallelslalom – also auch keine Lage, nicht einmal ihr Name (Schlüssel-Durchlauf).
    const dm = sichtOeffentlich(imBetrieb())
    // Fassung 6 (21.11.2026): SichtPaar ohne `finale`, das Kleine Finale ist eine eigene Runde. Fassung 7 (26.11.2026,
    // R11-11): Wiederholung nach Ausfall – SichtBereich.wiederholung, SichtStart.wiederholung/abgebrochen. Fassung 8
    // (27.11.2026, R13-01): SichtBereich.gefahren in jeder Sicht.
    expect(dm.sv).toBe(8)
    expect(Object.keys(dm.einst).sort()).toEqual(['amSteg', 'davor', 'parcoursName', 'vorSteg'])
    expect(schluessel(dm).has('parallelAnordnung')).toBe(false)
    // UIM mit Parallelslalom: die Einstellung (Vorgabe A links) – auch entfernte Anzeigetafeln (ab E6) lesen nur die Sicht.
    const uim = uimParallelStand()
    expect(sichtOeffentlich(uim).einst).toEqual({ davor: true, parcoursName: true, amSteg: 2, vorSteg: 2, parallelAnordnung: 'a-links' })
    const sicht = sichtOeffentlich(reducer(uim, { type: 'SET_ANZEIGE', patch: { parallelAnordnung: 'b-oben' } }))
    expect(sicht.einst.parallelAnordnung).toBe('b-oben')
    // Die Zuschauerliste nennt A und B auf ihren Karten; die Lage der Tafel gehört nicht in den öffentlichen Link.
    const z = sichtZuschauer(sicht)
    expect(Object.keys(z.einst).sort()).toEqual(['amSteg', 'parcoursName', 'vorSteg'])
    expect(schluessel(z).has('parallelAnordnung')).toBe(false)
    expect(JSON.stringify(z)).not.toContain('b-oben')
  })

  it('Fassung 7 (R11-11, 26.11.2026): Wiederholung nach Ausfall – `wiederholung` je Bereich, Kennzeichen am Start; kein Wert, kein Grund, nichts davon in der Zuschauersicht', () => {
    const s0 = imBetrieb()
    const s = reducer(s0, { type: 'WIEDERHOLUNG_AUSFALL', bereich: P1, ref: m('k1', 1), zeit: 70_000 })
    const sicht = sichtOeffentlich(s)
    expect(sicht.sv).toBe(8)
    const b = sicht.bereiche[0]
    // Jeder Bereich trägt die Listen (auch leer); `gefahren` seit Fassung 8 (R13-01) ebenso – ohne den abgebrochenen.
    expect(sicht.bereiche.map((x) => x.wiederholung.length)).toEqual([1, 0])
    expect(sicht.bereiche.map((x) => x.gefahren.map((g) => g.key))).toEqual([[m('e1', 1)], []])
    // `abbrueche` (sv 8, Prüfbefund 27.11.2026): die Zahl der Abbrüche – die Start-Freigabe bindet ihre Actions daran.
    expect(b.wiederholung[0]).toEqual({ key: m('k1', 1), starter: 'k1', lauf: 1, punkt: 'lauf:1', titel: '1. Lauf · Wiederholung', wiederholung: true, abbrueche: 1 })
    expect(b.aktuell).toEqual({ key: m('k1', 1), starter: 'k1', lauf: 1, punkt: 'lauf:1', titel: '1. Lauf', abgebrochen: true })
    // Datenschutz wie immer: Die verworfenen Werte und ihr Grund stehen nirgends.
    const text = JSON.stringify(sicht)
    for (const verboten of [GEHEIM, '41.7', 'Ausfall']) expect(text).not.toContain(verboten)
    // Zuschauer: dieselben Schlüssel wie ohne Wiederholung – nur der Titel sagt es (nach dem Einreihen).
    const eingereiht = reducer(s, { type: 'BETRIEB_EINREIHEN', bereich: P1, ref: m('k1', 1), wo: 'naechster' })
    const z = sichtZuschauer(sichtOeffentlich(eingereiht))
    expect(schluessel(z)).toEqual(schluessel(sichtZuschauer(sichtOeffentlich(s0))))
    expect(z.bereiche[0].frei[0].titel).toBe('1. Lauf · Wiederholung')
    // Die Zahl der Abbrüche steht in der Wahl (nach erneutem Zeigen) und nie in der Zuschauersicht.
    const wieder = zeigeNaechsten(eingereiht, P1, 80_000)
    expect(sichtOeffentlich(wieder).bereiche[0].gefahren[0]).toMatchObject({ key: m('k1', 1), wiederholung: true, abbrueche: 1 })
    expect(schluessel(sichtZuschauer(sichtOeffentlich(wieder))).has('abbrueche')).toBe(false)
  })

  it('Fassung 8 (R13-01, 27.11.2026): `gefahren` in jeder Sicht – Starts wie alle anderen, ohne Abmeldungen; nie in der Zuschauersicht', () => {
    const s = imBetrieb()
    const sicht = sichtOeffentlich(s)
    expect(sicht.sv).toBe(8)
    const b = sicht.bereiche[0]
    expect(b.gefahren).toEqual([
      { key: m('k1', 1), starter: 'k1', lauf: 1, punkt: 'lauf:1', titel: '1. Lauf' },
      { key: m('e1', 1), starter: 'e1', lauf: 1, punkt: 'lauf:1', titel: '1. Lauf' },
    ])
    // Eine Abmeldung ändert an `gefahren` nichts und steht nirgends in der Sicht (die Wahl graut sie nur am Bedienrechner
    // bzw. über die Freigabe-Gruppe aus).
    const ab = sichtOeffentlich({ ...s, abgemeldet: ['k1'] })
    expect(ab.bereiche[0].gefahren).toEqual(b.gefahren)
    expect(JSON.stringify(ab)).not.toMatch(/abgemeldet|ausfallGesperrt/)
    expect(schluessel(sichtZuschauer(sicht)).has('gefahren')).toBe(false)
  })

  it('R13-02 (27.11.2026): Wiederholung im Parallelslalom – dieselben Schlüssel wie im Manövrieren, nur ein Boot = andere Seite `null`', () => {
    let s0 = reducer(uimParallelStand(), { type: 'BETRIEB_BEGINNEN', bereich: 'parallel', punkt: 'runde:pre', zeit: 500 })
    s0 = zeigeNaechsten(zeigeNaechsten(s0, 'parallel', 1000), 'parallel', 2000)
    const key = s0.betrieb.bereiche.parallel.gezeigt[0].ref
    const s = reducer(s0, { type: 'WIEDERHOLUNG_AUSFALL', bereich: 'parallel', ref: key, nur: 'b', zeit: 9000 })
    const sicht = sichtOeffentlich(s)
    expect(sicht.sv).toBe(8)
    const b = sicht.bereiche.find((x) => x.id === 'parallel')!
    const [, , , a, bId] = JSON.parse(key) as [string, string, number, string, string]
    expect(b.wiederholung).toEqual([{ key, starter: bId, lauf: 1, punkt: 'runde:pre', titel: 'Preliminary heat · Attempt 1 · Repeat', paar: { attempt: 1, a: null, b: bId }, wiederholung: true, abbrueche: 1 }])
    expect(a).not.toBeNull()
    // Dieselben Schlüssel wie im Manövrieren mit Wiederholung (seit sv 7); die Zuschauersicht ohne neues Feld.
    const eingereiht = reducer(s, { type: 'BETRIEB_EINREIHEN', bereich: 'parallel', ref: key, wo: 'naechster' })
    const z = sichtZuschauer(sichtOeffentlich(eingereiht))
    expect(schluessel(z)).toEqual(schluessel(sichtZuschauer(sichtOeffentlich(s0))))
    expect(z.bereiche.find((x) => x.id === 'parallel')!.frei[0]).toMatchObject({ titel: 'Preliminary heat · Attempt 1 · Repeat', paar: { attempt: 1, a: null, b: bId } })
  })

  it('Zuschauersicht: nur Im Boot, die offene Folge der begonnenen Läufe, „Boot fehlt“ und Meldung – keine Bedienangaben', () => {
    const z = sichtZuschauer(sichtOeffentlich(imBetrieb()))
    // Schlüssel-Durchlauf: genau diese Felder, nichts von der Start-Freigabe.
    expect(Object.keys(z).sort()).toEqual(['abstaende', 'bereiche', 'einst', 'klassen', 'kopf', 'sprache', 'starter', 'sv'])
    expect(Object.keys(z.bereiche[0]).sort()).toEqual(['aktuell', 'art', 'bootFehlt', 'frei', 'id', 'meldung', 'naechsterPunkt', 'name', 'punkt', 'seit'])
    expect(Object.keys(z.einst).sort()).toEqual(['amSteg', 'parcoursName', 'vorSteg'])
    const alle = schluessel(z)
    for (const verboten of ['geburtsdatum', 'gewicht', 'geschlecht', 'eingaben', 'abgemeldet', 'vorname', 'nachname', 'veranstaltung', 'logos', 'auswahl', 'skala', 'vorig', 'offen', 'offenZahl', 'waehlbar', 'zurueckgestellt', 'nachzuholen', 'einstieg', 'klassenFolge', 'programm', 'arbeitsPunkt', 'begonnen', 'vorziehen', 'abweichend', 'fest'])
      expect(alle.has(verboten), verboten).toBe(false)
    const text = JSON.stringify(z)
    for (const verboten of [GEHEIM, '41.7', '83.4']) expect(text).not.toContain(verboten)
    // Lauf 1 auf Parcours 1: k1 im Boot, e2 und k2 frei; e1 kommt erst in Lauf 2 wieder, Parcours 2 hat nicht begonnen.
    const b = z.bereiche[0]
    expect([b.aktuell?.key, b.seit, b.frei.map((x) => x.key), b.punkt?.id, b.naechsterPunkt?.id]).toEqual([m('k1', 1), 61_000, [m('e2', 1), m('k2', 1)], 'lauf:1', 'lauf:2'])
    expect(z.bereiche[1]).toMatchObject({ id: 'par_2', aktuell: null, frei: [], punkt: null })
    expect(Object.keys(z.starter).sort()).toEqual(['e2', 'k1', 'k2'])
    expect(z.starter.k1).toEqual(sichtOeffentlich(imBetrieb()).starter.k1)
    expect([Object.keys(z.klassen).sort(), z.abstaende]).toEqual([['1', 'E'], { E: 120, '1': 110 }])
  })

  it('Zuschauersicht: genaue Schlüssel auch verschachtelt – ein neues Feld der öffentlichen Sicht kommt nicht still hinein', () => {
    let s = reducer(imBetrieb(), { type: 'BETRIEB_AUSSETZEN', bereich: P1, klasse: 'E', an: true })
    s = reducer(s, { type: 'BETRIEB_MELDUNG', bereich: P1, meldung: { text: 'Kurze Störung', art: 'stoerung' } })
    // Herkunft mit Flagge, damit auch deren Teile geprüft werden.
    s = { ...s, starters: s.starters.map((p) => ({ ...p, bundesland: 'Bayern' })) }
    s = reducer(s, { type: 'SET_ORIGIN_MODE', originMode: 'bundesland' })
    s = reducer(s, { type: 'SET_ANZEIGE', patch: { herkunft: 'flagge-lang' } })
    const oeffentlich = sichtOeffentlich(s)
    const z = sichtZuschauer(oeffentlich)
    const b = z.bereiche[0]
    const genau = (wert: object | null | undefined, erwartet: string[], wo: string) => expect(Object.keys(wert ?? {}).sort(), wo).toEqual(erwartet)
    const START = ['key', 'lauf', 'punkt', 'starter', 'titel']
    for (const x of [b.aktuell, ...b.frei, ...b.bootFehlt]) genau(x, START, 'Start')
    expect([b.frei.length, b.bootFehlt.length]).toEqual([1, 1])
    for (const p of [b.punkt, b.naechsterPunkt]) genau(p, ['id', 'laeufe', 'titel'], 'Punkt')
    genau(b.meldung, ['art', 'text'], 'Meldung')
    for (const k of Object.values(z.klassen)) genau(k, ['farbe', 'name', 'titel'], 'Klasse')
    for (const p of Object.values(z.starter)) {
      genau(p, ['herkunft', 'klasse', 'name', 'startNr'], 'Starter')
      // Herkunft mit Flagge (Bundesland): genau ihre Teile.
      genau(p.herkunft, ['alt', 'druck', 'flagge', 'klartext', 'text'], 'Herkunft')
      genau(p.herkunft?.flagge, ['art', 'code', 'kuerzel'], 'Flagge')
    }
    // Ein Feld, das die öffentliche Sicht verschachtelt dazubekäme (etwa nur für die Start-Freigabe), bleibt draußen.
    const mehr = structuredClone(oeffentlich) as OeffentlicheSicht & Record<string, unknown>
    const extra = { nurBedienung: true }
    Object.assign(mehr.starter.k1, extra)
    Object.assign(mehr.starter.k1.herkunft!, extra)
    Object.assign(mehr.klassen['1']!, extra)
    Object.assign(mehr.bereiche[0].aktuell!, extra)
    Object.assign(mehr.bereiche[0].punkt!, extra)
    Object.assign(mehr.bereiche[0].meldung!, extra)
    for (const x of [...mehr.bereiche[0].waehlbar, ...mehr.bereiche[0].bootFehlt]) Object.assign(x, extra)
    expect(schluessel(sichtZuschauer(mehr)).has('nurBedienung')).toBe(false)
    expect(sichtZuschauer(mehr)).toEqual(z)
  })

  it('Zuschauersicht: Zurückgestellte stehen nicht darin, „Boot fehlt“ nur für begonnene Läufe', () => {
    const zurueck = sichtZuschauer(sichtOeffentlich(reducer(imBetrieb(), { type: 'BETRIEB_ZURUECKSTELLEN', bereich: P1, ref: m('e2', 1) })))
    expect(zurueck.bereiche[0].frei.map((x) => x.key)).toEqual([m('k2', 1)])
    expect(zurueck.starter.e2).toBeUndefined()
    const aus = sichtZuschauer(sichtOeffentlich(reducer(imBetrieb(), { type: 'BETRIEB_AUSSETZEN', bereich: P1, klasse: 'E', an: true })))
    expect([aus.bereiche[0].frei.map((x) => x.key), aus.bereiche[0].bootFehlt.map((x) => x.key)]).toEqual([[m('k2', 1)], [m('e2', 1)]])
    // Gleicher Stand ⇒ gleiche Zuschauersicht (der Bildschirm vergleicht nach Inhalt).
    expect(JSON.stringify(sichtZuschauer(sichtOeffentlich(imBetrieb())))).toBe(JSON.stringify(sichtZuschauer(sichtOeffentlich(imBetrieb()))))
  })

  it('Namen nach der Einstellung: wie der Aushang, voll, gekürzt, ohne', () => {
    const mit = (namen: AppState['anzeige']['namen'], s = imBetrieb()) => sichtOeffentlich(reducer(s, { type: 'SET_ANZEIGE', patch: { namen } }))
    expect(name(mit('voll'), 'k1')).toBe('Vork1 Nachk1')
    expect(name(mit('kurz'), 'k1')).toBe('Vork1 N.')
    expect(name(mit('ohne'), 'k1')).toBe('')
    // Vorgabe: wie der Aushang der Wertungslisten.
    expect(imBetrieb().anzeige.namen).toBe('aushang')
    expect(name(mit('aushang'), 'k1')).toBe('Vork1 Nachk1')
    const gekuerzt = reducer(imBetrieb(), { type: 'SET_ERGEBNIS_LISTEN', fassung: 'aushang', patch: { namen: 'kurz' } })
    expect(name(mit('aushang', gekuerzt), 'k1')).toBe('Vork1 N.')
  })

  it('Herkunft nach Stil; „aus“ und Clubmeisterschaft zeigen keine', () => {
    expect(sichtOeffentlich(imBetrieb()).starter.k1.herkunft?.text).toBe('Musterclub')
    expect(sichtOeffentlich(reducer(imBetrieb(), { type: 'SET_ANZEIGE', patch: { herkunft: 'aus' } })).starter.k1.herkunft).toBeNull()
    expect(sichtOeffentlich(reducer(imBetrieb(), { type: 'SET_EVENT_KIND', eventKind: 'club' })).starter.k1.herkunft).toBeNull()
  })

  it('UIM: englisch nach dem Rulebook, Klasse E heißt „Dolphin“', () => {
    const s = imBetrieb('uim-2026')
    const sicht = sichtOeffentlich(s)
    expect(sicht.sprache).toBe('en')
    expect(sicht.klassen.E).toEqual({ name: 'Dolphin', titel: 'Class Dolphin', farbe: expect.any(String) })
    expect(sicht.bereiche[0].name).toBe('Course 1')
    expect(sicht.bereiche[0].aktuell?.titel).toBe('Attempt 1')
    // Als Einstellung deutsch – E bleibt „Dolphin“, der Name hängt am Regelwerk.
    const deutsch = sichtOeffentlich(reducer(s, { type: 'SET_ANZEIGE', patch: { sprache: 'de' } }))
    expect([deutsch.sprache, deutsch.klassen.E?.titel, deutsch.bereiche[0].aktuell?.titel]).toEqual(['de', 'Klasse Dolphin', '1. Lauf'])
    // „Versuche nacheinander“: ein Punkt mit beiden Versuchen.
    const nacheinander = sichtOeffentlich(reducer(s, { type: 'SET_VERSUCHE_NACHEINANDER', on: true }))
    expect(nacheinander.bereiche[0].punkt).toEqual({ id: 'lauf:1', titel: 'Attempt 1 / Attempt 2', laeufe: [1, 2] })
  })

  it('zeitunabhängig und nach Inhalt stabil: Eine Eingabe ändert die Sicht nicht, ein neuer Start schon', () => {
    const s = imBetrieb()
    const vorher = JSON.stringify(sichtOeffentlich(s))
    expect(JSON.stringify(sichtOeffentlich(s))).toBe(vorher)
    const eingabe = reducer(s, { type: 'SET_EINGABEN', zellen: [{ lauf: laufSchluessel('manoevrieren', 1), starter: 'k1', feld: 'zeit1', wert: '90.1' }] })
    expect(eingabe).not.toBe(s)
    expect(JSON.stringify(sichtOeffentlich(eingabe))).toBe(vorher)
    expect(JSON.stringify(sichtOeffentlich(zeigeNaechsten(s, P1, 99_000)))).not.toBe(vorher)
  })

  it('Kopfzeile: Name und Jahr, eigene oder keine', () => {
    expect(sichtOeffentlich(imBetrieb()).kopf).toBe('Musterpokal 2026')
    expect(sichtOeffentlich(reducer(imBetrieb(), { type: 'SET_ANZEIGE', patch: { kopfzeile: '1. Musterregatta' } })).kopf).toBe('1. Musterregatta')
    expect(sichtOeffentlich(reducer(imBetrieb(), { type: 'SET_ANZEIGE', patch: { kopfzeile: '' } })).kopf).toBe('')
    expect(sichtOeffentlich({ ...imBetrieb(), eventName: ' ' }).kopf).toBe('')
  })

  it('Logos nur am Bedienrechner und nur, wenn eingeschaltet', () => {
    const s = reducer(imBetrieb(), { type: 'SET_LOGO', seite: 'links', logo: testLogo() })
    expect(sichtOeffentlich(s).logos).toEqual({ links: testLogo(), rechts: null })
    expect(sichtOeffentlich(s, { logos: false }).logos).toBeUndefined()
    expect(sichtOeffentlich(reducer(s, { type: 'SET_ANZEIGE', patch: { logos: false } })).logos).toBeUndefined()
    expect(sichtOeffentlich(imBetrieb()).logos).toBeUndefined()
  })

  it('ein gezeigter Starter, den es nicht mehr gibt, steht nicht mehr da; Nachzuholende stehen dabei', () => {
    // Ohne erfasste Werte – sonst steht das Starterfeld fest (lib/eingaben.ts `starterfeldFest`).
    let s: AppState = { ...imBetrieb(), eingaben: {} }
    s = reducer(s, { type: 'ADD_STARTERS', starters: [betriebStarter('e0', 'E', 'E00')] })
    const sicht = sichtOeffentlich(s)
    expect(sicht.bereiche[0].nachzuholen.map((n) => n.key)).toEqual([m('e0', 1)])
    expect(sicht.starter.e0?.startNr).toBe('E00')
    const geloescht = reducer(s, { type: 'REMOVE_STARTER', id: 'k1' })
    const ohne = sichtOeffentlich(geloescht)
    // Keine Angaben mehr zum Starter – aber die Kennung des Starts im Boot bleibt (für `vorher`).
    expect(ohne.starter.k1).toBeUndefined()
    expect(ohne.bereiche[0].aktuell?.key).toBe(m('k1', 1))
    expect(JSON.stringify(ohne)).not.toContain('Nachk1')
  })

  it('Starter im Boot gelöscht: „Nächster Start“ über die Sicht geht weiter, „Zurück“ auch (Prüfung E1)', () => {
    let s: AppState = { ...imBetrieb(), eingaben: {} }
    s = reducer(s, { type: 'REMOVE_STARTER', id: 'k1' })
    // Die Verzahnung ist ohne k1 neu gerechnet; der Nächste ist, was sie jetzt sagt.
    const naechster = sichtOeffentlich(s).bereiche[0].offen[0].key
    const weiter = zeigeNaechsten(s, P1, 90_000)
    expect(weiter).not.toBe(s)
    const b = sichtOeffentlich(weiter).bereiche[0]
    expect([b.aktuell?.key, b.vorig?.key]).toEqual([naechster, m('k1', 1)])
    // „Zurück“ nimmt den gelöschten Start aus dem Verlauf, der davor steht wieder im Boot.
    const zurueck = reducer(s, { type: 'BETRIEB_ZURUECK', bereich: P1, ref: sichtOeffentlich(s).bereiche[0].aktuell!.key })
    expect(sichtOeffentlich(zurueck).bereiche[0].aktuell?.key).toBe(m('e1', 1))
  })
})
