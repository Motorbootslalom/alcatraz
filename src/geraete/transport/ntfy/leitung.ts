import { ref, shallowRef, type Ref } from 'vue'
import type { TransportFehler, Verbindungsstand } from '../typen'

/**
 * Die Leitung zu einem ntfy-Server: Abo per WebSocket mit `since`, Abfrage (`poll`), Senden mit Wiederholung
 * (aus dem Prototyp tafel, transport/ntfy/transport.ts, 16.11.2026 herausgelöst – dort Teil einer Klasse für Host
 * und Gerät). Host und Gerät (transport.ts) bauen darauf auf; diese Klasse kennt weder Schlüssel noch Inhalte.
 *
 * Geändert gegenüber dem Prototyp:
 * - Abonniert wird mit `since` (Lücke S3: dort ging verloren, was während einer Trennung kam – für Gerät → Host
 *   still, obwohl das Gerät ein „OK“ von ntfy hatte). Der Aufrufer sagt, ab welcher Nachricht (`aboSeit`).
 * - Ein Abo trägt mehrere Themen (`/t1,t2/ws`), so braucht ein Gerät eine Verbindung für oA und sein d-Thema.
 * - Anhänge lädt diese Klasse nur auf ausdrücklichen Auftrag, nur vom eigenen Server und nur bis zur angekündigten
 *   Größe (S5); Fehler sind Codes, keine Texte.
 */

export interface NtfyZeiten {
  /** Mindestabstand zweier Sicht-Nachrichten einer Gruppe; was dazwischen kommt, wird zusammengefasst. */
  abstandMs: number
  /** Wartezeiten nach einem gescheiterten Senden. */
  wiederholenMs: number[]
  /** Wartezeit nach „zu viele Anfragen“ (429). */
  zuVieleMs: number
  /** Wiederverbinden nach einem Abbruch. */
  neuVerbindenMs: number[]
  /** So lange ohne jedes Lebenszeichen von ntfy gilt die Verbindung als tot (ntfy schickt alle 45 s eines). */
  waechterMs: number
  /** Gerät: ohne Quittung so lange, bis dieselbe Nachricht (dieselbe `nr`) noch einmal geht. */
  quittungMs: number
  /** Host: spätestens so oft ein Vollstand je Gruppe – unter den 3 h, die ntfy.adminforge.de Anhänge hält (K15). */
  vollstandMs: number
  /** Gerät: Fenster der Einstiegs-Abfrage (`since`), etwas über {@link vollstandMs}. */
  einstiegFenster: string
  /** Gerät: Mindestabstand zweier Abfragen, um eine Lücke zu schließen. */
  einstiegAbstandMs: number
  /**
   * Gerät ohne Stand: Ein Vollstand, dessen Sendezeit `hz` älter ist, gilt nicht (K17) – sonst nähme ein neues
   * Gerät eine alte, erneut eingestellte Nachricht an, wenn der Host gerade schweigt.
   */
  hoechstensAltMs: number
  /** Host: So lange gilt eine Geräte-Nachricht als in Arbeit; erst danach zählt eine Wiederholung erneut. */
  bearbeitungMs: number
}

export const NTFY_ZEITEN: NtfyZeiten = {
  abstandMs: 1000,
  wiederholenMs: [1000, 2000, 5000, 10_000, 30_000],
  zuVieleMs: 5000,
  neuVerbindenMs: [500, 1000, 2000, 5000, 10_000, 15_000],
  waechterMs: 100_000,
  quittungMs: 10_000,
  vollstandMs: 60 * 60_000,
  einstiegFenster: '70m',
  einstiegAbstandMs: 30_000,
  hoechstensAltMs: 2 * 60 * 60_000,
  bearbeitungMs: 30_000,
}

/** Größer legt ntfy eine Nachricht als Anhang ab. */
export const INLINE_GRENZE = 4096

/**
 * Größter Anhang, den Host sendet und Gerät lädt (S5; der Prototyp ließ 8 MB zu). Eine Sicht mit 300 Startern
 * ergibt gepackt und verschlüsselt um 40 kB; Logos gehen nicht an entfernte Anzeigen (BETRIEB_ANNAHMEN, E6).
 */
export const MAX_ANHANG = 256 * 1024

/** Ein Ereignis, wie ntfy es über WebSocket und `poll` liefert (ungeprüft). */
export interface NtfyEreignis {
  id?: unknown
  time?: unknown
  event?: unknown
  topic?: unknown
  message?: unknown
  attachment?: { url?: unknown; size?: unknown } | null
}

