import { beforeEach, describe, expect, it, vi } from 'vitest'
import { bitteDauerhaft, DAUERHAFT_KEY, darfVonSelbstBitten, leseDauerhaft, offline, neueFassung, offlineLage, pruefeDauerhaft, starteOffline, sucheNeueFassung, uebernehmen, type OfflineUmgebung, type SpeicherStand } from './offline'

// --- Nachbau des Browsers: nur, was lib/offline.ts anfasst -------------------

class Worker extends EventTarget {
  state = 'installing'
  nachrichten: unknown[] = []
  /** `undefined`: antwortet nicht (z. B. noch beim Installieren). */
  stand: SpeicherStand | undefined
  constructor(stand?: SpeicherStand) {
    super()
    this.stand = stand
  }
  /** Antwort auf `uebernehmen`; `undefined`: antwortet nicht. */
  uebernimmt: boolean | undefined = true
  postMessage(nachricht: { typ: string }, ports?: MessagePort[]) {
    this.nachrichten.push(nachricht)
    if (nachricht.typ === 'stand' && this.stand) ports?.[0]?.postMessage({ typ: 'stand', ...this.stand })
    if (nachricht.typ === 'uebernehmen' && this.uebernimmt !== undefined) ports?.[0]?.postMessage({ typ: 'uebernommen', ok: this.uebernimmt })
  }
  wird(state: string) {
    this.state = state
    this.dispatchEvent(new Event('statechange'))
  }
}

class Anmeldung extends EventTarget {
  installing: Worker | null = null
  waiting: Worker | null = null
  active: Worker | null = null
  update = vi.fn(async () => {})
}

class Speicher extends EventTarget {
  controller: Worker | null = null
  anmeldung = new Anmeldung()
  register = vi.fn(async (_adresse: string, _optionen?: unknown) => this.anmeldung)
}

function umgebung(speicher: Speicher | undefined, mehr: Partial<OfflineUmgebung> = {}) {
  const neuLaden = vi.fn()
  const u: OfflineUmgebung = { protokoll: 'https:', entwicklung: false, speicher: speicher as unknown as ServiceWorkerContainer | undefined, neuLaden, geduld: 30, ...mehr }
  return { u, neuLaden }
}

const ruhe = () => new Promise((fertig) => setTimeout(fertig, 60))
const ALT = { kennung: 'k-alt', fassung: 'abc1234', commitZeit: '2026-05-01T10:00:00+02:00', zeit: '2026-05-01T08:05:00.000Z', dateien: 7, fehlend: 0 }
const NEU = { kennung: 'k-neu', fassung: 'def5678', commitZeit: '2026-06-01T10:00:00+02:00', zeit: '2026-06-01T08:05:00.000Z', dateien: 8, fehlend: 0 }
/** Ein Service Worker der alten Fassung, der die alte ausliefert. */
const VOLL: SpeicherStand = { gueltig: ALT, eigen: ALT }
/** Ein Service Worker der neuen Fassung, der (noch) die alte ausliefert. */
const NEU_WARTET: SpeicherStand = { gueltig: ALT, eigen: NEU }

/** Ein Speicher, der schon läuft und dieses Fenster bedient. */
function laufend(): Speicher {
  const s = new Speicher()
  const aktiv = new Worker(VOLL)
  aktiv.state = 'activated'
  s.anmeldung.active = aktiv
  s.controller = aktiv
  return s
}

/** Eine neue Fassung kommt an: lädt, ist fertig, wartet. */
async function kommtAn(s: Speicher): Promise<Worker> {
  const neu = new Worker(NEU_WARTET)
  s.anmeldung.installing = neu
  s.anmeldung.dispatchEvent(new Event('updatefound'))
  await ruhe()
  s.anmeldung.installing = null
  s.anmeldung.waiting = neu
  neu.wird('installed')
  await ruhe()
  return neu
}

beforeEach(() => {
  localStorage.clear()
  Object.assign(offline, { dauerhaft: 'unbekannt', abgelehnt: false })
})

