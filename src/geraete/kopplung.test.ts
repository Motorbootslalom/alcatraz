import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { shallowRef } from 'vue'
import { starteGeraeteHost, type GeraeteHost, type HostUmgebung } from './host'
import { oeffneGekoppelt, oeffneKoppelLink, type GekoppeltesGeraet } from './gekoppelt'
import type { LeseUmgebung } from './geraet'
import { ABLAGE, liesKopplung, type Ablage } from './ablage'
import { freigabeBereiche, type Aufgabe } from './aufgaben'
import { nachgebauterBrowser, type TestFenster } from './testBrowser'
import { bis, NachgebauterSocket, nachgebautesFetch, neuesNtfy, ruhe, SERVER, type NachgebautesNtfy } from './transport/ntfy/testNtfy'
import { direktThemaVon, geraeteThemaVon, type HostRaum } from './transport/ntfy/raum'
import type { NtfyZeiten } from './transport/ntfy/leitung'
import type { GeraeteAction } from './transport/protokoll'
import { reducer, type Action } from '../state/reducer'
import { sichtOeffentlich } from '../betrieb/sicht'
import { laufSchluessel } from '../lib/eingaben'
import { betriebsStand, festgeschrieben } from '../testHilfen'
import type { AppState } from '../types'

/**
 * Ende zu Ende (E7): Bedienrechner (geraete/host.ts, nachgebauter Browser) → nachgebauter ntfy (kein Netz) → Steg-Handy
 * mit Koppel-Link bzw. QR-Code (geraete/gekoppelt.ts, eigener Speicher je Handy). Starter erfunden (testHilfen).
 * Zählungen von Nachrichten und Anwendungen mit ≥ bzw. nach Nummer, weil unter Last Wiederholungen dazukommen können.
 */

const SCHNELL: Partial<NtfyZeiten> = { abstandMs: 0, wiederholenMs: [20], zuVieleMs: 30, neuVerbindenMs: [10], quittungMs: 150, einstiegAbstandMs: 0 }
const KENNUNG = 'MUSTERK7'
const NUR_1: Aufgabe[] = [{ art: 'startfreigabe', bereiche: ['par_1'] }]
const NUR_2: Aufgabe[] = [{ art: 'startfreigabe', bereiche: ['par_2'] }]

let ntfy: NachgebautesNtfy
const hosts: GeraeteHost[] = []
const geraete: GekoppeltesGeraet[] = []

beforeEach(() => {
  ntfy = neuesNtfy()
  vi.stubGlobal('WebSocket', NachgebauterSocket)
  vi.stubGlobal('fetch', nachgebautesFetch)
})

afterEach(() => {
  for (const g of geraete.splice(0)) g.stop()
  for (const h of hosts.splice(0)) h.stop()
  vi.unstubAllGlobals()
})

function anfang(): AppState {
  return { ...festgeschrieben(betriebsStand()), kennung: KENNUNG, geraeteServer: SERVER }
}

/**
 * Ein Fenster mit vollem Store: Es schreibt den Stand in den gemeinsamen Speicher und übernimmt den eines anderen
 * Fensters über das storage-Ereignis – wie state/store.ts. `angewandt` zählt, was HIER dispatcht wurde.
 */
