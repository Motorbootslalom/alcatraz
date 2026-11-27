import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { shallowRef } from 'vue'
import { starteGeraeteHost, type GeraeteHost, type HostUmgebung } from './host'
import { oeffneKoppelLink, type GekoppeltesGeraet } from './gekoppelt'
import { oeffneLeseLink, type LeseGeraet } from './geraet'
import { ABLAGE, type Ablage } from './ablage'
import { freigabeBereiche, type Aufgabe } from './aufgaben'
import { CODE_GUELTIG_MS, KOPPEL_NACHLAUF_MS, QR_TOKEN_GUELTIG_MS } from './koppeln'
import { nachgebauterBrowser, type TestFenster } from './testBrowser'
import { bis, NachgebauterSocket, nachgebautesFetch, neuesNtfy, packenOhneThreadpool, ruhe, SERVER, type NachgebautesNtfy } from './transport/ntfy/testNtfy'
import { geraeteThemaVon, type HostRaum } from './transport/ntfy/raum'
import { wiederholAbstand } from './transport/ntfy/transport'
import { NTFY_ZEITEN, type NtfyZeiten } from './transport/ntfy/leitung'
import type { GeraeteAction } from './transport/protokoll'
import { reducer, type Action } from '../state/reducer'
import { PARALLEL_BEREICH, refKey } from '../betrieb/folge'
import { betriebsStand, festgeschrieben, uimParallelStand } from '../testHilfen'
import type { AppState, SichtBereich } from '../types'

/**
 * Härtung des Gerätebetriebs (Etappe E8, 20.11.2026): Start-Freigabe vom Handy im Parallelslalom (UIM, Paare mit
 * Racecourse A und B) und Zeitgrenzen – Bedienrechner antwortet nicht, Führungswechsel mit offener Action, Koppel-Code
 * und QR-Token abgelaufen, Gerät lange weg. Bedienrechner = geraete/host.ts im nachgebauten Browser, ntfy nachgebaut
 * (kein Netz), Handy = geraete/gekoppelt.ts mit eigenem Speicher. Starter erfunden (testHilfen).
 * Zählungen mit ≥ bzw. nach Nummer und Zustand: Unter Last kommen Wiederholungen dazu.
 */

const SCHNELL: Partial<NtfyZeiten> = { abstandMs: 0, wiederholenMs: [20], zuVieleMs: 30, neuVerbindenMs: [10], quittungMs: 150, einstiegAbstandMs: 0 }
const KENNUNG = 'MUSTERE8'
const P = PARALLEL_BEREICH
const NUR_PARALLEL: Aufgabe[] = [{ art: 'startfreigabe', bereiche: [P] }]
const NUR_PARCOURS: Aufgabe[] = [{ art: 'startfreigabe', bereiche: ['par_1'] }]

let ntfy: NachgebautesNtfy
const hosts: GeraeteHost[] = []
const geraete: Array<GekoppeltesGeraet | LeseGeraet> = []

beforeEach(() => {
  ntfy = neuesNtfy()
  vi.stubGlobal('WebSocket', NachgebauterSocket)
  vi.stubGlobal('fetch', nachgebautesFetch)
})

