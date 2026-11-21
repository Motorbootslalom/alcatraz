import { describe, expect, it } from 'vitest'
import { reducer } from '../state/reducer'
import { configFor } from '../config/konfig'
import { lage, refKey } from '../betrieb/folge'
import { sichtOeffentlich, sichtZuschauer } from '../betrieb/sicht'
import { BETRIEB_STARTER, betriebStarter, uimParallelStand, wkrBetriebsStand, zeigeNaechsten } from '../testHilfen'
import type { AppState, WkrZeile } from '../types'
import { LISTEN_SICHT_FASSUNG, maskenJeKlasse, sichtListe, type ListenSicht, type ListenSichtExtra } from './sicht'
import { listenKennung, type Liste } from './liste'
import { pruefeZeile, type GeraeteZeile } from './zeile'
import { listenFelder } from '../lib/eingaben'
import { deflateRawSync } from 'node:zlib'

// Die Sicht einer Liste (Plan §3.1, §6): genaue Schlüssel (Positivliste wie betrieb/sicht.test.ts), Datenschutz über
// alle Schlüssel und Werte, `steht` nur für das Gerät mit der Rückfrage, Listensprache (DM deutsch, UIM englisch),
// Klasse ohne Liste → null, Parallelslalom nur die eigene Seite, F17: Tafel und Zuschauer merken nichts von den Werten.
// Nur erfundene Starter (Vor<id>/Nach<id>, Musterclub); Geburtsdatum, Gewicht und Geschlecht stehen nur hier, um zu
// prüfen, dass sie draußen bleiben.

const DM = configFor({ regelwerk: 'dm-2026' })
const UIM = configFor({ regelwerk: 'uim-2026' })
const P1 = 'par_1'
const GEHEIM = '2014-02-03'
const L = (typeId: string): Liste => ({ bereich: P1, typeId, racecourse: null })
const K = (typeId: string) => listenKennung(L(typeId))
const EXTRA: ListenSichtExtra = { geraete: { g1: { bis: 7 }, g2: { bis: 3 } } }

/** DM-Stand mit Geheimnissen, Liste(n) digital (zeit 100), zwei Starts gezeigt. */
function bereit(...typeIds: string[]): { s: AppState; erste: string[] } {
  const starter = BETRIEB_STARTER.map((p) => ({ ...p, geburtsdatum: GEHEIM, gewicht: 41.7, geschlecht: 'F' as const }))
  let s = wkrBetriebsStand(starter)
  s = { ...s, boote: { ...s.boote, E: 'Boot Musterwerft' } }
  for (const t of typeIds) s = reducer(s, { type: 'WKR_LISTE', liste: K(t), modus: 'digital', zeit: 100 })
  s = zeigeNaechsten(zeigeNaechsten(s, P1, 1000), P1, 1100)
  return { s, erste: s.betrieb.bereiche[P1].gezeigt.map((g) => JSON.parse(g.ref)[1] as string) }
}

const m = (starter: string, lauf = 1) => refKey({ art: 'm', starter, lauf })

function zeile(s: AppState, typeId: string, starter: string, c: GeraeteZeile['c'], geraet = 'g1', z = 1, teil?: 'ab' | 'an'): WkrZeile {
  const r = pruefeZeile(s, DM, L(typeId), teil, geraet, { z, s: m(starter), c })
  if ('fehler' in r) throw new Error(r.fehler)
  return r
}

/** Die Masken einer Liste für Klassen, die der Teststand nicht fährt (Bojen der Klasse 7), mit Beschriftung. */
const masken = (typeId: string, klasse: '5' | '7', beschriftung?: string) =>
  maskenJeKlasse(DM, configFor({ regelwerk: 'dm-2026', ...(beschriftung ? { beschriftung } : {}) }), typeId, [klasse], false)[klasse]!.felder!

const sende = (s: AppState, typeId: string, zeilen: WkrZeile[], geraet = 'g1') => reducer(s, { type: 'WKR_ZEILEN', liste: K(typeId), quelle: { geraet, name: 'Handy Tor 1' }, zeilen, zeit: 5000 })

/** Alle Schlüssel eines Werts, auch verschachtelt (ohne die Schlüssel der Maps `klassen` und `geraete`). */
function schluessel(wert: unknown, out = new Set<string>()): Set<string> {
  if (Array.isArray(wert)) wert.forEach((w) => schluessel(w, out))
  else if (wert && typeof wert === 'object')
    for (const [k, v] of Object.entries(wert)) {
      out.add(k)
      schluessel(v, out)
    }
  return out
}

