import { effectScope, inject, ref, shallowRef, watch, type EffectScope, type InjectionKey, type Ref, type ShallowRef } from 'vue'
import nacl from 'tweetnacl'
import type { AppState } from '../types'
import type { Action } from '../state/reducer'
import { t as text } from '../i18n'
import { BETRIEB_ANNAHMEN } from '../betrieb/annahmen'
import { SICHT_FASSUNG, sichtOeffentlich, sichtZuschauer } from '../betrieb/sicht'
import { ABLAGE, beendeRaum, hostAblage, legeRaumAn, type Ablage } from './ablage'
import { oeffneFensterbus, type Anwendung, type Befehl, type BusUmgebung, type Fensterbus, type GeraeteBefehl, type VerbindungsMeldung } from './fensterbus'
import { waehleFuehrung, type Fuehrung, type FuehrungsUmgebung } from './fuehrung'
import { normalisiereServer, NTFY_VORGABE } from './themen'
import { koppelPaketAus, packeKoppelPaket, packeLesePaket } from './paket'
import { fingerabdruck, lesePaket, type HostRaum } from './transport/ntfy/raum'
import { HostTransport, type Eingang } from './transport/ntfy/transport'
import { toBase64Url } from './transport/ntfy/codec'
import { erlaubteAction, type Aufgabe } from './aufgaben'
import { entscheideAnmeldung } from './koppelEntscheid'
import { dreheQr, gibCode, koppelThemen, markiereBenutzt, oeffneQr, qrFaellig, raeumeAuf, schliesseKoppeln } from './koppeln'
import {
  aufgabenVon,
  bekannteGeraete,
  benenne,
  beruehre,
  entzogeneListe,
  geraeteListe,
  koppelStandVon,
  setzeAufgaben,
  setzeKoppelStand,
  vermerkeEntzug,
  type EntzogenEintrag,
  type RegisterEintrag,
} from './register'
import type { NtfyZeiten } from './transport/ntfy/leitung'
import type { Json } from './transport/ntfy/patch'
import { OEFFENTLICH, ZUSCHAUER } from './transport/protokoll'

/**
 * Der Bedienrechner als Host des Gerätebetriebs (Etappe E6, Plan vom 16.11.2026 §1/§3/§5): Anzeigetafel und
 * Zuschauerliste auf fremden Geräten über Lese-Links, ohne Kopplung (F3).
 *
 * **Nichts verbindet sich von selbst.** Erst wenn jemand den Raum bewusst öffnet ({@link GeraeteHost.oeffne}, Reiter
 * Betrieb → Geräte), gibt es einen Raum für diese Veranstaltung (geraete/ablage.ts, an `AppState.kennung` gebunden), und
 * erst dann fragt ein Fenster die Führung an und spricht mit dem ntfy-Server. Ohne Raum öffnet dieses Modul weder
 * Fensterbus noch Schloss noch Verbindung (Test host.test.ts, src/main.geraete.test.ts). Ein geöffneter Raum bleibt
 * über das Neuladen hinweg offen – bis „Raum beenden“ oder eine andere Veranstaltung (andere Kennung).
 *
 * Mit Raum, in jedem Fenster mit vollem Store (nie AnzeigeApp/ZuschauerApp):
 * - Fensterbus öffnen, Führung anfragen (fuehrung.ts). Nur das **Führungsfenster** legt den HostTransport an
 *   (Server = Einstellung `geraeteServer` oder NTFY_VORGABE), schreibt den Raum und verteilt bei jeder Änderung des
 *   Stands – gesammelt, nach Inhalt verglichen – zwei Sichten: an `ko` (Thema oA, Anzeigetafel) die öffentliche
 *   Sicht ohne Logos (BETRIEB_ANNAHMEN.logosNurLokal), an `kz` (Thema oZ, Zuschauer) die Zuschauersicht. Seinen
 *   Verbindungsstand meldet es über den Fensterbus an alle Fenster.
 * - Die übrigen Fenster lesen den Raum nur (Links, Fingerabdruck) und schicken Befehle („Zuschauer-Link erneuern“,
 *   „Raum beenden“) über den Fensterbus an das Führungsfenster – zwei Schreiber des Raums vergäben Nummern doppelt.
 *
 * Was hinausgeht, entscheidet allein betrieb/sicht.ts (der Datenschutz-Zuschnitt). Nie auf der Leitung: der
 * AppState, Geburtsdatum, Gewicht, Geschlecht, Werte, Abmeldungen, Logos, Geräteliste, Geheimnis (Test geraet.test.ts).
 */

