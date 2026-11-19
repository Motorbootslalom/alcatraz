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
