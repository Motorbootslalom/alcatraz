import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import nacl from 'tweetnacl'
import { GeraetTransport, HostTransport, lesegeraet, type Eingang, type Empfang, type HostOptionen } from './transport'
import {
  direktThemaVon,
  geraeteThemaVon,
  geraetSpeicherImSpeicher,
  hostSpeicherImSpeicher,
  lesePaket,
  neueGeraeteSchluessel,
  neuerRaum,
  themenDerGruppe,
  type HostRaum,
  type HostSpeicher,
} from './raum'
import { canonicalJson, fromBase64Url, textHash, toBase64Url } from './codec'
import { openGruppe, parseHostWire, sealAnkuendigung, sealGruppe, sealVomGeraet, type HostWire } from './wire'
import type { NtfyZeiten } from './leitung'
import type { Json } from './patch'
import { OEFFENTLICH, PROTOKOLL_FASSUNG, ZUSCHAUER, type GeraeteNachricht } from '../protokoll'
import { koppelThema } from '../../themen'
import { bis, grosserBetrieb, NachgebauterSocket, nachgebautesFetch, neuesNtfy, ruhe, SERVER, type NachgebautesNtfy } from './testNtfy'
import { reducer } from '../../../state/reducer'
import { sichtOeffentlich, sichtZuschauer } from '../../../betrieb/sicht'
import type { AppState } from '../../../types'

/**
 * Host und Geräte über einen nachgebauten ntfy-Server (testNtfy.ts) – kein echtes Netz. Alle Starter, Geräte und
 * Codes sind erfunden. Die mit S1–S7 bzw. K13–K18 benannten Fälle sind die Lücken des Prototyps (Befund vom
 * 16.11.2026); sie liefen gegen dessen Verhalten rot. „Befunde der E5-Prüfung“ (16.11.2026) liefen gegen den ersten
 * Stand von E5 rot.
 *
 * Aus tafel transport.test.ts sind alle 15 Fälle übernommen oder ersetzt: „fordert bei einer Lücke den vollen Stand
 * an“ durch die Abfrage (request-state entfällt, Plan §5), „Neuladen vor einem wartenden Zustand“ und „erkennt ein
 * freigeschaltetes Gerät beim Wiederkommen am Schlüssel“ stehen unten. Der Logo-Fall aus patch.test.ts fehlt mit
 * Grund: Logos gehen nicht an entfernte Anzeigen (BETRIEB_ANNAHMEN).
 */

const SV = 4
const CODE = 'CODE23'
const SCHNELL: Partial<NtfyZeiten> = {
  abstandMs: 0,
  wiederholenMs: [20],
  zuVieleMs: 30,
  neuVerbindenMs: [10],
  quittungMs: 150,
  einstiegAbstandMs: 0,
  bearbeitungMs: 2000,
}

let ntfy: NachgebautesNtfy
const laufend: { stop(): void }[] = []

beforeEach(() => {
  ntfy = neuesNtfy()
  vi.stubGlobal('WebSocket', NachgebauterSocket)
  vi.stubGlobal('fetch', nachgebautesFetch)
})

afterEach(() => {
  for (const t of laufend.splice(0)) t.stop()
  vi.unstubAllGlobals()
})

/** Gleich nach Inhalt – nach dem Nachziehen einer Differenz kann die Reihenfolge der Schlüssel anders sein. */
const gleich = (a: unknown, b: unknown) => canonicalJson(a) === canonicalJson(b)

/** Die Sicht als JSON, wie der Host sie verteilt. */
const alsJson = (stand: AppState) => JSON.parse(JSON.stringify(sichtOeffentlich(stand))) as Json
/** Die Zuschauersicht als JSON (Gruppe kz, Thema oZ; ab E6). */
const zuschauerJson = (stand: AppState) => JSON.parse(JSON.stringify(sichtZuschauer(sichtOeffentlich(stand, { logos: false })))) as Json

function naechster(stand: AppState, bereich: string, zeit: number): AppState {
  const b = sichtOeffentlich(stand).bereiche.find((x) => x.id === bereich)!
  return reducer(stand, { type: 'BETRIEB_ZEIGEN', bereich, ref: b.offen[0].key, vorher: b.aktuell?.key ?? null, zeit })
}

/** Ein Host mit eigenem Raum; ohne `bediene` antwortet niemand. */
function host(raum: HostRaum = neuerRaum(SERVER), speicher: HostSpeicher = hostSpeicherImSpeicher(raum), mehr: Partial<HostOptionen> = {}) {
  const t = new HostTransport({ server: SERVER, speicher, sichtFassung: SV, zeiten: SCHNELL, ...mehr })
  laufend.push(t)
  const eingaenge: Eingang[] = []
  t.beiEingang((e) => eingaenge.push(e))
  t.liesAuch(koppelThema(raum.oeffentlich.a, CODE))
  return { t, raum, speicher, eingaenge }
}

/** Starten und warten, bis das Abo steht – vorher Verteiltes würde zusammengefasst. */
async function starte(...hosts: ReturnType<typeof host>[]): Promise<void> {
  for (const h of hosts) await h.t.start()
  await bis(() => hosts.every((h) => h.t.status.value === 'verbunden'))
}

/**
 * Was die Anwendung am Host später tut (E7), hier schlicht: Anmeldung mit dem einen Code annehmen, sonst
 * ablehnen; Actions sammeln und quittieren.
 */
function bediene(h: ReturnType<typeof host>, gruppen: string[] = [OEFFENTLICH], dauerMs = 0) {
  const actions: Eingang[] = []
  h.t.beiEingang((e) => {
    if (e.nachricht.art === 'hallo') {
      if (!e.gebunden && e.nachricht.code !== CODE) return h.t.ablehnen(e, 'code-ungueltig')
      if (h.t.begruesse(e, { gruppen, aufgaben: [] }) === 'id-belegt') h.t.ablehnen(e, 'id-belegt')
      return
    }
    actions.push(e)
    if (dauerMs) setTimeout(() => h.t.quittiere(e, 'angewandt'), dauerMs)
    else h.t.quittiere(e, 'angewandt')
  })
  return actions
}

function empfaenger(t: GeraetTransport) {
  const empfang: Empfang[] = []
  t.beiEmpfang((e) => empfang.push(e))
  const sichten = () => empfang.filter((e) => e.art === 'sicht').map((e) => (e as { sicht: Json }).sicht)
  const direkt = (art: string) => empfang.some((e) => e.art === 'direkt' && e.nachricht.art === art)
  return { empfang, sichten, letzte: () => sichten()[sichten().length - 1], direkt }
}

/** Ein Lese-Gerät aus dem Tafel- (a) oder Zuschauer-Link (z). */
function leser(raum: HostRaum, welches: 'a' | 'z' = 'a', mehr: Partial<NtfyZeiten> = {}, sichtFassung = SV) {
  const speicher = geraetSpeicherImSpeicher()
  const t = lesegeraet(lesePaket(raum, welches), speicher, sichtFassung, { ...SCHNELL, ...mehr })
  laufend.push(t)
  return { t, speicher, ...empfaenger(t) }
}

/** Ein Gerät, das sich mit dem Code koppeln will (noch ohne Antwort). */
function geraet(raum: HostRaum, id: string, schluessel = neueGeraeteSchluessel(), uhr?: () => number, zeiten: Partial<NtfyZeiten> = SCHNELL, speicher = geraetSpeicherImSpeicher()) {
  const t = new GeraetTransport({
    server: SERVER,
    raum: raum.r,
    hostSign: fromBase64Url(raum.sign.pk)!,
    hostBox: fromBase64Url(raum.box.pk)!,
    lesen: [raum.oeffentlich.a],
    oeffentlich: { k: raum.gruppen[OEFFENTLICH].k, e: raum.gruppen[OEFFENTLICH].e },
    koppeln: koppelThema(raum.oeffentlich.a, CODE),
    ich: { id, schluessel },
    speicher,
    sichtFassung: SV,
    zeiten,
    uhr,
  })
  laufend.push(t)
  return { t, speicher, schluessel, ...empfaenger(t) }
}

async function gekoppelt(raum: HostRaum, id: string, code = CODE, zeiten?: Partial<NtfyZeiten>) {
  const g = geraet(raum, id, undefined, undefined, zeiten)
  await g.t.start()
  g.t.sende({ art: 'hallo', name: id, code })
  await bis(() => g.direkt('willkommen') || g.direkt('abgelehnt'))
  return g
}

const action = (bereich = 'par_1'): GeraeteNachricht => ({ art: 'action', action: { type: 'BETRIEB_MELDUNG', bereich, meldung: null } })