function fensterStore(f: TestFenster, start?: AppState) {
  const gespeichert = f.ablage.getItem('test.stand')
  const state = shallowRef<AppState>(gespeichert ? (JSON.parse(gespeichert) as AppState) : (start ?? anfang()))
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

/** Ein Bedienrechner mit geöffnetem Raum, verbunden. */
async function bedienrechner() {
  const b = nachgebauterBrowser()
  const f = b.fenster()
  const s = fensterStore(f)
  const h = hostIn(f, s)
  h.oeffne()
  await bis(() => h.verbindung.value?.status === 'verbunden')
  const raum = (): HostRaum => JSON.parse(f.ablage.getItem(ABLAGE.raum)!).raum as HostRaum
  return { b, f, s, h, raum }
}

function handy(): Ablage & { daten: Map<string, string> } {
  const daten = new Map<string, string>()
  return { daten, getItem: (k) => daten.get(k) ?? null, setItem: (k, v) => void daten.set(k, String(v)), removeItem: (k) => void daten.delete(k) }
}

function oeffne(link: string, speicher: Ablage = handy(), mehr: LeseUmgebung = {}): GekoppeltesGeraet {
  const r = oeffneKoppelLink(link, { ablage: speicher, zeiten: SCHNELL, ablaufTaktMs: 20, ...mehr })
  if (!r.ok) throw new Error(`Link: ${r.code}`)
  geraete.push(r.geraet)
  return r.geraet
}

/** Ein Steg-Handy über Koppel-Link und Geräte-Code mit diesen Rechten – gekoppelt und mit Sicht. */
async function stegHandy(h: GeraeteHost, aufgaben: Aufgabe[], name = 'iPhone', speicher: Ablage = handy(), mehr: LeseUmgebung = {}) {
  h.gibCode(aufgaben)
  await bis(() => !!h.raum.value?.koppeln.code && h.raum.value.koppeln.code.benutzt === null)
  const code = h.raum.value!.koppeln.code!.wert
  const g = oeffne(h.raum.value!.koppelLink, speicher, mehr)
  await g.start()
  expect(g.koppeln(name, code.toLowerCase())).toBe('gesendet')
  await bis(() => g.lage.value === 'gekoppelt' && g.anzeige.value !== null)
  return { g, speicher, code }
}

/** Senden und auf die Quittung genau dieser Nummer warten. */
async function sendeUndWarte(g: GekoppeltesGeraet, action: GeraeteAction) {
  const nr = g.sende(action)
  expect(nr).not.toBeNull()
  await bis(() => g.quittung.value?.nr === nr)
  return g.quittung.value!
}

const beginnen = (bereich: string): GeraeteAction => ({ type: 'BETRIEB_BEGINNEN', bereich, punkt: 'lauf:1' })
const begonnen = (s: AppState, bereich: string) => s.betrieb.bereiche[bereich]?.begonnen ?? []
/** „Nächster Start“ so, wie die Start-Freigabe ihn aus der empfangenen Sicht baut. */
function naechsterAusSicht(g: GekoppeltesGeraet, bereich: string): GeraeteAction {
  const b = g.anzeige.value!.bereiche.find((x) => x.id === bereich)!
  return { type: 'BETRIEB_ZEIGEN', bereich, ref: b.offen[0].key, vorher: b.aktuell?.key ?? null }
}

describe('Koppeln (E7)', () => {
  it('Geräte-Code: koppelt EIN Gerät mit den Rechten des Codes; ein zweites mit demselben Code nicht', async () => {
    const { h } = await bedienrechner()
    const { g, code } = await stegHandy(h, NUR_1, 'Steg Nord')
    expect(g.aufgaben.value).toEqual(NUR_1)
    await bis(() => h.raum.value!.geraete.length === 1 && h.raum.value!.koppeln.code?.benutzt !== null)
    expect(h.raum.value!.geraete[0]).toMatchObject({ name: 'Steg Nord', aufgaben: NUR_1 })
    expect(g.fingerabdruck).toBe(h.raum.value!.fingerabdruck)

    // Wer mithört und denselben Code tippt, kommt nicht hinein.
    const zweites = oeffne(h.raum.value!.koppelLink)
    await zweites.start()
    zweites.koppeln('Mithörer', code)
    await bis(() => zweites.lage.value === 'abgelehnt')
    expect(zweites.grund.value).toBe('code-abgelaufen')
    expect(h.raum.value!.geraete).toHaveLength(1)
    // Ein falscher Code hat nicht einmal die Form.
    expect(zweites.koppeln('x', 'AB')).toBe('code-ungueltig')
  })

  it('QR-Code: Token im Paket, Rechte der QR-Sitzung; die Sitzung endet beim Schließen', async () => {
    const { h } = await bedienrechner()
    h.oeffneQr(NUR_2)
    await bis(() => !!h.raum.value?.koppeln.qr)
    const qr = h.raum.value!.koppeln.qr!.paket
    const g = oeffne(qr)
    await g.start()
    expect(g.koppeln('Tablet')).toBe('gesendet')
    await bis(() => g.lage.value === 'gekoppelt')
    expect(g.aufgaben.value).toEqual(NUR_2)
    await bis(() => h.raum.value!.geraete.some((x) => x.name === 'Tablet'))
    h.beendeKoppeln('qr')
    await bis(() => h.raum.value!.koppeln.qr === null)
  })

  it('der QR-Token wechselt im Takt des Führungsfensters; ein abfotografierter alter gilt nicht mehr', async () => {
    let versatz = 0
    const b = nachgebauterBrowser()
    const f = b.fenster()
    const s = fensterStore(f)
    const h = hostIn(f, s, { uhr: () => Date.now() + versatz })
    h.oeffne()
    await bis(() => h.verbindung.value?.status === 'verbunden')
    h.oeffneQr(NUR_1)
    await bis(() => !!h.raum.value?.koppeln.qr)
    const alt = h.raum.value!.koppeln.qr!.paket
    // 45 s später: gewechselt, und auch das Gnadenfenster des alten ist vorbei.
    versatz = 45_000
    await bis(() => h.raum.value!.koppeln.qr!.paket !== alt)
    versatz = 90_000
    await bis(() => h.raum.value!.koppeln.qr!.tokenBis > Date.now() + 80_000)
    const g = oeffne(alt)
    await g.start()
    g.koppeln('Foto')
    await bis(() => g.lage.value === 'abgelehnt')
    // Zwei Wechsel später kennt der Host den Token gar nicht mehr.
    expect(g.grund.value).toBe('code-ungueltig')
    expect(h.raum.value!.geraete).toHaveLength(0)
  })
})

describe('Start-Freigabe vom Handy (E7)', () => {
  it('das Steg-Handy schaltet nur seine Bereiche; Rechte ändern wirkt sofort', async () => {
    const { h, s } = await bedienrechner()
    const { g } = await stegHandy(h, NUR_1)
    expect(g.darf(beginnen('par_1'))).toBe(true)
    expect(g.darf(beginnen('par_2'))).toBe(false)

    expect(await sendeUndWarte(g, beginnen('par_1'))).toMatchObject({ ergebnis: 'angewandt' })
    expect(begonnen(s.state.value, 'par_1')).toEqual(['lauf:1'])
    // Was das Handy zeigt, kommt über die öffentliche Sicht zurück; daraus „Nächster Start“.
    await bis(() => (g.anzeige.value?.bereiche.find((b) => b.id === 'par_1')?.offen.length ?? 0) > 0)
    expect(await sendeUndWarte(g, naechsterAusSicht(g, 'par_1'))).toMatchObject({ ergebnis: 'angewandt' })
    expect(sichtOeffentlich(s.state.value).bereiche.find((b) => b.id === 'par_1')!.aktuell).not.toBeNull()

    // Fremder Bereich: am Host abgelehnt, auch wenn das Gerät den Knopf nicht sperrt.
    expect(await sendeUndWarte(g, beginnen('par_2'))).toEqual({ nr: expect.any(Number), ergebnis: 'abgelehnt', grund: 'nicht-erlaubt' })
    expect(begonnen(s.state.value, 'par_2')).toEqual([])
    // „Betrieb zurücksetzen“ bleibt am Bedienrechner (F5).
    expect(await sendeUndWarte(g, { type: 'BETRIEB_ZURUECKSETZEN', bereich: 'par_1' })).toMatchObject({ ergebnis: 'abgelehnt' })
    expect(begonnen(s.state.value, 'par_1')).toEqual(['lauf:1'])

    // Rechte ändern: sofort am Host und auf dem Gerät.
    const id = h.raum.value!.geraete[0].id
    h.setzeAufgaben(id, NUR_2)
    await bis(() => freigabeBereiche(g.aufgaben.value)[0] === 'par_2')
    expect(await sendeUndWarte(g, beginnen('par_2'))).toMatchObject({ ergebnis: 'angewandt' })
    expect(begonnen(s.state.value, 'par_2')).toEqual(['lauf:1'])
    expect(await sendeUndWarte(g, { type: 'BETRIEB_MELDUNG', bereich: 'par_1', meldung: { text: 'Pause', art: 'pause' } })).toMatchObject({ ergebnis: 'abgelehnt' })
  })

  it('doppelte Zustellung und doppelter Klick schalten nicht zweimal', async () => {
    const { h, s, raum } = await bedienrechner()
    const { g } = await stegHandy(h, NUR_1)
    await sendeUndWarte(g, beginnen('par_1'))
    await bis(() => (g.anzeige.value?.bereiche.find((b) => b.id === 'par_1')?.offen.length ?? 0) > 0)
    const zeigen = naechsterAusSicht(g, 'par_1')
    const vorher = s.angewandt.length
    expect(await sendeUndWarte(g, zeigen)).toMatchObject({ ergebnis: 'angewandt' })
    expect(s.angewandt.length).toBe(vorher + 1)
    const gezeigt = s.state.value.betrieb.bereiche.par_1.gezeigt.length

    // Dieselbe Nachricht noch einmal eingestellt (ntfy, Wiederholung): Der Host kennt die Nummer – nur eine Quittung.
    const g1 = geraeteThemaVon(raum())
    const letzte = ntfy.gespeichert.filter((x) => x.topic === g1).at(-1)!
    ntfy.publish(g1, letzte.body)
    await ruhe(300)
    expect(s.angewandt.length).toBe(vorher + 1)
    expect(s.state.value.betrieb.bereiche.par_1.gezeigt).toHaveLength(gezeigt)

    // Doppelklick: zweimal dasselbe „Nächster Start“ mit demselben `vorher` – das zweite wirkt nicht (bedingt, K30).
    expect(await sendeUndWarte(g, zeigen)).toMatchObject({ ergebnis: 'unveraendert' })
    expect(s.state.value.betrieb.bereiche.par_1.gezeigt).toHaveLength(gezeigt)
  })

  it('Wiederholung nach einem Neustart des Hosts schaltet nicht zweimal (letzteNr im Raum, K18)', async () => {
    const { b, h, s, raum } = await bedienrechner()
    const { g } = await stegHandy(h, NUR_1)
    const id = h.raum.value!.geraete[0].id
    // Die Quittung erreicht das Handy nicht – der Host ist danach weg (Fenster zu).
    ntfy.verschlucke = direktThemaVon(raum(), id)
    const nr = g.sende(beginnen('par_1'))!
    await bis(() => s.angewandt.length > 0 && raum().geraete[id].letzteNr >= nr)
    hosts.splice(hosts.indexOf(h), 1)
    h.stop()
    const anzahl = s.angewandt.length

    // Ein neues Fenster desselben Rechners übernimmt (derselbe Raum); das Handy wiederholt dieselbe Nummer.
    const f2 = b.fenster()
    const s2 = fensterStore(f2, s.state.value)
    const h2 = hostIn(f2, s2)
    await bis(() => h2.verbindung.value?.status === 'verbunden')
    await bis(() => g.quittung.value?.nr === nr, 5000)
    expect(g.quittung.value!.ergebnis).toBe('doppelt')
    expect(s2.angewandt).toHaveLength(0)
    expect(s.angewandt).toHaveLength(anzahl)
    expect(begonnen(s2.state.value, 'par_1')).toEqual(['lauf:1'])
  })

  it('nach dem Neuladen: Unbestätigtes geht genau einmal, das Gerät meldet sich selbst wieder an', async () => {
    const { b, h, s, raum } = await bedienrechner()
    const { g, speicher } = await stegHandy(h, NUR_1)
    const id = h.raum.value!.geraete[0].id
    // Bedienrechner weg; das Handy schickt trotzdem und wird dann neu geladen.
    hosts.splice(hosts.indexOf(h), 1)
    h.stop()
    const nr = g.sende(beginnen('par_1'))!
    await ruhe(100)
    g.stop()
    geraete.splice(geraete.indexOf(g), 1)

    const wieder = oeffneGekoppelt({ ablage: speicher, zeiten: SCHNELL, ablaufTaktMs: 20 })!
    expect(wieder).not.toBeNull()
    geraete.push(wieder)
    expect(wieder.lage.value).toBe('gekoppelt')
    expect(wieder.offen.value).toEqual([])
    await wieder.start()
    expect(wieder.offen.value[0]).toBe(nr)

    const zuletzt = raum().geraete[id].zuletzt ?? 0
    const f2 = b.fenster()
    const s2 = fensterStore(f2, s.state.value)
    hostIn(f2, s2)
    await bis(() => wieder.quittung.value?.nr === nr, 5000)
    expect(wieder.quittung.value!.ergebnis).toBe('angewandt')
    expect(s2.angewandt.filter((a) => a.type === 'BETRIEB_BEGINNEN')).toHaveLength(1)
    // Danach die Selbst-Anmeldung (P-7): ohne Code, und der Host hat das Gerät gehört.
    await bis(() => wieder.offen.value.length === 0 && !wieder.meldetSich.value && (raum().geraete[id].zuletzt ?? 0) > zuletzt)
    expect(wieder.lage.value).toBe('gekoppelt')
  })

  it('ein entzogenes Gerät kann nicht mehr schalten, bekommt `entzogen` und liest Öffentliches weiter', async () => {
    const { h, s, raum } = await bedienrechner()
    const { g } = await stegHandy(h, NUR_1, 'Steg Süd')
    await sendeUndWarte(g, beginnen('par_1'))
    const id = h.raum.value!.geraete[0].id
    const g1 = geraeteThemaVon(raum())
    const alteAction = ntfy.gespeichert.filter((x) => x.topic === g1).at(-1)!.body

    h.entziehe(id)
    await bis(() => g.lage.value === 'entzogen')
    expect(g.aufgaben.value).toEqual([])
    expect(g.sende(beginnen('par_1'))).toBeNull()
    await bis(() => h.raum.value!.geraete.length === 0)
    expect(h.raum.value!.entzogen).toEqual([{ id, name: 'Steg Süd', um: expect.any(Number) }])

    // Eine alte Nachricht des Geräts erneut eingestellt: Der Schlüssel ist unbekannt – nichts geschieht.
    const anzahl = s.angewandt.length
    ntfy.publish(g1, alteAction.replace(/"n":\d+/, '"n":1'))
    ntfy.publish(g1, alteAction)
    await ruhe(300)
    expect(s.angewandt.length).toBe(anzahl)

    // Öffentliches liest es weiter (gewollt, K14).
    s.dispatch({ type: 'BETRIEB_MELDUNG', bereich: 'par_1', meldung: { text: 'Gleich geht es weiter', art: 'info' } })
    await bis(() => g.anzeige.value?.bereiche.find((b) => b.id === 'par_1')?.meldung?.text === 'Gleich geht es weiter')
  })
})

describe('Befunde der E7-Prüfung (20.11.2026)', () => {
  it('entzogen, während das Gerät länger aus war, als ntfy vorhält: die Selbstanmeldung bekommt `entzogen`', async () => {
    const { h, raum } = await bedienrechner()
    const { g, speicher } = await stegHandy(h, NUR_1, 'Steg West')
    const id = h.raum.value!.geraete[0].id
    g.stop()
    geraete.splice(geraete.indexOf(g), 1)

    h.entziehe(id)
    await bis(() => h.raum.value!.geraete.length === 0 && raum().ausstehend.length === 0)
    // Der öffentliche Schlüssel steht im Raum (zum Wiedererkennen), nicht in der Geräteliste.
    expect(raum().entzogen?.[0]).toMatchObject({ id, pk: expect.any(String) })
    expect(h.raum.value!.entzogen[0]).toEqual({ id, name: 'Steg West', um: expect.any(Number) })
    // ntfy hat das `entzogen` nicht mehr (12 h später).
    const d = direktThemaVon(raum(), id)
    ntfy.gespeichert = ntfy.gespeichert.filter((x) => x.topic !== d)

    const wieder = oeffneGekoppelt({ ablage: speicher, zeiten: SCHNELL, ablaufTaktMs: 20 })!
    geraete.push(wieder)
    expect(wieder.lage.value).toBe('gekoppelt')
    await wieder.start()
    await bis(() => wieder.lage.value === 'entzogen', 5000)
    expect(wieder.meldetSich.value).toBe(false)
    expect(wieder.offen.value).toEqual([])
  })

  it('ohne Antwort wiederholt ein Gerät mit wachsendem Abstand (Kontingent am Hotspot)', async () => {
    const { h } = await bedienrechner()
    const g = oeffne(h.raum.value!.koppelLink)
    await g.start()
    // Ein Code, den der Bedienrechner nie ausgegeben hat: Sein Thema liest niemand, eine Antwort kommt nie.
    expect(g.koppeln('iPhone', 'ACD234')).toBe('gesendet')
    await ruhe(2500)
    // quittungMs 150: ohne Wachsen gut ein Dutzend Sendungen in 2,5 s, mit Wachsen (0, 150, 450, 1050, 2250 ms) höchstens 5.
    const gesendet = ntfy.gespeichert.filter((x) => x.body.includes('"pk"')).length
    expect(gesendet).toBeGreaterThanOrEqual(1)
    expect(gesendet).toBeLessThanOrEqual(5)
    expect(g.lage.value).toBe('koppelt')
  })
})

describe('Alle Geräte neu laden (E8, Prüfung 21.11.2026)', () => {
  it('das gekoppelte Handy lädt einmal neu, bleibt gekoppelt, und eine offene Action kommt genau einmal an', async () => {
    const { h, s } = await bedienrechner()
    const speicher = handy()
    const lade = vi.fn()
    const { g } = await stegHandy(h, NUR_1, 'iPhone', speicher, { aktualisiere: lade })
    // Eine Action ist unterwegs, als der Befehl kommt.
    expect(g.sende(beginnen('par_1'))).not.toBeNull()
    expect(h.ladeAlleNeu()).toBe('gesendet')
    await bis(() => lade.mock.calls.length === 1)
    // „Neu laden“: dasselbe Handy startet aus seiner Ablage.
    g.stop()
    geraete.splice(geraete.indexOf(g), 1)
    const wieder = oeffneGekoppelt({ ablage: speicher, zeiten: SCHNELL, ablaufTaktMs: 20, aktualisiere: lade })!
    expect(wieder).not.toBeNull()
    geraete.push(wieder)
    expect(wieder.lage.value).toBe('gekoppelt')
    await wieder.start()
    await bis(() => wieder.anzeige.value !== null && wieder.offen.value.length === 0)
    expect(begonnen(s.state.value, 'par_1')).toEqual(['lauf:1'])
    expect(wieder.lage.value).toBe('gekoppelt')
    // Die Rechte bleiben; derselbe Befehl wirkt nach dem Neuladen nicht noch einmal.
    expect(wieder.darf(beginnen('par_1'))).toBe(true)
    await ruhe(150)
    expect(lade).toHaveBeenCalledOnce()
  })
})

describe('Ablage des Geräts', () => {
  it('Kopplung liegt gerätelokal, „Raum verlassen“ löscht sie samt Verbindung und Sicht', async () => {
    const { h } = await bedienrechner()
    const { g, speicher } = await stegHandy(h, NUR_1)
    expect(liesKopplung(speicher)).toMatchObject({ lage: 'gekoppelt', name: 'iPhone', aufgaben: NUR_1, thema: null })
    // Kein Code, kein Token in der Ablage – nur der Koppel-Link ohne QR-Teil.
    expect([...(speicher as ReturnType<typeof handy>).daten.keys()].every((k) => k.startsWith('alcatraz.geraet.'))).toBe(true)
    g.verlasse()
    expect([...(speicher as ReturnType<typeof handy>).daten.keys()].filter((k) => k !== ABLAGE.aktualisiert)).toEqual([])
    expect(oeffneGekoppelt({ ablage: speicher })).toBeNull()
  })
})

describe('Bedienung aus einem anderen Fenster', () => {
  it('Code ausgeben, Rechte ändern, entziehen – als Befehl an das Führungsfenster; jedes Fenster sieht die Liste', async () => {
    const { b, h, s } = await bedienrechner()
    const f2 = b.fenster()
    const h2 = hostIn(f2, fensterStore(f2, s.state.value))
    await ruhe(50)
    expect(h2.fuehrt.value).toBe(false)
    const { g } = await stegHandy(h2, NUR_1, 'Steg West')
    await bis(() => h2.raum.value!.geraete.length === 1)
    const id = h2.raum.value!.geraete[0].id
    h2.setzeAufgaben(id, NUR_2)
    await bis(() => freigabeBereiche(g.aufgaben.value)[0] === 'par_2' && freigabeBereiche(h.raum.value!.geraete[0].aufgaben)[0] === 'par_2')
    h2.entziehe(id)
    await bis(() => g.lage.value === 'entzogen' && h2.raum.value!.geraete.length === 0 && h2.raum.value!.entzogen.length === 1)
  })
})

describe('Schreibfenster (K27)', () => {
  it('Geräte-Action, während im anderen Fenster getippt wird: angewandt dort, keine Eingabe geht verloren', async () => {
    const { b, f, h, s } = await bedienrechner()
    const { g } = await stegHandy(h, NUR_1)
    // Zweites Fenster desselben Rechners (Erfassung): Es wird bedient – getippt.
    const f2 = b.fenster()
    const s2 = fensterStore(f2, s.state.value)
    hostIn(f2, s2)
    await ruhe(50)
    f2.fenster.dispatchEvent(new Event('keydown'))
    const lauf = laufSchluessel('manoevrieren', 1)
    s2.dispatch({ type: 'SET_EINGABEN', zellen: [{ lauf, starter: 'e1', feld: 'zeit1', wert: '81.5' }] })
    await ruhe(50)

    const nr = g.sende(beginnen('par_1'))!
    // Während die Action unterwegs ist, wird weiter getippt.
    s2.dispatch({ type: 'SET_EINGABEN', zellen: [{ lauf, starter: 'e2', feld: 'zeit1', wert: '84.1' }] })
    await bis(() => g.quittung.value?.nr === nr)
    expect(g.quittung.value!.ergebnis).toBe('angewandt')
    // Angewandt im bedienten Fenster, nicht im Führungsfenster.
    expect(s2.angewandt.some((a) => a.type === 'BETRIEB_BEGINNEN')).toBe(true)
    expect(s.angewandt.some((a) => a.type === 'BETRIEB_BEGINNEN')).toBe(false)
    s2.dispatch({ type: 'SET_EINGABEN', zellen: [{ lauf, starter: 'k1', feld: 'zeit1', wert: '90.0' }] })
    await ruhe(50)
    for (const stand of [s.state.value, s2.state.value, JSON.parse(f.ablage.getItem('test.stand')!) as AppState]) {
      expect(begonnen(stand, 'par_1')).toEqual(['lauf:1'])
      expect(Object.keys(stand.eingaben[lauf] ?? {}).sort()).toEqual(['e1', 'e2', 'k1'])
    }
  })
})