/** Alle Texte und Zahlen eines Werts. */
function blaetter(wert: unknown, out: unknown[] = []): unknown[] {
  if (Array.isArray(wert)) wert.forEach((w) => blaetter(w, out))
  else if (wert && typeof wert === 'object') Object.values(wert).forEach((w) => blaetter(w, out))
  else out.push(wert)
  return out
}

describe('Sicht der Liste – Form', () => {
  it('genaue Schlüssel, auch verschachtelt (Positivliste – ein neues Feld ist eine bewusste Entscheidung)', () => {
    const { s, erste } = bereit('steg')
    let mit = sende(s, 'steg', [zeile(s, 'steg', erste[0], [], 'g1', 1, 'ab')])
    // Eine Zelle des Ablegens, die der Bediener schon anders belegt hat → Rückfrage für g1.
    const klasse = mit.starters.find((p) => p.id === erste[1])!.klasse
    const feld = listenFelder(DM, 'steg', klasse).find((f) => f.kind === 'code' && f.zelle.startsWith('fehlerAB'))!
    const [c1, c2] = feld.katalog!.map((e) => e.code)
    mit = reducer(mit, { type: 'SET_EINGABEN', zellen: [{ lauf: 'manoevrieren/1', starter: erste[1], feld: feld.kennung, wert: c1 }] })
    mit = sende(mit, 'steg', [zeile(mit, 'steg', erste[1], [[feld.kennung, c2, '']], 'g1', 2)])
    const sicht = sichtListe(mit, DM, L('steg'), { geraete: { g1: { bis: 2, abgelehnt: [{ z: 3, grund: 'feld-fremd' }], hinweise: [{ id: 1, code: 'pruefen', startNr: '101' }] } } })
    expect(Object.keys(sicht).sort()).toEqual(['abgeschlossen', 'bereich', 'danach', 'geraete', 'klassen', 'liste', 'lv', 'modus', 'punkt', 'schlange', 'sprache', 'status', 'teile', 'titel'])
    expect(sicht.lv).toBe(LISTEN_SICHT_FASSUNG)
    expect(Object.keys(sicht.punkt!).sort()).toEqual(['id', 'titel'])
    // Teile (Steg, F16): je Teil nur Status und abgeschlossene Punkte.
    expect(sicht.teile).toEqual({ ab: { status: 'aktiv', abgeschlossen: [] }, an: { status: 'aktiv', abgeschlossen: [] } })
    const startSchluessel = new Set(['key', 'startNr', 'klasse', 'titel', 'lauf', 'seite', 'boot', 'teile', 'entfaellt', 'vorab', 'ab', 'an'])
    for (const k of schluessel([...sicht.schlange, ...sicht.danach])) expect(startSchluessel.has(k), k).toBe(true)
    const feldSchluessel = new Set(['titel', 'felder', 'kennung', 'kind', 'label', 'teil', 'katalog', 'disq', 'code', 'punkte', 'text'])
    for (const k of schluessel(Object.values(sicht.klassen))) expect(feldSchluessel.has(k), k).toBe(true)
    expect(Object.keys(sicht.geraete)).toEqual(['g1'])
    const g = sicht.geraete.g1
    expect(Object.keys(g).sort()).toEqual(['abgelehnt', 'bis', 'hinweise', 'rueckfragen'])
    expect(g.rueckfragen).toEqual([{ z: '2', feld: feld.kennung, lauf: 'manoevrieren/1', steht: c1 }])
    expect(g.abgelehnt).toEqual([{ z: '3', grund: 'feld-fremd' }])
    expect(g.hinweise).toEqual([{ id: 1, code: 'pruefen', startNr: '101' }])
  })

  it('Kopf: Titel und Bereich in der Listensprache, Modus/Status, Punkt; Schlange mit Startnummer, Lauf, Boot, Steg-Teilen', () => {
    const { s, erste } = bereit('steg')
    const ohne = sichtListe(s, DM, L('steg'), EXTRA)
    expect([ohne.titel, ohne.bereich, ohne.sprache, ohne.modus, ohne.status, ohne.punkt]).toEqual([DM.getSheetDef('steg').title, 'Parcours 1', 'de', 'digital', 'aktiv', { id: 'lauf:1', titel: '1. Lauf' }])
    expect(ohne.schlange.map((x) => x.key)).toEqual(erste.map((id) => m(id)))
    const erster = s.starters.find((p) => p.id === erste[0])!
    expect(ohne.schlange[0]).toMatchObject({ startNr: erster.startNr, klasse: erster.klasse, titel: '1. Lauf', lauf: 'manoevrieren/1', teile: { ab: false, an: false } })
    expect(ohne.schlange.find((x) => x.klasse === 'E')!.boot).toBe('Boot Musterwerft')
    // Ablegen erfasst: Der Start bleibt (Anlegen fehlt), der Teil steht als erledigt da.
    const ab = sende(s, 'steg', [zeile(s, 'steg', erste[0], [], 'g1', 1, 'ab')])
    expect(sichtListe(ab, DM, L('steg'), EXTRA).schlange[0].teile).toEqual({ ab: true, an: false })
    // Danach: die nächsten freien als Schätzung, höchstens fünf.
    expect(ohne.danach.length).toBeGreaterThan(0)
    expect(ohne.danach.length).toBeLessThanOrEqual(5)
    // Ohne Eintrag: Papier, Schlange leer.
    const papier = sichtListe(s, DM, L('gate135'), EXTRA)
    expect([papier.modus, papier.schlange]).toEqual(['papier', []])
  })

  it('Masken je Klasse: Klasse ohne Liste → null; Katalog mit Punkten und Text; X nur am Steg-Ablegen und Vorsteg (F5)', () => {
    const { s } = bereit('mueb', 'steg', 'gate135')
    const mueb = sichtListe(s, DM, L('mueb'), EXTRA)
    const klassen = Object.keys(mueb.klassen)
    expect(klassen.length).toBeGreaterThan(1)
    for (const k of klassen) expect(mueb.klassen[k as '1']!.felder === null, k).toBe(!DM.positionAllowsClass('mueb', k))
    expect(Object.values(mueb.klassen).some((k) => k!.felder === null)).toBe(true)
    expect(mueb.klassen.E!.titel).toBe('Klasse E')

    const steg = sichtListe(s, DM, L('steg'), EXTRA)
    const felder = steg.klassen['1']!.felder!
    const code = felder.find((f) => f.kind === 'code' && f.teil === 'ab')!
    expect(code.katalog!.length).toBeGreaterThan(0)
    expect(Object.keys(code.katalog![0]).sort()).toEqual(['code', 'punkte', 'text'])
    expect(felder.some((f) => f.teil === 'an')).toBe(true)
    const disq = felder.find((f) => f.kind === 'disq')!
    expect(disq.teil).toBeUndefined()
    expect(disq.disq!.map((d) => d.code)).toContain('X')
    expect(felder.find((f) => f.kind === 'code' && f.teil === 'an')!.disq!.map((d) => d.code)).not.toContain('X')
    const tor = sichtListe(s, DM, L('gate135'), EXTRA).klassen['1']!.felder!
    for (const f of tor) expect((f.disq ?? []).map((d) => d.code), f.kennung).not.toContain('X')
  })
})

