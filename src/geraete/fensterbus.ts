import { istGeraeteTyp, type GeraeteTyp } from './transport/protokoll'
import { ref, shallowRef, type Ref } from 'vue'
import { ABLAGE, type Ablage } from './ablage'
import { neueFensterId } from './fuehrung'
import { istHinweis, liesGeraeteNachricht, type Ergebnis, type GeraeteAction, type Hinweis } from './transport/protokoll'
import { liesListe } from '../wkr/liste'
import { liesAufgaben, type Aufgabe } from './aufgaben'
import type { Fehlercode, TransportFehler, Verbindungsstand } from './transport/typen'

/**
 * Fensterbus: die Fenster EINES Bedienrechners untereinander (Plan vom 16.11.2026, §2 und §5 „Schreibfenster“,
 * Kritik K27). Nichts davon geht ins Netz.
 *
 * Das Führungsfenster (fuehrung.ts) nimmt Geräte-Actions an, prüft Rechte und Nummer – angewandt wird aber im
 * **Schreibfenster**, dem zuletzt bedienten Fenster: Ein Mensch bedient ohnehin eines zur Zeit, so bleibt es bei
 * einem Schreiber. Würde das Führungsfenster selbst anwenden, während im Erfassungsfenster getippt wird, schrieben
 * zwei Fenster denselben Stand (localStorage ist zwischen Prozessen nicht atomar), und eine Eingabe ginge verloren.
 * Antwortet das Schreibfenster nicht binnen {@link WEITERREICHEN_MS}, wendet das Führungsfenster selbst an (Plan §5);
 * die Actions sind bedingt oder idempotent (K30), ein spät doch noch angewandtes Doppel bewirkt nichts.
 *
 * Außerdem meldet das Führungsfenster seinen Verbindungsstand, damit jedes Fenster ihn zeigen kann, und nimmt Befehle
 * der übrigen an (E6: „Zuschauer-Link erneuern“, „Raum beenden“) – den Raum schreibt nur das Führungsfenster.
 *
 * Getragen wird jede Nachricht auf zwei Wegen, wie im Prototyp (tafel transport/local.ts): **BroadcastChannel**
 * `alcatraz-fenster` und der **storage-Schlüssel** {@link ABLAGE.fensterbus} – BroadcastChannel fehlt in manchen
 * Umgebungen oder trägt unter file:// je nach Browser nicht (Befund „file://“). Jede Nachricht hat eine Kennung,
 * Doppelte werden verworfen. Der zuletzt geschriebene Text bleibt im localStorage stehen; er enthält nichts, was
 * nicht ohnehin im Stand dieses Rechners liegt.
 *
 * Alle Fenster derselben Herkunft gelten als vertrauenswürdig: Wer dort Skript ausführt, könnte ebenso gut den Stand
 * selbst schreiben. Geprüft wird nur die Form.
 */

export const FENSTERBUS_KANAL = 'alcatraz-fenster'
/** So lange wartet das Führungsfenster auf das Schreibfenster, dann wendet es selbst an (Plan §5). */
export const WEITERREICHEN_MS = 1000
/** „Ich wurde bedient“ höchstens so oft wiederholen, solange kein anderes Fenster dazwischen bedient wurde. */
export const BEDIENT_ABSTAND_MS = 2000

/** Was das Schreibfenster zurückmeldet. Abgelehnt wird vorher, im Führungsfenster (`darf`, E7). */
export type Anwendung = Extract<Ergebnis, 'angewandt' | 'unveraendert'>

/**
 * Befehle an das Führungsfenster (E6, geraete/host.ts): Nur es hält den HostTransport und schreibt den Raum – ein
 * anderes Fenster schriebe sonst neben ihm (Nummern doppelt, Thema zurückgedreht).
 */
export const BEFEHLE = ['zuschauer-erneuern', 'raum-beenden', 'alle-neu-laden'] as const
/**
 * E7 (20.11.2026): Befehle mit Angaben – Koppeln, Rechte ändern, Entzug. Auch sie schreibt nur das Führungsfenster in den
 * Raum (Register, Koppel-Stand); die Oberfläche kann in jedem Fenster stehen.
 */
