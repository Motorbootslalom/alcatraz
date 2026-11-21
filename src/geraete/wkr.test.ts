import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { shallowRef } from 'vue'
import { starteGeraeteHost, type GeraeteHost, type HostUmgebung } from './host'
import { oeffneGekoppelt, oeffneKoppelLink, type GekoppeltesGeraet } from './gekoppelt'
import { oeffneErfassung, type ErfassenUmgebung, type Erfassung } from './erfassen'
import { ABLAGE, liesHerkunft, verlasseRaum, type Ablage } from './ablage'
import type { Aufgabe } from './aufgaben'
import { gruppeDerListe } from './wkrGruppen'
import { nachgebauterBrowser, type TestFenster } from './testBrowser'
import { bis, NachgebauterSocket, nachgebautesFetch, neuesNtfy, ruhe, SERVER, type NachgebautesNtfy } from './transport/ntfy/testNtfy'
import { direktThemaVon, geraeteThemaVon, themenDerGruppe, type HostRaum } from './transport/ntfy/raum'
import { fromBase64Url } from './transport/ntfy/codec'
import { openGruppe, parseHostWire } from './transport/ntfy/wire'
import type { NtfyZeiten } from './transport/ntfy/leitung'
import type { Op } from './transport/ntfy/patch'
import { reducer, type Action } from '../state/reducer'
import { lage } from '../betrieb/folge'
import { sichtOeffentlich } from '../betrieb/sicht'
import { werteVon } from '../lib/eingaben'
import { listenKennung } from '../wkr/liste'
import { uimParallelStand, wkrBetriebsStand } from '../testHilfen'
import type { AppState } from '../types'

/**
 * Ende zu Ende der WKR-Erfassung (W1.4, Plan docs/plan-wkr-w1.md §6, 21.11.2026): Bedienrechner (host.ts im
 * nachgebauten Browser, echter Reducer) → nachgebauter ntfy (kein Netz) → WKR-Handy = gekoppeltes Gerät
 * (gekoppelt.ts) + Gerätekern ohne Maske (erfassen.ts), jedes mit eigenem Speicher. Starter, Gerätenamen und
 * WKR-Namen erfunden.
 */

const SCHNELL: Partial<NtfyZeiten> = { abstandMs: 0, wiederholenMs: [20], zuVieleMs: 30, neuVerbindenMs: [10], quittungMs: 150, einstiegAbstandMs: 0 }
const KENNUNG = 'MUSTERW14'
const P1 = 'par_1'
const TOR = listenKennung({ bereich: P1, typeId: 'gate135', racecourse: null })
const STEG = listenKennung({ bereich: P1, typeId: 'steg', racecourse: null })
const FELD = 't1a|hin seiteA'
const LAUF = 'manoevrieren/1'
const WKR_NAME = 'Erika Musterrichterin'

let ntfy: NachgebautesNtfy
const hosts: GeraeteHost[] = []
const geraete: GekoppeltesGeraet[] = []
const erfassungen: Erfassung[] = []

beforeEach(() => {
  ntfy = neuesNtfy()
  vi.stubGlobal('WebSocket', NachgebauterSocket)
  vi.stubGlobal('fetch', nachgebautesFetch)
})

afterEach(() => {
  for (const e of erfassungen.splice(0)) e.stop()
  for (const g of geraete.splice(0)) g.stop()
  for (const h of hosts.splice(0)) h.stop()
  vi.unstubAllGlobals()
})

/** Ein Fenster mit vollem Store (wie kopplung.test.ts): schreibt den Stand in den gemeinsamen Speicher. */
function fensterStore(f: TestFenster, start?: () => AppState) {
  const gespeichert = f.ablage.getItem('test.stand')
  const anfang = () => ({ ...(start ? start() : wkrBetriebsStand()), kennung: KENNUNG, geraeteServer: SERVER })
  const state = shallowRef<AppState>(gespeichert ? (JSON.parse(gespeichert) as AppState) : anfang())
  let uhr = 10_000
  const angewandt: Action[] = []
  f.fenster.addEventListener('storage', (e) => {
    const ev = e as StorageEvent
    if (ev.key === 'test.stand' && ev.newValue) state.value = JSON.parse(ev.newValue) as AppState
  })
  return {
    state,
    angewandt,
    dispatch(action: Action) {
      uhr += 1000
      const vorher = state.value
      const next = reducer(vorher, { ...action, zeit: action.zeit ?? uhr } as Action)
      angewandt.push(action)
      if (next === vorher) return
      state.value = next
      f.ablage.setItem('test.stand', JSON.stringify(next))
    },
  }
}
type FStore = ReturnType<typeof fensterStore>

