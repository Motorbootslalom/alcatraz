import { effectScope, inject, ref, shallowRef, watch, type EffectScope, type InjectionKey, type Ref, type ShallowRef } from 'vue'
import nacl from 'tweetnacl'
import type { AppState } from '../types'
import type { Action } from '../state/reducer'
import { t as text } from '../i18n'
import { BETRIEB_ANNAHMEN } from '../betrieb/annahmen'
import { anzeigeSprache, SICHT_FASSUNG, sichtOeffentlich, sichtZuschauer } from '../betrieb/sicht'
import { ABLAGE, beendeRaum, hostAblage, legeRaumAn, liesHerkunft, liesWkrEingang, schreibeHerkunft, schreibeWkrEingang, type Ablage } from './ablage'
import { oeffneFensterbus, type Anwendung, type Befehl, type BusUmgebung, type Fensterbus, type GeraeteBefehl, type VerbindungsMeldung } from './fensterbus'
import { waehleFuehrung, type Fuehrung, type FuehrungsUmgebung } from './fuehrung'
import { normalisiereServer, NTFY_VORGABE } from './themen'
import { koppelPaketAus, packeKoppelPaket, packeLesePaket } from './paket'
import { fingerabdruck, lesePaket, type HostRaum } from './transport/ntfy/raum'
import { HostTransport, type Eingang } from './transport/ntfy/transport'
import { toBase64Url } from './transport/ntfy/codec'
import { erlaubteAction, erlaubteWkr, freigabeBereiche, liesAufgaben, listenAufgaben, WKR_ACTIONS, type Aufgabe } from './aufgaben'
import { gruppeDerFreigabe, gruppeDerListe, gruppenFuer } from './wkrGruppen'
import { extraFuer, leereHerkunft, leererEingang, mitAbgelehnt, mitHerkunft, mitHinweis, ohneGeraet, ohneHinweis, type HerkunftEintrag, type WkrEingang, type WkrHerkunft } from './wkrEingang'
import { configFor } from '../config/konfig'
import { werteVon } from '../lib/eingaben'
import { abschlussVon } from '../wkr/abschluss'
import { WKR_ANNAHMEN } from '../wkr/annahmen'
import { liesListe } from '../wkr/liste'
import { sichtListe } from '../wkr/sicht'
import { erfassungsLage } from '../wkr/lage'
import { sichtFreigabe } from '../wkr/freigabe'
import { entscheideAnmeldung } from './koppelEntscheid'
import { dreheQr, gibCode, koppelThemen, markiereBenutzt, oeffneQr, qrFaellig, raeumeAuf, schliesseKoppeln } from './koppeln'
import {
  aufgabenVon,
  bekannteGeraete,
  benenne,
  beruehre,
  entzogeneListe,
  geraetAngaben,
  geraeteListe,
  gruppenNachAufgaben,
  hatGruppe,
  koppelStandVon,
  setzeAufgaben,
  setzeKoppelStand,
  vermerkeEntzug,
  vermerkeLebenszeichen,
  type EntzogenEintrag,
  type RegisterEintrag,
} from './register'
import type { NtfyZeiten } from './transport/ntfy/leitung'
import type { Json } from './transport/ntfy/patch'
import { istOeffentlich, OEFFENTLICH, ZUSCHAUER, type Ablehnung, type Hinweis } from './transport/protokoll'
import { kontingentZaehler, type KontingentStand, type Zaehlart } from './kontingent'
import { BUILD_COMMIT, BUILD_TIME } from '../lib/build'

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
/** Ergebnis von „Alle Geräte neu laden“ (E8): ohne stehende Verbindung geht nichts hinaus. */
export type NeuLadenErgebnis = 'gesendet' | 'nicht-verbunden'

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
  // --- E8 (20.11.2026) ---
  /**
   * „Alle Geräte neu laden“: signiert `neu laden` an beide Lese-Gruppen (`ko` trägt auch die gekoppelten Handys). Die
   * Geräte holen eine neue Fassung bzw. laden neu, je Befehl einmal (geraet.ts). Über das Führungsfenster.
   * `nicht-verbunden`: Die Verbindung steht gerade nicht – nichts gesendet, auch nicht später (Prüfung E8, 21.11.2026:
   * ein nachgeholter Befehl lüde alle Geräte zur Unzeit neu; ebenso verfällt einer, der in der Schlange hängen bleibt,
   * transport.ts NEULADEN_SENDEN_MS).
   */
  ladeAlleNeu(): NeuLadenErgebnis
  /**
   * Läuft der Bedienrechner mit einer anderen Fassung als zuletzt im Gerätebetrieb (nach „Update“)? Dann bietet
   * Betrieb → Geräte „Alle Geräte neu laden“ an. `false` ohne Raum.
   */
  readonly neueFassung: Readonly<Ref<boolean>>
  /** Den Hinweis auf die neue Fassung wegklicken (auch durch {@link ladeAlleNeu}). */
  fassungGesehen(): void
  /** Heute an den ntfy-Server Gesendetes (geraete/kontingent.ts) – gerätelokal, alle Fenster. */
  readonly kontingent: Readonly<Ref<KontingentStand>>
  // --- W1 (21.11.2026): digitale WKR-Erfassung ---
  /**
   * Hinweis an die Geräte einer Liste (Rückkanal: nur Code und Startnummer, Plan §5) – steht in der Sicht der Liste,
   * bis jedes Gerät ihn als gesehen meldet. Über das Führungsfenster. Mit `teil` (Steg, F16) nur an die Geräte dieses
   * Teils und die ohne Teil – „Papier ab“/„Weiter“ wirken je Teil (Prüfbefund 21.11.2026).
   */
  hinweis(liste: string, code: Hinweis, startNr?: string, teil?: 'ab' | 'an'): void
  /**
   * Herkunft ◆ nach einer Entscheidung im Eingang (Rückfrage „Gerät übernehmen“, Vorschlag „Übernehmen“; Prüfbefund
   * 21.11.2026, Vorschlag §5/§6.2): nach dem dispatch gerufen, schreibt ◆ für die Zellen, in denen jetzt der Wert des
   * Geräts steht. Gerätelokal (ABLAGE.herkunft) – in jedem Fenster, auch ohne Raum.
   */
  merkeEntscheid(liste: string, geraet: string, zeilen: readonly HerkunftZeile[]): void
  // --- W2.2 (21.11.2026, Plan docs/plan-wkr-w2.md §5): Lesen für Matrix, Eingang und Erfassung ---
  /**
   * Herkunft ◆ dieser Veranstaltung (ABLAGE.herkunft, F10) – gelesen beim Start, nach eigenem Schreiben und beim
   * storage-Ereignis (andere Fenster). Auch ohne Raum lesbar (◆ bleibt nach „Raum beenden“), ohne dafür Verbindung,
   * Fensterbus oder Schloss zu öffnen.
   */
  readonly herkunft: Readonly<ShallowRef<WkrHerkunft>>
  /** Gesprächsstand mit den WKR-Geräten (ABLAGE.wkr: abgelehnte Zeilen, offene Hinweise) – gelesen wie {@link herkunft}. */
  readonly eingang: Readonly<ShallowRef<WkrEingang>>
  /** Alles abbauen (Tests; die Anwendung braucht es nicht). */
  stop(): void
}