export type GeraeteBefehl =
  | { art: 'code'; aufgaben: Aufgabe[] }
  | { art: 'qr'; aufgaben: Aufgabe[] }
  | { art: 'koppeln-ende'; was: 'code' | 'qr' | 'alle' }
  | { art: 'aufgaben'; id: string; aufgaben: Aufgabe[] }
  | { art: 'umbenennen'; id: string; name: string }
  /** Art des Geräts ändern (Nutzer 21.11.2026, W3-25, GF7) – das Gerät meldet sie beim Koppeln, der Bediener korrigiert. */
  | { art: 'typ'; id: string; typ: GeraeteTyp }
  | { art: 'entziehen'; id: string }
  /**
   * W1 (21.11.2026): Hinweis an die Geräte einer Liste (Rückkanal, nur Code und Startnummer). `teil` (Prüfbefund
   * 21.11.2026, F16): am Steg nur an die Geräte dieses Teils und die ohne Teil.
   */
  | { art: 'hinweis'; liste: string; code: Hinweis; startNr?: string; teil?: 'ab' | 'an' }
  /** Auto-Modus anhalten (Nutzer 21.11.2026, P-03, AM7) – den Countdown hält nur das Führungsfenster. */
  | { art: 'auto-halt'; bereich: string; ref: string }
export type Befehl = (typeof BEFEHLE)[number] | GeraeteBefehl

/** Prüft einen Befehl aus einem anderen Fenster (nur die Form – es ist derselbe Ursprung). */
export function liesBefehl(wert: unknown): Befehl | null {
  if ((BEFEHLE as readonly unknown[]).includes(wert)) return wert as Befehl
  if (!istObjekt(wert)) return null
  switch (wert.art) {
    case 'code':
    case 'qr':
      return Array.isArray(wert.aufgaben) ? { art: wert.art, aufgaben: liesAufgaben(wert.aufgaben) } : null
    case 'koppeln-ende':
      return wert.was === 'code' || wert.was === 'qr' || wert.was === 'alle' ? { art: 'koppeln-ende', was: wert.was } : null
    case 'aufgaben':
      return istKennung(wert.id) && Array.isArray(wert.aufgaben) ? { art: 'aufgaben', id: wert.id, aufgaben: liesAufgaben(wert.aufgaben) } : null
    case 'umbenennen':
      return istKennung(wert.id) && typeof wert.name === 'string' && wert.name.length <= 60 ? { art: 'umbenennen', id: wert.id, name: wert.name } : null
    case 'typ':
      return istKennung(wert.id) && istGeraeteTyp(wert.typ) ? { art: 'typ', id: wert.id, typ: wert.typ } : null
    case 'entziehen':
      return istKennung(wert.id) ? { art: 'entziehen', id: wert.id } : null
    case 'hinweis':
      if (typeof wert.liste !== 'string' || !liesListe(wert.liste) || !istHinweis(wert.code)) return null
      if (wert.startNr !== undefined && (typeof wert.startNr !== 'string' || wert.startNr.length > 16)) return null
      if (wert.teil !== undefined && wert.teil !== 'ab' && wert.teil !== 'an') return null
      return { art: 'hinweis', liste: wert.liste, code: wert.code, ...(wert.startNr !== undefined ? { startNr: wert.startNr } : {}), ...(wert.teil !== undefined ? { teil: wert.teil } : {}) }
    case 'auto-halt':
      return istKennung(wert.bereich) && typeof wert.ref === 'string' && wert.ref.length <= 400 ? { art: 'auto-halt', bereich: wert.bereich, ref: wert.ref } : null
    default:
      return null
  }
}

export interface VerbindungsMeldung {
  status: Verbindungsstand
  fehler: TransportFehler | null
}

/**
 * Laufende Countdowns des Auto-Modus je Bereich (Start, der weiterschaltet; `bis` nach Date.now – alle Fenster laufen
 * auf demselben Rechner). Prüfbefund 21.11.2026: Nur das Führungsfenster zählt; ohne diese Meldung sah ein zweites
 * Bedienfenster weder Countdown noch „Anhalten“, während das erste nach 3 s weiterschaltete.
 */
export type AutoMeldung = Record<string, { ref: string; bis: number }>
/** Höchstens so viele Bereiche in einer Auto-Meldung (Form-Prüfung; Parcours + Parallelslalom sind wenige). */
const AUTO_BEREICHE_MAX = 32