afterEach(() => {
  for (const g of geraete.splice(0)) g.stop()
  for (const h of hosts.splice(0)) h.stop()
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

/** UIM mit Parallelslalom (Dolphin 3, Klasse 1 6), Vorlauf festgeschrieben – Bereiche `par_1` und `parallel`. */
const uim = (): AppState => ({ ...uimParallelStand(), kennung: KENNUNG, geraeteServer: SERVER })
const dm = (): AppState => ({ ...festgeschrieben(betriebsStand()), kennung: KENNUNG, geraeteServer: SERVER })

/** Ein Fenster mit vollem Store wie state/store.ts (gemeinsamer Speicher, storage-Ereignis); `angewandt` = dispatch HIER. */
function fensterStore(f: TestFenster, start: AppState) {
  const gespeichert = f.ablage.getItem('test.stand')
  const state = shallowRef<AppState>(gespeichert ? (JSON.parse(gespeichert) as AppState) : start)
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

async function bedienrechner(start: AppState = uim(), mehr: HostUmgebung = {}) {
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

function oeffne(link: string, speicher: Ablage = handy(), zeiten: Partial<NtfyZeiten> = SCHNELL): GekoppeltesGeraet {
  const r = oeffneKoppelLink(link, { ablage: speicher, zeiten, ablaufTaktMs: 20 })
  if (!r.ok) throw new Error(`Link: ${r.code}`)
  geraete.push(r.geraet)
  return r.geraet
}

async function stegHandy(h: GeraeteHost, aufgaben: Aufgabe[], name = 'Steg Parallel', zeiten: Partial<NtfyZeiten> = SCHNELL) {
  h.gibCode(aufgaben)
  await bis(() => !!h.raum.value?.koppeln.code && h.raum.value.koppeln.code.benutzt === null)
  const code = h.raum.value!.koppeln.code!.wert
  const g = oeffne(h.raum.value!.koppelLink, handy(), zeiten)
  await g.start()
  expect(g.koppeln(name, code)).toBe('gesendet')
  await bis(() => g.lage.value === 'gekoppelt' && g.anzeige.value !== null)
  return g
}

async function sendeUndWarte(g: GekoppeltesGeraet, action: GeraeteAction) {
  const nr = g.sende(action)
  expect(nr).not.toBeNull()
  // Grenze wie bis() (10 s), nicht 3 s: unter Last zu knapp (Prüfung 21.11.2026).
  await bis(() => g.quittung.value?.nr === nr)
  return g.quittung.value!
}

const bereichAuf = (g: GekoppeltesGeraet | LeseGeraet, id: string): SichtBereich | undefined => g.anzeige.value?.bereiche.find((b) => b.id === id)
const betrieb = (s: AppState, id: string) => s.betrieb.bereiche[id]
const beginnen = (bereich: string, punkt: string): GeraeteAction => ({ type: 'BETRIEB_BEGINNEN', bereich, punkt })
/** „Nächster Start“, wie die Start-Freigabe ihn aus der empfangenen Sicht baut. */
function naechster(g: GekoppeltesGeraet, bereich: string): GeraeteAction {
  const b = bereichAuf(g, bereich)!
  return { type: 'BETRIEB_ZEIGEN', bereich, ref: b.offen[0].key, vorher: b.aktuell?.key ?? null }
}
const paar = (attempt: 1 | 2, a: string | null, b: string | null) => refKey({ art: 'p', runde: 'pre', attempt, a, b })

describe('Start-Freigabe vom Handy im Parallelslalom (UIM, E8)', () => {
  it('nur der Bereich Parallelslalom: Runde beginnen, Paare zeigen (A und B), Paar als Einheit zurückstellen – Quittung je Nummer', async () => {
    const { h, s } = await bedienrechner()
    const g = await stegHandy(h, NUR_PARALLEL)
    // Racecourse A und B sind EIN Bereich (ein Paar startet zugleich) – Rechte gibt es je Bereich, nicht je Seite.
    expect(g.darf(beginnen(P, 'runde:pre'))).toBe(true)
    expect(g.darf(beginnen('par_1', 'lauf:1'))).toBe(false)

    expect(await sendeUndWarte(g, beginnen(P, 'runde:pre'))).toMatchObject({ ergebnis: 'angewandt' })
    expect(betrieb(s.state.value, P).begonnen).toEqual(['runde:pre'])
    await bis(() => (bereichAuf(g, P)?.offen.length ?? 0) > 0)
    // Was das Handy als Nächstes sieht, ist ein Paar mit beiden Seiten.
    expect(bereichAuf(g, P)!.offen[0]).toMatchObject({ key: paar(1, 'E-1', 'E-2'), paar: { attempt: 1, a: expect.any(String), b: expect.any(String) } })

    // Erstes Paar, beide Attempts – das zweite mit getauschten Seiten (Regel 960, Pkt. 4.4).
    expect(await sendeUndWarte(g, naechster(g, P))).toMatchObject({ ergebnis: 'angewandt' })
    await bis(() => bereichAuf(g, P)?.aktuell?.key === paar(1, 'E-1', 'E-2'))
    expect(bereichAuf(g, P)!.offen[0].key).toBe(paar(2, 'E-2', 'E-1'))
    expect(await sendeUndWarte(g, naechster(g, P))).toMatchObject({ ergebnis: 'angewandt' })
    await bis(() => bereichAuf(g, P)?.aktuell?.key === paar(2, 'E-2', 'E-1'))

    // Dolphin 3 gegen den Dummy: Zurückstellen vom Handy nimmt das ganze Paar (beide Attempts, parallelPaarAlsEinheit).
    const dummy = bereichAuf(g, P)!.offen[0]
    expect(dummy.key).toBe(paar(1, 'E-3', null))
    expect(dummy.paar).toMatchObject({ b: null })
    expect(await sendeUndWarte(g, { type: 'BETRIEB_ZURUECKSTELLEN', bereich: P, ref: dummy.key })).toMatchObject({ ergebnis: 'angewandt' })
    expect(betrieb(s.state.value, P).zurueckgestellt).toEqual([paar(1, 'E-3', null), paar(2, null, 'E-3')])
    await bis(() => bereichAuf(g, P)!.zurueckgestellt.length === 2)
    // Einreihen bringt das Paar zurück – wieder beide.
    expect(await sendeUndWarte(g, { type: 'BETRIEB_EINREIHEN', bereich: P, ref: paar(2, null, 'E-3'), wo: 'naechster' })).toMatchObject({ ergebnis: 'angewandt' })
    expect(betrieb(s.state.value, P).zurueckgestellt).toEqual([])
    await bis(() => bereichAuf(g, P)!.offen[0]?.key === paar(1, 'E-3', null))
    expect(bereichAuf(g, P)!.offen[1].key).toBe(paar(2, null, 'E-3'))

    // Umstellen gibt es im Parallelslalom nicht (parallelOhneUmstellen) – auch nicht vom Handy: erlaubt, aber ohne Wirkung.
    const vorher = s.state.value.betrieb
    expect(await sendeUndWarte(g, { type: 'BETRIEB_AUSSETZEN', bereich: P, klasse: 'E', an: true })).toMatchObject({ ergebnis: 'unveraendert' })
    expect(await sendeUndWarte(g, { type: 'BETRIEB_VERSCHIEBEN', bereich: P, ref: paar(1, 'E-3', null), ziel: { nach: paar(2, null, 'E-3') } })).toMatchObject({ ergebnis: 'unveraendert' })
    expect(s.state.value.betrieb).toBe(vorher)

    // Der Parcours des Manövrierens gehört nicht zu den Rechten: abgelehnt am Host.
    expect(await sendeUndWarte(g, beginnen('par_1', 'lauf:1'))).toMatchObject({ ergebnis: 'abgelehnt', grund: 'nicht-erlaubt' })
    expect(betrieb(s.state.value, 'par_1')?.begonnen ?? []).toEqual([])
  })

  it('Rechte nur für den Parcours: Paare schalten wird abgelehnt; Rechte auf den Parallelslalom ändern wirkt sofort', async () => {
    const { h, s } = await bedienrechner()
    const g = await stegHandy(h, NUR_PARCOURS, 'Steg Manövrieren')
    expect(g.darf(beginnen(P, 'runde:pre'))).toBe(false)
    expect(await sendeUndWarte(g, beginnen(P, 'runde:pre'))).toMatchObject({ ergebnis: 'abgelehnt', grund: 'nicht-erlaubt' })
    expect(betrieb(s.state.value, P)?.begonnen ?? []).toEqual([])
    // Der eigene Parcours geht.
    expect(await sendeUndWarte(g, beginnen('par_1', 'lauf:1'))).toMatchObject({ ergebnis: 'angewandt' })

    h.setzeAufgaben(h.raum.value!.geraete[0].id, NUR_PARALLEL)
    await bis(() => freigabeBereiche(g.aufgaben.value)[0] === P)
    expect(await sendeUndWarte(g, beginnen(P, 'runde:pre'))).toMatchObject({ ergebnis: 'angewandt' })
    expect(await sendeUndWarte(g, { type: 'BETRIEB_MELDUNG', bereich: 'par_1', meldung: { text: 'Pause', art: 'pause' } })).toMatchObject({ ergebnis: 'abgelehnt' })
  })

  it('zwei Handys, je ein Bereich: Doppelklick auf dasselbe Paar schaltet einmal; das andere Handy sieht es über die Sicht', async () => {
    const { h, s } = await bedienrechner()
    const steg = await stegHandy(h, NUR_PARALLEL, 'Steg Parallel')
    const manoev = await stegHandy(h, NUR_PARCOURS, 'Steg Parcours')
    await sendeUndWarte(steg, beginnen(P, 'runde:pre'))
    await bis(() => (bereichAuf(steg, P)?.offen.length ?? 0) > 0)
    const zeigen = naechster(steg, P)
    // Zwei Klicks hintereinander, bevor die erste Quittung da ist (die Oberfläche sperrt; der Kern muss es auch aushalten).
    const n1 = steg.sende(zeigen)!
    const n2 = steg.sende(zeigen)!
    await bis(() => steg.quittung.value?.nr === n2)
    expect(n2).toBeGreaterThan(n1)
    expect(steg.quittung.value!.ergebnis).toBe('unveraendert')
    expect(betrieb(s.state.value, P).gezeigt).toHaveLength(1)
    // Das Handy des anderen Bereichs liest dieselbe öffentliche Sicht mit: das Paar im Boot.
    await bis(() => bereichAuf(manoev, P)?.aktuell?.key === zeigen.ref)
    expect(bereichAuf(manoev, P)!.aktuell!.paar).toMatchObject({ attempt: 1 })
  })
})

describe('Zeitgrenzen (E8)', () => {
  it('Wiederholung ohne Antwort: Abstand verdoppelt sich ab quittungMs und bleibt bei höchstens 5 Minuten', () => {
    const q = NTFY_ZEITEN.quittungMs
    const folge = Array.from({ length: 9 }, (_, i) => wiederholAbstand(q, i + 1))
    expect(folge).toEqual([10_000, 20_000, 40_000, 80_000, 160_000, 300_000, 300_000, 300_000, 300_000])
    // Nie unter quittungMs, auch nicht bei einer Vorgabe über der Grenze.
    expect(wiederholAbstand(600_000, 3)).toBe(600_000)
  })

  it('Bedienrechner antwortet nicht: Action bleibt offen; kommt er wieder, Quittung und frei', async () => {
    const { b, h, s } = await bedienrechner()
    const g = await stegHandy(h, NUR_PARALLEL)
    hosts.splice(hosts.indexOf(h), 1)
    h.stop()
    const nr = g.sende(beginnen(P, 'runde:pre'))!
    // Bis zur Quittung bleibt sie offen – die Oberfläche hält die Knöpfe so lange gesperrt (K32). Die wachsenden
    // Abstände prüft der Test mit Fake-Uhr darunter – mit echter Uhr dehnte Last die Abstände (Prüfung 21.11.2026).
    await ruhe(300)
    expect(g.offen.value).toEqual([nr])
    expect(g.quittung.value?.nr).not.toBe(nr)

    // Der Bedienrechner kommt wieder (neues Fenster, derselbe Raum): holt nach, wendet einmal an, quittiert.
    const f2 = b.fenster()
    const s2 = fensterStore(f2, s.state.value)
    hostIn(f2, s2)
    await bis(() => g.quittung.value?.nr === nr)
    expect(g.quittung.value!.ergebnis).toBe('angewandt')
    expect(g.offen.value).toEqual([])
    expect(betrieb(s2.state.value, P).begonnen).toEqual(['runde:pre'])
    expect(s2.angewandt.filter((a) => a.type === 'BETRIEB_BEGINNEN')).toHaveLength(1)
  })

  it('mit den echten Zeiten (Fake-Uhr): 10 s, 20 s, 40 s … bis 5 Minuten zwischen den Wiederholungen', async () => {
    // Packen ohne echte Nebenläufigkeit (Ursache der roten Läufe, Prüfung unter Last 21.11.2026): Node packt mit
    // CompressionStream im zlib-Threadpool, also in ECHTER Zeit. Die Schleife unten rückt die Fake-Uhr aber nach jedem
    // Abarbeiten der Mikrotasks weiter – unter Last lief sie dem Packen davon (erste Sendung bei 6 s statt sofort).
    // Mit deflateSync im Stream bleibt alles in Mikrotasks, die advanceTimersByTimeAsync abwartet (testNtfy.ts).
    packenOhneThreadpool()
    vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'], shouldAdvanceTime: true })
    const { h, raum } = await bedienrechner()
    // Das Handy mit der echten Quittungszeit (10 s), sonst schnell.
    const g = await stegHandy(h, NUR_PARALLEL, 'Steg', { ...SCHNELL, quittungMs: NTFY_ZEITEN.quittungMs })
    const g1 = geraeteThemaVon(raum())
    hosts.splice(hosts.indexOf(h), 1)
    h.stop()
    const vorher = ntfy.gespeichert.filter((x) => x.topic === g1).length
    const nr = g.sende(beginnen(P, 'runde:pre'))!
    const start = Math.floor(Date.now() / 1000)
    // 13 Minuten Uhrzeit in Sekundenschritten.
    for (let sek = 0; sek < 13 * 60; sek += 1) await vi.advanceTimersByTimeAsync(1000)
    expect(g.offen.value).toEqual([nr])
    // Gemessen wird der Zeitstempel, den der nachgebaute ntfy beim Eingang setzt (falsche Uhr im Moment des Sendens),
    // nicht der Moment, in dem die Schleife ihn bemerkt: `shouldAdvanceTime` (für die asynchronen Teile nötig) gibt
    // unter Last echte Zeit dazu, die vorher in die Abstände einlief – CI rot bei ad745a9 (16 > 14,5) und 6a7753e
    // (erste Sendung bei 3 s), 21.11.2026.
    const zeiten = ntfy.gespeichert.filter((x) => x.topic === g1).slice(vorher).map((x) => x.time - start)
    const abstaende = zeiten.slice(1).map((t, i) => t - zeiten[i])
    // Erste Sendung sofort, dann 10, 20, 40, 80, 160, 300 s. Nie früher (1 s für das Abrunden auf Sekunden); später
    // nur um einen Sekundenschritt und die Echtzeit darin.
    expect(zeiten[0]).toBeLessThanOrEqual(3)
    const soll = [10, 20, 40, 80, 160, 300]
    const spiel = (s: number) => s * 0.1 + 3
    expect(abstaende.length).toBeGreaterThanOrEqual(soll.length)
    soll.forEach((s, i) => {
      expect(abstaende[i]).toBeGreaterThanOrEqual(s - 1)
      expect(abstaende[i]).toBeLessThanOrEqual(s + spiel(s))
    })
    for (const a of abstaende) expect(a).toBeLessThanOrEqual(300 + spiel(300))
  })

  it('Führungswechsel, während eine Action offen ist: sie wirkt genau einmal, das Handy bekommt eine Quittung', async () => {
    for (const warte of [0, 15, 60]) {
      ntfy = neuesNtfy()
      const { b, h, s } = await bedienrechner()
      const f2 = b.fenster()
      const s2 = fensterStore(f2, s.state.value)
      const h2 = hostIn(f2, s2)
      await ruhe(30)
      expect(h2.fuehrt.value).toBe(false)
      const g = await stegHandy(h, NUR_PARALLEL)
      await sendeUndWarte(g, beginnen(P, 'runde:pre'))
      await bis(() => (bereichAuf(g, P)?.offen.length ?? 0) > 0)
      const zeigen = naechster(g, P)
      const gezeigt = (st: AppState) => st.betrieb.bereiche[P]?.gezeigt.length ?? 0

      const nr = g.sende(zeigen)!
      // Das Führungsfenster schließt mitten drin (pagehide) – vor, während oder nach dem Anwenden.
      if (warte) await ruhe(warte)
      hosts.splice(hosts.indexOf(h), 1)
      h.stop()
      await bis(() => h2.fuehrt.value)
      await bis(() => g.quittung.value?.nr === nr)
      expect(['angewandt', 'unveraendert', 'doppelt']).toContain(g.quittung.value!.ergebnis)
      await bis(() => gezeigt(s2.state.value) >= 1)
      // Genau ein Start gezeigt – in beiden Fenstern und im gemeinsamen Speicher.
      for (const st of [s.state.value, s2.state.value, JSON.parse(f2.ablage.getItem('test.stand')!) as AppState]) expect(gezeigt(st)).toBe(1)
      expect(s2.state.value.betrieb.bereiche[P].gezeigt[0].ref).toBe(zeigen.ref)
      for (const x of geraete.splice(0)) x.stop()
      for (const x of hosts.splice(0)) x.stop()
    }
  })

  it('angewandt im Schreibfenster, Führung weg vor der Quittung: das neue Führungsfenster wendet erneut an – ohne zweite Wirkung', async () => {
    const { b, h, s } = await bedienrechner()
    const f2 = b.fenster()
    const s2 = fensterStore(f2, s.state.value)
    const g = await stegHandy(h, NUR_PARALLEL)
    const h2 = hostIn(f2, {
      ...s2,
      dispatch(action: Action) {
        s2.dispatch(action)
        // Genau in dem Augenblick, in dem das Schreibfenster die Action des Handys angewandt hat, schließt das
        // Führungsfenster – seine Quittung geht nie hinaus, `letzteNr` bleibt alt (host.ts nimmAn).
        if (action.type === 'BETRIEB_ZEIGEN' && hosts.includes(h)) {
          hosts.splice(hosts.indexOf(h), 1)
          h.stop()
        }
      },
    })
    await ruhe(30)
    await sendeUndWarte(g, beginnen(P, 'runde:pre'))
    await bis(() => (bereichAuf(g, P)?.offen.length ?? 0) > 0)
    // Das zweite Fenster wird bedient (Erfassung) – dorthin reicht das Führungsfenster die Actions der Geräte (K27).
    f2.fenster.dispatchEvent(new Event('keydown'))
    await ruhe(50)
    const zeigen = naechster(g, P)
    const nr = g.sende(zeigen)!
    await bis(() => h2.fuehrt.value)
    await bis(() => g.quittung.value?.nr === nr)
    // Gewirkt hat es einmal; die zweite Anwendung ändert nichts (bedingt über `vorher`, K30). Das Handy hört deshalb
    // „unverändert“, obwohl SEINE Action gewirkt hat (selten: Führung weg genau zwischen Anwenden und Quittung). Der Satz
    // dazu nennt deshalb seit E8 (20.11.2026) auch „schon geschehen“ und bittet, die Anzeige zu prüfen (so bestätigt
    // 26.11.2026, R11-20).
    expect(g.quittung.value!.ergebnis).toBe('unveraendert')
    expect(s2.state.value.betrieb.bereiche[P].gezeigt.map((x) => x.ref)).toEqual([zeigen.ref])
    expect(s2.angewandt.filter((a) => a.type === 'BETRIEB_ZEIGEN').length).toBeGreaterThanOrEqual(2)
    await bis(() => bereichAuf(g, P)?.aktuell?.key === zeigen.ref)
  })

  it('Koppel-Code abgelaufen: im Nachlauf „abgelaufen“ als Antwort, danach hört niemand mehr – keine Antwort, nichts gekoppelt', async () => {
    let versatz = 0
    const { h } = await bedienrechner(dm(), { uhr: () => Date.now() + versatz })
    h.gibCode(NUR_PARCOURS)
    await bis(() => !!h.raum.value?.koppeln.code)
    const code = h.raum.value!.koppeln.code!.wert
    versatz = CODE_GUELTIG_MS + 1000
    await ruhe(120)
    const g = oeffne(h.raum.value!.koppelLink)
    await g.start()
    g.koppeln('Spät', code)
    await bis(() => g.lage.value === 'abgelehnt')
    expect(g.grund.value).toBe('code-abgelaufen')

    // Nach dem Nachlauf ist das Thema zu: Eine Anmeldung bleibt ohne Antwort (die Oberfläche zeigt nach 15 s „Keine Antwort“).
    versatz = CODE_GUELTIG_MS + KOPPEL_NACHLAUF_MS + 1000
    await bis(() => h.raum.value!.koppeln.code === null)
    const g2 = oeffne(h.raum.value!.koppelLink)
    await g2.start()
    g2.koppeln('Noch später', code)
    await ruhe(600)
    expect(g2.lage.value).toBe('koppelt')
    expect(h.raum.value!.geraete).toHaveLength(0)
  })

  it('QR-Token: im Gnadenfenster nach dem Wechsel gilt der alte noch; nach der Gnadenfrist abgelehnt', async () => {
    let versatz = 0
    const { h } = await bedienrechner(dm(), { uhr: () => Date.now() + versatz })
    h.oeffneQr(NUR_PARCOURS)
    await bis(() => !!h.raum.value?.koppeln.qr)
    const alt = h.raum.value!.koppeln.qr!.paket
    // Kurz nach dem Wechsel: der alte Token ist „vorher“ und gilt noch.
    versatz = QR_TOKEN_GUELTIG_MS + 5000
    await bis(() => h.raum.value!.koppeln.qr!.paket !== alt)
    const g = oeffne(alt)
    await g.start()
    g.koppeln('Knapp')
    await bis(() => g.lage.value === 'gekoppelt')
    expect(g.aufgaben.value).toEqual(NUR_PARCOURS)

    // Ein Foto desselben alten Codes nach der Gnadenfrist: abgelehnt, kein zweites Gerät.
    versatz = 2 * QR_TOKEN_GUELTIG_MS + 20_000
    await bis(() => h.raum.value!.koppeln.qr!.tokenBis > Date.now() + 2 * QR_TOKEN_GUELTIG_MS)
    const foto = oeffne(alt)
    await foto.start()
    foto.koppeln('Foto')
    await bis(() => foto.lage.value === 'abgelehnt')
    expect(['code-abgelaufen', 'code-ungueltig']).toContain(foto.grund.value)
    await ruhe(50)
    expect(h.raum.value!.geraete.map((x) => x.name)).toEqual(['Knapp'])
  })

  it('Gerät lange offline (länger als das Einstiegsfenster): zurück, zeigt es den neuesten Vollstand, nicht den alten', async () => {
    // Zeiten im Kleinen: Vollstand alle 400 ms statt stündlich, Einstiegsfenster 2 s statt 70 min.
    const { h, s } = await bedienrechner(dm(), { zeiten: { ...SCHNELL, vollstandMs: 400 } })
    const speicher = handy()
    const r = oeffneLeseLink(h.raum.value!.anzeige, { ablage: speicher, zeiten: { ...SCHNELL, einstiegFenster: '2s' }, ablaufTaktMs: 20 })
    if (!r.ok) throw new Error(r.code)
    const tafel = r.geraet
    geraete.push(tafel)
    await tafel.start()
    await bis(() => tafel.anzeige.value !== null)
    expect(tafel.anzeige.value!.bereiche.find((x) => x.id === 'par_1')!.punkt).toBeNull()
    tafel.stop()

    // Während das Gerät weg ist: viele Änderungen, darunter Differenzen, die beim Wiederkommen außerhalb des Fensters liegen.
    s.dispatch({ type: 'BETRIEB_BEGINNEN', bereich: 'par_1', punkt: 'lauf:1' })
    await ruhe(300)
    s.dispatch({ type: 'BETRIEB_MELDUNG', bereich: 'par_1', meldung: { text: 'Kurze Pause', art: 'pause' } })
    await ruhe(2500)
    s.dispatch({ type: 'BETRIEB_MELDUNG', bereich: 'par_1', meldung: { text: 'Gleich geht es weiter', art: 'info' } })
    await ruhe(100)

    // Das Gerät zeigt sofort die abgelegte (alte) Sicht und dann den neuesten Stand.
    const r2 = oeffneLeseLink(h.raum.value!.anzeige, { ablage: speicher, zeiten: { ...SCHNELL, einstiegFenster: '2s' }, ablaufTaktMs: 20 })
    if (!r2.ok) throw new Error(r2.code)
    const zurueck = r2.geraet
    geraete.push(zurueck)
    await zurueck.start()
    await bis(() => zurueck.anzeige.value?.bereiche.find((x) => x.id === 'par_1')?.meldung?.text === 'Gleich geht es weiter')
    expect(zurueck.anzeige.value!.bereiche.find((x) => x.id === 'par_1')!.punkt?.id).toBe('lauf:1')
    // Nur, was in die letzten 2 s fiel, wurde abgefragt.
    expect(ntfy.abrufe.filter((u) => u.includes('since=2s')).length).toBeGreaterThanOrEqual(1)
  })
})