/** Zellen einer übernommenen Zeile (für ◆): Lauf-Schlüssel, weitere (Vorsteg), Starter, Feld und Wert des Geräts. */
export interface HerkunftZeile {
  lauf: string
  weitere: readonly string[]
  starter: string
  zellen: readonly { feld: string; wert: string }[]
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
  /** E8: Fassung des Programms (Vorgabe Commit und Build-Zeit, lib/build.ts); '' = unbekannt, kein Hinweis. */
  fassung?: string
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

/** Konfiguration des Stands für Rechte und Sicht der Listen (wie lib/listenStand.ts; configFor merkt sie sich). */
const konfigVon = (s: AppState) => configFor({ regelwerk: s.regelwerk, eigeneAufbauten: s.eigeneAufbauten })
/** W2.4: Die Listennamen der Freigabe-Sicht in der Sprache der Anzeigetafel – wie Parcours und Klassen der Start-Freigabe. */
const konfigDerTafel = (s: AppState) => configFor({ regelwerk: s.regelwerk, eigeneAufbauten: s.eigeneAufbauten, sprache: anzeigeSprache(s) })

/**
 * W2.4 (Plan W2 §5, 21.11.2026): So oft rechnet das Führungsfenster die Freigabe-Sicht auch ohne Änderung des Stands
 * neu – die Ampel der Geräte altert mit der Uhr (◐ ab 90 s, ✕ ab 5 min), ohne dass eine Nachricht kommt. Gesendet wird
 * nur, wenn sich der Inhalt ändert (Kontingent; WKR_ANNAHMEN.freigabeTaktSek).
 */
export const FREIGABE_TAKT_MS = WKR_ANNAHMEN.freigabeTaktSek * 1000

/** E7: Takt des Führungsfensters für das Koppeln – QR-Token so früh drehen, dass keine Lücke entsteht. */
const KOPPEL_TAKT_MS = 1000

/**
 * W2.2 (Plan W2 §5, 21.11.2026): Im Führungsfenster zieht der Host `zuletzt gehört` der Geräteliste höchstens so oft
 * nach (Ampel der Matrix) – jede Nachricht eines Geräts berührt das Register, die Oberfläche braucht es nicht so oft.
 * Die anderen Fenster bekommen den Raum ohnehin über das storage-Ereignis.
 */
export const ZULETZT_NACHZIEHEN_MS = 5000

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
  /** W1: zuletzt verteilte Sicht je Listen-Gruppe (Text) und Gruppen, die als nächstes voll gehen (neuer Schlüssel, neues Gerät). */
  listen: Map<string, string>
  listenVoll: Set<string>
  /** „Raum beenden“ läuft: nichts mehr verteilen (eine Sicht nach „Ende“ gälte für neue Geräte wieder). */
  endet: boolean
  wegBefehl: () => void
  /** E7: Anwenden weitergereichter Geräte-Actions und „bedient“ abmelden. */
  wegAnwenden: () => void
  /** E7, nur im Führungsfenster: Takt des Koppelns und die Koppel-Themen, die gerade mitgelesen werden. */
  koppelTakt: ReturnType<typeof setInterval> | null
  koppelThemen: Set<string>
  /** W2.2: `zuletzt` nachziehen – wann zuletzt, und der Timer für das gedrosselte nächste Mal. */
  zuletztZeit: number
  zuletztTimer: ReturnType<typeof setTimeout> | null
  /** W2.4: wann die Freigabe-Sicht zuletzt im Takt gerechnet wurde (Uhr des Hosts). */
  freigabeZeit: number
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
  // E8: Kontingent – jedes Fenster liest denselben Eintrag, gezählt wird im Führungsfenster (dort sendet der Transport).
  const zaehler = kontingentZaehler(ablage, uhr)
  const kontingent = shallowRef<KontingentStand>(zaehler.lies())
  const zaehle = (art: Zaehlart) => {
    kontingent.value = zaehler.zaehle(art)
  }
  // E8: Fassung, mit der der Gerätebetrieb zuletzt lief (ABLAGE.fassung).
  const fassung = umgebung.fassung ?? [BUILD_COMMIT, BUILD_TIME].filter(Boolean).join(' ')
  const neueFassung = ref(false)
  const merkeFassung = () => {
    neueFassung.value = false
    if (!fassung) return
    try {
      ablage?.setItem(ABLAGE.fassung, fassung)
    } catch {
      // Ohne Speicher eben kein Hinweis nach dem nächsten Update.
    }
  }
  const pruefeFassung = (mitRaum: boolean) => {
    if (!mitRaum || !fassung) {
      neueFassung.value = false
      return
    }
    let gemerkt: string | null = null
    try {
      gemerkt = ablage?.getItem(ABLAGE.fassung) ?? null
    } catch {
      gemerkt = null
    }
    // Noch nichts gemerkt (Raum aus der Zeit vor E8): die laufende gilt als gesehen.
    if (gemerkt === null) merkeFassung()
    else neueFassung.value = gemerkt !== fassung
  }
  let aktiv: Aktiv | null = null
  let gestoppt = false
  let infoText = 'null'