type BusNachricht =
  /** Ein neues Fenster fragt: Wer wurde zuletzt bedient, wie steht die Verbindung? */
  | { art: 'frage' }
  | { art: 'bedient'; um: number }
  | { art: 'weg' }
  | { art: 'anwenden'; an: string; auftrag: string; action: GeraeteAction }
  | { art: 'angewandt'; an: string; auftrag: string; ergebnis: Anwendung }
  | { art: 'verbindung'; meldung: VerbindungsMeldung | null }
  | { art: 'auto'; auto: AutoMeldung }
  | { art: 'befehl'; befehl: Befehl }

interface Umschlag {
  /** Kennung der Nachricht – gegen Doppelte über beide Wege. */
  k: string
  von: string
  n: BusNachricht
}

/** Was von BroadcastChannel gebraucht wird – in Tests nachgebaut. */
export interface Kanal {
  onmessage: ((e: MessageEvent) => void) | null
  postMessage(daten: unknown): void
  close(): void
}

export interface BusUmgebung {
  /** Vorgabe: `new BroadcastChannel(name)`; `null` = gibt es nicht. */
  kanal?: ((name: string) => Kanal) | null
  /** Rückfall über das storage-Ereignis; Vorgabe localStorage. */
  ablage?: Ablage | null
  /** Bekommt die storage-Ereignisse und `pagehide`; Vorgabe `window`. */
  fenster?: Pick<EventTarget, 'addEventListener' | 'removeEventListener'> | null
  uhr?: () => number
  weiterreichenMs?: number
}

export interface Fensterbus {
  readonly id: string
  /** Das zuletzt bediente Fenster – dorthin gehen Geräte-Actions. `null`: keines bekannt, das Führungsfenster wendet an. */
  readonly schreibfenster: Ref<string | null>
  /** Verbindungsstand, wie das Führungsfenster ihn meldet (im Führungsfenster der eigene). */
  readonly verbindung: Ref<VerbindungsMeldung | null>
  /** Bei jeder eigenen Bedienung rufen (Eingabe, Klick); schickt nicht bei jedem Tastendruck eine Nachricht. */
  bedient(): void
  /** Nur das Führungsfenster: Verbindungsstand für alle; `null`, wenn es nicht mehr führt. */
  meldeVerbindung(meldung: VerbindungsMeldung | null): void
  /** Countdowns des Auto-Modus, wie das Führungsfenster sie meldet (dort die eigenen); `{}` = keiner. */
  readonly auto: Ref<AutoMeldung>
  /** Nur das Führungsfenster: Countdowns für alle; `null` = meldet nicht mehr (schickt nur, wenn es vorher gemeldet hat). */
  meldeAuto(auto: AutoMeldung | null): void
  /** Nur Fenster mit vollem Store: wendet eine weitergereichte Action an (dispatch) und sagt, ob sie wirkte. */
  beimAnwenden(fn: (action: GeraeteAction) => Anwendung): () => void
  /**
   * Nur das Führungsfenster: Action an das Schreibfenster; ist es dieses Fenster, keines bekannt oder antwortet es
   * nicht rechtzeitig, `selbst`. Erst danach die Quittung an das Gerät (HostTransport.quittiere).
   */
  reicheWeiter(action: GeraeteAction, selbst: (action: GeraeteAction) => Anwendung): Promise<Anwendung>
  /** Ein Befehl an die anderen Fenster; ausführen tut ihn nur das Führungsfenster (dessen `beimBefehl`). */
  befiehl(befehl: Befehl): void
  /** Befehle anderer Fenster; der Aufrufer prüft, ob er führt. */
  beimBefehl(fn: (befehl: Befehl) => void): () => void
  schliesse(): void
}

// Vollständig, weil als Record über die Typen: Ein neuer Code oder Stand fällt hier beim Übersetzen auf.
const FEHLERCODES: Record<Fehlercode, true> = {
  'browser-zu-alt': true,
  'server-ungueltig': true,
  'raum-fehlt': true,
  'raum-anderer-server': true,
  'link-ungueltig': true,
  'verbindung-gestoert': true,
  'zu-viele-anfragen': true,
  abgewiesen: true,
  'zu-gross': true,
  fassung: true,
  'ablage-voll': true,
}
const STAENDE: Record<Verbindungsstand, true> = { aus: true, verbinde: true, verbunden: true, 'neu-verbinden': true, fehler: true }