describe('offlineLage', () => {
  const basis = { protokoll: 'https:', entwicklung: false, kannSpeicher: true, fehler: false, stand: undefined }

  it('nennt den Grund, wenn es keinen Speicher gibt – die Datei zuerst', () => {
    expect(offlineLage({ ...basis, protokoll: 'file:', kannSpeicher: false, entwicklung: true })).toEqual({ lage: 'nicht-verfuegbar', grund: 'datei' })
    expect(offlineLage({ ...basis, entwicklung: true })).toEqual({ lage: 'nicht-verfuegbar', grund: 'entwicklung' })
    expect(offlineLage({ ...basis, kannSpeicher: false })).toEqual({ lage: 'nicht-verfuegbar', grund: 'browser' })
    expect(offlineLage({ ...basis, fehler: true })).toEqual({ lage: 'nicht-verfuegbar', grund: 'fehler' })
  })

  it('ist erst bereit, wenn der Speicher meldet, dass keine Datei fehlt', () => {
    expect(offlineLage(basis).lage).toBe('vorbereiten')
    expect(offlineLage({ ...basis, stand: { ...ALT, fehlend: 2 } }).lage).toBe('vorbereiten')
    expect(offlineLage({ ...basis, stand: ALT }).lage).toBe('bereit')
  })
})

describe('neueFassung', () => {
  it('nimmt die Fassung des jüngsten Service Workers – des wartenden, sonst des laufenden', () => {
    expect(neueFassung(VOLL, undefined)).toBeUndefined()
    expect(neueFassung(VOLL, NEU_WARTET)).toMatchObject({ kennung: 'k-neu' })
    expect(neueFassung(NEU_WARTET, undefined)).toMatchObject({ kennung: 'k-neu' })
    expect(neueFassung(undefined, NEU_WARTET)).toBeUndefined()
  })

  it('ohne ausgelieferte Fassung (ihre Liste ist verloren) wird nichts angeboten', () => {
    expect(neueFassung({ eigen: NEU }, undefined)).toBeUndefined()
    expect(neueFassung({ eigen: ALT }, NEU_WARTET)).toBeUndefined()
  })

  it('bietet nichts an, wenn Dateien fehlen oder die Fassung dieselbe ist', () => {
    expect(neueFassung(VOLL, { ...NEU_WARTET, eigen: { ...NEU, fehlend: 1 } })).toBeUndefined()
    expect(neueFassung(VOLL, { ...VOLL })).toBeUndefined()
  })
})