/** Nachrichten des Hosts auf einem Thema, gelesen (Anhänge als ihr Inhalt). */
const hostWires = (thema: string): HostWire[] => ntfy.bodies(thema).map((b) => parseHostWire(b)).filter((w): w is HostWire => w !== null)

describe('Verteilen an Lese-Geräte (Anzeigetafel, Zuschauer)', () => {
  it('erst voll als angekündigter Anhang, danach kleine Änderungen – je Gruppe an ihr Thema (ko → oA, kz → oZ)', async () => {
    const h = host()
    await starte(h)
    let { stand, bereich } = grosserBetrieb()
    h.t.verteile(OEFFENTLICH, alsJson(stand))
    h.t.verteile(ZUSCHAUER, zuschauerJson(stand))
    await bis(() => hostWires(h.raum.oeffentlich.a).length >= 1 && hostWires(h.raum.oeffentlich.z).length >= 1)
    // Jede Gruppe nur auf ihrem Thema (E6): Die Anzeigetafel bekommt nichts der Zuschauer und umgekehrt.
    expect(new Set(hostWires(h.raum.oeffentlich.a).map((w) => w.g))).toEqual(new Set([OEFFENTLICH]))
    expect(new Set(hostWires(h.raum.oeffentlich.z).map((w) => w.g))).toEqual(new Set([ZUSCHAUER]))

    const tafel = leser(h.raum, 'a')
    const zuschauer = leser(h.raum, 'z')
    await tafel.t.start()
    await zuschauer.t.start()
    await bis(() => tafel.sichten().length === 1 && zuschauer.sichten().length === 1)
    expect(tafel.letzte()).toEqual(alsJson(stand))
    expect(zuschauer.letzte()).toEqual(zuschauerJson(stand))
    // Die volle Sicht der Anzeigetafel ging als Anhang; geladen wurde nur, was angekündigt war.
    expect(ntfy.dateien.size).toBeGreaterThanOrEqual(1)
    expect(ntfy.abrufe.filter((u) => u.includes('/file/'))).toHaveLength(ntfy.dateien.size)

    const vorher = ntfy.gespeichert.length
    stand = naechster(stand, bereich, 2000)
    h.t.verteile(OEFFENTLICH, alsJson(stand))
    h.t.verteile(ZUSCHAUER, zuschauerJson(stand))
    await bis(() => tafel.sichten().length === 2 && zuschauer.sichten().length === 2)
    expect(tafel.letzte()).toEqual(alsJson(stand))
    expect(zuschauer.letzte()).toEqual(zuschauerJson(stand))
    // Je Thema eine kleine Nachricht, kein Anhang.
    const neu = ntfy.gespeichert.slice(vorher)
    expect(neu.map((g) => g.topic).sort()).toEqual([h.raum.oeffentlich.a, h.raum.oeffentlich.z].sort())
    for (const g of neu) expect(g.body.length).toBeLessThan(4096)
    // Gleiches geht nicht noch einmal hinaus.
    h.t.verteile(OEFFENTLICH, alsJson(stand))
    h.t.verteile(ZUSCHAUER, zuschauerJson(stand))
    await ruhe()
    expect(ntfy.gespeichert.length).toBe(vorher + 2)
  })

  it('Einstieg mit since-Abfrage: zuerst abfragen, nur den neuesten Vollstand laden, dann ab dort abonnieren (K15)', async () => {
    const h = host()
    await starte(h)
    let { stand, bereich } = grosserBetrieb()
    const gesendet = (n: number) => bis(() => hostWires(h.raum.oeffentlich.a).filter((w) => !w.l).length === n)
    h.t.verteile(OEFFENTLICH, alsJson(stand))
    await gesendet(1)
    stand = naechster(stand, bereich, 2000)
    h.t.verteile(OEFFENTLICH, alsJson(stand))
    await gesendet(2)
    h.t.vollstand(OEFFENTLICH)
    await gesendet(3)
    stand = naechster(stand, bereich, 3000)
    h.t.verteile(OEFFENTLICH, alsJson(stand))
    await gesendet(4)
    const vollstaende = hostWires(h.raum.oeffentlich.a).filter((w) => w.l)
    expect(vollstaende).toHaveLength(2)

    const t = leser(h.raum, 'a')
    await t.t.start()
    await bis(() => t.sichten().length > 0)
    await ruhe()
    // Erster Abruf: die Abfrage über das Einstiegsfenster.
    expect(ntfy.abrufe[0]).toBe(`${SERVER}/${h.raum.oeffentlich.a}/json?poll=1&since=70m`)
    // Nur der neueste Vollstand wurde geladen, danach die Differenz.
    const neuester = vollstaende[1].l!.u
    expect(ntfy.abrufe.filter((u) => u.includes('/file/'))).toEqual([neuester])
    expect(t.sichten()).toHaveLength(2)
    expect(t.letzte()).toEqual(alsJson(stand))
    // Abonniert ab der letzten abgefragten Nachricht.
    const letzte = ntfy.gespeichert.filter((g) => g.topic === h.raum.oeffentlich.a).at(-1)!
    expect(ntfy.abos.at(-1)).toBe(`wss://ntfy.test/${h.raum.oeffentlich.a}/ws?since=${letzte.id}`)
  })

  it('verwirft eine Nachricht an alle, die nicht vom Host signiert ist', async () => {
    const h = host()
    await starte(h)
    h.t.verteile(OEFFENTLICH, { stand: 1 })
    const t = leser(h.raum)
    await t.t.start()
    await bis(() => t.sichten().length === 1)

    // Jeder mit dem Lese-Link kennt den öffentlichen Schlüssel – aber nicht den Signaturschlüssel des Hosts.
    const faelscher = nacl.sign.keyPair()
    const kopf = { v: PROTOKOLL_FASSUNG, r: h.raum.r, g: OEFFENTLICH, e: 1, n: 999, a: 'v' as const, sv: SV, hz: Date.now() }
    const gefaelscht = await sealGruppe({ voll: { stand: 'gefälscht' } }, kopf, h.raum.oeffentlich.a, fromBase64Url(h.raum.gruppen.ko.k)!, faelscher.secretKey)
    ntfy.publish(h.raum.oeffentlich.a, gefaelscht)
    await ruhe()
    expect(t.sichten()).toEqual([{ stand: 1 }])
  })

  it('fasst schnelle Änderungen zusammen', async () => {
    const h = host(undefined, undefined, { zeiten: { ...SCHNELL, abstandMs: 300 } })
    await starte(h)
    h.t.verteile(OEFFENTLICH, { stand: 0 })
    await bis(() => hostWires(h.raum.oeffentlich.a).length === 1)
    for (let i = 1; i <= 10; i++) h.t.verteile(OEFFENTLICH, { stand: i })
    const t = leser(h.raum)
    await t.t.start()
    await bis(() => gleich(t.letzte(), { stand: 10 }), 4000)
    expect(hostWires(h.raum.oeffentlich.a).length).toBeLessThanOrEqual(3)
  })

  it('wartet bei „zu viele Anfragen“ und schickt dann den neuesten Stand', async () => {
    const h = host()
    await starte(h)
    const t = leser(h.raum)
    await t.t.start()
    await bis(() => t.t.status.value === 'verbunden')
    ntfy.antworten = [429, 429]
    h.t.verteile(OEFFENTLICH, { stand: 7 })
    await bis(() => gleich(t.letzte(), { stand: 7 }))
    expect(h.t.fehler.value).toBeNull()
  })

  it('Lücke: holt den neuesten Stand per Abfrage nach', async () => {
    const h = host()
    await starte(h)
    let { stand, bereich } = grosserBetrieb()
    h.t.verteile(OEFFENTLICH, alsJson(stand))
    const t = leser(h.raum)
    await t.t.start()
    await bis(() => t.sichten().length === 1)

    // Eine Änderung erreicht das Abo nicht (ntfy hat sie aber) …
    ntfy.verschlucke = h.raum.oeffentlich.a
    stand = naechster(stand, bereich, 2000)
    h.t.verteile(OEFFENTLICH, alsJson(stand))
    await ruhe()
    expect(t.sichten()).toHaveLength(1)
    // … die nächste passt nicht: Das Gerät fragt ab und ist danach aktuell – ohne den Host zu fragen.
    stand = naechster(stand, bereich, 3000)
    h.t.verteile(OEFFENTLICH, alsJson(stand))
    await bis(() => gleich(t.letzte(), alsJson(stand)))
    expect(ntfy.abrufe.filter((u) => u.includes('poll=1'))).toHaveLength(2)
  })

  it('schickt spätestens alle vollstandMs einen Vollstand (Anhänge hält ntfy nur 3 h, K15)', async () => {
    const h = host(undefined, undefined, { zeiten: { ...SCHNELL, vollstandMs: 120 } })
    await starte(h)
    h.t.verteile(OEFFENTLICH, { stand: 1 })
    await ruhe(400)
    const voll = hostWires(h.raum.oeffentlich.a).filter((w) => w.a === 'v')
    expect(voll.length).toBeGreaterThanOrEqual(3)
    expect(new Set(voll.map((w) => w.n)).size).toBe(voll.length)
  })

  it('Zuschauer-Link erneuern lässt die Anzeigetafel unberührt (K13)', async () => {
    const h = host()
    await starte(h)
    h.t.verteile(OEFFENTLICH, { tafel: 1 })
    h.t.verteile(ZUSCHAUER, { zuschauer: 1 })
    const tafel = leser(h.raum, 'a')
    const alterZuschauer = leser(h.raum, 'z')
    await tafel.t.start()
    await alterZuschauer.t.start()
    await bis(() => tafel.sichten().length === 1 && alterZuschauer.sichten().length === 1)
    const tafelVorher = hostWires(h.raum.oeffentlich.a).length

    const neuesThema = h.t.erneuereThema('z')!
    expect(neuesThema).not.toBe(h.raum.oeffentlich.z)
    const raum = h.speicher.lies()!
    expect(raum.oeffentlich.a).toBe(h.raum.oeffentlich.a)
    expect([raum.gruppen.ko.k, raum.gruppen.ko.e]).toEqual([h.raum.gruppen.ko.k, h.raum.gruppen.ko.e])
    expect([raum.gruppen.kz.k, raum.gruppen.kz.e]).toEqual([h.raum.gruppen.kz.k, h.raum.gruppen.kz.e])
    // Der neue Link zeigt sofort etwas (Vollstand), der alte bekommt nichts mehr, die Tafel weiter alles – und vom
    // Erneuern selbst keine einzige Nachricht.
    const neuerZuschauer = leser(raum, 'z')
    await neuerZuschauer.t.start()
    await bis(() => neuerZuschauer.sichten().length === 1)
    expect(hostWires(h.raum.oeffentlich.a)).toHaveLength(tafelVorher)
    h.t.verteile(OEFFENTLICH, { tafel: 2 })
    h.t.verteile(ZUSCHAUER, { zuschauer: 2 })
    await bis(() => gleich(tafel.letzte(), { tafel: 2 }) && gleich(neuerZuschauer.letzte(), { zuschauer: 2 }))
    await ruhe()
    expect(alterZuschauer.sichten()).toEqual([{ zuschauer: 1 }])
    expect(tafel.sichten()).toEqual([{ tafel: 1 }, { tafel: 2 }])
  })

  it('Raum beendet: signierte Meldung an jede öffentliche Gruppe', async () => {
    const h = host()
    await starte(h)
    const z = leser(h.raum, 'z')
    const a = leser(h.raum, 'a')
    await z.t.start()
    await a.t.start()
    await bis(() => z.t.status.value === 'verbunden' && a.t.status.value === 'verbunden')
    h.t.melde(OEFFENTLICH, { art: 'ende' })
    h.t.melde(ZUSCHAUER, { art: 'ende' })
    await bis(() => z.empfang.some((e) => e.art === 'meldung') && a.empfang.some((e) => e.art === 'meldung'))
    expect(z.empfang.find((e) => e.art === 'meldung')).toMatchObject({ gruppe: 'kz', meldung: { art: 'ende' } })
    expect(a.empfang.find((e) => e.art === 'meldung')).toMatchObject({ gruppe: 'ko', meldung: { art: 'ende' } })
  })

  it('Fassung: eine andere Sicht-Fassung wird nicht gezeigt, sondern gemeldet (F7)', async () => {
    const h = host()
    await starte(h)
    h.t.verteile(OEFFENTLICH, { stand: 1 })
    const t = leser(h.raum, 'a', {}, SV + 1)
    await t.t.start()
    await bis(() => t.t.fehler.value?.code === 'fassung')
    expect(t.sichten()).toEqual([])
    expect(t.t.fremdeFassung.value).toEqual({ v: PROTOKOLL_FASSUNG, sv: SV })
  })

  it('jede Nachricht des Hosts trägt v, sv und hz – signiert', async () => {
    const h = host(undefined, undefined, { uhr: () => 123_456 })
    await starte(h)
    h.t.verteile(OEFFENTLICH, { stand: 1 })
    h.t.melde(OEFFENTLICH, { art: 'neu-laden' })
    h.t.verteile(ZUSCHAUER, { stand: 1 })
    h.t.melde(ZUSCHAUER, { art: 'neu-laden' })
    await bis(() => hostWires(h.raum.oeffentlich.a).length === 2 && hostWires(h.raum.oeffentlich.z).length === 2)
    for (const w of [...hostWires(h.raum.oeffentlich.a), ...hostWires(h.raum.oeffentlich.z)]) {
      expect(w).toMatchObject({ v: PROTOKOLL_FASSUNG, sv: SV, hz: 123_456, r: h.raum.r })
    }
  })
})