describe('Sicht der Liste – Datenschutz', () => {
  it('nie Name, Herkunft, Geburtsdatum, Gewicht, Geschlecht, Werte, Summen, Wertung – auch nicht der eigenen Liste', () => {
    const { s, erste } = bereit('gate135', 'steg')
    let mit = sende(s, 'gate135', [zeile(s, 'gate135', erste[0], [['t1a|hin seiteA', '5', '']])])
    // Werte anderer Listen und anderer Starter.
    mit = reducer(mit, { type: 'SET_EINGABEN', zellen: [{ lauf: 'manoevrieren/1', starter: erste[1], feld: 'zeit1', wert: '83.4' }, { lauf: 'manoevrieren/1', starter: erste[1], feld: 'bemerkung@steg', wert: 'Geheimbemerkung' }] })
    for (const typeId of ['gate135', 'steg']) {
      const sicht = sichtListe(mit, DM, L(typeId), EXTRA)
      const alle = schluessel(sicht)
      for (const verboten of ['name', 'vorname', 'nachname', 'herkunft', 'verein', 'club', 'geburtsdatum', 'gewicht', 'geschlecht', 'eingaben', 'werte', 'summe', 'punkteSumme', 'platz', 'wertung', 'wkr', 'einteilung', 'coPiloten'])
        expect(alle.has(verboten), `${typeId}: ${verboten}`).toBe(false)
      const werte = blaetter(sicht).map(String)
      for (const p of mit.starters) {
        for (const verboten of [p.vorname, p.nachname, `${p.vorname} ${p.nachname}`]) expect(werte, verboten).not.toContain(verboten)
      }
      const text = JSON.stringify(sicht)
      for (const verboten of [GEHEIM, '41.7', '83.4', 'Geheimbemerkung', 'Musterclub', 'Handy Tor 1', 'Vor', 'Nach']) expect(text, `${typeId}: ${verboten}`).not.toContain(verboten)
    }
  })

  it('`steht` nur für das Gerät, dessen Zeile die Rückfrage ausgelöst hat – und nur der Wert dieser Zelle', () => {
    const { s, erste } = bereit('gate135')
    let mit = reducer(s, { type: 'SET_EINGABEN', zellen: [{ lauf: 'manoevrieren/1', starter: erste[0], feld: 't1a|hin seiteA', wert: '10' }, { lauf: 'manoevrieren/1', starter: erste[0], feld: 't3a|hin seiteA', wert: '15' }] })
    mit = sende(mit, 'gate135', [zeile(mit, 'gate135', erste[0], [['t1a|hin seiteA', '5', '']], 'g1', 4)])
    expect(mit.wkr.rueckfragen).toHaveLength(1)
    const sicht = sichtListe(mit, DM, L('gate135'), EXTRA)
    expect(sicht.geraete.g1.rueckfragen).toEqual([{ z: '4', feld: 't1a|hin seiteA', lauf: 'manoevrieren/1', steht: '10' }])
    expect(sicht.geraete.g2.rueckfragen).toEqual([])
    expect(sicht.geraete.g2.bis).toBe(3)
    // Der andere Wert desselben Starters steht nirgends.
    expect(JSON.stringify(sicht)).not.toContain('15')
    // Ein Gerät, das der Host nicht nennt, steht nicht in der Sicht – auch nicht mit seiner Rückfrage.
    expect(sichtListe(mit, DM, L('gate135'), { geraete: { g2: { bis: 1 } } }).geraete).toEqual({ g2: { bis: 1, rueckfragen: [], abgelehnt: [], hinweise: [] } })
    // Rückfragen anderer Listen kommen nicht herein.
    expect(sichtListe(mit, DM, L('tor5'), EXTRA).geraete.g1.rueckfragen).toEqual([])
  })

  it('Abschluss: abgeschlossene Punkte und abweichende Starts je Gerät', () => {
    const { s, erste } = bereit('gate135')
    let mit = sende(s, 'gate135', erste.map((id, i) => zeile(s, 'gate135', id, [], 'g1', i + 1)))
    mit = reducer(mit, { type: 'WKR_ABSCHLUSS', liste: K('gate135'), punkt: 'lauf:1', name: 'Vorname Muster', pruefsummen: { [m(erste[0])]: 'falsch' }, restPapier: true, zeit: 6000 })
    const sicht = sichtListe(mit, DM, L('gate135'), EXTRA)
    expect(sicht.abgeschlossen).toEqual(['lauf:1'])
    expect(sicht.geraete.g1.abweichend).toEqual([m(erste[0])])
    // Der Name des Wettkampfrichters bleibt am Bedienrechner.
    expect(JSON.stringify(sicht)).not.toContain('Vorname Muster')
  })

  it('Referenzen werden nicht durchgereicht: Ändern der Sicht ändert den Stand nicht', () => {
    const { s } = bereit('steg')
    const vorher = JSON.stringify(s)
    const sicht: ListenSicht = sichtListe(s, DM, L('steg'), EXTRA)
    sicht.klassen['1']!.felder![0].label = 'kaputt'
    sicht.klassen['1']!.felder!.find((f) => f.katalog)!.katalog![0].text = 'kaputt'
    expect(JSON.stringify(s)).toBe(vorher)
    expect(JSON.stringify(sichtListe(s, DM, L('steg'), EXTRA))).not.toContain('kaputt')
  })
})

