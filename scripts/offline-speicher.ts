import { createHash } from 'node:crypto'
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * Schreibt den Offline-Speicher (`sw.js`) in einen fertig gebauten Ordner: die Vorlage
 * scripts/offline-sw.js, davor die Liste ALLER Dateien des Ordners mit Prüfsumme.
 *
 * Bewusst über den Ordner statt über das Bündel von Vite: So stehen auch Dateien in der Liste,
 * die erst nach dem Build dazukommen – die Ein-Datei-Fassung `alcatraz.html`, die
 * .github/workflows/deploy.yml in den Ordner kopiert. Deshalb gibt es den Aufruf zweimal:
 * als Vite-Plugin am Ende von `npm run build` und von Hand nach dem Kopieren:
 *
 *   node scripts/offline-speicher.ts dist
 */
export const SW_DATEI = 'sw.js'

const VORLAGE = join(dirname(fileURLToPath(import.meta.url)), 'offline-sw.js')

function dateien(ordner: string, unter = ordner): string[] {
  return readdirSync(unter, { withFileTypes: true })
    .flatMap((e) => (e.isDirectory() ? dateien(ordner, join(unter, e.name)) : [relative(ordner, join(unter, e.name)).split(sep).join('/')]))
    .sort()
}

const sha256 = (inhalt: Buffer | string) => createHash('sha256').update(inhalt).digest('hex')

/** Woran man eine Fassung erkennt – dieselben Angaben wie in der Fußzeile (src/lib/build.ts). */
export interface OfflineFassung {
  /** Codestand zur Anzeige (Commit); leer außerhalb von Git. */
  fassung: string
  /** Zeitpunkt des Commits und des Builds (ISO); leer, wenn unbekannt. */
  commitZeit: string
  zeit: string
}

export interface OfflineStand extends OfflineFassung {
  /** Prüfsumme über die Liste: Name des Caches. Jede geänderte Datei ergibt eine neue Kennung. */
  kennung: string
  /** Pfad relativ zum Ordner und SHA-256 des Inhalts. */
  dateien: [pfad: string, summe: string][]
}

export function offlineStand(ordner: string, fassung: OfflineFassung): OfflineStand {
  const liste = dateien(ordner)
    .filter((pfad) => pfad !== SW_DATEI)
    .map((pfad): [string, string] => [pfad, sha256(readFileSync(join(ordner, pfad)))])
  // Die Kennung hängt allein am Inhalt der Dateien. Weil die Bauzeit im Bundle steht (lib/build.ts,
  // Fuß der Seite), ist aber jeder Neubau eine neue Fassung – auch bei gleichem Code; nur dieselben
  // Dateien (etwa zweimal dieselbe `dist` verarbeitet) ergeben dieselbe Kennung.
  return { fassung: fassung.fassung, commitZeit: fassung.commitZeit, zeit: fassung.zeit, kennung: sha256(JSON.stringify(liste)).slice(0, 16), dateien: liste }
}

/**
 * Die Fassung, die schon in einer `sw.js` steht – für den zweiten Aufruf nach dem Kopieren. Sie
 * stammt vom ersten Aufruf desselben Builds; eine `sw.js` älterer Bauart wird nicht gelesen.
 */
function fassungAus(ordner: string): OfflineFassung {
  try {
    const kopf = readFileSync(join(ordner, SW_DATEI), 'utf8').split('\n', 1)[0]
    const { fassung, commitZeit, zeit } = JSON.parse(kopf.replace(/^const STAND = /, '')) as OfflineStand
    return { fassung, commitZeit, zeit }
  } catch {
    return { fassung: '', commitZeit: '', zeit: '' }
  }
}

export function schreibeOfflineSpeicher(ordner: string, fassung: OfflineFassung = fassungAus(ordner)): OfflineStand {
  const stand = offlineStand(ordner, fassung)
  writeFileSync(join(ordner, SW_DATEI), `const STAND = ${JSON.stringify(stand)}\n${readFileSync(VORLAGE, 'utf8')}`)
  return stand
}

/**
 * Für den Entwicklungsserver: Hat der gebaute Stand (`vite preview`) auf demselben Port einen
 * Offline-Speicher hinterlassen, lieferte der weiter die gebaute Fassung statt der Quellen.
 * Diese `sw.js` löst ihn ab, räumt auf und lädt die offenen Fenster neu.
 */
export const SW_ABMELDEN = `// Entwicklungsserver: kein Offline-Speicher (scripts/offline-speicher.ts).
self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (ereignis) => {
  ereignis.waitUntil(
    (async () => {
      const pfad = new URL(self.registration.scope).pathname
      for (const name of await caches.keys()) if (name.startsWith('alcatraz-offline|' + pfad + '|') || name === 'alcatraz-fassung|' + pfad) await caches.delete(name)
      await self.registration.unregister()
      for (const fenster of await self.clients.matchAll({ type: 'window', includeUncontrolled: true })) fenster.navigate(fenster.url)
    })(),
  )
})
`

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const ordner = process.argv[2]
  if (!ordner) {
    console.error('Aufruf: node scripts/offline-speicher.ts <Ordner>')
    process.exit(1)
  }
  const stand = schreibeOfflineSpeicher(ordner)
  console.log(`${join(ordner, SW_DATEI)}: ${stand.dateien.length} Dateien, Kennung ${stand.kennung}`)
}
