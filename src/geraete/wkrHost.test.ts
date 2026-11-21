import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import nacl from 'tweetnacl'
import { shallowRef } from 'vue'
import { starteGeraeteHost, type GeraeteHost, type HostUmgebung } from './host'
import { ABLAGE, liesHerkunft, liesWkrEingang } from './ablage'
import type { Aufgabe } from './aufgaben'
import { gruppeDerListe } from './wkrGruppen'
import { normalisiereCode } from './koppeln'
import { liesKoppelLink } from './paket'
import { koppelThema } from './themen'
import { nachgebauterBrowser, type TestFenster } from './testBrowser'
import { bis, NachgebauterSocket, nachgebautesFetch, neuesNtfy, ruhe, type NachgebautesNtfy } from './transport/ntfy/testNtfy'
import { GeraetTransport, type Empfang } from './transport/ntfy/transport'
import { geraetSpeicherImSpeicher, type HostRaum } from './transport/ntfy/raum'
import { fromBase64Url } from './transport/ntfy/codec'
import { openGruppe, parseHostWire } from './transport/ntfy/wire'
import type { NtfyZeiten } from './transport/ntfy/leitung'
import type { Op } from './transport/ntfy/patch'
import type { GeraeteNachricht } from './transport/protokoll'
import { reducer, type Action } from '../state/reducer'
import { lage, refKey } from '../betrieb/folge'
import { SICHT_FASSUNG, sichtOeffentlich } from '../betrieb/sicht'
import { werteVon } from '../lib/eingaben'
import { listenKennung } from '../wkr/liste'
import { LISTEN_SICHT_FASSUNG, type ListenSicht } from '../wkr/sicht'
import { wkrBetriebsStand } from '../testHilfen'
import type { AppState } from '../types'

/**
 * W1.3 (Plan docs/plan-wkr-w1.md §5/§6, 21.11.2026): Bedienrechner (host.ts im nachgebauten Browser) → nachgebauter
 * ntfy (kein Netz) → ein NACKTER GeraetTransport als WKR-Gerät (die Masken und der Gerätekern kommen mit W1.4/W3).
 * Das Gerät hier tut nur, was der Kern später tut: Zeilen schicken und die gesammelte Quittung (`bis` in der Sicht der
 * Liste) mit `bestaetige` übernehmen. Starter und Gerätenamen erfunden (testHilfen).
 */

const SCHNELL: Partial<NtfyZeiten> = { abstandMs: 0, wiederholenMs: [20], zuVieleMs: 30, neuVerbindenMs: [10], quittungMs: 150, einstiegAbstandMs: 0 }
const KENNUNG = 'MUSTERW1'
const P1 = 'par_1'
const TOR = listenKennung({ bereich: P1, typeId: 'gate135', racecourse: null })
const TOR5 = listenKennung({ bereich: P1, typeId: 'tor5', racecourse: null })
const G_TOR = gruppeDerListe(TOR)
const FELD = 't1a|hin seiteA'
const LAUF = 'manoevrieren/1'

let ntfy: NachgebautesNtfy
const hosts: GeraeteHost[] = []
const geraete: GeraetTransport[] = []

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