describe('Sicht der Liste – Sprache (F13)', () => {
  it('DM deutsch, UIM englisch; zweisprachig, wo die WKR-Einteilung es wählt', () => {
    const { s } = bereit('steg')
    expect(sichtListe(s, DM, L('steg'), EXTRA).sprache).toBe('de')
    let u = uimParallelStand()
    u = reducer(u, { type: 'BETRIEB_BEGINNEN', bereich: 'parallel', punkt: 'runde:pre', zeit: 500 })
    const A: Liste = { bereich: 'parallel', typeId: 'steg', racecourse: 'A' }
    const sicht = sichtListe(u, UIM, A, EXTRA)
    expect([sicht.sprache, sicht.bereich, sicht.titel, sicht.punkt]).toEqual(['en', 'Racecourse A', 'Pontoon', { id: 'runde:pre', titel: 'Preliminary heat' }])
    expect(sicht.klassen.E!.titel).toBe('Class Dolphin')
    const zwei = sichtListe({ ...u, wkrSprachen: { 'racecourse-a': { steg: 'de+en' } } }, UIM, A, EXTRA)
    expect(zwei.sprache).toBe('de+en')
    expect(zwei.bereich).toBe('Parcours A / Racecourse A')
  })

  it('W3: `andere` nur unter UIM (Regelwerk mit [de, en]) – nur Texte, Positivliste; DM ohne', () => {
    const { s } = bereit('steg')
    expect(sichtListe(s, DM, L('steg'), EXTRA).andere).toBeUndefined()
    let u = uimParallelStand()
    u = reducer(u, { type: 'BETRIEB_BEGINNEN', bereich: 'parallel', punkt: 'runde:pre', zeit: 500 })
    const A: Liste = { bereich: 'parallel', typeId: 'steg', racecourse: 'A' }
    const sicht = sichtListe(u, UIM, A, EXTRA)
    expect(Object.keys(sicht.andere!).sort()).toEqual(['bereich', 'klassen', 'sprache', 'titel'])
    expect([sicht.andere!.sprache, sicht.andere!.bereich, sicht.andere!.klassen.E!.titel]).toEqual(['de', 'Parcours A', 'Klasse Dolphin'])
    // Dieselben Klassen und Felder wie die Maske, nur Texte (keine Art, kein Teil, keine Punkte).
    expect(Object.keys(sicht.andere!.klassen)).toEqual(Object.keys(sicht.klassen))
    const feldSchluessel = new Set(['titel', 'felder', 'kennung', 'label', 'katalog', 'disq', 'code', 'text'])
    for (const k of schluessel(Object.values(sicht.andere!.klassen))) expect(feldSchluessel.has(k), k).toBe(true)
    const en = sicht.klassen['1']!.felder!
    const de = sicht.andere!.klassen['1']!.felder!
    expect(de.map((f) => f.kennung)).toEqual(en.map((f) => f.kennung))
    const katEn = en.find((f) => f.katalog)!.katalog!
    const katDe = de.find((f) => f.katalog)!.katalog!
    expect(katDe.map((e) => e.code)).toEqual(katEn.map((e) => e.code))
    expect(katDe.map((e) => e.text)).not.toEqual(katEn.map((e) => e.text))
    // X bleibt auch in der anderen Sprache nur, wo F5 es erlaubt.
    expect(de.find((f) => f.kennung === en.find((x) => x.kind === 'code' && x.teil === 'an')!.kennung)!.disq!.map((d) => d.code)).not.toContain('X')
    // Zweisprachige Liste (G9): Maske deutsch, `andere` englisch.
    const zwei = sichtListe({ ...u, wkrSprachen: { 'racecourse-a': { steg: 'de+en' } } }, UIM, A, EXTRA)
    expect([zwei.klassen.E!.titel, zwei.andere!.sprache, zwei.andere!.klassen.E!.titel]).toEqual(['Klasse Dolphin', 'en', 'Class Dolphin'])
    // Plan §8: Mit `andere` bleibt die Sicht komprimiert unter der Inline-Grenze von ntfy (4096 Byte).
    expect(deflateRawSync(Buffer.from(JSON.stringify(sicht))).length).toBeLessThan(4096)
  })
})

