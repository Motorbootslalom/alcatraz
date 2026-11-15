import { beforeEach, describe, expect, it, vi } from 'vitest'
import { bitteDauerhaft, DAUERHAFT_KEY, darfVonSelbstBitten, leseDauerhaft, offline, offlineLage, pruefeDauerhaft, starteOffline, sucheNeueFassung, uebernehmen, type OfflineUmgebung, type SpeicherStand } from './offline'

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
  postMessage(nachricht: { typ: string }, ports?: MessagePort[]) {
    this.nachrichten.push(nachricht)
    if (nachricht.typ === 'stand' && this.stand) ports?.[0]?.postMessage({ typ: 'stand', ...this.stand })
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
const VOLL: SpeicherStand = { fassung: 'abc1234', dateien: 7, fehlend: 0 }

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
async function neueFassung(s: Speicher, fassung = 'def5678'): Promise<Worker> {
  const neu = new Worker({ fassung, dateien: 8, fehlend: 0 })
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
    expect(offlineLage({ ...basis, stand: { ...VOLL, fehlend: 2 } }).lage).toBe('vorbereiten')
    expect(offlineLage({ ...basis, stand: VOLL }).lage).toBe('bereit')
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
    s.anmeldung.active!.stand = { ...VOLL, fehlend: 1 }
    await starteOffline(umgebung(s).u)
    expect(offline.lage).toBe('vorbereiten')
  })

  it('neue Fassung: wartet, wird gemeldet, lädt nichts neu', async () => {
    const s = laufend()
    const { u, neuLaden } = umgebung(s)
    await starteOffline(u)
    expect(offline).toMatchObject({ lage: 'bereit', neu: false })

    const neu = new Worker({ fassung: 'def5678', dateien: 8, fehlend: 0 })
    s.anmeldung.installing = neu
    s.anmeldung.dispatchEvent(new Event('updatefound'))
    await ruhe()
    expect(offline).toMatchObject({ lage: 'bereit', neu: false, laedtNeu: true })

    s.anmeldung.installing = null
    s.anmeldung.waiting = neu
    neu.wird('installed')
    await ruhe()
    expect(offline).toMatchObject({ lage: 'bereit', fassung: 'abc1234', neu: true, neuFassung: 'def5678', laedtNeu: false })
    expect(neuLaden).not.toHaveBeenCalled()
    expect(neu.nachrichten).not.toContainEqual({ typ: 'uebernehmen' })
  })

  it('findet eine Fassung, die beim Start schon wartet', async () => {
    const s = laufend()
    const neu = new Worker({ fassung: 'def5678', dateien: 8, fehlend: 0 })
    neu.state = 'installed'
    s.anmeldung.waiting = neu
    await starteOffline(umgebung(s).u)
    expect(offline).toMatchObject({ lage: 'bereit', neu: true, neuFassung: 'def5678' })
  })

  it('übernimmt erst auf Knopfdruck und lädt dann genau einmal neu', async () => {
    const s = laufend()
    const { u, neuLaden } = umgebung(s)
    await starteOffline(u)
    const neu = await neueFassung(s)

    uebernehmen()
    expect(neu.nachrichten).toContainEqual({ typ: 'uebernehmen' })
    expect(neuLaden).not.toHaveBeenCalled()

    // Der Browser schaltet um: erst dann lädt das Fenster neu.
    s.anmeldung.waiting = null
    s.anmeldung.active = neu
    neu.wird('activating')
    expect(neuLaden).not.toHaveBeenCalled()
    s.controller = neu
    s.dispatchEvent(new Event('controllerchange'))
    neu.wird('activated')
    expect(neuLaden).toHaveBeenCalledTimes(1)
    expect(offline.ersetzt).toBe(false)
  })

  it('übernimmt nichts, wenn keine Fassung wartet', async () => {
    const s = laufend()
    const { u, neuLaden } = umgebung(s)
    await starteOffline(u)
    uebernehmen()
    expect(s.anmeldung.active!.nachrichten).not.toContainEqual({ typ: 'uebernehmen' })
    expect(neuLaden).not.toHaveBeenCalled()
  })

  it('anderes Fenster hat übernommen: Hinweis statt Neuladen', async () => {
    const s = laufend()
    const { u, neuLaden } = umgebung(s)
    await starteOffline(u)
    const neu = await neueFassung(s)

    s.anmeldung.waiting = null
    s.anmeldung.active = neu
    s.controller = neu
    neu.wird('activated')
    s.dispatchEvent(new Event('controllerchange'))
    await ruhe()
    expect(offline).toMatchObject({ ersetzt: true, neu: false })
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

  it('sucht auf Wunsch nach einer neuen Fassung', async () => {
    const s = laufend()
    await starteOffline(umgebung(s).u)
    await sucheNeueFassung()
    expect(s.anmeldung.update).toHaveBeenCalledTimes(1)
    expect(offline.suche).toBe('aktuell')

    s.anmeldung.update.mockImplementationOnce(async () => {
      s.anmeldung.installing = new Worker()
    })
    await sucheNeueFassung()
    expect(offline.suche).toBe('neu')

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