describe('Geräte koppeln und Actions', () => {
  it('wartet mit dem Senden, bis das Abo steht', async () => {
    const h = host()
    bediene(h)
    await starte(h)
    const g = geraet(h.raum, 'geraet-a')
    void g.t.start()
    g.t.sende({ art: 'hallo', name: 'Steg Muster', code: CODE })
    expect(ntfy.gespeichert).toHaveLength(0)
    await bis(() => g.direkt('willkommen'))
  })

  it('koppelt, quittiert und schickt eine Nachricht zur Zeit, der Reihe nach', async () => {
    const h = host()
    const actions = bediene(h)
    await starte(h)
    const g = await gekoppelt(h.raum, 'geraet-a')
    expect(g.direkt('willkommen')).toBe(true)
    const nrn = [g.t.sende(action()), g.t.sende(action()), g.t.sende(action())]
    expect(g.t.unbestaetigt()).toEqual(nrn)
    await bis(() => g.t.unbestaetigt().length === 0)
    expect(actions.map((e) => e.nr)).toEqual(nrn)
    expect(actions.every((e) => e.gebunden && e.id === 'geraet-a')).toBe(true)
    // Die Zeit einer Action stempelt der Host.
    expect(actions[0].nachricht).toEqual({ art: 'action', action: { type: 'BETRIEB_MELDUNG', bereich: 'par_1', meldung: null } })
    // Actions gingen an g, Antworten an d – nie an ein öffentliches Thema. Mindestens je drei: Unter Last (volle
    // Suite im Commit-Hook) wiederholt das Gerät eine Action, bevor die Quittung da ist (wie im S2-Test); dass jede
    // nur einmal wirkt, zeigen `actions` und `letzteNr`.
    expect(ntfy.bodies(geraeteThemaVon(h.speicher.lies()!)).length).toBeGreaterThanOrEqual(3)
    expect(hostWires(direktThemaVon(h.raum, 'geraet-a')).length).toBeGreaterThanOrEqual(3)
    expect(h.speicher.lies()!.geraete['geraet-a'].letzteNr).toBe(nrn[2])
  })

  it('zwei Tabs mit derselben Kopplung (ein Speicher): nie dieselbe Nummer – jede Action kommt an (Befund 15, 21.11.2026)', async () => {
    const h = host()
    const actions = bediene(h)
    await starte(h)
    const a = await gekoppelt(h.raum, 'geraet-a')
    // Der zweite Tab liest den abgelegten Stand – danach zählt jeder für sich weiter, solange er nicht nachliest.
    const b = geraet(h.raum, 'geraet-a', a.schluessel, undefined, SCHNELL, a.speicher)
    await b.t.start()
    const nrn = [a.t.sende(action()), b.t.sende(action()), a.t.sende(action()), b.t.sende(action())]
    expect(new Set(nrn).size).toBe(4)
    await bis(() => a.t.unbestaetigt().length === 0 && b.t.unbestaetigt().length === 0)
    expect(new Set(actions.map((e) => e.nr))).toEqual(new Set(nrn))
  })

  it('nimmt von einem nicht gekoppelten Gerät nur die Anmeldung an', async () => {
    const h = host()
    bediene(h)
    await starte(h)
    const g = geraet(h.raum, 'geraet-x')
    await g.t.start()
    g.t.sende({ art: 'hallo', name: 'x', code: 'FALSCH' })
    await bis(() => g.direkt('abgelehnt'))
    // Eine Action ohne Kopplung kommt gar nicht erst an (sie liegt beim Gerät, bis es gekoppelt ist).
    g.t.sende(action())
    await ruhe()
    // Unter Last (volle Suite) kann die Anmeldung vor der Ablehnung noch einmal wiederholt werden – nie eine Action.
    expect(new Set(h.eingaenge.map((e) => e.nachricht.art))).toEqual(new Set(['hallo']))
    expect(h.eingaenge[0].gebunden).toBe(false)
  })

  it('S1: bindet eine gekoppelte Geräte-ID nie an einen anderen Schlüssel', async () => {
    const h = host()
    const actions = bediene(h)
    await starte(h)
    const echt = await gekoppelt(h.raum, 'geraet-a')
    const echterSchluessel = toBase64Url(echt.schluessel.publicKey)

    // Ein Fremder kennt die ID und hat sogar einen gültigen Code.
    const fremd = await gekoppelt(h.raum, 'geraet-a')
    expect(fremd.direkt('willkommen')).toBe(false)
    expect(fremd.empfang.find((e) => e.art === 'direkt')).toMatchObject({ nachricht: { art: 'abgelehnt', grund: 'id-belegt' } })
    expect(h.speicher.lies()!.geraete['geraet-a'].pk).toBe(echterSchluessel)

    // Das echte Gerät bleibt drin und schaltet weiter.
    echt.t.sende(action())
    await bis(() => actions.length === 1)
    expect(actions[0].pk).toBe(echterSchluessel)
  })

  it('S2: eine wiederholte Nachricht (POST scheinbar gescheitert) wirkt nur einmal', async () => {
    const h = host()
    const actions = bediene(h, [OEFFENTLICH], 100)
    await starte(h)
    const g = await gekoppelt(h.raum, 'geraet-a')
    // ntfy nimmt an, antwortet aber mit einem Fehler – das Gerät wiederholt mit derselben Nummer, während der Host
    // die erste noch bearbeitet.
    const g1 = geraeteThemaVon(h.speicher.lies()!)
    const vorher = ntfy.bodies(g1).length
    ntfy.antwortenNachAnnahme = [500]
    g.t.sende(action())
    await bis(() => g.t.unbestaetigt().length === 0)
    await ruhe()
    // Mindestens eine Wiederholung (unter Last auch eine zweite, wenn die Quittung länger als quittungMs braucht).
    expect(ntfy.bodies(g1).length - vorher).toBeGreaterThanOrEqual(2)
    expect(actions).toHaveLength(1)
  })

  it('S2/S18: Doppelte bleiben Doppelte, auch über einen Neustart des Hosts', async () => {
    const raum = neuerRaum(SERVER)
    const speicher = hostSpeicherImSpeicher(raum)
    const h1 = host(raum, speicher)
    const actions1 = bediene(h1)
    await starte(h1)
    const g = await gekoppelt(raum, 'geraet-a')

    // Die Quittung geht verloren; das Gerät wiederholt nach quittungMs …
    ntfy.verschlucke = direktThemaVon(raum, 'geraet-a')
    const nr = g.t.sende(action())
    await bis(() => actions1.length === 1)
    const gesendet = ntfy.bodies(geraeteThemaVon(raum)).at(-1)!
    // … und der Host lädt neu: Raum und letzte Nummer kommen aus dem Speicher.
    h1.t.stop()
    const h2 = host(raum, speicher)
    const actions2 = bediene(h2)
    await starte(h2)
    await bis(() => g.t.unbestaetigt().length === 0)
    expect(actions2).toHaveLength(0)
    expect(g.empfang.filter((e) => e.art === 'direkt' && e.nachricht.art === 'quittung').at(-1)).toMatchObject({ nachricht: { auf: nr, ergebnis: 'doppelt' } })
    // Wer die alte Nachricht später noch einmal einstellt, bewirkt auch nichts.
    ntfy.wiederhole(geraeteThemaVon(raum), gesendet)
    await ruhe()
    expect(actions1.length + actions2.length).toBe(1)
    expect(speicher.lies()!.geraete['geraet-a'].letzteNr).toBe(nr)
  })

  it('S3: was während einer Trennung kam, holt der Host per since nach', async () => {
    const raum = neuerRaum(SERVER)
    const speicher = hostSpeicherImSpeicher(raum)
    const h1 = host(raum, speicher)
    bediene(h1)
    await starte(h1)
    const g = await gekoppelt(raum, 'geraet-a')
    h1.t.stop()

    // Der Host ist weg; ntfy nimmt die Action an.
    const nr = g.t.sende(action('par_2'))
    await bis(() => ntfy.bodies(geraeteThemaVon(raum)).length >= 1)
    const h2 = host(raum, speicher)
    const actions = bediene(h2)
    await starte(h2)
    await bis(() => actions.length === 1)
    expect(actions[0]).toMatchObject({ nr, gebunden: true })
    expect(ntfy.abos.at(-1)).toMatch(/\?since=m\d+$/)
    await bis(() => g.t.unbestaetigt().length === 0)
  })

  it('S3: ein Lese-Gerät holt nach dem Wiederverbinden nach, was in der Zwischenzeit kam', async () => {
    const h = host()
    await starte(h)
    h.t.verteile(OEFFENTLICH, { stand: 1 })
    const t = leser(h.raum)
    await t.t.start()
    await bis(() => t.sichten().length === 1)
    const abfragen = ntfy.abrufe.length

    // Die Verbindung bricht ab; in der Zeit ändert sich die Sicht.
    for (const s of [...ntfy.sockets]) if (s.themen.includes(h.raum.oeffentlich.a) && s.themen.length === 1) s.close()
    h.t.verteile(OEFFENTLICH, { stand: 2 })
    await bis(() => gleich(t.letzte(), { stand: 2 }))
    // Ohne neue Abfrage: Das Abo kam mit since zurück.
    expect(ntfy.abrufe.length).toBe(abfragen)
    expect(ntfy.abos.at(-1)).toMatch(/\?since=m\d+$/)
  })

  it('Entzug (K14): entzogen, keine Wirkung mehr, Öffentliches bleibt lesbar, andere Gruppen neu verschlüsselt', async () => {
    const h = host()
    h.t.legeGruppeAn('steg')
    const actions = bediene(h, [OEFFENTLICH, 'steg'])
    await starte(h)
    const a = await gekoppelt(h.raum, 'geraet-a')
    const b = await gekoppelt(h.raum, 'geraet-b')
    const ko = { ...h.speicher.lies()!.gruppen.ko }
    const alterSteg = fromBase64Url(h.speicher.lies()!.gruppen.steg.k)!

    expect(h.t.entziehe('geraet-a')).toBe(true)
    await bis(() => a.direkt('entzogen') && b.direkt('schluessel'))
    expect(h.speicher.lies()!.gruppen.ko).toEqual(ko)
    expect(h.speicher.lies()!.gruppen.steg.e).toBe(2)

    // Die Gruppe sendet mit dem neuen Schlüssel – den alten hat das entzogene Gerät, er öffnet nichts mehr.
    h.t.verteile('steg', { steg: 'neu' })
    await bis(() => gleich(b.letzte(), { steg: 'neu' }))
    const stegThema = themenDerGruppe(h.raum, 'steg')[0]
    const w = hostWires(stegThema).at(-1)!
    expect(await openGruppe(w, alterSteg)).toBeNull()

    // Es bewirkt nichts mehr – auch nicht mit seinem alten Schlüssel direkt an g –, liest aber Öffentliches weiter.
    a.t.sende(action())
    const g = geraeteThemaVon(h.speicher.lies()!)
    ntfy.publish(g, await sealVomGeraet({ id: 'geraet-a', nr: 99, nachricht: action() }, a.schluessel, fromBase64Url(h.raum.box.pk)!))
    h.t.verteile(OEFFENTLICH, { stand: 'öffentlich' })
    await bis(() => gleich(a.letzte(), { stand: 'öffentlich' }))
    await ruhe()
    expect(actions.filter((e) => e.id === 'geraet-a')).toHaveLength(0)
  })

  it('Gruppenrotation ohne Wirkung auf ko: Lese-Links lesen weiter', async () => {
    const h = host()
    h.t.legeGruppeAn('steg')
    bediene(h, [OEFFENTLICH, 'steg'])
    await starte(h)
    const t = leser(h.raum, 'a')
    await t.t.start()
    const g = await gekoppelt(h.raum, 'geraet-a')
    const ko = { ...h.speicher.lies()!.gruppen.ko }

    expect(h.t.rotiere(OEFFENTLICH)).toBe(false)
    expect(h.t.rotiere(ZUSCHAUER)).toBe(false)
    expect(h.t.rotiere('steg')).toBe(true)
    await bis(() => g.direkt('schluessel'))
    expect(h.speicher.lies()!.gruppen.ko).toEqual(ko)
    expect(g.speicher.lies()!.gruppen.steg.e).toBe(2)

    h.t.verteile(OEFFENTLICH, { stand: 'nach der Rotation' })
    h.t.verteile('steg', { steg: 'nach der Rotation' })
    await bis(() => gleich(t.letzte(), { stand: 'nach der Rotation' }))
    await bis(() => g.sichten().some((s) => gleich(s, { steg: 'nach der Rotation' })))
    // Die öffentliche Gruppe zählt für sich, unberührt von der anderen.
    expect(hostWires(h.raum.oeffentlich.a).map((w) => [w.g, w.e])).toEqual([['ko', 1]])
  })

  it('verwirft eine Anmeldung, die nicht an diesen Host verschlüsselt ist', async () => {
    const h = host()
    await starte(h)
    await bis(() => h.t.status.value === 'verbunden')
    const kp = koppelThema(h.raum.oeffentlich.a, CODE)
    const schluessel = nacl.box.keyPair()
    ntfy.publish(kp, await sealVomGeraet({ id: 'geraet-z', nr: 1, nachricht: { art: 'hallo', name: 'z', code: CODE } }, schluessel, nacl.box.keyPair().publicKey))
    await ruhe()
    expect(h.eingaenge).toHaveLength(0)
  })
})

