import { describe, expect, it } from 'vitest'
import { reducer } from '../state/reducer'
import { configFor } from '../config/konfig'
import { lage, refKey } from '../betrieb/folge'
import { SICHT_FASSUNG, sichtOeffentlich, sichtZuschauer } from '../betrieb/sicht'
import { BETRIEB_STARTER, betriebStarter, uimParallelStand, wkrBetriebsStand, zeigeNaechsten } from '../testHilfen'
import type { AppState, ClassId, CoPilotRolle, WkrZeile } from '../types'
import { einteilungsName, einteilungsParcours, LISTEN_SICHT_FASSUNG, maskenJeKlasse, sichtListe, type ListenSicht, type ListenSichtExtra } from './sicht'
import { WKR_ANNAHMEN } from './annahmen'
import { listenKennung, type Liste } from './liste'
import { laufLage } from './ampel'
import { sichtFreigabe } from './freigabe'
import { erfassungsLage } from './lage'
import { pruefeZeile, type GeraeteZeile } from './zeile'
import { listenFelder } from '../lib/eingaben'
import { ausgleichListen, coPilotZeilen } from '../lib/ausgleich'
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

/** Co-Piloten über die Actions der Besetzung: je Klasse und Rolle [Name, Gewicht?] (erfundene Namen). */
function co(s: AppState, je: Partial<Record<ClassId, Partial<Record<CoPilotRolle, [string, number?]>>>>): AppState {
  for (const [klasse, rollen] of Object.entries(je) as [ClassId, Partial<Record<CoPilotRolle, [string, number?]>>][])
    for (const [rolle, [name, kg]] of Object.entries(rollen) as [CoPilotRolle, [string, number?]][]) {
      s = reducer(s, { type: 'SET_CO_PILOT', klasse, rolle, text: name })
      if (kg !== undefined) s = reducer(s, { type: 'SET_CO_PILOT_GEWICHT', klasse, rolle, gewicht: kg })
    }
  return s
}

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
    // `laeuft` seit Fassung 6 (R6-10): der laufende Punkt läuft noch; nie `ampel` am Steg (P-03, AM9).
    expect(Object.keys(sicht).sort()).toEqual(['abgeschlossen', 'bereich', 'danach', 'geraete', 'klassen', 'laeuft', 'liste', 'lv', 'modus', 'punkt', 'schlange', 'sprache', 'status', 'teile', 'titel'])
    expect(sicht.lv).toBe(LISTEN_SICHT_FASSUNG)
    expect(Object.keys(sicht.laeuft!).sort()).toEqual(['offen', 'punkt', 'unterwegs'])
    expect(Object.keys(sicht.punkt!).sort()).toEqual(['id', 'titel'])
    // Teile (Steg, F16): je Teil nur Status und abgeschlossene Punkte.
    expect(sicht.teile).toEqual({ ab: { status: 'aktiv', abgeschlossen: [] }, an: { status: 'aktiv', abgeschlossen: [] } })
    // `ausgleich` seit Fassung 11 (Nutzer 24.11.2026, AG1): nur an der Steg-Liste, eigener Block unten.
    const startSchluessel = new Set(['key', 'startNr', 'klasse', 'titel', 'lauf', 'seite', 'boot', 'teile', 'entfaellt', 'vorab', 'ab', 'an', 'punkt', 'ausgleich'])
    for (const k of schluessel([...sicht.schlange, ...sicht.danach])) expect(startSchluessel.has(k), k).toBe(true)
    // `max`/`danach` je Katalog-Eintrag seit Fassung 12 (Nutzer 24.11.2026, CM1–CM3).
    const feldSchluessel = new Set(['titel', 'felder', 'kennung', 'kind', 'label', 'teil', 'katalog', 'disq', 'code', 'punkte', 'text', 'aus', 'max', 'danach'])
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
    expect(ohne.schlange.filter((x) => !x.vorab).map((x) => x.key)).toEqual(erste.map((id) => m(id)))
    // Steg-Zeitversatz (T1/T2): dahinter die Starts „Am Steg“ vorab – nur fürs Ablegen; der Start im Boot braucht
    // noch kein Anlegen, „danach“ auch nicht.
    const vorab = ohne.schlange.filter((x) => x.vorab)
    expect(vorab).toHaveLength(s.anzeige.amSteg)
    for (const x of vorab) expect(x.teile).toEqual({ ab: false, an: true })
    expect(ohne.schlange.find((x) => x.key === m(erste.at(-1)!))!.teile).toEqual({ ab: false, an: true })
    for (const x of ohne.danach) expect(x.teile?.an).toBe(true)
    const erster = s.starters.find((p) => p.id === erste[0])!
    expect(ohne.schlange[0]).toMatchObject({ startNr: erster.startNr, klasse: erster.klasse, titel: '1. Lauf', lauf: 'manoevrieren/1', teile: { ab: false, an: false } })
    expect(ohne.schlange.find((x) => x.klasse === 'E')!.boot).toBe('Boot Musterwerft')
    // Ablegen erfasst: Der Start bleibt (Anlegen fehlt), der Teil steht als erledigt da.
    const ab = sende(s, 'steg', [zeile(s, 'steg', erste[0], [], 'g1', 1, 'ab')])
    expect(sichtListe(ab, DM, L('steg'), EXTRA).schlange[0].teile).toEqual({ ab: true, an: false })
    // Danach: die nächsten freien als Schätzung (hinter den Vorab-Starts des Ablegens), höchstens fünf.
    expect(ohne.danach.length + vorab.length).toBeGreaterThan(0)
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
    expect(Object.keys(code.katalog![0]).sort()).toEqual(['code', 'max', 'punkte', 'text'])
    // Höchstzahl je Code (Nutzer 24.11.2026, CM1/CM2): immer aufgelöst; „2. und 3. Versuch“ (6) mit D danach.
    expect(code.katalog!.map((e) => [e.code, e.max, e.danach])).toEqual([
      ['3', WKR_ANNAHMEN.codeMaxAllgemein, undefined],
      ['4', WKR_ANNAHMEN.codeMaxAllgemein, undefined],
      ['5', WKR_ANNAHMEN.codeMaxAllgemein, undefined],
      ['6', 2, 'D'],
    ])
    expect(felder.some((f) => f.teil === 'an')).toBe(true)
    // W3-07 (21.11.2026, GF2): Codes „ab Klasse 3/4“ tragen in Klasse 1 `aus`, in Klasse 4 nicht.
    expect(code.katalog!.filter((e) => e.aus).map((e) => e.code)).toEqual(['4', '5'])
    const stegK4 = sichtListe(s, DM, L('steg'), EXTRA).klassen['4']
    if (stegK4?.felder) expect(stegK4.felder.flatMap((f) => f.katalog ?? []).some((e) => e.aus)).toBe(false)
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
    // Co-Piloten mit Gewicht (27.11.2026, CP1): Ihre Namen sind die einzigen Namen der Steg-Sicht (Block unten) – hier
    // nur, damit ihr Körpergewicht und das Objekt des Stands sichtbar draußen bleiben.
    let mit = co(s, { E: { haupt: ['Copi Muster', 71.3] } })
    mit = sende(mit, 'gate135', [zeile(mit, 'gate135', erste[0], [['t1a|hin seiteA', '5', '']])])
    // Werte anderer Listen und anderer Starter.
    mit = reducer(mit, { type: 'SET_EINGABEN', zellen: [{ lauf: 'manoevrieren/1', starter: erste[1], feld: 'zeit1', wert: '83.4' }, { lauf: 'manoevrieren/1', starter: erste[1], feld: 'bemerkung@steg', wert: 'Geheimbemerkung' }] })
    for (const typeId of ['gate135', 'steg']) {
      const sicht = sichtListe(mit, DM, L(typeId), EXTRA)
      const alle = schluessel(sicht)
      // `coPiloten` steht nur an der Steg-Liste, und dort als eigenes Feld der Sicht (Positivliste im Block unten).
      for (const verboten of ['name', 'vorname', 'nachname', 'herkunft', 'verein', 'club', 'geburtsdatum', 'gewicht', 'geschlecht', 'eingaben', 'werte', 'summe', 'punkteSumme', 'platz', 'wertung', 'wkr', 'einteilung', 'coPiloten', 'haupt', 'ersatz'].filter((k) => typeId !== 'steg' || k !== 'coPiloten'))
        expect(alle.has(verboten), `${typeId}: ${verboten}`).toBe(false)
      const werte = blaetter(sicht).map(String)
      for (const p of mit.starters) {
        for (const verboten of [p.vorname, p.nachname, `${p.vorname} ${p.nachname}`]) expect(werte, verboten).not.toContain(verboten)
      }
      const text = JSON.stringify(sicht)
      for (const verboten of [GEHEIM, '41.7', '83.4', '71.3', 'Geheimbemerkung', 'Musterclub', 'Handy Tor 1', 'Vor', 'Nach']) expect(text, `${typeId}: ${verboten}`).not.toContain(verboten)
      expect(text.includes('Copi Muster'), typeId).toBe(typeId === 'steg')
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

  it('Positivliste `boje`: nur Fahrweg-Angaben und Bogentexte, nur an Fahrweg-Bojen; Fassung 14 (seit den Co-Piloten am Steg, CP9 27.11.2026)', () => {
    const { s } = bereit('gate135')
    const sicht = sichtListe(s, DM, L('gate135'), EXTRA)
    expect(LISTEN_SICHT_FASSUNG).toBe(14)
    expect(LISTEN_SICHT_FASSUNG).toBeGreaterThanOrEqual(WKR_ANNAHMEN.coPilotFassung)
    expect(LISTEN_SICHT_FASSUNG).toBeGreaterThanOrEqual(WKR_ANNAHMEN.nichtGestartetFassung)
    expect(LISTEN_SICHT_FASSUNG).toBeGreaterThanOrEqual(WKR_ANNAHMEN.bojenZelleFassung)
    expect(LISTEN_SICHT_FASSUNG).toBeGreaterThanOrEqual(WKR_ANNAHMEN.codeMaxFassung)
    // `bild` (W4-13, GF9): nur die Kennung der Zeichnung, wie auf dem Bogen.
    const feldSchluessel = new Set(['titel', 'felder', 'kennung', 'kind', 'label', 'teil', 'katalog', 'disq', 'code', 'punkte', 'text', 'aus', 'max', 'danach', 'boje', 'bild', 'datei', 'dim', 'drehung', ...bojeSchluessel])
    for (const k of schluessel(Object.values(sicht.klassen))) expect(feldSchluessel.has(k), k).toBe(true)
    const mitBild = Object.values(sicht.klassen).filter((k) => k?.felder && k.bild)
    expect(mitBild.length).toBeGreaterThan(0)
    expect(Object.keys(mitBild[0]!.bild!).sort()).toEqual(['aus', 'datei', 'dim', 'drehung'])
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
    // (Ohne die Vorab-Starts des Ablegens: Im nächsten Versuch fährt derselbe Starter auf A – T1.)
    if (e.paar!.a !== null && andere) expect(a.schlange.filter((x) => !x.vorab).map((x) => x.startNr)).not.toContain(andere)
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

// Nutzer 24.11.2026 (WKR_ANNAHMEN NG4): Ein X vom Tor-Gerät („Nicht gestartet“) wirkt auf Tafel und Zuschauerliste
// genau wie ein X am Steg (der gezeigte Start bleibt stehen, Geprüftes: lage.test.ts „Nicht gestartet“). Das Kennzeichen
// „nicht vorbeigekommen“ (W4.3, F17-Test) gibt es nicht mehr.
describe('„Nicht gestartet“ (24.11.2026, NG4): Tafel und Zuschauerliste wie bei einem X vom Steg', () => {
  it('sichtOeffentlich/sichtZuschauer gleich, ob das X vom Tor-Gerät kam oder am Steg abgetippt wurde; die Listen-Sicht trägt es nicht', () => {
    const { s, erste } = bereit('gate135', 'steg')
    const r = pruefeZeile(s, DM, L('gate135'), undefined, 'g1', { z: 1, s: m(erste.at(-1)!), c: [['disq@gate135', 'X', '']] })
    if ('fehler' in r) throw new Error(r.fehler)
    const vomTor = sende(s, 'gate135', [r])
    const vomSteg = reducer(s, { type: 'SET_EINGABEN', zellen: [{ lauf: 'manoevrieren/1', starter: erste[1], feld: 'disq@steg', wert: 'X' }] })
    expect(sichtOeffentlich(vomTor)).toEqual(sichtOeffentlich(vomSteg))
    expect(sichtZuschauer(sichtOeffentlich(vomTor))).toEqual(sichtZuschauer(sichtOeffentlich(vomSteg)))
    // Werte gehen nie in die Sicht der Liste (Positivliste oben) – auch das X nicht; X ist auf dem Tor kein Knopf (NG3).
    const text = JSON.stringify(sichtListe(vomTor, DM, L('gate135'), EXTRA))
    expect(text).not.toContain('"X"')
    expect(text).not.toContain('nichtVorbei')
  })
})

describe('Sicht der Liste – Ausgleichsgewicht am Steg (Nutzer 24.11.2026, WKR_ANNAHMEN AG1–AG3)', () => {
  /** Alle Starts der Sicht nach Startnummer → `ausgleich` (fehlt = undefined). */
  const ag = (sicht: ListenSicht) => Object.fromEntries([...sicht.schlange, ...sicht.danach].map((x) => [x.startNr, x.ausgleich]))

  it('nur an der Steg-Liste: kg aus lib/ausgleich.ts auf die Abstufung gerundet (Vorgabe ganze kg), 0 = keines nötig, „fehlt“ = nicht gewogen – nie ein Gewicht selbst', () => {
    // bereit(): alle 41,7 kg; Parcours 1 fährt E und 1 (DM: E 26 → 0, Klasse 1 33 → 0). e2 nicht gewogen, k1 29,6 kg
    // (33 − 29,6 = 3,4 → 3), k2 32,6 kg (0,4 kg leichter → auf 0 gerundet = wie „keines nötig“, Prüfbefund 24.11.2026).
    const { s } = bereit('steg', 'gate135')
    const kg: Record<string, number | undefined> = { e2: undefined, k1: 29.6, k2: 32.6 }
    const mit = { ...s, starters: s.starters.map((p) => (p.id in kg ? { ...p, gewicht: kg[p.id] } : p)) }
    const steg = sichtListe(mit, DM, L('steg'), EXTRA)
    const werte = ag(steg)
    expect(Object.keys(werte).length).toBeGreaterThan(2)
    const erwartet: Record<string, number | 'fehlt'> = { E01: 0, E02: 'fehlt', '101': 3, '102': 0 }
    for (const [nr, w] of Object.entries(werte)) expect(w, nr).toBe(erwartet[nr])
    // Eine Rechnung mit der Papierliste: dieselbe Zahl wie „Ausgleichsgewichte“ (lib/ausgleich.ts).
    for (const z of ausgleichListen(mit).flatMap((l) => l.zeilen)) if (z.starter.startNr in werte) expect(werte[z.starter.startNr], z.starter.startNr).toBe(z.ausgleich === undefined ? 'fehlt' : (z.ausgleich ?? 0))
    // Nie Körper- oder Durchschnittsgewicht, nie ein anderer Schlüssel dafür.
    const text = JSON.stringify(steg)
    for (const verboten of ['41.7', '29.6', '32.6', 'gewicht', 'sollgewicht', 'soll"']) expect(text, verboten).not.toContain(verboten)
    // Andere Listen tragen es nicht.
    for (const x of [...sichtListe(mit, DM, L('gate135'), EXTRA).schlange, ...sichtListe(mit, DM, L('gate135'), EXTRA).danach]) expect(x.ausgleich, x.startNr).toBeUndefined()
  })

  it('ohne Durchschnittsgewicht der Klasse kein Feld; eigene Durchschnittsgewichte der Veranstaltung gelten', () => {
    const { s } = bereit('steg')
    // Ein eigener Wert 0 der Veranstaltung = kein Durchschnittsgewicht: Klasse 1 ohne Feld, Klasse E wie vorher.
    const ohne = sichtListe({ ...s, sollgewicht: { '1': 0 } }, DM, L('steg'), EXTRA)
    expect(new Set([...ohne.schlange, ...ohne.danach].map((x) => x.klasse))).toEqual(new Set(['E', '1']))
    for (const x of [...ohne.schlange, ...ohne.danach]) expect('ausgleich' in x, x.startNr).toBe(x.klasse !== '1')
    // Eigene Durchschnittsgewichte gelten (wie auf der Papierliste): Klasse 1 mit 45 kg → 45 − 41,7 = 3,3 → 3.
    expect(ag(sichtListe({ ...s, sollgewicht: { '1': 45 } }, DM, L('steg'), EXTRA))['101']).toBe(3)
  })

  it('UIM nach seinen Gewichten (Klasse 1: 32 kg statt 33 unter DM), am Steg je Racecourse; Parallel-Liste ohne Steg nicht', () => {
    // Prüfbefund 24.11.2026: vorher prüfte nur die Übung den UIM-Steg. Dolphin 26 kg, Klasse 1 32 kg (uim-2026.yaml).
    const kg: Record<string, number | undefined> = { 'E-1': 20.5, 'E-2': 26, '1-1': 29.6, '1-2': 31.6, '1-3': 40 }
    let u = uimParallelStand()
    u = { ...u, starters: u.starters.map((p) => (p.id in kg ? { ...p, gewicht: kg[p.id] } : p)) }
    u = reducer(u, { type: 'BETRIEB_BEGINNEN', bereich: 'parallel', punkt: 'runde:pre', zeit: 500 })
    const werte: Record<string, number | 'fehlt' | undefined> = {}
    for (const rc of ['A', 'B'] as const) Object.assign(werte, ag(sichtListe(u, UIM, { bereich: 'parallel', typeId: 'steg', racecourse: rc }, EXTRA)))
    // 26 − 20,5 = 5,5 → 6; 26 → keines; 32 − 29,6 = 2,4 → 2 (DM: 3); 32 − 31,6 = 0,4 → 0; 40 → keines; Rest nicht gewogen.
    const erwartet: Record<string, number | 'fehlt'> = { E01: 6, E02: 0, E03: 'fehlt', '101': 2, '102': 0, '103': 0, '104': 'fehlt', '105': 'fehlt', '106': 'fehlt' }
    expect(Object.keys(werte).length).toBeGreaterThan(2)
    expect(werte['101']).toBe(2)
    for (const [nr, w] of Object.entries(werte)) expect(w, nr).toBe(erwartet[nr])
    // Dieselbe Zahl wie die Papierliste unter UIM.
    for (const z of ausgleichListen(u).flatMap((l) => l.zeilen)) if (z.starter.startNr in werte) expect(werte[z.starter.startNr], z.starter.startNr).toBe(z.ausgleich === undefined ? 'fehlt' : (z.ausgleich ?? 0))
    const parcours = sichtListe(u, UIM, { bereich: 'parallel', typeId: 'parallelparcours', racecourse: 'A' }, EXTRA)
    for (const x of [...parcours.schlange, ...parcours.danach]) expect(x.ausgleich, x.startNr).toBeUndefined()
  })

  it('ein in der Verwiegung nachgetragenes Gewicht steht in der nächsten Sicht – am Steg wird nichts gepflegt (AG2)', () => {
    const { s } = bereit('steg')
    const ohne = { ...s, starters: s.starters.map((p) => (p.id === 'k2' ? { ...p, gewicht: undefined } : p)) }
    expect(ag(sichtListe(ohne, DM, L('steg'), EXTRA))['102']).toBe('fehlt')
    const nach = reducer(ohne, { type: 'SET_WEIGHT', id: 'k2', gewicht: 28.6 })
    // 33 − 28,6 = 4,4 → 4 kg.
    expect(ag(sichtListe(nach, DM, L('steg'), EXTRA))['102']).toBe(4)
  })

  it('F17: Anzeigetafel, Zuschauerliste und Start-Freigabe bleiben ohne Ausgleichsgewicht, auch nach einer Verwiegung', () => {
    const { s } = bereit('steg', 'gate135')
    const nach = reducer(s, { type: 'SET_WEIGHT', id: 'k2', gewicht: 28.6 })
    expect(ag(sichtListe(nach, DM, L('steg'), EXTRA))['102']).toBe(4)
    expect(sichtOeffentlich(nach)).toEqual(sichtOeffentlich(s))
    expect(sichtZuschauer(sichtOeffentlich(nach))).toEqual(sichtZuschauer(sichtOeffentlich(s)))
    const freigabe = JSON.stringify(sichtFreigabe(P1, erfassungsLage(nach, DM, P1, [], 0).listen, 'warnen'))
    for (const wort of ['ausgleich', 'gewicht', '28.6']) expect(freigabe).not.toContain(wort)
  })
})

describe('Fassungen: `lv` zählt nie ohne `sv` (Prüfbefund 27.11.2026, WKR_ANNAHMEN CP9)', () => {
  it('Listen-Sicht 14 gehört zu sv 9 – wer eine anhebt, hebt beide an', () => {
    // `lv` steht nur innen: Ein Gerät mit altem Programm verwirft eine Sicht anderer `lv` still (geraete/erfassen.ts
    // istListenSicht) und bleibt bei seiner abgelegten stehen – ohne Meldung, ohne Neuladen. F7 („neu laden“ bzw.
    // „Bedienrechner aktualisieren“) löst nur `sv` aus, außen an jeder Nachricht (transport.ts, geraet.test.ts
    // „gekoppeltes Gerät …“). Deshalb stehen beide Zahlen HIER zusammen fest: Wer `lv` anhebt, muss diese Zeile ändern
    // und hebt dabei betrieb/sicht.ts SICHT_FASSUNG (samt types/betrieb.ts `sv`) mit an.
    expect({ lv: LISTEN_SICHT_FASSUNG, sv: SICHT_FASSUNG }).toEqual({ lv: 14, sv: 9 })
    const { s } = bereit('steg')
    expect([sichtListe(s, DM, L('steg'), EXTRA).lv, sichtOeffentlich(s).sv]).toEqual([14, 9])
  })
})

describe('Sicht der Liste – Co-Piloten am Steg (Nutzer 27.11.2026, WKR_ANNAHMEN CP1–CP4)', () => {
  // bereit(): Parcours 1 fährt E und 1 – unter DM beides Klassen mit Co-Pilot. Gewichte mit Nachkommastelle, damit ein
  // Körpergewicht in der Sicht auffiele: E 71,3 / 67,6 kg (Ersatz 3,7 leichter → 4), Klasse 1 62,9 kg.
  const VOLL = { E: { haupt: ['Copi Muster', 71.3], ersatz: ['Copa Beispiel', 67.6] }, '1': { haupt: ['Copu Probe', 62.9] } } as const satisfies Parameters<typeof co>[1]

  it('nur die Steg-Liste, je Klasse der Liste einmal; Positivliste rolle/coPilot/ausgleich; Klammer nur über 0 – nie ein Körpergewicht', () => {
    const { s } = bereit('steg', 'gate135')
    const mit = co(s, VOLL)
    const steg = sichtListe(mit, DM, L('steg'), EXTRA)
    expect(steg.lv).toBe(14)
    // Je Klasse (CP2), nicht am Start: Die Starts tragen nichts davon.
    expect(steg.coPiloten).toEqual({
      E: [{ rolle: 'haupt', coPilot: 'Copi Muster' }, { rolle: 'ersatz', coPilot: 'Copa Beispiel', ausgleich: 4 }],
      '1': [{ rolle: 'haupt', coPilot: 'Copu Probe' }],
    })
    for (const k of schluessel(steg.coPiloten)) expect(['E', '1', 'rolle', 'coPilot', 'ausgleich'], k).toContain(k)
    for (const x of [...steg.schlange, ...steg.danach]) expect(JSON.stringify(x), x.startNr).not.toContain('Cop')
    const text = JSON.stringify(steg)
    for (const verboten of ['71.3', '67.6', '62.9', 'gewicht']) expect(text, verboten).not.toContain(verboten)
    // Andere Listen tragen sie nie (CP1) – auch nicht der Vorsteg.
    for (const typeId of ['gate135', 'vorsteg', 'tor5', 'mueb']) {
      const andere = sichtListe(mit, DM, L(typeId), EXTRA)
      expect(andere.coPiloten, typeId).toBeUndefined()
      expect(JSON.stringify(andere), typeId).not.toContain('Cop')
    }
  })

  it('nur benannte (CP3): kein Co-Pilot → kein Feld; Gewicht ohne Namen zählt nicht; nur ein Ersatz → nur der Ersatz', () => {
    const { s } = bereit('steg')
    expect('coPiloten' in sichtListe(s, DM, L('steg'), EXTRA)).toBe(false)
    // Nur ein Gewicht beim eingeteilten Co-Piloten: kein Name, also nichts auf der Leitung (Papier: leeres Feld).
    const nurGewicht = reducer(s, { type: 'SET_CO_PILOT_GEWICHT', klasse: 'E', rolle: 'haupt', gewicht: 80.1 })
    expect('coPiloten' in sichtListe(nurGewicht, DM, L('steg'), EXTRA)).toBe(false)
    // Nur der Ersatz mit Namen (der eingeteilte trägt nur das Gewicht): nur seine Zeile, ohne Klammer – ein Gewicht
    // ohne Namen zählt nicht als Bezug (R12-06), der Ersatz ist der einzige Benannte seiner Gruppe.
    const nurErsatz = co(nurGewicht, { E: { ersatz: ['Copa Beispiel'] } })
    expect(sichtListe(nurErsatz, DM, L('steg'), EXTRA).coPiloten).toEqual({ E: [{ rolle: 'ersatz', coPilot: 'Copa Beispiel' }] })
    // Leerraum am Rand fällt weg, wie auf Papier.
    expect(sichtListe(co(s, { '1': { haupt: ['  Copu Probe  '] } }), DM, L('steg'), EXTRA).coPiloten).toEqual({ '1': [{ rolle: 'haupt', coPilot: 'Copu Probe' }] })
  })

  it('Ausgleichsgewicht nur über lib/ausgleich.ts: je Klasse oder über alle, auf die Abstufung gerundet, „fehlt“ = nicht gewogen', () => {
    const { s } = bereit('steg')
    const mit = co(s, VOLL)
    const ag = (st: AppState) => Object.fromEntries(Object.entries(sichtListe(st, DM, L('steg'), EXTRA).coPiloten ?? {}).flatMap(([k, l]) => l!.map((c) => [`${k}|${c.rolle}`, c.ausgleich])))
    // Je Klasse (Vorgabe): Klasse 1 hat nur einen Co-Piloten → keine Klammer; E-Ersatz 3,7 → 4.
    expect(ag(mit)).toEqual({ 'E|haupt': undefined, 'E|ersatz': 4, '1|haupt': undefined })
    // Über alle (Klassen mit Startern: E und 1): Bezug 71,3 → Klasse 1 8,4 → 8.
    const alle = reducer(mit, { type: 'SET_CO_PILOT_AUSGLEICH', ausgleich: 'alle' })
    expect(ag(alle)).toEqual({ 'E|haupt': undefined, 'E|ersatz': 4, '1|haupt': 8 })
    // Abstufung der Veranstaltung wie beim Fahrer: 0,5 kg → 3,5 und 8,5.
    expect(ag(reducer(alle, { type: 'SET_AUSGLEICH_STUFE', kg: 0.5 }))).toEqual({ 'E|haupt': undefined, 'E|ersatz': 3.5, '1|haupt': 8.5 })
    // Ersatz ohne Gewicht, der eingeteilte gewogen: „(nicht gewogen)“.
    const ohne = reducer(mit, { type: 'SET_CO_PILOT_GEWICHT', klasse: 'E', rolle: 'ersatz', gewicht: null })
    expect(ag(ohne)['E|ersatz']).toBe('fehlt')
    // Dieselbe Zahl wie die Papierliste (lib/ausgleich.ts coPilotZeilen) – dort nur, was eine Klammer bekommt.
    for (const st of [mit, alle, ohne])
      for (const k of ['E', '1'] as const)
        for (const z of coPilotZeilen(st, k) ?? []) {
          const papier = z.ausgleich === 'fehlt' || (typeof z.ausgleich === 'number' && z.ausgleich > 0) ? z.ausgleich : undefined
          expect(ag(st)[`${k}|${z.rolle}`], `${k}|${z.rolle}`).toBe(papier)
        }
  })

  it('F17: Anzeigetafel, Zuschauerliste und Start-Freigabe bleiben ohne Co-Piloten, auch nach einer Änderung der Besetzung', () => {
    const { s } = bereit('steg', 'gate135')
    const mit = co(s, VOLL)
    expect(sichtListe(mit, DM, L('steg'), EXTRA).coPiloten).toBeDefined()
    expect(sichtOeffentlich(mit)).toEqual(sichtOeffentlich(s))
    expect(sichtZuschauer(sichtOeffentlich(mit))).toEqual(sichtZuschauer(sichtOeffentlich(s)))
    const freigabe = JSON.stringify(sichtFreigabe(P1, erfassungsLage(mit, DM, P1, [], 0).listen, 'warnen'))
    for (const wort of ['Cop', 'coPilot', '71.3']) expect(freigabe).not.toContain(wort)
  })

  it('UIM: am Steg je Racecourse dieselben Co-Piloten; die Parallel-Liste ohne', () => {
    let u = uimParallelStand()
    u = co(u, { E: { haupt: ['Copi Muster', 71.3], ersatz: ['Copa Beispiel'] } })
    u = reducer(u, { type: 'BETRIEB_BEGINNEN', bereich: 'parallel', punkt: 'runde:pre', zeit: 500 })
    for (const rc of ['A', 'B'] as const) {
      const steg = sichtListe(u, UIM, { bereich: 'parallel', typeId: 'steg', racecourse: rc }, EXTRA)
      expect(steg.coPiloten?.E, rc).toEqual([{ rolle: 'haupt', coPilot: 'Copi Muster' }, { rolle: 'ersatz', coPilot: 'Copa Beispiel', ausgleich: 'fehlt' }])
    }
    expect(sichtListe(u, UIM, { bereich: 'parallel', typeId: 'parallelparcours', racecourse: 'A' }, EXTRA).coPiloten).toBeUndefined()
  })
})

describe('F17 (W5.4, ZT4): „Keine Zeit“ kommt weder auf Tafel, Zuschauerliste noch Start-Freigabe', () => {
  it('sichtOeffentlich/sichtZuschauer gleich nach einer Zeile mit `kz`; Freigabe- und Listen-Sicht ohne Grund', () => {
    const { s, erste } = bereit('zeit', 'gate135')
    const r = pruefeZeile(s, DM, L('zeit'), undefined, 'g1', { z: 1, s: m(erste[0]), c: [['zeit1', '83,45', '']], kz: [['zeit2', 'anlage'], ['zeit3', 'nichtImZiel']] })
    if ('fehler' in r) throw new Error(r.fehler)
    const mit = sende(s, 'zeit', [r])
    expect(Object.keys(mit.wkr.keineZeit)).toHaveLength(1)
    expect(sichtOeffentlich(mit)).toEqual(sichtOeffentlich(s))
    expect(sichtZuschauer(sichtOeffentlich(mit))).toEqual(sichtZuschauer(sichtOeffentlich(s)))
    const freigabe = JSON.stringify(sichtFreigabe(P1, erfassungsLage(mit, DM, P1, [], 0).listen, 'warnen'))
    const liste = JSON.stringify(sichtListe(mit, DM, L('zeit'), EXTRA))
    for (const text of [freigabe, liste]) for (const wort of ['keineZeit', 'anlage', 'nichtImZiel', '"kz"']) expect(text).not.toContain(wort)
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

describe('Parcours-Ampel (P-03, AM8, AM9; 21.11.2026)', () => {
  it('Listen-Sicht: `ampel` nur an Parcours-Listen, grün → rot per Knopf; Steg ohne', () => {
    const { s } = bereit('gate135', 'steg')
    const key = s.betrieb.bereiche[P1].gezeigt.at(-1)!.ref
    expect(sichtListe(s, DM, L('gate135'), EXTRA).ampel).toEqual({ key, ampel: 'gruen' })
    expect(sichtListe(s, DM, L('steg'), EXTRA).ampel).toBeUndefined()
    const rot = reducer(s, { type: 'BETRIEB_DURCHFAHRT', bereich: P1, ref: key, an: true, zeit: 1200 })
    expect(sichtListe(rot, DM, L('gate135'), EXTRA).ampel).toEqual({ key, ampel: 'rot' })
    // `laeuft` (R6-10): der Start auf der Tafel ist unterwegs.
    const nr = s.starters.find((p) => p.id === JSON.parse(key)[1])!.startNr
    expect(sichtListe(rot, DM, L('gate135'), EXTRA).laeuft).toMatchObject({ punkt: 'lauf:1', unterwegs: [nr] })
  })

  it('`laeuft` trägt den letzten Start auf dem Weg zum Anlegen (Prüfbefund 21.11.2026, R6-10): Tore auf Papier, Ampel aus', () => {
    let { s } = bereit('steg')
    for (let i = 0; i < 100; i++) {
      const weiter = zeigeNaechsten(s, P1, 2000 + i)
      if (weiter === s) break
      s = weiter
    }
    expect(lage(s, P1).frei.filter((e) => e.punkt === 'lauf:1')).toHaveLength(0)
    const key = s.betrieb.bereiche[P1].gezeigt.at(-1)!.ref
    const nr = s.starters.find((p) => p.id === JSON.parse(key)[1])!.startNr
    // Ohne Listen-Blick: nichts frei, nicht im Boot, Ampel aus → der Lauf gälte als durch.
    expect(laufLage(s, DM, P1)).toBeNull()
    expect(sichtListe(s, DM, L('steg'), EXTRA).laeuft).toEqual({ punkt: 'lauf:1', unterwegs: [nr], offen: 0 })
    // Angelegt (Haken des Stegs) → durch.
    const fertig = reducer(s, { type: 'SET_EINGABEN', zellen: [{ lauf: 'manoevrieren/1', starter: JSON.parse(key)[1], feld: 'erfasst@steg', wert: '1' }] })
    expect(sichtListe(fertig, DM, L('steg'), EXTRA).laeuft).toBeUndefined()
  })

  // sv 7 seit der Wiederholung nach Ausfall (26.11.2026, R11-11), 8 seit `gefahren` in jeder Sicht (27.11.2026, R13-01) –
  // die Ampel änderte die Fassung nie.
  it('keine Ampel auf Anzeigetafel und Zuschauerliste: Durchfahrt ändert sichtOeffentlich/sichtZuschauer nicht', () => {
    const { s } = bereit('gate135')
    const key = s.betrieb.bereiche[P1].gezeigt.at(-1)!.ref
    const rot = reducer(s, { type: 'BETRIEB_DURCHFAHRT', bereich: P1, ref: key, an: true, zeit: 1200 })
    expect(rot).not.toBe(s)
    expect(sichtOeffentlich(rot)).toEqual(sichtOeffentlich(s))
    expect(sichtOeffentlich(rot).sv).toBe(9)
    expect(sichtZuschauer(sichtOeffentlich(rot))).toEqual(sichtZuschauer(sichtOeffentlich(s)))
    const text = JSON.stringify(sichtOeffentlich(rot))
    for (const wort of ['durchfahrt', 'ampel', 'wkrAuto']) expect(text).not.toContain(wort)
    // Auch der Auto-Modus (Einstellung) bleibt draußen.
    const auto = reducer(rot, { type: 'SET_ANZEIGE', patch: { wkrAuto: true } })
    expect(sichtOeffentlich(auto)).toEqual(sichtOeffentlich(s))
  })
})

describe('Sicht der Liste – WKR-Name aus der Einteilung (Nutzer 21.11.2026, W3-13, WN1)', () => {
  const mitEinteilung = (s: AppState): AppState => {
    let x = reducer(s, { type: 'SET_WKR_NAME', parcoursId: P1, typeId: 'gate135', name: '  Erika Muster ' })
    x = reducer(x, { type: 'SET_WKR_NAME', parcoursId: P1, typeId: 'steg', name: 'Max Beispiel' })
    return x
  }

  it('nur der Name DER EIGENEN Liste, ohne Leerraum; ohne Eintrag fehlt das Feld (WN3)', () => {
    const { s } = bereit('gate135', 'steg', 'tor5')
    const mit = mitEinteilung(s)
    const tor = sichtListe(mit, DM, L('gate135'), EXTRA)
    expect(tor.wkrName).toBe('Erika Muster')
    expect(JSON.stringify(tor)).not.toContain('Max Beispiel')
    // Teil-Geräte am Steg lesen dieselbe Sicht – also denselben Namen (die Einteilung kennt keine Teile).
    expect(sichtListe(mit, DM, L('steg'), EXTRA).wkrName).toBe('Max Beispiel')
    const ohne = sichtListe(mit, DM, L('tor5'), EXTRA)
    expect('wkrName' in ohne).toBe(false)
    expect(JSON.stringify(ohne)).not.toMatch(/Erika|Max Beispiel/)
    // Positivliste: genau ein neues Feld oben, sonst nichts aus der Einteilung.
    expect(Object.keys(tor)).toContain('wkrName')
    expect(schluessel(tor).has('einteilung')).toBe(false)
  })

  it('nie in sichtOeffentlich oder sichtZuschauer (Anzeigetafel, Start-Freigabe, Zuschauer)', () => {
    const { s } = bereit('gate135')
    const mit = mitEinteilung(s)
    const oeff = sichtOeffentlich(mit)
    expect(JSON.stringify(oeff)).not.toMatch(/Erika|Max Beispiel/)
    expect(JSON.stringify(sichtZuschauer(oeff))).not.toMatch(/Erika|Max Beispiel/)
  })

  it('einteilungsName: Parallelslalom unter der Kennung des Racecourse (wie WkrEinteilung)', () => {
    const stand = { einteilung: { 'racecourse-b': { parallelparcours: 'Tom Test' } } }
    expect(einteilungsName(stand, { bereich: 'egal', typeId: 'parallelparcours', racecourse: 'B' })).toBe('Tom Test')
    expect(einteilungsName(stand, { bereich: 'egal', typeId: 'parallelparcours', racecourse: 'A' })).toBe('')
    expect(einteilungsParcours({ bereich: P1, typeId: 'gate135', racecourse: null })).toBe(P1)
    // Ein Schlüssel aus dem Prototyp ist kein Eintrag.
    expect(einteilungsName({ einteilung: {} }, { bereich: '__proto__', typeId: 'toString', racecourse: null })).toBe('')
  })
})