describe('starteOffline', () => {
  it('meldet unter file:// und am Entwicklungsserver nichts an', async () => {
    for (const [mehr, grund] of [[{ protokoll: 'file:' }, 'datei'], [{ entwicklung: true }, 'entwicklung']] as const) {
      const s = new Speicher()
      await starteOffline(umgebung(s, mehr).u)
      expect(s.register).not.toHaveBeenCalled()
      expect(offline).toMatchObject({ lage: 'nicht-verfuegbar', grund })
    }
  })

  it('kommt ohne Service Worker im Browser aus', async () => {
    await starteOffline(umgebung(undefined).u)
    expect(offline).toMatchObject({ lage: 'nicht-verfuegbar', grund: 'browser' })
  })

  it('fällt still zurück, wenn die Anmeldung scheitert', async () => {
    const s = new Speicher()
    s.register.mockRejectedValue(new Error('404'))
    await expect(starteOffline(umgebung(s).u)).resolves.toBeUndefined()
    expect(offline).toMatchObject({ lage: 'nicht-verfuegbar', grund: 'fehler', neu: false })
  })

  it('meldet relativ zur Seite an und am Browser-Cache vorbei', async () => {
    const s = laufend()
    await starteOffline(umgebung(s).u)
    expect(s.register).toHaveBeenCalledWith('./sw.js', { updateViaCache: 'none' })
  })

  it('erster Aufruf: wird vorbereitet, dann bereit – ohne Neuladen und ohne Hinweis', async () => {
    const s = new Speicher()
    const erster = new Worker()
    s.anmeldung.installing = erster
    const { u, neuLaden } = umgebung(s)
    await starteOffline(u)
    expect(offline).toMatchObject({ lage: 'vorbereiten', neu: false, laedtNeu: false })

    s.anmeldung.installing = null
    s.anmeldung.active = erster
    erster.stand = VOLL
    erster.wird('activated')
    s.controller = erster
    s.dispatchEvent(new Event('controllerchange'))
    await ruhe()
    expect(offline).toMatchObject({ lage: 'bereit', fassung: 'abc1234', dateien: 7, neu: false, ersetzt: false })
    expect(neuLaden).not.toHaveBeenCalled()
  })

  it('bleibt bei „wird vorbereitet“, solange Dateien fehlen', async () => {
    const s = laufend()
    s.anmeldung.active!.stand = { ...VOLL, gueltig: { ...ALT, fehlend: 1 } }
    await starteOffline(umgebung(s).u)
    expect(offline.lage).toBe('vorbereiten')
  })

  it('neue Fassung: wartet, wird gemeldet, lädt nichts neu', async () => {
    const s = laufend()
    const { u, neuLaden } = umgebung(s)
    await starteOffline(u)
    expect(offline).toMatchObject({ lage: 'bereit', neu: false })

    const neu = new Worker(NEU_WARTET)
    s.anmeldung.installing = neu
    s.anmeldung.dispatchEvent(new Event('updatefound'))
    await ruhe()
    expect(offline).toMatchObject({ lage: 'bereit', neu: false, laedtNeu: true })

    s.anmeldung.installing = null
    s.anmeldung.waiting = neu
    neu.wird('installed')
    await ruhe()
    expect(offline).toMatchObject({ lage: 'bereit', fassung: 'abc1234', neu: true, neuFassung: 'def5678', neuZeit: NEU.zeit, neuCommitZeit: NEU.commitZeit, laedtNeu: false })
    expect(neuLaden).not.toHaveBeenCalled()
    expect(neu.nachrichten).not.toContainEqual({ typ: 'uebernehmen' })
  })

  it('findet eine Fassung, die beim Start schon wartet', async () => {
    const s = laufend()
    const neu = new Worker(NEU_WARTET)
    neu.state = 'installed'
    s.anmeldung.waiting = neu
    await starteOffline(umgebung(s).u)
    expect(offline).toMatchObject({ lage: 'bereit', neu: true, neuFassung: 'def5678' })
  })

  it('nach einem Neustart läuft der NEUE Service Worker, ausgeliefert wird die alte Fassung: Die neue liegt bereit, nichts wechselt von selbst', async () => {
    const s = laufend()
    // Der Browser hat den wartenden Service Worker aktiviert, während alle Fenster zu waren.
    s.anmeldung.active!.stand = NEU_WARTET
    const { u, neuLaden } = umgebung(s, { darfVonSelbst: () => false })
    await starteOffline(u)
    expect(offline).toMatchObject({ lage: 'bereit', fassung: 'abc1234', neu: true, neuFassung: 'def5678', ersetzt: false })
    expect(neuLaden).not.toHaveBeenCalled()
    expect(s.anmeldung.active!.nachrichten).not.toContainEqual({ typ: 'uebernehmen' })

    // „Update“ geht dann an den laufenden Service Worker – es wartet ja keiner.
    await uebernehmen()
    expect(s.anmeldung.active!.nachrichten).toContainEqual({ typ: 'uebernehmen' })
    expect(neuLaden).toHaveBeenCalledTimes(1)
  })

  it('bietet eine halb geladene oder verworfene Fassung nicht an', async () => {
    const s = laufend()
    const neu = new Worker({ ...NEU_WARTET, eigen: { ...NEU, fehlend: 3 } })
    neu.state = 'installed'
    s.anmeldung.waiting = neu
    await starteOffline(umgebung(s).u)
    expect(offline.neu).toBe(false)
    // Ebenso, wenn der wartende Service Worker nicht antwortet.
    neu.stand = undefined
    await starteOffline(umgebung(s).u)
    expect(offline.neu).toBe(false)
  })

  it('leerer Stand: übernimmt eine bereitliegende Fassung beim Start von selbst', async () => {
    const s = laufend()
    const neu = new Worker(NEU_WARTET)
    neu.state = 'installed'
    s.anmeldung.waiting = neu
    const darf = vi.fn((_beimStart: boolean) => true)
    const { u, neuLaden } = umgebung(s, { darfVonSelbst: darf })
    await starteOffline(u)
    await ruhe()
    expect(darf).toHaveBeenCalledWith(true)
    expect(neu.nachrichten).toContainEqual({ typ: 'uebernehmen' })
    expect(neuLaden).toHaveBeenCalledTimes(1)
  })

  it('mit Daten: übernimmt nie von selbst – auch nicht, wenn die Fassung erst später fertig lädt', async () => {
    const s = laufend()
    const darf = vi.fn((_beimStart: boolean) => false)
    const { u, neuLaden } = umgebung(s, { darfVonSelbst: darf })
    await starteOffline(u)
    const neu = await kommtAn(s)
    expect(offline.neu).toBe(true)
    // Später gefragt wird mit `beimStart = false`: Die Seite entscheidet dann strenger.
    expect(darf).toHaveBeenLastCalledWith(false)
    expect(neu.nachrichten).not.toContainEqual({ typ: 'uebernehmen' })
    expect(neuLaden).not.toHaveBeenCalled()
  })

  it('ohne die Angabe `darfVonSelbst` wird nie von selbst übernommen', async () => {
    const s = laufend()
    const neu = new Worker(NEU_WARTET)
    neu.state = 'installed'
    s.anmeldung.waiting = neu
    const { u, neuLaden } = umgebung(s)
    await starteOffline(u)
    await ruhe()
    expect(neuLaden).not.toHaveBeenCalled()
  })

  it('übernimmt erst auf Knopfdruck und lädt dann genau einmal neu', async () => {
    const s = laufend()
    const { u, neuLaden } = umgebung(s)
    await starteOffline(u)
    const neu = await kommtAn(s)

    const fertig = uebernehmen()
    expect(offline.uebernimmt).toBe(true)
    expect(neu.nachrichten).toContainEqual({ typ: 'uebernehmen' })
    // Erst wenn der Service Worker den Zeiger umgesetzt hat, lädt das Fenster neu.
    expect(neuLaden).not.toHaveBeenCalled()
    expect(await fertig).toBe(true)
    expect(neuLaden).toHaveBeenCalledTimes(1)

    // Der Browser löst den alten Service Worker ab, und alle Fenster erfahren vom Wechsel:
    // In DIESEM Fenster ändert das nichts mehr – kein zweites Neuladen, kein Hinweis.
    s.anmeldung.waiting = null
    s.anmeldung.active = neu
    neu.stand = { gueltig: NEU, eigen: NEU }
    s.controller = neu
    s.dispatchEvent(new Event('controllerchange'))
    neu.wird('activated')
    s.dispatchEvent(new MessageEvent('message', { data: { typ: 'gewechselt', kennung: NEU.kennung } }))
    await ruhe()
    expect(neuLaden).toHaveBeenCalledTimes(1)
    expect(offline.ersetzt).toBe(false)
  })

  it('lässt sich nicht umschalten (Dateien verworfen, kein Netz): bleibt bei der laufenden Fassung', async () => {
    const s = laufend()
    const { u, neuLaden } = umgebung(s)
    await starteOffline(u)
    const neu = await kommtAn(s)
    neu.uebernimmt = false
    expect(await uebernehmen()).toBe(false)
    expect(neuLaden).not.toHaveBeenCalled()
    expect(offline.uebernimmt).toBe(false)
  })

  it('übernimmt nichts, wenn keine Fassung wartet', async () => {
    const s = laufend()
    const { u, neuLaden } = umgebung(s)
    await starteOffline(u)
    expect(await uebernehmen()).toBe(false)
    expect(s.anmeldung.active!.nachrichten).not.toContainEqual({ typ: 'uebernehmen' })
    expect(neuLaden).not.toHaveBeenCalled()
  })

  it('anderes Fenster hat übernommen: Hinweis statt Neuladen', async () => {
    const s = laufend()
    const { u, neuLaden } = umgebung(s)
    await starteOffline(u)
    const neu = await kommtAn(s)

    // Dort wurde „Update“ gedrückt: Der Zeiger steht auf der neuen Fassung, alle Fenster erfahren es.
    s.anmeldung.active!.stand = { gueltig: NEU, eigen: ALT }
    neu.stand = { gueltig: NEU, eigen: NEU }
    s.dispatchEvent(new MessageEvent('message', { data: { typ: 'gewechselt', kennung: NEU.kennung } }))
    await ruhe()
    expect(offline).toMatchObject({ ersetzt: true, neu: false })
    expect(neuLaden).not.toHaveBeenCalled()
  })

  it('der Browser aktiviert den wartenden Service Worker (anderes Fenster zu, dieses offen geblieben): kein Hinweis, die Fassung bleibt', async () => {
    const s = laufend()
    const { u, neuLaden } = umgebung(s)
    await starteOffline(u)
    const neu = await kommtAn(s)
    s.anmeldung.waiting = null
    s.anmeldung.active = neu
    s.controller = neu
    neu.wird('activated')
    s.dispatchEvent(new Event('controllerchange'))
    await ruhe()
    expect(offline).toMatchObject({ ersetzt: false, neu: true, fassung: 'abc1234', neuFassung: 'def5678' })
    expect(neuLaden).not.toHaveBeenCalled()
  })

  it('erstes Füllen gescheitert: meldet nach einer Pause neu an; hilft das nicht, steht „kein Speicher“ da statt ewig „wird vorbereitet“', async () => {
    const s = new Speicher()
    const erster = new Worker()
    s.anmeldung.installing = erster
    await starteOffline(umgebung(s, { pausen: [20] }).u)
    expect(offline.lage).toBe('vorbereiten')

    // Der Browser verwirft die Anmeldung: nichts lädt, wartet oder läuft mehr.
    const zweiter = new Worker()
    const zweite = new Anmeldung()
    zweite.installing = zweiter
    s.register.mockResolvedValue(zweite)
    s.anmeldung.installing = null
    erster.wird('redundant')
    expect(offline.lage).toBe('vorbereiten')
    await ruhe()
    expect(s.register).toHaveBeenCalledTimes(2)

    // Auch der zweite Versuch scheitert, und die Pausen sind aufgebraucht.
    zweite.installing = null
    zweiter.wird('redundant')
    expect(offline).toMatchObject({ lage: 'nicht-verfuegbar', grund: 'fehler' })

    // „Erneut versuchen“ meldet neu an, statt „keine Verbindung“ zu melden – und diesmal klappt es.
    const dritter = new Worker(VOLL)
    dritter.state = 'activated'
    const dritte = new Anmeldung()
    dritte.active = dritter
    s.register.mockResolvedValue(dritte)
    await sucheNeueFassung()
    expect(s.register).toHaveBeenCalledTimes(3)
    expect(zweite.update).not.toHaveBeenCalled()
    expect(offline).toMatchObject({ lage: 'bereit', suche: '' })
  })

  it('der zweite Versuch gelingt: bereit, ohne dass jemand neu lädt', async () => {
    const s = new Speicher()
    const erster = new Worker()
    s.anmeldung.installing = erster
    const { u, neuLaden } = umgebung(s, { pausen: [20] })
    await starteOffline(u)
    const zweiter = new Worker(VOLL)
    zweiter.state = 'activated'
    const zweite = new Anmeldung()
    zweite.active = zweiter
    s.register.mockResolvedValue(zweite)
    s.anmeldung.installing = null
    erster.wird('redundant')
    await ruhe()
    expect(offline.lage).toBe('bereit')
    expect(neuLaden).not.toHaveBeenCalled()
  })

  it('scheitert das Laden einer NEUEN Fassung, bleibt die laufende bereit', async () => {
    const s = laufend()
    await starteOffline(umgebung(s, { pausen: [20] }).u)
    const neu = new Worker()
    s.anmeldung.installing = neu
    s.anmeldung.dispatchEvent(new Event('updatefound'))
    await ruhe()
    s.anmeldung.installing = null
    neu.wird('redundant')
    await ruhe()
    expect(s.register).toHaveBeenCalledTimes(1)
    expect(offline).toMatchObject({ lage: 'bereit', neu: false, laedtNeu: false })
  })

  it('Anmeldung gescheitert: „Erneut versuchen“ meldet neu an', async () => {
    const s = laufend()
    s.register.mockRejectedValueOnce(new Error('404'))
    await starteOffline(umgebung(s).u)
    expect(offline).toMatchObject({ lage: 'nicht-verfuegbar', grund: 'fehler' })
    await sucheNeueFassung()
    expect(offline).toMatchObject({ lage: 'bereit', suche: '' })
    s.register.mockRejectedValueOnce(new Error('offline'))
    await starteOffline(umgebung(s).u)
    s.register.mockRejectedValueOnce(new Error('offline'))
    await sucheNeueFassung()
    expect(offline).toMatchObject({ lage: 'nicht-verfuegbar', grund: 'fehler', suche: 'fehlgeschlagen' })
  })

  it('der Speicher meldet von selbst, wenn er nachgefüllt hat: Die Anzeige wird bereit, auch wenn die Abfrage längst aufgegeben hat', async () => {
    const s = laufend()
    const aktiv = s.anmeldung.active!
    // Langsame Verbindung: keine Antwort innerhalb der Geduld.
    aktiv.stand = undefined
    await starteOffline(umgebung(s).u)
    expect(offline.lage).toBe('vorbereiten')
    aktiv.stand = VOLL
    s.dispatchEvent(new MessageEvent('message', { data: { typ: 'stand', ...VOLL } }))
    await ruhe()
    expect(offline.lage).toBe('bereit')
  })

  it('sieht kurz nach dem Start selbst nach einer neuen Fassung – der Browser tut es nicht verlässlich', async () => {
    const s = laufend()
    await starteOffline(umgebung(s, { suchePause: 10 }).u)
    expect(s.anmeldung.update).not.toHaveBeenCalled()
    await ruhe()
    expect(s.anmeldung.update).toHaveBeenCalledTimes(1)
    // Ohne Netz scheitert das still.
    const ohne = laufend()
    ohne.anmeldung.update.mockRejectedValue(new TypeError('offline'))
    await starteOffline(umgebung(ohne, { suchePause: 10 }).u)
    await ruhe()
    expect(offline).toMatchObject({ lage: 'bereit', suche: '' })
  })

  it('sucht auf Wunsch nach einer neuen Fassung', async () => {
    const s = laufend()
    await starteOffline(umgebung(s).u)
    await sucheNeueFassung()
    expect(s.anmeldung.update).toHaveBeenCalledTimes(1)
    expect(offline.suche).toBe('aktuell')

    // Gefunden heißt noch nicht bereit: erst laden …
    const neu = new Worker()
    s.anmeldung.update.mockImplementationOnce(async () => {
      s.anmeldung.installing = neu
    })
    await sucheNeueFassung()
    expect(offline.suche).toBe('laedt')
    s.anmeldung.installing = null
    s.anmeldung.waiting = neu
    neu.wird('installed')
    expect(offline.suche).toBe('neu')
    s.anmeldung.waiting = null

    // … und eine halb veröffentlichte Fassung lässt sich nicht laden: Das steht dann da.
    const halb = new Worker()
    s.anmeldung.update.mockImplementationOnce(async () => {
      s.anmeldung.installing = halb
    })
    await sucheNeueFassung()
    expect(offline.suche).toBe('laedt')
    s.anmeldung.installing = null
    halb.wird('redundant')
    expect(offline.suche).toBe('unvollstaendig')
    expect(offline.neu).toBe(false)

    s.anmeldung.update.mockRejectedValueOnce(new TypeError('offline'))
    await sucheNeueFassung()
    expect(offline.suche).toBe('kein-netz')
  })
})

