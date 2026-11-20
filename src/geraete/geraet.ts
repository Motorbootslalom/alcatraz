import { ref, shallowRef, watch, type Ref, type ShallowRef } from 'vue'
import type { OeffentlicheSicht, ZuschauerSicht } from '../types'
import { SICHT_FASSUNG } from '../betrieb/sicht'
import { ABLAGE, geraetAblage, pruefeRaum, SICHT_GUELTIG_MS, sichtAblage, verlasseRaum, type Ablage, type RaumBezug } from './ablage'
import { liesLeseLink, PAKET_FASSUNG } from './paket'
import { fingerabdruck, type LesePaket } from './transport/ntfy/raum'
import { lesegeraet, type GeraetTransport } from './transport/ntfy/transport'
import type { NtfyZeiten } from './transport/ntfy/leitung'
import { PROTOKOLL_FASSUNG } from './transport/protokoll'
import type { TransportFehler, Verbindungsstand } from './transport/typen'

/**
 * Ein fremdes Gerät mit einem Lese-Link (Etappe E6, Plan vom 16.11.2026 §3/§4; Adresse `#/sehen/<paket>`): zeigt die
 * Anzeigetafel oder die Zuschauerliste – dieselben Komponenten wie am Bedienrechner (AnzeigeTafel, ZuschauerListe),
 * gefüttert mit der empfangenen Sicht statt mit `sichtOeffentlich(state)`. Ohne Store: Ein Gerät berührt
 * `alcatraz:state:v1` nie, es kennt nur Sicht, Verbindung und seine Ablage (geraete/ablage.ts).
 *
 * - Einstieg per Abfrage (`since`), dann Abo (transport.ts `lesegeraet`). Nach dem Neuladen steht sofort die abgelegte
 *   Sicht da (gilt 36 h nach der letzten Nachricht, K20), dann folgt der neueste Stand.
 * - Uhrversatz zum Host aus `hz` (Sendezeit des Hosts): „seit“ und „ca. in“ rechnet das Gerät mit seiner Uhr plus
 *   Versatz ({@link LeseGeraet.hostZeit}); die Sicht selbst ist zeitunabhängig (K28).
 * - Fassung (F7, Entscheidung des Nutzers vom 16.11.2026: Gerätebetrieb nur bei gleicher Fassung): Ist der Host
 *   neuer, lädt das Gerät gezielt neu (`aktualisiere`, einmal je Fassung in {@link NEULADEN_SPERRE_MS}); ist er älter,
 *   zeigt es „Bedienrechner aktualisieren“ ({@link LeseGeraet.fassung}). Sonst lädt es nie von selbst neu.
 * - Signiertes „Raum beendet“ und „Raum verlassen“ löschen Verbindung und Sicht auf dem Gerät (K20).
 */

/** Was das Gerät anzeigt: Anzeigetafel-Link (`a`) bzw. Zuschauer-Link (`z`). */
export type LeseArt = 'anzeige' | 'zuschauer'

/** Fassung des Hosts, wenn sie nicht passt (F7). */
export type FassungsLage = 'host-neuer' | 'host-aelter'

/** So lange nach einem gezielten Neuladen für dieselbe Fassung kein zweites – sonst eine Schleife ohne neues Programm. */
export const NEULADEN_SPERRE_MS = 10 * 60_000

/** Beobachtungen des Uhrversatzes, über die das Größte zählt (das mit der kürzesten Laufzeit). */
const VERSATZ_FENSTER = 20

export interface LeseUmgebung {
  /** Vorgabe localStorage. */
  ablage?: Ablage | null
  zeiten?: Partial<NtfyZeiten>
  /** Uhr des Geräts (Tests). */
  uhr?: () => number
  /**
   * Der Host spricht eine neuere Fassung: das Programm erneuern und neu laden (die Oberfläche: Offline-Speicher fragen,
   * dann `location.reload()`). Ohne: nur {@link LeseGeraet.fassung}.
   */
  aktualisiere?: () => void
  /** Wie oft geprüft wird, ob die Sicht abgelaufen ist. */
  ablaufTaktMs?: number
}