describe('Lücken des Prototyps', () => {
  it('S5: Anhänge nur nach signierter Ankündigung, mit passender Prüfsumme, vom eigenen Server', async () => {
    const h = host()
    await starte(h)
    h.t.verteile(OEFFENTLICH, { stand: 1 })
    const t = leser(h.raum)
    await t.t.start()
    await bis(() => t.sichten().length === 1)
    const oA = h.raum.oeffentlich.a
    const sign = fromBase64Url(h.raum.sign.sk)!

    // 1. Ein großer Anhang ohne Ankündigung: wird nie geladen.
    ntfy.publish(oA, 'x'.repeat(10_000))
    // 2. Eine gefälschte Ankündigung (fremder Signaturschlüssel): wird nicht geladen.
    const kopf = { v: PROTOKOLL_FASSUNG, r: h.raum.r, g: OEFFENTLICH, e: 1, n: 50, a: 'v' as const, sv: SV, hz: Date.now() }
    const datei = `${SERVER}/file/m${ntfy.gespeichert.length}.txt`
    ntfy.publish(oA, sealAnkuendigung(kopf, oA, { u: datei, b: 10_000, h: textHash('x'.repeat(10_000)) }, nacl.sign.keyPair().secretKey))
    // 3. Echt signiert, aber auf einen fremden Server oder über der Grenze: wird nicht geladen.
    ntfy.publish(oA, sealAnkuendigung({ ...kopf, n: 51 }, oA, { u: 'https://boese.example/file/x.txt', b: 100, h: textHash('y') }, sign))
    ntfy.publish(oA, sealAnkuendigung({ ...kopf, n: 52 }, oA, { u: datei, b: 10_000_000, h: textHash('y') }, sign))
    await ruhe()
    expect(ntfy.abrufe.filter((u) => u.includes('/file/') && u !== hostWires(oA)[0]?.l?.u)).toEqual([])
    expect(ntfy.abrufe.some((u) => u.includes('boese'))).toBe(false)

    // 4. Eine echte, signierte große Nachricht des Hosts als Anhang – aber die (echt signierte) Ankündigung nennt eine
    //    andere Prüfsumme: wird geladen, aber verworfen. Gegenprobe: Mit der richtigen Prüfsumme gilt dieselbe Datei –
    //    es ist also allein die Prüfsumme, die verwirft (die frühere Fassung lud Unsinn, der schon am Format scheiterte).
    const gross = { stand: 'gross', fuell: toBase64Url(nacl.randomBytes(6000)) }
    const kopfGross = { ...kopf, n: 53 }
    const text = await sealGruppe({ voll: gross }, kopfGross, oA, fromBase64Url(h.raum.gruppen.ko.k)!, sign)
    expect(text.length).toBeGreaterThan(4096)
    ntfy.publish(oA, text)
    const echteDatei = `${SERVER}/file/${ntfy.gespeichert.at(-1)!.id}.txt`
    ntfy.publish(oA, sealAnkuendigung(kopfGross, oA, { u: echteDatei, b: text.length, h: textHash('anders') }, sign))
    await bis(() => ntfy.abrufe.includes(echteDatei))
    await ruhe()
    expect(t.sichten()).toEqual([{ stand: 1 }])
    ntfy.publish(oA, sealAnkuendigung(kopfGross, oA, { u: echteDatei, b: text.length, h: textHash(text) }, sign))
    await bis(() => t.sichten().length === 2)
    expect(t.letzte()).toEqual(gross)
  })

  it('K13/S5: der Host lädt aus g nie einen Anhang', async () => {
    const h = host()
    await starte(h)
    await bis(() => h.t.status.value === 'verbunden')
    ntfy.publish(geraeteThemaVon(h.raum), 'x'.repeat(20_000))
    ntfy.publish(koppelThema(h.raum.oeffentlich.a, CODE), 'y'.repeat(20_000))
    await ruhe()
    expect(ntfy.abrufe).toEqual([])
    expect(h.eingaenge).toEqual([])
  })

  it('S6: eine Flut von Anmeldungen kostet den Host nur wenige Antworten', async () => {
    const h = host()
    bediene(h)
    await starte(h)
    await bis(() => h.t.status.value === 'verbunden')
    const kp = koppelThema(h.raum.oeffentlich.a, CODE)
    const hostBox = fromBase64Url(h.raum.box.pk)!
    for (let i = 0; i < 60; i++) {
      const text = await sealVomGeraet({ id: `flut-${i}`, nr: 1, nachricht: { art: 'hallo', name: 'Flut', code: 'FALSCH' } }, nacl.box.keyPair(), hostBox)
      ntfy.publish(kp, text)
    }
    await ruhe(300)
    expect(h.eingaenge.length).toBeLessThanOrEqual(10)
    expect(hostWires(kp).length).toBeLessThanOrEqual(6)
  })

  it('S7: zwei Fenster mit demselben Raum vergeben keine Nummer doppelt', async () => {
    const raum = neuerRaum(SERVER)
    const speicher = hostSpeicherImSpeicher(raum)
    const eins = host(raum, speicher)
    const zwei = host(raum, speicher)
    await starte(eins, zwei)
    for (let i = 0; i < 4; i++) {
      eins.t.verteile(OEFFENTLICH, { fenster: 1, i })
      zwei.t.verteile(OEFFENTLICH, { fenster: 2, i })
      await bis(() => hostWires(raum.oeffentlich.a).length === 2 * (i + 1))
    }
    const nummern = hostWires(raum.oeffentlich.a).map((w) => w.n)
    expect(new Set(nummern).size).toBe(8)
    expect(speicher.lies()!.gruppen.ko.n).toBe(8)
  })

  it('K17: ein neues Gerät nimmt keine alte, erneut eingestellte Nachricht an', async () => {
    const h = host()
    await starte(h)
    h.t.verteile(OEFFENTLICH, { stand: 'alt' })
    await bis(() => hostWires(h.raum.oeffentlich.a).length === 1)
    const alt = ntfy.bodies(h.raum.oeffentlich.a)[0]
    h.t.stop()

    // Stunden später, der Host schweigt; jemand stellt die alte Nachricht erneut ein.
    ntfy.gespeichert = []
    ntfy.wiederhole(h.raum.oeffentlich.a, alt)
    const spaeter = Date.now() + 3 * 60 * 60_000
    const speicher = geraetSpeicherImSpeicher()
    const t = new GeraetTransport({
      server: SERVER,
      raum: h.raum.r,
      hostSign: fromBase64Url(h.raum.sign.pk)!,
      lesen: [h.raum.oeffentlich.a],
      oeffentlich: { k: h.raum.gruppen.ko.k, e: 1 },
      speicher,
      sichtFassung: SV,
      zeiten: SCHNELL,
      uhr: () => spaeter,
    })
    laufend.push(t)
    const e = empfaenger(t)
    await t.start()
    await bis(() => t.status.value === 'verbunden')
    await ruhe()
    expect(e.sichten()).toEqual([])
    // Auch nicht, wenn sie erst nach dem Einstieg erneut eingestellt wird und über das laufende Abo kommt
    // (Befund E5-Prüfung 16.11.2026: Die Frischeprüfung galt nur in der Abfrage).
    ntfy.wiederhole(h.raum.oeffentlich.a, alt)
    await ruhe()
    expect(e.sichten()).toEqual([])
  })

  it('K17: mehrere Vollstände im Fenster – es gilt der neueste, ein wiederholter älterer ändert nichts', async () => {
    const h = host()
    await starte(h)
    for (const [i, schritt] of [() => h.t.verteile(OEFFENTLICH, { stand: 'eins' }), () => h.t.verteile(OEFFENTLICH, { stand: 'zwei' }), () => h.t.vollstand(OEFFENTLICH)].entries()) {
      schritt()
      await bis(() => hostWires(h.raum.oeffentlich.a).length === i + 1)
    }
    const erster = ntfy.bodies(h.raum.oeffentlich.a)[0]
    ntfy.wiederhole(h.raum.oeffentlich.a, erster)

    const t = leser(h.raum)
    await t.t.start()
    await bis(() => t.sichten().length > 0)
    await ruhe()
    expect(t.sichten()).toEqual([{ stand: 'zwei' }])
    // Auch während des Betriebs: eine alte Nachricht noch einmal – nichts.
    ntfy.wiederhole(h.raum.oeffentlich.a, erster)
    await ruhe()
    expect(t.sichten()).toEqual([{ stand: 'zwei' }])
  })
})