const istObjekt = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)
const istKennung = (v: unknown): v is string => typeof v === 'string' && v.length > 0 && v.length <= 64

function liesAuto(wert: unknown): AutoMeldung | null {
  if (!istObjekt(wert)) return null
  const eintraege = Object.entries(wert)
  if (eintraege.length > AUTO_BEREICHE_MAX) return null
  const out: AutoMeldung = {}
  for (const [bereich, l] of eintraege) {
    if (!istKennung(bereich) || !istObjekt(l) || typeof l.ref !== 'string' || l.ref.length > 500) return null
    if (typeof l.bis !== 'number' || !Number.isFinite(l.bis)) return null
    out[bereich] = { ref: l.ref, bis: l.bis }
  }
  return out
}

function liesMeldung(wert: unknown): VerbindungsMeldung | null | undefined {
  if (wert === null) return null
  if (!istObjekt(wert) || typeof wert.status !== 'string' || !Object.hasOwn(STAENDE, wert.status)) return undefined
  const f = wert.fehler
  if (f === null) return { status: wert.status as Verbindungsstand, fehler: null }
  if (!istObjekt(f) || typeof f.code !== 'string' || !Object.hasOwn(FEHLERCODES, f.code)) return undefined
  const fehler: TransportFehler = { code: f.code as Fehlercode }
  if (typeof f.status === 'number' && Number.isInteger(f.status)) fehler.status = f.status
  return { status: wert.status as Verbindungsstand, fehler }
}

/** Prüft eine Nachricht eines anderen Fensters; `null`, wenn sie nicht passt. */
function liesUmschlag(roh: unknown): Umschlag | null {
  if (typeof roh !== 'string' || roh.length > 64 * 1024) return null
  let wert: unknown
  try {
    wert = JSON.parse(roh)
  } catch {
    return null
  }
  if (!istObjekt(wert) || !istKennung(wert.k) || !istKennung(wert.von) || !istObjekt(wert.n)) return null
  const n = wert.n
  const kopf = { k: wert.k, von: wert.von }
  switch (n.art) {
    case 'frage':
    case 'weg':
      return { ...kopf, n: { art: n.art } }
    case 'bedient':
      return typeof n.um === 'number' && Number.isFinite(n.um) ? { ...kopf, n: { art: 'bedient', um: n.um } } : null
    case 'anwenden': {
      if (!istKennung(n.an) || !istKennung(n.auftrag)) return null
      // Dieselbe Prüfung wie von der Leitung: Form der Action, ohne `zeit` (die stempelt das Schreibfenster).
      const gelesen = liesGeraeteNachricht({ art: 'action', action: n.action })
      if (gelesen?.art !== 'action') return null
      return { ...kopf, n: { art: 'anwenden', an: n.an, auftrag: n.auftrag, action: gelesen.action } }
    }
    case 'angewandt':
      if (!istKennung(n.an) || !istKennung(n.auftrag) || (n.ergebnis !== 'angewandt' && n.ergebnis !== 'unveraendert')) return null
      return { ...kopf, n: { art: 'angewandt', an: n.an, auftrag: n.auftrag, ergebnis: n.ergebnis } }
    case 'verbindung': {
      const meldung = liesMeldung(n.meldung)
      return meldung === undefined ? null : { ...kopf, n: { art: 'verbindung', meldung } }
    }
    case 'auto': {
      const auto = liesAuto(n.auto)
      return auto ? { ...kopf, n: { art: 'auto', auto } } : null
    }
    case 'befehl': {
      const befehl = liesBefehl(n.befehl)
      return befehl ? { ...kopf, n: { art: 'befehl', befehl } } : null
    }
    default:
      return null
  }
}

function vorgabeKanal(): ((name: string) => Kanal) | null {
  return typeof BroadcastChannel === 'undefined' ? null : (name) => new BroadcastChannel(name)
}

function vorgabeAblage(): Ablage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage
  } catch {
    return null
  }
}

/** So viele Kennungen gesehener Nachrichten merken (gegen Doppelte über beide Wege). */
const GESEHEN_GRENZE = 200

