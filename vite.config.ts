import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'
import { viteSingleFile } from 'vite-plugin-singlefile'
import { execSync } from 'node:child_process'
import type { Plugin } from 'vite'
import { schreibeOfflineSpeicher, SW_ABMELDEN, SW_DATEI, type OfflineFassung } from './scripts/offline-speicher.ts'

/**
 * Letzter Commit, aus dem gebaut wird: kurze ID und Zeitpunkt. Außerhalb eines
 * Git-Arbeitsverzeichnisses bleibt beides leer. Liegen nicht committete
 * Änderungen vor, bekommt die ID ein „+“.
 */
function gitStand(): { commit: string; time: string } {
  try {
    const git = (args: string) => execSync(`git ${args}`, { encoding: 'utf8' }).trim()
    const dirty = git('status --porcelain --untracked-files=no') !== ''
    return { commit: git('rev-parse --short HEAD') + (dirty ? '+' : ''), time: git('log -1 --format=%cI') }
  } catch {
    return { commit: '', time: '' }
  }
}

/**
 * Offline-Speicher des Pages-Builds: schreibt nach dem Build `sw.js` mit der Liste aller
 * Dateien in `dist/` (scripts/offline-speicher.ts) und verweist auf das Web-App-Manifest.
 * Die Ein-Datei-Fassung bekommt beides nicht – sie muss eine einzige Datei bleiben.
 * Der Entwicklungsserver liefert statt des Speichers dessen Abmeldung.
 */
function offlineSpeicher(fassung: OfflineFassung): Plugin {
  let ordner = 'dist'
  let bauen = false
  return {
    name: 'alcatraz-offline-speicher',
    configResolved(config) {
      ordner = config.build.outDir
      // Nicht beim Entwicklungsserver und nicht in den Tests, die diese Datei ebenfalls laden.
      bauen = config.command === 'build' && !process.env.VITEST
    },
    transformIndexHtml: () => [{ tag: 'link', attrs: { rel: 'manifest', href: './manifest.webmanifest' }, injectTo: 'head' }],
    configureServer(server) {
      server.middlewares.use(`/${SW_DATEI}`, (_anfrage, antwort) => {
        antwort.setHeader('Content-Type', 'text/javascript')
        antwort.setHeader('Cache-Control', 'no-store')
        antwort.end(SW_ABMELDEN)
      })
    },
    closeBundle() {
      if (bauen) schreibeOfflineSpeicher(ordner, fassung)
    },
  }
}

/**
 * Zwei Build-Ziele:
 *
 * - Standard (`npm run build`) → `dist/`, relative Basis, läuft auf GitHub Pages.
 * - `--mode single` (`npm run build:single`) → `dist-single/index.html`: eine
 *   einzige HTML-Datei mit allem darin. Sie lässt sich per Doppelklick direkt
 *   aus dem Dateisystem öffnen (file://) – ohne Webserver und ohne Internet.
 */
export default defineConfig(({ mode }) => {
  const single = mode === 'single'
  const stand = gitStand()
  // Ein Zeitpunkt für Seite und Offline-Speicher: Beide nennen dieselbe Fassung.
  const bauZeit = new Date().toISOString()
  return {
    base: './',
    define: {
      __BUILD_TIME__: JSON.stringify(bauZeit),
      __BUILD_COMMIT__: JSON.stringify(stand.commit),
      __BUILD_COMMIT_TIME__: JSON.stringify(stand.time),
    },
    plugins: [vue(), ...(single ? [viteSingleFile({ removeViteModuleLoader: true })] : [offlineSpeicher({ fassung: stand.commit, commitZeit: stand.time, zeit: bauZeit })])],
    // Manifest und Zeichen (public/) gehören nur zum Pages-Build.
    publicDir: single ? false : 'public',
    build: single
      ? {
          outDir: 'dist-single',
          assetsInlineLimit: 100 * 1024 * 1024,
          cssCodeSplit: false,
          rollupOptions: { output: { inlineDynamicImports: true } },
        }
      : { outDir: 'dist' },
    test: {
      environment: 'happy-dom',
      include: ['src/**/*.test.ts'],
      setupFiles: ['src/test-setup.ts'],
      // Einige Tests bauen Dutzende Bögen; laufen mehrere Testläufe zugleich, reichen 5 s nicht.
      testTimeout: 30_000,
    },
  }
})