export type PostErgebnis =
  | { art: 'ok'; antwort: NtfyEreignis | null }
  /** Später noch einmal (Netz, 5xx). */
  | { art: 'nochmal' }
  /** Später noch einmal, nach einer längeren Pause (429). */
  | { art: 'warten' }
  /** Abgelehnt (4xx) – Wiederholen hilft nicht. */
  | { art: 'verworfen'; status: number }

export abstract class NtfyLeitung {
  readonly art = 'ntfy' as const
  readonly status: Ref<Verbindungsstand> = ref('aus')
  readonly fehler: Ref<TransportFehler | null> = shallowRef(null)

  protected readonly zeiten: NtfyZeiten
  protected gestoppt = true
  /** Steht das Abo? Erst dann wird gesendet – sonst ginge eine Antwort ins Leere. */
  protected abonniert = false
  /** Eingehendes wird der Reihe nach verarbeitet – Entschlüsseln und Anhänge sind asynchron. */
  protected eingang: Promise<void> = Promise.resolve()
  /**
   * Zählt jedes start/stop. Wer nach einem `await` weitermacht, prüft, ob noch dieselbe Sitzung läuft: Nach stop()
   * und erneutem start() (Führung verloren und zurückgewonnen) arbeitete eine alte Schleife sonst an der neuen
   * Schlange weiter (Befund E5-Prüfung 16.11.2026).
   */
  protected sitzung = 0

  private socket: WebSocket | null = null
  /** Läuft gerade der Einstieg (vorDemAbo)? Dann öffnet verbinde() gleich selbst – neuAbonnieren darf es nicht auch. */
  private verbindet = false
  /** Wurde während des Pumpens angestoßen? Dann nach dem Ende noch einmal (die Schleife einer alten Sitzung endet still). */
  private nochmalPumpen = false
  private versuch = 0
  private neuTimer: ReturnType<typeof setTimeout> | null = null
  private waechter: ReturnType<typeof setInterval> | null = null
  private letzterRahmen = 0
  private pumpt = false
  private wecker: (() => void) | null = null
  private schlaefer = new Set<() => void>()
  private fehlschlaege = 0
  /** Stammt der aktuelle Fehler vom Senden? Dann verschwindet er beim nächsten Erfolg. */
  private sendeFehler = false

  constructor(
    protected readonly server: string,
    zeiten: Partial<NtfyZeiten> = {},
    /**
     * E8 (20.11.2026): zählt, was an den Server geht – Anfragen (POST, Abfrage, Anhang, Abo), angenommene Nachrichten
     * und 429. Der Host gibt den Kontingent-Zähler (geraete/kontingent.ts); Geräte zählen nicht.
     */
    private readonly zaehle: (art: 'nachricht' | 'anfrage' | 'gedrosselt') => void = () => {},
  ) {
    this.zeiten = { ...NTFY_ZEITEN, ...zeiten }
  }

  /** Zählen darf nie das Senden stören. */
  private zaehleStill(art: 'nachricht' | 'anfrage' | 'gedrosselt'): void {
    try {
      this.zaehle(art)
    } catch {
      // Zähler kaputt – senden geht vor.
    }
  }

  /** Themen des Abos – ändern sie sich, ruft die Unterklasse {@link neuAbonnieren}. */
  protected abstract aboThemen(): string[]
  /** `since` für das Abo: ntfy-ID der zuletzt verarbeiteten Nachricht oder ein Zeitraum wie '70m'. */
  protected abstract aboSeit(): string | null
  protected abstract empfange(ereignis: NtfyEreignis): Promise<void>
  /** Arbeitet die Sende-Schlange ab, solange es geht (`gestoppt`, `abonniert`). */
  protected abstract pumpe(): Promise<void>
  /** Vor jedem Verbinden (Gerät: Einstieg per Abfrage). `false` = später noch einmal versuchen. */
  protected async vorDemAbo(): Promise<boolean> {
    return true
  }

  /** Fehler, der den Start verhindert: Status `fehler`, nichts verbindet. */
  protected scheitere(fehler: TransportFehler): void {
    this.fehler.value = fehler
    this.status.value = 'fehler'
  }

  protected beginne(): void {
    this.gestoppt = false
    this.sitzung += 1
    void this.verbinde()
  }

  stop(): void {
    this.gestoppt = true
    this.sitzung += 1
    this.abonniert = false
    this.verbindet = false
    if (this.neuTimer) clearTimeout(this.neuTimer)
    if (this.waechter) clearInterval(this.waechter)
    this.neuTimer = null
    this.waechter = null
    for (const fertig of [...this.schlaefer]) fertig()
    const socket = this.socket
    this.socket = null
    socket?.close()
    this.status.value = 'aus'
  }

  // -------------------------------------------------------------------------
  // Abo
  // -------------------------------------------------------------------------

