import { reactive } from 'vue'

/**
 * Offline-Speicher für das Programm und die Zusage des Browsers, die Daten zu behalten.
 *
 * Der Speicher selbst ist ein Service Worker (scripts/offline-sw.js, beim Build als `sw.js`
 * geschrieben). Hier steht, was die Seite dazu tut: anmelden, den Stand erfragen und eine neue
 * Fassung erst auf Knopfdruck übernehmen. Nichts lädt von selbst neu.
 *
 * Eine neue Fassung im Einzelnen:
 * 1. Der Browser sieht beim Öffnen oder Neuladen der Seite nach (und bei „Nach neuer Fassung
 *    suchen“). Findet er eine, lädt er sie vollständig in einen eigenen Cache.
 * 2. Sie WARTET. Die laufende Fassung bedient weiter alle Fenster – auch nach Neuladen.
 * 3. Übernommen wird mit `uebernehmen()` (dann lädt dieses Fenster neu) oder vom Browser, sobald
 *    kein Fenster der alten Fassung mehr offen ist; das nächste Öffnen zeigt dann die neue.
 * 4. Andere offene Fenster laden nicht von selbst neu; sie melden `ersetzt`.
 */
export type OfflineLage = 'bereit' | 'vorbereiten' | 'nicht-verfuegbar'
/** Warum es keinen Offline-Speicher gibt. `datei`: Ein-Datei-Fassung von `file://` – sie braucht keinen. */
export type OfflineGrund = 'datei' | 'entwicklung' | 'browser' | 'fehler'
/** Zusage des Browsers, die Daten nicht von sich aus zu löschen. */
export type Dauerhaft = 'unbekannt' | 'ja' | 'nein' | 'nicht-moeglich'

export interface OfflineZustand {
  lage: OfflineLage
  grund?: OfflineGrund
  /** Codestand und Zahl der Dateien im Speicher (vom Service Worker gemeldet). */
  fassung: string
  dateien: number
  /** Die Ein-Datei-Fassung liegt mit im Speicher (auf Pages) und lässt sich herunterladen. */
  eindatei: boolean
  /** Eine neue Fassung liegt vollständig bereit und wartet auf `uebernehmen()`. */
  neu: boolean
  neuFassung: string
  /** Eine neue Fassung wird gerade geladen. */
  laedtNeu: boolean
  /** In einem anderen Fenster wurde übernommen: Dieses läuft noch mit der alten Fassung. */
  ersetzt: boolean
  /** Ergebnis von „Nach neuer Fassung suchen“. */
  suche: '' | 'laeuft' | 'aktuell' | 'neu' | 'kein-netz' | 'fehlgeschlagen'
  dauerhaft: Dauerhaft
  /** Die Zusage wurde gerade von Hand angefragt und abgelehnt. */
  abgelehnt: boolean
}

export const offline = reactive<OfflineZustand>({
  lage: 'vorbereiten',
  fassung: '',
  dateien: 0,
  eindatei: false,
  neu: false,
  neuFassung: '',
  laedtNeu: false,
  ersetzt: false,
  suche: '',
  dauerhaft: 'unbekannt',
  abgelehnt: false,
})

/** Was der Service Worker auf `{ typ: 'stand' }` antwortet. */
export interface SpeicherStand {
  fassung: string
  dateien: number
  fehlend: number
  eindatei?: boolean
}

/**
 * Die Lage aus dem, was bekannt ist. „Bereit“ heißt: Ein aktiver Speicher hat gemeldet, dass
 * keine Datei fehlt – nicht bloß, dass er angemeldet ist.
 */
export function offlineLage(e: {
  protokoll: string
  entwicklung: boolean
  kannSpeicher: boolean
  fehler: boolean
  stand: SpeicherStand | undefined
}): { lage: OfflineLage; grund?: OfflineGrund } {
  if (e.protokoll === 'file:') return { lage: 'nicht-verfuegbar', grund: 'datei' }
  if (e.entwicklung) return { lage: 'nicht-verfuegbar', grund: 'entwicklung' }
  if (!e.kannSpeicher) return { lage: 'nicht-verfuegbar', grund: 'browser' }
  if (e.fehler) return { lage: 'nicht-verfuegbar', grund: 'fehler' }
  return { lage: e.stand && e.stand.fehlend === 0 ? 'bereit' : 'vorbereiten' }
}

// --- Service Worker ---------------------------------------------------------