export function oeffneFensterbus(id: string = neueFensterId(), umgebung: BusUmgebung = {}): Fensterbus {
  const fabrik = umgebung.kanal === undefined ? vorgabeKanal() : umgebung.kanal
  const ablage = umgebung.ablage === undefined ? vorgabeAblage() : umgebung.ablage
  const fenster = umgebung.fenster === undefined ? (typeof window === 'undefined' ? null : window) : umgebung.fenster
  const uhr = umgebung.uhr ?? (() => Date.now())
  const weiterreichenMs = umgebung.weiterreichenMs ?? WEITERREICHEN_MS

  const schreibfenster = ref<string | null>(null)
  const verbindung = ref<VerbindungsMeldung | null>(null)
  /** Zeitpunkt der Bedienung, die `schreibfenster` bestimmt: Die spätere gewinnt, auch wenn Meldungen sich kreuzen. */
  let schreibUm = Number.NEGATIVE_INFINITY
  let zuletztGemeldet = Number.NEGATIVE_INFINITY
  /** Welches Fenster den Verbindungsstand gemeldet hat – geht es, ist der Stand weg. */
  let verbindungVon: string | null = null
  let eigeneMeldung: VerbindungsMeldung | null = null
  const auto = shallowRef<AutoMeldung>({})
  /** Welches Fenster die Countdowns gemeldet hat – geht es, sind sie weg. */
  let autoVon: string | null = null
  let eigeneAuto: AutoMeldung | null = null
  let anwender: ((action: GeraeteAction) => Anwendung) | null = null
  const befehlsEmpfaenger = new Set<(befehl: Befehl) => void>()
  const offen = new Map<string, { erfuelle: (e: Anwendung) => void; zeitgeber: ReturnType<typeof setTimeout> }>()
  const gesehen: string[] = []
  const gesehenSet = new Set<string>()
  let geschlossen = false

  const merke = (k: string) => {
    gesehen.push(k)
    gesehenSet.add(k)
    while (gesehen.length > GESEHEN_GRENZE) gesehenSet.delete(gesehen.shift()!)
  }

  const sende = (n: BusNachricht) => {
    if (geschlossen) return
    const umschlag: Umschlag = { k: neueFensterId(), von: id, n }
    const text = JSON.stringify(umschlag)
    merke(umschlag.k)
    try {
      kanal?.postMessage(text)
    } catch {
      // Kanal zu – der storage-Schlüssel bleibt.
    }
    try {
      // Der Wechsel des Werts löst das storage-Ereignis in den anderen Fenstern aus (nicht in diesem).
      ablage?.setItem(ABLAGE.fensterbus, text)
    } catch {
      // Kein Speicher – dann trägt nur der Kanal.
    }
  }

  const uebernimmBedient = (von: string, um: number) => {
    // Gleichstand (dieselbe Millisekunde) nach Kennung: Alle Fenster entscheiden gleich.
    if (um < schreibUm || (um === schreibUm && schreibfenster.value !== null && von < schreibfenster.value)) return
    schreibfenster.value = von
    schreibUm = um
  }

  const empfange = (roh: unknown) => {
    if (geschlossen) return
    const u = liesUmschlag(roh)
    if (!u || u.von === id || gesehenSet.has(u.k)) return
    merke(u.k)
    const n = u.n
    switch (n.art) {
      case 'frage':
        if (schreibfenster.value === id) sende({ art: 'bedient', um: schreibUm })
        if (eigeneMeldung) sende({ art: 'verbindung', meldung: eigeneMeldung })
        if (eigeneAuto) sende({ art: 'auto', auto: eigeneAuto })
        return
      case 'bedient':
        uebernimmBedient(u.von, n.um)
        return
      case 'weg':
        if (schreibfenster.value === u.von) schreibfenster.value = null
        if (verbindungVon === u.von) {
          verbindung.value = null
          verbindungVon = null
        }
        if (autoVon === u.von) {
          auto.value = {}
          autoVon = null
        }
        return
      case 'anwenden': {
        if (n.an !== id || !anwender) return
        let ergebnis: Anwendung
        try {
          ergebnis = anwender(n.action)
        } catch {
          // Keine Antwort: Das Führungsfenster wendet nach der Wartezeit selbst an.
          return
        }
        sende({ art: 'angewandt', an: u.von, auftrag: n.auftrag, ergebnis })
        return
      }
      case 'angewandt': {
        const warte = n.an === id ? offen.get(n.auftrag) : undefined
        if (!warte) return
        offen.delete(n.auftrag)
        clearTimeout(warte.zeitgeber)
        warte.erfuelle(n.ergebnis)
        return
      }
      case 'verbindung':
        verbindung.value = n.meldung
        verbindungVon = n.meldung ? u.von : null
        return
      case 'auto':
        auto.value = n.auto
        autoVon = u.von
        return
      case 'befehl':
        for (const fn of [...befehlsEmpfaenger]) fn(n.befehl)
        return
    }
  }

  let kanal: Kanal | null = null
  try {
    kanal = fabrik ? fabrik(FENSTERBUS_KANAL) : null
    if (kanal) kanal.onmessage = (e) => empfange(e.data)
  } catch {
    kanal = null
  }

  const beiSpeicher = (e: Event) => {
    const ereignis = e as StorageEvent
    if (ereignis.key === ABLAGE.fensterbus && ereignis.newValue) empfange(ereignis.newValue)
  }
  const beimVerlassen = () => sende({ art: 'weg' })
  fenster?.addEventListener('storage', beiSpeicher)
  fenster?.addEventListener('pagehide', beimVerlassen)

  const bus: Fensterbus = {
    id,
    schreibfenster,
    verbindung,
    bedient() {
      const jetzt = uhr()
      const schonIch = schreibfenster.value === id
      schreibfenster.value = id
      schreibUm = jetzt
      // Wiederholt, falls ein Führungsfenster dieses inzwischen für stumm hielt (Wartezeit abgelaufen).
      if (schonIch && jetzt - zuletztGemeldet < BEDIENT_ABSTAND_MS) return
      zuletztGemeldet = jetzt
      sende({ art: 'bedient', um: jetzt })
    },
    meldeVerbindung(meldung) {
      eigeneMeldung = meldung
      verbindung.value = meldung
      verbindungVon = meldung ? id : null
      sende({ art: 'verbindung', meldung })
    },
    auto,
    meldeAuto(werte) {
      if (werte === null && eigeneAuto === null) return
      eigeneAuto = werte
      auto.value = werte ?? {}
      autoVon = werte ? id : null
      sende({ art: 'auto', auto: werte ?? {} })
    },
    beimAnwenden(fn) {
      anwender = fn
      return () => {
        if (anwender === fn) anwender = null
      }
    },
    reicheWeiter(action, selbst) {
      const ziel = schreibfenster.value
      if (!ziel || ziel === id || geschlossen) return Promise.resolve(selbst(action))
      const auftrag = neueFensterId()
      return new Promise<Anwendung>((erfuelle) => {
        const zeitgeber = setTimeout(() => {
          offen.delete(auftrag)
          // Das Schreibfenster antwortet nicht (ohne Abmeldung geschlossen, eingefroren, ohne Store): Bis wieder ein
          // Fenster bedient wird, wendet dieses selbst an – sonst wartete jede Action erneut.
          if (schreibfenster.value === ziel) schreibfenster.value = null
          erfuelle(selbst(action))
        }, weiterreichenMs)
        offen.set(auftrag, { erfuelle, zeitgeber })
        sende({ art: 'anwenden', an: ziel, auftrag, action })
      })
    },
    befiehl(befehl) {
      sende({ art: 'befehl', befehl })
    },
    beimBefehl(fn) {
      befehlsEmpfaenger.add(fn)
      return () => befehlsEmpfaenger.delete(fn)
    },
    schliesse() {
      if (geschlossen) return
      sende({ art: 'weg' })
      geschlossen = true
      for (const w of offen.values()) clearTimeout(w.zeitgeber)
      offen.clear()
      fenster?.removeEventListener('storage', beiSpeicher)
      fenster?.removeEventListener('pagehide', beimVerlassen)
      try {
        kanal?.close()
      } catch {
        // schon zu
      }
      kanal = null
    },
  }

  // Ein neues Fenster weiß noch nichts – die anderen antworten mit dem, was sie selbst wissen.
  sende({ art: 'frage' })
  return bus
}
