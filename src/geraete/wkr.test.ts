import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { shallowRef } from 'vue'
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
import { bojenVon, disqFuer, entwurfAus, leererEntwurf, maskeFuer, mitBemerkung, tippe, tippeBoje, tippeDisq, zellenAus } from '../wkr/maske'
import { erfassungsLage } from '../wkr/lage'
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
    await bis(() => frei.g.freigabe.value[P1]?.listen.find((l) => l.titel === TITEL)?.offen === 3)
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
    const { key, starter } = await mitStart(s, e, STEG)
    const sn = s.state.value.starters.find((p) => p.id === starter)!.startNr
    expect(e.schlangeTeil(STEG, 'ab').map((x) => x.key)).toContain(key)
    expect(e.schlangeTeil(STEG, 'an').map((x) => x.key)).toContain(key)
    const za = e.schicke(STEG, { s: key, teil: 'ab', zellen: {} })!
    expect(e.schlangeTeil(STEG, 'ab').some((x) => x.key === key)).toBe(false)
    expect(e.schlangeTeil(STEG, 'an').some((x) => x.key === key)).toBe(true)
    // Die gemeinsame Schlange behält ihn, solange das Anlegen fehlt.
    expect(e.schlange.value[STEG].some((x) => x.key === key)).toBe(true)
    expect(e.zuletzt.value[0]).toMatchObject({ z: za, sn, teil: 'ab' })
    await bis(() => e.stufen.value[za].stufe === 'uebernommen')
    expect(werte(s.state.value, starter)['erfasst.ab@steg']).toBeTruthy()
    const zn = e.schicke(STEG, { s: key, teil: 'an', zellen: {} })!
    expect(e.schlange.value[STEG].some((x) => x.key === key)).toBe(false)
    expect(e.schlangeTeil(STEG, 'an').some((x) => x.key === key)).toBe(false)
    await bis(() => e.stufen.value[zn].stufe === 'uebernommen')
    expect(werte(s.state.value, starter)['erfasst@steg']).toBeTruthy()
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