describe('Sicht der Liste – Bojen (W4.1, P7, P15)', () => {
  const bojeSchluessel = new Set(['halt', 'weg', 'folge', 'titel', 'unter', 'spalte', 'zaehler', 'durchfahrt'])

  it('Positivliste `boje`: nur Fahrweg-Angaben und Bogentexte, nur an Fahrweg-Bojen; Fassung 5 (seit W4.3)', () => {
    const { s } = bereit('gate135')
    const sicht = sichtListe(s, DM, L('gate135'), EXTRA)
    expect(LISTEN_SICHT_FASSUNG).toBe(5)
    const feldSchluessel = new Set(['titel', 'felder', 'kennung', 'kind', 'label', 'teil', 'katalog', 'disq', 'code', 'punkte', 'text', 'boje', ...bojeSchluessel])
    for (const k of schluessel(Object.values(sicht.klassen))) expect(feldSchluessel.has(k), k).toBe(true)
    let zahl = 0
    for (const k of Object.values(sicht.klassen))
      for (const f of k!.felder ?? []) {
        expect(!!f.boje, f.kennung).toBe(f.kind === 'buoy')
        if (f.boje) {
          for (const x of Object.keys(f.boje)) expect(bojeSchluessel.has(x), x).toBe(true)
          zahl++
        }
      }
    expect(zahl).toBeGreaterThan(10)
    const k7 = masken('gate135', '7')
    expect(k7.find((f) => f.kennung === 't1c|rueck seiteB')!.boje).toEqual({ halt: 't1c', weg: 'rueck', folge: 15, titel: 'Tor 1', unter: 'R L', spalte: 1, durchfahrt: 2 })
    expect(k7.find((f) => f.kennung === 't5|hin seiteA')!.boje).toEqual({ halt: 't5', weg: 'hin', folge: 5, titel: 'Tor 5', unter: 'H R', spalte: 0, zaehler: true })
    expect(k7.find((f) => f.kennung === 'speed2')!.boje).toEqual({ halt: 'speed2', weg: 'rueck', folge: 14, titel: 'Sp. 2', unter: '', spalte: null })
    // Knoten tragen keine Bojen-Angabe (bleiben Papier, P1).
    for (const f of masken('knoten', '5')) expect(f.boje, f.kennung).toBeUndefined()
  })

  it('Spalte nach Blick: gate135 (von hinten) R links, frontal135 (von vorne) L links – wie die Unterspalten des Bogens', () => {
    const spalte = (typeId: string, kennung: string) => masken(typeId, '5').find((f) => f.kennung === kennung)!.boje!
    expect([spalte('gate135', 't1a|hin seiteA').spalte, spalte('gate135', 't1a|hin seiteB').spalte]).toEqual([0, 1])
    expect([spalte('frontal135', 't1a|hin seiteA').spalte, spalte('frontal135', 't1a|hin seiteB').spalte]).toEqual([1, 0])
    // Einzelboje (Start) in der Spalte ihrer Seite; die Fahrweg-Folge ist in beiden Listen dieselbe.
    expect([spalte('gate135', 'start|hin seiteA').spalte, spalte('frontal135', 'start|hin seiteA').spalte]).toEqual([0, 1])
    expect(spalte('frontal135', 't5|rueck seiteA').folge).toBe(spalte('gate135', 't5|rueck seiteA').folge)
  })

  it('Beschriftung wirkt von selbst: Land/See (ls) und Innen/Außen (ia) im Kopf der Unterspalte', () => {
    const unter = (beschriftung: string, kennung: string) => masken('gate135', '5', beschriftung).find((f) => f.kennung === kennung)!.boje!.unter
    expect([unter('ls', 't1a|hin seiteA'), unter('ls', 't1a|hin seiteB')]).toEqual(['H L', 'H S'])
    // I/A gilt nur für die Tore 1–4 (Tor 1: die obere Boje innen); Tor 5 bleibt R/L.
    expect([unter('ia', 't1a|hin seiteA'), unter('ia', 't1a|hin seiteB'), unter('ia', 't5|hin seiteA')]).toEqual(['H A', 'H I', 'H R'])
  })

  it('UIM: Köpfe englisch, `andere` mit deutschen Bojen-Texten (nur titel/unter); Größe komprimiert < 4 kB', () => {
    let u = uimParallelStand()
    u = reducer(u, { type: 'BETRIEB_BEGINNEN', bereich: 'parallel', punkt: 'runde:pre', zeit: 500 })
    const A: Liste = { bereich: 'parallel', typeId: 'parallelparcours', racecourse: 'A' }
    const sicht = sichtListe(u, UIM, A, EXTRA)
    const en = sicht.klassen['1']!.felder!
    expect(en.find((f) => f.kennung === 'b3a')!.boje).toEqual({ halt: 'b3a', weg: 'hin', folge: 3, titel: 'Buoy 3', unter: '', spalte: null })
    expect(en.find((f) => f.kennung === 'start|seiteB')!.boje).toMatchObject({ weg: 'hin', spalte: 0, unter: 'L' })
    const de = sicht.andere!.klassen['1']!.felder!
    expect(de.find((f) => f.kennung === 'b3a')!.boje).toEqual({ titel: 'Boje 3', unter: '' })
    const andereSchluessel = new Set(['titel', 'felder', 'kennung', 'label', 'katalog', 'disq', 'code', 'text', 'boje', 'unter'])
    for (const k of schluessel(Object.values(sicht.andere!.klassen))) expect(andereSchluessel.has(k), k).toBe(true)
    expect(deflateRawSync(Buffer.from(JSON.stringify(sicht))).length).toBeLessThan(4096)
  })

  it('Größe: gate135 DM, alle Klassen, 12 Starts bleibt komprimiert unter der Inline-Grenze (4096 Byte)', () => {
    // Alle Klassen auf beiden Parcours, je vier erfundene Starter – mehr Masken und Starts als je an einer Liste.
    const klassen = ['E', '1', '2', '3', '4', '5', '6', '7'] as const
    const viele = klassen.flatMap((k) => [1, 2, 3, 4].map((n) => betriebStarter(`s${k}${n}`, k, `${k === 'E' ? 'E0' : k}${10 + n}`)))
    let s = reducer(wkrBetriebsStand(viele), { type: 'WKR_LISTE', liste: K('gate135'), modus: 'digital', zeit: 100 })
    for (let i = 0; i < 14; i++) s = zeigeNaechsten(s, P1, 2000 + i * 100)
    const echt = sichtListe(s, DM, L('gate135'), EXTRA)
    expect(echt.schlange.length).toBeGreaterThanOrEqual(12)
    // Der Parcours fährt nur einen Teil der Klassen; schlimmster Fall: die Masken ALLER Klassen in einer Sicht.
    const sicht = { ...echt, klassen: maskenJeKlasse(DM, DM, 'gate135', klassen, false) }
    expect(Object.keys(sicht.klassen)).toHaveLength(8)
    expect(deflateRawSync(Buffer.from(JSON.stringify(sicht))).length).toBeLessThan(4096)
  })
})

