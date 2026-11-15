import { reactive } from 'vue'

/**
 * Offline-Speicher für das Programm und die Zusage des Browsers, die Daten zu behalten.
 *
 * Der Speicher selbst ist ein Service Worker (scripts/offline-sw.js, beim Build als `sw.js`
 * geschrieben). Hier steht, was die Seite dazu tut: anmelden, den Stand erfragen und eine neue
 * Fassung übernehmen.
 *
 * Ein Wettkampf dauert zwei bis vier Tage, der Rechner wird zwischendurch neu gestartet. Solange
 * Starter oder Ergebnisse im Stand sind, wechselt die Fassung deshalb NIE von selbst:
 * 1. Der Browser sieht beim Öffnen oder Neuladen der Seite nach (und bei „Nach neuer Fassung
 *    suchen“). Findet er eine, lädt er sie vollständig in einen eigenen Cache.
 * 2. Ausgeliefert wird weiter die GÜLTIGE Fassung – ein Zeiger im Offline-Speicher nennt sie. Er
 *    hängt nicht daran, welcher Service Worker läuft: Auch wenn der Browser den neuen aktiviert
 *    (alle Fenster zu, Neustart), bleibt es bei der alten Fassung.
 * 3. Liegt eine andere Fassung vollständig bereit, meldet `offline.neu` das (Knopf „Update“ in
 *    der Kopfzeile). `uebernehmen()` setzt den Zeiger um und lädt dieses Fenster neu.
 * 4. Andere offene Fenster laden nicht von selbst neu; sie melden `ersetzt`.
 * 5. Ist der Stand leer (keine Starter), gibt es nichts zu schützen: Dann übernimmt die Seite
 *    eine bereitliegende Fassung beim Start von selbst (`darfVonSelbst`).
 * Andere Wege zu einer neuen Fassung gibt es nicht – auch keinen Übergang für Fassungen von vor
 * dem Zeiger (Entscheidung des Nutzers vom 15.11.2026: Die Anwendung ist noch in Entwicklung).
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
  /** Zeitpunkt ihres Commits und ihres Builds (ISO); leer, wenn der Speicher sie nicht nennt. */
  neuCommitZeit: string
  neuZeit: string
  /** `uebernehmen()` läuft: Gleich lädt das Fenster neu. */
  uebernimmt: boolean
  /** Eine neue Fassung wird gerade geladen. */
  laedtNeu: boolean
  /** In einem anderen Fenster wurde übernommen: Dieses läuft noch mit der alten Fassung. */
  ersetzt: boolean
  /** Ergebnis von „Nach neuer Fassung suchen“. */
  suche: '' | 'laeuft' | 'aktuell' | 'laedt' | 'neu' | 'unvollstaendig' | 'kein-netz' | 'fehlgeschlagen'
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
  neuCommitZeit: '',
  neuZeit: '',
  uebernimmt: false,
  laedtNeu: false,
  ersetzt: false,
  suche: '',
  dauerhaft: 'unbekannt',
  abgelehnt: false,
})

/** Eine Fassung im Offline-Speicher, wie der Service Worker sie beschreibt. */
export interface FassungStand {
  /** Prüfsumme über die Dateiliste – daran wird eine Fassung erkannt. */
  kennung: string
  fassung: string
  commitZeit?: string
  zeit?: string
  dateien: number
  fehlend: number
  eindatei?: boolean
}

/**
 * Was der Service Worker auf `{ typ: 'stand' }` antwortet: `gueltig` ist die Fassung, die er
 * ausliefert (der Zeiger; fehlt nur, wenn ihre Dateiliste verloren ist), `eigen` seine eigene.
 * Die beiden unterscheiden sich, wenn der Browser einen neuen Service Worker aktiviert hat,
 * während alle Fenster zu waren: Er liefert weiter die alte Fassung aus.
 */
export interface SpeicherStand {
  gueltig?: FassungStand
  eigen: FassungStand
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
  /** Die ausgelieferte Fassung, wie der laufende Speicher sie meldet. */
  stand: FassungStand | undefined
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
  /** Wie lange auf das Umschalten gewartet wird (ms) – der Speicher füllt dabei notfalls nach. */
  geduldWechsel?: number
  /**
   * Wie lange nach dem Start die Seite selbst nach einer neuen Fassung sieht (ms). Der Browser
   * tut das beim Öffnen und Neuladen von sich aus, aber nicht verlässlich sofort (gemessen in
   * Chromium: nach einem eben erst erfolgten Wechsel blieb die Suche über Neuladen und Neustart
   * hinweg aus). Ohne Netz scheitert der Versuch still.
   */
  suchePause?: number
  /**
   * Darf eine bereitliegende Fassung ohne Knopfdruck übernommen werden? Nur, wenn es nichts zu
   * schützen gibt (leerer Stand). `beimStart`: bei der ersten Auskunft des Speichers nach dem
   * Öffnen; später (die Fassung wurde eben erst fertig geladen) fragt die Seite noch einmal.
   * Fehlt die Angabe, wird nie von selbst übernommen.
   */
  darfVonSelbst?: (beimStart: boolean) => boolean
  /** Pausen (ms) vor den erneuten Versuchen, wenn das erste Füllen des Speichers scheitert. */
  pausen?: readonly number[]
}