  private async verbinde(): Promise<void> {
    if (this.gestoppt) return
    const sitzung = this.sitzung
    this.status.value = this.versuch === 0 ? 'verbinde' : 'neu-verbinden'
    let bereit = false
    this.verbindet = true
    try {
      bereit = await this.vorDemAbo()
    } catch {
      bereit = false
    } finally {
      if (sitzung === this.sitzung) this.verbindet = false
    }
    if (this.gestoppt || sitzung !== this.sitzung) return
    if (!bereit) {
      this.planeNeu()
      return
    }
    this.oeffneSocket()
  }

  private oeffneSocket(): void {
    // Nie zwei Abos zugleich: ein noch offenes wird geschlossen – sonst bliebe es liegen, auch nach stop().
    const alt = this.socket
    this.socket = null
    alt?.close()
    const themen = this.aboThemen()
    const seit = this.aboSeit()
    const url = `${this.server.replace(/^http/, 'ws')}/${themen.join(',')}/ws${seit ? `?since=${encodeURIComponent(seit)}` : ''}`
    let socket: WebSocket
    this.zaehleStill('anfrage')
    try {
      socket = new WebSocket(url)
    } catch {
      this.fehler.value = { code: 'verbindung-gestoert' }
      this.planeNeu()
      return
    }
    this.socket = socket
    this.letzterRahmen = Date.now()
    socket.onmessage = (ev: MessageEvent) => this.beiRahmen(socket, ev.data)
    socket.onerror = () => {
      if (this.socket !== socket) return
      this.fehler.value = { code: 'verbindung-gestoert' }
      this.sendeFehler = false
    }
    socket.onclose = () => {
      if (this.socket !== socket) return
      this.socket = null
      this.abonniert = false
      if (this.waechter) clearInterval(this.waechter)
      this.waechter = null
      if (this.gestoppt) return
      this.status.value = 'neu-verbinden'
      this.planeNeu()
    }
  }

  /** Die Themen haben sich geändert (Gerät gekoppelt, Koppel-Thema dazu): neu abonnieren, ab `aboSeit`. */
  protected neuAbonnieren(): void {
    if (this.gestoppt) return
    const alt = this.socket
    this.socket = null
    this.abonniert = false
    alt?.close()
    // Ein Neuverbinden ist geplant, oder der Einstieg läuft noch (beim Gerät etwa ein willkommen aus der Abfrage, beim
    // Host liesAuch gleich nach start()): verbinde() öffnet danach selbst, mit den dann gültigen Themen.
    if (this.neuTimer || this.verbindet) return
    this.oeffneSocket()
  }

  private planeNeu(): void {
    if (this.gestoppt || this.neuTimer) return
    const stufen = this.zeiten.neuVerbindenMs
    const warte = stufen[Math.min(this.versuch, stufen.length - 1)]
    this.versuch += 1
    const sitzung = this.sitzung
    this.neuTimer = setTimeout(() => {
      this.neuTimer = null
      if (sitzung === this.sitzung) void this.verbinde()
    }, warte)
  }

  /** ntfy meldet mit `open`, dass das Abo steht. */
  private beiOffen(): void {
    this.abonniert = true
    this.versuch = 0
    if (this.fehler.value?.code === 'verbindung-gestoert') this.fehler.value = null
    this.status.value = 'verbunden'
    if (this.waechter) clearInterval(this.waechter)
    this.waechter = setInterval(() => {
      if (Date.now() - this.letzterRahmen > this.zeiten.waechterMs) this.socket?.close()
    }, Math.max(1000, this.zeiten.waechterMs / 4))
    this.kick()
  }

  private beiRahmen(socket: WebSocket, roh: unknown): void {
    if (this.socket !== socket) return
    this.letzterRahmen = Date.now()
    if (typeof roh !== 'string') return
    let ereignis: NtfyEreignis
    try {
      ereignis = JSON.parse(roh) as NtfyEreignis
    } catch {
      return
    }
    if (!ereignis || typeof ereignis !== 'object') return
    if (ereignis.event === 'open') {
      this.beiOffen()
      return
    }
    if (ereignis.event !== 'message') return
    this.eingang = this.eingang.then(() => (this.gestoppt ? undefined : this.empfange(ereignis))).catch(() => {})
  }

  // -------------------------------------------------------------------------
  // Abfrage und Anhänge
  // -------------------------------------------------------------------------