describe('Sicht der Liste – Parallelslalom', () => {
  it('nur die eigene Seite: Seite, Attempt-Titel, Lauf-Schlüssel der Runde', () => {
    let s = uimParallelStand()
    s = reducer(s, { type: 'BETRIEB_BEGINNEN', bereich: 'parallel', punkt: 'runde:pre', zeit: 500 })
    const A: Liste = { bereich: 'parallel', typeId: 'steg', racecourse: 'A' }
    const B: Liste = { bereich: 'parallel', typeId: 'steg', racecourse: 'B' }
    for (const l of [A, B]) s = reducer(s, { type: 'WKR_LISTE', liste: listenKennung(l), modus: 'digital', zeit: 100 })
    s = zeigeNaechsten(s, 'parallel', 1000)
    const e = lage(s, 'parallel').aktuell!.eintrag!
    const nr = (id: string | null) => s.starters.find((p) => p.id === id)?.startNr
    const a = sichtListe(s, UIM, A, EXTRA)
    const b = sichtListe(s, UIM, B, EXTRA)
    if (e.paar!.a !== null) expect(a.schlange[0]).toMatchObject({ key: e.key, seite: 'A', startNr: nr(e.paar!.a), titel: `Preliminary heat · Attempt ${e.paar!.attempt}` })
    if (e.paar!.b !== null) expect(b.schlange[0]).toMatchObject({ key: e.key, seite: 'B', startNr: nr(e.paar!.b) })
    for (const x of [...a.schlange, ...a.danach]) expect(x.seite).toBe('A')
    expect(a.schlange[0]?.lauf ?? 'parallel:pre/1').toMatch(/^parallel:pre\/[12]$/)
    // Die Startnummer der anderen Seite steht nicht in der Sicht von A (Paar mit zwei Startern).
    const andere = nr(e.paar!.b)
    if (e.paar!.a !== null && andere) expect(a.schlange.map((x) => x.startNr)).not.toContain(andere)
  })
})