/** Was die Oberfläche über den Raum zeigt – gelesen, nie geschrieben. Die Links sind gepackt (geraete/paket.ts). */
export interface RaumInfo {
  /** Server, mit dem der Raum angelegt wurde. Weicht die Einstellung ab, meldet der Host `raum-anderer-server`. */
  server: string
  /** Paket des Anzeigetafel-Links (`#/sehen/<paket>`). */
  anzeige: string
  /** Paket des Zuschauer-Links – erneuerbar, ohne die Anzeigetafel zu stören. */
  zuschauer: string
  /** Kurz-Fingerabdruck des Hosts (Signaturschlüssel): steht auch auf dem Gerät – gleich heißt echt (Plan §8). */
  fingerabdruck: string
  /**
   * E7: Paket des Koppel-Links (`#/koppeln/<paket>`, geraete/paket.ts) – für den Geräte-Code: Der Link wird verteilt,
   * der Code kommt über Funk. Öffentlich wie der Anzeigetafel-Link, dazu der Box-Schlüssel des Hosts.
   */
  koppelLink: string
  /** E7: Koppeln, das gerade läuft (Geräte-Code, QR-Sitzung mit dem Paket des aktuellen QR-Codes). */
  koppeln: KoppelInfo
  /** E7: gekoppelte Geräte (Register, nach Name) und die zuletzt entzogenen. */
  geraete: RegisterEintrag[]
  entzogen: EntzogenEintrag[]
}

/** Was die Oberfläche über das laufende Koppeln zeigt (Zeiten: Uhr des Bedienrechners, ms). */
export interface KoppelInfo {
  code: { wert: string; bis: number; benutzt: number | null; aufgaben: Aufgabe[] } | null
  /** `paket`: Inhalt des QR-Codes (`#/koppeln/<paket>` mit Token), wechselt alle 30 s. */
  qr: { paket: string; tokenBis: number; endet: number; aufgaben: Aufgabe[] } | null
}

/** Ausgang von „Raum beenden“: Ging die signierte Meldung „Raum beendet“ hinaus, löschen die Geräte ihre Sicht sofort. */
export type RaumEnde = 'gemeldet' | 'ohne-meldung'

export interface GeraeteHost {
  /** Der Raum dieser Veranstaltung; `null` = Gerätebetrieb aus (keine Verbindung). */
  readonly raum: Readonly<ShallowRef<RaumInfo | null>>
  /** Führt dieses Fenster (hält es die Verbindung)? */
  readonly fuehrt: Readonly<Ref<boolean>>
  /** Verbindungsstand, wie das Führungsfenster ihn meldet; `null` ohne Raum oder solange keines führt. */
  readonly verbindung: Readonly<Ref<VerbindungsMeldung | null>>
  /**
   * Gerätebetrieb einschalten: Raum für diese Veranstaltung anlegen (gibt es schon einen, bleibt er). Wirft
   * `Error('server-ungueltig')` bzw. `Error('ablage-voll')` – Codes für `geraete.fehler.<code>`.
   */
  oeffne(): RaumInfo
  /** „Zuschauer-Link erneuern“: neues Thema oZ; der Anzeigetafel-Link bleibt. Über das Führungsfenster. */
  erneuereZuschauer(): void
  /** „Raum beenden“: signiert „Raum beendet“ an beide Lese-Links, dann Raum und Schlüssel löschen. */
  beende(): Promise<RaumEnde>
  // --- E7: Koppeln und Geräteliste – alles über das Führungsfenster (Befehl über den Fensterbus) ---
  /** Einen Geräte-Code ausgeben (6 Zeichen, 5 min, ein Gerät) mit diesen Rechten; ein laufender gilt nicht mehr. */
  gibCode(aufgaben: Aufgabe[]): void
  /** Eine QR-Sitzung öffnen (Token wechselt alle 30 s, höchstens 10 min) mit diesen Rechten. */
  oeffneQr(aufgaben: Aufgabe[]): void
  /** Koppeln beenden: Code, QR-Sitzung oder beides. */
  beendeKoppeln(was?: 'code' | 'qr' | 'alle'): void
  /** Rechte eines Geräts ändern – wirkt sofort (`aufgaben` an das Gerät, `darf` am Host). */
  setzeAufgaben(id: string, aufgaben: Aufgabe[]): void
  benenne(id: string, name: string): void
  /** Entzug: aus dem Register, `entzogen` an das Gerät; es liest Öffentliches weiter (K14). */
  entziehe(id: string): void
  /** Alles abbauen (Tests; die Anwendung braucht es nicht). */
  stop(): void
}