  /** Was auf den Themen seit `seit` liegt (ntfy `poll=1`); `null`, wenn die Abfrage scheitert. */
  protected async abfrage(themen: string[], seit: string): Promise<NtfyEreignis[] | null> {
    this.zaehleStill('anfrage')
    try {
      const antwort = await fetch(`${this.server}/${themen.join(',')}/json?poll=1&since=${encodeURIComponent(seit)}`)
      if (!antwort.ok) {
        if (antwort.status === 429) {
          this.zaehleStill('gedrosselt')
          this.meldeSendefehler({ code: 'zu-viele-anfragen' })
        }
        return null
      }
      const ereignisse: NtfyEreignis[] = []
      for (const zeile of (await antwort.text()).split('\n')) {
        if (!zeile.trim()) continue
        try {
          const e = JSON.parse(zeile) as NtfyEreignis
          if (e && typeof e === 'object' && e.event === 'message') ereignisse.push(e)
        } catch {
          // Eine kaputte Zeile kostet nur sich selbst.
        }
      }
      return ereignisse
    } catch {
      return null
    }
  }

  /**
   * Lädt einen angekündigten Anhang: nur vom eigenen Server (ntfy lässt Absender auch fremde Adressen angeben),
   * nur bis {@link MAX_ANHANG} und nur, wenn er genau `bytes` lang ist.
   */
  protected async ladeAnhang(url: string, bytes: number): Promise<string | null> {
    if (!url.startsWith(`${this.server}/file/`) || bytes > MAX_ANHANG) return null
    this.zaehleStill('anfrage')
    try {
      const antwort = await fetch(url)
      if (!antwort.ok) return null
      const laenge = Number(antwort.headers?.get?.('content-length') ?? NaN)
      if (Number.isFinite(laenge) && laenge > bytes) return null
      const text = await antwort.text()
      return text.length === bytes ? text : null
    } catch {
      return null
    }
  }

  // -------------------------------------------------------------------------
  // Senden
  // -------------------------------------------------------------------------

  /** Stößt die Sende-Schlange an; schläft sie gerade weckbar, wacht sie auf. */
  protected kick(): void {
    if (this.pumpt) {
      this.nochmalPumpen = true
      this.wecker?.()
      return
    }
    if (this.gestoppt || !this.abonniert) return
    this.pumpt = true
    this.nochmalPumpen = false
    void this.pumpe()
      .catch(() => {})
      .finally(() => {
        this.pumpt = false
        if (this.nochmalPumpen) this.kick()
      })
  }

  /** Warten; `weckbar` lässt sich von {@link kick} unterbrechen. */
  protected schlafe(ms: number, weckbar: boolean): Promise<void> {
    return new Promise((resolve) => {
      let timer: ReturnType<typeof setTimeout> | undefined = undefined
      const fertig = (): void => {
        clearTimeout(timer)
        this.schlaefer.delete(fertig)
        if (this.wecker === fertig) this.wecker = null
        resolve()
      }
      timer = setTimeout(fertig, ms)
      this.schlaefer.add(fertig)
      if (weckbar) this.wecker = fertig
    })
  }

  /** Nach einem gescheiterten Senden: steigende Pause, bei 429 mindestens {@link NtfyZeiten.zuVieleMs}. */
  protected async warteNachFehler(ergebnis: PostErgebnis): Promise<void> {
    const stufen = this.zeiten.wiederholenMs
    const warte = stufen[Math.min(this.fehlschlaege, stufen.length - 1)]
    this.fehlschlaege += 1
    await this.schlafe(ergebnis.art === 'warten' ? Math.max(warte, this.zeiten.zuVieleMs) : warte, false)
  }

  protected async post(thema: string, text: string): Promise<PostErgebnis> {
    this.zaehleStill('anfrage')
    try {
      const antwort = await fetch(`${this.server}/${thema}`, { method: 'POST', body: text })
      if (antwort.ok) {
        this.zaehleStill('nachricht')
        this.fehlschlaege = 0
        if (this.sendeFehler) {
          this.fehler.value = null
          this.sendeFehler = false
        }
        let ereignis: NtfyEreignis | null = null
        try {
          const gelesen: unknown = JSON.parse(await antwort.text())
          if (gelesen && typeof gelesen === 'object') ereignis = gelesen as NtfyEreignis
        } catch {
          ereignis = null
        }
        return { art: 'ok', antwort: ereignis }
      }
      if (antwort.status === 429) {
        this.zaehleStill('gedrosselt')
        this.meldeSendefehler({ code: 'zu-viele-anfragen' })
        return { art: 'warten' }
      }
      if (antwort.status >= 500 || antwort.status === 408) return { art: 'nochmal' }
      this.meldeSendefehler({ code: antwort.status === 413 ? 'zu-gross' : 'abgewiesen', status: antwort.status })
      return { art: 'verworfen', status: antwort.status }
    } catch {
      return { art: 'nochmal' }
    }
  }

  protected meldeSendefehler(fehler: TransportFehler): void {
    this.fehler.value = fehler
    this.sendeFehler = true
  }
}