/** Der Ausschnitt des Browsers, den der Offline-Speicher braucht – in Tests ersetzbar. */
export interface OfflineUmgebung {
  protokoll: string
  entwicklung: boolean
  /** `navigator.serviceWorker`; fehlt im privaten Fenster mancher Browser und ohne https. */
  speicher: ServiceWorkerContainer | undefined
  neuLaden: () => void
  /** Wie lange auf die Antwort des Speichers gewartet wird (ms). */
  geduld?: number
  /** Pausen (ms) vor den erneuten Versuchen, wenn das erste Füllen des Speichers scheitert. */
  pausen?: readonly number[]
}

function browser(): OfflineUmgebung {
  return {
    protokoll: location.protocol,
    entwicklung: import.meta.env.DEV,
    speicher: typeof navigator !== 'undefined' && 'serviceWorker' in navigator ? navigator.serviceWorker : undefined,
    neuLaden: () => location.reload(),
  }
}

/** Fragt einen Service Worker nach seinem Stand; ohne Antwort `undefined`. */
function frage(worker: ServiceWorker | null | undefined, geduld: number): Promise<SpeicherStand | undefined> {
  if (!worker) return Promise.resolve(undefined)
  return new Promise((fertig) => {
    const kanal = new MessageChannel()
    const ende = (stand?: SpeicherStand) => {
      clearTimeout(uhr)
      kanal.port1.close()
      fertig(stand)
    }
    const uhr = setTimeout(() => ende(), geduld)
    kanal.port1.onmessage = (e: MessageEvent) => ende(e.data?.typ === 'stand' ? (e.data as SpeicherStand) : undefined)
    try {
      worker.postMessage({ typ: 'stand' }, [kanal.port2])
    } catch {
      ende()
    }
  })
}

let anmeldung: ServiceWorkerRegistration | undefined
let umgebung: OfflineUmgebung | undefined
let selbstUebernommen = false
/** Meldet den Speicher von Hand neu an (nach einem gescheiterten Füllen oder Anmelden). */
let neuAnmelden: (() => Promise<boolean>) | undefined
let wiederholung: ReturnType<typeof setTimeout> | undefined