export interface HostUmgebung {
  /** Vorgabe localStorage (Raum, geraete/ablage.ts). */
  ablage?: Ablage | null
  /** Bekommt die storage-Ereignisse (Raum in einem anderen Fenster geöffnet/beendet); Vorgabe `window`. */
  fenster?: Pick<EventTarget, 'addEventListener' | 'removeEventListener'> | null
  fuehrung?: FuehrungsUmgebung
  bus?: BusUmgebung
  zeiten?: Partial<NtfyZeiten>
  /** Uhr für die Sendezeit `hz`, Koppel-Zeiten und „zuletzt gehört“ (Tests). */
  uhr?: () => number
  /** E7: wie oft das Führungsfenster das Koppeln pflegt (QR-Token drehen, Abgelaufenes räumen, Themen). */
  koppelTaktMs?: number
  /** So lange werden Änderungen des Stands gesammelt, bevor die Sicht neu gerechnet wird. */
  sammelnMs?: number
  /** „Raum beenden“: so lange höchstens warten, bis die Meldung hinaus ist. */
  endeWartenMs?: number
}

/** Änderungen sammeln: Tippen in der Erfassung rechnet die Sicht nicht bei jedem Zeichen neu. */
const SAMMELN_MS = 150
/** Ohne Netz soll „Raum beenden“ nicht hängen: Dann bleibt die Sicht auf den Geräten bis zu ihrem Ablauf (36 h). */
const ENDE_WARTEN_MS = 8000

export const geraeteHostKey: InjectionKey<GeraeteHost> = Symbol('geraeteHost')

/** Der Host dieses Fensters (main.ts stellt ihn bereit); `null` in Tests ohne ihn und in Fenstern ohne vollen Store. */
export function useGeraeteHost(): GeraeteHost | null {
  return inject(geraeteHostKey, null)
}

/**
 * Was der Host vom Store braucht: den Stand (liest, löst Verteilen aus) und – ab E7 – `dispatch`, mit dem das
 * Schreibfenster geprüfte Geräte-Actions anwendet. Ohne `dispatch` (Tests von E6) lehnt der Host Actions ab.
 */
export interface HostStore {
  state: Readonly<Ref<AppState>>
  dispatch?: (action: Action) => void
}

/** E7: Takt des Führungsfensters für das Koppeln – QR-Token so früh drehen, dass keine Lücke entsteht. */
const KOPPEL_TAKT_MS = 1000

interface Aktiv {
  kennung: string
  bus: Fensterbus
  fuehrung: Fuehrung | null
  scope: EffectScope
  /** Nur im Führungsfenster. */
  transport: HostTransport | null
  leitung: EffectScope | null
  timer: ReturnType<typeof setTimeout> | null
  /** Zuletzt verteilte öffentliche Sicht als Text – Gleiches wird gar nicht erst gereicht. */
  letzte: string
  /** „Raum beenden“ läuft: nichts mehr verteilen (eine Sicht nach „Ende“ gälte für neue Geräte wieder). */
  endet: boolean
  wegBefehl: () => void
  /** E7: Anwenden weitergereichter Geräte-Actions und „bedient“ abmelden. */
  wegAnwenden: () => void
  /** E7, nur im Führungsfenster: Takt des Koppelns und die Koppel-Themen, die gerade mitgelesen werden. */
  koppelTakt: ReturnType<typeof setInterval> | null
  koppelThemen: Set<string>
}

function vorgabeAblage(): Ablage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage
  } catch {
    return null
  }
}

function koppelInfo(raum: HostRaum): KoppelInfo {
  const stand = koppelStandVon(raum)
  const c = stand.code
  const q = stand.qr
  return {
    code: c ? { wert: c.wert, bis: c.bis, benutzt: c.benutzt, aufgaben: c.aufgaben } : null,
    qr: q ? { paket: packeKoppelPaket(koppelPaketAus(raum, { token: q.token, thema: q.thema })), tokenBis: q.tokenBis, endet: q.endet, aufgaben: q.aufgaben } : null,
  }
}