/** Der Browser, wie er ist – die Anwendung ergänzt, wann von selbst übernommen werden darf (main.ts). */
export function offlineBrowser(): OfflineUmgebung {
  return {
    protokoll: location.protocol,
    entwicklung: import.meta.env.DEV,
    speicher: typeof navigator !== 'undefined' && 'serviceWorker' in navigator ? navigator.serviceWorker : undefined,
    neuLaden: () => location.reload(),
  }
}

/** Schickt einem Service Worker eine Nachricht und wartet auf die Antwort der Art `erwartet`; ohne Antwort `undefined`. */
function sende<T>(worker: ServiceWorker | null | undefined, typ: string, erwartet: string, geduld: number): Promise<T | undefined> {
  if (!worker) return Promise.resolve(undefined)
  return new Promise((fertig) => {
    const kanal = new MessageChannel()
    const ende = (antwort?: T) => {
      clearTimeout(uhr)
      kanal.port1.close()
      fertig(antwort)
    }
    const uhr = setTimeout(() => ende(), geduld)
    kanal.port1.onmessage = (e: MessageEvent) => ende(e.data?.typ === erwartet ? (e.data as T) : undefined)
    try {
      worker.postMessage({ typ }, [kanal.port2])
    } catch {
      ende()
    }
  })
}

/** Fragt einen Service Worker nach seinem Stand; ohne Antwort `undefined`. */
const frage = (worker: ServiceWorker | null | undefined, geduld: number) => sende<SpeicherStand>(worker, 'stand', 'stand', geduld)

/**
 * Liegt eine andere Fassung als die ausgelieferte vollständig bereit? Die jüngste ist immer die
 * des jüngsten Service Workers – des wartenden, sonst des laufenden (der Browser hat ihn
 * aktiviert, während alle Fenster zu waren; ausgeliefert wird trotzdem noch die alte Fassung).
 */
export function neueFassung(aktiv: SpeicherStand | undefined, wartend: SpeicherStand | undefined): FassungStand | undefined {
  const gueltig = aktiv?.gueltig
  if (!aktiv || !gueltig) return undefined
  const juengste = (wartend ?? aktiv).eigen
  // Eine halb geladene (oder vom Browser halb verworfene) Fassung wird nicht angeboten.
  if (juengste.fehlend !== 0 || juengste.kennung === gueltig.kennung) return undefined
  return juengste
}

let anmeldung: ServiceWorkerRegistration | undefined
let umgebung: OfflineUmgebung | undefined
let selbstUebernommen = false
/** Stößt die Abfrage des Speichers neu an (nach einem gescheiterten Umschalten). */
let neuAbfragen: (() => Promise<void>) | undefined
/** Meldet den Speicher von Hand neu an (nach einem gescheiterten Füllen oder Anmelden). */
let neuAnmelden: (() => Promise<boolean>) | undefined
let wiederholung: ReturnType<typeof setTimeout> | undefined