describe('Zusage des Browsers', () => {
  const lager = (zugesagt: boolean, sagtZu = zugesagt) => ({ persisted: vi.fn(async () => zugesagt), persist: vi.fn(async () => sagtZu) })
  const TAG = 24 * 60 * 60 * 1000

  it('liest nur nach, ohne zu fragen', async () => {
    const l = lager(false, true)
    expect(await leseDauerhaft(l)).toBe('nein')
    expect(l.persist).not.toHaveBeenCalled()
    expect(await leseDauerhaft(lager(true))).toBe('ja')
  })

  it('kennt Browser ohne Zusage', async () => {
    const kaputt = { persisted: vi.fn(async () => Promise.reject(new Error('x'))), persist: vi.fn(async () => true) }
    expect(await leseDauerhaft(kaputt)).toBe('nicht-moeglich')
  })

  it('merkt eine Ablehnung nur bei der Bitte von Hand an', async () => {
    expect(await bitteDauerhaft(lager(false, false))).toBe('nein')
    expect(offline.abgelehnt).toBe(true)
    await bitteDauerhaft(lager(false, false), false)
    expect(offline.abgelehnt).toBe(false)
    expect(await bitteDauerhaft(lager(false, true))).toBe('ja')
    expect(offline.abgelehnt).toBe(false)
  })

  it('bittet von selbst nur mit Startern, ohne Ablehnung und höchstens einmal am Tag', () => {
    const basis = { hatStarter: true, dauerhaft: 'nein' as const, erlaubnis: 'prompt' as const, zuletzt: undefined, jetzt: 10 * TAG }
    expect(darfVonSelbstBitten(basis)).toBe(true)
    expect(darfVonSelbstBitten({ ...basis, hatStarter: false })).toBe(false)
    expect(darfVonSelbstBitten({ ...basis, dauerhaft: 'ja' })).toBe(false)
    expect(darfVonSelbstBitten({ ...basis, dauerhaft: 'nicht-moeglich' })).toBe(false)
    expect(darfVonSelbstBitten({ ...basis, erlaubnis: 'denied' })).toBe(false)
    expect(darfVonSelbstBitten({ ...basis, erlaubnis: undefined })).toBe(true)
    expect(darfVonSelbstBitten({ ...basis, zuletzt: 10 * TAG - 1000 })).toBe(false)
    expect(darfVonSelbstBitten({ ...basis, zuletzt: 9 * TAG })).toBe(true)
    // Eine verstellte Uhr sperrt nicht für immer.
    expect(darfVonSelbstBitten({ ...basis, zuletzt: 11 * TAG })).toBe(true)
  })

  it('fragt ohne Starter nicht und mit Startern nicht zweimal am selben Tag', async () => {
    const l = lager(false, false)
    expect(await pruefeDauerhaft(false, l, 5 * TAG)).toBe('nein')
    expect(l.persist).not.toHaveBeenCalled()

    expect(await pruefeDauerhaft(true, l, 5 * TAG)).toBe('nein')
    expect(l.persist).toHaveBeenCalledTimes(1)
    expect(localStorage.getItem(DAUERHAFT_KEY)).toBe(String(5 * TAG))
    // Still gefragt: kein „abgelehnt“-Hinweis.
    expect(offline.abgelehnt).toBe(false)

    await pruefeDauerhaft(true, l, 5 * TAG + 1000)
    expect(l.persist).toHaveBeenCalledTimes(1)
    await pruefeDauerhaft(true, l, 6 * TAG + 1000)
    expect(l.persist).toHaveBeenCalledTimes(2)
  })

  it('fragt nicht mehr, sobald zugesagt ist', async () => {
    const l = lager(true)
    expect(await pruefeDauerhaft(true, l, 5 * TAG)).toBe('ja')
    expect(l.persist).not.toHaveBeenCalled()
  })
})