/** Meldet den Offline-Speicher an und hält `offline` aktuell. Einmal beim Start der Anwendung. */
export async function starteOffline(u: OfflineUmgebung = browser()): Promise<void> {
  umgebung = u
  anmeldung = undefined
  neuAnmelden = undefined
  selbstUebernommen = false
  clearTimeout(wiederholung)
  Object.assign(offline, { fassung: '', dateien: 0, eindatei: false, neu: false, neuFassung: '', laedtNeu: false, ersetzt: false, suche: '' })
  const geduld = u.geduld ?? 4000
  const pausen = u.pausen ?? [5000, 30000]
  let fehler = false
  let stand: SpeicherStand | undefined
  const setze = () => {
    const { lage, grund } = offlineLage({ protokoll: u.protokoll, entwicklung: u.entwicklung, kannSpeicher: !!u.speicher, fehler, stand })
    offline.lage = lage
    offline.grund = grund
  }
  setze()
  if (offline.lage === 'nicht-verfuegbar') return
  const speicher = u.speicher!

  let reg: ServiceWorkerRegistration | undefined
  // Mehrere Abfragen laufen nebeneinander; nur die jüngste zählt.
  let lauf = 0
  const aktualisiere = async () => {
    const r = reg
    if (!r) return
    const nr = ++lauf
    // Eine wartende Fassung gibt es nur neben einer laufenden; beim ersten Mal wird sofort aktiv.
    offline.neu = !!r.waiting && !!r.active
    offline.laedtNeu = !!r.installing && !!r.active
    const [aktiv, wartend] = await Promise.all([frage(r.active, geduld), offline.neu ? frage(r.waiting, geduld) : undefined])
    if (nr !== lauf) return
    stand = aktiv
    offline.fassung = aktiv?.fassung ?? ''
    offline.dateien = aktiv?.dateien ?? 0
    offline.eindatei = aktiv?.eindatei === true
    offline.neuFassung = wartend?.fassung ?? ''
    setze()
  }

  /**
   * Das erste Füllen ist gescheitert (Verbindung abgerissen, halb veröffentlichter Stand): Der
   * Browser verwirft dann die Anmeldung, und von selbst versucht er es erst beim nächsten Laden
   * der Seite wieder. „Wird vorbereitet“ wäre ab hier gelogen – deshalb wird nach einer Pause
   * neu angemeldet, und wenn auch das nicht hilft, steht ehrlich da, dass es keinen Speicher gibt.
   */
  let versuch = 0
  const gescheitert = () => {
    anmeldung = undefined
    reg = undefined
    stand = undefined
    lauf++
    if (versuch < pausen.length) wiederholung = setTimeout(() => void anmelden(), pausen[versuch++])
    else fehler = true
    setze()
  }

  const beobachtet = new WeakSet<object>()
  const beobachte = (r: ServiceWorkerRegistration, worker: ServiceWorker | null) => {
    if (!worker || beobachtet.has(worker)) return
    beobachtet.add(worker)
    worker.addEventListener('statechange', () => {
      if (r !== reg) return
      // Nur das Fenster, in dem der Knopf gedrückt wurde, lädt neu – und erst, wenn die neue
      // Fassung wirklich läuft (dann ist auch der alte Cache schon aufgeräumt).
      if (worker.state === 'activated' && selbstUebernommen) {
        selbstUebernommen = false
        u.neuLaden()
        return
      }
      // Verworfen, ohne dass eine Fassung läuft, wartet oder lädt: Das erste Füllen ist gescheitert.
      // (Scheitert das Laden einer NEUEN Fassung, läuft die alte weiter – das ist kein Fehler.)
      if (worker.state === 'redundant' && !r.active && !r.waiting && !r.installing) {
        gescheitert()
        return
      }
      void aktualisiere()
    })
  }

  const anmelden = async (): Promise<boolean> => {
    clearTimeout(wiederholung)
    let r: ServiceWorkerRegistration
    try {
      // Relativ zur Seite: unter …/alcatraz/ ebenso wie neben der Ein-Datei-Fassung …/alcatraz.html.
      // `updateViaCache: 'none'`: Die Suche nach einer neuen Fassung geht am Browser-Cache vorbei.
      r = await speicher.register('./sw.js', { updateViaCache: 'none' })
    } catch {
      // Kein Speicher zu haben, ist kein Fehler der Anwendung: Sie läuft wie bisher aus dem Netz.
      anmeldung = undefined
      reg = undefined
      fehler = true
      setze()
      return false
    }
    fehler = false
    reg = r
    anmeldung = r
    beobachte(r, r.installing)
    beobachte(r, r.waiting)
    if (!beobachtet.has(r)) {
      beobachtet.add(r)
      r.addEventListener('updatefound', () => {
        if (r !== reg) return
        beobachte(r, r.installing)
        void aktualisiere()
      })
    }
    await aktualisiere()
    return true
  }
  neuAnmelden = () => {
    versuch = 0
    return anmelden()
  }

  // Wechselt die Fassung, die dieses Fenster bedient, ohne dass hier gedrückt wurde, dann wurde
  // sie in einem anderen Fenster übernommen. Beim allerersten Mal gab es vorher keine.
  let bedient = !!speicher.controller
  speicher.addEventListener('controllerchange', () => {
    if (bedient && !selbstUebernommen) offline.ersetzt = true
    bedient = true
    void aktualisiere()
  })
  // Der Speicher meldet sich von selbst, sobald er verworfene Dateien nachgefüllt hat. Auf einer
  // langsamen Verbindung dauert das länger, als die Abfrage oben wartet – ohne diese Meldung
  // bliebe „wird vorbereitet“ stehen, obwohl längst alles da ist.
  speicher.addEventListener('message', (e) => {
    if ((e as MessageEvent).data?.typ === 'stand') void aktualisiere()
  })

  await anmelden()
}

/** Übernimmt die wartende Fassung und lädt dieses Fenster neu. Die Daten im Browser bleiben. */
export function uebernehmen(): void {
  const wartend = anmeldung?.waiting
  if (!wartend) return
  selbstUebernommen = true
  wartend.postMessage({ typ: 'uebernehmen' })
}

/** Lädt dieses Fenster neu (nachdem in einem anderen Fenster übernommen wurde). */
export function neuLaden(): void {
  umgebung?.neuLaden()
}

