/* global STAND */
/*
 * Offline-Speicher für das Programm (Service Worker). Diese Datei ist die Vorlage: Beim Build
 * setzt scripts/offline-speicher.ts die Zeile `const STAND = …` davor – Fassung, Kennung und
 * die Liste ALLER ausgelieferten Dateien mit ihrer Prüfsumme. Ändert sich eine Datei, ändert
 * sich die Liste und damit diese Datei; daran erkennt der Browser eine neue Fassung.
 *
 * Bewusst von Hand statt mit Workbox: vier Dateien, eine Strategie (alles vorab, nichts
 * nachladen), und das Verhalten bei einer neuen Fassung soll hier nachlesbar sein:
 *
 * - Die neue Fassung lädt vollständig in einen EIGENEN Cache und wartet dann. Sie übernimmt
 *   erst, wenn die Seite es verlangt (`uebernehmen`) oder kein Fenster der alten Fassung mehr
 *   offen ist. Kein `skipWaiting()` beim Installieren: Mitten im Wettkampf wechselt nichts.
 * - Jede Fassung antwortet nur aus ihrem eigenen Cache – nie ein Gemisch aus alt und neu.
 */

// Auf derselben Adresse (github.io) liegen weitere Anwendungen; Caches gelten je Adresse.
// Der Pfad im Namen sorgt dafür, dass hier nur die eigenen Caches aufgeräumt werden.
const BASIS = self.registration.scope
const PREFIX = `alcatraz-offline|${new URL(BASIS).pathname}|`
const CACHE = PREFIX + STAND.kennung

const adr = (pfad) => new URL(pfad, BASIS).href

async function hex(puffer) {
  const summe = await crypto.subtle.digest('SHA-256', puffer)
  return [...new Uint8Array(summe)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

async function fehlende() {
  const cache = await caches.open(CACHE)
  const da = new Set((await cache.keys()).map((r) => r.url))
  return STAND.dateien.filter(([pfad]) => !da.has(adr(pfad)))
}

/**
 * Holt, was im Cache fehlt. Am Browser-Cache vorbei (`no-store`), und nur, was zur Liste passt:
 * Liefert der Server während einer Veröffentlichung noch die alte Datei, schlägt das Füllen
 * fehl und wird beim nächsten Mal wiederholt – statt eine Fassung aus zwei Ständen zu mischen.
 */
async function fuellen() {
  const cache = await caches.open(CACHE)
  const offen = await fehlende()
  await Promise.all(
    offen.map(async ([pfad, summe]) => {
      const antwort = await fetch(adr(pfad), { cache: 'no-store' })
      if (!antwort.ok) throw new Error(`${pfad}: ${antwort.status}`)
      const inhalt = await antwort.arrayBuffer()
      if ((await hex(inhalt)) !== summe) throw new Error(`${pfad}: anderer Stand als die Liste`)
      // Neu verpackt: Eine umgeleitete Antwort dürfte der Browser nicht als Seite ausliefern.
      const kopf = new Headers()
      for (const name of ['content-type', 'last-modified']) {
        const wert = antwort.headers.get(name)
        if (wert) kopf.set(name, wert)
      }
      await cache.put(adr(pfad), new Response(inhalt, { headers: kopf }))
    }),
  )
}

/** Läuft schon ein Füllen, wird darauf gewartet statt dieselben Dateien ein zweites Mal zu holen. */
let laufend
function fuellenEinmal() {
  laufend ??= fuellen().finally(() => {
    laufend = undefined
  })
  return laufend
}

async function stand() {
  return {
    typ: 'stand',
    fassung: STAND.fassung,
    kennung: STAND.kennung,
    dateien: STAND.dateien.length,
    fehlend: (await fehlende()).length,
    // Liegt die Ein-Datei-Fassung daneben (Pages), kann die Seite sie auch ohne Netz anbieten.
    eindatei: STAND.dateien.some(([pfad]) => pfad === 'alcatraz.html'),
  }
}

self.addEventListener('install', (ereignis) => {
  ereignis.waitUntil(fuellen())
})

self.addEventListener('activate', (ereignis) => {
  ereignis.waitUntil(
    (async () => {
      for (const name of await caches.keys()) {
        if (name.startsWith(PREFIX) && name !== CACHE) await caches.delete(name)
      }
      // Beim allerersten Mal gilt der Speicher sofort für das offene Fenster. Bei einer neuen
      // Fassung kommt man nur nach `uebernehmen` hierher – das Fenster lädt dann selbst neu.
      await self.clients.claim()
    })(),
  )
})

self.addEventListener('message', (ereignis) => {
  const typ = ereignis.data && ereignis.data.typ
  const antworte = (nachricht) => (ereignis.ports[0] ?? ereignis.source)?.postMessage(nachricht)
  if (typ === 'uebernehmen') {
    self.skipWaiting()
  } else if (typ === 'stand') {
    ereignis.waitUntil(
      (async () => {
        // Hat der Browser Dateien verworfen, wird nachgefüllt (ohne Netz bleibt es beim Versuch).
        if ((await fehlende()).length === 0) return antworte(await stand())
        const voll = await fuellenEinmal().then(
          () => true,
          () => false,
        )
        antworte(await stand())
        // Auf einer langsamen Verbindung wartet die Seite nicht so lange auf die Antwort. Ist jetzt
        // alles da, erfahren es alle Fenster von selbst. Nur dann: Eine Meldung nach einem
        // gescheiterten Versuch stieße ohne Netz den nächsten an, ohne Ende.
        if (voll) {
          const meldung = await stand()
          for (const fenster of await self.clients.matchAll({ type: 'window', includeUncontrolled: true })) fenster.postMessage(meldung)
        }
      })(),
    )
  }
})

async function antwort(anfrage, pfad) {
  const cache = await caches.open(CACHE)
  const treffer = await cache.match(adr(pfad))
  // Was nicht zur Liste gehört (oder verworfen wurde), kommt aus dem Netz – wie ohne Speicher.
  return treffer ?? fetch(anfrage)
}

self.addEventListener('fetch', (ereignis) => {
  const anfrage = ereignis.request
  if (anfrage.method !== 'GET' || !anfrage.url.startsWith(BASIS)) return
  // Ohne Abfrageteil und Sprungmarke; der Ordner selbst ist die Startseite.
  const pfad = new URL(anfrage.url).pathname.slice(new URL(BASIS).pathname.length) || 'index.html'
  ereignis.respondWith(antwort(anfrage, pfad))
})
