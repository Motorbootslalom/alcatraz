import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { shallowRef, watch } from 'vue'
import { naechsterOffener } from '../wkr/tisch'
import { starteGeraeteHost, ZULETZT_NACHZIEHEN_MS, type GeraeteHost, type HostUmgebung } from './host'
import { oeffneGekoppelt, oeffneKoppelLink, type GekoppeltesGeraet } from './gekoppelt'
import { oeffneErfassung, type ErfassenUmgebung, type Erfassung } from './erfassen'
import { ABLAGE, liesHerkunft, verlasseRaum, type Ablage } from './ablage'
import type { Aufgabe } from './aufgaben'
import { gruppeDerFreigabe, gruppeDerListe } from './wkrGruppen'
import { nachgebauterBrowser, type TestFenster } from './testBrowser'
import { bis, NachgebauterSocket, nachgebautesFetch, neuesNtfy, ruhe, SERVER, type NachgebautesNtfy } from './transport/ntfy/testNtfy'
import { direktThemaVon, geraeteThemaVon, themenDerGruppe, type HostRaum } from './transport/ntfy/raum'
import { OEFFENTLICH, ZUSCHAUER } from './transport/protokoll'
import { setzeAufgaben } from './register'
import { fromBase64Url } from './transport/ntfy/codec'
import { openGruppe, parseHostWire } from './transport/ntfy/wire'
import type { NtfyZeiten } from './transport/ntfy/leitung'
import type { Op } from './transport/ntfy/patch'
import { reducer, type Action } from '../state/reducer'
import { lage } from '../betrieb/folge'
import { sichtOeffentlich } from '../betrieb/sicht'
import { werteVon } from '../lib/eingaben'
import { listenKennung } from '../wkr/liste'
import { bojenVon, disqFuer, entwurfAus, keineZeitAus, leererEntwurf, maskeFuer, mitBemerkung, setzeKeineZeit, setzeZeit, tippe, tippeBoje, tippeDisq, tippePruef, zellenAus } from '../wkr/maske'
import { erfassungsLage, tischLage } from '../wkr/lage'
import { geraetAngaben } from './register'
import { configFor } from '../config/konfig'
import { uimParallelStand, wkrBetriebsStand, betriebStarter, betriebsStand, festgeschrieben } from '../testHilfen'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import GeraeteKoppeln from '../components/betrieb/GeraeteKoppeln.vue'
import { geraeteHostKey } from './host'
import { storeKey, type Store } from '../state/store'
import { setLocale } from '../i18n'
import { vergissAlles } from '../lib/merken'
import type { AppState } from '../types'
import { makeFile } from '../persistenz/backup'

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
/** „Durchs Start-Tor“ für den gezeigten Start (Parcours-Ampel rot, P-03): Erst dann zählt er im Rückstand (AM5). */
const durch = (s: FStore, bereich = P1) => s.dispatch({ type: 'BETRIEB_DURCHFAHRT', bereich, ref: aktuell(s.state.value, bereich).key, an: true })
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
    await bis(() => e.stufen.value[z].stufe === 'uebernommen')
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
    // Abmelden (Nutzer 21.11.2026): wie „Liste entfernen“ – siehe „Abmelden am Gerät“ unten.
    expect(e.meldeAb(TOR)).not.toBeNull()
    await bis(() => s.state.value.wkr.listen[TOR].status === 'abgemeldet' && e.listen.value.length === 0)
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

  it('Hinweis mit Steg-Teil (Prüfbefund 21.11.2026, F16): nur das Gerät dieses Teils bekommt ihn, ohne Teil beide', async () => {
    const { s, h } = await bedienrechner()
    const ab = await wkrHandy(h, [{ art: 'liste', liste: STEG, teil: 'ab' }], { name: 'Handy Ablegen' })
    const an = await wkrHandy(h, [{ art: 'liste', liste: STEG, teil: 'an' }], { name: 'Handy Anlegen' })
    await mitStart(s, ab.e, STEG)
    h.hinweis(STEG, 'papier', '15', 'ab')
    await bis(() => ab.e.hinweise.value[STEG]?.length === 1)
    expect(ab.e.hinweise.value[STEG][0]).toMatchObject({ code: 'papier', startNr: '15' })
    h.hinweis(STEG, 'pruefen', '16')
    await bis(() => an.e.hinweise.value[STEG]?.length === 1 && ab.e.hinweise.value[STEG]?.length === 2)
    // Das Anlegen-Gerät hat nur den Hinweis ohne Teil – „Papier ab“ des Ablegens kam dort nie an.
    expect(an.e.hinweise.value[STEG].map((x) => x.code)).toEqual(['pruefen'])
  })

  it('Steg auf zwei Geräten (Ablegen/Anlegen): Disq. vereinigt, beide Teile → ganzer Haken', async () => {
    const { s, h } = await bedienrechner()
    const ab = await wkrHandy(h, [{ art: 'liste', liste: STEG, teil: 'ab' }], { name: 'Handy Ablegen' })
    const an = await wkrHandy(h, [{ art: 'liste', liste: STEG, teil: 'an' }], { name: 'Handy Anlegen' })
    const { key, starter } = await mitStart(s, ab.e, STEG)
    // Anlegen nachlaufend (T2): erst nach dem nächsten Start.
    expect(an.e.schlange.value[STEG].some((x) => x.key === key)).toBe(false)
    zeige(s)
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
    const { s, h, raum } = await bedienrechner()
    const ab = await wkrHandy(h, [{ art: 'liste', liste: STEG, teil: 'ab' }], { name: 'Handy Ablegen' })
    const an = await wkrHandy(h, [{ art: 'liste', liste: STEG, teil: 'an' }], { name: 'Handy Anlegen' })
    const { key, starter } = await mitStart(s, ab.e, STEG)
    const za = ab.e.schicke(STEG, { s: key, zellen: {} })!
    await bis(() => ab.e.stufen.value[za].stufe === 'uebernommen')
    // Der nächste Start: Der erste ist zurück (Anlegen, T2), der zweite im Boot; AB schickt auch dessen Ablegen.
    zeige(s)
    const zweiter = aktuell(s.state.value).key
    await bis(() => !!an.e.schlange.value[STEG]?.some((x) => x.key === key) && !!ab.e.schlange.value[STEG]?.some((x) => x.key === zweiter))
    const za2 = ab.e.schicke(STEG, { s: zweiter, zellen: {} })!
    await bis(() => ab.e.stufen.value[za2].stufe === 'uebernommen')
    const a1 = ab.e.schliesseAb(STEG, 'lauf:1', 'Vor1 Ablegen', false)!
    await bis(() => ab.e.abschluesse.value.find((a) => a.id === a1)?.stufe === 'angenommen')
    expect(Object.keys(s.state.value.wkr.abschluss[STEG])).toEqual(['lauf:1|ab'])
    // AN: offener Start, ohne „Rest auf Papier“ → abgelehnt „offen“, obwohl der Punkt für AB abgeschlossen ist.
    const a2 = an.e.schliesseAb(STEG, 'lauf:1', 'Vor2 Anlegen', false)!
    await bis(() => an.e.abschluesse.value.find((a) => a.id === a2)?.stufe === 'abgelehnt')
    expect(an.e.abschluesse.value.find((a) => a.id === a2)).toMatchObject({ grund: 'offen' })
    expect(s.state.value.wkr.abschluss[STEG]['lauf:1|ab'].name).toBe('Vor1 Ablegen')
    // AB meldet sich ab: Nur sein Teil (AN hat die Liste noch, T6), die Liste bleibt aktiv; AB verliert die Liste.
    expect(ab.e.meldeAb(STEG)).not.toBeNull()
    await bis(() => an.e.sichten.value[STEG]?.teile?.ab.status === 'abgemeldet')
    expect(an.e.sichten.value[STEG]!.status).toBe('aktiv')
    await bis(() => ab.e.listen.value.length === 0)
    expect(raum().geraete[ab.id].gruppen).not.toContain(gruppeDerListe(STEG))
    expect(an.e.schlange.value[STEG].some((x) => x.key === key)).toBe(true)
    // AN erfasst weiter und wird direkt übernommen, nicht Vorschlag.
    const zn = an.e.schicke(STEG, { s: key, zellen: {} })!
    await bis(() => an.e.stufen.value[zn].stufe === 'uebernommen')
    expect(werte(s.state.value, starter)['erfasst@steg']).toBeTruthy()
    expect(s.state.value.wkr.vorschlaege).toEqual([])
    // Der zweite ist noch im Boot: Sein Anlegen zählt für den Abschluss nicht als offen (T9, wie die Prüfansicht).
    expect(an.e.pruefung(STEG, 'lauf:1', 'an').offen).toEqual([])
    const a3 = an.e.schliesseAb(STEG, 'lauf:1', 'Vor2 Anlegen', false)!
    await bis(() => an.e.abschluesse.value.find((a) => a.id === a3)?.stufe === 'angenommen')
    expect(Object.keys(s.state.value.wkr.abschluss[STEG]).sort()).toEqual(['lauf:1|ab', 'lauf:1|an'])
    expect(s.state.value.wkr.abschluss[STEG]['lauf:1|an'].papier).toEqual([])
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

  it('W2.2: Gerät schickt → Matrix zeigt ✓ und das Gerät als gehört; ◆ reaktiv am Host; `zuletzt` gedrosselt nachgezogen', async () => {
    const { s, h } = await bedienrechner()
    const { e, id } = await wkrHandy(h, [{ art: 'liste', liste: TOR }])
    const { key, starter } = await mitStart(s, e)
    const lage = (jetzt = Date.now()) => erfassungsLage(s.state.value, configFor({ regelwerk: s.state.value.regelwerk }), P1, geraetAngaben(h.raum.value?.geraete ?? []), jetzt).listen.find((l) => l.liste === TOR)!
    expect(lage().zellen[key].zelle).toBe('offen')
    const z = e.schicke(TOR, { s: key, zellen: { [FELD]: '5' } })!
    await bis(() => e.stufen.value[z].stufe === 'uebernommen')
    await bis(() => lage().zellen[key].zelle === 'ok')
    expect(lage().geraete).toMatchObject([{ id, name: 'Handy Tor', ampel: 'gehoert' }])
    expect(lage(Date.now() + 10 * 60_000).geraete[0].ampel).toBe('weg')
    expect(h.herkunft.value.zellen[`${LAUF}|${starter}|${FELD}`]).toMatchObject({ g: 'Handy Tor', w: '5' })
    // Die nächste Nachricht berührt das Register; im Führungsfenster (kein storage-Ereignis für das eigene Schreiben)
    // kommt `zuletzt` über das gedrosselte Nachziehen in die Geräteliste – höchstens ZULETZT_NACHZIEHEN_MS später.
    const vorher = h.raum.value!.geraete[0].zuletzt
    await ruhe(20)
    e.korrigiere(z, { [FELD]: '6' })
    await bis(() => werte(s.state.value, starter)[FELD] === '6')
    const gesendet = Date.now()
    await bis(() => (h.raum.value?.geraete[0].zuletzt ?? 0) > vorher, ZULETZT_NACHZIEHEN_MS + 2000)
    expect(Date.now() - gesendet).toBeLessThan(ZULETZT_NACHZIEHEN_MS + 1000)
  }, 15_000)

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

describe('W2.4: Freigabe-Handy und Freigabe-Gruppe', () => {
  const TITEL = configFor({ regelwerk: 'dm-2026' }).getSheetDef('gate135').title

  /** Inhalte einer Gruppe, mit ihrem Schlüssel geöffnet (wie ein Gerät, das ihn hat). */
  async function inhalte(r: HostRaum, gruppe: string, schluessel = r.gruppen[gruppe].k): Promise<unknown[]> {
    const aus: unknown[] = []
    for (const thema of themenDerGruppe(r, gruppe)) {
      for (const body of ntfy.bodies(thema)) {
        const w = parseHostWire(body)
        if (!w || w.l || w.g !== gruppe) continue
        try {
          aus.push((await openGruppe(w, fromBase64Url(schluessel)!)) ?? 'nicht-lesbar')
        } catch {
          aus.push('nicht-lesbar')
        }
      }
    }
    return aus
  }

  it('Handy der Start-Freigabe bekommt Rückstand über die eigene Gruppe – ohne Werte und Namen; nicht über ko/kz', async () => {
    const { s, h, raum } = await bedienrechner()
    const tor = await wkrHandy(h, [{ art: 'liste', liste: TOR }], { name: 'Handy Geheim' })
    const frei = await wkrHandy(h, [{ art: 'startfreigabe', bereiche: [P1] }], { name: 'Steg Geheim' })
    const FG = gruppeDerFreigabe(P1)
    expect(raum().geraete[frei.id].gruppen).toEqual([FG])
    expect(raum().geraete[tor.id].gruppen).toEqual([gruppeDerListe(TOR)])
    await bis(() => s.state.value.wkr.listen[TOR]?.modus === 'digital')
    for (let i = 0; i < 3; i++) zeige(s)
    durch(s)
    await bis(() => frei.g.freigabe.value[P1]?.listen.find((l) => l.titel === TITEL)?.offen === 3)
    // Parcours-Ampel (fv 2, P-03): rot für den gezeigten Start, ohne Namen.
    expect(frei.g.freigabe.value[P1]).toMatchObject({ ampel: 'rot', ampelRef: aktuell(s.state.value).key, perKnopf: true, autoMoeglich: false })
    const f = frei.g.freigabe.value[P1]
    expect(f.listen.find((l) => l.titel === TITEL)).toMatchObject({ stand: 'aktiv', ampel: 'gehoert', warnt: true })
    // Das Listen-Handy hat die Freigabe-Gruppe nicht.
    expect(tor.g.freigabe.value).toEqual({})

    // Inhalt der Freigabe-Gruppe: nichts über Personen, Geräte, Werte.
    const r = raum()
    const eigene = await inhalte(r, FG)
    expect(eigene.some((x) => x !== 'nicht-lesbar')).toBe(true)
    const text = JSON.stringify(eigene)
    const personen = s.state.value.starters.flatMap((p) => [p.vorname, p.nachname, p.verein].filter((x) => x && x.length > 3))
    for (const verboten of [...personen, 'Handy Geheim', 'Steg Geheim', tor.id, frei.id, KENNUNG]) expect(text, verboten).not.toContain(verboten)
    // Die Anzeigetafel (Lese-Link: nur der Schlüssel von ko) kann die Freigabe-Gruppe nicht lesen; eigene Themen.
    const mitKo = await inhalte(r, FG, r.gruppen[OEFFENTLICH].k)
    expect(mitKo.length).toBeGreaterThan(0)
    expect(mitKo.every((x) => x === 'nicht-lesbar')).toBe(true)
    for (const g of [OEFFENTLICH, ZUSCHAUER]) for (const t of themenDerGruppe(r, g)) expect(themenDerGruppe(r, FG)).not.toContain(t)
    // Und ko/kz tragen nichts davon (F17).
    const oeffentlich = JSON.stringify([...(await inhalte(r, OEFFENTLICH)), ...(await inhalte(r, ZUSCHAUER))])
    for (const verboten of ['rueckfragen', 'warnt', '"fv"', TITEL]) expect(oeffentlich, verboten).not.toContain(verboten)
  })

  it('Verkehr: Freigabe-Sicht nur bei Änderung; ohne Eintrag geht nichts hinaus', async () => {
    const { s, h, raum } = await bedienrechner(undefined, { sammelnMs: 50 })
    const frei = await wkrHandy(h, [{ art: 'startfreigabe', bereiche: [P1] }])
    const FG = gruppeDerFreigabe(P1)
    const zahl = () => themenDerGruppe(raum(), FG).reduce((n, t) => n + ntfy.bodies(t).length, 0)
    zeige(s)
    await ruhe(300)
    // Keine Liste mit Eintrag: nichts gesendet, keine Leiste.
    expect(zahl()).toBe(0)
    expect(frei.g.freigabe.value).toEqual({})
    s.dispatch({ type: 'WKR_LISTE', liste: TOR, modus: 'digital' })
    await bis(() => frei.g.freigabe.value[P1]?.listen.length > 0)
    await ruhe(300)
    const nachEintrag = zahl()
    expect(nachEintrag).toBeGreaterThan(0)
    // Eine Änderung, die die Freigabe-Sicht nicht berührt (Meldung): kein neues Paket in der Freigabe-Gruppe.
    s.dispatch({ type: 'BETRIEB_MELDUNG', bereich: P1, meldung: { text: 'Kurze Pause', art: 'pause' } })
    await ruhe(300)
    expect(zahl()).toBe(nachEintrag)
    // Ein gezeigter Start ändert den Rückstand: genau eine Nachricht mehr.
    zeige(s)
    await bis(() => zahl() > nachEintrag)
    await ruhe(300)
    expect(zahl()).toBe(nachEintrag + 1)
  })

  it('Bestandsgerät (vor W2 gekoppelt, ohne Freigabe-Gruppe): bekommt den Schlüssel beim nächsten Start des Hosts', async () => {
    const { b, f, h, raum } = await bedienrechner()
    const frei = await wkrHandy(h, [{ art: 'startfreigabe', bereiche: [P1] }])
    const FG = gruppeDerFreigabe(P1)
    // Den Stand vor W2 nachstellen: Host anhalten, Gruppe aus Raum und Gerät nehmen.
    h.stop()
    frei.g.stop()
    const roh = JSON.parse(f.ablage.getItem(ABLAGE.raum)!)
    delete roh.raum.gruppen[FG]
    roh.raum.geraete[frei.id].gruppen = []
    f.ablage.setItem(ABLAGE.raum, JSON.stringify(roh))
    expect(raum().gruppen[FG]).toBeUndefined()
    // Neues Bedienfenster startet; das Handy (ebenfalls neu geladen) meldet sich NICHT selbst an – der Host schickt.
    const f2 = b.fenster()
    const s2 = fensterStore(f2)
    const h2 = hostIn(f2, s2)
    await bis(() => h2.verbindung.value?.status === 'verbunden')
    await bis(() => !!raum().gruppen[FG] && raum().geraete[frei.id].gruppen.includes(FG))
    const { g } = await neuGeladen(frei.speicher)
    s2.dispatch({ type: 'WKR_LISTE', liste: TOR, modus: 'digital' })
    zeige(s2)
    durch(s2)
    await bis(() => g.freigabe.value[P1]?.listen.some((l) => l.titel === TITEL && l.offen === 1))
  }, 15_000)

  it('Rechte: Bereich weg → neuer Schlüssel der Freigabe-Gruppe, das Gerät liest sie nicht mehr', () => {
    const r = { gruppen: {}, geraete: { g1: { pk: 'x', letzteNr: 0, gruppen: [], aufgaben: [] } } } as unknown as HostRaum
    expect(setzeAufgaben(r, 'g1', [{ art: 'startfreigabe', bereiche: [P1] }])).toEqual({ neu: [gruppeDerFreigabe(P1)], weg: [] })
    expect(setzeAufgaben(r, 'g1', [{ art: 'startfreigabe', bereiche: ['par_2'] }])).toEqual({ neu: [gruppeDerFreigabe('par_2')], weg: [gruppeDerFreigabe(P1)] })
  })
})

describe('W3.1: Gerätekern für die Maske (Schlange je Teil, Entwürfe, Zurückholen, Prüfansicht)', () => {
  it('Steg ganz auf einem Gerät: Ablegen nimmt den Start nur aus der Ablegen-Schlange; Anlegen danach aus allen (H3)', async () => {
    const { s, h } = await bedienrechner()
    const { e } = await wkrHandy(h, [{ art: 'liste', liste: STEG }], { name: 'Handy Steg' })
    /** Nie derselbe Starter zugleich im Ablegen und im Anlegen (Nutzer 21.11.2026, T1–T3). */
    const nieBeide = () => {
      const an = new Set(e.schlangeTeil(STEG, 'an').map((x) => x.key))
      expect(e.schlangeTeil(STEG, 'ab').filter((x) => an.has(x.key))).toEqual([])
    }
    await bis(() => s.state.value.wkr.listen[STEG]?.modus === 'digital')
    // Vor dem ersten Zeigen: Das Ablegen sieht „Als Nächstes“ schon (vorab), das Anlegen nichts.
    const kommt = lage(s.state.value, P1).naechster!.key
    await bis(() => e.schlangeTeil(STEG, 'ab').some((x) => x.key === kommt && x.vorab))
    expect(e.schlangeTeil(STEG, 'an')).toEqual([])
    const { key, starter } = await mitStart(s, e, STEG)
    expect(key).toBe(kommt)
    const sn = s.state.value.starters.find((p) => p.id === starter)!.startNr
    expect(e.schlangeTeil(STEG, 'ab').map((x) => x.key)).toContain(key)
    // Im Boot: noch kein Anlegen (T2).
    expect(e.schlangeTeil(STEG, 'an').map((x) => x.key)).not.toContain(key)
    nieBeide()
    const za = e.schicke(STEG, { s: key, teil: 'ab', zellen: {} })!
    expect(e.schlangeTeil(STEG, 'ab').some((x) => x.key === key)).toBe(false)
    expect(e.schlangeTeil(STEG, 'an').some((x) => x.key === key)).toBe(false)
    expect(e.zuletzt.value[0]).toMatchObject({ z: za, sn, teil: 'ab' })
    await bis(() => e.stufen.value[za].stufe === 'uebernommen')
    expect(werte(s.state.value, starter)['erfasst.ab@steg']).toBeTruthy()
    // Nächster Start: Der erste kommt zurück ins Anlegen, der zweite steht (noch) im Ablegen.
    zeige(s)
    const zweiter = aktuell(s.state.value).key
    await bis(() => e.schlangeTeil(STEG, 'an').some((x) => x.key === key))
    expect(e.schlangeTeil(STEG, 'ab').map((x) => x.key)).toContain(zweiter)
    nieBeide()
    // Die gemeinsame Schlange behält ihn, solange das Anlegen fehlt.
    expect(e.schlange.value[STEG].some((x) => x.key === key)).toBe(true)
    const zn = e.schicke(STEG, { s: key, teil: 'an', zellen: {} })!
    expect(e.schlange.value[STEG].some((x) => x.key === key)).toBe(false)
    expect(e.schlangeTeil(STEG, 'an').some((x) => x.key === key)).toBe(false)
    await bis(() => e.stufen.value[zn].stufe === 'uebernommen')
    expect(werte(s.state.value, starter)['erfasst@steg']).toBeTruthy()
    // Ablegen des zweiten nie geschickt, noch ein Start: Er ist zurück, wartet aber im Ablegen (T3) – nicht im Anlegen.
    zeige(s)
    // (Der dritte stand schon vorab im Ablegen – warten, bis die Sicht ihn als gezeigt führt.)
    await bis(() => e.schlangeTeil(STEG, 'ab').some((x) => x.key === aktuell(s.state.value).key && !x.vorab))
    expect(e.schlangeTeil(STEG, 'ab').map((x) => x.key)).toContain(zweiter)
    expect(e.schlangeTeil(STEG, 'an').map((x) => x.key)).not.toContain(zweiter)
    nieBeide()
    const z2 = e.schicke(STEG, { s: zweiter, teil: 'ab', zellen: {} })!
    expect(e.schlangeTeil(STEG, 'an').map((x) => x.key)).toContain(zweiter)
    await bis(() => e.stufen.value[z2].stufe === 'uebernommen')
    nieBeide()
    // Ungeteilte Liste: schlangeTeil gibt nichts Eigenes vor – nur die Teile des Stegs.
    expect(e.schlangeTeil(TOR, 'ab')).toEqual([])
  })

  it('Entwurf: übersteht das Neuladen, geht mit „abschicken“ und mit „Raum verlassen“; fremde Liste nimmt keinen', async () => {
    const { s, h } = await bedienrechner()
    const { e, speicher } = await wkrHandy(h, [{ art: 'liste', liste: TOR }])
    const { key, starter } = await mitStart(s, e)
    const sn = s.state.value.starters.find((p) => p.id === starter)!.startNr
    expect(e.merkeEntwurf(TOR, key, undefined, { [FELD]: '5' })).toBe(true)
    expect(e.merkeEntwurf(STEG, key, undefined, { [FELD]: '5' })).toBe(false)
    // Mit den Angaben fürs Papier (Prüfbefund W3): Titel, Bereich, Überschrift des Felds – nie ein Name.
    expect(e.entwuerfe.value).toEqual([{ liste: TOR, s: key, sn, zellen: { [FELD]: '5' }, papier: { titel: expect.any(String), bereich: expect.any(String), felder: { [FELD]: expect.any(String) } } }])
    // Leere Zellen allein sind kein Entwurf.
    expect(e.merkeEntwurf(TOR, 'leer', 'ab', { [FELD]: '' })).toBe(true)
    expect(e.entwuerfe.value).toHaveLength(1)
    e.stop()
    const neu = await neuGeladen(speicher)
    expect(neu.e.entwurf(TOR, key)).toEqual({ [FELD]: '5' })
    expect(neu.e.entwuerfe.value).toHaveLength(1)
    await bis(() => !!neu.e.schlange.value[TOR]?.some((x) => x.key === key))
    neu.e.schicke(TOR, { s: key, zellen: { [FELD]: '5' } })
    expect(neu.e.entwurf(TOR, key)).toBeNull()
    expect(neu.e.entwuerfe.value).toEqual([])
    neu.e.merkeEntwurf(TOR, 'anderer', undefined, { [FELD]: '3' })
    neu.e.verwirfEntwurf(TOR, 'anderer')
    expect(neu.e.entwuerfe.value).toEqual([])
    neu.e.merkeEntwurf(TOR, 'anderer', undefined, { [FELD]: '3' })
    expect(speicher.getItem(ABLAGE.geraetWkr)).toContain('anderer')
    neu.e.stop()
    verlasseRaum(speicher)
    expect(speicher.getItem(ABLAGE.geraetWkr)).toBeNull()
  })

  it('holeZurueck nur, solange die Zeile wartet: Werte zurück als Entwurf, Start wieder in der Schlange, nichts gesendet', async () => {
    const { s, h } = await bedienrechner()
    const { e } = await wkrHandy(h, [{ art: 'liste', liste: TOR }])
    const erster = await mitStart(s, e)
    zeige(s)
    const zweiter = aktuell(s.state.value)
    await bis(() => !!e.schlange.value[TOR]?.some((x) => x.key === zweiter.key))
    const z1 = e.schicke(TOR, { s: erster.key, zellen: { [FELD]: '5' } })!
    // Die erste ist unterwegs (ohne Quittung), also wartet die zweite im Ausgang.
    const z2 = e.schicke(TOR, { s: zweiter.key, zellen: { [FELD]: '3' } })!
    expect(e.stufen.value[z2]).toEqual({ stufe: 'unterwegs', gesendet: false })
    expect(e.holeZurueck(z1)).toBeNull()
    expect(e.holeZurueck(z2)).toEqual({ s: zweiter.key, zellen: { [FELD]: '3' } })
    expect(e.holeZurueck(z2)).toBeNull()
    expect(e.stufen.value[z2]).toBeUndefined()
    expect(e.entwurf(TOR, zweiter.key)).toEqual({ [FELD]: '3' })
    expect(e.schlange.value[TOR].some((x) => x.key === zweiter.key)).toBe(true)
    await bis(() => e.stufen.value[z1].stufe === 'uebernommen')
    await ruhe(100)
    expect(zeilenNachrichten(s).flatMap((a) => a.zeilen.map((x) => x.ref))).toEqual([erster.key])
    expect(werte(s.state.value, zweiter.eintrag!.starter)[FELD]).toBeUndefined()
    // Neu abgeschickt: `vorher` ist wieder leer (die zurückgeholte Zeile ging nie hinaus).
    const z3 = e.schicke(TOR, { s: zweiter.key, zellen: { [FELD]: '3' } })!
    await bis(() => e.stufen.value[z3].stufe === 'uebernommen')
    expect(werte(s.state.value, zweiter.eintrag!.starter)[FELD]).toBe('3')
  })

  it('pruefung: eigene Zeilen des Punkts mit Startnummer und Stufe, offene Starts, X (Steg je Teil)', async () => {
    const { s, h } = await bedienrechner()
    const { e } = await wkrHandy(h, [{ art: 'liste', liste: STEG }], { name: 'Handy Steg' })
    const erster = await mitStart(s, e, STEG)
    zeige(s)
    const zweiter = aktuell(s.state.value)
    await bis(() => !!e.schlange.value[STEG]?.some((x) => x.key === zweiter.key))
    const sn = (id: string) => s.state.value.starters.find((p) => p.id === id)!.startNr
    const za = e.schicke(STEG, { s: erster.key, teil: 'ab', zellen: { 'disq@steg': 'X' } })!
    await bis(() => e.stufen.value[za].stufe === 'uebernommen')
    const ab = e.pruefung(STEG, 'lauf:1', 'ab')
    expect(ab.zeilen).toEqual([{ s: erster.key, sn: sn(erster.starter), klasse: expect.any(String), zellen: { 'disq@steg': 'X' }, stufe: { stufe: 'uebernommen' }, x: true, nv: false }])
    expect(ab.x).toEqual([sn(erster.starter)])
    expect(ab.offen.map((x) => x.key)).toContain(zweiter.key)
    expect(ab.offen.map((x) => x.key)).not.toContain(erster.key)
    // Anlegen: noch keine eigene Zeile.
    expect(e.pruefung(STEG, 'lauf:1', 'an').zeilen).toEqual([])
    // Anderer Punkt: nichts offen, keine Zeilen.
    expect(e.pruefung(STEG, 'lauf:2')).toEqual({ zeilen: [], offen: [], x: [], nichtVorbei: [] })
    // Kein Name in der Prüfansicht.
    expect(JSON.stringify(ab)).not.toMatch(/Vor\d|Nach\d|Musterclub/)
  })
})

describe('Prüfbefunde W3 (21.11.2026): gemeinsame Felder des Stegs und Korrektur einer Korrektur, mit der Maske', () => {
  /** Aufbau der Maske für den Start (Klasse aus der Schlange). */
  function aufbauFuer(e: Erfassung, key: string) {
    const sicht = e.sichten.value[STEG]!
    const klasse = [...sicht.schlange, ...sicht.danach].find((x) => x.key === key)!.klasse
    return maskeFuer(sicht, klasse)!
  }

  it('Gerät für den ganzen Steg: Ablegen mit Disq. und Bemerkung, dann „Anlegen OK ✓“ – beide bleiben stehen', async () => {
    const { s, h } = await bedienrechner()
    const { e } = await wkrHandy(h, [{ art: 'liste', liste: STEG }], { name: 'Handy Steg' })
    const { key, starter } = await mitStart(s, e, STEG)
    const a = aufbauFuer(e, key)
    const code = a.teile.find((t) => t.teil === 'ab')!.codes[0].code
    const ablegen = mitBemerkung(tippeDisq(tippe(leererEntwurf(), a.teile.find((t) => t.teil === 'ab')!.feld, code), 'A'), 'Notiz')
    const za = e.schicke(STEG, { s: key, teil: 'ab', zellen: zellenAus(ablegen, a, 'ab') })!
    await bis(() => e.stufen.value[za].stufe === 'uebernommen')
    expect(werte(s.state.value, starter)).toMatchObject({ 'disq@steg': 'A', 'bemerkung@steg': 'Notiz' })
    // Die Maske schickt die gemeinsamen Felder auch leer mit – `vorher` kommt nur aus Zeilen DIESES Teils.
    const anlegen = zellenAus(leererEntwurf(), a, 'an')
    expect(anlegen).toMatchObject({ 'disq@steg': '', 'bemerkung@steg': '' })
    const zn = e.schicke(STEG, { s: key, teil: 'an', zellen: anlegen })!
    await bis(() => e.stufen.value[zn].stufe === 'uebernommen')
    const w = werte(s.state.value, starter)
    expect(w).toMatchObject({ 'disq@steg': 'A', 'bemerkung@steg': 'Notiz' })
    expect(w['erfasst@steg']).toBeTruthy()
    // Die Anlegen-Zeile trug die gemeinsamen Felder gar nicht (leer und ohne eigenes `vorher`).
    const letzte = zeilenNachrichten(s).at(-1)!.zeilen.at(-1)!
    expect(letzte.zellen.map((z) => z.feld)).not.toContain('disq@steg')
    // Der eigene Stand des Anlegens kennt die Disq. des Ablegens nicht; der des Ablegens schon.
    expect(e.stand(zn)).not.toHaveProperty('disq@steg')
    expect(e.stand(za)).toMatchObject({ 'disq@steg': 'A', 'bemerkung@steg': 'Notiz' })
    // Ein zweiter Buchstabe im Anlegen kommt dazu (vereinigt), A bleibt.
    const zweiter = disqFuer(a, 'an').find((c) => c.code !== 'A' && c.code !== 'X')!.code
    const b = zellenAus(tippeDisq(entwurfAus(e.stand(zn)!, a), zweiter), a, 'an')
    const zk = e.korrigiere(zn, b)!
    await bis(() => e.stufen.value[zk]?.stufe === 'uebernommen')
    expect(werte(s.state.value, starter)['disq@steg']).toBe(`A, ${zweiter}`)
    // Prüfansicht ohne Teil (ganzer Steg) zeigt beide wie der Bedienrechner.
    expect(e.pruefung(STEG, 'lauf:1').zeilen[0].zellen['disq@steg']).toBe(`A, ${zweiter}`)
  })

  it('Korrektur einer Korrekturzeile leert kein unverändertes Feld (Entwurf aus dem eigenen Stand, nicht aus c)', async () => {
    const { s, h } = await bedienrechner()
    const { e } = await wkrHandy(h, [{ art: 'liste', liste: STEG }], { name: 'Handy Steg' })
    const { key, starter } = await mitStart(s, e, STEG)
    const a = aufbauFuer(e, key)
    const ab = a.teile.find((t) => t.teil === 'ab')!
    const code = ab.codes[0].code
    const z1 = e.schicke(STEG, { s: key, teil: 'ab', zellen: zellenAus(tippe(leererEntwurf(), ab.feld, code), a, 'ab') })!
    await bis(() => e.stufen.value[z1].stufe === 'uebernommen')
    const k1 = e.korrigiere(z1, zellenAus(tippeDisq(entwurfAus(e.stand(z1)!, a), 'A'), a, 'ab'))!
    await bis(() => e.stufen.value[k1]?.stufe === 'uebernommen')
    // Die Korrekturzeile trägt nur das Geänderte …
    expect(e.zuletzt.value.find((z) => z.z === k1)!.zellen).toEqual({ 'disq@steg': 'A' })
    // … ihr Stand aber alles.
    const stand = e.stand(k1)!
    expect(stand[ab.feld]).toBe(werte(s.state.value, starter)[ab.feld])
    const k2 = e.korrigiere(k1, zellenAus(mitBemerkung(entwurfAus(stand, a), 'Wind'), a, 'ab'))!
    await bis(() => e.stufen.value[k2]?.stufe === 'uebernommen')
    const w = werte(s.state.value, starter)
    expect(w[ab.feld]).toBeTruthy()
    expect(w).toMatchObject({ 'disq@steg': 'A', 'bemerkung@steg': 'Wind' })
  })
})

describe('W3.2: Liste aus der Oberfläche zuweisen (Ende zu Ende)', () => {
  it('Koppeln.vue: Steg „nur Ablegen“ wählen → Geräte-Code → Handy gekoppelt mit genau dieser Aufgabe, Sicht kommt an', async () => {
    vergissAlles()
    setLocale('de')
    const { s, h } = await bedienrechner()
    // Das Fenster-Doppel trägt state/dispatch wie der Store – mehr lesen die Komponenten nicht.
    const store = { state: s.state, dispatch: s.dispatch } as unknown as Store
    const w = mount(GeraeteKoppeln, { attachTo: document.body, global: { provide: { [storeKey as symbol]: store, [geraeteHostKey as symbol]: h } } })
    try {
      await nextTick()
      await w.find('select[data-feld="koppeln-liste"]').setValue(STEG)
      await w.find('[data-teil="koppeln-teil"] [data-wahl-teil="ab"]').trigger('click')
      // Ein Parcours ist es nicht (zwei): ohne Häkchen nur die Liste.
      await w.find('[data-action="koppeln-code"]').trigger('click')
      await bis(() => !!h.raum.value?.koppeln.code)
      expect(h.raum.value!.koppeln.code!.aufgaben).toEqual([{ art: 'liste', liste: STEG, teil: 'ab' }])

      const speicher = handy()
      const r = oeffneKoppelLink(h.raum.value!.koppelLink, { ablage: speicher, zeiten: SCHNELL, ablaufTaktMs: 20 })
      if (!r.ok) throw new Error(r.code)
      const g = r.geraet
      const e = starteKern(g, speicher, {})
      await g.start()
      g.koppeln('Handy Ablegen', h.raum.value!.koppeln.code!.wert)
      await bis(() => g.lage.value === 'gekoppelt')
      expect(e.listen.value).toEqual([{ art: 'liste', liste: STEG, teil: 'ab' }])
      await bis(() => !!e.sichten.value[STEG]?.geraete[g.kanal.id()!])
      // Der Host stellt die Liste digital; ein gezeigter Start kommt in die Schlange des Teils.
      const start = await mitStart(s, e, STEG)
      expect(e.schlangeTeil(STEG, 'ab').map((x) => x.key)).toContain(start.key)
      // Kein Name auf der Leitung zum Gerät (F6).
      expect(JSON.stringify(e.sichten.value[STEG])).not.toMatch(/Vor\d|Nach\d|Musterclub/)
    } finally {
      w.unmount()
    }
  })
})

describe('Befund 15 des Handy-Tests (21.11.2026): „Mann-über-Bord 3 offen“, am Handy alles ✓', () => {
  // Ablauf wie beim Nutzer: DM, Klasse 6 (mit Mann-über-Bord), Liste gekoppelt, die Start-Freigabe zeigt nacheinander,
  // das Handy schickt je Start „Fehlerfrei“. Dazu ein zweiter Tab mit derselben Kopplung (QR-Code noch einmal
  // gescannt bzw. alter Tab nach dem Neuladen wieder wach), der ein Lebenszeichen schickt. Vorher vergaben beide Tabs
  // dieselben Nummern: Der Host nahm die Zeile als schon bearbeitet, `bis` der Sicht deckte sie – ✓ am Handy, kein
  // Haken am Bedienrechner, Rückstand wuchs.
  const STARTER = [...Array.from({ length: 6 }, (_, i) => betriebStarter(`s6${i}`, '6', `60${i + 1}`)), ...Array.from({ length: 3 }, (_, i) => betriebStarter(`s4${i}`, '4', `40${i + 1}`))]
  const P2 = 'par_2'
  const MUEB = listenKennung({ bereich: P2, typeId: 'mueb', racecourse: null })

  it('zwei Tabs auf dem Handy: jede Zeile mit ✓ trägt am Bedienrechner den Haken, kein Rückstand', async () => {
    const { s, h } = await bedienrechner(() => wkrBetriebsStand(STARTER))
    zeige(s, P2)
    const { e, speicher } = await wkrHandy(h, [{ art: 'liste', liste: MUEB }])
    await bis(() => s.state.value.wkr.listen[MUEB]?.modus === 'digital')
    let versatz = 0
    const zweiter = await neuGeladen(speicher, { uhr: () => Date.now() + versatz })
    await bis(() => zweiter.g.status.value === 'verbunden')
    const konfig = configFor({ regelwerk: s.state.value.regelwerk })
    const muebLage = () => erfassungsLage(s.state.value, konfig, P2, geraetAngaben(h.raum.value?.geraete ?? []), Date.now()).listen.find((l) => l.liste === MUEB)!
    // Der zweite Tab war still: Er meldet sich mit einem Lebenszeichen.
    versatz = 61_000
    for (let i = 0; i < 4; i++) {
      zeige(s, P2)
      const a = aktuell(s.state.value, P2)
      await bis(() => !!e.schlange.value[MUEB]?.some((x) => x.key === a.key))
      const start = e.schlange.value[MUEB].find((x) => x.key === a.key)!
      const z = e.schicke(MUEB, { s: start.key, zellen: zellenAus(leererEntwurf(), maskeFuer(e.sichten.value[MUEB]!, start.klasse, 'liste')!) })!
      await bis(() => e.stufen.value[z].stufe === 'uebernommen')
      expect(werte(s.state.value, a.eintrag!.starter)['erfasst@mueb']).toBe('1')
    }
    expect(muebLage().rueckstand).toBeNull()
    expect(s.state.value.wkr.rueckfragen).toEqual([])
  })
})

describe('W4.2: Bojen-Maske Ende zu Ende (21.11.2026, Plan docs/plan-wkr-w4.md §8.2)', () => {
  /** Die Maske des Starts (Klasse aus der Sicht), wie WkrMaske sie baut. */
  function aufbauFuer(e: Erfassung, liste: string, key: string) {
    const sicht = e.sichten.value[liste]!
    const klasse = [...sicht.schlange, ...sicht.danach].find((x) => x.key === key)!.klasse
    return maskeFuer(sicht, klasse)!
  }

  it('gate135: jede Boje einmal (Tor 5 zweimal) und Disq. in EINER Zeile → genau diese Zellen am Bedienrechner', async () => {
    const { s, h } = await bedienrechner()
    const { e } = await wkrHandy(h, [{ art: 'liste', liste: TOR }])
    const { key, starter } = await mitStart(s, e, TOR)
    const a = aufbauFuer(e, TOR, key)
    expect(a.art).toBe('bojen')
    let entwurf = leererEntwurf()
    for (const b of bojenVon(a)) {
      entwurf = tippeBoje(entwurf, b)
      if (b.zaehler) entwurf = tippeBoje(entwurf, b)
    }
    const code = disqFuer(a).find((c) => c.code !== 'X')!.code
    entwurf = tippeDisq(entwurf, code)
    const zellen = zellenAus(entwurf, a)
    const z = e.schicke(TOR, { s: key, zellen })!
    await bis(() => e.stufen.value[z].stufe === 'uebernommen')
    const w = werte(s.state.value, starter)
    for (const b of bojenVon(a)) expect(w[b.feld], b.feld).toBe(b.zaehler ? '10' : '5')
    expect(w[a.disq!.feld]).toBe(code)
    expect(w['erfasst@gate135']).toBeTruthy()
    // Keine Rückfrage, kein Vorschlag: Jeder Wert ging unverändert durch wertGilt.
    expect(s.state.value.wkr.rueckfragen).toEqual([])
    expect(entwurfAus(e.stand(z)!, a).bojen).toEqual(entwurf.bojen)
  })

  it('moewe135: Bojen UND Einfahrt Tor 5 (Katalog) in einer Zeile', async () => {
    const start = () => {
      let st = festgeschrieben(reducer(betriebsStand(), { type: 'SET_AUFBAU', aufbau: 'moewe' }))
      for (const bereich of ['par_1', 'par_2']) st = reducer(st, { type: 'BETRIEB_BEGINNEN', bereich, punkt: 'lauf:1', zeit: 500 })
      return st
    }
    const MOEWE = listenKennung({ bereich: P1, typeId: 'moewe135', racecourse: null })
    const { s, h } = await bedienrechner(start)
    const { e } = await wkrHandy(h, [{ art: 'liste', liste: MOEWE }])
    const { key, starter } = await mitStart(s, e, MOEWE)
    const a = aufbauFuer(e, MOEWE, key)
    expect(a.art).toBe('bojen')
    const einfahrt = a.abschnitte.find((x) => x.art === 'katalog')
    if (!einfahrt || einfahrt.art !== 'katalog') throw new Error('kein Einfahrt-Katalog')
    const tor1 = bojenVon(a).find((b) => b.feld.startsWith('t1a|'))!
    const tor5 = bojenVon(a).find((b) => b.zaehler)!
    let entwurf = tippeBoje(tippeBoje(tippeBoje(leererEntwurf(), tor1), tor5), tor5)
    entwurf = tippe(entwurf, einfahrt.teil.feld, einfahrt.teil.codes[0].code)
    const z = e.schicke(MOEWE, { s: key, zellen: zellenAus(entwurf, a) })!
    await bis(() => e.stufen.value[z].stufe === 'uebernommen')
    const w = werte(s.state.value, starter)
    expect([w[tor1.feld], w[tor5.feld], w[einfahrt.teil.feld]]).toEqual(['5', '10', einfahrt.teil.codes[0].code])
    expect(w['erfasst@moewe135']).toBeTruthy()
    expect(zeilenNachrichten(s).filter((x) => x.liste === MOEWE)).toHaveLength(1)
  })
})

// Nutzer 21.11.2026: „Beim Abmelden auf dem WKR-Gerät bleibt die Position trotzdem offen und es wird der nächste Starter
// angezeigt. … Das muss so sein, als ob ich die Liste von dem Gerät entferne.“ (WKR_ANNAHMEN.abmeldenWieEntfernen, T5–T7)
describe('Abmelden am Gerät wirkt wie Liste entfernen (Nutzer 21.11.2026)', () => {
  const lageVon = (st: AppState, liste: string, h: GeraeteHost) =>
    erfassungsLage(st, configFor(st), P1, geraetAngaben(h.raum.value?.geraete ?? []), Date.now()).listen.find((l) => l.liste === liste)!

  it('Tor: Liste abgemeldet (▭, kein Rückstand, keine Rückfrage), Aufgabe weg, neuer Schlüssel; neu zuweisen holt das Gerät zurück', async () => {
    const { s, h, raum } = await bedienrechner()
    s.dispatch({ type: 'SET_ANZEIGE', patch: { wkrRueckstand: 1, wkrWarnung: 'nachfragen' } })
    const { e, id } = await wkrHandy(h, [{ art: 'liste', liste: TOR }])
    const { key } = await mitStart(s, e)
    durch(s)
    expect(lageVon(s.state.value, TOR, h).warnt).toBe(true)
    const schluesselVorher = raum().gruppen[gruppeDerListe(TOR)]
    const titel = e.sichten.value[TOR]!.titel
    expect(e.meldeAb(TOR)).not.toBeNull()
    // Sofort in Ruhe – nicht erst mit der Quittung; keine Zeilen mehr.
    expect(e.abgemeldet.value).toEqual([{ liste: TOR, titel, bereich: expect.any(String) }])
    expect(e.schlange.value[TOR]).toEqual([])
    expect(e.schicke(TOR, { s: key, zellen: {} })).toBeNull()
    await bis(() => s.state.value.wkr.listen[TOR].status === 'abgemeldet' && e.listen.value.length === 0)
    expect(s.state.value.wkr.listen[TOR].pausen.at(-1)!.papier).toContain(key)
    const l = lageVon(s.state.value, TOR, h)
    expect(l).toMatchObject({ status: 'abgemeldet', rueckstand: null, warnt: false, geraete: [] })
    expect(l.zellen[key].zelle).toBe('papier')
    expect(raum().geraete[id].aufgaben).toEqual([])
    expect(raum().geraete[id].gruppen).not.toContain(gruppeDerListe(TOR))
    expect(raum().gruppen[gruppeDerListe(TOR)]).not.toEqual(schluesselVorher)
    // Die Ruhe-Ansicht bleibt, auch nachdem der Bedienrechner die Liste genommen hat.
    expect(e.abgemeldet.value.map((a) => a.liste)).toEqual([TOR])
    // Neu zuweisen am Bedienrechner: Das Gerät ist wieder dabei (Status setzt der Bediener mit „Weiter“).
    h.setzeAufgaben(id, [{ art: 'liste', liste: TOR }])
    await bis(() => e.listen.value.length === 1 && e.abgemeldet.value.length === 0 && !!e.sichten.value[TOR])
  })

  it('Steg, nur ein Teil-Gerät (Ablegen): Abmelden meldet die ganze Liste ab – der Anlegen-Teil ohne Gerät fragt nicht (Ursache)', async () => {
    const { s, h } = await bedienrechner()
    s.dispatch({ type: 'SET_ANZEIGE', patch: { wkrRueckstand: 1, wkrWarnung: 'nachfragen' } })
    const { e } = await wkrHandy(h, [{ art: 'liste', liste: STEG, teil: 'ab' }], { name: 'Handy Ablegen' })
    await mitStart(s, e, STEG)
    zeige(s)
    expect(e.meldeAb(STEG)).not.toBeNull()
    await bis(() => s.state.value.wkr.listen[STEG].status === 'abgemeldet' && e.listen.value.length === 0)
    const l = lageVon(s.state.value, STEG, h)
    expect(l).toMatchObject({ status: 'abgemeldet', rueckstand: null, warnt: false })
  })

  it('Steg ganz neben einem Anlegen-Gerät: nur das Ablegen wird Papier, das Anlegen-Gerät erfasst weiter (Prüfbefund 21.11.2026)', async () => {
    const { s, h, raum } = await bedienrechner()
    const a = await wkrHandy(h, [{ art: 'liste', liste: STEG }], { name: 'Handy Steg' })
    const b = await wkrHandy(h, [{ art: 'liste', liste: STEG, teil: 'an' }], { name: 'Handy Anlegen' })
    const { key } = await mitStart(s, a.e, STEG)
    expect(a.e.meldeAb(STEG)).not.toBeNull()
    // Wie „Liste entfernen“ bei EINEM Gerät: Was das andere Gerät abdeckt (Anlegen), bleibt digital.
    await bis(() => b.e.sichten.value[STEG]?.teile?.ab.status === 'abgemeldet' && a.e.listen.value.length === 0)
    expect(s.state.value.wkr.listen[STEG].status).toBe('aktiv')
    expect(b.e.sichten.value[STEG]!.teile!.an.status).toBe('aktiv')
    expect(raum().geraete[b.id].aufgaben).toEqual([{ art: 'liste', liste: STEG, teil: 'an' }])
    zeige(s)
    await bis(() => !!b.e.schlange.value[STEG]?.some((x) => x.key === key))
  })

  it('Tor mit zwei Geräten: Abmelden des einen lässt die Liste aktiv, das andere erfasst weiter', async () => {
    const { s, h, raum } = await bedienrechner()
    const a = await wkrHandy(h, [{ art: 'liste', liste: TOR }], { name: 'Handy Tor 1' })
    const b = await wkrHandy(h, [{ art: 'liste', liste: TOR }], { name: 'Handy Tor 2' })
    const { key, starter } = await mitStart(s, a.e)
    expect(a.e.meldeAb(TOR)).not.toBeNull()
    await bis(() => a.e.listen.value.length === 0)
    expect(s.state.value.wkr.listen[TOR].status).toBe('aktiv')
    expect(raum().geraete[a.id].aufgaben).toEqual([])
    const z = b.e.schicke(TOR, { s: key, zellen: { [FELD]: '5' } })!
    await bis(() => b.e.stufen.value[z].stufe === 'uebernommen')
    expect(werte(s.state.value, starter)[FELD]).toBe('5')
    expect(s.state.value.wkr.vorschlaege).toEqual([])
  })

  it('neu zugewiesen, ohne dass das Gerät die Liste fehlen sah (Erfassung geschlossen): die Ruhe fällt mit der neuen Sicht', async () => {
    const { s, h } = await bedienrechner()
    const { g, e, id, speicher } = await wkrHandy(h, [{ art: 'liste', liste: TOR }])
    await mitStart(s, e)
    expect(e.meldeAb(TOR)).not.toBeNull()
    await bis(() => s.state.value.wkr.listen[TOR].status === 'abgemeldet')
    // Die Erfassung schläft (Tab im Hintergrund, Neuladen) – das Fehlen der Liste sieht sie womöglich nie.
    e.stop()
    await bis(() => !g.aufgaben.value.some((a) => a.art === 'liste'))
    // Wie GeraetFreigabe: Die Erfassung öffnet, sobald das Gerät wieder eine Liste hat (vor deren Sicht).
    let e2: Erfassung | null = null
    const halt = watch(g.aufgaben, (a) => {
      if (!e2 && a.some((x) => x.art === 'liste')) e2 = starteKern(g, speicher, {})
    }, { flush: 'sync' })
    h.setzeAufgaben(id, [{ art: 'liste', liste: TOR }])
    await bis(() => e2 !== null)
    halt()
    // Sie beginnt mit der alten Ruhe (die Liste fehlte nie in IHREM Blick) – die neue Sicht hebt sie auf.
    await bis(() => e2!.abgemeldet.value.length === 0 && !!e2!.sichten.value[TOR])
  })
})

describe('Auto-Modus der Start-Freigabe (Nutzer 21.11.2026, P-03; AM6/AM7)', () => {
  // Seit 22.11.2026 (R7-01, AM2 umgebaut) ist auch die Zeit-Liste eine Parcours-Liste – ohne ihr Gerät kein Auto (AM6).
  const PARCOURS = ['gate135', 'gate245', 'tor5', 'mueb', 'parcours', 'zeit'].map((typeId) => listenKennung({ bereich: P1, typeId, racecourse: null }))

  /** Jede Parcours-Liste von Parcours 1 mit Gerät (zwei Listen je Handy), Auto-Modus an, ein Start gezeigt und grün. */
  async function auto() {
    const r = await bedienrechner(undefined, { sammelnMs: 30 })
    let e: Erfassung | null = null
    for (let i = 0; i < PARCOURS.length; i += 2) e = (await wkrHandy(r.h, PARCOURS.slice(i, i + 2).map((liste) => ({ art: 'liste', liste }) as Aufgabe), { name: `Handy ${i}` })).e
    await bis(() => PARCOURS.every((l) => r.s.state.value.wkr.listen[l]?.modus === 'digital'))
    r.s.dispatch({ type: 'SET_ANZEIGE', patch: { wkrAuto: true } })
    const gruen = async () => {
      // Der Host muss die Ampel dieses Starts grün gesehen haben (sonst kein Auto, AM6). Er prüft sie im selben Zug, in
      // dem er die Listen-Sichten verteilt – sieht das Gerät „grün“ für diesen Start, hat der Host sie gesehen.
      const key = aktuell(r.s.state.value).key
      await bis(() => e!.sichten.value[PARCOURS[4]]?.ampel?.key === key && e!.sichten.value[PARCOURS[4]]?.ampel?.ampel === 'gruen')
    }
    zeige(r.s)
    await gruen()
    const erster = aktuell(r.s.state.value).key
    const fertig = () =>
      r.s.dispatch({ type: 'SET_EINGABEN', zellen: PARCOURS.map((l) => ({ lauf: LAUF, starter: aktuell(r.s.state.value).eintrag!.starter, feld: `erfasst@${JSON.parse(l)[2]}`, wert: '1' })) })
    return { ...r, erster, fertig, gruen }
  }

  it('alle Parcours-Listen abgeschickt → Countdown → der Host zeigt den Nächsten', async () => {
    const { s, h, erster, fertig } = await auto()
    expect(h.auto?.value).toEqual({})
    fertig()
    await bis(() => !!h.auto?.value[P1])
    expect(h.auto!.value[P1]!.ref).toBe(erster)
    await bis(() => aktuell(s.state.value).key !== erster)
    expect(h.auto!.value[P1]).toBeUndefined()
  }, 20_000)

  it('„Anhalten“ hält bis zum nächsten Start; Pause-Meldung und nicht gesehenes Grün zählen nie', async () => {
    const { s, h, erster, fertig, gruen } = await auto()
    fertig()
    await bis(() => !!h.auto?.value[P1])
    h.halteAuto!(P1, erster)
    expect(h.auto!.value[P1]).toBeUndefined()
    // Dass NICHTS geschieht, zeigt sich erst nach dem Verzug (3 s) – hier ist eine feste Pause die Prüfung selbst.
    await ruhe(3500)
    expect(aktuell(s.state.value).key).toBe(erster)
    // Von Hand weiter: Der nächste Start ist wieder automatisch – außer mit Meldung „Pause“.
    s.dispatch({ type: 'BETRIEB_MELDUNG', bereich: P1, meldung: { text: 'Mittagspause', art: 'pause' } })
    zeige(s)
    await gruen()
    fertig()
    await ruhe(3500)
    expect(h.auto!.value[P1]).toBeUndefined()
    expect(aktuell(s.state.value).key).not.toBe(erster)
  }, 20_000)

  it('zweites Bedienfenster (Prüfbefund 21.11.2026): sieht den Countdown über den Fensterbus, „Anhalten“ von dort wirkt', async () => {
    const { b, s, h, erster, fertig } = await auto()
    const f2 = b.fenster()
    const h2 = hostIn(f2, fensterStore(f2))
    await bis(() => !!h2.raum.value)
    expect(h2.fuehrt.value).toBe(false)
    fertig()
    await bis(() => !!h2.auto?.value[P1])
    expect(h2.auto!.value[P1]).toEqual(h.auto!.value[P1])
    h2.halteAuto!(P1, erster)
    await bis(() => !h.auto!.value[P1] && !h2.auto!.value[P1])
    // Dass NICHTS geschieht, zeigt sich erst nach dem Verzug (3 s) – die feste Pause ist hier die Prüfung selbst.
    await ruhe(3500)
    expect(aktuell(s.state.value).key).toBe(erster)
  }, 20_000)
})

describe('WKR-Name aus der Veranstaltung (Nutzer 21.11.2026, W3-13, WN1–WN3)', () => {
  const EINTEILUNG = 'Erika Einteilung'
  const VERTRETUNG = 'Max Vertretung'
  const mitEinteilung = () => ({ ...wkrBetriebsStand(), einteilung: { [P1]: { gate135: EINTEILUNG } } })

  it('vorbelegt aus der Sicht der eigenen Liste; Ändern → Lebenszeichen → Register; Übernehmen in die Veranstaltung räumt beide', async () => {
    const { s, h, raum } = await bedienrechner(mitEinteilung)
    const tor = await wkrHandy(h, [{ art: 'liste', liste: TOR }])
    const steg = await wkrHandy(h, [{ art: 'liste', liste: STEG }], { name: 'Handy Steg' })
    expect(tor.e.wkrName(TOR)).toEqual({ name: EINTEILUNG, einteilung: EINTEILUNG, eigen: false })
    // WN1: nur der Name der EIGENEN Liste – der Steg hat keinen Eintrag, sieht also keinen.
    expect(steg.e.wkrName(STEG)).toEqual({ name: '', einteilung: '', eigen: false })
    expect(JSON.stringify(steg.e.sichten.value)).not.toContain(EINTEILUNG)
    // Fremde Liste: nichts zu setzen.
    expect(tor.e.setzeWkrName(STEG, VERTRETUNG)).toBe(false)

    // WN2: Ändern geht sofort im Lebenszeichen hinaus, auch ohne Stille – der Host legt es im Register ab.
    expect(tor.e.setzeWkrName(TOR, ` ${VERTRETUNG} `)).toBe(true)
    expect(tor.e.wkrName(TOR)).toEqual({ name: VERTRETUNG, einteilung: EINTEILUNG, eigen: true })
    await bis(() => raum().geraete[tor.id].wkrNamen?.[TOR] === VERTRETUNG)
    await bis(() => h.raum.value?.geraete.find((g) => g.id === tor.id)?.wkrNamen?.[TOR] === VERTRETUNG)
    // Nie im AppState (außer im Abschluss): Der Stand kennt den Namen nicht – also auch keine Sicherung oder Vorlage.
    expect(JSON.stringify(s.state.value)).not.toContain(VERTRETUNG)
    expect(JSON.stringify(makeFile('sicherung', s.state.value, '2026-11-21T20:00:00.000Z'))).not.toContain(VERTRETUNG)
    const vorlage = JSON.stringify(makeFile('vorlage', s.state.value, '2026-11-21T20:00:00.000Z'))
    expect(vorlage).not.toContain(VERTRETUNG)
    expect(vorlage).not.toContain(EINTEILUNG)

    // Gerätelokal je Raum und Liste: übersteht das Neuladen.
    tor.e.stop()
    tor.g.stop()
    const neu = await neuGeladen(tor.speicher)
    await bis(() => !!neu.e.sichten.value[TOR])
    expect(neu.e.wkrName(TOR)).toEqual({ name: VERTRETUNG, einteilung: EINTEILUNG, eigen: true })

    // „In Veranstaltung übernehmen“ (SET_WKR_NAME): Die Sicht bringt den Namen, das Gerät hat keine Abweichung mehr,
    // das nächste Lebenszeichen räumt das Register.
    s.dispatch({ type: 'SET_WKR_NAME', parcoursId: P1, typeId: 'gate135', name: VERTRETUNG })
    await bis(() => neu.e.wkrName(TOR).eigen === false)
    expect(neu.e.wkrName(TOR)).toEqual({ name: VERTRETUNG, einteilung: VERTRETUNG, eigen: false })
    await bis(() => raum().geraete[tor.id].wkrNamen === undefined)
    // Danach kommt eine neue Einteilung wieder auf dem Gerät an.
    s.dispatch({ type: 'SET_WKR_NAME', parcoursId: P1, typeId: 'gate135', name: EINTEILUNG })
    await bis(() => neu.e.wkrName(TOR).name === EINTEILUNG)
    // Übernommen steht der Name in der Einteilung: in der Sicherung, nie in der Vorlage (Personenangabe).
    s.dispatch({ type: 'SET_WKR_NAME', parcoursId: P1, typeId: 'gate135', name: VERTRETUNG })
    expect(JSON.stringify(makeFile('sicherung', s.state.value, '2026-11-21T20:00:00.000Z'))).toContain(VERTRETUNG)
    expect(JSON.stringify(makeFile('vorlage', s.state.value, '2026-11-21T20:00:00.000Z'))).not.toContain(VERTRETUNG)
  })

  it('zurück zur Einteilung: gleicher Name oder leer heißt keine Abweichung; Raum verlassen löscht den Namen (WN3 bleibt Rückfall)', async () => {
    const { h, raum } = await bedienrechner(mitEinteilung)
    const tor = await wkrHandy(h, [{ art: 'liste', liste: TOR }])
    tor.e.setzeWkrName(TOR, VERTRETUNG)
    await bis(() => raum().geraete[tor.id].wkrNamen?.[TOR] === VERTRETUNG)
    tor.e.setzeWkrName(TOR, EINTEILUNG)
    expect(tor.e.wkrName(TOR).eigen).toBe(false)
    await bis(() => raum().geraete[tor.id].wkrNamen === undefined)
    tor.e.setzeWkrName(TOR, VERTRETUNG)
    tor.e.setzeWkrName(TOR, '  ')
    expect(tor.e.wkrName(TOR)).toEqual({ name: EINTEILUNG, einteilung: EINTEILUNG, eigen: false })
    // Zu lang: abgewiesen.
    expect(tor.e.setzeWkrName(TOR, 'x'.repeat(61))).toBe(false)
    tor.e.setzeWkrName(TOR, VERTRETUNG)
    expect(tor.speicher.getItem(ABLAGE.geraetWkr)).toContain(VERTRETUNG)
    tor.e.stop()
    tor.g.stop()
    verlasseRaum(tor.speicher)
    expect([...tor.speicher.daten.values()].join('\n')).not.toContain(VERTRETUNG)
  })
})

// W5.3 (22.11.2026, Plan docs/plan-wkr-w5.md §6, WKR_ANNAHMEN KN1–KN8): Knoten-Prüfliste am Tisch Ende zu Ende –
// Liste ohne Lauf, Start = Starter (`["o", id]`), Bestand statt Schlange, Abschluss der ganzen Liste (Punkt `ohne`).
describe('Knoten am Tisch Ende zu Ende (W5.3)', () => {
  const KNOTEN = listenKennung({ bereich: 'tisch', typeId: 'knoten', racecourse: null })
  const LAUF0 = 'manoevrieren/0'

  it('koppeln → Bestand; Nummer → Prüfliste → Werte und Haken; Korrektur; Abschluss mit „Rest auf Papier“', async () => {
    const { s, h, raum } = await bedienrechner()
    const { e, id } = await wkrHandy(h, [{ art: 'liste', liste: KNOTEN }], { name: 'Pad Tisch' })
    expect(raum().geraete[id].gruppen).toEqual([gruppeDerListe(KNOTEN)])
    await bis(() => s.state.value.wkr.listen[KNOTEN]?.modus === 'digital')
    await bis(() => (e.bestand.value[KNOTEN]?.length ?? 0) > 0)
    const sicht = e.sichten.value[KNOTEN]!
    expect([sicht.punkt?.id, sicht.schlange, sicht.offen]).toEqual(['ohne', [], { n: 7, m: 7 }])
    // Keine Schlange der Startfolge – auch nicht, wenn der Betrieb Starts zeigt (am Tisch fährt kein Boot).
    zeige(s)
    await bis(() => lage(s.state.value, P1).aktuell !== null)
    expect(e.schlange.value[KNOTEN]).toEqual([])

    // Nummer 101 eintippen: der Starter aus dem Bestand, Maske „Prüfliste“, ✗ am dritten Knoten.
    const k1 = e.bestand.value[KNOTEN].find((b) => b.startNr === '101')!
    const aufbau = maskeFuer(sicht, k1.klasse)!
    expect(aufbau.art).toBe('pruefliste')
    let ent = leererEntwurf()
    aufbau.pruef.forEach((p, i) => (ent = tippePruef(ent, aufbau, p.feld, i === 2 ? 'fehler' : 'ok')))
    const z = e.schicke(KNOTEN, { s: k1.key, zellen: zellenAus(ent, aufbau) })!
    // Sofort erledigt auf dem Gerät (eigene Zeile), ohne auf die Sicht zu warten (KN8: Nummernfeld frei für den nächsten).
    expect(e.bestand.value[KNOTEN].find((b) => b.key === k1.key)).toMatchObject({ erledigt: true, z })
    // KN9 (22.11.2026): Vorschlag aus dem echten Kern – der nächste offene NACH der zuletzt geschickten Nummer, schon
    // vor der Quittung (zuletzt = eigene Zeilen, gerätelokal).
    const folge = e.bestand.value[KNOTEN]
    const vorschlag = () => naechsterOffener(e.bestand.value[KNOTEN], e.zuletzt.value.find((x) => x.liste === KNOTEN)?.s)
    expect(vorschlag()?.key).toBe(folge.slice(folge.findIndex((b) => b.key === k1.key) + 1).concat(folge).find((b) => !b.erledigt)?.key)
    await bis(() => e.stufen.value[z].stufe === 'uebernommen')
    const feld = aufbau.pruef[2].feld
    expect(werteVon(s.state.value.eingaben, LAUF0, 'k1')).toMatchObject({ [feld]: '5', 'erfasst@knoten': '1' })
    await bis(() => e.sichten.value[KNOTEN]?.offen?.n === 6)

    // Korrektur der erledigten Nummer: doch richtig gebunden.
    const k = e.korrigiere(z, { [feld]: '' })!
    await bis(() => e.stufen.value[k]?.stufe === 'uebernommen')
    expect(werteVon(s.state.value.eingaben, LAUF0, 'k1')[feld] ?? '').toBe('')

    // Matrix am Bedienrechner: eigener Block, nie Rückstand, Gerät gehört.
    const [t] = tischLage(s.state.value, configFor({ regelwerk: 'dm-2026' }), geraetAngaben(h.raum.value?.geraete ?? []), Date.now())
    expect([t.knoten.offen, t.knoten.gesamt, t.rueckstand, t.warnt]).toEqual([6, 7, null, false])
    expect(t.geraete.map((g) => g.name)).toEqual(['Pad Tisch'])

    // Abschluss der ganzen Liste: offen nur mit „Rest auf Papier“.
    const pruef = e.pruefung(KNOTEN, 'ohne')
    expect([pruef.zeilen.length, pruef.offen.length]).toEqual([1, 6])
    const ohneRest = e.schliesseAb(KNOTEN, 'ohne', WKR_NAME, false)!
    await bis(() => e.abschluesse.value.find((a) => a.id === ohneRest)?.stufe === 'abgelehnt')
    expect(s.state.value.wkr.abschluss[KNOTEN]).toBeUndefined()
    const mitRest = e.schliesseAb(KNOTEN, 'ohne', WKR_NAME, true)!
    await bis(() => e.abschluesse.value.find((a) => a.id === mitRest)?.stufe === 'angenommen')
    expect(s.state.value.wkr.abschluss[KNOTEN].ohne.papier.length).toBe(6)
    expect(e.sichten.value[KNOTEN]?.abgeschlossen).toEqual(['ohne'])
  })

  it('Leitung: weder Namen noch Werte in der Sicht der Liste am Tisch', async () => {
    const { s, h } = await bedienrechner()
    const { e } = await wkrHandy(h, [{ art: 'liste', liste: KNOTEN }])
    await bis(() => (e.bestand.value[KNOTEN]?.length ?? 0) > 0)
    const text = JSON.stringify(e.sichten.value[KNOTEN])
    for (const p of s.state.value.starters) {
      expect(text).not.toContain(p.vorname)
      expect(text).not.toContain(p.nachname)
    }
    expect(Object.keys(e.bestand.value[KNOTEN][0]).sort()).toEqual(['erledigt', 'key', 'klasse', 'startNr'])
  })
})

describe('Zeit-Liste Ende zu Ende (W5.4, 22.11.2026, ZT1–ZT4)', () => {
  const ZEIT = listenKennung({ bereich: P1, typeId: 'zeit', racecourse: null })

  it('Ziffernfolge → genau diese Zelle am Bedienrechner; „keine Zeit“ als Kennzeichen; Korrektur hebt es auf', async () => {
    const { s, h } = await bedienrechner()
    const { e } = await wkrHandy(h, [{ art: 'liste', liste: ZEIT }], { name: 'Pad Zeit' })
    const { key, starter } = await mitStart(s, e, ZEIT)
    const sicht = e.sichten.value[ZEIT]!
    const klasse = [...sicht.schlange, ...sicht.danach].find((x) => x.key === key)!.klasse
    const a = maskeFuer(sicht, klasse)!
    expect([a.art, a.zeiten.map((z) => z.feld)]).toEqual(['zeit', ['zeit1', 'zeit2', 'zeit3']])

    // Getippt wie am Rechner: „83,45“ und „1,2345“ (beide 1:23,45); Zeit 3 hat keine Zeit (Anlage ausgefallen).
    let ent = setzeZeit(leererEntwurf(), a, 'zeit1', '83,45')
    ent = setzeZeit(ent, a, 'zeit2', '1,2345')
    ent = setzeKeineZeit(ent, a, 'zeit3', 'anlage')
    const z = e.schicke(ZEIT, { s: key, zellen: zellenAus(ent, a), kz: Object.fromEntries(keineZeitAus(ent, a)) })!
    await bis(() => e.stufen.value[z].stufe === 'uebernommen')
    const w = werte(s.state.value, starter)
    expect([w.zeit1, w.zeit2, w.zeit3 ?? '', w['erfasst@zeit']]).toEqual(['83,45', '1,2345', '', '1'])
    expect(s.state.value.wkr.rueckfragen).toEqual([])
    expect(s.state.value.wkr.keineZeit[ZEIT]).toEqual({ [`${LAUF}|${starter}`]: { zeit3: 'anlage' } })
    // Bedienrechner: Matrix ✓ mit „keine Zeit“; Zuletzt auf dem Gerät mit dem Grund.
    const l = erfassungsLage(s.state.value, configFor({ regelwerk: 'dm-2026' }), P1, [], Date.now()).listen.find((x) => x.liste === ZEIT)!
    expect(l.zellen[key]).toEqual({ zelle: 'ok', keineZeit: { zeit3: 'anlage' } })
    expect(e.zuletzt.value.find((x) => x.z === z)).toMatchObject({ zellen: { zeit1: '83,45', zeit2: '1,2345' }, kz: { zeit3: 'anlage' } })
    expect(e.keineZeit(z)).toEqual({ zeit3: 'anlage' })

    // Korrektur: doch eine Zeit für Zeit 3 (von der Stoppuhr) – Zelle gefüllt, Kennzeichen weg; nur EINE Zelle geht.
    const alt = entwurfAus(e.stand(z)!, a, e.keineZeit(z))
    expect(alt.keineZeit).toEqual({ zeit3: 'anlage' })
    const neu = setzeZeit(alt, a, 'zeit3', '83,5')
    const k = e.korrigiere(z, zellenAus(neu, a), Object.fromEntries(keineZeitAus(neu, a)))!
    await bis(() => e.stufen.value[k]?.stufe === 'uebernommen')
    expect(werte(s.state.value, starter).zeit3).toBe('83,5')
    expect(s.state.value.wkr.keineZeit).toEqual({})
    expect(e.keineZeit(k)).toEqual({})
    const letzte = zeilenNachrichten(s).at(-1)!.zeilen[0]
    expect([letzte.zellen.map((c) => c.feld), letzte.keineZeit]).toEqual([['zeit3'], {}])
  })

  it('Leitung: „keine Zeit“ nur in der Zeile zum Host, nie in Sicht, Tafel oder Zuschauerliste', async () => {
    const { s, h } = await bedienrechner()
    const { e } = await wkrHandy(h, [{ art: 'liste', liste: ZEIT }])
    const { key } = await mitStart(s, e, ZEIT)
    const z = e.schicke(ZEIT, { s: key, zellen: { zeit1: '', zeit2: '', zeit3: '' }, kz: { zeit1: 'nichtImZiel', zeit2: 'nichtImZiel', zeit3: 'nichtImZiel' } })!
    await bis(() => e.stufen.value[z].stufe === 'uebernommen')
    await bis(() => (e.sichten.value[ZEIT]?.geraete?.[Object.keys(e.sichten.value[ZEIT]!.geraete ?? {})[0]]?.bis ?? 0) > 0)
    for (const text of [JSON.stringify(e.sichten.value[ZEIT]), JSON.stringify(sichtOeffentlich(s.state.value))]) expect(text).not.toContain('nichtImZiel')
  })
})