  // W2.2: Herkunft ◆ und Gesprächsstand reaktiv – nur Lesen der Ablage, also auch ohne Raum (keine Verbindung).
  const herkunft = shallowRef<WkrHerkunft>(leereHerkunft(''))
  const eingang = shallowRef<WkrEingang>(leererEingang(''))
  /** Zuletzt gelesener Rohtext je Schlüssel: Gleiches wird nicht neu geprüft (die Herkunft kann groß werden). */
  const roh = { herkunft: '\u0000', wkr: '\u0000', kennung: '\u0000' }
  const liesRoh = (key: string): string | null => {
    try {
      return ablage?.getItem(key) ?? null
    } catch {
      return null
    }
  }
  /** Herkunft und Eingang neu lesen. Ohne Kennung leer – und nichts löschen (liesHerkunft räumt fremde Kennungen). */
  function liesWkr(): void {
    const k = store.state.value.kennung
    const neuKennung = roh.kennung !== k
    roh.kennung = k
    const h = liesRoh(ABLAGE.herkunft)
    if (neuKennung || h !== roh.herkunft) {
      herkunft.value = k ? liesHerkunft(k, ablage) : leereHerkunft('')
      roh.herkunft = liesRoh(ABLAGE.herkunft) ?? ''
    }
    const w = liesRoh(ABLAGE.wkr)
    if (neuKennung || w !== roh.wkr) {
      eingang.value = k ? liesWkrEingang(k, ablage) : leererEingang('')
      roh.wkr = liesRoh(ABLAGE.wkr) ?? ''
    }
  }
  const schreibeEingang = (e: WkrEingang) => {
    schreibeWkrEingang(e, ablage)
    liesWkr()
  }
  const schreibeHerk = (h: WkrHerkunft) => {
    schreibeHerkunft(h, ablage)
    liesWkr()
  }

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
    pruefeFassung(!!r)
    if (aktiv && (!r || aktiv.kennung !== kennung())) deaktiviere()
    if (r && !aktiv) aktiviere(kennung())
  }

  function aktiviere(k: string): void {
    const bus = oeffneFensterbus(undefined, umgebung.bus)
    const a: Aktiv = {
      kennung: k, bus, fuehrung: null, scope: effectScope(true), transport: null, leitung: null, timer: null, letzte: '', listen: new Map(), listenVoll: new Set(), endet: false,
      wegBefehl: () => {}, wegAnwenden: () => {}, koppelTakt: null, koppelThemen: new Set(), zuletztZeit: 0, zuletztTimer: null, freigabeZeit: 0,
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
      zaehle,
    })
    a.transport = t
    a.letzte = ''
    a.listen.clear()
    a.listenVoll.clear()
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
    ergaenzeGruppen(a, t)
    verteile(a)
    // Koppeln: laufende Codes aus dem Raum (auch eines früheren Führungsfensters) wieder mitlesen; QR-Token drehen.
    pflegeKoppeln(a)
    a.koppelTakt = setInterval(() => {
      pflegeKoppeln(a)
      // W2.4: Die Ampel altert mit der Uhr – die Freigabe-Sicht gedrosselt neu rechnen (gesendet nur bei Änderung).
      // Nicht nach „Raum beenden“ (Prüfbefund 21.11.2026): keine Sicht hinter die Meldung „ende“, siehe verteile().
      if (a.transport && !a.endet && uhr() - a.freigabeZeit >= FREIGABE_TAKT_MS) verteileFreigabe(a, a.transport)
    }, koppelTaktMs)
  }

  /**
   * W2.4 (Plan W2 §5): Gruppen, die die Aufgaben eines schon gekoppelten Geräts heute verlangen, die es aber noch nicht
   * hat (Freigabe-Gruppe für Handys, die vor W2 gekoppelt wurden) – anlegen und den Schlüssel schicken, ohne neues
   * Koppeln. Nur im Führungsfenster beim Start; meldet sich das Gerät selbst wieder (P-7), trägt sein willkommen sie ohnehin.
   */
  function ergaenzeGruppen(a: Aktiv, t: HostTransport): void {
    const raum = t.raumJetzt()
    if (!raum) return
    for (const [id, g] of Object.entries(raum.geraete)) {
      const aufgaben = liesAufgaben(g.aufgaben)
      const soll = gruppenFuer(aufgaben).filter((x) => !istOeffentlich(x))
      if (soll.every((x) => g.gruppen.includes(x))) continue
      let wechsel: ReturnType<typeof setzeAufgaben> = null
      t.verwalte((r) => {
        wechsel = setzeAufgaben(r, id, aufgaben)
      })
      const w = wechsel as ReturnType<typeof setzeAufgaben>
      if (!w?.neu.length) continue
      t.schickeSchluessel(id)
      for (const x of w.neu) a.listenVoll.add(x)
    }
  }

  /**
   * W2.2 (Plan W2 §5): `zuletzt gehört` (und wartend/Akku) aus dem Register in die Geräteliste dieses Fensters –
   * gedrosselt auf höchstens alle {@link ZULETZT_NACHZIEHEN_MS}; was dazwischen kommt, zieht der Timer nach. Ohne das
   * zeigte die Ampel im Führungsfenster ein lebendes Gerät als ✕ (die anderen Fenster lesen den Raum beim
   * storage-Ereignis). Gedrosselt nach echter Zeit (Date.now), nicht nach der Uhr des Hosts – es geht ums Zeichnen.
   */
  function zieheZuletztNach(a: Aktiv): void {
    if (a.zuletztTimer) return
    const warte = a.zuletztZeit + ZULETZT_NACHZIEHEN_MS - Date.now()
    const jetztNach = () => {
      a.zuletztTimer = null
      a.zuletztZeit = Date.now()
      if (aktiv === a && a.transport) setzeInfo(a.transport.raumJetzt())
    }
    if (warte <= 0) jetztNach()
    else a.zuletztTimer = setTimeout(jetztNach, warte)
  }

  /** Nicht mehr führend (oder Raum zu): Transport anhalten. Ein neues Führungsfenster beginnt mit Vollständen. */
  function gibAb(a: Aktiv): void {
    if (a.timer) clearTimeout(a.timer)
    a.timer = null
    if (a.zuletztTimer) clearTimeout(a.zuletztTimer)
    a.zuletztTimer = null
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

  /**
   * Beide öffentlichen Sichten an ihre Gruppen – nur, wenn sich die öffentliche geändert hat (die Zuschauersicht folgt
   * aus ihr). W1: dazu je Liste mit gekoppelten Geräten die Sicht der Liste an deren Gruppe.
   */
  function verteile(a: Aktiv): void {
    const t = a.transport
    if (!t || a.endet) return
    verteileOeffentlich(a, t)
    verteileListen(a, t)
    verteileFreigabe(a, t)
  }

  function verteileOeffentlich(a: Aktiv, t: HostTransport): void {
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

  /**
   * W1 (Plan §5/§8): je Liste, die ein gekoppeltes Gerät hat, die Sicht der Liste (wkr/sicht.ts) an ihre Gruppe – mit
   * `bis` = `letzteNr` je Gerät (die gesammelte Quittung), Abgelehntem und Hinweisen aus dem Gesprächsstand. Nach
   * Inhalt verglichen: Listen ohne Änderung senden nichts. Nach neuem Schlüssel oder neuem Gerät geht sie voll.
   */
  function verteileListen(a: Aktiv, t: HostTransport): void {
    const raum = t.raumJetzt()
    if (!raum) return
    const jeListe = new Map<string, { id: string; bis: number }[]>()
    for (const [id, g] of Object.entries(raum.geraete)) {
      for (const l of listenAufgaben(liesAufgaben(g.aufgaben))) {
        const liste = jeListe.get(l.liste) ?? []
        liste.push({ id, bis: g.letzteNr })
        jeListe.set(l.liste, liste)
      }
    }
    if (jeListe.size === 0) return
    const state = store.state.value
    const konfig = konfigVon(state)
    const eingang = liesWkrEingang(a.kennung, ablage)
    for (const [kennung, geraete] of jeListe) {
      const liste = liesListe(kennung)
      const gruppe = gruppeDerListe(kennung)
      if (!liste || !raum.gruppen[gruppe]) continue
      let text: string
      try {
        text = JSON.stringify(sichtListe(state, konfig, liste, extraFuer(eingang, kennung, geraete)))
      } catch {
        // Eine Liste, die es so nicht (mehr) gibt: nichts verteilen, das Gerät behält die letzte Sicht.
        continue
      }
      const voll = a.listenVoll.delete(gruppe)
      if (!voll && a.listen.get(gruppe) === text) continue
      a.listen.set(gruppe, text)
      t.verteile(gruppe, JSON.parse(text) as Json, { voll })
    }
  }

  /**
   * W2.4 (Plan W2 §5/§6.3): je Bereich, für den ein gekoppeltes Gerät die Start-Freigabe hat, die Freigabe-Sicht
   * (wkr/freigabe.ts – Rückstand ohne Werte und Namen) an die Freigabe-Gruppe des Bereichs. Gesammelt mit den anderen
   * Sichten, nach Inhalt verglichen (nur bei Änderung, Kontingent); nach neuem Schlüssel oder neuem Gerät voll. Hat
   * keine Liste des Bereichs einen Eintrag und ging noch nichts hinaus, geht auch nichts (das Handy zeigt dann ohnehin
   * keine Leiste). NIE an ko/kz (F17).
   */
  function verteileFreigabe(a: Aktiv, t: HostTransport): void {
    if (a.endet) return
    a.freigabeZeit = uhr()
    const raum = t.raumJetzt()
    if (!raum) return
    const bereiche = new Set<string>()
    for (const g of Object.values(raum.geraete)) for (const b of freigabeBereiche(liesAufgaben(g.aufgaben))) bereiche.add(b)
    if (bereiche.size === 0) return
    const state = store.state.value
    const konfig = konfigDerTafel(state)
    const geraete = geraetAngaben(geraeteListe(raum))
    const jetzt = uhr()
    for (const bereich of bereiche) {
      const gruppe = gruppeDerFreigabe(bereich)
      if (!raum.gruppen[gruppe]) continue
      let text: string
      try {
        const lage = erfassungsLage(state, konfig, bereich, geraete, jetzt)
        text = JSON.stringify(sichtFreigabe(bereich, lage.listen, state.anzeige.wkrWarnung))
      } catch {
        // Ein Bereich, den es so nicht (mehr) gibt: nichts verteilen, das Handy behält die letzte Sicht.
        continue
      }
      const bisher = a.listen.get(gruppe)
      // Noch nie gesendet und nichts zu zeigen: nichts senden (spart eine Nachricht je Bereich und Start).
      if (bisher === undefined && (JSON.parse(text) as { listen: unknown[] }).listen.length === 0) continue
      const voll = a.listenVoll.delete(gruppe)
      if (!voll && bisher === text) continue
      a.listen.set(gruppe, text)
      t.verteile(gruppe, JSON.parse(text) as Json, { voll })
    }
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
      // W1: Je Liste der Aufgaben eine Gruppe, W2.4: je Bereich der Start-Freigabe die Freigabe-Gruppe (im Raum
      // angelegt, bevor das willkommen ihre Schlüssel trägt).
      const listen = listenAufgaben(d.aufgaben)
      const eigene = gruppenFuer(d.aufgaben).filter((g) => !istOeffentlich(g))
      if (eigene.length) t.verwalte((r) => void gruppenNachAufgaben(r, d.aufgaben))
      if (t.begruesse(e, { id: d.id, gruppen: gruppenFuer(d.aufgaben), aufgaben: d.aufgaben, name: d.name }) === 'id-belegt') return t.ablehnen(e, 'id-belegt')
      // Der Geräte-Code gilt für EIN Gerät.
      if (d.weg === 'code') t.verwalte((r) => setzeKoppelStand(r, markiereBenutzt(koppelStandVon(r), jetzt)))
      // Dieses Fenster bekommt kein storage-Ereignis für das eigene Schreiben: Geräteliste hier selbst nachziehen.
      setzeInfo(t.raumJetzt())
      if (listen.length) meldeDigital(a, listen.map((l) => l.liste))
      if (eigene.length) {
        for (const g of eigene) a.listenVoll.add(g)
        plane(a)
      }
      return
    }
    // Actions nur von gekoppelten Geräten; ein Unbekannter kommt hier gar nicht an (transport.ts), sicher ist sicher.
    if (!e.gebunden) return
    const n = e.nachricht
    if (n.art === 'lebenszeichen') {
      // Still quittiert, wenn das Gerät eine Liste hat: `bis` in deren Sicht sagt es ihm.
      t.verwalte((r) => vermerkeLebenszeichen(r, e.id, jetzt, { wartend: n.wartend, ...(n.akku !== undefined ? { akku: n.akku } : {}) }))
      t.quittiere(e, 'angewandt', undefined, { still: hatListenGruppe(raum, e.id) })
      zieheZuletztNach(a)
      plane(a)
      return
    }
    if (n.art === 'gesehen') {
      const vorher = liesWkrEingang(a.kennung, ablage)
      const nachher = ohneHinweis(vorher, e.id, n.hinweis)
      if (nachher !== vorher) schreibeEingang(nachher)
      t.verwalte((r) => beruehre(r, e.id, jetzt))
      t.quittiere(e, nachher !== vorher ? 'angewandt' : 'unveraendert', undefined, { still: hatListenGruppe(raum, e.id) })
      zieheZuletztNach(a)
      plane(a)
      return
    }
    if (n.art !== 'action') return
    if ((WKR_ACTIONS as readonly string[]).includes(n.action.type)) return nimmWkrAn(a, t, e, n.action)
    const action = store.dispatch ? erlaubteAction(n.action, aufgabenVon(raum, e.id), store.state.value) : null
    if (!action) {
      t.verwalte((r) => beruehre(r, e.id, jetzt))
      t.quittiere(e, 'abgelehnt', 'nicht-erlaubt')
      zieheZuletztNach(a)
      return
    }
    const ergebnis = await a.bus.reicheWeiter(action, wendeAn)
    // Führung verloren, während das Schreibfenster anwandte: keine Quittung von hier – das Gerät wiederholt, das neue
    // Führungsfenster wendet erneut an (bedingt/idempotent, K30) und quittiert.
    if (aktiv !== a || a.transport !== t) return
    t.verwalte((r) => beruehre(r, e.id, uhr()))
    t.quittiere(e, ergebnis)
    zieheZuletztNach(a)
  }

  /** W1: Hat das Gerät irgendeine Listen-Gruppe? Dann kommen seine Quittungen gesammelt über deren Sicht. */
  function hatListenGruppe(raum: HostRaum, id: string): boolean {
    return listenAufgaben(aufgabenVon(raum, id)).some((l) => hatGruppe(raum, id, gruppeDerListe(l.liste)))
  }

  /**
   * W1: Eine Liste wird mit dem ersten Gerät digital (WKR_ANNAHMEN, Plan §9.6) – `nurWennFehlt`: eine Liste, die der
   * Bediener schon auf Papier oder „beides“ gestellt hat, bleibt so. Über das Schreibfenster wie Geräte-Actions.
   */
  function meldeDigital(a: Aktiv, listen: readonly string[]): void {
    if (!store.dispatch) return
    for (const liste of listen) void a.bus.reicheWeiter({ type: 'WKR_LISTE', liste, modus: 'digital', nurWennFehlt: true }, wendeAn)
  }

  /**
   * W1 (Plan §5): Zeilen, Status, Abschluss eines WKR-Geräts. Rechte und Prüfung: aufgaben.ts erlaubteWkr (Aufgaben aus
   * dem Register, Name aus dem Register); abgelehnte Zeilen in den Gesprächsstand (Sicht der Liste); das Übrige über
   * das Schreibfenster anwenden; dann Herkunft ◆ nur für Zellen, in denen jetzt der Wert des Geräts steht (F10); dann
   * quittieren – still, wenn das Gerät die Gruppe der Liste hat (die Sicht trägt `bis`), sonst direkt.
   */
  async function nimmWkrAn(a: Aktiv, t: HostTransport, e: Eingang, roh: { type: string; [feld: string]: unknown }): Promise<void> {
    const raum = t.raumJetzt()
    if (!raum) return
    const geraet = { id: e.id, name: raum.geraete[e.id]?.name ?? '' }
    const liste = typeof roh.liste === 'string' ? roh.liste : ''
    const still = !!liste && hatGruppe(raum, e.id, gruppeDerListe(liste))
    const state = store.state.value
    const erlaubt = store.dispatch ? erlaubteWkr(roh, aufgabenVon(raum, e.id), state, konfigVon(state), geraet) : null
    if (!erlaubt) {
      // Nicht erlaubt: direkt – das Gerät erführe es sonst nirgends (keine Zeile, die die Sicht nennen könnte).
      t.verwalte((r) => beruehre(r, e.id, uhr()))
      t.quittiere(e, 'abgelehnt', 'nicht-erlaubt')
      zieheZuletztNach(a)
      return
    }
    if (erlaubt.abgelehnt.length) {
      schreibeEingang(mitAbgelehnt(liesWkrEingang(a.kennung, ablage), e.id, liste, erlaubt.abgelehnt))
    }
    let ergebnis: 'angewandt' | 'unveraendert' | 'abgelehnt' = 'abgelehnt'
    let grund: Ablehnung | undefined = erlaubt.abgelehnt[0]?.grund
    const action = erlaubt.action
    if (action) {
      ergebnis = await a.bus.reicheWeiter(action, wendeAn)
      // Führung verloren: keine Quittung von hier (wie bei der Start-Freigabe); das Gerät wiederholt.
      if (aktiv !== a || a.transport !== t) return
      grund = undefined
      const jetzt = store.state.value
      if (action.type === 'WKR_ZEILEN') merkeHerkunft(a.kennung, action.liste, action.quelle.name, action.zeilen, jetzt.eingaben)
      // Abschluss ohne Wirkung, weil noch Starts offen sind (ohne „Rest auf Papier“): sagen, warum. Gemessen am eigenen
      // Eintrag vorher/nachher (am Steg je Teil) – ein Abschluss des anderen Teils zählt nicht als angenommen.
      if (action.type === 'WKR_ABSCHLUSS' && (ergebnis === 'unveraendert' || abschlussVon(jetzt.wkr, action.liste, action.punkt, action.teil) === abschlussVon(state.wkr, action.liste, action.punkt, action.teil))) {
        ergebnis = 'abgelehnt'
        grund = 'offen'
      }
    }
    t.verwalte((r) => beruehre(r, e.id, uhr()))
    t.quittiere(e, ergebnis, grund, { still })
    zieheZuletztNach(a)
    plane(a)
  }

  /** Herkunft ◆ (F10) für die Zellen einer übernommenen Zeile – nur, wo jetzt der Wert des Geräts steht. */
  function merkeHerkunft(kennung: string, liste: string, name: string, zeilen: readonly HerkunftZeile[], eingaben: AppState['eingaben']): void {
    if (!kennung) return
    const bisherige = liesHerkunft(kennung, ablage)
    const zeit = uhr()
    const eintraege: { lauf: string; starter: string; feld: string; eintrag: HerkunftEintrag }[] = []
    for (const z of zeilen) {
      for (const c of z.zellen) {
        if (c.wert === '') continue
        for (const lauf of [z.lauf, ...z.weitere]) {
          if ((werteVon(eingaben, lauf, z.starter)[c.feld] ?? '') !== c.wert) continue
          const bisher = bisherige.zellen[`${lauf}|${z.starter}|${c.feld}`]
          // Dasselbe Gerät, derselbe Wert (Wiederholung): die erste Zeit bleibt.
          if (bisher && bisher.g === name && bisher.w === c.wert) continue
          eintraege.push({ lauf, starter: z.starter, feld: c.feld, eintrag: { g: name, l: liste, z: zeit, w: c.wert } })
        }
      }
    }
    if (eintraege.length) schreibeHerk(mitHerkunft(bisherige, eintraege))
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
        let wechsel: ReturnType<typeof setzeAufgaben> = null
        t.verwalte((r) => {
          wechsel = setzeAufgaben(r, befehl.id, befehl.aufgaben)
        })
        const w = wechsel as ReturnType<typeof setzeAufgaben>
        if (!w) break
        // W1: Liste entzogen → neuer Schlüssel ihrer Gruppe (das Gerät liest sie nicht mehr); Liste dazu → Schlüssel an
        // das Gerät (vor den Aufgaben), die Liste wird digital, und ihre Sicht geht voll.
        for (const g of w.weg) if (t.rotiere(g)) a.listenVoll.add(g)
        if (w.neu.length) t.schickeSchluessel(befehl.id)
        for (const g of w.neu) a.listenVoll.add(g)
        // Wirkt sofort: am Host gilt der neue Stand für die nächste Action, das Gerät erfährt ihn direkt (P-6).
        const jetzt = aufgabenVon(t.raumJetzt()!, befehl.id)
        t.sende(befehl.id, { art: 'aufgaben', aufgaben: jetzt })
        const neueListen = listenAufgaben(jetzt).map((l) => l.liste).filter((l) => w.neu.includes(gruppeDerListe(l)))
        meldeDigital(a, neueListen)
        plane(a)
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
        if (t.entziehe(befehl.id)) {
          t.verwalte((r) => vermerkeEntzug(r, { id: befehl.id, name, um: jetzt, ...(pk ? { pk } : {}) }))
          // W1: Gruppen des Geräts haben neue Schlüssel (transport.ts entziehe) – ihre Sicht geht voll; sein
          // Gesprächsstand ist weg.
          for (const g of vorher?.gruppen ?? []) a.listenVoll.add(g)
          const e = liesWkrEingang(a.kennung, ablage)
          const ohne = ohneGeraet(e, befehl.id)
          if (ohne !== e) schreibeEingang(ohne)
          plane(a)
        }
        break
      }
      case 'hinweis': {
        const raum = t.raumJetzt()
        if (!raum) break
        // Am Steg mit Teil nur die Geräte dieses Teils und die ohne Teil (F16).
        const passt = (l: { liste: string; teil?: 'ab' | 'an' }) => l.liste === befehl.liste && (befehl.teil === undefined || l.teil === undefined || l.teil === befehl.teil)
        const ids = Object.entries(raum.geraete).filter(([, g]) => listenAufgaben(liesAufgaben(g.aufgaben)).some(passt)).map(([id]) => id)
        if (!ids.length) break
        schreibeEingang(mitHinweis(liesWkrEingang(a.kennung, ablage), ids, befehl.liste, befehl.code, befehl.startNr).eingang)
        plane(a)
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
    if (befehl === 'alle-neu-laden') {
      // Nur über den laufenden Transport; ladeAlleNeu prüft vorher die Verbindung, und was trotzdem in der Schlange
      // hängen bleibt (Abriss genau jetzt), verfällt dort nach NEULADEN_SENDEN_MS.
      a.transport?.melde(OEFFENTLICH, { art: 'neu-laden' })
      a.transport?.melde(ZUSCHAUER, { art: 'neu-laden' })
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
      eigener = new HostTransport({ server: gespeichert.server, speicher: hostAblage(a.kennung, ablage), sichtFassung: SICHT_FASSUNG, zeiten: umgebung.zeiten, uhr: umgebung.uhr, zaehle })
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
    const key = (e as StorageEvent).key
    if (key === ABLAGE.raum || key === null) pruefe()
    if (key === ABLAGE.kontingent || key === null) kontingent.value = zaehler.lies()
    if (key === ABLAGE.fassung) pruefeFassung(!!liesRaum())
    if (key === ABLAGE.herkunft || key === ABLAGE.wkr || key === null) liesWkr()
  }
  fenster?.addEventListener('storage', beiSpeicher)
  const oben = effectScope(true)
  oben.run(() => {
    // Andere Veranstaltung (Laden, „Alles zurücksetzen“): ihr Raum – oder keiner.
    watch(() => store.state.value.kennung, () => {
      pruefe()
      liesWkr()
    })
  })
  pruefe()
  liesWkr()

  return {
    raum,
    fuehrt,
    verbindung,
    herkunft,
    eingang,
    oeffne() {
      const vorhanden = liesRaum()
      if (vorhanden) {
        pruefe()
        return raumInfo(vorhanden)!
      }
      const server = hostServer(store.state.value)
      if (!server || !kennung()) throw new Error('server-ungueltig')
      const neu = legeRaumAn(kennung(), server, ablage)
      // Ein neuer Raum hat nur Geräte mit dieser Fassung – kein Hinweis aus einem früheren Raum.
      merkeFassung()
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
    hinweis: (liste, code, startNr, teil) => geraeteBefehl({ art: 'hinweis', liste, code, ...(startNr !== undefined ? { startNr } : {}), ...(teil !== undefined ? { teil } : {}) }),
    merkeEntscheid: (liste, geraet, zeilen) => merkeHerkunft(store.state.value.kennung, liste, geraet, zeilen, store.state.value.eingaben),
    neueFassung,
    kontingent,
    fassungGesehen: merkeFassung,
    ladeAlleNeu() {
      const a = aktiv
      if (!a || verbindung.value?.status !== 'verbunden') return 'nicht-verbunden'
      merkeFassung()
      if (a.fuehrung?.fuehrt.value) void fuehreAus(a, 'alle-neu-laden')
      else a.bus.befiehl('alle-neu-laden')
      return 'gesendet'
    },
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