export interface LeseGeraet {
  readonly art: LeseArt
  readonly paket: LesePaket
  /** Kurz-Fingerabdruck des Hosts – derselbe wie am Bedienrechner unter Betrieb → Geräte (Plan §8). */
  readonly fingerabdruck: string
  /** Sicht der Anzeigetafel (nur beim Anzeigetafel-Link), nach Inhalt stabilisiert; `null` = noch keine/abgelaufen. */
  readonly anzeige: Readonly<ShallowRef<OeffentlicheSicht | null>>
  /** Sicht der Zuschauerliste (nur beim Zuschauer-Link). */
  readonly zuschauer: Readonly<ShallowRef<ZuschauerSicht | null>>
  /** Uhr des Hosts minus Uhr des Geräts in ms (0, bis frisch etwas kam). */
  readonly versatz: Readonly<Ref<number>>
  readonly status: Readonly<Ref<Verbindungsstand>>
  readonly fehler: Readonly<Ref<TransportFehler | null>>
  readonly fassung: Readonly<Ref<FassungsLage | null>>
  /** Signiertes „Raum beendet“ kam: Sicht und Verbindung sind gelöscht, nichts verbindet mehr. */
  readonly beendet: Readonly<Ref<boolean>>
  /** Zeit des Hosts: eigene Uhr plus Versatz – für StartListe/ZuschauerListe `jetzt`. */
  hostZeit(jetzt?: number): number
  start(): Promise<void>
  stop(): void
  /** „Raum verlassen“: nichts mehr empfangen, Verbindung und Sicht auf diesem Gerät löschen. */
  verlasse(): void
}

export type LeseStart =
  | { ok: true; geraet: LeseGeraet }
  | { ok: false; code: 'link-ungueltig' }
  /** Paket einer anderen Fassung: neuer → `aktualisiere` wurde gerufen (einmal), älter → Bedienrechner aktualisieren. */
  | { ok: false; code: 'fassung'; lage: FassungsLage }

const istObjekt = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)

/**
 * Taugt eine Sicht für die Komponenten? Sie kommt signiert vom Host, also nur eine Formprüfung gegen Programmfehler –
 * die Fassung (`sv`) muss genau passen (F7).
 */
function istSicht(wert: unknown, art: LeseArt): boolean {
  if (!istObjekt(wert) || wert.sv !== SICHT_FASSUNG || typeof wert.kopf !== 'string' || typeof wert.sprache !== 'string') return false
  if (!Array.isArray(wert.bereiche) || !istObjekt(wert.starter) || !istObjekt(wert.klassen) || !istObjekt(wert.einst)) return false
  return art === 'zuschauer' || Array.isArray(wert.auswahl)
}

function vorgabeAblage(): Ablage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage
  } catch {
    return null
  }
}

/** Ruft `aktualisiere` höchstens einmal je Fassung in {@link NEULADEN_SPERRE_MS} (Merker gerätelokal, ABLAGE.aktualisiert). */
function aktualisiereEinmal(ziel: string, umgebung: LeseUmgebung, ablage: Ablage | null, uhr: () => number): void {
  if (!umgebung.aktualisiere) return
  try {
    const roh = ablage?.getItem(ABLAGE.aktualisiert)
    const zuletzt: unknown = roh ? JSON.parse(roh) : null
    if (istObjekt(zuletzt) && zuletzt.ziel === ziel && typeof zuletzt.um === 'number' && uhr() - zuletzt.um < NEULADEN_SPERRE_MS) return
    ablage?.setItem(ABLAGE.aktualisiert, JSON.stringify({ ziel, um: uhr() }))
  } catch {
    // Ohne Speicher kein Merker – dann lieber nicht neu laden als womöglich immer wieder.
    return
  }
  umgebung.aktualisiere()
}

/**
 * Einen Lese-Link öffnen (Text aus `#/sehen/<paket>`). Liest und prüft das Paket, räumt Abgelegtes eines anderen Raums
 * weg und legt das Gerät an – verbunden wird erst mit {@link LeseGeraet.start}.
 */
export function oeffneLeseLink(text: unknown, umgebung: LeseUmgebung = {}): LeseStart {
  const ablage = umgebung.ablage === undefined ? vorgabeAblage() : umgebung.ablage
  const uhr = umgebung.uhr ?? Date.now
  const gelesen = liesLeseLink(text)
  if (!gelesen.ok) {
    if (gelesen.code === 'link-ungueltig') return gelesen
    const lage: FassungsLage = gelesen.fassung > PAKET_FASSUNG ? 'host-neuer' : 'host-aelter'
    if (lage === 'host-neuer') aktualisiereEinmal(`paket:${gelesen.fassung}`, umgebung, ablage, uhr)
    return { ok: false, code: 'fassung', lage }
  }
  return { ok: true, geraet: lesegeraetAus(gelesen.paket, gelesen.welches === 'a' ? 'anzeige' : 'zuschauer', umgebung, ablage, uhr) }
}

/**
 * Der Kern eines Geräts, das eine Sicht zeigt – für den Lese-Link und (E7, geraete/gekoppelt.ts) die gekoppelte
 * Start-Freigabe, die dieselbe öffentliche Sicht liest. `t`: der Transport (Vorgabe: ein Lese-Gerät aus dem Paket).
 */