function raumInfo(raum: HostRaum): RaumInfo | null {
  try {
    return {
      server: raum.server,
      anzeige: packeLesePaket(lesePaket(raum, 'a')),
      zuschauer: packeLesePaket(lesePaket(raum, 'z')),
      fingerabdruck: fingerabdruck(raum.sign.pk),
      koppelLink: packeKoppelPaket(koppelPaketAus(raum)),
      koppeln: koppelInfo(raum),
      geraete: geraeteListe(raum),
      entzogen: entzogeneListe(raum),
    }
  } catch {
    return null
  }
}

/** Eine neue Geräte-ID (S1: wenn die genannte schon einem anderen Schlüssel gehört). Zufall wie ablage.ts ichOderNeu. */
const neueGeraeteId = () => toBase64Url(nacl.randomBytes(12))

/** Server laut Einstellung ('' = Vorgabe des Programms); `null`, wenn die Einstellung keine Adresse ist. */
export function hostServer(stand: Pick<AppState, 'geraeteServer'>): string | null {
  return normalisiereServer(stand.geraeteServer || NTFY_VORGABE)
}

/**
 * Den Gerätebetrieb dieses Fensters aufsetzen (main.ts, nur für das Bedienfenster). Ohne geöffneten Raum geschieht
 * nichts – keine Verbindung, kein Schloss, kein Fensterbus.
 */