describe('Befunde der E5-Prüfung (16.11.2026)', () => {
  it('Lese-Gerät lädt neu: gleich wieder die zuletzt gesehene Sicht, danach folgt es den Differenzen', async () => {
    const h = host()
    await starte(h)
    let { stand, bereich } = grosserBetrieb()
    h.t.verteile(OEFFENTLICH, alsJson(stand))
    const speicher = geraetSpeicherImSpeicher()
    const paket = lesePaket(h.raum, 'a')
    const t1 = lesegeraet(paket, speicher, SV, SCHNELL)
    laufend.push(t1)
    const e1 = empfaenger(t1)
    await t1.start()
    await bis(() => e1.sichten().length === 1)
    stand = naechster(stand, bereich, 2000)
    h.t.verteile(OEFFENTLICH, alsJson(stand))
    await bis(() => e1.sichten().length === 2)
    const arten = () => hostWires(h.raum.oeffentlich.a).filter((w) => !w.l).map((w) => w.a)
    expect(arten()).toEqual(['v', 'p'])
    t1.stop()

    // Neu geladen: derselbe Gerätespeicher (seen), aber die Grundlage der Differenzen lag nur im Arbeitsspeicher.
    const t2 = lesegeraet(paket, speicher, SV, SCHNELL)
    laufend.push(t2)
    const e2 = empfaenger(t2)
    await t2.start()
    await bis(() => e2.sichten().length === 1)
    expect(e2.letzte()).toEqual(alsJson(stand))
    // Und es folgt den nächsten Differenzen – ohne auf den stündlichen Vollstand zu warten.
    for (const zeit of [3000, 4000]) {
      stand = naechster(stand, bereich, zeit)
      h.t.verteile(OEFFENTLICH, alsJson(stand))
      await bis(() => gleich(e2.letzte(), alsJson(stand)))
    }
    expect(arten()).toEqual(['v', 'p', 'p', 'p'])
  })

  it('Fassung: nur ein Beleg des Hosts meldet eine andere Protokollfassung – eine unsignierte Zeile nicht', async () => {
    const h = host()
    await starte(h)
    h.t.verteile(ZUSCHAUER, { stand: 1 })
    const z = leser(h.raum, 'z')
    await z.t.start()
    await bis(() => z.sichten().length === 1)
    // Wer den Zuschauer-Link hat, kann auf oZ schreiben – aber nicht signieren.
    const oZ = h.raum.oeffentlich.z
    ntfy.publish(oZ, JSON.stringify({ v: 99, sv: 99 }))
    ntfy.publish(oZ, JSON.stringify({ v: 99, r: h.raum.r, sv: 99, hz: Date.now(), fs: toBase64Url(nacl.randomBytes(64)) }))
    await ruhe()
    expect(z.t.fehler.value).toBeNull()
    expect(z.t.fremdeFassung.value).toBeNull()
    // Auch ein neuer Zuschauer, der die Zeilen beim Einstieg abfragt, bleibt unberührt.
    const neu = leser(h.raum, 'z')
    await neu.t.start()
    await bis(() => neu.sichten().length === 1)
    expect(neu.t.fremdeFassung.value).toBeNull()

    // Ein Host einer späteren Fassung (echt signiert): gemeldet.
    const kopf = { v: PROTOKOLL_FASSUNG + 1, r: h.raum.r, g: ZUSCHAUER, e: 1, n: 99, a: 'v' as const, sv: SV + 1, hz: Date.now() }
    ntfy.publish(oZ, await sealGruppe({ voll: {} }, kopf, oZ, fromBase64Url(h.raum.gruppen.kz.k)!, fromBase64Url(h.raum.sign.sk)!))
    await bis(() => z.t.fehler.value?.code === 'fassung')
    expect(z.t.fremdeFassung.value).toEqual({ v: PROTOKOLL_FASSUNG + 1, sv: SV + 1 })
  })

  it('S6: eine Flut unbekannter Schlüssel auf g oder einem Koppel-Thema hungert keine Kopplung aus', async () => {
    const h = host()
    bediene(h)
    const anderesKp = koppelThema(h.raum.oeffentlich.a, 'CODE77')
    h.t.liesAuch(anderesKp)
    await starte(h)
    const hostBox = fromBase64Url(h.raum.box.pk)!
    // g kennt jedes gekoppelte und jedes entzogene Gerät; zehn Nachrichten je Minute reichten früher.
    for (const thema of [geraeteThemaVon(h.raum), anderesKp]) {
      for (let i = 0; i < 20; i++) {
        ntfy.publish(thema, await sealVomGeraet({ id: `stoer-${i}`, nr: 1, nachricht: { art: 'hallo', name: 'x', code: 'x' } }, nacl.box.keyPair(), hostBox))
      }
    }
    await ruhe()
    // Auf g öffnet der Host Unbekanntes gar nicht, auf dem anderen Koppel-Thema höchstens dessen Eimer voll.
    expect(h.eingaenge.length).toBeLessThanOrEqual(10)
    expect(h.eingaenge.every((e) => e.thema === anderesKp)).toBe(true)
    const echt = await gekoppelt(h.raum, 'geraet-neu')
    expect(echt.direkt('willkommen')).toBe(true)
  })

  it('Wiedereinspielen der letzten Nachricht eines Geräts: zweite Quittungen mit wachsendem Abstand, nicht je Kopie', async () => {
    const h = host()
    bediene(h)
    await starte(h)
    const a = await gekoppelt(h.raum, 'geraet-a')
    a.t.sende(action())
    await bis(() => a.t.unbestaetigt().length === 0)
    a.t.stop()
    const g = geraeteThemaVon(h.speicher.lies()!)
    const letzte = ntfy.bodies(g).at(-1)!
    const d = direktThemaVon(h.raum, 'geraet-a')
    const vorher = ntfy.bodies(d).length
    // 2 s lang alle 50 ms; quittungMs 150 → Abstände 75, 150, 300, 600, 1200 ms (früher: alle 75 ms eine).
    for (let i = 0; i < 40; i++) {
      ntfy.wiederhole(g, letzte)
      await ruhe(50)
    }
    await ruhe(100)
    const antworten = ntfy.bodies(d).length - vorher
    expect(antworten).toBeGreaterThanOrEqual(1)
    expect(antworten).toBeLessThanOrEqual(6)
  })

  it('Entzug, und das Führungsfenster schließt sofort: der nächste Start schickt entzogen und die Schlüssel nach', async () => {
    const raum = neuerRaum(SERVER)
    const speicher = hostSpeicherImSpeicher(raum)
    const h1 = host(raum, speicher)
    h1.t.legeGruppeAn('steg')
    bediene(h1, [OEFFENTLICH, 'steg'])
    await starte(h1)
    const a = await gekoppelt(raum, 'geraet-a')
    const b = await gekoppelt(raum, 'geraet-b')
    h1.t.entziehe('geraet-a')
    h1.t.stop()
    await ruhe()
    expect(b.direkt('schluessel')).toBe(false)
    expect(speicher.lies()!.ausstehend.map((x) => [x.id, x.art])).toEqual([['geraet-a', 'entzogen'], ['geraet-b', 'schluessel']])

    const h2 = host(raum, speicher)
    await starte(h2)
    await bis(() => b.direkt('schluessel') && a.direkt('entzogen'))
    expect(b.speicher.lies()!.gruppen.steg.e).toBe(2)
    h2.t.verteile('steg', { steg: 'nach dem Entzug' })
    await bis(() => b.sichten().some((s) => gleich(s, { steg: 'nach dem Entzug' })))
    expect(speicher.lies()!.ausstehend).toEqual([])
  })

  it('ein Schlüsselwechsel, während das Gerät länger als das Einstiegsfenster weg war, kommt nach dem Neuladen an', async () => {
    const raum = neuerRaum(SERVER)
    const h = host(raum)
    h.t.legeGruppeAn('steg')
    bediene(h, [OEFFENTLICH, 'steg'])
    await starte(h)
    const speicher = geraetSpeicherImSpeicher()
    const schluessel = neueGeraeteSchluessel()
    const neu = () => {
      const t = new GeraetTransport({
        server: SERVER, raum: raum.r, hostSign: fromBase64Url(raum.sign.pk)!, hostBox: fromBase64Url(raum.box.pk)!,
        lesen: [raum.oeffentlich.a], oeffentlich: { k: raum.gruppen.ko.k, e: 1 }, koppeln: koppelThema(raum.oeffentlich.a, CODE),
        ich: { id: 'geraet-a', schluessel }, speicher, sichtFassung: SV, zeiten: SCHNELL,
      })
      laufend.push(t)
      return { t, ...empfaenger(t) }
    }
    const g1 = neu()
    await g1.t.start()
    g1.t.sende({ art: 'hallo', name: 'geraet-a', code: CODE })
    await bis(() => g1.direkt('willkommen'))
    await ruhe()
    g1.t.stop()

    // Der Schlüssel geht an das d-Thema, während das Gerät weg ist; zwei Stunden später lädt es neu (ntfy hält 12 h).
    h.t.rotiere('steg')
    await bis(() => speicher.lies() !== null && h.speicher.lies()!.ausstehend.length === 0)
    ntfy.versatzMs = 2 * 60 * 60_000
    const g2 = neu()
    await g2.t.start()
    await bis(() => g2.t.status.value === 'verbunden')
    expect(speicher.lies()!.gruppen.steg.e).toBe(2)
    h.t.verteile('steg', { steg: 'neu' })
    await bis(() => g2.sichten().some((s) => gleich(s, { steg: 'neu' })))
  })

  it('Leitung: nie zwei Abos – auch nicht, wenn sich die Themen während des Einstiegs ändern', async () => {
    // Host: liesAuch gleich nach start(), während des Einstiegs.
    const raum = neuerRaum(SERVER)
    const h = new HostTransport({ server: SERVER, speicher: hostSpeicherImSpeicher(raum), sichtFassung: SV, zeiten: SCHNELL })
    laufend.push(h)
    const kp = koppelThema(raum.oeffentlich.a, CODE)
    const gestartet = h.start()
    h.liesAuch(kp)
    await gestartet
    await bis(() => h.status.value === 'verbunden')
    await ruhe(30)
    expect([...ntfy.sockets].map((s) => s.themen)).toEqual([[geraeteThemaVon(raum), kp]])
    // Gar nicht erst ein zweites geöffnet (und gleich wieder geschlossen).
    expect(ntfy.abos).toHaveLength(1)
    h.stop()
    await ruhe(20)
    expect(ntfy.sockets.size).toBe(0)

    // Gerät: Das willkommen kommt erst mit der Einstiegs-Abfrage (neu geladen, bevor es ankam) und ändert die Themen.
    const h2 = host(raum)
    bediene(h2)
    await starte(h2)
    const speicher = geraetSpeicherImSpeicher()
    const schluessel = neueGeraeteSchluessel()
    const neu = () => {
      const t = new GeraetTransport({
        server: SERVER, raum: raum.r, hostSign: fromBase64Url(raum.sign.pk)!, hostBox: fromBase64Url(raum.box.pk)!,
        lesen: [raum.oeffentlich.a], oeffentlich: { k: raum.gruppen.ko.k, e: 1 }, koppeln: kp,
        ich: { id: 'geraet-a', schluessel }, speicher, sichtFassung: SV, zeiten: SCHNELL,
      })
      laufend.push(t)
      return { t, ...empfaenger(t) }
    }
    const g1 = neu()
    await g1.t.start()
    await bis(() => g1.t.status.value === 'verbunden')
    g1.t.sende({ art: 'hallo', name: 'geraet-a', code: CODE })
    await bis(() => hostWires(kp).length === 1)
    g1.t.stop()
    const g2 = neu()
    await g2.t.start()
    await bis(() => g2.direkt('willkommen') && g2.t.status.value === 'verbunden')
    await ruhe(30)
    const desGeraets = () => [...ntfy.sockets].filter((s) => s.themen.includes(raum.oeffentlich.a))
    expect(desGeraets()).toHaveLength(1)
    g2.t.stop()
    await ruhe(20)
    expect(desGeraets()).toHaveLength(0)
  })

  it('stop und start derselben Instanz (Führung verloren und zurück): beginnt mit einem Vollstand', async () => {
    const raum = neuerRaum(SERVER)
    const speicher = hostSpeicherImSpeicher(raum)
    const a = host(raum, speicher)
    const b = host(raum, speicher)
    await starte(a)
    let { stand, bereich } = grosserBetrieb()
    a.t.verteile(OEFFENTLICH, alsJson(stand))
    const t = leser(raum)
    await t.t.start()
    await bis(() => t.sichten().length === 1)

    a.t.stop()
    await starte(b)
    stand = naechster(stand, bereich, 2000)
    b.t.verteile(OEFFENTLICH, alsJson(stand))
    await bis(() => gleich(t.letzte(), alsJson(stand)))
    b.t.stop()

    await starte(a)
    stand = naechster(stand, bereich, 3000)
    a.t.verteile(OEFFENTLICH, alsJson(stand))
    await bis(() => gleich(t.letzte(), alsJson(stand)))
    expect(hostWires(raum.oeffentlich.a).filter((w) => !w.l).at(-1)!.a).toBe('v')
  })

  it('das willkommen geht verloren (Fenster schließt vor dem Senden): das Gerät meldet sich wieder und wird begrüßt', async () => {
    const raum = neuerRaum(SERVER)
    const speicher = hostSpeicherImSpeicher(raum)
    const h1 = host(raum, speicher)
    h1.t.beiEingang((e) => {
      if (e.nachricht.art !== 'hallo') return
      // Gebunden ist es schon (letzteNr = Nummer der Anmeldung), das willkommen kommt nicht mehr hinaus.
      h1.t.begruesse(e, { gruppen: [OEFFENTLICH], aufgaben: [] })
      h1.t.stop()
    })
    await starte(h1)
    const g = geraet(raum, 'geraet-a')
    await g.t.start()
    g.t.sende({ art: 'hallo', name: 'geraet-a', code: CODE })
    await bis(() => speicher.lies()!.geraete['geraet-a'] !== undefined)
    await ruhe()
    expect(g.direkt('willkommen')).toBe(false)

    // Das Gerät wiederholt seine Anmeldung (dieselbe Nummer, Koppel-Thema): Der Host reicht sie als gebunden weiter.
    const h2 = host(raum, speicher)
    bediene(h2)
    await starte(h2)
    await bis(() => g.direkt('willkommen'))
    expect(h2.eingaenge[0]).toMatchObject({ gebunden: true, id: 'geraet-a', nr: speicher.lies()!.geraete['geraet-a'].letzteNr, nachricht: { art: 'hallo' } })
    const actions = bediene(h2)
    g.t.sende(action())
    await bis(() => actions.length === 1)
  })

  it('gleicher Schlüssel, Stand verloren: Nummern beginnen nicht wieder bei 1 – altes willkommen gilt nicht, die Action wirkt', async () => {
    const h = host()
    const actions = bediene(h)
    await starte(h)
    const schluessel = neueGeraeteSchluessel()
    const a = geraet(h.raum, 'geraet-a', schluessel)
    await a.t.start()
    a.t.sende({ art: 'hallo', name: 'geraet-a', code: CODE })
    await bis(() => a.direkt('willkommen'))
    a.t.sende(action())
    await bis(() => a.t.unbestaetigt().length === 0)
    a.t.stop()
    const kp = koppelThema(h.raum.oeffentlich.a, CODE)
    const willkommenVorher = hostWires(kp).length

    // Derselbe Schlüssel mit leerem Stand (an ablage.ts vorbei, oder ein kaputter Eintrag); das alte willkommen liegt
    // noch auf dem Koppel-Thema und kommt mit der Einstiegs-Abfrage.
    const neu = geraet(h.raum, 'geraet-a', schluessel)
    await neu.t.start()
    await bis(() => neu.t.status.value === 'verbunden')
    neu.t.sende({ art: 'hallo', name: 'geraet-a', code: CODE })
    const nr = neu.t.sende(action('par_2'))
    await bis(() => neu.t.unbestaetigt().length === 0)
    // Begrüßt hat der Host neu (nicht das alte willkommen), und die Action wirkte – nicht „doppelt“.
    // ≥ statt genau +1: Unter Last wiederholt das Gerät sein hallo, dann begrüßt der Host ein zweites Mal (harmlos).
    expect(hostWires(kp).length).toBeGreaterThan(willkommenVorher)
    expect(neu.empfang.filter((e) => e.art === 'direkt').map((e) => e.art === 'direkt' && e.nachricht.art)).toEqual(['willkommen', 'quittung'])
    expect(actions.map((e) => e.nr)).toHaveLength(2)
    expect(actions.at(-1)!.nr).toBe(nr)
  })

  it('erkennt ein gekoppeltes Gerät beim Wiederkommen am Schlüssel (P-7; aus dem Prototyp)', async () => {
    const h = host()
    bediene(h)
    await starte(h)
    const g = await gekoppelt(h.raum, 'geraet-a')
    const nr = g.t.sende({ art: 'hallo', name: 'geraet-a', code: '' })
    // Nach der Nummer suchen, nicht nach der Stelle: Unter Last (volle Suite im Commit-Hook) kann vorher noch eine
    // Wiederholung der ersten Anmeldung eingehen.
    await bis(() => h.eingaenge.some((e) => e.nr === nr))
    expect(h.eingaenge.find((e) => e.nr === nr)).toMatchObject({ gebunden: true, id: 'geraet-a', nr, thema: geraeteThemaVon(h.raum) })
    await bis(() => g.empfang.filter((e) => e.art === 'direkt' && e.nachricht.art === 'willkommen').length === 2)
  })

  it('schickt „neu laden“ vor einer wartenden Sicht; der letzte Stand folgt mit höherer Nummer (aus dem Prototyp)', async () => {
    const h = host(undefined, undefined, { zeiten: { ...SCHNELL, abstandMs: 1000 } })
    await starte(h)
    h.t.verteile(OEFFENTLICH, { stand: 1 })
    await bis(() => hostWires(h.raum.oeffentlich.a).length === 1)
    const t = leser(h.raum)
    await t.t.start()
    await bis(() => t.sichten().length === 1)
    // Die zweite Sicht wartet noch abstandMs; die Meldung nicht.
    h.t.verteile(OEFFENTLICH, { stand: 2 })
    h.t.melde(OEFFENTLICH, { art: 'neu-laden' })
    await bis(() => t.empfang.some((e) => e.art === 'meldung'), 900)
    expect(t.sichten()).toEqual([{ stand: 1 }])
    // Danach der letzte Stand – mit höherer Nummer als die Meldung, sonst verwürfe das Gerät ihn als schon gesehen.
    await bis(() => gleich(t.letzte(), { stand: 2 }), 3000)
    const w = hostWires(h.raum.oeffentlich.a)
    expect(w.map((x) => x.a)).toEqual(['v', 'm', 'v'])
    expect(w[2].n).toBeGreaterThan(w[1].n)
  })
})

