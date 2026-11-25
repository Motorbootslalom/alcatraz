import type { Locale } from '../i18n'

/** Stand der laufenden Fassung – in der Fußzeile sichtbar, siehe vite.config.ts. */
export const BUILD_TIME = typeof __BUILD_TIME__ === 'string' ? __BUILD_TIME__ : ''
export const BUILD_COMMIT = typeof __BUILD_COMMIT__ === 'string' ? __BUILD_COMMIT__ : ''
export const BUILD_COMMIT_TIME = typeof __BUILD_COMMIT_TIME__ === 'string' ? __BUILD_COMMIT_TIME__ : ''

/**
 * Die Adresse der App auf GitHub Pages (README.md). Lese-Links für Anzeigetafel und Zuschauer (E6) zeigen auf sie,
 * wenn der Bedienrechner die Ein-Datei-Fassung von `file://` öffnet: Eine Datei auf dem Stick erreicht kein Handy.
 * Fest im Code statt als Build-Variable – die Adresse ist öffentlich und dieselbe für beide Builds (16.11.2026).
 */
export const PAGES_URL = 'https://motorbootslalom.github.io/alcatraz/'

/**
 * Das Repository auf GitHub mit Anleitung (README) und Lizenz. Wunsch des Nutzers vom 24.11.2026: Die App verweist
 * auf die GitHub-Seite, bei englischer Oberfläche gleich auf die englische README. Nur Links – geladen wird erst
 * auf Klick (kein Netz ohne Klick). Fest im Code wie PAGES_URL: öffentlich und für beide Builds gleich.
 * Die deutsche README ist die Startseite des Repositorys (`#readme` springt dorthin); die englische liegt auf master.
 */
export const GITHUB_URL = 'https://github.com/Motorbootslalom/alcatraz'
export const ANLEITUNG_URL = {
  de: `${GITHUB_URL}#readme`,
  en: `${GITHUB_URL}/blob/master/README.en.md`,
} as const satisfies Record<Locale, string>

/** Ziel des Anleitungs-Links nach der Sprache der Oberfläche (nicht der Listensprache: Es liest der Bediener). */
export function anleitungUrl(sprache: Locale): string {
  return ANLEITUNG_URL[sprache]
}