/** Ein Fenster mit vollem Store (wie kopplung.test.ts): schreibt den Stand in den gemeinsamen Speicher. */
function fensterStore(f: TestFenster) {
  const gespeichert = f.ablage.getItem('test.stand')
  const state = shallowRef<AppState>(gespeichert ? (JSON.parse(gespeichert) as AppState) : { ...wkrBetriebsStand(), kennung: KENNUNG, geraeteServer: 'https://ntfy.test' })
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

/** „Nächster Start“ am Bedienrechner (wie die Start-Freigabe). */
function zeige(s: FStore, bereich = P1) {
  const b = sichtOeffentlich(s.state.value).bereiche.find((x) => x.id === bereich)!
  s.dispatch({ type: 'BETRIEB_ZEIGEN', bereich, ref: b.offen[0].key, vorher: b.aktuell?.key ?? null })
}

/**
 * Ein WKR-Gerät aus einem nackten GeraetTransport, gekoppelt über Koppel-Link und Geräte-Code. Es übernimmt jede
 * gesammelte Quittung (`bis` der eigenen ID in der Sicht einer Liste) – das tut später geraete/erfassen.ts.
 */
async function wkrGeraet(h: GeraeteHost, aufgaben: Aufgabe[], name = 'Handy Tor 1') {
  h.gibCode(aufgaben)
  await bis(() => !!h.raum.value?.koppeln.code && h.raum.value.koppeln.code.benutzt === null)
  const gelesen = liesKoppelLink(h.raum.value!.koppelLink)
  if (!gelesen.ok) throw new Error('Link')
  const p = gelesen.paket
  const code = normalisiereCode(h.raum.value!.koppeln.code!.wert)!
  const speicher = geraetSpeicherImSpeicher()
  const t = new GeraetTransport({
    server: p.u,
    raum: p.r,
    hostSign: fromBase64Url(p.s)!,
    hostBox: fromBase64Url(p.b)!,
    lesen: [p.t],
    oeffentlich: { g: p.g, k: p.k, e: p.e },
    koppeln: koppelThema(p.t, code),
    ich: { id: `wkr-${geraete.length}`, schluessel: nacl.box.keyPair() },
    speicher,
    sichtFassung: SICHT_FASSUNG,
    zeiten: SCHNELL,
  })
  geraete.push(t)
  const empfang: Empfang[] = []
  const g = {
    t,
    speicher,
    empfang,
    id: '',
    gruppen: [] as string[],
    /** Letzte Sicht der Liste. */
    sicht: (liste = TOR): ListenSicht | null => {
      const s = empfang.filter((e) => e.art === 'sicht' && e.gruppe === gruppeDerListe(liste)).at(-1)
      return s && s.art === 'sicht' ? (s.sicht as unknown as ListenSicht) : null
    },
    quittungen: (nr: number) => empfang.filter((e) => e.art === 'direkt' && e.nachricht.art === 'quittung' && e.nachricht.auf === nr),
    zeile: (z: number, starter: string, c: [string, string, string][], liste = TOR): GeraeteNachricht => ({
      art: 'action',
      action: { type: 'WKR_ZEILEN', liste, zeilen: [{ z, s: refKey({ art: 'm', starter, lauf: 1 }), c }] },
    }),
  }
  t.beiEmpfang((e) => {
    empfang.push(e)
    if (e.art === 'direkt' && e.nachricht.art === 'willkommen') {
      g.id = e.nachricht.id
      g.gruppen = e.nachricht.gruppen.map((x) => x.g)
    }
    if (e.art === 'sicht' && e.gruppe.startsWith('l')) {
      const eigen = (e.sicht as unknown as ListenSicht).geraete?.[g.id]
      if (eigen) t.bestaetige(eigen.bis)
    }
  })
  await t.start()
  t.sende({ art: 'hallo', name, code })
  await bis(() => g.id !== '')
  return g
}

const aktuellerStarter = (s: AppState) => lage(s, P1).aktuell!.eintrag!.starter
const werte = (s: AppState, starter: string) => werteVon(s.eingaben, LAUF, starter)

describe('WKR-Erfassung am Host (W1.3)', () => {
  it('koppeln mit Liste → Gruppenschlüssel, Liste digital, Sicht der Liste; Zeile → Werte, Haken, Herkunft – still quittiert', async () => {
    const { f, s, h, raum } = await bedienrechner()
    const g = await wkrGeraet(h, [{ art: 'liste', liste: TOR }])
    expect(g.gruppen).toEqual(['ko', G_TOR])
    expect(raum().geraete[g.id].gruppen).toEqual([G_TOR])
    await bis(() => s.state.value.wkr.listen[TOR]?.modus === 'digital')
    zeige(s)
    const starter = aktuellerStarter(s.state.value)
    await bis(() => (g.sicht()?.schlange.length ?? 0) > 0)
    const sicht = g.sicht()!
    expect(sicht).toMatchObject({ lv: LISTEN_SICHT_FASSUNG, liste: TOR, modus: 'digital', status: 'aktiv' })
    expect(sicht.geraete[g.id]).toBeDefined()

    const nr = g.t.sende(g.zeile(1, starter, [[FELD, '5', '']]))
    await bis(() => werte(s.state.value, starter)[FELD] === '5')
    expect(werte(s.state.value, starter)['erfasst@gate135']).toBeTruthy()
    // Gesammelte Quittung: `bis` in der Sicht, das Gerät nimmt die Zeile aus seiner Schlange – keine direkte Quittung.
    await bis(() => g.t.unbestaetigt().length === 0)
    expect(g.sicht()!.geraete[g.id].bis).toBeGreaterThanOrEqual(nr)
    expect(g.quittungen(nr)).toEqual([])
    // Herkunft ◆ gerätelokal am Bedienrechner – mit Gerätename, nie im Stand.
    const herkunft = liesHerkunft(KENNUNG, f.ablage).zellen[`${LAUF}|${starter}|${FELD}`]
    expect(herkunft).toMatchObject({ g: 'Handy Tor 1', l: TOR, w: '5' })
    expect(JSON.stringify(s.state.value)).not.toContain('Handy Tor 1')
  })

  it('belegte Zelle → Rückfrage im Stand, das Gerät sieht `steht`; abgelehnte Zeile steht mit Code in der Sicht', async () => {
    const { f, s, h } = await bedienrechner()
    const g = await wkrGeraet(h, [{ art: 'liste', liste: TOR }])
    await bis(() => s.state.value.wkr.listen[TOR]?.modus === 'digital')
    zeige(s)
    const starter = aktuellerStarter(s.state.value)
    s.dispatch({ type: 'SET_EINGABEN', zellen: [{ lauf: LAUF, starter, feld: FELD, wert: '10' }] })
    g.t.sende(g.zeile(1, starter, [[FELD, '5', '']]))
    await bis(() => s.state.value.wkr.rueckfragen.length === 1)
    expect(werte(s.state.value, starter)[FELD]).toBe('10')
    await bis(() => (g.sicht()?.geraete[g.id]?.rueckfragen.length ?? 0) === 1)
    expect(g.sicht()!.geraete[g.id].rueckfragen[0]).toMatchObject({ z: '1', feld: FELD, steht: '10' })
    // Keine Herkunft für eine Zelle, in der nicht der Gerätewert steht.
    expect(liesHerkunft(KENNUNG, f.ablage).zellen).toEqual({})

    g.t.sende(g.zeile(2, starter, [['fremd', '1', '']]))
    await bis(() => (g.sicht()?.geraete[g.id]?.abgelehnt.length ?? 0) === 1)
    expect(g.sicht()!.geraete[g.id].abgelehnt).toEqual([{ z: '2', grund: 'feld-fremd' }])
    expect(liesWkrEingang(KENNUNG, f.ablage).geraete[g.id].abgelehnt).toEqual([{ l: TOR, z: 2, grund: 'feld-fremd' }])
    await bis(() => g.t.unbestaetigt().length === 0)
  })

  it('Wiederholung derselben Nummer wirkt einmal (auch wenn ntfy sie noch einmal ausliefert)', async () => {
    const { s, h } = await bedienrechner()
    const g = await wkrGeraet(h, [{ art: 'liste', liste: TOR }])
    await bis(() => s.state.value.wkr.listen[TOR]?.modus === 'digital')
    zeige(s)
    const starter = aktuellerStarter(s.state.value)
    g.t.sende(g.zeile(1, starter, [[FELD, '5', '']]))
    await bis(() => g.t.unbestaetigt().length === 0)
    const zeilen = () => s.angewandt.filter((a) => a.type === 'WKR_ZEILEN').length
    expect(zeilen()).toBe(1)
    // Dieselbe Nachricht noch einmal eingestellt: Der Host kennt die Nummer schon.
    const gesendet = ntfy.gespeichert.filter((x) => x.body.includes('"pk"')).at(-1)!
    ntfy.wiederhole(gesendet.topic, gesendet.body)
    await ruhe(200)
    expect(zeilen()).toBe(1)
  })

  it('Führungswechsel mit offener Zeile: das neue Führungsfenster wendet sie an und quittiert', async () => {
    const b = nachgebauterBrowser()
    const f1 = b.fenster()
    const s1 = fensterStore(f1)
    const h1 = hostIn(f1, s1)
    h1.oeffne()
    await bis(() => h1.verbindung.value?.status === 'verbunden')
    const f2 = b.fenster()
    const s2 = fensterStore(f2)
    const h2 = hostIn(f2, s2)
    const g = await wkrGeraet(h1, [{ art: 'liste', liste: TOR }])
    await bis(() => s1.state.value.wkr.listen[TOR]?.modus === 'digital')
    zeige(s1)
    const starter = aktuellerStarter(s1.state.value)
    // Das Führungsfenster schließt; die Zeile geht los, während niemand führt.
    h1.stop()
    g.t.sende(g.zeile(1, starter, [[FELD, '5', '']]))
    await bis(() => h2.fuehrt.value)
    await bis(() => werte(s2.state.value, starter)[FELD] === '5', 5000)
    await bis(() => g.t.unbestaetigt().length === 0, 5000)
    expect([...s1.angewandt, ...s2.angewandt].filter((a) => a.type === 'WKR_ZEILEN')).toHaveLength(1)
  })

  it('Liste entziehen → neuer Schlüssel der Gruppe; das Gerät liest die Liste nicht mehr', async () => {
    const { s, h, raum } = await bedienrechner()
    const g = await wkrGeraet(h, [{ art: 'liste', liste: TOR }])
    const zweites = await wkrGeraet(h, [{ art: 'liste', liste: TOR }], 'Handy Tor 1b')
    await bis(() => s.state.value.wkr.listen[TOR]?.modus === 'digital')
    await bis(() => g.sicht() !== null && zweites.sicht() !== null)
    const epoche = raum().gruppen[G_TOR].e
    h.setzeAufgaben(g.id, [])
    await bis(() => raum().gruppen[G_TOR].e === epoche + 1)
    expect(raum().geraete[g.id].gruppen).toEqual([])
    // Das verbleibende Gerät bekommt den neuen Schlüssel und liest weiter; das entzogene nicht (was vor dem Wechsel
    // schon unterwegs war, kann noch ankommen – geprüft wird der Start, der erst danach gezeigt wurde).
    zeige(s)
    const neu = lage(s.state.value, P1).aktuell!.key
    await bis(() => zweites.empfang.some((e) => e.art === 'direkt' && e.nachricht.art === 'schluessel'))
    await bis(() => !!zweites.sicht()?.schlange.some((x) => x.key === neu))
    await ruhe(150)
    const gSichten = g.empfang.filter((e) => e.art === 'sicht' && e.gruppe === G_TOR).map((e) => (e as { sicht: unknown }).sicht as ListenSicht)
    expect(gSichten.some((x) => x.schlange.some((y) => y.key === neu))).toBe(false)
    expect(g.empfang.some((e) => e.art === 'direkt' && e.nachricht.art === 'aufgaben')).toBe(true)
  })

  it('Lebenszeichen: Akku und wartend im Register, still quittiert; Hinweis bis „gesehen“', async () => {
    const { f, s, h, raum } = await bedienrechner()
    const g = await wkrGeraet(h, [{ art: 'liste', liste: TOR }])
    await bis(() => g.sicht() !== null)
    const nr = g.t.sende({ art: 'lebenszeichen', wartend: 3, akku: 55 })
    await bis(() => raum().geraete[g.id].akku === 55)
    expect(h.raum.value!.geraete.find((x) => x.id === g.id)).toMatchObject({ wartend: 3, akku: 55 })
    await bis(() => g.t.unbestaetigt().length === 0)
    expect(g.quittungen(nr)).toEqual([])

    zeige(s)
    const startNr = s.state.value.starters.find((p) => p.id === aktuellerStarter(s.state.value))!.startNr
    h.hinweis(TOR, 'pruefen', startNr)
    await bis(() => (g.sicht()?.geraete[g.id]?.hinweise.length ?? 0) === 1)
    const hinweis = g.sicht()!.geraete[g.id].hinweise[0]
    expect(startNr).not.toBe('')
    expect(hinweis).toEqual({ id: 1, code: 'pruefen', startNr })
    g.t.sende({ art: 'gesehen', hinweis: hinweis.id })
    await bis(() => g.sicht()!.geraete[g.id].hinweise.length === 0)
    expect(liesWkrEingang(KENNUNG, f.ablage).geraete[g.id].hinweise).toEqual([])
  })

  it('Start-Freigabe (E7) auf demselben Gerät bleibt direkt quittiert', async () => {
    const { s, h } = await bedienrechner()
    const g = await wkrGeraet(h, [{ art: 'startfreigabe', bereiche: [P1] }, { art: 'liste', liste: TOR }])
    await bis(() => g.sicht() !== null)
    const nr = g.t.sende({ art: 'action', action: { type: 'BETRIEB_MELDUNG', bereich: P1, meldung: { text: 'Pause', art: 'pause' } } })
    await bis(() => g.quittungen(nr).length === 1)
    expect(g.quittungen(nr)[0]).toMatchObject({ nachricht: { ergebnis: 'angewandt' } })
    expect(s.state.value.betrieb.bereiche[P1]?.meldung?.text).toBe('Pause')
    // Eine Liste, die das Gerät nicht hat: direkt abgelehnt.
    const fremd = g.t.sende({ art: 'action', action: { type: 'WKR_ZEILEN', liste: TOR5, zeilen: [{ z: 9, s: 'x', c: [] }] } })
    await bis(() => g.quittungen(fremd).length === 1)
    expect(g.quittungen(fremd)[0]).toMatchObject({ nachricht: { ergebnis: 'abgelehnt', grund: 'nicht-erlaubt' } })
  })

  it('Leitung: Sicht der Liste verschlüsselt, ohne Namen, Herkunft, Geburtsdatum, Gewicht, Werte anderer Listen', async () => {
    const { s, h, raum } = await bedienrechner()
    const g = await wkrGeraet(h, [{ art: 'liste', liste: TOR }])
    await bis(() => s.state.value.wkr.listen[TOR]?.modus === 'digital')
    zeige(s)
    const starter = aktuellerStarter(s.state.value)
    const GEHEIM = 'Geheime Bemerkung am Tor 5'
    s.dispatch({ type: 'SET_EINGABEN', zellen: [{ lauf: LAUF, starter, feld: 'bemerkung@tor5', wert: GEHEIM }] })
    g.t.sende(g.zeile(1, starter, [[FELD, '5', '']]))
    await bis(() => g.t.unbestaetigt().length === 0)
    await ruhe(100)
    const r = raum()
    const personen = s.state.value.starters.flatMap((p) => [p.vorname, p.nachname, p.verein, p.geburtsdatum].filter((x) => x && x.length > 3))
    const roh = ntfy.gespeichert.map((x) => x.body).join('\n')
    for (const verboten of [...personen, GEHEIM, 'Handy Tor 1', KENNUNG]) expect(roh, verboten).not.toContain(verboten)

    const themen = new Set(ntfy.gespeichert.map((x) => x.topic))
    const inhalte: unknown[] = []
    for (const thema of themen) {
      for (const body of ntfy.bodies(thema)) {
        const w = parseHostWire(body)
        if (!w || w.l || w.g !== G_TOR) continue
        const inhalt = await openGruppe(w, fromBase64Url(r.gruppen[G_TOR].k)!)
        expect(inhalt).not.toBeNull()
        inhalte.push(inhalt)
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
    for (const verboten of ['vorname', 'nachname', 'verein', 'bundesland', 'geburtsdatum', 'gewicht', 'geschlecht', 'groesse', 'eingaben', 'starters', 'herkunft', 'name'])
      expect(alle.has(verboten), verboten).toBe(false)
    const text = JSON.stringify(inhalte)
    // `kennung` gibt es als Feld-Kennung der Maske; die Kennung der Veranstaltung steht nie darin.
    for (const verboten of [...personen, GEHEIM, 'Handy Tor 1', KENNUNG]) expect(text, verboten).not.toContain(verboten)
    // Die öffentlichen Gruppen tragen nichts aus der Erfassung.
    for (const gruppe of ['ko', 'kz']) {
      const thema = gruppe === 'ko' ? r.oeffentlich.a : r.oeffentlich.z
      for (const body of ntfy.bodies(thema)) {
        const w = parseHostWire(body)
        if (!w || w.l) continue
        const inhalt = JSON.stringify(await openGruppe(w, fromBase64Url(r.gruppen[gruppe].k)!))
        expect(inhalt).not.toContain(FELD)
        expect(inhalt).not.toContain('rueckfragen')
      }
    }
  })

  it('ohne Raum keine Verbindung – auch mit Listen in der Veranstaltung', async () => {
    const b = nachgebauterBrowser()
    const f = b.fenster()
    const s = fensterStore(f)
    s.dispatch({ type: 'WKR_LISTE', liste: TOR, modus: 'digital' })
    const h = hostIn(f, s)
    h.hinweis(TOR, 'pruefen')
    await ruhe(100)
    expect(h.raum.value).toBeNull()
    expect(ntfy.gespeichert).toEqual([])
    expect(ntfy.abos).toEqual([])
    expect(f.ablage.getItem(ABLAGE.wkr)).toBeNull()
  })
})