function hostIn(f: TestFenster, s: FStore, mehr: HostUmgebung = {}): GeraeteHost {
  const h = starteGeraeteHost(s, { ablage: f.ablage, fenster: f.fenster, fuehrung: f.fuehrung, bus: f.bus, zeiten: SCHNELL, sammelnMs: 0, endeWartenMs: 2000, koppelTaktMs: 50, ...mehr })
  hosts.push(h)
  return h
}

async function bedienrechner(start?: () => AppState, mehr: HostUmgebung = {}) {
  const b = nachgebauterBrowser()
  const f = b.fenster()
  const s = fensterStore(f, start)
  const h = hostIn(f, s, mehr)
  h.oeffne()
  await bis(() => h.verbindung.value?.status === 'verbunden')
  const raum = (): HostRaum => JSON.parse(f.ablage.getItem(ABLAGE.raum)!).raum as HostRaum
  return { b, f, s, h, raum }
}

function handy(): Ablage & { daten: Map<string, string> } {
  const daten = new Map<string, string>()
  return { daten, getItem: (k) => daten.get(k) ?? null, setItem: (k, v) => void daten.set(k, String(v)), removeItem: (k) => void daten.delete(k) }
}

interface HandyOptionen {
  name?: string
  speicher?: Ablage & { daten: Map<string, string> }
  uhr?: () => number
  erfassen?: ErfassenUmgebung
  /** Zeiten des Geräts (Vorgabe SCHNELL). */
  zeiten?: Partial<NtfyZeiten>
}

/** Gerät + Erfassung auf einem Speicher; `neu` = nach dem Neuladen (abgelegte Kopplung). */
function starteKern(g: GekoppeltesGeraet, speicher: Ablage, o: HandyOptionen) {
  geraete.push(g)
  const e = oeffneErfassung(g, { ablage: speicher, taktMs: 20, ...(o.uhr ? { uhr: o.uhr } : {}), ...o.erfassen })
  erfassungen.push(e)
  return e
}

/** Ein WKR-Handy über Koppel-Link und Geräte-Code – gekoppelt, mit der Sicht seiner Listen. */
async function wkrHandy(h: GeraeteHost, aufgaben: Aufgabe[], o: HandyOptionen = {}) {
  const speicher = o.speicher ?? handy()
  h.gibCode(aufgaben)
  await bis(() => !!h.raum.value?.koppeln.code && h.raum.value.koppeln.code.benutzt === null)
  const code = h.raum.value!.koppeln.code!.wert
  const r = oeffneKoppelLink(h.raum.value!.koppelLink, { ablage: speicher, zeiten: o.zeiten ?? SCHNELL, ablaufTaktMs: 20, ...(o.uhr ? { uhr: o.uhr } : {}) })
  if (!r.ok) throw new Error(`Link: ${r.code}`)
  const g = r.geraet
  const e = starteKern(g, speicher, o)
  await g.start()
  g.koppeln(o.name ?? 'Handy Tor', code)
  await bis(() => g.lage.value === 'gekoppelt')
  const listen = aufgaben.filter((a) => a.art === 'liste').map((a) => (a as { liste: string }).liste)
  await bis(() => listen.every((l) => !!e.sichten.value[l]?.geraete[g.kanal.id()!]))
  return { g, e, speicher, id: g.kanal.id()! }
}

/** Nach dem Neuladen: dieselbe Ablage, `#/geraet`. */
async function neuGeladen(speicher: Ablage & { daten: Map<string, string> }, o: HandyOptionen = {}) {
  const g = oeffneGekoppelt({ ablage: speicher, zeiten: SCHNELL, ablaufTaktMs: 20, ...(o.uhr ? { uhr: o.uhr } : {}) })
  if (!g) throw new Error('keine Kopplung')
  const e = starteKern(g, speicher, o)
  await g.start()
  return { g, e }
}

/** „Nächster Start“ am Bedienrechner (wie die Start-Freigabe). */
function zeige(s: FStore, bereich = P1) {
  const b = sichtOeffentlich(s.state.value).bereiche.find((x) => x.id === bereich)!
  s.dispatch({ type: 'BETRIEB_ZEIGEN', bereich, ref: b.offen[0].key, vorher: b.aktuell?.key ?? null })
}

const aktuell = (s: AppState, bereich = P1) => lage(s, bereich).aktuell!
const werte = (s: AppState, starter: string, lauf = LAUF) => werteVon(s.eingaben, lauf, starter)
const zeilenNachrichten = (s: FStore) => s.angewandt.filter((a) => a.type === 'WKR_ZEILEN') as Extract<Action, { type: 'WKR_ZEILEN' }>[]