describe('meldet, was fehlt, statt still nichts zu tun', () => {
  it('Host ohne Raum, mit Raum eines anderen Servers, ohne gültigen Server', async () => {
    const ohne = new HostTransport({ server: SERVER, speicher: hostSpeicherImSpeicher(), sichtFassung: SV })
    await ohne.start()
    expect(ohne.status.value).toBe('fehler')
    expect(ohne.fehler.value).toEqual({ code: 'raum-fehlt' })

    const anders = new HostTransport({ server: 'https://anderer.test', speicher: hostSpeicherImSpeicher(neuerRaum(SERVER)), sichtFassung: SV })
    await anders.start()
    expect(anders.fehler.value).toEqual({ code: 'raum-anderer-server' })

    const kaputt = new HostTransport({ server: 'ftp://x', speicher: hostSpeicherImSpeicher(neuerRaum(SERVER)), sichtFassung: SV })
    await kaputt.start()
    expect(kaputt.fehler.value).toEqual({ code: 'server-ungueltig' })
  })

  it('Gerät ohne Thema aus dem Link', async () => {
    const raum = neuerRaum(SERVER)
    const t = new GeraetTransport({ server: SERVER, raum: raum.r, hostSign: fromBase64Url(raum.sign.pk)!, lesen: [], speicher: geraetSpeicherImSpeicher(), sichtFassung: SV })
    await t.start()
    expect(t.fehler.value).toEqual({ code: 'link-ungueltig' })
  })
})