/** Meldet den Offline-Speicher an und hält `offline` aktuell. Einmal beim Start der Anwendung. */
export async function starteOffline(u: OfflineUmgebung = offlineBrowser()): Promise<void> {
  umgebung = u
  anmeldung = undefined
  neuAnmelden = undefined
  neuAbfragen = undefined
  selbstUebernommen = false
  clearTimeout(wiederholung)
  Object.assign(offline, { fassung: '', dateien: 0, eindatei: false, neu: false, neuFassung: '', neuCommitZeit: '', neuZeit: '', uebernimmt: false, laedtNeu: false, ersetzt: false, suche: '' })
  const geduld = u.geduld ?? 4000
  const pausen = u.pausen ?? [5000, 30000]
  let fehler = false
  let stand: FassungStand | undefined
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
  /** Kennung der Fassung, die bei der ersten Auskunft galt – mit ihr wurde dieses Fenster geladen. */
  let geladen: string | undefined
  let ersteAuskunft = true
  const aktualisiere = async () => {
    const r = reg
    if (!r) return
    const nr = ++lauf
    offline.laedtNeu = !!r.installing && !!r.active
    const [aktiv, wartend] = await Promise.all([frage(r.active, geduld), r.active && r.waiting ? frage(r.waiting, geduld) : undefined])
    if (nr !== lauf) return
    const gueltig = aktiv?.gueltig
    stand = gueltig
    offline.fassung = gueltig?.fassung ?? ''
    offline.dateien = gueltig?.dateien ?? 0
    offline.eindatei = gueltig?.eindatei === true
    // Wartet ein Service Worker, der (noch) nicht antwortet, wird nichts angeboten.
    const neu = r.waiting && !wartend ? undefined : neueFassung(aktiv, wartend)
    offline.neu = !!neu
    offline.neuFassung = neu?.fassung ?? ''
    offline.neuCommitZeit = neu?.commitZeit ?? ''
    offline.neuZeit = neu?.zeit ?? ''
    setze()
    if (!gueltig) return
    // Gilt inzwischen eine andere Fassung als beim Laden, wurde in einem anderen Fenster umgeschaltet.
    if (geladen === undefined) geladen = gueltig.kennung
    else if (gueltig.kennung !== geladen && !selbstUebernommen) offline.ersetzt = true
    const beimStart = ersteAuskunft
    ersteAuskunft = false
    if (offline.neu && !offline.ersetzt && u.darfVonSelbst?.(beimStart)) void uebernehmen()
  }
  neuAbfragen = aktualisiere

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

  // Ein anderer Service Worker bedient das Fenster (der Browser hat ihn aktiviert): Die
  // ausgelieferte Fassung ändert das nicht – aber wer die jüngste hält, kann sich geändert haben.
  speicher.addEventListener('controllerchange', () => void aktualisiere())
  // Der Speicher meldet sich von selbst, sobald er verworfene Dateien nachgefüllt hat (auf einer
  // langsamen Verbindung dauert das länger, als die Abfrage oben wartet – ohne diese Meldung
  // bliebe „wird vorbereitet“ stehen, obwohl längst alles da ist) und sobald irgendein Fenster
  // umgeschaltet hat (`gewechselt`).
  speicher.addEventListener('message', (e) => {
    const typ = (e as MessageEvent).data?.typ
    if (typ === 'stand' || typ === 'gewechselt') void aktualisiere()
  })

  if (await anmelden()) {
    const r = reg
    setTimeout(() => {
      if (r && r === reg && r.active) void r.update().catch(() => undefined)
    }, u.suchePause ?? 3000)
  }
}

/**
 * Macht die bereitliegende Fassung zur gültigen und lädt dieses Fenster neu. Die Daten im Browser
 * bleiben. Die Nachricht geht an den jüngsten Service Worker (den wartenden, sonst den
 * laufenden): Er setzt den Zeiger auf seine eigene Fassung. `false`, wenn nichts umgeschaltet wurde.
 */
export async function uebernehmen(): Promise<boolean> {
  const ziel = anmeldung?.waiting ?? anmeldung?.active
  if (!ziel || !offline.neu || offline.uebernimmt) return false
  offline.uebernimmt = true
  selbstUebernommen = true
  const antwort = await sende<{ ok?: boolean }>(ziel, 'uebernehmen', 'uebernommen', umgebung?.geduldWechsel ?? 20000)
  if (antwort?.ok) {
    umgebung?.neuLaden()
    return true
  }
  // Nicht vollständig (der Browser hat Dateien verworfen, kein Netz) oder keine Antwort: Es bleibt
  // bei der laufenden Fassung, und die Anzeige fragt neu nach.
  offline.uebernimmt = false
  selbstUebernommen = false
  void neuAbfragen?.()
  return false
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
    const laedt = anmeldung.installing
    if (laedt) {
      // Gefunden ist noch nicht bereit: Erst wenn alle Dateien da sind und zur Liste passen, liegt
      // die Fassung vor. Mitten in einer Veröffentlichung scheitert das – dann steht es da.
      offline.suche = 'laedt'
      const ende = () => {
        if (laedt.state !== 'installed' && laedt.state !== 'redundant' && laedt.state !== 'activated') return
        laedt.removeEventListener('statechange', ende)
        if (offline.suche === 'laedt') offline.suche = laedt.state === 'redundant' ? 'unvollstaendig' : 'neu'
      }
      laedt.addEventListener('statechange', ende)
      ende()
      return
    }
    // Auch eine Fassung, die schon bereitliegt (der Browser hat ihren Service Worker längst
    // aktiviert), ist „gefunden“ – sonst stünde „keine neue Fassung“ neben dem Knopf „Update“.
    offline.suche = anmeldung.waiting || offline.neu ? 'neu' : 'aktuell'
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