export function starteGeraeteHost(store: HostStore, umgebung: HostUmgebung = {}): GeraeteHost {
  const ablage = umgebung.ablage === undefined ? vorgabeAblage() : umgebung.ablage
  const fenster = umgebung.fenster === undefined ? (typeof window === 'undefined' ? null : window) : umgebung.fenster
  const sammelnMs = umgebung.sammelnMs ?? SAMMELN_MS
  const endeWartenMs = umgebung.endeWartenMs ?? ENDE_WARTEN_MS
  const koppelTaktMs = umgebung.koppelTaktMs ?? KOPPEL_TAKT_MS
  const uhr = umgebung.uhr ?? Date.now

  const raum = shallowRef<RaumInfo | null>(null)
  const fuehrt = ref(false)
  const verbindung = shallowRef<VerbindungsMeldung | null>(null)
  let aktiv: Aktiv | null = null
  let gestoppt = false
  let infoText = 'null'

  const kennung = () => store.state.value.kennung
  const liesRaum = (): HostRaum | null => (kennung() ? hostAblage(kennung(), ablage).lies() : null)

  const setzeInfo = (r: HostRaum | null) => {
    const info = r ? raumInfo(r) : null
    const text = JSON.stringify(info)
    if (text === infoText) return
    infoText = text
    raum.value = info
  }

  /** Raum gelesen → Info, und je nachdem Gerätebetrieb an oder aus. Bei jedem Anlass gerufen; wiederholbar. */
  function pruefe(): void {
    if (gestoppt) return
    const r = liesRaum()
    setzeInfo(r)
    if (aktiv && (!r || aktiv.kennung !== kennung())) deaktiviere()
    if (r && !aktiv) aktiviere(kennung())
  }

  function aktiviere(k: string): void {
    const bus = oeffneFensterbus(undefined, umgebung.bus)
    const a: Aktiv = {
      kennung: k, bus, fuehrung: null, scope: effectScope(true), transport: null, leitung: null, timer: null, letzte: '', endet: false,
      wegBefehl: () => {}, wegAnwenden: () => {}, koppelTakt: null, koppelThemen: new Set(),
    }
    aktiv = a
    a.wegBefehl = bus.beimBefehl((befehl) => {
      if (aktiv === a && a.fuehrung?.fuehrt.value) void fuehreAus(a, befehl)
    })
    // E7, jedes Fenster mit vollem Store: Geräte-Actions anwenden, wenn das Führungsfenster sie hierher reicht (dieses
    // ist das zuletzt bediente), und jede eigene Bedienung melden – so schreibt weiter nur EIN Fenster (K27).
    const ohneAnwenden = store.dispatch ? bus.beimAnwenden(wendeAn) : () => {}
    const bedient = () => bus.bedient()
    for (const art of ['pointerdown', 'keydown'] as const) fenster?.addEventListener(art, bedient, { capture: true, passive: true } as AddEventListenerOptions)
    a.wegAnwenden = () => {
      ohneAnwenden()
      for (const art of ['pointerdown', 'keydown'] as const) fenster?.removeEventListener(art, bedient, { capture: true } as EventListenerOptions)
    }
    a.scope.run(() => {
      // Im eigenen Bereich: Mit ihm endet auch die Führung (fuehrung.ts räumt per onScopeDispose auf).
      const f = waehleFuehrung(bus.id, umgebung.fuehrung)
      a.fuehrung = f
      watch(f.fuehrt, (an) => {
        if (aktiv !== a) return
        fuehrt.value = an
        if (an) uebernimm(a)
        else gibAb(a)
      }, { immediate: true })
      watch(bus.verbindung, (m) => {
        if (aktiv === a) verbindung.value = m
      }, { immediate: true })
    })
  }

  function deaktiviere(): void {
    const a = aktiv
    if (!a) return
    gibAb(a)
    aktiv = null
    a.wegBefehl()
    a.wegAnwenden()
    a.scope.stop()
    a.fuehrung?.stop()
    a.bus.schliesse()
    fuehrt.value = false
    verbindung.value = null
  }

  /** Dieses Fenster führt: Transport anlegen und starten, ab jetzt verteilen. */
  function uebernimm(a: Aktiv): void {
    if (aktiv !== a || a.transport || a.endet) return
    // Der Raum kann inzwischen weg sein (ein anderes Fenster hat ihn beendet und dabei das Schloss abgegeben).
    if (!hostAblage(a.kennung, ablage).lies()) {
      pruefe()
      return
    }
    const t = new HostTransport({
      server: hostServer(store.state.value) ?? '',
      speicher: hostAblage(a.kennung, ablage),
      sichtFassung: SICHT_FASSUNG,
      zeiten: umgebung.zeiten,
      uhr: umgebung.uhr,
    })
    a.transport = t
    a.letzte = ''
    // E7: Anmeldungen und Actions der Geräte – nur hier, im Führungsfenster.
    t.beiEingang((e) => void nimmAn(a, t, e))
    const leitung = effectScope(true)
    a.leitung = leitung
    leitung.run(() => {
      watch([t.status, t.fehler], ([status, fehler]) => a.bus.meldeVerbindung({ status, fehler }), { immediate: true })
      watch(() => store.state.value, () => plane(a))
      // Anderer Server in den Einstellungen: neu verbinden – passt er nicht zum Raum, meldet der Transport das
      // (`raum-anderer-server`); der Raum endet nicht von selbst.
      watch(() => store.state.value.geraeteServer, () => {
        gibAb(a)
        uebernimm(a)
      })
    })
    // start() legt ohne Warten los (gestoppt = false), danach kann gleich verteilt werden; das Senden wartet aufs Abo.
    void t.start()
    verteile(a)
    // Koppeln: laufende Codes aus dem Raum (auch eines früheren Führungsfensters) wieder mitlesen; QR-Token drehen.
    pflegeKoppeln(a)
    a.koppelTakt = setInterval(() => pflegeKoppeln(a), koppelTaktMs)
  }

  /** Nicht mehr führend (oder Raum zu): Transport anhalten. Ein neues Führungsfenster beginnt mit Vollständen. */
  function gibAb(a: Aktiv): void {
    if (a.timer) clearTimeout(a.timer)
    a.timer = null
    if (a.koppelTakt) clearInterval(a.koppelTakt)
    a.koppelTakt = null
    a.koppelThemen.clear()
    a.leitung?.stop()
    a.leitung = null
    if (!a.transport) return
    a.transport.stop()
    a.transport = null
    a.bus.meldeVerbindung(null)
  }

  function plane(a: Aktiv): void {
    if (a.timer || !a.transport) return
    a.timer = setTimeout(() => {
      a.timer = null
      verteile(a)
    }, sammelnMs)
  }

  /** Beide Sichten an ihre Gruppen – nur, wenn sich die öffentliche geändert hat (die Zuschauersicht folgt aus ihr). */
  function verteile(a: Aktiv): void {
    const t = a.transport
    if (!t || a.endet) return
    let sicht: ReturnType<typeof sichtOeffentlich>
    try {
      sicht = sichtOeffentlich(store.state.value, { logos: !BETRIEB_ANNAHMEN.logosNurLokal })
    } catch {
      // Ein Stand, aus dem sich keine Sicht rechnen lässt, zeigt auch die Anzeigetafel am Bedienrechner nicht.
      return
    }
    const text = JSON.stringify(sicht)
    if (text === a.letzte) return
    a.letzte = text
    t.verteile(OEFFENTLICH, JSON.parse(text) as Json)
    t.verteile(ZUSCHAUER, JSON.parse(JSON.stringify(sichtZuschauer(sicht))) as Json)
  }

  // -------------------------------------------------------------------------
  // E7: Geräte-Actions, Koppeln, Register (nur im Führungsfenster)
  // -------------------------------------------------------------------------

  /** Eine weitergereichte (oder eigene) Geräte-Action in DIESEM Fenster anwenden. Geprüft ist sie schon. */
  function wendeAn(action: { type: string }): Anwendung {
    const vorher = store.state.value
    store.dispatch!(action as Action)
    return store.state.value === vorher ? 'unveraendert' : 'angewandt'
  }

  /**
   * Eine Nachricht eines Geräts (Plan §5): Anmeldung → koppelEntscheid; Action → Rechte laut Register (`darf`,
   * Positivliste), dann über das Schreibfenster anwenden (Fensterbus, nach 1 s selbst) und ERST DANACH quittieren –
   * dabei zählt der Transport `letzteNr` hoch. Doppelte (nr ≤ letzteNr) beantwortet der Transport selbst.
   */
  async function nimmAn(a: Aktiv, t: HostTransport, e: Eingang): Promise<void> {
    const raum = t.raumJetzt()
    if (!raum || aktiv !== a || a.transport !== t) return
    const jetzt = uhr()
    if (e.nachricht.art === 'hallo') {
      const d = entscheideAnmeldung({
        koppeln: koppelStandVon(raum),
        geraete: bekannteGeraete(raum),
        anmeldung: { id: e.id, pk: e.pk, gebunden: e.gebunden, name: e.nachricht.name, code: e.nachricht.code, thema: e.thema },
        jetzt,
        neueId: neueGeraeteId,
        ersatzName: text('geraete.name.geraet'),
      })
      if (d.art === 'abgelehnt') return t.ablehnen(e, d.grund)
      if (t.begruesse(e, { id: d.id, gruppen: [OEFFENTLICH], aufgaben: d.aufgaben, name: d.name }) === 'id-belegt') return t.ablehnen(e, 'id-belegt')
      // Der Geräte-Code gilt für EIN Gerät.
      if (d.weg === 'code') t.verwalte((r) => setzeKoppelStand(r, markiereBenutzt(koppelStandVon(r), jetzt)))
      // Dieses Fenster bekommt kein storage-Ereignis für das eigene Schreiben: Geräteliste hier selbst nachziehen.
      setzeInfo(t.raumJetzt())
      return
    }
    // Actions nur von gekoppelten Geräten; ein Unbekannter kommt hier gar nicht an (transport.ts), sicher ist sicher.
    if (!e.gebunden) return
    const action = store.dispatch ? erlaubteAction(e.nachricht.action, aufgabenVon(raum, e.id), store.state.value) : null
    if (!action) {
      t.verwalte((r) => beruehre(r, e.id, jetzt))
      t.quittiere(e, 'abgelehnt', 'nicht-erlaubt')
      setzeInfo(t.raumJetzt())
      return
    }
    const ergebnis = await a.bus.reicheWeiter(action, wendeAn)
    // Führung verloren, während das Schreibfenster anwandte: keine Quittung von hier – das Gerät wiederholt, das neue
    // Führungsfenster wendet erneut an (bedingt/idempotent, K30) und quittiert.
    if (aktiv !== a || a.transport !== t) return
    t.verwalte((r) => beruehre(r, e.id, uhr()))
    t.quittiere(e, ergebnis)
    setzeInfo(t.raumJetzt())
  }

  /** Koppeln pflegen: Abgelaufenes räumen, QR-Token drehen, die Koppel-Themen lesen, solange sie gelten. */
  function pflegeKoppeln(a: Aktiv): void {
    const t = a.transport
    if (!t || aktiv !== a) return
    const jetzt = uhr()
    const raum = t.raumJetzt() ?? hostAblage(a.kennung, ablage).lies()
    if (!raum) return
    const vorher = koppelStandVon(raum)
    let stand = raeumeAuf(vorher, jetzt)
    if (qrFaellig(stand, jetzt, koppelTaktMs)) stand = dreheQr(stand, jetzt)
    const neu = stand !== vorher ? t.verwalte((r) => setzeKoppelStand(r, stand)) : raum
    const soll = new Set(koppelThemen(koppelStandVon(neu ?? raum), jetzt))
    for (const thema of a.koppelThemen) if (!soll.has(thema)) t.liesNichtMehr(thema)
    for (const thema of soll) if (!a.koppelThemen.has(thema)) t.liesAuch(thema)
    a.koppelThemen = soll
    if (neu && neu !== raum) setzeInfo(neu)
  }

  /** Ein Befehl zu Koppeln und Register – im Führungsfenster. */
  function fuehreGeraeteBefehlAus(a: Aktiv, befehl: GeraeteBefehl): void {
    const t = a.transport
    if (!t) return
    const jetzt = uhr()
    switch (befehl.art) {
      case 'code':
        t.verwalte((r) => setzeKoppelStand(r, gibCode(koppelStandVon(r), r.oeffentlich.a, befehl.aufgaben, jetzt)))
        break
      case 'qr':
        t.verwalte((r) => setzeKoppelStand(r, oeffneQr(koppelStandVon(r), befehl.aufgaben, jetzt)))
        break
      case 'koppeln-ende':
        t.verwalte((r) => setzeKoppelStand(r, schliesseKoppeln(koppelStandVon(r), befehl.was)))
        break
      case 'aufgaben': {
        let gesetzt = false
        t.verwalte((r) => {
          gesetzt = setzeAufgaben(r, befehl.id, befehl.aufgaben)
        })
        // Wirkt sofort: am Host gilt der neue Stand für die nächste Action, das Gerät erfährt ihn direkt (P-6).
        if (gesetzt) t.sende(befehl.id, { art: 'aufgaben', aufgaben: aufgabenVon(t.raumJetzt()!, befehl.id) })
        break
      }
      case 'umbenennen':
        t.verwalte((r) => {
          benenne(r, befehl.id, befehl.name.trim())
        })
        break
      case 'entziehen': {
        const vorher = t.raumJetzt()?.geraete[befehl.id]
        const name = vorher?.name ?? ''
        const pk = vorher?.pk
        if (t.entziehe(befehl.id)) t.verwalte((r) => vermerkeEntzug(r, { id: befehl.id, name, um: jetzt, ...(pk ? { pk } : {}) }))
        break
      }
    }
    pflegeKoppeln(a)
    pruefe()
  }

  /** Aus der Oberfläche: im Führungsfenster gleich, sonst als Befehl dorthin. */
  function geraeteBefehl(befehl: GeraeteBefehl): void {
    const a = aktiv
    if (!a) return
    if (a.fuehrung?.fuehrt.value) fuehreGeraeteBefehlAus(a, befehl)
    else a.bus.befiehl(befehl)
  }

  async function fuehreAus(a: Aktiv, befehl: Befehl): Promise<RaumEnde> {
    if (typeof befehl !== 'string') {
      fuehreGeraeteBefehlAus(a, befehl)
      return 'ohne-meldung'
    }
    if (befehl === 'zuschauer-erneuern') {
      // Auch ohne laufende Verbindung (Fehler): Das Thema wechselt im Raum; der Vollstand folgt, sobald verbunden ist.
      const t = a.transport ?? new HostTransport({ server: hostServer(store.state.value) ?? '', speicher: hostAblage(a.kennung, ablage), sichtFassung: SICHT_FASSUNG })
      t.erneuereThema('z')
      pruefe()
      return 'ohne-meldung'
    }
    return beendeHier(a)
  }

  /**
   * „Raum beenden“ im Führungsfenster: signiert „Raum beendet“ an beide öffentlichen Gruppen, warten, bis es hinaus
   * ist (höchstens {@link ENDE_WARTEN_MS}), dann Raum löschen – erst danach das Schloss abgeben, sonst übernähme ein
   * anderes Fenster den noch vorhandenen Raum.
   */
  async function beendeHier(a: Aktiv): Promise<RaumEnde> {
    if (a.endet) return 'ohne-meldung'
    a.endet = true
    if (a.timer) clearTimeout(a.timer)
    a.timer = null
    const gespeichert = hostAblage(a.kennung, ablage).lies()
    let t = a.transport
    let eigener: HostTransport | null = null
    if (gespeichert && (!t || t.status.value === 'fehler')) {
      // Keine Verbindung über die Einstellung (etwa ein anderer Server als beim Anlegen): über den Server des Raums
      // verabschieden – dort lesen die Geräte.
      eigener = new HostTransport({ server: gespeichert.server, speicher: hostAblage(a.kennung, ablage), sichtFassung: SICHT_FASSUNG, zeiten: umgebung.zeiten, uhr: umgebung.uhr })
      void eigener.start()
      t = eigener
    }
    let gemeldet = false
    if (t) {
      t.melde(OEFFENTLICH, { art: 'ende' })
      t.melde(ZUSCHAUER, { art: 'ende' })
      gemeldet = await t.bisGesendet(endeWartenMs)
    }
    eigener?.stop()
    gibAb(a)
    beendeRaum(ablage)
    deaktiviere()
    pruefe()
    return gemeldet ? 'gemeldet' : 'ohne-meldung'
  }

  /**
   * Ein anderes Fenster führt: Befehl dorthin und warten, bis der Raum weg ist; sonst (niemand antwortet) selbst
   * löschen. Ob die Meldung hinausging, weiß nur das Führungsfenster – hier gilt: Es war verbunden.
   */
  async function beendeUeberBus(a: Aktiv): Promise<RaumEnde> {
    const verbunden = verbindung.value?.status === 'verbunden'
    a.bus.befiehl('raum-beenden')
    const ende = Date.now() + endeWartenMs + 2000
    while (Date.now() < ende) {
      if (!liesRaum()) {
        pruefe()
        return verbunden ? 'gemeldet' : 'ohne-meldung'
      }
      await new Promise((erfuelle) => setTimeout(erfuelle, 50))
    }
    beendeRaum(ablage)
    pruefe()
    return 'ohne-meldung'
  }

  const beiSpeicher = (e: Event) => {
    if ((e as StorageEvent).key === ABLAGE.raum || (e as StorageEvent).key === null) pruefe()
  }
  fenster?.addEventListener('storage', beiSpeicher)
  const oben = effectScope(true)
  oben.run(() => {
    // Andere Veranstaltung (Laden, „Alles zurücksetzen“): ihr Raum – oder keiner.
    watch(() => store.state.value.kennung, () => pruefe())
  })
  pruefe()

  return {
    raum,
    fuehrt,
    verbindung,
    oeffne() {
      const vorhanden = liesRaum()
      if (vorhanden) {
        pruefe()
        return raumInfo(vorhanden)!
      }
      const server = hostServer(store.state.value)
      if (!server || !kennung()) throw new Error('server-ungueltig')
      const neu = legeRaumAn(kennung(), server, ablage)
      pruefe()
      const info = raumInfo(neu)
      if (!info) throw new Error('server-ungueltig')
      return info
    },
    erneuereZuschauer() {
      const a = aktiv
      if (!a) return
      if (a.fuehrung?.fuehrt.value) void fuehreAus(a, 'zuschauer-erneuern')
      else a.bus.befiehl('zuschauer-erneuern')
    },
    gibCode: (aufgaben) => geraeteBefehl({ art: 'code', aufgaben }),
    oeffneQr: (aufgaben) => geraeteBefehl({ art: 'qr', aufgaben }),
    beendeKoppeln: (was = 'alle') => geraeteBefehl({ art: 'koppeln-ende', was }),
    setzeAufgaben: (id, aufgaben) => geraeteBefehl({ art: 'aufgaben', id, aufgaben }),
    benenne: (id, name) => geraeteBefehl({ art: 'umbenennen', id, name }),
    entziehe: (id) => geraeteBefehl({ art: 'entziehen', id }),
    async beende() {
      const a = aktiv
      if (!a) {
        // Kein aktiver Raum dieser Veranstaltung – aber vielleicht ein liegengebliebener: weg damit.
        if (liesRaum()) beendeRaum(ablage)
        pruefe()
        return 'ohne-meldung'
      }
      return a.fuehrung?.fuehrt.value ? beendeHier(a) : beendeUeberBus(a)
    },
    stop() {
      if (gestoppt) return
      deaktiviere()
      gestoppt = true
      oben.stop()
      fenster?.removeEventListener('storage', beiSpeicher)
    },
  }
}