describe('W1: stille Quittung und gesammelte Bestätigung', () => {
  it('still: letzteNr steigt, keine direkte Quittung; bestaetige(bis) nimmt alles ≤ bis aus der Schlange', async () => {
    const h = host()
    const eingaenge: Eingang[] = []
    h.t.beiEingang((e) => {
      if (e.nachricht.art === 'hallo') return void h.t.begruesse(e, { gruppen: [OEFFENTLICH], aufgaben: [] })
      eingaenge.push(e)
      h.t.quittiere(e, 'angewandt', undefined, { still: true })
    })
    await starte(h)
    // Wiederholen erst spät: Unter Last (volle Suite) käme sonst vor dem Prüfen ein `doppelt` direkt zurück.
    const g = await gekoppelt(h.raum, 'geraet-a', CODE, { ...SCHNELL, quittungMs: 5000 })
    const d = direktThemaVon(h.speicher.lies()!, 'geraet-a')
    const direktVorher = ntfy.bodies(d).length
    const nr1 = g.t.sende(action())
    await bis(() => eingaenge.length === 1)
    await ruhe()
    // Bearbeitet und gemerkt, aber keine Nachricht an das Gerät – es wartet weiter.
    expect(h.speicher.lies()!.geraete['geraet-a'].letzteNr).toBe(nr1)
    expect(ntfy.bodies(d).length).toBe(direktVorher)
    expect(g.t.unbestaetigt()).toEqual([nr1])
    const nr2 = g.t.sende(action())
    // Gesammelte Quittung (aus der Sicht der Liste): nimmt nr1, nr2 bleibt und geht jetzt hinaus.
    expect(g.t.bestaetige(nr1)).toEqual([nr1])
    expect(g.t.bestaetige(nr1)).toEqual([])
    expect(g.t.unbestaetigt()).toEqual([nr2])
    await bis(() => eingaenge.length === 2)
    expect(eingaenge[1].nr).toBe(nr2)
    expect(g.t.bestaetige(Number.MAX_SAFE_INTEGER)).toEqual([nr2])
    // Auch abgelegt: Nach dem Neuladen wartet nichts mehr.
    expect(g.speicher.lies()!.schlange).toEqual([])
  })

  it('ohne bestaetige wiederholt das Gerät – die Wiederholung bekommt weiter direkt `doppelt` und wirkt nicht noch einmal', async () => {
    const h = host()
    const eingaenge: Eingang[] = []
    h.t.beiEingang((e) => {
      if (e.nachricht.art === 'hallo') return void h.t.begruesse(e, { gruppen: [OEFFENTLICH], aufgaben: [] })
      eingaenge.push(e)
      h.t.quittiere(e, 'angewandt', undefined, { still: true })
    })
    await starte(h)
    const g = await gekoppelt(h.raum, 'geraet-a')
    const nr = g.t.sende(action())
    await bis(() => g.t.unbestaetigt().length === 0, 4000)
    expect(eingaenge).toHaveLength(1)
    expect(g.empfang.filter((e) => e.art === 'direkt' && e.nachricht.art === 'quittung').at(-1)).toMatchObject({ nachricht: { auf: nr, ergebnis: 'doppelt' } })
  })

  it('Protokoll 2: Lebenszeichen und gesehen werden gelesen, Unsinn nicht; Ablehnungen und Hinweise als Codes', async () => {
    const { liesGeraeteNachricht, liesDirektNachricht, HINWEISE } = await import('../protokoll')
    const { WKR_HINWEISE } = await import('../../../wkr/sicht')
    expect([...HINWEISE]).toEqual([...WKR_HINWEISE])
    expect(liesGeraeteNachricht({ art: 'lebenszeichen', wartend: 2, akku: 40, name: 'x' })).toEqual({ art: 'lebenszeichen', wartend: 2, akku: 40 })
    expect(liesGeraeteNachricht({ art: 'lebenszeichen', wartend: 0 })).toEqual({ art: 'lebenszeichen', wartend: 0 })
    expect(liesGeraeteNachricht({ art: 'lebenszeichen', wartend: -1 })).toBeNull()
    expect(liesGeraeteNachricht({ art: 'lebenszeichen', wartend: 1, akku: 101 })).toBeNull()
    expect(liesGeraeteNachricht({ art: 'gesehen', hinweis: 3 })).toEqual({ art: 'gesehen', hinweis: 3 })
    expect(liesGeraeteNachricht({ art: 'gesehen', hinweis: 'drei' })).toBeNull()
    for (const grund of ['wert-ungueltig', 'start-unbekannt', 'feld-fremd', 'x-nicht-erlaubt', 'teil-fremd', 'seite-anders', 'offen'])
      expect(liesDirektNachricht({ art: 'quittung', auf: 1, ergebnis: 'abgelehnt', grund })).toMatchObject({ grund })
    expect(liesDirektNachricht({ art: 'quittung', auf: 1, ergebnis: 'abgelehnt', grund: 'Freitext' })).toBeNull()
  })
})