export function lesegeraetAus(
  paket: LesePaket,
  art: LeseArt,
  umgebung: LeseUmgebung,
  ablage: Ablage | null,
  uhr: () => number,
  t: GeraetTransport = lesegeraet(paket, geraetAblage({ u: paket.u, r: paket.r, s: paket.s }, ablage), SICHT_FASSUNG, umgebung.zeiten, uhr),
): LeseGeraet {
  const bezug: RaumBezug = { u: paket.u, r: paket.r, s: paket.s }
  // Ein anderer Raum (neuer Raum desselben Rechners, anderer Host): dessen Verbindung und Sicht weg (Plan §3).
  pruefeRaum(bezug, ablage)
  const sichten = sichtAblage(bezug, ablage, uhr)
  const anzeige = shallowRef<OeffentlicheSicht | null>(null)
  const zuschauer = shallowRef<ZuschauerSicht | null>(null)
  const versatz = ref(0)
  const fassung = ref<FassungsLage | null>(null)
  const beendet = ref(false)
  let text = ''
  /** Bis wann die zuletzt EMPFANGENE Sicht gilt – auch wenn sie sich nicht ablegen ließ (privates Fenster). */
  let giltBis = 0
  let takt: ReturnType<typeof setInterval> | null = null
  let transport: GeraetTransport | null = null
  const beobachtet: number[] = []

  const setze = (sicht: unknown) => {
    const neu = JSON.stringify(sicht)
    if (neu === text) return
    text = neu
    if (art === 'anzeige') anzeige.value = sicht as OeffentlicheSicht | null
    else zuschauer.value = sicht as ZuschauerSicht | null
  }

  const vergiss = () => {
    sichten.vergiss()
    giltBis = 0
    setze(null)
  }

  // Nach dem Neuladen gleich die abgelegte Sicht – nur derselben Art und Fassung (sonst lieber leer).
  const abgelegt = sichten.lies()
  if (istObjekt(abgelegt) && abgelegt.art === art && istSicht(abgelegt.sicht, art)) setze(abgelegt.sicht)

  transport = t

  t.beiEmpfang((e) => {
    if (e.art !== 'sicht' && e.art !== 'meldung') return
    if (e.gruppe !== paket.g) return
    // Nur Frisches über das Abo zählt für den Versatz: Aus der Abfrage kann ein Vollstand eine Stunde alt sein.
    if (!e.nachgeholt) {
      beobachtet.push(e.hz - uhr())
      if (beobachtet.length > VERSATZ_FENSTER) beobachtet.shift()
      // Laufzeit ist nie negativ: Der größte Wert liegt dem wahren Versatz am nächsten.
      versatz.value = Math.max(...beobachtet)
    }
    if (e.art === 'meldung') {
      if (e.meldung.art === 'ende') beende()
      // „neu laden“ (E8, „Alle Geräte neu laden“) ist noch nicht gebaut; ein Lese-Gerät lädt nur bei neuerer Fassung.
      return
    }
    if (!istSicht(e.sicht, art)) return
    // Logos zeigt nur die Anzeigetafel am Bedienrechner (BETRIEB_ANNAHMEN.logosNurLokal) – auch wenn ein Host sie
    // schickte: Bilder aus fremder Hand gehören nicht auf ein Gerät, das nur einen Link hat.
    const sicht = { ...(e.sicht as Record<string, unknown>) }
    delete sicht.logos
    giltBis = uhr() + SICHT_GUELTIG_MS
    sichten.schreibe({ art, sicht })
    setze(sicht)
  })

  watch(t.fremdeFassung, (f) => {
    if (!f) {
      fassung.value = null
      return
    }
    const neuer = f.v > PROTOKOLL_FASSUNG || (f.v === PROTOKOLL_FASSUNG && f.sv !== null && f.sv > SICHT_FASSUNG)
    fassung.value = neuer ? 'host-neuer' : 'host-aelter'
    if (neuer) aktualisiereEinmal(`v${f.v}:sv${f.sv ?? '-'}`, umgebung, ablage, uhr)
  })

  /** Abgelaufen: Die abgelegte gilt nicht mehr (sichtAblage löscht sie beim Lesen) und empfangen ist auch nichts Jüngeres. */
  const pruefeAblauf = () => {
    if (text === '' || text === 'null') return
    if (uhr() < giltBis) return
    if (sichten.lies() === null) vergiss()
  }

  function halt(): void {
    if (takt) clearInterval(takt)
    takt = null
    transport?.stop()
  }

  function beende(): void {
    halt()
    transport = null
    verlasseRaum(ablage)
    vergiss()
    beendet.value = true
  }

  return {
    art,
    paket,
    fingerabdruck: fingerabdruck(paket.s),
    anzeige,
    zuschauer,
    versatz,
    status: t.status,
    fehler: t.fehler,
    fassung,
    beendet,
    hostZeit: (jetzt = uhr()) => jetzt + versatz.value,
    async start() {
      if (!transport || beendet.value) return
      pruefeAblauf()
      if (!takt) takt = setInterval(pruefeAblauf, umgebung.ablaufTaktMs ?? 60_000)
      await transport.start()
    },
    stop: halt,
    verlasse() {
      halt()
      transport = null
      verlasseRaum(ablage)
      vergiss()
    },
  }
}