describe('F17: nichts auf der Anzeigetafel', () => {
  it('sichtOeffentlich und sichtZuschauer bleiben gleich, wenn ein Gerät Werte ohne X schickt', () => {
    const { s, erste } = bereit('gate135', 'steg')
    let mit = sende(s, 'gate135', [zeile(s, 'gate135', erste[0], [['t1a|hin seiteA', '5', '']])])
    mit = sende(mit, 'steg', [zeile(mit, 'steg', erste[1], [], 'g1', 2, 'ab')])
    expect(mit.eingaben).not.toEqual(s.eingaben)
    expect(sichtOeffentlich(mit)).toEqual(sichtOeffentlich(s))
    expect(sichtZuschauer(sichtOeffentlich(mit))).toEqual(sichtZuschauer(sichtOeffentlich(s)))
  })
})

describe('F17 (W4.3): „Nicht vorbeigekommen“ kommt weder auf die Tafel noch auf die Zuschauerliste', () => {
  it('sichtOeffentlich/sichtZuschauer gleich nach einer Zeile mit `n` (auch Steg-Anlegen) und nach ihrem Aufheben; nichts davon in der Listen-Sicht', () => {
    const { s, erste } = bereit('gate135', 'steg')
    const nv = (st: AppState, typeId: string, starter: string, z: number, teil?: 'ab' | 'an') => {
      const r = pruefeZeile(st, DM, L(typeId), teil, 'g1', { z, s: m(starter), c: [], n: true })
      if ('fehler' in r) throw new Error(r.fehler)
      return sende(st, typeId, [r])
    }
    let mit = nv(s, 'gate135', erste[0], 1)
    mit = nv(mit, 'steg', erste[1], 2, 'an')
    expect(Object.keys(mit.wkr.nichtVorbei)).toHaveLength(2)
    expect(sichtOeffentlich(mit)).toEqual(sichtOeffentlich(s))
    expect(sichtZuschauer(sichtOeffentlich(mit))).toEqual(sichtZuschauer(sichtOeffentlich(s)))
    const auf = reducer(mit, { type: 'SET_EINGABEN', zellen: [{ lauf: 'manoevrieren/1', starter: erste[0], feld: 't1a|hin seiteA', wert: '5' }] })
    expect(auf.wkr.nichtVorbei[K('gate135')]).toBeUndefined()
    expect(sichtOeffentlich(auf)).toEqual(sichtOeffentlich(s))
    // Die Sicht der Liste trägt kein Kennzeichen (Positivliste oben): kein Wort „nichtVorbei“, kein `nv`.
    const text = JSON.stringify(sichtListe(mit, DM, L('gate135'), EXTRA))
    expect(text).not.toContain('nichtVorbei')
    expect(text).not.toContain('"nv"')
  })
})

