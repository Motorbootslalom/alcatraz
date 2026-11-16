import type { Ref } from 'vue'

/**
 * Was jeder Transport zwischen Bedienrechner (Host) und Geräten nach außen zeigt (aus dem Prototyp tafel,
 * transport/types.ts, 16.11.2026 – ohne `lan`/`cloud`: ein eigenes Relais braucht einen Server, alcatraz bleibt
 * statisch; Entscheidung 16.11.2026: vorerst kein Gerätebetrieb ohne Internet). Die Schnittstelle bleibt offen,
 * damit später ein Weiterleiter im LAN dieselben versiegelten Nachrichten tragen könnte (Plan F2).
 *
 * Fehler gehen als Code hinaus, nie als Text: Die Oberfläche (ab E6) übersetzt sie in ihrer Sprache
 * (`geraete.fehler.<code>`), und auf der Leitung steht kein deutscher Satz.
 */

export type Verbindungsstand = 'aus' | 'verbinde' | 'verbunden' | 'neu-verbinden' | 'fehler'

export type Fehlercode =
  /** Der Browser kann nicht packen (CompressionStream fehlt, vor Safari 16.4). */
  | 'browser-zu-alt'
  /** Die Adresse des ntfy-Servers taugt nicht. */
  | 'server-ungueltig'
  /** Host: Raum und Schlüssel fehlen auf diesem Rechner. */
  | 'raum-fehlt'
  /** Host: Der Raum wurde mit einem anderen Server angelegt – ein anderer Server heißt neuer Raum. */
  | 'raum-anderer-server'
  /** Gerät: Das Paket aus Link oder QR-Code ist unvollständig. */
  | 'link-ungueltig'
  /** Verbindung zu ntfy gestört oder abgebrochen (es wird neu verbunden). */
  | 'verbindung-gestoert'
  /** ntfy: zu viele Anfragen (429); es geht nach einer Pause weiter. */
  | 'zu-viele-anfragen'
  /** ntfy hat eine Nachricht abgelehnt (4xx, `status`); sie ist verworfen. */
  | 'abgewiesen'
  /** Eine Nachricht ist größer als jeder Anhang sein darf; sie ist verworfen. */
  | 'zu-gross'
  /** Host und Gerät haben verschiedene Fassungen (Protokoll `v` oder Sicht `sv`, Plan F7: dann kein Betrieb). */
  | 'fassung'
  /**
   * Raum (Host) bzw. Verbindung (Gerät) ließen sich nicht ablegen (localStorage voll). Der Betrieb läuft mit dem
   * Stand im Arbeitsspeicher weiter; nach einem Neuladen stimmen die Nummern nicht mehr – Platz schaffen (Host: etwa
   * Logos entfernen) bzw. neu koppeln.
   */
  | 'ablage-voll'

export interface TransportFehler {
  code: Fehlercode
  /** HTTP-Status bei `abgewiesen`. */
  status?: number
}

/** Was jede Seite (Host und Gerät) an Zustand der Verbindung anbietet. */
export interface Transport {
  readonly art: 'ntfy'
  readonly status: Ref<Verbindungsstand>
  readonly fehler: Ref<TransportFehler | null>
  /** Verbindung aufbauen. Mehrfachaufrufe sind unschädlich. */
  start(): Promise<void>
  stop(): void
}
