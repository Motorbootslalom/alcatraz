import { effectScope, inject, ref, shallowRef, watch, type EffectScope, type InjectionKey, type Ref, type ShallowRef } from 'vue'
import type { AppState } from '../types'
import { BETRIEB_ANNAHMEN } from '../betrieb/annahmen'
import { SICHT_FASSUNG, sichtOeffentlich, sichtZuschauer } from '../betrieb/sicht'
import { ABLAGE, beendeRaum, hostAblage, legeRaumAn, type Ablage } from './ablage'
import { oeffneFensterbus, type Befehl, type BusUmgebung, type Fensterbus, type VerbindungsMeldung } from './fensterbus'
import { waehleFuehrung, type Fuehrung, type FuehrungsUmgebung } from './fuehrung'
import { normalisiereServer, NTFY_VORGABE } from './themen'
import { packeLesePaket } from './paket'
import { fingerabdruck, lesePaket, type HostRaum } from './transport/ntfy/raum'
import { HostTransport } from './transport/ntfy/transport'
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
  /** Uhr für die Sendezeit `hz` (Tests). */
  uhr?: () => number
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

/** Nur das, was der Host liest und was eine Änderung auslöst. */
export interface HostStore {
  state: Readonly<Ref<AppState>>
}

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
}

function vorgabeAblage(): Ablage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage
  } catch {
    return null
  }
}

function raumInfo(raum: HostRaum): RaumInfo | null {
  try {
    return {
      server: raum.server,
      anzeige: packeLesePaket(lesePaket(raum, 'a')),
      zuschauer: packeLesePaket(lesePaket(raum, 'z')),
      fingerabdruck: fingerabdruck(raum.sign.pk),
    }
  } catch {
    return null
  }
}

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
    const a: Aktiv = { kennung: k, bus, fuehrung: null, scope: effectScope(true), transport: null, leitung: null, timer: null, letzte: '', endet: false, wegBefehl: () => {} }
    aktiv = a
    a.wegBefehl = bus.beimBefehl((befehl) => {
      if (aktiv === a && a.fuehrung?.fuehrt.value) void fuehreAus(a, befehl)
    })
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
  }

  /** Nicht mehr führend (oder Raum zu): Transport anhalten. Ein neues Führungsfenster beginnt mit Vollständen. */
  function gibAb(a: Aktiv): void {
    if (a.timer) clearTimeout(a.timer)
    a.timer = null
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

  async function fuehreAus(a: Aktiv, befehl: Befehl): Promise<RaumEnde> {
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