describe('F17 (W2.4): auch die Actions des Bedienrechners ändern nichts auf Anzeigetafel und Zuschauerliste', () => {
  it('sichtOeffentlich/sichtZuschauer gleich nach Rückfrage, Vorschlag, Modus, Pause, „Papier ab“, Abschluss lösen, R und warnen/nachfragen', () => {
    const { s, erste } = bereit('gate135', 'steg')
    const oeff = JSON.stringify(sichtOeffentlich(s))
    const zus = JSON.stringify(sichtZuschauer(sichtOeffentlich(s)))
    const schritte: AppState[] = []
    const weiter = (st: AppState, a: Parameters<typeof reducer>[1]) => {
      const n = reducer(st, a)
      schritte.push(n)
      return n
    }
    let st = weiter(s, { type: 'SET_EINGABEN', zellen: [{ lauf: 'manoevrieren/1', starter: erste[0], feld: 't1a|hin seiteA', wert: '7' }] })
    st = weiter(st, { type: 'WKR_ZEILEN', liste: K('gate135'), quelle: { geraet: 'g1', name: 'Handy Tor 1' }, zeilen: [zeile(st, 'gate135', erste[0], [['t1a|hin seiteA', '5', '']])], zeit: 5000 })
    expect(st.wkr.rueckfragen.length).toBeGreaterThan(0)
    st = weiter(st, { type: 'WKR_RUECKFRAGE', id: st.wkr.rueckfragen[0].id, wahl: 'geraet', zeit: 5100 })
    st = weiter(st, { type: 'WKR_LISTE', liste: K('gate135'), status: 'pausiert', zeit: 5200 })
    st = weiter(st, { type: 'WKR_LISTE', liste: K('gate135'), status: 'aktiv', zeit: 5300 })
    st = weiter(st, { type: 'WKR_LISTE', liste: K('steg'), modus: 'beides', zeit: 5400 })
    st = weiter(st, { type: 'WKR_PAPIER_AB', liste: K('gate135'), ref: st.betrieb.bereiche[P1].gezeigt[1].ref, zeit: 5500 })
    st = weiter(st, { type: 'WKR_ZEILEN', liste: K('gate135'), quelle: { geraet: 'g1', name: 'Handy Tor 1' }, zeilen: [zeile(st, 'gate135', erste[1], [['t1a|hin seiteA', '3', '']], 'g1', 2)], zeit: 5600 })
    if (st.wkr.vorschlaege.length) st = weiter(st, { type: 'WKR_VORSCHLAG', id: st.wkr.vorschlaege[0].id, wahl: 'uebernehmen', zeit: 5700 })
    st = weiter(st, { type: 'WKR_ABSCHLUSS_LOESEN', liste: K('gate135'), punkt: 'lauf:1', zeit: 5800 })
    st = weiter(st, { type: 'SET_ANZEIGE', patch: { wkrRueckstand: 7, wkrWarnung: 'nachfragen' } })
    expect(st.anzeige.wkrWarnung).toBe('nachfragen')
    for (const x of schritte) {
      expect(JSON.stringify(sichtOeffentlich(x))).toBe(oeff)
      expect(JSON.stringify(sichtZuschauer(sichtOeffentlich(x)))).toBe(zus)
    }
  })
})