/** Warten, bis die Liste digital ist und ein gezeigter Start in der Schlange des Geräts steht. */
async function mitStart(s: FStore, e: Erfassung, liste = TOR) {
  await bis(() => s.state.value.wkr.listen[liste]?.modus === 'digital')
  zeige(s)
  const a = aktuell(s.state.value)
  await bis(() => !!e.schlange.value[liste]?.some((x) => x.key === a.key))
  return { key: a.key, starter: a.eintrag!.starter }
}

describe('WKR-Erfassung Ende zu Ende (W1.4)', () => {
  it('koppeln mit Liste → Sicht; Zeile → Werte, Haken, Herkunft; gesammelte Quittung ohne direkte Nachricht', async () => {
    const { f, s, h, raum } = await bedienrechner()
    const { g, e, id } = await wkrHandy(h, [{ art: 'liste', liste: TOR }])
    expect(e.listen.value).toEqual([{ art: 'liste', liste: TOR }])
    expect(raum().geraete[id].gruppen).toEqual([gruppeDerListe(TOR)])
    const { key, starter } = await mitStart(s, e)
    expect(e.schlange.value[TOR][0]).toMatchObject({ key, lauf: LAUF })
    expect(e.schlange.value[TOR][0].geschaetzt).toBeUndefined()

    const direktVorher = ntfy.bodies(direktThemaVon(raum(), id)).length
    const z = e.schicke(TOR, { s: key, zellen: { [FELD]: '5' } })!
    // Die Maske sperrt nie: Die Zeile ist sofort aus der Schlange, ihre Stufe „unterwegs“.
    expect(e.schlange.value[TOR].some((x) => x.key === key)).toBe(false)
    expect(['unterwegs']).toContain(e.stufen.value[z].stufe)
    await bis(() => e.stufen.value[z].stufe === 'uebernommen')
    expect(werte(s.state.value, starter)[FELD]).toBe('5')
    expect(werte(s.state.value, starter)['erfasst@gate135']).toBeTruthy()
    expect(liesHerkunft(KENNUNG, f.ablage).zellen[`${LAUF}|${starter}|${FELD}`]).toMatchObject({ g: 'Handy Tor', l: TOR, w: '5' })
    expect(g.kanal.unbestaetigt()).toEqual([])
    // Gesammelt über die Sicht der Liste: keine direkte Quittung an das Gerät.
    expect(ntfy.bodies(direktThemaVon(raum(), id)).length).toBe(direktVorher)
    expect(e.zuletzt.value[0]).toMatchObject({ z, liste: TOR, s: key, korrektur: false, zellen: { [FELD]: '5' } })
  })

  it('Rückfrage hin und zurück: Gerät sieht `steht`, der Bediener entscheidet für das Gerät', async () => {
    const { s, h } = await bedienrechner()
    const { e } = await wkrHandy(h, [{ art: 'liste', liste: TOR }])
    const { key, starter } = await mitStart(s, e)
    s.dispatch({ type: 'SET_EINGABEN', zellen: [{ lauf: LAUF, starter, feld: FELD, wert: '10' }] })
    const z = e.schicke(TOR, { s: key, zellen: { [FELD]: '5' } })!
    await bis(() => e.stufen.value[z].stufe === 'rueckfrage')
    expect(e.stufen.value[z]).toEqual({ stufe: 'rueckfrage', zellen: [{ feld: FELD, lauf: LAUF, steht: '10' }] })
    expect(werte(s.state.value, starter)[FELD]).toBe('10')
    // Solange die Rückfrage offen ist, bleibt der Start aus der Schlange (er steht unter „Zuletzt“).
    expect(e.schlange.value[TOR].some((x) => x.key === key)).toBe(false)

    const rf = s.state.value.wkr.rueckfragen[0]
    s.dispatch({ type: 'WKR_RUECKFRAGE', id: rf.id, wahl: 'geraet' })
    await bis(() => e.stufen.value[z].stufe === 'uebernommen')
    expect(e.stufen.value[z]).toEqual({ stufe: 'uebernommen', nachRueckfrage: true })
    expect(werte(s.state.value, starter)[FELD]).toBe('5')
  })

  it('Doppel: dieselbe Nachricht noch einmal bei ntfy wirkt einmal; dieselbe Zeile noch einmal ändert nichts', async () => {
    const { s, h, raum } = await bedienrechner()
    const { e } = await wkrHandy(h, [{ art: 'liste', liste: TOR }])
    const { key, starter } = await mitStart(s, e)
    const z = e.schicke(TOR, { s: key, zellen: { [FELD]: '5' } })!
    await bis(() => e.stufen.value[z].stufe === 'uebernommen')
    expect(zeilenNachrichten(s)).toHaveLength(1)
    const g = geraeteThemaVon(raum())
    const letzte = ntfy.gespeichert.filter((x) => x.topic === g).at(-1)!
    ntfy.wiederhole(letzte.topic, letzte.body)
    await ruhe(200)
    expect(zeilenNachrichten(s)).toHaveLength(1)
    // Die Maske schickt denselben Wert noch einmal: Der Stand bleibt (gleich → nichts, keine Rückfrage).
    const vorher = s.state.value
    const z2 = e.korrigiere(z, { [FELD]: '5' })
    expect(z2).toBe(z)
    expect(e.schicke(TOR, { s: key, zellen: { [FELD]: '5' } })).not.toBeNull()
    await bis(() => e.wartend.value === 0)
    expect(werte(s.state.value, starter)).toEqual(werte(vorher, starter))
    expect(s.state.value.wkr.rueckfragen).toEqual([])
  })

  it('Funkloch: drei Zeilen warten und gehen danach als EINE Nachricht; ohne Verbindung „danach“ geschätzt', async () => {
    const { s, h } = await bedienrechner()
    const { g, e } = await wkrHandy(h, [{ art: 'liste', liste: TOR }])
    await bis(() => s.state.value.wkr.listen[TOR]?.modus === 'digital')
    zeige(s)
    zeige(s)
    zeige(s)
    await bis(() => e.schlange.value[TOR]?.length === 3)
    const starts = e.schlange.value[TOR].map((x) => x.key)
    g.stop()
    await bis(() => g.status.value !== 'verbunden')
    // Ohne Verbindung: die nächsten freien als Schätzung dazu.
    expect(e.schlange.value[TOR].filter((x) => x.geschaetzt).length).toBeGreaterThan(0)
    const zs = starts.map((key, i) => e.schicke(TOR, { s: key, zellen: { [FELD]: String(i + 1) } })!)
    expect(e.wartend.value).toBe(3)
    await ruhe(100)
    expect(zs.every((z) => e.stufen.value[z].stufe === 'unterwegs')).toBe(true)
    expect(zeilenNachrichten(s)).toHaveLength(0)
    await g.start()
    await bis(() => zs.every((z) => e.stufen.value[z].stufe === 'uebernommen'))
    expect(zeilenNachrichten(s)).toHaveLength(1)
    expect(zeilenNachrichten(s)[0].zeilen).toHaveLength(3)
    expect(e.wartend.value).toBe(0)
  })

  it('Führungswechsel mit offener Zeile: das neue Führungsfenster wendet sie einmal an', async () => {
    const b = nachgebauterBrowser()
    const f1 = b.fenster()
    const s1 = fensterStore(f1)
    const h1 = hostIn(f1, s1)
    h1.oeffne()
    await bis(() => h1.verbindung.value?.status === 'verbunden')
    const f2 = b.fenster()
    const s2 = fensterStore(f2)
    const h2 = hostIn(f2, s2)
    const { e } = await wkrHandy(h1, [{ art: 'liste', liste: TOR }])
    const { key, starter } = await mitStart(s1, e)
    h1.stop()
    const z = e.schicke(TOR, { s: key, zellen: { [FELD]: '5' } })!
    await bis(() => h2.fuehrt.value)
    await bis(() => e.stufen.value[z].stufe === 'uebernommen', 5000)
    expect(werte(s2.state.value, starter)[FELD]).toBe('5')
    expect([...s1.angewandt, ...s2.angewandt].filter((a) => a.type === 'WKR_ZEILEN')).toHaveLength(1)
  })

  it('Neuladen von Gerät und Host: der Ausgang bleibt und geht danach hinaus', async () => {
    const { f, s, h } = await bedienrechner()
    const { g, e, speicher } = await wkrHandy(h, [{ art: 'liste', liste: TOR }])
    const { key, starter } = await mitStart(s, e)
    // Gerät ohne Netz: Die Zeile wartet im Ausgang (gerätelokal), dann lädt die Seite neu.
    g.stop()
    const z = e.schicke(TOR, { s: key, zellen: { [FELD]: '7' } })!
    expect(speicher.getItem(ABLAGE.geraetWkr)).toContain(FELD)
    e.stop()
    // Auch der Bedienrechner lädt neu (neue Instanz im selben Fenster).
    h.stop()
    const h2 = hostIn(f, s)
    await bis(() => h2.verbindung.value?.status === 'verbunden')
    const neu = await neuGeladen(speicher)
    await bis(() => neu.e.stufen.value[z]?.stufe === 'uebernommen')
    expect(werte(s.state.value, starter)[FELD]).toBe('7')
    expect(zeilenNachrichten(s)).toHaveLength(1)
  })

  it('Liste entzogen: keine Sicht mehr, nichts mehr zu schicken; wartende Zeilen gelten als abgelehnt', async () => {
    const { s, h } = await bedienrechner()
    const { g, e, id } = await wkrHandy(h, [{ art: 'liste', liste: TOR }])
    const { key } = await mitStart(s, e)
    g.stop()
    const z = e.schicke(TOR, { s: key, zellen: { [FELD]: '5' } })!
    await g.start()
    h.setzeAufgaben(id, [])
    await bis(() => e.listen.value.length === 0)
    expect(e.sichten.value).toEqual({})
    expect(e.schicke(TOR, { s: key, zellen: { [FELD]: '5' } })).toBeNull()
    // Ging die Zeile noch vor dem Entzug hinaus, ist sie übernommen; sonst abgelehnt – nie hängen geblieben.
    await bis(() => ['uebernommen', 'abgelehnt'].includes(e.stufen.value[z].stufe))
    await bis(() => g.kanal.unbestaetigt().length === 0)
  })

  it('Lebenszeichen nur nach Stille (Fake-Uhr), mit Akku im Register', async () => {
    let versatz = 0
    const uhr = () => Date.now() + versatz
    const { h, raum } = await bedienrechner()
    const { e, id } = await wkrHandy(h, [{ art: 'liste', liste: TOR }], { uhr, erfassen: { akku: () => 77 } })
    expect(e.sichten.value[TOR]!.punkt).not.toBeNull()
    await ruhe(150)
    expect(raum().geraete[id].akku).toBeUndefined()
    versatz = 61_000
    await bis(() => raum().geraete[id].akku === 77)
    expect(raum().geraete[id].wartend).toBe(0)
  })

  it('Pause: Schlange leer, offene und während der Pause gezeigte Starts auf Papier (P); weiter → wieder digital', async () => {
    const { s, h } = await bedienrechner()
    const { e } = await wkrHandy(h, [{ art: 'liste', liste: TOR }])
    const { key } = await mitStart(s, e)
    expect(e.pausiere(TOR)).not.toBeNull()
    await bis(() => e.sichten.value[TOR]?.status === 'pausiert')
    expect(e.schlange.value[TOR]).toEqual([])
    zeige(s)
    const waehrend = aktuell(s.state.value).key
    await ruhe(100)
    expect(e.schlange.value[TOR]).toEqual([])
    const pause = s.state.value.wkr.listen[TOR].pausen[0]
    expect(pause.papier).toContain(key)
    expect(e.weiter(TOR)).not.toBeNull()
    await bis(() => e.sichten.value[TOR]?.status === 'aktiv')
    expect(s.state.value.wkr.listen[TOR].pausen[0].bis).not.toBeNull()
    expect(e.schlange.value[TOR].some((x) => x.key === waehrend)).toBe(false)
    expect(e.meldeAb(TOR)).not.toBeNull()
    await bis(() => e.sichten.value[TOR]?.status === 'abgemeldet')
  })

  it('Abschluss: mit offenen Starts abgelehnt („offen“); danach angenommen, eine spätere Korrektur wird Vorschlag', async () => {
    const { s, h } = await bedienrechner()
    const { e } = await wkrHandy(h, [{ art: 'liste', liste: TOR }])
    const { key, starter } = await mitStart(s, e)
    const z = e.schicke(TOR, { s: key, zellen: { [FELD]: '5' } })!
    zeige(s)
    const zweiter = aktuell(s.state.value)
    const a1 = e.schliesseAb(TOR, 'lauf:1', WKR_NAME, false)!
    await bis(() => e.abschluesse.value.find((a) => a.id === a1)?.stufe === 'abgelehnt')
    expect(e.abschluesse.value.find((a) => a.id === a1)).toMatchObject({ grund: 'offen' })
    expect(s.state.value.wkr.abschluss[TOR]).toBeUndefined()

    const z2 = e.schicke(TOR, { s: zweiter.key, zellen: {} })!
    await bis(() => e.stufen.value[z2].stufe === 'uebernommen')
    expect(e.stufen.value[z].stufe).toBe('uebernommen')
    const a2 = e.schliesseAb(TOR, 'lauf:1', WKR_NAME, false)!
    await bis(() => e.abschluesse.value.find((a) => a.id === a2)?.stufe === 'angenommen')
    expect(s.state.value.wkr.abschluss[TOR]['lauf:1']).toMatchObject({ name: WKR_NAME, abweichend: [], papier: [] })

    const k = e.korrigiere(z, { [FELD]: '10' })!
    await bis(() => e.stufen.value[k]?.stufe === 'vorschlag')
    expect(werte(s.state.value, starter)[FELD]).toBe('5')
    expect(s.state.value.wkr.vorschlaege).toHaveLength(1)
    expect(s.state.value.wkr.vorschlaege[0].zellen).toEqual([{ feld: FELD, wert: '10' }])
    // F6: Kein Name in irgendeiner Rückgabe des Kerns.
    const rueckgaben = JSON.stringify([e.zuletzt.value, e.abschluesse.value, e.stufen.value, e.schlange.value, e.sichten.value, e.hinweise.value])
    expect(rueckgaben).not.toContain(WKR_NAME)
    for (const p of s.state.value.starters) expect(rueckgaben).not.toContain(p.nachname)
  })

  it('Hinweis vom Bedienrechner → am Gerät; gesehen → weg (sofort am Gerät, dann am Host)', async () => {
    const { s, h } = await bedienrechner()
    const { e } = await wkrHandy(h, [{ art: 'liste', liste: TOR }])
    await mitStart(s, e)
    const startNr = s.state.value.starters.find((p) => p.id === aktuell(s.state.value).eintrag!.starter)!.startNr
    h.hinweis(TOR, 'pruefen', startNr)
    await bis(() => e.hinweise.value[TOR]?.length === 1)
    const hinweis = e.hinweise.value[TOR][0]
    expect(hinweis).toMatchObject({ code: 'pruefen', startNr })
    e.gesehen(hinweis.id)
    expect(e.hinweise.value[TOR]).toEqual([])
    await bis(() => (e.sichten.value[TOR]?.geraete ? Object.values(e.sichten.value[TOR]!.geraete)[0].hinweise.length === 0 : false))
  })

  it('Steg auf zwei Geräten (Ablegen/Anlegen): Disq. vereinigt, beide Teile → ganzer Haken', async () => {
    const { s, h } = await bedienrechner()
    const ab = await wkrHandy(h, [{ art: 'liste', liste: STEG, teil: 'ab' }], { name: 'Handy Ablegen' })
    const an = await wkrHandy(h, [{ art: 'liste', liste: STEG, teil: 'an' }], { name: 'Handy Anlegen' })
    const { key, starter } = await mitStart(s, ab.e, STEG)
    await bis(() => !!an.e.schlange.value[STEG]?.some((x) => x.key === key))
    const klasse = ab.e.schlange.value[STEG].find((x) => x.key === key)!.klasse
    const felder = ab.e.sichten.value[STEG]!.klassen[klasse]!.felder!
    const disq = felder.find((x) => x.kennung === 'disq@steg')!.disq!.map((d) => d.code).filter((c) => c !== 'X')
    expect(disq.length).toBeGreaterThan(1)
    const za = ab.e.schicke(STEG, { s: key, zellen: { 'disq@steg': disq[0] } })!
    await bis(() => ab.e.stufen.value[za].stufe === 'uebernommen')
    expect(werte(s.state.value, starter)['erfasst.ab@steg']).toBeTruthy()
    expect(werte(s.state.value, starter)['erfasst@steg']).toBeFalsy()
    // Der Anlegen-Teil sieht den Start weiter (sein Teil fehlt), der Ablegen-Teil nicht mehr.
    await bis(() => an.e.sichten.value[STEG]!.schlange.some((x) => x.key === key && x.teile?.ab === true))
    expect(an.e.schlange.value[STEG].some((x) => x.key === key)).toBe(true)
    expect(ab.e.schlange.value[STEG].some((x) => x.key === key)).toBe(false)
    const zn = an.e.schicke(STEG, { s: key, zellen: { 'disq@steg': disq[1] } })!
    await bis(() => an.e.stufen.value[zn].stufe === 'uebernommen')
    const w = werte(s.state.value, starter)
    expect(w['disq@steg'].split(/[^A-Z]+/).filter(Boolean).sort()).toEqual([disq[0], disq[1]].sort())
    expect(w['erfasst@steg']).toBeTruthy()
    expect(s.state.value.wkr.rueckfragen).toEqual([])
  })

  // Prüfbefunde W1 (21.11.2026): Abschluss und Status je Teil, Ende zu Ende mit zwei Teil-Handys.
  it('Steg auf zwei Geräten: AB schließt ab und meldet sich ab – AN erfasst weiter; AN mit offenem Start „offen“, danach angenommen', async () => {
    const { s, h } = await bedienrechner()
    const ab = await wkrHandy(h, [{ art: 'liste', liste: STEG, teil: 'ab' }], { name: 'Handy Ablegen' })
    const an = await wkrHandy(h, [{ art: 'liste', liste: STEG, teil: 'an' }], { name: 'Handy Anlegen' })
    const { key, starter } = await mitStart(s, ab.e, STEG)
    await bis(() => !!an.e.schlange.value[STEG]?.some((x) => x.key === key))
    const za = ab.e.schicke(STEG, { s: key, zellen: {} })!
    await bis(() => ab.e.stufen.value[za].stufe === 'uebernommen')
    const a1 = ab.e.schliesseAb(STEG, 'lauf:1', 'Vor1 Ablegen', false)!
    await bis(() => ab.e.abschluesse.value.find((a) => a.id === a1)?.stufe === 'angenommen')
    expect(Object.keys(s.state.value.wkr.abschluss[STEG])).toEqual(['lauf:1|ab'])
    // AN: offener Start, ohne „Rest auf Papier“ → abgelehnt „offen“, obwohl der Punkt für AB abgeschlossen ist.
    const a2 = an.e.schliesseAb(STEG, 'lauf:1', 'Vor2 Anlegen', false)!
    await bis(() => an.e.abschluesse.value.find((a) => a.id === a2)?.stufe === 'abgelehnt')
    expect(an.e.abschluesse.value.find((a) => a.id === a2)).toMatchObject({ grund: 'offen' })
    expect(s.state.value.wkr.abschluss[STEG]['lauf:1|ab'].name).toBe('Vor1 Ablegen')
    // AB meldet sich ab: Nur sein Teil, die Liste bleibt aktiv.
    expect(ab.e.meldeAb(STEG)).not.toBeNull()
    await bis(() => an.e.sichten.value[STEG]?.teile?.ab.status === 'abgemeldet')
    expect(an.e.sichten.value[STEG]!.status).toBe('aktiv')
    expect(an.e.schlange.value[STEG].some((x) => x.key === key)).toBe(true)
    // AN erfasst weiter und wird direkt übernommen, nicht Vorschlag.
    const zn = an.e.schicke(STEG, { s: key, zellen: {} })!
    await bis(() => an.e.stufen.value[zn].stufe === 'uebernommen')
    expect(werte(s.state.value, starter)['erfasst@steg']).toBeTruthy()
    expect(s.state.value.wkr.vorschlaege).toEqual([])
    const a3 = an.e.schliesseAb(STEG, 'lauf:1', 'Vor2 Anlegen', false)!
    await bis(() => an.e.abschluesse.value.find((a) => a.id === a3)?.stufe === 'angenommen')
    expect(Object.keys(s.state.value.wkr.abschluss[STEG]).sort()).toEqual(['lauf:1|ab', 'lauf:1|an'])
    expect(s.state.value.wkr.abschluss[STEG]['lauf:1|ab'].name).toBe('Vor1 Ablegen')
    await bis(() => !!an.e.sichten.value[STEG]?.abgeschlossen.includes('lauf:1'))
  })

  it('Parallelslalom: Racecourse A und B auf zwei Geräten, je die eigene Seite', async () => {
    const start = () => reducer(uimParallelStand(), { type: 'BETRIEB_BEGINNEN', bereich: 'parallel', punkt: 'runde:pre', zeit: 500 })
    const A = listenKennung({ bereich: 'parallel', typeId: 'steg', racecourse: 'A' })
    const B = listenKennung({ bereich: 'parallel', typeId: 'steg', racecourse: 'B' })
    const { s, h } = await bedienrechner(start)
    const ga = await wkrHandy(h, [{ art: 'liste', liste: A }], { name: 'Pad A' })
    const gb = await wkrHandy(h, [{ art: 'liste', liste: B }], { name: 'Pad B' })
    await bis(() => s.state.value.wkr.listen[A]?.modus === 'digital' && s.state.value.wkr.listen[B]?.modus === 'digital')
    // Den ersten Start zeigen, in dem auf beiden Seiten jemand fährt.
    for (let i = 0; i < 10; i++) {
      zeige(s, 'parallel')
      const p = aktuell(s.state.value, 'parallel').eintrag!.paar!
      if (p.a !== null && p.b !== null) break
    }
    const e = aktuell(s.state.value, 'parallel')
    const paar = e.eintrag!.paar!
    await bis(() => !!ga.e.schlange.value[A]?.some((x) => x.key === e.key) && !!gb.e.schlange.value[B]?.some((x) => x.key === e.key))
    const sa = ga.e.schlange.value[A].find((x) => x.key === e.key)!
    const sb = gb.e.schlange.value[B].find((x) => x.key === e.key)!
    expect([sa.seite, sb.seite]).toEqual(['A', 'B'])
    const za = ga.e.schicke(A, { s: e.key, zellen: {} })!
    const zb = gb.e.schicke(B, { s: e.key, zellen: {} })!
    await bis(() => ga.e.stufen.value[za].stufe === 'uebernommen' && gb.e.stufen.value[zb].stufe === 'uebernommen')
    expect(werte(s.state.value, paar.a!, sa.lauf)['erfasst@steg']).toBeTruthy()
    expect(werte(s.state.value, paar.b!, sb.lauf)['erfasst@steg']).toBeTruthy()
    // Jede Zeile trug die eigene Seite.
    const zeilen = zeilenNachrichten(s).flatMap((a) => a.zeilen.map((z) => [a.liste, z.starter]))
    expect(zeilen).toEqual(expect.arrayContaining([[A, paar.a], [B, paar.b]]))
  })

  it('Leitung: nichts im Klartext; Sicht der Liste ohne Namen, Herkunft, Geburtsdatum, Gewicht, WKR-Name', async () => {
    const { s, h, raum } = await bedienrechner()
    const { e } = await wkrHandy(h, [{ art: 'liste', liste: TOR }], { name: 'Handy Geheim' })
    const { key } = await mitStart(s, e)
    const z = e.schicke(TOR, { s: key, zellen: { [FELD]: '5' } })!
    await bis(() => e.stufen.value[z].stufe === 'uebernommen')
    const a = e.schliesseAb(TOR, 'lauf:1', WKR_NAME, true)!
    await bis(() => e.abschluesse.value.find((x) => x.id === a)?.stufe === 'angenommen')
    await ruhe(100)
    const r = raum()
    const personen = s.state.value.starters.flatMap((p) => [p.vorname, p.nachname, p.verein, p.geburtsdatum].filter((x) => x && x.length > 3))
    const roh = ntfy.gespeichert.map((x) => x.body).join('\n')
    for (const verboten of [...personen, WKR_NAME, 'Handy Geheim', KENNUNG, FELD]) expect(roh, verboten).not.toContain(verboten)

    const G = gruppeDerListe(TOR)
    const inhalte: unknown[] = []
    for (const thema of themenDerGruppe(r, G)) {
      for (const body of ntfy.bodies(thema)) {
        const w = parseHostWire(body)
        if (!w || w.l || w.g !== G) continue
        inhalte.push(await openGruppe(w, fromBase64Url(r.gruppen[G].k)!))
      }
    }
    expect(inhalte.length).toBeGreaterThan(0)
    const schluessel = (wert: unknown, out = new Set<string>()): Set<string> => {
      if (Array.isArray(wert)) wert.forEach((x) => schluessel(x, out))
      else if (wert && typeof wert === 'object')
        for (const [k, v] of Object.entries(wert)) {
          out.add(k)
          if (k === 'p' && Array.isArray(v)) for (const teil of v as Op['p']) if (typeof teil === 'string') out.add(teil)
          schluessel(v, out)
        }
      return out
    }
    const alle = schluessel(inhalte)
    for (const verboten of ['vorname', 'nachname', 'verein', 'bundesland', 'geburtsdatum', 'gewicht', 'geschlecht', 'eingaben', 'herkunft', 'name'])
      expect(alle.has(verboten), verboten).toBe(false)
    const text = JSON.stringify(inhalte)
    for (const verboten of [...personen, WKR_NAME, 'Handy Geheim', KENNUNG]) expect(text, verboten).not.toContain(verboten)
  })

  it('Verkehr: je Zeile höchstens eine Gerätenachricht und eine Gruppennachricht, keine direkte Quittung', async () => {
    const { s, h, raum } = await bedienrechner(undefined, { sammelnMs: 150 })
    // Wiederholen erst nach 2 s (wie im Betrieb nach 10 s): Die Sicht kommt gesammelt nach 150 ms.
    const { e, id } = await wkrHandy(h, [{ art: 'liste', liste: TOR }], { zeiten: { ...SCHNELL, quittungMs: 2000 } })
    const { key } = await mitStart(s, e)
    await ruhe(400)
    const r = raum()
    const zaehle = () => ({
      g: ntfy.bodies(geraeteThemaVon(r)).length,
      gruppe: themenDerGruppe(r, gruppeDerListe(TOR)).reduce((n, t) => n + ntfy.bodies(t).length, 0),
      d: ntfy.bodies(direktThemaVon(r, id)).length,
    })
    const vorher = zaehle()
    const z = e.schicke(TOR, { s: key, zellen: { [FELD]: '5' } })!
    await bis(() => e.stufen.value[z].stufe === 'uebernommen')
    await ruhe(400)
    const nachher = zaehle()
    expect(nachher.g - vorher.g).toBe(1)
    expect(nachher.gruppe - vorher.gruppe).toBeLessThanOrEqual(1)
    expect(nachher.d - vorher.d).toBe(0)
  })

  it('Raum verlassen: Ausgang weg und nichts wird wieder abgelegt', async () => {
    const { s, h } = await bedienrechner()
    const { g, e, speicher } = await wkrHandy(h, [{ art: 'liste', liste: TOR }])
    const { key } = await mitStart(s, e)
    g.stop()
    e.schicke(TOR, { s: key, zellen: { [FELD]: '5' } })
    expect(speicher.getItem(ABLAGE.geraetWkr)).not.toBeNull()
    g.verlasse()
    expect(speicher.getItem(ABLAGE.geraetWkr)).toBeNull()
    e.schicke(TOR, { s: key, zellen: { [FELD]: '6' } })
    expect(speicher.getItem(ABLAGE.geraetWkr)).toBeNull()
    verlasseRaum(speicher)
  })
})