/** Sieht jetzt nach einer neuen Fassung, statt auf das nächste Öffnen zu warten. */
export async function sucheNeueFassung(): Promise<void> {
  if (!anmeldung) {
    // Keine gültige Anmeldung (mehr): Der Browser hat sie nach einem gescheiterten ersten Füllen
    // verworfen, oder das Anmelden selbst ging schief. Dann ist „suchen“ ein neuer Versuch –
    // `update()` auf der alten Anmeldung schlüge fehl und sähe aus wie „keine Verbindung“.
    if (!neuAnmelden) return
    offline.suche = 'laeuft'
    offline.suche = (await neuAnmelden()) ? '' : 'fehlgeschlagen'
    return
  }
  offline.suche = 'laeuft'
  try {
    await anmeldung.update()
    offline.suche = anmeldung.installing || anmeldung.waiting ? 'neu' : 'aktuell'
  } catch {
    offline.suche = 'kein-netz'
  }
}

// --- Zusage des Browsers (navigator.storage.persist) --------------------------

/** Wann zuletzt von selbst um die Zusage gebeten wurde – gehört zum Gerät, nicht zur Veranstaltung. */
export const DAUERHAFT_KEY = 'alcatraz:dauerhaft-gefragt'
const TAG = 24 * 60 * 60 * 1000

type Lager = Pick<StorageManager, 'persist' | 'persisted'> | undefined

function lager(): Lager {
  const l = typeof navigator === 'undefined' ? undefined : navigator.storage
  return l && typeof l.persist === 'function' && typeof l.persisted === 'function' ? l : undefined
}

/** Liest nur nach, ob die Zusage besteht – fragt den Nutzer nie. */
export async function leseDauerhaft(l: Lager = lager()): Promise<Dauerhaft> {
  try {
    offline.dauerhaft = !l ? 'nicht-moeglich' : (await l.persisted()) ? 'ja' : 'nein'
  } catch {
    offline.dauerhaft = 'nicht-moeglich'
  }
  return offline.dauerhaft
}

/** Bittet den Browser um die Zusage. Manche Browser fragen dafür den Nutzer, andere entscheiden still. */
export async function bitteDauerhaft(l: Lager = lager(), vonHand = true): Promise<Dauerhaft> {
  try {
    offline.dauerhaft = !l ? 'nicht-moeglich' : (await l.persist()) ? 'ja' : 'nein'
  } catch {
    offline.dauerhaft = 'nicht-moeglich'
  }
  offline.abgelehnt = vonHand && offline.dauerhaft === 'nein'
  return offline.dauerhaft
}

/**
 * Ob die Anwendung von selbst um die Zusage bitten soll:
 * - erst, wenn es etwas zu verlieren gibt (Starter) – eine leere Seite fragt nicht;
 * - nicht, wenn die Zusage besteht, der Browser keine kennt oder der Nutzer sie abgelehnt hat;
 * - höchstens einmal am Tag: Browser, die still entscheiden (Chromium), sagen oft erst nach
 *   einiger Nutzung zu – ein späterer Versuch lohnt. Browser, die fragen (Firefox), sollen
 *   nicht bei jedem Start fragen.
 */
export function darfVonSelbstBitten(e: {
  hatStarter: boolean
  dauerhaft: Dauerhaft
  erlaubnis: PermissionState | undefined
  zuletzt: number | undefined
  jetzt: number
}): boolean {
  if (!e.hatStarter || e.dauerhaft !== 'nein' || e.erlaubnis === 'denied') return false
  return e.zuletzt === undefined || e.jetzt - e.zuletzt >= TAG || e.zuletzt > e.jetzt
}

async function erlaubnis(): Promise<PermissionState | undefined> {
  try {
    return (await navigator.permissions.query({ name: 'persistent-storage' })).state
  } catch {
    return undefined
  }
}

function zuletztGefragt(): number | undefined {
  try {
    const n = Number(localStorage.getItem(DAUERHAFT_KEY))
    return Number.isFinite(n) && n > 0 ? n : undefined
  } catch {
    return undefined
  }
}

/** Liest die Zusage und bittet – wenn es an der Zeit ist – von selbst darum. */
export async function pruefeDauerhaft(hatStarter: boolean, l: Lager = lager(), jetzt: number = Date.now()): Promise<Dauerhaft> {
  const dauerhaft = await leseDauerhaft(l)
  if (!darfVonSelbstBitten({ hatStarter, dauerhaft, erlaubnis: await erlaubnis(), zuletzt: zuletztGefragt(), jetzt })) return dauerhaft
  try {
    localStorage.setItem(DAUERHAFT_KEY, String(jetzt))
  } catch {
    // Lässt sich der Zeitpunkt nicht merken, wird lieber nicht gefragt als bei jedem Start.
    return dauerhaft
  }
  return bitteDauerhaft(l, false)
}
